import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, PocketKnife, Settings, SlidersHorizontal } from 'lucide-react';
import { tools } from './tools/registry';
import { browser } from 'wxt/browser';
import { CATALOG_ORDER_KEY, isCatalogOrder, loadToolPreferences, saveCatalogOrder, TOOL_PREFERENCES_KEY, type CatalogOrder, type ToolPreferences } from './lib/preferences';
import { GlobalSiteAccessNotice } from './components/GlobalSiteAccessNotice';
export function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [catalogControlsOpen, setCatalogControlsOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef<string | null>(null);
  const [preferences, setPreferences] = useState<ToolPreferences | null>(null);
  const [catalogOrder, setCatalogOrder] = useState<CatalogOrder>('custom');
  useEffect(() => { void loadToolPreferences(tools.map(item => item.id)).then(({ preferences, catalogOrder }) => { setPreferences(preferences); setCatalogOrder(catalogOrder); }); const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => { if (area !== 'local') return; if (changes[TOOL_PREFERENCES_KEY]) void loadToolPreferences(tools.map(item => item.id)).then(({ preferences }) => setPreferences(preferences)); if (changes[CATALOG_ORDER_KEY] && isCatalogOrder(changes[CATALOG_ORDER_KEY].newValue)) setCatalogOrder(changes[CATALOG_ORDER_KEY].newValue); }; browser.storage.onChanged.addListener(listener); return () => browser.storage.onChanged.removeListener(listener); }, []);
  const ordered = preferences ? preferences.orderedIds.map(id => tools.find(item => item.id === id)!).filter(Boolean) : tools;
  const active = preferences ? ordered.filter(item => !preferences.disabledIds.includes(item.id)) : ordered;
  const tool = active.find(item => item.id === selected);
  useEffect(() => {
    document.title = tool ? `${tool.name} · Swiss Knife` : 'Swiss Knife';
    if (selected) heading.current?.focus();
    else if (previous.current) document.getElementById(`tool-${previous.current}`)?.focus();
    previous.current = selected;
  }, [selected, tool]);
  useEffect(() => { if (selected && !tool) setSelected(null); }, [selected, tool]);
  const visible = active.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase('it').includes(query.toLocaleLowerCase('it').trim())).sort((a, b) => catalogOrder === 'alphabetical' ? a.name.localeCompare(b.name, 'it') : 0);
  return <>
    <header className="brand"><span className="brand-icon" aria-hidden="true"><PocketKnife fill="currentColor" /></span><div><h1>Swiss Knife</h1><p>Piccoli strumenti, a portata di clic.</p></div><button className="icon-button" aria-label="Apri impostazioni" onClick={() => void browser.runtime.openOptionsPage()}><Settings /></button><span className="version">{browser.runtime.getManifest().version}</span></header>
    <main>
      <GlobalSiteAccessNotice />
      {tool ? <>
        <button className="back" onClick={() => setSelected(null)}><ArrowLeft aria-hidden="true" /> Tutti gli strumenti</button>
        <h2 ref={heading} tabIndex={-1} className="visually-hidden">{tool.name}</h2>
        <tool.component />
      </> : <>
        <div className="section-heading catalog-heading"><h2>I tuoi strumenti</h2><div className="catalog-heading-actions"><button className="catalog-controls-toggle" type="button" aria-expanded={catalogControlsOpen} aria-controls="catalog-controls" onClick={() => setCatalogControlsOpen(open => !open)}><SlidersHorizontal aria-hidden="true" /> Filtra e riordina</button><span className="badge">{active.length}</span></div></div>
        <div id="catalog-controls" className="catalog-controls" hidden={!catalogControlsOpen}>
          <label htmlFor="catalog-order">Ordina per</label><select id="catalog-order" value={catalogOrder} onChange={event => { const next = event.target.value as CatalogOrder; setCatalogOrder(next); void saveCatalogOrder(next); }}><option value="custom">Ordine personalizzato</option><option value="alphabetical">Ordine alfabetico</option></select>
          <label htmlFor="search">Cerca uno strumento</label>
          <input id="search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome o funzione…" />
        </div>
        <ul className="tool-grid">{visible.map(item => {
          const Icon = item.icon;
          return <li key={item.id}>
          <button id={`tool-${item.id}`} className="tool-card" onClick={() => setSelected(item.id)}>
            <span className="tool-icon" aria-hidden="true"><Icon /></span><span className="tool-copy"><strong>{item.name}</strong><span className="muted">{item.description}</span></span>
          </button>
        </li>})}</ul>
        {active.length === 0 ? <p role="status" className="empty">Nessuno strumento attivo. <button className="link-button" onClick={() => void browser.runtime.openOptionsPage()}>Apri impostazioni</button></p> : visible.length === 0 && <p role="status" className="empty">Nessuno strumento corrisponde alla ricerca.</p>}
        <p className="footnote">Gli strumenti lavorano sulla scheda attiva, quando lo chiedi tu.</p>
      </>}
    </main>
  </>;
}
