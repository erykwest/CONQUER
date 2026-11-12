# CONQUER — URB-HEAT-01 · Skeleton territoriale (12/11/2026)

## Stato e limiti
**Solo skeleton su branch feature, non sistema urbano funzionante.**
Il modulo `src/settlement-urban-heatmaps.js` è esposto come `window.ConquerUrbanHeatmaps` ed esportato in CommonJS per QA. Non legge `State`, non modifica edifici, occupanti, risorse, catasto o salvataggi; non attiva alcun tick di crescita né overlay nel Builder. I coefficienti iniziali sono **dimostrativi**, non un bilanciamento approvato.

## Decisioni di prodotto
- Classi sociali: L1 braccianti/contadini/pastori/minatori; L2 artigiani; L3 borghesia istruita (mercanti, scribani, magistrati); L4 esclusivamente nobiltà, possessi e rendite.
- Residenziale: prestigio L1–L4 + densità di lotto D1–D3 = 12 archetipi teorici. Il prestigio identifica **l'edificio** e i suoi occupanti; un cambio proprietario/ceto che modifichi il prestigio implica la **ricostruzione completa dal nuovo template**, incluse caratteristiche interne. Non si conserva una skin indipendente dagli spazi.
- Densità riferita al **lotto**, non necessariamente ai piani: un lotto può contenere più corpi o un solo edificio verticale. Il catasto Voronoi esistente resta autorevole.
- Quattro heatmap concettuali: **domanda abitativa**, **prestigio/degrado**, **sicurezza**, **criminalità**. La prima ha quattro canali L1–L4, per un totale di **sette campi scalari** territoriali.
- La criminalità non è più soltanto un indicatore globale nel progetto finale: è territoriale; un aggregato del villaggio può rimanere per UI/reporting. Non creare un secondo motore Crime parallelo.

## Contratto del motore V0
- `at(x,y,sources,base)`: calcola i sette valori normalizzati in [0,1] per un punto.
- `createGrid({originX,originY,cellSize,width,height,sources,base})`: griglia deterministica in memoria con sette `Float32Array`; massimo provvisorio 65.536 celle. **Nessuna persistenza**.
- `sample(grid,x,y)`: interpolazione bilineare dei canali.
- `sampleLot(grid,lot)`: media di centroide e vertici di `lot.points`, senza cambiare la geometria catastale.
- `evaluateLot(grid,lot,{waiting,available})`: sola anteprima; domanda effettiva per ceto = idoneità locale × pressione di famiglie non alloggiate, restituisce ceto candidato e densità D1–D3. Nessuna ricostruzione.
- `LANDMARKS`: profili provvisori per piazza, mercato, lavoro, bottega, municipio/servizi, castello, giardini, industria, strade, guardie, protezione mura e reati. Influenzano più canali, anche con segni opposti.
- Sorgenti radiali `{kind,x,y,radius,strength?}` con decadimento quadratico; alternativa poligonale `{kind,polygon:[{x,y},...]}` per regioni interne alle mura. Nessuna interpolazione attraverso la rete stradale: la distanza per cammino è una fase successiva.

## Companion: effetti sociali degli eventi (CIV-EVT-01)

[Lo skeleton degli eventi](CIVIC-EVENT-EFFECTS-SKELETON.md) usa `ConquerUrbanHeatmaps.at` per proiettare il prestigio temporaneo di fiere, giostre e feste **solo a scopo di preview**. È un modulo autonomo, caricato ma inattivo: nessuna modifica a `LANDMARKS`, `State`, edifici, residenti o scheduling.

## Migrazione sociale SOC-CLASS-02

La conversione dei ceti già codificata sullo stesso branch è descritta in [CIVIL-CLASS-MIGRATION](CIVIL-CLASS-MIGRATION.md): salva il censimento e la proprietà senza attivare la crescita urbana. Gli adapter dei quattro canali di domanda rimangono invece inattivi, e D1–D3 resta solo metadato dei lotti esistenti.

## Dipendenze di integrazione — NON implementate
1. **Dati affidabili:** adapter da `State.structures` (pozzo, piazze, civici, industrie, lavoro), viabilità e accessi, mura **chiuse e valicabili**, presidio/guardie, eventi e rischio del sistema Crime. Mantenere Crime come fonte primaria, non due indici in competizione.
2. **Domanda reale:** contabilizzare famiglie L1–L4 in cerca di alloggio e capacità disponibile per ceto; la heatmap rappresenta l'idoneità geografica, non crea popolazione. Congelare l'upgrade quando mancano residenti realmente assegnabili.
3. **Prestigio:** abbellimenti e degrado ambientale con effetti duraturi e decadimento nel tempo; evitare anelli auto-rinforzanti fra ceto, prestigio e criminalità. I crimini isolati non devono demolire reputazione in una giornata.
4. **Catasto e densità:** calcolare capienza effettiva in persone/famiglie e intensità di copertura del lotto; preservare i confini Voronoi e le collisioni. Solo dopo consentire suddivisioni virtuali, edifici multipli o sopraelevazioni.
5. **Motore ricostruzioni:** trigger governato da soglie persistenti/isteresi, risorse e costo; ricostruzione completa con migrazione controllata di occupanti, lavoro, proprietà, arredi e salvataggi.
6. **Migrazione classi:** L1+L2 precedenti → nuovo L1 dove applicabile; vecchi L3 artigiani → nuovo L2; vecchi L4 mercanti → nuovo L3; nuovi L4 solo nobili. Richiede audit di occupazioni, case, prezzi, routine, Job Manager, Merchant, Crime e testi, non una rinomina.
7. **Builder:** overlay selezionabile per ciascuna delle 4 mappe (domanda separabile nei 4 ceti), legenda e inspector del lotto; UI di debug non equivale al comportamento attivo.

## QA minima V0
`qa/urban-heatmaps-regression.cjs` è richiamato da `qa/urban-regression.cjs`. Verifica 7 canali, effetti opposti industria e piazza, sicurezza da guardie/mura, crimine locale, griglia, interpolazione, lotti, niente crescita senza domanda, import browser/Node. Il test del nuovo modulo deve superare la CI prima di dichiarare il completamento dello skeleton. Richieste ancora aperte: comportamento browser, salvataggi/migrazioni e QA urbanistica con densificazione reale.
