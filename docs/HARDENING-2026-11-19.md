# Hardening CONQUER — 19 novembre 2026

Base ispezionata: `origin/main` `168b993b`. Correzioni sul branch `fix/main-hardening-20261119`; il documento non attesta un merge o un deployment. Metodo: checklist ECC security-review applicata al codice effettivamente presente, con priorità a persistenza, input renderizzati e confini cloud.

## Problemi corretti

| Problema riproducibile | Effetto | Correzione |
|---|---|---|
| `loadCloud()` termina su errore della query mentre `saveCloud()` può fare upsert con una sessione presente | Il contenuto locale può sostituire un cloud mai letto, anche durante la query iniziale | Stato di lettura cloud: solo una lettura riuscita, compreso lo slot vuoto, abilita le scritture. Errori restituiti, rejection e migrazioni fallite bloccano l'upsert; una nuova lettura riuscita lo riabilita |
| `saveCloud()` ignora il risultato di `saveLocal()` nel percorso locale/CAMP | Storage pieno o negato viene mostrato come salvataggio riuscito e perde il flag dirty | Stato di successo e dirty aggiornati soltanto con scrittura locale riuscita. Gli errori cloud lanciati sono catturati e restituiscono false |
| `renderUI()` interpola le chiavi di `State.resources` in `innerHTML` | Un nome risorsa contenente markup, conservato dal caricamento, viene interpretato come HTML nella UI legacy | Barra costruita con `createElement`, `textContent`, fragment e `replaceChildren`; preservate anche chiavi sconosciute. I valori sono testo |

Asset Lab escluso esplicitamente dal percorso di salvataggio cloud anche in presenza di una sessione.

## Verifiche

- `node --test tests/hardening.test.mjs tests/runtime-integrity.test.mjs`: 16 test, inclusi attesa della query, errore SDK/rete, retry, migrazione fallita, quota locale/CAMP, errori upsert, Lab e payload HTML.
- Suite PASS: save-safety, calendar-speed, ambient-light, panels, refactor-module-boundaries, ci-p0, ci-p1, codex-catalog, codex-wiki, codex-obsidian, codex-vault-import, construction-priority, construction-materials, upgrades-dev, context-guard.
- Controllo sintattico di tutti i file JS/MJS sotto src e JS sotto api; controlli di freschezza dei due export Codex; `git diff --check`.
- Workflow Runtime integrity esteso ai nuovi test e al file calendario/UI nei filtri push.

Test eseguiti in Node con SDK e DOM simulati: non certificano l'accesso a un database reale, una sessione autenticata in browser o tutte le pagine dell'app.

## Superfici esaminate e limiti

- API versionata: `api/telemetry.js` restituisce 404/no-store senza leggere il payload; coperta dalla regressione esistente.
- `supabase/schema.sql`: RLS abilitata, accesso anon revocato e policy authenticated per proprietario su select/insert/update/delete, inclusa la verifica del proprietario risultante negli update. Schema letto, nessuna verifica o modifica del database live.
- Wiki: rendering testo con escape e link con ID codificati; rilevamento parent cross-origin protetto. Nessuna modifica alla Wiki.
- Workflow: ricognizione trigger/permessi; nessun `pull_request_target` individuato. Non è una verifica completa della supply chain delle Actions.
- Scansione limitata dei file testuali versionati per intestazioni di chiavi private e token GitHub/Stripe/OpenAI riconoscibili. Non equivale a scansione della cronologia, revoca credenziali o certificazione di assenza di segreti.
- Nessun package manifest npm alla radice: `npm audit` non applicabile. Import CDN di Supabase e polygon-clipping fissati a versioni esplicite in index.html; nessun audit completo delle dipendenze transitive CDN.
- CSP completa, header HTTP effettivi, protezioni branch e infrastruttura restano fuori dalla verifica. Una CSP richiede prova browser degli script inline, import CDN e iframe del Codex prima dell'attivazione.

Le scelte di DOM e autorizzazione sono coerenti con [MDN textContent](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent) e [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Nessun cambiamento di roadmap o contratto di gameplay.
