# Livello 3 — Decisioni, ipotesi e conflitti

## D-MIL-CIRCLE-261109 — Gerarchia CIRCLE per assegnazioni militari (09/11/2026)

- **DECISIONE DEL PRODUCT OWNER:** la sottopaletta «Pattuglie e guarnigioni» deve usare l'interfaccia CIRCLE, con assegnazioni da **zone difensive** fino a **torri**; ogni torre principale e le sue sottotorri sono una **sola riga** come macrostruttura difensiva.
- **CONTRATTO:** usare solo i settori chiusi effettivamente rilevati da `ConquerCircle.getSnapshot().compartments` e `sectorForStructure`. L'albero `parentTowerId` raggruppa i figli della torre principale senza doppio conteggio. Il controllo di livello zona distribuisce arcieri ai posti validi delle torri associate; il controllo di livello macrostruttura assegna o richiama arcieri alle postazioni reali di madre/figlie. Stessa contabilità per le squadre delle caserme in `/camp` senza righe figlie duplicate.
- **PATTUGLIE:** il trasferimento da White Zone a CIRCLE imposta un identificatore di settore persistito sull'unità Combat, non recluta una pattuglia nuova. Il pattugliamento segue punti percorribili del compartimento tramite pathfinder militare; nessun teletrasporto. Le zone CIRCLE non disponibili o scomparse non diventano zone inventate.
- **LIMITI:** settori CIRCLE dipendono da perimetri realmente chiusi, quindi finché non lo sono le torri rimangono sotto «Fuori dai compartimenti CIRCLE»; pattugliamento non garantito per compartimenti privi di itinerari militari accessibili. Roadmap immutata.
- **STATO:** codice sul branch `feature/circle-military-zones-macrotowers-20261109`, CI/test live/merge da confermare.


## D-JOBS-MIL-261109 — Sottopalette L1/L2 e Pattuglie e guarnigioni (09/11/2026)

- **DECISO DAL PRODUCT OWNER:** due sottopalette all'interno del Job Manager, denominate «L1» e «L2»; una sottopaletta militare «Pattuglie e guarnigioni».
- **SCELTA DI IMPLEMENTAZIONE:** L1 mantiene le sue mansioni, L2 applica la stessa semantica di priorità drag-and-drop, minimo e AUTO/manuale alla sola classe L2 (campi, cave, miniere). Minimi assegnati prima in ordine di priorità, poi resto solo ai job AUTO; nessun travaso automatico di lavoratori L1 e nessuna variazione a L3/L4. Save legacy intatto prima dell'attivazione L2.
- **CONTATTO CON IL MOTORE MILITARE:** pattuglie esistenti gestite su White Zone da Combat; arcieri nelle torri via postazioni Siege; squadre caserma disponibili dove esiste ConquerCamp (`/camp`). Nessuna nuova formazione, fabbricazione artificiale di soldati o spostamento implicito di unità.
- **STATO:** branch `feature/jobmanager-l2-military-garrisons-20261109`, QA completa/merge ancora da verificare; roadmap invariata.


## D-L1-JOB-261109 — Priorità del lavoro dei popolani L1 (09/11/2026)

- **APPROVATO DAL PRODUCT OWNER:** nel Job Manager L1 le produzioni/mansioni sono righe ordinabili trascinandole, ciascuna con un numero «Minimum worker» da garantire quando i lavoratori sono disponibili e un pulsante AUTO. AUTO disattivato passa la mansione a manuale.
- **CONTRATTO DI IMPLEMENTAZIONE:** i minimi sono distribuiti prima, in ordine di priorità; se la richiesta complessiva supera la popolazione disponibile, i minimi dei job in alto prevalgono. Solo dopo si assegnano lavoratori aggiuntivi ai job AUTO, sempre in ordine di priorità; i job manuali ricevono esclusivamente il minimo. Non si supera la capacità massima del job o la disponibilità di L1.
- **CONFINI:** i pastori necessari alla sicurezza alimentare e i pescatori attivi restano riservati secondo le regole specifiche. L2–L4 non sono toccati. I salvataggi esistenti conservano l'allocatore originale finché un comando della nuova gestione non viene utilizzato; modifiche salvate con `State.economy.l1Jobs` su locale/cloud.
- **STATO:** codice e QA su `feature/l1-jobmanager-priority-20261109`; CI e browser da validare prima del merge. ROADMAP invariata: evoluzione del Job Manager già esistente.


## D-VIS-STONECOLOR-261108 — Pietra coerente per mappa (08/11/2026)

- **APPROVATO DAL PRODUCT OWNER:** scelta casuale iniziale fra Grigio attuale, Arenaria, Tufo, Calcare e Granito; successiva modifica da **Profilo → Ambiente** con applicazione globale agli elementi realmente litici.
- **5 GRADIENTI OBBLIGATORI:** per ogni famiglia luce, sommità, mezzotono, ombra e fessura. Colori esatti nella [scheda approvata](../STONECOLOR-PALETTE-VALIDATION.md). Arenaria beige desaturata e minerale: deve restare distinguibile dal Clay rosso/terracotta delle murature e dalle cave di argilla.
- **SEMANTICA E PERSISTENZA:** famiglia pietra è un aspetto di mappa, non una tipologia di risorsa/costruzione; random deterministico dal seed e stabile in salvataggio locale/cloud. Vecchi salvataggi privi di palette rimangono in grigio.
- **ESCLUSIONI:** legno, brick/clay, acqua, neve, tetti, metallo, vegetazione. Rimangono invariate economia, integrità, collider, geometrie e logistica. Nessuna nuova collezione di SVG/mesh per ogni colore.
- **STATO:** implementazione su `feature/stonecolor`, non automaticamente consegnata su main; passaggio CI e validazione visiva necessari.


## D-VIS-AUTUMN-261107 — Progressione autunnale delle chiome (07/11/2026)

- **DECISO, CODICE SU BRANCH `autumn`:** la chioma degli alberi decidui non passa in un colpo al marrone: dal 1° settembre al 30 novembre cambia gradualmente di aspetto attraverso toni verde/giallo-verde, giallo, oro, arancione, rosso e marrone. Posizione degli alberi e seed producono un anticipo/ritardo stabile della fase, senza sincronizzazione di tutta la foresta.
- **INVARIANTI:** si riusano i sette SVG e le palette verdi estive; inverno senza chiome, pini sempreverdi, salvataggi e bilanci economici immutati. Un override DEV Autunno fuori dal periodo autunnale mostra una fase intermedia. Ottimizzazione: atlante WebGL2 statico, aggiornamento UV per giorno, fallback Canvas aggiornato per foreste e alberi urbani.
- **LIMITE DICHIARATO:** gradazione percepita nel paesaggio tramite sei toni e differimento fra alberi, non interpolazione continua pixel-per-pixel nella stessa chioma e non simulazione di foglie cadute. QA browser/prestazioni richiesta prima di merge.
- **DIREZIONE:** sola rifinitura del P3-21 visivo; ROADMAP M0–M5 invariata.


## D-CI-P23-261106 — CI senza trigger push su branch inesistenti (06/11/2026)

- **DECISO:** eliminare soltanto i push indirizzati a branch GitHub non più presenti; mantenere i test specialistici su PR e i push su `main` quando configurati.
- **LIMITI:** non cancellare né rinominare workflow e check, non cambiare le condizioni `paths`, non rimuovere script QA e non eliminare branch reali. Progettazione P2.2 (protezione `main`) differita su esplicita richiesta; nessuna regola GitHub amministrativa modificata.
- **QA:** proteggere i trigger superstiti con `qa/ci-p1-regression.cjs`; verificare Actions prima dell'integrazione.


## D-CI-P21-261106 — Selezione visuale incrementale, copertura completa periodica (06/11/2026)

- **DECISO, CODICE SU BRANCH `perf/assetlab-p2-incremental-20261106`:** il catalogo runtime resta unica fonte di verità per gli ID da verificare; il planner sceglie solo sorgenti isolate con stato Git modificato. Il selettore non sostituisce e non altera le baseline degli asset.
- **FAIL-SAFE:** incertezza, nuovo/rimosso file, cambi di scena o motore, texture architettoniche e modelli eliminati dalla baseline obbligano l'audit completo. Nessun rilassamento delle verifiche dei render/stati dell'Asset Lab.
- **REGOLE CI:** gallery sempre integrale quando si avvia il browser; audit completo in esecuzione manuale o pianificata la domenica, oltre agli eventi ad alto rischio. Futuri allargamenti dell'allowlist richiedono test sulle dipendenze reali.
- **MOTIVAZIONE:** ridurre rendering e screenshot inutilmente ripetuti su PR con modifiche locali, senza sacrificare la diagnosi di regressioni trasversali. ROADMAP di gioco invariata.


## D-L1-CARTER-261106 — Carrettiere come mestiere L1, trasporto ancora visivo (06/11/2026)

- **DECISO E IMPLEMENTATO SU BRANCH `feature/l1-carter-jobs-market-20261106`:** una rete logistica locale prende **veri lavoratori L1** dal roster `ConquerEconomy.laborAllocation`. Al massimo un carrettiere per piazzale attivo con una consegna raggiungibile (max 4); l'industria essenziale e i cantieri navali hanno precedenza, mentre i cantieri usano soltanto il residuo. Il carrettiere ha la stessa identità del popolano/fondatore: mai contarlo due volte o generare un lavoratore addizionale.
- **SEPARAZIONE DELLE DESTINAZIONI:** la quota reale della produzione contabilizzata come scorta del signore è trasportata visivamente al deposito; le quote registrate come `market lots` e le merci del commercio L3 sono trasportate visivamente al Mercato costruito, senza appropriarsi del materiale privato. Origine operativa = piazzale; il carico avviene dal produttore.
- **IL LEDGER NON CAMBIA:** il lavoro è reale in termini di occupazione L1, il trasporto è estetico. Nessun addebito, consegna ritardata, vendita o consumo aggiuntivo su partenza/arrivo; niente inventario per singolo carretto o magazzino. Su rete viaria interrotta, turno non attivo o carenza L1 si rinuncia all'animazione, non alla produzione. I carri ordinari rimangono non intercettabili; i convogli militari/strategici conservano le loro regole.
- **TURNO:** lunedì-venerdì, fascia .25–.75 della giornata per nuove partenze (i viaggi già avviati completano il ritorno). Sabato mercato civile, domenica riposo; l'allarme non autorizza nuove corse.


## D-CODEX-03 — Vault personale e pubblicazione editoriale (05/11/2026)

- **Richiesta dell'utente:** usare la skill Obsidian per edifici e meccaniche, con vault dedicato nella propria cartella CONQUER. Il vault personale è la fonte di scrittura; il repository conserva una copia di pubblicazione versionata, non un secondo vault da modificare indipendentemente.
- Import a senso unico: non riscrive il vault, controlla la base locale e si ferma su conflitti, salvataggi concorrenti, link o destinazioni non valide. Percorso personale e manifest di sincronizzazione restano locali/ignorati da Git.
- Solo contenuti approved sono compilati. Titolo, alias e corpo si modificano nelle note, mentre costi, tempi e compatibilità restano nel gameplay. ID stabili distinti da nome file e titolo; link di sezione preservati.
- Nessuna pubblicazione automatica dal salvataggio di una nota. Copia Git e artefatto passano da PR/CI e merge autorizzato. [Contratto completo](../CODEX-OBSIDIAN.md). Milestone M0–M5 invariate.

## D-CODEX-02 — Wiki ipertestuale e artefatto pubblico generato (05/11/2026)

- **Richiesta dell'utente:** alcune keywords di sovracategoria nel testo devono rimandare a una pagina. Implementati link HTML reali con destinazioni stabili, match per parole intere e precedenza dei termini specifici; testi e destinazioni verificati dalle QA. Breadcrumb, relazioni e backlink completano la navigazione.
- Una vista per sito e in-game; in-game legge il catalogo live senza snapshot, il sito legge un artefatto JSON generato dalle stesse definizioni. Estensione di D-CODEX-01: l'artefatto viene committato per hosting statico, ma non mantenuto manualmente; CI confronta la rigenerazione e rifiuta dati obsoleti.
- Preventivi pubblici riferiti a configurazioni esplicite, preventivi contestuali dal gioco. Le conoscenze non mappate non diventano sblocchi o stati di possesso fittizi.
- Nessun cambiamento alle milestone M0–M5 né ai contratti di economia/salvataggi. [Implementazione e limiti](../CODEX-WIKI.md), branch `feature/codex-wiki`.

## D-CODEX-01 — Catalogo consultabile sopra i provider del gioco (05/11/2026)

- **Implementazione fase 2 sul branch `feature/codex-normalized-catalog`**, su richiesta di procedere al catalogo normalizzato: sette categorie, ID semantici indipendenti da salvataggi/asset/etichette, metadati e relazioni strutturate. [Contratto v1](../CODEX-CATALOG.md).
- Un core senza DOM e un adapter read-only al gameplay. Costi/tempi leggono i provider reali; nessun secondo listino. Lettura live in gioco, snapshot JSON esplicitamente datato dal processo che lo pubblica per il sito.
- Valori noti distinti da unmapped/context-required/incompatible. La membership nello schema di una variante non certifica l'installabilità. Nessuna meccanica viene abilitata dal Codex.
- Requisiti fisici, funzionali e conoscenze separati. Conoscenze non mappate; nessun albero tecnologico, nessun vincolo inventato.
- Alternativa evitata: duplicare costi e regole nei contenuti Wiki. La UI Wiki e l'export automatico del sito restano fase successiva; milestone sistemiche M0–M5 invariate.

## D-PRESTIGE-01 — Prestigio del castello (05/11/2026)

- **Decisione dell'utente:** la Falconiera dà «prestigio nobiliare» attraverso un valore nuovo del castello, non con un bonus ai cavalieri né alla diplomazia.
- **Contratto:** `ConquerSiege.prestige()` → `{total, by}`, somma di `PRESTIGE[fn]` per ogni stanza ammessa e non catturata (Falconiera 3, Sala del trono 4, Stanze nobili 1, Cappella 1, Tesoro 1). Si mostra nel riepilogo logistico. Gli altri sistemi lo leggeranno in seguito: quali, è aperto in BACKLOG.
- **Estensione di D-ROOM-EXT-01:** una stanza può avere il suo elemento esterno sul tetto (`mount:'roof'`): stessa posizione degli upgrade (campanile), indice = slot della stanza, regola `active` della voce. Prima applicazione: la voliera della Falconiera.
- **Prova:** `qa/falconry-regression.cjs`.

## D-CI-P1-261106 — Ottimizzare la CI senza diminuire la copertura (06/11/2026)

- **DECISO, CODICE SU BRANCH `chore/ci-p1-browser-dedup-20261106`:** un solo owner per la suite completa `qa/*-regression.cjs` (P0) e uno per l'audit visuale `qa/asset-audit.mjs` (Asset Lab). Workflow specifici fanno controlli mirati; full P0 si attiva sulle modifiche ai componenti condivisi, inclusi world3d/castle3d.
- **BROWSER:** una composite action installa Playwright 1.56.1 e Chromium con cache condivisa su Ubuntu 24.04; Asset Lab salta il job visuale solo se la modifica non influenza asset o modelli; WebGPU esegue smoke su renderer e fallback solo quando pertinente, manualmente o su PR.
- **CANCELLAZIONE RUN:** annullare soltanto i job superseded nella stessa PR e nello stesso workflow; mantenere run su main, manuali, schedulati.
- **VINCOLI:** test QA esistenti tutti presenti, Runtime integrity, Economy flows e Context pyramid guard preservati. ROADMAP gameplay invariata.



## D-HAULAGE-261106 — Carretti locali come visualizzazione della produzione, non secondo ledger (06/11/2026)

- **DECISO SU BRANCH `feature/local-production-haulage-20261106`:** generare un viaggio locale soltanto dopo una produzione che il ledger ha effettivamente accreditato alle riserve del signore o dopo una bonifica forestale accreditata una sola volta. I carichi privati e le merci solo di mercato non producono un finto trasporto al magazzino.
- **COERENZA D-007 e D-046:** la logistica locale ordinaria resta contabilmente astratta; nessuna risorsa passa fisicamente di proprietà all'arrivo o può essere accreditata due volte. Si utilizzano i carretti 2D, cavalli 2D, conducenti e lo stesso pathfinding stradale dei convogli esistenti. Non aggiungere bestie o figurine 3D per sostituirli.
- **PERCORSO E LIMITI:** servono segmenti viari completati vicino al produttore e al piazzale; verso il magazzino raggiungibile con tragitto migliore, andata carica e ritorno vuoto. Se non c'è continuità il carico resta per poco in coda visiva, senza impattare le scorte già iscritte. Limite massimo 4 mezzi attivi e 32 richieste in attesa. Pausa del gioco ferma anche i carri. Nessun trasferimento materiali sito-per-sito fra piazzali in questa fase.


## D-CI-P0-261106 — Separazione CI quotidiana e verifica integrale (06/11/2026)

- **DECISO, IMPLEMENTATO SU BRANCH `chore/ci-p0-consolidation-20261106`:** mantenere i 163 script QA ma eliminare 11 workflow dei branch che non esistono più/cleanup monouso. Il full su tutte le PR è sostituito da controlli rapidi (per modifiche isolate) e suite completa nei PR con modifiche al motore comune, nelle esecuzioni manuali e settimanali. Il nome del job esistente viene preservato.
- **VINCOLI:** runtime integrity, economy flows, context governance intatti; non indebolire controlli fondamentali. Non toccare gli altri workflow (Playwright, browser, WebGPU) in P0. Nessuna nuova risorsa runtime, costo di gioco o macro-priorità ROADMAP.
- **RICOSTRUIBILITÀ:** `docs/CI.md` conserva la lista dei workflow rimossi; la storia Git contiene i contenuti e i test rimangono nei percorsi originali.


## D-ORTO-251106 — Il giardino è l'orto di corte del Municipio (06/11/2026)

- Scelta dell'utente tra orto di corte, giardino dei semplici e hortus conclusus: **orto di corte**.
- È un annesso civico del Municipio (`kitchenGarden`), non un edificio autonomo: riusa catalogo, persistenza, cancellazione a cascata e preflight degli annessi. Poiché il Municipio non ha lotto Voronoi, vale la regola «terreno aperto entro 7U, mai su lotti di proprietà».
- Effetto: 2 cibo del signore per giornata lavorativa per orto, senza lavoratori, anche in allarme/assedio (scorta interna che non dipende da pascoli e reti). Primo annesso con resa economica: gli altri annessi restano skeleton.

## D-STOCKYARD-251105 — Il piazzale fondativo è lo stoccaggio del castello (05/11/2026)

- **DECISO, IN CODICE SU BRANCH `feature/founding-storage-yard-20261105`:** il villaggio nasce con un Piazzale 2×2U entro 7U dal primo pozzo, se un lotto edificabile è disponibile. Il capanno taglialegna versa la quota di produzione trattenuta nelle scorte del castello fino alla capienza dei piazzali; la parte non trattenuta e la quota in eccesso raggiungono il mercato.
- **UNICO INVENTARIO:** `ConquerEconomy.state().castle` rimane fonte di verità: il magazzino non duplica le merci, il vecchio charter resta idempotente, la persistenza è quella di `State.structures` e `State.economy`.
- **PRIORITÀ L1:** quando un piazzale è disponibile, un lavoratore L1 viene riservato al Logging Camp anche se sono aperti molti cantieri; le regole esistenti senza piazzale restano invariate.
- **BILANCIAMENTO INIZIALE:** capienza 600/2400/5400 unità per 2×2, 4×4, 6×6U; costi di ampliamento 20 oro + 10 legname e poi 40 oro + 20 legname, pagati subito. Aree di ampliamento soggette a blocchi e collisioni normali. Nuovi piazzali 2×2U costruibili con 20 oro + 10 legname e normale cantiere L1; quello iniziale è gratuito.
- **FUORI SCOPE:** carrettieri e trasferimento individuale del materiale, consumo e assegnazione delle room magazzino, redistribuzione tra depositi su distanze diverse.


## D-FORESTRY-L1-251105 — Pulizia boschi come job di terraforming (05/11/2026)

- **DECISO, IMPLEMENTATO SU BRANCH `fix/forestry-l1-clearing-cost-20261105` (pre-merge):** «Rimuovi foresta» è un lavoro civile L1 e non un click immediato. Richiede un insediamento fondato, si accoda nella stessa persistenza del paesaggio (`State.relief`), usa lavoratori L1 non impegnati nelle costruzioni e il payroll ordinario. Solo a completamento crea una radura, invalida paesaggio/navigation e attribuisce al signore un raccolto di legname sostanziale, una sola volta. Resa/tempo iniziali: 2,5 legname e 0,7 giornate operaio per U² di copertura forestale.
- **Bilanciamento:** capanno del taglialegna massimo 5 legname (35 oro invariati). La rimozione manuale non sostituisce la produzione continuativa dei Logging Camp.
- **Non deciso / fuori scope:** ricrescita forestale e depletion industriale periodica.


## D-ROOM-EXT-01 — Una stanza può cambiare l'esterno del suo edificio (04/11/2026)

- **DECISO (contratto):** una funzione di stanza dichiara il suo elemento esterno in `ROOM_EXTERIOR[fn]` (`src/settlement-room-exterior.js`): `{model, source, mount, breakable?}`. `model` è un modello Blender in `src/assets/*-models.js` (registro `window[source].models[model]`: `parts` con `p/i/c`, `width`, `projection`, `bottom`, `chuteTop`), assi U con +x lungo la faccia (centrato), +y verso l'esterno, +z dal pavimento della stanza.
- **Un'unica geometria:** `roomExteriorPlacement(s, index, fn)` decide dove va l'elemento o restituisce `null`; `roomExteriorElements(s)` elenca gli elementi piazzati; `roomExteriorTriangles(s)` li trasforma in triangoli del mondo `{pts:[{p,z}], hex, key, part}`, lo stesso formato di `pointHoardingTriangles`. Tutti i renderer leggono quei triangoli: 2.5D (`drawAll` dopo i tetti del corpo del castello; `draw(s)` nel cutaway), castle 3D, World 3D e mesh dell'Asset Lab (`bodyMesh` in `settlement-castle3d.js`), cutaway del World 3D (guscio esterno). **Cantiere:** nessun elemento, perché le stanze si assegnano solo a edificio finito. **Crollo:** `collapseParts(e)` → `startCollapse`, quando cade l'edificio o quando cade l'elemento da solo.
- **Montaggio `face` (unico implementato):** facciata esterna di una sezione costruita (`wallExteriorSide`, il comando "Exterior side / windows"), centrato su una cella di feritoia del piano della stanza (la più vicina al centro), ad almeno 0,3 U dagli estremi. Viene scartato se nel suo ingombro c'è un'altra struttura più alta del suo fondo, una bertesca o un ballatoio di torre o porta (sporgenza 0,5 U) o la galleria o le caditoie di un muro. Le feritoie della sua cella, dal suo tetto in giù, cedono il posto (`takesWindow`). Le regole della stanza (`allowed()`) chiedono `placement`: se l'elemento non entra, la stanza non si assegna e i salvataggi la perdono con `sanitizeRooms`.
- **Rottura (`breakable`):** un colpo d'artiglieria entro 0,45 U dall'elemento lo colpisce (`attackStructure` con un punto d'impatto). Gli HP stanno in `s.roomExteriorHp[index]`; a 0 l'elemento crolla, la stanza tiene la funzione ma non serve finché non viene ricostruita (`ConquerSiege.repairRoomExterior`, 6 pietra + 2 oro).
- **Riservati, non implementati:** `mount:'eave'` (Cisterna, gronda o pluviale). Chi lo aggiunge estende `roomExteriorPlacement` con un nuovo ramo e una voce nella tabella. Non deve aggiungere un renderer: basta che i triangoli restino nello stesso formato.
- **Estensione (04/11/2026, branch `feature/alarm-bell`): upgrade di struttura e montaggio `roof`.**
  - **Voci di upgrade:** una voce può essere l'upgrade di una struttura invece di una funzione di stanza: `{upgrade:{variant,value}, active?(s), model, source, mount}`. Vale per ogni struttura con `structureVariant(s,variant)===value` per cui `active(s)` è vero. L'elemento ha `index:'v:'+chiave` al posto dello slot della stanza, gli HP stanno nella stessa `roomExteriorHp`. `roomExteriorSpec(fn)` resta riservata alle funzioni di stanza; `hasRoomExterior(s)` risponde per entrambi i tipi.
  - **`mount:'roof'`:** sull'apice di un tetto a piramide o rotondo, a metà colmo di un tetto a due falde o a padiglione, in cima al tetto Blender di una torre di legno; ruota con la torre (il tetto rotondo resta ad angolo 0). L'ingombro in pianta e l'altezza vengono dal modello.
  - **Prima voce:** `bell`, il campanile della Campana d'allarme. La Colombaia dovrà usare lo stesso montaggio.
  - **Renderer:** le torri di legno disegnano i loro triangoli nella mesh di `settlement-wood3d.js` (il castle 3D e il 2.5D le saltano). Una torre in cutaway tiene il suo tetto, quindi anche l'elemento del tetto.
- **Prima applicazione, Latrina / Garderobe:** solo al piano 2 di una **torre W1 in pietra**, sulla faccia esterna libera che guarda più lontano dal castello (correzione dell'utente del 04/11/2026: mai nelle sezioni costruite, né nelle torri W2–W3 o di legno). Le torri W1 tengono la scala a chiocciola e accettano solo Colombaia, Latrina, Prigione, Tesoro e Armeria. È una scatola di pietra a sbalzo di 0,36 U, larga 0,46 U, su 4 mensole, con lo scarico che macchia il muro fino a terra.
  - **Igiene della guarnigione:** è un bisogno secondario. Il cortile serve 24 soldati, ogni latrina ne serve altri 16 (32 in una stanza grande). L'igiene non scende sotto 40 e cala di 2 al giorno, risale di 5. Sotto 50 si ammala fino al 10% degli arcieri, che lasciano libere le postazioni.
  - **Motivo:** l'utente non vuole che la latrina diventi un sistema obbligatorio; i castelli piccoli non ne risentono.
  - **Prova:** `qa/room-exterior-latrine-regression.cjs`.

## D-COMBAT-RENDER — Confine tecnico del combat (03/11/2026)

ConquerCombatRenderer gestisce soltanto stato di presentazione e disegno. Ordini, visibilità/LOS, percorsi, HP, tempo e code di effetti restano nel dominio combat/regole. Le regole non dipendono da Canvas o dal renderer ed espongono visualEffects() come vista temporanea da non mutare. Il renderer non avanza la simulazione. Il wrapper precedente di draw e lo scheduler condiviso restano unici. Nessuna modifica a D-046 o alle meccaniche; parità verificata su trace e pixel del canvas. Specifica in [COMBAT-RENDERING](../COMBAT-RENDERING.md).

## D-CUT-01 — Cutaway per piani (03/11/2026)

- **DECISO:**
  - **Un piano per volta.** Lo spaccato toglie i piani sopra quello in vista. Il piano si sceglie con ▲ ▼ ancorate sopra l'edificio selezionato e con la stessa riga nell'ispettore.
  - **Un solo modello** per castello (torri, porte, sezioni costruite) ed edifici civici.
  - **Default:** il castello resta con tutti i piani; gli edifici civici aprono il piano terra.
  - **Motivo:** interni ricchi ai piani alti restano leggibili se si vede un piano alla volta. Non si semplificano gli arredi.
- **Conseguenza per il Municipio:** una stanza per piano invece di più sale affiancate. Le stanze sono tante quanti i livelli civici: L1 = 1, il suo P1 resta senza funzione.

## D-GATE-01 — Torri agganciate a una porta: ingresso sul retro della porta (02/11/2026)

- **Regola, sempre:** una torre agganciata a una porta (qualsiasi socket `gate-*`, `parentTowerId` = la porta) ha l'ingresso al piano terra e il lato interno (finestre, porta, arredo del cutaway) verso il **retro della porta**, cioè l'interno della porta, qualunque sia l'angolo della torre o le mura attaccate. Vale per torri quadrate, rotonde e a D; la semitorre ha già la gola aperta sul retro e non riceve una porta. Le torri secondarie di un'altra torre restano senza ingresso al piano terra.
- **Codice:** `towerGateParent` / `gateRearVector` in `settlement-architecture.js`, usati da `structureInteriorVector` e `towerDoorSpecs` (e quindi da disegno 2.5D/3D, torce, navigazione e combattimento). Prova: `qa/gate-tower-entrance-regression.cjs`.
## 2026-11-03 — Consolidamento P0 / P2 / P3

Decisione esplicita dell'utente: P0 bridge, circle, jobmanager e knights; P2 messages; P3 verifica di pertinenza per le altre branch senza PR. Recupero dei soli residui, senza ricreare funzionalità integrate e senza PR superflue. I contratti D-046 (figure 2D), D-049 (unico allocatore economico) e la decisione ancora aperta D-051 restano invariati. Circle conserva le scorte strategiche in State.siege.stock: la conquista non può duplicarle o sottrarre inventario economico del villaggio per supposizione.


## D-CRIME-01 — Skeleton autonomo del sistema criminalità (02/11/2026)

- **DECISO per il laboratorio `/crime/`:** separare criminalità, ordine pubblico e tensione sociale. La severità, gogna e patibolo possono aumentare la deterrenza **ma anche il risentimento**; assistenza/ospizio e presidio agiscono su leve diverse. La sommossa è una fase di escalation, non un generico malus; la rivolta non viene risolta da un secondo sistema di combattimento.
- **CONTRATTO DI SVILUPPO:** solo fixture locali e deterministiche, salvataggio dedicato, nessuna mutazione del `State` canonico o duplicazione di popolazione/risorse. La gestione effettiva riuserà popolazione, economia, stanze e Combat quando sarà integrata.
- **DECISO (03/11/2026):**
  - **Tribunale:** è una stanza del Municipio, che ha una stanza per piano (tante quante i livelli civici, D-CUT-01) con un catalogo civico separato da quello del castello. Il tribunale richiede L2.
  - **Ospizio:** annesso della Chiesa L2.
  - **Guardia e prigione:** sono le funzioni di stanza esistenti (torri T2/T3, porte, sezioni costruite) e anche stanze (piani) del Municipio. La **prigione** sta solo al piano terra (P0), mai nelle porte, e ha **al massimo 5 detenuti per cella** (03/11/2026).
  - **Gogna, forca e patibolo:** tre strutture di piazza distinte e collocabili, sul contratto `eventVenue`, rappresentate vuote e sobrie. Anche in `/crime/` il patibolo è un flag separato dalla forca (prima «Forca / patibolo»); i salvataggi vecchi lo caricano spento.
- **ANCORA PROPOSTO/DA VERIFICARE:** soglie numeriche, eventi e durate; personale delle guardie; lettura delle strutture reali da parte di `/crime/`.
- [Specifica del prototipo](../crime.md). La roadmap strategica attuale resta invariata.


## D-MASTIO-01 — Ingresso rialzato del mastio (02/11/2026)

- L'ingresso rialzato è uno stato della torre mastio (`tower.keepEntrance`), non un nuovo tipo di struttura: progressione scala di legno → scala in pietra, levatoio come accessorio indipendente dalla scala. Solo torri in muratura indipendenti di almeno 2 piani; costruito resta della torre anche se il mastio viene spostato.
- Con l'ingresso rialzato la torre non ha porta a terra: l'unico accesso dal suolo è il piede della scala, e nessuno con il levatoio alzato. Motivo: il mastio è l'ultimo rifugio (D-011), il levatoio lo rende difendibile anche a mura cadute.
- L'ariete non colpisce il battente del mastio: sta al primo piano, fuori portata di un ariete a terra, ed è proprio il motivo storico dell'ingresso rialzato. Contro il mastio chiuso l'assalitore brucia la scala di legno (o, quando ci saranno, porta scale d'assalto al pianerottolo). Il mastio non ha porte verso il cammino di ronda (regola valida per ogni mastio): non si entra dalle mura né lo si attraversa.
- Gli assalitori prendono il mastio chiuso con una scala d'assalto alla porta: il battente alzato ha una resistenza propria e si abbatte a colpi d'ascia (o si brucia); senza battente la porta non oppone resistenza. Non si usa il riempimento dei fossati (serve alle macchine pesanti, non a raggiungere un primo piano).
- Scala o battente distrutti non isolano gli occupanti: calano una scala a pioli dalla porta e la ritirano davanti al nemico.

## D-MARCH-01 — Modalità attacco e conquista facoltativa (30/10/2026)

**VINCOLO DI GAME DESIGN:** il giocatore può guidare una compagnia militare sulla world map al posto di gestire direttamente un feudo. Una volta arrivato può razziare, iniziare un assedio o ritirarsi. Razzia e distruzione anche soltanto parziale sono **persistenti** e non obbligano a terminare l'invasione. Il giocatore può interrompere un'operazione in qualsiasi momento. Anche dopo aver espugnato le difese **l'annessione è un comando volontario**, non l'esito automatico dell'assedio; la campagna può proseguire.

**CODICE DIMOSTRATIVO SOLO SUL BRANCH feature/march-skeleton:** /march/ implementa la sequenza sopra su fixture isolate, non ancora sui feudi della partita. La vittoria è immessa soltanto da un tasto TEST e non è un'assalto simulato. Nella V1 World/Feudal, Combat, Siege, economia e save saranno quelli condivisi: niente doppio ledger o secondo motore d'assedio. [Specifica](../march.md).


## D-PANELS-01 · Centro di controllo del feudo (29/10/2026)

**DESIGN e codice sulla branch `panels`, non su `main`:** i pannelli di controllo sono un livello di osservazione/gestione nel Profilo della partita, non uno stato economico parallelo. Nove aree (Generale, Popolazione, Economia, Proprietà, Scorte, Militare, Cantieri, Diplomazia, Avvisi), usando `ConquerGame.read` e comandi del motore. Lo storico è mostrato solo dove esiste (`balanceHistory` mercato settimanale); nessuna serie fittizia. Distinguere scorte economia/Siege e numero di soldati effettivi/capienza caserme. **Festività, diplomazia avanzata e leve reali restano TBD**, come descritto in [management-panels](../management-panels.md). Nessuna modifica alle priorità della roadmap M0–M5.

## Hardening strade e WebGL (23/10/2026)

**D-FIX-01 · CODICE SU BRANCH `fix/main-founding-dev-webgl-20261023`:** ogni programma shader WebGL2 possiede il proprio VAO: abilitazioni e associazioni degli attributi non passano a programmi diversi quando viene eliminato un buffer di mesh. Rimangono il polling differito di D-038 e il fallback Canvas per errori veri; nessuna nuova query GPU sincrona nel disegno. La riparazione delle arterie prepara segmenti e ponti cedendo il controllo anche durante le scansioni dei fiumi; sostituisce la route e apre i corridoi forestali solo dopo una verifica finale della revisione di navigazione. Annullare la preparazione non pubblica topologia parziale e conserva quella precedente. Il percorso sincrono usa lo stesso generatore di ponti. Motivazioni e prove nel [report](../main-fixes-diagnosis-2026-10-23.md); nessuna modifica al contratto dei default DEV automatici o alla roadmap.

> **Stato codice riconciliato al 23/10/2026:** D-LAB-01 e D-042 sono implementati in `main`. Le specifiche e decisioni sono invariate; cambia soltanto il riferimento di integrazione. [Audit](AUDIT-2026-10-23.md).


> Data di **registrazione**: 2026-10-16. Le date originali di decisione non sono ricostruite dove non verificabili.
> Classi: **VINCOLO** (principio espresso), **DESIGN** (direzione esplicita ma non prova di codice), **CODICE** (contratto osservato), **PROPOSTA**, **APERTO** (conflitto/decisione necessaria).

## Converge — regole assedio (20/10/2026)

**Applicazione D-031/D-032 sulla branch `converge`:** le restrizioni delle armi contro mura, torri e gatehouse sono implementate nel motore attuale, preservando il sistema di campate, le brecce e la separazione fra portone e torre-porta. Test dedicati disponibili, QA su pull request necessaria. La vecchia branch `assedio` non va fusa integralmente.

**Riallineamento PR #61 (23/10/2026):** D-031/D-032 si applicano insieme a D-042: le immunità dei nuclei non proteggono la grata. I colpi alla porta continuano a raggiungere prima la grata abbassata, il fuoco la attraversa; restano tre integrità indipendenti. Conservati gli aggiornamenti di `main` fino a `518e830`, inclusi terrapieni e ridisegno coalescente.

## Asset Lab (23/10/2026)

**D-LAB-01 · CODICE SU MAIN dopo PR #81 (originariamente branch `feat/asset-lab-complete-catalog`):** il Lab non duplica la geometria del castello. Per le strutture che dipendono dall'intero motore (terreno, impronte, merli, tetti) carica il gioco in un iframe nascosto `index.html?assetlab=1`: in questa modalità `window.__CONQUER_ASSET_LAB__` blocca `saveLocal`, legge uno slot vuoto, salta Supabase e telemetria remota. Le varianti mostrate sono quelle di `ConquerSiegePreview.GALLERY`; le nuove varianti si aggiungono lì, non nel Lab.

**D-LAB-02 · CODICE su branch `feat/asset-lab-audit`:** l'audit visivo usa i renderer del Lab e del gioco, mai un renderer parallelo. Gli stati delle fortificazioni sono quelli del gioco (`constructionProgress`, fasi di `galleryPhases` via `ConquerSiege`, `structureCutaway`). La baseline `qa/asset-audit-baseline.json` si aggiorna solo dopo la revisione dei fogli provini; i problemi accettati si registrano come deroghe con motivo, non abbassando le soglie. In sandbox `?assetlab=1` non gira la simulazione e il seed è fisso.

## Aggiornamento clay (19/10/2026) — solo design, non codice

**D-CLAY-01 · DESIGN:** introdurre Argilla (`clay`) come materia prima e mattoni cotti (`brick`) come materiale alternativo alla pietra per costruzioni murarie e fortificazioni; variante rosso/marrone della muratura esistente e **durabilità massima 80%** rispetto alla pietra, senza duplicare geometrie o sistemi di combattimento.

**D-CLAY-02 · DESIGN:** la Cava esistente può produrre `stone` sulla roccia ripida oppure `clay` vicino a fiumi/torrenti/laghi (**entro 6 U**); nessuna nuova cava tipologica né fornace/risorsa `brick`. I lavoratori rimangono L2 e si usa il ledger unico.

**D-CLAY-03 · DESIGN:** la conversione riguarda tutti gli elementi che consumano pietra e ne cambia costi e rendering; materiali selezionabili per singolo elemento costruibile per consentire castelli misti. Porte lignee e strutture in legno restano indipendenti. Vasellame rimandato a un'eventuale specializzazione L3.

**D-CLAY-04 · CONTRATTO TECNICO DA SVILUPPARE:** proteggere la compatibilità con `Civil`: `material` ha già il significato wood/stone su tower/gate e la migrazione attuale non accetta `brick`; `State.resources` e ledger sono separati; nessuna affermazione di implementazione finché non si risolvono questi punti con QA. Guida: [CLAY-DEVELOPMENT](../CLAY-DEVELOPMENT.md), [piano QA](../CLAY-REGRESSION-PLAN.md).

## Aggiornamento Civil (17/10/2026)

**D-CIV-01 · DESIGN esplicito:** chiesa e locanda hanno lotti Voronoi di pertinenza; il mercato non ha un lotto privato. Applicazione attraverso il sistema catastale già condiviso con le abitazioni, senza duplicare recinzioni. La piazza è un nuovo edificio pubblico e non genera un lotto di pertinenza.

**D-CIV-02 · DESIGN esplicito:** tre livelli di sviluppo (L1–L3) per edifici civili esistenti chiesa/locanda/mercato e nuova Piazza; tre varianti di Piazza (pavimentata, fontana, verde). Nella prima iterazione il livello è **skeleton di configurazione**, non un modificatore economico o di servizi; le forme/scale definitive restano future. Fonte tecnica: branch [`Civil`](https://github.com/erykwest/CONQUER/tree/Civil), `src/settlement-core.js`, `src/settlement-urban.js` e pannello `src/settlement-app-rooms.js`.

**D-CIV-03 · DESIGN/CODICE su branch `Civil` (17/10):** ogni annesso civile è una struttura separata con `parentId` verso chiesa, taverna o mercato, tipo da catalogo (`annexType`), footprint e sblocco per `civicLevel`. Chiesa/taverna: costruzione solo dentro il lotto Voronoi; mercato: estensione pubblica vicina al mercato, vietato occupare lotti privati. I figli vengono eliminati insieme al padre; il livello non può scendere sotto il requisito di un annesso esistente. Per ora nessuna produzione, capacità, staff o costo, e rendering 2D/3D provvisorio. Dimensioni, limiti quantitativi e raggi sono valori di skeleton da rivedere al bilanciamento.

**D-CIV-04 · DESIGN/CODICE su branch `Civil` (17/10):** alla chiesa **L1** spetta già un **cimitero interno al lotto Voronoi**, non da costruire manualmente: è una componente derivata del terreno di pertinenza, visibile con tombe schematiche e riservata agli annessi ulteriori. Quando il lotto non offre spazio sufficiente, non esce dai suoi confini. La taverna sblocca a **L2** una **estensione birreria** costruibile, che deve stare vicino alla struttura madre e nello stesso lotto. Resta uno skeleton, senza funerali, produzione di birra o gestione di personale.

## Registro delle decisioni

| ID | Classe | Decisione o regola da preservare | Conseguenza |
|---|---|---|---|
| D-001 | VINCOLO | Sviluppare prima interazioni solide e coerenti; grafica migliorabile in seguito. | La milestone si chiude con comportamento verificato, non con asset. |
| D-002 | DESIGN | Evitare proliferazione di risorse e catene: beni principali Cibo, Legno, Pietra, Metallo; Oro come valuta, Equipaggiamento come trasformato. | Quattro nodi produttivi principali e funzioni nelle strutture; **nota:** il ledger attuale contiene anche `luxury` — non eliminarlo senza decisione. |
| D-003 | CODICE/DESIGN | Economia civile aggregata per coorti L1–L4; figuranti visibili non diventano automaticamente agenti contabili autonomi. | Non duplicare produzione o salario per ogni figurante animato. Fonte: [economy.md](../economy.md). |
| D-004 | DESIGN | `tier` civile e `currentJob` distinti; fallback almeno L2→L1 quando un lavoro specializzato manca. Militari e cavalieri fuori dalla gerarchia civile. | Riassegnazione lavoratori e stagionalità coerenti. |
| D-005 | CODICE | Lavoro ordinario Mon–Ven; sabato mercato, domenica riposo nel ledger attuale. | Calendario unico anche per animazioni e attività, dopo riconciliazione. |
| D-006 | DESIGN | Economia territoriale: bioma e idoneità locale → poli produttivi → villaggi → capitale feudale → capitale regno. | Non introdurre meccaniche di tributo prima del surplus reale. |
| D-007 | DESIGN | Logistica locale ordinaria astratta attraverso connettività; **carovane fisiche** per tributi, tesori e rifornimenti strategici intercettabili. | Ridurre costi simulativi; una carovana deve avere vero carico e transizione World→Combat. |
| D-008 | DESIGN | Quattro poli: Farm Hub, Logging Camp, Cava, Miniera. Fabbro/mercato/servizi e Built Sections coprono funzioni accessorie. | Niente catalogo di 20 strutture intermedie. |
| D-009 | DESIGN | Araldica come **SVG rettangolare indipendente dal supporto**: `patternId+C1+C2+symbolId+C3+C4`; clipping nell'oggetto. | Un singolo editor Profile Panel propaga alle istanze condivise. |
| D-010 | DESIGN | Assedi con tempo continuo, attacco e blocco, consumo delle riserve, accessi multipli indipendenti, sortite, rinforzi e resa. | Bloccare davvero *tutti* gli accessi utili prima di affamare una fortezza. |
| D-011 | DESIGN | Mastio assegnabile a una torre esistente, unico per castello; difesa progressiva e ripiegamento di truppe/civili. | Ultimo obiettivo tattico, non un edificio duplicato. |
| D-012 | DESIGN | Funzioni del castello in Built Sections/tower slot: deposito, granaio, caserma, armeria, scuderie, comando ecc. | Capienza e vincoli di piano/accesso prima dei grandi assedi. |
| D-013 | DESIGN | Fortificazioni: palizzate, fossati, ponti, levatoi, basamenti; materiali/danni localizzati e incendi. Nessuna polvere da sparo. | La struttura è parte della navigazione e della guerra, non solo del renderer. |
| D-014 | DESIGN | Milizia temporanea: civili reclutabili passano da armeria a slot; altri civili si rifugiano; guarnigione regolare ha priorità. | Vincoli di percorso, armi, capienza e costo reale. Regole demografiche specifiche da rifinire. |
| D-015 | DESIGN | Audio contestuale: ambiente dinamico per stagione/meteo/giorno; edifici/unità attivati da selezione o zoom; crossfade e budget voci. | Assets locali sono sorgente, non contenuto automaticamente disponibile a Git. |
| D-016 | DESIGN | Distribuzione indie iniziale leggera, con possibili devlog, pagina gioco, follower, sostegno volontario. | Pubblicazione/Steam/cessione concept non sono decisioni di sprint. |
| D-017 | VINCOLO TECNICO | Simulazione e grafica il più possibile separate; evitare motori duplicati; seed e persistenza compatibili. | Audit moduli e test prima di un refactor ampio. |
| D-018 | VINCOLO OPERATIVO | Modifiche su branch da main, QA, PR e deploy Vercel automatico solo su main. | Fonte prescrittiva: [AGENTS.md](../../AGENTS.md). |
| D-019 | DESIGN ESPLICITO (ECONOMY 12/10) | Proprietà produttive *lord* o settore privato **L4 aggregato**; il singolo figurante non ha capitale/contabilità propria. | Case/attività fisiche, bilanci per coorte. [Fonte](sources/ECONOMY-2026-10-12.md). |
| D-020 | DESIGN ESPLICITO (ECONOMY 12/10) | Quote aggregate vendita **0/25/50/75/100%** per tipo signorile + target riserva; oltre il target si offre l'eccedenza, oro solo a transazione conclusa. | Prezzi da domanda/offerta locale, domanda estera esplicita. [Fonte](sources/ECONOMY-2026-10-12.md). |
| D-021 | DESIGN ESPLICITO (ECONOMY 12/10) | Produzione giornaliera, consumo e scambi settimanali, salari/investimenti mensili, rivalutazione salari e redditività annuali; campi abbandonati dopo 3 annualità negative, altri privati dopo 2. | Guerra interrompe produzione anche per pochi giorni; L4 richiede 20% di margine netto. [Fonte](sources/ECONOMY-2026-10-12.md). |
| D-022 | DIREZIONE TECNICA (VISUAL 14–15/10) | Mantenere araldica e animazioni procedurali condivise; verificare cache/LOD e prestazioni prima di rasterizzare o costruire un nuovo Asset Manager. | I prerender locali non provano deploy. [Fonte](sources/VISUAL-AUDIO-2026-10-14.md). |
| D-023 | PROPOSTA STORICA (VISUAL 15/10) | Valutare prototipo **3D semantico** rispetto a sprite prerenderizzati, considerando torre/mura, cutaway, cantiere, danni e fallback. | **SUPERATA QUANTO ALL'ASSENZA DEL RENDERER** da D-028: un WebGL2 3D ora esiste su main; pipeline definitiva e parità in tutti gli scenari non certificate. [Fonte storica](sources/VISUAL-AUDIO-2026-10-14.md). |
| D-024 | PREFERENZA ESPLICITA (MUSICA 15/10) | Per i prompt Suno: **Style e Lyrics separati**; Lyrics soltanto descrittivo; Style sotto **1000 caratteri**. | Suno Pro dichiarato acquistato, brani/licenze da inventariare; non presume audio integrato. [Fonte](sources/VISUAL-AUDIO-2026-10-14.md). |
| D-025 | PRINCIPIO TECNICO (MINIMAP 15/10) | Il LOD cambia solo la rappresentazione della stessa entità; i marker nemici rispettano la visibilità tattica. | **STATO PR STORICO SUPERATO DA D-029**: [PR #44](https://github.com/erykwest/CONQUER/pull/44) integrata il 16/10; principio invariato. [Fonte storica](sources/MINIMAP-2026-10-15.md). |

| D-026 | PREFERENZA ESPLICITA (AUDIO 14/10) | Ambiente sonoro legato a stagione/meteo/giorno-notte; **SFX di edifici/unità soltanto se selezionati o con zoom almeno 30%** (soglia di ingrandimento). | Dissolvenze, distanza, budget sorgenti e legame con stati reali; [Fonte Pixabay](sources/PIXABAY-SOUNDS-2026-10-14.md). |
| D-027 | DIREZIONE ASSET (AUDIO 14/10) | Libreria SFX **repertoriata su Drive**, non da presumere nel Git: 24 MP3 contati nel thread, senza ascolto qualità; preservare provenienza/licenze file per file. | Evitare distribuzione indistinta di raw file in repo pubblico, testare duplicati e manifest; [Fonte Pixabay](sources/PIXABAY-SOUNDS-2026-10-14.md). |

| D-028 | CODICE SU MAIN (15/10) | Renderer WebGL2 di castello e mondo integrato con [db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697); attivato per default ove disponibile, Canvas fallback/opt-out con [cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0). | La scelta operativa del renderer esiste; **non** certifica import glTF, prestazioni universali o separazione totale stato/disegno. Supera solo la parte fattuale della proposta D-023. |
| D-029 | CODICE SU MAIN (16/10) | [PR #44](https://github.com/erykwest/CONQUER/pull/44) integrata al commit [2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9). Minimappa navigabile, LOD militare e marker ostili rispettosi di `spotted()`. | Supera lo **stato storico** della PR aperta indicato in D-025; non chiude QA browser/mobile né autorizza a dichiarare LOD edilizio nella scena principale. |
| D-030 | CODICE SU MAIN (15–16/10) | Illuminazione ambientale per stagioni/meteo/ora ([PR #43](https://github.com/erykwest/CONQUER/pull/43)) e Nightlight WebGL2 emissivo con fallback ([PR #47](https://github.com/erykwest/CONQUER/pull/47)) integrati. | Presentazione basata sullo stato esistente; effetto sulle prestazioni e confronto A/B controllato da validare. |

| D-031 | VINCOLO DI DESIGN ESPLICITO (ASSEDIO 16/10) | **Attacchi ordinari delle unità e frecce non danneggiano mura né torri**: danno strutturale 0. Non basta essere un bersaglio selezionabile; arma/azione e tipo di elemento devono risultare compatibili nella matrice dei danni. | S-05/S-16: vietare la perdita di HP di murature e torri per attacco ordinario, indipendentemente dalla loro integrità; prevedere QA deterministiche contro bypass e impatti incompatibili. Nessuna modifica runtime in questo commit. |
| D-032 | VINCOLO DI DESIGN ESPLICITO (ASSEDIO 16/10) | **Torre-porta e portone possiedono due valori di durabilità separati**: uno per la struttura della torre, uno per il portone vero e proprio. Ogni impatto agisce sulla durabilità del componente effettivamente colpito, non sull'altra per semplice associazione spaziale. | S-22/S-24/S-25: attacco/incendio del portone non rimuove automaticamente HP alla torre-porta; distruzione del portone sblocca il passaggio secondo lo stato della navigazione, senza distruggere la torre. Regole del possibile crollo della struttura da specificare, non inventate. Nessuna modifica runtime in questo commit. |
| D-033 | CODICE + VINCOLO ESPLICITO (TERRAFORMING 19–20/10) | Il Builder offre **Terreno** e **Terrazzamento murato** con ghost non distruttivo; un terrazzamento murato non può sovrapporsi a un altro terrazzamento murato. **Chiarimento definitivo: il terrazzamento è un gradone VERTICALE color muro, con piano superiore piatto.** La collina naturale mantiene i pendii esistenti. Il magnete tiene conto dello spessore delle mura. | Stato persistito in `State.relief.terraforming`; migrazione dei terrazzamenti inclinati al profilo verticale. Canvas e WebGL2 usano facce verticali; il WebGL2 ritaglia il terreno al bordo evitando triangoli inclinati. Mutazione e invalidazione solo alla conferma. QA: `qa/terraforming-regression.cjs`; branch `terraforming`. Superata la precedente interpretazione spiovente del 20/10. |

| D-034 | CONTRATTO TECNICO LOCALE (20/10/2026) | La manutenzione stradale dopo un completamento usa gli stessi generatori e le stesse collisioni del percorso sincrono, con budget cooperativo 6 ms e revisione della navigazione verificata prima del commit. Un completamento non invalida il catasto se non lo modifica; i completamenti delle arterie aggiornano le facciate dense. Il renderer confronta il contenuto dei lotti e attende una fence con polling a timeout zero prima di leggere gli errori GPU. | Motivazione: A* sincrono, texture terreno ricostruite senza necessità e `getError` bloccante riprodotti nell'[audit del 20/10](../construction-performance-audit-2026-10-20.md). Evita riduzioni della risoluzione o rimozione del fallback. Codice locale su `fix/construction-completion-perf`, non su main; QA in `qa/construction-completion-regression.cjs`, `qa/webgl-error-poll-regression.cjs`, `qa/construction-performance.cjs`. |

Le voci DESIGN sono decisioni di *indirizzo/progetto*, **non** affermazioni che il comportamento sia già implementato.

**D-035 · CONTRATTO TECNICO LOCALE (20/10/2026):** danni ai soli HP modificano stato persistito e overlay dinamico, senza invalidare navigazione/catasto o ridisegnare sincronicamente. Nell'app completa fuoco e crolli richiedono un frame al ciclo di simulazione condiviso; il dominio mantiene il proprio comportamento e il fallback standalone. Le macerie ferme usano un buffer GPU per contenuto/rotazione, quelle in caduta restano dinamiche. Il cutaway WebGL riusa la cache composita esistente limitata a 32 MiB per pareti/arredi; occupanti, danni, selezione e propagazione restano guidati dallo stato originale. Motivo e alternative verificate: [audit round 2](../fire-collapse-cutaway-performance-audit-2026-10-20.md). Codice locale su `fix/construction-completion-perf`, non rilasciato; nessuna riduzione di frammenti, collisioni o regole del fuoco. I colli Canvas/brigata rimangono espliciti.

**D-036 · CONTRATTO TECNICO LOCALE (20/10/2026):** i percorsi della brigata usano
lo stesso A* del chiamante sincrono, esposto anche come generatore e consumato con
budget condiviso indicativo di 4 ms. Priorità rotante tra addette e cancellazione
su revisione della navigazione; una rotta fallita non autorizza un segmento diretto
attraverso gli ostacoli. Sagome/costi dei nodi sono memo della singola ricerca;
le tangenti a pozzi/torri tonde richiedono distanza continua dal segmento.
Le macerie Canvas sono memorizzate soltanto quando tutte le mesh sono ferme,
nella cache composita esistente da 32 MiB: ordine del painter preservato, pan
riutilizzabile, nuove mesh/proiezione cambiano chiave. Il raggruppamento di triangoli
consecutivi dello stesso colore riguarda il primo disegno statico; niente culling
né riduzione dei frammenti. Motivo, alternativa scartata e prove:
[audit round 3](../movement-collapse-performance-audit-2026-10-20.md),
`qa/movement-path-performance-regression.cjs` e benchmark browser. Il costo dei
crolli ancora in movimento e la variabilità dei frame restano espliciti. Codice
locale su `fix/construction-completion-perf`, non rilasciato.

**D-037 · CONTRATTO TECNICO LOCALE (21/10/2026):** nel test 40 contro 30 un
fante/arciere individuale è una sola entità e una sola figura, distinto dalle
squadre/pattuglie esistenti. I tipi persistiti includono `infantry` e `archer`;
il profilo dell'arciere non richiede un secondo campo ridondante. Il motore del
tiro è condiviso fra entrambi gli schieramenti tramite argomenti aggiuntivi
opzionali di `ConquerCombatRules.update`, compatibili con i chiamanti precedenti.
I record mobili mantengono il proprietario e non autorizzano un tiro da un morto
o da chi è in mischia/sulle scale. Portata/distanza precedono collisioni e LOS
costose; i loro verdetti restano necessari per le coppie vicine. Nessuna modifica
ai valori di HP, armatura, dado o danno strutturale. Il driver QA invia ordini
attraverso i percorsi reali; non decide morti o danni e non costituisce una nuova
IA strategica. Motivazione e prove: [audit 40/30](../mass-battle-performance-audit-2026-10-21.md).
Codice locale oltre `9e1b6a5`; il picco `getError` rimane aperto, il tentativo di
fence aggiuntive non è stato mantenuto.

**D-038 · CONTRATTO TECNICO LOCALE (21/10/2026):** le animazioni militari in
pausa condividono il ciclo visuale della simulazione con incendi e crolli;
il modulo del combattimento non avvia un secondo RAF per ridisegnare la scena.
Il controllo errori WebGL mantiene la verifica per perdita del contesto a ogni
disegno, ma distanzia le query sincrone `getError` di almeno 1 s. La fence viene
emessa dopo front/luci e mantiene l'età iniziale quando sostituita: dopo 1 s di
attesa il controllo viene comunque eseguito, accettando un possibile blocco
residuo invece di nascondere gli errori sotto carico continuo. Errori, wait
fallita e allocazione sync fallita conservano il fallback Canvas.
Questa scelta riduce i costi cumulativi; **non elimina le singole attese GPU**
né certifica FPS a 1×. Il contratto aggiorna il posizionamento del checkpoint
descritto da D-034; il tentativo di sole fence aggiuntive ricordato in D-037
resta scartato. Nessuna modifica al framebuffer o rinvio dei frame viene
mantenuta. Motivazioni, esperimenti e misure nell'[audit esteso](../mass-battle-performance-audit-2026-10-21.md).
Codice locale oltre `9e1b6a5`, nessuna nuova pubblicazione.

## Nuovi contratti registrati dall'audit del 21/10/2026

**D-039 · VINCOLO OPERATIVO / PR:** quando una pull request (anche con base non `main`) modifica sorgenti, QA, asset o runtime, i cambiamenti della **stessa PR** includono `docs/context/STATUS.md`, `docs/context/BACKLOG.md`, `docs/context/CHANGELOG.md`. `ROADMAP.md` e `DECISIONS.md` devono essere aggiornati **quando** evolvono milestone, architettura o scelte; in assenza di cambi, la PR le dichiara esplicitamente invariate. È attivato un check automatico `Context sync`: verifica la presenza dei tre file nel diff, non la correttezza semantica. [Procedura](PR-WORKFLOW.md). Il blocco *effettivo* del merge richiede che il check sia reso obbligatorio da branch protection/ruleset GitHub; `main` risultava non protetta al 21/10.

**D-040 · CODICE SU MAIN / limite funzionale:** [PR #71](https://github.com/erykwest/CONQUER/pull/71) implementa rappresentazione e utensili dei lavoratori/cantieri; **non** dimostra da sola consumo reale di lavoro L1 e scorte. Tale integrazione è dichiarata in [PR #55](https://github.com/erykwest/CONQUER/pull/55) tuttora OPEN. Animazione = osservabilità; contabilità/squadre disponibili = meccanica, da provare separatamente.

**D-041 · CODICE SU MAIN / limite assedio:** [PR #73](https://github.com/erykwest/CONQUER/pull/73) aggiunge terra di riporto d'assalto compatibile col terrain boolean corrente; **non** implica implementazione di tutte le macchine o condizione di resa per blocco. Requisiti S-01–S-25 rimangono chiusi solo con prova di comportamento di ogni sistema.

## Eventi (branch `events`, 22/10/2026)

**D-044 · VINCOLO DI DESIGN ESPLICITO (EVENTI 22/10; registrata sulla branch come D-042, rinumerata al merge per la collisione con D-042 portoni):** lo spiazzo polivalente per eventi programmati misura **14 × 10 U** (lato lungo sull'asse x locale, fronte a −y), non più 6 × 10 come nello skeleton iniziale. **Motivazione:** il 6 × 10 risultava evidentemente troppo piccolo per giostra, circo e sagra a grandezza reale; con 14 × 10 entrano liste di oltre 10 U con quattro tribune, il tendone con carri e tende, la sagra con quattro bancarelle e otto tavoli, e anche l'arena a U. **Alternative scartate:** 6 × 10 con oggetti rimpiccioliti; taglie multiple (rinviate). **Impatto:** `VENUES.festivalGround` e `SETUPS` in `src/settlement-events3d.js`, `qa/events3d-regression.cjs`, [docs/events/README.md](../events/README.md).

**D-045 · VINCOLO DI DESIGN ESPLICITO (EVENTI 22/10; già D-043 sulla branch):** tribune, arena e palchi seguono l'araldica del regno; tende dei cavalieri, rastrelliere e armature usano coppie casuali tra rosso, blu, giallo, verde e bianco (estesi oltre i primari perché le 8 tende dell'arena superano le 6 coppie possibili), **mai due tende con la stessa coppia nello stesso spazio**; in arena, torneo e circo le tende hanno rotazione casuale ±40° e spostamento fino al 75% della loro misura; merci scatter, rastrelliere e armature in ogni allestimento hanno orientamento libero (scatter) o ±35° e spostamento fino al 200%; ogni spostamento è scartato se urta un altro oggetto o esce dal lotto (si riprova più vicino, al limite resta nella posizione di base); festoni, circo e stoffe del palco degli artisti mantengono colori festosi fissi.

**D-042 · DECISIONE ESPLICITA + CODICE SU MAIN dopo PR #76 (23/10/2026; originariamente branch `portoni`):** la **grata (saracinesca)** è uno **strato difensivo separato**, non un bonus di resistenza della porta. Estende D-032: il portone in pietra con grata ha tre durabilità indipendenti (torre-porta `core`, grata `portcullis` 120 HP, porta `door`). Una grata abbassata assorbe i colpi diretti alla porta (ariete, macchine) finché non è distrutta; il **fuoco** la attraversa e colpisce la porta. Abbassata sbarra il passaggio anche a porta aperta o sfondata; distrutta resta piegata e mezza alzata, non sbarra nulla e va riparata. L'accesso è violato solo con porta sfondata **e** nessuna grata abbassata (`gateBreached`).

## Cavalieri e diplomazia (PR #72 portata su main in 2D, 28/10/2026)

**D-046 · DECISIONE ESPLICITA DELL'UTENTE (28/10/2026):** umani e animali, cavalli compresi, restano **figure 2D** (disegno piano / billboard). Le mesh 3D generate con Blender per figure umane e animali sono scartate: niente `settlement-knights3d.js`, `knight-models.js`, `tools/blender/build_knights.py` né stile «flat» delle mesh 3D. Cavalieri a cavallo e messaggero usano solo `ConquerMounted2D` (`src/settlement-mounted2d.js`, il cavallo 2D approvato di `settlement-animals.js` con l'aggancio `onBody`). **Alternative scartate:** cavaliere 3D disegnato piatto (PR #72) e 3D a facce ombreggiate. **Impatto:** `drawMountedKnight` in `settlement-combat.js` e `ConquerDiplomacy.draw`; `qa/diplomacy-regression.cjs` fallisce se ricompaiono `ConquerKnights3D`/`ConquerKnightModels`. Le carovane della diplomazia restano separate dai convogli dell'economia (#55): l'unificazione è un lavoro successivo, attraverso l'interfaccia `window.ConquerDiplomacy`.


## Economia — lavoro L1 unico (28/10/2026)

Le decisioni D-033…D-038 delle branch #55 e `jobmanager` avevano numeri già usati su `main` per altri temi: sono riportate qui con numeri nuovi.

**D-047 · CODICE SU MAIN dopo #98 (da #55, 19–20/10):** dopo la fondazione il Builder usa le scorte e la tesoreria di `ConquerEconomy`; `State.resources` è solo la proiezione per la UI. La fondazione dà una dotazione una tantum e 4 L1 fondatori senza casa. Bilancio settimanale per bene: prodotto, domanda, soddisfatto, carenza per offerta o per denaro, trend a 4 settimane. Con `?dev=1` il minimo di 10000 si applica alle scorte del castello.

**D-048 · CODICE SU MAIN dopo #98 (da #55, 20/10):** i cantieri manuali avanzano solo con L1 reali: giornate-operaio lun–ven, al massimo 3 L1 per cantiere, percorso pedonale raggiungibile, salario pagato dal signore per il lavoro svolto (cantiere fermo se la tesoreria è vuota). Strade, case e campi procedurali conservano i timer.

**D-049 · CODICE SU MAIN dopo #98 (unifica #55 e `jobmanager`):** un solo allocatore L1, `ConquerEconomy.laborAllocation`. Ordine: industrie; pastori protetti (case `goat`/`shepherd`, almeno uno per gregge, di più se il cibo accessibile copre meno di 14 giorni); cantieri; taglialegna (prima dei cantieri solo con legna bassa); pastori di ritorno al gregge; liberi. Il pascolo produce 0,9 cibo privato per pastore e giorno lavorativo. Non si porta `ConquerJobManager`. **Alternativa scartata:** il modello di cantiere di `jobmanager` (`workRequired` con priorità), che duplicava D-048.

**D-050 · CODICE SU MAIN dopo #98 (da `jobmanager` D-034, 20/10):** il villaggio compra il cibo al mercato; il castello dà razioni solo per ordine del signore, salvato in `State.policies.rations` (`market` predefinito, `half`, `full`; i vecchi valori numerici valgono `market`). Le razioni escono davvero dal magazzino. Felicità separata L1–L4: sale se la classe mangia, scende con fame e mezze razioni, sale con razioni piene; il benessere è la media pesata. Servi L1/L2 vincolati al feudo, L3/L4 liberi: la migrazione non è implementata.

**D-051 · DECISO 05/11/2026:** scelta esplicita dell’utente: i campi sono lavorati esclusivamente dagli L2. Nel branch fix/fields-l2-only allocazione economica e assegnazione fisica escludono gli L1, anche nei salvataggi esistenti. Senza L2 disponibili le lavorazioni agricole restano ferme. Chiusa la scelta residua di jobmanager; archivio conservato nel tag archive/jobmanager.
**D-052 · CODICE SU MAIN dopo #99 (da `jobmanager` D-035/D-036, 20/10):** routine settimanali visuali. Uomini adulti: lavoro fino alle 18:00, poi svago (`LEISURE_VENUES`: locanda, mercato, pozzo); sabato mattina mercato, domenica mattina messa, pomeriggi di svago. Donne adulte: L1/L2 lotto al mattino, L3 mercato, L4 svago; sabato mercato, domenica messa, pomeriggi di svago. Solo strutture completate e raggiungibili, nessun teletrasporto; nessun effetto economico. Lo svago serale e il weekend hanno la precedenza sui pastori.
**D-053 · CODICE SU MAIN dopo #101 (unifica #55 commercio e `feature/autonomous-urban-economy`):** un solo catalogo di botteghe, quello urbano (7 mestieri → 5 Beni L3). Le botteghe nascono da sole nelle case L3 (una per casa, nessun comando del giocatore), con scelta pesata deterministica per seme; i prezzi dei Beni L3 della settimana N usano solo le osservazioni della N-1, aggiornando un bene al giorno. Le vendite spostano monete esistenti dalle famiglie al portafoglio L3. I Beni L3 restano fuori da `ConquerEconomy.GOODS` (UI aggregata «Beni L3»). Ricette e consumo di materie prime non sono ancora simulati. **Alternative scartate:** botteghe registrate a mano di #55 (`registerShop` resta come API) e moduli ES non collegati.
**D-054 · CODICE SU BRANCH `feature/economy-convoys` (unifica #55 convogli e #96 carovane):** un solo sistema, `ConquerConvoys`, salvato in `State.economy.commerce` (`lordConvoys`, `journeys`, `nobleJourneys`). Le carovane della diplomazia sono convogli del signore: oro, merci e provviste escono dal castello in un solo passo alla partenza (o all'accantonamento), altrimenti il convoglio resta bloccato; una merce per carro; scorta entro i posti di caserma. `ConquerDiplomacy` crea e modifica i convogli attraverso questa interfaccia e non tiene più una lista propria. Completa la nota finale di D-046. I cartelli di prova usano la mesh `signpost` di `ConquerScatterModel` e il `settlement-wagons.js` di main.
**D-055 · CODICE SU BRANCH `feature/economy-vehicles` (da `economic-balances-animations`, applica D-046):** i veicoli su strada sono `ConquerVehicles`, solo 2D: instradamento Dijkstra sulle strade completate, moto con accelerazione, curve e frenata, disegno con `ConquerWagons.drawWagon` e cavalli `ConquerAnimals.drawAnimal` alla scala di bestiame e cavalieri. **Alternativa scartata:** mesh 3D di carro e cavalli (`ConquerWagons3D`, `ConquerAnimals3D`, stile «flat») del branch d'origine.
**D-056 · CODICE SU BRANCH `feature/multi-wells` (30/10/2026, richiesta dell'utente):** più pozzi per villaggio. `State.village.wellId` resta il **pozzo fondatore**: unico a fondare il villaggio, a generare le quattro strade maestre verso i bordi, il seme del villaggio e la dotazione dell'economia; demolirlo azzera ancora il villaggio (con i pozzi successivi, rimborsati). Ogni pozzo successivo è un edificio normale: anelli bianco/giallo/verde propri (stessi raggi 20/14/7), centro di crescita per case e campi (distanza dal pozzo più vicino, raggio di crescita comune), squadre antincendio, e **una** strada principale (`routeId 'well-main:<id>'`, `roadClass:'arterial-well'`, `wellFor`) verso il pozzo fondatore, troncata a T sulla prima strada principale che incrocia. Il **centro villaggio** è un ruolo (`State.village.centerWellId`, assente = pozzo fondatore) designabile dall'ispettore come il mastio; porta l'etichetta col nome del villaggio ed è la meta degli emissari senza mastio. I pozzi non centro hanno un nome di quartiere/borgata (`wellName`, max 32 caratteri) mostrato in ispettore e sulla mappa. Salvataggi vecchi: un pozzo, nessun `centerWellId` → centro = fondatore. **Alternative scartate:** spostare strade maestre ed economia sul centro designato (avrebbe rigenerato la rete e il seme a ogni cambio di ruolo); strade maestre anche dai pozzi successivi (contrario alla richiesta).
**D-057 · CODICE SU BRANCH `feature/houses-blender` (scelta dell'utente del 02/11; D-056 è dei pozzi multipli, D-058 e D-059 dei branch `fix/house-fire-collapse` e `feature/l3-workshop-cutaway`):** le case passano al 3D con un **kit modulare Blender** montato dal gioco sulle sue piante procedurali (proporzioni per id, schiere, ali L/T, sporto, `houseFacadePlan`, `houseDoorInfo`, `chimneySpecs` restano le regole); **pilota L3**, poi L1, L2, L4 con lo stesso kit. Il kit vale in World 3D (WebGL2); il fallback Canvas 2.5D conserva il disegno procedurale. **Alternative scartate:** un modello Blender intero per variante scalato sull'impronta (graticcio deformato, misure variabili delle schiere non rispettate); il kit anche nel painter 2.5D (falde e timpani non ordinabili senza depth buffer).
**D-058 · CODICE SU BRANCH `fix/house-fire-collapse` (scelta dell'utente del 02/11; D-056 è dei pozzi multipli, D-057 e D-059 dei branch `feature/houses-blender` e `feature/l3-workshop-cutaway`):** una casa, una locanda o un mercato che un incendio consuma fino in fondo **crolla** (macerie e braci), a qualunque livello. **Alternativa scartata:** lasciarla in piedi con un aspetto «bruciato». Un incendio spento prima resta un danno; i mulini restano sventrati in piedi; fortificazioni in legno invariate.
**D-059 · CODICE SU BRANCH `feature/l3-workshop-cutaway` (completa D-053; D-056 è dei pozzi multipli, D-057 e D-058 dei branch `feature/houses-blender` e `fix/house-fire-collapse`):** la bottega L3 si vede in sezione **solo quando la sua casa è selezionata**, come chiesa e locanda (#90); nessun interruttore né stato salvato. Si apre solo il pianterreno (la bottega su strada); il piano abitato sopra sparisce insieme a tetti e comignoli. L'artigiano viene disegnato al banco solo quando la sua routine lo terrebbe alla porta di casa, quindi le routine (D-052) e la produzione (D-053) restano l'unica fonte di verità. **Alternative scartate:** toggle `cutaway` persistente come per torri e porte (le case sono centinaia e generate dall'urbanistica); interni sempre aperti per tutte le botteghe (illeggibile a scala di città).
**Integrazione e status Git:** per l'elenco completo di feature merge e PR ancora aperte vale [AUDIT-2026-10-21](AUDIT-2026-10-21.md). Le righe più vecchie nel registro conservano il significato di *decisione storica* senza riscrivere retroattivamente il loro contesto.

## Conflitti decisionali da risolvere esplicitamente

| ID | Tema | Fonti discordanti | Risoluzione richiesta |
|---|---|---|---|
| O-001 | Produzione miniera | [ECONOMY 12/10](sources/ECONOMY-2026-10-12.md) propone Miniera→Metallo nella filiera V1, ma la richiesta successiva per i placeholder e `src/settlement-industries.js` su main usano intenzionalmente `stone`. | **DESIGN VS PROTOTIPO**, non errore accertato: confermare output definitivo prima di cambiare codice + test + ledger/migrazione. |
| O-002 | Calendario agricolo | `src/settlement-fields.js` stagioni fisiche vs raccolto autunnale nel ledger | Un calendario fonte unica per campo, lavoratori, resa economica, UI e salvataggio. |
| O-003 | Risorse Builder | `State.resources` di test vs riserva/mercato `ConquerEconomy` | Definire source-of-truth e migrazioni; nessun doppio conteggio. |
| O-004 | Branch di sviluppo | Al 16/10 `urban` +97/-24, `sync/urban-main` +78/-24 rispetto a `main` [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99); [PR #19](https://github.com/erykwest/CONQUER/pull/19) aperta. | Confrontare diff, QA e asset prima di ogni integrazione; **non** scegliere per nome né fare merge cieco. |
| O-005 | Calendario mondo | Modello annuale a 12 mesi/365 giorni vs ipotesi mesi abbreviati da 6 giorni | Non modificare il tempo globale finché resa/stagioni/produzione non siano definite. |
| O-006 | Rendering e meccanica | Separazione a moduli esistente, ma rendering e stati condividono talvolta globali | Delimitare un contratto dati/test prima di un refactor di ampia scala. |
| O-007 | Perimetro MVP | Builder/Manager, combat, assedi, feudi e pubblicazione hanno ampiezza diversa | Confermare una vertical slice e relativo Definition of Done, non promettere tutto insieme. |

## Regola per le nuove decisioni

Aggiungere un ID, classe, data di registrazione, **motivazione**, alternative scartate, impatto su file/test, issue/PR/commit. Non sovrascrivere silenziosamente una decisione: segnarla **SUPERATA DA D-xxx**, mantenendo la traccia. Per le proposte usare «PROPOSTA» fino a conferma esplicita.


### CIRCLE — 2026-10-28
2026-10-28 — CIRCLE design: white/yellow/green painted zones remain independent. Defensive compartments close only with fortifications or genuinely impassable natural terrain (cliffs/sea); ordinary civilian buildings excluded. Capture requires military control, not tower collapse. Supplies fill deepest compatible depots first; capture removes local stores. Civilian withdrawal proceeds by reachable secure compartment, not direct teleport to keep. Implementation is skeleton only.


### CIRCLE — decisioni operative 2026-10-29
- La chiusura fisica riguarda **solo** fortificazioni finite e barriere naturali realmente invalicabili. Edifici civili e siepi restano semplici ostacoli di navigazione e non chiudono un compartimento.
- Una porta aperta mantiene la demarcazione *difensiva* ma consente il transito; le porte chiuse non costituiscono collegamento percorribile. I ponti possono interrompere una chiusura naturale.
- L'appartenenza del Mastio viene valutata dal lato dell'ingresso, non dal centro dell'edificio pieno. Per le built sections senza ingresso identificabile, l'attribuzione alle riserve resta non determinata.
- Le cerchie annidate e settori laterali hanno identità logiche distinte. Una breccia modifica la topologia ma non è una conquista automatica: senza un controller militare i settori sono `unassessed`; non devono essere scelti come rifugi per default.
- Il riconoscimento raster attuale è un primo contratto runtime, non sostituisce collisioni, pathfinding e simulazione d'assedio esistenti.


### CIRCLE — controllo militare dei compartimenti — 2026-10-29
- **La condizione `secure` dipende dall'assenza di combattenti ostili effettivamente presenti nel compartimento.** La visibilità della fog of war non è una fonte attendibile di sicurezza: un nemico non avvistato rende comunque insicura la zona.
- **`alert` non significa occupato.** Gli allarmi esistenti (yellow/green e campana) restano indipendenti dalla classificazione di occupazione; `secure` e `alert` restano eleggibili come rifugi nel contratto `/circle`.
- **Scale/torri d'assedio e camminamenti:** salita=`threatened`, ostile sul camminamento=`infiltrated`, scontro tra difensori e assalitori sul camminamento=`contested`. Solo presenza a terra dentro un compartimento genera `invaded`, oppure `contested` se ci sono difensori.
- **`invaded` non equivale a `captured`.** Il controllo definitivo, la perdita delle scorte e la produzione interrotta richiederanno un evento esplicito di conquista confermata; questa iterazione non trasferisce risorse né altera i pennelli e le collisioni esistenti.
- I settori aperti da **brecce d'assedio documentate** vengono conservati in memoria nella sessione corrente come `compromised` (non sicuri) anche dopo la perdita della chiusura geometrica. Il successivo ingresso ostile li classifica `invaded`; la ricostruzione ne rimuove lo stato storico e restituisce un compartimento chiuso. Le demolizioni volontarie non generano automaticamente questi settori storici. **Resta aperta la persistenza** tra caricamenti e l'assegnazione di identità permanenti; `captured` richiede una conferma separata.


### CIRCLE — decisioni logistiche e di cattura — 2026-10-29
- La cattura NON è sinonimo di `invaded`: richiede almeno 0,5 giorni di occupazione nemica a terra continuativa, senza difensori in grado di contestarla (anche sulle mura). Nessuna cattura a gioco fermo. Qualunque breccia, scala o torre d'assedio da sola non trasferisce possesso.
- Il ledger autorevole delle scorte fortificate è `State.siege.stock`. Per evitare duplicazioni non viene creato un secondo ammontare salvato per stanza: la ripartizione fisica virtuale è calcolata dai depositi compatibili e dai livelli difensivi al momento dell'uso. I depositi più profondi si riempiono per primi; la capacità condivisa `materials` copre legno, pietra e metallo.
- **Alla conquista verificata** il quantitativo effettivamente assegnato alle sole stanze del settore viene sottratto una sola volta al magazzino del difensore e registrato in `State.siege.circle.captures[]` (`lost`, `rooms`, `anchors`, `polygon`, `day`). Le altre risorse (`State.resources` Builder e stock mercantile `ConquerEconomy`) NON vengono modificate automaticamente. I depositi non attribuibili con certezza non sono soggetti a sottrazioni ipotetiche.
- Il settore conquistato rimane `captured` finché non è ricontrollato dai difensori per almeno 0,5 giorni di gioco senza ostili. La riconquista riattiva la capacità fisica del deposito ma NON rigenera le merci sottratte.
- Il record di cattura sopravvive a save/load, incluse brecce che eliminano la chiusura topologica; una successiva compartimentazione non può propagare una sola cattura a più settori. Il bottino lato attaccante e la simulazione di trasporti di risorse sono rinviati.

