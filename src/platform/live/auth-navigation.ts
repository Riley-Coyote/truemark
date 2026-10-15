import { PATH_ROUTER } from "../mode";

/** Auth always returns to the configured deployment root, including from a deep route. */
export function authRedirectUrl() {
  return new URL(import.meta.env?.BASE_URL ?? "./", location.href).href;
}

/** Replace an Auth route without reloading the session being verified. */
export function replaceAuthRoute(route: string, notify = true) {
  const url = new URL(authRedirectUrl());
  if (PATH_ROUTER) {
    const destination = new URL(url.pathname.replace(/\/$/, "") + route, url.origin);
    if (notify) {
      for (const [key, value] of new URL(location.href).searchParams) {
        if (!["token_hash", "type"].includes(key) && !destination.searchParams.has(key)) destination.searchParams.append(key, value);
      }
    }
    history.replaceState(history.state, "", destination.pathname + destination.search + destination.hash);
    if (notify) window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  } else if (notify) {
    // Keep the outer PKCE query until initialize() finishes its one-time exchange.
    location.hash = route;
  } else {
    const current = new URL(location.href);
    current.hash = route;
    history.replaceState(history.state, "", current.pathname + current.search + current.hash);
  }
}

export function clearEmailToken(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  params.delete("token_hash");
  params.delete("type");
  replaceAuthRoute(pathname + (params.size ? `?${params}` : ""), false);
}
