# CONQUER Codex — Wiki e collegamenti

Implementazione su `feature/codex-wiki`, creata da main `15070d2` e comprendente la fase 2 della PR #161 e l'audit #159 (ancora non integrati all'avvio). Nessun merge in main implicito.

## Consultazione

- Pubblica: `/wiki/`, senza caricare partita, servizi cloud o dati personali.
- In-game: pulsante **Codex** nel menu (UI classica e UI2), lettore modale con chiusura, Escape e ritorno del focus. Link **Voce nel Codex** dal Builder e dall'inspector UI2.
- 136 schede, sette pagine di famiglia e otto percorsi trasversali: Fortificazioni, Produzione, Logistica, Popolazione, Combattimento e assedio, Navigazione e porti, Costruzioni, Conoscenze e tecnologie.
- Ricerca per testo e filtri famiglia/stato della voce. Ricerca, filtri e pagine sono nell'URL; reload, link condivisi e Indietro funzionano senza un router server.

## Hyperlink nel testo: contratto richiesto

Le keywords di sovracategoria nel testo sono link HTML reali, non pulsanti o tooltip. Nella scheda Torre, «fortificazioni» apre `#topic%3Afortifications`, «stanze» apre `#category%3Aroom`. I termini più specifici hanno precedenza: «ponte levatoio della porta» non viene spezzato in un link generico «porta». Il linker considera parole intere, maiuscole/minuscole, evita autolink alla pagina corrente e ripetizioni dello stesso target nello stesso paragrafo.

`src/codex-wiki-content.js` contiene solo terminologia e testi editoriali; non introduce prezzi/statistiche. Produce token testo/link, che la vista rende con escaping HTML. Non inserisce anchor dentro markup preesistente. Alias ambigui non sono risolti arbitrariamente. Ogni destinazione viene verificata nei test.

Ogni scheda include breadcrumb, link alla famiglia e ai percorsi di sovracategoria, relazioni del catalogo e rimandi inversi «Pagine che rimandano qui». I link funzionano anche in un'altra scheda del browser. Il testo esplicita le parti parziali senza attribuire nuove meccaniche ai soli modelli.

## Catalogo unico, due lettori

- In-game il frame same-origin usa `parent.ConquerGameCodex`: legge le definizioni live, senza fetch dello snapshot pubblico. Il bridge espone solo apertura/chiusura e una copia della struttura selezionata/slot; non espone comandi di acquisto o modifica.
- Il sito legge `wiki/catalog.json`, generato da `node tools/export-codex.cjs` sulle sorgenti reali tramite il runtime isolato `tools/codex-runtime.cjs`. Non avvia una partita nel browser né richiede un iframe nascosto del gioco.
- Lo snapshot generato è un artefatto di pubblicazione, mai una seconda sorgente mantenuta a mano. `node tools/export-codex.cjs --check` e le QA confrontano il contenuto atteso: cambiamenti alle definizioni richiedono rigenerazione e la CI blocca lo snapshot obsoleto. Il digest delle sorgenti è indipendente dai fine-riga Windows/Linux.
- I preventivi pubblici di riferimento sono ottenuti chiamando gli stessi provider con descrittori espliciti; la configurazione di esempio viene mostrata accanto al costo. Non sono prezzi universali per tutte le varianti. In-game, quando coincide la voce della struttura selezionata, viene letto il suo preventivo effettivo.
- Per le stanze è possibile scegliere lo slot della struttura selezionata e leggere `ConquerSiege.allowed`; per le navi la compatibilità del cantiere usa il provider esistente.

## UI e accessibilità

Layout a indice laterale e articolo, palette coerente con CONQUER, link sottolineati, focus visibile, controlli con label, layout mobile senza overflow, skip link, titoli del documento aggiornati, stati vuoto/errore con riprova. Nessuna animazione indispensabile. Dati dinamici e query vengono trattati come testo; i link interni derivano da ID del catalogo.

Nessun nuovo asset o renderer; le schede che hanno un modello rimandano all'Asset Lab. Non viene introdotto un secondo renderer per le anteprime.

## Verifica

- `node qa/codex-catalog-regression.cjs`: contratti della fase 2 e provider reali.
- `node qa/codex-wiki-regression.cjs`: 151 pagine, keyword di sovracategoria, match più lungo, confini di parola, link senza destinazioni mancanti, rimandi inversi, testo preservato, export aggiornato.
- `node tools/export-codex.cjs --check`: freschezza dell'artefatto pubblico.
- `node qa/codex-wiki-browser.mjs` (Playwright, server locale 4181): click hyperlink reali, Indietro, ricerca e filtri, reload URL, pagina mancante, query HTML, skip link, mobile 390px, errore fetch/riprova, lettore live senza fetch pubblico, Escape, link Builder e stato di partita invariato. Il file di controlli condiviso è eseguito anche localmente attraverso Playwright CLI.
- Workflow `Codex Wiki browser` aggiunto; controlli deterministici anche in `Runtime integrity`.

Screenshot locali/CI: `output/playwright/wiki-desktop.png`, `wiki-mobile.png`. Revisionati a vista: pagina Torre desktop e Cocca mobile.

## Limiti dichiarati

Lo stato «Nel catalogo/Parziale/Previsto» riguarda la voce, non il possesso da parte del giocatore. Non si inventano stati conosciuto/sbloccato finché non esiste una mappatura delle conoscenze: viene indicato che le tecnologie devono ancora essere definite. La compatibilità contestuale è mostrata dove il gioco espone il predicato. Professioni individuali e ulteriori testi specialistici possono ampliare le schede in seguito.

Il sito è pronto nel repository sotto `/wiki/`; la disponibilità sul dominio pubblico segue il normale merge autorizzato in main e il suo deploy. Nessun deploy o merge è richiesto da questi test.

Evoluzione editoriale: [note Obsidian e import dal vault personale](CODEX-OBSIDIAN.md), D-CODEX-03. I testi delle schede non sono più mantenuti direttamente in codex-wiki-content.js.
