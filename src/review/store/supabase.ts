/**
 * Notes shared live through Supabase: the `review_notes` table (see supabase/review.sql),
 * its realtime changes, and a presence channel (`review:<project>`) for who is here now.
 * Columns are snake_case; this adapter maps them to the layer's shapes.
 */
import { createClient } from "@supabase/supabase-js";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { newId } from "../identity";
import type { Anchor, Answer, Category, NewNote, Note, NotePatch, Person, ReviewStore } from "../types";

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

const toRow = (note: NewNote & { id: string }, project: string) => ({
  id: note.id,
  project,
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
  resolved_by: note.resolvedBy ?? null,
});

type Presence = Omit<Person, "id"> & { id: string };

export function createSupabaseStore(url: string, anonKey: string, project: string): ReviewStore {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const byId = new Map<string, Note>();
  const listeners = new Set<(notes: Note[]) => void>();
  let loaded: Promise<void> | null = null;

  const all = () => Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const notify = () => {
    const notes = all();
    listeners.forEach((listener) => listener(notes));
  };
  const keep = (note: Note) => {
    byId.set(note.id, note);
    notify();
  };

  const load = () => {
    loaded ??= (async () => {
      const { data, error } = await client
        .from("review_notes")
        .select("*")
        .eq("project", project)
        .order("created_at", { ascending: true });
      if (error) throw error;
      for (const row of (data ?? []) as Row[]) byId.set(row.id, fromRow(row));
      notify();
    })();
    return loaded;
  };

  client
    .channel(`review-notes:${project}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "review_notes", filter: `project=eq.${project}` },
      (payload: RealtimePostgresChangesPayload<Row>) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as Partial<Row>).id;
          if (id && byId.delete(id)) notify();
          return;
        }
        keep(fromRow(payload.new));
      },
    )
    .subscribe();

  return {
    mode: "supabase",
    async list() {
      await load();
      return all();
    },
    subscribe(onChange) {
      listeners.add(onChange);
      load().catch(() => {
        /* The layer shows what it has; a failed load is retried on the next list(). */
        loaded = null;
      });
      return () => listeners.delete(onChange);
    },
    async add(input: NewNote) {
      const id = input.id ?? newId();
      const now = new Date().toISOString();
      // Shown at once; the database's own copy replaces it when it arrives.
      keep({ ...input, id, project, createdAt: now, updatedAt: now });
      const { data, error } = await client.from("review_notes").insert(toRow({ ...input, id }, project)).select().single();
      if (error) {
        byId.delete(id);
        notify();
        throw error;
      }
      const saved = fromRow(data as Row);
      keep(saved);
      return saved;
    },
    async update(id: string, patch: NotePatch) {
      const change: Record<string, unknown> = {};
      if (patch.status) change.status = patch.status;
      if (patch.body !== undefined) change.body = patch.body;
      if (patch.resolvedBy !== undefined) change.resolved_by = patch.resolvedBy;
      const { data, error } = await client
        .from("review_notes")
        .update(change)
        .eq("id", id)
        .eq("project", project)
        .select()
        .single();
      if (error) throw error;
      const saved = fromRow(data as Row);
      keep(saved);
      return saved;
    },
    presence(me, route, onPeople) {
      const channel = client.channel(`review:${project}`, { config: { presence: { key: me.id } } });
      let current: Presence = { id: me.id, name: me.name, role: me.role, kind: me.kind, route };
      let joined = false;
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<Presence>();
        const people = Object.values(state)
          .map((entries) => entries[entries.length - 1])
          .filter((p): p is Presence & { presence_ref: string } => Boolean(p?.id))
          .map(({ id, name, role, kind, route: at }) => ({ id, name, role, kind, route: at }));
        onPeople(people);
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          joined = true;
          void channel.track(current);
        }
      });
      return {
        move(next) {
          current = { ...current, route: next };
          if (joined) void channel.track(current);
        },
        leave() {
          void channel.untrack();
          void client.removeChannel(channel);
        },
      };
    },
  };
}
