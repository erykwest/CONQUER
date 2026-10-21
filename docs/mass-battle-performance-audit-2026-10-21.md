# Scontro 40 difensori contro 30 attaccanti — 21/10/2026

Base pubblicata: `9e1b6a5`, branch `fix/construction-completion-perf`. Questa prova
usa **ulteriori correzioni nel working tree**, non ancora nel commit pubblicato.
Artefatti in `output/playwright/mass-battle/`; harness ripetibile
`qa/mass-battle-performance.cjs`, regressioni `qa/mass-battle-regression.cjs`.

## Esito fino all'eliminazione

Campo aperto, piano, luce diurna, seed 12345, profili HP/armatura/dadi originali.
Ogni entità è un soldato singolo, non una squadra di cinque figuranti.

| Schieramento | Arcieri iniziali → superstiti | Fanti iniziali → superstiti | Cavalieri iniziali → superstiti | Totale superstiti |
|---|---:|---:|---:|---:|
| Difensori | 15 → 15 | 20 → 19 | 5 → 3 | **37/40** |
| Attaccanti | 10 → 0 | 17 → 0 | 3 → 0 | **0/30** |

**Vittoria dei difensori dopo 298,1 secondi simulati (4 min 58,1 s).**
I 30 attaccanti hanno HP zero, non sono semplicemente spariti dal rendering o
conteggiati come eliminati per fuga. I difensori conservano complessivamente
2.707 HP. Stesso esito, perdite e danni nelle ripetizioni Canvas/WebGL.

L'harness invia ordini di movimento/posizionamento ogni secondo simulato tramite
`ConquerCombat.planLegs`; avanzamento, corpo a corpo, tiri, dadi, HP, energia,
animazioni e decessi sono dei moduli effettivi. Gli arcieri si fermano entro
portata, fanti/cavalieri si avvicinano al nemico vivo più vicino. Il controller
sostituisce i click del giocatore, non i danni. Un watchdog interromperebbe con
errore uno stallo: non è stato necessario usarlo per determinare il vincitore.

È una prova deterministica con queste formazioni e ordini, non un verdetto sul
bilanciamento generale né una prova di una nuova IA strategica autonoma.

## Performance misurate

Chromium 155, viewport 1440×900, server HTTP locale, nessuna rete di gioco.
Simulazione accelerata: 2.981 aggiornamenti da 0,1 s, con un'attesa RAF ogni
20 aggiornamenti e schermate durante lo scontro. Il tempo simulato NON misura
gli FPS della partita a velocità 1×. Il profilo CPU è attivo durante le misure.

Campagna comparabile `final.json`:

| Misura | WebGL | Canvas |
|---|---:|---:|
| Logica, mediana / P95 per aggiornamento | 0,5 / **1,0 ms** | 0,4 / **1,0 ms** |
| Logica, massimo | 2,7 ms | 11,1 ms |
| Logica, CPU cumulativa | 1,58 s | 1,51 s |
| Disegno, mediana | 4,8 ms | 4,3 ms |
| Disegno, P95 | **100,1 ms** | **7,3 ms** |
| Disegno, massimo | 112,4 ms | 12,0 ms |
| Pianificazione di un ordine, P95 / massimo | 0,3 / 1,1 ms | 0,3 / 2,4 ms |
| Tempo reale dell'esecuzione accelerata | 17,24 s | 17,26 s |

**Il collo residuo osservato è grafico, soprattutto WebGL.** La prima ripetizione
WebGL (`first.json`) aveva P95 draw 8,7 ms; la successiva (`repeat.json`) 132,9 ms,
massimo 180,8 ms, con logica P95 1,4 ms. Non presentare il risultato migliore come
prestazione costante. Nel profilo `final-webgl.cpuprofile` circa **3,03 s** sono
campionati nel nativo `getError`, chiamato da `pollRendererError` all'inizio di
`drawBack`, anche durante i ridisegni richiesti dall'animazione di combattimento.
Questo è un candidato concreto per il prossimo intervento sui picchi.

Esperimento diagnostico `after-fence.json`: aggiungere fence dopo front/luci non
ha dimostrato un miglioramento (P95 WebGL 164,5 ms; carico generale più alto anche
su Canvas). La variante è stata rimossa: **non si dichiara corretto il picco GPU**.
Restano i dati/profili del tentativo, separati dalla campagna principale.

Gli intervalli RAF delle prove accelerate includono i batch di logica, i due
percorsi di richiesta draw e le catture; convertirli in un singolo FPS di gioco
sarebbe scorretto. Un collaudo di frame pacing a 1× è una verifica distinta.

## Correzioni necessarie per rendere valido lo scenario

La prima riproduzione sul codice pubblicato trovava:

1. `restore` conservava soltanto i cinque cavalieri: fanti/arcieri individuali
   non rientravano fra i tipi ammessi. Ora sono persistibili e disegnati come
   una figura ciascuno. Gli attaccanti conservano anche il modello da arciere
   o cavaliere, invece del solo fante generico.
2. Il tiro considerava soltanto la guarnigione amica: nessun danno dagli arcieri
   attaccanti. Ora i due schieramenti usano lo stesso percorso di tiro e gli
   arcieri mobili mantengono un clock nel relativo cache record; un arciere morto,
   in mischia, in fuga o sulle scale non spara tramite un record rimasto in cache.
3. Tutte le 1.200 coppie 40×30 passavano al controllo di contatto anche a grande
   distanza. Ora portata/distanza precedono i controlli costosi di terreno/LOS.
   L'esclusione a distanza non cambia portata o tiro dei dadi.
4. Il cavaliere attaccante usava la velocità del fante nel percorso a gambe;
   ora usa la stessa velocità del cavaliere difensore. Profili di danno e HP
   restano quelli del motore: un cavaliere ha 30 HP, un fante/arciere 100 HP.

Prova di partecipazione effettiva, danni inflitti per tipo (`final.json`):

| Tipo | Difensori | Attaccanti |
|---|---:|---:|
| Arcieri | 582 | 266 |
| Fanti | 1.769 | 545 |
| Cavalieri | 439 | 132 |

## Riproduzione

```powershell
$env:NODE_PATH='C:\Users\vasta\AppData\Local\npm-cache\_npx\420ff84f11983ee5\node_modules'
node qa/mass-battle-regression.cjs
node qa/mass-battle-performance.cjs local
```

`PERF_MODES=webgl` limita a un renderer; `BATTLE_MAX_SECONDS` è un watchdog,
non una condizione di vittoria. Il runner fallisce se non arriva a un lato
effettivamente eliminato, se manca una classe di soldati, se un tipo non infligge
danni o se il motore registra eccezioni/fallback.

I sette nuovi controlli coprono roster, profili senza campo ridondante, pruning
delle collisioni/LOS, tiro attaccante, morte del proprietario del tiro e integrazione
nel vero tick. Tutte le campagne browser riportano zero eccezioni raccolte, zero
fault del combattimento e nessun renderer fallito. Log e JSON restano separati
dal codice e non vengono pubblicati automaticamente.

Batteria finale: **56/58 suite PASS**, incluse le sette nuove regressioni.
Restano i due fallimenti preesistenti già riprodotti su main:
`refactor-app-population-regression.cjs` e `wall-bays-regression.cjs`.
Risultati in `output/playwright/mass-battle/regressions-final.json` e relativo
log. Controlli di sintassi e `git diff --check` superati. Le modifiche di questo
round sono locali: nessun nuovo commit, push o esecuzione CI remota.

## Ulteriore riduzione dei costi di rendering — 21/10/2026

Richiesta successiva: intervenire sui costi residui. Campagna strumentata
`gpu-baseline-a.json`, poi misure finali `gpu-final-a.json` (entrambi i renderer)
e `gpu-final-b.json` (ripetizione WebGL). Stesse 70 entità, seed, ordini e profili;
nessun cambio a risoluzione, qualità delle figure, HP o danni. Il profiler e le
misure dei metodi GPU sono attivi sia nella baseline sia nelle nuove prove.

Modifiche mantenute:

- Il combattimento in pausa usa il ciclo visuale comune a incendi/crolli, con
  cadenza nominale 30 Hz. Rimosso il suo RAF separato: le richieste concorrenti
  non producono più un secondo disegno completo nel medesimo frame.
- `getError` non viene più interrogato a ogni checkpoint disponibile. Dopo una
  verifica riuscita si attende almeno 1 s prima di avviare la successiva.
  La perdita del contesto continua a essere verificata a ogni disegno.
- Il checkpoint è emesso dopo front/luci, attraverso `finishFrame`, anziché
  prima degli ultimi passaggi GL. L'età iniziale resta invariata quando si
  aggiorna una fence pendente: dopo 1 s di GPU ancora occupata il controllo
  viene comunque eseguito. Non può essere rinviato all'infinito dai ridisegni.
- Fallimento del controllo o allocazione fence disabilitano il renderer e
  invalidano le cache; il Canvas completo resta il percorso di fallback.

| Misura per battaglia completa | Baseline strumentata | Finale A | Finale B |
|---|---:|---:|---:|
| WebGL, disegni | 324 | 174 | 170 |
| WebGL, tempo cumulativo di disegno | 10,72 s | 2,97 s | 1,89 s |
| WebGL, disegno P95 | 163,4 ms | 76,5 ms | 8,3 ms |
| WebGL, disegno massimo | 264,2 ms | **396,2 ms** | 252,5 ms |
| WebGL, chiamate `getError` | 64 | 9 | 7 |
| WebGL, tempo cumulativo in `getError` | 8,45 s | 1,98 s | 1,14 s |
| WebGL, logica P95 | 1,8 ms | 1,2 ms | 1,0 ms |

Il costo cumulativo del rendering WebGL scende del **72–82%** rispetto alla
baseline strumentata; questo deriva da meno disegni e meno controlli sincroni,
non da una garanzia che la singola interrogazione GPU sia più veloce.
Il massimo della prova A **peggiora**: restano blocchi isolati di 250–400 ms.
Il P95 cambia sensibilmente quando le poche query residue superano il 5% dei
disegni: riportare entrambe le ripetizioni, senza certificare fluidità o FPS 1×.
Il tempo reale della campagna accelerata passa da 24,87 s a 20,18 / 15,91 s;
dipende anche da RAF, catture e carico del computer.

Canvas finale A: **177 disegni**, 0,738 s cumulativi, P95 6,6 ms e massimo
9,3 ms. La precedente campagna Canvas `final.json` aveva 326 disegni, 1,433 s,
P95 7,3 ms: circa **48% in meno di tempo cumulativo**. Quest'ultimo confronto
usa la campagna precedente, non una nuova baseline Canvas intercalata.

Tutte le campagne mantenute arrivano ancora a **298,1 s simulati**, 37 difensori
contro zero attaccanti, stessi HP/danni finali. Zero errori del motore durante le
misure. Dopo la misura, `BATTLE_VERIFY_RENDER=1` verifica separatamente che un
colpo in pausa venga disegnato, cambi posa e termini senza richieste esterne;
un `getError=1281` iniettato deve poi produrre un Canvas dipinto. Verifiche PASS
su entrambi i renderer; rilevamento errore WebGL in 1.537 ms nella prova A e
21 ms nella B. Le eccezioni intenzionali di queste verifiche non sono incidenti
del benchmark.

Esperimenti scartati:

- `gpu-cadence-a`: semplice ritardo senza correggere la sostituzione continua
  della fence; troppo poche verifiche effettive sotto carico.
- `gpu-cadence-stable-a` / `gpu-shared-a`: fence vecchia conservata; il costo
  complessivo cala ma rimangono query lunghe su lavoro successivo già accodato.
- `gpu-discard-a/b`: override di `preserveDrawingBuffer=false`; beneficio non
  consistente rispetto alla variante completa. L'attributo runtime resta true.
- `gpu-backpressure-a`: rinvio dei frame mentre la GPU è occupata. Non ha
  eliminato i blocchi; inoltre i wrapper legacy di draw non propagano il valore
  di ritorno, quindi il primo contatore non distingueva i frame rinviati dal
  disegno dell'overlay. Esperimento integralmente rimosso, nessuna affermazione
  di guadagno ricavata da quel contatore.

Nuova regressione `qa/paused-render-regression.cjs`: esegue il ramo reale della
simulazione in pausa con combattimento, incendio, crollo, richieste concorrenti,
idle e transizione luce. La regressione GPU copre anche frequenza, fence
pendente, timeout della verifica, wait fallita e allocazione sync fallita.
Entrambe sono state osservate fallire prima delle rispettive correzioni.

Ripetizione delle verifiche browser:

```powershell
$env:NODE_PATH='C:\Users\vasta\AppData\Local\npm-cache\_npx\420ff84f11983ee5\node_modules'
$env:BATTLE_VERIFY_RENDER='1'
node qa/mass-battle-performance.cjs gpu-local
```

Le modifiche restano nel working tree sul branch `fix/construction-completion-perf`,
oltre `9e1b6a5`; nessun nuovo commit, push, CI remota o rilascio.

Batteria conclusiva di questo intervento: **57/59 suite PASS**. Restano soltanto
`refactor-app-population-regression.cjs` e `wall-bays-regression.cjs`, già
falliti su main. L'assert sorgente della palette è stato aggiornato per il
checkpoint emesso da `finishFrame()` anziché nel back pass; verifiche comportamentali
GPU/browser eseguite separatamente. Log e risultati:
`output/playwright/mass-battle/regressions-gpu-final-verified.log` e `.json`.
Sintassi dei sorgenti modificati e whitespace PASS. Gli hash dei cinque sorgenti
runtime registrati in `gpu-final-b.json` corrispondono ai file finali.
