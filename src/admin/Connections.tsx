import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Dot, EmptyState, Segmented } from '../app-kit';
import type { Tone } from '../app-kit';
import { CONNECTION_LABELS, CONNECTION_ORDER, MODE_LABELS } from '../platform/connections';
import type { Connection } from '../platform/connections';
import { LIVE } from '../platform/mode';
import { live } from '../platform/live/runtime';
import { useResource } from '../platform/store';
import { saleAge } from '../partners/metrics';
import { SelectField } from './fields';

const simulated = {
  payments: 'Checkout offers test outcomes. No card is charged.',
  email: 'Emails are written and kept under Sent messages. None are delivered.',
  sms: 'Texts are kept under Sent messages. None are delivered.',
  shipping: 'Paid orders go to a stand-in ShipStation. Print test labels from each order.',
};
const providers = {
  payments: [] as { value: string; label: string }[],
  email: [{ value: 'resend', label: 'Resend' }],
  sms: [{ value: 'twilio', label: 'Twilio' }],
  shipping: [{ value: 'shipstation', label: 'ShipStation' }],
};
const providerLabel = (c: Connection) => providers[c.id].find((p) => p.value === c.provider)?.label ?? c.provider;

export default function Connections({ owner }: { owner: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null), section = useRef<HTMLElement>(null), location = useLocation();
  // Settings above this block load their own data and grow; keep the block in view while
  // they settle (about three seconds), unless the person scrolls or presses a key first.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('section') !== 'connections') return;
    const settle = () => section.current?.scrollIntoView({ block: 'start' });
    settle();
    heading.current?.focus({ preventScroll: true });
    let active = true;
    const stop = () => { active = false; };
    const observer = new ResizeObserver(() => { if (active) settle(); });
    observer.observe(document.body);
    const done = window.setTimeout(stop, 3000);
    for (const event of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.addEventListener(event, stop, { once: true, passive: true });
    return () => {
      active = false; observer.disconnect(); window.clearTimeout(done);
      for (const event of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.removeEventListener(event, stop);
    };
  }, [location.search]);
  return (
    <section className="cc-setting" id="connections" ref={section} aria-labelledby="cc-connections-heading">
      <div className="cc-setting-intro">
        <h2 id="cc-connections-heading" ref={heading} tabIndex={-1} className="kit-label">Connections</h2>
        <p className="cc-setting-note">How the shop reaches payments, email, text messages and shipping.</p>
      </div>
      <div className="cc-setting-body">
        {LIVE ? <LiveConnections owner={owner} /> : <p className="kit-note">Connections work in the live platform.</p>}
      </div>
    </section>
  );
}

function LiveConnections({ owner }: { owner: boolean }) {
  const connections = useResource(() => live().connections.list());
  if (connections.error) {
    return <div className="kit-card cc-setting-card"><EmptyState compact title={connections.error.message} action={<Button onClick={connections.reload}>Try again</Button>} /></div>;
  }
  return (
    <div className="kit-card cc-setting-card">
      {CONNECTION_ORDER.map((id) => {
        const c = connections.data?.find((row) => row.id === id);
        return c ? <ConnectionRow key={id} connection={c} owner={owner} reload={connections.reload} /> : null;
      })}
      <div className="cc-connections-foot">
        <p className="cc-footnote">{owner ? "Live needs the provider's keys, set on the server." : 'Owners switch services between off, simulated and live.'}</p>
        <Link className="cc-inline-link" to="/admin/messages">Sent messages</Link>
      </div>
    </div>
  );
}

function ConnectionRow({ connection: c, owner, reload }: { connection: Connection; owner: boolean; reload: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const failing = Boolean(c.lastErrorAt && (!c.lastOkAt || c.lastErrorAt > c.lastOkAt));
  const tone: Tone = failing ? 'danger' : c.mode === 'live' ? 'signal' : c.mode === 'simulated' ? 'pending' : 'neutral';
  async function save(mode: Connection['mode'], provider?: string) {
    setBusy(true); setError('');
    try { await live().connections.setMode(c.id, mode, provider); reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const health = failing ? `Failing since ${saleAge(c.lastErrorAt!)} · ${c.lastError}` : c.lastOkAt ? `Working · last used ${saleAge(c.lastOkAt)}` : 'Not used yet';
  const meaning = c.mode === 'simulated' ? simulated[c.id] : c.mode === 'off' ? 'Off. Nothing is sent to a provider.' : `Live through ${providerLabel(c)}.`;
  return (
    <div className="cc-connection">
      <div className="cc-connection-head">
        <h3 className="cc-connection-name">{CONNECTION_LABELS[c.id]}</h3>
        <span className="cc-connection-mode"><Dot tone={tone} />{MODE_LABELS[c.mode]}{c.mode === 'live' && c.provider ? ` · ${providerLabel(c)}` : ''}</span>
      </div>
      <p className="cc-connection-text">{meaning}</p>
      <p className="cc-connection-health">{health}</p>
      {owner && (
        <div className="cc-connection-controls">
          <Segmented
            label={`${CONNECTION_LABELS[c.id]} mode`}
            value={c.mode}
            onChange={(mode) => void save(mode, mode === 'live' ? providers[c.id][0]?.value : undefined)}
            options={(['off', 'simulated', 'live'] as const).map((value) => ({ value, label: MODE_LABELS[value], disabled: busy || (value === 'live' && c.id === 'payments') }))}
          />
          {c.id === 'payments'
            ? <p className="cc-footnote">No processor adapter yet</p>
            : c.mode === 'live' && <SelectField label="Provider" value={c.provider} options={providers[c.id]} onChange={(p) => void save('live', p)} disabled={busy} />}
        </div>
      )}
      {error && <p className="kit-field-error" role="alert">{error}</p>}
    </div>
  );
}
