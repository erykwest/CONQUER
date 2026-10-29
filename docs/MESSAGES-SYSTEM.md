# CONQUER — Messaggistica feudale (branch messages)

## Contratto V1

Una lettera è un evento del tempo simulato con origine, destinazione, genere, trasporto, giorno di redazione, ETA e stato. Il destinatario riceve una **istantanea**, non una lettura in tempo reale dell'altro feudo.

- Nodi disponibili: capitale locale (court) e quattro feudi cardinali astratti (north/east/south/west), in coerenza con il sistema diplomatico. Comunicazioni fra due province esterne escluse finché non esiste la World Map.
- **Messaggero:** disponibile dopo la fondazione; tempo convenzionale minimo 1 giorno, distanza astratta / 22 U-giorno. Non è ancora un'entità fisica intercettabile; la mobilità dei corrieri di ConquerDiplomacy è il futuro punto di integrazione.
- **Piccione:** entrambe le estremità devono avere la piccionaia; /160 U-giorno, minimo 0,25 giorni; con temporale alla partenza il tempo raddoppia. La piccionaia della capitale è una funzione di torre/Built Section completata, e i feudi esterni hanno temporaneamente un flag impostabile nel pannello Rete.
- **Ordine / rapporto / allarme:** categorie distinte. L'ordine viene consegnato, ma non modifica automaticamente strutture o politiche dei feudi esterni astratti.
- **Routine:** sorgente, destinazione, frequenza (1/7/30 giorni), canale e sezioni. Un report viene redatto al tempo di simulazione effettivo; salti temporali non generano falsi rapporti arretrati. Errori di rete sono riportati sulla routine e ritentati al ciclo successivo.
- **Dati reali:** le routine della capitale leggono State.economy, risorse e costruzioni; i dati militari non disponibili non vengono inventati. I rapporti delle province esterne, non ancora simulate, indicano esplicitamente che mancano dati.
- **Persistenza:** State.messages versione 1, nel salvataggio locale e in policies.messages di Supabase; reset sul comando Nuova mappa. Messaggi in transito conservati.
- **UI:** Posta feudale nel Builder, ricevuti/inviati, routine, rete delle piccionaie, conteggio non letti.

## Integrazioni e limiti attuali

La World Map, le rotte effettive e l'intercettazione dei messaggeri non sono ancora disponibili. La distanza è convenzionale; la UI non deve dichiarare una consegna fisicamente rappresentata. Occorrerà collegare i nodi a feudi realmente simulati e unificare i movimenti con ConquerDiplomacy/carovane, senza duplicare unità. Non è ancora implementata la risposta del destinatario a un ordine.

## QA

Eseguire: node qa/messages-regression.cjs. Copre vettori, ETA, consegna non anticipata, report immutabili, routine, salti temporali, reset e salvataggi; preservare qa/diplomacy-regression.cjs.

La presenza del file QA non costituisce prova di esecuzione: registrare separatamente i risultati CI o locali.
