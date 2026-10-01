import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button, DataTable, Drawer, Facts, Section, StatusChip, TextAreaField, formatDate } from "../app-kit";
import type { Column } from "../app-kit";
import { useResource } from "../platform/store";
import { live } from "../platform/live/runtime";
import { suggestPartnerCode } from "../platform/accounts";
import type { PartnerApplication } from "../platform/accounts";
import { commitments } from "../partners/program";
import { TextField } from "./fields";
import { matches } from "./state";

const columns: Column<PartnerApplication>[] = [
  { key: "name", header: "Name", mobile: "primary", sortValue: (row) => row.name, cell: (row) => row.name },
  { key: "channel", header: "Channel", mobile: "secondary", cell: (row) => row.channel },
  { key: "audience", header: "Audience", mobile: "meta", cell: (row) => row.audience },
  { key: "submitted", header: "Submitted", mobile: "meta", sortValue: (row) => row.submittedAt, cell: (row) => formatDate(row.submittedAt) },
  { key: "status", header: "Status", mobile: "aside", cell: (row) => <StatusChip status={row.status} /> },
];

export function PartnerApplications({ query }: { query: string }) {
  const applications = useResource(() => live().partnerApplications.list(), []);
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => applications.data?.filter((row) => matches(query, row.name, row.email, row.channel, row.audience))
    .sort((a, b) => Number(b.status === "submitted") - Number(a.status === "submitted") || b.submittedAt.localeCompare(a.submittedAt)), [applications.data, query]);
  const selected = applications.data?.find((row) => row.id === open);
  return <>
    <div className="kit-card kit-span-12"><DataTable caption="Partner applications" columns={columns} rows={shown} rowKey={(row) => row.id}
      loading={applications.loading} error={applications.error} onRetry={applications.reload} onRowClick={(row) => setOpen(row.id)} activeKey={open}
      empty={{ title: query ? "No applications match this search." : "No partner applications yet.", note: "New applications appear here for the team to review." }} /></div>
    {selected && <PartnerApplicationDrawer key={selected.id} application={selected} onClose={() => setOpen(null)} onSaved={applications.reload} />}
  </>;
}

export function PartnerApplicationDrawer({ application: a, onClose, onSaved }: { application: PartnerApplication; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<"read" | "approve" | "decline">("read");
  const [code, setCode] = useState(() => suggestPartnerCode(a.name));
  const [rate, setRate] = useState("10");
  const [percent, setPercent] = useState("10");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function review(event: FormEvent) {
    event.preventDefault(); setError("");
    if (step === "approve" && (!/^[A-Z0-9_-]{1,64}$/.test(code.trim()) || !/^\d+(\.\d{1,2})?$/.test(rate) || !/^\d+(\.\d{1,2})?$/.test(percent) || Number(rate) > 100 || Number(percent) > 100)) {
      setError("Enter a code with letters, numbers, underscores or hyphens, and percentages from 0 to 100 with up to two decimal places."); return;
    }
    if (step === "decline" && !note.trim()) { setError("Add a note before declining."); return; }
    setBusy(true);
    try {
      if (step === "approve") await live().partnerApplications.approve(a.id, code, Number(rate) / 100, Number(percent));
      else await live().partnerApplications.decline(a.id, note);
      setStep("read"); onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The decision could not be saved. Try again."); }
    finally { setBusy(false); }
  }
  const footer = a.status === "submitted" ? step === "read" ? <div className="cc-confirm-actions">
    <Button variant="primary" onClick={() => setStep("approve")}>Approve</Button><Button variant="danger" onClick={() => setStep("decline")}>Decline</Button>
  </div> : <form className="cc-confirm" onSubmit={review}>
    {step === "approve" ? <div className="cc-form">
      <TextField label="Partner code" mono value={code} onChange={(value) => setCode(value.toUpperCase())} disabled={busy} hint="Must be unique. The suggested code is checked when you approve." />
      <TextField label="Commission rate" suffix="%" inputMode="decimal" value={rate} onChange={setRate} disabled={busy} />
      <TextField label="Buyer discount" suffix="%" inputMode="decimal" value={percent} onChange={setPercent} disabled={busy} />
    </div> : <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><TextAreaField label="Reason for declining" value={note} onChange={setNote} required hint="Kept with the application and visible to the applicant." /></fieldset>}
    {error && <p className="kit-field-error" role="alert">{error}</p>}
    <div className="cc-confirm-actions"><Button type="submit" variant={step === "approve" ? "primary" : "danger"} disabled={busy}>{busy ? "Saving…" : step === "approve" ? "Confirm approval" : "Decline application"}</Button>
      <Button disabled={busy} onClick={() => { setStep("read"); setError(""); }}>Cancel</Button></div>
  </form> : null;
  return <Drawer title={a.name} eyebrow="Partner application" onClose={() => { if (!busy) onClose(); }} footer={footer}
    tags={<><StatusChip status={a.status} /><span className="cc-tag-text">Submitted {formatDate(a.submittedAt)}</span></>}>
    {a.status !== "submitted" && <Section title="Decision"><Facts items={[
      { label: "Status", value: <StatusChip status={a.status} /> }, { label: "Reviewed", value: a.reviewedAt ? formatDate(a.reviewedAt) : "Not recorded" },
      ...(a.approvedCode ? [{ label: "Code", value: a.approvedCode }, { label: "Commission", value: `${Math.round((a.approvedRate ?? 0) * 10000) / 100}%` }, { label: "Buyer discount", value: `${a.approvedPercent}%` }] : []),
      ...(a.reviewNote ? [{ label: "Note", value: a.reviewNote }] : []),
    ]} /></Section>}
    <Section title="Applicant"><Facts items={[{ label: "Name", value: a.name }, { label: "Email", value: a.email }]} /></Section>
    <Section title="Channels and audience"><Facts items={[{ label: "Main channel", value: a.channel },
      { label: "Other channels", value: a.otherChannels.length ? a.otherChannels.map((channel, i) => <p key={i}>{channel}</p>) : "None provided" }, { label: "Audience", value: a.audience }]} /></Section>
    <Section title="How they would feature TrueMark"><p className="kit-note" style={{ whiteSpace: "pre-wrap" }}>{a.feature}</p></Section>
    <Section title="Commitments"><Facts items={commitments.map((commitment) => ({ label: commitment.label, value: a.commitments.includes(commitment.id) ? "Confirmed" : "Not confirmed" }))} /></Section>
  </Drawer>;
}
