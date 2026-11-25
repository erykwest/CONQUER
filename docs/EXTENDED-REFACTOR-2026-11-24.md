# Refactor trasversale ECC — 24 novembre 2026

Implementato su `refactor/extended-ecc-20261124`; integrazione in main subordinata alla PR e alla CI. Base iniziale `6af5ee65`, aggiornata a main `d886d3bc`. PR [#304](https://github.com/erykwest/CONQUER/pull/304). Skill applicate: ECC change-impact, module-regression, security-review e verification-loop. Due revisioni indipendenti hanno controllato sicurezza dei salvataggi e contratti tra moduli.

## Cambiamenti

- **Salvataggi:** `ConquerSaveSnapshot` possiede il formato locale e l'adattamento della riga cloud. Una cattura JSON immutabile serve entrambi. Ripristino di risorse, stagione, villaggio, paesaggio e riconciliazione riusa funzioni comuni, conservando il diverso ordine storico delle migrazioni locali/cloud. Nessuna migrazione SQL o cambio di chiave/schema.
- **Cloud:** lettura iniziale riuscita necessaria per scrivere; richieste seriali, fotografie catturate al click e verifiche su account, client, generazione di lettura e identità del mondo. Una risposta vecchia non cancella modifiche successive. Errori SDK e rigetti di rete mantengono il salvataggio recuperabile. Le quote locali non vengono indicate come successo. Lab, demo e CAMP mantengono i loro confini.
- **Builder:** `ConquerBuilderCommands` possiede comandi e preset, `ConquerBuilderControls` collega i controlli esistenti; il catalogo puro `ui/builder-catalog.js` descrive UI2. UI2 invoca dati di comando senza cercare pulsanti nel DOM. Conservati icone, opere campali, limiti delle porte e cava argilla di main. Il materiale della tettoia è ora un preset effettivamente applicato.
- **Percorsi:** `ConquerPath` condivide misurazione, campionamento e inversione. Carri, corrieri e segnaletica conservano le rispettive scelte di orientamento e tolleranza ai segmenti minimi. Nessun nuovo planner o cache basata su array mutabili.
- **Modelli/facciate:** espansione degli indici condivisa in `ConquerMesh3D.modelParts`, cache debole per identità di record immutabile; rimossi tre algoritmi duplicati. Dimensionamento gotico consolidato nel suo owner e rimosso il painter Canvas senza chiamanti. Registri, geometrie e materiali degli asset conservati.
- **Verifica:** contratto eseguibile di presenza e ordine degli script nei due entry point; runner deterministico portabile che scopre tutte le suite, prosegue dopo errori e produce JSON. La CI usa lo stesso runner. L'audit visivo completo resta suddiviso nei quattro job esistenti.

## Evidenze

I comandi e i consumer sono in [REGRESSION.md](REGRESSION.md). I risultati conclusivi vengono registrati prima della consegna; un controllo in corso non equivale a PASS.

- Test Node: 41 casi PASS, inclusi upload concorrenti, aggiornamenti durante l'attesa, errori restituiti/sollevati, cambi di partita/account, letture obsolete, formato persistito, migrazioni e quota locale. Nessun account o database reale usato.
- Geometria: riconciliazione byte per byte su 77 modelli, 265 parti e 227.073 vertici PASS; caratterizzazione dei percorsi rispetto agli algoritmi precedenti PASS.
- Browser Builder PASS su legacy, UI2 e CAMP: preset, limiti delle porte, cava argilla, opere campali, materiale tettoia, click sulla rail UI2, indicatore salvataggi e comandi senza selettori legacy. Nessun errore di pagina; provini controllati.
- Sintassi PASS su tutti i 197 file runtime JS/MJS in src e api. Build, TypeScript e lint non configurati: progetto statico, verifica tramite parser, VM e browser.
- La prima CI completa ha eseguito tutte le 237 suite: 235 PASS, due controlli sulla posizione precedente del codice falliti. Aggiornati Stonecolor con il round trip effettivo delle cinque palette e routing con il restore reale di entrambi i trasporti: entrambi PASS. Il risultato integrale sullo SHA finale è nella PR e nell'artifact `deterministic-regressions`.
- Primo giro locale: 231/237, prima di completare quattro adattamenti delle vecchie asserzioni. Un test di reattività ha superato il suo limite sotto carico locale (stesso test PASS in CI, soglia invariata); un test generativo ha superato il limite per caso inizialmente aggiunto dal runner. Il runner conserva ora il solo limite del job CI precedente, senza nuova scadenza locale. I log originali e dei rerun rimangono separati in `output/qa/`.
- Confronto visivo controllato contro main `d886d3bc` sulla stessa macchina: 22 render delle due varianti di porta segnalate dalla baseline, zero differenze di firma, copertura, proporzioni o dimensioni. Fogli provini rivisti. Le 77 espansioni mesh restano identiche byte per byte.
- Audit completo del Lab PASS nei quattro shard CI sul runtime `c9cdc31d`: 1.768 render di 687 asset, zero errori e nessuna voce mancante; 32 avvisi non bloccanti. Rispetto alla baseline storica: 116 nuovi render e 6 cambiati. La baseline storica di main non contiene ancora alcune aggiunte già presenti, incluse le icone Builder: nuovi/cambiati rispetto a quella baseline non equivalgono a differenze introdotte qui. Questo refactor non aggiunge asset e conserva la baseline; esito e provini dello SHA finale sono negli artifact della PR.

## Confini

Il lavoro riduce duplicazioni e accoppiamento nei sottosistemi condivisi; non riscrive ogni file del gioco. Simulazione, economia, combattimento, migrazioni delle singole strutture e gestione di input restano nei loro owner. Non introduce dipendenze npm, framework, nuove regole economiche o un nuovo schema cloud. Il contratto dei modelli richiede record immutabili: sostituire il record quando cambia la geometria.

ROADMAP invariata: obiettivi di prodotto invariati. DECISIONS aggiornata per i nuovi contratti interni. La precedente PR #285 è stata incorporata in main durante il lavoro; la PR #287 resta una fonte storica di parte dell'estrazione architetturale, aggiornata qui alle feature correnti. Nessun merge o deploy implicito.

## Armonizzazione delle PR 287 e 304 (25 novembre)

La PR #304 è la proposta canonica; la #287 conserva la provenienza storica ed è superata dopo la verifica del consolidamento. Nessuna delle due è descritta come già merge. Base aggiornata a main `f5ec5c41`; history pubblicata conservata con merge del main, senza riscrivere gli SHA revisionati.

| Modifica della #287 | Owner nella #304 | Esito del confronto |
|---|---|---|
| Comandi e preset Builder | builder-commands / builder-controls | Stesse scelte; aggiunti leanMaterial e opere campali. 94/85 era selezioni ripetute contro comandi distinti. |
| Catalogo UI2 | ui/builder-catalog | Estratto dalla shell, con frameTower3 di main; addossato nel solo ispettore muro, API legacy conservata. |
| Espansione indicizzata | ConquerMesh3D.modelParts e tre consumer | Preservata; nuovi renderer di main mantenuti. |
| Facciate | settlement-architecture | Regola unica; painter inattivo ancora rimosso. |
| QA e pipeline | suite generale, Panels, Builder, Asset Lab | Recuperato il gate specialistico Builder, preservati icone/browser e quattro shard attuali. |
| Rapporto e ADR | ARCHITECTURE-REVIEW-2026-11-19, D-ARCH-261119 | Snapshot marcato storico; alias verso D-ECC-REFACTOR-261124. |

Le CI verdi del 24 novembre non certificano questa nuova base: test mirati e CI dello SHA consolidato sono riportati nella PR #304. Nessun cambiamento alla roadmap, nessuna migrazione o deploy introdotto dall'armonizzazione.

Allineamento alla regola di main per gli addossati: la scelta autonoma è rimossa dal catalogo UI2; il comando dell'ispettore del muro `setWallLeanTo` costruisce l'annesso con il materiale scelto. Le chiamate dati legacy e i loro preset restano compatibili. La regressione browser verifica anche il click «Mattoni» nell'ispettore del muro. Il catalogo consolidato esercita 82 scelte distinte, oltre alle chiamate legacy: il confronto numerico con 94/85 senza considerare conteggio e ritiro dell'opzione non è una perdita di copertura.

Prove locali del consolidamento: 41 test Node PASS, 29 regressioni mirate PASS, sintassi di 199 file runtime PASS; browser classico/UI2/CAMP PASS anche su frameTower3 H3 e aggiunta in mattoni dall'ispettore del muro. Le stringhe delle note locale/cloud sono ricondotte alla codifica UTF-8 corretta. Main include anche la palette GRAFICA (#309), conservata senza alterare il suo owner. La verifica completa CI e i provini del Lab sullo SHA pubblicato si leggono nella PR #304.

Aggiornamento successivo di main (#310): conservati icone beige e selettore muratura a icone. I riferimenti HTML di cache dei file non modificati dal refactor seguono esattamente main, evitando conflitti su aggiornamenti indipendenti; i moduli del refactor mantengono la propria invalidazione. Renderer e registri modelli invariati rispetto al consolidamento `3ab0ff71`.

La verifica browser delle icone è aggiornata alla palette di #310: fondo marrone, filtro beige e tinta scura sull'elemento attivo; selettore pietra/argilla con sole icone, nomi accessibili e cambio materiale effettivo. PASS anche identità dei pulsanti, caricamento SVG, catalogo Lab e viewport mobile. I tre modi Builder sono rieseguiti dopo la riconciliazione dei riferimenti HTML, senza errori di pagina.
