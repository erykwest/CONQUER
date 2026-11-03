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

assert.deepEqual(validate(['docs/context/ROADMAP.md']).missing, []);
assert.deepEqual(validate(['src/app.js']).missing, REQUIRED);
assert.deepEqual(validate(['src/app.js', ...REQUIRED]).missing, []);
assert.deepEqual(validate(['qa/new-test.cjs', 'docs/context/STATUS.md']).missing,
  ['docs/context/BACKLOG.md', 'docs/context/CHANGELOG.md']);
assert.deepEqual(validate(['src/assets/tree.svg', ...REQUIRED]).missing, []);
assert.deepEqual(validate(['README.md']).relevant, []);
console.log('Context guard regression: PASS');
