'use strict';
// PERF-261116: since #162 (more woodland, steep forest test) environmentContains ran the costly
// terrainSlopeKind for every forest on every road sample, before the bounds test; road planning
// got ~2.6x slower. The slope may only be computed for a point inside the forest polygon, and a
// caller that already knows it passes it in.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const world=fs.readFileSync(path.join(__dirname,'..','src','settlement-world.js'),'utf8');
const grab=name=>{const m=world.match(new RegExp('^function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}','m'));assert.ok(m,name+' found');return m[0]};
let slopeCalls=0,steep=false;
const ctx=vm.createContext({Math,Number,Object,Array,Set,
  terrainSlopeKind:()=>{slopeCalls++;return steep?'steep':null},
  forestHoleAt:()=>false,
  environmentPolygonBounds:pts=>({minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))})});
vm.runInContext(grab('pointInPolygon')+'\n'+grab('environmentContains')+'\nthis.contains=environmentContains;',ctx);
const forest={type:'forest',points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]};

slopeCalls=0;
assert.equal(ctx.contains(forest,{x:50,y:50}),false);
assert.equal(slopeCalls,0,'a point outside the forest bounds never computes the slope');

slopeCalls=0;
assert.equal(ctx.contains(forest,{x:5,y:5}),true);
assert.equal(slopeCalls,1,'inside the forest the steep test runs once');

steep=true;slopeCalls=0;
assert.equal(ctx.contains(forest,{x:5,y:5}),false,'a steep point is not inside the forest');
steep=false;

slopeCalls=0;
assert.equal(ctx.contains(forest,{x:5,y:5},0,'steep'),false,'a caller-provided slope is honoured');
assert.equal(ctx.contains(forest,{x:5,y:5},0,null),true);
assert.equal(slopeCalls,0,'a caller-provided slope is not recomputed');

assert.match(world,/environmentContains\(f,p,\.45,slope\)|environmentContains\(f,p,[^)]*,slope\)/,'environmentBlocksPoint passes its slope through');
console.log('PASS environmentContains computes the slope only inside a forest, once, or reuses the caller\'s');
