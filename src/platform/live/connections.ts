import type { Connection, ConnectionId, ConnectionMode } from "../connections";
import { CONNECTION_ORDER } from "../connections";
import type { Row } from "./rows";

const text = (value: unknown) => value == null ? null : String(value);

export function connection(row: Row): Connection {
  return {
    id: row.id as ConnectionId, mode: row.mode as ConnectionMode, provider: String(row.provider ?? ""),
    lastOkAt: text(row.last_ok_at), lastErrorAt: text(row.last_error_at), lastError: text(row.last_error),
    updatedAt: String(row.updated_at),
  };
}

/** Team members read the switches; only the owner changes one (enforced by set_connection_mode). */
export function createConnections(rows: (table: string) => Promise<Row[]>,
  rpc: <T>(name: string, args?: Record<string, unknown>) => Promise<T>, changed: () => void) {
  return {
    async list(): Promise<Connection[]> {
      const found = (await rows("connections")).map(connection);
      return CONNECTION_ORDER.map((id) => found.find((c) => c.id === id)).filter((c): c is Connection => Boolean(c));
    },
    async setMode(id: ConnectionId, mode: ConnectionMode, provider?: string): Promise<Connection> {
      const saved = connection(await rpc<Row>("set_connection_mode", { connection: id, mode, provider: provider ?? null }));
      changed(); return saved;
    },
  };
}
