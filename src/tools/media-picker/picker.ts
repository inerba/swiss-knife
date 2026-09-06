import { collectMedia, type CollectedSelection } from './scan';

export function installPicker(onResult: (result: CollectedSelection) => void, onCancel: () => void, onError: (error: unknown) => void) {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];
  const registered = new WeakSet<Document>();
  const refreshers: Array<() => void> = [];
  let selected = false;
  let last: { doc: Document; x: number; y: number; element?: Element } | undefined;
  function register(doc: Document) {
    if (registered.has(doc)) return;
    registered.add(doc);
    const view = doc.defaultView;
    if (!view) return;
    const overlay = doc.createElement('div');
    overlay.setAttribute('data-swiss-picker', '');
    const shadow = overlay.attachShadow({ mode: 'closed' });
    const box = doc.createElement('div');
    box.style.cssText = 'position:fixed;pointer-events:none;outline:2px solid #e85235;background:#e8523518;display:none;';
    const hint = doc.createElement('div');
    const instructions = 'Clic/Invio seleziona · ↑ amplia · ↓ restringe · Esc annulla';
    hint.textContent = `Cattura file multimediali · ${instructions}`;
    hint.style.cssText = 'position:fixed;top:8px;left:8px;max-width:90vw;background:#24272e;color:white;padding:8px 12px;border-radius:8px;font:13px system-ui;pointer-events:none;';
    shadow.append(box, hint);
    overlay.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    // A manual popover keeps the highlight above dialogs without blocking the page.
    overlay.setAttribute('popover', 'manual');
    doc.documentElement.append(overlay);
    try { overlay.showPopover(); } catch { /* Fixed-position fallback. */ }
    const style = doc.createElement('style');
    style.setAttribute('data-swiss-picker', '');
    style.textContent = '* { cursor: crosshair !important; }';
    doc.documentElement.append(style);
    const shields = doc.createElement('div');
    shadow.append(shields);
    function refreshShields() {
      shields.replaceChildren();
      function visit(root: Document | ShadowRoot) {
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) visit(el.shadowRoot);
          if (el.localName !== 'iframe') continue;
          try { if ((el as HTMLIFrameElement).contentDocument) continue; } catch { /* Block the inaccessible frame surface. */ }
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const shield = doc.createElement('div');
          shield.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:auto;cursor:crosshair;`;
          shields.append(shield);
        }
      }
      visit(doc);
    }
    refreshers.push(refreshShields);
    view.addEventListener('scroll', refreshShields, true);
    view.addEventListener('resize', refreshShields);
    let raf = 0;
    const descendants: Element[] = [];
    function highlight(element: Element) {
      const r = element.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      hint.textContent = `${element.localName}${element.id ? `#${element.id}` : ''} e contenuti · ${instructions}`;
    }
    function pointed(event: MouseEvent) {
      const pathElement = event.composedPath().find(node => node instanceof Element) as Element | undefined;
      return pathElement && pathElement !== overlay ? pathElement : doc.elementsFromPoint?.(event.clientX, event.clientY).find(el => el !== overlay);
    }
    const move = (event: PointerEvent) => {
      if (selected) return;
      const element = pointed(event);
      last = { doc, x: event.clientX, y: event.clientY, element }; descendants.length = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!element) return;
        highlight(element);
      });
    };
    const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    const choose = (point: { doc: Document; x: number; y: number; element?: Element }) => {
      if (selected) return;
      selected = true;
      box.style.display = 'none'; hint.textContent = 'Ricerca dei file multimediali…';
      const selectedElement = point.element;
      void (async () => {
        try {
          // Convert child-frame coordinates back to the top document so that
          // underlying parent layers are included as well as frame contents.
          while (point.doc !== document) {
            const frame = point.doc.defaultView?.frameElement as HTMLIFrameElement | null;
            if (!frame) break;
            const rect = frame.getBoundingClientRect();
            point = { doc: frame.ownerDocument,
              x: rect.left + (point.x + frame.clientLeft) * rect.width / (frame.offsetWidth || rect.width),
              y: rect.top + (point.y + frame.clientTop) * rect.height / (frame.offsetHeight || rect.height) };
          }
          const result = await collectMedia(point.doc, point.x, point.y, controller.signal, selectedElement);
          if (!controller.signal.aborted) { removeUI(); onResult(result); }
        } catch (error) { if (!controller.signal.aborted) { removeUI(); onError(error); } }
      })();
    };
    const click = (event: MouseEvent) => { block(event); choose({ doc, x: event.clientX, y: event.clientY, element: last?.doc === doc ? last.element : pointed(event) }); };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { block(event); dispose(); onCancel(); }
      else if (event.key === 'Enter' && last) { block(event); choose(last); }
      else if (!selected && last?.doc === doc && last.element && event.key === 'ArrowUp') {
        block(event);
        const parent = last.element.parentElement || (last.element.getRootNode() as ShadowRoot).host;
        if (parent) { descendants.push(last.element); last.element = parent; highlight(parent); }
      } else if (!selected && last?.doc === doc && event.key === 'ArrowDown') {
        block(event); const child = descendants.pop(); if (child) { last.element = child; highlight(child); }
      }
    };
    view.addEventListener('pointermove', move, true);
    view.addEventListener('click', click, true);
    view.addEventListener('keydown', key, true);
    const blocked = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick', 'dblclick', 'contextmenu'];
    blocked.forEach(type => view.addEventListener(type, block, true));
    cleanups.push(() => {
      cancelAnimationFrame(raf); overlay.remove(); style.remove();
      view.removeEventListener('scroll', refreshShields, true); view.removeEventListener('resize', refreshShields);
      view.removeEventListener('pointermove', move, true); view.removeEventListener('click', click, true); view.removeEventListener('keydown', key, true);
      blocked.forEach(type => view.removeEventListener(type, block, true));
    });
  }
  function discover(root: Document | ShadowRoot) {
    if (root.nodeType === 9) register(root as Document);
    for (const element of root.querySelectorAll('iframe, *')) {
      if (element.shadowRoot) discover(element.shadowRoot);
      if (element.localName === 'iframe') {
        try { const doc = (element as HTMLIFrameElement).contentDocument; if (doc) discover(doc); } catch { /* Same-origin boundary. */ }
      }
    }
  }
  function removeUI() { clearInterval(timer); refreshers.length = 0; cleanups.splice(0).forEach(fn => fn()); }
  function dispose() { controller.abort(); removeUI(); }
  // Discover newly loaded same-origin frames while the picker is active.
  const timer = setInterval(() => { if (!selected) { discover(document); refreshers.forEach(fn => fn()); } }, 1000);
  discover(document);
  refreshers.forEach(fn => fn());
  return dispose;
}
