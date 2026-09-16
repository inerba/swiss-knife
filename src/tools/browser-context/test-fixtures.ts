import type { ContextPayload } from './types';

export function samplePayload(overrides: Partial<ContextPayload> = {}): ContextPayload {
  return {
    element: 'div.card',
    path: 'main#app > div.card',
    url: 'https://example.test/pricing',
    viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
    box: { left: 560, top: 180, width: 320, height: 412 },
    rect: { left: 560, top: 180, width: 320, height: 412, viewportWidth: 1440, viewportHeight: 900, scrollX: 0, scrollY: 0 },
    markup: '<div class="card">Hi</div>',
    css: {
      matched: ['/* assets/app.css */\n.card { padding: 24px; }'],
      media: [],
      states: { hover: [], focus: [], active: [] },
      inherited: [],
      pseudos: { before: [], after: [] },
      resolved: ['padding: 24px;'],
      variables: [],
    },
    unreadableSheets: [],
    ...overrides,
  };
}
