#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dir=path.join(root,'.github/workflows');
const workflows=fs.readdirSync(dir).filter(x=>x.endsWith('.yml')).sort();
assert.equal(workflows.length,26,'P0 workflow inventory must remain intact');
const f=name=>read('.github/workflows/'+name);
for(const name of workflows){
  const s=f(name);
  assert.match(s,/^concurrency:/m,'missing cancellation configuration in '+name);
  assert.ok(s.includes("github.event.pull_request.number || github.ref"),name+' must isolate PR refs');
  assert.ok(s.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"),name+' must not cancel completed/main/scheduled verification');
}
// P2.3: no push triggers pointing to deleted remote branches (verified 2026-11-06).
// Preserve push validation on main, PR coverage on all seven specialist workflows.
for(const name of ['camp-regression.yml','gate-six-sockets-regression.yml','sea-regression.yml']){
  const workflow=f(name);
  assert.doesNotMatch(workflow,/^  push:/m,name+' has an obsolete push-only branch');
  assert.match(workflow,/^  pull_request:/m,name+' lost PR validation');
}
for(const name of ['cans-regression.yml','circle-regression.yml','combat-regression.yml','runtime-integrity.yml']){
  const workflow=f(name);
  assert.match(workflow,/^  push:\n    branches: \[main\]/m,name+' must retain main push only');
  assert.match(workflow,/^  pull_request:/m,name+' lost PR validation');
}
const action=read('.github/actions/playwright-setup/action.yml');
for(const item of ['playwright@1.56.1','actions/cache@v4','~/.cache/ms-playwright','~/.npm','npx playwright install chromium','npx playwright install-deps chromium','chromium.launch({headless:true})'])
 assert.ok(action.includes(item),'shared browser setup missing '+item);
for(const name of ['asset-lab-regression.yml','converge-regression.yml','main-fixes-regression.yml','panels-browser-preview.yml','webgpu-smoke.yml','codex-wiki.yml']){
 const s=f(name);
 assert.ok(s.includes('./.github/actions/playwright-setup'),name+' bypasses shared Chromium cache');
 assert.ok(s.includes('.github/actions/playwright-setup/action.yml'),name+' does not rerun when browser action changes');
 assert.ok(!s.includes('playwright@1.55.0'),name+' still installs old browser version');
}
const settle=f('settlement-routing-spawn.yml');
assert.ok(settle.includes("node qa/ci-p1-regression.cjs"),'P1 guard must execute on every PR');
assert.ok(settle.includes('(core|app|app-simulation|app-persistence|world|world3d|castle3d|placement|castle-placement|population-navigation)'), '3D world/castle changes must receive complete suite');
const asset=f('asset-lab-regression.yml');
assert.ok(asset.includes('needs: asset-lab')&&asset.includes("if: needs.asset-lab.outputs.visual_needed == 'true'"),'Asset Lab must skip expensive visual audit only for non-visual PRs');
assert.ok(asset.includes('audit_mode=full')&&asset.includes('node qa/asset-audit-scope.cjs')&&asset.includes('audit_sources'), 'asset scope must fail safe and publish explicit audit mode');
assert.ok(asset.includes('workflow_dispatch:')&&asset.includes('schedule:'),'visual audit must remain manually and periodically exhaustive');
assert.ok(asset.includes('node qa/asset-audit-scope-regression.cjs'),'asset scope guards must run before browser');
assert.ok(asset.includes('src/settlement-world3d.js'), 'world3d must be covered by Asset Lab audit');
assert.ok(asset.includes('node qa/asset-audit.mjs'),'retain exhaustive asset audit');
const main=f('main-fixes-regression.yml'),gate=f('gate-six-sockets-regression.yml'),gpu=f('webgpu-smoke.yml');
for(const [name,s] of [['main-fixes',main],['gate',gate],['WebGPU',gpu]])assert.ok(!s.includes('for test in qa/*-regression.cjs'),name+' repeats P0 complete suite');
assert.ok(!main.includes('node qa/asset-audit.mjs'),'Asset Lab audit must have one CI owner');
assert.ok(!main.includes('node tools/context-guard.cjs'),'Context pyramid guard must have one CI owner');
assert.ok(!gate.includes('settlement-all:'),'Gate workflow still repeats full suite');
assert.ok(gpu.includes('pull_request:')&&gpu.includes('src/settlement-webgpu.js')&&gpu.includes('node qa/occlusion-clip-regression.cjs'),'WebGPU checks need scoped browser and renderer regressions');
assert.ok(!f('combat-regression.yml').includes('  pull_request:\npermissions:'),'Combat PR must be path filtered');
for(const name of ['combat-regression.yml','economy-flows-regression.yml'])assert.ok(!f(name).includes('node qa/save-safety-regression.cjs'),name+' duplicates always-on Runtime integrity');
assert.ok(f('runtime-integrity.yml').includes('node qa/save-safety-regression.cjs'),'never drop save safety coverage');
assert.ok(f('context-governance.yml').includes('node tools/context-guard.cjs'),'never drop documentation governance');
assert.ok(settle.includes('qa/*-regression.cjs'),'complete deterministic tests must stay available');
console.log('PASS CI P1: 26 concurrent workflows; 6 cached browser jobs; no duplicate full deterministic runners; preserved risk, economy, runtime and governance tests.');
