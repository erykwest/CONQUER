# CONQUER — Convogli, tributi/doni, carretti, carrozze e scorte (21 ottobre 2026)

**Stato: skeleton tecnico sulla PR #55 Draft.** Nessuna partenza, navigazione, commercio, giorno di viaggio, consumo dei salari/trasporti o battaglia da convoglio è attiva. Non interpretare `status:'ready'` come una carovana partita.

## Contratto comune dei mezzi

Fonte di capacità e costo indicativo: `ConquerCommerce.VEHICLES`. La distinzione è tra capacità merci e posti passeggeri, non tra tipi di moneta.

| Mezzo | Capacità merci | Cavalli | Passeggeri | Costo indicativo, oro/giorno/mezzo | Impiego previsto |
|---|---:|---:|---:|---:|---|
| **Carretto** (`cart`) | **40 punti** | 1 | 0 | **0,10** | Consegne locali L3 e piccole spedizioni |
| **Carro** (`wagon`) | **100 punti** | 2 | 0 | **0,20** | Trasporto ordinario, commercio L4+, tributi/doni |
| **Carrozza** (`coach`) | **0** | 2 | **2** | **0,30** | Viaggi richiesti di nobili L4, soprattutto dame |

I valori sono **parametri iniziali da bilanciare**, non dati storici o tariffe già pagate. I carichi dei mercanti e dei convogli signorili ammettono **al massimo un tipo di merce**, più **un forziere di monete** (`chest:{gold,reservedGold}`): monete fisiche, ingombro mercantile trascurabile. Anche con 0 merci, una spedizione finanziata a monete può portare un carro o carretto vuoto per futuri acquisti. Le merci non si mischiano; il ritorno potrà avere una merce diversa, ma resterà monotipo **per tratta**. Il carretto è ammesso come opzione per L4+ e per i convogli signorili, mentre la sua futura logistica locale non crea nuove figure automaticamente.

**Visuale:** i modelli `cart/wagon` già esistono nelle branch `animation` e `feature/scatter` (`src/settlement-wagons.js`, `src/settlement-wagons3d.js` e `src/assets/wagon-model.js`); NON sono presenti in questa branch e NON sono stati importati senza merge/QA. Un'animazione di carico può scegliere sacchi/casse/pietra coerentemente con la merce. La carrozza richiederà un asset e animazioni propri; `planNobleCoach()` è soltanto un registro dati.

## Giocatore: tributi e doni dal Mastio

`ConquerConvoys.planLordConvoy({id,kind,destinationId,cargo,coinGold,vehicle,guards})`
- `kind`: `tribute` o `gift`; l'origine è sempre il **vero Mastio completato** da `ConquerSiege.mastio()` e la destinazione un feudo differente, per ora identificato tramite ID testuale; la mappa mondiale non è reintegrata.
- `cargo`: zero o una riga; `coinGold`: 0 o più monete; è necessaria almeno una merce o monete positive.
- `status:'draft'`: nessun prelievo di risorse, nessuna partenza, nessuna rotta o pagamento. Il menu del Mastio permette al giocatore di predisporre questi dati e modificare i posti di guardia richiesti.
- `reserveLordConvoy(id)`: solo su bozza con Mastio valido e risorse sufficienti. **Trasferisce realmente** il valore indicato da `ConquerEconomy.state().castleGold/castle` alla riserva del convoglio in un'unica operazione; aggancia oro a `chest.reservedGold` e merci a `reservedCargo`. Aggiorna lo stock del Builder. Lo stato diventa **`ready` = carico accantonato, NON in viaggio**.
- `cancelLordConvoy(id)`: finché `draft` o `ready`, rimuove la bozza e restituisce una sola volta tutte le merci e le monete che sono state effettivamente accantonate, anche dopo il caricamento del salvataggio. Non emette oro nuovo.
- **Periodicità**: possibile in futuro da una policy/regola ricorrente sullo stesso contratto, non attivata ora.
- **Scorte del signore**: `escorts:{kind:'garrison',requested,assigned:0,heraldry:'lord'}`. I posti richiesti possono essere gestiti dal menu; sono limitati ai **posti nelle caserme** riportati da `ConquerSiege.capacity().soldiers`, al netto di quelli già prenotati per altre bozze. È capienza, **non roster reale di soldati**: `assigned` resta zero finché la disponibilità individuale, il trasferimento di servizio e l'assenza fisica non siano simulati. Il soldato signorile sarà già pagato dalla guarnigione, quindi non inventare un secondo salario da mercenario.

Nel pannello del Mastio sono presenti **Prepara bozza / Accantona oro e merci / Aggiorna scorta / Annulla convoglio**, ma NON il pulsante di partenza. Il menu non genera mercanti L4, soldati, cavalli o città.

## Mercanti L4+: scorte mercenarie

Le spedizioni L4+ mantengono la propria origine e il **forziere** di oro commerciale. `planJourney({...,mercenaryCount})` crea solo la richiesta di mercenari. `ConquerConvoys.assignMerchantEscorts(id,count)` permette di variare il numero finché il viaggio resta in fase `planned`.

Contratto grafico della futura scorta: `type:'mercenary'`, `armor:'leather'`, `heraldry:'neutral-brown'`, `employer:'merchant'`. Questa araldica marrone neutrale **non** viene ancora renderizzata sul canvas e non sostituisce l'araldica signorile.

**Costo di progetto:** `salario L2 mensile / 20 giornate lavorative × 2` per mercenario e per **giorno di viaggio**. Con salario L2 iniziale 2 oro/mese → **0,20 oro per mercenario/giorno**. Una variante ×5 potrà essere una guardia veterana/scorta d'alto rischio, ma non è lo standard. `quoteJourneyCost(journeyId,days)` restituisce il costo separato di mezzi e scorte; richiede giorni forniti dalla futura mappa mondiale e **non addebita** nulla al mercante durante la pianificazione. Il costo completo futuro comprende andata, eventuale ritorno, pasti/cura animali, pedaggi e perdite.

La paga mercenaria non sottrae soldi alla classe L2: l'importo è **tarato** sul salario L2, ma riguarda personale pagato dal mercante L4+.

## Carrozze L4

`planNobleCoach()` registra una **richiesta** di viaggio per una casa L4 locale reale, max 2 posti; default una dama e zero uomini, con preferenza `noblewomen`. Si possono richiedere anche viaggi maschili: non c'è un divieto sociale. Nessuna donna o uomo viene creato o spostato finché non esiste un roster con identificatori e un vero path. Non si associa merce alla carrozza; eventuali effetti per passeggeri, scorte di nobili e soggiorni saranno un modulo successivo.

## Integrazione con mappa del mondo e assedi (futura)

`availableExits()` legge i **quattro exit point esistenti** di `State.village.borderEntries` e gli ID delle arterie `roadPlan`, senza generarne di nuovi. Il campo `reportedConnected` è solo lo stato dichiarato dalla strada, **non** una validazione fisica di percorribilità per carri. La futura sequenza è:

1. Mercante/carro: **mercato → arteria → exit point**; tributo/dono: **Mastio → arteria → exit point**; coach: **residenza nobile → arteria → exit point**.
2. World map: identità delle celle/feudi, topologia e **giorni effettivi** per tratta; una sola simulazione/rotta per convoglio di più carri.
3. Trasferimento atomico di carico e oro; pedaggi/salari/foraggio per ogni giorno, rischio di imboscata e conflitti tramite Combat; solo poi arrivo al mercato del feudo destinatario.
4. Le **navi** riutilizzano i concetti `manifest/chest/cargo/escorts/route/costs`, ma avranno mezzi, accessi ai porti, equipaggi e capacità diversi. Non sono implicite nell'attuale renderer terrestre.

**Salvataggi:** `State.economy.commerce` è già salvato in locale e cloud. Schema commerce `version:3` migra le vecchie borse `purse` ai forzieri `chest` preservando senza ricontabilizzazione l'oro L4 già accantonato. `lordConvoys` e `nobleJourneys` sono registri aggiunti a creazione pigra. Regression `qa/convoys-skeleton-regression.cjs` e `qa/commerce-skeleton-regression.cjs` nella CI di economia.

**Non implementato:** partenza reale, costo viaggio addebitato, escolte visibili/combattenti, asset carri migrati, equipaggio coach, doni/tributi ricevuti da città distanti, periodicità automatica, attracco/porti e world map.
