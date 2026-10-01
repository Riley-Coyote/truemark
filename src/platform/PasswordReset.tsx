import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../app-kit";
import { LIVE } from "./mode";
import { live } from "./live/runtime";
import { PREVIEW_RESET } from "./accounts";
import type { RecoveryGate } from "./accounts";

const subscribe = LIVE ? (listener: () => void) => live().auth.subscribeRecovery(listener) : () => () => {};
const snapshot = LIVE ? () => live().auth.recovery() : () => null;
export const useRecovery = () => useSyncExternalStore(subscribe, snapshot, () => null);

/** One flow, in the field and button language of the gate that requested it. */
export function PasswordReset({ gate, email: initialEmail = "", onBack }: { gate: RecoveryGate; email?: string; onBack: () => void }) {
  const recovery = useRecovery();
  const settingPassword = Boolean(recovery?.userId);
  const navigate = useNavigate();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const team = gate === "team";
  const partner = gate === "partner";
  const field = team ? "kit-field" : partner ? "pp-field" : "tm-field";
  const note = team ? "cc-gate-note" : partner ? "pp-preview-note" : "tm-gate-sub";
  useEffect(() => {
    // A recovery event can arrive in the tab still showing the request receipt.
    setMessage(""); setError(""); setPassword(""); setConfirmation("");
    heading.current?.focus();
  }, [recovery?.userId]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (LIVE) {
        if (settingPassword) navigate(await live().auth.setNewPassword(password, confirmation), { replace: true });
        else setMessage(await live().auth.requestPasswordReset(email, gate));
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please try again.");
    } finally { setBusy(false); }
  }
  const input = (label: string, name: string, value: string, change: (value: string) => void, type: "email" | "password", readOnly = false) => {
    const control = <input id={`${id}-${name}`} name={name} type={type} autoComplete={type === "password" ? "new-password" : "username"}
      className={team ? "cc-input" : undefined} value={value} onChange={(event) => change(event.target.value)}
      minLength={type === "password" ? 10 : undefined} required disabled={busy} readOnly={readOnly}
      aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />;
    const caption = <label className={team ? "kit-field-label" : undefined} htmlFor={`${id}-${name}`}>{label}</label>;
    return <div className={field}>{!team && !partner ? <div className="tm-field-top">{caption}</div> : caption}
      {team ? <div className="cc-control">{control}</div> : control}</div>;
  };
  return <>
    <h2 className={team ? "cc-gate-title" : partner ? "tm-heading" : "tm-gate-heading"} ref={heading} tabIndex={-1}>
      {settingPassword ? "Set a new password" : "Reset your password"}
    </h2>
    {!LIVE ? <p className={note} role="status">{PREVIEW_RESET}</p> : message && !settingPassword ? <p className={note} role="status">{message}</p> : <>
      <p className={note}>{settingPassword ? "Choose a password of at least 10 characters." : "Enter the email you use to sign in."}</p>
      {recovery?.error && <p className={note} role="alert">{recovery.error}</p>}
      <form className={team ? "cc-gate-form" : partner ? "pp-signin-form" : undefined} onSubmit={submit}>
        {settingPassword ? <>
          {recovery?.email && input("Email", "email", recovery.email, () => {}, "email", true)}
          {input("New password", "new-password", password, setPassword, "password")}
          {input("Confirm new password", "confirm-password", confirmation, setConfirmation, "password")}
        </> : input("Email", "email", email, setEmail, "email")}
        {error && <p className={team ? "kit-field-error" : partner ? "pp-field-error" : "tm-field-error"} id={`${id}-error`} role="alert">{error}</p>}
        {team ? <Button type="submit" variant="primary" disabled={busy}>{busy ? "One moment…" : settingPassword ? "Save password" : "Send reset link"}</Button>
          : <button type="submit" className="tm-button tm-button-primary" disabled={busy}>{busy ? "One moment…" : settingPassword ? "Save password" : "Send reset link"}</button>}
      </form>
    </>}
    {!settingPassword && <p className={note}>{team ? <Button variant="text" onClick={() => { if (LIVE) live().auth.dismissRecoveryError(); onBack(); }} disabled={busy}>Back to sign in</Button>
      : <button type="button" className={partner ? "tm-textlink" : "tm-gate-link"} onClick={() => { if (LIVE) live().auth.dismissRecoveryError(); onBack(); }} disabled={busy}>Back to sign in</button>}</p>}
  </>;
}
