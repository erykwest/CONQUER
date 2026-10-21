'use strict';
// Mounted figures in 3D: the knight (heraldic caparison, lance, shield) and the
// messenger ride the 3D horse, take the realm livery, carry the realm arms as
// decals, raise / couch / drive the lance and fall from the saddle.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const ctx=vm.createContext({window,Math,Object,Number,Array,Map,Float32Array,String,WeakMap});
for(const f of ['settlement-animals.js','assets/animal-models.js','settlement-animals3d.js','assets/knight-models.js','settlement-knights3d.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),ctx);
const M=window.ConquerKnightModels,K3=window.ConquerKnights3D,horse=window.ConquerAnimalModels.horse;
const LIVERY={main:'#123456',alt:'#abcdef'};

for(const [name,kit] of Object.entries(M.kits))for(const [pn,p] of Object.entries(kit.parts)){
  assert.equal(p.v.length,p.c.length*9,name+'.'+pn+': nine coordinates per triangle');
  assert.ok(p.c.every(i=>i>=0&&i<M.palette.length),name+'.'+pn+': palette colours');
  assert.ok(['body','neck','head'].includes(p.bind)&&horse.parts[p.bind],name+'.'+pn+' rides a horse part');
}
assert.ok(M.kits.rider_knight.parts.lance&&M.kits.rider_knight.parts.shield,'the knight carries lance and shield');
assert.ok(!M.kits.rider_messenger.parts.lance&&!M.kits.rider_messenger.parts.shield,'the messenger rides unarmed');
assert.ok(M.kits.gear_armoured.parts.caparison&&!M.kits.gear_light.parts.caparison,'only the war horse is barded');
console.log('PASS kits: gear bound to the horse, knight armed, messenger light');

const build=(kind,pose={},anim={mode:'idle',t:0},place={x:0,y:0,heading:0})=>K3.build(kind,place,anim,pose,LIVERY,'brown');
const knight=build('knight');
assert.ok(knight.mesh.pos.every(Number.isFinite),'finite geometry');
assert.ok(knight.mesh.col.includes(LIVERY.main)&&knight.mesh.col.includes(LIVERY.alt),'the realm livery dresses rider and caparison');
assert.deepEqual([...knight.decals.map(d=>d.key)].sort(),['flankL','flankR','shield'],'realm arms on the shield and both flanks');
const messenger=build('messenger');
assert.ok(messenger.mesh.col.includes(LIVERY.main),'the messenger wears the realm colours');
assert.equal(messenger.decals.length,0);
console.log('PASS livery and heraldic decals');

// Lance: raised at rest, couched when engaged or charging, driven forward on the strike.
const lanceGroup=fig=>{
  const names=[...Object.keys(horse.parts),...Object.keys(M.kits.gear_armoured.parts),...Object.keys(M.kits.rider_knight.parts)];
  return names.lastIndexOf('lance');
};
const rest=knight,couched=build('knight',{ready:1}),charge=build('knight',{},{mode:'run',t:.3}),thrust=build('knight',{ready:1,attack:1});
const zMax=fig=>{const g=lanceGroup(fig);let z=-Infinity;for(let t=0;t<fig.mesh.gi.length;t++)if(fig.mesh.gi[t]===g)for(let k=0;k<3;k++)z=Math.max(z,fig.mesh.pos[t*9+k*3+2]);return z};
const xMax=fig=>{const g=lanceGroup(fig);let x=-Infinity;for(let t=0;t<fig.mesh.gi.length;t++)if(fig.mesh.gi[t]===g)for(let k=0;k<3;k++)x=Math.max(x,fig.mesh.pos[t*9+k*3]);return x};
assert.ok(zMax(rest)>zMax(couched)+.5,'the lance stands up at rest and is couched when engaged');
assert.ok(zMax(charge)<zMax(rest)-.5,'the lance is couched at the charge');
assert.ok(xMax(thrust)>xMax(couched)+.05,'the strike drives the lance forward');
console.log('PASS lance raised, couched and thrust');

// Falling: the rider leaves the saddle and ends near the ground; the horse stays up.
const riderTop=fig=>{let z=-Infinity;const n=Object.keys(horse.parts).length+Object.keys(M.kits.gear_armoured.parts).length;
  for(let t=0;t<fig.mesh.gi.length;t++)if(fig.mesh.gi[t]>=n)for(let k=0;k<3;k++)z=Math.max(z,fig.mesh.pos[t*9+k*3+2]);return z};
const fallen=build('knight',{fall:1});
assert.ok(riderTop(fallen)<riderTop(rest)*.7,'the dying rider falls from the saddle');
console.log('PASS the rider falls');

// Scale enlarges the whole figure about its feet; decals follow.
const big=K3.build('knight',{x:5,y:5,heading:1,scale:1.35},{mode:'idle',t:0},{},LIVERY,'brown');
let zb=0,zs=0;for(let i=2;i<big.mesh.pos.length;i+=3)zb=Math.max(zb,big.mesh.pos[i]);for(let i=2;i<rest.mesh.pos.length;i+=3)zs=Math.max(zs,rest.mesh.pos[i]);
assert.ok(Math.abs(zb/zs-1.35)<.01,'scale 1.35 makes the figure 1.35x taller');
assert.ok(big.decals.every(d=>d.o.every(Number.isFinite)),'decals placed');
console.log('PASS scale');
