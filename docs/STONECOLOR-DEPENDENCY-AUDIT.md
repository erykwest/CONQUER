# STONECOLOR — Audit dipendenze e sottodipendenze (08/11/2026)

## Esito
**INTEGRAZIONE STRUTTURALE: sì, attraverso un unico parametro di mappa. COPERTURA TOTALE CERTIFICATA: no.**
Le cinque ramp sono approvate, ma nessun controllo statico da solo può dimostrare la copertura di ogni mesh, submesh, LOD, modalità Canvas e shader WebGPU senza un test visivo in-engine.

## Grafo di propagazione
- `State.stonePaletteId` è il valore canonico; `window.ConquerStoneColor` espone `current`, `shade`, `masonry`, `changed`, `randomForSeed`.
- `generateNewMap()` genera un nuovo seed e assegna la famiglia stonecolor in modo deterministico. `loadLocal` e `loadCloud` ripristinano la selezione; i dati legacy privi di valore restano grigi.
- Profilo → Ambiente → `changed(id)` invalida le cache visive, salva localmente e segnala la partita modificata per la sincronizzazione cloud.
- Canvas/castello: `withStructureVisualMaterial` + `visualPaletteColor`; `ConquerCastle3D` passa da `visualPaletteColor` anche senza uso diretto del nome stonecolor.
- Ambientazione: `settlement-landscape` (pendii, rocce, montagne), `settlement-coast` (roccia/reef e mesh), `settlement-terraforming` (pareti litiche non ghost), `settlement-urban` (muretti), `settlement-crossings` (ponte in pietra).
- Modelli: `settlement-civic3d` (paletteKeys + cache per materiale), `settlement-house3d` (kit e basamenti), `settlement-industries3d` (sottoelementi litici della cava e miniera; Clay escluso), `settlement-scatter` (stonePile/riverStones/riverBoulder/milestone), `settlement-quay` (blocchi, basamenti, pavimentazioni), `settlement-slopeways` (gradini e muri).
- World3D: `meshSig`, `bSig`, `castleContent`, `scContent` includono `stonePaletteId`; le modifiche richiedono rifacimento dei colori, non duplicazione dei modelli.
- I ruoli materiali nei registri Blender (`paletteKeys`) identificano specifiche submesh; non è prevista una trasformazione indiscriminata di tutti i grigi.

## Lacune emerse e correzioni in branch
- **Corretti:** `drawBridge` in Canvas conservava deck e parapetto in colori fissi anche per i ponti in pietra.
- **Corretti:** `drawUrbanWall` in Canvas non segue più colori fissi; il muretto nel WebGL aveva già il mapping.
- **Corretti:** pareti `edit.mode==='walled'` del terraforming Canvas, escludendo terreno, riempimento e preview.
- Cache-busting dei moduli e controlli statici `qa/stonecolor-regression.cjs` aggiornati.

## Rischi e prove prima della chiusura
1. **Audit visivo end-to-end non completato**: per ogni palette usare la stessa mappa con due renderer (Canvas/WebGL2), stagione e luce alternate, cutaway, scogliera, cava, pietre scatter, ponte in pietra, mura, banchina e muretti.
2. **Copertura transitive di tutti gli asset non certificata**: dettagli Blender non censiti o asset aggiunti successivamente potrebbero ancora esporre colori non parametrizzati.
3. **WebGPU**: verificare il percorso WebGPU, ove attivo, oltre ai test dei renderer ordinari.
4. **Regressioni CI**: attendere il completamento dei controlli sull'ultimo commit e non dare per passata una run cancellata da push successivi.
5. **Salvataggio cloud**: il campo appartiene alle `policies` della partita; verificare il round-trip sul backend autenticato, oltre alla corrispondenza dello schema.
6. **Materiale vs colore**: preservare `brick` e `clay`, oltre a legno, neve, acqua, vegetazione e metalli, anche nei dettagli misti.

La PR #187 resta in **draft** finché l'audit visivo e le verifiche sul commit finale non sono terminati. Il merge non è autorizzato da questa analisi.
