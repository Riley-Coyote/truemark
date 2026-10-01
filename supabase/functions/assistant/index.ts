import { resolveProvider } from "./providers.ts";
import { DEFAULT_MODELS, modelCatalog, type Models } from "./models.ts";
import { createHandler, type Identity, type Message, type Repository, type Thread } from "./server.ts";

// Runtime-injected credentials stay in this server module. No browser import or logging.
const url = Deno.env.get("SUPABASE_URL") ?? "";
const serverCredential = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const provider = resolveProvider((name) => Deno.env.get(name));
async function rest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${path}`, { method: body === undefined ? "GET" : "POST",
    headers: { apikey: serverCredential, Authorization: `Bearer ${serverCredential}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Assistant storage unavailable");
  return await response.json() as T;
}
const rpc = <T>(name: string, body: unknown) => rest<T>(`rpc/${name}`, body);
const repository: Repository = {
  async identify(token) {
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serverCredential, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const user = await response.json();
    if (typeof user.id !== "string" || !/^[a-f0-9-]{36}$/i.test(user.id)) return null;
    const profiles = await rest<{ role: string }[]>(`profiles?id=eq.${user.id}&select=role&limit=1`);
    const role = profiles[0]?.role ?? "buyer";
    const partners = role === "partner" ? await rest<{ id: string }[]>(`partners?user_id=eq.${user.id}&select=id&limit=1`) : [];
    return { id: user.id, role, hasPartner: partners.length > 0 } satisfies Identity;
  },
  async review(key) { try { return Boolean(await rpc("assistant_review_project", { p_key: key })); } catch { return false; } },
  usage: (subject, kind) => rpc("assistant_take_usage", { p_subject: subject, p_class: kind }),
  async thread(id) { return (await rest<Thread[]>(`assistant_threads?id=eq.${id}&select=*&limit=1`))[0] ?? null; },
  async messages(id) {
    return (await rest<Message[]>(`assistant_messages?thread_id=eq.${id}&select=role,content,tool_calls,tool_call_id&order=id.desc&limit=24`)).reverse()
      .map((m) => ({ role: m.role, content: m.content, ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}), ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}) }));
  },
  reserve: (thread, content, round) => rpc("assistant_reserve", { p_id: thread.id, p_subject: thread.subject_hash, p_token: thread.token_hash,
    p_user: thread.user_id, p_persona: thread.persona, p_mode: thread.mode, p_revision: thread.revision, p_round: round, p_content: content }),
  finish: (id, revision, message, accounting) => rpc("assistant_finish", { p_id: id, p_revision: revision, p_content: message ? { ...message, ...accounting } : null }),
  async models() {
    const rows = await rest<Record<string, string>[]>("settings?select=assistant_model_visitor,assistant_model_partner,assistant_model_owner&limit=1");
    return Object.fromEntries(Object.entries(DEFAULT_MODELS).map(([persona, fallback]) => [persona, rows[0]?.[`assistant_model_${persona}`] ?? fallback])) as Models;
  },
  spend: () => rpc("assistant_month_spend", {}),
};
Deno.serve(createHandler({ repository, provider: url && serverCredential ? provider : null, catalog: modelCatalog(),
  async hash(text) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(serverCredential), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text))), (v) => v.toString(16).padStart(2, "0")).join("");
  },
}));
