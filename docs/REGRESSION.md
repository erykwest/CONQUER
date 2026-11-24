# Contratti e regressioni dei moduli

Ledger introdotto dal refactor `refactor/extended-ecc-20261124`. Eseguire dalla radice con Node; i comandi browser richiedono Playwright e un server statico locale su 4173. Non accedono alla produzione. I comandi sono coperti dall'autorizzazione al refactor; non richiedono amministrazione. La CI installa il browser tramite l'action condivisa.

## Snapshot e persistenza

- Consumer: `settlement-app-persistence`, UI legacy e `ui/game-api`/`shell`, pagine gioco e CAMP.
- Evidenza dipendenze: `rg -n 'ConquerSaveSnapshot|captureSettlementSave|saveCloud|saveLocal|ConquerSaveStatus' src`; `node tools/runtime-contract.cjs` verifica i provider nei due entry point.
- Accettazione: `node --test tests/extended-save.test.mjs tests/resource-ui.test.mjs tests/runtime-integrity.test.mjs`; `node qa/save-safety-regression.cjs`; `node qa/save-status-regression.cjs`; `node qa/commerce-skeleton-regression.cjs`.
- Propagazione: modifiche a formato, caricamento o stato di salvataggio richiedono anche Builder browser (indicatore UI2) e suite completa. Nessuna esenzione nel refactor corrente.
- Difetti coperti: SAVE-001 risposta di upload vecchia, SAVE-002 scritture concorrenti, SAVE-003 lettura fallita/obsoleta, SAVE-004 quota locale, SAVE-005 indicatore iniziale, UI-RESOURCE-001 testo salvato interpretato come HTML. Prove nei test Node nominati.

## Comandi e catalogo Builder

- Consumer: `settlement-builder-controls`, `settlement-app-input`, `ui/game-api`, `ui/builder-catalog`, `ui/shell`; gioco legacy/UI2 e CAMP.
- Evidenza: `rg -n 'ConquerBuilderCommands|ConquerBuilderControls|builder-catalog|cmd.builder' src`; `node tools/runtime-contract.cjs`.
- Accettazione: `node qa/builder-commands-regression.cjs`; `node qa/runtime-contract-regression.cjs`; `node qa/builder-menu-regression.cjs`; `node qa/builder-placement-regression.cjs`; `node qa/builder-commands-browser.mjs`.
- Propagazione: modifiche ai preset devono eseguire anche le regressioni di terraformazione, attraversamenti, industria, eventi e murature, incluse nella suite completa.
- Difetti coperti: BUILDER-001 comando indipendente dai selettori DOM; BUILDER-002 materiale tettoia applicato e ricordato; BUILDER-003 avvio reale della shell dopo estrazione del catalogo. Copertura VM e browser, non solo ricerca testuale.

## Geometria dei percorsi

- Consumer: `settlement-vehicles`, `settlement-diplomacy`, `settlement-road-sign-tests`; trasporto locale, mercanti, corrieri, carrettieri e convogli.
- Evidenza: `rg -n 'ConquerPath' src qa`; contratto dei tre consumer in `tools/runtime-contract.cjs`.
- Accettazione: `node qa/path-geometry-regression.cjs`; suite completa per haulage, diplomacy, dovecote, l1-carter-market, military-stables, road-sign-convoy e vehicles.
- Propagazione: ogni modifica richiede tutti i consumer, anche se le loro scelte di orientamento differiscono. PATH-001 caratterizza vertici, inversione, segmenti coincidenti e piccoli rispetto agli algoritmi precedenti.

## Mesh e facciate

- Consumer: renderer `settlement-civic3d`, `settlement-house3d`, `settlement-wood3d`, World3D e Lab; funzione gotica usata anche dal cutaway.
- Evidenza: `rg -n 'modelParts|gothicAssetSizeForLevel' src`; `node tools/runtime-contract.cjs`.
- Accettazione: `node qa/model-parts-regression.cjs`; `node qa/architecture-facade-regression.cjs`; `node qa/built-portico-regression.cjs`; `node qa/palisade-slope-regression.cjs`; `node qa/asset-audit.mjs` e revisione dei fogli nel Lab.
- Propagazione: cambio di helper o cache richiede tutti i renderer e l'audit visivo, non soltanto il consumer modificato. MESH-001 confronta gli array Float32 con l'espansione precedente per ogni modello e verifica isolamento tra registri e sostituzioni dei record.

## Runner e CI

- Consumer: tutte le suite deterministiche e workflow `Settlement routing and spawn regression`.
- Evidenza: `node tools/run-regressions.cjs --list`; `rg -n 'run-regressions|qa/\*-regression.cjs' .github/workflows tools`.
- Accettazione: `node qa/regression-runner-regression.cjs`; `node qa/ci-p0-regression.cjs`; `node qa/ci-p1-regression.cjs`; `node tools/run-regressions.cjs --report output/qa/regressions.json`.
- Propagazione: cambi a discovery/esecuzione richiedono l'intera suite. RUNNER-001 prova errore, segnale e fallimento di avvio senza interrompere le suite successive.

## Registrazione dell'esecuzione

I risultati osservati sono in [EXTENDED-REFACTOR-2026-11-24.md](EXTENDED-REFACTOR-2026-11-24.md) e negli artifact della PR. Il JSON della suite registra file, exit code, segnale e durata. Un modulo o un consumer non eseguito resta **NON VERIFICATO**. Le ricerche identificano chiamanti osservabili, non pretendono di dimostrare un grafo completo del JavaScript dinamico: la suite completa e il browser coprono tale limite nel refactor corrente.
