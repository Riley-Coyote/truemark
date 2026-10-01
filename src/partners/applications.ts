import { LIVE } from "../platform/mode";
import { live } from "../platform/live/runtime";
import { worldNow } from "../platform/storage";
import type { PartnerApplicationDraft } from "../platform/accounts";
export type { PartnerApplicationDraft } from "../platform/accounts";

/** A submission receipt; live application status is read separately under RLS. */
export type PartnerApplication = PartnerApplicationDraft & {
  submittedAt: string;
  status: "submitted";
  confirmationRequired?: boolean;
};

const LATENCY_MS = 360;
const submitLive = LIVE ? async (draft: PartnerApplicationDraft, password: string): Promise<PartnerApplication> => {
  const result = await live().auth.signUpPartner(draft, password);
  return { ...draft, submittedAt: worldNow(), status: "submitted", ...result };
} : null;

export function submitApplication(draft: PartnerApplicationDraft, password = ""): Promise<PartnerApplication> {
  if (submitLive) return submitLive(draft, password);
  return new Promise((resolve) =>
    window.setTimeout(() => resolve({ ...draft, submittedAt: worldNow(), status: "submitted" }), LATENCY_MS),
  );
}
