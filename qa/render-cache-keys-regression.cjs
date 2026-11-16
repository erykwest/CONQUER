'use strict';
// Render cache keys: every visual input of a castle structure must change the keys the renderers
// cache on, or the old mesh / bitmap stays on screen after the change (towers audit, 13/11/2026:
// a hoarding mounted or burnt, a small gate's timber upper storey, a paid merlon or roof-pitch restyle).
// One per-structure helper, structureVisualKey (settlement-render.js), feeds the 2.5D castle body
// bitmap key (castleBodyVisualSignature) and the World 3D structure signature (structureKey); the
// World 3D castle content key also carries the realm-wide crenelStyle() and roofPitch().
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8');
const core=src('settlement-core.js'),render=src('settlement-render.js'),world3d=src('settlement-world3d.js');
const block=(text,start,end)=>{const a=text.indexOf(start);assert.ok(a>=0,start);const b=text.indexOf(end,a);assert.ok(b>a,end);return text.slice(a,b+end.length)};
const ctx=vm.createContext({Object,Number,String,JSON,Math,Array});
vm.runInContext([
  block(core,'const STRUCTURE_VARIANTS=Object.freeze({','\n});'),
  block(core,'const HALF_TOWER_VARIANTS=','\n'),
  block(core,'function variantSchema(s)','\n'),
  block(render,'const STRUCTURE_VISUAL_FIELDS=',']);'),
  block(render,'function structureVisualKey(s){','\n}\n')
].join('\n'),ctx);
const {STRUCTURE_VARIANTS,structureVisualKey}=vm.runInContext('({STRUCTURE_VARIANTS,structureVisualKey})',ctx);
let passed=0;const test=(label,fn)=>{fn();passed++;console.log('PASS '+label)};

const base={
  tower:{id:'t1',type:'tower',shape:'square',material:'stone',size:1.5,level:2,tier:2,x:10,y:12,angle:0,functions:['barracks',null]},
  gate:{id:'g1',type:'gate',material:'stone',size:1.5,level:2,x:20,y:12,angle:0},
  wall:{id:'w1',type:'wall',material:'stone',level:2,tier:2,width:.5,a:{x:0,y:0},b:{x:4,y:0}},
  built:{id:'b1',type:'built',material:'stone',level:2,width:1,a:{x:0,y:2},b:{x:4,y:2},functions:[null,null]}
};
test('every declared variant value changes the structure key',()=>{
  for(const [type,schema] of Object.entries(STRUCTURE_VARIANTS)){
    const s=base[type];assert.ok(s,'fixture for '+type);
    for(const [key,values] of Object.entries(schema)){
      const seen=new Set(values.map(v=>structureVisualKey({...s,[key]:v})));
      assert.equal(seen.size,values.length,type+'.'+key+' values must give distinct keys');
    }
  }
});
test('hoarding mounted or burnt off, and the gate timber upper storey, are in the key',()=>{
  const t=base.tower,g=base.gate;
  assert.notEqual(structureVisualKey({...t,hoarding:'on'}),structureVisualKey({...t,hoarding:'off'}),'tower hoarding (setHoarding, fire)');
  assert.notEqual(structureVisualKey({...g,hoarding:'on'}),structureVisualKey({...g,hoarding:'off'}),'gate hoarding');
  assert.notEqual(structureVisualKey({...g,upper:'timber'}),structureVisualKey({...g,upper:'stone'}),'small gate upper storey (setGateUpper)');
});
test('geometry, rooms, damage and burn state are in the key',()=>{
  const t=base.tower,k=structureVisualKey(t);
  for(const patch of [{x:10.5},{y:11},{angle:.3},{level:3},{tier:3},{size:2},{shape:'round'},{material:'wood'},{masonryMaterial:'brick'},
    {functions:['barracks','latrine']},{roomExteriorHp:{1:0}},{cutaway:true},{cutawayFloor:1},{signalFireSpent:true},{flip:true},
    {doorBurnt:true},{burnt:true},{brokenTop:true},{groundZ:.4},{parentTowerId:'t0'}])
    assert.notEqual(structureVisualKey({...t,...patch}),k,JSON.stringify(patch));
  const w=base.wall,kw=structureVisualKey(w);
  for(const patch of [{a:{x:0,y:1}},{b:{x:5,y:0}},{width:.7},{aSnap:'t1'},{bSnap:'t2'}])
    assert.notEqual(structureVisualKey({...w,...patch}),kw,JSON.stringify(patch));
  assert.equal(structureVisualKey({...t}),k,'stable for the same structure');
});
test('both renderers key on the shared helper; World 3D castle content carries the realm restyles',()=>{
  const sig=block(render,'function castleBodyVisualSignature(){','\n}\n');
  assert.match(sig,/structureVisualKey\(s\)/,'2.5D castle body bitmap key');
  assert.match(sig,/crenelStyle\(\),roofPitch\(\)/);
  const key=block(world3d,'function structureKey(s){','\n  }\n');
  assert.match(key,/structureVisualKey\(s\)/,'World 3D structure signature');
  const content=world3d.match(/const castleContent=\[[^\n]+\n[^\n]+/)[0];
  assert.match(content,/crenelStyle\(\)/);assert.match(content,/roofPitch\(\)/);
  assert.match(render,/const key='cutaway\|'\+castleBodyVisualSignature\(\)/,'cutaway overlay key reuses the body signature');
});
console.log(passed+' render cache key checks passed.');
