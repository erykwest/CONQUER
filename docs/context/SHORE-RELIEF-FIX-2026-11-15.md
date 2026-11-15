# Spiaggia e scarpate — 15 novembre 2026

Base main `1df9699` (PR #250). Implementazione su `fix/coastal-cliff-beach-20261115`, non ancora mergiata.

## Difetto e causa

La sabbia veniva dipinta da `drawWaterLayer` dentro `drawEnvironment`, dopo `drawTerrain` e i rilievi. Il problema era presente anche nella texture piana che WebGL applica alle scarpate: una spiaggia vicina poteva sostituirne il colore.

Riprodotto su isole/penisole marine e sponda lacustre. Il nuovo test esegue le funzioni reali di terreno e ambiente su una scarpata costiera: prima della correzione il colore finale sul pendio ripido era `#d6c494` (sabbia), quindi FAIL.

Ipotesi ordinate: ordine di disegno, proiezione delle quote, larghezza della fascia. Spostare il solo passaggio delle sponde prima dei rilievi risolve il difetto: nessuna modifica a quote, larghezze, proiezione, generazione o salvataggi.

## Correzione

`drawShoreGround` dipinge spiaggia/sabbia bagnata/scogli e sponde di lago/acquitrinio prima di `drawRelief`. L'acqua continua a essere dipinta dopo, con lo stesso ordine dei contorni e dei riempimenti che conserva foci e confluenze. Entrambi i renderer condividono questa sequenza. Aggiornata la versione cache di settlement-landscape.js.

## Verifiche eseguite

- `shore-relief-occlusion-regression.cjs`: PASS dopo FAIL osservato sulla base; 16 combinazioni, mare/lago × plan/isometria × quattro rotazioni. La sponda piatta mantiene la sabbia.
- `shore-relief-render.browser.js`: il vero `ConquerWorld3D._debugBake` restituisce sul pendio RGBA [104,111,118,255], identico al controllo senza sponda dipinta. La spiaggia piana resta [214,196,148,255] sul mare e [185,172,130,255] sul lago, diversa dal terreno [42,40,24,255]. WebGL supportato nel browser di prova.
- PASS Node: coast, water-surface, wooded-relief, landscape-order, biome-selector, tree-bark, export Wiki --check.
- Browser Chrome/Playwright: cinque scene costiere prima/dopo, nessun pageerror osservato dopo la correzione. Isole marine seed 4242/229, isola lacustre Colline 777, penisola Pianura 4242, penisola Foresta 90210. Identici conteggi dei rilievi (3/3/5/3/4) e quote generate prima/dopo.
- Browser: foce mare, foce lago, confluenze fiume/torrente/miste PASS. Le diramazioni marine e la foce lacustre diretta restano presenti.
- Asset Lab Territorio: 16 render invariati, zero errori, cinque avvisi già noti di schema illustrativo; foglio provini rivisto. Aggiornata soltanto la nota della baseline, mantenendo le firme e le deroghe. Le scene reali e il test pixel coprono l'occlusione che gli schemi del Lab non mostrano.

La verifica browser usa il server locale sulla porta 4201. Artefatti non versionati in `output/playwright/`: `coastal-cliffs-before-*.png`, `coastal-cliffs-after-*.png`, `shore-water-*.png` e `shore-terrain-audit/`. Il browser integrato Codex non era disponibile; utilizzato Chrome tramite Playwright.

La CI deve essere verificata separatamente sul commit della PR. Questa correzione riguarda il disegno delle sponde; restano separati i rilievi dell'audit precedente sulla quota collinare costiera e sulla latenza di fondazione.
