/**
 * Who is reviewing, kept on this device: a name, an optional company or role, and a random
 * id. Designer mode (`?as=designer`) marks Riley's notes. The last visit per identity decides
 * what counts as new.
 */
import type { Identity } from "./types";

const IDENTITY_KEY = "rl-identity";
const SEEN_KEY = "rl-seen-v1";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Without storage the review still works for this visit. */
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function loadIdentity(): Identity | null {
  const stored = readJson<Identity>(IDENTITY_KEY);
  if (!stored || typeof stored.id !== "string" || typeof stored.name !== "string" || !stored.name.trim()) return null;
  return { id: stored.id, name: stored.name, role: stored.role || undefined, kind: stored.kind === "designer" ? "designer" : "client" };
}

export function saveIdentity(identity: Identity) {
  writeJson(IDENTITY_KEY, identity);
}

/**
 * Designer mode: the designer is Riley. An existing designer keeps their name and id; a
 * client identity on the same browser is a different person, so the designer gets a new id
 * (their notes then read as someone else's, and new to Riley).
 */
export function designerIdentity(current: Identity | null): Identity {
  if (current?.kind === "designer") return current;
  return { id: newId(), name: "Riley", kind: "designer" };
}

/**
 * The viewer's previous visit, and the start of this one recorded for next time.
 * Returns null on a first visit (everything by others is then new).
 */
export function beginVisit(identityId: string): string | null {
  const seen = readJson<Record<string, string>>(SEEN_KEY) ?? {};
  const previous = seen[identityId] ?? null;
  seen[identityId] = new Date().toISOString();
  writeJson(SEEN_KEY, seen);
  return previous;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const PREFS_KEY = "rl-prefs-v1";
export type Prefs = { collapsed: boolean; showResolved: boolean };

export function loadPrefs(): Prefs {
  const stored = readJson<Partial<Prefs>>(PREFS_KEY) ?? {};
  return { collapsed: stored.collapsed === true, showResolved: stored.showResolved === true };
}

export function savePrefs(prefs: Prefs) {
  writeJson(PREFS_KEY, prefs);
}
