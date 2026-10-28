'use strict';
// Catalog coverage regression: generated art manifest, native model families, engine sandbox and UI contracts.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('figures-lab.html'),source=read('src/asset-catalog.js');
for(const id of ['assetCategoryFilters','assetGallery','assetSearch','assetFamily','assetFormat',
  'assetDetail','assetDetailPreview','assetDetailSource','assetCount','assetReset','assetEngineStatus']){
  assert(html.includes('id="'+id+'"'),'Missing catalog UI '+id);
}
assert(html.includes('./src/asset-catalog.js'), 'Lab must load catalog');
assert(html.indexOf('./src/asset-manifest.js')>0&&html.indexOf('./src/asset-manifest.js')<html.indexOf('./src/asset-catalog.js'),
  'Generated manifest must load before the catalog');
assert(html.includes('./src/settlement-mesh3d.js'), 'Lab must use native game renderer');
assert(html.includes('window.ConquerLab={step:'), 'Existing figure animation test hooks must remain');

// Generated manifest: up to date and complete, no hand-written file list left in the catalog.
execFileSync(process.execPath,[path.join(base,'tools/build-asset-manifest.cjs'),'--check'],{stdio:'inherit'});
assert(!/const STATIC_FILES=\[/.test(source),'Static files must come from the generated manifest');
assert(source.includes('window.CONQUER_ASSET_FILES')&&source.includes('window.CONQUER_ASSET_ROTATIONS'));
const sandbox={window:{}};vm.runInNewContext(read('src/asset-manifest.js'),sandbox);
// JSON round trip: arrays from another vm realm fail deepStrictEqual on their prototype.
const manifest=JSON.parse(JSON.stringify(sandbox.window.CONQUER_ASSET_FILES)),rotations=JSON.parse(JSON.stringify(sandbox.window.CONQUER_ASSET_ROTATIONS));
const live=[],liveSets={};
(function walk(directory){
  for(const entry of fs.readdirSync(path.join(base,directory),{withFileTypes:true})){
    const relative=path.posix.join(directory,entry.name);
    if(entry.isDirectory()){
      if(relative.endsWith('_rotations')){liveSets[relative]=fs.readdirSync(path.join(base,relative)).filter(n=>/\.(png|svg)$/i.test(n)).length;continue}
      walk(relative);
    }else if(/\.(png|svg)$/i.test(entry.name))live.push(relative);
  }
})('src/assets');
assert.deepEqual(manifest.slice().sort(),live.sort(),'Every authored PNG/SVG must be listed');
assert.deepEqual(Object.fromEntries(Object.entries(rotations).map(([k,v])=>[k,v.length])),liveSets,'Every rotation set must be listed');
for(const [dir,frames] of Object.entries(rotations)){
  assert(frames.every((f,i)=>f.deg===i*15),dir+' frames must be one every 15 degrees');
}

for(const name of ['ConquerCivicModels','ConquerIndustryModels','ConquerScatterModel',
  'ConquerWagonModel','ConquerSiegeModel','ConquerAnimalModels']){
  assert(source.includes(name),'Missing native model registry '+name);
}
for(const category of ['Componenti','Edifici','Fortificazioni','Produzione','Popolazione','Truppe',
  'Fauna','Veicoli','Assedio','Natura','Scatter','Interni','Araldica','Territorio']){
  assert(source.includes("'"+category+"'"),'Missing navigable category '+category);
}
for(const primitive of ['well','house1','house4','field','road','forest']){
  assert(source.includes("['"+primitive+"'"),'Missing schematic game primitive '+primitive);
}
// Fortifications are the game's own meshes, never schematics.
assert(!source.includes("['tower-square'")&&!/\['(wall|gate|palisade|moat)','/.test(source),'Fake castle schematics must not be listed');
assert(source.includes('index.html?assetlab=1')&&source.includes('ConquerSiegePreview.assetMesh'),'Fortifications must come from the engine sandbox');
const preview=read('src/settlement-siege-preview.js');
assert(/function assetMesh\(spec\)/.test(preview)&&preview.includes('ConquerCastle3D.worldMeshes()'),'assetMesh must mesh with ConquerCastle3D');
assert(/window\.ConquerSiegePreview=\{[^}]*GALLERY,galleryStructure,[^}]*assetMesh/.test(preview),'Gallery variants must be exported for the Lab');
// The sandbox never touches the player's save, the cloud or telemetry.
const index=read('index.html'),persistence=read('src/settlement-app-persistence.js'),core=read('src/settlement-core.js');
assert(index.includes("window.__CONQUER_ASSET_LAB__ = new URLSearchParams(location.search).get('assetlab') === '1'"));
assert(/function saveLocal\(\)\{\n  if\(window\.__CONQUER_ASSET_LAB__\)return;/.test(persistence),'Sandbox must not save locally');
assert(/if\(window\.__CONQUER_ASSET_LAB__\)return 'conquer\.assetlab\.sandbox'/.test(persistence),'Sandbox must read its own empty slot');
assert(/async function initSupabase\(\)\{if\(window\.__CONQUER_ASSET_LAB__\)return;/.test(persistence),'Sandbox must not sign in to the cloud');
assert(/if\(window\.__CONQUER_ASSET_LAB__\|\|!sample/.test(core),'Sandbox must not send telemetry');

// Work animations: one entry per tool of settlement-work-anim.js.
const workTools=[...read('src/settlement-work-anim.js').matchAll(/^    (\w+):\{period:/gm)].map(m=>m[1]);
assert(workTools.length>=7,'Work tools not found');
for(const tool of workTools)assert(source.includes(",'"+tool+"','"),'Missing work animation '+tool);

assert(source.includes("'/architecture/'")&&source.includes("'Componenti'"),'Real architecture sprites must remain discoverable as components');
for(const id of ['assetRotateLeft','assetRotateRight','assetRotationControls','assetRotationValue'])assert(html.includes('id="'+id+'"'),'Missing 3D inspector rotation control '+id);
assert(source.includes('rotateSelection(-15)')&&source.includes('rotateSelection(15)'), 'Rotation step must be 15 degrees');
assert(html.includes('rotate3d:delta'), 'Live native 3D previews must rotate too');
for(const expression of ['IntersectionObserver','aria-selected','aria-pressed','assetFamily',
  'assetFormat','toLocaleLowerCase','renderModel','renderSchema','selectItem','searchText']){
  assert(source.includes(expression),'Missing filtering / accessibility / rendering contract '+expression);
}
assert(/filter\(Boolean\)/.test(source.match(/const searchText=.*$/m)[0]),'Search must skip missing fields');

// Audit engine: the Lab stages every fortification state in the idle sandbox and audits what it shows.
const stage=read('src/settlement-asset-stage.js'),audit=read('src/asset-audit.js'),simulation=read('src/settlement-app-simulation.js');
assert(stage.includes('if(!window.__CONQUER_ASSET_LAB__)return;'),'Asset stage must only exist in the sandbox');
assert(index.indexOf('settlement-asset-stage.js')>index.indexOf('settlement-siege-preview.js'),'Stage loads after the gallery variants');
for(const s of ['build-','damage-','cutaway','galleryPhases','structureCutaway','constructionProgress'])assert(stage.includes(s),'Stage state '+s);
assert(stage.includes("performance.now=()=>FROZEN_MS")&&stage.includes('delete performance.now'),'Captures freeze the animation clock and restore it');
assert(stage.includes("id:'assetlab-'+id")&&stage.includes('delete crypto.randomUUID'),'Captures use stable ids for rubble seeds');
assert(preview.includes('galleryPhases:phases'),'Damage phases must come from the destruction gallery');
assert(/if\(!window\.__CONQUER_ASSET_LAB__\)requestAnimationFrame\(simulationFrame\);/.test(simulation),'Sandbox must not run a match');
assert(/if\(window\.__CONQUER_ASSET_LAB__\)return 20261023;/.test(core),'Sandbox world must be fixed');
assert(read('lab/index.html').includes("location.replace('../figures-lab.html'"),'/lab must open the Lab directly');
assert(html.indexOf('./src/asset-audit.js')>html.indexOf('./src/asset-catalog.js'),'Audit loads after the catalogue');
for(const id of ['assetStateBar','assetAuditRun','assetAudit','assetAuditSummary','assetAuditList'])assert(html.includes('id="'+id+'"'),'Missing audit UI '+id);
for(const s of ['catalog','inspect','run','sheet','baseline'])assert(new RegExp('window\\.ConquerAssetAudit=\\{[^}]*\\b'+s+'\\b').test(audit),'Audit API '+s);
for(const c of ['visibile','avanzamento-cantiere','piani-crollati','distrutta-rovina','cutaway-attivo','cantiere-progressivo',
  'danno-visibile','sagoma-conservata','altezza-per-livello','mesh-finita','fotogrammi-rotazione'])assert(audit.includes("'"+c+"'"),'Audit check '+c);
const baseline=JSON.parse(read('qa/asset-audit-baseline.json'));
const entries=Object.entries(baseline.entries||{});
assert(entries.length>=400,'Audit baseline must cover every render: '+entries.length);
assert(entries.every(([k,v])=>/\|/.test(k)&&Array.isArray(v.signature)&&v.signature.length===144),'Baseline entries: id|state -> 12x12 signature');
assert(entries.some(([k])=>/^castle:.+\|damage-/.test(k))&&entries.some(([k])=>/^castle:.+\|cutaway$/.test(k))&&entries.some(([k])=>/^castle:.+\|build-50$/.test(k)),
  'Baseline must hold construction, damage and cutaway states');
assert(baseline.waivers&&typeof baseline.waivers==='object','Baseline keeps its waivers');
assert(source.includes("SCHEMA"),'Parametric diagrams must be explicitly labelled');
console.log('Asset Lab regression PASS: '+manifest.length+' files, '+Object.keys(rotations).length+' rotation sets, '+
  workTools.length+' work tools, registries, engine sandbox and UI contracts.');
