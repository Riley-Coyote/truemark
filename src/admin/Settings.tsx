import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import {
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Facts,
  PageHeader,
  SampleTag,
  Section,
  Skeleton,
  formatMoney,
} from "../app-kit";
import type { Column } from "../app-kit";
import { store, useResource } from "../platform/store";
import type { ShippingMethod, ShippingMethodId } from "../platform/types";
import { PreviewTag, SwitchRow, TextField, parseDollars } from "./fields";
import { NewOrderAlerts } from "./notify";
import { preview, usePreview } from "./preview";
import { useQueryParam } from "./state";
import { TEAM } from "./team";
import type { Operator } from "./team";

/** A setting group: what it governs on the left, the controls on the right. */
function Block({ title, note, children }: { title: string; note: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="cc-setting" aria-labelledby={id}>
      <div className="cc-setting-intro">
        <h2 id={id} className="kit-label">
          {title}
        </h2>
        <p className="cc-setting-note">{note}</p>
      </div>
      <div className="cc-setting-body">{children}</div>
    </section>
  );
}

export default function Settings() {
  const methods = useResource(() => store.catalog.shippingMethods(), []);
  const changes = usePreview();
  const [openId, setOpenId] = useQueryParam("operator");

  return (
    <div className="kit-grid">
      <PageHeader
        description="The rules the shop runs on. Shipping rates are samples for you to set; payments and team invitations connect at launch."
        meta={<PreviewTag />}
      />

      <Block title="Store" note="How the shop names itself and where it lives.">
        <div className="kit-card cc-setting-card">
          <Facts
            items={[
              { label: "Store name", value: "TrueMark BioLabs" },
              { label: "Domain", value: <span className="kit-mono">truemarkbiolabs.com</span> },
              { label: "Support email", value: <span className="kit-quiet">Set at launch</span> },
              { label: "Currency", value: "US dollars" },
            ]}
          />
        </div>
      </Block>

      <Block title="Shipping" note="The cold-chain methods offered at checkout. Rates are samples for you to set.">
        <div className="kit-card cc-setting-card">
          {methods.data ? (
            <RatesForm methods={methods.data} rates={changes.rates} />
          ) : methods.error ? (
            <EmptyState
              compact
              title="Shipping methods could not be loaded."
              note={methods.error.message}
              action={<Button onClick={methods.reload}>Try again</Button>}
            />
          ) : (
            <div className="cc-list-loading" aria-label="Loading">
              <Skeleton width="64%" />
              <Skeleton width="58%" />
            </div>
          )}
        </div>
      </Block>

      <Block title="Payments" note="Card payments run through your processor, which connects at launch.">
        <div className="kit-card">
          <EmptyState
            compact
            title="Connect your processor at launch."
            note="Card details are entered in your payment partner's secure form and never touch TrueMark's servers. Orders then record each payment as authorized, captured, refunded or failed."
            action={
              <div className="cc-connect">
                <Button disabled aria-describedby="cc-connect-note">
                  Connect processor
                </Button>
                <span id="cc-connect-note" className="cc-footnote">
                  Available at launch
                </span>
              </div>
            }
          />
        </div>
      </Block>

      <Block title="Compliance" note="The checks every order passes through. They keep the shop a supplier to verified laboratories.">
        <div className="kit-card cc-switch-card">
          <SwitchRow
            title="Research account required to purchase"
            description="Only verified research accounts can place an order."
            checked
            locked="Always on"
          />
          <SwitchRow
            title="Research-use attestation at checkout"
            description="Buyers confirm the materials are for laboratory research use only and will not be used in humans or animals."
            checked={changes.compliance.attestation}
            onChange={(value) => preview.setCompliance("attestation", value)}
            note={changes.compliance.attestation ? undefined : "Orders would be placed without the research-use confirmation."}
          />
          <SwitchRow
            title="Publish released certificates on /verify"
            description="When a lot is released, its certificate appears on the public verify page."
            checked={changes.compliance.certificates}
            onChange={(value) => preview.setCompliance("certificates", value)}
            note={changes.compliance.certificates ? undefined : "Released lots would have no public record."}
          />
        </div>
      </Block>

      <Block title="Team" note="Who operates the command center, and what each role can change.">
        <div className="kit-card">
          <DataTable
            caption="Team"
            columns={teamColumns}
            rows={TEAM}
            rowKey={(operator) => operator.id}
            onRowClick={(operator) => setOpenId(operator.id)}
            activeKey={openId}
            stickyHeader={false}
            empty={{ title: "No operators yet." }}
          />
          <div className="cc-card-foot">
            <p id="cc-invite-note" className="cc-footnote">
              Two sample operators. Invitations arrive with the backend.
            </p>
            <Button disabled aria-describedby="cc-invite-note">
              Invite an operator
            </Button>
          </div>
        </div>
      </Block>

      <Block
        title="New-order alerts"
        note="Who on the team hears about every new order, and how. The bell at the top of the command center shows each one as it lands."
      >
        <NewOrderAlerts />
      </Block>

      {openId && <OperatorDrawer key={openId} operator={TEAM.find((o) => o.id === openId)} onClose={() => setOpenId(null, { replace: true })} />}
    </div>
  );
}

/* ---------- Shipping rates ---------- */

const parseRate = (text: string) => parseDollars(text, { allowZero: true });

function RatesForm({ methods, rates }: { methods: ShippingMethod[]; rates: Partial<Record<ShippingMethodId, number>> }) {
  const current = (m: ShippingMethod) => rates[m.id] ?? m.price;
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(methods.map((m) => [m.id, current(m).toFixed(2)])),
  );
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);

  const parsed = methods.map((m) => ({ method: m, ...parseRate(drafts[m.id] ?? "") }));
  const changed = parsed.some((p) => p.value === undefined || p.value !== current(p.method));
  const edited = methods.some((m) => current(m) !== m.price);

  function save(event: FormEvent) {
    event.preventDefault();
    const next = Object.fromEntries(parsed.map((p) => [p.method.id, p.error]));
    setErrors(next);
    if (parsed.some((p) => p.error)) {
      setMessage(null);
      return;
    }
    preview.setRates(Object.fromEntries(parsed.map((p) => [p.method.id, p.value as number])));
    setDrafts(Object.fromEntries(parsed.map((p) => [p.method.id, (p.value as number).toFixed(2)])));
    setMessage("Shipping rates changed in this preview.");
  }

  function restore() {
    preview.setRates(Object.fromEntries(methods.map((m) => [m.id, m.price])));
    setDrafts(Object.fromEntries(methods.map((m) => [m.id, m.price.toFixed(2)])));
    setErrors({});
    setMessage("Sample rates restored.");
  }

  return (
    <form className="cc-rates" onSubmit={save} noValidate>
      <ul>
        {methods.map((m) => (
          <li key={m.id} className="cc-rate">
            <div className="cc-rate-text">
              <p className="cc-rate-name">{m.label}</p>
              <p className="cc-rate-detail">
                {m.detail}. Sample rate {formatMoney(m.price)}.
              </p>
            </div>
            <div className="cc-rate-field">
              <TextField
                label={`Rate for ${m.label}`}
                srLabel="in US dollars"
                hideLabel
                prefix="$"
                inputMode="decimal"
                value={drafts[m.id] ?? ""}
                onChange={(value) => {
                  setDrafts((d) => ({ ...d, [m.id]: value }));
                  setMessage(null);
                  if (errors[m.id]) setErrors((e) => ({ ...e, [m.id]: parseRate(value).error }));
                }}
                error={errors[m.id]}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="cc-live" aria-live="polite">
        {message && <p className="kit-note">{message}</p>}
      </div>
      <div className="cc-confirm-actions cc-foot-row">
        <Button type="submit" variant="primary" disabled={!changed}>
          Save rates
        </Button>
        {edited && (
          <Button variant="text" onClick={restore}>
            Restore sample rates
          </Button>
        )}
        <SampleTag>Sample rates</SampleTag>
      </div>
    </form>
  );
}

/* ---------- Team ---------- */

const teamColumns: Column<Operator>[] = [
  {
    key: "name",
    header: "Name",
    width: "34%",
    mobile: "primary",
    sortValue: (o) => o.name,
    cell: (o) => (
      <span className="kit-cell-name">
        <span className="kit-avatar" aria-hidden="true">
          {o.initials}
        </span>
        <span>{o.name}</span>
      </span>
    ),
  },
  { key: "email", header: "Email", width: "42%", mobile: "secondary", sortValue: (o) => o.email, cell: (o) => o.email },
  { key: "role", header: "Role", width: "24%", mobile: "aside", sortValue: (o) => o.role, cell: (o) => o.role },
];

function OperatorDrawer({ operator, onClose }: { operator: Operator | undefined; onClose: () => void }) {
  if (!operator) {
    return (
      <Drawer title="Operator" eyebrow="Operator" onClose={onClose}>
        <EmptyState compact title="No operator matches this link." />
      </Drawer>
    );
  }
  return (
    <Drawer
      title={operator.name}
      eyebrow="Operator"
      subtitle={`${operator.role} · ${operator.email}`}
      tags={<SampleTag>Sample operator</SampleTag>}
      footer={
        <div className="cc-actions">
          <div className="cc-confirm-actions">
            <Button disabled aria-describedby="cc-team-note">
              Change role
            </Button>
            <Button variant="danger" disabled aria-describedby="cc-team-note">
              Remove from team
            </Button>
          </div>
          <p id="cc-team-note" className="cc-footnote">
            Team changes arrive with the backend.
          </p>
        </div>
      }
      onClose={onClose}
    >
      <Section title="Account">
        <Facts
          items={[
            { label: "Name", value: operator.name },
            { label: "Email", value: operator.email },
            { label: "Role", value: operator.role },
          ]}
        />
      </Section>
      <Section title="Can use">
        <ul className="cc-checks">
          {operator.can.map((item) => (
            <li key={item}>
              <Check aria-hidden="true" strokeWidth={1.8} />
              {item}
            </li>
          ))}
        </ul>
      </Section>
      {operator.cannot.length > 0 && (
        <Section title="Cannot change">
          <ul className="cc-checks is-muted">
            {operator.cannot.map((item) => (
              <li key={item}>
                <Minus aria-hidden="true" strokeWidth={1.8} />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Drawer>
  );
}
