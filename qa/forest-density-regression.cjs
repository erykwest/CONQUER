'use strict';
// Forest distribution regression: no per-patch min/max, stable grid density
// and exactly one collision-safe bush inside each surviving tree cell.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const landscape=fs.readFileSync(path.join(root,'src/settlement-landscape.js'),'utf8');
const world3d=fs.readFileSync(path.join(root,'src/settlement-world3d.js'),'utf8');
const world=fs.readFileSync(path.join(root,'src/settlement-world.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const source of [landscape,world3d])new vm.Script(source);
function between(src,a,b){
  const i=src.indexOf(a),j=src.indexOf(b,i);
  assert.ok(i>=0&&j>i,'missing forest source boundary '+a);
  return src.slice(i,j);
}
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
function inside(p,poly){
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x)hit=!hit;
  }
  return hit;
}
const State={seed:379};
const biomeHash=str=>{
  let h=2166136261;
  for(const c of String(str)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
};
const context=vm.createContext({
  State,WORLD:200,Math,Map,seedRand:null,biomeHash,
  FOREST_TREE_ASSETS:Array(7),FOREST_CANOPY_PALETTES:{summer:Array(5)},
  BOUNDARY_BUSH_ASSETS:Array(7),terrainElevation:()=>0,
  ensureLandscapeRenderCaches:()=>{},
  environmentPolygonBounds:pts=>({
    minX:Math.min(...pts.map(p=>p.x)),maxX:Math.max(...pts.map(p=>p.x)),
    minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y))
  }),
  environmentContains:(f,p)=>inside(p,f.points)&&!(f.holes||[]).some(h=>inside(p,h))
});
vm.runInContext(between(landscape,'function seedRand(seed)','function mixWorld('),context);
vm.runInContext('const forestTreeLayoutCache=new Map(),forestBushLayoutCache=new Map();\n'
  +between(landscape,'const FOREST_TREE_SPACING=','function forestLikelyVisible('),context);
const evaluate=script=>vm.runInContext(script,context);
const grove=(id,size)=>({id,type:'forest',points:rect(30,30,size,size)});
const read=f=>{
  context.f=f;
  const trees=evaluate('forestTreeLayout(f)'),bushes=evaluate('forestBushLayout(f)');
  return{trees:JSON.parse(JSON.stringify(trees)),bushes:JSON.parse(JSON.stringify(bushes))};
};
for(const size of [12,20,36,60]){
  const f=grove('grove-'+size,size),{trees,bushes}=read(f);
  const expected=size*size/(2.9*2.9),ratio=trees.length/expected;
  assert.ok(ratio>.74&&ratio<1.26,'uniform spatial density at '+size+' units: '+trees.length);
  assert.equal(bushes.length,trees.length,'exactly one bush per tree');
  assert.ok(trees.every(t=>inside(t.p,f.points)),'trees remain inside the real polygon');
  assert.ok(bushes.every(b=>inside(b.p,f.points)),'bushes remain in woodland');
  assert.ok(trees.every(t=>t.shapeIndex>=0&&t.shapeIndex<7),'existing seven tree shapes');
  assert.ok(bushes.every(b=>b.shape>=0&&b.shape<7),'existing seven bush shapes');
}
const large=read(grove('large-no-cap',60));
assert.ok(large.trees.length>120,'large woods are no longer capped at 120');
const repeat=read(grove('large-no-cap',60));
assert.deepEqual(repeat,large,'deterministic across reads');
const f=grove('persistent',40),before=read(f);
f.holes=[rect(48,48,12,12)];
evaluate('clearForestLayoutCache()');
const after=read(f);
assert.ok(after.trees.length<before.trees.length,'a clearing removes trees');
assert.ok(after.trees.every(t=>!inside(t.p,f.holes[0])),'grooves keep tree-free interiors');
assert.ok(after.bushes.every(b=>!inside(b.p,f.holes[0])),'grooves keep bush-free interiors');
const key=t=>t.cellX+':'+t.cellY;
const oldTree=new Map(before.trees.map(t=>[key(t),t]));
const oldBush=new Map(before.trees.map((t,i)=>[key(t),before.bushes[i]]));
for(let i=0;i<after.trees.length;i++){
  assert.deepEqual(after.trees[i],oldTree.get(key(after.trees[i])),'remaining trees do not reshuffle');
  const previousBush=oldBush.get(key(after.trees[i]));
  if(!inside(previousBush.p,f.holes[0]))assert.deepEqual(after.bushes[i],previousBush,'unaffected bushes do not reshuffle');
}
const continuous={id:'continuous',type:'forest',continuous:true,points:rect(0,0,200,200),holes:[rect(65,65,75,75)]};
evaluate('clearForestLayoutCache()');
const continuousLayout=read(continuous);
assert.equal(continuousLayout.bushes.length,continuousLayout.trees.length,'whole-map forest also has 1:1 understory');
assert.ok(continuousLayout.trees.every(t=>!inside(t.p,continuous.holes[0])),'continuous forest respects glades');
assert.ok(continuousLayout.trees.length>2500,'continuous woodland follows identical spatial density');
// Fast placement lookup must agree with the full layout, without causing a
// cold whole-forest materialisation on the first placement check.
evaluate('clearForestLayoutCache()');
context.f=continuous;
context.box={minX:80,maxX:93,minY:130,maxY:142};
const nearby=JSON.parse(JSON.stringify(evaluate('forestTreesInBounds(f,box,1)')));
assert.equal(evaluate('forestTreeLayoutCache.size'),0,'placement query is lazy, no full scan');
const full=JSON.parse(JSON.stringify(evaluate('forestTreeLayout(f)')));
const region=t=>t.p.x>=79&&t.p.x<=94&&t.p.y>=129&&t.p.y<=143;
assert.deepEqual(nearby,full.filter(region),'spatial lookup sees precisely the drawn trees');
const placement=fs.readFileSync(path.join(root,'src/settlement-placement.js'),'utf8');
assert.match(placement,/forestTreesInBounds\(f,b,pad\)/,'building placement uses local canopy query');
assert.match(landscape,/items\.sort\(/,'Canvas depth sorts trees and bushes together');
assert.match(world3d,/for\(const f of forests\)for\(const bush of forestBushLayout\(f\)\)/,'WebGL2 includes understory');
assert.match(world3d,/atlas\.map\.get\('bush:'\+bush\.shape\)/,'WebGL2 reuses existing bush atlas');
assert.doesNotMatch(landscape,/forestMax:120|forestMin:14/,'no old density caps');
assert.match(index,/settlement-landscape\.js\?v=[^"]+-forest2/);
assert.match(index,/settlement-world3d\.js\?v=[^"]+-forest2/);
assert.match(world,/function makeOrganicForestBlob/,'forest outline stays unchanged');
console.log('PASS: uniform forest density, no caps, 1:1 understory, glades and stable Canvas/WebGL2 rendering');
