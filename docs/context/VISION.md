# Livello 0 — Visione e confini

> Stabilità: alta. Cambiare solo se cambia davvero il prodotto; documentare la motivazione.

## Promessa di CONQUER

**CONQUER è un gestionale/simulatore strategico medievale** nel quale territorio, popolazione, produzione, costruzione del castello, difesa e guerra devono incidere *meccanicamente* l'uno sull'altro. Il Builder non è solo un editor scenografico: strade, accessi, mura, magazzini, lavoratori e zone controllate devono contare durante pace e assedio.

La priorità è **sostanza simulativa prima del realismo grafico**: prima sistemi coerenti, verificabili, persistenti; poi rappresentazione visiva più ricca. SVG, Canvas e 2.5D sono soluzioni produttive attuali, non limiti permanenti del concept.

## Pilastri progettuali

1. **Territorio significativo.** Bioma, suolo, rilievi, foreste e idrografia determinano dove costruire, produrre, passare, pattugliare e assediare.
2. **Economia leggibile, non prolissa.** Pochi beni e quattro poli produttivi principali (Farm Hub, Logging Camp, Cava, Miniera); specializzazione geografica e filiera corta. Riutilizzare edifici e funzioni invece di aggiungere un edificio per ogni trasformazione.
3. **Persone e lavoro coerenti.** Tier civili L1–L4 e professioni separati dal lavoro corrente. Soldati e cavalieri seguono logiche militari distinte. Le routine visive non devono essere scambiate per il ledger economico.
4. **Castello come sistema, non skin.** Geometria, slot interni, scorte, presidio, accessi, materiali, fuoco e danni strutturali diventano strumenti tattici effettivi.
5. **Assedi persistenti e plausibili.** Assalto, blocco dei rifornimenti, sortite, ritirata verso il Mastio, rinforzi e simulazione fuori vista; ciascuno subordinato a logistica, accessibilità e integrità reali.
6. **Stato unico, rendering sostituibile.** Separare, dove possibile, simulazione/regole, persistenza, interfaccia e rendering. Niente logiche concorrenti per gli stessi effetti.
7. **Sviluppo incrementale sostenibile.** Progetto indie a capacità limitata: feature piccole ma chiuse, test di regressione, niente espansione indiscriminata dello scope.

## Antiprincipi — evitare

- «Grafica bellissima, castello irrilevante al gameplay».
- Venti contatori di materiali, catene industriali lunghissime o una bottega per ogni professione.
- Un secondo motore di economia, navigazione, orografia, campi o araldica sviluppato in parallelo a quello esistente.
- Simulare ogni carro e sacco nella logistica locale *ordinaria*: astrarre i flussi routinari; rendere fisici solo convogli strategicamente interessanti.
- Trattare un pulsante nel Builder o un SVG come prova di gameplay completo.
- Confondere opzioni future (commercializzazione, resa 3D avanzata, sistema regni) con impegni della prossima release.
- **Polvere da sparo** nel contesto degli assedi medievali previsto: esclusa dal concept discusso.

## Confine dei sistemi

- **Builder/Manager:** generazione, edifici, terreno, popolazione, raccolti, economia e difesa territoriale.
- **Combat:** forze, spostamento, scontri, morale, visibilità, pattuglie e interazioni con ostacoli.
- **Siege:** usa edifici e unità realmente presenti; non deve duplicare né il Builder né il Combat.
- **World/Feudal:** rete insediamenti, territori e gerarchie; futuro livello strategico su economia locale funzionante.
- **Presentation:** SVG, Canvas, camera, luce, suoni, dettagli; consumano lo stato simulato.

## Lancio e ambizione

Direzione discussa: prototipo accessibile inizialmente, devlog/pagina progetto, follower e sostegno volontario (es. Buy Me a Coffee / itch.io). Steam o vendita successiva sono **opzioni, non milestone confermate**. Non sacrificare il core funzionale per anticipare la monetizzazione.

Vedi le decisioni granulari e le eccezioni in [DECISIONS.md](DECISIONS.md).
