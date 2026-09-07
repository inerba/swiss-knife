export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface OverlayRegion {
  side: 'top' | 'right' | 'bottom' | 'left';
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OverlayBadge {
  side: 'top' | 'right' | 'bottom' | 'left';
  kind: 'padding' | 'margin';
  text: string;
  left: number;
  top: number;
}

export interface OverlayGuide {
  orientation: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
}

export interface OverlayBoxStyle {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  borderRadius: string;
}

export interface OverlayModel {
  border: OverlayRect;
  padding: OverlayRegion[];
  margin: OverlayRegion[];
  paddingBadges: OverlayBadge[];
  marginBadges: OverlayBadge[];
  guides: OverlayGuide[];
  borderRadius: string;
  radiusLabel: string | null;
  radiusBadge: { left: number; top: number; text: string } | null;
}

export function parsePx(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toOverlayRect(rect: DOMRect | Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): OverlayRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  };
}

export function formatRadiusLabel(radius: string) {
  const trimmed = radius.trim();
  if (!trimmed || trimmed === '0px') return null;
  const parts = trimmed.split(/\s+/).map(part => parsePx(part));
  if (!parts.some(value => value > 0)) return null;
  if (parts.every(part => Math.round(part) === Math.round(parts[0]!))) {
    return `${Math.round(parts[0]!)}px`;
  }
  return trimmed;
}

function region(side: OverlayRegion['side'], left: number, top: number, width: number, height: number): OverlayRegion {
  return { side, left, top, width, height };
}

function badge(
  side: OverlayBadge['side'],
  kind: OverlayBadge['kind'],
  px: number,
  left: number,
  top: number,
): OverlayBadge {
  return { side, kind, text: String(Math.round(px)), left, top };
}

export function buildOverlayGuides(border: OverlayRect, viewportWidth: number, viewportHeight: number): OverlayGuide[] {
  return [
    { orientation: 'vertical', position: border.left, start: 0, end: viewportHeight },
    { orientation: 'vertical', position: border.right, start: 0, end: viewportHeight },
    { orientation: 'horizontal', position: border.top, start: 0, end: viewportWidth },
    { orientation: 'horizontal', position: border.bottom, start: 0, end: viewportWidth },
  ];
}

export function buildOverlayModel(
  rect: DOMRect | Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  box: OverlayBoxStyle,
  viewportWidth: number,
  viewportHeight: number,
): OverlayModel {
  const border = toOverlayRect(rect);
  const padding: OverlayRegion[] = [];
  const margin: OverlayRegion[] = [];
  const paddingBadges: OverlayBadge[] = [];
  const marginBadges: OverlayBadge[] = [];

  if (box.paddingTop > 0) {
    padding.push(region('top', border.left, border.top, border.width, box.paddingTop));
    paddingBadges.push(badge('top', 'padding', box.paddingTop, border.left + border.width / 2, border.top + box.paddingTop / 2));
  }
  if (box.paddingBottom > 0) {
    padding.push(region('bottom', border.left, border.bottom - box.paddingBottom, border.width, box.paddingBottom));
    paddingBadges.push(badge('bottom', 'padding', box.paddingBottom, border.left + border.width / 2, border.bottom - box.paddingBottom / 2));
  }
  if (box.paddingLeft > 0) {
    const height = Math.max(0, border.height - box.paddingTop - box.paddingBottom);
    padding.push(region('left', border.left, border.top + box.paddingTop, box.paddingLeft, height));
    paddingBadges.push(badge('left', 'padding', box.paddingLeft, border.left + box.paddingLeft / 2, border.top + box.paddingTop + height / 2));
  }
  if (box.paddingRight > 0) {
    const height = Math.max(0, border.height - box.paddingTop - box.paddingBottom);
    padding.push(region('right', border.right - box.paddingRight, border.top + box.paddingTop, box.paddingRight, height));
    paddingBadges.push(badge('right', 'padding', box.paddingRight, border.right - box.paddingRight / 2, border.top + box.paddingTop + height / 2));
  }

  if (box.marginTop > 0) {
    margin.push(region('top', border.left - box.marginLeft, border.top - box.marginTop, border.width + box.marginLeft + box.marginRight, box.marginTop));
    marginBadges.push(badge('top', 'margin', box.marginTop, border.left + border.width / 2, border.top - box.marginTop / 2));
  }
  if (box.marginBottom > 0) {
    margin.push(region('bottom', border.left - box.marginLeft, border.bottom, border.width + box.marginLeft + box.marginRight, box.marginBottom));
    marginBadges.push(badge('bottom', 'margin', box.marginBottom, border.left + border.width / 2, border.bottom + box.marginBottom / 2));
  }
  if (box.marginLeft > 0) {
    margin.push(region('left', border.left - box.marginLeft, border.top, box.marginLeft, border.height));
    marginBadges.push(badge('left', 'margin', box.marginLeft, border.left - box.marginLeft / 2, border.top + border.height / 2));
  }
  if (box.marginRight > 0) {
    margin.push(region('right', border.right, border.top, box.marginRight, border.height));
    marginBadges.push(badge('right', 'margin', box.marginRight, border.right + box.marginRight / 2, border.top + border.height / 2));
  }

  const radiusLabel = formatRadiusLabel(box.borderRadius);
  const radiusBadge = radiusLabel
    ? { left: border.left + 8, top: border.top - 28, text: radiusLabel }
    : null;

  return {
    border,
    padding,
    margin,
    paddingBadges,
    marginBadges,
    guides: buildOverlayGuides(border, viewportWidth, viewportHeight),
    borderRadius: box.borderRadius,
    radiusLabel,
    radiusBadge,
  };
}

export function readOverlayBoxStyle(style: CSSStyleDeclaration): OverlayBoxStyle {
  return {
    paddingTop: parsePx(style.paddingTop),
    paddingRight: parsePx(style.paddingRight),
    paddingBottom: parsePx(style.paddingBottom),
    paddingLeft: parsePx(style.paddingLeft),
    marginTop: parsePx(style.marginTop),
    marginRight: parsePx(style.marginRight),
    marginBottom: parsePx(style.marginBottom),
    marginLeft: parsePx(style.marginLeft),
    borderRadius: style.borderRadius || style.getPropertyValue('border-radius') || '0px',
  };
}
