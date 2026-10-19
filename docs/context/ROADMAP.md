# Livello 1 — Roadmap sistemica

> Aggiornata al **2026-10-16**. È l'ordine **proposto per dipendenze e valore sistemico**, non una promessa di date o un inventario di feature assenti.
> Il backlog dettagliato P0–P3 del Builder è [docs/feature-backlog.md](../feature-backlog.md).

## Catena fondamentale

```text
Terreno / foreste / accessibilità
             │
Pozzo + case L1-L4 + popolazione + calendario
             │
 Campi + 4 poli produttivi + ledger unico
             │
 Magazzini / Built Sections / risorse reali
             │
Mura e accessi funzionanti + presidio + danni
             │
   Assedio, blocco, sortite e Mastio
             │
Economia feudale → tributi → carovane strategiche
```

La rappresentazione grafica, i suoni e il polish **attraversano** queste fasi, ma non possono sostituirne i criteri di completamento.

## Milestone non datate

| ID | Milestone | Esito osservabile richiesto | Dipende da | Stato al 16/10 |
|---|---|---|---|---|
| M0 | **Coerenza dei contratti** | Un solo calendario produttivo, regole terreno/accessibilità, QA su salvataggio e seed | base attuale | **IN CORSO**: calendario a 48 s/giorno e refactor fusi, ma ledger/campi/risorse ancora da unificare |
| M1 | **Economia locale affidabile** | Popolazione L1–L4, 4 poli, raccolti, stock, mercato e lavoratori coerenti e persistenti | M0 | **PARZIALE SU MAIN**: motore/industrie nella PR #22, integrazione con costruzioni e agricoltura non chiusa |
| M2 | **Castello strategico** | Built Sections e slot con capienze; guarnigione, armeria, materiali, percorsi e accessi collegati | M1 | **CODICE PARZIALE SU MAIN**: Mastio, logistica P0, presidio, fossati/ponti/levatoi con PR #21; manca validazione capienze/ledger/difesa end-to-end |
| M3 | **Difesa e assedio** | Materiali/danni, palizzate/fossati/ponti/levatoi, IA d'assalto, incendio, Mastio, blocco e resa | M2 | **BASE PARZIALE**: fortificazioni e logistica iniziale integrate; assedio completo, blocco e resa non dimostrati |
| M4 | **Sistema feudale** | Feudi specializzati, tributi e carovane fisiche intercettabili, combattimento collegato | M1 + Combat stabile | **VISIONE/BACKLOG** |
| M5 | **Prodotto distribuibile** | QA e UX ripetibili, documentazione, profilo audio/visivo, build accessibile, feedback esterno | M0–M3 (ambito MVP da decidere) | **DIREZIONE** |

**Nota:** milestone e stato sopra sintetizzano la maturità sistemica; non sono certificazioni di test eseguiti. L'ordine M3/M4 potrà essere ricalibrato, ma *non* spostare a monte i convogli senza inventari e combattimento affidabili.

## Prossimo passo

**Priorità aggiornata il 19/10/2026 (M1):** consumi e produzione misurati per bene → saldi e trend → integrazione dei costi reali di costruzione/fortificazioni → condizioni economiche di investimento L4 → attività private e auto-upgrade abitativi. Il nucleo dei saldi settimanali è nella branch `feature/economic-balances-20261019`, con [QA Node superata](https://github.com/erykwest/CONQUER/actions/runs/39253184968); non è ancora verificato nel browser. Senza stock unico Builder/economia e margine operativo non deve partire nessuna costruzione automatica.


1. **Riconciliare main / urban e lavori aperti:** scegliere l'esatta base tecnica prima di nuove feature; leggere [STATUS.md](STATUS.md) e PR attive. Non assumere che il codice di /urban sia già su main.
2. **Chiudere i conflitti bloccanti:** miniera `stone` vs `metal`; calendario dei campi (visuale vs ledger); inventario economico vs risorse di costruzione di test.
3. **Verificare P0 Builder senza riscrivere sistemi esistenti:** terreno, foreste, popolazione e idoneità dei quattro poli. Usare `docs/feature-backlog.md` con criteri di accettazione e QA.
4. **Integrazione unificata:** capacità delle Built Sections e rifornimenti che influenzano realmente produzione, guarnigione e difesa.
5. **Prototipo assedio verticale minimo:** un castello, uno o più accessi, risorse, una guarnigione, ariete/scale e condizione di resa verificabili.

## Traccia trasversale — leggibilità e prestazioni (senza cambiare la priorità di M0–M3)

Le conversazioni [VISUAL/AUDIO](sources/VISUAL-AUDIO-2026-10-14.md) e [MINIMAP](sources/MINIMAP-2026-10-15.md) aggiungono un'opportunità **parallela e vincolata**: verificare che economia e combattimento già simulati siano leggibili con animali, cittadini, carri, araldica, minimappa e audio, senza duplicare la simulazione.

1. **Consolidare ciò che è già integrato:** la **PR #44 è su `main` dal 16/10**; completare QA reale su minimappa/LOD (ISO/plan, rotazioni, fog, mobile, prestazioni) invece di ripetere l'integrazione.
2. **Misurare prima di sostituire:** confrontare renderer WebGL2 predefinito, Canvas fallback e cache (frame time, RAM/VRAM, asset bytes) in scenari ripetibili. Un nuovo renderer 3D è **già su `main`** dal 15/10, non un desiderata.
3. **Completare l'esperimento architetturale:** renderer WebGL2 di scena/castello e fallback Canvas già implementati ([db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697), [cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0)); testare parità funzionale di cutaway, cantiere e danni prima di scegliere tra questa soluzione e prerender ibridi.
4. **Animazioni lavoro minimali:** strumenti/manine e varianti stagionali guidati dagli stati reali; non introdurre nuove meccaniche per giustificarle.
5. **Audio graduale:** SFX contestuali/streaming e brani Suno solo con inventario tracce/licenze controllato, non come blocco di M1.

Questa traccia **non sostituisce** la milestone M1 dell'economia. Dall'export [ECONOMY](sources/ECONOMY-2026-10-12.md) emerge inoltre che il motore economico è già passato tramite PR #22 su `main`: il lavoro prioritario è **integrarlo e verificarlo**, non riscriverlo.

## Dipendenze dei sottosistemi

- **Campi:** geometria Voronoi → lavoro fisico → calendario coerente → produzione economica una sola volta → Farm Hub.
- **Estrattivo:** suolo idoneo + worker tier → output → stock/reserve → workshop / mantenimento castello.
- **Economia civile:** tier e professione vs `currentJob` → assegnazioni → produzione/consumo → mercato.
- **Logistica militare:** capienza, consumo e accessi → presidio → forza d'assedio / rifornimento → accerchiamento e resa.
- **Fortificazioni:** terreno e collisioni → attraversamenti/fossati → ponte levatoio → IA d'assalto.
- **Feudi:** bioma/cap di produzione → nuclei produttivi → hub feudale → quota tributaria → carovane → World→Combat.
- **Araldica:** pattern SVG rettangolare → clipping dei supporti → propagazione Profile Panel.
- **Asset/atmosfera:** pipeline visiva e suono contestuale → test framerate e assenza di regressioni; da schedulare senza bloccare M0.

## Regola anti-deriva

Ogni nuova idea viene messa in [BACKLOG.md](BACKLOG.md) con livello «IDEA» e dipendenza, non aggiunta automaticamente al lavoro attivo. Per promuoverla: descrivere quale problema già osservato risolve, criterio di accettazione, regressione e milestone impattata. Il numero di feature «IN CORSO» va mantenuto piccolo.

Aggiornare sempre insieme [STATUS.md](STATUS.md), [DECISIONS.md](DECISIONS.md) e [CHANGELOG.md](CHANGELOG.md) quando cambia la sequenza.
