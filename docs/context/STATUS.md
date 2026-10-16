# Livello 2 — Stato tecnico e prove

> Snapshot verificato per **lettura statica** e confronto branch il **16/10/2026**; nessuna esecuzione locale delle QA né test browser dichiarati in questa ricognizione.
> Base: `main` a [9b7d05d](https://github.com/erykwest/CONQUER/commit/9b7d05db597b592b78c9b4647181cb39f2cb2a9d). Cambia velocemente: controllare sempre HEAD prima di agire.

## Semaforo epistemico

- **CODICE** — implementazione/sorgenti identificati su una branch.
- **QA** — una suite esiste nel repository; *non* significa eseguita con esito positivo nello snapshot.
- **BRANCH** — cambiamenti specifici fuori da `main`; non sono automaticamente rilasciati.
- **PROGETTO** — proposta/decisione descritta in documentazione senza prova end-to-end.
- **CHIUSO** — riservato alle feature con PR/commit e test/regressioni riscontrati e aggiornati in questa tabella.

## Quadro main — ciò che si può effettivamente affermare

| Sottosistema | Evidenza principale su main | Stato documentabile e limiti |
|---|---|---|
| Builder / castello | [index.html](../../index.html), [README.md](../../README.md), `src/settlement-castle.js` | **CODICE**: torri, mura, porte, costruzioni, livelli, slot e interfaccia. Interfaccia avanzata rispetto alla README storica. Non basta a certificare tutte le funzioni degli slot. |
| Terreno, orografia, natura | `src/settlement-landscape.js`, `qa/p1-terrain-regression.cjs`, `qa/organic-forest-regression.cjs` | **CODICE + QA individuata**: rilievi e foreste hanno sistemi esistenti; non ricrearli. Sfruttamento/deplezione forestale non dimostrato. |
| Pozzo e urbanistica | `src/settlement-urban.js`, [urban-fixes](../urban-fixes.md), `qa/urban-regression.cjs` | **CODICE + QA**: crescita procedurale, viabilità/lotti e migrazioni documentati. Accettazione end-to-end non riauditata. |
| Campi | [settlement-fields.js](../../src/settlement-fields.js), [QA campi](../../qa/fields-regression.cjs) | **CODICE + QA**: quadrilateri Voronoi, lato 1–6 U, `floor(area/4)` slot, serpentina 0,5 U, fasi persistenti. Calendario fisico non ancora concordato con l'accounting. |
| Economia aggregata | `src/settlement-economy.js`, [economy.md](../economy.md), `qa/economy-regression.cjs` | **CODICE + QA**: coorti L1–L4, produzione/mercato/casse e regole di riserva. Inventari di costruzione e stock economico sono ancora separati nel documento. |
| Poli estrattivi | [settlement-industries.js](../../src/settlement-industries.js), [QA](../../qa/economy-industries-regression.cjs) | **CODICE + QA**: logging camp 2×2 U, cava 3×3 U, miniera 1×1 U con vincoli di posizione/lavoro; renderer dichiarato *placeholder* nel modulo main. |
| Combattimento e territorio | [settlement-combat.js](../../src/settlement-combat.js) | **CODICE**: area tattica, visibilità/fog, zone, unità e pattuglie; non affermare che esista già un assedio completo. |
| Rendering | [settlement-render.js](../../src/settlement-render.js) | **CODICE**: orchestratore grafico separato in moduli, ma non una separazione totale delle responsabilità meccaniche e grafiche. |
| Araldica | `src/settlement-heraldry.js`, `src/heraldry-symbols.js` | **CODICE citato nel backlog verificato**: editor/pattern SVG presenti; propagazione a ogni supporto da testare. |
| Alberi SVG | `src/assets/forest/tree_01_tonda.svg` … `tree_07_asimmetrica.svg` | **ASSET presenti secondo audit backlog**; integrazione/performance richiedono controllo. |
| Deploy | [vercel.json](../../vercel.json), [AGENTS.md](../../AGENTS.md) | **CONFIGURAZIONE**: deploy Git automatico abilitato solo su `main`; feature branch con CI e PR. |

Non confondere il testo del [README](../../README.md) (contiene sezione «V0.11 scope») con la baseline attuale: l'[index.html](../../index.html) mostra «Castle Lab V0.43». Versioni di testo, tag e prodotto vanno riconciliate separatamente.

## Avvisi di integrazione

### 1. Branch /urban non è /main

Al 16/10 il confronto [`main...urban`](https://github.com/erykwest/CONQUER/compare/main...urban) era **diverged**: 92 commit avanti / 9 indietro. Sono variazioni *al momento del confronto*, non una misura permanente. Tra i file specifici risultavano:

- `src/settlement-livestock.js`, `src/settlement-animals.js`, `qa/urban-livestock-regression.cjs`;
- SVG di logging camp, cava e miniera sotto `src/assets/economy/`;
- integrazioni in `src/settlement-urban.js`, rendering e QA.

C'è anche [`sync/urban-main-2026-10-16`](https://github.com/erykwest/CONQUER/tree/sync/urban-main-2026-10-16), che risultava anch'essa divergente. **Non dedurre quale abbia il codice definitivo dal nome.** Controllare commit, PR e merge prima di usare/descrivere un asset come integrato. Evitare un merge cieco delle branch.

### 2. Calendari agricoli discordanti

- `src/settlement-fields.js` codifica **aratura ottobre–novembre**, **semina marzo–aprile**, **raccolta luglio–agosto**.
- [docs/economy.md](../economy.md) attribuisce alla contabilità economica **un raccolto autunnale per anno**; segnala esplicitamente il disallineamento con i cicli visivi.

**Aperto:** decidere e unificare resa contabile, animazione, stagione, consumo di lavoro e salvataggio. Non correggere solo l'animazione.

### 3. Output della miniera: pietra o metallo?

Il codice `src/settlement-industries.js` su main definisce `mine.good='stone'`; il progetto economico originario immaginava **Metallo**. [Economy](../economy.md) e [Backlog Builder](../feature-backlog.md) registrano l'ambiguità. È **decisione aperta**, prima di bilanciare metallurgia/fabbro.

### 4. Inventario test vs inventario economico

[Economy](../economy.md) indica che `State.resources` usato per costruire e il ledger degli stock economici sono distinti. **Non** collegare assedi, produzione e magazzini a due verità concorrenti: prevedere contratto unico e migrazione salvataggi.

### 5. Assedi e comportamento popolazione

I documenti su fortificazioni, Mastio, leve, stanze e assedio continuo contengono requisiti ampi. Senza QA end-to-end non classificarli come completati. Le routine diurne e i soldati richiedono integrazione tra economia aggregata e agenti renderizzati.

## Aggiornamento fonti importate (16/10, senza test runtime)

### Economia — conferma di cronologia, non nuova feature

L'export completo [ECONOMY](sources/ECONOMY-2026-10-12.md) riporta **PR #22 integrata in `main`** tramite [merge 2b8e8239](https://github.com/erykwest/CONQUER/commit/2b8e8239d2009fd813b92ff8f7e18e05bfb625b7) il 13/10. La lettura di `src/settlement-economy.js`, `src/settlement-industries.js` e delle QA conferma la base nel repository. L'export menziona regressioni passate in quella sessione, **non le abbiamo rieseguite per questo import**. Rimangono da riconciliare campi/ledger, scorte costruttive, investimenti privati che edificano, export reale, produzione metallurgica.

### Minimappa — codice in PR, non in main

[PR #44](https://github.com/erykwest/CONQUER/pull/44) era **OPEN/non merged** al controllo GitHub del 16/10; branch `feature/topdown-minimap-20261015` divergente da `main`. Sorgenti aggiunte: `src/settlement-minimap.js`, `src/settlement-minimap.css`, `src/settlement-lod.js`. Secondo la PR: navigazione clic/drag, rotazione camera, blocchi edifici minimappa, unità tattiche come puntini (ostili solo se avvistati), LOD militare nella scena a zoom inferiore a **0,38**. **Verifiche dichiarate:** sintassi e smoke isolati. **Da fare:** test reale browser, mobile, performance, integrazione e merge. Il LOD edifici della scena principale resta proposta. [Digest](sources/MINIMAP-2026-10-15.md).

### Asset/rendering — esistenti, non assumere gestione RAM completa

Il modulo [settlement-assets.js](../../src/settlement-assets.js) definisce già cache LRU delle strutture (192 voci) e cache di compositi limitata nominalmente a 32 MiB, con contatori; il primo limite è **per numero**, non per memoria globale. [settlement-webgpu.js](../../src/settlement-webgpu.js) si definisce renderer ibrido dei layer statici Canvas, con fallback Canvas2D; **non è di per sé un importatore glTF/renderer 3D completo**. La branch `animation` era divergente e contiene moduli animali/carri e `figures-lab.html` secondo il confronto Git.

L'export [VISUAL/AUDIO](sources/VISUAL-AUDIO-2026-10-14.md) riporta **asset Blender/PNG locali non committati**, dimensioni non direttamente verificabili e due stime incompatibili (627 vs somma 657 MB). Non registrarli come asset distribuiti. Audio/Suno e prova del modello 3D per cutaway/danni/cantiere restano discussioni/prototipi, non implementazioni certificate.

## QA nominate per i prossimi audit

- `qa/fields-regression.cjs`
- `qa/economy-regression.cjs` e `qa/economy-industries-regression.cjs`
- `qa/urban-regression.cjs`, `qa/founding-regression.cjs`
- `qa/builder-placement-regression.cjs`
- `qa/p1-terrain-regression.cjs`
- `qa/organic-forest-regression.cjs`
- `qa/refactor-module-boundaries-regression.cjs`

**Non sono stati eseguiti durante la creazione di questa piramide**. Eseguire su checkout della branch oggetto del lavoro e registrare risultati e SHA nella relativa PR.

## Schema per aggiornare uno stato

`ID | Feature | Branch | Stato | Prova codice | Test/risultato | Commit o PR | Data | Blocchi`.

Aggiornare questo livello dopo ogni PR che modifica una milestone, non dopo ogni scambio di idee.
