/** Provider credentials exist only inside the selected server transport's closure. */
export type Message = { role: "system" | "user" | "assistant" | "tool"; content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[]; tool_call_id?: string };
export type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };
export type Accounting = { usage: Usage | null; cost: number | null; provider?: string; model?: string; notice?: "refusal" | "error" };
export type ModelRequest = { model: string; messages: Message[]; max_tokens: number;
  tools: { type: "function"; function: { name: string; description: string; parameters: unknown } }[]; tool_choice: "auto" | "none" };
export type ModelEvent = { event: "text"; data: { delta: string } } |
  { event: "tool_call"; data: { id: string; name: string; arguments: Record<string, unknown> } } |
  { event: "done"; data: Accounting };
export type Provider = { name: "OpenRouter" | "OpenAI-compatible" | "Anthropic";
  stream: (body: ModelRequest, signal: AbortSignal) => AsyncGenerator<ModelEvent> };
export const ZERO_USAGE: Usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

/** Incremental SSE framing; provider frames are never forwarded to the browser. */
export class Events {
  private buffer = "";
  push(chunk: string) {
    this.buffer += chunk.replace(/\r/g, "");
    if (this.buffer.length > 100_000) throw new Error("Stream too large");
    const events: { event: string; data: string }[] = [];
    let end: number;
    while ((end = this.buffer.indexOf("\n\n")) >= 0) {
      const lines = this.buffer.slice(0, end).split("\n"); this.buffer = this.buffer.slice(end + 2);
      const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
      if (data) events.push({ event: lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "message", data });
    }
    return events;
  }
}
export class ProviderError extends Error {}
export function providerError(status: number) {
  // Never echo arbitrary upstream bodies: some endpoints include request headers in errors.
  return new ProviderError(status === 401 || status === 403 ? "The provider rejected its credentials. Check the server connection." :
    status === 402 ? "The provider account has no available credit." : status === 400 || status === 404 || status === 422 ?
    "The provider could not use this model. Check the model name and tool support." : status === 429 ?
    "The provider is busy or its usage limit has been reached. Try again later." : "The provider is unavailable right now. Try again later.");
}
async function* frames(response: Response) {
  if (!response.ok) { await response.body?.cancel(); throw providerError(response.status); }
  if (!response.body) throw new ProviderError("The provider returned an empty response.");
  const reader = response.body.getReader(), decoder = new TextDecoder(), events = new Events(); let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.length; if (bytes > 250_000) throw new ProviderError("The provider response was too large.");
      for (const frame of events.push(decoder.decode(value, { stream: true }))) yield frame;
    }
  } finally { await reader.cancel().catch(() => {}); }
}
const count = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
function usage(raw: Record<string, unknown> | undefined): Usage | null {
  if (!raw) return null;
  const input = count(raw.prompt_tokens), output = count(raw.completion_tokens);
  return input === null || output === null ? null : { prompt_tokens: input, completion_tokens: output, total_tokens: count(raw.total_tokens) ?? input + output };
}
function tool(id: string, name: string, args: string): ModelEvent {
  const parsed = JSON.parse(args || "{}");
  if (!id || id.length > 200 || !name || name.length > 100 || !parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ProviderError("The provider returned an invalid tool call.");
  return { event: "tool_call", data: { id, name, arguments: parsed } };
}

export async function* openAIStream(response: Response): AsyncGenerator<ModelEvent> {
  const calls = new Map<number, { id: string; name: string; arguments: string }>();
  let finished = false, closed = false; let accounting: Accounting = { usage: null, cost: null };
  for await (const frame of frames(response)) {
    if (frame.data === "[DONE]") { closed = true; continue; }
    if (closed) throw new ProviderError("The provider returned an invalid stream.");
    const chunk = JSON.parse(frame.data);
    if (chunk.error) throw providerError(Number(chunk.error.code) || 503);
    if (chunk.usage) accounting = { usage: usage(chunk.usage), cost: typeof chunk.usage.cost === "number" && Number.isFinite(chunk.usage.cost) && chunk.usage.cost >= 0 ? chunk.usage.cost : null };
    for (const choice of chunk.choices ?? []) {
      if (choice.index !== 0) continue;
      const delta = choice.delta ?? {};
      if (finished && (delta.content || delta.tool_calls?.length)) throw new ProviderError("The provider returned an invalid stream.");
      if (typeof delta.content === "string" && delta.content) yield { event: "text", data: { delta: delta.content } };
      for (const part of delta.tool_calls ?? []) {
        if (!Number.isInteger(part.index) || part.index < 0 || part.index >= 6) throw new ProviderError("The provider returned too many tool calls.");
        const c = calls.get(part.index) ?? { id: "", name: "", arguments: "" };
        // OpenAI-compatible providers may split IDs, names and JSON across frames.
        c.id += part.id ?? ""; c.name += part.function?.name ?? ""; c.arguments += part.function?.arguments ?? "";
        if (c.arguments.length > 60000) throw new ProviderError("The provider tool call was too large.");
        calls.set(part.index, c);
      }
      if (choice.finish_reason) {
        if (!["stop", "tool_calls"].includes(choice.finish_reason)) throw new ProviderError("The model did not finish its answer. Try a shorter request.");
        finished = true;
      }
    }
  }
  if (!finished || !closed) throw new ProviderError("The provider stream ended early. Please try again.");
  for (const c of calls.values()) yield tool(c.id, c.name, c.arguments);
  yield { event: "done", data: accounting };
}

export function anthropicRequest(body: ModelRequest) {
  const messages: { role: "user" | "assistant"; content: unknown[] }[] = [];
  for (const message of body.messages) {
    if (message.role === "system") continue;
    const role = message.role === "assistant" ? "assistant" : "user";
    const content: unknown[] = message.role === "tool" ? [{ type: "tool_result", tool_use_id: message.tool_call_id, content: message.content ?? "" }] : [
      ...(message.content ? [{ type: "text", text: message.content }] : []),
      ...(message.tool_calls ?? []).map((call) => ({ type: "tool_use", id: call.id, name: call.function.name, input: JSON.parse(call.function.arguments) })),
    ];
    const previous = messages.at(-1);
    if (previous?.role === role) previous.content.push(...content); else messages.push({ role, content });
  }
  return { model: body.model, max_tokens: body.max_tokens, stream: true,
    system: body.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n"), messages,
    ...(body.tools.length ? { tools: body.tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })),
      tool_choice: body.tool_choice === "none" ? { type: "none" } : { type: "auto", disable_parallel_tool_use: true } } : {}),
  };
}
export async function* anthropicStream(response: Response): AsyncGenerator<ModelEvent> {
  const calls = new Map<number, { id: string; name: string; arguments: string; input: Record<string, unknown>; complete: boolean }>();
  let stopped = false, input: number | null = null, output: number | null = null, stopReason: string | null = null;
  for await (const frame of frames(response)) {
    const chunk = JSON.parse(frame.data);
    if (chunk.type === "error") throw providerError(chunk.error?.type === "rate_limit_error" ? 429 : 503);
    if (stopped) throw new ProviderError("The provider returned an invalid stream.");
    if (chunk.type === "message_start") { input = count(chunk.message?.usage?.input_tokens); output = count(chunk.message?.usage?.output_tokens); }
    if (chunk.type === "content_block_start") {
      if (chunk.content_block.type === "tool_use") {
        if (calls.size >= 6 || calls.has(chunk.index)) throw new ProviderError("The provider returned invalid tool calls.");
        calls.set(chunk.index, { id: chunk.content_block.id, name: chunk.content_block.name, arguments: "", input: chunk.content_block.input ?? {}, complete: false });
      } else if (chunk.content_block.type === "text" && chunk.content_block.text) yield { event: "text", data: { delta: chunk.content_block.text } };
    }
    if (chunk.type === "content_block_delta") {
      if (chunk.delta.type === "text_delta") yield { event: "text", data: { delta: chunk.delta.text } };
      if (chunk.delta.type === "input_json_delta") {
        const call = calls.get(chunk.index); if (!call || call.complete) throw new ProviderError("The provider returned an invalid tool call.");
        call.arguments += chunk.delta.partial_json;
      }
    }
    if (chunk.type === "content_block_stop" && calls.has(chunk.index)) calls.get(chunk.index)!.complete = true;
    if (chunk.type === "message_delta") { output = count(chunk.usage?.output_tokens) ?? output; stopReason = chunk.delta?.stop_reason ?? stopReason; }
    if (chunk.type === "message_stop") stopped = true;
  }
  if (!stopped || (stopReason && !["end_turn", "tool_use", "stop_sequence"].includes(stopReason))) throw new ProviderError("The provider stream ended early. Please try again.");
  for (const c of calls.values()) { if (!c.complete) throw new ProviderError("The provider returned an unfinished tool call."); yield tool(c.id, c.name, c.arguments || JSON.stringify(c.input)); }
  yield { event: "done", data: { usage: input === null || output === null ? null : { prompt_tokens: input, completion_tokens: output, total_tokens: input + output }, cost: null } };
}

export function resolveProvider(secret: (name: string) => string | undefined, fetcher: typeof fetch = fetch): Provider | null {
  const router = secret("OPENROUTER_API_KEY");
  if (router) return compatible("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", router);
  const compatibleKey = secret("ASSISTANT_API_KEY"), base = secret("ASSISTANT_BASE_URL");
  if (compatibleKey && base) {
    try { const parsed = new URL(base); if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null; }
    catch { return null; }
    return compatible("OpenAI-compatible", `${base.replace(/\/+$/, "").replace(/\/chat\/completions$/, "")}/chat/completions`, compatibleKey);
  }
  const native = secret("ANTHROPIC_API_KEY");
  if (native) return { name: "Anthropic", async *stream(body, signal) {
    yield* anthropicStream(await fetcher("https://api.anthropic.com/v1/messages", { method: "POST", signal,
      headers: { "Content-Type": "application/json", "x-api-key": native, "anthropic-version": "2023-06-01" }, body: JSON.stringify(anthropicRequest(body)) }));
  } };
  return null;
  function compatible(name: "OpenRouter" | "OpenAI-compatible", endpoint: string, credential: string): Provider {
    return { name, async *stream(body, signal) {
      const { tools, tool_choice, ...request } = body;
      yield* openAIStream(await fetcher(endpoint, { method: "POST", signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}`,
          ...(name === "OpenRouter" ? { "HTTP-Referer": "https://riley-coyote.github.io/truemark/", "X-Title": "TrueMark" } : {}) },
        body: JSON.stringify({ ...request, ...(tools.length ? { tools, tool_choice } : {}), stream: true, ...(name === "OpenRouter" ? { usage: { include: true } } : { stream_options: { include_usage: true } }) }) }));
    } };
  }
}
