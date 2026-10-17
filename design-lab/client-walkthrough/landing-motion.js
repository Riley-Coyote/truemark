import { compoundClasses, products } from '/src/data.ts';
import { collectionIds } from '/src/brand/carousel.ts';

export const motionNames = {
  procession: 'Procession', reel: 'Type reel', depth: 'Depth lanes',
  folio: 'Specimen folio', gallery: 'Light gallery',
};
export const isMotionStudy = name => Object.hasOwn(motionNames, name);

// The lab borrows data and original cutouts; no product code imports this file.
export function createMotionStudy(doc, index, onStatus = () => {}) {
  const win = doc.defaultView;
  const categories = compoundClasses.filter(c => c.onHome).map(c => ({
    ...c, product: products.find(p => p.id === c.vial),
  }));
  const count = categories.length;
  const heroOrder = collectionIds.map(id => categories.findIndex(c => c.product.id === id)).filter(i => i >= 0);
  const carryOrder = [...heroOrder, ...categories.map((_, i) => i).filter(i => !heroOrder.includes(i))];
  const arrivalClass = heroOrder[Math.floor(heroOrder.length / 2)];
  const mod = n => (n % count + count) % count;
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => n * n * n * (n * (n * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const node = (tag, cls, text) => {
    const el = doc.createElement(tag); el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (label, text = label) => {
    const el = node('button', '', text); el.type = 'button'; el.setAttribute('aria-label', label); return el;
  };
  const number = i => String(i + 1).padStart(2, '0');
  const titleLines = [
    ['Metabolic', 'peptides'], ['Peptide', 'fragments'], ['Copper', 'peptides'],
    ['Secretagogue', 'peptides'], ['Mitochondrial', 'peptides'],
    ['Coenzymes', '& cofactors'], ['Neuropeptides'], ['Melanocortin', 'analogs'],
  ];
  function title(i, cls = 'lm-title') {
    const el = node('h3', cls);
    titleLines[i].forEach(line => el.append(node('span', '', line)));
    return el;
  }
  function vial(i, cls = '') {
    const c = categories[i], el = node('div', `lm-vial ${cls}`);
    const img = node('img', '');
    img.src = c.product.image.replace('/images/products/', '/images/cutouts/').replace(/\.png$/, '.webp');
    img.alt = ''; img.width = 578; img.height = 1112; img.draggable = false;
    const missing = node('span', 'lm-image-error', `${c.product.name} · image unavailable`); missing.hidden = true;
    img.onerror = () => { img.hidden = true; missing.hidden = false; };
    el.append(node('span', 'lm-contact'), img, missing); return el;
  }
  const wrap = node('section', 'lm-study'); wrap.setAttribute('aria-label', 'Compound class motion study');
  const header = node('header', 'lm-header');
  const heading = node('h2', '', 'Organized by compound class.');
  const catalog = node('a', '', 'View catalog ↗'); catalog.href = '/products';
  header.append(heading, catalog);
  const stage = node('div', 'lm-stage'); stage.setAttribute('aria-hidden', 'true');
  const caption = node('div', 'lm-caption');
  const kicker = node('p', 'lm-kicker');
  const name = node('h3', 'lm-caption-title');
  const members = node('p', 'lm-members');
  const featured = node('p', 'lm-featured');
  const classLink = node('a', 'lm-class-link', 'Explore class ↗');
  caption.append(kicker, name, members, featured, classLink);
  const controls = node('div', 'lm-controls');
  const progress = node('span', 'lm-progress'); progress.setAttribute('aria-hidden', 'true');
  const progressLine = node('i', ''); progress.append(progressLine);
  const counter = node('span', 'lm-counter'); counter.setAttribute('aria-hidden', 'true');
  const prev = button('Previous class', '←'), play = button('Pause class animation', 'Pause'), next = button('Next class', '→');
  const chooserLabel = node('label', 'lm-chooser'); chooserLabel.append(node('span', 'lm-sr', 'Choose compound class'));
  const chooser = node('select', '');
  categories.forEach((c, i) => { const option = node('option', '', `${number(i)} / ${c.name}`); option.value = i; chooser.append(option); });
  chooserLabel.append(chooser);
  controls.append(chooserLabel, progress, counter, prev, play, next);
  const rail = node('nav', 'lm-class-rail'); rail.setAttribute('aria-label', 'Choose a compound class');
  const railButtons = categories.map((c, i) => {
    const b = button(c.name); b.append(node('span', 'lm-rail-number', number(i)), node('span', '', c.short));
    // button() supplies the accessible name, while visible copy is deliberately concise.
    b.firstChild?.nodeType === 3 && b.firstChild.remove();
    b.onclick = () => select(i); rail.append(b); return b;
  });
  const announcement = node('p', 'lm-sr'); announcement.setAttribute('role', 'status');
  wrap.append(header, stage, caption, controls, rail, announcement); index.append(wrap);

  let settings = {}, mode, active = 0, transition, scrubbed = false, paused = false;
  let enabled = false, story = false, visible = false, reduced = false, contextStill = false, disposed = false;
  let elapsed = 0, raf = 0, lastTime = 0, lastReport = '', captionIndex = -1;
  let actors = [], typePages = [], leaves = [], lights = [], galleryButtons = [];
  const compact = win.matchMedia('(max-width:700px)');
  const reduce = win.matchMedia('(prefers-reduced-motion:reduce)');
  const carriesVials = () => mode === 'procession' && settings.passage === 'carry';
  const sequence = () => carriesVials() ? carryOrder : categories.map((_, i) => i);
  const adjacent = (i, direction = 1) => { const order = sequence(); return order[mod(order.indexOf(i) + direction)]; };

  function build(nextMode) {
    mode = nextMode; wrap.dataset.mode = mode; stage.replaceChildren();
    actors = []; typePages = []; leaves = []; lights = []; galleryButtons = [];
    transition = undefined; scrubbed = false; elapsed = 0; captionIndex = -1;
    if (!isMotionStudy(mode)) return;
    if (mode === 'procession' || mode === 'depth' || mode === 'reel') {
      stage.append(node('div', 'lm-stage-light'), node('div', 'lm-ground'));
      const aperture = mode === 'reel' ? node('div', 'lm-type-aperture') : null;
      if (aperture) stage.append(aperture);
      for (let i = 0; i < count; i++) {
        const actor = node('div', 'lm-actor'); actor.dataset.productId = categories[i].product.id; actor.append(vial(i));
        if (mode === 'procession') actor.append(node('span', 'lm-object-number', number(i)));
        actors.push(actor); stage.append(actor);
        if (mode === 'reel') {
          const page = node('div', 'lm-type-page');
          page.append(node('p', 'lm-kicker', `Compound class / ${number(i)}`), title(i));
          typePages.push(page); aperture.append(page);
        }
      }
    } else if (mode === 'folio') {
      const book = node('div', 'lm-book');
      const cover = node('div', 'lm-folio-cover');
      cover.append(node('span', 'lm-kicker', 'TrueMark BioLabs / Research collection'), node('p', 'lm-folio-intro', 'A precise place\nfor every compound.'), node('span', 'lm-folio-colophon', 'Eight classes.\nOne standard of traceability.'));
      book.append(cover);
      for (let i = 0; i < count; i++) {
        const leaf = node('div', 'lm-leaf');
        const front = node('div', 'lm-leaf-front');
        front.append(node('p', 'lm-kicker', `Compound class / ${number(i)}`), title(i, 'lm-folio-title'), vial(i), node('p', 'lm-folio-members', categories[i].members), node('span', 'lm-folio-number', `${number(i)} / 08`));
        const back = node('div', 'lm-leaf-back'); back.append(node('span', '', 'TRUEMARK'), node('small', '', 'RESEARCH COLLECTION'));
        leaf.append(front, back); leaves.push(leaf); book.append(leaf);
      }
      stage.append(book);
    } else if (mode === 'gallery') {
      const hero = node('div', 'lm-gallery-feature');
      for (let i = 0; i < count; i++) { const actor = node('div', 'lm-gallery-actor'); actor.append(vial(i)); actors.push(actor); hero.append(actor); }
      const grid = node('div', 'lm-gallery-grid');
      // These are real selection controls, so this stage is not decorative.
      stage.removeAttribute('aria-hidden');
      categories.forEach((c, i) => {
        const b = button(`Show ${c.name}`); b.textContent = ''; b.className = 'lm-gallery-item';
        const light = node('span', 'lm-gallery-light'); lights.push(light);
        b.append(light, vial(i), node('span', 'lm-gallery-number', number(i)), node('span', 'lm-gallery-name', c.name));
        b.onclick = () => select(i); grid.append(b); galleryButtons.push(b);
      });
      stage.append(hero, grid);
    }
    if (mode !== 'gallery') stage.setAttribute('aria-hidden', 'true');
    render(); report(); schedule();
  }

  function duration() {
    const base = { procession: settings.drift === 'continuous' ? 8200 : 1650, reel: 680, depth: 1450, folio: 1650, gallery: 1250 }[mode] || 1400;
    return base / (settings.tempo || 1);
  }
  function showCaption(i) {
    if (i === captionIndex) return;
    captionIndex = i;
    const c = categories[i];
    kicker.textContent = `Compound class / ${number(i)}`;
    name.textContent = c.name; members.textContent = c.members;
    featured.textContent = `${c.product.name} · ${c.product.size} shown`;
    classLink.href = `/products?class=${c.id}`;
    classLink.setAttribute('aria-label', `Explore ${c.name}`);
    chooser.value = i; counter.textContent = `${number(i)} / 08`;
    railButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    galleryButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    wrap.dataset.active = c.id;
  }
  function render() {
    if (!isMotionStudy(mode)) return;
    const t = transition?.t || 0, from = transition?.from ?? active, to = transition?.to ?? active;
    const drift = mode === 'procession' && settings.drift === 'continuous';
    const q = drift ? t : ease(t), showing = q < .5 ? from : to;
    showCaption(showing);
    // Links remain anchored; pointer/focus freezes the frame before a target can change.
    caption.style.setProperty('--lm-caption-opacity', transition ? String(.75 + .25 * Math.abs(q * 2 - 1)) : '1');
    const distance = transition?.direction || 1;
    if (mode === 'procession') {
      const order = sequence(), position = order.indexOf(from) + distance * q;
      const carriedPhone = compact.matches && carriesVials();
      const spacing = carriedPhone ? Math.min(190, (win.innerWidth - 115 * .78 * settings.size / 100 - 16) / 2) : compact.matches ? 225 : 315;
      actors.forEach((el, i) => {
        const d = mod(order.indexOf(i) - position + count / 2) - count / 2;
        const abs = Math.abs(d), scale = 1 - Math.min(abs, 1.7) * (carriedPhone ? .22 : compact.matches ? .12 : .18);
        el.style.transform = `translateX(${d * spacing}px) scale(${scale})`;
        el.style.opacity = carriesVials() ? '1' : String(clamp(1.25 - abs * .4));
        el.style.visibility = abs > 2.3 ? 'hidden' : 'visible';
        el.style.filter = carriesVials() ? 'none' : `blur(${Math.max(0, abs - .4) * .45}px)`;
      });
    } else if (mode === 'reel') {
      actors.forEach((el, i) => {
        const selected = i === from || i === to;
        el.style.visibility = selected ? 'visible' : 'hidden';
        const leaving = i === from;
        // Hand off through a brief exposure dip so two sets of glass edges never ghost together.
        const opacity = !transition ? (i === active ? 1 : 0) : leaving ? clamp(1 - q * 2) : clamp(q * 2 - 1);
        el.style.opacity = opacity;
        el.style.transform = `translateY(${transition ? (leaving ? -q : 1 - q) * 46 * distance : 0}px)`;
        const page = typePages[i];
        page.style.visibility = selected ? 'visible' : 'hidden';
        page.style.transform = `translateY(${transition ? (leaving ? -q : 1 - q) * 112 * distance : 0}%)`;
        page.style.opacity = !transition ? opacity : leaving ? 1 - q * q : 1 - (1 - q) ** 2;
      });
    } else if (mode === 'depth') {
      const rest = (i, center) => {
        const d = mod(i - center);
        if (d === 0) return { x: compact.matches ? -33 : -95, y: 20, s: 1, a: 1, b: 0 };
        if (d === 1) return { x: compact.matches ? 103 : 185, y: -65, s: .62, a: .86, b: .65 };
        if (d === 2 && !compact.matches) return { x: 360, y: -112, s: .4, a: .65, b: 1.3 };
        return { x: compact.matches ? 150 : 440, y: -120, s: .28, a: 0, b: 1.8 };
      };
      actors.forEach((el, i) => {
        const a = rest(i, from), b = rest(i, to);
        // The departing foreground recedes on the other side of the incoming path.
        if (transition && i === from && distance > 0) Object.assign(b, { x: compact.matches ? -140 : -300, y: -90, s: .45 });
        if (transition && i === to && distance < 0) Object.assign(a, { x: compact.matches ? -140 : -300, y: -90, s: .45 });
        const x = lerp(a.x, b.x, q), y = lerp(a.y, b.y, q), s = lerp(a.s, b.s, q), opacity = lerp(a.a, b.a, q);
        el.style.transform = `translate(${x}px,${y}px) scale(${s})`;
        el.style.opacity = opacity; el.style.visibility = opacity < .005 ? 'hidden' : 'visible';
        el.style.filter = `blur(${lerp(a.b, b.b, q)}px)`; el.style.zIndex = Math.round(s * 100);
      });
    } else if (mode === 'folio') {
      leaves.forEach((el, i) => {
        const leaving = i === from, arriving = i === to;
        el.style.visibility = leaving || arriving ? 'visible' : 'hidden';
        const turning = distance < 0 ? arriving : leaving;
        el.style.zIndex = turning ? 3 : 2;
        // A stiff photographic leaf, rotating at its spine; the glass never pretends to turn.
        const angle = transition && turning ? -172 * (distance < 0 ? 1 - q : q) : 0;
        el.style.transform = `rotateY(${angle}deg)`;
        el.style.opacity = transition && turning ? String(clamp(distance < 0 ? q / .12 : (1 - q) / .12)) : '1';
        el.style.setProperty('--leaf-shade', String(Math.sin(q * Math.PI) * .24));
        el.style.pointerEvents = 'none';
      });
    } else if (mode === 'gallery') {
      lights.forEach((light, i) => {
        const a = i === from ? 1 : 0, b = i === to ? 1 : 0;
        // On 08→01 (and every other change) illumination crossfades, without scanning unrelated classes.
        const amount = lerp(a, b, q);
        light.style.opacity = amount;
        galleryButtons[i].style.setProperty('--lit', amount);
        actors[i].style.opacity = amount;
        actors[i].style.visibility = amount < .005 ? 'hidden' : 'visible';
      });
    }
    const progressValue = transition ? t : elapsed / Math.max(1, settings.hold * 1000);
    progressLine.style.transform = `scaleX(${clamp(progressValue)})`;
    wrap.dataset.moving = String(!!transition);
  }
  function canRun() { return enabled && visible && !story && !doc.hidden && !reduced; }
  function wantsFrames() { return canRun() && (transition && !scrubbed || !paused && !scrubbed); }
  function schedule() { if (!raf && !disposed && wantsFrames()) raf = win.requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    const dt = lastTime ? Math.min(now - lastTime, 70) : 0; lastTime = now;
    if (!wantsFrames()) { lastTime = 0; report(); return; }
    if (transition) {
      transition.t = clamp(transition.t + dt / duration());
      if (transition.t === 1) { active = transition.to; transition = undefined; elapsed = 0; }
    } else {
      elapsed += dt;
      if (settings.drift === 'continuous' && mode === 'procession' || elapsed >= settings.hold * 1000) begin(adjacent(active), 1);
    }
    render(); report(); schedule();
  }
  function settle() {
    if (transition) active = transition.t < .5 ? transition.from : transition.to;
    transition = undefined; scrubbed = false; elapsed = 0; lastTime = 0;
  }
  function begin(target, direction) {
    if (target === active) return;
    if (reduced) { active = target; transition = undefined; }
    else transition = { from: active, to: target, direction, t: 0 };
  }
  function select(i) {
    paused = true; settle(); active = mod(i); render(); report();
    announcement.textContent = `${categories[active].name}. ${categories[active].members}.`;
  }
  function step(direction) {
    paused = true; settle(); begin(adjacent(active, direction), direction); render(); report(); schedule();
    announcement.textContent = `${categories[transition?.to ?? active].name}.`;
  }
  function toggle() {
    if (reduced) return;
    paused = !paused;
    if (paused) settle();
    else if (scrubbed) settle();
    render(); report(); schedule();
  }
  function freeze() { paused = true; settle(); render(); report(); }
  function report() {
    const reason = reduced ? 'Reduced motion · still' : story ? 'Story open' : !enabled || !visible || doc.hidden ? 'Waiting for view' : paused ? 'Paused' : 'Playing';
    const playing = !paused && canRun();
    const status = { mode, active: captionIndex, playing, paused, reduced, reason, progress: Math.round((transition?.t || 0) * 100) };
    const serialized = JSON.stringify(status);
    if (serialized !== lastReport) {
      lastReport = serialized;
      const text = reduced ? 'Still' : paused ? 'Play' : 'Pause';
      if (play.textContent !== text) play.textContent = text;
      play.setAttribute('aria-label', reduced ? 'Reduced motion enabled' : paused ? 'Play class animation' : 'Pause class animation');
      play.disabled = reduced; onStatus(status);
    }
  }
  prev.onclick = () => step(-1); next.onclick = () => step(1); play.onclick = toggle;
  chooser.onchange = () => select(Number(chooser.value));
  // Resolve a moving composition before its destination can be used. Manual focus never resumes itself.
  classLink.addEventListener('pointerenter', freeze); classLink.addEventListener('pointerdown', freeze); classLink.addEventListener('focus', freeze);
  chooser.addEventListener('pointerdown', freeze); chooser.addEventListener('focus', freeze);
  rail.addEventListener('focusin', freeze);
  stage.addEventListener('focusin', freeze);
  const observed = new win.IntersectionObserver(entries => {
    visible = entries[0].intersectionRatio >= .45; lastTime = 0; report(); schedule();
  }, { threshold: [0, .45, 1] }); observed.observe(stage);
  function visibility() { lastTime = 0; report(); schedule(); }
  function resize() { render(); }
  function reduction() {
    reduced = settings.still || reduce.matches || contextStill;
    if (reduced) settle();
    render(); report(); schedule();
  }
  doc.addEventListener('visibilitychange', visibility); win.addEventListener('resize', resize); compact.addEventListener('change', resize); reduce.addEventListener('change', reduction);
  return {
    update(value) {
      const carriedBefore = carriesVials();
      settings = value; reduced = settings.still || reduce.matches || contextStill;
      if (mode !== settings.cards) build(settings.cards);
      if (carriesVials() && !carriedBefore) { settle(); active = arrivalClass; }
      if (reduced) settle();
      wrap.style.setProperty('--lm-scale', settings.size / 100);
      render(); report(); schedule();
    },
    context(value) {
      if (!enabled && value.enabled) { elapsed = 0; lastTime = 0; }
      enabled = value.enabled; story = value.story;
      if (contextStill !== value.still) { contextStill = value.still; reduction(); }
      if (!canRun()) lastTime = 0; report(); schedule();
    },
    control(action, value) {
      if (action === 'toggle') toggle();
      if (action === 'next') step(1);
      if (action === 'prev') step(-1);
      if (action === 'replay') { paused = true; settle(); begin(adjacent(active), 1); render(); schedule(); }
      if (action === 'scrub') {
        paused = true;
        if (!scrubbed) { settle(); transition = { from: active, to: adjacent(active), direction: 1, t: 0 }; }
        scrubbed = true; transition.t = reduced ? 0 : clamp(value); render(); report();
      }
    },
    resetArrival() {
      if (!carriesVials() || active === arrivalClass && !transition) return;
      // A reverse trip resets only while every vial is below the viewport.
      settle(); active = arrivalClass; render(); report();
    },
    arrivalTargets() {
      if (!carriesVials()) return [];
      return actors.map((actor, i) => ({
        id: categories[i].product.id, actor, image: actor.querySelector('.lm-vial img'),
        visible: actor.style.visibility !== 'hidden',
      }));
    },
    destroy() {
      disposed = true; win.cancelAnimationFrame(raf); observed.disconnect();
      doc.removeEventListener('visibilitychange', visibility); win.removeEventListener('resize', resize); compact.removeEventListener('change', resize); reduce.removeEventListener('change', reduction); wrap.remove();
    },
  };
}
