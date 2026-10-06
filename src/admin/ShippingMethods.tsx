import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../app-kit';
import { live } from '../platform/live/runtime';
import { useResource } from '../platform/store';
import type { ShippingMethod } from '../platform/types';
import { Switch, TextField, parseDollars } from './fields';
function Method({ method }: { method: ShippingMethod }) {
  const [label, setLabel] = useState(method.label), [detail, setDetail] = useState(method.detail);
  const [price, setPrice] = useState(method.price.toFixed(2)), [active, setActive] = useState(method.active !== false);
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const id = useId();
  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseDollars(price, { allowZero: true });
    if (parsed.error) { setError(parsed.error); return; }
    setSaving(true); setError(null);
    try { await live().shipping.saveMethod({ ...method, label, detail, price: parsed.value!, active }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setSaving(false); }
  }
  return <form className="cc-shipping-method" onSubmit={(event) => void save(event)} aria-label={method.label}>
    <TextField label="Label" value={label} onChange={setLabel} disabled={saving} />
    <TextField label="Detail" value={detail} onChange={setDetail} disabled={saving} />
    <TextField label="Price" prefix="$" inputMode="decimal" value={price} onChange={setPrice} disabled={saving} />
    <div className="cc-confirm-actions"><span id={id} className="kit-field-label">Active</span><Switch checked={active} onChange={setActive} labelledBy={id} disabled={saving} />
      <Button type="submit" disabled={saving}>Save</Button></div>
    {error && <p className="kit-field-error" role="alert">{error}</p>}
  </form>;
}
export function ShippingMethods() {
  const methods = useResource(async () => live().shipping.methods());
  return <div className="kit-card cc-setting-card cc-shipping-methods">
    <p className="cc-footnote">Checkout shows these prices. They're labelled as samples until you save them.</p>
    {methods.error && <p className="kit-field-error" role="alert">{methods.error.message}</p>}
    {methods.data?.map((method) => <Method key={`${method.id}-${method.label}-${method.detail}-${method.price}-${method.active}`} method={method} />)}
  </div>;
}
