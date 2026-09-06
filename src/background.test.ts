import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('registers a real action handler and opens the panel within the click gesture', async () => {
  const addListener = vi.fn();
  const open = vi.fn().mockResolvedValue(undefined);
  // A pending configuration promise must not delay opening from the gesture.
  const setPanelBehavior = vi.fn().mockReturnValue(new Promise(() => {}));
  vi.stubGlobal('browser', { action: { onClicked: { addListener } }, sidePanel: { open, setPanelBehavior } });
  vi.stubGlobal('defineBackground', (main: () => void) => main());
  await import('../entrypoints/background');
  expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
  const clicked = addListener.mock.calls[0]![0];
  clicked({ id: 7, windowId: 3 });
  expect(open).toHaveBeenCalledWith({ windowId: 3 });
  clicked({ windowId: 3 });
  expect(open).toHaveBeenCalledTimes(1);
});
