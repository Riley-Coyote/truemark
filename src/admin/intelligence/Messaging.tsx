import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  Drawer,
  PageHeader,
  Segmented,
  formatDateTime,
} from "../../app-kit";
import { BuyerEmail, buyerEmailsFor } from "../../shop/pages/account/emails";
import { matches } from "../state";
import {
  BusinessProvider,
  DeviceNote,
  ExportButton,
  SourceNote,
  Table,
  isObject,
  useBusiness,
  useDeviceState,
} from "./shared";

export function MessageWorkspace({ kind }: { kind: "inbox" | "deliveries" }) {
  return (
    <BusinessProvider>
      <SampleMessages key={kind} kind={kind} />
    </BusinessProvider>
  );
}

function SampleMessages({ kind }: { kind: "inbox" | "deliveries" }) {
  const data = useBusiness();
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [reply, setReply] = useState("");
  const [notes, setNotes, warning] = useDeviceState<
    Record<string, { handled: boolean; draft: string }>
  >(
    "inbox-drafts",
    {},
    (v): v is Record<string, { handled: boolean; draft: string }> =>
      isObject(v) &&
      Object.values(v).every(
        (n) =>
          isObject(n) &&
          typeof n.handled === "boolean" &&
          typeof n.draft === "string",
      ),
  );
  const contacts = data.buyers.slice(0, 4).map((b, i) => ({
    id: `sample-contact-${b.id}`,
    buyer: b,
    topic: [
      "Order tracking",
      "Lot documentation",
      "Research account",
      "Volume purchasing",
    ][i],
    text: [
      "Where can I review the shipment tracking for my research order?",
      "Please point me to the documentation and lot lookup for a product.",
      "What information should our institution provide for account verification?",
      "Please share the process for reviewing a larger research purchase.",
    ][i],
    at: data.asOf,
  }));
  const emails = data.orders.flatMap((o) =>
    buyerEmailsFor(o).map((e) => ({
      ...e,
      id: `${o.id}-${e.kind}`,
      order: o,
      buyer: data.buyers.find((b) => b.id === o.buyerId),
    })),
  );
  const contact = contacts.find((m) => m.id === selected),
    email = emails.find((m) => m.id === selected);
  const contactRows = contacts.filter(
    (m) =>
      (filter === "all" ||
        (filter === "handled") === Boolean(notes[m.id]?.handled)) &&
      matches(query, m.buyer.name, m.buyer.email, m.buyer.institution, m.topic, m.text),
  );
  const emailRows = emails.filter(
    (m) =>
      (filter === "all" || m.kind === filter) &&
      matches(query, m.subject, m.buyer?.name, m.buyer?.email, m.buyer?.institution, m.order.number),
  );
  return (
    <div className="bi-page">
      <PageHeader
        description={
          kind === "inbox"
            ? "Review sample enquiries, prepare a response, and keep track of handled items."
            : "Inspect the existing transactional email designs using the sample order lifecycle."
        }
      />
      <SourceNote />
      <p className="bi-source">
        {kind === "inbox"
          ? "Fictional enquiries · Response drafts saved on this device · No email is sent"
          : "Template previews · Expected order messages, not a provider delivery log"}
      </p>
      <Card
        title={
          kind === "inbox" ? "Sample enquiry queue" : "Order email previews"
        }
        meta={
          <Segmented
            label="Message filter"
            value={filter}
            onChange={setFilter}
            options={
              kind === "inbox"
                ? [
                    { value: "all", label: "All" },
                    { value: "new", label: "New" },
                    { value: "handled", label: "Handled" },
                  ]
                : [
                    { value: "all", label: "All" },
                    { value: "confirmed", label: "Confirmation" },
                    { value: "shipped", label: "Shipped" },
                    { value: "delivered", label: "Delivered" },
                  ]
            }
          />
        }
      >
        <label className="bi-field">
          Find a message
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Name, subject or email"
          />
        </label>
        {kind === "inbox" ? (
          <Table
            label="Fictional customer enquiries"
            rows={contactRows}
            rowKey={(m) => m.id}
            onSelect={(m) => {
              setSelected(m.id);
              setReply(notes[m.id]?.draft ?? "");
            }}
            columns={[
              {
                key: "from",
                label: "From",
                get: (m) => (
                  <>
                    {m.buyer.name}
                    <span className="bi-cell-note">{m.buyer.institution}</span>
                  </>
                ),
              },
              { key: "topic", label: "Topic", get: (m) => m.topic },
              {
                key: "state",
                label: "Local state",
                get: (m) => (notes[m.id]?.handled ? "Handled in plan" : "New"),
              },
            ]}
          />
        ) : (
          <Table
            label="Transactional email template previews"
            rows={emailRows}
            rowKey={(m) => m.id}
            onSelect={(m) => setSelected(m.id)}
            columns={[
              {
                key: "subject",
                label: "Template subject",
                get: (m) => m.subject,
              },
              {
                key: "to",
                label: "Sample recipient",
                get: (m) => m.buyer?.email ?? "No recipient recorded",
              },
              {
                key: "time",
                label: "Order event UTC",
                get: (m) => formatDateTime(m.at),
                sort: (m) => m.at,
              },
              { key: "state", label: "Basis", get: () => "Template preview" },
            ]}
          />
        )}
      </Card>
      <DeviceNote warning={warning} />
      <p className="bi-small">
        The live platform uses its actual contact inbox and email/SMS delivery
        log. Delivery providers, routes and notification settings are reviewed
        in{" "}
        <Link className="bi-link" to="/admin/settings?section=connections">
          Settings → Connections
        </Link>
        .
      </p>
      {contact && kind === "inbox" && (
        <Drawer
          title={contact.topic}
          eyebrow={contact.buyer.name}
          onClose={() => setSelected(null)}
          footer={
            <Button
              onClick={() => {
                setNotes((n) => ({
                  ...n,
                  [contact.id]: { handled: true, draft: reply },
                }));
                setSelected(null);
              }}
            >
              Save draft and mark handled locally
            </Button>
          }
        >
          <p>{contact.text}</p>
          <p className="bi-small">
            {contact.buyer.email} · Fictional sample enquiry
          </p>
          <label className="bi-field">
            Response draft
            <textarea
              rows={8}
              value={reply}
              maxLength={5000}
              onChange={(e) => setReply(e.target.value)}
            />
          </label>
          <ExportButton
            name="reply-draft"
            label="Export response draft"
            headers={["To", "Subject", "Response draft", "State"]}
            rows={[
              [
                contact.buyer.email,
                `Re: ${contact.topic}`,
                reply,
                "Draft — not sent",
              ],
            ]}
          />
          <DeviceNote />
        </Drawer>
      )}
      {email && kind === "deliveries" && (
        <Drawer
          title={email.subject}
          eyebrow="Existing email design · Preview only"
          onClose={() => setSelected(null)}
        >
          <BuyerEmail
            kind={email.kind}
            order={email.order}
            to={{
              name: email.buyer?.name ?? "Sample researcher",
              email: email.buyer?.email ?? "researcher@example.test",
            }}
            lots={data.lots}
          />
        </Drawer>
      )}
    </div>
  );
}
