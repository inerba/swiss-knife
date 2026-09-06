import { X } from 'lucide-react';
import { ColorSwatch } from './ColorSwatch';
import { displayHex } from './color';

export interface ColorItem { id: string; value: string; detail?: string }
export function ColorCollection({ items, selected, onToggle, onOpen, onRemove }: {
  items: ColorItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (value: string) => void;
  onRemove?: (id: string) => void;
}) {
  return <ul className="colors-grid">{items.map(item => {
    const hex = displayHex(item.value);
    return <li key={item.id} className={`colors-tile ${selected.has(item.id) ? 'is-selected' : ''}`}>
      <button type="button" className="colors-swatch-button" aria-label={`Modifica ${hex}`} onClick={() => onOpen(item.value)} title={item.detail || hex}>
        <ColorSwatch value={item.value} />
      </button>
      {onRemove && <button type="button" className="colors-tile-remove" aria-label={`Rimuovi ${hex}`} onClick={() => onRemove(item.id)}>
        <X aria-hidden="true" />
      </button>}
      <label className="colors-tile-label">
        <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} aria-label={`Seleziona ${hex}`} />
        <span className="colors-code">{hex}</span>
      </label>
      {item.detail && <small className="colors-tile-detail" title={item.detail}>{item.detail}</small>}
    </li>;
  })}</ul>;
}
