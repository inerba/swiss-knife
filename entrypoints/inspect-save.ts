import { browser, type Browser } from 'wxt/browser';
import { applyCaptureIsolation, waitForPaintFrames } from '../src/tools/inspect-save/isolate-capture';
import { installInspectPicker, type InspectPickerControl } from '../src/tools/inspect-save/picker';
import type { PickerCommand } from '../src/tools/inspect-save/types';

function parseSession(connection: Browser.runtime.Port) {
  const match = connection.name.match(/^swiss-inspect-save:(.+)$/);
  return match ? match[1] : null;
}

function isPickerCommand(value: unknown): value is PickerCommand {
  return value === 'navigate-up' || value === 'navigate-down' || value === 'confirm' || value === 'cancel';
}

export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & {
    __swissInspectInstalled?: boolean;
    __swissInspectDispose?: () => void;
  };
  if (scope.__swissInspectInstalled) return;
  scope.__swissInspectInstalled = true;

  let pickerControl: InspectPickerControl | undefined;
  let pickedElement: Element | undefined;
  let restoreIsolation: (() => void) | undefined;

  function connect(connection: Browser.runtime.Port) {
    const session = parseSession(connection);
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
      (payload, element) => {
        pickedElement = element;
        send({ type: 'snapshot', payload });
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
    delete scope.__swissInspectInstalled;
    delete scope.__swissInspectDispose;
  }

  browser.runtime.onConnect.addListener(connect);
  window.addEventListener('pagehide', teardown);
  scope.__swissInspectDispose = teardown;
});
