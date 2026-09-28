import { useEffect, useId, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { categoryLabel } from "../export";
import type { Category } from "../types";
import { useAutosize } from "./bits";
import { Float } from "./Float";

const categories: Category[] = ["change", "missing", "question", "love"];

/** Write a note: the text, an optional category, Post. */
export function Composer({
  pinKey,
  what,
  onPost,
  onCancel,
}: {
  /** The draft pin it sits beside; none for a note about the whole page. */
  pinKey: string | null;
  /** What the note is about, in a word ("Heading", "This page"). */
  what: string;
  onPost: (body: string, category?: Category) => Promise<void>;
  onCancel: () => void;
}) {
  const id = useId();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category | undefined>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useAutosize(area, body);

  useEffect(() => {
    const timer = window.setTimeout(() => area.current?.focus({ preventScroll: true }), 30);
    return () => window.clearTimeout(timer);
  }, []);

  const text = body.trim();
  async function submit() {
    if (!text || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onPost(text, category);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <Float pinKey={pinKey} label={pinKey ? "New note" : "New note about this page"} className="rl-compose">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="rl-card-head">
          <p className="rl-eyebrow">
            New note <span className="rl-eyebrow-soft">· {what}</span>
          </p>
          <button type="button" className="rl-icon-btn" aria-label="Cancel this note" onClick={onCancel}>
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="rl-card-body">
          <label className="rl-sr" htmlFor={`${id}-note`}>
            Your note
          </label>
          <textarea
            ref={area}
            id={`${id}-note`}
            className="rl-textarea"
            placeholder="Write your note…"
            value={body}
            rows={3}
            maxLength={4000}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <div className="rl-chips" role="group" aria-label="Kind of note (optional)">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className="rl-chip"
                aria-pressed={category === c}
                onClick={() => setCategory(category === c ? undefined : c)}
              >
                {category === c && <Check size={12} strokeWidth={2} aria-hidden="true" />}
                {categoryLabel[c]}
              </button>
            ))}
          </div>
          {failed && (
            <p className="rl-error" role="alert">
              That didn’t post. Check the connection and try again.
            </p>
          )}
        </div>
        <div className="rl-card-foot">
          <button type="submit" className="rl-btn rl-btn-primary" disabled={!text || busy}>
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
    </Float>
  );
}
