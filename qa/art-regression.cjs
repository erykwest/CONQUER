'use strict';
// ARTE graphics (ART-251105-01/02): the art archetypes catalogue is well formed and every
// furnished cutaway room exposes display anchors (wall / floor) inside the room, clear of the
// furniture, the ladder corner and each other, with mount/size compatibility.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
for(const f of ['settlement-architecture.js','settlement-industries.js','settlement-wagons3d.js','assets/scatter-model.js','assets/furniture-model.js','assets/art-models.js','settlement-cutaway-furniture.js'])
  run(fs.readFileSync(__dirname+'/../src/'+f,'utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const F=()=>run('window.ConquerCutawayFurniture'),A=()=>run('window.ConquerArtModels');
const overlap=(p,q)=>p[0]<q[2]-1e-6&&p[2]>q[0]+1e-6&&p[1]<q[3]-1e-6&&p[3]>q[1]+1e-6;

check('the art catalogue is well formed: 19 archetypes in three kinds and two sizes',()=>{
  const m=A(),names=Object.keys(m.pieces);
  assert.equal(names.length,19,names.join());
  assert.deepEqual(Object.keys(m.catalog).sort(),names.slice().sort(),'one catalogue entry per piece');
  for(const [n,p] of Object.entries(m.pieces)){
    assert.equal(p.i.length,p.c.length*3,n);assert.ok(p.i.every(i=>i>=0&&i*3<p.v.length),n);
    assert.ok(p.c.every(c=>c>=0&&c<m.palette.length),n);assert.ok(p.d>0&&p.w>0&&p.h>0,n+' has a size');
    const c=m.catalog[n];
    assert.ok(['painting','tapestry','sculpture'].includes(c.kind)&&['small','large'].includes(c.size)&&['wall','floor'].includes(c.mount)&&c.label,n);
    if(c.mount==='wall')assert.ok(Math.abs(p.back)<.01,n+': back on the wall plane');
  }
  const count=k=>Object.values(m.catalog).filter(c=>c.kind===k).length;
  assert.deepEqual([count('painting'),count('tapestry'),count('sculpture')],[10,4,5]);
  for(const a of ['icon','triptych','portrait','landscape','hunt','millefleurs','frieze'])
    assert.deepEqual(Object.values(m.catalog).filter(c=>c.archetype===a).map(c=>c.size).sort(),['large','small'],a+' in two sizes');
  assert.deepEqual(Object.values(m.catalog).filter(c=>c.archetype==='statue').map(c=>c.material).sort(),['bronze','marble','stone']);
  // A large work is bigger than its small twin.
  for(const a of ['IconS','PortraitS','LandscapeS','MillefleursS','FriezeS'])
    assert.ok(m.pieces['art'+a.replace(/S$/,'L')].w>m.pieces['art'+a].w,a);
});

check('art pieces resolve through the cutaway as a:<name>',()=>{
  for(const n of Object.keys(A().pieces)){const f=F().pieceFaces('a:'+n);assert.ok(f&&f.faces.length>4,n)}
});

run(\`
State.seed=99;State.environment=[];State.relief=null;clearReliefBandCache();
State.structures=[
  {id:'t3',type:'tower',shape:'square',size:2,x:96,y:100,level:3,material:'stone',angle:0,functions:[],cutaway:true},
  {id:'t2',type:'tower',shape:'square',size:1.5,x:104,y:100,level:3,material:'stone',angle:0,functions:[],cutaway:true},
  {id:'r3',type:'tower',shape:'round',r:1,x:90,y:110,level:3,material:'stone',angle:0,functions:[],cutaway:true},
  {id:'g1',type:'gate',x:100,y:108,w:2,h:1.4,level:2,angle:0,functions:['throneHall'],cutaway:true}
];
State.structures.forEach(s=>normalizeFunctions(s));
\`);
const ROLES=['guard','barracks','armory','storage','granary','kitchen','stables','nobleRoom','workshop','chapel','commonHall','throneHall','treasury','prison','infirmary'];
function rooms(id,roles){
  run("(()=>{const s=State.structures.find(x=>x.id==='"+id+"');s.functions="+JSON.stringify(roles)+";normalizeFunctions(s);window.ConquerCutawayFurniture.clear()})()");
  const s=run("State.structures.find(x=>x.id==='"+id+"')");
  return F().layoutStructure(s,run('cutawayWallGeometry')(s));
}

check('display anchors stay in the room, off solid furniture, the ladder and each other',()=>{
  let wall=0,floor=0,large=0;
  for(const id of ['t2','t3','r3'])for(const role of ROLES)for(const room of rooms(id,[role,role,role])){
    const hu=room.F.hu,hv=room.F.hv,solid=room.items.filter(i=>!i.deco);
    for(const a of room.art){
      assert.ok(a.rect[0]>=-hu-1e-6&&a.rect[2]<=hu+1e-6&&a.rect[1]>=-hv-1e-6&&a.rect[3]<=hv+1e-6,id+' '+role+': '+a.key+' inside');
      if(a.mount==='floor')for(const i of solid)assert.ok(!overlap(a.rect,i.r),id+' '+role+': statue on '+i.name);
      if(a.mount==='wall')for(const i of room.items.filter(i=>i.deco||F().pieceFaces(i.name).h>.22))
        assert.ok(!overlap(a.rect,i.r),id+' '+role+': painting over '+i.name);
      if(room.ladder)assert.ok(!(Math.abs(a.u-room.ladder.u)<.12&&Math.abs(a.v-room.ladder.v)<.12),id+' '+role+': art on the ladder');
      wall+=a.mount==='wall';floor+=a.mount==='floor';large+=a.size==='large';
    }
    for(let x=0;x<room.art.length;x++)for(let y=x+1;y<room.art.length;y++)
      assert.ok(!overlap(room.art[x].rect,room.art[y].rect),id+' '+role+': anchors overlap');
    assert.equal(new Set(room.art.map(a=>a.key)).size,room.art.length,'unique anchor ids');
  }
  assert.ok(wall>40&&floor>40&&large>20,'anchors found: wall '+wall+', floor '+floor+', large '+large);
  // The rooms meant for display offer both a wall and a floor anchor.
  for(const role of ['nobleRoom','throneHall','chapel','commonHall']){
    const r=rooms('t3',[role])[0];
    assert.ok(r.art.some(a=>a.mount==='wall')&&r.art.some(a=>a.mount==='floor'),role+': '+JSON.stringify(r.art.map(a=>a.mount+'/'+a.size)));
  }
});

check('artSlots: world anchors per structure, none on the gate passage, mount and size rules',()=>{
  rooms('g1',['throneHall']);
  const g=run("State.structures.find(x=>x.id==='g1')"),slots=F().artSlots(g);
  assert.ok(slots.length>0&&slots.every(a=>a.floor===1&&a.structureId==='g1'),'only the room above the gate: '+slots.map(a=>a.floor));
  assert.ok(slots.every(a=>[a.x,a.y,a.z,a.angle].every(Number.isFinite)));
  rooms('t3',['nobleRoom','throneHall','chapel']);
  const t=run("State.structures.find(x=>x.id==='t3')"),all=F().artSlots(t);
  const wallA=all.find(a=>a.mount==='wall'),floorL=all.find(a=>a.mount==='floor'&&a.size==='large');
  assert.ok(wallA&&floorL,'furnished T3 rooms keep a wall anchor and a large floor anchor');
  assert.ok(F().artFits(wallA,'artIconS')&&!F().artFits(wallA,'artBust'));
  // An unfurnished (or round) room has wall stretches for the largest tapestry.
  rooms('r3',[]);const wallL=F().artSlots(run("State.structures.find(x=>x.id==='r3')")).find(a=>a.mount==='wall'&&a.size==='large');
  assert.ok(wallL&&F().artFits(wallL,'artMillefleursL')&&F().artFits(wallL,'artFriezeL'),'room for the large tapestries');
  assert.ok(F().artFits(floorL,'artStatueBronze')&&F().artFits(floorL,'artBust')&&!F().artFits(floorL,'artPortraitS'));
  // Width rule: a narrow stretch of wall takes the small icon, not the small frieze tapestry.
  const narrow={mount:'wall',size:'small',w:.28},mid={mount:'wall',size:'small',w:.66};
  assert.ok(F().artFits(narrow,'artIconS')&&F().artFits(narrow,'artSaintNiche')&&!F().artFits(narrow,'artFriezeS'));
  assert.ok(F().artFits(mid,'artFriezeS')&&!F().artFits(mid,'artFriezeL'));
  assert.ok(!F().artFits(mid,'nope')&&!F().artFits({mount:'floor',size:'small',w:.14},'artStatueMarble'));
  for(const a of all)assert.equal(a.size==='large',a.mount==='wall'?a.w>=.9:a.w>=.2,'size follows the free width');
  // Every work fits the widest wall anchor: the largest anchor size covers the whole catalogue.
  for(const [n,c] of Object.entries(A().catalog))if(c.mount==='wall')assert.ok(F().artFits({mount:'wall',w:.9},n),n+' fits a large anchor');
});
console.log('art regression: '+passed+' checks');
`);
