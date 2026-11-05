# CONQUER CODEX — catalogo normalizzato v1

Implementato su `feature/codex-normalized-catalog`, base `main` `9a4310d5aa1010fda64fbc6ca8822d1ad2510363` (05/11/2026). Incorpora anche l'audit della PR #159, ancora non integrata al momento di avvio. Nessun merge automatico in main.

## Confine

`src/codex-catalog.js` è il contratto portabile, senza DOM né dipendenze dalla partita. `src/settlement-codex.js` è l'adapter di sola lettura sui registri del gioco. Entrambi sono caricati in `index.html`; nessun nuovo pannello Wiki in questa fase.

Il catalogo normalizza 136 record: 40 edifici/opere/definizioni economiche, 16 sub-building, 36 opzioni/upgrade, 20 stanze, 11 profili/coorti, 8 macchine e 5 navi. Questi conteggi non rappresentano 136 oggetti costruibili: ogni record dichiara categoria, stato e natura. Livelli, dimensioni e combinazioni restano proprietà, senza generare un prodotto cartesiano di varianti.

## Contratto dei record

- `id`: namespace semantico stabile, per esempio `building:clay-quarry`, `sub-building:church.cemetery`, `room:kitchen`, `ship:cocca`. Non usa label, indice, asset ID o ID di istanza salvata. Le chiavi di registro originarie sono preservate in `key` e `source`.
- `category`: building, sub-building, upgrade, room, unit, siege-engine, ship.
- `status`: present, partial, planned. Esprime copertura della definizione, non certificazione di ogni comportamento. Non si inventano elementi planned per riempire categorie.
- `properties`: dati strutturati letti dai proprietari, inclusi tier, ingombri, opzioni, statistiche o natura del record. I tempi di animazione delle macchine sono nominati `animationCycleSeconds`, non tempi di costruzione.
- `relations`: archi tipizzati e risolvibili (belongs-to, applies-to, uses, built-at, candidate-host, variant-of, resides-in, related). Un host candidato non garantisce disponibilità per ogni piano.
- `assets`: riferimenti a registry/collection/key esistenti, dove il collegamento è accertato. Nessun placeholder inventato per le voci prive di modello diretto.
- `requirements`: physical, functional, knowledge separati. I riferimenti ai provider fisici non sono copie dei predicati di piazzamento. Un array vuoto significa che l'adapter non ha ancora una descrizione strutturata, non che il requisito sia assente. Knowledge resta `{status:'unmapped',ids:[]}`: nessun vincolo tecnologico aggiunto.
- `providers`: nomi delle sorgenti di costo, tempo e compatibilità; nessun comando di acquisto è richiamato dal Codex.

Gli oggetti restituiti sono copie profondamente congelate. Il catalogo non assegna stanze, non spende risorse, non modifica salvataggi e non memorizza uno stock alternativo.

## API

```js
const codex = window.ConquerGameCodex;
codex.list();
codex.list({category: 'ship'});
codex.get('ship:cocca');
codex.quote('ship:cocca');
codex.quote('building:wall', {
  structure: {type: 'wall', length: 5, level: 2}
});
codex.compatible('room:kitchen', {structure, slot: 0});
codex.compatible('ship:cocca', {structure: shipyard});

const snapshot = codex.snapshot(); // JSON serializzabile, schemaVersion: 1
const publicCodex = ConquerCodex.fromSnapshot(
  JSON.parse(JSON.stringify(snapshot))
);
```

`list` e `get` restituiscono metadati. `quote` restituisce separatamente cost e time con status/value: known, context-required, unmapped, incompatible, not-found. `compatible` usa lo stesso involucro con valore booleano quando noto. Un ID sconosciuto restituisce null in get e not-found nelle valutazioni.

I preventivi strutturali richiedono il descrittore effettivo del Builder; passare solo il tipo non produce un preventivo universale. Sono richiamate `constructionCost` e `buildDuration`, incluse le deleghe a industria, eventi e porto e la sostituzione pietra→argilla per i mattoni. Non viene mai chiamato `spendCost`. Costi vuoti/fallback di annessi e costruzioni spontanee non diventano prezzi definitivi zero. I giorni nominali non sono il tempo residuo di cantiere né secondi reali.

Navi e alcuni accessori hanno prezzi direttamente disponibili nei registri proprietari. Costi di reclutamento, costruzione delle macchine e installazione delle varianti non formalizzati restano unmapped. Le coorti civili non diventano unità reclutabili.

Per le stanze viene invocato `ConquerSiege.allowed` sul descrittore copiato. Per le navi `ConquerShipyard.is/canBuild`. Per le varianti `variantSchema` può escludere una configurazione; l'appartenenza allo schema non basta per garantirne l'installabilità, quindi negli altri casi la compatibilità rimane unmapped. Le restrizioni non portate nell'adapter non vengono aggirate o riscritte.

## Condivisione web / gioco

Le definizioni vengono rilette a ogni richiesta: modificare un prezzo o una proprietà nel registro del gioco modifica il risultato del Codex. Non esiste una tabella prezzi mantenuta a mano per la Wiki.

Lo snapshot contiene record e preventivi valutabili senza contesto. Un consumatore pubblico può caricare soltanto `codex-catalog.js` e lo snapshot, con lo stesso contratto di lettura. Lo snapshot è una fotografia: va rigenerato dai provider durante la futura pubblicazione; non si aggiorna da solo dopo l'export. Le quote parametriche restano context-required offline e i predicati dinamici non vengono serializzati come funzioni. Nessuno snapshot fisso viene committato come secondo catalogo da mantenere.

La UI Wiki, ricerca, filtri, link dal Builder, esportazione automatica del sito e distinzione conosciuto/disponibile/sbloccato appartengono alla fase 3. La mappatura tecnologica appartiene alla fase 4.

## Verifiche

`node qa/codex-catalog-regression.cjs`: sorgenti gameplay reali in VM, sette categorie, ID unici, relazioni senza riferimenti mancanti, asset risolvibili, confronto preventivi/tempi con Builder (anche mattoni e cava argilla), prezzi aggiornati al mutare dei provider, compatibilità stanza/cantiere, isolamento delle copie, Stato invariato e round-trip JSON su un consumatore senza runtime. La suite è aggiunta al workflow Runtime integrity.

Eseguite anche regressioni Builder menu, economia/Builder, save-safety e i cinque test runtime-integrity. Controllo browser locale su index con fixture Asset Lab/Canvas: caricamento API, metadati, preventivi e round-trip del catalogo. Nessun nuovo asset o renderer: audit visivo asset non necessario. Un 404 favicon è preesistente e non coinvolge il Codex.

## Limiti residui

L'inventario segue i registri effettivi della base, non certifica tutte le intenzioni nei backlog. Professioni e incarichi individuali richiedono ulteriori adapter; le quattro coorti e i profili combattimento sono già distinti. Il vigneto è esplicitamente una definizione economica parziale. Gli annessi restano parziali, senza inventare servizi o prezzi. Le regole latrina della PR #155 non vengono anticipate.

Verifica aggiuntiva: `qa/refactor-app-population-regression.cjs` FALLISCE sul conteggio del siege hook `rubbleBlocks`, sia sul branch sia su checkout pulito della base `9a4310d` (stesso errore 1 !== 2). Difetto preesistente, sorgenti popolazione e relativa suite non modificati dal Codex. `qa/refactor-module-boundaries-regression.cjs` e `qa/context-guard-regression.cjs` PASS.
