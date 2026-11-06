# Prova: biomi limitrofi e corner di blending

05/11/2026 — branch `experiment/regional-biome-sectors`, base main `15070d2`. Prototipo cartografico separato dal Builder: aprire `lab/biome-sectors.html` direttamente nel browser o tramite un server statico.

## Domanda

Possiamo rendere più ricca la mappa locale ereditando il paesaggio circostante dalla mappa regionale?

## Schema della prova

- Mappa 200×200 U, buildable zone centrale 100×100 U, coerenti con le costanti correnti del Builder.
- Il centro mantiene il bioma della zona selezionata. È un limite di costruzione, non un muro.
- Quattro fasce laterali N/E/S/O ereditano i vicini, configurabili nella fixture.
- Quattro quadrati 50×50 U agli angoli mescolano i biomi dei due lati adiacenti. Aggiornamento: quattro vicini diagonali configurabili occupano i corner esterni 25×25 U. In entrambe le viste il peso centrale è (1-h)(1-v), i due vicini laterali pesano h(1-v) e v(1-h), il diagonale pesa hv. h e v crescono con smoothstep da 0 a 1 nei primi 25 U fuori dal centro. Nessuna discontinuità passando dai lati ai corner.
- Sequenza fissa lungo ciascun asse: 25 U di bioma limitrofo, 25 U blending, 100 U centro, 25 U blending, 25 U limitrofo. Seed ripetibile; nessuna scrittura di salvataggi o stato di gioco.

## Vincolo regionale verificato

`CONQUER_WORLD_LAB.html` costruisce celle Voronoi in `buildVoronoi`, poi le aggrega. `conquerNeighbors` ricava i confinanti distinti dagli archi condivisi, senza fissarne il numero a quattro. `conquerMacroAdjacency` filtra inoltre le adiacenze terrestri per le aggregazioni politiche. Il semplice contatto a un vertice non vale come arco condiviso.

Otto ingressi direzionali (quattro laterali e quattro diagonali) sono campioni configurabili della fixture, non otto confinanti garantiti dalla mappa regionale. Prima di integrare: trasmettere tutti i confinanti reali con direzione e tratto di confine, consentire più influenze per lato e preservare connessioni idrologiche e orografiche. Non scegliere quattro vicini arbitrariamente.

## Esito e limiti

La prova rende confrontabili schema e paesaggio. L'accettazione visiva resta all'utente. Non genera mesh, collisioni, coste percorribili o fiumi connessi; non usa i vicini di una partita. Il rendering è illustrativo e non sostituisce le ricette esistenti. Nessuna modifica agli asset o ai renderer del gioco: l'audit Asset Lab non è pertinente a questa fixture cartografica.

Verifiche: sintassi JS, classificazione e pesi su tutta la mappa, conservazione del centro; browser desktop/mobile, variazione seed e ripetibilità del disegno. Nessuna certificazione del generatore Builder o dell'integrazione regionale.

## Spline di confine (05/11/2026)

Fiume e dorsale sono livelli lineari distinti dalla superficie. Il bioma Fiume rappresenta la piana fluviale senza canale centrale. Per ciascun elemento sono configurabili quattro lati, quattro raccordi ad angolo e assenza. Curve Bezier cubiche nella fascia esterna di blending: direttrice a 12 U dal limite buildable, escursione dei controlli 9 U per meandri ampi del fiume, 2 U per la dorsale più lineare. Corner raccordati con archi cubici di raggio 12 U. Gli estremi sul bordo esterno sono stabili al cambiare del seed; le curve non entrano nel centro. Il seed determina il verso delle deviazioni.

QA: 16 percorsi verificati per ripetibilità, continuità dei campioni, estremi sul bordo e assenza di attraversamento del centro. Ampiezza del fiume superiore alla dorsale. Resa browser delle due spline verificata. Quote e pendenze idrauliche, foce, erosione, conflitti tra fiume/dorsale, valichi e confini regionali condivisi non implementati. I colori della superficie montuosa restano illustrativi: la dorsale lineare si configura separatamente.

## Correzione vincolante: anse interne

Supera il precedente requisito di assenza di attraversamento: il fiume deve entrare nella buildable zone per almeno 25 px sulla tavola di riferimento. Ampiezza 24 U rispetto alla direttrice esterna di 12 U: picchi interni di 12 U, equivalenti a 36 px sul canvas 600 px. La misura in pixel riguarda il canvas di riferimento; il ridimensionamento CSS scala la vista. La dorsale resta esterna e invariata. Tutti gli otto percorsi fluviali raggiungono la penetrazione, con entrambi i versi delle deviazioni. L'interno non è più garantito libero dall'acqua; collisioni e costruibilità effettiva da integrare nel Builder.

## Fiume nel Builder

Il generatore reale makeEnvWater delega i fiumi a makeBoundaryRiver. Quattro anse Bezier ampie e continue seguono un lato buildable selezionato deterministicamente dal seed (assenza di confini regionali collegati). La direttrice è 12 U fuori dal bordo, le anse entrano per 12 U. Il risultato conserva il formato ambiente river, width 4.4 U: collisioni, navigation, sponde e renderer esistenti consumano la stessa geometria. I ruscelli mantengono la ricetta attuale. Nessuna migrazione distruttiva delle mappe salvate: serve una mappa nuova o rigenerata nel bioma Fiume. Lo schema a otto biomi e le dorsali restano nel laboratorio separato.

QA runtime: 42 mappe biomi, 64 generazioni di fiume con centro libero e acqua interna che impedisce costruzione, 36 verifiche urban. Test boundary-river-regression.cjs raccolto automaticamente dalla CI qa/*-regression.cjs.

## Meandri proporzionati alla larghezza (supera il pattern Bezier)

Riferimento richiesto: https://divisbyzero.com/2009/11/26/the-geometry-of-meandering-rivers/ ; fonte primaria: https://www.usgs.gov/publications/river-meanders-0 . Le relazioni empiriche lambda circa 11w e r circa 2.3w sono riferimenti morfologici, non leggi esatte per ogni ansa.

Nel Builder il modello integra x'=cos(theta), y'=sin(theta) a passi di lunghezza; theta varia dolcemente lungo ogni semimeandro. Ciascuna ansa ha raggio 2–3w, apertura 1–1.5 radianti e lunghezza derivata dal raggio. Il seed modifica questi parametri e il tratto iniziale, non solo lato e specchiatura. Nessun ridimensionamento o clipping deforma le curve per adattarle alla mappa: vengono selezionati candidati validi e traslati rispetto al bordo buildable. La penetrazione garantita resta almeno 25 px sul canvas di riferimento; il picco selezionato entra per 9–12 U, con massimo globale di 20 U. Modello geometrico statico, non simulazione di erosione o soluzione idraulica.

QA: test negativo sul vecchio generatore (solo due sagome distinte normalizzate), poi PASS su 64 mappe reali con almeno 60 forme distinte e 2.000 curve con limiti e penetrazione. Rapporto r/w verificato. Regresioni biome-recipes e save-safety PASS.

## Traslazione interna 15 U (policy 3)

Il corso accettato dal modello precedente viene traslato rigidamente di 15 U verso il centro: +x dal lato ovest, -x da est, +y da nord, -y da sud. Nessuna modifica alle anse o ai candidati del seed. Picchi trasversali selezionati a 24–27 U dentro il bordo; massimo globale 35 U. Il centro (100,100) resta libero. Applicazione alle nuove generazioni, senza migrazione automatica delle mappe salvate.

## Navigazione e situazioni demo per il bilanciamento

Dal link Mappa regionale del Builder si apre il World Lab. Selezionare un territorio singolo, poi Apri mappa locale del territorio. La demo usa la ricetta del terreno centrale, oppure Fiume se un confine regionale fluviale tocca il territorio; i vicini reali sono mostrati come contesto, senza dichiarare integrata la composizione a otto biomi. Il seed deriva stabilmente da seed regionale e ID territorio. Nessun salvataggio della partita viene caricato o sovrascritto; cloud disconnesso. Session storage trasporta il contesto e conserva una copia esportata della regione per il ritorno con selezione. Dati demo mancanti aprono una demo Pianura isolata, mai la partita reale.

Scenari rapidi: Pianura, Colline, Foresta, Fiume, Montagne e Costa, tutti con seed 4242. Nessuna modifica ai quantitativi: valori attuali per la prima valutazione dell'utente. Pannello con conteggi di boschi, rilievi terrazzati, cime principali, fiumi e ruscelli; coperture stimate per boschi, acqua, montagne e terrazze sia sull'intera mappa che nel buildable 100×100, griglia 40×40 per area. Coperture non additive. Aggiorna misure dopo cambi alla mappa. Metriche per le prossime scelte quantitative, non un bilanciamento approvato.

QA: navigazione browser territorio → demo → ritorno con stessa selezione; seed e confinanti trasmessi; player save preservato e cloud assente. Regressione regional-demo per validazione e isolamento, save-safety, biome-recipes e boundary-river. Limite preesistente World Lab: mancano gli otto SVG ICON/Mountain, richieste 404; i territori e i confini restano navigabili.

## Territori senza supercelle

Richiesta 05/11/2026: eliminare i raggruppamenti geografici di supercella. Rimossi unione/separazione, creazione di gruppi per laghi contigui, render di etichette e confini aggregati e serializzazione dei gruppi. Gli import legacy ignorano superCells; i singoli territori e i terreni restano intatti. La selezione multipla è ancora disponibile per modifiche collettive, senza fusione. I layer politici/feudali mantengono i propri domini, distinti dalle supercelle geografiche.

QA: sintassi degli script inline e browser regione → territorio → demo → ritorno. Verifica con JSON legacy contenente due territori raggruppati: stesso numero di territori/etichette, nessun gruppo riattivato e comandi di fusione/separazione assenti.

## Correzione: nessuna aggregazione di celle Voronoi

La prima rimozione riguardava solo le fusioni di territori, ma lasciava dettaglio 4 e pesi per bioma 1/2/4/6: il raggruppamento visibile era ancora presente. Ora dettaglio 1 fisso e peso 1 per tutti i terreni; anche le isole modificano singoli territori senza fonderli. Guard finale dopo generazione di acqua e isole: ogni territorio contiene esattamente una cella. Default 30×21: 630 celle, 630 territori, 630 etichette. Verificato nel browser su quattro seed. Topologia precedente incompatibile: i vecchi JSON aggregati sono rigenerati con avviso, senza applicare nomi o interventi ai nuovi ID sbagliati; il file originale non viene modificato.

Recuperati Mountain 1.svg–Mountain 8.svg dalla cartella ARQE indicata dall'utente, copie byte per byte in ICON/ del repository. Otto risposte HTTP 200 e SVG validi; risolto il precedente limite degli asset montagna mancanti.

## Correzione del bioma centrale

Scope scelto: prima la cella centrale. Il modulo condiviso regional-biome-rules.js definisce plain→plains, forest→forest, hills→mountains (categoria montuosa della legenda regionale), sea→sea, swamp→swamp, lake→lake. Palude e Lago hanno ricette esplicite: piccole zone boscate, pozze e ruscello per Palude; bacino centrale per Lago. Valori iniziali per la successiva revisione quantitativa.

Il confine fluviale aggiunge un fiume alla ricetta terrestre anziché sostituire il bioma. La normale degli archi regionali determina i lati candidati. Il link include il contesto della cella, quindi funziona senza sessionStorage della scheda di origine. Dati mancanti/non validi bloccano la vista locale con errore esplicito, senza caricare partita o aprire una finta Pianura.

QA: sei mapping e URL senza archivio di sessione; Foresta con fiume resta Foresta e ha acqua reale sul lato richiesto; Palude con pozze, Lago con acqua centrale, Montagne con cime reali. Browser: selezione di Foresta e Montagne dalla regionale e ricaricamento dopo rimozione del contesto temporaneo. Otto influenze, fasce e corner restano fuori scope.
## Integrazione degli otto settori — 06/11/2026

06/11/2026 — REG-EIGHT-BIOMES (branch sperimentale, non main): apertura regionale con otto campioni direzionali sulla geometria Voronoi reale. Fasce 25/25/100/25/25 U, corner esterni 25×25 del diagonale e blending a prodotto. Composizione ingame di suolo, boschi, acqua con isole/fori e rilievi; il centro usa la propria ricetta. Fiumi esistenti preservati. Demo Fronte misto disponibile; test determinismo, collisioni, pesi e diagonali PASS. Bilanciamento quantitativo e dorsali continue restano aperti. Le vecchie demo senza campioni vanno riaperte dalla regionale.

La demo `index.html?demo=mixed&seed=4242` combina Pianura centrale, Montagne a nord, Foresta a est/ovest e Mare a sud, con diagonale sud-est asciutto. Composizione su griglia 2 U, contorni vettoriali con fori e terreno sfumato. I rilievi centrali sono adattati al quadrato centrale; picchi e terrazze limitrofi vengono distribuiti nei propri settori. Non costituisce ancora una dorsale spline continua. Mare e laghi sono ostacoli reali, non soltanto colore. Il primo servizio costiero legacy continua a operare sulla costa principale. QA: `qa/regional-surroundings-regression.cjs`.
