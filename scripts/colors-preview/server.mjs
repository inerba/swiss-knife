import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const wxtRequire = createRequire(require.resolve('wxt'));
const { createServer } = await import(pathToFileURL(wxtRequire.resolve('vite')).href);
const root = fileURLToPath(new URL('.', import.meta.url));
const server = await createServer({
  configFile: false, root,
  resolve: { alias: { 'wxt/browser': fileURLToPath(new URL('./browser.ts', import.meta.url)) } },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 5198, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } },
});
await server.listen();
console.log('Local UI fixture: http://127.0.0.1:5198 (mock browser APIs; no access to extension data)');
