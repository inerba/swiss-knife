import { browser, type Browser } from 'wxt/browser';
import { collectColors, installColorPicker } from '../src/tools/colors/picker';
export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & { __swissColorPickerCleanup?: () => void };
  scope.__swissColorPickerCleanup?.();
  let dispose: (() => void) | undefined; let port: Browser.runtime.Port | undefined; const abort = new AbortController();
  function cleanup() { abort.abort(); dispose?.(); if (scope.__swissColorPickerCleanup === cleanup) delete scope.__swissColorPickerCleanup; }
  browser.runtime.onConnect.addListener(connection => {
    if (!connection.name.startsWith('swiss-color-picker:') || connection.sender?.id !== browser.runtime.id) return;
    port = connection; const session = connection.name.slice('swiss-color-picker:'.length); const send = (message: Record<string, unknown>) => connection.postMessage({ ...message, session });
    connection.onDisconnect.addListener(cleanup);
    dispose = installColorPicker(element => { send({ type: 'analysing' }); void collectColors(element, abort.signal).then(result => send({ type: 'result', result })).catch(error => send({ type: 'error', error: String(error) })); }, () => send({ type: 'cancelled' })); send({ type: 'ready' });
  });
  scope.__swissColorPickerCleanup = cleanup;
});
