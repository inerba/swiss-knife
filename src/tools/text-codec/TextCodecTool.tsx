import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, ArrowRightLeft, Binary, Clipboard, Copy, LockKeyhole, Trash2 } from 'lucide-react';
import { convert, formats, type TextFormat } from './convert';
import { detectFormat } from './detect';
import { generateHash, type HashAlgorithm } from './hash';
import './text-codec.css';

type Mode = 'convert' | 'hash';
type Result = { value: string; format: TextFormat };
const tabs = [{ id: 'convert', label: 'Converti' }, { id: 'hash', label: 'Hash' }] as const;
const algorithms: HashAlgorithm[] = ['MD5', 'SHA-256', 'SHA-512', 'SM3'];

export function TextCodecTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('convert');
  const [from, setFrom] = useState<TextFormat>('text');
  const [to, setTo] = useState<TextFormat>('base64');
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<TextFormat | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const alive = useRef(true);
  const revision = useRef(0);
  const clipboardRevision = useRef(0);
  const running = useRef(false);
  const count = useMemo(() => { let total = 0; for (const _ of input) total++; return total; }, [input]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; revision.current++; clipboardRevision.current++; };
  }, []);
  useEffect(() => {
    setDetected(null);
    if (mode !== 'convert') return;
    const timer = window.setTimeout(() => setDetected(detectFormat(input)), 300);
    return () => window.clearTimeout(timer);
  }, [input, mode]);

  function invalidate() {
    revision.current++; running.current = false;
    setBusy(false); setResult(null); setError(''); setNotice('');
  }
  function changeInput(value: string) { invalidate(); setDetected(null); setInput(value); }
  function changeMode(value: Mode) { if (value !== mode) { invalidate(); setDetected(null); setMode(value); } }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - index
      : event.key === 'Home' ? 0 : event.key === 'End' ? 1 : -1;
    if (next < 0) return;
    event.preventDefault(); changeMode(tabs[next]!.id); tabRefs.current[next]?.focus();
  }
  async function run() {
    if (running.current) return;
    invalidate(); running.current = true; setBusy(true);
    const version = revision.current;
    try {
      const value = mode === 'convert' ? convert(input, from, to) : await generateHash(input, algorithm);
      if (!alive.current || version !== revision.current) return;
      setResult({ value, format: mode === 'convert' ? to : 'hex' });
      setNotice(value === '' ? 'Operazione completata. Il risultato è una stringa vuota.' : 'Operazione completata.');
    } catch (cause) {
      if (alive.current && version === revision.current) setError(cause instanceof Error ? cause.message : 'Operazione non riuscita. Riprova.');
    } finally {
      if (alive.current && version === revision.current) { running.current = false; setBusy(false); }
    }
  }
  async function paste() {
    const version = revision.current;
    const ticket = ++clipboardRevision.current;
    try {
      const value = await navigator.clipboard.readText();
      if (!alive.current || version !== revision.current || ticket !== clipboardRevision.current) return;
      changeInput(value); inputRef.current?.focus();
    } catch {
      if (!alive.current || version !== revision.current || ticket !== clipboardRevision.current) return;
      setNotice('Incolla con Ctrl+V nel campo Input'); inputRef.current?.focus();
    }
  }
  async function copy() {
    if (!result) return;
    const version = revision.current;
    const ticket = ++clipboardRevision.current;
    let message = 'Risultato copiato negli appunti.';
    try { await navigator.clipboard.writeText(result.value); }
    catch { message = 'Impossibile copiare. Seleziona il risultato e copialo manualmente.'; }
    if (alive.current && version === revision.current && ticket === clipboardRevision.current) setNotice(message);
  }
  function reuse() {
    if (!result) return;
    changeInput(result.value); setMode('convert'); setFrom(result.format);
    setTo(result.format === 'text' ? 'base64' : 'text'); inputRef.current?.focus();
  }
  function suggest() {
    if (!detected) return;
    invalidate(); setFrom(detected); setTo('text'); setDetected(null);
  }
  const formatOptions = formats.map(format => <option key={format.id} value={format.id}>{format.label}</option>);
  return <section className="codec-tool" aria-labelledby="codec-title">
    <div className="section-heading"><h2 id="codec-title"><Binary aria-hidden="true" /> Codifica e converti</h2></div>
    <p className="codec-private muted"><LockKeyhole aria-hidden="true" /> Elaborazione locale · Nessuna cronologia</p>
    <div className="codec-field">
      <div className="codec-field-heading"><label htmlFor="codec-input">Input</label><span className="codec-count muted">{count} {count === 1 ? 'carattere' : 'caratteri'}</span></div>
      <textarea id="codec-input" ref={inputRef} rows={4} value={input} onChange={event => changeInput(event.target.value)} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-invalid={error ? true : undefined} aria-describedby={error ? 'codec-error' : undefined} placeholder="Scrivi o incolla un valore…" />
      <div className="codec-secondary-actions"><button type="button" className="secondary" onClick={() => void paste()}><Clipboard aria-hidden="true" /> Incolla</button><button type="button" className="secondary" onClick={() => { changeInput(''); inputRef.current?.focus(); }}><Trash2 aria-hidden="true" /> Svuota</button></div>
      {mode === 'convert' && detected && <p className="codec-suggestion muted">Sembra {formats.find(format => format.id === detected)!.label} · <button type="button" className="link-button" onClick={suggest}>Imposta conversione in testo</button></p>}
    </div>
    <div className="codec-tabs" role="tablist" aria-label="Operazione sul testo">{tabs.map((tab, index) => <button key={tab.id} type="button" ref={node => { tabRefs.current[index] = node; }} id={`codec-tab-${tab.id}`} role="tab" aria-selected={mode === tab.id} aria-controls={`codec-panel-${tab.id}`} tabIndex={mode === tab.id ? 0 : -1} onClick={() => changeMode(tab.id)} onKeyDown={event => tabKey(event, index)}>{tab.label}</button>)}</div>
    <div id="codec-panel-convert" role="tabpanel" aria-labelledby="codec-tab-convert" hidden={mode !== 'convert'}>
      <div className="codec-formats">
        <label htmlFor="codec-from">Da<select id="codec-from" value={from} onChange={event => { invalidate(); setFrom(event.target.value as TextFormat); }}>{formatOptions}</select></label>
        <button className="secondary codec-swap" type="button" aria-label="Inverti formati" title="Inverti formati" onClick={() => { invalidate(); setFrom(to); setTo(from); }}><ArrowRightLeft aria-hidden="true" /></button>
        <label htmlFor="codec-to">A<select id="codec-to" value={to} onChange={event => { invalidate(); setTo(event.target.value as TextFormat); }}>{formatOptions}</select></label>
      </div>
      <button type="button" className="codec-submit" disabled={busy} onClick={() => void run()}>{busy ? 'Elaborazione…' : 'Converti'}</button>
    </div>
    <div id="codec-panel-hash" role="tabpanel" aria-labelledby="codec-tab-hash" hidden={mode !== 'hash'}>
      <label htmlFor="codec-algorithm">Algoritmo<select id="codec-algorithm" value={algorithm} onChange={event => { invalidate(); setAlgorithm(event.target.value as HashAlgorithm); }}>{algorithms.map(item => <option key={item}>{item}</option>)}</select></label>
      <p className="codec-hint muted">Calcolato sul testo UTF-8 dell’input</p>
      <button type="button" className="codec-submit" disabled={busy} onClick={() => void run()}>{busy ? 'Elaborazione…' : 'Genera hash'}</button>
    </div>
    {error && <p id="codec-error" className="codec-error" role="alert">{error}</p>}
    <div className="codec-field codec-output" aria-busy={busy}>
      <div className="codec-field-heading"><label htmlFor="codec-result">Risultato</label>{result && <span className="codec-count muted">{formats.find(format => format.id === result.format)!.label}</span>}</div>
      <textarea id="codec-result" rows={4} readOnly spellCheck={false} value={result?.value ?? ''} placeholder={result ? 'Stringa vuota' : 'Il risultato apparirà qui'} />
      <div className="codec-secondary-actions"><button type="button" className="secondary" disabled={!result} onClick={() => void copy()}><Copy aria-hidden="true" /> Copia</button><button type="button" className="secondary" disabled={!result} onClick={reuse}><ArrowUp aria-hidden="true" /> Usa come input</button></div>
    </div>
    <p className="codec-notice muted" role="status">{notice}</p>
  </section>;
}
