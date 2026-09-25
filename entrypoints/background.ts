import { browser } from 'wxt/browser';
import { isScriptableUrl } from '../src/lib/browser';
import { FLOATING_FAILED, loadOpenMode, OPEN_MODE_KEY, showFloatingWindow } from '../src/lib/floating-window';

// Tab whose floating window could not start: its next click keeps the side panel.
const FALLBACK_TAB_KEY = 'floatingFallbackTab';
const report = (error: unknown) => console.error('Impossibile aprire Swiss Knife', error);

async function armFallback(tabId: number) {
  await browser.storage.session.set({ [FALLBACK_TAB_KEY]: tabId });
  await browser.sidePanel.setOptions({ enabled: true });
}

async function openInPage(tabId: number) {
  if (await loadOpenMode() !== 'floating') return;
  const stored = await browser.storage.session.get(FALLBACK_TAB_KEY);
  if (stored[FALLBACK_TAB_KEY] === tabId) {
    await browser.storage.session.remove(FALLBACK_TAB_KEY);
    return;
  }
  // Also closes a fallback panel left open by an earlier click.
  await browser.sidePanel.setOptions({ enabled: false });
  try { await showFloatingWindow(tabId, 'toggle'); } catch (error) { report(error); await armFallback(tabId); }
}

async function applyOpenMode(disable: boolean) {
  const mode = await loadOpenMode();
  // Switching to the floating window leaves open panels alone: the next click disables the panel.
  if (mode === 'sidepanel' || disable) await browser.sidePanel.setOptions({ enabled: mode === 'sidepanel' });
}

export default defineBackground(() => {
  // See docs/adr/0002: the preference is only readable asynchronously, while sidePanel.open
  // must run inside the gesture. So every click tries the panel, which is disabled in floating mode.
  browser.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    const scriptable = isScriptableUrl(tab.url);
    // Keep these calls synchronous with the gesture (no await before open).
    if (!scriptable) void browser.sidePanel.setOptions({ enabled: true }).catch(report);
    void browser.sidePanel.open({ windowId: tab.windowId }).catch(() => { /* Disabled in floating mode. */ });
    if (scriptable) void openInPage(tab.id).catch(report);
  });
  browser.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === FLOATING_FAILED && sender.id === browser.runtime.id && sender.tab?.id != null) void armFallback(sender.tab.id).catch(report);
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[OPEN_MODE_KEY]) void applyOpenMode(false).catch(report);
  });
  browser.runtime.onInstalled.addListener(() => void applyOpenMode(true).catch(report));
  browser.runtime.onStartup.addListener(() => void applyOpenMode(true).catch(report));
  // Also reset the previous automatic behavior when upgrading the extension.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
    .catch(error => console.error('Impossibile configurare il pannello', error));
});
