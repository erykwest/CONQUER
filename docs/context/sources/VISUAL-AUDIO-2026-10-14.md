# Fonte importata — Direzione animazioni, rendering e audio (14–15 ottobre 2026)

**Fonte testuale:** export `ChatGPT-Direzione animazioni audio-20261016-1605.md` allegato il 16/10/2026. Conversazione originale: https://chatgpt.com/share/6ad22d36-e3f0-83ed-b261-b206e685f66b  
**Stato:** decisioni/priorità discusse e analisi repo storica; non equivalgono a nuove implementazioni apportate con questo import.

## Direzione grafica concordata

- **Rappresentare stati reali, non simulare per fare animazioni:** il lavoro in campo, l'estrazione, gli attacchi, le ferite e i trasporti devono generare segnali visivi coerenti.
- **Animazioni procedurali** di animali, carri e combattimenti già descritte nella branch `animation`: parti articolate, `Path2D` riutilizzabili, ruote mosse dalla distanza percorsa, stati di attacco/ferita/morte temporanei; mantenere procedurale finché un benchmark non giustifica la conversione.
- **Popolani ispirati a RimWorld:** mani stilizzate, utensili SVG solo quando si lavora (zappa, ascia, piccone), piccoli cicli gestuali legati a `currentJob`; cappelli di paglia estivi, mantelli/cappe/pellicce invernali come varianti leggere. Niente guardaroba individuale e niente dettagli inutili a zoom lontano.
- **Araldica:** un solo pattern SVG/palette condiviso, cache raster e clipping su scudi, uniformi, bandiere e stendardi. Non generare una texture diversa per ogni soldato o edificio; verificare i supporti realmente collegati.

## Prerendering, cache e opzione 3D

- **Evitare varianti combinatorie di giunzioni.** Separare modellazione delle singole torri/porte/mura dalla composizione runtime. Le **24 rotazioni a 15°** della pipeline SVG/prerender non richiedono automaticamente una raccolta distinta per ogni collegamento.
- La fonte riporta una **libreria locale riferita da Claude, NON su GitHub**: 294 famiglie, 14.112 PNG e circa 627 MB dichiarati. La stessa comunicazione elenca 538 MB colori + 119 MB profondità (=657 MB); **misure discordanti, non verificate qui**. Non presentare quei file come disponibili al deployment o al repository.
- Il codice verificato in `main` il 16/10: [settlement-assets.js](../../../src/settlement-assets.js) ha cache LRU bitmap per le strutture (`STRUCTURE_ASSET_CACHE_LIMIT=192` voci), cache compositi con limite nominale 32 MiB e telemetria di hit/miss/eviction. **Il limite di 32 MiB non equivale a un tetto totale garantito di tutta la RAM/GPU.**
- [settlement-webgpu.js](../../../src/settlement-webgpu.js) è soprattutto **un compositore WebGPU di layer Canvas statici**, non un motore general-purpose per import di modelli `glTF/GLB`. Fallback Canvas2D da preservare.
- **Scelta progettuale esplorativa, non migrazione approvata:** confrontare (A) sprite compatti, potenzialmente WebP, caricati on demand, con (B) prototipo modello 3D geometrico. Un test minimo: torre + due mura + giunzioni + cutaway + quattro stati di costruzione + fasi di danno, con confronto frame time, RAM/GPU, byte trasferiti, compatibilità e fallback.
- Il 3D avrebbe valore anche per **cutaway, progressione dei cantieri e danno strutturale** se modelli semanticamente scomposti (fondazioni, livelli, copertura, parti danneggiabili). Z-buffer da solo *non* crea automaticamente questi sistemi. Conservare i master e la soluzione sprite fino al confronto.
- Le branch `feature/mine-isometric-master-review`, `art/mine-entrance-master-20261013` e `animation` sono **linee separate** da `main`; controllare differenze prima del merge. Parte dell'export Blender locale potrebbe mancare dal repository.

## Gestione asset richiesta/proposta

- **Audio musica:** streaming/caricamento su domanda; traccia corrente + prossima precaria 15–30 s prima, crossfade e rilascio precedente.
- **Ambiente e SFX:** suoni relativi alla scena e piccoli SFX in cache limitata, con eliminazione LRU. 20 MB citati come *esempio*, **non limite di prodotto approvato**.
- **Grafica:** asset critici residenti; cache LRU delle varianti visibili e angoli vicini; precaricamento attorno alla camera; breve margine temporale prima di espellere; cache HTTP distinta da bitmap decodificate e texture GPU.
- **Non avviare un secondo Asset Manager** senza prima misurare ed estendere quello esistente. Separare peso repository, download, RAM CPU, VRAM e costo per frame.

## Musica — nuova informazione di prodotto

- L'utente ha dichiarato di aver **sottoscritto Suno Pro il 15/10/2026** per comporre colonna sonora originale. La possibilità di uso commerciale dipende dai termini applicabili e dalla data di creazione/esportazione: conservare prova di account, licenza e tracce; **non equiparare licenza d'uso a copyright garantito**.
- Identità musicale sperimentata: temi stagionali (primavera/estate/autunno/inverno) di atmosfera medievale, poi canto femminile rituale celtico/slavo, infine folk celtico con cornamuse predominanti. **Questi sono orientamenti/esperimenti di creazione**, non tutti contenuti pubblicati o una scelta artistica definitiva.
- Per futuri prompt Suno di CONQUER: **`Style Prompt` separato da `Lyrics Prompt`; entrambi descrittivi**, `Lyrics` descrive struttura/vocalità e *non inventa versi o sillabe*. `Style` **<1000 caratteri**, preferibilmente 500–800.
- Musica di background per lunghe sessioni, non continuamente enfatica; tracce contestuali stagioni/giorno-notte/tensione/assedio. Si è parlato di crossfade stagionale ~15–20 s, **da validare** nell'integrazione.

## Come verificare il prossimo passo

**Vertical slice visiva proposta:** scena con castello, popolani al lavoro, animali, carri, truppe/araldica, tutti coerenti con le regole di gioco; misurare tempo frame e memoria su scena densa. Tenere le priorità visuali parallele ma subordinate alla stabilità meccanica. Non confondere «discusso» con «testato in browser».
