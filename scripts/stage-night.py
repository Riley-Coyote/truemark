"""Stand a real vial cut-out on the black stone plinth of the night studio.

The night mood is the house's second register: the proof, shown one lot at a time in a dark violet
room. The scene is a generated photograph of an empty plinth under a soft overhead beam
(design/scenes/night-plinth-empty.webp); the vial is the client's own render, cut out by
scripts/cut-vials.py, so its label and printed lot are exact. Label pixels are only ever scaled.
The scene supplies the rest: the beam's falloff down the glass, a tight contact shadow, a reflection
in the polished stone, a wrap of the room's violet at the edges, and one grain pass matched to the
scene.

    python3 scripts/cut-vials.py public/images/products /tmp/cutouts
    python3 scripts/stage-night.py /tmp/cutouts
Writes public/images/scenes/night-lot.webp and night-lot-sm.webp (the whole stage), and
night-lot-tile.webp and night-lot-tile-sm.webp (a portrait crop around the vial).
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SOURCE = os.path.join(REPO, "design", "scenes", "night-plinth-empty.webp")
OUT = os.path.join(REPO, "public", "images", "scenes")

# Cut-out geometry (578 x 1112), as in stage-vials.py.
BODY_W = 520.0
BODY_CX = 289.0
TOP_ROW = 63.0
BASE_ROW = 1079.0

# The plinth's top face, measured on the scene (5504 x 3072): centre, half-width, half-height.
# Its ratio (0.132) matches the renders' camera (the cap's ellipse is 0.137), so the vial stands on it.
PLINTH = (3740.0, 1991.0, 915.0, 121.0)
VIAL = "bpc-157-10-mg"     # the lot the home page's paper trail follows: TM-BPC10-2609-01
VIAL_W = 400.0             # body width in scene pixels
GRAIN_BOX = (400, 300, 900, 700)


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32) / 255.0


def resize_f(ch, size):
    return np.asarray(Image.fromarray(ch.astype(np.float32), "F").resize(size, Image.LANCZOS))


def load_vial(cutouts, name, vial_w):
    im = np.asarray(Image.open(os.path.join(cutouts, name + ".png")).convert("RGBA")).astype(np.float32) / 255.0
    a = im[..., 3]
    pm = im[..., :3] * a[..., None]
    s = vial_w / BODY_W
    size = (round(im.shape[1] * s), round(im.shape[0] * s))
    pm = np.stack([resize_f(pm[..., i], size) for i in range(3)], -1)
    a = np.clip(resize_f(a, size), 0, 1)
    return np.minimum(np.clip(pm, 0, 1), a[..., None]), a, s


def blit(dest, src, ox, oy):
    H, W = dest.shape[:2]
    h, w = src.shape[:2]
    ys0, xs0, ys1, xs1 = max(oy, 0), max(ox, 0), min(oy + h, H), min(ox + w, W)
    return (slice(ys0, ys1), slice(xs0, xs1)), (slice(ys0 - oy, ys1 - oy), slice(xs0 - ox, xs1 - ox))


def contact_shadow(shape, base, r):
    """Under an overhead beam the shadow pools tight around the base: a dark ring where glass meets
    stone, and a soft occlusion a little wider than the vial."""
    H, W = shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = base
    b = r * 0.137
    ring = np.sqrt(((xx - cx) / r) ** 2 + ((yy - cy) / b) ** 2)
    line = np.exp(-(((ring - 1.0) / 0.10) ** 2)) * (yy > cy - b * 0.2)
    occlusion = np.exp(-(((xx - cx) / (r * 1.25)) ** 2 + ((yy - cy) / (b * 2.1)) ** 2) ** 1.5)
    return np.clip(np.maximum(0.85 * gaussian_filter(line, 1.4), 0.62 * gaussian_filter(occlusion, r * 0.05)), 0, 1)


def grain_sigma(scene, box):
    x0, y0, x1, y1 = box
    patch = scene[y0:y1, x0:x1]
    blur = np.stack([gaussian_filter(patch[..., i], 2) for i in range(3)], -1)
    return float((patch - blur).std())


def stage(cutouts, seed=23):
    source = load_rgb(SOURCE)
    scene = source.copy()
    H, W, _ = scene.shape
    cx, cy, _, _ = PLINTH
    pm, al, s = load_vial(cutouts, VIAL, VIAL_W)
    r = VIAL_W / 2
    height = (BASE_ROW - TOP_ROW) * s
    base = (cx, cy)
    ox, oy = int(round(cx - BODY_CX * s)), int(round(cy - BASE_ROW * s))

    # The shadow first, so the vial stands in it.
    dens = contact_shadow((H, W), base, r)
    scene = scene * (1 - 0.88 * dens[..., None])

    # The room's violet, sampled from the open dark: what the glass's edges and shadows take on.
    room = source[300:900, 300:1600].reshape(-1, 3).mean(0)

    rgb = np.where(al[..., None] > 1e-4, pm / np.maximum(al[..., None], 1e-4), 0)
    h, w = al.shape
    rows = np.arange(h, dtype=np.float32)[:, None]
    cols = np.arange(w, dtype=np.float32)[None, :]
    # The beam comes from above: full light on the cap, falling off gently toward the base.
    t = np.clip((rows - TOP_ROW * s) / max(height, 1), 0, 1)
    beam = 1.0 - 0.22 * t ** 1.4
    # A cylinder turns away from the light at its sides.
    u = np.clip(np.abs(cols - BODY_CX * s) / (BODY_W * s / 2), 0, 1)
    side = 1.0 - 0.18 * u ** 3
    light = (beam * side)[..., None]
    # The room wraps the silhouette: the outer few pixels pick up its violet.
    inner = gaussian_filter(al, max(2.0, 6 * s))
    edge = np.clip(al - inner, 0, 1)[..., None] * 0.45
    rgb = rgb * light * 0.97
    rgb = rgb * (1 - edge) + room[None, None, :] * edge
    pm = rgb * al[..., None]

    # The reflection in the polished stone: the vial upside down from its base, fading fast.
    cut = int(round(BASE_ROW * s))
    ref_pm = pm[:cut][::-1]
    ref_al = al[:cut][::-1]
    fall = np.exp(-np.arange(ref_al.shape[0], dtype=np.float32) / (height * 0.12))[:, None]
    ref_al = gaussian_filter(ref_al * fall * 0.30, 2.6)
    ref_pm = np.stack([gaussian_filter(ref_pm[..., i] * fall * 0.30, 2.6) for i in range(3)], -1)
    (d, sr) = blit(scene, ref_al, ox, int(round(cy)))
    scene[d] = ref_pm[sr] + (1 - ref_al[sr][..., None]) * scene[d]

    # The vial, sharp: it is the subject in focus.
    vial_alpha = np.zeros((H, W), np.float32)
    (d, sr) = blit(scene, al, ox, oy)
    scene[d] = pm[sr] + (1 - al[sr][..., None]) * scene[d]
    vial_alpha[d] = al[sr]

    rng = np.random.default_rng(seed)
    sig = grain_sigma(source, GRAIN_BOX)
    grain = np.repeat(rng.normal(0, sig, (H, W, 1)), 3, -1) * 0.8 + rng.normal(0, sig * 0.35, (H, W, 3))
    scene = scene + grain.astype(np.float32) * vial_alpha[..., None]
    return np.clip(scene, 0, 1), (ox, oy, al.shape[1], al.shape[0])


def save(image, name, widths):
    for width, suffix in zip(widths, ("", "-sm")):
        out = image if width == image.width else image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
        out.save(os.path.join(OUT, f"{name}{suffix}.webp"), quality=86, method=6)


if __name__ == "__main__":
    scene, (vx, vy, vw, vh) = stage(sys.argv[1])
    image = Image.fromarray((scene * 255 + 0.5).astype(np.uint8))
    save(image, "night-lot", (2400, 1200))
    # The tile: a 4:5 portrait around the vial, its base a little below centre, the beam above it.
    cx = vx + vw / 2
    th = int(vh * 1.62)
    tw = int(th * 4 / 5)
    top = int(vy - vh * 0.38)
    tile = image.crop((int(cx - tw / 2), top, int(cx + tw / 2), top + th))
    save(tile, "night-lot-tile", (960, 480))
    print("wrote night-lot and night-lot-tile to", OUT)
