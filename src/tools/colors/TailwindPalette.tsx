import { useState } from 'react';
import { TAILWIND_COLORS, displayHex } from './color';
import { ColorSwatch } from './ColorSwatch';

const families = [...new Set(TAILWIND_COLORS.map(item => item.name.replace(/-\d+$/, '')))];
export function TailwindPalette({ onOpen }: { onOpen: (value: string) => void }) {
  const [family, setFamily] = useState('blue');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(33);
  const normalized = query.trim().toLowerCase();
  const items = TAILWIND_COLORS.filter(item => normalized ? item.name.includes(normalized) : item.name.replace(/-\d+$/, '') === family);
  return <div className="colors-tailwind">
    <div className="colors-filter-fields">
      <label>Famiglia<select value={family} onChange={event => { setFamily(event.target.value); setQuery(''); setLimit(33); }}>
        {families.map(name => <option key={name}>{name}</option>)}
      </select></label>
      <label>Cerca in tutte<input type="search" placeholder="Nome o tonalità" value={query} onChange={event => { setQuery(event.target.value); setLimit(33); }} /></label>
    </div>
    <p className="colors-caption">Scegli un campione per modificarlo. Salvalo dall’editor.</p>
    {!items.length ? <p className="colors-empty" role="status">Nessun colore trovato. Prova “blue” o “500”.</p> : <>
      <ul className="colors-tailwind-grid">{items.slice(0, limit).map(item => <li key={item.name}>
        <button type="button" onClick={() => onOpen(item.value)} aria-label={`Modifica ${item.name}`}>
          <ColorSwatch value={item.value} /><strong>{item.name}</strong><span className="colors-code">{displayHex(item.value)}</span>
        </button>
      </li>)}</ul>
      {items.length > limit && <button className="colors-more" onClick={() => setLimit(old => old + 33)}>Mostra altri colori ({items.length - limit})</button>}
    </>}
  </div>;
}
