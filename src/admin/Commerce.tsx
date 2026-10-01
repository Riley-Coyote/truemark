import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Button, EmptyState, Section, TextAreaField } from "../app-kit";
import type { Category, Product } from "../data";
import { setCategories } from "../data";
import { catalogPhotoPath } from "../platform/commerce";
import { LIVE } from "../platform/mode";
import { store, useResource } from "../platform/store";
import type { SettingsPatch } from "../platform/commerce";
import type { StorefrontSettings } from "../platform/types";
import { SelectField, SwitchRow, TextField, parseDollars } from "./fields";
import "./commerce.css";

const previewNote = "Saving works in the live platform.";
const messageFor = (error: unknown) => error instanceof Error ? error.message : "The change could not be saved. Try again.";

export function ProductEditor({ product, classes, onSaved }: { product: Product; classes: Category[]; onSaved: () => void }) {
  const [draft, setDraft] = useState(product);
  const [expectedStock, setExpectedStock] = useState(product.stock ?? null);
  const [price, setPrice] = useState(product.price?.toFixed(2) ?? "");
  const [stock, setStock] = useState(product.stock == null ? "" : String(product.stock));
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const photoId = useId();
  const update = <K extends keyof Product,>(key: K, value: Product[K]) => {
    setDraft((current) => ({ ...current, [key]: value })); setMessage(undefined); setError(undefined);
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!LIVE || busy) return;
    const amount = parseDollars(price, { allowZero: true });
    if (amount.value === undefined || !Number.isFinite(amount.value) || amount.value > 9999999999.99) {
      setError(amount.error ?? "Enter a valid price."); return;
    }
    if (stock && (!/^\d{1,9}$/.test(stock) || !Number.isSafeInteger(Number(stock)))) {
      setError("Stock must be a whole number, zero, or blank for not tracked."); return;
    }
    if (![draft.name, draft.size, draft.category, draft.form].every((value) => value.trim())) {
      setError("Name, size, class and form are required."); return;
    }
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      let image = uploaded ?? draft.image;
      if (photo && !uploaded) {
        image = await store.catalog.uploadPhoto(product.id, photo);
        setUploaded(image);
      }
      const saved = await store.catalog.saveProduct({ ...draft, image, price: amount.value, stock: stock === "" ? null : Number(stock) }, expectedStock);
      setExpectedStock(saved.stock ?? null); setDraft(saved); setPrice(saved.price!.toFixed(2)); setStock(saved.stock == null ? "" : String(saved.stock));
      setPhoto(null); setUploaded(undefined); setMessage("Product saved."); onSaved();
    } catch (error) { setError(messageFor(error)); onSaved(); }
    finally { setBusy(false); }
  }
  return <form className="cc-commerce-form" onSubmit={save}>
    <fieldset disabled={!LIVE || busy || classes.length === 0} className="cc-commerce-fields">
      <TextField label="Name" value={draft.name} onChange={(value) => update("name", value)} />
      <div className="cc-commerce-pair">
        <TextField label="Size" value={draft.size} onChange={(value) => update("size", value)} />
        <TextField label="Price per vial" prefix="$" inputMode="decimal" value={price} onChange={setPrice} />
      </div>
      <SelectField label="Class" value={draft.category} onChange={(value) => update("category", value)} options={classes.map((category) => ({ value: category.id, label: category.name }))} />
      <TextField label="Form" value={draft.form} onChange={(value) => update("form", value)} />
      <TextField label="Tag" value={draft.tag ?? ""} onChange={(value) => update("tag", value)} hint="Leave blank for no tag." />
      <SwitchRow title="Active" description="Show this product in the storefront." checked={draft.active !== false} onChange={(value) => update("active", value)} />
      <TextAreaField label="Description" value={draft.description ?? ""} onChange={(value) => update("description", value)} hint="Leave blank to use the existing product description." />
      <TextField label="Stock" value={stock} onChange={setStock} inputMode="numeric" hint="Blank means not tracked. Zero shows Out of stock." />
      <div className="kit-field">
        <label className="kit-field-label" htmlFor={photoId}>Photo</label>
        <input className="cc-commerce-file" id={photoId} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={`${photoId}-hint`} onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try { catalogPhotoPath(product.id, file); setPhoto(file); setUploaded(undefined); setError(undefined); setMessage(undefined); }
          catch (error) { setError(messageFor(error)); event.target.value = ""; }
        }} />
        <p id={`${photoId}-hint`} className="kit-field-hint">JPG, PNG or WebP, up to 5 MB. The original image is uploaded when you save.</p>
        {photo && <p className="kit-note">Selected: {photo.name}</p>}
      </div>
      <Button type="submit" variant="primary">{busy ? "Saving product…" : "Save product"}</Button>
    </fieldset>
    {!classes.length && <p className="kit-note" role="alert">Classes are unavailable. <Button variant="text" onClick={onSaved}>Try again</Button></p>}
    {!LIVE && <p className="kit-note">{previewNote}</p>}
    {error && <p className="kit-field-error" role="alert">{error}</p>}
    {message && <p className="kit-note" role="status">{message}</p>}
  </form>;
}

function CategoryEditor({ category, onSaved }: { category: Category; onSaved: () => void }) {
  const [draft, setDraft] = useState(category);
  const [position, setPosition] = useState(String(category.position));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!LIVE || busy) return;
    if (!draft.name.trim() || !draft.short.trim() || !/^\d{1,9}$/.test(position)) {
      setError("Enter a name, short name and a whole-number order."); return;
    }
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      await store.catalog.saveCategory({ ...draft, position: Number(position) });
      const categories = await store.catalog.categories();
      setCategories(categories); onSaved(); setMessage("Class saved.");
    } catch (error) { setError(messageFor(error)); }
    finally { setBusy(false); }
  }
  return <form className="cc-commerce-form" onSubmit={save}>
    <fieldset disabled={!LIVE || busy} className="cc-commerce-fields">
      <TextField label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
      <div className="cc-commerce-pair">
        <TextField label="Short name" value={draft.short} onChange={(short) => setDraft({ ...draft, short })} />
        <TextField label="Order" inputMode="numeric" value={position} onChange={setPosition} />
      </div>
      <TextAreaField label="Member note" value={draft.members} onChange={(members) => setDraft({ ...draft, members })} />
      <SwitchRow title="On homepage" description="Include this class in the homepage collection." checked={draft.onHome} onChange={(onHome) => setDraft({ ...draft, onHome })} />
      <Button type="submit" variant="primary">{busy ? "Saving class…" : "Save class"}</Button>
    </fieldset>
    {!LIVE && <p className="kit-note">{previewNote}</p>}
    {error && <p role="alert" className="kit-field-error">{error}</p>}
    {message && <p role="status" className="kit-note">{message}</p>}
  </form>;
}

export function ClassesEditor({ classes, onSaved }: { classes: Category[]; onSaved: () => void }) {
  const [open, setOpen] = useState<string>();
  return <div className="kit-span-12"><Section title="Classes">
    <p className="kit-note">Names, filter labels and homepage membership. All compounds keeps its label-colour order.</p>
    <div className="kit-card cc-commerce-classes">
      {classes.map((category) => <div key={category.id}>
        <button type="button" className="cc-commerce-class" aria-expanded={open === category.id} onClick={() => setOpen(open === category.id ? undefined : category.id)}>
          <span className="kit-mono kit-quiet">{String(category.position).padStart(2, "0")}</span>
          <span>{category.name}</span><span className="kit-note">{open === category.id ? "Close" : LIVE ? "Edit" : "View"}</span>
        </button>
        {open === category.id && <CategoryEditor category={category} onSaved={onSaved} />}
      </div>)}
    </div>
  </Section></div>;
}

/** Independent patches keep saving one panel from reverting changes in the other. */
function SettingsEditor({ settings, kind, owner, onSaved }: { settings: StorefrontSettings; kind: "shipping" | "insurance"; owner: boolean; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(settings.freeShippingThreshold !== null);
  const [threshold, setThreshold] = useState(settings.freeShippingThreshold?.toFixed(2) ?? "150.00");
  const [mode, setMode] = useState(settings.insuranceMode);
  const [rate, setRate] = useState(settings.insuranceRate == null ? "" : String(Number((settings.insuranceRate * 100).toFixed(3))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!LIVE || !owner || busy) return;
    let patch: SettingsPatch;
    if (kind === "shipping") {
      const parsed = parseDollars(threshold, { allowZero: true });
      if (enabled && (parsed.value === undefined || !Number.isFinite(parsed.value) || parsed.value > 99999999.99)) {
        setError(parsed.error ?? "Enter a valid threshold."); return;
      }
      patch = { freeShippingThreshold: enabled ? parsed.value! : null };
    } else {
      if ((mode !== "off" || rate !== "") && (!/^\d+(\.\d{1,3})?$/.test(rate) || Number(rate) > 100)) {
        setError("Enter a rate from 0 to 100%, with up to three decimal places."); return;
      }
      patch = { insuranceMode: mode, insuranceRate: rate === "" ? null : Number((Number(rate) / 100).toFixed(5)) };
    }
    setBusy(true); setError(undefined); setMessage(undefined);
    try { await store.settings.save(patch); onSaved(); setMessage(kind === "shipping" ? "Shipping saved." : "Insurance saved."); }
    catch (error) { setError(messageFor(error)); }
    finally { setBusy(false); }
  }
  return <form className="cc-commerce-form" onSubmit={save}>
    <fieldset className="cc-commerce-fields" disabled={!LIVE || !owner || busy}>
      {kind === "shipping" ? <>
        <SwitchRow title="Offer free shipping" description="Applies to the standard method after discounts. Overnight keeps its price." checked={enabled} onChange={setEnabled} />
        <TextField label="Free-shipping threshold" prefix="$" inputMode="decimal" value={threshold} onChange={setThreshold} disabled={!enabled} />
      </> : <>
        <SelectField label="Mode" value={mode} onChange={setMode} options={[{ value: "off", label: "Off" }, { value: "optional", label: "Optional" }, { value: "automatic", label: "Automatic" }]} />
        <TextField label="Rate" suffix="%" value={rate} onChange={setRate} inputMode="decimal" hint="The client decides the rate and whether it's optional." />
      </>}
      <Button type="submit" variant="primary">{busy ? "Saving…" : kind === "shipping" ? "Save shipping" : "Save insurance"}</Button>
    </fieldset>
    {!LIVE ? <p className="kit-note">{previewNote}</p> : !owner && <p className="kit-note">Only the owner can change these settings.</p>}
    {error && <p className="kit-field-error" role="alert">{error}</p>}
    {message && <p className="kit-note" role="status">{message}</p>}
  </form>;
}

export function CommerceSettings({ kind }: { kind: "shipping" | "insurance" }) {
  const settings = useResource(() => store.settings.get());
  if (settings.error) return <EmptyState compact title="Settings could not be loaded." note={settings.error.message} action={<Button onClick={() => { settings.reload(); }}>Try again</Button>} />;
  if (!settings.data) return <p className="kit-note" role="status">Loading settings…</p>;
  return <SettingsEditor settings={settings.data} kind={kind} owner={LIVE} onSaved={settings.reload} />;
}
