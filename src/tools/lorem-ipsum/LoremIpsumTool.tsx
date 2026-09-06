import { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { faker as fakerEN } from '@faker-js/faker/locale/en';

export function generateLoremIpsum(count: number) { return Array.from({ length: count }, () => fakerEN.lorem.paragraph()).join('\n\n'); }
export function LoremIpsumTool() {
  const [count, setCount] = useState(3); const [text, setText] = useState(() => generateLoremIpsum(3)); const [status, setStatus] = useState('');
  function generate() { const next = generateLoremIpsum(count); setText(next); setStatus(''); return next; }
  async function copy() { const next = generate(); try { await navigator.clipboard.writeText(next); setStatus('Testo copiato negli appunti.'); } catch { setStatus('Impossibile copiare negli appunti. Puoi selezionare e copiare il testo qui sotto.'); } }
  return <section><div className="section-heading"><h2>Lorem Ipsum</h2><button onClick={generate}><RefreshCw aria-hidden="true" /> Genera</button></div><p className="muted">Scegli quanti paragrafi creare, quindi copiali negli appunti.</p><label htmlFor="lorem-count">Paragrafi</label><input id="lorem-count" type="number" min="1" max="100" value={count} onChange={event => setCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /><div className="tool-actions"><button onClick={() => void copy()}><Copy aria-hidden="true" /> Copia</button></div><p role="status" className="status">{status}</p><textarea className="generated-text" aria-label="Lorem Ipsum generato" readOnly value={text} /></section>;
}
