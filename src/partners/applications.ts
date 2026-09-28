/**
 * Partner applications. The store has no endpoint for them yet
 * (store.partners.apply is the one the backend needs), so a submitted
 * application lives only in the page that sent it. The call is async, like
 * every store call, so the form already handles waiting and failure.
 */
import { worldNow } from "../platform/storage";

export type PartnerApplicationDraft = {
  name: string;
  email: string;
  channel: string;
  otherChannels: string[];
  audience: string;
  feature: string;
  /** Ids from `commitments` in program.ts; all four are required. */
  commitments: string[];
};

export type PartnerApplication = PartnerApplicationDraft & {
  submittedAt: string;
  status: "submitted";
};

const LATENCY_MS = 360;

export function submitApplication(draft: PartnerApplicationDraft): Promise<PartnerApplication> {
  return new Promise((resolve) =>
    window.setTimeout(() => resolve({ ...draft, submittedAt: worldNow(), status: "submitted" }), LATENCY_MS),
  );
}
