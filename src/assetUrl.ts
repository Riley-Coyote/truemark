/** Resolve a file from `public/` against Vite's configured deployment base. */
export function assetUrl(path: string): string {
  const relativePath = path.replace(/^\/+/, "");

  // A relative production base keeps GitHub Pages project sites portable. In
  // development, use the Vite root so BrowserRouter routes can still load the
  // same files when opened directly.
  if (import.meta.env.DEV && import.meta.env.BASE_URL === "./") {
    return `/${relativePath}`;
  }

  return `${import.meta.env.BASE_URL}${relativePath}`;
}
