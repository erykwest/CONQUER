# Livello 4 — Indice dei requisiti e backlog inter-sistemi

> Raccoglie *idee, requisiti e dipendenze*. Un requisito elencato qui **non prova** assenza né completamento nel software.
> Non duplicare il backlog di 22 feature del Builder già mantenuto in [docs/feature-backlog.md](../feature-backlog.md): quello rimane il riferimento dettagliato per territorio/urbanistica/economia locale/araldica.

## Stato di riferimento al 22/10/2026 — prevale sugli appunti datati

**Audit statico su `main` `c52b537`:** [riconciliazione integrale dei 23 ID Builder, dei 25 S-ID assedio, Clay, feudi, UX e note voice](AUDIT-2026-10-22.md). I requisiti progettuali riportati più sotto **non** vanno letti come assenza del codice; quando una feature è già implementata, il solo lavoro residuo è indicato nell'audit.

- **MAIN già implementato (non ricreare):** P0-01a/03/07; P1-12/13; P2-14/15/16/18/19/20; P3-21/22. Sono su main anche base economia, foreste, industrie, campi, mulini, Built Sections, mercato, incendio, danni, macchine d'assedio e mobilitazione, ma alcune dipendenze sono **PARZIALI**.
- **Integrazioni prioritarie:** PR #55 ancora draft (L1 cantieri e scorte), #61 aperta (danni), #65 aperta (cutaway arredato), #72 aperta **verso `knights`**, #18/#16 draft. Né la presenza di un asset né di una QA equivalgono a meccanica completa o test superato oggi.
- **Clay rettificato:** la cava `clay` entro 6 U dall'acqua, il costo `brick` in argilla, la palette e l'80% degli HP sono **ora presenti su main**, non più solo documentati su `clay`. Rimane da collaudare la catena completa e l'unificazione degli inventari.
- **Assedi:** slot, Mastio, portone separato, danni, propagazione incendio, macchine, terrapieni già hanno codice. **Non risultano dimostrati blocco completo di ogni accesso, resa automatica, IA strategica d'assedio e continuità delle scorte.**
- **P2-17/servizi civici:** taverna e chiesa + annessi hanno già modello, pannello e routine; **l'effetto economico/sociale non è implementato** (il pannello dice "No services or economic effects"). È un task di design/meccanica piccolo, non una nuova modellazione.
- **Lungo periodo invariato:** criminalità/giustizia avanzata, economie multi-feudo, navigazione, varianti regionali, mercato interregionale; non promuoverli a M0–M3.

## Triage su main del 21/10/2026 (snapshot storico)

La [ricognizione dello stato Git](AUDIT-2026-10-21.md) prevale sugli snapshot storici riportati più in basso.

- **FATTO SU MAIN (merge, non accettazione completa):** minimappa/LOD [#44](https://github.com/erykwest/CONQUER/pull/44), pattuglie/lupi/camp [#53](https://github.com/erykwest/CONQUER/pull/53), ciclo solare [#54](https://github.com/erykwest/CONQUER/pull/54), mulini [#57](https://github.com/erykwest/CONQUER/pull/57)/[#58](https://github.com/erykwest/CONQUER/pull/58), terraforming [#63–69](https://github.com/erykwest/CONQUER/pull/69), prestazioni [#70](https://github.com/erykwest/CONQUER/pull/70), **animazioni lavoro con 7 attrezzi** [#71](https://github.com/erykwest/CONQUER/pull/71), terrapieni d'assalto [#73](https://github.com/erykwest/CONQUER/pull/73).
- **IN CORSO / NON MERGE:** **L1 costruttori con lavoro meccanico e scorte reali** + commercio/convogli [#55](https://github.com/erykwest/CONQUER/pull/55); regole danni [#61](https://github.com/erykwest/CONQUER/pull/61); arredi/cutaway [#65](https://github.com/erykwest/CONQUER/pull/65); cavalieri e messaggeri [#72](https://github.com/erykwest/CONQUER/pull/72) su base `knights`.
- **APERTO:** QA browser interattiva, prestazioni picchi GPU e visual QA [#18](https://github.com/erykwest/CONQUER/pull/18); ledger unico/agricoltura; matrimonio danni→accessibilità→assedio/blocco/resa; filiera metallo; sistema feudale completo.
- La presenza di un modulo o di un check non trasforma le righe S-xx in **FATTO**: valutare la sequenza di combattimento completa contro i criteri di accettazione.

## Clay — specifica storica della branch `clay` (19/10); runtime più recente su main

**NOTA STORICA:** il documento progettuale nacque su `Civil/clay` senza runtime; **sullo snapshot main del 22/10 buona parte è implementata** (`settlement-industries.js`, `settlement-core.js`, `settlement-siege.js`, `qa/clay-material-regression.cjs`). La tabella seguente specifica requisiti originali, **non una lista di attività totalmente mancanti**. Contratto completo in [CLAY-DEVELOPMENT](../CLAY-DEVELOPMENT.md) e verifiche in [CLAY-REGRESSION-PLAN](../CLAY-REGRESSION-PLAN.md).

| ID | Requisito | Dipendenze |
|---|---|---|
| CLAY-P0 | Cava con modalità pietra/argilla, idoneità argilla ≤ 6 U da rive di fiumi/torrenti/laghi | industrie, terreno, piazzamento |
| CLAY-P1 | Bene economico `clay` e uso costruttivo in sostituzione di `stone` | ledger, `State.resources`, UI |
| CLAY-P2 | `brick` selezionabile per ogni elemento murario, geometria riusata, palette marrone/terracotta Canvas + WebGL2 | Builder, renderer, save/migration |
| CLAY-P3 | HP max componenti murarie `brick` pari all'80% di `stone`, gate/anta separati | integrità, matrice danni, assedi |
| CLAY-P4 | Suite regressione e test visuali, senza rotture dello skeleton `Civil` | QA economia, placement, save/load |
| CLAY-FUT | Vasellame eventualmente nella Bottega L3; nessuna filiera produttiva obbligatoria ora | futura scelta di scope |

**Verifica 22/10:** CLAY-P0/P1/P2/P3 = **base MAIN**; CLAY-P4 = **QA disponibile, non rieseguita**; CLAY-FUT = **futuro**. Vedi [audit 22/10](AUDIT-2026-10-22.md#b-requisiti-clay--rettifica-di-uno-snapshot-superato).

## Builder, Landscape ed economia (dettaglio esistente)

- **P0-01…08:** orografia; foreste funzionali; Village Core; abitazioni/tier; logging camp; Farm Hub; cava; miniera.
- **P0-01a Terraforming:** **CODICE SU MAIN** dopo integrazioni [#63–69](https://github.com/erykwest/CONQUER/pull/69) e [#73](https://github.com/erykwest/CONQUER/pull/73) per earthworks; restano da verificare i casi visuali e compatibilità con strutture/routing. La nota su `terraforming fa9ef0d` è storica.
- **P1-09…13:** Built Sections; fabbro; mercato; palizzate; ponti.
- **P2-14…20:** fossati, levatoi, basamenti, servizi, araldica SVG e propagazione.
- **P3-21…22:** sette alberi SVG e circa 25 scatter antropici.
- Ogni item è definito con criteri di accettazione in [feature-backlog.md](../feature-backlog.md), non qui.

### Requisiti agricoli di dettaglio

`src/settlement-fields.js` e la sua QA implementano / testano regole concrete: campo quadrilatero Voronoi con lati 1–6 U; slot `floor(area/4)`; serpentina parallela al lato lungo, passo 0,5 U; aratura 1 U × worker/giorno, semina 3 U × worker/giorno; crescita visiva estrusa H 0,1 U e raccolta. Chiarire se le velocità riguardano area, distanza o lavoro economico prima di rifattorizzare la resa.

Confini di lotti e campi: staccionate, muretti e siepi con pesi di progetto **50% / 30% / 20%**; verificare regole esatte per i lati condivisi, varchi e ostacoli fisici. Non trasformare automaticamente decorazioni in collider.

### Asset e ambiente

- Sette famiglie di scatter: carri, merci, segnali, rottami di carri, cataste, agricolo, arredi da lavoro. Distribuzione guidata dal contesto (strade, cantieri, incroci, periferia), non random uniforme.
- Foreste come masse procedurali con varietà di chiome, densità e resa economica; esecuzione e rigenerazione vanno provate.
- Meteo/stagioni, illuminazione, tracce sulla neve e ambientazione sonora come presentazione contestuale, non sistemi economici separati.

## Difesa del castello, presidio e assedio

| ID | Requisito da verificare/sviluppare | Dipende da | Stato conoscitivo |
|---|---|---|---|
| S-01 | Assedio continuo con accelerazione del tempo; attacco diretto o blocco; anche fuori vista | calendario e Simulation tick | PARZIALE MAIN · blocco continuo/fuori vista APERTO |
| S-02 | Scorte, consumi, autonomia, fame e condizioni di resa per entrambi | ledger, granai, magazzini | PARZIALE MAIN · stock e fame sì, resa no |
| S-03 | Uno o più accessi indipendenti, controllo accessi; blocco valido solo quando tutti i collegamenti utili sono isolati | accessibilità, ponti, guardie | PARZIALE MAIN · accessi sì, accerchiamento no |
| S-04 | Campo assedianti, sortite, rinforzi e ritirata degli attaccanti | World + Combat | PARZIALE MAIN · camp sì, sortite/rinforzi no |
| S-05 | **Matrice danni per bersaglio:** attacchi ordinari delle unità e frecce causano **0 danni a mura e torri**; i danni strutturali sono ammessi solo da sorgenti/attacchi esplicitamente compatibili. La torre-porta e il portone sono bersagli distinti con durabilità indipendenti (D-031/D-032). | castle model + Combat | PARZIALE MAIN · matrice presente; #61 OPEN |
| S-06 | Scale, arieti, catapulte, trabucchi e materiali necessari; IA riconosce breach e punti deboli | S-03,S-05 | PARZIALE MAIN · macchine/scale presenti, IA incompleta |
| S-07 | Fuoco, propagazione, spegnimento con acqua/pozzo, rischi di legno e palizzate | fuoco + lavoro/percorsi | MAIN BASE · fuoco e brigata; QA integrazione |
| S-08 | Mastio come attributo di una torre (uno), cerchie difensive rilevate dalla geometria; ripiegamento guarnigione/civili | zone, pathfinding, castle | PARZIALE MAIN · Mastio sì, ritirata completa no |
| S-09 | Hoardings funzionali e caditoie, manutenzione, vulnerabilità a incendi | S-05,S-07 | PARZIALE MAIN · hoardings sì, manutenzione no |
| S-10 | «Piano di Difesa» con upgrade predisposti, materiali, tempi di montaggio e preview | Builder + S-02 | DESIGN · Piano di Difesa da realizzare |
| S-11 | Slot di torri/feritoie/tetto presidiati, priorità archi/balestre, tetti tagliati/cutaway, altezza/visibilità | Built Sections + roster | PARZIALE MAIN · slot arcieri già presenti |
| S-12 | Chiamata alle armi/milizia via armeria, ordine di presidio, rifugio in sala comune | agenti/nav, capienza | PARZIALE MAIN · mobilitazione da integrare |
| S-13 | Danno strutturale per stati: integro → crepe/merlature → breccia/angolo → tetto crollato con ricadute sugli occupanti; **nessuna perdita di HP per colpi ordinari o frecce contro mura/torri** | S-05,S-11 | MAIN BASE · stati danni/crolli; #61 OPEN |
| S-14 | Pattuglie e controllo territoriale; nemici/wildlife con stance neutrale, aggressiva, elusiva e notte | Combat + territorio | MAIN BASE · pattuglie/lupi #53 |
| S-15 | IA di assalto sceglie assalto, attesa, costruzione, blocco, ripiegamento in base a informazioni vere | S-01…S-14 | DESIGN · IA strategica ancora aperta |


### Nuove richieste esplicite — assedio (16 ottobre 2026; triage runtime 22/10)

**Stato originale: IDEA (16/10). Audit 22/10: molte voci dispongono di asset e meccaniche sul main; tabella qui sotto aggiornata per stato conoscitivo, senza certificare la chiusura funzionale.** Le voci seguenti dettagliano S-05 (matrice danni), S-06 (macchine e scale), S-07 (incendi) e S-13 (distruzione localizzata). **Non** sostituiscono i requisiti precedenti; per lo stato attuale consultare l'[audit 22/10](AUDIT-2026-10-22.md).

| ID | Funzionalità richiesta | Dipendenze e criterio minimo da verificare | Stato |
|---|---|---|---|
| **S-16** | **Danni a mura e torri** | S-05, S-13: **attacchi ordinari delle unità e frecce non danneggiano mura né torri (0 HP rimossi)**. Solo sorgenti di danno strutturale compatibili possono degradare i singoli elementi; effetti reali su ostacoli/accessibilità, protezione e presidio. Le animazioni rispecchiano lo stato meccanico. | MAIN BASE · danni selettivi; #61 OPEN |
| **S-17** | **Fuoco** | S-07: uno stato d'incendio condiviso per gli oggetti interessati; propagazione (*fire spread*) determinata da regole di suscettibilità/prossimità; danno nel tempo e possibilità di estinzione. Velocità, intensità, condizioni meteo e materiali sono parametri **da definire**, non già concordati. | MAIN BASE · incendi/propagazione presenti |
| **S-18** | **Mantelletti** | S-06, Combat: protezioni mobili per assedianti contro il tiro difensivo; verificarne ingombro, collocazione, copertura effettiva e interazione con proiettili e incendi. | PARZIALE MAIN · modello mantlet, meccanica da collaudare |
| **S-19** | **Mangani** | S-05, S-06, S-16: macchina da lancio distinta dal trabucco; equipaggio, posizionamento, tiro e impatti che applicano la stessa matrice di danno a strutture e altri bersagli validi. | PARZIALE MAIN · modello mangano; ciclo intero aperto |
| **S-20** | **Trabucchi** | S-05, S-06, S-16: macchina da lancio con comportamento proprio rispetto al mangano; equipaggio, posizionamento, tiro e danni effettivi alle strutture. Differenze di gittata, cadenza, precisione e costo **da bilanciare**. | PARZIALE MAIN · modello trabucco; supply/IA aperte |
| **S-21** | **Torri mobili d'assedio** | S-03, S-06, S-11: movimento e ingombro sul terreno reale; accostamento valido alle mura e accesso delle unità alla sommità solo se effettivamente raggiungibile. | PARZIALE MAIN · torri mobili; IA/trasporto aperti |
| **S-22** | **Arieti scoperti e coperti** | S-03, S-05, S-06, S-25: due varianti dello stesso tipo di macchina, utilizzate da personale e dirette contro il **portone come componente separata** dalla torre-porta; distinguere l'effetto della copertura sulla protezione degli operatori e applicare i danni al bersaglio corretto. | PARZIALE MAIN · ariete porta; varianti e logistica aperte |
| **S-23** | **Scale d'assedio** | S-03, S-06, S-11: posa su tratti di muro compatibili; attraversamento reale per le unità, con difese e collisioni rispettate. | PARZIALE MAIN · scale d'assalto; integrazione IA aperta |
| **S-24** | **Attacchi con fiaccole a strutture civili e porte, con fire spread** | S-07, S-17, S-25: unità attaccanti raggiungono un bersaglio valido (edificio civile o **portone**), innescano un incendio e utilizzano **lo stesso** sistema di propagazione/danno del fuoco. Il danno al portone **non viene attribuito automaticamente alla torre-porta**. | PARZIALE MAIN · torch/fire; ordini end-to-end aperti |

| **S-25** | **Doppia durabilità della porta (torre-porta + portone)** | S-03, S-05, S-16: ogni accesso con torre-porta/portone ha **due valori meccanici indipendenti**: integrità della **torre/struttura** e integrità del **portone**. Un impatto deve identificare il componente colpito e modificare soltanto la relativa durabilità. La perdita della durabilità del portone apre l'accesso secondo le regole di navigazione, **senza azzerare automaticamente quella della torre**. Comportamento in caso di crollo della torre ancora da definire. | MAIN BASE · portone separato; #61 OPEN |

**Regola di danno confermata (16/10/2026):** attacchi normali corpo a corpo delle unità e **frecce** non diminuiscono la durabilità di **mura o torri** (compresa la struttura della torre-porta). Non basta colpire una struttura: l'azione/arma deve essere compatibile con quel bersaglio. Il **portone è un componente differente dalla torre**; la sua vulnerabilità e la tipologia di attacchi ammessi richiedono regole dedicate, senza inferire automaticamente che ogni attacco normale sia efficace. Gli attacchi incendiari con fiaccola già previsti contro il portone passano da S-17/S-24.

**Criteri di accettazione per S-05/S-16/S-25 (da verificare in implementazione):**
1. Un'unità con attacco ordinario colpisce una muratura o una torre: durabilità invariata; una freccia contro gli stessi bersagli: durabilità invariata.
2. Una sorgente **esplicitamente abilitata** ai danni strutturali colpisce una muratura/torre: viene modificato soltanto il componente effettivamente bersagliato.
3. L'accesso con torre-porta espone due durabilità separate: colpire il portone non sottrae HP alla torre; colpire la torre non sottrae HP al portone senza una regola specifica.
4. L'eventuale distruzione del portone modifica attraversabilità e stato del passaggio, non distrugge per ciò stesso la torre-porta.
5. Il medesimo stato meccanico deve essere osservabile dai sistemi di simulazione, combattimento, navigazione e dalle viste Canvas/WebGL2; QA automatica per casi consentiti/vietati e persistenza delle due durabilità.

**Sequenza tecnica proposta (non modifica le priorità M0–M3):** prima danni localizzati a mura/torri (**S-16**) e contratto unico d'incendio (**S-17**); poi fiaccole e propagazione (**S-24**) e ariete/scale (**S-22/23**) per una vertical slice; quindi mantelletti (**S-18**), mangani/trabucchi (**S-19/20**) e torri mobili (**S-21**) secondo le dipendenze di navigazione, proiettili e protezione.

**Vincoli di integrazione:** usare i sistemi già presenti di Castle/Combat, pathfinding, materiali, tick e persistenza; verificare un'unica fonte di danni/incendi e nessuna duplicazione tra renderer WebGL2 e fallback Canvas. Per passare da IDEA a IN CORSO servono specifica delle interazioni, criterio d'accettazione, QA deterministica e branch/commit di riferimento. La pianificazione delle macchine non implica che il motore d'assedio completo sia già operativo.

**Ambito di partenza consigliato:** vertical slice difesa di una fortezza con **una porta + scorte + guarnigione + danno controllato + resa**. Scale/mastio/assedi multi-accesso sono espansioni testabili successive. Le 12 funzioni di Built Sections discusse includono granaio, magazzino materiali, armeria, scuderie, cucine, officina, caserma, alloggi, cappella, sala comune, sala del trono e tesoreria: funzioni negli edifici esistenti, non necessariamente 12 nuovi edifici.

## Economia feudale e mappa del mondo (triage verificato 22/10)

| ID | Requisito | Dipende da | Stato |
|---|---|---|---|
| F-01 | Bioma determina cap/produttività, con correttivo locale; non elimina completamente beni base | M0/M1 | APERTO · biomi visivi già presenti |
| F-02 | Sviluppo di piccoli insediamenti intorno a poli economici e strade | Village Core + produzione | PARZIALE · nuclei urbani sì |
| F-03 | Capitale feudale raccoglie, immagazzina, trasforma e redistribuisce; castello presidia | M1 + stock | PARZIALE · castello/stock locali sì |
| F-04 | Più feudi versano tributi alla capitale del regno e contingenti militari | F-03 | FUTURO · tributi multi-feudo |
| F-05 | Tributi e rifornimenti importanti viaggiano come convogli con inventario e scorta | F-04 + World nav | PR #55/#72 OPEN · non su main |
| F-06 | Intercettazione/imboscata carovana passa al Combat; bottino modifica davvero le scorte | F-05 + Combat stabile | FUTURO · trasferimento World→Combat→stock |
| F-07 | Import/export e mercato inter-feudale, eventi economici, eventuale scarsità/prezzi | F-03 + test | FUTURO · mercato locale già presente |

## Combat / world e comportamento

- **C-01 — Pattuglie:** zone controllate, sorveglianza, rotte e visione sensibili a boschi, dislivelli, costruzioni, ora del giorno.
- **C-02 — Unità e ordini:** spostamenti, formazione/ingombri, accesso alle strutture; combattimento, morale, rotta e rincorsa senza attraversare ostacoli.
- **C-03 — Wildlife:** branchi e posture che cambiano con l'ora; evitare aggressività senza causa in situazioni che richiedono neutralità.
- **C-04 — Mobilitazione:** distinguere guarnigione permanente, cavalieri alloggiati al castello e leva temporanea.
- **C-05 — Accoppiamento simulazione:** eventi World→Combat→World e assedi non visualizzati conservano identico esito delle risorse.

La presenza di `src/settlement-combat.js` prova un prototipo tattico, non tutti questi criteri. **Non importare automaticamente** regole da altri videogiochi/progetti.

## Presentazione, accessibilità, pubblicazione

- **X-01 — Renderer e performance:** modulare logica e disegno, usare SVG/Canvas e cache/culling, mantenendo una fonte sola per coordinate, z e proiezione.
- **X-02 — Illuminazione/stagioni:** **codice su main** per color grading meteorologico/stagionale [PR #43](https://github.com/erykwest/CONQUER/pull/43) e luci emissive WebGL2 [PR #47](https://github.com/erykwest/CONQUER/pull/47); **non ancora convalidato** collegamento tattico tra luce e visibilità (riduzione notturna del raggio: proposta).
- **X-03 — Suoni:** tre canali (ambiente, località/oggetti, eventi) con layer clima/stagioni e giornata; audio locale per selezione **oppure zoom ≥30%**, dissolvenze, attenuazione e limite voci. Il thread [Pixabay/Drive](sources/PIXABAY-SOUNDS-2026-10-14.md) riporta 24 MP3 repertoriati ma non ascoltati; gli asset **non sono nel repository/deployment fino a import verificato**.
- **X-04 — QA visuale:** fixture, più rotazioni camera, controlli di occlusione, verifiche manuali descritte, regressioni automatiche.
- **X-05 — Pubblicazione:** pagina CONQUER, devlog, feedback/follower, donazioni opzionali, itch.io; Steam possibile più avanti.

## Nuovi requisiti documentati negli export 12–15/10

Fonti precise: [ECONOMY](sources/ECONOMY-2026-10-12.md), [VISUAL/AUDIO](sources/VISUAL-AUDIO-2026-10-14.md), [MINIMAP](sources/MINIMAP-2026-10-15.md). I codici seguenti non sono implementazioni automaticamente confermate.

- **E-01 — Economia mista:** confermare nell'end-to-end la proprietà *lord* vs capitale L4 aggregato, compravendita delle imprese e scorte con quota 0/25/50/75/100%; **parziale nel codice**, niente agente contabile individuale.
- **E-02 — Filiera e mercato:** fonti `food/wood/stone/metal/equipment/luxury`, oro valuta; varianti pregiate **tag**, non nuovi contatori obbligatori; export solo con domanda/costi reali; **regole e motore base esistono, catena completa da validare**.
- **E-03 — Tempo e feedback militare:** giorno di lavoro → output reale, mercato sabato, riposo domenica, bilanci annuali; assedio/incursione deve interrompere la produzione senza inventari concorrenti.
- **V-01 — Renderer 3D WebGL2 vs sprite:** **CODICE SU MAIN**: castello/scena [db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697) e default WebGL2 con fallback Canvas [cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0). **RESTANO DA VERIFICARE**: confronti ripetibili su cutaway, stati di cantiere, danni, prestazioni RAM/VRAM, e pipeline finale di asset.
- **V-02 — Cache e prestazioni:** misurare 192 voci bitmap e 32 MiB nominali dei compositi, ora confrontando **WebGL2 3D predefinito e Canvas fallback**; identificare VRAM/RAM, eviction e perf prima di creare loader concorrenti.
- **V-03 — Animazioni lavoro popolani:** **MERGED SU MAIN** con sette utensili e fasi contestuali in [#71](https://github.com/erykwest/CONQUER/pull/71); restano QA visiva/performance e accessori stagionali **PROPOSTA**. Non confondere animazioni con lavoro economico/operai L1 della #55.
- **V-04 — Audio:** streaming musica current+next, SFX e ambience on demand, crossfade, controllo licenze/tracce Suno; **DIREZIONE**, non audio già pubblicato. Fonte SFX distinta: [playlist Pixabay e inventario Drive](sources/PIXABAY-SOUNDS-2026-10-14.md), da verificare file per file.
- **UI-01 — Minimappa + LOD:** **CODICE MERGIATO SU MAIN** il 16/10 via [PR #44](https://github.com/erykwest/CONQUER/pull/44) ([2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9)); **DA VALIDARE** nel browser ISO/plan, rotazioni, selezione, fog, mobile e benchmark. Il Building LOD semplificato è nella minimappa, **non** nel mondo 3D principale.

## Requisiti per promuovere un'idea al lavoro

1. Identificare il *contratto/sistema* già esistente da riutilizzare.
2. Dare ID, proprietario di modulo, milestone, dipendenze, criterio di accettazione e test.
3. Verificare se una branch o PR ne contiene già una parte; indicare **HEAD SHA**.
4. Aggiornare la [roadmap](ROADMAP.md) solo se cambia davvero l'ordine delle priorità.
5. Chiudere soltanto con prova riportata in [STATUS.md](STATUS.md).


## Nota voice — 21 ottobre 2026 — priorità per ciclo giocabile

> Annotazione progettuale, **non implementazione né certificazione QA**. Tenere distinte funzionalità su `main`, PR aperte e test superati.

- **Core loop verticale:** territorio e risorse → popolazione e produzione → cantieri e castello → difesa e assedio → conseguenze persistenti e ricostruzione. Obiettivo: una partita completa, non sottosistemi isolati.
- **P0 economia/cantieri:** riconciliare ledger e `State.resources`, resa e calendario agricolo, assegnazione effettiva L1 ai cantieri (PR #55 aperta nello snapshot), consumo reale di risorse e tempo; impedire completamento senza operai.
- **P0 castello funzionale:** collaudare accessibilità, capienze e stock di Built Sections, magazzini, armerie, presidi e percorsi interni; geometria e accessi devono influire sulla difesa.
- **P0 assedio end-to-end:** collegare danni, terrapieni, accessi, blocco rifornimenti, fame, sortite, ripiegamento verso Mastio, conquista/resa e ricostruzione. Le meccaniche isolate già integrate non equivalgono a un assedio completo.
- **QA estensiva:** simulazione headless multi-seed e pluriennale, test di pathfinding e ricalcolo ostacoli, centinaia di scontri/assedî automatizzati, save/load in ogni stato critico, benchmark WebGL/Canvas e carichi simultanei; monitorare spike GPU rilevati in audit.
- **Design ancora da definire:** condizioni di vittoria/sconfitta, progressione della partita, IA strategica avversaria, leggibilità delle cause nei pannelli, recupero dalle sconfitte.
- **Differenziatori:** castello progettato dal giocatore come campo di battaglia fisicamente significativo; insediamenti che emergono da territorio/lavoro; guerra e assedi con conseguenze economiche persistenti.
- **Scope:** rinviare diplomazia avanzata, filiere lunghe, professioni/materiali aggiuntivi e polish grafico non necessario. Feudi/tributi/carovane solo dopo economia locale stabile.
- **Criterio di demo:** il giocatore sviluppa un insediamento, costruisce e rifornisce una fortezza, affronta un assedio con esito motivato e continua nel mondo modificato.


## Nota voice — ordine pubblico, criminalità e giustizia cittadina

> Proposta di design da valutare, **non implementata**. Trattare le punizioni pubbliche come elemento storico-sociale contestualizzato, non spettacolo grafico.

- **Criminalità urbana:** indicatore locale dinamico, influenzato da povertà, disoccupazione, carestie, densità, ricchezza commerciale, presenza di ronde e capacità di applicare le leggi. Distinguere furti, aggressioni, contrabbando e disordini senza simulare ogni reato individualmente.
- **Effetti economici:** criminalità elevata scoraggia l'insediamento di mercanti e artigiani, riduce afflusso di carovane, entrate fiscali e disponibilità di beni; sicurezza e reputazione commerciale favoriscono il mercato. Prevedere inerzia temporale, non variazioni istantanee.
- **Forze comunali:** introdurre guardie civiche o milizia urbana assegnabile a ronde interne, pattuglie delle porte, presidio del mercato, sorveglianza notturna e intervento su disordini; costo in personale, salari ed equipaggiamento; sottrazione di uomini ad altri incarichi.
- **Ordine pubblico leggibile:** eventi e feedback visibili (furto al mercato, commerciante che rinuncia a stabilirsi, pattuglia che interviene), mappa delle zone a rischio, copertura delle ronde e registro delle decisioni.
- **Giustizia e punizioni pubbliche:** possibilità di tribunale/giudizio cittadino, bandi e ammonimenti, multe, gogna, detenzione e — dove coerente con ambientazione e scelte di design — esecuzioni pubbliche. Rappresentazione sobria e non grafica; preferire evento narrativo/animazione distante, senza dettagli cruenti.
- **Conseguenze e compromessi:** sanzioni possono aumentare deterrenza nel breve periodo, ma repressione eccessiva può diminuire consenso, fiducia e immigrazione; efficacia legata anche a legittimità, proporzionalità e capacità amministrativa. Evitare la regola semplicistica 'più esecuzioni = meno crimine'.
- **Integrazioni:** connettere ordine pubblico a popolani, lavoro, economia, commercio, guardie, allarmi, calendario giorno/notte e reputazione cittadina; non creare un minigioco separato.
- **Priorità:** prima modello aggregato di criminalità, guardie/ronde e impatto sul commercio; poi eventi di giustizia e rappresentazione pubblica. QA con simulazioni su più stagioni e test di equilibrio fra sicurezza, costo delle guardie e prosperità.


## Nota voice — filiera alimentare, colture e foraggio invernale

> Proposta progettuale da valutare, **non implementata**.

- **Risorsa cibo articolata:** mantenere `cibo` come categoria aggregata per i bisogni alimentari, distinguendo sotto-risorse **carne, pesce, cereali e ortaggi**. Conservare quantità e disponibilità delle singole categorie per produzione, stoccaggio, consumo e commercio.
- **Colture e raccolto:** i campi producono una risorsa agricola grezza (`crop`/raccolto), distinta dal prodotto alimentare trasformato. Definire per tipo di coltura la destinazione: cereali per alimentazione, foraggio per animali, eventuale semina futura; non assumere che ogni raccolto richieda molitura.
- **Mulino:** introdurre una trasformazione esplicita per i raccolti cerealicoli destinati al consumo umano (raccolto grezzo → prodotto macinato/farina, oppure cereali alimentari secondo la nomenclatura finale), con resa, capacità e tempi di lavoro. La macinazione non deve essere obbligatoria per il foraggio.
- **Pascoli e allevamento:** durante la stagione favorevole il bestiame può pascolare all'aperto; durante l'inverno resta nei recinti/lotti/stalle e consuma scorte di `crop` grezzo destinato a **foraggio**, senza passare dal mulino.
- **Scorte stagionali:** bilanciare raccolto, consumo umano, mangime animale e riserva per semina. Se il foraggio non basta, conseguenze su salute, mortalità e produttività degli animali; impatto successivo sulla disponibilità di carne e altri prodotti zootecnici.
- **Dipendenze:** integrare campi, calendario e inverno, magazzini, mulini, allevamenti, consumo popolazione, mercato e ledger economico unico. Evitare duplicazione tra risorse visuali e contabili.
- **Test richiesti:** simulazioni multianno di semina/raccolta, capacità di molitura, approvvigionamento alimentare e sopravvivenza del bestiame durante inverni lunghi; verificare che i cicli siano sostenibili senza microgestione eccessiva.


## Nota voice — controlli DEV e progressione visiva dei cantieri

> Richieste di sviluppo, **non ancora implementate**. I toggle DEV non devono alterare le regole delle partite normali.

- **DEV — Instant Build:** pulsante/toggle per completare immediatamente cantieri e strutture durante i test, senza attesa del tempo di costruzione; deve valere anche per le stanze e gli allestimenti interni del castello.
- **DEV — No Resource Consumption:** secondo pulsante/toggle indipendente per disattivare il consumo delle risorse durante costruzioni, ampliamenti e allestimenti; combinabile con Instant Build per test rapidi.
- **Tempi di costruzione reali:** le stanze del castello e i loro allestimenti, attualmente istantanei secondo la segnalazione, devono entrare nel normale sistema dei cantieri con durata, costo e requisiti di lavoro, coerenti con le altre strutture.
- **Progressione visiva universale:** tutte le categorie di edifici, sia del giocatore sia delle altre fazioni/insediamenti, devono mostrare fasi costruttive progressive legate all'avanzamento effettivo, non un modello completo che appare alla fine.
- **Elementi di cantiere animati:** impalcature e ponteggi, gru, carrucole, sollevamento e posa di materiali, lavoratori e attrezzi; comparsa/rimozione per fase e tipologia di edificio, senza animazioni scollegate dallo stato reale del cantiere.
- **Integrazione e QA:** sincronizzare percentuale di avanzamento, geometria, operai assegnati e risorse effettivamente spese; verificare che i due toggle DEV funzionino separatamente e insieme, non contaminino i salvataggi normali e permettano il ripristino della simulazione standard.


## Nota voice — tempi di scavo per terraforming e fossati

> Requisito progettuale da implementare; **non indica funzionalità già completata**.

- **Terraforming non istantaneo:** ogni modifica del terreno richiede un tempo di lavoro/scavo proporzionato all'entità dell'intervento; applicare la stessa logica ai **fossati**, oggi segnalati senza tempi di realizzazione.
- **Nessun consumo di risorse materiali:** il terraforming non deve consumare legno, pietra, metallo o altre risorse economiche; il suo costo fondamentale è il **tempo**, deliberatamente elevato.
- **Forte disincentivo alle modifiche estese:** rendere molto onerosi temporalmente scavi e rimodellamenti massicci, così da favorire interventi mirati a rinforzare, proteggere o adattare posizioni strategiche, invece di riscrivere liberamente il paesaggio.
- **Avanzamento effettivo:** collegare la durata a volume di terra movimentata, estensione/profondità e disponibilità di lavoratori, in coerenza con il sistema cantieri; mostrare lo scavo in fasi progressive, senza completamento istantaneo nella partita ordinaria.
- **Modalità DEV:** `Instant Build` può saltare l'attesa per test; `No Resource Consumption` non modifica i tempi di scavo, dato che il terraforming non consuma materiali già di suo.
- **QA:** verificare durata e proporzionalità per fossati piccoli/grandi e lavori di terra, sospensione/ripresa dei cantieri, save/load, navigabilità e aggiornamento delle difese durante e dopo lo scavo.


## Nota voice — meteo con effetti reali su cantieri e lavoratori

> Requisito progettuale da sviluppare, **non implementazione confermata**.

- **Meteo simulato:** condizioni meteorologiche variabili (sereno, pioggia, pioggia intensa, neve, gelo, vento forte) con durata e stagionalità, collegate al calendario già presente.
- **Impatto prioritario sui cantieri:** il maltempo deve **rallentare l'avanzamento effettivo** delle costruzioni e prolungare i tempi di completamento, senza limitarsi a effetti grafici. Intensità e tipo di fenomeno determinano penalità differenti; eventi estremi possono sospendere temporaneamente specifici lavori all'aperto.
- **Lavoratori:** produttività ridotta per attività esterne durante condizioni avverse, distinguendo dove utile i lavori al coperto da quelli esposti; evitare di penalizzare indiscriminatamente tutte le professioni.
- **Terraforming e fossati:** scavi esposti particolarmente sensibili a piogge intense, gelo e neve, sommando l'impatto meteorologico ai tempi già volutamente elevati.
- **Feedback al giocatore:** mostrare causa e peso del rallentamento nei pannelli del cantiere (es. `Rallentato dalla pioggia`) e aggiornare le stime di completamento in modo comprensibile.
- **Modalità DEV:** `Instant Build` deve permettere test immediati anche con meteo avverso; in partita normale il meteo incide sempre sulla produttività.
- **QA/bilanciamento:** simulare cantieri in tutte le stagioni e condizioni, verificare accumulo corretto dell'avanzamento, pause/riprese, salvataggi e assenza di blocchi permanenti; evitare che il clima renda impossibile la progressione.


## Nota voice — spedizioni militari, convogli di rifornimento e accampamenti d'assedio

> Proposta progettuale da sviluppare, **non implementazione confermata**. Riutilizzare dove possibile il sistema esistente di accampamento notturno delle truppe.

- **Invio di contingenti:** introdurre una meccanica per organizzare e spedire contingenti militari fuori dall'insediamento, con destinazione, percorso, composizione, tempi di marcia e ordini di missione, inclusi attacco e assedio.
- **Carri di rifornimento:** consentire carri logistici che accompagnano le colonne militari, trasportando provviste e materiali; scorte finite, consumo durante marcia e permanenza, possibilità di rifornimento e vulnerabilità dei convogli.
- **Due modalità di campo:** distinguere l'**accampamento notturno automatico**, temporaneo e leggero, da un **accampamento militare persistente** che il comandante attaccante può scegliere di insediare vicino all'obiettivo e mantenere durante un assedio.
- **Campo d'assedio costruibile:** offrire un sottoinsieme deliberatamente limitato del Builder: tende/zone di riposo, area deposito e carri, **palizzate leggere**, **torri di avvistamento** e pochi accessi difensivi. Non replicare l'intero catalogo di edifici e fortificazioni del castello.
- **Costruzione e vincoli:** realizzazione progressiva con tempo, lavoratori/soldati assegnati e materiali trasportati o reperiti; la posizione e il perimetro del campo influiscono su visibilità, sicurezza, percorsi e capacità di lanciare attacchi.
- **Assedio integrato:** il campo persistente diventa base operativa dell'attaccante per presidiare il territorio, organizzare sortite/assalti, accumulare rifornimenti e mantenere un blocco; il difensore può tentare incursioni contro campo e carri, interrompendo la logistica.
- **Persistenza e UX:** il campo resta finché non viene smantellato, abbandonato o distrutto; distinguere chiaramente nel comando UI 'bivacco notturno' da 'stabilisci campo d'assedio'.
- **QA:** testare spedizioni, consumo scorte, continuità dei carri, costruzione delle difese leggere, pathfinding di grandi colonne, assalti/sortite, interruzione rifornimenti e save/load durante assedi lunghi.


## Nota voice — navigazione mercantile e militare (orizzonte futuro)

> **Backlog di lungo periodo**, non priorità per il ciclo giocabile attuale; nessuna implementazione richiesta ora.

- **Navi mercantili:** prima versione navale orientata a trasporto e commercio, riutilizzando per quanto possibile le dinamiche logistiche già previste per i carri (carico, scorte, itinerario, trasferimento di risorse, destinazioni, rischio/intercettazione). Capacità indicativa di **circa dieci carri per nave**, valore iniziale da bilanciare.
- **Vincoli di navigazione:** porti e punti d'imbarco/sbarco, percorsi sull'acqua, tempi di viaggio, capacità di carico e collegamento al sistema economico; preferire una prima iterazione senza combattimento navale.
- **Navi militarizzate:** evoluzione successiva con **baliste** imbarcate e trasporto di truppe, inclusi **arcieri e fanti**; imbarco/sbarco, spazio disponibile e supporto alle operazioni militari costiere.
- **Combattimento navale:** riconosciuto come sottosistema complesso (movimento, ingaggi, armi di bordo, unità trasportate e possibile abbordaggio). Rimandare progettazione dettagliata e implementazione a una fase successiva, evitando che blocchi economia, cantieri e assedi terrestri.
- **Sequenza suggerita:** commercio marittimo e navi-cargo → trasporto truppe → armamento e scontri navali. Testare a ogni fase la compatibilità con convogli terrestri, risorse e persistenza.


## Nota voice — varianti regionali e commercio interregionale (lungo periodo)

> **Visione di lungo periodo, non implementata.** Distinguere quattro ambientazioni/istanze di gioco da quattro server fisici: l'eventuale architettura di hosting va decisa solo in seguito, in base a necessità reali.

- **Core comune:** mantenere un unico motore e le medesime meccaniche di base, variando anzitutto asset, materiali, architetture, vegetazione e atmosfera per area geografico-culturale; introdurre solo in seguito differenze leggere di produzione e disponibilità delle risorse.
- **Ambito regionale:** attuale riferimento visivo **Europa centrale**; possibile variante **Europa mediterranea** (Italia/Spagna, già in parte suggerita dagli edifici in `clay`); possibile variante **area araba/mediorientale** con proprio repertorio edilizio e ambientale. La proposta cita **quattro istanze principali**, ma definisce per ora solo tre ambiti: **quarta regione da definire**, senza inventarla.
- **Beni locali ed esotici:** valutare produzione regionale di **vino** e altri beni distintivi, oltre a merci importate come **spezie** e vini di altre regioni; le merci esotiche possono esistere inizialmente solo come prodotti di commercio, senza richiedere una filiera locale completa.
- **Geografia commerciale:** attribuire rilevanza alle rotte marittime e ai collegamenti verso regioni/climi più settentrionali o meridionali; disponibilità, prezzo e convenienza dei beni dipendono da provenienza, accessibilità e trasporto.
- **Architettura e scope:** preferire configurazioni/data pack regionali sopra una simulazione condivisa, evitando quattro fork divergenti del codice. Prima consolidare economia, trasporti e gameplay locale; poi introdurre asset regionali, mercati interregionali e infine eventuali piccole differenze meccaniche.


## Nota voice — revisione urgente pannelli amministrativi e dashboard storiche

> **Priorità alta, richiesta di sviluppo; non ancora implementata.** I grafici devono rappresentare dati reali della simulazione, non valori fittizi.

- **Riorganizzazione pannelli amministrativi:** dashboard leggibili, ispirate ai gestionali strategici, per comprendere rapidamente stato, cause e tendenze dell'insediamento.
- **Economia nel tempo:** grafici storici dei flussi di produzione, consumo, importazioni, esportazioni, scorte, entrate e uscite; evidenziare surplus, deficit e colli di bottiglia per risorsa.
- **Mercato:** andamento nel tempo dei prezzi delle singole merci, disponibilità, domanda/offerta e oscillazioni; distinguere chiaramente prezzo attuale e storico e spiegare quando la variazione è dovuta a carenza o abbondanza.
- **Popolazione:** andamento pluriennale della popolazione con nascite, morti, immigrazione/emigrazione e, se già disponibili nella simulazione, categorie sociali/lavorative; visualizzare crescita o declino e relative cause.
- **Interazione e leggibilità:** filtri per risorsa e periodo, scale temporali coerenti con calendario del gioco, tooltip e indicatori sintetici con collegamento ai dettagli.
- **Prerequisito tecnico:** verificare quali serie storiche esistono davvero; aggiungere raccolta periodica e persistenza di snapshot aggregati solo dove mancano, usando un unico ledger economico affidabile. Evitare grafici che inventino storico o prezzi in assenza di meccaniche reali.
- **QA e prestazioni:** confrontare valori dei grafici con stato effettivo della simulazione, testare salvataggio/caricamento e anni multipli, mantenere basso il costo di aggiornamento UI.
- **Sequenza suggerita:** prima pannelli economia/mercato/popolazione con serie disponibili, poi approfondimenti e strumenti di confronto; la complessità UI può essere contenuta, ma va verificata la disponibilità dei dati storici.


## Nota voice — abbigliamento stagionale e meteo degli abitanti

> Proposta estetico-funzionale da sviluppare; **non implementata**.

- **Skin stagionali dei popolani:** in inverno usare pelli, tuniche pesanti e mantelli; in estate cappelli di paglia e tuniche corte/leggere.
- **Pioggia:** aggiungere mantelli antipioggia o coperture appropriate durante le precipitazioni, indipendentemente dalla stagione.
- **Selezione automatica:** variare l'abbigliamento in funzione di stagione, temperatura e meteo corrente, senza richiedere microgestione al giocatore; conservare ruolo e riconoscibilità del personaggio.
- **Integrazione grafica:** riutilizzare animazioni e scheletri esistenti, prevedendo varianti di equipaggiamento/overlay compatibili con movimento e lavoro; evitare cambi istantanei visivamente incoerenti se possibile.
- **Priorità e QA:** miglioramento visivo successivo alla meccanica del meteo; verificare performance con molti abitanti, corrette transizioni stagionali e nessuna interferenza con divise/attrezzi professionali.


## Nota voice — overlay DEV FPS e grafico prestazioni (30 secondi)

> Funzionalità richiesta per il backlog; **non implementata**.

- **Overlay in gioco:** visualizzare in alto a sinistra un contatore FPS aggiornato in tempo reale e un piccolo grafico scorrevole degli **ultimi 30 secondi**.
- **Controllo DEV:** aggiungere un toggle nel pannello DEV per mostrare/nascondere l'overlay senza riavviare la partita; disattivabile per non interferire con l'interfaccia ordinaria.
- **Rilevazione lag:** rendere evidenti cali improvvisi di FPS e picchi di frame time; privilegiare una traccia dei tempi per frame (ms) oppure affiancarla agli FPS per distinguere meglio gli spike.
- **Impatto minimo:** campionamento e rendering dell'overlay leggeri, buffer temporale limitato a 30 secondi e nessun costo significativo quando disattivato.
- **QA:** verificare accuratezza, comportamento in pausa e a differenti frame rate, corretto reset della finestra temporale e funzionamento su renderer supportati.
