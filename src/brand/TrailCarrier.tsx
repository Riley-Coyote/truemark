import { useEffect, useRef } from "react";
import { useMotion } from "./Sequence";
import { createTrailLight } from "./trail-light";
import type { Point } from "./trail-light";

/**
 * The lot itself, travelling its record (HomeSections.tsx, LotRecord): its own vial, small, threaded on the record's
 * line at its middle and carried from station to station to where the lot is now. It is glass carried along: as it is
 * carried off it leans back against the start, as it is brought to a stop it leans on, then it rocks itself upright, a
 * damped spring about its middle. It leaves light behind it (trail-light.ts): the line it has travelled lit in the
 * brand's gradient, and a murmuration of motes streaming off it that settle back into the line. Where it is set down
 * the station takes it: the station's dot lights in the light's colour there (green where the lot is released), one
 * ring spreads from it, and motes rise from it. Down a phone's ledger it is carried along its own axis, so nothing
 * leans it, and it only rocks as it is set down.
 *
 * The light is drawn only while the record can be seen. With motion off the vial stands where the lot is, every
 * station it passed lit, the line lit to it, and nothing moves.
 */

/** The glass's rocking: its own frequency (Hz) and damping, how far a leg's push leans it (radians), and how far
 *  being set down rocks it. */
const ROCK = { hz: 2.2, damping: 0.16, lean: 0.095, setDown: 0.07 } as const;
/** The journey's beats (ms): the vial set down on the first station, its pause at each station, and a leg's time for
 *  its length in pixels. */
const BEAT = { arrive: 560, dwell: 380, leg: (px: number) => Math.min(1050, Math.max(620, 300 + px * 2.4)) } as const;
/** How far above the first station the vial is set down from (px). */
const DROP = 12;

type Step = { kind: "arrive" | "dwell" | "leg"; from: number; to: number; ms: number };

/** Easing with no jerk at either end (smootherstep), and its second derivative: the leg's push. */
const ease = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const push = (u: number) => 60 * u * (u - 1) * (2 * u - 1);

export function TrailCarrier({ src, reached }: { src: string; reached: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const moving = useMotion();
  // The journey is made once a visit: turning motion back on after it leaves the vial where it came to rest.
  const travelled = useRef(false);

  useEffect(() => {
    const carrier = ref.current;
    const canvas = glowRef.current;
    const rail = carrier?.parentElement;
    const record = carrier?.closest<HTMLElement>(".tm-trail-record");
    const glass = carrier?.querySelector<HTMLElement>(".tm-trail-carrier-glass");
    if (!carrier || !canvas || !rail || !record || !glass) return;
    const stations = [...record.querySelectorAll<HTMLElement>(".tm-trail-track > li")].slice(0, reached);
    if (!stations.length) return;
    const light = createTrailLight(canvas);
    record.dataset.carrier = "";

    let points: Point[] = [];
    let vertical = false;
    let width = 0;
    let height = 0;
    const measure = () => {
      const box = rail.getBoundingClientRect();
      points = stations.map((li) => {
        const node = li.querySelector(".tm-trail-node")!.getBoundingClientRect();
        return { x: node.left + node.width / 2 - box.left, y: node.top + node.height / 2 - box.top };
      });
      vertical = points.length > 1 && Math.abs(points[1].y - points[0].y) > Math.abs(points[1].x - points[0].x);
      width = carrier.offsetWidth;
      height = carrier.offsetHeight;
      light.layout(points, vertical, { width: box.width, height: box.height });
      // Each station's dot lights in the light's colour where it stands; release is the moment the lot is verified,
      // and keeps the signal green.
      stations.forEach((li, i) =>
        li.style.setProperty("--tm-station-light", li.classList.contains("is-release") ? "var(--tm-signal)" : light.stationColour(i)),
      );
    };
    const place = (at: Point, angle: number, shown: number, lift = 0) => {
      carrier.style.transform = `translate3d(${at.x - width / 2}px,${at.y - height / 2 - lift}px,0)`;
      carrier.style.opacity = String(shown);
      glass.style.transform = `rotate(${angle}rad)`;
    };
    const land = (i: number, ripple: boolean) => {
      stations[i].dataset.lit = "";
      if (ripple) stations[i].dataset.ripple = "";
    };
    const park = () => {
      measure();
      stations.forEach((_, i) => land(i, false));
      const end = points[points.length - 1];
      place(end, 0, 1);
      light.still(end);
    };

    measure();
    if (!moving) {
      park();
      const sized = new ResizeObserver(park);
      sized.observe(rail);
      return () => {
        sized.disconnect();
        delete record.dataset.carrier;
      };
    }

    // The journey, step by step, and the glass's lean as it goes.
    let steps: Step[] = [];
    let step = 0;
    let elapsed = 0;
    let angle = 0;
    let spin = 0;
    let coupling = 0;
    let started = false;
    let head: Point | null = null;
    if (travelled.current) {
      // Made already this visit: the vial where it came to rest, and its light alive again.
      park();
      started = true;
      head = points[points.length - 1];
    } else {
      stations.forEach((li) => {
        delete li.dataset.lit;
        delete li.dataset.ripple;
      });
      carrier.style.opacity = "0";
    }
    const omega = 2 * Math.PI * ROCK.hz;
    const begin = () => {
      steps = [{ kind: "arrive", from: 0, to: 0, ms: BEAT.arrive }];
      for (let i = 1; i < points.length; i++) {
        steps.push({ kind: "dwell", from: i - 1, to: i - 1, ms: BEAT.dwell });
        const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        steps.push({ kind: "leg", from: i - 1, to: i, ms: BEAT.leg(length) });
      }
      // A leg's push leans the glass by ROCK.lean at its strongest: scaled by the first leg, so wider stations lean it
      // a little further, as a longer carry would.
      const first = steps.find((s) => s.kind === "leg");
      const reference = first && !vertical ? (Math.abs(points[1].x - points[0].x) * 5.77) / (first.ms / 1000) ** 2 : 0;
      coupling = reference > 0 ? (ROCK.lean * omega * omega) / reference : 0;
      started = true;
    };
    const travel = (dt: number) => {
      elapsed += dt * 1000;
      while (step < steps.length && elapsed >= steps[step].ms) {
        const done = steps[step];
        elapsed -= done.ms;
        if (done.kind !== "dwell") {
          land(done.to, true);
          light.burst(done.to);
          if (vertical || done.kind === "arrive") spin += (done.to % 2 ? -1 : 1) * ROCK.setDown * omega;
        }
        step++;
      }
      const current = steps[Math.min(step, steps.length - 1)];
      const u = step < steps.length ? Math.min(1, elapsed / current.ms) : 1;
      let at = points[current.to];
      let shove = 0;
      let lift = 0;
      let shown = 1;
      if (step < steps.length && current.kind === "arrive") {
        lift = DROP * (1 - u * u);
        shown = Math.min(1, u * 2.2);
      } else if (step < steps.length && current.kind === "leg") {
        const a = points[current.from];
        const b = points[current.to];
        const k = ease(u);
        at = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
        if (!vertical) shove = ((b.x - a.x) * push(u)) / (current.ms / 1000) ** 2;
      } else if (step < steps.length) {
        at = points[current.from];
      }
      // The glass about its middle: a damped spring, leaned against the push (in small steps, for stability).
      for (let n = 0; n < 4; n++) {
        const h = dt / 4;
        spin += (-omega * omega * angle - 2 * ROCK.damping * omega * spin - coupling * shove) * h;
        angle = Math.max(-0.3, Math.min(0.3, angle + spin * h));
      }
      place(at, angle, shown, lift);
      // Before the vial is down there is no light: it comes with the vial.
      head = current.kind === "arrive" && step < steps.length && u < 0.85 ? null : at;
      if (step >= steps.length && Math.abs(angle) < 0.0015 && Math.abs(spin) < 0.01) {
        travelled.current = true;
        place(at, 0, 1);
      }
      return step < steps.length;
    };

    // One loop draws the journey and its light, and runs only while the record can be seen.
    let frame = 0;
    let last = 0;
    let clock = 0;
    let visible = false;
    let previous: Point | null = null;
    const along = (p: Point | null) => (p ? (vertical ? p.y : p.x) : 0);
    const loop = (now: number) => {
      frame = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      clock += dt;
      const travelling = started && !travelled.current ? travel(dt) : false;
      const speed = head && previous ? (along(head) - along(previous)) / dt : 0;
      previous = head;
      light.frame(clock, dt, head, speed, travelling);
      if (visible) frame = requestAnimationFrame(loop);
      else last = 0;
    };
    const seen = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      visible = entry.isIntersecting;
      // The journey begins once most of the record's line can be seen.
      if (!started && entry.intersectionRatio >= 0.6) begin();
      if (visible && started && !frame) frame = requestAnimationFrame(loop);
    }, { threshold: [0, 0.6] });
    seen.observe(rail);
    const sized = new ResizeObserver(() => {
      measure();
      if (travelled.current) {
        head = points[points.length - 1];
        place(head, 0, 1);
      }
    });
    sized.observe(rail);

    return () => {
      seen.disconnect();
      sized.disconnect();
      cancelAnimationFrame(frame);
      delete record.dataset.carrier;
    };
  }, [moving, reached, src]);

  return (
    <>
      <canvas className="tm-trail-glow" ref={glowRef} aria-hidden="true" />
      <span className="tm-trail-carrier" ref={ref} aria-hidden="true">
        <span className="tm-trail-carrier-glass">
          <img src={src} alt="" draggable={false} decoding="async" />
        </span>
      </span>
    </>
  );
}
