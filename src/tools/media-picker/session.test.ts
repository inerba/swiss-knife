import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startSession } from './session';
const mocks = vi.hoisted(() => ({ executeScript: vi.fn(), connect: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { scripting: { executeScript: mocks.executeScript }, tabs: { connect: mocks.connect } } }));
let message: (message: unknown) => void;
let disconnected: () => void;
let port: { postMessage: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onMessage: { addListener(fn: typeof message): void }; onDisconnect: { addListener(fn: typeof disconnected): void } };
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  port = { postMessage: vi.fn(), disconnect: vi.fn(), onMessage: { addListener(fn) { message = fn; } }, onDisconnect: { addListener(fn) { disconnected = fn; } } };
  mocks.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]); mocks.connect.mockReturnValue(port);
});
afterEach(() => vi.useRealTimers());
it('binds to the injected document and ignores messages from a different selection', async () => {
  const selected = vi.fn(); const controller = new AbortController();
  const session = await startSession(7, controller.signal, selected, vi.fn());
  expect(mocks.connect).toHaveBeenCalledWith(7, { documentId: 'doc-1', name: expect.stringContaining('swiss-media-picker:') });
  message({ type: 'selection', session: 'wrong', result: { images: [] } }); expect(selected).not.toHaveBeenCalled();
  const id = mocks.connect.mock.calls[0]![1].name.split(':')[1];
  message({ type: 'selection', session: id, result: { images: [] } }); expect(selected).toHaveBeenCalledTimes(1);
  session.close();
});
it('disconnects and rejects pending blob reads when the panel session ends', async () => {
  const controller = new AbortController();
  const session = await startSession(7, controller.signal, vi.fn(), vi.fn());
  const pending = session.readBlob('1'); const rejected = expect(pending).rejects.toThrow('Selezione terminata');
  controller.abort(); await rejected; expect(port.disconnect).toHaveBeenCalledTimes(1);
});
it('does not connect to a document after cancellation during injection', async () => {
  let done!: (value: unknown) => void;
  mocks.executeScript.mockImplementation(() => new Promise(resolve => { done = resolve; }));
  const controller = new AbortController();
  const pending = startSession(7, controller.signal, vi.fn(), vi.fn());
  const rejected = expect(pending).rejects.toThrow(); controller.abort(); done([{ documentId: 'old' }]);
  await rejected; expect(mocks.connect).not.toHaveBeenCalled();
});
it('reports disconnection so the UI can invalidate its results', async () => {
  const status = vi.fn(); await startSession(7, new AbortController().signal, vi.fn(), status);
  disconnected(); expect(status).toHaveBeenCalledWith(expect.stringContaining('Connessione alla pagina terminata'));
});
