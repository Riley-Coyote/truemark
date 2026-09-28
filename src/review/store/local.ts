/**
 * Notes kept on this device: localStorage (`rl-notes-v1`), and live across this browser's
 * tabs through a BroadcastChannel (`rl-review`), with the storage event as a fallback.
 */
import { newId } from "../identity";
import type { NewNote, Note, NotePatch, ReviewStore } from "../types";

const KEY = "rl-notes-v1";
const CHANNEL = "rl-review";

function read(): Note[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Note[]) : [];
  } catch {
    return [];
  }
}

function write(notes: Note[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* Storage full or unavailable: the note lives for this visit only. */
  }
}

export function createLocalStore(project: string): ReviewStore {
  let notes = read();
  const listeners = new Set<(notes: Note[]) => void>();
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);

  const notify = () => listeners.forEach((listener) => listener(notes));
  const reload = () => {
    notes = read();
    notify();
  };
  channel?.addEventListener("message", reload);
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === null) reload();
  });

  const commit = (next: Note[]) => {
    notes = next;
    write(notes);
    notify();
    channel?.postMessage({ type: "changed" });
  };

  return {
    mode: "local",
    async list() {
      return notes;
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    async add(input: NewNote) {
      const now = new Date().toISOString();
      const note: Note = { ...input, id: input.id ?? newId(), project, createdAt: now, updatedAt: now };
      commit([...read().filter((n) => n.id !== note.id), note]);
      return note;
    },
    async update(id: string, patch: NotePatch) {
      const current = read();
      const found = current.find((n) => n.id === id);
      if (!found) return null;
      const next: Note = { ...found, updatedAt: new Date().toISOString() };
      if (patch.status) next.status = patch.status;
      if (patch.body !== undefined) next.body = patch.body;
      if (patch.resolvedBy === null) delete next.resolvedBy;
      else if (patch.resolvedBy !== undefined) next.resolvedBy = patch.resolvedBy;
      commit(current.map((n) => (n.id === id ? next : n)));
      return next;
    },
  };
}
