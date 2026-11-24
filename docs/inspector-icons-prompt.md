# Prompt — generazione icone dell'inspector

Da incollare in una sessione (Claude Code nel repo) o in un generatore SVG. Elenco completo degli id:
[inspector-icons.md](inspector-icons.md).

---

Genera icone SVG per l'inspector degli edifici di CONQUER, un gioco gestionale medievale.

**Stile (obbligatorio, uguale alle icone Builder in `src/assets/builder-icons/`)**
- `viewBox="0 0 64 64"`, `width="64" height="64"`, un solo colore pieno `#000000` su sfondo trasparente
  (il colore lo applica il CSS: niente gradienti, ombre, testo o contorni colorati).
- Forme geometriche piene e spigolose, a poligoni, come incisioni araldiche semplici; i dettagli interni
  sono **intagli** fatti con una `<mask>` (id `cut-<nome-file>`), non tratti sovrapposti.
- Margine di ~4px, silhouette leggibile a 20px; spessore minimo dei dettagli 3px a 64px.
- Prospettiva frontale o di 3/4 lieve; niente persone dettagliate (al massimo una figura stilizzata).
- Un file per icona, nome `kebab-case` uguale all'id (es. `roof-machicolation.svg`), senza script né
  riferimenti esterni.

**Varianti della stessa famiglia** condividono la stessa base e cambiano solo la parte che distingue
l'opzione (i 4 coronamenti: stessa torre, cima diversa; T1…W4: stesso quadrato d'impronta in 4 misure;
altezza 1…4: stessi piani impilati).

**Icone da generare** (id → soggetto):
1. Comuni: `rotate-flip` (freccia a U 180°), `flip-side` (muro con freccia che lo attraversa), `plus`,
   `minus`, `floor-up`, `floor-down` (piani con freccia), `cutaway` (casa sezionata), `select-child`,
   `select-parent`, `build` (martello), `help` (i in uno scudo), `toggle-on`, `toggle-off`,
   `repair` (cazzuola).
2. Torri: `mastio` (torre con corona), `archers` (arco teso), `lookout-on` (occhio sopra torre),
   `outpost` (bandiera su torre isolata), `pyre` (catasta con fiamma), `bell`, `tier-t1`…`tier-w4`,
   `height-1`…`height-4`, `roof-battlement`, `roof-machicolation`, `roof-machicolation-italian`,
   `roof-pitched`, `hoarding`, `inner-roof`, `base-standard`, `base-buttress`, `base-splayed`,
   `roof-shape-pyramid`, `roof-shape-gable`, `roof-shape-hip`, `bartizan-battlement`,
   `bartizan-spire`, `weapon-mangonel`, `weapon-ballista`, `keep-plan-hall`, `keep-plan-halves`,
   `keep-plan-three`, `keep-plan-quad` (piante dall'alto), `stair-wood`, `stair-stone`,
   `drawbridge`, `ladder`.
3. Torri di legno: `wood-roof-open`, `wood-roof-pitched4`.
4. Porte: `gate-open`, `gate-closed`, `night-close` (luna + lucchetto), `upper-masonry`,
   `upper-timber` (graticcio), `portcullis`.
5. Mura: `skin-standard`, `skin-machicolation`, `skin-hoarding`, `wall-stair-wood`,
   `wall-stair-stone`, `moat-dry`, `moat-water`, `moat-widen`, `wall-patrol`, `stakes`.
6. Built / case lunghe: `skin-arcade` (portico), una per ciascuna copertura `roof-cover-*`.
7. Case: `house-l1`…`house-l4` (casa sempre più ricca).
8. Civici: `civic-l1`…`civic-l3`, `plaza-paved`, `plaza-fountain`, `plaza-garden`, `church-gift`,
   una per ogni tipo di annesso (orto, cimitero, banchi del mercato, cortile della locanda).
9. Pozzo: `well-center`, `well-name` (matita su pergamena).
10. Stanze (18): `room-barracks`, `room-armory`, `room-materials`, `room-granary`, `room-kitchen`,
    `room-stables`, `room-noble`, `room-workshop`, `room-chapel`, `room-hall`, `room-throne`,
    `room-treasury`, `room-prison`, `room-latrine`, `room-infirmary`, `room-dovecote`,
    `room-cistern`, `room-falconry`.
11. Risorse (sostituiranno le emoji di `resIcon` in `settlement-core.js` e della barra in alto):
    `res-gold`, `res-food`, `res-wood`, `res-stone`, `res-clay`, `res-metal`, `res-equipment`,
    `res-horses`, `res-population`, `res-materials`.
12. Logistica, acqua, eventi: `transfer`, `convoy-add`, `convoy-cancel`, `convoy-schedule`,
    `convoy-guards`, `vehicle-cart`, `vehicle-ship`, `crossing-upgrade`, `crossing-flood`,
    `bridge-auto`, `half-bridge`, `pier-use`, `yard-ship`, `yard-flag`, `yard-grow`,
    `event-dressing`, `event-setup`, `event-start`, `event-stop`, `camp-army`, `camp-works`.

**Consegna**
- Salva in `src/assets/builder-icons/inspector/` e aggiungi ogni icona a `catalog.json` con
  `"category": "inspector"`, `id`, `label` italiana e `file`.
- Registra le icone nell'Asset Lab (Interfaccia / Icone Builder), esegui `node qa/asset-audit.mjs`,
  rivedi il foglio provini e aggiorna `qa/asset-audit-baseline.json`.
- Procedi a lotti: comuni → risorse → torri → porte/mura → stanze → resto; mostra ogni lotto come
  foglio provini prima del successivo.
