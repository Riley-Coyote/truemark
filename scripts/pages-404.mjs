import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function pagesDestination(pathname, search = '') {
  if (pathname.startsWith('/truemark/live/')) return `/truemark/live/#/${pathname.slice('/truemark/live/'.length)}${search}`;
  if (pathname.startsWith('/truemark/launch/')) return `/truemark/launch/?p=${encodeURIComponent('/' + pathname.slice('/truemark/launch/'.length) + search)}`;
  return '/truemark/#/review';
}
export async function writePages404(directory = 'dist') {
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/404.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>TrueMark BioLabs</title><script>location.replace((${pagesDestination.toString()})(location.pathname,location.search));</script><noscript><a href="/truemark/">TrueMark BioLabs</a></noscript></html>\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await writePages404();
