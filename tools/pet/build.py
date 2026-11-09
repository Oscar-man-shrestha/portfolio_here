# Builds the pet: the small collectible figure of Oscar that stands in the corner and opens OMS-mini when clicked.
# The figure was made in Google Flow from Oscar's own photo; the clip shows it waving hello and settling back into its
# starting pose (the same image as first and last frame). This script:
#   1. takes frames at a steady rate (12 fps is plenty for a figure this size);
#   2. cuts the figure out of each frame with Apple Vision (tools/headturn/lift.m, on-device) and drops the clip's
#      corner mark;
#   3. crops every frame to one box around the figure, so it never shifts;
#   4. packs the frames into one WebP sheet with transparency (a grid that components/Pet plays on a canvas), and
#      saves the first frame on its own as the still shown before the sheet has loaded;
#   5. writes the file names, frame count and size to lib/pet.json.
#
#   python3 tools/pet/build.py /tmp/lift path/to/clip.mp4
#
# Needs ffmpeg, Python 3 with numpy and Pillow.
import argparse, hashlib, json, os, shutil, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument("lift", help="compiled tools/headturn/lift.m")
ap.add_argument("clip")
ap.add_argument("--fps", type=int, default=12)
ap.add_argument("--height", type=int, default=320, help="frame height in the sheet (shown at up to half that, so it stays sharp on 2x screens)")
ap.add_argument("--cols", type=int, default=12)
ap.add_argument("--quality", type=int, default=82)
ap.add_argument("--mark", default="1690:850:1790:950", help="x0:y0:x1:y1 of the clip's corner mark (at 1920x1080), made transparent")
ap.add_argument("--pad", type=float, default=0.02, help="space kept around the figure, as a share of its height")
ap.add_argument("--out", default="public/img/pet")
ap.add_argument("--url", default="/img/pet")
ap.add_argument("--json", default="lib/pet.json")
ap.add_argument("--alt", default="A small collectible figure of Oscar")
a = ap.parse_args()
mx0, my0, mx1, my1 = (int(v) for v in a.mark.split(":"))


def vision(cmd, out, label):
    # Vision occasionally returns nothing on a busy machine; the same frame works on a second try
    for _ in range(4):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if os.path.exists(out):
            return r
    raise SystemExit(f"{label}: {cmd[0]} failed: {r.stdout.strip()} {r.stderr.strip()[:200]}")


with tempfile.TemporaryDirectory() as work:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.clip, "-vf", f"fps={a.fps}", "-start_number", "0", os.path.join(work, "f%03d.png")], check=True)
    files = sorted(f for f in os.listdir(work) if f.startswith("f"))

    def cut(f):
        src, stem = os.path.join(work, f), os.path.join(work, "c" + f[1:-4])
        vision([a.lift, src, stem], stem + "_all.png", f)
        rgb = np.asarray(Image.open(src).convert("RGB"))
        alpha = np.asarray(Image.open(stem + "_all.png").convert("RGBA"))[..., 3].copy()
        h, w = alpha.shape
        sx, sy = w / 1920, h / 1080
        alpha[int(my0 * sy):int(my1 * sy), int(mx0 * sx):int(mx1 * sx)] = 0
        # pull the edge in by a pixel and soften it, so no grey from the studio background rims the figure
        alpha = np.asarray(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8)))
        return np.dstack([rgb, alpha])

    with ThreadPoolExecutor(4) as pool:
        frames = list(pool.map(cut, files))
    print(f"{len(frames)} frames cut out", flush=True)

    # one box around the figure in every frame
    ys, xs = [], []
    for f in frames:
        r, c = np.where(f[..., 3] > 24)
        if len(r):
            ys += [r.min(), r.max()]
            xs += [c.min(), c.max()]
    H, W = frames[0].shape[:2]
    pad = int((max(ys) - min(ys)) * a.pad)
    y0, y1 = max(0, min(ys) - pad), min(H, max(ys) + pad + 1)
    x0, x1 = max(0, min(xs) - pad), min(W, max(xs) + pad + 1)
    fh = a.height
    fw = round((x1 - x0) * fh / (y1 - y0))
    print(f"box {x0}:{y0}-{x1}:{y1}, frames {fw}x{fh}", flush=True)

    n = len(frames)
    cols = min(a.cols, n)
    rows = -(-n // cols)
    sheet = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
    first = None
    for i, f in enumerate(frames):
        im = Image.fromarray(f[y0:y1, x0:x1], "RGBA").resize((fw, fh), Image.LANCZOS)
        first = first or im
        sheet.paste(im, ((i % cols) * fw, (i // cols) * fh))
    sheet_path, still_path = os.path.join(work, "wave.webp"), os.path.join(work, "still.webp")
    sheet.save(sheet_path, "WEBP", quality=a.quality, alpha_quality=90, method=6)
    first.save(still_path, "WEBP", quality=88, alpha_quality=95, method=6)
    blobs = {"wave.webp": open(sheet_path, "rb").read(), "still.webp": open(still_path, "rb").read()}

    tag = hashlib.sha256(blobs["wave.webp"] + blobs["still.webp"]).hexdigest()[:8]
    shutil.rmtree(a.out, ignore_errors=True)
    os.makedirs(os.path.join(a.out, tag))
    for name, blob in blobs.items():
        with open(os.path.join(a.out, tag, name), "wb") as out:
            out.write(blob)
        print(f"{name}: {len(blob) // 1024} KB", flush=True)
    with open(a.json, "w") as out:
        json.dump({"fps": a.fps, "w": fw, "h": fh, "n": n, "cols": cols, "alt": a.alt,
                   "sheet": f"{a.url}/{tag}/wave.webp", "still": f"{a.url}/{tag}/still.webp"}, out, indent=2)
        out.write("\n")
    print(f"wrote {a.json}")
