import { LIVE, storageKey } from "../platform/mode";
import { live } from "../platform/live/runtime";
/**
 * The portal's preview session. The store has no partner sign-in or sign-out
 * yet (store.partners.me always answers with the sample partner), so the portal
 * remembers a signed-out choice here. Replace with store.partners.signIn/signOut.
 */
const SIGNED_OUT_KEY = storageKey("tm-preview-partner-signed-out");

export function isSignedOut(): boolean {
  if (LIVE) return false;
  try {
    return localStorage.getItem(SIGNED_OUT_KEY) === "true";
  } catch {
    return false;
  }
}

function remember(signedOut: boolean) {
  try {
    if (signedOut) localStorage.setItem(SIGNED_OUT_KEY, "true");
    else localStorage.removeItem(SIGNED_OUT_KEY);
  } catch {
    /* Without storage the preview simply stays signed in. */
  }
}

/** Preview only: any email opens the sample partner's portal. */
export function signIn(email: string, password = "") {
  if (LIVE) return live().auth.signIn(email, password).then(async (profile) => {
    if (profile?.role === "partner" && await live().store.partners.me()) return;
    if (profile && await live().partnerApplications.mine()) return;
    throw new Error("This account does not have a linked partner profile.");
  });
  remember(false);
}

export function signOut() {
  if (LIVE) return live().auth.signOut();
  remember(true);
}
