import { useState } from "react";
import { Button } from "../../app-kit";
import { useResource } from "../store";
import { approvalCutoff } from "./adapter";
import { live } from "./runtime";

/** The Payouts view's owner action. Transfers are recorded in its per-partner drawer. */
export function ApproveCommissions({ onSaved }: { onSaved: () => void }) {
  const profile = useResource(() => live().auth.profile(), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function approve() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const count = await live().owner.approveCommissions();
      setMessage(`${count} ${count === 1 ? "commission" : "commissions"} approved.`); onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Approval could not be saved."); }
    finally { setBusy(false); }
  }
  return <div className="kit-span-12 cc-form">
    <p className="kit-note">Captured orders before {approvalCutoff()} UTC have completed the 14-day holding period.</p>
    {profile.error ? <p className="kit-note" role="alert">{profile.error.message} <Button onClick={profile.reload}>Try again</Button></p>
      : profile.loading ? <p className="kit-note" role="status">Checking payout access…</p>
      : profile.data?.role === "owner" ? <div className="cc-confirm-actions"><Button variant="primary" disabled={busy} onClick={approve}>{busy ? "Approving…" : "Approve eligible commissions"}</Button></div>
      : <p className="kit-note">Only the owner can approve commissions and record payouts.</p>}
    {message && <p className="kit-note" role="status">{message}</p>}
    {error && <p className="kit-field-error" role="alert">{error}</p>}
  </div>;
}
