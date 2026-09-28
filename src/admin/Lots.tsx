import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FileUp } from "lucide-react";
import {
  Button,
  DataTable,
  Dot,
  Drawer,
  EmptyState,
  Facts,
  PageHeader,
  SampleTag,
  Section,
  Select,
  StatusChip,
  formatDate,
  formatCount,
  plural,
  statusLabel,
} from "../app-kit";
import type { Column, RowGroup } from "../app-kit";
import { store, useResource } from "../platform/store";
import type { Lot, LotStatus } from "../platform/types";
import { productById } from "../shop/catalog";
import { DrawerLoading } from "./OrderDrawer";
import { matches, useQueryParam, useSearchQuery } from "./state";

const ORDER: LotStatus[] = ["quarantine", "testing", "released", "rejected", "archived"];

type Kind = "all" | "batch" | "sample";

const productLabel = (lot: Lot) => {
  const product = productById(lot.productId);
  return product ? `${product.name} ${product.size}` : lot.productId;
};

const columns: Column<Lot>[] = [
  {
    key: "product",
    header: "Product",
    width: "32%",
    mobile: "secondary",
    sortValue: productLabel,
    cell: (lot) => {
      const product = productById(lot.productId);
      return (
        <span className="kit-cell-name">
          <Dot colour={product?.color} />
          <span>
            {product?.name ?? lot.productId}
            <span className="kit-cell-sub">{product?.size}</span>
          </span>
        </span>
      );
    },
  },
  {
    key: "lot",
    header: "Lot",
    width: "26%",
    mobile: "primary",
    sortValue: (lot) => lot.lot,
    cell: (lot) => (
      <span className="cc-lot-cell">
        <span className="kit-mono">{lot.lot}</span>
        {lot.sample && <span className="cc-sample-mark">Sample</span>}
      </span>
    ),
  },
  {
    key: "received",
    header: "Received",
    width: "15%",
    sortValue: (lot) => lot.receivedAt,
    sortFirst: "desc",
    cell: (lot) => formatDate(lot.receivedAt),
  },
  {
    key: "released",
    header: "Released",
    width: "15%",
    sortValue: (lot) => lot.releasedAt ?? "",
    sortFirst: "desc",
    cell: (lot) => (lot.releasedAt ? formatDate(lot.releasedAt) : <span className="kit-quiet">Not released</span>),
  },
  {
    key: "units",
    header: "Units",
    width: "12%",
    align: "end",
    mobile: "aside",
    sortValue: (lot) => lot.units,
    sortFirst: "desc",
    cell: (lot) => (
      <>
        {formatCount(lot.units)}
        <span className="kit-sr"> units</span>
      </>
    ),
  },
];

const groups: RowGroup<Lot>[] = ORDER.map((status) => ({
  key: status,
  label: <StatusChip status={status} />,
  match: (lot: Lot) => lot.status === status,
}));

export default function Lots() {
  const lots = useResource(() => store.lots.list(), []);
  const query = useSearchQuery();
  const [kind, setKind] = useState<Kind>("all");
  const [openLot, setOpenLot] = useQueryParam("lot");

  const rows = useMemo(
    () =>
      lots.data?.filter(
        (lot) =>
          (kind === "all" || (kind === "sample") === lot.sample) &&
          matches(query, lot.lot, productById(lot.productId)?.name, lot.reference),
      ),
    [lots.data, kind, query],
  );

  const all = lots.data ?? [];
  return (
    <div className="kit-grid">
      <PageHeader
        description="Every lot on file, grouped by release status. Lots from the client's first batch carry real identifiers and no results; sample lots are fictional and show the other states."
        meta={lots.data && <span>{plural(all.length, "lot")}</span>}
      />
      <div className="kit-toolbar">
        <Select<Kind>
          label="Which lots to show"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: `All lots (${all.length})` },
            { value: "batch", label: `First batch (${all.filter((l) => !l.sample).length})` },
            { value: "sample", label: `Sample lots (${all.filter((l) => l.sample).length})` },
          ]}
        />
        {lots.data && (query || kind !== "all") && (
          <p className="cc-result-count" aria-live="polite">
            {plural(rows?.length ?? 0, "result")}
          </p>
        )}
      </div>
      <div className="kit-card kit-span-12">
        <DataTable
          caption="Lots and certificates"
          columns={columns}
          rows={rows}
          rowKey={(lot) => lot.lot}
          groups={groups}
          loading={lots.loading}
          error={lots.error}
          onRetry={lots.reload}
          onRowClick={(lot) => setOpenLot(lot.lot)}
          activeKey={openLot}
          defaultSort={{ key: "received", dir: "desc" }}
          skeletonRows={10}
          empty={{ title: "No lots match.", note: "Search looks at lot numbers, compounds and certificate references." }}
        />
      </div>
      {openLot && <LotDrawer key={openLot} lotId={openLot} onClose={() => setOpenLot(null, { replace: true })} />}
    </div>
  );
}

type Action = { to: LotStatus; label: string; variant: "primary" | "quiet" | "danger" };

const ACTIONS: Record<LotStatus, Action[]> = {
  quarantine: [
    { to: "testing", label: "Move to testing", variant: "primary" },
    { to: "rejected", label: "Reject", variant: "danger" },
  ],
  testing: [
    { to: "released", label: "Release", variant: "primary" },
    { to: "rejected", label: "Reject", variant: "danger" },
  ],
  released: [{ to: "archived", label: "Archive", variant: "quiet" }],
  rejected: [{ to: "archived", label: "Archive", variant: "quiet" }],
  archived: [],
};

function confirmText(lot: Lot, to: LotStatus): string {
  switch (to) {
    case "testing":
      return `Move ${lot.lot} from quarantine to testing?`;
    case "released":
      return `Release ${lot.lot}? Its record becomes public on the verify page.`;
    case "rejected":
      return `Reject ${lot.lot}? It will not be released.`;
    default:
      return `Archive ${lot.lot}? It leaves the active lots and stays on file.`;
  }
}

function LotDrawer({ lotId, onClose }: { lotId: string; onClose: () => void }) {
  const lot = useResource(() => store.lots.get(lotId), [lotId]);
  const [pending, setPending] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const l = lot.data;

  if (!l) {
    return (
      <Drawer title="Lot" eyebrow="Lot" onClose={onClose}>
        {lot.loading ? (
          <DrawerLoading />
        ) : lot.error ? (
          <EmptyState compact title="This lot could not be loaded." note={lot.error.message} action={<Button onClick={lot.reload}>Try again</Button>} />
        ) : (
          <EmptyState
            compact
            title="No lot matches this link."
            note={
              <>
                Nothing is on file for <span className="kit-mono">{lotId}</span>.
              </>
            }
          />
        )}
      </Drawer>
    );
  }

  const product = productById(l.productId);
  const hasResults = l.results.length > 0;
  const actions = ACTIONS[l.status];
  const releaseBlocked = l.status === "testing" && !hasResults;

  async function apply(action: Action) {
    if (!l) return;
    setSaving(true);
    setFailed(null);
    try {
      await store.lots.setStatus(l.lot, action.to);
      setDone(`${l.lot} is now ${statusLabel(action.to).toLowerCase()}.`);
      setPending(null);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "The change was not saved.");
    } finally {
      setSaving(false);
    }
  }

  const footer = pending ? (
    <div className="cc-confirm" role="group" aria-label="Confirm the change">
      <p className="cc-confirm-text">{confirmText(l, pending.to)}</p>
      <div className="cc-confirm-actions">
        <Button variant={pending.variant === "danger" ? "danger" : "primary"} onClick={() => apply(pending)} disabled={saving}>
          {saving ? "Saving" : `Confirm: ${pending.label.toLowerCase()}`}
        </Button>
        <Button onClick={() => setPending(null)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  ) : actions.length ? (
    <div className="cc-actions">
      <div className="cc-confirm-actions">
        {actions.map((action) => (
          <Button
            key={action.to}
            variant={action.variant}
            disabled={action.to === "released" && releaseBlocked}
            aria-describedby={action.to === "released" && releaseBlocked ? "cc-release-note" : undefined}
            onClick={() => {
              setDone(null);
              setPending(action);
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {releaseBlocked && (
        <p id="cc-release-note" className="cc-footnote">
          Release needs laboratory results attached first.{" "}
          {l.sample ? "This sample lot has none on file." : "None have been supplied for this lot yet."}
        </p>
      )}
    </div>
  ) : (
    <p className="cc-footnote">Archived lots stay on file. There is nothing further to do.</p>
  );

  return (
    <Drawer
      mono
      title={l.lot}
      eyebrow={l.sample ? "Lot · sample" : "Lot · first batch"}
      subtitle={product ? `${product.name} ${product.size} · ${product.form}` : l.productId}
      tags={
        <>
          <StatusChip status={l.status} />
          {l.sample && <SampleTag>Fictional sample lot</SampleTag>}
        </>
      }
      footer={footer}
      onClose={onClose}
    >
      <div className="cc-live" aria-live="polite">
        {done && <p className="kit-note">{done}</p>}
        {failed && <p className="kit-field-error">{failed}</p>}
      </div>

      <Section title="Record">
        <Facts
          items={[
            {
              label: "Product",
              value: (
                <span className="kit-cell-name">
                  <Dot colour={product?.color} />
                  <span>{product ? `${product.name} ${product.size}` : l.productId}</span>
                </span>
              ),
            },
            { label: "Status", value: <StatusChip status={l.status} /> },
            { label: "Received", value: formatDate(l.receivedAt) },
            { label: "Released", value: l.releasedAt ? formatDate(l.releasedAt) : <span className="kit-quiet">Not released</span> },
            { label: "Units", value: <span className="kit-num">{formatCount(l.units)}</span> },
            {
              label: "Certificate",
              value: l.reference ? <span className="kit-mono">{l.reference}</span> : <span className="kit-quiet">None on file</span>,
            },
          ]}
        />
      </Section>

      <Section title="Results">
        {hasResults ? (
          <dl className="cc-results">
            {l.results.map((result) => (
              <div key={result.label}>
                <dt>
                  {result.label}
                  <span>{result.method}</span>
                </dt>
                <dd>
                  {result.value}
                  {result.unit && <small>{result.unit}</small>}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="kit-note">
            {l.sample
              ? "No results on file for this sample lot."
              : "No results on file. The laboratory results for the first batch have not been supplied."}
          </p>
        )}
        {hasResults && l.sample && <p className="cc-footnote">Illustrative values for a fictional sample lot.</p>}
      </Section>

      <Section title="Certificate file">
        <div className="cc-upload" aria-disabled="true">
          <FileUp aria-hidden="true" strokeWidth={1.4} />
          <div>
            <p className="cc-upload-title">Certificate of analysis, PDF</p>
            <p className="cc-footnote">PDF upload arrives with the backend.</p>
          </div>
        </div>
      </Section>

      {l.status === "released" && (
        <Section title="Public record">
          <Link className="cc-public-link" to={`/verify?lot=${encodeURIComponent(l.lot)}`} target="_blank" rel="noreferrer">
            <span className="kit-mono">/verify?lot={l.lot}</span>
            <ArrowUpRight aria-hidden="true" strokeWidth={1.6} />
            <span className="kit-sr">, opens in a new tab</span>
          </Link>
        </Section>
      )}
    </Drawer>
  );
}
