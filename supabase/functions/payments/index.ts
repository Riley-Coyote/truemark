import { createDb } from "../_shared/db.ts";
import { createHandler } from "./server.ts";
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };
const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
Deno.serve(createHandler({ db: createDb(url, serviceKey), url, serviceKey,
  functionsKey: Deno.env.get("FUNCTIONS_KEY") ?? "", simSecret: Deno.env.get("PAYMENTS_SIM_SECRET") ?? "",
  background: typeof EdgeRuntime !== "undefined" ? (task) => EdgeRuntime.waitUntil(task) : undefined,
}));
