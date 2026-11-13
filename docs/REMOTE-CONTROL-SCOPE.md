# CONQUER — Main page, lobby e controllo remoto degli insediamenti

> **Scope di prodotto del 13/11/2026**. Questo documento registra le richieste esplicite del product owner e separa ciò che è DECISO dalle proposte architetturali e dalle domande APERTE. **Non è un'implementazione**: non esiste ancora un backend multiplayer autorevole né una dashboard multi-campagna pronta all'uso.

## 1. Visione e confine di prodotto

**DECISO — hub unico dopo l'accesso:** una **main page** riunisce (a) una **lobby dei server e delle campagne disponibili**, anche per un primo ingresso, e (b) le **partite già in corso a cui il giocatore partecipa**. Lo stesso account può partecipare a più campagne simultanee, con identità account distinta dallo stato di ciascuna partita (vedi [MULTIPLAYER-SERVER-SCOPE](MULTIPLAYER-SERVER-SCOPE.md)).

**DECISO — osservazione aggregata:** per ogni partecipazione attiva la main page espone **KPI di andamento dell'insediamento** e indica quale campagna/feudo rappresentano; non deve mescolare risorse, statistiche, ruoli o messaggi di campagne diverse.

**DECISO — remote control:** lo stesso hub deve diventare un'interfaccia di **gestione a distanza** del feudo, senza dover entrare nella vista di simulazione/Builder. Primo client: **browser**. Client futuri: **app Android e iOS**. La UI non può dipendere dal render della scena 3D per leggere o impartire comandi.

**DECISO — domini da far convergere nell'interfaccia:** messaggi e posta feudale (incluso recupero del lavoro della branch `messages`), diplomazia e relazioni, spedizioni/compagnie militari, tributi/carovane, mappa regionale e gestione dell'insediamento.

**DECISO — i comandi devono operare sulla partita reale**, e non su una copia indipendente dei dati della dashboard. Backend e client devono mantenere separati stato e permessi per account, campagna e possedimento.

## 2. Struttura funzionale proposta (non layout UI definitivo)

| Vista | Contenuto minimo / responsabilità | Stato |
| --- | --- | --- |
| **Home / Le mie campagne** | Campagne in cui l'account partecipa, selezione del feudo, situazione sintetica e avvisi | **DECISO** concettualmente |
| **Lobby / Trova partita** | Catalogo dei server accessibili, parametri pubblici già definiti in MP-01 (età, progressi, utenti/bot, posti/territori idonei, eventuali orari regionali) | **DECISO** concettualmente |
| **Dashboard di campagna** | KPI per feudo/campagna; collegamenti a gestione dettagliata, ordini, mappa e messaggistica | **DECISO** concettualmente; metriche esatte **APERTE** |
| **Centro di controllo remoto** | Letture e modifiche gestionali pertinenti allo stesso stato usato nel Builder, con autorizzazioni | **DECISO** come funzione; perimetro comandi **APERTO** |
| **Posta e notifiche** | Ricevuti/inviati, rapporti e allarmi per campagna, con i tempi simulati dove previsti | **DECISO** come dominio; unificazione UI **PROPOSTA** |
| **Diplomazia, tributi, spedizioni** | Operazioni del feudo e stato delle azioni/convogli; comandi verso gli altri feudi rispettano le regole del mondo | **DECISO** come domini; semantica dei singoli comandi **APERTA** |
| **Mappa regionale** | Lettura politica/territoriale e interazione contestuale con territori, feudi e missioni | **DECISO** come dominio; feature specifiche **APERTE** |

**KPI candidati (PROPOSTI, non già scelti):** popolazione, felicità, scorte e autonomia alimentare, andamento economico/produzione, lavoratori, cantieri, guarnigione e allarmi, assedi, convogli in viaggio, tributi in arrivo/scadenza, lettere non lette, relazioni/vassallaggio, territori amministrati, tempi di aggiornamento dei dati. Evitare dashboard con valori inventati: distinguere **snapshot corrente** da **ultimo rapporto diplomatico ricevuto**.

## 3. Architettura da preservare

### Dati e comandi

**VINCOLO DI PROGETTO (derivato dal requisito di controllo remoto):** browser di gioco, dashboard web e futuri client mobili devono consumare **lo stesso modello autorevole di partita**. Le operazioni mutative devono essere validate lato server rispetto a `user_id`, `campaign_id`, `settlement_id`/ruolo feudale, disponibilità delle risorse e stato del mondo. La UI non deve modificare direttamente un salvataggio locale come se fosse il mondo condiviso.

**PROPOSTO — due canali logici distinti:**
1. **Comandi di amministrazione sul proprio feudo:** richiesta autorizzata del giocatore al backend della partita; effetto applicato secondo le regole/tick del motore. La latenza/efficacia dei singoli comandi è **da decidere**.
2. **Comunicazioni verso altri feudi e persone:** lettere, ordini diplomatici, allarmi e rapporti che rispettano origine, destinazione, trasporto, ETA, consegna e visibilità. Aprire la dashboard non deve rendere istantanei i messaggi che il gioco prevede viaggino fisicamente o con ritardo simulato.

**PROPOSTO:** layer di lettura leggero (snapshot, KPI, timeline ed eventi/avvisi) e layer di comando separati, senza richiedere scene 3D, canvas o simulazioni economiche parallele sul client. Prevedere audit/completamento/esito dei comandi e informazioni sulla freschezza dello snapshot. Le notifiche cross-campagna e i push mobili restano future.

### Componenti già nel repository (verificati il 13/11/2026)

- **Centro di controllo su `main`:** `src/settlement-panels.js` e `docs/management-panels.md`; nove aree gestionali, KPI/storici, letture di `ConquerGame`/Economy/Siege/Combat e comandi del motore. **Non è ancora una dashboard remota server-side**.
- **Diplomazia e convogli su `main`:** `src/settlement-diplomacy.js` e `src/settlement-convoys.js`, con **province esterne ancora astratte** e interazioni col mondo limitate dalla mancanza di World/Feudal integrato.
- **Branch `messages` non integrata:** `docs/MESSAGES-SYSTEM.md`, `src/settlement-messages.js`, `qa/messages-regression.cjs`. Include lettere con trasporto messaggero/piccione, tempi simulati e report programmati, stato persistito nel singolo insediamento e quattro feudi esterni astratti. **Non è messaggistica inter-giocatore/server reale** e non esegue automaticamente gli ordini consegnati.
- **Divergenza Git verificata:** branch `messages` **29 commit avanti e 317 indietro** rispetto a `main` nel confronto del 13/11/2026. Prima di portarla nel nuovo hub occorre **audit e cherry-pick/porting selettivo** dei contratti ancora validi, senza merge cieco.
- **Persistenza odierna:** `src/settlement-app-persistence.js` e `supabase/schema.sql` salvano la singola colonia con una chiave basata su `user_id,world_cell_x,world_cell_y`, non su `campaign_id`. La separazione account/campagna e l'accesso da client remoto sono dipendenze preliminari.

## 4. Decisioni ancora necessarie

1. **Perimetro remote control:** tutti i comandi gestionali disponibili nel Builder o inizialmente solo controllo strategico, notifiche e operazioni a livello feudale? Il piazzamento geometrico di strutture nella vista 3D potrebbe restare esclusivo del Builder.
2. **Tempistica degli ordini remoti:** gestione locale applicata al tick successivo o anch'essa mediata da messaggeri/intermediari? Separare questo principio dai ritardi inter-feudo già previsti da `messages`.
3. **Visibilità:** informazioni sempre live sul proprio feudo vs rapporti ritardati dei territori lontani/vassalli; quali KPI aggregare su più feudi e campagne?
4. **Permessi:** quali operazioni può compiere un suddito, un vassallo o un sovrano su un possedimento altrui?
5. **Stato offline:** notifiche e pianificazione azioni in server temporaneamente inattivi, comportamento di comandi accodati e conferma dell'esecuzione.
6. **UX e piattaforme:** progettazione web responsive/API riusabili prima dell'app nativa; sequenza di rilascio, autenticazione e aggiornamenti real-time.

## 5. Tranche di lavoro future (non implementate)

- **RC-01 Hub account e multi-campagna:** home/lobby, membership, switch e riepiloghi indipendenti per partita.
- **RC-02 KPI/snapshot autorevoli:** read model delle partecipazioni con fonti e timestamp, autorizzazioni e stati di allarme.
- **RC-03 Comandi remoti:** API e permessi, validazioni, coda/esiti, stessa logica di gioco senza duplicazioni.
- **RC-04 Comunicazioni/messaggi:** analisi branch `messages`, porting selettivo, nodi reali, ETA, rapporti e integrazione diplomazia.
- **RC-05 Strategia remota:** spedizioni, carovane/tributi, diplomazia e mappa regionale collegate a World/Feudal.
- **RC-06 Mobile-ready:** web responsive, API neutrali alla piattaforma, poi eventuali app Android/iOS senza riscrivere regole.
- **RC-07 QA e sicurezza:** isolamento tra campagne, autorizzazione, consistenza dello stato, velocità ×1 condivisa, messaggi ritardati, concorrenza/duplicati dei comandi e test multi-client.

**Dipendenze e roadmap:** World/Feudal (M4), MP-07 account vs campagna, persistenza autorevole, Combat/Siege/Economy unici. Questo documento **non anticipa** le milestone esistenti né dichiara pronta la dashboard remota.
