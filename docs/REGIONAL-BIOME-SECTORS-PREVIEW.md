# Prova: biomi limitrofi e corner di blending

05/11/2026 — branch `experiment/regional-biome-sectors`, base main `15070d2`. Prototipo cartografico separato dal Builder: aprire `lab/biome-sectors.html` direttamente nel browser o tramite un server statico.

## Domanda

Possiamo rendere più ricca la mappa locale ereditando il paesaggio circostante dalla mappa regionale?

## Schema della prova

- Mappa 200×200 U, buildable zone centrale 100×100 U, coerenti con le costanti correnti del Builder.
- Il centro mantiene il bioma della zona selezionata. È un limite di costruzione, non un muro.
- Quattro fasce laterali N/E/S/O ereditano i vicini, configurabili nella fixture.
- Quattro quadrati 50×50 U agli angoli mescolano i biomi dei due lati adiacenti. La vista schematica mostra una miscela 50/50; quella naturale pesa la vicinanza ai lati.
- Seed ripetibile e raccordo 0–20 U verso il centro; nessuna scrittura di salvataggi o stato di gioco.

## Vincolo regionale verificato

`CONQUER_WORLD_LAB.html` costruisce celle Voronoi in `buildVoronoi`, poi le aggrega. `conquerNeighbors` ricava i confinanti distinti dagli archi condivisi, senza fissarne il numero a quattro. `conquerMacroAdjacency` filtra inoltre le adiacenze terrestri per le aggregazioni politiche. Il semplice contatto a un vertice non vale come arco condiviso.

Quattro ingressi cardinali sono una semplificazione della fixture, non il contratto della mappa regionale. Prima di integrare: trasmettere tutti i confinanti reali con direzione e tratto di confine, consentire più influenze per lato e preservare connessioni idrologiche e orografiche. Non scegliere quattro vicini arbitrariamente.

## Esito e limiti

La prova rende confrontabili schema e paesaggio. L'accettazione visiva resta all'utente. Non genera mesh, collisioni, coste percorribili o fiumi connessi; non usa i vicini di una partita. Il rendering è illustrativo e non sostituisce le ricette esistenti. Nessuna modifica agli asset o ai renderer del gioco: l'audit Asset Lab non è pertinente a questa fixture cartografica.

Verifiche: sintassi JS, classificazione e pesi su tutta la mappa, conservazione del centro; browser desktop/mobile, variazione seed e ripetibilità del disegno. Nessuna certificazione del generatore Builder o dell'integrazione regionale.
