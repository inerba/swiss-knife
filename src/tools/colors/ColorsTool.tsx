import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, History, MousePointer2, Pipette, Save, Trash2, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { canonical, colorCss, type StoredColor } from './color';
import { addColorHistory, clearColorHistory, COLOR_HISTORY_KEY, loadColorHistory } from './history';
import { ColorEditor, type ColorSelection } from './ColorEditor';
import { ColorCollection, type ColorItem } from './ColorCollection';
import { ColorExport } from './ColorExport';
import { TailwindPalette } from './TailwindPalette';
import { useColorAcquisition } from './useColorAcquisition';
import './colors.css';

const tabs = [{ id: 'history', label: 'Cronologia' }, { id: 'page', label: 'Pagina' }, { id: 'tailwind', label: 'Tailwind' }] as const;
type Tab = typeof tabs[number]['id'];

export function ColorsTool() {
  const [selection, setSelection] = useState<ColorSelection>({ value: '#3b82f6', revision: 0 });
  const [tab, setTab] = useState<Tab>('history');
  const [history, setHistory] = useState<StoredColor[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSelected, setPageSelected] = useState<Set<string>>(new Set());
  const [pageFeedback, setPageFeedback] = useState('');
  const [pageError, setPageError] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const editorInput = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const alive = useRef(true);
  const loadVersion = useRef(0);

  const refreshHistory = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const next = await loadColorHistory();
      if (alive.current && version === loadVersion.current) { setHistory(next); setHistoryError(''); }
    } catch {
      if (alive.current && version === loadVersion.current) setHistoryError('Impossibile leggere la cronologia. Riprova.');
    } finally { if (alive.current && version === loadVersion.current) setHistoryLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true; void refreshHistory();
    const changed = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && changes[COLOR_HISTORY_KEY]) void refreshHistory();
    };
    browser.storage.onChanged.addListener(changed);
    return () => { alive.current = false; loadVersion.current++; browser.storage.onChanged.removeListener(changed); };
  }, [refreshHistory]);
  useEffect(() => { setSelected(old => new Set([...old].filter(id => history.some(item => item.id === id)))); }, [history]);

  const persist = useCallback(async (values: string[]) => {
    if (saveLock.current) throw new Error('Salvataggio già in corso.');
    saveLock.current = true; setSaving(true);
    try {
      const next = await addColorHistory(values);
      if (alive.current) { loadVersion.current++; setHistory(next); setHistoryError(''); setHistoryNotice(''); }
    } finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }, []);
  const captured = useCallback(async (value: string) => {
    setSelection(old => ({ value, revision: old.revision + 1 }));
    await persist([value]);
  }, [persist]);
  const acquisition = useColorAcquisition(captured);
  useEffect(() => {
    setPageSelected(new Set()); setPageFeedback(''); setPageError('');
    if (acquisition.result) setTab('page');
  }, [acquisition.result]);

  function openColor(value: string) {
    setSelection(old => ({ value, revision: old.revision + 1 }));
    editorInput.current?.focus();
    editorInput.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); setTab(tabs[next]!.id); tabRefs.current[next]?.focus();
  }
  function toggle(setter: typeof setSelected, id: string) {
    setter(old => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function clear() {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true); setHistoryError('');
    try {
      await clearColorHistory();
      if (alive.current) { loadVersion.current++; setHistory([]); setSelected(new Set()); setHistoryNotice('Cronologia svuotata.'); }
    } catch { if (alive.current) setHistoryError('Impossibile svuotare la cronologia. Riprova.'); }
    finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }
  const pageItems: ColorItem[] = [];
  const seen = new Set<string>();
  for (const item of acquisition.result?.colors ?? []) {
    try {
      const value = colorCss(item.value); const id = canonical(value);
      if (seen.has(id)) continue;
      seen.add(id); pageItems.push({ id, value, detail: `${item.count} utilizzi · ${item.uses.join(', ')}` });
    } catch { /* Unsupported style values are not actionable color swatches. */ }
  }
  async function savePage() {
    if (!pageSelected.size || pageSelected.size > 50) return;
    const source = acquisition.result;
    const values = pageItems.filter(item => pageSelected.has(item.id)).map(item => item.value);
    try {
      await persist(values);
      if (alive.current && source === acquisition.currentResult.current) {
        setPageSelected(new Set()); setPageError(''); setPageFeedback(`${values.length} ${values.length === 1 ? 'colore salvato' : 'colori salvati'} nella cronologia.`);
      }
    } catch { if (alive.current) setPageError('Salvataggio non riuscito. Riprova.'); }
  }
  const selectedValues = history.filter(item => selected.has(item.id)).map(item => item.value);

  return <section className="colors-tool" aria-label="Strumento colori">
    <header className="colors-heading"><h2>Colori</h2><p>Dal primo campione alla tua palette.</p></header>
    <div className="colors-acquire">
      <button type="button" onClick={() => void acquisition.pickPixel()} disabled={acquisition.busy || saving || !acquisition.hasEyeDropper} aria-describedby={!acquisition.hasEyeDropper ? 'colors-eyedropper-help' : undefined}>
        <Pipette aria-hidden="true" /><span>Contagocce<small>Un punto sullo schermo</small></span>
      </button>
      <button type="button" onClick={() => { setTab('page'); void acquisition.pickElement(); }} disabled={acquisition.busy}>
        <MousePointer2 aria-hidden="true" /><span>Da elemento<small>La palette di un blocco</small></span>
      </button>
    </div>
    {!acquisition.hasEyeDropper && <p id="colors-eyedropper-help" className="colors-caption">Il contagocce non è disponibile. Puoi usare il selettore o incollare un codice.</p>}
    {(acquisition.message || acquisition.busy) && <div className={`colors-acquire-status ${acquisition.error ? 'colors-error' : ''}`}>
      <p role={acquisition.error ? 'alert' : 'status'}>{acquisition.message}</p>
      {acquisition.busy && <button type="button" onClick={acquisition.cancel}><X aria-hidden="true" /> Annulla</button>}
    </div>}
    <ColorEditor selection={selection} inputRef={editorInput} onSave={value => persist([value])} saving={saving} />
    <div className="colors-library">
      <div role="tablist" aria-label="Raccolte di colori" className="colors-tabs">
        {tabs.map((item, index) => <button key={item.id} type="button" role="tab" id={`colors-tab-${item.id}`} aria-controls={`colors-panel-${item.id}`}
          aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} ref={element => { tabRefs.current[index] = element; }}
          onClick={() => setTab(item.id)} onKeyDown={event => tabKey(event, index)}>
          {item.label}{item.id === 'history' && history.length > 0 && <span className="colors-tab-count">{history.length}</span>}
        </button>)}
      </div>
      <div role="tabpanel" id="colors-panel-history" aria-labelledby="colors-tab-history" hidden={tab !== 'history'} tabIndex={0}>
        {historyLoading ? <p className="colors-empty" role="status">Caricamento cronologia…</p> : <>
          {historyError && <div className="colors-error"><p role="alert">{historyError}</p><button onClick={() => void refreshHistory()}>Ricarica cronologia</button></div>}
          {historyNotice && <p className="colors-feedback" role="status">{historyNotice}</p>}
          {!history.length ? <div className="colors-empty"><History aria-hidden="true" /><h3>La tua palette inizia qui</h3><p>Cattura o crea un colore e salvalo.<br />Qui ritroverai gli ultimi 50.</p></div> : <>
            <div className="colors-collection-toolbar">
              <label className="colors-check"><input type="checkbox" checked={selected.size === history.length} onChange={() => setSelected(selected.size === history.length ? new Set() : new Set(history.map(item => item.id)))} />Seleziona tutti</label>
              <button type="button" className="colors-quiet" disabled={saving} onClick={() => void clear()}><Trash2 aria-hidden="true" /> Svuota</button>
            </div>
            <p className="colors-caption">Clicca il campione per modificarlo, spunta per copiarlo.</p>
            <ColorCollection items={history.slice(0, visibleCount)} selected={selected} onToggle={id => toggle(setSelected, id)} onOpen={openColor} />
            {history.length > visibleCount && <button type="button" className="colors-more" onClick={() => setVisibleCount(old => old + 12)}>Mostra altri ({history.length - visibleCount})</button>}
            {!!selectedValues.length && <>
              <div className="colors-selection-bar"><strong>{selectedValues.length} selezionati</strong><button type="button" className="colors-quiet" onClick={() => setSelected(new Set())}>Deseleziona</button></div>
              <ColorExport values={selectedValues} />
            </>}
          </>}
        </>}
      </div>
      <div role="tabpanel" id="colors-panel-page" aria-labelledby="colors-tab-page" hidden={tab !== 'page'} tabIndex={0}>
        {!acquisition.result ? <div className="colors-empty"><MousePointer2 aria-hidden="true" /><h3>I colori di un elemento</h3><p>Premi “Da elemento”, poi scegli un blocco nella pagina. Potrai salvare i colori che ti servono.</p></div> : <>
          <div className="colors-section-title"><h3>{pageItems.length} colori trovati</h3><button className="colors-quiet" disabled={acquisition.busy} onClick={() => void acquisition.pickElement()}>Nuova selezione</button></div>
          {acquisition.result.partial && <p className="colors-warning" role="status">Palette parziale: seleziona un blocco più piccolo per completare l’analisi.</p>}
          {acquisition.result.warnings.map((warning, index) => <p className="colors-warning" key={index}>{warning}</p>)}
          {pageItems.length > 0 ? <>
            <label className="colors-check"><input type="checkbox" checked={pageSelected.size === pageItems.length} onChange={() => setPageSelected(pageSelected.size === pageItems.length ? new Set() : new Set(pageItems.map(item => item.id)))} />Seleziona tutti</label>
            <ColorCollection items={pageItems} selected={pageSelected} onToggle={id => toggle(setPageSelected, id)} onOpen={openColor} />
            <button type="button" className="colors-primary colors-copy-selection" disabled={!pageSelected.size || pageSelected.size > 50 || saving} onClick={() => void savePage()}><Save aria-hidden="true" /> Salva selezionati{pageSelected.size > 0 ? ` (${pageSelected.size})` : ''}</button>
            {pageSelected.size > 50 && <p className="colors-error" role="alert">Scegli al massimo 50 colori per salvarli nella cronologia.</p>}
          </> : <p className="colors-empty">Nessun colore utilizzabile trovato. Prova un altro elemento.</p>}
          {pageFeedback && <p className="colors-feedback" role="status"><Check aria-hidden="true" />{pageFeedback}</p>}
          {pageError && <p className="colors-error" role="alert">{pageError}</p>}
        </>}
      </div>
      <div role="tabpanel" id="colors-panel-tailwind" aria-labelledby="colors-tab-tailwind" hidden={tab !== 'tailwind'} tabIndex={0}>
        {tab === 'tailwind' && <TailwindPalette onOpen={openColor} />}
      </div>
    </div>
  </section>;
}
