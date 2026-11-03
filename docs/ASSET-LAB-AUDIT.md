# Asset Lab — procedura di audit visivo

L'Asset Lab (`/lab`, oppure DEV → 🗂 Asset Lab) è anche il **motore di audit**: controlla ciò che mostra, con i suoi stessi renderer. Non esiste un secondo renderer da tenere allineato.

## Cosa viene verificato

| Asset | Render | Controlli automatici |
|---|---|---|
| SVG/PNG del manifest | il file | caricato, visibile, fotogrammi di rotazione presenti |
| Modelli 3D (civili, industrie, scatter, carri, assedio, animali) | mesh del Lab | mesh presente, coordinate finite, altezza > 0, visibile |
| Fortificazioni (varianti di `ConquerSiegePreview.GALLERY`) | mesh `ConquerCastle3D` **e** render 2.5D del gioco per ogni stato | vedi sotto |
| Figure e lavori | disegno del gioco | visibile |
| Schemi | SCHEMA illustrativo | avviso `render-del-gioco` (non è il gioco) |

**Stati delle fortificazioni** (`ConquerAssetStage`, dentro `index.html?assetlab=1`):
intatta nel gioco, cantiere 25/50/75%, ogni fase di danno della galleria distruzione (danneggiata, portone, crolli per piano, brecce, distrutta), cutaway quando la struttura lo ammette.

| Controllo | Livello | Significato |
|---|---|---|
| `avanzamento-cantiere` | errore | il cantiere ha esattamente l'avanzamento richiesto |
| `cantiere-progressivo` | avviso | 25/50/75% devono apparire diversi |
| `piani-crollati` | errore | «crollo k piani» abbassa il livello di k |
| `distrutta-rovina` | errore | distrutta = rimossa o rovina |
| `integrita-ridotta` | errore | danneggiata = hp < 1 |
| `sagoma-conservata` | errore | una struttura ancora in piedi conserva ≥ 60% della sagoma intatta |
| `danno-visibile` | avviso | il danno cambia almeno lo 0,3% dei pixel (confronto pixel per pixel) |
| `cutaway-attivo` / `cutaway-diverso` | errore | il cutaway è attivo e si vede |
| `altezza-per-livello` | errore | L1 < L2 < L3 per la stessa variante (mesh 3D) |

Ogni render ha anche una **firma** (griglia 12×12 di luminanza): confrontata con `qa/asset-audit-baseline.json` dà `nuovo` (non c'era), `cambiato` (distanza > 0,01) o `sparito`.

Le catture sono ripetibili: mondo con seed fisso, luce di giorno, sole, orologio delle animazioni fermo, id stabili (stesse macerie a ogni giro), nessuna partita in corso (`?assetlab=1` non avvia la simulazione).

## Procedura per ogni nuova aggiunta o modifica visiva

1. **Aggiungi l'asset dove vive** (non nel Lab):
   - file SVG/PNG in `src/assets/…` → `node tools/build-asset-manifest.cjs`
   - torre, muro o porta → nuova riga in `GALLERY` (`src/settlement-siege-preview.js`)
   - modello 3D → il suo registro (`window.Conquer…Models`)
2. **Esegui l'audit** (serve un server statico sulla radice del repo, porta 4173):
   ```bash
   node qa/asset-audit.mjs
   ```
   Opzioni: `--category=Fortificazioni`, `--family=Porte`, `--ids=castle:porta-legno`, `--strict` (fallisce anche su nuovi/cambiati), `ASSET_LAB_URL=…`.
   In alternativa: pulsante **Audit** nel Lab, oppure dalla console `await ConquerAssetAudit.run()`, `ConquerAssetAudit.inspect(id, stato)`, `ConquerAssetAudit.sheet({family:'Porte'})`.
3. **Rivedi** `artifacts/asset-audit/report.md` e i fogli provini `artifacts/asset-audit/sheets/*.png` (bordo rosso = errore, arancio = avviso, blu = nuovo, viola = cambiato, grigio = noto).
4. **Risolvi** ogni errore. Se un problema è noto e accettato, aggiungi una deroga con il motivo in `qa/asset-audit-baseline.json`:
   ```json
   "waivers": { "castle:porta-legno|damage-portone-incrinato|danno-visibile": "BUG noto: il portone in legno non mostra il danno (BACKLOG)" }
   ```
   (`id|stato|controllo`, stato `*` per tutti gli stati). Le deroghe restano visibili come «noti».
5. **Aggiorna la baseline** solo dopo aver rivisto i fogli:
   ```bash
   node qa/asset-audit.mjs --update-baseline
   ```
   e committa `qa/asset-audit-baseline.json` insieme all'asset.

La CI (`Asset Lab regression` → `browser`) esegue l'audit su ogni PR che tocca asset, Lab o renderer delle fortificazioni, scrive il report nel riepilogo del job e carica report e fogli provini come artifact `asset-lab-visual-qa`. Fallisce sugli errori, non su nuovi/cambiati (quelli si rivedono).

## Avvertenze

- Il render 2.5D di **legno danneggiato o in costruzione è sbagliato con SwiftShader forzato** (`--use-angle=swiftshader`): l'audit lancia Chromium senza quel flag. Variabile `AUDIT_ARGS` per altri flag.
- Le catture sono deterministiche sulla stessa macchina (distanza 0 tra due giri). Su un'altra macchina (CI Linux) la rasterizzazione può differire di poco: un «cambiato» in CI senza modifiche visive va confrontato con il foglio provini prima di aggiornare la baseline.
