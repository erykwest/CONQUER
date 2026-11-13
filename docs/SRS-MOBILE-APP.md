# CONQUER — Software Requirements Specification (SRS) · Mobile Companion

**Versione:** 0.5 — bozza di lavoro, **non approvata nel complesso** (scelte B e Q-02…Q-04 approvate)  
**Data:** 13 novembre 2026  
**Destinazione:** Android e iOS; prima dipendenza: hub browser e backend multiplayer condiviso  
**Stato:** SPEC / NO RUNTIME — nessuna app mobile implementata  
**Decisioni approvate:** **B — primo rilascio pubblico con controllo remoto completo**; **comandi locali al primo tick utile, comunicazioni inter-feudo con recapito simulato**; **KPI dei vassalli solo tramite resoconti di messaggeri con frequenza impostabile dal sovrano**; **possibilità di preparare ordini a server regionale in pausa, senza avanzare la simulazione fino alla riattivazione**.

## 0. Natura del documento e fonti

Questa SRS descrive il **client mobile di governo remoto** di CONQUER, non un porting del gioco 3D. Usa la forma di una specifica verificabile: requisiti con ID, priorità, stato decisionale e criteri di accettazione. Non trasforma automaticamente ipotesi in decisioni approvate.

**Fonti di scope già approvate:**
- [Remote control, hub e confine 3D](REMOTE-CONTROL-SCOPE.md) — D-RC-261113 e D-RC-BOUNDARY-261113.
- [Multiplayer, slot e account separato dalle campagne](MULTIPLAYER-SERVER-SCOPE.md) — D-MP-261113 e D-MP-ACCOUNT-261113.
- [Centro di controllo esistente](management-panels.md) — nove aree nel prototipo browser.
- [Roadmap](context/ROADMAP.md) — World/Feudal M4 e server multiplayer ancora non realizzati.
- [Sistema messages sulla branch messages](https://github.com/erykwest/CONQUER/blob/messages/docs/MESSAGES-SYSTEM.md) — funzionalità sperimentali non equivalenti a posta inter-giocatore server-side.

**Legenda:** **D = deciso** (vincolo già approvato); **P = proposta** (da accettare o modificare); **A = aperto** (richiede decisione); **C = condizionato** (eseguibile solo dopo il relativo backend). **Must/Should/Could** sono priorità progettuali proposte e NON equivalgono a una data di rilascio approvata.

## 1. Obiettivo di prodotto

L'app serve a **consultare e governare più insediamenti in più campagne persistenti** da telefono, tramite lo **stesso account** usato nella versione browser, senza avviare il Builder o una simulazione parallela. Deve rendere possibile controllare KPI, lavoro, economia, fisco, cantieri già localizzati, ordini militari strategici, posta, diplomazia, tributi, carovane e mappa regionale, nel rispetto di tempi simulati e permessi feudali.

### 1.1 Entro lo scope (D)

- Accesso alla propria identità e alle partecipazioni in più campagne contemporanee.
- Home aggregata con campagne in corso, stato del feudo, indicatori e notifiche riferite al corretto contesto.
- Lobby delle partite disponibili con caratteristiche pubbliche e disponibilità effettiva di ingresso.
- Controllo amministrativo e strategico **sullo stato reale del server**.
- Diplomazia, posta feudale, spedizioni e flussi tributari, non necessariamente istantanei.
- Mappa strategica regionale senza rendering integrale dell'insediamento 3D.

### 1.2 Fuori scope (D)

- Piazzamento geometrico preciso di nuove strutture sul terreno.
- Progettazione geometrica di mura, fossati, torri, porte e fortificazioni.
- Comando tattico diretto delle unità in battaglia.
- Simulazione economica, militare o diplomatica indipendente sul dispositivo.
- Trasferimento di progressi/risorse/eserciti fra campagne dello stesso account.

### 1.3 Pubblico e ruoli

- **Giocatore / titolare di account:** può avere più partecipazioni simultanee.
- **Signore di un feudo:** gestisce il proprio insediamento entro le regole della campagna.
- **Suddito / vassallo / sovrano:** possibili ruoli distinti per campagna; **privilegi specifici ancora aperti**.
- **Visitatore non iscritto:** consultazione della lobby pubblica, **se e come** consentita dall'autenticazione da definire (P).
- **Backend autorevole:** decide risultati, disponibilità, tempi, autorizzazioni e conflitti di comandi; non è un secondo giocatore.

## 1.4 Requisito per il primo rilascio pubblico — DECISO (scelta B)

**D — First public release:** la prima versione mobile distribuita per Android e iOS deve già offrire **tutto il controllo remoto gestionale e strategico definito**, non soltanto home, lobby, KPI, messaggi o pochi comandi economici. Funzioni obbligatorie: account e partecipazioni multi-campagna, dashboard, **economia, lavoro/Job Manager, fisco, priorità e programmazione cantieri già collocati nel 3D, spedizioni e ordini militari strategici, diplomazia e posta feudale, tributi/carovane e mappa regionale interattiva**. Restano esclusi piazzamento geometrico, progettazione delle fortificazioni e controllo tattico diretto.

**D — Distinzione rilascio/test:** versioni incrementali *interne*, alpha e beta sono ammesse per sviluppo e test, ma **non** costituiscono il primo rilascio pubblico accettato. Non si può pubblicare una dashboard read-only come versione finale del prodotto mobile.

**C — Gate obbligatorio:** per essere pronto al rilascio, ogni dominio deve avere azioni reali persistite e validate da un backend autorevole, visibili in browser e app, con test end-to-end; niente pulsanti dimostrativi. **A:** inventario preciso dei singoli comandi per dominio e relativi permessi da approvare; il dettaglio non riduce il perimetro confermato.

**P — Migliorie non obbligatorie al primo rilascio:** push di sistema, cache offline read-only e archivio campagne concluse, salvo diversa decisione. La **posta in-app**, la conferma degli ordini e gli errori comprensibili sono invece necessari.

## 2. Contesto applicativo e navigazione

**Struttura informativa candidata (P):**
1. **Home / Le mie campagne** — una scheda per partecipazione, con titolo server, ruolo, stato temporale, KPI essenziali, alert e ingresso alla dashboard.
2. **Lobby** — elenco/filtri delle campagne, informazioni pubbliche, indicazione della possibilità reale di fondare un feudo, ingresso se autorizzato.
3. **Dashboard di campagna** — economia, popolazione, cantieri, difese e storico.
4. **Messaggi** — posta, rapporti, richieste diplomatiche e stati di trasporto, organizzati per campagna.
5. **Mappa regionale** — territori, sovranità, rotte, spedizioni e operazioni strategiche.
6. **Profilo / Impostazioni** — account globale, preferenze, notifiche, privacy, stato delle sessioni.

**D:** le informazioni delle campagne non si mescolano; ogni schermata operativa comunica chiaramente campagna e feudo correnti. **P:** navigazione a schede, filtri e selezione rapida per campagna; layout definitivo non approvato.

## 3. Requisiti funzionali

Ogni riga definisce un requisito tracciabile. La conferma del **dominio** non implica che siano già approvati tutti i suoi sotto-comandi.

### 3.1 Account, partecipazioni e lobby

| ID | Requisito | Stato | Priorità proposta |
| --- | --- | --- | --- |
| FR-ACC-01 | Il client usa un account globale comune al browser, non un profilo per server. | D/C | Must |
| FR-ACC-02 | Elenca e apre più campagne simultanee dello stesso account; dati isolati per campagna. | D/C | Must |
| FR-ACC-03 | Consente di passare da una campagna all'altra senza sovrascrivere la precedente. | D/C | Must |
| FR-ACC-04 | Mostra l'identità/ruolo feudale contestuale, distinta dal profilo globale. | D/C | Must |
| FR-ACC-05 | Consente accesso/logout, gestione sessioni e revoca credenziali. Dettagli del provider da stabilire. | P | Must |
| FR-LOB-01 | Mostra campagne disponibili e partecipazioni già attive in una sola area di ingresso. | D/C | Must |
| FR-LOB-02 | Per ciascun server mostra metadati pubblici: età/fase, giocatori/bot, capienza, disponibilità reale di terre fondabili, progresso; orari regionali se esistenti. | D/C | Must |
| FR-LOB-03 | Indica chiaramente se una campagna è accessibile, piena, priva di posizioni idonee, non avviata, conclusa o in pausa (dove applicabile). | P | Must |
| FR-LOB-04 | La richiesta di ingresso usa le regole server: priorità a territori liberi, poi possedimenti aperti ai sudditi; nessun takeover di bot. | D/C | Must |
| FR-LOB-05 | Mostra uno storico delle campagne concluse, senza attribuire al nuovo server i progressi del precedente. | P | Should |

### 3.2 Dashboard e controllo gestionale

| ID | Requisito | Stato | Priorità proposta |
| --- | --- | --- | --- |
| FR-DASH-01 | Mostra per ciascun insediamento KPI reali e allarmi, senza contatori inventati. | D/C | Must |
| FR-DASH-02 | Distingue valore corrente, storico, informazione obsoleta e ultimo aggiornamento. | P | Must |
| FR-DASH-03 | Permette consultazione di popolazione, classi sociali, felicità/lealtà se realmente disponibili. | D/C | Must |
| FR-DASH-04 | Espone risorse, produzione, scorte, tesoreria ed eventuale autonomia alimentare, mantenendo distinti inventari economici e difensivi. | D/C | Must |
| FR-DASH-05 | I KPI del **feudo governato direttamente** sono letti dallo stato autorevole corrente; i KPI dei **feudi dei vassalli** sono disponibili al sovrano **solo dopo la consegna di un rapporto tramite messaggero**, non come lettura live dei loro dati. | D/C | Must |
| FR-DASH-06 | Per ogni rapporto di vassallo visualizza **feudo sorgente, data simulata di redazione, data di ricezione, contenuti effettivamente comunicati e stato di aggiornamento**; distingue lo snapshot storico dal dato live del proprio insediamento. | D/C per distinzione; P per dettaglio UI | Must |
| FR-DASH-07 | Il sovrano può **configurare la frequenza dei messaggeri di resoconto provenienti dai vassalli**; la modifica è un'azione autorizzata e non anticipa i rapporti ancora in viaggio. | D/C | Must |
| FR-ECO-01 | Consente gestione di lavoro/Job Manager, priorità e assegnazioni consentite. | D/C | Must |
| FR-ECO-02 | Consente politiche economiche e fiscali già supportate dal motore, inclusi tributi, aliquote e razioni se applicabili. | D/C | Must |
| FR-CANT-01 | Permette monitoraggio, priorità, risorse e manodopera dei cantieri già collocati nel Builder. | D/C | Must |
| FR-CANT-02 | Non consente di scegliere coordinate o creare geometrie tramite app mobile. | D | Must |
| FR-ECO-03 | Espone serie storiche solo per periodi effettivamente registrati; niente extrapolazioni spacciate per misure. | P | Should |

### 3.3 Militare, mappa e logistica

| ID | Requisito | Stato | Priorità proposta |
| --- | --- | --- | --- |
| FR-MIL-01 | Consulta guarnigione, disponibilità militare, allarmi, stato di spedizioni e assedi se presenti sul server. | D/C | Must |
| FR-MIL-02 | Permette ordini strategici di spedizione/marcia e gestione logistica nei limiti dei permessi del ruolo. | D/C | Must |
| FR-MIL-03 | Non attiva la modalità tattica per selezionare/controllare direttamente unità in battaglia. | D | Must |
| FR-MAP-01 | Visualizza mappa regionale con territori, controllori, rapporti feudali e rotte consentite dalla visibilità del giocatore. | D/C | Must |
| FR-MAP-02 | Dalla mappa apre dettagli e azioni strategiche applicabili al territorio, non il Builder geometrico. | D/C | Must |
| FR-LOG-01 | Consulta tributi, carovane, carico, scorte, destinazione e stato dei viaggi quando supportati dal backend. | D/C | Must |
| FR-LOG-02 | Consente azioni logistiche autorizzate che rispettano risorse reali, ETA, intercettazioni e risultato del motore. | D/C | Must |

### 3.4 Posta feudale, diplomazia e notifiche

| ID | Requisito | Stato | Priorità proposta |
| --- | --- | --- | --- |
| FR-MSG-01 | Integra caselle ricevuti/inviati, non letti, rapporto e storico della posta feudale per campagna. | D/C | Must |
| FR-MSG-02 | Supporta redazione/invio di comunicazioni, richieste o ordini diplomatici secondo le regole di recapito reali. | D/C | Must |
| FR-MSG-03 | Mostra stato del messaggio: redatto/in transito/consegnato/altro esito, con ETA solo quando calcolabile. | P/C | Must |
| FR-MSG-04 | La lettura sull'app **non anticipa** la consegna simulata; non espone messaggi o rapporti prima dei permessi/tempi previsti. | D/C | Must |
| FR-DIP-01 | Consulta relazioni, sudditanza e obblighi; consente azioni diplomatiche autorizzate dalla campagna. | D/C | Must |
| FR-NOT-01 | Organizza avvisi per campagna: posta, attacco/assedio, scorte critiche, cantieri bloccati, spedizioni, tributi. | P/C | Should |
| FR-NOT-02 | Supporta notifiche push Android/iOS, con consenso e preferenze granulari. | P/C | Should |
| FR-NOT-03 | Non usa allarmi ingannevoli, countdown artificiosi o richieste di accesso obbligatorio per mantenere progressi. | P | Should |

### 3.5 Stato offline e comandi

| ID | Requisito | Stato | Priorità proposta |
| --- | --- | --- | --- |
| FR-OPS-01 | Indica chiaramente se il server è attivo, in pausa programmata, concluso o irraggiungibile. | P/C | Must |
| FR-OPS-02 | Mostra uno snapshot locale di sola lettura quando manca rete, con indicazione esplicita che non è live. | P | Should |
| FR-OPS-03 | La UI non dichiara eseguito un comando fino a conferma autorevole del server. | P/C | Must |
| FR-OPS-04 | Invii ripetuti, retry e cambi rete non devono duplicare ordini/tributi/spedizioni. | P/C | Must |
| FR-OPS-05 | Durante una **pausa programmata della campagna**, un giocatore autenticato e connesso può **preparare e inviare ordini per l'esecuzione alla riattivazione**; la simulazione resta ferma. | D/C | Must |
| FR-OPS-06 | Gli ordini preparati sono mostrati come **in attesa della ripresa**; non si dichiarano eseguiti né modificano risorse, edifici, unità o viaggi durante la pausa. | D/C | Must |
| FR-OPS-07 | Alla ripresa, l'ordine viene sottoposto a **validazione delle condizioni correnti al momento dell'esecuzione** (permessi, risorse, conflitti, prerequisiti) prima di applicarsi al primo tick utile; gli ordini impossibili vengono rifiutati con esito visibile. | P/C — salvaguardia tecnica | Must |
| FR-OPS-08 | La **coda locale del telefono privo di connessione** non è automaticamente coperta dalla regola di pausa regionale: comportamento di invio/retry offline resta da decidere. | A | — |

## 4. Modello dati logico e invarianti

**Entità logiche richieste dal dominio (D come distinzione, P nei campi):**

| Entità | Identificatore candidato | Contenuto / vincolo |
| --- | --- | --- |
| Account | user_id | Identità trasversale, preferenze e login |
| Campaign | campaign_id | Regole, calendario, regione, stato server |
| Membership | campaign_id + user_id | Partecipazione e ruolo del giocatore nella campagna |
| Territory | campaign_id + territory_id | Sovranità, rivendicazione, idoneità allo spawn |
| Settlement | campaign_id + settlement_id | Villaggio/feudo, popolazione, strutture, economy, armi |
| Snapshot/KPI | campaign_id + settlement_id + versione | Dati e timestamp/fonte della lettura |
| GameCommand | command_id + campaign_id + actor_id | Intento, permessi, stato di esecuzione ed eventuale errore |
| FeudalMessage | message_id + campaign_id | Mittente/destinatario, trasporto, ETA, consegna, contenuto |
| Notification | notification_id + membership | Evento, categoria, riferimento, lettura e preferenze |

**Invarianti obbligatori:**
- Qualsiasi dato o comando contestuale appartiene a **una sola** campagna.
- Il server verifica l'identità, la partecipazione e l'autorizzazione sul feudo e sull'azione richiesta; la UI non è fonte di permessi.
- Un ordine remoto non aggira costi, disponibilità, tempi, cammini, conoscenza della mappa o regole di consegna.
- I dati storici esistono soltanto se salvati dal motore; il dispositivo non inventa tendenze.
- La stessa azione ripetuta con la stessa chiave di idempotenza deve avere un solo effetto (P per soluzione tecnica).

## 4a. Contratto temporale degli ordini — DECISO (13/11/2026)

**FR-TIME-01 (D/C, Must) — Amministrazione del proprio insediamento:** un comando gestionale autorizzato (es. lavoratori, aliquote, razioni, priorità di un cantiere già localizzato, ordini strategici preparatori sul proprio feudo) è **registrato dal server e applicato al primo tick di simulazione utile successivo alla ricezione/validazione**. L'invio da browser o mobile non comporta un ritardo di trasporto in-game aggiuntivo. La UI separa *ricevuto*, *accettato/in attesa di tick*, *applicato* e *rifiutato/fallito*. **La durata reale del tick non è fissata da questa SRS.**

**FR-TIME-02 (D/C, Must) — Comunicazioni tra feudi:** lettere, messaggi diplomatici, richieste e ordini indirizzati ad altri feudi si considerano **spediti**, non **recapitati**, al momento dell'invio. Contenuto ed effetti lato destinatario diventano disponibili **solo al completamento della consegna prevista dal modello messaggeri/trasporti**, con ETA calcolata dal server secondo il calendario della campagna. La semplice presenza di un'app, dashboard, push o connessione diretta non anticipa il recapito. **Non** si presuppone che un messaggio attivi automaticamente un effetto/ordine al recapito: dipende dalla semantica del singolo tipo di messaggio ancora da definire.

**FR-TIME-03 (D/C, Must) — Stesso modello temporale per tutti i client:** un comando impartito da app o browser segue le medesime regole; nessun vantaggio di velocità mobile e nessun secondo orologio simulativo.

**FR-TIME-04 (D/C, Must) — Ordini durante pause programmate:** quando un server di campagna è in **pausa regionale programmata ma raggiungibile**, l'utente può **predisporre ordini** dal browser o dall'app, che rimangono **in attesa di ripresa**. Durante la pausa **non avanzano tick, risorse, viaggi, costruzioni, calendario né consegne**. Alla riattivazione gli ordini entrano nel processo del **primo tick utile**, con validazioni applicabili. Accettare/preparare ≠ eseguire. Questa decisione **non equivale** ad autorizzare ordini offline quando il telefono non ha connessione o il server è indisponibile.

**FR-TIME-05 (P/C, Must) — Ordini che generano un viaggio:** la decisione locale di *preparare/avviare una spedizione o una carovana* può essere acquisita al tick successivo, ma **marcia, trasporto, intercettazione, arrivo e conseguenze** si svolgono nei tempi e con le condizioni proprie del motore World/Combat/Logistica; il tick non teletrasporta il risultato all'altro feudo.

**A — Confini dei comandi:** autorizzazioni, ordine delle richieste concorrenti, conflitti di risorse al tick, calendario delle consegne, percorso/trasporto, failure, limite e modifica/cancellazione degli ordini in attesa, disponibilità di altri comandi durante pausa, e regime di server non raggiungibile devono essere definiti per singola operazione. **Il diritto di preparare ordini in pausa e l'assenza di progressione durante la pausa sono DECISI**; non si attribuisce una durata arbitraria a un tick o a un viaggio.

## 4b. Visibilità feudale e frequenza dei messaggeri — DECISO (13/11/2026)

**FR-REP-01 (D/C, Must):** il giocatore può leggere i dati aggiornati del **proprio insediamento** dallo stato autorevole della campagna. Per i **feudi governati dai propri vassalli**, il sovrano **non ottiene una finestra diretta in tempo reale** su economia, truppe e risorse: vede soltanto i contenuti dei rapporti effettivamente **consegnati**.

**FR-REP-02 (D/C, Must):** il sovrano **imposta la frequenza dei messaggeri di resoconto dei vassalli** attraverso un comando remoto autorizzato. La programmazione determina *quando* i nuovi rapporti vengono prodotti/inviati, non la velocità con cui viaggiano. Ogni rapporto rispetta il sistema di trasporto e recapito simulato (FR-TIME-02). La disponibilità di un rapporto precedente non abilita la lettura del dato corrente.

**FR-REP-03 (P/C, Must per tracciabilità):** il rapporto è uno **snapshot dei dati alla data simulata di redazione**, riportata insieme a fonte e data di consegna; non va aggiornato retroattivamente con valori correnti del feudo mittente. Se una metrica non è raccolta/comunicata, la UI deve mostrarla come non disponibile, senza indovinarla.

**REUSE esistente, non implementazione multiplayer:** la branch `messages` comprende già routine con *sorgente, destinazione, frequenza (1/7/30 giorni), canale e sezioni*, e rapporti redatti al tempo simulato. Questi intervalli sono **opzioni del prototipo**, NON il catalogo di frequenze confermato per l'app: servono integrazione con vassalli veri, server autorevole e permessi.

**APERTO:** opzioni/intervalli ammessi e costi delle frequenze, configurazione globale oppure differenziata per vassallo, chi ha diritto di imporre/inibire i resoconti, contenuti obbligatori/facoltativi, eventuali intercettazioni, messaggero vs piccione e come gestire assenza di strada o server in pausa. Nessuna frequenza fissa dedotta da questa decisione.

## 5. Architettura candidata e contratti d'integrazione

**Vincolo D:** unica simulazione autorevole condivisa da browser e futuro mobile. **Proposta P:** separare servizi di lettura (KPI, messaggi, stato) e invio comandi (validazione, accettazione, esito), con API neutre alla piattaforma. Il client può essere nativo o cross-platform: **tecnologia da decidere**.

**Contratti logici candidati (NON API già disponibili):**
- Identity: login, session, profilo e preferenze.
- Campaign directory: elenco pubblico, stato, eleggibilità di ingresso, partecipazioni dell'utente.
- Campaign dashboard: snapshot di settlement, economia, popolazione, cantieri, sicurezza.
- Command gateway: comando contestuale, autorizzazione, deduplicazione, tracking esito.
- Feudal messaging: inbox/outbox, invio, progresso di consegna, report.
- World map: territori visibili, rotte, spedizioni, carovane/tributi.
- Notification service: eventi, preferenze e registrazione dispositivi, se approvato.

**Macchina stati consigliata per un comando (P):** creato sul client → ricevuto dal backend → validato/rifiutato → pianificato → applicato dal tick o concluso con errore → restituzione dell'esito; ogni salto di stato osservabile. Non confondere **accettazione** con **esecuzione**.

**Due temporalità DECIDE:** i comandi gestionali sul proprio feudo sono applicati al **primo tick utile**; lettere e comunicazioni verso altri feudi sono consegnate **dopo il tempo di trasporto simulato** (FR-TIME-01…05). Le notifiche mobile sono un terzo canale puramente informativo e non eludono il recapito in-game. Durata esatta del tick e condizioni di pausa rimangono aperte.

## 6. Requisiti non funzionali e qualità

| ID | Categoria | Criterio | Stato |
| --- | --- | --- | --- |
| NFR-SEC-01 | Sicurezza | Sessioni protette, nessuna credenziale permanente in chiaro, TLS e storage sicuro delle credenziali sul dispositivo. | P / Must |
| NFR-SEC-02 | Autorizzazione | Test automatici di isolamento cross-campaign e cross-feudo, anche con richieste alterate manualmente. | P / Must |
| NFR-SEC-03 | Integrità | Validazione lato server, idempotenza e log degli ordini mutativi. | P / Must |
| NFR-REL-01 | Coerenza | Il medesimo stato produce risultati coerenti tra browser e mobile; nessuna scrittura locale che sovrascriva il server. | D / Must |
| NFR-REL-02 | Rete | Stati espliciti di caricamento, timeout, rete assente, token scaduto, conflitto e rifiuto comando. | P / Must |
| NFR-UX-01 | Accessibilità | Navigazione leggibile e accessibile, touch target appropriati, supporto a scaling del testo, VoiceOver e TalkBack. | P / Must |
| NFR-UX-02 | Mobile first | Navigazione utilizzabile con una mano nei flussi più frequenti; niente obbligo di canvas 3D/WebGPU. | P / Should |
| NFR-LOC-01 | Localizzazione | Testo separato dal codice, numeri/date/ore locali e fuso del server esplicito; lingue iniziali da decidere. | P / Should |
| NFR-PERF-01 | Prestazioni | Target iniziale candidato: home interattiva al P95 entro 3 s su rete mobile adeguata; da validare con device/test realistici. | P / Should |
| NFR-SCALE-01 | Scala | Test per multi-campagna, campagne fino a 100 giocatori umani più bot e aggiornamenti simultanei; dimensionamento server da misurare. | P / Must |
| NFR-OPS-01 | Osservabilità | Errori e comandi tracciabili senza esporre contenuti riservati o credenziali nei log. | P / Must |
| NFR-PRIV-01 | Privacy | Minimizzare dati personali, dispositivi e notifiche; definire retention, esportazione/cancellazione e documentazione privacy prima del rilascio. | P / Must |
| NFR-PLAT-01 | Distribuzione | Rilascio Android/iOS e relative procedure store solo dopo backend e release candidate; versioni OS minime da scegliere. | A | — |

**Nota:** non sono approvati né una soglia SLA, né limiti di memoria/batteria, né target di dispositivi/OS. Questi valori vanno derivati da un prototipo e da test di carico, non inventati in questa SRS.

## 7. Scenari e criteri di accettazione

**AT-01 — Campagne multiple:** dato un account iscritto a due campagne A/B con feudi diversi, la Home mostra due schede; modificare un'aliquota in A non cambia né quella di B né il profilo globale.

**AT-02 — Visibilità e permessi:** dato un suddito senza un particolare diritto, un ordine sui beni del sovrano è rifiutato dal server anche se inviato manualmente bypassando l'interfaccia.

**AT-03 — KPI reali:** dato un insediamento privo di storico, l'app mostra stato corrente e «storico non disponibile», non un grafico ricostruito.

**AT-04 — Cantiere:** dato un edificio già collocato in 3D, l'app può cambiarne la priorità se permesso; non può creare una nuova geometria né piazzare una struttura da coordinate inventate.

**AT-05 — App e browser:** data la stessa sessione di gioco, un ordine amministrativo confermato sul mobile viene riflesso nel successivo snapshot autorevole del browser; nessun doppio aggiornamento.

**AT-06 — Messaggi feudali:** data una lettera non ancora consegnata secondo il calendario simulato, il ricevente non può leggerne il contenuto anticipatamente usando l'app o le API.

**AT-07 — Retry:** quando il telefono ripete una richiesta di spedizione con la stessa chiave, il server produce una sola spedizione e mostra il medesimo esito.

**AT-08 — Rete assente:** con un'istantanea locale disponibile, l'app la marca come non live; nessun comando è dichiarato eseguito offline senza risposta server.

**AT-09 — Pausa campagna:** dato un server non in simulazione attiva, l'app mostra la pausa e non presenta come completate le azioni ancora non applicate.

**AT-10 — Ingresso a partita avviata:** la lobby non permette di fondare se mancano slot o posizioni idonee; non assegna al nuovo account un bot pre-sviluppato.

**AT-11 — Completezza della release B:** su un server reale, la app deve poter eseguire e mostrare l'esito di almeno un percorso completo per ogni dominio approvato: assegnazione lavoratori, gestione economica, modifica fiscale, priorità di un cantiere già posizionato, ordine militare/spedizione, azione diplomatica e lettera, gestione di un tributo/carovana e comando strategico dalla mappa. Per ciascuno si verificano ruolo, costi, tempistiche, rifiuti, persistenza e sincronizzazione con browser. **L'inventario dei comandi per dominio resta da approvare**, quindi il solo superamento di questi scenari non autorizza automaticamente il rilascio.

**AT-12 — Nessun modulo fittizio:** ogni sezione obbligatoria è alimentata da dati e azioni reali; se il backend World/Feudal o i messaggi inter-giocatore non sono disponibili, il lancio pubblico non è pronto, non si riduce tacitamente al piano A/C.

**AT-13 — Comando locale al tick:** un giocatore modifica l'aliquota sul proprio feudo dal telefono; il server valida l'ordine, lo mostra come *in attesa*, e lo applica una sola volta al primo tick utile. Il browser vede il valore solo dopo conferma del tick; prima non è spacciato per già applicato.

**AT-14 — Lettera inter-feudo:** un signore invia una lettera a un altro feudo. Il mittente vede *in transito*, il destinatario non può leggerla (nemmeno chiamando direttamente le API) prima del recapito simulato; ricezione e relativi eventi si manifestano soltanto dopo consegna reale nel calendario.

**AT-15 — Indipendenza dal canale e pausa:** browser e mobile producono lo stesso esito temporale. Se il server non processa tick, un comando accettato resta *non applicato*. Nessuna notifica anticipa la conoscenza di un contenuto che non è ancora stato consegnato.

**AT-16 — Report del vassallo, mai live:** dato il feudo di un vassallo il cui magazzino cambia dopo l'ultimo rapporto, il sovrano continua a vedere il valore dello **snapshot già ricevuto** con data della sua redazione, non il valore corrente; il backend rifiuta query live non autorizzate anche se inviate direttamente.

**AT-17 — Frequenza configurabile:** un sovrano modifica tramite app/browser la cadenza dei resoconti dei propri vassalli; il server convalida il comando e la nuova pianificazione viene applicata secondo le regole di governo locale, senza rendere istantanei i rapporti in transito. Un nuovo rapporto diventa leggibile solo dopo composizione e consegna simulate.

**AT-18 — Metadati e assenza rapporto:** se un rapporto non è ancora arrivato o non contiene una metrica, l'app mostra rispettivamente *in attesa di recapito* oppure *dato non comunicato*, senza sostituirlo con un valore live o inventato.

**AT-19 — Preparazione in pausa programmata:** con server raggiungibile ma simulazione in pausa, un giocatore autenticato prepara un ordine economico e un ordine strategico autorizzati; ciascuno appare *in attesa della ripresa*. Prima della riattivazione nessun tick, carico, risorsa, spostamento, costruzione, rapporto o consegna avanza per effetto della preparazione.

**AT-20 — Ripresa ed esito:** al riavvio, un ordine preparato valido viene valutato al primo tick utile e applicato una sola volta. Se nel frattempo risorse, permessi o prerequisiti non sono più compatibili, il server rifiuta l'ordine con motivazione tracciabile; app e browser vedono lo stesso esito.

**AT-21 — Distinzione pausa/offline:** se un dispositivo è privo di rete o il server è irraggiungibile, l'app non mostra la preparazione come già registrata dal server né promette esecuzione automatica; una eventuale coda offline resta una funzionalità separata ancora da decidere.

## 8. Roadmap tecnica proposta — primo rilascio completo (nessuna data approvata)

| Fase | Deliverable | Dipendenze / criterio di uscita |
| --- | --- | --- |
| **F0 — Contratti** | Membership, permessi, catalogo comandi, snapshot; implementare contratto **tick successivo vs recapito simulato** | Durata tick, pausa e semantica dei singoli comandi ancora da dettagliare |
| **F1 — Backend + hub web** | Campagne autorevoli, lobby, dashboard, API lettura e scrittura | World/Feudal, MP-07, persistenza server e autorizzazioni |
| **F2 — Controllo remoto web completo** | Tutti i domini: economia/lavoro/fisco/cantieri, militare/spedizioni, diplomazia/messaggi, tributi/carovane, mappa | Moduli reali, QA e contratti di comando |
| **F3 — App alpha/beta interne** | Client mobile Android/iOS con gli stessi comandi, test utenti/dispositivi, sicurezza e accessibilità | F1–F2, test di sincronia con browser |
| **F4 — Prima release pubblica Android/iOS (B)** | **Controllo remoto completo** di §1.4, tutti i Must e test AT-01…AT-21 | **Gate non derogabile:** nessuna release solo KPI, messaggi o comandi economici parziali |
| **F5 — Miglioramenti** | Push opzionali, cache offline, archivio storico e ottimizzazioni, se approvati | Decisioni successive |

**DECISO:** completezza del **primo rilascio pubblico**, non una data di pubblicazione. Le fasi incrementali interne non costituiscono una release pubblica ridotta. **A:** stack tecnologico, dettaglio comandi, notifiche push, modalità offline e pianificazione temporale.

## 9. Rischi e dipendenze reali del repository

- **World/Feudal assente come multiplayer completo:** la roadmap classifica feudi, gerarchie e world map come futuro M4. Non promettere funzionalità di mappa regionale interattiva già funzionanti.
- **Persistenza a singola colonia:** schema Supabase attuale con settlements e chiave user_id + coordinate cella; manca campaign_id. Migrazione e regole autorevoli vanno progettate prima della app multi-server.
- **Centro di controllo già presente ma locale al runtime:** le nove viste non equivalgono a API sicure/remote.
- **Branch messages separata:** ha un sistema di lettere con ETA e report, ma destinatari esterni astratti e nessun multiplayer inter-feudo autentico; occorre audit/porting selettivo, non merge cieco.
- **Coerenza temporale:** multiplayer a ×1; **DECISO** amministrazione locale al tick successivo e messaggi inter-feudo al recapito simulato. Restano aperti durata del tick, durata campagna, pause regionali e dettagli dei viaggi.
- **Governance:** nessun privilegio feudale deve essere dedotto solo da proprietà o nickname, senza contratti server-side.

## 10. Questioni aperte da cristallizzare

| Q | Domanda | Impatto |
| --- | --- | --- |
| **Q-01 — RISOLTA (B)** | Primo rilascio pubblico con **controllo remoto completo**: economia, lavoratori, fisco, cantieri già localizzati, spedizioni/militare strategico, diplomazia/messaggi, tributi/carovane, mappa e lobby multi-campagna. Alpha/beta interne possono essere progressive. | **DECISO**; catalogo dei singoli comandi ancora aperto |
| **Q-02 — RISOLTA** | **Ordini al proprio feudo: primo tick utile, senza messaggero. Comunicazioni inter-feudo: trasporto e recapito simulati.** | **DECISO** — durata del tick, pause, categorie e conseguenze specifiche da dettagliare |
| **Q-03 — RISOLTA** | **Feudo proprio: KPI aggiornati direttamente; feudi dei vassalli: solo rapporti ricevuti tramite messaggeri. Il sovrano può impostare la frequenza dei resoconti.** | **DECISO** — opzioni, costi, granularità e permessi delle routine ancora aperti |
| **Q-04 — RISOLTA (principio)** | Durante la pausa regionale l'utente può consultare lo stato congelato e preparare ordini; **nessuna simulazione avanza**, gli ordini saranno elaborati alla ripresa. | **DECISO** — tipi di ordini, limiti/cancellazioni, conflitti al tick e comportamento offline separato restano da precisare |
| **Q-05** | Push su attacco, lettere, allarmi, scorte e fine spedizione: opt-in, priorità, silenziamento? | Notifiche, anti-FOMO |
| **Q-06** | Quanti account/personaggi/feudi può controllare un giocatore per campagna? | Autorizzazioni e interfaccia |
| **Q-07** | App native separate, cross-platform o web installabile per un primo rilascio? | Stack e distribuzione |
| **Q-08** | KPI della Home: quali 4–6 numeri sono davvero indispensabili? | Prodotto/UX |
| **Q-09** | Il giocatore può dare ordini quando il feudo è assediato e quanto ne può conoscere? | Fog of war e difesa |
| **Q-10** | Lingue, target OS, requisiti prestazionali, retention, privacy e policy store? | Qualità e go-live |

## 11. Definition of Ready della SRS

L'SRS potrà essere promossa da **bozza v0.5** a **baseline approvata** soltanto quando: (1) le questioni **Q-05…Q-10** prioritizzate avranno risposta o una decisione esplicita di rinvio (**Q-01: B; Q-02: doppia temporalità; Q-03: report dei vassalli a frequenza configurabile; Q-04: ordini preparabili durante pausa e applicati alla ripresa**); (2) per ogni funzione Must sarà disponibile una sorgente autorevole o una dipendenza di backend documentata; (3) saranno definiti permessi dei ruoli e catalogo di tutti i comandi; (4) saranno approvati criteri di accettazione e gate B; (5) sarà aggiornata la tracciabilità verso backlog e test.

**Nessuna funzionalità mobile è stata implementata da questo documento.**
