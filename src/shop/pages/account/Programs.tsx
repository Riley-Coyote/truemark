import { useRef, useState } from "react";
import { live } from "../../../platform/live/runtime";
import { useResource } from "../../../platform/store";
import { LIVE } from "../../../platform/mode";
import { money } from "../../../data";
import { Loading, PageHead, Problem } from "./parts";

export default function Programs() {
  return LIVE ? (
    <ConnectedAccountPrograms />
  ) : (
    <p className="tm-acct-muted">
      Rewards and memberships are available in the connected test workspace.
    </p>
  );
}
function ConnectedAccountPrograms() {
  const wallet = useResource(() => live().programs.myWallet()),
    ledger = useResource(() => live().programs.myLedger()),
    consent = useResource(() => live().programs.consent());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const lock = useRef(false);
  async function changeConsent(subscribed: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNote("");
    try {
      await live().programs.setConsent(subscribed);
      setNote(
        subscribed
          ? "Newsletter opt-in saved."
          : "Newsletter opt-out saved. Queued marketing messages are stopped.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Preference could not be saved.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="Research account"
        title="Rewards & membership"
        sub="Your point history, current benefits and newsletter preference."
      />
      {wallet.error ? (
        <Problem
          title="Your benefits could not be loaded."
          onRetry={wallet.reload}
        />
      ) : !wallet.data ? (
        <Loading label="Loading your benefits" rows={2} />
      ) : (
        <section className="tm-acct-block">
          <h2 className="tm-acct-label">Your benefits</h2>
          <dl className="tm-totals">
            <div className="tm-totals-row">
              <dt>Available points</dt>
              <dd>{wallet.data.available.toLocaleString()}</dd>
            </div>
            <div className="tm-totals-row">
              <dt>Credit value</dt>
              <dd>
                {money(
                  wallet.data.available /
                    wallet.data.settings.points_per_dollar,
                )}
              </dd>
            </div>
            <div className="tm-totals-row">
              <dt>Membership</dt>
              <dd>{wallet.data.tier?.name ?? "No active tier"}</dd>
            </div>
            <div className="tm-totals-row">
              <dt>Member benefit</dt>
              <dd>{wallet.data.tier?.discount ?? 0}%</dd>
            </div>
            <div className="tm-totals-row">
              <dt>Qualifying merchandise spend</dt>
              <dd>{money(wallet.data.spend)}</dd>
            </div>
          </dl>
          <p className="tm-acct-muted">
            {wallet.data.settings.rewards_enabled
              ? `Redeem from ${wallet.data.settings.min_points} points in whole USD increments, up to ${wallet.data.settings.max_percent}% of merchandise after the better of your membership benefit or promotion.`
              : "Reward earning and redemption are currently paused."}{" "}
            Shipping, insurance and tax do not earn points. Refunds reduce
            earned points and membership qualification.
          </p>
        </section>
      )}
      <section className="tm-acct-block">
        <h2 className="tm-acct-label">Newsletter preference</h2>
        {consent.error ? (
          <Problem
            title="Your preference could not be loaded."
            onRetry={consent.reload}
          />
        ) : consent.data ? (
          <>
            <label className="tm-check">
              <input
                type="checkbox"
                disabled={busy || consent.loading}
                checked={consent.data.subscribed}
                onChange={(e) => void changeConsent(e.target.checked)}
              />
              <span>
                Send me TrueMark research updates and offers by email. I can
                unsubscribe here at any time.
              </span>
            </label>
            <p className="tm-acct-muted">
              Test delivery is simulated; no marketing email is sent externally.
            </p>
          </>
        ) : (
          <Loading label="Loading newsletter preference" rows={1} />
        )}{" "}
        {error && <p role="alert">{error}</p>}
        {note && <p role="status">{note}</p>}
      </section>
      <section className="tm-acct-block">
        <h2 className="tm-acct-label">Point history</h2>
        {ledger.error ? (
          <Problem
            title="Point history could not be loaded."
            onRetry={ledger.reload}
          />
        ) : !ledger.data ? (
          <Loading label="Loading point history" rows={2} />
        ) : ledger.data.length ? (
          <ul>
            {[...ledger.data]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((l) => (
                <li
                  key={l.id}
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid var(--tm-line)",
                  }}
                >
                  <strong>
                    {l.points > 0 ? "+" : ""}
                    {l.points.toLocaleString()} points
                  </strong>{" "}
                  · {l.note}
                  <br />
                  <span className="tm-acct-muted">
                    {new Date(l.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="tm-acct-muted">No points recorded yet.</p>
        )}
      </section>
    </>
  );
}
