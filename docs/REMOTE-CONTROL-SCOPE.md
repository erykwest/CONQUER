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
| **Centro di controllo remoto** | Gestione economica, fiscale, militare strategica, diplomatica, lavoratori, cantieri già localizzati; senza Builder geometrico | **DECISO** perimetro funzionale generale; singoli comandi **APERTI** |
| **Posta e notifiche** | Ricevuti/inviati, rapporti e allarmi per campagna, con i tempi simulati dove previsti | **DECISO** come dominio; unificazione UI **PROPOSTA** |
| **Diplomazia, tributi, spedizioni** | Operazioni del feudo e stato delle azioni/convogli; comandi verso gli altri feudi rispettano le regole del mondo | **DECISO** come domini; semantica dei singoli comandi **APERTA** |
| **Mappa regionale** | Lettura politica/territoriale e interazione contestuale con territori, feudi e missioni | **DECISO** come dominio; feature specifiche **APERTE** |

**KPI candidati (PROPOSTI, non già scelti):** popolazione, felicità, scorte e autonomia alimentare, andamento economico/produzione, lavoratori, cantieri, guarnigione e allarmi, assedi, convogli in viaggio, tributi in arrivo/scadenza, lettere non lette, relazioni/vassallaggio, territori amministrati, tempi di aggiornamento dei dati. Evitare dashboard con valori inventati: distinguere **snapshot corrente** da **ultimo rapporto diplomatico ricevuto**.

**KPI Home — SHORTLIST PRELIMINARE (14/11/2026), non decisione definitiva:** il product owner ha giudicato «un buon inizio» la proposta di sei gruppi per ogni scheda insediamento: **(1) popolazione, (2) tesoreria, (3) scorte alimentari/autonomia, (4) felicità e lealtà, (5) produzione e occupazione, (6) sicurezza militare**. La Home rimane sintetica con collegamenti alla dashboard analitica; messaggi, allarmi e viaggi possono avere badge separati. **APERTO:** composizione esatta dei gruppi, soglie e colori, gerarchia, priorità per fase della campagna, numero definitivo di indicatori. Non presentare questa shortlist come elenco approvato o implementato. Non inventare storico, risorse o valori militari; mantenere la distinzione tra dati propri e rapporti dei vassalli.

**DECISO — visibilità dei vassalli (13/11/2026):** i dati del **proprio feudo** possono provenire dallo stato aggiornato sul server; **economia, eserciti, risorse e altri KPI dei feudi dei vassalli non sono consultabili live dal sovrano**. Il sovrano legge gli **snapshot dei resoconti ricevuti tramite messaggeri** e può **impostare la frequenza delle relative routine di rapporto**. La frequenza regola la produzione/spedizione dei rapporti, **non abbrevia il viaggio o la consegna**. Ogni rapporto mostra fonte e data simulata di redazione, non valori correnti retroattivi. L'assenza di un rapporto non dà accesso al dato live.

**APERTO:** intervalli disponibili (il prototipo `messages` oggi usa 1/7/30 giorni, senza che questi siano fissati per multiplayer), pianificazione unica o per singolo vassallo, contenuti dei rapporti, costi e permessi dettagliati. Il backend deve far rispettare i limiti anche sulle API, non soltanto sulla UI.


## 2a. Confine funzionale del remote control — DECISO (13/11/2026)

**DECISO — gestione gestionale e strategica da browser, poi app mobili Android/iOS:** il controllo remoto deve permettere di amministrare il proprio insediamento **senza aprire la scena 3D**, con le stesse regole e autorizzazioni della partita:
- **Economia e lavoro:** consultare produzione, risorse, scorte e KPI; assegnare lavoratori, priorità e politiche economiche tramite il Job Manager e comandi equivalenti del motore.
- **Fisco e amministrazione:** consultare bilanci e tributi, impostare aliquote, decreti e politiche consentite dal ruolo del giocatore.
- **Cantieri — programmazione, non geometria:** monitorare avanzamento, risorse e manodopera; pianificare attività, finanziamento e priorità su **strutture o progetti già localizzati**. La scelta/predisposizione delle coordinate e la geometria degli edifici non si effettua qui.
- **Militare strategico:** consultare guarnigioni e allarmi, organizzare spedizioni, impartire ordini di marcia e altre azioni strategiche consentite.
- **Diplomazia, posta e logistica:** corrispondenza della branch `messages` dopo integrazione, relazioni feudali, negoziazioni, tributi, carovane e operazioni connesse alla **mappa regionale**.

**DECISO — funzioni riservate alla vista di gioco/Builder 3D:**
- **Piazzamento geometrico preciso** e posizionamento di nuovi edifici e strutture sul terreno.
- **Progettazione e modifica spaziale delle fortificazioni**, mura, porte, torri, geometrie e collegamenti.
- **Controllo tattico diretto** di unità e battaglie nella scena. Gli **ordini strategici** e le spedizioni rimangono accessibili da remoto.

**Confine operativo:** il remote control non diventa un secondo Builder grafico. Un ordine remoto relativo a un cantiere può agire su una costruzione già collocata o su una pianificazione amministrativa che non richiede coordinate; non piazza automaticamente edifici né aggira vincoli fisici o costi della simulazione. Le azioni avvengono tramite comandi autorevoli condivisi: nessuna nuova economia, nessun secondo motore militare.

**Restano APERTI** catalogo completo dei singoli comandi, latenza dei comandi locali, autorizzazioni di sudditi e vassalli, eventuale pianificazione di edifici *non ancora collocati* senza decisione geometrica, UX e notifiche. Il perimetro generale gestione remota vs interazioni spaziali/tattiche **non è più aperto**.

## 3. Architettura da preservare

### Dati e comandi

**VINCOLO DI PROGETTO (derivato dal requisito di controllo remoto):** browser di gioco, dashboard web e futuri client mobili devono consumare **lo stesso modello autorevole di partita**. Le operazioni mutative devono essere validate lato server rispetto a `user_id`, `campaign_id`, `settlement_id`/ruolo feudale, disponibilità delle risorse e stato del mondo. La UI non deve modificare direttamente un salvataggio locale come se fosse il mondo condiviso.

**DECISO — due canali logici distinti (13/11/2026):**
1. **Comandi di amministrazione in presenza:** quando il personaggio si trova **fisicamente nel feudo da amministrare**, l'ordine viene ricevuto e validato dal backend autorevole, poi **applicato al primo tick utile** senza messaggero aggiuntivo. **Possedere altri feudi non ne rende istantanei i comandi**: per governarli bisogna trasferire il personaggio o inviare messaggeri/piccioni. Accettazione e applicazione sono stati distinti; durata reale del tick ancora da stabilire.
2. **Comunicazioni verso altri feudi e persone:** lettere, richieste e ordini diplomatici indirizzati ad altri feudi rispettano **origine, destinazione, trasporto e tempo simulato di recapito**; inviare ≠ consegnare. Il destinatario non accede al contenuto o ai suoi effetti prima della consegna prevista dal motore; app, browser e notifiche non creano scorciatoie. Un messaggio recapitato non applica automaticamente una decisione diplomatica se la semantica di quel messaggio non lo prevede.

**PROPOSTO:** layer di lettura leggero (snapshot, KPI, timeline ed eventi/avvisi) e layer di comando separati, senza richiedere scene 3D, canvas o simulazioni economiche parallele sul client. Prevedere audit/completamento/esito dei comandi e informazioni sulla freschezza dello snapshot. Le notifiche cross-campagna e i push mobili restano future. **DECISO**: il comando locale che avvia una spedizione viene acquisito al tick utile, ma spostamento, viaggio, intercettazione, arrivo e conseguenze si svolgono sempre con i tempi simulati propri del motore: nessun teletrasporto della spedizione al tick.

### Componenti già nel repository (verificati il 13/11/2026)

- **Centro di controllo su `main`:** `src/settlement-panels.js` e `docs/management-panels.md`; nove aree gestionali, KPI/storici, letture di `ConquerGame`/Economy/Siege/Combat e comandi del motore. **Non è ancora una dashboard remota server-side**.
- **Diplomazia e convogli su `main`:** `src/settlement-diplomacy.js` e `src/settlement-convoys.js`, con **province esterne ancora astratte** e interazioni col mondo limitate dalla mancanza di World/Feudal integrato.
- **Branch `messages` non integrata:** `docs/MESSAGES-SYSTEM.md`, `src/settlement-messages.js`, `qa/messages-regression.cjs`. Include lettere con trasporto messaggero/piccione, tempi simulati e report programmati, stato persistito nel singolo insediamento e quattro feudi esterni astratti. **Non è messaggistica inter-giocatore/server reale** e non esegue automaticamente gli ordini consegnati.
- **Divergenza Git verificata:** branch `messages` **29 commit avanti e 317 indietro** rispetto a `main` nel confronto del 13/11/2026. Prima di portarla nel nuovo hub occorre **audit e cherry-pick/porting selettivo** dei contratti ancora validi, senza merge cieco.
- **Persistenza odierna:** `src/settlement-app-persistence.js` e `supabase/schema.sql` salvano la singola colonia con una chiave basata su `user_id,world_cell_x,world_cell_y`, non su `campaign_id`. La separazione account/campagna e l'accesso da client remoto sono dipendenze preliminari.

## 3a. Ordini preparabili durante la pausa regionale — DECISO (13/11/2026)

**DECISO — preparare sì, simulare no:** quando una campagna è in **pausa regionale programmata**, ma il servizio è raggiungibile, un giocatore può **consultare lo stato congelato e predisporre ordini** per il proprio feudo tramite browser o futuro client mobile. Gli ordini sono **registrati/in attesa**, non eseguiti; **nessun tick, costruzione, produzione, movimento, viaggio, messaggio o consegna avanza** durante la pausa.

**DECISO — esecuzione alla ripresa:** alla riattivazione gli ordini preparati entrano nel flusso del **primo tick utile**, mantenendo la distinzione fra accettazione ed esecuzione. Gli ordini che avviano spedizioni/carovane non ne anticipano il viaggio: il tempo di marcia parte quando la simulazione riprende.

**VINCOLO TECNICO PROPOSTO:** ri-validare al momento dell'applicazione permessi, risorse e prerequisiti, evitare duplicati dopo retry, e mostrare successo o rifiuto in modo esplicito. L'ordine può essere preparato con dati di uno snapshot congelato, ma ciò non garantisce che le sue condizioni rimangano soddisfatte alla ripresa.

**DISTINZIONE:** *server in pausa, ancora raggiungibile* ≠ *dispositivo senza rete / server irraggiungibile*. La possibilità di conservare ordini **solo sul telefono** e sincronizzarli in seguito è **APERTA**: non è stata approvata implicitamente.

**APERTO:** quali tipologie di ordini si possono prenotare; ordine di elaborazione, limiti, modifica/cancellazione, gestione di competizione e risorse scarse sul primo tick, messaggi redatti vs effettivamente spediti, ed eventuali costi della preparazione. La pausa regionale stessa (fasce, calendario e accensione) rimane soggetta al design della campagna; il principio vale **se** tale pausa è prevista.

## 3b. Push mobile: consenso OS e preferenze per categoria — DECISO (14/11/2026)

**DECISO — doppio controllo:** la futura app Android/iOS richiede il **permesso per le notifiche push tramite il sistema operativo** e permette al giocatore di **scegliere separatamente quali categorie ricevere** nelle impostazioni dell'app. Un push è ammissibile soltanto se **l'autorizzazione OS è attiva E la relativa categoria è abilitata**. Il permesso generale non annulla le scelte per categoria; l'app non aggira mai un permesso negato o revocato.

**DECISO — visibilità del gioco invariata:** avvisi, posta e rapporti consultabili in-app restano disponibili indipendentemente dalla scelta di ricevere push. Le notifiche su lettere e rapporti possono riferirsi solo a contenuti **già recapitati nella simulazione**, mai anticipare informazioni dei vassalli o altri feudi. Filtri e permessi devono operare per l'account/campagna corretti.

**PROPOSTO — categorie iniziali:** sicurezza/attacchi/assedi; criticità economiche; cantieri; posta e diplomazia; spedizioni; tributi. **APERTO:** elenco e nomi definitivi, comportamento iniziale dei selettori dopo il consenso OS, silenziamento, filtri per singola campagna, testo visibile sulla schermata bloccata e momento della richiesta del permesso. **Non è stato stabilito** che tutte le categorie siano inizialmente attive.

**DIPENDENZA:** notification service server-side, evento autorizzato e consegnato, preferenze utente, registrazione/revoca token per dispositivo e integrazione con provider Android/iOS. Il principio è confermato nella [SRS mobile v0.6, draft PR #222](https://github.com/erykwest/CONQUER/pull/222); implementazione futura, non pronta su `main`.

## 3c. Personaggio unico e governo dei feudi tramite presenza o corrispondenza — DECISO (14/11/2026)

**DECISO:** ciascun account può avere **un solo personaggio in ogni campagna**, benché possa partecipare a più campagne simultanee e governare **più feudi/territori** dentro ciascuna. Questo non crea personaggi o slot umani aggiuntivi.

**DECISO:** il personaggio ha una **posizione fisica unica** nella campagna. Per amministrare **direttamente** un feudo deve **spostarsi fisicamente** fino a quel feudo (viaggio soggetto ai tempi simulati). In alternativa, può inviare ordini a un feudo distante **mediante messaggeri o piccioni**: l'ordine non arriva/si applica istantaneamente perché il giocatore ha aperto una scheda diversa nella dashboard. La scelta del client (browser/mobile) non cambia la presenza del personaggio.

**CORREZIONE DEL CONTRATTO TEMPORALE:** «ordine locale al primo tick utile» (§3) significa **ordine relativo al feudo in cui il personaggio è presente**, non qualsiasi feudo di sua proprietà. Se il personaggio è altrove, le comunicazioni hanno tempi di invio/trasporto/consegna simulati. Un ordine recapitato può essere eseguito solo secondo permessi e regole del feudo ricevente, senza presupporre che ogni lettera attivi automaticamente un effetto.

**DIPENDENZE:** World/Feudal per presenza, identità e viaggio del personaggio; messaggi reali tra feudi, messaggeri/piccioni e loro tempi per comandi remoti; un backend autorevole condiviso. Il prototipo `messages` non equivale ancora a un multiplayer reale.

**APERTO:** tempi e pericoli del viaggio, infrastrutture/prerequisiti della posta via piccione, costi/intercettazione, azioni consentite tramite messaggio, deleghe a amministratori, stato di comando durante il viaggio, modalità di lettura dei dati di *propri* feudi lontani. La regola già decisa sui **resoconti dei vassalli** resta valida: non diventano KPI live al cambio di schermata.

## 3d. Unica base di codice per Android e iOS — DECISO (14/11/2026)

**DECISO — app mobile cross-platform:** la futura app Android e iOS sarà realizzata usando **un'unica base di codice applicativa condivisa**, con integrazioni native mirate quando necessarie (notifiche, permessi, distribuzione). Non si svilupperanno due prodotti indipendenti con logiche gestionali duplicate.

**DECISO — backend comune:** l'app mobile utilizza gli **stessi contratti API e il medesimo stato autorevole** dell'hub browser. Identità, permessi feudali, tempi di recapito, KPI e ordini restano governati dal server; una sola codebase **mobile** non impone di condividere integralmente la UI del browser.

**APERTO:** scelta del framework (Flutter/React Native/altro), riuso di componenti con il front-end web, dettagli di packaging, requisiti minimi OS e distribuzione store. La decisione riguarda **l'architettura condivisa**, non un framework specifico.

**RIFERIMENTO:** [SRS mobile v0.8 nella draft PR #222](https://github.com/erykwest/CONQUER/pull/222), Q-07 risolta nel principio.

## 3e. Due stati militari: territorio invaso e feudo sotto assedio — DECISO (14/11/2026)

**DECISO — non sono sinonimi:**
- **INVASO:** le forze ostili hanno invaso il territorio/la regione del feudo; questo **non equivale automaticamente a un assedio effettivo** e **non attiva da solo** il divieto di far uscire messaggeri riservato al blocco d'assedio. Eventuali rischi o restrizioni aggiuntive durante l'invasione restano da definire.
- **SOTTO ASSEDIO:** un assedio effettivo è stato stabilito secondo lo stato autorevole del motore; **i messaggeri ordinari non possono lasciare il feudo assediato**. L'app, il browser e le API devono rifiutarne la partenza.
- **PICCIONI DURANTE L'ASSEDIO:** possono **uscire** dal feudo e **non sono intercettabili**; mantengono i requisiti di una rete/piccionaia disponibile e il **tempo di recapito simulato**, senza teletrasporto o consegna anticipata.

**RILEVANZA PER IL REMOTE CONTROL:** il personaggio può ricevere informazioni e comunicare con un feudo assediato **tramite piccioni disponibili** e senza intercettazione del vettore in uscita; gli ordini a distanza restano soggetti a viaggio/consegna e permessi. La sola selezione del feudo in dashboard non crea un canale informativo o di comando alternativo. Se il canale piccione è assente, il client non inventa la spedizione.

**APERTO:** momento esatto in cui l'invasione diventa assedio; rischi dei messaggeri *durante l'invasione*; gestione dei messaggeri **in entrata** durante l'assedio (il divieto deliberato riguarda l'uscita); sorte dei vettori già partiti; prerequisiti/costi dei piccioni, composizione degli ordini e informazioni disponibili al giocatore lontano. La Q-09 della [SRS mobile v0.10, draft PR #222](https://github.com/erykwest/CONQUER/pull/222) è **parzialmente risolta**, non interamente chiusa.

**STATO:** norma progettuale, **non gameplay multiplayer implementato**. MARCH contiene lo scheletro delle operazioni `raiding/siege`; la branch `messages` possiede i vettori messaggero/piccione, ma nessuno dei due sistemi realizza ancora il blocco postale di una campagna multiplayer autorevole.

## 4. Decisioni ancora necessarie

1. **Dettaglio comandi:** inventario esatto dei comandi remoti per economia, fisco, lavoro, cantieri già localizzati, strategia, diplomazia e logistica; il **confine generale è deciso** nel §2a: niente piazzamento geometrico, progettazione spaziale o controllo tattico diretto.
2. **Dettagli temporali ancora aperti:** durata e scheduling del tick, coda e concorrenza al primo tick di ripresa, semantica delle singole richieste inter-feudo. **DECISO**: proprio feudo → primo tick utile; comunicazioni inter-feudo → recapito simulato; server regionale in pausa → ordini preparabili ma simulazione congelata fino alla ripresa.
3. **Dettagli della visibilità (principio DECISO):** proprio feudo aggiornato direttamente; vassalli solo tramite rapporti recapitati, **frequenza impostata dal sovrano**. Da definire granularità della programmazione, contenuto, diritti e selezione dei KPI sulle schede aggregate.
4. **Permessi, presenza e blocco:** distinguere comandi del feudo dove il personaggio è presente e ordini inviati a distanza; durante **assedio** non possono partire messaggeri ordinari, mentre i **piccioni non intercettabili** possono uscire se il canale è disponibile. Restano aperti diritti feudali, deleghe e ordini trasmissibili.
5. **Dettagli degli ordini in pausa (principio DECISO):** preparazione consentita durante pause regionali, applicazione solo al riavvio e nessun avanzamento del mondo; **APERTO** ordine/limiti/revoca, conflitti al tick, notifiche, gestione server irraggiungibile e coda offline sul dispositivo.
6. **UX e piattaforme:** **DECISO:** una sola codebase applicativa Android/iOS (§3d), API e stato condivisi con browser; push con consenso OS + filtri per categoria (§3b). **APERTO:** framework cross-platform, livello di condivisione UI con web, tassonomia e default dei filtri, silenziamento, autenticazione e aggiornamenti real-time.

## 5. Tranche di lavoro future (non implementate)

- **RC-01 Hub account e multi-campagna:** home/lobby, membership, switch e riepiloghi indipendenti per partita.
- **RC-02 KPI/snapshot autorevoli:** read model delle partecipazioni con fonti e timestamp, autorizzazioni e stati di allarme. Per i vassalli usare **soltanto rapporti effettivamente recapitati**; il sovrano può configurare la frequenza dei messaggeri di resoconto. Vietata lettura live degli inventari/statistiche dei vassalli in app/API.
- **RC-03 Comandi remoti:** API e permessi per economia, fisco, lavoro/Job Manager, cantieri già collocati, gestione militare strategica, diplomazia e logistica; validazioni, coda/esiti, stessa logica senza duplicazioni. **Ordini diretti solo dove il personaggio si trova; altri feudi mediante viaggio o messaggeri/piccioni con recapito simulato.** Esclusi piazzamento geometrico, fortificazioni e controllo tattico diretto, riservati al Builder/3D.
- **RC-04 Comunicazioni/messaggi:** analisi branch `messages`, porting selettivo, nodi reali, ETA, rapporti e integrazione diplomazia; **stato INVASO distinto da SOTTO ASSEDIO**: sotto assedio messaggeri in uscita bloccati, piccioni in uscita consentiti e non intercettabili (§3e).
- **RC-05 Strategia remota:** spedizioni, carovane/tributi, diplomazia e mappa regionale collegate a World/Feudal.
- **RC-06 Mobile-ready:** web responsive e API neutrali alla piattaforma, poi app **Android/iOS da un'unica base di codice condivisa**, senza riscrivere le regole; push con permesso OS e selezione per categoria, senza interferire con visibilità/temporizzazione in-game. Framework da scegliere.
- **RC-07 QA e sicurezza:** isolamento tra campagne, autorizzazione, consistenza dello stato, velocità ×1 condivisa, messaggi ritardati, concorrenza/duplicati dei comandi e test multi-client.

**Dipendenze e roadmap:** World/Feudal (M4), MP-07 account vs campagna, persistenza autorevole, Combat/Siege/Economy unici. Questo documento **non anticipa** le milestone esistenti né dichiara pronta la dashboard remota.
