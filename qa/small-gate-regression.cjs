'use strict';
// Small stone gate (1×1U, L1-L2): size predicate, level cap, height just above the curtain,
// cost against the gatehouse, portal and banners scaled to its narrower front.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const read=f=>fs.readFileSync(root+f,'utf8').replace(/\r\n/g,'\n');
const core=read('settlement-core.js'),castle=read('settlement-castle.js'),fittings=read('settlement-gate-fittings.js');
const pick=(src,re,name)=>{const m=src.match(re)?.[0];assert.ok(m,'use the actual '+name);return m};
const ctx=vm.createContext({Math,Number,Object,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),isWoodGate:s=>s?.type==='gate'&&s.material==='wood',
  rectDims:s=>({w:s.size,h:s.size}),window:{},roundCost:c=>c,
  scaleCost:(x,f=1)=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v*f])),
  COSTS:{gate:{gold:95,stone:90,wood:38,metal:10},woodGate:{gold:35}}});
vm.runInContext([
  pick(core,/const GATE_SIZES=[\s\S]*?\nfunction structureLevel\(s\)\{[\s\S]*?\n\}/,'gate sizes and structureLevel'),
  pick(core,/function levelCostFactor\(s\)\{[\s\S]*?\n\}/,'levelCostFactor'),
  'function constructionCost(s){'+pick(core,/  if\(s\.type==='gate'\)return isWoodGate\(s\)[^\n]*/,'gate cost')+'}',
  'function structureHeight(s){'+pick(castle,/  if\(s\.type==='gate'\)return isWoodGate\(s\)[^\n]*/,'gate height')+'}',
  pick(fittings,/  const PORTAL=[^\n]*/,'PORTAL'),
  pick(fittings,/  function portalOf\(s\)\{[\s\S]*?\n  \}/,'portalOf'),
  pick(fittings,/  const BANNER=[^\n]*/,'BANNER'),
  pick(fittings,/  function bannerOf\(s\)\{[\s\S]*?\n  \}/,'bannerOf'),
  'Object.assign(this,{isSmallGate,structureLevel,constructionCost,structureHeight,portalOf,bannerOf});'
].join('\n'),ctx);
const gate=(size,level)=>({type:'gate',material:'stone',size,level});
{
  assert.ok(ctx.isSmallGate(gate(1,1))&&!ctx.isSmallGate(gate(1.5,1)),'size 1 is the small gate');
  assert.ok(!ctx.isSmallGate({type:'gate',material:'wood',size:1}),'wood gates are never small stone gates');
  assert.deepEqual([1,2,3].map(l=>ctx.structureLevel(gate(1,l))),[1,2,2],'small gate: L1-L2 only');
  assert.deepEqual([1,2,3].map(l=>ctx.structureLevel(gate(1.5,l))),[1,2,3],'gatehouse keeps L1-L3');
  console.log('PASS small gate size and level cap');
}
{
  const h=[1,2].map(l=>ctx.structureHeight(gate(1,l)));
  assert.ok(h[0]>2.1&&h[0]<2.8,'L1 stands above an H2 curtain, below the gatehouse');
  assert.ok(h[1]<ctx.structureHeight(gate(1.5,2)),'L2 lower than the gatehouse L2');
  const big=ctx.constructionCost(gate(1.5,2)),small=ctx.constructionCost(gate(1,2));
  for(const k of Object.keys(big))assert.ok(Math.abs(small[k]-big[k]*.6)<1e-9,'small gate costs 0.6 of the gatehouse ('+k+')');
  console.log('PASS small gate height and cost');
}
{
  const big=ctx.portalOf(gate(1.5,1)),small=ctx.portalOf(gate(1,1));
  assert.equal(big.width,1.2,'gatehouse portal unchanged');
  assert.ok(small.width<=.9+1e-9&&small.width<big.width,'small portal fits its 1U front');
  for(const l of [1,2]){
    const b=ctx.bannerOf(gate(1,l));
    assert.ok(b.across+b.width/2<=.5,'banners stay on the 1U front');
    assert.ok(b.top<=ctx.structureHeight(gate(1,l))-.15+1e-9&&b.height>0,'banners below the crest');
  }
  const B=ctx.bannerOf(gate(1.5,2));
  assert.deepEqual([B.across,B.width,B.top,B.height],[.62,.235,2.06,.96],'gatehouse banners unchanged');
  console.log('PASS small gate portal and banners');
}
