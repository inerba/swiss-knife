import { browser } from 'wxt/browser';
export async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) throw new Error('Nessuna scheda attiva disponibile.');
  if (tab.url && (!/^https?:/i.test(tab.url) || /^https:\/\/(chromewebstore.google.com|chrome.google.com\/webstore)(\/|$)/i.test(tab.url))) {
    throw new Error('Questa pagina è protetta o non supportata. Apri una normale pagina web.');
  }
  return tab as typeof tab & { id: number };
}
export function explainError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/extensions gallery|cannot be scripted|cannot access a chrome:\/\/|chromewebstore\.google\.com|chrome\.google\.com\/webstore/i.test(message)) {
    return 'Questa pagina è protetta da Chrome e non può essere analizzata. Apri una normale pagina web.';
  }
  if (/cannot access|missing host permission|permission/i.test(message)) {
    return 'Accesso alla scheda non ancora autorizzato. Clicca l’icona Swiss Knife nella barra delle estensioni mentre questa pagina è attiva, poi premi Aggiorna. Il pulsante nel pannello laterale non concede l’autorizzazione.';
  }
  return message;
}
export async function openUrl(url: string) {
  if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('URL non supportato.');
  await browser.tabs.create({ url, active: true });
}
