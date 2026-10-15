"""Cut the supplied vial renders out of their studio backdrop.
All twenty renders share one camera, so one silhouette fits every vial; the clear
glass bands get partial alpha so whatever sits behind shows through the glass.
The label, cap and powder stay fully opaque and untouched."""
import glob, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
files = sorted(glob.glob(os.path.join(SRC, '*.png')))

def backdrop(im):
    H, W, _ = im.shape
    xs = np.arange(W) / (W - 1)
    L = im[:, :int(W * 0.08)].mean(axis=1)
    R = im[:, int(W * 0.92):].mean(axis=1)
    return L[:, None, :] * (1 - xs[None, :, None]) + R[:, None, :] * xs[None, :, None]

imgs, diffs, bgs = [], [], []
for f in files:
    im = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    bg = backdrop(im)
    imgs.append(im); bgs.append(bg); diffs.append(np.abs(im - bg).max(axis=2))
H, W = diffs[0].shape

# One shared silhouette: the median difference across all renders is high only
# where the vial is (backdrops vary a little from render to render; the vial doesn't).
union = np.median(np.stack(diffs), axis=0) > 9
roi = np.zeros_like(union)
roi[85:1212, 330:925] = True
union &= roi
union = ndimage.binary_closing(union, structure=np.ones((9, 9)), iterations=2)
union = ndimage.binary_fill_holes(union)
union = ndimage.binary_opening(union, structure=np.ones((5, 5)))
# Keep the largest component (the vial) and trim floor shadow wider than the body.
lab, n = ndimage.label(union)
sizes = ndimage.sum(union, lab, range(1, n + 1))
union = lab == (int(np.argmax(sizes)) + 1)
body = union[640:900]
cols = np.where(body.any(axis=0))[0]
left, right = cols.min() - 2, cols.max() + 2
union[1000:, :left] = False
union[1000:, right:] = False
# The cap's top face. Seen from a little above, the white cap's top is an ellipse
# nearly the colour of the backdrop, so the difference test above keeps only two
# specks of it and the cap reads as sliced flat. Its outline, traced on the median
# of the renders (161 columns, rms 0.8 px), is the ellipse centred on (623.0, 97.9)
# with half-axes 246.0 x 33.7; its ends meet the cap's sides (x 377 and 869).
yy, xx = np.mgrid[0:H, 0:W]
union |= ((xx - 623.0) / 246.0) ** 2 + ((yy - 97.9) / 33.7) ** 2 <= 1
# Pull the edge in slightly so no backdrop survives as a rim, then feather it.
union = ndimage.binary_erosion(union, structure=np.ones((3, 3)), iterations=2)
sil = ndimage.gaussian_filter(union.astype(np.float32), 1.0)

def ramp(y, a, b, c, d):
    """0 below a, rising to 1 by b, 1 until c, falling to 0 by d."""
    y = y.astype(np.float32)
    up = np.clip((y - a) / max(b - a, 1), 0, 1)
    down = np.clip((d - y) / max(d - c, 1), 0, 1)
    return np.minimum(up, down)

rows = np.arange(H)
# How much each row behaves like clear glass: the neck and shoulder between the
# crimp and the label, and the thick base below the powder. Soft edges, no seams.
glass_w = np.maximum(ramp(rows, 318, 352, 559, 567), ramp(rows, 1070, 1102, 1240, 1250))[:, None]
# End the glass where the glass ends. The shared camera sits a little above the
# vial, so the base's outline is a rounded arc: measured on the renders, it leaves
# the straight side at row 1092 (half-width 256) and bottoms out at row 1172 on the
# vial's axis. A superellipse fits both the corners and the bottom. Everything
# below it is the render's floor, which each page replaces with its own.
axis = (left + right) / 2
SS = 4  # supersampled, so the edge is antialiased rather than stepped
band = slice(1080, 1190)
sy = (np.arange(band.start * SS, band.stop * SS) + 0.5) / SS
sx = (np.arange(W * SS) + 0.5) / SS
ey = (np.clip((sy - 1092) / 80.0, 0, None) ** 2.8)[:, None].astype(np.float32)
ex = ((np.abs(sx - axis) / 256.0) ** 2.8)[None, :].astype(np.float32)
inside = ((ex + ey) <= 1) | (sy < 1092)[:, None]
base_fade = np.ones((H, W), np.float32)
base_fade[band] = inside.reshape(band.stop - band.start, SS, W, SS).mean(axis=(1, 3))
base_fade[band.stop:] = 0

x0, x1 = max(0, left - 24), min(W, right + 24)
top = int(np.where(union.any(axis=1))[0].min()) - 4
bottom = 1172 + 3
print('silhouette cols', left, right, 'axis', axis, 'rows', top, bottom)

for f, im, bg, d in zip(files, imgs, bgs, diffs):
    ga = np.clip(0.18 + d / 80.0, 0.18, 1.0)
    a = sil * (glass_w * ga + (1 - glass_w)) * base_fade
    a3 = np.clip(a, 1e-3, 1)[..., None]
    unmixed = (im - (1 - a3) * bg) / a3
    col = glass_w[..., None] * unmixed + (1 - glass_w[..., None]) * im
    col = np.clip(col, 0, 255)
    rgba = np.dstack([col, a * 255]).astype(np.uint8)[top:bottom, x0:x1]
    name = os.path.splitext(os.path.basename(f))[0]
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, name + '.png'))
print('done', len(files), 'size', (x1 - x0, bottom - top))
