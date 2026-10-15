/** Deployment root for links and provider attribution. No credentials, query or fragment. */
export function siteRoot(value: string): string {
  try {
    if (!value || value !== value.trim()) throw new Error();
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
      url.username || url.password || url.search || url.hash) throw new Error();
    return url.href.replace(/\/+$/, '') + '/';
  } catch {
    throw new Error('Message site configuration missing or invalid');
  }
}
