import { useEffect, useRef } from "react";
import { useMotion } from "./Sequence";
import { startWallLight } from "./wall-light";

/**
 * The window's light on the room's wall, behind the home page below the opening (wall-light.ts). It is drawn while
 * any of the page below the opening can be seen; when motion is off (the opening's switch, or the reader's setting)
 * it holds still and is drawn again only as the page scrolls or the window changes size.
 */
export function WallLight() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const moving = useMotion();
  useEffect(() => {
    const node = canvas.current;
    const home = node?.closest<HTMLElement>(".tm-home");
    if (!node || !home) return;
    const opening = home.querySelector<HTMLElement>(".tm-mist");
    let top = 0;
    const measure = () => {
      top = opening ? opening.getBoundingClientRect().bottom + window.scrollY : 0;
    };
    measure();
    const light = startWallLight(node, () => top, !moving);
    if (!light) return;
    const seen = new Set<Element>();
    // The wall is in sight below the header only: what lies under the header is the header's.
    const header = document.querySelector(".tm-header")?.getBoundingClientRect().bottom ?? 0;
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) seen.add(entry.target);
        else seen.delete(entry.target);
      }
      light.setActive(seen.size > 0);
      // With none of the wall in sight the light is put away (home.css): Safari reads a fixed layer at the screen's
      // foot as the colour under its toolbar, and keeps the one it first read, so at the page's end the footer's own
      // colour would never show there.
      node.toggleAttribute("data-off", seen.size === 0);
    }, { rootMargin: `${-Math.round(Math.max(0, header))}px 0px 0px 0px` });
    home.querySelectorAll(":scope > .tm:not(.tm-mist)").forEach((section) => watch.observe(section));
    const sized = new ResizeObserver(() => {
      measure();
      light.redraw();
    });
    if (opening) sized.observe(opening);
    const scrolled = () => light.redraw();
    if (!moving) window.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      watch.disconnect();
      sized.disconnect();
      window.removeEventListener("scroll", scrolled);
      light.stop();
    };
  }, [moving]);
  return <canvas className="tm-wall-light" ref={canvas} aria-hidden="true" />;
}
