# Controllo antiregressivo dopo PR #162 — 15 novembre 2026

Base verificata: `50096dfab8b76145fff2fa0c4fd5648f49a62581`, squash della PR #162. Correzioni sul branch `fix/regional-postmerge-20261115`, non ancora integrate in main. Il successivo main `5e3401e` aggiunge messaggeri/documentazione, equipaggiamento a cavallo e pattuglie sulle mura: questo audit resta riferito al commit regionale, non certifica quelle aggiunte.

## Esito e difetti riprodotti

| Priorità | Difetto su base | Correzione nel branch | Prova |
|---|---|---|---|
| Alta | Un bordo montuoso disconnette un tratto a monte e cancella tutto il fiume regionale (Colline, seed 1, montagne N, fiume E). | Conservato il tratto connesso più lungo e sufficientemente esteso. Se esiste una foce, resta soltanto la componente che raggiunge quella foce. Nessun attraversamento del rilievo. | Nuovo test prima FAIL, dopo PASS; fixture reale: 4 colline, 32,95% copertura, 1 fiume e 1 torrente. Verificati anche ostacolo completo, monconi troppo corti, foce e sponde libere. |
| Alta | Il renderer chiama `map(forestTreeLayout)`: l'indice del bosco diventa il parametro `bounds`, eliminando le chiome dei boschi successivi quando la cache è calda. | Callback esplicita e validazione del rettangolo opzionale. Nessuna modifica alla densità, ai cespugli o alla geometria del layout. | Riproduzione sulla base FAIL con cache calda; nuovo test PASS con cache fredda/calda, interrogazione locale e successivo render completo. |
| Media | Il selettore mostra Montagne e nasconde Colline, contrariamente ai quattro biomi terrestri condivisi con la regione. | Pianura, Colline, Foresta, Palude; valori legacy conservati nascosti/disabilitati. Link demo e descrizione del pulsante regionale corretti. | Nuovo test del menu prima FAIL, dopo PASS; verificati menu e apertura reale di un territorio Colline. |

## Suite automatica

Eseguiti tutti i **199** file `qa/*-regression.cjs` della base, con Node 26.13.0 su Windows. Prima esecuzione: 194 PASS, quattro errori di confronto testuale dovuti al checkout CRLF, un errore prestazionale. Ripetuti con file LF, i quattro test (`built-portico`, `ci-p1`, `dovecote`, `falconry`) passano. Risultato consolidato della base: **198/199 PASS**.

Il limite residuo riguarda `founding-regression.cjs`: la ripianificazione stradale può superare i 100 ms per singola fase. Riproduzione anche con Node 22.23.5: picco 112,85 ms. Sul parent pre-merge `a0ed0c7`, stesso Node e stesso test: 5/5 controlli PASS, picchi 11–12 ms nei primi due scenari. Le mappe più ricche aumentano anche il lavoro totale (circa 4.244 fasi contro 436 nella pianura campionata). Un'esecuzione strumentata passa, quindi il picco è variabile; non è una garanzia di fluidità.

Ipotesi verificate: ricerca percorso, semplificazione, applicazione finale. I campioni lenti ricadono nella ricerca percorso. Una prova temporanea con pausa a ogni nodo invece che ogni quattro non risolve il problema (picco 196,94 ms): **scartata**, nessuna modifica al planner e nessun allentamento della soglia. Il limite era già annotato nella preparazione della PR regionale; resta aperto.

Sul branch vengono aggiunti tre test per selettore, drenaggio e chiome, anche nel workflow Sea. Ripetizione completa dei 202 test: esito riportato nella voce di stato del branch e nel riepilogo finale della PR. I test specifici hydrology-network, landscape-order, water-surface, tree-density-balance e builder-placement sono PASS dopo le correzioni.

## Browser reale

Playwright/Chrome locale; browser integrato Codex indisponibile. Otto scenari regionali prima/dopo, cinque ulteriori scenari idrici e navigazione dalla regione alla zona. Nessun errore JavaScript osservato; avviso WebGPU non bloccante. Le demo non modificano localStorage tramite salvataggio locale/cloud. Nessun pannello quantitativo demo reintrodotto.

| Scenario corretto | Colline | Copertura colline | Boschi | Acquitrini | Torrenti | Fiumi |
|---|---:|---:|---:|---:|---:|---:|
| Pianura 12345 | 1 | 2,02% | 19,82% | 0% | 3 | 0 |
| Colline 4 | 7 | 32,56% | 24,75% | 0% | 1 | 0 |
| Foresta 4242 | 2 | 3,77% | 74,22% | 0% | 2 | 0 |
| Palude 4242 | 0 | 0% | 24,81% | 23,98% | 0 | 0 |
| Isola 4242 | 3 | 1,73% | 4,90% | 0% | 0 | 0 |
| Penisola 4242 | 3 | 1,80% | 9,42% | 0% | 0 | 0 |
| Colline + catena 229 | 4 | 32,39% | 24,74% | 0% | 2 | 0 |
| Colline + catena + fiume 1 | 4 | 32,95% | 24,71% | 0% | 1 | 1 |

Le percentuali sono campioni della superficie dell'intero buffer 200×200, **acqua compresa**, non della sola terra o buildable zone; le quote costiere non sono confrontabili direttamente con quelle interne. Nessuna modifica quantitativa introdotta con questo audit. Le due scene con catena contengono 16 elementi montuosi. Controllati visivamente almeno cinque screenshot finali dopo la correzione delle chiome.

Navigazione reale: individuate 120 celle mare e 25 Colline; clic mare e Shift+clic non selezionano l'acqua, trasformare la cella selezionata in mare disabilita l'apertura. Aperto poi un territorio Colline: bioma hills e contesto degli otto vicini trasmessi. Il selettore resta modificabile come previsto dal DEV corrente; il test non introduce un vincolo di blocco. Il caso lago non è stato simulato con un pulsante inesistente: coperto dalle regressioni regionali automatiche.

Scenari idrici aggiuntivi: delta marino con almeno due diramazioni, foce lacustre diretta senza delta, tre confluenze; tutti PASS. Non è una certificazione di ogni combinazione possibile di seed e otto vicini, né un test multiplayer/cloud live.

## Asset Lab e baseline

Audit completo sulla base: **572 asset, 1.612 render, 0 errori, 157 avvisi, 1 deroga nota, 12 nuovi, 543 cambiati, 2 assenti dalla baseline**. Esaminati i 18 fogli provini, inclusi fortificazioni, natura, territorio, produzione, popolazione, fauna e scatter. Non confondere assenza di errori bloccanti con approvazione di tutte le differenze.

- 114 avvisi di cantiere progressivo, 33 di danno poco visibile e 10 schemi illustrativi; in aggiunta 1 controllo con deroga. Il campione torre `castle:pietra-quadrata-l2` riproduce l'avviso di cantiere anche sul parent `a0ed0c7` (9 render, 0 errori, 1 avviso): non attribuito automaticamente al merge regionale. Le firme non sono tutte identiche (2/9), quindi resta una verifica di categoria dell'avviso, non equivalenza completa.
- I 543 cambiamenti si distribuiscono fra Fortificazioni (509), Edifici (20), Natura (14). I 12 nuovi sono viste inclinate aggiuntive di quattro modelli. Restano da riconciliare con la baseline salvata: nessuna accettazione massiva.
- Due ID SVG storici non presenti nel catalogo corrente: `file:src/assets/economy/logging_camp.svg` e `file:src/assets/economy/stone_quarry.svg`. I corrispondenti modelli produttivi sono visibili nel foglio; non si è osservato un errore di caricamento richiesto dall'audit. Non eliminati automaticamente dalla baseline.
- Audit mirato sul branch corretto: **16 render Territorio, 0 errori, 5 avvisi di schema, 0 nuovi/cambiati/assenti**. Aggiornata soltanto la nota di revisione della baseline; firme e deroga esistenti preservate. I renderer procedurali sono schemi nel Lab: le otto scene reali integrano questa limitazione.

## Riproduzione e prove locali

- `node qa/biome-selector-regression.cjs`
- `node qa/forest-canopy-query-regression.cjs`
- `node qa/regional-boundary-drainage-regression.cjs`
- `node qa/founding-regression.cjs` (limite prestazionale aperto; non mascherato).
- `qa/postmerge-regression.browser.js` e `qa/postmerge-navigation.browser.js`: callback Playwright per server sulla porta 4199. Gli scenari idrici riusano `qa/hydrology-network.browser.js` con il server corrispondente.
- Audit Lab: `node qa/asset-audit.mjs`; `--category=Territorio` per il controllo mirato, Chrome e URL via `QA_CHROME`/`ASSET_LAB_URL`.

Artefatti locali (non versionati): worktree fratello `CONQUER-regression-20261115/output/regression-20261115/` (suite base, confronti prestazionali), `output/playwright/postmerge-full-audit/` (report e 18 fogli), `output/playwright/postmerge-fixed-*.png` (otto screenshot finali), `postmerge-water-*.png` (cinque scenari idrici), `postmerge-regional-launch.png`. Nel worktree delle correzioni: `output/regression-fixed-20261115/` e `output/playwright/postmerge-terrain-audit/`.

Roadmap e decisioni di prodotto invariate: le correzioni applicano i contratti esistenti. Nessun nuovo merge/deploy autorizzato da questo controllo.
