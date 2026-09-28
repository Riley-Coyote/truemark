import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import type { Address } from "../../../platform/types";
import { Field, PageHead, SampleTag, useAccount, useTitle } from "./parts";

type Draft = Pick<Address, "label" | "institution" | "attention" | "line1" | "city" | "region" | "postal"> & {
  line2: string;
  phone: string;
};
type Key = keyof Draft;

const blank: Draft = { label: "", institution: "", attention: "", line1: "", line2: "", city: "", region: "", postal: "", phone: "" };

function check(key: Key, value: string): string | undefined {
  const v = value.trim();
  switch (key) {
    case "label":
      return v ? undefined : "Give the address a short name.";
    case "institution":
      return v ? undefined : "Enter the institution.";
    case "attention":
      return v ? undefined : "Enter who receives the delivery.";
    case "line1":
      return v ? undefined : "Enter the street address.";
    case "city":
      return v ? undefined : "Enter the city.";
    case "region":
      return /^[A-Za-z]{2}$/.test(v) ? undefined : "Use the two-letter state code.";
    case "postal":
      return /^\d{5}(-\d{4})?$/.test(v) ? undefined : "Use a five-digit ZIP code.";
    case "phone":
      return !v || v.replace(/\D/g, "").length >= 10 ? undefined : "Enter a full phone number, or leave it blank.";
    default:
      return undefined;
  }
}

function AddressForm({
  title,
  initial,
  onSave,
  onCancel,
}: {
  title: string;
  initial: Draft;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);
  const error = (key: Key) => (touched[key] ? check(key, draft[key]) : undefined);
  const bind = (key: Key) => ({
    id: `tm-acct-address-${key}`,
    value: draft[key],
    error: error(key),
    onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const keys = Object.keys(blank) as Key[];
    setTouched(Object.fromEntries(keys.map((k) => [k, true])));
    const invalid = keys.find((k) => check(k, draft[k]));
    if (invalid) {
      document.getElementById(`tm-acct-address-${invalid}`)?.focus();
      return;
    }
    onSave({ ...draft, region: draft.region.trim().toUpperCase() });
  }
  return (
    <form className="tm-acct-address is-form" onSubmit={submit} noValidate aria-label={title}>
      <p className="tm-acct-address-title">{title}</p>
      <div className="tm-acct-form-grid">
        <Field {...bind("label")} ref={first} label="Label" hint="For example, Laboratory." wide autoComplete="off" />
        <Field {...bind("institution")} label="Institution" wide autoComplete="organization" />
        <Field {...bind("attention")} label="Attention" wide autoComplete="name" />
        <Field {...bind("line1")} label="Address" wide autoComplete="address-line1" />
        <Field {...bind("line2")} label="Suite, floor or building" optional wide autoComplete="address-line2" />
        <Field {...bind("city")} label="City" wide autoComplete="address-level2" />
        <Field {...bind("region")} label="State" autoComplete="address-level1" maxLength={2} />
        <Field {...bind("postal")} label="ZIP code" autoComplete="postal-code" inputMode="numeric" maxLength={10} />
        <Field {...bind("phone")} label="Phone" optional wide type="tel" autoComplete="tel" />
      </div>
      <div className="tm-acct-actions">
        <button type="submit" className="tm-button tm-button-primary">
          Save address
        </button>
        <button type="button" className="tm-acct-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Addresses() {
  useTitle("Addresses");
  const { buyer } = useAccount();
  const [addresses, setAddresses] = useState<Address[]>(buyer.addresses);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const count = useRef(0);

  function returnFocus(id: string) {
    window.requestAnimationFrame(() => document.getElementById(`tm-acct-edit-${id}`)?.focus());
  }
  function save(id: string | null, draft: Draft) {
    const next: Address = {
      id: id ?? `preview-${++count.current}`,
      ...draft,
      line2: draft.line2.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      country: "United States",
    };
    setAddresses((list) => (id ? list.map((a) => (a.id === id ? next : a)) : [...list, next]));
    setEditing(null);
    setNote(id ? `${next.label} address updated.` : `${next.label} address added.`);
    returnFocus(next.id);
  }

  return (
    <>
      <PageHead
        eyebrow="Addresses"
        title="Delivery addresses."
        sub="Where your lots are received."
        aside={<SampleTag>Changes are kept in this preview only</SampleTag>}
      >
        <p className="tm-acct-intro">We ship to institutional addresses only.</p>
      </PageHead>
      <p className="tm-acct-live" aria-live="polite">
        {note}
      </p>
      <div className="tm-acct-addresses tm-acct-rise">
        {addresses.map((address) =>
          editing === address.id ? (
            <AddressForm
              key={address.id}
              title={`Edit ${address.label}`}
              initial={{ ...blank, ...address, line2: address.line2 ?? "", phone: address.phone ?? "" }}
              onSave={(draft) => save(address.id, draft)}
              onCancel={() => {
                setEditing(null);
                returnFocus(address.id);
              }}
            />
          ) : (
            <article className="tm-acct-address" key={address.id} aria-labelledby={`tm-acct-address-${address.id}`}>
              <p className="tm-acct-label" id={`tm-acct-address-${address.id}`}>
                {address.label}
              </p>
              <address className="tm-acct-address-lines">
                <span className="tm-acct-address-name">{address.institution}</span>
                <span>Attn. {address.attention}</span>
                <span>{address.line1}</span>
                {address.line2 && <span>{address.line2}</span>}
                <span>
                  {address.city}, {address.region} {address.postal}
                </span>
                <span>{address.country}</span>
                {address.phone && <span>{address.phone}</span>}
              </address>
              <button
                type="button"
                id={`tm-acct-edit-${address.id}`}
                className="tm-acct-quiet is-small"
                onClick={() => setEditing(address.id)}
                aria-label={`Edit ${address.label} address`}
              >
                Edit
              </button>
            </article>
          ),
        )}
        {editing === "new" ? (
          <AddressForm
            title="New address"
            initial={blank}
            onSave={(draft) => save(null, draft)}
            onCancel={() => {
              setEditing(null);
              returnFocus("new");
            }}
          />
        ) : (
          <button type="button" id="tm-acct-edit-new" className="tm-acct-address is-add" onClick={() => setEditing("new")}>
            <Plus size={18} strokeWidth={1.6} aria-hidden="true" />
            Add an address
          </button>
        )}
      </div>
    </>
  );
}
