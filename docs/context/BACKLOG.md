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
- **X-02 — Illuminazione/stagioni:** tenere realismo atmosferico coerente con ciclo di gioco e visibilità tattica (riduzione notturna del raggio: proposta da validare).
- **X-03 — Suoni:** loop ambientali variabili; elementi specifici alla selezione o sopra zoom 30%; dissolvenze e limite voci. Gli asset sono esterni a questa repository fino a import esplicito.
- **X-04 — QA visuale:** fixture, più rotazioni camera, controlli di occlusione, verifiche manuali descritte, regressioni automatiche.
- **X-05 — Pubblicazione:** pagina CONQUER, devlog, feedback/follower, donazioni opzionali, itch.io; Steam possibile più avanti.

## Nuovi requisiti documentati negli export 12–15/10

Fonti precise: [ECONOMY](sources/ECONOMY-2026-10-12.md), [VISUAL/AUDIO](sources/VISUAL-AUDIO-2026-10-14.md), [MINIMAP](sources/MINIMAP-2026-10-15.md). I codici seguenti non sono implementazioni automaticamente confermate.

- **E-01 — Economia mista:** confermare nell'end-to-end la proprietà *lord* vs capitale L4 aggregato, compravendita delle imprese e scorte con quota 0/25/50/75/100%; **parziale nel codice**, niente agente contabile individuale.
- **E-02 — Filiera e mercato:** fonti `food/wood/stone/metal/equipment/luxury`, oro valuta; varianti pregiate **tag**, non nuovi contatori obbligatori; export solo con domanda/costi reali; **regole e motore base esistono, catena completa da validare**.
- **E-03 — Tempo e feedback militare:** giorno di lavoro → output reale, mercato sabato, riposo domenica, bilanci annuali; assedio/incursione deve interrompere la produzione senza inventari concorrenti.
- **V-01 — Prototipo rendering 3D vs sprite:** torre + due mura, giunzioni, cutaway, progressione del cantiere, danni, benchmark e fallback Canvas. **PROPOSTA**, non conversione autorizzata.
- **V-02 — Cache asset:** misurare le 192 voci della cache bitmap e 32 MiB nominali dei compositi; identificare VRAM/RAM, eviction e perf prima di creare loader concorrenti.
- **V-03 — Animazioni lavoro popolani:** mani/attrezzi modulari condizionati dall'attività reale, accessori stagionali solo quando utili e vicini; **PROPOSTA**.
- **V-04 — Audio:** streaming musica current+next, SFX e ambience on demand, crossfade, controllo licenze/tracce Suno; **DIREZIONE**, non audio già pubblicato.
- **UI-01 — Minimappa + LOD:** [PR #44](https://github.com/erykwest/CONQUER/pull/44) contiene codice su branch; prima del merge QA real browser ISO/plan, rotazioni, selezione, fog, mobile e benchmark. Building LOD nel mondo 3D **NON incluso**.

## Requisiti per promuovere un'idea al lavoro

1. Identificare il *contratto/sistema* già esistente da riutilizzare.
2. Dare ID, proprietario di modulo, milestone, dipendenze, criterio di accettazione e test.
3. Verificare se una branch o PR ne contiene già una parte; indicare **HEAD SHA**.
4. Aggiornare la [roadmap](ROADMAP.md) solo se cambia davvero l'ordine delle priorità.
5. Chiudere soltanto con prova riportata in [STATUS.md](STATUS.md).
