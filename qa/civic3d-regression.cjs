'use strict';
// Civic buildings in 3D: the Blender-built church, tavern, market, piazza (three
// levels, three variants), annexes and cemetery are well formed, stay on the
// gameplay footprints (civicLocalParts / CIVIC_ANNEX_CATALOG), turn with the
// structure angle, sit on the ground level and whiten their roofs in winter.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=f=>fs.readFileSync(path.join(__dirname,'..','src',f),'utf8');
const core=src('settlement-core.js'),annexes=src('settlement-civic-annexes.js');
const slice=(text,from,to)=>text.slice(text.indexOf(from),text.indexOf(to,text.indexOf(from)));
const window={},State={season:'summer'};
const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,String,Float32Array});
vm.runInContext(slice(core,'const CIVIC_TYPES=','function civicParts(')+slice(annexes,'const CIVIC_ANNEX_CATALOG=','function isCivicAnnex('),ctx);
for(const f of ['assets/civic-models.js','settlement-mesh3d.js','settlement-civic3d.js'])vm.runInContext(src(f),ctx);
const M=window.ConquerCivicModels,C3=window.ConquerCivic3D;
const run=code=>vm.runInContext(code,ctx);

// Every civic level / variant and every annex has a model.
const keys=[];
for(const type of ['church','tavern','market'])for(const l of [1,2,3])keys.push(C3.modelKey({type,civicLevel:l}));
for(const v of ['paved','fountain','garden'])for(const l of [1,2,3])keys.push(C3.modelKey({type:'plaza',plazaVariant:v,civicLevel:l}));
const catalog=run('CIVIC_ANNEX_CATALOG');
for(const group of Object.values(catalog))for(const [k,spec] of Object.entries(group))if(!spec.intrinsic)keys.push(k);
keys.push('cemetery');
for(const k of keys){
  assert.ok(M.models[k],k+' has a model');
  for(const [name,p] of Object.entries(M.models[k].parts)){
    assert.equal(p.i.length,p.c.length*3,k+'.'+name+': three indices per triangle');
    assert.ok(p.i.every(i=>i>=0&&i*3<p.p.length),k+'.'+name+': indices in range');
    assert.ok(p.c.every(i=>i>=0&&i<M.palette.length),k+'.'+name+': palette colours');
  }
}
assert.equal(C3.modelKey({type:'plaza'}),'plaza_paved1','plaza defaults to paved L1');
assert.equal(C3.modelKey({type:'training'}),null,'the training field keeps its own drawing');
console.log('PASS '+keys.length+' civic models (3 levels, 3 piazza variants, annexes, cemetery)');

// Footprints: inside the union of civicLocalParts (main buildings) or the annex w x h.
const TOL=.13;
const inRect=(x,y,r)=>Math.abs(x-r.cx)<=r.w/2+TOL&&Math.abs(y-r.cy)<=r.h/2+TOL;
function check(key,rects){
  let worst=0;
  for(const p of Object.values(M.models[key].parts))for(let i=0;i<p.p.length;i+=3){
    const x=p.p[i],y=p.p[i+1];
    if(!rects.some(r=>inRect(x,y,r)))worst=Math.max(worst,Math.min(...rects.map(r=>Math.max(Math.abs(x-r.cx)-r.w/2,Math.abs(y-r.cy)-r.h/2))));
  }
  assert.ok(worst===0,key+' stays on its footprint (overhang '+worst.toFixed(2)+' U)');
}
for(const type of ['church','tavern','market','plaza'])for(const l of [1,2,3]){
  const rects=run('civicLocalParts')({type});
  if(type==='plaza')for(const v of ['paved','fountain','garden'])check('plaza_'+v+l,rects);
  else check(type+l,rects);
}
for(const group of Object.values(catalog))for(const [k,spec] of Object.entries(group))
  check(k==='cemetery'?'cemetery':k,[{cx:0,cy:0,w:spec.w,h:spec.h}]);
console.log('PASS models stay on the gameplay footprints');

// Placement: ground level, centre, angle (church tower = front at local -y).
const s={type:'church',civicLevel:2,x:100,y:50,angle:Math.PI/2};
const mesh=C3.triangles(C3.modelKey(s),s,2.5);
let minZ=Infinity;for(let i=2;i<mesh.pos.length;i+=3)minZ=Math.min(minZ,mesh.pos[i]);
assert.ok(Math.abs(minZ-2.5)<.01,'the model sits on the ground level');
const tower=Object.keys(M.models.church2.parts).indexOf('tower');
let tx=0,tn=0;for(let t=0;t<mesh.gi.length;t++)if(mesh.gi[t]===tower){tx+=mesh.pos[t*9];tn++}
assert.ok(tx/tn>100+2,'angle 90deg turns the front (local -y) towards +x');
const cem=C3.triangles('cemetery',{x:0,y:0,angle:0,scale:1.65/2.2},0);
let max=0;for(let i=0;i<cem.pos.length;i+=3)max=Math.max(max,Math.abs(cem.pos[i]),Math.abs(cem.pos[i+1]));
assert.ok(max<=1.65/2+TOL,'the cemetery scales to a smaller curtilage');
const plaza=C3.triangles('plaza_garden1',{x:0,y:0},0);
assert.equal(plaza.groupBias[Object.keys(M.models.plaza_garden1.parts).indexOf('ground')],-1e6,'ground parts paint first');
console.log('PASS placement: ground level, angle, cemetery scale, ground-first painting');

// Winter whitens roofs only.
const roofIdx=M.paletteKeys.indexOf('roofSlate'),wallIdx=M.paletteKeys.indexOf('stone');
const colours=()=>new Set(C3.triangles('church2',{x:0,y:0},0).col);
const summer=colours();State.season='winter';const winter=colours();State.season='summer';
assert.ok(summer.has(M.palette[roofIdx])&&!winter.has(M.palette[roofIdx]),'slate roofs turn white in winter');
assert.ok(winter.has('#e7ece8')&&winter.has(M.palette[wallIdx]),'walls keep their colour');
console.log('PASS winter roofs');
