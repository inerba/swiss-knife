export interface PageSize {
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
}

export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
}

export type ScreenshotFormat = 'image/png' | 'image/jpeg' | 'image/webp';
export const screenshotFormats: Array<{ value: ScreenshotFormat; label: string }> = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
];

// Self-contained functions: Chrome serializes them into the target page.
export function readPageSize(): PageSize {
  const root = document.documentElement;
  const body = document.body;
  return {
    width: Math.max(root.scrollWidth, root.offsetWidth, body?.scrollWidth || 0, body?.offsetWidth || 0),
    height: Math.max(root.scrollHeight, root.offsetHeight, body?.scrollHeight || 0, body?.offsetHeight || 0),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

interface CaptureSession {
  elements: Array<{ element: HTMLElement; visibility: string; priority: string }>;
  known: WeakSet<HTMLElement>;
  style: HTMLStyleElement;
  animations: Animation[];
}

// Self-contained functions: Chrome serializes them into the target page.
export function preparePageCapture(session: string) {
  const pageWindow = window as Window & { __swissScreenshotSessions?: Map<string, CaptureSession> };
  const pageSessions = pageWindow.__swissScreenshotSessions ||= new Map();
  if (pageSessions.has(session)) return;
  const style = document.createElement('style');
  style.dataset.swissScreenshotCapture = session;
  style.textContent = `
    :root[data-swiss-screenshot-freeze="${session}"] *,
    :root[data-swiss-screenshot-freeze="${session}"] *::before,
    :root[data-swiss-screenshot-freeze="${session}"] *::after {
      animation: none !important;
      transition: none !important;
    }
    :root[data-swiss-screenshot-freeze="${session}"] { scroll-behavior: auto !important; }
  `;
  document.documentElement.dataset.swissScreenshotFreeze = session;
  document.documentElement.append(style);
  const elements: CaptureSession['elements'] = [];
  const known = new WeakSet<HTMLElement>();
  const visit = (root: Document | ShadowRoot) => {
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      const position = getComputedStyle(element).position;
      if (position === 'fixed' || position === 'sticky') {
        known.add(element);
        elements.push({ element, visibility: element.style.getPropertyValue('visibility'), priority: element.style.getPropertyPriority('visibility') });
      }
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };
  visit(document);
  const animations = document.getAnimations().filter(animation => animation.playState === 'running');
  animations.forEach(animation => animation.pause());
  pageSessions.set(session, { elements, known, style, animations });
}

export function setAffixedHidden(session: string, hidden: boolean) {
  const pageWindow = window as Window & { __swissScreenshotSessions?: Map<string, CaptureSession> };
  const capture = pageWindow.__swissScreenshotSessions?.get(session);
  if (!capture) return;
  if (hidden) {
    const visit = (root: Document | ShadowRoot) => {
      for (const element of root.querySelectorAll<HTMLElement>('*')) {
        if (!capture.known.has(element)) {
          const position = getComputedStyle(element).position;
          if (position === 'fixed' || position === 'sticky') {
            capture.known.add(element);
            capture.elements.push({ element, visibility: element.style.getPropertyValue('visibility'), priority: element.style.getPropertyPriority('visibility') });
          }
        }
        if (element.shadowRoot) visit(element.shadowRoot);
      }
    };
    visit(document);
  }
  capture.elements.forEach(({ element }) => {
    if (element.isConnected) element.style.setProperty('visibility', hidden ? 'hidden' : '', hidden ? 'important' : '');
  });
}

export function restorePageCapture(session: string) {
  const pageWindow = window as Window & { __swissScreenshotSessions?: Map<string, CaptureSession> };
  const pageSessions = pageWindow.__swissScreenshotSessions;
  const capture = pageSessions?.get(session);
  if (!capture) return;
  capture.elements.forEach(({ element, visibility, priority }) => {
    if (element.isConnected) {
      if (visibility) element.style.setProperty('visibility', visibility, priority);
      else element.style.removeProperty('visibility');
    }
  });
  capture.animations.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
  capture.style.remove();
  if (document.documentElement.dataset.swissScreenshotFreeze === session) delete document.documentElement.dataset.swissScreenshotFreeze;
  pageSessions?.delete(session);
}

export async function moveTo(x: number, y: number) {
  const scroller = document.scrollingElement;
  if (scroller) scroller.scrollTo({ left: x, top: y, behavior: 'instant' as ScrollBehavior });
  window.scrollTo({ left: x, top: y, behavior: 'instant' as ScrollBehavior });
  let stableFrames = 0;
  let previousX = -1;
  let previousY = -1;
  for (let frame = 0; frame < 20 && stableFrames < 3; frame++) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (Math.abs(window.scrollX - previousX) < 0.5 && Math.abs(window.scrollY - previousY) < 0.5) stableFrames++;
    else stableFrames = 0;
    previousX = window.scrollX;
    previousY = window.scrollY;
  }
  return { x: window.scrollX, y: window.scrollY };
}

export function chooseRectangle(): Promise<SelectionRect | null> {
  return new Promise(resolve => {
    const host = document.createElement('div');
    host.dataset.swissScreenshotSelect = '';
    host.setAttribute('popover', 'manual');
    const shadow = host.attachShadow({ mode: 'closed' });
    const veil = document.createElement('div');
    const box = document.createElement('div');
    const hint = document.createElement('div');
    let origin: { x: number; y: number } | null = null;
    let current: { x: number; y: number } | null = null;
    let active = false;
    const cleanup = (result: SelectionRect | null) => {
      try { host.hidePopover(); } catch { /* Fixed-position fallback. */ }
      host.remove();
      window.removeEventListener('keydown', onKey, true);
      resolve(result);
    };
    const paint = () => {
      if (!origin || !current) return;
      const left = Math.min(origin.x, current.x);
      const top = Math.min(origin.y, current.y);
      box.style.setProperty('display', 'block', 'important');
      box.style.setProperty('left', `${left}px`, 'important');
      box.style.setProperty('top', `${top}px`, 'important');
      box.style.setProperty('width', `${Math.abs(current.x - origin.x)}px`, 'important');
      box.style.setProperty('height', `${Math.abs(current.y - origin.y)}px`, 'important');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation(); cleanup(null);
    };
    veil.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      origin = { x: event.clientX, y: event.clientY }; current = origin; active = true;
      veil.setPointerCapture(event.pointerId); paint();
    });
    veil.addEventListener('pointermove', event => { if (active) { event.preventDefault(); event.stopPropagation(); current = { x: event.clientX, y: event.clientY }; paint(); } });
    veil.addEventListener('pointerup', event => {
      if (!active || !origin) return;
      event.preventDefault(); event.stopPropagation(); active = false;
      const left = Math.min(origin.x, event.clientX); const top = Math.min(origin.y, event.clientY);
      const width = Math.abs(event.clientX - origin.x); const height = Math.abs(event.clientY - origin.y);
      cleanup(width >= 2 && height >= 2 ? { left, top, width, height, viewportWidth: window.innerWidth } : null);
    });
    veil.addEventListener('contextmenu', event => { event.preventDefault(); cleanup(null); });
    const important = (element: HTMLElement, values: Record<string, string>) => Object.entries(values).forEach(([property, value]) => element.style.setProperty(property, value, 'important'));
    important(veil, { position: 'fixed', inset: '0', cursor: 'crosshair', background: 'rgba(0, 0, 0, .18)', touchAction: 'none' });
    important(box, { position: 'fixed', display: 'none', pointerEvents: 'none', border: '2px solid #ffab98', background: 'rgba(255, 171, 152, .18)' });
    hint.textContent = 'Trascina per selezionare · Esc annulla';
    important(hint, { position: 'fixed', top: '8px', left: '8px', maxWidth: 'calc(100vw - 16px)', padding: '8px 12px', borderRadius: '8px', background: '#24272e', color: 'white', font: '13px system-ui', pointerEvents: 'none' });
    shadow.append(veil, box, hint);
    important(host, { all: 'initial', display: 'block', position: 'fixed', inset: '0', width: '100vw', height: '100vh', margin: '0', padding: '0', border: '0', background: 'transparent', zIndex: '2147483647', pointerEvents: 'auto' });
    document.documentElement.append(host);
    try { host.showPopover(); } catch { /* Fixed-position fallback. */ }
    window.addEventListener('keydown', onKey, true);
  });
}

export function screenshotFilename(kind: 'pagina' | 'schermata' | 'selezione', format: ScreenshotFormat = 'image/png') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = format === 'image/jpeg' ? 'jpg' : format.slice('image/'.length);
  return `screenshot-${kind}-${stamp}.${extension}`;
}

export function assertCanvasSize(width: number, height: number) {
  if (width > 16_384 || height > 16_384 || width * height > 100_000_000) {
    throw new Error('La pagina è troppo grande per uno screenshot completo. Riduci lo zoom o usa lo screenshot della schermata o della selezione.');
  }
}

export function encodeCanvas(canvas: HTMLCanvasElement, format: ScreenshotFormat) {
  return canvas.toDataURL(format, format === 'image/png' ? undefined : 0.92);
}

export async function convertScreenshot(dataUrl: string, format: ScreenshotFormat): Promise<string> {
  if (dataUrl.startsWith(`data:${format};`)) return dataUrl;
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossibile convertire lo screenshot.');
  if (format === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.drawImage(image, 0, 0);
  return encodeCanvas(canvas, format);
}

export async function cropScreenshot(dataUrl: string, rect: SelectionRect, format: ScreenshotFormat = 'image/png'): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = screenshotScale(image.naturalWidth, rect.viewportWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(rect.width * scale); canvas.height = Math.round(rect.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Impossibile preparare lo screenshot selezionato.');
  if (format === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
  context.drawImage(image, Math.round(rect.left * scale), Math.round(rect.top * scale), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return encodeCanvas(canvas, format);
}

export function screenshotScale(imageWidth: number, pageViewportWidth: number) {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(pageViewportWidth) || imageWidth <= 0 || pageViewportWidth <= 0) {
    throw new Error('Dimensioni non valide per lo screenshot. Riprova.');
  }
  return imageWidth / pageViewportWidth;
}

export function outerWidthForViewport(currentOuterWidth: number, currentViewportWidth: number, targetViewportWidth: number) {
  return Math.max(500, Math.round(currentOuterWidth + targetViewportWidth - currentViewportWidth));
}

export function fullPageOutputScale(captureScale: number, requestedWidth: number | null, pageViewportWidth: number) {
  return requestedWidth ? requestedWidth / pageViewportWidth : captureScale;
}
