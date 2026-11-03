# Audit performance round 2 — fuoco, danni, crolli e cutaway

Data: 20 ottobre 2026. Branch locale `fix/construction-completion-perf`, base Git
`996b4a4`. Il confronto parte dal **working tree dopo il round 1**, non dal main
privo di quelle correzioni. Nessun commit, push, PR, merge, deploy o CI remota.

## Riproduzione

`qa/fire-collapse-cutaway-performance.cjs` avvia un server HTTP temporaneo su
loopback e contesti Chrome separati. Seed/RNG 12345, viewport 1440×900, DPR 1,
zoom 0,72, terreno piatto, 24 case L2, 12 torri L3 e sei mura. Le torri hanno
arredi/funzioni per esercitare le stanze. Nessun salvataggio personale viene
caricato, le chiamate Supabase sono bloccate e non servono permessi amministrativi.

Scenari:

- **Fuoco:** 32 strutture incendiate, 24 case + otto torri lignee, un aggiornamento
  di 1,2 secondi simulati. La prima prova esclude la brigata per isolare il danno.
- **Danno:** 12 colpi reali di trabucco che riducono gli HP senza cambiare il volume.
- **Crolli:** 12 torri perdono un piano e diventano ceppi, sei campate vengono
  aperte; 30 eventi di crollo, con frammenti, polvere e macerie reali.
- **Cutaway:** toggle tramite il vero pulsante del pannello e 12 torri aperte,
  arredate e con occupanti animati.
- **Brigata:** stesso incendio con pozzo e sei addette allo spegnimento.
- **Combinato:** fuoco + crolli con il vero ciclo di simulazione in esecuzione.
- **Incendio fino al crollo:** 50 secondi simulati, senza colpi di prova, per
  verificare che siano le fiamme a far cadere le case e a produrre macerie ardenti.

Il test scalda le cache prima dell'azione, misura il suo costo, i ridisegni e le
invalidazioni della navigazione, poi osserva l'animazione per 1,5–2,5 secondi.
Profili CPU, screenshot e JSON sono in `output/playwright/round2/`, ignorata da Git.
La copia `before/src/` conserva i sorgenti del round 1 per il confronto dopo il fix.

```powershell
# Richiede Playwright disponibile nel normale resolver Node o tramite NODE_PATH.
$env:PERF_ASSERT='1'
node qa/fire-collapse-cutaway-performance.cjs after-final
node qa/destruction-performance-regression.cjs
```

`PERF_MODES`, `PERF_SCENARIOS` e `PERF_WINDOW_MS` restringono il benchmark.
`PERF_SNAPSHOT=1` salva la base prima di modificarla; `PERF_OVERLAY` serve quella
copia senza sovrascrivere il checkout. I probe `defer-draw`, `no-fire-render` e
`no-timber-render` sono ablation diagnostiche e non fanno parte dei fix runtime.

## Cause dimostrate e modifiche

1. **Ridisegno e navigazione per ogni colpo.** Ogni danno chiamava `draw()` e
   `markDirty(true,true,true)`, anche se cambiavano solo gli HP. Il fuoco su 32
   bersagli produceva 32 disegni e 32 invalidazioni in un solo aggiornamento.
   Rinviando solo il disegno, il probe scende da circa 6,2 s a 30 ms, a parità di
   danni. Il fix persiste gli HP e aggiorna le crepe dinamiche senza invalidare
   geometria o percorsi. Breccia, porta rotta e crollo invalidano ancora gli ostacoli.
2. **Cicli di animazione concorrenti.** Fire e Siege avviavano RAF propri oltre
   al ciclo della simulazione. Nell'app completa ora richiedono un frame al ciclo
   condiviso. Il fuoco continua a variare visivamente in pausa e i crolli finiscono
   la loro animazione; la simulazione del fuoco rimane invece legata al tempo di gioco.
   Il fallback dei moduli usati senza l'app conserva il precedente RAF autonomo.
3. **Macerie ferme trattate come mobili.** Le mesh finali erano già memoizzate
   nel dominio, ma il renderer ne ricalcolava colori/normali e ricaricava tutti i
   vertici a ogni frame. Ora hanno un buffer statico, aggiornato quando cambia
   la lista o la rotazione. Le parti in caduta rimangono dinamiche, senza ridurre
   frammenti, polvere o collisioni. Memorizzata anche la durata dei blocchi;
   timer e cache delle macerie vengono puliti al caricamento e all'espulsione
   oltre il limite già esistente di 200 eventi.
4. **Cutaway statico ridisegnato.** Nel mondo WebGL, pareti, pavimenti e arredi
   venivano dipinti a ogni frame. Ora riusano la cache composita esistente,
   limitata a 32 MiB, con chiavi per geometria, funzioni, selezione, materiali,
   stagione, proiezione, rotazione, quota e asset caricati. Gli occupanti restano
   animati separatamente. Se il composito supera i limiti, si usa il disegno diretto.

## Confronto conclusivo

Esecuzioni `before-final.json` e `after-final.json`, Chrome 155, stessa macchina e
configurazione. **Il tempo dell'azione esclude il rendering differito:** la tabella
non dice che i crolli animati siano gratuiti o che il frame rate sia garantito.

| Renderer | Azione | Prima | Dopo |
|---|---|---:|---:|
| WebGL2 | Fuoco su 32 strutture | 7.256 ms | 6,3 ms |
| WebGL2 | 12 colpi senza crolli | 228 ms | 2,8 ms |
| WebGL2 | 30 eventi di crollo | 1.231 ms | 15,4 ms |
| Canvas | Fuoco su 32 strutture | 11.410 ms | 8,2 ms |
| Canvas | 12 colpi senza crolli | 545 ms | 0,6 ms |
| Canvas | 30 eventi di crollo | 10.149 ms | 13,2 ms |

Ridisegni durante queste azioni: 32/12/30 → **zero**, con un frame richiesto al
ciclo comune. Navigazione durante danni ai soli HP: 32/12 → **zero**; durante i
crolli restano 54 invalidazioni, conservando l'aggiornamento di ostacoli e unità.

Nel test WebGL i 12 cutaway passano da **20,4 a 5,9 ms per disegno** (P50);
P95 25,3→7,8 ms. L'apertura iniziale richiede ancora 73 ms nell'ultima prova.
Le macerie WebGL ferme richiedono circa **0,6–1,7 ms per disegno**, senza nuovi
upload per otto disegni consecutivi; ruotando la camera l'upload viene rifatto.

## Verifiche e problemi ancora presenti

- Confronto pixel del cutaway diretto/cache a rotazioni 0/1 e palette stone/clay:
  errore medio per canale <0,01; circa 0,006% dei pixel supera la differenza 16
  nello scenario ruotato. Il test usa contesti Canvas nuovi per ogni confronto,
  evitando di confondere stili ereditati da un'altra prova con un errore della cache.
- Le prove del dominio verificano ancora propagazione e pioggia, tetti lignei
  separati dalla muratura, portone separato dalla torre-porta, brecce percorribili,
  macerie bloccanti, perdita dei piani e ceppi persistenti.
- Quattro regressioni nuove su HP senza invalidazioni, fuoco esteso senza
  ridisegni interni, crolli con collisioni e reload delle macerie senza cache obsolete.
- Brigata: sei addette presenti; un aggiornamento iniziale richiede **142–328 ms**
  nelle prove dedicate. La preparazione dei percorsi resta da ottimizzare.
- Crolli attivi WebGL: P95 **102 ms** nell'ultima campagna, circa 26–34 ms in altre
  prove. Le prestazioni migliorano nettamente quando i frammenti si fermano;
  il calcolo della mesh durante la caduta rimane un costo reale.
- **Fallback Canvas ancora critico con crolli estesi:** un disegno arriva a
  **2,23 s** per il painter di decine di migliaia di triangoli. La cache del buffer
  WebGL non risolve questo percorso. Anche il cutaway Canvas rimane variabile e
  non beneficia della nuova cache specifica del mondo WebGL.
- I campioni del fuoco esteso hanno frame rate e latenza di composizione variabili.
  Escludere solo il disegno delle fiamme o solo il corpo delle torri lignee non
  elimina il fenomeno: non è dimostrato un unico ulteriore responsabile. Servono
  misure più lunghe del percorso misto WebGL/Canvas e della composizione GPU.
- Nel combinato attivo fuoco/crolli: 24 incendi, 30 crolli e 12 ceppi; P95 draw
  circa 57–118 ms. I ridisegni osservati provengono dal solo ciclo di simulazione.
- Nel burn-down di 50 secondi: zero case superstiti, 24 focolai nelle macerie,
  32 eventi di crollo compresi i piani lignei; otto incendi ancora attivi. Il batch
  di logica richiede 33 ms e non disegna al proprio interno. Il disegno resta
  separato, con P95 126 ms nella finestra di animazione di questa prova.
- GPU rilevata nell'integrazione finale: Intel Iris Xe, ANGLE / Direct3D11.
  Non è stata forzata una GPU software; i risultati restano specifici di questa
  macchina e del browser headless, con finestre brevi e variabilità osservata.
- Eseguite tutte le **56 suite** `qa/*-regression.cjs`: **54 PASS / 2 FAIL**.
  Restano `refactor-app-population-regression.cjs` e `wall-bays-regression.cjs`,
  già riprodotti su main nel round 1. Le quattro nuove regressioni, Fire, Collapse,
  room/slot e i controlli del round 1 passano. Sintassi di tutti i moduli JS e
  whitespace PASS. Nessuna eccezione JavaScript non gestita nelle campagne browser.
  Risultati/log completi in `output/playwright/round2/regressions.{json,log}`.

Questi risultati identificano e correggono i blocchi sincroni e parte del costo
grafico. Non certificano fluidità universale, tutte le macchine/rotazioni/scale,
sessioni lunghe, telefoni o salvataggi di produzione.
