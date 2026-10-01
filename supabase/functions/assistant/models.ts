import type { Persona } from "./prompts.ts";
export type Models = Record<Persona, string>;
export const DEFAULT_MODELS: Models = { visitor: "openai/gpt-6-luna", partner: "openai/gpt-6-luna", owner: "anthropic/claude-sonnet-5.5" };
export type ModelOption = { id: string; name: string; inputPrice: number | null; outputPrice: number | null };
export function modelCatalog(fetcher: typeof fetch = fetch, now = Date.now) {
  let cached: ModelOption[] | null = null, expires = 0, pending: Promise<ModelOption[]> | undefined;
  return async () => {
    if (cached && now() < expires) return cached;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("Model suggestions are unavailable. You can enter a model name.");
      const body = await response.json();
      if (!Array.isArray(body.data)) throw new Error("Model suggestions are unavailable. You can enter a model name.");
      const price = (value: unknown) => typeof value === "string" && value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) * 1_000_000 : null;
      cached = body.data.filter((m: { id?: unknown; supported_parameters?: string[] }) => typeof m.id === "string" && Array.isArray(m.supported_parameters) && m.supported_parameters.includes("tools"))
        .map((m: { id: string; name?: string; pricing?: { prompt?: string; completion?: string } }) => ({ id: m.id, name: m.name ?? m.id, inputPrice: price(m.pricing?.prompt), outputPrice: price(m.pricing?.completion) }))
        .sort((a: ModelOption, b: ModelOption) => a.id.localeCompare(b.id));
      expires = now() + 3_600_000; return cached!;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}
