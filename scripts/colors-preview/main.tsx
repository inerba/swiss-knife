import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../src/App';
import { SettingsApp } from '../../src/SettingsApp';
import { applyAppearance } from '../../src/lib/appearance';
import '../../src/style.css';
function Preview() {
  const [width, setWidth] = useState('380');
  const [view, setView] = useState('panel');
  return <>
    <aside style={{ padding: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <span>Anteprima UI - API simulate</span>
      <select aria-label="Larghezza anteprima" style={{ width: 100 }} value={width} onChange={e => setWidth(e.target.value)}><option>240</option><option>320</option><option>380</option><option>480</option></select>
      <select aria-label="Vista anteprima" style={{ width: 130 }} value={view} onChange={e => setView(e.target.value)}><option value="panel">Pannello</option><option value="settings">Impostazioni</option></select>
    </aside>
    <div style={{ width: Number(width), maxWidth: '100%', margin: '0 auto' }}>{view === 'panel' ? <App /> : <SettingsApp />}</div>
  </>;
}
applyAppearance();
createRoot(document.getElementById('root')!).render(<Preview />);
