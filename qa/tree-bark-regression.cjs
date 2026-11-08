'use strict';
// Dark woody material must stay consistent in the authored assets and both renderers.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const DARK='#2B1D16';
const treeNames=['01_tonda','02_affusolata','03_conica','04_ombrello','05_goccia','06_stratificata','07_asimmetrica'];
const bushNames=['01_tondo','02_globulare','03_stratificato_globulare','04_largo','05_asimmetrico','06_multilobato','07_spinoso'];
const trees=treeNames.map(n=>read('src/assets/forest/tree_'+n+'.svg'));
const bushes=bushNames.map(n=>read('src/assets/bushes/bush_'+n+'.svg'));
for(const [kind,sources] of [['tree',trees],['bush',bushes]])for(const source of sources){
  assert.match(source,/fill="#3B5174"/i,kind+' canopy must keep its seasonal placeholder');
  assert.doesNotMatch(source,/#9BBACE|#73604a|#a07560/i,kind+' has no old light trunks');
  const barkCount=(source.match(/fill="#2B1D16"/gi)||[]).length;
  assert.ok(barkCount>=(kind==='tree'?1:2),kind+' has all woody paths coloured dark');
}
const landscape=read('src/settlement-landscape.js');
const boundaries=read('src/settlement-boundaries.js');
const world3d=read('src/settlement-world3d.js');
const html=read('index.html');
new vm.Script(landscape);new vm.Script(boundaries);
const extract=(source,a,b,name)=>{
  const i=source.indexOf(a),j=source.indexOf(b,i);
  assert.ok(i>=0&&j>i,'missing '+name);
  return new Function(source.slice(i,j)+';return '+name+';')();
};
const treeSvg=extract(landscape,'function buildForestSvg(','async function loadForestTreeSprites(','buildForestSvg');
const bushSvg=extract(boundaries,'function buildBoundaryBushSvg(','async function loadBoundaryBushSprites(','buildBoundaryBushSvg');
for(const season of ['summer','autumn','winter']){
  const bush=bushSvg(bushes[0],season);
  assert.match(bush,/fill="#2B1D16"/i,season+' bushes keep dark branches');
  assert.doesNotMatch(bush,/#9BBACE|#73604a/i,season+' bushes do not remap woody colour');
}
for(const season of ['summer','autumn']){
  const canopy=season==='summer'?'#49783b':'#df8a32';
  const tree=treeSvg(trees[0],canopy,true);
  assert.ok(tree.includes('fill="'+canopy+'"'),'canopy palette remains dynamic');
  assert.match(tree,/fill="#2B1D16"/i,'tree bark remains dark');
}
const winterTree=treeSvg(trees[0],null,false);
assert.match(winterTree,/fill="#2B1D16"/i,'winter bare trunks remain dark');
assert.match(winterTree,/fill-opacity="0"/,'winter canopy stays invisible');
assert.match(landscape,/trunk='#2B1D16'/,'mountain pines use same dark bark');
assert.match(landscape,/fetch\(path\+'\?v=bark1'\)/,'forest SVG loads are cache-busted');
assert.match(boundaries,/name\+'\?v=bark1'/,'hedge SVG loads are cache-busted');
assert.match(html,/settlement-landscape\.js\?v=[^"]+-bark1/,'landscape renderer is cache-busted');
assert.match(html,/settlement-boundaries\.js\?v=bark1/,'hedge renderer is cache-busted');
assert.match(world3d,/add\(forestTreeSprites\.summer\)/,'WebGL2 shares tree sprites');
assert.match(world3d,/boundaryBushSprites/,'WebGL2 shares bush sprites');
console.log('PASS: 14 SVGs, pine bark, 3-season bushes, winter and shared Canvas/WebGL2 sprites');
