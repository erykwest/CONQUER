// CONQUER interface v2 ("Isole"): floating wood-and-gold tablets over a full-bleed map.
// Opt-in with ?ui=2 (persisted; ?ui=1 goes back). Reads the game only through window.ConquerGame.
import { html, render, useState, useEffect, useRef } from '../vendor/htm-preact-3.1.1.js';
import { T } from './i18n-it.js';

const STORE_KEY = 'conquer.ui.v2', MODE_KEY = 'conquer.ui.mode', DEV_KEY = 'conquer.dev';
const params = new URLSearchParams(location.search);
const remember = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const recall = key => { try { return localStorage.getItem(key); } catch { return null; } };
if (params.has('ui')) remember(STORE_KEY, params.get('ui') === '2' ? '1' : '0');
if (params.has('dev')) remember(DEV_KEY, params.get('dev') === '1' ? '1' : '0');
const enabled = recall(STORE_KEY) === '1' && window.ConquerGame;
const devEnabled = recall(DEV_KEY) === '1';

// ---------- icons (stroke paths, 24×24) ----------
const ICON = {
  select: 'M5 3l13 7-6 2-2 6z',
  towers: 'M6 21V9h12v12M6 9V5h2v2h2V5h4v2h2V5h2v4M10 21v-4h4v4',
  walls: 'M3 20V10h18v10M3 10V7h3v3M9 10V7h3v3M15 10V7h3v3M3 15h18',
  gates: 'M4 21V6h16v15M9 21v-6a3 3 0 0 1 6 0v6',
  roads: 'M8 21l3-18M16 21l-3-18M12 8v2M12 14v2',
  crossings: 'M3 15h18M5 15v4M19 15v4M3 15a9 6 0 0 1 18 0',
  civic: 'M4 21V10l8-6 8 6v11M9 21v-6h6v6',
  production: 'M12 21V9M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zM12 14c3 0 5-2 5-5-3 0-5 2-5 5z',
  well: 'M5 10h14M7 10v10h10V10M8 10V5h8v5',
  terrain: 'M2 19l6-8 4 5 3-4 7 7zM14 6h6M17 3v6',
  delete: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  rotateLeft: 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5',
  rotateRight: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
  plan: 'M4 4h16v16H4zM4 12h16M12 4v16',
  shield: 'M6 3h12v8c0 5-6 10-6 10S6 16 6 11z',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  overview: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4',
  policies: 'M12 3v18M6 21h12M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z',
  market: 'M4 10l2-6h12l2 6M4 10h16M6 10v10h12V10M10 20v-5h4v5',
  activities: 'M14 6l4 4M4 20l9-9M12 4l8 8-3 3-8-8z',
  castle: 'M4 21V9h3V5h3v4h4V5h3v4h3v12M4 14h16M10 21v-4h4v4',
  game: 'M5 3h12l4 4v14H3V3h2M7 3v6h9V3M7 21v-7h10v7'
};
const Icon = ({ name, size = 20 }) => html`
  <svg class="u2-icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${ICON[name]}></path></svg>`;

// ---------- build catalog: each entry drives a legacy control in phase 1 ----------
const V = T.values, O = T.options;
const opt = (label, selector, active) => ({ label, selector, active });
// Masonry of the next stone/brick sites (State.buildMasonryMaterial), shared by every masonry tool.
const masonryRow = s => ({ label: O.masonry, options: [
  opt(V.stone, '[data-build-masonry="stone"]', s.masonry === 'stone'),
  opt(V.brick, '[data-build-masonry="brick"]', s.masonry === 'brick')] });
const INDUSTRIES = [
  ['loggingCamp', '[data-industry="loggingCamp"]', t => t.industry === 'loggingCamp'],
  ['quarry', '[data-industry="quarry"]:not([data-extraction-mode])', t => t.industry === 'quarry' && t.extraction !== 'clay'],
  ['clayPit', '[data-industry="quarry"][data-extraction-mode="clay"]', t => t.industry === 'quarry' && t.extraction === 'clay'],
  ['mine', '[data-industry="mine"]', t => t.industry === 'mine'],
  ['windmill', '[data-industry="windmill"]', t => t.industry === 'windmill'],
  ['watermill', '[data-industry="watermill"]', t => t.industry === 'watermill']
];
const CATALOG = [
  { id: 'select', hint: T.hints.select, press: '[data-tool="select"]', is: s => s.tool.kind === 'select' },
  { id: 'towers', hint: T.hints.point, press: '[data-tower="square"][data-size="1.5"]', is: s => s.tool.kind === 'tower',
    rows: s => {
      const t = s.tool, stone = t.material !== 'wood';
      const rows = [{ label: O.shape, options: [
        opt(V.square, '[data-tower="square"][data-size="1.5"]', stone && t.shape === 'square'),
        opt(V.round, '[data-tower="round"][data-size="0.75"]', stone && t.shape === 'round'),
        opt(V.watchtower, '[data-wood-tower="watchtower"]', t.woodStyle === 'watchtower'),
        opt(V.woodTower, '[data-wood-tower="palisadeTower"]', t.woodStyle === 'palisadeTower')] }];
      if (stone && t.shape === 'square') rows.push({ label: O.size, options: ['1', '1.5', '2'].map(n =>
        opt(n.replace('.', ',') + 'U', `[data-tower="square"][data-size="${n}"]`, Number(t.size) === Number(n))) });
      if (stone && t.shape === 'round') rows.push({ label: O.size, options: ['0.5', '0.75', '1'].map(n =>
        opt('R ' + n.replace('.', ','), `[data-tower="round"][data-size="${n}"]`, Number(t.size) === Number(n))) });
      if (stone) rows.push({ label: O.level, options: [1, 2, 3].map(n => opt(String(n), `[data-tower-level="${n}"]`, s.levels.tower === n)) });
      if (stone) rows.push(masonryRow(s));
      return rows;
    } },
  { id: 'walls', hint: T.hints.linear, press: '[data-linear="wall"]', is: s => s.tool.kind === 'linear' && s.tool.linear !== 'road',
    rows: s => {
      const kind = s.tool.linear, rows = [{ label: O.type, options: [
        opt(V.wall, '[data-linear="wall"]', kind === 'wall'),
        opt(V.palisade, '[data-linear="palisade"]', kind === 'palisade'),
        opt(V.built, '[data-linear="built"]', kind === 'built')] }];
      if (kind !== 'built') rows.push({ label: O.tier, options: [1, 2, 3].map(n => opt('T' + n, `[data-wall-tier="${n}"]`, s.levels.wallTier === n)) });
      if (kind !== 'palisade') rows.push({ label: O.height, options: [1, 2].map(n => opt(String(n), `[data-wall-level="${n}"]`, s.levels.wall === n)) });
      if (kind !== 'palisade') rows.push(masonryRow(s));
      return rows;
    } },
  { id: 'gates', hint: T.hints.point, press: '[data-gate]', is: s => s.tool.kind === 'gate',
    rows: s => {
      const stone = s.tool.material !== 'wood', rows = [{ label: O.material, options: [
        opt(V.stone, '[data-gate]', stone), opt(V.wood, '[data-wood-gate]', !stone)] }];
      if (stone) rows.push({ label: O.height, options: [1, 2, 3].map(n => opt('L' + n, `[data-gate-level="${n}"]`, s.levels.gate === n)) });
      if (stone) rows.push(masonryRow(s));
      return rows;
    } },
  { id: 'terrain', hint: T.hints.terrain, press: '[data-terraform="terrain"]', is: s => s.tool.kind === 'terraform',
    rows: s => {
      const t = s.tool, rows = [
        { label: O.type, options: [
          opt(V.sloped, '[data-terraform="terrain"]', t.mode === 'terrain'),
          opt(V.walled, '[data-terraform="walled"]', t.mode === 'walled'),
          opt(V.flat, '[data-terraform="flat"]', t.mode === 'flat')] },
        { label: O.shape, options: [
          opt(V.round, '[data-terraform-shape="round"]', (t.shape || s.terraform.shape) === 'round'),
          opt(V.square, '[data-terraform-shape="square"]', (t.shape || s.terraform.shape) === 'square')] }];
      if (t.mode !== 'flat') rows.push({ label: O.action, options: [
        opt(V.dig, '[data-terraform-delta="-1"]', (t.delta ?? s.terraform.delta) < 0),
        opt(V.raise, '[data-terraform-delta="1"]', (t.delta ?? s.terraform.delta) > 0)] });
      rows.push({ label: O.radius, options: [2, 4, 6].map(n => opt('R' + n, `[data-terraform-radius="${n}"]`, (t.radius ?? s.terraform.radius) === n)) });
      return rows;
    } },
  { id: 'roads', hint: T.hints.linear, press: '[data-main-road]', is: s => s.tool.kind === 'linear' && s.tool.linear === 'road' },
  { id: 'crossings', hint: T.hints.crossing, press: '[data-crossing="dry"]', is: s => s.tool.kind === 'crossing',
    rows: s => [
      { label: O.type, options: [
        opt(V.dry, '[data-crossing="dry"]', s.tool.crossing === 'dry'),
        opt(V.water, '[data-crossing="water"]', s.tool.crossing === 'water'),
        opt(V.woodBridge, '[data-crossing="wood"]', s.tool.crossing === 'wood'),
        opt(V.stoneBridge, '[data-crossing="stone"]', s.tool.crossing === 'stone')] },
      { label: O.width, options: [1, 2, 3].map(n => opt(n + 'U', `[data-crossing-width="${n}"]`, s.crossingWidth === n)) }] },
  { id: 'civic', hint: T.hints.point, press: '[data-civic="market"]', is: s => s.tool.kind === 'civic',
    rows: s => [{ label: O.building, options: ['market', 'tavern', 'church', 'training', 'plaza'].map(k =>
      opt(V[k], `[data-civic="${k}"]`, s.tool.civic === k)) }, masonryRow(s)] },
  { id: 'production', hint: T.hints.point, press: '[data-industry="loggingCamp"]', is: s => s.tool.kind === 'industry',
    rows: s => [{ label: O.building, wrap: true, options: INDUSTRIES.map(([k, selector, on]) => opt(V[k], selector, on(s.tool))) }, masonryRow(s)] },
  { id: 'well', hint: T.hints.point, press: '[data-well]', is: s => s.tool.kind === 'well', rows: s => [masonryRow(s)] },
  { id: 'delete', hint: T.hints.delete, press: '[data-tool="delete"]', is: s => s.tool.kind === 'delete' }
];
const activeEntry = snap => CATALOG.find(e => e.is(snap)) || CATALOG[0];
const fmt = n => Math.round(Number(n) || 0).toLocaleString('it-IT');

// ---------- tablets ----------
function ModeBar({ mode, setMode }) {
  return html`<div class="u2-tablet u2-modebar">
    <div class="u2-brand">${T.brand}</div>
    <nav class="u2-seg" aria-label="Modalità">
      ${['build', 'manage', 'defend'].map((m, i) => html`
        <button type="button" class=${mode === m ? 'on' : ''} aria-pressed=${mode === m}
          title=${T.modes[m] + ' (' + (i + 1) + ')'} onClick=${() => setMode(m)}>${T.modes[m]}</button>`)}
    </nav>
  </div>`;
}
function ResourceBar({ snap, cmd }) {
  return html`<div class="u2-tablet u2-resbar">
    <ul aria-label="Risorse">
      ${Object.keys(T.resources).map(k => html`
        <li title=${T.resourcesLong[k]}><span>${T.resources[k]}</span><b>${fmt(snap.resources[k])}</b></li>`)}
    </ul>
    ${devEnabled && html`<button type="button" class="u2-icon-btn" aria-label=${T.dev} title=${T.dev} onClick=${cmd.toggleDev}><${Icon} name="gear" size=${18} /></button>`}
    <button type="button" class="u2-icon-btn u2-gold" aria-label=${T.profile} title=${T.profile} onClick=${cmd.openProfile}><${Icon} name="shield" size=${18} /></button>
  </div>`;
}
function ToolRail({ snap, cmd }) {
  const active = activeEntry(snap).id;
  return html`<nav class="u2-tablet u2-rail" aria-label="Strumenti di costruzione">
    ${CATALOG.map(e => html`
      <button type="button" class=${'u2-tool' + (active === e.id ? ' on' : '')} aria-label=${T.tools[e.id]}
        aria-pressed=${active === e.id} data-tip=${T.tools[e.id]} onClick=${() => cmd.press(e.press)}>
        <${Icon} name=${e.id} size=${22} />
      </button>`)}
    <div class="u2-sep"></div>
    <button type="button" class="u2-tool" aria-label=${T.undo} data-tip=${T.undo} onClick=${cmd.undo}><${Icon} name="undo" /></button>
  </nav>`;
}
function ToolCard({ snap, cmd }) {
  const entry = activeEntry(snap);
  if (entry.id === 'select' || snap.selection) return null;
  const rows = entry.rows ? entry.rows(snap) : [];
  return html`<aside class="u2-tablet u2-card" aria-label=${T.tools[entry.id]}>
    <header><h2>${T.tools[entry.id]}</h2>
      <button type="button" class="u2-close" aria-label=${T.close} onClick=${() => cmd.press('[data-tool="select"]')}>×</button></header>
    ${rows.length > 0 && html`<div class="u2-rows">
      ${rows.map(row => html`<div class="u2-row"><span>${row.label}</span>
        <div class=${'u2-seg u2-seg-sm' + (row.wrap ? ' u2-wrap' : '')}>${row.options.map(o => html`
          <button type="button" class=${o.active ? 'on' : ''} aria-pressed=${o.active} onClick=${() => cmd.press(o.selector)}>${o.label}</button>`)}
        </div></div>`)}
    </div>`}
    <footer>${entry.hint}</footer>
  </aside>`;
}
// Hosts an existing, event-bound legacy panel inside a tablet without recreating it.
function LegacyCard({ title, selector }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = document.querySelector(selector);
    if (!el || !ref.current) return;
    const home = el.parentNode, next = el.nextSibling;
    ref.current.appendChild(el);
    el.classList.add('u2-hosted');
    return () => { el.classList.remove('u2-hosted'); home.insertBefore(el, next); };
  }, [selector]);
  return html`<aside class="u2-tablet u2-card u2-card-tall" aria-label=${title}>
    <header><h2>${title}</h2></header>
    <div class="u2-legacy" ref=${ref}></div>
  </aside>`;
}
// ---------- selected-structure inspector ----------
const I = T.inspector;
function structureTitle(d) {
  const S = T.structures;
  if (d.type === 'tower') return d.woodStyle ? S[d.woodStyle] : d.shape === 'round' ? S.towerRound : S.towerSquare;
  if (d.type === 'gate') return d.wood ? S.woodGate : S.gate;
  return S[d.type] || d.label;
}
const costLine = cost => Object.entries(cost || {}).filter(([, v]) => v > 0).map(([k, v]) => T.resourcesLong[k] + ' ' + fmt(v)).join(' · ');
function Choice({ ctl, run }) {
  return html`<div class="u2-row"><span>${I.controls[ctl.key]}</span>
    <div class="u2-seg u2-seg-sm">${ctl.options.map(o => html`
      <button type="button" class=${o.active ? 'on' : ''} aria-pressed=${o.active} disabled=${!!o.disabled}
        onClick=${() => run(ctl.cmd, o.value)}>${o.word ? I.words[o.word] : o.label}</button>`)}</div></div>`;
}
function Control({ ctl, run }) {
  if (ctl.options) return html`<${Choice} ctl=${ctl} run=${run} />`;
  if (ctl.rotate) return html`<div class="u2-row"><span>${I.controls.rotation} · ${ctl.angle}°</span>
    <div class="u2-seg u2-seg-sm">
      <button type="button" aria-label=${I.rotateLeft} onClick=${() => run('rotate', -1)}>−15°</button>
      <button type="button" aria-label=${I.rotateFlip} onClick=${() => run('rotate', 'flip')}>180°</button>
      <button type="button" aria-label=${I.rotateRight} onClick=${() => run('rotate', 1)}>+15°</button>
    </div></div>`;
  if (ctl.toggle) return html`<div class="u2-row u2-row-inline"><span>${I.controls[ctl.key]}</span>
    <div class="u2-seg u2-seg-sm"><button type="button" class=${ctl.active ? 'on' : ''} aria-pressed=${!!ctl.active} disabled=${!!ctl.disabled}
      onClick=${() => run(ctl.cmd)}>${ctl.key === 'side' ? I.flip : ctl.active ? I.on : I.off}</button></div></div>`;
  return null;
}
// Moat/bridge settings still come from the crossings module as markup (phase 4 moves them to data).
function CrossingPanel({ id }) {
  const ref = useRef(null);
  useEffect(() => {
    const s = State.structures.find(x => x.id === id);
    if (!ref.current || !s) return;
    ref.current.innerHTML = window.ConquerCrossings?.panel(s) || '';
    window.ConquerCrossings?.bindPanel(ref.current);
  });
  return html`<div class="u2-legacy u2-legacy-inline" ref=${ref}></div>`;
}
function Inspector({ snap, cmd }) {
  const d = snap.selection?.detail;
  if (!d) return null;
  const run = (name, ...args) => cmd.structure(name, d.id, ...args);
  const subtitle = [d.houseLevel ? I.level(d.houseLevel) : null, d.building ? I.underConstruction(d.building.days) : I.completed].filter(Boolean).join(' · ');
  return html`<aside class="u2-tablet u2-card u2-card-tall u2-inspector" aria-label=${structureTitle(d)}>
    <header><div><h2>${structureTitle(d)}</h2><div class="u2-sub">${subtitle}</div></div>
      <button type="button" class="u2-close" aria-label=${T.close} onClick=${cmd.deselect}>×</button></header>
    ${d.building && html`<div class="u2-progress"><i style=${'width:' + Math.round(d.building.progress * 100) + '%'}></i></div>`}
    <div class="u2-scroll">
      ${d.facts.length > 0 && html`<dl class="u2-facts">${d.facts.map(f => html`<dt>${I.facts[f.key]}</dt>
        <dd>${f.key === 'masonry' ? I.masonryValues[f.value] || f.value : f.value}</dd>`)}</dl>`}
      ${d.annex && html`<${Facts} rows=${[[I.annex, (d.annex.label || '—') + (d.annex.size ? ' · ' + d.annex.size : '')]]} />
        <p class="u2-note">${I.annexHelp}</p>
        ${d.annex.parentId && html`<button type="button" class="u2-small-btn" onClick=${() => cmd.select(d.annex.parentId)}>${I.annexParent}</button>`}`}
      ${d.gate && html`<div class="u2-row"><span>${I.gate} · ${I.gateStage[d.gate.stage] || d.gate.stage}</span>
        <div class="u2-seg u2-seg-sm">
          <button type="button" class=${!d.gate.closed ? 'on' : ''} onClick=${() => run('setGateClosed', false)}>${I.gateOpen}</button>
          <button type="button" class=${d.gate.closed ? 'on' : ''} disabled=${d.gate.broken} onClick=${() => run('setGateClosed', true)}>${I.gateClosed}</button></div></div>
        <div class="u2-row u2-row-inline"><span>${I.nightClose}</span><div class="u2-seg u2-seg-sm">
          <button type="button" class=${d.gate.nightClose ? 'on' : ''} aria-pressed=${d.gate.nightClose}
            onClick=${() => run('setGateNightClose', !d.gate.nightClose)}>${d.gate.nightClose ? I.on : I.off}</button></div></div>
        <p class="u2-note">${I.gateHelp}</p>`}
      ${d.industry && html`<dl class="u2-facts">
        <dt>${I.workers} · L${d.industry.tier}</dt><dd>${d.industry.workers} / ${d.industry.max}</dd>
        <dt>${I.owner}</dt><dd>${d.industry.owner === 'lord' ? I.ownerLord : I.ownerPrivate}</dd></dl>`}
      ${d.house && html`<div class="u2-row"><span>${I.house} · L${d.house.level}</span><div class="u2-seg u2-seg-sm">
        <button type="button" disabled=${!d.house.canDown} onClick=${() => run('changeHouseLevel', -1)}>${I.houseDown}</button>
        <button type="button" disabled=${!d.house.canUp} onClick=${() => run('changeHouseLevel', 1)}>${I.houseUp}</button></div></div>`}
      ${d.controls.length > 0 && html`<div class="u2-rows">${d.controls.map(c => html`<${Control} ctl=${c} run=${run} />`)}</div>`}
      ${d.mastio && html`<div class="u2-row"><span>${I.mastio}</span><div class="u2-seg u2-seg-sm">
        <button type="button" class=${d.mastio.active ? 'on' : ''} aria-pressed=${d.mastio.active} disabled=${d.mastio.disabled}
          onClick=${() => run('toggleMastio')}>${d.mastio.active ? I.mastioOn : I.mastioOff}</button></div></div>`}
      ${d.archers && html`<div class="u2-row"><span>${I.archers(d.archers.count, d.archers.max)}</span><div class="u2-seg u2-seg-sm">
        <button type="button" disabled=${d.archers.disabled || d.archers.count === 0} onClick=${() => run('changeArchers', -1)}>−</button>
        <button type="button" disabled=${d.archers.disabled || d.archers.count >= d.archers.max} onClick=${() => run('changeArchers', 1)}>+</button></div>
        <small>${I.archerSlots(d.archers.roof, d.archers.slits)}</small></div>`}
      ${d.rooms && html`<section class="u2-rooms"><h3>${I.roomsTitle}</h3>
        ${d.rooms.pending ? html`<p>${I.roomsPending}</p>` : d.rooms.slots.length === 0 ? html`<p>${I.roomsNone}</p>` :
          d.rooms.slots.map(r => html`<label class="u2-room"><span>${I.room(r.index + 1, r.size, r.units)}</span>
            <select value=${r.value} onChange=${e => run('setRoom', r.index, e.currentTarget.value)}>
              <option value="">${I.roomEmpty}</option>
              ${r.options.map(o => html`<option value=${o.value} disabled=${!o.allowed}>${T.functions[o.value] || o.value}</option>`)}
            </select></label>`)}</section>`}
      ${d.legacy === 'crossing' && html`<${CrossingPanel} id=${d.id} />`}
      ${d.integrity && html`<dl class="u2-facts"><dt>${I.integrity} · ${I.masonry}</dt><dd>${d.integrity.core} / ${d.integrity.coreMax}</dd>
        ${d.integrity.door != null && html`<dt>${I.door}</dt><dd>${d.integrity.door} / ${d.integrity.doorMax}</dd>`}
        ${d.integrity.portcullis != null && html`<dt>${I.portcullis}</dt><dd>${d.integrity.portcullis} / ${d.integrity.portcullisMax}</dd>`}</dl>`}
      ${d.bays && html`<dl class="u2-facts"><dt>${I.integrity}</dt><dd>${I.bays(d.bays.length)}</dd>
        ${d.bays.map((b, i) => html`<dt>${I.bay(i + 1)}</dt><dd>${b.hp} / ${b.max}</dd>`)}</dl>`}
    </div>
    <footer class="u2-actions"><span>${I.cost}: ${costLine(d.cost)}</span>
      <button type="button" class="u2-danger" onClick=${() => cmd.demolish(d.id)}>${I.demolish}</button></footer>
  </aside>`;
}

// ---------- Gestisci ----------
const M = T.manage;
const MANAGE_SECTIONS = ['overview', 'policies', 'market', 'activities', 'castle', 'game'];
const num = (n, digits = 1) => Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: digits });
function ManageRail({ section, setSection }) {
  return html`<nav class="u2-tablet u2-rail" aria-label=${T.modes.manage}>
    ${MANAGE_SECTIONS.map(id => html`
      <button type="button" class=${'u2-tool' + (section === id ? ' on' : '')} aria-label=${M.sections[id]}
        aria-pressed=${section === id} data-tip=${M.sections[id]} onClick=${() => setSection(id)}><${Icon} name=${id} size=${22} /></button>`)}
  </nav>`;
}
function Facts({ rows }) {
  return html`<dl class="u2-facts">${rows.filter(Boolean).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`;
}
function Overview({ game }) {
  const v = game.read.village(), e = game.read.economy();
  const pop = e ? Object.values(e.population) : [];
  const trade = e?.lastTrade, unmet = trade ? Object.values(trade.unmet || {}).reduce((a, b) => a + b, 0) : 0;
  return html`
    <${Facts} rows=${[[M.village, v.name || M.notFounded]]} />
    ${e && html`<${Facts} rows=${[
      [M.population + ' (' + M.classes + ')', pop.join(' · ') + ' = ' + pop.reduce((a, b) => a + b, 0)],
      [M.welfare, num(e.welfare) + ' / 100'],
      [M.castleGold, num(e.castleGold)],
      [M.capital, num(e.capital)],
      [M.wages, [e.wage.L1, e.wage.L2, e.wage.L3].map(w => num(w, 2)).join(' · ')]]} />
      <p class="u2-note">${M.schedule}</p>`}
    ${trade && html`<h3>${M.lastMarket}</h3><${Facts} rows=${[
      [M.foodSold, num(trade.domestic?.food)], [M.unmet, num(unmet)]]} />`}
    ${e?.events?.length > 0 && html`<h3>${M.events}</h3><ul class="u2-log">${e.events.map(x => html`<li>${x.label}</li>`)}</ul>`}`;
}
function Policies({ game }) {
  const p = game.read.policies(), snap = game.snapshot();
  return html`${['tax', 'rations', 'levy'].map(k => html`
    <label class="u2-slider"><span>${M.policies[k]}<b>${p[k]}%</b></span>
      <input type="range" min="0" max="100" value=${p[k]} onInput=${e => { game.commands.setPolicy(k, e.currentTarget.value); game.emit(); }} />
      <small>${M.policyHelp[k]}</small></label>`)}
    <div class="u2-row"><span>${M.privateMasonry}</span><div class="u2-seg u2-seg-sm">${['stone', 'brick'].map(m => html`
      <button type="button" class=${snap.privateMasonry === m ? 'on' : ''} aria-pressed=${snap.privateMasonry === m}
        onClick=${() => game.commands.press('[data-private-masonry="' + m + '"]')}>${T.values[m]}</button>`)}</div>
      <small>${M.privateMasonryHelp}</small></div>`;
}
function Market({ game }) {
  const e = game.read.economy();
  if (!e) return null;
  return html`<p class="u2-note">${M.marketHelp}</p>
    ${e.goods.map(g => html`<div class="u2-good">
      <div class="u2-good-head"><b>${M.goods[g.id]}</b><span>${M.price} ${num(g.price)} · ${M.inMarket} ${num(g.market)} · ${M.inCastle} ${num(g.castle)}</span></div>
      <div class="u2-row"><span>${M.sell}</span><div class="u2-seg u2-seg-sm">${[0, 25, 50, 75, 100].map(n => html`
        <button type="button" class=${g.share === n ? 'on' : ''} aria-pressed=${g.share === n}
          onClick=${() => game.commands.setSaleShare(g.id, n)}>${n}%</button>`)}</div></div>
      <label class="u2-inline-field"><span>${M.reserve}</span>
        <input type="number" min="0" step="10" value=${g.reserve} onChange=${ev => game.commands.setReserve(g.id, ev.currentTarget.value)} /></label>
    </div>`)}`;
}
function Activities({ game }) {
  const e = game.read.economy();
  if (!e || !e.activities.length) return html`<p class="u2-note">${M.noActivities}</p>`;
  return html`<ul class="u2-list">${e.activities.map(a => html`<li>
    <div><b>${M.activityTypes[a.type] || a.type}</b><span>${M.owner[a.owner]} · ${M.workers} ${a.workers} · ${M.value} ${num(a.value, 0)}${a.abandoned ? ' · ' + M.abandoned : ''}</span></div>
    <button type="button" class="u2-small-btn" onClick=${() => game.commands.transferActivity(a.id, a.owner === 'lord' ? 'private' : 'lord')}>
      ${a.owner === 'lord' ? M.sellL4 : M.buy}</button></li>`)}</ul>`;
}
function CastleStores({ game }) {
  const l = game.read.logistics();
  if (!l) return null;
  return html`
    <${Facts} rows=${[
      ...l.stores.map(s => [M.stores[s.id], num(s.stock, 0) + ' / ' + num(s.cap, 0)]),
      [M.autonomy, M.days(l.autonomy)], [M.dailyNeed, num(l.daily)],
      [M.capacity, l.meals + ' · ' + l.soldiers + ' · ' + l.knights]]} />
    ${l.shortfall > 0 && html`<p class="u2-warn">${M.shortfall(l.shortfall)}</p>`}
    <div class="u2-row"><span>${M.store}</span><div class="u2-seg u2-seg-sm u2-wrap">${l.transfers.map(t => html`
      <button type="button" disabled=${!t.enabled} onClick=${() => game.commands.storeInCastle(t.id)}>+${(M.goods[t.id] || M.stores[t.id] || t.id)}</button>`)}</div></div>
    <p class="u2-note">${M.storeHelp}</p>`;
}
function GameInfo({ game }) {
  const v = game.read.village();
  return html`<${Facts} rows=${[[M.village, v.name || M.notFounded], [M.seed, v.seed], [M.biome, M.biomes[v.biome] || v.biome]]} />
    <button type="button" class="u2-primary" onClick=${game.commands.saveCloud}>${M.save}</button>
    <p class="u2-note">${M.saveHelp}</p>`;
}
const MANAGE_VIEWS = { overview: Overview, policies: Policies, market: Market, activities: Activities, castle: CastleStores, game: GameInfo };
function ManageCard({ section, game }) {
  const View = MANAGE_VIEWS[section];
  return html`<aside class="u2-tablet u2-card u2-card-tall u2-card-wide" aria-label=${M.sections[section]}>
    <header><h2>${M.sections[section]}</h2></header>
    <div class="u2-scroll">${View && html`<${View} game=${game} />`}</div>
  </aside>`;
}

function TimeBar({ snap, cmd }) {
  const c = snap.clock;
  return html`<div class="u2-tablet u2-timebar">
    <button type="button" class="u2-icon-btn" aria-label=${T.time.rotateLeft} title=${T.time.rotateLeft} onClick=${() => cmd.rotate(-1)}><${Icon} name="rotateLeft" size=${18} /></button>
    <button type="button" class="u2-icon-btn" aria-label=${T.time.rotateRight} title=${T.time.rotateRight} onClick=${() => cmd.rotate(1)}><${Icon} name="rotateRight" size=${18} /></button>
    <button type="button" class=${'u2-icon-btn' + (snap.view.plan ? ' on' : '')} aria-pressed=${snap.view.plan} aria-label=${T.time.plan} title=${T.time.plan} onClick=${cmd.togglePlan}><${Icon} name="plan" size=${18} /></button>
    <div class="u2-date"><b>${c.weekday} ${c.date}</b><span>${T.year} ${c.year} · ${T.seasons[c.season] || ''}</span></div>
    <div class="u2-seg">
      <button type="button" class=${c.speed === 0 ? 'on' : ''} aria-label=${T.time.pause} title=${T.time.pause} onClick=${() => cmd.setSpeed(0)}>❚❚</button>
      ${[1, 3, 10, 100].map(n => html`<button type="button" class=${c.speed === n ? 'on' : ''} aria-label=${T.time.speed(n)} onClick=${() => cmd.setSpeed(n)}>${n}×</button>`)}
    </div>
  </div>`;
}
function Toast({ snap }) {
  const unsaved = /unsaved/i.test(snap.saved);
  return html`<div class="u2-toast" aria-live="polite">
    ${snap.status && html`<div class="u2-tablet u2-status">${snap.status}</div>`}
    <div class=${'u2-saved' + (unsaved ? ' bad' : '')}>● ${unsaved ? T.unsaved : T.saved}</div>
  </div>`;
}

function App() {
  const game = window.ConquerGame;
  const [snap, setSnap] = useState(game.snapshot());
  const [mode, setModeState] = useState(['build', 'manage', 'defend'].includes(recall(MODE_KEY)) ? recall(MODE_KEY) : 'build');
  const setMode = m => { setModeState(m); remember(MODE_KEY, m); if (m !== 'build') game.commands.press('[data-tool="select"]'); };
  const [section, setSectionState] = useState(MANAGE_SECTIONS.includes(recall('conquer.ui.manage')) ? recall('conquer.ui.manage') : 'overview');
  const setSection = s => { setSectionState(s); remember('conquer.ui.manage', s); };
  useEffect(() => game.subscribe(setSnap), []);
  useEffect(() => {
    document.body.dataset.u2Mode = mode;
    const onKey = e => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target?.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      const m = { 1: 'build', 2: 'manage', 3: 'defend' }[e.key];
      if (m) { e.preventDefault(); setMode(m); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);
  const cmd = game.commands;
  return html`
    <${ModeBar} mode=${mode} setMode=${setMode} />
    <${ResourceBar} snap=${snap} cmd=${cmd} />
    ${mode === 'build' && html`<${ToolRail} snap=${snap} cmd=${cmd} />${snap.selection?.detail
      ? html`<${Inspector} snap=${snap} cmd=${cmd} />` : html`<${ToolCard} snap=${snap} cmd=${cmd} />`}`}
    ${mode === 'manage' && html`<${ManageRail} section=${section} setSection=${setSection} /><${ManageCard} section=${section} game=${game} />`}
    ${mode === 'defend' && html`<${LegacyCard} title=${T.defendTitle} selector="#combatControls" />`}
    <${TimeBar} snap=${snap} cmd=${cmd} />
    <${Toast} snap=${snap} />`;
}

if (enabled) {
  document.body.classList.add('ui2');
  if (devEnabled) document.body.classList.add('ui2-dev');
  const root = document.createElement('div');
  root.id = 'ui2';
  document.getElementById('wrap').appendChild(root);
  // The map now fills the window: let the game re-measure its canvases.
  if (typeof resize === 'function') resize();
  render(html`<${App} />`, root);
}
