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
| D-019 | DESIGN ESPLICITO (ECONOMY 12/10) | Proprietà produttive *lord* o settore privato **L4 aggregato**; il singolo figurante non ha capitale/contabilità propria. | Case/attività fisiche, bilanci per coorte. [Fonte](sources/ECONOMY-2026-10-12.md). |
| D-020 | DESIGN ESPLICITO (ECONOMY 12/10) | Quote aggregate vendita **0/25/50/75/100%** per tipo signorile + target riserva; oltre il target si offre l'eccedenza, oro solo a transazione conclusa. | Prezzi da domanda/offerta locale, domanda estera esplicita. [Fonte](sources/ECONOMY-2026-10-12.md). |
| D-021 | DESIGN ESPLICITO (ECONOMY 12/10) | Produzione giornaliera, consumo e scambi settimanali, salari/investimenti mensili, rivalutazione salari e redditività annuali; campi abbandonati dopo 3 annualità negative, altri privati dopo 2. | Guerra interrompe produzione anche per pochi giorni; L4 richiede 20% di margine netto. [Fonte](sources/ECONOMY-2026-10-12.md). |
| D-022 | DIREZIONE TECNICA (VISUAL 14–15/10) | Mantenere araldica e animazioni procedurali condivise; verificare cache/LOD e prestazioni prima di rasterizzare o costruire un nuovo Asset Manager. | I prerender locali non provano deploy. [Fonte](sources/VISUAL-AUDIO-2026-10-14.md). |
| D-023 | PROPOSTA STORICA (VISUAL 15/10) | Valutare prototipo **3D semantico** rispetto a sprite prerenderizzati, considerando torre/mura, cutaway, cantiere, danni e fallback. | **SUPERATA QUANTO ALL'ASSENZA DEL RENDERER** da D-028: un WebGL2 3D ora esiste su main; pipeline definitiva e parità in tutti gli scenari non certificate. [Fonte storica](sources/VISUAL-AUDIO-2026-10-14.md). |
| D-024 | PREFERENZA ESPLICITA (MUSICA 15/10) | Per i prompt Suno: **Style e Lyrics separati**; Lyrics soltanto descrittivo; Style sotto **1000 caratteri**. | Suno Pro dichiarato acquistato, brani/licenze da inventariare; non presume audio integrato. [Fonte](sources/VISUAL-AUDIO-2026-10-14.md). |
| D-025 | PRINCIPIO TECNICO (MINIMAP 15/10) | Il LOD cambia solo la rappresentazione della stessa entità; i marker nemici rispettano la visibilità tattica. | **STATO PR STORICO SUPERATO DA D-029**: [PR #44](https://github.com/erykwest/CONQUER/pull/44) integrata il 16/10; principio invariato. [Fonte storica](sources/MINIMAP-2026-10-15.md). |

| D-026 | PREFERENZA ESPLICITA (AUDIO 14/10) | Ambiente sonoro legato a stagione/meteo/giorno-notte; **SFX di edifici/unità soltanto se selezionati o con zoom almeno 30%** (soglia di ingrandimento). | Dissolvenze, distanza, budget sorgenti e legame con stati reali; [Fonte Pixabay](sources/PIXABAY-SOUNDS-2026-10-14.md). |
| D-027 | DIREZIONE ASSET (AUDIO 14/10) | Libreria SFX **repertoriata su Drive**, non da presumere nel Git: 24 MP3 contati nel thread, senza ascolto qualità; preservare provenienza/licenze file per file. | Evitare distribuzione indistinta di raw file in repo pubblico, testare duplicati e manifest; [Fonte Pixabay](sources/PIXABAY-SOUNDS-2026-10-14.md). |

| D-028 | CODICE SU MAIN (15/10) | Renderer WebGL2 di castello e mondo integrato con [db6857c](https://github.com/erykwest/CONQUER/commit/db6857c2af21b4010077107876f59cc300374697); attivato per default ove disponibile, Canvas fallback/opt-out con [cc6830a](https://github.com/erykwest/CONQUER/commit/cc6830ac2b61d6a0769a4e0a9302ab639295caf0). | La scelta operativa del renderer esiste; **non** certifica import glTF, prestazioni universali o separazione totale stato/disegno. Supera solo la parte fattuale della proposta D-023. |
| D-029 | CODICE SU MAIN (16/10) | [PR #44](https://github.com/erykwest/CONQUER/pull/44) integrata al commit [2e7582d](https://github.com/erykwest/CONQUER/commit/2e7582d33575fcbdfa76605a08b09746327457c9). Minimappa navigabile, LOD militare e marker ostili rispettosi di `spotted()`. | Supera lo **stato storico** della PR aperta indicato in D-025; non chiude QA browser/mobile né autorizza a dichiarare LOD edilizio nella scena principale. |
| D-030 | CODICE SU MAIN (15–16/10) | Illuminazione ambientale per stagioni/meteo/ora ([PR #43](https://github.com/erykwest/CONQUER/pull/43)) e Nightlight WebGL2 emissivo con fallback ([PR #47](https://github.com/erykwest/CONQUER/pull/47)) integrati. | Presentazione basata sullo stato esistente; effetto sulle prestazioni e confronto A/B controllato da validare. |

| D-031 | VINCOLO DI DESIGN ESPLICITO (ASSEDIO 16/10) | **Attacchi ordinari delle unità e frecce non danneggiano mura né torri**: danno strutturale 0. Non basta essere un bersaglio selezionabile; arma/azione e tipo di elemento devono risultare compatibili nella matrice dei danni. | S-05/S-16: vietare la perdita di HP di murature e torri per attacco ordinario, indipendentemente dalla loro integrità; prevedere QA deterministiche contro bypass e impatti incompatibili. Nessuna modifica runtime in questo commit. |
| D-032 | VINCOLO DI DESIGN ESPLICITO (ASSEDIO 16/10) | **Torre-porta e portone possiedono due valori di durabilità separati**: uno per la struttura della torre, uno per il portone vero e proprio. Ogni impatto agisce sulla durabilità del componente effettivamente colpito, non sull'altra per semplice associazione spaziale. | S-22/S-24/S-25: attacco/incendio del portone non rimuove automaticamente HP alla torre-porta; distruzione del portone sblocca il passaggio secondo lo stato della navigazione, senza distruggere la torre. Regole del possibile crollo della struttura da specificare, non inventate. Nessuna modifica runtime in questo commit. |

| D-033 | VINCOLO DESIGN (19/10/2026) | Prima i consumi e i saldi produttivi, poi mercanti e auto-upgrade delle case. Le nuove imprese spontanee richiedono una popolazione L4 reale. | I segnali economici devono distinguere carenza fisica, insufficienza monetaria, surplus e trend. |
| D-034 | CODICE BRANCH (19/10/2026) | Su `feature/economic-balances-20261019` bilancio settimanale per bene e trend a quattro settimane; consumo domestico di legna provvisorio. | [QA Node PASS](https://github.com/erykwest/CONQUER/actions/runs/39253184968); non implica merge o test browser. |

| D-035 | CODICE BRANCH (20/10) | Builder usa riserve fisiche e tesoreria di `ConquerEconomy` dopo la fondazione; `State.resources` è proiezione UI/legacy e non un secondo inventario. | Le merci sul mercato non sono risorse gratuite del castello; cantieri pagati materialmente al placement, recuperi registrati separatamente dalla produzione. |
| D-036 | CODICE BRANCH (20/10) | Fondazione = dotazione iniziale una tantum + **4 adulti L1 senza casa**, visibili presso il pozzo e disponibili alla produzione. | Nessun L4 creato artificialmente; fabbisogno alimentare già presente; coefficiente della dotazione da tarare; builder non ha ancora tempi di costruzione dipendenti dagli L1. |

| D-037 | CODICE BRANCH (20/10) | I cantieri manuali richiedono lavoro L1 effettivo: effort in giornate-operaio, lavoro lun–ven, priorità agli impieghi produttivi già attivi, assegnazione equa fino a 3 L1 per cantiere. | Senza L1 liberi le costruzioni si fermano; save V1 migrate senza perdere completamento, mentre strade/case/campi procedurali conservano i timer per non bloccare la fondazione. |

Le voci DESIGN sono decisioni di *indirizzo/progetto*, **non** affermazioni che il comportamento sia già implementato.

## Conflitti decisionali da risolvere esplicitamente

| ID | Tema | Fonti discordanti | Risoluzione richiesta |
|---|---|---|---|
| O-001 | Produzione miniera | [ECONOMY 12/10](sources/ECONOMY-2026-10-12.md) propone Miniera→Metallo nella filiera V1, ma la richiesta successiva per i placeholder e `src/settlement-industries.js` su main usano intenzionalmente `stone`. | **DESIGN VS PROTOTIPO**, non errore accertato: confermare output definitivo prima di cambiare codice + test + ledger/migrazione. |
| O-002 | Calendario agricolo | `src/settlement-fields.js` stagioni fisiche vs raccolto autunnale nel ledger | Un calendario fonte unica per campo, lavoratori, resa economica, UI e salvataggio. |
| O-003 | Risorse Builder | `State.resources` di test vs riserva/mercato `ConquerEconomy` | Definire source-of-truth e migrazioni; nessun doppio conteggio. |
| O-004 | Branch di sviluppo | Al 16/10 `urban` +97/-24, `sync/urban-main` +78/-24 rispetto a `main` [be14ccf](https://github.com/erykwest/CONQUER/commit/be14ccf521269cd50e36104dd6192f94c6729f99); [PR #19](https://github.com/erykwest/CONQUER/pull/19) aperta. | Confrontare diff, QA e asset prima di ogni integrazione; **non** scegliere per nome né fare merge cieco. |
| O-005 | Calendario mondo | Modello annuale a 12 mesi/365 giorni vs ipotesi mesi abbreviati da 6 giorni | Non modificare il tempo globale finché resa/stagioni/produzione non siano definite. |
| O-006 | Rendering e meccanica | Separazione a moduli esistente, ma rendering e stati condividono talvolta globali | Delimitare un contratto dati/test prima di un refactor di ampia scala. |
| O-007 | Perimetro MVP | Builder/Manager, combat, assedi, feudi e pubblicazione hanno ampiezza diversa | Confermare una vertical slice e relativo Definition of Done, non promettere tutto insieme. |

## Regola per le nuove decisioni

Aggiungere un ID, classe, data di registrazione, **motivazione**, alternative scartate, impatto su file/test, issue/PR/commit. Non sovrascrivere silenziosamente una decisione: segnarla **SUPERATA DA D-xxx**, mantenendo la traccia. Per le proposte usare «PROPOSTA» fino a conferma esplicita.
