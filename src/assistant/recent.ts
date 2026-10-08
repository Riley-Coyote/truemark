import { storageKey } from "../platform/mode";

/* The last product a reader looked at, on this device: its page, or its card in the chat. The desk
   offers it again on a return visit. Kept for thirty days; nothing leaves the device. */

const KEY = storageKey("tm-desk-recent");
const MONTH = 30 * 24 * 60 * 60 * 1000;
/** A visit counts as a return once this long has passed since the last look. */
const AWAY = 30 * 60 * 1000;

type Recent = { id: string; at: number };

function read(): Recent | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Recent | null;
    return saved && typeof saved.id === "string" && Date.now() - saved.at < MONTH ? saved : null;
  } catch { return null; }
}

/** What this visit found when it began, so a product looked at today is not offered back today. */
const atStart = read();

export function rememberProduct(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() })); } catch { /* Memory is a nicety. */ }
}
/** The product to offer back: one looked at on an earlier visit. */
export function returningProduct(): string | null {
  return atStart && Date.now() - atStart.at > AWAY ? atStart.id : null;
}
