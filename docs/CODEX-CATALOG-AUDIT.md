# CONQUER CODEX — censimento iniziale

Data: 05/11/2026. Base verificata: `main` `bcf3cd788f18560221862fe1908edef4edb5f2d3`.
Branch di lavoro: `docs/codex-catalog-audit-20261105`.

## Scopo e attendibilità

Prima fase del Codex: trovare le definizioni già usate dal gioco, identificarne i consumatori e separare dati, comportamento e proposte. Questo documento è un audit delle sorgenti, non un nuovo catalogo runtime né una certificazione di tutte le meccaniche nel browser. Le liste seguenti censiscono famiglie e chiavi osservate: non sommare varianti grafiche, livelli e oggetti come se fossero elementi indipendenti.

Legenda: **presente** = definizione e percorso applicativo osservati; **parziale** = parte strutturale/visiva o integrazione limitata; **previsto** = intenzione documentata senza equivalente completo accertato. I test citati sono prove disponibili, non eseguite in questo audit documentale.

## Risultato principale

Non esiste ancora una fonte unificata per tutte e sette le famiglie. Esistono registri riutilizzabili, regole procedurali e cataloghi di presentazione. Il Codex dovrà comporli con adapter di sola lettura; duplicare prezzi e vincoli in pagine Wiki renderebbe subito divergenti gioco e sito.

Il catalogo visivo `src/asset-catalog.js` raccoglie file, modelli e soggetti del Lab; `MODEL_SOURCES`, `items` e `subject` collegano risorse a rappresentazioni. Non è il catalogo delle regole. `src/asset-manifest.js` è un manifesto asset, non un elenco di oggetti costruibili. `house-catalog.html` è una tavola delle case. `src/ui/shell.js::CATALOG` e i gruppi di `src/settlement-builder-ux.js` descrivono comandi e selettori UI, non prezzi canonici.

## 1. Edifici e infrastrutture

| Gruppo / chiavi osservate | Fonte proprietaria | Stato e confine |
|---|---|---|
| `tower`: square, round, dee, half; legno watchtower/palisadeTower | `settlement-core.js`: geometria, tier, `COSTS`, varianti; `settlement-castle-placement.js` | Presente; mastio e sottotorre sono ruoli/relazioni di torre, non nuovi tipi da duplicare |
| `gate`: pietra grande/piccola, legno, piano superiore ligneo | stessi moduli; `settlement-gate-fittings.js` | Presente; dimensione, livello e materiale sono assi diversi |
| `wall`, `palisade`, `built` W1/W2, longhouse W1/W2 | `settlement-core.js::TYPES`, `COSTS`, `baseConstructionCost` | Presente; builtWide e longhouse sono configurazioni di built |
| `well`; `market`, `tavern`, `church`, `training`, `plaza`, `townhall`, `guild` | `settlement-core.js::CIVIC_TYPES`, `CIVIC_LEVEL_TYPES`; `settlement-buildings.js` | Presente per costruzione; la piazza dichiara un placeholder di servizi/bonus/popolazione |
| Case L1–L4, piante/torrini e annessi domestici | `settlement-urban.js`, `settlement-core.js`, `settlement-house3d.js` | Presente; spawn spontaneo e pagamento del signore non sono equivalenti |
| `loggingCamp`, `quarry`, `mine`, `windmill`, `watermill` | `settlement-industries.js::TYPES`; `settlement-economy.js::KIND` | Presente; miniera dichiara ancora `good:'stone'` in entrambi i registri, non attribuire produzione metallica nel Codex |
| Cava argilla | `settlement-industries.js::CLAY_QUARRY`, `definition(s)` | Presente: `type:'quarry'` + `extractionMode:'clay'`, non un nuovo type |
| Campi | `settlement-fields.js`, `settlement-population-fields.js`, `settlement-economy.js` | Presente; collegare colture e lavoro alle regole effettive |
| `vineyard` | `settlement-economy.js::KIND` e trattamento field/vineyard | Parziale nell'audit: voce economica trovata, non basta per dichiarare un edificio selezionabile nel Builder |
| `streetSpot`, `stage`, `festivalGround`, `arenaLot`, `armyCamp`, `pillory`, `gallows`, `scaffold` | `settlement-events3d.js::VENUES`, `BUILD`; `settlement-camp.js` | Definizioni e percorsi Builder presenti; effetto criminalità non deducibile dal modello di gogna/forca/patibolo |
| Strade; fossato dry/water; ponte wood/stone | `settlement-core.js`, `settlement-crossings.js` | Presente; opera lineare con costo parametrico |
| Molo L4/L12, banchina, cantiere navale L1/L2 | `settlement-pier.js`, `settlement-quay.js`, `settlement-shipyard.js::LEVELS` | Presente; il cantiere è `type:'pier'` con `yard`, non un type autonomo |
| Terreno, terrazzamento murato, flat | `settlement-terraforming.js`, `settlement-earthworks.js` | Opere del territorio: mantenere consultabili come infrastrutture, senza confonderle con edifici abitabili |

## 2. Sub-building

`settlement-civic-annexes.js::CIVIC_ANNEX_CATALOG` contiene **16 definizioni associate al genitore**:

| Genitore | Chiavi |
|---|---|
| church | cemetery, herbGarden, scriptorium, almshouse, monastery, cloister, square |
| tavern | storage, courtyard, stables, brewery, inn |
| market | stall, loggia, warehouse, shop |

Il registro contiene livello minimo, ingombro, massimo, tipo costruttivo. `cemetery` è intrinseco. Gli annessi sono strutture `civicAnnex` con `parentId` e `annexType`. **Parziali:** il modulo dichiara esplicitamente assenza di posti di lavoro, rese, letti e servizi; `baseConstructionCost` restituisce `{}` per gli annessi. Non trasformare questo fallback in un prezzo definitivo «gratuito».

Altri elementi collegati: sottotorri (`parentTowerId`), accesso rialzato del mastio (`settlement-keep-entrance.js`), corpi esterni di stanza (`settlement-room-exterior.js`), arredi cutaway (`settlement-cutaway-furniture.js`). Sono relazioni differenti: un arredo non è automaticamente un sub-building acquistabile.

## 3. Upgrade

| Registro / comando | Contenuto osservato | Classificazione |
|---|---|---|
| `STRUCTURE_VARIANTS` / `STRUCTURE_VARIANT_DEFAULTS` in `settlement-core.js` | torre: roofStyle, baseStyle, topWeapon, bartizan, roofShape, hoarding, bell; porta: roofStyle, upper, hoarding; muro: skin; built: skin | Opzioni presenti, con vincoli dinamici; non tutte sono acquisti o bonus |
| `StructureCommands` in `settlement-structure-commands.js` | comandi di varianti, piani, livelli civili, assegnazione stanze | Riutilizzare comando e descrittore; non dedurre un costo dalla sola variante |
| `CRENEL_STYLES`, `CRENEL_STYLE_COST`, `ROOF_PITCHES`, `ROOF_PITCH_COST` | merli flat/gabled/swallowtail e pendenze 30/45/60 | Politiche/riconfigurazioni; distinguere effetto globale e singola struttura |
| `settlement-gate-fittings.js` | portone e grata, installazione/riparazione, HP separati | Elementi funzionali; collegare alla porta |
| `settlement-crossings.js` | ponte levatoio; mezzo ponte; conversioni ponte in pietra/fossato allagato | Presente; costo e disponibilità nelle funzioni del modulo |
| `settlement-keep-entrance.js` | scala lignea, conversione in pietra, ponte levatoio del mastio | Distinto dal ponte levatoio di porta: non fondere solo perché condivide nome/costo |
| `settlement-tower-weapons.js`, `settlement-alarm-bells.js` | mangano/ballista sommitale, campana | Collegamenti a macchina e torre; compatibilità da regole correnti |

`ROOM_EXTERIOR` ha due voci, `latrine` e `bell`: una deriva da stanza, l'altra da upgrade. Questa distinzione va preservata.

## 4. Stanze

`settlement-core.js::FUNCTION_CATALOG` contiene **18 funzioni**: guard, barracks, armory, storage, granary, kitchen, stables, nobleRoom, workshop, chapel, commonHall, throneHall, treasury, prison, latrine, infirmary, dovecote, cistern.

`TOWNHALL_FUNCTION_CATALOG` contiene council, tribunal, guard, prison: **20 chiavi selezionabili uniche** nell'unione. `quarters` compare in etichette/capienze, ma non nei due cataloghi selezionabili: trattarlo come voce di compatibilità da verificare, non come ventunesima stanza ordinaria.

Proprietari: `settlement-siege.js::allowed`, `CAPACITY`, `functionCapacity`, `functionSlotFloor`, `functionSlotSize`, `functionSlotUnits` nel core e moduli castello; descrittori e UI in `settlement-structure-commands.js` e `settlement-app-rooms.js`. Infermeria, colombaia, cisterna ed esterni hanno moduli dedicati. Non ogni stanza con etichetta possiede un servizio simulato completo.

Esempi verificati nella sorgente: scuderie al piano terra con esclusioni di tipo/ampiezza; cucina al piano terra delle sezioni built; cisterna al piano terra di torri in pietra almeno tier 2; tribunale nel municipio da L2; prigione al piano terra. Le condizioni vanno esposte tramite gli stessi predicati del gioco.

**Conflitto temporale importante:** sulla base auditata la latrina è ancora al secondo piano di built W1. La PR aperta [#155](https://github.com/erykwest/CONQUER/pull/155), `fix/latrine-towers`, propone lo spostamento nelle torri W1 e nuove ammissibilità. Non presentare il suo contenuto come già integrato.

## 5. Unità

`settlement-combat-rules.js::PROFILES` contiene spearman, patrol, wolf, infantry, knight, captain, archer. Sono **7 profili**, incluso il lupo: non sette unità umane reclutabili. Nel salvataggio di `settlement-combat.js` le kind alleate sono squad, knight, captain, patrol, infantry, archer: profilo, formazione e kind non coincidono uno a uno.

Per i civili non è emerso un singolo registro di reclutamento: case/classi L1–L4, residenti, età/sesso, professione e incarico corrente sono distribuiti tra `settlement-population*.js`, `settlement-economy.js` e le routine. Lavoratori edili, taglialegna, cavatori/minatori, agricoltori, pastori, pescatori, artigiani, mercanti ed equipaggi vanno collegati ai rispettivi allocatori, non inventati come nuove unità acquistabili. Proprietari specifici: `settlement-fishers.js`, `settlement-ship-crew.js`, `settlement-court-people.js`, `settlement-events-people.js`.

Separare nell'adapter futuro: identità/profilo; classe; professione; job corrente; scala di rappresentazione. Costi di reclutamento e tecnologie non vanno ricavati da stipendio o costo di una struttura.

## 6. Macchine da guerra

`settlement-siege-engines3d.js::CYCLE` e `src/assets/siege-engines-model.js` espongono ram, catapult, trebuchet, tower, tower2, ladder, mantlet, ballista: **8 chiavi visive**, con due torri. `mangonel` della torre viene mappato a `catapult` in `settlement-tower-weapons.js`.

Stato: modelli e animazioni presenti; assalti ram/ladder/tower e danni hanno percorsi in `settlement-combat.js`, `settlement-siege-assault.js`, `settlement-siege.js`. La tabella `WEAPONS` non equivale a un catalogo di produzione delle macchine. Non è accertato un contratto unificato completo per costruzione, equipaggio, approvvigionamento e reclutamento di ciascuna delle otto chiavi: classificare tale copertura come **parziale**. Il mantlet visualizzato non prova un effetto difensivo simulato.

## 7. Navi

`settlement-shipyard.js::SHIPS` definisce **5 tipi ordinabili**: barca, cargo, caravella, cocca, nave, con costo e giorni. `LEVELS` definisce cantieri L1/L2; `canBuild` vincola piccoli/grandi. Modelli in `src/assets/ship-models.js`, accesso unificato `ConquerShips.models` anche per barche a remi ausiliarie: non confondere queste ultime con ordini del cantiere.

Proprietari di comportamento: `settlement-fleet.js` (flotta, selezione, attracchi), `settlement-sea-nav.js`, `settlement-ship-crew.js`, `settlement-naval-battle.js`, `settlement-sea-convoys.js`, `settlement-fishers.js`. Ruolo commerciale/militare, appartenenza e livrea sono dimensioni distinte dal tipo di scafo. La flotta ordinaria è persistita da `persist()` in `State.village.fleet` (tipo, appartenenza, livrea, attracco e posizione all’ancora), ripristinata da `restore()` e inclusa nel salvataggio del villaggio. Pescatori e convogli sono esclusi da quel percorso. Il commento iniziale «Not saved yet» è superato dal codice.

Residui documentati in `docs/context/BACKLOG.md`: annullamento ordini, scorte dei convogli, battaglie simultanee, pesce come bene separato e mercato dedicato. Sono **previsti**, non nuovi tipi di nave già disponibili.

## Costi, tempi e requisiti: fonti da riutilizzare

| Informazione | Fonte / precauzione |
|---|---|
| Preventivo costruzione | `settlement-core.js::constructionCost(s)` → `baseConstructionCost(s)` e provider specializzati; non copiare solo `COSTS` |
| Parametri | Dimensioni, lunghezza, piano, tier, forma, legno/pietra/mattoni; `masonryMaterial:'brick'` sostituisce stone con clay nel preventivo |
| Tempi | `buildDuration(s)`, `BUILD_DAYS`, provider industria/eventi/porto/cantiere, stato construction e lavoro effettivo; giorni nominali diversi da tempo residuo e tempo reale |
| Economia | `ConquerEconomy`, stock/tesoro e `spendCost`; `KIND` economico non coincide con elenco Builder |
| Requisiti fisici | Geometria, materiale, suolo, acqua/costa e ingombri nei moduli di placement |
| Requisiti funzionali | `allowed`, parentId, spazi/piani, tipo di molo/cantiere, disponibilità lavoratori; funzioni dinamiche da non tradurre in stringhe statiche scollegate |
| Conoscenze | Campo futuro non mappato: assenza di mappatura non significa «nessuna tecnologia richiesta» né blocco tecnologico già applicato |

## Copertura QA disponibile e limiti

Riferimenti: `qa/builder-menu-regression.cjs`, `qa/builder-placement-regression.cjs`, `qa/civic-annex-regression.cjs`, `qa/room-exterior-latrine-regression.cjs`, `qa/kitchen-rooms-regression.cjs`, `qa/military-stables-regression.cjs`, `qa/cistern-regression.cjs`, `qa/dovecote-regression.cjs`, `qa/drawbridge-regression.cjs`, `qa/gate-fittings-regression.cjs`, `qa/siege-engines-regression.cjs`, `qa/ships-regression.cjs`, `qa/ship-crew-regression.cjs`, `qa/naval-battle-regression.cjs`, `qa/asset-catalog-regression.cjs`.

Nessuna di queste suite gameplay è stata eseguita per questo documento. Nessuna verifica browser o visiva: runtime, asset e bilanciamento invariati. La presenza di una suite non certifica ogni voce né l'intera catena di gioco.

## Passo successivo: catalogo normalizzato, ancora da implementare

1. Adapter di sola lettura sui provider esistenti, con ID Codex distinti dagli ID di istanza e dagli ID asset. Conservare chiave e fonte originali.
2. Record con famiglia, stato di implementazione, varianti, relazioni, riferimenti asset, proprietà e provider di costo/tempo/compatibilità. Evitare un prodotto cartesiano di ogni combinazione grafica.
3. Requisiti fisici, funzionali e conoscenze separati; per le conoscenze distinguere non mappato, nessun requisito deliberato, elenco definito. Nessun albero tecnologico in questa fase.
4. Una sola serializzazione consultabile da sito e Wiki in-game. Separare catalogo statico dal contesto dinamico di partita; conosciuto/disponibile/sbloccato sono stati del giocatore.
5. Prima pagina end-to-end collegata a Builder e Lab; poi estensione per famiglie. Verificare uguaglianza del preventivo col Builder e aggiornamento del catalogo al cambio delle sorgenti.

Al controllo GitHub del 05/11 risultavano aperte #155 (regole stanze) e #158 (griglia fogli audit). #158 modifica presentazione del Lab, non il catalogo di gameplay. Audit ancorato alla base indicata; riesaminare i diff prima della fase 2.
