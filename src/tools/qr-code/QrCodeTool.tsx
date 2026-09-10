import { useEffect, useRef, useState } from 'react';
import { Clipboard, Download, ExternalLink, ImageUp, MousePointer2, QrCode, Save, Trash2 } from 'lucide-react';
import { browser } from 'wxt/browser';
import { activeTab, explainError, openUrl } from '../../lib/browser';
import { decodeQrDataUrl, renderQr } from './codec';
import { buildQrPayload, type QrPayloadFields, type QrPayloadKind } from './payload';
import { deleteQrStylePreset, loadQrStylePresets, saveQrStylePresets, upsertQrStylePreset, type QrUserPreset } from './presets';
import { startQrPagePick } from './session';
import {
  builtinPresets,
  cornerDotOptions,
  cornerSquareOptions,
  defaultQrStyle,
  dotTypeOptions,
  errorLevels,
  matchingPresetId,
  type QrFill,
  type QrStyle,
} from './style';
import './qr-code.css';

const kinds: Array<{ id: QrPayloadKind; label: string }> = [
  { id: 'url', label: 'URL' }, { id: 'text', label: 'Testo' }, { id: 'wifi', label: 'Wi‑Fi' },
  { id: 'contact', label: 'Contatto' }, { id: 'email', label: 'Email' }, { id: 'phone', label: 'Telefono' }, { id: 'sms', label: 'SMS' },
];

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
    reader.readAsDataURL(file);
  });
}

function safeLogoSvg(source: string) {
  const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
  xml.querySelectorAll('script,foreignObject,iframe,object,embed').forEach(node => node.remove());
  xml.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attribute => {
    if (/^on/i.test(attribute.name) || ((attribute.name === 'href' || attribute.name === 'xlink:href') && !attribute.value.startsWith('data:'))) node.removeAttribute(attribute.name);
  }));
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(xml.documentElement))))}`;
}

function QrPreviewStage({ svg }: { svg?: string }) {
  if (!svg) return null;
  return <div className="image-preview qr-preview">
    <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Anteprima del QR code" />
  </div>;
}

function setNativeValue(setter: (value: string) => void) {
  return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setter(event.target.value);
}

function FillFields({ fill, enabled = true, onChange }: { fill: QrFill; enabled?: boolean; onChange: (fill: QrFill) => void }) {
  if (!enabled) return null;
  return <>
    <label>Tipo colore
      <select value={fill.mode} onChange={event => onChange({ ...fill, mode: event.target.value as QrFill['mode'] })}>
        <option value="single">Colore unico</option>
        <option value="gradient">Gradiente</option>
      </select>
    </label>
    {fill.mode === 'single'
      ? <label>Colore<input type="color" value={fill.color} onChange={event => onChange({ ...fill, color: event.target.value })} /></label>
      : <>
        <label>Tipo gradiente
          <select value={fill.gradient.type} onChange={event => onChange({ ...fill, gradient: { ...fill.gradient, type: event.target.value as QrFill['gradient']['type'] } })}>
            <option value="linear">Lineare</option>
            <option value="radial">Radiale</option>
          </select>
        </label>
        <div className="qr-color-fields">
          <label>Inizio<input type="color" value={fill.gradient.start} onChange={event => onChange({ ...fill, gradient: { ...fill.gradient, start: event.target.value } })} /></label>
          <label>Fine<input type="color" value={fill.gradient.end} onChange={event => onChange({ ...fill, gradient: { ...fill.gradient, end: event.target.value } })} /></label>
        </div>
        <label>Rotazione: {fill.gradient.rotation}°
          <input type="range" min="0" max="360" value={fill.gradient.rotation} onChange={event => onChange({ ...fill, gradient: { ...fill.gradient, rotation: Number(event.target.value) } })} />
        </label>
      </>}
  </>;
}

export function QrCodeTool() {
  const [tab, setTab] = useState<'create' | 'read'>('create');
  const [kind, setKind] = useState<QrPayloadKind>('url');
  const [fields, setFields] = useState<QrPayloadFields>({ value: '', security: 'WPA', hidden: false });
  const [style, setStyle] = useState<QrStyle>(defaultQrStyle);
  const [logo, setLogo] = useState<string>();
  const [userPresets, setUserPresets] = useState<QrUserPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [rendered, setRendered] = useState<{ png: string; svg: string }>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [readValue, setReadValue] = useState('');
  const generation = useRef(0);
  const abort = useRef(new AbortController());
  const connection = useRef<{ close(): void } | undefined>(undefined);
  const target = useRef<number | undefined>(undefined);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const payload = (() => { try { return buildQrPayload(kind, fields); } catch { return ''; } })();
  const selectedPreset = matchingPresetId(style, userPresets);
  const selectedUser = userPresets.find(item => item.id === selectedPreset);
  const canSavePreset = selectedPreset === '';

  const updateField = (key: string, value: string | boolean) => setFields(previous => ({ ...previous, [key]: value }));
  const updateStyle = (patch: Partial<QrStyle> | ((current: QrStyle) => QrStyle)) => {
    setStyle(current => typeof patch === 'function' ? patch(current) : { ...current, ...patch });
  };
  const tabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setTab(current => current === 'create' ? 'read' : 'create');
    }
  };

  useEffect(() => {
    void loadQrStylePresets().then(setUserPresets).catch(() => setStatus('Impossibile caricare i preset salvati.'));
  }, []);

  useEffect(() => {
    if (!payload) {
      setRendered(undefined);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      void renderQr(payload, style, logo).then(value => {
        if (!alive) return;
        setRendered(value);
        setStatus(current => /Impossibile (generare|esportare)/.test(current) ? '' : current);
      }).catch(error => {
        if (alive) {
          setRendered(undefined);
          setStatus(error instanceof Error ? error.message : String(error));
        }
      });
    }, 150);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [payload, style, logo]);

  useEffect(() => {
    let windowId: number | undefined;
    void browser.windows.getCurrent().then(win => { windowId = win.id; }).catch(() => undefined);
    const invalidate = () => {
      generation.current++;
      abort.current.abort();
      connection.current?.close();
      setReadValue('');
      setBusy(false);
      setStatus('Scheda cambiata. Avvia di nuovo la lettura su questa pagina.');
    };
    const activated = (info: { windowId: number }) => { if (windowId === undefined || info.windowId === windowId) invalidate(); };
    const updated = (id: number, info: { status?: string; url?: string }) => { if (id === target.current && (info.status === 'loading' || info.url)) invalidate(); };
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    return () => {
      abort.current.abort();
      connection.current?.close();
      browser.tabs.onActivated.removeListener(activated);
      browser.tabs.onUpdated.removeListener(updated);
    };
  }, []);

  async function persistPresets(presets: QrUserPreset[]) {
    setUserPresets(presets);
    try { await saveQrStylePresets(presets); }
    catch { setStatus('Impossibile salvare i preset.'); }
  }

  function applyPreset(id: string) {
    const builtin = builtinPresets.find(item => item.id === id);
    if (builtin) { setStyle(builtin.style); return; }
    const user = userPresets.find(item => item.id === id);
    if (user) setStyle(user.style);
  }

  async function savePreset() {
    const name = presetName.trim() || selectedUser?.name || '';
    if (!name) { setStatus('Inserisci un nome per il preset.'); return; }
    const exists = userPresets.some(item => item.name.toLocaleLowerCase('it') === name.toLocaleLowerCase('it'));
    if (exists && !window.confirm(`Esiste già «${name}». Sovrascrivere?`)) return;
    const result = upsertQrStylePreset(userPresets, name, style);
    await persistPresets(result.presets);
    setPresetName('');
    setStatus(result.overwritten ? 'Preset aggiornato.' : 'Preset salvato.');
  }

  async function removePreset() {
    if (!selectedUser) return;
    if (!window.confirm(`Eliminare il preset «${selectedUser.name}»?`)) return;
    await persistPresets(deleteQrStylePreset(userPresets, selectedUser.id));
    setStatus('Preset eliminato.');
  }

  async function exportFile(kind: 'png' | 'svg') {
    if (!rendered) return;
    const url = kind === 'png' ? rendered.png : URL.createObjectURL(new Blob([rendered.svg], { type: 'image/svg+xml' }));
    try {
      await browser.downloads.download({ url, filename: `qr-code.${kind}`, saveAs: true, conflictAction: 'uniquify' });
      setStatus(`Download ${kind.toUpperCase()} avviato.`);
    } finally {
      if (kind === 'svg') window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }
  }

  async function copyImage() {
    if (!rendered) return;
    try {
      const blob = await (await fetch(rendered.png)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('Immagine copiata negli appunti.');
    } catch {
      setStatus('Chrome non può copiare questa immagine negli appunti. Scarica il PNG.');
    }
  }

  async function loadLogo(file?: File) {
    if (!file) return;
    try {
      const source = await toDataUrl(file);
      const data = file.type === 'image/svg+xml' ? safeLogoSvg(await file.text()) : source;
      setLogo(data);
      setStatus('Logo aggiunto: la correzione errori è impostata su Alto.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function decodeFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setReadValue('');
    try {
      const value = await decodeQrDataUrl(await toDataUrl(file));
      setReadValue(value);
      setStatus('QR code letto.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function inspectPage() {
    if (busy) return;
    generation.current++;
    const current = generation.current;
    abort.current.abort();
    abort.current = new AbortController();
    setBusy(true);
    setReadValue('');
    setStatus('Avvio del selettore…');
    try {
      const page = await activeTab();
      const win = await browser.windows.getCurrent();
      if (current !== generation.current || win.id == null) return;
      target.current = page.id;
      connection.current = await startQrPagePick(page.id, win.id, abort.current.signal, message => {
        if (current === generation.current) setStatus(message);
      }, image => {
        if (current !== generation.current) return;
        void decodeQrDataUrl(image).then(value => {
          if (current === generation.current) { setReadValue(value); setStatus('QR code letto.'); }
        }).catch(error => {
          if (current === generation.current) setStatus(error instanceof Error ? error.message : String(error));
        }).finally(() => {
          if (current === generation.current) setBusy(false);
        });
      }, () => {
        if (current === generation.current) setBusy(false);
      });
    } catch (error) {
      if (current === generation.current) { setBusy(false); setStatus(explainError(error)); }
    }
  }

  function input(label: string, key: string, type = 'text') {
    return <label>{label}<input type={type} value={String(fields[key] ?? '')} onChange={setNativeValue(value => updateField(key, value))} /></label>;
  }

  const canExport = Boolean(rendered);
  const isLink = /^https?:\/\//i.test(readValue);

  return <section className="qr-tool" aria-labelledby="qr-tool-title">
    <div className="section-heading"><h2 id="qr-tool-title">QR code</h2><QrCode aria-hidden="true" /></div>
    <div className="qr-tabs" role="tablist" aria-label="Funzioni QR">
      <button id="qr-create-tab" role="tab" aria-controls="qr-create-panel" aria-selected={tab === 'create'} tabIndex={tab === 'create' ? 0 : -1} onKeyDown={tabKey} onClick={() => setTab('create')}>Crea</button>
      <button id="qr-read-tab" role="tab" aria-controls="qr-read-panel" aria-selected={tab === 'read'} tabIndex={tab === 'read' ? 0 : -1} onKeyDown={tabKey} onClick={() => setTab('read')}>Leggi</button>
    </div>
    {tab === 'create' ? <div id="qr-create-panel" className="qr-create" role="tabpanel" aria-labelledby="qr-create-tab">
      <label>Tipo di contenuto
        <select value={kind} onChange={event => { setKind(event.target.value as QrPayloadKind); setFields({ value: '', security: 'WPA', hidden: false }); }}>
          {kinds.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      {(kind === 'url' || kind === 'text') && <label>{kind === 'url' ? 'URL' : 'Testo'}<textarea value={String(fields.value ?? '')} onChange={setNativeValue(value => updateField('value', value))} placeholder={kind === 'url' ? 'https://example.it' : 'Scrivi il contenuto…'} /></label>}
      {kind === 'wifi' && <>
        <label>Rete (SSID)<input value={String(fields.ssid ?? '')} onChange={setNativeValue(value => updateField('ssid', value))} /></label>
        {input('Password', 'password', 'password')}
        <label>Sicurezza<select value={String(fields.security)} onChange={setNativeValue(value => updateField('security', value))}><option>WPA</option><option>WEP</option><option value="nopass">Nessuna</option></select></label>
        <label className="qr-check"><input type="checkbox" checked={fields.hidden === true} onChange={event => updateField('hidden', event.target.checked)} /> Rete nascosta</label>
      </>}
      {kind === 'contact' && <div className="qr-field-grid">{input('Nome', 'firstName')}{input('Cognome', 'lastName')}{input('Organizzazione', 'organization')}{input('Telefono', 'phone')}{input('Email', 'email', 'email')}{input('Sito', 'website', 'url')}</div>}
      {kind === 'email' && <>{input('Destinatario', 'to', 'email')}{input('Oggetto', 'subject')}<label>Messaggio<textarea value={String(fields.body ?? '')} onChange={setNativeValue(value => updateField('body', value))} /></label></>}
      {kind === 'phone' && input('Telefono', 'phone', 'tel')}
      {kind === 'sms' && <>{input('Telefono', 'phone', 'tel')}<label>Messaggio<textarea value={String(fields.message ?? '')} onChange={setNativeValue(value => updateField('message', value))} /></label></>}

      <div className="qr-preset-bar">
        <label>Preset
          <select value={selectedPreset} onChange={event => applyPreset(event.target.value)}>
            <option value="">Personalizzato</option>
            <optgroup label="Predefiniti">{builtinPresets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>
            {userPresets.length > 0 && <optgroup label="I tuoi">{userPresets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
          </select>
        </label>
        <div className="qr-preset-actions">
          {canSavePreset && <>
            <label className="qr-preset-name">Salva preset
              <input value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="Salva come…" />
            </label>
            <button type="button" onClick={() => void savePreset()}><Save aria-hidden="true" /> Salva</button>
          </>}
          {selectedUser && <button type="button" onClick={() => void removePreset()}><Trash2 aria-hidden="true" /> Elimina</button>}
        </div>
      </div>

      <QrPreviewStage svg={rendered?.svg} />

      <div className="qr-style-card">
      <details className="qr-acc" open>
        <summary>Moduli</summary>
        <div className="qr-acc-body">
          <label>Forma<select value={style.dotsType} onChange={event => updateStyle({ dotsType: event.target.value as QrStyle['dotsType'] })}>{dotTypeOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <FillFields fill={style.dots} onChange={dots => updateStyle({ dots })} />
        </div>
      </details>
      <details className="qr-acc">
        <summary>Angoli esterni</summary>
        <div className="qr-acc-body">
          <label>Forma<select value={style.cornersSquareType} onChange={event => updateStyle({ cornersSquareType: event.target.value as QrStyle['cornersSquareType'] })}>{cornerSquareOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="qr-check"><input type="checkbox" checked={style.cornersSquareColorEnabled} onChange={event => updateStyle({ cornersSquareColorEnabled: event.target.checked })} /> Colore personalizzato</label>
          <FillFields fill={style.cornersSquare} enabled={style.cornersSquareColorEnabled} onChange={cornersSquare => updateStyle({ cornersSquare })} />
        </div>
      </details>
      <details className="qr-acc">
        <summary>Angoli interni</summary>
        <div className="qr-acc-body">
          <label>Forma<select value={style.cornersDotType} onChange={event => updateStyle({ cornersDotType: event.target.value as QrStyle['cornersDotType'] })}>{cornerDotOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="qr-check"><input type="checkbox" checked={style.cornersDotColorEnabled} onChange={event => updateStyle({ cornersDotColorEnabled: event.target.checked })} /> Colore personalizzato</label>
          <FillFields fill={style.cornersDot} enabled={style.cornersDotColorEnabled} onChange={cornersDot => updateStyle({ cornersDot })} />
        </div>
      </details>
      <details className="qr-acc">
        <summary>Sfondo</summary>
        <div className="qr-acc-body">
          <label className="qr-check"><input type="checkbox" checked={style.backgroundTransparent} onChange={event => updateStyle({ backgroundTransparent: event.target.checked })} /> Trasparente</label>
          {!style.backgroundTransparent && <FillFields fill={style.background} onChange={background => updateStyle({ background })} />}
        </div>
      </details>
      <details className="qr-acc">
        <summary>Logo</summary>
        <div className="qr-acc-body">
          <label>Immagine centrale<input ref={logoInput} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={event => void loadLogo(event.target.files?.[0])} /></label>
          {logo && <button type="button" onClick={() => { setLogo(undefined); if (logoInput.current) logoInput.current.value = ''; setStatus('Logo rimosso.'); }}>Rimuovi logo</button>}
          <p className="muted">Il logo resta solo in questa sessione e non viene salvato nei preset.</p>
          <label className="qr-check"><input type="checkbox" checked={style.hideBackgroundDots} onChange={event => updateStyle({ hideBackgroundDots: event.target.checked })} /> Nascondi i moduli sotto il logo</label>
          <label>Dimensione logo: {Math.round(style.imageSize * 100)}%<input type="range" min="10" max="50" value={Math.round(style.imageSize * 100)} onChange={event => updateStyle({ imageSize: Number(event.target.value) / 100 })} /></label>
          <label>Margine logo: {style.imageMargin} px<input type="range" min="0" max="40" value={style.imageMargin} onChange={event => updateStyle({ imageMargin: Number(event.target.value) })} /></label>
        </div>
      </details>
      <details className="qr-acc">
        <summary>Dimensione e correzione</summary>
        <div className="qr-acc-body">
          <label>Lato: {style.size} px<input type="range" min="200" max="1000" step="10" value={style.size} onChange={event => updateStyle({ size: Number(event.target.value) })} /></label>
          <label>Margine: {style.margin} px<input type="range" min="0" max="80" value={style.margin} onChange={event => updateStyle({ margin: Number(event.target.value) })} /></label>
          {style.margin < 8 && <p className="notice">Un margine basso può ridurre la leggibilità.</p>}
          <label>Correzione errori
            <select value={logo ? 'H' : style.errorCorrection} disabled={!!logo} onChange={event => updateStyle({ errorCorrection: event.target.value as QrStyle['errorCorrection'] })}>
              {errorLevels.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          {logo && <p className="muted">Con un logo la correzione errori resta impostata su Alto.</p>}
        </div>
      </details>
      </div>

      <div className="qr-actions">
        <div className="qr-export-actions">
          <button type="button" onClick={() => void exportFile('png')} disabled={!canExport}><Download aria-hidden="true" /> Scarica PNG</button>
          <button type="button" onClick={() => void exportFile('svg')} disabled={!canExport}><Download aria-hidden="true" /> Scarica SVG</button>
          <button type="button" onClick={() => void copyImage()} disabled={!canExport}><Clipboard aria-hidden="true" /> Copia immagine</button>
        </div>
      </div>
    </div> : <div id="qr-read-panel" className="qr-read" role="tabpanel" aria-labelledby="qr-read-tab">
      <p className="muted">Scegli un QR visibile nella pagina, carica un’immagine o incollala qui.</p>
      <button type="button" onClick={() => void inspectPage()} disabled={busy}><MousePointer2 aria-hidden="true" /> Ispeziona QR nella pagina</button>
      <label className="qr-upload"><ImageUp aria-hidden="true" /> Carica PNG, JPEG o SVG<input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={event => void decodeFile(event.target.files?.[0])} /></label>
      <div className="qr-paste" tabIndex={0} role="button" onPaste={event => {
        const file = [...event.clipboardData.files].find(item => item.type.startsWith('image/'));
        if (file) void decodeFile(file);
        else setStatus('Negli appunti non c’è un’immagine.');
      }}>Incolla qui un’immagine con Ctrl+V</div>
      {readValue && <div className="qr-read-result">
        <label>Contenuto letto<textarea readOnly value={readValue} /></label>
        <button type="button" onClick={() => void navigator.clipboard.writeText(readValue).then(() => setStatus('Contenuto copiato.')).catch(() => setStatus('Impossibile copiare negli appunti.'))}><Clipboard aria-hidden="true" /> Copia contenuto</button>
        {isLink && <button type="button" onClick={() => void openUrl(readValue)}><ExternalLink aria-hidden="true" /> Apri link</button>}
      </div>}
    </div>}
    <p className="status" role="status" aria-live="polite">{status}</p>
  </section>;
}
