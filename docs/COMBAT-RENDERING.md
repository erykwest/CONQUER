# Combat — separazione fra regole e presentazione

Il residuo della branch combat è riconciliato sulla main corrente, senza ripristinare il vecchio runtime.

| Modulo | Responsabilità |
|---|---|
| settlement-combat-rules.js | Profili, attacchi, danni, morale, timer e code di effetti; nessun Canvas o renderer |
| settlement-combat.js | Stato, visibilità e LOS, selezione e ordini, percorsi, pattuglie, assalti e agganci alla simulazione |
| settlement-combat-render.js | Canvas tattico, bitmap di nebbia, maschere delle zone, figure e HUD, effetti di frecce/pietre/lampi |

ConquerCombatRenderer.create riceve gli accessi in lettura allo stato e callback di visibilità. Le maschere, la cache del fondale e le pose interpolate dei cavalieri appartengono al renderer; unità, ordini, HP e tempo simulato restano autoritativi nel combat. Le scene si disegnano tramite il precedente scheduler, senza un nuovo RAF.

ConquerCombatRules.visualEffects() espone una vista temporanea in sola lettura delle code. Il renderer la consuma e non modifica né fa avanzare le code. Il precedente drawEffects è stato rimosso dal modulo regole; la chiamata interna è ora nella presentazione. Entrypoint Builder e /camp caricano il renderer prima del combat.

I cavalieri restano figure 2D; il capitano è a piedi. Conservati pattuglie a due uomini, squadre a cinque, arcieri e fanteria individuali, campi e sentinelle, torce, drappi, lupi, sconfitte e cadute, occultamento, selezione multipla e assalti al mastio.

## Verifica del 03/11/2026 (incluso main con #138 cutaway per piani)

- 118/118 suite qa/*-regression.cjs, incluso il nuovo combat-render-regression.
- Cinque scenari confrontati con il codice precedente: comandi Canvas, figure e cavalleria identici (truppe miste, camp, zone/nebbia, ariete, effetti).
- Browser reale: Builder e /camp senza errori; nella fixture mista con arco e pietre, SHA-256 identico sui pixel RGBA del canvas tattico prima/dopo: 94370d1b44c218dc4fca4a56e241eaf0e3595ce301a773530bd567acc6343f51.
- Asset Lab: 312 voci, 784 render, zero controlli falliti e nessuna voce mancante. Restano 88 avvisi (schemi, cantieri e danno poco visibile), 103 render nuovi e 215 differenti rispetto alla baseline registrata: il refactor non modifica catalogo, modelli o asset e non aggiorna in massa la baseline per assorbire questi residui. La prova del renderer interessato è il confronto pixel/trace sopra.

Non viene introdotta una nuova meccanica o una promessa di incremento FPS. L'ulteriore separazione di UI/input dal domain è fuori da questo recupero; popolazione e figure erano già in moduli separati.
