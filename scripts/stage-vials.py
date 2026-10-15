"""Stand the real vial cut-outs on the empty pedestal scenes in design/scenes.

The scenes are generated photographs with nothing on them; every vial is the
client's own render, cut out by scripts/cut-vials.py. Label pixels are only ever
scaled: the vial is composited as-is (premultiplied), the scene takes the
shadows, and one grain pass matched to the scene knits the two together.

Run after cut-vials.py whenever the renders or labels change:
    python3 scripts/cut-vials.py public/images/products /tmp/cutouts
    python3 scripts/stage-vials.py /tmp/cutouts
Writes public/images/scenes/<name>.webp and <name>-sm.webp.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SOURCE = os.path.join(REPO, "design", "scenes")
OUT = os.path.join(REPO, "public", "images", "scenes")

# Cut-out geometry (578 x 1112): the body spans x 29..549 around x 289, and the
# base ellipse is centred on row 1079 (its front edge, the lowest glass, is row 1109).
BODY_W = 520.0
BODY_CX = 289.0
BASE_ROW = 1079.0

# Each pedestal's top face, measured on the scene: (centre x, centre y, half-width, half-height).
SCENES = {
    "collection": {
        "source": "pedestals-five.webp",
        "vial_frac": 0.46,
        "grain_box": (2200, 100, 2600, 400),
        "widths": (2400, 1200),
        "vials": [
            ("nad-plus-500-mg", (469.5, 987, 169.5, 26)),
            ("ghk-cu-100-mg", (890, 832, 177.75, 24)),
            ("retatrutide-10-mg", (1324.5, 742.5, 192, 23.5)),
            ("tesamorelin-10-mg", (1761, 863, 172.5, 25.5)),
            ("bpc-157-10-mg", (2185, 1056, 176, 28)),
        ],
    },
    # The product page's plinth: shadow only, since the page layers the vial itself
    # (it changes with the size chosen). Cropped to the stage's 4:5 frame.
    "product-stage": {
        "source": "pedestal-center.webp",
        "vial_frac": 0.46,
        "shadow_only": True,
        "crop": (565, 150, 1465, 1275),
        "widths": (900, 600),
        "vials": [(None, (1015, 934.5, 340, 44.5))],
    },
    "trio": {
        "source": "pedestals-trio.webp",
        "vial_frac": 0.44,
        "grain_box": (1500, 150, 1900, 400),
        "widths": (2400, 1200),
        "vials": [
            ("bpc-157-10-mg", (736, 864, 236, 36)),
            ("retatrutide-10-mg", (1332, 564.5, 257.5, 26.5)),
            ("ghk-cu-100-mg", (1935, 702, 245, 33)),
        ],
    },
}


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


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def top_shadow(shape, ped, r, light_deg=-12.0, cast=0.55, ao=0.6, reach=2.4):
    """Shadow density on a pedestal's top face, drawn top-down and foreshortened into the image."""
    H, W = shape
    cx, cy, a, b = ped
    k = b / a
    x0, x1 = int(cx - a - 4), int(cx + a + 4)
    y0, y1 = int(cy - b - 4), int(cy + b + 4)
    px = np.arange(x0, x1)[None, :].astype(np.float32) - cx
    py = (np.arange(y0, y1)[:, None].astype(np.float32) - cy) / k
    dist = np.sqrt(px ** 2 + py ** 2)
    # Occlusion: shade under the glass, a tight dark line where glass meets the
    # surface, and a soft halo around it.
    d_out = np.maximum(dist - r, 0)
    under = 0.55 * (1 - smoothstep(0.80 * r, 0.95 * r, dist))
    line = np.exp(-((d_out / (0.07 * r)) ** 2)) * smoothstep(0.85 * r, 0.97 * r, dist)
    halo = 0.5 * np.exp(-((d_out / (0.5 * r)) ** 2)) * smoothstep(0.8 * r, 1.0 * r, dist)
    ao_d = np.maximum.reduce([under, line * 0.95, halo])
    # Cast shadow: the scenes are lit from the left and a touch in front, so it
    # runs right and slightly back, widening and softening as it goes.
    th = np.deg2rad(light_deg)
    u = px * np.cos(th) + py * np.sin(th)
    v = -px * np.sin(th) + py * np.cos(th)
    half = r * (1.0 + np.maximum(u, 0) / r * 0.10)
    soft = 0.22 * r + np.maximum(u, 0) * 0.30
    across = 1.0 / (1.0 + np.exp(-(half - np.abs(v)) / soft))
    along = np.exp(-np.maximum(u, 0) / (reach * r)) * smoothstep(-0.2 * r, 0.3 * r, u)
    dens = np.clip(ao * ao_d + cast * across * along, 0, 1)
    dens *= 1 - smoothstep(a - 10, a + 1, dist)  # only on the top face
    full = np.zeros(shape, np.float32)
    yy0, xx0 = max(y0, 0), max(x0, 0)
    full[yy0:y1, xx0:x1] = dens[yy0 - y0:, xx0 - x0:]
    return full


def shade_colour(scene, ped):
    """The pedestal's shaded side over its lit top: the hue a shadow takes here."""
    cx, cy, a, b = ped
    top = scene[int(cy - b * 0.4):int(cy + b * 0.4), int(cx - a * 0.3):int(cx + a * 0.3)].reshape(-1, 3).mean(0)
    side = scene[int(cy + b + 40):int(cy + b + 120), int(cx + a * 0.55):int(cx + a * 0.85)].reshape(-1, 3).mean(0)
    return np.clip(side / np.maximum(top, 1e-3), 0.4, 1.0)


def grain_sigma(scene, box):
    x0, y0, x1, y1 = box
    patch = scene[y0:y1, x0:x1]
    blur = np.stack([gaussian_filter(patch[..., i], 2) for i in range(3)], -1)
    return float((patch - blur).std())


def stage(cutouts, spec, soften=0.45, depth=2.4, seed=7):
    source = load_rgb(os.path.join(SOURCE, spec["source"]))
    scene = source.copy()
    H, W, _ = scene.shape
    peds = [ped for _, ped in spec["vials"]]
    vial_w = spec["vial_frac"] * 2 * np.mean([ped[2] for ped in peds])
    r = vial_w / 2
    for ped in peds:
        dens = top_shadow((H, W), ped, r)
        scene = scene * np.power(shade_colour(scene, ped)[None, None, :], dens[..., None] * depth)
    if spec.get("shadow_only"):
        return crop(spec, scene, vial_w)
    vial_alpha = np.zeros((H, W), np.float32)
    # back to front, so nearer pedestals overlap farther vials
    for name, (cx, cy, a, b) in sorted(spec["vials"], key=lambda v: v[1][1] + v[1][3]):
        pm, al, s = load_vial(cutouts, name, vial_w)
        pm = np.stack([gaussian_filter(pm[..., i], soften) for i in range(3)], -1)
        al = gaussian_filter(al, soften)
        ox, oy = int(round(cx - BODY_CX * s)), int(round(cy - BASE_ROW * s))
        h, w = al.shape
        ys0, xs0, ys1, xs1 = max(oy, 0), max(ox, 0), min(oy + h, H), min(ox + w, W)
        sub_al = al[ys0 - oy:ys1 - oy, xs0 - ox:xs1 - ox]
        sub_pm = pm[ys0 - oy:ys1 - oy, xs0 - ox:xs1 - ox]
        scene[ys0:ys1, xs0:xs1] = sub_pm + (1 - sub_al[..., None]) * scene[ys0:ys1, xs0:xs1]
        vial_alpha[ys0:ys1, xs0:xs1] = np.maximum(vial_alpha[ys0:ys1, xs0:xs1], sub_al)
    rng = np.random.default_rng(seed)
    sig = grain_sigma(source, spec["grain_box"])
    grain = np.repeat(rng.normal(0, sig, (H, W, 1)), 3, -1) * 0.8 + rng.normal(0, sig * 0.35, (H, W, 3))
    scene = scene + grain.astype(np.float32) * vial_alpha[..., None]
    return crop(spec, scene, vial_w)


def crop(spec, scene, vial_w):
    """Crop to the published frame; for a shadow-only stage, report where the page should stand the vial."""
    image = Image.fromarray((np.clip(scene, 0, 1) * 255 + 0.5).astype(np.uint8))
    if "crop" not in spec:
        return image
    x0, y0, x1, y1 = spec["crop"]
    if spec.get("shadow_only"):
        cx, cy = spec["vials"][0][1][:2]
        s = vial_w / BODY_W
        w, h = 578 * s, 1112 * s
        print(f"  stand the vial at left {100 * (cx - BODY_CX * s - x0) / (x1 - x0):.2f}%, "
              f"top {100 * (cy - BASE_ROW * s - y0) / (y1 - y0):.2f}%, width {100 * w / (x1 - x0):.2f}% "
              f"(height {100 * h / (y1 - y0):.2f}%)")
    return image.crop(spec["crop"])


if __name__ == "__main__":
    cutouts = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for name, spec in SCENES.items():
        image = stage(cutouts, spec)
        for i, width in enumerate(spec["widths"]):
            height = round(image.height * width / image.width)
            path = os.path.join(OUT, f"{name}{'' if i == 0 else '-sm'}.webp")
            image.resize((width, height), Image.LANCZOS).save(path, "WEBP", quality=82, method=5)
            print(path, (width, height))
