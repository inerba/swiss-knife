import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startContrastSession } from './session';

const mocks = vi.hoisted(() => ({ executeScript: vi.fn(), connect: vi.fn() }));
vi.mock('wxt/browser', () => ({
  browser: { scripting: { executeScript: mocks.executeScript }, tabs: { connect: mocks.connect } },
}));

let message: (value: unknown) => void;
let disconnected: () => void;
let port: {
  disconnect: ReturnType<typeof vi.fn>;
  onMessage: { addListener(fn: typeof message): void };
  onDisconnect: { addListener(fn: typeof disconnected): void };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  port = {
    disconnect: vi.fn(),
    onMessage: { addListener(fn) { message = fn; } },
    onDisconnect: { addListener(fn) { disconnected = fn; } },
  };
  mocks.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  mocks.connect.mockReturnValue(port);
});
afterEach(() => vi.useRealTimers());

it('binds to the injected document and ignores a foreign session', async () => {
  const selected = vi.fn();
  const session = await startContrastSession(7, new AbortController().signal, vi.fn(), selected);
  expect(mocks.executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: ['/contrast.js'] });
  expect(mocks.connect).toHaveBeenCalledWith(7, { documentId: 'doc-1', name: expect.stringMatching(/^swiss-contrast:/) });
  const id = mocks.connect.mock.calls[0]![1].name.split(':')[1];
  message({ type: 'result', session: 'other', result: { foreground: '#fff', background: '#000' } });
  expect(selected).not.toHaveBeenCalled();
  message({
    type: 'result',
    session: id,
    result: {
      foreground: '#FFFFFF',
      background: '#7241FF',
      fontFamily: 'Arial',
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: '400',
      warnings: [],
    },
  });
  expect(selected).toHaveBeenCalledTimes(1);
  session.close();
});

it('does not connect after cancellation during injection', async () => {
  let done!: (value: unknown) => void;
  mocks.executeScript.mockImplementation(() => new Promise(resolve => { done = resolve; }));
  const controller = new AbortController();
  const pending = startContrastSession(7, controller.signal, vi.fn(), vi.fn());
  const rejected = expect(pending).rejects.toThrow();
  controller.abort();
  done([{ documentId: 'old' }]);
  await rejected;
  expect(mocks.connect).not.toHaveBeenCalled();
});

it('reports disconnection so the panel can clear page state', async () => {
  const status = vi.fn();
  const ended = vi.fn();
  await startContrastSession(7, new AbortController().signal, status, vi.fn(), ended);
  disconnected();
  expect(status).toHaveBeenCalledWith(expect.stringContaining('Connessione alla pagina terminata'));
  expect(ended).toHaveBeenCalledWith('disconnected');
});
