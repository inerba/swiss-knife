import Color from 'colorjs.io';
import { displayHex, parseColor } from '../colors/color';

export type ContrastGrade = 'Insufficiente' | 'Sufficiente' | 'Buono' | 'Ottimo';
export interface ContrastChecks {
  aaNormal: boolean;
  aaaNormal: boolean;
  aaLarge: boolean;
  aaaLarge: boolean;
  aaNonText: boolean;
}
export interface ContrastResult {
  ratio: number;
  display: string;
  grade: ContrastGrade;
  checks: ContrastChecks;
  foreground: string;
  background: string;
}

const WHITE = new Color('#ffffff');

function safeParse(value: string) {
  try { return parseColor(value); }
  catch { throw new Error('Inserisci un colore valido.'); }
}

function flattenOnto(front: Color, back: Color) {
  const overlay = front.to('srgb');
  const base = back.to('srgb');
  const alpha = Number(overlay.alpha);
  if (alpha >= 1) { const next = overlay.clone(); next.alpha = 1; return next; }
  if (alpha <= 0) { const next = base.clone(); next.alpha = 1; return next; }
  const mixed = new Color('srgb', overlay.coords.map((channel, index) => (
    Number(channel) * alpha + Number(base.coords[index]) * (1 - alpha)
  )) as [number, number, number]);
  mixed.alpha = 1;
  return mixed;
}

export function flattenPair(foreground: string, background: string) {
  const back = flattenOnto(safeParse(background), WHITE);
  const front = flattenOnto(safeParse(foreground), back);
  return { foreground: displayHex(front), background: displayHex(back) };
}

function gradeFor(ratio: number): ContrastGrade {
  if (ratio < 3) return 'Insufficiente';
  if (ratio < 4.5) return 'Sufficiente';
  if (ratio < 7) return 'Buono';
  return 'Ottimo';
}

export function analyzeContrast(foreground: string, background: string): ContrastResult {
  const pair = flattenPair(foreground, background);
  const ratio = new Color(pair.foreground).contrast(pair.background, 'WCAG21');
  return {
    ratio,
    display: `${ratio.toFixed(1)} : 1`,
    grade: gradeFor(ratio),
    checks: {
      aaNormal: ratio >= 4.5,
      aaaNormal: ratio >= 7,
      aaLarge: ratio >= 3,
      aaaLarge: ratio >= 4.5,
      aaNonText: ratio >= 3,
    },
    foreground: pair.foreground,
    background: pair.background,
  };
}

export function tryAnalyzeContrast(foreground: string, background: string) {
  try { return analyzeContrast(foreground, background); }
  catch { return null; }
}
