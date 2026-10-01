import type { PlatformEvent } from "../preview/events";
const local = new EventTarget();
/** Database events have already been delivered across devices by Supabase. */
export function emit(event: PlatformEvent) {
  local.dispatchEvent(new CustomEvent("platform", { detail: event }));
}
export function onPlatformEvent(handler: (event: PlatformEvent, fromHere: boolean) => void) {
  const listen = (event: Event) => handler((event as CustomEvent<PlatformEvent>).detail, false);
  local.addEventListener("platform", listen);
  return () => local.removeEventListener("platform", listen);
}
