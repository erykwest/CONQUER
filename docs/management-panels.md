# CONQUER — Settlement control center (branch panels)

> **Stato aggiornato 30/10/2026:** il Centro di controllo (9 viste, storico max 26 mercati) è **MERGED su `main` tramite [PR #103](https://github.com/erykwest/CONQUER/pull/103)**. Le sezioni che descrivono la branch `panels`, le QA e le anteprime del 29/10 sono **cronaca tecnica del lavoro precedente al merge**, non un indicatore di funzionalità ancora da integrare. Rimangono aperte soltanto le estensioni indicate (festività simulate, occupazione L2–L4, leva e diplomazia mature). [Audit live 30/10](context/AUDIT-2026-10-30.md).


## 2026-10-29 — Ristrutturazione e restyling del Centro di controllo · branch `panels`

- `settlement-panels.js` riorganizzato: helper condivisi (card, KPI, tabelle, select), un solo motore di grafici SVG con griglia, etichette giorno intere e tooltip per punto; avvisi calcolati una volta per render.
- Correzioni: la sezione scelta resta attiva alla riapertura; il selettore produzione elenca solo i siti del signore (niente linea a 0 per i privati); le barre delle riserve scalano sul massimo tra scorta e target.
- Aggiornamento live tramite `ConquerGame.subscribe` (throttle 500 ms) più heartbeat di 4 s al posto del ridisegno ogni 1,8 s; scroll orizzontale delle tabelle conservato.
- Restyling `settlement-panels.css`: navigazione su una riga scorrevole con badge avvisi, intestazione di sezione, KPI con accento di stato (ok/attenzione/critico), card larghe per grafici e tabelle, intestazioni tabella fisse. Cache `?v=panels-3`.
- QA: `qa/panels-regression.cjs` (+ sezione persistente e selettore solo signore) e `qa/economy-panel-history-regression.cjs` PASS in locale; verifica visiva nel browser con dati dimostrativi, nessun errore in console. CI non ancora eseguita su questo commit.
## 2026-10-29 — Storici gestionali e anteprime visive · branch `panels`

- Campionamento a ogni mercato settimanale nel ledger economico: fino a 26 rilevazioni persistite di popolazione, felicità media e per classe, prezzi, occupazioni L1 e quantità prodotte per attività con proprietà dell'epoca; nessuna retrodatazione per salvataggi precedenti.
- Grafici storici nel Centro di controllo: welfare generale, felicità per classe, mansioni L1, prezzi selezionabili per risorsa, produzione del signore totale o per singola attività. I dati restano nel campo `State.economy` già persistito.
- Regressioni `qa/panels-regression.cjs` e `qa/economy-panel-history-regression.cjs`; screenshot browser via `qa/panels-browser.mjs` e workflow dedicato, con badge **DATI DIMOSTRATIVI**. Non attribuire screenshot fixture a una partita reale.
- QA GitHub Actions **8/8 PASS su `38ea7ab`**; Chromium ha acquisito 9 screenshot senza errori pagina: [Run e artefatto immagini](https://github.com/erykwest/CONQUER/actions/runs/40800506799). Resta la revisione visiva prima del merge.


## Obiettivo

Un **centro di controllo** dentro il Profilo della partita, accessibile dalla scheda «CENTRO DI CONTROLLO». Non è un secondo motore economico: offre dati aggregati e azioni delegate a `ConquerGame.commands` e ai sottosistemi esistenti.

## Viste e fonti effettive

| Vista | Dati e grafici presenti su branch `panels` | Limiti / follow-up |
| --- | --- | --- |
| Generale | Residenti, welfare, tesoreria, cantieri, cavalieri, alert; istogramma classi e linee produzione/domanda cibo | Solo eventi coperti dai sistemi esistenti |
| Popolazione | Residenti L1–L4, felicità per classe; controllo aliquota e razioni; giorni mercato/riposo | **Festività straordinarie TBD**, nessun bonus simulato; storico felicità disponibile da ora, non retroattivo |
| Economia | L1 per mansione, capitale L4, oro signore, beni/prezzi/giacenze, vendite %, storico 8 mercati cibo | Occupazione L2/L3/L4 da sviluppare; prezzi settimanali ora storicizzati |
| Proprietà | Imprese per proprietà signore/settore L4, valore, manodopera, utile annuo quando disponibile, acquisto/vendita | Produzione settimanale per sito e proprietà registrata al momento del lavoro; utili annuali, non proiezioni |
| Scorte del castello | Magazzino **economico** (ledger) e deposito **difensivo** (Siege) separati, capienze e autonomia | I due inventari non devono essere sommati; target economico non è capienza fisica |
| Militare | Unità combat, pattuglie, nemici, cavalieri presenti/limite, posti caserme, allarme | Capienza non significa soldati esistenti; **effetti leva TBD** |
| Cantieri | Cantieri in corso, percentuale avanzamento, occupazione L1, retribuzione cantieri | Grafico per cantiere senza inventare un ETA se il sistema non lo conosce |
| Diplomazia | Carovane attive, lettere in arrivo e registro storico; accesso alla gestione carovane | **Trattati/reputazione/vassallaggio TBD** |
| Avvisi | Rischio cibo, domanda non soddisfatta, razioni insufficienti, cantieri senza costruttori | Altri allarmi solo quando esistono dati affidabili |

## Regole di progetto

1. **Stato unico:** non creare nuovi contatori di magazzino, popolazione, capacità militare o professioni. Leggere `ConquerGame.read`, `ConquerEconomy`, `ConquerSiege`, `ConquerCombat` e `ConquerDiplomacy`.
2. **Grafici verificabili:** composizione e capacità sono istogrammi **attuali**; la linea del cibo usa solo `balanceHistory` reale (max 8 settimane), con empty state per meno di 2 osservazioni. Non trasformare i placeholder DEV in dati del giocatore.
3. **Distinzione importante:** scorte economiche vs materiali depositati per l'assedio; posti nelle caserme vs soldati in campo; felicità attuale vs storico; aliquota leva impostata vs soldati mobilitati.
4. **Controlli funzionanti:** tassazione, razioni, quote vendita e compravendita imprese passano al motore attuale tramite `ConquerGame.commands`; il pulsante carovane apre la gestione già esistente.
5. **UI leggera:** un JS classico e un CSS indipendenti, senza nuove dipendenze o grafici canvas costosi, senza cambio del modello `State`, aggiornamento a intervalli solo quando la scheda è visibile e non ha il focus.
6. **Interfaccia esistente:** preservare Profilo/Partita e Araldica, senza replicare il pannello laterale «Gestisci» della UI v2; i pannelli sono una vista di analisi estesa, non un sostituto del menu operativo.

## Iterazioni successive (non implementate)

- P1: storici di redditi/imposte, occupazione L2–L4 e margine/profitto per impresa su più esercizi. Già implementati nella branch gli storici settimanali di felicità, prezzi, occupazione L1 e quantità prodotte per sito.
- P1: un **calendario delle festività** con calendario canonico, costi, sospensione del lavoro ed effetti economico-sociali simulati; evitare festività puramente decorative.
- P2: pannello difensivo di **prontezza** (personale armato, attrezzature, presidio degli accessi, scorte, autonomia), solo dopo integrazione del roster militare.
- P2: diplomazia inter-feudo, rapporti, obbligazioni tributarie, alleanze, richieste, progressione storica delle relazioni; modellare prima i dati.
- P2: allarmi per incendi, criminalità, tumulto, salute, manutenzione e interruzioni commerciali quando le relative metriche saranno disponibili.

## Verifica

- Smoke test isolato in runtime JavaScript con dati sintetici: parsing JS valido, 9/9 viste renderizzate, KPI e line chart prodotti da `balanceHistory` (29/10/2026).
- **Eseguite con esito PASS** in GitHub Actions su commit `38ea7ab`: `qa/panels-regression.cjs`, `qa/economy-panel-history-regression.cjs`, suite generale, browser Chromium reale e acquisizione di nove screenshot con fixture esplicitamente demo, senza pageerror. [Run](https://github.com/erykwest/CONQUER/actions/runs/40800506799).
- Stato: **codice su `panels`, non su `main`** finché non passano QA e revisione.
