# Audit round 3: Canvas, brigata, mura e 20 assalitori

20 ottobre 2026. Codice locale sul branch `fix/construction-completion-perf`,
base `996b4a4`. Il confronto parte dal working tree del round 2, conservato in
`output/playwright/round3/before/src`, non da main privo delle precedenti correzioni.
Nessun commit, push, PR, merge, deploy o richiesta di privilegi amministrativi.

## Riproduzione e metodo

`qa/movement-collapse-performance.cjs` avvia un server HTTP locale e Chromium
isolato, con seed 12345, viewport 1440×900, terreno piatto e luce DEV diurna.
Carica i moduli reali, intercetta errori e registra profili CPU, JSON e screenshot.
Non sostituisce combattimenti con la coreografia di `ConquerSiegeAssault`.

Scenari:

- **Canvas/WebGL, crolli:** otto torri L3 e quattro tratti di muro; dodici attacchi
  strutturali reali producono dodici eventi di crollo e i ceppi delle otto torri.
  I campioni distinguono caduta, primo disegno fermo e riuso della cache.
- **Brigata:** 24 case L2 incendiate e un pozzo, sei addette, 120 secondi simulati
  a 30 aggiornamenti/s. Si misurano CPU, distanza percorsa, attraversamenti
  illegali e consegna dell'acqua, anche dopo che gli edifici diventano macerie.
- **Mura:** un cavaliere e cinque squadre, ordini reali attraverso `issueWallOrder`,
  pianificazione della discesa con `planLegs` e avanzamento con `ConquerCombat.tick`.
  Ogni unità deve salire, raggiungere il camminamento, scendere e terminare a terra.
- **Attacco:** venti entità ostili di fanteria, una scala d'assalto su muro T2/H1,
  una torre collegata con scala interna e un difensore a terra. L'AI decide salita,
  passaggio sulle mura, discesa e ingaggio. Si controlla il danno realmente inflitto.

I due scenari militari coprono 120 secondi con delta di 0,25 s. La modalità
`PERF_LIVE=1` aggiunge RAF e rendering continuo, screenshot a 20/60 secondi e
misura degli intervalli dei frame. Il tempo di simulazione è accelerato; non è
una registrazione del gioco non modificato a velocità 1×.

Comandi PowerShell, senza installazioni globali:

```powershell
$env:NODE_PATH='C:\Users\vasta\AppData\Local\npm-cache\_npx\420ff84f11983ee5\node_modules'
$env:PERF_ASSERT='1'
node qa/movement-collapse-performance.cjs after-final
# Confronto precedente; togliere PERF_ASSERT, perché contiene i bug riprodotti.
$env:PERF_OVERLAY=(Resolve-Path 'output/playwright/round3/before').Path
$env:PERF_SCENARIOS='brigade,walls'
Remove-Item Env:PERF_ASSERT
node qa/movement-collapse-performance.cjs before-30hz
# Render continuo dopo aver tolto PERF_OVERLAY:
Remove-Item Env:PERF_OVERLAY
$env:PERF_LIVE='1'
$env:PERF_ASSERT='1'
$env:PERF_SCENARIOS='walls,assault'
node qa/movement-collapse-performance.cjs live-final
```

Lo snapshot `PERF_SNAPSHOT=1` va creato **prima** di cambiare il codice; non
sovrascrivere quello del round 2 o quello di questo confronto. Percorsi Node
specifici della macchina; il benchmark richiede Playwright e Chrome disponibili.

## Problemi riprodotti e correzioni

**Macerie Canvas ferme.** Il painter proiettava, ordinava e dipingeva migliaia di
triangoli a ogni disegno, anche quando la geometria era identica. Ora l'intero
insieme fermo usa la cache composita già esistente, limitata a 32 MiB, così i cumuli
sovrapposti mantengono il medesimo ordine. Identità delle mesh, rotazione, zoom,
plan view e DPR determinano il contenuto; il pan riusa la bitmap. Caricamento o
sostituzione delle mesh cambia la chiave. Una voce troppo grande ricade sul painter.
Il primo disegno statico raggruppa soltanto triangoli consecutivi dello stesso
colore, con winding uniforme. Nessun blocco/faccia è stato eliminato. Le mesh
ancora in caduta conservano il painter originale; la loro fluidità resta un limite.

**Brigata sincrona e attraversamenti.** Il precedente fallback `[a,b]` faceva
camminare attraverso case/mura quando A* falliva. Ora una rotta fallita fa attendere
e riprovare un accesso: non diventa un percorso diretto. A* e smoothing espongono
un generatore cooperativo, mantenendo il wrapper sincrono per gli altri chiamanti.
La brigata condivide un budget indicativo di 4 ms per aggiornamento, ruota la
priorità tra le sei addette e ricomincia i lavori pendenti se cambia la navigazione,
l'origine o la destinazione. Un singolo passo del generatore può superare il budget.
Snapshot delle sagome delle case e memo dei nodi/costi valgono per la sola ricerca.
Resta la preferenza stradale e restano le collisioni originali.

**Addetta ferma presso il pozzo.** Una tangente passava fra i campioni del controllo
di un segmento, ma il primo piccolo passo successivo cadeva nella zona bloccata.
Il controllo continuo della distanza dal segmento a pozzi/torri rotonde evita
questo falso percorso. Le addette partono fuori dal raggio di ingombro del pozzo,
cercano una posizione libera per acqua/lancio e controllano ogni passo durante
il movimento: un nuovo crollo può obbligarle a ripianificare.

## Risultati e limiti

Confronto brigata a 30 Hz (`before-30hz.json` / `after-final.json`):

| Misura | Prima | Dopo |
|---|---:|---:|
| Peggior tick Canvas, inclusa logica del fuoco | 2.379 ms | 32 ms |
| Peggior tick WebGL, inclusa logica del fuoco | 1.761 ms | 25 ms |
| CPU totale dei 3.600 aggiornamenti Canvas | 25,4 s | 10,8 s |
| CPU totale dei 3.600 aggiornamenti WebGL | 25,3 s | 9,9 s |
| P95 aggiornamento dopo la correzione | — | 8–9 ms |
| Segmenti di movimento che attraversano ostacoli stabili | 1.890 | 0 |

Tutte e sei le addette percorrono più di 5 U e viene consegnata acqua. Un percorso
lungo può ancora consumare centinaia di ms di CPU complessiva, distribuiti su più
aggiornamenti; attesa e tempo di calcolo non sono stati eliminati. I 120 secondi
di prova a delta 0,25 s delle prime iterazioni sovraccaricavano artificialmente
il budget per secondo simulato: non sono usati come confronto finale della brigata.

Per Canvas fermo, la campagna precedente aveva P50 159 ms e massimo 3,33 s per
disegno, con forte variabilità dei flush GPU; un'altra ripetizione raggiungeva
P50 1,19 s. Il riuso della bitmap porta i campioni caldi sotto 1 ms. La prima
costruzione della bitmap ha dato 0,1–0,2 s in più ripetizioni, ma la prova finale
con il painter attivo preservato ha registrato **3,04 s** nel primo disegno fermo:
include il passaggio dalla caduta e possibili flush dei comandi Canvas pendenti.
Non si dichiara risolto quel picco. Rotazione/zoom o nuove macerie possono
richiedere una nuova costruzione. I crolli in movimento
restano costosi, con campioni complessivi nell'ordine di 0,1–0,2 s: non si dichiara
eliminato quel collo di bottiglia. I piccoli batch di disegni e la composizione GPU
sono variabili: non sono un benchmark FPS universale.

Le sei unità completano salita e discesa in entrambi i renderer. I venti assalitori
raggiungono le mura e poi il terreno interno; il difensore infligge 44 punti di danno
nel caso deterministico. Nessuna correzione alle regole di combattimento o al grafo
dei camminamenti è stata necessaria per questa configurazione. Ordine iniziale
delle sei unità: circa 65–73 ms prima, 25–37 ms dopo; resta un'operazione sincrona.
Non sono coperti assedi con ariete, ponti d'assalto H2, centinaia di unità o terreno
complesso. I percorsi militari lunghi rimangono un candidato per un audit separato.

## Verifica grafica e regressioni

La verifica pixel confronta painter precedente, painter corrente e cache su quattro
rotazioni, pan, zoom/plan view e frammenti stone/wood/timber a più tempi. La cache
ricalca il painter corrente; il raggruppamento statico modifica leggermente i bordi
antialias. La soglia del confronto precedente/corrente è 3% dei pixel non trasparenti
con differenza massima >16 e errore medio <2/255 per canale. Nessun culling delle
facce è incluso: quella variante è stata scartata per differenze visive maggiori.

`qa/movement-path-performance-regression.cjs` verifica parità sincrono/generatore,
tangente al pozzo, equità/cancellazione dei lavori e assenza del fallback attraverso
il muro. Le suite Fire e Wallwalk restano operative. Artefatti dettagliati in
`output/playwright/round3/`, non versionati.

Il controllo conclusivo è `collapse-final.json`: cache Canvas calda P50 0,5 ms,
primo disegno fermo 3.039 ms; caduta P50 167 ms / massimo 184 ms. La campagna
`after-final.json` precedente resta utile per brigata e militari; il painter
attivo è stato successivamente riportato al comportamento originale per evitare
una variazione di resa/costo mentre i blocchi cadono. Il confronto pixel finale
dei materiali in movimento è identico al precedente.

La successiva ripetizione `pixels-final.json` aggiunge esplicitamente il flag
statico ai frammenti stone/wood/timber già fermi: tutti i confronti passano,
massimo 2,78% dei pixel non trasparenti oltre soglia / errore medio 1,59/255.
Cache Canvas calda ancora P50 0,5 ms, primo disegno fermo 1.616 ms. Conferma
la variabilità del picco iniziale e non sostituisce il massimo di 3.039 ms.

Nelle quattro prove `live-final.json`: tutti i requisiti di movimento passano,
zero eccezioni raccolte, zero fault del combattimento e nessun renderer fallito.
Attacco: P95 draw 6 ms Canvas / 10,5 ms WebGL; P95 intervalli RAF 33,5 / 50 ms.
Squadre sulle mura: P95 draw 10,3 / 11,9 ms, ma intervalli RAF P95 150 / 133,5 ms.
La distanza fra costo del draw e presentazione effettiva richiede una diagnosi
ulteriore del ciclo/compositore. Le catture dei due stadi possono aggiungere
pause: i massimi dei frame non vengono presentati come costo esclusivo dell'AI.

Batteria locale completa: **55/57 suite PASS**. Restano soltanto
`refactor-app-population-regression.cjs` e `wall-bays-regression.cjs`, con gli stessi
errori già riprodotti su main nel round 1; i quattro nuovi controlli dei percorsi,
Fire, Wallwalk, Urban e le regressioni dei round precedenti passano.
Log/risultati in `output/playwright/round3/regressions.{log,json}`. Sintassi dei
moduli `src/*.js` e `git diff --check` PASS. CI remota non eseguita.
