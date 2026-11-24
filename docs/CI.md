# CONQUER — CI P0 (6 novembre 2026)

## Obiettivo e stato
Ridurre il numero di workflow operativi e l'esecuzione ripetuta dei 143 test deterministici in tutte le PR, mantenendo **tutti i file di test** in `qa/`.

## Esecuzione corrente
- **PR verso main:** il workflow `Settlement routing and spawn regression` mantiene lo stesso nome e job `settlement-qa`. *(Aggiornato 13/11/2026, vedi "Audit hardening".)* Ogni PR che modifica **qualsiasi file fuori da `docs/` e dai `*.md`** esegue la suite completa `qa/*-regression.cjs` (~90 s) e il controllo della sintassi dei moduli; solo le PR esclusivamente documentali eseguono i cinque controlli rapidi (CI P0, routing/spawn, deviazioni del bosco, completamento strade, spawn Urban2). Rimangono attivi i workflow di sottosistema, `Runtime integrity` e `Context pyramid guard`.
- **Fail closed:** differenze Git o SHA non validi falliscono senza saltare i controlli. La suite completa esegue tutti i test anche dopo un fallimento e riporta un `::error::` per ciascun file fallito, poi termina con errore.
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

- **Run superati:** tutti i workflow (27 al 13/11/2026) usano una chiave di concorrenza distinta per numero di PR e nome workflow, annullando solo i run PR precedenti dello stesso workflow. I run su `main`, manuali e settimanali non vengono cancellati automaticamente.
- **Una sola suite deterministica completa:** la proprietà di `qa/*-regression.cjs` rimane a `settlement-routing-spawn.yml` (ogni PR non solo documentale, domenicale/manuale). `Main fixes`, `Gate six-socket` e `WebGPU smoke` non la replicano più: mantengono test isolati pertinenti ai rispettivi moduli.
- **Nessun audit visivo duplicato:** `node qa/asset-audit.mjs` rimane esclusivamente in `Asset Lab regression`; `Main fixes` mantiene i due collaudi browser di interfaccia/rendering e non ripete il catalogo. Asset Lab intercetta anche `settlement-world3d.js` e `settlement-storage-yard.js`.
- **Asset Lab (aggiornato):** il controllo veloce manifest+contratti gira sempre; la scelta browser è delegata a `qa/asset-audit-scope.cjs` (P2.1). Dal #180 ogni file che non sia documentazione/audio o un asset isolato in allowlist (quindi anche `index.html`, persistenza, simulazione) produce l'audit **full**: la vecchia modalità "solo contratti per dipendenze non visive" non esiste più. Una differenza PR non verificabile richiede sempre il browser.
- **Playwright unico:** i cinque workflow browser importano `.github/actions/playwright-setup/action.yml` (Playwright **1.56.1**, Chromium, cache locale npm e browser, `ubuntu-24.04`); non esistono installazioni separate con versioni diverse. Il setup avvia Chromium in headless come prova: installa le librerie di sistema con `playwright install-deps chromium` **solo se il probe fallisce**, quindi riprova. Questo evita APT ripetuto sui runner già compatibili, senza sacrificare il fallback.
- **WebGPU mirato:** la verifica parte per modifiche al renderer/browser invece che su ogni push `main`; supporta anche pull request su `main` e lancio manuale. Mantiene sonde browser su WebGPU, rendering ibrido, fallback Canvas e test UI/Combat, senza ripetere tutte le regressioni di gioco.
- **Copertura preservata:** `Runtime integrity` rimane sempre attivo sulle PR per `save-safety`; le copie dello stesso test in Combat ed Economy e quella del guard contestuale in Main fixes sono rimosse. `Economy flows` e il guard della documentazione rimangono separati e obbligatori nei rispettivi workflow.
- **Controllo strutturale:** `qa/ci-p1-regression.cjs` è eseguito su ogni PR dal workflow P0, mentre la modifica al workflow P0 o alla verifica P1 provoca il full. **Nessun file test QA viene rimosso**.

**Nota:** la cancellazione dei run precedenti riduce il consumo e il rumore su PR con commit ravvicinati. Cache e filtri modificano il carico ma i risparmi effettivi vanno confrontati sui run GitHub; non sono garantiti valori di velocità precisi. In caso di errore di rendering, il browser Asset Lab può essere rieseguito modificando un file visivo o attivando l'audit attraverso la CI dedicata.

## P2.1 — Audit Asset Lab incrementale (06/11/2026)

- **Pull request verso `main`:** `.github/workflows/asset-lab-regression.yml` legge `git diff --name-status` rispetto alla PR e delega il piano a `qa/asset-audit-scope.cjs`. Se la modifica riguarda solamente 1–4 file sorgente **esistenti e modificati** tra SVG/PNG indipendenti (eccetto texture architettoniche/rotazioni) e registri 3D esplicitamente approvati, l'audit esegue **solo i relativi ID di catalogo**, in tutti i loro stati, producendo report e fogli provini per l'ambito esaminato. Sono ammesse modifiche documentali o audio in aggiunta ai sorgenti selezionati. Le modifiche solo di interfaccia (CSS, `src/ui/**`, pannelli, `index.html` senza nuovi script/stili/canvas) passano in modalità `smoke`: solo il test della galleria, nessun audit. L'audit completo gira in 4 job paralleli (`--shard=N/4`, famiglie intere).
- **Dinamico e senza inventario parallelo:** `qa/asset-audit.mjs --sources=src/assets/industry-models.js` legge `ConquerAssetAudit.catalog()` nel browser e seleziona gli ID usando `source`, quindi comprende anche registri che espongono più famiglie. Verifica le voci precedenti tramite `qa/asset-audit-baseline.json`: se un ID di un registro selezionato è scomparso, o se una sorgente non è rappresentata, esegue il **full** automaticamente, senza scartare segnalazioni.
- **Sempre full:** sorgenti condivise (scena, motore, render, asset catalog, texture architettoniche, fortificazioni), modelli fuori allowlist, aggiunte/rimozioni/rename, oltre quattro sorgenti distinte, differenze Git/SHAs non verificabili. Il nuovo `--sources` non consente `--update-baseline` né la combinazione con filtri manuali.
- **Sola QA veloce:** PR con modifiche esclusivamente documentali o audio, se il workflow viene comunque attivato.
- **Controllo esaustivo garantito:** `workflow_dispatch` e pianificazione domenicale alle **04:47 UTC** lanciano l'audit completo di **tutti** gli asset con tutti gli stati, indipendentemente dagli scope di PR. Il P0 completo resta domenica alle 03:17 UTC.
- **Sicurezza:** `qa/asset-audit-scope-regression.cjs` verifica i fallback e il mapping; il guard P1 conserva il requisito di audit periodico/manuale; gli script e i materiali grafici esistenti restano intatti. La gallery browser QA resta integrale anche nelle PR con audit mirato.
- **Misura:** `artifacts/asset-audit/report.json` include `scope.mode`, `scope.sources` e `scope.selectedIds`; `report.md` riporta la scelta. La riduzione dei tempi è attesa ma non dichiarata come misurata fino alle PR reali con asset isolati.

## P2.3 — Pulizia trigger push di branch inesistenti (06/11/2026)

- **Inventario GitHub verificato:** le branch remote `camp`, `cans`, `audit-hardening`, `circle`, `combat`, `mare` e `feature/cutaway-furniture-converge` non esistono più; la branch ancora esistente `combat-ai` è distinta da `combat`.
- **Rimossi 8 riferimenti push obsoleti da 7 workflow:** `camp-regression.yml`, `gate-six-sockets-regression.yml`, `sea-regression.yml` non hanno più trigger `push` (in precedenza solo branch scomparse). `cans-regression.yml`, `circle-regression.yml`, `combat-regression.yml`, `runtime-integrity.yml` mantengono `push: main` senza riferimenti alle branch inesistenti.
- **Invariati:** tutti i trigger `pull_request`, `paths`, `workflow_dispatch` presenti e i rispettivi job; nessuno script QA, asset o branch Git è stato eliminato. Sono invariati i workflow non coinvolti e i trigger `push` su `main`.
- **Regressione:** il controllo già eseguito su ogni PR `qa/ci-p1-regression.cjs` ora verifica la rimozione dei soli trigger scaduti e la conservazione della verifica PR/main.

## P2.4 — Proprietà unica dei test deterministici ripetuti (09/11/2026)

- **9 invocazioni duplicate eliminate**, senza eliminare script: sei verifiche Codex (quattro regressioni `qa/codex-*` e due controlli `tools/export-codex*.cjs --check`) vengono eseguite esclusivamente da `Runtime integrity` su **ogni PR**; due controlli di routing in `Main fixes` e uno in CAMP sono già garantiti da `Settlement routing and spawn regression`, che gira su **ogni PR verso main**, in modalità rapida o completa.
- **Responsabilità Codex Wiki:** il workflow specialistico mantiene Playwright e i relativi file `qa/codex-wiki-browser.mjs`, `qa/codex-wiki-browser-checks.cjs`; rimosso il trigger browser per i soli test Obsidian/import e sostituito il glob generico `qa/codex-wiki*` con i due file browser effettivi. I trigger per sorgenti, documenti Codex ed esportatori non sono stati rimossi.
- **Responsabilità Main fixes:** mantengono `qa/webgl-error-poll-regression.cjs`, `qa/paused-render-regression.cjs`, i syntax check e tutte le prove browser, compreso UI/Combat; `qa/main-road-finalization-regression.cjs` viene tolto anche dal filtro dei cambiamenti perché già posseduto da settlement-qa.
- **Responsabilità CAMP:** restano calendario, ambiente, fauna, notte, pattuglie, selezione combattimento e sintassi; `settlement-routing-spawn` ha un solo esecutore per PR.
- **Intenzionalmente non deduplicati:** test in Combat/CAMP, Economy/Builder/Road, Gate/Cutaway e Main-fixes/WebGPU/Converge con trigger diversi: eliminarli senza estendere i trigger dell'owner ridurrebbe la copertura. La suite completa P0 settimanale/ad alto rischio sovrappone volutamente i test specialistici.
- **Guardia di copertura:** `qa/ci-p1-regression.cjs` verifica owner always-on, presenza delle verifiche specifiche, assenza delle invocazioni duplicate e conservazione della suite completa; nessuno script, workflow, baseline o materiale di gioco eliminato. Il numero di workflow restava 26 (27 dopo `perf.yml`, vedi sotto). Misurare la differenza su PR normali prima di attribuire percentuali di risparmio.

## Audit hardening (13/11/2026)

- **Suite completa su ogni PR non documentale:** il tier di `settlement-routing-spawn.yml` non dipende più da un elenco di moduli "ad alto rischio". Molti filtri `paths` specialistici non includevano le sorgenti lette dai rispettivi test (es. `src/settlement-architecture.js` non era in alcun filtro), quindi 57 regressioni deterministiche giravano solo la domenica/manualmente. Ora qualsiasi file fuori da `docs/` e `*.md` attiva `qa/*-regression.cjs` (~90 s); la PR solo documentale esegue il fast smoke. Il loop riporta **tutti** i test falliti (`::error file=…`) e fallisce alla fine.
- **Sintassi completa:** `Runtime integrity` esegue `node --check` su `src/**/*.js`, `src/**/*.mjs` e `api/*.js` (con `find`); i `.js` con sintassi ES module vengono ricontrollati come `.mjs`, indipendentemente dal rilevamento automatico di Node.
- **Permessi minimi:** tutti i workflow dichiarano `permissions: contents: read` (aggiunto a 14 workflow che ereditavano il default del repository; nessuno scrive su repo, PR o issue). `qa/ci-p1-regression.cjs` lo impone a ogni workflow.
- **Browser settimanali:** `main-fixes-regression`, `panels-browser-preview`, `converge-regression`, `codex-wiki` e `webgpu-smoke` hanno `workflow_dispatch` e `schedule` domenicale alle **05:27 UTC**, così i filtri `paths` non nascondono regressioni browser a tempo indeterminato.
- **Stonecolor:** il job `stonecolor-snapshots` di Asset Lab era vincolato alla branch `feature/stonecolor` (mergiata nel #187) e non partiva più; ora gira solo su `workflow_dispatch` dell'Asset Lab.
- **Benchmark manuali:** nuovo `perf.yml` (solo `workflow_dispatch`, input `label` e `scripts` opzionali) esegue in sequenza i cinque `qa/*-performance.cjs` con il setup Playwright condiviso; poiché gli script usano `channel:'chrome'`, installa Google Chrome (`npx playwright install --with-deps chrome`) solo se il runner non lo ha già, e carica `output/playwright/` come artifact. Non è un gate delle PR.
- **Context guard:** `tools/context-guard.cjs` considera operativi anche `api/`, `tests/`, `crime/`, `march/`, `lab/`, `layouts/` e `figures-lab.html`, e legge il diff con `--diff-filter=ACDMRT` (le cancellazioni richiedono la piramide).
- **Guardie strutturali:** `qa/ci-p1-regression.cjs` non conta più esattamente 26 workflow ma verifica un inventario nominale; aggiunge una *orphan guard*: ogni `qa/*.cjs|*.mjs` deve essere citato da un workflow (anche via glob), essere un `*-regression.cjs` della suite completa oppure stare in allowlist motivata (helper `construction-fixture.cjs`, `codex-wiki-browser-checks.cjs`, `asset-audit-scope.cjs`; smoke manuali `clay-browser-regression.mjs` e `urban-local-preview.mjs`, dei workflow ritirati in P0 e non ancora rivalidati su main).

## Refactor ECC — runner portabile (24/11/2026)

La suite completa usa `node tools/run-regressions.cjs --report output/qa/regressions.json`, sia su Windows sia in CI. Discovery ordinata di tutti i `qa/*-regression.cjs`, tutti eseguiti anche dopo failure, segnale o errore di avvio. Il JSON con exit code e durata viene pubblicato come artifact `deterministic-regressions`; nessun test ritirato. Il budget temporale resta quello del job CI: nessun limite aggiuntivo per singola suite sulle macchine locali. Controllo del runner con `qa/regression-runner-regression.cjs`.

Runtime integrity esegue anche `tools/runtime-contract.cjs` e i test Node di salvataggi/risorse; Panels browser verifica Builder legacy, UI2 e CAMP. I quattro shard dell'audit Asset Lab rimangono invariati. [Ledger di propagazione](REGRESSION.md).
