import type { SupabaseClient } from "@supabase/supabase-js";
import { passwordProblem } from "../accounts";
import type { Profile } from "../accounts";
import { INVITE_UNAVAILABLE } from "../team";
import type { InvitePreview, TeamInvite, TeamMember, TeamRole } from "../team";
import type { Row } from "./rows";

export function createTeam(client: SupabaseClient, rpc: <T>(name: string, args?: Record<string, unknown>) => Promise<T>,
  profile: () => Promise<Profile | null>, changed: () => void, redirectTo?: () => string) {
  const previewInvite = (token: string) => rpc<InvitePreview | null>("team_invite_preview", { token });
  async function account() {
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(error.message);
    return data.session ? { id: data.session.user.id, email: data.session.user.email ?? "" } : null;
  }
  async function acceptInvite(token: string) {
    const role = await rpc<TeamRole>("accept_team_invite", { token });
    changed(); return role;
  }
  return {
    account, previewInvite, acceptInvite,
    async members(): Promise<TeamMember[]> {
      return (await rpc<Row[]>("team_members")).map((row) => ({ id: String(row.user_id), email: String(row.email), role: row.role as TeamRole,
        joinedAt: String(row.joined_at), lastSignInAt: row.last_sign_in_at == null ? null : String(row.last_sign_in_at) }));
    },
    async invites(): Promise<TeamInvite[]> {
      return (await rpc<Row[]>("team_invites")).map((row) => ({ id: String(row.id), email: String(row.email), role: row.role as TeamRole, expiresAt: String(row.expires_at) }));
    },
    async createInvite(email: string, role: TeamRole) {
      const token = await rpc<string>("create_team_invite", { email: email.trim().toLowerCase(), role });
      changed(); return token;
    },
    async revokeInvite(id: string) {
      const result = await rpc<boolean>("revoke_team_invite", { invite_id: id });
      changed(); return result;
    },
    async setRole(id: string, role: TeamRole | "buyer") {
      const result = await rpc<TeamRole | "buyer">("set_team_role", { user_id: id, role });
      changed(); return result;
    },
    async signUp(token: string, password: string) {
      const problem = passwordProblem(password);
      if (problem) throw new Error(problem);
      if (await account()) throw new Error("Sign out before creating a new account.");
      const invitation = await previewInvite(token);
      if (!invitation) throw new Error(INVITE_UNAVAILABLE);
      const { data, error } = await client.auth.signUp({ email: invitation.email, password,
        options: { data: { team_invite: token }, emailRedirectTo: redirectTo?.() } });
      if (error) throw new Error(error.message);
      changed();
      if (data.session) {
        const current = await profile();
        if (!current || !["owner", "staff"].includes(current.role)) throw new Error(INVITE_UNAVAILABLE);
      }
      return { confirmationRequired: !data.session };
    },
    async signIn(token: string, password: string) {
      const invitation = await previewInvite(token);
      if (!invitation) throw new Error(INVITE_UNAVAILABLE);
      const { error } = await client.auth.signInWithPassword({ email: invitation.email, password });
      if (error) throw new Error(error.message);
      return acceptInvite(token);
    },
  };
}
