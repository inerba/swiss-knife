import { browser, type Browser } from 'wxt/browser';
import { collectColors, installColorPicker } from '../src/tools/colors/picker';
export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & { __swissColorPickerCleanup?: () => void };
  scope.__swissColorPickerCleanup?.();
  let dispose: (() => void) | undefined; let port: Browser.runtime.Port | undefined; const abort = new AbortController();
  const timeout = setTimeout(cleanup, 10000);
  function cleanup() {
    clearTimeout(timeout); abort.abort(); dispose?.();
    browser.runtime.onConnect.removeListener(connect); window.removeEventListener('pagehide', cleanup);
    if (scope.__swissColorPickerCleanup === cleanup) delete scope.__swissColorPickerCleanup;
  }
  function connect(connection: Browser.runtime.Port) {
    if (!connection.name.startsWith('swiss-color-picker:') || connection.sender?.id !== browser.runtime.id) return;
    clearTimeout(timeout); browser.runtime.onConnect.removeListener(connect);
    port = connection; const session = connection.name.slice('swiss-color-picker:'.length);
    const send = (message: Record<string, unknown>) => { if (!abort.signal.aborted) connection.postMessage({ ...message, session }); };
    connection.onDisconnect.addListener(cleanup);
    dispose = installColorPicker(element => {
      send({ type: 'analysing' });
      void (async () => {
        try { send({ type: 'result', result: await collectColors(element, abort.signal) }); }
        catch (error) { send({ type: 'error', error: String(error) }); }
      })();
    }, () => send({ type: 'cancelled' })); send({ type: 'ready' });
  }
  browser.runtime.onConnect.addListener(connect); window.addEventListener('pagehide', cleanup);
  scope.__swissColorPickerCleanup = cleanup;
});
