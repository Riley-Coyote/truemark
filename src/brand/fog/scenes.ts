/*
 * The rooms the floor mist lies in: each room's camera and pedestals, measured on the room's first frame, and the
 * world the mist is simulated in, derived from them.
 *
 * The camera stands one unit above the floor (every distance is in camera heights) and looks level along +z, through
 * the room's horizontal middle. A floor point at depth z shows on the row `horizon + focal / z`.
 */

/** The highest the mist reaches, in camera heights above the floor. */
export const SLAB = 0.42;

/**
 * A pedestal on a room's first frame, in the room's own pixels: the middle and half-width of its silhouette, the row
 * where the front of its base meets the floor (where its side has gone into the room's own mist), and the row of the
 * front rim of its top.
 */
export type FogPedestal = { x: number; half: number; base: number; top: number };

/** A room: its frame, its horizon (the floor's vanishing row), its focal length, the row where the floor meets the
 *  back wall, its pedestals, and its light: one overhead, straight down on a pedestal, its pool on the floor reaching
 *  about `reach` camera heights from that pedestal's middle (where the floor's light has fallen to about a third). */
export type FogScene = {
  room: { w: number; h: number };
  horizon: number;
  focal: number;
  wall: number;
  pedestals: readonly FogPedestal[];
  light: { pedestal: number; reach: number };
};

/**
 * The rooms, measured on each one's first frame (tools/landing/r4/fog-port/calib): each pedestal's sides are its
 * silhouette's steepest steps, its top's rim is an ellipse fitted to the rim's traced edge (within a pixel), and its
 * base is where its side has gone into the room's mist.
 */
export const FOG_SCENES = {
  /** open-misty.mp4, 2560×1430: five pedestals. The camera is the study's (approved) estimate: the generated room's
   *  tops don't agree on one exact camera, and this one sits within their spread. */
  collection: {
    room: { w: 2560, h: 1430 },
    horizon: 515,
    focal: 3200,
    wall: 1075,
    pedestals: [
      { x: 626.5, half: 135, base: 1203, top: 1024.3 },
      { x: 944.5, half: 138, base: 1195, top: 930.3 },
      { x: 1275.5, half: 147, base: 1203, top: 860.7 },
      { x: 1610.5, half: 138, base: 1200, top: 946.8 },
      { x: 1936, half: 136.5, base: 1217, top: 1049.4 },
    ],
    /** open-crisp.jpg: the floor is as bright between the middle pedestals as before the centre one, and a third as
     *  bright left of the first. */
    light: { pedestal: 2, reach: 1.3 },
  },
  /** open-phone-misty.mp4, 1080×1934: the middle three, more floor below. The camera is fitted to the three tops'
   *  ellipses (each top's row against its depth: within 3 px), the bases read as the wide room's are, and the wall
   *  stands just behind the pedestals, where the floor's shade line runs. */
  collectionTall: {
    room: { w: 1080, h: 1934 },
    horizon: 812,
    focal: 3230,
    wall: 1395,
    pedestals: [
      { x: 180.5, half: 148, base: 1455, top: 1182.5 },
      { x: 536, half: 157.5, base: 1466, top: 1108.2 },
      { x: 895.5, half: 148, base: 1465, top: 1200.3 },
    ],
    /** open-phone-crisp.jpg: bright at the bases, a third as bright about a camera height nearer. */
    light: { pedestal: 1, reach: 1.15 },
  },
} as const satisfies Record<string, FogScene>;

/** The highest row of a room (a fraction of its height) that any mist can reach: the canvas's top goes here. */
export function fogTop(scene: FogScene): number {
  const zWall = scene.focal / (scene.wall - scene.horizon);
  return Math.max(0, (scene.horizon + ((1 - SLAB) * scene.focal) / zWall) / scene.room.h - 0.02);
}

/** A pedestal in the world: the middle of its footprint (x, z), its radius and its height. */
export type Solid = { x: number; z: number; r: number; h: number };

/** The room's camera and pedestals in world units, and the floor's air grid. */
export type Geometry = {
  zWall: number;
  zNear: number;
  peds: Solid[];
  pedUniform: Float32Array;
  xMin: number;
  xSize: number;
  zMin: number;
  zSize: number;
  nx: number;
  nz: number;
  cell: number;
  iterations: number;
  /** The light's pool on the floor: its middle (x, z) and its reach. */
  spot: [number, number, number];
};

/**
 * The lens's focus on one pedestal (Rooms.tsx RoomFocus): how far its blur reaches, in the room's own pixels. The
 * sharp region is the pedestal's silhouette as the room's camera sees it (the derived cylinder: its back rim, its
 * sides, the front of its base); just outside it a margin of a little more than the blur's own reach stays sharp, so
 * the pedestal's colour never bleeds into the blurred room as a glow; then the blur comes in over a long feather.
 * Below the base, the floor nearer the camera softens sooner than the wall behind, as it does through a lens.
 */
export const FOCUS = { blur: 6.5, margin: 13, feather: 230, floorBias: 1.6 } as const;

const masks = new Map<string, string>();

/** The pedestal's silhouette rows on the room's frame: its top's ellipse (back rim to front rim) and its base's. */
function silhouette(scene: FogScene, index: number) {
  const p = scene.pedestals[index];
  const solid = deriveScene(scene, true).peds[index];
  const backTop = scene.horizon + (scene.focal * (1 - solid.h)) / (solid.z + solid.r);
  const backBase = scene.horizon + scene.focal / (solid.z + solid.r);
  return {
    x: p.x,
    half: p.half,
    top: { cy: (p.top + backTop) / 2, ry: Math.max(4, (p.top - backTop) / 2) },
    base: { cy: (p.base + backBase) / 2, ry: Math.max(4, (p.base - backBase) / 2) },
  };
}

/** The measured photographic outline, shared with Procession's close pedestal
 * crops. This keeps the original room pixels and contact plane unchanged. */
export function pedestalCrop(scene: FogScene, index: number) {
  const shape = silhouette(scene, index);
  return {
    x: shape.x, half: shape.half,
    backTop: shape.top.cy - shape.top.ry,
    frontTop: shape.top.cy + shape.top.ry,
    rimRadius: shape.top.ry,
    base: scene.pedestals[index].base,
  };
}

/** The distance (room px) from a point to the silhouette's outline: negative inside. */
function outside(s: ReturnType<typeof silhouette>, X: number, Y: number) {
  const dx = X - s.x;
  if (Y >= s.top.cy && Y <= s.base.cy) return Math.abs(dx) - s.half;
  const e = Y < s.top.cy ? s.top : s.base;
  const dy = Y - e.cy;
  const u = dx / s.half, v = dy / e.ry;
  const rho = Math.hypot(u, v);
  if (rho < 1e-6) return -Math.min(s.half, e.ry);
  // First-order distance to the ellipse: (rho - 1) over the gradient of rho.
  const grad = Math.hypot(dx / (s.half * s.half), dy / (e.ry * e.ry)) / rho;
  return (rho - 1) / grad;
}

/**
 * The focus mask for one pedestal, as an image the size of the room's frame (a data URL, made once): transparent
 * where the lens is sharp, opaque where the room is fully soft. Smooth everywhere, so it is drawn at a quarter of the
 * room's resolution.
 */
export function focusMask(scene: FogScene, index: number): string | null {
  // No document to draw it in (a test render), or no such pedestal: no focus.
  if (typeof document === "undefined" || typeof document.createElement !== "function" || !scene.pedestals[index]) return null;
  const key = `${scene.room.w}x${scene.room.h}:${index}`;
  const made = masks.get(key);
  if (made) return made;
  const step = 4;
  const w = Math.ceil(scene.room.w / step), h = Math.ceil(scene.room.h / step);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
  if (!ctx) return null;
  const image = ctx.createImageData(w, h);
  const s = silhouette(scene, index);
  for (let y = 0; y < h; y++) {
    const Y = (y + 0.5) * step;
    // The floor in front of the pedestal's base is nearer the camera than the pedestal: it softens sooner.
    const nearer = Y > s.base.cy ? 1 + (FOCUS.floorBias - 1) * Math.min(1, (Y - s.base.cy) / (s.base.ry * 6)) : 1;
    for (let x = 0; x < w; x++) {
      const d = outside(s, (x + 0.5) * step, Y) * nearer;
      const t = Math.min(1, Math.max(0, (d - FOCUS.margin) / FOCUS.feather));
      // Smootherstep: no visible start or end to the feather.
      const a = t * t * t * (t * (t * 6 - 15) + 10);
      image.data[(y * w + x) * 4 + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  const url = `url("${canvas.toDataURL("image/png")}")`;
  masks.set(key, url);
  return url;
}

/** The most pedestals the mist's shader takes. */
export const MAX_PEDESTALS = 6;

/**
 * The world from a room's measurements. Each pedestal is the cylinder whose silhouette, as the camera sees it, has
 * exactly the measured sides (the tangent rays from the camera: off-centre pedestals look wider than r/z suggests),
 * whose base's front meets the floor on the measured row, and whose top's front rim stands on the measured row.
 */
export function deriveScene(scene: FogScene, low: boolean): Geometry {
  const { room, horizon, focal, wall } = scene;
  const cx = room.w / 2;
  const zWall = focal / (wall - horizon);
  const peds = scene.pedestals.map((p): Solid => {
    const zFront = focal / (p.base - horizon);
    const left = Math.atan((p.x - p.half - cx) / focal);
    const right = Math.atan((p.x + p.half - cx) / focal);
    const along = (left + right) / 2;
    const spread = (right - left) / 2;
    const distance = zFront / (Math.cos(along) - Math.sin(spread));
    return {
      x: distance * Math.sin(along),
      z: distance * Math.cos(along),
      r: distance * Math.sin(spread),
      h: 1 - ((p.top - horizon) * zFront) / focal,
    };
  });
  // The nearest mist: where the bottom row of the room first enters the slab.
  const zNear = (1 - SLAB) / ((room.h - horizon) / focal);
  const halfW = (cx * zWall) / focal;
  const xMin = -halfW - 0.12;
  const xSize = 2 * (halfW + 0.12);
  const zMin = zNear - 0.12;
  const nx = low ? 112 : 176;
  const cell = xSize / nx;
  const nz = Math.max(16, Math.round((zWall + 0.06 - zMin) / cell));
  const pedUniform = new Float32Array(MAX_PEDESTALS * 4);
  peds.slice(0, MAX_PEDESTALS).forEach((p, i) => pedUniform.set([p.x, p.z, p.r, p.h], i * 4));
  const under = peds[scene.light.pedestal] ?? { x: 0, z: zWall * 0.8 };
  const spot: [number, number, number] = [under.x, under.z, scene.light.reach];
  return { zWall, zNear, peds, pedUniform, xMin, xSize, zMin, zSize: nz * cell, nx, nz, cell, iterations: low ? 14 : 22, spot };
}
