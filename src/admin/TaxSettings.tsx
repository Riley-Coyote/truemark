import { useState } from "react";
import type { FormEvent } from "react";
import { Check } from "lucide-react";
import { Button, Segmented } from "../app-kit";
import { store, useResource } from "../platform/store";
import { live } from "../platform/live/runtime";
import { US_STATES } from "../platform/tax";

export function TaxSettings() {
  const settings = useResource(() => store.settings.get());
  const rates = useResource(() => live().payments.rates());
  const [region, setRegion] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); settings.reload(); rates.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Tax settings could not be saved. Try again."); }
    finally { setBusy(false); }
  }
  function add(event: FormEvent) {
    event.preventDefault();
    void save(async () => { await live().payments.setTaxRate(region, Number(rate)/100); setRegion(""); setRate(""); });
  }
  if (!settings.data || !rates.data) return <div className="kit-card cc-setting-card">{settings.error || rates.error ? <p className="kit-field-error" role="alert">{settings.error?.message ?? rates.error?.message}<Button onClick={() => { settings.reload(); rates.reload(); }}>Try again</Button></p> : <p className="kit-note" role="status">Loading tax settings…</p>}</div>;
  const current = settings.data;
  return <div className="kit-card cc-setting-card">
    <fieldset className="cc-tax-controls" disabled={busy}>
      <legend className="sr-only">Sales tax</legend>
      <Segmented label="Sales tax" options={[{ value: "off", label: "Off" }, { value: "rates", label: "By state" }]} value={current.taxMode} onChange={(mode) => void save(() => live().payments.setTaxSettings(mode, current.taxShipping))} />
      <label className="cc-tax-shipping"><input className="cc-tax-checkbox" type="checkbox" checked={current.taxShipping} onChange={(e) => void save(() => live().payments.setTaxSettings(current.taxMode, e.target.checked))} /><span className="cc-tax-checkbox-mark" aria-hidden="true"><Check size={14} /></span><span>Tax shipping</span></label>
      <table className="cc-tax-table"><caption className="sr-only">State tax rates</caption><thead><tr><th scope="col">State</th><th scope="col">Rate %</th><th scope="col">Actions</th></tr></thead><tbody>{rates.data.map((r) => <tr key={r.region}><td>{US_STATES.find(([code]) => code===r.region)?.[1] ?? r.region}</td><td>{Number((r.rate*100).toFixed(3))}%</td><td><Button onClick={() => { setRegion(r.region); setRate(String(Number((r.rate*100).toFixed(3)))); }}>Edit</Button><Button onClick={() => void save(() => live().payments.setTaxRate(r.region,null))}>Remove</Button></td></tr>)}</tbody></table>
      <form className="cc-tax-form" onSubmit={add}><label className="kit-field"><span className="kit-field-label">Add a state</span><span className="kit-select cc-select"><select value={region} onChange={(e) => setRegion(e.target.value)} required><option value="">Choose</option>{US_STATES.map(([code,name]) => <option key={code} value={code}>{name}</option>)}</select></span></label><label className="kit-field"><span className="kit-field-label">Rate %</span><span className="cc-control" data-disabled={busy || undefined}><input className="cc-input" type="number" min="0" max="20" step="0.001" value={rate} onChange={(e) => setRate(e.target.value)} required /></span></label><Button type="submit" disabled={busy || !region || !rate}>Save</Button></form>
    </fieldset>
    {error && <p className="kit-field-error" role="alert">{error}</p>}
  </div>;
}
