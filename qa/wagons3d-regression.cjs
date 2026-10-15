'use strict';
// 3D wagon: the Blender-exported parts assemble at any heading, wheels roll about
// their axles without moving, and team/driver anchors follow the heading.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const ctx=vm.createContext({window,Math,Object,Number,Array,Map,Float32Array,String});
for(const f of ['assets/wagon-model.js','settlement-wagons3d.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),ctx);
const M=window.ConquerWagonModel,W=window.ConquerWagons3D;
assert.ok(M&&W,'model and module load');
for(const [name,p] of Object.entries(M.parts)){
  assert.equal(p.v.length,p.c.length*9,name+': nine coordinates per triangle');
  assert.ok(p.c.every(i=>i>=0&&i<M.palette.length),name+': colours come from the palette');
}
console.log('PASS exported model is well formed');

const spec={chassis:'wagon',body:'open',cargo:['sack','crate','logs'],team:[{},{}]};
const a=W.assembly(spec);
assert.ok(a.parts.some(p=>p.part==='wagonPole'),'a pair is hitched to the pole');
assert.equal(a.parts.filter(p=>p.wheel).length,4,'a wagon rolls on four wheels');
assert.equal(a.parts.filter(p=>p.cargo).length,3,'cargo fills the slots');
assert.ok(W.assembly({...spec,body:'covered'}).parts.every(p=>!p.cargo),'a covered wagon hides its load');
assert.ok(W.assembly({...spec,team:[{}]}).parts.some(p=>p.part==='wagonShafts'),'a single horse goes between shafts');
assert.equal(W.assembly({chassis:'cart',team:[{}]}).parts.filter(p=>p.wheel).length,2,'a cart has two wheels');
console.log('PASS modular assembly');

const centroid=pos=>{let x=0,y=0,z=0;for(let i=0;i<pos.length;i+=3){x+=pos[i];y+=pos[i+1];z+=pos[i+2]}const n=pos.length/3;return[x/n,y/n,z/n]};
const wheelOnly={chassis:'cart',team:[]};
const still=W.worldTriangles(wheelOnly,{x:10,y:20,heading:0,distance:0}),rolled=W.worldTriangles(wheelOnly,{x:10,y:20,heading:0,distance:.37});
const c0=centroid(still.pos),c1=centroid(rolled.pos);
assert.ok(c0.every((v,i)=>Math.abs(v-c1[i])<.01),'rolling turns the wheels in place');
assert.ok(still.pos.some((v,i)=>Math.abs(v-rolled.pos[i])>1e-4),'rolling does move the spokes');
const east=W.anchors(spec,{x:0,y:0,heading:0}),north=W.anchors(spec,{x:0,y:0,heading:Math.PI/2});
assert.ok(east.horses.every(h=>h.x>.5),'heading 0: the team stands ahead on +x');
assert.ok(north.horses.every(h=>h.y>.5&&Math.abs(h.x)<.2),'heading 90°: the team turns with the wagon');
assert.ok(east.seat&&!W.anchors({chassis:'cart'},{x:0,y:0,heading:0}).seat,'only the wagon has a driver seat');
console.log('PASS rolling wheels and heading-aware anchors');
