/** Rebuild the editable shell/current app with the committed historical content. */
import { build } from 'vite';
import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(root, 'dist/studio');
await rm(out, { recursive: true, force: true });
await cp(resolve(root, 'studio-content'), out, { recursive: true });
await build({ configFile: fileURLToPath(new URL('./vite.config.mjs', import.meta.url)) });
await copyFile(resolve(out, 'index.html'), resolve(out, 'app.html'));
await copyFile(resolve(out, 'design-lab/universe/index.html'), resolve(out, 'index.html'));
await mkdir(resolve(out, 'design-lab/client-walkthrough'), { recursive: true });
for (const name of ['landing-study.css', 'landing-collection.css', 'landing-motion.css']) {
  await copyFile(resolve(root, 'design-lab/client-walkthrough', name), resolve(out, 'design-lab/client-walkthrough', name));
}
console.log('Built portable fixture Studio. Run npm run preview:studio. This does not deploy the hosted Studio.');
