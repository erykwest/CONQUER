'use strict';
// Bridges between terraces: a terraced top is a plateau at its raised height, so a
// bridge from an H5 terrace built on an H1 hill to an H5 hill is level and allowed,
// while one from that terrace down to the valley floor is refused (no sloped bridges).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const castle=fs.readFileSync(root+'settlement-castle.js','utf8');
const fn=castle.match(/function terrainPlateauElevation\(p\)\{[\s\S]*?\n\}/)[0];
const crossings=fs.readFileSync(root+'settlement-crossings.js','utf8');

// H1 hill around x<86 with an H5 terrace on top at 83–86; an H5 hill at x>96; valley between.
const natural=p=>p.x<86?1:p.x>96?5:0;
const terraced=p=>p.x>=83&&p.x<=86?5:null;
const ctx=vm.createContext({
  State:{structures:[],relief:{hills:[]}},console,Math,Object,Array,Map,Set,String,Number,JSON,
  window:{ConquerTerraforming:{elevationAt:(p,base)=>terraced(p)??base}},
  terrainSlopeKind:()=>null,pointInPolygon:()=>false,
  terrainElevation:p=>terraced(p)??natural(p),placementGroundZ:()=>0,
  inBuild:()=>true,structureHeight:()=>.12,footprintPoints:()=>[],uid:()=>'x'
});
// Relief levels stand in for the natural hills.
ctx.reliefLevels=()=>[];
vm.runInContext(fn.replace('let z=0;','let z=NATURAL(p);'),Object.assign(ctx,{NATURAL:natural}));
assert.equal(ctx.terrainPlateauElevation({x:84.6,y:0}),5,'the terrace top counts at its raised height');
assert.equal(ctx.terrainPlateauElevation({x:80,y:0}),1,'the hill beside it stays H1');
vm.runInContext(crossings,ctx);
const C=ctx.window.ConquerCrossings;
const level=C.normalise({id:'a',type:'bridge',variant:'wood',a:{x:85,y:100},b:{x:99,y:100},width:1});
assert.equal(C.validate(level),null,'terrace H5 to hill H5: allowed');
assert.equal(level.groundZ,5,'the deck stands at H5');
const sloped=C.normalise({id:'b',type:'bridge',variant:'wood',a:{x:85,y:100},b:{x:92,y:100},width:1});
assert.match(C.validate(sloped)||'',/SAME elevation/,'terrace to valley floor: refused');
console.log('PASS bridges link terraces raised to the same level; no sloped bridges');
