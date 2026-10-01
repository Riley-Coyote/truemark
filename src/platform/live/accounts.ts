import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { LINK_ELSEWHERE, LINK_FAILED, passwordProblem, RESET_SENT, roleHome } from "../accounts";
import type { PartnerApplicationDraft, Profile, Recovery, RecoveryGate } from "../accounts";
import type { Row } from "./rows";
import { partnerApplication } from "./rows";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export type AccountOptions = {
  redirectTo?: () => string;
  recoveryStorage?: Storage;
  onRecovery?: (gate: RecoveryGate) => void;
  onPasswordSaved?: () => void;
};
const GATE_KEY = "tm-live-recovery-gate";
const USER_KEY = "tm-live-recovery-user";

export function createAccounts(client: SupabaseClient, rows: (table: string, select?: string, filters?: Record<string, string>) => Promise<Row[]>,
  rpc: <T>(name: string, args: Record<string, unknown>) => Promise<T>, profile: () => Promise<Profile | null>, changed: () => void, signOut: () => Promise<void>, options: AccountOptions) {
  let recovery: Recovery | null = null;
  const listeners = new Set<() => void>();
  const read = (key: string) => { try { return options.recoveryStorage?.getItem(key); } catch { return null; } };
  const write = (key: string, value: string | null) => { try { if (value === null) options.recoveryStorage?.removeItem(key); else options.recoveryStorage?.setItem(key, value); } catch { /* This visit can still recover without persistence. */ } };
  let gate: RecoveryGate = read(GATE_KEY) === "team" ? "team" : read(GATE_KEY) === "partner" ? "partner" : "shop";
  function setRecovery(value: Recovery | null) { recovery = value; listeners.forEach((listener) => listener()); }
  const auth = {
    recovery: () => recovery,
    subscribeRecovery(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    recoveryFailed(reason: "failed" | "elsewhere" = "failed") {
      write(USER_KEY, null);
      setRecovery({ userId: "", email: "", gate, error: reason === "elsewhere" ? LINK_ELSEWHERE : LINK_FAILED });
      options.onRecovery?.(gate);
    },
    dismissRecoveryError() { if (recovery?.error) setRecovery(null); },
    // Synchronous: Supabase invokes this under its Auth storage lock.
    onAuthStateChange(event: AuthChangeEvent, session: Session | null) {
      if (event === "PASSWORD_RECOVERY" && session) {
        const storedGate = read(GATE_KEY);
        if (storedGate === "shop" || storedGate === "team" || storedGate === "partner") gate = storedGate;
        write(USER_KEY, session.user.id);
        setRecovery({ userId: session.user.id, email: session.user.email ?? "", gate });
        options.onRecovery?.(gate);
      } else if (event === "INITIAL_SESSION" && session && session.user.id === read(USER_KEY)) {
        setRecovery({ userId: session.user.id, email: session.user.email ?? "", gate });
        options.onRecovery?.(gate);
      } else if (event === "SIGNED_OUT" || (recovery?.userId && session?.user.id !== recovery.userId)) {
        write(USER_KEY, null); setRecovery(null);
      } else if (event === "SIGNED_IN" && read(USER_KEY) !== session?.user.id) {
        write(USER_KEY, null);
      }
    },
    async requestPasswordReset(email: string, source: RecoveryGate) {
      gate = source; write(GATE_KEY, gate);
      try {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: options.redirectTo?.() });
        if (error) throw error;
      } catch (failure) {
        const error = (failure && typeof failure === "object" ? failure : {}) as { status?: number; code?: string; message?: string };
        if (error.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(error.code ?? "")) {
          throw new Error(error.message || "Too many requests. Please try again later.");
        }
        // Never pass account-existence details from Auth through this public form.
      }
      return RESET_SENT;
    },
    async setNewPassword(password: string, confirmation: string) {
      const problem = passwordProblem(password, confirmation);
      if (problem) throw new Error(problem);
      const current = await profile();
      if (!recovery || !current || current.id !== recovery.userId) throw new Error("Open your reset link again to set a new password.");
      const application = current.role === "buyer" ? (await rows("partner_applications", "*", { user_id: current.id }))[0] : null;
      const destination = application?.status === "submitted" || application?.status === "declined" ? "/partners/app" : roleHome(current.role);
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      write(USER_KEY, null); write(GATE_KEY, null);
      options.onPasswordSaved?.();
      setRecovery(null); changed();
      return destination;
    },
    async signUpPartner(draft: PartnerApplicationDraft, password: string) {
      const problem = passwordProblem(password);
      if (problem) throw new Error(problem);
      const { name, channel, otherChannels, audience, feature, commitments } = draft;
      const { data, error } = await client.auth.signUp({ email: draft.email, password,
        options: { data: { partner_application: { name, channel, otherChannels, audience, feature, commitments } }, emailRedirectTo: options.redirectTo?.() } });
      if (error) throw new Error(error.message);
      if (data.session) await signOut();
      else changed();
      return { confirmationRequired: !data.session };
    },
  };
  const applications = {
    async list() { return (await rows("partner_applications")).map(partnerApplication).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)); },
    async mine() {
      const me = await profile();
      if (!me) return null;
      const row = (await rows("partner_applications", "*", { user_id: me.id }))[0];
      return row ? partnerApplication(row) : null;
    },
    async approve(id: string, code: string, rate: number, percent: number) {
      const row = await rpc<Row>("approve_partner_application", { id, code: code.trim().toUpperCase(), rate, percent });
      changed(); return partnerApplication(row);
    },
    async decline(id: string, note: string) {
      const row = await rpc<Row>("decline_partner_application", { id, note: note.trim() });
      changed(); return partnerApplication(row);
    },
  };
  return { auth, applications };
}
