'use strict';
// Regional-map token kit (tools/blender/build_region_tokens.py -> src/assets/region-token-models.js):
// the five tokens exist, stay very low-poly, sit on the ground with a ~1 footprint, carry the
// owner-colour key and are listed in the Asset Lab.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(read('src/assets/region-token-models.js'), ctx);
const R = ctx.window.ConquerRegionTokenModels;
assert.ok(R && R.models, 'registry present');
assert.strictEqual(R.palette.length, R.paletteKeys.length);
const team = R.paletteKeys.indexOf('team'), teamDark = R.paletteKeys.indexOf('teamDark');
assert.ok(team >= 0 && teamDark >= 0, 'owner colour keys');

const BUDGET = { village1: 60, village2: 110, village3: 140, village4: 200, castle: 100, port: 60, ship: 40 };
// One token per marker kind of src/regional-map3d-placeholders.js (troops are sprites, below).
const placeholders = read('src/regional-map3d-placeholders.js');
for (const kind of ['village', 'castle', 'port', 'ship', 'troops']) assert.ok(placeholders.includes(`'${kind}'`), 'marker kind ' + kind);
assert.deepStrictEqual(JSON.parse(JSON.stringify(R.markers)), { village: ['village1', 'village2', 'village3', 'village4'], castle: 'castle', port: 'port', ship: 'ship' });
const HERALDRY_DEFAULT = /HERALDRY_DEFAULT=Object\.freeze\(\[([^\]]+)\]\)/.exec(placeholders)[1].match(/#[0-9a-f]{6}/gi);
assert.strictEqual(R.palette[R.paletteKeys.indexOf('team')], HERALDRY_DEFAULT[0], "'team' is the default heraldry c1");
assert.deepStrictEqual(Object.keys(R.models).sort(), Object.keys(BUDGET).sort(), 'exactly the expected tokens');
// The village grows L1 -> L4 like the game's houses: more triangles and taller each level.
for (let k = 2; k <= 4; k++) {
  const a = R.models['village' + (k - 1)], b = R.models['village' + k];
  assert.ok(b.tris > a.tris && b.height > a.height, `village${k} denser and taller than village${k - 1}`);
}
const keysOf = m => new Set(m.c.map(k => R.paletteKeys[k]));
assert.ok(keysOf(R.models.village1).has('roofThatch') && !keysOf(R.models.village1).has('houseSlate'), 'L1 thatch only');
assert.ok(keysOf(R.models.village4).has('turretRoof'), 'L4 corner turrets');
for (const [name, max] of Object.entries(BUDGET)) {
  const m = R.models[name];
  assert.ok(m, name + ' exists');
  const tris = m.i.length / 3;
  assert.strictEqual(tris, m.c.length, name + ': one colour per triangle');
  assert.strictEqual(tris, m.tris, name + ': tris metadata');
  assert.ok(tris <= max, `${name}: ${tris} tris > budget ${max}`);
  assert.ok(m.i.every(k => k >= 0 && k < m.p.length / 3), name + ': indices in range');
  assert.ok(m.c.every(k => k >= 0 && k < R.palette.length), name + ': palette indices');
  let minZ = Infinity, maxR = 0;
  for (let k = 0; k < m.p.length; k += 3) { minZ = Math.min(minZ, m.p[k + 2]); maxR = Math.max(maxR, Math.hypot(m.p[k], m.p[k + 1])); }
  assert.ok(minZ >= -0.06 && minZ <= 0.001, name + ': on the ground / waterline');
  assert.ok(maxR > 0.4 && maxR < 1.25, name + ': footprint radius ~1');
}
for (const name of ['castle', 'ship'])
  assert.ok(R.models[name].c.some(k => k === team || k === teamDark), name + ' shows the owner colour');

// Troops reuse the game's own soldier figures (tools/bake-region-troops.mjs), not a Blender mesh.
const ctxT = { window: {} }; vm.createContext(ctxT);
vm.runInContext(read('src/assets/region-troop-sprites.js'), ctxT);
const T = ctxT.window.ConquerRegionTroopSprites;
assert.ok(T && T.pxPerToken > 0 && T.formation.length >= 3, 'troop sprites + formation');
assert.deepStrictEqual([...T.heraldry], HERALDRY_DEFAULT, 'troop livery baked in the markers\' default heraldry c1/c2');
for (const kind of ['spearman', 'archer', 'knight', 'mounted']) {
  const s = T.sprites[kind];
  assert.ok(s && fs.existsSync(path.join(root, s.file)), kind + ' sprite baked');
  const png = fs.readFileSync(path.join(root, s.file));
  assert.strictEqual(png.readUInt32BE(16), s.w); assert.strictEqual(png.readUInt32BE(20), s.h);
  assert.ok(s.feetX >= 0 && s.feetX <= s.w && s.feetY > s.h * .6 && s.feetY <= s.h + 1, kind + ' feet anchor near the bottom');
}
assert.ok(T.formation.every(f => T.sprites[f.kind] && Math.hypot(f.x, f.y) < 1), 'formation inside the token footprint');
assert.match(read('src/asset-manifest.js'), /src\/assets\/regional\/troop-spearman\.png/, 'troop sprites listed in the Asset Lab');

assert.match(read('src/asset-catalog.js'), /global:'ConquerRegionTokenModels'/, 'listed in the Asset Lab catalogue');
assert.match(read('figures-lab.html'), /assets\/region-token-models\.js/, 'loaded by the Asset Lab');
console.log('region tokens ok:', Object.entries(R.models).map(([k, m]) => k + ' ' + m.tris).join(', '));
