# Icone dell'inspector — backlog (2026-11-24)

Prompt pronto per generarle: [inspector-icons-prompt.md](inspector-icons-prompt.md).

Obiettivo: sostituire il testo dei tasti dell'inspector di ogni edificio con icone 24×24 a tratto, nello
stesso stile della mappa `ICON` di `src/ui/shell.js` e di `src/assets/builder-icons/`. Il testo completo
resta nel tooltip. L'**id** coincide con la chiave del descrittore (`StructureCommands.describeStructure`
→ `ctl.key`) o dell'opzione (`word`/`value`), così UI legacy e UI v2 usano lo stesso nome.

Esistono già (da riusare): `rotateLeft`, `rotateRight`, `delete`, `undo`, `select`, `shield`, `alarm`,
`patrols`, `target`, `chevron`, `gear`; edifici `municipio`, `gilda`, `bargello` (categoria `inspector`
in catalog.json).

## 1. Comuni (tutti gli edifici)
| id | Sostituisce |
|---|---|
| `rotateLeft` / `rotateRight` | ↺ / ↻ 15° (esistono) |
| `rotateFlip` | ⇄ 180° |
| `flipSide` | ⇄ Inverti lato esterno (muro, palizzata, built) |
| `plus` / `minus` | + / − (arcieri, livello casa, ronde) |
| `floorUp` / `floorDown` | ▲ / ▼ piano in vista |
| `cutaway` | Spaccato aperto/chiuso |
| `selectChild` / `selectParent` | ↳ annesso, ← edificio |
| `build` | + costruisci annesso / ampliamento |
| `demolish` | Annulla cantiere / Rimuovi (= `delete`) |
| `help` | ⓘ mostra spiegazioni |
| `toggleOn` / `toggleOff` | Sì/No, Montato/Smontato |
| `repair` | riparazioni (stanze, grata) |

## 2. Torri in pietra
| controllo | opzioni |
|---|---|
| `mastio` | designa / attivo |
| `archers` | arco + `plus`/`minus` |
| `lookout` | `lookoutOn`, `lookoutOff` |
| `outpost` | `outpost`, `outpostDismiss` |
| `signalFire` | `none`, `pyre`, `pyreRebuild` |
| `bell` | `none`, `bell` |
| `tier` | `T1` `T2` `T3` `W4` (impronte di 4 taglie) |
| `height` | `1`…`4` (piani impilati) |
| `roof` | `battlement`, `machicolation`, `machicolationItalian`, `pitched` |
| `hoarding` | `off`, `on` |
| `innerRoof` | `innerRoofOff`, `innerRoofOn` |
| `base` | `standard`, `buttress`, `splayed` |
| `roofShape` | `pyramid`, `gable`, `hip` |
| `bartizan` | `none`, `battlement`, `spire` |
| `weapon` | `none`, `mangonel`, `ballista` |
| `keepPlan` (mastio W4) | `hall`, `halves`, `three`, `quad` |
| `keepStair` | `ground`, `stairWood`, `stairStone`, `remove` |
| `keepDrawbridge` | `install`, `raise`, `lower`, `remove`, `ladderUp`, `ladderDown`, `auto` |
| `rooms` | 18 funzioni: caserma, armeria, magazzino materiali, granaio, cucina, scuderia, stanze nobili, officina armi, cappella, sala comune, sala del trono, tesoro, prigione, latrina, infermeria, colombaia, cisterna, falconiera |

## 3. Torri di legno
`woodRoof`: `open` (piattaforma), `pitched4` (falde su 4 pali).

## 4. Porte
| controllo | opzioni |
|---|---|
| `gate` | `gateOpen`, `gateClosed` |
| `nightClose` | luna + lucchetto |
| `upper` | `masonry`, `timber` (graticcio) |
| `roof`, `hoarding` | come torri |
| `portcullis` | `install`, `toggle`, `repair`, `remove` |
| `drawbridge` | `install`, `toggle`, `remove` |

## 5. Mura / palizzate
| controllo | opzioni |
|---|---|
| `tier`, `height` | come torri (sezione di muro) |
| `skin` | `standard`, `machicolation`, `hoarding` |
| `wallStair` | `none`, `stairWood`, `stairStone`; `wallStairPos` inizio/metà/fine |
| `moat` | `moatDry`, `moatWater`, `moatWiden` |
| `wallPatrols` | soldato sul cammino + `plus`/`minus`, `wallEnlist` |
| `stakes` | `stakeSegments` (pali della palizzata) |

## 6. Built / casa lunga
`skin`: `standard`, `arcade` (portico) · `roofCover`: una per copertura · `flipSide` (finestre).

## 7. Case
`houseLevel` L1–L4 + `plus`/`minus`.

## 8. Edifici civici (mercato, taverna, chiesa, piazza, municipio, gilda, bargello, balivo)
| controllo | opzioni |
|---|---|
| `civicLevel` | `L1` `L2` `L3` |
| `plaza` | `paved`, `fountain`, `garden` |
| `annex` | una per tipo di annesso (orto, cimitero, banchi, cortile…) + `build`/`selectChild` |
| `townhallRoom` | stanze del municipio (tribunale…) |
| `churchGift` | dono/offerta |
| `guild` | azioni della gilda (ufficiali, bonus bottega) |

## 9. Pozzo
`wellCenter` (centro villaggio), `wellName` (matita), `wellUpgrade`: `municipio`, `gilda`, `bargello` (esistono).

## 10. Produzione e logistica
| edificio | id |
|---|---|
| Piazzale | `yardSize` 2/4/6, `yardGrow` |
| Industrie (cava, taglialegna, miniera) | solo rotazione; stato `workers`, `owner` |
| Logistica castello | `transfer` + risorse (cibo, legno, pietra, metallo, equipaggiamento, oro, cavalli) |
| Convogli | `convoyAdd`, `convoyCancel`, `convoySchedule`, `convoyGuards`, `convoyReserve`, `vehicle` |

## 11. Acqua, attraversamenti, eventi, campo
| edificio | id |
|---|---|
| Fossato / ponte | `crossingUpgrade`, `crossingFlood`, `crossingDemolish`, `bridgeAuto`, `halfbridgeBuild` |
| Molo / cantiere navale | `pierUse`, `yardShip`, `yardFlag` |
| Spazio eventi | `eventDressing`, `eventSetup`, `eventStart`, `eventStop` |
| Campo militare | `campArmy`, `campWorks` |

## 12. Solo DEV (bassa priorità)
`siegeTest` ascia/ariete/trabucco, `siegeBay`: visibili solo con un interruttore DEV attivo.

**Totale:** ~13 comuni + ~95 per edificio (+18 funzioni stanze, +7 risorse).
Priorità suggerita: comuni → torri → porte/mura → stanze → resto.
