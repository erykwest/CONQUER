# CONQUER — SOC-CLASS-02 · Migrazione effettiva dei quattro ceti (12/11/2026)

## Stato

**Codice implementato sulla branch della PR #206, non ancora mergiato.** Questa è una conversione delle classi civili reali (censimento, lavoro, routine, commercio e salvataggi), non una semplice rinomina delle etichette. Non rende ancora operative la domanda abitativa, le densità D1–D3, la felicità come incentivo migratorio o le rivolte nobiliari.

## Semantica nuova (ceti non evolutivi)

| Classe | Profilo | Migrazione demografica |
| --- | --- | --- |
| L1 | Servi: contadini, pastori, taglialegna, minatori, cavatori, costruttori | Immigrazione ammessa in futuro, **nessuna emigrazione volontaria** |
| L2 | Artigiani: fabbri, falegnami, sarti e altri trasformatori | Immigrazione/emigrazione in fase successiva |
| L3 | Borghesia istruita: mercanti, scribani, magistrati, amministratori | Immigrazione/emigrazione in fase successiva |
| L4 | Nobili, possedimenti e rendite | **Lealtà** distinta dalla felicità; niente ribellione armata ora |

I singoli abitanti **non guadagnano un livello** per anzianità, reddito o lavoro. La professione è distinta dal ceto e i cambiamenti futuri di proprietà/residenza richiedono sostituzione o trasferimento delle famiglie, non promozione della stessa persona.

## Conversione dei salvataggi

`ConquerSocialClasses.migrateSave` viene applicato ai salvataggi locali e cloud precedenti la versione 2, **una sola volta**; `State.village.socialSchemaVersion=2` e `State.economy.socialSchemaVersion=2` sono i marcatori.

| Vecchio alloggio | Nuovo ceto | Residenti salvaguardati | Densità provvisoria |
| --- | --- | --- | --- |
| L1 | L1 | 3 | D1 |
| L2 | L1 | 6 | D2 |
| L3 | L2 | 9 | D2 |
| L4 | L3 | 12 | D3 |

`householdResidents` preserva i residenti anche se il nuovo template di prestigio è più basso. Le densità sono **metadati**: il nuovo generatore edilizio D1–D3 resta da fare. I lotti Voronoi, coordinate, ID case, proprietà dei siti produttivi, stock e tesoreria del castello restano invariati.

Le vecchie monete L1 e L2 vengono sommate in L1; le monete L3 passano agli artigiani L2; il vecchio portafoglio L4 è suddiviso **provvisoriamente** in 25% L3 (commercio) e 75% L4 (rendite/possesso). Il totale monetario è conservato, senza coniare monete; la regola 25/75 è **ipotesi tecnica**, da approvare o cambiare. La felicità L1 risultante è la media pesata dei due ceti fusi; la lealtà nobiliare parte da 50.

I registri delle botteghe precedentemente L3 passano agli L2, i servizi disconnettono gli operatori invalidati per evitare occupanti duplicati e le spedizioni mercantili residenti diventano L3 preservando l'inventario monetario/fisico. Le precedenti priorità di Job Manager L2 dei siti estrattivi confluiscono nella lista L1, con deduplicazione; il pannello L2 richiede ancora una futura gestione specifica degli artigiani.

## Operatività

- `ConquerEconomy` calcola la popolazione per ceto da `socialTier` + `householdResidents`, preservando il numero preesistente; i lavoratori adulti sono determinati dai nuclei abitativi.
- Campi, cave, miniere, legna e vigneti impiegano L1; l'officina è L2. La selezione L1 rispetta pastori, pescatori, soldati, job prioritari, carrettieri e costruttori.
- `ConquerUrbanEconomy` genera botteghe per L2; `ConquerCommerce` assegna loro la produzione e l'incasso. I mercanti locali e le loro eventuali spedizioni appartengono a L3, mentre i siti e la rendita privata rimangono di L4.
- `settlement-population-residents` genera le identità L1–L4 per ogni casa; gli L3 possono seguire routine mercato/municipio, gli L2 le botteghe. Gli animali preesistenti conservano le regole originarie tramite `legacyLivestockTier`.
- `loyaltyL4` compare nell'economia come indicatore separato ma non modifica ancora tasse, proprietà o comportamento militare.

## Vincoli e debito tecnico

1. Il **prestigio edilizio** è ora distinto concettualmente da `densityLevel`, ma le forme architettoniche usano ancora `houseLevel`; i 12 template e la ricostruzione completa rimangono una futura feature.
2. I comandi storici di cambio livello delle case e lo spawn automatico richiedono un **motore esplicito di trasferimento/sostituzione dei nuclei**, per evitare promozioni involontarie; non considerare completata la dinamica residenziale.
3. La creazione degli istruiti L3 è operativa nella classificazione e nella routine; **non sono ancora implementate funzioni reali di magistrati, scribani, amministratori**, né nuovo sistema di immigrazione/emigrazione.
4. L'economia mantiene alcuni nomi di campi legacy per compatibilità dei salvataggi e dei pannelli (es. `l3Shops` riferito ora alle botteghe L2, fino a migrazione controllata API). Bilanciamento da verificare.
5. Gli effetti di eventi civili e heatmap restano preview inattive; felicità e lealtà non governano ancora la migrazione né il crimine locale.

## QA

`qa/social-classes-regression.cjs` verifica mappature, contabilità demografica, monete totali, idempotenza del salvataggio, classificazione dei lavori e API browser/Node. La suite è agganciata a `qa/urban-regression.cjs`. Anche i test legacy che facevano affidamento su campi, miniere, cave e carrettieri L2 sono aggiornati ai lavoratori L1. **L'esito delle GitHub Actions del commit corrente è autoritativo; non dichiarare completata l'integrazione fino al verde dei controlli pertinenti.**
