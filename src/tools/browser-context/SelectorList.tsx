import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { SelectorKind, SelectorSuggestion } from './types';

const LABELS: Record<SelectorKind, string> = {
  'css-short': 'CSS breve',
  'css-full': 'CSS completo',
  'xpath-relative': 'XPath relativo',
  'xpath-absolute': 'XPath assoluto',
  'xpath-text': 'XPath per testo',
  playwright: 'Playwright',
};

const COPIED_MS = 1500;

export function matchLabel(item: SelectorSuggestion) {
  const count = item.matches === 1 ? 'unico' : item.matches === 0 ? 'nessun risultato' : `${item.matches} risultati`;
  return item.estimated ? `${count} (stima)` : count;
}

interface SelectorListProps {
  selectors: SelectorSuggestion[];
  onCopyError: (message: string) => void;
}

export function SelectorList({ selectors, onCopyError }: SelectorListProps) {
  const [copied, setCopied] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(index: number, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(index);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), COPIED_MS);
    } catch {
      onCopyError('Impossibile copiare il selettore. Selezionalo e copialo a mano.');
    }
  }

  if (!selectors.length) return null;

  return (
    <section className="context-selectors" aria-labelledby="context-selectors-title">
      <h3 id="context-selectors-title">Selettori</h3>
      <p className="context-selectors-note">Risultati contati sulla pagina al momento della cattura.</p>
      <ul>
        {selectors.map((item, index) => {
          const label = LABELS[item.kind];
          const isCopied = copied === index;
          return (
            <li key={`${item.kind}-${index}`} className="context-selector">
              <div className="context-selector-head">
                <span className="context-selector-label">{label}</span>
                <span className={item.matches === 1 ? 'context-selector-badge is-unique' : 'context-selector-badge'}>{matchLabel(item)}</span>
              </div>
              <div className="context-selector-body">
                <code>{item.value}</code>
                <button
                  type="button"
                  aria-label={isCopied ? `${label} copiato` : `Copia ${label}`}
                  onClick={() => void copy(index, item.value)}
                >
                  {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {isCopied ? 'Copiato' : 'Copia'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
