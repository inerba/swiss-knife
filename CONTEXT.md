# Swiss Knife

Estensione Chrome di strumenti on-demand sulla pagina, aperta nel pannello laterale o in una finestra mobile. Nessun servizio esterno e nessuna integrazione con editor o agenti.

## Language

### Apertura

**Modalità di apertura**:
Preferenza che stabilisce dove compare Swiss Knife al clic sull’icona dell’estensione: finestra mobile (predefinita) o pannello laterale.
_Avoid_: modalità di visualizzazione, layout, vista

**Pannello laterale**:
Il pannello nativo di Chrome accanto alle schede, condiviso da tutte le schede della finestra del browser.
_Avoid_: sidebar, barra laterale

**Finestra mobile**:
Finestra di Swiss Knife disegnata dentro la pagina di una scheda e trascinabile nell’area visibile. Appartiene a quella scheda e termina con la pagina che la contiene.
_Avoid_: popup, overlay, widget

**Staccare**:
Aprire Swiss Knife come finestra mobile nella scheda di lavoro partendo dal pannello laterale, una volta sola: la modalità di apertura non cambia.
_Avoid_: sganciare, popout, modalità temporanea

**Scheda di lavoro**:
La scheda su cui agiscono gli strumenti: nel pannello laterale quella attiva al momento dell’azione, nella finestra mobile quella che la contiene.
_Avoid_: scheda corrente, tab target

### Browser context

**Prompt per agente**:
Testo inglese assemblato in modo fisso: preambolo, eventuale richiesta di modifica copiata alla lettera, e un sottoinsieme predefinito dei fatti già raccolti sull’elemento. Non è una sintesi né un testo generato.
_Avoid_: AI prompt, prompt generato, sintesi, integrazione con l’agente

**Report completo**:
Il report Markdown tecnico inglese già prodotto dallo strumento Browser context: markup, CSS completo, selettori e metadati di pagina.
_Avoid_: dump, report tecnico (come nome distinto)

**Richiesta di modifica**:
Istruzione facoltativa scritta dall’utente su cosa cambiare nell’istanza selezionata. Entra nel prompt per agente alla lettera, in qualunque lingua.
_Avoid_: prompt utente, istruzione AI, sintesi della modifica

**Elemento selezionato**:
Nodo della pagina fissato e confermato, di cui lo strumento ha raccolto il contesto renderizzato.
_Avoid_: target, widget, componente
