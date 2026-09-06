import { browser, type Browser } from 'wxt/browser';
import type { MediaSelection } from './types';

export interface PickerSession { close(): void; readBlob(id: string): Promise<string> }
export async function startSession(tabId: number, signal: AbortSignal, onSelection: (result: MediaSelection) => void, onStatus: (status: string) => void): Promise<PickerSession> {
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: ['/media-picker.js'] });
  signal.throwIfAborted();
  if (!injection?.documentId) throw new Error('Il documento non è più disponibile. Riprova.');
  const session = crypto.randomUUID();
  const port: Browser.runtime.Port = browser.tabs.connect(tabId, { documentId: injection.documentId, name: `swiss-media-picker:${session}` });
  const pending = new Map<string, { resolve: (data: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let closed = false;
  const readyTimeout = setTimeout(() => { onStatus('Il selettore non risponde. Premi Nuova selezione.'); close(); }, 10000);
  function close() {
    if (closed) return;
    closed = true; clearTimeout(readyTimeout); signal.removeEventListener('abort', close);
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Selezione terminata.')); }
    pending.clear(); port.disconnect();
  }
  signal.addEventListener('abort', close, { once: true });
  port.onDisconnect.addListener(() => { if (!closed) { onStatus('Connessione alla pagina terminata. Premi Nuova selezione.'); close(); } });
  port.onMessage.addListener(message => {
    if (closed || signal.aborted || message?.session !== session) return;
    if (message.type === 'ready') { clearTimeout(readyTimeout); onStatus('Punta un elemento e clicca. ↑ amplia al contenitore, ↓ restringe. Esc annulla.'); }
    else if (message.type === 'selection' && Array.isArray(message.result?.images)) onSelection(message.result);
    else if (message.type === 'cancelled') onStatus('Selezione annullata. Premi Nuova selezione.');
    else if (message.type === 'error') onStatus(String(message.error));
    else if (message.type === 'blob') {
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer); pending.delete(message.id);
      if (typeof message.data === 'string' && message.data.startsWith('data:')) item.resolve(message.data);
      else item.reject(new Error(message.error || 'Immagine temporanea non disponibile.'));
    }
  });
  return { close, readBlob(id) {
    return new Promise((resolve, reject) => {
      if (closed) { reject(new Error('Documento non più disponibile.')); return; }
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Tempo scaduto nel recupero del file.')); }, 25000);
      pending.set(id, { resolve, reject, timer }); port.postMessage({ type: 'blob', session, id });
    });
  } };
}
