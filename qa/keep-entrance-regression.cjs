'use strict';
// Raised entrance of the Mastio: a wooden stair up to the first upper storey, upgraded to a
// stone flight along the facade; a drawbridge on either stops the flight at a landing and,
// raised, shuts the keep to anyone on the ground. Only the mastio builds it; the door of the
// keep then opens upstairs and civilians enter only from the foot of the stair.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const src=fs.readFileSync(root+'settlement-keep-entrance.js','utf8');

const rect=(x,y,w,h,a=0)=>{const c=Math.cos(a),s=Math.sin(a);return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([u,v])=>({x:x+u*c-v*s,y:y+u*s+v*c}))};
function fixture({gold=500}={}){
  const State={structures:[],resources:{gold,wood:500,stone:500,metal:50},selectedId:null};
  let messages=[];
  const ctx=vm.createContext({
    State,window:{},console,Math,Object,Array,Map,Set,String,Number,JSON,performance:{now:()=>0},requestAnimationFrame:()=>1,
    underConstruction:s=>!!s.construction,isWoodTower:s=>!!s.woodStyle,isOrientedTower:s=>s.shape==='dee',
    structureLevel:s=>s.level||1,structureHeight:s=>s.type==='tower'?[2.35,3.55,4.75][(s.level||1)-1]:1.6,
    cutawayFloorLevels:s=>{const l=s.level||1,h=[2.35,3.55,4.75][l-1],out=[{z:.055}];for(let i=1;i<l;i++)out.push({z:h*i/l});return out},
    footprintPoints:s=>s.type==='tower'?rect(s.x,s.y,s.size||1.5,s.size||1.5,s.angle||0):s.type==='house'?rect(s.x,s.y,1.2,1.2):[],
    boundaryPoint:(s,p)=>p,placementGroundZ:()=>0,terrainElevation:()=>0,
    pointInPolygon:(p,pts)=>{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x))inside=!inside}return inside},
    structureLabel:s=>s.type,costText:c=>JSON.stringify(c),
    canAfford:c=>Object.entries(c).every(([k,v])=>(State.resources[k]||0)>=v),
    spendCost:c=>{for(const [k,v] of Object.entries(c))State.resources[k]-=v},
    status:m=>messages.push(m),markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},invalidateNavigation:()=>{}
  });
  vm.runInContext(src,ctx);
  // A square L2 keep at the origin, its front (angle 0) facing +x.
  const keep={id:'k',type:'tower',shape:'square',x:0,y:0,size:1.5,angle:0,level:2,isMastio:true,functions:[]};
  State.structures.push(keep);
  return{State,K:ctx.window.ConquerKeepEntrance,keep,messages:()=>messages};
}

{
  const {K,State}=fixture();
  const wood={id:'w',type:'tower',shape:'square',x:9,y:0,size:1.5,level:2,woodStyle:'watchtower',isMastio:true};
  const low={id:'l',type:'tower',shape:'square',x:-9,y:0,size:1.5,level:1,isMastio:true};
  const plain={id:'p',type:'tower',shape:'square',x:0,y:9,size:1.5,level:2};
  State.structures.push(wood,low,plain);
  assert.equal(K.buildStair(wood),false,'no raised entrance on a timber tower');
  assert.equal(K.buildStair(low),false,'nor on a one-storey tower');
  assert.equal(K.buildStair(plain),false,'nor on a tower that is not the mastio');
  assert.ok(!wood.keepEntrance&&!low.keepEntrance&&!plain.keepEntrance);
  console.log('PASS only a masonry mastio of 2+ storeys gets a raised entrance');
}
{
  const {K,State,keep}=fixture();
  assert.equal(K.access(keep),undefined,'without a stair the keep is entered as any tower');
  assert.ok(K.buildStair(keep),'wooden stair built');
  assert.equal(keep.keepEntrance.stair,'wood');
  assert.equal(State.resources.wood,500-K.STAIR_COST.wood,'its cost is paid');
  assert.ok(Math.abs(K.sill(keep)-3.55/2)<1e-9,'the door sits on the first upper floor');
  const L=K.layout(keep);
  assert.ok(Math.abs(L.zTop-3.55/2)<1e-9&&L.zFoot===0,'the flight climbs from the ground to the sill');
  assert.ok(L.foot.x>.75+L.run&&Math.abs(L.foot.y)<1e-9,'square to the facade: its foot lies straight out of the door');
  assert.deepEqual(K.access(keep),L.foot,'civilians enter from the foot of the stair');
  assert.equal(K.buildStair(keep),false,'built once');
  console.log('PASS the wooden stair raises the keep door to the first upper floor');
}
{
  // Stone: along the facade, on the free side.
  const {K,State,keep}=fixture();
  K.buildStair(keep);
  const house={id:'h',type:'house',x:1.6,y:-2,functions:[]};   // just off the -v side of the door
  State.structures.push(house);
  assert.ok(K.upgradeStone(keep),'upgraded to stone');
  const L=K.layout(keep);
  assert.equal(keep.keepEntrance.stair,'stone');
  assert.equal(L.side,1,'+v is free');
  assert.ok(Math.abs(L.foot.x-.75-.62/2)<1e-9&&L.foot.y>.46+L.run,'along the facade: its foot lies beside the tower');
  const blocked=fixture();blocked.K.buildStair(blocked.keep);
  blocked.State.structures.push({id:'a',type:'house',x:1.1,y:2,functions:[]},{id:'b',type:'house',x:1.1,y:-2,functions:[]});
  assert.equal(blocked.K.upgradeStone(blocked.keep),false,'no side free: no upgrade');
  assert.equal(blocked.keep.keepEntrance.stair,'wood','the wooden stair stays');
  console.log('PASS the stone flight runs along the facade on the free side');
}
{
  // A wall or building in front of the door: no stair at all.
  const {K,State,keep}=fixture();
  State.structures.push({id:'h',type:'house',x:2.2,y:0,functions:[]});
  assert.equal(K.buildStair(keep),false,'the house blocks the flight');
  assert.match(K.validate(keep,{stair:'wood',side:1,drawbridge:null}),/urta/);
  console.log('PASS a stair cannot run into another structure');
}
for(const stair of ['wood','stone']){
  const {K,keep}=fixture();
  K.buildStair(keep);if(stair==='stone')K.upgradeStone(keep);
  const before=K.layout(keep);
  assert.ok(K.installDrawbridge(keep),'drawbridge on the '+stair+' stair');
  const L=K.layout(keep);
  assert.ok(Math.abs(L.gap-.9)<1e-9,'the flight stops short of the door');
  assert.ok(Math.abs(L.landing.u0-.9)<1e-9&&Math.abs(before.landing.u0)<1e-9,'the landing moves out by the gap');
  assert.deepEqual(K.access(keep),L.foot,'lowered: the keep is open');
  K.toggleDrawbridge(keep);
  assert.equal(K.access(keep),null,'raised: nobody enters from the ground');
  K.animate();
  // Fully raised, the leaf stands against the door: its tip is above the sill by its length.
  keep.keepEntrance.drawbridge.progress=1;
  const leaf=K.leafMesh(keep),zs=leaf.pos.filter((_,i)=>i%3===2);
  assert.ok(Math.max(...zs)>=L.zTop+L.gap,'raised leaf stands up over the doorway');
  keep.keepEntrance.drawbridge.progress=.5;keep.keepEntrance.drawbridge.raised=false;
  assert.equal(K.access(keep),null,'still moving: closed');
  K.removeDrawbridge(keep);
  assert.deepEqual(K.access(keep),K.layout(keep).foot,'removed: open again');
}
console.log('PASS the drawbridge fits either stair and, raised, shuts the keep');
{
  const {K,keep}=fixture();
  K.buildStair(keep);K.installDrawbridge(keep);
  const L=K.layout(keep),m=K.stairMesh(keep),zs=m.pos.filter((_,i)=>i%3===2);
  assert.ok(m.col.length>20&&m.pos.length===m.col.length*9,'one colour per triangle');
  assert.ok(Math.min(...zs)>=-.1&&Math.max(...zs)<=L.zTop+.4,'between the ground and the hand rail');
  assert.equal(K.stairMesh(keep),m,'cached while nothing changes (settled mesh)');
  assert.equal(m.static,true);
  assert.ok(K.dynamicMeshes().length===2,'stair and leaf');
  // Saved mid-way: shown where it was left; a broken stair kind is dropped.
  keep.keepEntrance.drawbridge.progress=.4;keep.keepEntrance.drawbridge.raised=true;
  K.normalise(keep);assert.equal(keep.keepEntrance.drawbridge.progress,1);
  const bad={type:'tower',keepEntrance:{stair:'marble'}};K.normalise(bad);assert.ok(!bad.keepEntrance);
  // Lowered to one storey: the entrance is ignored, the ground door comes back.
  keep.level=1;assert.equal(K.sill(keep),null);assert.equal(K.access(keep),undefined);
  console.log('PASS stair and leaf meshes; saves and lowered keeps');
}
{
  // The guard: enemies near the stair raise the leaf, it comes down once they are gone.
  const State={structures:[],resources:{gold:500,wood:500,stone:500,metal:50}};
  const enemies=[];
  const ctx=vm.createContext({State,window:{ConquerCombat:{enemy:()=>enemies}},console,Math,Object,Array,Map,Set,String,Number,JSON,
    performance:{now:()=>0},requestAnimationFrame:()=>1,underConstruction:()=>false,isWoodTower:()=>false,isOrientedTower:()=>false,
    structureLevel:s=>s.level||1,structureHeight:s=>[2.35,3.55,4.75][(s.level||1)-1],
    cutawayFloorLevels:s=>[{z:.055},{z:1.775}],footprintPoints:s=>s.type==='tower'?rect(s.x,s.y,1.5,1.5):[],
    boundaryPoint:(s,p)=>p,placementGroundZ:()=>0,terrainElevation:()=>0,pointInPolygon:()=>false,structureLabel:s=>s.type,costText:()=>'',
    canAfford:()=>true,spendCost:()=>{},status:()=>{},markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},invalidateNavigation:()=>{}});
  vm.runInContext(src,ctx);
  const K=ctx.window.ConquerKeepEntrance,keep={id:'k',type:'tower',shape:'square',x:0,y:0,size:1.5,angle:0,level:2,isMastio:true};
  State.structures.push(keep);K.buildStair(keep);K.installDrawbridge(keep);
  const d=keep.keepEntrance.drawbridge;
  enemies.push({x:30,y:0});K.alarmTick();
  assert.equal(d.raised,false,'nobody near: the leaf stays down');
  enemies[0].x=8;K.alarmTick();
  assert.ok(d.raised&&d.autoRaised,'an enemy at the stair: the guard raises it');
  assert.equal(K.access(keep),null,'and the keep is shut');
  enemies[0].x=15;K.alarmTick();
  assert.equal(d.raised,true,'between the two radii it stays up');
  enemies[0].defeated=true;K.alarmTick();
  assert.equal(d.raised,false,'the last enemy fallen: it comes down');
  enemies[0].defeated=false;enemies[0].x=5;K.setAuto(keep,false);K.alarmTick();
  assert.equal(d.raised,false,'automatic off: left as set');
  K.setAuto(keep,true);K.toggleDrawbridge(keep);enemies[0].x=40;K.alarmTick();
  assert.equal(d.raised,true,'raised by hand: not lowered by the guard');
  console.log('PASS the guard raises the leaf when enemies come near and lowers it after');

  // Fire: the wooden stair and the leaf burn; burnt, the door is out of reach until rebuilt.
  assert.equal(K.fireParts(keep).map(p=>p.part).join(),'stair,leaf');
  assert.ok(K.closed(keep),'leaf up: the keep is closed (its wall-walk doors barred)');
  K.burnout(keep,'leaf');
  assert.equal(keep.keepEntrance.drawbridge,null,'a burnt leaf falls');
  assert.ok(!K.closed(keep));
  K.burnout(keep,'stair');
  assert.equal(keep.keepEntrance.stair,'burnt');
  assert.equal(K.access(keep),null,'no stair: nobody reaches the door');
  assert.equal(K.sill(keep),1.775,'the door stays up in the wall');
  assert.equal(K.dynamicMeshes().length,0,'nothing left to draw');
  assert.equal(K.fireParts(keep).length,0,'nothing left to burn');
  K.normalise(keep);assert.equal(keep.keepEntrance.stair,'burnt','kept through a save');
  keep.isMastio=false;
  assert.ok(K.buildStair(keep),'rebuilt, even if no longer the mastio');
  assert.equal(keep.keepEntrance.stair,'wood');
  K.upgradeStone(keep);assert.equal(K.fireParts(keep).length,0,'a stone stair without leaf does not burn');
  console.log('PASS wooden stair and leaf burn; a burnt stair is rebuilt');

  // Obstacles, climb.
  const plan=K.obstacles(keep);assert.ok(plan.length===2&&plan.every(p=>p.length===4));
  assert.equal(K.obstacles(keep),plan,'cached');
  const L=K.layout(keep),c0=K.climbPoint(keep,0),c1=K.climbPoint(keep,1),cm=K.climbPoint(keep,.5);
  assert.ok(Math.hypot(c0.x-L.foot.x,c0.y-L.foot.y)<1e-9&&c0.z===L.zFoot,'the climb starts at the foot');
  assert.ok(Math.abs(c1.z-L.zTop)<1e-9&&Math.hypot(c1.x-L.frame.contact.x,c1.y-L.frame.contact.y)<.1,'and ends at the door');
  assert.ok(cm.z>L.zFoot&&cm.z<=L.zTop,'rising on the way');
  assert.ok(K.climbDuration(keep)>=600);
  console.log('PASS stair obstacles and the climb to the door');
}
// Hooks: alarm, fire, wall walk, walkers, recalled civilians.
const read=f=>fs.readFileSync(root+f,'utf8');
assert.match(read('settlement-siege.js'),/bridgeAlarm\(\);window\.ConquerKeepEntrance\?\.alarmTick\?\.\(\)/,'the siege tick runs the guard');
const fire=read('settlement-fire.js');
assert.match(fire,/ConquerKeepEntrance\?\.fireParts\?\.\(s\)/,'fire knows the stair and the leaf');
assert.match(fire,/stair:28,leaf:18/,'with their own fuel');
assert.match(fire,/ConquerKeepEntrance\?\.burnout\?\.\(s,f\.part\)/,'and burns them out');
assert.match(read('settlement-wallwalk.js'),/if\(!h\|\|barred\(h\)\)continue;/,'a raised leaf bars the wall-walk doors');
assert.match(read('settlement-population-navigation.js'),/ConquerKeepEntrance\?\.obstacles\?\.\(s\)/,'walkers go round the stair');
assert.match(read('settlement-combat.js'),/climbPoint\?\.\(keep,/,'recalled civilians climb it');
assert.match(read('settlement-population-figures.js'),/withProjectionGroundZ\(dot\.p\.z,/,'drawn at the step height');
assert.match(read('settlement-render.js'),/drawRaisedVillagers\(\);/,'after the stair meshes');
console.log('PASS alarm, fire, wall walk, walkers and civilians are wired to the entrance');
// Hooks: the door, civilians and service roads follow the raised entrance.
const arch=fs.readFileSync(root+'settlement-architecture.js','utf8');
assert.match(arch,/ConquerKeepEntrance\?\.sill\?\.\(tower\)/,'towerDoorSpecs raises the front door');
const combat=fs.readFileSync(root+'settlement-combat.js','utf8');
assert.match(combat,/ConquerKeepEntrance\?\.access\?\.\(building\)/,'civilians enter the keep only from the stair');
const world=fs.readFileSync(root+'settlement-world.js','utf8');
assert.match(world,/ConquerKeepEntrance\?\.footPoint\?\.\(tower\)/,'service roads end at the stair foot');
const index=fs.readFileSync(__dirname+'/../index.html','utf8');
assert.ok(index.indexOf('settlement-keep-entrance.js')>index.indexOf('settlement-crossings.js'),'loaded in the game page');
console.log('PASS door, civilians and service roads follow the raised entrance');
