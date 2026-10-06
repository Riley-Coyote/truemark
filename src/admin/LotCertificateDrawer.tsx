import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer } from "../app-kit";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { PURITY_MINIMUM, releaseProblem, releaseTemplate, resultsOf } from "../platform/certificate-records";
import type { Lot, LotRelease } from "../platform/types";
import { productById } from "../shop/catalog";
import { SelectField, TextField } from "./fields";
import { ContentUpload } from "./ContentUpload";

type Entry = { purity: string; identity: "" | "Conforms" | "Does not conform"; content: string; claim: string; ofClaim: string };
const blank: Entry = { purity: "", identity: "", content: "", claim: "", ofClaim: "" };
const number = /^\d+(\.\d+)?$/;

/**
 * Release a lot with what its certificate reports: the certificate number, the date analyzed and,
 * for each component (a blend lists each), HPLC purity, identity, content per vial with its label
 * claim and the percentage of claim as printed, and the PDF. The gate is the database's own rule.
 */
export function LotCertificateDrawer({ lot, onClose, onSaved }: { lot: Lot; onClose: () => void; onSaved: () => void }) {
  const replace = lot.status === "released";
  const template = releaseTemplate(lot.productId, productById(lot.productId)?.name ?? lot.productId);
  const [file, setFile] = useState<File | null>(null);
  const [testedAt, setTestedAt] = useState("");
  const [reference, setReference] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() => template.map(() => blank));
  // Results a certificate may also carry, as the form always allowed.
  const [msIdentity, setMsIdentity] = useState<"" | "Confirmed" | "Not confirmed">("");
  const [endotoxin, setEndotoxin] = useState("");
  const [sterility, setSterility] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const edit = (index: number, patch: Partial<Entry>) => setEntries((list) => list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!LIVE) { setMessage("Saving works in the live platform."); return; }
    if (!file) { setError("Choose the certificate PDF."); return; }
    const results = [
      ...resultsOf(template.map((part, i) => ({ ...part, ...entries[i], purity: entries[i].purity.trim(), content: entries[i].content.trim(), claim: entries[i].claim.trim(), ofClaim: entries[i].ofClaim.trim() }))),
      ...(msIdentity ? [{ label: "Identity", method: "Mass spectrometry", value: msIdentity, unit: "" }] : []),
      ...(endotoxin.trim() ? [{ label: "Endotoxin", method: "LAL", value: endotoxin.trim(), unit: "EU/mg" }] : []),
      ...(sterility.trim() ? [{ label: "Sterility", method: "", value: sterility.trim(), unit: "" }] : []),
    ];
    if (!replace) {
      if (!testedAt || !reference.trim() || entries.some((entry) => !entry.identity || ![entry.purity, entry.content, entry.claim, entry.ofClaim].every((value) => number.test(value.trim())))) {
        setError("Enter the certificate number, the date analyzed and, for each component, HPLC purity, identity, content, label claim and % of claim as the certificate prints them."); return;
      }
      const problem = releaseProblem(results);
      if (problem) { setError(`${problem}. Reject out-of-spec lots from the lot record.`); return; }
    }
    setBusy(true);
    try {
      if (replace) await live().content.replaceCertificate(lot.lot, file);
      else {
        const input: LotRelease = { testedAt, reference: reference.trim(), results };
        await live().content.releaseLot(lot.lot, input, file);
      }
      onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The certificate could not be saved."); }
    finally { setBusy(false); }
  }
  return <Drawer title={replace ? "Replace certificate" : "Release with certificate"} eyebrow={lot.lot} onClose={() => { if (!busy) onClose(); }} footer={
    <div className="cc-confirm-actions"><Button variant="primary" type="submit" form="cc-certificate-form" disabled={busy}>{busy ? "Saving…" : replace ? "Replace certificate" : "Release lot"}</Button><Button onClick={onClose} disabled={busy}>Cancel</Button></div>
  }>
    <form id="cc-certificate-form" onSubmit={save} className="cc-form">
      <ContentUpload bucket="certificates" file={file} onChange={setFile} onError={setError} disabled={busy} />
      {!replace && <>
        <TextField label="Certificate number" value={reference} onChange={setReference} mono disabled={busy} />
        <TextField label="Date analyzed (UTC)" type="date" value={testedAt} onChange={setTestedAt} disabled={busy} />
        <p className="kit-note">Releases need HPLC purity of at least {PURITY_MINIMUM}% for every component and an identity that conforms. Content is recorded and shown, not gated.</p>
        {template.map((part, i) => (
          <fieldset key={part.name ?? "lot"} className="cc-content-fields cc-form cc-release-part" disabled={busy}>
            {part.name && <legend>{part.name}</legend>}
            <TextField label="HPLC purity" suffix="%" size="short" inputMode="decimal" value={entries[i].purity} onChange={(purity) => edit(i, { purity })} />
            <SelectField label="Identity (RT + UV vs. reference)" value={entries[i].identity} onChange={(identity) => edit(i, { identity })} placeholder="Choose the result"
              options={[{ value: "Conforms", label: "Conforms" }, { value: "Does not conform", label: "Does not conform" }]} />
            <TextField label={part.contentUnit === "mg per vial" ? "Content per vial" : part.contentLabel ?? "Content"} suffix={part.contentUnit.replace(/ per vial$/, "")} size="short" inputMode="decimal" value={entries[i].content} onChange={(content) => edit(i, { content })} />
            <TextField label="Label claim" suffix={part.claimUnit} size="short" inputMode="decimal" value={entries[i].claim} onChange={(claim) => edit(i, { claim })} />
            <TextField label="% of label claim" suffix="%" size="short" inputMode="decimal" value={entries[i].ofClaim} onChange={(ofClaim) => edit(i, { ofClaim })} hint="As printed on the certificate." />
          </fieldset>
        ))}
        <SelectField label="MS identity (optional)" value={msIdentity} onChange={setMsIdentity} disabled={busy} placeholder="Choose the result" options={[{ value: "Confirmed", label: "Confirmed" }, { value: "Not confirmed", label: "Not confirmed" }]} />
        <TextField label="Endotoxin (optional)" suffix="EU/mg" value={endotoxin} onChange={setEndotoxin} disabled={busy} />
        <TextField label="Sterility (optional)" value={sterility} onChange={setSterility} disabled={busy} />
      </>}
      <p className="kit-note" role="status">{message || (replace ? "The release date and recorded results stay on file." : "Release makes the entered results and certificate public.")}</p>
      {error && <p className="kit-field-error" role="alert">{error}</p>}
    </form>
  </Drawer>;
}
