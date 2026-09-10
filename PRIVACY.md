# Informativa sulla privacy — Swiss Knife

**Ultimo aggiornamento:** 10 settembre 2026 · **Versione estensione:** 1.2.0

*(English version below.)*

## In sintesi

Swiss Knife **non raccoglie, non trasmette e non vende alcun dato personale.** Non esiste un
account, non c'è alcuna registrazione e nessuna informazione lascia il dispositivo dell'utente
per raggiungere gli sviluppatori o terze parti.

L'estensione non contiene strumenti di analisi, tracciamento o pubblicità.

## Dati trattati e dove restano

Tutti gli strumenti elaborano i contenuti **localmente, nel browser**. Le conversioni di testo,
il calcolo degli hash, la generazione delle password, la lettura dei QR code e l'analisi degli
elementi della pagina avvengono sul dispositivo e i risultati non vengono inviati da nessuna parte.

Nel profilo locale del browser (`chrome.storage`) vengono conservate soltanto le preferenze
scelte dall'utente:

- quali strumenti sono visibili e in quale ordine;
- i preset di stile dei QR code;
- la cronologia colori, fino a un massimo di 50 voci;
- le opzioni dei singoli strumenti, tra cui la lingua e l'eventuale password di prova dello
  strumento «Compila form».

Questi valori restano nel profilo del browser dell'utente, sono cancellabili disinstallando
l'estensione o svuotandone i dati, e non sono accessibili agli sviluppatori.

I risultati delle analisi sulla pagina (screenshot, palette estratte, elementi ispezionati,
elenchi di iframe) sono temporanei e vengono invalidati al cambio scheda o alla navigazione.

## Richieste di rete

L'estensione non contatta alcun server degli sviluppatori. Le uniche richieste di rete che
possono avvenire sono conseguenza diretta di un'azione dell'utente:

- **Cattura file multimediali** — per leggere formato, dimensioni e peso di un file selezionato
  dall'utente, l'estensione può contattare il server che ospita quel file. Le richieste non
  includono credenziali, non seguono reindirizzamenti e sono limitate a 32 MiB per file.
- **Download** — i file salvati passano dal gestore download del browser e raggiungono soltanto
  i server che ospitano le risorse richieste.

In entrambi i casi il destinatario è il sito da cui l'utente ha scelto di scaricare, mai un
servizio degli sviluppatori.

Il catalogo emoji è incluso nel pacchetto dell'estensione e non richiede connessione.

## Autorizzazioni e loro scopo

| Autorizzazione | Scopo |
| --- | --- |
| `activeTab` | Accesso temporaneo alla scheda, concesso dal clic dell'utente sull'icona dell'estensione. |
| `scripting` | Esecuzione degli strumenti sulla pagina, solo quando l'utente avvia un'azione specifica. |
| `sidePanel` | Apertura del pannello laterale che costituisce l'interfaccia. |
| `downloads` | Salvataggio dei file richiesti esplicitamente dall'utente. |
| `storage` | Conservazione locale delle preferenze elencate sopra. |
| `clipboardWrite` | Copia negli appunti dei risultati, su richiesta dell'utente. |
| `<all_urls>` (facoltativa) | Non concessa all'installazione. Viene richiesta solo se l'utente sceglie «Abilita su tutti i siti» ed è revocabile in qualsiasi momento dalle impostazioni del browser. |

L'estensione non richiede l'accesso in lettura agli appunti.

## Cessione a terzi

Non vendiamo, non cediamo e non trasferiamo dati degli utenti a terze parti, per alcuna
finalità. Non utilizziamo dati degli utenti per valutare l'affidabilità creditizia né per
finalità di prestito. Non esistendo raccolta di dati, non esiste alcun flusso verso l'esterno.

## Minori

L'estensione è uno strumento di utilità generale, non è rivolta specificamente ai minori e non
raccoglie consapevolmente dati di alcuna persona, minore inclusa.

## Modifiche

Eventuali aggiornamenti di questa informativa saranno pubblicati in questo stesso file, con la
data di revisione aggiornata in testa.

## Contatti

Per domande o segnalazioni sulla privacy: <https://github.com/inerba/swiss-knife/issues>

---

# Privacy Policy — Swiss Knife

**Last updated:** 10 September 2026 · **Extension version:** 1.2.0

## Summary

Swiss Knife **does not collect, transmit or sell any personal data.** There is no account and no
sign-up, and no information leaves the user's device to reach the developers or any third party.

The extension contains no analytics, tracking or advertising components.

## What is processed, and where it stays

Every tool processes content **locally, in the browser**. Text conversions, hash computation,
password generation, QR code reading and page element analysis all happen on the device, and
the results are not sent anywhere.

Only user preferences are stored in the local browser profile (`chrome.storage`):

- which tools are visible and in what order;
- saved QR code style presets;
- the color history, up to 50 entries;
- per-tool options, including the language and optional test password of the "Compila form" tool.

These values remain in the user's browser profile, can be removed by uninstalling the extension
or clearing its data, and are not accessible to the developers.

Results of page analysis (screenshots, extracted palettes, inspected elements, iframe listings)
are temporary and are invalidated when the user switches tabs or navigates away.

## Network requests

The extension does not contact any developer-operated server. The only network requests that may
occur are the direct consequence of a user action:

- **Media capture** — to read the format, dimensions and size of a file the user has selected,
  the extension may contact the server hosting that file. Requests carry no credentials, do not
  follow redirects, and are limited to 32 MiB per file.
- **Downloads** — saved files go through the browser's own download manager and reach only the
  servers hosting the requested resources.

In both cases the recipient is the site the user chose to download from, never a service
operated by the developers.

The emoji catalog is bundled with the extension and requires no connection.

## Permissions and their purpose

| Permission | Purpose |
| --- | --- |
| `activeTab` | Temporary access to the tab, granted by the user's click on the extension icon. |
| `scripting` | Running the tools on the page, only when the user starts a specific action. |
| `sidePanel` | Opening the side panel that constitutes the interface. |
| `downloads` | Saving files the user explicitly requests. |
| `storage` | Local storage of the preferences listed above. |
| `clipboardWrite` | Copying results to the clipboard, at the user's request. |
| `<all_urls>` (optional) | Not granted at install time. Requested only if the user chooses "Enable on all sites", and revocable at any time from the browser settings. |

The extension does not request clipboard read access.

## Third parties

We do not sell, share or transfer user data to third parties for any purpose. We do not use
user data to determine creditworthiness or for lending purposes. Since no data is collected,
there is no outbound flow of user data at all.

## Children

The extension is a general-purpose utility, is not directed at children, and does not knowingly
collect data from anyone, children included.

## Changes

Any update to this policy will be published in this same file, with the revision date updated
at the top.

## Contact

Questions or privacy reports: <https://github.com/inerba/swiss-knife/issues>
