import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const core=read('src/settlement-core.js');
const app=read('src/settlement-app.js');
const endpoint=read('api/telemetry.js');

test('all runtime scripts are available for syntax validation',()=>{
  const files=readdirSync(new URL('../src/',import.meta.url)).filter(x=>x.endsWith('.js'));
  assert.ok(files.length>=13);
});

test('loaded resources are never inflated by development minimums',()=>{
  assert.doesNotMatch(app,/Math\.max\(10000,\s*Number\(State\.resources\[k\]\)/);
  assert.equal((app.match(/Math\.max\(0,Number\(State\.resources\[k\]\)\|\|0\)/g)||[]).length,2);
});

test('local save traps quota and serialization failures',()=>{
  assert.match(app,/function saveLocal\(\)\{[\s\S]*?try\s*\{\s*localStorage\.setItem/);
  assert.match(app,/CONQUER local save failed/);
});

test('telemetry has no unauthenticated direct write path',()=>{
  assert.doesNotMatch(core,/rest\/v1\/simulation_telemetry/);
  assert.match(core,/function sendRemote\(_sample\)\{ return; \}/);
});

test('telemetry endpoint exposes neither public samples nor public inserts',()=>{
  assert.doesNotMatch(endpoint,/buffer\.slice|req\.body|console\.log/);
  assert.match(endpoint,/telemetry_disabled/);
  assert.match(endpoint,/status\(404\)/);
});
