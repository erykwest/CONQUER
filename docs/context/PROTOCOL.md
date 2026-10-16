# Livello 5 — Protocollo di continuità e manutenzione

> Scopo: impedire che la roadmap venga ricostruita a memoria, che una chat inventi progressi o che branch parallele cambino silenziosamente le decisioni.

## Bootstrap obbligatorio per nuove sessioni

1. Aprire questo repository e determinare **default branch, HEAD SHA, branch attiva e PR aperte**.
2. Leggere nell'ordine [README](README.md) → [VISION](VISION.md) → [ROADMAP](ROADMAP.md) → [STATUS](STATUS.md) → [DECISIONS](DECISIONS.md). Scendere in [BACKLOG](BACKLOG.md) e nei documenti del singolo dominio solo per la feature da trattare.
3. Cercare nel codice e nelle QA: **cosa esiste già**? su quale branch? con quale prova? Controllare i diff di branch concorrenti prima di proporre il lavoro.
4. Esprimere il piano come «già nel codice», «da verificare», «da implementare», «bloccato da decisione». Non utilizzare «fatto» senza commit e test.
5. Implementare sulla branch appropriata secondo [AGENTS.md](../../AGENTS.md). Tenere update documentale nella stessa PR.
6. A fine intervento scrivere un handoff breve: HEAD/PR, file toccati, test eseguiti ed esito, cosa manca, prossima azione.

## Gerarchia delle fonti in caso di conflitto

1. **Osservazione ripetibile** su commit identificato + test + comportamento verificato.
2. **Codice corrente** della branch pertinente e suoi contratti.
3. **Decisioni approvate** in questo registro e scelte esplicite dell'utente (non cancellate dalla documentazione tecnica).
4. **Documentazione tematica** e QA precedenti, indicando versioni.
5. **Conversazioni, backlog e idee**: fonti di intenti, non prove di realizzazione.

**Nota cruciale:** una decisione progettuale può richiedere di *cambiare* il codice attuale; «il codice fa X» non trasforma X automaticamente in scelta progettuale definitiva. Conflitti in [DECISIONS.md](DECISIONS.md).

## Ritmo di aggiornamento

| Quando | Aggiornamento minimo |
|---|---|
| Dopo una nuova **idea** | [BACKLOG.md](BACKLOG.md) come proposta con dipendenza, niente chiusura. |
| Dopo una **decisione** | [DECISIONS.md](DECISIONS.md): ID, ragione, alternative, effetti sui contratti; [ROADMAP.md](ROADMAP.md) solo se cambia ordine. |
| Durante implementazione | File/QA pertinenti; descrizione PR con stato e test, non anticipare «FATTO». |
| Dopo una **PR integrata** | [STATUS.md](STATUS.md): evidenza commit + test, [ROADMAP.md](ROADMAP.md) milestone se necessario, [CHANGELOG.md](CHANGELOG.md) sintesi. |
| Dopo un **refactor o sincronizzazione branch** | Aggiornare mappa branch e contratti in [STATUS.md](STATUS.md) evitando link obsoleti. |
| Revisione periodica | Controllare idea→work-in-progress→chiuso, risultati, dipendenze, scope creep. Non cambiare la visione per inseguire dettagli estetici. |

## Definition of Done contestuale

Per ogni feature «chiusa» nel registro:
- [ ] Branch/commit/PR identificati.
- [ ] Funzione e criteri di accettazione dimostrati sul branch target.
- [ ] QA pertinenti **eseguite** con esito riportato; fallback esplicito se test browser non possibile.
- [ ] Salvataggio/migrazione, seed, pathfinding, compatibilità e performance considerati quando coinvolti.
- [ ] Nessuna duplicazione di sistema (ledger, renderer, pathfinding, farming...).
- [ ] Roadmap/status/decisioni aggiornati nella stessa PR, oppure dichiarato perché invariati.
- [ ] La PR è davvero integrata prima di segnare la feature come disponibile su main.

## Formato handoff consigliato

```text
CONQUER HANDOFF — YYYY-MM-DD
Base e HEAD: branch / SHA
Milestone attiva: Mx
Completato [provato]: ID → commit/PR, file, test PASS
In corso: ID → stato reale e ostacolo
Decisioni aperte: O-xxx
Prossima singola azione: ...
Rischi / regressioni / branch divergenti: ...
```

## Regole del lavoro Git

- `main` è il riferimento per funzionalità integrate; una feature branch non è produzione.
- Nessun merge cieco di `urban`, `combat`, `assedio` o branch di sincronizzazione: controllare diff e priorità.
- [AGENTS.md](../../AGENTS.md) disciplina feature branch, CI, PR e deploy `main`-only. La piramide è **contesto di prodotto**, non sostituisce tali istruzioni.
- **Non incollare patch al committente** se il connettore Git è disponibile: eseguire direttamente i commit sul repository.
- Un update solo documentale non dichiara passate QA del runtime; se un test non è stato eseguito scrivere «non eseguito».

## Prompt breve per futura ripartenza

> In CONQUER usa GitHub come fonte di verità. Apri `docs/context/README.md` e scendi nella piramide; controlla HEAD/PR e i sorgenti prima di rispondere. Lavora sul backlog e sulle decisioni esistenti, separa design da implementato e aggiorna la piramide nella PR. Riassumi alla fine avanzamento, test e prossima azione.
