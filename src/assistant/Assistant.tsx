import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Drawer } from "../app-kit/Drawer";
import { Card } from "../app-kit/components";
import { Modal } from "../shop/Modal";
import { Certificate } from "../brand/Certificate";
import { LIVE } from "../platform/mode";
import { STORE_CHANGE, worldNow } from "../platform/storage";
import { useShop } from "../shop/context";
import { browserAssistant, currentScope, previewGate, reviewKey } from "./browser";
import { runTurn } from "./engine";
import { AssistantError, OFFLINE, type Persona } from "./protocol";
import type { Artifact, PendingAction, Scope } from "./runtime";
import { MessageText } from "./MessageText";
import { ConfirmationDetails } from "./ConfirmationDetails";
import "./assistant.css";

const prompts: Record<Persona, string[]> = {
  visitor: ["Verify a lot", "Shipping and free shipping", "Storage"],
  owner: ["Who is due to reorder?", "Which products need attention?", "How are partners doing?"],
  partner: ["How is my month going?", "Help me draft a research post", "Make a link to the catalog"],
};
const titles = { visitor: "Ask TrueMark", owner: "Assistant", partner: "Your assistant" };
const OPEN = "tm-assistant-open";
type Entry = { id: string; who: "user" | "assistant"; text?: string; artifact?: Artifact };
type Access = { allowed: boolean; scope: Scope; key: string | null; version: number };
function useAccess(persona: Persona) {
  const [access, setAccess] = useState<Access | null>(null);
  const location = useLocation();
  useEffect(() => {
    let active = true, generation = 0;
    const controller = new AbortController();
    const refresh = async () => {
      const current = ++generation, key = LIVE ? null : reviewKey();
      const allowed = LIVE || await previewGate(persona, controller.signal);
      let scope: Scope;
      try { scope = await currentScope(persona); } catch { scope = { persona, role: "anonymous", id: "offline", sample: !LIVE }; }
      if (active && current === generation) setAccess((previous) => ({ allowed, scope, key,
        version: (previous?.version ?? 0) + (previous && (previous.key !== key || previous.scope.id !== scope.id || previous.scope.role !== scope.role || previous.allowed !== allowed) ? 1 : 0) }));
    };
    void refresh();
    window.addEventListener(STORE_CHANGE, refresh); window.addEventListener("storage", refresh); window.addEventListener("focus", refresh);
    return () => { active = false; controller.abort(); window.removeEventListener(STORE_CHANGE, refresh); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [persona, location.pathname, location.search]);
  return access;
}
function Copy({ text, disabled = false }: { text: string; disabled?: boolean }) {
  const [status, setStatus] = useState("");
  return <><button type="button" className="assistant-button" disabled={disabled} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setStatus("Copied"); } catch { setStatus("Copy unavailable. Select the text to copy it."); }
  }}>Copy</button><span className="assistant-note" role="status">{status}</span></>;
}
function Result({ artifact, rewrite, close, disabled }: { artifact: Artifact; rewrite: (text: string) => void; close: () => void; disabled: boolean }) {
  if (artifact.kind === "certificate") return <div className="assistant-certificate"><Certificate record={artifact.record} className="assistant-certificate-compact" />{artifact.coaUrl && <a href={artifact.coaUrl} target="_blank" rel="noreferrer">Open certificate PDF</a>}</div>;
  if (artifact.kind === "rows") return <ul className="assistant-rows">{artifact.rows.map((row) => <li key={row.href}><Link to={row.href} onClick={close}><span>{row.label}</span><span className="assistant-note">{row.detail}</span></Link></li>)}</ul>;
  if (artifact.kind === "link") return <div className="assistant-result"><img className="assistant-qr" src={artifact.qr} width={180} height={180} alt="QR code for your partner link" /><p className="assistant-link-text">{artifact.url}</p><Copy text={artifact.url} /></div>;
  return <div className="assistant-result assistant-draft"><MessageText text={artifact.text} /><p className="assistant-check" data-passed={artifact.check.passed}>{artifact.check.line}</p>
    {artifact.disclosure && <p className="assistant-note">Disclosure: {artifact.disclosure}</p>}
    {!artifact.check.passed && <><p className="assistant-note">Flagged: {artifact.check.flags.join(" · ")}</p><button type="button" className="assistant-button" disabled={disabled} onClick={() => rewrite(`Rewrite the last draft, remove the flagged phrases (${artifact.check.flags.join(", ")}), keep research-use framing and the disclosure where required, and run the claim checker again.`)}>Rewrite draft</button></>}
    <Copy text={artifact.text} disabled={!artifact.check.passed} />
  </div>;
}

/** dvh handles browser chrome; the visual viewport also accounts for software keyboards. */
function useConversationViewport(open: boolean) {
  const [style, setStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const measure = () => setStyle({
      "--tm-assistant-viewport-height": `${viewport.height}px`,
      "--tm-assistant-viewport-top": `${viewport.offsetTop}px`,
    } as CSSProperties);
    measure();
    viewport.addEventListener("resize", measure); viewport.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => { viewport.removeEventListener("resize", measure); viewport.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [open]);
  return style;
}

function Conversation({ access, surface, open, onClose, request, addToBag }: { access: Access; surface: Persona; open: boolean; onClose: () => void; request: { id: number; text: string }; addToBag?: (id: string, quantity: number) => void }) {
  const persona = access.scope.persona;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "confirming" | "rate-limited" | "offline" | "error">("idle");
  const [error, setError] = useState("");
  const [brief, setBrief] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [conversationVersion, setConversationVersion] = useState(0);
  const [confirmation, setConfirmation] = useState<{ action: PendingAction; settle: (yes: boolean) => void } | null>(null);
  const current = useRef<AbortController | null>(null), running = useRef(false), lastRequest = useRef(0);
  const bag = useRef(addToBag); bag.current = addToBag;
  const lastQuestion = useRef<{ text: string; daily: boolean } | null>(null);
  const list = useRef<HTMLDivElement>(null), stickToBottom = useRef(true);
  const anchor = useRef<HTMLSpanElement>(null);
  const [kitRoot, setKitRoot] = useState<HTMLElement | null>(null);
  const viewportStyle = useConversationViewport(open);
  const field = useId();
  const bridge = useMemo(() => browserAssistant(surface, access.key, bag.current ? (id, quantity) => bag.current?.(id, quantity) : undefined), [surface, access.key, conversationVersion]);
  const busy = status === "loading" || status === "streaming" || status === "confirming";
  const cacheKey = `tm-assistant-brief:${LIVE ? "live" : "preview"}:${access.scope.id}:${access.scope.role}:${worldNow().slice(0, 10)}`;
  const stop = useCallback(() => { current.current?.abort(); }, []);
  useEffect(() => () => stop(), [stop]);
  useEffect(() => { if (!open) stop(); }, [open, stop]);
  useEffect(() => { if ((entries.length || confirmation || error) && stickToBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [entries, status, confirmation, error]);
  // Inherit the actual containing kit, including live day/night changes. The top
  // bar's backdrop-filter makes it unsuitable as a fixed-position containing block.
  useLayoutEffect(() => { if (surface !== "visitor") setKitRoot(anchor.current?.closest<HTMLElement>(".kit") ?? null); }, [surface, open]);

  const send = useCallback(async (text: string, daily = false) => {
    if (running.current || !text.trim()) return;
    running.current = true; const controller = new AbortController(); current.current = controller;
    lastQuestion.current = { text, daily };
    const turn = crypto.randomUUID(); setError(""); setInput(""); setAnnouncement(""); setStatus("loading"); stickToBottom.current = true;
    if (!daily) setEntries((items) => [...items, { id: turn, who: "user", text }]);
    try {
      const final = await runTurn(text, bridge.transport, bridge.prepare, {
        status: setStatus,
        text(value, round) {
          if (controller.signal.aborted) return;
          if (daily) { setBrief(value); return; }
          const id = `${turn}:${round}`;
          setEntries((items) => items.some((item) => item.id === id) ? items.map((item) => item.id === id ? { ...item, text: value } : item) : [...items, { id, who: "assistant", text: value }]);
        },
        artifact: (artifact) => { if (!controller.signal.aborted) setEntries((items) => [...items, { id: crypto.randomUUID(), who: "assistant", artifact }]); },
        confirm: (action, signal) => new Promise<boolean>((resolve) => {
          const cancel = () => settle(false);
          let done = false;
          function settle(yes: boolean) { if (done) return; done = true; signal.removeEventListener("abort", cancel); setConfirmation(null); resolve(yes); }
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) settle(false); else setConfirmation({ action, settle });
        }),
      }, controller.signal);
      if (daily && final) { setBrief(final); try { sessionStorage.setItem(cacheKey, final); } catch { /* In-memory state still caches this open session. */ } }
      setAnnouncement(final);
      setStatus("idle");
    } catch (failure) {
      if (daily) setBrief("");
      if (controller.signal.aborted) { setStatus("idle"); return; }
      setStatus(failure instanceof AssistantError ? failure.status === 429 ? "rate-limited" : failure.status === 503 ? "offline" : "error" : "error");
      setError(failure instanceof Error ? failure.message : OFFLINE);
    } finally { running.current = false; current.current = null; }
  }, [bridge, cacheKey]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (request.id && request.id !== lastRequest.current) { lastRequest.current = request.id; void send(request.text); }
      else if (persona === "owner" && !brief && !entries.length) {
        let cached: string | null = null; try { cached = sessionStorage.getItem(cacheKey); } catch { /* Optional cache. */ }
        if (cached) setBrief(cached);
        else void send("Make today's brief: 3–5 short lines and 3 things worth doing today. Start with business_summary, show the numbers, and say when data is too thin.", true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Opening and explicit entry prompts start turns; streaming updates must not restart them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request.id]);

  const portalAnchor = surface === "visitor" ? null : <span hidden ref={anchor} />;
  if (!open) return portalAnchor;
  const body = <div className="assistant" data-persona={persona}>
    <div className="assistant-messages" ref={list} role="log" aria-label="Conversation" aria-live="off" onScroll={() => { const el = list.current; if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {!entries.length && <div className="assistant-intro">
        {persona === "owner" && <section className="assistant-brief" aria-label="Today's brief"><p className="assistant-label">Today’s brief</p>{brief ? <MessageText text={brief} /> : <p className="assistant-note">{busy ? "Preparing today’s brief…" : "Today’s brief is unavailable."}</p>}</section>}
        {!busy && !brief && !error && <p className="assistant-note">{persona === "visitor" ? "Ask about a compound, a lot or your order." : "Ask about the records and work in your account."}</p>}
        <div className="assistant-suggestions">{prompts[persona].map((prompt) => <button key={prompt} type="button" className="assistant-button" disabled={busy} onClick={() => void send(prompt)}>{prompt}</button>)}</div>
      </div>}
      {entries.map((entry) => <div className="assistant-message" data-who={entry.who} key={entry.id}><span className="assistant-label">{entry.who === "user" ? "You" : titles[persona]}</span>{entry.text && <MessageText text={entry.text} />}{entry.artifact && <Result artifact={entry.artifact} rewrite={(text) => void send(text)} close={onClose} disabled={busy} />}</div>)}
      {confirmation && <section className={`assistant-confirm ${surface !== "visitor" ? "kit-card" : ""}`} aria-label="Confirm action"><p className="assistant-label">Your confirmation</p><p>{confirmation.action.title}</p><ConfirmationDetails action={confirmation.action} /><div className="assistant-actions"><button type="button" className="assistant-button" onClick={() => confirmation.settle(true)}>Confirm</button><button type="button" className="assistant-button" onClick={() => confirmation.settle(false)}>Cancel</button></div></section>}
      {error && <div className="assistant-error"><p className="assistant-status">{error}</p><div className="assistant-actions"><button type="button" className="assistant-button" onClick={() => { const last = lastQuestion.current; if (last) void send(last.text, last.daily); }}>Try again</button><button type="button" className="assistant-button" onClick={() => { setConversationVersion((n) => n + 1); setEntries([]); setInput(""); setError(""); setAnnouncement(""); setStatus("idle"); }}>New conversation</button>{(persona !== "visitor" || error.includes("sign in")) && <Link to={error.includes("sign in") ? "/access" : "/contact"} onClick={onClose}>{error.includes("sign in") ? "Sign in" : "Contact TrueMark"}</Link>}</div></div>}
    </div>
    <div className="assistant-a11y" role="status" aria-live="polite">{error || (status === "loading" ? "Looking into it…" : status === "streaming" ? "Answer arriving…" : status === "confirming" ? "Waiting for your confirmation." : entries.length ? "Ready." : "")}</div>
    <div className="assistant-a11y" aria-live="polite" aria-atomic="true">{announcement}</div>
    <form className="assistant-compose" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
      <label className={persona === "visitor" ? "assistant-a11y" : "assistant-label"} htmlFor={field}>Your question</label>
      {persona === "visitor" ? <div className="assistant-compose-pill"><input id={field} type="text" enterKeyHint="send" maxLength={6000} value={input} disabled={busy} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question" /><button className="assistant-button assistant-send" type="submit" disabled={busy || !input.trim()}>Send</button></div>
        : <textarea id={field} rows={2} maxLength={6000} value={input} disabled={busy} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question" />}
      <div className="assistant-actions">{persona !== "visitor" && <button className="assistant-button" type="submit" disabled={busy || !input.trim()}>Send</button>}{busy && <button type="button" className="assistant-button" onClick={stop}>Stop</button>}{persona === "visitor" && <Link className="assistant-contact" to="/contact" onClick={onClose}>Contact TrueMark</Link>}</div>
      {(persona === "visitor" || !LIVE) && <p className="assistant-note">{!LIVE && "Preview · sample data"}{persona === "visitor" && `${LIVE ? "" : " · "}Chats are saved to improve answers.`}</p>}
    </form>
  </div>;
  if (surface === "visitor") return <div className="assistant-storefront" style={viewportStyle}><Modal title={titles[persona]} onClose={onClose} side>{body}</Modal></div>;
  const drawer = <div className="assistant-kit" style={viewportStyle}><Drawer title={titles[persona]} eyebrow={persona === "owner" ? "Command" : "Partner portal"} onClose={onClose}>{body}</Drawer></div>;
  return <>{portalAnchor}{kitRoot && createPortal(drawer, kitRoot)}</>;
}

export function StorefrontAssistant() {
  const access = useAccess("visitor"), { add, closeCart, cart } = useShop(); const location = useLocation();
  const [open, setOpen] = useState(false), [request, setRequest] = useState({ id: 0, text: "" });
  const [bottom, setBottom] = useState(0);
  const addToBag = useCallback((id: string, quantity: number) => {
    if ((cart.find((item) => item.id === id)?.quantity ?? 0) + quantity > 99) throw new Error("The bag allows up to 99 of an item. Please choose a smaller quantity.");
    add(id, quantity); closeCart();
  }, [add, closeCart, cart]);
  useEffect(() => { const handler = (e: Event) => { setRequest((r) => ({ id: r.id + 1, text: (e as CustomEvent<string>).detail })); setOpen(true); }; window.addEventListener(OPEN, handler); return () => window.removeEventListener(OPEN, handler); }, []);
  useEffect(() => {
    const measure = () => setBottom(Array.from(document.querySelectorAll<HTMLElement>(".rl-dock, .rl-dock-pill, .tm-addbar")).reduce((room, el) => {
      const rect = el.getBoundingClientRect(); return rect.height && getComputedStyle(el).visibility !== "hidden" ? Math.max(room, window.innerHeight - rect.top) : room;
    }, 0));
    measure(); const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "data-drawer"] });
    window.addEventListener("resize", measure); return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  if (!access?.allowed) return null;
  const launcher = ["/verify", "/handling"].includes(location.pathname) || location.pathname.startsWith("/product/") || location.pathname === "/account" || location.pathname.startsWith("/account/");
  return <>{launcher && <button type="button" className="assistant-launcher" style={{ "--tm-assistant-bottom": `${bottom}px` } as CSSProperties} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Ask a question</button>}<Conversation key={access.version} access={access} surface="visitor" open={open} onClose={() => setOpen(false)} request={request} addToBag={addToBag} /></>;
}
export function HomeAssistantEntry() {
  const access = useAccess("visitor"), [text, setText] = useState(""); const id = useId();
  if (!access?.allowed) return null;
  return <form className="assistant-home" onSubmit={(e) => { e.preventDefault(); if (text.trim()) window.dispatchEvent(new CustomEvent(OPEN, { detail: text.trim() })); }}><label htmlFor={id}>Can’t find it? Ask TrueMark</label><div><input id={id} value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} placeholder="Your question" /><button type="submit" disabled={!text.trim()} className="assistant-button">Ask</button></div></form>;
}
export function OwnerAssistant({ trigger = true }: { trigger?: boolean }) {
  const access = useAccess("owner"), [open, setOpen] = useState(false);
  if (!access?.allowed) return null;
  return <>{trigger && <button type="button" className="kit-button kit-button-quiet" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Ask</button>}<Conversation key={access.version} access={access} surface="owner" open={open} onClose={() => setOpen(false)} request={{ id: 0, text: "" }} /></>;
}
export function PartnerAssistant() {
  const access = useAccess("partner"), [open, setOpen] = useState(false), [request, setRequest] = useState({ id: 0, text: "" });
  const [question, setQuestion] = useState(""); const field = useId();
  const ask = (text: string) => { if (!text.trim()) return; setRequest((r) => ({ id: r.id + 1, text: text.trim() })); setQuestion(""); setOpen(true); };
  if (!access?.allowed) return null;
  return <><Card className="kit-span-12 assistant-partner-entry" title="Your assistant"><div className="assistant">
    <p>Ask about your month, draft a post, or make a link.</p>
    <div className="assistant-suggestions">{prompts.partner.map((text) => <button type="button" className="assistant-button" key={text} aria-haspopup="dialog" onClick={() => ask(text)}>{text}</button>)}</div>
    <form className="assistant-entry-compose" onSubmit={(event) => { event.preventDefault(); ask(question); }}><label className="assistant-a11y" htmlFor={field}>Your question</label><input id={field} value={question} maxLength={6000} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question" /><button type="submit" className="assistant-button" disabled={!question.trim()} aria-haspopup="dialog" aria-expanded={open}>Ask</button></form>
  </div></Card><Conversation key={access.version} access={access} surface="partner" open={open} onClose={() => setOpen(false)} request={request} /></>;
}
