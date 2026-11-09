# Remove the Flow corner mark from a 1080p clip by un-blending it, then write the web film.
# The mark is a fixed semi-transparent white star. Its alpha was measured on dark-cornered clips by measure_mark.py
# (mark-alpha-1080.npy is the per-pixel minimum of the Malware and Baton measurements), so
#   shown = under * (1 - a) + 255 * a   =>   under = (shown - 255 * a) / (1 - a).
# The same alpha removes it from every Flow 1080p clip checked so far (k = 1). Compression smears the mark's outline,
# so a thin band along it is then filled from its neighbours (normalised convolution) instead of trusted.
#
# Usage: clean_film.py <in.mp4> <alpha.npy> <out.mp4> <checkdir> [k] [--size 960x540] [--crf 25] [--gop N]
#   --gop N puts a keyframe every N frames with no B-frames, for films the page scrubs with the scroll: a seek then
#   decodes at most N frames.
import argparse, subprocess, os
import numpy as np
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("alpha"); ap.add_argument("out"); ap.add_argument("check")
ap.add_argument("k", nargs="?", type=float, default=1.0)
ap.add_argument("--size", default="960x540")
ap.add_argument("--crf", type=int, default=25)
ap.add_argument("--gop", type=int, default=0)
args = ap.parse_args()
os.makedirs(args.check, exist_ok=True)
W, H, FPS = 1920, 1080, 24
X0, Y0, R = 1680, 840, 120
OW, OH = (int(v) for v in args.size.split("x"))
A = np.load(args.alpha).astype(np.float32)
grad = ndi.gaussian_gradient_magnitude(A, 1.0)
band = ndi.binary_dilation(grad > 0.12 * grad.max(), iterations=1)
SOFT = np.clip(ndi.gaussian_filter(band.astype(np.float32), 0.7) * 1.6, 0, 1)[..., None]
WGT = (~band).astype(np.float32)[..., None]
DEN = ndi.gaussian_filter(WGT, (1.8, 1.8, 0)) + 1e-6


def frames():
    vf = "scale=in_color_matrix=bt601:in_range=tv:out_range=pc,format=rgb24"
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", args.src, "-vf", vf, "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    while True:
        b = dec.stdout.read(W * H * 3)
        if len(b) < W * H * 3:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    dec.stdout.close()
    dec.wait()


def unblend(reg, k):
    a = (k * A)[..., None]
    return (reg - 255.0 * a) / (1.0 - a)


gop = ["-g", str(args.gop), "-keyint_min", str(args.gop), "-sc_threshold", "0", "-bf", "0"] if args.gop else []
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-vf", f"scale={OW}:{OH}:flags=lanczos:out_color_matrix=bt601:out_range=tv,format=yuv420p,"
                               "setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=smpte170m:range=tv",
                        "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf), "-profile:v", "high", "-pix_fmt", "yuv420p", *gop,
                        "-colorspace", "smpte170m", "-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-color_range", "tv",
                        "-movflags", "+faststart", args.out], stdin=subprocess.PIPE)
n = 0
for fr in frames():
    f = fr.astype(np.float32)
    reg = unblend(f[Y0:Y0 + R, X0:X0 + R], args.k)
    reg = reg * (1 - SOFT) + (ndi.gaussian_filter(reg * WGT, (1.8, 1.8, 0)) / DEN) * SOFT
    if n in (12, 72, 132, 186):
        before = fr[Y0 - 40:Y0 + R + 40, X0 - 40:X0 + R + 40]
        after = f.copy()
        after[Y0:Y0 + R, X0:X0 + R] = reg
        after = np.clip(after[Y0 - 40:Y0 + R + 40, X0 - 40:X0 + R + 40] + 0.5, 0, 255).astype(np.uint8)
        pair = np.concatenate([before, np.full((before.shape[0], 6, 3), 255, np.uint8), after], axis=1)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{pair.shape[1]}x{pair.shape[0]}", "-i", "-",
                        "-vf", "scale=iw*2:ih*2:flags=neighbor", os.path.join(args.check, f"corner_{n:03d}.png")], input=pair.tobytes())
    f[Y0:Y0 + R, X0:X0 + R] = reg
    enc.stdin.write(np.clip(f + 0.5, 0, 255).astype(np.uint8).tobytes())
    n += 1
enc.stdin.close()
enc.wait()
print("frames", n, flush=True)
