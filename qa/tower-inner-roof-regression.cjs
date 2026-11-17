'use strict';
// BC-251105-05 — inner roof: a pyramid / cone set back inside the merlons of a crenellated or
// machicolated T2+ stone tower, on a low kerb, the wall-walk left free between roof and merlons.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
if(typeof run('typeof orientedTowerOutline')!=='undefined'&&run('typeof orientedTowerOutline')!=='function')run(fs.readFileSync(__dirname+'/../src/settlement-tower-shapes.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const tower=(id,extra={})=>run('normalizeStructureVariants')({id,type:'tower',shape:'square',material:'stone',size:1.5,tier:2,level:2,roofStyle:'battlement',x:100,y:100,angle:0,functions:[],...extra});
const mounted=s=>run('towerInnerRoofMounted')(s),geo=s=>run('towerInnerRoofGeometry')(s);

check('towers start without an inner roof; it takes T2+ stone towers with merlons or machicolations',()=>{
  assert.equal(tower('a').innerRoof,'off');
  assert.ok(mounted(tower('b',{innerRoof:'on'})));
  assert.ok(mounted(tower('c',{roofStyle:'machicolation',innerRoof:'on'})));
  assert.ok(mounted(tower('d',{shape:'round',r:.75,innerRoof:'on'})),'round T2');
  assert.ok(!mounted(tower('e',{roofStyle:'pitched',innerRoof:'on'})),'not under a pitched roof');
  assert.ok(!mounted(tower('f',{size:1,tier:1,innerRoof:'on'})),'not on T1: no room for roof and wall-walk');
  assert.ok(!mounted(tower('g',{material:'wood',innerRoof:'on'})),'not on wood');
  assert.ok(!mounted(tower('h',{brokenTop:true,innerRoof:'on'})),'not on a broken crown');
  assert.ok(!mounted(tower('i',{shape:'half',innerRoof:'on'})),'not on a semitower');
  assert.ok(!run('setStructureVariant')(tower('j'),'innerRoof','dome'),'only off / on');
});
check('the deck weapon and the inner roof exclude each other',()=>{
  assert.ok(!mounted(tower('a',{topWeapon:'mangonel',innerRoof:'on'})),'weapon first');
  assert.ok(!run('towerTopWeaponAllowed')(tower('b',{innerRoof:'on'})),'roof first');
  assert.ok(run('towerTopWeaponAllowed')(tower('c')),'T2 crenellated tower still takes a weapon');
  assert.ok(!mounted(tower('d',{signalFire:'pyre',innerRoof:'on'})),'no inner roof over a signal pyre');
  const soldiers=fs.readFileSync(__dirname+'/../src/settlement-soldiers.js','utf8');
  assert.ok(soldiers.includes("structureVariant(s,'innerRoof')!=='on'"),'no signal pyre under an inner roof');
});
check('the roof stands inside the merlons, on a kerb, and rises above them',()=>{
  for(const t of [tower('s',{innerRoof:'on'}),tower('r',{shape:'round',r:1,tier:3,level:3,innerRoof:'on'}),tower('m',{size:2,tier:3,roofStyle:'machicolation',innerRoof:'on'})]){
    setup([t]);const g=geo(t),h=run('structureHeight')(t);
    assert.ok(g,'geometry');
    assert.equal(g.h,h);assert.ok(g.eaveZ>h&&g.apexZ>h+.4,'kerb, then a roof above the merlons');
    const merlons=run('towerBattlementPieces')(t).filter(p=>p.merlon);
    // Distance from the centre: radial on round towers, along the axes (Chebyshev) on square ones.
    const d=q=>t.shape==='round'?Math.hypot(q.x-t.x,q.y-t.y):Math.max(Math.abs(q.x-t.x),Math.abs(q.y-t.y));
    const inner=Math.min(...merlons.flatMap(p=>p.pts.map(d))),reach=Math.max(...g.ring.map(d));
    assert.ok(reach<inner-.15,'a wall-walk at least 0.15 U wide between roof and merlons');
    assert.ok(Math.abs(run('towerVisualTopHeight')(t)-g.apexZ)<1e-9,'visual top = apex');
  }
});
check('D tower: a ridge from the rear to the half round, every slope at the same pitch',()=>{
  const t=tower('d',{shape:'dee',size:2,tier:3,level:3,innerRoof:'on'});setup([t]);
  const g=geo(t);assert.ok(g,'large D takes the inner roof');
  assert.ok(Math.hypot(g.tail.x-g.apex.x,g.tail.y-g.apex.y)>.3,'a ridge, not a single apex');
  const faces=run('towerInnerRoofFaces')(g);
  assert.equal(faces.length,g.ring.length,'one face per eave edge');
  const tan=(g.apexZ-g.eaveZ)/g.half;
  // Horizontal run from each eave line to the ridge = the half span: same pitch all round
  // (eave edge midpoints; the two rear corners sit on the hips, a half span diagonally).
  const a=g.tail,b=g.apex,dx=b.x-a.x,dy=b.y-a.y;
  for(const f of faces){
    const p={x:(f.pts[0].p.x+f.pts[1].p.x)/2,y:(f.pts[0].p.y+f.pts[1].p.y)/2};
    const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
    const run_=Math.hypot(p.x-(a.x+dx*u),p.y-(a.y+dy*u));
    assert.ok(Math.abs(run_-g.half)<.02,'eave '+run_.toFixed(3)+' U from the ridge, half span '+g.half.toFixed(3));
  }
  assert.ok(tan>=1.6-1e-9);
  const sq=tower('s',{innerRoof:'on'});setup([sq]);const gs=geo(sq);
  assert.ok(gs.tail===gs.apex,'square towers keep the pyramid');
});
check('the inner roof removes the brazier (no fire on the deck)',()=>{
  for(const t of [tower('s',{innerRoof:'on'}),tower('r',{shape:'round',r:1,tier:3,level:3,innerRoof:'on'}),tower('d',{shape:'dee',size:2,tier:3,level:3,innerRoof:'on'})]){
    setup([t]);
    assert.ok(!run('towerHasBrazier')(t),t.shape+': no brazier under the inner roof');
    assert.ok(!run('battlementBrazierSources')().some(x=>x.id.startsWith(t.id+':')),t.shape+': no brazier fixture, flame or glow');
  }
  const off=tower('o');setup([off]);
  assert.ok(run('towerHasBrazier')(off),'no inner roof: the brazier stays');
  assert.ok(run('battlementBrazierSources')().some(x=>x.id==='o:brazier'));
  // The brazier body is part of the castle mesh (depth-tested in 3D), not painted on top.
  if(run("typeof window.ConquerCastle3D")==='undefined')run(fs.readFileSync(__dirname+'/../src/settlement-castle3d.js','utf8'));
  const C3=run('window.ConquerCastle3D'),src=run('battlementBrazierSources')().find(x=>x.id==='o:brazier');
  assert.equal(src.structureId,'o','the brazier knows its tower');
  const box=run('brazierFixtureBox')(src);
  const meshHasBrazier=()=>{const m=C3.worldMeshes(),all=[m.body,m.front];
    // A brazier top: a vertex at the box top height inside its footprint.
    const zTop=box.z1+box.groundZ;
    return all.some(t=>{for(let i=0;i<t.length;i+=6)if(Math.abs(t[i+2]-zTop)<1e-4&&Math.abs(t[i]-src.p.x)<=.1001&&Math.abs(t[i+1]-src.p.y)<=.1001)return true;return false})};
  assert.ok(meshHasBrazier(),'the castle mesh builds the brazier block');
  run("window.ConquerWorld3D={active:()=>true}");
  assert.equal(C3.ownsBrazier(src),true,'World3D: the mesh owns the brazier, the canvas does not paint it');
  run("window.ConquerWorld3D={active:()=>false}");
  assert.equal(C3.ownsBrazier(src),C3.active(),'2.5D: the canvas paints it unless the WebGL castle body is on');
  run("delete window.ConquerWorld3D");
  assert.ok(fs.readFileSync(__dirname+'/../src/settlement-castle-structures.js','utf8').includes('if(!window.ConquerCastle3D?.ownsBrazier?.(src))drawBrazierFixture(src)'),'the canvas skips braziers the mesh owns');
});
check('2.5D: one inner-roof piece among the merlons, only when mounted and built',()=>{
  const on=tower('a',{innerRoof:'on'}),off=tower('b'),site=tower('c',{innerRoof:'on',construction:{progress:.5}});
  setup([on,off,site]);
  assert.equal(run('towerInnerRoofPiece')(on)?.kind,'innerRoof');
  assert.equal(run('towerInnerRoofPiece')(off),null);
  assert.equal(run('towerBattlementPieces')(on).length,run('towerBattlementPieces')(off).length,'merlons unchanged');
});
check('rooms under the roof keep asking for a pitched roof (Colombaia, Falconiera, Campana)',()=>{
  const t=tower('a',{level:2,innerRoof:'on'});setup([t]);
  assert.ok(!run('towerDovecoteAllowed')(t),'no dovecote under an inner roof');
  // ROOM_EXTERIOR roof mounts (the belfry) ask roomExteriorRoofBase, which wants towerRoofStyle 'pitched'.
  assert.equal(run('towerRoofStyle')(t),'battlement','the tower top stays crenellated');
  const src=fs.readFileSync(__dirname+'/../src/settlement-room-exterior.js','utf8');
  assert.ok(/towerRoofStyle\\(s\\)!=='pitched'\\)return null/.test(src),'roof elements stay on pitched roofs');
});
console.log('tower inner roof regression: '+passed+' checks');
`);
