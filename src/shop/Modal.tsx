import { useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { SheetSkirt, useScrollLock, useSheetDrag, useSheetFocus, useSheetPresence, useVisibleViewport, viewportBox } from "./sheet";

/** The dialogs' layer (styles.css, .modal-backdrop); their strip of paper lies one beneath. */
const MODAL_LAYER = 100;

/**
 * An accessible dialog with a focus trap: a centred dialog on wider screens, or with `side` a
 * panel at the right edge; on a phone either is a sheet risen from the bottom (sheet.tsx), which
 * follows the keyboard and can be pulled down by its top. `field` says whether opening lands in
 * the first field: "always" for search, where typing is the point; "fine" only with a mouse and
 * keyboard, so a phone's keyboard never rises unasked; "never" for the bag, whose fields are
 * quantities to adjust, not to start typing in. Otherwise the dialog itself takes focus.
 */
export function Modal({
  children,
  title,
  onClose,
  side = false,
  field = "fine",
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  side?: boolean;
  field?: "always" | "fine" | "never";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const seen = useVisibleViewport();
  const { state, requestClose } = useSheetPresence(onClose);
  useScrollLock();
  useSheetFocus(panel, requestClose, field);
  const drag = useSheetDrag(panel, requestClose, (target) => Boolean(target.closest(".modal-grab, .modal-heading h2")));
  return (
    <>
      <div
        className={`modal-backdrop ${side ? "side-modal" : ""}`}
        data-state={state}
        style={viewportBox(seen, "tm-sheet")}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <div
          className="modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={panel}
          tabIndex={-1}
          {...drag}
        >
          <span className="modal-grab" aria-hidden="true" />
          <div className="modal-heading">
            <h2 id={titleId}>{title}</h2>
            <button className="icon-button" aria-label="Close dialog" onClick={requestClose}>
              <X size={22} />
            </button>
          </div>
          {children}
        </div>
      </div>
      <SheetSkirt seen={seen} state={state} layer={MODAL_LAYER} />
    </>
  );
}
