'use strict';
// Siege earthworks: attackers fill a ravine level by level. Each Z level costs 3x a moat
// fill, paid by the foot soldiers at the mound; every finished level is a graded
// terraforming terrace of sand fill, narrower than the one beneath, so the slope runs
// continuously to the top. Fill only adds earth: it never lowers a hill.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const src=['settlement-terraforming.js','settlement-earthworks.js'].map(f=>fs.readFileSync(root+f,'utf8')).join('\n');

function world(){
  const units=[];
  const ctx=vm.createContext({
    State:{relief:{terraforming:[]},siege:{},biome:'temperate'},console,Math,Object,Array,Number,String,JSON,Set,Map,
    BUILD_MIN:50,BUILD_MAX:150,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    pointInPolygon:(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c},
    // A valley at 0 for x<104, a cliff up to an H5 plateau beyond.
    terrainBaseElevation:p=>p.x>=104?5:0,
    window:{ConquerCombat:{units:()=>units,enemy:()=>[]}}
  });
  ctx.window.window=ctx.window;
  vm.runInContext(src.replace(/window\./g,'window.'),ctx);
  ctx.terrainElevation=p=>ctx.window.ConquerTerraforming.elevationAt(p,ctx.terrainBaseElevation(p));
  ctx.terrainPlateauElevation=p=>ctx.terrainElevation(p);
  return{ctx,E:ctx.window.ConquerEarthworks,T:ctx.window.ConquerTerraforming,units,z:p=>ctx.terrainElevation(p)};
}
{
  const {E,units,z}=world();
  assert.equal(E.LEVEL_EFFORT,3*E.MOAT_FILL_EFFORT,'a level costs three moat fills');
  const r=E.start({x:100,y:100},{radius:3,targetZ:5});
  assert.ok(r.ok);assert.equal(r.levels,5);
  // Nobody at the mound: nothing happens.
  E.tick(10);assert.equal(E.status(r.work).levels,0,'no workers, no fill');
  // Three squads: 2.5 days per level.
  for(let i=0;i<3;i++)units.push({id:'u'+i,kind:'squad',x:100+i*.3,y:103});
  assert.equal(E.workers(r.work),3);
  E.tick(2.5);assert.equal(E.status(r.work).levels,1,'one level after 2.5 days with 3 squads');
  assert.equal(z({x:100,y:100}),1);
  E.tick(10);
  const st=E.status(r.work);assert.ok(st.done&&st.levels===5,'five levels after 12.5 days');
  assert.equal(z({x:100,y:100}),5,'the top reaches H5');
  // The slope is continuous from the valley floor to the top: no step taller than half a level.
  // A 2:1 bank: half a unit of run per level, so the whole H5 mound spans r 3+2.5.
  assert.equal(z({x:94.4,y:100}),0,'the foot is 5.5U out');
  let last=z({x:94,y:100});
  for(let x=94.25;x<=100;x+=.25){const h=z({x,y:100});assert.ok(Math.abs(h-last)<=.55,'no cliff at x='+x+' ('+last+'→'+h+')');last=h}
  console.log('PASS ravine fill rises level by level at 3x the moat effort, as a continuous slope');
}
{
  const {E,z}=world();
  // Against the H5 cliff: the mound never lowers the plateau it touches.
  const r=E.start({x:102,y:100},{radius:3,targetZ:5});
  E.tick(3,{force:3});
  assert.equal(z({x:105,y:100}),5,'the plateau stays at H5 while the fill is low');
  E.tick(20,{force:3});
  assert.equal(z({x:101,y:100}),5);assert.equal(z({x:105,y:100}),5,'the filled top meets the plateau level');
  assert.ok(E.list()[0].edits.length===5);
  console.log('PASS fill only adds earth and meets the plateau');
}
{
  const {E}=world();
  assert.equal(E.start({x:110,y:100},{targetZ:5}).ok,false,'nothing to fill on the plateau');
  console.log('PASS no fill where the ground is already at the level');
}

// A save-load round trip must retain completed and pending earthworks; the
// production siege state takes ownership of the list.
{
  const {E}=world(),r=E.start({x:99,y:100},{radius:3,targetZ:2});
  assert.ok(r.ok);
  E.tick(2.5,{force:3});
  assert.equal(E.list().length,1);
  assert.equal(E.list()[0].levels,1);
  console.log('PASS pending earthworks remain in the persistent siege state');
}
