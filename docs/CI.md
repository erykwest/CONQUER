# CONQUER — CI P0 (6 novembre 2026)

## Obiettivo e stato
Ridurre il numero di workflow operativi e l'esecuzione ripetuta dei 143 test deterministici in tutte le PR, mantenendo **tutti i file di test** in `qa/`.

## Esecuzione corrente
- **PR verso main:** il workflow `Settlement routing and spawn regression` mantiene lo stesso nome e job `settlement-qa`. Le modifiche isolate eseguono solo cinque controlli rapidi (CI P0, routing/spawn, deviazioni del bosco, completamento strade, spawn Urban2); rimangono attivi i workflow di sottosistema, `Runtime integrity` e `Context pyramid guard`.
- **PR ad alto rischio:** se cambiano `index.html`, i moduli `settlement-core`, `settlement-app`, `settlement-app-simulation`, `settlement-app-persistence`, `settlement-world`, `settlement-placement`, `settlement-castle-placement`, `settlement-population-navigation` oppure il workflow stesso, il check esegue `qa/*-regression.cjs` e il controllo della sintassi dei moduli. Il test mantiene comportamento *fail closed*: differenze Git o SHA non validi falliscono senza saltare i controlli.
- **Verifica completa periodica:** domenica alle 03:17 UTC, oltre a `workflow_dispatch` per controllo manuale in qualsiasi momento. La suite non viene cancellata né alleggerita; cambia solo il momento in cui viene lanciata.
- **Core P0:** `runtime-integrity.yml`, `economy-flows-regression.yml` e `context-governance.yml` restano attivi, senza modificare gli status check o i test economici.

## Workflow ritirati (11)
Le definizioni rimangono nella cronologia Git; i test sono conservati.
- Branch `Civil`/`civil-3d`/`case`: `civil-regression.yml`.
- Branch `clay`: `clay-browser-smoke.yml`, `clay-palette-regression.yml`.
- Branch `events`: `events-regression.yml`.
- Branch `urban`/`urban-density-l3-l4`: `urban-density-regression.yml`, `urban-livestock-regression.yml`, `urban-local-preview.yml`.
- Branch `sound`: `seasonal-music.yml`, `sound-optimize.yml`, `sound-regression.yml`.
- Job monouso con privilegi di eliminazione branch: `prune-obsolete-branches-20261023.yml`.

Sono stati controllati i nomi delle branch di destinazione prima della rimozione; nessuna delle precedenti branch è presente nei riferimenti remoti. I due script di manipolazione audio non vengono cancellati. I workflow ad alto costo per WebGPU, Asset Lab e Playwright **non vengono modificati in P0**: questo rimane P1.

## Verifica, ripristino e limiti
- `node qa/ci-p0-regression.cjs` controlla che il selettore PR, il percorso della suite completa e i test principali esistano.
- Per eseguire il full senza una nuova PR: GitHub → Actions → `Settlement routing and spawn regression` → **Run workflow**.
- Per ripristinare un workflow archiviato: recuperare il relativo file dalla cronologia Git precedente al merge, verificarne la branch di destinazione e creare una PR.
- Lo storico dei run rimane su GitHub; il cambio non accelera automaticamente i workflow di sottosistema né disabilita gli altri job browser. Non vengono variati i branch protection rules.

## P1 — Consolidamento e browser ottimizzati (06/11/2026)

- **Run superati:** tutti i 25 workflow usano una chiave di concorrenza distinta per numero di PR e nome workflow, annullando solo i run PR precedenti dello stesso workflow. I run su `main`, manuali e settimanali non vengono cancellati automaticamente.
- **Una sola suite deterministica completa:** la proprietà di `qa/*-regression.cjs` rimane a `settlement-routing-spawn.yml` (P0, a rischio, domenicale/manuale). `Main fixes`, `Gate six-socket` e `WebGPU smoke` non la replicano più: mantengono test isolati pertinenti ai rispettivi moduli.
- **Nessun audit visivo duplicato:** `node qa/asset-audit.mjs` rimane esclusivamente in `Asset Lab regression`; `Main fixes` mantiene i due collaudi browser di interfaccia/rendering e non ripete il catalogo. Asset Lab intercetta anche `settlement-world3d.js` e `settlement-storage-yard.js`.
- **Asset Lab selettivo:** su modifiche direttamente visive, di modelli, scene del castello e Asset Lab, esegue browser gallery + audit di tutti gli asset; su modifiche a dipendenze non visive (per esempio `index.html`, persistenza, simulazione), esegue il solo controllo veloce manifest+contratti. Una differenza PR non verificabile richiede sempre il browser.
- **Playwright unico:** i cinque workflow browser importano `.github/actions/playwright-setup/action.yml` (Playwright **1.56.1**, Chromium, cache locale npm e browser, `ubuntu-24.04`); non esistono installazioni separate con versioni diverse. Il setup avvia Chromium in headless come prova: installa le librerie di sistema con `playwright install-deps chromium` **solo se il probe fallisce**, quindi riprova. Questo evita APT ripetuto sui runner già compatibili, senza sacrificare il fallback.
- **WebGPU mirato:** la verifica parte per modifiche al renderer/browser invece che su ogni push `main`; supporta anche pull request su `main` e lancio manuale. Mantiene sonde browser su WebGPU, rendering ibrido, fallback Canvas e test UI/Combat, senza ripetere tutte le regressioni di gioco.
- **Copertura preservata:** `Runtime integrity` rimane sempre attivo sulle PR per `save-safety`; le copie dello stesso test in Combat ed Economy e quella del guard contestuale in Main fixes sono rimosse. `Economy flows` e il guard della documentazione rimangono separati e obbligatori nei rispettivi workflow.
- **Controllo strutturale:** `qa/ci-p1-regression.cjs` è eseguito su ogni PR dal workflow P0, mentre la modifica al workflow P0 o alla verifica P1 provoca il full. **Nessun file test QA viene rimosso**.

**Nota:** la cancellazione dei run precedenti riduce il consumo e il rumore su PR con commit ravvicinati. Cache e filtri modificano il carico ma i risparmi effettivi vanno confrontati sui run GitHub; non sono garantiti valori di velocità precisi. In caso di errore di rendering, il browser Asset Lab può essere rieseguito modificando un file visivo o attivando l'audit attraverso la CI dedicata.

## P2.1 — Audit Asset Lab incrementale (06/11/2026)

- **Pull request verso `main`:** `.github/workflows/asset-lab-regression.yml` legge `git diff --name-status` rispetto alla PR e delega il piano a `qa/asset-audit-scope.cjs`. Se la modifica riguarda solamente 1–4 file sorgente **esistenti e modificati** tra SVG/PNG indipendenti (eccetto texture architettoniche/rotazioni) e registri 3D esplicitamente approvati, l'audit esegue **solo i relativi ID di catalogo**, in tutti i loro stati, producendo report e fogli provini per l'ambito esaminato. Sono ammesse modifiche documentali o audio in aggiunta ai sorgenti selezionati.
- **Dinamico e senza inventario parallelo:** `qa/asset-audit.mjs --sources=src/assets/industry-models.js` legge `ConquerAssetAudit.catalog()` nel browser e seleziona gli ID usando `source`, quindi comprende anche registri che espongono più famiglie. Verifica le voci precedenti tramite `qa/asset-audit-baseline.json`: se un ID di un registro selezionato è scomparso, o se una sorgente non è rappresentata, esegue il **full** automaticamente, senza scartare segnalazioni.
- **Sempre full:** sorgenti condivise (scena, motore, render, asset catalog, texture architettoniche, fortificazioni), modelli fuori allowlist, aggiunte/rimozioni/rename, oltre quattro sorgenti distinte, differenze Git/SHAs non verificabili. Il nuovo `--sources` non consente `--update-baseline` né la combinazione con filtri manuali.
- **Sola QA veloce:** PR con modifiche esclusivamente documentali o audio, se il workflow viene comunque attivato.
- **Controllo esaustivo garantito:** `workflow_dispatch` e pianificazione domenicale alle **04:47 UTC** lanciano l'audit completo di **tutti** gli asset con tutti gli stati, indipendentemente dagli scope di PR. Il P0 completo resta domenica alle 03:17 UTC.
- **Sicurezza:** `qa/asset-audit-scope-regression.cjs` verifica i fallback e il mapping; il guard P1 conserva il requisito di audit periodico/manuale; gli script e i materiali grafici esistenti restano intatti. La gallery browser QA resta integrale anche nelle PR con audit mirato.
- **Misura:** `artifacts/asset-audit/report.json` include `scope.mode`, `scope.sources` e `scope.selectedIds`; `report.md` riporta la scelta. La riduzione dei tempi è attesa ma non dichiarata come misurata fino alle PR reali con asset isolati.
