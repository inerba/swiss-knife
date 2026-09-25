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
    // 130+: use_dynamic_url; 141+: sidePanel.close for the detach button.
    minimum_chrome_version: '141',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'downloads', 'storage', 'clipboardWrite'],
    // Richiesto solo dal pulsante esplicito nel pannello: non viene concesso
    // automaticamente all'installazione.
    optional_host_permissions: ['<all_urls>'],
    action: { default_title: 'Apri Swiss Knife' },
    // Only the floating window page, loaded in an iframe inside the page on request (docs/adr/0001).
    web_accessible_resources: [{ resources: ['floating.html'], matches: ['<all_urls>'], use_dynamic_url: true }],
  },
  zip: {
    artifactTemplate: '{{name}}-{{packageVersion}}-{{browser}}.zip',
    zipSources: false,
  },
});
