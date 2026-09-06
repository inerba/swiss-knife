import { browser, type Browser } from 'wxt/browser';
import type { PickedElement } from './picker';
export async function startColorSession(tabId: number, signal: AbortSignal, onStatus: (status: string) => void, onResult: (result: PickedElement) => void) {
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: ['/color-picker.js'] });
  if (!injection?.documentId) throw new Error('Il documento non è più disponibile. Riprova.');
  const session = crypto.randomUUID(); const port: Browser.runtime.Port = browser.tabs.connect(tabId, { documentId: injection.documentId, name: `swiss-color-picker:${session}` }); let closed = false;
  const close = () => { if (closed) return; closed = true; signal.removeEventListener('abort', close); port.disconnect(); };
  signal.addEventListener('abort', close, { once: true });
  port.onDisconnect.addListener(() => { if (!closed) { close(); onStatus('Connessione alla pagina terminata. Riprova la selezione.'); } });
  port.onMessage.addListener(message => { if (closed || message?.session !== session) return; if (message.type === 'ready') onStatus('Punta un elemento e clicca. ↑ amplia, ↓ restringe, Esc annulla.'); else if (message.type === 'analysing') onStatus('Analisi dei colori in corso…'); else if (message.type === 'result') { close(); onResult(message.result as PickedElement); } else if (message.type === 'cancelled') { close(); onStatus('Selezione annullata.'); } else if (message.type === 'error') { close(); onStatus(String(message.error)); } });
  return { close };
}
