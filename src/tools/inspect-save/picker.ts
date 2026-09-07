import { buildMarkupSnippet } from './markup';
import { cropRectToViewport, isRectClipped, sampleElement } from './sample';
import type { SnapshotPayload } from './types';

export interface PickerPoint {
  doc: Document;
  x: number;
  y: number;
  element?: Element;
}

export function installInspectPicker(onPick: (payload: SnapshotPayload) => void, onCancel: () => void) {
  const cleanups: Array<() => void> = [];
  const registered = new WeakSet<Document>();
  let pointed: Element | undefined;
  const trail: Element[] = [];
  let disposed = false;

  function register(doc: Document) {
    if (registered.has(doc)) return;
    registered.add(doc);
    const view = doc.defaultView;
    if (!view) return;

    const host = doc.createElement('div');
    host.setAttribute('data-swiss-inspect', '');
    host.setAttribute('popover', 'manual');
    const shadow = host.attachShadow({ mode: 'closed' });

    const box = doc.createElement('div');
    const padTop = doc.createElement('div');
    const padRight = doc.createElement('div');
    const padBottom = doc.createElement('div');
    const padLeft = doc.createElement('div');
    const padTopLabel = doc.createElement('span');
    const padRightLabel = doc.createElement('span');
    const padBottomLabel = doc.createElement('span');
    const padLeftLabel = doc.createElement('span');
    const coords = doc.createElement('div');
    const tooltip = doc.createElement('div');
    const hint = doc.createElement('div');

    const boxStyle = 'position:fixed;pointer-events:none;outline:2px solid #6366f1;background:rgba(99,102,241,.12);display:none;box-sizing:border-box;';
    box.style.cssText = boxStyle;
    const padBase = 'position:fixed;pointer-events:none;display:none;background:rgba(52,199,89,.35);color:#065f46;font:600 10px/1 system-ui;align-items:center;justify-content:center;';
    padTop.style.cssText = `${padBase}flex-direction:column;`;
    padRight.style.cssText = padBase;
    padBottom.style.cssText = `${padBase}flex-direction:column;`;
    padLeft.style.cssText = padBase;
    coords.style.cssText = 'position:fixed;pointer-events:none;display:none;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:999px;padding:2px 8px;font:11px/1.4 ui-monospace,monospace;color:#3a3a3c;box-shadow:0 1px 3px rgba(0,0,0,.08);';
    tooltip.style.cssText = 'position:fixed;pointer-events:none;display:none;max-width:min(320px,calc(100vw - 16px));background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px 12px;font:12px/1.45 system-ui;color:#2c2c2e;box-shadow:0 8px 20px rgba(0,0,0,.08);';
    hint.textContent = 'Ispeziona e salva · ↑ amplia · ↓ restringe · Invio conferma · Esc annulla';
    hint.style.cssText = 'position:fixed;top:8px;left:8px;max-width:calc(100vw - 16px);background:#24272e;color:#fff;padding:8px 12px;border-radius:8px;font:13px system-ui;pointer-events:none;';

    shadow.append(box, padTop, padTopLabel, padRight, padRightLabel, padBottom, padBottomLabel, padLeft, padLeftLabel, coords, tooltip, hint);
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    doc.documentElement.append(host);
    try { host.showPopover(); } catch { /* Fixed-position fallback. */ }

    const style = doc.createElement('style');
    style.setAttribute('data-swiss-inspect', '');
    style.textContent = '* { cursor: crosshair !important; }';
    doc.documentElement.append(style);

    function parsePadding(value: string) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function draw(element?: Element) {
      if (!element) {
        box.style.display = 'none';
        coords.style.display = 'none';
        tooltip.style.display = 'none';
        [padTop, padRight, padBottom, padLeft].forEach(node => { node.style.display = 'none'; });
        return;
      }
      const rect = element.getBoundingClientRect();
      const computed = view!.getComputedStyle(element);
      const pt = parsePadding(computed.paddingTop);
      const pr = parsePadding(computed.paddingRight);
      const pb = parsePadding(computed.paddingBottom);
      const pl = parsePadding(computed.paddingLeft);

      Object.assign(box.style, {
        display: 'block',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });

      const placePad = (node: HTMLElement, label: HTMLElement, left: number, top: number, width: number, height: number, text: string) => {
        if (width < 1 || height < 1 || !text || text === '0') {
          node.style.display = 'none';
          return;
        }
        Object.assign(node.style, { display: 'flex', left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
        label.textContent = text;
        label.style.cssText = 'pointer-events:none;';
        if (!label.isConnected) node.append(label);
      };

      placePad(padTop, padTopLabel, rect.left, rect.top, rect.width, pt, pt ? String(Math.round(pt)) : '');
      placePad(padBottom, padBottomLabel, rect.left, rect.bottom - pb, rect.width, pb, pb ? String(Math.round(pb)) : '');
      placePad(padLeft, padLeftLabel, rect.left, rect.top + pt, pl, rect.height - pt - pb, pl ? String(Math.round(pl)) : '');
      placePad(padRight, padRightLabel, rect.right - pr, rect.top + pt, pr, rect.height - pt - pb, pr ? String(Math.round(pr)) : '');

      Object.assign(coords.style, {
        display: 'block',
        left: `${Math.min(rect.right - 8, view!.innerWidth - 80)}px`,
        top: `${Math.min(rect.bottom + 4, view!.innerHeight - 24)}px`,
      });
      coords.textContent = `${Math.round(rect.left)}, ${Math.round(rect.top)}`;

      const fontFamily = computed.fontFamily.split(',')[0]?.replace(/["']/g, '').trim() || computed.fontFamily;
      tooltip.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <span style="background:rgba(99,102,241,.12);color:#4f46e5;padding:2px 8px;border-radius:999px;font-weight:600;">&lt;${element.localName.toLowerCase()}&gt;</span>
          <span style="color:#636366;font-family:ui-monospace,monospace;">${Math.round(rect.width)} × ${Math.round(rect.height)}</span>
        </div>
        <div style="display:grid;gap:4px;">
          <div><span style="color:#8e8e93;font-size:10px;letter-spacing:.04em;">TESTO</span><br><span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:4px;background:${computed.color};border:1px solid rgba(0,0,0,.08);"></span>${computed.color}</span></div>
          <div><span style="color:#8e8e93;font-size:10px;letter-spacing:.04em;">SFONDO</span><br><span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:4px;background:${computed.backgroundColor};border:1px solid rgba(0,0,0,.08);"></span>${computed.backgroundColor}</span></div>
          <div><span style="color:#8e8e93;font-size:10px;letter-spacing:.04em;">FONT</span><br>${fontFamily} ${computed.fontSize} · ${computed.fontWeight}</div>
        </div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,.06);color:#8e8e93;font-size:11px;">↑ amplia · ↓ restringe · Invio conferma</div>
      `;
      const tooltipWidth = 280;
      const tooltipLeft = Math.min(Math.max(8, rect.left), view!.innerWidth - tooltipWidth - 8);
      let tooltipTop = rect.bottom + 8;
      if (tooltipTop + 160 > view!.innerHeight) tooltipTop = Math.max(8, rect.top - 160);
      Object.assign(tooltip.style, { display: 'block', left: `${tooltipLeft}px`, top: `${tooltipTop}px` });
    }

    function resolveElement(event: MouseEvent) {
      const pathElement = event.composedPath().find(node => node instanceof Element && !node.hasAttribute('data-swiss-inspect')) as Element | undefined;
      return pathElement ?? doc.elementsFromPoint(event.clientX, event.clientY).find(el => !el.hasAttribute?.('data-swiss-inspect'));
    }

    let raf = 0;
    const move = (event: PointerEvent) => {
      if (disposed) return;
      const element = resolveElement(event);
      pointed = element;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => draw(element));
    };

    const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };

    function removeUi() {
      cancelAnimationFrame(raf);
      host.remove();
      style.remove();
    }

    function buildPayload(element: Element): SnapshotPayload {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const rectRaw = element.getBoundingClientRect();
      const viewportWidth = view!.innerWidth;
      const viewportHeight = view!.innerHeight;
      const clipped = isRectClipped(rectRaw, viewportWidth, viewportHeight);
      const rect = cropRectToViewport(rectRaw, viewportWidth, viewportHeight);
      const sampled = sampleElement(element);
      return {
        tag: sampled.tag,
        tagLabel: sampled.tagLabel,
        selector: sampled.selector,
        classes: sampled.classes,
        dimensions: sampled.dimensions,
        rect,
        clipped,
        sections: sampled.sections,
        markup: buildMarkupSnippet(element),
      };
    }

    function choose(element?: Element) {
      if (disposed || !element) return;
      disposed = true;
      removeUi();
      onPick(buildPayload(element));
    }

    const click = (event: MouseEvent) => {
      block(event);
      choose(pointed ?? resolveElement(event));
    };

    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { block(event); disposed = true; removeUi(); onCancel(); }
      else if (event.key === 'Enter' && pointed) { block(event); choose(pointed); }
      else if (pointed && event.key === 'ArrowUp') {
        block(event);
        const parent = pointed.parentElement || (pointed.getRootNode() as ShadowRoot).host as Element | undefined;
        if (parent instanceof Element) { trail.push(pointed); pointed = parent; draw(pointed); }
      } else if (event.key === 'ArrowDown') {
        block(event);
        const child = trail.pop();
        if (child) { pointed = child; draw(pointed); }
      }
    };

    view.addEventListener('pointermove', move, true);
    view.addEventListener('click', click, true);
    view.addEventListener('keydown', key, true);
    const blocked = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick', 'dblclick', 'contextmenu'];
    blocked.forEach(type => view.addEventListener(type, block, true));

    cleanups.push(() => {
      view.removeEventListener('pointermove', move, true);
      view.removeEventListener('click', click, true);
      view.removeEventListener('keydown', key, true);
      blocked.forEach(type => view.removeEventListener(type, block, true));
      removeUi();
    });
  }

  function discover(root: Document | ShadowRoot) {
    if (root.nodeType === 9) register(root as Document);
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) discover(element.shadowRoot);
      if (element.localName === 'iframe') {
        try {
          const doc = (element as HTMLIFrameElement).contentDocument;
          if (doc) discover(doc);
        } catch { /* Same-origin boundary. */ }
      }
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cleanups.splice(0).forEach(fn => fn());
  }

  discover(document);
  return dispose;
}

export function pointedElement(doc: Document, x: number, y: number, overlayFlag = 'data-swiss-inspect') {
  return doc.elementsFromPoint(x, y).find(el => !el.hasAttribute(overlayFlag));
}

export function parentTarget(element: Element): Element | undefined {
  const parent = element.parentElement || (element.getRootNode() as ShadowRoot).host;
  return parent instanceof Element ? parent : undefined;
}

export function navigateUp(pointed: Element | undefined, trail: Element[]) {
  if (!pointed) return { pointed, trail };
  const parent = parentTarget(pointed);
  if (!parent) return { pointed, trail };
  return { pointed: parent, trail: [...trail, pointed] };
}

export function navigateDown(pointed: Element | undefined, trail: Element[]) {
  const child = trail.at(-1);
  if (!child) return { pointed, trail };
  return { pointed: child, trail: trail.slice(0, -1) };
}
