'use strict';
// BC-251105-01/02 wall-walk stairs: a timber or masonry flight against the interior face of a
// finished T2+ wall, built from the inspector, is an access of the wall-walk network (men climb
// at its foot and come out on the walk at its top), its Blender mesh climbs from the ground to the
// walk on the interior side, and it is wired into the renderers, the inspector and the Asset Lab.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
function fixture(structures,stock={gold:100,wood:100,stone:100}){
  const State={structures},log=[];
  const ctx=vm.createContext({State,window:{},Math,Number,Object,Array,Map,Set,String,JSON,
    underConstruction:s=>!!s.building,structureHeight:s=>[1.15,2.10][(s.level||1)-1],wallTier:s=>s.tier||2,
    wallExteriorSide:s=>s.flip?-1:1,pointRadius:()=>.75,structureInteriorVector:()=>({x:1,y:0}),
    w2s:(p,z)=>({x:p.x*10,y:p.y*10-z*10}),status:m=>log.push(m),
    canAfford:c=>Object.entries(c).every(([k,v])=>(stock[k]||0)>=v),
    spendCost:c=>{for(const [k,v] of Object.entries(c))stock[k]-=v},costText:c=>JSON.stringify(c)});
  ctx.window.window=ctx.window;
  for(const f of ['assets/wall-stair-models.js','settlement-wallwalk.js','settlement-wall-stairs.js'])
    vm.runInContext(fs.readFileSync(root+f,'utf8'),ctx);
  return{WW:ctx.window.ConquerWallWalk,WS:ctx.window.ConquerWallStairs,stock,log};
}
const wall=(id,a,b,o={})=>({id,type:'wall',a,b,width:.5,level:1,tier:2,...o});

{
  const data=require('node:vm').runInNewContext(fs.readFileSync(root+'assets/wall-stair-models.js','utf8')+';window',{window:{}}).ConquerWallStairModels;
  for(const key of ['stairWood','stairStone']){
    const m=data.models[key];assert.ok(m&&Object.keys(m.parts).length>=2,key+' has parts');
    let zMax=0,yMin=Infinity;
    for(const part of Object.values(m.parts)){
      assert.equal(part.i.length,part.c.length*3,key+' indexed triangles');
      for(let v=0;v<part.p.length;v+=3){zMax=Math.max(zMax,part.p[v+2]);yMin=Math.min(yMin,part.p[v+1])}
    }
    assert.ok(zMax>=.99&&yMin>=-.001,key+' climbs to rise 1 and stays off the wall face');
  }
  assert.ok(data.models.stairStone.run>data.models.stairWood.run,'masonry flight is gentler than the timber one');
  console.log('PASS Blender models: timber and masonry flights to the walk');
}
{
  // Wall (0,0)->(0,10): exterior on -x, interior on +x.
  const W=wall('W',{x:0,y:0},{x:0,y:10}),{WW,WS,stock}=fixture([W]);
  assert.equal(WW.stairs().length,0,'a bare wall has no access of its own');
  assert.ok(WS.setKind(W,'wood'),'timber stair built');
  assert.deepEqual(stock,{gold:96,wood:86,stone:100},'timber stair paid');
  const st=WW.stairs();
  assert.equal(st.length,1,'the stair is an access of the wall walk');
  assert.equal(st[0].entry.wallId,'W');
  assert.ok(st[0].ground.x>.25,'its foot is in the bailey, on the interior side');
  assert.equal(WW.component(st[0].entry),WW.component({wallId:'W'}),'it leads onto that wall');
  const top=WW.at(st[0].entry);
  assert.ok(Math.abs(top.z-1.25)<1e-9,'it comes out at the walk height');
  const tris=WS.triangles(W),zs=tris.flatMap(t=>t.pts.map(q=>q.z)),xs=tris.flatMap(t=>t.pts.map(q=>q.p.x));
  assert.ok(tris.length>50,'timber mesh emitted');
  assert.ok(Math.min(...zs)>=-1e-6&&Math.abs(Math.max(...zs)-1.25*1.24)<.02,'from the ground up to the walk (handrail above)');
  assert.ok(Math.min(...xs)>=.25-1e-6,'the flight stands against the interior face, not in the masonry');
  const yTop=top.y,yFoot=WS.layout(W).foot.y;
  assert.ok(yTop>yFoot,'the walk is entered at the top of the flight');
  console.log('PASS timber stair joins the wall walk on the interior side');

  assert.ok(WS.setKind(W,'stone'),'upgrade to masonry');
  assert.equal(stock.stone,78,'masonry stair paid');
  assert.equal(WS.setKind(W,'wood'),false,'masonry never goes back to timber');
  assert.ok(WS.setPos(W,'start')&&WS.layout(W).foot.y<2,'the flight moves along the wall');
  W.flip=true;WW.invalidate();
  assert.ok(Math.max(...WS.triangles(W).flatMap(t=>t.pts.map(q=>q.p.x)))<=-.25+1e-6,'flipped wall: stair on the new interior side');
  assert.ok(WS.setKind(W,'none')&&!W.wallStair&&WW.stairs().length===0,'stair removed');
  console.log('PASS masonry upgrade, position, flip and removal');
}
{
  const T1=wall('T1',{x:0,y:0},{x:0,y:10},{tier:1}),short=wall('S',{x:5,y:0},{x:5,y:1.2}),
    busy=wall('B',{x:9,y:0},{x:9,y:10},{building:true}),{WS}=fixture([T1,short,busy]);
  assert.equal(WS.setKind(T1,'wood'),false,'thin T1 walls carry no walk, so no stair');
  assert.equal(WS.setKind(short,'stone'),false,'a wall too short for the flight refuses it');
  assert.equal(WS.setKind(busy,'wood'),false,'not on a wall still being built');
  const poor=fixture([wall('P',{x:0,y:0},{x:0,y:10})],{gold:1});
  assert.equal(poor.WS.setKind(State0(poor),'wood'),false,'no stair without the resources');
  console.log('PASS eligibility and cost');
}
{
  // Breach: the flight stays on the stretch that holds it, in place; in the bay it comes down.
  const W=wall('W',{x:0,y:0},{x:0,y:10}),{WS}=fixture([W]);
  WS.setKind(W,'stone');WS.setPos(W,'start');
  const before=WS.layout(W).foot;
  const left={id:'L',type:'wall',a:W.a,b:{x:0,y:6},width:.5,level:1,tier:2,wallStair:W.wallStair},right={id:'R',type:'wall',a:{x:0,y:7},b:W.b,width:.5,level:1,tier:2,wallStair:W.wallStair};
  assert.equal(WS.splitOnBreach(W,6,7,left,right),left,'kept on the left stretch');
  assert.ok(left.wallStair&&!right.wallStair,'only one stretch keeps it');
  const W2=wall('W2',{x:0,y:0},{x:0,y:10}),f2=fixture([W2]);f2.WS.setKind(W2,'wood');
  const l2={id:'L2',a:W2.a,b:{x:0,y:4.6}},r2={id:'R2',a:{x:0,y:5.4},b:W2.b};
  assert.equal(f2.WS.splitOnBreach(W2,4.6,5.4,l2,r2),null,'a flight in the bay comes down');
  assert.ok(!l2.wallStair&&!r2.wallStair,'neither stretch keeps it');
  const f3=fixture([left]);
  assert.ok(Math.hypot(f3.WS.layout(left).foot.x-before.x,f3.WS.layout(left).foot.y-before.y)<1e-9,'it stays where it was built');
  console.log('PASS a breach keeps or brings down the stair');
}
function State0(f){return f.WW.graph().edges[0].wall}
{
  const read=f=>fs.readFileSync(__dirname+'/../'+f,'utf8');
  const html=read('index.html');
  assert.ok(html.includes('src/assets/wall-stair-models.js')&&html.indexOf('settlement-wall-stairs.js')<html.indexOf('settlement-combat.js'),'game loads models and module');
  assert.match(read('src/settlement-castle3d.js'),/ConquerWallStairs\?\.triangles\(s\)/,'3D body mesh carries the stair');
  assert.match(read('src/settlement-render.js'),/ConquerWallStairs\?\.drawAll\(\)/,'2.5D draws the stair');
  const cmd=read('src/settlement-structure-commands.js');
  assert.match(cmd,/choice\('wallStair','setWallStair'/,'inspector offers the stair on walls');
  assert.match(read('src/asset-catalog.js'),/ConquerWallStairModels/,'Asset Lab catalogues the models');
  assert.match(read('figures-lab.html'),/wall-stair-models\.js/,'Asset Lab loads the models');
  assert.match(read('src/settlement-combat.js'),/ww\.stairs\(\)\.map/,'troops route through every wall-walk access');
  console.log('PASS wiring: renderers, inspector, Asset Lab, combat routing');
}
