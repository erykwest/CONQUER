# Livello 4 — Indice dei requisiti e backlog inter-sistemi

> Raccoglie *idee, requisiti e dipendenze*. Un requisito elencato qui **non prova** assenza né completamento nel software.
> Non duplicare il backlog di 22 feature del Builder già mantenuto in [docs/feature-backlog.md](../feature-backlog.md): quello rimane il riferimento dettagliato per territorio/urbanistica/economia locale/araldica.

## Builder, Landscape ed economia (dettaglio esistente)

- **P0-01…08:** orografia; foreste funzionali; Village Core; abitazioni/tier; logging camp; Farm Hub; cava; miniera.
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
| S-05 | Matrice danni arma/materiale/struttura (evitare spade vs pietra); HP e distruzione localizzata | castle model | DESIGN |
| S-06 | Scale, arieti, catapulte, trabucchi e materiali necessari; IA riconosce breach e punti deboli | S-03,S-05 | DESIGN |
| S-07 | Fuoco, propagazione, spegnimento con acqua/pozzo, rischi di legno e palizzate | fuoco + lavoro/percorsi | DESIGN |
| S-08 | Mastio come attributo di una torre (uno), cerchie difensive rilevate dalla geometria; ripiegamento guarnigione/civili | zone, pathfinding, castle | DESIGN |
| S-09 | Hoardings funzionali e caditoie, manutenzione, vulnerabilità a incendi | S-05,S-07 | DESIGN |
| S-10 | «Piano di Difesa» con upgrade predisposti, materiali, tempi di montaggio e preview | Builder + S-02 | DESIGN |
| S-11 | Slot di torri/feritoie/tetto presidiati, priorità archi/balestre, tetti tagliati/cutaway, altezza/visibilità | Built Sections + roster | DESIGN |
| S-12 | Chiamata alle armi/milizia via armeria, ordine di presidio, rifugio in sala comune | agenti/nav, capienza | DESIGN |
| S-13 | Danno strutturale per stati: integro → crepe/merlature → breccia/angolo → tetto crollato con ricadute sugli occupanti | S-05,S-11 | DESIGN |
| S-14 | Pattuglie e controllo territoriale; nemici/wildlife con stance neutrale, aggressiva, elusiva e notte | Combat + territorio | PROPOSTA |
| S-15 | IA di assalto sceglie assalto, attesa, costruzione, blocco, ripiegamento in base a informazioni vere | S-01…S-14 | DESIGN |


### Nuove richieste esplicite — assedio (16 ottobre 2026)

**Stato: IDEA / da progettare e implementare.** Le voci seguenti dettagliano S-05 (matrice danni), S-06 (macchine e scale), S-07 (incendi) e S-13 (distruzione localizzata). **Non** sono nuove implementazioni accertate, e non sostituiscono i requisiti precedenti.

| ID | Funzionalità richiesta | Dipendenze e criterio minimo da verificare | Stato |
|---|---|---|---|
| **S-16** | **Danni a mura e torri** | S-05, S-13: danno ai singoli elementi costruttivi; degrado della struttura e conseguenze reali su ostacoli/accessibilità, protezione e presidio. Effetti grafici collegati allo stato meccanico, non solo animazioni. | IDEA |
| **S-17** | **Fuoco** | S-07: uno stato d'incendio condiviso per gli oggetti interessati; propagazione (*fire spread*) determinata da regole di suscettibilità/prossimità; danno nel tempo e possibilità di estinzione. Velocità, intensità, condizioni meteo e materiali sono parametri **da definire**, non già concordati. | IDEA |
| **S-18** | **Mantelletti** | S-06, Combat: protezioni mobili per assedianti contro il tiro difensivo; verificarne ingombro, collocazione, copertura effettiva e interazione con proiettili e incendi. | IDEA |
| **S-19** | **Mangani** | S-05, S-06, S-16: macchina da lancio distinta dal trabucco; equipaggio, posizionamento, tiro e impatti che applicano la stessa matrice di danno a strutture e altri bersagli validi. | IDEA |
| **S-20** | **Trabucchi** | S-05, S-06, S-16: macchina da lancio con comportamento proprio rispetto al mangano; equipaggio, posizionamento, tiro e danni effettivi alle strutture. Differenze di gittata, cadenza, precisione e costo **da bilanciare**. | IDEA |
| **S-21** | **Torri mobili d'assedio** | S-03, S-06, S-11: movimento e ingombro sul terreno reale; accostamento valido alle mura e accesso delle unità alla sommità solo se effettivamente raggiungibile. | IDEA |
| **S-22** | **Arieti scoperti e coperti** | S-03, S-05, S-06: due varianti dello stesso tipo di macchina, utilizzate da personale e dirette contro porte/accessi; distinguere l'effetto della copertura sulla protezione degli operatori, mantenendo regole di danno comuni. | IDEA |
| **S-23** | **Scale d'assedio** | S-03, S-06, S-11: posa su tratti di muro compatibili; attraversamento reale per le unità, con difese e collisioni rispettate. | IDEA |
| **S-24** | **Attacchi con fiaccole a strutture civili e porte, con fire spread** | S-07, S-17: unità attaccanti raggiungono un bersaglio valido (edificio civile o porta), innescano un incendio e utilizzano **lo stesso** sistema di propagazione/danno del fuoco, senza un secondo motore separato. | IDEA |

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
- **V-03 — Animazioni lavoro popolani:** mani/attrezzi modulari condizionati dall'attività reale, accessori stagionali solo quando utili e vicini; **PROPOSTA**.
- **V-04 — Audio:** streaming musica current+next, SFX e ambience on demand, crossfade, controllo licenze/tracce Suno; **DIREZIONE**, non audio già pubblicato. Fonte SFX distinta: [playlist Pixabay e inventario Drive](sources/PIXABAY-SOUNDS-2026-10-14.md), da verificare file per file.
- **UI-01 — Minimappa + LOD:** **CODICE MERGIATO SU MAIN** il 16/10 via [PR #44](https://github.com/erykwest/CONQUER/pull/44) ([2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9)); **DA VALIDARE** nel browser ISO/plan, rotazioni, selezione, fog, mobile e benchmark. Il Building LOD semplificato è nella minimappa, **non** nel mondo 3D principale.

## Requisiti per promuovere un'idea al lavoro

1. Identificare il *contratto/sistema* già esistente da riutilizzare.
2. Dare ID, proprietario di modulo, milestone, dipendenze, criterio di accettazione e test.
3. Verificare se una branch o PR ne contiene già una parte; indicare **HEAD SHA**.
4. Aggiornare la [roadmap](ROADMAP.md) solo se cambia davvero l'ordine delle priorità.
5. Chiudere soltanto con prova riportata in [STATUS.md](STATUS.md).
