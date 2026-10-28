'use strict';
// Wall walks: finished walls (T2+) and palisades form a walkable network; runs of walls
// join at their ends, towers/gates join the walls seated on them and are the stairs
// (ground access on the interior side); a breach cuts the network. Units on walls only
// meet men on the same joined walls; stones from hoardings/machicolations hit men at
// the wall foot. Thin T1 walls carry no walk.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
function fixture(structures){
  const State={structures};
  const ctx=vm.createContext({State,window:{},Math,Number,Object,Array,Map,Set,String,
    underConstruction:s=>!!s.building,structureHeight:s=>[1.15,2.10][(s.level||1)-1],wallTier:s=>s.tier||2,
    wallExteriorSide:s=>s.flip?-1:1,pointRadius:()=>.75,
    structureInteriorVector:()=>({x:1,y:0}),w2s:(p,z)=>({x:p.x*10,y:p.y*10-z*10})});
  vm.runInContext(fs.readFileSync(root+'settlement-wallwalk.js','utf8'),ctx);
  return ctx.window.ConquerWallWalk;
}
const wall=(id,a,b,o={})=>({id,type:'wall',a,b,width:.5,level:1,tier:2,...o});

{
  // Tower T at (0,10); wall A runs up to it, wall B leaves it; wall C continues B end to end.
  const T={id:'T',type:'tower',x:0,y:10};
  const WW=fixture([T,wall('A',{x:0,y:0},{x:0,y:9.4},{bSnap:'T'}),wall('B',{x:0,y:10.6},{x:0,y:16},{aSnap:'T'}),
    wall('C',{x:0,y:16},{x:4,y:16}),wall('thin',{x:10,y:0},{x:10,y:5},{tier:1})]);
  const g=WW.graph();
  assert.equal(g.edges.length,3,'T1 walls carry no wall walk');
  assert.ok(Math.abs(g.edges[0].z-1.25)<1e-9,'men walk at the patrols height');
  assert.equal(g.stairs.length,1,'the tower is a stair');
  assert.equal(g.stairs[0].entry.wallId,'A');
  assert.ok(g.stairs[0].ground.x>0,'its foot is on the interior side');
  const r=WW.route({wallId:'A',t:.5},{wallId:'C',t:.5});
  assert.ok(r,'walls joined through the tower and end to end');
  assert.ok(r.points.some(p=>Math.abs(p.x)<1e-9&&Math.abs(p.y-10)<1e-9),'the walk passes through the tower');
  assert.ok(Math.abs(r.length-(4.7+.6+.6+5.4+2))<1e-6,'shortest walk along the wall tops');
  const loc=WW.locate({x:.3,y:12});assert.equal(loc.wallId,'B');
  assert.equal(WW.pickScreen({x:0,y:120-12.5}).wallId,'B','a wall top is picked on screen at its height');
  console.log('PASS walls, joints and towers form one walkable network with stairs');
}
{
  // A breach leaves two stretches that do not touch: two components.
  const WW=fixture([wall('L',{x:0,y:0},{x:0,y:3}),wall('R',{x:0,y:5.5},{x:0,y:8})]);
  assert.notEqual(WW.component({wallId:'L'}),WW.component({wallId:'R'}),'a breach cuts the wall walk');
  assert.equal(WW.route({wallId:'L',t:.5},{wallId:'R',t:.5}),null,'no walking across a breach');
  const f=WW.frame({wallId:'L',t:.5});
  assert.ok(Math.abs(f.ex*f.ex+f.ey*f.ey-1)<1e-9&&f.half===.25,'wall frame gives the exterior side');
  console.log('PASS a breach cuts the network');
}
{
  // Stones: rules hit for 3 hp each, armour counts.
  const window={};
  const ctx=vm.createContext({window,Math,Number,Object,Array,Map,Set,String});
  vm.runInContext(fs.readFileSync(root+'settlement-combat-rules.js','utf8'),ctx);
  const R=window.ConquerCombatRules,target={x:0,y:0,combatKind:'infantry',h:0};
  let hits=0;for(let i=0;i<40&&!target.defeated;i++)hits+=R.dropStone({},target,{x:.2,y:0,z:1.3},1);
  assert.equal(R.STONE_DAMAGE,3);
  assert.ok(hits>0&&target.stats.hp===100-hits*3||target.defeated,'each stone that lands takes 3 hp');
  console.log('PASS stones from the walls');
}
{
  // Combat wiring (source-level): melee only on the same level, stones, assault AI, legs.
  const src=fs.readFileSync(root+'settlement-combat.js','utf8');
  assert.match(src,/const la=levelOf\(a\);if\(la!==levelOf\(b\)\|\|la==='climb'\)return false;/,'melee only between men on the same level');
  assert.match(src,/stoneDrops\(step\);/,'stones drop every rule step');
  assert.match(src,/skin==='hoarding'\|\|\(skin==='machicolation'&&hasMachicolation\(f\.wall\)\)\?1:0/,'only hoardings and machicolations drop stones, 0-1 U');
  assert.match(src,/window\.ConquerSiege\?\.assaultCheck\(s,kind/,'storm points obey the assault rules');
  assert.match(src,/e\.h=terrainElevation\(e\)\+\(e\.z\|\|0\)/,'men on walls are shot at their height');
  const html=fs.readFileSync(root+'../index.html','utf8');
  assert.ok(html.indexOf('settlement-wallwalk.js')<html.indexOf('settlement-combat.js'),'wall walks load before combat');
  console.log('PASS combat uses wall levels, stones and assault rules');
}
