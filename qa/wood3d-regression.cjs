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

// Timber longhouse: the W1 / W2 built section in wood, ground floor only. One 1 U bay per U
// along a->b (stretched to the exact length), the door gable at a, the closed gable at b; as
// wide as the section, under the height structureHeight gives it.
assert.equal(W.modelKey({type:'built',material:'wood'}),'longhouse_w1');
assert.equal(W.modelKey({type:'built',material:'wood',span:'wide'}),'longhouse_w2');
assert.equal(W.modelKey({type:'built'}),null,'the stone section stays with ConquerCastle3D');
for(const [key,width,h] of [['longhouse_w1',1,1.77],['longhouse_w2',2,2.07]]){
  const b=bounds(key);
  assert.ok(Math.abs(b.z1-h)<.05,key+' height '+b.z1.toFixed(2)+' ~ '+h);
  assert.ok(b.z0>-.05,key+' sits on the ground');
  assert.ok(Math.max(-b.y0,b.y1)<=width/2+.12,key+' keeps to the section width');
  for(const part of ['wall_yn','wall_yp','floor','end_a','end_b'])assert.ok(M.models[key].parts[part],key+' has '+part);
  // BC-251105-09: every roof cover has its slopes, ridge, gable verges and smoke hole.
  for(const v of ['shingle','thatch','turf'])for(const part of ['roof_yn','roof_yp','ridge','verge_a','verge_b','smoke'])
    assert.ok(M.models[key].parts[part+'.'+v],key+' has '+part+'.'+v);
}
const lh=(length,extra={})=>({id:'lh'+length+JSON.stringify(extra),type:'built',material:'wood',level:1,a:{x:10,y:5},b:{x:10+length,y:5},length,...extra});
const along=t=>{let a=Infinity,b=-Infinity;for(let i=0;i<t.length;i+=6){a=Math.min(a,t[i]);b=Math.max(b,t[i])}return[a,b]};
for(const length of [2,3.4]){
  const [x0,x1]=along(W.worldTriangles([lh(length)]));
  assert.ok(Math.abs(x0-10)<.3&&Math.abs(x1-(10+length))<.3,'longhouse '+length+'U runs from a to b');
}
const P=k=>M.models.longhouse_w1.parts[k].c.length;
for(const v of ['shingle','thatch','turf']){
  const bayTris=['wall_yn','wall_yp','roof_yn.'+v,'roof_yp.'+v,'ridge.'+v].reduce((n,p)=>n+P(p),0);
  const endTris=P('end_a')+P('end_b')+P('verge_a.'+v)+P('verge_b.'+v);
  const extra=v==='shingle'?{}:{roofCover:v};
  assert.equal(W.geometry(lh(4,extra)).mesh.col.length,4*bayTris+endTris+P('smoke.'+v),v+': one bay per U, one smoke hole, floor only in cutaway');
}
const colsOf=extra=>new Set(W.geometry(lh(3,extra)).mesh.col);
const pal=k=>M.palette[M.paletteKeys.indexOf(k)];
assert.ok(colsOf({roofCover:'thatch'}).has(pal('roofThatch'))&&!colsOf({roofCover:'thatch'}).has(pal('roofShingle')),'thatch cover replaces the shingles');
assert.ok(colsOf({roofCover:'turf'}).has(pal('roofTurf')),'turf cover');
assert.ok(colsOf({roofCover:'bogus'}).has(pal('roofShingle')),'unknown cover falls back to shingles');
// Cutaway: no roof at all (the far slope would hide the back of the room), the near wall and the
// near gable go, the floor shows. Camera looking from +y and +x: the -y wall and the gable at a
// (smaller x) are the far ones.
ctx.structureCutaway=s=>!!s.cutaway;ctx.viewDepthPoint=p=>p.y+p.x*.01;
const cut=W.geometry(lh(4,{cutaway:true})).mesh.col.length;
assert.equal(cut,4*(P('wall_yn')+P('floor'))+P('end_a'),'cutaway keeps the far wall, the floor and the far gable only');
delete ctx.structureCutaway;
console.log('PASS timber longhouse W1 / W2: sizes, roof covers, smoke hole, bays along a->b, cutaway');

// World renderer wiring: timber leaves the per-frame 2.5D residue; construction sites are
// assembled from the same models.
const world=src('settlement-world3d.js'),assembly=src('settlement-construction-assembly.js');
assert.match(world,/ConquerWood3D\?\.addToBuilder\(m,s\)/,'buildings pass adds the timber models');
assert.match(world,/&&!window\.ConquerWood3D\?\.handles\(s\)\)/,'residual 2.5D skips timber drawn in 3D');
assert.match(assembly,/woodSource\(s\)\|\|palisadeSource\(s\)/,'timber sites are assembled from the models');
// The longhouse is not a castle part: World 3D rebuilds it with the timber buildings (a cutaway
// toggle must reach it) and the 2.5D draws its room with its model, out of the castle composites.
assert.match(world,/isWoodTower\(s\)\|\|isWoodGate\(s\)\|\|isLonghouse\(s\)\},/,'World 3D buildings signature covers the longhouse');
assert.match(src('settlement-render.js'),/isLonghouse\(s\)&&window\.ConquerWood3D\?\.draw\(s,preview\)\)\{if\(!preview&&structureCutaway\(s\)\)window\.ConquerCutawayFurniture\?\.draw/,'2.5D longhouse room drawn with its model');
console.log('PASS world3d wiring and timber construction sites');
