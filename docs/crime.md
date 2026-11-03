# CONQUER — CRIME · skeleton V0

**Stato (02/11/2026):** prototipo isolato nella route `/crime/`, sul branch `feature/crime-skeleton`. Non è integrato nel settlement Builder, nel World, nella simulazione dei popolani né nel salvataggio della partita.

## Scopo

Un laboratorio deterministico per testare tre indicatori **distinti**: **Criminalità** (reati e insicurezza), **Ordine pubblico** (capacità di presidio), **Tensione sociale** (malcontento e rischio di protesta). Le soglie e i coefficienti sono provvisori e non rappresentano tassi storici.

La progressione osservabile è:

`calm → discontent → protest → riot → revolt`

La de-escalation è possibile, per gradi, attraverso tempo, sostegno sociale e presidio. Nel prototipo sommossa e rivolta sono **stati simulati e voci di cronaca**, non combattimenti, percorsi di folla o distruzione reale.

## Simulazione V0

- Motore UI-independent: `crime/engine.js`, `window.ConquerCrime` / `module.exports`.
- Fixture propria (120 residenti dimostrativi), tick giornalieri deterministici, storico max 60 giorni, registro max 48 voci.
- Politiche di prova: imposte, scarsità di cibo, numero di guardie, assistenza, severità delle pene.
- Preimpostazioni «Simula carestia» e «Misure sociali» per esercitare l'escalation e il recupero.
- Strutture **solo come flag di fixture**: corpo di guardia (stanza torre W2/W3), prigione (stanza torre W2/W3, 12 posti), ospizio (annesso Chiesa L2), gogna (piazza), forca/patibolo (piazza o margine), tribunale (edificio civico da verificare).
- Arresti a cadenza dimostrativa e detenuti con capienza; senza prigione attiva non si eseguono arresti. La prigione occupata non si può disattivare.
- Gogna/forca contribuiscono al deterrente e aumentano la tensione; ospizio e assistenza mitigano il disagio; le guardie influenzano ordine e arresti.
- Persistenza separata nel solo `localStorage` con chiave `conquer.crime.prototype.v1`, validazione dello schema, reset senza effetti su altri salvataggi.

**Avvertenza:** nessuna esecuzione è visualizzata o simulata, e le strutture punitive non applicano sentenze ai singoli PNG. I coefficienti non sono ancora tarati, né derivati da serie dati reali.

## Edifici e stanze nel Builder (C-02 / C-03)

**Stato (03/11/2026):** implementati sul branch `feature/crime-buildings` come **strutture reali del Builder**. Il laboratorio `/crime/` resta isolato: non legge ancora il salvataggio e i suoi flag restano di fixture.

| Struttura | Dove si costruisce | Dati | Note |
| --- | --- | --- | --- |
| Corpo di guardia (`guard`) | Stanza di torre T2/T3, porta o sezione costruita (già esistente); **sala del Municipio** | `s.functions[i]='guard'` | Capienza 4 sentinelle per unità di stanza (`ConquerSiege.capacity().watchmen`) |
| Prigione (`prison`) | Come sopra | `s.functions[i]='prison'` | 6 detenuti per stanza normale, 12 per stanza grande (T3), 6 per sala del Municipio (`capacity().prisoners`) |
| Sala del consiglio (`council`) | Solo Municipio | `s.functions[i]='council'` | Arredo storico del cutaway; un Municipio salvato prima delle sale riceve questa sala nella prima posizione |
| Tribunale (`tribunal`) | Solo Municipio **L2+** | `s.functions[i]='tribunal'` | Al ritorno a L1 la sala decade |
| Ospizio (`almshouse`) | Annesso della Chiesa **L2**, max 1, 3 × 2,4 U | `{type:'civicAnnex', annexType:'almshouse'}` | Modello Blender `almshouse` (aula intonacata, portico, campanile a vela). Come gli altri annessi: niente costo o effetti economici |
| Gogna (`pillory`) | Piazza, 1 × 1 U | `{type:'eventVenue', venue:'pillory'}` | 8 legno + 2 metallo, ½ giorno. Modello `justicePillory` |
| Forca (`gallows`) | Piazza o margine, 2 × 1,5 U | `{type:'eventVenue', venue:'gallows'}` | 24 legno + 2 metallo, 1 giorno. Modello `justiceGallows`, sobrio e **vuoto** (senza figura né cappio) |

**Sale del Municipio.** Il piano terra del Municipio si divide in tante sale affiancate quanti sono i livelli civici (L1 = 1, L2 = 2, L3 = 3), con il catalogo civico `TOWNHALL_FUNCTION_CATALOG = council, tribunal, guard, prison`. Le funzioni del castello restano nel castello: consiglio e tribunale non si assegnano alle torri. Nel cutaway del Municipio ogni sala è arredata secondo il suo ruolo, con una tramezza tra le sale:

- **Consiglio:** tavolo e seggio del podestà.
- **Tribunale:** banco dei giudici su gradino, sbarra, panche.
- **Guardia:** tavolo, rastrelliera, branda.
- **Prigione:** inferriata, paglia, catene.

Gogna e forca riusano il contratto delle `eventVenue` (posa a due clic, cantiere, costo, modello nel catalogo eventi). Nel nuovo Builder compaiono nello strumento **Giustizia**; nel vecchio, tra gli edifici civili. Nel Lab sono nella categoria *Edifici · Giustizia*.

Test: `qa/crime-buildings-regression.cjs`.

## Contratto futuro (non implementato)

| Sistema autorevole | Ingresso futuro per CRIME | Uscita futura / responsabilità |
| --- | --- | --- |
| `State` e `ConquerEconomy` | Popolazione L1–L4, felicità, tassazione, razioni e occupazione **reali** | Modificatori sociali; nessun secondo ledger o contatore popolazione |
| `settlement-population-routines` / navigazione | Routine, quartieri, stato dei residenti, guardie | Raduni, arresti, incarcerazioni e manifestazioni fisiche |
| Builder / slot delle stanze | Funzioni guardia, prigione, ospizio; oggetti di piazza | Capienza, personale e accessibilità derivati da strutture vere |
| `ConquerCombat` e allarme / pattuglie | Presenza militare e ordini del signore | Esiti di sommosse/rivolte tramite sistemi militari, non un secondo combat |
| `ConquerGame` persistenza | `State` canonico e calendario unico | Stato sociale persistente **solo dopo** definizione del contratto e migrazione |
| Centro di controllo | KPI sociali **solo quando veri** | Avvisi su disordini, detenuti, servizi e welfare |

Il Tribunale è una sala del Municipio L2+ (decisione del 03/11/2026, dopo il cutaway civico). Gogna, forca, ospizio, corpo di guardia e prigione esistono ora nel Builder (sezione precedente). Restano da fare l'adapter `/crime/` ← `State`, il personale e le routine.

## Non-obiettivi V0

Nessun asset 3D/SVG nuovo, nessun posizionamento oggetti nel mondo, IA criminale, esecuzioni animate, giurisdizione reale, economia penale, arresti individuali, salvataggi cloud, screenshot in partita o deploy di preview automatico. Il laboratorio è intenzionalmente uno **skeleton funzionale**, non una feature di gioco completa.

## Criteri di accettazione

1. `/crime/` apre una UI utilizzabile (pagina statica `crime/index.html`) e si può navigare da e verso il Builder.
2. Il motore si esercita senza DOM e produce lo stesso esito con la stessa fixture.
3. Una crisi prolungata può avanzare per tutte le cinque fasi; misure sociali reali nel laboratorio possono de-escalare.
4. Ospizio, pattuglie, gogna, patibolo, prigione e tribunale producono conseguenze dimostrative non identiche.
5. I dati sono confinati alla chiave `conquer.crime.prototype.v1`, e reset/corruzione non toccano gli altri salvataggi.
6. `node qa/crime-regression.cjs` copre motore e markup (il test browser resta da eseguire).

## Prove

`qa/crime-regression.cjs` — regressione Node isolata. La presenza del test non equivale alla sua esecuzione o a un test browser. Il branch e la relativa CI sono la fonte di verità per l'esito.
