import { useState } from 'react';
import { Button, Dot, SampleTag, Section, formatDate } from '../app-kit';
import { live } from '../platform/live/runtime';
import { SHIPMENT_LABELS } from '../platform/shipping';
import type { Shipment } from '../platform/shipping';
export function ShipmentSection({ shipment }: { shipment: Shipment | null | undefined }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!shipment) return null;
  const s = shipment;
  async function act(action: 'retry' | 'label' | 'delivered') {
    setSaving(true); setError(null);
    try {
      if (action === 'retry') await live().shipping.retry(s.orderId);
      else await live().shipping.simulate(s.orderId, action);
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setSaving(false); }
  }
  const label = s.status === 'shipped' ? `${s.carrier ?? ''} · ${s.tracking ?? ''} · ${s.service ?? ''}`
    : s.status === 'delivered' ? `Delivered ${s.deliveredAt ? formatDate(s.deliveredAt) : ''}`
    : s.status === 'failed' ? `${SHIPMENT_LABELS.failed}: ${s.lastError ?? ''}` : SHIPMENT_LABELS[s.status];
  return <Section title="Shipping">
    <div className="cc-shipment">
      {s.provider === 'simulator' && <SampleTag>Simulated</SampleTag>}
      <p className="cc-shipment-state" role="status"><Dot tone={s.status === 'delivered' ? 'signal' : s.status === 'failed' ? 'danger' : 'neutral'} />{label}</p>
      {error && <p className="kit-field-error" role="alert">{error}</p>}
      {s.status === 'failed' && <Button disabled={saving} onClick={() => void act('retry')}>Try again</Button>}
      {s.provider === 'simulator' && s.status === 'pushed' && <Button disabled={saving} onClick={() => void act('label')}>Print label (simulated)</Button>}
      {s.provider === 'simulator' && s.status === 'shipped' && <Button disabled={saving} onClick={() => void act('delivered')}>Simulate delivery scan</Button>}
    </div>
  </Section>;
}
