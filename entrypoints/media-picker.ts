import { browser, type Browser } from 'wxt/browser';
import { installPicker } from '../src/tools/media-picker/picker';
import type { CollectedSelection } from '../src/tools/media-picker/scan';
import { boundedBlob } from '../src/tools/media-picker/file';

export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & { __swissPickerCleanup?: () => void };
  scope.__swissPickerCleanup?.();
  let selection: CollectedSelection | undefined;
  let disposePicker: (() => void) | undefined;
  let connected: Browser.runtime.Port | undefined;
  const abort = new AbortController();
  const timeout = setTimeout(cleanup, 10000);
  function cleanup() {
    clearTimeout(timeout); abort.abort(); disposePicker?.();
    browser.runtime.onConnect.removeListener(connect);
    window.removeEventListener('pagehide', cleanup);
    connected?.disconnect(); selection = undefined;
    if (scope.__swissPickerCleanup === cleanup) delete scope.__swissPickerCleanup;
  }
  function connect(port: Browser.runtime.Port) {
    if (!port.name.startsWith('swiss-media-picker:') || port.sender?.id !== browser.runtime.id) return;
    clearTimeout(timeout);
    browser.runtime.onConnect.removeListener(connect);
    connected = port;
    const session = port.name.slice('swiss-media-picker:'.length);
    const send = (payload: Record<string, unknown>) => { if (!abort.signal.aborted) port.postMessage({ ...payload, session }); };
    port.onDisconnect.addListener(cleanup);
    port.onMessage.addListener(message => {
      if (message?.session !== session || message.type !== 'blob' || typeof message.id !== 'string') return;
      const candidate = selection?.images.find(image => image.id === message.id);
      const owner = selection?.owners.get(message.id);
      if (!candidate || !owner || !candidate.url.startsWith('blob:')) return;
      void (async () => {
        try {
          if (owner.defaultView?.document !== owner) throw new Error('Il documento del file è cambiato. Ripeti la selezione.');
          const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]);
          const response = await owner.defaultView.fetch(candidate.url, { signal });
          const blob = await boundedBlob(response, signal);
          const reader = new FileReader();
          const data = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
          });
          send({ type: 'blob', id: message.id, data });
        } catch (error) { send({ type: 'blob', id: message.id, error: error instanceof Error ? error.message : String(error) }); }
      })();
    });
    disposePicker = installPicker(result => {
      selection = result;
      send({ type: 'selection', result: { images: result.images, warnings: result.warnings, pageUrl: result.pageUrl } });
    }, () => send({ type: 'cancelled' }), error => send({ type: 'error', error: String(error) }));
    send({ type: 'ready' });
  }
  scope.__swissPickerCleanup = cleanup;
  window.addEventListener('pagehide', cleanup);
  browser.runtime.onConnect.addListener(connect);
});
