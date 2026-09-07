import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check, Copy, MousePointer2, Pipette, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { activeTab, explainError } from '../../lib/browser';
import { displayHex, parseColor } from '../colors/color';
import { tryAnalyzeContrast } from './contrast';
import type { ContrastSample } from './sample';
import { startContrastSession } from './session';
import './contrast.css';

declare global {
  interface Window {
    EyeDropper?: new () => { open(options?: { signal: AbortSignal }): Promise<{ sRGBHex: string }> };
  }
}

type Field = 'text' | 'background';

function fieldLabel(field: Field) {
  return field === 'text' ? 'Colore del testo' : 'Colore di sfondo';
}

function isValidColorInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#') && !/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return false;
  try { parseColor(trimmed); return true; }
  catch { return false; }
}

function fieldStyle(value: string) {
  if (!isValidColorInput(value)) return undefined;
  try {
    const hex = displayHex(parseColor(value));
    return { backgroundColor: hex, borderColor: hex };
  } catch {
    return undefined;
  }
}

function Badge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span className={`contrast-pill ${pass ? 'pass' : 'fail'}`}>
      {pass ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
      {label}
    </span>
  );
}

export function ContrastTool() {
  const [text, setText] = useState('#000000');
  const [background, setBackground] = useState('#FFFFFF');
  const [font, setFont] = useState<Omit<ContrastSample, 'foreground' | 'background'> | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hadPageState, setHadPageState] = useState(false);
  const generation = useRef(0);
  const target = useRef<number | undefined>(undefined);
  const abort = useRef(new AbortController());
  const sessionClose = useRef<{ close(): void } | null>(null);
  const hadPageStateRef = useRef(false);
  const busyRef = useRef(false);
  hadPageStateRef.current = hadPageState;
  busyRef.current = busy;
  const hasEyeDropper = !!window.EyeDropper;

  const result = isValidColorInput(text) && isValidColorInput(background) ? tryAnalyzeContrast(text, background) : null;
  const textInvalid = !isValidColorInput(text);
  const backgroundInvalid = !isValidColorInput(background);

  function resetSession() {
    generation.current++;
    abort.current.abort();
    sessionClose.current?.close();
    sessionClose.current = null;
    abort.current = new AbortController();
  }

  const invalidatePageState = useCallback((message?: string) => {
    resetSession();
    setBusy(false);
    setFont(null);
    setHadPageState(false);
    if (message) { setStatus(message); setError(false); }
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
      invalidatePageState(message || undefined);
      setBusy(false);
      setError(false);
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
  }, [invalidatePageState]);

  async function copyField(field: Field) {
    const value = field === 'text' ? text : background;
    try {
      await navigator.clipboard.writeText(displayHex(parseColor(value)));
      setFeedback('HEX copiato.');
      setError(false);
    } catch {
      setFeedback('Impossibile copiare negli appunti.');
      setError(true);
    }
  }

  function pickColor(field: Field) {
    if (!window.EyeDropper || busy) return;
    resetSession();
    setBusy(true);
    setError(false);
    setFeedback('');
    setStatus('Scegli un punto sullo schermo. Esc annulla.');
    const gen = generation.current;
    const controller = abort.current;
    try {
      const pending = new window.EyeDropper().open({ signal: controller.signal });
      void pending.then(picked => {
        if (gen !== generation.current) return;
        const setter = field === 'text' ? setText : setBackground;
        setter(picked.sRGBHex);
        setFont(null);
        setHadPageState(false);
        setStatus('');
        setError(false);
      }).catch(reason => {
        if (gen !== generation.current) return;
        if (reason instanceof Error && reason.name === 'AbortError') setStatus('Acquisizione annullata.');
        else { setError(true); setStatus(explainError(reason)); }
      }).finally(() => {
        if (gen === generation.current) setBusy(false);
      });
    } catch (reason) {
      if (gen === generation.current) {
        setBusy(false);
        setError(true);
        setStatus(explainError(reason));
      }
    }
  }

  async function pickElement() {
    if (busy) return;
    resetSession();
    setBusy(true);
    setError(false);
    setFeedback('');
    setStatus('Avvio del selettore…');
    const gen = generation.current;
    try {
      const tab = await activeTab();
      if (gen !== generation.current) return;
      target.current = tab.id;
      const session = await startContrastSession(
        tab.id,
        abort.current.signal,
        next => { if (gen === generation.current) setStatus(next); },
        sample => {
          if (gen !== generation.current) return;
          setText(sample.foreground);
          setBackground(sample.background);
          setFont({
            fontFamily: sample.fontFamily,
            fontSize: sample.fontSize,
            lineHeight: sample.lineHeight,
            fontWeight: sample.fontWeight,
            warnings: sample.warnings,
          });
          setHadPageState(true);
          setStatus('');
          setError(false);
          setBusy(false);
        },
        () => {
          if (gen !== generation.current) return;
          setBusy(false);
        },
      );
      if (gen !== generation.current) session.close();
      else sessionClose.current = session;
    } catch (reason) {
      if (gen === generation.current) {
        setBusy(false);
        setError(true);
        setStatus(explainError(reason));
      }
    }
  }

  function swapColors() {
    setText(background);
    setBackground(text);
    setFont(null);
    setHadPageState(false);
    setFeedback('');
  }

  function cancel() {
    invalidatePageState('Acquisizione annullata.');
  }

  const previewStyle = result
    ? { color: result.foreground, backgroundColor: result.background }
    : undefined;
  const gradeClass = result?.grade === 'Insufficiente' || result?.grade === 'Sufficiente'
    ? 'is-bad'
    : result?.grade === 'Buono'
      ? 'is-warn'
      : 'is-good';

  return (
    <section className="contrast-tool" aria-label="Strumento contrasti">
      <header className="contrast-heading">
        <h2>Contrasti</h2>
        <p>Confronta testo e sfondo e verifica i criteri WCAG 2.1.</p>
      </header>

      <div className="contrast-pair">
        {(['text', 'background'] as const).map((field, index) => {
          const value = field === 'text' ? text : background;
          const invalid = field === 'text' ? textInvalid : backgroundInvalid;
          const style = fieldStyle(value);
          const block = (
            <div key={field} className="contrast-field">
              <label htmlFor={`contrast-${field}`}>{field === 'text' ? 'Testo' : 'Sfondo'}</label>
              <div className="contrast-field-inner">
                {style && <span className="contrast-field-swatch" style={style} aria-hidden="true" />}
                <input
                  id={`contrast-${field}`}
                  aria-label={fieldLabel(field)}
                  aria-invalid={invalid || undefined}
                  value={value}
                  onChange={event => {
                    const next = event.target.value;
                    if (field === 'text') setText(next);
                    else setBackground(next);
                    setFont(null);
                    setHadPageState(false);
                    setFeedback('');
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
                <div className="contrast-field-actions">
                  <button
                    type="button"
                    aria-label={field === 'text' ? 'Contagocce del testo' : 'Contagocce dello sfondo'}
                    disabled={busy || !hasEyeDropper}
                    onClick={() => pickColor(field)}
                  >
                    <Pipette aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={field === 'text' ? 'Copia il colore del testo' : 'Copia il colore di sfondo'}
                    disabled={invalid}
                    onClick={() => void copyField(field)}
                  >
                    <Copy aria-hidden="true" />
                  </button>
                </div>
              </div>
              {invalid && <p className="contrast-field-error">Inserisci un colore HEX valido.</p>}
            </div>
          );
          if (index === 0) {
            return [block, (
              <button key="swap" type="button" className="contrast-swap" aria-label="Scambia i colori" disabled={busy} onClick={swapColors}>
                <ArrowUpDown aria-hidden="true" />
              </button>
            )];
          }
          return block;
        }).flat()}
      </div>

      {!hasEyeDropper && (
        <p className="contrast-caption">Il contagocce non è disponibile. Puoi incollare un HEX o usare Da elemento.</p>
      )}

      <button type="button" className="contrast-wide" disabled={busy} onClick={() => void pickElement()}>
        <MousePointer2 aria-hidden="true" /> Da elemento
      </button>

      {(status || busy) && (
        <div className={`contrast-status ${error ? 'is-error' : ''}`}>
          <p role={error ? 'alert' : 'status'}>{status}</p>
          {busy && (
            <button type="button" onClick={cancel}>
              <X aria-hidden="true" /> Annulla
            </button>
          )}
        </div>
      )}

      {feedback && <p className="contrast-feedback" role="status">{feedback}</p>}

      {font?.warnings.map(warning => (
        <p key={warning} className="contrast-warning" role="status">{warning}</p>
      ))}

      {previewStyle && (
        <div className="contrast-preview" style={previewStyle}>
          <span>Anteprima</span>
          <p>Il contrasto si giudica così.</p>
        </div>
      )}

      {result && (
        <div className="contrast-card">
          <div className="contrast-ratio">
            <strong>{result.display}</strong>
            <span className={`contrast-grade ${gradeClass}`}>{result.grade}</span>
          </div>
          <div className="contrast-badges">
            <div className="contrast-badge-group">
              <span>Testo normale</span>
              <div className="contrast-pills">
                <Badge pass={result.checks.aaNormal} label="AA 4.5:1" />
                <Badge pass={result.checks.aaaNormal} label="AAA 7:1" />
              </div>
            </div>
            <div className="contrast-badge-group">
              <span>Testo grande</span>
              <div className="contrast-pills">
                <Badge pass={result.checks.aaLarge} label="AA 3:1" />
                <Badge pass={result.checks.aaaLarge} label="AAA 4.5:1" />
              </div>
            </div>
          </div>
          <div className="contrast-nontext">
            <span>Non-testo (1.4.11)</span>
            <div className="contrast-pills">
              <Badge pass={result.checks.aaNonText} label="AA 3:1" />
            </div>
          </div>
        </div>
      )}

      {font && (
        <section className="contrast-props" aria-label="Proprietà testo">
          <h3>Proprietà testo</h3>
          <div><span>Famiglia</span><b>{font.fontFamily}</b></div>
          <div><span>Dimensione</span><b>{font.fontSize}</b></div>
          <div><span>Interlinea</span><b>{font.lineHeight}</b></div>
        </section>
      )}
    </section>
  );
}
