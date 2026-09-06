import { browser, type Browser } from 'wxt/browser';
import type { PickedElement } from './picker';

export type ColorSessionMode = 'pick' | 'page';

export async function startColorSession(
  tabId: number,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  onResult: (result: PickedElement) => void,
  onEnd: (reason: 'cancelled' | 'error' | 'disconnected') => void = () => {},
  options: { mode: ColorSessionMode } = { mode: 'pick' },
) {
  const { mode } = options;
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: ['/color-picker.js'] });
  signal.throwIfAborted();
  if (!injection?.documentId) throw new Error('Il documento non è più disponibile. Riprova.');
  const session = crypto.randomUUID();
  const port: Browser.runtime.Port = browser.tabs.connect(tabId, { documentId: injection.documentId, name: `swiss-color-picker:${mode}:${session}` });
  let closed = false;
  const retryLabel = mode === 'page' ? 'Genera Palette' : 'Da elemento';
  const timeout = setTimeout(() => {
    if (closed) return;
    close(); onStatus(`Il selettore non risponde. Premi ${retryLabel} per riprovare.`); onEnd('error');
  }, 10000);
  const close = () => { if (closed) return; closed = true; clearTimeout(timeout); signal.removeEventListener('abort', close); port.disconnect(); };
  signal.addEventListener('abort', close, { once: true });
  port.onDisconnect.addListener(() => { if (!closed) { close(); onStatus('Connessione alla pagina terminata. Riprova la selezione.'); onEnd('disconnected'); } });
  port.onMessage.addListener(message => {
    if (closed || signal.aborted || message?.session !== session) return;
    if (message.type === 'ready') {
      clearTimeout(timeout);
      onStatus(mode === 'page' ? 'Analisi dei colori della pagina…' : 'Punta un elemento e clicca. ↑ amplia, ↓ restringe, Esc annulla.');
    } else if (message.type === 'analysing') onStatus('Analisi dei colori in corso…');
    else if (message.type === 'result') {
      close();
      if (Array.isArray(message.result?.colors) && Array.isArray(message.result?.warnings)) onResult(message.result as PickedElement);
      else { onStatus('La pagina ha restituito una palette non valida. Riprova.'); onEnd('error'); }
    } else if (message.type === 'cancelled') { close(); onStatus('Selezione annullata.'); onEnd('cancelled'); }
    else if (message.type === 'error') { close(); onStatus(String(message.error)); onEnd('error'); }
  });
  return { close };
}
