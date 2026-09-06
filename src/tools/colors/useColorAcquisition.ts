import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { activeTab, explainError } from '../../lib/browser';
import { startColorSession } from './session';
import type { PickedElement } from './picker';

declare global {
  interface Window {
    EyeDropper?: new () => { open(options?: { signal: AbortSignal }): Promise<{ sRGBHex: string }> };
  }
}

export function useColorAcquisition(onCapture: (value: string) => Promise<void>) {
  const [result, setResult] = useState<PickedElement | null>(null);
  const currentResult = useRef<PickedElement | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);
  const target = useRef<number | undefined>(undefined);
  const abort = useRef(new AbortController());
  const connection = useRef<{ close(): void } | null>(null);
  const capture = useRef(onCapture); capture.current = onCapture;

  function reset() {
    generation.current++;
    abort.current.abort(); connection.current?.close(); connection.current = null;
    abort.current = new AbortController(); locked.current = false; target.current = undefined;
  }
  function finish() { locked.current = false; setBusy(false); }
  function cancel() { reset(); setBusy(false); setError(false); setMessage('Acquisizione annullata. Puoi riprovare.'); }
  function clearResult() { currentResult.current = null; setResult(null); }

  useEffect(() => {
    let windowId: number | undefined;
    let disposed = false;
    void (async () => { try { const win = await browser.windows.getCurrent(); if (!disposed) windowId = win.id; } catch { /* Events still invalidate conservatively. */ } })();
    const invalidate = () => {
      reset(); clearResult(); setBusy(false); setError(false);
      setMessage('Scheda cambiata. Avvia lo strumento per lavorare su questa pagina.');
    };
    const activated = (info: { windowId: number }) => { if (windowId === undefined || info.windowId === windowId) invalidate(); };
    const updated = (id: number, info: { status?: string; url?: string }) => {
      if ((target.current === id || (locked.current && target.current === undefined)) && (info.status === 'loading' || info.url)) invalidate();
    };
    const removed = (id: number) => { if (target.current === id) invalidate(); };
    browser.tabs.onActivated.addListener(activated); browser.tabs.onUpdated.addListener(updated); browser.tabs.onRemoved.addListener(removed);
    return () => {
      disposed = true; reset();
      browser.tabs.onActivated.removeListener(activated); browser.tabs.onUpdated.removeListener(updated); browser.tabs.onRemoved.removeListener(removed);
    };
  }, []);

  async function pickElement() {
    if (locked.current) return;
    reset(); clearResult(); locked.current = true; setBusy(true); setError(false); setMessage('Avvio del selettore…');
    const gen = generation.current;
    try {
      const tab = await activeTab();
      if (gen !== generation.current) return;
      target.current = tab.id;
      const session = await startColorSession(tab.id, abort.current.signal,
        text => { if (gen === generation.current) setMessage(text); },
        next => {
          if (gen !== generation.current) return;
          currentResult.current = next; setResult(next); setMessage('Palette pronta. Scegli i colori da salvare.'); finish();
        },
        reason => {
          if (gen !== generation.current) return;
          finish();
          if (reason === 'error' || reason === 'disconnected') { clearResult(); setError(true); }
        });
      if (gen !== generation.current) session.close(); else connection.current = session;
    } catch (reason) {
      if (gen === generation.current) { finish(); setError(true); setMessage(explainError(reason).replace('premi Aggiorna', 'premi Da elemento')); }
    }
  }
  async function pickPixel() {
    if (!window.EyeDropper || locked.current) return;
    reset(); locked.current = true; setBusy(true); setError(false); setMessage('Scegli un punto sullo schermo. Esc annulla.');
    const gen = generation.current;
    try {
      // Call open in the user gesture, before awaiting any browser API.
      const pending = new window.EyeDropper().open({ signal: abort.current.signal });
      void (async () => {
        try { const [tab] = await browser.tabs.query({ active: true, currentWindow: true }); if (gen === generation.current) target.current = tab?.id; }
        catch { /* Screen acquisition does not require page access. */ }
      })();
      const picked = await pending;
      if (gen !== generation.current) return;
      try {
        await capture.current(picked.sRGBHex);
        if (gen === generation.current) setMessage('Colore acquisito e salvato nella cronologia.');
      } catch {
        if (gen === generation.current) { setError(true); setMessage('Colore acquisito, ma non salvato. Riprova con “Salva colore”.'); }
      }
    } catch (reason) {
      if (gen !== generation.current) return;
      if (reason instanceof Error && reason.name === 'AbortError') setMessage('Acquisizione annullata.');
      else { setError(true); setMessage(explainError(reason)); }
    } finally { if (gen === generation.current) finish(); }
  }
  return { result, currentResult, message, error, busy, cancel, pickPixel, pickElement, hasEyeDropper: !!window.EyeDropper };
}
