import Color from 'colorjs.io';

export interface StoredColor { id: string; value: string; updatedAt: number }
export interface TailwindColor { name: string; value: string; className: string }

function asColor(value: string | Color) { return value instanceof Color ? value : new Color(value); }
export function parseColor(value: string) {
  const color = new Color(value.trim());
  if (!Number.isFinite(color.alpha) || color.coords.some(channel => channel !== null && !Number.isFinite(channel))) {
    throw new Error('Inserisci un colore valido.');
  }
  return color;
}
export function canonical(value: string | Color) {
  const color = asColor(value).to('oklab');
  return [...color.coords.map(item => Number(item).toFixed(6)), Number(color.alpha).toFixed(6)].join(':');
}
export function displayHex(value: string | Color) { return asColor(value).to('srgb').toGamut({ space: 'srgb', method: 'css' }).toString({ format: 'hex', collapse: false }); }
export function opaqueHex(value: string) {
  const color = parseColor(value).to('srgb');
  color.alpha = 1;
  return displayHex(color);
}
export function colorCss(value: string) { return parseColor(value).to('oklab').toString({ precision: 8 }); }
export const COLOR_FORMATS = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', oklch: 'OKLCH', oklab: 'OKLab', p3: 'Display P3' } as const;
export type ColorFormat = keyof typeof COLOR_FORMATS;
export function formats(value: string | Color) {
  const color = asColor(value); const srgb = color.to('srgb').toGamut({ space: 'srgb', method: 'css' });
  return {
    hex: displayHex(color), hexa: srgb.toString({ format: 'hex', collapse: false, alpha: true }), rgb: srgb.toString({ format: 'rgb', precision: 6 }),
    hsl: srgb.to('hsl').toString({ precision: 6 }), oklab: color.to('oklab').toString({ precision: 8 }),
    oklch: color.to('oklch').toString({ precision: 8 }), p3: color.to('p3').toString({ precision: 8 }),
    outOfGamut: !color.inGamut('srgb'),
  };
}
export function tailwindClosest(value: string, colors: readonly TailwindColor[]) {
  const [l = 0, a = 0, b = 0] = new Color(value).to('oklab').coords as number[];
  return colors.reduce((best, entry) => {
    const [x = 0, y = 0, z = 0] = new Color(entry.value).to('oklab').coords as number[];
    const distance = Math.hypot(l - x, a - y, b - z);
    return !best || distance < best.distance ? { entry, distance } : best;
  }, undefined as { entry: TailwindColor; distance: number } | undefined)!;
}
export function historyInsert(history: StoredColor[], values: string[]) {
  let next = history;
  for (const value of [...values].reverse()) {
    const id = canonical(value); const existing = next.find(item => item.id === id);
    next = [{ id, value: existing?.value ?? value, updatedAt: Date.now() }, ...next.filter(item => item.id !== id)].slice(0, 50);
  }
  return next;
}
export function historyRemove(history: StoredColor[], ids: Iterable<string>) {
  const remove = new Set(ids);
  return history.filter(item => !remove.has(item.id));
}

// Tailwind CSS v4.3 default palette. Neutrals plus the principal chromatic families;
// values are bundled so matching works without network access.
const families: Record<string, string[]> = {
  red:['#fef2f2','#ffe2e2','#ffc9c9','#ffa2a2','#ff6467','#fb2c36','#e7000b','#c10007','#9f0712','#82181a','#460809'],
  orange:['#fff7ed','#ffedd4','#ffd6a7','#ffb86a','#ff8904','#ff6900','#f54900','#ca3500','#9f2d00','#7e2a0c','#441306'],
  amber:['#fffbeb','#fef3c6','#fee685','#ffd230','#ffb900','#fe9a00','#e17100','#bb4d00','#973c00','#7b3306','#461901'],
  yellow:['#fefce8','#fef9c2','#fff085','#ffdf20','#facd15','#eab308','#ca8a04','#a16207','#854d0e','#713f12','#422006'],
  lime:['#f7fee7','#ecfcca','#d8f999','#bbf451','#9ae600','#7ccf00','#5ea500','#497d00','#3c6300','#35530e','#192e03'],
  green:['#f0fdf4','#dcfce7','#b9f8cf','#7bf1a8','#05df72','#00c950','#00a63e','#008236','#016630','#0d542b','#032e15'],
  emerald:['#ecfdf5','#d0fae5','#a4f4cf','#5ee9b5','#00d492','#00bc7d','#009966','#007a55','#006045','#004f3b','#002c22'],
  teal:['#f0fdfa','#cbfbf1','#96f7e4','#46ecd5','#00d5be','#00bba7','#009689','#00786f','#005f5a','#0b4f4a','#022f2e'],
  cyan:['#ecfeff','#cffafe','#a5f3fc','#67e8f9','#22d3ee','#06b6d4','#0891b2','#0e7490','#155e75','#164e63','#083344'],
  sky:['#f0f9ff','#e0f2fe','#bae6fd','#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985','#0c4a6e','#082f49'],
  blue:['#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a','#172554'],
  indigo:['#eef2ff','#e0e7ff','#c7d2fe','#a5b4fc','#818cf8','#6366f1','#4f46e5','#4338ca','#3730a3','#312e81','#1e1b4b'],
  violet:['#f5f3ff','#ede9fe','#ddd6fe','#c4b5fd','#a78bfa','#8b5cf6','#7c3aed','#6d28d9','#5b21b6','#4c1d95','#2e1065'],
  purple:['#faf5ff','#f3e8ff','#e9d5ff','#d8b4fe','#c084fc','#a855f7','#9333ea','#7e22ce','#6b21a8','#581c87','#3b0764'],
  fuchsia:['#fdf4ff','#fae8ff','#f5d0fe','#f0abfc','#e879f9','#d946ef','#c026d3','#a21caf','#86198f','#701a75','#4a044e'],
  pink:['#fdf2f8','#fce7f3','#fbcfe8','#f9a8d4','#f472b6','#ec4899','#db2777','#be185d','#9d174d','#831843','#500724'],
  rose:['#fff1f2','#ffe4e6','#fecdd3','#fda4af','#fb7185','#f43f5e','#e11d48','#be123c','#9f1239','#881337','#4c0519'],
  slate:['#f8fafc','#f1f5f9','#e2e8f0','#cbd5e1','#94a3b8','#64748b','#475569','#334155','#1e293b','#0f172a','#020617'],
  gray:['#f9fafb','#f3f4f6','#e5e7eb','#d1d5db','#9ca3af','#6b7280','#4b5563','#374151','#1f2937','#111827','#030712'],
  zinc:['#fafafa','#f4f4f5','#e4e4e7','#d4d4d8','#a1a1aa','#71717a','#52525b','#3f3f46','#27272a','#18181b','#09090b'],
  neutral:['#fafafa','#f5f5f5','#e5e5e5','#d4d4d4','#a3a3a3','#737373','#525252','#404040','#262626','#171717','#0a0a0a'],
  stone:['#fafaf9','#f5f5f4','#e7e5e4','#d6d3d1','#a8a29e','#78716c','#57534e','#44403c','#292524','#1c1917','#0c0a09'],
};
export const TAILWIND_COLORS: TailwindColor[] = [
  { name: 'white', value: '#ffffff', className: 'white' }, { name: 'black', value: '#000000', className: 'black' },
  ...Object.entries(families).flatMap(([name, values]) => values.map((value, index) => ({ name: `${name}-${[50,100,200,300,400,500,600,700,800,900,950][index]}`, value, className: `${name}-${[50,100,200,300,400,500,600,700,800,900,950][index]}` }))),
];
