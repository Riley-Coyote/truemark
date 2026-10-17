/** Local delivery of the checked-in release, including its deduplicated assets.
 * Resolve aliases on the server so local previews don't require a service worker.
 */
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

export const releaseBase = '/truemark/studio/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.zip': 'application/zip' };

export function contentMiddleware(directory, { sourceRoot } = {}) {
  const root = resolve(directory);
  const mapping = JSON.parse(readFileSync(resolve(root, 'asset-map.json'), 'utf8')).mapping;
  const inside = path => path.startsWith(root + sep);
  return async (req, res, next = () => { res.statusCode = 404; res.end('Studio file not found'); }) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) return next();
      let path;
      try { path = decodeURIComponent(req.url.split('?')[0]); }
      catch { res.statusCode = 400; return res.end('Invalid URL'); }
      if (path.includes('\0') || path.includes('\\') || path.split('/').includes('..')) {
        res.statusCode = 400; return res.end('Invalid path');
      }
      const prefixed = path.startsWith(releaseBase);
      if (prefixed) path = '/' + path.slice(releaseBase.length);
      // Editable files and current application assets belong to Vite in development.
      if (sourceRoot && !prefixed && (path === '/' || existsSync(resolve(sourceRoot, '.' + path)) || existsSync(resolve(sourceRoot, 'public', '.' + path)))) return next();
      if (path.endsWith('/')) path += 'index.html';
      let file = resolve(root, '.' + path);
      if (!inside(file)) return next();
      if (!existsSync(file) && mapping[path]) file = resolve(root, '.' + mapping[path]);
      if (!inside(file)) return next();
      let info;
      try { info = await stat(file); } catch { return next(); }
      if (!info.isFile()) return next();
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      if (extname(file) === '.html') {
        const html = (await readFile(file, 'utf8')).replace(/<script data-studio-bootstrap>[\s\S]*?<\/script>/g, '');
        res.setHeader('Content-Length', Buffer.byteLength(html));
        return res.end(req.method === 'HEAD' ? undefined : html);
      }
      // Video seeking and partial downloads work without loading the whole file.
      res.setHeader('Accept-Ranges', 'bytes');
      let start = 0, end = info.size - 1;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
          end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        } else start = -1;
        if (start < 0 || start > end || start >= info.size) {
          res.statusCode = 416; res.setHeader('Content-Range', `bytes */${info.size}`); return res.end();
        }
        res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
      }
      res.setHeader('Content-Length', Math.max(0, end - start + 1));
      if (req.method === 'HEAD' || !info.size) return res.end();
      const stream = createReadStream(file, { start, end });
      stream.on('error', error => res.destroy(error));
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) { next(error); }
  };
}
