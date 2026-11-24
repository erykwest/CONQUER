'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {scriptPaths,checkOrder,checkPages}=require('../tools/runtime-contract.cjs');
assert.deepEqual(scriptPaths('<script defer src="./src/owner.js?v=1"></script><script src=\'src/consumer.js\'></script>'),['owner.js','consumer.js']);
const contracts=[['consumer.js',['owner.js']]];
assert.deepEqual(checkOrder(['owner.js','consumer.js'],contracts),[]);
assert.match(checkOrder(['consumer.js'],contracts).join(),/requires missing/);
assert.match(checkOrder(['consumer.js','owner.js'],contracts).join(),/must precede/);
assert.match(checkOrder(['owner.js','owner.js','consumer.js'],contracts).join(),/Duplicate script/);
for(const r of checkPages(path.resolve(__dirname,'..'))){assert.deepEqual(r.errors,[],r.page+': '+r.errors.join('; '));assert.ok(r.scripts>50)}
console.log('PASS runtime entry-point contract: real files, unique scripts and ordered shared owners in game/CAMP');
