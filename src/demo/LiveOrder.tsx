import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandDot } from "../brand/HeroShelf";
import { money } from "../data";
import { upsTracking } from "../platform/seed";
import { store } from "../platform/store";
import type { Order } from "../platform/types";
import "../shop/tokens.css";
import { demoBuyer as buyer, demoDraft, demoPartner as partner } from "./order";
import "./live.css";

/** An in-app route as a frame address: hash routes in production, paths in development. */
function frameUrl(path: string) {
  return import.meta.env.PROD ? `${import.meta.env.BASE_URL}#${path}` : path;
}

type Step = 0 | 1 | 2 | 3 | 4;

const steps: { title: string; text: string; action: string }[] = [
  {
    title: "A researcher follows Jordan's link",
    text: "Dr. Mara Ellison of Northfield Research Laboratory opens BPC-157 from a partner's link. The link carries Jordan's code to checkout.",
    action: "Place the order",
  },
  {
    title: "The order lands",
    text: "The command center hears it the moment it's placed. Jordan sees the commission, and the customer gets a confirmation.",
    action: "Pack and ship it",
  },
  {
    title: "It ships, cold",
    text: "Packed with gel packs rated for the route, then shipped with tracking. The customer can follow it without calling anyone.",
    action: "Deliver it",
  },
  {
    title: "It arrives, with its record",
    text: "Delivered to an institutional address, with the certificate for every lot waiting in the customer's account.",
    action: "Run it again",
  },
];

/** A live view of the platform, scaled to fit its column. */
function Frame({
  label,
  detail,
  src,
  width,
  height,
  lit,
  frameRef,
}: {
  label: string;
  detail: string;
  src: string;
  width: number;
  height: number;
  lit: boolean;
  frameRef?: React.RefObject<HTMLIFrameElement | null>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);
  return (
    <figure className={`tm-live-frame${lit ? " is-lit" : ""}`}>
      <figcaption>
        <span className="tm-live-frame-label">{label}</span>
        <span className="tm-live-frame-detail">{detail}</span>
      </figcaption>
      <div className="tm-live-screen" ref={box} style={{ height: height * scale } as CSSProperties}>
        <iframe
          ref={frameRef}
          title={label}
          src={src}
          style={{ width, height, transform: `scale(${scale})` } as CSSProperties}
        />
      </div>
    </figure>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="tm-live-pill">{children}</span>;
}

/**
 * One order, three views: the customer's phone, the owner's command center and
 * the partner's portal, side by side and live. Each step here calls the same
 * store the apps use, so every view reacts exactly as it would to a real order.
 */
export default function LiveOrder() {
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const customer = useRef<HTMLIFrameElement>(null);
  const [lit, setLit] = useState<"customer" | "owner" | "partner" | "all" | null>(null);

  useEffect(() => {
    document.title = "One order, three views — TrueMark BioLabs";
    try {
      // The customer is the sample researcher, signed in; the partner portal is open.
      localStorage.setItem("tm-preview-session", JSON.stringify(buyer.id));
      localStorage.removeItem("tm-preview-partner-signed-out");
    } catch {
      /* Without storage the frames still load; the customer may be asked to sign in. */
    }
  }, []);

  const showCustomer = (path: string) => {
    const frame = customer.current;
    if (frame) frame.src = frameUrl(path);
  };

  const flash = (who: typeof lit) => {
    setLit(who);
    window.setTimeout(() => setLit(null), 2600);
  };

  async function next() {
    if (busy) return;
    setBusy(true);
    try {
      if (step === 0 || step === 4) {
        const placed = await store.orders.place(buyer.id, demoDraft);
        setOrder(placed);
        showCustomer(`/checkout/confirmation/${placed.id}`);
        flash("all");
        setStep(1);
      } else if (step === 1 && order) {
        await store.orders.advance(order.id, "paid");
        await store.orders.advance(order.id, "packed", { note: "Packed cold, with gel packs rated for the route" });
        const shipped = await store.orders.advance(order.id, "shipped", { carrier: "UPS", tracking: upsTracking(Number(order.number.slice(3))) });
        setOrder(shipped);
        showCustomer(`/track/${order.number}`);
        flash("customer");
        setStep(2);
      } else if (step === 2 && order) {
        const delivered = await store.orders.advance(order.id, "delivered");
        setOrder(delivered);
        showCustomer(`/track/${order.number}`);
        flash("customer");
        setStep(3);
      } else if (step === 3) {
        setStep(4);
        setOrder(null);
        showCustomer(`/product/bpc-157-10-mg?ref=${partner.code}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const current = steps[step === 4 ? 0 : step];
  const shownStep = step === 4 ? 0 : step;

  return (
    <main className="tm-live brand-refinement">
      <header className="tm-live-head">
        <p className="tm-live-eyebrow">Live demo</p>
        <h1 className="tm-live-title">
          One order, three views
          <BrandDot />
        </h1>
        <p className="tm-live-lead">
          A researcher orders through a partner's link. Watch the owner hear it, the partner see
          what they earned, and the customer follow the parcel, all at once. Every view is the real
          platform, running live on this page.
        </p>
      </header>

      <div className="tm-live-stage">
        <section className="tm-live-script" aria-label="The story, step by step">
          <ol className="tm-live-steps">
            {steps.map((s, i) => (
              <li key={s.title} className={i === shownStep ? "is-current" : i < shownStep ? "is-done" : undefined}>
                <span className="tm-live-index">0{i + 1}</span>
                <span className="tm-live-step-title">{s.title}</span>
                {i === shownStep && <span className="tm-live-step-text">{s.text}</span>}
              </li>
            ))}
          </ol>
          <button type="button" className="tm-live-go" onClick={next} disabled={busy}>
            {busy ? "One moment" : current.action}
          </button>
          {order && (
            <p className="tm-live-order" aria-live="polite">
              <Pill>{order.number}</Pill>
              {money(order.total)} · via {partner.code} · {order.status}
            </p>
          )}
          <p className="tm-live-note">
            Sample data. Orders placed here stay in this browser. <Link to="/review">Back to the overview</Link>
          </p>
        </section>

        <Frame
          label="The customer"
          detail="Dr. Mara Ellison, ordering from a phone"
          src={frameUrl(`/product/bpc-157-10-mg?ref=${partner.code}`)}
          width={390}
          height={780}
          lit={lit === "customer" || lit === "all"}
          frameRef={customer}
        />

        <div className="tm-live-desks">
          <Frame
            label="The owner"
            detail="The command center"
            src={frameUrl("/admin/orders")}
            width={1280}
            height={760}
            lit={lit === "owner" || lit === "all"}
          />
          <Frame
            label="The partner"
            detail={`${partner.name}, ${partner.handle}`}
            src={frameUrl("/partners/app")}
            width={1280}
            height={760}
            lit={lit === "partner" || lit === "all"}
          />
        </div>
      </div>
    </main>
  );
}
