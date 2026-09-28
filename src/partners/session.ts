/**
 * The portal's preview session. The store has no partner sign-in or sign-out
 * yet (store.partners.me always answers with the sample partner), so the portal
 * remembers a signed-out choice here. Replace with store.partners.signIn/signOut.
 */
const SIGNED_OUT_KEY = "tm-preview-partner-signed-out";

export function isSignedOut(): boolean {
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
export function signIn(_email: string) {
  remember(false);
}

export function signOut() {
  remember(true);
}
