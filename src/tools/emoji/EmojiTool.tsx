import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Flag, Hash, LampDesk, Laugh, PawPrint, Plane, Search, Settings, Shapes, Trophy, UsersRound, Utensils, X } from 'lucide-react';
import { applySkinTone, filterEmojis, loadEmojiData, type EmojiCategory, type EmojiGroup, type EmojiRecord } from './data';
import { defaultEmojiPreferences, emojiPreviewSizes, loadEmojiPreferences, saveEmojiPreferences, type EmojiPreferences } from './preferences';
import './emoji.css';

const COPY_TOAST_MS = 3_000;

const categories: Array<{ id: EmojiCategory; name: string; icon: typeof Shapes }> = [
  { id: 'all', name: 'Tutte', icon: Shapes },
  { id: 'smileys-emotion', name: 'Faccine ed emozioni', icon: Laugh },
  { id: 'people-body', name: 'Persone e corpo', icon: UsersRound },
  { id: 'animals-nature', name: 'Animali e natura', icon: PawPrint },
  { id: 'food-drink', name: 'Cibo e bevande', icon: Utensils },
  { id: 'travel-places', name: 'Viaggi e luoghi', icon: Plane },
  { id: 'activities', name: 'Attività', icon: Trophy },
  { id: 'objects', name: 'Oggetti', icon: LampDesk },
  { id: 'symbols', name: 'Simboli', icon: Hash },
  { id: 'flags', name: 'Bandiere', icon: Flag },
];

const skinTones = [
  { value: 0, label: 'Tonalità standard', emoji: '👋' },
  { value: 1, label: 'Carnagione chiara', emoji: '👋🏻' },
  { value: 2, label: 'Carnagione abbastanza chiara', emoji: '👋🏼' },
  { value: 3, label: 'Carnagione olivastra', emoji: '👋🏽' },
  { value: 4, label: 'Carnagione abbastanza scura', emoji: '👋🏾' },
  { value: 5, label: 'Carnagione scura', emoji: '👋🏿' },
];

function categoryName(group: EmojiGroup) {
  return categories.find(category => category.id === group)?.name ?? group;
}

export function EmojiTool() {
  const [emojis, setEmojis] = useState<EmojiRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EmojiCategory>('all');
  const [tone, setTone] = useState(0);
  const [status, setStatus] = useState('');
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const [preferences, setPreferences] = useState<EmojiPreferences>(defaultEmojiPreferences);
  const [settings, setSettings] = useState(false);
  const toastTimeout = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    setLoadError('');
    void loadEmojiData().then(data => {
      if (active) setEmojis(data);
    }).catch(() => {
      if (active) setLoadError('Impossibile caricare le emoji. Riprova.');
    });
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    void loadEmojiPreferences().then(setPreferences).catch(() => setStatus('Impossibile caricare le impostazioni emoji.'));
  }, []);

  useEffect(() => () => {
    if (toastTimeout.current !== undefined) window.clearTimeout(toastTimeout.current);
  }, []);

  useEffect(() => {
    if (!settings) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettings(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings]);

  const visible = useMemo(() => filterEmojis(emojis, { query, group: category }), [category, emojis, query]);
  const groups = useMemo(() => categories.slice(1).map(item => ({
    group: item.id as EmojiGroup,
    name: item.name,
    emojis: category === 'all' ? visible.filter(emoji => emoji.group === item.id) : visible,
  })).filter(item => category === 'all' ? item.emojis.length > 0 : item.group === category), [category, visible]);

  async function persistPreferences(next: EmojiPreferences) {
    setPreferences(next);
    try {
      await saveEmojiPreferences(next);
    } catch {
      setStatus('Impossibile salvare le impostazioni emoji. Riprova.');
    }
  }

  async function copyEmoji(item: EmojiRecord) {
    try {
      await navigator.clipboard.writeText(applySkinTone(item, tone));
      setStatus('');
      if (toastTimeout.current !== undefined) window.clearTimeout(toastTimeout.current);
      setCopyToastVisible(true);
      toastTimeout.current = window.setTimeout(() => {
        setCopyToastVisible(false);
        toastTimeout.current = undefined;
      }, COPY_TOAST_MS);
    } catch {
      setStatus('Impossibile copiare negli appunti. Riprova.');
    }
  }

  return <section className={`emoji-tool emoji-preview-${preferences.previewSize}`} aria-labelledby="emoji-tool-title">
    <div className="section-heading">
      <h2 id="emoji-tool-title">Emoji</h2>
      <div className="emoji-heading-actions">
        <span className="badge">{emojis.length || '…'}</span>
        <button type="button" className="icon-button" aria-label="Impostazioni emoji" onClick={() => setSettings(true)}><Settings aria-hidden="true" /></button>
      </div>
    </div>
    <p className="muted">Cerca un’emoji in italiano o in inglese, poi copiala con un clic.</p>

    <form className="emoji-search" role="search" onSubmit={event => event.preventDefault()}>
      <label htmlFor="emoji-search">Cerca emoji</label>
      <div className="emoji-search-field">
        <Search aria-hidden="true" />
        <input id="emoji-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome o parola chiave…" autoComplete="off" />
        {query && <button type="button" className="emoji-clear" aria-label="Cancella ricerca" onClick={() => setQuery('')}><X aria-hidden="true" /></button>}
      </div>
    </form>

    <nav className="emoji-categories" aria-label="Categorie emoji">
      <ul>{categories.map(item => {
        const Icon = item.icon;
        return <li key={item.id}><button type="button" aria-label={item.name} title={item.name} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}><Icon aria-hidden="true" /></button></li>;
      })}</ul>
    </nav>

    <fieldset className="emoji-skins">
      <legend>Tonalità della pelle</legend>
      <div>{skinTones.map(item => <button key={item.value} type="button" aria-label={item.label} aria-pressed={tone === item.value} onClick={() => setTone(item.value)}><span aria-hidden="true">{item.emoji}</span></button>)}</div>
    </fieldset>

    {loadError ? <div className="notice emoji-notice-actions" role="status"><p>{loadError}</p><button type="button" onClick={() => setReloadKey(key => key + 1)}>Riprova</button></div>
      : emojis.length === 0 ? <p className="status" role="status">Caricamento emoji…</p>
      : visible.length === 0 ? <p className="empty" role="status">Nessuna emoji corrisponde alla ricerca.</p>
      : <div className="emoji-results">
        <p className="emoji-drag-hint">Trascina un’emoji in un normale campo di testo oppure fai clic per copiarla.</p>
        {groups.map(group => <section key={group.group} aria-labelledby={`emoji-group-${group.group}`}>
          <h3 id={`emoji-group-${group.group}`}>{category === 'all' ? group.name : categoryName(category as EmojiGroup)}</h3>
          <ul className="emoji-grid" role="list">{group.emojis.map(item => <li key={item.hexcode}>
            <button type="button" className="emoji-button" draggable aria-label={item.italianName} title={item.italianName} onDragStart={event => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('text/plain', applySkinTone(item, tone)); }} onClick={() => void copyEmoji(item)}>{applySkinTone(item, tone)}</button>
          </li>)}</ul>
        </section>)}
      </div>}
    {copyToastVisible && <p className="emoji-copy-toast" role="status"><Check aria-hidden="true" />Emoji copiata negli appunti.</p>}
    <p className="status" role="status" aria-live="polite">{status}</p>
    {settings && <div className="dialog-backdrop" role="presentation" onClick={() => setSettings(false)}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="emoji-settings-title" className="tool-dialog" tabIndex={-1} onClick={event => event.stopPropagation()}>
        <div className="section-heading">
          <h3 id="emoji-settings-title">Impostazioni emoji</h3>
          <button type="button" className="icon-button" aria-label="Chiudi" onClick={() => setSettings(false)}><X aria-hidden="true" /></button>
        </div>
        <fieldset className="emoji-size-options">
          <legend>Dimensione anteprima</legend>
          <div>{emojiPreviewSizes.map(size => <button key={size} type="button" aria-label={`Anteprima da ${size} px`} aria-pressed={preferences.previewSize === size} onClick={() => void persistPreferences({ previewSize: size })}>
            <span aria-hidden="true" style={{ fontSize: `${size}px` }}>😀</span>
            <span>{size} px</span>
          </button>)}</div>
        </fieldset>
      </section>
    </div>}
  </section>;
}
