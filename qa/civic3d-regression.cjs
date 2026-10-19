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
for(const group of Object.values(catalog))for(const [k,spec] of Object.entries(group))if(!spec.intrinsic&&spec.kind!=='plaza')keys.push(k);
for(const k of Object.keys(M.models))if(k.startsWith('prop_'))keys.push(k);
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
console.log('PASS '+keys.length+' civic models (3 levels, 3 piazza variants, annexes, lot props)');

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
  if(!spec.intrinsic&&spec.kind!=='plaza')check(k,[{cx:0,cy:0,w:spec.w,h:spec.h}]);
State.structures=[{id:'c',type:'church',civicLevel:2}];
assert.equal(C3.modelKey({type:'civicAnnex',annexType:'square',parentId:'c',plazaVariant:'garden'}),'plaza_garden2','the church square is a piazza at the church level');
{const sq=C3.triangles('plaza_paved1',{x:0,y:0,angle:0,scale:.8},0);let m=0;for(let i=0;i<sq.pos.length;i+=3)m=Math.max(m,Math.abs(sq.pos[i]),Math.abs(sq.pos[i+1]));
 assert.ok(m<=catalog.church.square.w/2+TOL,'the church square fits its 4 U annex');}
console.log('PASS models stay on the gameplay footprints');

// Placement: ground level, centre, angle (church tower = front at local -y).
const s={type:'church',civicLevel:2,x:100,y:50,angle:Math.PI/2};
const mesh=C3.triangles(C3.modelKey(s),s,2.5);
let minZ=Infinity;for(let i=2;i<mesh.pos.length;i+=3)minZ=Math.min(minZ,mesh.pos[i]);
assert.ok(Math.abs(minZ-2.5)<.01,'the model sits on the ground level');
const tower=Object.keys(M.models.church2.parts).indexOf('tower');
let tx=0,tn=0;for(let t=0;t<mesh.gi.length;t++)if(mesh.gi[t]===tower){tx+=mesh.pos[t*9];tn++}
assert.ok(tx/tn>100+2,'angle 90deg turns the front (local -y) towards +x');
const plaza=C3.triangles('plaza_garden1',{x:0,y:0},0);
assert.equal(plaza.groupBias[Object.keys(M.models.plaza_garden1.parts).indexOf('ground')],-1e6,'ground parts paint first');
console.log('PASS placement: ground level, angle, ground-first painting');

// Winter whitens roofs only.
const roofIdx=M.paletteKeys.indexOf('roofSlate'),wallIdx=M.paletteKeys.indexOf('stone');
const colours=()=>new Set(C3.triangles('church2',{x:0,y:0},0).col);
const summer=colours();State.season='winter';const winter=colours();State.season='summer';
assert.ok(summer.has(M.palette[roofIdx])&&!winter.has(M.palette[roofIdx]),'slate roofs turn white in winter');
assert.ok(winter.has('#e7ece8')&&winter.has(M.palette[wallIdx]),'walls keep their colour');
console.log('PASS winter roofs');

// Lot props: the churchyard and the inn tables fill the civic Voronoi lot, organically.
Object.assign(ctx,{
  rectWorldPoints:(cx,cy,w,h,a=0)=>{const c=Math.cos(a),s=Math.sin(a);return[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>({x:cx+x*c-y*s,y:cy+x*s+y*c}))},
  houseLocalToWorld:(s,x,y)=>{const c=Math.cos(s.angle||0),n=Math.sin(s.angle||0);return{x:s.x+x*c-y*n,y:s.y+x*n+y*c}},
  terrainElevation:()=>0,underConstruction:()=>false,
  roadList:()=>[{a:{x:80,y:42},b:{x:120,y:42},width:.5}],
  civicEntranceInfo:s=>({outside:ctx.houseLocalToWorld(s,0,-3.9)}),
  civicAnnexFootprint:()=>[]
});
vm.runInContext(slice(core,'function civicParts(','function civicRadius('),ctx);
const LOT=[{x:88,y:42.5},{x:113,y:42.5},{x:116,y:58},{x:100,y:66},{x:85,y:57}];
ctx.urbanLots=()=>[{civicId:'ch',points:LOT},{civicId:'tv',points:LOT}];
const inside=(p,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c};
const counts=[];
for(const level of [1,2,3]){
  State.structures=[{id:'ch',type:'church',x:100,y:52,angle:0,civicLevel:level}];
  const props=C3.lotProps(State.structures[0]);
  const graves=props.filter(p=>p.asset.startsWith('grave'));counts.push(graves.length);
  assert.ok(props.every(p=>inside(p,LOT)),'L'+level+' churchyard stays in the lot');
  for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++)
    assert.ok(Math.hypot(props[i].x-props[j].x,props[i].y-props[j].y)>=props[i].r+props[j].r,'props never overlap');
  const body=run('civicParts')(State.structures[0]).map(p=>p.points);
  if(level>1)assert.ok(props.every(p=>!body.some(b=>inside(p,b))),'no grave on the church');
  assert.ok(props.some(p=>p.asset.startsWith('cypress')),'cypresses along the lot');
  const headings=new Set(graves.map(p=>p.heading.toFixed(3)));
  assert.ok(headings.size>graves.length*.6,'graves are not set on a rigid grid');
  assert.deepEqual(JSON.stringify(C3.lotProps({...State.structures[0]})),JSON.stringify(props),'placement is deterministic');
  const door={x:100,y:52-3.9};
  assert.ok(props.every(p=>Math.hypot(p.x-door.x,p.y-door.y)>1.6),'the church door stays clear');
}
assert.ok(counts[0]>=20&&counts[0]<counts[1]&&counts[1]<counts[2],'the churchyard grows with the level: '+counts.join(' < '));
console.log('PASS churchyard fills the lot organically ('+counts.join(' / ')+' graves)');
for(const level of [1,2]){
  State.structures=[{id:'tv',type:'tavern',x:100,y:52,angle:0,civicLevel:level}];
  const props=C3.lotProps(State.structures[0]);
  assert.ok(props.filter(p=>p.asset.startsWith('table')).length>=4,'L'+level+' inn has tables outside');
  assert.ok(props.every(p=>inside(p,LOT)),'tables stay in the lot');
}
console.log('PASS inn tables in the lot');
