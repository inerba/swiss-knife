import { useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { browser } from 'wxt/browser';
import { activeTab, explainError, openUrl } from '../../lib/browser';
import { scanIframes, type ScanResult } from './scan';

export function IframeTool() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const target = useRef<number | null>(null);

  async function scan() {
    const generation = ++request.current;
    setLoading(true); setResult(null); setMessage('');
    try {
      const tab = await activeTab();
      if (generation !== request.current) return;
      target.current = tab.id;
      const [injection] = await browser.scripting.executeScript({ target: { tabId: tab.id }, func: scanIframes });
      if (generation !== request.current) return;
      if (!injection?.result) throw new Error('La pagina non ha restituito risultati. Riprova.');
      setResult(injection.result);
    } catch (error) {
      if (generation === request.current) setMessage(explainError(error));
    } finally {
      if (generation === request.current) setLoading(false);
    }
  }

  useEffect(() => {
    let windowId: number | undefined;
    void browser.windows.getCurrent().then(win => { windowId = win.id; });
    const invalidate = () => {
      request.current++; target.current = null;
      setResult(null); setLoading(false);
      setMessage('Scheda cambiata. Avvia lo strumento per lavorare su questa pagina.');
    };
    const activated = (info: { windowId: number }) => {
      if (windowId === undefined || info.windowId === windowId) invalidate();
    };
    const updated = (id: number, info: { status?: string; url?: string }) => {
      if (id === target.current && (info.status === 'loading' || info.url)) invalidate();
    };
    const removed = (id: number) => { if (id === target.current) invalidate(); };
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    void scan();
    return () => {
      request.current++;
      browser.tabs.onActivated.removeListener(activated);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
    };
  }, []);

  return <section>
    <div className="section-heading"><h2>Elenca iframe</h2><button onClick={() => void scan()} disabled={loading}><RefreshCw aria-hidden="true" /> Aggiorna</button></div>
    <p className="muted">Esplora i contenuti incorporati nella pagina.</p>
    <div role="status" className="status">{loading ? 'Scansione in corso…' : message || (result ? `${result.frames.length} iframe trovati.` : '')}</div>
    {result && <>
      <p className="source">Pagina analizzata <span>{result.pageUrl}</span></p>
      {result.inaccessibleCount > 0 && <p className="notice">Scansione parziale: {result.inaccessibleCount} iframe con contenuto non accessibile o non ancora caricato. Gli iframe annidati al loro interno non sono elencati.</p>}
      {result.frames.length === 0 ? <div className="empty">Nessun iframe trovato nei documenti accessibili.</div> : <ol className="results">
        {result.frames.map(frame => <li key={frame.id} className="frame-card">
          <div className="frame-heading"><h3>{frame.title}</h3><span className="badge">Livello {frame.depth}</span></div>
          <p className="eyebrow">URL sorgente</p><p className="url">{frame.url || '—'}</p>
          {frame.reason && <p className="muted" id={`reason-${frame.id}`}>{frame.reason}</p>}
          {frame.inaccessible && <p className="muted">Contenuto interno non ispezionabile.</p>}
          <button className="open" disabled={!!frame.reason} aria-describedby={frame.reason ? `reason-${frame.id}` : undefined}
            aria-label={`Apri ${frame.title} in una nuova scheda`}
            onClick={() => void openUrl(frame.url).catch(error => setMessage(explainError(error)))}>Apri <ExternalLink aria-hidden="true" /></button>
        </li>)}
      </ol>}
      <p className="footnote">L’URL sorgente può differire dalla destinazione dopo un redirect. Sono inclusi gli shadow root aperti; quelli chiusi non sono accessibili.</p>
    </>}
  </section>;
}
