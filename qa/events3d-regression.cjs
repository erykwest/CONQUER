'use strict';
// Event venues in 3D (docs/events/README.md): the Blender-built catalog is well
// formed, every venue has its model, the festival ground setups fit the 14 x 10 U
// ground without overlapping, props follow the event lifecycle, stands and stages
// take the realm heraldry and the knights' tents and gear a primary-colour pair.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const window={},State={season:'summer',seed:7,heraldry:{c1:'#123456',c2:'#abcdef',c4:'#fedcba'}};
const perf={t:0,now(){return this.t}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,Float32Array,performance:perf});
for(const f of ['assets/scatter-model.js','assets/civic-models.js','assets/event-models.js','settlement-mesh3d.js','settlement-events3d.js'])vm.runInContext(src(f),ctx);
const M=window.ConquerEventModels,E=window.ConquerEvents3D;

// Catalog: indexed parts, palette indices in range.
for(const [k,model] of Object.entries(M.models)){
  for(const [name,p] of Object.entries(model.parts)){
    assert.equal(p.i.length,p.c.length*3,k+'.'+name+': three indices per triangle');
    assert.ok(p.i.every(i=>i>=0&&i*3<p.p.length),k+'.'+name+': indices in range');
    assert.ok(p.c.every(i=>i>=0&&i<M.palette.length),k+'.'+name+': palette colours');
  }
  assert.ok(['realm','pair'].includes(model.livery),k+' declares its livery');
}
console.log('PASS '+Object.keys(M.models).length+' event models well formed');

// Venues: the podium, the stage in its two dressings, the open ground.
const venue=(v,extra={})=>({id:'v1',type:'eventVenue',venue:v,x:0,y:0,angle:0,...extra});
assert.equal(E.venueModel(venue('streetSpot')),'podiumStreet');
assert.equal(E.venueModel(venue('stage')),'stagePlayers','the stage defaults to the players dressing');
assert.equal(E.venueModel(venue('stage',{dressing:'herald'})),'stageHerald');
assert.equal(E.venueModel(venue('festivalGround')),null,'the festival ground has no fixed model');
assert.ok(['streetSpot','stage','festivalGround'].every(v=>E.has(venue(v))),'every venue renders');
assert.ok(!E.is({type:'eventVenue',venue:'castle'})&&!E.is({type:'plaza'}),'only known venues are event venues');
assert.deepEqual(JSON.parse(JSON.stringify(E.sizeOf(venue('festivalGround')))),{w:14,h:10},'festival ground is 14 x 10 U');
const TOL=.03;
for(const v of ['streetSpot','stage']){
  const {w,h}=E.sizeOf(venue(v)),r=E.itemRect({m:E.venueModel(venue(v)),x:0,y:0,a:0});
  assert.ok(r.x0>=-w/2-TOL&&r.x1<=w/2+TOL&&r.y0>=-h/2-TOL&&r.y1<=h/2+TOL,v+' model stays on its footprint');
}
{const r=E.itemRect({m:'stageHerald',x:0,y:0,a:0}),q=E.itemRect({m:'stagePlayers',x:0,y:0,a:0});
 assert.ok(Math.abs(r.x0-q.x0)<.05&&Math.abs(r.y1-q.y1)<.4,'the two dressings share the stage base')}
console.log('PASS venues: podium, stage (players / herald), festival ground');

// Setups fit the ground and never overlap; the former 6 x 10 ground hosts none.
const ground=venue('festivalGround');
const setups=E.setupsFor(ground);
for(const k of ['joust','tourney','circus','feast','camp','theatre'])assert.ok(setups.includes(k),k+' fits the 14 x 10 ground');
assert.equal(E.setupsFor(venue('festivalGround',{w:6,h:10})).length,0,'a 6 x 10 ground is too small for every setup');
assert.ok(!setups.includes('arenaLot'),'the arena lot is not a festival setup');
{const lot=venue('arenaLot',{id:'a1'}),items=E.setupItems(lot);
 assert.deepEqual(JSON.parse(JSON.stringify(E.sizeOf(lot))),{w:18,h:14},'the arena lot is 18 x 14 U');
 assert.ok(items.some(i=>i.m==='arenaU')&&items.filter(i=>i.m.startsWith('tent')).length>=8,'the arena lot has the arena and eight participants tents');
 assert.ok(items.some(i=>i.m.startsWith('sc:'))&&items.some(i=>i.m.startsWith('wagon')),'the arena lot has wagons and scatter goods');
 assert.ok(E.has(lot)&&E.meshes(lot,0).length===items.length+1,'the lot always shows its setup over its ground');
 const parts=Object.keys(M.models.arenaU.parts);for(const k of ['groundSand','honour','gate'])assert.ok(parts.includes(k),'the arena has its '+k)}
for(const [name,setup] of Object.entries(E.SETUPS)){
  const {w,h}=setup.min,rects=setup.items.map(it=>{const r=E.itemRect(it);assert.ok(r,name+': '+it.m+' has a model');return r});
  rects.forEach((r,i)=>assert.ok(r.x0>=-w/2-TOL&&r.x1<=w/2+TOL&&r.y0>=-h/2-TOL&&r.y1<=h/2+TOL,
    name+': '+setup.items[i].m+' stays on the ground ['+[r.x0,r.x1,r.y0,r.y1].map(v=>v.toFixed(2))+']'));
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
    const a=rects[i],b=rects[j],ov=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0),oy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
    assert.ok(ov<=TOL||oy<=TOL,name+': '+setup.items[i].m+' and '+setup.items[j].m+' overlap');
  }
}
{const it=E.SETUPS.joust.items,tilt=it.filter(i=>i.m==='propTilt').map(E.itemRect),stands=it.filter(i=>i.m.startsWith('stand')).map(E.itemRect);
 assert.ok(stands.length===4&&stands.every(r=>Math.min(Math.abs(r.y0),Math.abs(r.y1))>=1.2),'four stands leave the riders their lanes');
 assert.ok(tilt.every(r=>Math.abs(r.y0)<.2&&Math.abs(r.y1)<.2),'the tilt runs down the middle');
 assert.ok(Math.max(...tilt.map(r=>r.x1))-Math.min(...tilt.map(r=>r.x0))>10,'the lists run over 10 U')}
{const t=E.SETUPS.tourney.items;assert.ok(t.filter(i=>i.m.startsWith('tent')).length>=4,'the tourney has at least four tents');
 assert.ok(t.filter(i=>i.m==='propFence').length>=12,'the tourney field is fenced');
 assert.ok(E.SETUPS.feast.items.filter(i=>i.m==='civic:prop_tableSet').length===16,'the feast has sixteen tables')}
console.log('PASS setups ('+Object.keys(E.SETUPS).join(', ')+') fit their ground without overlaps');

// Lifecycle: idle ground is a green pad; props arrive while preparing, leave while clearing.
const n=E.SETUPS.joust.items.length,count=ev=>E.setupItems(venue('festivalGround',{event:ev})).length;
assert.equal(count(undefined),0,'idle ground has no props');
assert.equal(count({setup:'joust',phase:'planned'}),0,'planned events build nothing yet');
assert.equal(count({setup:'joust',phase:'preparing',progress:.5}),Math.ceil(n/2),'half the props while half prepared');
assert.equal(count({setup:'joust',phase:'active'}),n,'the full setup while active');
assert.equal(count({setup:'joust',phase:'clearing',progress:1}),0,'cleared at the end');
assert.equal(E.setupItems(venue('festivalGround',{w:6,h:10,event:{setup:'joust',phase:'active'}})).length,0,'a setup that does not fit is not shown');
const idle=E.meshes(venue('festivalGround',{id:'g0'}),2);
assert.equal(idle.length,1,'idle ground: one mesh');
assert.ok(idle[0].col.every(c=>/^#[67]/.test(c))&&idle[0].groupBias[0]<=-1e6,'the idle ground is green and paints first');
assert.ok(idle[0].pos.every((v,i)=>i%3!==2||Math.abs(v-2)<.05),'the ground pad sits on the ground level');
console.log('PASS lifecycle: idle pad, preparing / active / clearing props');

// Placement: angle turns the setup with the ground.
{const g=venue('festivalGround',{id:'g1',x:50,y:20,angle:Math.PI/2,event:{setup:'joust',phase:'active'}});
 const first=E.SETUPS.joust.items.findIndex(i=>i.m==='propTilt'),it=E.SETUPS.joust.items[first];
 const list=E.meshes(g,0),tilt=list[first+1];let mx=0,my=0;const k=tilt.pos.length/3;
 for(let i=0;i<tilt.pos.length;i+=3){mx+=tilt.pos[i];my+=tilt.pos[i+1]}
 assert.ok(Math.abs(mx/k-(50-it.y))<.2&&Math.abs(my/k-(20+it.x))<.3,'a 90deg ground turns the lists along +y')}
{const g=venue('arenaLot',{id:'j1'}),items=E.setupItems(g),ms=E.meshes(g,0),it=items.findIndex(i=>i.m.startsWith('tent')),m=ms[it+1];
 let cx=0,n=m.pos.length/3;for(let k=0;k<m.pos.length;k+=3)cx+=m.pos[k];
 const plain=E.triangles(items[it].m,{x:items[it].x,y:items[it].y,angle:items[it].a,key:'x'},0);let px=0;for(let k=0;k<plain.pos.length;k+=3)px+=plain.pos[k];
 assert.ok(Math.abs(cx/n-px/n)>1e-4,'arena tents are jittered');assert.ok(Math.abs(cx/n-px/n)<2.5,'tent jitter stays bounded');
 assert.deepEqual(E.meshes({...g},0)[it+1].pos.slice(0,6),m.pos.slice(0,6),'jitter is deterministic')}
console.log('PASS placement turns setups with the ground');

// Livery: stands, arena and stage follow the realm heraldry; knights' gear a primary pair.
const cols=(ref,key)=>new Set(E.triangles(ref,{x:0,y:0,key},0).col);
for(const ref of ['standCovered','standOpen','arenaU','stageHerald']){
  assert.equal(M.models[ref].livery,'realm',ref+' follows the realm');
  const c=cols(ref);assert.ok(c.has('#123456')&&c.has('#abcdef'),ref+' takes the realm colours');
}
const PRIMARY=new Set(['#b8322c','#2f56a6','#d9b43a','#3f7d3a','#ece6d6']);
const pairs=new Set();
for(const ref of ['tentOctagon','tentSquare','propLanceRack','propArmourPile','propArmourCrate','propArmourStand']){
  assert.equal(M.models[ref].livery,'pair',ref+' takes a random pair');
  for(let i=0;i<6;i++){
    const c=[...cols(ref,'g:'+i)];
    assert.ok(!c.includes('#123456')&&!c.includes('#abcdef'),ref+' ignores the realm colours');
    const prim=c.filter(x=>PRIMARY.has(x));assert.equal(prim.length,2,ref+' uses two primary colours');
    pairs.add(prim.sort().join());
  }
  assert.deepEqual([...cols(ref,'same')],[...cols(ref,'same')],ref+' pair is deterministic');
}
assert.ok(pairs.size>=2,'instances get different pairs');
for(const g of [venue('arenaLot',{id:'u1'}),venue('festivalGround',{id:'u2',event:{setup:'tourney',phase:'active'}}),venue('festivalGround',{id:'u3',event:{setup:'camp',phase:'active'}})]){
 const items=E.setupItems(g),ms=E.meshes(g,0),seen=new Set();
 items.forEach((it,i)=>{if(!it.m.startsWith('tent'))return;const c=[...new Set(ms[i+1].col)].filter(x=>PRIMARY.has(x)).sort();const k=c.join();
  assert.ok(!seen.has(k),(g.venue+'/'+(g.event?.setup||''))+': two tents share colours '+k);seen.add(k)});
 assert.ok(seen.size>=4,'venue deals several pairs')}
// Pavilion schemes: one pair fills walls, gores and valance in different ways.
{const red=sc=>E.triangles('tentOctagon',{x:0,y:0},0,['#b8322c','#2f56a6',sc]).col.filter(c=>c==='#b8322c').length;
 assert.equal(new Set(['gored','solid','roof','inverted'].map(red)).size,4,'each scheme fills the pavilion differently')}
// Encampment: quarters, no two tents overlapping, everything inside the boundary,
// nobles behind the parade ground, the gate at the front, deterministic.
for(const [nl,ns] of [[1,3],[2,7],[4,16]]){
 const army={leaders:Array.from({length:nl},(_,k)=>({id:'l'+k})),squads:Array.from({length:ns},(_,k)=>({id:'s'+k}))};
 const c=E.encampment(army,{seed:7,key:'t'+ns});
 assert.equal(c.quarters.nobles,nl,'every leader pitches a pavilion');
 assert.equal(c.quarters.companies,Math.ceil(ns/3),'squads grouped in companies of three');
 assert.equal(c.fires.length,ns,'one fire per squad');
 const tents=c.items.filter(it=>/^tent/.test(it.m));
 tents.forEach((a,i)=>tents.slice(i+1).forEach(b=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>1,'tents keep apart')));
 const inside=p=>{let n=false;const P=c.perimeter;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i].y>p.y)!==(P[j].y>p.y)&&p.x<(P[j].x-P[i].x)*(p.y-P[i].y)/(P[j].y-P[i].y)+P[i].x)n=!n;return n};
 c.items.forEach(it=>assert.ok(inside(it),it.m+' inside the boundary'));
 c.items.filter(it=>/^tent(Octagon|Square)/.test(it.m)).forEach(it=>assert.ok(it.y>0,'nobles at the back'));
 assert.ok(c.gate.y<Math.min(...c.items.map(it=>it.y)),'gate at the front');
 assert.deepEqual(E.encampment(army,{seed:7,key:'t'+ns}),c,'deterministic');
 const pairs=new Set(c.items.filter(it=>it.pair&&/^tent/.test(it.m)).map(it=>it.pair.slice(0,2).sort().join()));
 assert.equal(pairs.size,nl,'each pavilion its own livery');
}
console.log('PASS encampment: quarters, spacing, boundary, gate, liveries');
console.log('PASS livery: realm heraldry on stands and stages, primary pairs on knights\' gear');

// Wind: cloth (pennons, bunting, banners) leaves the static scene and waves on the
// dynamic layer, anchored at the staff and only while the game runs.
{
  const lot=venue('arenaLot',{id:'w1'}),fixedTris=E.meshes(lot,0).reduce((n,m)=>n+m.col.length,0);
  const allTris=E.setupItems(lot).reduce((n,it)=>n+(E.triangles(it.m,{x:0,y:0},0)?.col.length||0),0)+4;   // + the lot's grass pad
  assert.ok(fixedTris<allTris,'cloth is out of the static scene');
  State.structures=[lot];State.clock={speed:1};
  perf.t=1000;const a=E.dynamicMeshes();perf.t=1200;const b=E.dynamicMeshes();
  assert.ok(a.length>0,'the arena lot has waving cloth');
  const n=a.reduce((k,m)=>k+m.col.length,0);
  assert.equal(fixedTris+n,allTris,'fixed + cloth triangles make the whole lot');
  let moved=0,still=0;for(let i=0;i<a.length;i++)for(let k=0;k<a[i].pos.length;k++){const dd=Math.abs(a[i].pos[k]-b[i].pos[k]);if(dd>1e-4)moved++;else still++}
  assert.ok(moved>0&&still>0,'free ends move, anchors stay ('+moved+' / '+still+')');
  State.clock={speed:0};perf.t=1400;const c=E.dynamicMeshes();perf.t=2400;const d=E.dynamicMeshes();
  assert.deepEqual(c[0].pos,d[0].pos,'paused game: the cloth holds still');
  const amp=Math.max(...a.flatMap((m,i)=>m.pos.map((v,k)=>Math.abs(v-b[i].pos[k]))));
  assert.ok(amp<.2,'the flutter stays small ('+amp.toFixed(3)+' U)');
  State.structures=[];
}
console.log('PASS wind: cloth on the dynamic layer, anchored, waves only while the game runs');
// Jittered layouts: across seeds, the final places never clash and stay on the lot.
{
  const T=.03,seed0=State.seed;let moved=0,total=0;
  const grounds=[venue('arenaLot',{id:'p0'}),...['joust','tourney','circus','feast','camp','theatre'].map(k=>venue('festivalGround',{id:'p'+k,event:{setup:k,phase:'active'}}))];
  for(let sd=1;sd<=25;sd++){
    State.seed=sd;
    for(const g of grounds){
      const {w,h}=E.sizeOf(g),items=E.placedItems(g),base=E.setupItems(g),R=items.map(E.itemRect);
      R.forEach((r,i)=>{assert.ok(r.x0>=-w/2-T&&r.x1<=w/2+T&&r.y0>=-h/2-T&&r.y1<=h/2+T,'seed '+sd+' '+(g.event?.setup||g.venue)+': '+items[i].m+' leaves the lot');
        const loose=/^(sc:|propArmour|propWeapon|propSpear|propShield|propLance)/.test(base[i].m)||/^tent/.test(base[i].m)&&['arenaLot','tourney','circus'].includes(g.event?.setup||'arenaLot');
        if(loose){total++;if(items[i]!==base[i])moved++}});
      for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){const a=R[i],b=R[j];
        assert.ok(Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)<=T||Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)<=T,
          'seed '+sd+' '+(g.event?.setup||g.venue)+': '+items[i].m+' clashes with '+items[j].m)}
    }
  }
  State.seed=seed0;
  assert.ok(moved>total*.6,'most tents, scatter and gear still move ('+moved+' / '+total+')');
  console.log('PASS jittered layouts never clash and stay on the lot (25 seeds, '+moved+' / '+total+' items moved)');
}