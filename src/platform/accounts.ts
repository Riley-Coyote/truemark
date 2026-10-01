/** Account contracts shared by live transport and its existing screens. */
export type Profile = { id: string; role: "owner" | "staff" | "buyer" | "partner" };
export type RecoveryGate = "shop" | "partner" | "team";
export type Recovery = { userId: string; email: string; gate: RecoveryGate; error?: string };
export type PartnerApplicationDraft = {
  name: string; email: string; channel: string; otherChannels: string[];
  audience: string; feature: string; commitments: string[];
};
export type PartnerApplication = PartnerApplicationDraft & {
  id: string; userId: string; submittedAt: string; status: "submitted" | "approved" | "declined";
  reviewedAt?: string; reviewedBy?: string; reviewNote?: string; partnerId?: string;
  approvedCode?: string; approvedRate?: number; approvedPercent?: number;
};
export const RESET_SENT = "If an account exists for that email, a reset link is on its way. Open it in this browser.";
export const LINK_FAILED = "That link has expired or could not be used. Request a new reset link.";
/** A PKCE link only completes in the browser that asked for it; elsewhere it does nothing at all. */
export const LINK_ELSEWHERE = "That link only works in the browser where it was requested. Request a new reset link here, then open the email on this device.";
export const PREVIEW_RESET = "Password resets work in the live platform.";
export const roleHome = (role: Profile["role"]) => role === "owner" || role === "staff" ? "/admin" : role === "partner" ? "/partners/app" : "/account";
export const recoveryPath = (gate: RecoveryGate) => gate === "team" ? "/admin" : gate === "partner" ? "/partners/sign-in" : "/access";
export function passwordProblem(password: string, confirmation = password) {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password !== confirmation) return "The passwords don't match.";
}
export const suggestPartnerCode = (name: string) => `${name.trim().split(/\s+/)[0].normalize("NFKD").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 60) || "PARTNER"}10`;
