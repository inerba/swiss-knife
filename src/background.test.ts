import { beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn() });
  return {
    action: { onClicked: event() },
    runtime: { id: 'swiss', onMessage: event(), onInstalled: event(), onStartup: event() },
    storage: { onChanged: event(), local: { get: vi.fn() }, session: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
    sidePanel: { open: vi.fn(), setOptions: vi.fn(), setPanelBehavior: vi.fn() },
    scripting: { executeScript: vi.fn() },
  };
});
vi.mock('wxt/browser', () => ({ browser: api }));

let click: (tab: { id?: number; windowId: number; url?: string }) => void;
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const page = { id: 7, windowId: 3, url: 'https://page.test/' };
function mode(value: string | Promise<never>) {
  api.storage.local.get.mockImplementation(() => value instanceof Promise ? value : Promise.resolve({ openMode: value }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  api.sidePanel.open.mockResolvedValue(undefined);
  api.sidePanel.setOptions.mockResolvedValue(undefined);
  // A pending configuration promise must not delay opening from the gesture.
  api.sidePanel.setPanelBehavior.mockReturnValue(new Promise(() => {}));
  api.storage.session.get.mockResolvedValue({});
  api.scripting.executeScript.mockResolvedValue([{}]);
  vi.stubGlobal('defineBackground', (main: () => void) => main());
  await import('../entrypoints/background');
  click = api.action.onClicked.addListener.mock.calls[0]![0];
});

it('opens the panel within the click gesture, before the preference is read', async () => {
  mode(new Promise<never>(() => {}));
  expect(api.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
  click(page);
  expect(api.sidePanel.open).toHaveBeenCalledWith({ windowId: 3 });
  click({ windowId: 3 });
  expect(api.sidePanel.open).toHaveBeenCalledTimes(1);
});

it('keeps the side panel only in side panel mode', async () => {
  mode('sidepanel');
  click(page);
  await flush();
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
  expect(api.sidePanel.setOptions).not.toHaveBeenCalled();
});

it('disables the panel and toggles the floating window in floating mode', async () => {
  mode('floating');
  api.sidePanel.open.mockRejectedValue(new Error('No active side panel'));
  click(page);
  await vi.waitFor(() => expect(api.scripting.executeScript).toHaveBeenCalledTimes(2));
  expect(api.sidePanel.setOptions).toHaveBeenCalledWith({ enabled: false });
  expect(api.scripting.executeScript.mock.calls[0]![0]).toEqual({ target: { tabId: 7 }, files: ['/floating-window.js'] });
  expect(api.scripting.executeScript.mock.calls[1]![0].args).toEqual(['toggle', null]);
});

it('opens the panel synchronously on protected pages, whatever the mode', async () => {
  mode('floating');
  click({ id: 7, windowId: 3, url: 'chrome://settings/' });
  expect(api.sidePanel.setOptions).toHaveBeenCalledWith({ enabled: true });
  expect(api.sidePanel.setOptions.mock.invocationCallOrder[0]).toBeLessThan(api.sidePanel.open.mock.invocationCallOrder[0]!);
  await flush();
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
});

it('keeps the panel once for a tab whose floating window could not start', async () => {
  mode('floating');
  const listener = api.runtime.onMessage.addListener.mock.calls[0]![0];
  listener({ type: 'swiss-floating-failed' }, { id: 'swiss', tab: { id: 7 } });
  await flush();
  expect(api.storage.session.set).toHaveBeenCalledWith({ floatingFallbackTab: 7 });
  expect(api.sidePanel.setOptions).toHaveBeenCalledWith({ enabled: true });
  api.storage.session.get.mockResolvedValue({ floatingFallbackTab: 7 });
  click(page);
  await vi.waitFor(() => expect(api.storage.session.remove).toHaveBeenCalledWith('floatingFallbackTab'));
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
  expect(api.sidePanel.setOptions).not.toHaveBeenCalledWith({ enabled: false });
});

it('falls back to the panel when the page refuses the injection', async () => {
  mode('floating');
  api.scripting.executeScript.mockRejectedValue(new Error('Cannot access contents of the page'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  click(page);
  await vi.waitFor(() => expect(api.storage.session.set).toHaveBeenCalledWith({ floatingFallbackTab: 7 }));
});

it('re-enables the panel as soon as side panel mode is chosen, but never closes open panels on change', async () => {
  const changed = api.storage.onChanged.addListener.mock.calls[0]![0];
  mode('sidepanel');
  changed({ openMode: { newValue: 'sidepanel' } }, 'local');
  await vi.waitFor(() => expect(api.sidePanel.setOptions).toHaveBeenCalledWith({ enabled: true }));
  api.sidePanel.setOptions.mockClear();
  mode('floating');
  changed({ openMode: { newValue: 'floating' } }, 'local');
  await flush();
  expect(api.sidePanel.setOptions).not.toHaveBeenCalled();
  api.runtime.onStartup.addListener.mock.calls[0]![0]();
  await vi.waitFor(() => expect(api.sidePanel.setOptions).toHaveBeenCalledWith({ enabled: false }));
});
