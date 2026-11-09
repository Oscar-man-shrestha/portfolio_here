# Cleans the feet of the profile turntable frames (lib/turn360.json): Vision's person matte kept pieces of the
# studio turntable disc around the shoes in some views, and read a few spots of white leather as background.
# Near the floor, the shoes' black leather marks where each shoe is; anything below a shoe's sole, or in columns with
# no shoe nearby, is the disc and becomes transparent. Holes enclosed inside the shoes are filled from their
# surroundings. Pixels of Oscar himself are otherwise untouched. Writes the frames to a new folder (named after their
# content, so cached old frames are never reused) and updates lib/turn360.json.
#
#   python3 tools/headturn/clean_feet.py
import hashlib, io, json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def clean(im, band_from=0.885, sole=0.0095, reach=0.016):
    """Drop the studio disc under the feet. The legs and the shoes' dark uppers form one big dark shape; a shoe's
    midsole and outsole sit just below it. Below that (and in columns with no shoe nearby) is the disc."""
    a = np.asarray(im.convert("RGBA")).astype(np.int32).copy()
    h, w = a.shape[:2]
    al, lum = a[..., 3], a[..., :3].mean(2)
    y0, s, r = int(h * band_from), max(2, int(h * sole)), max(2, int(h * reach * 0.6))
    # the shoes' black leather near the floor: big dark blobs (the disc's rim is only a thin line)
    dark = (lum < 75) & (al > 150) & (np.arange(h)[:, None] >= int(h * 0.84))
    lab, n = ndi.label(dark, structure=np.ones((3, 3)))
    if n == 0: return im, 0
    sizes = ndi.sum(dark, lab, range(1, n + 1))
    main = np.isin(lab, 1 + np.nonzero(sizes >= (h * w) * 0.0012)[0])
    ys = np.arange(h)[:, None]
    low = np.where(main, ys, -1).max(0)                    # lowest point of the main dark shape per column
    low = ndi.maximum_filter1d(low, size=2 * r + 1)          # a white toe or heel next to a dark part counts
    floor = np.where(low >= 0, low + s, -1)
    # in a side view the sole ends in a dark rubber line just below the upper: cut right under it when it's there
    edge = (lum < 95) & (al > 150)
    for x in np.nonzero(low >= 0)[0]:
        seg = edge[low[x] + 1:min(h, low[x] + s + 5), x]
        if seg.any(): floor[x] = low[x] + 1 + int(np.nonzero(seg)[0].max()) + 1
    remove = (ys >= y0) & (al > 0) & ((floor < 0)[None, :] | (ys > floor[None, :]))
    count = int((remove & (al > 20)).sum())
    a[..., 3] = np.where(remove, 0, al)
    # holes the cut-out left inside the shoes (white leather read as background): fill them from their surroundings
    solid = a[..., 3] > 128
    filled = ndi.binary_fill_holes(solid)
    holes = filled & ~solid & (ys >= int(h * 0.84))
    holes = ndi.binary_dilation(holes, iterations=2) & filled  # and their soft rim, so no red ring shows
    if holes.any():
        for c in range(3):
            ch = a[..., c].astype(np.float32)
            wgt = solid.astype(np.float32)
            num = ndi.uniform_filter(ch * wgt, 9); den = ndi.uniform_filter(wgt, 9)
            a[..., c] = np.where(holes, np.round(num / np.maximum(den, 1e-3)), a[..., c])
        a[..., 3] = np.where(holes, 255, a[..., 3])
        count += int(holes.sum())
    return Image.fromarray(a.astype(np.uint8)), count


if __name__ == "__main__":
    meta = json.load(open("lib/turn360.json"))
    src = "public" + meta["dir"]
    out_files, report = {}, []
    for sub in sorted(os.listdir(src)):
        for f in sorted(os.listdir(os.path.join(src, sub))):
            if not f.endswith(".webp"): continue
            im = Image.open(os.path.join(src, sub, f))
            cleaned, n = clean(im)
            buf = io.BytesIO()
            cleaned.save(buf, "WEBP", quality=88, alpha_quality=95, method=6)
            out_files[f"{sub}/{f}"] = buf.getvalue()
            if n: report.append(f"{sub}/{f}: {n}")
    tag = hashlib.sha256(b"".join(out_files[k] for k in sorted(out_files))).hexdigest()[:8]
    dst = os.path.join(os.path.dirname(src), tag)
    for k, blob in out_files.items():
        os.makedirs(os.path.join(dst, os.path.dirname(k)), exist_ok=True)
        open(os.path.join(dst, k), "wb").write(blob)
    if os.path.abspath(dst) != os.path.abspath(src): shutil.rmtree(src)
    meta["dir"] = os.path.dirname(meta["dir"]) + "/" + tag
    json.dump(meta, open("lib/turn360.json", "w"), indent=2); open("lib/turn360.json", "a").write("\n")
    print(f"cleaned {len(report)} frames -> {meta['dir']}"); print("  " + "\n  ".join(report))
