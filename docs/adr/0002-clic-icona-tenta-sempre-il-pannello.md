# Il clic sull’icona tenta sempre di aprire il pannello laterale

In `action.onClicked` Chrome accetta `sidePanel.open()` solo se è chiamato in modo sincrono. La modalità di apertura sta invece in `storage`, che si legge solo in modo asincrono. Il service worker, inoltre, si spegne dopo 30 secondi e perde ogni valore in memoria. `openPanelOnActionClick: true` non è una via d’uscita, perché sopprime `onClicked` e non concede `activeTab`.

Per questo il clic chiama sempre `sidePanel.open()` in modo sincrono, poi legge la modalità e, se è Finestra mobile, apre o chiude la finestra nella scheda. In modalità Finestra mobile il pannello è disattivato con `sidePanel.setOptions({ enabled: false })`, così il tentativo fallisce senza effetti. L’impostazione va riapplicata all’installazione e all’avvio.

Sulle pagine dove non si può iniettare nulla (chrome://, Web Store) il pannello viene riattivato solo per quella scheda e aperto nello stesso gesto. Se la finestra non si avvia entro circa 3 secondi, la pagina mostra un avviso e il clic successivo su quella scheda apre il pannello.

## Considered Options

- **Popup «lanciatore» con `action.setPopup`**: gestisce meglio gli errori, ma a ogni apertura mostra per un istante un riquadro sotto l’icona.
- **Valore in memoria nel service worker**: quasi sempre vuoto, perché la maggior parte dei clic arriva a service worker spento.

## Consequences

- In modalità Finestra mobile Swiss Knife non compare nel menu dei pannelli laterali di Chrome.
- Resta da provare in Chrome che `sidePanel.open()` fallisca senza effetti quando il pannello è disattivato.
