'use strict';
// World 3D still uses the architectural sprites, edge spans and compact-tower sizing.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src/settlement-architecture.js'),'utf8');
const requested=[];
class Image {
  constructor(){this.width=64;this.height=128}
  set src(value){requested.push(value);this.onload()}
}
const context=vm.createContext({Image,console,
  structureLevel:s=>s.level||1,towerTier:s=>s.tier||1,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n))});
vm.runInContext(src,context);
const get=(type,level,tier)=>context.gothicAssetSizeForLevel({type,level,tier});
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);
const towerSizes={
  1:[[.3024,.392],[.4104,.532],[.5076,.658]],
  2:[[.3808,.4368],[.5168,.5928],[.6392,.7332]]
};
for(const level of [1,2,3,4]){
  for(const type of ['gate','built']){
    const out=get(type,level,3);
    close(out.w,level===1?.54:.68);close(out.h,level===1?.70:.78);
  }
  for(const tier of [1,2,3]){
    const out=get('tower',level,tier),expected=towerSizes[level===1?1:2][tier-1];
    close(out.w,expected[0]);close(out.h,expected[1]);
  }
}
for(const [tier,expectedTier] of [[0,1],[4,3]]){
  const out=get('tower',2,tier),expected=towerSizes[2][expectedTier-1];
  close(out.w,expected[0]);close(out.h,expected[1]);
}
// The loader still feeds the PNGs consumed by World 3D and gate fittings.
assert.equal(requested.length,9);
assert.ok(requested.every(p=>p.startsWith('./src/assets/architecture/')&&p.endsWith('?v=prepared-1')));
assert.ok(context.architectureSprite('gatePortal') instanceof Image);
assert.ok(context.architectureSprite('gothicL2') instanceof Image);
assert.equal(context.architectureSprite('missing'),null);
// Facade positioning remains independent from its retired Canvas painter.
const span=context.facadeAssetWorldSpan({a:{x:0,y:0},b:{x:10,y:0}},2,1);
assert.deepEqual({...span.a},{x:5,y:0});assert.deepEqual({...span.b},{x:7,y:0});
const turned=context.facadeAssetWorldSpan({a:{x:4,y:8},b:{x:4,y:0}},2,-1);
assert.deepEqual({...turned.a},{x:4,y:6});assert.deepEqual({...turned.b},{x:4,y:4});
console.log('PASS architectural sprites, World 3D edge spans and compact gothic sizes across levels and tiers');
