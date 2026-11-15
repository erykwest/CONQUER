'use strict';
const assert = require('node:assert/strict');
const { validate, isOperational, REQUIRED } = require('../tools/context-guard.cjs');

assert.equal(isOperational('src/settlement-combat.js'), true);
assert.equal(isOperational('qa/fields-regression.cjs'), true);
assert.equal(isOperational('tools/context-guard.cjs'), true);
assert.equal(isOperational('index.html'), true);
assert.equal(isOperational('docs/economy.md'), false);
assert.equal(isOperational('docs/context/STATUS.md'), false);
assert.equal(isOperational('.github/workflows/webgpu-smoke.yml'), false);
for (const path of ['api/telemetry.js', 'tests/runtime-integrity.test.mjs', 'crime/index.html',
  'march/march.js', 'lab/index.html', 'layouts/TEST.json', 'figures-lab.html']) {
  assert.equal(isOperational(path), true, path + ' must require the context pyramid');
}
assert.equal(isOperational('lab/README.md'), false);
assert.equal(isOperational('laboratory/x.js'), false);
const guardSource = require('node:fs').readFileSync(require.resolve('../tools/context-guard.cjs'), 'utf8');
assert.ok(guardSource.includes("'--diff-filter=ACDMRT'"), 'context guard must see deleted files');

assert.deepEqual(validate(['docs/context/ROADMAP.md']).missing, []);
assert.deepEqual(validate(['src/app.js']).missing, REQUIRED);
assert.deepEqual(validate(['src/app.js', ...REQUIRED]).missing, []);
assert.deepEqual(validate(['qa/new-test.cjs', 'docs/context/STATUS.md']).missing,
  ['docs/context/BACKLOG.md', 'docs/context/CHANGELOG.md']);
assert.deepEqual(validate(['src/assets/tree.svg', ...REQUIRED]).missing, []);
assert.deepEqual(validate(['README.md']).relevant, []);
console.log('Context guard regression: PASS');
