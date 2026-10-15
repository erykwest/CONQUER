'use strict';
// 3D horse: Blender rigid parts driven by the shared 2D gaits — legs step, browsing
// lowers the muzzle to the grass, any heading, every coat.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const ctx=vm.createContext({window,Math,Object,Number,Array,Map,Float32Array,String});
for(const f of ['settlement-animals.js','assets/animal-models.js','settlement-animals3d.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),ctx);
const A3=window.ConquerAnimals3D,M=window.ConquerAnimalModels.horse;
const colors=A3.coatColors('horse','grey');
for(const [name,p] of Object.entries(M.parts))assert.equal(p.v.length,p.c.length*9,name+': nine coordinates per triangle');
assert.deepEqual([...M.legs],['legHL','legHR','legFL','legFR']);
console.log('PASS horse model: rigid parts with joint pivots');

const tri=(anim,heading=0)=>A3.triangles('horse',{x:0,y:0,heading},anim,colors);
const still=tri({mode:'idle'}),stepping=tri({mode:'walk',t:.15});
assert.ok(stepping.pos.every(Number.isFinite),'walking pose is finite');
assert.ok(stepping.pos.some((v,i)=>Math.abs(v-still.pos[i])>1e-3),'walking moves the legs');
assert.ok(still.col.every(c=>/^#[0-9a-f]{6}$/i.test(c)),'every triangle resolves a coat colour');
assert.ok(new Set(tri({mode:'idle'}).col).size>=3,'coat, mane and hooves differ');
console.log('PASS gait drives the 3D legs, coats resolve');

// Lowest point of the head part = muzzle height.
const headRange=(()=>{let start=0;for(const [name,p] of Object.entries(M.parts)){if(name==='head')return[start,start+p.c.length*9];start+=p.c.length*9}})();
const muzzleZ=m=>{let z=Infinity;for(let i=headRange[0]+2;i<headRange[1];i+=3)z=Math.min(z,m.pos[i]);return z};
const up=muzzleZ(tri({mode:'walk',t:0})),down=muzzleZ(tri({mode:'browse',t:0}));
assert.ok(up>.35,'walking carries the head high');
assert.ok(down<.06,'browsing brings the muzzle to the grass ('+down.toFixed(3)+' U)');
const mid=muzzleZ(tri({from:'walk',mode:'browse',blend:.5,t:0}));
assert.ok(mid<up&&mid>down,'the head travels continuously into browse');
console.log('PASS browse lowers the rigid head on its neck');

const east=tri({mode:'idle'},0),north=tri({mode:'idle'},Math.PI/2);
const maxX=m=>Math.max(...m.pos.filter((_,i)=>i%3===0)),maxY=m=>Math.max(...m.pos.filter((_,i)=>i%3===1));
assert.ok(maxX(east)>.4&&maxY(north)>.4,'the horse turns to any heading');
console.log('PASS any heading');
