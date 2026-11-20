// UI v2 alert center: conditions, one-shot events, dismissal and journal (no browser).
// Run: node qa/ui-alerts-regression.mjs
import assert from 'node:assert/strict';
import { createAlertCenter } from '../src/ui/alerts.js';

let t = 0;
const center = createAlertCenter({ now: () => t, resolvedLinger: 1000, resolveGrace: 0, eventTtl: 2000, dangerTtl: 5000, maxVisible: 3 });

// Grace: a condition that blinks off for less than resolveGrace is not resolved (weekend pauses).
{
  let u = 0;
  const flap = createAlertCenter({ now: () => u, resolveGrace: 3000 });
  const site = [{ key: 'site', severity: 'warn', title: 'Cantiere fermo' }];
  flap.sync(site, 1);
  u = 1000; flap.sync([], 2);
  u = 2000; flap.sync([], 2);
  u = 2500; flap.sync(site, 3);
  u = 6000; flap.sync(site, 4);
  assert.deepEqual(flap.journal().map(e => e.phase), ['raised'], 'short gaps do not resolve or re-raise');
  u = 7000; flap.sync([], 5);
  u = 9999; flap.sync([], 5);
  assert.equal(flap.visible().items[0].resolved, false);
  u = 10000; flap.sync([], 5);
  assert.equal(flap.visible().items[0].resolved, true);
  assert.deepEqual(flap.journal().map(e => e.phase), ['resolved', 'raised']);
}
const keys = () => center.visible().items.map(a => a.key);
let notified = 0;
center.subscribe(() => notified++);

// A condition appears, stays while true and is logged once.
center.sync([{ key: 'fire', severity: 'danger', title: 'Incendio', detail: 'Torre 1', resolvedTitle: 'Incendio spento' }], 10);
center.sync([{ key: 'fire', severity: 'danger', title: 'Incendio', detail: 'Torre 1', resolvedTitle: 'Incendio spento' }], 10);
assert.deepEqual(keys(), ['fire']);
assert.equal(center.journal().length, 1);
assert.equal(center.journal()[0].phase, 'raised');
assert.ok(notified >= 1);
t = 100000;
assert.deepEqual(keys(), ['fire'], 'an active condition never expires');

// Resolution: shown as resolved for the linger time, then gone by itself; journal records it.
center.sync([], 11);
let v = center.visible().items[0];
assert.equal(v.resolved, true);
assert.equal(v.title, 'Incendio spento');
assert.equal(v.severity, 'good');
assert.equal(center.journal()[0].phase, 'resolved');
t += 999; center.tick(); assert.deepEqual(keys(), ['fire']);
t += 2; center.tick(); assert.deepEqual(keys(), [], 'resolved alert auto-dismissed');

// Manual dismissal of an active condition: quiet while it holds, back when it worsens.
center.sync([{ key: 'siege', severity: 'warn', title: 'Allerta locale' }], 12);
assert.ok(center.dismiss('siege'));
center.sync([{ key: 'siege', severity: 'warn', title: 'Allerta locale' }], 12);
assert.deepEqual(keys(), []);
center.sync([{ key: 'siege', severity: 'danger', title: 'Allarme generale' }], 12);
assert.deepEqual(keys(), ['siege'], 'a worse condition comes back after dismissal');
assert.equal(center.visible().items[0].title, 'Allarme generale');
// Dismissed then resolved then re-raised: a fresh alert.
center.dismiss('siege');
center.sync([], 13);
center.sync([{ key: 'siege', severity: 'warn', title: 'Allerta locale' }], 14);
assert.deepEqual(keys(), ['siege']);
assert.equal(center.active().includes('siege'), true);
center.sync([], 15); t += 5000; center.tick();

// Events expire by themselves; danger events last longer.
center.push({ key: 'done-1', severity: 'info', title: 'Costruzione completata' }, 16);
center.push({ key: 'lost-1', severity: 'danger', title: 'Struttura distrutta' }, 16);
t += 2001; center.tick();
assert.deepEqual(keys(), ['lost-1']);
t += 3000; center.tick();
assert.deepEqual(keys(), []);
// Remaining-time fraction for the progress bar.
center.push({ key: 'x', title: 'X' }, 17);
t += 500;
assert.equal(center.visible().items[0].remaining, 0.75);
center.dismiss('x');

// Ordering and overflow: active before resolved, danger before warn before info, newest first.
center.sync([{ key: 'a', severity: 'info', title: 'A' }, { key: 'b', severity: 'warn', title: 'B' }], 18);
t += 1;
center.sync([{ key: 'a', severity: 'info', title: 'A' }, { key: 'b', severity: 'warn', title: 'B' }, { key: 'c', severity: 'danger', title: 'C' }, { key: 'd', severity: 'warn', title: 'D' }], 18);
const vis = center.visible();
assert.deepEqual(vis.items.map(a => a.key), ['c', 'd', 'b']);
assert.equal(vis.hidden, 1);
assert.equal(vis.active, 4);
assert.ok(center.dismissAll());
assert.deepEqual(keys(), []);

// Journal: newest first, bounded, export/import round trip.
const journal = center.exportJournal();
assert.ok(journal.length > 8);
assert.ok(journal[0].at >= journal[journal.length - 1].at);
const copy = createAlertCenter({ now: () => t, journalMax: 4 });
assert.equal(copy.importJournal(journal), 4);
assert.equal(copy.importJournal('nope'), 0);
assert.equal(copy.journal().length, 4);
const small = createAlertCenter({ now: () => t, journalMax: 2 });
for (let i = 0; i < 5; i++) small.push({ title: 'E' + i });
assert.deepEqual(small.journal().map(e => e.title), ['E4', 'E3']);

// Actions (messages): kept while active, dropped once resolved, carried into the journal.
{
  let u = 0;
  const box = createAlertCenter({ now: () => u, resolveGrace: 0 });
  const letter = [{ key: 'message-courier-3', severity: 'warn', category: 'messages', title: 'Messaggero alla porta',
    resolvedTitle: 'Messaggio evaso', action: { id: 'readLetter', label: 'Leggi il messaggio' } }];
  box.sync(letter, 1);
  assert.deepEqual(box.visible().items[0].action, { id: 'readLetter', label: 'Leggi il messaggio', arg: null });
  assert.equal(box.journal()[0].action.id, 'readLetter');
  box.sync([], 2);
  assert.equal(box.visible().items[0].action, null, 'nothing to act on once answered');
  assert.equal(box.journal()[0].action, null);
  box.push({ key: 'c', title: 'Carovana partita', action: { id: 'caravans', label: 'Apri carovane', arg: 'caravan-1' } }, 3);
  assert.equal(box.visible().items.find(a => a.key === 'c').action.arg, 'caravan-1');
}

// End to end without a browser: game events read by the watchers reach the feed (MSG-FEED-261118).
{
  const { createWatchers } = await import('../src/ui/alert-watchers.js');
  let u = 0;
  const box = createAlertCenter({ now: () => u, resolveGrace: 0 });
  const goal = { x: 41, y: 57 };
  const State = globalThis.State = { seed: 9, village: { name: 'Prova', founded: false }, clock: { day: 3 }, diplomacy: { version: 1, incoming: null, history: [] },
    structures: [{ id: 'site-1', type: 'tower', construction: { version: 1 } }] };
  globalThis.underConstruction = s => !!s.construction;
  const game = { read: { defense: () => ({ alert: 'clear' }), logistics: () => null }, snapshot: () => ({ saveStatus: 'saved' }) };
  const w = createWatchers(game, box, { now: () => u, structureNames: { tower: 'Torre' } });
  w.poll(); // first poll only seeds
  assert.equal(box.visible().items.length, 0, 'nothing announced at load');

  State.diplomacy.incoming = { id: 'courier-0', edge: 'west', phase: 'arriving', by: 'courier', request: 100, goal };
  u = 1000; w.poll();
  const arrive = box.visible().items.find(a => a.key === 'msg-arrive-courier-0');
  assert.ok(arrive, 'a messenger setting out shows up in the feed');
  assert.equal(arrive.title, 'Messaggero in arrivo');
  assert.deepEqual(arrive.at, goal, 'and can be shown on the map at the keep door');

  State.diplomacy.incoming.phase = 'waiting';
  u = 2000; w.poll();
  const wait = box.visible().items.find(a => a.key === 'message-courier-0');
  assert.ok(wait && wait.action.id === 'readLetter', 'a waiting messenger is a condition with "Leggi il messaggio"');
  assert.deepEqual(wait.at, goal);

  delete State.structures[0].construction;
  u = 3000; w.poll();
  const done = box.visible().items.find(a => a.key === 'done-site-1');
  assert.ok(done && done.title === 'Costruzione completata' && done.focusId === 'site-1', 'a finished site shows up with its structure');
  assert.equal(done.detail, 'Torre');

  // Reload: the journal comes back from storage and the same waiting messenger is not logged twice.
  const saved = box.exportJournal();
  const again = createAlertCenter({ now: () => u, resolveGrace: 0 });
  again.importJournal(saved);
  const w2 = createWatchers(game, again, { now: () => u });
  w2.poll();
  assert.equal(again.visible().items.find(a => a.key === 'message-courier-0')?.title, 'Messaggero alla porta del Mastio', 'still on screen after a reload');
  assert.equal(again.journal().filter(e => e.key === 'message-courier-0' && e.phase === 'raised').length, 1, 'not logged twice after a reload');

  State.diplomacy.incoming = null;
  u = 4000; w.poll();
  assert.equal(box.journal()[0].title, 'Messaggio evaso', 'answering resolves it');
  assert.equal(box.journal()[0].at, null, 'a resolved entry has nothing to show');
  delete globalThis.State; delete globalThis.underConstruction;
}

// "Mostra sulla mappa": the genuine ConquerGame.commands.focus centres the camera on a structure or a map point.
{
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const api = readFileSync(new URL('../src/ui/game-api.js', import.meta.url), 'utf8');
  const start = api.indexOf('focus: (id, at) => {');
  assert.ok(start > 0, 'game-api exposes commands.focus');
  const end = api.indexOf('\n    },', start);
  const src = api.slice(start + 'focus: '.length, end + '\n    }'.length);
  let selected = null, drawn = 0;
  const ctx = vm.createContext({
    State: { view: { x: 0, y: 0, scale: 1 }, structures: [{ id: 'keep', x: 30, y: 20 }] },
    terrainElevation: () => 0, wrap: { getBoundingClientRect: () => ({ width: 800, height: 600 }) },
    // Screen = world * 10 + view offset.
    w2sRaw: p => ({ x: p.x * 10 + ctx.State.view.x, y: p.y * 10 + ctx.State.view.y }),
    invalidateSceneCache() {}, selectStructure: s => { selected = s; }, draw: () => { drawn++; }, emit() {}
  });
  const focus = vm.runInContext('(' + src + ')', ctx);
  const centred = p => { const q = ctx.w2sRaw(p); return Math.abs(q.x - 400) < 1e-9 && Math.abs(q.y - 300) < 1e-9; };
  assert.ok(focus('keep'), 'focus on a structure');
  assert.ok(centred({ x: 30, y: 20 }), 'the structure is in the centre of the view');
  assert.equal(selected?.id, 'keep', 'and it is selected');
  selected = null;
  assert.ok(focus(null, { x: 5, y: 70 }), 'focus on a bare map point (messenger at the door)');
  assert.ok(centred({ x: 5, y: 70 }), 'the point is in the centre of the view');
  assert.equal(selected, null, 'a bare point selects nothing');
  assert.equal(focus('missing', null), false, 'nothing to show: the camera does not move');
  assert.equal(drawn, 2);
}

// The classic (default) interface mounts the same alert feed: notifications are not reserved to ?ui=2.
{
  const { readFileSync } = await import('node:fs');
  const shell = readFileSync(new URL('../src/ui/shell.js', import.meta.url), 'utf8');
  assert.match(shell, /\} else if \(window\.ConquerGame && !window\.__CONQUER_ASSET_LAB__ && document\.getElementById\('wrap'\)\) \{[\s\S]*?render\(html`<\$\{LegacyAlerts\} \/>`/, 'legacy UI renders the alert overlay');
  assert.match(shell, /function LegacyAlerts\(\)[\s\S]*?useAlertWatchers\(game\)[\s\S]*?<\$\{Alerts\}/, 'with the shared watchers and the notice stack');
  assert.match(shell, /cmd\.focus\(a\.focusId, a\.at\)/, 'the notice button moves the camera');
}

console.log('ui-alerts-regression: ok');
