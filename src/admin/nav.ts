import { BookOpen, Boxes, Building2, ClipboardCheck, FlaskConical, Handshake, LayoutDashboard, Receipt, Settings, TicketPercent } from "lucide-react";
import type { NavGroup, NavItem } from "../app-kit";

export const HOME = "/admin";

export const navGroups: NavGroup[] = [
  {
    label: "Operate",
    items: [
      { to: HOME, label: "Overview", icon: LayoutDashboard, end: true },
      { to: `${HOME}/orders`, label: "Orders", icon: Receipt },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: `${HOME}/lots`, label: "Lots & certificates", icon: FlaskConical },
      { to: `${HOME}/journal`, label: "Journal", icon: BookOpen },
      { to: `${HOME}/products`, label: "Products & inventory", icon: Boxes },
      { to: `${HOME}/discounts`, label: "Discount codes", icon: TicketPercent },
    ],
  },
  {
    label: "People",
    items: [
      { to: `${HOME}/applications`, label: "Applications", icon: ClipboardCheck },
      { to: `${HOME}/customers`, label: "Customers", icon: Building2 },
      { to: `${HOME}/partners`, label: "Partners", icon: Handshake },
    ],
  },
];

export const footerNav: NavItem[] = [{ to: `${HOME}/settings`, label: "Settings", icon: Settings }];

type SearchMode = { placeholder: string; label: string; mode: "filter" | "jump" };

export type PageInfo = { title: string; search: SearchMode | null };

const pages: Record<string, PageInfo> = {
  "": { title: "Overview", search: { placeholder: "Find an order", label: "Find an order by number, buyer or institution", mode: "jump" } },
  orders: { title: "Orders", search: { placeholder: "Search orders", label: "Search orders by number, buyer, institution, lot or code", mode: "filter" } },
  lots: { title: "Lots & certificates", search: { placeholder: "Search lots", label: "Search lots by lot number or compound", mode: "filter" } },
  journal: { title: "Journal", search: { placeholder: "Search articles", label: "Search articles by title, slug or topic", mode: "filter" } },
  products: { title: "Products & inventory", search: { placeholder: "Search products", label: "Search products by compound, size, category or lot", mode: "filter" } },
  discounts: { title: "Discount codes", search: { placeholder: "Search codes", label: "Search discount codes by code or partner", mode: "filter" } },
  applications: { title: "Applications", search: { placeholder: "Search applications", label: "Search applications by name, institution or research area", mode: "filter" } },
  customers: { title: "Customers", search: { placeholder: "Search customers", label: "Search customers by name, institution, role or email", mode: "filter" } },
  partners: { title: "Partners", search: { placeholder: "Search partners", label: "Search partners by name, handle, code or email", mode: "filter" } },
  settings: { title: "Settings", search: null },
};

export function pageFor(pathname: string): PageInfo {
  const segment = pathname.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
  return pages[segment] ?? { title: "Not found", search: null };
}
