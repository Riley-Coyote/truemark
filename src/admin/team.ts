/** The command center's operators. Two fictional ones show the team; the real team is invited at launch. */
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
