import type { Product } from "../data";
export type AssistantIdentity = { id: string; role: "owner" | "staff" | "buyer" | "partner" } | null;
export type AssistantProduct = Omit<Product, "description"> & { active: boolean; stock: number | null; description: string | null };
export type AssistantCapabilities = { updateProduct: boolean; productArgument?: string | null };

export type AssistantModels = Record<"visitor" | "partner" | "owner", string>;
export type AssistantSettingsInfo = {
  provider: "OpenRouter" | "OpenAI-compatible" | "Anthropic" | "Not connected";
  models: AssistantModels;
  suggestions: { id: string; name: string; inputPrice: number | null; outputPrice: number | null }[];
  catalogError: string | null;
  spend: { month: string; cost: number; unpricedMessages: number; messages: number; promptTokens: number; completionTokens: number };
};
