import { useEffect, useRef, useState } from 'react';
import { Clipboard, Download, ExternalLink, ScanEye, ShieldCheck, RefreshCw } from 'lucide-react';
import { browser } from 'wxt/browser';
import { activeTab, explainError, openUrl } from '../../lib/browser';
import { initialDetails, readDetails, formatBytes } from './metadata';
import { startSession, type PickerSession } from './session';
import type { MediaCandidate, MediaDetails, MediaSelection } from './types';
import { compactPageUrl, formatDuration, mediaLabels } from './format';
import { bulkDownloadPath, bulkDownloadSummary, downloadUrl } from './download';

type Row = MediaCandidate & { details: MediaDetails; loading: boolean; download?: string; copy?: string };
export function MediaPickerTool() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selection, setSelection] = useState<MediaSelection | null>(null);
  const [status, setStatus] = useState('');
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef<PickerSession | undefined>(undefined);
  const abort = useRef(new AbortController());
  const generation = useRef(0);
  const target = useRef<number | undefined>(undefined);
  const objectUrls = useRef(new Set<string>());
  const downloads = useRef(new Map<number, { id: string; generation: number }>());
  const selectionReady = useRef(false);

  function clear() {
    generation.current++; abort.current.abort(); session.current?.close(); session.current = undefined;
    abort.current = new AbortController(); target.current = undefined; selectionReady.current = false;
    objectUrls.current.forEach(url => URL.revokeObjectURL(url)); objectUrls.current.clear();
    downloads.current.clear();
    setBulk(''); setBusy(false);
  }
  function patch(id: string, update: Partial<Row>) { setRows(old => old.map(row => row.id === id ? { ...row, ...update } : row)); }
  async function enrich(image: MediaCandidate, gen: number) {
    const signal = abort.current.signal;
    patch(image.id, { loading: true });
    try {
      const details = await readDetails(image, signal, id => session.current ? session.current.readBlob(id) : Promise.reject(new Error('Documento non disponibile.')));
      if (gen !== generation.current) { if (details.objectUrl) URL.revokeObjectURL(details.objectUrl); return; }
      if (details.objectUrl) objectUrls.current.add(details.objectUrl);
      setRows(old => old.map(row => {
        if (row.id !== image.id) return row;
        if (row.details.objectUrl) { URL.revokeObjectURL(row.details.objectUrl); objectUrls.current.delete(row.details.objectUrl); }
        return { ...row, details, loading: false };
      }));
    } catch (error) { if (gen === generation.current) patch(image.id, { loading: false, details: { ...initialDetails(image), error: String(error) } }); }
  }
  async function start() {
    clear(); setRows([]); setSelection(null); setStatus('Avvio del selettore…');
    const gen = generation.current;
    try {
      const tab = await activeTab();
      if (gen !== generation.current) return;
      target.current = tab.id;
      const connected = await startSession(tab.id, abort.current.signal, result => {
        if (gen !== generation.current || selectionReady.current) return;
        selectionReady.current = true; setSelection(result);
        setRows(result.images.map(image => ({ ...image, details: initialDetails(image), loading: true })));
        setStatus(result.images.length ? `${result.images.length} file multimediali trovati. Recupero automatico dei metadati.` : 'Nessun file multimediale trovato nell’elemento selezionato.');
        let next = 0;
        const worker = async () => {
          while (next < result.images.length && gen === generation.current) await enrich(result.images[next++]!, gen);
        };
        void Promise.all([worker(), worker(), worker()]);
      }, message => {
        if (gen !== generation.current) return;
        if (message.startsWith('Connessione')) { clear(); setRows([]); setSelection(null); }
        setStatus(message);
      });
      if (gen !== generation.current) connected.close(); else session.current = connected;
    } catch (error) { if (gen === generation.current) setStatus(explainError(error).replace('premi Aggiorna', 'premi Nuova selezione')); }
  }
  async function authorize(row: Row) {
    const gen = generation.current;
    patch(row.id, { loading: true });
    try {
      // Must be called synchronously from the click, before any await.
      const granted = await browser.permissions.request({ origins: [row.details.permission!] });
      if (gen !== generation.current) return;
      if (granted) {
        const waiting = rows.filter(item => item.details.permission === row.details.permission);
        let next = 0;
        const worker = async () => { while (next < waiting.length && gen === generation.current) await enrich(waiting[next++]!, gen); };
        await Promise.all([worker(), worker(), worker()]);
      } else patch(row.id, { loading: false, details: { ...row.details, error: 'Autorizzazione negata. I dati disponibili restano visibili.' } });
    } catch (error) { if (gen === generation.current) patch(row.id, { loading: false, details: { ...row.details, error: explainError(error) } }); }
  }
  async function download(row: Row) {
    const gen = generation.current;
    patch(row.id, { download: 'Scelta della destinazione…' });
    try {
      const url = downloadUrl(row);
      if (!url) throw new Error('Recupera prima il file temporaneo con Riprova metadati. Gli stream MediaSource non sono file scaricabili.');
      const id = await browser.downloads.download({ url, filename: row.details.filename, saveAs: true, conflictAction: 'uniquify' });
      if (gen !== generation.current) return;
      downloads.current.set(id, { id: row.id, generation: gen });
      patch(row.id, { download: 'Download avviato…' });
      const [item] = await browser.downloads.search({ id });
      if (gen === generation.current && item?.state === 'complete') patch(row.id, { download: 'Download completato.' });
      if (gen === generation.current && item?.state === 'interrupted') patch(row.id, { download: `Download interrotto: ${item.error || 'riprova'}.` });
    } catch (error) { if (gen === generation.current) patch(row.id, { download: `Download non riuscito: ${explainError(error)}` }); }
  }
  async function downloadAll() {
    const gen = generation.current;
    const queued = rows.filter(row => downloadUrl(row));
    const skipped = rows.filter(row => !downloadUrl(row));
    skipped.forEach(row => patch(row.id, { download: 'File temporaneo non recuperato: non incluso nel download di gruppo.' }));
    if (!queued.length) { setBulk(bulkDownloadSummary(0, 0, skipped.length)); return; }
    setBusy(true); setBulk('Avvio dei download…');
    let started = 0; let failed = 0;
    try {
      for (const row of queued) {
        if (gen !== generation.current) return;
        patch(row.id, { download: 'Download avviato…' });
        try {
          const id = await browser.downloads.download({
            url: downloadUrl(row)!,
            filename: bulkDownloadPath(row.details.filename, selection?.pageUrl || ''),
            saveAs: false,
            conflictAction: 'uniquify',
          });
          if (gen !== generation.current) return;
          downloads.current.set(id, { id: row.id, generation: gen });
          started++;
          setBulk(`Download avviati: ${started}/${queued.length}…`);
        } catch (error) {
          failed++;
          if (gen === generation.current) patch(row.id, { download: `Download non riuscito: ${explainError(error)}` });
        }
      }
      if (gen === generation.current) setBulk(bulkDownloadSummary(started, failed, skipped.length));
    } finally { if (gen === generation.current) setBusy(false); }
  }
  async function copy(row: Row) {
    const blob = row.details.blob;
    if (!blob) return;
    patch(row.id, { copy: 'Copia in corso…' });
    try {
      if (row.details.mime === 'image/svg+xml') {
        await navigator.clipboard.writeText(await blob.text());
        patch(row.id, { copy: 'Codice SVG copiato negli appunti.' });
        return;
      }
      if (row.details.kind !== 'image' || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Questo file non può essere copiato come immagine dagli appunti di Chrome.');
      }
      const supported = typeof ClipboardItem.supports !== 'function' || ClipboardItem.supports(blob.type);
      if (!supported) throw new Error('Questo formato immagine non è copiabile direttamente negli appunti di Chrome.');
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      patch(row.id, { copy: 'Immagine copiata negli appunti.' });
    } catch (error) {
      patch(row.id, { copy: `Copia non riuscita: ${explainError(error)}` });
    }
  }
  useEffect(() => {
    let windowId: number | undefined;
    void (async () => { try { windowId = (await browser.windows.getCurrent()).id; } catch { /* Invalidate conservatively. */ } })();
    const invalidate = () => { clear(); setRows([]); setSelection(null); setStatus('Scheda cambiata. Avvia lo strumento per lavorare su questa pagina.'); };
    const activated = (info: { windowId: number }) => { if (windowId === undefined || info.windowId === windowId) invalidate(); };
    const updated = (id: number, info: { status?: string; url?: string }) => { if (id === target.current && (info.status === 'loading' || info.url)) invalidate(); };
    const removed = (id: number) => { if (id === target.current) invalidate(); };
    const downloaded = (delta: { id: number; state?: { current?: string }; error?: { current?: string } }) => {
      const job = downloads.current.get(delta.id);
      if (!job || job.generation !== generation.current) return;
      if (delta.state?.current === 'complete') patch(job.id, { download: 'Download completato.' });
      else if (delta.state?.current === 'interrupted' || delta.error) patch(job.id, { download: `Download interrotto: ${delta.error?.current || 'riprova'}.` });
    };
    browser.tabs.onActivated.addListener(activated); browser.tabs.onUpdated.addListener(updated); browser.tabs.onRemoved.addListener(removed);
    browser.downloads.onChanged.addListener(downloaded);
    window.addEventListener('pagehide', clear);
    void start();
    return () => {
      clear(); window.removeEventListener('pagehide', clear);
      browser.tabs.onActivated.removeListener(activated); browser.tabs.onUpdated.removeListener(updated); browser.tabs.onRemoved.removeListener(removed);
      browser.downloads.onChanged.removeListener(downloaded);
    };
  }, []);

  return <section>
    <div className="section-heading"><h2>Cattura file multimediali</h2><button onClick={() => void start()}><ScanEye aria-hidden="true" /> Nuova selezione</button></div>
    <p className="muted">Seleziona un elemento e tutti i file al suo interno: immagini, video e audio. Usa ↑ per ampliare al contenitore e ↓ per restringere.</p>
    <div role="status" className="status">{rows.length && rows.every(row => !row.loading) ? `${rows.length} file multimediali trovati. ${rows.some(row => row.details.error || row.details.notice) ? 'Alcuni metadati o anteprime non sono disponibili.' : 'Metadati recuperati.'}` : status}</div>
    {!selection && <button onClick={() => { clear(); setStatus('Selezione annullata. Premi Nuova selezione.'); }}>Annulla selezione</button>}
    {selection && <p className="source">Pagina analizzata <span className="source-compact" title={selection.pageUrl}>{compactPageUrl(selection.pageUrl)}</span></p>}
    {selection?.warnings.map(warning => <p className="notice" key={warning}>{warning}</p>)}
    {rows.length > 1 && <div className="image-actions results-toolbar">
      <button
        onClick={() => void downloadAll()}
        disabled={busy || rows.some(row => row.loading) || !rows.some(row => downloadUrl(row))}
        title={rows.some(row => row.loading) ? 'Attendi il recupero dei metadati.' : undefined}
      ><Download aria-hidden="true" /> Scarica tutti</button>
    </div>}
    {bulk && <p role="status" className="muted">{bulk}</p>}
    <ol className="results">{rows.map(row => <li className="frame-card" key={row.id}>
      <div className="image-preview">{row.details.objectUrl && row.details.verified ? (
        row.details.kind === 'video' ? <video src={row.details.objectUrl} controls preload="metadata" aria-label={`Anteprima di ${row.details.filename}`} /> :
        row.details.kind === 'audio' ? <audio src={row.details.objectUrl} controls preload="metadata" aria-label={`Anteprima di ${row.details.filename}`} /> :
        <img src={row.details.objectUrl} alt={`Anteprima di ${row.details.filename}`} />
      ) : <span className="muted">{row.loading ? 'Caricamento anteprima…' : mediaLabels[row.details.kind || row.kind || 'image']}</span>}</div>
      <h3>{row.details.filename}</h3>
      <span className="badge">{mediaLabels[row.details.kind || row.kind || 'image']}</span>
      <p className="muted">{row.sources.join(' · ')}</p>
      <dl className="image-metadata">
        <dt>Estensione del nome</dt><dd>{row.details.extension || 'Non disponibile'}</dd>
        <dt>Formato del file (MIME)</dt><dd>{row.details.mime || 'Non disponibile'}</dd>
        {['image', 'video'].includes(row.details.kind || 'image') && <><dt>Risoluzione</dt><dd>{row.details.width && row.details.height ? `${row.details.width} × ${row.details.height} px` : 'Non disponibile'}{row.details.width ? <small>{row.details.verified ? 'Verificata sul file' : 'Letta dalla pagina'}</small> : null}</dd></>}
        {['video', 'audio'].includes(row.details.kind || '') && <><dt>Durata</dt><dd>{formatDuration(row.details.duration)}</dd></>}
        <dt>Peso del file</dt><dd>{formatBytes(row.details.size)}{row.details.size !== null && <small>{row.details.size.toLocaleString('it-IT')} byte</small>}</dd>
      </dl>
      <details className="media-url"><summary>URL del file</summary>{/^https?:/i.test(row.url) ? <a className="url" href={row.url} title={row.url} aria-label={`Apri o copia URL completo: ${row.url}`} target="_blank" rel="noreferrer">{row.url}</a> : <p className="url-description">{row.url.startsWith('data:') ? 'Contenuto incorporato: il codice non viene visualizzato.' : 'File temporaneo della pagina: l’indirizzo non viene visualizzato.'}</p>}</details>
      {row.details.error && <p className="notice">{row.details.error}</p>}
      {row.details.notice && <p className="notice">{row.details.notice}</p>}
      <div className="image-actions">
        <button onClick={() => void download(row)} disabled={busy || row.download === 'Scelta della destinazione…' || row.download === 'Download avviato…'}><Download aria-hidden="true" /> {row.details.kind === 'stream' ? 'Scarica playlist' : 'Scarica'}</button>
        {row.details.blob && (row.details.mime === 'image/svg+xml' || row.details.kind === 'image') && <button onClick={() => void copy(row)} disabled={row.copy === 'Copia in corso…'}><Clipboard aria-hidden="true" /> Copia</button>}
        <button disabled={!/^https?:/.test(row.url) && !row.details.objectUrl} onClick={() => void (async () => {
          try {
            if (/^https?:/.test(row.url)) await openUrl(row.url);
            else if (row.details.objectUrl) {
              // Keep the source panel alive until the temporary image is loaded.
              await browser.tabs.create({ url: row.details.objectUrl, active: false });
              patch(row.id, { download: 'Originale aperto in una nuova scheda.' });
            }
          } catch (error) { patch(row.id, { download: explainError(error) }); }
        })()}><ExternalLink aria-hidden="true" /> Apri originale</button>
        {row.details.permission ? <button disabled={row.loading} onClick={() => void authorize(row)}><ShieldCheck aria-hidden="true" /> Autorizza e completa</button> : row.details.error && <button disabled={row.loading} onClick={() => void enrich(row, generation.current)}><RefreshCw aria-hidden="true" /> Riprova metadati</button>}
      </div>
      <p role="status" className="muted">{row.loading ? 'Recupero metadati…' : row.copy || row.download}</p>
    </li>)}</ol>
    <p className="footnote">Sono inclusi i file del contenitore selezionato e i livelli sovrapposti nel punto scelto. Iframe di altri domini e shadow root chiusi non sono ispezionabili. Stream live, DRM e segmenti HLS/DASH non vengono ricostruiti. Recupero automatico fino a 32 MiB per file; per file HTTP/HTTPS più grandi resta il download originale.</p>
  </section>;
}
