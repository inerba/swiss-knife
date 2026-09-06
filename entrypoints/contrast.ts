import { browser, type Browser } from 'wxt/browser';
import { installContrastPicker } from '../src/tools/contrast/picker';
import { readElementStyles, sampleFromStyles } from '../src/tools/contrast/sample';

function parseSession(connection: Browser.runtime.Port) {
  const match = connection.name.match(/^swiss-contrast:(.+)$/);
  return match ? match[1] : null;
}

export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & { __swissContrastCleanup?: () => void };
  scope.__swissContrastCleanup?.();
  let dispose: (() => void) | undefined;
  const abort = new AbortController();
  const timeout = setTimeout(cleanup, 10000);
  function cleanup() {
    clearTimeout(timeout);
    abort.abort();
    dispose?.();
    browser.runtime.onConnect.removeListener(connect);
    window.removeEventListener('pagehide', cleanup);
    if (scope.__swissContrastCleanup === cleanup) delete scope.__swissContrastCleanup;
  }
  function connect(connection: Browser.runtime.Port) {
    const session = parseSession(connection);
    if (!session || connection.sender?.id !== browser.runtime.id) return;
    clearTimeout(timeout);
    browser.runtime.onConnect.removeListener(connect);
    const send = (message: Record<string, unknown>) => {
      if (!abort.signal.aborted) connection.postMessage({ ...message, session });
    };
    connection.onDisconnect.addListener(cleanup);
    dispose = installContrastPicker(element => {
      try { send({ type: 'result', result: sampleFromStyles(readElementStyles(element)) }); }
      catch (error) { send({ type: 'error', error: error instanceof Error ? error.message : String(error) }); }
    }, () => send({ type: 'cancelled' }));
    send({ type: 'ready' });
  }
  browser.runtime.onConnect.addListener(connect);
  window.addEventListener('pagehide', cleanup);
  scope.__swissContrastCleanup = cleanup;
});
