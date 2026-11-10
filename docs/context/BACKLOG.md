# Livello 4 — Indice dei requisiti e backlog inter-sistemi

10/11/2026 — REG-WATER-INTEGRATION: allineato il branch sperimentale a main 89e7a2c per risolvere i conflitti della PR e riattivare CI. Preservati Codex, palette Stonecolor, reset Haulage e isolamento completo delle demo nella persistenza. Risolti i renderer mantenendo facce montane ritagliate e fallback della palette. QA locale: regional-demo, hydrology-network, Stonecolor, Haulage (10), Builder menu, stockyard (8), coast, asset-catalog e save-safety PASS. Nessun merge del lavoro regionale in main.

09/11/2026 — REG-WATER-NETWORK (branch): Mare e Lago non selezionabili, neanche via Shift o URL regionale; selezione eliminata se diventa acqua. Scelte locali nuove limitate a Pianura/Foresta/Montagne/Palude; bioma ereditato bloccato nelle mappe aperte dalla regione. Colline/Valle/Fiume/Mare/Lago restano solo compatibilita delle vecchie ricette/demo. Foci geometriche con sbocco reale nel mare o lago, distinto dagli stagni; confluenze fiume/fiume, torrente/fiume e torrente/torrente con endpoint condiviso, sponde e collisioni aggiornate. I nodi regionali a grado >=3 producono affluenti, le curve a grado 2 no. Idrografia prioritaria rispetto ai rilievi nelle nuove mappe regionali. Cinque demo URL e regressioni runtime/browser PASS. Palude resta da bilanciare quantitativamente, mantenendo per ora i valori esistenti.

06/11/2026 — REG-MOUNTAIN-UNIFORM-FIX: riprodotto T297 della regione 1988, seed locale 1555837107, centro e otto campioni tutti Montagne. Il controllo active() disattivava erroneamente la composizione regionale quando tutti i biomi erano uguali, ripristinando la catena legacy su un breve arco. Il contesto montano completo ora compone sempre centro e otto settori. Test dedicato fallito prima della correzione, poi PASS per tutti gli otto settori, centro e ripetibilita; PASS anche surroundings e mountain-density. Mappe prive di contesto regionale completo restano sulle proprie ricette demo.

06/11/2026 — REG-MOUNTAIN-VARIATION (branch): eliminata la posa fissa a doppietti. Cime distribuite lungo tutta la catena con jitter e basi variabili; limitrofi con sagome indipendenti e distanze 6–15 U, fallback compatto solo per vincoli acqua/bioma. Quantita raddoppiata e intersezioni mantenute. Intervallo pendenze ampliato da 40–60 a 37–63 gradi, raggi principali da .52–.60/.54–.62 a .48–.64/.49–.66 settori: maggiore delta di altezza conseguente. QA spaziatura irregolare, densita, intersezioni, tagli e determinismo PASS.

06/11/2026 — REG-MOUNTAIN-DENSITY (branch, non main): raddoppiate le cime principali dei settori montuosi con coppie intersecate (Montagne 8–14, Valle 6–10) e mantenute le secondarie proporzionali. Limitrofi: seconda cima per ogni massiccio accettato, fianchi sovrapposti e apici distanziati (base annidata solo in spazi vincolati); fascia esterna portata al bordo. Non si scartano piu i rilievi che oltrepassano il mondo: impronta collisioni ritagliata e facce roccia/neve tagliate in XYZ con sezioni verticali, condivise da 2D e World3D. Outline originale conservato per quote dei pini. QA densita/intersezioni/tagli/determinismo PASS; demo seed 4242: centrali 4→8 principali, limitrofi 9→18. Audit Territorio: 12 render, zero errori/cambiamenti, cinque avvisi di schemi illustrativi; confronto montano reale eseguito nella demo.

06/11/2026 — REG-DEMO-OVERLAY: rimosso su richiesta il pannello sovrapposto con selettore scenari e metriche. Le demo restano accessibili dai link, isolate dai salvataggi; ritorno regionale tramite il collegamento esistente nell’header.

06/11/2026 — REG-COAST-SHAPES (branch sperimentale): coste deformate in base ai lati cardinali di mare: 1 golfi ampi, 2 adiacenti promontorio roccioso e due fronti a golfo, 3 penisola collegata al lato asciutto, 4 isola con angoli raccordati. Due lati opposti restano due fronti a golfo, senza falso promontorio. Fasce e corner diagonali preservati; geometria condivisa da acqua, rendering e collisioni. Minimappa corretta per i fori terra e le radure, verifica pixel terra/mare PASS. Browser: quattro scenari e selezione mare PASS (eventi DOM). Quattro scenari selezionabili nel pannello demo (gulf/headland/peninsula/island). Mare escluso da clic/Shift e apertura locale; conversione di selezione a mare ripulisce selezione e pannello. QA quattro casi, variazione costa >7 U, rocce, connessione penisola e isola con foro PASS.

06/11/2026 — REG-EIGHT-BIOMES (branch sperimentale, non main): apertura regionale con otto campioni direzionali sulla geometria Voronoi reale. Fasce 25/25/100/25/25 U, corner esterni 25×25 del diagonale e blending a prodotto. Composizione ingame di suolo, boschi, acqua con isole/fori e rilievi; il centro usa la propria ricetta. Fiumi esistenti preservati. Uscite marittime campionate su tutti i settori acqua; compatibilita costa principale mantenuta. Demo Fronte misto disponibile; test determinismo, collisioni, pesi e diagonali PASS. Cache world: mantenuto il prefisso contrattuale bridge-magnet-1 con nuovo suffisso. Browser Chromium: campionamento di tutti i 630 territori PASS, demo mista e apertura da regione verificate. Bilanciamento quantitativo e dorsali continue restano aperti. Le vecchie demo senza campioni vanno riaperte dalla regionale.

05/11/2026 — REG-CENTRAL-BIOME: corretto il bioma centrale in apertura dal territorio. Regole condivise: plain→Pianura, forest→Foresta, hills regionale→Montagne, sea→Mare, swamp→Palude, lake→Lago. Fiume di confine aggiuntivo, non sostitutivo del bioma. Contesto portabile nel link, session storage opzionale; dati mancanti mostrano errore, mai Pianura implicita. Scope scelto: prima il bioma centrale, otto influenze rinviate. QA mapping, ricette e trasferimento tra schede PASS.

05/11/2026 — REG-SINGLE-CELL: correzione della rimozione incompleta dei raggruppamenti. Una cella Voronoi = un territorio: dettaglio fisso 1, pesi territoriali tutti 1; isole ricavate cambiando terreno della singola cella, senza fusioni o territori vuoti. Validazione finale dopo isole/laghi. QA browser su seed 1943/42/229/4242: 630 celle = 630 territori = 630 etichette. Recuperati otto SVG Mountain 1–8 da ARQE nel percorso ICON del repository; tutte le risposte HTTP 200. Vecchie mappe aggregate rigenerate con messaggio esplicito; modifiche associate alla vecchia topologia non riapplicate a ID diversi.

05/11/2026 — REG-NOSUPER: rimossi i raggruppamenti geografici di supercelle dal World Lab: comandi unione/separazione, aggregazioni automatiche dei laghi, nomi/contorni aggregati ed export superCells. Ogni territorio resta indipendente. Import JSON e ritorno dalle demo ignorano i vecchi gruppi, preservando i territori. Selezione multipla per modifica e domini politici restano separati da questo raggruppamento geografico.

05/11/2026 — REG-DEMO: Builder → Mappa regionale → selezione territorio → Apri mappa locale del territorio. Demo isolate senza lettura/scrittura della partita o cloud, seed ripetibile derivato da regione/territorio, ritorno alla stessa regione e selezione. Scenari Pianura/Colline/Foresta/Fiume/Montagne/Costa con ricette attuali e misure di copertura mappa/buildable su griglia 40×40, conteggi delle componenti. Bilanciamento quantitativo ancora da decidere dopo revisione. I confinanti reali sono esposti come contesto; composizione a otto biomi non ancora nel Builder.

05/11/2026 — REG-BIOME-RIVER3: traslazione rigida del fiume generato di 15 U verso il centro lungo la normale del lato selezionato. Forma, raggi e parametri del seed preservati. Offset applicato dopo selezione del candidato per evitare cambi di forma. Nuove mappe/rigenerazione, salvataggi esistenti preservati.

05/11/2026 — REG-BIOME-RIVER2: sostituite le quattro anse Bezier identiche con integrazione della direzione lungo la lunghezza del corso. Raggio delle singole anse 2–3 larghezze, aperture e lunghezze variabili per seed, geometria arrotondata ispirata a Leopold/Wolman e al riferimento fornito. Test precedente: solo 2 forme dopo aver rimosso rotazioni; nuovo test: almeno 60 forme su 64 seed. PASS 64 mappe runtime, 2.000 curve, 42 mappe biomi e save-safety. Penetrazione minima 25 px sul riferimento preservata. Nuove mappe, salvataggi esistenti non rigenerati.

05/11/2026 — REG-BIOME-RIVER ingame su `experiment/regional-biome-sectors` (NON MAIN): `makeEnvWater` genera i nuovi fiumi sul perimetro buildable con quattro ampie anse alternate, penetrazione interna 12 U (36 px riferimento 600 px). Acqua reale nei renderer e nei vincoli di costruzione. QA 42 mappe biomi, 64 mappe fiume con collisioni/determinismo, 36 urban checks PASS. Mappe salvate preservate; applicazione alle mappe rigenerate. Gli otto biomi e le dorsali della fixture non sono ancora integrati nel Builder.

05/11/2026 — Correzione REG-BIOME-PREVIEW: le anse fluviali devono penetrare nella buildable zone. Ampiezza fluviale 24 U dalla direttrice esterna a 12 U dal bordo: penetrazione 12 U, pari a 36 px sul canvas di riferimento 600 px (minimo richiesto 25 px). Dorsale invariata esterna. Verificati tutti gli otto percorsi con entrambi i versi del seed.

05/11/2026 — REG-BIOME-PREVIEW: fiume e dorsale come spline di confine separate dai biomi. Meandri fluviali ampi, dorsale più lineare; otto percorsi per elemento (lati e raccordi ad angolo), ingressi/uscite sul bordo mappa. Rimosso il canale baricentrico del bioma Fiume. QA 16 percorsi: continuità, ripetibilità, estremi e assenza di attraversamento del centro. Quote, foce e collisioni tra elementi ancora aperte; nessuna integrazione Builder.

05/11/2026 — REG-BIOME-PREVIEW: otto ingressi direzionali configurabili, corner esterni 25×25 U al 100% del bioma diagonale; blending a prodotto nelle fasce da 25 U, centro 100×100 U preservato. I diagonali possono essere mare o terra indipendentemente dai lati. Campionamento Voronoi reale ancora aperto; fixture separata dal Builder.

05/11/2026 — Aggiornamento REG-BIOME-PREVIEW su `experiment/regional-biome-sectors`: fasce fisse 25/25/100/25/25 U, blending smoothstep e corner continui con centro + due vicini; centro invariato, collegamento regionale ancora aperto. Verificati pesi, estremi delle fasce e continuità ai corner. Prova separata dal Builder.

05/11/2026 — REG-BIOME-PREVIEW: prova cartografica disponibile su `experiment/regional-biome-sectors`, da valutare visivamente. APERTO: ereditare tutti i confinanti Voronoi (numero variabile), ripartirli lungo i lati, raccordare acqua/quote e integrare il generatore. [Specifica della prova](../REGIONAL-BIOME-SECTORS-PREVIEW.md).

## 2026-11-09 — P2.4 · Responsabilità unica test CI sovrapposti

- **INTERVENTO CODICE:** rimossi nove comandi ripetuti in tre workflow specialistici, trasferendo l'ownership esclusiva a Runtime integrity (Codex, 6) e Settlement routing/spawn (regressioni routing, 3). Nessun test o script eliminato.
- **INVARIATI:** browser Wiki/Builder, browser Main fixes, WebGL e camp gameplay; duplicazioni tra workflow con filtri non sovrapponibili mantenute deliberatamente.
- **PROSSIMO:** validare guard/Actions e confrontare tempi di PR future. Non coinvolto il P2.2 di protezione main, precedentemente sospeso.


## 2026-11-09 — BC-261109-02 · DEV Free/Fast e upgrade temporizzati

- **Riesame CI:** fixture browser d'assedio aggiornata a Fast a pagamento per preparare la porta completa; verificata anche l'allocazione Fast dallo stock provvisorio prima della fondazione. Il comportamento normale resta temporizzato.

- **SU BRANCH `fix/upgrades-dev-build`:** Free build e Fast build separati nel pannello DEV; cantieri per upgrade di strutture, case, civici e accessori edilizi con preventivi già definiti; annullamento reversibile e stato persistente.
- **REGOLA CASE:** ogni cambio di livello attraversa il cantiere, incluse case automatiche. Condizioni e job di promozione autonoma scorporati, da decidere nella chat dedicata.
- **QA:** nuove regressioni dominio/browser locali PASS, regressioni geometriche di accessori aggiornate per usare il vero runtime in modalità Fast a pagamento. Verifica CI richiesta prima di main. Politiche feudali globali di merli/pendenza tetti e riparazioni restano comandi dei rispettivi sistemi.


## 2026-11-09 — BC-261108-01 · Accettazione aggiornata PR #186

- Implementati e provati localmente equità per risorsa a pari priorità, residui senza starvation, consumo distinto dalla consegna e rimborso del solo non consumato. Quote e avanzamento conservati nei salvataggi, inclusi pozzi e frammenti.
- Browser UI1/UI2 e regressioni locali PASS; verifica Actions sul nuovo head richiesta prima dell'integrazione. ROADMAP M0–M5 invariata.


## 2026-11-08 — BC-261108-01 · Cantieri finanziati progressivamente

- **IMPLEMENTATO SUL BRANCH `feature/construction-staged-priority-20261108`:** il vincolo di piazzamento resta soltanto geomorfologico/spaziale. Un preventivo anche superiore alle scorte non blocca la conferma. Il cantiere persistente riceve porzioni di materiale in ordine **Molto basso / Basso / Medio / Alto / Molto alto / Critico** (massima classe prima); a parità vince il più anziano, poi ID. I materiali già destinati non possono essere spesi due volte; il lavoro procede solo in proporzione alle risorse consegnate e ai costruttori L1 disponibili.
- **UI:** inspector di cantiere provvisorio, separato dai controlli dell'edificio completato: barra del progresso, dettagli consegnato/totale, selettore di priorità, indicazione attesa materiali/manodopera. Integrazione UI originale + UI2; pannello Cantieri del Profilo non sostituisce l'inspector.
- **RETROCOMPATIBILITÀ:** i cantieri V2 precedenti non riacquistano i materiali; un nuovo cantiere restituisce in demolizione solo il consegnato. Per edifici ultimati e upgrade storici resta il modello preesistente; non è inclusa una logistica fisica con carrettieri per ogni partita di materiale.
- **QA / ACCETTAZIONE IN SOSPESO:** regressione Node inserita in Runtime integrity, ancora da verificare in CI e nel browser (salvataggio, priorità concorrenti, UI2, low/no stock, ripresa dei lavori, geometria/assedi).


## 2026-11-09 — MIL-RES-01 · Caserma, riserva di soldati, pattuglie, vedette e Avamposto

**IMPLEMENTATO SU BRANCH `feature/caserma-avamposto`, NON MERGE.** Specifica approvata dal product owner il 09/11/2026 (sotto), implementazione confermata lo stesso giorno. Decisione [D-MIL-RES-261109](DECISIONS.md). Sostituisce le voci «Corpo di Guardia» e «Avamposto» del catalogo edifici. Dettagli tecnici e prove in [STATUS](STATUS.md).

- **APERTO (dopo questa tappa):**
  - Bilanciamento: ingaggio 15 oro, paga L2, avamposto 60 oro / 40 pietra / 20 legno / 4 giorni, pira 30 legno, velocità della staffetta 2,6 U/s.
  - La ronda segue le strade completate dentro la Yellow Zone: va allineata con le pattuglie assegnate ai settori CIRCLE (#192), oggi sono due modi distinti.
  - Le unità squadra/capitano di partenza e gli arcieri delle torri non pescano ancora dalla riserva (gli arcieri restano gratuiti).
  - La vedetta si vede solo sui terrazzi aperti; sotto un tetto a falde sta dentro la stanza in cima.
  - Ordine pubblico: la guardia cittadina del Municipio e le ronde non alimentano ancora CRIME (C-01).
  - Spedizioni: `reserveExpedition` / `releaseExpedition` pronte, nessun chiamante finché MARCH non è collegato.
  - Rintocco udibile della campana e crepitio del fuoco: nessun suono.

1. **Il Corpo di Guardia si fonde nella Caserma.** `guard` esce dal castello (torri, porte, sezioni costruite, `PORTICO_FUNCTIONS`) e resta solo in `TOWNHALL_FUNCTION_CATALOG` come guardia cittadina per CRIME. Aggiornamento distruttivo (fase di test): le stanze `guard` del castello si svuotano al caricamento.
2. **Una sola riserva di soldati: i posti della Caserma** (`barracks`, 16 per unità di stanza). I soldati sono uomini adulti L1 arruolati dal giocatore fino ai posti liberi; escono dal lavoro L1. Ingaggio **15 oro**, paga giornaliera da **L2** dall'oro del castello (stesso schema di `ConquerInfirmary.pay`). Senza paga non prestano servizio: pattuglie e vedette rientrano. Cibo come oggi (0,22 al giorno).
3. **I soldati sono una valuta:** ogni soldato è libero o impegnato in pattuglia, vedetta, presidio di Avamposto o spedizione.
4. **Pattuglie: 2 soldati della riserva, partono dalla Caserma.** Due tipi: **esterna** sul bordo della White Zone (quella attuale) e **ronda** lungo le strade della città. Se una pattuglia avvista nemici scatta l'**allarme automatico** (campana, `ConquerAlarmBells`). Da allineare con l'assegnazione a zona di MIL-CIRCLE-02 (#192): la ronda può coincidere con una pattuglia assegnata a un settore CIRCLE interno.
5. **Vedette: 1 soldato su una torre.** **Senza vedetta una torre non osserva** (restano la vista delle unità e quella base); con la vedetta vede come oggi (`16 + 4 × altezza` U, un terzo di notte) e dà l'allarme automatico quando avvista nemici. Figura visibile sul tetto. Cambia l'equilibrio attuale, in cui ogni torre finita vede gratis.
6. **Avamposto: upgrade a pagamento di una torre isolata** (staccata dalle mura, fuori dalla White Zone, dentro l'area edificabile; ammessa la W2 H4). Costo provvisorio 60 oro + 40 pietra + 20 legno, 4 giorni. Presidio fisso di **4 soldati e 1 cavallo** presi dalle riserve, vedetta sempre in servizio; senza soldati o cavallo disponibili l'Avamposto resta inattivo.
7. **Avvisi dall'Avamposto al castello:**
   - **Campana** (upgrade esistente dei tetti a falde).
   - **Fuoco di segnalazione** (nuovo): upgrade dei tetti piani merlati, una pira grande, diversa dal braciere attuale. Passa l'allarme a catena come la campana con **raggio triplo**; si accende **una volta sola**, poi la pira si ricostruisce in cantiere (30 legno).
   - **Staffetta a cavallo** lungo la strada fino al castello: l'allarme scatta all'arrivo.
   - **Esclusi:** piccioni (Colombaia), cambio cavalli per i corrieri diplomatici, Stazione di Posta.
8. **Spedizioni militari:** solo contratto. Prenotano soldati dalla riserva e li restituiscono al rientro; la meccanica resta a MARCH.

**Asset nel Lab:** modello della pira, figura della vedetta sul tetto. **Dettagli lasciati all'implementazione:** la Caserma non entra sotto il portico (restano stalle, officina degli armaioli, magazzino); la vedetta si può mettere su qualunque torre finita. **Chiude:** il seguito della Colombaia «avvisi rapidi tra avamposti e castelli».

## 2026-11-09 — MIL-CIRCLE-02 · Zone CIRCLE e macrostrutture difensive

- **SU BRANCH:** sostituisce il roster piatto delle torri di MIL-PG-01 con **zone difensive CIRCLE → macrostrutture**. Ogni torre madre (`parentTowerId`) integra sottotorri dirette e annidate in **una sola riga**, sommando capienza, assegnati e operativi senza contare due volte. Si assegnano arcieri sia a livello settore sia a livello macrostruttura, reindirizzando i comandi ai singoli slot Siege.
- **PATTUGLIE:** la White Zone resta riserva. Comando di assegnazione a zona sposta una pattuglia esistente e la fa pattugliare i punti percorribili di CIRCLE; il richiamo la rimette sul perimetro White Zone. L'assegnazione persiste nel save Combat; settori invalidi vengono rilasciati senza inventare zone.
- **ACCEPTANCE APERTO:** regressioni GitHub Actions, prova browser e test in partita con castelli annidati, accesso di pattuglie a zone recintate complesse. Non incluso reclutamento automatico di guarnigioni o ridefinizione della topologia CIRCLE.


## 2026-11-09 — JM-L2-01 + MIL-PG-01 · Sottopalette di gestione

- **JM-L2-01 IN BRANCH:** Job Manager suddiviso in L1/L2. Produzioni L2 (campi, cava, miniera) ordinate per priorità drag-and-drop, minimo e AUTO/manuale. Rispetta limiti della manodopera L2 e cicli stagionali; le modifiche sono indipendenti dal roster L1 e persistono nel medesimo save economico. Test `qa/labor-jobs-regression.cjs` estesi.
- **MIL-PG-01 IN BRANCH:** Militare → Pattuglie e guarnigioni, con gestione pattuglie perimetrali Combat, arcieri nelle torri in `ConquerSiege` e squadre caserma attraverso `ConquerCamp` nella sola modalità `/camp`. Guardie decorative ai cancelli e ai camminamenti non diventano fittizi posti di lavoro/combattenti.
- **ACCEPTANCE APERTO:** Actions, prova UI L2 e guarnigioni in browser e controllo nel gioco reale. Non incluso: nuove formazioni, trasferimenti individuali tra caserme, assunzioni a pagamento o simulazione nuove unità.


## 2026-11-09 — JM-L1-01 · Gestione priorità produttive dei popolani L1

- **IN BRANCH:** ordinamento drag-and-drop e su/giù delle mansioni L1; «Minimum worker» numerico; toggle AUTO/manuale, stato del personale e segnalazione dei minimi non soddisfatti.
- **ACCEPTANCE CORE:** due passaggi per i posti (minimi in ordine di priorità, poi eccedenza ai job AUTO in ordine); manuale non assorbe eccedenze; coerenza con pastori/pescatori riservati, carrettieri, cantieri navali e cantieri manuali. Dati persistiti in `State.economy`; risparmio sul legacy finché non si agisce.
- **PROVE/RESIDUI:** regressioni `qa/labor-jobs-regression.cjs` e `qa/panels-regression.cjs` ampliate; sessione JS PASS; attendere CI PR, verifica browser del DnD/mobile e comportamento reale durante il cambio del turno. Fuori scopo assegnazioni L2–L4 e reintegro forzoso di pescatori/pastori.


## 2026-11-09 — Riconciliazione con GitHub (ref `main` `e63f729`)

> **Prevale sulle diciture «SU BRANCH / NON MERGE / pre-merge» delle sezioni sotto.** Verificato con `gh pr list` il 09/11/2026. I requisiti APERTI delle singole sezioni restano validi: cambia solo dove sta il codice.

**Già in `main` (merged), anche se le sezioni sotto dicono «branch»:**

| Area | PR |
|---|---|
| Stanze e funzioni del castello | Colombaia #142 · Infermeria #143 · Cisterna #144 · ROOM_EXTERIOR + Latrina W1 #146 · Latrina nelle torri W1 #155 · Campana d'allarme #148 · Scuderia militare #149 · Falconiera e Prestigio #164 · Cucine solo nelle sezioni #140 |
| Castello e Builder | Cutaway per piani #138 · Portico W1 #147 · Mastio W4 #151 · Long house #154 · Pendenza tetti 30/45/60° #157 e 75° #168 · Scale ai camminamenti #172 · Merlo doppio #170 · Edifici addossati alle mura #169 · Torre W2×H4 #174 · Torre lignea H2 #175 · Rampe e scalinate #173 · Orto di corte #171 · Ballatoi #134 |
| Castello (30/10–03/11) | Semitorri e torri a D #114 · Porta piccola #116 · Muri sui pendii #118 · Garitte e falde #119 · Ingresso rialzato del mastio #120 · Stili di merlatura #115 |
| Civili e città | Municipio e gilda #113 · Più pozzi #111 · Case 3D L1–L4 #136/#141/#145 · Camino L1 #156 · Botteghe L3 cutaway #135 · Incendio case #137 · Piazzale e taglialegna #166/#167 · Carretti locali #177 · Carrettiere L1 #179 · Campi solo L2 #160 |
| CRIME e militare | CRIME skeleton #132 · edifici, tribunale e prigioni #139 · Accampamenti/livree #110 · MARCH skeleton #117 · Combat: separazione presentazione (03/11) |
| Mondo e grafica | MARE #150 · Foglie autunnali #183 · Tronchi scuri #185 · Bivacchi notturni #182 · STONECOLOR #187 · Texture offline #153 · SVG industriali rimossi #152 |
| UI, CODEX, CI | Schede Job Manager e Trade #188 · CODEX/Obsidian #165 · CI P0/P1/P2.1/P2.3 #176/#178/#180/#181 · Audit a griglia #158 |
| Storico 28–30/10 | Centro di controllo #103 · Sala larga #102 · Legno 3D #104 · Scala a chiocciola T1 #106 · Parapetti #107 · Picchi render #97 · Occlusione #94 · Save-safety #93 · Cavalieri/diplomazia #96 · Cutaway junctions #95 · Audio #92 · Cutaway civico Lab #100 · UI Difendi #88 · Abiti stagionali #87 |

**PR aperte:** #186 cantieri avviabili senza scorte con approvvigionamento e priorità (CI verde, da rivedere) · #184 densità foreste e sottobosco (bozza) · #162 biomi regionali e settori (bozza, esperimento).

**Lavoro non pubblicato (worktree locali, nessuna PR):** BC-251105-05 tetto interno dentro i merli (`feature/tower-inner-roof`, 1 commit + modifiche) · BC-251105-09 tetti della Long house (`feature/longhouse-roofs`, solo modifiche non committate) · `figure-billboards` (19 commit) · `combat-ai` (26 commit su remoto, ultima nota: assedio di 5 minuti fallito).

**Catalogo edifici — ancora solo progetto, da confermare prima del codice:** Presidio antincendio, Avamposto, funzioni del Municipio, Gilda/Corporazioni, effetti dello Scriptorium, Bagni pubblici, Lavatoio, Approdo fluviale, Cortile domestico, Giardino dei semplici, Carbonaia, Palazzo del Balivo. Il Corpo di Guardia esiste come stanza `guard` e sala del Municipio, senza pattuglie né allarmi propri.

**Seguiti aperti trasversali:** lanterna della Colombaia sul montaggio `roof` di `ROOM_EXTERIOR`; reclutamento dei cavalieri sullo stock reale dei cavalli; rintocco della campana nel motore audio; cosa legge il Prestigio; gronda e pluviale della Cisterna; assedio strategico S-01/02/03/04/10/15; CRIME C-01 e C-05; MARCH collegato a mappa e salvataggi; navi in gioco (MARE); ARTE solo backlog; UI v2 fase 5.

## 2026-11-08 — STONECOLOR · Verifica a cascata delle dipendenze

- **CODICE COLLEGATO:** modelli litici principali e sub-asset (case, civici e cimiteri, torri/mura, cantieri, scalinate, rampe, ponti, cave/miniere, massi/sassi di fiume, coste/reef, banchine, interni/cutaway) e relative chiavi di cache. Assenti copie per palette delle mesh e dei registri Blender.
- **GUARDIA DI MATERIALI:** le palette dei modelli sono interpretate per ruolo `stone*/rock*/paving`, non come tutti i grigi. Esclusi clay/brick, legno, acqua, neve, tetti, muschio, alghe e metallo.
- **APERTO PER CHIUSURA:** esecuzione completa della CI sull'ultimo commit e verifica visiva di cinque colori su Canvas e World3D, con LOD, inverno, cutaway, costruzione e modifiche da Profilo. Nessuna dichiarazione di copertura completa basata soltanto sui test statici.


## 2026-11-08 — STONECOLOR · Materiali litici per mappa

- **PALETTE APPROVATE:** Grigio attuale, Arenaria (beige mineralizzato, distinta dalla terracotta Clay), Tufo ocra, Calcare bianco-grigio, Granito grigio scuro. Cinque tonalità coordinate luce → ombra profonda per ciascuna.
- **IN BRANCH `feature/stonecolor`:** selezione casuale deterministica al nuovo seed, Profilo → Ambiente, persistenza locale/cloud, integrazione colore per murature, ripidi pendii, rocce, montagne, coste/reef, pietre scatter, cava di pietra, banchine; riuso dei modelli esistenti.
- **DA VALIDARE:** test GitHub Actions e confronto visivo nei due renderer per giorno/notte, inverno, stili clay/brick, cutaway e Asset Lab; censimento di qualunque modulo ancora con colori litici hard-coded. Non fare merge solo sulla base dei test statici.
- **FUORI SCOPE:** nuove risorse tipo arenaria/tufo/calcare/granito, biome lock, durabilità diversa, texture aggiuntive o copie degli asset.

## 2026-11-08 — Palette Job Manager / Trade nel Profilo (branch `feature/profile-job-trade-tabs-20261108`)

- **IMPLEMENTATO SU BRANCH:** aggiunte due schede di primo livello accanto a Generale, Araldica e Centro di Controllo, senza replicare ledger, roster o simulatori.
- **JOB MANAGER:** distribuzione L1, popolazione per classe, occupati per attività e andamento settimanale. Allocazione automatica invariata, nessuna assegnazione manuale fittizia.
- **TRADE:** inventario mercato/castello, prezzi, storico, quote di vendita editabili tramite il comando `setSaleShare` già esistente e apertura carovane.
- **QA:** regressione `qa/panels-regression.cjs` estesa. CI e QA visiva da verificare, nessun nuovo asset né schema di salvataggio. ROADMAP/DECISIONS invariate.

## 2026-11-08 — P3-21 · Tronchi e rami uniformati (`fix/dark-tree-bark-20261108`)

- **IMPLEMENTATO SU BRANCH:** il legno visibile di alberi e cespugli SVG è marrone molto scuro **#2B1D16** (7+7 sorgenti), comprese le ramificazioni dei cespugli; nessun cambio alle chiome e alla loro stagionalità. Stesso colore per i pini montani e nei render Canvas/WebGL2.
- **DA VALIDARE:** CI Runtime integrity/Asset Lab e controllo visivo; versioning asset/script per evitare cache precedenti. Nessuna modifica a biomi, gestione foreste, collisioni o salvataggi.

## 2026-11-07 — P3-21 · Finitura stagionale alberi SVG (`autumn`)

- **CODICE SU BRANCH, non ancora merge:** progressione cromatica verde → giallo-verde → giallo → oro → arancione → rosso → marrone dal 1° settembre al 30 novembre, variazione deterministica tra alberi; foreste procedurali e alberi urbani coerenti nel fallback Canvas e in WebGL2. Pini ed inverno invariati.
- **DA VALIDARE:** regressione dedicata in Runtime integrity e controllo a vista WebGL2/Canvas dei passaggi fra agosto, settembre, ottobre, novembre e dicembre, incluse la modalità DEV forzata e le prestazioni di ricostruzione dei buffer.
- **NON COMPRESO:** nuovi asset SVG, sfumature spaziali dentro la singola chioma, caduta/diminuzione del fogliame o biologia per specie; lavoro forestale e produzione legno non modificati.



## 2026-11-07 — CAMP, recupero bivacchi notturni (fix sul branch `fix/camp-bivouac-night-20261107`)

- **CORRETTO SU BRANCH, NON ANCORA MAIN:** unità in `camped` all'esterno della Yellow Zone devono avere una tenda visibile anche quando `ConquerEvents3D.bivouacMeshes()` è vuoto per collisioni/ostacoli; fallback Canvas mirato ai gruppi senza tende e disegno 3D per gli altri.
- **COPERTURA QA AGGIUNTA:** percorso bivacco 3D normale, mesh vuote e gruppi misti (oltre ai controlli esistenti su rientro notturno in caserma, pattuglie White, alba e fuochi). **APERTO:** verifica reale nel browser a notte simulata e riscontro del problema segnalato su una partita preesistente.
- **INVARIATI:** contratto Yellow/White, calendario, comportamento pattuglie, roadmap e decisioni di gioco; nessun nuovo modello né feature richiesta.


## 2026-11-06 — CI P2.3: trigger per branch inesistenti

- **INTERVENTO SU BRANCH `chore/ci-p23-stale-push-triggers-20261106`:** pulizia di 8 occorrenze obsolete (camp, cans, audit-hardening, circle, combat, mare, feature/cutaway-furniture-converge) in 7 workflow. Nessuna branch Git eliminata; PR/main/manuali preservati.
- **VERIFICA:** confermare `qa/ci-p1-regression.cjs` e CI prima del merge; nessuna modifica al gameplay o ai test specialistici.


## 2026-11-06 — P2.1 Asset Lab CI incrementale

- **P2.1 · IMPLEMENTATO SU BRANCH:** gestione PR fail-safe `full/incremental/skip`, selezione ID da `ConquerAssetAudit.catalog()` per un massimo di quattro sorgenti isolate, controllo baseline dei registri e full su modifiche di moduli condivisi o inventario; full manuale/domenicale. Nessun asset eliminato.
- **VERIFICA PR:** test pure-Node e CI GitHub, inclusi report e diagnosi Asset Lab; documentazione in `docs/CI.md`.
- **P2.1 · MISURA SUCCESSIVA:** confrontare durata e numero di render su PR di un singolo SVG o registro, prima di ampliare l'allowlist. La prova full resta obbligatoria sulle variazioni di scena/castello.


## 2026-11-06 — Professione Carrettiere L1 + mercato (branch `feature/l1-carter-jobs-market-20261106`)

- **REALIZZATO SU BRANCH / QA IN CORSO:** il carrettiere è assegnato dal roster L1 reale (uno per piazzale attivo con merci raggiungibili, max 4), dopo personale produttivo essenziale, prima dei cantieri. I membri dell'equipaggio sono i medesimi personaggi già presenti, esclusi dalla routine dei residenti quando sono al volante. Inattività se non c'è lavoro, giorno di riposo o allarme; si rispettano le strade completate.
- **DOPPIA DESTINAZIONE:** la quota del signore realmente accreditata al castello viaggia al Piazzale; le quote private e destinate alla vendita accreditate al ledger `e.lots` e i beni L3 del commercio viaggiano al Mercato completato e connesso. Base → produttore → destinazione → base, carro vuoto durante gli spostamenti senza merce.
- **SOLO ESTETICO:** il lavoratore occupa una posizione reale L1, ma i saldi economici vengono modificati solo da produzione/mercato originari, non da un arrivo animato. Niente lavoratori inventati, niente salario aggiuntivo o costi carburante, niente magazzini secondari con un proprio stock separato.
- **POSSIBILI SVILUPPI:** shift più articolati, gestione di più tipi di destinazione e livelli di impiego, trasporto con tempi effettivi per stock per-piazzale, scambi con villaggi esterni; deliberatamente fuori da questa PR.


06/11/2026 — Integrazione #169 su main c0c720b: mantenuti H4 e funzioni attuali, fixture aggiornata, catalogo Wiki rigenerato. Audit locale Mura: 265 render, 0 errori; 32 nuove voci addossati (legno, scuderia, pietra, mattoni) riviste nei fogli e aggiunte alla baseline; 98 cambiati preesistenti non accettati. Limite conservato: perdita del muro non abbatte automaticamente l'addossato; nessuna nuova regola di crollo introdotta.

BC-251105-03 e BC-251105-10 (edifici addossati alle mura e loro tetto a falda unica) implementati su `feature/wall-buildings`, PR in revisione. **APERTO:** comportamento dell'addossato quando il muro cade in breccia o viene demolito.

06/11/2026 — Integrazione #165 su main 1247cca: aggiunte dal vault autore le schede Falconiera e Orto di corte (138 voci, 153 pagine, 156 note); export gameplay rigenerato. Nuovo workflow Wiki conforme a P1: concurrency PR e setup Chromium condiviso; inventario CI 26 workflow, 6 browser job. ROADMAP e contratti editoriali invariati.

## CODEX — Accesso dal Profilo, 05/11/2026

- **Implementato nel branch `feature/codex-obsidian` / PR #165:** Profilo → CODEX / WIKI, con lettore interno, ritorno al Profilo e barra responsive. Riusa catalogo e vista esistenti; nessun pannello o catalogo duplicato.

## CODEX — Obsidian e testi, 05/11/2026

- **Implementato nel branch `feature/codex-obsidian`:** [vault personale → copia Git → Wiki](../CODEX-OBSIDIAN.md), approvazione delle note, wikilink/alias/sezioni, import sicuro e controllo di freschezza. Le note sono modificabili in Obsidian senza intervenire sui testi JavaScript.
- **Contenuti ampliati:** Torre, Fortificazioni, Costruzioni, Logistica e Navigazione/porti. Restano da approfondire le altre singole voci e gli adapter di professioni/ruoli.
- **Invariato:** tecnologie e stato conosciuto/sbloccato non vengono inventati; pubblicazione segue PR/CI/merge autorizzato, non il semplice salvataggio in Obsidian.

## CODEX — Wiki, 05/11/2026

- **Implementato nel branch `feature/codex-wiki`:** [Wiki pubblica e lettore in-game](../CODEX-WIKI.md), ricerca/filtri, pagine di famiglia/sovracategoria, hyperlink editoriali, relazioni e backlink; link contestuali dal Builder, snapshot pubblico generato e verificato contro il gameplay.
- **Aperto:** espandere testi specialistici e adapter professioni; conoscenze e sblocco effettivo dipendono dalla futura mappatura tecnologica. Non inventare stato del giocatore dai flag di completamento del catalogo.
- **Integrazione:** branch comprende #159/#161 ancora aperte all'avvio; CI e merge da verificare, nessuna pubblicazione anticipata su main.

## CODEX — fase 2, 05/11/2026

- **Implementato nel branch** `feature/codex-normalized-catalog`: core normalizzato e adapter dei registri per sette categorie, ID semantici, relazioni, snapshot portabile; [contratto e limiti](../CODEX-CATALOG.md). Test locale Codex PASS; non dichiarare integrato in main prima del merge.
- **Residui catalogo:** professioni/job individuali, descrizioni strutturate delle regole ancora procedurali, dati non formalizzati di reclutamento/macchine/annessi. Gli stati unmapped/context-required non vanno riempiti con valori arbitrari.
- **Prossima fase:** Wiki condivisa e ricerca/filtri, pagine dettagliate, Builder→Codex, pipeline export sito, contesto conosciuto/disponibile/sbloccato. Tecnologie ancora non mappate.

## CODEX — 05/11/2026

- **Censimento iniziale documentato sul branch** `docs/codex-catalog-audit-20261105`: [audit e inventario per sette famiglie](../CODEX-CATALOG-AUDIT.md), base `main` `bcf3cd7`.
- **Aperto:** adapter normalizzati sui dati effettivi, ID stabili, relazioni e classificazione per elemento; completare verifica comportamentale delle coperture parziali. Nessun duplicato di costi o regole.
- **Successivo:** Wiki condivisa web/in-game, ricerca e collegamenti Builder/Lab. Conoscenze predisposte separatamente da requisiti fisici/funzionali; mappatura tecnologica rinviata alla completezza del catalogo.
- Attenzione a #155: regole latrina/torri ancora fuori dalla base auditata.

## Catalogo strutture: voci da confermare (05/11/2026)

Tutte **DA CONFERMARE dall'utente** prima di qualsiasi codice (effetti, compatibilità, priorità). Nessuna è approvata.

- **Presidio antincendio:** upgrade di Pozzo/Cisterna; secchi e uomini pronti che spengono prima gli incendi nel raggio (sistema fuoco esistente).
- **Avamposto:** ~~torre isolata che evolve Corpo di guardia e Stazione di posta~~ → **implementato su branch il 09/11/2026, vedi MIL-RES-01** (upgrade delle torri isolate; il Corpo di Guardia si fonde nella Caserma).
- **Municipio:** funzioni amministrative.
- **Gilda:** assorbe la Casa delle Corporazioni.
- **Scriptorium (Chiesa L2):** servono effetti simulati.
- **Annessi civici:** Bagni pubblici L1–L3, Lavatoio (civico L1 o upgrade del Pozzo), Approdo fluviale, Cortile domestico (upgrade delle case), Giardino dei semplici (annesso di Chiesa L2 / Ospedale), Carbonaia (annesso del Taglialegna), Palazzo del Balivo.
- **Seguiti aperti:** Colombaia sul montaggio `roof` di `ROOM_EXTERIOR`; reclutamento dei cavalieri sullo stock reale dei cavalli; suono della campana; cosa legge il Prestigio.
- **Scartati, da non riproporre:** Ghiacciaia, Dogana, Stazione di posta (→ Avamposto), Scuola autonoma, Casa delle Corporazioni autonoma, Torre campanaria (→ Campana).

## Falconiera e Prestigio (05/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/falconry`:** stanza Falconiera (caccia: cibo), voliera sul tetto via `ROOM_EXTERIOR`, valore Prestigio del castello.
- **APERTO, da decidere:** cosa legge il Prestigio (diplomazia, cavalieri, popolazione); la Colombaia resta da spostare sul montaggio `roof` di `ROOM_EXTERIOR` come la voliera.

## 2026-11-06 — CI P1 orchestrazione browser e riduzione duplicati

- **P1 · IMPLEMENTATO SU BRANCH `chore/ci-p1-browser-dedup-20261106`:** 25 concurrency group separate per workflow/PR; eliminati tre full deterministici ridondanti; Asset Lab unico proprietario dell'audit visuale, con scope per file; cinque installazioni Chromium unificate da composite + cache Playwright 1.56.1; WebGPU scope renderer + PR/manuale; rimosse copie del save-safety e guard contestuale.
- **P1 · QA IN PR:** `qa/ci-p1-regression.cjs` e workflow GitHub da verificare; non cancellare i test QA, non ridurre runtime/economia/governance.
- **P2 · APERTO:** misurare tempi e cache hit nel periodo successivo, valutare Playwright screenshot coverage end-to-end su navigazione multi-PR. Conservare esecuzione periodica P0 full.



## 2026-11-06 — Logistica locale visuale sui piazzali (branch `feature/local-production-haulage-20261106`)

- **IN BRANCH / DA VERIFICARE:** animazione automatica dei carretti dai luoghi di produzione con quantità realmente trattenuta dal signore (taglialegna/cava/miniera/mulini, ove l'economia rilascia scorte, e bonifica forestale) fino a un piazzale connesso da strade finite. Scelto il piazzale più prossimo sulla rete viabile; carico → viaggio → scarico → ritorno vuoto, scorte contabilizzate solo dal ledger originale.
- **LIMITI DELLA PR:** nessuna spedizione per beni privati/solo mercato; se un sito o piazzale è isolato non vengono disegnati mezzi fittizi. Non è un sistema di trasporto materiale a latenza né richiede acquisto o staffing di un carrettiere. Migliorie eventuali: pedoni di carico/scarico, capienze per singolo deposito, visualizzazione dei trasferimenti del mercato, tabelle rotte e ETA per ogni sito.
- **QA:** `qa/haulage-regression.cjs`; reimpiego di `ConquerVehicles` invece di un secondo pathfinder.


## 2026-11-06 — P0 semplificazione GitHub Actions (branch `chore/ci-p0-consolidation-20261106`)

- **P0 · SU BRANCH:** 11 YAML ritirati (10 branch-only per Civil/Clay/Urban/Events/Sound e un job monouso di cancellazione branch); test conservati, nessun ref GitHub eliminato.
- **P0 · SU BRANCH:** rimpiazzato full suite per ogni PR con cinque smoke per modifiche isolate, full obbligatorio in CI quando sono modificati i moduli condivisi ad alto rischio, full manuale/settimanale. Copertura locale e QA dei singoli sottosistemi invariati.
- **P0 · INVARIATI:** integrità runtime, salvataggi, economia e governance documentale.
- **P1 · APERTO:** deduplicazione cross-workflow, Playwright/WebGPU/Asset Lab, cache e cancellazione dei job superseded. Verificare guardrail sui check per merge, dopo pubblicazione PR.


06/11/2026 — Integrazione #155: fixture CIRCLE aggiornata a torri W2 esplicite per i granai e relativo towerTier; le W1 non ammettono granai secondo la nuova regola. Nessuna variazione alle scorte o alle regole CIRCLE.

## Latrina nelle torri W1 e stanze delle torri piccole (05/11/2026)

- **IMPLEMENTATO SU BRANCH `fix/latrine-towers`:** la latrina passa dalle sezioni costruite W1 alle torri W1 in pietra (piano 2, sbalzo sulla faccia esterna libera). Le torri W1 accettano Colombaia (ultimo piano), Latrina, Prigione, Tesoro e Armeria, con la scala a chiocciola che resta.
- **APERTO:** nella torre rotonda W1 entrano meno sedili dei tre previsti (stanza di 0,73 U); un'apertura nel muro tra stanza e sbalzo; un avviso quando un salvataggio perde una latrina da una sezione costruita.


06/11/2026 — Integrazione PR #175: riallineata a main b62d0b9 (#173/#174). Risolti conflitti preservando rampe, H4 e torre lignea. Corretto il test costiero intermittente: fixture con seedRand reale, prima assente (3 fallimenti su 20); nessuna modifica al runtime costiero.

## 2026-11-05 — P0: Piazzale deposito e Logging Camp (branch `feature/founding-storage-yard-20261105`)

- **P0-05 · PRODUZIONE LEGNO — FIX IN BRANCH:** con un piazzale e camp attivo almeno un L1 è assegnato prima dei cantieri, evitando produzione zero durante costruzioni simultanee; accantonamento nel magazzino iniziale della quota non venduta, superando il vecchio limite target 70 con scorte iniziali 200; eccedenza al mercato senza duplicazioni. L'output si vede nel pannello del taglialegna e dell'economia. Logistica dei popolani/carrettieri ancora fuori scope.
- **P0-03 / P0-05 · PIAZZALE — IN BRANCH:** spawn garantito solo quando esiste una collocazione edificabile entro 7U dal pozzo; 2×2U, inventario fondativo nel ledger unico, espansione fino a 6×6U, comando nell'ispettore, altra costruzione tramite paletta Produzione, compatibilità salvataggi vecchi.
- **QA in PR:** `qa/storage-yard-regression.cjs`; rischio residuo da collaudare a vista: terreno complesso/biomi e disegno World3D.


## 2026-11-05 — Fix forestry L1 (branch `fix/forestry-l1-clearing-cost-20261105`)

- **P0-02 · FORESTE — IN IMPLEMENTAZIONE SU BRANCH:** nuova azione «Rimuovi foresta» nel Terraforming, lavoro L1 pagato, durata proporzionale alla superficie realmente alberata, apertura di una radura persistente e riconoscimento di legname nel ledger economico al completamento. Non equivale a tree depletion automatica da parte dei Logging Camp; quest'ultima rimane aperta.
- **P0-05 · LOGGING CAMP — FIX SU BRANCH:** costo di costruzione 5 legname e 35 oro, non 25 legname. Lavoratori e produzione ordinaria del Logging Camp non sono cambiati.
- **QA dedicata:** `qa/forestry-regression.cjs` (ghost e coda non istantanei, prevenzione doppio impiego, sabato/domenica, salari, legname una sola volta, persistenza). Esecuzione CI da verificare dopo PR.


Fogli provini dell'audit: impaginazione a griglia per le categorie e sfondo neutro sulle celle vuote (branch `fix/audit-sheet-grid`). **APERTO:** il simbolo «Her 2» dell'araldica è quasi invisibile nel foglio (difetto preesistente, non toccato).

## 2026-11-05 — ARTE: opere commissionabili e decorazione delle stanze

**APERTO · SOLO BACKLOG (nessuna implementazione o QA attestata).** Sottosistema separato da personaggi speciali e ricerca scientifica. Dettaglio canonico: [ARTE nel backlog Builder/Manager](../feature-backlog.md#2026-11-05--arte--commissioni-esposizione-e-circolazione-delle-opere).

- **A-P0 (ART-251105-01…05):** catalogo quadri/arazzi/sculture; slot compatibili nelle stanze; azione «Commissiona opera d'arte» con oro e tempo; inventario individuale persistente; rimozione e ricollocazione.
- **A-P1 (ART-251105-06…07):** valutazione Galleria/Atelier come funzioni delle Built Sections, non edifici autonomi; autori, qualità, provenienza e prestigio (formula da decidere).
- **A-P2 (ART-251105-08…09):** vendita e donazione a feudi/regni stranieri con effettivo trasferimento di proprietà; dipendenze da ledger economico, commercio e diplomazia condivisi.
- **Vincolo:** gli asset decorativi riutilizzano cutaway/furniture/Asset Lab, mentre ogni opera commissionata è un bene univoco, persistente e collocabile in un solo slot. La commissione non richiede obbligatoriamente un Atelier.

## 2026-11-05 — Builder / Castello: upgrade architettonici richiesti

**Richieste aperte al 05/11/2026 — non implementate da questo aggiornamento.** Il dettaglio canonico dei task e degli ID è in [feature-backlog.md](../feature-backlog.md#2026-11-05--builder--castello-upgrade-architettonici-richiesti).

- **Mura/camminamenti:** BC-251105-01 scala lignea e 02 scala lapidea **implementate su `feature/bc-scale` (PR aperta, non in main)**: upgrade del muro T2/T3, accesso wall-walk per le truppe; seguiti aperti: variante per palizzate, salita animata gradino per gradino, uso da parte dei civili. 03 edifici addossati; 04 merlature doppie (distinte dallo stile a doppia falda esistente), su branch feature/double-crenel: merlo doppio (11011011) e doppia fila interna; estensione a porte e torri fuori scope.
- **Torri:** BC-251105-05 inner roof; 06 torre lignea H2 con frame (PR #175, branch); 07 torre W2 × H4 **su branch `feature/tower-w2-h4`** (solo quadrata in pietra W2 indipendente; residui: bilanciamento assedio di scale, gittata e crollo dei piani a quota H4).
- **Coperture:** BC-251105-08 75° (in PR su `feature/roof-pitch-75`, il set 30°/45°/60° è in main); 09 tetti Longhouse; 10 tetti edifici addossati.
- **Ambiente:** BC-251105-11 giardino → deciso **orto di corte** (annesso del Municipio, +2 cibo/giorno lavorativo anche in assedio): implementato su `feature/orto-di-corte`, in attesa di merge. Seguiti possibili: lavoratori dedicati, stagionalità della resa.
- **Terreno/percorsi:** BC-251105-12 rampe per collegare quote e superare pendii ripidi; 13 scalinate pedonali sui dislivelli delle colline, con raccordi a terreno e terrazzamenti. Requisiti di navigabilità/pathfinding e QA; **distinte** dalle scale per i camminamenti delle mura (01/02). Stato: **IMPLEMENTATO su branch `feature/ramps-stairs`** (06/11/2026, non in main): rampe 2U max 1:4 per pedoni e carri, scalinate 1U fino a 45° solo pedoni; vedi [STATUS](STATUS.md).
- **Dipendenze:** `feat/roof-pitch`, `feature/wood-longhouse`, camminamenti e cutaway; nessun completamento o QA attestato da questo inserimento.

## MARE — Porti e molo (branch `mare`, 02/11/2026)

- **SUL BRANCH `mare`, NON MAIN**: mare al 30% della mappa; Molo in legno di 8U sulla costa con due attracchi esposti da `ConquerPier.moorings(s)`.
- **Navi**: 5 modelli Blender pronti (3 piccole, 2 grandi), solo nell'Asset Lab.
- **Navi in gioco**: flotta di test nel menu DEV (non salvata). **DA FARE**: salvataggio, arrivo/partenza in navigazione, selezione della nave nel gioco, ordine con il renderer WebGL invece del livello sovrapposto, picchi di disegno isolati.
- **Mura sulla banchina**: fatto il magnete. **DA FARE**: contorno di selezione alla quota della banchina; porte sulla banchina (torri fatte); muro che continua dalla banchina alla terraferma.
- **Attracchi lungo la banchina**: fatto. **DA FARE**: segnare in gioco gli slot liberi/occupati (oggi visibili solo via `ConquerQuay.berths`).
- **Banchina fuori whitezone**: fatto (parte da dentro, prosegue oltre). **DA FARE**: allo spigolo il lastricato delle due banchine si sovrappone (doppio strato, possibile z-fighting); un unico raccordo d'angolo sarebbe più pulito.
- **Battaglia navale**: dimostrazione nel menu DEV fatta. **DA FARE**: battaglie decise dal gioco (ordini, flotte, regni), vincitore che cattura invece di bruciare, uomini in acqua/scialuppe, legame con Combat/Siege ed economia (perdite, bottino).
- **Equipaggi**: civili e militari fatti (marinai, gabbieri, arcieri, armigeri); **DA FARE** marinai visibili in gioco (dipende dalle navi in gioco), legame con popolazione/economia.
- **DA FARE**: regni stranieri con araldica propria dalla mappa del mondo (oggi 3 segnaposto in `ConquerShips.FOREIGN`); navi ormeggiate agli attracchi e in navigazione; audit Asset Lab + baseline delle navi; ruolo economico del porto (commercio via mare, pesca); interazione con assedio/incendio/demolizione del molo; scatter in contesto porto anche sulla riva; audit Asset Lab del modello.
Prestazioni avvio: texture architettoniche preparate offline sul branch `fix/prepare-architecture-textures`. La regressione visiva nel Lab verifica il rendering dei componenti e delle fortificazioni.

Pulizia asset: rimossi dal branch `fix/remove-fossil-industry-svg` i due set di 24 pose industriali e le due viste base obsolete. Il catalogo conserva le anteprime 3D rotabili.

## Pendenza dei tetti di torri e porte (05/11/2026)

- **IN CORSO su branch, NON MERGE:** pendenza globale 30/45/60° con cambio a pagamento. Dettagli in [STATUS](STATUS.md).
- 30/45/60° in main (PR #157). **75° (BC-251105-08) su branch `feature/roof-pitch-75`, NON MERGE**, con regressione `qa/roof-pitch-regression.cjs` su `roofPitchQuote`.
- Aperti: estendere a case, sezioni costruite e garitte se richiesto.

## Long house in legno W1 / W2 (04/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/wood-longhouse`:** sezione costruita in legno larga W1 o W2, solo P0, con le stanze del piano terra in pietra; modello Blender modulare; costruttore, cantiere, cutaway e Lab.
- **APERTO:**
  - Bilanciamento di costi e giorni (proposta 6 oro / 28 legno per U×larghezza, 1,2 + 0,8 giorni).
  - Lato della porta: oggi sempre sul frontone in A; scelta del lato o porta laterale.
  - Fumo dal foro nel colmo per il focolare (oggi nessun comignolo né fumo).
  - Puntoni esterni che sporgono 0,1U oltre la sezione: verificare gli attacchi a mura e torri.
  - Lab: lo stage delle sezioni larghe (anche la sala larga in pietra) mostra quasi vuoto il cantiere al 25/50/75% (difetto preesistente).
## Mastio W4 · 3U con più stanze per piano (03/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/keep-w4` (NON MAIN, prototipo da provare):** tier W4 solo per torre quadrata in pietra, uno per insediamento, mastio automatico a fine cantiere; pianta per piano (Sala / 2 metà / 1+2 / 4 quarti), tramezzi bassi con porte nel cutaway, una scala per piano; stanze che restano sul loro piano quando cambia la pianta.
- **APERTO:** bilanciamento di costi e giorni (proposta 240 oro / 330 pietra / 75 legno, 18 giorni); scale tra piani più adatte di una scala a pioli; un ingresso rialzato in scala con la facciata 3U; occupanti e IA che attraversano le porte dei tramezzi; garitte a guglia che nel Lab mostrano solo le bandiere (anche sulla T3, difetto preesistente); baseline dell'audit da aggiornare con Playwright.


## Portico delle sezioni W1 (03/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/built-portico`:** un solo layout del porticato per 2.5D, World 3D e cutaway; archi sotto il solaio del piano sopraelevato; portico visibile nel cutaway 3D. Sotto il portico solo stalle, officina degli armaioli, magazzino e corpo di guardia (proposta: l'utente ha indicato stalle e armaioli, le altre due sono da confermare).
- **IMPLEMENTATO SU BRANCH (04/11):** loggia vera in World 3D (piano terra arretrato, pilastri e archi, piano rialzato sopra), anche nel cutaway.
- **IMPLEMENTATO SU BRANCH (04/11, sera):** una stanza arredata per campata, camminamento percorribile lungo i pilastri, visitatori fermi sotto il portico, «Portico» nel pannello.
- **APERTO:** loggia anche nel 2.5D (oggi archi ritagliati nella facciata); figure di lavoro fisse nelle stanze (stalliere, armaiolo) come le guarnigioni del cutaway; cavalli nelle stalle; il box della stalla (0,54U) non entra nella profondità utile (0,56U meno margini) e viene saltato; arredi di notte in piena luce; loggia nell'audit del Lab (oggi cattura il 2.5D); bottega/mercato sotto portico se si vorrà il commercio.
## Campana d'allarme (04/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/alarm-bell`:** allarme che si propaga dalle campane; upgrade `bell` delle torri T1–T2 a falde; campanile su `ROOM_EXTERIOR` (`mount:'roof'`).
- **APERTO:**
  - **Colombaia:** spostare la lanterna sul montaggio `roof` di `ROOM_EXTERIOR` dopo il merge di questa PR.
  - **Falconiera:** nascerà sullo stesso montaggio ed è già esclusa dal tetto con campana (`APEX_ROOMS`).
  - **Suono:** il rintocco udibile non è ancora collegato al motore audio.

## Scuderia militare (04/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/military-stables`:** capienza delle stalle per U nelle sezioni costruite W1 (mai nelle sale larghe W2), cavalli persi con la stalla catturata, macellazione dei cavalli di riserva quando manca il cibo, risposta dei corrieri su un cavallo fresco, arredo militare nel cutaway.
- **NON FATTO (scelta dell'utente):** rimonta (riproduzione dei cavalli) e consumo di foraggio.
- **APERTO:**
  - Il reclutamento dei cavalieri (`ConquerCombat.recruitKnight`) legge la capienza delle stalle e non lo stock reale dei cavalli: un cavaliere si recluta anche senza cavalli in stalla.
  - Elemento esterno (recinto o abbeveratoio) eventualmente via `ROOM_EXTERIOR`.

## Cisterna (04/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/cistern`:** stanza al piano terra delle torri in pietra W2–W3, sempre piena; acqua per 60/120 persone quando l'assedio taglia fuori i pozzi; punto d'acqua della catena dei secchi alla porta della torre; arredo nel cutaway.
- **APERTO — esterno della torre (attende il meccanismo stanza→esterno del branch `feature/room-exterior-latrine`):** quando c'è una cisterna la torre dovrebbe mostrare: **gronda** lungo il bordo del tetto a falde (sui tetti merlati, doccioni nel parapetto); **pluviale** lungo la facciata fino al piede, in linea con l'imbocco già modellato sopra la vasca (`cisternTank`, angolo posteriore); **bocca di presa / piccola vera** in pietra accanto alla porta del piano terra, dove la catena dei secchi attinge (`cisternTaps`).
- **APERTO:** effetto della sete sulla resa o sul morale nel ciclo d'assedio P2 (`siege.thirstDays`); torri senza porta al piano terra (mastio con porta rialzata, torri secondarie): oggi le donne attingono al piede della torre sul lato frontale.
- **FUTURO, non in questo branch:** Presidio antincendio come upgrade di Pozzo e Cisterna.

## Colombaia (04/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/colombaia`:** stanza Colombaia all'ultimo piano delle torri in pietra T2/T3 L2–L3 a falde; lettere per piccione 4× più veloci e risposta senza corriere di ritorno; lanterna sul tetto, arredo cutaway, voci nell'Asset Lab.
- **APERTO:** avvisi rapidi tra avamposti e castelli (aspetta Avamposto / Corpo di Guardia, usare `ConquerDovecote`); migrare la lanterna sul contratto `ROOM_EXTERIOR` quando entra in `main`; Falconiera e Campana d'allarme sullo stesso slot sotto il tetto; spostare la colombaia al nuovo ultimo piano quando la torre sale di livello invece di toglierla; piccione in volo come modello 3D nel World 3D.

## Infermeria nelle sezioni costruite (04/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/infirmary`:** stanza Infermeria (W1 piani 1–2, W2). Ha letti, personale pagato, ricovero dei caduti nella zona gialla con il 60% di sopravvivenza, guarigione dei feriti al 25% al giorno e +1 settimanale di felicità L1/L2 quando la copertura è di un letto ogni 40 abitanti.
- **APERTO:**
  - Epidemie: non esiste ancora un modello dati. Quando arriverà, l'infermeria dovrà ridurne il rischio e la durata tramite `ConquerInfirmary.status().free`.
  - Figure di cerusico e inservienti nel cutaway (oggi il personale è solo economico).
  - Barelle animate che portano i caduti in infermeria.
  - Avviso al giocatore quando una truppa è persa o dimessa.
  - Giardino dei semplici come annesso: fuori scope.

## Elementi esterni delle stanze e Latrina (04/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/room-exterior-latrine`:** il meccanismo `ROOM_EXTERIOR` (D-ROOM-EXT-01) e la latrina a sbalzo al piano 2 delle sezioni W1, con igiene della guarnigione come bisogno secondario.
- **APERTO, per altri owner:**
  - **Colombaia:** montaggio `roof`.
  - **Cisterna:** montaggio `eave`, gronda o pluviale.
  - **Combattimento:** infiltrazione dal condotto della latrina in assedio (precedente storico: Château Gaillard, 1204).
  - **Ospedale:** cura dei malati letti da `ConquerSiege.sickShare()`.
- **APERTO, da decidere:** ~~latrine nelle torri~~ (fatto il 05/11: solo torri W1, vedi sopra); un avviso quando un salvataggio perde una latrina che non entra più per una struttura costruita davanti.

## Cucine solo nelle sezioni costruite (03/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/kitchen-built-only`:** cucina solo al piano terra di sezioni W1 e sale larghe W2; niente torri né porte. I salvataggi perdono al caricamento le cucine in torri e porte.
- **APERTO:** avviso al giocatore quando un salvataggio perde una cucina; eventuale bilanciamento dei pasti per sezione.

## 2026-11-03 — Combat: separazione presentazione completata

- **Implementato su combat e verificato localmente:** canvas tattico, fog/zone, figure/HUD ed effetti in settlement-combat-render.js; regole prive di Canvas. Il precedente residuo di separazione dell'overlay non richiede più di conservare la branch dopo la promozione.
- **Accettazione:** 118 regressioni PASS; cinque scenari con trace grafici identici; confronto browser con pixel overlay identici, Builder e /camp senza errori.
- **Fuori scope:** ulteriori refactor della UI/input, risoluzione avvisi e drift della baseline Asset Lab, nuove meccaniche o figure 3D.

## Cutaway per piani (03/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/cutaway-floors`:** un piano per volta con ▲ ▼ sopra l'edificio e nell'ispettore, per castello (torri, porte, sezioni) e Municipio (2–3 piani).
- **APERTO:** piani alti arredati di taverna e gilda; arredi per piano del Municipio (branch CRIME: una stanza per piano); stato «Cutaway · piano N» nel Lab.

## 2026-11-03 — Audit hardening, CANS e combat

| Branch | Recupero verificato | Residuo |
|---|---|---|
| audit-hardening | Telemetria remota disattivata, diagnostica locale e CI; salvataggi già #93 | Eventuale nuova telemetria autenticata richiede progetto separato |
| cans | Skeleton logico puro, 11 test, specifica e CI | Adapter al gioco, navigazione/animazioni/persistenza reale ancora da sviluppare |
| combat | Regole/pattuglie e disegno popolazione già presenti | Separare overlay tattico conservando tutte le feature correnti; branch mantenuta |

La presenza del motore CANS non chiude i requisiti di popolazione in interni o di movimento tra arredi. Nessun caricamento automatico o cambiamento di gameplay introdotto.


## 2026-11-03 — Residui dei tre branch selezionati

| Branch | Residuo da recuperare | Esito |
|---|---|---|
| assedio | Nessuno dello skeleton storico | Coperto da #61; conservare modello danni attuale e Circle |
| events | Nessuno: diff vuoto contro base comune con main | Coperto da #78 e successive estensioni #110 |
| feature/knights-messenger-caravans | Nessuno compatibile con D-046 | Coperto da #96 in 2D e #105 per convogli/ledger; vecchio 3D escluso |

18 suite pertinenti superate. Le tre branch sono ridondanti e candidate alla rimozione con controllo del commit esatto. ROADMAP e DECISIONS invariate: nessuna nuova decisione di gameplay.


## 2026-11-03 — Priorità esplicite per consolidamento branch

| Priorità | Branch | Stato / prossimo passo |
|---|---|---|
| P0 | bridge | Già coperta da #73; preservare i miglioramenti successivi di main |
| P0 | circle | Riconciliata su main corrente, QA locale 67/67; pubblicazione e CI prima della promozione |
| P0 | jobmanager | Coperta da #98–99; non duplicare D-049. D-051 decisa: campi solo L2 |
| P0 | knights | Renderer 2D già identico su main, #96; 3D escluso da D-046 |
| P2 | messages | Integrare dopo riconciliazione del runtime e documentazione |
| P3 | Tutte le altre branch senza PR | Verificare se i residui sono ancora pertinenti; niente recuperi automatici |

Circle: niente resa automatica del feudo; conquista di settore solo con presenza terrestre ostile incontestata per mezzo giorno simulato, riconquista con difensori. Bottino solo dalle scorte di assedio assegnate alle stanze; ledger economico del villaggio separato e invariato.


## Piazze dei pozzi — municipio e gilda (branch `feature/townhall-guild`, 30/10/2026)

- **IMPLEMENTATO SU BRANCH, NON MERGE:** municipio e gilda L1–L3 legati a un pozzo (uno per tipo e per pozzo, entro 9U), modelli Blender, cutaway, cantiere, crollo; mattoni/argilla applicati a tutti i modelli civici.
- **APERTO:** effetti di gioco (tasse e decreti dal municipio del centro, mestieri e botteghe L3 dalla gilda), lotti Voronoi propri, annessi di piazza; modalità multi-cella del Lab per i cantieri (bitmap riusata).
## Villaggio — più pozzi (branch `feature/multi-wells`, 30/10/2026)

- **IMPLEMENTATO SU BRANCH, NON MERGE:** pozzi successivi come centri di espansione con strada principale verso il fondatore; centro villaggio designabile dall'ispettore; nomi di quartiere/borgata salvati e mostrati sulla mappa. Contratto D-056.
- **APERTO:** raggio di crescita proprio per ogni quartiere (oggi comune a tutti i pozzi); nome del villaggio modificabile dall'ispettore del centro; effetti di gioco del centro oltre a etichetta e meta degli emissari (mercato, feste, tasse); scelta di un nuovo fondatore invece dell'azzeramento quando si demolisce il primo pozzo.

## Economia urbana autonoma — scheletro consolidato (02/11/2026)

- **FATTO (solo codice isolato):** moduli in `src/economy/` per botteghe L3, beni e prezzi, con README e test di base.
- **DA FARE:** collegamento al runtime, case/popolani, calendario, persistenza, risorse effettive, commercio/importazioni e test funzionali. Nessuna funzione economica attivata da questo merge.

## CRIME — criminalità, ordine pubblico e sommosse (02/11/2026)

- **C-00 — IMPLEMENTATO SU BRANCH `feature/crime-skeleton` (solo sandbox):** `/crime/`, motore deterministico disaccoppiato, metriche criminalità / ordine / tensione, progressione e recupero in cinque fasi, politiche sociali e repressive, flag stanza/annesso per guardia, prigione e ospizio, fixture gogna/forca/tribunale, cronaca, storico e salvataggio isolato, test `qa/crime-regression.cjs`.
- **C-01 — APERTO:** sorgente unica per popolazione, felicità, tassazione, razioni e assistenza, senza ledger CRIME alternativo (`ConquerGame` + `ConquerEconomy`).
- **C-02 — IMPLEMENTATO SU BRANCH `feature/crime-buildings` (Builder):**
  - Municipio con una sala per piano, fino al livello civico (consiglio, tribunale da L2, guardia, prigione), arredate nel cutaway.
  - Capienze: prigioni solo al piano terra, 5 detenuti per cella, guardia 4 per unità di stanza.
  - Ospizio come annesso della Chiesa L2, con modello Blender.
  - **APERTO:** personale e routine delle guardie, lettura dal salvataggio in `/crime/` (adapter, vedi C-01).
- **C-03 — IMPLEMENTATO SU BRANCH `feature/crime-buildings`:**
  - Gogna (1 × 1 U), forca (2 × 1,5 U) e patibolo (2,5 × 2 U) collocabili come `eventVenue`, con cantiere, costo e modelli Blender `justicePillory` / `justiceGallows` / `justiceScaffold` nel Lab (*Edifici · Giustizia*). In `/crime/` il patibolo è un flag separato dalla forca.
  - **QA (#139):** audit del Lab completato e baseline aggiornata per i nuovi asset CRIME.
- **C-04 — AVVIATO NELLA PR #139:** tribunale in seduta nel cutaway del Municipio (giudici, cancelliere, prigioniero tra due guardie, pubblico) con costumi di ruolo; persone decorative e provvisorie, sostituibili con `ConquerCourtPeople.setOccupancySource`.
  - Gogna occupata e «giorno di giustizia» su forca e patibolo con boia, magistrato, guardie e folla (sobri).
  - Prigioni occupate nel Municipio e nel castello.
  - **APERTO:** eventi fisici di proteste, arresti e detenzione nelle routine dei popolani; sommossa e rivolta risolte con pattuglie e `ConquerCombat`, senza secondo motore di battaglia.
- **C-05 — APERTO:** bilanciamento, logiche punitive individuali, effetti del giudizio/giustizia, persistenza unica, serie storiche e indicatori nel Centro di controllo, regressioni browser/end-to-end.
- **DIPENDENZE:** M0 economia e popolazione vere → contratti funzioni civiche e guardie → routine e ordine pubblico → esiti militari. Sandbox C-00 non anticipa lo stato implementativo di C-01–C-05. [Design, confini e QA](../crime.md).


## Militare — accampamenti (branch `feature/tent-livery`, 30/10/2026)

- **IMPLEMENTATO SU BRANCH, NON MERGE:** livree a schema dei padiglioni; kit Blender del campo (canadese, tenda di compagnia, tettoia, botti, sacchi, linea dei cavalli, palizzata e porta); bivacco notturno organizzato in `/camp`; accampamento militare come struttura del Builder, dimensionato dall'esercito e fortificabile (steccato → palizzata con porta); tutto nel Lab.
- **ANCORA APERTO:** collegare l'accampamento alle truppe reali (oggi l'esercito è impostato a mano nel pannello); controllo collisioni quando il lotto cresce; sentieri disegnati; cavalli 2D alla linea; fossato, terrapieno e torrette di legno come livelli successivi; effetti di gioco (riposo, morale, difesa, assedio dell'accampamento); palette tessile dei colori (garanza, guado, panna, ocra, carbone) al posto delle tinte primarie.

## Castello — ingresso rialzato del mastio (02/11/2026, S-08)

- **IMPLEMENTATO SU BRANCH `feature/mastio-entrance`, NON MERGE:** porta del mastio al primo piano, piano terra cieco; scala di legno → scala in pietra lungo la facciata; levatoio accessorio su entrambe che, alzato, chiude il mastio a chi è a terra (richiamo dei civili compreso). Contributo a S-08 (rifugio finale), che resta PARZIALE.
- **IMPLEMENTATO SU BRANCH (seconda tappa):** levatoio automatico con i nemici a 9U; porte del mastio sul cammino di ronda sbarrate col battente alzato; scala come ostacolo per chi cammina; scala di legno e battente incendiabili, scala bruciata ricostruibile; civili richiamati che salgono la rampa visibilmente. Ariete sul battente escluso per scelta (D-MASTIO-01).
- **IMPLEMENTATO SU BRANCH (terza tappa):** mastio senza porte sul cammino di ronda; battente bruciato che lascia il vuoto; scala a pioli calata/ritirata dagli occupanti con scala o battente bruciati.
- **IMPLEMENTATO SU BRANCH (quarta tappa):** scala d'assalto contro la porta del mastio; battente con resistenza 60 abbattuto a colpi d'ascia (le torce lo bruciano); gli assalitori entrano e il mastio risulta violato.
- **APERTO:** esito dell'ingresso nel mastio (mischia con gli occupanti, resa/conquista, legato al P0 assedio); difensori che respingono la scala; disposizione degli assalitori in cima; `founding-regression` instabile anche su `main` (limite 100 ms).
- **APERTO (storico):** scale d'assalto contro il pianerottolo (serve un tratto di scalata verso `layout().landing`, fuori dal modello `{wallId,t}` del cammino); soldati difensori che usano la scala esterna per entrare nel mastio; resti carbonizzati della scala bruciata (oggi sparisce); drappo araldico del mastio L2 spostato sopra la porta invece di sparire.

## Castello — garitte e forme delle falde (02/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/bartizans`, NON MERGE:** variante `bartizan` (nessuna / merlate / guglia) per le torri grandi T3 quadrate e rotonde in pietra: quattro garitte d'angolo su mensole, 3 tiratori ciascuna con colpo al piede della torre 0–1U, bandiera sulle guglie. Variante `roofShape` (piramide / 2 falde / 4 falde con colmo L/2) per le torri quadrate col tetto a falde, solo estetica, due bandiere quando c'è il colmo.
- **APERTO:** garitte e falde nuove solo nel render 3D (il fallback 2.5D disegna le falde ma non i corpi delle garitte); garitte su torri a D; orientamento del colmo indipendente dalla rotazione della torre; garitte nel render 2.5D della galleria del Lab («Nel gioco»).

## Castello — muri sui pendii (02/11/2026)

- **IMPLEMENTATO SU BRANCH `feature/walls-on-slopes`, NON MERGE:** muri T1 su pendii dolci e scoscesi, T2 solo dolci, T3 solo in piano; il muro sul pendio è una scala (una pedata ogni 0,12U) col parapetto merlato continuo; cammino di ronda, pattuglie, cantiere e brecce sul gradino.
- **APERTO:** soldati in combattimento sul cammino di un T2 in pendio (altezza ai nodi); scale d'assalto contro un T2 in pendio; fallback 2.5D a bande senza Castle 3D; ballatoio e caditoie su muri in pendio (oggi tolti).

## Castello — porta piccola (30/10/2026)

- **IMPLEMENTATO SU BRANCH `feature/small-gate`, NON MERGE:** porta in pietra 1×1U, L1–L2, poco più alta del muro, con saracinesca, ante, torce e stendardi in scala; costo ×0,6 del corpo di porta. Piano alto a graticcio (L2), falde trasversali, cutaway delle porte a due facce.
- **APERTO:** il piano a graticcio non brucia come legno (solo il tetto); 2.5D senza graticcio (mostra la porta in pietra); avviso `danno-visibile` del Lab sul portone incrinato/sfondato della porta piccola (portale più piccolo della soglia); ponte levatoio davanti alla porta piccola da provare su un fossato; instabilità dell'audit (due stati di render alternati senza cambi di codice).

## Castello — semitorri e torri a D (30/10/2026)

- **IMPLEMENTATO SU BRANCH `feature/half-d-towers`, NON MERGE:** semitorre aperta alla gola (T1 piccola, T2 media) e torre a D (T2 media, T3 grande) in pietra; aggancio al muro con retro sul muro e fronte sul lato del puntatore; D sui fianchi della porta con il retro allineato. Semitorre con scala a pioli e botola a ogni piano. Cutaway della D. Costi per forma (tonda ×1,5, D ×1,25, semitorre ×0,5).
- **APERTO:** arredi sui solai della semitorre; collisioni e navigazione usano il rettangolo che le contiene (gli angoli davanti alla D sono pieni); semitorre e D a metà di un muro esistente (oggi solo alla fine di un muro, come le altre torri). Palette clay: monconi, corone spezzate e macerie restano grigi per tutte le torri.

## MARCH — Attacco e campagna militare (skeleton 30/10/2026)

- **SUL BRANCH feature/march-skeleton, NON MAIN**: pagina /march/ e motore UI-independent per spostamento, approccio a un feudo, razzie parziali con bottino, fase assedio, ritirata volontaria senza rollback, vittoria d'assalto simulata solo per test e annessione esplicita. Regressione qa/march-regression.cjs disponibile; CI/browser non ancora certificati.
- **DA INTEGRARE**: world map/feudi reali e salvataggio condiviso; Company con unità del Combat Engine; risoluzione razzie e assalti con danni e scorte reali; accessi, campi, logistica e fame via ConquerSiege; occupazione/governatore e passaggio al Feudo. Non introdurre una seconda economia o nuovi algoritmi indipendenti di assedio.
- **Regole approvate**: razzia e distruzione parziale senza obbligo di completare l'invasione; ritiro sempre possibile; espugnazione ≠ conquista; annessione solo per scelta espressa del giocatore. [Specifica e criteri](../march.md).

## Triage prevalente — 30 ottobre 2026 · ref `main` `cf569992`

> [**AUDIT COMPLETO 30/10**](AUDIT-2026-10-30.md) prevale per la presenza effettiva sul codice rispetto alle sezioni storiche **23–29 ottobre** qui sotto. Non cancellare i vecchi requisiti: le loro note «branch/non su main» sono documentazione storica alle date indicate.

- **FATTO SU MAIN:** #61 danni strutturali, #65 cutaway arredato, #77 cantieri grafici a fasi, #78 eventi 3D, #82 Asset Lab audit, #86–97 ponti/guardaroba/UI/asset/civici/audio/cavalieri/fix GPU/renderer; #98 lavoro **L1 meccanicamente necessario nei cantieri**; #99 routine maschili/femminili; #101 commercio L3 e operatori civici; #105 unico gestore convogli; #108 veicoli 2D; #103 **Centro di controllo a nove viste e serie storiche, merged il 30/10**; #102 sala 2U, #104 legno 3D, #106 scale T1, #107 parapetti. Non proporre come implementazioni da zero.
- **23 ID Builder:** **15 CORE MAIN / 8 PARZIALI**, vedi [owner Builder](../feature-backlog.md). **P0-04 e P1-11 promosse a core** per #98 e #101. **P2-17** resta parziale: locanda/chiesa con operatori sì, **income/bonus non simulati**. I vecchi "No services or economic effects" riguardano gli *annessi*.
- **Incendio delle case (branch `fix/house-fire-collapse`, NON MERGE, D-058):** le case L3/L4 lasciate bruciare restavano in piedi al 2%: ora crollano a fine combustibile. **Da valutare:** se anche le fortificazioni in legno debbano crollare a fine incendio (oggi dipende solo dal danno).
- **Assedio:** S-05/13/16/25 core danni e portone ora **merged #61**; fuoco/scale/macchine/legno già in runtime. Restano **S-01/02/03/04/10/15** come ciclo strategico (blocco rifornimenti, fame→resa automatica, campo persistente, IA). **`No automatic surrender in P0` su main**.
- **Economia residua:** `mine` produce `stone` (non `metal`), `workshop` per `equipment` della Built Section ≠ bottega commerciale L3, nessun `tree depletion`, input botteghe/materiali e capacità fisiche del castello da collaudare; i pannelli **non** sommano `economy.castle` e `siege.stock`. La sequenza M0–M3 può ora concentrarsi su integrazioni, non riscrittura economia.
- **Solo branch/OPEN:** #109 CI suite economia 2–5 (conflitto); #110 Livree/bivacco/campo militare (non assedio strategico completo); #111 multi-pozzo e quartieri (non su main). `messages`, `cans`, `circle` restano filoni separati; il vecchio `jobmanager` e `feature/autonomous-urban-economy` sono stati portati selettivamente/convertiti nelle PR economiche e non vanno duplicati.
- **QA:** CI PASS sulle HEAD di #109/#110/#111 e smoke WebGPU main `cf569992`; non rappresenta un nuovo test browser dell'intero gioco eseguito per questo audit.


## Castello — stili di merlatura del feudo (branch `feat/crenel-styles`, 30/10/2026)

- **IN CORSO su branch, NON MERGE:** tre stili globali (piatta, doppia falda, coda di rondine), cambio a pagamento per merlo dai Cantieri, merli più sottili e angoli a L. Dettagli in [STATUS](STATUS.md).
- Aperti: stile per la merlatura in legno delle porte; eventuale tempo di cantiere per il rifacimento (oggi istantaneo una volta pagato).

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
- **QA PASS su `38ea7ab`:** 8 check GitHub Actions verdi, regressione storici 26 settimane e browser con 9 catture demo. [Workflow screenshot](https://github.com/erykwest/CONQUER/actions/runs/40800506799). Revisione visiva utente e merge ancora aperti.


## Pannelli gestionali dell’insediamento — branch `panels` (29/10/2026)

- **IN BRANCH, NON MERGE:** nove viste nel Profilo con grafici reali del ledger, istogrammi sociali e di scorte, controlli esistenti (tax/rations/quote vendita/trasferimenti) e indicatori militari/cantieri/diplomazia. [Specifiche](../management-panels.md).
- **FATTO SU BRANCH / QA PASS:** `qa/panels-regression.cjs`, `qa/economy-panel-history-regression.cjs`, suite economica e QA Chromium con 9 screenshot; prova della persistenza storica nel ledger. Revisione visiva utente ancora da acquisire.
- **TBD:** festività straordinarie con effetti veri su felicità e produzione, statistiche occupazione L2–L4, bilanci individuali dei beni del signore, organico militare reale, relazioni diplomatiche e avvisi avanzati. Il pannello non deve introdurre stato duplicato.
## Castello — cutaway delle torri T1 con scala a chiocciola (29/10/2026)

- **IMPLEMENTATO SU BRANCH `feature/cutaway-spiral-stairs`, NON MERGE:** torri T1 in pietra e sottotorri T1 apribili in sezione, con scala a chiocciola al posto delle stanze.
- **APERTO:** torri T1 in pietra nella galleria del Lab (oggi l'audit non le cattura); mastio T1 (Sala comune) in sezione; posti degli occupanti sulla scala.

## Castello — sala larga a doppia altezza (branch `feature/wide-built-hall`, 28/10/2026)

- **IMPLEMENTATO SU BRANCH, NON MERGE:** sezione costruita larga 2U, H2 senza solaio, una stanza LARGE; finestroni Blender a tutta altezza, 5 contrafforti sul lato finestroni, 2 camini, cutaway a piano unico con gli arredi della libreria di main. Stesso profilo a gradoni anche per le torri con base «Contrafforti» (fix del disegno attraverso le facciate).
- **ANCORA APERTO:** effetti di gioco specifici delle sale (per ora valgono le regole generiche delle stanze), figure all'interno nel cutaway (cerimonie, banchetti, udienze), contrafforti nell'impronta di collisione/piazzamento.

## Castello — parapetto delle merlature (branch `feature/battlement-parapet`, 29/10/2026)

- **IN CORSO su branch, NON MERGE:** parapetto continuo tra i merli di torri, porte e mura in pietra; più merli sulle torri tonde. Dettagli in [STATUS](STATUS.md).
- **Aperto:** la firma 12×12 dell'audit del Lab non vede dettagli di questa scala (0 render cambiati): valutare una griglia più fine o un ritaglio sulla corona.

## Render 3D — fortificazioni in legno da Blender (28/10/2026)

- **IMPLEMENTATO SU BRANCH, NON MERGE (`feature/wood-fortifications-3d`):** palizzate T1–T3, torre di vedetta, torri a palizzata e porta in legno come modelli Blender nel renderer 3D; chiuso l'ultimo residuo 2.5D del castello nel world3d Cantieri del legno montati pezzo per pezzo dai modelli; cutaway della torre a palizzata con gli arredi delle stanze; bandiere e drappi araldici (statici, senza vento).
- **APERTO (legno):** cutaway della porta in legno (le porte in pietra lo hanno da #65); nel Lab le celle «Cantiere» non mostrano il montaggio (cattura prima del ridisegno in cache, vale anche per la pietra).
- **APERTO:** stati di danno visibili per il legno (oggi assenti anche in 2.5D); cantiere del legno ancora col fantasma traslucido; percorso Canvas 2.5D non usa i nuovi modelli (fallback invariato).
- **PROSSIMO (deciso il 28/10):** arredi del cutaway come modelli Blender, dopo aver portato il cutaway nel 3D. Niente modelli 3D per umani e animali: lo stile 3D delle figure è stato scartato.
## Economia — porting di #55 e `jobmanager` in 5 tappe (28/10/2026)

- **TAPPA 1 SU MAIN (#98, `a29e8e7`):** ledger settimanale, dotazione di fondazione, cantieri pagati con L1 reali, allocatore L1 unico con pascolo sorvegliato e taglio legna, razioni del signore e felicità L1–L4.
- **DECISO 05/11/2026:** D-051, campi riservati agli L2.
- **TAPPA 2 SU MAIN (#99, `cdb2af9`):** routine settimanali di uomini e donne.
- **TAPPA 3 SU MAIN (#101, `e1fdb20`):** botteghe L3 autonome, Beni L3 con prezzi a ritardo settimanale, servizi L3, manifesti L4+.
- **APERTO (economia L3):** ricette dei Beni L3 da validare (oggi nessun consumo di materie prime), importazioni per i mestieri mancanti, incasso della locanda. Su branch `feature/l3-workshop-cutaway` (NON MERGE): interno in sezione (fase 1), vetrina a ante e insegna a bandiera con emblema del mestiere (fase 2); residui: luce notturna dell'insegna, mesh Blender per ante e insegna, insegna visibile in 2.5D anche con la facciata di spalle.
- **FATTO (tappa 4, #105, 29/10/2026):** un solo sistema di convogli (carovane della diplomazia comprese), cartelli di prova, convogli visibili sulla strada maestra.
- **IN MERGE (CI, #109):** le nuove regressioni economiche (routines, commerce, urban-workshops, convoys, road-sign, diplomacy, vehicles) entrano in `.github/workflows/economy-flows-regression.yml`. Rations, labor-jobs e save-safety erano già in CI.
- **FATTO (tappa 5, #108, 29/10/2026):** veicoli instradati sulle strade, solo 2D.
- **APERTO:** traffico automatico di carri e carrozze senza convoglio (oggi solo convogli reali, prove e carrozza dimostrativa); decidere se rimuovere da main i moduli 3D di animali e carri non usati dal gioco. Leva (`levy`) resta senza effetti.
## Prestazioni — picchi di rendering (branch `perf/render-spikes-v2`, 28/10/2026)

- **IMPLEMENTATO SU BRANCH, NON MERGE:** ricottura a tessere del terreno 3D, nebbia con firma di contenuto, evento di telemetria `RENDERER`.
- **ANCORA APERTO:** leggere il P95 reale nella telemetria `RENDERER` dopo il merge; verificare la nebbia in una partita di combattimento; le altre cause di frame lenti viste nelle misure (fase `population` fino a secondi dopo un piazzamento, cache di scena 2D da 100–300 ms in World 3D, ricucitura strade di diversi secondi su `addStructure`) restano da diagnosticare.

## Castello — cutaway arredato di torri, porte e sezioni (PR #65, mergiata 28/10/2026)

## QA visiva — occlusione e scene intere (da #18, 28/10/2026)

- **FATTO SU BRANCH `fix/occlusion-clip-union`, NON MERGE:** clip di occlusione separati per sagoma (niente più dettagli che riappaiono dove due occlusori si sovrappongono).
- **APERTO (deciso il 28/10, da fare dopo):** portare il runner di regressione a scena intera di #18 (12 scene × 4 rotazioni, maschere di occlusione) come complemento all'audit per singolo asset del Lab; baseline da rigenerare.
- **APERTO:** separare il disegno della sovrapposizione di combattimento (`drawMapCircle`, `renderOverlay`) da `settlement-combat.js` (idea del vecchio branch `combat`, chiuso).

## Persistenza e telemetria (audit #16, 28/10/2026)

- **FATTO SU BRANCH `fix/save-safety`, NON MERGE:** autosave locale resistente agli errori di storage; minimo 10000 risorse al caricamento solo in DEV.
- **APERTO (escluso per scelta dell'utente il 28/10):** `/api/telemetry` espone in GET gli ultimi 120 campioni senza autenticazione e accetta POST senza limiti; `sendRemote()` scrive su `simulation_telemetry` con la chiave pubblica, policy RLS non versionata. Versioning coerente degli script in `index.html`.

## Combat / feudi — capitano, cavalieri e diplomazia (branch `feature/knights-diplomacy-2d`, 28/10/2026)

- **IMPLEMENTATO SU BRANCH, IN MERGE (sostituisce #72):** capitano con identità propria e raggio di comando 16U; cavalieri a cavallo reclutabili fino a min(stanze nobili, posti in scuderia) — C-04 in parte; messaggero a cavallo periodico verso il mastio, richiesta di 100 monete, accetta/rifiuta, pianificatore di carovane con carico, scorta, partenza e provviste — prototipo di F-05; tutte le figure a cavallo in 2D (D-046).
- **FATTO:** carovane unificate con i convogli dell'economia (tappa 4, #105, 29/10/2026); visibili sulle strade con la tappa 5 (#108).
- **ANCORA APERTO:** carovane intercettabili (F-06); le province esterne sono astratte (collegamento convenzionale di 40U fuori mappa); il messaggero in attesa sta al centro del mastio e si disegna sopra la torre; nessun costo di mantenimento dei cavalieri.

## Castello — cutaway arredato di torri, porte e sezioni (PR #65, riallineata 28/10/2026)

- **SU MAIN (`e9a89c6`):** 50 arredi Blender nelle stanze in sezione, stanze WebGL2 con depth test e luce notturna, 6 prese per le sottotorri delle porte, arcieri alle feritoie; convive con il cutaway civico di chiesa e locanda.
- **IN CORSO su `fix/cutaway-junctions`, NON MERGE:** le tre correzioni rimaste sulla vecchia branch locale `feature/cutaway-furniture`: porta dalla torre madre sul tetto della sottotorre più bassa, merli sepolti in una torre o porta attaccata più alta, niente drappo sul mastio in cutaway.

## Presentazione — audio e musica (branch `sound`, riallineato 28/10/2026)

- **IMPLEMENTATO SU BRANCH, NON MERGE:** mixer a 4 livelli, ambiente da stagione/meteo, suoni locali degli edifici, colonna sonora stagionale; controlli solo DEV, audio spento di default.
- **ANCORA APERTO:** controlli audio per il giocatore nella UI (UI v2), campioni per autunno e notte, effetti di battaglia, assedio e cantiere, eventuale caricamento differito dei brani per ridurre il peso della pagina.

## Civili — cutaway di chiesa e locanda (su `main` con #90, 23–28/10/2026)

- **SU MAIN:** sezione dell'edificio civico selezionato con arredi; contorno di selezione a terra; mura e edifici rispettano foreste e chiome.
- **FIX SU BRANCH `fix/civic-cutaway-lab`, NON MERGE:** lastra del primo piano che copriva il pianterreno delle locande.
- **APERTO:** il Lab non ha uno stato «cutaway» per gli edifici civici (lo stage copre solo torri, mura, porte): la verifica è stata fatta a mano con lo stesso metodo.
- **ANCORA APERTO:** cutaway per gli altri edifici civici (mercato, mulini) e persone all'interno durante le attività. **Botteghe L3: fase 1 su branch `feature/l3-workshop-cutaway`, NON MERGE** (sezione per mestiere e artigiano al banco, vedi STATUS 02/11); residui: scala dell'artigiano nella stanza piccola, luci notturne, clienti, mesh Blender dedicate (telaio, tornio, forno) al posto delle scatole procedurali.

## UX — UI v2 «Isole» (opt-in `?ui=2`, 26/10/2026)

- **FASI 1–3 SU MAIN (`5ddefa6`):** guscio, API di gioco, Costruisci, Gestisci, comandi struttura.
- **FASE 4 SU BRANCH `feature/ui-defend`, NON MERGE:** modalità Difendi (comando, zone, pattuglie, allarme; prove d'assedio solo DEV).
- **ANCORA APERTO — fase 5:** messaggi di stato/log tradotti, pannello attraversamenti come dati, UI v2 default, rimozione `settlement-builder-ux.js` e aggiornamento degli id usati da `qa/ui-combat-regression.mjs`.

## Hardening: cause strade / DEV / WebGL (23/10/2026)

- **FIX IMPLEMENTATI E VERIFICATI IN LOCALE**, non ancora su main, in `fix/main-founding-dev-webgl-20261023` basata su `bc82dbe`: [prove e cause](../main-fixes-diagnosis-2026-10-23.md). WebGL: VAO per shader, renderer attivo anche dopo rebuild; strade: preparazione cooperativa e commit atomico con cancellazione; DEV: test dei default automatici e dei pulsanti di override.
- 68 suite deterministiche, sintassi, WebGL reale con fallback per perdita del contesto e UI/Combat PASS; nuovo workflow di CI sulla branch. Rimangono separati i 49 avvisi preesistenti del Lab e i picchi GPU su hardware reale: questo fix non attesta FPS o assenza di ogni pausa. Nessuna milestone modificata; D-FIX-01 documenta i contratti tecnici.

## S-05 / S-16 / S-25 — riallineamento converge (#61, 23/10/2026)

- **IMPLEMENTATO SU BRANCH, NON MERGE:** restrizioni armi sui nuclei, validazione forze/componenti/campate e persistenza dei danni, integrate con main `bc82dbe`. Compatibilità con GATE-06/D-042: la grata resta una terza difesa danneggiabile; non può essere aggirata dal nuovo guard dei componenti.
- **PROVE:** regressioni danni, grate, brecce, crolli, scheduler, terrapieni e terraforming PASS. Batteria locale 67/68; FAIL temporale di fondazione strade riprodotto anche su main. QA browser assedio PASS gameplay Canvas + avvio WebGL, con possibile fallback grafico preesistente verificato sulla main; suite UI/Combat legacy ferma sul default DEV, stesso FAIL su main. CI da verificare sul commit pubblicato (vedi PR #61).
- **ANCORA APERTO:** GATE-07 (scelta tattica IA), S-17/S-24 end-to-end e vertical slice di assedio con scorte/guarnigione/blocco/resa. Non chiusi da questa PR. ROADMAP invariata: stesso ordine M0–M3; aggiornato il solo contratto d'integrazione D-031/D-032 con D-042.
- **FOLLOW-UP MERGE AUTORIZZATO:** recuperati i 4 commit della main fino a `bc82dbe`; nuovo audit Asset Lab e relativi residui preservati. Nessuna ulteriore modifica alle regole/renderer. CI da ripetere sulla nuova integrazione.

## UX/QA — Asset Lab come motore di audit (23/10/2026)

- **IN CORSO in `feat/asset-lab-audit`:** stati delle fortificazioni nel Lab (cantiere, danno, cutaway), audit automatico di ogni asset con baseline e deroghe, runner e CI, accesso diretto `/lab` senza partita. Chiude il residuo «fasi di danno non esposte nel Lab» della voce del 23/10 sotto.
- **APERTO — trovato dall'audit, da correggere nel gioco:**
  - **Cantiere non progressivo:** torri quadrate, mura, palizzate, porte e sezione costruita mostrano lo stesso cantiere a 25/50/75% (`cantiere-progressivo`, 26 avvisi). La muratura dovrebbe salire con `constructionProgress`.
  - **Danno al portone (regressione di #76):** «portone incrinato» e «portone sfondato» non si vedono più su nessuna porta (`danno-visibile`); prima di #76 lo sfondato era visibile sulle porte in pietra. Le nuove ante animate devono mostrare l'integrità del portone.
  - **Legno con rendering software:** con SwiftShader forzato il legno danneggiato o in costruzione scompare (riprodotto in Chromium headless); verificare il percorso di disegno su macchine senza GPU.
- **FATTO in `fix/lab-export-normals` (26/10):** facce bicolori dovute all'ordine dei vertici incoerente negli export Blender (shading da `|nz|`); export PNG 512 dal Lab. Possibile seguito: le falde opposte di un tetto ora hanno lo stesso tono, e si potrebbe ombreggiarle in base all'esposizione.
- **APERTO — difetti di geometria visti nella revisione a 512 (26/10), da correggere in Blender:**
  - coperchi di botti e secchi con spicchi grigi (cerchio e coperchio complanari): `barrelGroup`, `buckets`, `cargoBarrel`, `goodsMixed`;
  - pannelli a patchwork sulle torri d'assedio: `tower`, `tower2`;
  - fessure e spicchi nei tetti: `tavern1`, `stables`, `storage`, `loggia`, angolo interno di `cloister`, `watermill`.
- **APERTO:** il fallback Canvas 2D del gioco usa ancora il painter e taglia telai e finestre; valutare una correzione del painter o sprite pre-renderizzati.
- **FATTO (26/10):** occupazione forzata nel Lab. Il pulsante «Occupazione» passa tra tre modi: no, occlusione corretta (figure provate contro il depth buffer) e come nel gioco (figure disegnate sopra). I popolani sono su una griglia di 0,6 U su terreno, pavimenti e portici con spazio libero; l'export PNG 512 rispetta il modo scelto. Non usa ancora gli slot CANS o degli eventi (non su `main`).
- **APERTO:** nel gioco le figure sono uno strato 2D sopra gli edifici: il modo «come nel gioco» mostra popolani sui tetti e davanti ai muri che dovrebbero coprirli.
- **Case in 3D, kit Blender (D-057), su main:** L3 (#136, con le botteghe di #135), L1 e L2 (#141), L4 con torrette e abbaini (#145). **Camino laterale delle L1 su branch `fix/l1-chimney`, NON MERGE:** un solo camino in pietra sulla testata (prima uno ogni 1,5 U di colmo: due sulle casette da 2 U). **Da fare:** torrette L4 in cantiere non provate (servono incroci stradali); voce «casa intera» del kit nel Lab (oggi ci sono i soli pezzi). Cantiere col kit fatto (World 3D).
- **APERTO (incendio, già su `main`, emerso nella riverifica del 02/11):** un incendio consuma il combustibile della casa in ~55 s e la lascia al 2% di integrità, in piedi e senza segni di bruciatura; serve una seconda accensione per abbatterla. Decidere se una casa bruciata deve crollare o mostrare uno stato «bruciata».
- **APERTO (colore dei cantieri in World 3D):** il cantiere è dipinto dal Canvas, la casa finita da WebGL con la luce calda: al completamento le falde passano da grigio a bruno.
- **Residui dell'audit:** gli schemi (case, pozzo, campi, strade, fiumi, foresta, rilievo) restano non-gioco (`render-del-gioco`); ponti, levatoi, fossati, terrapieni non ancora nella sandbox.

## Igiene Git — esito e finalizzazione (23/10/2026)

- Il run [#39982707805](https://github.com/erykwest/CONQUER/actions/runs/39982707805) ha eliminato **otto ref** con successo; il secondo trigger pulisce anche le due branch tecniche dell'operazione stessa (la seconda soltanto se GitHub conferma la PR merged con SHA uguale alla HEAD remota). **La rimozione effettiva delle ultime due va verificata sul run della PR successiva.** Nessuna modifica alle feature.

## Igiene Git — pulizia branch obsolete (23/10/2026)

- **Operazione infrastrutturale separata dal gameplay:** otto ref candidati a rimozione con workflow condizionale, SHA fissa, ricontrollo PR aperte e presenza del merge. Nessun branch attivo/PR OPEN viene eliminato intenzionalmente; i branch divergenti o con commit non attribuiti restano da analizzare, **non automaticamente classificati come obsoleti**.
- **Rif.:** `.github/workflows/prune-obsolete-branches-20261023.yml`; vedere l'esito dell'Action dopo il merge. Il backlog di funzionalità e la roadmap M0–M5 non cambiano.

## Audit live del 23/10/2026 — stato prevalente

> **Main `518e830`** dopo [#76](https://github.com/erykwest/CONQUER/pull/76), [#79](https://github.com/erykwest/CONQUER/pull/79), [#80](https://github.com/erykwest/CONQUER/pull/80), [#81](https://github.com/erykwest/CONQUER/pull/81). Inventario complessivo e prove in [AUDIT-2026-10-23.md](AUDIT-2026-10-23.md), da leggere prima delle sezioni storiche.

- **FATTO SU MAIN:** portoni con magneti su strada e viabilità, ante 3D animate, grata autonoma con HP/costo/riparazione/blocco, drappi e torce (**GATE-01/01b/02/03/04/06**, PR #76); Asset Lab catalogo di modelli reali, viewer ±15°, 22 fortificazioni in pietra montate dal motore, 7 azioni di lavoro consultabili, manifest generato e sandbox senza save/cloud (**#79/#80/#81**).
- **APERTO:** GATE-05 portone ligneo e GATE-07 IA informata delle difese; #61 danni riallineata ma **non mergiata**; Asset Lab #82 (audit visivo dei 227 asset, 456 render, fasi danno/cantiere/cutaway) **NON SU MAIN**; cantieri progressivi #77, eventi #78, interni #65, L1/ledger #55 e cavalieri #72 **NON MERGIATI**.
- **QA mirata:** #82 segnala, *sul proprio branch*, mancanza di differenza visiva tra cantieri 25/50/75% e possibile regressione delle ante `damaged/broken` dopo #76: verificare su `main` prima di accettare la catena visuale. Non spacciare l'osservazione di #82 per bug qui riprodotto.
- **Priorità economica invariata:** singolo ledger fra Builder/economia/assedio, operai L1 realmente necessari, miniera `stone` vs `metal`, bonus civici, blocco/fame/resa. Le **13 feature core Builder** marcate `[x]` rimangono core già esistenti; nessuna di queste PR chiude automaticamente i 10 residui del backlog Builder.

## UX — Asset Lab / catalogo completo (#81 MERGED su main, 23/10/2026)

- **FATTO SU MAIN con PR #81** (sviluppato in `feat/asset-lab-complete-catalog`): fortificazioni in pietra montate dal motore di gioco (sandbox `index.html?assetlab=1`, `ConquerSiegePreview.assetMesh`), 7 animazioni di lavoro, manifest dei file generato con i set di rotazione, ricerca senza «undefined». Chiude il residuo del 22/10 sulle «fortificazioni effettivamente montate». PR [#81](https://github.com/erykwest/CONQUER/pull/81) **merged**; Asset Lab regression + controlli di CI su SHA `2e133d73` **PASS**. Il nuovo strumento di audit delle fasi è invece [#82](https://github.com/erykwest/CONQUER/pull/82) OPEN.
- **Residui aperti:** (1) varianti in legno (torri, porta lignea, palizzate) senza volume 3D: servono una mesh `ConquerCastle3D` o una cattura 2.5D isolata; (2) fasi di danno della galleria distruzione (danneggiata, crollo, distrutta) non ancora esposte nel Lab; (3) case, pozzo, campi, strade, fiumi restano SCHEMA: valutare la stessa sandbox con i renderer urbani; (4) ponti, levatoi, fossati e terrapieni non catalogati.

## UX — Asset Lab / rotazione viewer e categorizzazione (integrato su main tramite #80, 22/10/2026)

- **FATTO:** viewer a destra con comandi manuali di ±15° per modelli 3D e anteprime native animate; comandi nascosti per PNG/SVG, schemi 2D e figure piane. QA statiche + browser per angolo effettivo e reversibilità.
- **Revisione tassonomia:** le texture architettoniche isolate non sono fortificazioni complete. Rimossi i 13 schemi illustrativi di fortificazioni; file reali nella categoria «Componenti». Strutture del Builder invariate.
- **Residuo (ripreso il 23/10):** un catalogo di fortificazioni complete richiede strutture **effettivamente montate** dal gioco, non un collage di sottopezzi.

## UX — Asset Lab / catalogo visivo (integrato su main tramite #79, 22/10/2026)

- **FATTO nella prima versione:** catalogo visivo derivato dalle sorgenti presenti; SVG/PNG, 3D, figure animate, araldica e schemi parametrici distinti con etichetta SCHEMA; navigazione categoria/famiglia/formato/ricerca e pannello di dettaglio.
- **Evidenza:** PR #79 fusa in `main`, regressioni e Chromium **PASS** al momento del merge. Le correzioni di questa iterazione hanno test propri non ancora verificati al momento della stesura.
- **Miglioramento futuro:** sostituire gli schemi delle strutture puramente procedurali con miniature renderizzate direttamente dal Builder, senza reinventare componenti che non esistono come asset autonomi.

> Raccoglie *idee, requisiti e dipendenze*. Un requisito elencato qui **non prova** assenza né completamento nel software.
> Non duplicare il backlog di 22 feature del Builder già mantenuto in [docs/feature-backlog.md](../feature-backlog.md): quello rimane il riferimento dettagliato per territorio/urbanistica/economia locale/araldica.

## Stato di riferimento al 22/10/2026 — snapshot storico, superato dal 23/10 per merge successivi

**Audit statico su `main` `c52b537`:** [riconciliazione integrale dei 23 ID Builder, dei 25 S-ID assedio, Clay, feudi, UX e note voice](AUDIT-2026-10-22.md). I requisiti progettuali riportati più sotto **non** vanno letti come assenza del codice; quando una feature è già implementata, il solo lavoro residuo è indicato nell'audit.

- **MAIN già implementato (non ricreare):** P0-01a/03/07; P1-12/13; P2-14/15/16/18/19/20; P3-21/22. Sono su main anche base economia, foreste, industrie, campi, mulini, Built Sections, mercato, incendio, danni, macchine d'assedio e mobilitazione, ma alcune dipendenze sono **PARZIALI**.
- **Integrazioni prioritarie:** PR #55 ancora draft (L1 cantieri e scorte), #61 aperta (danni), #65 aperta (cutaway arredato), #72 aperta **verso `knights`**, #18/#16 draft. Né la presenza di un asset né di una QA equivalgono a meccanica completa o test superato oggi.
- **Clay rettificato:** la cava `clay` entro 6 U dall'acqua, il costo `brick` in argilla, la palette e l'80% degli HP sono **ora presenti su main**, non più solo documentati su `clay`. Rimane da collaudare la catena completa e l'unificazione degli inventari.
- **Assedi:** slot, Mastio, portone separato, danni, propagazione incendio, macchine, terrapieni già hanno codice. **Non risultano dimostrati blocco completo di ogni accesso, resa automatica, IA strategica d'assedio e continuità delle scorte.**
- **P2-17/servizi civici:** taverna e chiesa + annessi hanno già modello, pannello e routine; **l'effetto economico/sociale non è implementato** (il pannello dice "No services or economic effects"). È un task di design/meccanica piccolo, non una nuova modellazione.
- **Lungo periodo invariato:** criminalità/giustizia avanzata, economie multi-feudo, navigazione, varianti regionali, mercato interregionale; non promuoverli a M0–M3.

## Triage su main del 21/10/2026 (snapshot storico)

La [ricognizione dello stato Git](AUDIT-2026-10-21.md) prevale sugli snapshot storici riportati più in basso.

- **FATTO SU MAIN (merge, non accettazione completa):** minimappa/LOD [#44](https://github.com/erykwest/CONQUER/pull/44), pattuglie/lupi/camp [#53](https://github.com/erykwest/CONQUER/pull/53), ciclo solare [#54](https://github.com/erykwest/CONQUER/pull/54), mulini [#57](https://github.com/erykwest/CONQUER/pull/57)/[#58](https://github.com/erykwest/CONQUER/pull/58), terraforming [#63–69](https://github.com/erykwest/CONQUER/pull/69), prestazioni [#70](https://github.com/erykwest/CONQUER/pull/70), **animazioni lavoro con 7 attrezzi** [#71](https://github.com/erykwest/CONQUER/pull/71), terrapieni d'assalto [#73](https://github.com/erykwest/CONQUER/pull/73).
- **IN CORSO / NON MERGE:** **L1 costruttori con lavoro meccanico e scorte reali** + commercio/convogli [#55](https://github.com/erykwest/CONQUER/pull/55); regole danni [#61](https://github.com/erykwest/CONQUER/pull/61); arredi/cutaway [#65](https://github.com/erykwest/CONQUER/pull/65); cavalieri e messaggeri [#72](https://github.com/erykwest/CONQUER/pull/72) su base `knights`.
- **APERTO:** QA browser interattiva, prestazioni picchi GPU e visual QA [#18](https://github.com/erykwest/CONQUER/pull/18); ledger unico/agricoltura; matrimonio danni→accessibilità→assedio/blocco/resa; filiera metallo; sistema feudale completo.
- La presenza di un modulo o di un check non trasforma le righe S-xx in **FATTO**: valutare la sequenza di combattimento completa contro i criteri di accettazione.

## Eventi — spazi e allestimenti (branch `events`, 22/10/2026)

**MODELLI 3D PRESENTI SU `events`, GAMEPLAY NON IMPLEMENTATO.** Contratto in [docs/events/README.md](../events/README.md).

| ID | Requisito | Stato | Dipendenze |
|---|---|---|---|
| EV-3D | Modelli e rendering di podio, palco (players / herald), spiazzo 14 × 10 con allestimenti giostra / torneo / circo / sagra (+ accampamento, teatro, arena) | CODICE + QA locale | `settlement-events3d.js`, renderer |
| EV-P0 | Registro spazi, posizionamento dal Builder, riserva del terreno senza cantiere, spostamento a evento inattivo | Builder, piazzamento, riserva e salvataggio FATTI; spostamento libero a evento inattivo DA FARE (oggi demolisci e ripiazza) | placement, Builder, save/load |
| EV-P1 | Calendario e ciclo `planned → preparing → active → clearing → idle`, `progress` durante montaggio e smontaggio | Avvio / chiusura manuale e ciclo sull'orologio FATTI; calendario programmato (`planned`) e costi/effetti economici DA FARE | orologio di gioco |
| EV-P2 | Pubblico e artisti tramite routine esistenti (punti `seats`, `performers`, `speaker` nei meta dei modelli) | DA FARE | popolazione, navigazione |
| EV-P3 | Taglia dello spiazzo: 14 × 10 U (D-044); eventuali taglie multiple | 14 × 10 DECISO, taglie multiple PROPOSTE | decisione di design |
| EV-P6 | Tende non allineate (±40°, 75%; scatter 200%; senza collisioni né uscite dal lotto) e scatter/attrezzature disordinati e colori unici per spazio | CODICE + QA locale | `settlement-events3d.js` |
| EV-A1 | Animazioni ambientali: bandiere, festoni e stendardi al vento | CODICE + QA locale | strato dinamico, meteo |
| EV-A2 | Animazioni di persone: tutti gli spazi e allestimenti FATTI su slot e registro occupanti allineati a CANS (sorgente provvisoria); cavalli della giostra bardati | IN CORSO | `settlement-events-people.js` |
| EV-A3 | Occlusione del pubblico: balaustre, drappi, schienali e pareti dell'arena sopra le figure FATTO; figure sotto gli edifici di altre strutture davanti allo spazio DA FARE | IN CORSO | `settlement-events-people.js`, overlay popolazione |
| EV-C1 | Adapter CANS: occupanti reali (residenti) al posto della sorgente provvisoria, prenotazione, arrivo e uscita dagli accessi | DA FARE, dipende dallo skeleton CANS | branch `cans` |
| EV-P5 | Arena a U arricchita e lotto dedicato `arenaLot` 18 × 14 | CODICE + QA locale; posizionamento da Builder DA FARE | design, placement |
| EV-P4 | Stemma del regno dipinto sui decal (`arms` di tribune e stendardi) | DA FARE | araldica SVG |

## Portoni — accessori integrati su main con PR #76 (23/10/2026)

**CODICE SU MAIN**, merge [#76](https://github.com/erykwest/CONQUER/pull/76), con nuovo modulo `ConquerGates`. QA sulla HEAD `a504ea65`: workflow routing, builder, camp, work animation, earthworks, context sync **PASS**. Restano GATE-05/GATE-07 e verifiche di stati danneggiati segnalate in #82. Prove e limiti originari in [STATUS](STATUS.md#portoni--magnete-strade-ante-grata-drappi-e-torce-22102026).

| ID | Requisito | Stato |
|---|---|---|
| GATE-01 | Magnete del portone sulle strade esistenti: centro sulla mezzeria, passaggio allineato, strada mantenuta e percorribile | **MAIN · PR #76**; QA della PR |
| GATE-01b | Magnete delle strade principali sulle due bocche del portone, con accesso dritto e nodo comune al centro | **MAIN · PR #76**; QA della PR |
| GATE-02 | Ante del portone animate tra aperto e chiuso (pannello, chiusura notturna), passaggio voltato visibile nel 3D | **MAIN · PR #76**; QA della PR |
| GATE-03 | Grata (saracinesca) come upgrade del solo portone in pietra, animata; abbassata blocca il passaggio | **MAIN · PR #76**; QA della PR |
| GATE-04 | Due drappi araldici ai lati del portale e due torce accese di notte sul fronte esterno | **MAIN · PR #76**; QA della PR |
| GATE-05 | Ante, grata, drappi e torce per il portone di legno (oggi solo il magnete) | APERTO |
| GATE-06 | Grata come strato difensivo separato (D-042): HP propri, colpita prima della porta, il fuoco passa, distrutta e riparabile, sbarra anche a porta sfondata | **MAIN · PR #76**; QA della PR |
| GATE-07 | IA d'assedio che sceglie fra ariete sulla grata, fuoco sulla porta e altri accessi; riparazione della grata durante l'assedio | APERTO, dipende da S-15 |

## Ponti — magnete strade (branch `feat/bridge-road-magnets`, 23/10/2026)

**CODICE SU BRANCH, NON SU MAIN.** Prove e limiti in [STATUS](STATUS.md#ponti--magnete-strade-23102026).

| ID | Requisito | Stato |
|---|---|---|
| BRIDGE-01 | Magnete delle strade principali sulle due testate di ogni ponte (legno, pietra, in costruzione, ponti automatici delle strade principali, mezzoponti dei levatoi); la strada che parte o arriva sulla testata non è una sovrapposizione | BRANCH + QA + controllo browser |
| BRIDGE-02 | Strada attraverso portone + ponte levatoio sopra un fossato: l'accesso dritto del magnete portone finisce a metà impalcato e il fossato può bloccare il tracciato | DA VERIFICARE |

## Clay — specifica storica della branch `clay` (19/10); runtime più recente su main

**NOTA STORICA:** il documento progettuale nacque su `Civil/clay` senza runtime; **sullo snapshot main del 22/10 buona parte è implementata** (`settlement-industries.js`, `settlement-core.js`, `settlement-siege.js`, `qa/clay-material-regression.cjs`). La tabella seguente specifica requisiti originali, **non una lista di attività totalmente mancanti**. Contratto completo in [CLAY-DEVELOPMENT](../CLAY-DEVELOPMENT.md) e verifiche in [CLAY-REGRESSION-PLAN](../CLAY-REGRESSION-PLAN.md).

| ID | Requisito | Dipendenze |
|---|---|---|
| CLAY-P0 | Cava con modalità pietra/argilla, idoneità argilla ≤ 6 U da rive di fiumi/torrenti/laghi | industrie, terreno, piazzamento |
| CLAY-P1 | Bene economico `clay` e uso costruttivo in sostituzione di `stone` | ledger, `State.resources`, UI |
| CLAY-P2 | `brick` selezionabile per ogni elemento murario, geometria riusata, palette marrone/terracotta Canvas + WebGL2 | Builder, renderer, save/migration |
| CLAY-P3 | HP max componenti murarie `brick` pari all'80% di `stone`, gate/anta separati | integrità, matrice danni, assedi |
| CLAY-P4 | Suite regressione e test visuali, senza rotture dello skeleton `Civil` | QA economia, placement, save/load |
| CLAY-FUT | Vasellame eventualmente nella Bottega L3; nessuna filiera produttiva obbligatoria ora | futura scelta di scope |

**Verifica 22/10:** CLAY-P0/P1/P2/P3 = **base MAIN**; CLAY-P4 = **QA disponibile, non rieseguita**; CLAY-FUT = **futuro**. Vedi [audit 22/10](AUDIT-2026-10-22.md#b-requisiti-clay--rettifica-di-uno-snapshot-superato).

## Builder, Landscape ed economia (dettaglio esistente)

- **P0-01…08:** orografia; foreste funzionali; Village Core; abitazioni/tier; logging camp; Farm Hub; cava; miniera.
- **P0-01a Terraforming:** **CODICE SU MAIN** dopo integrazioni [#63–69](https://github.com/erykwest/CONQUER/pull/69) e [#73](https://github.com/erykwest/CONQUER/pull/73) per earthworks; restano da verificare i casi visuali e compatibilità con strutture/routing. La nota su `terraforming fa9ef0d` è storica.
- **P1-09…13:** Built Sections; fabbro; mercato; palizzate; ponti.
- **P2-14…20:** fossati, levatoi, basamenti, servizi, araldica SVG e propagazione.
- **P3-21…22:** sette alberi SVG e circa 25 scatter antropici.
- Ogni item è definito con criteri di accettazione in [feature-backlog.md](../feature-backlog.md), non qui.

### Requisiti agricoli di dettaglio

`src/settlement-fields.js` e la sua QA implementano / testano regole concrete: campo quadrilatero Voronoi con lati 1–6 U; slot `floor(area/4)`; serpentina parallela al lato lungo, passo 0,5 U; aratura 1 U × worker/giorno, semina 3 U × worker/giorno; crescita visiva estrusa H 0,1 U e raccolta. Chiarire se le velocità riguardano area, distanza o lavoro economico prima di rifattorizzare la resa.

Confini di lotti e campi: staccionate, muretti e siepi con pesi di progetto **50% / 30% / 20%**; verificare regole esatte per i lati condivisi, varchi e ostacoli fisici. Non trasformare automaticamente decorazioni in collider.

### Asset e ambiente

- Sette famiglie di scatter: carri, merci, segnali, rottami di carri, cataste, agricolo, arredi da lavoro. Distribuzione guidata dal contesto (strade, cantieri, incroci, periferia), non random uniforme.
- Foreste come masse procedurali con varietà di chiome, densità e resa economica; esecuzione e rigenerazione vanno provate.
- Meteo/stagioni, illuminazione, tracce sulla neve e ambientazione sonora come presentazione contestuale, non sistemi economici separati.

## Difesa del castello, presidio e assedio

| ID | Requisito da verificare/sviluppare | Dipende da | Stato conoscitivo |
|---|---|---|---|
| S-01 | Assedio continuo con accelerazione del tempo; attacco diretto o blocco; anche fuori vista | calendario e Simulation tick | PARZIALE MAIN · blocco continuo/fuori vista APERTO |
| S-02 | Scorte, consumi, autonomia, fame e condizioni di resa per entrambi | ledger, granai, magazzini | PARZIALE MAIN · stock e fame sì, resa no |
| S-03 | Uno o più accessi indipendenti, controllo accessi; blocco valido solo quando tutti i collegamenti utili sono isolati | accessibilità, ponti, guardie | PARZIALE MAIN · accessi sì, accerchiamento no |
| S-04 | Campo assedianti, sortite, rinforzi e ritirata degli attaccanti | World + Combat | PARZIALE MAIN · camp sì, sortite/rinforzi no |
| S-05 | **Matrice danni per bersaglio:** attacchi ordinari delle unità e frecce causano **0 danni a mura e torri**; i danni strutturali sono ammessi solo da sorgenti/attacchi esplicitamente compatibili. La torre-porta e il portone sono bersagli distinti con durabilità indipendenti (D-031/D-032). | castle model + Combat | PARZIALE MAIN · matrice presente; #61 OPEN |
| S-06 | Scale, arieti, catapulte, trabucchi e materiali necessari; IA riconosce breach e punti deboli | S-03,S-05 | PARZIALE MAIN · macchine/scale presenti, IA incompleta |
| S-07 | Fuoco, propagazione, spegnimento con acqua/pozzo, rischi di legno e palizzate | fuoco + lavoro/percorsi | MAIN BASE · fuoco e brigata; QA integrazione |
| S-08 | Mastio come attributo di una torre (uno), cerchie difensive rilevate dalla geometria; ripiegamento guarnigione/civili | zone, pathfinding, castle | PARZIALE MAIN · Mastio sì, ritirata completa no |
| S-09 | Hoardings funzionali e caditoie, manutenzione, vulnerabilità a incendi | S-05,S-07 | PARZIALE MAIN · hoardings sui muri sì, manutenzione no · BRANCH `feature/tower-hoardings`: ballatoio montabile/smontabile su torri e porte in pietra (porte: solo fronte); torri agganciate alle porte con ingresso sul retro della porta (D-GATE-01) (modello Blender, tetto invariato, brucia); ancora aperti su torri e porte: tempo e costo di montaggio, lancio di pietre dalle caditoie, blocco scale/ponti, integrità separata |
| S-10 | «Piano di Difesa» con upgrade predisposti, materiali, tempi di montaggio e preview | Builder + S-02 | DESIGN · Piano di Difesa da realizzare |
| S-11 | Slot di torri/feritoie/tetto presidiati, priorità archi/balestre, tetti tagliati/cutaway, altezza/visibilità | Built Sections + roster | PARZIALE MAIN · slot arcieri già presenti |
| S-12 | Chiamata alle armi/milizia via armeria, ordine di presidio, rifugio in sala comune | agenti/nav, capienza | PARZIALE MAIN · mobilitazione da integrare |
| S-13 | Danno strutturale per stati: integro → crepe/merlature → breccia/angolo → tetto crollato con ricadute sugli occupanti; **nessuna perdita di HP per colpi ordinari o frecce contro mura/torri** | S-05,S-11 | MAIN BASE · stati danni/crolli; #61 OPEN |
| S-14 | Pattuglie e controllo territoriale; nemici/wildlife con stance neutrale, aggressiva, elusiva e notte | Combat + territorio | MAIN BASE · pattuglie/lupi #53 |
| S-15 | IA di assalto sceglie assalto, attesa, costruzione, blocco, ripiegamento in base a informazioni vere | S-01…S-14 | DESIGN · IA strategica ancora aperta |

### Nuove richieste esplicite — assedio (16 ottobre 2026; triage runtime 22/10)

**Stato originale: IDEA (16/10). Audit 22/10: molte voci dispongono di asset e meccaniche sul main; tabella qui sotto aggiornata per stato conoscitivo, senza certificare la chiusura funzionale.** Le voci seguenti dettagliano S-05 (matrice danni), S-06 (macchine e scale), S-07 (incendi) e S-13 (distruzione localizzata). **Non** sostituiscono i requisiti precedenti; per lo stato attuale consultare l'[audit 22/10](AUDIT-2026-10-22.md).

| ID | Funzionalità richiesta | Dipendenze e criterio minimo da verificare | Stato |
|---|---|---|---|
| **S-16** | **Danni a mura e torri** | S-05, S-13: **attacchi ordinari delle unità e frecce non danneggiano mura né torri (0 HP rimossi)**. Solo sorgenti di danno strutturale compatibili possono degradare i singoli elementi; effetti reali su ostacoli/accessibilità, protezione e presidio. Le animazioni rispecchiano lo stato meccanico. | MAIN BASE · danni selettivi; #61 OPEN |
| **S-17** | **Fuoco** | S-07: uno stato d'incendio condiviso per gli oggetti interessati; propagazione (*fire spread*) determinata da regole di suscettibilità/prossimità; danno nel tempo e possibilità di estinzione. Velocità, intensità, condizioni meteo e materiali sono parametri **da definire**, non già concordati. | MAIN BASE · incendi/propagazione presenti |
| **S-18** | **Mantelletti** | S-06, Combat: protezioni mobili per assedianti contro il tiro difensivo; verificarne ingombro, collocazione, copertura effettiva e interazione con proiettili e incendi. | PARZIALE MAIN · modello mantlet, meccanica da collaudare |
| **S-19** | **Mangani** | S-05, S-06, S-16: macchina da lancio distinta dal trabucco; equipaggio, posizionamento, tiro e impatti che applicano la stessa matrice di danno a strutture e altri bersagli validi. | PARZIALE MAIN · modello mangano; ciclo intero aperto |
| **S-20** | **Trabucchi** | S-05, S-06, S-16: macchina da lancio con comportamento proprio rispetto al mangano; equipaggio, posizionamento, tiro e danni effettivi alle strutture. Differenze di gittata, cadenza, precisione e costo **da bilanciare**. | PARZIALE MAIN · modello trabucco; supply/IA aperte |
| **S-21** | **Torri mobili d'assedio** | S-03, S-06, S-11: movimento e ingombro sul terreno reale; accostamento valido alle mura e accesso delle unità alla sommità solo se effettivamente raggiungibile. | PARZIALE MAIN · torri mobili; IA/trasporto aperti |
| **S-22** | **Arieti scoperti e coperti** | S-03, S-05, S-06, S-25: due varianti dello stesso tipo di macchina, utilizzate da personale e dirette contro il **portone come componente separata** dalla torre-porta; distinguere l'effetto della copertura sulla protezione degli operatori e applicare i danni al bersaglio corretto. | PARZIALE MAIN · ariete porta; varianti e logistica aperte |
| **S-23** | **Scale d'assedio** | S-03, S-06, S-11: posa su tratti di muro compatibili; attraversamento reale per le unità, con difese e collisioni rispettate. | PARZIALE MAIN · scale d'assalto; integrazione IA aperta |
| **S-24** | **Attacchi con fiaccole a strutture civili e porte, con fire spread** | S-07, S-17, S-25: unità attaccanti raggiungono un bersaglio valido (edificio civile o **portone**), innescano un incendio e utilizzano **lo stesso** sistema di propagazione/danno del fuoco. Il danno al portone **non viene attribuito automaticamente alla torre-porta**. | PARZIALE MAIN · torch/fire; ordini end-to-end aperti |

| **S-25** | **Doppia durabilità della porta (torre-porta + portone)** | S-03, S-05, S-16: ogni accesso con torre-porta/portone ha **due valori meccanici indipendenti**: integrità della **torre/struttura** e integrità del **portone**. Un impatto deve identificare il componente colpito e modificare soltanto la relativa durabilità. La perdita della durabilità del portone apre l'accesso secondo le regole di navigazione, **senza azzerare automaticamente quella della torre**. Comportamento in caso di crollo della torre ancora da definire. | MAIN BASE · portone separato; #61 OPEN |

**Regola di danno confermata (16/10/2026):** attacchi normali corpo a corpo delle unità e **frecce** non diminuiscono la durabilità di **mura o torri** (compresa la struttura della torre-porta). Non basta colpire una struttura: l'azione/arma deve essere compatibile con quel bersaglio. Il **portone è un componente differente dalla torre**; la sua vulnerabilità e la tipologia di attacchi ammessi richiedono regole dedicate, senza inferire automaticamente che ogni attacco normale sia efficace. Gli attacchi incendiari con fiaccola già previsti contro il portone passano da S-17/S-24.

**Criteri di accettazione per S-05/S-16/S-25 (da verificare in implementazione):**
1. Un'unità con attacco ordinario colpisce una muratura o una torre: durabilità invariata; una freccia contro gli stessi bersagli: durabilità invariata.
2. Una sorgente **esplicitamente abilitata** ai danni strutturali colpisce una muratura/torre: viene modificato soltanto il componente effettivamente bersagliato.
3. L'accesso con torre-porta espone due durabilità separate: colpire il portone non sottrae HP alla torre; colpire la torre non sottrae HP al portone senza una regola specifica.
4. L'eventuale distruzione del portone modifica attraversabilità e stato del passaggio, non distrugge per ciò stesso la torre-porta.
5. Il medesimo stato meccanico deve essere osservabile dai sistemi di simulazione, combattimento, navigazione e dalle viste Canvas/WebGL2; QA automatica per casi consentiti/vietati e persistenza delle due durabilità.

**Sequenza tecnica proposta (non modifica le priorità M0–M3):** prima danni localizzati a mura/torri (**S-16**) e contratto unico d'incendio (**S-17**); poi fiaccole e propagazione (**S-24**) e ariete/scale (**S-22/23**) per una vertical slice; quindi mantelletti (**S-18**), mangani/trabucchi (**S-19/20**) e torri mobili (**S-21**) secondo le dipendenze di navigazione, proiettili e protezione.

**Vincoli di integrazione:** usare i sistemi già presenti di Castle/Combat, pathfinding, materiali, tick e persistenza; verificare un'unica fonte di danni/incendi e nessuna duplicazione tra renderer WebGL2 e fallback Canvas. Per passare da IDEA a IN CORSO servono specifica delle interazioni, criterio d'accettazione, QA deterministica e branch/commit di riferimento. La pianificazione delle macchine non implica che il motore d'assedio completo sia già operativo.

**Ambito di partenza consigliato:** vertical slice difesa di una fortezza con **una porta + scorte + guarnigione + danno controllato + resa**. Scale/mastio/assedi multi-accesso sono espansioni testabili successive. Le 12 funzioni di Built Sections discusse includono granaio, magazzino materiali, armeria, scuderie, cucine, officina, caserma, alloggi, cappella, sala comune, sala del trono e tesoreria: funzioni negli edifici esistenti, non necessariamente 12 nuovi edifici.

## Economia feudale e mappa del mondo (triage verificato 22/10)

| ID | Requisito | Dipende da | Stato |
|---|---|---|---|
| F-01 | Bioma determina cap/produttività, con correttivo locale; non elimina completamente beni base | M0/M1 | APERTO · biomi visivi già presenti |
| F-02 | Sviluppo di piccoli insediamenti intorno a poli economici e strade | Village Core + produzione | PARZIALE · nuclei urbani sì |
| F-03 | Capitale feudale raccoglie, immagazzina, trasforma e redistribuisce; castello presidia | M1 + stock | PARZIALE · castello/stock locali sì |
| F-04 | Più feudi versano tributi alla capitale del regno e contingenti militari | F-03 | FUTURO · tributi multi-feudo |
| F-05 | Tributi e rifornimenti importanti viaggiano come convogli con inventario e scorta | F-04 + World nav | PARZIALE · carovane della diplomazia (ex #72) in merge; convogli #55 OPEN, da unificare |
| F-06 | Intercettazione/imboscata carovana passa al Combat; bottino modifica davvero le scorte | F-05 + Combat stabile | FUTURO · trasferimento World→Combat→stock |
| F-07 | Import/export e mercato inter-feudale, eventi economici, eventuale scarsità/prezzi | F-03 + test | FUTURO · mercato locale già presente |

## Combat / world e comportamento

- **C-01 — Pattuglie:** zone controllate, sorveglianza, rotte e visione sensibili a boschi, dislivelli, costruzioni, ora del giorno.
- **C-02 — Unità e ordini:** spostamenti, formazione/ingombri, accesso alle strutture; combattimento, morale, rotta e rincorsa senza attraversare ostacoli.
- **C-03 — Wildlife:** branchi e posture che cambiano con l'ora; evitare aggressività senza causa in situazioni che richiedono neutralità.
- **C-04 — Mobilitazione:** distinguere guarnigione permanente, cavalieri alloggiati al castello e leva temporanea.
- **C-05 — Accoppiamento simulazione:** eventi World→Combat→World e assedi non visualizzati conservano identico esito delle risorse.

La presenza di `src/settlement-combat.js` prova un prototipo tattico, non tutti questi criteri. **Non importare automaticamente** regole da altri videogiochi/progetti.

## Presentazione, accessibilità, pubblicazione

- **X-01 — Renderer e performance:** modulare logica e disegno, usare SVG/Canvas e cache/culling, mantenendo una fonte sola per coordinate, z e proiezione.
- **X-02 — Illuminazione/stagioni:** **codice su main** per color grading meteorologico/stagionale [PR #43](https://github.com/erykwest/CONQUER/pull/43) e luci emissive WebGL2 [PR #47](https://github.com/erykwest/CONQUER/pull/47); **non ancora convalidato** collegamento tattico tra luce e visibilità (riduzione notturna del raggio: proposta).
- **X-03 — Suoni:** tre canali (ambiente, località/oggetti, eventi) con layer clima/stagioni e giornata; audio locale per selezione **oppure zoom ≥30%**, dissolvenze, attenuazione e limite voci. Il thread [Pixabay/Drive](sources/PIXABAY-SOUNDS-2026-10-14.md) riporta 24 MP3 repertoriati ma non ascoltati; gli asset **non sono nel repository/deployment fino a import verificato**.
- **X-04 — QA visuale:** fixture, più rotazioni camera, controlli di occlusione, verifiche manuali descritte, regressioni automatiche.
- **X-05 — Pubblicazione:** pagina CONQUER, devlog, feedback/follower, donazioni opzionali, itch.io; Steam possibile più avanti.

## Nuovi requisiti documentati negli export 12–15/10

Fonti precise: [ECONOMY](sources/ECONOMY-2026-10-12.md), [VISUAL/AUDIO](sources/VISUAL-AUDIO-2026-10-14.md), [MINIMAP](sources/MINIMAP-2026-10-15.md). I codici seguenti non sono implementazioni automaticamente confermate.

- **E-01 — Economia mista:** confermare nell'end-to-end la proprietà *lord* vs capitale L4 aggregato, compravendita delle imprese e scorte con quota 0/25/50/75/100%; **parziale nel codice**, niente agente contabile individuale.
- **E-02 — Filiera e mercato:** fonti `food/wood/stone/metal/equipment/luxury`, oro valuta; varianti pregiate **tag**, non nuovi contatori obbligatori; export solo con domanda/costi reali; **regole e motore base esistono, catena completa da validare**.
- **E-03 — Tempo e feedback militare:** giorno di lavoro → output reale, mercato sabato, riposo domenica, bilanci annuali; assedio/incursione deve interrompere la produzione senza inventari concorrenti.
- **V-01 — Renderer 3D WebGL2 vs sprite:** **CODICE SU MAIN**: castello/scena [db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697) e default WebGL2 con fallback Canvas [cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0). **RESTANO DA VERIFICARE**: confronti ripetibili su cutaway, stati di cantiere, danni, prestazioni RAM/VRAM, e pipeline finale di asset.
- **V-02 — Cache e prestazioni:** misurare 192 voci bitmap e 32 MiB nominali dei compositi, ora confrontando **WebGL2 3D predefinito e Canvas fallback**; identificare VRAM/RAM, eviction e perf prima di creare loader concorrenti.
- **V-03 — Animazioni lavoro popolani:** **MERGED SU MAIN** con sette utensili e fasi contestuali in [#71](https://github.com/erykwest/CONQUER/pull/71); restano QA visiva/performance; accessori stagionali **CODICE SU BRANCH** `feature/seasonal-clothing` (overlay guardaroba, braccio col colore del mantello). Non confondere animazioni con lavoro economico/operai L1 della #55.
- **V-04 — Audio:** streaming musica current+next, SFX e ambience on demand, crossfade, controllo licenze/tracce Suno; **DIREZIONE**, non audio già pubblicato. Fonte SFX distinta: [playlist Pixabay e inventario Drive](sources/PIXABAY-SOUNDS-2026-10-14.md), da verificare file per file.
- **UI-01 — Minimappa + LOD:** **CODICE MERGIATO SU MAIN** il 16/10 via [PR #44](https://github.com/erykwest/CONQUER/pull/44) ([2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9)); **DA VALIDARE** nel browser ISO/plan, rotazioni, selezione, fog, mobile e benchmark. Il Building LOD semplificato è nella minimappa, **non** nel mondo 3D principale.

## Requisiti per promuovere un'idea al lavoro

1. Identificare il *contratto/sistema* già esistente da riutilizzare.
2. Dare ID, proprietario di modulo, milestone, dipendenze, criterio di accettazione e test.
3. Verificare se una branch o PR ne contiene già una parte; indicare **HEAD SHA**.
4. Aggiornare la [roadmap](ROADMAP.md) solo se cambia davvero l'ordine delle priorità.
5. Chiudere soltanto con prova riportata in [STATUS.md](STATUS.md).

## Nota voice — 21 ottobre 2026 — priorità per ciclo giocabile

> Annotazione progettuale, **non implementazione né certificazione QA**. Tenere distinte funzionalità su `main`, PR aperte e test superati.

- **Core loop verticale:** territorio e risorse → popolazione e produzione → cantieri e castello → difesa e assedio → conseguenze persistenti e ricostruzione. Obiettivo: una partita completa, non sottosistemi isolati.
- **P0 economia/cantieri:** riconciliare ledger e `State.resources`, resa e calendario agricolo, assegnazione effettiva L1 ai cantieri (PR #55 aperta nello snapshot), consumo reale di risorse e tempo; impedire completamento senza operai.
- **P0 castello funzionale:** collaudare accessibilità, capienze e stock di Built Sections, magazzini, armerie, presidi e percorsi interni; geometria e accessi devono influire sulla difesa.
- **P0 assedio end-to-end:** collegare danni, terrapieni, accessi, blocco rifornimenti, fame, sortite, ripiegamento verso Mastio, conquista/resa e ricostruzione. Le meccaniche isolate già integrate non equivalgono a un assedio completo.
- **QA estensiva:** simulazione headless multi-seed e pluriennale, test di pathfinding e ricalcolo ostacoli, centinaia di scontri/assedî automatizzati, save/load in ogni stato critico, benchmark WebGL/Canvas e carichi simultanei; monitorare spike GPU rilevati in audit.
- **Design ancora da definire:** condizioni di vittoria/sconfitta, progressione della partita, IA strategica avversaria, leggibilità delle cause nei pannelli, recupero dalle sconfitte.
- **Differenziatori:** castello progettato dal giocatore come campo di battaglia fisicamente significativo; insediamenti che emergono da territorio/lavoro; guerra e assedi con conseguenze economiche persistenti.
- **Scope:** rinviare diplomazia avanzata, filiere lunghe, professioni/materiali aggiuntivi e polish grafico non necessario. Feudi/tributi/carovane solo dopo economia locale stabile.
- **Criterio di demo:** il giocatore sviluppa un insediamento, costruisce e rifornisce una fortezza, affronta un assedio con esito motivato e continua nel mondo modificato.

## Nota voice — ordine pubblico, criminalità e giustizia cittadina

> Proposta di design da valutare, **non implementata**. Trattare le punizioni pubbliche come elemento storico-sociale contestualizzato, non spettacolo grafico.

- **Criminalità urbana:** indicatore locale dinamico, influenzato da povertà, disoccupazione, carestie, densità, ricchezza commerciale, presenza di ronde e capacità di applicare le leggi. Distinguere furti, aggressioni, contrabbando e disordini senza simulare ogni reato individualmente.
- **Effetti economici:** criminalità elevata scoraggia l'insediamento di mercanti e artigiani, riduce afflusso di carovane, entrate fiscali e disponibilità di beni; sicurezza e reputazione commerciale favoriscono il mercato. Prevedere inerzia temporale, non variazioni istantanee.
- **Forze comunali:** introdurre guardie civiche o milizia urbana assegnabile a ronde interne, pattuglie delle porte, presidio del mercato, sorveglianza notturna e intervento su disordini; costo in personale, salari ed equipaggiamento; sottrazione di uomini ad altri incarichi.
- **Ordine pubblico leggibile:** eventi e feedback visibili (furto al mercato, commerciante che rinuncia a stabilirsi, pattuglia che interviene), mappa delle zone a rischio, copertura delle ronde e registro delle decisioni.
- **Giustizia e punizioni pubbliche:** possibilità di tribunale/giudizio cittadino, bandi e ammonimenti, multe, gogna, detenzione e — dove coerente con ambientazione e scelte di design — esecuzioni pubbliche. Rappresentazione sobria e non grafica; preferire evento narrativo/animazione distante, senza dettagli cruenti.
- **Conseguenze e compromessi:** sanzioni possono aumentare deterrenza nel breve periodo, ma repressione eccessiva può diminuire consenso, fiducia e immigrazione; efficacia legata anche a legittimità, proporzionalità e capacità amministrativa. Evitare la regola semplicistica 'più esecuzioni = meno crimine'.
- **Integrazioni:** connettere ordine pubblico a popolani, lavoro, economia, commercio, guardie, allarmi, calendario giorno/notte e reputazione cittadina; non creare un minigioco separato.
- **Priorità:** prima modello aggregato di criminalità, guardie/ronde e impatto sul commercio; poi eventi di giustizia e rappresentazione pubblica. QA con simulazioni su più stagioni e test di equilibrio fra sicurezza, costo delle guardie e prosperità.

## Nota voice — filiera alimentare, colture e foraggio invernale

> Proposta progettuale da valutare, **non implementata**.

- **Risorsa cibo articolata:** mantenere `cibo` come categoria aggregata per i bisogni alimentari, distinguendo sotto-risorse **carne, pesce, cereali e ortaggi**. Conservare quantità e disponibilità delle singole categorie per produzione, stoccaggio, consumo e commercio.
- **Colture e raccolto:** i campi producono una risorsa agricola grezza (`crop`/raccolto), distinta dal prodotto alimentare trasformato. Definire per tipo di coltura la destinazione: cereali per alimentazione, foraggio per animali, eventuale semina futura; non assumere che ogni raccolto richieda molitura.
- **Mulino:** introdurre una trasformazione esplicita per i raccolti cerealicoli destinati al consumo umano (raccolto grezzo → prodotto macinato/farina, oppure cereali alimentari secondo la nomenclatura finale), con resa, capacità e tempi di lavoro. La macinazione non deve essere obbligatoria per il foraggio.
- **Pascoli e allevamento:** durante la stagione favorevole il bestiame può pascolare all'aperto; durante l'inverno resta nei recinti/lotti/stalle e consuma scorte di `crop` grezzo destinato a **foraggio**, senza passare dal mulino.
- **Scorte stagionali:** bilanciare raccolto, consumo umano, mangime animale e riserva per semina. Se il foraggio non basta, conseguenze su salute, mortalità e produttività degli animali; impatto successivo sulla disponibilità di carne e altri prodotti zootecnici.
- **Dipendenze:** integrare campi, calendario e inverno, magazzini, mulini, allevamenti, consumo popolazione, mercato e ledger economico unico. Evitare duplicazione tra risorse visuali e contabili.
- **Test richiesti:** simulazioni multianno di semina/raccolta, capacità di molitura, approvvigionamento alimentare e sopravvivenza del bestiame durante inverni lunghi; verificare che i cicli siano sostenibili senza microgestione eccessiva.

## Nota voice — controlli DEV e progressione visiva dei cantieri

> Richieste di sviluppo, **non ancora implementate**. I toggle DEV non devono alterare le regole delle partite normali.

- **DEV — Instant Build:** pulsante/toggle per completare immediatamente cantieri e strutture durante i test, senza attesa del tempo di costruzione; deve valere anche per le stanze e gli allestimenti interni del castello.
- **DEV — No Resource Consumption:** secondo pulsante/toggle indipendente per disattivare il consumo delle risorse durante costruzioni, ampliamenti e allestimenti; combinabile con Instant Build per test rapidi.
- **Tempi di costruzione reali:** le stanze del castello e i loro allestimenti, attualmente istantanei secondo la segnalazione, devono entrare nel normale sistema dei cantieri con durata, costo e requisiti di lavoro, coerenti con le altre strutture.
- **Progressione visiva universale:** tutte le categorie di edifici, sia del giocatore sia delle altre fazioni/insediamenti, devono mostrare fasi costruttive progressive legate all'avanzamento effettivo, non un modello completo che appare alla fine.
- **Progressione visiva — montaggio pezzo per pezzo (prototipo su branch `feature/construction-props`, 2026-10-22):** [`settlement-construction-assembly.js`](../../src/settlement-construction-assembly.js) sostituisce il fantasma traslucido con l'edificio finito tagliato da una quota di cantiere che sale: muratura a corsi interi con l'ultimo corso posato concio per concio; telaio ligneo delle case L2+ in anticipo sul tamponamento; tetto in ritardo (puntoni → listelli → tegole dalla gronda al colmo); al 100% superficie identica all'edificio finito. Sorgenti: volumi del castello (`ConquerCastle3D.structureWorld`), modelli civici Blender, case urbane. Impalcature e gru seguono la quota reale e l'altezza locale di ogni lato (navata vs campanile; gru sul campanile). Provati: torre quadrata T2 H2, chiesa L2, casa L3 (QA statica + browser). Integrato il branch `case` (case L1–L4 con sporto, timpano su strada, torrette d'angolo, abbaini, tettoie): il montaggio usa la stessa costruzione della casa di `settlement-world3d.js` (`ConquerWorld3D.addHouse`, con etichette opzionali), riprovato su L1–L4; torrette d'angolo non provate in cantiere (richiedono incroci stradali). Estese le prove (22/10): torre tonda, porta (varco del passaggio ritagliato, ponteggi solo sui fianchi), muro e palizzata con **avanzamento orizzontale** a tratti lungo l'asse (palizzata palo per palo, geometria ricostruita da `drawPalisadePostLine`), sezione `built` (timpani distinti dal tetto), taverna, mercato. Torri e porte hanno ponteggi **su tutti i lati**: edificio e oggetti sono dipinti come un'unica immagine ordinata per profondità e messa in cache (`ConquerMesh3D.drawCached`), ridisegnata un cantiere per frame; con 10 cantieri il frame passa da ~1 s a 2–6 ms. Restano col fantasma traslucido: torri e porte in legno; camminamento/terrapieno delle palizzate T2/T3 compaiono solo a fine lavori. **Residui:** dettagli 2.5D del castello (finestre, portali, texture) assenti durante il cantiere; mura, porte, `built`, mercato, taverna e case L1/L2 non provati; nessuna animazione di posa del pezzo; nessuna verifica di prestazioni con molti cantieri.
- **Elementi di cantiere animati:** impalcature e ponteggi, gru, carrucole, sollevamento e posa di materiali, lavoratori e attrezzi; comparsa/rimozione per fase e tipologia di edificio, senza animazioni scollegate dallo stato reale del cantiere.
  - **CODICE SU BRANCH `feature/construction-props` (2026-10-22):** kit Blender [`build_construction.py`](../../tools/blender/build_construction.py) → `src/assets/construction-models.js` (scale, campata di impalcatura modulare, cumulo materiali, banco del carpentiere con sega ad arco, banco del tagliapietre, paranco, gru a ruota) e [`settlement-construction-props.js`](../../src/settlement-construction-props.js): fasi `prep` (<12%: materiali e banchi), `raise` (12–90%: impalcatura impilata da terra piano per piano con l'avanzamento sui lati verso la camera (il budget di moduli accorcia le campate, mai i piani bassi), scale per piano, paranco a terra o gru a ruota posata sopra la muratura alla quota raggiunta e rialzata con essa), `finish` (≥90%: solo impalcatura), rimozione al completamento. Pietra/mattoni seguono `masonryMaterial`; carpentiere per legno. QA statica `qa/construction-props-regression.cjs` PASS; smoke browser locale su torre, torre tonda e muro.
  - **RESIDUI:** oggetti statici (nessuna animazione di sollevamento/posa); case e strutture `auto` del villaggio escluse; nessun legame con operai L1 effettivamente assegnati (PR #55) né con le risorse consegnate; geometria della struttura non ancora progressiva (il volume finale semitrasparente avvolge la gru in quota).
- **Integrazione e QA:** sincronizzare percentuale di avanzamento, geometria, operai assegnati e risorse effettivamente spese; verificare che i due toggle DEV funzionino separatamente e insieme, non contaminino i salvataggi normali e permettano il ripristino della simulazione standard.

## Nota voice — tempi di scavo per terraforming e fossati

> Requisito progettuale da implementare; **non indica funzionalità già completata**.

- **Terraforming non istantaneo:** ogni modifica del terreno richiede un tempo di lavoro/scavo proporzionato all'entità dell'intervento; applicare la stessa logica ai **fossati**, oggi segnalati senza tempi di realizzazione.
- **Nessun consumo di risorse materiali:** il terraforming non deve consumare legno, pietra, metallo o altre risorse economiche; il suo costo fondamentale è il **tempo**, deliberatamente elevato.
- **Forte disincentivo alle modifiche estese:** rendere molto onerosi temporalmente scavi e rimodellamenti massicci, così da favorire interventi mirati a rinforzare, proteggere o adattare posizioni strategiche, invece di riscrivere liberamente il paesaggio.
- **Avanzamento effettivo:** collegare la durata a volume di terra movimentata, estensione/profondità e disponibilità di lavoratori, in coerenza con il sistema cantieri; mostrare lo scavo in fasi progressive, senza completamento istantaneo nella partita ordinaria.
- **Modalità DEV:** `Instant Build` può saltare l'attesa per test; `No Resource Consumption` non modifica i tempi di scavo, dato che il terraforming non consuma materiali già di suo.
- **QA:** verificare durata e proporzionalità per fossati piccoli/grandi e lavori di terra, sospensione/ripresa dei cantieri, save/load, navigabilità e aggiornamento delle difese durante e dopo lo scavo.

## Nota voice — meteo con effetti reali su cantieri e lavoratori

> Requisito progettuale da sviluppare, **non implementazione confermata**.

- **Meteo simulato:** condizioni meteorologiche variabili (sereno, pioggia, pioggia intensa, neve, gelo, vento forte) con durata e stagionalità, collegate al calendario già presente.
- **Impatto prioritario sui cantieri:** il maltempo deve **rallentare l'avanzamento effettivo** delle costruzioni e prolungare i tempi di completamento, senza limitarsi a effetti grafici. Intensità e tipo di fenomeno determinano penalità differenti; eventi estremi possono sospendere temporaneamente specifici lavori all'aperto.
- **Lavoratori:** produttività ridotta per attività esterne durante condizioni avverse, distinguendo dove utile i lavori al coperto da quelli esposti; evitare di penalizzare indiscriminatamente tutte le professioni.
- **Terraforming e fossati:** scavi esposti particolarmente sensibili a piogge intense, gelo e neve, sommando l'impatto meteorologico ai tempi già volutamente elevati.
- **Feedback al giocatore:** mostrare causa e peso del rallentamento nei pannelli del cantiere (es. `Rallentato dalla pioggia`) e aggiornare le stime di completamento in modo comprensibile.
- **Modalità DEV:** `Instant Build` deve permettere test immediati anche con meteo avverso; in partita normale il meteo incide sempre sulla produttività.
- **QA/bilanciamento:** simulare cantieri in tutte le stagioni e condizioni, verificare accumulo corretto dell'avanzamento, pause/riprese, salvataggi e assenza di blocchi permanenti; evitare che il clima renda impossibile la progressione.

## Nota voice — spedizioni militari, convogli di rifornimento e accampamenti d'assedio

> Proposta progettuale da sviluppare, **non implementazione confermata**. Riutilizzare dove possibile il sistema esistente di accampamento notturno delle truppe.

- **Invio di contingenti:** introdurre una meccanica per organizzare e spedire contingenti militari fuori dall'insediamento, con destinazione, percorso, composizione, tempi di marcia e ordini di missione, inclusi attacco e assedio.
- **Carri di rifornimento:** consentire carri logistici che accompagnano le colonne militari, trasportando provviste e materiali; scorte finite, consumo durante marcia e permanenza, possibilità di rifornimento e vulnerabilità dei convogli.
- **Due modalità di campo:** distinguere l'**accampamento notturno automatico**, temporaneo e leggero, da un **accampamento militare persistente** che il comandante attaccante può scegliere di insediare vicino all'obiettivo e mantenere durante un assedio.
- **Campo d'assedio costruibile:** offrire un sottoinsieme deliberatamente limitato del Builder: tende/zone di riposo, area deposito e carri, **palizzate leggere**, **torri di avvistamento** e pochi accessi difensivi. Non replicare l'intero catalogo di edifici e fortificazioni del castello.
- **Costruzione e vincoli:** realizzazione progressiva con tempo, lavoratori/soldati assegnati e materiali trasportati o reperiti; la posizione e il perimetro del campo influiscono su visibilità, sicurezza, percorsi e capacità di lanciare attacchi.
- **Assedio integrato:** il campo persistente diventa base operativa dell'attaccante per presidiare il territorio, organizzare sortite/assalti, accumulare rifornimenti e mantenere un blocco; il difensore può tentare incursioni contro campo e carri, interrompendo la logistica.
- **Persistenza e UX:** il campo resta finché non viene smantellato, abbandonato o distrutto; distinguere chiaramente nel comando UI 'bivacco notturno' da 'stabilisci campo d'assedio'.
- **QA:** testare spedizioni, consumo scorte, continuità dei carri, costruzione delle difese leggere, pathfinding di grandi colonne, assalti/sortite, interruzione rifornimenti e save/load durante assedi lunghi.

## Nota voice — navigazione mercantile e militare (orizzonte futuro)

> **Backlog di lungo periodo**, non priorità per il ciclo giocabile attuale; nessuna implementazione richiesta ora.

- **Navi mercantili:** prima versione navale orientata a trasporto e commercio, riutilizzando per quanto possibile le dinamiche logistiche già previste per i carri (carico, scorte, itinerario, trasferimento di risorse, destinazioni, rischio/intercettazione). Capacità indicativa di **circa dieci carri per nave**, valore iniziale da bilanciare.
- **Vincoli di navigazione:** porti e punti d'imbarco/sbarco, percorsi sull'acqua, tempi di viaggio, capacità di carico e collegamento al sistema economico; preferire una prima iterazione senza combattimento navale.
- **Navi militarizzate:** evoluzione successiva con **baliste** imbarcate e trasporto di truppe, inclusi **arcieri e fanti**; imbarco/sbarco, spazio disponibile e supporto alle operazioni militari costiere.
- **Combattimento navale:** riconosciuto come sottosistema complesso (movimento, ingaggi, armi di bordo, unità trasportate e possibile abbordaggio). Rimandare progettazione dettagliata e implementazione a una fase successiva, evitando che blocchi economia, cantieri e assedi terrestri.
- **Sequenza suggerita:** commercio marittimo e navi-cargo → trasporto truppe → armamento e scontri navali. Testare a ogni fase la compatibilità con convogli terrestri, risorse e persistenza.

## Nota voice — varianti regionali e commercio interregionale (lungo periodo)

> **Visione di lungo periodo, non implementata.** Distinguere quattro ambientazioni/istanze di gioco da quattro server fisici: l'eventuale architettura di hosting va decisa solo in seguito, in base a necessità reali.

- **Core comune:** mantenere un unico motore e le medesime meccaniche di base, variando anzitutto asset, materiali, architetture, vegetazione e atmosfera per area geografico-culturale; introdurre solo in seguito differenze leggere di produzione e disponibilità delle risorse.
- **Ambito regionale:** attuale riferimento visivo **Europa centrale**; possibile variante **Europa mediterranea** (Italia/Spagna, già in parte suggerita dagli edifici in `clay`); possibile variante **area araba/mediorientale** con proprio repertorio edilizio e ambientale. La proposta cita **quattro istanze principali**, ma definisce per ora solo tre ambiti: **quarta regione da definire**, senza inventarla.
- **Beni locali ed esotici:** valutare produzione regionale di **vino** e altri beni distintivi, oltre a merci importate come **spezie** e vini di altre regioni; le merci esotiche possono esistere inizialmente solo come prodotti di commercio, senza richiedere una filiera locale completa.
- **Geografia commerciale:** attribuire rilevanza alle rotte marittime e ai collegamenti verso regioni/climi più settentrionali o meridionali; disponibilità, prezzo e convenienza dei beni dipendono da provenienza, accessibilità e trasporto.
- **Architettura e scope:** preferire configurazioni/data pack regionali sopra una simulazione condivisa, evitando quattro fork divergenti del codice. Prima consolidare economia, trasporti e gameplay locale; poi introdurre asset regionali, mercati interregionali e infine eventuali piccole differenze meccaniche.

## Nota voice — revisione urgente pannelli amministrativi e dashboard storiche

> **Priorità alta, richiesta di sviluppo; non ancora implementata.** I grafici devono rappresentare dati reali della simulazione, non valori fittizi.

- **Riorganizzazione pannelli amministrativi:** dashboard leggibili, ispirate ai gestionali strategici, per comprendere rapidamente stato, cause e tendenze dell'insediamento.
- **Economia nel tempo:** grafici storici dei flussi di produzione, consumo, importazioni, esportazioni, scorte, entrate e uscite; evidenziare surplus, deficit e colli di bottiglia per risorsa.
- **Mercato:** andamento nel tempo dei prezzi delle singole merci, disponibilità, domanda/offerta e oscillazioni; distinguere chiaramente prezzo attuale e storico e spiegare quando la variazione è dovuta a carenza o abbondanza.
- **Popolazione:** andamento pluriennale della popolazione con nascite, morti, immigrazione/emigrazione e, se già disponibili nella simulazione, categorie sociali/lavorative; visualizzare crescita o declino e relative cause.
- **Interazione e leggibilità:** filtri per risorsa e periodo, scale temporali coerenti con calendario del gioco, tooltip e indicatori sintetici con collegamento ai dettagli.
- **Prerequisito tecnico:** verificare quali serie storiche esistono davvero; aggiungere raccolta periodica e persistenza di snapshot aggregati solo dove mancano, usando un unico ledger economico affidabile. Evitare grafici che inventino storico o prezzi in assenza di meccaniche reali.
- **QA e prestazioni:** confrontare valori dei grafici con stato effettivo della simulazione, testare salvataggio/caricamento e anni multipli, mantenere basso il costo di aggiornamento UI.
- **Sequenza suggerita:** prima pannelli economia/mercato/popolazione con serie disponibili, poi approfondimenti e strumenti di confronto; la complessità UI può essere contenuta, ma va verificata la disponibilità dei dati storici.

## Nota voice — abbigliamento stagionale e meteo degli abitanti

> **CODICE SU BRANCH `feature/seasonal-clothing` (23/10/2026), non ancora su main.** Scelta: **overlay a strati** sopra la figura procedurale, non skin alternative. Catalogo di 9 capi in `src/settlement-wardrobe.js`, visibile nell'Asset Lab (formato «Abbigliamento»). Restano aperti: QA visiva in partita con molti abitanti, performance misurata, la «temperatura» (oggi solo mese + meteo) e le divise/attrezzi professionali (i soldati non indossano capi stagionali).
>
> - **Pioggia/temporale:** mantella cerata + cappuccio per tutti, in ogni stagione.
> - **Inverno:** mantello per classe (pelle di pecora popolani, lana artigiani, pelliccia mercanti) aperto sul davanti per lasciare visibile la tunica di classe; berretto di pelliccia o cappuccio di lana; con neve tutti col cappuccio.
> - **Estate serena:** cappello di paglia (75% popolani, 45% artigiani, 30% mercanti); niente con la nebbia.
> - **Mezze stagioni ventose/nebbiose:** scialle di lana per circa il 45%.
> - **Colori per classe (tuniche e capi in tessuto):** L1 grigio/beige, L2 verde/marrone, L3 colori primari desaturati, L4 colori primari accesi. Cappucci di lana, mantelli, scialli e mantelle cerate (più scure) prendono la palette della classe ed evitano il colore della tunica; paglia, pelliccia e pelle di pecora restano nei colori naturali. Lavoratori anonimi e brigata antincendio sono L1.
> - **Transizioni:** novembre e marzo vestono ~45% degli abitanti per l'inverno, maggio e settembre ~40% per l'estate; chi indossa il mantello a novembre lo tiene a dicembre. Il meteo cambia per giorno, quindi la pioggia veste tutti insieme.

- **Skin stagionali dei popolani:** in inverno usare pelli, tuniche pesanti e mantelli; in estate cappelli di paglia e tuniche corte/leggere.
- **Pioggia:** aggiungere mantelli antipioggia o coperture appropriate durante le precipitazioni, indipendentemente dalla stagione.
- **Selezione automatica:** variare l'abbigliamento in funzione di stagione, temperatura e meteo corrente, senza richiedere microgestione al giocatore; conservare ruolo e riconoscibilità del personaggio.
- **Integrazione grafica:** riutilizzare animazioni e scheletri esistenti, prevedendo varianti di equipaggiamento/overlay compatibili con movimento e lavoro; evitare cambi istantanei visivamente incoerenti se possibile.
- **Priorità e QA:** miglioramento visivo successivo alla meccanica del meteo; verificare performance con molti abitanti, corrette transizioni stagionali e nessuna interferenza con divise/attrezzi professionali.

## Nota voice — overlay DEV FPS e grafico prestazioni (30 secondi)

> Funzionalità richiesta per il backlog; **non implementata**.

- **Overlay in gioco:** visualizzare in alto a sinistra un contatore FPS aggiornato in tempo reale e un piccolo grafico scorrevole degli **ultimi 30 secondi**.
- **Controllo DEV:** aggiungere un toggle nel pannello DEV per mostrare/nascondere l'overlay senza riavviare la partita; disattivabile per non interferire con l'interfaccia ordinaria.
- **Rilevazione lag:** rendere evidenti cali improvvisi di FPS e picchi di frame time; privilegiare una traccia dei tempi per frame (ms) oppure affiancarla agli FPS per distinguere meglio gli spike.
- **Impatto minimo:** campionamento e rendering dell'overlay leggeri, buffer temporale limitato a 30 secondi e nessun costo significativo quando disattivato.
- **QA:** verificare accuratezza, comportamento in pausa e a differenti frame rate, corretto reset della finestra temporale e funzionamento su renderer supportati.
- Navi: salvare la livrea con la nave quando la flotta verrà persistita (oggi è solo runtime).
- Pescatori: pesce come bene a parte e pescheria al mercato; percorso delle barche che evita moli e altre navi; il pescatore a piedi tra casa e molo.
- Uscite via mare: navi mercantili che entrano ed escono dalle 3 uscite di mare; rimuovere nei salvataggi vecchi la strada già costruita verso il mare.
- Cantiere navale: annullare un ordine; navi straniere e mercantili che usano le uscite via mare.
- Navi mercantili: carovane mercantili L4 via mare quando i viaggi L4 diventeranno fisici.
- DEV: togliere il blocco `Fai arrivare qui` dal pannello del molo (`ConquerFleet.devPierHtml`) quando non serve più.
- Navigazione: evitamento laterale (oggi chi sta dietro aspetta e basta); rotte ricalcolate se un molo viene costruito mentre una nave è in viaggio.
- Navi militari: più battaglie navali insieme (oggi una sola alla volta), scorta dei convogli, comandi dal pannello (segui; Attracca fatto).


### CIRCLE — 2026-10-28
2026-10-28 — CIRCLE skeleton (branch `circle`): domain states, barrier eligibility, compartment/depot contracts, deep-first storage, capture ledger and civilian fallback added. TODO: actual geometry loops, natural terrain impassability, gate/access orientation, siege control, civilian pathfinding, persistence, runtime integration, visual and automated regression.


### CIRCLE — avanzamento 2026-10-29 (branch `circle`)
- **Fatto nel branch:** detector di compartimenti chiusi (fortificazioni complete, scarpate ripide, mare/montagne, terraforming), due settori laterali, cerchie annidate, taglio brecce, accessi gate aperto/chiuso, ponti praticabili, profondità e collegamenti, API `window.ConquerCircle`.
- **Aperto:** verifica visuale e prestazionale su scenari reali; interfaccia debug/overlay; identità persistente dei compartimenti; aggancio a controllo militare/ingressi nemici (scale, torri d'assedio); scelta sicura delle destinazioni di fuga e relativa IA; accessi lato costruzioni, deposito interno per built senza ingresso certo; scorte fisiche e produzione settoriale; QA end-to-end e protezione regressioni di navigazione.
- **Vincolo:** edifici civili, recinti e siepi non chiudono compartimenti; le zone dipinte white/yellow/green non vengono sostituite. Le brecce non implicano automaticamente conquista.


### CIRCLE — stato invaso/sicuro — 2026-10-29
- **Branch `circle` presente:** classificazione militare sulle posizioni reali delle unità, con distinzioni minaccia da scala, infiltrazione sulle mura, invasione a terra, contesa con difensori, allerta e sicuro; readout Combat e API read-only; refresh durante tick, spawn, eliminazione nemici, pennelli/allarmi. Test di controllo, topologia e adapter aggiunti. **Presente nel branch:** `markBreach` conserva un compartimento assediato come `compromised`, non sicuro, fino alla ricostruzione; la presenza nemica lo porta a `invaded` senza conquistarlo.
- **Da completare:** serializzazione e identità stabile tra salvataggi dei compartimenti compromessi (il mantenimento dopo breccia d'assedio funziona solo nella sessione attiva); controllo e cattura confermata, riconquista e ripristino della sicurezza; connessione all'IA ritirata civili e al sistema economico (depositi localizzati, perdita scorte solo alla conquista, produzione residuale), test browser, regressione reale e profiling. Distinguere effetti delle truppe sulle mura da vera occupazione a terra.
- **Non cambiare:** white/yellow/green zone territoriali e gestione della nebbia di guerra non definiscono il possesso militare.


### CIRCLE — prossimo lavoro dopo la conquista (29 ottobre 2026)
- **Fatto solo su `circle`:** certificazione automatica dopo occupazione non contestata per 0,5 giorni di gioco, persistenza `captured`, perdita one-shot delle scorte assegnate alle stanze conquistate, capacità disabilitata fino a riconquista; ricattura dopo 0,5 giorni con difensori presenti, senza restituire le risorse sottratte.
- **Ancora da fare:** A) ritirata progressiva dei civili attraverso i portali effettivamente aperti verso il compartimento contiguo più sicuro; B) produzione residua negli edifici dei compartimenti non invasi e riduzione della manodopera disponibile; C) bottino lato assalitore e pannello logistico per singolo deposito; D) browser QA reale, benchmark performance, ID di settore di lunga durata oltre la ricostruzione procedurale, verifica collisioni/porte e scenari complessi di assedi simultanei.
- **NOTA:** la distribuzione dello stock per stanza è un'allocazione deterministica, non una simulazione di trasporto con popolani; l'economia `ConquerEconomy` e le risorse builder NON sono state fuse.


### CIRCLE — QA baseline 29 ottobre 2026
- **Verificato:** Node 22 CI [run #40912609993](https://github.com/erykwest/CONQUER/actions/runs/40912609993), 65/65 PASS; workflow automatico attivo su `circle`.
- **QA aperta:** prova gameplay browser sulla branch `circle`, assedio contemporaneo di cerchie concentriche/radiali, salvataggi dopo molte campagne, prestazioni della topologia raster e controllo UI in pausa.


## Campi L2 — 05/11/2026

D-051 risolta per scelta dell’utente: campi solo L2. Recupero residuo jobmanager nel branch fix/fields-l2-only; chiusura dopo merge e rimozione della branch storica.
