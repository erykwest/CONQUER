# Audit prestazioni dei completamenti — 20 ottobre 2026

Base: `main` aggiornato via `git pull --ff-only origin main`, commit `996b4a4`.
Modifiche locali sul branch `fix/construction-completion-perf`, nel checkout `GIT-perf`.
Nessun push, PR, merge o deploy effettuato.

## Metodo e riproduzione

`qa/construction-performance.cjs` avvia un server HTTP temporaneo su loopback e
un contesto Chromium isolato per renderer. Seed 12345, viewport 1440×900, DPR 1,
terreno TEST predefinito, un pozzo, dieci tratti arteriali e sedici case.
Tre ripetizioni per torre singola, portale singolo e stress con otto torri,
otto mura e un portale. La mappa stress include percorsi non raggiungibili;
non è una certificazione della validità di piazzamento di ciascuna struttura.

Il test scalda le cache, attraversa la stessa soglia di completamento usata dalla
simulazione, chiama la manutenzione reale e misura sei disegni successivi.
Misura separatamente anche la conclusione dei lavori stradali differiti.
Le esecuzioni con `PERF_ASSERT=1` aggiungono verifiche delle cache e una finestra
di tre secondi del vero ciclo di animazione a velocità ×4.
Il browser non usa salvataggi dell'utente; le richieste Supabase sono bloccate.
Il confronto conclusivo (`baseline-final` / `verified`) disabilita la limitazione
dei timer delle finestre in background in entrambe le versioni. Le prime prove,
con configurazione differente, hanno mostrato picchi ancora maggiori (fino a
6,2 secondi complessivi); non usarle per calcolare la riduzione percentuale finale.

Richiede Node e Playwright con Chromium/Chrome già disponibile. Esempi PowerShell:

```powershell
node qa/construction-completion-regression.cjs
$env:PERF_ASSERT='1'
node qa/construction-performance.cjs final
```

Se Playwright è installato fuori dal checkout, impostare `NODE_PATH` alla sua
cartella `node_modules`. Non sono richiesti privilegi amministrativi.
`PERF_ROOT` consente di servire un altro checkout senza modificarlo;
`PERF_MODES`, `PERF_SCENARIOS` e `PERF_REPEATS` restringono l'esecuzione.
JSON, profili CPU e screenshot sono generati in `output/playwright/`, ignorata
da Git. I profili includono preparazione/scaldamento oltre al completamento:
non confrontare il totale dei campioni con il solo tempo della manutenzione.

## Cause dimostrate e correzioni

1. La manutenzione chiamava sincronicamente A* e semplificazione delle strade.
   Nel castello stress, `towerSecondary` occupava 3,4–4,3 secondi in una chiamata.
   Ora usa gli stessi generatori della navigazione esistente con budget di 6 ms
   per intervallo. Il tempo complessivo del lavoro non è eliminato: il browser
   può gestire input e frame tra gli intervalli. I risultati vengono scartati e
   ricalcolati quando cambia la revisione della navigazione; cancellazioni e
   sostituzione del villaggio annullano i lavori pendenti.
2. Ogni nuova torre faceva riprovare anche tutte le vecchie torri senza strada.
   Ora il completamento di una torre programma solo quella torre. Un nuovo
   portale/pozzo riprova le torri perché introduce una nuova destinazione.
3. `invalidateNavigation(false)` invalidava sempre il catasto. Anche una torre
   o un portale senza nuove strade ricreava così due texture terreno 4096×4096.
   I completamenti preservano il catasto quando la sua geometria non cambia;
   chiese, taverne e completamenti delle arterie restano invalidanti. Il WebGL2
   confronta inoltre i lotti effettivamente dipinti anziché il solo contatore
   delle invalidazioni. Le nuove strade continuano ad aggiornare il terreno.
4. `gl.getError()` dopo il disegno attendeva sincronicamente gli upload GPU.
   L'esperimento `no-gl-poll` ha isolato questa componente senza cambiare la
   geometria: il primo disegno del castello è sceso a 155 ms. Il fix conserva
   il rilevamento degli errori: una fence WebGL2 segue gli upload più recenti,
   viene interrogata con timeout zero prima di inviare il frame successivo e
   solo quando pronta consente la lettura dell'errore. Rimane al massimo una
   fence attiva. Context loss e fallback Canvas restano gestiti.

## Confronto conclusivo

Chrome 155.0.8059.85; stessa configurazione e tre ripetizioni per cella.
La misura è **manutenzione immediata + primo disegno**, mediana in millisecondi.
Il lavoro stradale differito viene atteso e misurato separatamente: non è incluso
come se fosse stato eliminato. I JSON sono `construction-baseline-final.json`
e `construction-verified.json` nella cartella degli artefatti.

| Renderer | Scenario | Main | Fix locale |
|---|---|---:|---:|
| WebGL2 | Torre | 686 ms | 15 ms |
| WebGL2 | Portale | 535 ms | 14 ms |
| WebGL2 | 8 torri + mura + portale | 1.981 ms | 457 ms |
| Canvas | Torre | 186 ms | 6 ms |
| Canvas | Portale | 53 ms | 3 ms |
| Canvas | 8 torri + mura + portale | 1.274 ms | 90 ms |

Nel gruppo di fortificazioni la manutenzione WebGL2 passa da 1.379 a 3,7 ms
mediani. Gli intervalli del lavoro differito hanno massimo 12,5 ms nel test
WebGL2 e 20,9 ms nel test Canvas; 6 ms è il budget cooperativo, non una garanzia
contro garbage collection o una singola operazione costosa. Le sei prove su
torre/portale singoli mantengono invariata la firma del terreno.

**Residui misurati:** nel castello stress il primo disegno WebGL2 varia ancora
fra 170 e 643 ms quando collider/lotti cambiano davvero. Nella finestra con la
simulazione attiva il P95 dei disegni resta circa 153 ms WebGL2 / 159 ms Canvas;
sono presenti long task, e il massimo intervallo fra frame è 917 / 400 ms.
Questa modifica non certifica quindi una simulazione sempre fluida. La prossima
priorità è separare/scaglionare il baking reale del terreno e profilare i picchi
del ciclo attivo; il profilo finale non concentra più secondi in `getError`.

Il controllo browser senza modifiche ai lotti conserva la texture, una nuova
strada ne cambia la firma e un errore GPU iniettato attiva un Canvas dipinto.
Nessuna eccezione JavaScript non gestita nei due contesti. Il timeout visto
durante la prima campagna Canvas non si riproduce nei due stress test di
ricontrollo né nella campagna conclusiva con timer non limitati dal background;
non è una prova generale dell'assenza di altri timeout.

## Verifiche e limiti

- Sei regressioni nuove: differimento reale del lavoro, parità delle strade con
  il percorso sincrono, aggiornamenti civili/arteriali, cancellazione, nessun
  tentativo su torri estranee e scarto di ricerche diventate obsolete.
- `qa/webgl-error-poll-regression.cjs` verifica che il controllo non legga errori
  mentre la fence è occupata, che le vecchie fence vengano rilasciate e che
  errori e perdita del contesto restino rilevati. La QA browser inietta inoltre
  un errore GL per verificare il passaggio a un Canvas ancora visibile.
- Nella prima campagna eseguite tutte le 54 suite `qa/*-regression.cjs`: 51 PASS e tre FAIL.
  Tutti e tre i fallimenti sono riprodotti anche nel checkout `main` pulito
  `996b4a4`: `founding-regression.cjs` (intervallo forestale 128–155 ms contro
  soglia 100 ms), `refactor-app-population-regression.cjs` (hook sorgente) e
  `wall-bays-regression.cjs` (estrazione del frammento sorgente).
- Verifica conclusiva: 55 suite, **53 PASS / 2 FAIL**. `clay-palette-regression.cjs`
  aggiornata al nuovo contratto di polling e rieseguita con successo. Rimangono
  solo i due test sorgente già falliti su main (`refactor-app-population` e
  `wall-bays`); `founding-regression` passa nell'ultima esecuzione ma il picco
  forestale intermittente documentato sopra rimane da approfondire. Registro
  completo e risultati strutturati: `output/playwright/regressions.log` e
  `output/playwright/regressions.json`.
- Controllo sintattico di tutti i moduli `src/*.js` e `git diff --check`: PASS.
- Nessuna CI remota eseguita. L'audit locale non certifica telefoni, altri seed,
  tutte le scale/rotazioni, salvataggi esistenti o prestazioni di produzione.
