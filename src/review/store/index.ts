/**
 * The layer's two stores. Notes stay on this device unless the build can share (./mode.ts)
 * and this browser holds the review key from Riley's link; the Supabase client is loaded only
 * then.
 */
import { channelFor } from "../key";
import { REVIEW_PROJECT, SUPABASE, SUPABASE_CONFIGURED } from "../mode";
import type { ReviewStore } from "../types";
import { createLocalStore } from "./local";
import type { ChannelLike, ClientLike } from "./supabase";

let local: ReviewStore | null = null;

export function localStore(): ReviewStore {
  local ??= createLocalStore(REVIEW_PROJECT);
  return local;
}

/** The store shared with everyone holding `key`; null when this build cannot share. */
export async function sharedStore(key: string): Promise<ReviewStore | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const [{ createClient }, { createSupabaseStore }, channel] = await Promise.all([
    import("@supabase/supabase-js"),
    import("./supabase"),
    channelFor(key),
  ]);
  const supabase = createClient(SUPABASE.url, SUPABASE.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The adapter asks only for rpc and a channel; the real client's richer types meet it here.
  const client: ClientLike = {
    rpc: (fn, args) => supabase.rpc(fn, args),
    channel: (name, options) => supabase.channel(name, options) as unknown as ChannelLike,
    removeChannel: (ch) => supabase.removeChannel(ch as unknown as Parameters<typeof supabase.removeChannel>[0]),
  };
  return createSupabaseStore(client, key, channel);
}
