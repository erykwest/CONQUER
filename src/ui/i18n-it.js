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
  manageTitle: 'Insediamento',
  defendTitle: 'Difesa',
  noVillage: 'Villaggio non fondato'
};
