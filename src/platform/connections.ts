/**
 * The outside services the platform reaches (payments, email, text messages,
 * shipping). Each is off, simulated or live. Simulated runs every step of the
 * real flow against a stand-in provider, so nothing downstream changes when the
 * client's accounts arrive: the owner names the provider and switches it live.
 */
export type ConnectionId = "payments" | "email" | "sms" | "shipping";
export type ConnectionMode = "off" | "simulated" | "live";

export type Connection = {
  id: ConnectionId;
  mode: ConnectionMode;
  /** The real service used in live mode, e.g. "shipstation". Empty until chosen. */
  provider: string;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export const CONNECTION_ORDER: ConnectionId[] = ["payments", "email", "sms", "shipping"];

export const CONNECTION_LABELS: Record<ConnectionId, string> = {
  payments: "Payments",
  email: "Email",
  sms: "Text messages",
  shipping: "Shipping",
};

export const MODE_LABELS: Record<ConnectionMode, string> = {
  off: "Off",
  simulated: "Simulated",
  live: "Live",
};
