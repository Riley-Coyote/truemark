import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Drawer } from "../app-kit";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import type { Lot, LotRelease } from "../platform/types";
import { SelectField, TextField } from "./fields";
import { ContentUpload } from "./ContentUpload";

export function LotCertificateDrawer({ lot, onClose, onSaved }: { lot: Lot; onClose: () => void; onSaved: () => void }) {
  const replace = lot.status === "released";
  const [file, setFile] = useState<File | null>(null);
  const [testedAt, setTestedAt] = useState("");
  const [purity, setPurity] = useState("");
  const [identity, setIdentity] = useState("");
  const [endotoxin, setEndotoxin] = useState("");
  const [sterility, setSterility] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!LIVE) { setMessage("Saving works in the live platform."); return; }
    if (!file) { setError("Choose the certificate PDF."); return; }
    if (!replace && (!testedAt || !reference.trim() || !/^\d+(\.\d+)?$/.test(purity) || Number(purity) < 99 || Number(purity) > 100 || identity !== "Confirmed")) {
      setError("Enter the test date, COA reference, HPLC purity from 99.0 to 100, and confirmed MS identity. Reject out-of-spec lots from the lot record."); return;
    }
    setBusy(true);
    try {
      if (replace) await live().content.replaceCertificate(lot.lot, file);
      else {
        const input: LotRelease = { testedAt, reference: reference.trim(), results: [
          { label: "Purity", method: "HPLC", value: purity, unit: "%" },
          { label: "Identity", method: "Mass spectrometry", value: identity, unit: "" },
          ...(endotoxin.trim() ? [{ label: "Endotoxin", method: "LAL", value: endotoxin.trim(), unit: "EU/mg" }] : []),
          ...(sterility.trim() ? [{ label: "Sterility", method: "", value: sterility.trim(), unit: "" }] : []),
        ] };
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
        <TextField label="Test date (UTC)" type="date" value={testedAt} onChange={setTestedAt} disabled={busy} />
        <TextField label="HPLC purity %" value={purity} onChange={setPurity} inputMode="decimal" disabled={busy} hint="Releases need ≥99.0% HPLC purity and confirmed identity." />
        <SelectField label="MS identity" value={identity} onChange={setIdentity} disabled={busy} placeholder="Choose the result" options={[{ value: "Confirmed", label: "Confirmed" }, { value: "Not confirmed", label: "Not confirmed" }]} />
        <TextField label="Endotoxin (optional)" suffix="EU/mg" value={endotoxin} onChange={setEndotoxin} disabled={busy} />
        <TextField label="Sterility (optional)" value={sterility} onChange={setSterility} disabled={busy} />
        <TextField label="COA reference" value={reference} onChange={setReference} disabled={busy} />
      </>}
      <p className="kit-note" role="status">{message || (replace ? "The release date and recorded results stay on file." : "Release makes the entered results and certificate public.")}</p>
      {error && <p className="kit-field-error" role="alert">{error}</p>}
    </form>
  </Drawer>;
}
