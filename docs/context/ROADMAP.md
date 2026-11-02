# Livello 1 — Roadmap sistemica

## Estensione strategica — MARCH (decisione 30/10/2026)

- **Modalità Attacco approvata**, distinta dalla gestione diretta del feudo ma nello stesso mondo persistente finale. Skeleton isolato su feature/march-skeleton con route /march/: marcia, razzia parziale, ritiro, segnaposto di assedio/assalto e conquista facoltativa. **Non è l'integrazione World/Feudal**.
- **Prossima integrazione, dopo i fondamenti condivisi:** ID e stato unici per compagnie e feudi; transazione di bottino/danni sul ledger e strutture reali; eventi di esito da Combat/Siege; ritiro e annessione volontaria; save/load unico. Milestone/ordine M0–M5 esistente invariati.
- Limiti e criterio V1: [docs/march.md](../march.md).


## Priorità correnti — audit live 30/10/2026

> `main` **`cf569992`**, [audit completo](AUDIT-2026-10-30.md). L'ordine M0–M5 è una cornice per **residui**, non per ricreare interi sottosistemi già mergiati. I paragrafi precedenti al 30/10 sotto restano snapshot **storici**.

| Priorità | Residuo effettivo | Accettazione necessaria |
|---|---|---|
| **P0 CI** | [#109](https://github.com/erykwest/CONQUER/pull/109): verifiche economia delle tappe 2–5 | Riallineare workflow/contesto a main, conflitti risolti, CI verde (permessi merge workflow da trattare separatamente) |
| **P1 economia** | Miniera `stone→metal`, officina Built Section→equipment, input botteghe L3, raccolti e magazzino assedio | Un solo addebito/ricavo reale, stock separati rappresentati coerentemente, save/load; **L1 cantieri già chiuso in #98** |
| **P1 village** | [#111](https://github.com/erykwest/CONQUER/pull/111): pozzi secondari/centro designabile | QA World 3D e multi-centro; mantenere primo pozzo come fondatore unico |
| **P2 campi** | [#110](https://github.com/erykwest/CONQUER/pull/110): livree e accampamento fortificabile | Verificare piazzamento del Builder, collisioni dopo resize e bivacco in partita reale; **non** confonderlo con assedio strategico |
| **P2 assedio** | Blocco accessi→fame→resa e persistenza | Riusa #61 danni, #104 legno, portoni, incendi e presidi. **`No automatic surrender in P0` ancora nel codice** |

**Nuovo baseline:** 15 core Builder e 8 parziali su 23 ID ([owner](../feature-backlog.md)); [#98](https://github.com/erykwest/CONQUER/pull/98) L1 veri, [#99](https://github.com/erykwest/CONQUER/pull/99) routine, [#101](https://github.com/erykwest/CONQUER/pull/101) commercio e botteghe L3, [#105](https://github.com/erykwest/CONQUER/pull/105) unico sistema convogli, [#108](https://github.com/erykwest/CONQUER/pull/108) carri/carrozzieri 2D e [#103](https://github.com/erykwest/CONQUER/pull/103) centro di controllo **sono già su main**. Congelare duplicati `jobmanager`, vecchio `autonomous-urban-economy` e vecchie PR squash come nuovi lavori. Feudi, world map e navigazione rimangono orizzonte futuro.


> Triage delle **presenze nel codice** rinnovato al **22/10/2026** su `main` [c52b537](https://github.com/erykwest/CONQUER/commit/c52b537eac5f2a212841d45b75cc85b0136e069e), con [audit completo](AUDIT-2026-10-22.md). Ordine sistemico proposto, **non** certificazione browser/QA; la tabella del 21/10 sottostante conserva il proprio contesto storico.
> Il backlog dettagliato P0–P3 del Builder è [docs/feature-backlog.md](../feature-backlog.md).

## Aggiornamento verificato — 23/10/2026 (snapshot storico, superato dal 30/10)

Nuova HEAD `main` [518e830](https://github.com/erykwest/CONQUER/commit/518e830547b66c12deefa0833487ea76b81c7746) dopo merge [#76](https://github.com/erykwest/CONQUER/pull/76), [#79](https://github.com/erykwest/CONQUER/pull/79), [#80](https://github.com/erykwest/CONQUER/pull/80), [#81](https://github.com/erykwest/CONQUER/pull/81). Vedi [audit completo 23/10](AUDIT-2026-10-23.md).

**La sequenza M0–M5 non cambia:** i merge riguardano nuovi componenti e interazioni reali del **portone** e il **catalogo/controllo visivo degli asset**, non la chiusura del ledger o dell'assedio continuo. Portoni e Asset Lab non vanno risviluppati. Prima di promuovere altre PR, verificare i conflitti tra #61 (danni) e #76 (grata), e tra #77 (montaggio visivo) e #82 (audit delle fasi).

**Ciclo principale:** M0 unico stock/ledger e produzione → M1 costruttori L1 realmente necessari → M2 capienze/presidi → M3 difesa con blocco/fame/resa. **Parallelo opzionale e delimitato:** #82 come QA per verificare regressioni grafiche (portoni danneggiati e cantieri a 25/50/75%) e #77 soltanto dopo integrazione sicura. #78 eventi e #72 convogli non accelerano M0–M3.

## Riesame delle priorità — 22/10/2026 (snapshot storico; i riferimenti a #55/#61 sono superati)

**Nessun riavvio dei sottosistemi già presenti.** I 13 nuclei Builder già su main e numerosi moduli difensivi/ambientali si considerano **BASELINE DELIVERED**, non nuove attività di sviluppo. L'effort futuro è dedicato a comportamento mancante, dati incoerenti e prova di funzionamento.

| Ordine | Residuo verificato | Obiettivo d'accettazione | Note |
|---|---|---|---|
| **M0 / prima** | Unificare risorse Builder, economy ledger e scorte assedio; calendario e raccolti | Ogni risorsa/coltura viene prodotta, consumata e conservata una sola volta | Primo passo prima di nuove catene produttive |
| **M1 / poi** | Cantieri bloccati senza L1 disponibili (#55 draft), costi reali, completamento con lavoro | Un edificio non si completa senza manodopera e materiali; save/load coerente | Animazioni (#71) **già su main** ≠ lavoro effettivo |
| **M1** | Scegliere output `mine` e collegare `workshop`/stanza a `equipment` | Miniera, bottega e stock condividono la stessa contabilità | La miniera attualmente produce `stone` |
| **M2 / M3** | Allineare #61, stock/capienze/accessi e chiudere blocco/fame/resa | Un assedio di una porta determina un esito ripetibile e persistito | Danni, incendi, macchine e terrapieni **già presenti** |
| **Parallelo limitato** | Bonus taverna/tempio; QA Canvas/WebGL2 e visual QA #18 | Bonus civico misurabile e nessun peggioramento di rendering | No nuove varianti scatter/asset |

Le milestone **M4 feudi/tributi/carovane**, commercio avanzato, regioni e navigazione restano a lungo termine, senza precedere un assedio giocabile.

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

| ID | Milestone | Esito osservabile richiesto | Dipende da | Stato al 21/10 |
|---|---|---|---|---|
| M0 | **Coerenza dei contratti** | Un solo calendario produttivo, regole terreno/accessibilità, QA su salvataggio e seed | base attuale | **IN CORSO**: ciclo solare #54, terreno/terraforming #63–69 e refactor su main; ledger/campi/risorse ancora da unificare |
| M1 | **Economia locale affidabile** | Popolazione L1–L4, 4 poli, raccolti, stock, mercato e lavoratori coerenti e persistenti | M0 | **PARZIALE SU MAIN**: economia base #22 e animazioni lavoratori #71; cantieri L1 e inventari reali sono su #55 **OPEN**, agricoltura/ledger non chiusi |
| M2 | **Castello strategico** | Built Sections e slot con capienze; guarnigione, armeria, materiali, percorsi e accessi collegati | M1 | **PARZIALE SU MAIN**: Mastio, presidio, #53 pattuglie/camp, #54 visione solare, fortificazioni; capienze/ledger/difesa end-to-end da provare |
| M3 | **Difesa e assedio** | Materiali/danni, palizzate/fossati/ponti/levatoi, IA d'assalto, incendio, Mastio, blocco e resa | M2 | **PROTOTIPI SU MAIN**: #73 terrapieni d'assalto e danni base; assedio completo, blocco, fame e resa non dimostrati |
| M4 | **Sistema feudale** | Feudi specializzati, tributi e carovane fisiche intercettabili, combattimento collegato | M1 + Combat stabile | **VISIONE + BRANCH**: convogli #55 e diplomazia #72 ancora OPEN (quest'ultima su `knights`), niente world trade su main |
| M5 | **Prodotto distribuibile** | QA e UX ripetibili, documentazione, profilo audio/visivo, build accessibile, feedback esterno | M0–M3 (ambito MVP da decidere) | **DIREZIONE** |

**Nota:** milestone e stato sopra sintetizzano la maturità sistemica; non sono certificazioni di test eseguiti. L'ordine M3/M4 potrà essere ricalibrato, ma *non* spostare a monte i convogli senza inventari e combattimento affidabili.

## Prossimo passo verificato al 21/10 (snapshot storico)

1. **Integrare senza perdere il codice recente:** riconciliare con `main` [#55](https://github.com/erykwest/CONQUER/pull/55) (cantieri L1/ledger/convogli), [#61](https://github.com/erykwest/CONQUER/pull/61) (danni), [#65](https://github.com/erykwest/CONQUER/pull/65) (cutaway) e, separatamente, [#72](https://github.com/erykwest/CONQUER/pull/72) (base `knights`). QA e merge solo dopo confronto delle branche.
2. **M0–M1 — Una sola economia reale:** chiudere `State.resources` vs ledger, miniera pietra/metallo, calendario campi/resa; completare il ciclo dei lavoratori e dei cantieri *meccanicamente*, non solo con animazioni già su main.
3. **M2–M3 — Test verticale difesa:** scorte reali, presidio/capienze, accessi, danni e terrapieni #73, poi blocco/fame/resa. Non assumere che il sistema assedi sia completo.
4. **Benchmark e QA:** verificare picchi WebGL, parity Canvas e visual QA ancora aperta #18. Misurare le animazioni #71 sotto carico, non riscriverle.
5. **M4 soltanto dopo contratti stabili:** carovane/tributi con carico e trasferimento realmente conservati, non promuovere skeleton #55/#72 a world gameplay.

## Traccia trasversale — leggibilità e prestazioni (senza cambiare la priorità di M0–M3)

Le conversazioni [VISUAL/AUDIO](sources/VISUAL-AUDIO-2026-10-14.md) e [MINIMAP](sources/MINIMAP-2026-10-15.md) aggiungono un'opportunità **parallela e vincolata**: verificare che economia e combattimento già simulati siano leggibili con animali, cittadini, carri, araldica, minimappa e audio, senza duplicare la simulazione.

1. **Consolidare ciò che è già integrato:** la **PR #44 è su `main` dal 16/10**; completare QA reale su minimappa/LOD (ISO/plan, rotazioni, fog, mobile, prestazioni) invece di ripetere l'integrazione.
2. **Misurare prima di sostituire:** confrontare renderer WebGL2 predefinito, Canvas fallback e cache (frame time, RAM/VRAM, asset bytes) in scenari ripetibili. Un nuovo renderer 3D è **già su `main`** dal 15/10, non un desiderata.
3. **Completare l'esperimento architetturale:** renderer WebGL2 di scena/castello e fallback Canvas già implementati ([db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697), [cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0)); testare parità funzionale di cutaway, cantiere e danni prima di scegliere tra questa soluzione e prerender ibridi.
4. **Animazioni lavoro già integrate:** [#71](https://github.com/erykwest/CONQUER/pull/71) porta sette attrezzi e cantieri su main; misurare resa e performance e tenere gli accessori stagionali fra le proposte non implementate.
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
