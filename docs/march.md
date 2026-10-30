# CONQUER — MARCH (modalità attacco)

Stato: **skeleton V0 su branch feature/march-skeleton**, 30 ottobre 2026.
Pagina: /march/ (file march/index.html). Non è un nuovo motore economico o un nuovo mondo persistente.

## Decisioni di design approvate

- Il giocatore può controllare una compagnia militare itinerante, anziché gestire direttamente un feudo.
- La compagnia si sposta nella World Map; raggiungendo un feudo ostile può razziare o assediare.
- **L'invasione è interrompibile in qualsiasi momento**: razzie e danni parziali rimangono anche quando l'esercito riparte.
- Espugnare il castello non implica annetterlo. **Conquista e amministrazione sono volontarie**.
- La campagna militare può proseguire dopo la conquista di uno o più feudi.
- I due stili di gioco usano lo **stesso stato persistente** del mondo quando World/Feudal sarà integrato.

## Cosa contiene concretamente lo skeleton

- Interfaccia HTML autonoma, mappa schematica a celle, quattro feudi **fixture demo**.
- Compagnia con roster statico, rifornimenti e capacità di bottino; ordini di marcia a tappe.
- Stato operazione: approach → raiding e/o siege → breached (esito ricevuto) → conquer o withdraw.
- Razzia che sottrae da scorte effettive **della fixture**, accumula bottino, registra danni civili parziali.
- Ritiro in qualsiasi fase; nessun reset dei danni/scorte, nessuna conquista per semplice assedio.
- Conquista consentita **soltanto** dopo esito di assalto favorevole (in V0: bottone esplicito di test).
- Save/load locale separato: chiave browser conquer.march.prototype.v1; non tocca il save del Builder.
- Regressione qa/march-regression.cjs: route, razzia, ritirata, assedio, annessione facoltativa, persistenza.

## Confine tecnico — ciò che NON è ancora collegato

1. **World/Feudal:** la mappa 9×7 è *solo un mock*. In futuro servirà un adapter che legga ID, coordinate, terreno percorribile, proprietari e scorte dai feudi reali, senza generare una seconda mappa.
2. **Combat:** il roster V0 è un dato di scenario, non un insieme di unità e perdite reali; non esiste ancora il passaggio World → Combat.
3. **Siege:** nessun risultato inventato: il comando «Esito assalto: successo (TEST)» sostituisce temporaneamente l'evento verificato di un assalto nel sistema già esistente ConquerSiege/ConquerCombat. Attesa, fame e resa automatica rimangono assenti.
4. **Economia:** scorte e danni delle fixture appartengono solo allo scenario MARCH; in produzione l'autorità sarebbe il ledger del feudo e l'integrità localizzata delle strutture. Non duplicare stock reali in un secondo motore.
5. **Camp/strutture:** bivacco, accampamento e macchine d'assedio devono riusare i sottosistemi già presenti e il lavoro dedicato, non queste fixture.

## Contratto proposto per la prossima integrazione

- Company: id, ownerId, commanderId, rosterRefs, position, route, carriedStock, provisions, morale.
- MilitaryOperation: id, companyId, targetFiefId, stage, startedAtDay, siegeRef (facoltativo).
- Eventi del dominio condiviso: movement-arrived, raid-resolved, siege-started, assault-resolved, operation-withdrawn, fief-annexed.
- **raid-resolved** registra delta di inventario e danni strutturali/civili in una transazione del feudo; **operation-withdrawn** cancella solo i comandi dell'operazione, non i suoi effetti.
- **assault-resolved(victory)** non cambia owner; **fief-annexed** è un comando esplicito successivo.
- Persistenza e velocità del mondo condivise, inclusa simulazione fuori vista; il layer MARCH legge e invia ordini, non ricrea l'economia.

## Criteri di accettazione per la V1 integrata

- Feudo danneggiato e saccheggiato conserva scorte e integrità nel Builder dopo ritirata.
- Assedio interrotto non causa resa/conquista retroattiva.
- Espugnazione + scelta «non annettere» lascia invariata la proprietà del feudo.
- Espugnazione + scelta «annettere» aggiorna un unico ownerId riconosciuto da World/Feudo e la compagnia continua a muoversi.
- Le perdite militari, gli assalti e il bottino provengono dai motori condivisi, con salvataggio unico e QA end-to-end.
