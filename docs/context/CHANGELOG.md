# Livello 5 — Diario delle variazioni del contesto

Il changelog descrive **modifiche della documentazione e della direzione**, non sostituisce la cronologia dei commit o le note di release del gioco.

## 2026-10-17 — Civil: skeleton degli edifici annessi

- Catalogo di 12 annessi con relazione strutturale `parentId`, collocabili dal pannello chiesa, taverna e mercato. L1–L3 sbloccano categorie, non creano automaticamente i figli.
- I figli di chiesa/taverna usano il lotto Voronoi del padre; le estensioni del mercato occupano spazio pubblico entro 9U e rispettano proprietà private e collisioni. Eliminazione padre→figli, blocco rotazione padre con figli, migrazione file salvati.
- Placeholder geometrici Canvas/WebGL2, hit test, navigazione e ombre; nessuna nuova simulazione economica o gestione ospiti. Regressione dedicata `qa/civic-annex-regression.cjs` nella CI `Civil` (prima esecuzione con test nuovi [39023575840](https://github.com/erykwest/CONQUER/actions/runs/39023575840) superata; verifiche successive da registrare).
- Solo branch `Civil`; QA browser/visiva non effettuata.

## 2026-10-17 — Civil: lotti di pertinenza e skeleton Piazza

- **Branch `Civil` da `main`**: riusati Voronoi, bordi e accessi esistenti per assegnare lotti di pertinenza a chiesa e locanda; il mercato ne rimane escluso.
- **Skeleton sviluppo L1–L3**: `civicLevel` per chiesa, locanda e mercato; aggiunta Piazza `plaza` 5×5 U con varianti `paved`, `fountain`, `garden` e tre livelli, con Builder, persistenza e mesh Canvas/WebGL2. Strade e pedoni possono attraversare la piazza.
- **Prove:** syntax check dei moduli modificati, verifica geometrica isolata su due lotti civici con impronte contenute; nuove regressioni Urban e Builder incluse nella CI `Civil skeleton regression` ([primo run verde](https://github.com/erykwest/CONQUER/actions/runs/39021863368)). I successivi push vengono verificati dallo stesso workflow; collaudo browser manuale ancora aperto.
- **Confine intenzionale**: nessun bonus economico/sociale, nessuna espansione funzionale delle routine; `main` non modificato.

## 2026-10-16 — Diagnosi condivisa /main e /camp: crescita bloccata dalla pianificazione arteriale

- Individuato su `main` il medesimo blocco di crescita già corretto su `camp`: la ricerca in background delle quattro strade perimetrali impediva lo spawn delle case, anche sulle arterie completate.
- Preparata [PR #52](https://github.com/erykwest/CONQUER/pull/52) su branch `fix/main-growth-during-road-planning-20261016` dal `main` `39caf15`: spawn sulle strade già pronte e impulsi di crescita non consumati in assenza di percorsi utilizzabili.
- Comandi militari `main`: messaggi espliciti per distanza cavaliere 16U, percorsi non traversabili e simulazione in pausa; non è stato rimosso il vincolo tattico.
- [CI 38948914788](https://github.com/erykwest/CONQUER/actions/runs/38948914788) **PASS**; verifica browser/partita persistita ancora aperta. `main` e produzione non modificati.

## 2026-10-16 — Correzione dei contratti di danno negli assedi

- Recepita una **correzione esplicita**: gli **attacchi ordinari delle unità** e le **frecce** non danneggiano mura o torri (**D-031**, S-05/S-16); eventuali danni strutturali richiedono una sorgente compatibile, non un attacco generico.
- Definita la **doppia durabilità** per gli accessi con torre-porta: un valore per la struttura della torre, un valore per il **portone** (**D-032**, S-25). Gli impatti contro un componente non riducono automaticamente l'altro; distruggere il portone non equivale a distruggere la torre.
- Precisati i requisiti degli **arieti** (S-22, bersaglio portone) e delle **fiaccole** (S-24, incendio sul componente), e aggiunti criteri di accettazione e QA a livello di specifica. Le regole di vulnerabilità delle singole tipologie di attacco al portone rimangono da dettagliare.
- **Solo documentazione:** nessuna modifica alla simulazione o al rendering, nessuna QA runtime eseguita; roadmap e stato di avanzamento delle milestone invariati.

## 2026-10-16 — Riconciliazione piramide con main e bilancio settimanale

- **Base verificata:** `main` al commit [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99) (16/10, 15:16 UTC); aggiornati ingresso, stato, roadmap, decisioni e backlog. Questa operazione è **solo documentale**: nessuna nuova QA runtime/browser eseguita.
- **Merger reali 13–16/10:** economico/industrie [PR #22](https://github.com/erykwest/CONQUER/pull/22); base fortificazioni/logistica e Mastio [PR #21](https://github.com/erykwest/CONQUER/pull/21); refactor castle/render/population/app [PR #38](https://github.com/erykwest/CONQUER/pull/38); foreste e attraversamenti [PR #39](https://github.com/erykwest/CONQUER/pull/39)/[PR #42](https://github.com/erykwest/CONQUER/pull/42); ambient light [PR #43](https://github.com/erykwest/CONQUER/pull/43); Nightlight [PR #47](https://github.com/erykwest/CONQUER/pull/47); minimappa e LOD **mergiati** [PR #44](https://github.com/erykwest/CONQUER/pull/44) al commit [2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9).
- **Renderer:** WebGL2 scena/castello [db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697), poi impostato come default con fallback Canvas [cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0). Non esiste prova qui di import glTF completo o parità visiva in tutte le funzioni.
- **Urban e rilievi:** lotti/tetti/facciate [d3ca98e](https://github.com/erykwest/CONQUER/commit/d3ca98e6dc1d75d651aade3af6bfffa1585e4e48), biomi [ee671e6](https://github.com/erykwest/CONQUER/commit/ee671e6f8af97a5dd3f55be72122a186ecb26ef9), continuità pedemontana e soglie neve/pini [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99). Materiali `urban` ancora da riconciliare separatamente.
- **Branch e backlog:** `main...urban` diverged **+97/-24**; `main...sync/urban-main-2026-10-16` **+78/-24**; [PR #19](https://github.com/erykwest/CONQUER/pull/19) ancora aperta. Priorità invariata: calendario campi ↔ ledger, unico inventario economico/costruttivo, output miniera e vertical slice di assedio prima di nuove grandi feature.
- **Correzione della documentazione storica:** i paragrafi sottostanti che dicevano «PR #44 aperta» descrivono uno snapshot precedente nella giornata del 16/10, **non** lo stato corrente.

## 2026-10-16 — Acquisizione suoni Pixabay / Drive

- Importata come quarto digest la conversazione del 14/10 [Valuta suoni Pixabay](sources/PIXABAY-SOUNDS-2026-10-14.md); registrata SRC-CHAT-006 in [EXTERNAL-SOURCES](EXTERNAL-SOURCES.md).
- Conservata decisione esplicita **ambienti stagionali/meteo + effetti selezione/zoom ≥30%**; chiarita la proposta di tre canali sonori, fades e numero massimo di fonti contemporanee.
- Inventario **storico riferito dal thread**, non audit corrente: **24 MP3 su Drive**, 10 ambienti e 14 effetti, con possibili nomi duplicati di pioggia. Qualità, loop, licenze individuali e runtime non verificati; **nessun audio importato in Git**.
- Roadmap, codice e deployment invariati.

## 2026-10-16 — Importazione trascrizioni e prove Git

- Letti gli export **ECONOMY (12–13/10)**, **Direzione animazioni/audio (14–15/10)** e **Minimappa LOD (15/10)**; creati tre digest in [sources](sources/) anziché pubblicare le chat integrali.
- Aggiornato [registro fonti](EXTERNAL-SOURCES.md): SRC-CHAT-001/002/005 **LETTO**, SRC-CHAT-003/004 **IN ATTESA DI TESTO**. Un allegato non pertinente è stato escluso.
- Verificato stato repository: economia presente su `main` con merge storico [2b8e8239](https://github.com/erykwest/CONQUER/commit/2b8e8239d2009fd813b92ff8f7e18e05bfb625b7); minimappa e LOD in **PR #44 ancora aperta**. Nessun runtime test eseguito per questo import.
- Consolidati i contratti: economia L4 aggregata; quote vendita e obiettivi scorte; orari annuali/mensili/settimanali; differenza fra **design miniera→metallo** e **codice main miniera→pietra** ancora aperta.
- Registrati stato cache Bitmap/WebGPU, asset PNG locali non verificati, opzione prototipo 3D vs sprite, animazioni procedurali e creazione musica Suno Pro (uso/licenze da controllare).
- Roadmap **invariata nel percorso principale M0–M3**; introdotta soltanto una traccia trasversale a basso rischio per leggibilità/benchmark, senza promettere conversioni 3D o audio già disponibili.

## 2026-10-16 — Inizializzazione piramide

- Creato punto d'ingresso a più livelli per vision, roadmap, stato, decisioni, backlog e protocollo.
- Recuperato il backlog P0–P3 Builder/Manager già su main, **senza ricopiarne tutte le checklist**.
- Integrati temi inter-sistemi discussi: economia feudale, carovane, combattimento, routine popolazione, difesa, assedi, ambientazione e pubblicazione.
- Registrati i conflitti da risolvere prima del prossimo ciclo: **miniera stone/metal, calendario agricolo, ledger vs risorse costruttive, branch main/urban divergenti**.
- Baseline documentale: `main` **9b7d05db597b592b78c9b4647181cb39f2cb2a9d**. Ricognizione statica: **non certifica l'esecuzione dei test**.

## Modello per le prossime righe

```md
## YYYY-MM-DD — [evento]
- Roadmap: Mx → My (motivo).
- Stato: ID, branch, commit e QA [PASS/FAIL/NON ESEGUITA].
- Decisioni: D-xxx / O-xxx risolto (link).
- Scope: aggiunte, rimozioni o rinvii con motivazione.
```

Non archiviare nuove idee indistintamente come «implementazioni»: mantenere separati backlog, decisioni e prove.

## 2026-10-16 — CAMP (branch `camp`, non integrato)

- **CODICE / BRANCH**: percorso isolato `/camp` con pulsante per ciascuna stanza caserma; gestione armigeri in squadre da cinque entro capacità stanza, salvataggio locale indipendente.
- **CODICE / BRANCH**: al tramonto squadre entro zona gialla richiamate lungo percorsi validi alla propria caserma, squadre fuori zona accampate sul posto (tenda e braciere per unità, un solo soldato di guardia visibile). All'alba ripristino delle squadre. Nessun cambio a `/urban`.
- **CODICE / BRANCH**: cutaway caserma sincronizzato con le truppe effettivamente rientrate, nessun soldato fittizio in stanza vuota.
- **VERIFICA DA ESEGUIRE**: test browser su percorso, UI mobile, ritorni ostacolati, campi in elevazione, salvataggi e rendering WebGL2/Canvas; le sorgenti da sole non dimostrano QA superata.
