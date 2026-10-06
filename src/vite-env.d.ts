/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM?: "preview" | "live";
  readonly VITE_LAUNCH?: string;
  readonly VITE_ROUTER?: "path" | "hash";
  /** The review layer's Supabase project URL (both values set = live, shared notes). */
  readonly VITE_REVIEW_SUPABASE_URL?: string;
  /** The Supabase anon (public) key for that project. */
  readonly VITE_REVIEW_SUPABASE_ANON_KEY?: string;
  /** Which review the notes belong to; defaults to "truemark". */
  readonly VITE_REVIEW_PROJECT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
