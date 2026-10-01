import { useState } from "react";
import type { FormEvent } from "react";
import { Button, EmptyState, Section, Select, formatMoney } from "../../app-kit";
import { TextField } from "../../admin/fields";
import { store, useResource } from "../store";
import { approvalCutoff } from "./adapter";
import { live } from "./runtime";

/** A record of money already transferred; the RPC never initiates a payment. */
export function OwnerPayments() {
  const profile = useResource(() => live().auth.profile(), []);
  const partners = useResource(() => store.partners.list(), []);
  const referrals = useResource(() => store.partners.referrals(), []);
  const [partnerId, setPartnerId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (profile.loading) return <p className="kit-note" role="status">Checking payout access…</p>;
  if (profile.data?.role !== "owner") return <p className="kit-note">Only the owner can approve commissions and record payouts.</p>;
  if (partners.error || referrals.error) return <EmptyState compact title="Commissions could not be loaded." note={(partners.error ?? referrals.error)?.message} action={<Button onClick={() => { partners.reload(); referrals.reload(); }}>Try again</Button>} />;
  const eligible = referrals.data?.filter((referral) => referral.partnerId === partnerId && referral.status === "approved" && referral.createdAt.slice(0, 10) >= start && referral.createdAt.slice(0, 10) <= end) ?? [];
  async function approve() {
    setBusy(true); setError(""); setMessage("");
    try { const count = await live().owner.approveCommissions(); setMessage(`${count} ${count === 1 ? "commission" : "commissions"} approved.`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Approval could not be saved."); }
    finally { setBusy(false); }
  }
  async function record(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payout = await live().owner.recordPayout(partnerId, start, end, method.trim(), note.trim() || undefined);
      setMessage(`Recorded ${formatMoney(payout.amount)} for ${payout.referrals} ${payout.referrals === 1 ? "referral" : "referrals"}.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The payout could not be recorded."); }
    finally { setBusy(false); }
  }
  return <>
    <Section title="Approve commissions">
      <p className="kit-note">Captured orders before {approvalCutoff()} UTC have completed the 14-day holding period.</p>
      <Button disabled={busy} onClick={approve}>Approve eligible commissions</Button>
    </Section>
    <Section title="Record a payout">
      <p className="kit-note">Record a transfer you have already made. This action does not send money. The database calculates the final amount from approved referrals.</p>
      <form onSubmit={record}>
        <Select label="Partner" value={partnerId} disabled={busy || partners.loading} onChange={setPartnerId} options={[
          { value: "", label: "Choose a partner" }, ...(partners.data ?? []).map((partner) => ({ value: partner.id, label: `${partner.name} · ${partner.code}` })),
        ]} />
        <TextField label="Period start (UTC)" type="date" value={start} disabled={busy} onChange={setStart} />
        <TextField label="Period end (UTC)" type="date" value={end} min={start} disabled={busy} onChange={setEnd} />
        <TextField label="Transfer method" value={method} disabled={busy} onChange={setMethod} />
        <TextField label="Transfer reference or note" value={note} disabled={busy} onChange={setNote} />
        <p className="kit-note">{eligible.length} approved referrals · {formatMoney(eligible.reduce((total, referral) => total + referral.commission, 0))}</p>
        <Button variant="primary" type="submit" disabled={busy || !eligible.length || !method.trim() || !start || end < start}>{busy ? "Saving…" : "Record completed transfer"}</Button>
      </form>
    </Section>
    <p className="kit-note" role="status">{message}</p>
    {error && <p className="kit-note" role="alert">{error}</p>}
  </>;
}
