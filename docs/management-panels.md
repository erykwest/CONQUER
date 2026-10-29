# CONQUER — Settlement control center (branch panels)

## Obiettivo

Un **centro di controllo** dentro il Profilo della partita, accessibile dalla scheda «CENTRO DI CONTROLLO». Non è un secondo motore economico: offre dati aggregati e azioni delegate a \`ConquerGame.commands\` e ai sottosistemi esistenti.

## Viste e fonti effettive

| Vista | Dati e grafici presenti su branch \`panels\` | Limiti / follow-up |
| --- | --- | --- |
| Generale | Residenti, welfare, tesoreria, cantieri, cavalieri, alert; istogramma classi e linee produzione/domanda cibo | Solo eventi coperti dai sistemi esistenti |
| Popolazione | Residenti L1–L4, felicità per classe; controllo aliquota e razioni; giorni mercato/riposo | **Festività straordinarie TBD**, nessun bonus simulato; manca storia della felicità |
| Economia | L1 per mansione, capitale L4, oro signore, beni/prezzi/giacenze, vendite %, storico 8 mercati cibo | Occupazione L2/L3/L4 da sviluppare, come pure cronologia prezzi |
| Proprietà | Imprese per proprietà signore/settore L4, valore, manodopera, utile annuo quando disponibile, acquisto/vendita | Non simulare una produzione individuale del nobile; utili sono annuali, non proiezioni |
| Scorte del castello | Magazzino **economico** (ledger) e deposito **difensivo** (Siege) separati, capienze e autonomia | I due inventari non devono essere sommati; target economico non è capienza fisica |
| Militare | Unità combat, pattuglie, nemici, cavalieri presenti/limite, posti caserme, allarme | Capienza non significa soldati esistenti; **effetti leva TBD** |
| Cantieri | Cantieri in corso, percentuale avanzamento, occupazione L1, retribuzione cantieri | Grafico per cantiere senza inventare un ETA se il sistema non lo conosce |
| Diplomazia | Carovane attive, lettere in arrivo e registro storico; accesso alla gestione carovane | **Trattati/reputazione/vassallaggio TBD** |
| Avvisi | Rischio cibo, domanda non soddisfatta, razioni insufficienti, cantieri senza costruttori | Altri allarmi solo quando esistono dati affidabili |

## Regole di progetto

1. **Stato unico:** non creare nuovi contatori di magazzino, popolazione, capacità militare o professioni. Leggere \`ConquerGame.read\`, \`ConquerEconomy\`, \`ConquerSiege\`, \`ConquerCombat\` e \`ConquerDiplomacy\`.
2. **Grafici verificabili:** composizione e capacità sono istogrammi **attuali**; la linea del cibo usa solo \`balanceHistory\` reale (max 8 settimane), con empty state per meno di 2 osservazioni. Non trasformare i placeholder DEV in dati del giocatore.
3. **Distinzione importante:** scorte economiche vs materiali depositati per l'assedio; posti nelle caserme vs soldati in campo; felicità attuale vs storico; aliquota leva impostata vs soldati mobilitati.
4. **Controlli funzionanti:** tassazione, razioni, quote vendita e compravendita imprese passano al motore attuale tramite \`ConquerGame.commands\`; il pulsante carovane apre la gestione già esistente.
5. **UI leggera:** un JS classico e un CSS indipendenti, senza nuove dipendenze o grafici canvas costosi, senza cambio del modello \`State\`, aggiornamento a intervalli solo quando la scheda è visibile e non ha il focus.
6. **Interfaccia esistente:** preservare Profilo/Partita e Araldica, senza replicare il pannello laterale «Gestisci» della UI v2; i pannelli sono una vista di analisi estesa, non un sostituto del menu operativo.

## Iterazioni proposte (non implementate)

- P1: storico settimanale welfare e felicità L1–L4, prezzi, redditi/imposte, occupazione per tier e rendimento per singolo asset del signore, con registrazione nell'economia persistente.
- P1: un **calendario delle festività** con calendario canonico, costi, sospensione del lavoro ed effetti economico-sociali simulati; evitare festività puramente decorative.
- P2: pannello difensivo di **prontezza** (personale armato, attrezzature, presidio degli accessi, scorte, autonomia), solo dopo integrazione del roster militare.
- P2: diplomazia inter-feudo, rapporti, obbligazioni tributarie, alleanze, richieste, progressione storica delle relazioni; modellare prima i dati.
- P2: allarmi per incendi, criminalità, tumulto, salute, manutenzione e interruzioni commerciali quando le relative metriche saranno disponibili.

## Verifica

- Smoke test isolato in runtime JavaScript con dati sintetici: parsing JS valido, 9/9 viste renderizzate, KPI e line chart prodotti da \`balanceHistory\` (29/10/2026).
- **Non eseguite** suite Node e QA browser end-to-end in questa sessione. Prima del merge eseguire \`node qa/panels-regression.cjs\` e la suite CI del repository, poi una prova browser reale della navigazione Profilo e degli input/persistenza.
- Stato: **codice su \`panels\`, non su \`main\`** finché non passano QA e revisione.
