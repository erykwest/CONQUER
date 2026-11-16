'use strict';
// MIL-WALL-01 (D-MIL-WALL-261115): wall patrols belong to a whole ring of walls (one connected piece of
// the wall walk), not to each wall segment. The player assigns them per ring; each is two soldiers of
// the Barracks reserve, covered after the White Zone patrols; a new ring has none. The men walk the
// whole ring through towers and gates (out of sight inside them), evenly spaced.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../';
const src=name=>fs.readFileSync(root+'src/'+name,'utf8');
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}

function world({enlisted=0,posts=40}={}){
  const ctx={Math,Number,Object,Array,Set,Map,String,JSON,console,isFinite,now:0};
  ctx.performance={now:()=>ctx.now};
  ctx.window=ctx;
  ctx.State={village:{founded:true},clock:{day:10},structures:[]};
  ctx.underConstruction=s=>!!s.building;
  ctx.structureHeight=s=>[1.15,2.10][(s.level||1)-1];
  ctx.wallTier=s=>s.tier||2;
  ctx.wallExteriorSide=()=>1;
  ctx.pointRadius=()=>.75;
  ctx.structureInteriorVector=()=>({x:1,y:0});
  ctx.terrainElevation=()=>0;
  ctx.peasantHash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h};
  ctx.status=t=>{ctx.lastStatus=t};
  const siege={stock:{horses:0},soldiers:{enlisted,paid:true,expedition:0}};
  ctx.ConquerSiege={state:()=>siege,capacity:()=>({soldiers:posts}),archerSlots:()=>[]};
  const units=[];
  ctx.ConquerCombat={units:()=>units,enemy:()=>[],areaState:()=>({allowed:true}),alarmMode:()=>'off',setAlarmMode:()=>true,
    withdrawPatrols:n=>{let k=0;while(k<n&&units.some(u=>u.kind==='patrol')){units.splice(units.findLastIndex(u=>u.kind==='patrol'),1);k++}return k}};
  vm.createContext(ctx);
  for(const f of ['settlement-wallwalk.js','settlement-soldiers.js','settlement-wall-patrols.js'])vm.runInContext(src(f),ctx);
  const refresh=()=>{ctx.now+=1000;ctx.ConquerWallWalk.invalidate();ctx.ConquerSoldiers.invalidate()};
  return{ctx,siege,units,W:ctx.ConquerWallPatrols,M:ctx.ConquerSoldiers,WW:ctx.ConquerWallWalk,refresh};
}
const tower=(id,x,y)=>({id,type:'tower',shape:'square',size:1.5,level:2,x,y});
const wall=(id,a,b,o={})=>({id,type:'wall',a,b,width:.5,level:1,tier:2,...o});
// A square ring 20U a side: four corner towers, each side split into `parts` wall segments.
function square(S,parts=1,ox=0,oy=0,tag='q'){
  const c=[[0,0],[20,0],[20,20],[0,20]].map(([x,y],i)=>tower(tag+'T'+i,ox+x,oy+y));
  S.push(...c);
  for(let i=0;i<4;i++){
    const A=c[i],B=c[(i+1)%4],dx=Math.sign(B.x-A.x),dy=Math.sign(B.y-A.y);
    const a={x:A.x+dx*.6,y:A.y+dy*.6},b={x:B.x-dx*.6,y:B.y-dy*.6};
    for(let k=0;k<parts;k++){
      const p=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      S.push(wall(tag+'W'+i+'-'+k,p(k/parts),p((k+1)/parts),{aSnap:k===0?A.id:undefined,bSnap:k===parts-1?B.id:undefined}));
    }
  }
  return c;
}

check('rings are the joined pieces of the wall walk; a new ring has no patrols',()=>{
  const {ctx,W}=world({enlisted:10});
  square(ctx.State.structures,3);
  ctx.State.structures.push(wall('lone',{x:40,y:0},{x:46,y:0}),wall('thin',{x:60,y:0},{x:66,y:0},{tier:1}));
  const rings=W.rings();
  assert.equal(rings.length,2,'the square and the lone stretch; T1 walls carry no walk');
  assert.equal(rings[0].walls.length,12,'twelve segments, one ring');
  assert.ok(rings[0].closed&&!rings[1].closed,'the square is closed, the stretch is open');
  assert.equal(rings[0].index,1);assert.equal(rings[1].index,2);
  assert.equal(W.wanted(),0,'no patrol until the player assigns one');
  assert.equal(W.positions(0).length,0,'empty walls');
});

check('patrols are per ring, not per segment: one patrol on a 12-segment ring is two men',()=>{
  const {ctx,W,M,siege}=world({enlisted:10});
  square(ctx.State.structures,3);
  const ring=W.rings()[0];
  assert.ok(W.adjust(ring.id,1),'a patrol assigned to the ring');
  assert.equal(JSON.stringify(siege.soldiers.wallPatrols),JSON.stringify([{walls:ring.walls,n:1}]),'saved with the walls of the ring');
  assert.equal(M.free(),8,'two soldiers of the reserve');
  for(const day of [0,.13,.5,1.7,3.2]){
    const men=W.positions(day);
    assert.ok(men.length<=2,'at most the two men of the patrol');
    for(const p of men){
      const loc=ctx.ConquerWallWalk.locate(p,.01);
      assert.ok(loc,'on the wall walk');
      for(const t of ctx.State.structures.filter(s=>s.type==='tower'))
        assert.ok(Math.hypot(p.x-t.x,p.y-t.y)>=.75,'never drawn inside a tower');
    }
  }
  const c=W.circuit(ring);
  assert.ok(Math.abs(c.total-80)<1e-6,'once round the 80U ring through the towers');
});

check('several patrols are spread along the ring and walk round it',()=>{
  const {ctx,W}=world({enlisted:10});
  square(ctx.State.structures,2);
  const ring=W.rings()[0];
  assert.ok(W.set(ring.id,2));
  const c=W.circuit(ring),seed=ctx.peasantHash(ring.id)%1000/1000*c.total;
  const lead=(day,i)=>((day*W.SPEED+seed+i*c.total/2)%c.total+c.total)%c.total;
  // Pick a day where both leaders are on open wall (not in a tower).
  let day=0;for(;day<20;day+=.05)if(W.pointAt(c,lead(day,0))&&W.pointAt(c,lead(day,1)))break;
  const men=W.positions(day),leaders=men.filter(p=>p.id.endsWith(':0'));
  assert.equal(leaders.length,2,'two patrols');
  const along=leaders.map(p=>p.id.includes(':patrol:0:')?lead(day,0):lead(day,1));
  assert.ok(Math.abs(Math.abs(along[0]-along[1])-c.total/2)<1e-6,'half a ring apart');
  const a=W.pointAt(c,lead(day,0)),b=W.pointAt(c,lead(day+.02,0));
  assert.ok(b&&Math.hypot(b.x-a.x,b.y-a.y)>.1,'the patrol moves on');
});

check('an open stretch is walked out and back',()=>{
  const {ctx,W}=world({enlisted:2});
  ctx.State.structures.push(wall('s',{x:0,y:0},{x:8,y:0}));
  const ring=W.rings()[0],c=W.circuit(ring);
  assert.ok(Math.abs(c.total-16)<1e-6,'there and back');
  assert.ok(Math.abs(W.pointAt(c,4).x-4)<1e-6&&Math.abs(W.pointAt(c,12).x-4)<1e-6);
});

check('the + needs two free soldiers; the reserve covers White Zone patrols first',()=>{
  const {ctx,W,M,units}=world({enlisted:5});
  square(ctx.State.structures,1);
  const ring=W.rings()[0];
  units.push({id:'p',kind:'patrol'});
  assert.ok(W.adjust(ring.id,1),'5 men: 2 White Zone, 2 on the walls');
  assert.ok(!W.adjust(ring.id,1),'one man left: no second wall patrol');
  assert.match(ctx.lastStatus,/2 free soldiers/);
  assert.equal(M.roster().wallPatrolsCovered,1);
  assert.ok(W.set(ring.id,99)===false||W.wanted()<=ring.max,'never more than the ring holds');
  assert.ok(W.adjust(ring.id,-1)&&W.wanted()===0,'recalled to the Barracks');
});

check('fewer soldiers: uncovered wall patrols go back to the Barracks',()=>{
  const {ctx,W,M,siege,refresh}=world({enlisted:6});
  square(ctx.State.structures,1);
  const ring=W.rings()[0];
  assert.ok(W.set(ring.id,3)&&W.wanted()===3);
  siege.soldiers.enlisted=2;refresh();
  M.frame(.1);
  assert.equal(W.wanted(),1,'two men: one patrol stays');
  siege.soldiers.paid=false;refresh();M.frame(.1);
  assert.equal(W.wanted(),0,'unpaid soldiers do no duty');
});

check('a breach keeps the ring patrols; joined rings add up; a ring not walkable waits',()=>{
  const {ctx,W,refresh}=world({enlisted:20});
  const S=ctx.State.structures;
  S.push(wall('a',{x:0,y:0},{x:10,y:0}),wall('b',{x:10,y:0},{x:20,y:0}),wall('c',{x:20,y:0},{x:30,y:0}));
  S.push(wall('d',{x:31,y:0},{x:40,y:0}));
  let [big,small]=W.rings();
  assert.ok(W.set(big.id,2)&&W.set(small.id,1));
  // A breach in b: two new pieces with new ids, a gap between them.
  S.splice(S.findIndex(s=>s.id==='b'),1,wall('b1',{x:10,y:0},{x:14,y:0}),wall('b2',{x:16,y:0},{x:20,y:0}));
  refresh();
  const after=W.wantedByRing(),rings=W.rings();
  assert.equal(rings.length,3,'the breach cuts the walk');
  assert.equal([...after.values()].reduce((t,v)=>t+v,0),3,'no patrol lost to the breach');
  W.sync();
  // Repair the breach and bridge the gap to d: one ring.
  S.splice(S.findIndex(s=>s.id==='b1'),2,wall('b3',{x:10,y:0},{x:20,y:0}));
  S.push(wall('cd',{x:30,y:0},{x:31,y:0}));refresh();
  assert.equal(W.rings().length,1);
  assert.equal(W.wanted(),3,'two rings joined: their patrols add up');
  // Everything under construction: the patrols wait (dormant), no soldiers held.
  for(const s of S)s.building=true;refresh();
  assert.equal(W.rings().length,0);assert.equal(W.wanted(),0);
  W.sync();for(const s of S)s.building=false;refresh();
  assert.equal(W.wanted(),3,'back on the walls when they stand again');
});

check('no free soldiers: the + is off, the reason is shown and the soldiers can be enlisted on the spot',()=>{
  const {ctx,W,M,siege}=world({enlisted:0});
  ctx.State.resources={gold:100};ctx.canAfford=c=>ctx.State.resources.gold>=c.gold;ctx.spendCost=c=>{ctx.State.resources.gold-=c.gold};
  ctx.ConquerEconomy={laborAllocation:()=>({enlistable:10})};
  square(ctx.State.structures,1);
  const w=ctx.State.structures.find(s=>s.type==='wall');
  const html=W.panelHtml(w);
  assert.match(html,/data-wall-patrol="1" disabled/,'the + is off with no free soldiers');
  assert.match(html,/Servono 2 soldati liberi in Caserma \(liberi: 0\)/);
  assert.match(html,/data-wall-enlist>Arruola 2 soldati · 30 oro/);
  assert.equal(W.summary().shortfall.need,2);
  assert.equal(W.enlistForPatrol(),2,'two soldiers enlisted');
  assert.equal(siege.soldiers.enlisted,2);assert.equal(ctx.State.resources.gold,70);
  assert.equal(W.shortfall(),null);
  assert.ok(W.adjust(W.rings()[0].id,1),'now the patrol goes on the walls');
  ctx.State.resources.gold=0;assert.match(W.panelHtml(w),/Pattuglie del giro · 1/);
  M.invalidate();
});

check('inspector: the wall shows its ring and a 0..n choice limited by the free soldiers',()=>{
  const {ctx,W}=world({enlisted:4});
  square(ctx.State.structures,2);
  const w=ctx.State.structures.find(s=>s.type==='wall');
  const c=W.wallControl(w);
  assert.equal(c.current,0);
  assert.deepEqual(c.options.filter(o=>!o.disabled).map(o=>o.value),[0,1,2],'four free men: up to two patrols');
  assert.match(c.fact,/^Giro 1 · chiuso · 8 tratti · /);
  assert.equal(W.wallControl({id:'none'}),null);
});

check('wired into the game: save, reserve, drawing, panel, inspector, scripts',()=>{
  const siege=src('settlement-siege.js');
  assert.match(siege,/wallPatrols=\(Array\.isArray\(raw\?\.wallPatrols\)/,'the assignment is saved with the reserve');
  // The saved state keeps only well-formed entries.
  const fn=new Function(siege.match(/function soldierState\(raw\)\{[\s\S]*?\n  \}/)[0]+';return soldierState;')();
  assert.deepEqual(fn({enlisted:3,wallPatrols:[{walls:['a',2],n:2},{walls:[],n:1},{walls:['x'],n:0},null]}).wallPatrols,[{walls:['a','2'],n:2}]);
  assert.deepEqual(fn(null).wallPatrols,[]);
  const gar=src('settlement-population-garrisons.js');
  assert.match(gar,/if\(window\.ConquerWallPatrols\)window\.ConquerWallPatrols\.draw\(\);\s*else for\(const wall of State\.structures\)/,'rings drawn; /camp keeps the old men');
  assert.match(src('settlement-panels.js'),/data-cp-wall-patrol=/);
  assert.match(src('settlement-panels.js'),/commands\?\.adjustWallPatrols\?\.\(/);
  // Wrapped by saved() (save + emit when the command reports a change), like the other commands.
assert.match(src('ui/game-api.js'),/adjustWallPatrols: saved\(\(ringId, ?delta\) => window\.ConquerWallPatrols\?\.adjust\?\.\(ringId, ?delta\)\)/);
assert.match(src('ui/game-api.js'),/enlistForWallPatrol: saved\(/);
  assert.match(src('ui/game-api.js'),/wallRings:window\.ConquerWallPatrols\?\.summary\?\.\(\)/);
  const cmds=src('settlement-structure-commands.js');
  assert.match(cmds,/choice\('wallPatrols','setWallPatrols',wp\.options,wp\.current\)/);
  assert.match(cmds,/setTowerSignalFire,setWallPatrols,/,'setWallPatrols exported');
  const it=src('ui/i18n-it.js');
  for(const k of ["wallPatrols: 'Pattuglie del giro'","wallRing: 'Giro di mura'"])assert.ok(it.includes(k),k);
  const html=fs.readFileSync(root+'index.html','utf8');
  const a=html.indexOf('settlement-wallwalk.js'),b=html.indexOf('settlement-wall-patrols.js');
  assert.ok(a>0&&b>a,'index.html loads the wall patrols after the wall walk');
  assert.ok(!fs.readFileSync(root+'camp/index.html','utf8').includes('settlement-wall-patrols.js'),'/camp unchanged');
});
console.log('wall-patrol regression: '+passed+' checks');
