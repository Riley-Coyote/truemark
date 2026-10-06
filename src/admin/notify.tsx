import { LIVE, storageKey } from "../platform/mode";
/**
 * New-order alerts for the team: who hears about every order, by email or by
 * text message, and exactly what they receive, previewed with the latest order in
 * the store. Choices are kept on this device in the preview; sending arrives with
 * the backend.
 */
import { useId, useState, useSyncExternalStore } from "react";
import { Button, DataTable, EmptyState, SampleTag, Skeleton, formatDateTime, formatMoney } from "../app-kit";
import {
  EmailButton,
  EmailFigure,
  EmailHeading,
  EmailPreview,
  EmailRows,
  EmailText,
  SmsPreview,
} from "../platform/email/EmailPreview";
import type { Resource } from "../platform/store";
import { store, useResource } from "../platform/store";
import type { Buyer, Order, Partner, ShippingMethod } from "../platform/types";
import { productById } from "../shop/catalog";
import { TextField, Switch } from "./fields";
import { TEAM } from "./team";
import type { Operator } from "./team";
import { live } from "../platform/live/runtime";
import { CONSENT } from "../platform/live/messages";
import type { MessagePreferences, TeamAlerts } from "../platform/live/messages";
import { teamRoleLabel } from "../platform/team";
import "../platform/live/team.css";

export type Channel = "email" | "text";
type Prefs = Record<string, Record<Channel, boolean>>;

const KEY = storageKey("tm-command-alerts");
/** Sample choices: the owner by email and text, fulfilment by email. The client sets the real ones. */
const DEFAULTS: Prefs = {
  "op-1": { email: true, text: true },
  "op-2": { email: true, text: false },
};
const listeners = new Set<() => void>();
let cache: { raw: string | null; prefs: Prefs } | null = null;

function readPrefs(): Prefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* Without storage the sample choices stand. */
  }
  if (cache && cache.raw === raw) return cache.prefs;
  let prefs = DEFAULTS;
  try {
    prefs = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Prefs) } : DEFAULTS;
  } catch {
    prefs = DEFAULTS;
  }
  cache = { raw, prefs };
  return prefs;
}

function setPref(operatorId: string, channel: Channel, on: boolean) {
  const current = readPrefs();
  const next = { ...current, [operatorId]: { ...current[operatorId], [channel]: on } };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* The choice lasts for this visit only. */
  }
  listeners.forEach((listener) => listener());
}

function usePrefs(): Prefs {
  return useSyncExternalStore((onChange) => {
    listeners.add(onChange);
    const onStorage = (event: StorageEvent) => event.key === KEY && onChange();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, readPrefs);
}

/* ---------- What the team receives ---------- */

export type OrderContext = { order: Order; buyer?: Buyer; partner?: Partner; method?: ShippingMethod };

const institutionOf = ({ order, buyer }: OrderContext) => buyer?.institution ?? order.address.institution;

/** The new-order text message: under 160 characters, so it arrives as one message. */
export function newOrderText(context: OrderContext): string {
  const { order, partner } = context;
  return `TrueMark: new order ${order.number} · ${formatMoney(order.total)} · ${institutionOf(context)}${partner ? ` · via ${partner.code}` : ""}`;
}

export function NewOrderEmail({ context, to }: { context: OrderContext; to: Operator }) {
  const { order, buyer, partner, method } = context;
  const vials = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const via = partner ? ` · via ${partner.code}` : "";
  return (
    <EmailPreview
      to={`${to.name} <${to.email}>`}
      subject={`New order ${order.number} · ${formatMoney(order.total)}`}
      preheader={`${institutionOf(context)}${via}`}
      footer="You receive this because new-order alerts are on for you in Settings."
    >
      <EmailHeading>{`New order ${order.number}`}</EmailHeading>
      <EmailFigure label="Order total" value={formatMoney(order.total)} note={`${institutionOf(context)}${via}`} />
      <EmailRows
        rows={[
          ...order.lines.map((line): [string, string] => {
            const product = productById(line.productId);
            return [`${product ? `${product.name} ${product.size}` : line.productId} × ${line.quantity}`, formatMoney(line.unitPrice * line.quantity)];
          }),
          ["Buyer", buyer?.name ?? order.address.attention],
          ["Shipping", method?.label ?? "Cold chain"],
          ...((order.insuranceApplied || (order.insurance ?? 0) > 0) ? [["Insurance", formatMoney(order.insurance ?? 0)] as [string, string]] : []),
          ["Placed", formatDateTime(order.createdAt)],
        ]}
      />
      <EmailText>{`${vials} ${vials === 1 ? "vial" : "vials"} to pack cold for ${order.address.city}, ${order.address.region}.`}</EmailText>
      <EmailButton>Open the order</EmailButton>
    </EmailPreview>
  );
}

/* ---------- Settings: the section ---------- */

const CHANNELS: { id: Channel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "text", label: "Text message" },
];

export function NewOrderAlerts() {
  return LIVE ? <LiveOrderAlerts /> : <PreviewOrderAlerts />;
}

function LiveOrderAlerts() {
  const members = useResource(() => live().messages.teamPreferences());
  const own = useResource(async () => ({profile: await live().auth.profile(), prefs: await live().messages.preferences()}));
  if (!own.data) return <p className="kit-note" role={own.error ? "alert" : "status"}>{own.error?.message ?? "Loading…"}</p>;
  return <TeamAlertForm initial={own.data.prefs} userId={own.data.profile?.id} members={members} />;
}
function TeamAlertForm({initial, userId, members}: {initial: MessagePreferences; userId?: string; members: Resource<TeamAlerts[]>}) {
  const [prefs, setPrefs] = useState(initial), [busy,setBusy] = useState(false), [error,setError] = useState("");
  const id=useId();
  const toggle=(event: string, channel: string, on: boolean) => setPrefs(p=>({...p,alerts:{...p.alerts,[event]:{...p.alerts[event],[channel]:on}}}));
  return <div className="kit-card cc-alerts">
    <DataTable caption="New-order alerts" rows={members.data} loading={members.loading} error={members.error} onRetry={members.reload}
      rowKey={member=>member.user_id} stickyHeader={false} empty={{title:"No team members yet."}} columns={[
        {key:"person",header:"Team member",mobile:"primary",cell:member=><span className="cc-alerts-person"><span id={`${id}-${member.user_id}`}>{member.email}</span><span className="kit-quiet">{teamRoleLabel(member.role as "owner"|"staff")}</span></span>},
        ...([{event:"newOrder",channel:"email",key:"new_order_email",label:"New orders: Email"},{event:"newOrder",channel:"text",key:"new_order_text",label:"New orders: Text"},{event:"applications",channel:"email",key:"applications_email",label:"Applications: Email"}] as const).map(c=>({key:c.key,header:c.label,cell:(member: {user_id:string;new_order_email:boolean;new_order_text:boolean;applications_email:boolean})=>member.user_id===userId?<><span className="kit-sr" id={`${id}-${c.key}`}>{c.label}</span><Switch checked={prefs.alerts[c.event]?.[c.channel]??false} onChange={on=>toggle(c.event,c.channel,on)} labelledBy={`${id}-${c.key} ${id}-${member.user_id}`} disabled={busy}/></>:member[c.key]?"On":"Off"})),
      ]}/>
    <form className="cc-setting-card cc-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{setPrefs(await live().messages.savePreferences(prefs.alerts,prefs.phone,prefs.smsConsent));members.reload();}catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}}}>
      <TextField label="Mobile number for text alerts" inputMode="tel" value={prefs.phone??""} onChange={phone=>setPrefs(p=>({...p,phone}))}/>
      <label className="cc-message-consent"><input type="checkbox" className="cc-message-box" checked={prefs.smsConsent} disabled={busy} onChange={e=>setPrefs(p=>({...p,smsConsent:e.target.checked}))}/>{CONSENT.team}</label>
      <Button type="submit" disabled={busy}>Save</Button>{error&&<p className="kit-field-error" role="alert">{error}</p>}
    </form>
    <div className="cc-card-foot"><p className="cc-footnote">Each person chooses their own alerts. In-app alerts are always on.</p></div>
  </div>;
}

function PreviewOrderAlerts() {
  const prefs = usePrefs();
  const baseId = useId();
  const latest = useResource(async () => {
    const [orders, buyers, partners, methods] = await Promise.all([
      store.orders.list(),
      store.buyers.list(),
      store.partners.list(),
      store.catalog.shippingMethods(),
    ]);
    const order = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!order) return null;
    return {
      order,
      buyer: buyers.find((b) => b.id === order.buyerId),
      partner: order.discount?.partnerId ? partners.find((p) => p.id === order.discount?.partnerId) : undefined,
      method: methods.find((m) => m.id === order.shipping.method),
    } satisfies OrderContext;
  }, []);

  const emailTo = TEAM.find((op) => prefs[op.id]?.email);
  const textTo = TEAM.find((op) => prefs[op.id]?.text);
  const nobody = !emailTo && !textTo;

  return (
    <div className="kit-card cc-alerts">
      <table className="cc-alerts-table">
        <caption className="kit-sr">New-order alerts by person and channel</caption>
        <thead>
          <tr>
            <th scope="col">Person</th>
            {CHANNELS.map((channel) => (
              <th key={channel.id} id={`${baseId}-${channel.id}`} scope="col">
                {channel.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TEAM.map((op) => (
            <tr key={op.id}>
              <th scope="row">
                <span className="cc-alerts-who">
                  <span className="kit-avatar" aria-hidden="true">
                    {op.initials}
                  </span>
                  <span className="cc-alerts-person">
                    <span id={`${baseId}-${op.id}`}>{op.name}</span>
                    <span className="kit-quiet">{op.role}</span>
                  </span>
                </span>
              </th>
              {CHANNELS.map((channel) => (
                <td key={channel.id}>
                  <Switch
                    checked={Boolean(prefs[op.id]?.[channel.id])}
                    onChange={(on) => setPref(op.id, channel.id, on)}
                    labelledBy={`${baseId}-${channel.id} ${baseId}-${op.id}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cc-alerts-previews">
        <div className="cc-alerts-head">
          <h3 className="kit-label">What they receive</h3>
          {latest.data && (
            <p className="cc-footnote">
              Shown with the latest order, <span className="kit-mono">{latest.data.order.number}</span>.
            </p>
          )}
        </div>
        {nobody && <p className="kit-note">Nobody receives new-order alerts right now. Turn on email or text for someone above.</p>}
        {latest.data ? (
          <div className="cc-alerts-grid">
            <div className="cc-alerts-email">
              <NewOrderEmail context={latest.data} to={emailTo ?? TEAM[0]} />
            </div>
            <div className="cc-alerts-text">
              <SmsPreview to={(textTo ?? TEAM[0]).name} message={newOrderText(latest.data)} />
              <p className="cc-footnote">Texts go to each person&rsquo;s mobile number, added when they are invited at launch.</p>
            </div>
          </div>
        ) : latest.error ? (
          <EmptyState
            compact
            title="The preview could not be built."
            note={latest.error.message}
            action={<Button onClick={latest.reload}>Try again</Button>}
          />
        ) : latest.loading ? (
          <div className="cc-list-loading" aria-label="Loading">
            <Skeleton width="72%" />
            <Skeleton width="54%" />
            <Skeleton width="64%" />
          </div>
        ) : (
          <p className="kit-note">No orders yet. The preview appears with the first one.</p>
        )}
      </div>

      <div className="cc-card-foot">
        <p className="cc-footnote">Preview: choices are kept on this device. Sending arrives with the backend.</p>
        <SampleTag>Sample team</SampleTag>
      </div>
    </div>
  );
}
