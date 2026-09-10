# Generatore password — UI Includi/Regole, simboli e impostazioni

Data: 2026-09-10  
Stato: approvato in brainstorming  
Amenda: [2026-09-10-password-generator-design.md](./2026-09-10-password-generator-design.md)

## Problema

Le sezioni **Includi** e **Regole** sono illeggibili: sotto ogni toggle compare l’alfabeto intero, che va a capo in modo disordinato. Serve una lista densa da Impostazioni iOS, allineata a [design.md](../../../design.md). In più l’utente deve poter **editare i simboli** e definire (e ripristinare) i valori di default da un dialogo come **Compila form**.

## Obiettivi

- Righe Includi/Regole tipo Impostazioni iOS: titolo a sinistra, toggle a destra, niente alfabeti completi.
- Campo testo sui **Simboli** con il set `!@#$%^&*()-_=+[]{};:,.<>?`, modificabile al volo.
- Dialogo **Impostazioni** (ingranaggio nell’header) sullo stesso store del pannello.
- **Ripristina valori predefiniti** torna ai default di fabbrica, incluso il set simboli.
- `design.md` vince: toggle verdi 42×26, input inspector 28px / raggio 7px / mono 12px, card 16px, pill 30px.

## Fuori ambito

- Alfabeti numeri/lettere editabili.
- Due store distinti (sessione vs default). Pannello e dialogo condividono le stesse opzioni persistite.
- Passphrase, cronologia password, integrazione Compila form.

## Approccio

Lista raggruppata iOS sul pannello; stesso modello dati; dialogo Impostazioni come Compila form/Emoji (`tool-dialog` + `dialog-backdrop`). Un solo `passwordGeneratorPreferences`.

## Simboli

Nuovo campo opzioni: `symbolSet: string`.

Normalizzazione `normalizeSymbolSet(value)`:

- Rimuove spazi e a capo.
- Deduplica lasciando la prima occorrenza.
- Accetta qualsiasi carattere non bianco (anche lettere/cifre se l’utente le inserisce).
- Massimo 64 caratteri unici; il resto si tronca.
- Non stringa o assente in storage → `SYMBOLS` di fabbrica (`!@#$%^&*()-_=+[]{};:,.<>?`).
- Stringa presente, anche vuota dopo il trim: si conserva (vuota resta vuota). Un campo UI vuoto mentre **Simboli** è attivo è un errore di validazione, non un reset silenzioso.

`characterPools` usa `options.symbolSet` (già normalizzato) al posto della costante, poi applica **Escludi simili** se attivo.

Validazione aggiuntiva, messaggio esatto:

- Simboli attivi e set vuoto (dopo trim, prima del fallback di storage): `Inserisci almeno un simbolo.`

Live regen anche sul campo simboli (`input`). Persistenza debounce 300 ms invariata. **Copia** non rigenera.

Campo disabilitato se il toggle Simboli è spento; il valore resta visibile e si persiste comunque.

## Impostazioni

Header: titolo a sinistra, pulsante `Settings` a destra (`aria-label="Impostazioni generatore password"`), come Compila form.

Dialogo `role="dialog"` `aria-modal="true"`:

- Titolo **Impostazioni generatore**
- **Chiudi** (come Compila form)
- Lunghezza (slider + number, stessi bound 4–64)
- Includi: stessi quattro toggle; campo simboli sotto Simboli
- Regole: stessi quattro toggle con le descrizioni brevi
- **Ripristina valori predefiniti**: scrive `defaultPasswordGeneratorPreferences` (length 16, quattro gruppi on, `symbolSet` di fabbrica, simili e sequenze on, ripetuti off, inizia con lettera on), aggiorna subito il pannello e persiste

Pannello e dialogo sono la stessa `options`. Modificare nel dialogo aggiorna il pannello (e la password live) senza un secondo store.

## Interfaccia pannello (sostituisce i punti 4–5 della spec originale)

Toggle **a destra**, dimensioni `design.md`: track 42×26, raggio 26px, thumb 22×22 offset 2px, checked `translateX(16px)`, sfondo `--state-success`. Checkbox nativo stilizzato.

Due card (`radius-card` 16px, `border-base`, `shadow-sm`), una per **Includi** e una per **Regole**. Righe separate da `border-muted` 1px, padding 10×12, nessuna alfabeto sotto numeri/minuscole/maiuscole.

Riga **Simboli**:

```
Simboli                              [toggle]
[ campo mono ispezionabile, set corrente ]
```

Il campo è inspector input (`rgba(118,118,128,.10)`, height 28px, radius 7px, font mono 12px, focus `shadow-glow`). Non mostrare l’alfabeto filtrato dai simili come hint: si vede solo il set editabile.

**Regole:** titolo + una riga `11px` muted (testi già in spec originale). Nessun dump di caratteri.

## Preferenze

```ts
type PasswordGeneratorPreferences = PasswordOptions & { symbolSet: string };
```

`PasswordOptions` include `symbolSet`. `normalize` applica `normalizeSymbolSet`. Chiave storage invariata. Mai la password.

## Test

Oltre a quelli esistenti:

- `normalizeSymbolSet(' !aa@ @\n')` → `!a@`
- set personalizzato compare nella password quando Simboli è on
- Simboli on e campo vuoto → `Inserisci almeno un simbolo.`
- UI: nessun alfabeto `abcdefghijklmnopqrstuvwxyz` visibile in Includi; c’è `#pw-symbols-set`
- Impostazioni: apri, Ripristina riporta length 16 e `SYMBOLS`, chiudi
- CSS: toggle 42×26, `translateX(16px)`, riga con toggle a destra (non `grid-row: 1 / span 2` a sinistra)

## Documentazione

README: simboli editabili, dialogo impostazioni, Ripristina. `AGENTS.md` invariato.
