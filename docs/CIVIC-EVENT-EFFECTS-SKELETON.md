# CONQUER — CIV-EVT-01 · Skeleton degli effetti sociali degli eventi (12/11/2026)

## Stato

**Skeleton di preview, non gameplay attivo.** Questo modulo estende il lavoro della [PR #206](https://github.com/erykwest/CONQUER/pull/206) senza creare un secondo scheduler o duplicare le scene dei festival. Nessun aggiornamento di `State`, nessuna spesa, immigrazione/emigrazione, ricostruzione, modifica della felicità o salvataggio. Non attribuire risultati di gioco alle comparse *provisional* degli eventi visivi.

## Contratto sociale di riferimento

- **L1** = servi e manodopera (contadini, pastori, cavatori, minatori): non emigrano volontariamente.
- **L2** = artigiani: possono immigrare ed emigrare.
- **L3** = borghesia istruita (mercanti, scribani, magistrati, amministratori): possono immigrare ed emigrare.
- **L4** = nobiltà proprietaria: la metrica politica proposta è la **lealtà**, non la felicità; non si avviano ribellioni armate in questo skeleton.
- Il ceto non è una progressione: gli individui non salgono da L1 a L4. Felicità L1–L3 e lealtà L4 sono grandezze da elaborare **a livello di insediamento** in un sistema autorevole futuro.

## Riutilizzo del catalogo eventi già esistente

L'engine visuale (vedi [docs/events/README.md](events/README.md)) possiede `eventVenue`, `festivalGround`, le fasi `planned → preparing → active → clearing → idle` e gli allestimenti `joust`, `tourney`, `circus`, `feast`, `theatre`. Non viene modificato.

| Evento sociale | Setup visuale riutilizzato | Beneficiario prevalente |
| --- | --- | --- |
| Fiera | feast (banchi e bancarelle) | L2 e L3 |
| Giostra cavalleresca | joust | L4 |
| Festa religiosa | feast | L1 |
| Festa del raccolto | feast | L1 |
| Banchetto nobiliare (provvisorio sullo spiazzo) | feast | L4 |
| Torneo | tourney | L1 e L4 |
| Circo itinerante | circus | L1–L3 |
| Spettacolo teatrale | theatre | L3 |

**Disambiguazione obbligatoria:** `feast` è condiviso e non basta per capire se si tratta di fiera, sagra, festa religiosa o banchetto. Il futuro adapter dovrà impostare `venue.event.civicKind`. Solo `joust`, `tourney`, `circus` e `theatre` si risolvono automaticamente dal solo setup. I prerequisiti di chiesa/tempio e le sedi nobiliari interne non sono ancora definiti; il modulo non inventa una nuova ubicazione o il permesso di svolgere eventi.

## API read-only

Il file `src/settlement-civic-event-effects.js` espone `window.ConquerCivicEventEffects` e CommonJS:

- `CATALOG`: otto schede con costi `food/gold`, profilo felicità L1–L3, lealtà L4, variazione temporanea di prestigio e raggio. **Tutti i numeri sono segnaposto**.
- `preview(kind, venue, {resources,repeats})`: verifica compatibilità con `festivalGround`, dimensioni dichiarate, conflitti di allestimento e disponibilità **solo se viene fornito il budget**. Mostra effetti/costo senza applicarli.
- `activeEvents(venues,{repeatsByKind})`: riconosce solo strutture realmente in fase `active`, scarta eventi incompleti e deduplica le sedi.
- `settlementEffects(venues,opts)`: restituisce potenziali modificatori per felicità dei ceti 1–3 e lealtà L4, con tetto di preview e rendimenti decrescenti per ripetizioni segnalate dal chiamante. Non legge la popolazione.
- `localPrestige(venues,x,y,opts)`: influenza radiale temporanea, assente fuori raggio e quando l'evento non è attivo.
- `heatmapAt(ConquerUrbanHeatmaps,x,y,{sources,venues,base,repeatsByKind})`: proiezione locale della variazione di prestigio attraverso **l'API reale della PR #206**. Non modifica `LANDMARKS`, `BASE`, griglie, lotti o costruzioni.

Il motore di visualizzazione, i posti disponibili, le vere presenze, i prerequisiti, il pagamento e il calendario esistenti devono rimanere le uniche fonti autorevoli quando arriverà l'integrazione. Le sorgenti di domanda residenziale della PR #206 non generano famiglie.

## Da fare prima di attivare

1. Collegare le scelte UI all'`event.civicKind` e validare presso i componenti esistenti compatibilità venue/setup/durata.
2. Alimentare gli effetti solo con partecipanti reali, non con le comparse provvisorie di `ConquerEventPeople`.
3. Collegare i costi ai ledger canonici, senza seconda economia; definire costi, frequenze, fattori di ripetizione e prerequisiti effettivi.
4. Definire felicità dei ceti L1–L3 e lealtà L4 per insediamento; collegare L2–L3 a immigrazione/emigrazione, L1 a malcontento senza fuga e L4 a disobbedienza senza nuove rivolte.
5. Collegare la durata all'orologio di gioco e attivare/azzerare i bonus al cambio di fase; nessun effetto permanente o ricostruzione da un singolo evento.
6. Validare gli effetti con la criminalità territoriale autorevole e con le soglie anti-oscillazione dell'urbanistica.

## Test

`qa/civic-event-effects-regression.cjs`, richiamato da `qa/urban-regression.cjs`, verifica catalogo, compatibilità e fasi, distinzione degli eventi `feast`, effetti per ceto, lealtà nobiliare, ripetizioni, prestigio temporaneo, bridging delle heatmap, non mutazione e import browser/CommonJS. La suite locale Node e il controllo in browser vanno verificati prima di dichiarare l'integrazione. Nessun nuovo asset: audit del Lab non necessario.
