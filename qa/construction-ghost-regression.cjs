'use strict';
// Construction ghost: a building site without a piece-by-piece assembly (industries, storage
// yards, wells, piers, quays, ramps, civic annexes, event venues) shows its finished World 3D
// building as a translucent ghost, never just the hollow footprint outline. Sites with an
// assembly, placement previews and finished buildings are unchanged.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');

// ---- World 3D: the per-structure builder is shared by the buildings buffer and the ghost
const w3d=read('settlement-world3d.js');
assert.match(w3d,/function addStructure\(m,s,winter\)/,'one builder per finished structure');
assert.match(w3d,/if\(underConstruction\(s\)\)continue;\s*addStructure\(m,s,winter\);/,'the buildings buffer uses it for finished structures');
assert.match(w3d,/function finishedMesh\(s\)[\s\S]*?addStructure\(m,s,/,'the ghost mesh is the same finished building');
assert.match(w3d,/window\.ConquerWorld3D=\{[\s\S]*?finishedMesh,/,'finishedMesh is exported');
console.log('PASS World 3D: finished-building builder shared with the site ghost');

// ---- settlement-render.js: drawStructure and the site ghost, run against stubs
const src=read('settlement-render.js');
const start=src.indexOf('function drawStructure('),end=src.indexOf('// Preserve the normal translucent preview');
assert.ok(start>0&&end>start,'drawStructure and the site ghost are found');
const calls=[];
const alphas=[];
const ctx={globalAlpha:1,save(){alphas.push(this.globalAlpha)},restore(){this.globalAlpha=alphas.pop()}};
const mesh={pos:[0,0,0,1,0,0,0,1,1],col:['#808080'],flat:true};
let finished=mesh,assemblyHas=false;
const env={
  window:{},console,Math,Number,String,Map,Set,Object,Array,JSON,
  State:{structures:[],season:'summer',visualPalette:'',stonePaletteId:'gray'},
  ctx,
  underConstruction:s=>!!s.construction,
  isPlacementFoundationBuilding:()=>false,
  withStructureGroundPlane:(s,f)=>f(),withProjectionGroundZ:(z,f)=>f(),
  drawConstructionProgress:s=>calls.push(['progress',s.id]),
  drawPlacementVolume:s=>calls.push(['footprint',s.id]),
  drawAutoStructure:()=>{},
  structureVisualKey:s=>s.type+'|'+s.x+'|'+s.y,
  structureCenter:s=>({x:s.x,y:s.y}),
  terrainElevation:()=>0,
  worldPointVisible:()=>true,
};
env.window.ConquerAssembly={has:()=>assemblyHas,draw:s=>{calls.push(['assembly',s.id]);return true}};
env.window.ConquerWorld3D={finishedMesh:s=>{calls.push(['finishedMesh',s.id]);return finished}};
env.window.ConquerMesh3D={drawCached:(c,id,key,build,anchor)=>{calls.push(['ghost',id,c.globalAlpha,build()[0]===mesh]);return 1}};
env.globalThis=env;
vm.createContext(env);
vm.runInContext(src.slice(start,end)+';this.drawStructure=drawStructure;this.SITE_GHOST_ALPHA=SITE_GHOST_ALPHA;',env);
const kinds=(list,k)=>list.filter(c=>c[0]===k);

// A mill site: ghost of the finished mill, translucent, no hollow outline; progress bar kept.
const mill={id:'mill',type:'windmill',x:10,y:10,construction:{startedDay:0,completeDay:10}};
env.drawStructure(mill);
assert.equal(kinds(calls,'ghost').length,1,'the site draws its ghost');
assert.equal(kinds(calls,'ghost')[0][1],'ghost:mill');
assert.ok(kinds(calls,'ghost')[0][2]>0&&kinds(calls,'ghost')[0][2]<1,'the ghost is translucent');
assert.equal(kinds(calls,'ghost')[0][3],true,'the ghost is the finished World 3D mesh');
assert.equal(kinds(calls,'footprint').length,0,'no hollow footprint outline when the ghost exists');
assert.equal(kinds(calls,'progress').length,1,'the progress bar stays');
assert.equal(ctx.globalAlpha,1,'the alpha is restored');
// The mesh is cached: a second frame does not rebuild it.
calls.length=0;env.drawStructure(mill);
assert.equal(kinds(calls,'finishedMesh').length,0,'the ghost mesh is cached between frames');
assert.equal(kinds(calls,'ghost').length,1);
console.log('PASS site without assembly: translucent finished-building ghost, cached, with progress bar');

// No finished mesh at all: the footprint volume remains the fallback.
calls.length=0;finished=null;
env.drawStructure({id:'odd',type:'odd',x:1,y:1,construction:{}});
assert.equal(kinds(calls,'ghost').length,0);
assert.equal(kinds(calls,'footprint').length,1,'footprint volume when nothing can be built');
finished=mesh;
console.log('PASS no finished mesh: footprint volume fallback');

// Assembled sites, placement previews and finished buildings are unchanged.
calls.length=0;assemblyHas=true;
env.drawStructure({id:'church',type:'church',x:2,y:2,construction:{}});
assert.equal(kinds(calls,'assembly').length,1);
assert.equal(kinds(calls,'ghost').length+kinds(calls,'footprint').length,0,'an assembled site draws no ghost');
assemblyHas=false;calls.length=0;
env.drawStructure({id:'preview',type:'windmill',x:3,y:3},true);
assert.deepEqual(calls.map(c=>c[0]),['footprint'],'a placement preview stays its footprint volume');
calls.length=0;
env.drawStructure({id:'done',type:'windmill',x:4,y:4});
assert.equal(calls.length,0,'a finished building is drawn by World 3D only');
console.log('PASS assembled sites, previews and finished buildings unchanged');
