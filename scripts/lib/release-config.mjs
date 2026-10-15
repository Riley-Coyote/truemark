/** Validate public build inputs without echoing credentials on failure. */
export function validateLiveConfig(env) {
  let url;
  try { url = new URL(env.VITE_REVIEW_SUPABASE_URL); } catch { throw new Error('Set the public Supabase project URL before building live.'); }
  if (url.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')) {
    throw new Error('The Supabase URL must use HTTPS (or local HTTP for testing).');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use only the Supabase project origin.');
  const key = env.VITE_REVIEW_SUPABASE_ANON_KEY ?? '';
  let anon = false;
  try { anon = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* Modern publishable key below. */ }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !anon && !(url.hostname === 'fixture.test' && key === 'fixture-anon')) {
    throw new Error('Set a public Supabase publishable/anon key; server keys must never enter a browser build.');
  }
  if (env.VITE_SITE_ORIGIN) {
    let site;
    try { site = new URL(env.VITE_SITE_ORIGIN); } catch { throw new Error('VITE_SITE_ORIGIN must be a valid HTTPS origin.'); }
    if (site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.username || site.password) {
      throw new Error('VITE_SITE_ORIGIN must be an HTTPS origin without a path, query or credentials.');
    }
    env.VITE_SITE_ORIGIN = site.origin;
  }
  if (env.VITE_INDEX === '1' && (!env.VITE_SITE_ORIGIN || env.VITE_SITE_ORIGIN === 'https://riley-coyote.github.io' || url.hostname === 'fixture.test')) {
    throw new Error('Indexing requires the confirmed production origin and real public Supabase configuration.');
  }
}
