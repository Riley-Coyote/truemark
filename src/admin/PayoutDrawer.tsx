import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer, EmptyState, Facts, formatMoney } from "../app-kit";
import { useResource } from "../platform/store";
import type { Payout } from "../platform/types";
import { live } from "../platform/live/runtime";
import { TextField } from "./fields";
import type { AwaitingLine } from "./program";

/** Records an external transfer; the server selects and totals the approved referrals. */
export function PayoutDrawer({ line, loading, error, onRetry, onClose, onSaved }: {
  line?: AwaitingLine; loading: boolean; error: Error | null; onRetry: () => void;
  onClose: () => void; onSaved: (payout: Payout) => void;
}) {
  const profile = useResource(() => live().auth.profile(), []);
  if ((loading && !line) || (profile.loading && !profile.data)) return <Drawer title="Record payout" onClose={onClose}><p className="kit-note" role="status">Loading the payout…</p></Drawer>;
  if (error || profile.error) return <Drawer title="Record payout" onClose={onClose}><EmptyState compact title="The payout could not be loaded." note={(error ?? profile.error)?.message} action={<Button onClick={() => { onRetry(); profile.reload(); }}>Try again</Button>} /></Drawer>;
  if (profile.data?.role !== "owner") return <Drawer title="Record payout" onClose={onClose}><p className="kit-note">Only the owner can record payouts.</p></Drawer>;
  if (!line) return <Drawer title="Record payout" onClose={onClose}><EmptyState compact title="Nothing waiting to be paid." note="This partner has no approved referrals awaiting payout." /></Drawer>;
  return <RecordTransfer key={line.partner.id} line={line} onClose={onClose} onSaved={onSaved} />;
}

function RecordTransfer({ line, onClose, onSaved }: { line: AwaitingLine; onClose: () => void; onSaved: (payout: Payout) => void }) {
  const formId = useId();
  const utcDay = (at: string) => new Date(at).toISOString().slice(0, 10);
  const dates = line.referrals.map((referral) => utcDay(referral.createdAt)).sort();
  const [start, setStart] = useState(dates[0]);
  const [end, setEnd] = useState(dates[dates.length - 1]);
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = line.referrals.filter((referral) => utcDay(referral.createdAt) >= start && utcDay(referral.createdAt) <= end);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!start || !end || end < start || !method.trim() || !reference.trim()) { setError("Enter the period, transfer method and reference."); return; }
    setBusy(true); setError("");
    try { onSaved(await live().owner.recordPayout(line.partner.id, start, end, method.trim(), reference.trim())); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The payout could not be recorded."); }
    finally { setBusy(false); }
  }
  return <Drawer title="Record payout" eyebrow={line.partner.name} subtitle={line.partner.code}
    onClose={() => { if (!busy) onClose(); }} footer={<div className="cc-confirm-actions">
      <Button variant="primary" type="submit" form={formId} disabled={busy || !selected.length || !method.trim() || !reference.trim() || !start || end < start}>{busy ? "Saving…" : "Record completed transfer"}</Button>
      <Button disabled={busy} onClick={onClose}>Cancel</Button>
    </div>}>
    <form id={formId} className="cc-form" onSubmit={save}>
      <p className="kit-note">Record a transfer you have already made. This action does not send money. The database calculates the final amount from approved referrals.</p>
      <Facts items={[{ label: "Partner", value: line.partner.name }]} />
      <div className="kit-grid">
        <div className="kit-span-6"><TextField label="Period start (UTC)" type="date" value={start} disabled={busy} onChange={setStart} /></div>
        <div className="kit-span-6"><TextField label="Period end (UTC)" type="date" value={end} min={start} disabled={busy} onChange={setEnd} /></div>
      </div>
      <TextField label="Transfer method" value={method} disabled={busy} onChange={setMethod} />
      <TextField label="Transfer reference" value={reference} disabled={busy} onChange={setReference} />
      <p className="kit-note">{selected.length} approved referrals · {formatMoney(selected.reduce((sum, referral) => sum + referral.commission, 0))}</p>
      {error && <p className="kit-field-error" role="alert">{error}</p>}
    </form>
  </Drawer>;
}
