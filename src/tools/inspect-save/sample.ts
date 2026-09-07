import type { InfoSection } from './types';
import { buildSelector, formatClasses, formatTagLabel } from './selector';

export interface ComputedSnapshot {
  tag: string;
  tagLabel: string;
  selector: string;
  classes: string;
  dimensions: string;
  sections: InfoSection[];
}

const VISUAL_PROPERTIES = [
  'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight',
  'line-height', 'text-align', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'width', 'height', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-radius', 'box-shadow', 'opacity', 'filter', 'backdrop-filter',
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
] as const;

function isTransparent(color: string) {
  return !color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
}

function readStyle(style: CSSStyleDeclaration, property: string) {
  const camel = property.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  const record = style as unknown as Record<string, string>;
  return record[camel] ?? style.getPropertyValue(property) ?? '';
}

function hasBorder(style: CSSStyleDeclaration) {
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  return sides.some(side => {
    const width = readStyle(style, `border-${side}-width`);
    const borderStyle = readStyle(style, `border-${side}-style`);
    return width !== '0px' && borderStyle !== 'none';
  });
}

function borderSummary(style: CSSStyleDeclaration): InfoSection {
  if (!hasBorder(style)) return { id: 'border', title: 'Bordo', empty: true, rows: [{ label: 'Bordo', value: 'Nessun bordo' }] };
  const rows = [
    { label: 'Stile', value: `${readStyle(style, 'border-top-style')} ${readStyle(style, 'border-right-style')} ${readStyle(style, 'border-bottom-style')} ${readStyle(style, 'border-left-style')}` },
    { label: 'Spessore', value: `${readStyle(style, 'border-top-width')} ${readStyle(style, 'border-right-width')} ${readStyle(style, 'border-bottom-width')} ${readStyle(style, 'border-left-width')}` },
    { label: 'Colore', value: readStyle(style, 'border-top-color'), swatch: readStyle(style, 'border-top-color') },
    { label: 'Raggio', value: readStyle(style, 'border-radius') },
  ];
  return { id: 'border', title: 'Bordo', rows };
}

function hasEffects(style: CSSStyleDeclaration) {
  const boxShadow = readStyle(style, 'box-shadow');
  const filter = readStyle(style, 'filter');
  const backdrop = readStyle(style, 'backdrop-filter');
  const opacity = readStyle(style, 'opacity');
  return (boxShadow && boxShadow !== 'none')
    || (filter && filter !== 'none')
    || (backdrop && backdrop !== 'none')
    || (opacity && opacity !== '1');
}

function effectsSummary(style: CSSStyleDeclaration): InfoSection {
  if (!hasEffects(style)) return { id: 'effects', title: 'Effetti', empty: true, rows: [{ label: 'Effetti', value: 'Nessun effetto' }] };
  const rows: Array<{ label: string; value: string }> = [];
  const boxShadow = readStyle(style, 'box-shadow');
  const opacity = readStyle(style, 'opacity');
  const filter = readStyle(style, 'filter');
  const backdrop = readStyle(style, 'backdrop-filter');
  if (boxShadow && boxShadow !== 'none') rows.push({ label: 'Ombra', value: boxShadow });
  if (opacity && opacity !== '1') rows.push({ label: 'Opacità', value: opacity });
  if (filter && filter !== 'none') rows.push({ label: 'Filtro', value: filter });
  if (backdrop && backdrop !== 'none') rows.push({ label: 'Backdrop', value: backdrop });
  return { id: 'effects', title: 'Effetti', rows };
}

function backgroundSummary(style: CSSStyleDeclaration): InfoSection {
  const rows: Array<{ label: string; value: string; swatch?: string }> = [];
  const backgroundColor = readStyle(style, 'background-color');
  const backgroundImage = readStyle(style, 'background-image');
  if (!isTransparent(backgroundColor)) {
    rows.push({ label: 'Colore', value: backgroundColor, swatch: backgroundColor });
  }
  if (backgroundImage && backgroundImage !== 'none') {
    rows.push({ label: 'Immagine', value: backgroundImage });
  }
  if (!rows.length) rows.push({ label: 'Sfondo', value: 'Trasparente' });
  return { id: 'background', title: 'Sfondo', rows };
}

function paddingSummary(style: CSSStyleDeclaration) {
  const paddingTop = readStyle(style, 'padding-top');
  const paddingRight = readStyle(style, 'padding-right');
  const paddingBottom = readStyle(style, 'padding-bottom');
  const paddingLeft = readStyle(style, 'padding-left');
  const vertical = paddingTop === paddingBottom ? paddingTop : `${paddingTop} ${paddingBottom}`;
  const horizontal = paddingLeft === paddingRight ? paddingLeft : `${paddingLeft} ${paddingRight}`;
  if (vertical === horizontal) return vertical;
  return `${vertical} ${horizontal}`;
}

export function readComputedStyles(style: CSSStyleDeclaration): ComputedSnapshot {
  const tag = 'element';
  return buildSnapshotFromStyle(tag, style);
}

function readFontFamily(style: CSSStyleDeclaration) {
  const raw = style.fontFamily || style.getPropertyValue('font-family') || '—';
  return raw.split(',')[0]?.replace(/["']/g, '').trim() || raw;
}

export function buildSnapshotFromStyle(tagName: string, style: CSSStyleDeclaration): ComputedSnapshot {
  const tag = tagName.toLowerCase();
  return {
    tag,
    tagLabel: formatTagLabel(tag),
    selector: tag,
    classes: '—',
    dimensions: `${style.width || style.getPropertyValue('width')} × ${style.height || style.getPropertyValue('height')}`,
    sections: [
      {
        id: 'element',
        title: 'Elemento',
        rows: [
          { label: 'Tag', value: `<${tag}>` },
          { label: 'Selettore', value: tag },
          { label: 'Classi', value: '—' },
        ],
      },
      {
        id: 'typography',
        title: 'Tipografia',
        rows: [
          { label: 'Font', value: readFontFamily(style) },
          { label: 'Dimensione', value: style.fontSize || style.getPropertyValue('font-size') },
          { label: 'Peso', value: style.fontWeight || style.getPropertyValue('font-weight') },
          { label: 'Interlinea', value: style.lineHeight || style.getPropertyValue('line-height') },
          { label: 'Allineamento', value: style.textAlign || style.getPropertyValue('text-align') },
          { label: 'Colore', value: style.color || style.getPropertyValue('color'), swatch: style.color || style.getPropertyValue('color') },
        ],
      },
      backgroundSummary(style),
      borderSummary(style),
      {
        id: 'spacing',
        title: 'Spaziatura e dimensioni',
        rows: [
          { label: 'Padding', value: paddingSummary(style) },
          { label: 'Larghezza', value: readStyle(style, 'width') },
          { label: 'Altezza', value: readStyle(style, 'height') },
        ],
      },
      effectsSummary(style),
      {
        id: 'layout',
        title: 'Layout',
        rows: [
          { label: 'Display', value: readStyle(style, 'display') },
          { label: 'Position', value: readStyle(style, 'position') },
          { label: 'Top', value: readStyle(style, 'top') },
          { label: 'Right', value: readStyle(style, 'right') },
          { label: 'Bottom', value: readStyle(style, 'bottom') },
          { label: 'Left', value: readStyle(style, 'left') },
          { label: 'zIndex', value: readStyle(style, 'z-index') },
        ],
      },
    ],
  };
}

export function sampleElement(element: Element): ComputedSnapshot {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const tag = element.localName.toLowerCase();
  const base = buildSnapshotFromStyle(tag, style);
  base.selector = buildSelector(element);
  base.classes = formatClasses(element);
  base.dimensions = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  base.sections = base.sections.map(section => {
    if (section.id !== 'element') return section;
    return {
      ...section,
      rows: [
        { label: 'Tag', value: `<${tag}>` },
        { label: 'Selettore', value: base.selector },
        { label: 'Classi', value: base.classes },
      ],
    };
  });
  return base;
}

export function curatedStyleProperties(style: CSSStyleDeclaration): Record<string, string> {
  const result: Record<string, string> = {};
  for (const property of VISUAL_PROPERTIES) {
    const value = style.getPropertyValue(property);
    if (value) result[property] = value;
  }
  return result;
}

export function isRectClipped(rect: DOMRect, viewportWidth: number, viewportHeight: number) {
  return rect.left < 0 || rect.top < 0
    || rect.right > viewportWidth || rect.bottom > viewportHeight
    || rect.width > viewportWidth || rect.height > viewportHeight;
}

export function cropRectToViewport(rect: DOMRect, viewportWidth: number, viewportHeight: number) {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewportWidth, rect.right);
  const bottom = Math.min(viewportHeight, rect.bottom);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    viewportWidth,
  };
}
