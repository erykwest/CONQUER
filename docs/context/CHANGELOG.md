# Livello 5 — Diario delle variazioni del contesto

Il changelog descrive **modifiche della documentazione e della direzione**, non sostituisce la cronologia dei commit o le note di release del gioco.

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
