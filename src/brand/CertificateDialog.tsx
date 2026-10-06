import { useId, useRef } from "react";
import { X } from "lucide-react";
import type { LotRecord } from "../shop/records";
import { SheetSkirt, useScrollLock, useSheetDrag, useSheetFocus, useSheetPresence, useVisibleViewport, viewportBox } from "../shop/sheet";
import { CertificateView } from "./CertificateView";
import "./certificate-dialog.css";

/** The modal layer the shop's dialogs share (styles.css, .modal-backdrop). */
const DIALOG_LAYER = 100;

/**
 * A lot's certificate, opened in place: a dialog over the dimmed page on a wide screen, a tall sheet
 * on a phone, pulled down by its top. The lot's own page and the laboratory's PDF are inside it.
 */
export function CertificateDialog({ record, onClose }: { record: LotRecord; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const titleId = useId();
  const seen = useVisibleViewport();
  const { state, requestClose } = useSheetPresence(onClose);
  useScrollLock();
  useSheetFocus(panel, requestClose, "never");
  const drag = useSheetDrag(panel, requestClose, (target) => Boolean(target.closest(".tm-certdlg-grab, .tm-cert-head")));
  return (
    <>
      <div
        className="tm-certdlg"
        data-state={state}
        style={viewportBox(seen, "tm-sheet")}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <section ref={panel} className="tm tm-certdlg-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} {...drag}>
          <span className="tm-certdlg-grab" aria-hidden="true" />
          <div className="tm-certdlg-scroll">
            <CertificateView record={record} pageLink onLeave={onClose} titleId={titleId} />
          </div>
          <button type="button" className="tm-certdlg-close" aria-label="Close" onClick={requestClose}>
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </section>
      </div>
      <SheetSkirt seen={seen} state={state} layer={DIALOG_LAYER} />
    </>
  );
}
