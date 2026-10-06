import { createDb } from "../_shared/db.ts";
import { createHandler } from "./server.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
Deno.serve(createHandler({ db: createDb(url, serviceKey), url, serviceKey,
  functionsKey: Deno.env.get("FUNCTIONS_KEY") ?? "", fetch,
  now: Date.now, random: (length) => crypto.getRandomValues(new Uint8Array(length)), uuid: () => crypto.randomUUID(),
}));
