# CONQUER — CANS: Contextual Activity & Navigation System

> **Stato:** specifica architetturale V0.1, **solo documentazione**, 23/10/2026.
> **Branch di progettazione:** `cans` (creata da `main`).
> **Nessuno skeleton/runtime/QA CANS è dichiarato implementato da questo documento.**
> **Principio:** unificare l'assegnazione di occupanti, postazioni, attività e navigazione contestuale senza sostituire i sistemi di economia, movimento o rendering esistenti.

## 1. Obiettivo

CANS fornisce un contratto condiviso per le **attività contestuali** dei popolani e delle unità nei luoghi produttivi e sociali, chiusi, aperti o mobili.

Un `ActivityDomain` rappresenta un contesto funzionale che contiene accessi, slot, occupanti, destinazioni, sequenze di attività e — quando serve — una rete locale di navigazione.

Casi previsti:
- **Interni:** chiesa/cattedrale, taverna, casa, bottega, edifici del castello; occupanti visibili tramite cutaway.
- **Aree pubbliche aperte:** mercato e piazze con più ingressi, bancarelle e percorsi tra punti d'interesse.
- **Produzione agricola:** polo agricolo e campi con lavorazioni a serpentina; campo come dominio figlio o area operativa collegata.
- **Estrazione:** bosco, cava e miniera; bersagli e postazioni statiche oppure dinamiche.
- **Estensioni future:** caccia a cervi mobili, pesca con imbarcazioni, convogli commerciali e altri veicoli.

CANS gestisce **chi va dove, per quale attività e con quale ordine**. Il motore di movimento effettua gli spostamenti; quello economico contabilizza produzione/consumi/scambi; il renderer visualizza gli stati. Non introdurre tre simulazioni autonome dello stesso evento.

## 2. Decisioni di design e limiti dell'ambito

### Definito nel confronto progettuale del 23/10/2026

1. Utilizzare un sistema comune di **slot**, **registrazione occupanti**, **sequenze di attività** e **percorsi** per gli interni e, dove possibile, per produzione e servizi.
2. Gli slot hanno identità persistente e distinzione iniziale **`worker` / `guest`**; capienza e occupazione sono concetti separati.
3. L'arredo/layout genera una volta le postazioni e la rete navigabile. La visualizzazione cutaway **legge** lo stato, non genera persone, slot o percorsi nuovi.
4. La navigazione interna usa una rete **precalcolata e salvata** alla generazione, con percorsi ricavabili tra ingressi e postazioni.
5. Una postazione può essere puntuale oppure una **traiettoria di lavorazione**, come la serpentina del campo.
6. Un dominio può possedere **più ingressi/uscite** (mercato all'aperto, edifici con porte multiple).
7. Gli obiettivi dinamici (alberi, prede, banchi di pesca) vengono selezionati nella zona di competenza e ricalcolati **a evento/richiesta**, non per forza a ogni frame.
8. Le navi sono contemporaneamente **domini funzionali** per equipaggio e passeggeri e **veicoli** che navigano verso un target; le postazioni interne rimangono relative allo scafo.

### Proposte implementative da verificare prima dello skeleton

Il modello dati concreto, gli algoritmi di prenotazione, la politica di ricalcolo, gli stati di lifecycle e i budget prestazionali di seguito sono **proposte tecniche**, non codice verificato né numeri approvati di bilanciamento.

La presenza di funzioni simili nel repository non implica già l'esistenza di CANS. Prima dello sviluppo confrontare i contratti correnti di navigazione, popolazione, campi, lavoro, cutaway, economia e navigazione dei veicoli sulle branch interessate.

## 3. Entità e contratti logici

| Concetto | Responsabilità | Persistenza proposta |
| --- | --- | --- |
| `ActivityDomain` | ID, tipo, proprietario/struttura padre, footprint o area operativa, stato, transform e revisioni | Sì, se il dominio esiste nel mondo salvato |
| `AccessPoint` | Ingresso/uscita fisico, compatibilità, collegamento tra navigazione globale e locale | Sì o derivazione deterministica versionata |
| `ActivitySlot` | ID stabile, ruolo `worker`/`guest`, posizione/itinerario locale, orientamento, requisiti, azioni ammesse | Sì per gli slot statici; riferimento/derivazione per i dinamici |
| `OccupancyRecord` | Associazione esclusiva tra entità reale e slot/dominio, stato e token di prenotazione | Sì se necessario per ripristino fedele; validazione al load |
| `ActivitySequence` | Passaggi, condizioni, durate logiche, spostamenti e transizioni tra postazioni | Definizione versionata + progresso dell'entità |
| `LocalNavigationGraph` | Nodi, archi, attraversabilità e collegamenti ingresso-slot | Cache serializzabile o ricostruibile in modo deterministico |
| `DynamicTarget` | Albero, cervo, pesce/banco, nodo di estrazione o altra risorsa con ID e validità | Riferimento all'entità del mondo, mai copia autoritativa |
| `Carrier` | Nave/carro/veicolo che trasporta un dominio con trasformazione mobile e rotta globale | Stato del veicolo esistente, collegamento tramite ID |

**Separare rigorosamente:** slot disponibile, slot riservato, slot occupato e slot sospeso/inaccessibile. Uno slot senza occupante non crea un figurante. Un occupante non può essere contemporaneamente assegnato a due slot fisici incompatibili.

L'ID del cittadino o lavoratore è l'autorità di identità; non usare mesh, sprite o indici di array del renderer come chiavi di occupazione. Se il gioco mantiene popolazione economica aggregata, CANS collega soltanto gli avatar/worker fisici rappresentati e non li trasforma automaticamente in agenti economici individuali.

## 4. Generazione di un dominio e navigazione locale

Alla creazione o finalizzazione del layout:
1. Assegnare un `domainId` persistente e riferimento a struttura/lotto/area.
2. Fissare geometria dei passaggi, impedimenti e arredi.
3. Generare punti di accesso **uno o molti**; validarne la connettività con la rete esterna.
4. Generare slot da arredi e funzioni: panca -> posti `guest`, incudine -> `worker`, bancone -> `worker` e `guest` secondo configurazione; campo -> segmenti/itinerari di lavoro.
5. Costruire il grafo locale di passaggi e accesso alle postazioni, rispettando ingombri/collisioni.
6. Salvare layout, slot, grafo o descrittori deterministici e revisioni. **Non precalcolare necessariamente tutte le coppie di itinerari**: memorizzare il grafo condiviso e mettere in cache solo i percorsi richiesti.
7. In caso di layout inaccessibile, marcare gli slot come non raggiungibili e impedire assegnazioni invalide; non consentire scorciatoie attraverso muri.

**Modifica degli arredi:** incrementare `layoutRevision`, aggiornare solo nodi/slot interessati quando possibile, conservare gli ID non coinvolti, risolvere le prenotazioni invalidated e ricollocare o far uscire gli occupanti degli slot eliminati. La rotazione/cutaway/zoom della camera **non** è una modifica del layout.

### Coordinata locale e mondo

Per gli edifici gli slot sono definiti in coordinate del dominio. La trasformazione del dominio determina la posizione nel mondo; modificare camera, livello di dettaglio o renderer non cambia lo stato.

Per un dominio mobile, la trasformazione cambia con il veicolo: gli slot restano stabili nello spazio locale. La posizione globale di un marinaio è derivata dalla trasformazione nave + posizione locale, non da un secondo percorso sulla mappa.

## 5. Assegnazione, prenotazione e lifecycle

Proposta di flusso:
- `Idle/Eligible`: trovare domini/slot compatibili con professione, routine, età/ruolo e calendario, senza creare doppioni rispetto agli incarichi reali.
- `Reserved`: prenotare atomicamente lo slot di destinazione; non permettere a due entità di prenotarlo insieme.
- `Approaching`: navigazione globale fino all'accesso valido; scegliere quello raggiungibile più conveniente, non il primo in elenco.
- `Entering`: transizione ingresso e ancoraggio al grafo locale, solo quando raggiunto davvero.
- `Traversing`: seguire il grafo locale verso lo slot; aggiornare posizioni logiche, senza teletrasporti.
- `Working/Visiting`: eseguire azione e durata; animazione dipende dallo stato, non ne è l'origine.
- `Transferring`: prenotare il nuovo slot prima di liberare il vecchio, o usare una transizione atomica equivalentemente sicura; poi navigare.
- `Leaving`: liberare slot e ritornare al pathfinding esterno attraverso un'uscita valida.
- `Cancelled/Interrupted`: rilascio robusto su demolizione, morte, cambio incarico, assedio, incendio, fuga o salvataggio incoerente.

**Invariante fondamentale:** una singola entità ha al massimo una posizione fisica autoritativa e un'attività operativa alla volta. La prenotazione deve avere scadenza/fallback in caso di mancato raggiungimento; un percorso fallito non conclude il lavoro e non occupa magicamente lo slot.

Per la capienza: assegnazione del primo slot compatibile *raggiungibile* nell'ordine configurato. Se un occupante lascia la terza panca, gli altri non vengono riordinati per riempire il vuoto, salvo attività esplicita di spostamento.

## 6. ActivitySequence: un motore, comportamenti configurabili

Una sequenza descrive fasi e condizioni, senza implementare un comportamento diverso in ogni renderer.

Esempi di workflow:

| Dominio | Sequenza esemplificativa | Tipo di navigazione |
| --- | --- | --- |
| Chiesa | ingresso -> panca libera -> sedersi/pregare -> uscita | Grafo locale persistente |
| Taverna | ingresso -> bancone -> tavolo -> eventuale altro tavolo -> uscita | Grafo locale con transizioni |
| Bottega | ingresso -> banco/incudine -> lavorazione -> deposito -> uscita | Grafo locale, `worker` |
| Mercato | accesso A/B/C -> bancarella -> eventuale altra bancarella -> uscita D | Grafo aperto multiaccesso |
| Campo | struttura madre -> campo -> aratura/semine/raccolta per traiettoria serpentina | Globale + percorso locale di lavoro |
| Bosco | campo -> albero disponibile -> punto di taglio -> lavoro -> albero successivo | Target dinamico + nav globale |
| Caccia futura | base -> area di caccia -> cervo -> approccio/azione -> rientro | Target mobile + rivalutazione a evento |
| Pesca futura | porto -> nave -> banco di pesca -> lavoro -> rientro | Dominio mobile + rotta del veicolo |

Una `ActivitySequence` non è una produzione economica: la chiusura di un'attività visiva non accredita automaticamente materiali. La produzione è riconciliata con l'engine economico a calendari e quantità aggregate.

## 7. Statico, dinamico e due livelli di navigazione

### 7.1 Domini statici/semistatici

Interni e mercati: grafo locale derivato dalla geometria stabile. Quando una porta, bancarella, arredo, muro o passaggio cambia, invalidare il **solo dominio** o la porzione coinvolta. In un mercato aperto i confini rappresentano l'area di attività, non necessariamente collisioni fisiche.

### 7.2 Domini produttivi con bersagli dinamici

Per bosco, cava e altri target:
- Il **dominio operativo** limita la ricerca a zona d'influenza/area di lavoro.
- Il selettore produce un insieme di candidati validi (distanza, accessibilità, disponibilità, compatibilità e stato).
- Una prenotazione esclude altri lavoratori dallo stesso posto se il target non supporta collaborazione.
- La nav globale conduce alla posizione corrente o alla postazione di contatto attorno al target.
- Dopo lavoro, esaurimento, abbattimento, despawn, fuga o perdita di accessibilità, il sistema invalida il candidato e cerca il successivo.
- Il movimento del target non induce un ricalcolo generale della mappa in ogni tick.

**Triggers di ricalcolo:** nuovo incarico, completamento, target eliminato/esaurito, target fuori raggio, percorso non valido, revisione ostacoli/terreno pertinente e timer di sicurezza limitato. I bersagli mobili possono richiedere aggiornamenti a soglia di movimento/distanza; non bloccare il gameplay inseguendo una coordinata ormai obsoleta.

### 7.3 Evitare il ricalcolo totale

`QueryTargets(domain, worker, context)` legge soltanto un indice spaziale/insieme pertinente. `RequestRoute` richiede una rotta solo quando cambia obiettivo o validità; caching con chiave che include revisioni della navigazione. I costi reali vanno misurati: non fissare budget arbitrari senza benchmark.

## 8. Mercati multiaccesso e aree aperte

Il mercato non è un edificio con una porta fittizia: ha più ingressi potenziali dalla rete stradale e più zone di attività. Bancarelle e logge possono creare slot senza rendere l'intera piazza non attraversabile.

Regole:
- Ogni `AccessPoint` si connette al grafo pubblico di movimento attraverso un punto legale.
- L'accesso scelto dipende da origine, destinazione e raggiungibilità; si può uscire da un accesso diverso da quello usato per entrare.
- Ogni bancarella ha uno o più slot `worker` e `guest`, compatibili con personale e clientela.
- Le visite a più bancarelle sono una sequenza di **destinazioni**; non richiedono duplicare la presenza del cittadino.
- Aggiunta/rimozione/spostamento della bancarella invalida solo gli slot e i collegamenti interessati; non è necessario rigenerare l'intero quartiere.
- Non associare vendite/ricavi ai soli gesti animati: la transazione reale resta nell'economia.

## 9. Campi e infrastrutture di produzione

Un polo agricolo può essere padre logico di più campi/domìni figli, con assegnazione condivisa del personale. Il campo mantiene le proprie fasi già progettate: aratura, semina, crescita, raccolto. Non sostituire il calendario, le rese o le formule di lavoro esistenti con nuove quantità implicite.

La **traiettoria di lavorazione** è una risorsa dello slot, eventualmente fatta di più segmenti ordinati. Per un campo a quattro vertici, i tracciati a serpentina sono derivati dalla geometria e dalle direzioni di lavoro; memorizzare revisione della geometria/semine per invalidarli.

Durante la crescita senza lavoratori non riservare slot worker occupati, salvo esigenza esplicita del modello agricolo. Il sistema scheduler deve rispettare disponibilità del personale e giornate lavorative; nessun lavoratore può risultare simultaneamente in due campi.

Per taglialegna e cavatori, la postazione può migrare tra bersagli nella zona del polo; la **struttura madre** rimane il proprietario dell'incarico e il punto di ritorno.

## 10. Imbarcazioni: dominio mobile sopra veicolo mobile

Separare nettamente **navigazione del carrier** e **navigazione/activity dei suoi occupanti**.

### Nave in porto

La nave è un dominio fermo collegato alla banchina da uno o più `AccessPoint` (passerella, imbarco). Marinai e passeggeri arrivano dal mondo tramite il pathfinding normale, entrano e occupano gli slot. L'imbarco non duplica l'entità sulla banchina e sul ponte.

### Nave in mare

Il `Carrier` controlla coordinate/rotazione/velocità, ostacoli nautici, rotta e destinazione. Gli slot a bordo restano **in coordinate locali** e il grafo del ponte/cabine non deve essere ricalcolato a ogni spostamento dello scafo. Equipaggio e passeggeri possono cambiare postazione/animazione pur viaggiando sulla stessa nave.

- **Peschereccio:** target = banco/zona di pesca eventualmente mobile; percorso nautico, attività di pesca, rientro.
- **Mercantile:** target = punto/segmento valido del bordo della mappa o porto esterno; attraversamento del confine, stato fuori mappa, eventuale viaggio/ritorno secondo futuro sistema commerciale.
- Se il target si muove o una rotta è invalidata, ricalcolare la rotta del **veicolo**, non ogni singola posizione a bordo.

### Transizioni sicure

`Docked -> Boarding -> Ready -> Sailing -> Arrived/OffMap -> Docked` è un possibile lifecycle, da validare. Al momento della partenza bloccare nuovi imbarchi ed evitare occupanti in attraversamento della passerella; alla scomparsa off-map conservare IDs, equipaggio, carico e missione in uno stato serializzabile, senza creare o eliminare ricchezza per un semplice effetto grafico.

## 11. Animazioni, cutaway e simulazione lontano dalla camera

La simulazione autoritativa registra attività, occupante, slot e avanzamento **indipendentemente dalla visibilità**. La grafica:
- legge il registro per mostrare i soli occupanti effettivi quando l'interno è esposto dal cutaway o zoom;
- applica pose/animazioni previste dallo slot (sedere, pregare, lavorare, bere, dormire, tagliare);
- interpola i segmenti locali durante i trasferimenti, senza inventare cambi di stato;
- può usare LOD/culling e aggiornamenti meno frequenti quando non visibile, senza alterare ordini e produzione;
- non rigenera layout o trasporta lavoratori quando cambia renderer Canvas/WebGL2.

La compatibilità con sistemi di rendering/cutaway già sviluppati va verificata: questo documento **non** certifica che arredi, stanze o navigazione interna abbiano già i contratti necessari su `main`.

## 12. Persistenza, determinismo e migrazione

Definire `schemaVersion` per dominio, layout e sequenze. Persistenza raccomandata:
- ID stabili del dominio e della struttura proprietaria;
- transform, accessi, slot statici, revisioni di layout/nav;
- registro occupanti e attività in corso con IDs delle entità;
- riferimento al bersaglio dinamico, non snapshot di un'entità duplicata;
- per carrier: nave, bordo/rotta, missione, carico esistente e occupanti, con transform locale;
- cache di percorsi derivati **ricostruibile** e scartabile, non fonte di verità.

Al caricamento: verificare esistenza e compatibilità di strutture, abitanti, target e slot; sciogliere prenotazioni scadute; migrare layout senza cambiare ID sopravvissuti; evitare che un cittadino venga materializzato contemporaneamente in due luoghi.

Per le vecchie partite: CANS deve essere **opt-in** fino alla fase di integrazione; in assenza di record CANS, la simulazione storica continua a funzionare. Non azzerare campi, popolazione o strutture per installare il sottosistema.

## 13. Integrazione con l'architettura CONQUER

**Punti da verificare prima di scrivere codice:**
- `src/settlement-population-navigation.js`: nav esterna, ostacoli, revisioni/percorsi delle entità.
- `src/settlement-app-rooms.js` e sistemi di slot del castello: capienza, accessi, assegnazione, UI.
- `src/settlement-urban.js`: lotti e campi; geometrie e routine a serpentina.
- `src/settlement-economy.js`: popolazione L1–L4 e contabilità aggregata.
- `src/settlement-app-persistence.js` e stato condiviso: ID, schema save/load, migrazioni.
- `src/settlement-render.js` e `src/settlement-world3d.js`: cutaway, animazioni e LOD.
- Codice effettivo di pattuglie, veicoli e nav nautica sulle branch esistenti, se presente.

**Vincolo di integrazione:** preservare la distinzione fra `tier` e `currentJob`, i lavoratori realmente assegnati e il ledger aggregato (vedi [economy.md](economy.md), [DECISIONS.md](context/DECISIONS.md), [STATUS.md](context/STATUS.md)). Non far dipendere produzione e economia dalla presenza di un figurante disegnato.

Non accorpare automaticamente i vecchi slot da combattimento o le routine agricole senza un adapter e regressioni: CANS deve riutilizzare i contratti già validi, non cambiarne silenziosamente significato.

## 14. Skeleton consigliato (fase successiva, NON IMPLEMENTATO)

Percorso incrementale per ridurre rischio e nuove branch:

1. **Inventario adapter:** verificare sorgenti reali su `main` e branch civili/cutaway, censire slot, registri, pathfinding e routine campi esistenti; registrare divergenze.
2. **Modello dati puro:** domain/access/slot/reservation/sequence, ID, invarianti, serialization; nessuna animazione nuova.
3. **Adapter statico pilota:** una taverna o una chiesa con 1 ingresso, pochi arredi e slot reali; ingressi, prenotazioni, entrata/uscita e persist.
4. **Navigazione locale:** grafo deterministico, multi-accesso e aggiornamento incrementale degli arredi; prova sul mercato.
5. **ActivitySequence:** trasferimenti tra postazioni e routine staff/guest; integrazione cutaway senza apparizioni fantasma.
6. **Adapter produttivo:** riusare le traiettorie dei campi e l'attuale ricerca degli alberi; verificare che resa e calendario rimangano identici.
7. **Target dinamici generici:** solo a quel punto preparare interfacce per caccia e pesca; **non** implementare animali/rotte commerciali fuori scope.
8. **Carrier/mobile domain:** integrazione concreta con barche solo quando esiste un sistema nautico verificabile.

Non aprire una branch per ogni adapter o sottosistema: sviluppare lo skeleton CANS unitariamente, con commit tematici e una PR dopo QA. Nessun merge automatico previsto da questa specifica.

## 15. QA e condizioni di accettazione future

Test automatici da predisporre durante lo skeleton:
- Due persone non occupano/prenotano lo stesso slot incompatibile; una persona non lavora in due domini.
- L'occupante lascia una panca e le altre persone mantengono identità e posto.
- Ingresso/uscita con più porte: scegliere un accesso raggiungibile, non attraversare ostacoli.
- Spostamento interno fra due postazioni: prenotazione, transito, liberazione, occupazione senza teletrasporto.
- Modifica arredo: mantenere gli ID e i lavoratori degli slot non coinvolti; disabilitare quelli impossibili.
- Salvataggio/caricamento e cambio cutaway/zoom: nessuna ricreazione di cittadini o ri-generazione immotivata degli slot.
- Bosco: abbattimento/eliminazione target causa selezione nuova; niente path totale a ogni frame.
- Campo: serpentina e fasi di lavoro corrispondono alla routine precedente; stessi risultati economici a pari seed/input.
- Navi: le posizioni relative dei marinai restano stabili mentre il carrier naviga; rotta aggiornata senza nav interna ripetuta.
- Morte, incendio, demolizione, fuga, cambio lavoro e partenza nave rilasciano prenotazioni senza record orfani.
- Vecchi save e sia renderer Canvas sia WebGL2 conservano le meccaniche; test di performance per grandi mercati/boschi.

**Definition of Done**: contratti e adapter verificati contro repository live; regressioni eseguite (distinguendo PASS/FAIL/NON ESEGUITE), nessuna duplicazione economica, save retrocompatibili, performance misurate, documentazione piramide aggiornata secondo [PR-WORKFLOW](context/PR-WORKFLOW.md). La sola pubblicazione di questa specifica non soddisfa questi criteri.

## 16. Questioni progettuali ancora aperte

- Politica precisa delle collisioni tra occupanti nei passaggi stretti; eventuali code al bancone/porte.
- Origine autoritativa delle persone fisiche rispetto a popolazione economica aggregata e figuranti anonimi esistenti.
- Se salvare il grafo completo o ricostruirlo dal layout e dal seed quando il costo è basso.
- Interruzioni di routine, priorità fra guerra/emergenze/lavoro/socialità e ripresa di attività parziali.
- Raggio/percezione per cervi e cacciatori, cooperative work su una stessa risorsa, soglie di ricalcolo.
- Costi e regole della navigazione nautica, bordi mappa, porto/off-map e sistemi reali di carico.
- Regole su riassegnazione slot quando una struttura viene ampliata, ruotata o distrutta.

Tutti questi punti sono **aperti**; non assumere implementazioni arbitrarie nella prima versione.

---

**Fonti interne da rileggere prima dello skeleton:** [CONTEXT PYRAMID](context/README.md), [AGENTS](../AGENTS.md), [Economia](economy.md), [Guida Civil](CIVIL-ANNEX-DEVELOPMENT.md). Questo file documenta il design discusso il 23/10/2026 e non prova la presenza di CANS nel codice.
