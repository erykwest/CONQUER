'use strict';
// Tower weapons (upgrade): a mangonel or a ballista on the deck of a medium (T2)
// stone tower without a pitched roof, at any height; drawn in the 3D world on the
// deck (structureHeight above the ground), facing out of the castle, without wheels.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const core=fs.readFileSync(root+'settlement-core.js','utf8').replace(/\r\n/g,'\n');
const pick=(re,name)=>{const m=core.match(re)?.[0];assert.ok(m,'use the actual '+name);return m};
const src=[
  pick(/const STRUCTURE_VARIANT_VERSION=[\s\S]*?\n\}\);\nconst STRUCTURE_VARIANT_DEFAULTS=[\s\S]*?\n\}\);/,'variant tables'),
  pick(/function variantSchema[\s\S]*?\nfunction setStructureVariant[\s\S]*?\n\}/,'variant helpers'),
  pick(/function towerRoofStyle\(s\)\{[^\n]*\}/,'towerRoofStyle'),
  pick(/function towerTopWeaponAllowed\(s\)\{[^\n]*\}/,'towerTopWeaponAllowed'),
  pick(/function towerTopWeapon\(s\)\{[^\n]*\}/,'towerTopWeapon'),
  pick(/function isWoodTower\(s\)\{[^\n]*\}/,'isWoodTower'),
  pick(/function towerTier\(s\)\{[^\n]*\}/,'towerTier')
].join('\n');
const window={},State={structures:[]};
const ctx=vm.createContext({window,State,console,Math,Number,Object,Array,Map,Float32Array,String,
  underConstruction:()=>false,placementGroundZ:()=>.5,terrainElevation:()=>0,
  structureHeight:s=>[2.35,3.55,4.75][(s.level||1)-1],structureCenter:s=>({x:s.x,y:s.y}),
  structureInteriorVector:()=>({x:-1,y:0}),drawCastleSoldiers:()=>{}});
vm.runInContext(src+'\nObject.assign(window,{towerTopWeapon,towerTopWeaponAllowed,setStructureVariant,normalizeStructureVariants});',ctx);
for(const f of ['assets/siege-engines-model.js','settlement-siege-engines3d.js','settlement-tower-weapons.js'])
  vm.runInContext(fs.readFileSync(root+f,'utf8'),ctx);
const W=window;
const tower=(o={})=>W.normalizeStructureVariants({type:'tower',shape:'square',material:'stone',size:1.5,level:1,x:10,y:20,...o});

{
  const t=tower();
  assert.equal(t.topWeapon,'none','towers start without a weapon');
  assert.ok(W.setStructureVariant(t,'topWeapon','mangonel'),'a mangonel can be mounted');
  assert.equal(W.towerTopWeapon(t),'mangonel');
  assert.ok(!W.setStructureVariant(t,'topWeapon','trebuchet'),'only mangonel or ballista');
  for(const level of [1,2,3])assert.equal(W.towerTopWeapon(tower({level,topWeapon:'ballista'})),'ballista','any height');
  assert.equal(W.towerTopWeapon(tower({roofStyle:'machicolation',topWeapon:'ballista'})),'ballista','machicolation has an open deck');
  assert.equal(W.towerTopWeapon(tower({roofStyle:'pitched',topWeapon:'ballista'})),'none','not under a pitched roof');
  assert.equal(W.towerTopWeapon(tower({size:1,topWeapon:'ballista'})),'none','not on small (T1) towers');
  assert.equal(W.towerTopWeapon(tower({size:2,topWeapon:'ballista'})),'none','not on large (T3) towers');
  assert.equal(W.towerTopWeapon(tower({material:'wood',topWeapon:'ballista'})),'none','not on wooden towers');
  assert.equal(W.towerTopWeapon(tower({shape:'round',r:.75,topWeapon:'mangonel'})),'mangonel','round T2 towers too');
  console.log('PASS mangonel or ballista on roofless T2 stone towers of any height');
}
{
  State.structures=[tower({level:2,topWeapon:'mangonel'}),tower({level:1,roofStyle:'pitched',topWeapon:'ballista'})];
  const m=W.ConquerTowerWeapons.mounts();
  assert.equal(m.length,1,'only the eligible tower is armed');
  assert.equal(m[0].engine,'catapult');
  assert.equal(m[0].place.z,.5+3.55,'it stands on the deck');
  assert.ok(Math.abs(m[0].place.heading)<1e-9,'facing out of the castle (away from the interior)');
  assert.ok(Math.hypot(m[0].place.x-10,m[0].place.y-20)<.3,'centred on the deck');
  const SE=W.ConquerSiegeEngines3D,on=SE.triangles('catapult',m[0].place,{mode:'idle',mounted:true}),off=SE.triangles('catapult',m[0].place,{mode:'idle'});
  assert.ok(on.col.length<off.col.length,'mounted on a tower, the mangonel has no wheels');
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(let i=0;i<on.pos.length;i+=3){x0=Math.min(x0,on.pos[i]);x1=Math.max(x1,on.pos[i]);y0=Math.min(y0,on.pos[i+1]);y1=Math.max(y1,on.pos[i+1])}
  assert.ok(x1-x0<1.5&&y1-y0<1.5,'it fits the 1.5 U deck');
  console.log('PASS mounted on the deck, facing out, without wheels, within the tower');
}
