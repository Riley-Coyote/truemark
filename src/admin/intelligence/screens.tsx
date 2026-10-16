import {
  SalesAnalytics,
  Forecasts,
  Profitability,
  Retention,
  Reports,
} from "./Financials";
import {
  Restock,
  ShippingDesk,
  RiskDesk,
  ActivityLog,
  Handbook,
  LaunchReadiness,
} from "./Operations";
import { Traffic, Marketing, ConnectionsGuide } from "./Growth";
import { CustomerPrograms } from "./Programs";
import { Reviews, SearchReadiness } from "./Content";

export const intelligenceScreens = [
  { path: "analytics", element: <SalesAnalytics /> },
  { path: "forecasts", element: <Forecasts /> },
  { path: "profit", element: <Profitability /> },
  { path: "retention", element: <Retention /> },
  { path: "reports", element: <Reports /> },
  { path: "restock", element: <Restock /> },
  { path: "shipping", element: <ShippingDesk /> },
  { path: "risk", element: <RiskDesk /> },
  { path: "traffic", element: <Traffic /> },
  { path: "marketing", element: <Marketing /> },
  { path: "programs", element: <CustomerPrograms /> },
  { path: "reviews", element: <Reviews /> },
  { path: "seo", element: <SearchReadiness /> },
  { path: "integrations", element: <ConnectionsGuide /> },
  { path: "activity", element: <ActivityLog /> },
  { path: "setup", element: <LaunchReadiness /> },
  { path: "docs", element: <Handbook /> },
];
