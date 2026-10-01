import { AssistantError, OFFLINE, type Meta, type Reply, type ToolResult, type ToolCall } from "./protocol";

export type RequestInput = { text: string } | { results: ToolResult[] };
export type Transport = (input: RequestInput, onText: (text: string) => void, signal: AbortSignal) => Promise<Reply>;
export function createTransport(config: { endpoint: string; headers: () => Promise<Record<string, string>>; context: () => Record<string, unknown>; fetch?: typeof fetch }): Transport {
  let thread: Pick<Meta, "threadId" | "threadToken"> | undefined;
  return async (input, onText, signal) => {
    if (!config.endpoint) throw new AssistantError(503, OFFLINE);
    let response: Response;
    try { response = await (config.fetch ?? fetch)(config.endpoint, { method: "POST", headers: await config.headers(), body: JSON.stringify({ ...config.context(), ...thread, ...input }), signal }); }
    catch (error) { if (signal.aborted) throw error; throw new AssistantError(503, OFFLINE); }
    if (!response.ok) {
      const messages: Record<number, string> = { 401: "Please sign in again to continue.", 403: "Open a valid review link or start a new conversation for this account.", 429: "You've reached the assistant's limit for now. Please come back a little later.", 400: "This turn has finished. Please send a new message." };
      throw new AssistantError(response.status, messages[response.status] ?? OFFLINE);
    }
    if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new AssistantError(503, OFFLINE);
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = "", text = "", saved = false, meta: Meta | undefined;
    const tools: ToolCall[] = []; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.length; if (bytes > 300000) throw new AssistantError(503, OFFLINE);
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          const lines = frame.split("\n"), event = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
          const raw = lines.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (event === "error") throw new AssistantError(503, OFFLINE);
          if (event === "done") { saved = true; meta = data.meta as Meta; }
          if (event === "text") { if (typeof data.delta !== "string") throw new AssistantError(503, OFFLINE); text += data.delta; onText(text); }
          if (event === "notice") { if (typeof data.text !== "string") throw new AssistantError(503, OFFLINE); text += data.text; onText(text); }
          if (event === "tool_call") {
            if (saved || tools.length >= 6 || tools.some((t) => t.id === data.id) || typeof data.id !== "string" || typeof data.name !== "string" || !data.arguments || typeof data.arguments !== "object" || Array.isArray(data.arguments)) throw new AssistantError(503, OFFLINE);
            tools.push({ type: "tool_call", id: data.id, name: data.name, arguments: data.arguments });
          }
        }
      }
      if (!saved || !meta || !Array.isArray(meta.tools)) throw new AssistantError(503, OFFLINE);
      thread = { threadId: meta.threadId, threadToken: meta.threadToken };
      return { text, tools, meta };
    } catch (error) { if (signal.aborted || error instanceof AssistantError) throw error; throw new AssistantError(503, OFFLINE); }
    finally { await reader.cancel().catch(() => {}); }
  };
}
