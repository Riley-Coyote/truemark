import { REFUSAL, SYSTEM_PROMPTS, type Persona } from "./prompts.ts";
import { toolsFor } from "./tools.ts";
import { mustRefuse } from "./refusal.ts";
import { ProviderError, ZERO_USAGE, type Accounting, type Message, type Provider } from "./providers.ts";
import type { ModelOption, Models } from "./models.ts";
export type { Message } from "./providers.ts";
export type Identity = { id: string; role: string; hasPartner: boolean };
export type Thread = { id: string; user_id: string | null; persona: Persona; mode: string; subject_hash: string; token_hash: string; revision: number; tool_rounds: number };
export type Spend = { month: string; cost: number; unpricedMessages: number; messages: number; promptTokens: number; completionTokens: number };
export interface Repository {
  identify(token: string): Promise<Identity | null>;
  review(key: string): Promise<boolean>;
  usage(subject: string, kind: string): Promise<{ allowed: boolean; retryAfter: number }>;
  thread(id: string): Promise<Thread | null>;
  messages(id: string): Promise<Message[]>;
  reserve(thread: Thread, messages: Message[], round: number): Promise<number>;
  finish(id: string, revision: number, message: Message | null, accounting?: Accounting): Promise<boolean>;
  models(): Promise<Models>;
  spend(): Promise<Spend>;
}
export type Dependencies = { repository: Repository; provider: Provider | null; catalog: () => Promise<ModelOption[]>; hash: (text: string) => Promise<string> };
const offline = "The assistant is unavailable right now";
const limitText = "You've reached the assistant's limit for now. Please come back a little later.";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
const json = (status: number, data: string | object) => new Response(JSON.stringify(typeof data === "string" ? { message: data } : data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const streamHeaders = { ...cors, "Content-Type": "text/event-stream", "X-Accel-Buffering": "no" };
const notice = (status: number, kind: string, text: string) => new Response(sse("notice", { kind, text }) + sse("done", { usage: ZERO_USAGE, cost: 0 }), { status, headers: streamHeaders });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isPersona = (p: unknown): p is Persona => p === "visitor" || p === "owner" || p === "partner";
export function selectPersona(identity: Identity | null): Persona {
  if (identity?.role === "owner" || identity?.role === "staff") return "owner";
  return identity?.role === "partner" && identity.hasPartner ? "partner" : "visitor";
}
function userMessages(body: Record<string, unknown>, history: Message[], round: number): { messages: Message[]; round: number } {
  const previous = history.at(-1);
  const pending = previous?.role === "assistant" ? previous.tool_calls ?? [] : [];
  if (typeof body.text === "string" && body.text.trim() && body.text.length <= 6000 && !body.results) {
    return { messages: [...pending.map((t): Message => ({ role: "tool", tool_call_id: t.id, content: '{"cancelled":true}' })), { role: "user", content: body.text.trim() }], round: 0 };
  }
  if (!Array.isArray(body.results) || body.results.length !== pending.length || !pending.length || round >= 6) throw new Error("Invalid continuation");
  const seen = new Set<string>();
  const messages = body.results.map((raw): Message => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid result");
    const r = raw as Record<string, unknown>;
    if (typeof r.tool_call_id !== "string" || seen.has(r.tool_call_id) || !pending.some((p) => p.id === r.tool_call_id) || typeof r.content !== "string" || r.content.length > 14000) throw new Error("Invalid result");
    seen.add(r.tool_call_id);
    return { role: "tool", tool_call_id: r.tool_call_id, content: r.content };
  });
  return { messages, round: round + 1 };
}
function validateCall(name: string, args: Record<string, unknown>, tools: ReturnType<typeof toolsFor>) {
  const schema = tools.find((t) => t.name === name)?.parameters;
  if (!schema || schema.required.some((key) => !(key in args))) throw new Error("Unsupported tool");
  for (const [key, value] of Object.entries(args)) {
    const rule = schema.properties[key];
    if (!rule || (rule.type === "integer" ? !Number.isInteger(value) : typeof value !== rule.type) ||
      (rule.enum && !rule.enum.includes(String(value))) ||
      (typeof value === "number" && (!Number.isFinite(value) || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity))) ||
      (typeof value === "string" && (!value.trim() || value.length > (rule.maxLength ?? 6000)))) throw new Error("Invalid tool fields");
  }
}

export function createHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json(405, "Please use the assistant panel.");
    let thread: Thread | undefined; let revision: number | undefined;
    try {
      if (Number(request.headers.get("content-length")) > 100_000) return json(413, "Please send a shorter message.");
      const raw = await request.text();
      if (raw.length > 100_000) return json(413, "Please send a shorter message.");
      const body = JSON.parse(raw) as Record<string, unknown>;
      if (!body || typeof body !== "object" || (body.mode !== "preview" && body.mode !== "live")) return json(400, "Please reopen the assistant.");
      let identity: Identity | null = null; let persona: Persona; let subject: string; let kind: string;
      if (body.mode === "preview") {
        if (typeof body.reviewKey !== "string" || body.reviewKey.length > 512 || !await deps.repository.review(body.reviewKey)) return json(403, "Open this preview with a valid review link to use the assistant.");
        if (!isPersona(body.persona)) return json(400, "Please choose an assistant.");
        persona = body.persona; subject = await deps.hash(`review:${body.reviewKey}`); kind = "preview";
      } else {
        const authorization = request.headers.get("authorization");
        if (authorization) {
          const token = authorization.match(/^Bearer (.+)$/i)?.[1];
          // The gateway's JWT toggle is not an authorization boundary. Verify every token here.
          if (!token || !(identity = await deps.repository.identify(token))) return json(401, "Please sign in again to continue.");
        }
        persona = selectPersona(identity);
        const ip = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
        subject = await deps.hash(identity ? `user:${identity.id}` : `ip:${ip}`);
        kind = identity?.role === "owner" || identity?.role === "staff" ? "owner" : identity?.role === "partner" && identity.hasPartner ? "partner" : identity ? "buyer" : "anonymous";
      }
      const provider = deps.provider;
      if (body.action === "gate") return json(provider ? 200 : 503, { persona, allowed: true, ...(!provider ? { message: offline } : {}) });
      const testing = body.action === "test";
      if (body.action === "settings" || testing) {
        if (body.mode !== "live" || identity?.role !== "owner") return json(403, "Only the owner can manage assistant settings.");
        if (body.action === "settings") {
          const [models, spend, catalog] = await Promise.all([deps.repository.models(), deps.repository.spend(), deps.catalog().then((models) => ({ models, error: null })).catch(() => ({ models: [], error: "Model suggestions are unavailable. You can enter a model name." }))]);
          return json(provider ? 200 : 503, { provider: provider?.name ?? "Not connected", models, spend, suggestions: catalog.models, catalogError: catalog.error });
        }
        if (!isPersona(body.persona)) return json(400, "Choose a persona to test.");
        persona = body.persona;
      } else if (body.action) return json(400, "Unknown assistant action.");
      if (!provider) return testing ? json(503, offline) : notice(503, "offline", offline);
      if (body.history || body.messages || body.system || body.model || body.tools) return json(400, "Please send messages through the assistant panel.");
      const role = body.mode === "preview" ? persona : identity?.role ?? "anonymous";
      const tools = testing ? [] : toolsFor(persona, role);
      const token = typeof body.threadToken === "string" ? body.threadToken : crypto.randomUUID();
      if (!uuid.test(token)) return json(400, "Please start a new conversation.");
      const tokenHash = await deps.hash(`thread:${token}`);
      let history: Message[] = [];
      if (body.threadId && !testing) {
        if (typeof body.threadId !== "string" || !uuid.test(body.threadId)) return json(400, "Please start a new conversation.");
        const found = await deps.repository.thread(body.threadId);
        if (!found || found.persona !== persona || found.mode !== body.mode || found.token_hash !== tokenHash || found.subject_hash !== subject || found.user_id !== (identity?.id ?? null)) return json(403, "Please start a new conversation for this account.");
        thread = found; history = await deps.repository.messages(thread.id);
      } else thread = { id: crypto.randomUUID(), user_id: identity?.id ?? null, persona, mode: body.mode, subject_hash: subject, token_hash: tokenHash, revision: 0, tool_rounds: 0 };
      let next: ReturnType<typeof userMessages>;
      try { next = userMessages(testing ? { text: "Reply with OK." } : body, history, thread.tool_rounds); } catch { return json(400, "This turn has finished. Please send a new message."); }
      const quota = await deps.repository.usage(subject, kind);
      if (!quota.allowed) {
        const response = testing ? json(429, limitText) : notice(429, "limit", limitText);
        response.headers.set("Retry-After", String(quota.retryAfter)); return response;
      }
      revision = await deps.repository.reserve(thread, next.messages, next.round);
      const meta = { threadId: thread.id, threadToken: token, persona, tools };
      if (!testing && persona !== "owner" && typeof body.text === "string" && mustRefuse(body.text)) {
        const accounting: Accounting = { usage: ZERO_USAGE, cost: 0, notice: "refusal" };
        if (!await deps.repository.finish(thread.id, revision, { role: "assistant", content: REFUSAL }, accounting)) throw new Error("Conversation changed");
        return new Response(sse("notice", { kind: "refusal", text: REFUSAL }) + sse("done", { ...accounting, meta }), { headers: streamHeaders });
      }
      const model = (await deps.repository.models())[persona];
      const context = [...history, ...next.messages].slice(-24);
      while (context.length > 1 && context[0].role !== "user") context.shift();
      const id = thread.id, reserved = revision, started = Date.now();
      const abort = new AbortController();
      const signal = AbortSignal.any([request.signal, abort.signal, AbortSignal.timeout(90_000)]);
      async function complete(send: (event: string, data: unknown) => void) {
        const message: Message = { role: "assistant", content: "" };
        const calls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];
        let accounting: Accounting | undefined;
        try {
          for await (const event of provider!.stream({ model, max_tokens: testing ? 32 : persona === "visitor" ? 700 : 1600,
            messages: [{ role: "system", content: testing ? "Reply with OK to confirm this connection. Do not call tools." : SYSTEM_PROMPTS[persona] }, ...context],
            tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })), tool_choice: testing || next.round >= 6 ? "none" : "auto" }, signal)) {
            if (accounting) throw new Error("Invalid stream after completion");
            if (event.event === "text") { message.content += event.data.delta; send("text", event.data); }
            if (event.event === "tool_call") {
              if (testing || next.round >= 6 || calls.length >= 6 || calls.some((c) => c.id === event.data.id)) throw new Error("Unsupported tool");
              calls.push(event.data);
            }
            if (event.event === "done") accounting = { ...event.data, provider: provider!.name, model };
            if (JSON.stringify(message).length + JSON.stringify(calls).length > 60000) throw new Error("Response too large");
          }
          if (!accounting || (!message.content && !calls.length)) throw new Error("Incomplete response");
          for (const call of calls) validateCall(call.name, call.arguments, tools);
          if (calls.length) message.tool_calls = calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.arguments) } }));
          if (signal.aborted || !await deps.repository.finish(id, reserved, message, accounting)) throw new Error("Conversation changed");
          // Complete arguments, server validation and persistence precede every tool event.
          for (const call of calls) send("tool_call", call);
          send("done", { usage: accounting.usage, cost: accounting.cost, meta });
          return { ok: true, latencyMs: Date.now() - started, model };
        } catch (error) {
          // Even an interrupted or rejected answer may have incurred a charge.
          // Record reported accounting, or an explicitly unpriced attempt.
          await deps.repository.finish(id, reserved, { role: "assistant", content: message.content },
            { usage: null, cost: null, provider: provider!.name, model, ...accounting, notice: "error" }).catch(() => {});
          throw error;
        }
      }
      if (testing) {
        try { return json(200, await complete(() => {})); }
        catch (error) { return json(503, error instanceof ProviderError ? error.message : offline); }
      }
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));
          try { await complete(send); }
          catch { try { send("error", { message: offline }); } catch { /* Client closed. */ } }
          finally { try { controller.close(); } catch { /* Client closed. */ } }
        },
        async cancel() { abort.abort(); },
      });
      return new Response(stream, { headers: streamHeaders });
    } catch {
      if (thread && revision) await deps.repository.finish(thread.id, revision, null).catch(() => {});
      return json(503, offline);
    }
  };
}
