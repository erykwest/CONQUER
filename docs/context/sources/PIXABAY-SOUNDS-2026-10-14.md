# Fonte importata — Valuta suoni Pixabay (14 ottobre 2026)

**Fonte:** export `ChatGPT-Valuta suoni Pixabay-20261016-1725.md` fornito il 16/10/2026 (17:25 Europe/Rome).  
**Conversazione originale:** https://chatgpt.com/g/g-p-6abe1f4b147c8191bd451ac3eacadc73-coffee-conquer/c/6acf68ee-d934-83eb-b739-3cd73b2f3820  
**Playlist di riferimento:** https://pixabay.com/playlists/conquer-34377593/  
**Cartella audio individuata nel thread:** [Sounds su Google Drive](https://drive.google.com/drive/folders/1QlAyXxEaGVdwxUVhA5ihDswg0B8N0PUv).  
**Limite della fonte:** il thread ha consultato **nomi e numero** dei file su Drive, non ha ascoltato o misurato gli audio né modificato il codice. I file originali **non sono allegati a questo digest**.

## Decisioni esplicite dell'utente

1. **Ambiente globale:** suoni climatici/stagionali come sottofondo, variabili con stagione, meteo e ciclo giorno/notte. Le variazioni climatiche possono sovrapporsi all'ambiente stagionale.
2. **Effetti locali:** suoni di edifici e unità **solo** se il soggetto è selezionato **oppure** quando lo zoom è sufficientemente vicino; soglia iniziale desiderata **30% di ingrandimento** (`zoom >= 30%`), non 30% di distanza della camera.
3. Il 14/10 l'utente ha comunicato di aver scaricato i file in locale e, successivamente, **caricati su Google Drive**. La cartella remota è la sorgente di riferimento: non presumere che le risorse siano già nel repository/deployment.

## Proposta di architettura audio discussa

- **Tre canali indipendenti:**
  - **Ambiente** — layer continui di vento, foresta, acqua e clima modulati da stagione/ora/meteo.
  - **Località e oggetti** — mercato, taverna, fabbro, mulino, campo, cava/miniera, animali, unità; volume spaziale e attivazione per selezione o vicinanza camera.
  - **Eventi** — campane, attacco, crollo, incendio, grida e altri one-shot emessi solo in risposta agli eventi veri del mondo simulato.
- **Mixing:** fade-in/fade-out tra layer e attraversamento della soglia; attenuazione per distanza; **budget delle sorgenti simultanee** e priorità per evitare che decine di unità sommino suoni identici.
- **Audio proceduralmente contestuale, non “una traccia per schermata”**: ad esempio mercato diurno più affollato del mercato notturno; assedio che sostituisce gradualmente la vita civile con combattimento/incendi.
- **Prestazioni:** mantenere distinto caricamento on demand/cache SFX dalla musica in streaming descritta in [VISUAL-AUDIO](VISUAL-AUDIO-2026-10-14.md). Le politiche di memoria erano una *direzione*, non un motore dimostrato dalla chat.

## Inventario storico del 14/10 (nomi letti, non file ascoltati)

Nella conversazione l'assistente riporta **24 MP3 su Drive**, raggruppati in **10 ambienti/natura** e **14 effetti/attività**. Questo è un risultato *storico del thread*, non un conteggio Drive rifatto il 16/10.

| Nome / gruppo riconosciuto | Uso proposto |
|---|---|
| Spring Forest; Nature Ambience | Ambiente primaverile e naturale |
| Cicadas | Estate e giorno |
| Wind Blowing | Vento, autunno/inverno |
| Rain Sound (`rain-sound-550289`, tre file) | Pioggia; verificare possibili duplicati |
| Thunder Sound | Temporali |
| Water Stream River | Vicino ad acqua/corsi d'acqua |
| Fire in the Night Forest | Fuochi e ambientazione notturna, secondo contesto |
| Market; Crowd Background | Mercati e popolazione |
| Tavern Ambience | Taverna |
| Church Bells; Church Choir | Campane ed eventi/edifici ecclesiastici |
| Chopping Logs | Taglialegna |
| Mining Group; Pickaxe Hit | Cava/miniera |
| Marching Loop | Truppe in movimento |
| Sword Against Sword; Sword Training | Battaglia/addestramento |
| Wolves Fighting; Screaming | Eventi animali/combattimento |
| Spin 300ms | Possibile feedback di interfaccia |

**Attenzione duplicati:** la fonte segnala tre file chiamati `rain-sound-550289`; **due hanno dimensioni identiche**, ma la duplicazione effettiva del contenuto non è stata dimostrata con hash/ascolto. Non cancellare automaticamente.

## Stato, aspetti legali e prossime verifiche

- **VERIFICATO NEL THREAD:** accesso a Drive e lettura dei nomi/24 file secondo il resoconto del 14/10; classificazione proposta. **NON VERIFICATO QUI:** presenza attuale, licenze file per file, durata, BPM/volume, qualità sonora, loop puliti, sincronizzazione, test browser, runtime audio o file nel Git.
- **Licenze:** il thread cita Pixabay come fonte con licenza che in genere consente l'incorporazione in un gioco commerciale, ma **questo import non è una verifica legale odierna**; conservare per ogni asset URL, autore, data download, licenza applicabile e trasformazioni. Evitare di esporre indiscriminatamente i file originali in un repository pubblico come contenuti indipendenti.
- **Gap sonori non bloccanti** individuati: costruzione/distruzione, cavalli, porte e interazioni; non trasformare l'elenco in nuovi P0.
- **Accettazione tecnica da definire:** manifest riferito ai file disponibili, mappatura eventi reali, soglia zoom/selezione testata, dissolvenze e limite voci, memoria/latency misurate, permessi/licenze degli asset, nessun audio automatico prima del gesto utente richiesto dal browser.

**Conclusione documentale:** la libreria audio **è stata repertoriata su Drive** nella conversazione; **il sistema audio non risulta implementato da quella sola fonte**. Non confondere con la produzione di musica Suno, documentata altrove.
