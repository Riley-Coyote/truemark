import { AssistantSettings } from "../assistant/Settings";
import { CommerceSettings } from "./Commerce";
import { AppearanceControl } from "./appearance";
import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { LiveTeam } from "../platform/live/TeamSettings";
import { useResource } from "../platform/store";
import { useId } from "react";
import type { ReactNode } from "react";
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
} from "../app-kit";
import type { Column } from "../app-kit";
import { PreviewTag, SwitchRow } from "./fields";
import { NewOrderAlerts } from "./notify";
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
  const [openId, setOpenId] = useQueryParam("operator");
  const profile = useResource(() => LIVE ? live().auth.profile() : Promise.resolve(null));
  if (LIVE && !profile.data && profile.loading) return <p className="kit-note" role="status">Checking settings access…</p>;
  if (LIVE && profile.error) return <EmptyState title="Settings access could not be checked." note={profile.error.message} action={<Button onClick={profile.reload}>Try again</Button>} />;
  if (LIVE && !["owner", "staff"].includes(profile.data?.role ?? "")) return <EmptyState title="Team access required." note="Sign in with your TrueMark team account." />;

  return (
    <div className="kit-grid">
      <PageHeader
        description={LIVE ? "The rules the shop runs on. Owners set free shipping and insurance, and manage the team. Payments connect at launch." : "The rules the shop runs on. The owner sets free shipping and insurance; payments and team invitations connect at launch."}
        meta={LIVE ? undefined : <PreviewTag />}
      />

      <Block title="Appearance" note="Applies to this device.">
        <div className="kit-card cc-setting-card cc-appearance-card"><AppearanceControl /></div>
      </Block>

      {(!LIVE || profile.data?.role === "owner") && <>
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

      <Block title="Shipping" note="When standard delivery is free. The threshold applies after discounts.">
        <div className="kit-card cc-setting-card"><CommerceSettings kind="shipping" /></div>
      </Block>
      <Block title="Insurance" note="Shipment insurance, ready when the client decides.">
        <div className="kit-card cc-setting-card"><CommerceSettings kind="insurance" /></div>
      </Block>

      <Block title="Assistant" note="Choose models that support tool use.">
        <AssistantSettings />
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
            checked
            locked="Always on"
          />
          <SwitchRow
            title="Publish released certificates on /verify"
            description="When a lot is released, its certificate appears on the public verify page."
            checked
            locked="Always on"
          />
        </div>
      </Block>

      </>}

      <Block title="Team" note="Who operates the command center, and what each role can change.">
        {LIVE ? <LiveTeam canManage={profile.data?.role === "owner"} openId={openId} onOpen={(id) => setOpenId(id, { replace: id === null })} /> : <div className="kit-card">
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
        </div>}
      </Block>

      <Block
        title="New-order alerts"
        note="Who on the team hears about every new order, and how. The bell at the top of the command center shows each one as it lands."
      >
        <NewOrderAlerts />
      </Block>

      {!LIVE && openId && <OperatorDrawer key={openId} operator={TEAM.find((o) => o.id === openId)} onClose={() => setOpenId(null, { replace: true })} />}
    </div>
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
