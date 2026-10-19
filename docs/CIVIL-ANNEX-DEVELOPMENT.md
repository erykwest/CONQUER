# CONQUER / Civil — guida per sviluppare gli edifici civili e gli annessi

> **Stato:** istruzioni operative per la branch `Civil` (19/10/2026), basate sui sorgenti e sulle QA della branch. **Non è una dichiarazione di completamento delle meccaniche.**
>
> **Prima di lavorare:** leggere [AGENTS.md](../AGENTS.md), [docs/context/README.md](context/README.md), [STATUS](context/STATUS.md) e [DECISIONS](context/DECISIONS.md). Verificare la HEAD e i sorgenti correnti: le funzioni possono evolvere. Sviluppare e collaudare sulla branch dedicata; non usare `main` come area di lavoro né attivare deploy automatici di anteprima.

## 1. Scopo e distinzione fondamentale

Questo documento definisce **come continuare lo sviluppo** dello skeleton civile introdotto su `Civil`, con priorità a:

1. **Chiesa L1 → cimitero:** area **intrinseca, automatica**, interna al lotto Voronoi della chiesa. Non è un oggetto `civicAnnex`, non ha pulsante «costruisci» e non viene salvata come struttura autonoma.
2. **Taverna / locanda L2 → estensione birreria:** annesso **costruibile**, selezionabile, cancellabile e persistito come `type: 'civicAnnex'`, `annexType: 'brewery'`, associato alla taverna tramite `parentId`.
3. Estensione coerente delle altre strutture civili: **chiesa, taverna, mercato** (annessi) e **piazza** (tre varianti di suolo pubblico).

**Vincolo di progetto:** prima le regole, lotti, collisioni, stati e test; poi mesh/asset, animazioni e sistemi economici. Gli effetti funzionali proposti più avanti **non sono ancora decisi o implementati**.

## 2. Inventario attuale (contratto del catalogo)

Definizioni: `src/settlement-civic-annexes.js` → `CIVIC_ANNEX_CATALOG`. `level` = livello minimo del padre; `max` = numero massimo di annessi dello stesso tipo per genitore; `w,h` sono unità del mondo **U**. I numeri indicati sono parametri provvisori dello skeleton, non un bilanciamento definitivo.

| Padre | Tipo (`annexType`) | L min. | Max | Ingombro U | Modello |
|---|---|---:|---:|---|---|
| Chiesa | `cemetery` | L1 | 1 | 2.2×2.2, fallback 1.65×1.65 | **Intrinseco** al lotto, non costruibile |
| Chiesa | `herbGarden` | L1 | 2 | 2×2 | Annesso |
| Chiesa | `scriptorium` | L2 | 1 | 2.5×2 | Annesso |
| Chiesa | `monastery` | L3 | 1 | 3×2.5 | Annesso |
| Chiesa | `cloister` | L3 | 1 | 2.5×2.5 | Annesso |
| Taverna | `storage` | L1 | 2 | 1.5×1.5 | Annesso |
| Taverna | `courtyard` | L1 | 1 | 2×2 | Annesso |
| Taverna | `stables` | L2 | 2 | 2.5×2 | Annesso |
| Taverna | `brewery` | **L2** | 1 | **2.5×2** | Annesso, vicino alla taverna |
| Taverna | `inn` | L3 | 2 | 3×2.5 | Annesso |
| Mercato | `stall` | L1 | 8 | 1.25×1 | Annesso pubblico |
| Mercato | `loggia` | L2 | 2 | 3×1.5 | Annesso pubblico |
| Mercato | `warehouse` | L3 | 2 | 2.5×2 | Annesso pubblico |
| Mercato | `shop` | L3 | 4 | 1.75×1.5 | Annesso pubblico |

**Totale: 14 voci, di cui 13 costruibili e 1 intrinseca.** La `plaza` non ha per ora un catalogo di annessi: è un edificio civico pubblico a sé, 5×5 U, con `civicLevel` L1–L3 e `plazaVariant` `paved`, `fountain`, `garden`. Anche `training` è civico, ma non usa attualmente i livelli L1–L3.

## 3. Mappa dei moduli: dove intervenire

| File | Responsabilità corrente / punto di intervento |
|---|---|
| `src/settlement-core.js` | `CIVIC_TYPES`, `CIVIC_LEVEL_TYPES`, `civicLevel`, `normalizeCivicDevelopment`, `civicParts`; costi e tempi (annessi oggi gratuiti e immediati). |
| `src/settlement-civic-annexes.js` | Catalogo, genitore/figli, `makeCivicAnnex`, footprint, `normalizeCivicAnnex`, `civicAnnexPlacementCheck`, cimitero derivato e avvio del tool. |
| `src/settlement-urban.js` | `urbanLots()`, `urbanLotFor()`, lotto con `civicId`, clipping Voronoi, recinzioni, ostacoli e accessi. |
| `src/settlement-placement.js` | `window.ConquerPlacement.check`: preflight condiviso per zone costruibili, terreno e collisioni (anche con case auto per gli annessi). |
| `src/settlement-app-rooms.js` | Pannello della struttura: L1–L3, voce informativa del cimitero, pulsanti annessi, selezione dei figli e limitazioni sul downgrade. |
| `src/settlement-app-input.js` | `State.tool.kind === 'civicAnnex'`, preview al mouse, click e posizionamento. |
| `src/settlement-app.js` | `addStructure`, `deleteStructure`, aggiornamento cache/catasto, cascata padre→figli; divieto di ruotare il padre con figli. |
| `src/settlement-app-persistence.js` | `migrateStructures`: normalizzazione dei figli persistiti, scarto di figli orfani o non supportati, caricamento locale/cloud. |
| `src/settlement-buildings.js` | Canvas: `drawCivicAnnex`, `drawCivicCemetery` e le sagome civiche. |
| `src/settlement-world3d.js` | WebGL2: `addCivicAnnex`, `addCivicCemetery`, costruzione mesh civiche. |
| `src/settlement-render.js` | Dispatch del disegno per strutture civiche e annessi. |
| `src/settlement-population-navigation.js` | Ostacoli/pathfinding: gli annessi costruiti bloccano il percorso secondo il loro `kind`; giardini e cortili sono esclusi dal blocco. |
| `index.html` | Caricamento ordinato dei moduli JS classici (nessun bundler implicito). |

### Contratto di un annesso costruibile

Forma corrente in `State.structures`:

```js
{
  id: '...', type: 'civicAnnex', parentId: 'id-del-padre',
  annexType: 'brewery', x: 0, y: 0, angle: 0,
  w: 2.5, h: 2, annexVersion: 1
}
```

I valori sono esemplificativi. Il tipo e le dimensioni effettive derivano sempre dal catalogo. Non salvare riferimenti a oggetti o mesh; mantenere soli dati serializzabili. Le strutture `civicAnnex` usano il normale ciclo `addStructure` / `deleteStructure` e gli stessi identificatori persistenti delle altre strutture.

## 4. Regole spaziali da NON rompere

- **Chiesa e taverna:** dispongono di un lotto di pertinenza Voronoi identificato da `civicId`; tutto il footprint dell'annesso deve restare nel lotto (`urbanContains` con margine nel controllo attuale). Le sagome costruite non devono tagliare edifici, strade, foreste, ostacoli o terreni non validi.
- **Mercato:** nessun lotto privato; annessi su spazio pubblico entro **9 U** dal mercato e mai dentro lotti Voronoi altrui.
- **Cimitero:** spazio ricavato da `civicCemeteryArea(church)` per ricerca su posizioni candidate e due taglie. Deve stare entro il lotto e non sovrapporsi ai `civicParts` della chiesa. Gli altri annessi sono respinti se invadono l'area riservata. Se nessuna candidata è valida, la funzione restituisce `null`: **non creare un cimitero fuori proprietà**.
- **Birreria:** `civicAnnexPlacementCheck` verifica **L2**, lotto, collisioni e prossimità al perimetro della taverna. L'attuale tolleranza geometrica è **0.85 U** tra vertici/bordi; «adiacente» non significa necessariamente condivisione esatta di un muro. Non dichiarare un collegamento fisico interno finché non è implementato e verificato.
- **Persistenza e gerarchia:** eliminare il padre elimina i figli; non consentire downgrade sotto il livello richiesto dai figli installati; non ruotare il genitore con annessi senza una gestione esplicita del riposizionamento.
- **Catasto:** non costruire recinzioni Voronoi alternative, non duplicare i lotti e non far ricalcolare il lotto del padre come se i suoi stessi annessi fossero proprietà concorrenti.
- **Piazza:** rimane terreno pubblico attraversabile, distinto dall'area del mercato e dai lotti chiesa/taverna.

## 5. Prossima implementazione A — sviluppare il cimitero L1

**PRESENTE NEL CODICE:** area automatica e non persistita, `civicCemeteryArea`, `civicCemeteryGraves`, tombe schematiche nei renderer e riserva per i futuri annessi. Nella taglia grande il placeholder visualizza 6 tombe; nel fallback ridotto 4. Il pannello non offre la costruzione manuale.

**Sequenza tecnica consigliata (ancora DA IMPLEMENTARE):**

1. **Separare geometria e stato:** mantenere `civicCemeteryArea` come fonte del terreno, ma introdurre eventuali eventi di sepoltura/occupazione in dati separati dalla mesh, con schema e versione dichiarati. Non creare automaticamente un `civicAnnex` `cemetery`: `makeCivicAnnex` lo rifiuta intenzionalmente.
2. **Stabilizzare l'area:** valutare un ancoraggio deterministico del cimitero quando nuovi lotti, strade o annessi modificano la geometria; oggi l'area viene ricalcolata dalle posizioni candidate. Verificare che non «teletrasporti» tombe quando cambia il lotto.
3. **Geometria finale:** distinguere appezzamento, percorsi, lapidi/croci/tumuli e delimitazioni; usare una descrizione condivisa che Canvas e WebGL2 traducano senza modificare lo stato logico. Considerare stagioni, occlusione, selezione e LOD.
4. **Regole di ingombro e accesso:** verificare collocazione reale anche rispetto ad annessi già presenti e accessibilità dei percorsi; gli annessi nuovi devono continuare a rispettare la riserva, senza invalidare proprietà esistenti.
5. **Solo dopo approvazione delle regole:** aggiungere capienza, sepolture, eventuali eventi cittadini/religiosi e routine dei popolani. **Capienza, tasso di mortalità, impatti morali e nuove risorse non sono requisiti approvati in questo documento.**
6. **Migrazione:** se introdotti dati persistenti per le tombe, definire default robusti per vecchi salvataggi, gestione della cancellazione della chiesa e test delle transizioni.

**Casi da provare:** chiesa L1 in lotto ampio/stretto/assente; 4 orientamenti della camera; cambio livello L1→L3; lotti vicini e recinzioni; inserimento successivo di orto e scriptorium; eliminazione chiesa; salvataggio/caricamento dopo eventuale introduzione di stato persistente.

## 6. Prossima implementazione B — sviluppare la birreria L2

**PRESENTE NEL CODICE:** catalogo `tavern.brewery`, 2.5×2 U, `max: 1`, requisito L2, creazione mediante tool annesso, footprint nel lotto Voronoi, controllo prossimità al padre, selezione/eliminazione, JSON persistito e sagoma provvisoria `kind: 'timber'`.

**Sequenza tecnica consigliata (ancora DA IMPLEMENTARE):**

1. **Confermare l'impianto:** stabilire se debba essere un volume addossato al fabbricato o un padiglione vicino. Il controllo corrente accetta una distanza geometrica entro 0.85 U: se si desidera una vera estensione di fabbrica, restringere/precisare la condizione e collaudarla per ogni orientamento.
2. **Esplicitare gli accessi:** identificare fronte di ingresso, collegamento alla taverna e spazio di lavoro evitando percorsi che attraversano muri o aree private altrui.
3. **Costruire la rappresentazione 2D/3D:** distinguere visivamente la birreria dal generico annesso in legno; eventuali tini, cappa, camini, deposito botti devono essere asset/interior leggeri e **non sostituire** la collisione logica.
4. **Modellare eventuale attività:** solo dopo decisione sul gameplay, definire input/output, personale, durata e calendario. Collegarsi al ledger economico già esistente invece di aggiornare risorse per ogni figurante. **Non introdurre automaticamente «Birra» come nuova risorsa globale** né bonus alla taverna senza specifica.
5. **Costruzione e avanzamento:** se si supererà lo skeleton gratuito/istantaneo, usare `constructionCost` / `buildDuration` e il ciclo condiviso di cantiere, incluso rimborso/eliminazione; non aggiungere percorsi separati solo per `brewery`.
6. **Persistenza/compatibilità:** preservare `parentId`, `annexType`, `annexVersion`; se si introducono quantità/progressi, versionare e migrare i vecchi annessi creati con lo skeleton.

**Casi da provare:** L1 non può costruire; L2 può; secondo esemplare respinto; lotto insufficiente; posizione lontana respinta; interferenza con corpo della taverna, strade, case auto e altri annessi; cancellazione individuale e del padre; downgrade L2→L1 bloccato con birreria presente; rotazione del padre bloccata; round-trip dei salvataggi.

## 7. Come aggiungere o sviluppare un altro annesso civile

1. **Catalogo:** aggiungere o aggiornare la voce in `CIVIC_ANNEX_CATALOG` con `label`, `level`, `w`, `h`, `max`, `kind`. Usare `intrinsic: true` **solo** quando non esiste una struttura costruibile/persistita e si è implementato un trattamento dedicato.
2. **Geometria e proprietà:** definire footprint in U e regole di sito in `civicAnnexPlacementCheck`; lasciare attiva `ConquerPlacement.check`. Non bypassare la collisione con oggetti auto o lotti.
3. **Builder/UI:** confermare sblocco, conteggi, descrizioni e controlli in `renderFunctionPanel`; usare `startCivicAnnexPlacement` e l'input già esistente per l'hover/click.
4. **Renderer:** fornire Canvas e WebGL2 con coordinate coerenti; aggiornare scene layers/shadow e soglie di LOD se il nuovo asset li richiede.
5. **Navigazione:** decidere se il `kind` è solido o attraversabile; aggiornare gli ostacoli della popolazione e gli accessi, non solo la sagoma.
6. **Save/load:** aggiornare `normalizeCivicAnnex` / `migrateStructures` se cambia lo schema. I salvataggi precedenti devono restare validi; gli orfani non devono sopravvivere alla migrazione.
7. **Regression e contesto:** aggiungere casi a `qa/civic-annex-regression.cjs` e dove serve a `qa/urban-regression.cjs` / `qa/builder-placement-regression.cjs`, quindi aggiornare [STATUS](context/STATUS.md), [DECISIONS](context/DECISIONS.md) e [CHANGELOG](context/CHANGELOG.md).

**Attenzione al livello di sviluppo:** `civicLevel` dello skeleton è attualmente selezionato dal pannello; non applica automaticamente costi, prestazioni o cambi morfologici agli edifici principali.

## 8. Quality gate e condizioni di chiusura

La workflow [`civil-regression.yml`](../.github/workflows/civil-regression.yml) viene avviata con push su `Civil` e controlla:

```text
node --check src/*.js e qa/*.cjs    (iterando sui file)
node qa/urban-regression.cjs
node qa/urban-density-regression.cjs
node qa/builder-placement-regression.cjs
node qa/civic-annex-regression.cjs
```

Questi comandi descrivono la workflow esistente; non implicano che esista un runner locale o che un browser sia già stato collaudato.

**Definition of Done per ogni nuova evoluzione:**
- [ ] Contratti del catalogo, livelli e ownership immutati oppure decisione esplicita registrata.
- [ ] Tutti i footprint rispettano catasto, terreno, edifici, strade e vincoli dell'annesso.
- [ ] UI e feedback di errori verificati (abilitazione, cap, scelta, annullamento e cancellazione).
- [ ] Semantica dei salvataggi versionata e retrocompatibile, senza figli orfani.
- [ ] Canvas + WebGL2, ombre, occlusione, navigazione e stagioni verificati quando applicabili.
- [ ] Regression automatiche pertinenti verdi **sulla HEAD della branch**; citare ID run e SHA.
- [ ] Smoke test manuale nel browser in scenari nuovi e in un salvataggio precedente; distinguere «non eseguito» da «PASS».
- [ ] `docs/context/STATUS.md`, `DECISIONS.md` e `CHANGELOG.md` aggiornati secondo i cambiamenti reali.
- [ ] Nessun merge in `main` e nessun deploy di produzione prima del completamento/approvazione dell'iterazione.

## 9. Decisioni ancora aperte (non codificare come fatti)

- **Cimitero:** dimensione/capienza canonica; politica quando lo spazio è insufficiente; stabilità della posizione rispetto a variazioni catastali; accessi e gestione delle sepolture.
- **Birreria:** continuità fisica obbligatoria con la taverna; interni e rappresentazione; output economici, materie prime, lavoratori e benefici.
- **Altri annessi:** servizi e legami con la popolazione; numero massimo e ingombri da bilanciare; costi e cantieri.
- **Piazza:** funzioni sociali/mercantili e progressione visiva L1–L3.

Non assumere queste proposte come approvate senza una nuova decisione esplicita e relativa registrazione nel contesto.
