import { useEffect, useId, useRef, useState } from "react";
import type { Identity } from "../types";
import { useFocusReturn, usePhone } from "./bits";

/** Who is reviewing: asked once, the first time anyone opens the layer. */
export function Welcome({
  current,
  notice = null,
  onDone,
  onClose,
}: {
  /** Set when changing an existing name. */
  current: Identity | null;
  /** Why notes will stay on this device, when the build could share them. */
  notice?: string | null;
  onDone: (name: string, role: string) => void;
  onClose: () => void;
}) {
  const id = useId();
  const phone = usePhone();
  const panel = useRef<HTMLDivElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(current?.name ?? "");
  const [role, setRole] = useState(current?.role ?? "");
  const [tried, setTried] = useState(false);
  useFocusReturn(panel);

  useEffect(() => {
    const timer = window.setTimeout(() => nameField.current?.focus({ preventScroll: true }), 40);
    return () => window.clearTimeout(timer);
  }, []);

  // A modal: Tab stays inside it.
  useEffect(() => {
    const root = panel.current;
    if (!root) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = Array.from(root.querySelectorAll<HTMLElement>("input, button:not([disabled])"));
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, []);

  const missing = !name.trim();
  const editing = Boolean(current);

  return (
    <>
      <div className="rl-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={`rl-welcome ${phone ? "rl-welcome-sheet" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={editing ? undefined : `${id}-lead`}
      >
        <p className="rl-eyebrow">TrueMark · Design review</p>
        <h2 id={`${id}-title`} className="rl-welcome-title">
          {editing ? "Your name on notes" : "Welcome to the TrueMark review"}
        </h2>
        {!editing && (
          <p id={`${id}-lead`} className="rl-welcome-lead">
            Leave a note anywhere, answer Riley’s questions, and he’ll see everything.
          </p>
        )}
        {notice && <p className="rl-notice rl-welcome-notice">{notice}</p>}
        <form
          className="rl-welcome-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setTried(true);
            if (!missing) onDone(name.trim(), role.trim());
          }}
        >
          <div className="rl-field">
            <label className="rl-label" htmlFor={`${id}-name`}>
              Name
            </label>
            <input
              ref={nameField}
              id={`${id}-name`}
              className="rl-input"
              autoComplete="name"
              value={name}
              maxLength={80}
              aria-invalid={tried && missing ? true : undefined}
              aria-describedby={tried && missing ? `${id}-name-error` : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {tried && missing && (
              <p id={`${id}-name-error`} className="rl-field-error">
                Add your name so Riley knows who wrote each note.
              </p>
            )}
          </div>
          <div className="rl-field">
            <label className="rl-label" htmlFor={`${id}-role`}>
              Company or role <span className="rl-label-soft">optional</span>
            </label>
            <input
              id={`${id}-role`}
              className="rl-input"
              autoComplete="organization"
              value={role}
              maxLength={80}
              onChange={(event) => setRole(event.target.value)}
            />
          </div>
          <div className="rl-welcome-actions">
            <button type="button" className="rl-btn rl-btn-ghost" onClick={onClose}>
              {editing ? "Cancel" : "Not now"}
            </button>
            <button type="submit" className="rl-btn rl-btn-primary">
              {editing ? "Save" : "Start reviewing"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
