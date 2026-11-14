# CONQUER — Software Requirements Specification (SRS) · Mobile Companion

**Versione:** 0.11 — bozza di lavoro, **non approvata nel complesso** (Q-08 in definizione, Q-09: blocco bidirezionale e allarme automatico)  
**Ultimo aggiornamento:** 14 novembre 2026 (prima bozza 13 novembre 2026)  
**Destinazione:** Android e iOS da **un'unica base di codice mobile condivisa**; prima dipendenza: hub browser e backend multiplayer condiviso  
**Stato:** SPEC / NO RUNTIME — nessuna app mobile implementata  
**Decisioni approvate:** **B — primo rilascio pubblico con controllo remoto completo**; **stati INVASO/SOTTO ASSEDIO distinti: allarme automatico tramite messaggero all'invasione, blocco dei messaggeri in entrata/uscita durante l'assedio, piccioni operativi e non intercettabili**; **un'unica codebase mobile Android/iOS**; **un personaggio per account/campagna, che governa più feudi solo viaggiando tra essi o mediante messaggeri/piccioni**; **comandi diretti dove il personaggio è presente al primo tick utile, comunicazioni inter-feudo con recapito simulato**; **KPI dei vassalli solo tramite resoconti di messaggeri con frequenza impostabile dal sovrano**; **ordini preparabili durante la pausa regionale**; **push subordinati al permesso OS e filtrabili per categoria dalle impostazioni dell'app**.

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

**D — Push nel perimetro mobile:** richiesta di autorizzazione alle notifiche tramite Android/iOS e controllo selettivo per categoria all'interno dell'app; riceverle richiede **sia permesso OS sia categoria abilitata**. L'utente mantiene accesso al gioco e agli avvisi in-app anche se nega il permesso. **P — Migliorie non obbligatorie al primo rilascio:** cache offline read-only e archivio campagne concluse. La posta in-app, la conferma degli ordini e gli errori comprensibili rimangono necessari.

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
| FR-ACC-06 | Consente **un solo personaggio per account in ciascuna campagna**, senza creare personaggi alternativi per occupare altri slot dello stesso server; il personaggio può esercitare autorità su più feudi e territori. | D/C | Must |
| FR-ACC-07 | Registra e rende visibili **posizione e stato di viaggio del personaggio per campagna**: si può essere presenti fisicamente in un solo luogo alla volta; lo spostamento tra feudi segue il tempo e i percorsi simulati. | D/C | Must |
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
| FR-DASH-08 | Nella Home, ogni scheda di insediamento espone una sintesi selezionata di KPI; la **shortlist iniziale di sei gruppi** è riportata al §3.2a e può essere raffinata. | P — accolto come buon inizio, **non approvazione definitiva dell'elenco** | Should |
| FR-DASH-09 | Le schede consentono accesso alla dashboard di dettaglio senza sovraccaricare la Home; allarmi e posta non vengono confusi con KPI inventati. | P | Should |
| FR-ECO-01 | Consente gestione di lavoro/Job Manager, priorità e assegnazioni consentite. | D/C | Must |
| FR-ECO-02 | Consente politiche economiche e fiscali già supportate dal motore, inclusi tributi, aliquote e razioni se applicabili. | D/C | Must |
| FR-CANT-01 | Permette monitoraggio, priorità, risorse e manodopera dei cantieri già collocati nel Builder. | D/C | Must |
| FR-CANT-02 | Non consente di scegliere coordinate o creare geometrie tramite app mobile. | D | Must |
| FR-ECO-03 | Espone serie storiche solo per periodi effettivamente registrati; niente extrapolazioni spacciate per misure. | P | Should |

### 3.2a Home — prima shortlist KPI da affinare (14/11/2026)

Il product owner ha valutato la proposta seguente **«un buon inizio»**. Questo significa **direzione preliminarmente condivisa**, **non approvazione definitiva** delle metriche, del numero di elementi o del layout. Q-08 rimane **IN DEFINIZIONE**.

| Gruppo KPI candidato | Informazione sintetica | Dettaglio / cautela |
| --- | --- | --- |
| **1. Popolazione** | Numero residenti | Eventuale variazione sul periodo solo se supportata dallo storico reale |
| **2. Tesoreria** | Disponibilità finanziaria del feudo | Entrate/uscite e tendenze nella dashboard dettagliata, se disponibili |
| **3. Scorte alimentari / autonomia** | Scorte e indicazione di sufficienza | Autonomia soltanto quando calcolata dal motore; mai confondere magazzino economico e difensivo |
| **4. Felicità / lealtà** | Indicatori di stabilità sociale | Misure distinte per le classi/ruoli per cui esistono; evitare un indice unico arbitrario |
| **5. Produzione / occupazione** | Stato delle attività e impiego lavoratori | Non inventare aggregati in assenza di dati del Job Manager o del ledger |
| **6. Sicurezza militare** | Situazione guarnigione e rischio | Distinguere militari presenti, capacità ricettiva e allarmi reali |

**P — composizione dell'interfaccia:** massimo sei gruppi principali per insediamento nella scheda Home, con collegamento ai pannelli analitici. Allarmi critici, posta consegnata, spedizioni, tributi e stato della campagna possono avere **indicatori contestuali separati**, senza occupare forzatamente uno dei sei gruppi.

**VINCOLI GIÀ DECISI:** utilizzare solo stato server **autorizzato** e dati realmente esistenti; indicare data/freschezza del dato; non rendere live i KPI dei vassalli (solo rapporti recapitati); se una metrica non è calcolabile, mostrare assenza di dato e non valori dimostrativi.

**APERTO:** quali sottovalori riassumere, soglie di attenzione e criticità, periodi di confronto, gerarchia visiva, eventuali KPI alternativi in base a stato/ruolo/assedio e contenuto su schermi piccoli. Richiede design e accettazione esplicita prima di chiudere Q-08.

### 3.3 Militare, mappa e logistica

| ID | Requisito | Stato | Priorità proposta |
| --- | --- | --- | --- |
| FR-MIL-01 | Consulta guarnigione, disponibilità militare, allarmi, stato di spedizioni e assedi se presenti sul server. | D/C | Must |
| FR-MIL-02 | Permette ordini strategici di spedizione/marcia e gestione logistica nei limiti dei permessi del ruolo. | D/C | Must |
| FR-MIL-03 | Non attiva la modalità tattica per selezionare/controllare direttamente unità in battaglia. | D | Must |
| FR-MIL-04 | Distingue **invasione** del territorio e **assedio effettivo** del feudo come stati diversi; non applica automaticamente il blocco postale dell'assedio a una semplice invasione. | D/C | Must |
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
| FR-MSG-05 | Se il feudo è **sotto assedio**, non è consentita la **partenza di messaggeri ordinari dal feudo assediato**; la UI non permette di indicare come spediti messaggi tramite tale canale. | D/C | Must |
| FR-MSG-06 | In stato **sotto assedio**, i **piccioni possono uscire** e **non possono essere intercettati**; l'invio resta soggetto alle normali condizioni di disponibilità del servizio e al suo tempo simulato di recapito. | D/C | Must |
| FR-MSG-07 | In stato **invaso**, il sistema **non applica automaticamente il divieto di uscita dei messaggeri riservato all'assedio**; altri rischi o impedimenti legati all'invasione sono da specificare. | D/C | Must |
| FR-MSG-08 | Se il feudo è **sotto assedio**, nessun messaggero ordinario può **entrare** né consegnare comunicazioni all'interno del feudo, anche se proveniente da un altro territorio; l'app e le API non devono segnare come recapitato il messaggio. | D/C | Must |
| FR-MSG-09 | Ad **ogni nuovo evento di invasione di un territorio**, il server dispone **automaticamente la partenza di un messaggero di allarme**, senza richiedere l'intervento del giocatore, se la partenza è consentita dalle condizioni effettive del mondo. | D/C | Must |
| FR-MSG-10 | Il medesimo evento di invasione non deve moltiplicare i messaggeri a ogni tick, retry o aggiornamento UI; nuove invasioni distinte devono generare nuovi tentativi di allarme. | P/C — salvaguardia tecnica | Must |
| FR-DIP-01 | Consulta relazioni, sudditanza e obblighi; consente azioni diplomatiche autorizzate dalla campagna. | D/C | Must |
| FR-DIP-02 | Per amministrare direttamente un feudo diverso da quello dove si trova il personaggio, il giocatore deve **raggiungerlo fisicamente** oppure **inviare ordini tramite messaggeri o piccioni**; il client non applica comandi istantanei attraverso la sola selezione del feudo. | D/C | Must |
| FR-DIP-03 | Mostra per ogni azione remota il canale richiesto (presenza / messaggero / piccione), gli stati di partenza e consegna, e l'eventuale ETA conosciuta; l'ordine rivolto ad altro feudo può produrre effetto **solo dopo la consegna e la successiva valutazione da parte del motore**. | D/C per canale/ritardo, P per dettaglio UI | Must |
| FR-NOT-01 | Organizza avvisi in-app per campagna: posta, attacco/assedio, scorte critiche, cantieri bloccati, spedizioni, tributi. Gli avvisi in-app non richiedono consenso push OS. | D/C | Must |
| FR-NOT-02 | Il client può chiedere il **permesso push tramite i meccanismi ufficiali di Android/iOS**, e rispetta il rifiuto o la revoca del permesso; senza autorizzazione **non invia push**. | D/C | Must |
| FR-NOT-03 | L'app permette al giocatore di **abilitare/disabilitare selettivamente i push per categoria**, indipendentemente dall'autorizzazione generale del sistema operativo. | D/C | Must |
| FR-NOT-04 | La consegna dei push richiede **due condizioni congiunte**: permesso OS attivo **e** categoria abilitata dall'utente. Revoca o disattivazione di una categoria impediscono nuovi push corrispondenti. | D/C | Must |
| FR-NOT-05 | Le categorie iniziali **proposte** sono sicurezza (attacchi/assedi), economia e risorse critiche, cantieri, posta recapitata/diplomazia, spedizioni e tributi. Nomi esatti, categorie e priorità non sono ancora approvati. | P/C | Must per selettività; tassonomia A |
| FR-NOT-06 | Il push informa solo di eventi **già visibili/autorizzati** al giocatore secondo i tempi della simulazione (lettere solo dopo il recapito, rapporti dei vassalli solo dopo la consegna). | D/C | Must |
| FR-NOT-07 | Il rifiuto del permesso OS o la disattivazione di tutti i push non limita gameplay, controllo remoto, messaggi e avvisi consultabili in-app. | P/C | Must |
| FR-NOT-08 | Evitare allarmi ingannevoli, countdown artificiosi e pressioni ad aprire l'app per mantenere i progressi. | P | Should |

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
| Character | campaign_id + character_id / membership_id | **Un solo personaggio per account/campagna**; posizione corrente, eventuale viaggio, titoli e autorità sui feudi |
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

**FR-TIME-01 (D/C, Must) — Amministrazione in presenza:** un comando gestionale autorizzato (es. lavoratori, aliquote, razioni, priorità di un cantiere già localizzato, ordini strategici preparatori) per il **feudo in cui il personaggio si trova fisicamente** è registrato dal server e **applicato al primo tick utile dopo ricezione/validazione**, senza messaggero. Questa regola **non autorizza gestione istantanea di altri feudi anche se appartenenti allo stesso giocatore**. La UI separa *ricevuto*, *accettato/in attesa di tick*, *applicato* e *rifiutato/fallito*. **Durata del tick non fissata qui**.

**FR-TIME-02 (D/C, Must) — Comunicazioni e governo a distanza:** lettere, messaggi diplomatici, richieste e **ordini indirizzati a un feudo diverso da quello in cui il personaggio è presente, anche se di sua proprietà**, vengono trasmessi tramite **messaggeri/piccioni**. Un ordine inviato è **spedito**, non **recapitato/eseguito**; il destinatario lo riceve solo dopo il tempo di viaggio simulato. L'app non salta questo vincolo né anticipa i contenuti riservati. Una volta recapitato, l'eventuale applicazione è soggetta alle regole, ai permessi e al tick del feudo ricevente. Non tutte le lettere sono automaticamente ordini eseguibili: la semantica dipende dal tipo di messaggio.

**FR-TIME-03 (D/C, Must) — Stesso modello temporale per tutti i client:** un comando impartito da app o browser segue le medesime regole e la **posizione del personaggio in quella campagna**; nessun vantaggio di velocità mobile, teletrasporto di autorità o secondo orologio simulativo.

**FR-TIME-04 (D/C, Must) — Ordini durante pause programmate:** quando un server di campagna è in **pausa regionale programmata ma raggiungibile**, l'utente può **predisporre ordini** dal browser o dall'app, che rimangono **in attesa di ripresa**. Durante la pausa **non avanzano tick, risorse, viaggi, costruzioni, calendario né consegne**. Alla riattivazione gli ordini entrano nel processo del **primo tick utile**, con validazioni applicabili. Accettare/preparare ≠ eseguire. Questa decisione **non equivale** ad autorizzare ordini offline quando il telefono non ha connessione o il server è indisponibile.

**FR-TIME-05 (P/C, Must) — Ordini che generano un viaggio:** la decisione locale di *preparare/avviare una spedizione o una carovana* può essere acquisita al tick successivo, ma **marcia, trasporto, intercettazione, arrivo e conseguenze** si svolgono nei tempi e con le condizioni proprie del motore World/Combat/Logistica; il tick non teletrasporta il risultato all'altro feudo.

**A — Confini dei comandi:** autorizzazioni, ordine delle richieste concorrenti, conflitti di risorse al tick, calendario delle consegne, percorso/trasporto, failure, limite e modifica/cancellazione degli ordini in attesa, disponibilità di altri comandi durante pausa, e regime di server non raggiungibile devono essere definiti per singola operazione. **Il diritto di preparare ordini in pausa e l'assenza di progressione durante la pausa sono DECISI**; non si attribuisce una durata arbitraria a un tick o a un viaggio.

## 4b. Visibilità feudale e frequenza dei messaggeri — DECISO (13/11/2026)

**FR-REP-01 (D/C, Must):** il giocatore può leggere i dati aggiornati del **proprio insediamento** dallo stato autorevole della campagna. Per i **feudi governati dai propri vassalli**, il sovrano **non ottiene una finestra diretta in tempo reale** su economia, truppe e risorse: vede soltanto i contenuti dei rapporti effettivamente **consegnati**.

**FR-REP-02 (D/C, Must):** il sovrano **imposta la frequenza dei messaggeri di resoconto dei vassalli** attraverso un comando remoto autorizzato. La programmazione determina *quando* i nuovi rapporti vengono prodotti/inviati, non la velocità con cui viaggiano. Ogni rapporto rispetta il sistema di trasporto e recapito simulato (FR-TIME-02). La disponibilità di un rapporto precedente non abilita la lettura del dato corrente.

**FR-REP-03 (P/C, Must per tracciabilità):** il rapporto è uno **snapshot dei dati alla data simulata di redazione**, riportata insieme a fonte e data di consegna; non va aggiornato retroattivamente con valori correnti del feudo mittente. Se una metrica non è raccolta/comunicata, la UI deve mostrarla come non disponibile, senza indovinarla.

**REUSE esistente, non implementazione multiplayer:** la branch `messages` comprende già routine con *sorgente, destinazione, frequenza (1/7/30 giorni), canale e sezioni*, e rapporti redatti al tempo simulato. Questi intervalli sono **opzioni del prototipo**, NON il catalogo di frequenze confermato per l'app: servono integrazione con vassalli veri, server autorevole e permessi.

**APERTO:** opzioni/intervalli ammessi e costi delle frequenze, configurazione globale oppure differenziata per vassallo, chi ha diritto di imporre/inibire i resoconti, contenuti obbligatori/facoltativi, eventuali intercettazioni, messaggero vs piccione e come gestire assenza di strada o server in pausa. Nessuna frequenza fissa dedotta da questa decisione.

## 4c. Consenso push e filtri per categoria — DECISO (14/11/2026)

**D — doppio livello indipendente:** (1) **consenso del sistema operativo** Android/iOS per l'invio push; (2) **selettori per categoria** disponibili nelle impostazioni dell'app. Il permesso OS non annulla la scelta delle singole categorie; le preferenze interne non possono aggirare un consenso OS negato/revocato. Il controllo effettivo del push è il loro **AND logico**, non un singolo interruttore.

**D — separazione notifiche/gioco:** la casella postale, la timeline e gli avvisi in-app restano disponibili anche con push disabilitati; un push non anticipa consegne diplomatiche, rapporto dei vassalli o dati coperti da visibilità feudale. Le preferenze vanno riferite all'account corretto e valutate al momento dell'emissione.

**P — soluzione di prodotto:** categorie almeno per attacchi/assedi, criticità economiche, posta recapitata, spedizioni, tributi e cantieri; preferenze conservate lato account; registrazione/revoca di token per dispositivo e gestione di più dispositivi; payload con anteprima minimizzata per evitare esposizione sulla schermata bloccata.

**A — configurazione di dettaglio:** categorie definitive, stato iniziale delle singole categorie dopo il consenso, filtri globali versus per singola campagna, silenziamento temporaneo/orari quieti, granularità del contenuto mostrato nel push e momento della richiesta del permesso. **Non presumere** selettori inizialmente attivati né consenso OS preconcesso.

## 4d. Personaggio unico, viaggi e governo dei feudi — DECISO (14/11/2026)

**FR-CHAR-01 (D/C, Must):** ogni account possiede **un solo personaggio in ciascuna campagna**. Lo stesso account può avere personaggi differenti in campagne distinte. Acquisire più feudi non crea altri personaggi e non consuma slot umani aggiuntivi.

**FR-CHAR-02 (D/C, Must):** il personaggio ha **un'unica posizione fisica** all'interno della campagna e può **viaggiare fra feudi** lungo la mappa secondo i tempi simulati. Essere proprietario o sovrano di un feudo non significa esservi presente.

**FR-CHAR-03 (D/C, Must):** quando il personaggio **è presente** nel feudo da governare, può emettere direttamente i comandi gestionali autorizzati, applicati al **primo tick utile**. Per i **feudi lontani o non occupati fisicamente**, può (a) **recarsi sul posto**, oppure (b) **inviare ordini con messaggeri o piccioni**, sottoposti a tempistiche di spedizione, percorso e recapito. La gestione remota non è un potere telematico istantaneo all'interno della finzione feudale.

**FR-CHAR-04 (D/C, Must):** la UI mobile e quella web indicano il **feudo di presenza**, i feudi posseduti, il canale di comando applicabile a ciascuno e lo stato di eventuali viaggi/messaggi. La posizione deve essere verificata dal backend, non dichiarata dal client.

**FR-CHAR-05 (P/C, Must come salvaguardia):** dopo la consegna di un ordine a distanza, il server deve verificarne **permessi, prerequisiti e possibilità di esecuzione**; consegna di una lettera non equivale automaticamente all'esecuzione di un comando. La semantica di delega/amministrazione dei singoli ordini rimane da specificare.

**INTEGRAZIONE CON Q-02 E Q-03:** il comando *locale* al tick successivo vale **solo dove il personaggio è presente**; il governo di altri feudi segue i tempi dei messaggeri/piccioni. Le informazioni dei feudi dei vassalli continuano ad arrivare tramite rapporti **recapitati**, con frequenza impostabile dal sovrano, senza letture live privilegiate.

**APERTO:** requisiti delle piccionaie, disponibilità dei vettori, costi e velocità, rischi/intercettazione, percorso e sicurezza dei viaggi del personaggio, gestione del personaggio in transito, eventuali luogotenenti/deleghe e quali operazioni ammettono un ordine scritto. Non fissare intervalli, velocità o teletrasporti non approvati.

## 4e. Invasione vs assedio: isolamento delle comunicazioni — DECISO in parte (14/11/2026)

**FR-SIEGE-01 (D/C, Must) — Due fasi semanticamente distinte:**
1. **INVASO:** forze ostili operano nel territorio / nella regione del feudo; **non equivale automaticamente a un assedio**. L'invasione, da sola, **non attiva il divieto di uscita dei messaggeri previsto per l'assedio**.
2. **SOTTO ASSEDIO:** il feudo si trova nello stato effettivo di assedio/blocco definito dal futuro motore World/Feudal/Siege. Finché questo stato è attivo, **nessun messaggero ordinario può entrare o lasciare il feudo assediato**, né consegnare contenuti all'interno.

**FR-SIEGE-05 (D/C, Must) — Allarme automatico di invasione:** ogni volta che il motore autorevole registra **una nuova invasione di territorio**, deve **attivare la partenza automatica di un messaggero di allarme** (senza click dell'utente), prima che un eventuale assedio successivo interrompa il traffico ordinario. È una **comunicazione fisica**, non un avviso istantaneo sul telefono: il destinatario apprende l'evento solo dopo recapito simulato. **P:** deduplicare l'allarme per ID di evento, non per tick; eventi di invasione distinti autorizzano messaggeri distinti. **APERTO:** destinatario preciso e percorso, assegnazione del vettore disponibile, eventuale rischio/intercettazione in fase INVASO e trattamento quando INVASO e SOTTO ASSEDIO sono registrati nello stesso tick. Non scavalcare il blocco d'assedio per forzare una partenza.

**FR-SIEGE-06 (D/C, Must) — Blocco bidirezionale sotto assedio:** i messaggeri ordinari **non possono entrare nel feudo assediato**, né **uscirne**. Un messaggero che non può entrare **non recapita** l'informazione al feudo né genera avvisi derivati dal contenuto. **APERTO:** se attende all'esterno, devia o torna indietro; come trattare i vettori già in viaggio quando comincia l'assedio. Il divieto approvato riguarda **ingresso/uscita effettivi** ed è verificato dal server.

**FR-SIEGE-02 (D/C, Must) — Piccioni sotto assedio:** la partenza dei **piccioni** dal feudo assediato resta consentita e **non sono intercettabili**. Il recapito **non è istantaneo** e resta soggetto alla rete e ai tempi della posta simulata. La decisione non crea piccionaie o vettori dove non sono presenti.

**FR-SIEGE-03 (D/C, Must) — Governo remoto e fog of war:** browser, app e API devono utilizzare lo **stesso stato effettivo** del feudo per consentire/vietare **partenza, ingresso e consegna**; un ordine destinato ad altro feudo, redatto nella dashboard, **non può aggirare il blocco bidirezionale dei messaggeri** durante l'assedio. La UI offre il canale piccione **soltanto se disponibile**, con stato di invio e di consegna attendibile. Il destinatario conosce il contenuto solo dopo il recapito e secondo le sue autorizzazioni.

**FR-SIEGE-04 (P/C, Must come salvaguardia) — Transizioni e comandi in attesa:** l'avvio/cessazione di un assedio deve aggiornare l'ammissibilità delle **nuove partenze** coerentemente con il tick autorevole. Come trattare lettere/messaggeri **già in viaggio** prima dell'inizio dell'assedio è **APERTO**: non inventare cattura, ritorno, annullamento o consegna automatica.

**REUSE / LIMITI CODE:** `docs/march.md` identifica uno skeleton MARCH con stadi `approach`, `raiding`, `siege`, `breached` ed eventi futuri `siege-started`. Questo **non è ancora un contratto server integrato** di blocco della posta. La branch `messages` modella già lettere con messaggero o piccione, canale e ETA, ma manca l'isolamento World/Feudal reale. La colombaia del prototipo richiede prerequisiti: **non assumere** che ogni feudo possa spedire piccioni.

**APERTO:** condizione esatta di transizione invasione→assedio; rischi dei messaggeri **durante INVASO**; dove attendono/deviano/tornano i messaggeri già in viaggio che non possono entrare; destinazione del messaggero d'allarme automatico e conflitti d'ordine degli eventi nello stesso tick; ritorno dei piccioni e prerequisiti delle piccionaie; ordini strategici sotto assedio e rapporti durante il blocco. **Q-09 ora definisce i due stati, il blocco bidirezionale e l'allarme automatico, ma non è interamente chiusa.**

## 5. Architettura candidata e contratti d'integrazione

**Vincolo D:** unica simulazione autorevole condivisa da browser e futuro mobile. **DECISO (Q-07):** Android e iOS devono essere sviluppati con **un'unica base di codice applicativo mobile condivisa**, non due implementazioni distinte; entrambi i client usano gli stessi contratti API e la stessa logica di governo remoto del browser. **Non è stato deciso** di unificare il codice della UI web e della UI mobile. **Proposta P:** separare servizi di lettura (KPI, messaggi, stato) e invio comandi (validazione, accettazione, esito), con API neutrali alla piattaforma. **Framework ancora aperto** (es. Flutter, React Native o altra soluzione cross-platform): nessuna tecnologia approvata in questa decisione.

**Contratti logici candidati (NON API già disponibili):**
- Identity: login, session, profilo e preferenze.
- Campaign directory: elenco pubblico, stato, eleggibilità di ingresso, partecipazioni dell'utente.
- Character presence/travel: posizione autorevole per campagna, feudo di presenza, destinazioni e stato del viaggio, collegamento tra personaggio e possedimenti; nessun teletrasporto dei comandi tramite cambio scheda.
- Campaign dashboard: snapshot di settlement, economia, popolazione, cantieri, sicurezza.
- Command gateway: comando contestuale, autorizzazione, deduplicazione, tracking esito.
- Feudal messaging: inbox/outbox, invio, progresso di consegna, report.
- World map: territori visibili, rotte, spedizioni, carovane/tributi.
- Notification service: **D** consenso OS + preferenze push per categoria; eventi autorizzati e tempi di consegna. **P** persistenza delle preferenze, registrazione e revoca dispositivi/token, gestione del payload minimo e multi-dispositivo.

**Macchina stati consigliata per un comando (P):** creato sul client → ricevuto dal backend → validato/rifiutato → pianificato → applicato dal tick o concluso con errore → restituzione dell'esito; ogni salto di stato osservabile. Non confondere **accettazione** con **esecuzione**.

**Due temporalità DECIDE, condizionate alla presenza:** comandi gestionali **nel feudo dove si trova il personaggio** al primo tick utile; ordini e lettere **diretti a qualsiasi altro feudo**, anche se posseduto dal personaggio, **solo attraverso il recapito simulato via messaggero/piccione** (FR-CHAR-01…05 e FR-TIME-01…05). Le notifiche mobile non eludono la consegna e il client non teletrasporta il personaggio. Costi e durata del viaggio restano aperti.

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
| NFR-PLAT-02 | Architettura mobile | **Una base di codice applicativo condivisa Android/iOS**; adattamenti di piattaforma ammessi per permessi push, packaging, store, accessibilità e integrazioni native, senza duplicare moduli di logica di business. | D/C | Must |
| NFR-PLAT-03 | Parità funzionale | I due sistemi operativi devono offrire **gli stessi domini di controllo remoto della release B**; differenze native non possono generare vantaggi di gameplay o permessi differenti. | D/C | Must |

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

**AT-22 — Permesso del dispositivo:** alla negazione o revoca dell'autorizzazione push Android/iOS, il backend/client non manda notifiche push a quel dispositivo; Home, posta e avvisi in-app restano utilizzabili.

**AT-23 — Filtraggio per categoria:** a permesso OS attivo, quando il giocatore disabilita la categoria spedizioni ma mantiene attiva la categoria posta, un evento spedizione non genera push mentre una lettera realmente recapitata può generarlo. Le categorie disattivate non sono riattivate tacitamente alla successiva sessione.

**AT-24 — Tempo e privacy:** una lettera in transito o un rapporto non ancora consegnato non innescano push con contenuti/anticipazioni; un evento relativo a campagna o feudo non autorizzato non produce push visibile per l'account corrente. La scelta delle categorie non modifica il tempo della simulazione.

**AT-25 — Unico personaggio in campagna:** dato un account già presente nella campagna A con un personaggio, il backend rifiuta la creazione di un secondo personaggio nello stesso server; il giocatore può comunque controllare più feudi e possedere un personaggio distinto in una campagna B.

**AT-26 — Presenza e viaggio:** dato che il personaggio si trova nel feudo X e desidera governare Y, il server non permette di dichiarare presenza immediata in Y cambiando schermata; il viaggio impiega tempo simulato e raggiungere Y rende possibili i comandi diretti locali.

**AT-27 — Governo remoto tramite vettore:** con personaggio in X, un ordine destinato al feudo posseduto Y viene spedito mediante messaggero/piccione, non applicato al tick successivo in Y; prima della consegna il feudo Y non cambia e il client mostra ordine *in transito*. Dopo la consegna il sistema valuta l'esecuzione e restituisce l'esito, senza violare le regole del feudo.

**AT-28 — Stesse regole web/mobile:** cambiando client, campagna o tab della mappa, il personaggio mantiene posizione e stato di viaggio della campagna; nessuna API permette ordini locali in un feudo dove non è presente solo perché ne è il proprietario.

**AT-29 — Codebase unica:** Android e iOS vengono costruiti dallo **stesso progetto applicativo mobile**, con varianti specifiche solo dove richieste dalle piattaforme. Il catalogo dei comandi non è duplicato in due implementazioni indipendenti.

**AT-30 — Parità Android/iOS:** su dispositivi Android e iOS, gli stessi scenari di login, scelta campagna, KPI, posta, ordini strategici, fiscalità, cantieri e notifiche per categoria producono risultati equivalenti sul medesimo backend, rispettando i permessi nativi delle due piattaforme.

**AT-31 — Shortlist KPI Home (criterio PROPOSTO):** su una scheda di insediamento con dati reali, i sei gruppi candidati mostrano valori riferiti al feudo corretto e consentono l'apertura del dettaglio; in assenza di valori storici o metriche non implementate mostrano «dato non disponibile» senza inventare informazioni. Il test diverrà vincolante solo dopo l'approvazione definitiva di Q-08.

**AT-32 — Rispetto delle fonti (criterio PROPOSTO):** KPI della propria colonia aggiornati dal backend autorevole; indicatori dei vassalli ottenuti solo da rapporti consegnati con fonte e data, senza letture live abusive o confusione di snapshot fra campagne. Il test diverrà vincolante dopo la finalizzazione Q-08.

**AT-33 — Invaso non significa assediato:** quando nemici hanno invaso il territorio ma non è iniziato un assedio effettivo, il blocco della partenza dei messaggeri **non** scatta per il solo stato *invaso*. Eventuali impedimenti aggiuntivi dell'invasione vanno testati soltanto dopo definizione.

**AT-34 — Assedio blocca il messaggero uscente:** una volta attivo lo stato *sotto assedio*, qualsiasi tentativo di far **partire** un messaggero ordinario dal feudo assediato è rifiutato dal server, anche con richieste API dirette o client mobile; non viene creato un falso messaggio *in transito*.

**AT-35 — Piccione non intercettabile:** con piccionaia/canale operativo, il feudo assediato può spedire una lettera tramite piccione, che percorre il suo tempo simulato di consegna **senza possibilità di intercettazione**. Il destinatario la legge soltanto dopo l'arrivo; il passaggio a *sotto assedio* non altera arbitrariamente la sua ETA.

**AT-36 — Nessun canale fittizio:** quando un feudo assediato non dispone di un canale piccione utilizzabile, l'app segnala che non può inviare comunicazioni in uscita con i vettori disponibili; non crea automaticamente un piccione o una piccionaia.

**AT-37 — Blocco in entrata:** un messaggero ordinario diretto a un feudo già sotto assedio non entra e non consegna il messaggio; il server e l'app non marcano la lettera come ricevuta, neppure tramite chiamata API diretta.

**AT-38 — Allarme automatico di invasione:** al verificarsi di una **nuova invasione di un territorio** con partenza ancora possibile, il motore crea e spedisce automaticamente un messaggero di allarme, senza intervento dell'utente. Il destinatario non ottiene contenuti prima del recapito simulato.

**AT-39 — Un evento, un allarme (salvaguardia tecnica proposta):** retry, replay dello stesso evento e tick successivi non duplicano il messaggero; una invasione distinta produce un nuovo tentativo di invio. Se l'assedio impedisce già la partenza, il sistema non forza il messaggero attraverso il blocco e registra la mancata partenza.

## 8. Roadmap tecnica proposta — primo rilascio completo (nessuna data approvata)

| Fase | Deliverable | Dipendenze / criterio di uscita |
| --- | --- | --- |
| **F0 — Contratti** | Membership, permessi, catalogo comandi, snapshot; implementare contratto **tick successivo vs recapito simulato** | Durata tick, pausa e semantica dei singoli comandi ancora da dettagliare |
| **F1 — Backend + hub web** | Campagne autorevoli, lobby, dashboard, API lettura e scrittura | World/Feudal, MP-07, persistenza server e autorizzazioni |
| **F2 — Controllo remoto web completo** | Tutti i domini: economia/lavoro/fisco/cantieri, militare/spedizioni, diplomazia/messaggi, tributi/carovane, mappa | Moduli reali, QA e contratti di comando |
| **F3 — App alpha/beta interne** | **Un unico progetto mobile cross-platform** compilabile per Android e iOS, con gli stessi comandi, test utenti/dispositivi, sicurezza e accessibilità | F1–F2; scelta framework ancora aperta; test di sincronia con browser |
| **F4 — Prima release pubblica Android/iOS (B)** | **Controllo remoto completo** di §1.4, push con consenso OS + filtri per categoria, tutti i Must e test AT-01…AT-30 + AT-33…AT-39 (AT-31/32 proposti, da approvare) | **Gate non derogabile:** nessuna release solo KPI, messaggi o comandi economici parziali |
| **F5 — Miglioramenti** | Cache offline, archivio storico, filtri/silenziamento push avanzati e ottimizzazioni, se approvati | Decisioni successive |

**DECISO:** completezza del **primo rilascio pubblico**, **unica codebase applicativa Android/iOS** e push con permesso OS + selettori per categoria; nessuna data di pubblicazione fissata. Le fasi incrementali interne non costituiscono una release pubblica ridotta. **A:** framework cross-platform, dettaglio comandi, tassonomia/default delle notifiche, modalità offline e pianificazione temporale.

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
| **Q-05 — RISOLTA (principio)** | **Push previa autorizzazione Android/iOS + preferenze selettive per categoria nell'app.** Il push viene emesso soltanto se entrambe le condizioni sono abilitate. | **DECISO** — elenco categorie, default, silenziamento e preferenze per-campagna ancora aperti |
| **Q-06 — RISOLTA (principio)** | **Un personaggio per account/campagna, con più feudi governabili. Per comandare un altro feudo occorre spostarsi fisicamente oppure inviare messaggeri/piccioni, rispettando i tempi simulati.** | **DECISO** — viaggi, infrastruttura dei piccioni, deleghe e singoli tipi di ordine ancora aperti |
| **Q-07 — RISOLTA (principio)** | **Una sola base di codice applicativa per Android e iOS**, con backend e API comuni alla piattaforma web. Non sono richieste due app sviluppate separatamente. | **DECISO** — framework e grado di riuso UI col browser ancora aperti |
| **Q-08 — IN DEFINIZIONE** | **Sei gruppi KPI proposti e accolti come «un buon inizio»:** popolazione; tesoreria; scorte/autonomia; felicità/lealtà; produzione/occupazione; sicurezza militare. | **SHORTLIST PRELIMINARE**, non elenco definitivo; metriche, alert, priorità/layout ancora aperti |
| **Q-09 — PARZIALMENTE RISOLTA** | **INVASO ≠ SOTTO ASSEDIO.** Ogni nuova invasione attiva automaticamente un messaggero d'allarme se può partire; sotto assedio i messaggeri **non entrano né escono**, mentre i piccioni in uscita sono consentiti e non intercettabili. | **DECISO** su blocco bidirezionale, allarme e piccioni; **APERTO** destinatario, messaggeri già in viaggio, transizioni, rischi durante invasione, ordini ammessi |
| **Q-10** | Lingue, target OS, requisiti prestazionali, retention, privacy e policy store? | Qualità e go-live |

## 11. Definition of Ready della SRS

L'SRS potrà essere promossa da **bozza v0.11** a **baseline approvata** soltanto quando: (1) la **Q-08** (shortlist preliminare, non chiusa), la **Q-09** (blocco bidirezionale dei messaggeri sotto assedio e allarme automatico all'invasione decisi; dettagli di recapito ancora aperti) e la **Q-10** avranno risposta o una decisione esplicita di rinvio (**Q-01: B; Q-02: doppia temporalità; Q-03: report dei vassalli; Q-04: preparazione ordini in pausa; Q-05: push con consenso OS e filtri; Q-06: personaggio unico e governo via viaggio/messaggeri/piccioni; Q-07: unica base di codice Android/iOS**); (2) per ogni funzione Must sarà disponibile una sorgente autorevole o una dipendenza di backend documentata; (3) saranno definiti permessi dei ruoli e catalogo di tutti i comandi; (4) saranno approvati criteri di accettazione e gate B; (5) sarà aggiornata la tracciabilità verso backlog e test.

**Nessuna funzionalità mobile è stata implementata da questo documento.**
