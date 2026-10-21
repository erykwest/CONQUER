# CONQUER — cartelli stradali QA alle quattro strade del pozzo (21/10/2026)

**Stato:** implementazione sperimentale nella PR #55 Draft. Non è ancora la world map, non esporta materialmente merci ad altri feudi e non è un sistema di spedizioni pubblicabile.

## Accesso e presentazione

- Dopo la fondazione e la creazione delle quattro arterie, in modalità **Selezione** compaiono quattro cartelli cliccabili presso i primi rami delle strade maestre **Nord / Est / Sud / Ovest**, a circa 4,4 U dal pozzo.
- Il cartello è il **modello signpost già realizzato in `feature/scatter`**, isolato in `src/assets/road-sign-model.js`, non una nuova grafica improvvisata. La posizione segue la strada effettivamente registrata nel `State.village.roadPlan` e i segmenti completati `State.structures`; il lato della strada è scelto in modo da evitare i principali ostacoli alla vista. I cartelli non occupano slot, non costano risorse e non bloccano il pathfinding.
- Un cartello è sempre selezionabile anche quando la sua via è incompleta; il pulsante di lancio viene **disabilitato** finché la strada maestra non risulta collegata e i segmenti continui fino all'exit point reale. Non viene mai creato un collegamento fittizio al bordo.
- Il pannello del cartello permette: **Dono**, **Tributo**, **Mercante L4+ (per ora solo monete)**; selezione di 0/1 merce, quantità, monete nel **forziere**, guardie/mercenari, **carro 100** o **carretto 40**. Di default il test signorile propone **1 legno**, con guardie al massimo fino ai posti caserma disponibili, per un primo test rapido.
- Il modulo `src/settlement-wagons.js` è riusato senza riscrittura dal branch `animation`. L'animazione di cavalli/carro e il carico visivo cambiano in base al tipo dichiarato. La scorta è disegnata con figure militari QA: **araldica signorile** per il convoglio del giocatore, **cuoio/marrone neutro** per i mercenari commerciali. **Non** attribuisce soldati reali/mercenari inventati a un roster persistente.

## Semantica del test (conservazione economica)

1. Il click su **TEST: carico, scorta, percorrenza** verifica la continuità della strada **prima** di accantonare risorse. Se manca un ramo non scala niente.
2. Per dono/tributo, il test invoca il vero contratto `ConquerConvoys.planLordConvoy` e `reserveLordConvoy`: il carico e il forziere sono sottratti dagli **stock signorili** `castle` e `castleGold` e assegnati al convoglio. Le scorte richieste prenotano soltanto capienza caserme (nessuna falsa disponibilità di soldati).
3. Per L4+ il test ammette per ora **solo forziere e carro vuoto**: `planJourney` e `reserveJourneyCoins` sottraggono davvero la somma da `wallet.L4`. **Le merci mercantili vengono respinte esplicitamente**, perché il trasferimento atomico e il saldo dei venditori sul mercato locale non sono ancora realizzati. La scorta mercenaria di prova ha livrea neutra marrone; il salario è disponibile solo come preventivo, non sottratto senza un numero di giorni di viaggio.
4. Il test muove il gruppo di carri con una **sola traiettoria condivisa** calcolata da `ConquerVehicles` sul grafo stradale reale: **Mastio** per dono/tributo, **mercato** (o casa L4) per il mercante, fino all'exit point del cartello (se l'origine non è collegata si usa l'arteria verificata dal pozzo). Carri/carretti 3D con cavalli, cocchiere, carico per merce e scorte; è un **test locale di animazione**. Non simula ancora il reale tragitto Mastio→Pozzo/mercato→bordo e non calcola tempi di viaggio inter-feudo. La simulazione QA continua anche se l'orologio di gioco è in pausa.
5. All'uscita il test passa allo stato **`test-exited`**. Le risorse restano **nel convoglio in prova**, non sono consumate o consegnate a nessun feudo immaginario. Il pulsante **Ripristina test e risorse** funziona sia durante che dopo l'animazione: riporta esattamente **una volta** il contenuto del convoglio al castello o al wallet L4, sblocca la capienza guardie e rimuove il test. Il test è persistente nei salvataggi locali/cloud sotto `State.economy.commerce.roadSignTest`, per consentire rollback anche dopo il caricamento.
6. Un solo test attivo o giunto all'exit alla volta: non è possibile eseguire una seconda partenza finché non si è ripristinata la prima.

**Vincolo sicurezza contabile:** il ripristino è una funzionalità di **QA**. Non potrà essere utilizzato per rimborsare vere carovane già consegnate quando le rotte mondiali saranno operative. Il prefisso ID `road-test-` e lo stato `test-exited` rendono esplicita la distinzione rispetto alla logica futura.

## Integrazione e limiti

`src/settlement-road-sign-tests.js` viene caricato dopo `ConquerCommerce/ConquerConvoys` e prima dell'app. Le funzioni sono agganciate a `settlement-app-input.js` (hit test solo modalità Selezione), `settlement-render.js` (overlay dinamico, modello scatter vero, animazione carro/guardie) e `settlement-app-simulation.js` (ticker di animazione separato dai costi economici).

Quando non c'è alcun convoglio in prova, il ticker ha costo trascurabile e non interroga il pathfinding. Le posizioni dei quattro cartelli sono cached e aggiornate al cambio della topologia/connessione; non vengono create entità fisiche persistenti per lo scatter.

Il pannello ha anche **▶ Carrozza nobile (solo animazione)**: una carrozza dalla casa L4 (o Mastio) al confine, con due guardie, senza risorse né salvataggio.

**Aperti:** occlusione 3D dietro gli edifici in WebGL, segnaletica allo zoom minimo, reale costo giornaliero/mercenari, roster militari, prelievo mercantile con pagamenti ai fornitori, risoluzione mondo/celle/rotte e automazione. Nessun deploy Vercel, `main` invariato.

**QA automatizzata:** `qa/road-sign-convoy-regression.cjs` verifica quattro cartelli, asset originale, click, strade discontinue, scala fondi vera e singola, capienza scorta, ritorno risorse dopo fine/ripresa salvataggio, mercenari e render statico signpost/carri. La CI economica comprende anche le regressioni preesistenti.
