import { beforeEach, expect, it, vi } from 'vitest';
import type { Browser } from 'wxt/browser';

const api = vi.hoisted(() => ({
  runtime: { id: 'ext-id', onConnect: { addListener: vi.fn(), removeListener: vi.fn() } },
}));
vi.mock('wxt/browser', () => ({ browser: api }));

const picker = vi.hoisted(() => ({ install: vi.fn() }));
vi.mock('./picker', () => ({ installInspectPicker: picker.install }));
vi.mock('./isolate-capture', () => ({
  applyCaptureIsolation: vi.fn(() => vi.fn()),
  waitForPaintFrames: vi.fn(async () => undefined),
}));

import { parsePickerSession, runPickerHost } from './picker-host';

let scopeCounter = 0;

function fakePort(name: string, senderId = 'ext-id') {
  const messageListeners: Array<(message: Record<string, unknown>) => void> = [];
  return {
    name,
    sender: { id: senderId },
    postMessage: vi.fn(),
    onMessage: { addListener: (fn: (message: Record<string, unknown>) => void) => messageListeners.push(fn) },
    onDisconnect: { addListener: vi.fn() },
    emit(message: Record<string, unknown>) { messageListeners.forEach(fn => fn(message)); },
  };
}

function install(buildPayload: (element: Element, view: Window) => unknown) {
  const scopeKey = `__swissTestHost${scopeCounter++}`;
  runPickerHost({ portPrefix: 'swiss-test', scopeKey, buildPayload });
  const connect = api.runtime.onConnect.addListener.mock.calls.at(-1)![0] as (port: Browser.runtime.Port) => void;
  return { scopeKey, connect };
}

beforeEach(() => {
  vi.clearAllMocks();
  picker.install.mockImplementation(() => ({ dispose: vi.fn(), handleCommand: vi.fn() }));
});

it('parses only sessions with the expected prefix', () => {
  expect(parsePickerSession('swiss-test:abc', 'swiss-test')).toBe('abc');
  expect(parsePickerSession('swiss-test:', 'swiss-test')).toBeNull();
  expect(parsePickerSession('swiss-other:abc', 'swiss-test')).toBeNull();
});

it('sends the payload built by the custom builder', () => {
  const buildPayload = vi.fn((_element: Element, _view: Window) => ({ custom: true }));
  const { connect } = install(buildPayload);
  const port = fakePort('swiss-test:s1');
  connect(port as unknown as Browser.runtime.Port);
  expect(port.postMessage).toHaveBeenCalledWith({ type: 'ready', session: 's1' });

  const [build, onPick] = picker.install.mock.calls[0]!;
  const element = document.createElement('div');
  onPick(build(element, window), element);

  expect(buildPayload.mock.calls[0]![0]).toBe(element);
  expect(buildPayload.mock.calls[0]![1]).toBe(window);
  expect(port.postMessage).toHaveBeenCalledWith({ type: 'snapshot', payload: { custom: true }, session: 's1' });
});

it('reports a builder exception as an error message', () => {
  const { connect } = install(() => { throw new Error('boom'); });
  const port = fakePort('swiss-test:s2');
  connect(port as unknown as Browser.runtime.Port);
  const [build, onPick] = picker.install.mock.calls[0]!;
  const element = document.createElement('div');
  onPick(build(element, window), element);
  expect(port.postMessage).toHaveBeenCalledWith({ type: 'error', error: "Impossibile leggere l'elemento: boom", session: 's2' });
});

it('ignores connections from other senders or prefixes', () => {
  const { connect } = install(() => ({}));
  connect(fakePort('swiss-test:s3', 'someone-else') as unknown as Browser.runtime.Port);
  connect(fakePort('swiss-other:s3') as unknown as Browser.runtime.Port);
  expect(picker.install).not.toHaveBeenCalled();
});

it('installs only once per scope key until disposed', () => {
  const { scopeKey } = install(() => ({}));
  runPickerHost({ portPrefix: 'swiss-test', scopeKey, buildPayload: () => ({}) });
  expect(api.runtime.onConnect.addListener).toHaveBeenCalledTimes(1);

  const scope = globalThis as unknown as Record<string, unknown>;
  (scope[`${scopeKey}Dispose`] as () => void)();
  expect(api.runtime.onConnect.removeListener).toHaveBeenCalledTimes(1);
  expect(scope[`${scopeKey}Installed`]).toBeUndefined();
});

it('forwards valid commands to the picker', () => {
  const control = { dispose: vi.fn(), handleCommand: vi.fn() };
  picker.install.mockReturnValue(control);
  const { connect } = install(() => ({}));
  const port = fakePort('swiss-test:s4');
  connect(port as unknown as Browser.runtime.Port);
  port.emit({ type: 'command', session: 's4', command: 'navigate-up' });
  port.emit({ type: 'command', session: 's4', command: 'explode' });
  port.emit({ type: 'command', session: 'other', command: 'confirm' });
  expect(control.handleCommand).toHaveBeenCalledTimes(1);
  expect(control.handleCommand).toHaveBeenCalledWith('navigate-up');
});
