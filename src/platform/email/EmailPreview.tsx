import type { ReactNode } from "react";
import { BrandLogo } from "../../BrandLogo";
import "./email.css";

/**
 * How an email or text message from TrueMark will look, shown inside the app.
 * These are previews: sending arrives with the backend. Content components
 * (EmailHeading, EmailFigure, EmailRows, EmailButton, EmailNote) compose the body.
 */
export function EmailPreview({
  from = "TrueMark BioLabs <orders@truemarkbiolabs.com>",
  to,
  subject,
  preheader,
  footer,
  children,
}: {
  from?: string;
  to: string;
  subject: string;
  /** The line an inbox shows after the subject. */
  preheader?: string;
  /** Why the reader receives this, e.g. "You're a TrueMark partner." */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="tm-email" aria-label={`Email preview: ${subject}`}>
      <dl className="tm-email-meta">
        <div>
          <dt>From</dt>
          <dd>{from}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{to}</dd>
        </div>
        <div>
          <dt>Subject</dt>
          <dd className="tm-email-subject">{subject}</dd>
        </div>
        {preheader && (
          <div>
            <dt>Preview</dt>
            <dd className="tm-email-preheader">{preheader}</dd>
          </div>
        )}
      </dl>
      <div className="tm-email-canvas">
        <article className="tm-email-body">
          <header className="tm-email-head">
            <BrandLogo />
          </header>
          <div className="tm-email-content">{children}</div>
          <footer className="tm-email-foot">
            {footer && <p>{footer}</p>}
            <p>For research use only. Not for human consumption.</p>
            <p>TrueMark BioLabs</p>
          </footer>
        </article>
      </div>
    </figure>
  );
}

export function EmailHeading({ children }: { children: ReactNode }) {
  return <h2 className="tm-email-heading">{children}</h2>;
}

/** A designed number: an amount earned, an order total. */
export function EmailFigure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="tm-email-figure">
      <p className="tm-email-label">{label}</p>
      <p className="tm-email-value">{value}</p>
      {note && <p className="tm-email-figure-note">{note}</p>}
    </div>
  );
}

export function EmailRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="tm-email-rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A call to action. In a preview it is not a link; it names where it will lead. */
export function EmailButton({ children }: { children: ReactNode }) {
  return <span className="tm-email-button">{children}</span>;
}

export function EmailNote({ children }: { children: ReactNode }) {
  return <p className="tm-email-note">{children}</p>;
}

export function EmailText({ children }: { children: ReactNode }) {
  return <p className="tm-email-text">{children}</p>;
}

/** A text message as it arrives on a phone. */
export function SmsPreview({ to, message }: { to: string; message: string }) {
  return (
    <figure className="tm-sms" aria-label="Text message preview">
      <p className="tm-sms-meta">
        Text message to <span>{to}</span>
      </p>
      <div className="tm-sms-thread">
        <p className="tm-sms-sender">TrueMark</p>
        <p className="tm-sms-bubble">{message}</p>
      </div>
      <p className="tm-sms-count">
        {message.length} characters · {Math.ceil(message.length / 160) === 1 ? "one message" : `${Math.ceil(message.length / 160)} messages`}
      </p>
    </figure>
  );
}
