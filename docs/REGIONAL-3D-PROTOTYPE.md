# CONQUER — Mappa regionale: ripristino Voronoi esagonale

**Branch:** \`3dregionmap\` · **Preview:** \`lab/3dregionmap.html\`  
**Stato:** prototipo isolato, non effettuare merge su \`main\` senza validazione visiva e prestazionale nel browser.

## Decisione

Ripristinata la tessellazione originale del World Lab anteriore alla conversione quadrata (base Git \`21a79dbd\`). I territori **non** sono quadrati e non sono unione di venti sottocelle: ciascun territorio ha un proprio sito Voronoi su reticolo **triangolare a righe sfalsate**, generando normalmente poligoni a sei lati. La deformazione del World Lab perturba questi siti, pur conservando la struttura esagonale. Il generatore quadrato/20-celle e la deformazione 5× introdotta successivamente sono stati ritirati.

La superficie reale di ogni macroterritorio è soggetta al vincolo bloccante:

\[
0.90 \times \frac{A_{\mathrm{mappa}}}{N} \le A_i \le
1.10 \times \frac{A_{\mathrm{mappa}}}{N}
\]

\`src/regional-hex-capacity.js\` ricostruisce la Voronoi pesata sui centri esagonali originali e riequilibra gradualmente le aree tramite pesi di potenza. Se il seed/deformazione iniziale non converge, riduce **soltanto il jitter**, mai lo sfalsamento esagonale. Generazione deterministica, copertura del 100% della mappa e limite sull'area verificati a ogni generazione.

## Due relazioni diverse fra territori

- **Prossimità logica:** otto slot direzionali \`[NW,N,NE,W,E,SW,S,SE]\` preindicizzati per riga/colonna e disponibili in O(1) tramite \`window.ConquerRegion8Neighbors(id)\`. Ai limiti del mondo gli slot esterni valgono \`null\`.
- **Adiacenza fisica:** territori che condividono effettivamente uno spigolo Voronoi; precalcolata dopo la generazione ed esposta da \`window.ConquerRegionPhysicalNeighbors(id)\`. Movimento politico/contiguità fisica e confini usano questa struttura; fiumi e coste usano gli spigoli reali. **Una griglia Voronoi esagonale non garantisce otto confini fisici per territorio.**

Queste due relazioni non devono essere trattate come sinonimi: una relazione di prossimità non equivale necessariamente a un confine attraversabile.

## Preview 3D

\`src/regional-map3d-geometry.js\` resta il renderer della vista regionale. Legge le celle 2D autorevoli, genera sottocelle Voronoi **solo per il dettaglio visivo**, le ritaglia sui territori canonici e adatta automaticamente la deformazione per rispettare anche nella scena il limite d'area ±10%. Il dettaglio selezionabile è 1×/8×/20×/40×. Non esiste più la mesh alternativa a 20 celle fisiche obbligatorie per centro quadrato.

Rimangono i placeholder: cubo arancione villaggio, cubo grigio fortificazione non palizzata, striscia marrone molo, rettangolo marrone nave e cilindri sovrapposti con i colori araldici delle truppe. Gli esempi dimostrativi sono distinti dalle unità di gioco.

## Salvataggi e verifiche

I nuovi JSON sono marcati \`hex-voronoi-balanced-v1\`. Le mappe salvate nei precedenti esperimenti quadrati (\`square-moore-8-balanced-v1\` e \`square-moore-8-hex20-v2\`) vengono rimappate per **riga/colonna**, non per vecchio ID, anche per proprietà e capitali delle fazioni.

- \`qa/regional-topology-regression.cjs\`: reticolo esagonale, aree ±10%, 8 slot logici, confini reali, copertura, scena 3D.
- \`qa/regional-map3d-regression.cjs\`: microcelle visive, fiumi, picking, colline, rilievi, vegetazione.
- \`qa/regional-map3d-placeholders-regression.cjs\`: segnaposti e movimento nave.

**Limite della validazione:** i test sono di logica/geometria. La resa visiva e gli FPS su un browser reale devono ancora essere verificati.
