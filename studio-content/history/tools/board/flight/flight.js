/*
 * Flight: from the opening into a product as one camera move.
 *
 * Technique: Web Animations over composited layers, not a view transition. The whole move is one pure
 * function of a camera progress `c` (0 = the opening's framing, 1 = the product's): the collection's plate
 * (video and five vials), the single room's plate and the one vial are similarity transforms around the
 * vial's foot, so they move as one physical scene. A path over time (forward, back, or a re-aim from
 * wherever the move is) is sampled into keyframes for every layer and played on the compositor, so the
 * camera keeps gliding even if the main thread is busy, and a second click, Escape or Back can rebuild
 * the path from the exact current state, velocity included.
 */

const data = await fetch("products.json").then((r) => r.json());
const byId = new Map(data.products.map((p) => [p.id, p]));

/* ---------- Rooms (landing-v2 src/brand/Rooms.tsx, as they stand) ---------- */

const media = (name) => `/truemark/studio/history/tools/board/media/${name}`;
const COLLECTION = { w: 2560, h: 1430, video: media("open-misty.mp4"), poster: media("open-misty.jpg") };
const COLLECTION_TALL = { w: 1080, h: 1934, video: media("open-phone-misty.mp4"), poster: media("open-phone-misty.jpg") };
const SINGLE = { w: 2688, h: 1512, video: media("desk-misty.mp4"), poster: media("desk-misty.jpg") };
const SINGLE_TALL = { w: 2160, h: 3840, video: media("phone-misty.mp4"), poster: media("phone-misty.jpg") };
// `ped`: the pedestal's top, as wide as this many vial heights (measured on the rendered rooms). It lets the
// collection's pedestal widen into the single room's during the dissolve, so the two never ghost as two sizes.
const COLLECTION_SEATS = [
  { x: 0.2424, y: 0.71, h: 0.1792, ped: 1.08 },
  { x: 0.3682, y: 0.6452, h: 0.1792, ped: 1.09 },
  { x: 0.4978, y: 0.5986, h: 0.1792, ped: 1.17 },
  { x: 0.6296, y: 0.6558, h: 0.1792, ped: 1.1 },
  { x: 0.7576, y: 0.7268, h: 0.1792, ped: 1.07 },
];
const COLLECTION_TALL_SEATS = [
  { x: 0.168, y: 0.6083, h: 0.1417, ped: 1.08 },
  { x: 0.4963, y: 0.5714, h: 0.1417, ped: 1.14 },
  { x: 0.8306, y: 0.6166, h: 0.1417, ped: 1.08 },
];
const SINGLE_SEAT = { x: 0.64, y: 0.672, h: 0.5, ped: 1.54 };
const SINGLE_TALL_SEAT = { x: 0.497, y: 0.634, h: 0.29, ped: 1.07 };
const VIAL_RATIO = 578 / 1112;
const mirrored = (seat) => ({ ...seat, x: 1 - seat.x });

/** MistOpening.tsx: the band a landscape screen sees, the portrait focus, the clearance under the words. */
const BAND = { x0: 0.08, x1: 0.92, focusY: 0.88 };
const TALL_FOCUS = { x: 0.5, y: 0.62 };
const CLEARANCE = 36;
/** On a phone the product's room is cut a little closer than cover, so the vial stands large above the panel. */
const STACK_ZOOM = 1.14;
/** On a wide screen, a little closer than cover too: the room then reaches past the frame, so it can arrive
 *  while the camera is still settling. */
const WIDE_ZOOM = 1.08;
// How far inside the frame the single room's edge may be when the dissolve starts (none: it must fill it).
const FEATHER = 0;

function coverBox(sw, sh, room, focus) {
  const scale = Math.max(sw / room.w, sh / room.h);
  const width = room.w * scale, height = room.h * scale;
  return { left: (sw - width) * focus.x, top: (sh - height) * focus.y, width, height };
}
function bandBox(sw, sh, room, band) {
  const scale = Math.max(sw / ((band.x1 - band.x0) * room.w), sh / room.h);
  const width = room.w * scale, height = room.h * scale;
  return { left: sw / 2 - ((band.x0 + band.x1) / 2) * width, top: (sh - height) * band.focusY, width, height };
}
/** Closer than cover, about the seat's foot, never uncovering the stage. */
function zoomAt(box, seat, z, sw, sh) {
  const fx = box.left + seat.x * box.width, fy = box.top + seat.y * box.height;
  const width = box.width * z, height = box.height * z;
  const clamp = (v, low) => Math.min(0, Math.max(low, v));
  return { left: clamp(fx - seat.x * width, sw - width), top: clamp(fy - seat.y * height, sh - height), width, height };
}
/** Rooms.tsx seatBelow: caps clear of the words on the wall, feet clear of the words on the floor. */
function seatBelow(box, seats, wall, floor, stage, clearance, widthFit, focusY) {
  if (!stage.w) return { box, minStage: 0 };
  const under = (seat, block) => {
    const centre = box.left + seat.x * box.width, half = (seat.h * box.height * VIAL_RATIO) / 2;
    return centre + half >= block.left && centre - half <= block.right;
  };
  let need = -Infinity, wallTarget = 0;
  for (const seat of seats) for (const block of wall) {
    if (!block.bottom || !under(seat, block)) continue;
    const cap = seat.y - seat.h;
    need = Math.max(need, block.bottom + clearance - cap * box.height);
    wallTarget = Math.max(wallTarget, (block.bottom + clearance) / cap);
  }
  const top = Math.min(0, Math.max(stage.h - box.height, Math.max(box.top, need)));
  let minStage = need > -Infinity && wallTarget > widthFit + 0.5 ? Math.ceil(wallTarget) : 0;
  const gap = clearance / 2;
  for (const seat of seats) for (const block of floor) {
    if (!block.top || !under(seat, block)) continue;
    const room = stage.h - block.top;
    const foot = seat.y * box.height;
    const resting = (box.height * (seat.y - focusY) + gap + room) / (1 - focusY);
    const held = need + foot + gap + room;
    const restingTop = (resting - box.height) * focusY;
    minStage = Math.max(minStage, Math.ceil(need > restingTop ? held : resting));
  }
  return { box: { ...box, top }, minStage };
}

/* ---------- Easing ---------- */

function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const hermite = (p0, m0, p1, t) => (2 * t ** 3 - 3 * t ** 2 + 1) * p0 + (t ** 3 - 2 * t ** 2 + t) * m0 + (-2 * t ** 3 + 3 * t ** 2) * p1;

/** The camera: a slow start, a long settle, no overshoot. */
const EASE_CAMERA = bezier(0.45, 0, 0.15, 1);
/** The site's entrance ease (--tm-ease-enter) for the details. */
const EASE_ENTER = bezier(0.2, 0.7, 0.1, 1);
/** Words leaving: they go at once and slow as they vanish. */
const EASE_LEAVE = bezier(0.3, 0, 0.2, 1);
const EASE_IN = bezier(0.4, 0, 1, 1);

/* ---------- Timing (ms) ---------- */

const T = {
  camera: 1100,
  copyOut: 340,
  copyDrift: -12,
  panelStart: 620,
  panelStagger: 26,
  panelDur: 380,
  panelRise: 16,
  backDelay: 60,
  panelOut: 200,
  copyInAt: 0.62,
  copyInDur: 440,
  hurry: 300,
  fade: 180,
};
/** The neighbours' softening and the foot's travel, as functions of the camera, so any path keeps them aligned.
 *  The foot arrives a little before the push ends: the last of the move is the camera closing in. */
const soften = (c) => smooth(0, 0.55, c);
const travel = (c) => 1 - Math.pow(1 - clamp01(c / 0.92), 1.5);
/** The room dissolve runs over the camera's settle, from where the single room first fills the frame. */
const DISSOLVE_SPAN = 0.12;
const BLUR_MAX = 14; // px on screen, at the furthest neighbour
const DIM_MAX = 0.72; // opacity lost by the furthest neighbour
/** The collection's room defocuses as it dissolves, so its pedestal never shows as a second hard edge. */
const ROOM_BLUR = 10;

let slow = 1;
try { slow = Number(new URLSearchParams(location.search).get("slow") || sessionStorage.getItem("flight-slow") || 1) || 1; } catch { /* default speed */ }
const ms = (v) => v * slow;
const STEP = 1000 / 60;

/* ---------- The page ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const views = $("#views");
const mq = {
  tall: matchMedia("(max-aspect-ratio: 11/10)"),
  phone: matchMedia("(max-width: 560px)"),
  stacked: matchMedia("(max-width: 760px), (max-aspect-ratio: 11/10)"),
  reduced: matchMedia("(prefers-reduced-motion: reduce)"),
};
const reduced = () => mq.reduced.matches;

const home = {
  el: $("#home"),
  plate: $("#home-plate"),
  still: $("#home-plate [data-room-still]"),
  video: $("#home-plate [data-room-video]"),
  head: $('#home [data-copy="head"]'),
  aside: $('#home [data-copy="aside"]'),
  lead: $("#home .home-lead"),
  actions: $("#home .home-actions"),
  shape: null,
  box: null,
  vials: new Map(), // id → { el, glass, seat }
};
const product = {
  el: $("#product"),
  scene: $("#pscene"),
  plate: $("#product-plate"),
  room: $("#product-plate [data-proom]"),
  still: $("#product-plate [data-room-still]"),
  video: $("#product-plate [data-room-video]"),
  ground: $("#product [data-ground]"),
  fade: $("#product [data-fade]"),
  vial: $("#pvial"),
  glass: $("#pvial [data-glass]"),
  castHome: $('#pvial [data-cast="home"]'),
  castRoom: $('#pvial [data-cast="room"]'),
  rise: [...document.querySelectorAll("#product .rise")].sort((a, b) => a.dataset.rise - b.dataset.rise),
  heading: $("#product-title"),
  more: $("#pmore"),
  layout: null,
  box: null,
  seat: null,
  id: null,
};

let current = { view: "home", id: null };
let move = null;
const log = (window.__flightLog = []);
const note = (type, extra = {}) => log.push({ type, t: Math.round(performance.now()), ...extra });

/* ---------- Media ---------- */

function setRoom(still, video, room) {
  if (still.dataset.src !== room.poster) { still.src = room.poster; still.dataset.src = room.poster; }
  if (reduced()) { video.removeAttribute("src"); video.load(); video.hidden = true; return; }
  video.hidden = false;
  if (video.dataset.src !== room.video) { video.src = room.video; video.dataset.src = room.video; }
}
const playVideo = (video) => { if (!reduced() && video.getAttribute("src")) video.play().catch(() => undefined); };
const pauseVideo = (video) => video.pause();

/* ---------- The opening ---------- */

function buildHomeVials(ids, seats) {
  for (const { el } of home.vials.values()) el.remove();
  home.vials.clear();
  ids.forEach((id, i) => {
    const p = byId.get(id);
    const a = document.createElement("a");
    a.className = "vial";
    a.href = urlFor(id);
    a.dataset.id = id;
    a.setAttribute("aria-label", `${p.name}, ${p.size}`);
    a.style.setProperty("--seat-x", seats[i].x);
    a.style.setProperty("--seat-y", seats[i].y);
    a.style.setProperty("--vial-h", seats[i].h);
    a.innerHTML = `<span class="vial-shadow" aria-hidden="true"></span><span class="vial-cast" aria-hidden="true"></span><img class="vial-glass" src="${p.cutout}" alt="" draggable="false" />`;
    a.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      goProduct(id);
    });
    home.plate.append(a);
    home.vials.set(id, { el: a, glass: a.querySelector("img"), seat: seats[i] });
  });
}

function layoutHome() {
  const tall = mq.tall.matches, phone = mq.phone.matches;
  const shape = tall ? "tall" : "wide";
  home.el.dataset.shape = shape;
  const room = tall ? COLLECTION_TALL : COLLECTION;
  const seats = tall ? COLLECTION_TALL_SEATS : COLLECTION_SEATS;
  if (home.shape !== shape) {
    home.shape = shape;
    buildHomeVials(tall ? data.collection.slice(1, 4) : data.collection, seats);
    setRoom(home.still, home.video, room);
  }
  for (let pass = 0; pass < 2; pass++) {
    const w = home.el.clientWidth, h = home.el.clientHeight;
    const base = home.el.getBoundingClientRect();
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return [{ left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top }];
    };
    const wall = [...rect(home.head), ...(!tall ? [...rect(home.lead), ...rect(home.actions)] : phone ? rect(home.lead) : [])];
    const floor = tall ? [...rect(home.actions), ...(phone ? [] : rect(home.lead))] : [];
    const framed = tall ? coverBox(w, h, room, TALL_FOCUS) : bandBox(w, h, room, BAND);
    const widthFit = tall ? (w / room.w) * room.h : (w / ((BAND.x1 - BAND.x0) * room.w)) * room.h;
    const { box, minStage } = seatBelow(framed, seats, wall, floor, { w, h }, CLEARANCE, widthFit, tall ? TALL_FOCUS.y : BAND.focusY);
    const need = minStage > 0 ? `${minStage}px` : "";
    if (home.el.style.getPropertyValue("--home-need") !== need) {
      home.el.style.setProperty("--home-need", need);
      continue;
    }
    home.box = box;
    Object.assign(home.plate.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    break;
  }
}

/* ---------- The product page ---------- */

function layoutProduct() {
  const stacked = mq.stacked.matches;
  const room = stacked ? SINGLE_TALL : SINGLE;
  const seat = stacked ? SINGLE_TALL_SEAT : mirrored(SINGLE_SEAT);
  product.layout = stacked ? "stacked" : "wide";
  setRoom(product.still, product.video, room);
  product.plate.toggleAttribute("data-mirror", !stacked);
  product.castRoom.dataset.side = stacked ? "" : "mirror";
  const w = product.scene.clientWidth, h = product.scene.clientHeight;
  const box = zoomAt(coverBox(w, h, room, seat), seat, stacked ? STACK_ZOOM : WIDE_ZOOM, w, h);
  product.box = box;
  // The page starts where the room thins out, so it never lies under the room while the rooms dissolve.
  product.ground.style.top = `${Math.round(h)}px`;
  product.seat = seat;
  Object.assign(product.plate.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  product.vial.style.setProperty("--seat-x", seat.x);
  product.vial.style.setProperty("--seat-y", seat.y);
  product.vial.style.setProperty("--vial-h", seat.h);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const arrow = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const outward = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The rows today's product page lists (shop/pages/Product.tsx), from the same data. */
function specRows(p) {
  const c = p.certificate;
  return [
    ["Compound", p.name],
    ["Class", p.className],
    ["Presentation", `${p.size} per vial`],
    ["Form", p.spec.form],
    ["CAS number", p.spec.cas],
    ["Molecular formula", p.spec.formula],
    ["Molecular weight", p.spec.weight],
    ["Sequence", p.spec.sequence],
    ["Blend", p.spec.blend],
    ["Purity specification", `≥${data.puritySpec}% (HPLC)`],
    ["HPLC purity, current lot", `${c.purity}%`],
    ["Identity method", "Mass spectrometry"],
    ["Identity, current lot", `${c.identity}, by ${c.identityMethod}`],
    [c.contentPerVial ? "Content per vial, current lot" : "Content, current lot", `${c.content} · ${c.claimText}`],
    ["Storage", p.spec.storage],
    ["Documentation", "Lot-specific certificate of analysis"],
    ["Intended use", "Laboratory research only"],
  ].filter(([, v]) => v);
}

/** The few facts that sit in the panel: identifiers where the data has them, otherwise this lot's own results. */
function compactSpec(p) {
  const c = p.certificate;
  return p.spec.cas
    ? [["CAS", p.spec.cas], ["Formula", p.spec.formula], ["Mol. weight", p.spec.weight], ["Storage", p.spec.storage]]
    : [["Form", p.spec.form], ["Storage", p.spec.storage], ["Content, this lot", `${c.content} per vial`], ["Identity, this lot", c.identity]];
}

function fillProduct(id) {
  const p = byId.get(id);
  product.id = id;
  product.el.style.setProperty("--tm-tone", p.color);
  const fields = { name: p.name, size: p.size, className: p.className, lot: p.lot, purity: `${p.certificate.purity}%`, priceText: p.priceText, researchUseNote: data.researchUseNote };
  for (const el of product.el.querySelectorAll("[data-f]")) el.textContent = fields[el.dataset.f];
  $("[data-f-spec]", product.el).innerHTML = compactSpec(p).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  for (const img of product.glass.children) img.hidden = img.dataset.id !== id;
  $("[data-qty-input]", product.el).value = 1;
  syncQty();
  const c = p.certificate;
  const others = data.collection.filter((x) => x !== id).map((x) => byId.get(x));
  product.more.innerHTML = `
    <section class="psection" aria-labelledby="spec-title">
      <header class="psection-head">
        <p class="tm-eyebrow">Specification</p>
        <h2 class="tm-heading" id="spec-title">The essentials.</h2>
        <p class="tm-note">Identifiers and handling for ${esc(p.name)}. Results for your lot are on its certificate.</p>
      </header>
      <div class="psection-body">
        <p class="pdesc">${esc(p.description)}</p>
        <ul class="pnotes">${data.buyNotes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
        <dl class="ptable">${specRows(p).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd${/CAS|formula|Sequence/.test(k) ? ' class="tm-mono"' : ""}>${esc(v)}</dd></div>`).join("")}</dl>
      </div>
    </section>
    <section class="psection" id="certificate" aria-labelledby="cert-title" tabindex="-1">
      <header class="psection-head">
        <p class="tm-eyebrow">Current lot</p>
        <h2 class="tm-heading tm-mono" id="cert-title">${esc(p.lot)}</h2>
        <p class="tm-note">Certificate <span class="tm-mono">${esc(c.number)}</span> · Analyzed ${esc(c.analyzed)} by ${esc(c.lab)}, ${esc(data.lab.description)}.</p>
      </header>
      <div class="psection-body">
        <dl class="pfigures">
          <div><dt class="label">HPLC purity</dt><dd><span class="figure">${esc(c.purity)}<small>%</small></span><span class="figure-text">Specification ≥${esc(data.purityMinimum)}%</span></dd></div>
          <div><dt class="label">Identity</dt><dd><span class="figure">${esc(c.identity)}</span><span class="figure-text">${esc(c.identityMethod)}</span></dd></div>
          <div><dt class="label">Content</dt><dd><span class="figure">${esc(c.content.replace(/ .*/, ""))}<small>${esc(c.content.replace(/^\S+ /, ""))}</small></span><span class="figure-text">${esc(c.claimText.replace(/^./, (ch) => ch.toUpperCase()))}</span></dd></div>
          <div><dt class="label">Sample received</dt><dd><span class="figure" style="font-size:1.5rem">${esc(c.sampleReceived)}</span><span class="figure-text">Issued ${esc(c.issued)}</span></dd></div>
        </dl>
        <div class="pcert-actions">
          <a class="tm-textlink" href="${esc(c.pdf)}" target="_blank" rel="noopener">Open the certificate (PDF) ${arrow}</a>
          <a class="tm-textlink" href="${esc(c.verifyUrl)}" target="_blank" rel="noopener">Confirm with ${esc(c.lab)} ${outward}</a>
        </div>
      </div>
    </section>
    <section class="psection" aria-labelledby="standard-title">
      <header class="psection-head">
        <p class="tm-eyebrow">The standard</p>
        <h2 class="tm-heading" id="standard-title">Behind every vial.<br /><span style="color:var(--tm-ink-3)">On every certificate.</span></h2>
      </header>
      <div class="psection-body">
        <dl class="pfigures">${data.proofFigures.map((f) => `<div><dt class="label">${esc(f.label)}</dt><dd><span class="figure">${esc(f.figure)}${f.unit ? `<small>${esc(f.unit)}</small>` : ""}</span><span class="figure-text">${esc(f.text)}</span></dd></div>`).join("")}</dl>
        <ul class="ptrace">${data.traceability.map(([t, x]) => `<li><p class="ptrace-name">${esc(t)}</p><p class="ptrace-text">${esc(x)}</p></li>`).join("")}</ul>
      </div>
    </section>
    <section class="psection" aria-labelledby="more-title">
      <header class="psection-head">
        <p class="tm-eyebrow">The collection</p>
        <h2 class="tm-heading" id="more-title">Continue exploring.</h2>
      </header>
      <div class="psection-body">
        <ul class="prelated">${others.map((o) => `<li><a href="${urlFor(o.id)}" data-related="${o.id}"><img src="${o.cutoutSmall}" alt="" loading="lazy" /><span class="prelated-name">${esc(o.name)}</span><span class="prelated-meta">${esc(o.size)} · ${esc(o.priceText)}</span></a></li>`).join("")}</ul>
      </div>
    </section>`;
  for (const a of product.more.querySelectorAll("[data-related]")) {
    a.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      swapProduct(a.dataset.related);
    });
  }
}

function buildProductGlass() {
  for (const p of data.products) {
    const img = document.createElement("img");
    img.className = "vial-glass";
    img.src = p.cutout;
    img.alt = `${p.name}, ${p.size} research vial`;
    img.dataset.id = p.id;
    img.draggable = false;
    img.hidden = true;
    product.glass.append(img);
    img.decode().catch(() => undefined);
  }
}

/* ---------- Cart ---------- */

let cart = 0;
const qtyInput = $("[data-qty-input]");
function syncQty() {
  const n = Math.min(99, Math.max(1, Math.round(Number(qtyInput.value) || 1)));
  qtyInput.value = n;
  $('[data-qty="-1"]').disabled = n <= 1;
  $('[data-qty="1"]').disabled = n >= 99;
}
for (const b of document.querySelectorAll("[data-qty]")) b.addEventListener("click", () => { qtyInput.value = Number(qtyInput.value) + Number(b.dataset.qty); syncQty(); });
qtyInput.addEventListener("change", syncQty);
$("[data-add]").addEventListener("click", (event) => {
  const button = event.currentTarget;
  cart += Number(qtyInput.value);
  $("[data-cart-count]").textContent = cart;
  button.textContent = "Added to cart";
  clearTimeout(button._t);
  button._t = setTimeout(() => { button.textContent = "Add to cart"; }, 1600);
});

/* ---------- The move ---------- */

/**
 * Where everything stands at rest, in viewport pixels, with both views drawn and nothing animating.
 * F0/F1: the vial's foot in the opening and on the product page; k: how much larger it stands there.
 */
function geometry(id, { lift }) {
  const hv = home.vials.get(id);
  const hb = home.el.getBoundingClientRect();
  const box = home.box, seat = hv.seat;
  const F0 = { x: hb.left + box.left + seat.x * box.width, y: hb.top + box.top + seat.y * box.height };
  const h0 = seat.h * box.height;
  const pb = product.scene.getBoundingClientRect();
  const pbox = product.box, ps = product.seat;
  const F1 = { x: pb.left + pbox.left + ps.x * pbox.width, y: pb.top + pbox.top + ps.y * pbox.height };
  const h1 = ps.h * pbox.height;
  const reach = box.width * 0.26;
  const neighbours = [...home.vials.entries()].filter(([other]) => other !== id).map(([, v]) => {
    const fx = box.left + v.seat.x * box.width, fy = box.top + v.seat.y * box.height;
    const d = Math.hypot(fx - (F0.x - hb.left), fy - (F0.y - hb.top));
    return { el: v.el, w: Math.pow(Math.min(1, d / reach), 0.85) };
  });
  let lift0 = 0;
  if (lift) {
    const g = hv.glass.getBoundingClientRect(), a = hv.el.getBoundingClientRect();
    lift0 = g.top - a.top;
  }
  const G = {
    id, hv, F0, F1, k: h1 / h0, lift0, neighbours,
    // How much wider the single room's pedestal is than this one, for the same vial.
    R: ps.ped / seat.ped,
    homeRest: { left: hb.left + box.left, top: hb.top + box.top },
    prodRest: { left: pb.left + pbox.left, top: pb.top + pbox.top },
  };
  // The first camera position from which the single room fills its stage (its feather may just show).
  const slack = FEATHER * 0.75;
  let c0 = 1;
  for (let c = 1; c >= 0.5; c -= 0.005) {
    const { Fx, Fy, sigma } = camera(G, c);
    const left = Fx + sigma * (G.prodRest.left - F1.x), top = Fy + sigma * (G.prodRest.top - F1.y);
    const right = left + sigma * pbox.width, bottom = top + sigma * pbox.height;
    if (left > pb.left + slack || top > pb.top + slack || right < pb.right - slack || bottom < Math.min(pb.bottom, innerHeight) - slack) break;
    c0 = c;
  }
  G.c0 = Math.min(0.94, Math.max(0.8, c0));
  G.c1 = Math.min(0.997, G.c0 + DISSOLVE_SPAN);
  return G;
}

/** Where the camera is at progress c: the foot's place and the two rooms' scales. */
function camera(G, c) {
  const f = travel(c);
  const s = Math.pow(G.k, c);
  return { Fx: G.F0.x + (G.F1.x - G.F0.x) * f, Fy: G.F0.y + (G.F1.y - G.F0.y) * f, s, sigma: s / G.k };
}
const dissolveOf = (G, c) => smoother(G.c0, G.c1, c);

const px = (v) => `${v.toFixed(3)}px`;

/** Every layer's style for one state of the move. */
function compose(G, st) {
  const out = [];
  const c = st.c;
  const { Fx, Fy, s, sigma } = camera(G, c);
  const d = dissolveOf(G, c);
  // The arriving room is drawn from the first frame at a trace of opacity, so its picture is decoded and
  // rasterised at the click (where the camera barely moves), never at the dissolve.
  const arriving = Math.max(d, 0.003);
  // While the rooms dissolve, the collection's pedestal widens to the single room's, about the foot.
  const sh = s * (1 + (G.R - 1) * d);
  const P = G.homeRest, Q = G.prodRest;
  out.push([home.plate, {
    transform: `translate(${px(Fx + sh * (P.left - G.F0.x) - P.left)}, ${px(Fy + sh * (P.top - G.F0.y) - P.top)}) scale(${sh.toFixed(5)})`,
    // No filter at all until the dissolve: a filtered plate would draw its video through a 1x surface.
    filter: d > 0 && ROOM_BLUR ? `blur(${((ROOM_BLUR * d) / sh).toFixed(3)}px)` : "none",
  }]);
  out.push([product.plate, { transform: `translate(${px(Fx + sigma * (Q.left - G.F1.x) - Q.left)}, ${px(Fy + sigma * (Q.top - G.F1.y) - Q.top)}) scale(${sigma.toFixed(5)})` }]);
  out.push([product.room, { opacity: arriving }]);
  out.push([product.fade, { opacity: arriving }]);
  out.push([product.ground, { opacity: arriving }]);
  out.push([product.castHome, { opacity: 1 - d }]);
  out.push([product.castRoom, { opacity: d }]);
  // The hover lift the vial had when it was clicked, set down as the camera starts.
  out.push([product.glass, { transform: `translateY(${px((G.lift0 * (1 - smooth(0, 0.4, c))) / sigma)})` }]);
  const r = soften(c);
  for (const n of G.neighbours) {
    out.push([n.el, { filter: `blur(${((BLUR_MAX * n.w * r) / s).toFixed(3)}px)`, opacity: 1 - DIM_MAX * n.w * r }]);
  }
  const drift = px((1 - st.copy) * T.copyDrift);
  // The lead and the way in are animated themselves: on a portrait screen their wrapper has no box (display: contents).
  for (const el of [home.head, home.lead, home.actions]) out.push([el, { opacity: st.copy, transform: `translateY(${drift})` }]);
  product.rise.forEach((el, i) => {
    const p = st.panel[i];
    // A trace of opacity rather than none, so the details' text is rasterised at the click, not as it rises.
    out.push([el, { opacity: Math.max(p, 0.003), transform: `translateY(${px((1 - p) * T.panelRise)})` }]);
  });
  return out;
}

const panelCount = () => product.rise.length;

/** When the camera reaches progress c on its forward ease, in ms. */
function cameraTime(c) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (EASE_CAMERA(mid) < c) lo = mid; else hi = mid; }
  return hi * T.camera;
}

function forwardPath(G) {
  const n = panelCount();
  // The details rise as the single room starts to come through, never over the collection alone.
  const start = Math.max(T.panelStart, cameraTime(G.c0) - 40);
  const duration = ms(Math.max(T.camera, start + (n - 1) * T.panelStagger + T.panelDur));
  return {
    duration,
    at: (t) => ({
      c: EASE_CAMERA(clamp01(t / ms(T.camera))),
      copy: 1 - EASE_LEAVE(clamp01(t / ms(T.copyOut))),
      panel: Array.from({ length: n }, (_, i) => EASE_ENTER(clamp01((t - ms(start + i * T.panelStagger)) / ms(T.panelDur)))),
    }),
  };
}

function backPath() {
  const n = panelCount();
  const copyStart = T.backDelay + T.copyInAt * T.camera;
  const duration = ms(Math.max(T.backDelay + T.camera, copyStart + T.copyInDur));
  return {
    duration,
    at: (t) => ({
      c: 1 - EASE_CAMERA(clamp01((t - ms(T.backDelay)) / ms(T.camera))),
      copy: EASE_ENTER(clamp01((t - ms(copyStart)) / ms(T.copyInDur))),
      panel: Array.from({ length: n }, (_, i) => 1 - EASE_IN(clamp01((t - ms(i * 12)) / ms(T.panelOut)))),
    }),
  };
}

/**
 * Re-aim a move from wherever it is: toward the product (`in`) or back to the opening (`out`), quickly
 * (a second click) or at the camera's own pace (a change of mind). The camera leaves with the speed it
 * had, so nothing jerks: a cubic from (c, velocity) to rest, never past the end it is heading for.
 */
function turnPath(st, v, dir, quick) {
  const target = dir === "in" ? 1 : 0;
  const dist = Math.abs(target - st.c);
  const D = quick ? ms(Math.max(140, T.hurry * Math.min(1, dist * 2.5))) : ms(Math.max(360, T.camera * dist * 1.05));
  const toward = Math.sign(target - st.c) === Math.sign(v);
  let m = v * D;
  if (toward) m = Math.sign(m) * Math.min(Math.abs(m), 3 * dist);
  else m *= 0.5;
  const n = st.panel.length;
  const panelDelay = dir === "in" ? (quick ? 0 : Math.max(0, D - ms(440))) : 0;
  const panelDur = ms(quick ? 220 : dir === "in" ? 400 : 180);
  const copyDelay = dir === "out" ? (quick ? Math.max(0, D - ms(220)) : D * 0.58) : 0;
  const copyDur = ms(dir === "out" ? (quick ? 220 : 380) : 200);
  const duration = Math.max(D, panelDelay + ms(30) * (n - 1) + panelDur, copyDelay + copyDur);
  return {
    duration,
    at: (t) => ({
      c: clamp01(hermite(st.c, m, target, clamp01(t / D))),
      copy: dir === "in"
        ? st.copy * (1 - EASE_LEAVE(clamp01(t / copyDur)))
        : st.copy + (1 - st.copy) * EASE_ENTER(clamp01((t - copyDelay) / copyDur)),
      panel: st.panel.map((p0, i) => (dir === "in"
        ? p0 + (1 - p0) * EASE_ENTER(clamp01((t - panelDelay - ms(30) * i) / panelDur))
        : p0 * (1 - EASE_IN(clamp01(t / panelDur))))),
    }),
  };
}

function play(path, G, dir) {
  const N = Math.max(2, Math.ceil(path.duration / STEP) + 1);
  const frames = new Map();
  for (let i = 0; i < N; i++) {
    const offset = i / (N - 1);
    for (const [el, props] of compose(G, path.at(offset * path.duration))) {
      if (!frames.has(el)) frames.set(el, []);
      frames.get(el).push({ offset, ...props });
    }
  }
  const old = move?.anims ?? [];
  const anims = [...frames].map(([el, keyframes]) => el.animate(keyframes, { duration: path.duration, easing: "linear", fill: "both" }));
  for (const a of old) a.cancel();
  move = { kind: "camera", dir, path, G, id: G.id, anims };
  note("play", { dir, duration: Math.round(path.duration), k: +G.k.toFixed(3), c0: +G.c0.toFixed(3), c1: +G.c1.toFixed(3), R: +G.R.toFixed(3) });
  const mine = move;
  anims[0].finished.then(() => { if (move === mine) settle(); }).catch(() => undefined);
}

function elapsed() {
  return Math.min(move.path.duration, Math.max(0, Number(move.anims[0].currentTime) || 0));
}

function retarget(dir, quick = false) {
  if (!move) return;
  if (move.kind === "fade") {
    if (move.dir === dir) { for (const a of move.anims) a.finish(); return; }
    for (const a of move.anims) a.reverse();
    move.dir = dir;
    return;
  }
  const t = elapsed();
  const st = move.path.at(t);
  const h = ms(6);
  const v = (move.path.at(Math.min(move.path.duration, t + h)).c - move.path.at(Math.max(0, t - h)).c) / (Math.min(move.path.duration, t + h) - Math.max(0, t - h) || 1);
  views.dataset.moving = dir === "out" ? "out" : "";
  note("retarget", { from: move.dir, dir, quick, at: Math.round(t), c: +st.c.toFixed(3) });
  play(turnPath(st, v, dir, quick), move.G, dir);
}

const hurry = () => move && retarget(move.dir, true);

function lockViews(on) {
  if (on) views.dataset.moving = "";
  else delete views.dataset.moving;
}

/** The move ends: the view it was heading for becomes the page. */
function settle() {
  const { dir, G, anims, kind } = move;
  move = null;
  for (const a of anims) a.cancel();
  lockViews(false);
  home.el.style.transform = "";
  product.el.style.transform = "";
  if (G) G.hv.el.style.visibility = "";
  if (dir === "in") {
    home.el.hidden = true;
    pauseVideo(home.video);
    playVideo(product.video);
    current = { view: "product", id: product.id };
    product.heading.focus({ preventScroll: true });
  } else {
    product.el.hidden = true;
    pauseVideo(product.video);
    playVideo(home.video);
    current = { view: "home", id: null };
    if (G?.hv?.el.isConnected) G.hv.el.focus({ preventScroll: true });
    document.title = "TrueMark BioLabs";
  }
  note("settle", { dir, kind });
}

/** Into a product from the opening: the camera moves in on its vial. */
function goProduct(id, { push = true } = {}) {
  if (move) {
    if (move.id === id && move.dir === "out") retarget("in");
    else hurry();
    return;
  }
  if (current.view === "product") { if (id !== current.id) swapProduct(id, { push }); return; }
  fillProduct(id);
  if (push) history.pushState({ view: "product", id }, "", urlFor(id));
  document.title = `${byId.get(id).name} ${byId.get(id).size} · TrueMark BioLabs`;
  const hv = home.vials.get(id);
  if (reduced() || !hv || !inView(hv.el)) return fade("in");
  // Both views drawn, at rest, the page at its top; the opening held where it was if it had scrolled.
  const scrolled = scrollY;
  product.el.hidden = false;
  lockViews(true);
  if (scrolled) { scrollTo(0, 0); home.el.style.transform = `translateY(${-scrolled}px)`; }
  layoutProduct();
  const G = geometry(id, { lift: true });
  // Both loops hold still while the camera moves; the product's waits at its first frame, which is its still.
  pauseVideo(home.video);
  pauseVideo(product.video);
  try { product.video.currentTime = 0; } catch { /* not loaded yet: it starts at 0 anyway */ }
  hv.el.style.visibility = "hidden";
  note("start", { dir: "in", id, scrolled });
  play(forwardPath(G), G, "in");
}

/** Back to the opening: the camera pulls out to where it started. */
function goHome() {
  if (move) { retarget("out"); return; }
  if (current.view === "home") return;
  const id = current.id;
  // The opening is laid out first, so we know where the vial stands there.
  home.el.hidden = false;
  lockViews(true);
  layoutHome();
  const hv = home.vials.get(id);
  const vialBox = product.vial.getBoundingClientRect();
  const seen = vialBox.bottom > 0 && vialBox.top < innerHeight * 0.75;
  if (reduced() || !hv || !seen) return fade("out");
  const scrolled = scrollY;
  if (scrolled) { scrollTo(0, 0); product.el.style.transform = `translateY(${-scrolled}px)`; }
  const G = geometry(id, { lift: false });
  views.dataset.moving = "out";
  pauseVideo(product.video);
  pauseVideo(home.video);
  hv.el.style.visibility = "hidden";
  note("start", { dir: "out", id, scrolled });
  play(backPath(), G, "out");
}

/** Reduced motion, or no vial to travel: the page simply crossfades. */
function fade(dir) {
  home.el.hidden = false;
  product.el.hidden = false;
  lockViews(true);
  const scrolled = scrollY;
  if (scrolled) { scrollTo(0, 0); (dir === "in" ? home.el : product.el).style.transform = `translateY(${-scrolled}px)`; }
  if (dir === "in") layoutProduct(); else layoutHome();
  const a = product.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(T.fade), easing: "ease-out", fill: "both", direction: dir === "in" ? "normal" : "reverse" });
  move = { kind: "fade", dir, anims: [a], id: product.id };
  note("start", { dir, kind: "fade" });
  const mine = move;
  a.finished.then(() => { if (move === mine) settle(); }).catch(() => undefined);
}

/** One product to another (the related list): a short crossfade of the page under the chrome. */
async function swapProduct(id, { push = true } = {}) {
  if (move || id === product.id) return;
  if (push) history.pushState({ view: "product", id }, "", urlFor(id));
  const quick = ms(reduced() ? 120 : 160);
  move = { kind: "swap", dir: "in", anims: [], id };
  await product.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: quick, easing: "ease-in", fill: "forwards" }).finished.catch(() => undefined);
  fillProduct(id);
  scrollTo(0, 0);
  layoutProduct();
  document.title = `${byId.get(id).name} ${byId.get(id).size} · TrueMark BioLabs`;
  const a = product.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(220), easing: "ease-out" });
  for (const old of product.el.getAnimations()) if (old !== a) old.cancel();
  await a.finished.catch(() => undefined);
  move = null;
  current = { view: "product", id };
  product.heading.focus({ preventScroll: true });
}

/** Straight to a view, no animation: Safari's own swipe-back has already shown the way. */
function snapTo(want) {
  if (move) { for (const a of move.anims) a.cancel(); if (move.G) move.G.hv.el.style.visibility = ""; move = null; }
  lockViews(false);
  home.el.style.transform = product.el.style.transform = "";
  if (want.view === "product") {
    fillProduct(want.id);
    product.el.hidden = false;
    home.el.hidden = true;
    layoutProduct();
    pauseVideo(home.video);
    playVideo(product.video);
    current = { view: "product", id: want.id };
  } else {
    home.el.hidden = false;
    product.el.hidden = true;
    layoutHome();
    pauseVideo(product.video);
    playVideo(home.video);
    current = { view: "home", id: null };
  }
  note("snap", { view: want.view });
}

function inView(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
}

/* ---------- Addresses ---------- */

function urlFor(id) {
  const q = new URLSearchParams(location.search);
  if (id) q.set("product", id); else q.delete("product");
  const s = q.toString();
  return `${location.pathname}${s ? `?${s}` : ""}`;
}
function parse() {
  const id = new URLSearchParams(location.search).get("product");
  return id && byId.has(id) ? { view: "product", id } : { view: "home", id: null };
}

addEventListener("popstate", (event) => {
  const want = parse();
  note("popstate", { view: want.view, ua: Boolean(event.hasUAVisualTransition) });
  if (event.hasUAVisualTransition) { snapTo(want); return; }
  if (want.view === "home") goHome();
  else if (move?.kind === "camera" && move.dir === "out" && move.id === want.id) retarget("in");
  else if (current.view === "home" && !move) goProduct(want.id, { push: false });
  else if (!move) swapProduct(want.id, { push: false });
  else snapTo(want);
});

/** The logo and "The collection": back if the opening is the page before this one, otherwise a new entry. */
for (const link of document.querySelectorAll("[data-home]")) {
  link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (current.view === "home" && !move) return;
    if (history.state?.view === "product" && history.state.from === "home") history.back();
    else { history.pushState({ view: "home" }, "", urlFor(null)); goHome(); }
  });
}
for (const link of document.querySelectorAll("[data-inert]")) link.addEventListener("click", (event) => event.preventDefault());

// While the camera moves, a click (a second tap, a double click) finishes the move quickly.
document.addEventListener("click", (event) => {
  if (!move || move.kind === "swap" || event.target.closest?.(".study")) return;
  event.preventDefault();
  event.stopPropagation();
  hurry();
}, true);
// Escape turns the camera back; the page under it stays put.
addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !move || move.dir !== "in") return;
  event.preventDefault();
  history.back();
});
for (const type of ["wheel", "touchmove"]) addEventListener(type, (event) => { if (move) event.preventDefault(); }, { passive: false });

/* ---------- Start ---------- */

buildProductGlass();
// The product rooms' stills are decoded ahead, so the first move never waits on them.
for (const room of [SINGLE, SINGLE_TALL]) { const still = new Image(); still.src = room.poster; still.decode().catch(() => undefined); }
history.replaceState({ ...(history.state ?? {}), ...parse() }, "");
// pushState from the opening marks where it came from, so the logo can go back.
const push = history.pushState.bind(history);
history.pushState = (state, unused, url) => push(state?.view === "product" && current.view === "home" ? { ...state, from: "home" } : state, unused, url);

function relayout() {
  if (move) { hurry(); return; }
  if (!home.el.hidden) layoutHome();
  if (!product.el.hidden) layoutProduct();
}
snapTo(parse());
document.fonts?.ready.then(relayout);
let resizeFrame = 0;
addEventListener("resize", () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(relayout); });
for (const q of Object.values(mq)) q.addEventListener("change", relayout);

const study = $("#study");
for (const b of study.querySelectorAll("button")) {
  b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === slow));
  b.addEventListener("click", () => {
    slow = Number(b.dataset.speed);
    try { sessionStorage.setItem("flight-slow", String(slow)); } catch { /* this visit only */ }
    for (const x of study.querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
  });
}
if (new URLSearchParams(location.search).has("clean")) study.hidden = true;

window.flight = { goProduct, goHome, hurry, get state() { return { current, moving: move ? { dir: move.dir, kind: move.kind, id: move.id } : null }; }, T };
document.documentElement.dataset.ready = "";
