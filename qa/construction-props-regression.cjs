'use strict';
// Construction-site props: the Blender kit is well formed, and each phase of a site
// shows (and later removes) the right props: materials and benches first, then a
// scaffold rising with the work plus ladders and lifting gear, finally scaffold only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const window={};
const State={structures:[],view:{rotation:0,scale:1},clock:{day:0}};
const square=(x,y,w,h)=>[{x:x-w/2,y:y-h/2},{x:x+w/2,y:y-h/2},{x:x+w/2,y:y+h/2},{x:x-w/2,y:y+h/2}];
const HEIGHT={tower:4.75,wall:2.1,house:1.3,palisade:1.15,road:0,well:.42};
const env={window,Math,Object,Number,Array,Map,Set,String,State,
  structureHeight:s=>HEIGHT[s.type]??1,
  urbanBuildingPolygons:s=>s.a?[]:[square(s.x,s.y,s.size||1,s.size||1)],
  footprintPoints:s=>{const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy),nx=-dy/L*.25,ny=dx/L*.25;
    return[{x:s.a.x+nx,y:s.a.y+ny},{x:s.b.x+nx,y:s.b.y+ny},{x:s.b.x-nx,y:s.b.y-ny},{x:s.a.x-nx,y:s.a.y-ny}]},
  structureCenter:s=>s.a?{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2}:{x:s.x,y:s.y},
  pointRadius:s=>(s.size||1)*Math.SQRT2/2,
  viewDepthPoint:p=>p.x+p.y,
  terrainElevation:()=>0,
  isWoodTower:s=>s.type==='tower'&&s.material==='wood',isWoodGate:()=>false,isCivicAnnex:()=>false,
  constructionProgress:s=>s.progress??1,underConstruction:s=>(s.progress??1)<1};
env.globalThis=env;
const ctx=vm.createContext(env);
for(const f of ['assets/construction-models.js','settlement-mesh3d.js','settlement-construction-props.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),ctx);
const M=window.ConquerConstructionModels,P=window.ConquerConstructionProps;

// ---- the kit
const KIT=['ladderShort','ladderLong','scaffoldBay','materialPile','carpenterBench','masonBench','hoist','treadwheelCrane'];
for(const name of KIT){
  const model=M.models[name];assert.ok(model,name+' is in the kit');
  for(const [part,p] of Object.entries(model.parts)){
    assert.equal(p.i.length,p.c.length*3,name+'.'+part+': three indices per triangle');
    assert.ok(p.i.every(i=>i>=0&&i*3<p.p.length),name+'.'+part+': indices in range');
    assert.ok(p.c.every(i=>i>=0&&i<M.palette.length),name+'.'+part+': palette colours');
    let minZ=Infinity;for(let i=2;i<p.p.length;i+=3)minZ=Math.min(minZ,p.p[i]);
    assert.ok(minZ>-.08,name+'.'+part+': nothing sinks below the ground');
  }
}
assert.deepEqual(Object.keys(M.models.scaffoldBay.parts).sort(),['brace','deck','end','endRail','frame','rail']);
const U=P.units();
assert.ok(Math.abs(U.bay-2.4/3.5)<1e-9&&Math.abs(U.storey-2/3.5)<1e-9,'bay and storey sizes come from the kit');
console.log('PASS construction kit: 8 models, indexed parts, modular scaffold bay');

// ---- phases of a stone tower (camera looks towards +x+y: the near faces are +x and +y)
const tower={id:'t1',type:'tower',x:10,y:10,size:1.5};
State.structures=[tower];
const at=p=>P.plan(tower,p),models=items=>new Set(items.map(i=>i.model));
const prep=models(at(.05)),raise=models(at(.5)),finish=models(at(.95));
assert.ok(prep.has('materialPile')&&prep.has('masonBench'),'prep: materials and the mason');
assert.ok(!prep.has('scaffoldBay')&&!prep.has('treadwheelCrane'),'prep: no scaffold, no crane yet');
assert.ok(raise.has('scaffoldBay')&&raise.has('ladderShort')&&raise.has('treadwheelCrane'),'raise: scaffold, ladders and the great wheel for a tall tower');
assert.deepEqual([...finish],['scaffoldBay','ladderShort'],'finish: only scaffold and ladders are left');
assert.equal(at(1).length,0,'a finished structure has no props');
const cr=p=>at(p).find(i=>i.model==='treadwheelCrane');
assert.ok(Math.hypot(cr(.5).x-tower.x,cr(.5).y-tower.y)<1e-6,'the crane stands on the building');
assert.ok(cr(.3).z>0&&cr(.3).z<cr(.8).z&&cr(.8).z<=HEIGHT.tower,'the crane rides up with the masonry');
console.log('PASS phases: prep -> raise -> finish -> removed; crane on top');

const storeys=items=>new Set(items.filter(i=>i.model==='scaffoldBay').map(i=>i.z.toFixed(3))).size;
const topZ=items=>Math.max(...items.filter(i=>i.model==='scaffoldBay').map(i=>i.z));
assert.ok(topZ(at(.3))<topZ(at(.8)),'the scaffold climbs with the work');
assert.ok(Math.abs(topZ(at(.95))+U.storey-HEIGHT.tower)<=U.storey/2+1e-6,'at the finish the top deck is within half a storey of the wall top');
for(const p of [.3,.6,.95]){
  const sc=at(p).filter(i=>i.model==='scaffoldBay'),z=sc.map(i=>i.z);
  assert.equal(Math.min(...z),0,'the scaffold stands on the ground at '+p);
  assert.equal(storeys(sc),Math.round(Math.max(...z)/U.storey)+1,'storeys stack without gaps at '+p);
  assert.ok(sc.length<=P.MAX_BAY_STOREYS,'scaffold modules stay within the budget at '+p);
}
const bays=at(.6).filter(i=>i.model==='scaffoldBay');
const faces=new Set(bays.map(b=>Math.round(b.yaw/(Math.PI/2))&3));
assert.equal(faces.size,4,'a tower is scaffolded on all four faces');
const top=Math.max(...bays.map(b=>b.z));
assert.ok(bays.every(b=>b.parts.includes('rail')===(b.z===top)),'guard rail only on the working storey');
const ladders=at(.6).filter(i=>i.model==='ladderShort');
assert.equal(ladders.length,storeys(at(.6)),'one ladder per storey');
console.log('PASS scaffold: rises, all round a tower, rail on top, ladder per storey');

// ---- other sites: only the faces turned to the camera, following the view
const hall={id:'hb',type:'house',x:40,y:10,size:1.6};
const hb=P.plan(hall,.6).filter(i=>i.model==='scaffoldBay');
assert.ok(hb.length&&hb.every(b=>Math.cos(b.yaw)+Math.sin(b.yaw)>.2),'a house is scaffolded only on the faces turned to the camera');
env.viewDepthPoint=p=>-(p.x+p.y);
const back=P.plan(hall,.6).filter(i=>i.model==='scaffoldBay');
assert.ok(back.length&&back.every(b=>Math.cos(b.yaw)+Math.sin(b.yaw)<-.2),'with the camera on the other side the scaffold moves there');
env.viewDepthPoint=p=>p.x+p.y;
console.log('PASS camera side follows the view (non-tower sites)');

// ---- materials and type rules
const brick={...tower,id:'t2',masonryMaterial:'brick'};
const pile=P.plan(brick,.05).find(i=>i.model==='materialPile');
assert.ok(pile.parts.includes('bricks')&&!pile.parts.includes('stone'),'a brick building stacks bricks, not ashlar');
assert.ok(!P.plan(tower,.05).find(i=>i.model==='materialPile').parts.includes('bricks'),'a stone building stacks ashlar');
const house={id:'h1',type:'house',x:30,y:30,size:1};
const hp=models(P.plan(house,.5));
assert.ok(hp.has('carpenterBench')&&!hp.has('masonBench')&&!hp.has('treadwheelCrane')&&!hp.has('hoist'),'a house is a carpenter site without lifting gear');
assert.ok(!models(P.plan({id:'p1',type:'palisade',a:{x:0,y:40},b:{x:4,y:40},width:.3},.5)).has('scaffoldBay'),'a palisade needs no scaffold');
assert.equal(P.plan({id:'r1',type:'road',a:{x:0,y:0},b:{x:3,y:0}},.5).length,0,'roads have no props');
const wall={id:'w1',type:'wall',a:{x:0,y:60},b:{x:10,y:60},width:.5};
const w2=P.plan(wall,.2).filter(i=>i.model==='scaffoldBay'),w8=P.plan(wall,.85).filter(i=>i.model==='scaffoldBay');
const bayXs=items=>new Set(items.map(i=>i.x.toFixed(2)));
assert.ok(bayXs(w2).size<=P.MAX_RUN,'a long wall gets a short run of bays');
const meanX=items=>items.reduce((a,i)=>a+i.x,0)/items.length;
assert.ok(Math.abs(meanX(w8)-meanX(w2))>2,'the run moves along the wall with the work');
assert.ok(models(P.plan(wall,.5)).has('hoist'),'a curtain wall is served by a hoist');
console.log('PASS materials, carpenter vs mason, palisade/road, travelling wall run');

// ---- props keep off neighbouring buildings
const near={id:'n1',type:'house',x:11.9,y:11.9,size:1};
State.structures=[tower,near];
for(const it of P.plan(tower,.5).filter(i=>!['scaffoldBay','ladderShort'].includes(i.model)))
  assert.ok(Math.hypot(it.x-near.x,it.y-near.y)>.7,it.model+' is not placed on the neighbour');
State.structures=[tower];
console.log('PASS free props avoid other structures');

// ---- world mesh
const mesh=P.meshOf([{model:'ladderShort',parts:['ladder'],x:5,y:7,z:2,yaw:Math.PI/2}]);
let minZ=Infinity,maxY=-Infinity;for(let i=0;i<mesh.pos.length;i+=3){minZ=Math.min(minZ,mesh.pos[i+2]);maxY=Math.max(maxY,mesh.pos[i+1])}
assert.ok(Math.abs(minZ-2)<.02,'props sit on their ground level');
assert.ok(maxY>7+M.models.ladderShort.meta.footX/3.5-.05,'yaw turns the model: +X front goes to +y at 90 degrees');
const big=P.meshOf(P.plan(tower,.6));
assert.equal(big.pos.length,big.col.length*9);
assert.ok(big.col.length<15000,'a busy site stays within the painter budget ('+big.col.length+' triangles)');
console.log('PASS world mesh: ground level, yaw, budget '+big.col.length+' triangles');
