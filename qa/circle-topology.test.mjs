import assert from 'node:assert/strict';
import {test} from 'node:test';
import {detectDefensiveCompartments,findNextCircleRefuge} from '../src/circle/defensive-topology.mjs';
const bounds={minX:0,minY:0,maxX:24,maxY:24};
const rect=(a,b,c,d,id='shape')=>({id,polygon:[
  {x:a,y:b},{x:c,y:b},{x:c,y:d},{x:a,y:d}
]});
const ring=(a,b,c,d)=>[
  rect(a,b,c,b+.5,'north'),rect(a,d-.5,c,d,'south'),
  rect(a,b,a+.5,d,'west'),rect(c-.5,b,c,d,'east')
];
const compute=source=>detectDefensiveCompartments({bounds,cellSize:.25,...source});
test('a genuinely closed engineered perimeter creates a defensive compartment',()=>{
  const out=compute({fortifications:ring(4,4,20,20)});
  assert.equal(out.compartments.length,1);
  assert.equal(out.compartments[0].depth,1);
  assert.ok(out.compartments[0].polygon.length>=4);
  assert.equal(out.sectorAt({x:12,y:12}),out.compartments[0].id);
  assert.equal(out.sectorAt({x:3,y:3}),null);
});
test('a wall bay breached across a traversable gap opens the perimeter',()=>{
  const out=compute({fortifications:[
    rect(4,4,11,4.5),rect(13,4,20,4.5),...ring(4,4,20,20).slice(1)
  ]});
  assert.equal(out.compartments.length,0);
});
test('nested defences have increasing depth without forcing one central sector',()=>{
  const out=compute({fortifications:[...ring(3,3,21,21),...ring(8,8,16,16)]});
  assert.deepEqual(out.compartments.map(c=>c.depth).sort(),[1,2]);
  const innermost=out.compartments.find(c=>c.depth===2);
  assert.equal(out.sectorAt({x:12,y:12}),innermost.id);
});
test('two adjacent sectors inside the same outer wall remain separate',()=>{
  const out=compute({fortifications:[...ring(4,4,20,20),rect(11.75,4,12.25,20)]});
  assert.equal(out.compartments.length,2);
  assert.deepEqual(out.compartments.map(c=>c.depth),[1,1]);
});
function gateScenario(open) {
  return compute({fortifications:[
    ...ring(4,4,20,20),rect(11.75,4,12.25,10),
    rect(11.75,14,12.25,20),rect(11.75,10,12.25,14,'gate')
  ],gates:[{id:'main-gate',sideA:{x:11.3,y:12},sideB:{x:12.7,y:12},open}]});
}
test('open gate keeps defensive sectors separate but permits fallback',()=>{
  const out=gateScenario(true);
  assert.equal(out.compartments.length,2);
  assert.equal(out.portals.length,1);
  assert.ok(findNextCircleRefuge(out.compartments[0].id,out,()=> 'secure'));
});
test('closed gate remains defensive and does not permit civilian crossing',()=>{
  const out=gateScenario(false);
  assert.equal(out.compartments.length,2);
  assert.equal(findNextCircleRefuge(out.compartments[0].id,out),null);
});
test('sea is a natural barrier completing three constructed sides',()=>{
  const out=compute({natural:[rect(0,0,4.5,24,'sea')],
    fortifications:[rect(4.25,4,20,4.5),rect(4.25,19.5,20,20),rect(19.5,4,20,20)]});
  assert.equal(out.compartments.length,1);
});
test('a navigable bridge cuts through an otherwise sealing natural obstacle',()=>{
  const out=compute({natural:[rect(0,0,4.5,24,'sea')],
    crossings:[rect(0,10,5,12,'bridge')],
    fortifications:[rect(4.25,4,20,4.5),rect(4.25,19.5,20,20),rect(19.5,4,20,20)]});
  assert.equal(out.compartments.length,0);
});
test('mastio assignment uses its entrance point rather than solid centre',()=>{
  const source={fortifications:ring(4,4,20,20),
    mastioPoint:{x:12,y:12}};
  assert.equal(compute(source).compartments.filter(c=>c.mastio).length,1);
  assert.equal(compute({...source,mastioPoint:{x:2,y:2}}).compartments.filter(c=>c.mastio).length,0);
});

test('an unassessed sector cannot be used as a refuge without combat control',()=>{
  const out=gateScenario(true);
  assert.equal(findNextCircleRefuge(out.compartments[0].id,out),null);
});
test('flat cuts cannot erase invariant sea barriers',()=>{
  const src={natural:[rect(0,0,4.5,24,'cliff')],
    invariantNatural:[rect(0,0,4.5,24,'sea')],
    naturalCuts:[rect(0,0,4.5,24,'flat')],
    fortifications:[rect(4.25,4,20,4.5),rect(4.25,19.5,20,20),rect(19.5,4,20,20)]};
  assert.equal(compute(src).compartments.length,1);
});
