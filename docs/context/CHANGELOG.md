# Livello 5 — Diario delle variazioni del contesto

## 2026-10-25 — Eventi: pubblico nascosto da balaustre e schienali

- Le figure sulle tribune (giostra, torneo, teatro) e nell'arena vengono coperte dalla balaustra, dai drappi e dallo schienale. Questi pezzi vengono ridisegnati in ordine di profondità insieme alle figure: ogni pezzo si ordina sul bordo della tribuna, spinto di 0,4 U verso l'esterno. Le figure vengono disegnate a gruppi tra un occlusore e l'altro, così un fotogramma della giostra costa circa 14 ms. QA in `event-people-regression`.
- Resta aperto: le figure sono disegnate sopra gli edifici di altre strutture che stanno davanti allo spazio (sovrapposizione 2D, come i paesani).

## 2026-10-25 — Eventi: accampamento affollato

- L'accampamento dei cavalieri ha tre coppie che si allenano, un gruppo di tre persone che chiacchiera davanti a ogni tenda (slot `chat`) e due inservienti a ogni rastrelliera e armatura (slot `tend`), oltre agli scudieri: oltre 40 persone. QA estesa.

## 2026-10-23 — Eventi: bardatura dei cavalli, torneo, accampamento e teatro animati

- I cavalli della giostra hanno una gualdrappa (drappo partito, orlo dorato, crinale e pennacchio) disegnata sul cavallo 2D con la **stessa coppia di colori casuali del cavaliere**. Nuovi slot `fight` per tre coppie nel recinto del torneo e una coppia che si allena nell'accampamento, `prepare` davanti alle tende di torneo e accampamento, `perform`/`wait` per attori e quinte del teatro; scene animate dello spiazzo per torneo, accampamento e teatro. QA estese; verifica nel browser.

## 2026-10-23 — Eventi: costruibili dal Builder

- Nuova categoria **Eventi e svago** nel Builder con pulpito, palco, spiazzo eventi e arena; piazzamento a due clic con il preflight comune; agganci per impronta, nome, costo e durata; ispettore con veste del palco e scelta / avvio / chiusura dell'evento sullo spiazzo, ciclo `preparing → active → clearing → idle` sull'orologio di gioco. Spiazzo gratuito e senza cantiere; palco, pulpito e arena con costi in legno/oro e cantiere. QA `events-builder-regression`; collaudo nel browser con clic reali (piazzamento, selezione, avvio giostra, montaggio progressivo, persistenza dopo ricarica).

## 2026-10-23 — Eventi: persone in arena, palco e pulpito

- Nuovi slot CANS `fight` (due combattenti nella sabbia dell'arena) e `prepare` (uno scudiero per tenda del lotto arena). Scena `venueScene` per lotto arena, palco (attori e pubblico / banditore e folla) e pulpito (musico e cantastorie con ascoltatori), sempre animata; il pubblico dell'arena esulta a ogni colpo. Biglietteria del lotto arena girata verso l'interno perché la coda resti nel lotto. QA `event-people-regression` estesa; verifica Canvas nel browser.

## 2026-10-23 — Eventi: persone allineate a CANS, sagra e circo animati

- Nuovo `settlement-events-people.js`: slot con ID stabile, ruolo `guest`/`worker` e azione ricavati dai modelli (dominio = spazio evento) e registro occupanti con invarianti CANS (un occupante per slot e uno slot per occupante); sorgente **provvisoria** deterministica di figuranti marcati `provisional`, sostituibile da un adapter CANS. Giostra, sagra e circo disegnano solo occupanti registrati. Sagra: commensali, venditori, attori, cantastorie e pubblico, clienti che passeggiano tra le bancarelle; circo: imbonitore, giocoliere, biglietterie, code e ingresso nel tendone. QA `event-people-regression` e `joust-regression` PASS; verifica Canvas nel browser. Nessun runtime CANS implementato.

## 2026-10-23 — Eventi: giostra animata

- Nuovo `settlement-events-joust.js`: pubblico sugli spalti (≈2/3 dei posti, esulta all'impatto), due cavalieri che caricano lungo le corsie e a ogni corsa uno viene disarcionato (cade, resta a terra, si rialza, torna al cavallo), corse alternate tra le testate; stallieri con cavalli di riserva e scudieri che portano lance e scudi tra tende e testate. Figure 2D (popolani, soldati, cavallo 2D `drawAnimal`): i modelli 3D degli animali sono superati (indicazione dell'utente). QA `joust-regression` (12 corse); verifica Canvas nel browser.

## 2026-10-23 — Eventi: CI della PR #78

- Le stoffe degli eventi entrano nello strato dinamico WebGL con un ciclo proprio, lasciando invariata la lista sorgente verificata da `qa/mills3d-regression.cjs` (causa dei fallimenti di `menu-regression` e `settlement-qa`); dopo la correzione entrambi i check PASS in CI. `refactor-app-population` e `wall-bays` falliscono solo in checkout Windows con `core.autocrlf=true` (i test cercano frammenti con fine riga LF): con checkout LF, come in CI, passano anche su `main`. Non sono fallimenti del codice

2026-10-22 — Eventi: disposizione casuale senza collisioni

- Il jitter di tende, scatter e attrezzature prova spostamenti decrescenti e scarta quelli che urtano oggetti già piazzati, posizioni di base degli oggetti successivi o il perimetro; in mancanza resta nella posizione di base (validata). QA su 25 seed per tutti gli allestimenti: nessuna collisione né uscita, 91% degli oggetti spostabili ancora spostati.

## 2026-10-22 — Eventi: bandiere al vento

- Pennoni, festoni, gonfaloni e stendardi ondeggiano: pesi di stoffa esportati dal builder (parte `f`), strato dinamico come le pale dei mulini (WebGL e 2.5D), ampiezza legata al vento del meteo, fermi a gioco in pausa. Costo misurato ~0,6 ms per frame sul lotto arena (916 triangoli di stoffa). QA `events3d-regression` estesa; nel browser verificati movimento e assenza di errori (pannello nascosto: frame forzati a mano).

## 2026-10-22 — Eventi: disposizione più casuale

- Jitter delle tende portato a ±40° / 75% (prima 12%), scatter e attrezzature fino al 200% (su richiesta esplicita, possibili contatti tra oggetti); esteso a scatter, rastrelliere e armature in tutti gli allestimenti (D-045).

## 2026-10-22 — Eventi: tende non allineate e tutte diverse

- In arena, torneo e circo le tende ruotano di ±25° e si spostano fino al 5% della loro misura (deterministico per partita). Le coppie di colori delle tende sono uniche in ogni spazio, su cinque smalti (D-045 aggiornata). QA estesa.

## 2026-10-22 — Eventi: arena arricchita in lotto dedicato

- `arenaU` ora ha campo in sabbia, palco d'onore coperto con gonfaloni araldici e torri d'ingresso con stendardi. Nuovo spazio permanente `arenaLot` 18 × 14 U con 8 tende dei partecipanti, rastrelliere, armature, carri e merci scatter; l'arena esce dagli allestimenti dello spiazzo 14 × 10. QA aggiornata, verifica Canvas nel browser.

## 2026-10-22 — Eventi: torneo, circo e sagra ampliati, catalogo leisure

- Nuovo allestimento `tourney` (campo recintato, 4 tribune, 4 tende); circo con biglietterie, giocoliere, festoni e merci scatter; sagra con 16 tavoli. Nuovi modelli `circusBooth`, `propBunting`, `propFence`; gli allestimenti possono usare asset scatter (`sc:`). Catalogo illustrato in docs/events. QA aggiornata.

## 2026-10-22 — Eventi: spiazzo polivalente 14 × 10

- Lo spiazzo eventi passa da 6 × 10 a 14 × 10 U su richiesta esplicita (D-044); ridisegnati a grandezza piena i layout di giostra, circo, sagra, accampamento, teatro e arena. Registrate in DECISIONS anche le regole di livrea (D-045). QA `events3d-regression` aggiornata (tutti gli allestimenti nel 14 × 10, nessuno nel 6 × 10).

## 2026-10-22 — Eventi: modelli 3D di podio, palchi e spiazzo polivalente

- Su `events` aggiunti catalogo Blender (`tools/blender/build_events.py`, `src/assets/event-models.js`), modulo `src/settlement-events3d.js`, agganci nei renderer 2.5D e WebGL, QA `events3d-regression` e relativa Action.
- [docs/events/README.md](../events/README.md) descrive il contratto `eventVenue`, gli allestimenti e le regole di livrea; STATUS e BACKLOG distinguono i modelli presenti dal gameplay ancora da fare.
- ROADMAP e DECISIONS invariati: le taglie dello spiazzo oltre 6 × 10 restano una proposta (EV-P3)

## 2026-10-28 — Cutaway di chiesa e locanda (branch `feature/civic-cutaway`)

- La chiesa o la locanda selezionata si apre in sezione con arredi; il contorno di selezione segue l'impronta a terra; mura ed edifici non si piazzano più dentro le foreste o sotto le chiome. Allineato a `main` `5ddefa6`. Stato e prove in [STATUS](STATUS.md#cutaway-civico-e-contorno-di-selezione-branch-featurecivic-cutaway-23102026).
- ROADMAP e DECISIONS invariate: estende il cutaway esistente agli edifici civici, nessun nuovo contratto.

## 2026-10-26 — Mesh: niente più facce bicolori; export PNG 512 dal Lab

- `ConquerMesh3D.shadeFactor` riconosce le facce superiori da `|nz|`. Gli export di Blender non hanno un ordine dei vertici coerente, quindi metà dei triangoli di uno stesso tetto (taverna, birrificio, loggia…) risultava scura (0,5). Ora il tono è uniforme in Canvas 2D, WebGL e Lab. Audit del Lab: 465 render, 0 errori, 128 cambiati; baseline aggiornata dopo la revisione.
- Il Lab disegna i modelli con un depth buffer software (2× supersample), come la WebGL del gioco. Il painter 2.5D ordina per triangolo e tagliava i telai a graticcio e le finestre quasi complanari ai muri, quindi mostrava difetti che in WebGL non ci sono; restano solo nel fallback Canvas 2D del gioco. Revisione a 512 di tutti i 109 modelli; audit: 0 errori, baseline aggiornata.
- Asset Lab: occupazione forzata («Occupazione»: no / occlusione corretta / come nel gioco), con popolani su terreno, pavimenti e portici, per verificare l'occlusione delle figure.
- Asset Lab: pulsante «Esporta PNG 512», che esporta l'anteprima corrente (stato e rotazione) in 512 × 512, e la funzione `ConquerAssetCatalog.exportImage`.

## 2026-10-28 — UI v2: modalità Difendi (branch `feature/ui-defend`)

- Quarta fase della UI v2 opt-in (`?ui=2`): modalità Difendi con rail e scheda, stato del combattimento letto da `ConquerCombat.uiState()`. Registrate anche le fasi 1–3 già su `main` (`5ddefa6`) che non avevano voce nella piramide. Stato e prove in [STATUS](STATUS.md#ui-v2-isole--modalità-difendi-branch-featureui-defend-26102026), fasi aperte nel [BACKLOG](BACKLOG.md#ux--ui-v2-isole-opt-in-ui2-26102026).
- ROADMAP e DECISIONS invariate: la UI v2 resta opt-in, nessun contratto di simulazione toccato.

## 2026-10-23 — Fix fondazione strade, DEV e fallback WebGL nel branch

- Riallineata `fix/main-founding-dev-webgl-20261023` a main `bc82dbe`, conservando gli aggiornamenti Lab e manutenzione.
- Isolati gli attributi GPU con VAO per shader; preparati in modo cooperativo strade/ponti prima della sostituzione atomica; aggiornata la QA DEV ai default automatici con prova dei controlli reali.
- Nuove regressioni per lavoro geometrico per avanzamento, annullamento senza effetti parziali, renderer ancora attivo dopo rebuild e fallback da vera perdita del contesto. 68 suite, 152 controlli di sintassi e due suite browser PASS locali; audit Lab 456 render/0 errori/49 avvisi/11 firme cambiate preesistenti, fogli fortificazioni rivisti e baseline invariata.
- Aggiunta CI di branch/PR con regressioni complete, browser, audit e Context sync. STATUS/BACKLOG aggiornati e D-FIX-01 registrato; ROADMAP invariata perché sono correzioni, non nuove milestone. Nessun merge in main o deploy.

## 2026-10-23 — Diagnosi dei tre problemi sulla branch di fix

- Riallineata la copia di lavoro alla main `b79ea99` e documentate le cause di fallback WebGL, test DEV e tempi della fondazione strade nel [report](../main-fixes-diagnosis-2026-10-23.md), con riproduzioni e prove A/B.
- Aggiornati STATUS e BACKLOG: nessun sorgente runtime/test permanente modificato, nessun fix dichiarato completo. ROADMAP e DECISIONS invariati; nessuna nuova PR, merge o pubblicazione.

## 2026-10-23 — Ponti: magnete strade

- Branch `feat/bridge-road-magnets`: le strade principali si agganciano alle due testate di ogni ponte e una strada su una testata non è più rifiutata come sovrapposizione. Stato e prove in [STATUS](STATUS.md#ponti--magnete-strade-23102026); requisiti BRIDGE-01/02 nel [BACKLOG](BACKLOG.md#ponti--magnete-strade-branch-featbridge-road-magnets-23102026).
- ROADMAP e DECISIONS invariate: estensione del magnete esistente dei portoni, nessun nuovo contratto.

## 2026-10-23 — Guardaroba stagionale dei popolani (branch)

- Su `feature/seasonal-clothing`: catalogo di 9 overlay di abbigliamento (pioggia, inverno, estate, mezze stagioni ventose) sopra la figura procedurale dei popolani, scelti automaticamente da mese e meteo, con transizioni graduali nei mesi di passaggio. Scelto l'overlay a strati invece delle skin alternative: i capi si combinano e la sagoma/colore di classe resta leggibile.
- Colori dell'abbigliamento per classe: L1 grigio/beige, L2 verde/marrone, L3 primari desaturati, L4 primari accesi, condivisi da tuniche e capi in tessuto.
- Voci nell'Asset Lab e selettore stagione/meteo nel lab animato; nuova regressione `wardrobe`. **CI e merge ancora da verificare.** Invariati ROADMAP e DECISIONS: miglioramento solo visivo, nessun contratto di simulazione toccato.

## 2026-10-23 — Converge: preparazione merge #61 sulla main aggiornata

- Integrata main `518e830` nel branch `converge` (9 commit propri, 37 da recuperare), risolvendo i conflitti assedio/decisioni senza sostituire i moduli moderni. Preservati grata/porta/core indipendenti, terrapieni e ottimizzazioni di rendering; aggiunti guard compatibili con `portcullis`.
- Rafforzate regressioni su grate, input invalidi, persistenza e scheduler; nuova QA del pannello reale PASS gameplay Canvas + avvio WebGL, con fallback grafico preesistente riprodotto sulla main e registrato nel report. Test locali 67/68 PASS; stesso FAIL temporale su fondazione strade presente anche sulla main (66/67). UI/Combat legacy fallisce sul default DEV anche in main. CI da attestare sulla PR prima del merge.
- Aggiornati STATUS/BACKLOG/DECISIONS. ROADMAP invariata (nessun cambio di milestone/priorità). PR #61 ancora aperta; nessun merge in main e nessun deploy.
- **FOLLOW-UP:** merge autorizzato; prima della esecuzione recuperati altri 4 commit della main fino a `bc82dbe` (Asset Lab #82 e manutenzione), preservando codice e note recenti. CI da ripetere prima del merge effettivo.

## 2026-10-23 — Asset Lab: motore di audit visivo (branch `feat/asset-lab-audit`)

- Il Lab diventa il motore di audit: `ConquerAssetStage` cattura ogni fortificazione negli stati di cantiere, danno e cutaway con il render del gioco; `ConquerAssetAudit` controlla tutti gli asset, confronta con la baseline revisionata e gestisce le deroghe; `qa/asset-audit.mjs` produce report e fogli provini anche in CI.
- `/lab` apre il Lab direttamente; la sandbox `?assetlab=1` non avvia la simulazione e usa un mondo fisso.
- Nuova procedura [ASSET-LAB-AUDIT](../ASSET-LAB-AUDIT.md) e regola in `AGENTS.md`. Riscontri del primo audit registrati nel BACKLOG (cantiere non progressivo, danno al portone, legno con SwiftShader). DECISIONS: D-LAB-02. ROADMAP invariata

2026-10-23 — Pulizia Git verificata e finalizzazione

- Workflow [#39982707805](https://github.com/erykwest/CONQUER/actions/runs/39982707805) completato **SUCCESS** e otto branch non più presenti nell'elenco remoto.
- Aggiornato lo stesso workflow per eliminare anche la branch della prima PR di manutenzione #84 e **autocancellare** la propria branch sorgente solo dopo controllo GitHub PR merged e confronto SHA, evitando di lasciare branch tecniche aggiuntive. Nessun nuovo gameplay o cambiamento di scope; ROADMAP/DECISIONS invariati.

## 2026-10-23 — Workflow per eliminare branch obsolete in modo sicuro

- Ricontrollate tutte le branch remote rispetto a `main`, PR aperte e merge. Pianificata la rimozione di **otto ref** già merge/totalmente assorbiti; i ref con HEAD post-merge, PR aperte o commit esclusivi sono deliberatamente preservati.
- Aggiunto workflow a trigger unico su merge in `main`, con lista esplicita nome + SHA, controllo PR merge o vera discendenza Git, e confronto HEAD prima di eseguire ogni DELETE. I risultati reali della rimozione devono essere letti nei log GitHub Actions; **questo changelog non anticipa il risultato**.
- Nessun ref viene cancellato o forzato dal solo aggiornamento documentale; nessuna modifica al gameplay. ROADMAP/DECISIONS invariati.

## 2026-10-23 — Nuovo audit main dopo le PR #76 e #79–81

- HEAD `main` `518e830`, **sei commit** successivi al merge documentale #75, quattro PR funzionali **MERGED**: #76 Portoni, #79 Asset Lab unificato, #80 rotazione 3D, #81 22 fortificazioni reali/manifest/lavori. Audit documentato in [AUDIT-2026-10-23](AUDIT-2026-10-23.md).
- Corrette in `BACKLOG` e `STATUS` le diciture **«solo branch»** diventate false dopo i merge. GATE-01/01b/02/03/04/06 ora MAIN, GATE-05/GATE-07 ancora aperti; Asset Lab #81 MAIN, audit #82 ancora OPEN.
- Segnalati residui ancora su PR #61 (danni), #77 (montaggio per fasi + case), #78 (Eventi), #82 (audit visuale), #55 (costruttori/ledger), #65 (interni), #72 (cavalieri su `knights`), #18/#16 (draft).
- **Rischio non riprodotto qui:** #82 segnala, sulla propria branch, portoni danneggiati/sfondati visivamente mancanti dopo #76 e cantieri con 25/50/75% quasi identici: riportati come **test da fare su main**, non come guasto confermato.
- Riconfermato che **13 core Builder** sono presenti e **10 residui** restano di integrazione; roadmap M0–M5 invariata. CI #76 e #81 verificate PASS sulle rispettive HEAD; nessun nuovo test runtime/browser eseguito per questo audit. Nessuna decisione progettuale nuova.

## 2026-10-23 — Asset Lab: catalogo completo (branch `feat/asset-lab-complete-catalog`)

- Fortificazioni in pietra reintrodotte con geometria reale: il Lab apre il gioco in sandbox (`index.html?assetlab=1`, senza salvataggi, cloud né telemetria) e chiede a `ConquerSiegePreview.assetMesh` le mesh `ConquerCastle3D` di ogni variante della galleria distruzione. Le 7 varianti in legno sono escluse e dichiarate.
- Aggiunte le 7 animazioni di lavoro; il manifest dei file è generato da `tools/build-asset-manifest.cjs` (controllato in CI) e include i set di rotazione di campo taglialegna e cava.
- Corretti ricerca («undefined»), codice morto di `renderSchema`, schede della griglia schiacciate. Aggiornati STATUS e BACKLOG; DECISIONS con il contratto della sandbox (D-LAB-01). ROADMAP invariata: strumento DEV, nessun cambio di priorità.
- Corretto lo stato di #80 in STATUS: era indicato «non ancora `main`» ma è integrato (`bf548ca`).

## 2026-10-22 — Asset Lab: rotazione ±15° e rimozione pseudo-fortificazioni (branch)

- Su `fix/asset-lab-rotation-and-components`: comandi di rotazione sotto la preview dell'inspector, proiezione 3D orientabile a intervalli di 15°, rotazione delle anteprime native animate e disattivazione del giro automatico su interazione.
- Eliminata la categoria «Fortificazioni» che sovrastimava semplici sottopezzi; sprite PNG reali riclassificati «Componenti», 13 schemi generici di fortificazione esclusi dalla griglia.
- Rafforzate QA statiche e Chromium (rotazione effettiva, reversibilità, animazioni e categorie). **Esito CI nuovo ramo e merge ancora da verificare.** Invariati ROADMAP e DECISIONS: correzione di sola UX/accuratezza del catalogo.

## 2026-10-22 — Asset Lab unificato (merge #79 su main)

- Catalogo visuale in `figures-lab.html`, classificazione asset e modelli nativi; filtri, anteprime SVG/PNG, modelli 3D e figure animate.
- Browser Chromium e regressione dedicata **PASS** sulla PR #79; squash merge `f576ac5` in `main`. I diagrammi SCHEMA delle strutture procedurali non certificavano modelli completi, problema affrontato nella nuova iterazione.

Il changelog descrive **modifiche della documentazione e della direzione**, non sostituisce la cronologia dei commit o le note di release del gioco.

## 2026-10-22 — Oggetti di cantiere per fase (branch `feature/construction-props`)

- Scelto come ambito del backlog la **progressione visiva dei cantieri**; prima tappa: kit modulare di oggetti Blender e loro comparsa/rimozione per fase (`prep`/`raise`/`finish`). Aggiornati [BACKLOG](BACKLOG.md) (voce *Elementi di cantiere animati*, con residui) e [STATUS](STATUS.md). ROADMAP e DECISIONS invariati: nessun contratto o priorità cambiati.
- Allineato a `main` dopo #76 (portoni), #79/#80 (Asset Lab): conflitti in `index.html`, `STATUS.md`, `CHANGELOG.md` risolti tenendo entrambe le parti; le porte in cantiere usano ora il corpo scavato di `ConquerGates.addGateBody` (il ritaglio del varco del montaggio resta solo come ripiego).
- Montaggio esteso a torre tonda, porta, muro, palizzata, `built`, taverna e mercato; avanzamento orizzontale per muri e palizzate; ponteggi su tutti i lati di torri e porte; cache a immagine per cantiere (prestazioni da ~1 s a 2–6 ms per frame con 10 cantieri).
- Unito il branch `case` in `feature/construction-props` (conflitti solo in `index.html` e `STATUS.md`, tenute entrambe le parti); il montaggio delle case ora riusa `ConquerWorld3D.addHouse`.
- Aggiunto il prototipo di **montaggio pezzo per pezzo** (quota di cantiere che taglia l'edificio finito) provato su torre T2 H2, chiesa L2 e casa L3; registrati in BACKLOG e STATUS i residui (dettagli 2.5D, tipi non provati, animazione di posa, prestazioni).

## 2026-10-22 — Portoni: magnete strade e accessori

- Branch `portoni`: magnete del portone sulle strade, passaggio voltato 3D con ante animate, upgrade grata per il portone in pietra, drappi araldici e torce notturne. Stato, prove e limiti in [STATUS](STATUS.md#portoni--magnete-strade-ante-grata-drappi-e-torce-22102026); requisiti GATE-01…06 nel [BACKLOG](BACKLOG.md#portoni--accessori-del-portone-branch-portoni-22102026).
- Aggiunto il magnete delle strade principali sulle due bocche del portone (GATE-01b).
- Decisa e implementata la grata come strato difensivo separato con HP propri (D-042, GATE-06); aperto GATE-07 per l'IA d'assedio. ROADMAP invariata.

## 2026-10-22 — Revisione integrale backlog vs codice main

- Audit **statico** della HEAD `c52b537` (sorgenti, 23 ID Builder, 25 requisiti S, CLAY, F/C/X, voice backlog, QA presente, PR aperte). Evidenze e limiti in [AUDIT-2026-10-22](AUDIT-2026-10-22.md).
- Corretti falsi TODO: P2-16 basamenti; P2-18/19/20 araldica; P3-21 alberi sette SVG già collegati; P3-22 scatter contestuale 7 famiglie e ≥25 modelli; ponti, fossati, levatoi, palizzate. **13 nuclei Builder** su main e **10 voci** con residui meccanici/integrazione o QA. Una casella chiusa ora significa base di codice presente, non browser PASS.
- Riconciliato **CLAY**: modalità cava argilla, `brick` e costi materiali, palette e durabilità 80% già codificati su main; precedente etichetta "DESIGN NON IMPLEMENTATO" rimane solo come nota storica 19/10.
- Corretto il backlog assedi: Mastio, stock/capienze, HP, porte, fire spread, macchine e terrapieni sono implementazioni/prototipi reali; **blocco completo, resa automatica e strategia IA** non verificati e rimangono aperti.
- Confermato output miniera `stone` su main, non `metal`; economia `State.resources` / `State.economy` / `State.siege.stock` separata; #55 draft, #61/#65 aperte, #72 con base `knights`. Nessuna PR è stata mergiata per questa sola revisione documentale.
- Aggiornati [feature-backlog](../feature-backlog.md), [BACKLOG](BACKLOG.md), [STATUS](STATUS.md), [ROADMAP](ROADMAP.md). **Non rieseguite** suite QA e browser durante l'audit; non cambiate decisioni di design, solo stati verificati.

## 2026-10-21 — Audit live main e guardia di coerenza per ogni PR

- Ricontrollata la base `main` [7d9328a](https://github.com/erykwest/CONQUER/commit/7d9328ace504234ad34e0b4d89a662af456832e2), merge effettivi e PR aperte. Creata la [ricognizione datata](AUDIT-2026-10-21.md), senza trasformare report di PR in nuove QA eseguite.
- **Mergiati:** `/camp` #53, solare #54, minimappa/LOD #44, mulini #57/#58, terraforming #63–69, performance #70, animazioni lavoro #71, terrapieni d'assalto #73. Superate le descrizioni precedenti delle rispettive branch come non integrate.
- **PR aperte:** #55 ledger/cantieri L1/commercio/convogli, #61 danni, #65 cutaway arredato, #72 cavalieri/messaggero (base `knights`), oltre a #18 visual QA e #16 hardening. Queste non sono in `main`.
- Aggiornati `STATUS`, `ROADMAP`, `BACKLOG`, [backlog Builder](../feature-backlog.md), `DECISIONS`, indice e [protocollo delle pull request](PR-WORKFLOW.md), con preservazione delle milestone M0–M5.
- Aggiunti [GitHub Action](../../.github/workflows/context-governance.yml), [guardia JS](../../tools/context-guard.cjs), [test guardia](../../qa/context-guard-regression.cjs) e [template PR](../../.github/pull_request_template.md): ogni PR operativa verso qualunque branch deve **modificare STATUS + BACKLOG + CHANGELOG**. `ROADMAP`/`DECISIONS` condizionali. Si verificano i file nel diff, non la verità delle asserzioni.
- **Attenzione:** `main` non aveva status checks obbligatori; l'Action segnala un fallimento, ma per bloccare il merge servirà protezione di `main`. Nessun gameplay modificato da questo lavoro; QA della guardia e check Actions da verificare separatamente.

## 2026-10-21 — Integrazione performance prima del merge richiesto

- Sincronizzato il branch performance con `origin/main` `c94bdc1`, preservando terraforming, mulini e le ottimizzazioni dei quattro audit; risolti i conflitti in firma terreno e macerie/renderer Canvas.
- 60/62 suite PASS, con i due fallimenti sorgente preesistenti. Ripetuta fino all'eliminazione la battaglia su entrambi i renderer: stesso esito e verifiche di animazione/fallback PASS. I picchi GPU residui restano espliciti.

## 2026-10-21 — Riduzione dei ridisegni e dei controlli GPU

- Esteso l'audit 40/30 con baseline strumentata, due campagne finali, tempi dei singoli metodi GPU e verifica browser di animazioni in pausa/fallback.
- Combattimento in pausa nel ciclo visuale comune; errori GL distanziati e checkpoint emesso dopo gli ultimi passaggi, senza permettere rinvii infiniti.
- Rendering cumulativo WebGL ridotto del 72–82% nelle due prove; i blocchi isolati fino a circa 400 ms rimangono dichiarati. Framebuffer e rinvio dei frame scartati dopo misure, senza cambiare qualità grafica o danni. D-038, stato locale non pubblicato.
- Batteria conclusiva 57/59 suite PASS; restano i due fallimenti preesistenti su main. Sintassi, whitespace e corrispondenza degli hash runtime alle misure PASS.

## 2026-10-21 — Battaglia 40 contro 30 fino all'eliminazione

- Aggiunti [audit](../mass-battle-performance-audit-2026-10-21.md), harness browser a 70 entità e sette controlli di regressione.
- Corretti roster dei tipi individuali, tiro degli arcieri mobili su entrambi i lati, velocità della cavalleria ostile e controlli costosi applicati fuori portata.
- Verificata eliminazione reale di tutti gli attaccanti a 298,1 secondi simulati su Canvas/WebGL; 37 difensori superstiti. Logica P95 circa 1 ms, picchi grafici WebGL ancora aperti e profilati in `getError`.
- Base pubblicata `9e1b6a5`; nuove modifiche nel working tree, nessun nuovo commit/push/deploy. Roadmap invariata.

## 2026-10-20 — Terzo audit: Canvas, percorsi e assalto

- Aggiunti [audit round 3](../movement-collapse-performance-audit-2026-10-20.md), benchmark browser e regressioni dei percorsi cooperativi.
- Cache delle macerie Canvas ferme e brigata con budget condiviso, priorità rotante e collisioni rispettate anche quando una rotta fallisce. Corretto il blocco al pozzo dovuto a tangenti non rilevate dal campionamento.
- Verificati cavaliere/cinque squadre in salita e discesa e 20 assalitori con combattimento, su Canvas/WebGL e con rendering continuo. Documentati i residui: primo disegno Canvas ancora fino a 3 s, caduta attiva e intervalli RAF variabili. D-036 e stato aggiornati; nessun rilascio.
- Batteria completa 55/57 suite PASS, con i due fallimenti sorgente preesistenti; sintassi e whitespace PASS.

## 2026-10-20 — Secondo audit: incendio, distruzione e stanze

- Aggiunti [audit round 2](../fire-collapse-cutaway-performance-audit-2026-10-20.md) e benchmark con incendio esteso, crolli, cutaway, brigata e incendio naturale fino alla distruzione delle case.
- Eliminati i disegni sincroni e le invalidazioni per i soli HP; richieste visuali raccolte dal ciclo comune; macerie ferme su buffer GPU e superfici/arredi del cutaway nella cache esistente.
- 54/56 suite locali PASS, due fallimenti preesistenti; dichiarati i residui su Canvas, pathfinding della brigata e composizione. Working tree locale senza rilascio. D-035 e stato aggiornati; roadmap invariata.

## 2026-10-20 — Audit locale completamenti e freeze

- Riprodotti e profilati i picchi al completamento di torri/portali su main `996b4a4`; aggiunto [audit ripetibile](../construction-performance-audit-2026-10-20.md).
- Sul branch locale `fix/construction-completion-perf`: strade differite con generatori esistenti, cache del catasto preservata quando possibile e lettura errori WebGL2 dopo fence pronta.
- Aggiornati contratto D-034 e stato con distinzione fra codice locale, prove e problemi già presenti su main. Priorità e milestone della roadmap invariate; nessun rilascio.

## 2026-10-20 — Chiarimento definitivo: gradone verticale color muro

- Recepita la correzione esplicita: collina naturale invariata; terrazzamento verticale color muro con piano superiore piatto.
- Eliminata completamente l'inclinazione; migrazione dei terrazzamenti inclinati già salvati. Mesh WebGL2 ritagliata al perimetro e chiusa con facce verticali.
- Dieci controlli dedicati, inclusa verifica della mesh contro rampe spurie, buchi e sovrapposizione del suolo.

## 2026-10-20 — Scarpata murata spiovente (interpretazione superata)

- Sostituito il bordo quasi verticale del terrazzamento murato con una scarpata inclinata, larga almeno 1,25 U e proporzionale al dislivello.
- Allineata la scarpata alla palette laterale delle mura; il piano superiore resta terreno calpestabile.
- Aggiunta migrazione dei terrazzamenti già persistiti e portata la regressione dedicata a 9 controlli.

## 2026-10-19 — Terraforming con ghost e terrazzamento murato

- Implementato sul branch `terraforming` (commit `fa9ef0d`) il terreno modificabile con scavo/innalzamento e il terrazzamento murato, entrambi anticipati da ghost non distruttivo.
- Reso vincolante il divieto di sovrapporre un terrazzamento murato a un altro; aggiunto magnete bidirezionale fra bordo del terrazzamento e faccia del muro, compensando metà dello spessore.
- Integrata la quota modificata nel contratto comune del terreno, nel rendering Canvas e nella mesh WebGL2, con persistenza dentro `State.relief` e invalidazione solo al commit.
- Verifica locale: intera batteria `qa/*.cjs` PASS, 7 controlli Terraforming, sintassi JS e whitespace PASS; prova Chromium via HTTP di ghost, rifiuto sovrapposizione, reload e muro a filo PASS.
- Stato distribuzione: branch soltanto; `main`, PR e deploy non modificati

2026-10-19 — clay: palette DEV Stone/Clay

- Aggiunto selettore globale DEV con visualizzazione alternativa mattone/tegola e piani terra delle case L2–L4, colori condivisi tra Canvas e WebGL2, preference locale e invalidazione della scena; nessun cambiamento economico o all'integrità.
- Aggiunta regressione e workflow GitHub Actions dedicata alla branch `clay`, preservando la suite `Civil`; [CI 39271126852](https://github.com/erykwest/CONQUER/actions/runs/39271126852) **PASS** sulla HEAD `bbe5a27`. Corretto il mock degli annessi civili nella QA industriale, senza alterare il runtime.

## 2026-10-19 — clay: nuove istruzioni di sviluppo (solo Markdown)

- Creato ramo `clay` dalla HEAD di `Civil`, senza introdurre modifiche al codice o merge verso `main`.
- Preparati [`docs/CLAY-DEVELOPMENT.md`](../CLAY-DEVELOPMENT.md) e [`docs/CLAY-REGRESSION-PLAN.md`](../CLAY-REGRESSION-PLAN.md) con specifiche di Cava argilla entro 6 U, materiali e costi alternativi, palette, integrità all'80%, migrazioni e QA.
- Aggiornati indice, decisioni, backlog, stato ed economia come **design non implementato**. Nessuna nuova suite runtime eseguita.

## 2026-10-19 — Civil: guida tecnica per sviluppo annessi

- Aggiunto [`docs/CIVIL-ANNEX-DEVELOPMENT.md`](../CIVIL-ANNEX-DEVELOPMENT.md) sulla branch `Civil`: stato reale del catalogo, differenza cimitero intrinseco / birreria costruibile, punti di estensione nei moduli, vincoli Voronoi e placement, renderer, persistenza, test, criteri di completamento e decisioni da prendere prima di sviluppare meccaniche economiche.
- Inserito un collegamento dalla piramide del contesto. **Solo documentazione; nessuna nuova funzione di gioco introdotta da questo commit.**

## 2026-10-17 — Civil: cimitero L1 e birreria L2

- **Chiesa L1:** cimitero automaticamente incluso nella proprietà; area di sepoltura ricavata dal lotto Voronoi, riserva anti-sovrapposizioni e segnali tombali 2D/3D. È parte del lotto, non un annesso collocabile manualmente; in lotti troppo stretti rimane senza area fisica fino a spazio disponibile.
- **Taverna L2:** nuova estensione `brewery` nel menu annessi, posizionabile vicino all'edificio madre e all'interno del lotto. Solo skeleton visivo e dati, senza produzione di birra.
- Catalogo: 14 voci totali (13 costruibili + cimitero intrinseco). Corretto anche il filtro di migrazione dei figli orfani nel caricamento dei salvataggi.
- Verifica: [GitHub Actions 39033162718](https://github.com/erykwest/CONQUER/actions/runs/39033162718) PASS, compresi test di lotto Voronoi reale, limiti L2 e collisioni. Nessun merge in `main`, nessun collaudo browser.

## 2026-10-17 — Civil: skeleton degli edifici annessi

- Catalogo di 12 annessi con relazione strutturale `parentId`, collocabili dal pannello chiesa, taverna e mercato. L1–L3 sbloccano categorie, non creano automaticamente i figli.
- I figli di chiesa/taverna usano il lotto Voronoi del padre; le estensioni del mercato occupano spazio pubblico entro 9U e rispettano proprietà private e collisioni. Eliminazione padre→figli, blocco rotazione padre con figli, migrazione file salvati.
- Placeholder geometrici Canvas/WebGL2, hit test, navigazione e ombre; nessuna nuova simulazione economica o gestione ospiti. Regressione dedicata `qa/civic-annex-regression.cjs` nella CI `Civil` ([ultima CI verde, run 39023749740](https://github.com/erykwest/CONQUER/actions/runs/39023749740), inclusa la protezione dei lotti privati).
- Solo branch `Civil`; QA browser/visiva non effettuata.

## 2026-10-17 — Civil: lotti di pertinenza e skeleton Piazza

- **Branch `Civil` da `main`**: riusati Voronoi, bordi e accessi esistenti per assegnare lotti di pertinenza a chiesa e locanda; il mercato ne rimane escluso.
- **Skeleton sviluppo L1–L3**: `civicLevel` per chiesa, locanda e mercato; aggiunta Piazza `plaza` 5×5 U con varianti `paved`, `fountain`, `garden` e tre livelli, con Builder, persistenza e mesh Canvas/WebGL2. Strade e pedoni possono attraversare la piazza.
- **Prove:** syntax check dei moduli modificati, verifica geometrica isolata su due lotti civici con impronte contenute; nuove regressioni Urban e Builder incluse nella CI `Civil skeleton regression` ([primo run verde](https://github.com/erykwest/CONQUER/actions/runs/39021863368)). I successivi push vengono verificati dallo stesso workflow; collaudo browser manuale ancora aperto.
- **Confine intenzionale**: nessun bonus economico/sociale, nessuna espansione funzionale delle routine; `main` non modificato.

## 2026-10-16 — Diagnosi condivisa /main e /camp: crescita bloccata dalla pianificazione arteriale

- Individuato su `main` il medesimo blocco di crescita già corretto su `camp`: la ricerca in background delle quattro strade perimetrali impediva lo spawn delle case, anche sulle arterie completate.
- Preparata [PR #52](https://github.com/erykwest/CONQUER/pull/52) su branch `fix/main-growth-during-road-planning-20261016` dal `main` `39caf15`: spawn sulle strade già pronte e impulsi di crescita non consumati in assenza di percorsi utilizzabili.
- Comandi militari `main`: messaggi espliciti per distanza cavaliere 16U, percorsi non traversabili e simulazione in pausa; non è stato rimosso il vincolo tattico.
- [CI 38948914788](https://github.com/erykwest/CONQUER/actions/runs/38948914788) **PASS**; verifica browser/partita persistita ancora aperta. `main` e produzione non modificati.

## 2026-10-16 — Correzione dei contratti di danno negli assedi

- Recepita una **correzione esplicita**: gli **attacchi ordinari delle unità** e le **frecce** non danneggiano mura o torri (**D-031**, S-05/S-16); eventuali danni strutturali richiedono una sorgente compatibile, non un attacco generico.
- Definita la **doppia durabilità** per gli accessi con torre-porta: un valore per la struttura della torre, un valore per il **portone** (**D-032**, S-25). Gli impatti contro un componente non riducono automaticamente l'altro; distruggere il portone non equivale a distruggere la torre.
- Precisati i requisiti degli **arieti** (S-22, bersaglio portone) e delle **fiaccole** (S-24, incendio sul componente), e aggiunti criteri di accettazione e QA a livello di specifica. Le regole di vulnerabilità delle singole tipologie di attacco al portone rimangono da dettagliare.
- **Solo documentazione:** nessuna modifica alla simulazione o al rendering, nessuna QA runtime eseguita; roadmap e stato di avanzamento delle milestone invariati.

## 2026-10-16 — Riconciliazione piramide con main e bilancio settimanale

- **Base verificata:** `main` al commit [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99) (16/10, 15:16 UTC); aggiornati ingresso, stato, roadmap, decisioni e backlog. Questa operazione è **solo documentale**: nessuna nuova QA runtime/browser eseguita.
- **Merger reali 13–16/10:** economico/industrie [PR #22](https://github.com/erykwest/CONQUER/pull/22); base fortificazioni/logistica e Mastio [PR #21](https://github.com/erykwest/CONQUER/pull/21); refactor castle/render/population/app [PR #38](https://github.com/erykwest/CONQUER/pull/38); foreste e attraversamenti [PR #39](https://github.com/erykwest/CONQUER/pull/39)/[PR #42](https://github.com/erykwest/CONQUER/pull/42); ambient light [PR #43](https://github.com/erykwest/CONQUER/pull/43); Nightlight [PR #47](https://github.com/erykwest/CONQUER/pull/47); minimappa e LOD **mergiati** [PR #44](https://github.com/erykwest/CONQUER/pull/44) al commit [2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9).
- **Renderer:** WebGL2 scena/castello [db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697), poi impostato come default con fallback Canvas [cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0). Non esiste prova qui di import glTF completo o parità visiva in tutte le funzioni.
- **Urban e rilievi:** lotti/tetti/facciate [d3ca98e](https://github.com/erykwest/CONQUER/commit/d3ca98e6dc1d75d651aade3af6bfffa1585e4e48), biomi [ee671e6](https://github.com/erykwest/CONQUER/commit/ee671e6f8af97a5dd3f55be72122a186ecb26ef9), continuità pedemontana e soglie neve/pini [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99). Materiali `urban` ancora da riconciliare separatamente.
- **Branch e backlog:** `main...urban` diverged **+97/-24**; `main...sync/urban-main-2026-10-16` **+78/-24**; [PR #19](https://github.com/erykwest/CONQUER/pull/19) ancora aperta. Priorità invariata: calendario campi ↔ ledger, unico inventario economico/costruttivo, output miniera e vertical slice di assedio prima di nuove grandi feature.
- **Correzione della documentazione storica:** i paragrafi sottostanti che dicevano «PR #44 aperta» descrivono uno snapshot precedente nella giornata del 16/10, **non** lo stato corrente.

## 2026-10-16 — Acquisizione suoni Pixabay / Drive

- Importata come quarto digest la conversazione del 14/10 [Valuta suoni Pixabay](sources/PIXABAY-SOUNDS-2026-10-14.md); registrata SRC-CHAT-006 in [EXTERNAL-SOURCES](EXTERNAL-SOURCES.md).
- Conservata decisione esplicita **ambienti stagionali/meteo + effetti selezione/zoom ≥30%**; chiarita la proposta di tre canali sonori, fades e numero massimo di fonti contemporanee.
- Inventario **storico riferito dal thread**, non audit corrente: **24 MP3 su Drive**, 10 ambienti e 14 effetti, con possibili nomi duplicati di pioggia. Qualità, loop, licenze individuali e runtime non verificati; **nessun audio importato in Git**.
- Roadmap, codice e deployment invariati.

## 2026-10-16 — Importazione trascrizioni e prove Git

- Letti gli export **ECONOMY (12–13/10)**, **Direzione animazioni/audio (14–15/10)** e **Minimappa LOD (15/10)**; creati tre digest in [sources](sources/) anziché pubblicare le chat integrali.
- Aggiornato [registro fonti](EXTERNAL-SOURCES.md): SRC-CHAT-001/002/005 **LETTO**, SRC-CHAT-003/004 **IN ATTESA DI TESTO**. Un allegato non pertinente è stato escluso.
- Verificato stato repository: economia presente su `main` con merge storico [2b8e8239](https://github.com/erykwest/CONQUER/commit/2b8e8239d2009fd813b92ff8f7e18e05bfb625b7); minimappa e LOD in **PR #44 ancora aperta**. Nessun runtime test eseguito per questo import.
- Consolidati i contratti: economia L4 aggregata; quote vendita e obiettivi scorte; orari annuali/mensili/settimanali; differenza fra **design miniera→metallo** e **codice main miniera→pietra** ancora aperta.
- Registrati stato cache Bitmap/WebGPU, asset PNG locali non verificati, opzione prototipo 3D vs sprite, animazioni procedurali e creazione musica Suno Pro (uso/licenze da controllare).
- Roadmap **invariata nel percorso principale M0–M3**; introdotta soltanto una traccia trasversale a basso rischio per leggibilità/benchmark, senza promettere conversioni 3D o audio già disponibili.

## 2026-10-16 — Inizializzazione piramide

- Creato punto d'ingresso a più livelli per vision, roadmap, stato, decisioni, backlog e protocollo.
- Recuperato il backlog P0–P3 Builder/Manager già su main, **senza ricopiarne tutte le checklist**.
- Integrati temi inter-sistemi discussi: economia feudale, carovane, combattimento, routine popolazione, difesa, assedi, ambientazione e pubblicazione.
- Registrati i conflitti da risolvere prima del prossimo ciclo: **miniera stone/metal, calendario agricolo, ledger vs risorse costruttive, branch main/urban divergenti**.
- Baseline documentale: `main` **9b7d05db597b592b78c9b4647181cb39f2cb2a9d**. Ricognizione statica: **non certifica l'esecuzione dei test**.

## Modello per le prossime righe

```m

YYYY-MM-DD — [evento]
- Roadmap: Mx → My (motivo).
- Stato: ID, branch, commit e QA [PASS/FAIL/NON ESEGUITA].
- Decisioni: D-xxx / O-xxx risolto (link).
- Scope: aggiunte, rimozioni o rinvii con motivazione.
```

Non archiviare nuove idee indistintamente come «implementazioni»: mantenere separati backlog, decisioni e prove.

## 2026-10-16 — CAMP (branch `camp`, non integrato)

- **CODICE / BRANCH**: percorso isolato `/camp` con pulsante per ciascuna stanza caserma; gestione armigeri in squadre da cinque entro capacità stanza, salvataggio locale indipendente.
- **CODICE / BRANCH**: al tramonto squadre entro zona gialla richiamate lungo percorsi validi alla propria caserma, squadre fuori zona accampate sul posto (tenda e braciere per unità, un solo soldato di guardia visibile). All'alba ripristino delle squadre. Nessun cambio a `/urban`.
- **CODICE / BRANCH**: cutaway caserma sincronizzato con le truppe effettivamente rientrate, nessun soldato fittizio in stanza vuota.
- **VERIFICA DA ESEGUIRE**: test browser su percorso, UI mobile, ritorni ostacolati, campi in elevazione, salvataggi e rendering WebGL2/Canvas; le sorgenti da sole non dimostrano QA superata.
