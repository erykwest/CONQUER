# CONQUER / clay — piano QA e criteri di accettazione

> **Stato:** casi di test da implementare ed eseguire dopo il codice. Nessuna prova runtime eseguita dalla sola redazione dei Markdown. Base di integrazione: branch `Civil` (19/10/2026).

## 1. Regressioni automatiche richieste

| ID | Scenario | Esito atteso |
|---|---|---|
| CLAY-01 | Cava legacy su pendio ripido dopo migrazione | Resta `quarry`, `stone`, produzione/footprint invariati |
| CLAY-02 | Cava `clay` pianeggiante con riva a 5.99 U dal bordo | Piazzamento consentito |
| CLAY-03 | Cava `clay` con riva a 6.01 U dal bordo | Rifiuto motivato |
| CLAY-04 | Cava `clay` accanto a `river`, `stream`, lago rappresentato da `pond` | Ammessa per ciascuna geometria qualificante |
| CLAY-05 | Cava `clay` solo vicino a `sea` e senza acque interne | Non ammessa |
| CLAY-06 | Cava `clay` sovrapposta ad acqua, foresta, edificio, strada o fuori whitezone | Sempre rifiutata |
| CLAY-07 | Luogo idoneo sia a `stone` sia a `clay` | La modalità scelta determina un unico bene prodotto |
| CLAY-08 | 2 L2 attivi in cava `clay`; calendario lavorativo | Produzione `clay` con ritmo esistente; riposo/salario non duplicati |
| CLAY-09 | Costo murario misto per torre, muro, gate, `built`, chiesa, taverna, mercato, pozzo, piazza, ponte in muratura | Tutto e solo il costo `stone` viene sostituito da `clay`; nessun doppio addebito |
| CLAY-10 | Struttura in mattoni con risorse insufficienti; anteprima e rimborso/cantiere | Blocco chiaro e accounting coerente con lo stesso inventario |
| CLAY-11 | Due strutture contigue, una `stone` e una `brick` | Materiali e colori indipendenti, geometrie/patrolling inalterati |
| CLAY-12 | Muratura stone HP nominali 100 e corrispondente brick | Brick HP max = 80; stesso livello/geometria |
| CLAY-13 | Torre-porta di mattoni, portone in legno, danno al solo portone | HP della torre indipendenti; la sua riduzione al 80% non interessa l'anta |
| CLAY-14 | Colpi di unità e frecce su mura/tower in mattoni | 0 danno strutturale; sorgenti esplicitamente compatibili soltanto |
| CLAY-15 | Salvataggio/caricamento locale/cloud con cava argilla e mura mattoni | Rimangono mode/material/costi/stato danni, senza upgrade spontanei |
| CLAY-16 | Vecchi salvataggi senza campo nuovo per materiali | Stone di default dove eleggibile; wood/gate invariati |
| CLAY-17 | Rendering Canvas vs WebGL2 con castello misto | Palette coerente, nessuna perdita di sezioni, collisioni, cutaway e ombre |
| CLAY-18 | Build con materiali diversi e varianti esistenti (basamenti, merli, hoardings, tetti, civic annex) | Nessuna regressione delle varianti `Civil` e di scena |

## 2. Suite esistenti da adattare/riutilizzare

- `qa/economy-industries-regression.cjs`: validazione sito, lavoratori, output cava.
- `qa/economy-regression.cjs`: ledger, mercato, riserve e lavoro aggregato.
- `qa/builder-placement-regression.cjs`: collisioni, costi/preview, materiali.
- `qa/civic-annex-regression.cjs` e `qa/urban-regression.cjs`: nessuna rottura dello skeleton `Civil`.
- Suite assedi/combat pertinenti: matrice danni, target torre/anta, integrità localizzata, quando presenti; verificare i nomi reali prima dell'esecuzione.
- Test save/load/migrazioni e confronti Canvas/WebGL2; non dichiararli coperti senza test espliciti.

## 3. Collaudo visivo minimo (browser)

1. Territorio pianeggiante attraversato da fiume: cava argilla e castello in mattoni, senza import di pietra.
2. Territorio montuoso: cava pietra, castello grigio come prima; scelta mattoni solo con argilla disponibile.
3. Castello misto pietra/mattoni/legno: preview, costruzione, selezione, cutaway, ombre, zoom, inverno e notte.
4. Salvataggio vecchio e nuovo; verifica riapertura, costi, produzione e integrità residua.

## 4. Evidence gate

Per dichiarare la feature **COMPLETATA** annotare: branch, SHA commit, elenco test lanciati, pass/fail, link GitHub Actions, prove manuali con scenario e dispositivo/browser. Per l'attuale commit **solo Markdown**, registrare **PROGETTO / DOCUMENTAZIONE — nessuna implementazione e nessuna QA runtime**. Non aprire PR verso `main` né avviare Vercel automaticamente.
