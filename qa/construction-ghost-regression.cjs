'use strict';
// Construction ghost: a building site without a piece-by-piece assembly (industries, storage
// yards, wells, piers, quays, ramps, civic annexes, event venues) shows its finished World 3D
// building as a translucent ghost, never just the hollow footprint outline. Sites with an
// assembly and finished buildings are unchanged; a placement preview shows the same ghost over its footprint.
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

// Assembled sites and finished buildings are unchanged; placement previews show their 3D ghost.
calls.length=0;assemblyHas=true;
env.drawStructure({id:'church',type:'church',x:2,y:2,construction:{}});
assert.equal(kinds(calls,'assembly').length,1);
assert.equal(kinds(calls,'ghost').length+kinds(calls,'footprint').length,0,'an assembled site draws no ghost');
assemblyHas=false;calls.length=0;
// A placement preview (no id) shows its footprint volume and, on top, the translucent finished mesh;
// the cached mesh follows the pointer (finishedMesh is in world coordinates) and wall segments get their own slot.
env.drawStructure({type:'windmill',x:3,y:3},true);
assert.deepEqual(calls.map(c=>c[0]),['footprint','finishedMesh','ghost'],'a placement preview: footprint, then its 3D ghost');
assert.equal(kinds(calls,'ghost')[0][1],'ghost:preview:windmill');
assert.ok(kinds(calls,'ghost')[0][2]>0&&kinds(calls,'ghost')[0][2]<1,'the preview ghost is translucent');
assert.equal(kinds(calls,'progress').length,0,'a preview has no progress bar');
calls.length=0;env.drawStructure({type:'windmill',x:3,y:3},true);
assert.equal(kinds(calls,'finishedMesh').length,0,'a still preview reuses its mesh');
calls.length=0;env.drawStructure({type:'windmill',x:5,y:3},true);
assert.equal(kinds(calls,'finishedMesh').length,1,'a moved preview rebuilds its mesh');
calls.length=0;env.drawStructure({type:'wall',a:{x:0,y:0},b:{x:4,y:0}},true,2);
assert.equal(kinds(calls,'ghost')[0][1],'ghost:preview:wall:2','wall segments are cached per segment');
calls.length=0;
env.drawStructure({id:'done',type:'windmill',x:4,y:4});
assert.equal(calls.length,0,'a finished building is drawn by World 3D only');
console.log('PASS assembled sites and finished buildings unchanged; previews show their translucent 3D ghost');
// Stone castle parts have no buildings-buffer mesh: the ghost falls back to the assembly source.
calls.length=0;finished=null;
env.window.ConquerAssembly.source=s=>{calls.push(['source',s.type]);return{pos:mesh.pos,col:mesh.col,flat:true}};
env.drawStructure({type:'tower',x:6,y:6},true);
assert.deepEqual(calls.map(c=>c[0]),['footprint','finishedMesh','source','ghost'],'a masonry tower preview uses the assembly source');
finished=mesh;delete env.window.ConquerAssembly.source;
console.log('PASS masonry tower preview: ghost from the construction assembly source');
// The placement volume highlights only the ground footprint (no upper face).
const vol=src.slice(src.indexOf('function drawPlacementVolume('),src.indexOf('// The visual inputs of one structure'));
assert.equal((vol.match(/pathPolygon\(/g)||[]).length,1,'only the ground footprint is outlined');
console.log('PASS placement volume: ground footprint only');
