import { parseColor } from '../colors/color';
import { flattenPair } from './contrast';

export interface StyleLayer { backgroundColor: string; backgroundImage: string }
export interface SampledStyles {
  color: string;
  layers: StyleLayer[];
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
}
export interface ContrastSample {
  foreground: string;
  background: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  warnings: string[];
}

export const IMAGE_WARNING = 'Lo sfondo include un\'immagine o un gradiente. Il HEX è lo stile calcolato, non il pixel. Usa il contagocce per campionare ciò che vedi.';
export const TRANSPARENT_WARNING = 'Lo sfondo è rimasto semitrasparente: è stato composto sul bianco. Verifica con il contagocce se la pagina ha un\'immagine sotto.';

function hasImage(value: string) {
  return !!value && value !== 'none';
}

function isTransparent(value: string) {
  try {
    const color = parseColor(value);
    return Number(color.alpha) <= 0.001;
  } catch {
    return true;
  }
}

function isOpaque(value: string) {
  try { return Number(parseColor(value).alpha) >= 0.999; }
  catch { return false; }
}

function stackBackgrounds(colors: string[]) {
  let current = '#FFFFFF';
  for (let index = colors.length - 1; index >= 0; index--) {
    current = flattenPair(colors[index]!, current).foreground;
  }
  return current;
}

export function sampleFromStyles(styles: SampledStyles): ContrastSample {
  const warnings: string[] = [];
  if (styles.layers.some(layer => hasImage(layer.backgroundImage))) warnings.push(IMAGE_WARNING);

  const used: string[] = [];
  for (const layer of styles.layers) {
    if (isTransparent(layer.backgroundColor)) continue;
    used.push(layer.backgroundColor);
    if (isOpaque(layer.backgroundColor)) break;
  }

  const reachedOpaque = used.some(value => isOpaque(value));
  if (!used.length || !reachedOpaque) warnings.push(TRANSPARENT_WARNING);
  const background = used.length ? stackBackgrounds(used) : '#FFFFFF';

  const pair = flattenPair(styles.color, background);
  return {
    foreground: pair.foreground,
    background: pair.background,
    fontFamily: styles.fontFamily,
    fontSize: styles.fontSize,
    lineHeight: styles.lineHeight,
    fontWeight: styles.fontWeight,
    warnings: [...new Set(warnings)],
  };
}

export function readElementStyles(element: Element): SampledStyles {
  const layers: StyleLayer[] = [];
  let node: Element | null = element;
  while (node) {
    const style = getComputedStyle(node);
    layers.push({ backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage });
    node = node.parentElement;
  }
  const text = getComputedStyle(element);
  return {
    color: text.color,
    layers,
    fontFamily: text.fontFamily,
    fontSize: text.fontSize,
    lineHeight: text.lineHeight,
    fontWeight: text.fontWeight,
  };
}
