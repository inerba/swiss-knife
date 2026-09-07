import { browser, type Browser } from 'wxt/browser';
import { captureElementPng } from './capture';
import type { InspectSnapshot, SnapshotPayload } from './types';

function isPayload(value: unknown): value is SnapshotPayload {
  if (!value || typeof value !== 'object') return false;
  const item = value as SnapshotPayload;
  return typeof item.tag === 'string'
    && typeof item.selector === 'string'
    && typeof item.markup === 'string'
    && !!item.rect
    && Array.isArray(item.sections);
}

export async function startInspectSession(
  tabId: number,
  windowId: number,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  onResult: (result: InspectSnapshot) => void,
  onEnd: (reason: 'cancelled' | 'error' | 'disconnected') => void = () => {},
) {
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
      onStatus('Passa col mouse sulle sezioni e clicca. ↑ amplia, ↓ restringe, Esc annulla.');
    } else if (message.type === 'cancelled') {
      close();
      onStatus('Selezione annullata.');
      onEnd('cancelled');
    } else if (message.type === 'snapshot' && isPayload(message.payload)) {
      clearTimeout(timeout);
      void (async () => {
        try {
          onStatus('Cattura dell\'anteprima…');
          const png = await captureElementPng(windowId, message.payload.rect);
          close();
          onResult({ ...message.payload, png });
        } catch (error) {
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
  return { close };
}
