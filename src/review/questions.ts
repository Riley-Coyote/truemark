import type { Question } from "./types";

/**
 * Open questions for the client, written by Claude for Riley. Each `id` is also the `data-review` anchor on
 * the element the question is about; the layer pins a "?" there (or keeps it page-level when
 * the page has no such element).
 */
export const questions: Question[] = [
  {
    id: "membership",
    route: "/",
    title: "The membership section",
    prompt:
      "Your review lists a new “Membership section” to discuss. What do you have in mind: who it's for, and what members get?",
    allowText: true,
    placeholder: "Who it's for and what members get",
  },
  {
    id: "first-order-offer",
    route: "/products",
    title: "A first-order offer?",
    prompt:
      "The shop shows a sample offer: 10% off a first order with code FIRSTLOT. Keep it, change it, or remove it?",
    choices: ["Keep it as it is", "Keep it, with changes", "Remove it"],
    allowText: true,
    placeholder: "What should change",
  },
  {
    id: "product-tags",
    route: "/products",
    title: "Best seller and New tags",
    prompt:
      "BPC-157 carries a sample “Best seller” tag and GLOW a “New” tag. Which products should carry them?",
    allowText: true,
    placeholder: "e.g. Best seller: Retatrutide, BPC-157. New: GLOW",
  },
  {
    id: "lab-name",
    route: "/verify?lot=TM-BPC10-2609-01",
    title: "Name the laboratory?",
    prompt:
      "Certificates say “Contracted laboratory”. Can we name the testing lab, or should it stay unnamed?",
    choices: ["Name it", "Keep it unnamed"],
    allowText: true,
    placeholder: "The lab's name",
  },
  {
    id: "shipping-rates",
    route: "/checkout",
    title: "Shipping and carriers",
    prompt:
      "Checkout shows two sample cold-chain options: 2 business days at $24 and overnight at $42. Which carriers and prices do you use?",
    allowText: true,
    placeholder: "Carrier, service and price",
  },
  {
    id: "insurance",
    route: "/checkout",
    title: "Shipping insurance",
    prompt:
      "Your review asked for shipment insurance priced as a percentage of the order total. It's built and switched off until you decide. What rate, and should buyers choose it, or should every order include it?",
    choices: ["Buyers choose it (a checkbox)", "Every order includes it"],
    allowText: true,
    placeholder: "The rate, e.g. 2% of the order",
  },
  {
    id: "payment-processor",
    route: "/checkout",
    title: "Your payment processor",
    prompt:
      "Checkout is ready to connect to your payment processor; until then, payments are simulated. Which processor will you use, and where does the merchant account stand?",
    choices: ["Approved and ready", "Applied, waiting to hear", "Not chosen yet"],
    allowText: true,
    placeholder: "The processor's name",
  },
  {
    id: "partner-terms",
    route: "/partners",
    title: "Partner terms",
    prompt:
      "The partners page advertises sample terms: 12% commission, 10% off for a partner's audience, paid monthly on the 5th. What should it advertise? You can still set each partner's own commission and discount when you approve them.",
    allowText: true,
    placeholder: "Commission, audience discount, payout day",
  },
  {
    id: "partner-levels",
    route: "/partners/app",
    title: "Levels for partners?",
    prompt:
      "Partners stay motivated when there's something to reach for. Would you like levels — for example a higher commission after 25 referred orders?",
    choices: ["Yes, add levels", "Maybe later", "No levels"],
    allowText: true,
    placeholder: "Your thresholds and rates",
  },
  {
    id: "accounts-access",
    route: "/admin",
    title: "Access to your email, SMS and ShipStation",
    prompt:
      "To send order emails and texts (your item 20) and print ShipStation labels (item 21), we need access to your accounts. Which email and SMS services do you use? Could you invite us to them and to ShipStation?",
    choices: ["I'll send invites", "Help us choose a service"],
    allowText: true,
    placeholder: "The services you use",
  },
];

export const questionById = (id: string) => questions.find((q) => q.id === id);
