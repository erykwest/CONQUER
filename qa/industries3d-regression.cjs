'use strict';
// Industries in 3D: the Blender-built logging camp, quarry and mine are well formed,
// fit their footprints, turn with the structure angle and sit on its ground level.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const ctx=vm.createContext({window,Math,Object,Number,Array,Map,String});
for(const f of ['assets/industry-models.js','settlement-mesh3d.js','settlement-industries3d.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),ctx);
const M=window.ConquerIndustryModels,I3=window.ConquerIndustries3D;
const FOOTPRINT={loggingCamp:2,quarry:3,mine:1};
for(const [type,size] of Object.entries(FOOTPRINT)){
  assert.ok(I3.has(type),type+' has a model');
  for(const [name,p] of Object.entries(M.models[type].parts)){
    assert.equal(p.v.length,p.c.length*9,type+'.'+name+': nine coordinates per triangle');
    assert.ok(p.c.every(i=>i>=0&&i<M.palette.length),type+'.'+name+': palette colours');
  }
  assert.ok(M.models[type].parts.ground,type+' has a ground part');
  // Everything stays within the footprint (small overhangs allowed).
  let max=0;for(const p of Object.values(M.models[type].parts))for(let i=0;i<p.v.length;i+=3)max=Math.max(max,Math.abs(p.v[i]),Math.abs(p.v[i+1]));
  assert.ok(max<=size/2+.12,type+' fits its '+size+'x'+size+'U footprint ('+(max*2).toFixed(2)+'U)');
}
console.log('PASS three industry models fit their footprints');

const s={type:'quarry',x:100,y:50,angle:Math.PI/2};
const mesh=I3.triangles(s,2.5);
let minZ=Infinity,cx=0,cy=0;for(let i=0;i<mesh.pos.length;i+=3){minZ=Math.min(minZ,mesh.pos[i+2]);cx+=mesh.pos[i];cy+=mesh.pos[i+1]}
assert.ok(Math.abs(minZ-2.5)<.01,'the model sits on the surveyed ground level');
assert.ok(Math.abs(cx/(mesh.pos.length/3)-100)<1.2&&Math.abs(cy/(mesh.pos.length/3)-50)<1.2,'the model is centred on the structure');
// The quarry rock face is at the back (-x in model space): with angle 90deg it lies towards -y.
const rock=Object.keys(M.models.quarry.parts).indexOf('rock');
let ry=0,rn=0;for(let t=0;t<mesh.gi.length;t++)if(mesh.gi[t]===rock){ry+=mesh.pos[t*9+1];rn++}
assert.ok(ry/rn<50-.4,'the structure angle turns the model (rock face behind the yard)');
assert.equal(mesh.groupBias[Object.keys(M.models.quarry.parts).indexOf('ground')],-1e6,'ground always paints first');
console.log('PASS placement: ground level, centre, angle, ground-first painting');

const W=window.ConquerMesh3D;
assert.equal(W.shadeFactor(0,0,1,0),1,'top faces keep their colour');
assert.ok(new Set([0,1,2,3].map(k=>W.shadeFactor(Math.cos(k*Math.PI/2),Math.sin(k*Math.PI/2),0,0))).size===2,'side faces take two tones');
assert.match(W.shadedHex(mesh,0),/^#[0-9a-f]{6}$/,'WebGL gets plain hex colours');
console.log('PASS castle-style shading');
