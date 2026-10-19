# CONQUER / clay — istruzioni operative per argilla e murature in mattoni

> **Stato:** SPECIFICA DI SVILUPPO (19/10/2026), **non implementata**. Branch `clay` derivata esattamente da `Civil`; non da `main`. Questo documento è un contratto di design e una guida per il prossimo intervento, non una prova di funzionalità.
>
> Prima di modificare sorgenti: leggere [AGENTS.md](../AGENTS.md), [piramide di contesto](context/README.md), [decisioni](context/DECISIONS.md), [stato](context/STATUS.md), [economia](economy.md) e [guida Civil](CIVIL-ANNEX-DEVELOPMENT.md). Ricontrollare HEAD e codice vivo, preservare tutte le feature di `Civil`.

## 1. Scopo e regole vincolanti

CONQUER deve permettere castelli e costruzioni murarie anche nei territori pianeggianti, evitando che la pietra di montagna o importazioni costose siano condizioni necessarie. La soluzione aggiunge **una risorsa economica `clay` (Argilla)** e **un materiale costruttivo `brick` (mattoni cotti)**, non un secondo tipo di castello.

1. La **Cava esistente** può estrarre **pietra** oppure **argilla**. Per l'argilla è collocabile **entro 6 U da rive di fiumi, torrenti e laghi**; per la pietra conserva il vincolo di roccia ripida già esistente.
2. Una costruzione che oggi richiede pietra può usare **argilla al suo posto**. La scelta cambia **sia il costo delle risorse sia l'aspetto della muratura**; non deve essere soltanto una tinta cosmetica.
3. La versione in mattoni riutilizza **esattamente la geometria** della versione in pietra (segmenti, altezze, merli, porte, torri, contrafforti, cutaway, collisioni).
4. La muratura in mattoni ha **durabilità massima pari all'80%** del corrispondente componente murario in pietra, a parità di tipo e livello.
5. Nessuna nuova fornace o catena di produzione obbligatoria: **cottura ed essiccazione sono astratte** nel processo di produzione/impiego; `brick` NON diventa una seconda risorsa di inventario.
6. Supportare **materiali diversi tra elementi dello stesso complesso** (per esempio torre in pietra, mura in mattoni): scelta per singola struttura/elemento costruibile. Non modificare automaticamente tutte le strutture collegate.
7. **Vasellame**: opportunità economica futura di Workshop L3, **fuori scope** della prima implementazione. Non creare ora una merce, professione o edificio dedicato.

## 2. Contratti osservati sulla base `Civil` da non rompere

| Area | Stato osservato su `Civil` | Istruzione |
|---|---|---|
| `src/settlement-industries.js` | `quarry` 3×3 U, 2 lavoratori L2, `good:'stone'`, sovrapposizione con fascia `steep`; footprint deve evitare acqua/foreste/ostacoli | **Estendere** Cava con modalità di estrazione, non duplicare `type:'quarry'` o il sistema dei lavoratori |
| `src/settlement-core.js` | `COSTS` per torri, mura, built sections, gate, well, market, tavern, church, plaza, training; `constructionCost`; `State.resources`, `RES_ORDER`, `costText` | Unico risolutore di costi: mappare `stone` → `clay` soltanto sulle quantità in pietra del componente configurato `brick`; lasciare invariati gli altri costi |
| `src/settlement-core.js` | `material:'wood'/'stone'` è già usato su torri/porte; ponti usano `variant:'stone'` | Definire `brick` nella semantica dei materiali di muratura, senza confondere i ponti con le proprietà/varianti delle torri |
| `src/settlement-app-persistence.js` | `migrateStructures` riconduce oggi torri/porte a `wood` o `stone` | Estendere normalizzazione e versionamento; **non convertirne silenziosamente** una versione `brick` in `stone` al reload |
| `src/settlement-castle3d.js`, `src/settlement-castle.js`, `src/settlement-buildings.js` | Render WebGL2 e fallback Canvas, palette grigie, cutaway/ombre, geometrie condivise | Cambiare palette/materiale senza duplicare mesh, footprint, collider o cache; entrambi i renderer devono combaciare |
| `docs/economy.md`, `src/settlement-economy.js` | Ledger aggregato; beni principali `food/wood/stone/metal`; capitale, riserve e produzione | Estendere **lo stesso** registro a `clay` e al flusso cava; nessuna economia parallela |
| `State.resources` vs ledger | Inventario di costruzione e stock economici ancora distinti nella baseline | Documentare e testare questa limitazione. Non introdurre un terzo magazzino argilla e non dichiarare un'integrazione totale inesistente |

L'asset della cava è oggi schematizzato: qualsiasi nuova rappresentazione deve restare compatibile con il placement esistente. La `mine` produce attualmente `stone` nel codice; **non correggere qui** l'ambiguità metallo/pietra già segnalata nella piramide.

## 3. Estrarre argilla con la Cava

- **Identità**: mantenere `type:'quarry'`; aggiungere una selezione di produzione persistente, per esempio `extractionMode:'stone'|'clay'`, con default **`stone` per i salvataggi esistenti**. Derivare da questa `productionGood`, descrizione/tooltip e resa.
- **Pietra**: conservare l'intersezione geometrica del footprint 3×3 U con una fascia rocciosa `steep`. Non degradare le cave legacy.
- **Argilla**: consentire piazzamento del medesimo footprint 3×3 U se la distanza minima dalla sua sagoma alla **riva** di un oggetto idrico idoneo è **≤ 6 U**. Criterio geometrico proposto: distanza bordo-poligono/bordo-linea, non semplice distanza dal centro della cava. Se geometrie idriche sono linee con larghezza, misurare dalla riva effettiva; non contare l'interno dell'acqua come terreno disponibile.
- **Tipi**: riusare `river`, `stream` e oggetti `pond` solo quando rappresentano i laghi; **il mare non qualifica** automaticamente il sito. Se un lago usa un altro tipo, uniformare tramite la classificazione del landscape, non con un secondo rilevatore.
- **Vincoli invariati**: footprint interamente nella whitezone, niente intersezioni con acqua/foreste/ostacoli/strade/edifici. Permettere anche cave di argilla su terreno pianeggiante; non imporre `steep` a questa modalità.
- **Doppia idoneità**: dove la zona soddisfa entrambe le condizioni, il giocatore sceglie quale risorsa estrarre. Nessuna generazione contemporanea di entrambe dalla stessa cava salvo un futuro upgrade esplicito.
- **Produzione**: mantenere 2 L2 e il ritmo lavorativo esistente come baseline; cambiare solamente il bene prodotto. Nessuna nuova classe di lavoratori o catena di cottura.
- **Retrocompatibilità**: per un sito caricato già esistente, rispettare modalità salvata anche se il paesaggio cambia; eventuale perdita di idoneità dovuta a variazioni ambientali deve seguire una policy esplicita, non cancellare strutture durante la migrazione.

## 4. Scelta della muratura su edifici e fortificazioni

- **Risorsa** `clay` e **materiale di costruzione** `brick` sono distinti: 1 unità di pietra richiesta → 1 unità di argilla richiesta quando si sceglie `brick` (parità di costo materiale iniziale; bilanciamento modificabile successivamente).
- Applicare la conversione per **tutte le voci del catalogo** che consumano `stone`: mura, torri, porte/torri-porta, `built`, pozzo, edifici civici (chiesa, taverna, mercato, piazza, ecc.), ponti murari, edifici produttivi e altre strutture presenti o future con una componente muraria. Non convertire `wood`, `metal` o `gold`.
- La scelta deve essere disponibile in Builder per la struttura/segmento prima della costruzione e visibile nella preview, nei costi, nella selezione e nel pannello informativo. Un default `stone` mantiene vecchi salvataggi e comportamenti. Gli elementi **interamente lignei** (palizzate, torri/porte in legno, ecc.) non devono diventare in mattoni tramite una semplice conversione dei costi.
- **Aggregati misti**: ciascun ID di struttura/segmento (muro, torre, porta, built section) mantiene la propria scelta. Componenti fisicamente separati (per esempio anta del portone, tetto ligneo, pavimento in legno) **non** ereditano il materiale della muratura. Non introdurre oggetti clone `brickWall`/`brickTower`.
- **No exploit**: il cambio materiale su costruzioni completate non dev'essere un toggle gratuito che rigenera HP o risorse; mantenerlo limitato al progetto/preview fino a decisione su ristrutturazioni.
- **Bridge caveat**: i ponti usano `variant:'stone'` in modo diverso dalle torri; preservare la variante tipologica e introdurre eventualmente un attributo murario distinto senza alterare la funzione di attraversamento.
- Eventuali edifici generati automaticamente senza costo esplicito richiedono soltanto una regola di assegnazione di materiale e palette, **non** l'invenzione di un consumo di pietra retroattivo.

## 5. Durabilità, assedi e combattimento

- Definire la durabilità nominale per tipo/livello prima del materiale. Per una parte muraria equivalente: `maxIntegrity(brick) = 0.8 × maxIntegrity(stone)` con arrotondamento coerente e documentato.
- La riduzione **riguarda l'integrità massima del componente**, non moltiplica indiscriminatamente i danni, i costi o i tempi; tutto il resto resta invariato salvo una decisione futura.
- Separare i bersagli: per una torre-porta il portone ha integrità indipendente dalla torre; la muratura in mattoni non riduce automaticamente quella dell'anta.
- Preservare le regole di assedio già decise: attacchi ordinari e frecce **non danneggiano mura/torri**; solo sorgenti compatibili infliggono danni strutturali. Non dare ai soldati la possibilità di demolire mattoni con spade.
- In salvataggio mantenere percentuale/stato di danno senza regalare riparazione o integrità dopo la migrazione; gli HP correnti devono essere vincolati al nuovo massimo. Nessun cambiamento a navmesh, altezza, visibilità, accessi e slot presidio per il solo materiale.

## 6. Rendering, scena e performance

- Palette `stone` attuale grigia; palette `brick` proposta **rosso-marrone/terracotta** con facce illuminate, scure, top, merli e giunti coerenti. Non tingere porte in legno, tetti, ferrature, acqua o elementi d'arredo.
- Riutilizzare la **stessa geometria** di torre/muro/porta/built section/edificio per Canvas e WebGL2. Passare un semantic material alla palette, non duplicare funzioni di costruzione dei volumi.
- Su un castello misto, evitare che un'unione visiva di volumi contigui cancelli la distinzione cromatica tra segmenti. Tenere regole di occlusione/cutaway/interior e roof variants.
- Invalidare le cache dipendenti dal materiale quando cambia il progetto; verificare rendering invernale, illuminazione notturna, selezione, ghost di placement, minimappa e LOD, senza incrementare inutilmente il numero di draw call.
- Un pattern di mattoni, se introdotto, dev'essere indipendente dalla geometria e soggetto a zoom/LOD; **non necessario** per l'MVP se la palette è già chiaramente leggibile.

## 7. Ordine di implementazione

1. Aggiungere specifica semantica per commodity `clay` e materiale `brick`, con normalizzazione compatibile e unica fonte dei costi.
2. Estendere `quarry` a due output e il suo validator di sito (raggio **6 U** per argilla); UI di selezione con preview e messaggi chiari.
3. Collegare `clay` al ledger economico esistente, alla UI economica e all'inventario test costruzioni, senza creare nuovi stock paralleli.
4. Centralizzare conversione dei **costi murari** e assegnazione materiale su tutti i tipi eleggibili; coprire eventuali voci future.
5. Collegare palette alle due pipeline grafiche, inclusi gate, built sections, edifici civici e gli annessi `Civil` quando hanno veri elementi in muratura.
6. Integrare il coefficiente **0.8** nella sola integrità strutturale pertinente; collaudare porte, assedi, manutenzione e save/load.
7. Eseguire [piano di regressione](CLAY-REGRESSION-PLAN.md); aggiornare piramide di contesto con **codice e test realmente eseguiti**, aprire PR verso **`Civil`** per integrazione intermedia solo se richiesto. Non fare merge/deploy automatico.

## 8. Decisioni rimaste aperte (non inventare implementazioni)

- Se mostrare un'autentica trama di mattoni già nell'MVP (per ora basta una palette differenziata).
- Se la materia prima `clay` avrà un costo commerciale diverso da `stone`: per il primo rilascio equivalenza di quantità, non di prezzo di mercato.
- Se supportare in futuro ristrutturazioni/upgrade da mattoni a pietra e relativa conservazione dei danni.
- Se esista un limite di giacimento di argilla o una capacità territoriale; **non** introdurre depletion ora senza design separato.
- Se aggiungere in futuro vasellame alla bottega; **non** inserirlo nel core adesso.

**Definition of Done**: non è sufficiente cambiare colore o aggiungere un contatore. La chiusura richiede **estrazione entro 6 U + conversione risorse in costruzione + scelta indipendente del materiale + 80% integrità + Canvas/WebGL2 + regressioni e reload**. Lo stato attuale di questa branch rimane **solo istruzioni Markdown**.

## Implementazione DEV palette (19/10/2026)

**CODICE IN BRANCH `clay` — esclusivamente estetico e separato dalla futura economia argilla.** Due pulsanti Stone/Clay nella sezione DEV controllano una palette cromatica globale. La selezione è una preferenza locale (`conquer.dev.visualPalette.v1`, default Stone), **non** un attributo degli edifici o della partita. Il convertitore condiviso `visualPaletteColor()` in `src/settlement-core.js` si applica alle primitive Canvas e alle palette WebGL2, comprese le mesh del castello e degli edifici. In Clay: mura, torri e merli sono color mattone; piani terra delle abitazioni L2–L4 (torrette L4 incluse) diventano laterizi, mentre i piani alti crema rimangono invariati; tetti in antracite delle case, fortificazioni ed edifici civici diventano color tegola. La paglia L1, il legname e la neve non vengono alterati. L'interruttore invalida cache Canvas, compositi e world3D; le chiavi bitmap/mesh includono la modalità cromatica. La feature non modifica costi, HP, estrazione né tipologia persistita dei materiali. QA automatica: `qa/clay-palette-regression.cjs` e `.github/workflows/clay-palette-regression.yml`. **Resta necessaria una verifica visiva in browser** (Canvas e WebGL2, inverno e cutaway). Il progetto funzionale `clay` rimane per il resto non implementato.
