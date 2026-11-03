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

## Contratto futuro (non implementato)

| Sistema autorevole | Ingresso futuro per CRIME | Uscita futura / responsabilità |
| --- | --- | --- |
| `State` e `ConquerEconomy` | Popolazione L1–L4, felicità, tassazione, razioni e occupazione **reali** | Modificatori sociali; nessun secondo ledger o contatore popolazione |
| `settlement-population-routines` / navigazione | Routine, quartieri, stato dei residenti, guardie | Raduni, arresti, incarcerazioni e manifestazioni fisiche |
| Builder / slot delle stanze | Funzioni guardia, prigione, ospizio; oggetti di piazza | Capienza, personale e accessibilità derivati da strutture vere |
| `ConquerCombat` e allarme / pattuglie | Presenza militare e ordini del signore | Esiti di sommosse/rivolte tramite sistemi militari, non un secondo combat |
| `ConquerGame` persistenza | `State` canonico e calendario unico | Stato sociale persistente **solo dopo** definizione del contratto e migrazione |
| Centro di controllo | KPI sociali **solo quando veri** | Avvisi su disordini, detenuti, servizi e welfare |

Il **Palazzo cittadino** e i suoi eventuali slot vanno verificati prima di assegnare il Tribunale; non introdurre stanze civiche presunte. La gogna e il patibolo sono piccole strutture collocabili previste, **non presenti** nel Builder con questa iterazione. L'ospizio è proposto come annesso religioso, senza introdurre una nuova categoria di risorse.

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
