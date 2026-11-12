# Piano: ritiro del renderer 2.5D (decisione 2026-11-11)

Scope: edifici, torri, mura, porte, elementi esterni delle stanze → solo 3D (WebGL2).
Fuori scope (restano come sono): scatter (`settlement-scatter.js`, alberi/rocce billboard) e
personaggi a capsule. Edifici CRIME: non toccati.

## 1. Mappa attuale

**Selettore** — `draw()` in `src/settlement-render.js:413`:
`world3d = ConquerWorld3D.active() && ConquerWorld3D.drawBack(r)`.
`active()` = abilitato (default ON, `localStorage conquer.world3d.v2`) e WebGL2 disponibile.
Si torna al 2.5D se: `?world3d=0`, `?renderer=canvas2d`, niente WebGL2, oppure eccezione in
`drawBack`/`finishFrame` (`disableRenderer` → `invalidateSceneCache` → cache Canvas).

**Percorso 3D** (default)
- `settlement-world3d.js`: terreno, case, civici, industrie, castello (`ConquerCastle3D.worldMeshes()`),
  cutaway rooms, decals, luci notturne, front pass con mesh dinamiche.
- `settlement-castle3d.js`: costruttori di mesh del castello (`worldMeshes`) **più** un vecchio
  rasterizzatore opt-in (`drawBody`/`drawFront`, `?castle3d=1`) che scrive nelle cache 2.5D.
- `settlement-wood3d.js`: palizzate, torri/porte di legno, long house (`handles(s)`).

**Residui 2.5D anche col 3D attivo** (sono i difetti visibili)
1. `world3d.residual2D()` / `drawFront` residual: legno senza modello 3D → `drawStructure` + `drawCastleBattlements`.
2. `world3d.drawMastioDrapes()`: `drawFacadeWindows` 2.5D sulle torri del Mastio.
3. Cantieri: `settlement-render.js:447` `drawStructure(s)` + `ConquerConstructionProps.drawSite` (2.5D),
   mentre `siteMesh()` 3D esiste già (`settlement-construction-assembly.js:404`).
4. Ghost di piazzamento: `drawStructure(ghost,true)` / `drawInvalidPlacementGhost`.
5. `settlement-assets.js:262-271` (anteprime asset): `drawStructure`, roofs, battlements, windows, portals.

**Percorso 2.5D puro (fallback)**
- `settlement-render.js`: cache `castleBody`/`castleFront`, `renderCastleBodyContent`,
  bitmap composite + benchmark A/B, `drawCutawayStaticOverlay`, toggle "Castle cache".
- `settlement-castle.js`: `drawCastleUnion(+Details)`, `drawTowerRoofs`, `drawGateRoofs`,
  `drawMachicolationFloors`, `drawCastleBattlements`, `drawTowerDoors`.
- `settlement-castle-structures.js`: `drawStructure` per torri/mura/porte/built, `drawCutawayStructures`.
- `settlement-room-exterior.js`: `drawAll`/`drawRoomExteriors` (latrine, sbalzi…).
- `settlement-cutaway-furniture.js`: arredi cutaway disegnati su Canvas.
- `settlement-architecture.js`: `drawFacadeWindows`, `drawGatePortals` (+ wrapper in gate-fittings/siege).

Importante: castle3d/world3d **riusano le funzioni di geometria** di questi file
(`unionFootprintPoints`, `*BattlementPieces`, `towerRoofFootprintPoints`, `gateRoofGeometry`,
`builtRoofGeometry`, layout stanze/esterni). Si eliminano solo le funzioni che dipingono su `ctx`,
la geometria resta (eventualmente spostata in moduli `*-geometry.js`).

## 2. Migrazione

| Pezzo | Destino |
|---|---|
| Fallback `castleBody`/`castleFront` + bitmap cache + benchmark + toggle | **eliminato** |
| `castle3d.drawBody/drawFront` (opt-in `?castle3d=1`) | **eliminato**; resta `worldMeshes()` |
| `drawCastleUnion*`, roofs, machicolations, battlements, tower doors (paint) | **eliminati** |
| `drawStructure` ramo castello (tower/wall/gate/built/palisade) | **eliminato**; resta per case/strade/campi finché non migrano |
| `drawCutawayStructures` + furniture 2.5D | **eliminati**; il cutaway 3D (`cutaway#n`) è già canonico |
| `ConquerRoomExterior.drawAll` (paint) | **eliminato**; la geometria va nel mesh 3D (verificare copertura per ogni esterno) |
| Legno senza modello (`residual2D`) | modello 3D mancante → `wood3d` copre tutti i casi, poi via il residuo |
| Mastio drapes | **mesh/decal 3D** in world3d |
| Cantieri torri/mura/porte | **`siteMesh` 3D + mesh parziale** tramite `addMesh`; via `drawStructure` |
| Ghost piazzamento | ghost 3D traslucido via `addMesh` (contorno 2D resta come overlay) |
| `?world3d=0`, `?renderer=canvas2d` per edifici | senza WebGL2: messaggio "WebGL2 richiesto" invece del fallback |
| Scatter, personaggi a capsule, overlay 2D (selezione, flag, fumo, UI) | **invariati** |

## 3. Asset Lab

- `ConquerAssetStage.capture` chiama già `draw()`: con WebGL2 la cattura è il frame 3D. Oggi però
  `STRUCTURE_LAYERS` invalida cache Canvas e il frame contiene i residui 2.5D sopra.
- Cambi: lo stage forza il 3D (`ConquerWorld3D.invalidate()` invece delle cache Canvas, errore
  esplicito se `!ConquerWorld3D.active()`); la colonna "Nel gioco" diventa "3D"; ogni cattura
  registra `renderer:'webgl2'` e `qa/asset-audit.mjs` fallisce se un'immagine non è 3D.
- `asset-audit.js` compara contro il baseline per firma: tutte le voci `castle:*` cambiano.
- Chromium dell'audit: già senza `--use-angle=swiftshader` (vedi docs/ASSET-LAB-AUDIT.md); in CI
  serve WebGL2 (usare `--use-angle=swiftshader --enable-unsafe-swiftshader` solo per il 3D se il
  legno danneggiato in 3D è corretto, va verificato).

## 4. Baseline `qa/asset-audit-baseline.json`

- Tutte le voci `castle:*|*` (torri, mura, porte, sezioni costruite, long house, addossati, cantiere,
  danno, cutaway, pendenze) vanno rigenerate (`--update-baseline`) dopo revisione dei fogli.
- Le voci `file:*` (SVG animali, scatter) e i personaggi restano identiche: se cambiano è un bug.
- I waiver esistenti (`...latrina|damage-elemento-esterno-crollato`) vanno rivalutati sulle nuove immagini.
- Stati che il 3D non sa ancora mostrare (cantiere a %) restano esclusi finché la fase 3 non è fatta,
  con un waiver esplicito, non con l'immagine 2.5D.

## 5. Fasi (commit/PR incrementali)

1. Docs: decisione in DECISIONS/STATUS/BACKLOG/CHANGELOG + questo piano.
2. Asset Lab: stage solo 3D + flag renderer + audit che lo verifica (baseline rigenerato).
3. Eliminare il fallback Canvas del castello (`castleBody`/`castleFront`, castle3d opt-in, toggle cache).
4. Residui: Mastio drapes e room exterior in 3D, rimuovere `drawRoomExteriors` e furniture 2.5D.
5. Legno: copertura completa `wood3d`, via `residual2D`.
6. Cantieri e ghost in 3D, via `drawStructure` per le fortificazioni.
7. Pulizia: funzioni di pittura morte, test `qa/*.cjs` che le cercano per nome aggiornati.

Rischi: test `qa/*.cjs` che fanno grep sul sorgente 2.5D (es. `built-portico-regression.cjs`);
CI senza GPU; macchine senza WebGL2 perdono il gioco (accettato dalla decisione).
