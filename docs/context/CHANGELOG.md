# Livello 5 — Diario delle variazioni del contesto

06/11/2026 — Integrazione #169 su main c0c720b: mantenuti H4 e funzioni attuali, fixture aggiornata, catalogo Wiki rigenerato. Audit locale Mura: 265 render, 0 errori; 32 nuove voci addossati (legno, scuderia, pietra, mattoni) riviste nei fogli e aggiunte alla baseline; 98 cambiati preesistenti non accettati. Limite conservato: perdita del muro non abbatte automaticamente l'addossato; nessuna nuova regola di crollo introdotta.

05/11/2026 — `feature/wall-buildings`: edificio addossato alle mura (sezione W1, una stanza, contro muri H2) con tetto a falda unica sotto il camminamento. Di default in legno con tetto in paglia, a scelta pietra o mattoni. Piramide: STATUS, BACKLOG; backlog Builder: BC-251105-03/10.

06/11/2026 — Integrazione #165 su main 1247cca: aggiunte dal vault autore le schede Falconiera e Orto di corte (138 voci, 153 pagine, 156 note); export gameplay rigenerato. Nuovo workflow Wiki conforme a P1: concurrency PR e setup Chromium condiviso; inventario CI 26 workflow, 6 browser job. ROADMAP e contratti editoriali invariati.

## 2026-11-05 — Pulsante CODEX / WIKI nel Profilo

Richiesta dell'utente: accesso visibile dentro Profilo. Aggiunto pulsante di apertura del lettore esistente e collegamento nel bridge; barra Profilo con wrap e versioni cache aggiornate. Regressione browser estesa a entrambe le UI, chiusura/Escape, ritorno focus e mobile. Nessuna modifica a gameplay o salvataggi; ROADMAP/DECISIONS invariate, accesso UI sul contratto Wiki esistente.

## 2026-11-05 — Wiki da contenuti Obsidian (branch feature)

Migrati titoli, alias e testi di 151 pagine in note Markdown; aggiunti indice, guida e modello. Il vault personale è l'ambiente di scrittura e la copia Git è importata con baseline/conflitti e validazione preventiva. Generato artefatto editoriale per sito e gioco, preservando costi/regole dai provider. Supportati link a sezioni, paragrafi/titoli/liste/formattazione sicura. Ampliate cinque note di contenuto; test editoriali/import e browser PASS locali. D-CODEX-03 e documentazione aggiornati, nessun merge/deploy implicito.

## 2026-11-05 — Wiki Codex navigabile (branch feature)

Aggiunti `/wiki/`, vista condivisa, contenuti editoriali con autolink di keywords verso sovracategorie e schede, ricerca e filtri con URL, backlink, dati/quote dal catalogo. Lettore modale in-game e accessi Builder/UI2; export pubblico deterministico da sorgenti e CI contro dati obsoleti. Test locali e browser PASS, screenshot desktop/mobile revisionati. D-CODEX-02 documenta i link e il ciclo di pubblicazione generato. Nessun nuovo asset, tecnologia o dato personale pubblicato.

## 2026-11-05 — CODEX normalizzato v1 (branch feature)

Aggiunti `src/codex-catalog.js` (contratto portabile, copie congelate, ID/relazioni, quote e snapshot) e `src/settlement-codex.js` (adapter read-only, 136 record) in index. Preventivi dalle funzioni del Builder e dai registri, compatibilità da predicati esistenti o esplicitamente non mappata. Nessuna modifica a salvataggi, economia, asset o tecnologie. Test Codex e regressioni Builder/economia/save/runtime PASS in locale; API verificata nel browser. Suite aggiunta a Runtime integrity. Audit #159 incorporato; documentato D-CODEX-01. Nessun merge/deploy implicito.

## 2026-11-05 — Censimento iniziale CONQUER CODEX

Branch documentale `docs/codex-catalog-audit-20261105`, base `main` `bcf3cd7`. Aggiunto `docs/CODEX-CATALOG-AUDIT.md` con registri, chiavi, proprietari e limiti delle sette famiglie; distinto Asset Lab da catalogo gameplay e stato delle PR aperte. Aggiornati STATUS/BACKLOG e indice README. Nessuna modifica runtime/asset/bilanciamento; suite gameplay e browser non eseguite. ROADMAP e DECISIONS invariate: questa fase documenta fonti e prossimi passi senza cambiare milestone né introdurre contratti runtime.

05/11/2026 — `feature/falconry`: nuova stanza Falconiera (torri in pietra W2–W3 a falde, ultimo piano) con caccia di 4 razioni al giorno e voliera Blender sul tetto montata da `ROOM_EXTERIOR` (montaggio `roof` per le stanze); nuovo valore Prestigio del castello dalle stanze di corte. Piramide: STATUS, BACKLOG, DECISIONS (D-ROOM-EXT-01 esteso alle stanze sul tetto; D-PRESTIGE-01). ROADMAP invariata: la Falconiera era già approvata nel catalogo.

06/11/2026 — `chore/ci-p1-browser-dedup-20261106` (pre-merge): introdotta concurrency per tutti i 25 workflow (cancel run superati solo PR), eliminati full suite duplicati in Main fixes/Gate/WebGPU, unificato Playwright 1.56.1/Chromium con cache in composite action, concentrato audit visivo in Asset Lab (browser condizionale ai file visivi), limitato WebGPU a modifiche renderer e lancio manuale, preservate integrità/economia/guard documentale e ampliato P0 full a world3d/castle3d. Test di regressione `qa/ci-p1-regression.cjs` e documentazione `docs/CI.md` aggiornati. ROADMAP invariata.



06/11/2026 — branch `feature/local-production-haulage-20261106` (pre-merge): introdotto `ConquerHaulage`, traffico visivo reale delle merci trattenute dall'economia locale e del legname da bonifica fino ai Piazzali magazzino. Percorsi tramite `ConquerVehicles` sulle strade terminate, scelta del deposito connesso migliore, attesa in mancanza di route, carro carico in andata e vuoto in ritorno, sincronizzato alla pausa e al calendario. Kit carro, cavalli e conducenti 2D già esistenti; nessuna nuova risorsa, inventario o modello 3D. Aggiunti pannello Piazzale, QA e workflow Economy flows. Documenti STATUS/BACKLOG/DECISIONS/feature-backlog aggiornati; ROADMAP invariata.


06/11/2026 — `chore/ci-p0-consolidation-20261106` (pre-merge): CI P0. Ritirati 11 workflow obsoleti/monouso senza cancellare test. `settlement-routing-spawn.yml` mantiene ID check ma passa da full `qa/*-regression.cjs` su qualsiasi PR a smoke veloci sulle PR isolate, full pre-merge su cambiamenti nei moduli condivisi e full domenicale/manuale. Conservati runtime integrity, economy, governance. Aggiunti `qa/ci-p0-regression.cjs` e `docs/CI.md`. ROADMAP di gioco invariata; P1 Playwright/dedup ancora aperto.


06/11/2026 — Integrazione #155: fixture CIRCLE aggiornata a torri W2 esplicite per i granai e relativo towerTier; le W1 non ammettono granai secondo la nuova regola. Nessuna variazione alle scorte o alle regole CIRCLE.

## 2026-11-05 — Latrina nelle torri W1 (branch `fix/latrine-towers`)

- Correzione dell'utente: la latrina va al piano 2 delle torri W1 in pietra, con lo sbalzo sulla faccia esterna libera; non va più nelle sezioni costruite.
- Revisione: con una stanza assegnata la torre W1 perde la scala a chiocciola; latrina comune a 3 fori, meno sporgente, falda corretta, stanza arredata; sbalzo leggibile nel cutaway. Deroga d'audit motivata per «sagoma-conservata» sullo sbalzo crollato della torre quadrata.
- Le torri W1 ricevono una stanza per piano, ma con la scala a chiocciola accettano solo Colombaia (ultimo piano), Latrina, Prigione, Tesoro e Armeria.
- `ROOM_EXTERIOR` monta l'elemento `face` anche sulle torri; le feritoie della faccia gli lasciano il posto. Asset Lab: tre varianti di torre W1 nuove, la variante della sezione con latrina rimossa; baseline aggiornata.
- Piramide: STATUS, BACKLOG, DECISIONS (D-ROOM-EXT-01, prima applicazione). ROADMAP invariata.


05/11/2026 — `feature/roof-pitch-75` (BC-251105-08): pendenza dei tetti a 75° aggiunta al set 30/45/60° (`ROOF_PITCHES`, `ROOF_PITCH_COST[75]` = 9 legno · 3 oro · 1 pietra per tetto), opzione nella scheda «Pendenza dei tetti». Asset Lab: torri e porte a falde in pietra hanno gli stati «Tetto 30°/60°/75°» (gruppo `pendenza`, cattura con `State.policies.roofPitch` temporaneo). Nuova `qa/roof-pitch-regression.cjs` (in CI `tower-variants-regression`). Piramide: STATUS, BACKLOG, feature-backlog. ROADMAP e DECISIONS invariate: estende un contratto già esistente.

06/11/2026 — `feature/orto-di-corte` (pre-merge): BC-251105-11 deciso dall'utente come **orto di corte**. Nuovo annesso `kitchenGarden` del Municipio (3×2U, L1, max 2, su terreno aperto entro 7U, mai su lotti altrui); ogni orto completo produce 2 cibo del signore per giornata lavorativa, anche in allarme/assedio. Modello Blender `kitchenGarden` in `civic-models.js` e nell'Asset Lab (audit: 0 errori, baseline aggiornata solo per la nuova voce). Test in `civic-annex-regression` e `labor-jobs-regression`. Aggiornati STATUS/BACKLOG/DECISIONS, feature-backlog e guida annessi civili; ROADMAP invariata.


05/11/2026 — `feature/bc-scale`: BC-251105-01 scala lignea e BC-251105-02 scala lapidea ai camminamenti (upgrade del muro dall'ispettore, modelli Blender, accesso della rete wall-walk per le truppe, crollo in breccia, Asset Lab). Piramide: STATUS, BACKLOG, feature-backlog. ROADMAP e DECISIONS invariate: nuovo upgrade dentro il contratto esistente dei camminamenti.

06/11/2026 — Integrazione PR #175: riallineata a main b62d0b9 (#173/#174). Risolti conflitti preservando rampe, H4 e torre lignea. Corretto il test costiero intermittente: fixture con seedRand reale, prima assente (3 fallimenti su 20); nessuna modifica al runtime costiero.

06/11/2026 — `feature/wood-tower-h2` (BC-251105-06): nuova **torre lignea a telaio H2** nel Builder (Torri › Legno › «Telaio H2»), 1,5×1,5U, sempre coperta. Modello Blender `frameTower` (`tools/blender/build_wood_fort.py`): piano terra chiuso in tronchi, P1 con telaio controventato a vista e tamponamenti chiari, ballatoio con parapetto, tetto a padiglione e bandiera. Se è il mastio accetta l'ingresso rialzato (scala lignea/lapidea e ponte levatoio) con porta al P1. Cantiere, cutaway e Lab inclusi. Costo 55 oro / 130 legno, 6,5 giorni. Piramide: STATUS, BACKLOG, feature-backlog. ROADMAP e DECISIONS invariate: è una variante di una famiglia esistente.

06/11/2026 — `feature/tower-w2-h4` (pre-merge): BC-251105-07 valutata e approvata. La torre quadrata in pietra W2 indipendente sale fino a H4 (`towerH4Allowed`, `maxStructureLevel` 4): altezza 5,95 U più il tier, costo livello ×3,35. Pulsante «4 levels (W2)» nel menu torri, due varianti W2 H4 nell'Asset Lab, nuova `qa/tower-h4-regression.cjs`. STATUS, BACKLOG e feature-backlog aggiornati; ROADMAP e DECISIONS invariate (estensione di un limite, nessun contratto nuovo).


06/11/2026 — `feature/ramps-stairs`: BC-251105-12/13 rampe e scalinate sui dislivelli (`src/settlement-slopeways.js`), costruibili, percorribili dal pathfinding (carri e mezzi pesanti solo sulle rampe), nel Lab con audit; test `qa/slopeways-regression.cjs`. Piramide: STATUS, BACKLOG, feature-backlog. ROADMAP e DECISIONS invariate: nuova struttura dentro contratti esistenti (attraversamenti come i ponti).

05/11/2026 — `feature/founding-storage-yard-20261105` (pre-merge): aggiunto il tipo `storageYard` «Piazzale · Magazzino», 2×2U, fondazione entro 7U dal primo pozzo, espandibile a 4×4/6×6 con costi e collisioni, inventario visualizzato direttamente dal ledger unico del castello. Garantito un L1 al taglialegna con piazzale anche in presenza di saturazione cantieri; risolta la mancata crescita apparente del legname: quota trattenuta della produzione Logging Camp ora nel magazzino entro capienza, eccedenza sul mercato, anziché restare azzerata dall'obiettivo riserva 70 a fronte di stock iniziale 200. Salvataggi vecchi migrati senza stock duplicato; Canvas, World3D e tre mesh in Asset Lab (categoria Produzione); test specifici e CI Economy flows. ROADMAP invariata, DECISIONS/BACKLOG/STATUS e feature-backlog aggiornati.


05/11/2026 — `fix/forestry-l1-clearing-cost-20261105` (pre-merge): capanno del taglialegna ridotto da 25 a 5 legname (35 oro invariati); nuovo tool Terraforming «Rimuovi foresta», che crea un job L1 persistente e pagato. La rimozione del bosco e l'accredito della resa in legname nel castello avvengono solo alla fine del lavoro. Aggiunti regressione dedicata e hook CI Economy flows. ROADMAP invariata; aggiornati STATUS/BACKLOG/DECISIONS e backlog Builder. CI e merge da verificare su GitHub.


05/11/2026 — `fix/audit-sheet-grid`: i fogli provini per categoria vanno a griglia da 8 colonne. Lo sfondo neutro evita che le celle vuote sembrino un esito verde. Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: è uno strumento di QA, non cambia contratti.

05/11/2026 — `feature/double-crenel` (BC-251105-04): nuovi stili delle merlature «Merlo doppio» (merli lunghi il doppio sulle mura, sequenza 11011011) e «Doppia fila» (seconda fila di merli sul lato interno del cammino delle mura). Entrambi selezionabili nel Centro di controllo › Cantieri, presente nel Lab. Piramide: STATUS, BACKLOG, CHANGELOG, feature-backlog. ROADMAP e DECISIONS invariate: estende un contratto esistente (`State.policies.crenelStyle`).

## 2026-11-02 — Mare al 30% e Molo (branch `mare`)

- Banchina perpendicolare alla riva: pontili su entrambi i lati, approdo ridotto a 0,3U sulla banchina; test del molo esteso.
- Magnete delle mura sui lati della banchina: muro dritto all'esterno, addossato alla faccia, alla quota della banchina su zoccolo.
- Gabbiani (`src/settlement-gulls.js`, sprite 2D, solo grafica): stormi che girano sopra costa, moli e acqua vicina, con battiti d'ala, planate e ombra; altri posati su scogli, spiagge e teste dei moli. Di notte non volano, con la tempesta sono la metà.
- Onde (`ConquerCoast.drawWaves`, solo grafica, tempo reale, entrambi i renderer): creste di schiuma a tratti che salgono sulla spiaggia e si ritirano, spruzzi sugli scogli, riflessi in mare aperto. Il meteo cambia la forza (calma 0,6, vento 1, tempesta 1,6); di notte restano deboli riflessi.
- Moli commerciali e militari: un selettore nel pannello del molo (Commerciale di default). Le navi militari del giocatore attraccano solo ai moli militari; mercantili, convogli e pescatori solo ai commerciali e alle banchine. Nuovo pulsante **Attracca** nei comandi: le navi selezionate vanno all'attracco militare libero più vicino.
- Le bandiere delle navi sventolano tutte dalla stessa parte, sottovento: un vento per mappa (`ConquerShips.windHeading`, dal seme), e la rotta della nave non le fa più girare.
- Comandi unità per le navi militari del giocatore (`settlement-fleet.js`, agganciati agli ordini di `settlement-combat.js`). Si selezionano con un clic o un riquadro (Shift per aggiungere) e un riquadro giallo le evidenzia. Clic sul mare: la nave salpa lungo la rotta e resta all'ancora lì; più navi si mettono in fila. Clic su una nave straniera: la nave le si avvicina e a 16U parte la battaglia navale. Clic su un molo: la nave va a ormeggiare a un attracco libero. Le navi all'ancora vengono salvate nel punto in cui si trovano.
- Fix: il pagliolo delle barche aperte (barca da pesca, barca da carico, barchetta) era sotto o vicino alla linea di galleggiamento e il mare si vedeva dentro lo scafo, soprattutto con il rollio. Ora sta circa 0,35 m sopra l'acqua (`floor` in `build_ships.py`); un test controlla che ogni nave resti asciutta col rollio massimo.
- Navigazione in mare (`src/settlement-sea-nav.js`): griglia di 1U sul mare che esclude terra, scogli, banchine, moli e scali, con lo spazio libero di ogni cella per la larghezza dello scafo. Rotte A* lisciate; le navi si muovono a velocità reale e girano gradualmente; chi sta dietro aspetta se il suo scafo sta per toccare un'altra nave, con un limite di attesa. Pescatori e navi mercantili dei convogli seguono queste rotte. Tutte le navi hanno rollio e beccheggio (più le barche piccole e in navigazione).
- Pescatori: metà delle famiglie usa la barchetta a remi (remi separati in Blender che vogano) e metà la barca a vela; sul punto di pesca la rete (`castNet`, kit Blender pesca) viene calata, lasciata e salpata a ciclo; i punti di pesca stanno a 10U l'uno dall'altro.
- Cantiere navale: i carpentieri si vedono al lavoro lungo lo scafo sullo scalo (martello e ascia, animazioni dei cantieri edili), di giorno nei giorni feriali, tanti quanti l'economia ne assegna allo scalo.
- Costa (`src/settlement-coast.js`): spiaggia nelle insenature, costruibile; scogli sui promontori (vertici della costa che sporgono più di 1,2U verso il mare rispetto ai vicini). Gli scogli formano una fascia di 2,6U a terra e 1,2U in mare che le unità non attraversano e dove strade ed edifici non si possono costruire, tranne la banchina. Il terreno è dipinto a sabbia o pietra; scogli, secche, barche tirate a secco e legni portati dal mare vengono dal kit Blender waterside (`waterside-models.js`).
- Navi mercantili come carovane: nuovi mezzi `shipSmall` (300 punti = 3 carri) e `shipLarge` (900 = 9 carri) in `settlement-commerce.js`. I convogli del Mastio possono partire via mare se c'è un molo o una banchina, scegliendo un'uscita via mare; in mare il viaggio è più veloce (40U/giorno). Le navi (`src/settlement-sea-convoys.js`) si vedono lasciare il porto all'andata e rientrare al ritorno.
- DEV: nel pannello di un molo selezionato, `Fai arrivare qui` ormeggia a quel molo una nave del tipo e della bandiera scelti (da rimuovere poi).
- Cantiere navale (`src/settlement-shipyard.js`, molo con `yard:1|2`): si aggancia alla costa dal menu Porto. L1 ha lo scalo di 7U in mare e 5U a terra e costruisce barca, carico e caravella; L2 ha 10U in mare, 12U di piazzale e una gru a ruota, e costruisce anche cocca e nave latina. Si ordina una nave alla volta dal pannello (tipo e bandiera, costo pagato subito); fino a 3 carpentieri L1 lavorano nei giorni feriali e lo scafo cresce in fasi (ossatura, fasciame, ponte e castelli, alberi). Poi c'è il varo lungo lo scalo e la nave entra nella flotta. Kit Blender `tools/blender/build_shipyard.py` → `src/assets/shipyard-models.js` (scalo L1/L2, tettoia, ossatura), nell'Asset Lab sotto Produzione/Cantiere navale.
- La flotta si salva con il villaggio (`State.village.fleet`: tipo, bandiera, livrea, attracco) e si ricarica; le barche dei pescatori seguono le loro famiglie.
- Pescatori (`src/settlement-fishers.js`): le case L1 entro 14U da un molo o da una banchina diventano famiglie di pescatori, una per attracco libero, le più vicine prima. Ognuna ha una barca da pesca ormeggiata, che esce all'alba nei giorni feriali verso una zona di pesca al largo e rientra nel pomeriggio; il pescato vale 1,2 di cibo privato per pescatore per giorno lavorativo. Sul lotto ci sono rete stesa, rastrelliera del pesce e ceste (Blender `tools/blender/build_fishing.py` → `src/assets/fishing-models.js`, nell'Asset Lab sotto Produzione/Pescatori).
- Rotte commerciali col mare: niente strada principale né cartello sul lato mare; 3 uscite via mare (centro del lato mare e moncherini di mare dei due lati adiacenti) in `State.village.seaEntries` e in `ConquerConvoys.availableExits()` con `mode:'sea'`. Le uscite stradali non finiscono più sui moncherini di mare.
- Livrea casuale delle navi: ogni nave alla creazione prende a caso pittura dello scafo (fascia e pannelli, 7 colori) e tono del fasciame (5), passabili come `livery` a `ConquerFleet.spawn`.
- Attracchi lungo la banchina (ogni 5U, disattivati entro 4U da un pontile, sotto le mura, vicino alle torri); la flotta li usa dopo i pontili con controllo dello scafo.
- Regola: i muri di banchina mostrano sempre l'esterno all'acqua (flip forzato, anche sulle partite salvate; inversione manuale rifiutata).
- Angoli delle banchine chiusi (prolungamento alle estremità collegate, muri d'angolo sovrapposti); banchine, mura, torri e pontili da banchina possono proseguire oltre la white zone se partono da dentro.
- Torri sulla banchina (lati e vertici, porta verso la banchina, quota della banchina su zoccolo); magnete tra banchine (estremità e facce); texture a blocchi di pietra con giunti e lastricato.
- Navi nel WebGL (mesh dinamiche); pontili da banchina a ≥4U dalla riva e ≥5U tra loro; gru, paranchi e merci sulla banchina.

- Equipaggio militare (arcieri sui castelli, armigeri sul ponte) e battaglia navale dimostrativa: avvicinamento, frecce anche incendiarie, passerella e abbordaggio, incendio e affondamento (`settlement-naval-battle.js`, `qa/naval-battle-regression.cjs`). `settlement-fire.js` esporta `flame`/`smoke`.

- Porto: moli L4/L12, piazzamento solo costa + whitezone; banchina in pietra a due clic con moli agganciati; navi di test nel menu DEV (ormeggio con vele alzate, alla fonda, ordini alle vele). Toppe araldiche 16×10 e bandiere 10×6 per contenere il costo di disegno.

- Mare: copertura massima dal 20% al 30%, la costa arriva nella whitezone per permettere i porti.
- Nuovo Molo (`settlement-pier.js`): legno su pali, 8U sul mare, merci sulle tavole, due attracchi sinistra/destra; agganciato a menu, anteprima, validazione, costi, render 2D/WebGL e inspector.
- Cinque navi modellate in Blender (`build_ships.py`): barca, barca da carico, caravella (piccole); cocca, nave latina (grandi). Registrate nell'Asset Lab, regressione `qa/ships-regression.cjs`. Vele alzate per ogni nave e animazione di alzata/ammainata (morph tra i due stati Blender), con anteprima animata nel Lab. Araldica navale: bandiere e armi sulle vele per navi del giocatore e di regni stranieri, solo bandiera per le mercantili; partizioni araldiche spostate in `heraldry-shapes.js` (condivise con l'editor). Equipaggi civili: marinai che camminano sul ponte e gabbieri che salgono sugli alberi per manovrare le vele (`settlement-ship-crew.js`, dati da Blender, `qa/ship-crew-regression.cjs`). Cantiere del molo: materiali solo sull'approdo, nessun oggetto di cantiere in acqua, materiali in legno.
- Nuova regressione `qa/pier-regression.cjs` e workflow `sea-regression.yml`. ROADMAP e DECISIONS invariati (nessun nuovo contratto oltre la struttura `pier`).
## 2026-11-05 — Pendenza dei tetti di torri e porte (branch `feat/roof-pitch`)

- Nuova scelta globale `State.policies.roofPitch` (30°, 45° default, 60°; persistita locale e cloud) per tutti i tetti a falde in pietra di torri (piramide, due falde, padiglione, rotonde, a D) e porte (grande e piccola). La salita è `tan(pendenza) × semiluce` (raggio sulle rotonde, lato corto sulle quadrate); il piano in legno della porta piccola mantiene il suo colmo fisso.
- Cambio a pagamento dal Centro di controllo › Cantieri, scheda «Pendenza dei tetti»: costo per tetto (`ROOF_PITCH_COST`: 3 legno / 4 legno + 1 oro / 6 legno + 2 oro), cantieri esclusi; le nuove costruzioni seguono la pendenza. Comandi `ConquerGame.commands.roofPitchQuote/setRoofPitch`.
- Correzione cache: la firma del bitmap del corpo castello e quella degli sprite struttura includono ora stile delle merlature e pendenza, così il cambio si vede senza ricaricare.
- QA: Lab con le tre pendenze su torre quadrata, rotonda, due falde, porta grande e piccola; regressioni Node PASS tranne `asset-catalog-regression`, che fallisce identica su main. Asset audit 1081 render, 0 falliti, baseline aggiornata. CI non ancora eseguita.

## 2026-11-05 — Camino laterale delle case L1 (branch `fix/l1-chimney`)

- Le casette L1 hanno un solo camino, in pietra, addossato a una testata, da terra oltre la paglia (prima due camini sul colmo sulle casette da 2 U). La finestra della testata lascia il posto al camino. Nuovo pezzo `chimneySide` nel kit Blender e nel Lab.
- Piramide: STATUS, BACKLOG. DECISIONS e ROADMAP invariate (correzione visiva dentro D-057).

## 2026-11-04 — Long house in legno W1 / W2 (branch `feature/wood-longhouse`)

- Nuova long house lignea: una sezione costruita (`built`) con `material:'wood'`, larga come la W1 (1U) o la W2 (2U), solo piano terra (P0) con le stesse stanze della sezione in pietra al piano terra.
- Modello Blender in `tools/blender/build_wood_fort.py` (campata da 1U ripetuta lungo a→b, testata con porta e testata cieca, tetto a scandole, assi incrociate sui frontoni) → `src/assets/wood-fort-models.js`; i modelli lignei esistenti sono rigenerati identici.
- Asset Lab: 4 varianti nella famiglia Mura e 7 voci nel catalogo strutture; baseline dell'audit estesa con i 32 render nuovi.
- Cutaway corretto: in World 3D ora si apre dal comando, nel 2.5D la stanza non passa più dai compositi del castello in pietra, e il tetto si toglie tutto.
- Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: nuova variante di un tipo esistente, non cambia milestone né contratti.
04/11/2026 — `fix/prepare-architecture-textures`: ridotte le texture architettoniche al formato già usato dal renderer e rimossa la preparazione Canvas all’avvio.

04/11/2026 — `fix/remove-fossil-industry-svg`: rimossi 50 SVG obsoleti di cava e campo taglialegna. Manifest, baseline e regressione del Lab aggiornati alle anteprime 3D.

## 2026-11-03 — Mastio W4 · 3U, più stanze per piano (branch `feature/keep-w4`)

- Nuovo tier W4 (3×3U) per il mastio: piante per piano con 1–4 stanze, tramezzi e porte nel cutaway, stanze assegnate per piano. Lab: 5 righe nella galleria fortificazioni e 16 voci nel catalogo.
- Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: è un prototipo da provare, non cambia milestone né contratti.


## 2026-11-03 — Portico delle sezioni W1 (branch `feature/built-portico`)

- Porticato W1 corretto: stessa geometria in 2.5D, World 3D e cutaway, archi sotto il piano sopraelevato, portico visibile nel cutaway 3D.
- In World 3D il portico W1 è una loggia vera: piano terra arretrato, pilastri e archi, piano rialzato sopra (anche nel cutaway).
- Sotto il portico solo stalle, officina degli armaioli, magazzino e corpo di guardia.
- Il portico ha una stanza arredata per campata, sempre visibile in 3D, e un camminamento lungo i pilastri percorso dalle figure.
- Nuova `qa/built-portico-regression.cjs`; variante «Sezione porticata L2» nel Lab e in baseline.
- Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: correzione di resa e regola sulle stanze, non cambia milestone né contratti.
## 2026-11-04 — Campana d'allarme (branch `feature/alarm-bell`)

- L'allarme del villaggio si propaga dalle campane (chiesa, Municipio, torri T1–T2 a falde con l'upgrade `bell`): raggio d'ascolto, catena di campane, passaparola oltre i raggi. Le case lontane lo sentono più tardi.
- Campanile Blender sul tetto, montato con `ROOM_EXTERIOR`, esteso agli upgrade di struttura e al montaggio `roof`. Il tetto è esclusivo con Colombaia e Falconiera.
- Asset Lab: 6 varianti di torre e il modello; baseline dell'audit aggiornata. Nuova `qa/alarm-bell-regression.cjs`.
- Piramide: STATUS, BACKLOG, DECISIONS (estensione di D-ROOM-EXT-01). ROADMAP invariata: la Campana era già approvata nel catalogo delle stanze.

## 2026-11-04 — Scuderia militare (branch `feature/military-stables`)

- `stables` nelle sezioni costruite W1: 5 cavalli per U, poste in fila nel cutaway. Le sale larghe W2 non ammettono più la scuderia. Una stalla catturata perde i cavalli; senza cibo si macellano quelli di riserva. Le risposte ai messaggeri ripartono a cavallo, 1,5× più veloci.
- Nuova `qa/military-stables-regression.cjs`; una variante nel Lab con la sua baseline.
- Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: è l'estensione di una stanza esistente nella direzione già decisa, senza nuovi contratti.

## 2026-11-04 — Cisterna (branch `feature/cistern`)

- Nuova stanza Cisterna al piano terra delle torri in pietra W2–W3: sempre piena, disseta 60 persone (120 nelle torri grandi) quando i nemici tagliano fuori i pozzi; altrimenti cresce la sete (`thirstDays`). La catena dei secchi attinge alla porta della torre.
- Arredo cutaway (vasca, botola con argano, secchi) da due nuovi pezzi Blender; due righe nella galleria dell'Asset Lab; baseline dell'audit aggiornata.
- Nuova `qa/cistern-regression.cjs`; estese `qa/cutaway-furniture-regression.cjs` e `qa/multi-wells-regression.cjs`.
- Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: è una stanza della direzione già decisa (stanze e annessi al posto di edifici nuovi), senza nuovi contratti.

## 2026-11-04 — Colombaia nelle torri a falde (branch `feature/colombaia`)

- Nuova stanza `dovecote` (Colombaia): ultimo piano di torri in pietra T2/T3 L2–L3 con tetto a falde. Lettere per colombo viaggiatore 4× più veloci verso la torre-colombaia, risposta immediata senza corriere di ritorno.
- Lanterna Blender sull'apice del tetto (3D e 2.5D), parete dei nidi e posatoio nel cutaway, registri lanterna e arredi nell'Asset Lab, tre varianti di galleria; baseline dell'audit aggiornata.
- Nuova `qa/dovecote-regression.cjs` nel workflow delle varianti di torre.
- Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: la Colombaia era già approvata come idea nel catalogo delle stanze e torri; la regola «una sola funzione sotto il tetto» è annotata in STATUS.

## 2026-11-04 — Infermeria nelle sezioni costruite (branch `feature/infirmary`)

- Nuova stanza Infermeria, solo nelle sezioni costruite (piano terra e primo piano della W1, sala larga W2).
  - Ogni giorno, con il personale pagato, ricovera i caduti nella zona gialla (60% di sopravvivenza, ritorno dopo 3 giorni a metà vita) e cura i feriti.
  - I letti liberi danno +1 di felicità settimanale a L1 e L2.
- Nuovi arredi Blender: letto d'infermeria (testiera al muro, letti perpendicolari, 6 per stanza normale e 12 per la grande) e scaffale delle erbe. Gli arredi del cutaway entrano nell'Asset Lab, che ora ha anche due varianti di infermeria nel palco del motore.
- Nuova `qa/infirmary-regression.cjs`; `cutaway-furniture-regression.cjs` copre il nuovo ruolo.
- Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: la stanza segue la direzione già concordata (ampliare gli edifici con stanze, con effetti reali sulla simulazione) e non cambia contratti.

## 2026-11-04 — Elementi esterni delle stanze e Latrina (branch `feature/room-exterior-latrine`)

- Nuovo contratto `ROOM_EXTERIOR`: una stanza può aggiungere un elemento all'esterno dell'edificio, disegnato da tutti i renderer con un'unica geometria e incluso nel crollo.
- Prima applicazione: la latrina (garderobe) a sbalzo su mensole al piano 2 delle sezioni W1, con lo scarico verso terra. Effetto in gioco: igiene della guarnigione, con fino al 10% degli arcieri malati quando mancano latrine per una guarnigione grande. La latrina è rompibile dall'artiglieria e si può ricostruire.
- Nuovi `src/settlement-room-exterior.js`, `tools/blender/build_garderobe.py`, `src/assets/garderobe-models.js`, il pezzo d'arredo `latrineSeat` e `qa/room-exterior-latrine-regression.cjs`. Nel Lab: la variante e il modello.
- Piramide: STATUS, BACKLOG, DECISIONS (D-ROOM-EXT-01). ROADMAP invariata: la latrina era già approvata nel catalogo delle stanze, quindi non cambia milestone.
- CI: il modello della garderobe è nel Lab sotto «Edifici», come il kit case, perché «Fortificazioni» contiene solo mesh del motore. Il job browser di `main-fixes-regression.yml` è fissato su `ubuntu-24.04` come gli altri job browser: Playwright 1.56 non ha Chromium per `ubuntu-latest` (26.04).

## 2026-11-03 — Tribunale in seduta (branch `feature/crime-tribunal-scene`, su `feature/crime-buildings`)

- **Scena:** quando il Municipio selezionato mostra il piano del tribunale, nei giorni feriali dalle 9 alle 17 e senza allarme, la sala si riempie di persone.
  - **Chi:** giudici in toga e berretto rossi (quello che presiede alza la mano), cancelliere che scrive, prigioniero a mani legate tra due guardie, pubblico sulle panche.
  - **Come:** nuovo modulo `src/settlement-court-people.js`; i posti vengono da `ConquerCivic3D.roomSlots`, che condivide il layout con l'arredo.
- **Prigioni occupate:** al piano terra, da 1 a 5 detenuti per cella (alle sbarre o seduti sulla paglia, sbarre ridisegnate davanti) e carceriere al tavolo nel Municipio; lo stesso nelle prigioni del castello. A ogni ora.
- **Gogna, forca e patibolo in uso:** gogna occupata (lun–sab, 8–17) con capannello che schernisce; «giorno di giustizia» (venerdì 10–12) con boia incappucciato sul palco, magistrato che legge sul patibolo, guardie alla scala e folla. Scene sobrie, senza condannato sul palco né esecuzione.
- **Costumi di ruolo:** catalogo separato `ConquerWardrobe.ROLE_PIECES` (giudice, cancelliere, prigioniero, boia), mai assegnato per stagione. Nel Lab sotto *Costumi di ruolo*.
- **Prove:** nuova `qa/court-people-regression.cjs`, anche nel workflow CRIME. Specifica in [crime.md](../crime.md).
- **Piramide:** STATUS, BACKLOG (C-04 avviato). ROADMAP e DECISIONS invariate: è la prima scena visiva di C-04 e non cambia contratti.

## 2026-11-03 — Edifici e stanze di CRIME nel Builder (branch `feature/crime-buildings`)

- **Municipio:** una stanza per piano (tante quante i livelli) con consiglio, tribunale (L2+), corpo di guardia e prigione, arredate sull'intero piano e viste un piano per volta col cutaway per piani (unito da `feature/cutaway-floors`).
- **Capienze:** detenuti (5 per cella) e sentinelle in `ConquerSiege.capacity()`; prigioni solo al piano terra (P0), nel castello e nel Municipio.
- **Ospizio:** annesso della Chiesa L2, casa lunga a due piani (4,5 × 2,4 U) nello stile delle case con ballatoio al P1.
- **Gogna, forca e patibolo:** tre strutture di piazza collocabili, con modelli Blender, nel Lab e nel Builder; in `/crime/` il patibolo è separato dalla forca.
- **Prove:** nuova regressione `qa/crime-buildings-regression.cjs`, anche in CI. Specifica in [crime.md](../crime.md).
- **Piramide:** STATUS, BACKLOG (C-02 e C-03 su branch), DECISIONS (tribunale nel Municipio). ROADMAP invariata.

## 2026-11-04 — Case L4 in 3D con il kit Blender (branch `feature/houses-blender-l4`)

- Le case L4 in World 3D usano il kit: torrette d'angolo tonde e quadrate (muri in pietra e graticcio, finestre del kit, tetto conico o a piramide con pinnacolo, nuovi pezzi Blender) e abbaini con finestra del kit. Kit a 11 pezzi; 2 voci nuove nel Lab.
- Piramide: STATUS, BACKLOG. DECISIONS invariata (applica D-057: pilota L3, poi gli altri livelli); ROADMAP invariata.

## 2026-11-03 — Case L1 e L2 in 3D con il kit Blender (branch `feature/houses-blender-l1`)

- Anche le case L2 in World 3D usano il kit (gli stessi pezzi delle L3, su un corpo solo, come nel disegno procedurale).
- Tetti corretti: le falde del kit mostravano il sottotetto bruno sopra l'ardesia e la paglia (falde avvolte al contrario nel builder Blender); ora ardesia grigia su L2/L3 e paglia sulle L1. Verificata l'argilla: mattoni, coppi e dettagli del kit coerenti, senza pietra o ardesia grigie.

- Le casette L1 in World 3D sono costruite col kit: tetto di paglia, finestre rustiche con anta, porta a tavole, telaio di pali e travi, comignoli. Kit a 9 pezzi; corrette le chiavi della baseline dell'audit per il kit (prima non venivano mai riconosciute).
- Piramide: STATUS, BACKLOG. DECISIONS invariata (applica D-057: pilota L3, poi gli altri livelli); ROADMAP invariata.
## 2026-11-03 — Cucine solo nelle sezioni costruite (branch `feature/kitchen-built-only`)

- La cucina si assegna solo al piano terra delle sezioni costruite (W1 sezione, W2 sala larga), non più in torri o porte; i salvataggi esistenti perdono le cucine fuori regola al caricamento.
- Nuova `qa/kitchen-rooms-regression.cjs`.
- Piramide: STATUS, BACKLOG. ROADMAP e DECISIONS invariate: è una regola di gioco sulle stanze, non cambia milestone né contratti.

## 2026-11-02 — Case L3 in 3D con kit Blender, pilota (branch `feature/houses-blender`)

- Le case L3 in World 3D sono costruite con un kit Blender (finestre, porta, tetto a 60°, comignolo, travi dello sporto) montato sulle piante procedurali del gioco: graticcio e finestre su tutti i lati. Il fallback 2.5D resta invariato.
- Nuovi `tools/blender/build_houses.py`, `src/assets/house-models.js`, `src/settlement-house3d.js`, `qa/house3d-regression.cjs`; 6 voci nel Lab.
- Piramide: STATUS, BACKLOG, DECISIONS (D-057). ROADMAP invariata: è una scelta di resa grafica delle case, non cambia milestone né la priorità P1 economia.
## 2026-11-03 — Combat: chiuso il refactor del renderer

- Recuperato il residuo della branch combat a partire dal runtime main f603d514: presentazione tattica separata, nessuna regressione al prototipo vecchio. Disegno di frecce/pietre/lampi spostato fuori dalle regole.
- Aggiornati Builder, /camp e harness di test; aggiunti test del confine stato/disegno, CI e documentazione del contratto. 118 suite PASS, trace equivalenti in cinque scenari e pixel browser identici prima/dopo. Lab: 784 render e zero fail; avvisi/drift registrati separatamente.
- Cleanup combat previsto solo dopo promozione del commit verificato. Nessuna nuova PR. Roadmap di prodotto invariata; contratto tecnico registrato in DECISIONS.

## 2026-11-03 — Cutaway per piani (branch `feature/cutaway-floors`)

- Lo spaccato mostra un piano per volta: ▲ ▼ sopra l'edificio selezionato e nell'ispettore (nuovo e vecchio) tolgono o rimettono i piani superiori. Un solo comando, `StructureCommands.stepCutawayFloor`, e un campo `s.cutawayFloor`.
- **Castello** (torri, porte, sezioni costruite): per default tutti i piani come prima. Scendendo, muri, finestre, solai, arredi, scale a pioli e occupanti si fermano al soffitto del piano in vista; la sottotorre segue la madre. Sia in 2.5D sia in WebGL.
- **Edifici civici:** per default il piano terra come prima. Il Municipio apre anche i piani superiori del suo modello (L1–L2: 2 piani, L3: 3), con pavimento di tavole, pareti di fondo tagliate al soffitto e torre a moncone. Gli altri edifici civici hanno un solo piano finché non hanno interni ai piani alti.
- **Prove:** nuova `qa/cutaway-floors-regression.cjs` con workflow dedicato.
- **Piramide:** STATUS, BACKLOG, DECISIONS (D-CUT-01). ROADMAP invariata.

## 2026-11-03 — Hardening e skeleton CANS, senza ripristino del vecchio combat

- **Browser locale PASS:** avvio con WebGL senza errori, diagnostica locale senza fetch, CANS assente dal bootstrap e caricato solo su richiesta con prenotazione esclusiva funzionante. 107 controlli di sintassi PASS.
- Recuperati da audit-hardening soltanto i residui mancanti: API telemetria disattivata e rimozione dell'invio pubblico diretto; mantenute diagnostica locale e implementazione salvataggi attuale #93. Nuovi test comportamentali e workflow Runtime integrity.
- Conservato lo skeleton CANS opt-in con specifica, 11 regressioni e workflow anche per main; nessun adapter o cittadino reale dichiarato completo.
- Combat conserva un residuo utile: separazione del renderer overlay da riconciliare sul runtime attuale; nessun rollback di capitano, battaglie, animazioni o pattuglie. Branch conservata.
- QA locale: 5 runtime test e 116 suite di regressione verificate; guard statico Lab allineato alla telemetria sempre locale. Prevista pulizia di cans/audit-hardening solo dopo promozione verificata. ROADMAP e DECISIONS invariate nei contratti; dettaglio in STATUS.


## 2026-11-03 — Consolidamento assedio, events e messaggeri senza 3D

- Confrontati i tre branch selezionati con main 49831855: nessun residuo utile da integrare; assedio coperto da #61, eventi da #78/#110, cavalieri/messaggeri 2D da #96 e convogli da #105.
- 18/18 regressioni pertinenti superate. Il codice 3D del vecchio branch cavalieri resta escluso (D-046); nessuna regressione al vecchio inventario o al vecchio modello danni.
- Workflow di pulizia limitato ai tre commit verificati, con protezione dei ref aggiornati e delle PR aperte. Nessuna nuova PR o modifica al runtime.


## 2026-11-02 — Ballatoi di torri e porte (branch `feature/tower-hoardings`)

- Ballatoio di legno come aggiunta temporanea (Montato / Smontato) sulle torri in pietra (quadrata, rotonda, a D) e sulle porte in pietra grande e piccola, merlate o a falde: il tetto resta quello costruito, sotto le falde il ballatoio pende sotto la gronda. Sulle porte solo sul fronte esterno; sulle torri si interrompe contro porte e torri attaccate più alte. Nuova regola D-GATE-01: le torri agganciate a una porta hanno ingresso e lato interno sempre sul retro della porta. Modello Blender (`tools/blender/build_hoarding.py`) ripetuto lungo il profilo; brucia, esclude le macchine in cima alla torre. Stato e prove in [STATUS](STATUS.md). ROADMAP invariata; DECISIONS: aggiunta D-GATE-01; nuova variante `hoarding` dei tipi `tower` e `gate`, nessun tipo nuovo.
## 2026-11-02 — Fronte bottega e insegna a bandiera, fase 2 (branch `feature/l3-workshop-cutaway`)

- Le case L3 con bottega mostrano su strada una vetrina a ante (banco e tettoia di giorno, ante chiuse la notte e la domenica) e un'insegna a bandiera di ferro accanto alla porta, con l'emblema del mestiere; la finestra del pianterreno dietro la vetrina sparisce.
- Asset Lab: stato «Bottega chiusa»; corretti nello stage la cache urbana non invalidata (catture delle case senza travi e finestre) e la maschera che ritagliava le travi scure. Baseline delle 21 voci «Botteghe L3» rifatta. Nessuna regressione nel rendering del gioco: verificato sul fotogramma senza maschera.
- Piramide: STATUS, BACKLOG (insegne e merci in facciata in fase 2 su branch). DECISIONS e ROADMAP invariate: è il completamento visivo già previsto da D-053/D-059.


## 2026-11-02 — Cutaway delle botteghe L3, fase 1 (branch `feature/l3-workshop-cutaway`)

- La casa L3 selezionata con una bottega mostra il pianterreno in sezione, arredato per mestiere, con il banco su strada e l'artigiano al lavoro durante l'orario di bottega. Modulo `src/settlement-shop-cutaway.js`; agganci in 2.5D, WebGL, facciate, fumo, occlusione delle figure e passaggio della popolazione.
- Asset Lab: 7 voci «Botteghe L3» (stati «Nel gioco» e «Cutaway»), 14 voci aggiunte alla baseline dopo la revisione del foglio provini; i 140 «cambiati» delle fortificazioni (deriva di luce, tutti più chiari) non sono stati riscritti. Nuova regressione `qa/shop-cutaway-regression.cjs`.
- Piramide: STATUS, BACKLOG (chiusa in fase 1 la voce «cutaway delle botteghe e persone all'interno»), DECISIONS (D-059). ROADMAP invariata: è un completamento visivo di #101, non cambia milestone né priorità P1 economia.

## 2026-11-03 — Le case bruciate crollano (branch `fix/house-fire-collapse`)

- Un incendio lasciato bruciare fino in fondo abbatte case (di ogni livello), locande e mercati, con macerie e braci; prima le case L3/L4 restavano in piedi al 2% di integrità. Regressione dell'incendio estesa.
- Piramide: STATUS, BACKLOG, DECISIONS (D-058, scelta dell'utente). ROADMAP invariata.
## 2026-11-03 — Priorità P0 e riconciliazione circle

- CI CIRCLE estesa a main e alle dipendenze core/stanze/ingresso mastio; fixture VM portabili anche con checkout CRLF Windows.
- Ordine richiesto dall'utente: P0 bridge/circle/jobmanager/knights, P2 messages, P3 pertinenza delle altre branch senza PR.
- Recupero dei soli residui di circle sulla main d8c89556: conflitto script risolto preservando economia/convogli, integrazione mastio rialzato e reset al cambio salvataggio. Nessuna reintegrazione di bridge, JobManager parallelo o cavalieri 3D.
- QA locale: 67 test circle e 113 suite di regressione superati; founding richiede esecuzione isolata dopo fallimento temporale sotto carico. Stato pubblicazione/merge da risolvere tramite SHA Git remoto.

## 2026-11-03 — Economia: regressioni delle tappe 2–5 in CI (PR #109)

- `economy-flows-regression.yml` esegue anche routine, commercio, botteghe L3, convogli, cartelli, diplomazia e veicoli. Corretti in STATUS e BACKLOG gli stati delle tappe 4 (#105) e 5 (#108), già mergiate.

## 2026-10-30 — Stili di merlatura del feudo · branch `feat/crenel-styles`

- Nuova scelta globale in `State.policies.crenelStyle` (persistita locale e cloud): **piatta** (default), **doppia falda** (colmo lungo il muro), **coda di rondine** (corna a V e feritoia sul lato visibile). Vale per tutti i merli in pietra di torri, porte e mura; le nuove costruzioni seguono lo stile scelto.
- Cambio a pagamento dal Centro di controllo › Cantieri, scheda «Stile delle merlature»: costo per merlo dello stile di arrivo (`CRENEL_STYLE_COST`: 1 pietra / 2 pietra + 1 oro / 3 pietra + 2 oro), argilla al posto della pietra sulle strutture in mattone, cantieri esclusi. Comandi `ConquerGame.commands.crenelQuote/setCrenelStyle`.
- Geometria: corona dei merli in `merlonStyleParts`, disegnata identica dal renderer 2.5D e da `settlement-castle3d.js`. Merli più sottili nello spessore del muro (`MERLON_DEPTH_SCALE` 0,72, parapetti allineati) e merlo d'angolo a L su torri quadrate e porte, con pilastro condiviso per le rondini e testata a padiglione per la falda.
- QA: verifica visiva nel Lab dei tre stili su torre quadrata, rotonda, caditoie e porta; `node qa/asset-audit.mjs` 487 render, 0 falliti, avvisi invariati (cantiere progressivo, schemi illustrativi); baseline aggiornata per il nuovo merlo di default. CI non ancora eseguita.
## 2026-10-30 — Municipio e gilda sulle piazze dei pozzi (branch `feature/townhall-guild`)

- Nuovi edifici civici L1–L3 legati ai pozzi: municipio con torre civica centrale, campana e meridiana (orologio al L3), gilda; modelli Blender, cutaway, cantiere e crollo. I modelli civici ora rispettano mattoni/argilla. Stato e prove in [STATUS](STATUS.md); ROADMAP e DECISIONS invariate (estende D-056 senza cambiarne il contratto).
## 2026-10-30 — Più pozzi per villaggio (branch `feature/multi-wells`)

- Dopo la fondazione si possono costruire altri pozzi: ognuno è un centro di espansione (zone, case, campi, antincendio) collegato al primo pozzo con una strada principale, senza nuove strade maestre. Il centro villaggio si designa dall'ispettore come il mastio; i pozzi non centro hanno un nome di quartiere mostrato sulla mappa. Stato e prove in [STATUS](STATUS.md). D-056 in DECISIONS; ROADMAP invariata.

## 2026-11-02 — Moduli isolati economia urbana autonoma integrati

- Recuperato lo scheletro `feature/autonomous-urban-economy`: quattro file `src/economy/` su `main`, senza attivare il runtime. Aggiornati STATUS e BACKLOG con limiti e dipendenze; ROADMAP e DECISIONS invariate.

## 2026-11-02 — CRIME: skeleton criminalità / ordine pubblico (branch `feature/crime-skeleton`)

- Aggiunta route isolata `/crime/`: simulator deterministico a tre indicatori, cinque fasi (malcontento→rivolta), controlli sociali e repressivi, guardie/prigione/ospizio/gogna/patibolo/tribunale come fixture, arresti dimostrativi, grafico storico, cronaca e localStorage separato. Aggiunti `docs/crime.md` e `qa/crime-regression.cjs`.
- Stato: **solo branch**, motore e regressioni isolati verificati in harness JS; Node CLI, CI e browser non ancora verificati al momento del commit. Nessun modello 3D, nuovo tipo di edificio in Builder, NPC reale o integrazione Combat. La roadmap M0–M5 non cambia; decisione del perimetro sandbox in D-CRIME-01.


## 2026-10-30 — Accampamenti: livree, bivacco, accampamento militare fortificabile (branch `feature/tent-livery`)

- Padiglioni con livree a schema e contrasto tra vicini; nuovo kit Blender del campo; bivacco notturno organizzato; accampamento militare a quartieri come struttura del Builder, fortificabile a livelli; modelli e composizioni nel Lab. Stato e prove in [STATUS](STATUS.md). AGENTS.md: verifica visiva nel Lab e obbligo di inserire ogni nuovo modello nel Lab. ROADMAP e DECISIONS invariate: l'accampamento riusa il contratto `eventVenue` (nuova venue `armyCamp`), nessuna decisione architetturale nuova.

## 2026-11-02 — Ingresso rialzato del mastio (branch `feature/mastio-entrance`)

- Il mastio può avere la porta al primo piano con una scala esterna: legno, poi pietra lungo la facciata, e un levatoio dedicato su entrambe che, alzato, chiude il mastio a chi sta a terra. Piano terra cieco, finestra e drappo lasciano il posto alla porta sul suo piano, civili e strade di servizio passano dal piede della scala. Stato e prove in [STATUS](STATUS.md). ROADMAP invariata; DECISIONS: nuova D-MASTIO-01.
- Seconda tappa: il levatoio si alza da solo quando i nemici si avvicinano alla scala e sbarra le porte del mastio sul cammino di ronda; la scala è un ostacolo per chi cammina; scala di legno e battente bruciano (la scala bruciata si ricostruisce); i civili richiamati salgono la rampa a vista prima di entrare. L'ariete non arriva al battente (scelta in D-MASTIO-01).
- Quarta tappa: gli assalitori prendono il mastio con una scala d'assalto alla porta; il battente alzato ha resistenza 60 e cade a colpi d'ascia (o bruciato); chi entra lascia il campo e il mastio risulta violato.
- Terza tappa: il mastio non ha porte sul cammino di ronda; il battente bruciato lascia il vuoto; con scala o battente bruciati gli occupanti calano (e ritirano) una scala a pioli dalla porta.

## 2026-11-02 — Garitte e forme delle falde (branch `feature/bartizans`)

- Torri grandi (T3) quadrate e rotonde in pietra: quattro garitte d'angolo su mensole, merlate o con guglia e bandiera; 3 tiratori per garitta che colpiscono anche il piede della torre fino a 1U. Torri quadrate col tetto a falde: piramide, 2 falde con timpani o 4 falde con colmo lungo metà del tetto (solo estetica, stesso costo; con il colmo due bandiere). Stato e prove in [STATUS](STATUS.md). ROADMAP invariata; DECISIONS invariate: due nuove varianti del tipo `tower`, nessun tipo nuovo.

## 2026-11-02 — Muri sui pendii (branch `feature/walls-on-slopes`)

- I muri si possono costruire sui pendii secondo lo spessore (T1 dolci e scoscesi, T2 dolci, T3 solo in piano) e il muro stesso diventa una scala (una pedata ogni 0,12U) col parapetto merlato che corre accanto, come sulle mura di Sintra. Corretta anche la quota del crollo dei muri su terrazze alte. Stato e prove in [STATUS](STATUS.md). ROADMAP invariata; DECISIONS invariate (regola di posa e disegno dei muri esistenti, nessun tipo nuovo).

## 2026-10-30 — Porta piccola (branch `feature/small-gate`)

- Seconda taglia della porta in pietra: 1×1U, L1–L2, altezze 2,4 / 3,6, costo ×0,6. Portale, ante, grata, torce, stendardi, merli e tetto in scala con la fronte; il corpo di porta 1,5U resta invariato. Stato e prove in [STATUS](STATUS.md). ROADMAP invariata; DECISIONS invariate: nuovo valore di `size` del tipo `gate`, nessun tipo nuovo.
- 02/11: piano alto a graticcio per la porta piccola L2 (legno e intonaco come le case, a sbalzo, costo L1 + 8 oro e 18 legno), falde della porta piccola girate (timpani sui fianchi), cutaway di tutte le porte con le due facce verso la camera aperte.

## 2026-10-30 — Semitorri e torri a D (branch `feature/half-d-towers`)

- Due nuove forme di torre in pietra, orientate verso l'esterno: semitorre aperta alla gola (piccola/media) e torre a D (media/grande). Si agganciano alla fine di un muro con il retro sul muro e, sui fianchi di una porta, formano la porta a due torri tonde con il retro allineato. Stato e prove in [STATUS](STATUS.md). ROADMAP invariata; DECISIONS invariate: nuove varianti di `shape` del tipo `tower`, nessun tipo nuovo.
- Semitorre: scala a pioli a ogni piano, attraverso una botola nel solaio, visibile dalla gola aperta.
- Cantiere e crolli: il ponteggio della D segue la sua pianta; monconi e corone spezzate della semitorre restano aperti dietro.
- Cutaway della torre a D con solai, arredi e scale dentro la pianta a D. Costi per forma: tonda ×1,5, D ×1,25, semitorre ×0,5 rispetto alla quadrata.
- Feritoie laterali della D spostate in avanti, sul mezzo tondo: accanto a una porta restano libere.
- Porte in pietra: una fila di finestre per stanza (L1 nessuna, L2 una, L3 due), non più una per livello a partire dal passaggio.
- Porte: finestra sempre sul retro, due feritoie affiancate sul fronte, aperture visibili anche nel cutaway. Finestre notturne di torri e porte: il vetro illuminato segue la sagoma della finestra invece di un rettangolo.
- Cutaway: finestre e feritoie viste da dentro con lo sprite vero invece di quadrati colorati; i solai delle porte si allineano a quelli delle torri che le fiancheggiano.

## 2026-10-30 — Skeleton /march (branch feature/march-skeleton)

- Creata pagina /march/ con demo isolata: click sulla mappa per ordine di marcia, giornate e viveri, quattro feudi statici, razzie parziali e persistenti, inizio assedio, ritirata volontaria, test esito positivo e conquista opzionale. Codice separato tra engine e UI; salvataggio solo dello scenario demo.
- Nuova regressione qa/march-regression.cjs; verifiche rapide di sintassi e percorso deterministico passate in runtime JS isolato; Node, browser e CI ancora da verificare.
- Documentati in docs/march.md limiti e contratto di integrazione: i feudi della demo **non** sono World/Feudal, il tasto d'assalto è un test e non simula Combat/Siege.
- Aggiornata la piramide di contesto nello stesso branch. Nessuna modifica al Builder, al ledger principale o alla produzione su main.

## 2026-10-30 — Audit integrale aggiornato alla HEAD `cf569992`

- Riletto live `main`, tree, 53 branch, PR recenti e CI. Nuova fotografia: [AUDIT-2026-10-30](AUDIT-2026-10-30.md). **Tre PR ancora aperte: #109/#110/#111; #103 Centro di controllo mergiata 30/10**. Nessun test Node/Chromium eseguito nella presente revisione, solo esiti CI/QA già tracciati.
- Corrette due false attività Builder: **P0-04 L1 cantieri e routine** ora core con #98/#99; **P1-11 mercato/ledger e Beni L3** core con #101. Totale **15 core / 8 parziali**, su 23 ID. `workshop` della Built Section ed operatori civici/bonus restano oggetti distinti dalle botteghe e servizi già presenti.
- Registrati come **MERGED** #61 danni, #65 cutaway, #77 cantieri visivi, #78 eventi, #82 Asset Lab audit, #86–108 (UI, 3D, audio, affidabilità, economia in 5 tappe, pannelli, geometrie). Rettificati riferimenti «solo branch» dei rispettivi snapshot datati.
- Riconfermato `mine.good='stone'`, `No automatic surrender in P0`, assenza di `tree depletion`, e `SERVICE_KINDS.income='not-simulated'`. Stock economico e siege separati, correttamente non sommati nel Centro di controllo.
- Aggiornati **feature-backlog**, **STATUS**, **BACKLOG**, **ROADMAP**, **README** e changelog; **DECISIONS invariato** perché non introduce nuovi contratti o scelte di design. Nessuna modifica runtime né merge delle tre PR funzionali aperte.

## 2026-10-29 — Ristrutturazione e restyling del Centro di controllo · branch `panels`

- `settlement-panels.js` riorganizzato: helper condivisi (card, KPI, tabelle, select), un solo motore di grafici SVG con griglia, etichette giorno intere e tooltip per punto; avvisi calcolati una volta per render.
- Correzioni: la sezione scelta resta attiva alla riapertura; il selettore produzione elenca solo i siti del signore (niente linea a 0 per i privati); le barre delle riserve scalano sul massimo tra scorta e target.
- Aggiornamento live tramite `ConquerGame.subscribe` (throttle 500 ms) più heartbeat di 4 s al posto del ridisegno ogni 1,8 s; scroll orizzontale delle tabelle conservato.
- Restyling `settlement-panels.css`: navigazione su una riga scorrevole con badge avvisi, intestazione di sezione, KPI con accento di stato (ok/attenzione/critico), card larghe per grafici e tabelle, intestazioni tabella fisse. Cache `?v=panels-3`.
- QA: `qa/panels-regression.cjs` (+ sezione persistente e selettore solo signore) e `qa/economy-panel-history-regression.cjs` PASS in locale; verifica visiva nel browser con dati dimostrativi, nessun errore in console. CI non ancora eseguita su questo commit.
## 2026-10-29 — Storici gestionali e anteprime visive · branch `panels`

- Campionamento a ogni mercato settimanale nel ledger economico: fino a 26 rilevazioni persistite di popolazione, felicità media e per classe, prezzi, occupazioni L1 e quantità prodotte per attività con proprietà dell'epoca; nessuna retrodatazione per salvataggi precedenti.
- Grafici storici nel Centro di controllo: welfare generale, felicità per classe, mansioni L1, prezzi selezionabili per risorsa, produzione del signore totale o per singola attività. I dati restano nel campo `State.economy` già persistito.
- Regressioni `qa/panels-regression.cjs` e `qa/economy-panel-history-regression.cjs`; screenshot browser via `qa/panels-browser.mjs` e workflow dedicato, con badge **DATI DIMOSTRATIVI**. Non attribuire screenshot fixture a una partita reale.
- QA 29/10: PASS 8/8 check GitHub Actions su `38ea7ab`, inclusi regressione store 26 settimane e screenshot Chromium 9 immagini da fixture dichiarata demo. [Run](https://github.com/erykwest/CONQUER/actions/runs/40800506799). Non ancora su main.

## 2026-10-29 — Centro di controllo degli insediamenti (branch `panels`)

- Creati nove pannelli sotto Profilo (generale, popolazione, economia, proprietà, scorte, militare, cantieri, diplomazia, avvisi), CSS responsive, grafici alimentari da storico settimanale e controlli già supportati dal motore.
- Separati esplicitamente magazzino economico e scorte assedio; organico presente e capacità edifici; valori effettivi e placeholder futuri. Aggiunto test fixture `qa/panels-regression.cjs` e design [management-panels](../management-panels.md).
- Stato: codice sulla branch, non su main. Parsing JS, regressioni Node/CI e acquisizione Chromium PASS; revisione visiva dell'utente ancora attesa. ROADMAP invariata: pannelli di osservazione, non nuove regole economiche.
## 2026-10-29 — Cutaway delle torri piccole con scala a chiocciola (branch `feature/cutaway-spiral-stairs`)

- Le torri T1 in pietra, comprese le sottotorri, si aprono in sezione e mostrano una scala a chiocciola in pietra dalla porta alla cima: tonda nelle torri tonde, quadrata nelle torri quadrate. Stato e prove in [STATUS](STATUS.md). ROADMAP e DECISIONS invariate.

## 2026-10-28 — Sala larga (branch `feature/wide-built-hall`)

- Nuova variante della sezione costruita: larga 2U, H2 di default, solo piano terra a doppia altezza, per sale comuni, cappelle e sale del trono. Finestrone a lancetta modellato in Blender, 5 contrafforti a due stadi tra le lancette, 2 camini, cutaway a piano unico (arredi della libreria cutaway di main). Stato e prove in [STATUS](STATUS.md).
- Fix: i contrafforti delle torri in pietra usano lo stesso profilo a gradoni e non attraversano più le facciate dal retro.
- ROADMAP invariata. DECISIONS invariate: la variante segue il contratto esistente «varianti, non tipi duplicati» (`span` sul tipo `built`).

## 2026-10-29 — Economia, tappa 5: carri, carrozze e carretti sulle strade, cavalli 2D (PR #108)

- I convogli percorrono davvero la rete stradale dal mastio (o dal mercato) al confine con carri, carretti e carrozze disegnati in 2D e cavalli 2D. Scartato il 3D del branch d'origine. Stato e prove in [STATUS](STATUS.md). ROADMAP invariata; D-055 in DECISIONS.

## 2026-10-29 — Parapetto delle merlature (branch `feature/battlement-parapet`)

- Torri, porte e mura in pietra hanno un parapetto continuo tra i merli invece di soli blocchi isolati; le torri tonde hanno più merli (8/12/18). Stato e prove in [STATUS](STATUS.md). ROADMAP e DECISIONS invariate: dettaglio visivo, nessun contratto toccato.

## 2026-10-29 — Economia, tappa 4: un solo sistema di convogli (branch `feature/economy-convoys`)

- Carovane della diplomazia, convogli del mastio, manifesti mercantili e carrozze nobiliari sono un solo sistema (`ConquerConvoys`) che preleva davvero dal castello; corretto il tributo gratuito introdotto con #98. Quattro cartelli di prova sulle arterie e convogli visibili sulla strada maestra. Stato e prove in [STATUS](STATUS.md). D-054 in DECISIONS; ROADMAP invariata.

## 2026-10-29 — Economia, tappa 3: commercio e botteghe L3 autonome (branch `feature/economy-commerce`)

- Il commercio di #55 e l'economia urbana autonoma sono un solo sistema collegato al calendario: le case L3 aprono botteghe da sole, producono Beni L3 venduti il sabato con i prezzi della settimana prima. Stato e prove in [STATUS](STATUS.md). D-053 in DECISIONS; ROADMAP invariata.

## 2026-10-28 — Fortificazioni in legno in 3D (branch)

- Su `feature/wood-fortifications-3d`: vedetta, torri a palizzata, porta in legno e palo di palizzata modellati in Blender (`tools/blender/build_wood_fort.py`) e posati dal nuovo `settlement-wood3d.js`; le palizzate seguono il layout del gioco con camminamento e terrapieno. Il world3d non ridisegna più il legno in 2.5D a ogni frame. Stato e prove in [STATUS](STATUS.md#fortificazioni-in-legno-in-3d-branch-featurewood-fortifications-3d-28102026).
- Cantieri del legno montati pezzo per pezzo (torri, porte, palizzate) invece del fantasma traslucido.
- Bandiere araldiche su torre coperta e vedetta, due drappi ai lati della porta in legno.
- Cutaway della torre a palizzata in legno sul cutaway WebGL di #65: lati verso la camera aperti, pavimento, scala e arredi della funzione. Il fallback WebGL con soldati di ronda, riprodotto qui, è risolto in main da #91 (VAO per programma): il fix locale è stato tolto al merge.
- Asset Lab: legno e palizzate ora con «Modello 3D»; baseline estesa con i 12 render nuovi. ROADMAP e DECISIONS invariate: promozione visiva sullo schema già deciso per i modelli Blender (civili, industrie, assedio), nessun nuovo contratto.

## 2026-10-28 — Cutaway civico: verifica nel Lab e fix delle locande (branch `fix/civic-cutaway-lab`)

- Foglio provini del cutaway di chiesa e locanda (L1–L3, 4 rotazioni) sul palco del Lab: nelle locande la faccia inferiore del primo piano copriva il pianterreno; tolta, con nuovo controllo in `civic3d-regression`. Audit del Lab su `main` senza errori. Stato in [STATUS](STATUS.md#cutaway-civico-e-contorno-di-selezione-su-main-con-90-54a7508-fix-fixcivic-cutaway-lab-28102026).
- ROADMAP e DECISIONS invariate: correzione grafica, nessun contratto toccato.

## 2026-10-28 — Economia, tappa 2: routine settimanali (branch `feature/economy-routines`)

- Uomini e donne L1–L4 hanno la settimana di `jobmanager`: svago maschile dalle 18, mercato il sabato e messa la domenica, lavoro femminile nei lotti. Solo visuale. Stato e prove in [STATUS](STATUS.md). ROADMAP invariata; D-052 in DECISIONS.

## 2026-10-28 — Economia, tappa 1: lavoro L1 e cantieri (branch `feature/economy-labour`)

- Portata su `main` la parte economica di #55 (bilancio settimanale, fondazione con 4 L1, Builder che paga dal castello, cantieri a giornate-operaio pagati dal signore) unita a `jobmanager` (pastori protetti, taglio legna, razioni, felicità per ceto) in un solo allocatore L1. Stato e prove in [STATUS](STATUS.md). Nuove decisioni D-047…D-051 in [DECISIONS](DECISIONS.md#economia--lavoro-l1-unico-28102026); ROADMAP invariata.

## 2026-10-28 — Rendering: niente più picchi dal terreno 3D e dalla nebbia (branch `perf/render-spikes-v2`)

- Una modifica a strade, campi, case o lotti ricuoce solo le tessere da 512 px toccate, una per frame, invece delle due texture 4096² del terreno. Terraforming, stagione, rilievo e foreste rifanno ancora tutto. La nebbia di combattimento rifà il raycast ogni 12 s solo se il contenuto è cambiato. La telemetria remota dice quale renderer è attivo (evento `RENDERER`). Misure e confronti in [STATUS](STATUS.md#rendering--picchi-del-terreno-3d-e-della-nebbia-branch-perfrender-spikes-v2-28102026): P95 del frame dopo una modifica dimezzato (115 → 56 ms).
- Corretto un bug: strade e campi del terreno 3D ricevevano l'indice dell'array come `preview`; l'aspetto resta quello di prima.
- ROADMAP e DECISIONS invariate: ottimizzazione di rendering, nessun contratto toccato. Sostituisce il branch `fix/render-spikes`.

## 2026-10-28 — Giunzioni delle sottotorri (branch `fix/cutaway-junctions`)

- Dopo il merge di #65, portate su `main` le tre correzioni rimaste solo sulla vecchia branch `feature/cutaway-furniture`: porta sul tetto della sottotorre più bassa, niente merli sepolti nella struttura attaccata più alta, niente drappo sul mastio in cutaway. Stato e prove in [STATUS](STATUS.md).
- ROADMAP e DECISIONS invariate.

## 2026-10-28 — Occlusione 2.5D: sagome sovrapposte (branch `fix/occlusion-clip-union`)

- Ripresa da #18 (visual-qa) ed estesa a tutte le 6 funzioni di occlusione: un clip per sagoma invece di un unico percorso even-odd. Stato e prove in [STATUS](STATUS.md#occlusione-25d--sagome-sovrapposte-branch-fixocclusion-clip-union-28102026-da-18). Il runner a scene intere di #18 resta nel BACKLOG; #18 viene chiusa. Riconciliazione branch del 28/10: chiusi senza porting `assedio`, `combat`, `feature/landscape-forests`, `fix/forest-water-road-routing-20261014`, `docs/context-sync-pr-governance-20261021` (superati da `main`; commit conservati nei tag `archive/*`).
- ROADMAP e DECISIONS invariate.

## 2026-10-28 — Salvataggi sicuri (branch `fix/save-safety`)

- Ripresa da #16 (audit-hardening) solo la parte salvataggi: autosave che non si interrompe con lo storage pieno e minimo 10000 risorse al caricamento limitato a DEV. Telemetria esclusa per scelta. Stato e prove in [STATUS](STATUS.md#salvataggi-sicuri-branch-fixsave-safety-28102026-porting-parziale-di-16). La PR #16 viene chiusa.
- ROADMAP e DECISIONS invariate.

## 2026-10-28 — Capitano, cavalieri e diplomazia portati su `main`, solo 2D (sostituisce PR #72)

- Il gameplay della PR #72 (`feature/knights-messenger-caravans`, che contiene `knights`) è portato in modo selettivo su un branch nuovo da `main`: capitano distinto dai cavalieri, cavalieri a cavallo limitati da stanze nobili e scuderie, messaggero periodico con richiesta di tributo e pianificatore di carovane, `State.diplomacy` salvato. Comandi nella UI v2 (Difendi › Pattuglie, Gestisci › Scorte del castello). Stato e prove in [STATUS](STATUS.md).
- Scartate le figure 3D della PR #72 (modelli Blender di cavalieri, `ConquerKnights3D`, stile «flat» delle mesh): cavalieri e messaggero usano il cavallo 2D approvato. Nuova decisione [D-046](DECISIONS.md#cavalieri-e-diplomazia-pr-72-portata-su-main-in-2d-28102026). ROADMAP invariata.

## 2026-10-28 — Cutaway arredato riallineato a `main` (PR #65)

- Merge di `main` `1194f5e`: il cutaway arredato del castello e il cutaway civico (#90) disegnano insieme in WebGL2; strade alle porte secondo la logica di main (`gateRoadPort`), test del branch adeguato. Baseline dell'audit del Lab con i 4 nuovi cutaway delle porte in pietra. Stato e prove in [STATUS](STATUS.md).
- ROADMAP e DECISIONS invariate: nessun contratto cambiato.

## 2026-10-21 — Cutaway arredato e WebGL2, branch di convergenza

- Integrati catalogo mobili generato da Blender, disposizione funzionale delle stanze e arredi non sovrapposti, mantenendo le postazioni degli arcieri e il corridoio delle porte.
- Aggiunti interni depth-tested nel renderer WebGL2 con mesh separate per ambienti, guscio e superfici luminose, cache su rotazione, pass notturno e fallback Canvas.
- Contenuti della vecchia branch `feature/cutaway-furniture` portati su `feature/cutaway-furniture-converge` aggiornata con le novità Terraforming di `main`. PR #65, GitHub Actions suite integrale [#39508539592](https://github.com/erykwest/CONQUER/actions/runs/39508539592) **PASS**, CAMP e Builder PASS. Validazione visuale browser ancora aperta.

## 2026-10-28 — Audio e colonna sonora stagionale (branch `sound`)

- Branch del 17–19/10 riallineato a `main` `5ddefa6` (350 commit): mixer Web Audio a 4 livelli, ambiente da stagione e meteo, suoni degli edifici vicini, 9 brani stagionali; controlli nel pannello DEV, audio spento di default. Stato e prove in [STATUS](STATUS.md#audio--mixer-a-4-livelli-e-colonna-sonora-stagionale-branch-sound-1719102026-riallineato-2810).
- ROADMAP e DECISIONS invariate: presentazione, nessun contratto di simulazione toccato.

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


### CIRCLE — 2026-10-28
2026-10-28 — `circle` branch: add isolated defensive-compartment model and QA fixture. Not integrated in gameplay; QA not executed.


### 2026-10-29 — CIRCLE — branch `circle`
- Motore di riconoscimento topologico indipendente dalla navigazione: rasterizza mura/palizzate/torri/porte/built sections realmente costruite e ostacoli naturali effettivamente invalicabili. Identifica cerchie e compartimenti laterali, profondità, portali e ingresso del Mastio. Tiene aperta la distinzione tra accesso e conquista.
- Hook runtime `window.ConquerCircle`, caricamento in `index.html`, invalidazione su variazioni topologiche e cantieri completati, test topologia 11/11 e adapter runtime 5/5 PASS nel harness JavaScript isolato.
- Limitazioni: non cablato a IA civile, occupazione militare, scorte economiche reali o overlay; test browser/Node CLI non eseguiti; `main` invariata.


### 2026-10-29 — /circle — stati militari dei compartimenti (branch `circle`)
- Introdotto `src/circle/defensive-control.mjs`, valutatore deterministico di `secure`/`alert`/`threatened`/`infiltrated`/`invaded`/`contested` basato su nemici e difensori presenti realmente, inclusi combattimenti sui camminamenti. `captured` non viene attribuito automaticamente.
- Collegato a `ConquerCombat` via `window.ConquerCircle`; aggiornamenti periodici e su modifiche esplicite, transizioni evento, riepilogo nel pannello Combat. Corretta sincronizzazione quando si cancellano i nemici o si disegnano allarmi a gioco fermo. Allineato il vocabolario degli stati dello skeleton. `ConquerSiege.breach` segnala il segmento a `ConquerCircle.markBreach`: il vecchio settore rimane temporaneamente `compromised` (non conquistato), può diventare `invaded` e ritorna settore ordinario dopo la ricostruzione; salvare l'identità tra sessioni resta fuori scope.
- Verifiche: 43/43 test isolati PASS e parsing JS dei moduli runtime; Node CLI e prova browser NON eseguiti. Nessuna modifica a `main`.


### 2026-10-29 — /circle: conquista e approvvigionamenti (branch `circle`)
- Integrati `src/circle/defensive-logistics.mjs`, `ConquerCircle.tickOccupation` e `ConquerSiege.captureCircleSector/releaseCircleSector/circleStoreInventory`: conferma conquista dopo 0,5 giorni di controllo nemico incontrastato; riconquista simmetrica dopo 0,5 giorni in controllo difensore.
- Magazzini veri delle strutture fortificate: deposito prioritario all'interno, materiali con capienza condivisa, riserva globale `siege.stock` autoritativa; perdita one-shot per ogni stanza in compartimento conquistato; riconquista non rimborsa i viveri persi. Capacità delle stanze conquistate sospesa. Facciata interna delle `built` usata per assegnare il settore.
- Salvataggi: record di cattura e stanze perdute all'interno di `State.siege.circle`; ripristino in `ConquerSiege.restore`, compatibile con il payload locale/cloud. La mappa riporta i compartimenti conquistati anche dopo salvataggio di una breccia; una suddivisione successiva non segna automaticamente tutti i settori eredi come conquistati.
- QA: 65/65 test isolati PASS inclusi i moduli veri di assedio e controllo, syntax checks PASS; Node nativo, CI e test browser ancora non eseguiti. `main` invariata.


### 2026-10-29 — CIRCLE QA GitHub Actions
- Creato workflow `.github/workflows/circle-regression.yml` per test Node.js 22 e syntax checks ad ogni push rilevante su `circle`. [Run #40912609993](https://github.com/erykwest/CONQUER/actions/runs/40912609993) su codice `68533977`: **PASS 65/65 test**. Restano da eseguire smoke test browser/UI e profiling dinamico.


## Campi L2 — 05/11/2026

Branch fix/fields-l2-only — scelta utente campi solo L2, sincronizzazione ledger e figure, regressioni su esclusione L1 e prenotazioni L2. Chiusura residuo jobmanager e pulizia dopo merge.
