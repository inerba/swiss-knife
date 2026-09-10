import { browser, type Browser } from 'wxt/browser';
import { cropScreenshot } from '../screenshots/capture';
import type { QrPickRect } from './picker';

export async function startQrPagePick(tabId: number, windowId: number, signal: AbortSignal, onStatus: (value: string) => void, onImage: (dataUrl: string) => void, onEnd: () => void) {
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: ['/qr-picker.js' as never] });
  if (!injection?.documentId) throw new Error('Il documento non è più disponibile. Riprova.');
  const session = crypto.randomUUID(); const port: Browser.runtime.Port = browser.tabs.connect(tabId, { documentId: injection.documentId, name: `swiss-qr-picker:${session}` });
  let closed = false; const close = () => { if (closed) return; closed = true; signal.removeEventListener('abort', close); port.disconnect(); };
  signal.addEventListener('abort', close, { once: true });
  const timer = setTimeout(() => { close(); onStatus('Il selettore non risponde. Riprova.'); onEnd(); }, 10_000);
  port.onDisconnect.addListener(() => { if (!closed) { close(); onStatus('Connessione alla pagina terminata. Riprova.'); onEnd(); } });
  port.onMessage.addListener(async message => {
    if (closed || signal.aborted || message?.session !== session) return;
    if (message.type === 'ready') { clearTimeout(timer); onStatus('Punta il QR, clicca per selezionarlo. ↑ amplia, ↓ restringe, Esc annulla.'); return; }
    if (message.type === 'cancelled') { clearTimeout(timer); close(); onStatus('Selezione annullata.'); onEnd(); return; }
    if (message.type !== 'result') return;
    clearTimeout(timer); const rect = message.rect as QrPickRect;
    try {
      if (!rect || rect.width < 1 || rect.height < 1) throw new Error('Seleziona un elemento visibile.');
      const screenshot = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
      const png = await cropScreenshot(screenshot, rect, 'image/png');
      close(); onImage(png);
    } catch (error) { close(); onStatus(error instanceof Error ? error.message : String(error)); onEnd(); }
  });
  return { close };
}
