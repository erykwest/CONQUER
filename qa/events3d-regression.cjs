'use strict';
// Event venues in 3D (docs/events/README.md): the Blender-built catalog is well
// formed, every venue has its model, the festival ground setups fit the 6 x 10 U
// ground without overlapping, props follow the event lifecycle, stands and stages
// take the realm heraldry and the knights' tents and gear a primary-colour pair.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const window={},State={season:'summer',seed:7,heraldry:{c1:'#123456',c2:'#abcdef',c4:'#fedcba'}};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,Float32Array});
for(const f of ['assets/civic-models.js','assets/event-models.js','settlement-mesh3d.js','settlement-events3d.js'])vm.runInContext(src(f),ctx);
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
assert.deepEqual(JSON.parse(JSON.stringify(E.sizeOf(venue('festivalGround')))),{w:6,h:10},'festival ground is 6 x 10 U');
const TOL=.03;
for(const v of ['streetSpot','stage']){
  const {w,h}=E.sizeOf(venue(v)),r=E.itemRect({m:E.venueModel(venue(v)),x:0,y:0,a:0});
  assert.ok(r.x0>=-w/2-TOL&&r.x1<=w/2+TOL&&r.y0>=-h/2-TOL&&r.y1<=h/2+TOL,v+' model stays on its footprint');
}
{const r=E.itemRect({m:'stageHerald',x:0,y:0,a:0}),q=E.itemRect({m:'stagePlayers',x:0,y:0,a:0});
 assert.ok(Math.abs(r.x0-q.x0)<.05&&Math.abs(r.y1-q.y1)<.4,'the two dressings share the stage base')}
console.log('PASS venues: podium, stage (players / herald), festival ground');

// Setups fit the ground, never overlap, and the arena needs a larger ground.
const ground=venue('festivalGround');
const setups=E.setupsFor(ground);
for(const k of ['circus','joust','feast'])assert.ok(setups.includes(k),k+' fits the 6 x 10 ground');
assert.ok(!setups.includes('arena'),'the U arena does not fit 6 x 10');
assert.ok(E.setupsFor(venue('festivalGround',{w:9,h:10})).includes('arena'),'the U arena fits a 9 x 10 ground');
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
 assert.ok(stands.every(r=>Math.min(Math.abs(r.x0),Math.abs(r.x1))>=1.2),'the stands leave the riders their lanes');
 assert.ok(tilt.every(r=>Math.abs(r.x0)<.2&&Math.abs(r.x1)<.2),'the tilt runs down the middle')}
console.log('PASS setups ('+Object.keys(E.SETUPS).join(', ')+') fit their ground without overlaps');

// Lifecycle: idle ground is a green pad; props arrive while preparing, leave while clearing.
const n=E.SETUPS.joust.items.length,count=ev=>E.setupItems(venue('festivalGround',{event:ev})).length;
assert.equal(count(undefined),0,'idle ground has no props');
assert.equal(count({setup:'joust',phase:'planned'}),0,'planned events build nothing yet');
assert.equal(count({setup:'joust',phase:'preparing',progress:.5}),Math.ceil(n/2),'half the props while half prepared');
assert.equal(count({setup:'joust',phase:'active'}),n,'the full setup while active');
assert.equal(count({setup:'joust',phase:'clearing',progress:1}),0,'cleared at the end');
assert.equal(count({setup:'arena',phase:'active'}),0,'a setup that does not fit is not shown');
const idle=E.meshes(venue('festivalGround',{id:'g0'}),2);
assert.equal(idle.length,1,'idle ground: one mesh');
assert.ok(idle[0].col.every(c=>/^#[67]/.test(c))&&idle[0].groupBias[0]===-1e6,'the idle ground is green and paints first');
assert.ok(idle[0].pos.every((v,i)=>i%3!==2||Math.abs(v-2)<.05),'the ground pad sits on the ground level');
console.log('PASS lifecycle: idle pad, preparing / active / clearing props');

// Placement: angle turns the setup with the ground.
{const g=venue('festivalGround',{id:'g1',x:50,y:20,angle:Math.PI/2,event:{setup:'joust',phase:'active'}});
 const list=E.meshes(g,0),tilt=list[3];let mx=0,my=0;const k=tilt.pos.length/3;
 for(let i=0;i<tilt.pos.length;i+=3){mx+=tilt.pos[i];my+=tilt.pos[i+1]}
 assert.ok(Math.abs(my/k-20)<.2&&Math.abs(mx/k-50-1.74)<.3,'a 90deg ground turns the tilt along +x')}
console.log('PASS placement turns setups with the ground');

// Livery: stands, arena and stage follow the realm heraldry; knights' gear a primary pair.
const cols=(ref,key)=>new Set(E.triangles(ref,{x:0,y:0,key},0).col);
for(const ref of ['standCovered','standOpen','arenaU','stageHerald']){
  assert.equal(M.models[ref].livery,'realm',ref+' follows the realm');
  const c=cols(ref);assert.ok(c.has('#123456')&&c.has('#abcdef'),ref+' takes the realm colours');
}
const PRIMARY=new Set(['#b8322c','#2f56a6','#d9b43a']);
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
console.log('PASS livery: realm heraldry on stands and stages, primary pairs on knights\' gear');
