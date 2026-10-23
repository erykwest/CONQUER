'use strict';
// Mills in 3D: each mill has an intact, a burnt (gutted) and a ruin model; the model
// follows the fire (gutted past 40% burnt, or burnt out) and the siege (a mill
// brought down stays as its own ruin, drawn with the dynamic meshes).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=__dirname+'/../src/';
const window={};
const ctx=vm.createContext({window,Math,Number,Object,Array,String});
vm.runInContext(fs.readFileSync(root+'assets/industry-models.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(root+'settlement-industries3d.js','utf8'),ctx);
const I3=window.ConquerIndustries3D,models=window.ConquerIndustryModels.models;
for(const m of ['windmill','watermill'])for(const v of ['','Burnt','Ruin'])
  assert.ok(models[m+v]?.parts?.ground,'model '+m+v+' with a ground part');
{
  const mill={id:'m',type:'windmill',x:0,y:0};
  assert.equal(I3.key(mill),'windmill');
  window.ConquerFire={state:()=>({burning:[{id:'m',fuel:.8}]})};
  assert.equal(I3.key(mill),'windmill','a fresh fire leaves it standing');
  window.ConquerFire={state:()=>({burning:[{id:'m',fuel:.5}]})};
  assert.equal(I3.key(mill),'windmillBurnt','gutted once most of it has burnt');
  window.ConquerFire={state:()=>({burning:[]})};
  assert.equal(I3.key({...mill,burnt:true}),'windmillBurnt','burnt out stays gutted');
  assert.equal(I3.key({id:'w',type:'ruin',ruinOf:'watermill'}),'watermillRuin');
  assert.equal(I3.has({id:'w',type:'ruin',ruinOf:'watermill'}),true);
  console.log('PASS mill models follow fire and ruin');
}
{
  // Sails and wheel turn about their hub (model X axis), out of the static scene;
  // the sails turn twice as fast in a wind; nothing turns when paused, burning or gutted.
  assert.deepEqual(Object.keys(models.windmill.pivots),['sails']);
  assert.deepEqual(Object.keys(models.watermill.pivots),['wheel']);
  assert.equal(models.windmillBurnt.pivots,undefined,'a gutted mill does not turn');
  assert.equal(I3.WIND_FACTOR,2);
  const src=fs.readFileSync(root+'settlement-industries3d.js','utf8');
  assert.match(src,/triangles\(s,ground,\{skip:new Set\(turning\(s\)\)\}\)/,'turning parts left out of the static scene');
  assert.match(src,/if\(!\(State\.clock\?\.speed>0\)\)return;/,'paused game: nothing turns');
  assert.match(fs.readFileSync(root+'settlement-world3d.js','utf8'),/\[window\.ConquerSiege,window\.ConquerCombat,window\.ConquerIndustries3D(,window\.\w+)*\]/,'drawn each frame in 3D');
  // Turning a sail about the hub keeps every vertex at its distance from the axis.
  ctx.State={clock:{speed:1},structures:[]};
  const turned=I3.triangles({id:'q',type:'windmill',x:0,y:0},0,{only:new Set(['sails'])});
  assert.ok(turned.pos.length>0);
  console.log('PASS sails and wheel turn about their hubs');
}
{
  const fire=fs.readFileSync(root+'settlement-fire.js','utf8'),siege=fs.readFileSync(root+'settlement-siege.js','utf8');
  assert.match(fire,/\['windmill','watermill'\]\.includes\(s\.type\)\)return s\.burnt\?\[\]:\[\{part:'whole'/,'mills burn whole until gutted');
  assert.match(siege,/windmill:110,watermill:120/,'mills can be attacked');
  assert.match(siege,/if\(isMill\(s\)\)return ruinMill\(s,from\);/,'a destroyed mill leaves its ruin');
  assert.match(siege,/if\(r\.spec\.transient\)return null;/,'the collapse heap of a mill is shown only while it falls');
  const eco=fs.readFileSync(root+'settlement-economy.js','utf8');
  assert.match(eco,/a\.abandoned\|\|s\.burnt\)continue;/,'a gutted mill grinds no more');
  console.log('PASS mills are wired to fire, siege and economy');
}
