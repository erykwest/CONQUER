# Multiplayer — Server, ingresso e colonizzazione feudale

> **Stato 13/11/2026:** scope di prodotto discusso con il product owner. **Non implementato** su `main`: World/Feudal, lobby, bot territoriali multiplayer, server persistenti e assegnazione di spawn sono ancora da progettare/sviluppare. Le regole marcate **DECISO** sono vincoli di design; **PROPOSTO** e **APERTO** non devono essere trasformati silenziosamente in requisiti.

## 1. Modello di server e territori

- **DECISO — dimensionamento indicativo:** partite multiplayer per circa **20–100 giocatori umani**, con una **soglia minima di avvio**. Il minimo numerico, la capienza delle singole tipologie di server e il rapporto giocatori/bot devono ancora essere fissati. Il numero massimo di giocatori non equivale al numero totale di territori.
- **DECISO — posti distinti:** il mondo include **slot umani**, insediamenti iniziali gestiti da **bot** e territori inizialmente **non colonizzati**. Un nuovo giocatore **non sostituisce un bot** e non eredita i suoi progressi.
- **DECISO — distinzione territoriale:** **rivendicare/reclamare un territorio** (sovranità o possesso) è diverso da **fondare un villaggio** (insediamento e sviluppo effettivo). Un territorio può appartenere a un signore pur non essendo ancora colonizzato.
- **DECISO — ingresso anche a campagna avviata, in linea di principio:** la possibilità reale dipende da (a) posti umani residui e (b) almeno un territorio **idoneo alla fondazione** secondo le regole di colonizzazione. Nessun ingresso con trasferimento di un feudo già sviluppato dall'IA a un umano. Una chiusura temporale indipendente dall'idoneità è ancora **APERTA**.
- **DECISO — priorità di spawn:** i territori **liberi e non rivendicati** sono la prima destinazione. I territori **rivendicati, ma aperti dal proprietario alla colonizzazione umana**, sono una possibilità successiva. La priorità non implica che un territorio reclamato sia automaticamente colonizzato.
- **DECISO — sviluppo delegato:** per i propri possedimenti il signore può configurare la disponibilità alla **gestione da parte di un nuovo giocatore** in alternativa allo **sviluppo automatizzato**. Il nuovo giocatore fonda e sviluppa il proprio villaggio partendo dall'inizio, ma entra come **suddito** del titolare del territorio. Sovranità del titolare e gestione dell'insediamento sono distinte; non si cancella lo sviluppo precedente di un bot.
- **DECISO — non forzare la capienza:** se non esistono territori idonei, il server non può ammettere nuovi fondatori anche quando esistono slot umani numericamente liberi.

### Esempio numerico, non configurazione obbligatoria

Mappa di **100 territori**, capienza massima di **30 giocatori umani**, **30** feudi bot iniziali, **10** giocatori umani presenti a T0: **40** territori inizialmente colonizzati (10+30), **60** non colonizzati, **20** ulteriori ingressi umani possibili **solo se** rimangono posti e posizioni idonee. I 60 territori liberi **non sono 60 posti giocatore aggiuntivi** e possono essere rivendicati durante la campagna.

## 2. Regole di fondazione e sudditanza

| Stato del territorio | Accesso del nuovo giocatore | Esito |
| --- | --- | --- |
| Libero e idoneo a fondare | **Prioritario** | Nuovo villaggio indipendente, senza progressi ereditati |
| Rivendicato, non colonizzato, abilitato dal proprietario alla colonizzazione umana | **Secondario** | Nuovo villaggio del giocatore, inizialmente **suddito** del proprietario |
| Già sviluppato da un bot o giocatore | **Non sostituibile** | Nessuna acquisizione automatica dei progressi altrui |
| Non idoneo alla fondazione o non aperto dal proprietario | **Non spawnabile** | Nessun ingresso in quella posizione |

**PROPOSTO, non ancora cristallizzato:** assenza di un **mastio** come condizione necessaria (ma non necessariamente sufficiente) per rendere un territorio reclamato ancora colonizzabile; verifica geometrica di spazio edificabile e risorse; preferenza volontaria del giocatore per nascere suddito anche se esistono terre libere; modalità amministrative dell'interruttore (sviluppo IA / aperto ai coloni / riservato). Il significato esatto di «territorio sviluppato» e la possibilità di convertire un possedimento dall'automazione all'apertura, senza trasferire progressi già prodotti, sono da specificare.

La colonizzazione umana di un possedimento non deve generare una copia del feudo, un secondo ledger economico o due proprietari della medesima sovranità. Diritti del suddito, tributi, facoltà di revoca, ribellione e protezione iniziale **rimangono aperti**.

## 3. Lobby e scoperta delle partite

- **DECISO a livello di prodotto:** il giocatore può scegliere a quale campagna/server unirsi in una **lobby** consultando informazioni pubbliche sullo stato della partita.
- **Informazioni richieste / esempi da definire nella UI:** età reale del server e fase della campagna, capienza e giocatori presenti/attivi, bot presenti/attivi, progresso raggiunto (es. livello massimo), disponibilità reale di insediamenti indipendenti e di terre aperte alla sudditanza, eventuali fasce orarie regionali.
- **APERTO:** definizione esatta di «giocatore attivo», pubblicità di classifiche/dettagli sensibili, classificazione di equità per i nuovi entranti e criteri di presentazione/filtraggio dei server.

## 4. Tempo, campagne e partecipazione multi-server

- **DECISO:** multiplayer a **velocità ×1**, senza moltiplicatori individuali di accelerazione.
- **PROPOSTO:** lo stesso account può partecipare a **più campagne/server contemporaneamente**, mantenendo feudi, eserciti, progresso e relazioni separati per partita.
- **APERTO:** durata attesa e massima di una campagna, soglia e verifica della condizione di vittoria territoriale, finestra operativa giornaliera per area geografica, conseguenze della disconnessione, abbandono e sconfitta, chiusura degli ingressi vicino alla conclusione.
- **NOTA SUL RUNTIME ESISTENTE:** il calendario del prototipo locale in `main` usa **365 giorni/anno**, `BASE_DAYS_PER_SECOND = 1/48` a ×1 (giorno di 48 s); le velocità di test ×3/×10/×100 non sono il contratto multiplayer. **Non cambiare qui il calendario**: scelta di campagna e scala temporale da trattare a parte.

## 5. Backlog di definizione — senza implementazione

1. **MP-01 Server/lobby:** capienze per server, minimo di partenza, ciclo di vita, ingresso tardivo e metadati pubblici.
2. **MP-02 Territori/slot:** modello dati distinto per territori, sovranità, insediamenti, slot umani, bot e territori non colonizzati; criteri di idoneità.
3. **MP-03 Colonizzazione feudale:** priorità liberi → possedimenti aperti, permesso del titolare, ingresso come suddito, rapporto con mastio e sviluppo automatico.
4. **MP-04 Equità e politica:** salvaguardie per chi arriva dopo, diritti del suddito, tributi, revoca/indipendenza, abbandono e sconfitta.
5. **MP-05 Tempo/campagna:** durata attesa, calendario, finestre regionali, condizioni di vittoria e account multi-server.
6. **MP-06 QA futura:** test per occupazione territoriale separata dalla fondazione, ingresso senza sostituzione bot, non-sovrapposizione spawn, capienza/idoneità, persistenza e autorizzazioni server.

**Dipendenze:** `World/Feudal` (roadmap M4), stato e ID unici di territori/feudi, economia e Combat/Siege condivisi, persistenza autorevole lato server; non introdurre un simulatore parallelo.
