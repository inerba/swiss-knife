import { afterEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  tabs: { getCurrent: vi.fn(), query: vi.fn(), connect: vi.fn(), captureVisibleTab: vi.fn() },
  storage: { local: { get: vi.fn() } },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
import { clampPosition, concealFloatingWindow, loadOpenMode, connectFloatingWindow, floatingSize } from './floating-window';
import { activeTab, captureVisibleTab } from './browser';

afterEach(() => { history.replaceState(null, '', '/'); vi.clearAllMocks(); });

it('sizes the window to the viewport and keeps it fully visible', () => {
  expect(floatingSize({ width: 1280, height: 900 })).toEqual({ width: 380, height: 640 });
  expect(floatingSize({ width: 300, height: 400 })).toEqual({ width: 284, height: 368 });
  const size = { width: 380, height: 640 };
  expect(clampPosition(null, size, { width: 1280, height: 900 })).toEqual({ left: 884, top: 16 });
  expect(clampPosition({ left: 1200, top: -40 }, size, { width: 1280, height: 900 })).toEqual({ left: 900, top: 0 });
  expect(clampPosition({ left: -5, top: 800 }, size, { width: 1280, height: 900 })).toEqual({ left: 0, top: 260 });
});

it('works on the tab that contains the floating window, not on the active one', async () => {
  history.replaceState(null, '', '/floating.html');
  api.tabs.getCurrent.mockResolvedValue({ id: 4, url: 'https://host.test/', active: true });
  expect((await activeTab()).id).toBe(4);
  expect(api.tabs.query).not.toHaveBeenCalled();
});

it('hides the floating window around a capture and refuses when its tab is in the background', async () => {
  history.replaceState(null, '', '/floating.html');
  const messages: unknown[] = [];
  let onMessage: (message: unknown) => void = () => {};
  api.tabs.getCurrent.mockResolvedValue({ id: 4, active: true });
  api.tabs.connect.mockReturnValue({
    postMessage: (message: { type: string }) => { messages.push(message.type); if (message.type === 'hide') queueMicrotask(() => onMessage({ type: 'hidden' })); },
    onMessage: { addListener: (listener: typeof onMessage) => { onMessage = listener; } },
    onDisconnect: { addListener: vi.fn() },
  });
  api.tabs.captureVisibleTab.mockImplementation(async () => { messages.push('capture'); return 'data:image/png;base64,'; });
  await connectFloatingWindow(() => {});
  await captureVisibleTab(9);
  expect(messages).toEqual(['hide', 'capture', 'show']);
  api.tabs.getCurrent.mockResolvedValue({ id: 4, active: false });
  await expect(captureVisibleTab(9)).rejects.toThrow('non è più in primo piano');
});

it('hides the floating window for page selections until the last one ends', async () => {
  history.replaceState(null, '', '/floating.html');
  const messages: string[] = [];
  api.tabs.getCurrent.mockResolvedValue({ id: 4, active: true });
  api.tabs.connect.mockReturnValue({ postMessage: (message: { type: string }) => messages.push(message.type), onMessage: { addListener: vi.fn() }, onDisconnect: { addListener: vi.fn() } });
  await connectFloatingWindow(() => {});
  const first = concealFloatingWindow();
  const second = concealFloatingWindow();
  first(); first();
  expect(messages).toEqual(['conceal']);
  second();
  expect(messages).toEqual(['conceal', 'reveal']);
});

it('opens in the floating window unless the side panel was chosen', async () => {
  api.storage.local.get.mockResolvedValue({});
  expect(await loadOpenMode()).toBe('floating');
  api.storage.local.get.mockResolvedValue({ openMode: 'sidepanel' });
  expect(await loadOpenMode()).toBe('sidepanel');
});
