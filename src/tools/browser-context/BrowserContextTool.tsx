import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Download, Expand, Image as ImageIcon, MousePointerClick, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { activeTab, explainError } from '../../lib/browser';
import type { PickerEndReason, PickerSessionControl } from '../inspect-save/picker-session';
import type { LockedPreview, PickerCommand } from '../inspect-save/types';
import { downloadReport } from './download';
import { formatReport, formatReportStats } from './report';
import { SelectorList } from './SelectorList';
import { startBrowserContextSession } from './session';
import type { ContextResult } from './types';
import './browser-context.css';

const CANCELLED = 'Selezione annullata.';
const KEY_COMMANDS: Record<string, PickerCommand> = {
  ArrowUp: 'navigate-up',
  ArrowDown: 'navigate-down',
  Enter: 'confirm',
};

export function BrowserContextTool() {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [result, setResult] = useState<ContextResult | null>(null);
  const [lockedPreview, setLockedPreview] = useState<LockedPreview | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [copyFallback, setCopyFallback] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const generation = useRef(0);
  const target = useRef<number | undefined>(undefined);
  const abort = useRef(new AbortController());
  const session = useRef<PickerSessionControl | null>(null);
  const hadPageStateRef = useRef(false);
  const busyRef = useRef(false);
  const lockedRef = useRef(false);
  hadPageStateRef.current = !!result || active || busy || !!lockedPreview;
  busyRef.current = busy;
  lockedRef.current = !!lockedPreview;

  const report = useMemo(() => (result ? formatReport(result) : ''), [result]);

  const resetSession = useCallback(() => {
    generation.current++;
    abort.current.abort();
    session.current?.close();
    session.current = null;
    abort.current = new AbortController();
  }, []);

  const invalidatePageState = useCallback((message?: string, clearResult = false) => {
    resetSession();
    setActive(false);
    setBusy(false);
    setLockedPreview(null);
    setDownloading(false);
    if (clearResult) {
      setResult(null);
      setFeedback('');
      setFeedbackError(false);
      setCopyFallback('');
      setPreviewOpen(false);
    }
    if (message) {
      setStatus(message);
      setStatusError(false);
    }
  }, [resetSession]);

  const sendCommand = useCallback((command: PickerCommand) => {
    if (!session.current) return;
    if (command === 'confirm' && lockedRef.current) {
      setStatus('Raccolta del contesto…');
      setStatusError(false);
    }
    session.current.sendCommand(command);
  }, []);

  useEffect(() => {
    let windowId: number | undefined;
    let disposed = false;
    void (async () => {
      try {
        const win = await browser.windows.getCurrent();
        if (!disposed) windowId = win.id;
      } catch { /* still invalidate conservatively */ }
    })();
    const invalidate = () => {
      const message = hadPageStateRef.current ? 'Scheda cambiata. Avvia lo strumento per lavorare su questa pagina.' : '';
      invalidatePageState(message || undefined, true);
    };
    const activated = (info: { windowId: number }) => {
      if (windowId === undefined || info.windowId === windowId) invalidate();
    };
    const updated = (id: number, info: { status?: string; url?: string }) => {
      if ((target.current === id || (busyRef.current && target.current === undefined)) && (info.status === 'loading' || info.url)) invalidate();
    };
    const removed = (id: number) => { if (target.current === id) invalidate(); };
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    return () => {
      disposed = true;
      resetSession();
      browser.tabs.onActivated.removeListener(activated);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
    };
  }, [invalidatePageState, resetSession]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        invalidatePageState(CANCELLED);
        return;
      }
      const command = KEY_COMMANDS[event.key];
      if (!command) return;
      event.preventDefault();
      event.stopPropagation();
      sendCommand(command);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [active, invalidatePageState, sendCommand]);

  function showFeedback(message: string, isError = false) {
    setFeedback(message);
    setFeedbackError(isError);
  }

  async function copyReport(text: string, automatic: boolean, gen: number) {
    try {
      await navigator.clipboard.writeText(text);
      if (gen !== generation.current) return;
      setCopyFallback('');
      showFeedback('Report copiato negli appunti.');
    } catch {
      if (gen !== generation.current) return;
      if (automatic) {
        showFeedback('Chrome non ha permesso la copia automatica. Premi Copia report.');
      } else {
        setCopyFallback(text);
        showFeedback('Impossibile scrivere negli appunti. Seleziona e copia il testo qui sotto.', true);
      }
    }
  }

  async function copyImage() {
    if (!result?.png) return;
    const gen = generation.current;
    try {
      const blob = await (await fetch(result.png)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      if (gen === generation.current) showFeedback('Immagine copiata negli appunti.');
    } catch {
      if (gen === generation.current) showFeedback('Impossibile copiare l’immagine. Usa Scarica report.', true);
    }
  }

  async function saveReport() {
    if (!result || downloading) return;
    const gen = generation.current;
    setDownloading(true);
    try {
      const outcome = await downloadReport(result);
      if (gen !== generation.current) return;
      showFeedback(outcome === 'screenshot-failed'
        ? 'Screenshot non salvato; report scaricato senza immagine.'
        : 'Report salvato in Download/swiss-knife/browser-context.');
    } catch (reason) {
      if (gen === generation.current) showFeedback(explainError(reason), true);
    } finally {
      if (gen === generation.current) setDownloading(false);
    }
  }

  async function startPicker() {
    resetSession();
    setBusy(true);
    setActive(true);
    setStatusError(false);
    setResult(null);
    setLockedPreview(null);
    setFeedback('');
    setFeedbackError(false);
    setCopyFallback('');
    setPreviewOpen(false);
    setStatus('Avvio del selettore…');
    const gen = generation.current;
    try {
      const tab = await activeTab();
      if (gen !== generation.current) return;
      target.current = tab.id;
      if (tab.windowId == null) throw new Error('Finestra della scheda non disponibile.');
      const control = await startBrowserContextSession(tab.id, tab.windowId, abort.current.signal, {
        onStatus: next => { if (gen === generation.current) setStatus(next); },
        onLocked: preview => { if (gen === generation.current) setLockedPreview(preview); },
        onEnd: (reason: PickerEndReason) => {
          if (gen !== generation.current) return;
          setActive(false);
          setBusy(false);
          setLockedPreview(null);
          setStatusError(reason !== 'cancelled');
        },
        onResult: next => {
          if (gen !== generation.current) return;
          setResult(next);
          setLockedPreview(null);
          setActive(false);
          setBusy(false);
          setStatus('');
          setStatusError(false);
          void copyReport(formatReport(next), true, gen);
        },
      });
      if (gen !== generation.current) control.close();
      else session.current = control;
    } catch (reason) {
      if (gen === generation.current) {
        setActive(false);
        setBusy(false);
        setStatusError(true);
        setStatus(explainError(reason));
      }
    }
  }

  async function togglePicker() {
    if (active) {
      invalidatePageState(CANCELLED);
      return;
    }
    await startPicker();
  }

  return (
    <section className="context-tool" aria-label="Strumento browser context">
      <div className="section-heading context-heading">
        <h2>Browser context</h2>
        <button
          type="button"
          className={active ? 'context-action is-active' : 'context-action'}
          onClick={() => void togglePicker()}
        >
          <MousePointerClick aria-hidden="true" /> {active ? 'Clicca un elemento' : 'Seleziona'}
        </button>
      </div>
      <p className="muted">Seleziona un elemento della pagina per copiarne markup, CSS e anteprima in un formato leggibile da un agente AI.</p>

      {(status || (busy && active)) && (
        <div className={`context-status ${statusError ? 'is-error' : ''}`}>
          <p role={statusError ? 'alert' : 'status'}>{status}</p>
          {busy && active && (
            <button type="button" onClick={() => invalidatePageState(CANCELLED)}>
              <X aria-hidden="true" /> Annulla
            </button>
          )}
        </div>
      )}

      {active && lockedPreview && (
        <div className="context-lock-bar" role="toolbar" aria-label="Conferma selezione">
          <div className="context-pills">
            <span className="context-pill">{lockedPreview.selector}</span>
            <span className="context-pill">{lockedPreview.dimensions}</span>
          </div>
          <div className="context-lock-actions">
            <button type="button" onClick={() => sendCommand('navigate-up')} aria-label="Amplia la selezione">
              <ArrowUp aria-hidden="true" /> Amplia
            </button>
            <button type="button" onClick={() => sendCommand('navigate-down')} aria-label="Restringi la selezione">
              <ArrowDown aria-hidden="true" /> Restringi
            </button>
            <button type="button" className="context-action-primary" onClick={() => sendCommand('confirm')}>
              <Check aria-hidden="true" /> Conferma
            </button>
          </div>
        </div>
      )}

      {!result && !busy && !status && (
        <p className="context-empty">Premi Seleziona, fissa un elemento e premi Conferma.</p>
      )}

      {result && (
        <div className="context-summary">
          <div className="context-pills">
            <span className="context-pill">{result.element}</span>
            <span className="context-pill">{result.box.width} × {result.box.height}</span>
          </div>

          {result.png ? (
            <div className="context-preview-box">
              <img src={result.png} alt={`Anteprima di ${result.element}`} />
              <button type="button" className="context-preview-expand" aria-label="Ingrandisci anteprima" onClick={() => setPreviewOpen(true)}>
                <Expand aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className="context-warning" role="status">Anteprima non disponibile: il report non include lo screenshot.</p>
          )}

          <p className="context-stats">{formatReportStats(report)}</p>

          <div className="context-actions">
            <button type="button" className="context-action-primary" onClick={() => void copyReport(report, false, generation.current)}>
              <Copy aria-hidden="true" /> Copia report
            </button>
            <button type="button" disabled={!result.png} onClick={() => void copyImage()}>
              <ImageIcon aria-hidden="true" /> Copia immagine
            </button>
            <button type="button" disabled={downloading} onClick={() => void saveReport()}>
              <Download aria-hidden="true" /> Scarica report
            </button>
          </div>

          {feedback && (
            <p className={`context-feedback ${feedbackError ? 'is-error' : ''}`} role={feedbackError ? 'alert' : 'status'}>{feedback}</p>
          )}

          <SelectorList selectors={result.selectors} onCopyError={message => showFeedback(message, true)} />

          <details className="context-report">
            <summary>Anteprima report</summary>
            <pre>{report}</pre>
          </details>
        </div>
      )}

      {copyFallback && (
        <textarea className="context-copy-fallback" readOnly value={copyFallback} aria-label="Report da copiare manualmente" />
      )}

      {previewOpen && result?.png && (
        <div className="context-dialog-backdrop" role="presentation" onClick={() => setPreviewOpen(false)}>
          <section className="context-dialog" role="dialog" aria-modal="true" aria-label="Anteprima elemento" onClick={event => event.stopPropagation()}>
            <img src={result.png} alt={`Anteprima ingrandita di ${result.element}`} />
          </section>
        </div>
      )}
    </section>
  );
}
