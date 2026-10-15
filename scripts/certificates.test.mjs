/** WP-28: the certificate manifest against the client's PDFs, every lot covered, every PDF published unmodified. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const sources = join(root, 'docs/client-documents/certificates');
const published = join(root, 'public/certificates');
const manifest = JSON.parse(await readFile(join(root, 'src/platform/certificate-manifest.json'), 'utf8'));
const { certificates, pending, lab, specification } = manifest;
const hasPdftotext = !spawnSync('pdftotext', ['-v']).error;

const temp = await mkdtemp('/private/tmp/truemark-wp28-');
await build({ entryPoints: [join(root, 'src/data.ts')], outfile: join(temp, 'data.mjs'), bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { products } = await import(pathToFileURL(join(temp, 'data.mjs')));

const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
/** "01OCT2026" as printed (spaces removed) → "2026-10-01". */
const isoDate = (printed) => `${printed.slice(5)}-${months[printed.slice(2, 5)]}-${printed.slice(0, 2)}`;
/** pdftotext's spacing varies by version; compare with whitespace removed. */
const flat = (text) => text.replace(/\s+/g, '');
const sha = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
function pdfText(file) {
  const run = spawnSync('pdftotext', ['-raw', join(sources, file), '-'], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${file}: ${run.stderr}`);
  return run.stdout;
}
function field(text, pattern, name, certificate) {
  const match = text.match(pattern);
  assert(match, `${certificate}: ${name} not found on the certificate`);
  return match;
}

test('transcription: every manifest field matches its PDF, re-extracted with pdftotext', { skip: !hasPdftotext && 'pdftotext is not installed; the transcription was not re-checked' }, () => {
  assert.equal(certificates.length, 20);
  for (const entry of certificates) {
    const raw = pdfText(entry.pdf), text = flat(raw), id = entry.certificate;
    assert.equal(field(text, /Certificate(TB-\d{8}-[A-Z0-9]{4}-\d{2})·Page1of1/, 'certificate number', id)[1], id, `${id}: certificate number`);
    assert.equal(entry.pdf, `${id}.pdf`, `${id}: file name`);
    assert.equal(field(text, /CLIENT\/BRAND(.+?)BATCHID/, 'client', id)[1], flat('TrueMark BioLabs'), `${id}: client`);
    assert.equal(field(text, /CLIENTBATCH\/LOT(TM-[A-Z0-9]+-\d{4}-\d{2})(?:COMPOUND|PRODUCT)/, 'client lot', id)[1], entry.lot, `${id}: lot`);
    const blend = entry.components.length > 1;
    const product = field(text, /(?:COMPOUND|PRODUCT)(.+?)SAMPLE\(ASRUN\)/, 'compound', id)[1];
    assert.equal(product, flat(entry.compound) + (blend ? flat(entry.components.map((c) => c.name).join(' / ')) : ''), `${id}: compound`);
    assert.equal(isoDate(field(text, /DATERECEIVED(\d{2}[A-Z]{3}\d{4})/, 'date received', id)[1]), entry.sampleReceived, `${id}: date received`);
    assert.equal(isoDate(field(text, /DATEANALYZED(\d{2}[A-Z]{3}\d{4})/, 'date analyzed', id)[1]), entry.analyzed, `${id}: date analyzed`);
    assert.equal(isoDate(field(text, /DATEOFISSUE(\d{2}[A-Z]{3}\d{4})/, 'date of issue', id)[1]), entry.issued, `${id}: date of issue`);
    assert.equal(entry.lab, lab.name, `${id}: laboratory`);
    assert(text.includes(flat(`${lab.name} (${lab.company}) is ${lab.description}`)), `${id}: laboratory description`);
    assert(text.includes(flat(`AUTHORIZED SIGNATORY · ${lab.name.toUpperCase()}`)), `${id}: signatory`);
    assert(text.includes(flat(`using validated ${lab.method} methodology`)), `${id}: method`);
    assert(text.includes(flat(`Verify at ${lab.verifyPage.replace('https://', '')}`)), `${id}: verify page`);
    // The QR code was decoded once with a scratchpad tool (no repo dependency); every one is the lab's page for its certificate.
    assert.equal(entry.verifyUrl, `https://kmdanalytical.com/coa/${id}`, `${id}: verify link`);
    // What the certificates do not test, in their own words.
    assert(text.includes(flat('no assessment was made of sterility, endotoxin, microbial, heavy-metal, or residual-solvent content')), `${id}: scope note`);
    assert(text.includes(flat('KMD Analytical is not FDA-registered and does not perform GMP release testing')), `${id}: registration note`);
    assert(!/MASSSPEC|LC-MS|\(MS\)/i.test(text), `${id}: no mass spectrometry`);

    const purities = [...text.matchAll(/Purity(?:\(HPLC,area%\)|—(.+?))≥(\d+\.\d+)%(\d+\.\d+)%Conforms/g)];
    assert.equal(purities.length, entry.components.length, `${id}: purity rows`);
    for (const [index, row] of purities.entries()) {
      const component = entry.components[index];
      assert.equal(row[1] ?? null, component.name && flat(component.name), `${id}: purity row ${index + 1} component`);
      assert.equal(row[2], specification.purity, `${id}: purity specification`);
      assert.equal(row[3], component.purity, `${id}: ${component.name ?? 'purity'}`);
    }
    if (blend) {
      assert(text.includes(flat('Overall: Conforms to specification — each component meets its identity confirmation')), `${id}: overall`);
      const lines = raw.split('\n');
      const start = lines.findIndex((line) => line.startsWith('COMPOUND IDENTITY PURITY'));
      const rows = lines.slice(start + 1, lines.findIndex((line, i) => i > start && line.startsWith('Overall:'))).map(flat);
      assert.equal(rows.length, entry.components.length, `${id}: component rows`);
      for (const [index, line] of rows.entries()) {
        const component = entry.components[index];
        const [, name, claim, identity, purity, content, ofClaim, retentionTime] = field(line, /^(.+?)·label(\d+(?:\.\d+)?)mg(Conforms|Doesnotconform)(\d+\.\d+)%(\d+(?:\.\d+)?)\((\d+(?:\.\d+)?)%\)(\d+\.\d+)$/, `component ${index + 1}`, id);
        assert.deepEqual({ name, claim, identity, purity, content, ofClaim, retentionTime },
          { name: flat(component.name), claim: component.claim, identity: flat(component.identity), purity: component.purity, content: component.content, ofClaim: component.ofClaim, retentionTime: component.retentionTime }, `${id}: ${component.name}`);
        assert.equal(`${component.contentUnit}/${component.claimUnit}`, 'mg per vial/mg', `${id}: ${component.name} units`);
      }
      assert.equal(field(text, /HPLCCHROMATOGRAMRT([\d./]+)min/, 'chromatogram retention times', id)[1], entry.components.map((c) => c.retentionTime).join('/'), `${id}: chromatogram`);
      continue;
    }
    const [component] = entry.components;
    assert.equal(field(text, /CHROMATOGRAPHICPURITY(\d+\.\d+)%OFTOTALPEAKAREA/, 'chromatographic purity', id)[1], component.purity, `${id}: headline purity`);
    assert.equal(field(text, /Overall:Conformstospecification—Identity(Conforms|Doesnotconform)\(RT\+UVvs\.reference\)/, 'identity', id)[1], flat(component.identity), `${id}: identity`);
    assert.equal(field(text, /RETENTIONTIME(\d+\.\d+)MINUTES·MAINPEAK/, 'retention time', id)[1], component.retentionTime, `${id}: retention time`);
    assert.equal(field(text, /mainpeak(\d+\.\d+)min/, 'chromatogram main peak', id)[1], component.retentionTime, `${id}: chromatogram`);
    if (component.contentUnit === 'mg/mL') {
      const [, content, claim, ofClaim, perVial] = field(text, /BENZYLALCOHOLCONTENT—MG\/ML(\d+\.\d+)LABELCLAIM:(\d+)MG\/ML\(0\.9%W\/V\)—(\d+)%OFCLAIM≈(\d+\.\d+)MGPERVIAL\(CALCULATEDFROMLABELEDFILLVOLUMEOF10ML—FILLVOLUMENOTINDEPENDENTLYVERIFIED\)/, 'benzyl alcohol content', id);
      assert.deepEqual({ content, claim, ofClaim, perVial: `≈ ${perVial}` }, { content: component.content, claim: component.claim, ofClaim: component.ofClaim, perVial: component.calculated.value }, `${id}: benzyl alcohol`);
      assert.equal(component.contentLabel, 'Benzyl alcohol content');
      assert.equal(component.claimUnit, 'mg/mL (0.9% w/v)');
      assert.equal(field(text, /Benzylalcoholcontent0\.9%w\/v\(9mg\/mL\)(\d+\.\d+)mg\/mL\((\d+)%ofclaim\)Conforms/, 'benzyl alcohol summary', id).slice(1).join('/'), `${component.content}/${component.ofClaim}`, `${id}: summary row`);
      assert.equal(component.calculated.unit, 'mg per vial');
      continue;
    }
    const [, content, claim, ofClaim] = field(text, /CONTENTPERVIAL(\d+(?:\.\d+)?)MGPERVIALLABELCLAIM:(\d+(?:\.\d+)?)MG—(\d+(?:\.\d+)?)%OFCLAIM/, 'content per vial', id);
    assert.deepEqual({ content, claim, ofClaim }, { content: component.content, claim: component.claim, ofClaim: component.ofClaim }, `${id}: content`);
    assert.equal(field(text, /Content\(mg\/vial\)≥90%oflabelclaim\((\d+(?:\.\d+)?)mg\)(\d+(?:\.\d+)?)mg\((\d+(?:\.\d+)?)%ofclaim\)Conforms/, 'content summary', id).slice(1).join('/'), `${component.claim}/${component.content}/${component.ofClaim}`, `${id}: summary row`);
    assert.equal(`${component.contentUnit}/${component.claimUnit}`, 'mg per vial/mg', `${id}: units`);
  }
});

test('coverage: every product lot has its certificate (or an explicit pending reason); none is pending', async () => {
  const lots = new Map(certificates.map((entry) => [entry.lot, entry]));
  assert.equal(lots.size, certificates.length, 'one certificate per lot');
  assert.equal(new Set(certificates.map((entry) => entry.productId)).size, certificates.length, 'one certificate per product');
  assert.equal(new Set(certificates.map((entry) => entry.certificate)).size, certificates.length, 'certificate numbers are unique');
  // CJC (No DAC) / Ipamorelin is sold at the size its certificate tested (Riley, 2026-10-06), so nothing waits.
  assert.deepEqual(pending, []);
  for (const product of products) {
    const certified = lots.get(product.lot);
    const waiting = pending.find((entry) => entry.productId === product.id);
    assert(Boolean(certified) !== Boolean(waiting), `${product.id}: exactly one of certificate or pending`);
    if (certified) assert.equal(certified.productId, product.id, `${product.lot}: product`);
    else {
      assert.equal(waiting.lot, product.lot, `${product.id}: pending lot`);
      assert(waiting.reason.trim().length > 20, `${product.id}: pending reason`);
    }
  }
  assert.equal(products.length, certificates.length + pending.length);
  // The live seed carries the same lots for the same products, but for CJC's first listing, which
  // 20261006000100_cjc_tested_size.sql moves to the lot its certificate tested.
  const seed = await readFile(join(root, 'supabase/migrations/20261001000100_seed.sql'), 'utf8');
  const seeded = [...seed.matchAll(/\('(TM-[A-Z0-9-]+)', '([a-z0-9-]+)', 'testing', '\[\]'\)/g)].map(([, lot, id]) => `${lot} ${id}`).sort();
  const firstListing = (product) => (product.id === 'cjc-ipa-1010-mg' ? { ...product, lot: 'TM-CJI10-2609-01' } : product);
  assert.deepEqual(seeded, products.map(firstListing).map((product) => `${product.lot} ${product.id}`).sort());
  const moved = await readFile(join(root, 'supabase/migrations/20261006000100_cjc_tested_size.sql'), 'utf8');
  assert.match(moved, /update public\.products set size = '5 mg \/ 5 mg', lot = 'TM-CJI5-2609-01'\s+where id = 'cjc-ipa-1010-mg' and lot = 'TM-CJI10-2609-01'/);
  const cjc = products.find((product) => product.id === 'cjc-ipa-1010-mg');
  assert.deepEqual([cjc.size, cjc.lot], ['5 mg / 5 mg', 'TM-CJI5-2609-01']);
  // Every PDF the client sent is accounted for.
  const files = (await readdir(sources)).filter((name) => name.endsWith('.pdf')).sort();
  assert.deepEqual(files, [...certificates.map((entry) => entry.pdf), ...pending.map((entry) => entry.pdf)].sort());
});

test('pdfs_published: public/certificates holds every certificate by lot, byte for byte, and nothing else', async () => {
  const files = (await readdir(published)).sort();
  assert.deepEqual(files, certificates.map((entry) => `${entry.lot}.pdf`).sort());
  for (const entry of certificates) assert.equal(await sha(join(published, `${entry.lot}.pdf`)), await sha(join(sources, entry.pdf)), entry.lot);
  for (const entry of pending) assert(!files.includes(`${entry.lot}.pdf`) && !files.includes(entry.pdf));
});
