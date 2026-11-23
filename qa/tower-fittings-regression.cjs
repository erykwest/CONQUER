'use strict';
// Tower fittings in 3D (settlement-tower-fittings.js): torch brackets at a stone tower's door,
// waving flags on pitched roofs and bartizans; the 2.5D painters stand down under World3D;
// the open palisade tower carries its brazier in its Blender model; the fire glow is not cut
// by the facade it hangs on.
const fs=require('node:fs');
const harness=fs.readFileSync(__dirname+'/urban-regression.cjs','utf8').split('let passed=0;')[0];
eval(harness+`
run(fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8'));
if(run('typeof orientedTowerOutline')!=='function')run(fs.readFileSync(__dirname+'/../src/settlement-tower-shapes.js','utf8'));
run(fs.readFileSync(__dirname+'/../src/settlement-tower-fittings.js','utf8'));
let passed=0;
function check(name,body){body();passed++;console.log('PASS '+name)}
const setup=list=>{run('State.structures').splice(0,Infinity,...list);return list};
const tower=(id,extra={})=>run('normalizeStructureVariants')({id,type:'tower',shape:'square',material:'stone',size:1.5,tier:2,level:2,roofStyle:'battlement',x:100,y:100,angle:0,functions:[],...extra});
const F=()=>run('window.ConquerTowerFittings');
const world3d=on=>run('window.ConquerWorld3D='+(on?'{active:()=>true}':'undefined'));

check('torch brackets either side of a stone tower door, under the flames',()=>{
  setup([tower('t')]);
  const specs=F().torchSpecs();
  assert.equal(specs.length,2,'two torches at the ground door');
  const m=F().torchMesh();
  assert.ok(m&&m.col.length>20&&m.pos.length===m.col.length*9,'a mesh of triangles');
  assert.ok(m.pos.every(Number.isFinite),'finite vertices');
  // Each cup tops out just under its flame.
  const zTop=Math.max(...m.pos.filter((_,i)=>i%3===2));
  assert.ok(Math.abs(zTop-(specs[0].flameZ-.035+specs[0].ground))<1e-6,'cup top under the flame');
  setup([tower('w',{material:'wood'})]);
  assert.equal(F().torchSpecs().length,0,'timber towers have no masonry door torches');
});

check('flags on pitched roofs and bartizans, waving downwind, realm colours',()=>{
  setup([tower('p',{roofStyle:'pitched'})]);
  const anchors=F().flagAnchors();
  assert.ok(anchors.length>=1,'a pitched roof flies a flag');
  const a=F().flagMesh(0),b=F().flagMesh(1.3);
  assert.ok(a&&a.col.length>=120,'staff, finial and a 10x6 cloth');
  assert.notDeepEqual(a.pos,b.pos,'the cloth waves with the time');
  const top=anchors[0].ground+anchors[0].z+F().FLAG.staff;
  assert.ok(Math.max(...a.pos.filter((_,i)=>i%3===2))<=top+.031,'nothing above the finial');
  setup([tower('b',{roofStyle:'battlement'})]);
  assert.equal(F().flagAnchors().length,0,'a crenellated top flies none');
});

check('World3D owns flags and torches: the 2.5D painters stand down',()=>{
  setup([tower('p',{roofStyle:'pitched'})]);
  world3d(true);
  assert.equal(F().ownsFlags(),true);
  assert.ok(F().dynamicMeshes().length>=1,'meshes for the World3D front pass');
  world3d(false);
  assert.equal(F().ownsFlags(),false);
  assert.equal(F().dynamicMeshes().length,0,'no meshes without World3D');
  const cs=fs.readFileSync(__dirname+'/../src/settlement-castle-structures.js','utf8');
  assert.ok(cs.includes('if(window.ConquerTowerFittings?.ownsFlags?.())return;'),'drawTowerFlags stands down');
  assert.ok(!/for\(const src of towerTorchSources\(\)\)drawTorchFixture/.test(cs),'no 2.5D tower torch painter');
  const w3=fs.readFileSync(__dirname+'/../src/settlement-world3d.js','utf8');
  assert.ok(w3.includes('window.ConquerTrebuchets,window.ConquerTowerFittings]'),'World3D collects the tower fittings');
  assert.ok(fs.readFileSync(__dirname+'/../index.html','utf8').includes('settlement-tower-fittings.js'),'loaded');
});

check('the fire glow rises with its facade (no flat cut above the flame)',()=>{
  const w3=fs.readFileSync(__dirname+'/../src/settlement-world3d.js','utf8');
  assert.ok(w3.includes('float bias=(0.25-aCorner.y)*aSize;'),'glow depth bias in the fireLight shader');
});

check('the torch glow is a procedural disc: no atlas bleeding into vertical streaks up close',()=>{
  const w3=fs.readFileSync(__dirname+'/../src/settlement-world3d.js','utf8');
  const fl=w3.slice(w3.indexOf('fireLight:['),w3.indexOf('sprite:['));
  assert.ok(fl.includes('float r=length(vCorner)*2.0;if(r>=1.0)discard;'),'halo falls off with the quad corner, nothing past its rim');
  assert.ok(!/texture\\(|uAtlas|aUV/.test(fl),'the fireLight shader samples no atlas tile');
  const build=w3.slice(w3.indexOf('function buildFireLights('),w3.indexOf('// ---------- shadows'));
  assert.ok(!build.includes('__glow'),'fire lights do not depend on the __glow atlas tile');
  assert.ok(w3.includes("map.set(k,[(x+G)/c.width,(y+G)/c.height,(x+T-G)/c.width,(y+T-G)/c.height])"),'window halo tile keeps a transparent gutter');
});

check('the open palisade tower brazier comes from its Blender model',()=>{
  const src=fs.readFileSync(__dirname+'/../src/assets/wood-fort-models.js','utf8'),w={};
  new Function('window',src)(w);
  const M=w.ConquerWoodFortModels||Object.values(w)[0];
  const keys=M.paletteKeys,ember=keys.indexOf('ember');
  assert.ok(ember>=0,'an ember colour in the palette');
  const uses=m=>Object.values(m.parts||{}).some(p=>(p.c||[]).includes(ember));
  assert.ok(uses(M.models.palisadeTower_open),'the open tower carries the brazier');
  assert.ok(!uses(M.models.palisadeTower_roofed),'the roofed one has none');
  assert.ok(fs.readFileSync(__dirname+'/../tools/blender/build_wood_fort.py','utf8').includes('brazier(top, .28, .24, deck1)'),'built in Blender at the source position');
  const c3=fs.readFileSync(__dirname+'/../src/settlement-castle3d.js','utf8');
  assert.ok(c3.includes('if(s&&isWoodTower(s))return !!window.ConquerWood3D?.handles?.(s);'),'the 2.5D block stands down where the model draws it');
});
console.log('tower fittings regression: '+passed+' checks');
`);
