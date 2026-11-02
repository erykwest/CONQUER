# CONQUER — Piramide di contesto

**Nuovo filone MARCH (30/10/2026):** [specifica modalità attacco](../march.md). Skeleton su branch feature/march-skeleton: prototipo locale su fixture, non world map/feudi integrati. Il ritiro lascia danni e bottino persistenti nello scenario, la conquista è volontaria.


> **Riferimento tecnico corrente: 30/10/2026, `main` `cf569992` — [AUDIT-2026-10-30](AUDIT-2026-10-30.md)**. Riconcilia 53 branch e 3 PR ancora aperte (#109/#110/#111), **15 core Builder su 23**, PR #98–108 economiche, #103 pannelli MERGED. Le note del 21/22/23 ottobre sono **snapshot storici**, non stato live. Usare [STATUS](STATUS.md), [BACKLOG](BACKLOG.md) e [ROADMAP](ROADMAP.md) aggiornati prima di proporre nuovo lavoro.


> **Riesame corrente 23/10/2026:** [AUDIT-2026-10-23](AUDIT-2026-10-23.md) — quattro nuove PR mergiate (#76, #79, #80, #81), gate e Asset Lab su main, altre PR aperte. Il riepilogo del 22/10 rimane baseline storica.


> **Audit backlog aggiornato 22/10/2026:** [AUDIT-2026-10-22](AUDIT-2026-10-22.md) — riclassificazione verificata su main di 23 voci Builder, 25 assedio, Clay, feudi, QA e PR. Leggerlo prima di proporre feature già esistenti.


> Punto d'ingresso canonico per riprendere il progetto dopo una chat, un cambio di agente o una pausa.
> Snapshot iniziale: **16 ottobre 2026**. **Audit stato Git aggiornato al 21 ottobre 2026**, base `main` [7d9328a](https://github.com/erykwest/CONQUER/commit/7d9328ace504234ad34e0b4d89a662af456832e2). La cronologia Git e i test hanno sempre precedenza sulle sintesi.

**Snapshot storico (NON lo stato corrente):** [AUDIT-2026-10-21.md](AUDIT-2026-10-21.md) — merge #44/#48/#53/#54/#57–58/#63–69/#70/#71/#73, PR ancora aperte #55/#61/#65/#72 e limiti della QA. **Workflow PR automatico:** [PR-WORKFLOW.md](PR-WORKFLOW.md), [Action Context sync](../../.github/workflows/context-governance.yml); aggiornamenti obbligatori di STATUS/BACKLOG/CHANGELOG per le PR operative su qualsiasi branch.

## Leggere in quest'ordine

| Livello | Documento | Risponde a |
|---|---|---|
| **0 — Identità** | [VISION.md](VISION.md) | Che gioco stiamo costruendo? Quali compromessi non vogliamo perdere? |
| **1 — Direzione** | [ROADMAP.md](ROADMAP.md) | Quali milestone, dipendenze e priorità governano le prossime scelte? |
| **2 — Realtà** | [STATUS.md](STATUS.md) | Che cosa esiste nel codice, su quale branch, e con quali verifiche? |
| **3 — Decisioni** | [DECISIONS.md](DECISIONS.md) | Che cosa è stato deciso, cosa è solo proposto e quali conflitti sono aperti? |
| **4 — Dettaglio** | [BACKLOG.md](BACKLOG.md) | Dove stanno le singole feature, i requisiti e i documenti tematici? |
| **5 — Continuità** | [PROTOCOL.md](PROTOCOL.md) e [CHANGELOG.md](CHANGELOG.md) | Come leggere, aggiornare e trasferire il contesto senza degradarlo? |

**Guida operativa per `clay` (branch da `Civil`, solo istruzioni):** [argilla, murature in mattoni e roadmap implementativa](../CLAY-DEVELOPMENT.md) · [piano QA](../CLAY-REGRESSION-PLAN.md). Lo schema su branch `clay` è una specifica storica: cava argilla e muratura mattoni sono già nel runtime corrente di `main`.

**Guida operativa per il sottosistema Civil:** [sviluppo edifici civili, cimitero L1, birreria L2 e annessi](../CIVIL-ANNEX-DEVELOPMENT.md). Contiene contratti del codice, percorso implementativo e checklist QA; è specifica della branch `Civil`.

**Entrata rapida (2 minuti):** leggi questa pagina, la tabella «Prossimo passo» della [roadmap](ROADMAP.md#prossimo-passo) e gli «avvisi» dello [stato](STATUS.md#avvisi-di-integrazione).  
**Entrata per implementare:** aggiungi il backlog del sottosistema, i file sorgente e le QA pertinenti; verifica branch e commit attuali prima di scrivere.

**Fotografia storica al 16/10 (non lo stato corrente; per il 21/10 vedi [AUDIT](AUDIT-2026-10-21.md)):** economia [PR #22](https://github.com/erykwest/CONQUER/pull/22), assedio-base [PR #21](https://github.com/erykwest/CONQUER/pull/21), refactor [PR #38](https://github.com/erykwest/CONQUER/pull/38), illuminazione [PR #43](https://github.com/erykwest/CONQUER/pull/43)/[PR #47](https://github.com/erykwest/CONQUER/pull/47), minimappa e LOD [PR #44](https://github.com/erykwest/CONQUER/pull/44) **già integrati su `main`**; renderer WebGL2 3D in default con fallback Canvas. **Non chiusi:** branch `urban`, riconciliazione ledger/Builder, calendario campi/economia, output miniera, QA end-to-end. Consulta [STATUS.md](STATUS.md) per le prove.

## Regole di verità

- **DECISO** = vincolo progettuale approvato; **PROPOSTO** = idea non ancora confermata.
- **PRESENTE NEL CODICE** = sorgente osservata su una branch e commit espliciti; non significa «funziona nel browser».
- **TEST DISPONIBILE** = suite individuata; non significa «test eseguito e passato oggi».
- **COMPLETATO** = implementazione sul branch target + regressione pertinente superata + controllo comportamentale + commit/PR verificabili.
- Le liste di backlog sono *ipotesi di lavoro e requisiti da chiudere*, non un inventario affidabile delle funzioni mancanti.
- **Non inventare completamenti:** ogni variazione di stato riporta prove (file, QA, issue/PR, commit, branch, data).
- **Non uniformare di nascosto fonti in conflitto:** registrare in [DECISIONS.md](DECISIONS.md) e impedire che una supposizione diventi un requisito.

## Conversazioni e fonti di decisioni

Il [registro fonti](EXTERNAL-SOURCES.md) distingue **4 conversazioni lette tramite export** (economia, animazioni/audio, minimappa/LOD, libreria Pixabay) da **2 link ancora in attesa di testo**. I digest sono in [sources/](sources/): [economia](sources/ECONOMY-2026-10-12.md), [render/audio](sources/VISUAL-AUDIO-2026-10-14.md), [minimappa](sources/MINIMAP-2026-10-15.md) e [suoni Pixabay/Drive](sources/PIXABAY-SOUNDS-2026-10-14.md). Usarli per ricostruire il *perché* delle scelte, ma validare il codice contro branch, commit e test.

## Origine della piramide

La base è la repository [erykwest/CONQUER](https://github.com/erykwest/CONQUER): [README](../../README.md), [AGENTS.md](../../AGENTS.md), [backlog Builder/Manager](../feature-backlog.md), [economy](../economy.md), [urban fixes](../urban-fixes.md), sorgenti e QA. I documenti includono anche decisioni e proposte dalle conversazioni su CONQUER, il simulatore di castello/assedi e gli appunti di progetto disponibili al 16/10/2026. Non costituiscono un audit completo dell'intero codice.

## Passaggio di consegne

Quando si apre una nuova conversazione: **«Lavora su erykwest/CONQUER. Prima leggi docs/context/README.md e gli altri livelli necessari della piramide; confrontali con la branch attuale. Mantieni roadmap, status e decision log aggiornati nello stesso lavoro Git. Non confondere design, implementazione e verifica.»**

Per metodo Git, test e deploy prevale sempre [AGENTS.md](../../AGENTS.md).
