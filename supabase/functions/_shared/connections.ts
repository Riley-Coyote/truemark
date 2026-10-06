import type { Db } from "./db.ts";

export type ConnectionId = "payments" | "email" | "sms" | "shipping";
export type Mode = "off" | "simulated" | "live";
export type Connection = { id: ConnectionId; mode: Mode; provider: string };

/** The current switch for a service. A missing row reads as off, never as live. */
export async function readConnection(db: Db, id: ConnectionId): Promise<Connection> {
  const row = await db.one<Connection>(`connections?id=eq.${id}&select=id,mode,provider&limit=1`);
  return row ?? { id, mode: "off", provider: "" };
}

/** Record one call's outcome for the Connections panel. Reporting never breaks the caller. */
export async function reportStatus(db: Db, id: ConnectionId, ok: boolean, error?: string): Promise<void> {
  try {
    await db.rpc("system_connection_status", { connection: id, ok, error: ok ? null : (error ?? "Unknown error").slice(0, 500) });
  } catch {
    /* The panel shows the last status it has. */
  }
}
