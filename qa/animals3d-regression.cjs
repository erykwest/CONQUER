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

// ---- every species
const ALL=['sheep','goat','cow','horse','deer','stag','wolf','bear','boar'];
const range=(m,part)=>{let start=0;for(const [name,p] of Object.entries(m.parts)){if(name===part)return[start,start+p.c.length*9];start+=p.c.length*9}};
const minZ=(mesh,r)=>{let z=Infinity;for(let i=r[0]+2;i<r[1];i+=3)z=Math.min(z,mesh.pos[i]);return z};
for(const sp of ALL){
  const m=window.ConquerAnimalModels[sp],cols=A3.coatColors(sp);
  for(const mode of A3.modesOf(sp))for(let t=0;t<2;t+=.25){
    const mesh=A3.triangles(sp,{x:0,y:0,heading:t},{mode,t},cols);
    assert.ok(mesh.pos.every(Number.isFinite),sp+' '+mode+' is finite');
    assert.ok(mesh.col.every(c=>/^#[0-9a-f]{6}$/i.test(c)),sp+' '+mode+' resolves every colour role');
  }
  if(A3.modesOf(sp).includes('browse')){
    const z=minZ(A3.triangles(sp,{x:0,y:0},{mode:'browse'},cols),range(m,'head'));
    assert.ok(z<.04,sp+' browses with its muzzle at the grass ('+z.toFixed(3)+' U)');
  }
}
console.log('PASS all nine species pose, colour and graze in 3D');

const bear=window.ConquerAnimalModels.bear,bc=A3.coatColors('bear');
const stand=A3.triangles('bear',{x:0,y:0},{mode:'stand'},bc),walkB=A3.triangles('bear',{x:0,y:0},{mode:'walk',t:0},bc);
const maxZ=(mesh,r)=>{let z=-Infinity;for(let i=r[0]+2;i<r[1];i+=3)z=Math.max(z,mesh.pos[i]);return z};
assert.ok(maxZ(stand,range(bear,'head'))>maxZ(walkB,range(bear,'head'))*1.6,'a standing bear rears its head high');
assert.ok(Math.abs(minZ(stand,range(bear,'legHL')))<.01,'its hind feet stay planted on the ground');
const sleep=A3.triangles('bear',{x:0,y:0},{mode:'sleep'},bc);
assert.ok(minZ(sleep,range(bear,'body'))<.02,'a sleeping bear lies on the ground');
console.log('PASS bear rears on planted hind legs and lies down to sleep');

const boar=window.ConquerAnimalModels.boar,horseM=window.ConquerAnimalModels.horse;
const legLen=m=>m.pivots.legFL[2];
assert.ok(legLen(boar)<.13,'boar legs are short ('+(legLen(boar)*3.5).toFixed(2)+' m to the shoulder)');
const bodyLen=m=>{const v=m.parts.body.v;let a=Infinity,b=-Infinity;for(let i=0;i<v.length;i+=3){a=Math.min(a,v[i]);b=Math.max(b,v[i])}return b-a};
assert.ok(legLen(boar)/bodyLen(boar)<legLen(horseM)/bodyLen(horseM)*.75,'boar legs are short for its body ('+(legLen(boar)/bodyLen(boar)).toFixed(2)+' vs horse '+(legLen(horseM)/bodyLen(horseM)).toFixed(2)+')');
console.log('PASS boar proportions');