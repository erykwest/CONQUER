# Builder — icone architettoniche medievali

UI-BUILDERICON-01, branch `buildericon`, 19 novembre 2026. Sostituzione iconografica richiesta dal product owner; nessun cambiamento alle regole di costruzione.

## Asset e associazioni

`src/assets/builder-icons/` contiene i 72 SVG modificabili della famiglia generata per CONQUER: 52 voci del Builder e 20 file complementari (7 categorie, 10 comandi/parametri, 3 ampliamenti da inspector). `catalog.json` registra nomi, selettori, vecchi glifi, nuovi ID e associazioni dei controlli. Municipio, Gilda e Bargello restano ampliamenti dell'ispettore, non nuove voci nel Builder.

Ogni SVG ha viewBox `0 0 64 64`, massimo ingombro circa 48 unità, solo nero e trasparenza. Le definizioni bianche delle maschere non dipingono uno sfondo: controllano l'alfa. Non sono inclusi raster, testo, texture o filtri. Assonometria 3/4 e geometrie comuni per le architetture; opere infrastrutturali ridotte alla loro struttura e pittogrammi funzionali per le azioni.

## Integrazione

`settlement-builder-ux.js` riutilizza gli stessi oggetti `button`, selettori, gestori di click, titoli e nomi accessibili. Ogni voce ha un ID dedicato anziché condividere `work`, `bridge`, `civic` ecc. `iconMarkup` crea un'immagine decorativa con `alt=""` e `aria-hidden="true"`, dimensioni dichiarate e trascinamento disabilitato. I file SVG sono documenti isolati: nessuna collisione fra gli ID delle loro maschere.

Le superfici dei pulsanti diventano chiare per consentire la lettura del nero sul tema scuro. La selezione arancione e il focus da tastiera rimangono visibili. Le icone sono mostrate a 32px, quelle delle opzioni a 28px; il catalogo continua ad avere quattro colonne e il flyout resta nel viewport mobile.

Per rinnovare un asset, modificare il file SVG, aumentare il token di cache dell'immagine in `iconMarkup` e quello dello script in `index.html`, rigenerare `src/asset-manifest.js` e verificare il Lab. La categoria Interfaccia e la famiglia Icone Builder hanno un supporto chiaro anche nel Lab, senza alterare i file originali.

## QA

```powershell
node tools/build-asset-manifest.cjs --check
node qa/builder-menu-regression.cjs
node qa/builder-icons-browser.mjs
node qa/events-builder-regression.cjs
node qa/builder-placement-regression.cjs
node qa/asset-catalog-regression.cjs
node qa/asset-audit.mjs --category=Interfaccia
```

Le verifiche browser richiedono Playwright, Chromium e un server statico in ascolto sulla porta 4173. Sono supportate `QA_CHROME`, `BUILDER_URL` e `ASSET_LAB_URL` per usare browser e porta locali diversi. `?assetlab=1` evita di toccare salvataggi e cloud. Le catture diagnostiche sono in `output/playwright/buildericon/`, escluse da Git.

La baseline conserva le famiglie già esistenti e aggiunge solo le 72 nuove voci dopo l'audit e la revisione del relativo foglio provini. Per un aggiornamento parziale non sostituire l'intera baseline con il risultato della sola categoria Interfaccia. La CI conserva anche l'audit completo previsto per modifiche del catalogo o dell'inventario.
