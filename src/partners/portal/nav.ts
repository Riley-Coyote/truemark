import { BookCheck, LayoutDashboard, Link2, LogOut, Receipt, Settings, Wallet } from "lucide-react";
import type { NavGroup, NavItem } from "../../app-kit";

export const HOME = "/partners/app";

export const navGroups: NavGroup[] = [
  {
    label: "Program",
    items: [
      { to: HOME, label: "Overview", icon: LayoutDashboard, end: true },
      { to: `${HOME}/links`, label: "Links & codes", icon: Link2 },
      { to: `${HOME}/referrals`, label: "Referrals", icon: Receipt },
      { to: `${HOME}/payouts`, label: "Payouts", icon: Wallet },
    ],
  },
  {
    label: "Publishing",
    items: [{ to: `${HOME}/guidelines`, label: "Guidelines & assets", icon: BookCheck }],
  },
];

export const footerNav: NavItem[] = [
  { to: `${HOME}/settings`, label: "Settings", icon: Settings },
  { to: "/partners/sign-out", label: "Sign out", icon: LogOut },
];

const titles: Record<string, string> = {
  "": "Overview",
  links: "Links & codes",
  referrals: "Referrals",
  payouts: "Payouts",
  guidelines: "Guidelines & assets",
  settings: "Settings",
};

export function titleFor(pathname: string): string {
  const segment = pathname.replace(/^\/partners\/app\/?/, "").split("/")[0] ?? "";
  return titles[segment] ?? "Not found";
}
