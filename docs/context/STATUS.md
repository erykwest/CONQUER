# Livello 2 — Stato tecnico e prove

## Audio — mixer a 4 livelli e colonna sonora stagionale (branch `sound`, 17–19/10/2026; riallineato 28/10)

- **Codice presente su branch (non ancora `main`):** `src/settlement-sound.js` (`ConquerSound`, mixer Web Audio con bus Ambiente / Locale / Effetti / Notifiche, EQ e normalizzazione LUFS), `settlement-sound-catalog.js`, `settlement-sound-bridge.js` (ambiente da stagione, notte e meteo; suoni locali dall'edificio selezionato e dai due più vicini sopra una soglia di zoom; tuoni nei temporali), `settlement-music.js` + catalogo (9 brani stagionali, playlist automatica per stagione). Controlli solo nel pannello DEV (`settlement-sound-dev.js`, `settlement-music-dev.js`). Unico aggancio nel gioco: `ConquerSoundBridge.tick` in `simulationFrame`. **Audio spento di default**, si attiva a mano.
- **Asset:** 14 clip ambiente/effetti (freesound/Pixabay, fonti in [sound-assets](../sound-assets.md)) e 9 brani normalizzati in `src/assets/sounds/` (~40 MB MP3). Script di preparazione in `scripts/`, workflow `sound-regression`, `seasonal-music`, `sound-optimize`.
- **QA locale (28/10, dopo il merge di `main` `5ddefa6`):** 75/79 `qa/*.cjs` PASS (incluse `sound-regression` e `music-regression`); i 4 FAIL sono le prove di performance che richiedono Playwright, uguali su `main`. Browser (Chrome): pagina caricata senza errori in console, World 3D attivo, 9 brani nel selettore, stato «Audio OFF». **Non eseguite:** ascolto reale dei mix in partita; CI della PR.
- **Merge di `main`:** unico conflitto in `index.html` (script dev audio accanto a quelli di combattimento aggiornati da main), risolto mantenendo entrambi.

## Cutaway civico e contorno di selezione (su `main` con #90 `54a7508`; fix `fix/civic-cutaway-lab` 28/10/2026)

- **Fix su branch `fix/civic-cutaway-lab` (28/10, non ancora `main`):** nelle locande L1–L3 il cutaway lasciava la faccia inferiore del primo piano (soffitti, sbalzi) come una lastra opaca sopra la metà posteriore del pianterreno; ora sopra il davanzale vengono tolte anche le facce orizzontali rivolte in basso (`sectionParts` in `src/settlement-civic3d.js`). Nuovo controllo in `qa/civic3d-regression.cjs`: nessuna faccia orizzontale sopra il pavimento della locanda, 3 livelli × 4 quarti di giro; fallisce senza il fix.
- **Verifica visiva 28/10 (Lab, `index.html?assetlab=1`, render 2.5D del gioco):** foglio provini chiesa/locanda L1–L3, intera + 4 rotazioni, prima e dopo il fix; dopo il fix nessun difetto. WebGL in partita (locanda L3 selezionata) pulito. Audit del Lab su `main` `1194f5e`: 465 render, 0 errori, 49 avvisi tutti su fortificazioni (cantiere non progressivo, danno del portone poco visibile), nessuno sui civici.
- **Su `main` (#90):** chiesa o locanda selezionata mostrata in sezione: piano di taglio rivolto alla camera che taglia il guscio Blender a davanzale, toglie tetti e gronde; arredi (panche, altare, fonte, pulpito per la chiesa; tavoli, bancone, botti, focolari per la locanda). In WebGL l'edificio selezionato ha un buffer `civicCutaway` ricostruito a ogni quarto di giro; Esc invalida entrambi i renderer (`src/settlement-civic3d.js`, `settlement-world3d.js`, `settlement-castle.js`, `settlement-render.js`).
- **Builder:** il contorno di selezione disegna solo l'impronta unita a h0; mura, palizzate e sezioni costruite non si piazzano dentro le foreste; ogni edificio controlla anche le chiome degli alberi realmente disegnati (`settlement-placement.js`).
- **QA locale (28/10, dopo il merge di `main` `5ddefa6`):** 73/77 `qa/*.cjs` PASS (incluse `civic3d`, `builder-placement`, `organic-forest`); i 4 FAIL sono le prove di performance che richiedono Playwright, assente in questo checkout. Audit del Lab (`qa/asset-audit.mjs`, Chrome locale): 465 render, 0 falliti, firme identiche a quelle di `main` sullo stesso browser (il cutaway civico appare solo in partita con l'edificio selezionato); baseline invariata. **Non eseguite:** verifica visiva del cutaway in partita su entrambi i renderer; CI della PR.

## UI v2 «Isole» — modalità Difendi (branch `feature/ui-defend`, 26/10/2026)

- **Su `main` (`5ddefa6`, squash di `feature/ui-shell`):** UI v2 opt-in con `?ui=2`: `src/ui/game-api.js` (`window.ConquerGame`, comandi + letture di stato), `src/ui/shell.js` (Preact+htm vendorizzato, nessun build), `src/ui/i18n-it.js` (tutte le stringhe in italiano), `src/ui/theme.css`; modalità Costruisci e Gestisci con rail e scheda ispettore; `src/settlement-structure-commands.js` per le regole sulla struttura selezionata. La UI legacy resta il default.
- **Codice presente su branch (non ancora `main`):** modalità Difendi — rail Comando/Zone/Pattuglie/Allarme (Prove d'assedio solo con `?dev=1`) e scheda; `ConquerCombat.uiState()` in sola lettura; i comandi premono i pulsanti del modulo di combattimento, nessuna mutazione diretta di `State` dalla UI. `settlement-combat.js?v=` conserva il suffisso fissato da `zones-visual-regression`.
- **QA locale (28/10):** 73/77 regressioni `qa/*.cjs` PASS; i 4 FAIL sono le prove di performance che richiedono Playwright (non installato in locale), identiche su `main`. **Non eseguite:** `qa/ui-combat-regression.mjs` (browser) e verifica visiva della modalità Difendi in partita. CI da verificare sulla PR.
- **Ancora aperto (fase 5):** messaggi di stato/log in i18n, pannello attraversamenti come dati, UI v2 come default e rimozione di `settlement-builder-ux.js`.

## Fix main: strade, DEV e WebGL (23/10/2026, branch di fix)

- **IMPLEMENTATI NEL BRANCH** `fix/main-founding-dev-webgl-20261023`, riallineato alla main `bc82dbe` includendo integralmente l'audit Lab #82. [Cause, correzioni e prove](../main-fixes-diagnosis-2026-10-23.md). Non ancora integrati in main.
- **WebGL:** VAO separato per programma shader; la ricreazione di mesh non lascia attributi abilitati di un altro programma senza buffer. Chromium/SwiftShader PASS dopo cinque colpi d'ariete, rebuild, rotazioni e giorno/notte: 3D ancora attivo, nessuna eccezione. Una vera perdita del contesto attiva ancora il fallback Canvas. Polling errori differito e fence invariati.
- **Fondazione strade:** preparazione cooperativa dei segmenti e delle intersezioni con l'acqua; pubblicazione atomica solo a revisione ancora valida. Annullare lascia disponibili strada/ponti precedenti e non taglia il bosco. Regressione con fiume di 201 punti: massimo 24 controlli geometrici per avanzamento, contro 155.287 prima del fix. Foresta seed 4242: callback massime 7,38 / 6,47 / 7,02 ms, 82 tratti, 2 ponti, 4 accessi, stessa firma geometrica della baseline. Il budget di 6 ms resta cooperativo, non una garanzia temporale dell'host.
- **DEV:** test aggiornato ai default automatici (`null`); i pulsanti reali forzano giorno/estate/sole e al secondo clic tornano automatici. Suite UI/Combat completa PASS, senza cambiare i default del gioco.
- **QA locale:** 68 suite `*-regression.cjs`, sintassi di 152 file JS/CJS/MJS, nuova regressione WebGL e UI/Combat PASS. Audit Lab: 456 render, 0 errori, 49 avvisi già presenti, 11 firme cambiate sulle varianti lignee (stesso insieme segnalato dalla CI di #82). Rivisti i fogli porte/torri/mura; baseline mantenuta perché non cambia alcun asset e le differenze di rasterizzazione sono preesistenti.
- **CI:** workflow `Main fixes regression` su push della branch e PR: intera batteria, sintassi, Context sync, browser e audit Lab; l'esito effettivo è quello del run GitHub associato al commit. ROADMAP invariata; contratti tecnici registrati in D-FIX-01. Nessun merge o deploy.
- **Riallineamento 28/10/2026:** merge di `main` `5ddefa6`; conflitti solo nelle prime sezioni di STATUS/BACKLOG/CHANGELOG, risolti mantenendo entrambe le voci. Il codice di main (World 3D, strade) si fonde senza conflitti con i VAO e la fondazione cooperativa. QA locale dopo il merge: 74/78 `qa/*.cjs` PASS (FAIL solo le 4 prove di performance senza Playwright locale). `ui-combat-regression.mjs`, che ora supera il default DEV, si fermava sull'aspettativa «una torretta per ogni L4 a schiera», superata dalla regola «torrette solo d'angolo» del 21/10: aggiornata a «al più le teste del fronte»; suite completa PASS in locale (Chrome).

## Guardaroba stagionale dei popolani (branch `feature/seasonal-clothing`, 23/10/2026)

- **Codice presente su branch (non ancora `main`):** `src/settlement-wardrobe.js` (`window.ConquerWardrobe`) con 9 capi overlay (cappello di paglia, berretto di pelliccia, cappuccio di lana, cappuccio cerato, pelle di pecora, mantello di lana, mantello foderato di pelliccia, mantella antipioggia, scialle). Disegnati da `drawVillagerFigureUnmasked`, quindi valgono anche per lavoratori, costruttori e civili in fuga dagli incendi; l'outfit dipende da id residente, mese del calendario (o stagione DEV forzata) e `currentWeather()`. Nessuno stato persistito, nessun effetto economico.
- **Palette per classe:** `PEASANT/ARTISAN/MERCHANT/ELITE_PALETTE` in `settlement-core.js` ridefinite come L1 grigio/beige, L2 verde/marrone, L3 primari desaturati, L4 primari accesi; tingono tuniche e capi in tessuto del guardaroba. Lavoratori anonimi (`settlement-work-anim.js`) e brigata antincendio (`settlement-fire.js`) passati a L1. La copia delle palette in `figures-lab.html` è verificata uguale a core dalla regressione.
- **Asset Lab:** 9 voci «Popolazione / Abbigliamento stagionale», anteprima sulle quattro classi L1–L4; selettore stagione/meteo nel lab animato.
- **QA:** nuova `qa/wardrobe-regression.cjs` (+ workflow) **PASS in locale**; `work-anim`, `asset-catalog`, `refactor-app-population`, `snow-tracks` **PASS in locale**. Verifica visiva nel lab (5 condizioni × classi × bambini) e probe delle condizioni live in `index.html` senza errori console. Dopo il merge di `main` (audit visivo #82): `qa/asset-audit.mjs` locale 465 render, **0 falliti**; 9 nuovi (guardaroba) e 8 cambiati (popolano e 7 lavori, nuova palette L1), rivisti nel foglio provini e registrati in `qa/asset-audit-baseline.json`. **Non verificato:** resa in partita con un villaggio popolato e costo per frame con molti abitanti; CI della branch.

## Converge — riallineamento PR #61 alla main corrente (23/10/2026)

- **BRANCH, NON MERGE:** `converge` riallineata a `main` `bc82dbee5c8da30bebea9e93049c6f85701c7e51`. Divergenza iniziale: 9 commit propri e 37 mancanti. Conflitti risolti in `settlement-siege.js` e `DECISIONS.md`, preservando tutti gli aggiornamenti di main.
- **D-031/D-032/D-042:** immunità dei nuclei anche lignei agli attacchi ordinari; grata abbassata ancora colpibile con la matrice corrente, fuoco attraverso le sbarre, porta/grata/torre indipendenti. Conservati `gateSection`, `gateBreached`, terrapieni, campate/brecce, crolli, levatoi, night watch e ridisegno coalescente. Nessun merge integrale della vecchia branch `assedio`.
- **QA LOCALE:** 67/68 regressioni deterministiche PASS; unico FAIL `founding-regression.cjs` per slice strade >100 ms. Riprodotto anche sul checkout separato della stessa main (66/67 PASS), quindi non introdotto dalla PR. Sintassi di 148 moduli/test PASS prima dell'aggiunta della nuova QA browser. Checkout con fine riga del repository, senza modifiche ai contratti test.
- **QA INTEGRAZIONE:** estese `gate-fittings-regression` (matrice, input invalidi, tre HP e persistenza) e `siege-damage-converge-regression` (scheduler condiviso). Nuova QA Chromium **PASS gameplay Canvas + avvio WebGL** del pannello «Test ram», torri lignee, fuoco e save/load; workflow `Converge siege integration`. Nella scena isolata il renderer WebGL può passare al fallback per `drawArrays: no buffer is bound to enabled attribute`: riprodotto anche sulla main `518e830`. Il report conserva lo stato finale del renderer; non certifica WebGL ininterrotto. CI sul commit pubblicato da verificare nella PR.
- **QA BROWSER LEGACY:** `ui-combat-regression.mjs` fallisce sull'aspettativa del default DEV `daylightOverride === 'day'` (valore attuale `null`), anche sulla stessa main. Il test si arresta lì: le verifiche successive di quella suite non sono certificate da questa esecuzione; la QA assedio dedicata passa su entrambi i renderer.
- **LIMITI:** questa integrazione non completa logistica/blocco/fame/resa né IA di scelta degli accessi (GATE-07). Merge definitivo autorizzato il 23/10, ancora da eseguire dopo la nuova CI; lo stato effettivo resta verificabile nella PR #61.
- **AGGIORNAMENTO PRIMA DEL MERGE AUTORIZZATO:** integrati anche i quattro commit successivi della main fino a `bc82dbe` (#82 Asset Lab e manutenzione/documentazione). Conflitti soltanto in STATUS/BACKLOG/CHANGELOG, risolti mantenendo entrambe le cronologie; tutti i file runtime di questa main, salvo le regole assedio della PR, restano identici. CI precedente su `92be424` verde (68/68 + browser gameplay); nuova CI da verificare sulla HEAD aggiornata.

## Mesh e Lab — facce bicolori corrette, export PNG 512 (branch `fix/lab-export-normals`, 26/10/2026)

- Lo shading delle mesh Blender non dipende più dall'ordine dei vertici: le facce superiori si riconoscono da `|nz|`. Il Lab ha il pulsante «Esporta PNG 512», disegna i modelli con depth buffer (come la WebGL) e ha l'occupazione forzata per verificare l'occlusione dei popolani. Audit eseguito localmente: 0 errori, 128 render cambiati e rivisti; baseline aggiornata. CI da verificare dopo il push.

## Asset Lab — motore di audit visivo, stati delle fortificazioni, accesso `/lab` (branch `feat/asset-lab-audit` da `main` `518e830`, 23/10/2026)

- **Codice presente su branch (non ancora `main`):** `src/settlement-asset-stage.js` (solo con `?assetlab=1`) monta una variante della galleria da sola e cattura il render 2.5D del gioco con il terreno rimosso, negli stati intatta, cantiere 25/50/75%, ogni fase di danno di `galleryPhases`, cutaway. Catture ripetibili: seed fisso, giorno, sole, `performance.now` e `crypto.randomUUID` fermati durante la cattura, macerie assestate con `ConquerSiege.restore`.
- **Lab:** 29 fortificazioni (22 anche in 3D, 7 in legno solo 2.5D); barra degli stati nell'ispettore; rotazione 15° per le mesh e 90° (viste della camera) per le catture. `/lab` apre direttamente il Lab; la sandbox non avvia più il ciclo di simulazione (nessuna partita).
- **Audit (`src/asset-audit.js`, `ConquerAssetAudit`):** 456 render di 227 asset con controlli automatici, firma 12×12, confronto con `qa/asset-audit-baseline.json` (nuovi/cambiati/spariti) e deroghe; pulsante «Audit» con elenco cliccabile; runner `qa/asset-audit.mjs` con report e fogli provini. Procedura: [ASSET-LAB-AUDIT](../ASSET-LAB-AUDIT.md).
- **Esito in locale (Chromium headless, LF):** 456 render, **0 errori**, 49 avvisi, 0 nuovi e 0 cambiati in due giri consecutivi dopo la baseline (~70 s). `qa/asset-catalog-regression.cjs` e `qa/asset-catalog-browser.mjs` **PASS**. Un asset aggiunto per prova risulta «nuovo». CI della PR #82 **PASS** 7/7 su `5be381d`; l'audit in CI (Linux) dà 0 errori, 49 avvisi e 11 «cambiati» per la rasterizzazione diversa dalla baseline generata su Windows (non bloccanti).
- **Riscontri sul gioco (avvisi, non corretti qui):** cantieri identici a 25/50/75% (si muove solo la barra; avanzano solo le torri rotonde); con SwiftShader forzato il legno danneggiato o in costruzione non viene disegnato. **Regressione di #76 (Portoni) colta dall'audit dopo il rebase su `main` `518e830`:** «portone incrinato» e «portone sfondato» non si vedono più su nessuna porta (10 pixel diversi dall'intatta sulle porte in pietra, 0 sulla porta di legno); prima di #76 il portone sfondato era visibile sulle porte in pietra.
- **Baseline:** rigenerata dopo la revisione dei fogli su `main` con #76 (drappi, torce, ante nuove); soglia «cambiato» 0,01 perché le catture sono deterministiche.

## Follow-up pulizia branch — 23/10/2026

- [GitHub Actions cleanup #39982707805](https://github.com/erykwest/CONQUER/actions/runs/39982707805) **SUCCESS**: otto branch eliminati e assenza verificata tramite elenco remoto. La PR [#84](https://github.com/erykwest/CONQUER/pull/84) è merge `7f7cfbe5`.
- La presente iterazione completa l'igiene eliminando anche il proprio branch di servizio #84 dopo il merge, e il branch di questa iterazione stessa **solo previa verifica live** di PR merged + HEAD esatto. Workflow una-tantum, nessuna alterazione di codice del gioco.

## Branch cleanup automatizzata — 23/10/2026

- Ricognizione live di 34 branch (`main` inclusa), HEAD `b79ea99`. **Otto candidati verificati** per rimozione: sei branch di PR merge con HEAD esattamente coincidente con la PR (#75, #76, #79, #80, #81, #83), e due branch senza commit esclusivi (`feature/bridge-earthworks-converge`, `fix/main-founding-dev-webgl-20261023`).
- Introdotto workflow di **esecuzione una tantum** `.github/workflows/prune-obsolete-branches-20261023.yml`, eseguito soltanto da push su `main` che introduce quel file. Prima di ogni DELETE deve ricontrollare ref SHA, protezione delle PR aperte, merge PR o discendenza da main; abortisce la rimozione del singolo ref se le condizioni cambiano. **Il risultato è verificabile dal relativo GitHub Actions run successivo al merge**; il commit documentale da solo non dimostra cancellazioni.
- **Preservati:** tutti i branch HEAD di PR aperte (`converge`, `events`, `cans` se in lavoro, `feature/construction-props`, `feature/economic-balances-20261019`, `feature/cutaway-furniture-converge`, `feature/knights-messenger-caravans`, `knights`, `visual-qa`, `audit-hardening`, `feat/asset-lab-audit`) e tutti i branch divergenti non ancora attribuiti a merge. Anche `docs/context-sync-pr-governance-20261021` è **esclusa** perché avanzata dopo il suo merge #74. Nessun contenuto di gameplay viene modificato.

## Stato attuale verificato — 23/10/2026

> **HEAD `main` [518e830](https://github.com/erykwest/CONQUER/commit/518e830547b66c12deefa0833487ea76b81c7746)** al momento della ricognizione. [Audit completo](AUDIT-2026-10-23.md) aggiornato da Git/PR e codice, **non da nuovo test end-to-end**. Le note sottostanti del 19–22/10 sono storiche quando dicono «solo branch».

- **Nuovi merge:** [#76](https://github.com/erykwest/CONQUER/pull/76) portoni con aggancio strade/ante/grata (120 HP indipendenti)/drappi/torce; [#79](https://github.com/erykwest/CONQUER/pull/79) Asset Lab catalogo; [#80](https://github.com/erykwest/CONQUER/pull/80) rotazione ±15° e tassonomia; [#81](https://github.com/erykwest/CONQUER/pull/81) 22 fortificazioni in pietra reali dal motore, manifest generato, 7 animazioni consultabili, sandbox isolata. Aggiunti `settlement-gate-fittings.js`, `asset-catalog.js`, `asset-manifest.js`, nuove QA dedicate. Nessuna nuova filiera economica è stata merge tramite queste quattro PR.
- **Stato GATE:** GATE-01/01b/02/03/04/06 **MAIN**, GATE-05 (portone ligneo completo) e GATE-07 (IA d'assedio sulle difese) **APERTO**. Su #76 SHA `a504ea65` GitHub Actions routing/builder/camp/work animation/earthworks/context sync **PASS**, oltre a prova QA `gate-fittings` riportata dalla PR.
- **Stato Lab:** 22 fortificazioni in pietra e animazioni lavoratori **MAIN**; 7 varianti lignee ancora senza volume 3D nel catalogo. #81 SHA `2e133d73` GitHub Action Asset Lab, routing, builder, camp, earthworks e context sync **PASS**; PR riportava Chromium PASS locale.
- **Non merge ancora:** [#61](https://github.com/erykwest/CONQUER/pull/61) danni (aggiornata e riallineata su `main` il 23/10, HEAD `92be4249`, ancora OPEN), [#77](https://github.com/erykwest/CONQUER/pull/77) cantieri assemblati per fasi + branch `case`, [#78](https://github.com/erykwest/CONQUER/pull/78) spazi eventi, [#82](https://github.com/erykwest/CONQUER/pull/82) audit visivo con 456 render, [#65](https://github.com/erykwest/CONQUER/pull/65) cutaway arredi, [#55](https://github.com/erykwest/CONQUER/pull/55) ledger/cantieri L1 (draft), [#72](https://github.com/erykwest/CONQUER/pull/72) cavalieri/convogli (base `knights`), [#18](https://github.com/erykwest/CONQUER/pull/18) visual QA (draft) e [#16](https://github.com/erykwest/CONQUER/pull/16) hardening (draft).
- **Rischio concreto da verificare:** #82, ancora solo branch, ha **segnalato** porte damage/broken non distinte dopo #76 e cantieri 25/50/75% visivamente identici in gran parte delle varianti. Segnalazioni **non riprodotte su main in questa ricognizione**. Collegare la QA del Lab alle implementazioni #76/#77/#61 prima della loro accettazione congiunta.
- **Priorità sistemica invariata:** `State.resources` vs `State.economy` vs `State.siege.stock`, manodopera L1 ai cantieri, miniera `stone` vs `metal`, bonus taverna/chiesa, difesa e assedio **continuo** con blocco/fame/resa. 13 core Builder e 10 residui dal precedente audit restano validi.

## Asset Lab — catalogo completo: fortificazioni dal motore, lavori, manifest generato (#81 MERGED; note QA originali del branch)

- **Codice ora presente su `main` dopo #81:** categoria **«Fortificazioni»** con 22 strutture in pietra (torri, mura con caditoie/hoardings, sezione costruita, porte) costruite dal gioco stesso: `figures-lab.html` apre in un iframe nascosto `index.html?assetlab=1&renderer=canvas2d` e `ConquerSiegePreview.assetMesh(spec)` monta una sola struttura delle varianti della galleria distruzione (`GALLERY`, ora esportata) e restituisce `ConquerCastle3D.worldMeshes()`. Miniature e inspector ruotabili a 15°, altezza in U nella scheda.
- **Sandbox `?assetlab=1`:** nessun salvataggio locale (`saveLocal` esce, slot di lettura vuoto `conquer.assetlab.sandbox`), nessun Supabase (import e `initSupabase` saltati), nessuna telemetria remota. Il salvataggio del giocatore non viene letto né scritto (verificato in Chromium).
- **Non incluse:** 7 varianti in legno (torri, porta lignea, palizzate), disegnate solo dal percorso 2.5D e senza volume `ConquerCastle3D`; lo stato è indicato nel Lab.
- **Animazioni di lavoro:** 7 voci «Popolazione / Lavori» (pala, ascia, piccone, martello, zappa, semina, falce) con miniatura dal colpo di `settlement-work-anim.js` e apertura dell'animazione live sull'azione corretta.
- **Manifest generato:** `tools/build-asset-manifest.cjs` produce `src/asset-manifest.js` (36 file + 2 set di rotazione `*_rotations`); la lista scritta a mano è stata rimossa. Campo taglialegna e cava mostrano i 24 fotogrammi con i pulsanti ±15°.
- **Correzioni:** la ricerca non trova più la parola «undefined» sui campi mancanti; rimosso il codice morto per torri/mura/fossati in `renderSchema`; righe della griglia non più schiacciate (già difettoso su `main`).
- **QA:** `qa/asset-catalog-regression.cjs` (manifest aggiornato, sandbox, 7 strumenti) e tutte le altre 65 regressioni statiche **PASS** in locale su checkout LF; `qa/asset-catalog-browser.mjs` **PASS** in locale con Chromium (fortificazioni, rotazione, nessun salvataggio, lavori, fotogrammi, ricerca). **CI della PR #81 verificata nel riesame del 23/10: PASS su SHA `2e133d73`.**

## Asset Lab — ispezione ruotabile e componenti reali (#80, integrato su `main` il 22/10/2026)

- **Codice su `main` (squash `bf548ca`):** inspector destro con pulsanti −15° / +15° per i modelli 3D; ricalcolo della proiezione e dell'ordinamento delle facce per le preview statiche; direzione reale modificata negli animali, carri 3D e macchine d'assedio animate, interrompendo l'autorotazione quando si usa il comando manuale.
- **Catalogazione corretta:** eliminata la falsa categoria «Fortificazioni», che conteneva soltanto texture di elementi e disegni SCHEMA di componenti procedurali non visualizzati dal gioco. Le texture reali `src/assets/architecture/*.png` sono ora in «Componenti» / «Elementi architettonici»; i 13 schemi simulati di fortificazione non sono più esposti. Nessuna modifica alle fortificazioni del Builder.
- **QA aggiornata:** asserzioni statiche per classificazione e rotazioni + browser Chromium per cambiamento pixel 3D, reversibilità, direzione degli animali animati, auto-rotazione disabilitata e invisibilità controlli su sprite 2D. CI Asset Lab **PASS** sulla PR #80 prima del merge.

## Ponti — magnete strade (branch `feat/bridge-road-magnets`, 23/10/2026)

- **Codice su branch (non ancora `main`):** il tool strada principale aggancia le due testate di ogni ponte (`bridgeRoadEnd` in `mainRoadSnapAnchor`, raggio `ROAD_RULES.snapNodeDistance`); cliccando sull'impalcato vale la testata più vicina. Vale per ponti di legno e pietra, in costruzione, ponti automatici delle strade principali e mezzoponti dei levatoi. Le bocche dei portoni restano prioritarie; un nodo stradale più vicino vince sulla testata.
- **Collisione:** prima una strada che terminava esattamente su una testata veniva rifiutata («Footprint overlaps»). `roadMeetsBridgeEnd` ora ammette la strada che parte/arriva sulla testata e si allontana dall'impalcato, sia piazzando la strada sia piazzando il ponte; una strada che torna indietro sopra l'impalcato resta bloccata.
- **UI:** con il tool strada le testate dei ponti sono disegnate come magneti (si illuminano sotto il puntatore, anche prima del primo clic); stato «⛓ Bridge magnet» / «Main road joined to the bridge».
- **QA:** nuova `qa/bridge-road-magnet-regression.cjs` e workflow `Road magnet regression`; aggiornata `gate-fittings-regression`. Batteria `qa/*.cjs` in checkout LF: 68/72 PASS, le 4 suite `*-performance.cjs` falliscono identiche su `origin/main` senza modifiche. Browser locale con eventi puntatore reali: strada dalla testata est verso campagna e dalla campagna alla testata ovest, entrambe con estremo esatto sul ponte. CI della PR da verificare.
- **LIMITI:** strada attraverso portone + levatoio sopra un fossato non verificata (BRIDGE-02).

> **Snapshot di riferimento: 22/10/2026**, `main` [c52b537](https://github.com/erykwest/CONQUER/commit/c52b537eac5f2a212841d45b75cc85b0136e069e), [audit integrale del backlog](AUDIT-2026-10-22.md). Il precedente [audit 21/10](AUDIT-2026-10-21.md) resta uno snapshot storico, utile per test già eseguiti allora. **Questa ricognizione è statica e non ha rieseguito le suite.**

## Stato aggiornato da audit integrale (22/10/2026)

- **13 feature Builder con core presente su main:** P0-01a/03/07; P1-12/13; P2-14/15/16/18/19/20; P3-21/22. **Non proporre più basamenti, alberi, scatter, araldica, palizzate, fossati, ponti e levatoi come implementazioni da zero.** I residui QA sono distinti.
- **10 feature Builder parziali:** P0-01/02/04/05/06/08; P1-09/10/11; P2-17. Sono codificate in parte: completare soltanto i contratti mancanti. P2-17 ha taverna/tempio e routine già presenti, **non bonus**; P0-08 produce ancora `stone`, non `metal`.
- **Clay su main:** cava d'argilla con validazione entro 6 U dall'acqua, `State.resources.clay`, costi `brick` in argilla, resa muraria e **HP all'80%**. QA `clay-material` e `clay-palette` presenti ma non rieseguite oggi. Le sezioni del 19/10 sulla branch `clay` sono storiche.
- **Built Sections e assedio su main:** slot per piano, `ConquerSiege.capacity/transfer`, `siege.stock`, `starvationDays`, Mastio, slot arcieri, danni, incendi, porte con portone, scale/arieti/altre macchine, terrapieni. **Manca un assedio strategico completo**: `settlement-siege.js` dichiara `No automatic surrender in P0`. Lo stock assedio non è ancora dimostrato coerente con il ledger economico.
- **Rami non integrati:** [#55](https://github.com/erykwest/CONQUER/pull/55) **DRAFT** — operai L1 cantieri/risorse/convogli parziali; [#61](https://github.com/erykwest/CONQUER/pull/61) danni; [#65](https://github.com/erykwest/CONQUER/pull/65) cutaway; [#72](https://github.com/erykwest/CONQUER/pull/72) su base `knights`; [#18](https://github.com/erykwest/CONQUER/pull/18) visual QA e [#16](https://github.com/erykwest/CONQUER/pull/16) hardening draft. Nessun merge è implicato dall'apertura.
- **Test e limiti:** identificati `qa/fields-regression.cjs`, `qa/scatter-regression.cjs`, `qa/drawbridge-regression.cjs`, `qa/earthworks-regression.cjs`, `qa/gate-breach-regression.cjs`, `qa/economy-industries-regression.cjs`, `qa/clay-material-regression.cjs`; **non rieseguiti nel corso di questo audit**. Gli spike GPU e i due test falliti nel vecchio benchmark restano elementi da confermare/correggere.
- **Priorità residua:** unificazione `State.resources` + `State.economy` + `State.siege.stock`; lavoro meccanico L1 ai cantieri; calendario/resa agricola; output miniera e officina; vertical slice con accessi/blocco/fame/resa; QA multipipeline.

Tutti gli ID, prove e gap distinti per livello sono nell'[AUDIT-2026-10-22](AUDIT-2026-10-22.md). Non retrocedere a TODO una feature già presente perché richiede soltanto QA.

## Snapshot attuale — main vs PR aperte (21/10/2026; storico)

**MERGED / codice su main:** [#44](https://github.com/erykwest/CONQUER/pull/44) minimappa+LOD; [#53](https://github.com/erykwest/CONQUER/pull/53) /camp, pattuglie, lupi e notte; [#54](https://github.com/erykwest/CONQUER/pull/54) solare stagionale; [#57](https://github.com/erykwest/CONQUER/pull/57)/[#58](https://github.com/erykwest/CONQUER/pull/58) mulini/menu; [#63–69](https://github.com/erykwest/CONQUER/pull/69) terraforming e cache; [#70](https://github.com/erykwest/CONQUER/pull/70) performance; [#71](https://github.com/erykwest/CONQUER/pull/71) 7 utensili/lavoro/cantieri; [#73](https://github.com/erykwest/CONQUER/pull/73) terrapieni d'assalto.

**OPEN / non su main:** [#55](https://github.com/erykwest/CONQUER/pull/55) ledger unificato e **squadre L1 che costruiscono**, commercio e convogli skeleton; [#61](https://github.com/erykwest/CONQUER/pull/61) matrice danni; [#65](https://github.com/erykwest/CONQUER/pull/65) cutaway arredato; [#72](https://github.com/erykwest/CONQUER/pull/72) cavalieri/messaggero/tributo su base `knights`, non `main`. Anche #18 e #16 restano aperte. Nessuna delle PR aperte è qui equiparata a release.

**QA:** la PR #70 riporta 60/62 suite PASS e browser fixture 40/30 Canvas/WebGL PASS; due suite preesistenti falliscono, picchi GPU fino a 303,8 ms; questa ricognizione non riesegue i test. Per stato, prove, confini e milestone vedere [audit completo](AUDIT-2026-10-21.md). Le note locali precedenti sulla branch performance non descrivono più lo stato di rilascio.

## Eventi — modelli 3D degli spazi (branch `events`, 22/10/2026)

- **CODICE su `events`:** catalogo Blender [`tools/blender/build_events.py`](../../tools/blender/build_events.py) → `src/assets/event-models.js` (`window.ConquerEventModels`, 24 modelli, 24.362 triangoli) e modulo [`src/settlement-events3d.js`](../../src/settlement-events3d.js) (`window.ConquerEvents3D`) agganciato al painter 2.5D (`settlement-render.js`) e al builder WebGL (`settlement-world3d.js`).
- **Contratto dati, non gameplay:** strutture `{type:'eventVenue', venue:'streetSpot'|'stage'|'festivalGround', dressing, event:{setup, phase, progress}}`. Podio per artisti di strada; palco 2,4 × 1,2 U nelle due vesti `players` / `herald`; spiazzo 14 × 10 U (D-044) verde da inattivo, con allestimenti `joust`, `tourney`, `circus`, `feast` (più `camp`, `theatre`); lotto permanente `arenaLot` 18 × 14 U con arena e accampamento visibili in `preparing` / `active` / `clearing`.
- **Livree:** tribune, arena, palchi seguono `State.heraldry` (c1, c2, c4); tende dei cavalieri, rastrelliere lance/scudi e armature usano coppie casuali deterministiche su cinque smalti, uniche per tenda in ogni spazio, con rotazione/spostamento casuale di tende, scatter e attrezzature senza collisioni né uscite dal lotto; circo e festoni hanno colori fissi.
- **Animazione vento:** stoffe (pennoni, festoni, gonfaloni, stendardi) sullo strato dinamico di entrambi i renderer, solo a gioco avviato; ~0,6 ms/frame sul lotto arena.
- **Persone (tutti gli allestimenti, arena, palco, pulpito; cavalli bardati):** `settlement-events-people.js` + `settlement-events-joust.js` su slot e registro occupanti allineati a CANS; occupanti **provvisori** (figuranti marcati), non ancora residenti reali: l'adapter CANS sostituirà la sorgente. Balaustre, drappi e schienali delle tribune e le pareti dell'arena coprono il pubblico (occlusori ordinati con le figure); le figure restano disegnate sopra gli edifici di altre strutture davanti allo spazio.
- **Builder:** categoria Eventi e svago (pulpito, palco, spiazzo, arena), piazzamento a due clic, ispettore con avvio/chiusura evento e ciclo sull'orologio; spazi salvati con la partita.
- **NON PRESENTE:** calendario programmato degli eventi, effetti economici e sul morale, spostamento libero dello spiazzo; persone ancora figuranti provvisori.
- **QA eseguita localmente (22/10/2026):** `qa/events3d-regression.cjs` PASS (catalogo, spazi, allestimenti dentro lo spiazzo senza sovrapposizioni, ciclo di vita, rotazione, livree) e `qa/civic3d-regression.cjs` PASS; nuova Action `events-regression.yml`. Controllo nel browser con spazi iniettati via console: Canvas 2D e renderer di default disegnano giostra, circo, sagra, podio e palchi senza errori in console. CI GitHub da verificare dopo il push.
- **Riallineamento 28/10/2026:** merge di `main` `5ddefa6` senza conflitti; `settlement-app.js`, `settlement-builder-ux.js`, `settlement-castle.js` e `docs/events/README.md` riportati a fine riga LF (erano stati committati in CRLF: diff apparente di ~1.600 righe, reale di 15); CHANGELOG ricostruito da quello di `main` più le sole voci Eventi (i merge precedenti avevano duplicato ~160 righe di storia). QA locale: 76/81 `qa/*.cjs` PASS; FAIL le 4 prove di performance che richiedono Playwright (assente in questo checkout) e `refactor-app-population`, che fallisce solo con checkout CRLF (vedi voce CI #78). Verifica visiva non ripetuta.

## Case L2+: basamento più basso con sporto, porte libere, torrette solo d'angolo (21/10/2026)

- **BASAMENTO:** il piano terra in pietra scende dal 50% al 42% del muro (`HOUSE_FLOOR_BREAK`, condiviso da WebGL2, Canvas, graticcio e torrette). Righe finestre invariate.
- **SPORTO (jetty):** sulle case L2+ il basamento è arretrato di 0,07 U sul lato porta e su quello opposto (assi ±Y locali), i piani superiori sporgono; i lati/muri di confine restano a filo. In WebGL2 c'è il sottosporto in legno; porta e finestre del piano terra stanno sul muro arretrato. Collisioni e navigazione usano ancora la sagoma piena.
- **PORTA:** nessuna finestra del piano terra sulla porta o sopra di essa: resta a 6 cm dall'anta oppure viene tolta (`houseFacadeDoorCut`).
- **TORRETTE SOLO D'ANGOLO:** a schiera solo l'edificio di testa di un fronte il cui vertice del lotto tocca un'altra strada; isolate solo se due strade non parallele passano vicino. La torretta va verso la strada laterale e la porta si sposta nell'altra metà della facciata. Le altre L4 si distinguono per gli abbaini. Il catalogo prerender (case isolate senza strade) ora mostra L4 senza torretta.
- **QA:** `houses3d`, `urban-density`, `urban-regression` aggiornate; 63/69 (stessi 6 fallimenti di main).

## Case L3/L4: tipo con timpano su strada, torrette d'angolo, abbaini (21/10/2026)

- **BRANCH:** `case`, sopra l'audit sottostante.
- **TIPO A TIMPANO (L3/L4 a schiera):** ogni lotto sceglie in modo deterministico (hash dell'id) tra il tipo con gronda su strada e il nuovo tipo con lato corto su strada: edifici stretti (1,0–1,08 U) e profondi (1,45–1,55 U), colmo perpendicolare alla strada, ala posteriore trasversale (pianta L/T). Se il lotto non è abbastanza profondo resta il tipo a gronda.
- **TORRETTA L4:** sempre su un angolo verso strada. A schiera: a filo del muro di confine, sporge di ¾ del raggio oltre la facciata e l'edificio arretra della stessa misura (resta nel lotto). Isolata: lato porta, sul corpo più avanzato con un angolo libero dalla porta. Le finestre e le travi della facciata coperte dalla torretta vengono tolte; la porta della casa a schiera si sposta dal lato opposto alla torretta.
- **FACCIATA TORRETTA:** graticcio (anelli/traversi a fascia, gronda e sommità, montanti) e due file di finestre verso l'esterno (rotonda 3+5, quadrata 2+4), in WebGL2 (decal + luci notturne) e Canvas.
- **ABBAINI L4:** due per falda sul corpo principale di ogni edificio, evitando torretta e camini; finestra con luce notturna. Una torretta grande di casa isolata può togliere un abbaino per falda.
- **QA:** `qa/houses3d-regression.cjs` estesa (tipo a timpano, angolo su strada, ≥3 finestre e graticcio della torretta, taglio facciata, abbaini). Verifica visiva WebGL2 e Canvas su due seed; prerender catalogo case PASS.

## Audit grafico case L1–L4 (21/10/2026)

- **BRANCH:** `case` da `main` `7d9328a`.
- **CAUSA PRINCIPALE:** le tettoie aperte (lotti bovini L2, cortili L3/L4) hanno un muro in meno; `addOutbuilding` del builder WebGL2 leggeva il tetto da `faces[n]` (inesistente) e il renderer 3D andava in errore, ricadendo in silenzio sul Canvas 2.5D. Regressione introdotta con il lato aperto delle tettoie (`9a11a14`). Gli "errori L4" visti in gioco erano in buona parte artefatti del fallback Canvas: ordine pittore delle ali T/L e travi/finestre di una casa disegnate sopra i tetti delle case vicine.
- **CORREZIONI:** tetto della tettoia = ultima faccia; torrette L4 con altezze relative ai muri (corpo +0,90, cono +1,70, fascia grigia a metà muro), invariate per le L4 manuali da 1,72 U; righe finestre L2+ proporzionali all'altezza del muro (0,52/1,34 invariate a 1,72 U, centrate nel piano alto delle L4 da 2,38 U).
- **QA:** nuova `qa/houses3d-regression.cjs` (fallisce su main, passa sul branch), aggiunta alla CI Civil. Suite locali 63/69: i 6 fallimenti (4 benchmark che richiedono browser e `refactor-app-population`, `wall-bays`) falliscono identici su main. Verifica visiva WebGL2 nel browser su villaggio generato con L1–L4, quattro rotazioni; prerender catalogo case 24 famiglie × 24 angoli PASS.
- **APERTI:** nel solo fallback Canvas restano l'ordine pittore delle ali T/L (L3/L4) e le facciate di una casa visibili attraverso i tetti delle vicine; nel WebGL2 una sottile cucitura tratteggiata dove due case a schiera L4 si sovrappongono.

## Portoni — magnete strade, ante, grata, drappi e torce (#76 MERGED 23/10; prove del branch 22/10)

- **CODICE ORA SU MAIN** via #76 (sviluppato originariamente su branch `portoni` da `f739e51`). Nuovo modulo `src/settlement-gate-fittings.js` (`window.ConquerGates`) più agganci in castle3d/world3d, placement, input, navigazione, fuochi e pannello.
- **Magnete:** il tool portone aggancia la strada più vicina (centro sulla mezzeria, passaggio lungo la strada, il movimento sceglie solo il fronte esterno). `roadUsesGatePassage` campiona la mezzeria: ammessa se entra ed esce dalle bocche, anche se termina o curva nel passaggio; il piazzamento non la tratta più come collisione.
- **Strade verso il portone:** il tool strada principale ha un magnete su ciascuna delle due bocche del portone (anche cliccando dentro il corpo). La strada finisce al centro del portone dopo un tratto d'accesso dritto lungo il passaggio (`gateRoadPort`, `manualRoadLegs`), quindi due strade dalle due bocche condividono il nodo centrale e la rete resta continua. Provato nel browser con eventi puntatore reali: due tratti per lato, percorso pedonale attraverso il portone.
- **3D:** nel solo renderer World 3D il corpo del portone in pietra è scavato (pilastri, volta ogivale, pavimento) con la stessa sagoma del decal `gatePortal`; cornici del portale su entrambe le bocche. Ante come mesh dinamiche che ruotano verso l'interno in ~1,4 s seguendo `gate.closed`; scure se danneggiate, assenti se sfondate. I percorsi Canvas mantengono il blocco pieno.
- **Grata:** upgrade del portone in pietra (24 oro, 16 metallo, 6 legno), alza/abbassa animato ~2,2 s; abbassata (o in movimento) blocca i pedoni anche a portone aperto. **Strato difensivo separato (D-042):** sezione `portcullis` da 120 HP in `ConquerSiege.integrity`; ariete/macchine diretti alla porta colpiscono prima la grata abbassata (ariete ×4, catapulta ×2,5, trabucco ×6, ascia ×0,1, lancia e fuoco 0), il fuoco passa e brucia la porta. Distrutta resta piegata a 0,25, non sbarra, riparabile (8 oro, 10 metallo); abbassata sbarra anche a porta sfondata. L'assalto con ariete irrompe solo con `gateBreached` (porta sfondata e nessuna grata giù). Provato nel browser con il pulsante «Test ram» del pannello: 3 colpi da 40 distruggono la grata, porta 85/85 intatta.
- **Drappi e torce:** due drappi con l'araldica del regno ai lati del portale esterno; due torce con staffa, fiamma e bagliore solo di notte, nascoste quando il fronte guarda via dalla camera.
- **QA:** nuova `qa/gate-fittings-regression.cjs` PASS; aggiornati i pattern sorgente di `gate-breach`, `mills3d` e `refactor-app-population` (aggancio grata in navigazione). Batteria non-browser **64/64 PASS in un checkout con fine riga LF come la CI**; su un checkout Windows CRLF `refactor-app-population` e `wall-bays` falliscono anche su `main` perché confrontano testo con `\n`, non per un difetto del gioco. Controllo visivo nel browser locale: ante aperte/semiaperte/chiuse, grata, notte con torce, vista posteriore, fallback Canvas con grata e torce. Suite browser (`.mjs`) non eseguite; CI GitHub del branch di merge `a504ea65` **verificata PASS** nel riesame 23/10; le suite browser `.mjs` non sono state rieseguite oggi.
- **LIMITI:** portone di legno solo con magnete; l'IA d'assedio non sceglie ancora fra grata, fuoco e altri accessi (GATE-07); un avviso WebGL preesistente ("no buffer is bound to enabled attribute") ha disattivato una volta il 3D durante le prove e non è stato riprodotto né attribuito a questo lavoro.

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
| Oggetti di cantiere | [settlement-construction-props.js](../../src/settlement-construction-props.js), [QA](../../qa/construction-props-regression.cjs), `tools/blender/build_construction.py` | **CODICE + QA su branch `feature/construction-props`**: impalcature, scale, materiali, banchi, paranco e gru a ruota per fase di `constructionProgress`, Canvas e WebGL2 (layer dinamico). Solo visivo; non legato a operai/risorse reali. |
| Montaggio progressivo dei cantieri | [settlement-construction-assembly.js](../../src/settlement-construction-assembly.js), [QA](../../qa/construction-assembly-regression.cjs) | **PROTOTIPO + QA su branch `feature/construction-props`**: edificio tagliato da una quota di cantiere (corsi, conci, telaio, puntoni/listelli/tegole) al posto del fantasma traslucido; provato su torri quadrate e tonde, porta, muro e palizzata (avanzamento orizzontale), `built`, chiesa, taverna, mercato e case L1–L4; ponteggi su tutti i lati di torri e porte; cache a immagine per cantiere (2–6 ms/frame con 10 cantieri). Torri/porte in legno ancora col fantasma. |
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
