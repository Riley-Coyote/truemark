import { memo, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ArrowDown, ArrowUp, MessageCircle, Minus, Square, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { Drawer } from "../app-kit/Drawer";
import { Card } from "../app-kit/components";
import { Certificate } from "../brand/Certificate";
import { LIVE } from "../platform/mode";
import { STORE_CHANGE, worldNow } from "../platform/storage";
import { ShopContext } from "../shop/context";
import { SheetSkirt, useScrollLock, useSheetDrag, useSheetFocus, useSheetPresence, useVisibleViewport, viewportBox } from "../shop/sheet";
import { usePrefersReducedMotion } from "../shop/motion";
import { browserAssistant, currentScope, previewGate, reviewKey } from "./browser";
import { runTurn } from "./engine";
import { AssistantError, OFFLINE, type Persona } from "./protocol";
import { activityFor, type Artifact, type PendingAction, type Scope, type Source, type ToolOutput } from "./runtime";
import { QUICK_SCHEMAS, quickTurn } from "./quick";
import { planInProgress, startPlan, updatePlan } from "./planner-store";
import { rememberProduct, returningProduct } from "./recent";
import { Activity, DeskRecord, DeskText, FollowUps, Sources, Welcome, followUpsFor, type Opening } from "./LabDesk";
import { chatContext, setChatContext, type ChatContext } from "./chat-context";
import { productById } from "../shop/catalog";
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
type Entry = { id: string; who: "user" | "assistant"; text?: string; artifact?: Artifact; close?: { sources: Source[]; followups: string[] }; at?: number; arrive?: boolean };
/** Just arrived: only a new line plays its arrival, never one drawn again when the desk reopens. */
const FRESH_MS = 2500;
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
  if (artifact.kind !== "draft") return null;
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

/* ---------- The storefront chat: a sheet on phones, a panel beside the page on desktop ---------- */

/** The chat's layer (assistant.css, .tm-chat); its strip of paper lies one beneath. */
const CHAT_LAYER = 90;

/** The chat is exactly as tall as what it holds, up to its full height (--tm-chat-fit, in the CSS):
 *  it opens on the welcome and grows with the conversation, so it never stands over empty space. */
function useChatFit(panel: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const sheet = panel.current;
    if (!sheet) return;
    const measure = () => {
      const head = sheet.querySelector<HTMLElement>(".tm-chat-head"), compose = sheet.querySelector<HTMLElement>(".tm-chat-compose");
      const log = sheet.querySelector<HTMLElement>(".tm-chat-log"), flow = sheet.querySelector<HTMLElement>(".tm-chat-flow");
      // Stepped aside (hidden), nothing has a height: keep the last measure for its return.
      if (!head || !compose || !log || !flow || !head.offsetHeight) return;
      const padding = parseFloat(getComputedStyle(log).paddingTop) + parseFloat(getComputedStyle(log).paddingBottom);
      const frame = sheet.offsetHeight - sheet.clientHeight;
      sheet.style.setProperty("--tm-chat-fit", `${Math.ceil(head.offsetHeight + padding + flow.offsetHeight + compose.offsetHeight + frame)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const part of sheet.querySelectorAll(".tm-chat-flow, .tm-chat-compose")) observer.observe(part);
    return () => observer.disconnect();
  }, [panel]);
}

/**
 * The conversation follows its newest line, as messages do, but never carries the latest question
 * out of view: a long answer is read from its question down, the rest waiting below. Reading back
 * stops the following; the newest line, or a new question, resumes it. While the panel grows, the
 * conversation stays put by the field and the panel's top edge rises over it.
 */
function useFollow(log: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const follow = useRef(true), question = useRef<string | null>(null), touched = useRef(0);
  // Where the conversation is gliding to, while it glides.
  const goal = useRef<number | null>(null), gliding = useRef(0);
  const reduced = usePrefersReducedMotion();
  const [edges, setEdges] = useState({ above: false, below: false, more: false });
  // Read where it will rest, not each step of the glide, so the hairlines and the fade never flicker.
  const read = useCallback((el: HTMLElement) => {
    const at = goal.current ?? el.scrollTop, rest = el.scrollHeight - at - el.clientHeight;
    const next = { above: at > 1, below: rest > 1, more: rest > 48 };
    setEdges((now) => (now.above === next.above && now.below === next.below && now.more === next.more ? now : next));
  }, []);
  // The newest lines glide into view, a little of the way each frame, rather than jumping a line at a time.
  const glide = useCallback((el: HTMLElement, target: number) => {
    goal.current = target;
    if (gliding.current) return;
    let frames = 0;
    const step = () => {
      // Never past the end as it is now (the conversation may have grown shorter), and never for long.
      const to = goal.current == null ? null : Math.min(goal.current, el.scrollHeight - el.clientHeight);
      if (to == null) { gliding.current = 0; return; }
      const delta = to - el.scrollTop;
      if (Math.abs(delta) < 0.75 || ++frames > 90) { el.scrollTop = to; goal.current = null; gliding.current = 0; read(el); return; }
      el.scrollTop += delta * 0.24;
      gliding.current = requestAnimationFrame(step);
    };
    gliding.current = requestAnimationFrame(step);
  }, [read]);
  const place = useCallback(() => {
    const el = log.current;
    if (!el || !enabled) return;
    if (follow.current) {
      let target = el.scrollHeight - el.clientHeight;
      const asked = question.current ? el.querySelector<HTMLElement>(`[data-entry="${question.current}"]`) : null;
      if (asked) target = Math.min(target, asked.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - parseFloat(getComputedStyle(el).paddingTop));
      target = Math.max(0, target);
      const from = goal.current ?? el.scrollTop;
      // A long way (opened again, or back from far above) is a jump; the newest lines glide.
      if (Math.abs(from - target) > 1) {
        if (reduced || Math.abs(el.scrollTop - target) > el.clientHeight) { goal.current = null; el.scrollTop = target; }
        else glide(el, target);
      }
    }
    read(el);
  }, [log, enabled, read, glide, reduced]);
  // Opened again, the conversation shows its latest exchange, wherever the reader had left it.
  useLayoutEffect(() => {
    if (!enabled) return;
    follow.current = true;
    question.current = [...(log.current?.querySelectorAll<HTMLElement>("[data-entry]") ?? [])].at(-1)?.dataset.entry ?? null;
    place();
  }, [enabled, log, place]);
  useEffect(() => {
    const el = log.current;
    if (!el || !enabled) return;
    // Only the reader's own scrolling stops the following: a wheel, a touch, the scroll keys, the bar.
    // The reader's own scrolling takes over from any glide at once.
    const mark = () => { touched.current = performance.now(); goal.current = null; };
    const onKey = (event: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) mark(); };
    const onPointer = (event: PointerEvent) => { if (event.target === el) mark(); };
    const onScroll = () => {
      if (performance.now() - touched.current < 700) {
        question.current = null;
        follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }
      read(el);
    };
    el.addEventListener("wheel", mark, { passive: true });
    el.addEventListener("touchmove", mark, { passive: true });
    el.addEventListener("keydown", onKey);
    el.addEventListener("pointerdown", onPointer);
    el.addEventListener("scroll", onScroll, { passive: true });
    // New lines arriving and the panel growing both move the newest line; follow it before paint.
    const observer = new ResizeObserver(place);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("wheel", mark); el.removeEventListener("touchmove", mark); el.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerdown", onPointer); el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [log, enabled, place, read]);
  /** A new question: follow again, and keep it in view. */
  const ask = useCallback((id: string) => { follow.current = true; question.current = id; }, []);
  /** To the newest line, and follow from there. */
  const latest = useCallback(() => {
    const el = log.current;
    if (!el) return;
    follow.current = true; question.current = null;
    if (reduced) { goal.current = null; el.scrollTop = el.scrollHeight - el.clientHeight; read(el); }
    else glide(el, el.scrollHeight - el.clientHeight);
  }, [log, reduced, glide, read]);
  useEffect(() => () => cancelAnimationFrame(gliding.current), []);
  return { place, ask, latest, edges };
}

function ChatSheet({ title, subtitle, working = false, onClose, children }: { title: string; subtitle?: string; working?: boolean; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null), heading = useId();
  const seen = useVisibleViewport();
  const { state, requestClose } = useSheetPresence(onClose);
  useScrollLock();
  // On a touch screen the sheet itself takes focus, so the keyboard does not rise over the
  // suggestions before the reader asks for it.
  useSheetFocus(panel, requestClose, "fine");
  const drag = useSheetDrag(panel, requestClose);
  useChatFit(panel);

  return <><div className="tm-chat" data-state={state} style={viewportBox(seen, "tm-chat")}>
    <div className="tm-chat-scrim" aria-hidden="true" onClick={requestClose} />
    <section ref={panel} className="tm-chat-panel" role="dialog" aria-modal="true" aria-labelledby={heading} tabIndex={-1}>
      <header className="tm-chat-head" {...drag}>
        <span className="tm-chat-grabber" aria-hidden="true" />
        <span className={`tm-desk-presence${working ? " is-working" : ""}`} aria-hidden="true" />
        <div className="tm-chat-titles">
          <h2 id={heading} className="tm-chat-title">{title}</h2>
          {subtitle && <p className="tm-chat-subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="tm-chat-close" aria-label="Close" onClick={requestClose}><X size={18} strokeWidth={1.8} aria-hidden="true" /></button>
      </header>
      {children}
    </section>
  </div><SheetSkirt seen={seen} state={state} layer={CHAT_LAYER} /></>;
}

/** What a passing page keeps clear of the corner mark: its primary actions. */
const KEEP_CLEAR = ".tm-button-primary, .tm-buy-row, [data-keep-clear]";
/** What stays at the foot of the screen (the review tools): the mark rises to stand just above it. */
const STAND_ABOVE = ".rl-dock, .rl-dock-pill, .rl-ask, [data-chat-above]";

/**
 * The desk's way in, on every screen: the brand's dot and the desk's name in the bottom corner, the
 * desk rising from the same corner. It stands just above anything that stays at the foot of the
 * screen, aside while a page's primary action passes beneath it, breathes while an answer is being
 * written, and marks an answer that arrived while the desk was away.
 */
function CornerMark({ title, label, working = false, unread = false, onOpen, markRef }: { title: string; label: string; working?: boolean; unread?: boolean; onOpen: () => void; markRef?: RefObject<HTMLButtonElement | null> }) {
  const own = useRef<HTMLButtonElement>(null), mark = markRef ?? own;
  const [clear, setClear] = useState(true);
  const [lift, setLift] = useState(0); const lifted = useRef(0);
  useEffect(() => {
    let frame = 0, settle = 0;
    const shown = (el: HTMLElement) => { const style = getComputedStyle(el); return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05; };
    const check = () => {
      frame = 0;
      const self = mark.current;
      if (!self) return;
      const r = self.getBoundingClientRect();
      // How high it stands: just above whatever stays at the foot of the screen in its column.
      let next = 0;
      for (const el of document.querySelectorAll<HTMLElement>(STAND_ABOVE)) {
        const o = el.getBoundingClientRect();
        if (!o.width || o.right <= r.left - 4 || o.left >= r.right + 4 || !shown(el)) continue;
        next = Math.max(next, Math.round(window.innerHeight - o.top));
      }
      // Where it will be once risen, for the primary actions it gives way to.
      const shift = next - lifted.current, top = r.top - shift, bottom = r.bottom - shift;
      lifted.current = next; setLift(next);
      setClear(![...document.querySelectorAll<HTMLElement>(KEEP_CLEAR)].some((el) => {
        const o = el.getBoundingClientRect();
        return o.width > 0 && o.right > r.left - 4 && o.left < r.right + 4 && o.bottom > top - 4 && o.top < bottom + 4;
      }));
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(check); };
    // Things arriving at the foot of the screen rise into place; look again once they have.
    const later = () => { queue(); window.clearTimeout(settle); settle = window.setTimeout(queue, 600); };
    check();
    window.addEventListener("scroll", queue, { passive: true, capture: true });
    window.addEventListener("resize", later);
    // Pages arrive and change beneath it.
    const changes = new MutationObserver(later);
    changes.observe(document.body, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(frame); window.clearTimeout(settle); window.removeEventListener("scroll", queue, { capture: true }); window.removeEventListener("resize", later); changes.disconnect(); };
  }, [mark]);
  // Named, always: the brand's dot and the desk's name. While an answer waits, it says so.
  return <button ref={mark} type="button" className="tm-desk-launcher" data-yield={clear ? undefined : ""} data-unread={unread || undefined} aria-haspopup="dialog"
    style={lift ? { "--tm-desk-lift": `${lift}px` } as CSSProperties : undefined}
    aria-label={`${label}${unread ? ", new answer" : ""}`} onClick={onOpen}>
    <span className={`tm-desk-presence${working ? " is-working" : ""}`} aria-hidden="true" />
    <span key={unread ? "unread" : title} className="tm-desk-launcher-label" aria-hidden="true">{unread ? "New answer" : title}</span>
  </button>;
}

/** Desktop: the desk stands beside the page, which stays in use; it can step aside to its corner mark. */
function ChatDock({ title, subtitle, working, unread, minimized, onMinimize, onRestore, onClose, children }: { title: string; subtitle?: string; working: boolean; unread: boolean; minimized: boolean; onMinimize: () => void; onRestore: () => void; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null), heading = useId();
  const { state, requestClose } = useSheetPresence(onClose);
  useChatFit(panel);
  const pill = useRef<HTMLButtonElement>(null);
  // Closing hands focus back to what opened the desk, when the reader is still in it (or focus was
  // lost with it); a reader already back on the page keeps their place.
  useLayoutEffect(() => {
    const root = panel.current, active = document.activeElement as HTMLElement | null;
    // What opened it is outside it; the desk's own field (focused already, if this runs twice) is not.
    const previous = active && active !== document.body && !root?.contains(active) ? active : null;
    return () => {
      const now = document.activeElement;
      if (now && now !== document.body && !root?.contains(now)) return;
      if (previous?.isConnected) { previous.focus({ preventScroll: true }); return; }
      // What opened the desk gave way to it (the corner pill): once it returns, focus it, unless
      // something has taken focus meanwhile (the desk itself, mounted again).
      requestAnimationFrame(() => {
        const then = document.activeElement;
        if (then && then !== document.body) return;
        (document.querySelector<HTMLElement>(".tm-desk-launcher") ?? document.querySelector<HTMLElement>(".tm-ask"))?.focus({ preventScroll: true });
      });
    };
  }, []);
  // Opening or restoring puts the reader in the field, ready to ask; stepping aside leaves them on
  // the pill that brings it back.
  useLayoutEffect(() => {
    if (minimized) {
      // The hidden desk still holds focus until the browser notices; take it from there too.
      const now = document.activeElement;
      if (!now || now === document.body || panel.current?.contains(now)) pill.current?.focus({ preventScroll: true });
      return;
    }
    panel.current?.querySelector<HTMLInputElement>(".tm-chat-field input")?.focus({ preventScroll: true });
  }, [minimized]);
  return <>
    <section ref={panel} className="tm-desk-dock" data-state={state} hidden={minimized} role="dialog" aria-modal="false" aria-labelledby={heading}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); requestClose(); } }}>
      <header className="tm-chat-head">
        <span className={`tm-desk-presence${working ? " is-working" : ""}`} aria-hidden="true" />
        <div className="tm-chat-titles">
          <h2 id={heading} className="tm-chat-title">{title}</h2>
          {subtitle && <p className="tm-chat-subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="tm-chat-close" aria-label="Minimize" onClick={onMinimize}><Minus size={18} strokeWidth={1.8} aria-hidden="true" /></button>
        <button type="button" className="tm-chat-close" aria-label="Close" onClick={requestClose}><X size={18} strokeWidth={1.8} aria-hidden="true" /></button>
      </header>
      {children}
    </section>
    {minimized && <CornerMark title={title} label={`Open ${title}`} working={working} unread={unread} onOpen={onRestore} markRef={pill} />}
  </>;
}

type DeskActions = { ask: (text: string) => void; navigated: () => void; add?: (id: string, quantity: number) => void };

/** One line of the desk's conversation, drawn again only when its own entry changes: a streaming
 *  answer redraws itself, not every record above it. */
const DeskLine = memo(function DeskLine({ entry, last, busy, live, actions }: { entry: Entry; last: boolean; busy: boolean; live: boolean; actions: DeskActions }) {
  const fresh = entry.at !== undefined && Date.now() - entry.at < FRESH_MS ? "" : undefined;
  if (entry.who === "user") return <div className="tm-chat-msg is-user" data-entry={entry.id} data-fresh={fresh}><span className="assistant-a11y">You said</span><div className="tm-chat-bubble">{entry.text && <MessageText text={entry.text} />}</div></div>;
  // Each answer keeps its sources; only the newest offers what to ask next.
  if (entry.close) return <div className="tm-desk-close" data-fresh={fresh}><Sources sources={entry.close.sources} onNavigate={actions.navigated} />{last && <FollowUps items={entry.close.followups} onAsk={actions.ask} disabled={busy} />}</div>;
  return <div className="tm-chat-msg is-assistant" data-fresh={fresh}><span className="assistant-a11y">TrueMark said</span>{entry.text && <DeskText text={entry.text} live={live} arrive={entry.arrive && fresh !== undefined} />}{entry.artifact && <DeskRecord artifact={entry.artifact} onAdd={actions.add} onNavigate={actions.navigated} onAsk={actions.ask} />}</div>;
});

/** The desk's field. It keeps its own words, so typing redraws the field alone, never the conversation. */
function DeskComposer({ field, busy, placeholder, more, onSend, onStop, onLatest, onPerson }: { field: string; busy: boolean; placeholder: string; more: boolean; onSend: (text: string) => boolean; onStop: () => void; onLatest: () => void; onPerson: () => void }) {
  const [input, setInput] = useState("");
  return <form className="tm-chat-compose" onSubmit={(event) => { event.preventDefault(); if (onSend(input)) setInput(""); }}>
    <button type="button" className="tm-chat-jump" data-shown={more || undefined} aria-hidden={!more || undefined} tabIndex={more ? 0 : -1} aria-label="Go to the newest message" onClick={onLatest}><ArrowDown size={16} strokeWidth={1.8} aria-hidden="true" /></button>
    <label className="assistant-a11y" htmlFor={field}>Your question</label>
    <div className="tm-chat-field">
      {/* The field stays usable while an answer arrives, so the keyboard never drops between messages. */}
      <input id={field} type="text" enterKeyHint="send" autoComplete="off" maxLength={6000} value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder} />
      {busy
        ? <button type="button" className="tm-chat-send is-stop" onClick={onStop} aria-label="Stop the answer"><Square size={14} strokeWidth={2.4} aria-hidden="true" /></button>
        : <button type="submit" className="tm-chat-send" disabled={!input.trim()} aria-label="Send"><ArrowUp size={18} strokeWidth={2} aria-hidden="true" /></button>}
    </div>
    <p className="tm-chat-fine">{!LIVE && "Preview · sample data · "}Chats are saved to improve answers. <button type="button" className="tm-desk-human" onClick={onPerson}>Talk to a person</button></p>
  </form>;
}

type DeskProps = { docked?: boolean; minimized?: boolean; onMinimize?: () => void; onRestore?: () => void; onAdd?: (id: string, quantity: number) => void; bag?: () => { id: string; quantity: number }[]; context?: ChatContext | null };

function Conversation({ access, surface, open, onClose, request, addToBag, docked = false, minimized = false, onMinimize, onRestore, onAdd, bag: cart, context = null }: { access: Access; surface: Persona; open: boolean; onClose: () => void; request: { id: number; text: string }; addToBag?: (id: string, quantity: number) => void } & DeskProps) {
  const persona = access.scope.persona;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "confirming" | "rate-limited" | "offline" | "error">("idle");
  const [error, setError] = useState("");
  const [brief, setBrief] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [conversationVersion, setConversationVersion] = useState(0);
  const [confirmation, setConfirmation] = useState<{ action: PendingAction; settle: (yes: boolean) => void } | null>(null);
  const [activity, setActivity] = useState("");
  // A proposed change waits on its own button: the reader lands there, ready to say yes or not now.
  const approve = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirmation) approve.current?.focus({ preventScroll: true }); }, [confirmation]);
  // An answer finished while the desk stood aside, not yet seen.
  const [unread, setUnread] = useState(false);
  const away = useRef(minimized); away.current = minimized;
  useEffect(() => { if (!minimized) setUnread(false); }, [minimized]);
  // Where the reader was when the conversation began: its opening stays as it was said.
  const [opening, setOpening] = useState<Opening | null>(null);
  const turnSources = useRef<Source[]>([]), turnKinds = useRef<Artifact["kind"][]>([]), turnLot = useRef<string | undefined>(undefined);
  // The lot whose certificate the conversation showed last, for "how do I read this certificate?".
  const lastLot = useRef<string | undefined>(undefined);
  const cartItems = useRef(cart); cartItems.current = cart;
  const current = useRef<AbortController | null>(null), running = useRef(false), lastRequest = useRef(0);
  const bag = useRef(addToBag); bag.current = addToBag;
  const lastQuestion = useRef<{ text: string; daily: boolean } | null>(null);
  const list = useRef<HTMLDivElement>(null), stickToBottom = useRef(true);
  const anchor = useRef<HTMLSpanElement>(null);
  const [kitRoot, setKitRoot] = useState<HTMLElement | null>(null);
  const viewportStyle = useConversationViewport(open);
  const { place, ask, latest, edges } = useFollow(list, surface === "visitor" && open);
  const field = useId();
  const bridge = useMemo(() => browserAssistant(surface, access.key, bag.current ? (id, quantity) => bag.current?.(id, quantity) : undefined, () => cartItems.current?.() ?? []), [surface, access.key, conversationVersion]);
  const busy = status === "loading" || status === "streaming" || status === "confirming";
  const cacheKey = `tm-assistant-brief:${LIVE ? "live" : "preview"}:${access.scope.id}:${access.scope.role}:${worldNow().slice(0, 10)}`;
  const stop = useCallback(() => { current.current?.abort(); }, []);
  useEffect(() => () => stop(), [stop]);
  useEffect(() => { if (!open) stop(); }, [open, stop]);
  useEffect(() => { if (surface !== "visitor" && (entries.length || confirmation || error) && stickToBottom.current && list.current) list.current.scrollTop = list.current.scrollHeight; }, [surface, entries, status, confirmation, error]);
  // The desk's lines call through these, so their props stay the same from one render to the next.
  const deskLatest = useRef<DeskActions>({ ask: () => {}, navigated: () => {} });
  const canAdd = Boolean(onAdd);
  const deskActions = useMemo<DeskActions>(() => ({
    ask: (text) => deskLatest.current.ask(text),
    navigated: () => deskLatest.current.navigated(),
    add: canAdd ? (id, quantity) => deskLatest.current.add?.(id, quantity) : undefined,
  }), [canAdd]);
  // A question asked, or an answer closed, moves the newest line without changing the conversation's height.
  useLayoutEffect(() => { place(); }, [place, entries.length, error, confirmation]);
  // Inherit the actual containing kit, including live day/night changes. The top
  // bar's backdrop-filter makes it unsuitable as a fixed-position containing block.
  useLayoutEffect(() => { if (surface !== "visitor") setKitRoot(anchor.current?.closest<HTMLElement>(".kit") ?? null); }, [surface, open]);

  // The conversation as plain lines for a message to the team, and the inbox it belongs in.
  const entriesNow = useRef(entries); entriesNow.current = entries;
  const contactFrom = useCallback((): { topic: string; note: string } => {
    const all = entriesNow.current, where = chatContext();
    const plain = (text: string) => text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*|__|[*`]/g, "").replace(/\s+/g, " ").trim();
    const lines = all.filter((e) => e.text && e.text !== "Talk to a person").slice(-6).map((e) => `${e.who === "user" ? "Me" : "TrueMark"}: ${plain(e.text!).slice(0, 300)}`);
    const about = where?.product ? `About: ${where.product.name} ${where.product.size}, lot ${where.product.lot}` : "";
    const note = [about, lines.length ? `From my chat with TrueMark:\n${lines.join("\n")}` : ""].filter(Boolean).join("\n\n");
    const kinds = all.map((e) => e.artifact?.kind);
    const topic = kinds.includes("order") || where?.page.startsWith("/account") ? "orders-shipping"
      : kinds.includes("certificate") || kinds.includes("explain") || where?.page.startsWith("/verify") ? "testing-certificates" : "general-support";
    return { topic, note };
  }, []);
  const withContact = useCallback((artifact: Artifact): Artifact => artifact.kind === "panel" && artifact.panel === "contact" && !artifact.note
    ? { ...artifact, ...contactFrom(), ...(artifact.topic ? { topic: artifact.topic } : {}) } : artifact, [contactFrom]);

  const send = useCallback(async (text: string, daily = false) => {
    if (running.current || !text.trim()) return;
    running.current = true; const controller = new AbortController(); current.current = controller;
    lastQuestion.current = { text, daily };
    const turn = crypto.randomUUID(); setError(""); setInput(""); setAnnouncement(""); setStatus("loading"); setActivity(""); stickToBottom.current = true;
    turnSources.current = []; turnKinds.current = []; turnLot.current = undefined;
    if (!daily) {
      if (surface === "visitor") {
        // How the conversation began: the page, and what the desk knew of the reader then.
        const began: Opening = { ...(chatContext() ?? { page: "/" }), planned: Boolean(planInProgress()), recent: returningProduct() };
        setOpening((then) => then ?? began); ask(turn);
      }
      setEntries((items) => [...items, { id: turn, who: "user", text, at: Date.now() }]);
    }
    // The desk's own questions answer at once from the records; a failure there falls back to the model.
    const quick = surface === "visitor" && !daily ? quickTurn(text, chatContext(), lastLot.current, Boolean(planInProgress())) : null;
    if (quick) {
      try {
        let output: ToolOutput | null = null;
        if (quick.call) { setActivity(activityFor(quick.call)); output = await bridge.prepare(quick.call, QUICK_SCHEMAS, "visitor"); }
        if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        const answer = quick.answer(output);
        if (answer.artifact?.kind === "certificate" || answer.artifact?.kind === "explain") lastLot.current = answer.artifact.record.lot;
        if (answer.artifact?.kind === "product") rememberProduct(answer.artifact.product.id);
        if (answer.artifact?.kind === "profile" && answer.artifact.product) rememberProduct(answer.artifact.product.id);
        // The planner opens in this card: a fresh plan, the one in progress, or that plan with a compound added.
        if (answer.plan) {
          const card = crypto.randomUUID(), seed = answer.plan.seed ?? {}, existing = planInProgress();
          if (answer.plan.mode === "fresh" || !existing) startPlan({ ...seed, card });
          else if (answer.plan.mode === "add") updatePlan((p) => ({ ...seed, picks: [...new Set([...p.picks, ...(seed.picks ?? [])])], added: false, card }));
          else updatePlan(() => ({ card }));
          answer.artifact = { kind: "planner", card };
        }
        if (answer.artifact) answer.artifact = withContact(answer.artifact);
        const kinds = answer.artifact ? [answer.artifact.kind] : [];
        const shownLot = answer.artifact?.kind === "product" ? answer.artifact.product.lot : answer.artifact?.kind === "profile" ? answer.artifact.product?.lot : undefined;
        const close = { sources: answer.source ? [answer.source] : [], followups: followUpsFor(kinds, text, chatContext(), shownLot) };
        // It writes itself in above its record, as any answer does.
        setEntries((items) => [...items, { id: `${turn}:quick`, who: "assistant", text: answer.lead, artifact: answer.artifact, arrive: true, at: Date.now() },
          ...(close.sources.length || close.followups.length ? [{ id: `${turn}:close`, who: "assistant" as const, close, at: Date.now() }] : [])]);
        setAnnouncement(answer.lead);
        setActivity(""); setStatus("idle");
        if (away.current) setUnread(true);
        running.current = false; current.current = null;
        return;
      } catch {
        setActivity("");
        if (controller.signal.aborted) { setStatus("idle"); running.current = false; current.current = null; return; }
        // The model can still answer it.
      }
    }
    try {
      const final = await runTurn(text, bridge.transport, bridge.prepare, {
        status: setStatus,
        text(value, round) {
          if (controller.signal.aborted) return;
          if (daily) { setBrief(value); return; }
          const id = `${turn}:${round}`;
          setEntries((items) => items.some((item) => item.id === id) ? items.map((item) => item.id === id ? { ...item, text: value } : item) : [...items, { id, who: "assistant", text: value, at: Date.now() }]);
        },
        artifact: (raw) => { const artifact = withContact(raw); if (!controller.signal.aborted) { turnKinds.current.push(artifact.kind); if (artifact.kind === "product") { turnLot.current = artifact.product.lot; rememberProduct(artifact.product.id); }
          if (artifact.kind === "profile" && artifact.product) { turnLot.current = artifact.product.lot; rememberProduct(artifact.product.id); } if (artifact.kind === "certificate") lastLot.current = artifact.record.lot; setEntries((items) => [...items, { id: crypto.randomUUID(), who: "assistant", artifact, at: Date.now() }]); setActivity("Writing"); } },
        activity: (label) => { if (!controller.signal.aborted) setActivity(label); },
        source: (source) => { turnSources.current.push(source); },
        confirm: (action, signal) => new Promise<boolean>((resolve) => {
          const cancel = () => settle(false);
          let done = false;
          function settle(yes: boolean) { if (done) return; done = true; signal.removeEventListener("abort", cancel); setConfirmation(null); resolve(yes); }
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) settle(false); else setConfirmation({ action, settle });
        }),
      }, controller.signal);
      if (daily && final) { setBrief(final); try { sessionStorage.setItem(cacheKey, final); } catch { /* In-memory state still caches this open session. */ } }
      // The storefront desk closes each answer with where its facts came from and what to ask next.
      if (surface === "visitor" && !daily) {
        const close = { sources: [...turnSources.current], followups: followUpsFor(turnKinds.current, text, chatContext(), turnLot.current) };
        if (close.sources.length || close.followups.length) setEntries((items) => [...items, { id: crypto.randomUUID(), who: "assistant", close, at: Date.now() }]);
      }
      setAnnouncement(final);
      setActivity("");
      setStatus("idle");
      if (away.current && !daily) setUnread(true);
    } catch (failure) {
      setActivity("");
      if (daily) setBrief("");
      if (controller.signal.aborted) { setStatus("idle"); return; }
      setStatus(failure instanceof AssistantError ? failure.status === 429 ? "rate-limited" : failure.status === 503 ? "offline" : "error" : "error");
      setError(failure instanceof Error ? failure.message : OFFLINE);
    } finally { running.current = false; current.current = null; }
  }, [bridge, cacheKey, surface, ask, withContact]);

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
  if (surface === "visitor") {
    const working = status === "loading" || status === "streaming";
    // A record opened from the desk: on a phone the sheet steps aside for the page; on desktop the
    // desk stays beside it.
    const navigated = () => { if (!docked) onClose(); };
    // A person, from inside the chat: the message card opens here, the conversation so far written into it.
    const talkToPerson = () => { void send("Talk to a person"); };
    const started = entries.length > 0;
    deskLatest.current = { ask: (text) => void send(text), navigated, add: onAdd };
    const chat = <div className="tm assistant tm-chat-body" data-persona={persona} data-above={edges.above || undefined} data-below={edges.below || undefined}>
      <div className="tm-chat-log" ref={list} role="log" aria-label="Conversation" aria-live="off">
        <div className="tm-chat-flow">
          {/* The welcome opens the conversation and stays as its first line; its suggestions give way to the first question. */}
          <Welcome context={started ? opening : context} onAsk={deskActions.ask} disabled={busy} started={started} />
          {entries.map((entry, index) => <DeskLine key={entry.id} entry={entry} last={index === entries.length - 1} busy={index === entries.length - 1 && busy}
            live={status === "streaming" && index === entries.length - 1 && entry.who === "assistant" && Boolean(entry.text)} actions={deskActions} />)}
          {status === "loading" && <Activity label={activity || "Looking into it"} />}
          {/* Nothing changes until the reader says so, on a card that names what will happen. */}
          {confirmation && <section className="tm-desk-card tm-desk-confirm" aria-label="Confirm action">
            <p className="tm-desk-kicker">Please confirm</p>
            <p className="tm-desk-name">{confirmation.action.title}</p>
            <ConfirmationDetails action={confirmation.action} />
            <div className="tm-desk-actions">
              <button type="button" className="tm-desk-add" ref={approve} onClick={() => confirmation.settle(true)}>{confirmation.action.tool === "add_to_bag" ? "Add to bag" : "Confirm"}</button>
              <button type="button" className="tm-desk-quiet" onClick={() => confirmation.settle(false)}>Not now</button>
            </div>
          </section>}
          {error && <div className="tm-chat-error" role="alert"><p>{error}</p><div className="tm-chat-error-actions">
            {/* At the hourly limit another try would only meet it again: a person is the way on. */}
            {status !== "rate-limited" && <>
              <button type="button" className="tm-chat-link" onClick={() => { const last = lastQuestion.current; if (last) void send(last.text, last.daily); }}>Try again</button>
              <button type="button" className="tm-chat-link" onClick={() => { setConversationVersion((n) => n + 1); setEntries([]); setOpening(null); setInput(""); setError(""); setAnnouncement(""); setStatus("idle"); }}>New conversation</button>
            </>}
            {error.includes("sign in") ? <Link className="tm-chat-link" to="/access" onClick={navigated}>Sign in</Link> : <button type="button" className="tm-chat-link" onClick={talkToPerson}>Talk to a person</button>}
          </div></div>}
        </div>
      </div>
      <div className="assistant-a11y" role="status" aria-live="polite">{error || (status === "loading" ? `${activity || "Looking into it"}…` : status === "streaming" ? "Answer arriving…" : status === "confirming" ? "Waiting for your confirmation." : entries.length ? "Ready." : "")}</div>
      <div className="assistant-a11y" aria-live="polite" aria-atomic="true">{announcement}</div>
      <DeskComposer key={conversationVersion} field={field} busy={busy} more={edges.more} onStop={stop} onLatest={latest} onPerson={talkToPerson}
        placeholder={context?.product ? `Ask about ${context.product.name} ${context.product.size}` : "Ask a question"}
        onSend={(text) => { if (running.current || !text.trim()) return false; void send(text); return true; }} />
    </div>;
    const subtitle = "Answers from our records";
    return docked
      ? <ChatDock title={titles[persona]} subtitle={subtitle} working={working} unread={unread} minimized={minimized} onMinimize={() => onMinimize?.()} onRestore={() => onRestore?.()} onClose={onClose}>{chat}</ChatDock>
      : <ChatSheet title={titles[persona]} subtitle={subtitle} working={working} onClose={onClose}>{chat}</ChatSheet>;
  }
  const drawer = <div className="assistant-kit" style={viewportStyle}><Drawer title={titles[persona]} eyebrow={persona === "owner" ? "Command" : "Partner portal"} onClose={onClose}>{body}</Drawer></div>;
  return <>{portalAnchor}{kitRoot && createPortal(drawer, kitRoot)}</>;
}

/* ---------- The storefront entry: one place to ask, in the header ---------- */

let available = false;
const availability = new Set<() => void>();
function setAvailable(value: boolean) {
  if (value === available) return;
  available = value;
  availability.forEach((notify) => notify());
}
/** Whether the storefront assistant can open here (preview needs a review link). */
export function useAssistantAvailable() {
  return useSyncExternalStore((notify) => { availability.add(notify); return () => { availability.delete(notify); }; }, () => available, () => false);
}
/** Open the storefront assistant; with text, that question is asked straight away. */
export function openAssistant(text = "") {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: text }));
}
/** The header's way in: "Ask" beside the bag on desktop, a chat mark on phones. */
export function AskButton() {
  const ready = useAssistantAvailable();
  if (!ready) return null;
  return <button type="button" className="tm-textool tm-ask" aria-haspopup="dialog" aria-label="Ask TrueMark a question" onClick={() => openAssistant()}>
    <MessageCircle className="tm-ask-icon" size={20} strokeWidth={1.6} aria-hidden="true" />
    <span className="tm-ask-label">Ask</span>
  </button>;
}

/** Desktop windows get the desk beside the page; phones get the sheet. The chat's own breakpoint. */
function useDocked() {
  const query = "(min-width: 761px)";
  const [docked, setDocked] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = () => setDocked(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return docked;
}

export function StorefrontAssistant() {
  // Beside the shop it can fill the bag; on the sign-in page, which stands outside the shop, it answers only.
  const shop = useContext(ShopContext), cart = useMemo(() => shop?.cart ?? [], [shop?.cart]);
  const access = useAccess("visitor"); const location = useLocation();
  const [open, setOpen] = useState(false), [minimized, setMinimized] = useState(false), [request, setRequest] = useState({ id: 0, text: "" });
  const docked = useDocked();
  const cartNow = useRef(cart); cartNow.current = cart;
  const add = shop?.add, closeCart = shop?.closeCart;
  const addToBag = useCallback((id: string, quantity: number) => {
    if (!add || !closeCart) throw new Error("Sign in to add to your bag.");
    if ((cart.find((item) => item.id === id)?.quantity ?? 0) + quantity > 99) throw new Error("The bag allows up to 99 of an item. Please choose a smaller quantity.");
    add(id, quantity); closeCart();
  }, [add, closeCart, cart]);
  // A card's own Add button is the reader's click, like the product page's.
  const addFromCard = useCallback((id: string, quantity: number) => { add?.(id, quantity); closeCart?.(); }, [add, closeCart]);
  // Where the reader is: the product and its lot, the bag, whether they are signed in.
  const context = useMemo<ChatContext>(() => {
    const productId = location.pathname.match(/^\/product\/([^/]+)/)?.[1];
    const product = productId ? productById(decodeURIComponent(productId)) : undefined;
    const subtotal = cart.reduce((sum, item) => sum + (productById(item.id)?.price ?? 0) * item.quantity, 0);
    return {
      page: `${location.pathname}${location.search}`,
      ...(product ? { product: { id: product.id, name: product.name, size: product.size, lot: product.lot } } : {}),
      bag: { items: cart.reduce((n, item) => n + item.quantity, 0), subtotal: Math.round(subtotal * 100) / 100 },
      signedIn: access?.scope.role === "buyer",
    };
  }, [location.pathname, location.search, cart, access?.scope.role]);
  useEffect(() => { setChatContext(context); }, [context]);
  // On a product page the corner mark, after a moment, asks about that product by name.
  const [nudge, setNudge] = useState<string | null>(null);
  const viewing = context.product;
  useEffect(() => {
    setNudge(null);
    if (!viewing) return;
    rememberProduct(viewing.id);
    const later = window.setTimeout(() => setNudge(`Questions about ${viewing.name}?`), 6000);
    return () => window.clearTimeout(later);
  }, [viewing?.id, viewing?.name]);
  useEffect(() => () => setChatContext(null), []);
  useEffect(() => { const handler = (e: Event) => { setRequest((r) => ({ id: r.id + 1, text: (e as CustomEvent<string>).detail ?? "" })); setOpen(true); setMinimized(false); }; window.addEventListener(OPEN, handler); return () => window.removeEventListener(OPEN, handler); }, []);
  useEffect(() => { setAvailable(Boolean(access?.allowed)); }, [access?.allowed]);
  useEffect(() => () => setAvailable(false), []);
  // A new page: on a phone the sheet closes as the page appears, never over it; on desktop the desk
  // stays beside the new page and keeps the conversation. Either way the conversation is kept.
  const [page, setPage] = useState(location.pathname);
  if (page !== location.pathname) {
    setPage(location.pathname);
    if (!docked) setOpen(false);
  }
  if (!access?.allowed) return null;
  return <>
    <Conversation key={access.version} access={access} surface="visitor" open={open} onClose={() => { setOpen(false); setMinimized(false); }} request={request} addToBag={shop ? addToBag : undefined}
      docked={docked} minimized={minimized} onMinimize={() => setMinimized(true)} onRestore={() => setMinimized(false)} onAdd={shop ? addFromCard : undefined} bag={() => cartNow.current} context={context} />
    {/* On desktop the desk always has its place in the corner: this mark while it is closed, the desk
        itself rising from the same spot when opened, the same mark again when it steps aside. */}
    {!open && <CornerMark title={nudge ?? titles.visitor} label={nudge ? `Ask TrueMark: ${nudge}` : "Ask TrueMark a question"} onOpen={() => openAssistant()} />}
  </>;
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
