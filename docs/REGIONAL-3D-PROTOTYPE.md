# CONQUER — Mappa regionale: ripristino Voronoi esagonale

**Branch:** `3dregionmap` · **Preview:** `lab/3dregionmap.html`  
**Stato:** prototipo isolato, non effettuare merge su `main` senza validazione visiva e prestazionale nel browser.

## Decisione

Ripristinata la tessellazione originale del World Lab anteriore alla conversione quadrata (base Git `21a79dbd`). I territori **non** sono quadrati e non sono unione di venti sottocelle: ciascun territorio ha un proprio sito Voronoi su reticolo **triangolare a righe sfalsate**, generando normalmente poligoni a sei lati. La deformazione del World Lab perturba questi siti, pur conservando la struttura esagonale. Il generatore quadrato/20-celle e la deformazione 5× introdotta successivamente sono stati ritirati.

La superficie reale di ogni macroterritorio è soggetta al vincolo bloccante:

\[
0.90 \times \frac{A_{\mathrm{mappa}}}{N} \le A_i \le
1.10 \times \frac{A_{\mathrm{mappa}}}{N}
\]

`src/regional-hex-capacity.js` ricostruisce la Voronoi pesata sui centri esagonali originali e riequilibra gradualmente le aree tramite pesi di potenza. Se il seed/deformazione iniziale non converge, riduce **soltanto il jitter**, mai lo sfalsamento esagonale. Generazione deterministica, copertura del 100% della mappa e limite sull'area verificati a ogni generazione.

## Due relazioni diverse fra territori

- **Prossimità logica:** otto slot direzionali `[NW,N,NE,W,E,SW,S,SE]` preindicizzati per riga/colonna e disponibili in O(1) tramite `window.ConquerRegion8Neighbors(id)`. Ai limiti del mondo gli slot esterni valgono `null`.
- **Adiacenza fisica:** territori che condividono effettivamente uno spigolo Voronoi; precalcolata dopo la generazione ed esposta da `window.ConquerRegionPhysicalNeighbors(id)`. Movimento politico/contiguità fisica e confini usano questa struttura; fiumi e coste usano gli spigoli reali. **Una griglia Voronoi esagonale non garantisce otto confini fisici per territorio.**

Queste due relazioni non devono essere trattate come sinonimi: una relazione di prossimità non equivale necessariamente a un confine attraversabile.

## Le 20 sottocelle Voronoi per territorio (ripristinate)

`src/regional-micro-voronoi.js` genera **esattamente 20 sottocelle Voronoi interne a ogni macroterritorio esagonale** (630 × 20 = **12.600** sottocelle nella mappa predefinita). I macroterritori non vengono sostituiti da un aggregato e non cambiano né superficie né proprietario.

- Vengono campionati 20 siti pseudo-casuali ben distribuiti **dentro il poligono Voronoi macro**, senza una griglia quadrata aggiuntiva.
- Dieci coppie di target casuali complementari producono dimensioni desiderate diversificate (circa 55–145% della media); una **Voronoi pesata (power diagram)** calibra le superfici effettive entro **50–150%** della media delle 20 celle del rispettivo territorio.
- Ogni cella è rigorosamente **clippata al macroterritorio**. Per ciascun macroterritorio, la somma delle 20 aree coincide con la sua area completa, entro errore numerico.
- Se un particolare seed interno non converge, si rigenerano deterministicamente **solo i 20 punti interni** di quel territorio: confini, territori, fiumi e vicini non cambiano.
- Le sottocelle sono **geometria di dettaglio**, non nuovi territori di gameplay. Il World Lab le mostra nell'overlay «20 sottocelle Voronoi per territorio», attivo inizialmente, disegnato come un singolo percorso SVG.
- La snapshot `ConquerRegion3DSnapshot().fineCells` passa le **stesse** 12.600 geometrie alla preview WebGL; non viene più generata una seconda tassellazione indipendente. Per questa sorgente, il controllo dettaglio 3D è bloccato sul livello canonico.
- I confini esterni e i fiumi 3D sono derivati dagli **spigoli macro autorevoli**, non dal tentativo di far coincidere i bordi di sotto-Voronoi generati separatamente sui due lati di un confine. Questo evita artefatti e perdite di fiumi per sottosegmenti disallineati.

### Prestazioni e validazione

Su mappe 30×21, il calcolo delle 20 sottocelle ha impiegato circa **13 secondi nei test JavaScript isolati** (dipende dall'ambiente e dal seed), oltre al calcolo dei macroterritori. È un costo da ottimizzare prima dell'uso produttivo; **non** è una misura di FPS nel browser. La mesh 3D ha prodotto un triangolo selezionabile per ciascuna faccia reale e conserva ID dei 630 macroterritori.

Il test bloccante `qa/regional-micro-voronoi-regression.cjs` controlla numero fisso, 50–150% di area **effettiva**, clipping, copertura, assenza di mutazioni macro, adiacenze, selezione 3D e fiumi. I test già presenti su topologia esagonale, geometria 3D e placeholder restano validi.

## Preview 3D

`src/regional-map3d-geometry.js` continua a renderizzare i 630 territori canonici. Quando la sorgente fornisce `fineCells`, disegna direttamente le **20 sottocelle esagonali/irregolari per territorio**, utilizzandone i veri poligoni; conserva alberi, canneti, rilievi, fiumi, picking e segnaposti. Solo le snapshot esterne che non forniscono sottocelle possono usare il precedente generatore di dettaglio alternativo 1×/8×/20×/40×.

Rimangono i placeholder: cubo arancione villaggio, cubo grigio fortificazione non palizzata, striscia marrone molo, rettangolo marrone nave e cilindri sovrapposti con i colori araldici delle truppe. Gli esempi dimostrativi sono distinti dalle unità di gioco.

## Salvataggi e verifiche

I nuovi JSON sono marcati `hex-voronoi-balanced-v1`. Le mappe salvate nei precedenti esperimenti quadrati (`square-moore-8-balanced-v1` e `square-moore-8-hex20-v2`) vengono rimappate per **riga/colonna**, non per vecchio ID, anche per proprietà e capitali delle fazioni.

- `qa/regional-topology-regression.cjs`: reticolo esagonale, aree ±10%, 8 slot logici, confini reali, copertura, scena 3D.
- `qa/regional-map3d-regression.cjs`: geometria di fallback, fiumi, picking, colline, rilievi, vegetazione.
- `qa/regional-micro-voronoi-regression.cjs`: 20 celle interne, size ±50%, copertura, integrazione World Lab/3D.
- `qa/regional-map3d-placeholders-regression.cjs`: segnaposti e movimento nave.

**Limite della validazione:** i test sono di logica/geometria. La resa visiva e gli FPS su un browser reale devono ancora essere verificati.
