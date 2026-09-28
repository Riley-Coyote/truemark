/**
 * Which storage the review layer uses, decided when the site is built: with both Supabase
 * values set, notes are shared live through Supabase; otherwise they stay on this device.
 * Kept tiny so the review bar can read it without loading the layer.
 */
const url = import.meta.env.VITE_REVIEW_SUPABASE_URL?.trim() ?? "";
const anonKey = import.meta.env.VITE_REVIEW_SUPABASE_ANON_KEY?.trim() ?? "";

export const REVIEW_MODE: "supabase" | "local" = url && anonKey ? "supabase" : "local";
export const REVIEW_PROJECT = import.meta.env.VITE_REVIEW_PROJECT?.trim() || "truemark";
export const SUPABASE = { url, anonKey };
