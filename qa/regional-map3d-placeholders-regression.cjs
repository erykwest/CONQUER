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
assert.deepEqual(marker.counts(demo).castle,1);
assert.deepEqual(marker.counts(demo).port,1);
assert.deepEqual(marker.counts(demo).ship,1);
assert.deepEqual(marker.counts(demo).troops,1);
assert.ok(marker.counts(demo).village>=1,'at least one example village');
assert.ok(demo.every(obj=>obj.demo),'demonstration entities explicitly marked');
assert.ok(demo.filter(m=>m.kind==='village').every(m=>m.level>=1&&m.level<=4),'example villages carry a level');
assert.equal(marker.normalize([{kind:'village',x:1,y:1}])[0].level,1,'real villages without a source level are L1, not invented');
assert.equal(marker.normalize([{kind:'village',x:1,y:1,level:3}])[0].level,3,'a source level is kept');
assert.equal(marker.normalize([{kind:'castle',x:1,y:1}])[0].colors,null,'no owner colours invented for castles');
assert.equal(marker.normalize([{kind:'ship',x:1,y:1}])[0].z,-1.8,'ships sit on the sea surface (elevation of sea)');
const port=demo.find(m=>m.kind==='port');
assert.ok(Math.sin(port.heading)>.9,'example jetty runs from the shore out to sea (sea is +y here)');
const boat=demo.find(obj=>obj.kind==='ship');
assert.ok(boat.route.every(p=>p.y>=100),'example ship route stays on the sea cells (y >= 100 here)');
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

// Token path: with the regional token registry the markers are the Blender meshes (one filled
// triangle per mesh triangle), the owner's c1 replaces 'team', and village levels pick L1-L4.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const box={window:{}};vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/assets/region-token-models.js'),'utf8'),box);
const tokens=box.window.ConquerRegionTokenModels;
const paintOne=(m,opts={})=>{
  const fills=[];
  const c={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){fills.push(this.fillStyle)},stroke(){}};
  marker.paint(c,marker.normalize([m]),project,{...camera,cos:1,sin:0},0,{tokens,troops:null,...opts});
  return fills;
};
for(let level=1;level<=4;level++)
  assert.equal(paintOne({kind:'village',x:10,y:10,level}).length,tokens.models['village'+level].tris,'village L'+level+' token');
assert.equal(paintOne({kind:'castle',x:10,y:10}).length,tokens.models.castle.tris,'castle token');
assert.equal(paintOne({kind:'port',x:10,y:10}).length,tokens.models.port.tris,'port token');
assert.equal(paintOne({kind:'ship',x:10,y:10}).length,tokens.models.ship.tris,'ship token');
const blue=paintOne({kind:'ship',x:10,y:10,colors:['#2255cc','#ddaa33']});
assert.ok(blue.some(f=>{const [r,g,b]=[1,3,5].map(i=>parseInt(f.slice(i,i+2),16));return b>r*1.6&&b>g}),'sail takes the owner c1');
const rgbOf=f=>[1,3,5].map(i=>parseInt(f.slice(i,i+2),16));
for(const kind of ['ship','castle']){
  const plain=paintOne({kind,x:10,y:10});
  assert.ok(!plain.some(f=>{const [r,g,b]=rgbOf(f);return b>r*1.6&&b>g}),kind+': no owner colour without heraldry');
  assert.ok(!plain.some(f=>{const [r,g,b]=rgbOf(f);return r>g*2.2&&r>b*2.2}),kind+': not the default heraldry red (the player\'s) without heraldry');
}
assert.ok(paintOne({kind:'ship',x:10,y:10,colors:[...marker.HERALDRY_DEFAULT]}).some(f=>{const [r,g,b]=rgbOf(f);return r>g*2.2&&r>b*2.2}),'the default red only when that heraldry is supplied');
assert.ok(demo.filter(m=>m.kind==='castle'||m.kind==='ship').every(m=>m.colors&&m.ownerId),'example castle and ship carry their example owner colours');
// Without the sprite assets (Node: no Image) troops keep the heraldic cylinders.
assert.ok(paintOne({kind:'troops',x:10,y:10,colors:['#224466','#ddaa33']}).length>=24,'troops fall back to the two cylinders');
// groundZ lifts land markers onto the terrain; ships stay on the water.
let asked=0;paintOne({kind:'castle',x:10,y:10},{groundZ:()=>{asked++;return 5}});
assert.equal(asked,1,'land markers ask the terrain height');
asked=0;paintOne({kind:'ship',x:10,y:10},{groundZ:()=>{asked++;return 5}});
assert.equal(asked,0,'ships keep the waterline');
console.log('PASS region3d markers: orange village cube, grey castle cube, brown port/ship, moving ship, two heraldic cylinders, palisade exclusions, clean demo isolation.');
