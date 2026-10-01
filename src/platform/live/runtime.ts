import { getClient } from "./client";
import { createLiveAdapter } from "./adapter";
import { changed } from "./storage";
import { emit } from "./events";

let adapter: ReturnType<typeof createLiveAdapter> | undefined;
let currentUser: string | null | undefined;
let ready: Promise<void> | undefined;
export function live() {
  if (!adapter) {
    const client = getClient();
    adapter = createLiveAdapter(client, { changed, emit, redirectTo: () => location.origin + location.pathname });
    client.auth.onAuthStateChange((_event, session) => {
      // Do not await another Auth operation inside GoTrue's storage lock.
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
    // detectSessionInUrl performs the PKCE exchange once. Wait for that operation
    // before cleaning its URL; calling exchangeCodeForSession again consumes it twice.
    const { error } = await getClient().auth.initialize();
    if (error) throw new Error(error.message);
    const url = new URL(location.href);
    if (url.searchParams.has("code")) {
      url.searchParams.delete("code");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    }
  })();
}
