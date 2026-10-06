import type { Artifact, PendingAction, Source, ToolOutput } from "./runtime";
import { activityFor } from "./runtime";
import type { createToolRuntime } from "./runtime";
import type { Transport, RequestInput } from "./client";
import type { ToolResult } from "./protocol";

export type TurnCallbacks = {
  text: (text: string, round: number) => void;
  artifact: (artifact: Artifact) => void;
  confirm: (action: PendingAction, signal: AbortSignal) => Promise<boolean>;
  status: (status: "loading" | "streaming" | "confirming") => void;
  /** Optional: what a tool is about to read, and the record its answer came from. */
  activity?: (label: string) => void;
  source?: (source: Source) => void;
};
/** No callable write is ever serialized or sent to the server. Only this loop can resolve proposals. */
export async function runTurn(text: string, transport: Transport, prepare: ReturnType<typeof createToolRuntime>, callbacks: TurnCallbacks, signal: AbortSignal) {
  let input: RequestInput = { text }; const handled = new Set<string>();
  for (let round = 0; round <= 6; round++) {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    callbacks.status("loading");
    const reply = await transport(input, (value) => { callbacks.status("streaming"); callbacks.text(value, round); }, signal);
    if (!reply.tools.length) return reply.text;
    if (round >= 6 || reply.tools.length > 6) throw new Error("The assistant reached its tool limit. Please send a new message.");
    const results: ToolResult[] = [];
    for (const tool of reply.tools) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      if (handled.has(tool.id)) throw new Error("This action was already handled. Please send a new message.");
      handled.add(tool.id);
      try {
        callbacks.activity?.(activityFor(tool));
        let output: ToolOutput = await prepare(tool, reply.meta.tools, reply.meta.persona);
        if (output.source) callbacks.source?.(output.source);
        if (output.artifact) callbacks.artifact(output.artifact);
        if (output.pending) {
          callbacks.status("confirming");
          const confirm = await callbacks.confirm(output.pending, signal);
          if (signal.aborted) { output.pending.cancel(); throw new DOMException("Cancelled", "AbortError"); }
          output = confirm ? await output.pending.confirm() : output.pending.cancel();
          if (output.artifact) callbacks.artifact(output.artifact);
        }
        const content = JSON.stringify(output.model);
        results.push({ role: "tool", tool_call_id: tool.id, content: content.length <= 14000 ? content : '{"message":"This result is too large. Narrow the query or request a smaller page."}' });
      } catch (error) {
        if (signal.aborted) throw error;
        // RPC exceptions are reduced at the store boundary; never send raw transport objects.
        results.push({ role: "tool", tool_call_id: tool.id, content: JSON.stringify({ error: error instanceof Error ? error.message.slice(0, 300) : "This action could not be completed." }) });
      }
    }
    input = { results };
  }
  return "";
}
