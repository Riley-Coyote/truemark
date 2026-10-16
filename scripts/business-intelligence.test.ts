import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyze,
  dateWindow,
  trailingWindow,
  orderMoney,
  readyToShip,
  salesTotals,
  productSales,
  profit,
  forecast,
  stockPlan,
  customerHealth,
  toCsv,
  parseCsv,
  DEFAULT_COSTS,
  DEFAULT_FORECAST,
  DEFAULT_STOCK,
} from "../src/admin/intelligence/model.ts";
import type { BusinessData } from "../src/admin/intelligence/model.ts";
import type { Order } from "../src/platform/types.ts";
import {
  campaignAudience,
  contactImport,
  rewardEstimate,
} from "../src/admin/intelligence/workflows.ts";
import { businessSummary } from "../src/assistant/metrics.ts";

const makeOrder = (id: string, patch: Partial<Order> = {}): Order => ({
  id,
  number: id,
  buyerId: "b1",
  createdAt: "2026-09-20T12:00:00Z",
  status: "paid",
  payment: "captured",
  lines: [{ productId: "p1", quantity: 2, unitPrice: 50, lot: "L1" }],
  subtotal: 100,
  shipping: { method: "cold-2day", price: 10 },
  tax: 9,
  discount: { code: "TEST", amount: 10 },
  total: 109,
  address: {
    id: "a",
    label: "Lab",
    institution: "Fictional lab",
    attention: "Research",
    line1: "1 Sample",
    city: "Chicago",
    region: "IL",
    postal: "00000",
    country: "US",
  },
  events: [],
  ...patch,
});
const fixture = (orders: Order[] = []): BusinessData => ({
  orders,
  buyers: [],
  partners: [],
  referrals: [],
  products: [
    {
      id: "p1",
      name: "Test product",
      size: "10 mg",
      category: "test",
      color: "#333",
      colorInk: "#fff",
      form: "powder",
      lot: "L1",
    },
  ],
  lots: [],
  asOf: "2026-09-25T23:59:59.999Z",
});

test("unpaid, authorized and failed orders contribute no collected revenue", () => {
  for (const payment of ["pending", "authorized", "failed"] as const)
    assert.equal(orderMoney(makeOrder(payment, { payment })).revenue, 0);
  assert.equal(
    salesTotals([
      makeOrder("paid"),
      makeOrder("authorized", { payment: "authorized" }),
    ]).paid,
    1,
  );
  assert.equal(
    salesTotals([
      makeOrder("paid"),
      makeOrder("authorized", { payment: "authorized" }),
    ]).placed,
    2,
  );
});
test("captured sales separate gross, discount, tax and shipping and reconcile exactly", () => {
  const m = orderMoney(makeOrder("1"));
  assert.equal(m.gross, 100);
  assert.equal(m.discount, 10);
  assert.equal(m.product, 90);
  assert.equal(m.tax, 9);
  assert.equal(m.revenue, 100);
  assert.equal(m.collected, 109);
  assert.equal(m.product + m.shipping + m.insurance + m.other, m.revenue);
});
test("partial refunds allocate tax and merchandise proportionally without counting them twice", () => {
  const m = orderMoney(
    makeOrder("1", { payment: "partially_refunded", refunded: 54.5 }),
  );
  assert.equal(m.refund, 54.5);
  assert.equal(m.tax, 4.5);
  assert.equal(m.product, 45);
  assert.equal(m.revenue, 50);
  assert.equal(m.collected, 54.5);
  assert.equal(m.productRefund, 45);
});
test("full refunds with no explicit refunded field retain gross and contribute zero net sales", () => {
  const m = orderMoney(
    makeOrder("1", { payment: "refunded", status: "refunded" }),
  );
  assert.equal(m.gross, 100);
  assert.equal(m.refund, 109);
  assert.equal(m.revenue, 0);
});
test("discount/refund allocation of product cents reconciles for uneven multiple lines", () => {
  const order = makeOrder("1", {
    lines: [
      { productId: "a", quantity: 1, unitPrice: 33.33, lot: "L" },
      { productId: "b", quantity: 2, unitPrice: 33.335, lot: "L" },
    ],
    refunded: 1.01,
    payment: "partially_refunded",
  });
  const rows = productSales([order], []);
  assert.equal(
    Math.round(rows.reduce((s, r) => s + r.net, 0) * 100),
    Math.round(orderMoney(order).product * 100),
  );
  assert.equal(
    rows.reduce((s, r) => s + r.units, 0),
    3,
  );
});
test("UTC date windows include the final day but never future records or the next midnight", () => {
  const data = fixture([
    makeOrder("start", { createdAt: "2026-09-01T00:00:00Z" }),
    makeOrder("end", { createdAt: "2026-09-25T23:59:59Z" }),
    makeOrder("future", { createdAt: "2026-09-26T00:00:00Z" }),
  ]);
  const a = analyze(data, dateWindow("2026-09-01", "2026-09-25"));
  assert.equal(a.current.paid, 2);
  assert.equal(a.current.revenue, 200);
  assert.equal(a.daily.length, 25);
  assert.throws(() => dateWindow("2026-02-31", "2026-03-02"));
  assert.throws(() => dateWindow("2026-09-02", "2026-09-01"));
});
test("profit uses net merchandise, current commissions and true calendar-month overhead", () => {
  const data = fixture([makeOrder("1")]);
  data.asOf = "2026-02-28T23:59:59.999Z";
  data.orders[0].createdAt = "2026-02-01T12:00:00Z";
  data.referrals = [
    {
      id: "r",
      partnerId: "a",
      orderId: "1",
      orderNumber: "1",
      createdAt: data.orders[0].createdAt,
      orderSubtotal: 90,
      commission: 9,
      status: "pending",
      via: "code",
    },
  ];
  const p = profit(data, dateWindow("2026-02-01", "2026-02-28"), {
    ...DEFAULT_COSTS,
    margin: 50,
    shippingPerOrder: 7,
    feePercent: 2,
    feeFixed: 0.3,
    overheadMonthly: 280,
    adSpend: 140,
  });
  assert.equal(p.overhead, 280);
  assert.equal(p.cogs, 45);
  assert.equal(p.commissions, 9);
  assert.equal(p.fees, 2.48);
  assert.equal(p.shipping, 7);
  assert.equal(p.ads, 140);
  assert.equal(p.net, -383.48);
});
test("UTC daily buckets reconcile when a source timestamp has an explicit local offset", () => {
  const data = fixture([
    makeOrder("offset", { createdAt: "2026-09-20T23:30:00-05:00" }),
  ]);
  const report = analyze(data, dateWindow("2026-09-20", "2026-09-21"));
  assert.equal(report.daily[0].revenue, 0);
  assert.equal(report.daily[1].revenue, 100);
  assert.equal(report.current.revenue, 100);
});
test("SKU costing reports missing costs instead of presenting incomplete profit as known", () => {
  const data = fixture([makeOrder("1")]);
  const p = profit(data, trailingWindow(data.asOf), {
    ...DEFAULT_COSTS,
    mode: "sku",
  });
  assert.equal(p.complete, false);
  assert.equal(p.missing[0].id, "p1");
  assert.equal(
    profit(data, trailingWindow(data.asOf), {
      ...DEFAULT_COSTS,
      mode: "sku",
      costs: { p1: 0 },
    }).complete,
    true,
  );
});
test("forecasts require enough history and orders; no data never becomes a confident zero", () => {
  const f = forecast(fixture(), DEFAULT_FORECAST);
  assert.equal(f.enough, false);
  assert.equal(f.coverage, 0);
  assert.ok(f.points.every((p) => p.value === 0));
  const data = fixture(
    Array.from({ length: 40 }, (_, i) =>
      makeOrder("o" + i, {
        createdAt: new Date(
          Date.parse("2026-09-25T12:00:00Z") - i * 86400000,
        ).toISOString(),
      }),
    ),
  );
  const base = forecast(data, DEFAULT_FORECAST);
  assert.equal(base.enough, true);
  assert.equal(base.dailyRevenue, 100);
  assert.equal(base.projected, 3000);
  assert.equal(base.monthActual, 2500);
  assert.equal(base.projectedMonth, 3000);
  const grow = forecast(data, { ...DEFAULT_FORECAST, demandChange: 20 });
  assert.ok(grow.projected > base.projected);
  assert.equal(
    forecast(data, { ...DEFAULT_FORECAST, basketChange: 20 }).average,
    120,
  );
  assert.ok(base.points.every((p) => p.low <= p.value && p.high >= p.value));
});
test("the current incomplete day is excluded from forecast training and remaining time is projected", () => {
  const data = fixture(
    Array.from({ length: 35 }, (_, i) =>
      makeOrder("o" + i, {
        createdAt: new Date(
          Date.parse("2026-09-25T08:00:00Z") - i * 86400000,
        ).toISOString(),
      }),
    ),
  );
  data.asOf = "2026-09-25T12:00:00Z";
  const f = forecast(data, DEFAULT_FORECAST);
  assert.equal(f.dailyRevenue, 100);
  assert.equal(f.projectedMonth, 3050);
});
test("replenishment excludes quarantined lots, preserves unknowns and accounts for incoming units", () => {
  const data = fixture([makeOrder("1")]);
  data.lots = [
    {
      lot: "held",
      productId: "p1",
      status: "quarantine",
      receivedAt: null,
      results: [],
      units: 500,
      sample: true,
    },
  ];
  assert.equal(stockPlan(data, DEFAULT_STOCK)[0].sellable, null);
  data.lots.push({
    lot: "ready",
    productId: "p1",
    status: "released",
    receivedAt: null,
    results: [],
    units: 2,
    sample: true,
  });
  let p = stockPlan(data, { ...DEFAULT_STOCK, lookback: 30 });
  assert.equal(p[0].sellable, 2);
  assert.equal(p[0].heldUnits, 500);
  assert.equal(p[0].suggested, 3);
  p = stockPlan(data, { ...DEFAULT_STOCK, onOrder: { p1: 100 } });
  assert.equal(p[0].suggested, 0);
});
test("retention deduplicates paid buyers and leaves incomplete cohort months unobserved", () => {
  const data = fixture([
    makeOrder("a"),
    makeOrder("b", { createdAt: "2026-09-23T00:00:00Z" }),
    makeOrder("c", { buyerId: "b2", payment: "authorized" }),
  ]);
  const h = customerHealth(data);
  assert.equal(h.customers, 1);
  assert.equal(h.repeat, 1);
  assert.equal(h.rows[0].ltv, 200);
  assert.equal(h.cohorts[0].cells[0], null);
});
test("CSV exports escape quotations, formulas and newlines; import previews handle quoted commas", () => {
  const csv = toCsv(
    ["name", "amount"],
    [
      ['=HYPERLINK("bad")', 12],
      ['two, "quotes"\nnew line', -4],
    ],
  );
  const rows = parseCsv(csv);
  assert.equal(rows[1][0], '\'=HYPERLINK("bad")');
  assert.equal(rows[2][0], 'two, "quotes"\nnew line');
  assert.equal(rows[2][1], "-4");
  assert.throws(() => parseCsv('name\n"unclosed'));
  assert.throws(() => parseCsv("x".repeat(2_000_001)));
});

test("many small product allocations never produce a negative final line and conserve every cent", () => {
  const lines = Array.from({ length: 20 }, (_, i) => ({
    productId: "p" + i,
    quantity: 1,
    unitPrice: 0.01,
    lot: "L",
  }));
  const o = makeOrder("small", {
    lines,
    subtotal: 0.2,
    total: 0.1,
    discount: { code: "HALF", amount: 0.1 },
    tax: 0,
    shipping: { method: "cold-2day", price: 0 },
  });
  const rows = productSales([o], []);
  assert.ok(rows.every((r) => r.net >= 0));
  assert.equal(Math.round(rows.reduce((n, r) => n + r.net, 0) * 100), 10);
});
test("daily profit sums reconcile to entered ad budgets and full calendar overhead to the penny", () => {
  const data = fixture([makeOrder("1")]);
  data.asOf = "2026-09-30T23:59:59.999Z";
  const p = profit(data, dateWindow("2026-09-01", "2026-09-30"), {
    ...DEFAULT_COSTS,
    adSpend: 100.01,
    overheadMonthly: 1000,
  });
  assert.equal(p.ads, 100.01);
  assert.equal(p.overhead, 1000);
  assert.equal(
    Math.round(p.daily.reduce((n, d) => n + d.cogs, 0) * 100),
    Math.round(p.cogs * 100),
  );
  assert.equal(
    Math.round(p.daily.reduce((n, d) => n + d.net, 0) * 100),
    Math.round(
      (p.report.current.revenue -
        p.cogs -
        p.shipping -
        p.fees -
        p.commissions -
        1100.01) *
        100,
    ),
  );
});
test("account import validates duplicates without approving anyone or inferring marketing consent", () => {
  const rows = contactImport(
    "name,email,institution\nA,A@EXAMPLE.TEST,Lab\nB,a@example.test,Lab\nC,b@example.test,Lab\nD,bad,",
    [{ email: "b@example.test" }],
    "customers",
    fixture().asOf,
  );
  assert.equal(rows[0].problem, "");
  assert.match(rows[1].problem, /Duplicate/);
  assert.match(rows[2].problem, /Already recorded/);
  assert.match(rows[3].problem, /Invalid email/);
  assert.throws(() =>
    contactImport(
      "email,email\na@x.test,b@x.test",
      [],
      "customers",
      fixture().asOf,
    ),
  );
});
test("subscriber imports require an explicit source and valid, non-future consent time", () => {
  const rows = contactImport(
    "name,email,consent_at,source\nA,a@x.test,2026-09-24T10:00:00Z,Newsletter\nB,b@x.test,2026-09-26T10:00:00Z,Newsletter\nC,c@x.test,2026-02-31T10:00:00Z,Newsletter\nD,d@x.test,2026-09-24T10:00:00Z,",
    [],
    "subscribers",
    fixture().asOf,
  );
  assert.equal(rows[0].problem, "");
  assert.match(rows[1].problem, /non-future/);
  assert.match(rows[2].problem, /timestamp/);
  assert.match(rows[3].problem, /source required/);
});
test("suppressed contacts and contacts without valid consent never enter the campaign audience", () => {
  const base = {
    id: "1",
    name: "A",
    email: "a@x.test",
    consentAt: "2026-09-01T00:00:00Z",
    source: "Newsletter",
    status: "subscribed" as const,
    reason: "",
  };
  assert.equal(
    campaignAudience(
      [
        base,
        { ...base, id: "2", email: "suppressed@x.test", status: "suppressed" },
        { ...base, id: "3", email: "missing@x.test", source: "" },
        {
          ...base,
          id: "4",
          email: "future@x.test",
          consentAt: "2026-10-01T00:00:00Z",
        },
      ],
      fixture().asOf,
    ).length,
    1,
  );
  assert.equal(
    campaignAudience(
      [base, { ...base, id: "duplicate", email: "A@X.TEST" }],
      fixture().asOf,
    ).length,
    1,
  );
  assert.equal(
    campaignAudience(
      [base, { ...base, id: "suppression", status: "suppressed" }],
      fixture().asOf,
    ).length,
    0,
  );
});
test("shipping eligibility refuses already shipped, uncollected, refunded and incomplete-address orders", () => {
  assert.equal(readyToShip(makeOrder("ready")), true);
  for (const status of [
    "placed",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ] as const)
    assert.equal(readyToShip(makeOrder(status, { status })), false);
  assert.equal(
    readyToShip(makeOrder("unpaid", { payment: "authorized" })),
    false,
  );
  assert.equal(
    readyToShip(makeOrder("returned", { payment: "refunded", refunded: 109 })),
    false,
  );
  const noAddress = makeOrder("address");
  noAddress.address = { ...noAddress.address, country: "" };
  assert.equal(readyToShip(noAddress), false);
});
test("reward estimates enforce minimum redemption and cannot create negative balances", () => {
  const rules = {
    enabled: false,
    perDollar: 2,
    pointsPerDollar: 100,
    minPoints: 500,
    maxPercent: 10,
    adjustments: {},
  };
  assert.deepEqual(rewardEstimate(100, rules), {
    earned: 200,
    balance: 200,
    credit: 0,
  });
  assert.deepEqual(rewardEstimate(300, rules, -700), {
    earned: 600,
    balance: 0,
    credit: 0,
  });
  assert.equal(rewardEstimate(300, rules).credit, 6);
});
test("owner assistant uses the same captured revenue and refund basis as the dashboard", () => {
  const data = fixture([
    makeOrder("paid"),
    makeOrder("unpaid", { payment: "authorized" }),
    makeOrder("partial", { payment: "partially_refunded", refunded: 54.5 }),
  ]);
  const summary = businessSummary(
    { ...data, products: [], partners: [] },
    "30d",
    data.asOf,
    true,
  );
  assert.equal(summary.revenue, salesTotals(data.orders).revenue);
  assert.equal(summary.revenue, 150);
});
