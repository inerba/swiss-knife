import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Check, Copy, Save, SlidersHorizontal } from 'lucide-react';
import { COLOR_FORMATS, colorCss, formats, opaqueHex, parseColor, tailwindClosest, TAILWIND_COLORS, type ColorFormat } from './color';
import { ColorSwatch } from './ColorSwatch';

export interface ColorSelection { value: string; revision: number }
interface Props {
  selection: ColorSelection;
  inputRef: RefObject<HTMLInputElement | null>;
  onSave: (value: string) => Promise<void>;
  saving: boolean;
}
export function ColorEditor({ selection, inputRef, onSave, saving }: Props) {
  const [value, setValue] = useState(selection.value);
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [text, setText] = useState(formats(selection.value).hex);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const parsed = useMemo(() => formats(value), [value]);
  const match = useMemo(() => tailwindClosest(value, TAILWIND_COLORS), [value]);
  const color = parseColor(value);
  const hsl = color.to('srgb').toGamut({ space: 'srgb', method: 'css' }).to('hsl');

  useEffect(() => {
    setValue(selection.value);
    // Display the original gamut when needed instead of silently reducing to HEX.
    const nextFormat = formats(selection.value).outOfGamut ? 'oklch' : 'hex';
    setFormat(nextFormat); setText(formats(selection.value)[nextFormat]);
    setError(''); setActionError(''); setFeedback('');
  }, [selection]);

  function change(next: string) {
    const normalized = colorCss(next);
    setValue(normalized); setText(formats(normalized)[format]);
    setError(''); setFeedback(''); setActionError('');
  }
  function validate() {
    try {
      const normalized = colorCss(text);
      setValue(normalized); setError(''); return normalized;
    } catch {
      setError('Colore non valido. Usa ad esempio #3b82f6 o rgb(59 130 246).');
      return null;
    }
  }
  function editText(next: string) {
    setText(next); setError(''); setFeedback(''); setActionError('');
    try { setValue(colorCss(next)); } catch { /* Keep the last valid preview while typing. */ }
  }
  async function save() {
    const valid = validate();
    if (!valid) { inputRef.current?.focus(); return; }
    try { await onSave(valid); setActionError(''); setFeedback('Salvato nella cronologia.'); }
    catch { setFeedback(''); setActionError('Salvataggio non riuscito. Riprova.'); }
  }
  async function copy() {
    const valid = validate();
    if (!valid) { inputRef.current?.focus(); return; }
    try { await navigator.clipboard.writeText(formats(valid)[format]); setActionError(''); setFeedback(`${COLOR_FORMATS[format]} copiato.`); }
    catch { setFeedback(''); setActionError('Copia non riuscita. Puoi selezionare e copiare il codice dal campo.'); }
  }
  function adjust(channel: number, next: number) {
    if (channel === 3) { color.alpha = next / 100; change(color.toString({ precision: 8 })); }
    else { hsl.coords[channel] = next; change(hsl.toString({ precision: 8 })); }
  }

  return <section className="colors-editor" aria-labelledby="colors-editor-heading">
    <div className="colors-section-title"><h3 id="colors-editor-heading">Colore attuale</h3><span className="colors-caption">Modifica e converti</span></div>
    <div className="colors-editor-fields">
      <label className="colors-native-picker" title="Apri il selettore colore">
        <ColorSwatch value={value} />
        <input type="color" value={opaqueHex(value)} aria-label="Selettore colore sRGB" onChange={event => {
          const next = parseColor(event.target.value); next.alpha = color.alpha; change(next.toString({ precision: 8 }));
        }} />
      </label>
      <div className="colors-value-field">
        <div className="colors-field-heading"><label htmlFor="colors-code">Codice colore</label>
          <select aria-label="Formato del colore" value={format} onChange={event => {
            const valid = validate();
            if (!valid) { inputRef.current?.focus(); return; }
            const next = event.target.value as ColorFormat; setFormat(next); setText(formats(valid)[next]); setFeedback('');
          }}>{Object.entries(COLOR_FORMATS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        </div>
        <input ref={inputRef} id="colors-code" className="colors-code" spellCheck={false} autoComplete="off"
          value={text} aria-invalid={!!error} aria-describedby={error ? 'colors-code-error' : 'colors-code-help'}
          onChange={event => editText(event.target.value)} onBlur={validate}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void copy(); } }} />
      </div>
    </div>
    <p id="colors-code-help" className="visually-hidden">Puoi incollare qualsiasi formato CSS. Invio copia il colore nel formato scelto.</p>
    {error && <p id="colors-code-error" role="alert" className="colors-error">{error}</p>}
    {parsed.outOfGamut && <p className="colors-caption">HEX, RGB e HSL sono approssimazioni sRGB. L’originale è conservato.</p>}
    <div className="colors-editor-actions">
      <button type="button" className="colors-primary" onClick={() => void copy()}><Copy aria-hidden="true" /> Copia {COLOR_FORMATS[format]}</button>
      <button type="button" disabled={saving} onClick={() => void save()}><Save aria-hidden="true" /> {saving ? 'Salvataggio…' : 'Salva colore'}</button>
    </div>
    <div className="colors-feedback" role="status">{feedback && <><Check aria-hidden="true" />{feedback}</>}</div>
    {actionError && <p className="colors-error" role="alert">{actionError}</p>}
    <div className="colors-match">
      <ColorSwatch value={match.entry.value} />
      <div><span className="colors-caption">Tailwind più vicino</span><strong>{match.entry.name}</strong></div>
      <button type="button" className="colors-quiet" aria-label={`Usa ${match.entry.name}`} onClick={() => change(match.entry.value)}>Usa</button>
    </div>
    {color.alpha < 1 && <p className="colors-caption">L’abbinamento confronta il colore senza opacità.</p>}
    <details className="colors-disclosure">
      <summary><SlidersHorizontal aria-hidden="true" /> Regola colore</summary>
      <div className="colors-sliders">
        {['Tonalità', 'Saturazione', 'Luminosità', 'Opacità'].map((name, index) => {
          const current = index === 3 ? color.alpha * 100 : Number(hsl.coords[index]) || 0;
          return <div className="colors-slider" key={name}>
            <label htmlFor={`colors-slider-${index}`}>{name}</label><output>{Math.round(current)}{index === 0 ? '°' : '%'}</output>
            <input type="range" id={`colors-slider-${index}`} min="0" max={index === 0 ? 360 : 100} step="1" value={current}
              aria-valuetext={`${Math.round(current)}${index === 0 ? ' gradi' : ' percento'}`} onChange={event => adjust(index, Number(event.target.value))} />
          </div>;
        })}
        {parsed.outOfGamut && <p className="colors-caption">Le regolazioni HSL convertono il colore in sRGB.</p>}
      </div>
    </details>
  </section>;
}
