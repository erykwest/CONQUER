# Assedio per settori — verifica 6 novembre 2026

Codice verificato: `combat-ai`, `a3ebb866d581ead8285af3609c84c2c03df056b9`. Nessun merge o deploy su main.

## Modifiche e prove

Port selettivo dell'integrazione circle/Siege (scorte, conquista, riconquista e persistenza), registrazione delle brecce e invalidazione dalla navigazione. Gli assalitori riprendono la campagna dopo ariete, scala o torre; i difensori si sganciano e scendono dalle mura per ripiegare. Nessuna modifica alla scala D-056 o agli HP delle strutture.

PASS locale: 67 test circle (7 file), 9 controlli campagna, 9 controlli ingaggio e suite selection, mass battle, patrol, siege damage, siege assault e siege engines. CI [CIRCLE regression 42200441339](https://github.com/erykwest/CONQUER/actions/runs/42200441339) PASS sul commit codice.

## Browser: TEST con variante concentrica

Chrome headless, WebGL, loop reale del gioco, seme casuale fissato a 12345. Villaggio TEST conservato; il suo castello è sostituito **solo in memoria** con due cinte chiuse (profondità 1 e 2), porte inizialmente chiuse e mastio nella cinta interna. `layouts/TEST.json` non viene modificato. Il piano arma gli arieti da solo.

| Misura | Inizio | Dopo 60 s simulati |
|---|---:|---:|
| Assalitori vivi | 43 | 43 |
| HP assalitori | 350 | 330 |
| Difensori vivi | 5 | 4 |
| HP difensori | 58 | 46 |
| Porta esterna | integra, chiusa | sfondata |
| Porta interna | integra, chiusa | integra |
| Settori conquistati | 0 | 0 |

Il settore esterno è **conteso**: 18 ostili e 1 difensore a terra. Il settore del mastio è **in allerta**, sicuro e senza ostili, con 1 difensore a terra. Una presenza ostile non viene dichiarata conquista. La ritirata completa dei superstiti non è certificata da questo scenario: le regressioni isolate ne verificano separatamente il percorso e la chiusura della porta.

Zero errori JavaScript registrati. Durata reale 405,8 s; tick mediano 1,8 ms, p95 4738,4 ms, massimo 10669,1 ms. Questi picchi rendono necessaria una profilazione prima di dichiarare la simulazione fluida. Non confrontare direttamente questi tempi con il TEST originale: geometria, presidi e compiti sono diversi.

Il run è partito su `aff223d` con il codice ancora non committato; quel codice è poi confluito in `a3ebb86`. Durante il run non sono stati modificati i sorgenti runtime. Il JSON conserva anche `head` e `dirty` originali per non attribuire una falsa provenienza pulita.

[Misure strutturate](combat-ai-circle-2026-11-06.json). Artefatti locali: `output/playwright/siege-scenario/combat-ai-concentric-final-60s.json` e `combat-ai-concentric-final-60s-webgl.png`.

## Controllo sul TEST originale

La cinta del layout originale non risulta chiusa al raster circle: zero compartimenti prima e dopo. Con ariete e torre assegnati dal runner, dopo 60,4 s: assalitori 43 → 37 vivi, difensori 5 → 3, porta sfondata, zero errori JavaScript e zero conquiste. Picco iniziale 102,4 s. Non è una prova di avanzata per settori. Il contatore HP iniziale dei difensori in questo primo run era ancora sulla scala legacy e non viene usato per calcolare danni.

## Riproduzione e limiti

Con Node, Playwright e Chrome disponibili: eseguire `node qa/siege-scenario-performance.cjs <etichetta>`, impostando `SIEGE_SECONDS=60`, `SIEGE_CONCENTRIC=1` e `PERF_MODES=webgl`. Senza `SIEGE_CONCENTRIC=1` si usa il layout originale. Ogni run usa un contesto browser isolato e non modifica il salvataggio personale.

Il piano piazza autonomamente l'ariete; scale e torri mobili devono essere assegnate prima e la loro prosecuzione verso il mastio è coperta dalle regressioni. Restano la profilazione dei picchi e la riconciliazione generale con main. Roadmap e decisioni restano invariate: sono correzioni del comportamento già concordato.
