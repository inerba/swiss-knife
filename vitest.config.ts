import { defineConfig } from 'vitest/config';
export default defineConfig({ esbuild: { jsx: 'automatic' }, test: { environment: 'jsdom', environmentOptions: { jsdom: { url: 'https://example.test/path/' } } } });
