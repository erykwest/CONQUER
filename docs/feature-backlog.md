# CONQUER — Backlog prioritizzato Builder / Manager

## Settlement management panels — \`panels\` (29/10/2026)

- **Presente sulla branch (verifica browser/CI da completare):** centro di controllo Profilo a 9 viste, dati dal ledger economico e dai sottosistemi esistenti, grafico settimanale cibo, istogrammi, gestione tasse/razioni, quote vendita, acquisto/vendita proprietà, carovane.
- **Non implementato:** festività sociali realmente simulate, serie storica felicità/occupazione/prezzi, produzione annua per proprietà e indicatori tributari di feudo, rapporto diplomatico persistente, allarmi epidemie/disordini/incendi. Per contratti e priorità vedere [management-panels.md](management-panels.md).
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

## Triage completo su main — 22/10/2026

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
- [ ] **P0-04 — Abitazioni L1–L4 e popolazione produttiva.** **[BASE MAIN; L1 cantieri in PR #55 OPEN]** Consolidare la coerenza tra livello abitazione, capienza, tier/professione e disponibilità di lavoro; separare status/tier dal lavoro corrente, se non ancora operativo. **Accettazione:** popolazione disponibile e lavoratori assegnabili coerenti con case ed economia; i tier superiori possono coprire lavori inferiori dove previsto.
- [ ] **P0-05 — Logging Camp.** **[BASE MAIN; depletion e ledger ancora da integrare]** Completare l'edificio estrattivo già abbozzato, lavoratori e rapporto reale con i boschi; sostituire il placeholder grafico quando pronto. **Accettazione:** collocamento vicino al bosco, output limitato da lavoratori/risorsa locale e comportamento consistente nel calendario economico.
- [ ] **P0-06 — Mulino / Farm Hub.** **[BASE MAIN; resa/stock e calendario da riconciliare]** Definire il polo agricolo sfruttando il sistema campi già esistente. Riconciliare lavorazioni visive (aratura, semina, crescita, raccolto) con il bilancio economico stagionale. **Accettazione:** un'unica fonte per resa annuale, forza lavoro e produzione `food`, senza doppio conteggio.
- [x] **P0-07 — Cava.** **[CORE MAIN · QA/integrazione se necessaria]** Rifinire il nodo `quarry` esistente e la sua dipendenza dai versanti rocciosi. **Accettazione:** collocamento geologicamente valido, operai L2, output `stone`, salvataggio e visualizzazione coerenti.
- [ ] **P0-08 — Miniera.** **[BASE MAIN; output mine=stone, metal da decidere]** Completare il nodo `mine` esistente e risolvere prima il prodotto estratto (`stone` vs `metal`). **Accettazione:** decisione di design esplicita e testata, collocamento vincolato al giacimento, lavoratori L2 e flusso economico coerente.

**Milestone P0:** villaggio fondabile e persistente; terreno e foreste influenzano il posizionamento; lavoratori e quattro poli economici operano in modo osservabile e verificabile.

## P1 — Economia e fortificazioni funzionali

- [ ] **P1-09 — Funzioni delle Built Sections.** **[BASE MAIN; capienze e slot presenti, ledger separato]** Collegare gli slot esistenti a capienza e funzione reale: granaio, magazzino, armeria, caserma, scuderia, alloggi/comando. **Accettazione:** i vincoli per piano/accessibilità e le capacità fisiche sono validati; il contenuto economico non supera capienze definite.
- [ ] **P1-10 — Workshop / Fabbro.** **[BASE MAIN; produzione workshop non dimostrata dal solo slot]** Integrare il laboratorio nella costruzione e nell'economia (il motore conosce già il tipo `workshop`). **Accettazione:** input `metal` + `wood`, output `equipment`, lavoratori L3 e ciclo produttivo senza risorse duplicate.
- [ ] **P1-11 — Mercato.** **[BASE MAIN; mercato già attivo, ledger da unificare]** Completare il collegamento tra edificio fisico e mercato/accounting già esistente, evitando una nuova simulazione concorrente. **Accettazione:** transazioni, stock, riserve, oro e proprietari si aggiornano nello stesso ledger.
- [x] **P1-12 — Palizzate.** **[CORE MAIN · QA/integrazione se necessaria]** Implementare segmenti, angoli, aperture/porte, costo ridotto rispetto alle mura e vulnerabilità al fuoco. **Accettazione:** gli accessi e le collisioni cambiano davvero i percorsi di unità e attaccanti; le palizzate sono modificabili nel Builder.
- [x] **P1-13 — Ponti ordinari.** **[CORE MAIN · QA/integrazione se necessaria]** Permettere attraversamenti di fossati e corsi d'acqua, con larghezza compatibile con strada e accesso. **Accettazione:** il pathfinding considera il ponte soltanto quando collegato e transitabile; collocamento e stato sono persistenti.

**Milestone P1:** l'economia alimenta riserve fisiche; gli edifici hanno funzioni effettive; le prime difese e infrastrutture modificano l'accessibilità.

## P2 — Ingegneria militare, servizi e identità

- [x] **P2-14 — Fossati.** **[CORE MAIN · QA/integrazione se necessaria]** Introdurre varianti asciutte/allagate e normali/larghe, con raccordi al terreno e interruzioni in corrispondenza degli accessi. **Accettazione:** modifica reale della percorribilità; geometria e salvataggio consistenti.
- [x] **P2-15 — Ponti levatoi.** **[CORE MAIN · QA/integrazione se necessaria]** Variante dell'accesso fortificato con stato aperto/chiuso; dipende da fossato e attraversamento. **Accettazione:** stato condiviso tra rendering, navigazione e futuro comportamento d'assedio.
- [x] **P2-16 — Basamenti diversificati.** **[CORE MAIN · QA/integrazione se necessaria]** Verticali, svasati e con contrafforti, anche in combinazione secondo la geometria. **Accettazione:** resa coerente di mura/torri; la variante visiva non altera in modo implicito ingombri, collisioni o costo.
- [ ] **P2-17 — Taverna e Tempio.** **[BASE MAIN; manca effetto civico dichiarato nel pannello]** Collegare gli eventuali edifici civici già rappresentati a servizi, attrattività e coesione. **Accettazione:** effetto di gameplay chiaro, misurabile e senza introdurre nuove catene produttive.
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
