# Finestra mobile come iframe dell’estensione dentro la pagina

La finestra mobile è una pagina dell’estensione caricata in un iframe, dentro uno shadow root che uno script inietta nella scheda al clic. È dichiarata come unica `web_accessible_resources`, con `use_dynamic_url`. Così l’interfaccia React e le API `chrome.*` restano quelle del pannello laterale, senza passare dal background, e la finestra si trascina dentro la pagina. Per `use_dynamic_url` e `sidePanel.close()` la versione minima di Chrome sale a 141.

## Considered Options

- **Popup nativo dell’azione**: non si sposta e si chiude al primo clic sulla pagina, quindi i selettori non funzionerebbero.
- **Finestra Chrome separata (`windows.create` di tipo popup)**: passa dietro il browser appena si clicca la pagina, e lì `currentWindow` indica la finestra stessa.
- **React renderizzato direttamente nello shadow DOM di un content script**: i content script non hanno `tabs`, `scripting`, `downloads` né `captureVisibleTab`, quindi ogni strumento dovrebbe passare dal background.

## Consequences

- La finestra appartiene alla scheda di lavoro. Cambiare scheda non azzera i risultati, e navigare o ricaricare la pagina chiude la finestra. La regola di AGENTS.md sull’invalidazione al cambio scheda vale solo per il pannello laterale.
- La finestra è parte della pagina, quindi durante le selezioni sulla pagina scompare (`concealFloatingWindow`) e ricompare a selezione conclusa, «Elenca iframe» la esclude e le catture la nascondono per un istante (`opacity: 0`).
- La copia negli appunti funziona solo con il focus nell’iframe e può essere bloccata dal Permissions-Policy della pagina; il permesso `clipboardWrite` non basta. Non aggiungiamo `offscreen`.
- Un dialogo modale della pagina rende inerte la finestra, e alcune pagine con focus trap le sottraggono il focus.
- Lo zoom della pagina ingrandisce anche la finestra. Per ora non lo compensiamo.
- `use_dynamic_url` impedisce di scoprire l’estensione interrogando il suo ID, ma mentre la finestra è aperta il suo DOM è visibile alla pagina.
