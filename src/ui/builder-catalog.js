// Pure construction read model: only snapshots and localized labels, no DOM or simulation.
import { T } from './i18n-it.js?v=ui2-insp-2-wallpatrol2-alerts3-upg2-fieldworks1-wallmoat1-l2shop1-shopl3a';

/**
 * Plain command union shared by both Builder adapters; never a selector or DOM node.
 * @typedef {{tool:'select'|'delete',label?:string}|{tower:string,size:number|string}|
 * {woodTower:string}|{mainRoad:string}|{terraform:string}|{terraformShape:string}|
 * {terraformDelta:number|string}|{terraformRadius:number|string}|{crossing:string}|
 * {crossingWidth:number|string}|{linear:string}|{leanMaterial:'wood'|'stone'|'brick'}|
 * {towerLevel:number|string}|{wallTier:number|string}|{wallLevel:number|string}|
 * {gateLevel:number|string}|{gate:string,gateSize?:number|string}|{woodGate:string}|
 * {civic:string}|{storageYard:string}|{industry:string,extractionMode?:string}|
 * {eventVenue:string}|{pier:number|string,yard?:number|string}|{slopeway:string}|
 * {quay:string}|{well:string}|{buildMasonry:'stone'|'brick'}|
 * {privateMasonry:'stone'|'brick'}} BuilderCommand
 */

const V = T.values, O = T.options;
/** @param {string} label @param {BuilderCommand} command @param {boolean} active */
const opt = (label, command, active) => ({ label, command, active });
// Masonry of the next stone/brick sites (State.buildMasonryMaterial), shared by every masonry tool.
const masonryRow = s => ({ label: O.masonry, options: [
  opt(V.stone, {buildMasonry:"stone"}, s.masonry === 'stone'),
  opt(V.brick, {buildMasonry:"brick"}, s.masonry === 'brick')] });
const INDUSTRIES = [
  ['loggingCamp', {industry:"loggingCamp"}, t => t.industry === 'loggingCamp'],
  ['quarry', {industry:"quarry"}, t => t.industry === 'quarry' && t.extraction !== 'clay'],
  ['clayPit', {industry:"quarry",extractionMode:"clay"}, t => t.industry === 'quarry' && t.extraction === 'clay'],
  ['mine', {industry:"mine"}, t => t.industry === 'mine'],
  ['windmill', {industry:"windmill"}, t => t.industry === 'windmill'],
  ['watermill', {industry:"watermill"}, t => t.industry === 'watermill']
];
const WELL_UPGRADES = ['townhall', 'guild', 'bargello'];
export const CATALOG = [
  { id: 'select', hint: T.hints.select, command: {tool:"select"}, is: s => s.tool.kind === 'select' },
  { id: 'towers', hint: T.hints.point, command: {tower:"square",size:"1.5"}, is: s => s.tool.kind === 'tower',
    rows: s => {
      const t = s.tool, stone = t.material !== 'wood';
      const rows = [{ label: O.shape, options: [
        opt(V.square, {tower:"square",size:"1.5"}, stone && t.shape === 'square'),
        opt(V.round, {tower:"round",size:"0.75"}, stone && t.shape === 'round'),
        opt(V.half, {tower:"half",size:"1"}, stone && t.shape === 'half'),
        opt(V.dee, {tower:"dee",size:"1.5"}, stone && t.shape === 'dee'),
        opt(V.watchtower, {woodTower:"watchtower"}, t.woodStyle === 'watchtower'),
        opt(V.woodTower, {woodTower:"palisadeTower"}, t.woodStyle === 'palisadeTower'),
        opt(V.frameTower || 'Telaio H2', {woodTower:"frameTower"}, t.woodStyle === 'frameTower')] }];
      if (stone && t.shape === 'square') rows.push({ label: O.size, options: ['1', '1.5', '2', '3'].map(n =>
        opt(n.replace('.', ',') + 'U', {tower:"square",size:n}, Number(t.size) === Number(n))) });
      if (stone && t.shape === 'round') rows.push({ label: O.size, options: ['0.5', '0.75', '1'].map(n =>
        opt('R ' + n.replace('.', ','), {tower:"round",size:n}, Number(t.size) === Number(n))) });
      if (stone && t.shape === 'half') rows.push({ label: O.size, options: [['1', V.small], ['1.5', V.medium]].map(([n, l]) =>
        opt(l, {tower:"half",size:n}, Number(t.size) === Number(n))) });
      if (stone && t.shape === 'dee') rows.push({ label: O.size, options: [['1.5', V.medium], ['2', V.large]].map(([n, l]) =>
        opt(l, {tower:"dee",size:n}, Number(t.size) === Number(n))) });
      if (stone) rows.push({ label: O.level, options: [1, 2, 3].map(n => opt(String(n), {towerLevel:n}, s.levels.tower === n)) });
      if (stone) rows.push(masonryRow(s));
      return rows;
    } },
  { id: 'walls', hint: T.hints.linear, command: {linear:"wall"}, is: s => (s.tool.kind === 'linear' && s.tool.linear !== 'road') || s.tool.kind === 'leanTo',
    rows: s => {
      const kind = s.tool.linear, lean = s.tool.kind === 'leanTo', wide = kind === 'built' && s.tool.span === 'wide', wood = kind === 'built' && s.tool.material === 'wood', rows = [{ label: O.type, options: [
        opt(V.wall, {linear:"wall"}, kind === 'wall'),
        opt(V.palisade, {linear:"palisade"}, kind === 'palisade'),
        opt(V.built, {linear:"built"}, kind === 'built' && !wide && !wood && !lean),
        opt(V.builtWide, {linear:"builtWide"}, wide && !wood),
        opt(V.longhouse, {linear:"longhouse"}, wood && !wide),
        opt(V.longhouseWide, {linear:"longhouseWide"}, wood && wide),
        opt(V.leanTo, {linear:"leanTo"}, lean)] }];
      if (lean) return [...rows, { label: O.material, options: [['wood', V.leanWood], ['stone', V.leanStone], ['brick', V.leanBrick]].map(([m, l]) => opt(l, {leanMaterial:m}, (s.tool.leanMaterial || 'wood') === m)) }];
      if (kind !== 'built') rows.push({ label: O.tier, options: [1, 2, 3].map(n => opt('T' + n, {wallTier:n}, s.levels.wallTier === n)) });
      if (kind !== 'palisade' && !wood) rows.push({ label: O.height, options: [1, 2].map(n => opt(String(n), {wallLevel:n}, (wide ? s.levels.builtWide : s.levels.wall) === n)) });
      if (kind !== 'palisade' && !wood) rows.push(masonryRow(s));
      return rows;
    } },
  { id: 'gates', hint: T.hints.point, command: {gate:""}, is: s => s.tool.kind === 'gate',
    rows: s => {
      const stone = s.tool.material !== 'wood', rows = [{ label: O.material, options: [
        opt(V.stone, {gate:""}, stone), opt(V.wood, {woodGate:""}, !stone)] }];
      const small = stone && Number(s.tool.size) < 1.25;
      if (stone) rows.push({ label: O.size, options: [['1.5', V.large], ['1', V.small]].map(([n, l]) =>
        opt(l, {gate:"",gateSize:n}, (Number(s.tool.size) || 1.5) === Number(n))) });
      if (stone) rows.push({ label: O.height, options: (small ? [1, 2] : [1, 2, 3]).map(n => opt('L' + n, {gateLevel:n}, s.levels.gate === n)) });
      if (stone) rows.push(masonryRow(s));
      return rows;
    } },
  { id: 'terrain', hint: T.hints.terrain, command: {terraform:"terrain"}, is: s => s.tool.kind === 'terraform',
    rows: s => {
      const t = s.tool, rows = [
        { label: O.type, options: [
          opt(V.sloped, {terraform:"terrain"}, t.mode === 'terrain'),
          opt(V.walled, {terraform:"walled"}, t.mode === 'walled'),
          opt(V.flat, {terraform:"flat"}, t.mode === 'flat')] },
        { label: O.shape, options: [
          opt(V.round, {terraformShape:"round"}, (t.shape || s.terraform.shape) === 'round'),
          opt(V.square, {terraformShape:"square"}, (t.shape || s.terraform.shape) === 'square')] }];
      if (t.mode !== 'flat') rows.push({ label: O.action, options: [
        opt(V.dig, {terraformDelta:"-1"}, (t.delta ?? s.terraform.delta) < 0),
        opt(V.raise, {terraformDelta:"1"}, (t.delta ?? s.terraform.delta) > 0)] });
      rows.push({ label: O.radius, options: [2, 4, 6].map(n => opt('R' + n, {terraformRadius:n}, (t.radius ?? s.terraform.radius) === n)) });
      return rows;
    } },
  { id: 'roads', hint: T.hints.linear, command: {mainRoad:""}, is: s => s.tool.kind === 'linear' && s.tool.linear === 'road' },
  { id: 'crossings', hint: T.hints.crossing, command: {crossing:"dry"}, is: s => ['crossing', 'pier', 'quay', 'slopeway'].includes(s.tool.kind),
    rows: s => {
      const rows = [{ label: O.type, wrap: true, options: [
        opt(V.dry, {crossing:"dry"}, s.tool.crossing === 'dry'),
        opt(V.water, {crossing:"water"}, s.tool.crossing === 'water'),
        opt(V.woodBridge, {crossing:"wood"}, s.tool.crossing === 'wood'),
        opt(V.stoneBridge, {crossing:"stone"}, s.tool.crossing === 'stone'),
        opt(V.pier + ' L4', {pier:"4"}, s.tool.kind === 'pier' && s.tool.reach === 4),
        opt(V.pier + ' L12', {pier:"12"}, s.tool.kind === 'pier' && s.tool.reach === 12),
        opt(V.quay, {quay:""}, s.tool.kind === 'quay'),
        opt(V.ramp, {slopeway:"ramp"}, s.tool.kind === 'slopeway' && s.tool.slopeway === 'ramp'),
        opt(V.stairway, {slopeway:"stairway"}, s.tool.kind === 'slopeway' && s.tool.slopeway === 'stairway')] }];
      if (s.tool.kind === 'crossing') rows.push({ label: O.width, options: [1, 2, 3].map(n => opt(n + 'U', {crossingWidth:n}, s.crossingWidth === n)) });
      return rows;
    } },
  { id: 'civic', hint: T.hints.point, command: {civic:"market"}, is: s => s.tool.kind === 'civic',
    // Town hall, guild hall and bargello are well upgrades: they start from the well's inspector.
    rows: s => WELL_UPGRADES.includes(s.tool.civic) ? [masonryRow(s)] : [{ label: O.building, options: ['market', 'tavern', 'church', 'training', 'plaza', 'balivo'].map(k =>
      opt(V[k], {civic:k}, s.tool.civic === k)) }, masonryRow(s)] },
  { id: 'production', hint: T.hints.point, command: {industry:"loggingCamp"}, is: s => s.tool.kind === 'industry',
    rows: s => [{ label: O.building, wrap: true, options: INDUSTRIES.map(([k, command, on]) => opt(V[k], command, on(s.tool))) }, masonryRow(s)] },
  { id: 'well', hint: T.hints.point, command: {well:""}, is: s => s.tool.kind === 'well', rows: s => [masonryRow(s)] },
  { id: 'justice', hint: T.hints.point, command: {eventVenue:"pillory"}, is: s => s.tool.kind === 'event' && ['pillory', 'gallows', 'scaffold'].includes(s.tool.venue),
    rows: s => [{ label: O.building, options: ['pillory', 'gallows', 'scaffold'].map(k => opt(V[k], {eventVenue:k}, s.tool.venue === k)) }] },
  // Field works already owned by the venue module on main.
  { id: 'fieldworks', hint: T.hints.point, command: {eventVenue:'stakeRow'}, is: s => s.tool.kind === 'event' && ['stakeRow', 'chevalFrise', 'armyCamp'].includes(s.tool.venue),
    rows: s => [{ label: O.building, options: ['stakeRow', 'chevalFrise', 'armyCamp'].map(k => opt(V[k], {eventVenue:k}, s.tool.venue === k)) }] },
  { id: 'delete', hint: T.hints.delete, command: {tool:"delete"}, is: s => s.tool.kind === 'delete' }
];
export const activeEntry = snap => CATALOG.find(e => e.is(snap)) || CATALOG[0];
