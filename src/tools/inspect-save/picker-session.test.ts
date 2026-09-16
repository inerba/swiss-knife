import { beforeEach, expect, it, vi } from 'vitest';
import { captureElementPng } from './capture';
import { startPickerSession } from './picker-session';

const api = vi.hoisted(() => ({
  tabs: { connect: vi.fn() },
  scripting: { executeScript: vi.fn() },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('./capture', () => ({ captureElementPng: vi.fn() }));

type Emit = (value: Record<string, unknown>) => void;
let emit: Emit = () => {};
let session = '';
let posted: Array<Record<string, unknown>> = [];

const rect = { left: 0, top: 0, width: 10, height: 10, viewportWidth: 100, viewportHeight: 100, scrollX: 0, scrollY: 0 };
const payload = { rect, label: 'x' };
const isPayload = (value: unknown): value is typeof payload =>
  !!value && typeof (value as typeof payload).label === 'string';

beforeEach(() => {
  vi.clearAllMocks();
  posted = [];
  api.scripting.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  api.tabs.connect.mockImplementation((_tabId: number, options: { name: string }) => {
    session = options.name.split(':')[1]!;
    return {
      disconnect: vi.fn(),
      postMessage: (value: Record<string, unknown>) => {
        posted.push(value);
        if (value.type === 'isolate-capture') queueMicrotask(() => emit({ type: 'isolated', session }));
      },
      onMessage: { addListener(fn: Emit) { emit = fn; } },
      onDisconnect: { addListener: vi.fn() },
    };
  });
});

async function start(screenshot: 'required' | 'optional') {
  const handlers = { onStatus: vi.fn(), onResult: vi.fn(), onEnd: vi.fn(), onLocked: vi.fn() };
  await startPickerSession({
    tabId: 1,
    windowId: 10,
    file: '/tool.js',
    portPrefix: 'swiss-tool',
    toolName: 'Strumento',
    screenshot,
    isPayload,
    signal: new AbortController().signal,
    ...handlers,
  });
  return handlers;
}

it('injects the given file and connects with the given prefix', async () => {
  await start('required');
  expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 1 }, files: ['/tool.js'] });
  expect(api.tabs.connect).toHaveBeenCalledWith(1, expect.objectContaining({
    documentId: 'doc-1',
    name: expect.stringMatching(/^swiss-tool:/),
  }));
});

it('passes the capture to the result handler', async () => {
  vi.mocked(captureElementPng).mockResolvedValueOnce({ png: 'data:image/png;base64,abc', clipped: false });
  const handlers = await start('required');
  emit({ type: 'snapshot', session, payload });
  await vi.waitFor(() => expect(handlers.onResult).toHaveBeenCalledWith(
    payload,
    { png: 'data:image/png;base64,abc', clipped: false },
    undefined,
  ));
  expect(posted).toContainEqual({ type: 'restore-capture', session });
});

it('delivers the payload without png when an optional screenshot fails', async () => {
  vi.mocked(captureElementPng).mockRejectedValueOnce(new Error('boom'));
  const handlers = await start('optional');
  emit({ type: 'snapshot', session, payload });
  await vi.waitFor(() => expect(handlers.onResult).toHaveBeenCalledWith(payload, null, 'boom'));
  expect(handlers.onEnd).not.toHaveBeenCalled();
  expect(posted).toContainEqual({ type: 'restore-capture', session });
});

it('ends with an error when a required screenshot fails', async () => {
  vi.mocked(captureElementPng).mockRejectedValueOnce(new Error('boom'));
  const handlers = await start('required');
  emit({ type: 'snapshot', session, payload });
  await vi.waitFor(() => expect(handlers.onEnd).toHaveBeenCalledWith('error'));
  expect(handlers.onStatus).toHaveBeenCalledWith('boom');
  expect(handlers.onResult).not.toHaveBeenCalled();
});

it('ignores payloads rejected by the validator', async () => {
  const handlers = await start('optional');
  emit({ type: 'snapshot', session, payload: { rect } });
  await Promise.resolve();
  expect(captureElementPng).not.toHaveBeenCalled();
  expect(handlers.onResult).not.toHaveBeenCalled();
});

it('ends when the page reports an error', async () => {
  const handlers = await start('optional');
  emit({ type: 'error', session, error: "Impossibile leggere l'elemento: boom" });
  expect(handlers.onStatus).toHaveBeenCalledWith("Impossibile leggere l'elemento: boom");
  expect(handlers.onEnd).toHaveBeenCalledWith('error');
});
