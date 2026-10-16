import { LIVE } from "../platform/mode";
import { Activity, BarChart3, BookOpen, Boxes, Building2, ChartNoAxesCombined, ClipboardCheck, Coins, FlaskConical, Gauge, Handshake, HeartHandshake, Inbox, LayoutDashboard, Mail, Megaphone, NotebookTabs, PackageSearch, Receipt, SearchCheck, Settings, ShieldCheck, Star, TicketPercent, Truck, Unplug, UsersRound } from "lucide-react";
import type { NavGroup, NavItem } from "../app-kit";

export const HOME = "/admin";

export const navGroups: NavGroup[] = [
  {
    label: "Operate",
    items: [
      { to: HOME, label: "Overview", icon: LayoutDashboard, end: true },
      { to: `${HOME}/orders`, label: "Orders", icon: Receipt },
      { to: `${HOME}/shipping`, label: "Shipping desk", icon: Truck },
      { to: `${HOME}/risk`, label: "Risk review", icon: ShieldCheck },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: `${HOME}/analytics`, label: "Sales analytics", icon: BarChart3 },
      { to: `${HOME}/forecasts`, label: "Forecasts & goals", icon: ChartNoAxesCombined },
      { to: `${HOME}/profit`, label: "Profit planner", icon: Coins },
      { to: `${HOME}/retention`, label: "Customer retention", icon: HeartHandshake },
      { to: `${HOME}/reports`, label: "Report builder", icon: NotebookTabs },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: `${HOME}/lots`, label: "Lots & certificates", icon: FlaskConical },
      { to: `${HOME}/journal`, label: "Journal", icon: BookOpen },
      { to: `${HOME}/products`, label: "Products & inventory", icon: Boxes },
      { to: `${HOME}/restock`, label: "Restock planning", icon: PackageSearch },
      { to: `${HOME}/discounts`, label: "Discount codes", icon: TicketPercent },
      { to: `${HOME}/reviews`, label: "Review moderation", icon: Star },
    ],
  },
  {
    label: "People",
    items: [
      { to: `${HOME}/applications`, label: "Applications", icon: ClipboardCheck },
      { to: `${HOME}/customers`, label: "Customers", icon: Building2 },
      { to: `${HOME}/partners`, label: "Partners", icon: Handshake },
      { to: `${HOME}/programs`, label: "Customer programs", icon: UsersRound },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: `${HOME}/traffic`, label: "Traffic & funnel", icon: Gauge },
      { to: `${HOME}/marketing`, label: "Marketing & audience", icon: Megaphone },
      { to: `${HOME}/seo`, label: "Search readiness", icon: SearchCheck },
      { to: `${HOME}/inbox`, label: "Inbox", icon: Inbox },
      { to: `${HOME}/messages`, label: LIVE ? "Sent messages" : "Email & SMS", icon: Mail },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: `${HOME}/integrations`, label: "Integrations", icon: Unplug },
      { to: `${HOME}/activity`, label: "Activity log", icon: Activity },
      { to: `${HOME}/setup`, label: "Launch readiness", icon: ClipboardCheck },
      { to: `${HOME}/docs`, label: "Handbook", icon: BookOpen },
    ],
  },
];

export const footerNav: NavItem[] = [{ to: `${HOME}/settings`, label: "Settings", icon: Settings }];

type SearchMode = { placeholder: string; label: string; mode: "filter" | "jump" };

export type PageInfo = { title: string; search: SearchMode | null };

const pages: Record<string, PageInfo> = {
  "": { title: "Overview", search: { placeholder: "Find an order", label: "Find an order by number, buyer or institution", mode: "jump" } },
  orders: { title: "Orders", search: { placeholder: "Search orders", label: "Search orders by number, buyer, institution, lot or code", mode: "filter" } },
  inbox: { title: "Inbox", search: null },
  messages: { title: LIVE ? "Sent messages" : "Email & SMS", search: null },
  lots: { title: "Lots & certificates", search: { placeholder: "Search lots", label: "Search lots by lot number or compound", mode: "filter" } },
  journal: { title: "Journal", search: { placeholder: "Search articles", label: "Search articles by title, slug or topic", mode: "filter" } },
  products: { title: "Products & inventory", search: { placeholder: "Search products", label: "Search products by compound, size, category or lot", mode: "filter" } },
  discounts: { title: "Discount codes", search: { placeholder: "Search codes", label: "Search discount codes by code or partner", mode: "filter" } },
  applications: { title: "Applications", search: { placeholder: "Search applications", label: "Search applications by name, institution or research area", mode: "filter" } },
  customers: { title: "Customers", search: { placeholder: "Search customers", label: "Search customers by name, institution, role or email", mode: "filter" } },
  partners: { title: "Partners", search: { placeholder: "Search partners", label: "Search partners by name, handle, code or email", mode: "filter" } },
  settings: { title: "Settings", search: null },
  analytics: { title: "Sales analytics", search: null },
  forecasts: { title: "Forecasts & goals", search: null },
  profit: { title: "Profit planner", search: null },
  retention: { title: "Customer retention", search: null },
  reports: { title: "Report builder", search: null },
  restock: { title: "Restock planning", search: null },
  shipping: { title: "Shipping desk", search: null },
  risk: { title: "Risk review", search: null },
  traffic: { title: "Traffic & funnel", search: null },
  marketing: { title: "Marketing & audience", search: null },
  programs: { title: "Customer programs", search: null },
  reviews: { title: "Review moderation", search: null },
  seo: { title: "Search readiness", search: null },
  integrations: { title: "Integrations", search: null },
  activity: { title: "Activity log", search: null },
  setup: { title: "Launch readiness", search: null },
  docs: { title: "Handbook", search: null },
};

export function pageFor(pathname: string): PageInfo {
  const segment = pathname.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
  return pages[segment] ?? { title: "Not found", search: null };
}
