import { useEffect, useState } from "react";

/**
 * How far the review site's dock, and the question it raises above itself, reach up from the
 * bottom of the screen, so a bar pinned to the bottom (the added-to-bag bar, the offer card) sits
 * above them rather than under them. Measured without touching the dock's own layout; zero
 * outside the review site.
 */
export function useReviewDockRoom(active: boolean) {
  const [room, setRoom] = useState(0);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const docks = document.querySelectorAll<HTMLElement>(".rl-dock, .rl-dock-pill, .rl-ask");
      setRoom(Array.from(docks).reduce((max, dock) => {
        const rect = dock.getBoundingClientRect();
        return rect.height && getComputedStyle(dock).visibility !== "hidden" ? Math.max(max, window.innerHeight - rect.top) : max;
      }, 0));
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "data-drawer"] });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active]);
  return room;
}
