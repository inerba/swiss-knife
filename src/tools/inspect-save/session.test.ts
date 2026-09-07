import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { captureElementPng } from './capture';
import { startInspectSession } from './session';

const api = vi.hoisted(() => ({
  tabs: { connect: vi.fn() },
  scripting: { executeScript: vi.fn() },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('./capture', () => ({
  captureElementPng: vi.fn(async () => ({ png: 'data:image/png;base64,abc', clipped: false })),
}));

let message: ((value: Record<string, unknown>) => void) | undefined;
let sessionId = '';
let portPostMessage: ReturnType<typeof vi.fn> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  sessionId = '';
  message = undefined;
  api.scripting.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  api.tabs.connect.mockImplementation((_tabId, options: { name: string }) => {
    sessionId = options.name.split(':')[1]!;
    portPostMessage = vi.fn();
    return {
      disconnect: vi.fn(),
      postMessage: portPostMessage,
      onMessage: { addListener(fn: (value: Record<string, unknown>) => void) { message = fn; } },
      onDisconnect: { addListener: vi.fn() },
    };
  });
});

afterEach(() => {
  message = undefined;
});

it('does not capture when the picker locks an element', async () => {
  const onResult = vi.fn();
  const onLocked = vi.fn();
  await startInspectSession(1, 10, new AbortController().signal, vi.fn(), onResult, vi.fn(), onLocked);

  message?.({ type: 'ready', session: sessionId });
  message?.({
    type: 'locked',
    session: sessionId,
    preview: { tag: 'div', tagLabel: 'Div', selector: 'div.card', dimensions: '320 × 230' },
  });

  expect(onLocked).toHaveBeenCalledWith(expect.objectContaining({ selector: 'div.card' }));
  expect(onResult).not.toHaveBeenCalled();
  expect(captureElementPng).not.toHaveBeenCalled();
  expect(portPostMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'isolate-capture' }));
});

it('captures only after a confirmed snapshot', async () => {
  const onResult = vi.fn();
  const onLocked = vi.fn();
  await startInspectSession(1, 10, new AbortController().signal, vi.fn(), onResult, vi.fn(), onLocked);

  message?.({ type: 'ready', session: sessionId });
  message?.({
    type: 'locked',
    session: sessionId,
    preview: { tag: 'div', tagLabel: 'Div', selector: 'div.card', dimensions: '320 × 230' },
  });
  message?.({
    type: 'snapshot',
    session: sessionId,
    payload: {
      tag: 'div',
      tagLabel: 'Div',
      selector: 'div.card',
      classes: '.card',
      dimensions: '320 × 230',
      rect: { left: 0, top: 0, width: 320, height: 230, viewportWidth: 1280, viewportHeight: 800, scrollX: 0, scrollY: 0 },
      clipped: false,
      sections: [],
      markup: '<div></div>',
    },
  });
  message?.({ type: 'isolated', session: sessionId });
  await Promise.resolve();
  await Promise.resolve();

  expect(onLocked).toHaveBeenCalledTimes(1);
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(captureElementPng).toHaveBeenCalledTimes(1);
});
