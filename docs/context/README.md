# CONQUER — Piramide di contesto

> Punto d'ingresso canonico per riprendere il progetto dopo una chat, un cambio di agente o una pausa.
> Snapshot iniziale: **16 ottobre 2026**; verifica successiva dello stesso giorno su `main` [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99). La cronologia Git e i test hanno sempre precedenza sulle sintesi.

## Leggere in quest'ordine

| Livello | Documento | Risponde a |
|---|---|---|
| **0 — Identità** | [VISION.md](VISION.md) | Che gioco stiamo costruendo? Quali compromessi non vogliamo perdere? |
| **1 — Direzione** | [ROADMAP.md](ROADMAP.md) | Quali milestone, dipendenze e priorità governano le prossime scelte? |
| **2 — Realtà** | [STATUS.md](STATUS.md) | Che cosa esiste nel codice, su quale branch, e con quali verifiche? |
| **3 — Decisioni** | [DECISIONS.md](DECISIONS.md) | Che cosa è stato deciso, cosa è solo proposto e quali conflitti sono aperti? |
| **4 — Dettaglio** | [BACKLOG.md](BACKLOG.md) | Dove stanno le singole feature, i requisiti e i documenti tematici? |
| **5 — Continuità** | [PROTOCOL.md](PROTOCOL.md) e [CHANGELOG.md](CHANGELOG.md) | Come leggere, aggiornare e trasferire il contesto senza degradarlo? |

**Entrata rapida (2 minuti):** leggi questa pagina, la tabella «Prossimo passo» della [roadmap](ROADMAP.md#prossimo-passo) e gli «avvisi» dello [stato](STATUS.md#avvisi-di-integrazione).  
**Entrata per implementare:** aggiungi il backlog del sottosistema, i file sorgente e le QA pertinenti; verifica branch e commit attuali prima di scrivere.

**Stato rapido al 16/10 (verificato su Git):** economia [PR #22](https://github.com/erykwest/CONQUER/pull/22), assedio-base [PR #21](https://github.com/erykwest/CONQUER/pull/21), refactor [PR #38](https://github.com/erykwest/CONQUER/pull/38), illuminazione [PR #43](https://github.com/erykwest/CONQUER/pull/43)/[PR #47](https://github.com/erykwest/CONQUER/pull/47), minimappa e LOD [PR #44](https://github.com/erykwest/CONQUER/pull/44) **già integrati su `main`**; renderer WebGL2 3D in default con fallback Canvas. **Non chiusi:** branch `urban`, riconciliazione ledger/Builder, calendario campi/economia, output miniera, QA end-to-end. Consulta [STATUS.md](STATUS.md) per le prove.

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
