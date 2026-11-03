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
| Corpo di guardia (`guard`) | Stanza di torre T2/T3, porta o sezione costruita (già esistente); **stanza del Municipio** (un piano) | `s.functions[i]='guard'` | Capienza 4 sentinelle per unità di stanza (`ConquerSiege.capacity().watchmen`) |
| Prigione (`prison`) | Come sopra | `s.functions[i]='prison'` | 6 detenuti per stanza normale, 12 per stanza grande (T3), 6 per piano del Municipio (`capacity().prisoners`) |
| Sala del consiglio (`council`) | Solo Municipio | `s.functions[i]='council'` | Arredo storico del cutaway; un Municipio salvato prima delle stanze la riceve al piano terra |
| Tribunale (`tribunal`) | Solo Municipio **L2+**, a qualsiasi piano | `s.functions[i]='tribunal'` | Al ritorno a L1 la stanza decade |
| Ospizio (`almshouse`) | Annesso della Chiesa **L2**, max 1, 4,5 × 2,4 U | `{type:'civicAnnex', annexType:'almshouse'}` | Modello Blender `almshouse` nello **stile delle case**: casa lunga a due piani (12,6 m, due camini), piano terra in pietra, P1 a graticcio su intonaco ocra con sporto sul retro, tetto in ardesia a 60°, **ballatoio** di legno al P1 sul fronte con tettoia e scala esterna, piccola croce sul frontone. Colori presi dal renderer delle case (`houseStone`, `housePlaster`, `houseTimber`, `roofHouse`…, in coda alla palette civica). Come gli altri annessi: niente costo o effetti economici |
| Gogna (`pillory`) | Piazza, 1 × 1 U | `{type:'eventVenue', venue:'pillory'}` | 8 legno + 2 metallo, ½ giorno. Modello `justicePillory` |
| Forca (`gallows`) | Piazza o margine, 2 × 1,5 U | `{type:'eventVenue', venue:'gallows'}` | 24 legno + 2 metallo, 1 giorno. Modello `justiceGallows`, sobrio e **vuoto** (senza figura né cappio) |
| Patibolo (`scaffold`) | Piazza maggiore, 2,5 × 2 U | `{type:'eventVenue', venue:'scaffold'}` | 40 legno + 10 pietra + 2 metallo, 2 giorni. Modello `justiceScaffold`: palco su pali con drappo scuro, parapetto, panca dei magistrati, ceppo al centro, scala laterale; **vuoto** (senza figura né lama). In `/crime/` è un flag a sé, più severo della forca su deterrenza e tensione |

**Stanze del Municipio: una per piano.** La stanza *i* è il piano *i* (`s.functions[i]`), e ce ne sono tante quanti i livelli civici: L1 = 1 (piano terra; il P1 del modello resta senza funzione), L2 = 2, L3 = 3. Il catalogo civico è `TOWNHALL_FUNCTION_CATALOG = council, tribunal, guard, prison`. Le funzioni del castello restano nel castello: consiglio e tribunale non si assegnano alle torri.

Il **cutaway per piani** (D-CUT-01, branch `feature/cutaway-floors`, unito qui) mostra un piano per volta con ▲ ▼ sopra l'edificio e nell'ispettore. Ogni stanza è arredata sull'intero piano:

- **Consiglio:** il salone storico al piano terra; ai piani alti, tavolo con panno, sgabelli, pedana del podestà, cassoni e stendardi.
- **Tribunale:** banco dei giudici su gradino con tre seggi, scrivania del cancelliere, sbarra a balaustri, file di panche per il pubblico, stendardi.
- **Guardia:** due tavoli con sgabelli, rastrelliera d'armi, scudi, brande, cassone.
- **Prigione:** celle lungo la parete di fondo dietro l'inferriata, con paglia, secchio e catene, e il tavolo del carceriere vicino alla porta.

**Tribunale in seduta** (`src/settlement-court-people.js`, `ConquerCourtPeople`). Quando il Municipio selezionato mostra il piano del tribunale nel cutaway, la sala si riempie. Succede dal lunedì al venerdì, dalle 9 alle 17, se la campana d'allarme è ferma.

- **Chi c'è:**
  - tre giudici in toga rossa con collo d'ermellino e berretto, seduti al banco; quello che presiede alza la mano di tanto in tanto;
  - il cancelliere in nero che scrive alla sua scrivania;
  - il prigioniero alla sbarra, in camicia grezza con le mani legate, tra due guardie con la lancia;
  - il pubblico sulle panche, rado: un'estrazione fissa per edificio.
- **Posti:** vengono da `ConquerCivic3D.roomSlots`, che usa lo stesso `tribunalLayout` dell'arredo.
- **Disegno:** le persone sono disegnate a ogni fotogramma con le figure dei popolani, come l'artigiano delle botteghe e le persone degli eventi. Non entrano nella mesh del cutaway.
- **Natura:** sono decorative e provvisorie, senza residenti né sentenze. Un futuro runtime CRIME può sostituirle con `setOccupancySource`.
- **Costumi di ruolo:** stanno in `ConquerWardrobe.ROLE_PIECES` e sono `judgeRobe`, `judgeCap`, `clerkGown`, `clerkCap`, `prisonerShirt` e `executionerHood` (quest'ultimo già pronto per il boia). Il guardaroba stagionale non li assegna mai. Nel Lab si trovano sotto *Popolazione · Costumi di ruolo*.

**Prigioni occupate** (a ogni ora, stesso modulo):

- **Municipio:** sul piano della prigione ci sono uno o due detenuti per cella. Uno sta in piedi alle sbarre, gli altri seduti sulla paglia; il carceriere sonnecchia al tavolo vicino alla porta.
  - Celle e carceriere seguono `prisonLayout`, lo stesso dell'arredo.
  - Quando la camera guarda le celle attraverso l'inferriata, le sbarre (`ConquerCivic3D.prisonBars`) vengono ridisegnate sopra i detenuti.
- **Torri, porte e sezioni:** nelle stanze con funzione prigione del castello ci sono due detenuti (tre in una stanza grande), disegnati da `drawCutawayOccupants` accanto a soldati e nobili.

**Gogna, forca e patibolo in uso** (stesso modulo, `justiceSlots` / `justiceScene`). Le scene sono sobrie: nessun condannato sulla forca o sul patibolo, nessuna esecuzione; la scena si ferma all'attesa.

- **Gogna:** dal lunedì al sabato, dalle 8 alle 17. Un condannato a mani legate sta sulla pedana e un capannello davanti lo schernisce col pugno alzato.
- **Forca e patibolo:** il «giorno di giustizia», il venerdì dalle 10 a mezzogiorno.
  - Sul palco aspetta il boia, incappucciato e a braccia conserte.
  - Sul patibolo c'è anche un magistrato che legge la sentenza dalla panca.
  - Due guardie stanno ai piedi della scala e una folla a semicerchio davanti.
- **Sospensione:** l'allarme svuota la piazza.
- **Disegno:** chi sta dietro alla struttura viene ritagliato lungo la sagoma della parte piena (base, pedana, drappo, parapetto). Pali e trave restano trasparenti.

Test: `qa/court-people-regression.cjs`.

Gogna, forca e patibolo riusano il contratto delle `eventVenue` (posa a due clic, cantiere, costo, modello nel catalogo eventi). Nel nuovo Builder compaiono nello strumento **Giustizia**; nel vecchio, tra gli edifici civili. Nel Lab sono nella categoria *Edifici · Giustizia*.

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

Il Tribunale è una stanza (un piano) del Municipio L2+ (decisioni del 03/11/2026). Gogna, forca, ospizio, corpo di guardia e prigione esistono ora nel Builder (sezione precedente). Restano da fare l'adapter `/crime/` ← `State`, il personale e le routine.

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
