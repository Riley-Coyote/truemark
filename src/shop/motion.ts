import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** Whether a media query matches now, kept current as it changes. */
export function useMediaQuery(query: string): boolean {
  // Server rendering and lean test windows have no matchMedia; the query then reads as false.
  const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() => supported() && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported()) return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * Marks `[data-reveal]` descendants of `root` visible as they enter the
 * viewport, including ones that mount later (a live record, a lookup result).
 * CSS owns the motion; reduced-motion users get the end state.
 */
export function useReveal(root: RefObject<HTMLElement | null>, key: unknown = null) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const pending = () => scope.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)");
    const io = "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries, observer) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
              }
            }
          },
          { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
        )
      : null;
    // Observing an element twice is a no-op, so every arrival can simply re-scan.
    const watch = () => pending().forEach((el) => (io ? io.observe(el) : el.classList.add("is-visible")));
    watch();
    const arrivals = new MutationObserver(watch);
    arrivals.observe(scope, { childList: true, subtree: true });
    return () => {
      arrivals.disconnect();
      io?.disconnect();
    };
  }, [root, key]);
}
