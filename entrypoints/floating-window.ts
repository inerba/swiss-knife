import { browser, type Browser } from 'wxt/browser';
import { clampPosition, FLOATING_FAILED, FLOATING_PORT, FLOATING_POSITION_KEY, floatingSize, isPoint, type Point } from '../src/lib/floating-window';

type Scope = typeof globalThis & { __swissFloating?: Record<'toggle' | 'open', (tool: string | null) => void> };

const HOST_STYLE = 'all: initial !important; display: block !important; position: fixed !important; inset: auto !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; overflow: visible !important; z-index: 2147483647 !important;';
const SHADOW_STYLE = `
iframe { display: block; inline-size: 100%; block-size: 100%; border: 0; border-radius: 14px; background: #fff; color-scheme: light;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, .12), 0 18px 48px rgba(15, 23, 42, .28); }
p { margin: 0; max-inline-size: 320px; padding: 12px 14px; border-radius: 12px; background: #1e1b4b; color: #fff;
  font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 12px 32px rgba(15, 23, 42, .3); }`;

export default defineUnlistedScript(() => {
  const scope = globalThis as Scope;
  if (scope.__swissFloating) return;

  let host: HTMLDivElement | undefined;
  let frame: HTMLIFrameElement | undefined;
  let port: Browser.runtime.Port | undefined;
  let pendingTool: string | null = null;
  let position: Point = { left: 0, top: 0 };
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let previousFocus: Element | null = null;

  const viewport = () => ({ width: document.documentElement.clientWidth || innerWidth, height: innerHeight });
  function place(next: Point | null) {
    if (!host || !frame) return;
    const size = floatingSize(viewport());
    position = clampPosition(next, size, viewport());
    for (const [name, value] of [['left', position.left], ['top', position.top], ['width', size.width], ['height', size.height]] as const) {
      host.style.setProperty(name, `${value}px`, 'important');
    }
  }
  const onResize = () => place(position);

  function createHost() {
    const element = document.createElement('div');
    element.setAttribute('popover', 'manual');
    element.style.cssText = HOST_STYLE;
    const root = element.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = SHADOW_STYLE;
    root.append(style);
    // Top layer keeps the window above page content; attach to <html> so an inert <body> cannot reach it.
    document.documentElement.append(element);
    element.showPopover?.();
    return { element, root };
  }

  async function open(tool: string | null) {
    if (tool) pendingTool = tool;
    if (host) {
      if (tool) port?.postMessage({ type: 'init', tool });
      frame?.focus();
      return;
    }
    clearNotice();
    previousFocus = document.activeElement;
    const { element, root } = createHost();
    host = element;
    frame = document.createElement('iframe');
    frame.title = 'Swiss Knife';
    const src = browser.runtime.getURL('/floating.html');
    // Set before src: the policy is evaluated when the frame navigates. With use_dynamic_url the
    // src origin differs from the extension origin the document runs in, so delegate to both.
    const origins = `'src' chrome-extension://${browser.runtime.id}`;
    frame.allow = `clipboard-read ${origins}; clipboard-write ${origins}`;
    frame.src = src;
    root.append(frame);
    place(null);
    addEventListener('resize', onResize);
    startTimer = setTimeout(failed, 3000);
    const stored = await browser.storage.local.get(FLOATING_POSITION_KEY).catch(() => ({} as Record<string, unknown>));
    if (host === element && isPoint(stored[FLOATING_POSITION_KEY])) place(stored[FLOATING_POSITION_KEY]);
  }

  function close(restoreFocus: boolean) {
    clearTimeout(startTimer);
    removeEventListener('resize', onResize);
    const current = port;
    port = undefined;
    current?.disconnect();
    host?.remove();
    host = undefined;
    frame = undefined;
    pendingTool = null;
    if (restoreFocus && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    previousFocus = null;
  }

  function clearNotice() { clearTimeout(noticeTimer); document.querySelectorAll('[data-swiss-floating-notice]').forEach(node => node.remove()); }
  function failed() {
    close(false);
    const { element, root } = createHost();
    element.dataset.swissFloatingNotice = '';
    element.style.setProperty('top', '16px', 'important');
    element.style.setProperty('right', '16px', 'important');
    const text = document.createElement('p');
    text.setAttribute('role', 'status');
    text.textContent = 'Questa pagina non permette la finestra mobile. Clicca di nuovo l’icona di Swiss Knife per usare il pannello laterale.';
    root.append(text);
    noticeTimer = setTimeout(() => element.remove(), 8000);
    void browser.runtime.sendMessage({ type: FLOATING_FAILED }).catch(() => undefined);
  }

  function connect(connection: Browser.runtime.Port) {
    if (connection.name !== FLOATING_PORT || connection.sender?.id !== browser.runtime.id || !host || port) return;
    port = connection;
    clearTimeout(startTimer);
    connection.onDisconnect.addListener(() => { if (port === connection) close(false); });
    connection.onMessage.addListener(message => {
      if (port !== connection || !host) return;
      if (message?.type === 'drag' && Number.isFinite(message.dx) && Number.isFinite(message.dy)) {
        place({ left: position.left + message.dx, top: position.top + message.dy });
      } else if (message?.type === 'drag-end') {
        void browser.storage.local.set({ [FLOATING_POSITION_KEY]: position }).catch(() => undefined);
      } else if (message?.type === 'close') {
        close(true);
      } else if (message?.type === 'hide') {
        host.style.setProperty('opacity', '0', 'important');
        // Two frames so the compositor has painted the page without the window.
        requestAnimationFrame(() => requestAnimationFrame(() => connection.postMessage({ type: 'hidden' })));
      } else if (message?.type === 'show') {
        host.style.removeProperty('opacity');
      } else if (message?.type === 'conceal') {
        // Out of the way of page selections; the page takes focus so its keyboard shortcuts work.
        host.style.setProperty('visibility', 'hidden', 'important');
        frame?.blur();
        window.focus();
      } else if (message?.type === 'reveal') {
        host.style.removeProperty('visibility');
        frame?.focus();
      }
    });
    if (pendingTool) connection.postMessage({ type: 'init', tool: pendingTool });
    frame?.focus();
  }

  browser.runtime.onConnect.addListener(connect);
  addEventListener('pagehide', () => close(false));
  scope.__swissFloating = {
    toggle: tool => { if (host) close(true); else void open(tool); },
    open: tool => void open(tool),
  };
});
