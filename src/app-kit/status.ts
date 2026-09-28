/**
 * One mapping from every platform status to a tone. The tone only colours a
 * status dot; chip text stays neutral so colour remains a signal, not a fill.
 *
 * signal  — the good end of a journey: released, paid, delivered, approved
 *           (payment "captured" is paid; a "verified" buyer is the signal state).
 * pending — waiting on someone: pending, testing, quarantine, submitted.
 * danger  — stopped: rejected, failed, declined, cancelled (and a suspended buyer).
 * neutral — everything else, drawn in glow-3.
 */
export type Tone = "signal" | "pending" | "danger" | "neutral";

const TONES: Record<string, Tone> = {
  // Orders, payments, lots, applications, referrals, payouts, buyers.
  released: "signal",
  paid: "signal",
  delivered: "signal",
  approved: "signal",
  captured: "signal",
  verified: "signal",

  pending: "pending",
  testing: "pending",
  quarantine: "pending",
  submitted: "pending",

  rejected: "danger",
  failed: "danger",
  declined: "danger",
  cancelled: "danger",
  suspended: "danger",
};

export const toneFor = (status: string): Tone => TONES[status] ?? "neutral";

/** Human label for a status value: "quarantine" → "Quarantine". */
export const statusLabel = (status: string): string => status.charAt(0).toUpperCase() + status.slice(1);
