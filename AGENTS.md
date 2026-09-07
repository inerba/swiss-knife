# Istruzioni per gli agenti AI — Swiss Knife

Queste istruzioni si applicano a tutto il progetto. Leggile prima di modificare il codice.
Usa sempre Mermaid quando vuoi mostrare dei diagrammi.

## Quando applicare il flusso per nuovi strumenti

Applica il flusso seguente quando l'utente chiede di aggiungere o implementare una funzionalità dell'estensione, anche senza nominare uno «strumento». Esempi: «aggiungi questa funzionalità», «aggiungi un pulsante che…», «vorrei poter…», «implementa un tool per…», «add a feature».

Interpreta l'intento, non soltanto queste frasi esatte. Una nuova azione indipendente sulla pagina diventa normalmente un nuovo strumento del catalogo. Se la richiesta estende chiaramente uno strumento esistente, modifica quel modulo senza creare un duplicato. Per correzioni, richieste di spiegazione o modifiche puramente grafiche, applica soltanto le regole pertinenti; una domanda non autorizza di per sé un'implementazione.

## Architettura da rispettare

- Stack: WXT, Chrome Manifest V3, React, TypeScript e pnpm. Mantieni l'interfaccia in italiano.
- `src/tools/types.ts`: contratto `ToolDefinition` (`id`, `name`, `description`, `icon`, `component`). `icon` è un componente `LucideIcon` importato da `lucide-react`, mai un emoji o una stringa.
- `src/tools/registry.ts`: registro centrale. Catalogo, ricerca e selezione derivano da questo array.
- `src/tools/<id>/`: un modulo autonomo per ogni strumento; separa la logica operativa dalla presentazione quando pertinente.
- `src/lib/browser.ts`: helper condivisi `activeTab`, `openUrl`, `explainError`. Verifica il loro comportamento prima di riusarli per una funzione con requisiti diversi.
- `src/lib/global-site-access.ts`: controllo, richiesta, revoca e sottoscrizione agli eventi del permesso host globale facoltativo. Usa questo modulo e i componenti condivisi del pannello/impostazioni, non creare richieste di permesso duplicate negli strumenti.
- `src/App.tsx`: struttura comune del pannello. Aggiungere uno strumento non deve richiedere condizioni specifiche per quel tool dentro App.
- Le preferenze del catalogo sono in `src/lib/preferences.ts`; il registro rimane la fonte delle definizioni. Nuovi strumenti sono attivi e aggiunti in fondo finché l’utente non li riordina.
- `src/lib/appearance.ts`: applica esclusivamente il tema chiaro, sincronicamente negli entrypoint di pannello e impostazioni. Nessuna preferenza scuro/sistema. I token condivisi del design indaco sono in `src/style.css`; riusarli negli strumenti senza duplicare palette. Non usare `color: inherit` per i controlli.
- `src/tools/iframes/`: esempio esistente di scansione su richiesta e gestione del ciclo di vita; usalo come riferimento, senza copiare logica non necessaria.
- `src/tools/media-picker/`: selettore di file multimediali, raccolta del contenitore e livelli nel punto, sessione legata al documento e metadati temporanei. `entrypoints/media-picker.ts` è uno script incluso nella build e iniettato su richiesta; il port è legato al `documentId` e la disconnessione rimuove il selettore. Non ricostruire stream o contenuti DRM. Quando l’utente richiede la scheda Chrome collegata via CDP, non avviare gli script Playwright/Chromium locali; usare il selettore di produzione tramite `scripts/media-picker-cdp-entry.ts` e ripulire la pagina dopo il test.
- `src/tools/form-filler/`: preferenze e UI del riempimento form. `entrypoints/form-filler.ts` è incluso nella build e viene iniettato solo al clic; il selettore non deve inviare form né archiviare valori della pagina. Mantieni l’accesso minimo, gli eventi nativi e la pulizia del livello alla navigazione o all’annullamento.

## Flusso di implementazione

1. Leggi il registro, il contratto, gli helper e il modulo più pertinente prima di scegliere dove intervenire. Controlla anche `package.json`, `wxt.config.ts` e i test coinvolti: il codice corrente è la fonte di verità.
2. Identifica l'azione richiesta, gli input, i risultati e gli eventuali effetti sulla pagina o sulle schede. Risolvi autonomamente i dettagli ordinari; chiedi chiarimenti solo se l'ambiguità cambia materialmente il risultato o l'accesso ai dati.
3. Per un nuovo strumento scegli un `id` unico in kebab-case, crea `src/tools/<id>/<Nome>Tool.tsx` e implementa un componente compatibile con `ToolDefinition`. Per un'estensione di uno strumento esistente, lavora nel suo modulo.
4. Registra il nuovo componente una sola volta nell'array `tools`, con nome italiano, descrizione breve dell'azione e icona Lucide coerente. Non aggiungere un secondo elenco di strumenti o una navigazione parallela.
5. Gestisci gli stati pertinenti: iniziale, elaborazione, successo, risultato vuoto ed errore. Mostra gli errori vicino all'azione e permetti di riprovare. Non presentare risultati parziali come completi.
6. Per operazioni sulla pagina, acquisisci la scheda al momento dell'azione. Invalida i risultati al cambio scheda o navigazione e ignora le risposte asincrone superate. Rimuovi listener e risorse allo smontaggio del componente.
7. Aggiorna il README per descrivere il nuovo strumento, i suoi limiti e le eventuali istruzioni d'uso. Se cambia l'architettura, aggiorna anche questo file.
8. Esegui le verifiche sotto e consegna il risultato indicando cosa funziona e quali prove non sono state possibili.

## Permessi e comportamento

- La base attuale usa `activeTab`, `scripting`, `sidePanel`, `downloads`, `storage`, `clipboardWrite` e dichiara `<all_urls>` solo come permesso host opzionale. L’accesso globale non viene concesso all’installazione: è richiesto esclusivamente dal pulsante comune **Abilita su tutti i siti**, direttamente nel gesto di clic dell’utente, e può essere revocato dalle impostazioni senza rimuovere consensi separati a singoli siti. Mantieni l'esecuzione su richiesta e l'accesso minimo necessario.
- Non aggiungere ulteriori host globali, scansioni globali, processi persistenti, archiviazione di dati della pagina o invii a servizi esterni. Se la funzione richiede di ampliare questi confini, verifica che la richiesta lo autorizzi; altrimenti spiega il requisito e chiedi una decisione prima di introdurlo.
- Al cambio scheda o navigazione, conserva lo strumento selezionato ma invalida risposte asincrone, risultati e selettori della pagina precedente. Non avviare mai scansioni o catture automaticamente: mostra il messaggio comune e attendi un nuovo gesto dell’utente.
- Le funzioni passate a `browser.scripting.executeScript` devono essere serializzabili e autonome: non possono dipendere da variabili o import esterni alla funzione iniettata.
- Non aggirare restrizioni di Chrome o same-origin. Spiega quando una pagina o una parte dei risultati non è accessibile.
- Usa `openUrl` per aprire URL HTTP/HTTPS; non trattare input della pagina come codice o HTML attendibile. Gli strumenti devono essere inclusi nella build, senza codice remoto.
- Usa controlli HTML nativi, etichette accessibili, focus visibile e messaggi di stato comprensibili. Mantieni il pannello utilizzabile con tastiera, a larghezze ridotte e nel tema chiaro, anche con sistema scuro.
- Usa sempre [Lucide Icons](https://lucide.dev/icons/) come provider per le icone visibili dell'interfaccia. Importa i componenti da `lucide-react`; non usare emoji, caratteri Unicode decorativi, SVG fatti a mano o un'altra libreria di icone.
- L'icona primaria di Swiss Knife è [`PocketKnife`](https://lucide.dev/icons/pocket-knife). Usala nel brand del pannello e per i PNG dell'azione Chrome, rigenerati con `scripts/icons.cjs`; non sostituirla senza una richiesta esplicita.
- Non modificare file generati in `.output`, `.wxt` o `node_modules` per implementare funzionalità. Rigenera gli artefatti tramite i comandi del progetto.

## Verifiche e completamento

- Aggiungi test mirati per la nuova logica e per errori o cambi scheda che possono produrre risultati errati. Usa gli esempi esistenti in `src/tools/iframes/scan.test.ts` e `src/App.test.tsx`; non scrivere test che si limitano a ripetere il codice.
- Per modifiche funzionali esegui `pnpm compile`, `pnpm test` e `pnpm build`. Esegui `pnpm zip` quando consegni una build installabile aggiornata.
- Quando il browser è disponibile, verifica anche il comportamento reale e le interazioni pertinenti. Le API simulate nei test non dimostrano che i permessi o il pannello nativo funzionino in Chrome.
- Per sole modifiche alla documentazione, verifica coerenza, percorsi e comandi; non è necessario ricompilare.
- Nel riepilogo indica lo strumento aggiunto o modificato, eventuali nuovi permessi, le verifiche realmente eseguite e i limiti ancora presenti. Non dichiarare completate prove non eseguite.
