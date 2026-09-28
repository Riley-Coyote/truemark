import { useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Facts,
  PageHeader,
  SampleTag,
  Section,
  Segmented,
  StatusChip,
  formatDate,
  formatMoney,
  plural,
  statusLabel,
} from "../app-kit";
import type { Column, RowGroup, SegmentOption, Tone } from "../app-kit";
import { TODAY } from "../platform/seed";
import { store, useResource } from "../platform/store";
import type { Discount, Order } from "../platform/types";
import { firstOrderOffer } from "../shop/catalog";
import { Mark, PreviewTag, SelectField, SwitchRow, TextField } from "./fields";
import { TODAY_ISO } from "./metrics";
import { HOME } from "./nav";
import { DrawerLoading } from "./OrderDrawer";
import { preview, usePreview } from "./preview";
import { codeRows, partnerStatus, percent } from "./program";
import type { CodeRow, CodeStatus } from "./program";
import { matches, useQueryParam, useSearchQuery } from "./state";

const CODE_TONE: Record<CodeStatus, Tone> = { active: "signal", inactive: "neutral", expired: "neutral" };
const STATUSES: CodeStatus[] = ["active", "inactive", "expired"];
const kindLabel = (kind: Discount["kind"]) => (kind === "partner" ? "Partner code" : "Promotion");

function CodeChip({ status }: { status: CodeStatus }) {
  return <StatusChip status={status} tone={CODE_TONE[status]} />;
}

const columns: Column<CodeRow>[] = [
  {
    key: "code",
    header: "Code",
    width: "21%",
    mobile: "primary",
    sortValue: (r) => r.code,
    cell: (r) => (
      <span className="cc-marked">
        <span className="kit-mono cc-marked-text">{r.code}</span>
        {r.created ? <Mark>New</Mark> : r.edited ? <Mark>Edited</Mark> : null}
      </span>
    ),
  },
  { key: "percent", header: "Percent", width: "11%", align: "end", mobile: "aside", sortValue: (r) => r.percent, sortFirst: "desc", cell: (r) => `${r.percent}%` },
  {
    key: "partner",
    header: "Partner",
    width: "23%",
    mobile: "secondary",
    sortValue: (r) => r.partner?.name ?? "",
    cell: (r) => r.partner?.name ?? <span className="kit-quiet">No partner</span>,
  },
  {
    key: "uses",
    header: "Uses",
    width: "11%",
    align: "end",
    mobile: "meta",
    sortValue: (r) => r.uses,
    sortFirst: "desc",
    cell: (r) => (
      <>
        {r.uses}
        <span className="cc-unit"> {r.uses === 1 ? "use" : "uses"}</span>
      </>
    ),
  },
  { key: "status", header: "Status", width: "15%", mobile: "meta", sortValue: (r) => STATUSES.indexOf(r.status), cell: (r) => <CodeChip status={r.status} /> },
  {
    key: "expires",
    header: "Last day",
    width: "19%",
    mobile: "meta",
    sortValue: (r) => r.expiresAt ?? "9999",
    cell: (r) => (r.expiresAt ? formatDate(r.expiresAt) : <span className="kit-quiet">No end date</span>),
  },
];

const groups: RowGroup<CodeRow>[] = [
  { key: "promo", label: <span className="cc-group-name">Promotions</span>, match: (r) => r.kind === "promo" },
  { key: "partner", label: <span className="cc-group-name">Partner codes</span>, match: (r) => r.kind === "partner" },
];

export default function Discounts() {
  const discounts = useResource(() => store.partners.discounts(), []);
  const partners = useResource(() => store.partners.list(), []);
  const orders = useResource(() => store.orders.list(), []);
  const changes = usePreview();
  const query = useSearchQuery();
  const [statusParam, setStatus] = useQueryParam("status");
  const [openCode, setOpenCode] = useQueryParam("code");
  const [creating, setCreating] = useQueryParam("create");
  const [, setParams] = useSearchParams();
  const status = STATUSES.includes(statusParam as CodeStatus) ? (statusParam as CodeStatus) : "all";

  const all = useMemo(
    () => (discounts.data && partners.data && orders.data ? codeRows(discounts.data, partners.data, orders.data, changes) : undefined),
    [discounts.data, partners.data, orders.data, changes],
  );
  const searched = useMemo(
    () => (all ?? []).filter((r) => matches(query, r.code, r.partner?.name, r.partner?.handle, kindLabel(r.kind))),
    [all, query],
  );
  const rows = all && searched.filter((r) => status === "all" || r.status === status);
  const loading = discounts.loading || partners.loading || orders.loading;
  const error = discounts.error ?? partners.error ?? orders.error;
  const reload = () => {
    discounts.reload();
    partners.reload();
    orders.reload();
  };

  const options: SegmentOption<CodeStatus | "all">[] = [
    { value: "all", label: "All", count: searched.length },
    ...STATUSES.map((s) => ({ value: s, label: statusLabel(s), count: searched.filter((r) => r.status === s).length })),
  ];

  /** Close the new-code drawer and open the code just made, as one step in history. */
  function showCreated(code: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("create");
        next.set("code", code);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  return (
    <div className="kit-grid">
      <PageHeader
        description="Partner and promotional codes. A code takes its percent off the order subtotal; a partner code also credits the order to its partner."
        meta={
          <>
            {all && <span>{`${plural(all.length, "code")} · ${all.filter((r) => r.status === "active").length} active`}</span>}
            <PreviewTag />
          </>
        }
        actions={
          <Button variant="primary" onClick={() => setCreating("code")}>
            <Plus aria-hidden="true" strokeWidth={1.8} />
            New code
          </Button>
        }
      />
      <div className="kit-toolbar">
        <Segmented
          label="Filter codes by status"
          options={options}
          value={status}
          onChange={(value) => setStatus(value === "all" ? null : value, { replace: true })}
        />
        {all && (query || status !== "all") && (
          <p className="cc-result-count" aria-live="polite">
            {plural(rows?.length ?? 0, "result")}
          </p>
        )}
      </div>
      <div className="kit-card kit-span-12">
        <DataTable
          caption="Discount codes"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.code}
          groups={groups}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(r) => setOpenCode(r.code)}
          activeKey={openCode}
          defaultSort={{ key: "code", dir: "asc" }}
          skeletonRows={8}
          empty={{
            title: query ? "No codes match this search." : "No codes with this status.",
            note: query ? "Search looks at codes, partners and handles." : "Choose another status above.",
          }}
        />
      </div>

      {openCode && (
        <CodeDrawer
          key={openCode}
          code={openCode}
          row={all?.find((r) => r.code === openCode.toUpperCase())}
          orders={orders.data ?? []}
          loading={!all && !error}
          failed={error}
          onRetry={reload}
          onClose={() => setOpenCode(null, { replace: true })}
        />
      )}
      {creating && (
        <NewCodeDrawer
          existing={new Set((all ?? []).map((r) => r.code))}
          partners={(partners.data ?? []).filter((p) => partnerStatus(p, changes) === "active")}
          onCreated={showCreated}
          onClose={() => setCreating(null, { replace: true })}
        />
      )}
    </div>
  );
}

/* ---------- One code ---------- */

/** A fixed list, newest first, like the orders in a customer's drawer. */
const orderColumns: Column<Order>[] = [
  { key: "number", header: "Order", width: "26%", mobile: "primary", cell: (o) => <span className="kit-mono">{o.number}</span> },
  { key: "placed", header: "Placed", width: "28%", mobile: "meta", cell: (o) => formatDate(o.createdAt) },
  { key: "total", header: "Total", width: "20%", align: "end", mobile: "aside", cell: (o) => formatMoney(o.total) },
  { key: "status", header: "Status", width: "26%", mobile: "secondary", cell: (o) => <StatusChip status={o.status} /> },
];

function CodeDrawer({
  code,
  row,
  orders,
  loading,
  failed,
  onRetry,
  onClose,
}: {
  code: string;
  row: CodeRow | undefined;
  orders: Order[];
  loading: boolean;
  failed: Error | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const used = useMemo(
    () => (row ? orders.filter((o) => o.discount?.code === row.code).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [orders, row],
  );

  if (!row) {
    return (
      <Drawer title="Discount code" eyebrow="Discount code" onClose={onClose}>
        {loading ? (
          <DrawerLoading />
        ) : failed ? (
          <EmptyState compact title="This code could not be loaded." note={failed.message} action={<Button onClick={onRetry}>Try again</Button>} />
        ) : (
          <EmptyState
            compact
            title="No code matches this link."
            note={
              <>
                Nothing is on file for <span className="kit-mono">{code}</span>. Codes made in the preview last until the page reloads.
              </>
            }
          />
        )}
      </Drawer>
    );
  }

  const advertised = row.code === firstOrderOffer.code;

  return (
    <Drawer
      mono
      title={row.code}
      eyebrow="Discount code"
      subtitle={`${row.partner ? `Partner code · ${row.partner.name}` : "Promotion"} · ${row.percent}% off the order subtotal`}
      tags={
        <>
          <CodeChip status={row.status} />
          {row.created ? <Mark>New</Mark> : row.edited ? <Mark>Edited</Mark> : null}
          <span className="cc-tag-text">{plural(row.uses, "use")}</span>
        </>
      }
      onClose={onClose}
    >
      <div className="cc-live" aria-live="polite">
        {message && <p className="kit-note">{message}</p>}
        {row.created && !message && <p className="kit-note">Made in this preview. It lasts until the page reloads.</p>}
      </div>

      <Section title="At checkout">
        <SwitchRow
          title="Active at checkout"
          description={`Buyers can apply ${row.code} to an order.`}
          checked={row.locked ? false : row.enabled}
          locked={row.locked ? "Locked" : undefined}
          note={row.locked}
          onChange={
            row.locked
              ? undefined
              : (value) => {
                  preview.setCodeActive(row.code, value);
                  setMessage(`${row.code} is now ${value ? "active" : "inactive"} in this preview.`);
                }
          }
        />
        {advertised && !row.active && (
          <p className="cc-footnote">The shop still advertises {row.code} as its first-order offer.</p>
        )}
        <div className="cc-preview-line">
          <PreviewTag />
        </div>
      </Section>

      <Section title="Code">
        <Facts
          items={[
            { label: "Kind", value: kindLabel(row.kind) },
            { label: "Percent off", value: `${row.percent}% of the order subtotal` },
            ...(row.partner
              ? [
                  {
                    label: "Partner",
                    value: (
                      <Link className="cc-inline-link" to={`${HOME}/partners?partner=${row.partner.id}`}>
                        {row.partner.name}
                      </Link>
                    ),
                  },
                  {
                    label: "Commission",
                    value: (
                      <span className="cc-fact-line">
                        {percent(row.partner.rate)} of the order subtotal after discount <SampleTag>Sample rate</SampleTag>
                      </span>
                    ),
                  },
                ]
              : []),
            { label: "Last day", value: row.expiresAt ? formatDate(row.expiresAt) : <span className="kit-quiet">No end date</span> },
            ...(advertised ? [{ label: "Advertised", value: "In the shop, as the first-order offer" }] : []),
          ]}
        />
      </Section>

      <Section title="Orders with this code">
        <div className="cc-drawer-table">
          <DataTable
            caption={`Orders placed with ${row.code}`}
            columns={orderColumns}
            rows={used}
            rowKey={(o) => o.id}
            onRowClick={(o) => navigate(`${HOME}/orders?order=${o.id}`)}
            stickyHeader={false}
            empty={{ title: "Not used yet." }}
          />
        </div>
      </Section>
    </Drawer>
  );
}

/* ---------- A new code ---------- */

type Draft = { code: string; kind: Discount["kind"]; partnerId: string; percent: string; ends: string; active: boolean };
type Field = "code" | "partnerId" | "percent" | "ends";
type Errors = Partial<Record<Field, string>>;

const FIELDS: Field[] = ["code", "partnerId", "percent", "ends"];

function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function validate(draft: Draft, existing: Set<string>): Errors {
  const errors: Errors = {};
  const code = draft.code.trim();
  if (!code) errors.code = "Enter a code.";
  else if (!/^[A-Z0-9]+$/.test(code)) errors.code = "Use letters and digits only, with no spaces or symbols.";
  else if (code.length < 3 || code.length > 16) errors.code = "Use 3 to 16 letters and digits.";
  else if (existing.has(code)) errors.code = `${code} already exists. Choose another code.`;

  if (draft.kind === "partner" && !draft.partnerId) errors.partnerId = "Choose the partner this code belongs to.";

  const amount = draft.percent.trim().replace(/%$/, "").trim();
  if (!amount) errors.percent = "Enter a percent from 1 to 50.";
  else if (!/^\d+$/.test(amount) || Number(amount) < 1 || Number(amount) > 50) errors.percent = "Use a whole number from 1 to 50.";

  if (draft.ends && draft.ends <= TODAY) errors.ends = `Choose a day after ${formatDate(TODAY_ISO)}, or leave it empty.`;
  return errors;
}

function NewCodeDrawer({
  existing,
  partners,
  onCreated,
  onClose,
}: {
  existing: Set<string>;
  partners: { id: string; name: string; handle: string; codeDiscount: number }[];
  onCreated: (code: string) => void;
  onClose: () => void;
}) {
  const formId = useId();
  const [draft, setDraft] = useState<Draft>({ code: "", kind: "promo", partnerId: "", percent: "", ends: "", active: true });
  const [touched, setTouched] = useState<Set<Field>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const refs = {
    code: useRef<HTMLInputElement>(null),
    partnerId: useRef<HTMLSelectElement>(null),
    percent: useRef<HTMLInputElement>(null),
    ends: useRef<HTMLInputElement>(null),
  };

  const errors = validate(draft, existing);
  const shown = (field: Field) => (submitted || touched.has(field) ? errors[field] : undefined);
  const touch = (field: Field) => setTouched((current) => new Set(current).add(field));
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const first = FIELDS.find((field) => errors[field]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    const code = draft.code.trim();
    preview.addCode({
      code,
      kind: draft.kind,
      percent: Number(draft.percent.trim().replace(/%$/, "").trim()),
      partnerId: draft.kind === "partner" ? draft.partnerId : undefined,
      active: draft.active,
      uses: 0,
      expiresAt: draft.ends ? `${draft.ends}T23:59:00.000Z` : undefined,
    });
    onCreated(code);
  }

  const count = FIELDS.filter((field) => shown(field)).length;

  return (
    <Drawer
      title="New code"
      eyebrow="Discount code"
      subtitle="A promotion takes its percent off the order subtotal; a partner code also credits the order to its partner."
      footer={
        <div className="cc-confirm-actions cc-foot-row">
          <Button type="submit" form={formId} variant="primary">
            Create code
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <PreviewTag />
        </div>
      }
      onClose={onClose}
    >
      <form id={formId} className="cc-form" onSubmit={submit} noValidate>
        <p className="kit-sr" aria-live="polite">
          {submitted && count ? `${plural(count, "field")} to correct.` : ""}
        </p>
        <TextField
          label="Code"
          mono
          size="medium"
          value={draft.code}
          inputRef={refs.code}
          onChange={(value) => set({ code: value.toUpperCase() })}
          onBlur={() => touch("code")}
          error={shown("code")}
          hint="Letters and digits, 3 to 16 characters. Buyers type it at checkout."
        />

        <div className="kit-field">
          <p className="kit-field-label" aria-hidden="true">
            Kind
          </p>
          <Segmented
            label="Kind"
            value={draft.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: "promo", label: "Promotion" },
              { value: "partner", label: "Partner code" },
            ]}
          />
        </div>

        {draft.kind === "partner" && (
          <SelectField
            label="Partner"
            value={draft.partnerId}
            selectRef={refs.partnerId}
            placeholder="Choose a partner"
            options={partners.map((p) => ({ value: p.id, label: `${p.name} ${p.handle}` }))}
            onChange={(partnerId) => {
              const partner = partners.find((p) => p.id === partnerId);
              set({ partnerId, percent: draft.percent || (partner ? String(Math.round(partner.codeDiscount * 100)) : "") });
              touch("partnerId");
            }}
            onBlur={() => touch("partnerId")}
            error={shown("partnerId")}
            hint="Active partners only. Orders with the code count toward their commission."
          />
        )}

        <TextField
          label="Percent off"
          suffix="%"
          size="short"
          inputMode="numeric"
          value={draft.percent}
          inputRef={refs.percent}
          onChange={(value) => set({ percent: value })}
          onBlur={() => touch("percent")}
          error={shown("percent")}
          hint="A whole number from 1 to 50, taken off the order subtotal."
        />

        <TextField
          label="Last day"
          type="date"
          size="medium"
          min={nextDay(TODAY)}
          value={draft.ends}
          inputRef={refs.ends}
          onChange={(value) => set({ ends: value })}
          onBlur={() => touch("ends")}
          error={shown("ends")}
          hint="Optional. Leave empty for a code with no end date."
        />

        <SwitchRow
          title="Active at checkout"
          description="Buyers can apply the code as soon as it is created."
          checked={draft.active}
          onChange={(active) => set({ active })}
        />
      </form>
    </Drawer>
  );
}
