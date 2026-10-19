import { useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { Check } from "lucide-react";
import { disclaimer } from "../brand/policies";
import { useRecovery } from "../platform/PasswordReset";
import { usePresence } from "./motion";
import { useScrollLock, useSheetFocus } from "./sheet";
import { confirmResearcher, confirmationExempt, useResearcherConfirmed } from "./researcher";
import "./researcher-check.css";

/** The client's wording, word for word; the disclaimer itself is kept with the legal pages. */
export const DISCLAIMER = disclaimer;
const STATEMENTS = [
  "I am at least 21 years of age.",
  "I am a qualified researcher purchasing for in vitro or laboratory research only, not for human or veterinary use.",
] as const;
/** Leaving the site: a plain link out. */
const EXIT_URL = "https://www.google.com";

/**
 * The first visit's researcher verification: a card over the dimmed page that stays until both statements are
 * confirmed or the visitor leaves. Escape does nothing, focus stays in the card and the page behind holds still.
 * Remembered for CONFIRMATION_DAYS (researcher.ts). The first-order offer waits for it (FirstOrderOffer.tsx).
 */
export function ResearcherCheck() {
  const { pathname } = useLocation();
  const confirmed = useResearcherConfirmed();
  // A password being reset from its email link is finished first.
  const recovering = Boolean(useRecovery());
  // Kept here, so a visitor who reads the Terms from the card finds their ticks as they left them.
  const [ticked, setTicked] = useState<[boolean, boolean]>([false, false]);
  const [reading, setReading] = useState(false);
  const open = !confirmed && !recovering && !confirmationExempt(pathname);
  const presence = usePresence<HTMLDivElement>(open, pathname);
  if (!presence.shown || typeof document === "undefined") return null;
  return createPortal(
    <ResearcherCheckCard ticked={ticked} onTick={setTicked} reading={reading} onRead={setReading} closing={presence.closing} exit={presence.exit} />,
    document.body,
  );
}

/** The card itself, drawn by ResearcherCheck (and on its own by the markup tests). */
export function ResearcherCheckCard({ ticked, onTick, reading, onRead, closing, exit }: {
  ticked: [boolean, boolean];
  onTick: (ticked: [boolean, boolean]) => void;
  reading: boolean;
  onRead: (reading: boolean) => void;
  closing: boolean;
  exit: RefObject<HTMLDivElement | null>;
}) {
  const panel = useRef<HTMLElement>(null);
  const id = useId();
  const count = ticked.filter(Boolean).length;
  useScrollLock();
  // Escape is not a way out: the card asks for a confirmation or the exit.
  useSheetFocus(panel, () => undefined, "never", closing);
  return (
    <div ref={exit} className="tm-entry" data-state={closing ? "closing" : undefined} inert={closing}>
      <section
        ref={panel}
        className="tm tm-entry-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-lead`}
        tabIndex={-1}
        data-review="researcher-check"
      >
        <div className="tm-entry-meta">
          <p className="tm-entry-eyebrow">Research use only</p>
          <p id={`${id}-count`} className="tm-entry-count" role="status">
            {count} of 2 confirmed
          </p>
        </div>
        <h2 id={`${id}-title`} className="tm-entry-title">Researcher verification</h2>
        <p id={`${id}-lead`} className="tm-entry-lead">
          TrueMark supplies research peptides exclusively for in vitro and laboratory research. Confirm both statements to continue.
        </p>
        <div className="tm-entry-checks">
          {STATEMENTS.map((statement, index) => (
            <label key={statement} className="tm-entry-check">
              <input
                type="checkbox"
                className="tm-entry-input"
                checked={ticked[index]}
                aria-labelledby={`${id}-statement-${index}`}
                onChange={(event) => {
                  const next: [boolean, boolean] = [...ticked];
                  next[index] = event.target.checked;
                  onTick(next);
                }}
              />
              <span className="tm-entry-box" aria-hidden="true">
                <Check size={14} strokeWidth={2.2} />
              </span>
              <span id={`${id}-statement-${index}`} className="tm-entry-statement">{statement}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="tm-button tm-button-primary tm-entry-enter"
          disabled={count < 2}
          aria-describedby={`${id}-count`}
          onClick={() => confirmResearcher()}
        >
          Enter TrueMark
        </button>
        <button
          type="button"
          className="tm-entry-toggle"
          aria-expanded={reading}
          aria-controls={`${id}-disclaimer`}
          onClick={() => onRead(!reading)}
        >
          {reading ? "Hide disclaimer" : "Show disclaimer"}
        </button>
        <div id={`${id}-disclaimer`} className="tm-entry-disclaimer" role="region" aria-label="Disclaimer" tabIndex={0} hidden={!reading}>
          {DISCLAIMER.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <p className="tm-entry-links">
            <Link to="/disclaimer">Disclaimer</Link>
            <Link to="/terms">Terms of Service</Link>
          </p>
        </div>
        <p className="tm-entry-exit">
          Not a researcher? <a href={EXIT_URL} rel="noreferrer">Exit</a>
        </p>
      </section>
    </div>
  );
}
