export type Row = Record<string, unknown>;
export type ShippingOrder = Row & { order_lines: Row[]; address: Row; methodLabel: string; customerEmail: string };
export type Shipment = { shipmentId: string; orderKey: string; orderNumber: string; carrierCode: string; serviceCode: string; trackingNumber: string; shipDate: string; voided: boolean };
export type Provider = {
  createOrder(order: ShippingOrder): Promise<{ providerOrderId: string }>;
  cancelOrder(order: ShippingOrder): Promise<void>;
  fetchShipments(resourceUrl: string): Promise<Shipment[]>;
};
export class ProviderError extends Error {}
export function countryCode(value: unknown): string {
  const country = String(value ?? '').trim().toUpperCase();
  if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(country)) return 'US';
  if (/^[A-Z]{2}$/.test(country)) return country;
  throw new ProviderError('Country must be a two-letter code');
}
export function carrierLabel(code: string): string {
  const lower = code.toLowerCase();
  return lower.startsWith('ups') ? 'UPS' : lower.startsWith('fedex') ? 'FedEx' : code.toUpperCase();
}
export function shipstationOrder(order: ShippingOrder, cancelled = false): Row {
  const a = order.address;
  const address = { name: a.attention, company: a.institution, street1: a.line1, street2: a.line2 ?? '',
    city: a.city, state: a.region, postalCode: a.postal, country: countryCode(a.country), phone: a.phone ?? '' };
  return { orderNumber: order.number, orderKey: order.id, orderDate: order.created_at,
    orderStatus: cancelled ? 'cancelled' : 'awaiting_shipment', customerEmail: order.customerEmail,
    billTo: address, shipTo: address,
    items: order.order_lines.map((line) => {
      const product = line.products as Row;
      return { sku: line.product_id, name: `${product.name} ${product.size}`, quantity: line.quantity, unitPrice: Number(line.unit_price) };
    }), amountPaid: Number(order.total), shippingAmount: Number(order.shipping_price), taxAmount: Number(order.tax ?? 0),
    requestedShippingService: order.methodLabel, internalNotes: `Cold chain. Lots: ${order.order_lines.map((line) => line.lot).join(', ')}` };
}
export function createShipStation(key: string, secret: string, fetcher: typeof fetch): Provider {
  async function call(url: string, init: RequestInit = {}): Promise<Row> {
    if (!key || !secret) throw new ProviderError('ShipStation configuration missing');
    const parsed = new URL(url);
    if (parsed.origin !== 'https://ssapi.shipstation.com' || parsed.username || parsed.password) throw new ProviderError('Invalid ShipStation resource');
    const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}`, 'Content-Type': 'application/json' } });
    if (!response.ok) throw new ProviderError('ShipStation request failed');
    return await response.json() as Row;
  }
  async function send(order: ShippingOrder, cancelled = false) {
    const result = await call('https://ssapi.shipstation.com/orders/createorder', { method: 'POST', body: JSON.stringify(shipstationOrder(order, cancelled)) });
    if (result.orderId == null) throw new ProviderError('ShipStation did not return an order id');
    return { providerOrderId: String(result.orderId) };
  }
  return {
    createOrder: (order) => send(order), cancelOrder: async (order) => { await send(order, true); },
    fetchShipments: async (url) => {
      const result = await call(url);
      if (!Array.isArray(result.shipments)) throw new ProviderError('Invalid ShipStation response');
      return result.shipments.map((row: Row) => ({ shipmentId: String(row.shipmentId), orderKey: String(row.orderKey ?? ''), orderNumber: String(row.orderNumber ?? ''),
        carrierCode: String(row.carrierCode ?? ''), serviceCode: String(row.serviceCode ?? ''), trackingNumber: String(row.trackingNumber ?? ''),
        shipDate: String(row.shipDate ?? ''), voided: row.voided === true }));
    },
  };
}
export function createSimulator(random: (size: number) => Uint8Array, fetcher: typeof fetch, resourceBase: string): Provider {
  return {
    createOrder: async () => ({ providerOrderId: `sim_or_${hex(random(12))}` }), cancelOrder: async () => {},
    fetchShipments: async (url) => {
      const parsed = new URL(url), base = new URL(resourceBase);
      if (parsed.origin !== base.origin || parsed.pathname !== base.pathname || parsed.username || parsed.password) throw new ProviderError('Invalid simulated resource');
      const response = await fetcher(url, { redirect: 'error' });
      if (!response.ok) throw new ProviderError('Simulated resource request failed');
      return (await response.json() as { shipments: Shipment[] }).shipments;
    },
  };
}
export const hex = (bytes: Uint8Array) => Array.from(bytes, (v) => v.toString(16).padStart(2, '0')).join('');
