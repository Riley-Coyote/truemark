// Existing local studies, not new product claims or approved production assets.
// Coordinates are measured on each complete photograph, not the hero's crop.
const archive = '/design-photography/';
const studio = '04-studio-backgrounds/lilac-single-plinth/';
const macro = '05-macros-and-materials/';
export const sets = {
  center: { src: archive + studio + 'pedestal-center--2cdaac05.png', ratio: 1, x: 50, y: 46.3, height: 34 },
  left: { src: archive + studio + 'pedestal-single--b713ce91.webp', ratio: 1792 / 2240, x: 40, y: 56.4, height: 30 },
  window: { src: archive + studio + 'p32--e2c25b94.png', ratio: 3840 / 2160, x: 63.7, y: 48, height: 35 },
  portrait: { src: archive + studio + 'hero-9x16--3f651ecb.png', ratio: 1536 / 2752, x: 50, y: 48.2, height: 27 },
};
export const art = [
  { set: 'center', vial: 'retatrutide-10-mg', companions: ['semaglutide-20-mg', 'tirzepatide-30-mg'], material: macro + 'lilac-series-02/06-cap-constellation--8105b24e.png', note: 'Silver caps and glass' },
  { set: 'left', vial: 'bpc-157-10-mg', companions: ['bpc-157-tb-500-10-mg-10-mg'], material: macro + 'lilac-series-02/12-glass-and-dry-powder--d4e8cb3e.png', note: 'Glass and dry powder' },
  { set: 'portrait', vial: 'ghk-cu-100-mg', companions: ['glow-70-mg'], material: macro + 'lilac-series-01/web-variants/powder-blue--09a2b4b3.webp', note: 'Blue powder texture' },
  { set: 'window', vial: 'tesamorelin-10-mg', companions: [], material: macro + 'lilac-series-02/11-frozen-aperture--dfb9c058.png', note: 'Frost on optical glass' },
  { set: 'left', vial: 'mots-c-10-mg', companions: [], material: macro + 'lilac-series-01/02-silver-and-glass--8479180b.png', note: 'Silver and glass' },
  { set: 'center', vial: 'nad-plus-500-mg', companions: [], material: macro + 'lilac-series-02/07-refracted-horizon--945d0cac.png', note: 'Refracted light' },
  { set: 'portrait', vial: 'semax-10-mg', companions: ['selank-10-mg'], material: macro + 'lilac-series-01/web-variants/caustics--41a31776.webp', note: 'Pearl caustics' },
  { set: 'window', vial: 'melanotan-ii-10-mg', companions: [], material: macro + 'lilac-series-02/13-lilac-intersection--c93b3008.png', note: 'Glass on lilac plinths' },
].map(a => ({ ...a, material: archive + a.material }));

export function makeArt(doc, record) {
  const set = sets[record.set];
  const wrap = doc.createElement('span'); wrap.className = 'lc-art'; wrap.setAttribute('aria-hidden', 'true');
  const image = (src, className) => {
    const node = doc.createElement('img'); node.src = src; node.className = className; node.alt = ''; node.loading = className === 'lc-material' ? 'lazy' : 'eager'; node.decoding = 'async'; node.draggable = false;
    node.addEventListener('error', () => { node.hidden = true; wrap.dataset.missing = ''; });
    return node;
  };
  const photo = doc.createElement('span'); photo.className = 'lc-set'; photo.style.aspectRatio = String(set.ratio); photo.dataset.set = record.set;
  photo.append(image(set.src, 'lc-set-photo'));
  const specimens = [{ id: record.vial, x: set.x, y: set.y, h: set.height, front: true }];
  record.companions.forEach((id, index) => specimens.unshift({ id, x: set.x + (index ? 8 : -8), y: set.y - 1.4, h: set.height * .8, front: false }));
  for (const v of specimens) {
    const seat = doc.createElement('span'); seat.className = 'lc-portrait-vial';
    seat.dataset.front = String(v.front);
    seat.style.cssText = `left:${v.x}%;bottom:${100 - v.y}%;width:${v.h / set.ratio * 578 / 1112}%;`;
    seat.append(image(`/images/cutouts/${v.id}.webp`, 'lc-vial-image')); photo.append(seat);
  }
  const free = doc.createElement('span'); free.className = 'lc-free-vial'; free.append(image(`/images/cutouts/${record.vial}.webp`, 'lc-vial-image'));
  wrap.append(photo, image(record.material, 'lc-material'), free);
  return wrap;
}
