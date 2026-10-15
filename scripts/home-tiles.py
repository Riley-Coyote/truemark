"""The parts the home page's class cards stand their vials with.

Each card is a corner of the opening's room: its lilac wall, the window's light
falling across it, a pedestal, and the class's vial standing on it. The pedestal
is the one in the product-stage photograph (public/images/scenes/product-stage.webp),
cut from its wall along its own edges with the vial's contact shadow it carries,
so a card can set it at any size. The window's light is drawn here: four panes
and their mullions, slanted the way the photograph's light falls (from the upper
left), and softened as a frosted window softens it.

    python3 scripts/home-tiles.py
Writes public/images/scenes/pedestal.webp and pedestal-sm.webp, and src/brand/window-light.webp (beside home.css,
which draws it).
"""
import os

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SCENES = os.path.join(REPO, "public", "images", "scenes")
BRAND = os.path.join(REPO, "src", "brand")

# The pedestal in product-stage.webp (900 x 1125), measured on its edges: the body runs x 108.7..806.3, and its top
# is an ellipse centred on (457.5, 784) whose back edge is row 742.5 and front edge row 825.5. Its foot is the
# photograph's own lower edge.
LEFT, RIGHT = 108.7, 806.3
CX, CY = (LEFT + RIGHT) / 2, 784.0
RX, RY = (RIGHT - LEFT) / 2, 41.5
TOP = int(CY - RY) - 2
SS = 4  # supersampling for the edge


def pedestal() -> Image.Image:
    scene = Image.open(os.path.join(SCENES, "product-stage.webp")).convert("RGB")
    w, h = scene.size
    x0, x1 = int(LEFT) - 2, int(np.ceil(RIGHT)) + 2
    crop = scene.crop((x0, TOP, x1, h))
    cw, ch = crop.size
    ys, xs = np.mgrid[0 : ch * SS, 0 : cw * SS].astype(np.float64)
    px = x0 + (xs + 0.5) / SS
    py = TOP + (ys + 0.5) / SS
    top = ((px - CX) / RX) ** 2 + ((py - CY) / RY) ** 2 <= 1.0
    body = (px >= LEFT) & (px <= RIGHT) & (py >= CY)
    inside = (top | body).astype(np.float64)
    alpha = inside.reshape(ch, SS, cw, SS).mean(axis=(1, 3))
    rgba = np.dstack([np.asarray(crop, dtype=np.float64), alpha * 255.0])
    return Image.fromarray(np.clip(rgba + 0.5, 0, 255).astype(np.uint8), "RGBA")


def window_light(size: int = 640) -> Image.Image:
    """Four panes of light and the cross of their mullions, slanted down to the right, as frosted glass lets it fall."""
    n = size * 2
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float64) / n
    # Slant: the light comes from the upper left, so the window's image leans and lengthens across the wall.
    u = xs - 0.55 * (ys - 0.5)
    v = ys
    pane_w, pane_h, mullion = 0.2, 0.3, 0.035
    left = 0.5 - pane_w - mullion / 2
    top = 0.5 - pane_h - mullion / 2
    in_cols = ((u >= left) & (u < left + pane_w)) | ((u >= 0.5 + mullion / 2) & (u < 0.5 + mullion / 2 + pane_w))
    in_rows = ((v >= top) & (v < top + pane_h)) | ((v >= 0.5 + mullion / 2) & (v < 0.5 + mullion / 2 + pane_h))
    light = (in_cols & in_rows).astype(np.float64)
    light = gaussian_filter(light, sigma=n * 0.014)
    # Brightest where the light lands nearest the window, fading along its fall.
    fall = np.clip(1.15 - 0.55 * ys - 0.25 * xs, 0, 1)
    light *= fall
    small = Image.fromarray((light * 255).astype(np.uint8), "L").resize((size, size), Image.LANCZOS)
    alpha = np.asarray(small, dtype=np.float64) * 0.9
    rgba = np.dstack([np.full((size, size, 3), (253, 252, 255), dtype=np.float64), alpha])
    return Image.fromarray(np.clip(rgba + 0.5, 0, 255).astype(np.uint8), "RGBA")


def main() -> None:
    cut = pedestal()
    cut.save(os.path.join(SCENES, "pedestal.webp"), quality=88, method=6)
    half = cut.resize((cut.width // 2, cut.height // 2), Image.LANCZOS)
    half.save(os.path.join(SCENES, "pedestal-sm.webp"), quality=88, method=6)
    window_light().save(os.path.join(BRAND, "window-light.webp"), quality=86, method=6)
    for path in (os.path.join(SCENES, "pedestal.webp"), os.path.join(SCENES, "pedestal-sm.webp"), os.path.join(BRAND, "window-light.webp")):
        name = os.path.basename(path)
        with Image.open(path) as im:
            print(name, im.size, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
