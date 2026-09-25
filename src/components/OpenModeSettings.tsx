import { useEffect, useState } from 'react';
import { loadOpenMode, saveOpenMode, type OpenMode } from '../lib/floating-window';

const options: { value: OpenMode; title: string; description: string }[] = [
  { value: 'floating', title: 'Finestra mobile', description: 'Una piccola finestra dentro la pagina, che puoi spostare. Appartiene a quella scheda.' },
  { value: 'sidepanel', title: 'Pannello laterale', description: 'Accanto alle schede. Resta aperto quando cambi scheda.' },
];

export function OpenModeSettings() {
  const [mode, setMode] = useState<OpenMode | null>(null);
  const [status, setStatus] = useState('');
  useEffect(() => { void loadOpenMode().then(setMode).catch(() => { setMode('floating'); setStatus('Impossibile leggere la modalità salvata.'); }); }, []);
  async function choose(next: OpenMode) {
    const previous = mode;
    setMode(next); setStatus('Salvataggio…');
    try { await saveOpenMode(next); setStatus('Salvato. Vale dal prossimo clic sull’icona.'); }
    catch { setMode(previous); setStatus('Impossibile salvare. Riprova.'); }
  }
  return <section className="open-mode-settings" aria-labelledby="open-mode-title">
    <h2 id="open-mode-title">Apertura</h2>
    <p className="muted">Scegli dove si apre Swiss Knife quando clicchi la sua icona. Dal pannello laterale puoi anche staccarlo nella pagina una volta sola.</p>
    <fieldset disabled={mode === null}>
      <legend className="visually-hidden">Modalità di apertura</legend>
      {options.map(option => <label key={option.value}>
        <input type="radio" name="open-mode" value={option.value} checked={mode === option.value} onChange={() => void choose(option.value)} />
        <span><strong>{option.title}</strong><small>{option.description}</small></span>
      </label>)}
    </fieldset>
    <p role="status" className="save-status">{status}</p>
  </section>;
}
