const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
const stored: Record<string, unknown> = {
  'colorHistory.v1': ['#e85235', '#3b82f6', '#1e293b', '#fef3c6', '#00bc7d', '#e8523580'].map((value, index) => ({ id: value, value, updatedAt: Date.now() - index })),
};
const event = () => ({ addListener() {}, removeListener() {} });
export const browser = {
  storage: {
    local: {
      async get(key: string) { return { [key]: stored[key] }; },
      async set(values: Record<string, unknown>) { Object.assign(stored, values); for (const listener of listeners) listener(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])), 'local'); },
      async remove(key: string) { delete stored[key]; for (const listener of listeners) listener({ [key]: { newValue: undefined } }, 'local'); },
    },
    onChanged: { addListener: (fn: typeof listeners extends Set<infer T> ? T : never) => listeners.add(fn), removeListener: (fn: typeof listeners extends Set<infer T> ? T : never) => listeners.delete(fn) },
  },
  tabs: { async query() { return [{ id: 1, url: 'https://example.test/' }]; }, onActivated: event(), onUpdated: event(), onRemoved: event() },
  windows: { async getCurrent() { return { id: 1 }; } },
  scripting: { async executeScript() { throw new Error('Questa anteprima verifica solo la UI. La selezione della pagina richiede l’estensione.'); } },
};
