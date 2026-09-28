/**
 * Notes shared through Supabase, for people holding the review key. The database is reached
 * only through its functions (supabase/review.sql) — review_list, review_add and
 * review_set_status, each given the key, which the server checks; the tables themselves are
 * closed to the public key. Live updates travel on one Broadcast channel per review, named
 * from the key's hash: after each write this browser says {type: "changed", id}, and every
 * other open review reads the list again. Presence (who is here, on which page) shares that
 * channel, so names never sit on a channel anyone could guess.
 */
import { newId } from "../identity";
import type { Anchor, Answer, Category, Identity, LiveState, NewNote, Note, NotePatch, Person, PresenceHandle, ReviewStore } from "../types";

/* ---------- What the adapter needs from a Supabase client (the real one, or a test's) ---------- */

export type RpcError = { code?: string; message: string };
export type RpcResult = { data: unknown; error: RpcError | null };

export interface ChannelLike {
  on(type: "broadcast", filter: { event: string }, callback: (message: { payload?: unknown }) => void): ChannelLike;
  on(type: "presence", filter: { event: "sync" }, callback: () => void): ChannelLike;
  subscribe(callback?: (status: string, error?: Error) => void): ChannelLike;
  send(message: { type: "broadcast"; event: string; payload: Record<string, unknown> }): Promise<unknown>;
  track(payload: Record<string, unknown>): Promise<unknown>;
  untrack(): Promise<unknown>;
  presenceState(): Record<string, Array<Record<string, unknown>>>;
}

export interface ClientLike {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  channel(name: string, options: { config: { broadcast: { self: boolean }; presence: { key: string } } }): ChannelLike;
  removeChannel(channel: ChannelLike): Promise<unknown>;
}

/** The server refused the key (SQLSTATE 28000): the link is not (or no longer) valid. */
export class InvalidKeyError extends Error {
  constructor() {
    super("invalid review key");
    this.name = "InvalidKeyError";
  }
}

/* ---------- Rows ---------- */

type Row = {
  id: string;
  project: string;
  kind: Note["kind"];
  thread_id: string | null;
  question_id: string | null;
  route: string;
  page_title: string;
  anchor: Anchor | null;
  body: string;
  category: Category | null;
  answer: Answer | null;
  author_id: string;
  author_name: string;
  author_role: string | null;
  author_kind: Note["author"]["kind"];
  status: Note["status"];
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

const fromRow = (row: Row): Note => ({
  id: row.id,
  project: row.project,
  kind: row.kind,
  threadId: row.thread_id ?? undefined,
  questionId: row.question_id ?? undefined,
  route: row.route,
  pageTitle: row.page_title,
  anchor: row.anchor ?? undefined,
  body: row.body,
  category: row.category ?? undefined,
  answer: row.answer ?? undefined,
  author: { id: row.author_id, name: row.author_name, role: row.author_role ?? undefined, kind: row.author_kind },
  status: row.status,
  resolvedBy: row.resolved_by ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** A new note as the server takes it. The project and the times are the server's to set. */
const toNote = (note: NewNote & { id: string }) => ({
  id: note.id,
  kind: note.kind,
  thread_id: note.threadId ?? null,
  question_id: note.questionId ?? null,
  route: note.route,
  page_title: note.pageTitle,
  anchor: note.anchor ?? null,
  body: note.body,
  category: note.category ?? null,
  answer: note.answer ?? null,
  author_id: note.author.id,
  author_name: note.author.name,
  author_role: note.author.role ?? null,
  author_kind: note.author.kind,
  status: note.status,
});

const one = (data: unknown): Row => (Array.isArray(data) ? data[0] : data) as Row;
const byCreated = (a: Note, b: Note) => a.createdAt.localeCompare(b.createdAt);

type Here = { id: string; name: string; role: string | null; kind: Identity["kind"]; route: string };

/** Everyone on the channel, one entry per person however many tabs they have open. */
function peopleIn(state: Record<string, Array<Record<string, unknown>>>): Person[] {
  const byPerson = new Map<string, Person>();
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      const { id, name, role, kind, route } = entry as Partial<Here>;
      if (typeof id !== "string" || typeof name !== "string") continue;
      byPerson.set(id, { id, name, role: role ?? undefined, kind: kind === "designer" ? "designer" : "client", route: typeof route === "string" ? route : "/" });
    }
  }
  return [...byPerson.values()];
}

/* ---------- The store ---------- */

export function createSupabaseStore(client: ClientLike, key: string, channelName: string): ReviewStore {
  const byId = new Map<string, Note>();
  const listeners = new Set<(notes: Note[]) => void>();
  const stateListeners = new Set<(state: LiveState) => void>();
  let listed = false;
  let joined = false;
  let closed = false;
  let loading: Promise<void> | null = null;
  let again = false;
  let reloadTimer = 0;
  let mine: Here | null = null;
  let onPeople: ((people: Person[]) => void) | null = null;

  const all = () => [...byId.values()].sort(byCreated);
  const notify = () => {
    const notes = all();
    listeners.forEach((listener) => listener(notes));
  };
  const current = (): LiveState => (listed && joined ? "live" : "connecting");
  let reported = current();
  const report = () => {
    const next = current();
    if (next === reported) return;
    reported = next;
    stateListeners.forEach((listener) => listener(next));
  };

  /** Keep the newer of two copies; nothing is ever deleted, so lists only add or refresh. */
  const keep = (row: Row) => {
    const next = fromRow(row);
    const known = byId.get(next.id);
    if (!known || known.updatedAt <= next.updatedAt) byId.set(next.id, next);
  };

  async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw error.code === "28000" ? new InvalidKeyError() : new Error(error.message);
    return data;
  }

  function load(): Promise<void> {
    loading ??= (async () => {
      try {
        const data = await call("review_list", { p_key: key });
        (Array.isArray(data) ? (data as Row[]) : []).forEach(keep);
        listed = true;
        notify();
        report();
      } finally {
        loading = null;
        if (again && !closed) {
          again = false;
          void load().catch(() => {});
        }
      }
    })();
    return loading;
  }

  /** Someone changed something: read the list again, once, shortly. */
  function reloadSoon() {
    if (closed) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (loading) again = true;
      else void load().catch(() => {});
    }, 150);
  }

  const channel = client.channel(channelName, { config: { broadcast: { self: false }, presence: { key: newId() } } });
  channel.on("broadcast", { event: "changed" }, () => reloadSoon());
  channel.on("presence", { event: "sync" }, () => onPeople?.(peopleIn(channel.presenceState())));
  channel.subscribe((status) => {
    if (closed) return;
    if (status === "SUBSCRIBED") {
      joined = true;
      report();
      if (mine) void channel.track(mine);
      // After a reconnect, catch up on anything said while away.
      if (listed) reloadSoon();
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      joined = false;
      report();
    }
  });

  /** Tell everyone else holding the key to read the list again. */
  const announce = (id: string) => {
    void channel.send({ type: "broadcast", event: "changed", payload: { type: "changed", id } }).catch(() => {});
  };

  return {
    mode: "supabase",
    async list() {
      await load();
      return all();
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    async add(input: NewNote) {
      const data = await call("review_add", { p_key: key, p_note: toNote({ ...input, id: input.id ?? newId() }) });
      const row = one(data);
      keep(row);
      notify();
      announce(row.id);
      return fromRow(row);
    },
    async update(id: string, patch: NotePatch) {
      const data = await call("review_set_status", {
        p_key: key,
        p_id: id,
        p_status: patch.status,
        p_by: patch.status === "resolved" ? (patch.resolvedBy ?? null) : null,
      });
      const row = one(data);
      keep(row);
      notify();
      announce(row.id);
      return fromRow(row);
    },
    presence(me, route, listener): PresenceHandle {
      mine = { id: me.id, name: me.name, role: me.role ?? null, kind: me.kind, route };
      onPeople = listener;
      if (joined) void channel.track(mine);
      listener(peopleIn(channel.presenceState()));
      return {
        move(next) {
          if (!mine) return;
          mine = { ...mine, route: next };
          if (joined) void channel.track(mine);
        },
        leave() {
          mine = null;
          onPeople = null;
          if (joined) void channel.untrack();
        },
      };
    },
    state(onChange) {
      stateListeners.add(onChange);
      onChange(current());
      return () => stateListeners.delete(onChange);
    },
    close() {
      closed = true;
      clearTimeout(reloadTimer);
      listeners.clear();
      stateListeners.clear();
      void client.removeChannel(channel);
    },
  };
}
