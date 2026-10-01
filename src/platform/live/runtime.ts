import { getClient } from "./client";
import { createLiveAdapter } from "./adapter";
import { changed } from "./storage";
import { emit } from "./events";
import { recoveryPath } from "../accounts";

export function clearAuthCode() {
  const url = new URL(location.href);
  if (url.searchParams.has("code")) {
    url.searchParams.delete("code");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }
}

let adapter: ReturnType<typeof createLiveAdapter> | undefined;
let currentUser: string | null | undefined;
let ready: Promise<void> | undefined;
export function live() {
  if (!adapter) {
    const client = getClient();
    adapter = createLiveAdapter(client, { changed, emit, redirectTo: () => location.origin + location.pathname,
      recoveryStorage: {
        getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: (key) => localStorage.removeItem(key),
      },
      onRecovery: (gate) => { location.hash = recoveryPath(gate); },
      onPasswordSaved: clearAuthCode,
    });
    client.auth.onAuthStateChange((event, session) => {
      // Do not await another Auth operation inside GoTrue's storage lock.
      adapter!.auth.onAuthStateChange(event, session);
      const id = session?.user.id ?? null;
      if (id !== currentUser) {
        currentUser = id;
        adapter!.startRealtime(id);
      }
      changed();
    });
    window.addEventListener("focus", changed);
    window.addEventListener("online", changed);
    window.addEventListener("storage", (event) => { if (event.key?.startsWith("tm-live-")) changed(); });
  }
  return adapter;
}
export function initialize() {
  return ready ??= (async () => {
    live();
    const hadCode = new URL(location.href).searchParams.has("code");
    // Supabase only exchanges a code when this browser holds the verifier the request stored.
    // Without one (the email opened on another device), the link would silently do nothing.
    let hadVerifier = false;
    try { hadVerifier = Object.keys(localStorage).some((key) => key.startsWith("tm-live-auth") && key.endsWith("-code-verifier")); } catch { /* Treated as absent. */ }
    // detectSessionInUrl performs the PKCE exchange once. Wait for that operation
    // before cleaning its URL; calling exchangeCodeForSession again consumes it twice.
    const { error } = await getClient().auth.initialize();
    if (error) {
      if (hadCode) live().auth.recoveryFailed();
      else throw new Error(error.message);
    } else if (hadCode && !hadVerifier) live().auth.recoveryFailed("elsewhere");
    clearAuthCode();
  })();
}
