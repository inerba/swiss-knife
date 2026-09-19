# Swiss Knife

Pannello laterale Chrome di strumenti on-demand sulla pagina attiva. Nessun servizio esterno e nessuna integrazione con editor o agenti.

## Language

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
