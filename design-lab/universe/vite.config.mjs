import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { contentMiddleware } from './content-server.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root,
  base: '/',
  envFile: false,
  plugins: [react(), {
    name: 'portable-studio-content',
    configureServer(server) {
      server.middlewares.use(contentMiddleware(root + 'studio-content', { sourceRoot: root }));
    },
  }],
  define: {
    'import.meta.env.VITE_PUBLIC_STUDIO': JSON.stringify('1'),
    'import.meta.env.VITE_PLATFORM': JSON.stringify('preview'),
    'import.meta.env.VITE_REVIEW_SUPABASE_URL': JSON.stringify('https://fixture.test'),
    'import.meta.env.VITE_REVIEW_SUPABASE_ANON_KEY': JSON.stringify('fixture-anon'),
  },
  build: {
    outDir: 'dist/studio', emptyOutDir: false,
    rollupOptions: { input: { app: root + 'index.html', studio: root + 'design-lab/universe/index.html' } },
  },
  server: { host: '127.0.0.1', port: 5292, strictPort: true },
});
