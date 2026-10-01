import { LIVE } from "../platform/mode";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { money } from "../data";
import { demoBuyer, demoDraft, demoPartner } from "../demo/order";
import { quote } from "../platform/store";
import { BrandDot } from "./HeroShelf";
import "./review-live.css";

function previewNotices() {
const order = quote(demoDraft);

/** The three notices the demo order sends, in the order they arrive. */
return [
  {
    who: "You · the command center",
    title: "New order",
    amount: money(order.total),
    body: `${demoBuyer.institution} · via ${demoPartner.code}`,
  },
  {
    who: `${demoPartner.name} · the partner portal`,
    title: "New order through your link",
    amount: `+${money(order.commission)}`,
    earned: true,
    body: `${money(order.base)} order · pending until delivered`,
  },
  {
    who: "The customer · on the phone",
    title: "Your order has shipped",
    body: `${order.method.label}, tracked to the door`,
  },
];
}
const notices = LIVE ? [] : previewNotices();

/**
 * 04 on the Overview: the live demo's door. One order's three notices arrive in
 * turn as the card comes into view, the way the demo itself plays out.
 */
export function ReviewLive() {
  return LIVE ? <Link className="rv-live" to="/review/live">This demo needs the preview world.</Link> : <PreviewReviewLive />;
}
function PreviewReviewLive() {
  const root = useRef<HTMLAnchorElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          seen.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, []);

  return (
    <Link ref={root} className={`rv-live${shown ? " is-shown" : ""}`} to="/review/live" aria-label="Watch one order, live">
      <div className="rv-live-copy">
        <p className="rv-live-eyebrow">04 · Live demo</p>
        <h2 className="rv-live-title">
          One order,
          <br />
          three views
          <BrandDot />
        </h2>
        <p className="rv-live-text">
          Place an order through a partner's link and watch it land everywhere at once: the command
          center hears it, the partner sees what they earned, and the customer follows the parcel.
        </p>
        <span className="rv-live-action">
          Watch one order <ArrowUpRight size={17} strokeWidth={1.6} aria-hidden="true" />
        </span>
      </div>
      <ol className="rv-live-stack" aria-label="What one order sends">
        {notices.map((n, i) => (
          <li key={n.who} className={`rv-live-notice${n.earned ? " is-earned" : ""}`} style={{ "--rv-i": i } as CSSProperties}>
            <span className="rv-live-who">
              {n.who}
              <span>now</span>
            </span>
            <span className="rv-live-line">
              <span className="rv-live-notice-title">{n.title}</span>
              {n.amount && <span className="rv-live-amount">{n.amount}</span>}
            </span>
            <span className="rv-live-body">{n.body}</span>
          </li>
        ))}
      </ol>
    </Link>
  );
}
