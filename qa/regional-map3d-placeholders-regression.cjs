'use strict';
// Run: node qa/regional-map3d-placeholders-regression.cjs
// Primitive visual symbols only. Live markers are read-only; demo markers must
// never masquerade as simulation entities or be stored in a game save.
const assert=require('node:assert/strict');
const marker=require('../src/regional-map3d-placeholders.js');
const pt=(x,y)=>({x,y});
assert.deepEqual(marker.HERALDRY_DEFAULT,['#b32628','#eac15b']);
assert.equal(marker.normalize([{kind:'castle',x:1,y:1,palisade:true}]).length,0);
assert.equal(marker.normalize([{kind:'castle',x:1,y:1,wallType:'palisade'}]).length,0);
assert.equal(marker.normalize([{kind:'castle',x:1,y:1,material:'stone'}]).length,1);
assert.equal(marker.normalize([{kind:'troops',x:1,y:1}]).length,0,
  'do not invent heraldic colours when none are supplied');
assert.deepEqual(marker.normalize([{kind:'troops',x:1,y:1,heraldry:{c1:'#224466',c2:'#ddaa33'}}])[0].colors,
  ['#224466','#ddaa33'],'two original player heraldry colours');
assert.equal(marker.normalize([{kind:'ship',point:pt(5,6)}])[0].x,5);
assert.equal(marker.normalize([{kind:'ship',point:pt(5,6)}])[0].y,6);
const cells=[
 {id:0,macroId:0,polygon:[pt(0,0),pt(100,0),pt(100,100),pt(0,100)]},
 {id:1,macroId:1,polygon:[pt(100,0),pt(200,0),pt(200,100),pt(100,100)]},
 {id:2,macroId:2,polygon:[pt(0,100),pt(100,100),pt(100,200),pt(0,200)]},
 {id:3,macroId:3,polygon:[pt(100,100),pt(200,100),pt(200,200),pt(100,200)]}
];
const snapshot={seed:10,width:200,height:200,cells,
  terrain:{0:'forest',1:'plain',2:'sea',3:'sea'}};
const scene={coastlines:[{start:pt(0,100),end:pt(100,100),macroIds:[0,2]}]};
const demo=marker.demo(snapshot,scene);
assert.deepEqual(marker.counts(demo),{village:1,castle:1,port:1,ship:1,troops:1});
assert.ok(demo.every(obj=>obj.demo),'demonstration entities explicitly marked');
const boat=demo.find(obj=>obj.kind==='ship');
const atStart=marker.positionAt(boat,0),atQuarter=marker.positionAt(boat,boat.periodMs/4);
const atHalf=marker.positionAt(boat,boat.periodMs/2),atEnd=marker.positionAt(boat,boat.periodMs);
assert.ok(Math.hypot(atStart.x-atQuarter.x,atStart.y-atQuarter.y)>1,'ship genuinely moves along sea route');
assert.ok(Math.hypot(atStart.x-atHalf.x,atStart.y-atHalf.y)>1,'ship can reach destination');
assert.ok(Math.hypot(atStart.x-atEnd.x,atStart.y-atEnd.y)<1e-9,'movement loops without jump');
const fixed=marker.normalize([{
  kind:'ship',x:10,y:20,route:[pt(0,0),pt(100,0)],progress:.25
}])[0];
assert.equal(marker.positionAt(fixed,123).x,25,'real ship progress from live simulation is respected');
assert.equal(marker.positionAt(fixed,12000).x,25,'real ship does not auto-advance without source data');
let fills=0;const paints=[];
const ctx={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){fills++;paints.push(this.fillStyle);},stroke(){}};
const camera={width:800,height:600,scale:1};
const project=({x,y,z})=>({x:x+150,y:y+150-z,depth:x+y+z});
marker.paint(ctx,demo,project,camera,boat.periodMs/4);
assert.ok(fills>35,'all five geometries produce visible filled polygonal faces');
assert.ok(paints.some(p=>/^#/.test(p)),'marker colours are applied');
assert.equal(marker.normalize(null).length,0,'empty state adds no invented symbols');
console.log('PASS region3d markers: orange village cube, grey castle cube, brown port/ship, moving ship, two heraldic cylinders, palisade exclusions, clean demo isolation.');
