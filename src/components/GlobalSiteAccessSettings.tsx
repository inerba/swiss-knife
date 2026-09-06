import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useGlobalSiteAccess } from '../lib/global-site-access';

export function GlobalSiteAccessSettings() {
  const { enabled, request, remove } = useGlobalSiteAccess();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const granted = await request();
      setStatus(granted ? 'Accesso globale abilitato.' : 'Accesso globale non abilitato.');
    } catch {
      setStatus('Impossibile richiedere l’accesso globale.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      const removed = await remove();
      setStatus(removed ? 'Accesso globale revocato. I consensi per singolo sito restano invariati.' : 'Impossibile revocare l’accesso globale.');
    } catch {
      setStatus('Impossibile revocare l’accesso globale.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="access-settings" aria-labelledby="site-access-title">
    <div className="section-heading">
      <div><h2 id="site-access-title">Accesso ai siti</h2><p className="muted">Scegli se usare Swiss Knife passando tra le schede senza nuovi consensi.</p></div>
      {enabled === true ? <ShieldCheck className="access-icon" aria-hidden="true" /> : <ShieldOff className="access-icon" aria-hidden="true" />}
    </div>
    {enabled === null ? <p role="status" className="muted">Controllo dell’accesso in corso…</p> : enabled ? <>
      <p>Accesso globale attivo.</p>
      <button onClick={() => void revoke()} disabled={busy}>{busy ? 'Revoca in corso…' : 'Revoca accesso globale'}</button>
    </> : <>
      <p>Accesso globale non attivo. Puoi ancora usare gli strumenti dopo aver cliccato l’icona di Swiss Knife nella scheda attiva.</p>
      <button onClick={() => void enable()} disabled={busy}>{busy ? 'Richiesta in corso…' : 'Abilita su tutti i siti'}</button>
    </>}
    <p role="status" className="access-status">{status}</p>
  </section>;
}
