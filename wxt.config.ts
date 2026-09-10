import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    build: {
      // Chrome cannot reuse these extension preloads across execution worlds.
      modulePreload: false,
    },
  }),
  manifest: {
    name: 'Swiss Knife',
    minimum_chrome_version: '123',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'downloads', 'storage', 'clipboardWrite'],
    // Richiesto solo dal pulsante esplicito nel pannello: non viene concesso
    // automaticamente all'installazione.
    optional_host_permissions: ['<all_urls>'],
    action: { default_title: 'Apri Swiss Knife' },
  },
  zip: {
    artifactTemplate: '{{name}}-{{packageVersion}}-{{browser}}.zip',
    zipSources: false,
  },
});
