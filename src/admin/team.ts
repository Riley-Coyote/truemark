/** Preview operators. Live membership comes from the team_members RPC. */
export type Operator = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "Owner" | "Fulfilment";
  can: string[];
  cannot: string[];
};

export const TEAM: Operator[] = [
  {
    id: "op-1",
    name: "Morgan Hale",
    initials: "MH",
    email: "morgan.hale@truemark.example",
    role: "Owner",
    can: ["Every section of the command center", "Payout batches and partner decisions", "Prices, discount codes and settings"],
    cannot: [],
  },
  {
    id: "op-2",
    name: "Dana Whitfield",
    initials: "DW",
    email: "dana.whitfield@truemark.example",
    role: "Fulfilment",
    can: ["Orders, from payment to delivery", "Lots and certificates", "Research account applications and customers"],
    cannot: ["Payout batches and partner decisions", "Prices, discount codes and settings"],
  },
];


/** Keep these aligned with the role checks in the applied platform RPCs. */
const SHARED_ACCESS = [
  "Read orders, customers, applications, partners and financial history",
  "Advance orders and review research and partner applications",
  "Edit products, prices, classes and stock",
  "Create and switch promo codes in Discounts",
  "Pause or resume partners and their codes",
  "Manage lots, certificates and Journal articles",
  "Read the team list and command-center alerts",
];
const OWNER_ACCESS = [
  "Approve commissions and record payouts",
  "Create promo codes through the assistant",
  "Change free-shipping, insurance and assistant settings",
  "Invite team members, revoke invitations and change team roles",
];
export const TEAM_PERMISSIONS = {
  owner: { can: [...SHARED_ACCESS, ...OWNER_ACCESS], cannot: ["Remove or demote the last owner"] },
  staff: { can: SHARED_ACCESS, cannot: OWNER_ACCESS },
};
