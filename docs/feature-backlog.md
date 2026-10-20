# CONQUER — Backlog prioritizzato Builder / Manager

> Aggiornato: 2026-10-19
> Ambito: territorio, foreste, urbanistica, economia locale, fortificazioni, araldica e ambientazione.  
> Documento di pianificazione: **non** equivale a un audit funzionale completo né a un elenco di difetti confermati.

## Convenzioni

- **P0 — Fondamenta territoriali ed economiche:** blocchi necessari a un insediamento produttivo affidabile.
- **P1 — Integrazione economica e difesa:** risorse, capacità del castello, infrastrutture e prime fortificazioni.
- **P2 — Ingegneria e identità:** profondità architettonica, servizi e araldica.
- **P3 — Rifinitura ambientale:** varietà visiva e scatter, senza dipendenze gameplay nuove.
- Le caselle `[ ]` indicano **lavoro ancora da verificare/chiudere**: non significano che la feature sia assente dal codice.
- I riferimenti a elementi **già presenti** sono basati su una ricognizione statica della branch `main` del 16/10/2026. Prima di implementare, controllare cosa già funziona ed evitare duplicazioni.

### Baseline già individuata nel repository

- Orografia, pendii e collisioni correlate: `src/settlement-castle.js`, `src/settlement-landscape.js`.
- Foreste procedurali e relativi test: `src/settlement-landscape.js`, `qa/organic-forest-regression.cjs`.
- Pozzo e sviluppo urbano: `src/settlement-urban.js`, `docs/urban-fixes.md`.
- Campi Voronoi, lavorazioni e percorsi dei lavoratori: `src/settlement-fields.js`.
- Tier economici e accounting: `src/settlement-economy.js`, `docs/economy.md`.
- Logging camp, cava e miniera: `src/settlement-industries.js` (render inizialmente placeholder).
- Sistema araldico SVG/palette: `src/settlement-heraldry.js`, `src/heraldry-symbols.js`.
- Sette file albero: `src/assets/forest/tree_01_tonda.svg` fino a `tree_07_asimmetrica.svg`.

**Decisione da non assumere implicitamente:** al 16/10, nei file economici consultati la **miniera produce `stone`**, non `metal`. La merce definitiva è un punto progettuale aperto.

## P0 — Fondamenta territoriali ed economiche

- [ ] **P0-01 — Orografia base e idoneità del terreno.** Riutilizzare il rilievo esistente, verificando quote/pendenze/scarpate per collocamento edifici, percorsi, estrazione e futura difesa. **Accettazione:** lo stesso contratto di terreno governa validazione del Builder, accessibilità e rendering; i salvataggi precedenti restano leggibili.
- [x] **P0-01a — Terraforming del giocatore (branch `terraforming`).** Scavo/innalzamento e terrazzamento murato con ghost; scarpata murata spiovente; divieto di sovrapporre due terrazzamenti murati; magnete muro a filo; persistenza e rendering Canvas/WebGL2. **Accettazione verificata sul branch:** `qa/terraforming-regression.cjs` (9 controlli), intera QA deterministica e prova browser Chromium. Rimane fuori da `main` fino a integrazione esplicita.
- [ ] **P0-02 — Foreste procedurali funzionali.** Completare, dove mancante, densità e sfruttamento: abbattimento, produzione legna, liberazione del terreno e rigenerazione secondo regole definite. **Accettazione:** produzione e stato della foresta rimangono coerenti dopo reload, senza spawn su edifici o strade non consentite.
- [ ] **P0-03 — Pozzo / Village Core.** Consolidare la fondazione e la crescita progressiva già avviata, anziché ricreare un secondo generatore. **Accettazione:** niente lotti/edifici sovrapposti, crescita deterministica per seed, accessi stradali e persistenza validi.
- [ ] **P0-04 — Abitazioni L1–L4 e popolazione produttiva.** Consolidare la coerenza tra livello abitazione, capienza, tier/professione e disponibilità di lavoro; separare status/tier dal lavoro corrente, se non ancora operativo. **Accettazione:** popolazione disponibile e lavoratori assegnabili coerenti con case ed economia; i tier superiori possono coprire lavori inferiori dove previsto.
- [ ] **P0-05 — Logging Camp.** Completare l'edificio estrattivo già abbozzato, lavoratori e rapporto reale con i boschi; sostituire il placeholder grafico quando pronto. **Accettazione:** collocamento vicino al bosco, output limitato da lavoratori/risorsa locale e comportamento consistente nel calendario economico.
- [ ] **P0-06 — Mulino / Farm Hub.** Definire il polo agricolo sfruttando il sistema campi già esistente. Riconciliare lavorazioni visive (aratura, semina, crescita, raccolto) con il bilancio economico stagionale. **Accettazione:** un'unica fonte per resa annuale, forza lavoro e produzione `food`, senza doppio conteggio.
- [ ] **P0-07 — Cava.** Rifinire il nodo `quarry` esistente e la sua dipendenza dai versanti rocciosi. **Accettazione:** collocamento geologicamente valido, operai L2, output `stone`, salvataggio e visualizzazione coerenti.
- [ ] **P0-08 — Miniera.** Completare il nodo `mine` esistente e risolvere prima il prodotto estratto (`stone` vs `metal`). **Accettazione:** decisione di design esplicita e testata, collocamento vincolato al giacimento, lavoratori L2 e flusso economico coerente.

**Milestone P0:** villaggio fondabile e persistente; terreno e foreste influenzano il posizionamento; lavoratori e quattro poli economici operano in modo osservabile e verificabile.

## P1 — Economia e fortificazioni funzionali

- [ ] **P1-09 — Funzioni delle Built Sections.** Collegare gli slot esistenti a capienza e funzione reale: granaio, magazzino, armeria, caserma, scuderia, alloggi/comando. **Accettazione:** i vincoli per piano/accessibilità e le capacità fisiche sono validati; il contenuto economico non supera capienze definite.
- [ ] **P1-10 — Workshop / Fabbro.** Integrare il laboratorio nella costruzione e nell'economia (il motore conosce già il tipo `workshop`). **Accettazione:** input `metal` + `wood`, output `equipment`, lavoratori L3 e ciclo produttivo senza risorse duplicate.
- [ ] **P1-11 — Mercato.** Completare il collegamento tra edificio fisico e mercato/accounting già esistente, evitando una nuova simulazione concorrente. **Accettazione:** transazioni, stock, riserve, oro e proprietari si aggiornano nello stesso ledger.
- [ ] **P1-12 — Palizzate.** Implementare segmenti, angoli, aperture/porte, costo ridotto rispetto alle mura e vulnerabilità al fuoco. **Accettazione:** gli accessi e le collisioni cambiano davvero i percorsi di unità e attaccanti; le palizzate sono modificabili nel Builder.
- [ ] **P1-13 — Ponti ordinari.** Permettere attraversamenti di fossati e corsi d'acqua, con larghezza compatibile con strada e accesso. **Accettazione:** il pathfinding considera il ponte soltanto quando collegato e transitabile; collocamento e stato sono persistenti.

**Milestone P1:** l'economia alimenta riserve fisiche; gli edifici hanno funzioni effettive; le prime difese e infrastrutture modificano l'accessibilità.

## P2 — Ingegneria militare, servizi e identità

- [ ] **P2-14 — Fossati.** Introdurre varianti asciutte/allagate e normali/larghe, con raccordi al terreno e interruzioni in corrispondenza degli accessi. **Accettazione:** modifica reale della percorribilità; geometria e salvataggio consistenti.
- [ ] **P2-15 — Ponti levatoi.** Variante dell'accesso fortificato con stato aperto/chiuso; dipende da fossato e attraversamento. **Accettazione:** stato condiviso tra rendering, navigazione e futuro comportamento d'assedio.
- [ ] **P2-16 — Basamenti diversificati.** Verticali, svasati e con contrafforti, anche in combinazione secondo la geometria. **Accettazione:** resa coerente di mura/torri; la variante visiva non altera in modo implicito ingombri, collisioni o costo.
- [ ] **P2-17 — Taverna e Tempio.** Collegare gli eventuali edifici civici già rappresentati a servizi, attrattività e coesione. **Accettazione:** effetto di gameplay chiaro, misurabile e senza introdurre nuove catene produttive.
- [ ] **P2-18 — Motore araldico SVG universale.** Verificare e rifinire il sistema già presente: sorgente rettangolare indipendente dal supporto, con clipping lato oggetto. **Accettazione:** una stessa definizione è riutilizzabile su supporti differenti senza duplicazione della logica.
- [ ] **P2-19 — Pattern, quattro colori e simboli.** Completare l'uso di `C1/C2` per il pattern e `C3/C4` per simbolo e contorno. **Accettazione:** resa coerente su scudo, stendardo, veste e bardatura, nei supporti effettivamente disponibili.
- [ ] **P2-20 — Sincronizzazione araldica dal Profile Panel.** Estendere/validare il salvataggio e la propagazione globale delle modifiche. **Accettazione:** cambiamento unico e persistente su tutte le istanze che condividono la configurazione; nessuna texture obsoleta in cache.

**Milestone P2:** fortificazioni avanzate progettualmente leggibili e identità visiva persistente su tutti i supporti pertinenti.

## P3 — Rifinitura ambientale

- [ ] **P3-21 — Sette varianti di alberi SVG.** Gli asset sono già nel repository: verificare uso effettivo nel renderer forestale, varietà e prestazioni. **Accettazione:** distribuzione seeded, riconoscibilità delle sagome, culling/cache e nessun peggioramento significativo dei frame time.
- [ ] **P3-22 — Scatter procedurale antropico.** Preparare circa 25 silhouette nelle sette famiglie: carri, merci, cartelli, ruote/rottami, cataste, attrezzi agricoli e arredi da lavoro. **Accettazione:** distribuzione contestuale (strade, crocevia, cantieri, boschi, periferie), non random uniforme; nessuna interferenza ingiustificata con percorsi e selezione.

**Milestone P3:** insediamenti più riconoscibili e vissuti, senza aumento non necessario della complessità simulativa.

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

Per ogni ID: annotare issue/PR e commit associati, modificare la casella solo dopo verifica, registrare decisioni ancora aperte e riordinare le priorità **quando una dipendenza viene chiusa**.

Riferimenti: [Economia](economy.md) · [Urban fixes](urban-fixes.md) · [Metodo di lavoro](../AGENTS.md).
