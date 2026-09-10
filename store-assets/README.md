# Asset promozionali — Chrome Web Store

Materiali per la scheda di **Swiss Knife 1.2.0**, in due varianti linguistiche (`it/` e `en/`).

## Cosa caricare dove

| Campo dello Store | File | Formato |
| --- | --- | --- |
| Screenshots (max 5) | `screenshot-1…5-*.png` | 1280×800, PNG 24 bit senza alpha |
| Small promo tile | `promo-small-440x280.png` | 440×280, PNG 24 bit senza alpha |
| Marquee promo tile | `promo-marquee-1400x560.png` | 1400×560, PNG 24 bit senza alpha |

Tutti i file sono già RGB a 24 bit (nessun canale alpha), come richiesto dallo Store.
Carica gli screenshot nell'ordine numerato: il primo è quello che compare più in grande
nella scheda ed è quello che spiega il prodotto in una riga.

## Da dove vengono le immagini

Il pannello mostrato è l'interfaccia **reale** della build `swiss-knife-1.2.0-chrome.zip`,
caricata in Chromium e catturata a 3× (400×640 px logici). Nessuna schermata è ridisegnata.

Il sito sullo sfondo è una pagina demo fittizia ("Atelier Verde") creata apposta: serve solo
a dare contesto e non riproduce marchi di terzi.

Il banner "Usa Swiss Knife su tutte le schede" è stato nascosto nelle catture perché dipende
dallo stato dei permessi e occupa spazio verticale senza aggiungere informazione.

## Le cinque schermate

1. **Catalogo** — i 12 strumenti nel pannello. Comunica l'ampiezza in un colpo d'occhio.
2. **Colori** — contagocce, codice colore, classe Tailwind più vicina.
3. **QR code** — QR generato davvero (preset Extra arrotondato, colore `#6366f1`) con i controlli di personalizzazione.
4. **Contrasti** — rapporto di contrasto ed esiti AA/AAA.
5. **Emoji** — ricerca in italiano con i risultati per "cuore".

## Note sui testi

- I claim usati nelle pill sono verificabili dal README: `Nessun account`, `Nessun tracciamento`, `Manifest V3`.
- Non è stato usato il claim "Open source": il repository non contiene un file di licenza.
  Se ne aggiungi uno (es. MIT), la pill può essere reintrodotta.
- Le schermate della variante `en/` mostrano comunque l'interfaccia in italiano, perché
  l'estensione è localizzata solo in italiano. Vale la pena dichiararlo nella descrizione
  della scheda in inglese, per evitare recensioni negative da fraintendimento.

## Catture aggiuntive disponibili

Oltre alle cinque scelte, sono state catturate anche: Generatore password, Codifica e
converti, Screenshot e Cattura file multimediali. Se vuoi sostituire una delle cinque,
si ricompongono con la stessa impaginazione.
