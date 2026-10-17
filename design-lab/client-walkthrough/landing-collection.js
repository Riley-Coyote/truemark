import { compoundClasses, products } from '/src/data.ts';

// A single collection display. The supplied product artwork is never altered.
// This module only runs inside the isolated sample-data walkthrough.
export function createCollection(doc, index) {
  const win = doc.defaultView;
  const compact = win.matchMedia('(max-width: 700px)');
  const categories = compoundClasses.filter(c => c.onHome);
  const node = (tag, className, text) => {
    const el = doc.createElement(tag); el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const arrow = () => {
    const el = node('span', 'lc-arrow', '↗'); el.setAttribute('aria-hidden', 'true'); return el;
  };
  const wrap = node('div', 'lc-collection');
  const list = node('ol', 'lc-collection-list');
  list.setAttribute('aria-label', 'Compound classes');
  const panel = node('div', 'lc-collection-display'); panel.id = 'lc-collection-display';
  panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Featured compound');
  const stage = node('div', 'lc-collection-stage');
  const atmosphere = node('div', 'lc-collection-atmosphere');
  const photo = node('img', 'lc-collection-room');
  photo.src = '/design-photography/04-studio-backgrounds/lilac-single-plinth/hero-16x9--66a68a2f.png';
  photo.alt = ''; photo.draggable = false;
  const seat = node('div', 'lc-collection-seat');
  const shade = node('span', 'lc-collection-contact'); shade.setAttribute('aria-hidden', 'true');
  seat.append(shade);
  const caption = node('div', 'lc-collection-caption');
  const overline = node('p', 'lc-collection-overline', 'In this class');
  const name = node('h3', 'lc-collection-name'); name.id = 'lc-collection-name';
  const specimens = node('div', 'lc-collection-specimens'); specimens.setAttribute('aria-label', 'Featured compounds');
  const detail = node('a', 'lc-collection-product'); detail.append(node('span', '', 'View compound'), arrow());
  const all = node('a', 'lc-collection-all'); all.append(node('span', '', 'Explore class'), arrow());
  const actions = node('div', 'lc-collection-actions'); actions.append(all, detail);
  caption.append(overline, name, specimens, actions);
  atmosphere.append(photo); stage.append(atmosphere, seat); panel.append(stage, caption);
  const missing = node('p', 'lc-collection-missing', 'Product image unavailable. You can still explore this class.');
  missing.hidden = true; stage.append(missing);
  const rows = [], buttons = [], images = new Map();
  let active = -1, selectedProduct, disposed = false;

  // Keep one original image for each compound rather than repeating every size.
  const members = category => {
    const seen = new Set();
    return (category.productIds || []).flatMap(id => {
      const p = products.find(p => p.id === id && p.active !== false);
      if (!p || seen.has(p.name)) return [];
      seen.add(p.name); return [p];
    });
  };
  for (const c of categories) for (const p of members(c)) {
    const img = node('img', 'lc-collection-vial');
    img.src = p.image.replace('/images/products/', '/images/cutouts/').replace(/\.png$/, '.webp');
    img.alt = ''; img.draggable = false; img.decoding = 'async';
    img.width = 578; img.height = 1112; img.setAttribute('aria-hidden', 'true');
    img.addEventListener('error', () => { img.dataset.failed = ''; if (selectedProduct === p.id) missing.hidden = false; });
    images.set(p.id, img); seat.append(img);
  }

  function feature(product) {
    if (!product || disposed) return;
    selectedProduct = product.id;
    for (const [id, img] of images) {
      const selected = id === product.id;
      img.classList.toggle('is-selected', selected);
      img.alt = selected ? `${product.name}, ${product.size} research vial` : '';
      img.setAttribute('aria-hidden', String(!selected));
    }
    name.textContent = product.name;
    detail.href = `/product/${product.id}`;
    detail.setAttribute('aria-label', `View ${product.name}, ${product.size}`);
    overline.textContent = `Featured compound / ${product.size}`;
    missing.hidden = !images.get(product.id)?.hasAttribute('data-failed');
    for (const button of specimens.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.product === product.id));
  }

  function positionPanel() {
    if (compact.matches) rows[active]?.append(panel);
    else wrap.append(panel);
    for (const [i, b] of buttons.entries()) {
      if (compact.matches) b.setAttribute('aria-expanded', String(i === active));
      else b.removeAttribute('aria-expanded');
    }
  }

  function select(i, reveal = false) {
    if (i === active || disposed) return;
    active = i;
    const category = categories[i];
    for (const [j, row] of rows.entries()) {
      row.classList.toggle('is-selected', j === i);
      buttons[j].setAttribute('aria-pressed', String(j === i));
    }
    panel.setAttribute('aria-label', `${category.name} featured compound`);
    all.href = `/products?class=${category.id}`;
    all.setAttribute('aria-label', `Explore ${category.name}`);
    const compoundButtons = members(category).map(p => {
      const button = node('button', 'lc-specimen', p.name); button.type = 'button';
      button.dataset.product = p.id; button.setAttribute('aria-label', `Preview ${p.name}`);
      button.onclick = () => feature(p); return button;
    });
    specimens.replaceChildren(...compoundButtons);
    // Even a single-compound class keeps the same caption height and link positions.
    specimens.hidden = compoundButtons.length < 2;
    feature(members(category)[0]); positionPanel();
    if (compact.matches && reveal) win.requestAnimationFrame(() => {
      if (disposed || active !== i) return;
      const header = doc.querySelector('.tm-header')?.getBoundingClientRect().height || 68;
      // Collapsing the previous inline display changes the selected row's
      // document position. Keep the new selection and its image together.
      win.scrollTo({ top: rows[i].getBoundingClientRect().top + win.scrollY - header - 12, behavior: 'instant' });
    });
  }

  categories.forEach((c, i) => {
    const row = node('li', 'lc-collection-row');
    const line = node('div', 'lc-collection-line');
    const selectButton = node('button', 'lc-collection-select'); selectButton.type = 'button';
    selectButton.setAttribute('aria-label', `Preview ${c.name}`);
    selectButton.setAttribute('aria-controls', panel.id);
    const number = node('span', 'lc-collection-number', String(i + 1).padStart(2, '0'));
    const text = node('span', 'lc-collection-label');
    text.append(node('span', 'lc-collection-title', c.name), node('span', 'lc-collection-members', c.members));
    selectButton.append(number, text);
    selectButton.onclick = () => select(i, true);
    // The list is deliberate selection, not an autoplay carousel or a hover trap.
    selectButton.onkeydown = event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (i + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus({ preventScroll: true }); select(next, true);
      buttons[next].scrollIntoView({ block: 'nearest', behavior: 'instant' });
    };
    const link = node('a', 'lc-collection-link'); link.href = `/products?class=${c.id}`;
    link.setAttribute('aria-label', `Explore ${c.name}`); link.append(arrow());
    line.append(selectButton, link); row.append(line); list.append(row);
    rows.push(row); buttons.push(selectButton);
  });
  wrap.append(list, panel); index.append(wrap); select(0);
  compact.addEventListener('change', positionPanel);
  return { destroy() { disposed = true; compact.removeEventListener('change', positionPanel); wrap.remove(); } };
}
