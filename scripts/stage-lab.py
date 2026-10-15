"""Stand real vial cut-outs on the bench in the lab scene (the About page's opening).

The scene is a generated photograph of an empty bench (design/scenes/lab-empty.webp); every
vial is the client's own render, cut out by scripts/cut-vials.py, so every label is exact. Label
pixels are only ever scaled and softened to the scene's focus. The scene supplies the rest: a
contact shadow, a long soft shadow away from the window, a faint reflection in the glossy top,
the room's lilac light, and one grain pass matched to the scene that knits them together.

    python3 scripts/cut-vials.py public/images/products /tmp/cutouts
    python3 scripts/stage-lab.py /tmp/cutouts
Writes public/images/scenes/lab-bench.webp and lab-bench-sm.webp.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SOURCE = os.path.join(REPO, "design", "scenes", "lab-empty.webp")
OUT = os.path.join(REPO, "public", "images", "scenes")

# Cut-out geometry (578 x 1112), as in stage-vials.py: the body spans x 29..549 around x 289, the
# cap's top is row 63 and the base ellipse is centred on row 1079.
BODY_W = 520.0
BODY_CX = 289.0
TOP_ROW = 63.0
BASE_ROW = 1079.0

# Each vial: its render, where the centre of its base stands on the bench, its body width, and how
# far it sits from the plane of focus (0 sharp; more is softer). Drawn back to front.
VIALS = [
    ("tesamorelin-10-mg", (1012, 694), 150, 0.9),
    ("semax-10-mg", (1336, 688), 146, 0.9),
    ("retatrutide-10-mg", (1176, 742), 172, 0.55),
]
# The window is behind and to the left: shadows run right and a little toward the camera.
LIGHT = np.array([1.0, 0.16])
GRAIN_BOX = (1500, 1000, 1900, 1250)


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
    pm = np.minimum(np.clip(pm, 0, 1), a[..., None])
    return pm, a, s


def blit(dest, src, ox, oy):
    """The window of `dest` that `src` covers at (ox, oy), and the matching part of `src`."""
    H, W = dest.shape[:2]
    h, w = src.shape[:2]
    ys0, xs0, ys1, xs1 = max(oy, 0), max(ox, 0), min(oy + h, H), min(ox + w, W)
    return (slice(ys0, ys1), slice(xs0, xs1)), (slice(ys0 - oy, ys1 - oy), slice(xs0 - ox, xs1 - ox))


def bench_shadow(shape, base, r, height):
    """Shadow density on the bench: a tight contact shadow and a long soft one away from the window."""
    H, W = shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = base
    # The base is an ellipse seen from low down: wide and shallow.
    b = r * 0.11
    ring = np.sqrt(((xx - cx) / r) ** 2 + ((yy - cy) / b) ** 2)
    contact = np.exp(-(((xx - cx) / (r * 1.04)) ** 2 + ((yy - cy) / (b * 1.5)) ** 2) ** 2)
    # Where the glass meets the bench, a fine dark line along the base's near edge.
    line = np.exp(-(((ring - 1.0) / 0.12) ** 2)) * (yy > cy - b * 0.2)
    # The long shadow: an ellipse stretched along the light, starting at the base, fading as it goes.
    d = LIGHT / np.linalg.norm(LIGHT)
    u = (xx - cx) * d[0] + (yy - cy) * d[1]
    v = -(xx - cx) * d[1] + (yy - cy) * d[0]
    reach = height * 1.25
    along = np.exp(-np.maximum(u, 0) / reach) * (u > -r * 0.3)
    across = np.exp(-((v / (b * 1.6 + np.maximum(u, 0) * 0.07)) ** 2))
    cast = gaussian_filter(along * across, r * 0.18)
    return np.clip(np.maximum(0.7 * contact, 0.6 * gaussian_filter(line, 1.2)) + 0.32 * cast, 0, 1)


def grain_sigma(scene, box):
    x0, y0, x1, y1 = box
    patch = scene[y0:y1, x0:x1]
    blur = np.stack([gaussian_filter(patch[..., i], 2) for i in range(3)], -1)
    return float((patch - blur).std())


def stage(cutouts, seed=11):
    source = load_rgb(SOURCE)
    scene = source.copy()
    H, W, _ = scene.shape
    # The room's light, sampled from the open bench: the cast every vial takes on.
    room = source[900:1100, 300:2100].reshape(-1, 3).mean(0)
    tint = room / room.max()
    # The colour a shadow takes on this bench: a near-neutral grey with only a breath of the room's
    # light; a saturated one reads as a glow, not a shadow.
    shade = np.clip(0.8 * np.array([0.78, 0.775, 0.79]) + 0.2 * tint * 0.78, 0.5, 1.0)

    vial_alpha = np.zeros((H, W), np.float32)
    for name, base, vial_w, focus in VIALS:
        pm, al, s = load_vial(cutouts, name, vial_w)
        r = vial_w / 2
        height = (BASE_ROW - TOP_ROW) * s
        ox, oy = int(round(base[0] - BODY_CX * s)), int(round(base[1] - BASE_ROW * s))

        # Shadows first, so the vial stands in them.
        dens = bench_shadow((H, W), base, r, height)
        scene = scene * np.power(shade[None, None, :], dens[..., None] * 1.6)

        # The room's light on the glass and label: a lilac cast and the scene's airy lift.
        rgb = np.where(al[..., None] > 1e-4, pm / np.maximum(al[..., None], 1e-4), 0)
        rgb = rgb * (0.72 + 0.28 * tint[None, None, :])
        rgb = rgb * 0.93 + 0.07 * tint[None, None, :]
        pm = rgb * al[..., None]

        # A faint reflection in the glossy top: the vial upside down from its base, fading fast.
        cut = int(round(BASE_ROW * s))
        ref_pm = pm[:cut][::-1]
        ref_al = al[:cut][::-1]
        fall = np.exp(-np.arange(ref_al.shape[0], dtype=np.float32) / (height * 0.16))[:, None]
        ref_al = gaussian_filter(ref_al * fall * 0.22, 2.2)
        ref_pm = np.stack([gaussian_filter(ref_pm[..., i] * fall * 0.22, 2.2) for i in range(3)], -1)
        (d, sr) = blit(scene, ref_al, ox, int(round(base[1])))
        scene[d] = ref_pm[sr] + (1 - ref_al[sr][..., None]) * scene[d]

        # The vial, softened to its distance from the plane of focus.
        pm = np.stack([gaussian_filter(pm[..., i], focus) for i in range(3)], -1)
        al = gaussian_filter(al, focus)
        (d, sr) = blit(scene, al, ox, oy)
        scene[d] = pm[sr] + (1 - al[sr][..., None]) * scene[d]
        vial_alpha[d] = np.maximum(vial_alpha[d], al[sr])

    rng = np.random.default_rng(seed)
    sig = grain_sigma(source, GRAIN_BOX)
    grain = np.repeat(rng.normal(0, sig, (H, W, 1)), 3, -1) * 0.8 + rng.normal(0, sig * 0.35, (H, W, 3))
    scene = scene + grain.astype(np.float32) * vial_alpha[..., None]
    return np.clip(scene, 0, 1)


def save(scene, name, widths=(2400, 1200)):
    im = Image.fromarray((scene * 255 + 0.5).astype(np.uint8))
    for width, suffix in zip(widths, ("", "-sm")):
        out = im if width == im.width else im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        out.save(os.path.join(OUT, f"{name}{suffix}.webp"), quality=86, method=6)


if __name__ == "__main__":
    save(stage(sys.argv[1]), "lab-bench")
    print("wrote", os.path.join(OUT, "lab-bench.webp"))
