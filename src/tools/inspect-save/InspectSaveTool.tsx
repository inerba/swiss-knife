import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Download, Expand, FileCode, MousePointerClick, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { activeTab, explainError } from '../../lib/browser';
import { inspectFilename } from './capture';
import { startInspectSession, type InspectSessionControl } from './session';
import type { InfoRow, InfoSection, InspectSnapshot, LockedPreview, PickerCommand } from './types';
import './inspect-save.css';

function ValueCell({ row }: { row: InfoRow }) {
  if (row.swatch) {
    return (
      <b className="with-swatch">
        <span className="inspect-swatch" style={{ background: row.swatch }} aria-hidden="true" />
        {row.value}
      </b>
    );
  }
  return <b>{row.value}</b>;
}

function InfoSections({ sections }: { sections: InfoSection[] }) {
  return (
    <div className="inspect-info">
      {sections.map(section => (
        <details key={section.id} className="inspect-section" open>
          <summary>{section.title}</summary>
          <div className="inspect-section-body">
            {section.empty
              ? <p className="inspect-empty-row">{section.rows[0]?.value}</p>
              : section.rows.map(row => (
                <div key={`${section.id}-${row.label}`} className="inspect-row">
                  <span>{row.label}</span>
                  <ValueCell row={row} />
                </div>
              ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export function InspectSaveTool() {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  const [snapshot, setSnapshot] = useState<InspectSnapshot | null>(null);
  const [lockedPreview, setLockedPreview] = useState<LockedPreview | null>(null);
  const [feedback, setFeedback] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyFallback, setCopyFallback] = useState('');
  const generation = useRef(0);
  const target = useRef<number | undefined>(undefined);
  const abort = useRef(new AbortController());
  const sessionClose = useRef<InspectSessionControl | null>(null);
  const hadPageStateRef = useRef(false);
  const busyRef = useRef(false);
  hadPageStateRef.current = !!snapshot || active || busy || !!lockedPreview;
  busyRef.current = busy;

  const resetSession = useCallback(() => {
    generation.current++;
    abort.current.abort();
    sessionClose.current?.close();
    sessionClose.current = null;
    abort.current = new AbortController();
  }, []);

  const invalidatePageState = useCallback((message?: string, clearSnapshot = false) => {
    resetSession();
    setActive(false);
    setBusy(false);
    setLockedPreview(null);
    if (clearSnapshot) setSnapshot(null);
    if (message) { setStatus(message); setError(false); }
  }, [resetSession]);

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
    const forward = (command: PickerCommand) => sessionClose.current?.sendCommand(command);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        invalidatePageState('Selezione annullata.');
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        forward('navigate-up');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        forward('navigate-down');
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        forward('confirm');
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [active, invalidatePageState]);

  async function startPicker() {
    resetSession();
    setBusy(true);
    setActive(true);
    setError(false);
    setFeedback('');
    setCopyFallback('');
    setPreviewOpen(false);
    setSnapshot(null);
    setLockedPreview(null);
    setStatus('Avvio del selettore…');
    const gen = generation.current;
    try {
      const tab = await activeTab();
      if (gen !== generation.current) return;
      target.current = tab.id;
      const windowId = tab.windowId;
      if (windowId == null) throw new Error('Finestra della scheda non disponibile.');
      const session = await startInspectSession(
        tab.id,
        windowId,
        abort.current.signal,
        next => { if (gen === generation.current) setStatus(next); },
        result => {
          if (gen !== generation.current) return;
          setSnapshot(result);
          setLockedPreview(null);
          setActive(false);
          setBusy(false);
          setStatus('');
          setError(false);
        },
        () => {
          if (gen !== generation.current) return;
          setActive(false);
          setBusy(false);
          setLockedPreview(null);
        },
        preview => {
          if (gen !== generation.current) return;
          setLockedPreview(preview);
        },
      );
      if (gen !== generation.current) session.close();
      else sessionClose.current = session;
    } catch (reason) {
      if (gen === generation.current) {
        setActive(false);
        setBusy(false);
        setError(true);
        setStatus(explainError(reason));
      }
    }
  }

  async function togglePicker() {
    if (active) {
      invalidatePageState('Selezione annullata.');
      return;
    }
    await startPicker();
  }

  async function copyMarkup() {
    if (!snapshot) return;
    setCopyFallback('');
    try {
      await navigator.clipboard.writeText(snapshot.markup);
      setFeedback('Codice copiato negli appunti.');
      setError(false);
    } catch {
      setCopyFallback(snapshot.markup);
      setFeedback('Impossibile scrivere negli appunti. Seleziona e copia il testo qui sotto.');
      setError(true);
    }
  }

  async function downloadPng() {
    if (!snapshot?.png) return;
    try {
      await browser.downloads.download({
        url: snapshot.png,
        filename: inspectFilename(snapshot.tag, 'png'),
        saveAs: true,
        conflictAction: 'uniquify',
      });
      setFeedback('Download immagine avviato.');
      setError(false);
    } catch (reason) {
      setFeedback(explainError(reason));
      setError(true);
    }
  }

  async function downloadMarkup() {
    if (!snapshot) return;
    const url = URL.createObjectURL(new Blob([snapshot.markup], { type: 'text/html;charset=utf-8' }));
    try {
      await browser.downloads.download({
        url,
        filename: inspectFilename(snapshot.tag, 'html'),
        saveAs: true,
        conflictAction: 'uniquify',
      });
      setFeedback('Download codice avviato.');
      setError(false);
    } catch (reason) {
      setFeedback(explainError(reason));
      setError(true);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const actionLabel = active ? 'Clicca una sezione' : 'Seleziona';

  return (
    <section className="inspect-tool" aria-label="Strumento ispeziona e salva">
      <div className="section-heading inspect-heading">
        <h2>Ispeziona e salva</h2>
        <button
          type="button"
          className={active ? 'inspect-action is-active' : 'inspect-action'}
          onClick={() => void togglePicker()}
        >
          <MousePointerClick aria-hidden="true" /> {actionLabel}
        </button>
      </div>
      <p className="muted">Esplora la pagina, seleziona una sezione e ottieni proprietà, codice e anteprima.</p>

      {(status || (busy && active)) && (
        <div className={`inspect-status ${error ? 'is-error' : ''}`}>
          <p role={error ? 'alert' : 'status'}>{status}</p>
          {busy && active && (
            <button type="button" onClick={() => invalidatePageState('Selezione annullata.')}>
              <X aria-hidden="true" /> Annulla
            </button>
          )}
        </div>
      )}

      {active && lockedPreview && (
        <div className="inspect-lock-bar" role="toolbar" aria-label="Conferma selezione">
          <div className="inspect-lock-summary">
            <span className="inspect-pill">{lockedPreview.selector}</span>
            <span className="inspect-pill">{lockedPreview.dimensions}</span>
          </div>
          <div className="inspect-lock-actions">
            <button type="button" onClick={() => sessionClose.current?.sendCommand('navigate-up')} aria-label="Amplia la selezione">
              <ArrowUp aria-hidden="true" /> Amplia
            </button>
            <button type="button" onClick={() => sessionClose.current?.sendCommand('navigate-down')} aria-label="Restringi la selezione">
              <ArrowDown aria-hidden="true" /> Restringi
            </button>
            <button type="button" className="inspect-action-primary" onClick={() => sessionClose.current?.sendCommand('confirm')}>
              <Check aria-hidden="true" /> Conferma
            </button>
          </div>
        </div>
      )}

      {feedback && <p className={`inspect-feedback ${error ? 'is-error' : ''}`} role="status">{feedback}</p>}

      {!snapshot && !busy && !status && (
        <p className="inspect-empty">Premi Seleziona e clicca una sezione della pagina per analizzarla.</p>
      )}

      {snapshot && (
        <div className="inspect-summary">
          <div className="inspect-title-row">
            <h3>{snapshot.tagLabel}</h3>
            <div className="inspect-pills">
              <span className="inspect-pill">{snapshot.selector}</span>
              <span className="inspect-pill">{snapshot.dimensions}</span>
            </div>
          </div>

          <div className="inspect-preview-wrap">
            <p className="inspect-export-note">
              Se il file scaricato non è fedele, prova un altro formato. Le pagine complesse possono convertire meglio in alcuni formati.
            </p>
            {snapshot.png && (
              <div className="inspect-preview-box">
                <img src={snapshot.png} alt={`Anteprima di ${snapshot.selector}`} />
                <button type="button" className="inspect-preview-expand" aria-label="Ingrandisci anteprima" onClick={() => setPreviewOpen(true)}>
                  <Expand aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <div className="inspect-actions">
            <button type="button" className="inspect-action-primary" onClick={() => void copyMarkup()}>
              <Copy aria-hidden="true" /> Copia codice
            </button>
            <button type="button" disabled={!snapshot.png} onClick={() => void downloadPng()}>
              <Download aria-hidden="true" /> Scarica immagine
            </button>
            <button type="button" onClick={() => void downloadMarkup()}>
              <FileCode aria-hidden="true" /> Scarica codice
            </button>
          </div>

          {snapshot.clipped && (
            <p className="inspect-warning" role="status">
              L&apos;anteprima PNG potrebbe non mostrare tutto l&apos;elemento: contenitori con overflow nascosto, elementi fixed molto grandi o iframe non accessibili possono limitare la cattura.
            </p>
          )}

          <InfoSections sections={snapshot.sections} />
        </div>
      )}

      {copyFallback && (
        <textarea className="inspect-copy-fallback" readOnly value={copyFallback} aria-label="Codice da copiare manualmente" />
      )}

      {previewOpen && snapshot?.png && (
        <div className="inspect-dialog-backdrop" role="presentation" onClick={() => setPreviewOpen(false)}>
          <section className="inspect-dialog" role="dialog" aria-modal="true" aria-label="Anteprima elemento" onClick={event => event.stopPropagation()}>
            <img src={snapshot.png} alt={`Anteprima ingrandita di ${snapshot.selector}`} />
          </section>
        </div>
      )}
    </section>
  );
}
