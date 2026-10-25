// All interface strings (Italian). Add another language as a sibling file with the same keys.
export const T = {
  brand: 'Conquer',
  modes: { build: 'Costruisci', manage: 'Gestisci', defend: 'Difendi' },
  resources: { gold: 'Oro', population: 'Pop.', food: 'Cibo', wood: 'Legno', stone: 'Pietra', metal: 'Metallo', equipment: 'Equip.' },
  resourcesLong: { gold: 'Oro', population: 'Popolazione', food: 'Cibo', wood: 'Legno', stone: 'Pietra', metal: 'Metallo', equipment: 'Equipaggiamento' },
  seasons: { spring: 'Primavera', summer: 'Estate', autumn: 'Autunno', winter: 'Inverno' },
  year: 'Anno',
  time: {
    rotateLeft: 'Ruota a sinistra (Q)',
    rotateRight: 'Ruota a destra (E)',
    plan: 'Vista in pianta',
    pause: 'Pausa (Spazio)',
    speed: n => 'Velocità ' + n + '×'
  },
  profile: 'Profilo',
  dev: 'Strumenti di sviluppo',
  undo: 'Annulla ultima costruzione',
  close: 'Chiudi',
  saved: 'Salvato',
  unsaved: 'Modifiche non salvate',
  tools: {
    select: 'Seleziona',
    towers: 'Torri',
    walls: 'Mura e palizzate',
    gates: 'Porte',
    roads: 'Strada principale',
    crossings: 'Fossati e ponti',
    civic: 'Edifici civici',
    production: 'Produzione',
    terrain: 'Terreno',
    well: 'Pozzo · fonda il villaggio',
    delete: 'Demolisci'
  },
  options: {
    shape: 'Forma',
    size: 'Dimensione',
    level: 'Livello',
    tier: 'Spessore',
    height: 'Altezza',
    material: 'Materiale',
    type: 'Tipo',
    width: 'Larghezza',
    building: 'Edificio',
    masonry: 'Muratura',
    action: 'Azione',
    radius: 'Raggio'
  },
  values: {
    square: 'Quadrata', round: 'Rotonda', watchtower: 'Guardia', woodTower: 'Lignea',
    wall: 'Mura', palisade: 'Palizzata', built: 'Sezione',
    stone: 'Pietra', wood: 'Legno',
    dry: 'Fossato', water: 'Allagato', woodBridge: 'Ponte legno', stoneBridge: 'Ponte pietra',
    market: 'Mercato', tavern: 'Taverna', church: 'Chiesa', training: 'Addestramento',
    loggingCamp: 'Taglialegna', quarry: 'Cava', mine: 'Miniera', clayPit: 'Argilla', windmill: 'Mulino a vento', watermill: 'Mulino ad acqua',
    plaza: 'Piazza', brick: 'Mattoni', sloped: 'Pendio', walled: 'Terrazza murata', flat: 'Piano H0', dig: 'Scava 1U', raise: 'Alza 1U'
  },
  hints: {
    select: 'Clic su un edificio per selezionarlo',
    point: 'Clic per fissare il centro · muovi per ruotare · clic per costruire · Esc annulla',
    linear: 'Clic sul punto A · clic sul punto B · Esc annulla',
    crossing: 'Clic sulle estremità · clic sul punto di partenza o Esc per chiudere la catena',
    terrain: 'Clic per modellare il terreno · Piano H0 sottrae fino a quota 0 · Esc annulla',
    delete: 'Clic su un edificio per demolirlo'
  },
  structures: {
    towerSquare: 'Torre quadrata', towerRound: 'Torre rotonda', watchtower: 'Torre di guardia', palisadeTower: 'Torre lignea',
    gate: 'Porta in pietra', woodGate: 'Porta lignea', wall: 'Mura', palisade: 'Palizzata', built: 'Sezione costruita',
    house: 'Casa', civicAnnex: 'Annesso', market: 'Mercato', tavern: 'Taverna', church: 'Chiesa', training: 'Campo di addestramento', plaza: 'Piazza', windmill: 'Mulino a vento', watermill: 'Mulino ad acqua',
    loggingCamp: 'Campo taglialegna', quarry: 'Cava', mine: 'Miniera', moat: 'Fossato', bridge: 'Ponte', well: 'Pozzo'
  },
  inspector: {
    level: n => 'Livello ' + n,
    underConstruction: d => 'In costruzione · ' + d.toFixed(1).replace('.', ',') + ' giorni',
    completed: 'Completata',
    cost: 'Costo',
    controls: {
      tier: 'Impronta', height: 'Livelli', rotation: 'Orientamento', roof: 'Tetto', woodRoof: 'Tetto',
      base: 'Base in pietra', skin: 'Rivestimento', side: 'Lato esterno', cutaway: 'Spaccato',
      weapon: 'Arma in cima', civicLevel: 'Sviluppo', plaza: 'Variante della piazza'
    },
    words: {
      battlement: 'Merlato', machicolation: 'Caditoie', pitched: 'Falde', open: 'Piattaforma', pitched4: 'Falde · 4 pali',
      standard: 'Standard', buttress: 'Contrafforti', splayed: 'A scarpa', arcade: 'Porticato', hoarding: 'Ballatoio',
      none: 'Nessuna', mangonel: 'Mangano', ballista: 'Balista', paved: 'Lastricata', fountain: 'Fontana', garden: 'Giardino'
    },
    flip: 'Inverti', on: 'Attivo', off: 'Spento',
    rotateLeft: 'Ruota −15°', rotateRight: 'Ruota +15°', rotateFlip: 'Gira di 180°',
    facts: {
      household: 'Capienza', residents: 'Uomini · donne · bambini', rooms: 'Stanze · capacità',
      variant: 'Variante', length: 'Lunghezza', subtower: 'Agganciata a', masonry: 'Muratura'
    },
    house: 'Livello sociale', houseDown: '− Riduci', houseUp: '+ Amplia',
    mastio: 'Mastio', mastioOn: 'Mastio attivo · rimuovi', mastioOff: 'Designa come mastio',
    archers: (n, max) => 'Arcieri · ' + n + ' / ' + max,
    archerSlots: (roof, slits) => 'Tetto ' + roof + ' · feritoie ' + slits,
    roomsTitle: 'Stanze',
    roomsPending: 'Le stanze si assegnano a costruzione finita.',
    roomsNone: 'Nessuna stanza a questa impronta o altezza.',
    room: (floor, size, units) => 'Piano ' + floor + ' · ' + (size === 'large' ? 'grande' : 'normale') + ' · ' + units + '×',
    roomEmpty: '— Vuota —',
    integrity: 'Integrità',
    masonry: 'Muratura', door: 'Porta',
    workers: 'Lavoratori', owner: 'Proprietà', ownerLord: 'Signore', ownerPrivate: 'Privata (L4)',
    demolish: 'Demolisci', crossing: 'Fossato e ponte',
    masonryValues: { stone: 'Pietra', brick: 'Mattoni / argilla' },
    gate: 'Portone', gateStage: { intact: 'integro', damaged: 'danneggiato', broken: 'sfondato' },
    gateOpen: 'Aperto', gateClosed: 'Chiuso', nightClose: 'Chiusura notturna',
    gateHelp: 'Chiuso e integro blocca il passaggio; l\'ariete lo sfonda. Di notte si chiude da solo se la chiusura notturna è attiva.',
    portcullis: 'Grata', bays: n => 'Campate · ' + n, bay: i => 'Campata ' + i,
    annex: 'Annesso', annexParent: '← Edificio principale', annexHelp: 'Struttura in abbozzo: nessun lavoratore, posto letto o effetto economico.'
  },
  functions: {
    guard: 'Corpo di guardia', barracks: 'Caserma', armory: 'Armeria', storage: 'Magazzino materiali', granary: 'Granaio',
    kitchen: 'Cucina', stables: 'Scuderie', quarters: 'Alloggi', nobleRoom: 'Stanze nobili', workshop: 'Officina d\'armi',
    chapel: 'Cappella', commonHall: 'Sala comune', throneHall: 'Sala del trono', treasury: 'Tesoro', prison: 'Prigione'
  },
  manage: {
    sections: { overview: 'Panoramica', policies: 'Politiche', market: 'Mercato', activities: 'Attività', castle: 'Scorte del castello', game: 'Partita' },
    village: 'Villaggio', notFounded: 'Non ancora fondato · costruisci il pozzo',
    welfare: 'Benessere', capital: 'Capitale privato (L4)', castleGold: 'Oro del castello',
    population: 'Popolazione', classes: 'L1 · L2 · L3 · L4', wages: 'Salari L1 · L2 · L3',
    schedule: 'Lavoro lun–ven · mercato il sabato · domenica riposo. Salari mensili, rendiconti annuali.',
    lastMarket: 'Ultimo mercato', foodSold: 'Cibo venduto', unmet: 'Domanda non soddisfatta',
    events: 'Registro',
    policies: { tax: 'Tasse', rations: 'Razioni', levy: 'Leva militare' },
    privateMasonry: 'Muratura delle nuove case',
    privateMasonryHelp: 'Materiale delle case private che il villaggio costruisce da solo.',
    policyHelp: {
      tax: 'Quota sulle vendite private al mercato, incassata dal castello.',
      rations: 'Non ancora usata dalla simulazione.',
      levy: 'Non ancora usata dalla simulazione.'
    },
    goods: { food: 'Cibo', wood: 'Legno', stone: 'Pietra', clay: 'Argilla', metal: 'Metallo', equipment: 'Equipaggiamento', luxury: 'Lusso' },
    price: 'Prezzo', inMarket: 'Al mercato', inCastle: 'Nel castello', sell: 'Vendi', reserve: 'Riserva',
    marketHelp: 'Vendi: quota della produzione del signore messa sul mercato. Riserva: scorta che il castello trattiene.',
    owner: { lord: 'Signore', private: 'Privata' },
    value: 'Valore', workers: 'Lavoratori', profit: 'Utile',
    buy: 'Compra per il signore', sellL4: 'Vendi ai privati', abandoned: 'Abbandonata',
    noActivities: 'Nessuna attività produttiva ancora attiva.',
    activityTypes: { field: 'Campo', loggingCamp: 'Taglialegna', quarry: 'Cava', mine: 'Miniera', workshop: 'Officina', vineyard: 'Vigneto' },
    stores: { food: 'Cibo', materials: 'Materiali', equipment: 'Armi', horses: 'Cavalli', gold: 'Oro' },
    autonomy: 'Autonomia', days: n => n == null ? '∞' : n + ' giorni', dailyNeed: 'Consumo giornaliero',
    capacity: 'Cucina · caserme · cavalieri', shortfall: d => 'Scorte insufficienti da ' + d.toFixed(1).replace('.', ',') + ' giorni',
    storeHelp: 'Ogni clic sposta fino a 50 unità dalle risorse del villaggio. La capienza dipende dalle stanze.',
    store: 'Deposita', seed: 'Seme della mappa', biome: 'Bioma', save: 'Salva sul cloud',
    saveHelp: 'Il salvataggio locale è automatico. Il cloud si attiva con un account.',
    biomes: { plains: 'Pianura', hills: 'Colline', valley: 'Vallata', river: 'Fiume', forest: 'Foresta', mountains: 'Montagne', sea: 'Mare' }
  },
  manageTitle: 'Insediamento',
  defendTitle: 'Difesa',
  noVillage: 'Villaggio non fondato'
};
