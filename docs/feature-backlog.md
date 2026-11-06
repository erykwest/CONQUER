# CONQUER — Backlog prioritizzato Builder / Manager

## 2026-11-05 — Piazzale di stoccaggio al villaggio (branch `feature/founding-storage-yard-20261105`)

- **P0-03 / P0-05 · SU BRANCH (non MAIN fino al merge):** alla fondazione del villaggio un Piazzale 2×2U è cercato entro 7U dal pozzo in un'area con terreno valido, non alberata e senza conflitti; è inoltre piazzabile dal Builder. Può crescere a 4×4U e 6×6U pagando materiali e oro, con capacità 600/2400/5400 unità aggregata.
- **Stock iniziali:** rappresentati fisicamente nel piazzale e mostrati nell'ispettore, conservati esclusivamente in `ConquerEconomy.state().castle`; non aggiungere una seconda economia locale al magazzino.
- **Bug taglialegna:** con piazzale attivo un L1 ha priorità sul cantiere, per scongiurare la produzione zero con quattro fondatori impegnati in opere; con charter a 200 legname e target 70, la produzione trattenuta non incrementava il deposito e andava tutta al mercato. Dal branch, la quota non destinata alla vendita cresce nel castello fino a capienza del piazzale; il resto viene offerto al mercato. I tempi e la manodopera L1 non sono cambiati.
- **Da collaudare:** casi di fondazione con vincoli forestali senza spazio entro 7U, scene e animazioni carico/scarico reali, eventuali esigenze di capacity tuning; test `qa/storage-yard-regression.cjs` e GitHub Actions.


## 2026-11-05 — Forestry L1, tool del Terraforming (fix urgente su branch `fix/forestry-l1-clearing-cost-20261105`)

- **P0-02 · IMPLEMENTATO SUL BRANCH, NON VALIDATO COME CORE COMPLETO:** nuovo tool «Rimuovi foresta», non istantaneo; assegna lavori L1 finanziati con fino a 3 popolani per job, lascia gli alberi finché il lavoro non termina, apre radure persistenti e accredita il legname al magazzino del castello. Resa iniziale 2,5 legname/U²; 0,7 giornate operaio/U². Restano fuori rigenerazione e abbattimento periodico automatico dalle industrie.
- **P0-05 · FIX SUL BRANCH:** edificio taglialegna 5 legname, 35 oro (precedente 25 legname); palette, preview e spesa reali usano il costo unico in `settlement-industries.js`.
- **Verifiche:** `qa/forestry-regression.cjs` e workflow Economy flows aggiornato; esito da confermare dalla PR.


## Stato corrente su main — 30 ottobre 2026

> **Audit sostitutivo della fotografia del 22–23/10:** [AUDIT-2026-10-30](context/AUDIT-2026-10-30.md), ref `main` `cf5699922`. **15 nuclei CORE MAIN, 8 voci PARZIALI** su 23 ID Builder; questo non certifica la QA browser completa. Il precedente conteggio 13/10 più sotto resta esclusivamente **storico**.

| Classificazione corrente | ID | Prossimo lavoro reale |
|---|---|---|
| **CORE su main (15)** | P0-01a/03/04/07; P1-11/12/13; P2-14/15/16/18/19/20; P3-21/22 | Non riprogettare la feature. QA mirata, correzioni locali e collaudo end-to-end |
| **PARZIALE (8)** | P0-01/02/05/06/08; P1-09/10; P2-17 | Terreno→routing, tree depletion, agricoltura↔ledger, miniera `stone→metal`, stanze↔depositi/officina, bonus civici |

**Aggiornamenti effettivi:** [#98](https://github.com/erykwest/CONQUER/pull/98) ha portato **lavoratori L1 necessari per i cantieri** (P0-04); [#99](https://github.com/erykwest/CONQUER/pull/99) le routine; [#101](https://github.com/erykwest/CONQUER/pull/101) ha collegato **mercato, botteghe e Beni L3** al ledger, promuovendo P1-11 al nucleo MAIN. Il Centro di controllo con **9 viste e storici** ([#103](https://github.com/erykwest/CONQUER/pull/103)) è **merged su main dal 30/10**, non più "solo branch panels". I servizi locanda/chiesa ora hanno **operatori**, ma `SERVICE_KINDS.income` resta `not-simulated`: **P2-17 non è chiusa**. Le botteghe autonome nelle case **non** provano completata la filiera equipment dell'officina Built Section (P1-10).

**PR ancora OPEN (non su main):** [#109](https://github.com/erykwest/CONQUER/pull/109) test CI economia, [#110](https://github.com/erykwest/CONQUER/pull/110) livree/bivacchi/campi fortificabili, [#111](https://github.com/erykwest/CONQUER/pull/111) multi-pozzo e centri di quartiere. Gli screenshot demo dei pannelli non sono prove di produzione reale.


## 2026-11-05 — ARTE · commissioni, esposizione e circolazione delle opere

> **NUOVO SOTTOSISTEMA · BACKLOG APERTO, NON IMPLEMENTATO.** Le priorità A-P0/A-P1/A-P2 sono relative al solo filone ARTE e non anticipano la roadmap generale. Proprietà e opere devono restare dati di gioco, non semplici scatter/furniture grafici.

### A-P0 — Percorso completo dalla stanza all'opera posseduta
- [ ] **ART-251105-01 — Catalogo abbellimenti.** Quadri, arazzi e sculture, con varianti di stile/dimensioni e compatibilità con le stanze. Distinguere **archetipo grafico** (asset riutilizzabile) da **opera individuale** (oggetto con ID univoco).
- [ ] **ART-251105-02 — Slot decorativi delle stanze.** Catalogo consultabile partendo da una stanza del castello; ancoraggi di parete (quadri/arazzi), pavimento/piedistallo (sculture) e, in futuro, superfici d'arredo. Verificare disponibilità, ingombro e persistenza. Riutilizzare Built Sections, cutaway, furniture e Asset Lab: non creare un secondo Builder.
- [ ] **ART-251105-03 — «Commissiona opera d'arte».** Dalla stanza selezionata: scelta della tipologia/variante e della destinazione prevista; costo in oro, tempo di realizzazione e stato della commessa. A completamento l'opera entra nell'inventario del castello e, se lo slot è ancora valido/libero, viene esposta nella stanza richiesta. Se la destinazione è indisponibile, resta nell'inventario senza sparire.
- [ ] **ART-251105-04 — Inventario persistente delle opere.** Ogni esemplare ha ID, archetipo, proprietà, collocazione o deposito, stato della commissione e dati essenziali; evitare duplicazione di opere dopo salvataggio/caricamento, demolizione, spostamento o completamento di commesse.
- [ ] **ART-251105-05 — Rimozione e ricollocazione.** Rimuovere un'opera dalla stanza senza distruggerla, conservarla nell'inventario e ricollocarla in qualsiasi slot compatibile e disponibile, anche in un'altra stanza. Un'opera può essere esposta **in un solo luogo alla volta**.

**Accettazione del vertical slice ARTE:** seleziono una stanza → scelgo un quadro/arazzo/scultura → commissiono pagando una volta → il tempo avanza → l'opera viene prodotta e mostrata nel cutaway → la rimuovo e la ricolloco → il salvataggio/caricamento conserva proprietà e posizione. Collaudo in 3D e fallback 2.5D, Asset Lab per nuovi asset, QA dei vincoli di slot e della contabilità.

### A-P1 — Funzioni culturali e valore storico
- [ ] **ART-251105-06 — Galleria d'arte / Atelier [DA VALUTARE].** Nuove *funzioni di stanza*, non edifici autonomi. La galleria espone collezioni; l'Atelier può ospitare artisti e commissioni continuative. **Non rendere l'Atelier obbligatorio** per commissionare a un artista esterno.
- [ ] **ART-251105-07 — Scheda dell'opera.** Titolo, autore (anche esterno), qualità, provenienza, proprietari precedenti e valore, nei limiti dei sistemi di personaggi speciali effettivamente disponibili. Possibile effetto su prestigio/attrattività, con formula e bilanciamento **da decidere**; evitare bonus automatici per ogni oggetto decorativo.

### A-P2 — Economia e diplomazia
- [ ] **ART-251105-08 — Vendita.** Dall'inventario/esposizione alla cessione dell'oggetto: rimuovere la proprietà e la collocazione locale una sola volta, accreditando l'oro nel ledger economico canonico; prezzo/mercato e acquirente da definire.
- [ ] **ART-251105-09 — Donazione estera.** Trasferire un'opera identificata a un altro feudo/regno come dono diplomatico, con perdita effettiva della proprietà locale e beneficio relazionale **da definire**. Dipende da identità dei regni e diplomazia condivisa; non creare stati fittizi o un secondo sistema commerciale.

**Dipendenze e confini:** Built Sections e funzioni di stanza, cutaway/furniture e renderer, inventario/salvataggi, ledger oro, futuri artisti/ospiti, diplomazia/mercato interregno. Le opere sono beni mobili unici, non nuove risorse aggregate. Commercio e doni restano differiti finché non esistono i rispettivi contratti condivisi.

## 2026-11-05 — Builder / Castello: upgrade architettonici richiesti

> **NUOVE RICHIESTE · BACKLOG APERTO, NON IMPLEMENTATO IN QUESTA MODIFICA.** Task raccolti il 05/11/2026. Non confondere questi requisiti con le varianti già documentate su branch o con feature verificate in `main`. La priorità tra i task non è ancora assegnata.

### Mura e camminamenti
- [ ] **BC-251105-01 — Scala lignea per i camminamenti.** Upgrade/accesso in legno dalle quote a terra al cammino di ronda; definire aggancio, ingombro e accessibilità.
- [ ] **BC-251105-02 — Scala lapidea per i camminamenti.** Variante in pietra con la stessa funzione di accesso, distinta da quella lignea; verificare il raccordo alla quota delle mura.
- [ ] **BC-251105-03 — Edifici addossati alle mura.** Consentire una tipologia di edificio accostato alla faccia interna delle mura, con attacco geometrico e gestione delle interferenze con il camminamento.
- [ ] **BC-251105-04 — Merlature doppie.** Nuova configurazione di merlatura doppia da definire geometricamente; **non equivale** allo stile del merlo «a doppia falda» già annotato in `feat/crenel-styles`.

### Torri
- [ ] **BC-251105-05 — Inner roof delle torri.** Copertura interna delle torri; definire relazione con sommità, merli, cutaway e locali sottostanti.
- [ ] **BC-251105-06 — Torre lignea H2 con frame.** Variante torre in legno alta H2 con telaio/orditura leggibile nel modello.
- [x] **BC-251105-07 — Torre W2 × H4.** **[SU BRANCH `feature/tower-w2-h4`, non main]** Valutata e approvata dall'utente (06/11): quarto piano solo per la torre quadrata in pietra W2 (1,5U) indipendente; niente legno, tonde, D/semitorri, sottotorri, porte; W1/W3/W4 restano a H3 al massimo. Altezza 5,95+0,12 U (≈4,1:1 sulla base), costo ×3,35 rispetto a L1 (+45% su H3), una stanza NORMAL per piano come le altre W2. **Residui:** assedio (scale d'assalto contro quota H4, gittata/visuale dalla cima, crollo dei piani) non ribilanciato; il pulsante «4 levels» su torri non W2 viene ridotto a H3 senza avviso.

### Coperture
- [ ] **BC-251105-08 — Tetti inclinati a 75°.** Valutare e introdurre la pendenza a 75° nel sistema di tetti pertinente, coordinandola con `feat/roof-pitch` (30°/45°/60° già documentati su branch, non assumere merge).
- [ ] **BC-251105-09 — Upgrade tetti Longhouse.** Revisionare le coperture delle longhouse lignee W1/W2, con dipendenza da `feature/wood-longhouse` e dal suo modello modulare.
- [ ] **BC-251105-10 — Upgrade tetti edifici addossati alle mura.** Disegnare le coperture dedicate ai nuovi edifici addossati, gestendo attacco alle mura e interferenze con parapetti/camminamenti; dipende da BC-251105-03.

### Ambiente
- [ ] **BC-251105-11 — Giardino.** Nuovo elemento del Builder/ambiente; dimensioni, tipologia e ruolo (decorativo o funzionale) da definire prima dell'implementazione.

### Terreno e percorsi su dislivelli
- [ ] **BC-251105-12 — Rampe per superare i dislivelli.** Elemento costruibile per connettere due quote del terreno, anche in presenza di pendii scoscesi e terrazzamenti; valutare pendenze massime, sviluppo e raccordi con strade, suolo e percorsi delle unità. Verificare separatamente l'eventuale percorribilità dei carri.
- [ ] **BC-251105-13 — Scalinate per pendii e colline.** Elemento costruibile a gradini per collegare quote diverse su versanti ripidi, con attacco a pianori/terrazzamenti, corretto orientamento e accessibilità pedonale; distinta dalle scale che salgono ai camminamenti delle mura (BC-251105-01/02).

**Accettazione BC-12/13:** la geometria segue le quote reali del terreno; entrambe le estremità si connettono a superfici percorribili; il pathfinding delle unità riconosce i collegamenti, senza attraversare pendii non accessibili; costruzione, collisioni, salvataggio e visualizzazione 3D/2.5D sono verificati.

**Dipendenze/QA da affrontare in implementazione, non eseguite ora:** coordinare BC-01/02/03/04 con geometrie dei camminamenti; BC-08/09/10 con coperture già esistenti; BC-05/06/07 con livelli, cutaway e modelli delle torri. Al rilascio verificare Asset Lab, visualizzazione 3D e 2.5D, collisioni, persistenza e regressioni pertinenti. Il riferimento inter-sistemi è [BACKLOG](context/BACKLOG.md).

## 2026-10-29 — Storici gestionali e anteprime visive · note storiche dalla branch `panels` (merged #103 il 30/10)

- Campionamento a ogni mercato settimanale nel ledger economico: fino a 26 rilevazioni persistite di popolazione, felicità media e per classe, prezzi, occupazioni L1 e quantità prodotte per attività con proprietà dell'epoca; nessuna retrodatazione per salvataggi precedenti.
- Grafici storici nel Centro di controllo: welfare generale, felicità per classe, mansioni L1, prezzi selezionabili per risorsa, produzione del signore totale o per singola attività. I dati restano nel campo `State.economy` già persistito.
- Regressioni `qa/panels-regression.cjs` e `qa/economy-panel-history-regression.cjs`; screenshot browser via `qa/panels-browser.mjs` e workflow dedicato, con badge **DATI DIMOSTRATIVI**. Non attribuire screenshot fixture a una partita reale.
- Aggiornamenti su branch/PR draft #103. Test Chromium/CI da verificare prima di dichiarare completo.


## Settlement management panels — snapshot branch `panels` 29/10 (ora merged #103)

- **Ora su main tramite #103 (test e screenshot del branch precedenti):** centro di controllo Profilo a 9 viste, dati dal ledger economico e dai sottosistemi esistenti, grafico settimanale cibo, istogrammi, gestione tasse/razioni, quote vendita, acquisto/vendita proprietà, carovane.
- **Non implementato nella piena estensione:** festività sociali realmente simulate, occupazione L2–L4, indicatori tributari completi di feudo, rapporti diplomatici avanzati e allarmi epidemie/disordini/incendi. **Serie storiche felicità L1–L4, prezzi, occupazioni L1, produzione per sito (max 26 rilevazioni) sono implementate su main tramite #103.** Per contratti e priorità vedere [management-panels.md](management-panels.md).
- **Vincolo:** niente risorse fittizie, niente somma tra scorte economiche e magazzini di assedio, niente soldati inventati dalle capienze.

> **Nuova verifica Git 23/10:** [audit integrale aggiornato](context/AUDIT-2026-10-23.md) su main `518e830` dopo #76 e #79–81. **13 nuclei Builder già presenti e 10 voci con residui: conteggi invariati**. Le nuove feature Portoni GATE-01/01b/02/03/04/06 sono **main** e sono catalogate nel [backlog inter-sistemi](context/BACKLOG.md); Asset Lab è tooling, non nuova meccanica economica.

> **Stato ricontrollato: 2026-10-22**, `main` [c52b537](https://github.com/erykwest/CONQUER/commit/c52b537eac5f2a212841d45b75cc85b0136e069e). [Audit completo e matrice dei 23 ID](context/AUDIT-2026-10-22.md).
> Ambito: territorio, foreste, urbanistica, economia locale, fortificazioni, araldica e ambientazione.  
> Documento di pianificazione: **non** equivale a un audit funzionale completo né a un elenco di difetti confermati.

## Convenzioni

- **P0 — Fondamenta territoriali ed economiche:** blocchi necessari a un insediamento produttivo affidabile.
- **P1 — Integrazione economica e difesa:** risorse, capacità del castello, infrastrutture e prime fortificazioni.
- **P2 — Ingegneria e identità:** profondità architettonica, servizi e araldica.
- **P3 — Rifinitura ambientale:** varietà visiva e scatter, senza dipendenze gameplay nuove.
- **[x] = nucleo della feature già presente nel codice di `main`** (non certifica automaticamente i criteri di accettazione o un test browser); **[ ] = manca integrazione essenziale, decisione o QA di chiusura**. La classificazione motivata per tutti i 23 ID è nell'[audit 22/10](context/AUDIT-2026-10-22.md).
- Ricognizione statica di sorgenti e test ripetuta su `main` al **22/10/2026**; **nessun test è stato rieseguito in questa sessione**. Un residuo di QA non rende nuovamente da sviluppare l'intera feature.

### Baseline già individuata nel repository

- Orografia, pendii e collisioni correlate: `src/settlement-castle.js`, `src/settlement-landscape.js`.
- Foreste procedurali e relativi test: `src/settlement-landscape.js`, `qa/organic-forest-regression.cjs`.
- Pozzo e sviluppo urbano: `src/settlement-urban.js`, `docs/urban-fixes.md`.
- Campi Voronoi, lavorazioni e percorsi dei lavoratori: `src/settlement-fields.js`.
- Tier economici e accounting: `src/settlement-economy.js`, `docs/economy.md`.
- Logging camp, cava e miniera: `src/settlement-industries.js` (render inizialmente placeholder).
- Sistema araldico SVG/palette: `src/settlement-heraldry.js`, `src/heraldry-symbols.js`.
- Sette file albero: `src/assets/forest/tree_01_tonda.svg` fino a `tree_07_asimmetrica.svg`.

**Verificato nuovamente su main al 22/10:** la **miniera produce `stone`**, non `metal`, tanto in `settlement-industries.js` quanto in `settlement-economy.js`. La merce definitiva è un punto progettuale aperto.

## Aggiornamenti effettivi al 21/10 (storico, vedi triage 22/10)

- **P0-01a:** il terraforming è ormai parte di `main` e include terrapieni da assedio via [#73](https://github.com/erykwest/CONQUER/pull/73); ulteriori verifiche non equivalgono a una nuova implementazione da zero.
- **P0-04 / cantieri:** animazioni figuranti/lavoratori **integrate** [#71](https://github.com/erykwest/CONQUER/pull/71); la **necessità meccanica di L1 disponibili per completare una costruzione** è ancora contenuta nella PR [#55](https://github.com/erykwest/CONQUER/pull/55) **OPEN**, quindi non segnare soddisfatto quel criterio su main.
- **P0-06:** mulino a vento/acqua e relativo menu già merge [#57](https://github.com/erykwest/CONQUER/pull/57)/[#58](https://github.com/erykwest/CONQUER/pull/58); resta la coerenza del ledger e dei campi.
- **Criteri di chiusura:** le altre caselle non sono qui cambiate automaticamente in `[x]` senza un audit di accettazione individuale; il dettaglio di PR/QA è in [STATUS](context/STATUS.md).

## Triage su main — 22/10/2026 (**storico; per lo stato corrente vedere l'audit 30/10**)

> **Non utilizzare questo backlog come lista di feature inesistenti.** La [matrice verificata](context/AUDIT-2026-10-22.md) distingue il runtime già presente, il completamento meccanico e il collaudo.

| Condizione | ID | Azione corretta |
|---|---|---|
| **CORE PRESENTE SU MAIN** | **P0-01a, P0-03, P0-07, P1-12, P1-13, P2-14, P2-15, P2-16, P2-18, P2-19, P2-20, P3-21, P3-22** | **Non riprogrammare** la feature: soltanto QA/fix puntuali e integrazioni dimostrate mancanti |
| **PARZIALE / INTEGRAZIONE** | P0-01, P0-02, P0-04, P0-05, P0-06, P0-08, P1-09, P1-10, P1-11, P2-17 | Lavorare sul **residuo** indicato sotto e nell'audit; non replicare il sistema esistente |

**Correzioni sostanziali rispetto agli appunti passati:** basamenti di torri con svasatura/contrafforti **già programmati e selezionabili**; i sette SVG albero sono **già referenziati dal renderer**, non soltanto file asset; lo scatter ha già **sette famiglie/≥25 asset**, distribuzione contestuale e QA; l'araldica ha già pattern, quattro colori, cache e aggiornamento persistente dal Profile Panel; palizzate, ponti, fossati e levatoi hanno runtime proprio. La proposta **taverna/tempio** resta un'attività reale **solo per bonus/servizi**, non per costruirne i modelli.

**Residui prioritari da aprire come task, non come duplicati:** cantieri vincolati ai costruttori L1 (PR #55 OPEN); unificazione `State.resources`–`State.economy`–`State.siege.stock`; miniera `stone` vs `metal`; connessione officina stanza→filiera `equipment`; resa agricola/stock e calendario; bonus civici; test ripetibili su accessi, incendi, renderer e salvataggi. Il sistema assedio generale resta nel backlog [inter-sistemi](context/BACKLOG.md), con **meccaniche già presenti** da non ricreare.

## P0 — Fondamenta territoriali ed economiche

- [ ] **P0-01 — Orografia base e idoneità del terreno.** **[BASE MAIN; contratto terreno cross-module da validare]** Riutilizzare il rilievo esistente, verificando quote/pendenze/scarpate per collocamento edifici, percorsi, estrazione e futura difesa. **Accettazione:** lo stesso contratto di terreno governa validazione del Builder, accessibilità e rendering; i salvataggi precedenti restano leggibili.
- [x] **P0-01a — Terraforming del giocatore (branch `terraforming`).** **[CORE MAIN · QA/integrazione se necessaria]** Collina naturale e gradone verticale color muro con ghost; divieto di sovrapporre due terrazzamenti murati; magnete muro a filo; persistenza e rendering Canvas/WebGL2. **QA dedicata:** `qa/terraforming-regression.cjs` (10 controlli, inclusa mesh verticale). **Successivamente integrato in `main`** insieme alle evoluzioni con [#63–69](https://github.com/erykwest/CONQUER/pull/69): la descrizione della branch e i 10 check riguardano il vecchio snapshot.
- [ ] **P0-02 — Foreste procedurali funzionali.** **[BASE MAIN; tree depletion/rigenerazione assenti]** Completare, dove mancante, densità e sfruttamento: abbattimento, produzione legna, liberazione del terreno e rigenerazione secondo regole definite. **Accettazione:** produzione e stato della foresta rimangono coerenti dopo reload, senza spawn su edifici o strade non consentite.
- [x] **P0-03 — Pozzo / Village Core.** **[CORE MAIN · QA/integrazione se necessaria]** Consolidare la fondazione e la crescita progressiva già avviata, anziché ricreare un secondo generatore. **Accettazione:** niente lotti/edifici sovrapposti, crescita deterministica per seed, accessi stradali e persistenza validi.
- [x] **P0-04 — Abitazioni L1–L4 e popolazione produttiva.** **[CORE MAIN 30/10: #98 lavoro L1 ai cantieri, #99 routine; QA integrativa aperta]** Consolidare la coerenza tra livello abitazione, capienza, tier/professione e disponibilità di lavoro; separare status/tier dal lavoro corrente, se non ancora operativo. **Accettazione:** popolazione disponibile e lavoratori assegnabili coerenti con case ed economia; i tier superiori possono coprire lavori inferiori dove previsto.
- [ ] **P0-05 — Logging Camp.** **[BASE MAIN; depletion e ledger ancora da integrare]** Completare l'edificio estrattivo già abbozzato, lavoratori e rapporto reale con i boschi; sostituire il placeholder grafico quando pronto. **Accettazione:** collocamento vicino al bosco, output limitato da lavoratori/risorsa locale e comportamento consistente nel calendario economico.
- [ ] **P0-06 — Mulino / Farm Hub.** **[BASE MAIN; resa/stock e calendario da riconciliare]** Definire il polo agricolo sfruttando il sistema campi già esistente. Riconciliare lavorazioni visive (aratura, semina, crescita, raccolto) con il bilancio economico stagionale. **Accettazione:** un'unica fonte per resa annuale, forza lavoro e produzione `food`, senza doppio conteggio.
- [x] **P0-07 — Cava.** **[CORE MAIN · QA/integrazione se necessaria]** Rifinire il nodo `quarry` esistente e la sua dipendenza dai versanti rocciosi. **Accettazione:** collocamento geologicamente valido, operai L2, output `stone`, salvataggio e visualizzazione coerenti.
- [ ] **P0-08 — Miniera.** **[BASE MAIN; output mine=stone, metal da decidere]** Completare il nodo `mine` esistente e risolvere prima il prodotto estratto (`stone` vs `metal`). **Accettazione:** decisione di design esplicita e testata, collocamento vincolato al giacimento, lavoratori L2 e flusso economico coerente.

**Milestone P0:** villaggio fondabile e persistente; terreno e foreste influenzano il posizionamento; lavoratori e quattro poli economici operano in modo osservabile e verificabile.

## P1 — Economia e fortificazioni funzionali

- [ ] **P1-09 — Funzioni delle Built Sections.** **[BASE MAIN; capienze e slot presenti, ledger separato]** Collegare gli slot esistenti a capienza e funzione reale: granaio, magazzino, armeria, caserma, scuderia, alloggi/comando. **Accettazione:** i vincoli per piano/accessibilità e le capacità fisiche sono validati; il contenuto economico non supera capienze definite.
- [ ] **P1-10 — Workshop / Fabbro.** **[BASE MAIN; produzione workshop non dimostrata dal solo slot]** Integrare il laboratorio nella costruzione e nell'economia (il motore conosce già il tipo `workshop`). **Accettazione:** input `metal` + `wood`, output `equipment`, lavoratori L3 e ciclo produttivo senza risorse duplicate.
- [x] **P1-11 — Mercato.** **[CORE MAIN 30/10: #101 botteghe/beni/prezzi/vendite nel ledger, #105 convogli; QA fisico/stock aperta]** Completare il collegamento tra edificio fisico e mercato/accounting già esistente, evitando una nuova simulazione concorrente. **Accettazione:** transazioni, stock, riserve, oro e proprietari si aggiornano nello stesso ledger.
- [x] **P1-12 — Palizzate.** **[CORE MAIN · QA/integrazione se necessaria]** Implementare segmenti, angoli, aperture/porte, costo ridotto rispetto alle mura e vulnerabilità al fuoco. **Accettazione:** gli accessi e le collisioni cambiano davvero i percorsi di unità e attaccanti; le palizzate sono modificabili nel Builder.
- [x] **P1-13 — Ponti ordinari.** **[CORE MAIN · QA/integrazione se necessaria]** Permettere attraversamenti di fossati e corsi d'acqua, con larghezza compatibile con strada e accesso. **Accettazione:** il pathfinding considera il ponte soltanto quando collegato e transitabile; collocamento e stato sono persistenti.

**Milestone P1:** l'economia alimenta riserve fisiche; gli edifici hanno funzioni effettive; le prime difese e infrastrutture modificano l'accessibilità.

## P2 — Ingegneria militare, servizi e identità

- [x] **P2-14 — Fossati.** **[CORE MAIN · QA/integrazione se necessaria]** Introdurre varianti asciutte/allagate e normali/larghe, con raccordi al terreno e interruzioni in corrispondenza degli accessi. **Accettazione:** modifica reale della percorribilità; geometria e salvataggio consistenti.
- [x] **P2-15 — Ponti levatoi.** **[CORE MAIN · QA/integrazione se necessaria]** Variante dell'accesso fortificato con stato aperto/chiuso; dipende da fossato e attraversamento. **Accettazione:** stato condiviso tra rendering, navigazione e futuro comportamento d'assedio.
- [x] **P2-16 — Basamenti diversificati.** **[CORE MAIN · QA/integrazione se necessaria]** Verticali, svasati e con contrafforti, anche in combinazione secondo la geometria. **Accettazione:** resa coerente di mura/torri; la variante visiva non altera in modo implicito ingombri, collisioni o costo.
- [ ] **P2-17 — Taverna e Tempio.** **[BASE MAIN 30/10; operatori L3 #101 presenti, bonus/income non simulati; la dicitura «No services or economic effects» riguarda gli annessi]** Collegare gli eventuali edifici civici già rappresentati a servizi, attrattività e coesione. **Accettazione:** effetto di gameplay chiaro, misurabile e senza introdurre nuove catene produttive.
- [x] **P2-18 — Motore araldico SVG universale.** **[CORE MAIN · QA/integrazione se necessaria]** Verificare e rifinire il sistema già presente: sorgente rettangolare indipendente dal supporto, con clipping lato oggetto. **Accettazione:** una stessa definizione è riutilizzabile su supporti differenti senza duplicazione della logica.
- [x] **P2-19 — Pattern, quattro colori e simboli.** **[CORE MAIN · QA/integrazione se necessaria]** Completare l'uso di `C1/C2` per il pattern e `C3/C4` per simbolo e contorno. **Accettazione:** resa coerente su scudo, stendardo, veste e bardatura, nei supporti effettivamente disponibili.
- [x] **P2-20 — Sincronizzazione araldica dal Profile Panel.** **[CORE MAIN · QA/integrazione se necessaria]** Estendere/validare il salvataggio e la propagazione globale delle modifiche. **Accettazione:** cambiamento unico e persistente su tutte le istanze che condividono la configurazione; nessuna texture obsoleta in cache.

**Milestone P2:** basamenti, attraversamenti, fortificazioni e identità SVG **già presenti come runtime**; resta principalmente P2-17 (servizi civici) e la QA di integrazione.

## P3 — Rifinitura ambientale

- [x] **P3-21 — Sette varianti di alberi SVG.** **[CORE MAIN · QA/integrazione se necessaria]** Gli asset sono già nel repository: verificare uso effettivo nel renderer forestale, varietà e prestazioni. **Accettazione:** distribuzione seeded, riconoscibilità delle sagome, culling/cache e nessun peggioramento significativo dei frame time.
- [x] **P3-22 — Scatter procedurale antropico.** **[CORE MAIN · QA/integrazione se necessaria]** Preparare circa 25 silhouette nelle sette famiglie: carri, merci, cartelli, ruote/rottami, cataste, attrezzi agricoli e arredi da lavoro. **Accettazione:** distribuzione contestuale (strade, crocevia, cantieri, boschi, periferie), non random uniforme; nessuna interferenza ingiustificata con percorsi e selezione.

**Milestone P3:** alberi e scatter **implementati su main**; soltanto QA/prestazioni/polish correttivo, non nuova generazione da zero.

## Dipendenze / ordine minimo

1. Contratto unico di **terreno e accessibilità** → foreste funzionali → poli produttivi.
2. **Pozzo + abitazioni + forza lavoro** → Logging Camp / Farm Hub / Cava / Miniera → stock economici.
3. **Ledger economico unico** → magazzini e funzioni Built Sections → bottega/mercato.
4. **Attraversamenti** → fossati → ponti levatoi → integrazione con gli assedi.
5. **Texture araldica condivisa** → supporti specifici → sincronizzazione Profile Panel.
6. Scatter e polishing soltanto dopo stabilità procedurale e test di regressione.

## Definition of Done (per ogni feature)

- [ ] Verificare lo stato effettivo su `main` prima di scrivere nuova logica; preferire completamenti/refactor a duplicazioni.
- [ ] Separare **stato/meccanica** da visualizzazione SVG/Canvas/WebGL.
- [ ] Coprire con test automatici i vincoli toccati, compresi seed deterministici, collisioni, salvataggi e migrazioni.
- [ ] Controllare il comportamento in Builder e durante l'avanzamento della simulazione; documentare il test visuale se eseguito.
- [ ] Conservare compatibilità con le altre sottosezioni e i salvataggi esistenti.
- [ ] Sviluppare su feature branch con CI; proporre PR soltanto a feature completa, seguendo `AGENTS.md`.

### Suite di regressione utili

`qa/p1-terrain-regression.cjs`, `qa/organic-forest-regression.cjs`, `qa/forest-massif-density-regression.cjs`, `qa/urban-regression.cjs`, `qa/fields-regression.cjs`, `qa/economy-regression.cjs`, `qa/economy-industries-regression.cjs`, `qa/builder-placement-regression.cjs`.

## Vincoli di scope

- Non moltiplicare le risorse o gli edifici intermedi: conservare il modello economico aggregato e riutilizzare le Built Sections.
- Non implementare un secondo sistema di economia, pathfinding, orografia, campi o araldica accanto a quello esistente.
- Il combattimento e l'assedio completo hanno un backlog distinto; qui sono incluse solo le loro dipendenze di **Builder / territorio**.
- Tributi feudali, carovane strategiche, economia avanzata e monetizzazione restano fuori da questo perimetro, salvo una successiva decisione esplicita.

## Criterio di aggiornamento

Per ogni ID: annotare issue/PR e commit associati; segnare `[x]` quando il nucleo di codice è effettivamente presente su main e annotare **separatamente** eventuali gap di QA/accettazione, registrare decisioni ancora aperte e riordinare le priorità **quando una dipendenza viene chiusa**.

Riferimenti: [Economia](economy.md) · [Urban fixes](urban-fixes.md) · [Metodo di lavoro](../AGENTS.md).
