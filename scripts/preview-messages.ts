/** Render the actual templates against synthetic records. No credentials or provider calls. */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderTemplate, escapeHtml } from '../supabase/functions/messages/templates.ts';
import { fixture, emailTemplates, smsTemplates } from './fixtures/messages.ts';

const root = resolve(import.meta.dirname, '..'), output = resolve(root, 'dist/message-preview');
await mkdir(resolve(output, 'assets'), { recursive: true });
await copyFile(resolve(root, 'public/images/brand/email/lockup-black@2x.png'), resolve(output, 'assets/logo.png'));
const e = escapeHtml, manifest: { template: string; subject?: string; file: string; textFile?: string }[] = [];
const proof = (html: string) => html.replace('<html>', '<html lang="en">').replace('<body',
  '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>TrueMark message preview</title></head><body')
  .replaceAll(fixture.site + 'images/brand/email/lockup-black@2x.png', './assets/logo.png');
for (const template of emailTemplates) {
  const rendered = renderTemplate(template, fixture), file = template + '.html', textFile = template + '.txt';
  await writeFile(resolve(output, file), proof(rendered.html!));
  await writeFile(resolve(output, textFile), rendered.text);
  manifest.push({ template, subject: rendered.subject, file, textFile });
}
for (const [template, subject] of [['confirm-signup', 'Confirm your email for TrueMark'], ['reset-password', 'Reset your TrueMark password']]) {
  const html = (await readFile(resolve(root, `supabase/templates/${template}.html`), 'utf8'))
    .replaceAll('{{ .SiteURL }}', fixture.site).replaceAll('{{ .TokenHash }}', 'fixture-token-never-valid');
  const file = template + '.html';
  await writeFile(resolve(output, file), proof(html));
  manifest.push({ template, subject, file });
}
const sms = smsTemplates.map(template => ({ template, text: renderTemplate(template, fixture).text }));
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ synthetic: true, email: manifest, sms }, null, 2) + '\n');
const links = manifest.map(item => `<li><a href="${e(item.file)}" target="message">${e(item.template)}</a><span>${e(item.subject)}</span>${item.textFile ? `<a class="plain" href="${e(item.textFile)}" target="message">Plain text</a>` : ''}</li>`).join('');
await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TrueMark · Message review</title>
<style>body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#f4f4f4;color:#222}header{padding:24px;max-width:960px}h1{font-size:24px;margin:0 0 8px}p{margin:0;color:#555}main{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:20px;padding:0 24px 24px}nav{min-width:0}ul{padding:0;margin:0;list-style:none}li{padding:12px 0;border-top:1px solid #ddd}a{color:inherit;text-underline-offset:3px;overflow-wrap:anywhere}a:focus-visible{outline:2px solid #222;outline-offset:3px}span{display:block;color:#555;font-size:13px}.plain{font-size:12px;display:inline-block;margin-top:4px}iframe{border:1px solid #ddd;background:white;width:100%;height:850px;box-sizing:border-box;position:sticky;top:12px}details{grid-column:1/-1}summary{cursor:pointer;font-weight:600;padding:16px 0}article{background:white;padding:16px;margin-bottom:12px;border:1px solid #ddd}h2{font-size:14px;margin:0 0 8px;overflow-wrap:anywhere}article p{overflow-wrap:anywhere}@media(max-width:750px){main{display:flex;flex-direction:column;padding:0 12px 12px}header{padding:20px 12px}nav{max-height:240px;overflow:auto}iframe{position:static;height:760px}}</style></head>
<body><header><h1>TrueMark · Message review</h1><p>20 email templates and 8 texts · Synthetic records · Nothing is sent.</p><p>Select an email to review its current layout. Links and tokens use fixtures. This checks browser layout, not delivery or inbox compatibility.</p></header><main><nav aria-label="Email templates"><ul>${links}</ul></nav><iframe name="message" title="Selected email preview" src="buyer.order_confirmed.html" sandbox="allow-same-origin"></iframe><details><summary>Text messages (8)</summary>${sms.map(item => `<article><h2>${e(item.template)}</h2><p>${e(item.text)}</p></article>`).join('')}</details></main></body></html>`);
console.log(`Rendered ${manifest.length} emails and ${sms.length} texts to ${output}. No network requests or messages sent.`);
