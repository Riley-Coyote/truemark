import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { contentMiddleware } from './content-server.mjs';
const port = Number(process.env.PORT || 5293);
createServer(contentMiddleware(fileURLToPath(new URL('../../dist/studio', import.meta.url))))
  .listen(port, '127.0.0.1', () => console.log(`Studio: http://127.0.0.1:${port}/`));
