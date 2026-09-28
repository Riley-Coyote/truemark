/**
 * Whether this build can share notes at all: both Supabase values set when the site was
 * built. Sharing also needs the review key from Riley's link (./key.ts); without it, notes
 * stay on this device. Kept tiny so the review bar can read it without loading the layer.
 */
const url = import.meta.env.VITE_REVIEW_SUPABASE_URL?.trim() ?? "";
const anonKey = import.meta.env.VITE_REVIEW_SUPABASE_ANON_KEY?.trim() ?? "";

export const SUPABASE_CONFIGURED = Boolean(url && anonKey);
/** The review local notes belong to; shared notes take theirs from the key, on the server. */
export const REVIEW_PROJECT = import.meta.env.VITE_REVIEW_PROJECT?.trim() || "truemark";
export const SUPABASE = { url, anonKey };
