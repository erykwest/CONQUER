#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {planChanges,resolveTargets,formatOutput,REGISTRY_SOURCES,shardIds}=require('./asset-audit-scope.cjs');
const mode=diff=>planChanges(diff).mode;
assert.equal(mode('M\tsrc/assets/forest/tree_01_tonda.svg\n'),'incremental');
assert.deepEqual(planChanges('M\tsrc/assets/forest/tree_01_tonda.svg\n').sources,
  ['src/assets/forest/tree_01_tonda.svg']);
assert.equal(mode('M\tsrc/assets/industry-models.js\n'),'incremental');
assert.equal(mode('M\tsrc/assets/animal-models.js\nM\tdocs/CI.md\n'),'incremental');
assert.equal(mode('M\tsrc/assets/bushes/bush_01_tondo.svg\nM\tsrc/assets/heraldry/her1.svg\n'),'incremental');
assert.equal(mode('M\tsrc/assets/sounds/freesound_community-market-74496.mp3\n'),'skip');
assert.equal(mode('M\tdocs/CI.md\n'),'skip');
assert.equal(mode('M\tsrc/assets/architecture/gate_portal.png\n'),'full');
assert.equal(mode('M\tsrc/assets/wood-fort-models.js\n'),'full');
assert.equal(mode('M\tindex.html\n'),'full');
// Interface-only changes: gallery smoke, no visual audit.
const uiPatch='--- a/index.html\n+++ b/index.html\n@@ -1 +1 @@\n-<aside id="policy" class="panel"><h2>Settlement</h2>\n+<section class="profile-section" id="profileGovernance" hidden>\n';
const plan=(d,p)=>planChanges(d,{indexHtmlPatch:p}).mode;
assert.equal(plan('M\tindex.html\nM\tsrc/settlement-heraldry.js\nM\tsrc/settlement.css\nM\tsrc/ui/theme.css\nM\tdocs/context/STATUS.md\n',uiPatch),'smoke');
assert.equal(plan('M\tsrc/ui/shell.js\n'),'smoke');
assert.equal(plan('M\tindex.html\n',uiPatch+'+<script src="./src/new.js"></script>\n'),'full');
assert.equal(plan('M\tindex.html\n',uiPatch+'-<link rel="stylesheet" href="./src/x.css">\n'),'full');
assert.equal(plan('M\tindex.html\n',uiPatch+'+<canvas id="x"></canvas>\n'),'full');
assert.equal(plan('M\tindex.html\n',''),'full');
assert.equal(plan('A\tsrc/ui/new.js\n'),'full');
assert.equal(plan('M\tsrc/ui/theme.css\nM\tsrc/settlement-world3d.js\n'),'full');
assert.equal(plan('M\tsrc/ui/theme.css\nM\tsrc/assets/industry-models.js\n'),'incremental');
assert.match(formatOutput(planChanges('M\tsrc/ui/theme.css\n')),/visual_needed=true\naudit_mode=smoke/);
// Shards: whole families, every entry exactly once, balanced by rendered states.
const big=[];
for(let f=0;f<9;f++)for(let i=0;i<5;i++)big.push({id:'castle:f'+f+'-'+i,category:'Fortificazioni',family:'F'+f,states:Array(f%3+1).fill(0)});
for(let i=0;i<40;i++)big.push({id:'model:m'+i,category:'C'+(i%6),family:'',states:null});
const shards=[0,1,2,3].map(i=>shardIds(big,i,4));
assert.deepEqual(shards.flat().sort(),big.map(x=>x.id).sort());
for(const s of shards)for(let f=0;f<9;f++){const n=s.filter(id=>id.startsWith('castle:f'+f+'-')).length;assert.ok(n===0||n===5,'family split across shards')}
const cost=s=>s.reduce((a,id)=>{const x=big.find(y=>y.id===id);return a+(x.states?x.states.length:1)},0);
const costs=shards.map(cost);assert.ok(Math.max(...costs)-Math.min(...costs)<=15,JSON.stringify(costs));
assert.throws(()=>shardIds(big,4,4));
assert.equal(mode('M\tsrc/settlement-castle3d.js\n'),'full');
assert.equal(mode('M\tqa/asset-audit.mjs\n'),'full');
assert.equal(mode('M\t.github/workflows/asset-lab-regression.yml\n'),'full');
assert.equal(mode('M\tsrc/assets/industry-models.js\nM\tsrc/settlement-world3d.js\n'),'full');
assert.equal(mode('A\tsrc/assets/forest/new_tree.svg\n'),'full');
assert.equal(mode('D\tsrc/assets/forest/tree_01_tonda.svg\n'),'full');
assert.equal(mode('R100\tsrc/assets/forest/a.svg\tsrc/assets/forest/b.svg\n'),'full');
assert.equal(mode('T\tsrc/assets/forest/tree_01_tonda.svg\n'),'full');
assert.equal(mode(''),'full');
assert.equal(mode('unknown data'),'full');
assert.equal(mode(['a','b','c','d','e'].map(s=>'M\tsrc/assets/forest/'+s+'.svg').join('\n')+'\n'),'full');
assert.ok(Object.keys(REGISTRY_SOURCES).length>=6,'model source inventory must remain meaningful');
assert.match(formatOutput(planChanges('M\tsrc/assets/forest/tree_01_tonda.svg\n')),/visual_needed=true/);
assert.match(formatOutput(planChanges('M\tdocs\/CI.md\n')),/visual_needed=false/);
const cat=[
  {id:'file:src/assets/forest/tree_01_tonda.svg',source:'src/assets/forest/tree_01_tonda.svg',kind:'file',family:'forest'},
  {id:'model:ConquerIndustryModels:quarry',source:'src/assets/industry-models.js',kind:'model',family:'Industrie'},
  {id:'model:ConquerIndustryModels:loggingCamp',source:'src/assets/industry-models.js',kind:'model',family:'Industrie'},
  {id:'model:ConquerScatterModel:rock',source:'src/assets/scatter-model.js',kind:'model',family:'Rocce'},
  {id:'model:ConquerScatterModel:barrel',source:'src/assets/scatter-model.js',kind:'model',family:'Arredi'}
];
const baseline={
  'model:ConquerIndustryModels:quarry|':{signature:[]},
  'model:ConquerIndustryModels:loggingCamp|':{signature:[]},
  'model:ConquerScatterModel:rock|':{signature:[]},
  'model:ConquerScatterModel:barrel|':{signature:[]}
};
assert.deepEqual(resolveTargets(cat,['src/assets/forest/tree_01_tonda.svg'],baseline).ids,
  ['file:src/assets/forest/tree_01_tonda.svg']);
assert.deepEqual(resolveTargets(cat,['src/assets/industry-models.js'],baseline).ids,
  ['model:ConquerIndustryModels:loggingCamp','model:ConquerIndustryModels:quarry']);
assert.deepEqual(resolveTargets(cat,['src/assets/scatter-model.js'],baseline).ids,
  ['model:ConquerScatterModel:barrel','model:ConquerScatterModel:rock']);
assert.equal(resolveTargets(cat,['src/assets/architecture/gate_portal.png'],baseline).mode,'full');
assert.equal(resolveTargets(cat,['src/assets/forest/tree_99_deleted.svg'],baseline).mode,'full');
assert.equal(resolveTargets(cat,['src/assets/industry-models.js'],{
  ...baseline,'model:ConquerIndustryModels:deleted|':{signature:[]}}).mode,'full');
assert.equal(resolveTargets(cat,['src/assets/industry-models.js'],{}).mode,'full');
assert.equal(resolveTargets(cat,[],baseline).mode,'full');
assert.equal(resolveTargets([],['src/assets/industry-models.js'],baseline).mode,'full');
console.log('PASS Asset Lab P2.1: isolated images/registries, grouped sources, full fallback on unknown/add/delete/rename/shared changes, reviewed catalog mapping and disappeared models.');
