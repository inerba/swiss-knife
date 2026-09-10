import { useEffect, useRef, useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, LockKeyhole, RefreshCw, Settings, ShieldCheck } from 'lucide-react';
import { generatePassword, MAX_LENGTH, MIN_LENGTH, normalizeSymbolSet, SYMBOLS, type PasswordOptions } from './generate';
import { defaultPasswordGeneratorPreferences, loadPasswordGeneratorPreferences, savePasswordGeneratorPreferences } from './preferences';
import { ratePassword } from './strength';
import './password-generator.css';

const includeRows: Array<{ key: keyof Pick<PasswordOptions, 'numbers' | 'lowercase' | 'uppercase'>; id: string; label: string }> = [
  { key: 'numbers', id: 'pw-numbers', label: 'Numeri' },
  { key: 'lowercase', id: 'pw-lowercase', label: 'Lettere minuscole' },
  { key: 'uppercase', id: 'pw-uppercase', label: 'Lettere maiuscole' },
];

const ruleRows: Array<{ key: keyof Pick<PasswordOptions, 'excludeSimilar' | 'excludeSequences' | 'excludeRepeats' | 'startWithLetter'>; id: string; label: string; hint: string }> = [
  { key: 'excludeSimilar', id: 'pw-similar', label: 'Escludi caratteri simili', hint: 'Evita o, O, 0, i, I, l, 1' },
  { key: 'excludeSequences', id: 'pw-sequences', label: 'Escludi sequenze', hint: 'Evita sequenze come 123 o abc' },
  { key: 'excludeRepeats', id: 'pw-repeats', label: 'Escludi caratteri ripetuti', hint: 'Ogni carattere al massimo una volta' },
  { key: 'startWithLetter', id: 'pw-letter', label: 'Inizia con una lettera', hint: 'Il primo carattere non è un numero o un simbolo' },
];

function settingsId(id: string) {
  return `pw-settings-${id.slice('pw-'.length)}`;
}

export function PasswordGeneratorTool() {
  const [options, setOptions] = useState(defaultPasswordGeneratorPreferences);
  const [symbolDraft, setSymbolDraft] = useState(SYMBOLS);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(false);
  const skipSave = useRef(true);
  const strength = password ? ratePassword(password) : null;

  function show(next: PasswordOptions) {
    const result = generatePassword(next);
    if (result.ok) { setPassword(result.password); setError(''); }
    else { setPassword(''); setError(result.error); }
    setNotice('');
  }

  function apply(next: PasswordOptions) {
    setOptions(next);
    show(next);
  }

  function restoreDefaults() {
    apply(defaultPasswordGeneratorPreferences);
    setSymbolDraft(SYMBOLS);
  }

  function onSymbolsInput(value: string) {
    setSymbolDraft(value);
    apply({ ...options, symbolSet: normalizeSymbolSet(value) });
  }

  function clampLength(value: string) {
    return Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Number(value) || MIN_LENGTH));
  }

  useEffect(() => {
    let active = true;
    void loadPasswordGeneratorPreferences().then(value => {
      if (!active) return;
      apply(value);
      setSymbolDraft(value.symbolSet);
      setReady(true);
    }).catch(() => {
      if (!active) return;
      apply(defaultPasswordGeneratorPreferences);
      setSymbolDraft(SYMBOLS);
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) { skipSave.current = false; return; }
    const timer = window.setTimeout(() => { void savePasswordGeneratorPreferences(options); }, 300);
    return () => window.clearTimeout(timer);
  }, [options, ready]);

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setNotice('Copiata');
    } catch {
      setNotice('Impossibile copiare. Seleziona la password e copiala manualmente.');
    }
  }

  function lengthControls(ids: { range: string; number: string }) {
    return <div className="pw-length-controls">
      <input id={ids.range} type="range" min={MIN_LENGTH} max={MAX_LENGTH} value={options.length} onInput={event => apply({ ...options, length: Number((event.target as HTMLInputElement).value) })} />
      <input id={ids.number} type="number" min={MIN_LENGTH} max={MAX_LENGTH} value={options.length} onChange={event => apply({ ...options, length: clampLength(event.target.value) })} />
    </div>;
  }

  function includeList(inSettings: boolean) {
    const id = (value: string) => inSettings ? settingsId(value) : value;
    return <details className="pw-acc" open>
      <summary>Includi</summary>
      <div className="pw-acc-body">
        <div className="pw-list">
          {includeRows.map(row => <div key={row.id} className="pw-row">
            <div className="pw-row-copy"><label htmlFor={id(row.id)}>{row.label}</label></div>
            <input id={id(row.id)} className="pw-toggle" type="checkbox" checked={options[row.key]} onChange={event => apply({ ...options, [row.key]: event.target.checked })} />
          </div>)}
          <div className="pw-row pw-row-symbols">
            <div className="pw-row-copy"><label htmlFor={id('pw-symbols')}>Simboli</label></div>
            <input id={id('pw-symbols')} className="pw-toggle" type="checkbox" checked={options.symbols} onChange={event => apply({ ...options, symbols: event.target.checked })} />
            <input id={id('pw-symbols-set')} spellCheck={false} aria-label="Set di simboli" disabled={!options.symbols} value={symbolDraft} onInput={event => onSymbolsInput((event.target as HTMLInputElement).value)} />
          </div>
        </div>
      </div>
    </details>;
  }

  function rulesList(inSettings: boolean) {
    const id = (value: string) => inSettings ? settingsId(value) : value;
    return <details className="pw-acc">
      <summary>Regole</summary>
      <div className="pw-acc-body">
        <div className="pw-list">
          {ruleRows.map(row => <div key={row.id} className="pw-row">
            <div className="pw-row-copy">
              <label htmlFor={id(row.id)}>{row.label}</label>
              <small>{row.hint}</small>
            </div>
            <input id={id(row.id)} className="pw-toggle" type="checkbox" checked={options[row.key]} onChange={event => apply({ ...options, [row.key]: event.target.checked })} />
          </div>)}
        </div>
      </div>
    </details>;
  }

  function optionsCard(inSettings: boolean) {
    return <div className="pw-style-card">
      {includeList(inSettings)}
      {rulesList(inSettings)}
    </div>;
  }

  return <section className="pw-tool" aria-labelledby="pw-title">
    <div className="section-heading">
      <h2 id="pw-title"><KeyRound aria-hidden="true" /> Generatore password</h2>
      <button type="button" className="icon-button" aria-label="Impostazioni generatore password" onClick={() => setSettings(true)}><Settings aria-hidden="true" /></button>
    </div>
    <p className="muted">Crea password sicure in pochi secondi.</p>
    <p className="pw-private muted"><LockKeyhole aria-hidden="true" /> Elaborazione locale</p>
    <div className="pw-card">
      <div className="pw-card-heading">
        <label htmlFor="pw-value">Password</label>
        <span className="pw-count">{options.length} caratteri</span>
      </div>
      <div className="pw-value-row">
        <input id="pw-value" readOnly spellCheck={false} type={visible ? 'text' : 'password'} value={password} aria-invalid={error ? true : undefined} aria-describedby={error ? 'pw-error' : undefined} />
        <button type="button" className="pw-eye" aria-label={visible ? 'Nascondi password' : 'Mostra password'} onClick={() => setVisible(open => !open)}>
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
      <div className="pw-actions">
        <button type="button" className="pw-generate" onClick={() => show(options)}><RefreshCw aria-hidden="true" /> Genera</button>
        <button type="button" disabled={!password} onClick={() => void copy()}><Copy aria-hidden="true" /> Copia</button>
      </div>
      {strength && <p className="pw-strength" data-grade={strength}><span className="pw-meter" aria-hidden="true"><span /></span>{strength}</p>}
      {error && <p id="pw-error" className="pw-error" role="alert">{error}</p>}
      <p className="pw-notice" role="status">{notice}</p>
    </div>
    <div className="pw-panel pw-length">
      <div className="pw-length-head"><label htmlFor="pw-length">Lunghezza password</label><span className="pw-count">{options.length}</span></div>
      {lengthControls({ range: 'pw-length', number: 'pw-length-input' })}
    </div>
    {optionsCard(false)}
    <p className="pw-privacy"><ShieldCheck aria-hidden="true" /><span><strong>Generazione locale e sicura.</strong> Le password vengono generate nel browser e non vengono salvate né inviate a server esterni.</span></p>
    {settings && <div className="dialog-backdrop" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="pw-settings-title" className="tool-dialog">
        <div className="section-heading">
          <h3 id="pw-settings-title">Impostazioni generatore</h3>
          <button type="button" onClick={() => setSettings(false)}>Chiudi</button>
        </div>
        <div className="pw-panel pw-length">
          <div className="pw-length-head"><label htmlFor="pw-settings-length">Lunghezza password</label><span className="pw-count">{options.length}</span></div>
          {lengthControls({ range: 'pw-settings-length', number: 'pw-settings-length-input' })}
        </div>
        {optionsCard(true)}
        <div className="pw-settings-actions">
          <button type="button" onClick={restoreDefaults}>Ripristina valori predefiniti</button>
        </div>
      </section>
    </div>}
  </section>;
}
