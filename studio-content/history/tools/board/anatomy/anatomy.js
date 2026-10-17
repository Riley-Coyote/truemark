/*
 * Anatomy of a vial, test 1. The page's scroll plays the rendered tour: each scroll position names a frame (with holds
 * where there is something to read), the film eases toward it, and neighbouring frames are blended so a slow scroll
 * never steps. The label's places come from the render (track.json), so the lines land on the printed lot and the QR.
 */
(() => {
  const FRAMES = 360;
  const scroller = document.getElementById("scroll");
  const DIR = scroller.dataset.dir || "phone/";
  const VW = +(scroller.dataset.vw || 390), VH = +(scroller.dataset.vh || 844);
  const canvas = document.getElementById("film");
  const ctx = canvas.getContext("2d");
  const phone = document.getElementById("phone");
  const dot = document.getElementById("dot");
  const lead = document.getElementById("lead");
  const loading = document.getElementById("loading");
  const beats = [...document.querySelectorAll(".beat")];
  const items = [...document.querySelectorAll("#beatlist li")];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // scroll position (0..1) -> frame, holding where the words need reading
  const KEYS = [[0, 1], [0.05, 1], [0.20, 130], [0.27, 165], [0.36, 215], [0.43, 215], [0.50, 265], [0.57, 265], [0.64, 300], [0.86, 300], [0.96, 360], [1, 360]];
  const frameAt = (p) => {
    for (let i = 1; i < KEYS.length; i++) {
      const [p1, f1] = KEYS[i - 1], [p2, f2] = KEYS[i];
      if (p <= p2) {
        const t = p2 === p1 ? 1 : (p - p1) / (p2 - p1);
        const s = t * t * (3 - 2 * t);
        return f1 + (f2 - f1) * s;
      }
    }
    return FRAMES;
  };

  const imgs = new Array(FRAMES + 1);
  let loaded = 0;
  const name = (f) => `${DIR}f${String(f).padStart(4, "0")}.jpg`;
  const order = [];
  for (let step = 32; step >= 1; step = Math.floor(step / 2)) for (let f = 1; f <= FRAMES; f += step) if (!order.includes(f)) order.push(f);
  let next = 0;
  const pump = () => {
    while (next < order.length && next - loaded < 12) {
      const f = order[next++];
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { imgs[f] = im; loaded++; if (f === 1) { draw(true); loading.classList.add("done"); } pump(); };
      im.onerror = () => { loaded++; pump(); };
      im.src = name(f);
    }
  };

  let track = null;
  fetch(DIR + "track.json").then((r) => r.json()).then((t) => { track = t; }).catch(() => {});

  // the HPLC trace: a quiet baseline, one main peak at 7.710 min on a 0-12 min axis
  const trace = document.getElementById("trace");
  (() => {
    const W = 300, H = 64, pts = [];
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 12;
      let y = 0.012 * Math.sin(i * 1.7) + 0.008 * Math.sin(i * 0.53);
      y += 1.0 * Math.exp(-((t - 7.71) ** 2) / (2 * 0.045 ** 2));
      y += 0.035 * Math.exp(-((t - 6.92) ** 2) / (2 * 0.05 ** 2));
      y += 0.02 * Math.exp(-((t - 8.6) ** 2) / (2 * 0.06 ** 2));
      pts.push([(i / 300) * W, H - 4 - y * (H - 10)]);
    }
    trace.setAttribute("d", "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L"));
    const len = trace.getTotalLength();
    trace.style.strokeDasharray = len;
    trace.style.strokeDashoffset = len;
    trace.dataset.len = len;
  })();

  let target = 1, cur = 1, last = performance.now(), progress = 0;
  const readScroll = () => {
    const max = scroller.offsetHeight - innerHeight;
    progress = Math.min(1, Math.max(0, (scrollY - scroller.offsetTop) / Math.max(1, max)));
    target = frameAt(progress);
  };

  const nearest = (f) => {
    if (imgs[f]) return f;
    for (let d = 1; d < FRAMES; d++) {
      if (imgs[f - d]) return f - d;
      if (imgs[f + d]) return f + d;
    }
    return 0;
  };

  let drawn = -1;
  function draw(force) {
    const a = Math.floor(cur), b = Math.min(FRAMES, a + 1), frac = cur - a;
    const key = Math.round(cur * 20);
    if (!force && key === drawn) return;
    drawn = key;
    const fa = nearest(Math.max(1, a));
    if (!fa) return;
    ctx.globalAlpha = 1;
    ctx.drawImage(imgs[fa], 0, 0, canvas.width, canvas.height);
    if (!reduce && frac > 0.02 && imgs[b] && fa === a) {
      ctx.globalAlpha = frac;
      ctx.drawImage(imgs[b], 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
  }

  function words() {
    let active = null;
    for (const el of beats) {
      const on = progress >= +el.dataset.from && progress <= +el.dataset.to;
      el.classList.toggle("on", on);
      if (on && el.dataset.lead) active = el;
      if (el.classList.contains("cert")) {
        const len = +trace.dataset.len;
        trace.style.transition = on ? "stroke-dashoffset 2.4s cubic-bezier(.3,.6,.2,1) 0.4s" : "none";
        trace.style.strokeDashoffset = on ? 0 : len;
      }
    }
    // the line from the place on the label to its words
    let show = false;
    if (active && track) {
      const f = Math.max(1, Math.min(FRAMES, Math.round(cur)));
      const row = track.frames[f - 1];
      const p = row && row[active.dataset.lead];
      if (p && p[2] > 0.55) {
        const pr = phone.getBoundingClientRect();
        const er = active.getBoundingClientRect();
        const x = p[0] * VW, y = p[1] * VH;
        const side = active.dataset.side === "left";
        const tx = ((side ? er.left : er.left) - pr.left) / pr.width * VW + 2;
        const ty = ((er.top - pr.top) / pr.height) * VH - 10;
        dot.setAttribute("cx", x.toFixed(1));
        dot.setAttribute("cy", y.toFixed(1));
        lead.setAttribute("x1", x.toFixed(1));
        lead.setAttribute("y1", (y + 6).toFixed(1));
        lead.setAttribute("x2", tx.toFixed(1));
        lead.setAttribute("y2", ty.toFixed(1));
        show = true;
      }
    }
    dot.style.transition = lead.style.transition = "opacity 0.4s";
    dot.style.opacity = show ? 0.95 : 0;
    lead.style.opacity = show ? 1 : 0;
    // the beat list follows along
    let idx = 0;
    items.forEach((li, i) => { if (progress >= +li.dataset.at - 0.02) idx = i; });
    items.forEach((li, i) => li.classList.toggle("on", i === idx));
  }

  function tick(now) {
    const dt = Math.min(64, now - last);
    last = now;
    const k = reduce ? 1 : 1 - Math.exp(-dt / 110);
    cur += (target - cur) * k;
    if (Math.abs(target - cur) < 0.01) cur = target;
    draw(false);
    words();
    requestAnimationFrame(tick);
  }

  items.forEach((li) => li.addEventListener("click", () => {
    const max = scroller.offsetHeight - innerHeight;
    scrollTo({ top: scroller.offsetTop + (+li.dataset.at + 0.005) * max, behavior: reduce ? "auto" : "smooth" });
  }));
  addEventListener("scroll", readScroll, { passive: true });
  addEventListener("resize", readScroll);
  readScroll();
  cur = target;
  pump();
  requestAnimationFrame(tick);
})();
