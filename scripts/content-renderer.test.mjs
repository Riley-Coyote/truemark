import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve, relative } from 'node:path';
import { build } from 'esbuild';
import { readJournalSeed } from './gen-journal-seed.mjs';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
globalThis.BroadcastChannel = undefined;
globalThis.window = new EventTarget();
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

async function bundle(baseline = false) {
  const directory = await mkdtemp('/private/tmp/wp16-renderer-');
  const file = join(directory, 'content.cjs');
  const source = `
    import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter, Routes, Route } from 'react-router-dom';
    import Journal from './src/shop/pages/content/Journal'; import Article from './src/shop/pages/content/Article';
    import { Markdown, markdownBlocks, safeMarkdownUrl } from './src/brand/Markdown';
    import { certificateLibrary } from './src/platform/certificates';
    import { CertificateRows } from './src/brand/CertificateLibrary';
    import { ContentUpload } from './src/admin/ContentUpload';
    import { LotCertificateDrawer } from './src/admin/LotCertificateDrawer';
    import { articles } from './src/brand/articles';
    export { markdownBlocks, safeMarkdownUrl, articles, certificateLibrary };
    export const markdown = (source) => renderToStaticMarkup(<Markdown source={source} />);
    export const certificates = (lots) => renderToStaticMarkup(<MemoryRouter><CertificateRows lots={lots}/></MemoryRouter>);
    export const upload = (file = null, disabled = false) => renderToStaticMarkup(<ContentUpload bucket='certificates' file={file} disabled={disabled} onChange={() => {}} onError={() => {}}/>);
    export const releaseDrawer = (lot) => renderToStaticMarkup(<LotCertificateDrawer lot={lot} onClose={() => {}} onSaved={() => {}}/>);
    export const routedMarkdown = (source) => renderToStaticMarkup(<MemoryRouter initialEntries={['/research-blog/fixture']}><Markdown source={source}/></MemoryRouter>);
    export const page = (url) => renderToStaticMarkup(<MemoryRouter initialEntries={[url]}><Routes><Route path='/research-blog' element={<Journal/>}/><Route path='/research-blog/:id' element={<Article/>}/></Routes></MemoryRouter>);
  `;
  const oldFiles = new Set(['src/shop/pages/content/Journal.tsx', 'src/shop/pages/content/Article.tsx', 'src/brand/JournalCard.tsx', 'src/brand/articles.ts']);
  await build({ stdin: { contents: source, resolveDir: root, loader: 'tsx' }, outfile: file, bundle: true, format: 'cjs', platform: 'node', jsx: 'automatic', loader: { '.css': 'empty' }, logLevel: 'silent',
    define: { 'import.meta.env.VITE_PLATFORM': '"preview"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.BASE_URL': '"./"', 'process.env.NODE_ENV': '"production"' },
    plugins: baseline ? [{ name: 'baseline-journal', setup(plugin) {
      // The brand dot the old article imports from the hero shelf now lives in its own file; the markup is the same.
      plugin.onResolve({ filter: /\/brand\/HeroShelf$/ }, () => ({ path: join(root, 'src/brand/BrandDot.tsx') }));
      plugin.onLoad({ filter: /\/src\/.*\.[jt]sx?$/ }, ({ path }) => {
        const name = relative(root, path);
        if (oldFiles.has(name)) return { contents: execFileSync('git', ['show', `012a29d:${name}`], { cwd: root }).toString(), loader: name.endsWith('.tsx') ? 'tsx' : 'ts' };
      });
    } }] : [],
  });
  return require(file);
}
const current = await bundle();

test('Markdown neutralizes script, raw HTML, unsafe links and image schemes', () => {
  const output = current.markdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[x](javascript:alert%281%29) [y](data:text/html,x)\n\n![x](javascript:alert%281%29)');
  assert(!output.includes('<script')); assert(!output.includes('<img')); assert(!output.includes('href='));
  assert(output.includes('&lt;script&gt;')); assert(output.includes('&lt;img'));
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', '//evil.example', '\\evil.example', 'java\nscript:alert(1)', 'mailto:a@example.test', 'javascript&#58;alert(1)']) {
    const safe = current.safeMarkdownUrl(url);
    if (url === 'javascript&#58;alert(1)') assert(safe && current.markdown(`[x](${url})`).includes('javascript&amp;#58;'));
    else assert.equal(safe, undefined, url);
  }
});
test('Markdown renders headings, unique anchors, emphasis, safe links, lists, quotes, code and image figures', () => {
  const output = current.markdown('## Title\n\n### Detail\n\n## Title\n\n**bold** and *italic* and `code` [external](https://example.test) [local](/verify)\n\n- First\n- Second\n\n1. One\n2. Two\n\n> A quote.\n\n![Fixture](https://example.test/image.png)');
  for (const expected of ['<h2 id="title">', '<h3 id="detail">', '<h2 id="title-2">', '<strong>bold</strong>', '<em>italic</em>', '<code>code</code>', 'href="https://example.test"', 'href="/verify"', '<ul', '<ol', '<blockquote', '<figure', '<figcaption>Fixture</figcaption>']) assert(output.includes(expected), expected);
  for (const url of ['http://example.test', 'https://example.test', '/verify', './photo.png', '../images/photo.png', '#heading']) assert.equal(current.safeMarkdownUrl(url), url);
  const routed = current.routedMarkdown('[Verify](/verify) [Heading](#heading) [PDF](./certificate.pdf)');
  assert(routed.includes('href="/verify"'));
  assert(routed.includes('href="/research-blog/fixture#heading"'));
  assert(routed.includes('href="./certificate.pdf"'));
});
test('all seven seeded bodies retain every source word, table, definition, reference and cover', async () => {
  const seed = await readJournalSeed();
  const decode = (value) => value.replace(/\\([\\`*_\[\]<>|])/g, '$1');
  for (const article of current.articles) {
    const entry = seed.find((item) => item.slug === article.id);
    assert.equal(entry.title, article.title); assert.equal(entry.excerpt, article.dek);
    assert.equal(entry.cover_image, `images/scenes/${article.image.scene}.webp`);
    const blocks = current.markdownBlocks(entry.body_md);
    assert.equal(blocks.length, article.body.length, article.id);
    article.body.forEach((block, i) => {
      const parsed = blocks[i];
      if (['paragraph', 'heading', 'quote'].includes(block.kind)) assert.equal(decode(parsed.text), block.text);
      if (block.kind === 'table') assert.deepEqual(parsed.rows.map((row) => row.map(decode)), block.rows);
      if (block.kind === 'list') assert.deepEqual(parsed.items.map(decode), block.items.map((item) => typeof item === 'string' ? item : `**${item.term}** ${item.text}`));
      if (block.kind === 'references') assert.deepEqual(parsed.items.map(decode), block.items);
      if (block.kind === 'figure') { assert.equal(parsed.url, '#chromatogram'); assert(current.markdown(entry.body_md).includes('tm-trace')); }
    });
    // The body ends where the template's closing line begins (2026-10-06), above the notice.
    const previewBody = current.page(`/research-blog/${article.id}`).split('<div class="tm-article-body">')[1].split('<p class="tm-article-closing">')[0].split('<footer class="tm-article-notice">')[0];
    const textOnly = (html) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    assert.equal(textOnly(current.markdown(entry.body_md)), textOnly(previewBody), `${article.id}: rendered text drift`);
  }
});
test('certificate search ignores case and spaces, matches compound/lot, excludes unreleased lots and sorts newest first', () => {
  const lot = { productId: 'bpc-157-10-mg', status: 'released', results: [], receivedAt: null, units: null, sample: false };
  const list = [{ ...lot, lot: 'FIXTURE-OLD', releasedAt: '2026-09-01' }, { ...lot, lot: 'FIXTURE-NEW', releasedAt: '2026-10-01' }, { ...lot, lot: 'FIXTURE-PRIVATE', status: 'testing' }];
  assert.deepEqual(current.certificateLibrary(list, 'b p C - 157').map((item) => item.lot), ['FIXTURE-NEW', 'FIXTURE-OLD']);
  assert.deepEqual(current.certificateLibrary(list, ' fix ture -n e w ').map((item) => item.lot), ['FIXTURE-NEW']);
  assert.equal(current.certificateLibrary(list, 'no match').length, 0);
});
test('certificate rows retain table headers, vial cutouts, visible metadata, and open a real lot in place or a sample PDF', () => {
  const lot = { lot: 'FIXTURE-PDF', productId: 'bpc-157-10-mg', status: 'released', results: [{ label: 'Purity', method: 'HPLC', value: '99.31', unit: '%' }], releasedAt: '2026-09-29', receivedAt: null, units: null, sample: true };
  const html = current.certificates([{ ...lot, coaUrl: 'https://fixture.test/certificate.pdf' }, { ...lot, lot: 'FIXTURE-LOOKUP', sample: false }]);
  for (const text of ['Compound</th>', 'Lot</th>', 'Released</th>', 'HPLC purity</th>', 'images/cutouts/', '-sm.webp', 'tm-library-size">10 mg', 'tm-mono">FIXTURE-PDF', 'tm-library-sample">Sample', 'dateTime="2026-09-29"', '99.31%', 'View certificate', '→']) assert(html.includes(text), text);
  assert.match(html, /href="https:\/\/fixture.test\/certificate.pdf" target="_blank" rel="noopener noreferrer"/);
  // Round 14: a real lot's certificate opens in place, as a dialog, never as a bare PDF.
  assert.match(html, /<button type="button" class="tm-textlink" aria-haspopup="dialog">View certificate <span aria-hidden="true">→<\/span><span class="sr-only"> for FIXTURE-LOOKUP<\/span><\/button>/);
  assert(!html.includes('Sample record'));
});
test('release fields expose the gate, labelled full-width identity control and the kit PDF picker with filename, limits and disabled state', () => {
  const html = current.releaseDrawer({ lot: 'FIXTURE', productId: 'bpc-157-10-mg', status: 'testing', results: [], receivedAt: null, units: null, sample: false });
  // WP-28: the certificates' own specification, asked for as the certificate reports it.
  assert(html.includes('Releases need HPLC purity of at least 95.0% for every component and an identity that conforms.'));
  for (const field of ['Certificate number', 'Date analyzed (UTC)', 'HPLC purity', 'Content per vial', 'Label claim', '% of label claim', 'MS identity (optional)', 'Endotoxin (optional)', 'Sterility (optional)']) assert(html.includes(`>${field}</label>`), field);
  const label = html.match(/<label class="kit-field-label" for="([^"]+)">Identity \(RT \+ UV vs\. reference\)<\/label>/);
  assert(label); assert(html.includes(`<div class="kit-select cc-select"><select id="${label[1]}"`));
  // A blend lists each component.
  const blend = current.releaseDrawer({ lot: 'FIXTURE', productId: 'glow-70-mg', status: 'testing', results: [], receivedAt: null, units: null, sample: false });
  for (const part of ['GHK-Cu', 'BPC-157', 'TB-500']) assert(blend.includes(`<legend>${part}</legend>`), part);
  assert.equal((blend.match(/>HPLC purity<\/label>/g) ?? []).length, 3);
  const empty = current.upload();
  assert.match(empty, /<input class="kit-sr" tabindex="-1"[^>]*type="file" accept="application\/pdf"/);
  assert.match(empty, /<button type="button" class="kit-button kit-button-quiet"[^>]*>Choose PDF<\/button>/);
  assert(empty.includes('No file chosen')); assert(empty.includes('PDF, up to 10 MB.'));
  const chosen = current.upload(new File(['%PDF fixture'], 'certificate.pdf', { type: 'application/pdf' }), true);
  assert(chosen.includes('certificate.pdf')); assert(chosen.includes('PDF, up to 10 MB.'));
  assert.match(chosen, /<button[^>]*disabled=""[^>]*>Choose PDF<\/button>/);
});
test('preview Research Blog and every article remain byte-identical to 012a29d in server-rendered markup', async () => {
  const base = await bundle(true);
  // The articles' own closing line returned on purpose (2026-10-06, the client's original); everything else matches 012a29d.
  const closing = /<p class="tm-article-closing">[^<]*<\/p>/;
  for (const route of ['/research-blog', ...['quality-testing', 'handling-storage', 'traceability', 'chemistry'].map((category) => `/research-blog?category=${category}`), ...current.articles.map((article) => `/research-blog/${article.id}`)]) {
    assert.equal(current.page(route).replace(closing, ''), base.page(route), route);
  }
  const source = await readFile(join(root, 'src/brand/articles.ts'), 'utf8');
  const withoutClosing = source.replace(/\/\*\* The italic line that closed the client's articles[^\n]*\nexport const articleClosing = [^\n]*\n\n/, '');
  assert.notEqual(withoutClosing, source);
  assert.equal(withoutClosing, execFileSync('git', ['show', '012a29d:src/brand/articles.ts'], { cwd: root }).toString());
});
