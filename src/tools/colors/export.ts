import { COLOR_FORMATS, formats, parseColor, tailwindClosest, TAILWIND_COLORS, type ColorFormat } from './color';

export type ExportMode = 'codes' | 'css' | 'tailwind';
export type Utility = 'bg' | 'text' | 'border' | 'fill' | 'stroke';
export interface ExportOptions { mode: ExportMode; format: ColorFormat; utility: Utility; nearest: boolean }
export function exportColors(values: string[], options: ExportOptions) {
  if (!values.length) return '';
  if (options.mode === 'tailwind') {
    return values.map(value => {
      const color = parseColor(value);
      if (options.nearest) {
        const name = tailwindClosest(value, TAILWIND_COLORS).entry.className;
        return `${options.utility}-${name}${color.alpha < 1 ? `/[${Number(color.alpha.toFixed(6))}]` : ''}`;
      }
      // Keep wide-gamut colors and alpha in arbitrary values. Spaces become Tailwind underscores.
      return `${options.utility}-[${color.to('oklch').toString({ precision: 8 }).replaceAll(' ', '_')}]`;
    }).join('\n');
  }
  const codes = values.map(value => formats(value)[options.format in COLOR_FORMATS ? options.format : 'hex']);
  if (options.mode === 'css') return `:root {\n${codes.map((value, index) => `  --colore-${index + 1}: ${value};`).join('\n')}\n}`;
  return codes.join('\n');
}
