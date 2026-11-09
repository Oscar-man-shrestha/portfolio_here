# Measure the Flow corner mark's alpha at 1080p from a clip whose corner is dark: per-pixel minimum over time is
# (almost) background-free, so alpha = (min - bg) / (255 - bg) with bg taken from the ring around the mark.
import subprocess, sys
import numpy as np
from scipy import ndimage as ndi
V, OUT = sys.argv[1:3]
W, H = 1920, 1080
X0, Y0, R = 1680, 840, 120
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", V, "-vf", f"crop={R}:{R}:{X0}:{Y0},scale=in_color_matrix=bt601:in_range=tv:out_range=pc,format=rgb24", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
frames = []
while True:
    b = dec.stdout.read(R * R * 3)
    if len(b) < R * R * 3: break
    frames.append(np.frombuffer(b, np.uint8).reshape(R, R, 3).astype(np.float32))
dec.wait()
st = np.stack(frames)
mn = np.percentile(st, 3, axis=0)
g = mn.mean(axis=2)
# rough mark support, then background from outside it
sup = ndi.binary_dilation(g > np.median(g) + 12, iterations=6)
bg = np.median(mn[~sup], axis=0)
a = np.clip((mn - bg) / (255 - bg), 0, 1).mean(axis=2)
a[~sup] = 0
print("frames", len(frames), "bg", bg.round(1), "alpha max", a.max().round(3), "support px", int(sup.sum()))
ys, xs = np.nonzero(a > 0.05)
print("mark box x", X0 + xs.min(), X0 + xs.max(), "y", Y0 + ys.min(), Y0 + ys.max())
np.save(OUT, a)
