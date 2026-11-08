# CONQUER — STONECOLOR · Scheda di validazione cromatica v1

**Branch:** `feature/stonecolor` · **Data:** 08/11/2026 · **Stato:** palette proposta da validare, **non** implementazione/runtime completato.

## Decisione di prodotto

Quando si genera **una nuova mappa**, selezionare **in modo casuale** una delle cinque tonalità della pietra. La selezione è **persistente e stabile per quella mappa**; non deve cambiare a ogni reload o tra un frame e l'altro. Il giocatore può cambiarla successivamente da **Profilo → Ambiente**. Non è una nuova risorsa né una nuova classe strutturale.

La palette si applica solo ai componenti realmente minerali: edifici e murature in pietra (incluse torri, mura, porte, fondazioni, pavimentazioni), pendii scoscesi, montagne rocciose, coste, scogli e reef, scatter pietre/massi, cava di pietra e futuri elementi semanticamente etichettati come `stone`. **Non** tingere mattoni/argilla, cave di clay, legno, tetti, erba, acqua, neve, bandiere, ferro o ombre già applicate dall'illuminazione.

## Palette proposta (5 ruoli di luce)

I colori sono ramp **di revisione**, non una promessa di aggiornamento già operativo. La palette `gray` conserva i grigi caldi caratteristici delle murature correnti; il terreno e gli scatter ora usano ulteriori grigi da normalizzare **per classe semantica**, senza convertire tutti i pixel grigi.

| Famiglia | Luce | Sommità | Mezzotono | Ombra | Fessura |
|---|---|---|---|---|---|
| **Grigio attuale** | `#C2B6A8` | `#9A8E82` | `#82776C` | `#635951` | `#514A44` |
| **Arenaria** | `#DFC6A2` | `#C7AE88` | `#B59C79` | `#87705A` | `#574638` |
| **Tufo** | `#F1DFB0` | `#D8C47F` | `#BDA763` | `#877747` | `#5D5138` |
| **Calcare** | `#FAF8F1` | `#E8E6E0` | `#D6D2CA` | `#AFB0AC` | `#7B817F` |
| **Granito** | `#A1A5AA` | `#81868D` | `#646B73` | `#464C55` | `#2C333C` |

Per il **Clay esistente**, la palette visiva `CLAY_VISUAL_SWATCHES` in `src/settlement-core.js` include `#BE7254`, `#98523E` e `#763B30`; la cava d'argilla usa `#DC873B` / `#995025` in `src/settlement-industries.js`. **Arenaria** è deliberatamente più beige e desaturata del Clay, che resta terracotta rossastra.

La distanza tra il mezzotono proposto per l'arenaria `#B59C79` e la tinta di riferimento Clay `#BE7254` è circa **ΔE76 = 26** nello spazio CIELAB (D65). Questo dato aiuta a distinguere i due materiali, ma non sostituisce QA visiva nei renderer reali, in piena luce e nel buio.

## Griglia di approvazione

- [ ] Cinque palette distinguibili nello stesso scenario.
- [ ] Arenaria diversa dal Clay delle murature e dalla cava d'argilla.
- [ ] Ruoli luce/sommità/mezzotono/ombra/fessure coerenti e leggibili per tutti i materiali minerali.
- [ ] Ombre non tendono al nero su granito; calcare non perde rilievo su neve.
- [ ] Colori mantenuti durante giorno/notte, inverno/estate e con illuminazione di scena.
- [ ] Nessun legno, terracotta, tetto, vegetazione, acqua, neve o metallo ricolorati.
- [ ] Rendering Canvas, WebGL2/WebGPU (quando disponibile), LOD, cutaway, preview e Asset Lab da verificare.
- [ ] Nuova mappa: scelta random persistente; salvataggio locale/cloud; salvataggi legacy leggibili.

## Note d'implementazione (futura)

Un unico registro `stonePaletteId` per partita + ruoli cromatici semantici. No duplicazione di asset, mesh o 24 pose. Separare il **materiale costruttivo** (`stone` vs `brick`, che influenza risorse/HP) dalla **tinta della pietra** (`stonePaletteId`, soltanto estetica). Un cambiamento dal Profilo invalida le cache statiche interessate e aggiorna le palette dei materiali senza ricostruire la geometria né alterare produzione/costi. Per i modelli Blender e gli scatter, identificare prima gli indici delle parti litiche; non rimappare indiscriminatamente tutta la tavolozza, dato che include legno e metallo.

**Fonte di realtà:** `src/settlement-core.js` (palette Clay e materiali), `src/settlement-landscape.js` (scarpate e massi), `src/settlement-world3d.js` (montagne e mesh), `src/settlement-coast.js`, `src/settlement-scatter.js`, `src/settlement-industries3d.js`.

**Artefatto interattivo:** `stonecolor_palette_validation.html` consegnato nel dialogo di validazione, con anteprima schematica, confronto Clay, quattro condizioni ambientali, giudizi approvato/da rivedere ed esportazione JSON. **Non è una cattura in-engine né una prova di integrazione.**
