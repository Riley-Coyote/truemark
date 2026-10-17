import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "/src/shop/tokens.css";
import { LIVE } from "/src/platform/mode.ts";
import { store } from "/src/platform/preview/store.ts";
import { safeWalkthroughPath } from "../client-walkthrough/routes.js";
import { createLandingScene } from "../client-walkthrough/landing-scene.js";
import catalog from "./inventory/catalog.json";
import { createCompareSync } from "./compare-sync.js";
import { startWallLight } from "/src/brand/wall-light.ts";
import "./universe.css";

const nav = [
  "Studio",
  "Storefront",
  "Platform",
  "Your assistant",
  "Landings",
  "Photography",
  "Record",
];
const sectionId = (name) => name === "Your assistant" ? "assistant" : name.toLowerCase();
const ghostRelease = "https://github.com/Riley-Coyote/truemark/releases/tag/ghost-v0.1.2-build5";
const ghostDownload = "https://github.com/Riley-Coyote/truemark/releases/download/ghost-v0.1.2-build5/TrueMark.Ghost.dmg";
const hero =
  "/design-photography/02-product-scenes/lilac-studio/corrected-lids-2026-10-01/collection--e577c975.webp";
const logo = "/images/brand/kit/lockup-black.svg";
const liveUrl = "https://riley-coyote.github.io/truemark/";
const scenes = {
  storefront: [
    ["Landing", "/?offer=off"],
    ["Catalog", "/products?offer=off"],
    ["Product", "/product/bpc-157-10-mg?offer=off"],
    ["Lot verification", "/verify?lot=TM-BPC10-2609-01"],
    ["Cart", "/cart"],
  ],
  account: [
    ["Overview", "/account"],
    ["Orders", "/account/orders"],
    ["Certificates", "/account/certificates"],
    ["Addresses", "/account/addresses"],
    ["Account details", "/account/profile"],
  ],
  partner: [
    ["Program", "/partners"],
    ["Application", "/partners/apply"],
    ["Portal", "/partners/app"],
    ["Links & codes", "/partners/app/links"],
    ["Referrals", "/partners/app/referrals"],
    ["Payouts", "/partners/app/payouts"],
    ["Guidelines", "/partners/app/guidelines"],
  ],
  owner: [
    ["Overview", "/admin"],
    ["Sales analytics", "/admin/analytics"],
    ["Forecasts & goals", "/admin/forecasts"],
    ["Profit planner", "/admin/profit"],
    ["Retention & cohorts", "/admin/retention"],
    ["Reports", "/admin/reports"],
    ["Orders", "/admin/orders"],
    ["Shipping desk", "/admin/shipping"],
    ["Restock planning", "/admin/restock"],
    ["Lots & certificates", "/admin/lots"],
    ["Applications", "/admin/applications"],
    ["Customers", "/admin/customers"],
    ["Partners", "/admin/partners"],
    ["Customer programs", "/admin/programs"],
    ["Marketing & audience", "/admin/marketing"],
    ["Traffic & funnel", "/admin/traffic"],
    ["Catalog", "/admin/products"],
    ["Discounts", "/admin/discounts"],
    ["Journal", "/admin/journal"],
    ["Settings", "/admin/settings"],
  ],
  messages: [
    ["Order confirmation", "/walkthrough-messages/buyer.order_confirmed.html"],
    ["Message library", "/walkthrough-messages/index.html"],
    ["Account confirmation", "/walkthrough-messages/confirm-signup.html"],
    ["Password recovery", "/walkthrough-messages/reset-password.html"],
  ],
};
const names = {
  account: "Research account",
  partner: "Partner portal",
  owner: "Owner workspace",
  messages: "Communications",
};
const systems = [
  ["procession", "Procession", "Selected"],
  ["reel", "Type reel", "Explored"],
  ["depth", "Depth lanes", "Explored"],
  ["folio", "Specimen folio", "Explored"],
  ["gallery", "Light gallery", "Explored"],
  ["collection", "Collection display", "Set aside"],
  ["studio", "Studio cards", "Superseded"],
  ["open", "Open composition", "Superseded"],
  ["material", "Material studies", "Superseded"],
];
const moneySize = (n) =>
  n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
const status = (s) =>
  ({
    historical: "Superseded",
    study: "Explored",
    corrected: "Lid-corrected",
    "client-supplied": "Original artwork",
    selected: "Selected",
  })[s] || s;
const readSaved = () => {
  try {
    return JSON.parse(
      localStorage.getItem("tm-universe-favorites-v1") || "[]",
    ).filter((x) => typeof x === "string");
  } catch {
    return [];
  }
};
const publicStudio =
  import.meta.env.PROD && import.meta.env.VITE_PUBLIC_STUDIO === "1";
const allowed =
  !LIVE &&
  (publicStudio ||
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) &&
  import.meta.env.VITE_REVIEW_SUPABASE_URL === "https://fixture.test" &&
  import.meta.env.VITE_REVIEW_SUPABASE_ANON_KEY === "fixture-anon";

function useHash() {
  const [hash, setHash] = useState(location.hash.slice(1) || "studio");
  useEffect(() => {
    const fn = () => setHash(location.hash.slice(1) || "studio");
    addEventListener("hashchange", fn);
    return () => removeEventListener("hashchange", fn);
  }, []);
  return hash;
}
function App() {
  const hash = useHash(),
    [section, sub = ""] = hash.split("/");
  const current = nav.map(sectionId).includes(section)
    ? section
    : "studio";
  const [menu, setMenu] = useState(false),
    [asset, setAsset] = useState(null),
    [favorites, setFavorites] = useState(readSaved),
    [feedback, setFeedback] = useState(""),
    [tune, setTune] = useState(false),
    [density, setDensity] = useState("roomy");
  const [runtime, setRuntime] = useState({ entries: [] });
  useEffect(() => {
    fetch("/design-lab/universe/inventory/runtime.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => r && setRuntime(r))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    document.title = `TrueMark — ${nav.find((n) => sectionId(n) === current)}`;
  }, [current]);
  const save = (id) =>
    setFavorites((previous) => {
      const next = previous.includes(id)
        ? previous.filter((x) => x !== id)
        : [...previous, id];
      try {
        localStorage.setItem("tm-universe-favorites-v1", JSON.stringify(next));
      } catch {
        setFeedback(
          "Selections remain in this session; browser storage is unavailable.",
        );
      }
      return next;
    });
  const brief = `TrueMark universe. Direction by Opus 5.5: one continuous lilac studio; original Poppins and TeX Gyre Heros; borderless plates. Seven sections: ${nav.join(", ")}. ${catalog.summary.photography} photographs, ${catalog.summary.designs} design records, ${catalog.summary.checkpoints} checkpoints. Collection density: ${density}. Saved selections: ${favorites.length}. Current storefront and fictional account/partner/owner demonstrations share the actual application. Payment setup belongs to the client’s specialist. Public presentation approved by Riley on 14 October 2026. Sample records only; original local source documents and conversations are excluded.`;
  const open = (item, items = [item]) => setAsset({ item, items });
  if (!allowed)
    return (
      <main className="u-page">
        <h1>Open the private studio preview.</h1>
        <p>
          This collection requires the isolated sample-data server. No live
          integrations are enabled.
        </p>
      </main>
    );
  return (
    <div className="u-app" data-density={density}>
      <a
        className="u-skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main").focus();
        }}
      >
        Skip to content
      </a>
      <header className="u-header">
        <a href="#studio" aria-label="TrueMark studio">
          <img src={logo} alt="TrueMark BioLabs" />
        </a>
        <nav
          id="studio-index"
          aria-label="Studio navigation"
          data-open={menu}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenu(false);
          }}
        >
          {nav.map((n) => (
            <a
              key={n}
              href={`#${sectionId(n)}`}
              aria-current={current === sectionId(n) ? "page" : undefined}
            >
              {n}
            </a>
          ))}
        </nav>
        <span className="u-private">
          {publicStudio ? "Design presentation" : "Local studio"} · sample data
        </span>
        <button
          className="u-index"
          aria-controls="studio-index"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? "Close" : "Index"}
        </button>
      </header>
      <main id="main" tabIndex="-1" inert={menu || undefined}>
        {current === "studio" && <Studio open={open} />}
        {current === "assistant" && <Assistant />}
        {current === "storefront" && (
          <Experience key="storefront" kind="storefront" />
        )}
        {current === "platform" && (
          <Experience
            key="platform"
            kind={Object.hasOwn(names, sub) ? sub : "account"}
          />
        )}
        {current === "landings" && <Landings runtime={runtime} open={open} />}
        {current === "photography" && (
          <Photography open={open} favorites={favorites} save={save} />
        )}
        {current === "record" && <Record open={open} runtime={runtime} />}
      </main>
      <footer className="u-footer">
        <img src={logo} alt="TrueMark BioLabs" />
        <p>The work, the world, and every detail.</p>
        <a href="#assistant">Get your Mac assistant ↗</a>
        <button onClick={() => setTune(true)}>Studio settings</button>
      </footer>
      {feedback && (
        <p role="status" className="u-toast">
          {feedback}
          <button aria-label="Dismiss" onClick={() => setFeedback("")}>
            ×
          </button>
        </p>
      )}
      {asset && (
        <Lightbox
          value={asset}
          close={() => setAsset(null)}
          select={(item) => setAsset({ ...asset, item })}
          favorites={favorites}
          save={save}
        />
      )}
      {tune && (
        <Modal title="Studio settings" close={() => setTune(false)}>
          <p>Opus’s studio direction, carried through the whole collection.</p>
          <label>
            Collection density
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value)}
            >
              <option value="roomy">Studio · spacious</option>
              <option value="compact">Archive · compact</option>
            </select>
          </label>
          <label>
            Design brief
            <textarea readOnly value={brief} />
          </label>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(brief)
                .then(() => setFeedback("Design brief copied."))
                .catch(() => setFeedback("Select and copy the brief above."))
            }
          >
            Copy design brief ↗
          </button>
          <a
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ schema: 1, density, favorites }, null, 2))}`}
            download="truemark-studio-selections.json"
          >
            Export saved selections ↓
          </a>
        </Modal>
      )}
    </div>
  );
}
function Intro({ kicker, title, children }) {
  return (
    <div className="u-intro">
      <p className="u-label">{kicker}</p>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
function Assistant() {
  return (
    <div className="u-page u-assistant">
      <Intro kicker="TrueMark Ghost · Mac app" title="Your business companion. Right beside you.">
        Call it over the app you’re using. Ask about what’s on screen, think through a decision,
        or pick up where you left off—with TrueMark knowledge already built in.
      </Intro>
      <section className="u-assistant-download" aria-labelledby="assistant-download-title">
        <div>
          <p className="u-label">Ready for your first test</p>
          <h2 id="assistant-download-title">Meet TrueMark Ghost.</h2>
          <p>Includes the TrueMark business guide, 19 specialist skills, and memory that gets to know how you work.</p>
          <a className="u-primary" href={ghostDownload}>Download for Mac <span aria-hidden="true">↓</span></a>
          <p className="u-assistant-meta">Version 0.1.2 · 127 MB · macOS 14 or newer<br />Apple silicon (M1 or newer) for local memory.</p>
          <a className="u-assistant-text-link" href={ghostRelease} target="_blank" rel="noreferrer">Release notes & complete setup guide ↗</a>
        </div>
        <div className="u-assistant-shortcut">
          <div aria-label="Option X" className="u-assistant-keys"><kbd>⌥</kbd><kbd>X</kbd></div>
          <h3>A little closer to everything.</h3>
          <p>A solid chat window by default. Press Option-X to call it over; Escape puts it away.</p>
        </div>
      </section>
      <section className="u-assistant-setup" aria-labelledby="assistant-setup-title">
        <div className="u-section-head"><h2 id="assistant-setup-title">A few minutes to make it yours.</h2><p>No API key or developer tools needed.</p></div>
        <ol className="u-assistant-steps">
          <li><span className="u-label">01 / Install</span><h3>Move it into Applications.</h3><p>Open the download, drag TrueMark Ghost into Applications, then open it from there. The full guide is inside the download as “Start here.txt.”</p></li>
          <li><span className="u-label">02 / Connect</span><h3>Sign in with Codex.</h3><p>Install the <a href="https://chatgpt.com/codex" target="_blank" rel="noreferrer">Codex desktop app ↗</a> if needed. In Ghost’s Setup, choose Connect Codex and sign into your own ChatGPT account with Codex access and available usage.</p></li>
          <li><span className="u-label">03 / Call it over</span><h3>Give it a view of your work.</h3><p>Allow screen and Accessibility permissions in Setup, then press Option-X. Try “Take a fresh look and tell me what’s on this page.”</p></li>
        </ol>
      </section>
      <div className="u-assistant-notes">
        <details><summary>What does it know, and what stays private?</summary><p>TrueMark’s business knowledge and skills are included. Your personal memory starts fresh; Riley’s conversations and credentials are not included. Memories and conversation records stay on your Mac. Messages, screen images and relevant recalled information are sent to Codex for answers, so an internet connection is needed.</p></details>
        <details><summary>Can it help change the website?</summary><p>Conversation, screen help and memory work after the setup above. To build website changes, connect GitHub in Codex and set up the TrueMark Cloud environment. The complete setup guide is on the <a href={ghostRelease} target="_blank" rel="noreferrer">release page ↗</a>. Changes come back for Riley’s review before anything goes live.</p></details>
        <p className="u-note">This is an early client test. Start with sample data and reversible actions; send Riley anything that feels unclear or doesn’t work as expected.</p>
      </div>
    </div>
  );
}
function StudioLight({ paused }) {
  const canvas = useRef(null);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let light;
    const start = () => {
      light?.stop();
      light = startWallLight(canvas.current, () => -innerHeight * 0.6, reduced.matches || paused);
      light?.setActive(!document.hidden);
    };
    const visibility = () => light?.setActive(!document.hidden);
    const redraw = () => light?.redraw();
    start();
    reduced.addEventListener("change", start);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("resize", redraw);
    window.addEventListener("scroll", redraw, { passive: true });
    return () => {
      light?.stop();
      reduced.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("resize", redraw);
      window.removeEventListener("scroll", redraw);
    };
  }, [paused]);
  return <canvas ref={canvas} className="u-studio-light" aria-hidden="true" />;
}
function PlatformCover() {
  const nodes = [
    { x: 40, y: 82, title: "Research accounts", detail: "Profiles · certificates", icon: "M-7 9v-3a7 7 0 0 1 14 0v3M0-3a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
    { x: 372, y: 82, title: "Orders", detail: "From placed to fulfilled", icon: "M-8-8H8V10H-8ZM-4-3H4M-4 2H4M-4 7H1" },
    { x: 40, y: 206, title: "Partner network", detail: "Referrals · relationships", icon: "M-7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6M7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6M-12 8V5a5 5 0 0 1 10 0v3M2 8V5a5 5 0 0 1 10 0v3" },
    { x: 372, y: 206, title: "Lots & records", detail: "Traceable at every step", icon: "M-7-10H7M-5-10V-3L-9 7Q-10 10-6 10H6Q10 10 9 7L5-3V-10M-6 3H6" },
  ];
  return <svg className="u-platform-cover" viewBox="0 0 600 400" role="img" aria-label="TrueMark connects research accounts, orders, partners and lot records in one business workspace">
    <defs>
      <linearGradient id="platform-room" x2="1" y2="1"><stop stopColor="#e9e3f2"/><stop offset=".48" stopColor="#d7cbe7"/><stop offset="1" stopColor="#c5b7d8"/></linearGradient>
      <linearGradient id="platform-glass" x2=".8" y2="1"><stop stopColor="#fff" stopOpacity=".86"/><stop offset="1" stopColor="#f4effb" stopOpacity=".5"/></linearGradient>
      <linearGradient id="platform-hub" x2="1" y2="1"><stop stopColor="#faf7ff"/><stop offset="1" stopColor="#ded3ed"/></linearGradient>
      <filter id="platform-shadow" x="-40%" y="-50%" width="180%" height="210%"><feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#493364" floodOpacity=".14"/></filter>
    </defs>
    <rect width="600" height="400" fill="url(#platform-room)"/>
    <path d="M310-70L60 470M410-70L160 470" stroke="#fff" strokeWidth="70" opacity=".12"/>
    <g fill="none" stroke="#78638f" strokeWidth="1.2" opacity=".5">
      <path d="M228 126H256Q270 126 270 144V168M372 126H344Q330 126 330 144V168M228 250H256Q270 250 270 236V232M372 250H344Q330 250 330 236V232"/>
      <circle cx="300" cy="200" r="73" strokeDasharray="2 6" opacity=".35"/>
    </g>
    {nodes.map(n => <g key={n.title} transform={`translate(${n.x} ${n.y})`}>
      <rect width="188" height="88" rx="14" fill="url(#platform-glass)" stroke="#fff" strokeOpacity=".7" filter="url(#platform-shadow)"/>
      <path d={n.icon} transform="translate(25 27)" fill="none" stroke="#5a4675" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="16" y="56" fontSize="16" fill="#302247">{n.title}</text>
      <text x="16" y="73" fontSize="9.5" fill="#756585">{n.detail}</text>
    </g>)}
    <rect x="249" y="157" width="102" height="86" rx="20" fill="url(#platform-hub)" stroke="#fff" filter="url(#platform-shadow)"/>
    <image href={logo} x="260" y="177" width="80" height="26"/>
    <text x="300" y="224" textAnchor="middle" fill="#756585" fontSize="8" letterSpacing="1.1">ONE WORKSPACE</text>
  </svg>;
}
function Studio({ open }) {
  const [lightPaused, setLightPaused] = useState(false);
  const tiles = [
    [
      "Storefront",
      "The latest experience.",
      "storefront",
      "/design-photography/02-product-scenes/lilac-studio/corrected-lids-2026-10-01/trio--8fa2bab6.webp",
      "Explore the website",
    ],
    [
      "Platform",
      "The business behind it.",
      "platform",
      null,
      "Account, partner & owner",
    ],
    [
      "Landings",
      "Every direction, in context.",
      "landings",
      "/design-photography/05-macros-and-materials/lilac-series-02/08-silver-fold--44eb08ab.png",
      `${catalog.summary.designs} preserved design records`,
    ],
    [
      "Photography",
      "A world made of details.",
      "photography",
      "/design-photography/05-macros-and-materials/lilac-series-01/02-silver-and-glass--8479180b.png",
      `${catalog.summary.photography} images · seven collections`,
    ],
    [
      "Record",
      "The path to here.",
      "record",
      "/design-photography/05-macros-and-materials/lilac-series-02/06-cap-constellation--8105b24e.png",
      `${catalog.summary.checkpoints} checkpoints · brand & films`,
    ],
  ];
  return (
    <>
      <StudioLight paused={lightPaused} />
      <section className="u-hero u-studio-hero">
        <img
          className="u-hero-image"
          src={hero}
          alt="Five TrueMark research vials arranged on lilac pedestals"
          fetchPriority="high"
        />
        <div className="u-hero-copy">
          <h1>
            Everything we’ve made
            <br className="u-hero-break" /> for TrueMark.
          </h1>
          <a className="u-primary" href="#storefront">
            Open the storefront <span>↗</span>
          </a>
          <a className="u-assistant-entry" href="#assistant">Meet your Mac assistant <span aria-hidden="true">↗</span></a>
          <div className="u-ledger">
            <span>1 live site</span>
            <span>1 latest build</span>
            <span>3 platform views</span>
            <span>{systems.length} class systems</span>
            <span>{catalog.summary.designs} design records</span>
            <span>{catalog.summary.photography} photographs</span>
            <span>{catalog.summary.films} films</span>
            <span>{catalog.summary.checkpoints} checkpoints</span>
            <button className="u-light-toggle" aria-pressed={lightPaused} onClick={() => setLightPaused(!lightPaused)}>{lightPaused ? "Resume light" : "Pause light"}</button>
          </div>
        </div>
      </section>
      <section className="u-page u-studio-collection">
        <div className="u-section-head">
          <h2>A connected world.</h2>
          <p>
            Explore the finished experience, or follow the work that brought it
            here.
          </p>
        </div>
        <div className="u-overview">
          {tiles.map(([title, desc, to, img, meta], i) => (
            <a
              className={`u-overview-card u-overview-${i}`}
              href={`#${to}`}
              key={to}
            >
              <div className="u-plate">
                {to === "platform" ? <PlatformCover /> : <img loading="lazy" src={img} alt="" />}
                <span className="u-cover-index" aria-hidden="true">0{i + 1} / {title}</span>
                <span className="u-plate-link">
                  Explore {title.toLowerCase()} ↗
                </span>
              </div>
              <div className="u-caption">
                <h3>{title}</h3>
                <span>{meta}</span>
              </div>
              <p>{desc}</p>
            </a>
          ))}
        </div>
        <div className="u-section-head">
          <h2>The identity, in motion.</h2>
          <a href="#record">Brand, films & communications ↗</a>
        </div>
        <div className="u-film-grid">
          {catalog.films
            .filter((f) => f.format === "wide")
            .map((f) => (
              <button key={f.id} onClick={() => open(f, catalog.films)}>
                <div className="u-plate">
                  <img loading="lazy" src={f.thumbnail} alt={f.title} />
                  <span className="u-play">Play film ↗</span>
                </div>
                <div className="u-caption">
                  <h3>{f.title}</h3>
                  <span>
                    {f.duration}s · {f.format}
                  </span>
                </div>
              </button>
            ))}
        </div>
        <p className="u-note">
          The platform uses fictional records for review. Orders, payments,
          email and shipments are not sent. Historical explorations and
          generated imagery are labeled separately.
        </p>
      </section>
    </>
  );
}
function Experience({ kind }) {
  const list = scenes[kind].map(([name, href]) => [name,
    import.meta.env.PROD && href.startsWith(import.meta.env.BASE_URL)
      ? "/" + href.slice(import.meta.env.BASE_URL.length) : href]),
    [step, setStep] = useState(0),
    [path, setPath] = useState(list[0][1]),
    [device, setDevice] = useState(() => innerWidth <= 700 ? "phone" : "desktop"),
    [focus, setFocus] = useState(false),
    [compare, setCompare] = useState(() => innerWidth > 1000),
    [linked, setLinked] = useState(true),
    [ready, setReady] = useState(false);
  const version = useRef(0);
  const [bridge] = useState(createCompareSync);
  useEffect(() => { bridge.setEnabled(compare && linked); }, [bridge, compare, linked]);
  useEffect(() => () => bridge.destroy(), [bridge]);
  const navigate = (p) => {
    setPath(p);
    setStep(list.findIndex(([, href]) =>
      new URL(href, location.origin).pathname === new URL(p, location.origin).pathname));
  };
  useEffect(() => {
    let active = true;
    const n = ++version.current;
    setReady(false);
    const prep =
      kind === "account"
        ? store.session.signIn("mara@example.test")
        : Promise.resolve();
    prep.then(() => {
      if (active && n === version.current) {
        setStep(0);
        setPath(list[0][1]);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [kind]);
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") setFocus(false);
    };
    addEventListener("keydown", fn);
    document.body.classList.toggle("u-focused", focus);
    return () => {
      removeEventListener("keydown", fn);
      document.body.classList.remove("u-focused");
    };
  }, [focus]);
  const go = (i) => {
    setStep(i);
    setPath(list[i][1]);
  };
  return (
    <section className={`u-page u-experience ${focus ? "is-focused" : ""}`}>
      <div className="u-experience-heading">
        <Intro
          kicker={
            kind === "storefront"
              ? "The latest website"
              : "The connected platform"
          }
          title={kind === "storefront" ? "TrueMark, in use." : names[kind]}
        >
          Browse freely, or follow the stops below. This is the actual interface
          with sample records.
        </Intro>
        {focus && (
          <button className="u-exit" onClick={() => setFocus(false)}>
            ← Exit focus
          </button>
        )}
      </div>
      {kind === "owner" && <div className="u-note" style={{marginBottom: "24px"}}>
        <a className="u-open-website" href="https://riley-coyote.github.io/truemark/live/#/admin/marketing" target="_blank" rel="noreferrer">Open connected test workspace ↗</a>
        <span style={{display:"block",marginTop:"8px"}}>Team sign-in required. Marketing, rewards and memberships save shared records there. Payments and marketing delivery are simulated for testing.</span>
      </div>}
      {kind !== "storefront" && (
        <nav className="u-stations" aria-label="Platform views">
          {Object.entries(names).map(([id, n]) => (
            <a
              href={`#platform/${id}`}
              aria-current={kind === id ? "page" : undefined}
              key={id}
            >
              {n}
            </a>
          ))}
        </nav>
      )}
      <div className="u-experience-layout">
        <aside className="u-scene-nav" aria-label="Guided stops">
          {list.map(([name], i) => (
            <button
              key={name}
              aria-current={step === i ? "step" : undefined}
              onClick={() => go(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {name}
              <span>↗</span>
            </button>
          ))}
        </aside>
        <div className="u-screen-area">
          <div className="u-tools">
            <div
              className="u-segment"
              role="group"
              aria-label="Preview viewport"
            >
              {["desktop", "phone"].map((d) => (
                <button
                  key={d}
                  aria-pressed={!compare && device === d}
                  onClick={() => { setDevice(d); setCompare(false); }}
                >
                  {d === "desktop" ? "Desktop" : "Phone"}
                </button>
              ))}
              <button
                aria-pressed={compare}
                onClick={() => setCompare(!compare)}
              >
                Compare
              </button>
            </div>
            <div>
              {kind === "storefront" && (
                <a className="u-open-website" href={`${liveUrl}#${path}`} target="_blank" rel="noreferrer">
                  Open website ↗
                </a>
              )}
              <button aria-pressed={focus} onClick={() => setFocus(!focus)}>
                {focus ? "Exit focus ↙" : "Focus ↗"}
              </button>
            </div>
          </div>
          {compare && <div className="u-compare-note">
            <div><strong>One experience. Two perspectives.</strong><span>Browse either view. Pages stay together.</span></div>
            <button className="u-sync-toggle" aria-pressed={linked} onClick={() => setLinked(!linked)}>
              <span aria-hidden="true">↔</span> {linked ? "Scroll linked" : "Link scrolling"}
            </button>
          </div>}
          <div className={`u-screens ${compare ? "u-dual" : ""}`}>
            {ready && (
              <Screen
                key={kind}
                path={path}
                title={list[step]?.[0] || "Explore TrueMark"}
                device={compare ? "desktop" : device}
                onEscape={() => setFocus(false)}
                onNavigate={navigate}
                bridge={bridge}
                fitHeight={focus}
                frameId="primary"
              />
            )}
            {ready && compare && (
              <Screen
                path={path}
                title={`${list[step]?.[0] || "Explore"} · phone`}
                device="phone"
                onNavigate={navigate}
                bridge={bridge}
                fitHeight={focus}
                frameId="phone"
                onEscape={() => setFocus(false)}
              />
            )}
          </div>
          <div className="u-screen-caption">
            <span className="u-label">
              Current experience · sample data
            </span>
            <div>
              <button
                onClick={() => go(Math.max(0, step - 1))}
                disabled={step <= 0}
              >
                ← Previous
              </button>
              <button
                onClick={() => go(Math.min(list.length - 1, step + 1))}
                disabled={step === list.length - 1}
              >
                Next stop →
              </button>
            </div>
          </div>
          <p className="u-note">
            {kind === "account"
              ? "Mara Ellison is a fictional research account. Address edits and sample orders stay in this browser."
              : kind === "owner"
                ? "Fictional walkthrough. Use Open connected test workspace above for shared marketing, reward wallets and membership checkout. Sign in with your team account."
                : kind === "partner"
                  ? "Fictional partner, referrals and earnings. No payouts are made."
                  : kind === "messages"
                    ? "Local proofs of the actual templates. No message is sent."
                    : "Payments are being connected separately by the client’s specialist. This preview collects no payment."}
          </p>
        </div>
      </div>
    </section>
  );
}
function Screen({
  path,
  title,
  device = "desktop",
  remote = false,
  onNavigate,
  onEscape,
  system,
  bridge,
  frameId,
  fitHeight = false,
}) {
  const ref = useRef(),
    host = useRef(),
    scene = useRef(),
    previousSource = useRef(""),
    initialSource = useRef(null),
    cleanup = useRef(() => {}),
    callbacks = useRef({ onNavigate, onEscape }),
    [scale, setScale] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  callbacks.current = { onNavigate, onEscape };
  const source = /^\/walkthrough-messages\//.test(path)
    ? `${import.meta.env.PROD ? import.meta.env.BASE_URL : "/"}${path.slice(1)}`
    : remote
    ? `${liveUrl}#${path}`
    : import.meta.env.PROD
      ? `${import.meta.env.BASE_URL}app.html${new URL(path, location.origin).search}#${path}`
      : path;
  if (initialSource.current === null) initialSource.current = source;
  useEffect(() => {
    const win = ref.current?.contentWindow;
    if (!win || !previousSource.current || previousSource.current === source) return;
    const isApp = !remote && !path.startsWith("/walkthrough-messages/");
    try {
      if (isApp && win.document.querySelector(".tm-views")) {
        const current = win.location.hash.startsWith("#/")
          ? win.location.hash.slice(1) : win.location.pathname + win.location.search + win.location.hash;
        if (current !== path) win.dispatchEvent(new win.CustomEvent("tm-presentation-navigate", { detail: path }));
      } else if (win.location.href !== new URL(source, location.href).href) {
        ref.current.src = source;
      }
    } catch { ref.current.src = source; }
  }, [source, path, remote]);
  useEffect(() => {
    const el = host.current;
    const resize = () => setScale(Math.min(1,
      el.clientWidth / (device === "phone" ? 390 : 1440),
      fitHeight ? Math.max(300, innerHeight - 205) / (device === "phone" ? 844 : 900) : 1));
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    addEventListener("resize", resize);
    resize();
    return () => { ro.disconnect(); removeEventListener("resize", resize); };
  }, [device, fitHeight]);
  useEffect(() => {
    const sameDocument =
      previousSource.current &&
      (previousSource.current.split("#")[0] === source.split("#")[0] ||
        (!remote && !path.startsWith("/walkthrough-messages/") && ref.current?.contentDocument?.querySelector(".tm-views")));
    previousSource.current = source;
    if (sameDocument) {
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      if (ref.current?.contentDocument?.body?.textContent?.trim())
        setLoading(false);
      else setError(true);
    }, 18000);
    return () => clearTimeout(timer);
  }, [source]);
  useEffect(() => () => { scene.current?.destroy(); cleanup.current(); }, []);
  function loaded() {
    cleanup.current();
    setLoading(false);
    setError(false);
    try {
      const win = ref.current.contentWindow,
        doc = ref.current.contentDocument;
      if (!doc) return;
      const abort = new AbortController();
      const detach = !remote && bridge ? bridge.attach(frameId, win) : () => {};
      cleanup.current = () => { abort.abort(); detach(); };
      win.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !e.defaultPrevented && !doc.querySelector("[data-story]")) callbacks.current.onEscape?.();
      }, { signal: abort.signal });
      if (remote) return;
      if (import.meta.env.PROD)
        doc.addEventListener("click", (e) => {
          const a = e.target.closest?.("a[href]"),
            raw = a?.getAttribute("href");
          if (
            !e.defaultPrevented &&
            raw?.startsWith("/") &&
            safeWalkthroughPath(raw, location.origin)
          ) {
            e.preventDefault();
            win.location.hash = raw;
          }
        });
      const style = doc.createElement("style");
      style.textContent = ".review-nav,.review-layer{display:none!important}";
      doc.head.append(style);
      if (system) {
        scene.current?.destroy();
        scene.current = createLandingScene(
          ref.current,
          () => {},
          () => {},
        );
        scene.current.update(
          {
            cards: system,
            passage: system === "procession" ? "carry" : "dolly",
            depth: 2.1,
            mist: 20,
            size: 100,
            still: false,
            tempo: 1,
            hold: 5.5,
            drift: "continuous",
            dip: 6,
            returnAt: 52,
          },
          false,
        );
      }
      if (onNavigate) {
        const sync = () => {
          const next = safeWalkthroughPath(
            win.location.hash.startsWith("#/")
              ? win.location.hash.slice(1)
              : (import.meta.env.PROD && win.location.pathname.startsWith(import.meta.env.BASE_URL)
                ? "/" + win.location.pathname.slice(import.meta.env.BASE_URL.length)
                : win.location.pathname) + win.location.search,
            location.origin,
          );
          if (next) callbacks.current.onNavigate?.(next);
        };
        // Let both native click/back handlers finish before reconciling routes.
        // Updating the other frame inside the click can erase its flight history state.
        // Router navigation uses history APIs, not always a hash/popstate event.
        const originals = new Map();
        for (const method of ["pushState", "replaceState"]) {
          const original = win.history[method];
          originals.set(method, original);
          win.history[method] = function (...args) {
            const result = original.apply(this, args);
            setTimeout(() => { if (!abort.signal.aborted) sync(); }, 50);
            return result;
          };
        }
        abort.signal.addEventListener("abort", () => {
          for (const [method, original] of originals) win.history[method] = original;
        }, { once: true });
        const options = { signal: abort.signal };
        win.addEventListener("popstate", () => setTimeout(() => { if (!abort.signal.aborted) sync(); }, 50), options);
        win.addEventListener("hashchange", sync, options);
        sync();
      }
    } catch {
      /* The published site is intentionally cross-origin. */
    }
  }
  const width = device === "phone" ? 390 : 1440,
    height = device === "phone" ? 844 : 900;
  return (
    <div
      className={`u-screen-host ${device}`}
      ref={host}
      style={{
        "--screen-width": width + "px",
        "--screen-height": height * scale + "px",
        "--render-width": width * scale + "px",
      }}
    >
      <div className="u-screen-clip" style={{ height: height * scale }}>
        <iframe
          ref={ref}
          title={title || "TrueMark website"}
          src={initialSource.current}
          onLoad={loaded}
          style={{ width, height, transform: `scale(${scale})` }}
        />
        {loading && (
          <div className="u-loading" role="status">
            Opening the experience…
          </div>
        )}
        {error && (
          <div className="u-loading">
            <p>This preview did not load.</p>
            <button
              onClick={() => {
                setError(false);
                ref.current.src = source;
              }}
            >
              Try again ↗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function Landings({ runtime, open }) {
  const [system, setSystem] = useState("procession"),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState("All"),
    [selected, setSelected] = useState([]),
    [compare, setCompare] = useState(false),
    [linked, setLinked] = useState(true),
    [device, setDevice] = useState("desktop");
  const options = ["All", ...new Set(catalog.designs.map((d) => d.group))];
  const shown = catalog.designs.filter(
    (d) =>
      (group === "All" || d.group === group) &&
      `${d.title} ${d.description} ${d.date}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const toggle = (id) =>
    setSelected((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : s.length === 2
          ? [s[1], id]
          : [...s, id],
    );
  return (
    <section className="u-page">
      <Intro
        kicker="Selected, explored, preserved"
        title="Many paths. One world."
      >
        The selected Procession lives in the storefront. Every other direction
        stays here to explore and compare.
      </Intro>
      <div className="u-section-head">
        <h2>Compound class systems.</h2>

      </div>
      <div className="u-system-nav" role="group" aria-label="Landing systems">
        {systems.map(([id, name, s]) => (
          <button
            key={id}
            onClick={() => setSystem(id)}
            aria-pressed={id === system}
          >
            {name}
            <span>{s}</span>
          </button>
        ))}
      </div>
      <div className="u-tools">
        <p>
          {systems.find((s) => s[0] === system)?.[1]} ·{" "}
          {systems.find((s) => s[0] === system)?.[2]}
        </p>
        <button
          onClick={() =>
            setDevice((d) => (d === "phone" ? "desktop" : "phone"))
          }
        >
          {device === "phone" ? "Show desktop" : "Show phone"}
        </button>
      </div>
      <Screen
        key={system}
        path={`/?offer=off${system === "procession" ? "" : "&collection=study"}`}
        system={system}
        device={device}
        title={`${system} landing study`}
      />
      {runtime.additions?.length > 0 && (
        <>
          <div className="u-section-head">
            <h2>From the other branches.</h2>
            <p>
              Additional preserved explorations, brought into the same studio.
            </p>
          </div>
          <div className="u-recovered">
            {runtime.additions.map((d) => (
              <button
                key={d.id}
                onClick={() =>
                  open({ ...d, kind: "interactive", status: "study" })
                }
              >
                <span className="u-label">
                  Explored · {d.revision?.slice(0, 7)}
                </span>
                <h3>{d.title}</h3>
                <span>Explore ↗</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="u-section-head">
        <h2>The design collection.</h2>
        <p>
          {catalog.summary.designs} preserved records, from the first design
          onward.
        </p>
      </div>
      <div className="u-filters">
        <label className="u-search">
          Search the work
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A direction, date, or detail…"
          />
        </label>
        <label>
          Collection
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {options.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          disabled={selected.length !== 2}
          onClick={() => setCompare(true)}
        >
          Compare {selected.length}/2 ↗
        </button>
      </div>
      <p role="status" className="u-label">
        {shown.length} records
      </p>
      <div className="u-design-grid">
        {shown.map((d) => (
          <article key={d.id}>
            <button
              className="u-design-open"
              onClick={() =>
                open(
                  {
                    ...d,
                    url: runtimeUrl(runtime, d) || d.captureUrl,
                    kind: runtimeUrl(runtime, d) ? "interactive" : d.kind,
                  },
                  shown.map((record) => ({
                    ...record,
                    url: runtimeUrl(runtime, record) || record.captureUrl,
                    kind: runtimeUrl(runtime, record) ? "interactive" : record.kind,
                  })),
                )
              }
            >
              <div className="u-plate">
                <img loading="lazy" src={d.thumbnail || hero} alt={d.title} />
                <span className="u-plate-link">
                  {runtimeUrl(runtime, d) ? "Explore" : "Inspect capture"} ↗
                </span>
              </div>
              <div className="u-caption">
                <h3>{d.title}</h3>
                <span>{d.date}</span>
              </div>
            </button>
            <p>{d.description}</p>
            <div className="u-card-bottom">
              <span className="u-label">
                {d.kind === "concept"
                  ? "Explored concept"
                  : runtimeUrl(runtime, d)
                    ? "Interactive study"
                    : "Preserved capture"}
              </span>
              <button
                aria-pressed={selected.includes(d.id)}
                onClick={() => toggle(d.id)}
              >
                {selected.includes(d.id) ? "Selected ✓" : "Compare +"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!shown.length && (
        <p className="u-empty">
          No matching work. Try another search or collection.
        </p>
      )}
      {compare && (
        <Modal wide title="Side by side" close={() => setCompare(false)}>
          <div className="u-tools">
            <p>Historical studies retain their original design.</p>
            <button
              onClick={() =>
                setDevice((d) => (d === "phone" ? "desktop" : "phone"))
              }
            >
              {device === "phone" ? "Desktop captures" : "Phone captures"}
            </button>
          </div>
          <div className="u-compare">
            {selected.map((id) => {
              const d = catalog.designs.find((x) => x.id === id);
              return (
                <figure key={id}>
                  <img
                    src={
                      (device === "phone" ? d.phone : d.desktop) ||
                      d.captureUrl ||
                      d.thumbnail
                    }
                    alt={d.title}
                  />
                  <figcaption>
                    {d.title} · {d.revision}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </Modal>
      )}
    </section>
  );
}
function runtimeUrl(runtime, d) {
  const list = runtime.entries || [];
  const r = list.find((r) => r.id === d.id);
  return (r?.availability === "available" || r?.status === "built") &&
    r?.revisionMatched !== false
    ? r.url
    : null;
}
function Photography({ open, favorites, save }) {
  const [query, setQuery] = useState(""),
    [group, setGroup] = useState("All"),
    [state, setState] = useState("All"),
    [saved, setSaved] = useState(false);
  const groups = [
    ["All", "All photographs"],
    ...Object.keys(catalog.summary.photoGroups).map((g) => [
      g,
      {
        "01-product-vials": "Product vials",
        "02-product-scenes": "Product scenes",
        "03-cold-storage": "Cold storage",
        "04-studio-backgrounds": "Studio backgrounds",
        "05-macros-and-materials": "Macros and materials",
        "06-coastal-and-water": "Coast and water",
        "07-render-studies": "Render studies",
      }[g],
    ]),
  ];
  const shown = catalog.photography.filter(
    (p) =>
      (group === "All" || p.group === group) &&
      (state === "All" || p.status === state) &&
      (!saved || favorites.includes(p.id)) &&
      `${p.title} ${p.series} ${p.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const series = [...new Set(shown.map((p) => p.series))];
  return (
    <section className="u-page">
      <Intro kicker="The visual library" title="The world, in detail.">
        Product masters, studio scenes, and material studies. Original
        proportions. Original artwork.
      </Intro>
      <div className="u-filters">
        <label className="u-search">
          Search the collection
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Vials, silver, mist…"
          />
        </label>
        <label>
          Revision
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="All">Every revision</option>
            <option value="corrected">Lid-corrected</option>
            <option value="historical">Before fix</option>
            <option value="study">Design studies</option>
          </select>
        </label>
      </div>
      <div
        className="u-group-nav"
        role="group"
        aria-label="Photography subjects"
      >
        {groups.map(([id, name]) => (
          <button
            key={id}
            aria-pressed={group === id}
            onClick={() => setGroup(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="u-section-head">
        <p role="status">
          {shown.length} of {catalog.summary.photography} photographs
        </p>
        <button aria-pressed={saved} onClick={() => setSaved(!saved)}>
          Saved ({favorites.length})
        </button>
      </div>
      {series.map((s) => (
        <section className="u-photo-series" key={s}>
          <div className="u-series-title">
            <h2>
              {s
                .split("/")
                .slice(1)
                .join(" / ")
                .replaceAll("-", " ")
                .replace(/\b\d+\s*/g, "") ||
                shown.find((p) => p.series === s).groupTitle}
            </h2>
            <span className="u-label">
              {shown.filter((p) => p.series === s).length}{" "}
              {shown.filter((p) => p.series === s).length === 1
                ? "image"
                : "images"}
            </span>
          </div>
          <PhotoRows
            photos={shown.filter((p) => p.series === s)}
            open={(p) => open(p, shown)}
            favorites={favorites}
            save={save}
          />
        </section>
      ))}
      {!shown.length && (
        <p className="u-empty">
          No images match these filters. Choose another subject or revision.
        </p>
      )}
      <p className="u-note">
        Generated scenes and material studies are illustrative. “Lid-corrected”
        identifies a source revision; archive inclusion does not imply approval
        for production use. Earlier masks and unused directions remain
        available.
      </p>
    </section>
  );
}
function PhotoRows({ photos, open, favorites, save }) {
  const ref = useRef(),
    [width, setWidth] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver((e) => setWidth(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const rows = [];
  let row = [],
    sum = 0;
  const target = width < 700 ? 160 : 240;
  for (const photo of photos) {
    row.push(photo);
    sum += photo.width / photo.height;
    if (sum * target + 8 * (row.length - 1) >= width && width) {
      rows.push({ photos: row, height: (width - 8 * (row.length - 1)) / sum });
      row = [];
      sum = 0;
    }
  }
  if (row.length)
    rows.push({
      photos: row,
      height: Math.min(target, (width - 8 * (row.length - 1)) / sum),
    });
  return (
    <div className="u-photo-rows" ref={ref}>
      {rows.map((r, i) => (
        <div className="u-photo-row" key={i} style={{ height: r.height }}>
          {r.photos.map((p) => (
            <figure
              key={p.id}
              style={{
                width: (r.height * p.width) / p.height,
                height: r.height,
              }}
            >
              <button
                className="u-photo-open"
                onClick={() => open(p)}
                aria-label={`Inspect ${p.title}`}
              >
                <img
                  src={
                    "/design-lab/universe/generated/thumbs/" + p.id + ".webp"
                  }
                  alt={p.title}
                  width={p.width}
                  height={p.height}
                  loading="lazy"
                />
              </button>
              <figcaption>
                <span>{p.title}</span>
                <button
                  aria-label={`${favorites.includes(p.id) ? "Unsave" : "Save"} ${p.title}`}
                  aria-pressed={favorites.includes(p.id)}
                  onClick={() => save(p.id)}
                >
                  {favorites.includes(p.id) ? "●" : "+"}
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}
function Record({ open, runtime }) {
  const [tab, setTab] = useState("Brand");
  return (
    <section className="u-page">
      <Intro kicker="The project record" title="Every part of TrueMark.">
        The supplied identity, moving images, communications, and saved chapters
        of the design.
      </Intro>
      <div className="u-group-nav">
        {[
          "Brand",
          "Films",
          "Communications",
          "Checkpoints",
          "Explorations",
          "Tools",
        ].map((t) => (
          <button key={t} aria-pressed={t === tab} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Brand" && (
        <>
          <div className="u-section-head">
            <h2>The identity, intact.</h2>
            <p>{catalog.brandAssets.length} client-supplied assets</p>
          </div>
          <div className="u-brand-grid">
            {catalog.brandAssets.map((a) => (
              <button key={a.id} onClick={() => open(a, catalog.brandAssets)}>
                <div
                  className={`u-plate ${/white/i.test(a.title) ? "u-dark" : ""}`}
                >
                  {["svg", "png", "jpg", "webp"].includes(a.kind) ? (
                    <img loading="lazy" src={a.url} alt={a.title} />
                  ) : (
                    <span>{a.kind.toUpperCase()} ↗</span>
                  )}
                </div>
                <div className="u-caption">
                  <h3>{a.title}</h3>
                  <span>{a.group}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      {tab === "Films" && (
        <div className="u-film-grid">
          {catalog.films.map((f) => (
            <button key={f.id} onClick={() => open(f, catalog.films)}>
              <div className="u-plate">
                <img loading="lazy" src={f.thumbnail} alt={f.title} />
                <span className="u-play">Play ↗</span>
              </div>
              <div className="u-caption">
                <h3>{f.title}</h3>
                <span>
                  {f.format} · {f.duration}s
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {tab === "Communications" && (
        <div className="u-text-panel">
          <h2>The experience, continued.</h2>
          <p>
            Twenty email templates and eight text-message proofs carry the
            identity beyond the website. Explore confirmation, shipping,
            verification, partner and account messages using fictional records.
          </p>
          <a className="u-primary" href="#platform/messages">
            Explore the messages ↗
          </a>
        </div>
      )}
      {tab === "Tools" && (
        <div className="u-checkpoints">
          {(runtime.tools || catalog.tools || []).map((t) => (
            <article key={t.id}>
              <span className="u-label">{t.group} · Explored</span>
              <h2>{t.title}</h2>
              {t.packagedUrl ? (
                <button
                  className="u-checkpoint-open"
                  onClick={() =>
                    open({ ...t, url: t.packagedUrl, kind: "interactive" })
                  }
                >
                  Open study ↗
                </button>
              ) : (
                <p>Historical record; interactive preview unavailable.</p>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === "Checkpoints" && (
        <div className="u-checkpoints">
          {[...catalog.checkpoints].reverse().map((c, i) => (
            <article key={c.id}>
              <span className="u-label">
                {String(catalog.checkpoints.length - i).padStart(2, "0")} ·
                Preserved checkpoint
              </span>
              <h2>{c.title}</h2>
              <p>{c.tag}</p>
              <code>{c.revision}</code>
              {(() => {
                const entry =
                  runtime.entries?.find(
                    (e) =>
                      e.recordedRevision === c.revision ||
                      e.sourceLibraryId ===
                        c.tag
                          .replace("archive/", "archive-")
                          .split("-")
                          .slice(0, 2)
                          .join("-"),
                  ) || runtime.checkpoints?.find((e) => e.tag === c.tag);
                return entry?.url ? (
                  <button
                    className="u-checkpoint-open"
                    onClick={() =>
                      open({
                        ...c,
                        url: entry.url,
                        kind: "interactive",
                        status: "historical",
                      })
                    }
                  >
                    Open checkpoint ↗
                  </button>
                ) : null;
              })()}
            </article>
          ))}
        </div>
      )}
      {tab === "Explorations" && (
        <div className="u-checkpoints">
          {catalog.explorations.map((e) => (
            <article key={e.id}>
              <span className="u-label">{e.group} · Explored</span>
              <h2>{e.title}</h2>
              <p>
                Preserved in the historical collection. Open the matching
                record under Landings.
              </p>
            </article>
          ))}
        </div>
      )}
      <p className="u-note">
        This curated collection is included in the repository. Historical
        designs retain their original appearance; the current Studio and
        platform can be edited from the accompanying source.
      </p>
    </section>
  );
}
async function downloadAsset(item) {
  const url = item.url || item.captureUrl;
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Unavailable");
    const blob = await response.blob();
    const ext =
      {
        "image/webp": "webp",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/svg+xml": "svg",
        "video/mp4": "mp4",
        "application/pdf": "pdf",
      }[blob.type] || url.split(".").pop().split("?")[0];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download =
      item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "." + ext;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
function Modal({ title, close, children, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const before = document.activeElement;
    ref.current.showModal();
    return () => before?.focus?.({ preventScroll: true });
  }, []);
  return (
    <dialog
      className={`u-dialog ${wide ? "wide" : ""}`}
      ref={ref}
      onCancel={close}
    >
      <div className="u-dialog-head">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={close}>
          Close ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Lightbox({ value, close, select, favorites, save }) {
  const [loadedId, setLoadedId] = useState(null),
    [failedId, setFailedId] = useState(null);
  const { item, items } = value,
    ref = useRef(),
    start = useRef(),
    index = items.findIndex((x) => x.id === item.id),
    move = (d) => select(items[(index + d + items.length) % items.length]);
  useEffect(() => {
    const before = document.activeElement;
    ref.current.showModal();
    return () => before?.focus?.({ preventScroll: true });
  }, []);
  const image = /\.(png|jpe?g|webp|svg)(\?|$)/i.test(
      item.url || item.captureUrl || "",
    ),
    video = /\.mp4/.test(item.url || ""),
    interactive = item.kind === "interactive";
  return (
    <dialog
      className="u-lightbox"
      aria-labelledby="lightbox-title"
      ref={ref}
      onCancel={close}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") move(1);
        if (e.key === "ArrowLeft") move(-1);
      }}
    >
      <div className="u-lightbox-head">
        <span>
          TrueMark / {item.groupTitle || item.group || "The collection"}
        </span>
        <button onClick={close} aria-label="Close image">
          Close ×
        </button>
      </div>
      <div
        className="u-lightbox-stage"
        onTouchStart={(e) =>
          (start.current = [e.touches[0].clientX, e.touches[0].clientY])
        }
        onTouchEnd={(e) => {
          if (!start.current) return;
          const dx = e.changedTouches[0].clientX - start.current[0],
            dy = e.changedTouches[0].clientY - start.current[1];
          if (dy > 100 && Math.abs(dx) < 70) close();
          else if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1);
        }}
      >
        {video ? (
          <video
            key={item.id}
            controls
            autoPlay
            playsInline
            src={item.url}
            onLoadedData={() => setLoadedId(item.id)}
            onError={() => setFailedId(item.id)}
          />
        ) : interactive ? (
          <iframe
            key={item.id}
            src={item.url}
            title={item.title}
            onLoad={() => setLoadedId(item.id)}
          />
        ) : image ? (
          <img
            key={item.id}
            src={item.url || item.captureUrl}
            alt={item.title}
            onLoad={() => setLoadedId(item.id)}
            onError={() => setFailedId(item.id)}
          />
        ) : (
          <div className="u-lightbox-file">
            <h2>{item.title}</h2>
            <a href={item.url} target="_blank" rel="noreferrer">
              Open original file ↗
            </a>
          </div>
        )}
        {(image || video || interactive) && loadedId !== item.id && (
          <p className="u-asset-loading" role="status">
            {failedId === item.id
              ? "This item could not load. Close and open it again to retry."
              : "Opening the collection…"}
          </p>
        )}
      </div>
      <div className="u-lightbox-detail">
        <div>
          <p className="u-label">
            {status(item.status)} · {index + 1} / {items.length}
          </p>
          <h2 id="lightbox-title">{item.title}</h2>
          <p>
            {item.width &&
              `${item.width.toLocaleString()} × ${item.height.toLocaleString()}`}
            {item.bytes && ` · ${moneySize(item.bytes)}`}
            {item.sourceRevision?.date && ` · ${item.sourceRevision.date}`}
            {item.revision && ` · ${item.revision}`}
          </p>
          <p>
            {item.description ||
              item.approval ||
              "Original client artwork. Preserved without alteration."}
          </p>
        </div>
        <div className="u-lightbox-actions">
          <button onClick={() => move(-1)} aria-label="Previous image">
            ←
          </button>
          <button onClick={() => move(1)} aria-label="Next image">
            →
          </button>
          <button
            onClick={() => save(item.id)}
            aria-pressed={favorites.includes(item.id)}
          >
            {favorites.includes(item.id) ? "Saved ✓" : "Save +"}
          </button>
          <button onClick={() => downloadAsset(item)}>Download ↓</button>
        </div>
      </div>
    </dialog>
  );
}
const root =
  import.meta.hot?.data.root ||
  createRoot(document.getElementById("universe-root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<App />);
