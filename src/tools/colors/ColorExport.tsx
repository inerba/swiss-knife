import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { COLOR_FORMATS, formats, type ColorFormat } from './color';
import { exportColors, type ExportMode, type Utility } from './export';

export function ColorExport({ values }: { values: string[] }) {
  const [mode, setMode] = useState<ExportMode>('codes');
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [utility, setUtility] = useState<Utility>('bg');
  const [nearest, setNearest] = useState(false);
  const [feedback, setFeedback] = useState<{ output: string; error?: boolean } | null>(null);
  const output = useMemo(() => exportColors(values, { mode, format, utility, nearest }), [values, mode, format, utility, nearest]);
  const currentFeedback = feedback?.output === output ? feedback : null;
  async function copy() {
    try { await navigator.clipboard.writeText(output); setFeedback({ output }); }
    catch { setFeedback({ output, error: true }); }
  }
  return <section className="colors-export" aria-labelledby="colors-export-heading">
    <div className="colors-section-title"><h4 id="colors-export-heading">Copier la sélection</h4><span className="colors-caption">{values.length} {values.length === 1 ? 'colore' : 'colori'}</span></div>
    <div className="colors-filter-fields">
      <label>Esporta come<select value={mode} onChange={event => setMode(event.target.value as ExportMode)}>
        <option value="codes">Codici colore</option><option value="css">Variabili CSS</option><option value="tailwind">Classi Tailwind</option>
      </select></label>
      {mode !== 'tailwind' ? <label>Formato<select value={format} onChange={event => setFormat(event.target.value as ColorFormat)}>
        {Object.entries(COLOR_FORMATS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label> : <label>Proprietà<select value={utility} onChange={event => setUtility(event.target.value as Utility)}>
        <option value="bg">Sfondo · bg</option><option value="text">Testo · text</option><option value="border">Bordo · border</option><option value="fill">SVG · fill</option><option value="stroke">SVG · stroke</option>
      </select></label>}
    </div>
    {mode === 'tailwind' && <>
      <label className="colors-check"><input type="checkbox" checked={nearest} onChange={event => setNearest(event.target.checked)} />Usa il Tailwind più vicino</label>
      <p className="colors-caption">{nearest ? 'I colori saranno approssimati alla palette Tailwind.' : 'Valori originali, incluse le trasparenze.'} Una classe per riga, da usare separatamente.</p>
    </>}
    {mode !== 'tailwind' && ['hex', 'rgb', 'hsl'].includes(format) && values.some(value => formats(value).outOfGamut) && <p className="colors-caption">Alcuni colori saranno approssimati in sRGB. Usa OKLCH per conservarli.</p>}
    <button type="button" className="colors-primary colors-copy-selection" onClick={() => void copy()}>
      {currentFeedback && !currentFeedback.error ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} Copia {values.length} {values.length === 1 ? 'colore' : 'colori'}
    </button>
    <div className="colors-feedback" role="status">{currentFeedback && !currentFeedback.error ? 'Selezione copiata.' : ''}</div>
    {currentFeedback?.error && <p className="colors-error" role="alert">Copia non riuscita. Apri l’anteprima per copiare il testo manualmente.</p>}
    <details className="colors-disclosure" open={currentFeedback?.error || undefined}>
      <summary>Anteprima del testo</summary><textarea readOnly aria-label="Anteprima esportazione" value={output} rows={5} spellCheck={false} />
    </details>
  </section>;
}
