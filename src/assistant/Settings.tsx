import { useEffect, useId, useState } from "react";
import { Button, Card, EmptyState, Facts, Section } from "../app-kit";
import { LIVE } from "../platform/mode";
import { store } from "../platform/store";
import type { AssistantModels, AssistantSettingsInfo } from "../platform/assistant-types";
import { assistantSettingsRequest } from "./browser";
import type { Persona } from "./protocol";

const personas = ["visitor", "partner", "owner"] as const;
const labels = { visitor: "Visitor model", partner: "Partner model", owner: "Owner model" };
const previewModels = { visitor: "openai/gpt-6-luna", partner: "openai/gpt-6-luna", owner: "anthropic/claude-sonnet-5.5" };
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(value);
const failure = (error: unknown) => error instanceof Error ? error.message : "Assistant settings are unavailable. Try again.";

/** Mounted inside Settings' owner gate. It inherits the kit and existing form styles. */
export function AssistantSettings() {
  const [info, setInfo] = useState<AssistantSettingsInfo>();
  const [models, setModels] = useState<AssistantModels>(previewModels);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [tests, setTests] = useState<Partial<Record<Persona, string>>>({});
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  useEffect(() => {
    if (!LIVE) return;
    const abort = new AbortController(); setError(undefined); setInfo(undefined);
    assistantSettingsRequest<AssistantSettingsInfo>("settings", undefined, abort.signal).then((data) => {
      if (!abort.signal.aborted) { setInfo(data); setModels(data.models); }
    }).catch((e) => { if (!abort.signal.aborted) setError(failure(e)); });
    return () => abort.abort();
  }, [attempt]);
  const dirty = info && personas.some((p) => models[p] !== info.models[p]);
  async function save() {
    if (!LIVE || !info || busy) return;
    if (!personas.every((p) => /^[a-zA-Z0-9_./:+@-]{1,200}$/.test(models[p]))) { setError("Enter a model name for each assistant, without spaces."); return; }
    setBusy("save"); setError(undefined); setMessage(undefined);
    try {
      const saved = await store.assistant.saveModels(models);
      setInfo({ ...info, models: saved }); setModels(saved); setTests({}); setMessage("Assistant models saved.");
    } catch (e) { setError(failure(e)); }
    finally { setBusy(undefined); }
  }
  async function test(persona: Persona) {
    if (!LIVE || !info || dirty || busy) return;
    setBusy(persona); setError(undefined); setTests((old) => ({ ...old, [persona]: "Testing…" }));
    try {
      const result = await assistantSettingsRequest<{ ok: boolean; latencyMs: number }>("test", persona);
      setTests((old) => ({ ...old, [persona]: `OK · ${(result.latencyMs / 1000).toFixed(2)} s` }));
      try { setInfo(await assistantSettingsRequest<AssistantSettingsInfo>("settings")); }
      catch { setError("The connection passed, but spend could not be refreshed."); }
    } catch (e) { setTests((old) => ({ ...old, [persona]: failure(e) })); }
    finally { setBusy(undefined); }
  }
  const suggestions = info?.suggestions ?? [];
  return <Card>
    <div className="cc-commerce-form">
      {LIVE && !info ? error ? <EmptyState compact title="Assistant settings are unavailable." note={error}
        action={<Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>} /> : <p className="kit-note" role="status">Loading assistant settings…</p> : <>
        <Facts items={[
          { label: "Provider", value: info?.provider ?? "Available in the live platform" },
          { label: "This month's spend", value: info ? <>{money(info.spend.cost)} recorded · {info.spend.month} (UTC)
            {info.spend.unpricedMessages > 0 && <span className="kit-quiet"> · Cost unavailable for {info.spend.unpricedMessages} messages</span>}</> : "Available in the live platform" },
        ]} />
        {info?.catalogError && <p className="kit-note" role="status">{info.catalogError}</p>}
        <form className="cc-commerce-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset className="cc-commerce-fields" disabled={!LIVE || !!busy}>
            <legend className="kit-sr">Assistant models</legend>
            {personas.map((persona) => {
              const model = suggestions.find((m) => m.id === models[persona]);
              const price = model ? `${model.inputPrice === null ? "Unknown" : money(model.inputPrice)} input / ${model.outputPrice === null ? "Unknown" : money(model.outputPrice)} output per million tokens` : "Enter the model name used by your provider.";
              return <Section key={persona} title={labels[persona]}>
                <div className="kit-field">
                  <label className="kit-sr" htmlFor={`${id}-${persona}`}>{labels[persona]}</label>
                  <div className="cc-control" data-disabled={!LIVE || busy ? "true" : undefined}><input id={`${id}-${persona}`} className="cc-input kit-mono" list={`${id}-models`} value={models[persona]}
                    maxLength={200} required autoComplete="off" spellCheck={false} aria-describedby={`${id}-${persona}-hint`}
                    onChange={(event) => { setModels({ ...models, [persona]: event.target.value }); setMessage(undefined); setTests({}); }} /></div>
                  <p id={`${id}-${persona}-hint`} className="kit-field-hint">{price}</p>
                </div>
                <Button disabled={!LIVE || !!dirty || !!busy} onClick={() => void test(persona)} aria-label={`Test ${persona} assistant`}>Test</Button>
                {tests[persona] && <p className="kit-note" role="status">{tests[persona]}</p>}
              </Section>;
            })}
            <datalist id={`${id}-models`}>{suggestions.map((model) => <option key={model.id} value={model.id} label={`${model.name} · ${model.inputPrice === null ? "?" : money(model.inputPrice)} / ${model.outputPrice === null ? "?" : money(model.outputPrice)} per million tokens`} />)}</datalist>
            <Button type="submit" variant="primary" disabled={!LIVE || !dirty || !!busy}>{busy === "save" ? "Saving models…" : "Save models"}</Button>
          </fieldset>
        </form>
        {dirty && <p className="kit-note">Save your model choices before testing.</p>}
        {!LIVE && <p className="kit-note">Saving and connection tests work in the live platform, for the signed-in owner.</p>}
        {error && <p className="kit-field-error" role="alert">{error}</p>}
        {message && <p className="kit-note" role="status">{message}</p>}
      </>}
    </div>
  </Card>;
}
