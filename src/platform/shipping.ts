export type ShipmentStatus = 'queued' | 'pushed' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
export type Shipment = {
  id: string; orderId: string; provider: string; status: ShipmentStatus; providerOrderId: string | null;
  carrier: string | null; service: string | null; tracking: string | null; cancelRequested: boolean;
  attempts: number; nextAttemptAt: string; lockedUntil: string | null; lastError: string | null;
  pushedAt: string | null; shippedAt: string | null; deliveredAt: string | null; cancelledAt: string | null; updatedAt: string;
};
export const SHIPMENT_LABELS: Record<ShipmentStatus, string> = {
  queued: 'Sending to ShipStation.', pushed: 'In ShipStation, awaiting a label.', shipped: 'Shipped',
  delivered: 'Delivered', cancelled: 'Removed from ShipStation.', failed: "Couldn't reach ShipStation",
};
