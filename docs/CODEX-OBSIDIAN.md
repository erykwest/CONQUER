# CONQUER — contenuti Obsidian della Wiki

Implementazione sul branch `feature/codex-obsidian`. Comprende catalogo e Wiki delle PR #159/#161/#163, ancora aperte all'avvio. Non implica un merge o un deploy.

## Dove si scrive

Il vault dedicato CONQUER è la cartella scelta dall'utente in Obsidian. È la fonte di scrittura dei contenuti: descrizioni di edifici, funzionamento, meccaniche, consigli e collegamenti. La copia `content/codex/` nel repository è la versione di pubblicazione sottoposta a Git e CI; non è un secondo vault da mantenere manualmente.

Il percorso personale è conservato soltanto in `.codex-vault.local.json` (ignorato da Git), oppure può essere passato con `--vault` o `CONQUER_CODEX_VAULT`. Le impostazioni `.obsidian`, il workspace, la cache e il registro locale della sincronizzazione non sono pubblicati.

Le 154 note sono piatte: 136 voci, 7 famiglie, 8 meccaniche/sovracategorie, CONQUER Index, Guida Editoriale e Modello Scheda. Indici, wikilink e backlink organizzano la lettura. Le cartelle e i documenti preesistenti del progetto nel vault personale restano fuori dall'importazione editoriale.

## Dal vault alla Wiki

`node tools/import-codex-vault.cjs` legge il vault configurato, valida l'intero insieme e importa le note Codex nel repository. Rigenera `src/codex-wiki-editorial.js`, usato dalla Wiki pubblica e dal lettore in-game. Non scrive mai nel vault dell'autore. La variante `--check` verifica lo stato senza modificare file.

L'importazione registra una base locale di confronto in `.codex-vault-sync.json`, ignorata da Git. Se la copia nel repository è stata modificata dopo l'ultimo import, si ferma senza sovrascriverla. Un salvataggio concorrente in Obsidian viene rilevato prima di applicare i file. Una rinomina importa il nuovo nome e rimuove soltanto la vecchia copia di pubblicazione già tracciata dalla base; non elimina note dal vault.

La prima importazione non sovrascrive copie già differenti: può inizializzare la base solo con copie uguali o una destinazione vuota. I conflitti richiedono una riconciliazione esplicita, non una scelta automatica di quale testo perdere.

`node tools/export-codex-content.cjs` rigenera invece l'artefatto dalla copia di pubblicazione già importata. `--check` confronta l'output atteso e fallisce se è obsoleto. Le modifiche restano sul branch e passano da normale PR/CI; salvare una nota in Obsidian non pubblica automaticamente su main.

## Proprietà e approvazione

Ogni nota pubblicabile ha `codex_id`, `kind`, `title`, `editorial_status` e `aliases`.

- ID indipendente da titolo e nome file. Le voci entry devono corrispondere a elementi effettivi del catalogo.
- Kind entry/category/topic; le sette famiglie esistenti restano riservate, le nuove meccaniche usano topic.
- Stato draft/review/approved. Solo approved entra nell'artefatto pubblico; guide/index/template sono esclusi.
- Ogni voce del catalogo richiede una nota approvata per pubblicare un'enciclopedia completa. Non si sostituisce una voce con testo inventato quando manca la sua scheda.
- Un collegamento da una nota approvata a una bozza, a un ID duplicato, a una nota ambigua o inesistente ferma la compilazione.

Il parser supporta un sottoinsieme esplicito di frontmatter: proprietà scalari semplici o tra virgolette e liste di stringhe inline o su più righe, compatibili con le proprietà di Obsidian. Costrutti YAML avanzati vengono rifiutati con errore di file/riga.

## Link e Markdown

Supportati `[[Nota]]`, `[[Nota|testo]]`, `[[Nota#Sezione|testo]]` e `[[#Sezione]]`. La risoluzione usa prima il nome file esatto, poi titolo e alias; un riferimento ambiguo non viene deciso arbitrariamente. I link compilati usano gli ID stabili della Wiki. La destinazione di sezione è validata e conserva URL, scroll e focus.

I corpi delle note supportano paragrafi, titoli di secondo/terzo livello, elenchi semplici, grassetto, corsivo e testo inline tra backtick. Il testo viene escapato prima della formattazione. HTML non viene eseguito; embed e blocchi di codice non sono supportati dalla pubblicazione. Le sezioni finali Collegamenti e Voci contengono liste di wikilink: alimentano relazioni e indici delle meccaniche senza duplicare le relazioni di gameplay.

`src/codex-wiki-content.js` ora contiene la logica di navigazione/link, non i testi delle schede. Anche titoli e alias provengono dalle note. Restano nell'interfaccia soltanto le etichette operative, i messaggi di stato e le spiegazioni standard delle sezioni.

## Dati del gioco

Prezzi, tempi, statistiche e compatibilità continuano a provenire dal catalogo/provider del gioco. Le note non impongono un listino parallelo, non creano edifici e non sbloccano tecnologie. I preventivi pubblici indicano la configurazione di riferimento; il lettore in-game consulta il contesto della partita.

Sono state ampliate dal vault le note Torre, Fortificazioni, Costruzioni, Logistica e Navigazione e porti: spazi interni e accessi, materiali/manodopera, depositi/acqua, cantieri/varo/ormeggi. I contenuti descrivono il comportamento osservato nelle sorgenti della base e distinguono i residui, senza inventare nuove funzionalità.

## Verifiche

- `qa/codex-obsidian-regression.cjs`: modifica Markdown, alias anche come proprietà YAML multilinea, ID stabili dopo rinomina, draft esclusi, stati, link e sezioni validati, liste, output aggiornato.
- `qa/codex-vault-import-regression.cjs`: import a senso unico, esclusione documenti estranei, check senza scritture, conflitti, link rotti, rinomina e salvataggi concorrenti.
- `qa/codex-wiki-regression.cjs`: 151 pagine e collegamenti/backlink preservati.
- `qa/codex-wiki-browser.mjs`: link reali e link di sezione Obsidian, Back, ricerca/filtri, mobile, errori/riprova, lettore in-game e stato partita invariato.
- Controlli di freschezza e suite editoriali aggiunti a Runtime integrity e Codex Wiki browser.

I test temporanei validano il comportamento delle importazioni senza operare sul vault personale. I percorsi temporanei sono verificati prima della pulizia.
