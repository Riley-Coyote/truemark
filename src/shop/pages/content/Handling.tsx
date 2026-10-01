import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { assetUrl } from "../../../assetUrl";
import { Track } from "../../../brand/Track";
import type { TrackStop } from "../../../brand/Track";
import { useReveal } from "../../motion";
import { productById, productCutout } from "../../catalog";
import "../../../brand/hero.css";
import "../../../brand/handling.css";

/*
 * The client's Handling page, in the client's order and words: the opening,
 * storage (cold, sealed, and documented), shipping and the cold chain, and the
 * closing prompt to verify each vial's lot.
 */

/** A scene photograph at both of its sizes. */
function scene(name: string, width: number) {
  return {
    src: assetUrl(`images/scenes/${name}.webp`),
    srcSet: `${assetUrl(`images/scenes/${name}-sm.webp`)} ${width / 2}w, ${assetUrl(`images/scenes/${name}.webp`)} ${width}w`,
  };
}

const coldChain: TrackStop[] = [
  {
    title: "Insulated packaging",
    text: "When applicable, vials ship in insulated packs sized to the transit time, with gel packs rated for the route.",
  },
  {
    title: "Delivery",
    text: "Orders ship with signature on delivery.",
  },
  {
    title: "On arrival",
    text: "Move vials to −20 °C promptly, check seals, and verify each lot number against its CoA.",
  },
];

function Opening() {
  const backdrop = scene("cold-storage", 1344);
  const art = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number }>();
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(entry.contentRect.width, entry.contentRect.height * 1344 / 752);
      setBox({ width, height: width * 752 / 1344 });
    });
    if (art.current) observer.observe(art.current);
    return () => observer.disconnect();
  }, []);
  const vials = [
    { id: "ghk-cu-100-mg", x: 42, phone: 40 },
    { id: "melanotan-ii-10-mg", x: 51 },
    { id: "nad-500-mg", x: 60 },
    { id: "bpc-157-10-mg", x: 69, phone: 50 },
    { id: "tesamorelin-10-mg", x: 78, phone: 60 },
  ];
  return (
    <section className="tm tm-handling-open" aria-labelledby="tm-handling-title">
      <div className="tm-handling-art" ref={art}>
        <div className="tm-handling-scene" style={box}>
          <img className="tm-handling-open-photo" src={backdrop.src} srcSet={backdrop.srcSet}
            sizes="100vw" width={1344} height={752} alt="TrueMark vials on a cold-storage shelf." fetchPriority="high" />
        </div>
      </div>
      {/* The vials stand above the paper mist, so their labels stay crisp; the mist only softens the steel. */}
      <div className="tm-handling-cast" aria-hidden="true">
        <div className="tm-handling-scene" style={box}>
          {vials.map(({ id, x, phone }) => {
            const product = productById(id);
            return product && <span key={id} className={`tm-handling-vial${phone ? "" : " is-desktop"}`}
              style={{ "--tm-cold-x": `${x}%`, "--tm-cold-phone-x": `${phone ?? x}%` } as CSSProperties}>
              <span className="tm-shelf-shadow" aria-hidden="true" />
              <img src={productCutout(product, "lg")} alt="" draggable={false} />
            </span>;
          })}
        </div>
      </div>
      <header className="tm-handling-open-head">
        <p className="tm-eyebrow">Handling</p>
        <h1 id="tm-handling-title" className="tm-handling-open-title">
          Storage and
          <br />
          handling
        </h1>
      </header>
      <p className="tm-handling-open-lead">
        Lyophilized peptides are stable when stored correctly and unforgiving when they are not. The conditions
        below preserve the tested purity of each lot from our freezer to yours.
      </p>
    </section>
  );
}

function Storage() {
  const powder = scene("powder-blue", 1600);
  return (
    <section id="storage" className="tm tm-handling-storage" aria-labelledby="tm-handling-storage-title">
      <header className="tm-handling-storage-head" data-reveal>
        <p className="tm-eyebrow">Storage</p>
        <h2 id="tm-handling-storage-title" className="tm-heading">
          Cold, sealed,
          <br />
          <span>and documented</span>
        </h2>
      </header>

      <div className="tm-handling-rule tm-handling-cold" data-reveal>
        <p className="tm-handling-rule-label">Temperature</p>
        <h3 className="tm-handling-cold-title">
          <span className="tm-handling-cold-at">Store at</span>{" "}
          <span className="tm-handling-cold-figure">
            −20<span className="tm-handling-cold-unit">&nbsp;°C</span>
          </span>
        </h3>
        <p className="tm-handling-rule-text">
          Keep sealed vials frozen until use. Short transit and receiving periods at 2–8&nbsp;°C are acceptable.
        </p>
      </div>

      <div className="tm-handling-rule tm-handling-dry" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
        <div className="tm-handling-dry-photo">
          <img
            src={powder.src}
            srcSet={powder.srcSet}
            sizes="(max-width: 960px) 100vw, 45vw"
            width={1600}
            height={1062}
            alt="Lyophilized powder, close up."
            loading="lazy"
          />
        </div>
        <p className="tm-handling-rule-label">Light &amp; moisture</p>
        <h3 className="tm-handling-rule-title">Keep sealed and dark</h3>
        <p className="tm-handling-rule-text">
          Lyophilized powder is hygroscopic. Keep the crimp seal intact and protect vials from light.
        </p>
      </div>

      <div className="tm-handling-rule tm-handling-cycle" data-reveal>
        <p className="tm-handling-rule-label">Temperature cycling</p>
        <h3 className="tm-handling-rule-title">Avoid warm-cold cycles</h3>
        <p className="tm-handling-rule-text">
          Return vials to the freezer promptly. Let a sealed vial reach room temperature before opening to prevent
          condensation.
        </p>
      </div>

      <div className="tm-handling-rule tm-handling-record" data-reveal style={{ "--tm-i": 1 } as CSSProperties}>
        <p className="tm-handling-rule-label">Documentation</p>
        <h3 className="tm-handling-rule-title">Keep the lot number</h3>
        <p className="tm-handling-rule-text">
          Record each vial’s lot number in your laboratory records and retain its Certificate of Analysis.
        </p>
      </div>
    </section>
  );
}

function Shipping() {
  return (
    <section id="shipping" className="tm tm-night tm-handling-ship" aria-labelledby="tm-handling-ship-title">
      <header className="tm-handling-ship-head" data-reveal>
        <p className="tm-eyebrow">Shipping &amp; cold chain</p>
        <h2 id="tm-handling-ship-title" className="tm-heading">
          Cold from our freezer
          <br />
          <span>to your dock, when applicable</span>
        </h2>
      </header>
      <Track stops={coldChain} labelledBy="tm-handling-ship-title" theme="night" extend="start" />
      <div className="tm-handling-close" data-reveal>
        <p className="tm-handling-close-line">
          Checking a delivery?
          <br />
          <span>Verify each vial’s lot now.</span>
        </p>
        <Link className="tm-button tm-button-glow" to="/verify">
          Verify a lot
        </Link>
      </div>
    </section>
  );
}

export default function Handling() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  return (
    <div className="tm-page tm-handling" ref={root}>
      <Opening />
      <Storage />
      <Shipping />
    </div>
  );
}
