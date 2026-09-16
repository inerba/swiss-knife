import { collectRuleContext } from './css-match';
import { listSheets, scanStyleSheets, type ScanEnvironment } from './css-rules';
import { cleanMarkup } from './markup';
import { selectorPath, selectorSegment } from './path';
import { readResolvedValues } from './resolved';
import type { ContextPayload } from './types';

export function scanEnvironment(view: Window): ScanEnvironment {
  return {
    matchesMedia(query) {
      try {
        return view.matchMedia(query).matches;
      } catch {
        return false;
      }
    },
    supports(condition) {
      try {
        return (view as Window & { CSS: typeof CSS }).CSS.supports(condition);
      } catch {
        return false;
      }
    },
  };
}

export function buildContextPayload(element: Element, view: Window): ContextPayload {
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const rect = element.getBoundingClientRect();
  const pageUrl = view.location.href;
  const scan = scanStyleSheets(listSheets(element.ownerDocument), scanEnvironment(view), pageUrl);
  const rules = collectRuleContext(element, scan.entries, view);
  return {
    element: selectorSegment(element),
    path: selectorPath(element),
    url: pageUrl,
    viewport: { width: view.innerWidth, height: view.innerHeight, devicePixelRatio: view.devicePixelRatio || 1 },
    box: {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    rect: {
      left: rect.left + view.scrollX,
      top: rect.top + view.scrollY,
      width: rect.width,
      height: rect.height,
      viewportWidth: view.innerWidth,
      viewportHeight: view.innerHeight,
      scrollX: view.scrollX,
      scrollY: view.scrollY,
    },
    markup: cleanMarkup(element),
    css: { ...rules, resolved: readResolvedValues(element, view) },
    unreadableSheets: scan.unreadable,
  };
}
