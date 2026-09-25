import { browser, type Browser } from 'wxt/browser';

export type OpenMode = 'sidepanel' | 'floating';
export const OPEN_MODE_KEY = 'openMode';
export const FLOATING_POSITION_KEY = 'floatingPosition';
export const FLOATING_PORT = 'swiss-floating';
export const FLOATING_FAILED = 'swiss-floating-failed';
export const FLOATING_SCRIPT = '/floating-window.js';
const FLOATING_PAGE = '/floating.html';

export function isOpenMode(value: unknown): value is OpenMode { return value === 'sidepanel' || value === 'floating'; }
export async function loadOpenMode(): Promise<OpenMode> {
  const stored = await browser.storage.local.get(OPEN_MODE_KEY);
  return isOpenMode(stored[OPEN_MODE_KEY]) ? stored[OPEN_MODE_KEY] : 'floating';
}
export async function saveOpenMode(mode: OpenMode) { await browser.storage.local.set({ [OPEN_MODE_KEY]: mode }); }

export interface Point { left: number; top: number; }
export interface Size { width: number; height: number; }
export function floatingSize(viewport: Size): Size {
  return { width: Math.min(380, Math.max(0, viewport.width - 16)), height: Math.min(640, Math.max(0, viewport.height - 32)) };
}
/** Keeps the whole window inside the viewport; top-right corner when no position is known. */
export function clampPosition(position: Point | null, size: Size, viewport: Size): Point {
  const maxLeft = Math.max(0, viewport.width - size.width);
  const maxTop = Math.max(0, viewport.height - size.height);
  const { left, top } = position ?? { left: viewport.width - size.width - 16, top: 16 };
  return { left: Math.min(Math.max(0, left), maxLeft), top: Math.min(Math.max(0, top), maxTop) };
}
export function isPoint(value: unknown): value is Point {
  const point = value as Partial<Point> | null;
  return !!point && Number.isFinite(point.left) && Number.isFinite(point.top);
}

/** Injects the in-page host (idempotent), then toggles or opens the floating window. */
export async function showFloatingWindow(tabId: number, action: 'toggle' | 'open', tool: string | null = null) {
  await browser.scripting.executeScript({ target: { tabId }, files: [FLOATING_SCRIPT as never] });
  await browser.scripting.executeScript({
    target: { tabId },
    func: (action: 'toggle' | 'open', tool: string | null) => {
      (globalThis as unknown as { __swissFloating?: Record<string, (tool: string | null) => void> }).__swissFloating?.[action]?.(tool);
    },
    args: [action, tool],
  });
}

// Inside the floating window page: the channel to the host script in the same tab.
export function isFloatingWindow() { return location.pathname === FLOATING_PAGE; }
let port: Browser.runtime.Port | undefined;
let hiddenWait: (() => void) | undefined;
export async function connectFloatingWindow(onTool: (tool: string) => void) {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id == null) throw new Error('Scheda della finestra non disponibile.');
  port = browser.tabs.connect(tab.id, { frameId: 0, name: FLOATING_PORT });
  port.onMessage.addListener(message => {
    if (message?.type === 'init' && typeof message.tool === 'string') onTool(message.tool);
    else if (message?.type === 'hidden') hiddenWait?.();
  });
  port.onDisconnect.addListener(() => { port = undefined; });
}
let concealed = 0;
/** Hides the floating window while the user selects something on the page; returns an idempotent release. */
export function concealFloatingWindow() {
  if (!port) return () => {};
  if (concealed++ === 0) port.postMessage({ type: 'conceal' });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--concealed === 0) port?.postMessage({ type: 'reveal' });
  };
}
export function postToFloatingHost(message: Record<string, unknown>) { port?.postMessage(message); }
/** Runs `capture` while the floating window is invisible, so it never appears in its own screenshots. */
export async function whileFloatingHidden<T>(capture: () => Promise<T>): Promise<T> {
  const current = port;
  if (!current) return capture();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { hiddenWait = undefined; reject(new Error('Impossibile nascondere la finestra per la cattura. Riprova.')); }, 2000);
    hiddenWait = () => { clearTimeout(timer); hiddenWait = undefined; resolve(); };
    current.postMessage({ type: 'hide' });
  });
  try { return await capture(); } finally { port?.postMessage({ type: 'show' }); }
}
