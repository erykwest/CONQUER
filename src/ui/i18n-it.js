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
    building: 'Edificio'
  },
  values: {
    square: 'Quadrata', round: 'Rotonda', watchtower: 'Guardia', woodTower: 'Lignea',
    wall: 'Mura', palisade: 'Palizzata', built: 'Sezione',
    stone: 'Pietra', wood: 'Legno',
    dry: 'Fossato', water: 'Allagato', woodBridge: 'Ponte legno', stoneBridge: 'Ponte pietra',
    market: 'Mercato', tavern: 'Taverna', church: 'Chiesa', training: 'Addestramento',
    loggingCamp: 'Taglialegna', quarry: 'Cava', mine: 'Miniera'
  },
  hints: {
    select: 'Clic su un edificio per selezionarlo',
    point: 'Clic per fissare il centro · muovi per ruotare · clic per costruire · Esc annulla',
    linear: 'Clic sul punto A · clic sul punto B · Esc annulla',
    crossing: 'Clic sulle estremità · clic sul punto di partenza o Esc per chiudere la catena',
    delete: 'Clic su un edificio per demolirlo'
  },
  structures: {
    towerSquare: 'Torre quadrata', towerRound: 'Torre rotonda', watchtower: 'Torre di guardia', palisadeTower: 'Torre lignea',
    gate: 'Porta in pietra', woodGate: 'Porta lignea', wall: 'Mura', palisade: 'Palizzata', built: 'Sezione costruita',
    house: 'Casa', market: 'Mercato', tavern: 'Taverna', church: 'Chiesa', training: 'Campo di addestramento',
    loggingCamp: 'Campo taglialegna', quarry: 'Cava', mine: 'Miniera', moat: 'Fossato', bridge: 'Ponte', well: 'Pozzo'
  },
  inspector: {
    level: n => 'Livello ' + n,
    underConstruction: d => 'In costruzione · ' + d.toFixed(1).replace('.', ',') + ' giorni',
    completed: 'Completata',
    cost: 'Costo',
    controls: {
      tier: 'Impronta', height: 'Livelli', rotation: 'Orientamento', roof: 'Tetto', woodRoof: 'Tetto',
      base: 'Base in pietra', skin: 'Rivestimento', side: 'Lato esterno', cutaway: 'Spaccato'
    },
    words: {
      battlement: 'Merlato', machicolation: 'Caditoie', pitched: 'Falde', open: 'Piattaforma', pitched4: 'Falde · 4 pali',
      standard: 'Standard', buttress: 'Contrafforti', splayed: 'A scarpa', arcade: 'Porticato', hoarding: 'Ballatoio'
    },
    flip: 'Inverti', on: 'Attivo', off: 'Spento',
    rotateLeft: 'Ruota −15°', rotateRight: 'Ruota +15°', rotateFlip: 'Gira di 180°',
    facts: {
      household: 'Capienza', residents: 'Uomini · donne · bambini', rooms: 'Stanze · capacità',
      variant: 'Variante', length: 'Lunghezza', subtower: 'Agganciata a'
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
    demolish: 'Demolisci', crossing: 'Fossato e ponte'
  },
  functions: {
    guard: 'Corpo di guardia', barracks: 'Caserma', armory: 'Armeria', storage: 'Magazzino materiali', granary: 'Granaio',
    kitchen: 'Cucina', stables: 'Scuderie', quarters: 'Alloggi', nobleRoom: 'Stanze nobili', workshop: 'Officina d\'armi',
    chapel: 'Cappella', commonHall: 'Sala comune', throneHall: 'Sala del trono', treasury: 'Tesoro', prison: 'Prigione'
  },
  manageTitle: 'Insediamento',
  defendTitle: 'Difesa',
  noVillage: 'Villaggio non fondato'
};
