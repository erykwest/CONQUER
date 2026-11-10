'use strict';
// Colombaia (dovecote): a room only on the top floor of a T2/T3 stone tower at L2+ under a pitched
// roof; with one built, letters fly in by pigeon 4x faster to the dovecote tower and the answer
// leaves at once (no messenger rides back). Without it the courier rides as before.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=name=>fs.readFileSync(__dirname+'/../src/'+name,'utf8');
const core=src('settlement-core.js'),siege=src('settlement-siege.js'),castle=src('settlement-castle-placement.js');

// The genuine source of one function: from its header to the next function at the same indent.
const pick=(text,name)=>{
  const at=text.search(new RegExp('\\n[ ]*function '+name+'\\('));assert.ok(at>=0,name);
  const indent=text.slice(at+1).match(/^[ ]*/)[0],end=text.indexOf('\n'+indent+'function ',at+1);
  return text.slice(at+1,end<0?undefined:end);
};
const catalog=vm.runInNewContext(core.match(/const FUNCTION_CATALOG=(\[[^\n]+\]);/)[1]);
assert.ok(catalog.includes('dovecote'),'dovecote is a room function');
assert.match(core,/FUNCTION_LABELS=\{[^\n]*dovecote:'Dovecote'/);
assert.match(src('ui/i18n-it.js'),/dovecote: 'Colombaia'/);

const ctx=vm.createContext({
  underConstruction:s=>!!s.building,
  structureLevel:s=>s.level||1,
  towerTier:s=>Number(s.size)>=2?3:Number(s.size)>=1.5?2:1,
  isWoodTower:s=>s.material==='wood',
  towerRoofStyle:s=>s.brokenTop?'broken':s.roofStyle||'battlement',
  builtInteriorFloors:s=>s.level||1,
});
vm.runInContext([pick(castle,'functionCapacity'),pick(core,'towerDovecoteAllowed'),pick(core,'towerDovecote'),
  pick(siege,'eligibleRoom'),pick(siege,'floor'),pick(siege,'allowed')].join('\n'),ctx);
const {allowed,towerDovecote}=vm.runInContext('({allowed,towerDovecote})',ctx);
const tower=o=>({type:'tower',shape:'square',material:'stone',size:1.5,level:2,roofStyle:'pitched',...o});

assert.ok(allowed(tower(),1,'dovecote'),'T2 L2 top floor under a pitched roof');
assert.ok(allowed(tower({size:2,level:3}),2,'dovecote'),'T3 L3 top floor');
assert.ok(!allowed(tower(),0,'dovecote'),'not on the ground floor');
assert.ok(!allowed(tower({level:3}),1,'dovecote'),'not on a floor below the top');
assert.ok(!allowed(tower({level:1}),0,'dovecote'),'not on an L1 tower');
// W1 towers (user, 04/11/2026): the dovecote fits on the top floor, as in larger towers.
assert.ok(allowed(tower({size:1}),1,'dovecote')&&!allowed(tower({size:1}),0,'dovecote'),'W1 L2 tower: top floor only');
assert.ok(!allowed(tower({size:1}),1,'guard')&&!allowed(tower({size:1}),0,'granary'),'W1 towers keep only their five rooms');
assert.ok(allowed(tower({size:1,isMastio:true}),0,'granary'),'the T1 keep is not restricted');
for(const roofStyle of ['battlement','machicolation'])
  assert.ok(!allowed(tower({roofStyle}),1,'dovecote'),'only under a pitched roof, not '+roofStyle);
assert.ok(!allowed(tower({brokenTop:true}),1,'dovecote'),'not on a broken crown');
assert.ok(!allowed(tower({material:'wood'}),1,'dovecote'),'not on wooden towers');
assert.ok(!allowed(tower({building:true}),1,'dovecote'),'not while under construction');
assert.ok(!allowed({type:'gate',level:3,roofStyle:'pitched'},1,'dovecote'),'not in gates');
assert.ok(!allowed({type:'built',length:3,level:2},1,'dovecote'),'not in built sections');
// The other rooms keep their rules: the dovecote only adds one line to allowed().
assert.ok(allowed(tower(),1,'barracks')&&allowed(tower(),0,'granary')&&!allowed(tower(),0,'kitchen'));
assert.ok(!allowed(tower(),1,'guard'),'the castle guard post merged into the Barracks (D-MIL-RES-261109)');
console.log('PASS dovecote only on the top floor of stone towers L2+ with a pitched roof (W1 too)');

assert.ok(towerDovecote(tower({functions:[null,'dovecote']})),'an assigned top room is an active dovecote');
assert.ok(!towerDovecote(tower({functions:['dovecote',null]})),'not counted from a lower floor');
assert.ok(!towerDovecote(tower({roofStyle:'battlement',functions:[null,'dovecote']})),'roof changed: no dovecote');
assert.ok(!towerDovecote(tower({destroyed:true,functions:[null,'dovecote']})),'a destroyed tower has none');
// Rooms not allowed any more (roof changed, level raised) are cleared by sanitizeRooms on every structure change.
assert.match(pick(siege,'sanitizeRooms'),/if\(fn&&!allowed\(s,i,fn\)\)\{s\.functions\[i\]=null/);
console.log('PASS the dovecote is active only while its tower keeps the pitched roof');

// ---------- messages: the diplomacy module with a minimal DOM
function element(){return{hidden:true,textContent:'',innerHTML:'',dataset:{},style:{},onclick:null,
  addEventListener(){},appendChild(){},querySelector(){return null}}}
function diplomacy(structures){
  const els={},State={clock:{day:10},seed:7,structures,diplomacy:null,village:{founded:true,
    borderEntries:[{edge:'west',x:0,y:50}]},view:{scale:1}};
  const planned=[];
  const window={ConquerSiege:{mastio:()=>structures.find(s=>s.isMastio)},
    ConquerConvoys:{planLordConvoy:c=>planned.push(c),state:()=>({lordConvoys:{}})}};
  const sandbox={window,State,planned,console,Math,Number,Object,Array,JSON,String,
    document:{getElementById:id=>els[id]||(els[id]=element()),createElement:()=>element()},
    wrap:element(),WORLD:100,dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    markDirty(){},status(){},roadNetworkPath:(a,b)=>[{x:a.x,y:a.y},{x:a.x,y:b.y},{x:b.x,y:b.y}],
    ensureBorderEntrySelection:()=>State.village.borderEntries,terrainElevation:()=>0,placementGroundZ:()=>0,
    towerVisualTopHeight:()=>3,w2s:()=>({x:0,y:0}),towerDovecote};
  sandbox.window.window=sandbox.window;
  vm.runInNewContext(src('settlement-diplomacy.js'),sandbox);
  return{D:window.ConquerDiplomacy,Dove:window.ConquerDovecote,State,planned};
}
const keep={id:'keep',type:'tower',isMastio:true,x:60,y:80,size:2,level:3,roofStyle:'battlement',material:'stone',functions:['commonHall',null,null]};
const loft=tower({id:'loft',x:40,y:50,functions:[null,'dovecote']});

const horse=diplomacy([keep]);
assert.ok(horse.D.spawn(10));
const h=horse.State.diplomacy.incoming;
assert.equal(h.by,'courier');assert.ok(!horse.Dove.active());
const road=Math.abs(80-50)+Math.abs(60-0);         // the stub road: north-south then east-west
assert.ok(Math.abs(h.arrivalDay-10-road/22)<1e-9,'the courier rides the road at 1/22 day per U');
horse.D.tick(10,h.arrivalDay);assert.equal(h.phase,'waiting');
horse.D.finishResponse(false);
assert.equal(horse.State.diplomacy.incoming.phase,'returning','the courier rides back');
console.log('PASS without a dovecote the horseman rides there and back');

const post=diplomacy([keep,loft]);
assert.ok(post.Dove.active()&&post.Dove.towers()[0].id==='loft');
assert.ok(post.D.spawn(10));
const m=post.State.diplomacy.incoming;
assert.equal(m.by,'pigeon');assert.equal(m.loftId,'loft');
assert.deepEqual([m.goal.x,m.goal.y],[40,50],'the letter flies to the dovecote tower');
const flight=Math.max(.25,40/22/4);
assert.ok(Math.abs(m.arrivalDay-10-flight)<1e-9,'4x faster, straight to the tower');
assert.ok(m.arrivalDay-10<(h.arrivalDay-10)/4,'well before the courier would arrive');
post.D.tick(10,m.arrivalDay);assert.equal(m.phase,'waiting');
post.D.finishResponse(true);
assert.equal(post.State.diplomacy.incoming,null,'the answer leaves by pigeon: no return ride, channel free');
assert.equal(post.State.diplomacy.history.at(-1).by,'pigeon');
assert.equal(post.planned.length,1,'an accepted request still plans the tribute caravan');
assert.equal(post.planned[0].routeDistance,road,'the caravan keeps the road distance, not the pigeon flight');
console.log('PASS with a dovecote letters arrive by pigeon 4x faster and the answer needs no courier');

// ---------- visual wiring: the lantern on the roof, the cutaway room, the Lab
const lantern=src('settlement-castle-structures.js');
assert.match(lantern,/function dovecoteTriangles\(s\)\{\n  const data=window\.ConquerDovecoteModels;if\(!data\|\|typeof towerDovecote!=='function'\|\|!towerDovecote\(s\)\)return\[\];/);
assert.match(lantern,/drawDovecote\(s\);/);
assert.match(src('settlement-castle3d.js'),/for\(const t of dovecoteTriangles\(s\)\)m\.face/);
const model=vm.runInNewContext(src('assets/dovecote-models.js')+';window.ConquerDovecoteModels',{window:{}});
assert.deepEqual(Object.keys(model.models.lantern.parts),['frame','walls','ledges','roof','pigeons']);
for(const part of Object.values(model.models.lantern.parts)){
  assert.equal(part.i.length,part.c.length*3);assert.ok(part.p.every(Number.isFinite));
  assert.ok(Math.max(...part.p.filter((_,i)=>i%3!==2).map(Math.abs))<.3,'the lantern fits on the apex');
}
const furniture=vm.runInNewContext(src('assets/furniture-model.js')+';window.ConquerFurnitureModel',{window:{}});
assert.ok(furniture.pieces.nestWall&&furniture.pieces.perch,'Blender nest wall and perch');
assert.match(src('settlement-cutaway-furniture.js'),/dovecote\(r\)\{r\.row\(r\.A,'nestWall'/);
assert.match(src('settlement-siege-preview.js'),/tetto \+ colombaia',\{type:'tower'[^\n]*functions:\[null,'dovecote'\]/);
assert.match(src('asset-catalog.js'),/global:'ConquerDovecoteModels'/);
for(const page of ['index.html','figures-lab.html'])
  assert.match(fs.readFileSync(__dirname+'/../'+page,'utf8'),/src\/assets\/dovecote-models\.js/,page);
console.log('PASS roof lantern, cutaway nest room and Asset Lab entries are wired');
