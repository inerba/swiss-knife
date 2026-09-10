# Swiss Knife

Estensione Chrome MV3 con WXT, React e TypeScript. Un pannello laterale raccoglie strumenti indipendenti: **Lorem Ipsum**, **Compila form**, **Elenca iframe**, **Cattura file multimediali**, **Screenshot**, **Colori**, **Contrasti**, **Ispeziona e salva**, **Emoji**, **QR code**, **Codifica e converti** e **Generatore password**.

## Emoji

**Emoji** mostra un catalogo locale di emoji native, diviso in categorie. Cerca per nome o parola chiave sia in italiano sia in inglese, scegli una tonalità della pelle per le emoji compatibili e fai clic su un elemento per copiarne la sequenza Unicode negli appunti. Il catalogo usa i dati [Emojibase](https://emojibase.dev/) (MIT), inclusi nella build: lo strumento non effettua richieste di rete e non legge la pagina aperta. L’aspetto e la disponibilità delle emoji più recenti dipendono dal sistema operativo.

## Impostazioni

Il pulsante Impostazioni nel pannello apre una scheda dedicata. L?interfaccia usa esclusivamente il tema chiaro, anche se Chrome o una vecchia preferenza erano impostati su scuro. Il design usa superfici bianche, accenti indaco, header traslucido, card da 16 px e controlli a pillola. Qui puoi attivare gli strumenti con gli interruttori e riordinarli trascinandoli o con i pulsanti di spostamento. Durante il trascinamento una linea indaco tra le card mostra la posizione esatta di inserimento, prima o dopo lo strumento sotto il puntatore. L?ordine viene salvato solo al rilascio nella lista; annullare o rilasciare fuori non lo modifica. Il catalogo mostra soltanto gli strumenti attivi; il menu **Ordina per** permette di usare l?ordine personalizzato o quello alfabetico e ricorda l?ultima scelta. Qui puoi anche controllare e revocare l?accesso globale facoltativo ai siti. Le preferenze restano locali al profilo Chrome tramite il permesso `storage`; non contengono dati delle pagine. Lo sfondo vale solo per il pannello e le impostazioni, non per le pagine visitate. Pulsanti e campi usano i token del pannello: in hover icone e testo restano sullo stesso contrasto, nel tema chiaro.

## Avvio e installazione

Richiede Node.js 22.4+ e pnpm 11. Chrome 123+. I comandi WXT disabilitano il Web Storage sperimentale di Node, incompatibile con l?ambiente simulato di WXT nelle versioni Node recenti.

```sh
pnpm install
pnpm dev
pnpm compile
pnpm test
pnpm build
pnpm zip
```

`pnpm zip` chiede la versione (predefinita: quella in `package.json`) e genera lo ZIP installabile in `.output`, ad esempio `swiss-knife-1.2.0-chrome.zip`. Puoi passarla direttamente: `pnpm zip -- 1.2.0`. La versione aggiorna `package.json` e il manifest, ed è quella mostrata nell’header del pannello.

Per installare la build, apri `chrome://extensions`, abilita **Modalità sviluppatore**, scegli **Carica estensione non pacchettizzata** e seleziona `.output/chrome-mv3`. Per lo sviluppo con `pnpm dev`, la cartella è `.output/chrome-mv3-dev`. Lo ZIP di produzione viene generato in `.output`.

Apri una pagina HTTP/HTTPS e scegli **Elenca iframe**. Al primo utilizzo il pannello propone **Abilita su tutti i siti**: dopo il consenso Chrome, gli strumenti restano disponibili passando a un?altra pagina o scheda, senza avviare scansioni automaticamente. Il cambio scheda elimina risultati, operazioni e selettori della pagina precedente; il pannello mantiene lo strumento selezionato e invita ad avviarlo sulla pagina nuova. **Apri** attiva una nuova scheda.

Se preferisci non abilitare l?accesso globale, clicca l'icona **Swiss Knife nella barra delle estensioni di Chrome** con la pagina da analizzare attiva, poi premi **Aggiorna**. Questo accesso temporaneo (`activeTab`) vale soltanto per quella scheda e quella pagina. Aprire il pannello dal menu laterale o cliccare un pulsante al suo interno non concede `activeTab`. Pagine Chrome, Chrome Web Store e file locali restano escluse. Dopo un aggiornamento locale, premi **Ricarica** su Swiss Knife in `chrome://extensions`, chiudi il vecchio pannello e riaprilo dall'icona.

## Cattura file multimediali

Apri il pannello dall?icona Swiss Knife sulla pagina da analizzare e scegli **Cattura file multimediali**. Il mirino parte automaticamente: punta un elemento e clicca per selezionarlo insieme a tutti i file contenuti al suo interno, anche fuori dal punto o non visibili. **?** amplia la selezione al contenitore padre, **?** ritorna all?elemento precedente. **Invio** conferma senza spostare il puntatore. Il clic di selezione non attiva link o pulsanti sottostanti. **Esc** o **Annulla selezione** annullano; **Nuova selezione** sostituisce i risultati precedenti.

Il pannello elenca i file dell?elemento selezionato e dei suoi discendenti, oltre ai livelli sovrapposti nel punto: immagini (`currentSrc`), sfondi CSS multipli e `image-set()`, pseudo-elementi `::before`/`::after`, riferimenti `<image>` negli SVG, video, audio, sorgenti `<source>`, poster, sottotitoli `<track>`, collegamenti diretti e file incorporati riconoscibili da MIME o estensione. URL uguali diventano una sola scheda con pi� provenienze. Sono inclusi shadow root aperti e iframe same-origin; gli iframe non accessibili vengono segnalati. Selezionare un'immagine singola non estende automaticamente la scansione a tutti i fratelli: usa ? per scegliere il contenitore desiderato.

La pagina analizzata � mostrata come dominio e percorso su una sola riga; il tooltip mantiene l?URL completo. Gli URL HTTP(S) dei file sono raccolti in dettagli espandibili come link su una sola riga, troncati con puntini ma copiabili dal menu contestuale; per contenuti `data:` e file temporanei non viene visualizzato il sorgente. Ogni scheda mostra tipo, nome, estensione, MIME, peso leggibile e byte esatti; risoluzione per immagini/video e durata per audio/video. Le immagini hanno anteprima su scacchiera; audio e video riproducibili hanno controlli nativi, senza autoplay. Il pulsante **Copia** copia il codice di un SVG oppure l?immagine negli appunti quando il formato � supportato da Chrome. I dati letti dalla pagina sono distinti da quelli verificati sul file. I metadati vengono recuperati automaticamente dopo il clic, con al massimo tre richieste concorrenti per gruppo di recupero, timeout di 20 secondi e limite di 32 MiB per file. I valori mancanti non vengono stimati.

Se il dominio non consente il recupero, **Autorizza e completa** richiede accesso soltanto a quell?origine e riprova i file del gruppo. Puoi negarlo e continuare a usare i dati gi� disponibili. Le autorizzazioni concesse restano gestite da Chrome e si possono revocare dalle impostazioni dell?estensione. Le richieste dei metadati non includono credenziali e non seguono redirect: autenticazione, redirect e blocchi del server vengono segnalati; **Apri originale** consente di raggiungere la risorsa nel browser.

**Scarica** salva il file originale, senza conversione, attraverso il gestore download di Chrome e chiede la destinazione. Quando la lista ha pi� file, **Scarica tutti** avvia i download in sequenza nella cartella predefinita di Chrome, raggruppati in `cattura-media/<dominio>/`, senza chiedere la destinazione per ogni file. I file temporanei `blob:` non ancora recuperati vengono esclusi e segnalati; un esito parziale non viene presentato come download completo. Quando disponibile riusa il file gi� recuperato. Le immagini `data:` e `blob:` recuperabili sono supportate; per `blob:` occorre che il documento proprietario sia ancora disponibile. I file temporanei si aprono con **Apri originale** in una scheda non attivata, per mantenere la sorgente disponibile durante il caricamento. Le immagini HTTP/HTTPS si aprono nella scheda attiva come gli URL degli altri strumenti.

Il rilevamento identifica risorse DOM/CSS, non analizza i pixel: ritagli, trasformazioni complesse e pseudo-elementi possono produrre candidati parzialmente visibili. Non forza il caricamento delle risorse lazy prive di URL sorgente. Shadow root chiusi e contenuti degli iframe cross-origin non sono ispezionabili. Canvas, gradienti e SVG inline senza file referenziati non vengono esportati. Le playlist HLS/DASH sono etichettate e scaricabili come playlist, non come video completi; non vengono ricostruiti segmenti, dirette MediaSource o contenuti DRM. Codec non supportati impediscono l?anteprima, ma non il download dei byte gi� recuperati. Per file temporanei oltre 32 MiB il recupero e il download da questo strumento non sono disponibili; per HTTP/HTTPS rimane il download diretto.

## Screenshot

Apri il pannello dall?icona Swiss Knife mentre � attiva la pagina da catturare e scegli **Screenshot**. Puoi scegliere PNG, JPEG o WebP e decidere se salvare il file oppure copiarlo negli appunti. Chrome pu� limitare i formati immagine copiabili: se JPEG o WebP non sono supportati, usa PNG oppure salva il file. Per **Pagina intera** puoi lasciare vuota la larghezza e usare quella attuale, inserire un valore tra 320 e 2560 px oppure scegliere i preset Mobile 400 e Desktop 1080. La larghezza modifica realmente il viewport e quindi attiva il layout responsive corrispondente; Chrome ridimensiona temporaneamente la finestra e la ripristina al termine. Lo strumento parte sempre dall?inizio del documento, continua finch� include anche le sezioni caricate durante lo scorrimento, quindi torna alla posizione originale. Durante l?operazione sospende animazioni e transizioni; gli elementi fissi o sticky restano soltanto nel primo riquadro, per non duplicarli lungo l?immagine. **Schermata** salva soltanto la porzione della pagina ora visibile. **Seleziona rettangolo** mostra un livello superiore alla pagina: trascina per definire l?area oppure premi **Esc** per annullare. La selezione rettangolare non scorre la pagina.

Le catture non inviano dati a servizi esterni e usano il download nativo di Chrome. Le pagine molto ampie o lunghe possono superare il limite della tela del browser: in quel caso usa la schermata o una selezione pi� piccola. Durante la cattura completa, modifiche, navigazione o cambio scheda annullano l?operazione; lo scorrimento viene comunque ripristinato quando possibile.

## Colori

**Colori** raccoglie un singolo pixel con il contagocce di Chrome, genera la palette di tutta la pagina con **Genera Palette** oppure estrae la palette degli stili di un elemento scelto con **Da elemento**. La selezione include testo, sfondi, bordi, ombre, gradienti, pseudo-elementi e SVG visibili, ma non analizza i pixel di immagini, video o canvas. Le pagine o iframe che Chrome non pu� ispezionare restano esclusi.

Il modulo converte HEX, RGB, HSL, OKLab, OKLCH e Display P3, mostra il colore Tailwind CSS 4 pi� vicino e include la palette Tailwind nella build. La cronologia locale conserva gli ultimi 50 colori senza URL n� contenuti della pagina; i duplicati risalgono in cima. Puoi rimuovere i singoli campioni, eliminare quelli selezionati o svuotare tutta la cronologia. Le palette estratte restano temporanee finch� non scegli **Salva selezionati**. La cronologia pu� essere esportata come codici, variabili CSS o classi Tailwind e copiata negli appunti.

## Codifica e converti

Incolla un valore in **Input**, scegli **Da** e **A**, quindi premi **Converti**. Sono disponibili Testo UTF-8, Base64 standard, URL encoded, Unicode escaped, HEX e Binario. **Inverti formati** scambia soltanto i selettori. **Copia** copia il risultato; **Usa come input** lo trasferisce nel campo iniziale e imposta la conversione dal suo formato verso il testo (verso Base64 se è già testo), senza eseguirla. Puoi poi scegliere un'altra destinazione, ad esempio Base64 → HEX. JSON, spazi e ritorni a capo sono trattati come testo e non vengono riformattati.

Le conversioni passano dai byte: Base64, HEX e Binario possono rappresentare anche dati non UTF-8. La destinazione testo o Unicode escaped richiede invece UTF-8 valido. HEX accetta coppie di cifre con spazi ASCII e produce una stringa minuscola senza `0x`; Binario accetta gruppi multipli di otto bit e produce byte separati da spazi. Base64 accetta spazi ASCII e padding omesso se ricostruibile, ma rifiuta valori non canonici e Base64url. URL encoded usa `%20` per gli spazi e mantiene `+` letterale in lettura; `%HH` rappresenta un byte. Unicode escaped produce `\uXXXX` (coppie surrogate per emoji) e accetta anche testo misto, `\u{...}` ed escape JSON standard.

La modalità **Hash** genera MD5, SHA-256, SHA-512 o SM3 in HEX minuscolo, sul contenuto esatto dell'Input come testo UTF-8, senza decodifica implicita. È possibile elaborare anche una stringa vuota. Gli errori sono inline e non cancellano l'input. Modificare input, modalità o parametri invalida il risultato precedente. Il suggerimento di formato appare soltanto per contenuti riconoscibili e leggibili, fino a 64 KiB, e prepara una conversione in testo senza avviarla.

Tutto avviene localmente, senza rete, logging, analytics o cronologia. Input e risultato restano nella memoria del componente; cambiare scheda Chrome li conserva, uscire dalla utility o chiudere il pannello li elimina. Non vengono letti dati della pagina e non sono richiesti nuovi permessi. **Incolla** legge gli appunti soltanto al clic: se Chrome lo impedisce, usa **Ctrl+V** nel campo Input. In caso di copia negata, il risultato rimane selezionabile manualmente.

## Generatore password

**Generatore password** crea password nel browser con `crypto.getRandomValues()`, senza `Math.random()` e senza inviarle a server esterni. All’apertura è già presente una password di 16 caratteri; lunghezza, gruppi (numeri, minuscole, maiuscole, simboli) e regole si aggiornano dal vivo, anche mentre regoli lo slider. Nella riga **Simboli** puoi modificare l’alfabeto usato (di fabbrica `!@#$%^&*()-_=+[]{};:,.<>?`); un set vuoto con i simboli attivi mostra un errore inline. L’ingranaggio apre **Impostazioni generatore**, con le stesse opzioni del pannello; **Ripristina valori predefiniti** torna ai valori di fabbrica, incluso il set di simboli. **Genera** estrae un nuovo valore con le stesse opzioni; **Copia** copia quello mostrato, anche se è nascosto, e non rigenera. Puoi escludere caratteri simili (`o O 0 i I l 1`), sequenze evidenti (`abc`, `123` e analoghe anche all’indietro) e ripetizioni, oppure imporre che la password inizi con una lettera. Se la combinazione è impossibile (nessun gruppo, lunghezza troppo corta, regole troppo strette) compare un errore inline e **Copia** resta disabilitato. La robustezza (Debole, Media, Buona, Robusta) valuta la stringa effettiva. Restano in `storage` solo le opzioni, mai la password: uscire dallo strumento la elimina. Non legge la pagina e non richiede nuovi permessi. Lunghezza da 4 a 64 caratteri.

## QR code

**QR code** crea codici QR statici per URL, testo, Wi-Fi, contatti vCard, email, telefono e SMS. Nella scheda **Crea** puoi scegliere forma e colore dei moduli, degli angoli e dello sfondo (colore unico o gradiente), la dimensione, il margine e il livello di correzione errori. I preset **Classico**, **Arrotondato**, **Extra arrotondato**, **Classy** e **Punti** partono da stili predefiniti. **Salva preset** compare solo se lo stile attuale non coincide con un preset predefinito o già salvato: logo e contenuto del QR non entrano nel confronto. Il logo PNG, JPEG o SVG resta solo nella sessione corrente e non entra nei preset: con un logo la correzione errori passa ad **Alto**.

L’anteprima si aggiorna mentre scrivi: PNG, SVG e copia sono disponibili appena il QR è generato. Lo sfondo può essere trasparente. Nessun QR viene inviato a servizi esterni.

Nella scheda **Leggi**, **Ispeziona QR nella pagina** mostra un mirino: punta un QR visibile, clicca per acquisirlo, usa ↑ per ampliare la selezione, ↓ per tornare al livello precedente ed Esc per annullare. La lettura usa i pixel dell’elemento selezionato, quindi include immagini, SVG e canvas visibili; il QR deve essere completamente visibile e non coperto. Puoi anche caricare PNG, JPEG o SVG oppure incollare un’immagine con Ctrl+V. Il risultato resta temporaneo nel pannello: puoi copiarlo e aprire esplicitamente solo gli URL HTTP(S). Nessun QR, immagine o contenuto letto viene inviato a servizi esterni o salvato in modo permanente.

## Contrasti

Apri il pannello e scegli **Contrasti**. I campi **Testo** e **Sfondo** partono da nero su bianco. Puoi digitare un HEX, copiarlo, scambiare i due colori o usare il contagocce di Chrome su ciascun campo: il rapporto WCAG 2.1 e i badge AA/AAA (testo normale, testo grande) e 1.4.11 (non-testo) si aggiornano subito. Una riga di anteprima mostra la coppia scelta.

**Da elemento** inietta un mirino sulla pagina attiva: clic o Invio campionano `color`, lo sfondo composto sugli antenati e le propriet� del font. ? amplia, ? restringe, Esc annulla. Immagini, gradienti o sfondi ancora trasparenti producono un avviso: il HEX � lo stile calcolato, non il pixel. In quel caso usa il contagocce.

Il cambio scheda o la navigazione annullano selettore e contagocce e tolgono le propriet� del font; i due HEX restano. Non viene salvata una cronologia e non partono scansioni automatiche. Pagine Chrome, Web Store, file locali e iframe non accessibili restano esclusi. Il contagocce non � disponibile in ogni contesto Chrome: restano HEX e **Da elemento**.

## Ispeziona e salva

Apri il pannello e scegli **Ispeziona e salva**. Il pulsante **Seleziona** accanto al titolo attiva il puntamento in pagina: l'etichetta diventa **Clicca una sezione** e compare un overlay con guide tratteggiate, bordo arrotondato, padding e margin con i pixel su ogni lato, badge del radius, tooltip essenziale e coordinate. Passa col mouse sulle sezioni, usa le frecce del tooltip o ↑/↓ (anche dal pannello) per ampliare al contenitore padre o restringere. **Clicca** per fissare l'elemento: il mouse non cambia più la selezione e compare **Conferma** (sulla card in pagina e nel pannello). Regola ancora con ↑/↓, poi **Conferma** o Invio per catturare; Esc o **Annulla** chiudono l'ispezione senza PNG. Il clic non attiva link o pulsanti sottostanti. **Seleziona** di nuovo sostituisce la scheda precedente con una nuova ispezione.

Dopo la selezione il pulsante torna inattivo, l'overlay sparisce dalla pagina e il pannello mostra la scheda **Info** dell'elemento: tag, selettore, classi, tipografia, sfondo, bordo, spaziatura, effetti e layout. Un'anteprima PNG adattata al pannello (senza indicatori di ispezione e senza header o overlay fissi che coprono la selezione), **Copia codice** (snippet HTML+CSS del sottoalbero sanitizzato), **Scarica immagine** (PNG) e **Scarica codice** (file HTML) completano lo strumento. Gli elementi più alti o larghi del viewport vengono catturati a tasselli; compare un avviso solo se la resa visiva è limitata (overflow nascosto, elementi fixed molto grandi, iframe non accessibili).

Il cambio scheda o la navigazione invalidano selettore e snapshot; lo strumento resta selezionato nel catalogo. Shadow root chiusi e contenuti di iframe cross-origin non sono ispezionabili: in quel caso si seleziona solo l'elemento `<iframe>`. Lo snippet conserva gli URL originali delle immagini e non viene eseguito nel pannello. Nessun dato viene salvato in `storage` n� inviato a servizi esterni.

## Lorem Ipsum e Compila form

**Lorem Ipsum** genera da 1 a 100 paragrafi e conserva il testo nell?area selezionabile anche se Chrome non autorizza gli appunti. Il pulsante Copia genera sempre un testo nuovo.

Con **Compila form** scegli English o Italiano e premi **Seleziona elemento**. Il mirino evidenzia il punto: clic o Invio compilano il contenitore, ? sceglie il padre, ? un discendente ed Esc annulla. Riconosce i controlli HTML nativi da tipo, autocomplete, etichetta e attributi; riempie dati fittizi coerenti per ciascun form e invia gli eventi input/change, senza inviare il form. Select, radio e checkbox comuni sono supportati; consensi e termini, CAPTCHA, campi nascosti, file, disabilitati, readonly e widget non nativi restano esclusi. I frame cross-origin non possono essere compilati.

Le impostazioni dello strumento restano in locale: password prefissata (oppure una password casuale di 16 caratteri per form), parole da ignorare e opzione per preservare i campi gi� compilati. Non vengono conservati valori generati o dati delle pagine e non vengono contattati servizi esterni.

## Emoji

**Emoji** cerca nomi e parole chiave in italiano e inglese, filtra per categoria e tonalit� della pelle e copia la sequenza Unicode con un clic. Puoi anche trascinare un’emoji in normali campi testo, aree di testo e aree modificabili della pagina: editor complessi, campi non testuali e pagine Chrome o del Web Store possono rifiutare il rilascio. Le impostazioni dello strumento permettono di scegliere localmente una delle cinque dimensioni dell’anteprima (22, 32, 42, 52 o 60 px); 22 px � il valore iniziale. La griglia aumenta con l’anteprima e mantiene 6 px tra le emoji. Il sistema operativo decide l’aspetto e la disponibilit� delle emoji pi� recenti.

## Limiti e privacy

- Permessi API: `activeTab`, `scripting`, `sidePanel`, `downloads`, `storage`, `clipboardWrite`. `<all_urls>` � un permesso host **opzionale**: non viene concesso all?installazione e viene richiesto soltanto dal pulsante esplicito **Abilita su tutti i siti**; pu� essere revocato nelle impostazioni senza rimuovere le autorizzazioni gi� concesse a singoli siti. `clipboardWrite` serve esclusivamente quando scegli esplicitamente **Copia negli appunti**. I selettori vengono iniettati soltanto all?avvio dello strumento, senza content script automatici.
- Nessuna archiviazione persistente delle immagini o degli URL nell?estensione. File e risultati sono temporanei nel pannello e vengono liberati all?uscita, cambio scheda o navigazione; la chiusura del pannello disconnette anche il selettore. Il recupero dei metadati e i download contattano il server dell?immagine; non vengono usati servizi esterni di analisi. I file scaricati e la cronologia download restano gestiti da Chrome.
- Scansione su richiesta, nei documenti accessibili e negli shadow root aperti. I frame cross-origin sono elencati tramite il loro elemento contenitore; i discendenti non leggibili non sono inclusi. Il pannello segnala i contenuti inaccessibili o non ancora caricati.
- Livello 0 indica un iframe nel documento principale. Le righe duplicate rappresentano elementi distinti.
- URL sorgente risolto rispetto alla base del documento; non garantisce la destinazione dopo redirect. Iframe inline, senza sorgente o con schemi diversi da HTTP/HTTPS non hanno un pulsante Apri attivo.
- Le pagine Chrome e il Web Store non sono analizzabili.

## Aggiungere uno strumento

Le istruzioni operative per gli agenti AI sono in [AGENTS.md](AGENTS.md), alla radice del progetto. Gli agenti che supportano questo formato le leggono come istruzioni del repository: richieste come �aggiungi questa funzionalit� o �aggiungi un pulsante� rimandano al flusso per nuovi strumenti, senza dover incollare ogni volta queste indicazioni. Per altri assistenti, indica esplicitamente di leggere `AGENTS.md`.

Crea un componente in `src/tools/nome/NomeTool.tsx`:

```tsx
export function NomeTool() {
  return <section><h2>Il mio strumento</h2><p>Contenuto dello strumento.</p></section>;
}
```

Importalo in `src/tools/registry.ts` e aggiungi una definizione all?array `tools`:

```tsx
{ id: 'nome', name: 'Il mio strumento', description: 'Cosa fa.', icon: IconaLucide, component: NomeTool }
```

Usa un identificativo unico e importa `IconaLucide` da [`lucide-react`](https://lucide.dev/icons/); tutte le icone visibili nel pannello usano quel provider. `PocketKnife` � l'icona primaria dell'estensione e compare anche nell'azione Chrome. Catalogo, ricerca e navigazione funzionano senza ulteriori modifiche. Ogni componente gestisce il proprio stato e rimuove i listener quando viene smontato. Le funzioni comuni per scheda attiva, apertura URL e messaggi di errore sono in `src/lib/browser.ts`. Gli strumenti sono inclusi nella build, senza caricamento di codice remoto. Eventuali nuovi permessi vanno valutati per la nuova funzione.

## Verifica manuale in Chrome

1. Caricare la build e verificare che l?icona apra il pannello.
2. Analizzare pagine senza iframe e con iframe same-origin/cross-origin, annidati e dinamici; premere Aggiorna dopo modifiche.
3. Verificare apertura in nuova scheda e invalidazione al cambio scheda o navigazione, anche durante una scansione.
4. Provare il consenso globale assente, accettato, negato e revocato. Passare tra due siti durante iframe, screenshot e selettore multimediale: nessuna operazione deve partire da sola e risultati/selettori precedenti devono sparire.
5. Provare una pagina `chrome://`, il Web Store e un file locale: verificare i messaggi e che rimangano esclusi anche con l?accesso globale.
5. Usare Tab, Invio e Spazio; verificare ritorno del focus al pulsante strumento, pannello stretto, zoom 200% e tema chiaro (anche con sistema scuro).

I test automatici coprono la scansione e il ciclo di vita del pannello con API simulate; non sostituiscono i permessi e il comportamento nativo del pannello in Chrome.

Il test browser opzionale `scripts/browser-smoke.cjs` richiede Playwright e Chromium. Imposta `SWISS_NODE_MODULES` sulla cartella `node_modules` che contiene Playwright e avvia `node scripts/browser-smoke.cjs`. Carica la vera estensione in un profilo temporaneo e prova anche una pagina locale con iframe. Lo script `scripts/icons.cjs` usa la stessa variabile per trovare Sharp e rigenerare le icone gi� incluse.

Lo script storico `scripts/image-picker-smoke.cjs` prova la parte immagini in un browser locale. Non eseguirlo quando � richiesta una verifica esclusivamente via CDP sulla scheda collegata.

Verifica manuale immagini: provare sfondi multipli, pseudo-elementi, `picture`, iframe same-origin/cross-origin, shadow DOM, URL `data:`/`blob:`, autorizzazioni negate e accettate, file protetti o non disponibili, annullamento download e navigazione durante il recupero. Controllare anteprime, nomi e peso dei file salvati, tema chiaro (anche con sistema scuro), larghezza 320 px e tastiera.

Prova reale eseguita il 6 settembre 2026 via CDP nella scheda Chrome Almo Nature gi� aperta, senza avviare browser locali: selezione del carosello tramite ? e Invio, tre video distinti trovati (anche nelle slide fuori vista), con risoluzione 1920 � 1080 e durata dalla pagina; clic su contenitore temporaneo con due immagini, audio e video, tutti raccolti; il clic non raggiunge la pagina; Esc annulla e rimuove il mirino. Fixture e codice di prova sono stati rimossi al termine. Il bundle di prova `scripts/media-picker-cdp-entry.ts` importa il selettore di produzione e lo esegue in un isolated world della scheda: verifica il selettore reale e il DOM reale, non il gesto `activeTab`, i dialoghi dei permessi, i download o il pannello nativo dell?estensione.
