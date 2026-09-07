export interface IsolationRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface IsolationRecord {
  element: HTMLElement;
  visibility: string;
  priority: string;
}

export function rectsOverlap(a: IsolationRect, b: IsolationRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function isKeptForCapture(candidate: Element, target: Element) {
  if (candidate === target) return true;
  if (candidate.contains(target) || target.contains(candidate)) return true;
  const document = candidate.ownerDocument;
  return candidate === document.documentElement || candidate === document.body;
}

export function shouldHideForElementCapture(
  candidate: Element,
  target: Element,
  candidateRect: IsolationRect,
  targetRect: IsolationRect,
  position: string,
) {
  if (!(candidate instanceof HTMLElement)) return false;
  if (candidate.hasAttribute('data-swiss-inspect')) return true;
  if (isKeptForCapture(candidate, target)) return false;
  if (position === 'fixed' || position === 'sticky') return true;
  return rectsOverlap(candidateRect, targetRect);
}

export function applyCaptureIsolation(target: Element) {
  const records: IsolationRecord[] = [];
  const targetRect = target.getBoundingClientRect();
  const visit = (root: Document | ShadowRoot) => {
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) visit(element.shadowRoot);
      if (!(element instanceof HTMLElement)) continue;
      const style = getComputedStyle(element);
      if (!shouldHideForElementCapture(element, target, element.getBoundingClientRect(), targetRect, style.position)) continue;
      records.push({
        element,
        visibility: element.style.getPropertyValue('visibility'),
        priority: element.style.getPropertyPriority('visibility'),
      });
      element.style.setProperty('visibility', 'hidden', 'important');
    }
  };
  visit(target.ownerDocument);
  return () => {
    for (const record of records) {
      if (!record.element.isConnected) continue;
      if (record.visibility) record.element.style.setProperty('visibility', record.visibility, record.priority);
      else record.element.style.removeProperty('visibility');
    }
  };
}

export function waitForPaintFrames(frames = 2) {
  return new Promise<void>(resolve => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(frames);
  });
}
