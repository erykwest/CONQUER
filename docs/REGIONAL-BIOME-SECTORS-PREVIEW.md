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
