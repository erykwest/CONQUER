'use strict';
// Castle gates and roads: the front and the rear opening of the passage are road magnets (the
// road snaps to the gate port and approaches through that mouth), a road ending there or
// running through the passage is not a conflict, a road cutting across the gate still is.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
run("State.environment=[];State.relief=null;clearReliefBandCache();State.village={};State.structures=[{id:'g',type:'gate',x:100,y:100,w:2,h:1.4,level:2,angle:0,functions:[]}];");
const gate=run("State.structures[0]"),info=run('gatePassageInfo')(gate),snap=run('mainRoadSnapAnchor'),uses=run('roadUsesGatePassage'),conflict=run('manualRoadConflict');
check('road magnets on the front and rear of the passage',()=>{
  for(const end of [info.sideA,info.sideB]){
    const s=snap({x:end.x+.3,y:end.y+.2});
    assert.ok(s.magnet&&s.gatePort?.gateId==='g','snaps to the gate port');
    assert.ok(Math.sign(s.gatePort.approach.x-gate.x)===Math.sign(end.x-gate.x),'approaches through that opening');
  }
  assert.ok(Math.abs(info.sideA.x-info.sideB.x)>2,'front and rear are on opposite sides of the gate');
});
check('roads ending at an opening or running through the passage are allowed',()=>{
  const road=(a,b)=>({type:'road',a,b,width:.62});
  // A snapped road ends on the gate port and reaches it through the mouth on its side.
  for(const end of [info.sideA,info.sideB]){
    const port=snap(end).gatePort,leg=road(port.center,port.approach);
    assert.ok(!conflict(leg,gate),'ends at the opening');
    assert.ok(uses(leg,gate));
  }
  assert.ok(!conflict(road({x:94,y:100},{x:106,y:100}),gate),'runs through the passage');
});
check('a road across the gate is still a conflict',()=>{
  assert.ok(conflict({type:'road',a:{x:100,y:94},b:{x:100,y:106},width:.62},gate),'perpendicular through the towers');
  assert.ok(conflict({type:'road',a:{x:94,y:100.9},b:{x:106,y:100.9},width:.62},gate),'parallel but off the passage');
});
check('gate subtower magnets: four corners and the middle of both flanks',()=>{
  const sockets=run('GATE_SUBTOWER_SOCKETS'),attach=run('gateSubtowerAttachment'),child={type:'tower',shape:'round',r:.5};
  assert.equal(sockets.length,6);
  const pts=sockets.map(k=>attach(gate,child,k));
  assert.ok(pts.every(a=>a&&a.subtowerSocket),'every socket resolves');
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)assert.ok(Math.hypot(pts[i].point.x-pts[j].point.x,pts[i].point.y-pts[j].point.y)>.5,'distinct sockets');
  for(const a of pts){const q=run('toLocalPoint')(gate,a.point);assert.ok(Math.abs(q.x)>=1-1e-6||Math.abs(q.y)>=.7-1e-6,'child centre outside the gate');}
  const sides=pts.filter(a=>a.subtowerSocket.startsWith('gate-side'));
  for(const a of sides){const q=run('toLocalPoint')(gate,a.point);assert.ok(Math.abs(q.x)<1e-6&&Math.abs(Math.abs(q.y)-(.7+.5))<1e-6,'flank socket centred on the side, touching it')}
});
check('all six gate sockets survive each 90-degree orientation',()=>{
  const g=run("State.structures.find(s=>s.id==='g')");
  const sockets=run('GATE_SUBTOWER_SOCKETS'),attach=run('gateSubtowerAttachment');
  const child={type:'tower',shape:'round',r:.5};
  for(let t=0;t<4;t++){
    g.angle=t*Math.PI/2;
    const pts=sockets.map(k=>attach(g,child,k));
    assert.equal(pts.length,6);
    assert.ok(pts.every((p,i)=>p.subtowerSocket===sockets[i]));
    for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)
      assert.ok(Math.hypot(pts[i].point.x-pts[j].point.x,pts[i].point.y-pts[j].point.y)>.5,'unique sockets for rotation '+t);
    for(const item of pts.filter(x=>x.subtowerSocket.startsWith('gate-side'))){
      const p=run('toLocalPoint')(g,item.point);
      assert.ok(Math.abs(p.x)<1e-6&&Math.abs(Math.abs(p.y)-(.7+.5))<1e-6,'lateral socket remains outside the passage');
    }
  }
  g.angle=0;
});
check('saved flank and rear subtowers reattach when the gate rotates',()=>{
  const g=run("State.structures.find(s=>s.id==='g')");
  const attach=run('gateSubtowerAttachment');
  for(const socket of ['gate-rear:0','gate-side:2']){
    const child={id:'saved-'+socket,type:'tower',shape:'round',r:.5,level:1,parentTowerId:'g',subtowerSocket:socket};
    run('State.structures').push(child);
    for(let t=0;t<4;t++){
      g.angle=t*Math.PI/2;
      assert.equal(run('repositionSubtower')(child),true);
      const expected=attach(g,child,socket);
      assert.ok(Math.hypot(child.x-expected.point.x,child.y-expected.point.y)<1e-8,'restored saved socket after rotation');
      assert.equal(child.subtowerSocket,socket,'does not migrate rear/flank socket to front');
    }
    run('State.structures').pop();
  }
  g.angle=0;
});
console.log('gate roads regression: '+passed+' checks');
`);
