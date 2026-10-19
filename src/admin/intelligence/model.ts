/** Order-backed business intelligence. Money is rounded in cents; calendar windows are UTC. */
import type {
  Buyer,
  Lot,
  Order,
  Partner,
  Referral,
} from "../../platform/types";
import type { Product } from "../../data";
import { lineCharge } from "../../platform/pricing";

export const DAY = 86_400_000;
export const cents = (n: number) =>
  Math.round((Number.isFinite(n) ? n : 0) * 100);
export const dollars = (n: number) => Math.round(n) / 100;
const round = (n: number) => dollars(cents(n));
const total = (values: number[]) =>
  dollars(values.reduce((s, n) => s + cents(n), 0));
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
export const dateKey = (date: Date | string | number) =>
  new Date(date).toISOString().slice(0, 10);
export const shiftDay = (key: string, days: number) =>
  dateKey(Date.parse(key + "T00:00:00Z") + days * DAY);

export function groupBy<T>(
  values: T[],
  key: (value: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const k = key(value);
    const rows = groups.get(k) ?? [];
    rows.push(value);
    groups.set(k, rows);
  }
  return groups;
}

export type BusinessData = {
  orders: Order[];
  buyers: Buyer[];
  products: Product[];
  lots: Lot[];
  partners: Partner[];
  referrals: Referral[];
  asOf: string;
};
export type DateWindow = {
  from: string;
  to: string;
  start: number;
  end: number;
  days: number;
};
export function dateWindow(from: string, to: string): DateWindow {
  const valid = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v + "T00:00:00Z")) &&
    dateKey(v) === v;
  if (!valid(from) || !valid(to))
    throw Error("Choose valid start and end dates.");
  const start = Date.parse(from + "T00:00:00Z"),
    end = Date.parse(to + "T00:00:00Z") + DAY;
  const days = Math.round((end - start) / DAY);
  if (days < 1 || days > 366)
    throw Error("Choose a range between 1 and 366 days.");
  return { from, to, start, end, days };
}
export const trailingWindow = (asOf: string, days = 30) =>
  dateWindow(shiftDay(dateKey(asOf), 1 - days), dateKey(asOf));
export const previousWindow = (window: DateWindow) =>
  dateWindow(shiftDay(window.from, -window.days), shiftDay(window.from, -1));
export const inWindow = (iso: string, window: DateWindow, asOf = Infinity) => {
  const at = Date.parse(iso);
  return at >= window.start && at < window.end && at <= asOf;
};

/** Current captured amounts for an order cohort, not bank settlement transactions.
 * A partial refund is allocated proportionally across goods, shipping, insurance and tax.
 * This allocation is an estimate until line-level refund records are available. */
export function orderCode(order: Order) { return order.discount?.source === "program" ? undefined : order.discount?.code; }

export function orderMoney(order: Order) {
  const paid = ["captured", "partially_refunded", "refunded"].includes(
    order.payment,
  );
  const amount = Math.max(0, cents(order.total));
  const refund = paid
    ? clamp(
        cents(
          order.payment === "refunded" || order.status === "refunded"
            ? order.total
            : order.refunded ?? 0,
        ),
        0,
        amount,
      )
    : 0;
  const remaining = amount ? (amount - refund) / amount : 0;
  const gross = paid ? Math.max(0, cents(order.subtotal)) : 0;
  const discount = paid
    ? clamp(cents(order.discount?.amount ?? 0), 0, gross)
    : 0;
  const product = Math.round((gross - discount) * remaining);
  const shipping = paid
    ? Math.round(Math.max(0, cents(order.shipping.price)) * remaining)
    : 0;
  const insurance = paid
    ? Math.round(Math.max(0, cents(order.insurance ?? 0)) * remaining)
    : 0;
  const tax = paid
    ? Math.round(Math.max(0, cents(order.tax ?? 0)) * remaining)
    : 0;
  const collected = paid ? amount - refund : 0;
  const revenue = collected - tax;
  return {
    paid,
    gross: dollars(gross),
    discount: dollars(discount),
    refund: dollars(refund),
    product: dollars(product),
    shipping: dollars(shipping),
    insurance: dollars(insurance),
    tax: dollars(tax),
    collected: dollars(collected),
    revenue: dollars(revenue),
    productRefund: dollars(gross - discount - product),
    other: dollars(revenue - product - shipping - insurance),
  };
}

/** A carrier retry must never duplicate fulfillment or send an uncollected/refunded order. */
export function readyToShip(order: Order) {
  return (
    ["paid", "packed"].includes(order.status) &&
    orderMoney(order).collected > 0 &&
    Boolean(
      order.address.line1?.trim() &&
      order.address.postal?.trim() &&
      order.address.country?.trim(),
    )
  );
}

export type SalesTotals = {
  revenue: number;
  collected: number;
  product: number;
  gross: number;
  discounts: number;
  refunds: number;
  productRefunds: number;
  tax: number;
  shipping: number;
  insurance: number;
  other: number;
  paid: number;
  placed: number;
  customers: number;
  units: number;
  average: number;
  unpaid: number;
};
export function salesTotals(orders: Order[]): SalesTotals {
  const paid = orders.filter((o) => orderMoney(o).paid),
    money = paid.map(orderMoney);
  const revenue = total(money.map((m) => m.revenue));
  return {
    revenue,
    collected: total(money.map((m) => m.collected)),
    product: total(money.map((m) => m.product)),
    gross: total(money.map((m) => m.gross)),
    discounts: total(money.map((m) => m.discount)),
    refunds: total(money.map((m) => m.refund)),
    productRefunds: total(money.map((m) => m.productRefund)),
    tax: total(money.map((m) => m.tax)),
    shipping: total(money.map((m) => m.shipping)),
    insurance: total(money.map((m) => m.insurance)),
    other: total(money.map((m) => m.other)),
    paid: paid.length,
    placed: orders.length,
    customers: new Set(paid.map((o) => o.buyerId)).size,
    units: paid.reduce(
      (s, o) => s + o.lines.reduce((n, l) => n + l.quantity, 0),
      0,
    ),
    average: paid.length ? round(revenue / paid.length) : 0,
    unpaid: total(
      orders
        .filter(
          (o) =>
            !orderMoney(o).paid &&
            o.status !== "cancelled" &&
            o.status !== "refunded",
        )
        .map((o) => o.total),
    ),
  };
}

export type ProductSales = {
  id: string;
  name: string;
  size: string;
  units: number;
  gross: number;
  net: number;
  orders: number;
};
/** Cumulative rounding conserves cents without assigning a negative amount to a small final line. */
export function productSales(
  orders: Order[],
  products: Product[],
): ProductSales[] {
  const rows = new Map<string, ProductSales>();
  const catalog = new Map(products.map((p) => [p.id, p]));
  for (const order of orders) {
    const money = orderMoney(order);
    if (!money.paid) continue;
    const grossCents = order.lines.map((l) =>
      Math.max(0, cents(lineCharge(l))),
    );
    const grossTotal = grossCents.reduce((a, b) => a + b, 0);
    let allocated = 0,
      weight = 0;
    order.lines.forEach((line, i) => {
      const p = catalog.get(line.productId);
      const row = rows.get(line.productId) ?? {
        id: line.productId,
        name: p?.name ?? line.productId,
        size: p?.size ?? "",
        units: 0,
        gross: 0,
        net: 0,
        orders: 0,
      };
      weight += grossCents[i];
      const through = grossTotal
        ? Math.round((cents(money.product) * weight) / grossTotal)
        : i === order.lines.length - 1
          ? cents(money.product)
          : 0;
      const allocation = through - allocated;
      allocated += allocation;
      row.units += line.quantity;
      row.gross = round(row.gross + dollars(grossCents[i]));
      row.net = round(row.net + dollars(allocation));
      if (!order.lines.slice(0, i).some((l) => l.productId === line.productId))
        row.orders++;
      rows.set(row.id, row);
    });
  }
  return [...rows.values()].sort(
    (a, b) => b.net - a.net || a.name.localeCompare(b.name),
  );
}

export function analyze(data: BusinessData, window: DateWindow) {
  const asOf = Date.parse(data.asOf);
  const orders = data.orders.filter((o) => inWindow(o.createdAt, window, asOf));
  const previous = data.orders.filter((o) =>
    inWindow(o.createdAt, previousWindow(window), asOf),
  );
  const daily = Array.from({ length: window.days }, (_, i) => {
    const key = shiftDay(window.from, i);
    const own = orders.filter((o) => dateKey(o.createdAt) === key);
    return { key, ...salesTotals(own) };
  });
  const group = (key: (o: Order) => string) =>
    [
      ...groupBy(
        orders.filter((o) => orderMoney(o).paid),
        key,
      ),
    ]
      .map(([name, rows]) => ({ name, ...salesTotals(rows) }))
      .sort((a, b) => b.revenue - a.revenue);
  return {
    window,
    orders,
    current: salesTotals(orders),
    previous: salesTotals(previous),
    daily,
    products: productSales(orders, data.products),
    channels: group((o) =>
      o.discount?.partnerId
        ? "Partners"
        : orderCode(o)
          ? "Other promo codes"
          : "Unattributed",
    ),
    codes: group((o) => orderCode(o) ?? "No code"),
    states: group((o) => o.address.region || "Unknown"),
    payments: group((o) => o.paymentProvider || "Provider not recorded"),
  };
}

export type ForecastAssumptions = {
  demandChange: number;
  basketChange: number;
  spread: number;
  target: number;
  horizon: number;
};
export const DEFAULT_FORECAST: ForecastAssumptions = {
  demandChange: 0,
  basketChange: 0,
  spread: 20,
  target: 0,
  horizon: 30,
};
export function forecast(data: BusinessData, assumptions: ForecastAssumptions) {
  const now = Date.parse(data.asOf);
  const today = dateKey(data.asOf);
  // An incomplete UTC day is excluded from the training series.
  const elapsed = (now - Date.parse(today + "T00:00:00Z")) / DAY;
  const completeToday = elapsed >= 0.99999;
  const last = completeToday ? today : shiftDay(today, -1);
  const history = analyze(data, dateWindow(shiftDay(last, -55), last));
  const captured = data.orders.filter(
    (o) => orderMoney(o).paid && Date.parse(o.createdAt) <= now,
  );
  const first = captured.length
    ? Math.min(...captured.map((o) => Date.parse(o.createdAt)))
    : now;
  const coverage = captured.length
    ? Math.max(
        0,
        Math.min(
          56,
          Math.floor(
            (Date.parse(last + "T00:00:00Z") -
              Date.parse(dateKey(first) + "T00:00:00Z")) /
              DAY,
          ) + 1,
        ),
      )
    : 0;
  const enough = coverage >= 14 && history.current.paid >= 5;
  const observed = history.daily.slice(-Math.max(1, Math.min(28, coverage)));
  const dailyRevenue = observed.length
    ? total(observed.map((d) => d.revenue)) / observed.length
    : 0;
  const dailyOrders = observed.length
    ? observed.reduce((s, d) => s + d.paid, 0) / observed.length
    : 0;
  const weekdays = new Map<number, number>();
  for (let w = 0; w < 7; w++) {
    const own = history.daily
      .slice(-coverage || history.daily.length)
      .filter((d) => new Date(d.key).getUTCDay() === w);
    const weight = own.reduce(
      (s, _, i) => s + Math.pow(0.9, own.length - 1 - i),
      0,
    );
    weekdays.set(
      w,
      weight
        ? own.reduce(
            (s, d, i) => s + d.revenue * Math.pow(0.9, own.length - 1 - i),
            0,
          ) / weight
        : dailyRevenue,
    );
  }
  const growth = Math.pow(
    1 + clamp(assumptions.demandChange, -90, 200) / 100,
    1 / 30,
  );
  const basket = 1 + clamp(assumptions.basketChange, -90, 200) / 100;
  const spread = clamp(assumptions.spread, 0, 90) / 100;
  const days = Math.round(clamp(assumptions.horizon, 7, 90));
  const points = Array.from({ length: days }, (_, i) => {
    const key = shiftDay(today, i + 1);
    const value = round(
      Math.max(
        0,
        (weekdays.get(new Date(key).getUTCDay()) ?? dailyRevenue) *
          Math.pow(growth, i + 1) *
          basket,
      ),
    );
    return {
      key,
      value,
      low: round(value * (1 - spread)),
      high: round(value * (1 + spread)),
    };
  });
  const monthStart = today.slice(0, 7) + "-01";
  const monthEnd = dateKey(
    Date.UTC(
      new Date(today).getUTCFullYear(),
      new Date(today).getUTCMonth() + 1,
      0,
    ),
  );
  const monthActual = analyze(data, dateWindow(monthStart, today)).current
    .revenue;
  const remaining = Math.round(
    (Date.parse(monthEnd) - Date.parse(today)) / DAY,
  );
  let remainingRevenue = 0;
  for (let i = 1; i <= remaining; i++) {
    const key = shiftDay(today, i);
    remainingRevenue +=
      (weekdays.get(new Date(key).getUTCDay()) ?? dailyRevenue) *
      Math.pow(growth, i) *
      basket;
  }
  remainingRevenue += completeToday
    ? 0
    : (weekdays.get(new Date(today).getUTCDay()) ?? dailyRevenue) *
      Math.max(0, 1 - elapsed) *
      basket;
  const projectedMonth = round(monthActual + remainingRevenue);
  return {
    enough,
    coverage,
    historicalOrders: history.current.paid,
    dailyRevenue: round(dailyRevenue),
    dailyOrders,
    average: dailyOrders ? round((dailyRevenue / dailyOrders) * basket) : 0,
    points,
    projected: total(points.map((p) => p.value)),
    monthActual,
    projectedMonth,
    monthLow: round(monthActual + remainingRevenue * (1 - spread)),
    monthHigh: round(monthActual + remainingRevenue * (1 + spread)),
    targetGap: round(Math.max(0, assumptions.target - projectedMonth)),
    daysRemaining: remaining,
    monthEnd,
  };
}

export type CostAssumptions = {
  mode: "margin" | "sku";
  margin: number;
  costs: Record<string, number>;
  shippingPerOrder: number;
  feePercent: number;
  feeFixed: number;
  adSpend: number;
  overheadMonthly: number;
};
export const DEFAULT_COSTS: CostAssumptions = {
  mode: "margin",
  margin: 65,
  costs: {},
  shippingPerOrder: 0,
  feePercent: 0,
  feeFixed: 0,
  adSpend: 0,
  overheadMonthly: 0,
};
export function profit(
  data: BusinessData,
  window: DateWindow,
  costs: CostAssumptions,
) {
  const report = analyze(data, window),
    ids = new Set(
      report.orders.filter((o) => orderMoney(o).paid).map((o) => o.id),
    );
  const commissions = total(
    data.referrals
      .filter((r) => ids.has(r.orderId) && r.status !== "void")
      .map((r) => r.commission),
  );
  const missing = report.products.filter(
    (p) => !Number.isFinite(costs.costs[p.id]),
  );
  // Calendar-month overhead, allocated day by day (February isn't treated as 30 days).
  const allocated = (budget: number, index: number, count: number) =>
    dollars(
      Math.round((cents(Math.max(0, budget)) * (index + 1)) / count) -
        Math.round((cents(Math.max(0, budget)) * index) / count),
    );
  let cumulativeProduct = 0,
    allocatedProduct = 0;
  const daily = report.daily.map((d, index) => {
    const own = data.orders.filter(
      (o) =>
        inWindow(
          o.createdAt,
          dateWindow(d.key, d.key),
          Date.parse(data.asOf),
        ) && orderMoney(o).paid,
    );
    const products = productSales(own, data.products);
    cumulativeProduct += cents(d.product);
    const throughProduct = Math.round(
      cumulativeProduct * (1 - clamp(costs.margin, 0, 100) / 100),
    );
    const productCost =
      costs.mode === "margin"
        ? dollars(throughProduct - allocatedProduct)
        : total(
            products.map((p) => p.units * Math.max(0, costs.costs[p.id] ?? 0)),
          );
    allocatedProduct = throughProduct;
    const ownIds = new Set(own.map((o) => o.id));
    const commission = total(
      data.referrals
        .filter((r) => ownIds.has(r.orderId) && r.status !== "void")
        .map((r) => r.commission),
    );
    const shipping = round(d.paid * Math.max(0, costs.shippingPerOrder));
    const fees = round(
      (d.collected * clamp(costs.feePercent, 0, 100)) / 100 +
        d.paid * Math.max(0, costs.feeFixed),
    );
    const monthDays = new Date(
      Date.UTC(
        new Date(d.key).getUTCFullYear(),
        new Date(d.key).getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();
    const overhead = allocated(
        costs.overheadMonthly,
        new Date(d.key).getUTCDate() - 1,
        monthDays,
      ),
      ads = allocated(costs.adSpend, index, window.days);
    return {
      ...d,
      cogs: productCost,
      shippingCost: shipping,
      fees,
      commission,
      overhead,
      ads,
      net: round(
        d.revenue - productCost - shipping - fees - commission - overhead - ads,
      ),
    };
  });
  return {
    report,
    daily,
    cogs: total(daily.map((d) => d.cogs)),
    commissions,
    complete: costs.mode === "margin" || missing.length === 0,
    missing,
    shipping: total(daily.map((d) => d.shippingCost)),
    fees: total(daily.map((d) => d.fees)),
    overhead: total(daily.map((d) => d.overhead)),
    ads: total(daily.map((d) => d.ads)),
    net: total(daily.map((d) => d.net)),
    margin: report.current.revenue
      ? total(daily.map((d) => d.net)) / report.current.revenue
      : null,
  };
}

export function customerHealth(data: BusinessData, quietDays = 45) {
  const now = Date.parse(data.asOf),
    names = new Map(data.buyers.map((b) => [b.id, b]));
  const paid = data.orders.filter(
    (o) => orderMoney(o).paid && Date.parse(o.createdAt) <= now,
  );
  const groups = groupBy(paid, (o) => o.buyerId);
  const rows = [...groups]
    .map(([id, orders]) => {
      orders.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      const intervals = orders
        .slice(1)
        .map(
          (o, i) =>
            (Date.parse(o.createdAt) - Date.parse(orders[i].createdAt)) / DAY,
        )
        .filter((n) => n > 0)
        .sort((a, b) => a - b);
      const median = intervals.length
        ? intervals.length % 2
          ? intervals[Math.floor(intervals.length / 2)]
          : (intervals[intervals.length / 2 - 1] +
              intervals[intervals.length / 2]) /
            2
        : null;
      const daysSince = Math.max(
        0,
        Math.floor((now - Date.parse(orders.at(-1)!.createdAt)) / DAY),
      );
      return {
        id,
        name: names.get(id)?.name ?? id,
        institution: names.get(id)?.institution ?? "",
        orders: orders.length,
        ltv: salesTotals(orders).revenue,
        first: orders[0].createdAt,
        last: orders.at(-1)!.createdAt,
        daysSince,
        medianDays: median,
        segment:
          daysSince >= quietDays
            ? "At risk"
            : orders.length >= 3
              ? "Loyal"
              : orders.length >= 2
                ? "Returning"
                : "First order",
      };
    })
    .sort((a, b) => b.ltv - a.ltv);
  const months = [...new Set(rows.map((r) => dateKey(r.first).slice(0, 7)))]
    .sort()
    .slice(-6);
  const cohorts = months.map((month) => {
    const members = rows.filter((r) => dateKey(r.first).startsWith(month));
    const ids = new Set(members.map((r) => r.id));
    const start = new Date(month + "-01T00:00:00Z");
    const cells = Array.from({ length: 6 }, (_, i) => {
      const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
        end = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 1);
      if (end > now + 1) return null; // Incomplete cohorts are not presented as zero retention.
      return new Set(
        paid
          .filter(
            (o) =>
              ids.has(o.buyerId) &&
              Date.parse(o.createdAt) >= from &&
              Date.parse(o.createdAt) < end,
          )
          .map((o) => o.buyerId),
      ).size;
    });
    return { month, size: members.length, cells };
  });
  return {
    rows,
    cohorts,
    customers: rows.length,
    repeat: rows.filter((r) => r.orders > 1).length,
    atRisk: rows.filter((r) => r.segment === "At risk").length,
    ltv: rows.length ? round(total(rows.map((r) => r.ltv)) / rows.length) : 0,
  };
}

export type StockAssumptions = {
  lookback: number;
  leadDays: number;
  safetyDays: number;
  targetDays: number;
  onOrder: Record<string, number>;
};
export const DEFAULT_STOCK: StockAssumptions = {
  lookback: 30,
  leadDays: 14,
  safetyDays: 7,
  targetDays: 45,
  onOrder: {},
};
export function stockPlan(data: BusinessData, settings: StockAssumptions) {
  const lookback = Math.round(clamp(settings.lookback, 7, 90));
  const lead = Math.round(clamp(settings.leadDays, 0, 365)),
    safety = Math.round(clamp(settings.safetyDays, 0, 90)),
    target = Math.round(clamp(settings.targetDays, 1, 180));
  const report = analyze(data, trailingWindow(data.asOf, lookback));
  return data.products
    .filter((p) => p.active !== false)
    .map((product) => {
      const own = data.lots.filter(
        (l) => l.productId === product.id && l.status === "released",
      );
      const sellable =
        product.stock != null
          ? Math.max(0, product.stock)
          : own.length && own.every((l) => l.units !== null)
            ? own.reduce((s, l) => s + l.units!, 0)
            : null;
      const held = data.lots.filter(
        (l) =>
          l.productId === product.id &&
          (l.status === "testing" || l.status === "quarantine"),
      );
      const heldUnits =
        held.length && held.every((l) => l.units !== null)
          ? held.reduce((s, l) => s + l.units!, 0)
          : held.length
            ? null
            : 0;
      const sales = report.products.find((p) => p.id === product.id),
        sold = sales?.units ?? 0,
        velocity = sold / lookback;
      const cover =
        sellable !== null && velocity > 0 ? sellable / velocity : null;
      const incoming = Math.max(
        0,
        Math.floor(settings.onOrder[product.id] ?? 0),
      );
      const reorderPoint = Math.ceil(velocity * (lead + safety));
      const suggested =
        sellable === null
          ? null
          : Math.max(
              0,
              Math.ceil(velocity * (lead + safety + target)) -
                sellable -
                incoming,
            );
      const status =
        sellable === null
          ? "Count needed"
          : sellable === 0
            ? "Out of stock"
            : cover !== null && cover <= lead
              ? "Before delivery"
              : sellable + incoming <= reorderPoint
                ? "Reorder"
                : "Covered";
      return {
        id: product.id,
        name: product.name,
        size: product.size,
        sellable,
        heldUnits,
        sold,
        velocity,
        cover,
        incoming,
        reorderPoint,
        suggested,
        status,
        stockout:
          cover === null
            ? null
            : shiftDay(dateKey(data.asOf), Math.floor(cover)),
        arrival: shiftDay(dateKey(data.asOf), lead),
      };
    })
    .sort(
      (a, b) =>
        (a.cover ?? Infinity) - (b.cover ?? Infinity) ||
        a.name.localeCompare(b.name),
    );
}

export function riskSignals(data: BusinessData, days = 60) {
  const window = trailingWindow(data.asOf, days),
    orders = data.orders.filter((o) =>
      inWindow(o.createdAt, window, Date.parse(data.asOf)),
    );
  const buyers = new Map(data.buyers.map((b) => [b.id, b]));
  const signals: {
    id: string;
    level: "Review" | "Attention";
    reason: string;
    detail: string;
    orderId?: string;
    buyerId: string;
  }[] = [];
  for (const order of orders) {
    const buyer = buyers.get(order.buyerId),
      partner = data.partners.find((p) => p.id === order.discount?.partnerId);
    if (
      buyer &&
      partner &&
      buyer.email.toLowerCase().trim() === partner.email.toLowerCase().trim()
    )
      signals.push({
        id: order.id + "-self",
        level: "Review",
        reason: "Self-referral",
        detail: order.number + " uses this buyer’s own partner code.",
        orderId: order.id,
        buyerId: order.buyerId,
      });
    if (
      !order.address.line1?.trim() ||
      !order.address.postal?.trim() ||
      !order.address.country?.trim()
    )
      signals.push({
        id: order.id + "-address",
        level: "Attention",
        reason: "Incomplete shipping address",
        detail: order.number + " needs an address check before fulfillment.",
        orderId: order.id,
        buyerId: order.buyerId,
      });
  }
  for (const [buyerId, own] of groupBy(orders, (o) => o.buyerId)) {
    const pending = own.filter(
      (o) => !orderMoney(o).paid && o.status !== "cancelled",
    );
    if (pending.length >= 3)
      signals.push({
        id: buyerId + "-unpaid",
        level: "Review",
        reason: "Repeated unpaid orders",
        detail: `${pending.length} unpaid orders in ${days} days.`,
        buyerId,
      });
    if (own.length >= 4)
      signals.push({
        id: buyerId + "-frequency",
        level: "Attention",
        reason: "High order frequency",
        detail: `${own.length} orders in ${days} days; review context before deciding.`,
        buyerId,
      });
  }
  return { scanned: orders.length, signals };
}

export function activityRows(data: BusinessData) {
  return data.orders
    .flatMap((o) =>
      o.events.map((event, i) => ({
        id: `${o.id}-${i}`,
        at: event.at,
        category: "Orders",
        action: event.status,
        detail: event.note ?? `Order moved to ${event.status}`,
        target: o.number,
        orderId: o.id,
      })),
    )
    .filter((e) => Date.parse(e.at) <= Date.parse(data.asOf))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** CSV quotes all fields and prevents spreadsheet formulas from becoming executable exports. */
export function toCsv(headers: string[], rows: unknown[][]) {
  const quote = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s) && typeof v !== "number")
      s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n")
  );
}

/** Small RFC-4180 reader for import previews. No evaluation, network or database writes. */
export function parseCsv(text: string): string[][] {
  if (text.length > 2_000_000) throw Error("Choose a CSV smaller than 2 MB.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || field.length === 0) quoted = !quoted;
      else throw Error("Unexpected quote in CSV.");
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
    if (rows.length > 5000) throw Error("Preview up to 5,000 rows at a time.");
  }
  if (quoted) throw Error("A quoted field is not closed.");
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
