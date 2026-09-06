import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useGlobalSiteAccess } from '../lib/global-site-access';

export function GlobalSiteAccessNotice() {
  const { enabled, request } = useGlobalSiteAccess();
  const [status, setStatus] = useState('');
  const [requesting, setRequesting] = useState(false);

  if (enabled !== false) return null;

  async function enable() {
    // Keep the permission request as the first action after the user click.
    setRequesting(true);
    try {
      const granted = await request();
      setStatus(granted
        ? 'Accesso abilitato. Puoi usare Swiss Knife passando da una scheda all’altra.'
        : 'Accesso non abilitato. Puoi ancora usare Swiss Knife dopo aver cliccato la sua icona nella scheda attiva.');
    } catch {
      setStatus('Impossibile richiedere l’accesso. Puoi ancora usare Swiss Knife dopo aver cliccato la sua icona nella scheda attiva.');
    } finally {
      setRequesting(false);
    }
  }

  return <section className="global-access-notice" aria-labelledby="global-access-title">
    <ShieldCheck aria-hidden="true" />
    <div>
      <h2 id="global-access-title">Usa Swiss Knife su tutte le schede</h2>
      <p>Abilita l’accesso ai siti per usare gli strumenti passando da una pagina all’altra, senza riaprire l’estensione.</p>
      <button onClick={() => void enable()} disabled={requesting}>{requesting ? 'Richiesta in corso…' : 'Abilita su tutti i siti'}</button>
      <p className="access-status" role="status">{status}</p>
    </div>
  </section>;
}
