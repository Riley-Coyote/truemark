import { useLayoutEffect, useRef } from "react";
import { listen } from "../tracker";

/** Half the 24px disc (--rl-pin-half): the pin is centred on its spot. */
const PIN_HALF = 12;

export type PinView = {
  key: string;
  /** The number, or "?" for a question. */
  mark: string;
  label: string;
  kind: "note" | "question" | "draft";
  unread: boolean;
  resolved: boolean;
  open: boolean;
  fresh: boolean;
  onOpen?: () => void;
};

/** A 24px disc that follows its spot on the page. */
function Pin({ pin }: { pin: PinView }) {
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    return listen(pin.key, (spot) => {
      if (!spot) {
        node.dataset.hidden = "";
        return;
      }
      // `translate`, not `transform`: the hover `scale` then grows the disc in place
      // instead of scaling its distance from the corner of the window.
      node.style.translate = `${Math.round(spot.x - PIN_HALF)}px ${Math.round(spot.y - PIN_HALF)}px`;
      if (spot.visible) delete node.dataset.hidden;
      else node.dataset.hidden = "";
    });
  }, [pin.key]);

  return (
    <button
      ref={ref}
      type="button"
      className="rl-pin"
      data-kind={pin.kind}
      data-hidden=""
      data-open={pin.open || undefined}
      data-resolved={pin.resolved || undefined}
      data-fresh={pin.fresh || undefined}
      aria-label={pin.label}
      aria-expanded={pin.kind === "draft" ? undefined : pin.open}
      tabIndex={pin.kind === "draft" ? -1 : 0}
      onClick={pin.onOpen}
    >
      <span className="rl-pin-mark" aria-hidden="true">
        {pin.mark}
      </span>
      {pin.unread && <span className="rl-pin-dot" aria-hidden="true" />}
    </button>
  );
}

export function Pins({ pins }: { pins: PinView[] }) {
  return (
    <div className="rl-pins">
      {pins.map((pin) => (
        <Pin key={pin.key} pin={pin} />
      ))}
    </div>
  );
}
