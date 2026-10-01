import type { Question } from "./types";

/**
 * Riley's questions for the client, verbatim. Each `id` is also the `data-review` anchor on
 * the element the question is about; the layer pins a "?" there (or keeps it page-level when
 * the page has no such element).
 */
export const questions: Question[] = [
  {
    id: "label-files",
    route: "/",
    title: "Two folders from your brand kit",
    prompt:
      "Your kit's readme lists 04 Vial Labels and 05 Product Images, but they weren't in the ZIP. Could you send them? They'll make the label close-ups sharper.",
    choices: ["I'll send them", "They're not ready yet"],
    allowText: true,
    placeholder: "Anything we should know",
  },
  {
    id: "qr-or-nfc",
    route: "/verify",
    title: "QR code or NFC?",
    prompt:
      "Your copy mentioned an NFC tag, but the labels show a QR code, so the site now says QR code everywhere. Is that right?",
    choices: ["Yes, QR code only", "Both: a QR code and an NFC tag", "Something else"],
    allowText: true,
    placeholder: "Tell us more",
  },
  {
    id: "cjc-dose",
    route: "/product/cjc-ipa-1010-mg",
    title: "CJC-1295 / Ipamorelin: which size?",
    prompt:
      "Your lot list says 5 mg / 5 mg (lot TM-CJI5-2609-01), but your current site sells 10 mg / 10 mg at $55. Which should we list, and at what price?",
    choices: ["5 mg / 5 mg", "10 mg / 10 mg", "Both sizes"],
    allowText: true,
    placeholder: "Price, and anything else",
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
    id: "partner-terms",
    route: "/partners",
    title: "Partner terms",
    prompt:
      "The program shows sample terms: 12% commission, 10% off for a partner's audience, paid monthly on the 5th. What should they be?",
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
    id: "partner-alerts",
    route: "/partners/app",
    title: "How should partners hear about a sale?",
    prompt:
      "When someone orders with a partner's code, the partner gets an alert showing what they earned. Which channels do you want?",
    choices: ["Email", "Text message", "In the dashboard"],
    multiple: true,
    allowText: true,
    placeholder: "Anything else",
  },
  {
    id: "owner-alerts",
    route: "/admin",
    title: "Your new-order alerts",
    prompt: "Who on your team should hear about every new order, and how?",
    allowText: true,
    placeholder: "Names, and email or text",
  },
  {
    id: "sign-in-gate",
    route: "/access",
    title: "Should the shop sit behind sign-in?",
    prompt:
      "Your current site asks every visitor to sign in before seeing products. Keep that, or let visitors browse and ask for an account only at checkout?",
    choices: ["Keep sign-in first", "Let visitors browse first"],
    allowText: true,
    placeholder: "Why",
  },
  {
    id: "account-approval",
    route: "/access/apply",
    title: "How should new accounts open?",
    prompt:
      "There are two paths: a quick sign-up with a research-use confirmation, and a fuller application you review first. Payment processors look more kindly on reviewed accounts. Which do you want?",
    choices: ["Quick sign-up", "Reviewed application", "Both"],
    allowText: true,
    placeholder: "Anything else",
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
    id: "contact-emails",
    route: "/contact",
    title: "Are these the right addresses?",
    prompt:
      "accounts@, orders@, quality@ and help@truemarkbiolabs.com — the addresses on your current site. Still right?",
    choices: ["Yes", "Some have changed"],
    allowText: true,
    placeholder: "The right addresses",
  },
];

export const questionById = (id: string) => questions.find((q) => q.id === id);
