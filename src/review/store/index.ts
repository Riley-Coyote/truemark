/**
 * One store for the whole layer, chosen when the site is built (see ../mode.ts). The
 * Supabase adapter is loaded only when it is the one in use.
 */
import { REVIEW_MODE, REVIEW_PROJECT, SUPABASE } from "../mode";
import type { ReviewStore } from "../types";
import { createLocalStore } from "./local";

let store: Promise<ReviewStore> | null = null;

export function getStore(): Promise<ReviewStore> {
  store ??=
    REVIEW_MODE === "supabase"
      ? import("./supabase").then(({ createSupabaseStore }) =>
          createSupabaseStore(SUPABASE.url, SUPABASE.anonKey, REVIEW_PROJECT),
        )
      : Promise.resolve(createLocalStore(REVIEW_PROJECT));
  return store;
}
