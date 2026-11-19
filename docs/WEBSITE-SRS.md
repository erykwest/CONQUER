# CONQUER — Website SRS v0.3

**Software Requirements Specification** · **19 novembre 2026** · **Stato: scelte di prodotto approvate, dettagli implementativi proposti**

**Owner:** progetto CONQUER · **Ambito:** sito pubblico ufficiale + accesso al prototipo nel browser. Questa specifica NON attesta che il sito o la build pubblica siano gia implementati.

## 0. Decisioni approvate il 19/11/2026

| ID | Decisione | Stato |
|---|---|---|
| WEB-D01 | Identita visiva **medievale sobria e moderna**, senza estetica fantasy sovraccarica | **DECISO** |
| WEB-D02 | Contenuti del sito e comunicazioni verso i visitatori **solo in inglese** nella prima release | **DECISO** |
| WEB-D03 | Prototipo **giocabile direttamente nel browser**, senza download come percorso principale | **DECISO** |
| WEB-D04 | **Login facoltativo**: accesso Guest senza registrazione e account CONQUER valido sia sul sito sia nel gioco | **DECISO** |
| WEB-D05 | **Guest = singleplayer Builder**, non multiplayer: una nuova partita usa un seed territoriale casuale e inizia da uno splash screen di impostazione dei parametri | **DECISO** |

Le scelte di stack, hosting, dominio, provider di autenticazione/email, dettaglio dei parametri dello splash screen, sincronizzazione della sessione fra domini e gestione della persistenza seguenti sono **PROPOSTE**, non decisioni gia approvate.

## 1. Scopo, utenti e obiettivi

Il sito e il punto di ingresso pubblico di CONQUER, videogioco indipendente di strategia e simulazione medievale. Deve presentare il progetto, dimostrare gameplay reale, condividere aggiornamenti di sviluppo, raccogliere follower e permettere di provare una build pubblica direttamente nel browser.

**Utenti:** visitatori curiosi, giocatori PC di strategia/city-builder, giocatori Guest singleplayer, giocatori con account CONQUER, iscritti agli aggiornamenti, tester, stampa/creator (fase successiva), owner/amministratore editoriale.

**Esiti attesi:** capire rapidamente che cos'e il gioco; vedere screenshot autentici; cliccare `Play in Browser`; provare il gioco senza installazione; seguire il Devlog. Non si assume vendita o Steam nella prima release.

**Metriche da raccogliere in forma aggregata, rispettando privacy e consenso applicabile:** visite delle pagine, CTR `Play in Browser`, avvii del gioco effettivi, conversione Follow confermata, ritorno ai Devlog. Nessun tracciamento individuale cross-site necessario per il MVP.

## 2. Perimetro

### In scope P0 — MVP

- Homepage, The Game, Media, Devlog, Follow, Play e pagine informative/legali.
- Navigazione responsive con contenuti pubblici inglesi.
- Galleria screenshot/video realmente tratti da CONQUER.
- Devlog con pagine permanenti, data e stato del lavoro, bozze non pubbliche.
- Sistema Follow con iscrizione email, double opt-in, privacy e disiscrizione.
- Accesso al prototipo dal sito tramite pulsante `Play in Browser` e route/ingresso di gioco.
- **Login facoltativo**: percorso `Play as Guest` o `Sign in / Create CONQUER Account`, senza bloccare la prova del gioco.
- **Nuovo splash screen di configurazione partita** prima dell'avvio del Guest Builder: seed territoriale generato casualmente, parametri di partita, comando per generare la mappa e possibilita di riprendere una partita locale.
- Una sola identita persistente per sito e gioco, con autenticazione e autorizzazione centralizzate e senza due archivi utenti indipendenti.
- Il Guest e esclusivamente singleplayer: nessuna lobby multiplayer, nessun personaggio server, nessuna membership di campagna.
- Pagina di compatibilita, stato di caricamento, messaggi d'errore e modalita di uscita dal gioco al sito.
- Metadati SEO, sitemap, Open Graph, analytics essenziali, deployment sicuro e rollback.

### P1 — Dopo MVP

RSS, Buy Me a Coffee, Press Kit, archivio Devlog con filtri, strumenti di feedback per tester, accessibilita/UX ulteriormente rifinita, eventuali annunci email selezionati.

### P2 — Solo dopo nuova decisione

Steam/wishlist, vendita diretta, matchmaking/lobby e campagne multiplayer autenticate, cloud saves cross-device (da validare prima della loro promessa pubblica), italiano o altre localizzazioni, forum, ecommerce, remote control campagne.

### Esclusioni esplicite

Non sostituire o riscrivere il motore di gioco. Non esporre per default asset lab, pagine di test, fixture, endpoint interni, token privilegiati o branch di sviluppo. Non promettere funzionalita di gameplay che sono soltanto progettate o presenti su branch non integrate. Niente registrazione obbligatoria per giocare al prototipo P0. Il Guest non partecipa al multiplayer e non crea un account server di nascosto; l'accesso ai dati privati delle campagne richiedera sempre account e autorizzazioni per campagna/feudo.

## 3. Architettura informativa

```text
Home /
├── The Game /game
├── Media /media
├── Devlog /devlog
│   └── Article /devlog/{slug}
├── Play /play   -> avvio del gioco su runtime pubblico separato
├── Follow /follow (o form globale)
├── Account /account (login facoltativo, profilo)
├── About /about
├── Privacy /privacy
└── Contact /contact
```

La navigazione pubblica e i messaggi applicativi sono **in inglese**. Il dominio e i percorsi definitivi restano da scegliere. `/play` e il percorso logico sul sito: puo indirizzare a un sottodominio/deployment dedicato (`play.<dominio>`), senza pretendere che motore e marketing condividano lo stesso bundle o origin.

## 4. Requisiti funzionali verificabili

| ID | Priorita | Requisito | Criterio di accettazione |
|---|---|---|---|
| WEB-001 | P0 | Homepage con brand, pitch sintetico e CTA `Play in Browser` | CTA visibile sopra la piega su desktop e facilmente raggiungibile su mobile |
| WEB-002 | P0 | Pagina `The Game` con pilastri di gameplay | Distinzione editoriale tra elementi verificati in build e feature future |
| WEB-003 | P0 | Media gallery | Immagini/video autentici, con alt text, formati responsive e lazy loading |
| WEB-004 | P0 | Devlog | Lista per data, permalink per articolo, pubblicazione e bozza separate |
| WEB-005 | P0 | Follow via email | Double opt-in, conferma di iscrizione, unsubscribe effettivo, anti-abuso |
| WEB-006 | P0 | `Play in Browser` senza installazione | L'utente avvia la build pubblica supportata in una sessione browser |
| WEB-007 | P0 | Controllo compatibilita renderer | WebGL2 verificato prima del lancio; messaggio comprensibile se mancante |
| WEB-008 | P0 | Caricamento e gestione errore del gioco | Progress/loading state, retry e ritorno al sito senza bloccare il browser |
| WEB-009 | P0 | Gestione esplicita dei salvataggi del prototipo | Salvataggio/ripresa validati oppure avviso chiaro se sessione temporanea; niente perdita silenziosa |
| WEB-010 | P0 | Contenuti in inglese | Nessuna stringa pubblica italiana nel percorso principale o nelle email |
| WEB-011 | P0 | Pagine legali/privacy e contatto | Informative reperibili dal footer; dati email usati per finalita dichiarate |
| WEB-012 | P0 | Contenuti modificabili senza cambiare runtime | Aggiornamento Devlog/media non attiva obbligatoriamente una release del gioco |
| WEB-013 | P0 | SEO e social preview | Sitemap, title/description, canonical, immagini e metadata per link condivisi |
| WEB-014 | P0 | Separazione distribuzione game/site | Build/versione gioco esplicita e rollback indipendente dal sito |
| WEB-015 | P0 | Telemetria minima e privacy | Metriche aggregate; nessun evento di gioco raccolto senza base e policy definite |
| WEB-016 | P1 | Supporto volontario | Link esterno a provider gestito, senza checkout proprietario |
| WEB-017 | P1 | RSS | Feed validabile e aggiornato ai Devlog pubblicati |
| WEB-018 | P1 | Press Kit | Logo approvato, descrizione, screenshot, contatto |
| WEB-019 | P1 | Feedback tester | Canale semplice senza costruire un forum |
| WEB-020 | P2 | Steam | Link a store e wishlist solo quando pagina ufficiale effettivamente pubblicata |
| WEB-021 | P0 | Login facoltativo con account unificato | Stesso identificativo utente stabile sul sito e nel gioco; nessun doppio account |
| WEB-022 | P0 | Guest Builder singleplayer | Ingresso senza login; nessuna lobby, membership, personaggio o servizio multiplayer |
| WEB-023 | P0 | Splash screen `New Singleplayer Game` | Prima di iniziare una nuova partita Guest permette configurazione e avvio esplicito |
| WEB-024 | P0 | Seed casuale territorio | Ogni nuova partita propone un seed casuale; seed finale mostrato e persistito con la configurazione |
| WEB-025 | P0 | Parametri e validazione | Solo impostazioni realmente supportate dal runtime; valori non validi impediscono l'avvio con feedback leggibile |
| WEB-026 | P0 | Persistenza Guest distinta | Un nuovo seed non sovrascrive un salvataggio esistente senza conferma; ripresa e gestione degli slot verificate |
| WEB-027 | P0 | Gestione sessione account | Login, logout e ripristino sessione coerenti fra sito e gioco, senza token nelle URL |
| WEB-028 | P0 | Autorizzazioni isolate per partita | Login non equivale a permesso su campagne terze; il Guest non dispone di credenziali per dati riservati |
| WEB-029 | P0 | Separazione Follow vs identita | Iscrizione newsletter non crea automaticamente account; consensi e impostazioni distinti |
| WEB-030 | P1 | Promozione salvataggio Guest ad account | Importazione esplicita, preview, gestione conflitti e backup; non automatica o implicita |

## 5. Esperienza di gioco da browser

### 5.1 Flusso visitatore (decisione di prodotto)

1. Visita `Home` e sceglie `Play in Browser`. Il gioco mostra una schermata di ingresso, non avvia automaticamente una partita nuova.
2. Sceglie **`Play as Guest`** o **`Sign in / Create account`**. Il login e sempre facoltativo per provare il Builder.
3. Guest: apre lo splash screen di una partita **singleplayer** con parametri territoriali e seed, oppure sceglie `Continue` se esiste un salvataggio locale valido.
4. Con `Create World` il Builder genera il territorio secondo seed e parametri confermati. Questo e il runtime singleplayer effettivo, non un sandbox multiplayer.
5. Utente registrato: accede al medesimo sistema di identita sul sito e nel gioco; puo entrare nel singleplayer. Lobby e campagne multiplayer saranno un percorso distinto e futuro.
6. Prima del gioco si verifica WebGL2; in caso di incompatibilita o errore si mostra una spiegazione con `Retry` e `Back to Website`.
7. Modalita di salvataggio e limitazioni Guest sono visibili prima dell'avvio.

### 5.1a Nuovo splash screen singleplayer (da sviluppare)

**Titolo operativo UX:** `New Singleplayer Game`.

| Controllo | Stato | Contratto |
|---|---|---|
| `World Seed` | **DECISO** | Random seed per default, registrato nel salvataggio e mostrabile per riprodurre il territorio |
| `Reroll Seed` | **PROPOSTO** | Genera un altro seed prima dell'avvio |
| `Enter Seed` | **PROPOSTO** | Seed manuale opzionale per riprodurre la stessa generazione |
| `Biome / Territory` | **PROPOSTO** | Esporre solo biomi e opzioni realmente supportate dal generatore attuale |
| `Game Difficulty` | **DA VERIFICARE** | Mostrare solo se la difficolta ha un effetto simulativo implementato e persistito; no opzioni decorative |
| `Create World` | **DECISO** | Conferma i parametri e avvia una partita singleplayer Builder |
| `Continue` | **PROPOSTO** | Disponibile solo se un salvataggio Guest valido e ripristinabile e presente |
| `Back` | **PROPOSTO** | Ritorna alla schermata di ingresso senza perdere partite |

**Invarianti:** a parita di versione del generatore, seed e parametri territoriali equivalenti generano la stessa condizione iniziale; il seed non e una chiave di autorizzazione, ne una credenziale; nuova partita non cancella i progressi esistenti per errore. La configurazione e parte del salvataggio, non solo un valore visivo.

**Stato codice verificato il 19/11/2026:** `src/settlement-app-bootstrap.js` inizializza direttamente `loadLocal()` e `initSupabase()`, mentre `index.html` contiene un bottone `newMapBtn`. Lo splash screen pre-partita non risulta dimostrato da queste verifiche: e **una feature nuova** con bootstrap da riprogettare, non un pannello gia completato.

### 5.1b Identita e salvataggi: confini

- **Guest locale:** nessun `auth.user_id` e nessun accesso ai dati server riservati. Una sessione browser puo avere uno o piu salvataggi locali isolati, fino a quando non viene effettuato un import esplicito.
- **Account CONQUER:** identita globale persistente, condivisa da sito e gioco; unico servizio di autenticazione (provider da validare), non due password/sessioni indipendenti.
- **Singleplayer autenticato:** resta singleplayer; il login **non trasforma una partita Guest in una campagna multiplayer**.
- **Multiplayer futuro:** disponibile solo ad account autenticati e autorizzati allo specifico server/campagna; stato account, partecipazione campagna e feudo non si confondono, come gia definito in `MULTIPLAYER-SERVER-SCOPE.md`.
- **Cloud save e migrazione:** proposte da testare separatamente. Non cancellare un salvataggio Guest al login/logout; non importarlo nel cloud silenziosamente e non sovrascrivere uno slot esistente senza scelta esplicita.
- **Newsletter:** `Follow` e account restano flussi distinti; l'email condivisa non costituisce consenso automatico ad aggiornamenti promozionali.

### 5.2 Contratto fra sito e gioco

**Il marketing website NON include l'intero codice del gioco nel proprio bundle.** Proposta: due deployment indipendenti, con frontend statico sito e runtime esistente isolato (`www` e `play` su un dominio da definire). Il tasto `Play` puo essere un link diretto: embedding iframe NON richiesto.

- Esiste un ambiente/versione `public prototype` distinta dalle preview di sviluppo.
- Nessuna promozione automatica di branch instabili verso il sito pubblico.
- Release selezionata e identificabile (versione/build hash/data).
- Se vengono utilizzate API/DB, permessi client minimali, policy RLS e scope ambiente separati; nessuna chiave privilegiata nel client.
- Il sito e il gioco condividono **una sola autorita di identita**. La sincronizzazione cross-origin/cross-subdomain richiede un flusso sicuro da progettare (per esempio endpoint dedicato/cookie adeguati), senza token nella query string e senza presumere che il localStorage sia automaticamente condiviso fra sottodomini.
- Non ci si affida a oscuramento o cifratura JavaScript come protezione del codice frontend.
- Salvare dati utente solo secondo una strategia verificata (local storage/IndexedDB o backend anonimo isolato); non dare per scontato che la persistenza del prototipo esistente sia pronta per utenti esterni.
- Nessuna dipendenza sincrona del sito marketing dalla disponibilita dei servizi gioco.

### 5.3 Vincoli reali da verificare prima del rilascio

Nel repository corrente `index.html` e l'entrypoint del gioco e il documento `docs/context/DECISIONS.md` prescrive **WebGL2** come renderer necessario (D-RENDER-3D-261111). Quindi NON introdurre un requisito WebGPU non dimostrato. Verificare sul codice live e su browser reali:

- supporto WebGL2 e grafica hardware attiva;
- target iniziale: browser desktop moderni; mobile website responsive, ma gameplay touch/mobile NON garantito senza QA dedicata;
- download iniziale degli asset, memory footprint, caricamento e FPS su almeno due classi hardware;
- errori e graceful failure quando manca WebGL2;
- comportamento di save/load, slot per seed e parametri, e compatibilita tra release;
- avvio nuovo Guest senza login, continue selettivo, isolamento dagli account e mancato accesso alle lobby;
- singleplayer dopo autenticazione senza confonderlo con membership di campagna;
- sicurezza dei servizi esterni e impossibilita di raggiungere laboratori o dati interni tramite il sito pubblico;
- qualita del gameplay della demo: niente dipendenza da opzioni incomplete.

**Gate:** il rilascio di `Play in Browser` richiede una smoke test manuale e una suite automatica ripetibile, su build pubblica isolata. La mera esistenza di `index.html` non prova la prontezza commerciale.

## 6. Direzione visuale — DECISA a livello di stile

**Keywords:** restrained medieval, architectural, tactile, contemporary, strategic, credible.

**Proposta di design system** (colori e font da validare nella fase M0):

- superfici antracite/ardesia, pietra calda e pergamena tenue;
- oro/ottone usato come accento funzionale, non campitura dominante;
- tipografia editoriale serif per titoli, sans leggibile per corpo/UI;
- bordi e texture architettoniche leggere; molto spazio negativo;
- screenshot come prova di gameplay, non concept art scambiata per gioco reale;
- evitare pergamene decorative, stemmi superflui, effetti fantasy/glow e animazioni intrusive.

**Accessibilita:** contrasto AA, focus visibile, navigazione tastiera, motion reduced, testi leggibili su immagini, alt text per media.

**Proposta homepage:** hero con screenshot/trailer reale + `Play in Browser`, un breve gameplay pitch, tre/cinque pilastri, ultimo Devlog, modulo Follow, footer. Copy definitivo solo dopo verifica delle funzionalita effettivamente presenti.

## 7. Requisiti non funzionali

| ID | Target o obbligo |
|---|---|
| NFR-001 | Website responsive da 320px; gioco desktop-first finche mobile non supera test dedicati |
| NFR-002 | Obiettivo Lighthouse sito statico: Performance >= 90 desktop e >= 80 mobile (misurare, non promettere) |
| NFR-003 | Core Web Vitals: obiettivo LCP <= 2.5s sul 75° percentile per le pagine editoriali; non assimilare il caricamento del gioco a una normale pagina marketing |
| NFR-004 | Obiettivo WCAG 2.2 AA per sito e flussi informativi; accessibilita del gameplay con backlog separato |
| NFR-005 | HTTPS, CSP adatta al gioco, nessun segreto nel frontend, rate limiting dei form |
| NFR-006 | Privacy/GDPR: minimizzazione, base giuridica, conservazione limitata, disiscrizione e cookie/consenso secondo integrazioni effettive |
| NFR-007 | URL stabili, sitemap, Open Graph, robots, pagine 404 |
| NFR-008 | Deploy e rollback del sito e del runtime gioco indipendenti |
| NFR-009 | Monitoraggio errori senza tracciare contenuti sensibili di salvataggi o singole campagne |
| NFR-010 | Nessun contenuto di gioco scaricato per la semplice apertura della homepage |
| NFR-011 | Autenticazione sicura e condivisa fra sito/gioco, sessioni revocabili, login/logout coerenti, token mai nelle URL |
| NFR-012 | Salvataggi Guest separati per slot, nessuna sovrascrittura tacita, gestione chiara di quota/archiviazione locale |
| NFR-013 | Input seed e parametri validati; riproducibilita entro versione del generatore; test deterministici su condizioni iniziali |
| NFR-014 | Nessun dato di campagna, inventario o permesso multiplayer leggibile dalla sessione Guest; applicazione di RLS e autorizzazioni lato server alle funzioni private |

## 8. Proposta stack e organizzazione

**Ipotesi da validare M0:** sito statico Astro + CSS, contenuti Markdown versionati, hosting Vercel, servizio gestito per newsletter e analytics rispettosi della privacy. Per identita condivisa valutare **riuso del Supabase Auth gia referenziato nel runtime**, non creare una nuova identity store; verificare in concreto configurazione Auth, flussi e isolamento dati. `CONQUER-WEB` come repository separato e una possibile opzione, **non ancora deciso**. Alternativa: monorepo con progetto/deployment Vercel separato. Non modificare la root `index.html` del gioco per inserire la homepage marketing.

Sono gia presenti `vercel.json` e il runtime di gioco in `erykwest/CONQUER`; il deploy del sito non deve alterare la policy di main contenuta in `AGENTS.md` e `vercel.json`.

## 9. Milestone (non datate)

| Milestone | Deliverable | Gate |
|---|---|---|
| **W-M0: UX + feasibility** | Sitemap, wireframe desktop/mobile (Home, The Game, Play + splash), design tokens, inventario screenshot, audit `browser-ready` e auth | Percorso Guest/Account e screen dei parametri definiti; dipendenze e rischi misurati |
| **W-M1: Site foundation** | Layout/nav, pagine editoriali, Devlog Markdown, SEO/accessibilita, CI e deploy di anteprima isolato | UI testata su mobile/desktop; nessun impatto sul deploy di gioco |
| **W-M2: Follow + Media** | Double opt-in, unsubscribe, media autentici, analytics minime, privacy | Test end-to-end e gestione consensi verificata |
| **W-M3: Browser prototype release** | Build pubblica isolata, ingresso Guest/Account, splash screen seed/parametri, compatibility gate, loading/error/saves, QA | Guest singleplayer senza login e account condiviso verificati, avvio WebGL2 e ripresa partita testati |
| **W-M4: Growth/commercial** | RSS/press kit/support/Steam opzionali | Nuove decisioni esplicite; niente anticipo automatico |

Il lancio pubblico con promessa `Play in Browser` richiede **W-M1 + W-M2 + W-M3**: un pulsante che porta a una build non verificata non soddisfa WEB-D03.

## 10. Prossimo passo progettuale: W-M0

**W-M0.1 — UX/IA:** produrre wireframe desktop e mobile (`Home`, `The Game`, `Play`, `Guest New Game splash`), con CTA, accesso Guest/Account e copy placeholder in inglese. Nessun codice sito prima di allineare queste schermate.

**W-M0.2 — Identita visiva:** scegliere palette/token, pairing font, trattamento screenshot, stile icone, componenti di card, CTA e Devlog. Validare contrasto e coerenza col gioco.

**W-M0.3 — Audit tecnico browser e identita:** identificare entrypoint/asset del gioco che possono entrare in una build pubblica, prova WebGL2, dimensioni asset, persistenza locale/cloud, seed/biomi/difficolta davvero supportati, Auth attuale, gestione logout e sessione sito/gioco, route esposte, modello di versionamento e rollback. Produrre una matrice rischio/blocco e un criterio Go/No-Go.

**W-M0.4 — Architettura deployment:** decidere monorepo vs repo separato, routing `/play` vs sottodominio, politica di pubblicazione e confini dei dati. *Decisione di design*, non deployment automatico.

**Definition of Done W-M0:** wireframe approvati (incluso splash Guest), design token descritti, elenco parametri supportati dal motore, contratto di identita unico e modello salvataggi scelti, matrice compatibilita e security pronta, scelta topologia hosting, asset/copy inventory, backlog implementabile W-M1/W-M3. Solo allora iniziare il frontend del sito.

## 11. Decisioni ancora aperte

1. Nome dominio definitivo e topologia sito / gioco.
2. Repository separato vs monorepo con due progetti Vercel.
3. Servizio email e trattamento dati.
4. Numero di slot Guest, formato/limiti salvataggi e import da Guest ad account; telemetria e durata dei dati.
5. Requisiti minimi hardware/browser dimostrati e supporto Safari/Firefox.
6. Se la prima beta pubblica ha un insieme di feature limitato oppure coincide con il prototipo corrente.
7. Logo/copy definitivo, immagini di riferimento e calendario editoriale.
8. Dettagli dello splash (biomi selezionabili, difficolta solo se implementata, seed manuale e supporto alla ripresa).
9. Provider Auth definitivo, sessione fra deployment separati, reset password e modalita di sign-in; cloud save P1 solo dopo validazione.

---

**Traceability:** decisioni utente del 19/11/2026 (incluso Guest singleplayer con splash e seed territoriale); struttura attuale del repository `erykwest/CONQUER`, `index.html`, `vercel.json`, `AGENTS.md`, `docs/context/VISION.md`, `docs/context/DECISIONS.md` e `docs/context/PR-WORKFLOW.md`. La presente e una specifica: lo stato di implementazione rimane da verificare separatamente.
