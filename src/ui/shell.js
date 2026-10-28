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
  game: 'M5 3h12l4 4v14H3V3h2M7 3v6h9V3M7 21v-7h10v7',
  command: 'M5 21V4M5 4h11l-2 4 2 4H5',
  zones: 'M4 20c3 0 4-2 4-4 0-1.5 1-3 3-3s3 1.5 3 3M14 13l6-9M9 20h11',
  patrols: 'M7 21l2-7M9 14l-3-4 4-2 3 3 3-1M10 4.5a1.5 1.5 0 1 0 0 .01M17 3v18',
  alarm: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
  tests: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11v2'
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
      const kind = s.tool.linear, wide = kind === 'built' && s.tool.span === 'wide', rows = [{ label: O.type, options: [
        opt(V.wall, '[data-linear="wall"]', kind === 'wall'),
        opt(V.palisade, '[data-linear="palisade"]', kind === 'palisade'),
        opt(V.built, '[data-linear="built"]', kind === 'built' && !wide),
        opt(V.builtWide, '[data-linear="builtWide"]', wide)] }];
      if (kind !== 'built') rows.push({ label: O.tier, options: [1, 2, 3].map(n => opt('T' + n, `[data-wall-tier="${n}"]`, s.levels.wallTier === n)) });
      if (kind !== 'palisade') rows.push({ label: O.height, options: [1, 2].map(n => opt(String(n), `[data-wall-level="${n}"]`, (wide ? s.levels.builtWide : s.levels.wall) === n)) });
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


// ---------- hover help ----------
// Any element with data-tip (title) and optional data-tip-body (explanation) gets the shared
// popup on hover or keyboard focus. Panels stay free of help text; native title tooltips are not used.
const TIP = T.tips;
const tipText = (value, kind) => value && typeof value === 'object' ? value[kind] || value.tower || Object.values(value)[0] : value;
function Tooltip() {
  const [tip, setTip] = useState(null);
  useEffect(() => {
    const root = document.getElementById('ui2');
    let timer = 0;
    const show = el => {
      const r = el.getBoundingClientRect(), host = root.getBoundingClientRect();
      const cx = (r.left + r.right) / 2 - host.left;
      const side = cx > host.width * .62 ? 'left' : cx < host.width * .38 && r.top - host.top > 60 ? 'right' : 'top';
      setTip({ title: el.dataset.tip, body: el.dataset.tipBody || '', side,
        x: side === 'left' ? r.left - host.left - 10 : side === 'right' ? r.right - host.left + 10 : cx,
        y: side === 'top' ? r.top - host.top - 8 : (r.top + r.bottom) / 2 - host.top });
    };
    const over = e => {
      const el = e.target.closest?.('[data-tip]');
      clearTimeout(timer);
      if (!el || !root.contains(el)) { setTip(null); return; }
      timer = setTimeout(() => show(el), e.type === 'focusin' ? 0 : 220);
    };
    const out = e => { if (!e.relatedTarget?.closest?.('[data-tip]')) { clearTimeout(timer); setTip(null); } };
    root.addEventListener('mouseover', over); root.addEventListener('focusin', over);
    root.addEventListener('mouseout', out); root.addEventListener('focusout', out);
    return () => { root.removeEventListener('mouseover', over); root.removeEventListener('focusin', over);
      root.removeEventListener('mouseout', out); root.removeEventListener('focusout', out); };
  }, []);
  if (!tip) return null;
  return html`<div class=${'u2-tip u2-tip-' + tip.side} role="tooltip" style=${'left:' + tip.x + 'px;top:' + tip.y + 'px'}>
    <b>${tip.title}</b>${tip.body && html`<span>${tip.body}</span>`}</div>`;
}

// ---------- shared pieces ----------
const num = (n, digits = 1) => Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: digits });
function Row({ label, tip, children }) {
  return html`<div class="u2-row">
    <span class="u2-label" data-tip=${tip ? label : null} data-tip-body=${tip || null} tabindex=${tip ? 0 : null}>${label}${tip && html`<i aria-hidden="true">?</i>`}</span>
    <div class="u2-ctl">${children}</div></div>`;
}
function Seg({ options, onPick, wrap }) {
  // More than three choices wrap three per line instead of shrinking into unreadable buttons.
  return html`<div class=${'u2-seg' + (wrap || options.length > 3 ? ' u2-wrap' : '')}>${options.map(o => html`
    <button type="button" class=${o.active ? 'on' : ''} aria-pressed=${!!o.active} disabled=${!!o.disabled}
      data-tip=${o.tip || null} data-tip-body=${o.tipBody || null} onClick=${() => onPick(o)}>${o.label}</button>`)}</div>`;
}
function Bar({ value, max, tone }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0;
  return html`<div class=${'u2-bar' + (tone ? ' ' + tone : '')}><i style=${'width:' + pct + '%'}></i></div>`;
}
function Stat({ label, value, tip, children }) {
  return html`<div class="u2-stat" data-tip=${label} data-tip-body=${tip || null} tabindex="0">
    <span>${label}</span><b>${value}</b>${children}</div>`;
}
function Card({ title, sub, onClose, wide, children, footer }) {
  return html`<aside class=${'u2-tablet u2-card' + (wide ? ' u2-card-wide' : '')} aria-label=${title}>
    <header><h2>${title}</h2>${sub && html`<span class="u2-sub">${sub}</span>`}
      ${onClose && html`<button type="button" class="u2-close" aria-label=${T.close} data-tip=${T.close} onClick=${onClose}>×</button>`}</header>
    <div class="u2-body">${children}</div>
    ${footer && html`<footer>${footer}</footer>`}
  </aside>`;
}

// ---------- tablets ----------
function ModeBar({ mode, setMode }) {
  return html`<div class="u2-tablet u2-modebar">
    <div class="u2-brand">${T.brand}</div>
    <nav class="u2-seg u2-seg-lg" aria-label="Modalità">
      ${['build', 'manage', 'defend'].map((m, i) => html`
        <button type="button" class=${mode === m ? 'on' : ''} aria-pressed=${mode === m}
          data-tip=${T.modes[m]} data-tip-body=${'Tasto ' + (i + 1)} onClick=${() => setMode(m)}>${T.modes[m]}</button>`)}
    </nav>
  </div>`;
}
function ResourceBar({ snap, cmd }) {
  return html`<div class="u2-tablet u2-resbar">
    <ul aria-label="Risorse">
      ${Object.keys(T.resources).map(k => html`
        <li data-tip=${T.resourcesLong[k]} tabindex="0"><span>${T.resources[k]}</span><b>${fmt(snap.resources[k])}</b></li>`)}
    </ul>
    ${devEnabled && html`<button type="button" class="u2-icon-btn" aria-label=${T.dev} data-tip=${T.dev} onClick=${cmd.toggleDev}><${Icon} name="gear" size=${18} /></button>`}
    <button type="button" class="u2-icon-btn u2-gold" aria-label=${T.profile} data-tip=${T.profile} onClick=${cmd.openProfile}><${Icon} name="shield" size=${18} /></button>
  </div>`;
}
function ToolRail({ snap, cmd }) {
  const active = activeEntry(snap).id;
  return html`<nav class="u2-tablet u2-rail" aria-label="Strumenti di costruzione">
    ${CATALOG.map(e => html`
      <button type="button" class=${'u2-tool' + (active === e.id ? ' on' : '')} aria-label=${T.tools[e.id]}
        aria-pressed=${active === e.id} data-tip=${T.tools[e.id]} data-tip-body=${e.hint} onClick=${() => cmd.press(e.press)}>
        <${Icon} name=${e.id} size=${22} />
      </button>`)}
    <div class="u2-sep"></div>
    <button type="button" class="u2-tool" aria-label=${T.undo} data-tip=${T.undo} onClick=${cmd.undo}><${Icon} name="undo" /></button>
  </nav>`;
}
// Help for build-option rows, keyed by their label.
const ROW_TIPS = {
  [O.masonry]: TIP.masonry, [O.tier]: TIP.tier.wall, [O.level]: TIP.height, [O.radius]: null, [O.width]: TIP.crossingWidth
};
const VALUE_TIPS = { [V.sloped]: TIP.sloped, [V.walled]: TIP.walled, [V.flat]: TIP.flat };
// Short button labels for long option names; the full name goes to the tooltip.
const VALUE_SHORT = { [V.loggingCamp]: 'Legna', [V.windmill]: 'M. vento', [V.watermill]: 'M. acqua', [V.training]: 'Addestr.',
  [V.woodBridge]: 'P. legno', [V.stoneBridge]: 'P. pietra', [V.walled]: 'Terrazza' };
function ToolCard({ snap, cmd }) {
  const entry = activeEntry(snap);
  if (entry.id === 'select' || snap.selection) return null;
  const rows = entry.rows ? entry.rows(snap) : [];
  return html`<${Card} title=${T.tools[entry.id]} onClose=${() => cmd.press('[data-tool="select"]')}>
    ${rows.map(row => html`<${Row} label=${row.label} tip=${ROW_TIPS[row.label]}>
      <${Seg} options=${row.options.map(o => ({ ...o, label: VALUE_SHORT[o.label] || o.label,
        tip: VALUE_TIPS[o.label] || VALUE_SHORT[o.label] ? o.label : null, tipBody: VALUE_TIPS[o.label] }))}
        wrap=${row.wrap} onPick=${o => cmd.press(o.selector)} /></${Row}>`)}
    ${rows.length === 0 && html`<p class="u2-hint">${entry.hint}</p>`}
  </${Card}>`;
}

// ---------- selected-structure inspector ----------
const I = T.inspector;
function structureTitle(d) {
  const S = T.structures;
  if (d.type === 'tower') return d.woodStyle ? S[d.woodStyle] : d.shape === 'round' ? S.towerRound : S.towerSquare;
  if (d.type === 'gate') return d.wood ? S.woodGate : S.gate;
  return S[d.type] || d.label;
}
const RES_SHORT = { gold: 'Oro', stone: 'Pie', wood: 'Leg', metal: 'Met', clay: 'Arg', food: 'Cibo', equipment: 'Equ' };
function Cost({ cost }) {
  const parts = Object.entries(cost || {}).filter(([, v]) => v > 0);
  return html`<span class="u2-cost" data-tip=${I.cost} data-tip-body=${parts.map(([k, v]) => T.resourcesLong[k] + ' ' + fmt(v)).join(' · ')} tabindex="0">
    ${parts.map(([k, v]) => html`<span><small>${RES_SHORT[k] || k}</small>${fmt(v)}</span>`)}</span>`;
}
const controlTip = (ctl, type) => {
  const t = TIP[ctl.key];
  if (ctl.key === 'tier') return tipText(t, type === 'tower' ? 'tower' : 'wall');
  return tipText(t, type);
};
function Control({ ctl, run, type }) {
  const label = I.controls[ctl.key], tip = controlTip(ctl, type);
  // Buttons show a short label; the full name (and any detail after " · ") goes to the tooltip.
  if (ctl.options) return html`<${Row} label=${label} tip=${tip}>
    <${Seg} options=${ctl.options.map(o => {
      const [head, detail] = String(o.label || '').split(' · ');
      return o.word ? { ...o, label: I.short[o.word] || I.words[o.word], tip: I.words[o.word] }
        : { ...o, label: head, tip: detail ? head : null, tipBody: detail || null };
    })} onPick=${o => run(ctl.cmd, o.value)} /></${Row}>`;
  if (ctl.rotate) return html`<${Row} label=${label + ' ' + ctl.angle + '°'} tip=${tip}>
    <${Seg} options=${[{ label: '−15°', v: -1, tip: I.rotateLeft }, { label: '180°', v: 'flip', tip: I.rotateFlip }, { label: '+15°', v: 1, tip: I.rotateRight }]}
      onPick=${o => run('rotate', o.v)} /></${Row}>`;
  if (ctl.toggle) return html`<${Row} label=${label} tip=${tip}>
    <${Seg} options=${[{ label: ctl.key === 'side' ? I.flip : ctl.active ? I.on : I.off, active: ctl.key !== 'side' && ctl.active, disabled: ctl.disabled }]}
      onPick=${() => run(ctl.cmd)} /></${Row}>`;
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
  return html`<div class="u2-legacy" ref=${ref}></div>`;
}
function Inspector({ snap, cmd }) {
  const d = snap.selection?.detail;
  if (!d) return null;
  const run = (name, ...args) => cmd.structure(name, d.id, ...args);
  const sub = d.building ? I.underConstruction(d.building.days) : d.houseLevel ? 'L' + d.houseLevel : I.completed;
  const facts = d.facts.map(f => [I.facts[f.key], f.key === 'masonry' ? I.masonryValues[f.value] || f.value : f.value]);
  if (d.industry) facts.push([I.workers + ' L' + d.industry.tier, d.industry.workers + '/' + d.industry.max], [I.owner, d.industry.owner === 'lord' ? I.ownerLord : I.ownerPrivate]);
  const hp = d.integrity;
  return html`<${Card} title=${structureTitle(d)} sub=${sub} onClose=${cmd.deselect}
    footer=${html`<${Cost} cost=${d.cost} />
      <button type="button" class="u2-icon-btn u2-danger" aria-label=${I.demolish} data-tip=${I.demolish} onClick=${() => cmd.demolish(d.id)}><${Icon} name="delete" size=${18} /></button>`}>
    ${d.building && html`<${Bar} value=${d.building.progress} max=${1} />`}
    ${facts.length > 0 && html`<div class="u2-stats">${facts.map(([k, v]) => html`<${Stat} label=${k} value=${v} />`)}</div>`}
    ${d.annex && html`<${Row} label=${I.annex} tip=${I.annexHelp}>
      <${Seg} options=${[{ label: I.annexParent, disabled: !d.annex.parentId }]} onPick=${() => cmd.select(d.annex.parentId)} /></${Row}>`}
    ${d.house && html`<${Row} label=${I.house + ' L' + d.house.level} tip=${TIP.house}>
      <${Seg} options=${[{ label: '−', tip: I.houseDown, disabled: !d.house.canDown, v: -1 }, { label: '+', tip: I.houseUp, disabled: !d.house.canUp, v: 1 }]}
        onPick=${o => run('changeHouseLevel', o.v)} /></${Row}>`}
    ${d.controls.filter(c => !c.toggle || c.key === 'side').map(c => html`<${Control} ctl=${c} run=${run} type=${d.type} />`)}
    ${(() => {
      // On/off switches share one row of chips (cutaway, mastio).
      const chips = d.controls.filter(c => c.toggle && c.key !== 'side').map(c => ({ label: I.controls[c.key], active: c.active, disabled: c.disabled,
        tip: I.controls[c.key], tipBody: controlTip(c, d.type), run: () => run(c.cmd) }));
      if (d.mastio) chips.push({ label: I.mastio, active: d.mastio.active, disabled: d.mastio.disabled, tip: I.mastio, tipBody: TIP.mastio, run: () => run('toggleMastio') });
      return chips.length > 0 && html`<${Row} label=${I.toggles}><${Seg} options=${chips} onPick=${o => o.run()} /></${Row}>`;
    })()}
    ${d.gate && html`<${Row} label=${I.gate + ' · ' + (I.gateStage[d.gate.stage] || d.gate.stage)} tip=${I.gateHelp}>
      <${Seg} options=${[{ label: I.gateOpen, active: !d.gate.closed, v: false }, { label: I.gateClosed, active: d.gate.closed, disabled: d.gate.broken, v: true }]}
        onPick=${o => run('setGateClosed', o.v)} /></${Row}>
      <${Row} label=${I.nightClose}><${Seg} options=${[{ label: d.gate.nightClose ? I.on : I.off, active: d.gate.nightClose }]}
        onPick=${() => run('setGateNightClose', !d.gate.nightClose)} /></${Row}>`}
    ${d.archers && html`<${Row} label=${I.archers(d.archers.count, d.archers.max)} tip=${TIP.archers + ' ' + I.archerSlots(d.archers.roof, d.archers.slits) + '.'}>
      <${Seg} options=${[{ label: '−', disabled: d.archers.disabled || d.archers.count === 0, v: -1 }, { label: '+', disabled: d.archers.disabled || d.archers.count >= d.archers.max, v: 1 }]}
        onPick=${o => run('changeArchers', o.v)} /></${Row}>`}
    ${d.rooms && html`<div class="u2-group"><span class="u2-label" data-tip=${I.roomsTitle} data-tip-body=${TIP.rooms} tabindex="0">${I.roomsTitle}<i aria-hidden="true">?</i></span>
      ${d.rooms.pending ? html`<p class="u2-hint">${I.roomsPending}</p>` : d.rooms.slots.length === 0 ? html`<p class="u2-hint">${I.roomsNone}</p>` :
        html`<div class="u2-rooms">${d.rooms.slots.map(r => html`<label class="u2-room" data-tip=${'Piano ' + (r.index + 1)} data-tip-body=${I.room(r.index + 1, r.size, r.units)}>
          <span>P${r.index + 1}${r.size === 'large' ? '+' : ''}</span>
          <select value=${r.value} onChange=${e => run('setRoom', r.index, e.currentTarget.value)}>
            <option value="">${I.roomEmpty}</option>
            ${r.options.map(o => html`<option value=${o.value} disabled=${!o.allowed}>${T.functions[o.value] || o.value}</option>`)}
          </select></label>`)}</div>`}</div>`}
    ${d.legacy === 'crossing' && html`<${CrossingPanel} id=${d.id} />`}
    ${hp && html`<div class="u2-group"><span class="u2-label" data-tip=${I.integrity} data-tip-body=${TIP.integrity} tabindex="0">${I.integrity}<i aria-hidden="true">?</i></span>
      <div class="u2-meter" data-tip=${I.masonry} data-tip-body=${hp.core + ' / ' + hp.coreMax}><small>${I.masonry}</small><${Bar} value=${hp.core} max=${hp.coreMax} /></div>
      ${hp.door != null && html`<div class="u2-meter" data-tip=${I.door} data-tip-body=${hp.door + ' / ' + hp.doorMax}><small>${I.door}</small><${Bar} value=${hp.door} max=${hp.doorMax} /></div>`}
      ${hp.portcullis != null && html`<div class="u2-meter" data-tip=${I.portcullis} data-tip-body=${hp.portcullis + ' / ' + hp.portcullisMax}><small>${I.portcullis}</small><${Bar} value=${hp.portcullis} max=${hp.portcullisMax} /></div>`}</div>`}
    ${d.bays && html`<div class="u2-group"><span class="u2-label">${I.bays(d.bays.length)}</span>
      <div class="u2-bays">${d.bays.map((b, i) => html`<span data-tip=${I.bay(i + 1)} data-tip-body=${b.hp + ' / ' + b.max}><${Bar} value=${b.hp} max=${b.max} /></span>`)}</div></div>`}
  </${Card}>`;
}

// ---------- Gestisci ----------
const M = T.manage;
const MANAGE_SECTIONS = ['overview', 'policies', 'market', 'activities', 'castle', 'game'];
function ManageRail({ section, setSection }) {
  return html`<nav class="u2-tablet u2-rail" aria-label=${T.modes.manage}>
    ${MANAGE_SECTIONS.map(id => html`
      <button type="button" class=${'u2-tool' + (section === id ? ' on' : '')} aria-label=${M.sections[id]}
        aria-pressed=${section === id} data-tip=${M.sections[id]} onClick=${() => setSection(id)}><${Icon} name=${id} size=${22} /></button>`)}
  </nav>`;
}
function Overview({ game }) {
  const v = game.read.village(), e = game.read.economy();
  if (!e) return html`<p class="u2-hint">${v.name || M.notFounded}</p>`;
  const pop = Object.values(e.population), total = pop.reduce((a, b) => a + b, 0);
  const trade = e.lastTrade, unmet = trade ? Object.values(trade.unmet || {}).reduce((a, b) => a + b, 0) : 0;
  return html`<div class="u2-stats u2-stats-3">
      <${Stat} label=${M.population} value=${total} tip=${TIP.population + ' ' + pop.join(' · ')} />
      <${Stat} label=${M.welfare} value=${num(e.welfare, 0)} tip=${TIP.welfare}><${Bar} value=${e.welfare} max=${100} /></${Stat}>
      <${Stat} label="Oro castello" value=${num(e.castleGold, 0)} tip=${TIP.castleGold} />
      <${Stat} label="Capitale L4" value=${num(e.capital, 0)} tip=${TIP.capital} />
      <${Stat} label="Salari" value=${[e.wage.L1, e.wage.L2, e.wage.L3].map(w => num(w, 1)).join(' · ')} tip=${TIP.wages + ' ' + TIP.schedule} />
      <${Stat} label="Mercato" value=${trade ? num(trade.domestic?.food, 0) + ' / ' + num(unmet, 0) : '—'} tip=${TIP.lastMarket} />
    </div>
    ${e.events?.length > 0 && html`<ul class="u2-log">${e.events.slice(0, 4).map(x => html`<li>${x.label}</li>`)}</ul>`}`;
}
function Policies({ game }) {
  const p = game.read.policies(), snap = game.snapshot();
  return html`${['tax', 'rations', 'levy'].map(k => html`<${Row} label=${M.policies[k]} tip=${M.policyHelp[k]}>
      <div class="u2-slider"><input type="range" min="0" max="100" value=${p[k]} aria-label=${M.policies[k]}
        onInput=${e => { game.commands.setPolicy(k, e.currentTarget.value); game.emit(); }} /><b>${p[k]}%</b></div></${Row}>`)}
    <${Row} label="Muratura case" tip=${M.privateMasonryHelp}>
      <${Seg} options=${['stone', 'brick'].map(m => ({ label: T.values[m], active: snap.privateMasonry === m, m }))}
        onPick=${o => game.commands.press('[data-private-masonry="' + o.m + '"]')} /></${Row}>`;
}
function Market({ game }) {
  const e = game.read.economy();
  if (!e) return null;
  const head = (label, tip) => html`<th data-tip=${label} data-tip-body=${tip} tabindex="0">${label}</th>`;
  return html`<table class="u2-table">
    <thead><tr><th></th>${head('Prezzo', TIP.price)}${head('Merc.', TIP.inMarket)}${head('Cast.', TIP.inCastle)}${head(M.sell, TIP.sell)}${head(M.reserve, TIP.reserve)}</tr></thead>
    <tbody>${e.goods.map(g => html`<tr>
      <th scope="row">${M.goods[g.id] || g.id}</th><td>${num(g.price)}</td><td>${num(g.market, 0)}</td><td>${num(g.castle, 0)}</td>
      <td><select aria-label=${M.sell + ' ' + (M.goods[g.id] || g.id)} value=${g.share} onChange=${ev => game.commands.setSaleShare(g.id, Number(ev.currentTarget.value))}>
        ${[0, 25, 50, 75, 100].map(n => html`<option value=${n}>${n}%</option>`)}</select></td>
      <td><input type="number" min="0" step="10" aria-label=${M.reserve + ' ' + (M.goods[g.id] || g.id)} value=${g.reserve}
        onChange=${ev => game.commands.setReserve(g.id, ev.currentTarget.value)} /></td></tr>`)}</tbody></table>`;
}
function Activities({ game }) {
  const e = game.read.economy();
  if (!e || !e.activities.length) return html`<p class="u2-hint">${M.noActivities}</p>`;
  return html`<table class="u2-table">
    <thead><tr><th></th><th data-tip=${I.owner} tabindex="0">Prop.</th><th data-tip=${M.workers} tabindex="0">Lav.</th><th data-tip=${M.value} tabindex="0">Val.</th><th></th></tr></thead>
    <tbody>${e.activities.map(a => html`<tr class=${a.abandoned ? 'u2-dim' : ''}>
      <th scope="row">${M.activityTypes[a.type] || a.type}</th><td>${M.owner[a.owner]}</td><td>${a.workers}</td><td>${num(a.value, 0)}</td>
      <td><button type="button" class="u2-mini" data-tip=${a.owner === 'lord' ? M.sellL4 : M.buy} data-tip-body=${TIP.transfer}
        aria-label=${a.owner === 'lord' ? M.sellL4 : M.buy} onClick=${() => game.commands.transferActivity(a.id, a.owner === 'lord' ? 'private' : 'lord')}>⇄</button></td></tr>`)}</tbody></table>`;
}
const STORE_KEYS = { food: ['food'], materials: ['wood', 'stone', 'metal'], equipment: ['equipment'], horses: ['horses'], gold: ['gold'] };
function CastleStores({ game }) {
  const l = game.read.logistics();
  if (!l) return null;
  const transfers = Object.fromEntries(l.transfers.map(t => [t.id, t]));
  return html`<div class="u2-stats">
      <${Stat} label=${M.autonomy} value=${M.days(l.autonomy)} tip=${TIP.autonomy + ' ' + M.dailyNeed + ': ' + num(l.daily) + '.'} />
      <${Stat} label="Capienza" value=${l.meals + ' · ' + l.soldiers + ' · ' + l.knights} tip=${TIP.capacity} />
    </div>
    ${l.shortfall > 0 && html`<p class="u2-warn">${M.shortfall(l.shortfall)}</p>`}
    ${l.stores.map(s => html`<div class="u2-store">
      <span class="u2-label">${M.stores[s.id]}</span>
      <div class="u2-meter" data-tip=${M.stores[s.id]} data-tip-body=${num(s.stock, 0) + ' / ' + num(s.cap, 0)}><${Bar} value=${s.stock} max=${s.cap} /></div>
      <div class="u2-store-add">${(STORE_KEYS[s.id] || []).map(k => html`
        <button type="button" class="u2-mini" disabled=${!transfers[k]?.enabled} aria-label=${M.store + ' ' + (M.goods[k] || M.stores[k] || k)}
          data-tip=${M.store + ' ' + (M.goods[k] || M.stores[k] || k)} data-tip-body=${TIP.store}
          onClick=${() => game.commands.storeInCastle(k)}>+${STORE_KEYS[s.id].length > 1 ? (M.goods[k] || k).slice(0, 1) : ''}</button>`)}</div>
    </div>`)}`;
}
function GameInfo({ game }) {
  const v = game.read.village();
  return html`<div class="u2-stats">
      <${Stat} label=${M.village} value=${v.name || '—'} tip=${v.name ? null : M.notFounded} />
      <${Stat} label=${M.biome} value=${M.biomes[v.biome] || v.biome} />
      <${Stat} label=${M.seed} value=${v.seed} />
    </div>
    <button type="button" class="u2-primary" data-tip=${M.save} data-tip-body=${TIP.save} onClick=${game.commands.saveCloud}>${M.save}</button>`;
}
const MANAGE_VIEWS = { overview: Overview, policies: Policies, market: Market, activities: Activities, castle: CastleStores, game: GameInfo };
function ManageCard({ section, game }) {
  const View = MANAGE_VIEWS[section];
  return html`<${Card} title=${M.sections[section]} wide=${section === 'market' || section === 'activities'}>${View && html`<${View} game=${game} />`}</${Card}>`;
}

// ---------- Difendi ----------
const D = T.defend, DT = T.defendTips;
const DEFEND_SECTIONS = ['command', 'zones', 'patrols', 'alarm'].concat(devEnabled ? ['tests'] : []);
function DefendRail({ section, setSection }) {
  return html`<nav class="u2-tablet u2-rail" aria-label=${T.modes.defend}>
    ${DEFEND_SECTIONS.map(id => html`
      <button type="button" class=${'u2-tool' + (section === id ? ' on' : '')} aria-label=${D.sections[id]}
        aria-pressed=${section === id} data-tip=${D.sections[id]} onClick=${() => setSection(id)}><${Icon} name=${id} size=${22} /></button>`)}
  </nav>`;
}
function DefendCard({ section, game, snap }) {
  const s = game.read.defense(), def = game.commands.defense, tool = snap.tool;
  if (!s || !s.active) return html`<${Card} title=${D.title}><p class="u2-hint">${D.notActive}</p></${Card}>`;
  const opt = (label, tipKey, extra = {}) => ({ label, tip: label, tipBody: DT[tipKey] || null, ...extra });
  let body = null;
  if (section === 'command') body = html`
    <${Row} label=${D.orders} tip=${DT.orders}><${Seg} options=${[
      opt(D.orders, 'orders', { active: tool.kind === 'combat-orders', a: 'orders' }),
      opt(D.deselect, null, { disabled: s.selected === 0, a: 'deselect' })]} onPick=${o => def(o.a)} /></${Row}>
    ${s.focused && html`<div class="u2-stats">
      <${Stat} label=${D.selected} value=${s.selected > 1 ? s.selected : D.focused[s.focused.kind] || s.focused.kind} />
      <${Stat} label=${D.hp} value=${s.focused.hp != null ? s.focused.hp + '/' + s.focused.maxHp : '—'}>
        ${s.focused.hp != null && html`<${Bar} value=${s.focused.hp} max=${s.focused.maxHp} />`}</${Stat}></div>`}`;
  if (section === 'zones') body = html`
    <${Row} label=${D.brush} tip=${DT.brush}><${Seg} options=${Object.keys(D.brushes).map(k =>
      ({ label: D.brushes[k], active: tool.kind === 'combat-brush' && tool.combatBrush === k, k }))} onPick=${o => def('brush', o.k)} /></${Row}>
    <${Row} label=${D.radius} tip=${DT.radius}><div class="u2-slider">
      <input type="range" min="1" max="16" value=${s.brushRadius} aria-label=${D.radius} onInput=${e => def('brushRadius', e.currentTarget.value)} />
      <b>${s.brushRadius}U</b></div></${Row}>`;
  if (section === 'patrols') body = html`
    <${Row} label=${D.patrols + ' ' + s.patrols} tip=${DT.patrols}><${Seg} options=${[
      { label: D.patrolRemove, disabled: s.patrols === 0, a: 'patrolRemove' }, { label: D.patrolAdd, a: 'patrolAdd' }]} onPick=${o => def(o.a)} /></${Row}>`;
  if (section === 'alarm') body = html`
    <${Row} label=${D.bell} tip=${DT.bell}><${Seg} options=${['off', 'green', 'hall'].map(m =>
      ({ label: D.alarmModes[m], active: s.alarm === m, m }))} onPick=${o => def('alarm', o.m)} /></${Row}>
    ${s.buckets != null && html`<${Row} label=${D.buckets} tip=${DT.buckets}>
      <${Seg} options=${[{ label: s.buckets ? I.on : I.off, active: s.buckets }]} onPick=${() => def('buckets')} /></${Row}>`}`;
  if (section === 'tests') body = html`
    <${Row} label=${D.testGroups.place} tip=${DT.tests}><${Seg} options=${[
      opt(D.tests.intruder, 'intruder', { active: tool.kind === 'combat-intruder' && !tool.torch, a: 'intruder' }),
      opt(D.tests.torch, 'torch', { active: tool.kind === 'combat-intruder' && tool.torch, a: 'torch' }),
      opt(D.tests.clear, 'clear', { a: 'clearEnemies' })]} onPick=${o => def(o.a)} /></${Row}>
    <${Row} label=${D.testGroups.fire}><${Seg} options=${['arrows', 'stone'].map(k =>
      opt(D.tests[k], k, { active: tool.kind === 'combat-fire' && tool.fireKind === k, k }))} onPick=${o => def('fire', o.k)} /></${Row}>
    <${Row} label=${D.testGroups.assault}><${Seg} options=${['ladder', 'tower', 'ram', 'fill'].map(k =>
      opt(D.tests[k], k, { active: tool.kind === 'combat-storm' && tool.stormKind === k, k }))} onPick=${o => def('storm', o.k)} /></${Row}>`;
  return html`<${Card} title=${D.sections[section]} sub=${D.alert[s.alert] || ''}>
    <div class="u2-stats u2-stats-4">
      <${Stat} label="Stato" value=${D.alert[s.alert] || s.alert} tip=${DT.alert} />
      <${Stat} label=${D.units} value=${s.units} />
      <${Stat} label=${D.hostiles} value=${s.hostiles} />
      <${Stat} label=${D.patrols} value=${s.patrols} tip=${DT.patrols} />
    </div>
    <${Row} label=${D.view}><${Seg} options=${[
      opt(D.fog, 'fog', { active: s.fog, a: 'fog' }), opt(D.zones, 'zones', { active: s.zones, a: 'zones' })]} onPick=${o => def(o.a)} /></${Row}>
    ${body}
  </${Card}>`;
}

function TimeBar({ snap, cmd }) {
  const c = snap.clock;
  return html`<div class="u2-tablet u2-timebar">
    <button type="button" class="u2-icon-btn" aria-label=${T.time.rotateLeft} data-tip=${T.time.rotateLeft} onClick=${() => cmd.rotate(-1)}><${Icon} name="rotateLeft" size=${18} /></button>
    <button type="button" class="u2-icon-btn" aria-label=${T.time.rotateRight} data-tip=${T.time.rotateRight} onClick=${() => cmd.rotate(1)}><${Icon} name="rotateRight" size=${18} /></button>
    <button type="button" class=${'u2-icon-btn' + (snap.view.plan ? ' on' : '')} aria-pressed=${snap.view.plan} aria-label=${T.time.plan} data-tip=${T.time.plan} onClick=${cmd.togglePlan}><${Icon} name="plan" size=${18} /></button>
    <div class="u2-date" data-tip=${c.weekday + ' ' + c.date} data-tip-body=${T.year + ' ' + c.year + ' · ' + (T.seasons[c.season] || '')} tabindex="0"><b>${c.date}</b><span>${T.seasons[c.season] || ''} · ${T.year} ${c.year}</span></div>
    <div class="u2-seg u2-seg-lg">
      <button type="button" class=${c.speed === 0 ? 'on' : ''} aria-label=${T.time.pause} data-tip=${T.time.pause} onClick=${() => cmd.setSpeed(0)}>❚❚</button>
      ${[1, 3, 10, 100].map(n => html`<button type="button" class=${c.speed === n ? 'on' : ''} aria-label=${T.time.speed(n)} data-tip=${T.time.speed(n)} onClick=${() => cmd.setSpeed(n)}>${n}×</button>`)}
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
  const [defSection, setDefSectionState] = useState(DEFEND_SECTIONS.includes(recall('conquer.ui.defend')) ? recall('conquer.ui.defend') : 'command');
  const setDefSection = s => { setDefSectionState(s); remember('conquer.ui.defend', s); };
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
    ${mode === 'defend' && html`<${DefendRail} section=${defSection} setSection=${setDefSection} /><${DefendCard} section=${defSection} game=${game} snap=${snap} />`}
    <${TimeBar} snap=${snap} cmd=${cmd} />
    <${Toast} snap=${snap} />
    <${Tooltip} />`;
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
