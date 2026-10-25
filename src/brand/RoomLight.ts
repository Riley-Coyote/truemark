import { useEffect } from "react";
import type { RefObject } from "react";
import { startRoomLight } from "./room-light";
import type { Corridor } from "./room-light";
import { useMotion } from "./Sequence";

/** The corridor of arches in each of the opening's two photographs (opening-media.ts), measured on the photograph. */
const CORRIDORS: Record<"wide" | "tall", Corridor> = {
  wide: { vp: [0.505, 0.47], box: [0.36, 0.42], floorAt: 0.585 },
  tall: { vp: [0.5, 0.45], box: [0.18, 0.4], floorAt: 0.555 },
};

/**
 * The room's daylight through water (room-light.ts), drawn in the room's plate over the photograph and under the word
 * on its wall, the floor's mist and the vials, so it moves with the room as the camera does. It is drawn while the
 * room can be seen; with motion off (the opening's switch, or the reader's setting) it holds still and is drawn again
 * only as the page scrolls. Each frame is announced on the opening ("tm-room-light"), so the liquid's water can take
 * it into what it bends.
 */
export function useRoomLight(section: RefObject<HTMLElement | null>, light: RefObject<HTMLCanvasElement | null>, tall: boolean, layout: unknown[]) {
  const moving = useMotion();
  useEffect(() => {
    const root = section.current, canvas = light.current;
    const photo = root?.querySelector<HTMLImageElement>("img.tm-room-still");
    if (!root || !canvas || !photo) return;
    const room = startRoomLight(canvas, photo, CORRIDORS[tall ? "tall" : "wide"], !moving, () => root.dispatchEvent(new Event("tm-room-light")));
    if (!room) return;
    let seen = false;
    const update = () => room.setActive(seen && !document.hidden);
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) seen = entry.isIntersecting;
      update();
    });
    watch.observe(canvas);
    const sized = new ResizeObserver(() => room.redraw());
    sized.observe(canvas);
    const scrolled = () => room.redraw();
    window.addEventListener("scroll", scrolled, { passive: true });
    document.addEventListener("visibilitychange", update);
    return () => {
      watch.disconnect();
      sized.disconnect();
      window.removeEventListener("scroll", scrolled);
      document.removeEventListener("visibilitychange", update);
      room.stop();
    };
    // The layout list names what lays the room out anew; the refs themselves never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...layout, tall, moving]);
}
