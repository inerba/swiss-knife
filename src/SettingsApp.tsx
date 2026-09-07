import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, PocketKnife } from 'lucide-react';
import { tools } from './tools/registry';
import { loadToolPreferences, saveToolPreferences, type ToolPreferences } from './lib/preferences';
import { GlobalSiteAccessSettings } from './components/GlobalSiteAccessSettings';

const ids = tools.map(tool => tool.id);
function move(list: string[], from: number, to: number) { const next = [...list]; const [item] = next.splice(from, 1); if (item) next.splice(to, 0, item); return next; }
export function SettingsApp() {
  const [preferences, setPreferences] = useState<ToolPreferences | null>(null);
  const [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const dragSource = useRef<string | null>(null);
  const resetDrag = () => { dragSource.current = null; setDraggedId(null); setDropSlot(null); };
  const queued = useRef(Promise.resolve()); const latest = useRef<ToolPreferences | null>(null);
  useEffect(() => { void loadToolPreferences(ids).then(({ preferences }) => setPreferences(preferences)).catch(() => setStatus('error')); }, []);
  const persist = (next: ToolPreferences) => {
    latest.current = next; setPreferences(next); setStatus('saving');
    queued.current = queued.current.catch(() => undefined).then(async () => { if (latest.current) await saveToolPreferences(latest.current); });
    void queued.current.then(() => { if (latest.current === next) setStatus('saved'); }).catch(() => setStatus('error'));
  };
  if (!preferences) return <main className="settings-page">{status === 'error' ? <><p role="alert" className="empty">Impossibile caricare le impostazioni.</p><button onClick={() => { setStatus('saved'); void loadToolPreferences(ids).then(({ preferences }) => setPreferences(preferences)).catch(() => setStatus('error')); }}>Riprova</button></> : <p role="status">Caricamento impostazioni…</p>}</main>;
  const ordered = preferences.orderedIds.map(id => tools.find(tool => tool.id === id)!).filter(Boolean);
  return <><header className="brand settings-brand"><span className="brand-icon" aria-hidden="true"><PocketKnife /></span><div><h1>Impostazioni</h1><p>Personalizza Swiss Knife.</p></div></header><main className="settings-page">
    <GlobalSiteAccessSettings />
    <div className="section-heading"><div><h2>Strumenti</h2><p className="muted">Scegli cosa mostrare e trascina per cambiare l’ordine.</p></div><p className={`save-status ${status}`} role="status">{status === 'saving' ? 'Salvataggio…' : status === 'error' ? 'Impossibile salvare.' : 'Salvato'}</p></div>
    {status === 'error' && <button onClick={() => persist(preferences)}>Riprova</button>}
    <ul className="settings-tools" aria-label="Ordine degli strumenti"
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropSlot(null); }}
      onDragOver={event => {
        if (!dragSource.current) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(':scope > li'));
        const slot = rows.findIndex(row => { const rect = row.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2; });
        setDropSlot(slot === -1 ? ordered.length : slot);
      }}
      onDrop={event => {
        event.preventDefault();
        const from = preferences.orderedIds.indexOf(dragSource.current ?? '');
        if (from !== -1 && dropSlot !== null) {
          const to = dropSlot > from ? dropSlot - 1 : dropSlot;
          if (from !== to) persist({ ...preferences, orderedIds: move(preferences.orderedIds, from, to) });
        }
        resetDrag();
      }}>
      {ordered.map((tool, index) => { const Icon = tool.icon; const enabled = !preferences.disabledIds.includes(tool.id);
        const sourceIndex = ordered.findIndex(item => item.id === draggedId);
        const showSlot = dropSlot !== null && dropSlot !== sourceIndex && dropSlot !== sourceIndex + 1;
        const marker = showSlot && dropSlot === index ? 'drop-before' : showSlot && dropSlot === ordered.length && index === ordered.length - 1 ? 'drop-after' : '';
        return <li key={tool.id} className={`${draggedId === tool.id ? 'dragging' : ''} ${marker}`} draggable
          onDragStart={event => {
            dragSource.current = tool.id; setDraggedId(tool.id); setDropSlot(null);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', tool.id);
          }} onDragEnd={resetDrag}>

      <span className="drag-handle" aria-hidden="true"><GripVertical /></span><input id={`enabled-${tool.id}`} type="checkbox" checked={enabled} onChange={() => persist({ ...preferences, disabledIds: enabled ? preferences.disabledIds.concat(tool.id) : preferences.disabledIds.filter(id => id !== tool.id) })} />
      <label htmlFor={`enabled-${tool.id}`} className="setting-tool-copy"><span className="tool-icon" aria-hidden="true"><Icon /></span><span><strong>{tool.name}</strong><small>{tool.description}</small></span></label>
      <div className="move-actions"><button aria-label={`Sposta ${tool.name} su`} disabled={index === 0} onClick={() => persist({ ...preferences, orderedIds: move(preferences.orderedIds, index, index - 1) })}><ArrowUp /></button><button aria-label={`Sposta ${tool.name} giù`} disabled={index === ordered.length - 1} onClick={() => persist({ ...preferences, orderedIds: move(preferences.orderedIds, index, index + 1) })}><ArrowDown /></button></div>
    </li>; })}</ul>
  </main></>;
}
