import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { useMemo, useState } from "react";
import { Check, FileText } from "lucide-react";
import {
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Facts,
  PageHeader,
  Section,
  Segmented,
  StatusChip,
  TextAreaField,
  formatDate,
  plural,
  statusLabel,
} from "../app-kit";
import type { Column, SegmentOption } from "../app-kit";
import { store, useResource } from "../platform/store";
import type { Application, ApplicationStatus } from "../platform/types";
import { DrawerLoading } from "./OrderDrawer";
import { matches, useQueryParam, useSearchQuery } from "./state";

/** The attestation wording from the research account application. */
const ATTESTATIONS: Record<string, string> = {
  "research-only": "For laboratory research use only",
  "not-for-human-use": "Not for human or veterinary use",
  "storage-sop": "Stored and handled under the laboratory's procedures",
  terms: "Accepts the terms of sale",
};
const attestation = (id: string) => ATTESTATIONS[id] ?? statusLabel(id.replace(/-/g, " "));

const STATUSES: ApplicationStatus[] = ["submitted", "approved", "declined"];
const rank = (a: Application) => (a.status === "submitted" ? 0 : 1);

const columns: Column<Application>[] = [
  { key: "name", header: "Applicant", width: "20%", mobile: "primary", sortValue: (a) => a.name, cell: (a) => a.name },
  {
    key: "institution",
    header: "Institution",
    width: "27%",
    mobile: "secondary",
    sortValue: (a) => a.institution,
    cell: (a) => a.institution,
  },
  { key: "type", header: "Type", width: "18%", sortValue: (a) => a.institutionType, cell: (a) => a.institutionType },
  { key: "area", header: "Research area", width: "15%", sortValue: (a) => a.researchArea, cell: (a) => a.researchArea },
  {
    key: "submitted",
    header: "Submitted",
    width: "11%",
    sortValue: (a) => a.submittedAt,
    sortFirst: "desc",
    cell: (a) => formatDate(a.submittedAt),
  },
  {
    key: "status",
    header: "Status",
    width: "11%",
    mobile: "aside",
    sortValue: (a) => STATUSES.indexOf(a.status),
    cell: (a) => <StatusChip status={a.status} />,
  },
];

export default function Applications() {
  const applications = useResource(() => store.applications.list(), []);
  const query = useSearchQuery();
  const [statusParam, setStatus] = useQueryParam("status");
  const [openId, setOpenId] = useQueryParam("application");
  const status = STATUSES.includes(statusParam as ApplicationStatus) ? (statusParam as ApplicationStatus) : "all";

  const searched = useMemo(
    () =>
      (applications.data ?? [])
        .filter((a) => matches(query, a.name, a.institution, a.researchArea, a.email, a.role, a.institutionType))
        .sort((a, b) => rank(a) - rank(b) || b.submittedAt.localeCompare(a.submittedAt)),
    [applications.data, query],
  );
  const rows = applications.data && searched.filter((a) => status === "all" || a.status === status);
  const waiting = (applications.data ?? []).filter((a) => a.status === "submitted").length;

  const options: SegmentOption<ApplicationStatus | "all">[] = [
    { value: "all", label: "All", count: searched.length },
    ...STATUSES.map((s) => ({ value: s, label: statusLabel(s), count: searched.filter((a) => a.status === s).length })),
  ];

  return (
    <div className="kit-grid">
      <PageHeader
        description="Requests for research accounts, submitted ones first. An approved account is what lets a buyer check out."
        meta={applications.data && <span>{`${plural(applications.data.length, "application")} · ${waiting} awaiting review`}</span>}
      />
      <div className="kit-toolbar">
        <Segmented
          label="Filter applications by status"
          options={options}
          value={status}
          onChange={(value) => setStatus(value === "all" ? null : value, { replace: true })}
        />
      </div>
      <div className="kit-card kit-span-12">
        <DataTable
          caption="Applications"
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          loading={applications.loading}
          error={applications.error}
          onRetry={applications.reload}
          onRowClick={(a) => setOpenId(a.id)}
          activeKey={openId}
          skeletonRows={7}
          empty={{
            title: query ? "No applications match this search." : "No applications with this status.",
            note: query ? "Search looks at names, institutions, research areas and emails." : undefined,
          }}
        />
      </div>
      {openId && <ApplicationDrawer key={openId} id={openId} onClose={() => setOpenId(null, { replace: true })} />}
    </div>
  );
}

type Step = { kind: "idle" } | { kind: "approve" } | { kind: "decline"; note: string; error?: string };

function ApplicationDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const uploads = useResource(() => LIVE ? live().uploads.list(id) : Promise.resolve([]), [id]);
  const [opening, setOpening] = useState<string | null>(null);
  const list = useResource(() => store.applications.list(), []);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const a = list.data?.find((item) => item.id === id);

  if (!a) {
    return (
      <Drawer title="Application" eyebrow="Application" onClose={onClose}>
        {list.loading ? (
          <DrawerLoading />
        ) : list.error ? (
          <EmptyState compact title="This application could not be loaded." note={list.error.message} action={<Button onClick={list.reload}>Try again</Button>} />
        ) : (
          <EmptyState compact title="No application matches this link." />
        )}
      </Drawer>
    );
  }

  async function review(status: "approved" | "declined", note?: string) {
    if (!a) return;
    setSaving(true);
    setFailed(null);
    try {
      await store.applications.review(a.id, status, note);
      setStep({ kind: "idle" });
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "The decision was not saved.");
    } finally {
      setSaving(false);
    }
  }

  let footer = null;
  if (a.status === "submitted") {
    if (step.kind === "approve") {
      footer = (
        <div className="cc-confirm" role="group" aria-label="Confirm approval">
          <p className="cc-confirm-text">
            Approve {a.name} at {a.institution}?
          </p>
          <div className="cc-confirm-actions">
            <Button variant="primary" onClick={() => review("approved")} disabled={saving}>
              {saving ? "Saving" : "Confirm approval"}
            </Button>
            <Button onClick={() => setStep({ kind: "idle" })} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      );
    } else if (step.kind === "decline") {
      footer = (
        <form
          className="cc-confirm"
          onSubmit={(event) => {
            event.preventDefault();
            const note = step.note.trim();
            if (!note) {
              setStep({ ...step, error: "Add a note before declining." });
              return;
            }
            void review("declined", note);
          }}
        >
          <TextAreaField
            label="Reason for declining"
            value={step.note}
            onChange={(note) => setStep({ kind: "decline", note })}
            hint="Kept with the application."
            error={step.error}
            required
          />
          <div className="cc-confirm-actions">
            <Button type="submit" variant="danger" disabled={saving}>
              {saving ? "Saving" : "Decline application"}
            </Button>
            <Button onClick={() => setStep({ kind: "idle" })} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      );
    } else {
      footer = (
        <div className="cc-confirm-actions">
          <Button variant="primary" onClick={() => setStep({ kind: "approve" })}>
            Approve
          </Button>
          <Button variant="danger" onClick={() => setStep({ kind: "decline", note: "" })}>
            Decline
          </Button>
        </div>
      );
    }
  }

  return (
    <Drawer
      title={a.name}
      eyebrow="Application"
      subtitle={`${a.role} · ${a.institution}`}
      tags={
        <>
          <StatusChip status={a.status} />
          <span className="cc-tag-text">Submitted {formatDate(a.submittedAt)}</span>
        </>
      }
      footer={footer}
      onClose={onClose}
    >
      <div className="cc-live" aria-live="polite">
        {failed && <p className="kit-field-error">{failed}</p>}
      </div>

      {a.status !== "submitted" && (
        <Section title="Decision">
          <Facts
            items={[
              { label: "Decision", value: <StatusChip status={a.status} /> },
              { label: "Reviewed", value: a.reviewedAt ? formatDate(a.reviewedAt) : <span className="kit-quiet">Not recorded</span> },
              ...(a.reviewNote ? [{ label: "Note", value: a.reviewNote }] : []),
            ]}
          />
        </Section>
      )}

      <Section title="Applicant">
        <Facts
          items={[
            { label: "Name", value: a.name },
            { label: "Role", value: a.role },
            { label: "Email", value: a.email },
          ]}
        />
      </Section>

      <Section title="Institution">
        <Facts
          items={[
            { label: "Name", value: a.institution },
            { label: "Type", value: a.institutionType },
            { label: "Website", value: a.website ?? <span className="kit-quiet">Not given</span> },
          ]}
        />
      </Section>

      <Section title="Research use">
        <Facts items={[{ label: "Area", value: a.researchArea }]} />
        <p className="cc-prose">{a.intendedUse}</p>
      </Section>

      <Section title="Attestations">
        <ul className="cc-checks">
          {a.attestations.map((item) => (
            <li key={item}>
              <Check aria-hidden="true" strokeWidth={1.8} />
              {attestation(item)}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Documents">
        {LIVE ? uploads.loading ? <DrawerLoading /> : uploads.error ? (
          <EmptyState compact title={uploads.error.message} action={<Button onClick={uploads.reload}>Try again</Button>} />
        ) : uploads.data?.length ? (
          <ul className="cc-files">
            {uploads.data.map((file) => <li key={file.id}>
              <FileText aria-hidden="true" strokeWidth={1.5} />
              {file.name} · {file.size} bytes
              <Button disabled={opening !== null} onClick={async () => {
                const tab = window.open("about:blank", "_blank");
                if (tab) tab.opener = null;
                setOpening(file.id); setFailed(null);
                try {
                  const url = await live().uploads.open(file.path);
                  if (tab) tab.location.href = url;
                } catch (error) { tab?.close(); setFailed(error instanceof Error ? error.message : null); }
                finally { setOpening(null); }
              }}>Open</Button>
            </li>)}
          </ul>
        ) : <p className="kit-note">No documents attached.</p> : <>
          {a.documents.length ? <ul className="cc-files">{a.documents.map((file) => <li key={file}><FileText aria-hidden="true" strokeWidth={1.5} />{file}</li>)}</ul> : <p className="kit-note">No documents attached.</p>}
          <p className="cc-footnote">File names only. Documents are not stored in this preview.</p>
        </>}
      </Section>
    </Drawer>
  );
}
