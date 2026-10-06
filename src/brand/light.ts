import { useEffect } from "react";
import type { CSSProperties, RefObject } from "react";
import "./light.css";

/**
 * The style that clips a sheen to a piece of glass: the glass's own cut-out as
 * its mask. The address is made absolute here, because a relative url() in a
 * custom property resolves against the stylesheet that uses it (in a build, the
 * assets folder), not against the page.
 */
export function sheenMask(src: string): CSSProperties {
  return { "--tm-sheen-mask": `url("${new URL(src, document.baseURI).href}")` } as CSSProperties;
}

/**
 * Light that moves over glass: the brand's gradient appears only as light, and
 * this is where it lives. A scene (the home shelf, the sign-in panel) gets a
 * light position (`--lx`, `--ly`, in px within the scene, and `--lxp`, `--lyp`
 * as fractions); each piece of glass inside it marked `data-sheen` gets its own
 * local highlight position (`--sx`, as a percentage of its width) and its
 * offset from the light (`--dx`, `--dy`, -1…1, for depth parallax).
 *
 * Unless `follow` is false (a scene lit by a fixed studio key, like the home hero, whose shadows
 * don't move), the pointer moves the light, which follows it with a slight lag, as a real
 * light carried by a hand would. When the pointer is away, the light rests off
 * the scene's left edge, where nothing catches it, and makes a slow pass across
 * on its own: the first shortly after the scene appears (`firstPass`), then one
 * every `period` (or never again, with `repeat: false`). Each pass leaves from
 * the rest and ends beyond the right edge, where nothing is lit, so the light
 * never visibly jumps. With reduced motion, or `ambient: false`, there are no
 * passes; the light follows the pointer only. At rest the loop sleeps.
 */
export function useLight(
  root: RefObject<HTMLElement | null>,
  {
    firstPass = 1400,
    pass = 2100,
    period = 13000,
    idle = 3200,
    repeat = true,
    ambient: passes = true,
    follow = true,
  }: { firstPass?: number; pass?: number; period?: number; idle?: number; repeat?: boolean; ambient?: boolean; follow?: boolean } = {},
) {
  useEffect(() => {
    const scene = root.current;
    if (!scene) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const passing = passes && !still;
    const start = performance.now();
    const first = start + firstPass;
    let pointer: { x: number; y: number } | null = null;
    let lastMove = -Infinity;
    let light: { x: number; y: number } | null = null;
    let led = false;
    let gliding = false;
    let last = start;
    let frame = 0;
    let wake = 0;
    let visible = true;

    const place = (x: number, y: number) => {
      const box = scene.getBoundingClientRect();
      scene.style.setProperty("--lx", `${x}px`);
      scene.style.setProperty("--ly", `${y}px`);
      scene.style.setProperty("--lxp", `${box.width ? x / box.width : 0}`);
      scene.style.setProperty("--lyp", `${box.height ? y / box.height : 0}`);
      const lightX = box.left + x;
      const lightY = box.top + y;
      for (const glass of scene.querySelectorAll<HTMLElement>("[data-sheen]")) {
        const r = glass.getBoundingClientRect();
        if (!r.width) continue;
        glass.style.setProperty("--sx", `${((lightX - r.left) / r.width) * 100}%`);
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        glass.style.setProperty("--dx", `${Math.max(-1, Math.min(1, (lightX - cx) / box.width))}`);
        glass.style.setProperty("--dy", `${Math.max(-1, Math.min(1, (lightY - cy) / box.height))}`);
      }
    };

    /** Where the ambient light is at time t: at rest, or partway through a pass. */
    const ambient = (t: number, box: DOMRect) => {
      const since = t - first;
      const phase = !passing || since < 0 || (!repeat && since > pass) ? -1 : since % period;
      const y = box.height * 0.42;
      if (phase < 0 || phase > pass) return { x: -box.width * 0.4, y, moving: false };
      const eased = 0.5 - Math.cos((phase / pass) * Math.PI) / 2;
      return { x: -box.width * 0.4 + eased * box.width * 1.85, y, moving: true };
    };

    /** When the next pass begins, or null if none will. */
    const nextPass = (t: number) => {
      if (!passing) return null;
      if (t < first) return first;
      if (!repeat) return null;
      return first + Math.ceil((t - first) / period) * period;
    };

    const schedule = (at: number | null, t: number) => {
      if (at === null) return;
      wake = window.setTimeout(() => {
        wake = 0;
        if (!frame) frame = requestAnimationFrame(tick);
      }, Math.max(0, at - t));
    };

    const tick = (t: number) => {
      frame = 0;
      const box = scene.getBoundingClientRect();
      const nowLed = pointer !== null && t - lastMove < idle;
      const a = ambient(t, box);
      const target = nowLed && pointer ? pointer : a;
      // Changing hands, between the pointer and the ambient light, the light glides.
      if (nowLed !== led) {
        led = nowLed;
        gliding = light !== null && !still;
      }
      if (!light || !gliding) {
        light = { x: target.x, y: target.y };
      } else {
        // After a sleep, the first step is taken as one frame's worth, not the whole gap.
        const k = 1 - Math.exp(-Math.min(t - last, 17) / 90);
        light = { x: light.x + (target.x - light.x) * k, y: light.y + (target.y - light.y) * k };
        // The ambient path is smooth on its own; once caught up, follow it exactly.
        if (!led && Math.abs(target.x - light.x) < 0.5 && Math.abs(target.y - light.y) < 0.5) gliding = false;
      }
      last = t;
      place(light.x, light.y);

      if (!visible) return;
      const caughtUp = Math.abs(target.x - light.x) < 0.5 && Math.abs(target.y - light.y) < 0.5;
      if (a.moving || !caughtUp) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // Nothing moving: sleep until the pointer's lead runs out, or the next pass.
      schedule(led ? lastMove + idle : nextPass(t), t);
    };

    const rouse = () => {
      if (wake) {
        window.clearTimeout(wake);
        wake = 0;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const box = scene.getBoundingClientRect();
      pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      lastMove = performance.now();
      rouse();
    };
    const onLeave = () => {
      lastMove = -Infinity;
      rouse();
    };

    // Off screen, the light stops; it picks up again when the scene returns.
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) rouse();
    });
    seen.observe(scene);

    if (follow) scene.addEventListener("pointermove", onMove);
    scene.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(tick);
    return () => {
      seen.disconnect();
      scene.removeEventListener("pointermove", onMove);
      scene.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      if (wake) window.clearTimeout(wake);
    };
  }, [root, firstPass, pass, period, idle, repeat, passes, follow]);
}
