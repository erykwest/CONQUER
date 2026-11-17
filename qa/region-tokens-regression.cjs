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

const BUDGET = { village: 80, castle: 100, pier: 60, ship: 40, troops: 80 };
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
for (const name of ['castle', 'ship', 'troops'])
  assert.ok(R.models[name].c.some(k => k === team || k === teamDark), name + ' shows the owner colour');

assert.match(read('src/asset-catalog.js'), /global:'ConquerRegionTokenModels'/, 'listed in the Asset Lab catalogue');
assert.match(read('figures-lab.html'), /assets\/region-token-models\.js/, 'loaded by the Asset Lab');
console.log('region tokens ok:', Object.entries(R.models).map(([k, m]) => k + ' ' + m.tris).join(', '));
