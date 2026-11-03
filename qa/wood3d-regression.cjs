'use strict';
// Timber fortifications in 3D: the Blender-built watchtower, palisade towers and timber gate
// are well formed, keep the heights and footprints of the 2.5D drawing they replace, turn with
// the structure angle and sit on the placement ground; palisades repeat one stake per post of
// drawPalisadePostLine with walkway / rampart for tiers 2 / 3; winter whitens roofs only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const slice=(text,from,to)=>text.slice(text.indexOf(from),text.indexOf(to,text.indexOf(from)));
const window={},State={season:'summer',structures:[]};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,Float32Array,
  terrainElevation:()=>0,underConstruction:s=>!!s.construction,placementGroundZ:s=>s.groundZ??0,placementFoundationDepth:()=>0,
  rectDims:s=>({w:Number(s.w??s.size??1),h:Number(s.h??s.size??s.w??1)}),
  rectWorldPoints:(cx,cy,w,h,a=0)=>{const c=Math.cos(a),s=Math.sin(a);return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:cx+x*c-y*s,y:cy+x*s+y*c}))},
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),wallExteriorSide:s=>s.flip?-1:1,wallTier:s=>s.tier||2,wallWidthForTier:t=>[0,.2,.5,1][t],
  WINTER_SNOW_TOP:'#edf1ed',WINTER_SNOW_A:'#e7ece8'});
const core=src('settlement-core.js'),castle=src('settlement-castle-structures.js');
vm.runInContext(slice(core,'function isWoodTower(','function wallWidthForTier(')
  +slice(castle,'function palisadeSnapTarget(','function palisadeOctagon(')
  +slice(castle,'function palisadePostOffsetAt(','function drawPalisadePostLine('),ctx);
for(const f of ['assets/wood-fort-models.js','settlement-mesh3d.js','settlement-wood3d.js'])vm.runInContext(src(f),ctx);
const M=window.ConquerWoodFortModels,W=window.ConquerWood3D;

// Every model is well formed.
for(const [k,model] of Object.entries(M.models))for(const [name,p] of Object.entries(model.parts)){
  assert.equal(p.i.length,p.c.length*3,k+'.'+name+': three indices per triangle');
  assert.ok(p.i.every(i=>i>=0&&i*3<p.p.length),k+'.'+name+': indices in range');
  assert.ok(p.c.every(i=>i>=0&&i<M.palette.length),k+'.'+name+': palette colours');
}
const T={type:'tower',material:'wood'};
assert.equal(W.modelKey({...T,woodStyle:'watchtower'}),'watchtower');
assert.equal(W.modelKey({...T,woodStyle:'palisadeTower',woodRoof:'open'}),'palisadeTower_open');
assert.equal(W.modelKey({...T,woodStyle:'palisadeTower',woodRoof:'pitched'}),'palisadeTower_roofed');
assert.equal(W.modelKey({type:'gate',material:'wood'}),'woodGate');
assert.equal(W.modelKey({type:'tower',material:'stone'}),null,'stone stays with ConquerCastle3D');
assert.ok(!W.handles({...T,woodStyle:'watchtower',construction:{}}),'sites keep their ghost / assembly');
console.log('PASS '+Object.keys(M.models).length+' timber models, keys by style and roof');

// Heights (structureHeight) and footprints of the 2.5D drawing.
function bounds(key){
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z1=-Infinity,z0=Infinity;
  // The flag pole rises above the roof and is not part of structureHeight.
  for(const [name,p] of Object.entries(M.models[key].parts))if(name!=='flag')for(let i=0;i<p.p.length;i+=3){
    x0=Math.min(x0,p.p[i]);x1=Math.max(x1,p.p[i]);y0=Math.min(y0,p.p[i+1]);y1=Math.max(y1,p.p[i+1]);z0=Math.min(z0,p.p[i+2]);z1=Math.max(z1,p.p[i+2]);
  }
  return{x0,x1,y0,y1,z0,z1};
}
for(const [key,h,half] of [['watchtower',2.35,.5],['palisadeTower_open',2.32,.75],['palisadeTower_roofed',2.95,.75],['woodGate',1.94,.75]]){
  const b=bounds(key);
  assert.ok(Math.abs(b.z1-h)<.2,key+' height '+b.z1.toFixed(2)+' ~ '+h);
  assert.ok(b.z0>-.05,key+' sits on the ground');
  assert.ok(Math.max(-b.x0,b.x1,-b.y0,b.y1)<=half+.25,key+' stays near its footprint');
}
console.log('PASS heights and footprints match the 2.5D timber drawing');

// Placement: centre, angle, ground; gate scaled to older w/h.
const tower={id:'t',...T,woodStyle:'watchtower',x:50,y:20,angle:Math.PI/2,groundZ:1.5};
const tri=W.worldTriangles([tower]);let zMin=Infinity,cx=0,n=0;
for(let i=0;i<tri.length;i+=6){zMin=Math.min(zMin,tri[i+2]);cx+=tri[i];n++}
assert.ok(Math.abs(zMin-1.5)<.05,'the tower stands on its placement ground');
assert.ok(Math.abs(cx/n-50)<.3,'centred on the structure');
const g1=W.worldTriangles([{id:'g',type:'gate',material:'wood',x:0,y:0,w:1,h:1.5}]),g2=W.worldTriangles([{id:'g2',type:'gate',material:'wood',x:0,y:0,w:1,h:3}]);
const spanY=t=>{let a=Infinity,b=-Infinity;for(let i=1;i<t.length;i+=6){a=Math.min(a,t[i]);b=Math.max(b,t[i])}return b-a};
assert.ok(spanY(g2)>spanY(g1)*1.8,'a wider gate scales the model across the passage');
console.log('PASS placement: ground, centre, gate size');

// Palisades: one stake per post of drawPalisadePostLine; tier 2 walkway, tier 3 rampart.
const stakeTris=M.models.stake.parts.body.c.length+M.models.stake.parts.tipA.c.length;
for(const tier of [1,2,3]){
  const s={id:'p'+tier,type:'palisade',tier,width:[0,.2,.5,1][tier],a:{x:0,y:0},b:{x:7.5,y:0}};
  const geo=W.geometry(s),posts=Math.ceil(7.5/.205)+1;
  assert.ok(geo.mesh.col.length>=posts*stakeTris,'tier '+tier+': '+posts+' stakes');
  if(tier===1)assert.equal(geo.faces.length,0,'tier 1 has no walkway');
  if(tier===2)assert.ok(geo.faces.some(f=>f.pts.every(p=>Math.abs(p.z-.74)<1e-6)),'tier 2 walkway deck at .74');
  if(tier===3)assert.ok(geo.faces.some(f=>f.pts.every(p=>p.z>.27))&&geo.faces.length===5,'tier 3 earth rampart');
}
console.log('PASS palisade stakes, walkway and rampart');

// Winter whitens roofs and exposed decks, never the timber.
const colours=()=>new Set(Array.from(W.worldTriangles([{...tower,id:'w'+State.season}])).length&&W.geometry({...tower,id:'w'+State.season}).mesh.col);
const summer=colours();State.season='winter';const winter=colours();State.season='summer';
const roof=M.palette[M.paletteKeys.indexOf('roofShingle')],log=M.palette[M.paletteKeys.indexOf('log')];
assert.ok(summer.has(roof)&&!winter.has(roof),'shingle roofs turn white in winter');
assert.ok(winter.has(log),'timber keeps its colour');
console.log('PASS winter roofs');

// Flags (roofed palisade tower, watchtower) and the gate's two drapes wear the realm's heraldry.
assert.ok(M.models.watchtower.parts.flag&&M.models.palisadeTower_roofed.parts.flag,'roofed towers fly a flag');
assert.ok(!M.models.palisadeTower_open.parts.flag,'the open tower has no roof to fly it from');
assert.ok(M.models.woodGate.parts.banners,'the timber gate has its drapes');
State.heraldry={c1:'#123456',c2:'#abcdef'};
const her=new Set(W.geometry({...tower,id:'her'}).mesh.col);
assert.ok(her.has('#123456')&&her.has('#abcdef'),'flag in the heraldry colours');
State.heraldry=null;
console.log('PASS flags and drapes in the heraldry');

// World renderer wiring: timber leaves the per-frame 2.5D residue; construction sites are
// assembled from the same models.
const world=src('settlement-world3d.js'),assembly=src('settlement-construction-assembly.js');
assert.match(world,/ConquerWood3D\?\.addToBuilder\(m,s\)/,'buildings pass adds the timber models');
assert.match(world,/&&!window\.ConquerWood3D\?\.handles\(s\)\)/,'residual 2.5D skips timber drawn in 3D');
assert.match(assembly,/woodSource\(s\)\|\|palisadeSource\(s\)/,'timber sites are assembled from the models');
console.log('PASS world3d wiring and timber construction sites');
