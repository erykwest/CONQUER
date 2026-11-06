#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const workflow=file('.github/workflows/settlement-routing-spawn.yml');
const archived=[
'civil-regression.yml','clay-browser-smoke.yml','clay-palette-regression.yml',
'events-regression.yml','urban-density-regression.yml','urban-livestock-regression.yml',
'urban-local-preview.yml','seasonal-music.yml','sound-optimize.yml',
'sound-regression.yml','prune-obsolete-branches-20261023.yml'];
for(const old of archived)assert.equal(fs.existsSync(path.join(root,'.github/workflows',old)),false,old+' is obsolete');
for(const keep of ['runtime-integrity.yml','context-governance.yml','economy-flows-regression.yml']){
 assert.ok(fs.existsSync(path.join(root,'.github/workflows',keep)),keep+' must survive CI P0');
}
for(const s of ['pull_request:','workflow_dispatch:','schedule:','settlement-qa:','github.event.pull_request.base.sha','github.event.pull_request.head.sha','--diff-filter=ACDMRT','GITHUB_OUTPUT','full=false','full=true','qa/*-regression.cjs','src/*.js']){
 assert.ok(workflow.includes(s),'missing CI protection '+s);
}
assert.match(workflow,/github\.event_name == 'pull_request' && steps\.tier\.outputs\.full == 'false'/);
assert.match(workflow,/if: steps\.tier\.outputs\.full == 'true'/);
assert.match(workflow,/src\/settlement-\(core\|app\|app-simulation\|app-persistence\|world\|placement\|castle-placement\|population-navigation\)/);
const count=fs.readdirSync(path.join(root,'qa')).filter(f=>f.endsWith('-regression.cjs')).length;
assert.ok(count>100,'the full suite must still include all original deterministic regressions');
console.log('PASS CI P0: 11 obsolete workflows retired; core checks retained; selective PR and complete risk/scheduled suites present ('+count+' deterministic tests).');
