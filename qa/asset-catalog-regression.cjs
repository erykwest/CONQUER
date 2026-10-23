'use strict';
// Catalog coverage regression: repository art manifest, native model families and UI contracts.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('figures-lab.html'),source=read('src/asset-catalog.js');
for(const id of ['assetCategoryFilters','assetGallery','assetSearch','assetFamily','assetFormat',
  'assetDetail','assetDetailPreview','assetDetailSource','assetCount','assetReset']){
  assert(html.includes('id="'+id+'"'),'Missing catalog UI '+id);
}
assert(html.includes('./src/asset-catalog.js'), 'Lab must load catalog');
assert(html.includes('./src/settlement-mesh3d.js'), 'Lab must use native game renderer');
assert(html.includes('window.ConquerLab={step:'), 'Existing figure animation test hooks must remain');
const match=source.match(/const STATIC_FILES=(\[[^\n]+\]);/);
assert(match,'Static asset manifest missing');
const manifest=JSON.parse(match[1]);
assert(manifest.length>=30,'Unexpectedly incomplete static manifest');
const live=[];
function walk(directory){
  for(const entry of fs.readdirSync(path.join(base,directory),{withFileTypes:true})){
    const relative=path.posix.join(directory,entry.name);
    if(entry.isDirectory()){
      if(relative.endsWith('_rotations'))continue; // derived orientation frames, not distinct logical assets
      walk(relative);
    }else if(/\.(png|svg)$/i.test(entry.name))live.push(relative);
  }
}
walk('src/assets');
assert.deepEqual(manifest.slice().sort(),live.sort(),'Every authored PNG/SVG must be listed');
for(const name of ['ConquerCivicModels','ConquerIndustryModels','ConquerScatterModel',
  'ConquerWagonModel','ConquerSiegeModel','ConquerAnimalModels']){
  assert(source.includes(name),'Missing native model registry '+name);
}
for(const category of ['Componenti','Edifici','Produzione','Popolazione','Truppe',
  'Fauna','Veicoli','Assedio','Natura','Scatter','Interni','Araldica','Territorio']){
  assert(source.includes("'"+category+"'"),'Missing navigable category '+category);
}
for(const primitive of ['well','house1','house4','field','road','forest']){
  assert(source.includes("['"+primitive+"'"),'Missing schematic game primitive '+primitive);
}
assert(!source.includes("'Fortificazioni'"),'Fortification subparts must not masquerade as complete fortifications');
assert(!source.includes("['tower-square'"),'Fake complete castle schematic must not be listed');
assert(source.includes("'/architecture/'")&&source.includes("'Componenti'"),'Real architecture sprites must remain discoverable as components');
for(const id of ['assetRotateLeft','assetRotateRight','assetRotationControls','assetRotationValue'])assert(html.includes('id="'+id+'"'),'Missing 3D inspector rotation control '+id);
assert(source.includes('rotateSelection(-15)')&&source.includes('rotateSelection(15)'), 'Rotation step must be 15 degrees');
assert(html.includes('rotate3d:delta'), 'Live native 3D previews must rotate too');
for(const expression of ['IntersectionObserver','aria-selected','aria-pressed','assetFamily',
  'assetFormat','toLocaleLowerCase','renderModel','renderSchema','selectItem']){
  assert(source.includes(expression),'Missing filtering / accessibility / rendering contract '+expression);
}
assert(source.includes("SCHEMA"),'Parametric diagrams must be explicitly labelled');
console.log('Asset Lab regression PASS: '+manifest.length+' static files, all registries and UI contracts.');
