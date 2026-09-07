import { buildMarkupSnippet } from './markup';

import {

  buildOverlayModel,

  readOverlayBoxStyle,

  type OverlayBadge,

  type OverlayGuide,

  type OverlayRegion,

} from './overlay-model';

import { sampleElement } from './sample';

import type { PickerCommand, SnapshotPayload } from './types';



const POINTER_LOCK_PX = 4;



export function shouldFollowPointer(locked: boolean, originX: number, originY: number, x: number, y: number) {

  if (!locked) return true;

  const dx = x - originX;

  const dy = y - originY;

  return Math.hypot(dx, dy) >= POINTER_LOCK_PX;

}



export function parentTarget(element: Element): Element | undefined {

  const parent = element.parentElement || (element.getRootNode() as ShadowRoot).host;

  return parent instanceof Element && parent !== element ? parent : undefined;

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



export function pointedElement(doc: Document, x: number, y: number, overlayFlag = 'data-swiss-inspect') {

  return doc.elementsFromPoint(x, y).find(el => !el.hasAttribute(overlayFlag));

}



function detectCaptureLimitations(element: Element, view: Window) {

  const rect = element.getBoundingClientRect();

  const style = view.getComputedStyle(element);

  if (style.position === 'fixed' && (rect.height > view.innerHeight || rect.width > view.innerWidth)) {

    return true;

  }

  let parent = element.parentElement;

  while (parent) {

    const parentStyle = view.getComputedStyle(parent);

    const hidden = parentStyle.overflow === 'hidden'

      || parentStyle.overflowX === 'hidden'

      || parentStyle.overflowY === 'hidden';

    if (hidden && parent !== view.document.documentElement) return true;

    parent = parent.parentElement;

  }

  return false;

}



function snapshotPayload(element: Element, view: Window): SnapshotPayload {

  element.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  const rectRaw = element.getBoundingClientRect();

  const scrollX = view.scrollX;

  const scrollY = view.scrollY;

  const sampled = sampleElement(element);

  return {

    tag: sampled.tag,

    tagLabel: sampled.tagLabel,

    selector: sampled.selector,

    classes: sampled.classes,

    dimensions: sampled.dimensions,

    rect: {

      left: rectRaw.left + scrollX,

      top: rectRaw.top + scrollY,

      width: rectRaw.width,

      height: rectRaw.height,

      viewportWidth: view.innerWidth,

      viewportHeight: view.innerHeight,

      scrollX,

      scrollY,

    },

    clipped: detectCaptureLimitations(element, view),

    sections: sampled.sections,

    markup: buildMarkupSnippet(element),

  };

}



function waitForPaint() {

  return new Promise<void>(resolve => {

    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));

  });

}



export interface InspectPickerControl {

  dispose(): void;

  handleCommand(command: PickerCommand): void;

}



export function installInspectPicker(

  onPick: (payload: SnapshotPayload, element: Element) => void,

  onCancel: () => void,

): InspectPickerControl {

  const cleanups: Array<() => void> = [];

  const registered = new WeakSet<Document>();

  let pointed: Element | undefined;

  let trail: Element[] = [];

  let disposed = false;

  let cleaned = false;

  let locked = false;

  let lockX = 0;

  let lockY = 0;

  let choosing = false;

  const handlers = {
    expand: () => {},
    shrink: () => {},
    choose: (_element?: Element) => {},
    cancel: () => {},
  };

  const controls: InspectPickerControl = {

    dispose() {

      if (cleaned) return;

      cleaned = true;

      disposed = true;

      cleanups.splice(0).forEach(fn => fn());

    },

    handleCommand(command) {

      if (disposed || choosing) return;

      if (command === 'cancel') handlers.cancel();

      else if (command === 'confirm') void handlers.choose(pointed);

      else if (command === 'navigate-up') handlers.expand();

      else if (command === 'navigate-down') handlers.shrink();

    },

  };



  function register(doc: Document) {

    if (registered.has(doc)) return;

    registered.add(doc);

    const view = doc.defaultView;

    if (!view) return;

    const win = view;



    const host = doc.createElement('div');

    host.setAttribute('data-swiss-inspect', '');

    host.setAttribute('popover', 'manual');

    host.tabIndex = -1;

    const shadow = host.attachShadow({ mode: 'closed' });



    const guidesLayer = doc.createElement('div');

    const marginLayer = doc.createElement('div');

    const paddingLayer = doc.createElement('div');

    const box = doc.createElement('div');

    const badgeLayer = doc.createElement('div');

    const radiusBadge = doc.createElement('div');

    const coords = doc.createElement('div');

    const tooltip = doc.createElement('div');

    const hint = doc.createElement('div');



    const tagBadge = doc.createElement('span');

    const sizeLabel = doc.createElement('span');

    const textValue = doc.createElement('span');

    const backgroundValue = doc.createElement('span');

    const fontValue = doc.createElement('div');

    const textSwatch = doc.createElement('span');

    const backgroundSwatch = doc.createElement('span');

    const nav = doc.createElement('div');

    const up = doc.createElement('button');

    const down = doc.createElement('button');

    const navLabel = doc.createElement('span');



    const layerBase = 'position:fixed;pointer-events:none;inset:0;';

    guidesLayer.style.cssText = layerBase;

    marginLayer.style.cssText = layerBase;

    paddingLayer.style.cssText = layerBase;

    badgeLayer.style.cssText = layerBase;

    box.style.cssText = 'position:fixed;pointer-events:none;display:none;box-sizing:border-box;border:2px solid #6366f1;background:rgba(99,102,241,.08);';

    radiusBadge.style.cssText = 'position:fixed;pointer-events:none;display:none;align-items:center;gap:4px;background:#6366f1;color:#fff;padding:2px 8px;border-radius:999px;font:600 11px/1.4 system-ui;white-space:nowrap;';

    coords.style.cssText = 'position:fixed;pointer-events:none;display:none;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:999px;padding:2px 8px;font:11px/1.4 ui-monospace,monospace;color:#3a3a3c;box-shadow:0 1px 3px rgba(0,0,0,.08);';

    tooltip.style.cssText = 'position:fixed;pointer-events:none;display:none;max-width:min(320px,calc(100vw - 16px));background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:10px 12px;font:12px/1.45 system-ui;color:#2c2c2e;box-shadow:0 8px 20px rgba(0,0,0,.08);';

    hint.textContent = 'Ispeziona e salva · clicca le frecce o usa ↑ ↓ · Invio conferma · Esc annulla';

    hint.style.cssText = 'position:fixed;top:8px;left:8px;max-width:calc(100vw - 16px);background:#24272e;color:#fff;padding:8px 12px;border-radius:8px;font:13px system-ui;pointer-events:none;';



    const header = doc.createElement('div');

    header.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';

    tagBadge.style.cssText = 'background:rgba(99,102,241,.12);color:#4f46e5;padding:2px 8px;border-radius:999px;font-weight:600;';

    sizeLabel.style.cssText = 'color:#636366;font-family:ui-monospace,monospace;';

    header.append(tagBadge, sizeLabel);



    const rows = doc.createElement('div');

    rows.style.cssText = 'display:grid;gap:4px;';

    function caption(title: string, content: HTMLElement) {

      const wrap = doc.createElement('div');

      const label = doc.createElement('span');

      label.textContent = title;

      label.style.cssText = 'color:#8e8e93;font-size:10px;letter-spacing:.04em;';

      wrap.append(label, content);

      return wrap;

    }

    textSwatch.style.cssText = 'width:12px;height:12px;border-radius:4px;border:1px solid rgba(0,0,0,.08);display:inline-block;';

    backgroundSwatch.style.cssText = textSwatch.style.cssText;

    textValue.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';

    backgroundValue.style.cssText = textValue.style.cssText;

    textValue.prepend(textSwatch);

    backgroundValue.prepend(backgroundSwatch);

    const textText = doc.createElement('span');

    const backgroundText = doc.createElement('span');

    textValue.append(textText);

    backgroundValue.append(backgroundText);

    rows.append(caption('TESTO', textValue), caption('SFONDO', backgroundValue), caption('FONT', fontValue));



    nav.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,.06);display:flex;align-items:center;gap:6px;pointer-events:auto;';

    const navButton = 'width:28px;height:28px;padding:0;border:1px solid rgba(0,0,0,.12);border-radius:8px;background:#fff;cursor:pointer;font:16px/1 system-ui;color:#2c2c2e;';

    up.style.cssText = navButton;

    down.style.cssText = navButton;

    up.type = 'button';

    down.type = 'button';

    up.textContent = '↑';

    down.textContent = '↓';

    up.setAttribute('aria-label', 'Amplia la selezione');

    down.setAttribute('aria-label', 'Restringi la selezione');

    navLabel.textContent = 'naviga';

    navLabel.style.cssText = 'color:#8e8e93;font-size:11px;';

    nav.append(up, down, navLabel);



    tooltip.append(header, rows, nav);

    shadow.append(guidesLayer, marginLayer, paddingLayer, box, badgeLayer, radiusBadge, coords, tooltip, hint);



    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';

    doc.documentElement.append(host);

    try { host.showPopover(); } catch { /* Fixed-position fallback. */ }



    const style = doc.createElement('style');

    style.setAttribute('data-swiss-inspect', '');

    style.textContent = '* { cursor: crosshair !important; }';

    doc.documentElement.append(style);



    function clearLayer(layer: HTMLElement) {

      while (layer.firstChild) layer.removeChild(layer.firstChild);

    }



    function paintRegion(layer: HTMLElement, regions: OverlayRegion[], fill: string) {

      for (const region of regions) {

        const node = doc.createElement('div');

        node.style.cssText = `position:fixed;pointer-events:none;background:${fill};left:${region.left}px;top:${region.top}px;width:${region.width}px;height:${region.height}px;`;

        layer.append(node);

      }

    }



    function paintGuides(guides: OverlayGuide[]) {

      clearLayer(guidesLayer);

      for (const guide of guides) {

        const node = doc.createElement('div');

        if (guide.orientation === 'vertical') {

          node.style.cssText = `position:fixed;pointer-events:none;left:${guide.position}px;top:${guide.start}px;width:0;height:${guide.end - guide.start}px;border-left:1px dashed rgba(142,142,147,.85);`;

        } else {

          node.style.cssText = `position:fixed;pointer-events:none;left:${guide.start}px;top:${guide.position}px;width:${guide.end - guide.start}px;height:0;border-top:1px dashed rgba(142,142,147,.85);`;

        }

        guidesLayer.append(node);

      }

    }



    function paintBadges(badges: OverlayBadge[], kind: 'padding' | 'margin') {

      const palette = kind === 'padding'

        ? { bg: '#047857', color: '#fff' }

        : { bg: '#c2410c', color: '#fff' };

      for (const item of badges) {

        const node = doc.createElement('div');

        node.textContent = item.text;

        node.style.cssText = `position:fixed;pointer-events:none;transform:translate(-50%,-50%);left:${item.left}px;top:${item.top}px;background:${palette.bg};color:${palette.color};padding:2px 6px;border-radius:999px;font:600 11px/1.2 system-ui;min-width:18px;text-align:center;`;

        badgeLayer.append(node);

      }

    }



    function draw(element?: Element) {

      clearLayer(marginLayer);

      clearLayer(paddingLayer);

      clearLayer(badgeLayer);

      if (!element) {

        box.style.display = 'none';

        coords.style.display = 'none';

        tooltip.style.display = 'none';

        radiusBadge.style.display = 'none';

        clearLayer(guidesLayer);

        return;

      }



      const rect = element.getBoundingClientRect();

      const computed = win.getComputedStyle(element);

      const model = buildOverlayModel(rect, readOverlayBoxStyle(computed), win.innerWidth, win.innerHeight);



      paintGuides(model.guides);

      paintRegion(marginLayer, model.margin, 'rgba(255,149,0,.28)');

      paintRegion(paddingLayer, model.padding, 'rgba(52,199,89,.35)');

      paintBadges(model.paddingBadges, 'padding');

      paintBadges(model.marginBadges, 'margin');



      Object.assign(box.style, {

        display: 'block',

        left: `${model.border.left}px`,

        top: `${model.border.top}px`,

        width: `${model.border.width}px`,

        height: `${model.border.height}px`,

        borderRadius: model.borderRadius,

      });



      if (model.radiusBadge) {

        radiusBadge.style.display = 'flex';

        radiusBadge.style.left = `${model.radiusBadge.left}px`;

        radiusBadge.style.top = `${Math.max(8, model.radiusBadge.top)}px`;

        radiusBadge.textContent = `⌒ ${model.radiusBadge.text}`;

      } else {

        radiusBadge.style.display = 'none';

      }



      Object.assign(coords.style, {

        display: 'block',

        left: `${Math.min(model.border.right - 8, win.innerWidth - 80)}px`,

        top: `${Math.min(model.border.bottom + 4, win.innerHeight - 24)}px`,

      });

      coords.textContent = `${Math.round(model.border.left)}, ${Math.round(model.border.top)}`;



      const fontFamily = computed.fontFamily.split(',')[0]?.replace(/["']/g, '').trim() || computed.fontFamily;

      tagBadge.textContent = `<${element.localName.toLowerCase()}>`;

      sizeLabel.textContent = `${Math.round(model.border.width)} × ${Math.round(model.border.height)}`;

      textText.textContent = computed.color;

      backgroundText.textContent = computed.backgroundColor;

      textSwatch.style.background = computed.color;

      backgroundSwatch.style.background = computed.backgroundColor;

      fontValue.textContent = `${fontFamily} ${computed.fontSize} · ${computed.fontWeight}`;

      up.disabled = !parentTarget(element);

      down.disabled = trail.length === 0;



      const tooltipWidth = 280;

      const tooltipLeft = Math.min(Math.max(8, model.border.left), win.innerWidth - tooltipWidth - 8);

      let tooltipTop = model.border.bottom + 8;

      if (tooltipTop + 180 > win.innerHeight) tooltipTop = Math.max(8, model.border.top - 180);

      Object.assign(tooltip.style, { display: 'block', left: `${tooltipLeft}px`, top: `${tooltipTop}px` });

    }



    function fromOverlay(event: Event) {

      return event.composedPath().includes(host) || event.composedPath().includes(tooltip);

    }



    function resolveElement(event: MouseEvent) {

      const pathElement = event.composedPath().find(node => node instanceof Element && node !== host && !(host.contains(node))) as Element | undefined;

      if (pathElement && !pathElement.hasAttribute('data-swiss-inspect')) return pathElement;

      return doc.elementsFromPoint(event.clientX, event.clientY).find(el => el !== host && !el.hasAttribute?.('data-swiss-inspect'));

    }



    function lockAt(x: number, y: number) {

      locked = true;

      lockX = x;

      lockY = y;

    }



    function expand() {

      const next = navigateUp(pointed, trail);

      if (next.pointed === pointed) return;

      pointed = next.pointed;

      trail = next.trail;

      lockAt(lockX, lockY);

      draw(pointed);

    }



    function shrink() {

      const next = navigateDown(pointed, trail);

      if (next.pointed === pointed) return;

      pointed = next.pointed;

      trail = next.trail;

      lockAt(lockX, lockY);

      draw(pointed);

    }



    let raf = 0;

    const move = (event: PointerEvent) => {

      if (disposed || choosing || fromOverlay(event)) return;

      if (!shouldFollowPointer(locked, lockX, lockY, event.clientX, event.clientY)) return;

      locked = false;

      lockX = event.clientX;

      lockY = event.clientY;

      trail = [];

      const element = resolveElement(event);

      pointed = element;

      cancelAnimationFrame(raf);

      raf = requestAnimationFrame(() => draw(element));

    };



    const block = (event: Event) => {

      if (fromOverlay(event)) return;

      event.preventDefault();

      event.stopImmediatePropagation();

    };



    function removeUi() {

      cancelAnimationFrame(raf);

      host.remove();

      style.remove();

    }



    async function choose(element?: Element) {

      if (disposed || choosing || !element) return;

      choosing = true;

      disposed = true;

      host.style.visibility = 'hidden';

      style.textContent = '';

      await waitForPaint();

      const payload = snapshotPayload(element, win);

      controls.dispose();

      onPick(payload, element);

    }



    function cancel() {

      if (disposed || choosing) return;

      disposed = true;

      controls.dispose();

      onCancel();

    }

    handlers.expand = expand;
    handlers.shrink = shrink;
    handlers.choose = choose;
    handlers.cancel = cancel;

    const click = (event: MouseEvent) => {

      if (fromOverlay(event)) return;

      block(event);

      void choose(pointed ?? resolveElement(event));

    };



    const key = (event: KeyboardEvent) => {

      if (event.key === 'Escape') { block(event); cancel(); }

      else if (event.key === 'Enter' && pointed) { block(event); void choose(pointed); }

      else if (event.key === 'ArrowUp') { block(event); expand(); }

      else if (event.key === 'ArrowDown') { block(event); shrink(); }

    };



    const navEvent = (event: Event, action: () => void) => {

      event.preventDefault();

      event.stopImmediatePropagation();

      action();

    };

    up.addEventListener('click', event => navEvent(event, expand));

    down.addEventListener('click', event => navEvent(event, shrink));

    up.addEventListener('pointerdown', event => navEvent(event, () => {}));

    down.addEventListener('pointerdown', event => navEvent(event, () => {}));



    win.addEventListener('pointermove', move, true);

    win.addEventListener('click', click, true);

    win.addEventListener('keydown', key, true);

    host.addEventListener('keydown', key);

    const blocked = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick', 'dblclick', 'contextmenu'];

    blocked.forEach(type => win.addEventListener(type, block, true));



    cleanups.push(() => {

      win.removeEventListener('pointermove', move, true);

      win.removeEventListener('click', click, true);

      win.removeEventListener('keydown', key, true);

      host.removeEventListener('keydown', key);

      blocked.forEach(type => win.removeEventListener(type, block, true));

      removeUi();

    });

  }



  function discover(root: Document | ShadowRoot) {

    if (root.nodeType === 9) register(root as Document);

    for (const element of root.querySelectorAll('*')) {

      if (element.shadowRoot) discover(element.shadowRoot);

      if (element.localName === 'iframe') {

        try {

          const nested = (element as HTMLIFrameElement).contentDocument;

          if (nested) discover(nested);

        } catch { /* Same-origin boundary. */ }

      }

    }

  }



  discover(document);

  return controls;

}


