'use strict';
// Cutaway furniture and archer posts: every room role is furnished per size, pieces stay
// inside the room and clear of each other, of the ladder corner, of the gate passage and
// of the archer posts; archers stand on their floor exactly where an arrow slit is drawn.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
for(const f of ['settlement-architecture.js','settlement-industries.js','settlement-wagons3d.js','assets/scatter-model.js','assets/furniture-model.js','settlement-cutaway-furniture.js'])
  run(fs.readFileSync(__dirname+'/../src/'+f,'utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const F=()=>run('window.ConquerCutawayFurniture');

check('the furniture model is well formed',()=>{
  const m=run('window.ConquerFurnitureModel'),names=Object.keys(m.pieces);
  assert.ok(names.length>=45,'about fifty pieces: '+names.length);
  for(const [n,p] of Object.entries(m.pieces)){
    assert.equal(p.i.length,p.c.length*3,n);assert.ok(p.i.every(i=>i>=0&&i*3<p.v.length),n);
    assert.ok(p.c.every(c=>c>=0&&c<m.palette.length),n);assert.ok(p.d>0&&p.w>0&&p.h>0,n+' has a size');
  }
  for(const n of ['torchWall','candleStand','brazier','altar'])assert.ok(m.pieces[n].lights?.length,n+' carries a light');
  assert.ok(m.paletteKeys.includes('heraldA')&&m.paletteKeys.includes('heraldB'),'heraldry placeholders');
});

run(\`
State.seed=99;State.environment=[];State.relief=null;clearReliefBandCache();
State.structures=[
  {id:'t3',type:'tower',shape:'square',size:2,x:96,y:100,level:3,material:'stone',angle:0,functions:[],cutaway:true},
  {id:'t2',type:'tower',shape:'square',size:1.5,x:104,y:100,level:3,material:'stone',angle:0,functions:[],cutaway:true},
  {id:'w1',type:'wall',a:{x:97,y:100},b:{x:103,y:100},width:.5,level:2,aSnap:'t3',bSnap:'t2'},
  {id:'g1',type:'gate',x:100,y:108,w:2,h:1.4,level:2,angle:0,functions:['guard','throneHall'],cutaway:true}
];
State.structures.filter(s=>s.type!=='wall').forEach(s=>normalizeFunctions(s));
\`);

check('archer posts match the drawn arrow slits',()=>{
  const tower=run("State.structures[0]"),slots=run('window.ConquerSiege.archerSlots')(tower).filter(s=>s.kind==='slit');
  const rows=run('towerWindowRows')(tower),faces=run('towerFaceDirections')(tower),slit=run('towerSlitFace'),floorZ=run('towerFloorZ');
  assert.ok(slots.length>0);
  for(const s of slots){
    assert.ok(slit(tower,s.face,s.floor),'a slot only where a slit is drawn: '+s.id);
    assert.ok(Math.abs(s.z-floorZ(tower,s.floor))<1e-9,'the archer stands on the floor');
    assert.ok(Math.abs(s.slitZ-rows.find(r=>r.floor===s.floor).z)<1e-9,'and shoots from the slit height');
    const d=Math.hypot(s.p.x-tower.x,s.p.y-tower.y);assert.ok(d<tower.size/2-.13,'inside the wall: '+d.toFixed(2));
  }
  // Every drawn slit has its archer post.
  for(const r of rows)for(const f of faces)if(slit(tower,f.face,r.floor))assert.ok(slots.some(s=>s.floor===r.floor&&s.face===f.face),'post for slit '+r.floor+'/'+f.face);
  // The wall (H2) towards the other tower blocks floor 2 on that face, not floor 3.
  const east=faces.find(f=>f.nx>.9);
  assert.ok(!slit(tower,east.face,2)&&slit(tower,east.face,3),'wall junction covers only the floors it reaches');
});

const ROLES=['guard','barracks','armory','storage','granary','kitchen','stables','nobleRoom','workshop','chapel','commonHall','throneHall','treasury','prison'];
function rooms(id,roles){
  run("(()=>{const s=State.structures.find(x=>x.id==='"+id+"');s.functions="+JSON.stringify(roles)+";normalizeFunctions(s);window.ConquerCutawayFurniture.clear()})()");
  const s=run("State.structures.find(x=>x.id==='"+id+"')");
  return F().layoutStructure(s,run('cutawayWallGeometry')(s));
}
check('every role is furnished in normal and large rooms, larger rooms get more',()=>{
  for(const role of ROLES){
    const normal=rooms('t2',[role,role,role])[1],large=rooms('t3',[role,role,role])[1];
    assert.ok(normal.items.filter(i=>!i.deco).length>=2,role+' normal: '+normal.items.map(i=>i.name));
    assert.ok(large.items.length>=normal.items.length,role+': a large room holds at least as much');
    assert.ok(normal.items.some(i=>i.name==='torchWall'),role+' has a torch');
  }
  const bunks=r=>r.items.filter(i=>i.name==='bunkBed').length;
  assert.ok(bunks(rooms('t3',['barracks'])[0])>bunks(rooms('t2',['barracks'])[0]),'a large barracks has more bunks');
});

check('pieces stay in the room, apart, off the ladder corner and the archer posts',()=>{
  for(const id of ['t2','t3'])for(const role of ROLES){
    const all=rooms(id,[role,role,role]);
    for(const room of all){
      const hu=room.F.hu,hv=room.F.hv,solid=room.items.filter(i=>!i.deco);
      for(const i of room.items)assert.ok(i.r[0]>=-hu-1e-6&&i.r[2]<=hu+1e-6&&i.r[1]>=-hv-1e-6&&i.r[3]<=hv+1e-6,role+': '+i.name+' inside');
      for(let a=0;a<solid.length;a++)for(let b=a+1;b<solid.length;b++){
        const p=solid[a].r,q=solid[b].r;
        assert.ok(!(p[0]<q[2]-1e-6&&p[2]>q[0]+1e-6&&p[1]<q[3]-1e-6&&p[3]>q[1]+1e-6),role+': '+solid[a].name+' overlaps '+solid[b].name);
      }
      if(room.ladder)for(const i of solid)assert.ok(!(Math.abs(i.u-room.ladder.u)<.12&&Math.abs(i.v-room.ladder.v)<.12),role+': '+i.name+' on the ladder');
      const tower=run("State.structures.find(x=>x.id==='"+id+"')"),b=room.slot.basis,ca=Math.cos(b.angle),sa=Math.sin(b.angle);
      for(const post of run('window.ConquerSiege.archerSlots')(tower).filter(a=>a.kind==='slit'&&a.floor===room.slot.index+1)){
        const dx=post.p.x-b.center.x,dy=post.p.y-b.center.y,u=dx*ca+dy*sa,v=-dx*sa+dy*ca;
        for(const i of solid)assert.ok(!(u>i.r[0]&&u<i.r[2]&&v>i.r[1]&&v<i.r[3]),role+': '+i.name+' blocks the archer post '+post.id);
      }
    }
  }
});

check('gates: no room on the passage floor, furnished rooms above',()=>{
  const g=run("State.structures.find(x=>x.id==='g1')");
  assert.equal(run('functionCapacity')(g),1,'a level-2 gate has one room slot (its upper floor)');
  const all=rooms('g1',['throneHall']);
  assert.equal(all[0].slot.floor,0);assert.ok(!all[0].slot.role&&all[0].items.length===0,'the ground floor is the empty entrance');
  assert.ok(all[0].ladder,'a ladder leads up from the entrance');
  assert.ok(all[1].slot.floor===1&&all[1].items.some(i=>i.name==='throne'),'throne room above the gate');
  const b=all[0].slot.basis;
  for(const i of all[0].items.filter(i=>!i.deco)){
    const across=Math.min(Math.abs(i.r[1]),Math.abs(i.r[3]),Math.abs(i.r[0]),Math.abs(i.r[2]));
    assert.ok(!(i.r[1]<.38&&i.r[3]>-.38&&i.r[0]<b.w/2&&i.r[2]>-b.w/2)||!(i.r[0]<.38&&i.r[2]>-.38&&i.r[1]<b.h/2&&i.r[3]>-b.h/2),'passage clear: '+i.name);
  }
});

check('small (T1) towers open on a spiral stair, subtowers keep it clear of the parent',()=>{
  run(\`State.structures.push(
    {id:'s1',type:'tower',shape:'round',r:.5,x:110,y:100,level:2,material:'stone',angle:0,functions:[],cutaway:true},
    {id:'s2',type:'tower',shape:'square',size:1,x:116,y:100,level:1,material:'stone',angle:0,functions:[],cutaway:true},
    {id:'s3',type:'tower',shape:'round',r:.5,x:97,y:99,level:1,material:'stone',angle:0,functions:[],parentTowerId:'t3',subtowerSocket:'corner:0'},
    {id:'w0',type:'tower',shape:'round',r:.5,x:120,y:100,level:1,material:'wood',angle:0,functions:[],cutaway:true});
    window.ConquerCutawayFurniture.clear()\`);
  const get=id=>run("State.structures.find(x=>x.id==='"+id+"')"),cut=run('structureCutaway'),spiral=run('cutawaySpiralStair');
  assert.ok(cut(get('s1'))&&cut(get('s2')),'stone T1 towers open in cutaway');
  assert.ok(cut(get('s3')),'a T1 subtower opens with its parent');
  assert.ok(!cut(get('w0'))&&!spiral(get('w0')),'wood towers stay solid');
  assert.ok(!spiral(get('t2'))&&!spiral(get('t3')),'T2/T3 towers keep their rooms');
  assert.equal(run('cutawayFloorLevels')(get('s1')).length,1,'the stair shaft has no wooden floors');
  for(const id of ['s1','s2','s3']){
    const s=get(id),g=run('cutawayWallGeometry')(s),st=F().spiralStair(s,g);
    assert.ok(st&&st.R>=.1,id+': a stair fits ('+(st&&st.R.toFixed(2))+')');
    assert.ok(st.steps*.11<=run('structureHeight')(s)&&st.steps>=10,id+': steps up to the top: '+st.steps);
    assert.equal(F().layoutStructure(s,g).length,0,id+': no room furniture nor ladder');
    const faces=F().worldFaces(s);
    assert.ok(faces.length>st.steps*4,id+': stair faces');
    assert.ok(faces.every(f=>f.floor===0&&f.pts.every(p=>p.every(Number.isFinite))),id+': finite, on the ground floor');
    const H=run('structureHeight')(s),zs=faces.flatMap(f=>f.pts.map(p=>p[2]));
    assert.ok(Math.max(...zs)<=H&&Math.min(...zs)>=0,id+': inside the tower height');
    // Every stair point stays in the shaft, out of the parent footprint.
    const inner=g.inner,parent=s.parentTowerId&&get(s.parentTowerId),pip=run('pointInPolygon');
    for(const f of faces)for(const p of f.pts){
      const q={x:p[0],y:p[1]};
      assert.ok(Math.hypot(q.x-s.x,q.y-s.y)<=(s.r||s.size*.71)-.1,id+': inside the walls');
      if(parent)assert.ok(!pip(q,run('footprintPoints')(parent)),id+': clear of the parent');
    }
  }
  run("State.structures=State.structures.filter(s=>!['s1','s2','s3','w0'].includes(s.id))");
});

check('Canvas fallback paints each level and never calls a missing floor function',()=>{
  assert.equal(run('typeof drawCutawayFloorsAndProps'),'function','Canvas 2.5D cutaway floor painter must be available');
  const cube=run("State.structures.find(x=>x.id==='t2')");
  const geometry=run('cutawayWallGeometry')(cube);
  assert.doesNotThrow(()=>run('drawCutawayFloorsAndProps')(cube,geometry),'cutaway must not throw on the fallback path');
});

check('real WebGL2 cutaway mesh builds for single/all towers and every camera turn',()=>{
  const src=fs.readFileSync(__dirname+'/../src/settlement-world3d.js','utf8');
  const meshStart=src.indexOf('  const rgbCache=new Map()'),meshEnd=src.indexOf('  // ---------- terrain ----------',meshStart);
  const cutStart=src.indexOf('  // ---------- cutaway interiors'),cutEnd=src.indexOf('  // ---------- content signatures',cutStart);
  assert.ok(meshStart>0&&meshEnd>meshStart&&cutStart>meshEnd&&cutEnd>cutStart,'real world3d mesh source available');
  run('window.__cutawayMeshRegression=(function(){\\n'+src.slice(meshStart,meshEnd)+'\\n'+src.slice(cutStart,cutEnd)+'\\nreturn buildCutaway;\\n})();');
  for(const rot of [0,1,2,3]){
    run('State.view.rotation='+rot);
    for(const onlyOne of [true,false]){
      run("State.structures.filter(s=>['t2','t3','g1'].includes(s.id)).forEach(s=>s.cutaway="+(!false)+" )");
      if(onlyOne)run("State.structures.find(s=>s.id==='t3').cutaway=false;State.structures.find(s=>s.id==='g1').cutaway=false");
      const out=run('window.__cutawayMeshRegression()');
      assert.ok(out.main.length>50&&out.shell.length>50,'cutaway creates interior and shell geometry');
      for(const part of [out.main,out.shell,out.em])assert.ok(Array.from(part).every(Number.isFinite),'world-space cutaway vertices and colours are finite');
    }
  }
});
console.log('cutaway furniture regression: '+passed+' checks');
`);
