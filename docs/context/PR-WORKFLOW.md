# Aggiornamento piramide a ogni pull request

**Introdotto:** 21/10/2026. Questo è il punto di ingresso operativo per chi modifica CONQUER, anche tramite ChatGPT/Claude/altro agente. Si applica a **tutte le pull request** (anche con base `knights` o altre branch), non al comando locale `git pull` (che scarica codice ma non crea una modifica da documentare).

## Perché

Ogni PR può cambiare la realtà del progetto. Se lo stato documentale rimane fermo, gli agenti ricostruiscono erroneamente roadmap e backlog dalle conversazioni. La documentazione segue il **commit nella stessa PR** e non un aggiornamento manuale settimane dopo.

## Requisiti per ogni PR che modifica codice, test o asset

1. **Prima del lavoro:** consultare [README](README.md), [ROADMAP](ROADMAP.md), [STATUS](STATUS.md), [DECISIONS](DECISIONS.md), [BACKLOG](BACKLOG.md), poi confrontare `main` e PR aperte.
2. **Nel medesimo branch/PR:** aggiornare obbligatoriamente:
   - [STATUS.md](STATUS.md): cosa è implementato *nel branch*, prove QA (eseguite/non eseguite), limiti, PR e commit. **Non scrivere “su main” prima del merge**.
   - [BACKLOG.md](BACKLOG.md): stato ID esistente, requisiti chiusi/ancora aperti, dipendenze, eventuali nuovi ID; aggiornare anche [docs/feature-backlog.md](../feature-backlog.md) quando l'ID del Builder è posseduto da lì.
   - [CHANGELOG.md](CHANGELOG.md): nuova riga datata con feature/bugfix/refactor, riferimento PR, stato e limitazioni.
3. **Se cambiano priorità, contratti o scelte:** modificare [ROADMAP.md](ROADMAP.md) e/o [DECISIONS.md](DECISIONS.md) con ID e motivazione. Se restano invariati, dichiararlo nel corpo della PR.
4. **QA:** ripetere le regressioni toccate, indicare PASS/FAIL/NON ESEGUITE. Tenere test visivo distinto dalla sintassi o dai test isolati.
5. **Alla chiusura:** quando la PR viene merge, lo stato “branch” diventa storicamente “merge” *solo dopo verifica del merge SHA*. Non inventare nuovi completamenti nel solo testo della PR; la PR è fonte primaria del merge. Se non è possibile cambiare il documento nel commit merge, la riga branch rimane con link alla PR e lo stato si risolve tramite GitHub / snapshot successivo.

## Controllo automatico

- Workflow GitHub Actions [Context pyramid guard](../../.github/workflows/context-governance.yml), attivato a ogni apertura, update, riapertura o modifica di PR **verso qualsiasi branch**.
- `node tools/context-guard.cjs` confronta gli SHA base/head della PR; **se esistono modifiche operative** sotto `src/`, `qa/`, `camp/`, `assets/`, `public/`, `scripts/`, `tools/`, `server/`, `supabase/` o file di runtime in root, il job **fallisce** a meno che il diff includa tutti e tre `STATUS.md`, `BACKLOG.md`, `CHANGELOG.md`.
- PR esclusivamente documentali o di configurazione CI passano senza obbligo di scrivere false variazioni di gameplay; il job esegue comunque la propria regressione.
- Il controllo **verifica presenza nel diff**, non può giudicare verità e qualità semantica della descrizione. Review manuale + Git/QA rimangono necessarie.
- `node qa/context-guard-regression.cjs` verifica i casi fondamentali del guard.
- GitHub branch protection: `main` al 21/10 **non aveva required status checks**; per bloccare davvero un merge che non aggiorna la piramide impostare **Settings → Branches/Rulesets → main → Require status checks → Context sync** dopo l'attivazione del workflow. Finché non è required, il job produce un fallimento **visibile ma bypassabile**.
- Nessun bot committa automaticamente testo inventato sulla documentazione e nessuna Action deploya Vercel; tutto resta nel normale flusso PR → CI → merge → un deploy su main.

## Check rapido per agenti

```text
1. main HEAD / PR aperte / diff del lavoro
2. feature e contratto toccati, ID backlog
3. modifica codice e QA nel branch
4. modifica STATUS + BACKLOG + CHANGELOG nello stesso branch
5. ROADMAP / DECISIONS, se necessario
6. apri PR, controlla Context sync e test, risolvi fallimenti
7. solo dopo merge → registra il nuovo HEAD nello snapshot successivo
```

**Non incollare una vecchia sezione come stato “corrente”.** Le fotografie storiche in STATUS restano importanti, ma lo stato di apertura/merge di una PR si legge sempre dal Git live.
