import { browser, type Browser } from 'wxt/browser';
import { applyCaptureIsolation, waitForPaintFrames } from './isolate-capture';
import { installInspectPicker, type InspectPickerControl } from './picker';
import type { PickerCommand } from './types';

export interface PickerHostOptions<T> {
  portPrefix: string;
  scopeKey: string;
  buildPayload: (element: Element, view: Window) => T;
}

type BuildOutcome<T> = { ok: true; payload: T } | { ok: false; error: string };

export function parsePickerSession(name: string, portPrefix: string) {
  const prefix = `${portPrefix}:`;
  return name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length) : null;
}

export function isPickerCommand(value: unknown): value is PickerCommand {
  return value === 'navigate-up' || value === 'navigate-down' || value === 'confirm' || value === 'cancel';
}

export function runPickerHost<T>({ portPrefix, scopeKey, buildPayload }: PickerHostOptions<T>) {
  const scope = globalThis as unknown as Record<string, unknown>;
  const installedKey = `${scopeKey}Installed`;
  const disposeKey = `${scopeKey}Dispose`;
  if (scope[installedKey]) return;
  scope[installedKey] = true;

  let pickerControl: InspectPickerControl | undefined;
  let pickedElement: Element | undefined;
  let restoreIsolation: (() => void) | undefined;

  function build(element: Element, view: Window): BuildOutcome<T> {
    try {
      return { ok: true, payload: buildPayload(element, view) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  function connect(connection: Browser.runtime.Port) {
    const session = parsePickerSession(connection.name, portPrefix);
    if (!session || connection.sender?.id !== browser.runtime.id) return;
    restoreIsolation?.();
    restoreIsolation = undefined;
    pickedElement = undefined;
    pickerControl?.dispose();
    const abort = new AbortController();
    const send = (message: Record<string, unknown>) => {
      if (!abort.signal.aborted) connection.postMessage({ ...message, session });
    };
    connection.onDisconnect.addListener(() => {
      abort.abort();
      restoreIsolation?.();
      restoreIsolation = undefined;
      pickedElement = undefined;
      pickerControl?.dispose();
      pickerControl = undefined;
    });
    connection.onMessage.addListener(message => {
      if (abort.signal.aborted || message?.session !== session) return;
      if (message.type === 'command' && isPickerCommand(message.command)) {
        pickerControl?.handleCommand(message.command);
        return;
      }
      if (message.type === 'isolate-capture') {
        restoreIsolation?.();
        restoreIsolation = pickedElement ? applyCaptureIsolation(pickedElement) : undefined;
        void waitForPaintFrames().then(() => send({ type: 'isolated' }));
        return;
      }
      if (message.type === 'restore-capture') {
        restoreIsolation?.();
        restoreIsolation = undefined;
        send({ type: 'restored' });
      }
    });
    pickerControl = installInspectPicker(
      build,
      (outcome, element) => {
        if (outcome.ok) {
          pickedElement = element;
          send({ type: 'snapshot', payload: outcome.payload });
        } else {
          send({ type: 'error', error: `Impossibile leggere l'elemento: ${outcome.error}` });
        }
      },
      () => send({ type: 'cancelled' }),
      preview => send({ type: 'locked', preview }),
    );
    send({ type: 'ready' });
  }

  function teardown() {
    restoreIsolation?.();
    restoreIsolation = undefined;
    pickedElement = undefined;
    pickerControl?.dispose();
    pickerControl = undefined;
    browser.runtime.onConnect.removeListener(connect);
    window.removeEventListener('pagehide', teardown);
    delete scope[installedKey];
    delete scope[disposeKey];
  }

  browser.runtime.onConnect.addListener(connect);
  window.addEventListener('pagehide', teardown);
  scope[disposeKey] = teardown;
}
