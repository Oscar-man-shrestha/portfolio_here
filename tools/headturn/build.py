# Builds the hero portrait frames from a short clip of Oscar (his photo animated in Google Flow).
#   1. measure motion per frame (face and hands);
#   2. pick frames evenly spaced in motion: dense where he moves fast, sparse where he barely moves, so playback and
#      scrolling both look smooth with few frames;
#   3. cut out each frame with Apple Vision (lift.m, on-device); optionally repair a far sunglasses lens with Vision's
#      person matte (segp.m), for clips where the subject mask treats the tinted lens as see-through;
#   4. apply one crop to every frame, so they stay aligned;
#   5. encode WebP at full size and a smaller set for phones;
#   6. write frame numbers, motion positions and named moments ("marks") to lib/headturn.json.
#
# Needs ffmpeg, ffprobe, cwebp, Python 3 with numpy, scipy and Pillow, and the compiled tools (see README).
import argparse, hashlib, json, os, shutil, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument("clip")
ap.add_argument("lift", help="compiled lift.m (subject cut-out)")
ap.add_argument("segp", nargs="?", help="compiled segp.m (person matte), only needed for the lens repair")
ap.add_argument("--out", default="public/img/headturn", help="frames go in a subfolder named after the clip; other subfolders are removed")
ap.add_argument("--url", default="/img/headturn", help="where --out is served on the site")
ap.add_argument("--json", default="lib/headturn.json")
ap.add_argument("--frames", type=int, default=32, help="frames picked across the motion range")
ap.add_argument("--max-gap", type=int, default=0, help="also never leave more than this many clip frames between two picks (0 = off)")
ap.add_argument("--phone-height", type=int, default=760)
ap.add_argument("--crop", default="1420:1080:260:0", help="ffmpeg crop w:h:x:y keeping both shoulders, leaving out the corner mark")
ap.add_argument("--head", default="550:620:685:0", help="ffmpeg crop where the motion happens (face, hands)")
ap.add_argument("--turn", default="20:76", help="first:last frame of the motion range")
ap.add_argument("--marks", default="", help="named frames always included, e.g. rest=72,smile=124")
ap.add_argument("--lens", default="860:180:1240:560", help="x0:y0:x1:y1 (inside --crop) where a far lens can appear, or 'none'")
ap.add_argument("--dry", action="store_true", help="only print the picked frames")
a = ap.parse_args()
if a.lens != "none" and not a.segp:
    ap.error("the lens repair needs segp (or pass --lens none)")


def fix_lens(inst_a, person, roi):
    """Make the far sunglasses lens solid. Inside `roi`, take the large regions the person matte marks as person that
    the subject mask dropped, plus everything the lens frame encloses, and make them opaque. Returns alpha 0–1."""
    al = inst_a.astype(np.float32) / 255
    x0, y0, x1, y1 = roi
    A = al[y0:y1, x0:x1]
    ps = np.clip((person[y0:y1, x0:x1].astype(np.float32) / 255 - 0.10) / 0.18, 0, 1)  # tinted lens counts as solid
    D = ndi.binary_opening((ps > 0.5) & (A < 0.5), structure=np.ones((7, 7)))  # no thin slivers along cheek or hair
    lab, n = ndi.label(D)
    keep = np.zeros_like(D)
    for i in range(1, n + 1):
        comp = lab == i
        if comp.sum() > 500:
            keep |= comp
    S = ndi.binary_closing((ps > 0.5) | (A > 0.5), structure=np.ones((5, 5)))
    F = ndi.binary_fill_holes(S)
    seeds = keep | (F & ~S)  # dropped lens regions and whatever the lens frame encloses
    if not seeds.any():
        return al
    lab, _ = ndi.label((F & (A < 0.5)) | seeds)
    ids = np.unique(lab[seeds])
    lens = np.isin(lab, ids[ids > 0])
    # grow over the soft inner edge of the frame (no see-through seam) but never past the lens outline
    fill = ndi.gaussian_filter((ndi.binary_dilation(lens, iterations=6) & F).astype(np.float32), 0.7)
    R = np.maximum(A, fill)
    # last pass: any half-transparent patch enclosed by opaque lens and frame becomes opaque too
    hard = R >= 0.97
    R[ndi.binary_fill_holes(hard) & ~hard] = 1.0
    al[y0:y1, x0:x1] = R
    return al


# 1. motion: mean absolute difference of the watched region between consecutive frames
num, den = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", a.clip],
                          capture_output=True, text=True, check=True).stdout.strip().split("/")
fps = round(int(num) / int(den), 3)
W, H = 96, 108
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.clip, "-vf", f"crop={a.head},scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
step = np.concatenate([[0], np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))])
A0, B0 = (int(v) for v in a.turn.split(":"))
noise = float(np.percentile(step[1:], 10))  # compression flicker and breathing
m = np.maximum(0, step - noise)
C = np.zeros(len(step))
C[A0] = float(np.abs(fr[A0] - fr[0]).mean())
for i in range(A0 + 1, B0 + 1):
    C[i] = C[i - 1] + m[i]
pick = []
for t in np.linspace(C[A0], C[B0], a.frames):
    i = A0 + int(np.argmin(np.abs(C[A0:B0 + 1] - t)))
    if not pick or i > pick[-1]:
        pick.append(i)
marks = {k: int(v) for k, v in (kv.split("=") for kv in a.marks.split(",") if kv)}
frames = sorted(set([0] + pick + list(marks.values())))
if a.max_gap > 0:
    # slow moments (a smile) get few motion-spaced picks; long gaps there crossfade like a dissolve, so fill them in
    filled = [frames[0]]
    for b in frames[1:]:
        gap = b - filled[-1]
        if gap > a.max_gap:
            steps = -(-gap // a.max_gap)
            filled += [filled[-1] + round(gap * s / steps) for s in range(1, steps)]
        filled.append(b)
    frames = sorted(set(filled))
pos = [round(float(C[i] / C[B0]), 4) for i in frames]
print(f"{len(frames)} frames at {fps} fps:", frames, flush=True)
if a.dry:
    raise SystemExit(0)
roi = None if a.lens == "none" else tuple(int(v) for v in a.lens.split(":"))

with tempfile.TemporaryDirectory() as work:
    # 2. extract the picked frames, in order
    sel = "+".join(f"eq(n\\,{i})" for i in frames)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.clip, "-vf", f"select='{sel}',crop={a.crop}", "-fps_mode", "passthrough",
                    "-start_number", "0", os.path.join(work, "f%02d.png")], check=True)
    n = len(frames)

    def vision(cmd, out, k):
        # Vision occasionally returns nothing on a busy machine; the same frame works on a second try
        for attempt in range(4):
            r = subprocess.run(cmd, capture_output=True, text=True)
            if os.path.exists(out):
                return r
            print(f"frame {k}: {os.path.basename(cmd[0])} gave no output (try {attempt + 1}) {r.stdout.strip()} {r.stderr.strip()[:200]}", flush=True)
        raise SystemExit(f"frame {k}: {cmd[0]} failed")

    # 3. cut-out per frame: subject mask (far lens repaired if asked), original pixels kept
    def cut(k):
        f = os.path.join(work, f"f{k:02d}.png")
        r = vision([a.lift, f, os.path.join(work, f"c{k:02d}")], os.path.join(work, f"c{k:02d}_all.png"), k)
        if "instances: 1" not in r.stdout:
            print("check frame", k, r.stdout.strip(), flush=True)
        src = np.asarray(Image.open(f).convert("RGB"))
        alpha = np.asarray(Image.open(os.path.join(work, f"c{k:02d}_all.png")).convert("RGBA"))[..., 3].astype(np.float32) / 255
        if roi:
            vision([a.segp, f, os.path.join(work, f"p{k:02d}.png")], os.path.join(work, f"p{k:02d}.png"), k)
            person = np.asarray(Image.open(os.path.join(work, f"p{k:02d}.png")).convert("L"))
            alpha = fix_lens(np.round(alpha * 255).astype(np.uint8), person, roi)
        return Image.fromarray(np.dstack([src, np.round(alpha * 255).astype(np.uint8)]), "RGBA")

    ims = [cut(k) for k in range(n)]
    print("cut out", n, "frames", flush=True)

    # 4. one crop shared by every frame
    x0, y0, x1, y1 = 10**9, 10**9, 0, 0
    for im in ims:
        ys, xs = np.nonzero(np.array(im)[:, :, 3] > 4)
        x0, y0, x1, y1 = min(x0, int(xs.min())), min(y0, int(ys.min())), max(x1, int(xs.max())), max(y1, int(ys.max()))
    pad = 8
    box = [max(0, x0 - pad), max(0, y0 - pad), min(ims[0].width, x1 + pad + 1), min(ims[0].height, y1 + 1)]
    bw, bh = box[2] - box[0], box[3] - box[1]
    bw -= bw % 2
    bh -= bh % 2
    box = (box[0], box[1], box[0] + bw, box[1] + bh)
    mh = a.phone_height
    mw = round(bw * mh / bh)
    mw -= mw % 2

    # 5. WebP in a folder named after the clip: the site caches images for a year, so a new clip must never reuse an
    #    old clip's addresses (browsers would mix the two). Earlier clips' folders are removed.
    # (named after the clip and the frame selection: the same clip picked differently must get a new address too)
    ver = hashlib.sha256(open(a.clip, "rb").read() + json.dumps([frames, a.crop, a.phone_height, a.lens]).encode()).hexdigest()[:8]
    os.makedirs(a.out, exist_ok=True)
    for entry in os.listdir(a.out):
        if entry != ver and os.path.isdir(os.path.join(a.out, entry)):
            shutil.rmtree(os.path.join(a.out, entry))
    out = os.path.join(a.out, ver)
    for sub in ("d", "m"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
        for f in os.listdir(os.path.join(out, sub)):
            os.remove(os.path.join(out, sub, f))
    jobs = []
    for k, im in enumerate(ims):
        c = im.crop(box)
        c.save(os.path.join(work, f"d{k:02d}.png"))
        c.convert("RGBa").resize((mw, mh), Image.LANCZOS).convert("RGBA").save(os.path.join(work, f"m{k:02d}.png"))
        jobs += [(os.path.join(work, f"{sub}{k:02d}.png"), os.path.join(out, sub, f"{k:02d}.webp")) for sub in ("d", "m")]
    enc = lambda j: subprocess.run(["cwebp", "-quiet", "-q", "80", "-m", "6", "-sharp_yuv", "-alpha_q", "100", j[0], "-o", j[1]], check=True)
    with ThreadPoolExecutor(4) as pool:
        list(pool.map(enc, jobs))

# 6. frame numbers, motion positions and marks for the site
json.dump({"count": n, "fps": fps, "frames": frames, "pos": pos, "marks": marks, "w": bw, "h": bh, "mw": mw, "mh": mh,
           "dir": f"{a.url.rstrip('/')}/{ver}"}, open(a.json, "w"), indent=2)
print(f"wrote {n} frames ({bw}×{bh}, phones {mw}×{mh}) and {a.json}")
