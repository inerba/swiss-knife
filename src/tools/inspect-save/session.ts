import { browser, type Browser } from 'wxt/browser';
import { captureElementPng } from './capture';
import type { InspectSnapshot, LockedPreview, PickerCommand, SnapshotPayload } from './types';

function isPayload(value: unknown): value is SnapshotPayload {
  if (!value || typeof value !== 'object') return false;
  const item = value as SnapshotPayload;
  return typeof item.tag === 'string'
    && typeof item.selector === 'string'
    && typeof item.markup === 'string'
    && !!item.rect
    && Array.isArray(item.sections);
}

export interface InspectSessionControl {
  close(): void;
  sendCommand(command: PickerCommand): void;
}

export async function startInspectSession(
  tabId: number,
  windowId: number,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  onResult: (result: InspectSnapshot) => void,
  onEnd: (reason: 'cancelled' | 'error' | 'disconnected') => void = () => {},
  onLocked: (preview: LockedPreview) => void = () => {},
): Promise<InspectSessionControl> {
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: ['/inspect-save.js' as never] });
  signal.throwIfAborted();
  if (!injection?.documentId) throw new Error('Il documento non è più disponibile. Riprova.');
  const session = crypto.randomUUID();
  const port: Browser.runtime.Port = browser.tabs.connect(tabId, {
    documentId: injection.documentId,
    name: `swiss-inspect-save:${session}`,
  });
  let closed = false;
  const timeout = setTimeout(() => {
    if (closed) return;
    close();
    onStatus('Il selettore non risponde. Attiva di nuovo Ispeziona e salva.');
    onEnd('error');
  }, 10000);
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    signal.removeEventListener('abort', close);
    port.disconnect();
  };
  signal.addEventListener('abort', close, { once: true });
  let isolateWait: { resolve(): void } | undefined;
  function requestIsolation() {
    return new Promise<void>((resolve, reject) => {
      if (closed || signal.aborted) {
        reject(new Error('Connessione alla pagina terminata. Riprova.'));
        return;
      }
      const timer = setTimeout(() => {
        isolateWait = undefined;
        reject(new Error('Impossibile isolare l\'elemento per la cattura. Riprova.'));
      }, 4000);
      isolateWait = {
        resolve() {
          clearTimeout(timer);
          isolateWait = undefined;
          resolve();
        },
      };
      port.postMessage({ type: 'isolate-capture', session });
    });
  }
  port.onDisconnect.addListener(() => {
    if (!closed) {
      close();
      onStatus('Connessione alla pagina terminata. Attiva di nuovo Ispeziona e salva.');
      onEnd('disconnected');
    }
  });
  port.onMessage.addListener(message => {
    if (closed || signal.aborted || message?.session !== session) return;
    if (message.type === 'ready') {
      clearTimeout(timeout);
      onStatus('Passa col mouse sulle sezioni, clicca per fissare, poi Conferma. ↑ amplia, ↓ restringe, Esc annulla.');
    } else if (message.type === 'locked') {
      if (closed || signal.aborted) return;
      const preview = message.preview as LockedPreview;
      if (!preview?.selector) return;
      onLocked(preview);
      onStatus('Sezione fissata. Regola con ↑ ↓ e premi Conferma.');
    } else if (message.type === 'cancelled') {
      close();
      onStatus('Selezione annullata.');
      onEnd('cancelled');
    } else if (message.type === 'isolated') {
      isolateWait?.resolve();
    } else if (message.type === 'snapshot' && isPayload(message.payload)) {
      clearTimeout(timeout);
      void (async () => {
        try {
          onStatus('Cattura dell\'anteprima…');
          await requestIsolation();
          const capture = await captureElementPng(tabId, windowId, message.payload.rect);
          port.postMessage({ type: 'restore-capture', session });
          close();
          onResult({
            ...message.payload,
            png: capture.png,
            clipped: message.payload.clipped || capture.clipped,
          });
        } catch (error) {
          port.postMessage({ type: 'restore-capture', session });
          close();
          onStatus(error instanceof Error ? error.message : String(error));
          onEnd('error');
        }
      })();
    } else if (message.type === 'error') {
      close();
      onStatus(String(message.error));
      onEnd('error');
    }
  });
  return {
    close,
    sendCommand(command: PickerCommand) {
      if (!closed && !signal.aborted) port.postMessage({ type: 'command', session, command });
    },
  };
}
