/*
 * Floor mist for the TrueMark opening.
 *
 * Cold mist pooled on the studio floor, lit by the windows at the upper left. Two parts:
 *
 *   The air: a low-resolution stable-fluids grid lying on the floor plane (advection, pressure
 *   projection, vorticity confinement), with a slow drift, a gentle curl-noise stir, and the
 *   pedestals standing in it as solid bodies. It carries two things the mist reads: how far the
 *   air has displaced the mist's fine structure, and how thick the mist is (a wake thins it, then
 *   it fills back in from its sides).
 *
 *   The mist: a thin volume over the floor, ray-marched through the room's own camera, so the far
 *   mist lies flat and fine and the near mist large and soft. Dense at the floor, thinning with
 *   height, banked a little against the pedestal bases, lit from the upper left with gentle
 *   self-shadowing, in the room's own lilac and white.
 *
 * The pointer is an invisible body moving through that air. Only its movement disturbs it: a wide,
 * weak, velocity-driven drag along the path it moved, and a little stirring that thins the mist in
 * its wake. A still pointer does nothing.
 *
 *   const fog = createFog(canvas, { scene: FOG_SCENES.collection, onFallback })
 *   fog.setPointer(clientX, clientY)   // on pointermove (client px); fog.releasePointer() on leave
 *   fog.set({ density, drift, turbulence, light, pointer })   // eased toward, as a page's own tuning takes over
 *   fog.resize(); fog.pause(); fog.resume(); fog.destroy()
 *
 * createFog returns null (after calling onFallback) when WebGL2 or float render targets are
 * missing; it calls onFallback('slow') and stops itself if the device can't hold a frame rate.
 * Ported from the approved study (tools/landing/board/fog/fog.js); no dependencies.
 */
import { deriveScene, FOG_SCENES, fogTop, SLAB } from "./scenes";
import type { FogScene, Geometry } from "./scenes";
import * as GLSL from "./shaders";

export { FOG_SCENES, fogTop } from "./scenes";
export type { FogPedestal, FogScene } from "./scenes";

/** Why the mist stood down: the host shows its video instead. */
export type FogFallback = "webgl2" | "float-targets" | "shader" | "slow" | "context-lost";
/** Tuning, 1 the default for each: how opaque the bank is, how deep, how far its wisps climb, how fast it drifts, how
 *  much it churns, how strongly the room's light shapes it, and how much the pointer stirs it. */
export type FogParams = { density: number; depth: number; climb: number; drift: number; turbulence: number; light: number; pointer: number };
/** The part of the room the canvas covers, as fractions of the room. */
export type FogRegion = { x0: number; y0: number; x1: number; y1: number };

export type FogOptions = Partial<FogParams> & {
  scene?: FogScene;
  /** Defaults to the room's full width, from the mist's top edge down to the room's foot. */
  region?: FogRegion | null;
  /** Phones: false. The air then moves only by itself. */
  interactive?: boolean;
  /** Reduced motion: the mist drawn once, held still. */
  still?: boolean;
  /** 'high' (desktop) or 'low' (phones: lower resolution, coarser air, fewer samples). */
  quality?: "high" | "low";
  /** Render pixels per CSS pixel (before the adaptive tiers). Defaults by quality. */
  scale?: number;
  /** The most render pixels the canvas holds, however large it is laid out. Defaults by quality. */
  maxPixels?: number;
  /** How much larger than the room's own framing the canvas is laid out (a product page's close view of the room). The
   *  mist is rendered, and kept clear of the vials, as at the framing it is zoomed from, so a camera move that carries
   *  it from one framing to the other never changes it. */
  zoom?: number;
  /** Pause by itself when off screen or when the tab is hidden. */
  autoPause?: boolean;
  /** Step quality down when frames run long, and give up (onFallback('slow')) if that isn't enough. */
  adapt?: boolean;
  onFallback?: ((reason: FogFallback) => void) | null;
};

export type FogStats = {
  fps: number;
  tier: number;
  frames: number;
  fallback: FogFallback | null;
  width: number;
  height: number;
  grid: [number, number];
  running: boolean;
};

export type Fog = {
  /** The pointer's position in client pixels. Only its movement stirs the air. */
  setPointer(x: number, y: number): void;
  /** The pointer left: forget where it was, so its return doesn't leap. */
  releasePointer(): void;
  /** Tuning: density, drift, turbulence, light, pointer (1 is the default for each). A moving mist eases toward it
   *  (TUNE_EASE); a still one takes it at once. */
  set(next: Partial<FogParams>): void;
  readonly params: FogParams;
  /** Change which part of the room the canvas covers (fractions of the room). */
  setRegion(next: FogRegion): void;
  /** The canvas is laid out `zoom` times larger than the framing its mist is rendered for (FogOptions.zoom). */
  setZoom(zoom: number): void;
  /** The canvas has moved into another host, laid out at another size: keep rendering exactly as before (its pixels
   *  and its clearances), by taking the change in size as zoom. */
  adopt(): void;
  /** Hold the mist still (reduced motion) or let it move again. */
  setStill(still: boolean): void;
  resize(): void;
  /** Show the last frame again, as it was: the canvas was set aside and has come back into the page. */
  redraw(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  readonly stats: FogStats;
};

const CONTEXT: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: "high-performance",
};

/**
 * createFog, for a mist built while the page is in use (after a camera move has settled): where the browser can compile
 * shaders on its own threads (KHR_parallel_shader_compile), they are compiled and linked there first, polled once a
 * frame, so the page never waits on them; the rest is then built at once. Elsewhere it is createFog. Resolves null
 * (after onFallback) where the mist can't run, or once `cancelled` says the mist is no longer wanted.
 */
export async function createFogWhenReady(canvas: HTMLCanvasElement, options: FogOptions = {}, cancelled: () => boolean = () => false): Promise<Fog | null> {
  const gl = canvas.getContext("webgl2", CONTEXT);
  const parallel = gl?.getExtension("KHR_parallel_shader_compile");
  if (!gl || !parallel) return cancelled() ? null : createFog(canvas, options);
  const linking = link(gl);
  const programs = Object.values(linking);
  while (!programs.every(({ p }) => gl.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR))) {
    await new Promise((done) => requestAnimationFrame(done));
    if (cancelled() || gl.isContextLost()) {
      for (const { p } of programs) gl.deleteProgram(p);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return null;
    }
  }
  return createFog(canvas, options, linking);
}

/* Quality tiers the adaptive loop steps through: render scale and ray samples, as multipliers. */
const TIERS = [
  { scale: 1, steps: 1 },
  { scale: 0.84, steps: 0.84 },
  { scale: 0.7, steps: 0.7 },
  { scale: 0.56, steps: 0.6 },
] as const;

/*
 * The bank, in camera heights: the layer's height on open floor, how much higher it piles against a pedestal, how much
 * higher a climbing wisp lifts it, and its opacity. Deep enough to rise around the lower part of the pedestals at the
 * opening's framing, where the room is cut off at the pedestals' feet; never near a vial (see CEILING).
 */
const BANK = { top: 0.1, pile: 0.7, climb: 0.7, sigma: 1.9, firm: 0.4 };
/**
 * The pointer's stir, sized to the bank: the core it parts and the reach it drags (camera heights), how hard it drags
 * the air and turns it into eddies, how far it thins the bank in its core and how much it heaps up at the sides, and
 * how long (seconds) a parting takes to settle back: refilled in about five or six.
 */
const STIR = { core: 0.18, reach: 0.34, drag: 1.4, swirl: 0.6, thin: 1.8, ridge: 0.14, refill: 4 };
/** Near a pedestal the mist, wisps and billows included, stays this far under the pedestal's top on screen (CSS px), so
 *  its vial stands clear of it at every size: the floor map's ceiling is redrawn whenever the canvas's scale changes. */
const VIAL_CLEARANCE = 32;
/** Away from the pedestals, the bank's highest reach (camera heights). */
const OPEN_CEILING = 0.3;

/* The mist's colours, from the room: its lit floor's lilac and the lilac of its shaded wall. */
const LIT = [228 / 255, 216 / 255, 245 / 255];
const SHADE = [200 / 255, 187 / 255, 226 / 255];
/** Toward the room's light: overhead, straight down on its pedestal (scenes.ts light), a little behind the camera's
 *  line to it. */
const SUN = normalize3([0, 1, 0.12]);
/**
 * The room's light on the mist (scenes.ts light): in its pool the mist is lit full and a little brighter where it is
 * thick (`glow`, the light it scatters); outside it, it has only the room's own light, `dim` of that. Not so dim as the
 * room's floor falls (a third): the mist carries the light out into the room, and the page's foot stays pale.
 */
const ROOM_LIGHT = { dim: 0.9, glow: 0.16 };
/** How quickly a moving mist takes a new tuning (rad/s of a critically damped ease, from rest): it is about there in
 *  1.4 s, as mist rolls in or thins out, never in a frame (a page handing the mist on with a deeper or thinner bank). */
const TUNE_EASE = 3.4;

type Program<N extends string> = { p: WebGLProgram; u: Record<N | "uTexel", WebGLUniformLocation | null> };
type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number };
type Pair = { readonly read: Target; readonly write: Target; swap(): void; all(): Target[] };
type Sim = { vel: Pair; state: Pair; pres: Pair; curl: Target; div: Target; floor: WebGLTexture };
type Point = { x: number; z: number };

export function createFog(canvas: HTMLCanvasElement, options: FogOptions = {}, linked?: Linking): Fog | null {
  const scene = options.scene ?? FOG_SCENES.collection;
  const params: FogParams = {
    density: options.density ?? 1,
    depth: options.depth ?? 1,
    climb: options.climb ?? 1,
    drift: options.drift ?? 1,
    turbulence: options.turbulence ?? 1,
    light: options.light ?? 1,
    pointer: options.pointer ?? 1,
  };
  /** The tuning asked for, which the moving mist's own (params) eases toward on each frame, at the speed in `pace`. */
  const tuned: FogParams = { ...params };
  const pace = Object.fromEntries(Object.keys(params).map((key) => [key, 0])) as FogParams;
  function ease(dt: number) {
    for (const key of Object.keys(tuned) as (keyof FogParams)[]) {
      const gap = tuned[key] - params[key];
      if (Math.abs(gap) < 1e-4 && Math.abs(pace[key]) < 1e-4) {
        params[key] = tuned[key];
        pace[key] = 0;
        continue;
      }
      pace[key] += (TUNE_EASE * TUNE_EASE * gap - 2 * TUNE_EASE * pace[key]) * dt;
      params[key] += pace[key] * dt;
    }
  }
  /** Take the tuning asked for at once: a still mist, drawn once. */
  function settle() {
    Object.assign(params, tuned);
    for (const key of Object.keys(pace) as (keyof FogParams)[]) pace[key] = 0;
  }
  const low = options.quality === "low";
  const interactive = options.interactive ?? true;
  const autoPause = options.autoPause ?? true;
  const adapt = options.adapt ?? true;
  let still = options.still ?? false;
  const fail = (reason: FogFallback): null => {
    try {
      options.onFallback?.(reason);
    } catch {
      /* the host's handler is its own business */
    }
    return null;
  };

  const context = canvas.getContext("webgl2", CONTEXT);
  if (!context) return fail("webgl2");
  const gl: WebGL2RenderingContext = context;
  if (!gl.getExtension("EXT_color_buffer_float")) return fail("float-targets");

  // ---- the room's geometry, in camera heights (the camera stands one unit above the floor) ----
  const geo: Geometry = deriveScene(scene, low);
  let region: FogRegion = options.region ?? { x0: 0, y0: fogTop(scene), x1: 1, y1: 1 };

  // ---- GL plumbing ----
  let programs: ReturnType<typeof buildPrograms>;
  try {
    programs = buildPrograms(gl, linked ?? link(gl));
  } catch (error) {
    console.warn("[fog]", error instanceof Error ? error.message : error);
    return fail("shader");
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const tri = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tri);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  const noise = bakeNoise(gl, programs.noise, low ? 48 : 64);
  let sim: Sim;
  try {
    sim = makeSim();
  } catch (error) {
    console.warn("[fog]", error instanceof Error ? error.message : error);
    return fail("float-targets");
  }

  function makeSim(): Sim {
    const { nx, nz } = geo;
    const t = (filter: number = gl.LINEAR) => target(gl, nx, nz, filter);
    const pair = (): Pair => {
      let a = t();
      let b = t();
      return {
        get read() {
          return a;
        },
        get write() {
          return b;
        },
        swap() {
          [a, b] = [b, a];
        },
        all: () => [a, b],
      };
    };
    const s: Sim = { vel: pair(), state: pair(), pres: pair(), curl: t(gl.NEAREST), div: t(gl.NEAREST), floor: floorMap(gl, geo, clearances(1)) };
    resetSim(s);
    return s;
  }
  function resetSim(s: Sim) {
    const wind = windCells(0);
    for (const fb of s.vel.all()) clearTarget(fb, [wind[0], wind[1], 0, 1]);
    for (const fb of s.state.all()) clearTarget(fb, [0, 0, 1, 1]);
    for (const fb of s.pres.all()) clearTarget(fb, [0, 0, 0, 1]);
  }
  function clearTarget(t: Target, value: number[]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.viewport(0, 0, t.w, t.h);
    gl.clearBufferfv(gl.COLOR, 0, value);
  }
  function freeSim(s: Sim) {
    for (const p of [s.vel, s.state, s.pres]) for (const t of p.all()) freeTarget(gl, t);
    freeTarget(gl, s.curl);
    freeTarget(gl, s.div);
    gl.deleteTexture(s.floor);
  }

  // ---- time and drift ----
  let clock = 0; // seconds the mist has lived
  let flow = 37; // the mist's own evolution clock (runs with the drift)
  const drift = [0, 0]; // where the drift has carried the mist's structure
  function windWorld(time: number): [number, number] {
    // A slow drift to the right and a little toward the camera, that breathes.
    const s = params.drift;
    const g = 1 + 0.25 * Math.sin(time * 0.071) + 0.15 * Math.sin(time * 0.023 + 1.3);
    return [0.022 * s * g, -0.008 * s * (1 + 0.4 * Math.sin(time * 0.041 + 0.7))];
  }
  function windCells(time: number): [number, number] {
    const w = windWorld(time);
    return [w[0] / geo.cell, w[1] / geo.cell];
  }

  // ---- pointer: an invisible body in the air ----
  const pointer = { x: 0, y: 0, active: false, moved: false, prev: null as Point | null, prevTime: 0 };
  // The canvas as it stands on screen now, with whatever its layer's transform does to it (parallax, a camera move).
  let rect = canvas.getBoundingClientRect();
  let rectStamp = 0;
  function pointerToWorld(cx: number, cy: number): Point | null {
    if (performance.now() - rectStamp > 250) {
      rect = canvas.getBoundingClientRect();
      rectStamp = performance.now();
    }
    if (!rect.width || !rect.height) return null;
    const fx = (cx - rect.left) / rect.width;
    const fy = (cy - rect.top) / rect.height;
    if (fx < -0.05 || fx > 1.05 || fy < -0.2 || fy > 1.05) return null;
    const { room, focal, horizon } = scene;
    const u = (region.x0 + fx * (region.x1 - region.x0)) * room.w;
    const v = (region.y0 + fy * (region.y1 - region.y0)) * room.h;
    const dx = (u - room.w / 2) / focal;
    const dy = -(v - horizon) / focal;
    if (dy > -1e-4) return null;
    const height = 0.08; // the body moves through the mist about this high
    let t = (1 - height) / -dy;
    for (const p of geo.peds) {
      // the ray (dx·t, t) against the pedestal's circle in the floor plane
      const a = dx * dx + 1;
      const b = -2 * (dx * p.x + p.z);
      const c = p.x * p.x + p.z * p.z - p.r * p.r;
      const disc = b * b - 4 * a * c;
      if (disc <= 0) continue;
      const th = (-b - Math.sqrt(disc)) / (2 * a);
      if (th > 0 && th < t) {
        if (1 + dy * th > 0.36) return null; // over a pedestal, above the mist
        t = th;
      }
    }
    if (t > geo.zWall) {
      if (1 + dy * geo.zWall > 0.45) return null; // on the wall, above the mist
      t = geo.zWall - 0.03;
    }
    return { x: dx * t, z: t };
  }

  // ---- resolution ----
  // A phone draws the mist at about its layout's own size (a third of the screen's pixels): smaller, its wisps were
  // stretched soft. The adaptive tiers step it back down where a phone can't keep up.
  const baseScale = options.scale ?? (low ? 0.95 : 0.8);
  const maxPixels = options.maxPixels ?? (low ? 360_000 : 1_100_000);
  let zoom = options.zoom && options.zoom > 0 ? options.zoom : 1;
  /** The layout size the mist was last rendered for, after the zoom. */
  let framed = { w: 0, h: 0 };
  const baseSteps = low ? 26 : 36;
  let tier = 0;
  /** Each pedestal's clearance in camera heights, at its front: VIAL_CLEARANCE CSS px at `scale` CSS px per room px. */
  function clearances(scale: number): number[] {
    return geo.peds.map((p) => ((VIAL_CLEARANCE / scale) * (p.z - p.r)) / scene.focal);
  }
  let ceilingScale = 0;
  function resize() {
    rect = canvas.getBoundingClientRect();
    rectStamp = performance.now();
    // The layout size, not the transformed one: a camera move scales the layer, not the canvas's pixels. A close
    // framing of the room is taken back to the framing it zooms from.
    const cssW = canvas.clientWidth / zoom;
    const cssH = canvas.clientHeight / zoom;
    // Set aside (out of the document, or not laid out): it keeps its size, its air and its last frame for its return.
    if (!canvas.isConnected || !cssW || !cssH) return;
    framed = { w: cssW, h: cssH };
    const scale = cssW / (scene.room.w * (region.x1 - region.x0));
    if (scale > 0 && Math.abs(scale / ceilingScale - 1) > 0.02) {
      ceilingScale = scale;
      uploadFloor(gl, sim.floor, geo, clearances(scale));
    }
    const budget = Math.sqrt(maxPixels / Math.max(1, cssW * cssH));
    const s = Math.min(baseScale, budget) * TIERS[tier].scale;
    const w = Math.max(2, Math.round(cssW * s));
    const h = Math.max(2, Math.round(cssH * s));
    // A new size clears the canvas: a held mist draws itself again (a moving one does on its next frame).
    const changed = canvas.width !== w || canvas.height !== h;
    if (changed) {
      canvas.width = w;
      canvas.height = h;
    }
    if (destroyed || !changed) return;
    // Drawn now, before this frame is painted: a resized canvas is cleared, and a running mist's next frame is a frame
    // away, so waiting would show it empty for one.
    if (still) drawStill();
    else draw();
  }

  // ---- one step of the air ----
  function bindTex(unit: number, tex: WebGLTexture, target3d = false): number {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target3d ? gl.TEXTURE_3D : gl.TEXTURE_2D, tex);
    return unit;
  }
  function run(out: Target | null) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function use<N extends string>(prog: Program<N>): Program<N>["u"] {
    gl.useProgram(prog.p);
    if (prog.u.uTexel) gl.uniform2f(prog.u.uTexel, 1 / geo.nx, 1 / geo.nz);
    return prog.u;
  }

  function splat(a: Point, b: Point, vx: number, vz: number, speed: number, path: number, dt: number) {
    const u = use(programs.splat);
    const toUv = (w: Point) => [(w.x - geo.xMin) / geo.xSize, (w.z - geo.zMin) / geo.zSize];
    const A = toUv(a);
    const B = toUv(b);
    const strength = params.pointer;
    const { core, reach } = STIR;
    // A casual drift of the hand barely registers; a deliberate sweep does.
    const gate = smoothstep(0.15, 1.2, speed) * strength;
    const swept = Math.min(path / core, 2);
    const speedCells = speed / geo.cell;
    gl.uniform2f(u.uA, A[0], A[1]);
    gl.uniform2f(u.uB, B[0], B[1]);
    gl.uniform2f(u.uGrid, geo.nx, geo.nz);
    gl.uniform4f(u.uWorld, geo.xMin, geo.zMin, geo.xSize, geo.zSize);
    gl.uniform1i(u.uNoise, bindTex(1, noise, true));
    gl.uniform1f(u.uCore, core / geo.cell);
    gl.uniform1f(u.uRadius, reach / geo.cell);
    gl.uniform2f(u.uBodyVel, vx / geo.cell, vz / geo.cell);
    // Per second, not per frame: the same hand stirs the same at any frame rate.
    gl.uniform1f(u.uDrag, Math.min(1 - Math.exp(-STIR.drag * gate * dt), 0.5));
    gl.uniform1f(u.uSwirl, STIR.swirl * speedCells * gate * dt);
    gl.uniform1f(u.uPhase, 0.5 + clock * 0.013);
    gl.uniform1f(u.uThin, STIR.thin * gate * swept);
    gl.uniform1f(u.uRidge, STIR.ridge * gate * swept);
    gl.uniform1i(u.uSrc, bindTex(0, sim.vel.read.tex));
    gl.uniform1i(u.uMode, 0);
    gl.viewport(0, 0, geo.nx, geo.nz);
    run(sim.vel.write);
    sim.vel.swap();
    gl.uniform1i(u.uSrc, bindTex(0, sim.state.read.tex));
    gl.uniform1i(u.uMode, 1);
    run(sim.state.write);
    sim.state.swap();
  }

  function step(dt: number) {
    clock += dt;
    flow += dt * params.drift;
    const ww = windWorld(clock);
    drift[0] -= ww[0] * dt;
    drift[1] -= ww[1] * dt;
    const wind = [ww[0] / geo.cell, ww[1] / geo.cell];

    // The body, if it moved.
    if (interactive && params.pointer > 0 && pointer.active && pointer.moved) {
      pointer.moved = false;
      const w = pointerToWorld(pointer.x, pointer.y);
      if (w && pointer.prev) {
        const dx = w.x - pointer.prev.x;
        const dz = w.z - pointer.prev.z;
        const path = Math.hypot(dx, dz);
        const elapsed = Math.max(clock - pointer.prevTime, 1 / 120);
        if (path > 1e-4 && path < 0.9) {
          const speed = Math.min(path / elapsed, 2.2);
          if (speed > 0.05) splat(pointer.prev, w, (dx / path) * speed, (dz / path) * speed, speed, path, Math.min(elapsed, 1 / 20));
        }
      }
      pointer.prev = w;
      pointer.prevTime = clock;
    }

    gl.viewport(0, 0, geo.nx, geo.nz);
    // curl
    const curl = use(programs.curl);
    gl.uniform1i(curl.uVel, bindTex(0, sim.vel.read.tex));
    run(sim.curl);
    // forces
    const force = use(programs.force);
    gl.uniform1i(force.uVel, bindTex(0, sim.vel.read.tex));
    gl.uniform1i(force.uCurl, bindTex(1, sim.curl.tex));
    gl.uniform1i(force.uFloor, bindTex(2, sim.floor));
    gl.uniform1i(force.uNoise, bindTex(3, noise, true));
    gl.uniform4f(force.uWorld, geo.xMin, geo.zMin, geo.xSize, geo.zSize);
    gl.uniform2f(force.uWind, wind[0], wind[1]);
    gl.uniform1f(force.uDt, dt);
    gl.uniform1f(force.uConfine, 2.4 * params.turbulence);
    gl.uniform1f(force.uStir, 0.003 * params.turbulence * params.drift);
    gl.uniform1f(force.uRelax, Math.exp(-dt / 3.6));
    gl.uniform1f(force.uTime, flow);
    gl.uniform1f(force.uCell, geo.cell);
    run(sim.vel.write);
    sim.vel.swap();
    // divergence
    const div = use(programs.divergence);
    gl.uniform1i(div.uVel, bindTex(0, sim.vel.read.tex));
    run(sim.div);
    // pressure
    const scale = use(programs.scale);
    gl.uniform1i(scale.uSrc, bindTex(0, sim.pres.read.tex));
    gl.uniform1f(scale.uK, 0.8);
    run(sim.pres.write);
    sim.pres.swap();
    const pressure = use(programs.pressure);
    gl.uniform1i(pressure.uDiv, bindTex(1, sim.div.tex));
    for (let i = 0; i < geo.iterations; i++) {
      gl.uniform1i(pressure.uP, bindTex(0, sim.pres.read.tex));
      run(sim.pres.write);
      sim.pres.swap();
    }
    // projection
    const gradient = use(programs.gradient);
    gl.uniform1i(gradient.uP, bindTex(0, sim.pres.read.tex));
    gl.uniform1i(gradient.uVel, bindTex(1, sim.vel.read.tex));
    gl.uniform1i(gradient.uFloor, bindTex(2, sim.floor));
    run(sim.vel.write);
    sim.vel.swap();
    // advect the air by itself
    const advect = use(programs.advect);
    gl.uniform1i(advect.uVel, bindTex(0, sim.vel.read.tex));
    gl.uniform1f(advect.uDt, dt);
    run(sim.vel.write);
    sim.vel.swap();
    // carry the mist's state
    const state = use(programs.state);
    gl.uniform1i(state.uVel, bindTex(0, sim.vel.read.tex));
    gl.uniform1i(state.uState, bindTex(1, sim.state.read.tex));
    gl.uniform2f(state.uWind, wind[0], wind[1]);
    gl.uniform1f(state.uDt, dt);
    gl.uniform1f(state.uCell, geo.cell);
    gl.uniform1f(state.uKeepD, Math.exp(-dt / 9));
    gl.uniform1f(state.uKeepT, Math.exp(-dt / STIR.refill));
    gl.uniform1f(state.uDiffuse, Math.min(1, 9 * dt));
    run(sim.state.write);
    sim.state.swap();
  }

  // ---- the mist's history: the last frames, averaged (the camera is still) ----
  let history: { w: number; h: number; read: Target; write: Target; both: Target[] } | null = null;
  let historyFresh = true;
  /** The frame's place in the march's cycle of starting offsets (shaders.ts RENDER). */
  let frameIndex = 0;
  function ensureHistory() {
    if (history && history.w === canvas.width && history.h === canvas.height) return history;
    if (history) for (const t of history.both) freeTarget(gl, t);
    const a = target(gl, canvas.width, canvas.height, gl.NEAREST);
    const b = target(gl, canvas.width, canvas.height, gl.NEAREST);
    history = { w: canvas.width, h: canvas.height, read: a, write: b, both: [a, b] };
    historyFresh = true;
    return history;
  }

  // ---- the mist, drawn ----
  function draw(blend = 1) {
    const hist = ensureHistory();
    const u = use(programs.render);
    gl.uniform1i(u.uHistory, bindTex(3, hist.read.tex));
    gl.uniform1f(u.uBlend, historyFresh ? 1 : blend);
    frameIndex = (frameIndex + 1) % 64;
    gl.uniform1f(u.uFrame, frameIndex);
    const { room, focal, horizon } = scene;
    gl.uniform1i(u.uNoise, bindTex(0, noise, true));
    gl.uniform1i(u.uState, bindTex(1, sim.state.read.tex));
    gl.uniform1i(u.uFloor, bindTex(2, sim.floor));
    gl.uniform4f(u.uRegion, region.x0, region.y0, region.x1, region.y1);
    gl.uniform2f(u.uRoom, room.w, room.h);
    gl.uniform1f(u.uHorizon, horizon);
    gl.uniform1f(u.uFocal, focal);
    gl.uniform1f(u.uWallZ, geo.zWall);
    gl.uniform4f(u.uWorld, geo.xMin, geo.zMin, geo.xSize, geo.zSize);
    gl.uniform4fv(u.uPed, geo.pedUniform);
    gl.uniform1i(u.uPedCount, geo.peds.length);
    gl.uniform1f(u.uTime, flow);
    gl.uniform2f(u.uDrift, drift[0], drift[1]);
    gl.uniform1f(u.uTop, BANK.top * params.depth * (0.75 + 0.25 * params.density));
    gl.uniform1f(u.uPile, BANK.pile * params.depth);
    gl.uniform1f(u.uClimb, BANK.climb * params.climb);
    gl.uniform1f(u.uFirm, BANK.firm);
    gl.uniform1f(u.uSigma, BANK.sigma * params.density);
    gl.uniform1f(u.uTurb, 0.25 + 0.75 * params.turbulence);
    gl.uniform1f(u.uLight, params.light);
    gl.uniform1f(u.uSteps, Math.max(8, Math.round(baseSteps * TIERS[tier].steps)));
    gl.uniform1f(u.uZNear, geo.zNear);
    gl.uniform3fv(u.uLit, LIT);
    gl.uniform3fv(u.uShade, SHADE);
    gl.uniform3fv(u.uSun, SUN);
    gl.uniform3fv(u.uSpot, geo.spot);
    gl.uniform2f(u.uRoomLight, ROOM_LIGHT.dim, ROOM_LIGHT.glow);
    gl.bindFramebuffer(gl.FRAMEBUFFER, hist.write.fb);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [hist.read, hist.write] = [hist.write, hist.read];
    historyFresh = false;
    present(hist.read);
  }
  function present(src: Target) {
    const u = use(programs.present);
    gl.uniform1i(u.uSrc, bindTex(0, src.tex));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** The last frame again, exactly as it was (its history, not a fresh sampling): the canvas came back into the page. */
  function redraw() {
    if (destroyed) return;
    resize();
    if (history && history.w === canvas.width && history.h === canvas.height && !historyFresh) present(history.read);
    else if (still) drawStill();
    else draw();
  }

  /** Reduced motion: one moment of the mist, averaged over many jittered samplings, held. */
  function drawStill() {
    if (destroyed) return;
    historyFresh = true;
    for (let i = 0; i < 16; i++) draw(1 / (i + 1));
  }

  /** Let the air settle around the pedestals before the first frame is seen. */
  function warm(seconds: number) {
    const n = Math.round(seconds * 30);
    for (let i = 0; i < n; i++) step(1 / 30);
  }

  // ---- the loop ----
  let raf = 0;
  let running = false;
  let destroyed = false;
  let userPaused = false;
  let inView = true;
  let last = 0;
  let settleUntil = 0;
  let windowStart = 0;
  let slowStrikes = 0;
  const intervals: number[] = [];
  const stats = { fps: 0, tier: 0, frames: 0, fallback: null as FogFallback | null };

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const ms = last ? now - last : 16.7;
    last = now;
    if (ms > 250) return; // came back from a stall: don't leap
    const dt = Math.min(ms / 1000, 1 / 30);
    ease(dt);
    step(dt);
    draw(1 - Math.exp(-dt / 0.06));
    stats.frames++;
    measure(ms, now);
  }
  /* Frame times, judged over windows of about a second and a half after a short settling time. Below
     48 fps the quality steps down (straight to the lowest step below 30 fps); at the lowest step, below
     24 fps, or below 34 fps twice running, the mist gives up and asks the host for the video. */
  function measure(ms: number, now: number) {
    if (now < settleUntil) return;
    if (!intervals.length) windowStart = now;
    intervals.push(ms);
    if (now - windowStart < 1500 && intervals.length < 120) return;
    const sorted = intervals.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    intervals.length = 0;
    const fps = 1000 / median;
    stats.fps = Math.round(fps * 10) / 10;
    if (!adapt) return;
    const lowest = TIERS.length - 1;
    if (fps < 48 && tier < lowest) {
      tier = fps < 30 ? lowest : tier + 1;
      stats.tier = tier;
      resize();
      settleUntil = now + 500;
    } else if (tier === lowest && fps < 34) {
      if (fps < 24 || ++slowStrikes >= 2) {
        stats.fallback = "slow";
        destroy();
        fail("slow");
      }
    } else slowStrikes = 0;
  }
  function sync() {
    const go = !destroyed && !still && !userPaused && inView && !document.hidden;
    if (go && !running) {
      running = true;
      last = 0;
      settleUntil = performance.now() + 750;
      intervals.length = 0;
      raf = requestAnimationFrame(loop);
    } else if (!go && running) {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  let io: IntersectionObserver | null = null;
  const onVisibility = () => sync();
  if (autoPause) {
    io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  const onLost = (event: Event) => {
    event.preventDefault();
    stats.fallback = "context-lost";
    destroy();
    fail("context-lost");
  };
  canvas.addEventListener("webglcontextlost", onLost);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    running = false;
    cancelAnimationFrame(raf);
    io?.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onLost);
    if (!gl.isContextLost()) {
      freeSim(sim);
      if (history) for (const t of history.both) freeTarget(gl, t);
      gl.deleteTexture(noise);
      for (const p of Object.values(programs)) gl.deleteProgram(p.p);
      gl.deleteBuffer(tri);
      gl.deleteVertexArray(vao);
      // Give the context back now rather than at the next collection: a page that mounts the opening again (a
      // route change) would otherwise pile contexts up toward the browser's limit.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }

  // ---- start ----
  resize();
  warm(still ? 2.5 : 1.5);
  if (still) drawStill();
  else {
    draw();
    sync();
  }

  return {
    setPointer(x, y) {
      if (!interactive || still) return;
      if (!pointer.active) {
        pointer.prev = null;
        pointer.active = true;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.moved = true;
    },
    releasePointer() {
      pointer.active = false;
      pointer.prev = null;
    },
    set(next) {
      Object.assign(tuned, next);
      if (still) {
        settle();
        drawStill();
      }
    },
    get params() {
      return { ...params };
    },
    setRegion(next) {
      region = { ...next };
      if (still) drawStill();
    },
    setZoom(next) {
      if (!(next > 0) || Math.abs(next / zoom - 1) < 1e-4) return;
      zoom = next;
      resize();
    },
    adopt() {
      const width = canvas.clientWidth;
      if (framed.w > 0 && width > 0) zoom = width / framed.w;
    },
    setStill(next) {
      if (next === still) return;
      still = next;
      if (still) {
        pointer.active = false;
        sync();
        settle();
        drawStill();
      } else sync();
    },
    resize,
    redraw,
    pause() {
      userPaused = true;
      sync();
    },
    resume() {
      userPaused = false;
      sync();
    },
    destroy,
    get stats(): FogStats {
      return { ...stats, tier, width: canvas.width, height: canvas.height, grid: [geo.nx, geo.nz], running };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Every program the mist runs, by name: its fragment shader. */
const SOURCES = {
  noise: GLSL.NOISE,
  curl: GLSL.CURL,
  force: GLSL.FORCE,
  divergence: GLSL.DIVERGENCE,
  scale: GLSL.SCALE,
  pressure: GLSL.PRESSURE,
  gradient: GLSL.GRADIENT,
  advect: GLSL.ADVECT,
  state: GLSL.STATE,
  splat: GLSL.SPLAT,
  render: GLSL.RENDER,
  present: GLSL.PRESENT,
};
/** The programs compiled and linked, not yet asked whether they did: asking waits for the compiler. */
export type Linking = Record<keyof typeof SOURCES, { p: WebGLProgram; v: WebGLShader; f: WebGLShader }>;

/** Compile and link every program without waiting on any of them. */
function link(gl: WebGL2RenderingContext): Linking {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("fog: no shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const out = {} as Linking;
  for (const [name, fs] of Object.entries(SOURCES) as [keyof typeof SOURCES, string][]) {
    const p = gl.createProgram();
    const v = compile(gl.VERTEX_SHADER, GLSL.VERTEX);
    const f = compile(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    out[name] = { p, v, f };
  }
  return out;
}

/** Every program the mist runs, linked, with the uniforms each one sets. */
function buildPrograms(gl: WebGL2RenderingContext, linking: Linking) {
  return {
    noise: program(gl, linking.noise, ["uLayer", "uSize"]),
    curl: program(gl, linking.curl, ["uVel"]),
    force: program(gl, linking.force, ["uVel", "uCurl", "uFloor", "uNoise", "uWorld", "uWind", "uDt", "uConfine", "uStir", "uRelax", "uTime", "uCell"]),
    divergence: program(gl, linking.divergence, ["uVel"]),
    scale: program(gl, linking.scale, ["uSrc", "uK"]),
    pressure: program(gl, linking.pressure, ["uP", "uDiv"]),
    gradient: program(gl, linking.gradient, ["uP", "uVel", "uFloor"]),
    advect: program(gl, linking.advect, ["uVel", "uDt"]),
    state: program(gl, linking.state, ["uVel", "uState", "uWind", "uDt", "uCell", "uKeepD", "uKeepT", "uDiffuse"]),
    splat: program(gl, linking.splat, ["uSrc", "uNoise", "uWorld", "uA", "uB", "uGrid", "uCore", "uRadius", "uBodyVel", "uDrag", "uSwirl", "uPhase", "uThin", "uRidge", "uMode"]),
    render: program(gl, linking.render, [
      "uNoise", "uState", "uFloor", "uRegion", "uRoom", "uHorizon", "uFocal", "uWallZ", "uWorld", "uPed", "uPedCount", "uTime", "uDrift",
      "uTop", "uPile", "uClimb", "uFirm", "uSigma", "uTurb", "uLight", "uSteps", "uZNear", "uLit", "uShade", "uSun", "uSpot", "uRoomLight", "uHistory", "uBlend", "uFrame",
    ]),
    present: program(gl, linking.present, ["uSrc"]),
  };
}

/**
 * Pooling near each pedestal (R), its solid footprint (G), and the ceiling the mist keeps under (B, as a share of the
 * slab). The open floor's ceiling, raised close to a tall pedestal so the bank can pile higher against it; and, in each
 * pedestal's span as the camera sees it, the line of sight that keeps its vial clear: in front of it, the line to the
 * height on its face `clearance` below its top (mist under that line shows below that height); behind it, the line
 * over its back edge (mist under that is hidden by the pedestal itself, so none shows over its top).
 */
function floorData(geo: Geometry, clearance: number[]): Uint8Array {
  const { nx, nz } = geo;
  const data = new Uint8Array(nx * nz * 4);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = geo.xMin + ((i + 0.5) / nx) * geo.xSize;
      const z = geo.zMin + ((j + 0.5) / nz) * geo.zSize;
      let pool = 0;
      let solid = 0;
      let raised = OPEN_CEILING;
      let held = Infinity;
      geo.peds.forEach((p, n) => {
        const d = Math.hypot(x - p.x, z - p.z) - p.r;
        pool += Math.exp(-Math.max(d, 0) / 0.16);
        solid = Math.max(solid, smoothstep(geo.cell, -geo.cell, d));
        const limit = p.h - clearance[n];
        if (limit > OPEN_CEILING) raised = Math.max(raised, OPEN_CEILING + (limit - OPEN_CEILING) * (1 - smoothstep(0.2, 0.7, d)));
        const D = Math.hypot(p.x, p.z);
        const along = (x * p.x + z * p.z) / D; // how far out along the line of sight to the pedestal
        const across = Math.abs(x * p.z - z * p.x) / D;
        const half = (p.r * along) / D; // its span widens with distance
        const span = 1 - smoothstep(half, half * 1.3 + 0.05, across);
        if (span <= 0 || along <= 0) return;
        const line = along < D
          ? 1 - (along * (1 - limit)) / (D - p.r)
          : p.h - ((1 - p.h) * Math.max(along - (D + p.r), 0)) / (D + p.r) - 0.02;
        held = Math.min(held, line + (1 - span) * 0.5);
      });
      const ceiling = Math.min(held, raised);
      const k = (j * nx + i) * 4;
      data[k] = Math.round(Math.min(pool, 1) * 255);
      data[k + 1] = Math.round(solid * 255);
      data[k + 2] = Math.round(Math.min(1, Math.max(0, ceiling / SLAB)) * 255);
      data[k + 3] = 255;
    }
  }
  return data;
}
function floorMap(gl: WebGL2RenderingContext, geo: Geometry, clearance: number[]): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  uploadFloor(gl, tex, geo, clearance);
  return tex;
}
function uploadFloor(gl: WebGL2RenderingContext, tex: WebGLTexture, geo: Geometry, clearance: number[]) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, geo.nx, geo.nz, 0, gl.RGBA, gl.UNSIGNED_BYTE, floorData(geo, clearance));
}

/** Bake the tileable noise volume on the GPU, one layer at a time. */
function bakeNoise(gl: WebGL2RenderingContext, prog: Program<"uLayer" | "uSize">, size: number): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, size, size, size);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, wrap, gl.REPEAT);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.useProgram(prog.p);
  gl.uniform1f(prog.u.uSize, size);
  gl.viewport(0, 0, size, size);
  for (let layer = 0; layer < size; layer++) {
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, layer);
    gl.uniform1f(prog.u.uLayer, layer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  return tex;
}

function target(gl: WebGL2RenderingContext, w: number, h: number, filter: number): Target {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("fog: float target incomplete");
  return { tex, fb, w, h };
}
function freeTarget(gl: WebGL2RenderingContext, t: Target) {
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fb);
}

/** A linked program, checked, with its uniforms found. */
function program<N extends string>(gl: WebGL2RenderingContext, linked: Linking[keyof Linking], names: readonly N[]): Program<N> {
  const { p, v, f } = linked;
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const why = [v, f].map((shader) => (gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? "" : gl.getShaderInfoLog(shader))).find(Boolean);
    throw new Error(why || gl.getProgramInfoLog(p) || "link failed");
  }
  gl.deleteShader(v);
  gl.deleteShader(f);
  // A uniform the compiler optimised away has no location: setting it is then a no-op, as WebGL allows.
  const u = { uTexel: gl.getUniformLocation(p, "uTexel") } as Record<N | "uTexel", WebGLUniformLocation | null>;
  for (const name of names) u[name] = gl.getUniformLocation(p, name);
  return { p, u };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function normalize3(v: [number, number, number]): number[] {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
