# Livello 2 — Stato tecnico e prove

## Cutaway furniture + WebGL2 — branch `feature/cutaway-furniture-converge` (21/10/2026)

- **CODICE / branch:** libreria `src/assets/furniture-model.js` e generatore Blender; `src/settlement-cutaway-furniture.js` definisce le ricette delle stanze (14 ruoli e alias), il layout dimensionato, i mobili volumetrici, le luci e i posti liberi dai mobili. Arredi riservano scale, passaggio del portone e postazioni degli arcieri.
- **MOTORE:** cutaway WebGL2 con volume pareti/superfici, ripartizione dei piani, arredi depth-tested, cache per rotazione e pass emissivo notturno, fallback Canvas. Porte in pietra e sottotorri apribili; il pianterreno della torre-porta è un passaggio, con migrazione delle precedenti assegnazioni delle stanze.
- **COMPATIBILITÀ:** portato selettivamente sulla baseline moderna; conservate le geometrie Terraforming e gli altri moduli di `main`. Nessun merge diretto della vecchia branch `feature/cutaway-furniture`.
- **QA GitHub Actions PASS:** [run #39508539592](https://github.com/erykwest/CONQUER/actions/runs/39508539592) sulla HEAD `5e048a8`: suite completa `qa/*-regression.cjs`, inclusa `qa/cutaway-furniture-regression.cjs`, controlli compilazione/sintassi JavaScript; CAMP e Builder PASS. PR [#65](https://github.com/erykwest/CONQUER/pull/65) mergeabile, non ancora mergiata. Collaudo interattivo WebGL2 nel browser non eseguito.



> Snapshot **aggiornato il 19/10/2026** per il lavoro Terraforming; le sezioni storiche del 16/10 mantengono i propri limiti di verifica.
> Base del lavoro: `main` a `a4adca0`; implementazione su branch `terraforming` al commit `fa9ef0d`. Il repository può cambiare: ricontrollare HEAD prima di intervenire.


## MAIN FIX — DEV scroll + mulini nel Builder (20/10/2026)

- **CODICE su branch `fix/main-dev-scroll-mill-menu-20261020`:** limite verticale del gruppo DEV in `src/settlement.css`, bottone di apertura sempre visibile e contenuto del pannello scorrevole; `windmill` e `watermill` ripristinati nel catalogo **Produzione** del Builder compatto senza duplicare né ricreare i pulsanti già collegati al gameplay.
- **CACHE:** versioni CSS e palette JS aggiornate in `index.html` per caricare la UI corretta.
- **QA GitHub Actions PASS sulla PR #58:** [Builder menu regression #39497454600](https://github.com/erykwest/CONQUER/actions/runs/39497454600) — sintassi JS, registrazione dei due pulsanti, requisiti di scroll CSS e controlli esistenti su mulini 3D e posizionamento Builder. **Il collaudo interattivo nel browser non è incluso** in questa suite.
- **RILASCIO:** merge su `main` solo dopo i controlli PR; nessun preview deployment Vercel richiesto.

## Clay — palette DEV globale (19/10/2026)

- **CODICE su `clay`:** due pulsanti DEV Stone/Clay, mappa swatch in `src/settlement-core.js`, uso Canvas/WebGL2 e invalidazione delle relative cache. Mura/torri in color mattone; piani terra case L2–L4 color laterizio; tetti prima antracite color tegola.
- **NESSUN GAMEPLAY CLAY:** cave, risorsa argilla, costi/mattoni individuali e coefficienti HP 80% restano soltanto design. Switch locale solo visivo.
- **QA eseguita sulla HEAD `bbe5a27`:** [GitHub Actions #39271126852](https://github.com/erykwest/CONQUER/actions/runs/39271126852) **PASS**: syntax check di tutti i sorgenti/QA JS, palette DEV, Urban, densità, Builder, Civil annexes, Economia e Industrie. Corretto nel solo harness QA di Industrie l'adattamento al preflight degli annessi di Civil. **Collaudo visivo Canvas/WebGL2 nel browser non eseguito.**

## Clay — istruzioni sul ramo `clay` (19/10/2026)

- **BRANCH / PROGETTO:** `clay` deriva da `Civil` (HEAD sorgente `ba592cfaed7b76ae20e6f0192955fa68212de410`). Aggiunti documenti di progettazione/implementazione [CLAY-DEVELOPMENT](../CLAY-DEVELOPMENT.md) e [CLAY-REGRESSION-PLAN](../CLAY-REGRESSION-PLAN.md).
- **NON CODICE:** nel commit documentale non vengono implementate argilla, nuova modalità cava, materiale mattoni, durabilità 80% né palette. Nessuna regressione runtime viene dichiarata superata.
- **DA FARE:** implementare su `clay` rispettando l'attuale skeleton `Civil`, poi provare collocazione entro 6 U, output contabile, costi murari, rendering multipipeline, integrità e migrazioni.

## Semaforo epistemico

- **CODICE** — implementazione/sorgenti identificati su una branch.
- **QA** — una suite esiste nel repository; *non* significa eseguita con esito positivo nello snapshot.
- **BRANCH** — cambiamenti specifici fuori da `main`; non sono automaticamente rilasciati.
- **PROGETTO** — proposta/decisione descritta in documentazione senza prova end-to-end.
- **CHIUSO** — riservato alle feature con PR/commit e test/regressioni riscontrati e aggiornati in questa tabella.

## Terraforming — branch `terraforming` (19/10/2026)

- **BRANCH + CODICE:** due modalità nel Builder, **Terreno** e **Terrazzamento murato**, entrambe con ghost della quota finale, raggio 2/4/6 U e scavo/innalzamento di 1 U.
- **VINCOLO:** il piazzamento di un terrazzamento murato sopra un altro è respinto prima del commit, evitando accumuli anomali e aree invalicabili. Il bordo fornisce magneti alle mura; il loro asse viene traslato di mezzo spessore così che la faccia esterna rimanga a filo.
- **CHIARIMENTO DEFINITIVO:** terrazzamento con pareti esattamente verticali color muro e piano piatto; collina naturale invariata. Migrazione dei vecchi terrazzamenti inclinati e ritaglio esatto della mesh WebGL2 al bordo. Dieci controlli dedicati, compresa copertura del suolo senza buchi e assenza di triangoli inclinati nel salto di quota.
- **CONTRATTO TECNICO:** gli interventi persistono in `State.relief.terraforming`; `terrainElevation` e `terrainSlopeKind` restano i punti condivisi per regole, Canvas e mesh WebGL2. Il ghost non muta il rilievo e non invalida cache o navigazione durante il movimento del puntatore.
- **QA LOCALE PASS:** tutte le suite `qa/*.cjs`, inclusi i 9 controlli di `qa/terraforming-regression.cjs`; `node --check` sui file modificati; `git diff --check`.
- **BROWSER STORICO (prima del chiarimento verticale):** verificati ghost, sovrapposizione, reload e aggancio mura. Questa prova non certifica la nuova mesh verticale; la geometria corrente è verificata dalla QA dedicata.
- **LIMITE DI RILASCIO:** commit `fa9ef0d` è fuori da `main`; nessuna PR, merge o pubblicazione effettuata in questo aggiornamento.
## Civil — skeleton edifici civili (17/10/2026; branch `Civil`)

- **CODICE / BRANCH**: chiesa e locanda entrano come siti del catasto Voronoi in `src/settlement-urban.js`, con `civicId` distinto dai lotti delle case e perimetri/accessi condivisi; il mercato **non** riceve un lotto di pertinenza.
- **CODICE / BRANCH**: introdotti `civicLevel` L1–L3 per chiesa, locanda, mercato e piazza. Nuovo edificio `plaza` (Piazza) 5×5 U con tre varianti `paved`, `fountain`, `garden`, controlli Builder, persistenza e placeholder grafici Canvas/WebGL2. La piazza è suolo pubblico, attraversabile dalla viabilità; non possiede un lotto residenziale.
- **CODICE / BRANCH (annessi civili)**: `src/settlement-civic-annexes.js` definisce 14 voci catalogate (5 chiesa, 5 taverna, 4 mercato): 13 annessi costruibili e il cimitero L1 intrinseco della chiesa, ciascuna con `parentId` e `annexType`; gestione nel menu principale, selezione, costruzione singola via click, eliminazione con il padre, livello minimo L1–L3, massimi per tipo, impronta e blocco collisioni. Gli annessi di chiesa/taverna rimangono nel lotto Voronoi del proprietario; quelli del mercato espandono il suolo pubblico vicino (entro 9U, non su lotti privati). Rappresentazioni provvisorie Canvas/WebGL2 e migrazione salvataggi.
- **CODICE / BRANCH (aggiornamento L1–L2)**: ogni chiesa L1 dispone automaticamente di un cimitero ricavato dalla porzione libera del proprio lotto Voronoi, con area riservata e tombe schematiche Canvas/WebGL2, senza creazione o cancellazione manuale di un figlio. La birreria (`brewery`) è un annesso selezionabile della taverna da L2, collocabile solo in prossimità dell'edificio all'interno del lotto. Se la proprietà non ha superficie sufficiente, il pannello segnala l'assenza temporanea di uno spazio per le tombe; non viene occupato suolo esterno al lotto.
- **NON REALIZZATO (voluto)**: lavoratori, effetti economici/sociali, posti letto, inventari, animazioni dedicate, costi e durata lavori degli annessi; rimangono istantanei/gratuiti nello skeleton. Collaudo visivo browser non eseguito.
- **QA**: `qa/urban-regression.cjs` e `qa/builder-placement-regression.cjs` estesi; workflow [Civil skeleton regression](https://github.com/erykwest/CONQUER/actions/workflows/civil-regression.yml) esegue anche `qa/urban-density-regression.cjs` e controlli sintattici; primo run [39021863368](https://github.com/erykwest/CONQUER/actions/runs/39021863368) **PASS**. Ultima CI dopo il fix di test su commit `9d0417f`: [run 39022033711](https://github.com/erykwest/CONQUER/actions/runs/39022033711) **PASS**; verifiche visuali in browser ancora da eseguire. **Nessun merge in `main`.**
- **QA cimitero/birreria**: test aggiunti a `qa/civic-annex-regression.cjs` per cimitero implicito, riserva di suolo, L2 e adiacenza della birreria e a `qa/urban-regression.cjs` per geometria su lotto Voronoi effettivo. [Run 39033162718](https://github.com/erykwest/CONQUER/actions/runs/39033162718) **PASS**, QA browser non eseguita.
- **QA aggiuntiva**: `qa/civic-annex-regression.cjs` incluso nello stesso workflow per cataloghi, L1–L3, geometria, collisioni, lotti e mercato; [run 39023575840](https://github.com/erykwest/CONQUER/actions/runs/39023575840) **PASS**; controllo anti-invasione di lotti incluso nel successivo [run 39023749740](https://github.com/erykwest/CONQUER/actions/runs/39023749740) **PASS** su commit `4353e53`.

## Diagnosi e fix in corso — crescita e ordini su main (16/10/2026)

- **Riprodotto a livello di codice su main `39caf15`:** `processVillageGrowth()` ritorna senza spawn quando `foundingRoadJob` lavora alle quattro arterie. La telemetria Supabase (16/10, 18:23–18:29 UTC) registra partite a giorno 30+ con decine di strade e zero abitanti, oltre a ricerche `ROAD_REPAIR_SLOW` e blocchi di frame. Le righe di telemetria non identificano con certezza quale branch Vercel fosse aperta.
- **Correzione su branch `fix/main-growth-during-road-planning-20261016`, PR [#52](https://github.com/erykwest/CONQUER/pull/52), non ancora in produzione:** consente case su arterie completate mentre la pianificazione dei bordi continua; conserva i pulse prima della prima strada; non lancia riparazioni concorrenti durante il lavoro in background.
- **Ordini militari:** il codice `main` richiede cavaliere entro 16U dall'unità e dalla destinazione, e la simulazione parte in pausa. La PR aggiunge messaggi chiari per fuori-raggio, percorsi non validi e pausa, senza alterare le regole di combattimento. Un malfunzionamento aggiuntivo della selezione non è ancora dimostrato.
- **Prove:** regressioni `qa/settlement-routing-spawn-regression.cjs`, `qa/combat-selection-regression.cjs` e intera suite deterministica in [GitHub Actions run 38948914788](https://github.com/erykwest/CONQUER/actions/runs/38948914788) **PASS** sul commit `b586607`. Rimangono da eseguire QA visuale/browser su salvataggio esistente e benchmark dei percorsi stradali.

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
| Rendering | `src/settlement-render.js`, `src/settlement-castle3d.js`, `src/settlement-world3d.js` | **CODICE SU MAIN**: scena/castello WebGL2 tridimensionali dal [commit db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697); renderer WebGL2 predefinito ove supportato dal [commit cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0) con fallback Canvas. La separazione tra regole e rendering **non è totale**; non è provata una pipeline glTF. |
| Minimappa / LOD | `src/settlement-minimap.js`, `src/settlement-lod.js`, [PR #44](https://github.com/erykwest/CONQUER/pull/44) | **MERGIATA SU MAIN il 16/10** ([2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9)): overview top-down con click/drag, edifici a blocchi nella minimappa, puntini per forze visibili e LOD delle unità nella scena sotto zoom 0,38. LOD edifici nella scena principale non dimostrato; QA browser/mobile/performance da completare. |
| Illuminazione | [PR #43](https://github.com/erykwest/CONQUER/pull/43), [PR #47](https://github.com/erykwest/CONQUER/pull/47) | **MERGIATE SU MAIN**: color grading per ora/stagione/meteo, Nightlight WebGL2 per luci di finestre/fuochi con fallback e diagnostica A/B; test comparativo controllato non documentato. |
| Lotto e architettura | [d3ca98e](https://github.com/erykwest/CONQUER/commit/d3ca98e6dc1d75d651aade3af6bfffa1585e4e48) | **CODICE SU MAIN (15/10)**: lotti Voronoi condivisi, cortili, piazza del pozzo, tetti L1–L4 e facciate a graticcio, con regressioni dedicate dichiarate nel commit. |
| Araldica | `src/settlement-heraldry.js`, `src/heraldry-symbols.js` | **CODICE citato nel backlog verificato**: editor/pattern SVG presenti; propagazione a ogni supporto da testare. |
| Alberi SVG | `src/assets/forest/tree_01_tonda.svg` … `tree_07_asimmetrica.svg` | **ASSET presenti secondo audit backlog**; integrazione/performance richiedono controllo. |
| Deploy | [vercel.json](../../vercel.json), [AGENTS.md](../../AGENTS.md) | **CONFIGURAZIONE**: deploy Git automatico abilitato solo su `main`; feature branch con CI e PR. |

Non confondere il testo del [README](../../README.md) (contiene sezione «V0.11 scope») con la baseline attuale: l'[index.html](../../index.html) mostra «Castle Lab V0.43». Versioni di testo, tag e prodotto vanno riconciliate separatamente.

## Verifiche di integrazione della settimana 10–16 ottobre

- **Assedi/fortificazioni:** [PR #21](https://github.com/erykwest/CONQUER/pull/21) integrata su `main` il 13/10 (Mastio, richiamo popolani, logistica P0, fossati/ponti/levatoi): **base utilizzabile, non simulazione di assedio completa**.
- **Economia:** [PR #22](https://github.com/erykwest/CONQUER/pull/22) integrata il 13/10 (coorti L1–L4, industrie, mercato, placement, rotazione/ghost); resta discontinuità fra stock `ConquerEconomy` e `State.resources`.
- **Calendario e urban:** [PR #31](https://github.com/erykwest/CONQUER/pull/31) stabilisce **48 secondi/giorno a 1×** e sincronizza routine visive; [PR #29](https://github.com/erykwest/CONQUER/pull/29) corregge calendario stagionale dei campi. **Resta il conflitto con la contabilità dei raccolti**.
- **Refactor:** [PR #38](https://github.com/erykwest/CONQUER/pull/38) integrata il 14/10 separa `castle`, `render`, `population`, `app` in file per responsabilità, con QA di equivalenza dei sorgenti. Non è una completa conversione a moduli ES né garantisce isolamento simulazione/presentazione.
- **Foreste e viabilità:** [PR #39](https://github.com/erykwest/CONQUER/pull/39) e [PR #42](https://github.com/erykwest/CONQUER/pull/42) integrate il 14/10 (boschi organici meno frammentati, strade aggiranti, ponti brevi ortogonali ai fiumi). La PR #42 dichiara **GitHub Actions verde** per suite deterministiche; nessun nuovo benchmark browser in questo aggiornamento.
- **Ambiente e morfologia:** [PR #43](https://github.com/erykwest/CONQUER/pull/43), [PR #47](https://github.com/erykwest/CONQUER/pull/47), [d3ca98e](https://github.com/erykwest/CONQUER/commit/d3ca98e6dc1d75d651aade3af6bfffa1585e4e48), [ee671e6](https://github.com/erykwest/CONQUER/commit/ee671e6f8af97a5dd3f55be72122a186ecb26ef9), [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99) integrano luce/meteo, Nightlight, lotti/case, biomi e rilievi continui con soglie neve/pini. Questi cambiamenti di presentazione e generazione non chiudono M0–M3 da soli.

## Avvisi di integrazione

### 1. Branch /urban non è /main

Alla verifica Git del 16/10 su `main` [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99), [`main...urban`](https://github.com/erykwest/CONQUER/compare/main...urban) è **diverged: 97 commit avanti / 24 indietro** (valori relativi e temporanei). La [PR #19](https://github.com/erykwest/CONQUER/pull/19) è ancora aperta: contiene ampie differenze urbanistiche e asset, non equivalenti a funzionalità già su main. Tra i file specifici risultavano:

- `src/settlement-livestock.js`, `src/settlement-animals.js`, `qa/urban-livestock-regression.cjs`;
- SVG di logging camp, cava e miniera sotto `src/assets/economy/`;
- integrazioni in `src/settlement-urban.js`, rendering e QA.

Anche [`sync/urban-main-2026-10-16`](https://github.com/erykwest/CONQUER/tree/sync/urban-main-2026-10-16) è divergente (**78 avanti / 24 indietro** vs `main`, stessa verifica). La [PR #45](https://github.com/erykwest/CONQUER/pull/45), integrata sulla branch `sync` e **non** su `main`, non chiude questa divergenza. **Non dedurre quale abbia il codice definitivo dal nome.** Controllare commit, PR e merge prima di usare/descrivere un asset come integrato. Evitare un merge cieco delle branch.

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

### Minimappa — integrata su main, collaudo end-to-end ancora necessario

La [PR #44](https://github.com/erykwest/CONQUER/pull/44) è stata **MERGIATA in main il 16/10/2026** al commit [2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9). Include `src/settlement-minimap.js`, CSS overlay e `src/settlement-lod.js`; navigazione top-down con clic/drag; blocchi edilizi nella minimappa; contatti tattici come puntini con la stessa condizione `spotted()` del Combat Engine; unità lontane a puntini in Canvas2D e in atlas 3D sotto `view.scale < 0.38`. La PR dichiara verifiche di sintassi e smoke test isolati. **Non è stata eseguita da questa revisione una prova completa browser/mobile/rotazione/benchmark; il LOD edilizio nel mondo principale non è incluso**. Il digest della conversazione rimane [storico](sources/MINIMAP-2026-10-15.md).

### Asset/rendering — esistenti, non assumere gestione RAM completa

Il modulo [settlement-assets.js](../../src/settlement-assets.js) mantiene cache di bitmap (192 voci) e compositi (32 MiB nominali); il primo è un limite **per numero**, non memoria globale. Il precedente `settlement-webgpu.js` è un compositore ibrido e **non** un importatore glTF. In aggiunta ora esistono `settlement-castle3d.js` e `settlement-world3d.js`, realmente WebGL2 e integrati nel percorso predefinito il 15/10; mantenuto fallback 2.5D/Canvas. Benchmark riferiti nel commit 3D (~39 ms/frame contro 76–100 in un scenario) **indicativi e non ripetuti in questa ricognizione**. L'asset pipeline glTF, l'isolamento completo della simulazione e il test sistematico dei cutaway restano da verificare. La branch `animation` e gli asset PNG/Blender esterni non vanno presunti in produzione.

L'export [VISUAL/AUDIO](sources/VISUAL-AUDIO-2026-10-14.md) riporta **asset Blender/PNG locali non committati**, con dimensioni non verificate e stime divergenti (627/657 MB): non registrarli come asset distribuiti. Audio/Suno, supporto glTF completo e verifica dei casi cutaway/danni/cantiere restano fuori dalla certificazione; **non** confondere questi obiettivi con l'implementazione WebGL2 già presente.

### Libreria audio — inventario storico Drive, non implementazione

L'export [Valuta suoni Pixabay](sources/PIXABAY-SOUNDS-2026-10-14.md) registra che **il 14/10** l'assistente ha elencato su Drive **24 MP3 (10 ambiente/natura, 14 effetti/attività)**, raggruppandoli dai nomi. Il file riporta tre nomi `rain-sound-550289`, due con la stessa dimensione. **Non sono stati ascoltati né ispezionati gli hash**, perciò il duplicato è un'ipotesi; non è stata rifatta ora l'ispezione del contenuto Drive. In questa importazione non sono stati importati MP3, misurate prestazioni audio, verificate licenze individuali o eseguiti test browser. I suoni rimangono **fuori Git** finché non vengono integrate risorse effettive.

L'utente ha richiesto sottofondo per stagione/meteo e SFX locali attivi **se selezionati o a zoom ≥30%**; l'implementazione resta da verificare, così come fade, attenuazione spaziale, limite voci e controllo autoplay.

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

## /camp — branch separata (16 ottobre 2026)

- **CODICE su `camp`**: nuova pagina `camp/index.html`, modulo `src/settlement-camp.js`, integrazione con Combat Engine e persistenza dedicata. `/urban` non modificato.
- **Comportamento previsto nel codice**: stanza barracks → capienza 16 soldati = 3 squadre da 5, con controlli nel fondo pagina; zona gialla → rientro navigato e dormita in caserma; esterno → tenda e braciere per truppa, un armigero visibile in guardia, gli altri nascosti fino all'alba.
- **QA**: `qa/camp-regression.cjs` e workflow `CAMP regression` sul branch. Test V8 isolato superato durante l'implementazione; workflow GitHub Actions `CAMP regression` [run 38935536886](https://github.com/erykwest/CONQUER/actions/runs/38935536886) **superato**, inclusi controllo sintassi e QA comportamentale Node. Collaudo browser reale/WebGL2/mobile ancora da verificare separatamente. Non ancora mergiato in `main`.

- 2026-10-20 · clay: aggiunta selezione muratura pietra/argilla per nuovi cantieri e preferenza per nuovi spawn delle case private; costi Builder 1:1, persistenza locale/cloud, colori per edificio, integrità core mattone 80%. L'estrazione della cava e l'economia dell'argilla non sono ancora integrate.

- 2026-10-20 · clay: una nuova modalità cava argilla arancione 4×4 H0, centro entro 6U da fiumi/torrenti/laghi, con stesse collisioni/quota e opzione Builder dedicata; registrazione clay nell'economia esistente e migrazione del ledger legacy. Produzione economia separata dall'inventario demo Builder.
