# Refactor trasversale ECC — 24 novembre 2026

Implementato su `refactor/extended-ecc-20261124`; integrazione in main subordinata alla PR e alla CI. Base iniziale `6af5ee65`, aggiornata prima della pubblicazione. Skill applicate: ECC change-impact, module-regression, security-review e verification-loop. Due revisioni indipendenti hanno controllato sicurezza dei salvataggi e contratti tra moduli.

## Cambiamenti

- **Salvataggi:** `ConquerSaveSnapshot` possiede il formato locale e l'adattamento della riga cloud. Una cattura JSON immutabile serve entrambi. Ripristino di risorse, stagione, villaggio, paesaggio e riconciliazione riusa funzioni comuni, conservando il diverso ordine storico delle migrazioni locali/cloud. Nessuna migrazione SQL o cambio di chiave/schema.
- **Cloud:** lettura iniziale riuscita necessaria per scrivere; richieste seriali, fotografie catturate al click e verifiche su account, client, generazione di lettura e identità del mondo. Una risposta vecchia non cancella modifiche successive. Errori SDK e rigetti di rete mantengono il salvataggio recuperabile. Le quote locali non vengono indicate come successo. Lab, demo e CAMP mantengono i loro confini.
- **Builder:** `ConquerBuilderCommands` possiede comandi e preset, `ConquerBuilderControls` collega i controlli esistenti; il catalogo puro `ui/builder-catalog.js` descrive UI2. UI2 invoca dati di comando senza cercare pulsanti nel DOM. Conservati icone, opere campali, limiti delle porte e cava argilla di main. Il materiale della tettoia è ora un preset effettivamente applicato.
- **Percorsi:** `ConquerPath` condivide misurazione, campionamento e inversione. Carri, corrieri e segnaletica conservano le rispettive scelte di orientamento e tolleranza ai segmenti minimi. Nessun nuovo planner o cache basata su array mutabili.
- **Modelli/facciate:** espansione degli indici condivisa in `ConquerMesh3D.modelParts`, cache debole per identità di record immutabile; rimossi tre algoritmi duplicati. Dimensionamento gotico consolidato nel suo owner e rimosso il painter Canvas senza chiamanti. Registri, geometrie e materiali degli asset conservati.
- **Verifica:** contratto eseguibile di presenza e ordine degli script nei due entry point; runner deterministico portabile che scopre tutte le suite, prosegue dopo errori e produce JSON. La CI usa lo stesso runner. L'audit visivo completo resta suddiviso nei quattro job esistenti.

## Evidenze

I comandi e i consumer sono in [REGRESSION.md](REGRESSION.md). I risultati conclusivi vengono registrati prima della consegna; un controllo in corso non equivale a PASS.

- Test salvataggi e risorse: 25 casi PASS, inclusi upload concorrenti, aggiornamenti durante l'attesa, errori restituiti/sollevati, cambi di partita/account, letture obsolete, formato persistito, migrazioni e quota locale. Nessun account o database reale usato.
- Geometria: riconciliazione byte per byte su 77 modelli, 265 parti e 227.073 vertici PASS; caratterizzazione dei percorsi rispetto agli algoritmi precedenti PASS.
- Browser Builder: in verifica su legacy, UI2 e CAMP con click sulla rail UI2 e assenza dei selettori legacy durante il comando.
- Suite deterministica completa, sintassi, audit Lab e CI remota: in verifica; consultare la PR e il rapporto finale.

## Confini

Il lavoro riduce duplicazioni e accoppiamento nei sottosistemi condivisi; non riscrive ogni file del gioco. Simulazione, economia, combattimento, migrazioni delle singole strutture e gestione di input restano nei loro owner. Non introduce dipendenze npm, framework, nuove regole economiche o un nuovo schema cloud. Il contratto dei modelli richiede record immutabili: sostituire il record quando cambia la geometria.

ROADMAP invariata: obiettivi di prodotto invariati. DECISIONS aggiornata per i nuovi contratti interni. La precedente PR #285 è stata incorporata in main durante il lavoro; la PR #287 resta una fonte storica di parte dell'estrazione architetturale, aggiornata qui alle feature correnti. Nessun merge o deploy implicito.
