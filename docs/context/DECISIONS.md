# Livello 3 — Decisioni, ipotesi e conflitti

> Data di **registrazione**: 2026-10-16. Le date originali di decisione non sono ricostruite dove non verificabili.
> Classi: **VINCOLO** (principio espresso), **DESIGN** (direzione esplicita ma non prova di codice), **CODICE** (contratto osservato), **PROPOSTA**, **APERTO** (conflitto/decisione necessaria).

## Registro delle decisioni

| ID | Classe | Decisione o regola da preservare | Conseguenza |
|---|---|---|---|
| D-001 | VINCOLO | Sviluppare prima interazioni solide e coerenti; grafica migliorabile in seguito. | La milestone si chiude con comportamento verificato, non con asset. |
| D-002 | DESIGN | Evitare proliferazione di risorse e catene: beni principali Cibo, Legno, Pietra, Metallo; Oro come valuta, Equipaggiamento come trasformato. | Quattro nodi produttivi principali e funzioni nelle strutture; **nota:** il ledger attuale contiene anche `luxury` — non eliminarlo senza decisione. |
| D-003 | CODICE/DESIGN | Economia civile aggregata per coorti L1–L4; figuranti visibili non diventano automaticamente agenti contabili autonomi. | Non duplicare produzione o salario per ogni figurante animato. Fonte: [economy.md](../economy.md). |
| D-004 | DESIGN | `tier` civile e `currentJob` distinti; fallback almeno L2→L1 quando un lavoro specializzato manca. Militari e cavalieri fuori dalla gerarchia civile. | Riassegnazione lavoratori e stagionalità coerenti. |
| D-005 | CODICE | Lavoro ordinario Mon–Ven; sabato mercato, domenica riposo nel ledger attuale. | Calendario unico anche per animazioni e attività, dopo riconciliazione. |
| D-006 | DESIGN | Economia territoriale: bioma e idoneità locale → poli produttivi → villaggi → capitale feudale → capitale regno. | Non introdurre meccaniche di tributo prima del surplus reale. |
| D-007 | DESIGN | Logistica locale ordinaria astratta attraverso connettività; **carovane fisiche** per tributi, tesori e rifornimenti strategici intercettabili. | Ridurre costi simulativi; una carovana deve avere vero carico e transizione World→Combat. |
| D-008 | DESIGN | Quattro poli: Farm Hub, Logging Camp, Cava, Miniera. Fabbro/mercato/servizi e Built Sections coprono funzioni accessorie. | Niente catalogo di 20 strutture intermedie. |
| D-009 | DESIGN | Araldica come **SVG rettangolare indipendente dal supporto**: `patternId+C1+C2+symbolId+C3+C4`; clipping nell'oggetto. | Un singolo editor Profile Panel propaga alle istanze condivise. |
| D-010 | DESIGN | Assedi con tempo continuo, attacco e blocco, consumo delle riserve, accessi multipli indipendenti, sortite, rinforzi e resa. | Bloccare davvero *tutti* gli accessi utili prima di affamare una fortezza. |
| D-011 | DESIGN | Mastio assegnabile a una torre esistente, unico per castello; difesa progressiva e ripiegamento di truppe/civili. | Ultimo obiettivo tattico, non un edificio duplicato. |
| D-012 | DESIGN | Funzioni del castello in Built Sections/tower slot: deposito, granaio, caserma, armeria, scuderie, comando ecc. | Capienza e vincoli di piano/accesso prima dei grandi assedi. |
| D-013 | DESIGN | Fortificazioni: palizzate, fossati, ponti, levatoi, basamenti; materiali/danni localizzati e incendi. Nessuna polvere da sparo. | La struttura è parte della navigazione e della guerra, non solo del renderer. |
| D-014 | DESIGN | Milizia temporanea: civili reclutabili passano da armeria a slot; altri civili si rifugiano; guarnigione regolare ha priorità. | Vincoli di percorso, armi, capienza e costo reale. Regole demografiche specifiche da rifinire. |
| D-015 | DESIGN | Audio contestuale: ambiente dinamico per stagione/meteo/giorno; edifici/unità attivati da selezione o zoom; crossfade e budget voci. | Assets locali sono sorgente, non contenuto automaticamente disponibile a Git. |
| D-016 | DESIGN | Distribuzione indie iniziale leggera, con possibili devlog, pagina gioco, follower, sostegno volontario. | Pubblicazione/Steam/cessione concept non sono decisioni di sprint. |
| D-017 | VINCOLO TECNICO | Simulazione e grafica il più possibile separate; evitare motori duplicati; seed e persistenza compatibili. | Audit moduli e test prima di un refactor ampio. |
| D-018 | VINCOLO OPERATIVO | Modifiche su branch da main, QA, PR e deploy Vercel automatico solo su main. | Fonte prescrittiva: [AGENTS.md](../../AGENTS.md). |

Le voci DESIGN sono decisioni di *indirizzo/progetto*, **non** affermazioni che il comportamento sia già implementato.

## Conflitti decisionali da risolvere esplicitamente

| ID | Tema | Fonti discordanti | Risoluzione richiesta |
|---|---|---|---|
| O-001 | Produzione miniera | `src/settlement-industries.js` usa `stone`; macroeconomia immagina `metal` | Decidere merce, possibile ruolo di cava/miniera, cambiare codice + test + ledger e registrare migrazione. |
| O-002 | Calendario agricolo | `src/settlement-fields.js` stagioni fisiche vs raccolto autunnale nel ledger | Un calendario fonte unica per campo, lavoratori, resa economica, UI e salvataggio. |
| O-003 | Risorse Builder | `State.resources` di test vs riserva/mercato `ConquerEconomy` | Definire source-of-truth e migrazioni; nessun doppio conteggio. |
| O-004 | Branch di sviluppo | /urban, sync/urban-main e main divergono | Identificare integrazioni complete e PR vive prima della prossima milestone; non scegliere per nome. |
| O-005 | Calendario mondo | Modello annuale a 12 mesi/365 giorni vs ipotesi mesi abbreviati da 6 giorni | Non modificare il tempo globale finché resa/stagioni/produzione non siano definite. |
| O-006 | Rendering e meccanica | Separazione a moduli esistente, ma rendering e stati condividono talvolta globali | Delimitare un contratto dati/test prima di un refactor di ampia scala. |
| O-007 | Perimetro MVP | Builder/Manager, combat, assedi, feudi e pubblicazione hanno ampiezza diversa | Confermare una vertical slice e relativo Definition of Done, non promettere tutto insieme. |

## Regola per le nuove decisioni

Aggiungere un ID, classe, data di registrazione, **motivazione**, alternative scartate, impatto su file/test, issue/PR/commit. Non sovrascrivere silenziosamente una decisione: segnarla **SUPERATA DA D-xxx**, mantenendo la traccia. Per le proposte usare «PROPOSTA» fino a conferma esplicita.
