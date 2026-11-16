---
kind: guide
---

# Guida Editoriale

Questo vault contiene i testi di CONQUER: edifici, stanze, unità e meccaniche. Il punto di partenza è [[CONQUER Index]]. I collegamenti e i backlink sostituiscono le cartelle di organizzazione.

## Scrivere Una Scheda

Apri una nota, per esempio [[Torre]], e modifica descrizione, funzionamento o consigli. Mantieni il suo `codex_id`: identifica la voce anche quando cambia il titolo. Non copiare prezzi o statistiche nelle proprietà: arrivano dal catalogo del gioco.

I link si scrivono con doppie parentesi: `[[Fortificazioni]]`. Per cambiare il testo visibile usa `[[Fortificazioni|difese del castello]]`. Sono supportati anche link a sezioni, ad esempio `[[Torre#Funzionamento|come funziona]]`, quando quella sezione esiste.

Usa titoli `##` e `###`, paragrafi, elenchi semplici, **grassetto**, *corsivo* e testo tra backtick. HTML viene mostrato come testo. Embed, blocchi di codice e liste annidate non sono supportati dal pubblicatore.

## Proprietà

- `codex_id`: ID stabile della scheda o della meccanica. Non modificarlo per rinominare una pagina.
- `kind`: entry per un elemento del gioco, category per una famiglia, topic per una meccanica o sovracategoria.
- `title`: titolo visibile nella Wiki.
- `editorial_status`: draft (bozza), review (da verificare), approved (approvato e pubblicabile).
- `aliases`: nomi alternativi e keywords, modificabili anche come lista nel pannello proprietà di Obsidian.

Le note di tipo guide, index e template non vengono pubblicate. Le note draft/review restano fuori dall'artefatto Wiki. Ogni elemento del catalogo deve mantenere una scheda approvata per pubblicare una versione completa; un link approvato non può puntare a una bozza o a una pagina mancante.

## Collegamenti E Indici

Le sezioni finali `## Collegamenti` e `## Voci` contengono soltanto elenchi di wikilink. Collegamenti aggiunge relazioni editoriali; Voci elenca le schede raccolte in una pagina di meccanica. Le famiglie sono ricavate automaticamente dal catalogo del gioco.

I nomi dei file sono in Title Case. Per una nuova pagina duplica [[Modello Scheda]], cambia kind da template a topic, scegli un ID `topic:` unico e lascia draft finché non è verificata. Per un nuovo edificio serve prima una voce nel catalogo del gioco: una nota non crea una meccanica.

## Pubblicazione

Il vault personale è la fonte di scrittura. Il comando `node tools/import-codex-vault.cjs` importa le note nel repository e rigenera i testi della Wiki, senza riscrivere il vault. Le modifiche passano poi da revisione Git e CI. `node tools/export-codex-content.cjs` rigenera soltanto la copia già importata nel repository. Il controllo `--check` verifica che l'artefatto sia aggiornato. La CI verifica metadati, ID, link, sezioni e stato editoriale; le modifiche passano dal normale branch/PR, senza pubblicazione automatica da Obsidian.

Obsidian modifica le note Markdown; non serve Obsidian Publish, un account o un plugin esterno. Costi, tempi, compatibilità e salvataggi restano nelle sorgenti del gioco.

## Collegamenti

- [[CONQUER Index]]
- [[Modello Scheda]]
- [[Torre]]
- [[Fortificazioni]]
