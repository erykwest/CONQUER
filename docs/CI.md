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
