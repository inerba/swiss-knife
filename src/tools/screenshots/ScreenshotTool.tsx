import { useEffect, useRef, useState } from 'react';
import { Camera, Crop, Download, Monitor, ScanLine } from 'lucide-react';
import { browser } from 'wxt/browser';
import { activeTab, explainError } from '../../lib/browser';
import { assertCanvasSize, chooseRectangle, convertScreenshot, cropScreenshot, encodeCanvas, fullPageOutputScale, moveTo, outerWidthForViewport, preparePageCapture, readPageSize, restorePageCapture, screenshotFilename, screenshotFormats, screenshotScale, setAffixedHidden, type PageSize, type ScreenshotFormat } from './capture';

type Mode = 'pagina' | 'schermata' | 'selezione';
type Destination = 'download' | 'clipboard';

export function ScreenshotTool() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageWidth, setPageWidth] = useState('');
  const [format, setFormat] = useState<ScreenshotFormat>('image/png');
  const [destination, setDestination] = useState<Destination>('download');
  const request = useRef(0);
  const target = useRef<number | null>(null);

  async function captureVisible(windowId: number) {
    return browser.tabs.captureVisibleTab(windowId, { format: 'png' });
  }
  async function deliver(dataUrl: string, mode: Mode, selectedFormat: ScreenshotFormat, selectedDestination: Destination) {
    if (selectedDestination === 'download') {
      await browser.downloads.download({ url: dataUrl, filename: screenshotFilename(mode, selectedFormat), saveAs: true, conflictAction: 'uniquify' });
      return;
    }
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Gli appunti immagini non sono disponibili in questa versione di Chrome.');
    if (typeof ClipboardItem.supports === 'function' && !ClipboardItem.supports(selectedFormat)) {
      throw new Error(`Chrome non può copiare immagini ${selectedFormat.replace('image/', '').toUpperCase()} negli appunti. Scegli PNG oppure salva il file.`);
    }
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [selectedFormat]: blob })]);
  }
  async function resizeViewport(tabId: number, windowId: number, targetWidth: number) {
    const original = await browser.windows.get(windowId);
    const restore = async () => {
      if (original.state && original.state !== 'normal') await browser.windows.update(windowId, { state: original.state });
      else if (original.left != null && original.top != null && original.width != null && original.height != null) {
        await browser.windows.update(windowId, { state: 'normal', left: original.left, top: original.top, width: original.width, height: original.height });
      } else await browser.windows.update(windowId, { state: 'normal' });
    };
    try {
      if (original.state && original.state !== 'normal') await browser.windows.update(windowId, { state: 'normal' });
      for (let attempt = 0; attempt < 4; attempt++) {
        const [measurement] = await browser.scripting.executeScript({ target: { tabId }, func: readPageSize });
        const viewportWidth = measurement?.result?.viewportWidth;
        if (!viewportWidth) throw new Error('Impossibile misurare la larghezza della pagina.');
        if (Math.abs(viewportWidth - targetWidth) <= 1) return restore;
        const current = await browser.windows.get(windowId);
        if (!current.width) throw new Error('Chrome non ha restituito la larghezza della finestra.');
        await browser.windows.update(windowId, { width: outerWidthForViewport(current.width, viewportWidth, targetWidth) });
        await new Promise<void>(resolve => setTimeout(resolve, 120));
      }
      const [verification] = await browser.scripting.executeScript({ target: { tabId }, func: readPageSize });
      const actual = verification?.result?.viewportWidth;
      if (!actual || Math.abs(actual - targetWidth) > 1) throw new Error(`Chrome non riesce a impostare un viewport largo ${targetWidth} px su questo schermo.`);
      return restore;
    } catch (error) {
      await restore().catch(() => undefined);
      throw error;
    }
  }
  async function screenshotPage(tabId: number, windowId: number, generation: number, requestedWidth: number | null, selectedFormat: ScreenshotFormat, selectedDestination: Destination) {
    const [originResult] = await browser.scripting.executeScript({ target: { tabId }, func: readPageSize });
    const origin = originResult?.result as PageSize | undefined;
    if (!origin) throw new Error('Impossibile leggere le dimensioni della pagina. Riprova.');
    let restoreViewport: (() => Promise<void>) | undefined;
    let session: string | undefined;
    try {
      if (requestedWidth) restoreViewport = await resizeViewport(tabId, windowId, requestedWidth);
      const [sizeResult] = await browser.scripting.executeScript({ target: { tabId }, func: readPageSize });
      const size = sizeResult?.result as PageSize | undefined;
      if (!size) throw new Error('Impossibile leggere le dimensioni della pagina. Riprova.');
      session = crypto.randomUUID();
      await browser.scripting.executeScript({ target: { tabId }, func: preparePageCapture, args: [session] });
      let page = size;
      const tiles = new Map<string, { x: number; y: number; image: string }>();
      let lastCapture = 0;
      const captureTile = async () => {
        // Chrome limits captureVisibleTab to two calls per second.
        const wait = Math.max(0, 510 - (Date.now() - lastCapture));
        if (wait) await new Promise<void>(resolve => setTimeout(resolve, wait));
        const image = await captureVisible(windowId);
        lastCapture = Date.now();
        return image;
      };
      let firstTile = true;
      let y = 0;
      while (y < page.height) {
        let x = 0;
        while (x < page.width) {
          if (generation !== request.current) return;
          const [position] = await browser.scripting.executeScript({ target: { tabId }, func: moveTo, args: [x, y] });
          const point = position?.result;
          if (!point) throw new Error('La pagina è cambiata durante la cattura. Riprova.');
          if (!firstTile) {
            await browser.scripting.executeScript({ target: { tabId }, func: setAffixedHidden, args: [session, true] });
            await browser.scripting.executeScript({ target: { tabId }, func: moveTo, args: [point.x, point.y] });
          }
          const key = `${point.x}:${point.y}`;
          if (!tiles.has(key)) tiles.set(key, { x: point.x, y: point.y, image: await captureTile() });
          firstTile = false;
          x += page.viewportWidth;
        }
        const [latest] = await browser.scripting.executeScript({ target: { tabId }, func: readPageSize });
        if (latest?.result) {
          const next = latest.result as PageSize;
          page = { ...page, width: Math.max(page.width, next.width), height: Math.max(page.height, next.height) };
          assertCanvasSize(Math.ceil(page.width * page.devicePixelRatio), Math.ceil(page.height * page.devicePixelRatio));
        }
        y += page.viewportHeight;
      }
      const first = tiles.values().next().value as { image: string } | undefined;
      if (!first) throw new Error('La pagina non ha prodotto riquadri catturabili. Riprova.');
      const probe = new Image(); probe.src = first.image; await probe.decode();
      const captureScale = screenshotScale(probe.naturalWidth, page.viewportWidth);
      const outputScale = fullPageOutputScale(captureScale, requestedWidth, page.viewportWidth);
      assertCanvasSize(Math.ceil(page.width * outputScale), Math.ceil(page.height * outputScale));
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(page.width * outputScale); canvas.height = Math.ceil(page.height * outputScale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Impossibile comporre lo screenshot completo.');
      if (selectedFormat === 'image/jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
      for (const tile of tiles.values()) {
        if (generation !== request.current) return;
        const image = new Image(); image.src = tile.image; await image.decode();
        context.drawImage(image, Math.round(tile.x * outputScale), Math.round(tile.y * outputScale), Math.round(image.naturalWidth * outputScale / captureScale), Math.round(image.naturalHeight * outputScale / captureScale));
      }
      if (generation === request.current) await deliver(encodeCanvas(canvas, selectedFormat), 'pagina', selectedFormat, selectedDestination);
    } finally {
      if (session) await browser.scripting.executeScript({ target: { tabId }, func: restorePageCapture, args: [session] }).catch(() => undefined);
      if (restoreViewport) await restoreViewport().catch(() => undefined);
      await browser.scripting.executeScript({ target: { tabId }, func: moveTo, args: [origin.scrollX, origin.scrollY] }).catch(() => undefined);
    }
  }
  async function start(mode: Mode) {
    const requestedWidth = pageWidth.trim() ? Number(pageWidth) : null;
    if (mode === 'pagina' && requestedWidth !== null && (!Number.isInteger(requestedWidth) || requestedWidth < 320 || requestedWidth > 2560)) {
      setStatus('Inserisci una larghezza intera tra 320 e 2560 px, oppure lascia il campo vuoto per usare quella attuale.');
      return;
    }
    const generation = ++request.current;
    const selectedFormat = format;
    const selectedDestination = destination;
    setBusy(true); setStatus(mode === 'selezione' ? 'Disegna il rettangolo nella pagina…' : 'Cattura in corso…');
    try {
      const tab = await activeTab();
      if (generation !== request.current) return;
      if (tab.windowId == null) throw new Error('Finestra di Chrome non disponibile. Riprova.');
      target.current = tab.id;
      if (mode === 'pagina') await screenshotPage(tab.id, tab.windowId, generation, requestedWidth, selectedFormat, selectedDestination);
      else if (mode === 'schermata') {
        const image = await convertScreenshot(await captureVisible(tab.windowId), selectedFormat);
        if (generation !== request.current) return;
        await deliver(image, mode, selectedFormat, selectedDestination);
      }
      else {
        const [selection] = await browser.scripting.executeScript({ target: { tabId: tab.id }, func: chooseRectangle });
        if (generation !== request.current) return;
        if (!selection?.result) { setStatus('Selezione annullata.'); return; }
        setStatus('Preparazione dello screenshot selezionato…');
        const image = await captureVisible(tab.windowId);
        if (generation !== request.current) return;
        const cropped = await cropScreenshot(image, selection.result, selectedFormat);
        if (generation !== request.current) return;
        await deliver(cropped, mode, selectedFormat, selectedDestination);
      }
      if (generation === request.current) setStatus(selectedDestination === 'download' ? 'Download avviato: scegli dove salvare lo screenshot.' : 'Screenshot copiato negli appunti.');
    } catch (error) {
      if (generation === request.current) setStatus(`Screenshot non riuscito: ${explainError(error)}`);
    } finally { if (generation === request.current) setBusy(false); }
  }
  useEffect(() => {
    let windowId: number | undefined;
    void browser.windows.getCurrent().then(item => { windowId = item.id; });
    const invalidate = () => { request.current++; target.current = null; setBusy(false); setStatus('Scheda cambiata. Avvia lo strumento per lavorare su questa pagina.'); };
    const activated = (info: { windowId: number }) => { if (windowId === undefined || info.windowId === windowId) invalidate(); };
    const updated = (id: number, info: { status?: string; url?: string }) => { if (id === target.current && (info.status === 'loading' || info.url)) invalidate(); };
    browser.tabs.onActivated.addListener(activated); browser.tabs.onUpdated.addListener(updated);
    return () => { request.current++; browser.tabs.onActivated.removeListener(activated); browser.tabs.onUpdated.removeListener(updated); };
  }, []);
  return <section>
    <div className="section-heading"><h2>Screenshot</h2><Camera aria-hidden="true" /></div>
    <p className="muted">Scarica la pagina intera, la parte visibile oppure un rettangolo scelto direttamente nella pagina.</p>
    <label htmlFor="screenshot-page-width">Larghezza della pagina intera</label>
    <p id="screenshot-page-width-hint" className="muted screenshot-width-hint">Determina il layout responsive della pagina. Lascia vuoto per usare la larghezza attuale.</p>
    <div className="screenshot-width">
      <input id="screenshot-page-width" type="number" inputMode="numeric" min="320" max="2560" step="1" value={pageWidth} onChange={event => setPageWidth(event.target.value)} placeholder="Attuale" aria-describedby="screenshot-page-width-hint" />
      <span>px</span>
    </div>
    <div className="screenshot-presets" aria-label="Larghezze rapide">
      <button type="button" disabled={busy} onClick={() => setPageWidth('400')}>Mobile 400</button>
      <button type="button" disabled={busy} onClick={() => setPageWidth('1080')}>Desktop 1080</button>
      <button type="button" disabled={busy} onClick={() => setPageWidth('')}>Attuale</button>
    </div>
    <label htmlFor="screenshot-format">Formato file</label>
    <select id="screenshot-format" value={format} disabled={busy} onChange={event => setFormat(event.target.value as ScreenshotFormat)}>
      {screenshotFormats.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    <label htmlFor="screenshot-destination">Destinazione</label>
    <select id="screenshot-destination" value={destination} disabled={busy} onChange={event => setDestination(event.target.value as Destination)}>
      <option value="download">Salva file</option>
      <option value="clipboard">Copia negli appunti</option>
    </select>
    <div className="screenshot-actions">
      <button disabled={busy} onClick={() => void start('pagina')}><Download aria-hidden="true" /> Pagina intera</button>
      <button disabled={busy} onClick={() => void start('schermata')}><Monitor aria-hidden="true" /> Schermata</button>
      <button disabled={busy} onClick={() => void start('selezione')}><Crop aria-hidden="true" /> Seleziona rettangolo</button>
    </div>
    <div role="status" className="status">{busy && !status ? 'Cattura in corso…' : status}</div>
    <p className="footnote"><ScanLine aria-hidden="true" /> La selezione riguarda la parte attualmente visibile. Per applicare una larghezza personalizzata, la finestra Chrome cambia dimensione durante la cattura e viene ripristinata al termine. Pagine molto grandi possono superare il limite tecnico del browser.</p>
  </section>;
}
