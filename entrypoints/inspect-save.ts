import { browser, type Browser } from 'wxt/browser';
import { installInspectPicker } from '../src/tools/inspect-save/picker';

function parseSession(connection: Browser.runtime.Port) {
  const match = connection.name.match(/^swiss-inspect-save:(.+)$/);
  return match ? match[1] : null;
}

export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & { __swissInspectCleanup?: () => void };
  scope.__swissInspectCleanup?.();
  let dispose: (() => void) | undefined;
  const abort = new AbortController();
  const timeout = setTimeout(cleanup, 10000);
  function cleanup() {
    clearTimeout(timeout);
    abort.abort();
    dispose?.();
    browser.runtime.onConnect.removeListener(connect);
    window.removeEventListener('pagehide', cleanup);
    if (scope.__swissInspectCleanup === cleanup) delete scope.__swissInspectCleanup;
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
    dispose = installInspectPicker(
      payload => send({ type: 'snapshot', payload }),
      () => send({ type: 'cancelled' }),
    );
    send({ type: 'ready' });
  }
  browser.runtime.onConnect.addListener(connect);
  window.addEventListener('pagehide', cleanup);
  scope.__swissInspectCleanup = cleanup;
});
