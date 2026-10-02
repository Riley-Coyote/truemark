export type TeamRole = "owner" | "staff";
export type TeamMember = { id: string; email: string; role: TeamRole; joinedAt: string; lastSignInAt: string | null };
export type TeamInvite = { id: string; email: string; role: TeamRole; expiresAt: string };
export type InvitePreview = Pick<TeamInvite, "email" | "role" | "expiresAt">;
export const teamRoleLabel = (role: TeamRole) => role === "owner" ? "Owner" : "Staff";
export const teamInviteLink = (base: string, token: string) => `${base.split(/[?#]/)[0]}#/access/team?invite=${encodeURIComponent(token)}`;
export const INVITE_UNAVAILABLE = "This invitation is no longer available. Ask the owner for a new link.";
