# Livello 4 — Indice dei requisiti e backlog inter-sistemi

> Raccoglie *idee, requisiti e dipendenze*. Un requisito elencato qui **non prova** assenza né completamento nel software.
> Non duplicare il backlog di 22 feature del Builder già mantenuto in [docs/feature-backlog.md](../feature-backlog.md): quello rimane il riferimento dettagliato per territorio/urbanistica/economia locale/araldica.

## Triage su main del 21/10/2026

La [ricognizione dello stato Git](AUDIT-2026-10-21.md) prevale sugli snapshot storici riportati più in basso.

- **FATTO SU MAIN (merge, non accettazione completa):** minimappa/LOD [#44](https://github.com/erykwest/CONQUER/pull/44), pattuglie/lupi/camp [#53](https://github.com/erykwest/CONQUER/pull/53), ciclo solare [#54](https://github.com/erykwest/CONQUER/pull/54), mulini [#57](https://github.com/erykwest/CONQUER/pull/57)/[#58](https://github.com/erykwest/CONQUER/pull/58), terraforming [#63–69](https://github.com/erykwest/CONQUER/pull/69), prestazioni [#70](https://github.com/erykwest/CONQUER/pull/70), **animazioni lavoro con 7 attrezzi** [#71](https://github.com/erykwest/CONQUER/pull/71), terrapieni d'assalto [#73](https://github.com/erykwest/CONQUER/pull/73).
- **IN CORSO / NON MERGE:** **L1 costruttori con lavoro meccanico e scorte reali** + commercio/convogli [#55](https://github.com/erykwest/CONQUER/pull/55); regole danni [#61](https://github.com/erykwest/CONQUER/pull/61); arredi/cutaway [#65](https://github.com/erykwest/CONQUER/pull/65); cavalieri e messaggeri [#72](https://github.com/erykwest/CONQUER/pull/72) su base `knights`.
- **APERTO:** QA browser interattiva, prestazioni picchi GPU e visual QA [#18](https://github.com/erykwest/CONQUER/pull/18); ledger unico/agricoltura; matrimonio danni→accessibilità→assedio/blocco/resa; filiera metallo; sistema feudale completo.
- La presenza di un modulo o di un check non trasforma le righe S-xx in **FATTO**: valutare la sequenza di combattimento completa contro i criteri di accettazione.

## Clay — nuove murature e argilla (branch `clay`, 19/10/2026)

**DESIGN, NON IMPLEMENTATO.** Lavoro di documentazione derivato da `Civil`, senza modifiche runtime. Contratto completo in [CLAY-DEVELOPMENT](../CLAY-DEVELOPMENT.md) e verifiche in [CLAY-REGRESSION-PLAN](../CLAY-REGRESSION-PLAN.md).

| ID | Requisito | Dipendenze |
|---|---|---|
| CLAY-P0 | Cava con modalità pietra/argilla, idoneità argilla ≤ 6 U da rive di fiumi/torrenti/laghi | industrie, terreno, piazzamento |
| CLAY-P1 | Bene economico `clay` e uso costruttivo in sostituzione di `stone` | ledger, `State.resources`, UI |
| CLAY-P2 | `brick` selezionabile per ogni elemento murario, geometria riusata, palette marrone/terracotta Canvas + WebGL2 | Builder, renderer, save/migration |
| CLAY-P3 | HP max componenti murarie `brick` pari all'80% di `stone`, gate/anta separati | integrità, matrice danni, assedi |
| CLAY-P4 | Suite regressione e test visuali, senza rotture dello skeleton `Civil` | QA economia, placement, save/load |
| CLAY-FUT | Vasellame eventualmente nella Bottega L3; nessuna filiera produttiva obbligatoria ora | futura scelta di scope |

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
| S-01 | Assedio continuo con accelerazione del tempo; attacco diretto o blocco; anche fuori vista | calendario e Simulation tick | DESIGN |
| S-02 | Scorte, consumi, autonomia, fame e condizioni di resa per entrambi | ledger, granai, magazzini | DESIGN |
| S-03 | Uno o più accessi indipendenti, controllo accessi; blocco valido solo quando tutti i collegamenti utili sono isolati | accessibilità, ponti, guardie | DESIGN |
| S-04 | Campo assedianti, sortite, rinforzi e ritirata degli attaccanti | World + Combat | DESIGN |
| S-05 | **Matrice danni per bersaglio:** attacchi ordinari delle unità e frecce causano **0 danni a mura e torri**; i danni strutturali sono ammessi solo da sorgenti/attacchi esplicitamente compatibili. La torre-porta e il portone sono bersagli distinti con durabilità indipendenti (D-031/D-032). | castle model + Combat | DESIGN / VINCOLO |
| S-06 | Scale, arieti, catapulte, trabucchi e materiali necessari; IA riconosce breach e punti deboli | S-03,S-05 | DESIGN |
| S-07 | Fuoco, propagazione, spegnimento con acqua/pozzo, rischi di legno e palizzate | fuoco + lavoro/percorsi | DESIGN |
| S-08 | Mastio come attributo di una torre (uno), cerchie difensive rilevate dalla geometria; ripiegamento guarnigione/civili | zone, pathfinding, castle | DESIGN |
| S-09 | Hoardings funzionali e caditoie, manutenzione, vulnerabilità a incendi | S-05,S-07 | DESIGN |
| S-10 | «Piano di Difesa» con upgrade predisposti, materiali, tempi di montaggio e preview | Builder + S-02 | DESIGN |
| S-11 | Slot di torri/feritoie/tetto presidiati, priorità archi/balestre, tetti tagliati/cutaway, altezza/visibilità | Built Sections + roster | DESIGN |
| S-12 | Chiamata alle armi/milizia via armeria, ordine di presidio, rifugio in sala comune | agenti/nav, capienza | DESIGN |
| S-13 | Danno strutturale per stati: integro → crepe/merlature → breccia/angolo → tetto crollato con ricadute sugli occupanti; **nessuna perdita di HP per colpi ordinari o frecce contro mura/torri** | S-05,S-11 | DESIGN / VINCOLO |
| S-14 | Pattuglie e controllo territoriale; nemici/wildlife con stance neutrale, aggressiva, elusiva e notte | Combat + territorio | PROPOSTA |
| S-15 | IA di assalto sceglie assalto, attesa, costruzione, blocco, ripiegamento in base a informazioni vere | S-01…S-14 | DESIGN |


### Nuove richieste esplicite — assedio (16 ottobre 2026)

**Stato: IDEA / da progettare e implementare.** Le voci seguenti dettagliano S-05 (matrice danni), S-06 (macchine e scale), S-07 (incendi) e S-13 (distruzione localizzata). **Non** sono nuove implementazioni accertate, e non sostituiscono i requisiti precedenti.

| ID | Funzionalità richiesta | Dipendenze e criterio minimo da verificare | Stato |
|---|---|---|---|
| **S-16** | **Danni a mura e torri** | S-05, S-13: **attacchi ordinari delle unità e frecce non danneggiano mura né torri (0 HP rimossi)**. Solo sorgenti di danno strutturale compatibili possono degradare i singoli elementi; effetti reali su ostacoli/accessibilità, protezione e presidio. Le animazioni rispecchiano lo stato meccanico. | IDEA / VINCOLO |
| **S-17** | **Fuoco** | S-07: uno stato d'incendio condiviso per gli oggetti interessati; propagazione (*fire spread*) determinata da regole di suscettibilità/prossimità; danno nel tempo e possibilità di estinzione. Velocità, intensità, condizioni meteo e materiali sono parametri **da definire**, non già concordati. | IDEA |
| **S-18** | **Mantelletti** | S-06, Combat: protezioni mobili per assedianti contro il tiro difensivo; verificarne ingombro, collocazione, copertura effettiva e interazione con proiettili e incendi. | IDEA |
| **S-19** | **Mangani** | S-05, S-06, S-16: macchina da lancio distinta dal trabucco; equipaggio, posizionamento, tiro e impatti che applicano la stessa matrice di danno a strutture e altri bersagli validi. | IDEA |
| **S-20** | **Trabucchi** | S-05, S-06, S-16: macchina da lancio con comportamento proprio rispetto al mangano; equipaggio, posizionamento, tiro e danni effettivi alle strutture. Differenze di gittata, cadenza, precisione e costo **da bilanciare**. | IDEA |
| **S-21** | **Torri mobili d'assedio** | S-03, S-06, S-11: movimento e ingombro sul terreno reale; accostamento valido alle mura e accesso delle unità alla sommità solo se effettivamente raggiungibile. | IDEA |
| **S-22** | **Arieti scoperti e coperti** | S-03, S-05, S-06, S-25: due varianti dello stesso tipo di macchina, utilizzate da personale e dirette contro il **portone come componente separata** dalla torre-porta; distinguere l'effetto della copertura sulla protezione degli operatori e applicare i danni al bersaglio corretto. | IDEA |
| **S-23** | **Scale d'assedio** | S-03, S-06, S-11: posa su tratti di muro compatibili; attraversamento reale per le unità, con difese e collisioni rispettate. | IDEA |
| **S-24** | **Attacchi con fiaccole a strutture civili e porte, con fire spread** | S-07, S-17, S-25: unità attaccanti raggiungono un bersaglio valido (edificio civile o **portone**), innescano un incendio e utilizzano **lo stesso** sistema di propagazione/danno del fuoco. Il danno al portone **non viene attribuito automaticamente alla torre-porta**. | IDEA |

| **S-25** | **Doppia durabilità della porta (torre-porta + portone)** | S-03, S-05, S-16: ogni accesso con torre-porta/portone ha **due valori meccanici indipendenti**: integrità della **torre/struttura** e integrità del **portone**. Un impatto deve identificare il componente colpito e modificare soltanto la relativa durabilità. La perdita della durabilità del portone apre l'accesso secondo le regole di navigazione, **senza azzerare automaticamente quella della torre**. Comportamento in caso di crollo della torre ancora da definire. | IDEA / VINCOLO |

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

## Economia feudale e mappa del mondo

| ID | Requisito | Dipende da | Stato |
|---|---|---|---|
| F-01 | Bioma determina cap/produttività, con correttivo locale; non elimina completamente beni base | M0/M1 | DESIGN |
| F-02 | Sviluppo di piccoli insediamenti intorno a poli economici e strade | Village Core + produzione | DESIGN |
| F-03 | Capitale feudale raccoglie, immagazzina, trasforma e redistribuisce; castello presidia | M1 + stock | DESIGN |
| F-04 | Più feudi versano tributi alla capitale del regno e contingenti militari | F-03 | DESIGN |
| F-05 | Tributi e rifornimenti importanti viaggiano come convogli con inventario e scorta | F-04 + World nav | DESIGN |
| F-06 | Intercettazione/imboscata carovana passa al Combat; bottino modifica davvero le scorte | F-05 + Combat stabile | DESIGN |
| F-07 | Import/export e mercato inter-feudale, eventi economici, eventuale scarsità/prezzi | F-03 + test | FUTURO |

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
