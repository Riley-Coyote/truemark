import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { listen, spotOf } from "../tracker";
import type { Spot } from "../tracker";
import { useFocusReturn, usePhone } from "./bits";

const MARGIN = 16;
const GAP = 20;
/** Room kept free above the dock. */
const DOCK_ROOM = 76;

/** Beside the pin: to its right when there is room, else to its left; always inside the window. */
function place(node: HTMLElement, spot: Spot | null) {
  const top = document.querySelector(".review-nav")?.getBoundingClientRect().bottom ?? 0;
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  // With the notes drawer open, cards keep to the page beside it.
  const vw = document.querySelector(".rl-drawer")?.getBoundingClientRect().left ?? window.innerWidth;
  const vh = window.innerHeight;
  let left: number;
  let y: number;
  if (spot) {
    left = spot.x + GAP;
    if (left + w > vw - MARGIN) left = spot.x - GAP - w;
    if (left < MARGIN) left = Math.min(Math.max(MARGIN, spot.x - w / 2), vw - w - MARGIN);
    y = spot.y - 28;
  } else {
    left = vw - w - MARGIN;
    y = top + MARGIN;
  }
  const maxTop = Math.max(top + MARGIN, vh - h - DOCK_ROOM);
  y = Math.min(Math.max(y, top + MARGIN), maxTop);
  // `translate` composes with the entrance `scale` without moving the card.
  node.style.translate = `${Math.round(left)}px ${Math.round(y)}px`;
}

/**
 * A surface for a composer, thread or question: a card that follows its pin on larger
 * screens, a card docked at the top right when it has no pin, and a bottom sheet on phones.
 */
export function Float({
  pinKey,
  label,
  className = "",
  children,
}: {
  /** The tracked pin to sit beside; none docks the card. */
  pinKey?: string | null;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const phone = usePhone();
  useFocusReturn(ref);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || phone) return;
    let last: Spot | null = pinKey ? spotOf(pinKey) : null;
    place(node, last);
    const stop = pinKey
      ? listen(pinKey, (spot) => {
          if (spot) last = spot;
          place(node, last);
        })
      : () => {};
    const resize = new ResizeObserver(() => place(node, last));
    resize.observe(node);
    const onResize = () => place(node, last);
    window.addEventListener("resize", onResize);
    return () => {
      stop();
      resize.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [pinKey, phone]);

  return (
    <div
      ref={ref}
      className={`${phone ? "rl-sheet" : "rl-pop"} ${className}`}
      role="dialog"
      aria-modal="false"
      aria-label={label}
      data-docked={!phone && !pinKey ? "" : undefined}
    >
      {children}
    </div>
  );
}
