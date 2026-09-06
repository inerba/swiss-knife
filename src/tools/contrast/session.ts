import { browser, type Browser } from 'wxt/browser';
import type { ContrastSample } from './sample';

function isSample(value: unknown): value is ContrastSample {
  if (!value || typeof value !== 'object') return false;
  const item = value as ContrastSample;
  return [item.foreground, item.background, item.fontFamily, item.fontSize, item.lineHeight, item.fontWeight]
    .every(field => typeof field === 'string') && Array.isArray(item.warnings);
}

export async function startContrastSession(
  tabId: number,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  onResult: (result: ContrastSample) => void,
  onEnd: (reason: 'cancelled' | 'error' | 'disconnected') => void = () => {},
) {
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: ['/contrast.js'] });
  signal.throwIfAborted();
  if (!injection?.documentId) throw new Error('Il documento non è più disponibile. Riprova.');
  const session = crypto.randomUUID();
  const port: Browser.runtime.Port = browser.tabs.connect(tabId, {
    documentId: injection.documentId,
    name: `swiss-contrast:${session}`,
  });
  let closed = false;
  const timeout = setTimeout(() => {
    if (closed) return;
    close();
    onStatus('Il selettore non risponde. Premi Da elemento per riprovare.');
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
    if (!closed) { close(); onStatus('Connessione alla pagina terminata. Riprova la selezione.'); onEnd('disconnected'); }
  });
  port.onMessage.addListener(message => {
    if (closed || signal.aborted || message?.session !== session) return;
    if (message.type === 'ready') {
      clearTimeout(timeout);
      onStatus('Punta un elemento e clicca. ↑ amplia, ↓ restringe, Esc annulla.');
    } else if (message.type === 'result') {
      close();
      if (isSample(message.result)) onResult(message.result);
      else { onStatus('La pagina ha restituito un campione non valido. Riprova.'); onEnd('error'); }
    } else if (message.type === 'cancelled') { close(); onStatus('Selezione annullata.'); onEnd('cancelled'); }
    else if (message.type === 'error') { close(); onStatus(String(message.error)); onEnd('error'); }
  });
  return { close };
}
