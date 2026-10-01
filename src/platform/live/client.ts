import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;
/** Independent from the review client, including the PKCE verifier and session. */
export function getClient(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_REVIEW_SUPABASE_URL;
    const publishableKey = import.meta.env.VITE_REVIEW_SUPABASE_ANON_KEY;
    if (!url || !publishableKey) throw new Error("The live platform needs its Supabase URL and publishable key.");
    client = createClient(url, publishableKey, { auth: {
      flowType: "pkce", detectSessionInUrl: true, persistSession: true, storageKey: "tm-live-auth",
    } });
  }
  return client;
}
