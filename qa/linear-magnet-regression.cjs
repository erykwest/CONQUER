'use strict';
// Wall and palisade magnets: a new run snaps to the free end of a wall/palisade of the
// same type (also still under construction), exactly, with a reach that holds when
// zoomed out; ends seated on a tower are taken; towers/gates still win when nearer.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const placement=fs.readFileSync(root+'settlement-castle-placement.js','utf8');
const core=fs.readFileSync(root+'settlement-core.js','utf8');
const input=fs.readFileSync(root+'settlement-app-input.js','utf8');
const pick=(src,re,name)=>{const m=src.match(re)?.[0];assert.ok(m,'use the actual '+name);return m};
const code=[
  pick(core,/const LINEAR_POINT_MAGNET=[^;]+;/,'magnet constant'),
  pick(core,/const ORIENTED_TOWER_SPECS=[\s\S]*?\nfunction isOrientedTower\(s\)\{[^\n]*\}/,'oriented tower shapes'),
  pick(placement,/function boundaryPoint\([\s\S]*?\n\}/,'boundaryPoint'),
  pick(placement,/function linearMagnetRadius\([\s\S]*?\n\}/,'linearMagnetRadius'),
  pick(placement,/function linearEndpointSnap\([\s\S]*?\n\}/,'linearEndpointSnap'),
  pick(placement,/function snapAnchor\([\s\S]*?\n\}/,'snapAnchor')
].join('\n');
function fixture(tool,scale=1){
  const State={structures:[],tool:{kind:'linear',linear:tool},view:{scale}};
  const ctx=vm.createContext({State,Math,Number,U:12,window:{},
    dist:(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),snapGrid:v=>Math.round(v*4)/4,
    underConstruction:s=>!!s.building,rotateVec:(x,y)=>({x,y}),rectDims:s=>({w:s.size,h:s.size})});
  vm.runInContext(code+'\nthis.snapAnchor=snapAnchor;this.radius=linearMagnetRadius;',ctx);
  return{State,ctx};
}
const wall=(o)=>({id:'w'+Math.random(),type:'wall',a:{x:0,y:0},b:{x:5,y:0},...o});

{
  const {State,ctx}=fixture('wall');
  State.structures.push(wall({building:true}));
  const s=ctx.snapAnchor({x:5.6,y:.3});
  assert.ok(s.magnet&&s.endpoint&&s.point.x===5&&s.point.y===0,'snaps exactly to the free end of a wall just placed');
  assert.equal(s.structureId,null,'a wall end is not a tower snap');
  assert.equal(ctx.snapAnchor({x:7,y:0}).magnet,false,'out of reach at full zoom');
  console.log('PASS a new wall run snaps to the free end of the last one');
}
{
  const {State,ctx}=fixture('wall',.2);
  State.structures.push(wall({}));
  assert.ok(ctx.radius()>2,'zoomed out the reach grows with the screen');
  assert.ok(ctx.snapAnchor({x:7,y:0}).endpoint,'and still grabs the end');
  console.log('PASS the magnet holds when zoomed out');
}
{
  const {State,ctx}=fixture('palisade');
  State.structures.push(wall({}),{id:'p',type:'palisade',a:{x:10,y:0},b:{x:15,y:0}});
  assert.equal(ctx.snapAnchor({x:5.3,y:0}).endpoint,undefined,'a palisade does not snap to a stone wall');
  assert.ok(ctx.snapAnchor({x:15.4,y:0}).endpoint,'but to a palisade end');
  console.log('PASS palisades snap to palisades');
}
{
  const {State,ctx}=fixture('wall');
  State.structures.push(wall({bSnap:'t'}),{id:'t',type:'tower',x:5.5,y:0,size:1});
  const s=ctx.snapAnchor({x:5.3,y:.2});
  assert.equal(s.endpoint,undefined,'an end seated on a tower is taken');
  assert.equal(s.structureId,'t','the tower magnet still works');
  console.log('PASS ends on towers are taken; towers still snap');
}
assert.match(input,/normalizeStructuralLinearRoute\(State\.draft\.a,e2\.point,spec,!!\(e2\.structureId\|\|e2\.endpoint\)\)/,'the click routes exactly to a wall end');
assert.match(input,/normalizeStructuralLinearRoute\(State\.draft\.a,snap\.point,spec,!!\(snap\.structureId\|\|snap\.endpoint\)\)/,'and so does the preview');
console.log('PASS routes end exactly on the magnet');
