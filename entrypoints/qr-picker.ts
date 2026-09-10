import { browser, type Browser } from 'wxt/browser';
import { installQrPicker } from '../src/tools/qr-code/picker';

export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & { __swissQrPickerCleanup?: () => void };
  scope.__swissQrPickerCleanup?.();
  let dispose: (() => void) | undefined; const timeout = setTimeout(cleanup, 10_000);
  function cleanup() { clearTimeout(timeout); dispose?.(); browser.runtime.onConnect.removeListener(connect); window.removeEventListener('pagehide', cleanup); if (scope.__swissQrPickerCleanup === cleanup) delete scope.__swissQrPickerCleanup; }
  function connect(port: Browser.runtime.Port) {
    const match = port.name.match(/^swiss-qr-picker:(.+)$/); if (!match || port.sender?.id !== browser.runtime.id) return;
    clearTimeout(timeout); browser.runtime.onConnect.removeListener(connect); const session = match[1]!;
    const send = (message: Record<string, unknown>) => port.postMessage({ ...message, session });
    port.onDisconnect.addListener(cleanup);
    dispose = installQrPicker(rect => { send({ type: 'result', rect }); cleanup(); }, () => { send({ type: 'cancelled' }); cleanup(); });
    send({ type: 'ready' });
  }
  browser.runtime.onConnect.addListener(connect); window.addEventListener('pagehide', cleanup); scope.__swissQrPickerCleanup = cleanup;
});
