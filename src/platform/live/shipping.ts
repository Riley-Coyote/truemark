import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShippingMethod } from '../types';
import type { Shipment } from '../shipping';
import type { Row } from './rows';
import { shipping as method } from './rows';
const nullable = (value: unknown) => value == null ? null : String(value);
export function shipment(row: Row): Shipment {
  return { id: String(row.id), orderId: String(row.order_id), provider: String(row.provider), status: row.status as Shipment['status'],
    providerOrderId: nullable(row.provider_order_id), carrier: nullable(row.carrier), service: nullable(row.service), tracking: nullable(row.tracking),
    cancelRequested: row.cancel_requested === true, attempts: Number(row.attempts), nextAttemptAt: String(row.next_attempt_at),
    lockedUntil: nullable(row.locked_until), lastError: nullable(row.last_error), pushedAt: nullable(row.pushed_at), shippedAt: nullable(row.shipped_at),
    deliveredAt: nullable(row.delivered_at), cancelledAt: nullable(row.cancelled_at), updatedAt: String(row.updated_at) };
}
export function createShipping(client: SupabaseClient,
  rows: (table: string, select?: string, filters?: Record<string, string>) => Promise<Row[]>,
  rpc: <T>(name: string, args: Record<string, unknown>) => Promise<T>, changed: () => void) {
  return {
    async get(orderId: string): Promise<Shipment | null> {
      const row = (await rows('shipments', '*', { order_id: orderId }))[0];
      return row ? shipment(row) : null;
    },
    async retry(orderId: string) { await rpc('retry_shipment', { order_id: orderId }); changed(); },
    async simulate(orderId: string, action: 'label' | 'delivered') {
      const { data, error } = await client.functions.invoke('shipping/simulate', { body: { orderId, action } });
      if (error) {
        const context = error.context;
        if (context instanceof Response) {
          const payload = await context.json().catch(() => null) as { message?: string } | null;
          if (payload?.message) throw new Error(payload.message);
        }
        throw error;
      }
      changed(); return data as { status: 'shipped' | 'delivered' };
    },
    methods: async () => (await rows('shipping_methods')).map(method),
    async saveMethod(value: ShippingMethod) {
      const saved = method(await rpc<Row>('upsert_shipping_method', { id: value.id, label: value.label, detail: value.detail, price: value.price, active: value.active !== false }));
      changed(); return saved;
    },
  };
}
