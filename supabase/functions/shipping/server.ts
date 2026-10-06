import type { Db } from '../_shared/db.ts';
import { DbError, presentable } from '../_shared/db.ts';
import { body, isUuid, json, message, preflight, route } from '../_shared/http.ts';
import { identify, isTeam } from '../_shared/identity.ts';
import { hasFunctionsKey, hmacHex, safeEqual } from '../_shared/signing.ts';
import { readConnection, reportStatus } from '../_shared/connections.ts';
import { carrierLabel, createShipStation, createSimulator, hex, ProviderError } from './provider.ts';
import type { Row, ShippingOrder } from './provider.ts';
export type Deps = { db: Db; url: string; serviceKey: string; functionsKey: string; webhookKey: string;
  simSecret: string; shipstationKey: string; shipstationSecret: string; fetch: typeof fetch;
  now: () => Date; random: (size: number) => Uint8Array };
export function createHandler(deps: Deps) {
  const { db } = deps;
  const base = `${deps.url.replace(/\/+$/, '')}/functions/v1/shipping`;
  const simulator = createSimulator(deps.random, deps.fetch, `${base}/sim/resource`);
  const shipstation = createShipStation(deps.shipstationKey, deps.shipstationSecret, deps.fetch);
  async function order(id: string): Promise<ShippingOrder> {
    const row = await db.one<Row>(`orders?id=eq.${id}&select=*,order_lines(*,products(*))&limit=1`);
    if (!row) throw new DbError('Order not found.', 404, 'P0002');
    const [buyer, method] = await Promise.all([
      db.one<Row>(`buyers?id=eq.${row.buyer_id}&select=*&limit=1`),
      db.one<Row>(`shipping_methods?id=eq.${row.shipping_method_id}&select=*&limit=1`),
    ]);
    if (!buyer || !method) throw new DbError('Shipping context missing', 500);
    return { ...row, order_lines: row.order_lines as Row[], address: row.address as Row,
      customerEmail: String(buyer.email), methodLabel: String(method.label) };
  }
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return preflight();
    const path = route(req, 'shipping'), url = new URL(req.url);
    try {
      if (path === '/flush' && req.method === 'POST') {
        if (!hasFunctionsKey(req, deps.functionsKey)) return message(401, 'Unauthorized');
        const connection = await readConnection(db, 'shipping');
        if (connection.mode === 'off') return json(200, { mode: 'off', outcomes: [] });
        const claimed = await db.rpc<Row[]>('system_claim_shipments');
        const outcomes: Row[] = [];
        for (const s of claimed) {
          let result: { providerOrderId: string } | undefined;
          let failure: string | undefined;
          try {
            const provider = s.provider === 'simulator' ? simulator : s.provider === 'shipstation' ? shipstation : null;
            if (!provider) throw new ProviderError(`No adapter for ${s.provider}`);
            const o = await order(String(s.order_id));
            if (s.cancel_requested) await provider.cancelOrder(o);
            else result = await provider.createOrder(o);
          } catch (error) {
            if (error instanceof DbError) throw error;
            failure = error instanceof ProviderError ? error.message : 'ShipStation request failed';
          }
          if (failure) {
            await db.rpc('system_shipment_failed', { id: s.id, error: failure });
            await reportStatus(db, 'shipping', false, failure);
            outcomes.push({ id: s.id, status: 'failed' });
          } else {
            await db.rpc(s.cancel_requested ? 'system_shipment_cancelled' : 'system_shipment_pushed',
              s.cancel_requested ? { id: s.id } : { id: s.id, provider_order_id: result!.providerOrderId });
            await reportStatus(db, 'shipping', true);
            outcomes.push({ id: s.id, status: s.cancel_requested ? 'cancelled' : 'pushed' });
          }
        }
        return json(200, { mode: connection.mode, outcomes });
      }
      if (path === '/webhook' && req.method === 'POST') {
        if (deps.webhookKey.length < 32 || !safeEqual(url.searchParams.get('key') ?? '', deps.webhookKey)) return message(404, 'Not found');
        const payload = await body(req);
        if (payload.resource_type !== 'SHIP_NOTIFY') return json(200, {});
        const connection = await readConnection(db, 'shipping');
        if (connection.mode === 'off') return json(200, {});
        try {
          const provider = connection.mode === 'simulated' ? simulator : shipstation;
          const shipments = await provider.fetchShipments(String(payload.resource_url ?? ''));
          for (const s of shipments) {
            if (s.voided || !isUuid(s.orderKey)) continue;
            const ours = await db.one<Row>(`orders?id=eq.${s.orderKey}&select=*&limit=1`);
            if (!ours) continue;
            await db.rpc('system_mark_shipped', { order_id: s.orderKey, carrier: carrierLabel(s.carrierCode), service: s.serviceCode,
              tracking: s.trackingNumber, shipped_at: s.shipDate, provider: connection.mode === 'simulated' ? 'simulator' : 'shipstation', event_id: s.shipmentId });
          }
          await reportStatus(db, 'shipping', true);
        } catch (error) {
          if (error instanceof DbError) throw error;
          await reportStatus(db, 'shipping', false, error instanceof ProviderError ? error.message : 'ShipStation request failed');
        }
        return json(200, {});
      }
      if (path === '/sim/resource' && req.method === 'GET') {
        const batch = url.searchParams.get('batch') ?? '', sig = url.searchParams.get('sig') ?? '';
        if (!deps.simSecret || !batch || !safeEqual(sig, await hmacHex(deps.simSecret, batch))) return message(404, 'Not found');
        if ((await readConnection(db, 'shipping')).mode !== 'simulated') return message(404, 'Not found');
        const labels = await db.select<Row>(`simulated_labels?batch=eq.${encodeURIComponent(batch)}&select=*`);
        const shipments = await Promise.all(labels.map(async (label) => {
          const o = await db.one<Row>(`orders?id=eq.${label.order_id}&select=*&limit=1`);
          return { shipmentId: label.id, orderKey: label.order_id, orderNumber: o?.number,
            carrierCode: label.carrier, serviceCode: label.service, trackingNumber: label.tracking, shipDate: label.created_at, voided: false };
        }));
        return json(200, { shipments });
      }
      if (path === '/simulate' && req.method === 'POST') {
        const caller = await identify(req, deps.url, deps.serviceKey, db, deps.fetch);
        if (!isTeam(caller)) return message(403, 'Team access required.');
        if ((await readConnection(db, 'shipping')).mode !== 'simulated') return message(400, 'Shipping is not simulated.');
        const payload = await body(req);
        if (!isUuid(payload.orderId) || !['label', 'delivered'].includes(String(payload.action))) return message(400, 'Invalid simulation.');
        const s = await db.one<Row>(`shipments?order_id=eq.${payload.orderId}&select=*&limit=1`);
        if (!s || s.provider !== 'simulator' || s.cancel_requested) return message(400, 'Shipment unavailable.');
        if (payload.action === 'delivered') {
          if (s.status !== 'shipped') return message(400, 'The shipment must be shipped.');
          await db.rpc('system_mark_delivered', { order_id: payload.orderId, delivered_at: deps.now().toISOString(), provider: 'simulator', event_id: `sim_dl_${payload.orderId}` });
          return json(200, { status: 'delivered' });
        }
        if (s.status !== 'pushed') return message(400, 'The shipment must be pushed.');
        if (!deps.simSecret || deps.webhookKey.length < 32) return message(503, 'Shipping simulator configuration missing.');
        const batch = hex(deps.random(12));
        const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const tracking = '1ZSIM' + Array.from(deps.random(13), (b) => alphabet[b % alphabet.length]).join('');
        await db.rpc('system_create_simulated_label', { id: `sim_sh_${hex(deps.random(12))}`, order_id: payload.orderId, batch, tracking });
        const resource = `${base}/sim/resource?batch=${batch}&sig=${await hmacHex(deps.simSecret, batch)}`;
        const response = await deps.fetch(`${base}/webhook?key=${encodeURIComponent(deps.webhookKey)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resource_url: resource, resource_type: 'SHIP_NOTIFY' }),
        });
        if (!response.ok) return message(500, 'The label could not be processed.');
        const saved = await db.one<Row>(`shipments?order_id=eq.${payload.orderId}&select=*&limit=1`);
        if (saved?.status !== 'shipped') return message(500, 'The label could not be processed.');
        return json(200, { status: 'shipped' });
      }
      return message(404, 'Not found');
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof RangeError) return message(400, 'Invalid request.');
      if (path !== '/webhook' && error instanceof DbError && ['22023', 'P0002'].includes(error.code ?? '')) return message(400, presentable(error, 'Shipping request failed.'));
      return message(500, 'Shipping request failed.');
    }
  };
}
