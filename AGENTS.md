# CONQUER — Working method for changes and deployments

- Start every implementation on a feature/fix branch created from an updated `main`. Make as many incremental commits as needed for development and debugging; do not push work-in-progress directly to `main`.
- Run relevant checks and GitHub Actions CI on the development branch. Fix failures there before proposing a merge. CI checks do **not** require a Vercel deployment.
- When a feature is ready and verified, open a pull request to `main` and merge it (prefer a squash merge to keep the release history legible). Avoid multiple intermediate merges for the same iteration.
- Automatic **Vercel** deployments are reserved for commits reaching `main`. This is set in the root `vercel.json` using `git.deploymentEnabled`. Do not reactivate automatic preview builds without an explicit request.
- For an on-demand visual preview, use Vercel Dashboard > Deployments > Create Deployment from the relevant feature branch or commit SHA. This should be intentional, not triggered by each intermediate commit.
- Existing feature branches created before this convention may not contain `vercel.json`; bring them up to date with `main` before further pushes to ensure the deployment filter is present.
- Keep GitHub Actions testing separate from Vercel build/deployment costs. Do not disable CI to save Vercel build minutes.
- Do not merge incomplete features solely to obtain a preview; request a one-off preview instead.

Goal: many development commits and CI checks, **one automatic production deployment per completed iteration**.

## Obbligo di aggiornamento documentale in ogni PR operativa

- Leggere [docs/context/AUDIT-2026-10-21.md](docs/context/AUDIT-2026-10-21.md) **come snapshot datato**, poi verificare lo stato live prima di lavorare.
- **Prima di proporre una pull request che cambia codice, test o asset (anche quando la base non è `main`)**, aggiornare nello *stesso branch* `docs/context/STATUS.md`, `docs/context/BACKLOG.md` e `docs/context/CHANGELOG.md`. Il workflow GitHub Actions `Context sync` verifica il diff e fallisce se uno manca.
- `docs/context/ROADMAP.md` e `docs/context/DECISIONS.md` si cambiano quando mutano roadmap/contratti/decisioni; altrimenti scrivere nella PR perché sono invariati. Aggiornare `docs/feature-backlog.md` per le feature di cui è owner.
- Seguire [docs/context/PR-WORKFLOW.md](docs/context/PR-WORKFLOW.md) e la [PR template](.github/pull_request_template.md). Non confondere feature presente su branch, CI passata e merge in main.
- La protezione `main` deve richiedere il check `Context sync` per bloccare realmente PR incomplete; senza required status check il fallimento è solo segnalato. Non aggirare la regola con un merge manuale.
- Questa policy vale anche quando il lavoro viene svolto da assistenti/agent: **chi scrive il codice aggiorna la piramide**, non l'utente.

## Verifica visiva: usare il Lab, non catture in gioco
- Per controllare un asset o un renderer (modelli 3D, tende, accampamenti, livree, varianti) gli agent aprono l'**Asset Lab** (`/figures-lab.html`, o `/lab`) e ispezionano lì l'elemento, oppure usano `ConquerAssetAudit.inspect(id, stato)` / `ConquerAssetAudit.sheet({family})` dalla console. **Non** si avvia una partita né si costruiscono scene in gioco solo per fare screenshot: è lento e non ripetibile.
- **Ogni nuovo modello (o registro di modelli, o composizione come un accampamento) va inserito nel Lab nella stessa PR in cui nasce**: un modello che non compare nel catalogo non è finito.
- Se l'elemento non c'è nel Lab, prima lo si aggiunge al catalogo (`src/asset-catalog.js`, `MODEL_SOURCES`, e lo script del registro in `figures-lab.html`), poi lo si verifica. La cattura in gioco serve solo per comportamenti che il Lab non può mostrare (simulazione, IA, input).

## Asset visivi: audit obbligatorio
- Ogni PR che aggiunge o cambia un asset visivo (SVG/PNG, modelli 3D, varianti di torri/mura/porte, renderer di cantiere, danno o cutaway) esegue l'audit del Lab (`node qa/asset-audit.mjs`), rivede i fogli provini e aggiorna `qa/asset-audit-baseline.json` dopo la revisione. Procedura completa: [docs/ASSET-LAB-AUDIT.md](docs/ASSET-LAB-AUDIT.md).

## Product context / continuity
- Before estimating scope or starting implementation, read [docs/context/README.md](docs/context/README.md) and follow its links to vision, roadmap, branch-specific status, decisions, and subsystem backlog. Verify the live branch/HEAD and actual source before declaring a feature complete.
- Preserve the pyramid in the same PR whenever priorities, implementation status, architectural contracts or design decisions change; keep proposals distinct from code, and code distinct from executed tests.
- The [docs/feature-backlog.md](docs/feature-backlog.md) remains the detailed Builder/Manager backlog; the context pyramid links it instead of duplicating ownership.
