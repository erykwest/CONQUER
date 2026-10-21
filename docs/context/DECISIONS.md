# Livello 3 — Decisioni, ipotesi e conflitti

> Data di **registrazione**: 2026-10-16. Le date originali di decisione non sono ricostruite dove non verificabili.
> Classi: **VINCOLO** (principio espresso), **DESIGN** (direzione esplicita ma non prova di codice), **CODICE** (contratto osservato), **PROPOSTA**, **APERTO** (conflitto/decisione necessaria).

## Aggiornamento clay (19/10/2026) — solo design, non codice

**D-CLAY-01 · DESIGN:** introdurre Argilla (`clay`) come materia prima e mattoni cotti (`brick`) come materiale alternativo alla pietra per costruzioni murarie e fortificazioni; variante rosso/marrone della muratura esistente e **durabilità massima 80%** rispetto alla pietra, senza duplicare geometrie o sistemi di combattimento.

**D-CLAY-02 · DESIGN:** la Cava esistente può produrre `stone` sulla roccia ripida oppure `clay` vicino a fiumi/torrenti/laghi (**entro 6 U**); nessuna nuova cava tipologica né fornace/risorsa `brick`. I lavoratori rimangono L2 e si usa il ledger unico.

**D-CLAY-03 · DESIGN:** la conversione riguarda tutti gli elementi che consumano pietra e ne cambia costi e rendering; materiali selezionabili per singolo elemento costruibile per consentire castelli misti. Porte lignee e strutture in legno restano indipendenti. Vasellame rimandato a un'eventuale specializzazione L3.

**D-CLAY-04 · CONTRATTO TECNICO DA SVILUPPARE:** proteggere la compatibilità con `Civil`: `material` ha già il significato wood/stone su tower/gate e la migrazione attuale non accetta `brick`; `State.resources` e ledger sono separati; nessuna affermazione di implementazione finché non si risolvono questi punti con QA. Guida: [CLAY-DEVELOPMENT](../CLAY-DEVELOPMENT.md), [piano QA](../CLAY-REGRESSION-PLAN.md).

## Aggiornamento Civil (17/10/2026)

**D-CIV-01 · DESIGN esplicito:** chiesa e locanda hanno lotti Voronoi di pertinenza; il mercato non ha un lotto privato. Applicazione attraverso il sistema catastale già condiviso con le abitazioni, senza duplicare recinzioni. La piazza è un nuovo edificio pubblico e non genera un lotto di pertinenza.

**D-CIV-02 · DESIGN esplicito:** tre livelli di sviluppo (L1–L3) per edifici civili esistenti chiesa/locanda/mercato e nuova Piazza; tre varianti di Piazza (pavimentata, fontana, verde). Nella prima iterazione il livello è **skeleton di configurazione**, non un modificatore economico o di servizi; le forme/scale definitive restano future. Fonte tecnica: branch [`Civil`](https://github.com/erykwest/CONQUER/tree/Civil), `src/settlement-core.js`, `src/settlement-urban.js` e pannello `src/settlement-app-rooms.js`.

**D-CIV-03 · DESIGN/CODICE su branch `Civil` (17/10):** ogni annesso civile è una struttura separata con `parentId` verso chiesa, taverna o mercato, tipo da catalogo (`annexType`), footprint e sblocco per `civicLevel`. Chiesa/taverna: costruzione solo dentro il lotto Voronoi; mercato: estensione pubblica vicina al mercato, vietato occupare lotti privati. I figli vengono eliminati insieme al padre; il livello non può scendere sotto il requisito di un annesso esistente. Per ora nessuna produzione, capacità, staff o costo, e rendering 2D/3D provvisorio. Dimensioni, limiti quantitativi e raggi sono valori di skeleton da rivedere al bilanciamento.

**D-CIV-04 · DESIGN/CODICE su branch `Civil` (17/10):** alla chiesa **L1** spetta già un **cimitero interno al lotto Voronoi**, non da costruire manualmente: è una componente derivata del terreno di pertinenza, visibile con tombe schematiche e riservata agli annessi ulteriori. Quando il lotto non offre spazio sufficiente, non esce dai suoi confini. La taverna sblocca a **L2** una **estensione birreria** costruibile, che deve stare vicino alla struttura madre e nello stesso lotto. Resta uno skeleton, senza funerali, produzione di birra o gestione di personale.

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
| D-033 | CODICE + VINCOLO ESPLICITO (TERRAFORMING 19–20/10) | Il Builder offre **Terreno** e **Terrazzamento murato** con ghost non distruttivo; un terrazzamento murato non può sovrapporsi a un altro terrazzamento murato. **Chiarimento definitivo: il terrazzamento è un gradone VERTICALE color muro, con piano superiore piatto.** La collina naturale mantiene i pendii esistenti. Il magnete tiene conto dello spessore delle mura. | Stato persistito in `State.relief.terraforming`; migrazione dei terrazzamenti inclinati al profilo verticale. Canvas e WebGL2 usano facce verticali; il WebGL2 ritaglia il terreno al bordo evitando triangoli inclinati. Mutazione e invalidazione solo alla conferma. QA: `qa/terraforming-regression.cjs`; branch `terraforming`. Superata la precedente interpretazione spiovente del 20/10. |

| D-034 | CONTRATTO TECNICO LOCALE (20/10/2026) | La manutenzione stradale dopo un completamento usa gli stessi generatori e le stesse collisioni del percorso sincrono, con budget cooperativo 6 ms e revisione della navigazione verificata prima del commit. Un completamento non invalida il catasto se non lo modifica; i completamenti delle arterie aggiornano le facciate dense. Il renderer confronta il contenuto dei lotti e attende una fence con polling a timeout zero prima di leggere gli errori GPU. | Motivazione: A* sincrono, texture terreno ricostruite senza necessità e `getError` bloccante riprodotti nell'[audit del 20/10](../construction-performance-audit-2026-10-20.md). Evita riduzioni della risoluzione o rimozione del fallback. Codice locale su `fix/construction-completion-perf`, non su main; QA in `qa/construction-completion-regression.cjs`, `qa/webgl-error-poll-regression.cjs`, `qa/construction-performance.cjs`. |

Le voci DESIGN sono decisioni di *indirizzo/progetto*, **non** affermazioni che il comportamento sia già implementato.

**D-035 · CONTRATTO TECNICO LOCALE (20/10/2026):** danni ai soli HP modificano stato persistito e overlay dinamico, senza invalidare navigazione/catasto o ridisegnare sincronicamente. Nell'app completa fuoco e crolli richiedono un frame al ciclo di simulazione condiviso; il dominio mantiene il proprio comportamento e il fallback standalone. Le macerie ferme usano un buffer GPU per contenuto/rotazione, quelle in caduta restano dinamiche. Il cutaway WebGL riusa la cache composita esistente limitata a 32 MiB per pareti/arredi; occupanti, danni, selezione e propagazione restano guidati dallo stato originale. Motivo e alternative verificate: [audit round 2](../fire-collapse-cutaway-performance-audit-2026-10-20.md). Codice locale su `fix/construction-completion-perf`, non rilasciato; nessuna riduzione di frammenti, collisioni o regole del fuoco. I colli Canvas/brigata rimangono espliciti.

**D-036 · CONTRATTO TECNICO LOCALE (20/10/2026):** i percorsi della brigata usano
lo stesso A* del chiamante sincrono, esposto anche come generatore e consumato con
budget condiviso indicativo di 4 ms. Priorità rotante tra addette e cancellazione
su revisione della navigazione; una rotta fallita non autorizza un segmento diretto
attraverso gli ostacoli. Sagome/costi dei nodi sono memo della singola ricerca;
le tangenti a pozzi/torri tonde richiedono distanza continua dal segmento.
Le macerie Canvas sono memorizzate soltanto quando tutte le mesh sono ferme,
nella cache composita esistente da 32 MiB: ordine del painter preservato, pan
riutilizzabile, nuove mesh/proiezione cambiano chiave. Il raggruppamento di triangoli
consecutivi dello stesso colore riguarda il primo disegno statico; niente culling
né riduzione dei frammenti. Motivo, alternativa scartata e prove:
[audit round 3](../movement-collapse-performance-audit-2026-10-20.md),
`qa/movement-path-performance-regression.cjs` e benchmark browser. Il costo dei
crolli ancora in movimento e la variabilità dei frame restano espliciti. Codice
locale su `fix/construction-completion-perf`, non rilasciato.

**D-037 · CONTRATTO TECNICO LOCALE (21/10/2026):** nel test 40 contro 30 un
fante/arciere individuale è una sola entità e una sola figura, distinto dalle
squadre/pattuglie esistenti. I tipi persistiti includono `infantry` e `archer`;
il profilo dell'arciere non richiede un secondo campo ridondante. Il motore del
tiro è condiviso fra entrambi gli schieramenti tramite argomenti aggiuntivi
opzionali di `ConquerCombatRules.update`, compatibili con i chiamanti precedenti.
I record mobili mantengono il proprietario e non autorizzano un tiro da un morto
o da chi è in mischia/sulle scale. Portata/distanza precedono collisioni e LOS
costose; i loro verdetti restano necessari per le coppie vicine. Nessuna modifica
ai valori di HP, armatura, dado o danno strutturale. Il driver QA invia ordini
attraverso i percorsi reali; non decide morti o danni e non costituisce una nuova
IA strategica. Motivazione e prove: [audit 40/30](../mass-battle-performance-audit-2026-10-21.md).
Codice locale oltre `9e1b6a5`; il picco `getError` rimane aperto, il tentativo di
fence aggiuntive non è stato mantenuto.

**D-038 · CONTRATTO TECNICO LOCALE (21/10/2026):** le animazioni militari in
pausa condividono il ciclo visuale della simulazione con incendi e crolli;
il modulo del combattimento non avvia un secondo RAF per ridisegnare la scena.
Il controllo errori WebGL mantiene la verifica per perdita del contesto a ogni
disegno, ma distanzia le query sincrone `getError` di almeno 1 s. La fence viene
emessa dopo front/luci e mantiene l'età iniziale quando sostituita: dopo 1 s di
attesa il controllo viene comunque eseguito, accettando un possibile blocco
residuo invece di nascondere gli errori sotto carico continuo. Errori, wait
fallita e allocazione sync fallita conservano il fallback Canvas.
Questa scelta riduce i costi cumulativi; **non elimina le singole attese GPU**
né certifica FPS a 1×. Il contratto aggiorna il posizionamento del checkpoint
descritto da D-034; il tentativo di sole fence aggiuntive ricordato in D-037
resta scartato. Nessuna modifica al framebuffer o rinvio dei frame viene
mantenuta. Motivazioni, esperimenti e misure nell'[audit esteso](../mass-battle-performance-audit-2026-10-21.md).
Codice locale oltre `9e1b6a5`, nessuna nuova pubblicazione.

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
