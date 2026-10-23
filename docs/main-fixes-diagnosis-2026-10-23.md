# Diagnosi: fondazione strade, test DEV e fallback WebGL

## Correzioni implementate dopo la diagnosi — 23/10/2026

Branch `fix/main-founding-dev-webgl-20261023`, riallineata alla main `bc82dbee5c8da30bebea9e93049c6f85701c7e51`, compreso l'Asset Lab #82. La diagnosi originale sotto è conservata come evidenza storica.

- **WebGL:** un VAO per programma separa gli attributi dei vari passaggi. La regressione browser falliva prima del fix con renderer disattivato; ora passa dopo cinque colpi d'ariete, ricreazioni dei buffer, rotazioni e cambi giorno/notte, senza errori GPU osservati. Il test induce poi una vera perdita del contesto e verifica il fallback Canvas con gli stessi danni al portone. Nessun errore viene mascherato, nessuna query GPU aggiunta per draw.
- **Strade:** `primaryRoadBridgesWork` prepara i ponti senza mutare lo stato e cede il controllo nelle scansioni geometriche. `rebuildArterialWork` prepara l'intera route e sostituisce quella vecchia soltanto se la revisione è ancora valida; solo allora apre i corridoi forestali. La regressione di lavoro massimo per avanzamento falliva prima con 155.287 controlli di distanza; ora il massimo è 24 su un fiume di 201 punti. L'annullamento durante la scansione preserva strada e ponte precedenti, edificio sopraggiunto e bosco.
- **DEV:** aggiornate solo le tre aspettative della suite browser a `null`, aggiungendo clic sui controlli reali e ritorno alla modalità automatica. I default runtime restano quelli intenzionali del 15/10.

### Verifica del codice corretto

- **68 suite deterministiche** `qa/*-regression.cjs` PASS e **152 file** di sorgenti/test con sintassi valida. Il successivo affinamento del checkpoint di cancellazione è stato riverificato con la nuova regressione stradale; la CI ripete tutta la batteria sul commit finale.
- **Browser Chromium:** `qa/main-fixes-browser.mjs` e `qa/ui-combat-regression.mjs` PASS; WebGL attivo, vero context-loss gestito, override DEV e suite UI/Combat completa. Le prove non certificano tutti i driver GPU.
- **Foresta seed 4242, tre ripetizioni:** massimi callback 7,38 / 6,47 / 7,02 ms; 28 / 26 / 25 callback; rispettivamente 177 / 158 / 155 ms cumulativi. Sempre 82 strade, 2 ponti, 4 collegamenti e SHA-256 geometrico `7554422d74f781a9e32a2c5a123a5a7b7d3abb74a66f20a285cadf750cafc540`, uguale alla baseline. Nessuna soglia temporale dei test aumentata. Un'esecuzione simultanea a Chromium ha superato 100 ms in un caso della suite originale; il giro isolato è passato: carico dell'host e pause del runtime restano limiti delle misure temporali, non garanzie di 6 ms.
- **Audit Lab:** 456 render, 0 errori, 49 avvisi preesistenti; 11 firme cambiate su torri/porta in legno, lo stesso insieme già segnalato dalla CI di #82 rispetto alla baseline. Rivisti i fogli porte, torri e mura: nessuna variazione di asset introdotta dal fix. Conservata la baseline; cantieri non progressivi e danno visivo dei portoni restano nel backlog separato.
- **CI ripetibile:** `.github/workflows/main-fixes-regression.yml` esegue su push della branch regressioni, sintassi, Context sync, due suite browser e audit Lab, pubblicando gli artefatti. Lo stato reale della CI si legge sul run del commit pubblicato.

STATUS, BACKLOG, CHANGELOG e DECISIONS aggiornati nello stesso branch. ROADMAP invariata. Nessun merge in main né deploy. Le sezioni seguenti descrivono il commit di sola diagnosi `88c899f`.

## Diagnosi originale

Data: 23/10/2026. Branch: `fix/main-founding-dev-webgl-20261023`.
Base verificata: main `b79ea998b8127fefb909a6644e0c12b7413aa171`.
Il commit nuovo di main rispetto a `518e830` modifica solo documentazione: i tre percorsi runtime sono gli stessi della precedente riproduzione.

Durante il lavoro main è avanzata a `7f7cfbe` (soli documenti e workflow di pulizia branch); verificato che `src/` e `qa/` non cambiano rispetto alla base riprodotta. Il report conserva anche questi aggiornamenti. La pulizia ha rimosso questa branch quando era ancora identica alla vecchia main: viene ripristinata con il commit di diagnosi, come branch attiva richiesta dall'utente.

**Questo documento registra cause ed esperimenti, non tre fix completati. Nessun sorgente runtime o test permanente è modificato in questo commit.**

## 1. Fallback WebGL: attributo abilitato con buffer eliminato — confermato

### Catena causale

1. `ensureContent` elimina i vecchi buffer delle varianti castello/scatter (`src/settlement-world3d.js:989`, `:1026`).
2. `bindAttrib` abilita gli attributi vertex, ma nessun passaggio li disabilita o isola per programma/VAO (`:1050`). Lo stato sopravvive al disegno precedente.
3. Eliminare un buffer ancora referenziato lascia un attributo abilitato senza buffer. Il passaggio terrain successivo ricollega soltanto `aPos` (`:1075`).
4. `drawArrays` fallisce con `INVALID_OPERATION` (1282), «no buffer is bound to enabled attribute». Il normale controllo differito rileva l'errore e disabilita World 3D, attivando correttamente il fallback Canvas.

### Prova nel browser reale

Chromium con SwiftShader, sandbox Asset Lab, seed 12345, portone in pietra con grata e cinque click reali «Test ram». La strumentazione legge lo stato degli attributi e conserva gli errori per il normale controllo del gioco: non li nasconde consumandoli prima del poll.

- Prima chiamata errata: `renderBack`, riga 1075. Attributo 0: buffer valido; **attributo 1: enabled=true, buffer=null**; attributi 2/3 ancora collegati al buffer precedente.
- Traccia di eliminazione: il buffer 18 era ancora collegato agli attributi 0 e 1 quando `ensureContent` lo ha eliminato alla riga 989.
- Baseline: 2 errori GL catturati; renderer finale disabilitato, motivo `world3d-draw: WebGL2 renderer failure`.
- Esperimento A/B, unica variazione: disabilitare prima del draw gli attributi abilitati senza buffer. **0 errori GL, renderer ancora attivo dopo 825 draw**, stessi HP finali core 250 / porta 0 / grata 0.

**Conclusione:** difetto della gestione dello stato degli attributi GPU nel renderer, non una differenza delle regole di danno di converge. Il fallback funziona e non deve essere rimosso. Non serve disattivare i controlli GL per nascondere il sintomo.

**Direzione del fix, non ancora implementato:** gestire esplicitamente gli attributi richiesti da ciascun programma o usare VAO isolati, gestendo anche l'eliminazione dei buffer. Le interrogazioni GL per ogni draw sono solo diagnostiche: non vanno portate nel rendering normale, per preservare il contratto prestazionale del poll differito.

## 2. Test DEV: aspettative precedenti al cambiamento voluto — confermato

`qa/ui-combat-regression.mjs:49–51` pretende `day`, `summer`, `sun`. L'inizializzazione attuale (`src/settlement-core.js:115`), i nuovi salvataggi, il caricamento e «nuova mappa» impostano invece gli override a `null`, cioè calendario, luce e meteo automatici.

La cronologia spiega il disallineamento:

- `7dfc3c9` / 14 ottobre: introdotti i preset DEV forzati.
- `cb62053` / 14 ottobre: aggiunte le tre aspettative nel test browser.
- `09c8e348` / 15 ottobre: introdotto volutamente il default automatico; aggiornato `qa/urban2-dev-controls-regression.cjs`, che richiede già tre `null`, ma non queste tre aspettative della suite browser.

### Prova A/B

- Suite browser originale, pagina e contesto nuovi: FAIL `null !== 'day'`.
- Copia diagnostica della stessa suite: cambiate **solo le tre aspettative** in `null`, senza modificare il gioco. **Tutta la suite PASS**, inclusi HUD, industrie, impronte invernali (8), case L3/L4, pattuglia +/− e serializzazione. Nessuna eccezione browser.

**Conclusione:** test obsoleto, non default runtime guasto. Ripristinare giorno/estate/sole nel gioco cancellerebbe una scelta intenzionale. Il fix corretto riguarda le aspettative della suite e la distinzione fra default procedurale e override espliciti.

## 3. Fondazione strade: budget cooperativo incompleto e soglia temporale sensibile al carico — confermato

Il test usa seed espliciti, ma misura il tempo reale di ciascuna callback e fallisce oltre 100 ms (`qa/founding-regression.cjs:34–37`). Il fallimento è intermittente: **8/8 nuove esecuzioni non strumentate PASS** in questa sessione; massimi Foresta 28–43 ms. Nella precedente campagna lo stesso test aveva superato 100 ms anche sulla main, inclusa un'esecuzione isolata.

### Catena causale osservata

- Lo scheduler imposta 6 ms, ma controlla il tempo **solo dopo il ritorno di `iterator.next()`** (`src/settlement-world.js:1838–1840`). Il limite è cooperativo, non interrompe una singola operazione lunga.
- La ricerca e la semplificazione cedono il controllo tramite generatori.
- Dopo la ricerca, `rebuildArterialWork` materializza l'intero percorso in un ciclo senza yield (`:469–479`). Per ogni tratto chiama `autoPrimaryRoadBridges` (`:1900`), che verifica i corsi d'acqua, crea eventuali ponti e apre i corridoi nel bosco. Tutta la finalizzazione della singola strada ricade in uno stesso avanzamento del generatore.
- Profilazione del caso Foresta seed 4242: 82 chiamate a `autoPrimaryRoadBridges`, circa 121 ms cumulativi su circa 158 ms del generatore complessivo; la finalizzazione domina, non il controllo di continuità delle strade. Questi sono tempi strumentati, non una misura di prestazione di produzione.

### Esperimento A/B senza profilazione dei singoli metodi

Stesso harness, seed 4242/Foresta, tre ripetizioni per variante. Una sola modifica in memoria: yield ogni quattro segmenti durante la finalizzazione. Nessuna modifica salvata al sorgente.

| Variante | Massimo callback, tre esecuzioni | Callback totali | Esito finale |
|---|---|---|---|
| Baseline | 30,0 / 25,6 / 26,8 ms | 6 / 6 / 5 | 82 strade, 2 ponti, 4 collegamenti |
| Finalizzazione suddivisa | 16,9 / 12,6 / 12,9 ms | 16 / 16 / 15 | 82 strade, 2 ponti, 4 collegamenti |

Geometria finale byte-equivalente nel confronto, dopo esclusione degli ID: SHA-256 `7554422d74f781a9e32a2c5a123a5a7b7d3abb74a66f20a285cadf750cafc540` in tutte le sei esecuzioni. I target sono selezionati da `seedRand`, e non sono risultati variabili per casualità non controllata. Il numero di callback cambia anche perché dipende dal tempo di esecuzione, pur mantenendo lo stesso lavoro finale.

**Conclusione:** una debolezza reale del frazionamento del lavoro rende il test fragile su host lenti/sotto carico. Non è dimostrato che ogni precedente picco >100 ms sia dovuto esclusivamente alla finalizzazione; pause del runtime e carico dell'host possono amplificarlo. Non è corretto né dichiarare il gioco sempre bloccato né liquidare il caso come semplice soglia da aumentare.

**Direzione del fix, non ancora implementato:** frazionare anche finalizzazione e controlli ponti; preservare cancellazione, revisione di navigazione e coerenza della rete mentre una route è incompleta. L'esperimento riduce i picchi ma non garantisce ancora il budget di 6 ms: non è una patch pronta. Verificare separatamente correttezza deterministica e prestazioni misurate nel browser reale.

## Stato e priorità

1. WebGL: correggere lo stato GPU e aggiungere una regressione reale sui rebuild; richiedere renderer ancora attivo, non soltanto gameplay corretto dopo fallback.
2. Strade: chiudere i tratti non cooperativi e provare interruzioni/modifiche della mappa durante la costruzione della route.
3. DEV: aggiornare la suite browser al contratto automatico e verificare gli override con azioni esplicite.

Gli esperimenti stanno in `output/playwright/main-fixes-diagnosis/` della copia locale isolata; non fanno parte dei sorgenti distribuiti. Nessuna nuova PR, nessun merge in main e nessun deploy eseguiti per questa diagnosi. ROADMAP e DECISIONS invariati: cause osservate e proposte di correzione, senza nuovi contratti progettuali approvati.
