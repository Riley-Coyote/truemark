import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { elementAt, kindOf } from "../anchor";
import { listen, spotBox, track } from "../tracker";

/** A hairline outline, drawn over the page (the page itself is never touched). */
export function Outline({ trackKey, tag, variant }: { trackKey: string; tag?: string; variant: "hover" | "picked" | "spot" }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    return listen(trackKey, (spot) => {
      if (!spot || !spot.visible) {
        node.dataset.hidden = "";
        return;
      }
      const { left, top, width, height } = spot.rect;
      node.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      node.style.width = `${Math.round(width)}px`;
      node.style.height = `${Math.round(height)}px`;
      // Too close to the top for the label to sit above the outline: tuck it inside.
      if (top < 72) node.dataset.low = "";
      else delete node.dataset.low;
      delete node.dataset.hidden;
    });
  }, [trackKey]);
  return (
    <div ref={ref} className="rl-outline" data-variant={variant} data-hidden="" aria-hidden="true">
      <span className="rl-corner rl-corner-tl" />
      <span className="rl-corner rl-corner-tr" />
      <span className="rl-corner rl-corner-bl" />
      <span className="rl-corner rl-corner-br" />
      {tag && <span className="rl-outline-tag">{tag}</span>}
    </div>
  );
}

/**
 * Comment mode: a crosshair over the whole page. The element under the pointer is
 * outlined; a click (or tap) picks it.
 */
export function CommentMode({
  phone,
  composing,
  onPick,
  onCancel,
}: {
  phone: boolean;
  composing: boolean;
  onPick: (target: Element, x: number, y: number) => void;
  onCancel: () => void;
}) {
  const hovered = useRef<Element | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const [tag, setTag] = useState<string | undefined>();

  useEffect(() => track("hover", () => spotBox(hovered.current)), []);

  useEffect(() => {
    // The page scrolls under a still pointer: keep outlining what is under it now.
    const onScroll = () => {
      if (!pointer.current) return;
      const el = elementAt(pointer.current.x, pointer.current.y);
      if (el !== hovered.current) {
        hovered.current = el;
        setTag(el ? kindOf(el) : undefined);
      }
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  function move(x: number, y: number) {
    pointer.current = { x, y };
    const el = elementAt(x, y);
    if (el !== hovered.current) {
      hovered.current = el;
      setTag(el ? kindOf(el) : undefined);
    }
  }

  return (
    <>
      <div
        className="rl-catcher"
        aria-hidden="true"
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || event.pointerType === "pen") move(event.clientX, event.clientY);
        }}
        onPointerLeave={() => {
          pointer.current = null;
          hovered.current = null;
          setTag(undefined);
        }}
        onClick={(event) => {
          const el = elementAt(event.clientX, event.clientY);
          if (el) onPick(el, event.clientX, event.clientY);
        }}
      />
      {!phone && <Outline trackKey="hover" tag={tag} variant="hover" />}
      {!composing && (
        <div className="rl-hint" role="status">
          {phone ? (
            <>
              <span>Tap anything to leave a note</span>
              <button type="button" className="rl-hint-btn" onClick={onCancel}>
                Cancel
              </button>
            </>
          ) : (
            <span>
              Click anything to leave a note · <kbd className="rl-kbd rl-kbd-inline">Esc</kbd> to cancel
            </span>
          )}
        </div>
      )}
    </>
  );
}
