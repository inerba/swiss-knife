import type { Options } from 'qr-code-styling';

export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';
export type DotType = 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
export type CornerSquareType = 'square' | 'dot' | 'extra-rounded';
export type CornerDotType = 'square' | 'dot';
export type GradientType = 'linear' | 'radial';
export type ColorMode = 'single' | 'gradient';
export type CornerType = 'default' | CornerSquareType;
export type InnerCornerType = 'default' | CornerDotType;

export interface QrGradient {
  type: GradientType;
  rotation: number;
  start: string;
  end: string;
}

export interface QrFill {
  mode: ColorMode;
  color: string;
  gradient: QrGradient;
}

export interface QrStyle {
  size: number;
  margin: number;
  errorCorrection: ErrorCorrection;
  dotsType: DotType;
  dots: QrFill;
  cornersSquareType: CornerType;
  cornersSquare: QrFill;
  cornersSquareColorEnabled: boolean;
  cornersDotType: InnerCornerType;
  cornersDot: QrFill;
  cornersDotColorEnabled: boolean;
  background: QrFill;
  backgroundTransparent: boolean;
  hideBackgroundDots: boolean;
  imageSize: number;
  imageMargin: number;
}

export type BuiltinPresetId = 'classico' | 'arrotondato' | 'extra-arrotondato' | 'classy' | 'punti';
export interface BuiltinPreset { id: BuiltinPresetId; label: string; style: QrStyle }

const dotTypes: DotType[] = ['square', 'dots', 'rounded', 'extra-rounded', 'classy', 'classy-rounded'];
const cornerSquareTypes: CornerType[] = ['default', 'square', 'dot', 'extra-rounded'];
const cornerDotTypes: InnerCornerType[] = ['default', 'square', 'dot'];
const levels: ErrorCorrection[] = ['L', 'M', 'Q', 'H'];
const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asColor(value: unknown, fallback: string) {
  return typeof value === 'string' && hex.test(value) ? value : fallback;
}

function asFill(value: unknown, fallback: QrFill): QrFill {
  const raw = value && typeof value === 'object' ? value as Partial<QrFill> : {};
  const gradient = raw.gradient && typeof raw.gradient === 'object' ? raw.gradient as Partial<QrGradient> : {};
  return {
    mode: raw.mode === 'gradient' ? 'gradient' : 'single',
    color: asColor(raw.color, fallback.color),
    gradient: {
      type: gradient.type === 'radial' ? 'radial' : 'linear',
      rotation: clamp(asNumber(gradient.rotation, fallback.gradient.rotation), 0, 360),
      start: asColor(gradient.start, fallback.gradient.start),
      end: asColor(gradient.end, fallback.gradient.end),
    },
  };
}

const defaultFill = (color: string, end: string): QrFill => ({
  mode: 'single',
  color,
  gradient: { type: 'linear', rotation: 0, start: color, end },
});

export const defaultQrStyle: QrStyle = {
  size: 300,
  margin: 10,
  errorCorrection: 'M',
  dotsType: 'square',
  dots: defaultFill('#000000', '#4f46e5'),
  cornersSquareType: 'default',
  cornersSquare: defaultFill('#000000', '#4f46e5'),
  cornersSquareColorEnabled: false,
  cornersDotType: 'default',
  cornersDot: defaultFill('#000000', '#4f46e5'),
  cornersDotColorEnabled: false,
  background: defaultFill('#ffffff', '#e0e7ff'),
  backgroundTransparent: false,
  hideBackgroundDots: true,
  imageSize: 0.18,
  imageMargin: 0,
};

export function normalizeQrStyle(value: unknown): QrStyle {
  const raw = value && typeof value === 'object' ? value as Partial<QrStyle> : {};
  return {
    size: clamp(Math.round(asNumber(raw.size, defaultQrStyle.size)), 200, 1000),
    margin: clamp(Math.round(asNumber(raw.margin, defaultQrStyle.margin)), 0, 80),
    errorCorrection: levels.includes(raw.errorCorrection as ErrorCorrection) ? raw.errorCorrection as ErrorCorrection : 'M',
    dotsType: dotTypes.includes(raw.dotsType as DotType) ? raw.dotsType as DotType : 'square',
    dots: asFill(raw.dots, defaultQrStyle.dots),
    cornersSquareType: cornerSquareTypes.includes(raw.cornersSquareType as CornerType) ? raw.cornersSquareType as CornerType : 'default',
    cornersSquare: asFill(raw.cornersSquare, defaultQrStyle.cornersSquare),
    cornersSquareColorEnabled: raw.cornersSquareColorEnabled === true,
    cornersDotType: cornerDotTypes.includes(raw.cornersDotType as InnerCornerType) ? raw.cornersDotType as InnerCornerType : 'default',
    cornersDot: asFill(raw.cornersDot, defaultQrStyle.cornersDot),
    cornersDotColorEnabled: raw.cornersDotColorEnabled === true,
    background: asFill(raw.background, defaultQrStyle.background),
    backgroundTransparent: raw.backgroundTransparent === true,
    hideBackgroundDots: raw.hideBackgroundDots !== false,
    imageSize: clamp(asNumber(raw.imageSize, defaultQrStyle.imageSize), 0.1, 0.5),
    imageMargin: clamp(Math.round(asNumber(raw.imageMargin, defaultQrStyle.imageMargin)), 0, 40),
  };
}

function fillOptions(fill: QrFill, enabled = true) {
  if (!enabled) return {};
  if (fill.mode === 'gradient') {
    return {
      gradient: {
        type: fill.gradient.type,
        rotation: (fill.gradient.rotation * Math.PI) / 180,
        colorStops: [
          { offset: 0, color: fill.gradient.start },
          { offset: 1, color: fill.gradient.end },
        ],
      },
    };
  }
  return { color: fill.color };
}

export function toLibraryOptions(data: string, style: QrStyle, logo?: string): Options {
  const normalized = normalizeQrStyle(style);
  const cornersSquare = {
    ...(normalized.cornersSquareType === 'default' ? {} : { type: normalized.cornersSquareType }),
    ...fillOptions(normalized.cornersSquare, normalized.cornersSquareColorEnabled),
  };
  const cornersDot = {
    ...(normalized.cornersDotType === 'default' ? {} : { type: normalized.cornersDotType }),
    ...fillOptions(normalized.cornersDot, normalized.cornersDotColorEnabled),
  };
  return {
    width: normalized.size,
    height: normalized.size,
    margin: normalized.margin,
    data,
    image: logo,
    qrOptions: { errorCorrectionLevel: logo ? 'H' : normalized.errorCorrection },
    dotsOptions: { type: normalized.dotsType, ...fillOptions(normalized.dots) },
    cornersSquareOptions: cornersSquare,
    cornersDotOptions: cornersDot,
    backgroundOptions: normalized.backgroundTransparent ? { color: 'transparent' } : fillOptions(normalized.background),
    imageOptions: {
      hideBackgroundDots: normalized.hideBackgroundDots,
      imageSize: normalized.imageSize,
      margin: normalized.imageMargin,
      saveAsBlob: true,
    },
  };
}

function withDots(type: DotType): QrStyle {
  return { ...defaultQrStyle, dotsType: type };
}

export const builtinPresets: BuiltinPreset[] = [
  { id: 'classico', label: 'Classico', style: defaultQrStyle },
  { id: 'arrotondato', label: 'Arrotondato', style: withDots('rounded') },
  { id: 'extra-arrotondato', label: 'Extra arrotondato', style: withDots('extra-rounded') },
  { id: 'classy', label: 'Classy', style: withDots('classy') },
  { id: 'punti', label: 'Punti', style: withDots('dots') },
];

export function stylesEqual(left: QrStyle, right: QrStyle) {
  return JSON.stringify(normalizeQrStyle(left)) === JSON.stringify(normalizeQrStyle(right));
}

export function matchingPresetId(style: QrStyle, userPresets: Array<{ id: string; style: QrStyle }>) {
  const builtin = builtinPresets.find(item => stylesEqual(item.style, style));
  if (builtin) return builtin.id;
  return userPresets.find(item => stylesEqual(item.style, style))?.id ?? '';
}

export const dotTypeOptions: Array<{ id: DotType; label: string }> = [
  { id: 'square', label: 'Quadrato' },
  { id: 'dots', label: 'Punti' },
  { id: 'rounded', label: 'Arrotondato' },
  { id: 'extra-rounded', label: 'Extra arrotondato' },
  { id: 'classy', label: 'Classy' },
  { id: 'classy-rounded', label: 'Classy arrotondato' },
];

export const cornerSquareOptions: Array<{ id: CornerType; label: string }> = [
  { id: 'default', label: 'Predefinito' },
  { id: 'square', label: 'Quadrato' },
  { id: 'dot', label: 'Punto' },
  { id: 'extra-rounded', label: 'Extra arrotondato' },
];

export const cornerDotOptions: Array<{ id: InnerCornerType; label: string }> = [
  { id: 'default', label: 'Predefinito' },
  { id: 'square', label: 'Quadrato' },
  { id: 'dot', label: 'Punto' },
];

export const errorLevels: Array<{ id: ErrorCorrection; label: string }> = [
  { id: 'L', label: 'Basso (L)' },
  { id: 'M', label: 'Medio (M)' },
  { id: 'Q', label: 'Quartile (Q)' },
  { id: 'H', label: 'Alto (H)' },
];
