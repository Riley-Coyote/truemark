import { useId, useRef, useState } from "react";
import { Check, Link2, RotateCcw, X } from "lucide-react";
import { categoryLabel } from "../export";
import type { Note } from "../types";
import { AuthorLine, Body, copyText, useAutosize } from "./bits";
import { Float } from "./Float";

/** A note and its replies: reply, resolve or reopen, and copy a link that opens it. */
export function Thread({
  root,
  replies,
  number,
  pinKey,
  moved,
  now,
  link,
  onReply,
  onStatus,
  onClose,
}: {
  root: Note;
  replies: Note[];
  number: number | null;
  pinKey: string | null;
  moved: boolean;
  now: number;
  link: string;
  onReply: (body: string) => Promise<void>;
  onStatus: (status: "open" | "resolved") => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useAutosize(area, reply);
  const resolved = root.status === "resolved";
  const title = number ? `Note ${number}` : root.kind === "page" ? "Note about this page" : "Note";

  async function send() {
    const text = reply.trim();
    if (!text || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onReply(text);
      setReply("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Float pinKey={pinKey} label={`${title} by ${root.author.name}`} className="rl-thread">
      <div className="rl-card-head">
        <p className="rl-eyebrow">
          {title}
          {root.category && <span className="rl-eyebrow-soft">· {categoryLabel[root.category]}</span>}
          {resolved && <span className="rl-eyebrow-soft">· Resolved</span>}
        </p>
        <button type="button" className="rl-icon-btn" aria-label="Close" onClick={onClose}>
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {moved && (
        <div className="rl-moved">
          <p className="rl-moved-title">Its spot has moved</p>
          {root.anchor?.text && <p className="rl-moved-text">It was left on “{root.anchor.text}”</p>}
        </div>
      )}

      <div className="rl-messages">
        <article className="rl-msg">
          <AuthorLine author={root.author} iso={root.createdAt} now={now} />
          <Body text={root.body} />
        </article>
        {replies.map((r) => (
          <article key={r.id} className="rl-msg">
            <AuthorLine author={r.author} iso={r.createdAt} now={now} />
            <Body text={r.body} />
          </article>
        ))}
        {resolved && root.resolvedBy && (
          <p className="rl-resolved-line">
            <Check size={14} strokeWidth={1.75} aria-hidden="true" /> Resolved by {root.resolvedBy}
          </p>
        )}
      </div>

      <form
        className="rl-reply"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="rl-sr" htmlFor={`${id}-reply`}>
          Reply
        </label>
        <textarea
          ref={area}
          id={`${id}-reply`}
          className="rl-textarea rl-textarea-compact"
          placeholder="Reply…"
          rows={1}
          maxLength={4000}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {failed && (
          <p className="rl-error" role="alert">
            That didn’t send. Try again.
          </p>
        )}
        <div className="rl-card-foot rl-card-foot-split">
          <div className="rl-actions">
            <button type="button" className="rl-btn rl-btn-ghost" onClick={() => void onStatus(resolved ? "open" : "resolved")}>
              {resolved ? (
                <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Check size={14} strokeWidth={1.75} aria-hidden="true" />
              )}
              {resolved ? "Reopen" : "Resolve"}
            </button>
            <button
              type="button"
              className="rl-btn rl-btn-ghost"
              onClick={async () => {
                if (await copyText(link)) {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              <Link2 size={14} strokeWidth={1.75} aria-hidden="true" />
              <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
            </button>
          </div>
          <button type="submit" className="rl-btn rl-btn-primary" disabled={!reply.trim() || busy}>
            Reply
          </button>
        </div>
      </form>
    </Float>
  );
}
