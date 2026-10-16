import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "../../src/styles.css";
import { AppShell, Button, Drawer, Section, statusLabel } from "../../src/app-kit";
import * as seed from "../../src/platform/seed";
import { sampleCatalog } from "../../src/data";
import { intelligenceScreens } from "../../src/admin/intelligence/screens";
import { navGroups, pageFor } from "../../src/admin/nav";
import { BusinessProvider } from "../../src/admin/intelligence/shared";
import "../../src/admin/admin.css";
import "../../src/admin/intelligence/intelligence.css";
import "./lab.css";

import { ShippingDesk } from "../../src/admin/intelligence/Operations";
import { Fulfilment } from "../../src/admin/fulfilment";
import type { Order } from "../../src/platform/types";
import { MarketingLab, ProgramsLab } from "./connected";

type Settings = {
  theme: "violet" | "night" | "day";
  density: "comfortable" | "compact";
  chart: number;
};
const presets: Record<string, Settings> = {
  "TrueMark command": { theme: "violet", density: "comfortable", chart: 230 },
  "Finance workbench": { theme: "night", density: "compact", chart: 260 },
  "Owner’s brief": { theme: "day", density: "comfortable", chart: 200 },
};
const valid = (s: unknown): s is Settings =>
  Boolean(s) &&
  typeof s === "object" &&
  ["violet", "night", "day"].includes((s as Settings).theme) &&
  ["comfortable", "compact"].includes((s as Settings).density) &&
  Number.isFinite((s as Settings).chart);
function Lab() {
  const location = useLocation();
  const [settings, setSettings] = useState<Settings>(
      presets["TrueMark command"],
    ),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [status, setStatus] = useState("");
  const [saved, setSaved] = useState<{ name: string; settings: Settings }[]>(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem("tm-command-lab-variations-v1") ?? "[]",
        ).filter(
          (s: { name: unknown; settings: unknown }) =>
            typeof s.name === "string" && valid(s.settings),
        );
      } catch {
        return [];
      }
    },
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-command-theme", settings.theme);
    return () => document.documentElement.removeAttribute("data-command-theme");
  }, [settings.theme]);
  const brief = `TrueMark command center. Match the RUObuilt admin’s control coverage while retaining TrueMark’s Poppins/Heros typography and existing app-kit. Theme: ${settings.theme}; density: ${settings.density}; chart height: ${settings.chart}px. Sales count captured payments, deduct current refunds, separate tax, and preserve unknowns. Forecasts expose demand, basket, range and goal assumptions. Profit distinguishes estimated costs from recorded revenue. Every preview record is fictional; no provider or database writes are made by this lab.`;
  const groups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        intelligenceScreens.some((s) => i.to === `/admin/${s.path}`),
      ),
    }))
    .filter((g) => g.items.length);
  groups.push({ label: "Connected test scenes", items: [
    {to:"/admin/connected-marketing",label:"Shared marketing",icon:groups[0].items[0].icon},
    {to:"/admin/connected-programs",label:"Shared programs",icon:groups[0].items[0].icon},
  ] });
  const title = location.pathname.includes("connected-") ? "Backend test workflows" : pageFor(location.pathname).title;
  return (
    <div
      className="bi-lab-preview"
      data-density={settings.density}
      style={
        { "--bi-chart-height": `${settings.chart}px` } as React.CSSProperties
      }
    >
      <AppShell
        theme={settings.theme}
        label="Command lab"
        home="/admin/analytics"
        title={title}
        nav={groups}
        tools={<span className="kit-tag">Sample data · isolated lab</span>}
      >
        <BusinessProvider
          scope="command-lab"
          fixture={{
            orders: seed.orders,
            buyers: [...seed.buyers, {...seed.buyers[0],id:"00000000-0000-4000-8000-000000000003",name:"Fixture researcher",email:"buyer@fixture.test"}],
            products: [...sampleCatalog],
            lots: seed.lots,
            partners: seed.partners,
            referrals: seed.referrals,
            asOf: `${seed.TODAY}T23:59:59.999Z`,
          }}
        >
          <Routes>
            <Route path="/admin/connected-marketing" element={<MarketingLab />} />
            <Route path="/admin/connected-programs" element={<ProgramsLab />} />
            {intelligenceScreens.map((s) => (
              <Route
                key={s.path}
                path={`/admin/${s.path}`}
                element={s.path === "shipping" ? <ShippingDesk renderOrder={(id, close) => <PackingLabDrawer key={id} id={id} onClose={close} />} /> : s.element}
              />
            ))}
            <Route
              path="*"
              element={
                <p>
                  This supporting page opens in the integrated dashboard. Use
                  the lab navigation to keep exploring the new tools.
                </p>
              }
            />
          </Routes>
        </BusinessProvider>
      </AppShell>
      <button
        className="bi-lab-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Hide lab controls" : "Design lab controls"}
      </button>
      {open && (
        <aside className="bi-lab-controls">
          <h2>Command center study</h2>
          <p>Same TrueMark kit. New business controls.</p>
          <label>
            Starting direction
            <select
              value={
                Object.keys(presets).find(
                  (k) =>
                    JSON.stringify(presets[k]) === JSON.stringify(settings),
                ) ?? "custom"
              }
              onChange={(e) => setSettings(presets[e.target.value] ?? settings)}
            >
              {Object.keys(presets).map((k) => (
                <option key={k}>{k}</option>
              ))}
              <option value="custom" disabled>
                Custom
              </option>
            </select>
          </label>
          <label>
            Density
            <select
              value={settings.density}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  density: e.target.value as Settings["density"],
                })
              }
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label>
            Chart height · {settings.chart}px
            <input
              type="range"
              min="180"
              max="340"
              step="10"
              value={settings.chart}
              onChange={(e) =>
                setSettings({ ...settings, chart: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Variation name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </label>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              const next = [
                ...saved,
                { name: name.trim(), settings: { ...settings } },
              ];
              setSaved(next);
              try {
                localStorage.setItem(
                  "tm-command-lab-variations-v1",
                  JSON.stringify(next),
                );
                setStatus("Variation saved on this device.");
              } catch {
                setStatus(
                  "Saved in this tab only; browser storage is unavailable.",
                );
              }
              setName("");
            }}
          >
            Save variation
          </Button>
          {saved.map((s, i) => (
            <button key={i} onClick={() => setSettings(s.settings)}>
              {s.name} ↗
            </button>
          ))}
          <label>
            Live design brief
            <textarea readOnly value={brief} />
          </label>
          <Button
            onClick={() =>
              navigator.clipboard
                .writeText(brief)
                .then(() => setStatus("Design brief copied."))
                .catch(() => setStatus("Select and copy the brief above."))
            }
          >
            Copy brief
          </Button>
          <Button onClick={() => setSettings(presets["TrueMark command"])}>
            Reset view
          </Button>
          <p role="status">{status}</p>
        </aside>
      )}
    </div>
  );
}
createRoot(document.getElementById("command-lab")!).render(
  <MemoryRouter initialEntries={["/admin/analytics"]}>
    <Lab />
  </MemoryRouter>,
);

/** Shipping action study: all changes stay in this mounted drawer. */
function PackingLabDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [order, setOrder] = useState<Order | undefined>(() => seed.orders.find((o) => o.id === id));
  const [message, setMessage] = useState("");
  if (!order) return <Drawer title="Order unavailable" onClose={onClose}>Choose another sample order.</Drawer>;
  return <Drawer title={order.number} eyebrow="Shipping desk · isolated sample" onClose={onClose}
    footer={<Fulfilment order={order} onDone={setMessage} onAdvance={async (_id, status, extra) => {
      setOrder((o) => o && ({ ...o, status, shipping: { ...o.shipping, ...extra },
        events: [...o.events, { status, at: new Date().toISOString(), note: extra.note }] }));
    }} />}>
    <Section title="Packing list">
      <p>{order.address.institution}</p>
      <p role="status">{statusLabel(order.status)}</p>
      <dl className="bi-ledger">{order.lines.map((line) => <div key={line.productId}>
        <dt>{sampleCatalog.find((p) => p.id === line.productId)?.name ?? line.productId}<span className="bi-cell-note">Lot {line.lot}</span></dt>
        <dd>{line.quantity} units</dd>
      </div>)}</dl>
    </Section>
    {message && <p role="status">{message}</p>}
    <p className="cc-footnote">Sample workflow only. No provider calls. Changes reset when this drawer closes.</p>
  </Drawer>;
}
