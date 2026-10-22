# Livello 2 — Stato tecnico e prove

> **Snapshot corrente del 21/10/2026** in [AUDIT-2026-10-21.md](AUDIT-2026-10-21.md), base `main` [7d9328a](https://github.com/erykwest/CONQUER/commit/7d9328ace504234ad34e0b4d89a662af456832e2). Le sezioni sotto sono **storiche** e descrivono lo stato di branch/ora all'epoca: non possono prevalere sui merge successivi.


## Snapshot attuale — main vs PR aperte (21/10/2026)

**MERGED / codice su main:** [#44](https://github.com/erykwest/CONQUER/pull/44) minimappa+LOD; [#53](https://github.com/erykwest/CONQUER/pull/53) /camp, pattuglie, lupi e notte; [#54](https://github.com/erykwest/CONQUER/pull/54) solare stagionale; [#57](https://github.com/erykwest/CONQUER/pull/57)/[#58](https://github.com/erykwest/CONQUER/pull/58) mulini/menu; [#63–69](https://github.com/erykwest/CONQUER/pull/69) terraforming e cache; [#70](https://github.com/erykwest/CONQUER/pull/70) performance; [#71](https://github.com/erykwest/CONQUER/pull/71) 7 utensili/lavoro/cantieri; [#73](https://github.com/erykwest/CONQUER/pull/73) terrapieni d'assalto.

**OPEN / non su main:** [#55](https://github.com/erykwest/CONQUER/pull/55) ledger unificato e **squadre L1 che costruiscono**, commercio e convogli skeleton; [#61](https://github.com/erykwest/CONQUER/pull/61) matrice danni; [#65](https://github.com/erykwest/CONQUER/pull/65) cutaway arredato; [#72](https://github.com/erykwest/CONQUER/pull/72) cavalieri/messaggero/tributo su base `knights`, non `main`. Anche #18 e #16 restano aperte. Nessuna delle PR aperte è qui equiparata a release.

**QA:** la PR #70 riporta 60/62 suite PASS e browser fixture 40/30 Canvas/WebGL PASS; due suite preesistenti falliscono, picchi GPU fino a 303,8 ms; questa ricognizione non riesegue i test. Per stato, prove, confini e milestone vedere [audit completo](AUDIT-2026-10-21.md). Le note locali precedenti sulla branch performance non descrivono più lo stato di rilascio.

## Portoni — magnete strade, ante, grata, drappi e torce (22/10/2026)

- **CODICE su branch `portoni`** (da `origin/main` `f739e51`), non su `main`. Nuovo modulo `src/settlement-gate-fittings.js` (`window.ConquerGates`) più agganci in castle3d/world3d, placement, input, navigazione, fuochi e pannello.
- **Magnete:** il tool portone aggancia la strada più vicina (centro sulla mezzeria, passaggio lungo la strada, il movimento sceglie solo il fronte esterno). `roadUsesGatePassage` campiona la mezzeria: ammessa se entra ed esce dalle bocche, anche se termina o curva nel passaggio; il piazzamento non la tratta più come collisione.
- **3D:** nel solo renderer World 3D il corpo del portone in pietra è scavato (pilastri, volta ogivale, pavimento) con la stessa sagoma del decal `gatePortal`; cornici del portale su entrambe le bocche. Ante come mesh dinamiche che ruotano verso l'interno in ~1,4 s seguendo `gate.closed`; scure se danneggiate, assenti se sfondate. I percorsi Canvas mantengono il blocco pieno.
- **Grata:** upgrade del portone in pietra (24 oro, 16 metallo, 6 legno), alza/abbassa animato ~2,2 s; abbassata (o in movimento) blocca i pedoni anche a portone aperto; sfondata la porta, cede anche la grata.
- **Drappi e torce:** due drappi con l'araldica del regno ai lati del portale esterno; due torce con staffa, fiamma e bagliore solo di notte, nascoste quando il fronte guarda via dalla camera.
- **QA:** nuova `qa/gate-fittings-regression.cjs` PASS; aggiornati i pattern sorgente di `gate-breach` e `mills3d`. Batteria non-browser 62/64 PASS; i due fallimenti `refactor-app-population` e `wall-bays` falliscono identici su `origin/main` pulito. Controllo visivo nel browser locale: ante aperte/semiaperte/chiuse, grata, notte con torce, vista posteriore, fallback Canvas con grata e torce. Suite browser (`.mjs`) e CI non eseguite.
- **LIMITI:** portone di legno solo con magnete; grata non è un bersaglio separato della matrice danni; un avviso WebGL preesistente ("no buffer is bound to enabled attribute") ha disattivato una volta il 3D durante le prove e non è stato riprodotto né attribuito a questo lavoro.

## Integrazione performance con main aggiornato (21/10/2026)

- **BASE E AUTORIZZAZIONE:** dopo la pubblicazione di `1520e00`, richiesto il merge. Integrato `origin/main` a `c94bdc1` nel branch `fix/construction-completion-perf` prima della PR/squash; le sezioni di audit sottostanti descrivono i rispettivi snapshot storici.
- **CONFLITTI RISOLTI:** conservati firma completa delle modifiche di terraforming e confronto dei lotti reali per la texture terreno; macerie transitorie dei mulini e flag/cache delle macerie ferme; pale/ruote dei mulini nel painter Canvas comune. Anche il crollo del mulino usa il ridisegno coalescente.
- **QA INTEGRAZIONE:** 60/62 suite PASS; soli fallimenti preesistenti `refactor-app-population-regression` e `wall-bays-regression`. Battaglia browser Canvas/WebGL completata a 298,1 s, stesso esito 37 contro 0, animazione in pausa e fallback con errore iniettato PASS. WebGL draw P95 16,9 ms / massimo 303,8 ms, Canvas 7,5 / 12,5 ms: i picchi GPU residui restano aperti. Artefatti locali `output/playwright/mass-battle/integration-main.json` e `regressions-integration.json`. Stato PR/CI/merge verificabile nella cronologia GitHub, senza anticipare il deploy.

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

## Audit prestazioni completamenti (20/10/2026)

- **CODICE LOCALE / NON RILASCIATO:** branch `fix/construction-completion-perf`, base `main` `996b4a4` aggiornata con pull. Manutenzione stradale dei completamenti distribuita in intervalli con budget 6 ms; cancellazione/ricalcolo su modifica della topologia; invalidazione del catasto limitata ai cambiamenti reali; controllo errori WebGL2 differito tramite fence.
- **PROVE:** benchmark ripetibile Chromium/WebGL2 e Canvas, regressioni di completamento e controllo errori GPU. Misure, comandi, artefatti e fallimenti preesistenti sono nell'[audit del 20/10](../construction-performance-audit-2026-10-20.md).
- **RISULTATI LOCALI:** mediana WebGL2 manutenzione + primo disegno: torre 686→15 ms, portale 535→14 ms, stress 8 torri/mura/portale 1.981→457 ms. Batteria conclusiva 53/55 suite PASS; i due test sorgente falliscono anche su main. Sintassi e whitespace PASS; errore GPU iniettato porta a un Canvas visibile. Persistono picchi grafici nel castello stress e nel ciclo attivo: non è una certificazione di fluidità generale.
- **LIMITE:** modifiche nel working tree, nessun commit/push/PR/merge/deploy o CI remota; non dichiarate disponibili su `main`. Roadmap e priorità M0–M3 invariate.

## Audit round 2 — fuoco, crolli e cutaway (20/10/2026)

- **CODICE LOCALE / NON RILASCIATO:** continua `fix/construction-completion-perf` sopra il round 1. Ridisegni dei danni coalescenti nel RAF di simulazione, navigazione preservata per i soli HP, buffer GPU per macerie ferme, cache composita del cutaway senza includere gli occupanti animati.
- **QA LOCALE:** 54/56 suite PASS; i due fallimenti sorgente sono quelli già riprodotti su main. Incendio browser su 32 strutture, 30 crolli/12 ceppi, 12 cutaway, brigata con sei addette e incendio naturale fino al collasso di 24 case. Pixel del cutaway verificati a due rotazioni e due palette; buffer statici verificati stabili fino alla rotazione.
- **RISULTATI E LIMITI:** logica incendio 7,3 s→6 ms e crolli 1,23 s→15 ms nella campagna comparabile; il rendering è differito e non va contato come eliminato. Cutaway WebGL P50 20→6 ms per disegno; macerie ferme circa 1 ms. Restano crolli Canvas fino a 2,23 s, percorsi brigata 140–330 ms e variabilità della composizione. [Audit completo](../fire-collapse-cutaway-performance-audit-2026-10-20.md).
- **STATO GIT:** working tree locale, nessun commit/push/PR/merge/deploy o CI remota. Priorità della roadmap invariate.

## Audit round 3 — Canvas, brigata, mura e attacco (20/10/2026)

- **CODICE LOCALE:** continua `fix/construction-completion-perf`. Cache composita delle macerie Canvas ferme; A* cooperativo della brigata con budget indicativo 4 ms e priorità rotante; sagome/costi locali alla ricerca; rimossi percorsi diretti attraverso ostacoli e corrette le tangenti al pozzo che bloccavano le addette.
- **PROVE BROWSER:** due renderer, 12 crolli, incendio su 24 case/sei addette, un cavaliere con cinque squadre in salita/discesa e 20 assalitori con scala, camminamento, discesa e combattimento reale. Otto casi a tempo simulato e quattro osservazioni con rendering continuo; nessun fault del motore nelle osservazioni finali. Pixel verificati su rotazioni/pan/zoom/plan view e tre materiali.
- **RISULTATI E RESIDUI:** peggior aggiornamento brigata circa 1,8–2,4 s→25–32 ms, zero attraversamenti nei segmenti controllati. Macerie Canvas ferme riusate in circa 0,5 ms; **il primo disegno dopo la caduta può ancora fermarsi per 3 s**, e i crolli attivi restano pesanti. RAF militare variabile, fino a P95 133–150 ms nel caso delle squadre: non è una dichiarazione di fluidità generale. [Audit completo](../movement-collapse-performance-audit-2026-10-20.md), decisione D-036.
- **QA / STATO:** 55/57 suite locali PASS; restano i due fallimenti sorgente già riprodotti su main. Sintassi dei sorgenti e whitespace PASS. Working tree locale, nessun commit/push/PR/merge/deploy o CI remota. Roadmap e priorità invariate.

## Scontro 40 contro 30 — prova fino all'eliminazione (21/10/2026)

- **BASE:** `9e1b6a5` pubblicato su `fix/construction-completion-perf`, CI Civil PASS. Le correzioni di questa nuova prova sono ulteriori modifiche locali non pubblicate.
- **SCENARIO E RISULTATO:** 15 arcieri/20 fanti/5 cavalieri difensori contro 10 arcieri/17 fanti/3 cavalieri attaccanti, come 70 entità singole. Campo aperto e seed 12345. Canvas e WebGL arrivano entrambi a 0 attaccanti dopo 298,1 s simulati; restano 15 arcieri, 19 fanti, 3 cavalieri difensori. Tutte le sei combinazioni lato/tipo infliggono danni; nessun HP azzerato dal driver di prova.
- **CORREZIONI LOCALI:** persistenza/render dei tipi individuali, arcieri mobili di entrambi i lati, velocità dei cavalieri attaccanti e filtro di portata prima di collisioni/LOS costose. Nessun cambio ai valori di HP, armatura o dadi. Sette regressioni dedicate.
- **QA FINALE:** 56/58 suite PASS; restano `refactor-app-population-regression.cjs` e `wall-bays-regression.cjs`, già falliti su main. Sintassi e whitespace PASS. Nessun nuovo commit/push o CI remota per questo round.
- **PERFORMANCE:** logica P95 circa 1 ms; Canvas draw P95 7,3 ms nella campagna principale. WebGL variabile fra P95 8,7 e 132,9 ms nelle ripetizioni: il profilo principale trova circa 3 s in `getError`. Il tentativo di aggiungere fence ai passaggi successivi non ha dimostrato beneficio ed è stato rimosso. La prova accelerata non certifica FPS a 1×. [Audit e comandi](../mass-battle-performance-audit-2026-10-21.md).

## Ulteriore audit rendering 40/30 (21/10/2026)

- **CODICE LOCALE:** animazioni di combattimento in pausa nel ciclo visuale condiviso; controllo errori WebGL distanziato di almeno 1 s, checkpoint dopo front/luci e attesa della fence con limite per evitare verifiche rimandate all'infinito. Perdita del contesto ancora controllata a ogni disegno; fallback Canvas mantenuto.
- **MISURE:** baseline WebGL strumentata 324 disegni / 10,72 s cumulativi; due prove finali 174/170 disegni e 2,97/1,89 s (**−72–82%**). P95 76,5/8,3 ms contro 163,4 ms; **restano singoli blocchi fino a 396 ms**, quindi fluidità generale non dichiarata. Canvas 177 disegni / 0,738 s contro 326 / 1,433 s della campagna precedente. [Dati e limiti](../mass-battle-performance-audit-2026-10-21.md#ulteriore-riduzione-dei-costi-di-rendering--21102026).
- **COMPORTAMENTO:** stessa eliminazione a 298,1 s simulati e 37 difensori superstiti. Verificati nel browser colpo/termine animazione in pausa e fallback dipinto con errore GPU iniettato. Esperimenti framebuffer/backpressure scartati. Base `9e1b6a5`; nuove modifiche non pubblicate. D-038; roadmap invariata.
- **QA CONCLUSIVA:** 57/59 suite PASS, con i soli due fallimenti preesistenti su main (`refactor-app-population-regression`, `wall-bays-regression`). Sintassi e whitespace PASS; hash runtime corrispondenti alla misura finale.

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
