# Assedio concentrico — prova di 5 minuti, 6 novembre 2026

**Esito funzionale: FALLITA.** Completati 300,2 s simulati nel browser, con sei screenshot in gioco (inizio e ogni minuto). La durata estesa evidenzia blocchi di avanzamento e ritirata che le regressioni isolate non rilevano.

## Scenario e provenienza

Chrome headless, WebGL, villaggio TEST e due cinte create solo in memoria, 43 assalitori e 5 difensori mobili, porte inizialmente chiuse, mastio nella cinta interna. Il castello originale e il salvataggio personale restano intatti. Corrette nella fixture le partenze del capitano (prima dentro l'impronta del mastio) e di una pattuglia (prima sul muro); il controllo automatico segnala **zero partenze bloccate**. Le postazioni di tiro implicite delle porte restano attive, aggiuntive rispetto ai 5 difensori mobili.

Codice del combattimento invariato rispetto ad `a3ebb86`. Runner con checkpoint/screenshot e controllo delle partenze in `245e85f`. Il run era partito su `0feccec` con modifiche locali del solo runner, poi confluite in quel commit: i metadati grezzi `head`/`dirty` sono conservati. Il primo tentativo con le partenze scorrette è stato interrotto e non fa parte di questo risultato né del pacchetto.

## Perdite e avanzamento

| Tempo simulato | Assalitori vivi | Difensori mobili vivi | HP assalitori | HP difensori |
|---|---:|---:|---:|---:|
| 0 min | 43 | 5 | 350 | 58 |
| 1 min | 42 | 4 | 332 | 44 |
| 2 min | 37 | 2 | 289 | 20 |
| 3 min | 33 | 2 | 268 | 20 |
| 4 min | 30 | 2 | 244 | 20 |
| 5 min | 26 | 2 | 221 | 20 |

Caduti finali: **17 assalitori e 3 difensori**. **Zero settori conquistati**; nessun evento di cattura registrato. La porta esterna è sfondata e aperta; quella interna è integra e aperta. Il mastio resta senza occupanti.

Al minuto 1 il settore esterno è conteso (20 ostili/2 difensori) e quello interno ha 2 difensori. Dai 2 ai 5 minuti il raster non conta ostili nei settori, benché gli screenshot e le coordinate mostrino uomini ammassati nei varchi: lo stato `alert` non dimostra che il combattimento sia risolto.

## Problemi riprodotti

- **Avanzata bloccata:** tra i checkpoint 120→180, 180→240 e 240→300 s tutti gli assalitori sopravvissuti conservano la posizione entro 0,01 U, senza tappe di movimento attive. Nessuno raggiunge l'obiettivo (`atKeep=0`). Le perdite proseguono mentre sono fermi.
- **Ritirata incompleta:** le due pattuglie superstiti restano a (88,110) e (112,110), con `retreatTo=circle-2` e zero tappe attive, dai 60 ai 300 s. La porta interna rimane aperta.
- **Prestazioni:** 4532,3 s reali (75 min 32 s) per 300,2 s simulati. Tick mediano 2533,9 ms, p95 8686,2 ms, massimo 21341,6 ms. Acquisizioni eseguite in pausa e poi simulazione ripresa; tempi specifici di questa macchina e di questo scenario.

Zero eccezioni JavaScript registrate. La CI tecnica [42242394771](https://github.com/erykwest/CONQUER/actions/runs/42242394771) passa su `d169a62` (sintassi del runner e regressioni circle/combat); la prova integrata lunga ha invece esito funzionale negativo. Prossimo intervento: riprodurre in regressione i percorsi dal varco e dalle posizioni laterali, correggere avanzata/ritirata e profilare le ricerche fallite. Nessuna correzione al combattimento è stata applicata durante questa prova.

## Artefatti e riproduzione

[Misure strutturate](combat-ai-circle-300s-2026-11-06.json). Screenshot PNG originali 1440×900, galleria HTML, checkpoint completi e report grezzo nella directory locale `output/playwright/siege-scenario/`. Pacchetto locale `CONQUER-assedio-5min.zip` con le sei immagini della prova valida.

Esecuzione: `node qa/siege-scenario-performance.cjs combat-ai-concentric-300s-valid`, con `SIEGE_SECONDS=300`, `SIEGE_CONCENTRIC=1`, `SIEGE_SCREENSHOT_INTERVAL=60`, `PERF_MODES=webgl`. Le catture avvengono al primo tick che raggiunge il checkpoint (scarto massimo osservato 0,24 s); i tempi effettivi sono nei JSON. Il loop reale e la generazione ambientale rendono variabile il risultato anche a seme casuale fissato.
