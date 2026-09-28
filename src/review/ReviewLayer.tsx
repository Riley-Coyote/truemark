/**
 * The review layer: Riley's instrument laid over the client's site. A dock at the foot of
 * every page, pins where notes were left, Riley's questions where they apply, and a panel
 * that holds everything. Rendered through a portal on <body>; it never touches the page's
 * own layout or markup.
 */
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "./review.css";
import "./layer.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHref, useLocation, useNavigate } from "react-router-dom";
import { anchorFor, inLayer, kindOf, questionSpot, resolveAnchor } from "./anchor";
import { connectCommands } from "./commands";
import { briefMarkdown, latestAnswer } from "./export";
import { beginVisit, designerIdentity, loadIdentity, loadPrefs, newId, saveIdentity, savePrefs } from "./identity";
import type { Prefs } from "./identity";
import { onRoute, pageLabel, pageTitleNow, routeOf, withParam } from "./pages";
import { questionById, questions } from "./questions";
import { keyFromSearch, storedKey, storeKey } from "./key";
import { SUPABASE_CONFIGURED } from "./mode";
import { setReviewStatus, useReviewStatus } from "./status";
import { localStore, sharedStore } from "./store";
import { useNow } from "./time";
import { spotAtCorner, spotBox, spotIn, track } from "./tracker";
import type { Anchor, Category, Identity, Note, Person, PresenceHandle, Question, ReviewStore } from "./types";
import { copyText, Dot, useLatest, usePhone, useReducedMotion } from "./ui/bits";
import { CommentMode, Outline } from "./ui/CommentMode";
import { Composer } from "./ui/Composer";
import { Dock } from "./ui/Dock";
import { NotesPanel } from "./ui/NotesPanel";
import type { NotesFilter } from "./ui/NotesPanel";
import { Pins } from "./ui/Pins";
import type { PinView } from "./ui/Pins";
import { QuestionPopover } from "./ui/QuestionCard";
import { QuestionsPanel } from "./ui/QuestionsPanel";
import { Thread } from "./ui/Thread";
import { Welcome } from "./ui/Welcome";

type Open = { type: "compose"; page: boolean } | { type: "thread"; id: string } | { type: "question"; id: string } | null;
type Draft = { element: Element; anchor: Anchor; what: string };
type Pending = { type: "note" | "question"; id: string; at: number };

const byCreated = (a: Note, b: Note) => a.createdAt.localeCompare(b.createdAt);

/** Why notes stay on this device in a build that could share them (said once, quietly). */
const NO_KEY = "Your notes stay on this device. To share them with Riley, open the review link he sent you.";
const BAD_KEY = "This review link isn’t valid. Your notes stay on this device.";
const excerpt = (text: string) => (text.length > 80 ? `${text.slice(0, 77).trimEnd()}…` : text);
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export default function ReviewLayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = usePhone();
  const reduced = useReducedMotion();
  const now = useNow();
  const status = useReviewStatus();
  const { pathname, search } = location;
  const route = routeOf(pathname, search);
  const here = useCallback((r: string) => onRoute(r, pathname, search), [pathname, search]);

  const [store, setStore] = useState<ReviewStore | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Identity | null>(loadIdentity);
  const [since, setSince] = useState<string | null | undefined>(undefined);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [commenting, setCommenting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [panel, setPanel] = useState<"notes" | "questions" | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotesFilter>("open");
  const [welcome, setWelcome] = useState<{ then?: () => void; editing?: boolean } | null>(null);
  const [opened, setOpened] = useState<Record<string, number>>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [moved, setMoved] = useState<Set<string>>(() => new Set());
  const [anchoredQ, setAnchoredQ] = useState<Set<string>>(() => new Set());
  const [settled, setSettled] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [spot, setSpot] = useState<Element | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const resolved = useRef(new Map<string, Element | null>());
  const pending = useRef<Pending | null>(null);
  const routeEnteredAt = useRef(Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  /* ---------- The address: the layer's own parameters ---------- */

  /**
   * Take the layer's own parameters out of the address once they have done their job, with
   * replaceState, so no history entry is added and every other parameter stays. Requests made
   * in the same moment (a link can carry key= and note= together) go out together, so one
   * never puts another back.
   */
  const locationRef = useLatest(location);
  const navigateRef = useLatest(navigate);
  const stripQueue = useRef<Set<string> | null>(null);
  const stripParams = useCallback(
    (keys: string[]) => {
      if (!stripQueue.current) {
        const queue = new Set<string>();
        stripQueue.current = queue;
        queueMicrotask(() => {
          stripQueue.current = null;
          const drop = [...queue];
          const at = locationRef.current;
          const params = new URLSearchParams(at.search);
          if (drop.some((k) => params.has(k))) {
            drop.forEach((k) => params.delete(k));
            const rest = params.toString();
            navigateRef.current(
              { pathname: at.pathname, search: rest ? `?${rest}` : "", hash: at.hash },
              { replace: true, state: { ...((at.state as object | null) ?? {}), keepScroll: true } },
            );
          }
          // In the published site a query can also sit before the hash.
          const outer = new URLSearchParams(window.location.search);
          if (drop.some((k) => outer.has(k)) && window.location.hash) {
            drop.forEach((k) => outer.delete(k));
            const rest = outer.toString();
            window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
          }
        });
      }
      keys.forEach((k) => stripQueue.current?.add(k));
    },
    [locationRef, navigateRef],
  );

  /* ---------- The review key, and the store it opens ---------- */

  // Riley's link carries ?key=… (in the hash route, so it never reaches a server). Keep it on
  // this device and take it out of the address. Read it at once, so the first store opened
  // is already the shared one and a deep link in the same address waits for its notes.
  const [reviewKey, setReviewKey] = useState<string | null>(() => keyFromSearch(search) ?? storedKey());
  useEffect(() => {
    const fromLink = keyFromSearch(search);
    if (!fromLink) return;
    storeKey(fromLink);
    setReviewKey(fromLink);
    stripParams(["key"]);
  }, [search, stripParams]);

  // Why notes are staying on this device, when the build could share them.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const offs: Array<() => void> = [];
    let shared: ReviewStore | null = null;

    const use = async (next: ReviewStore) => {
      offs.push(next.subscribe((list) => alive && setNotes([...list])));
      setStore(next);
      const list = await next.list();
      if (alive) setNotes([...list]);
    };
    const stayLocal = async (why: string | null) => {
      setReviewStatus("local");
      setNotice(why);
      await use(localStore());
    };

    (async () => {
      if (!SUPABASE_CONFIGURED) return stayLocal(null);
      if (!reviewKey) return stayLocal(NO_KEY);
      setReviewStatus("connecting");
      setNotice(null);
      try {
        shared = await sharedStore(reviewKey);
        if (!alive || !shared) return;
        // "Live" only once the notes have loaded and the channel has joined.
        const off = shared.state?.((state) => alive && setReviewStatus(state === "live" ? "live" : "connecting"));
        if (off) offs.push(off);
        await use(shared);
      } catch (error) {
        if (!alive) return;
        shared?.close?.();
        shared = null;
        offs.splice(0).forEach((off) => off());
        const invalid = error instanceof Error && error.name === "InvalidKeyError";
        if (!invalid) setToast("Couldn’t reach the shared review, so notes stay on this device for now. Reload to try again.");
        await stayLocal(invalid ? BAD_KEY : null);
      }
    })()
      .catch(() => {
        if (alive) setToast("The review notes couldn’t load. Reload to try again.");
      })
      .finally(() => {
        if (alive) setReady(true);
      });

    return () => {
      alive = false;
      offs.forEach((off) => off());
      shared?.close?.();
    };
  }, [reviewKey]);

  /* ---------- Who is reviewing ---------- */

  const visited = useRef<string | null>(null);
  useEffect(() => {
    if (!me || visited.current === me.id) return;
    visited.current = me.id;
    setSince(beginVisit(me.id));
  }, [me]);

  useEffect(() => savePrefs(prefs), [prefs]);

  useEffect(() => {
    const asDesigner =
      new URLSearchParams(search).get("as") === "designer" || new URLSearchParams(window.location.search).get("as") === "designer";
    if (!asDesigner) return;
    const next = designerIdentity(loadIdentity());
    saveIdentity(next);
    setMe(next);
    stripParams(["as"]);
  }, [search, stripParams]);

  const meRef = useLatest(me);
  const ensureIdentity = useCallback(
    (then: () => void) => {
      if (meRef.current) then();
      else setWelcome({ then });
    },
    [meRef],
  );

  /* ---------- Derived notes ---------- */

  const threads = useMemo(() => notes.filter((n) => n.kind === "comment" || n.kind === "page").sort(byCreated), [notes]);
  const repliesMap = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) if (n.kind === "reply" && n.threadId) map.set(n.threadId, [...(map.get(n.threadId) ?? []), n]);
    map.forEach((list) => list.sort(byCreated));
    return map;
  }, [notes]);
  const repliesOf = useCallback((id: string) => repliesMap.get(id) ?? [], [repliesMap]);

  const routeThreads = useMemo(() => threads.filter((t) => t.kind === "comment" && t.anchor && here(t.route)), [threads, here]);
  const screenNumber = useMemo(() => new Map(routeThreads.map((t, i) => [t.id, i + 1])), [routeThreads]);
  const ownNumber = useMemo(() => {
    const map = new Map<string, number>();
    const byRoute = new Map<string, Note[]>();
    for (const t of threads) if (t.kind === "comment" && t.anchor) byRoute.set(t.route, [...(byRoute.get(t.route) ?? []), t]);
    byRoute.forEach((list) => list.forEach((t, i) => map.set(t.id, i + 1)));
    return map;
  }, [threads]);
  const numberOf = useCallback((t: Note) => screenNumber.get(t.id) ?? ownNumber.get(t.id) ?? null, [screenNumber, ownNumber]);
  const routeQuestions = useMemo(() => questions.filter((q) => here(q.route)), [here]);

  const isNew = useCallback(
    (n: Note) => Boolean(me) && n.author.id !== me!.id && since !== undefined && (since === null || n.createdAt > since),
    [me, since],
  );
  const unread = useCallback(
    (t: Note) => {
      const seenAt = opened[t.id];
      return [t, ...repliesOf(t.id)].some((n) => isNew(n) && (!seenAt || Date.parse(n.createdAt) > seenAt));
    },
    [opened, repliesOf, isNew],
  );
  const unanswered = questions.filter((q) => !latestAnswer(notes, q.id)).length;
  const openNotes = threads.filter((t) => t.status === "open").length;
  const questionsNew =
    Boolean(me) &&
    ((me!.kind === "client" && since === null && !opened.questions) ||
      notes.some((n) => n.kind === "answer" && isNew(n) && (!opened.questions || Date.parse(n.createdAt) > opened.questions)));
  const notesNew = threads.some(unread);

  const markOpened = useCallback((key: string) => setOpened((o) => ({ ...o, [key]: Date.now() })), []);

  /* ---------- Finding spots ---------- */

  const locRef = useLatest({ pathname, search });
  const listsRef = useLatest({ routeThreads, routeQuestions, notes });
  const reducedRef = useLatest(reduced);
  const phoneRef = useLatest(phone);

  const reveal = useCallback(
    (el: Element, dy = 0.5) => {
      const rect = el.getBoundingClientRect();
      const y = rect.top + dy * rect.height;
      const top = document.querySelector(".review-nav")?.getBoundingClientRect().bottom ?? 0;
      const comfortable = y > top + 96 && y < window.innerHeight * (phoneRef.current ? 0.45 : 0.72);
      if (comfortable) return;
      const behavior: ScrollBehavior = reducedRef.current ? "instant" : "smooth";
      if (rect.height > window.innerHeight * 0.5) {
        window.scrollTo({ top: Math.max(0, window.scrollY + y - window.innerHeight * 0.35), behavior });
      } else {
        el.scrollIntoView({ block: phoneRef.current ? "start" : "center", behavior });
        if (phoneRef.current) window.scrollBy({ top: -(top + 72), behavior: "instant" });
      }
    },
    [phoneRef, reducedRef],
  );

  const retry = useRef(0);
  const resolveAll = useCallback(() => {
    const { routeThreads: list, routeQuestions: qs, notes: all } = listsRef.current;
    const map = resolved.current;
    const isSettled = Date.now() - routeEnteredAt.current > 1500;
    const nextMoved = new Set<string>();
    for (const t of list) {
      const el = t.anchor ? resolveAnchor(t.anchor) : null;
      map.set(`n:${t.id}`, el);
      if (!el && isSettled) nextMoved.add(t.id);
    }
    const nextAnchored = new Set<string>();
    for (const q of qs) {
      const el = questionSpot(q.id);
      map.set(`q:${q.id}`, el);
      if (el) nextAnchored.add(q.id);
    }
    setMoved((prev) => (sameSet(prev, nextMoved) ? prev : nextMoved));
    setAnchoredQ((prev) => (sameSet(prev, nextAnchored) ? prev : nextAnchored));
    if (isSettled) setSettled(true);

    // A deep link or "Go to" waiting for its page to render.
    const wait = pending.current;
    if (!wait) return;
    const age = Date.now() - wait.at;
    const again = () => {
      window.clearTimeout(retry.current);
      retry.current = window.setTimeout(() => resolveAll(), 140);
    };
    const { pathname: p, search: s } = locRef.current;
    if (age < 140) return again();
    if (wait.type === "note") {
      const note = all.find((n) => n.id === wait.id);
      if (!note) {
        pending.current = null;
        return;
      }
      if (!onRoute(note.route, p, s)) return age > 4000 ? void (pending.current = null) : again();
      const el = note.kind === "comment" ? map.get(`n:${note.id}`) : null;
      if (el || note.kind !== "comment" || age > 2600) {
        pending.current = null;
        if (el) reveal(el, note.anchor?.dy);
        setOpen({ type: "thread", id: note.id });
        markOpened(note.id);
      } else again();
    } else {
      const q = questionById(wait.id);
      if (!q) {
        pending.current = null;
        return;
      }
      if (!onRoute(q.route, p, s)) return age > 4000 ? void (pending.current = null) : again();
      const el = map.get(`q:${q.id}`);
      if (el || age > 2600) {
        pending.current = null;
        if (el) {
          reveal(el, 0);
          setSpot(el);
        }
        setOpen({ type: "question", id: q.id });
      } else again();
    }
  }, [listsRef, locRef, reveal, markOpened]);

  // Resolve after every render that changes what should be on this page.
  const routeKey = `${route}|${routeThreads.map((t) => t.id).join(",")}|${routeQuestions.map((q) => q.id).join(",")}`;
  useLayoutEffect(() => {
    resolveAll();
  }, [routeKey, resolveAll]);

  // A new page: forget what was open there, and look again as it finishes rendering.
  const lastRoute = useRef(route);
  useEffect(() => {
    if (lastRoute.current === route) return;
    lastRoute.current = route;
    routeEnteredAt.current = Date.now();
    setSettled(false);
    setCommenting(false);
    setDraft(null);
    setOpen(null);
    setSpot(null);
  }, [route]);
  useEffect(() => {
    const timers = [60, 320, 900, 1650].map((ms) => window.setTimeout(resolveAll, ms));
    return () => timers.forEach(window.clearTimeout);
  }, [route, resolveAll]);

  // The page re-renders or reveals: look again, a few times a second at most.
  useEffect(() => {
    let timer = 0;
    const observer = new MutationObserver((records) => {
      if (records.every((r) => inLayer(r.target))) return;
      if (!timer) {
        timer = window.setTimeout(() => {
          timer = 0;
          resolveAll();
        }, 180);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id", "data-review", "hidden", "open"],
    });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [resolveAll]);

  // Every pin on this page is measured each frame by the tracker.
  useEffect(() => {
    const stops = [
      ...routeThreads.map((t) => track(`n:${t.id}`, () => spotIn(resolved.current.get(`n:${t.id}`), t.anchor!.dx, t.anchor!.dy))),
      ...routeQuestions.map((q) => track(`q:${q.id}`, () => spotAtCorner(resolved.current.get(`q:${q.id}`)))),
    ];
    return () => stops.forEach((stop) => stop());
    // routeKey names every thread and question these sources measure.
  }, [routeKey]);

  useEffect(() => {
    if (!draft) return;
    const stops = [
      track("draft", () => spotIn(draft.element, draft.anchor.dx, draft.anchor.dy)),
      track("picked", () => spotBox(draft.element)),
    ];
    return () => stops.forEach((stop) => stop());
  }, [draft]);

  useEffect(() => {
    if (!spot) return;
    const stop = track("spot", () => spotBox(spot));
    const timer = window.setTimeout(() => setSpot(null), 2600);
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [spot]);

  useEffect(() => {
    if (!fresh) return;
    const timer = window.setTimeout(() => setFresh(null), 700);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // While a thread is open, what arrives in it has been seen.
  const openThreadId = open?.type === "thread" ? open.id : null;
  useEffect(() => {
    if (openThreadId) markOpened(openThreadId);
  }, [openThreadId, notes, markOpened]);

  /* ---------- Live presence (Supabase only) ---------- */

  const presence = useRef<PresenceHandle | null>(null);
  const routeRef = useLatest(route);
  useEffect(() => {
    if (!store?.presence || !me) return;
    const handle = store.presence(me, routeRef.current, (list) => setPeople(list.filter((p) => p.id !== me.id)));
    presence.current = handle;
    return () => {
      handle.leave();
      presence.current = null;
      setPeople([]);
    };
  }, [store, me, routeRef]);
  useEffect(() => presence.current?.move(route), [route]);

  /* ---------- Actions ---------- */

  const openThread = useCallback(
    (id: string) => {
      setOpen((o) => (o?.type === "thread" && o.id === id ? null : { type: "thread", id }));
      markOpened(id);
    },
    [markOpened],
  );

  /**
   * Open something that lives on a page: go there if needed, then wait for its spot to
   * render (the tracker's resolver finishes the job), scroll it into view and open it.
   */
  const goTo = useCallback(
    (type: Pending["type"], id: string, route: string) => {
      const there = onRoute(route, locRef.current.pathname, locRef.current.search);
      // Already on the page: no need to wait for a navigation to settle.
      pending.current = { type, id, at: there ? Date.now() - 140 : Date.now() };
      if (there) window.setTimeout(resolveAll, 0);
      else navigate(route);
    },
    [locRef, navigate, resolveAll],
  );

  const goToQuestion = useCallback(
    (q: Question) => {
      setPanel(null);
      setCommenting(false);
      goTo("question", q.id, q.route);
    },
    [goTo],
  );

  const goToNote = useCallback(
    (note: Note) => {
      const target = note.kind === "reply" ? listsRef.current.notes.find((n) => n.id === note.threadId) ?? note : note;
      if (target.kind === "answer") {
        const q = target.questionId ? questionById(target.questionId) : undefined;
        if (q) goToQuestion(q);
        return;
      }
      setCommenting(false);
      if (phoneRef.current && target.kind === "comment") setPanel(null);
      goTo("note", target.id, target.route);
    },
    [listsRef, phoneRef, goTo, goToQuestion],
  );

  // Deep links: ?note=<id> opens that page and that thread; ?question=<id> that question.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(search);
    const noteId = params.get("note");
    const questionId = params.get("question");
    if (!noteId && !questionId) return;
    stripParams(["note", "question"]);
    if (noteId) {
      const note = listsRef.current.notes.find((n) => n.id === noteId);
      if (!note) {
        setToast(
          store?.mode === "supabase"
            ? "That note couldn’t be found. It may have been removed."
            : "That note isn’t on this device. Notes stay in the browser they were written in.",
        );
        return;
      }
      ensureIdentity(() => goToNote(note));
    } else if (questionId) {
      const q = questionById(questionId);
      if (q) ensureIdentity(() => goToQuestion(q));
    }
  }, [ready, search, stripParams, listsRef, ensureIdentity, goToNote, goToQuestion, store]);

  const toggleComment = useCallback(() => {
    if (commenting) {
      setCommenting(false);
      setDraft(null);
      setOpen((o) => (o?.type === "compose" && !o.page ? null : o));
      return;
    }
    ensureIdentity(() => {
      if (phoneRef.current) setPanel(null);
      setOpen((o) => (o?.type === "compose" ? o : null));
      setCommenting(true);
    });
  }, [commenting, ensureIdentity, phoneRef]);

  const togglePanel = useCallback(
    (which: "notes" | "questions") =>
      ensureIdentity(() => {
        setPanel((p) => (p === which ? null : which));
        if (which === "questions") markOpened("questions");
        if (phoneRef.current) {
          setOpen(null);
          setCommenting(false);
          setDraft(null);
        }
      }),
    [ensureIdentity, markOpened, phoneRef],
  );

  function pick(target: Element, x: number, y: number) {
    const { element, anchor } = anchorFor(target, x, y);
    setDraft({ element, anchor, what: kindOf(element) });
    setOpen({ type: "compose", page: false });
    if (phone) {
      // Keep the chosen spot above the sheet.
      const room = window.innerHeight * 0.36;
      if (y > room) window.scrollBy({ top: y - room, behavior: reduced ? "instant" : "smooth" });
    }
  }

  async function postComment(body: string, category?: Category) {
    if (!store || !me || !draft) return;
    const note = await store.add({
      kind: "comment",
      route,
      pageTitle: pageTitleNow(route),
      anchor: draft.anchor,
      body,
      category,
      author: me,
      status: "open",
    });
    resolved.current.set(`n:${note.id}`, draft.element);
    setDraft(null);
    setOpen(null);
    setCommenting(false);
    setFresh(note.id);
    setToast("Note posted");
  }

  async function postPageNote(body: string, category?: Category) {
    if (!store || !me) return;
    const note = await store.add({ kind: "page", route, pageTitle: pageTitleNow(route), body, category, author: me, status: "open" });
    setOpen({ type: "thread", id: note.id });
    markOpened(note.id);
  }

  async function reply(root: Note, body: string) {
    if (!store || !me) return;
    await store.add({ kind: "reply", threadId: root.id, route: root.route, pageTitle: root.pageTitle, body, author: me, status: "open" });
  }

  async function setStatus(root: Note, status: "open" | "resolved") {
    if (!store || !me) return;
    await store.update(root.id, { status, resolvedBy: status === "resolved" ? me.name : null });
  }

  async function saveAnswer(q: Question, choices: string[], text: string) {
    if (!store || !me) return;
    await store.add({
      kind: "answer",
      questionId: q.id,
      route: q.route,
      pageTitle: pageLabel(q.route),
      body: [choices.join(", "), text].filter(Boolean).join(" · "),
      answer: text ? { choices, text } : { choices },
      author: me,
      status: "open",
    });
  }

  const brief = () => briefMarkdown(listsRef.current.notes, questions);
  function downloadBrief() {
    const blob = new Blob([brief()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `truemark-review-${new Date().toISOString().slice(0, 10)}.md`;
    link.className = "rl-offscreen";
    (rootRef.current ?? document.body).appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function closeWelcome() {
    setWelcome(null);
  }

  // "Start reviewing" on the Overview.
  const startRef = useLatest(() =>
    ensureIdentity(() => {
      setPanel(null);
      setOpen(null);
      setCommenting(true);
    }),
  );
  useEffect(() => connectCommands(() => startRef.current()), [startRef]);

  /* ---------- Keyboard: C comments, Esc closes the innermost thing ---------- */

  const keys = useLatest({ welcome, open, panel, commenting, draft, toggleComment });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const s = keys.current;
      if (event.key === "Escape") {
        if (s.welcome) setWelcome(null);
        else if (s.open) {
          if (s.open.type === "compose") setDraft(null);
          setOpen(null);
        } else if (s.panel) setPanel(null);
        else if (s.commenting) setCommenting(false);
        else return;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (
        (event.key === "c" || event.key === "C") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.repeat &&
        !s.welcome &&
        !typing(event.target)
      ) {
        event.preventDefault();
        s.toggleComment();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [keys]);

  // A click on the page closes an open thread or question (a composer keeps its words).
  useEffect(() => {
    if (!open || open.type === "compose") return;
    const onDown = (event: PointerEvent) => {
      if (!inLayer(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  /* ---------- What shows ---------- */

  const openRoot = open?.type === "thread" ? notes.find((n) => n.id === open.id) ?? null : null;
  const openQuestion = open?.type === "question" ? questionById(open.id) ?? null : null;
  // A note's link opens its page and thread; it carries the review key when this browser holds one.
  const notePath = openRoot ? withParam(openRoot.route, "note", openRoot.id) : "/";
  const linkHref = useHref(openRoot && reviewKey ? withParam(notePath, "key", reviewKey) : notePath);
  const link = new URL(linkHref, window.location.href).toString();

  const pins: PinView[] = [
    ...routeThreads
      .filter((t) => t.status === "open" || prefs.showResolved || openRoot?.id === t.id)
      .map((t): PinView => {
        const n = screenNumber.get(t.id) ?? 0;
        return {
          key: `n:${t.id}`,
          mark: String(n),
          kind: "note",
          label: `Note ${n} by ${t.author.name}: ${excerpt(t.body)}${t.status === "resolved" ? " (resolved)" : ""}`,
          unread: unread(t),
          resolved: t.status === "resolved",
          open: openRoot?.id === t.id,
          fresh: fresh === t.id,
          onOpen: () => ensureIdentity(() => openThread(t.id)),
        };
      }),
    ...routeQuestions
      .filter((q) => anchoredQ.has(q.id))
      .map((q): PinView => {
        const answered = Boolean(latestAnswer(notes, q.id));
        return {
          key: `q:${q.id}`,
          mark: "?",
          kind: "question",
          label: `Riley asks: ${q.title}${answered ? " (answered)" : ""}`,
          unread: !answered,
          resolved: false,
          open: openQuestion?.id === q.id,
          fresh: false,
          onOpen: () =>
            ensureIdentity(() => setOpen((o) => (o?.type === "question" && o.id === q.id ? null : { type: "question", id: q.id }))),
        };
      }),
    ...(draft
      ? [
          {
            key: "draft",
            mark: String(routeThreads.length + 1),
            kind: "draft" as const,
            label: "New note",
            unread: false,
            resolved: false,
            open: true,
            fresh: true,
          },
        ]
      : []),
  ];

  const pageQuestions = settled ? routeQuestions.filter((q) => !anchoredQ.has(q.id) && !latestAnswer(notes, q.id)) : [];
  const showAsk = pageQuestions.length > 0 && !commenting && !open && !(phone && panel) && !prefs.collapsed;

  return createPortal(
    <div
      ref={rootRef}
      className="rl-root"
      data-phone={phone || undefined}
      data-drawer={!phone && panel ? "" : undefined}
      data-commenting={commenting || undefined}
      data-asking={showAsk || undefined}
    >
      {commenting && (
        <CommentMode phone={phone} composing={Boolean(draft)} onPick={pick} onCancel={toggleComment} />
      )}
      {draft && <Outline trackKey="picked" variant="picked" />}
      {spot && <Outline trackKey="spot" variant="spot" />}
      <Pins pins={pins} />

      {showAsk && (
        <button
          type="button"
          className="rl-ask"
          onClick={() =>
            ensureIdentity(() => {
              if (pageQuestions.length === 1) {
                setOpen({ type: "question", id: pageQuestions[0].id });
                return;
              }
              setExpandedQ(pageQuestions[0].id);
              setPanel("questions");
              markOpened("questions");
            })
          }
        >
          <Dot />
          {pageQuestions.length === 1 ? (
            <span>
              <span className="rl-ask-soft">Riley asks:</span> {pageQuestions[0].title}
            </span>
          ) : (
            <span>Riley has {pageQuestions.length} questions about this page</span>
          )}
        </button>
      )}

      {panel === "questions" && (
        <QuestionsPanel
          questions={questions}
          notes={notes}
          now={now}
          expanded={expandedQ}
          onExpand={setExpandedQ}
          onGoTo={goToQuestion}
          onSave={saveAnswer}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "notes" && me && (
        <NotesPanel
          threads={threads}
          replies={repliesOf}
          numberOf={numberOf}
          unread={unread}
          moved={moved}
          isHere={here}
          status={status}
          notice={notice}
          people={people}
          me={me}
          now={now}
          filter={filter}
          onFilter={setFilter}
          showResolved={prefs.showResolved}
          onShowResolved={(show) => setPrefs((p) => ({ ...p, showResolved: show }))}
          onOpen={goToNote}
          onPageNote={() => {
            setCommenting(false);
            setDraft(null);
            setOpen({ type: "compose", page: true });
          }}
          onChangeName={() => setWelcome({ editing: true })}
          onLeaveDesigner={() => {
            const next: Identity = { ...me, kind: "client" };
            saveIdentity(next);
            setMe(next);
          }}
          onCopyBrief={() => copyText(brief())}
          onDownloadBrief={downloadBrief}
          onClose={() => setPanel(null)}
        />
      )}

      {open?.type === "compose" && (open.page || draft) && (
        <Composer
          key={open.page ? "page" : "pin"}
          pinKey={open.page ? null : "draft"}
          what={open.page ? "This page" : draft?.what ?? "This spot"}
          onPost={open.page ? postPageNote : postComment}
          onCancel={() => {
            setDraft(null);
            setOpen(null);
          }}
        />
      )}
      {openRoot && (
        <Thread
          key={openRoot.id}
          root={openRoot}
          replies={repliesOf(openRoot.id)}
          number={screenNumber.get(openRoot.id) ?? null}
          pinKey={screenNumber.has(openRoot.id) && !moved.has(openRoot.id) ? `n:${openRoot.id}` : null}
          moved={moved.has(openRoot.id)}
          now={now}
          link={link}
          onReply={(body) => reply(openRoot, body)}
          onStatus={(status) => setStatus(openRoot, status)}
          onClose={() => setOpen(null)}
        />
      )}
      {openQuestion && (
        <QuestionPopover
          key={openQuestion.id}
          question={openQuestion}
          answer={latestAnswer(notes, openQuestion.id)}
          pinKey={anchoredQ.has(openQuestion.id) ? `q:${openQuestion.id}` : null}
          now={now}
          onSave={(choices, text) => saveAnswer(openQuestion, choices, text)}
          onClose={() => setOpen(null)}
          onOpenAll={() => {
            setExpandedQ(openQuestion.id);
            setOpen(null);
            setPanel("questions");
            markOpened("questions");
          }}
        />
      )}

      <Dock
        collapsed={prefs.collapsed}
        commenting={commenting}
        panel={panel}
        unanswered={unanswered}
        openNotes={openNotes}
        questionsNew={questionsNew}
        notesNew={notesNew}
        people={people}
        phone={phone}
        onComment={toggleComment}
        onQuestions={() => togglePanel("questions")}
        onNotes={() => togglePanel("notes")}
        onCollapse={() => setPrefs((p) => ({ ...p, collapsed: true }))}
        onExpand={() => setPrefs((p) => ({ ...p, collapsed: false }))}
      />

      <div className="rl-toast" role="status" aria-live="polite" data-shown={toast ? "" : undefined}>
        {toast}
      </div>

      {welcome && (
        <Welcome
          current={welcome.editing ? me : null}
          notice={welcome.editing ? null : notice}
          onClose={closeWelcome}
          onDone={(name, role) => {
            const next: Identity = { id: me?.id ?? newId(), name, role: role || undefined, kind: me?.kind ?? "client" };
            saveIdentity(next);
            setMe(next);
            const then = welcome.then;
            setWelcome(null);
            if (then) window.setTimeout(then, 0);
          }}
        />
      )}
    </div>,
    document.body,
  );
}
