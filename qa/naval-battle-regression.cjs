'use strict';
// Naval battle: warships carry archers on the castles (on deck without castles) and
// men-at-arms in the waist; a battle runs approach -> grapple -> board -> withdraw -> burn
// -> sink: the attacker ends alongside, a plank joins the decks, boarders cross it and
// fight, the defender burns (hull charred, sails burnt away) and goes down, then leaves the
// fleet. Visual only, deterministic per seed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');
assert.ok(html.indexOf('settlement-naval-battle.js')>0&&html.indexOf('settlement-naval-battle.js')<html.indexOf('settlement-fleet.js'),'battle loaded before the fleet');
assert.match(html,/id="devShipBattle"/,'DEV button');
assert.match(read('src/settlement-fire.js'),/flame,smoke,/,'fire exports its flame and smoke');

const coast=[{x:0,y:150},{x:200,y:150}];
const sea={type:'sea',coastline:coast,points:[{x:0,y:150},{x:200,y:150},{x:200,y:200},{x:0,y:200}]};
const pointInPolygon=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c};
const window={},State={seed:7,structures:[],environment:[sea]};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,JSON,
  BUILD_MIN:50,BUILD_MAX:150,dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  closestPointOnSegment:(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/L2));return{x:a.x+t*dx,y:a.y+t*dy}},
  environmentContains:(f,p)=>f.type==='sea'&&pointInPolygon(p,f.points),
  pointSegmentDistance:()=>99,terrainElevation:()=>0,structureRotationStep:()=>0,seedRand:()=>Math.random});
for(const f of ['heraldry-shapes.js','assets/ship-models.js','settlement-ships.js','settlement-ship-crew.js','settlement-quay.js','settlement-pier.js','settlement-naval-battle.js','settlement-fleet.js'])
  vm.runInContext(read('src/'+f),ctx);
const F=window.ConquerFleet,NB=window.ConquerNavalBattle,M=window.ConquerShipModels;

// Garrisons
for(const key of Object.keys(M.ships)){
  const g=NB.garrison({id:'g-'+key,key,pose:{x:100,y:170,heading:0}});
  const archers=g.filter(s=>s.type==='archer'),men=g.filter(s=>s.type!=='archer');
  assert.ok(archers.length>=2&&men.length>=2,key+': archers and men-at-arms');
  const castles=M.ships[key].crew.castles;
  if(castles.length)assert.ok(archers.every(a=>castles.some(c=>Math.abs(a.local[2]-c.z)<1e-6)),key+': archers on the castles');
  assert.ok(men.every(s=>Math.abs(s.local[2]-M.ships[key].crew.deck[0][2])<.3),key+': men-at-arms on deck');
}

// A battle, run to the end at 20 fps
const b=F.battle({key:'nave',allegiance:'player'});
assert.ok(b&&b.A.key==='nave'&&b.D.key==='nave','the chosen ship attacks a foreign ship of its kind');
assert.equal(b.D.allegiance,'foreign','the defender flies a foreign flag');
const seen=new Set(),D=b.D,A=b.A;let alongside=null,plankSeen=false,crossed=false,charred=false,burntSails=false,underwater=false;
for(let i=0;i<20*240&&NB.active();i++){
  NB.step(.05);seen.add(b.phase);
  if(b.phase==='grapple'&&!alongside){
    const d=Math.hypot(A.pose.x-D.pose.x,A.pose.y-D.pose.y);
    alongside=d;
  }
  plankSeen||=!!b.plank;
  crossed||=A.soldiers.some(s=>s.state==='aboard'||s.state==='fight');
  if(b.phase==='burn'||b.phase==='sink'){
    const mesh=window.ConquerShips.mesh(D.key,D.pose,D.crew.sail.furl),dressed=NB.dress(D,mesh);
    charred||=dressed.col.some((c,t)=>c!==mesh.col[t]);
    burntSails||=dressed.col.length<mesh.col.length;
  }
  if(b.phase==='sink')underwater||=D.pose.z<-1;
}
for(const p of ['approach','grapple','board','withdraw','burn','sink'])assert.ok(seen.has(p),'phase '+p);
const mA=M.ships[A.key],mD=M.ships[D.key];
assert.ok(Math.abs(alongside-(mA.B/2+mD.B/2+.5))<.05,'the attacker comes alongside, hulls half a unit apart');
assert.ok(plankSeen,'a boarding plank joins the decks');
assert.ok(crossed,'boarders cross onto the enemy deck');
assert.ok(charred&&burntSails,'the defender burns: charred hull, sails burnt away');
assert.ok(underwater,'and sinks');
assert.equal(b.phase,'done','the battle ends');
assert.ok(!F.ships.includes(D)&&F.ships.includes(A),'the sunk ship leaves the fleet, the attacker stays');
assert.ok(A.soldiers.every(s=>s.dead||s.type==='archer'||!s.world),'surviving boarders are back aboard their own ship');
console.log('PASS naval battle: garrisons, approach, plank, boarding, fire, sinking');
