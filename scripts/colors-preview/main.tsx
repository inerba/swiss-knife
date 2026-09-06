import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorsTool } from '../../src/tools/colors/ColorsTool';
import '../../src/style.css';

function Preview() {
  const [width, setWidth] = useState('380');
  const [theme, setTheme] = useState('light');
  return <>
    <aside style={{ padding: 12, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span>Anteprima UI · API simulate</span>
      <select aria-label="Larghezza anteprima" style={{ width: 100 }} value={width} onChange={e => setWidth(e.target.value)}><option>320</option><option>380</option><option>480</option></select>
      <select aria-label="Tema anteprima" style={{ width: 100 }} value={theme} onChange={e => { setTheme(e.target.value); document.documentElement.style.colorScheme = e.target.value; }}><option value="light">Chiaro</option><option value="dark">Scuro</option></select>
    </aside>
    <main style={{ width: Number(width), maxWidth: '100%', margin: '0 auto' }}><ColorsTool /></main>
  </>;
}
document.documentElement.style.colorScheme = 'light';
createRoot(document.getElementById('root')!).render(<Preview />);
