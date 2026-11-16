'use strict';
// BC-251105-12/13 · Ramps and hill stairways. A model cliff: low ground z0 for x<0, a steep
// band 0<=x<.5, a plateau z1 for x>=.5. The real modules (slopeways, crossings, vehicles) run
// on it: validation against the terrain, walkers across the cliff only on a finished piece,
// heavy movers and wagons only on ramps, the deck lift for figures, the Lab registry.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

function fixture(){
  const State={clock:{day:1},structures:[],environment:[],view:{scale:1},resources:{}};
  const ground=p=>p.x<0?0:p.x<.5?p.x/.5:1;
  const slope=p=>p.x>=0&&p.x<.5?'steep':null;
  const window={};
  const ctx=vm.createContext({State,window,console,Math,Object,Array,Map,Set,String,Number,JSON,performance:{now:()=>0},
    dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),inBuild:()=>true,underConstruction:s=>!!s.construction,
    terrainBaseElevation:ground,terrainSlopeKind:slope,terrainPlateauElevation:p=>slope(p)?null:ground(p),
    terrainElevation:p=>window.ConquerSlopeways.lift(p,ground(p)),environmentContains:()=>false,
    structureHeight:()=>.3,footprintPoints:()=>[],rectDims:()=>({w:1,h:1}),placementGroundZ:()=>0,
    markDirty:()=>{},draw:()=>{},status:()=>{},selectStructure:()=>{},invalidateNavigation:()=>{},uid:()=>'x'});
  for(const f of ['settlement-slopeways.js','settlement-crossings.js','settlement-vehicles.js'])vm.runInContext(read('src/'+f),ctx);
  return{State,window,W:window.ConquerSlopeways,C:window.ConquerCrossings,V:window.ConquerVehicles,ground,slope};
}
const P=(x,y=0)=>({x,y});

{
  const {W}=fixture();
  // Geometry follows the real levels; both ends on walkable plateaus.
  const ramp=W.make('ramp',P(-4),P(.5)),v=W.validate(ramp);
  assert.ok(v.ok,'a 1:4.5 ramp from the low ground to the cliff top: '+v.reason);
  assert.equal(v.za,0);assert.equal(v.zb,1);
  assert.match(W.validate(W.make('ramp',P(-1.5),P(.5))).reason,/troppo ripida/,'ramps: max grade 1:4');
  assert.match(W.validate(W.make('ramp',P(-4),P(-1))).reason,/stessa quota/,'two ends on one level is not a ramp');
  assert.match(W.validate(W.make('ramp',P(-3),P(.25))).reason,/pianoro/,'an end on the cliff face is refused');
  assert.match(W.validate(W.make('ramp',P(-1.5),P(3))).reason,/terreno sovrasta/,'the ground may never stand above the deck');
  const stair=W.make('stairway',P(-1),P(.5));
  assert.ok(W.validate(stair).ok,'a 1:1.5 stairway');
  assert.match(W.validate(W.make('stairway',P(-1.5),P(-.4))).reason,/stessa quota/,'stairs need a rise too');
  assert.match(W.validate(W.make('stairway',P(-6),P(.5))).reason,/troppo dolce/,'a gentle stairway is a ramp');
  assert.ok(W.cost(ramp).stone>0&&W.buildDays(stair)>=1,'cost and build time');
  console.log('PASS validation: real plateau levels, max grades, embankment profile, both ends walkable');
}
{
  const {State,W,C,V}=fixture();
  const blocked=(p,heavy=false)=>(W.at(p,heavy)==null&&C.onOpenBridge(p,heavy)==null&&p.x>=0&&p.x<.5)||W.blocksPoint(p);
  // A walker's grid search, as settlement-population-navigation: steep cells are walls unless
  // a crossing (now also a slopeway) carries them; the raised sides of a slopeway are walls.
  function reachable(from,to,heavy=false){
    const k=p=>Math.round(p.x*10)+','+Math.round(p.y*10),seen=new Set([k(from)]),q=[from];
    while(q.length){
      const p=q.shift();if(Math.hypot(p.x-to.x,p.y-to.y)<.11)return true;
      for(const [dx,dy] of [[.1,0],[-.1,0],[0,.1],[0,-.1]]){
        const n={x:Math.round((p.x+dx)*10)/10,y:Math.round((p.y+dy)*10)/10};
        if(n.x<-6||n.x>3||n.y<-3||n.y>3||seen.has(k(n))||blocked(n,heavy))continue;
        if(!C.segmentCanCrossCliff(p,n)&&!(heavy&&W.at(n,true)))continue;
        seen.add(k(n));q.push(n);
      }
    }
    return false;
  }
  const low=P(-5,2),high=P(2,2);
  assert.equal(reachable(low,high),false,'no way up the cliff without a slopeway');
  const stair={id:'st',...W.make('stairway',P(-1,-1),P(.5,-1)),construction:{progress:.5}};
  Object.assign(stair,W.validate(stair));State.structures.push(stair);
  assert.equal(reachable(low,high),false,'a stairway under construction is not walkable');
  delete stair.construction;
  assert.equal(reachable(low,high),true,'walkers climb the finished stairway');
  assert.equal(reachable(low,high,true),false,'heavy movers never use a stairway');
  assert.ok(C.movementMultiplier(P(-.2,-1))<1,'climbing steps is slower');
  assert.equal(C.onOpenBridge(P(.2,-1),'ram'),null,'no stairway for a ram');
  const ramp={id:'rp',...W.make('ramp',P(-4,1.5),P(.5,1.5))};Object.assign(ramp,W.validate(ramp));State.structures.push(ramp);
  assert.equal(reachable(low,high,true),true,'heavy movers climb the ramp');
  assert.ok(C.onOpenBridge(P(.2,1.5),'ram'),'the ramp carries a ram across the cliff band');
  // Raised sides: off the deck halfway up there is no stepping down onto the low ground.
  assert.ok(W.blocksPoint(P(-.6,1.5+1.1)),'the embankment side is a wall where the deck stands high');
  assert.ok(!W.blocksPoint(P(-3.9,1.5+1.1)),'but not at the foot');
  // Figures stand on the deck.
  const mid=P(-1.75,1.5);
  assert.ok(Math.abs(W.lift(mid,0)-.5)<1e-9,'terrainElevation lifts walkers onto the deck');
  assert.equal(W.lift(P(-1.75,-3),0),0,'elsewhere the ground is unchanged');
  console.log('PASS navigation: across the cliff only on finished pieces, stairways for walkers only, ramps for heavy movers');

  // Wagons drive the road graph: a road to the ramp foot, a road from its head.
  State.structures.push({id:'r1',type:'road',a:P(-8,1.5),b:P(-4,1.5)},{id:'r2',type:'road',a:P(.5,1.5),b:P(4,1.5)});
  const r=V.route(P(-8,1.5),P(4,1.5));
  assert.ok(r&&r.length>=2,'a wagon route through the ramp');
  State.structures.splice(State.structures.indexOf(ramp),1);
  State.structures.push({id:'r3',type:'road',a:P(-8,-1),b:P(-1,-1)},{id:'r4',type:'road',a:P(.5,-1),b:P(4,-1)});
  assert.equal(V.route(P(-8,-1),P(4,-1)),null,'no wagon route up a stairway');
  console.log('PASS wagons: ramps join the vehicle road graph, stairways never do');
}
{
  const {window:w}=fixture();
  const M=w.ConquerSlopewayModels;
  for(const k of ['rampH1','rampH2','stairwayH1','stairwayH2']){
    const part=M.models[k]?.parts?.piece;
    assert.ok(part&&part.c.length>40&&part.p.length===part.c.length*9,k+' is a triangle soup with colours');
    assert.ok(part.c.every(i=>i>=0&&i<M.palette.length),k+' colours index the palette');
  }
  console.log('PASS Asset Lab registry: four sample pieces against a model cliff');
}
// Wiring into the game.
const has=(f,re,msg)=>assert.match(read(f),re,msg);
has('index.html',/<button data-slopeway="ramp">/,'ramp button');
has('index.html',/<button data-slopeway="stairway">/,'stairway button');
has('index.html',/settlement-slopeways\.js/,'module loaded by the game');
has('figures-lab.html',/settlement-slopeways\.js/,'module loaded by the Lab');
has('src/asset-catalog.js',/global:'ConquerSlopewayModels'/,'Lab catalog source');
has('src/settlement-app-input.js',/State\.tool\.kind==='slopeway'/,'two-click tool');
has('src/settlement-placement.js',/ConquerSlopeways\.validate\(s\)/,'placement preflight');
has('src/settlement-population-navigation.js',/ConquerSlopeways\?\.blocksPoint\(p\)/,'raised sides block walkers');
has('src/settlement-crossings.js',/ConquerSlopeways\?\.at\(p,!!forHeavy\)/,'slopeways are cliff crossings');
has('src/settlement-vehicles.js',/s\.type==='road'\|\|s\.type==='ramp'/,'ramps in the wagon graph');
has('src/settlement-castle.js',/ConquerSlopeways\.lift\(p,z\)/,'terrain lift');
has('src/settlement-app-persistence.js',/ConquerSlopeways\.normalise\(s\)/,'save migration');
has('src/settlement-world3d.js',/ConquerSlopeways\.addToBuilder\(m,s\)/,'WebGL scene');
has('src/settlement-render.js',/ConquerSlopeways\.draw\(s,preview\)/,'2.5D renderer');
console.log('PASS slopeway hooks: builder, placement, navigation, wagons, terrain, save, renderers, Lab');
