/** Lab transport talks only to the throwaway local SQL fixture on loopback. */
import {
  ConnectedMarketing,
  ConnectedPrograms,
} from "../../src/admin/intelligence/ConnectedPrograms";
import { createPrograms } from "../../src/platform/live/programs";
import { STORE_CHANGE } from "../../src/platform/storage";
async function call<T>(path: string, args: Record<string, unknown> = {}) {
  const r = await fetch(`http://127.0.0.1:5343${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await r.json();
  if (!r.ok)
    throw Error(
      body.error ??
        "Start the synthetic program backend to use this lab scene.",
    );
  return body.data as T;
}
const api = createPrograms(
  (table, _select, filters) => call(`/rows/${table}`, { filters }),
  (name, args) => call(`/rpc/${name}`, args),
  () => window.dispatchEvent(new CustomEvent(STORE_CHANGE)),
);
export function MarketingLab() {
  return (
    <>
      <p className="bi-warning">
        Isolated test scene · synthetic local SQL backend · no hosted calls or
        external delivery.
      </p>
      <ConnectedMarketing api={api} />
    </>
  );
}
export function ProgramsLab() {
  return (
    <>
      <p className="bi-warning">
        Isolated test scene · synthetic local SQL backend · no hosted calls or
        external delivery.
      </p>
      <ConnectedPrograms api={api} fixtureOwner />
    </>
  );
}
