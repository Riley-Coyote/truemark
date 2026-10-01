import { useState } from "react";
import { Button, EmptyState } from "../../app-kit";

export function ShopLoadFailure({ retry }: { retry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function tryAgain() {
    setBusy(true);
    try { await retry(); } finally { setBusy(false); }
  }
  return <main className="kit-main" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
    <EmptyState title="The shop couldn't load. Try again." action={
      <Button onClick={tryAgain} disabled={busy}>{busy ? "Loading…" : "Try again"}</Button>
    } />
  </main>;
}
