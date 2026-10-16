# Livello 5 — Diario delle variazioni del contesto

Il changelog descrive **modifiche della documentazione e della direzione**, non sostituisce la cronologia dei commit o le note di release del gioco.

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
