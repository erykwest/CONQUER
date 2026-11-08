'use strict';
// Stone palette approvals, deterministic map identity, material isolation and cache contracts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const State={seed:14,stonePaletteId:null,structures:[{type:'tower',masonryMaterial:'stone'}],resources:{stone:50,clay:30}};
const calls={save:0,dirty:0,invalidate:0,draw:0,composite:0,events:[]};
const doc={dispatchEvent(ev){calls.events.push(ev.detail)}};
const window={__conquerAssetCompiler:{clearComposite(){calls.composite++}}};
const ctx=vm.createContext({State,document:doc,window,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}},invalidateSceneCache(){calls.invalidate++},saveLocal(){calls.save++},markDirty(){calls.dirty++},draw(){calls.draw++}});
vm.runInContext(read('src/settlement-stonecolor.js'),ctx);
const api=window.ConquerStoneColor,ids=Object.keys(api.PALETTES);
assert.equal(ids.length,5);
assert.deepEqual(ids,['gray','sandstone','tuff','limestone','granite']);
for(const id of ids)assert.equal(api.PALETTES[id].shades.length,5,id+' gradient must have five shades');
assert.equal(api.PALETTES.sandstone.shades[2].toLowerCase(),'#b59c79');
assert.equal(api.PALETTES.gray.shades[2].toLowerCase(),'#82776c');
const seen=new Set(Array.from({length:200},(_,i)=>api.randomForSeed(i+1)));
assert.deepEqual([...seen].sort(),[...ids].sort(),'all 5 families reachable from fresh seeds');
assert.equal(api.randomForSeed(42),api.randomForSeed(42),'stable seeded choice');
assert.equal(State.stonePaletteId,api.randomForSeed(14));
assert.equal(api.normalized('invalid'),'gray','legacy or corrupt palette becomes gray');
assert.equal(api.changed('invalid'),false);
assert.equal(api.changed('sandstone'),true);
assert.equal(api.current(),'sandstone');
assert.equal(api.shade('#514a44').toLowerCase(),'#574638','deep shadow uses approved shadow ramp');
assert.notEqual(api.shade('#9a8e82').toLowerCase(),'#9a8e82');
assert.equal(api.masonry('#BE7254'),'#BE7254','clay/terracotta excluded');
assert.equal(api.masonry('#303237'),'#303237','anthracite roof excluded');
assert.equal(api.masonry('#635951'),api.shade('#635951'),'stone side tinted');
assert.equal(calls.save,1);assert.equal(calls.dirty,1);assert.equal(calls.invalidate,1);assert.equal(calls.draw,1);
assert.equal(calls.events[0].id,'sandstone');
assert.equal(State.resources.stone,50);assert.equal(State.resources.clay,30);
assert.equal(api.changed('sandstone'),false,'repeat selection is a no-op');
assert.equal(calls.draw,1);
assert.equal(api.changed('gray'),true);assert.equal(api.shade('#635951'),'#635951','current gray is unchanged');
const html=read('index.html');
assert.match(html,/src\/settlement-stonecolor\.js/);
assert.match(html,/data-profile-tab="environment"/);
assert.match(html,/id="profileEnvironment"/);
assert.match(html,/id="stonecolorChoices"/);
const profile=read('src/settlement-heraldry.js');
assert.match(profile,/function renderEnvironment\(/);
assert.match(profile,/ConquerStoneColor\?\.changed/);
const calendar=read('src/settlement-app-calendar-ui.js');
assert.match(calendar,/State\.stonePaletteId=window\.ConquerStoneColor\?\.randomForSeed\(State\.seed\)/);
const persist=read('src/settlement-app-persistence.js');
assert.match(persist,/stonePaletteId:State\.stonePaletteId/);
assert.match(persist,/normalized\(x\.stonePaletteId\)/);
assert.match(persist,/normalized\(data\.policies\?\.stonePaletteId\)/);
for(const name of ['src/settlement-landscape.js','src/settlement-coast.js','src/settlement-industries3d.js','src/settlement-scatter.js','src/settlement-quay.js'])assert.match(read(name),/ConquerStoneColor\?\.shade/,name);
const world=read('src/settlement-world3d.js');
const cutawayPos=world.indexOf('function buildCutaway()'),cutawayLoop=world.indexOf('for(const s of State.structures){',cutawayPos),stoneToneHelper=world.indexOf('const stoneTone=',cutawayPos);
assert.ok(cutawayPos>=0&&cutawayLoop>cutawayPos&&stoneToneHelper>cutawayLoop,'cutaway helper must be inside the structure scope');
assert.match(world,/const meshSig=\[season,State\.stonePaletteId/);
assert.match(world,/const castleContent=\[season,State\.visualPalette,State\.stonePaletteId/);
assert.match(world,/const scContent=\[season,State\.stonePaletteId/);
for(const file of ['src/settlement-stonecolor.js','src/settlement-world3d.js','src/settlement-landscape.js','src/settlement-scatter.js','src/settlement-industries3d.js','src/settlement-quay.js','src/settlement-coast.js'])new vm.Script(read(file),{filename:file});

// Audit the entire rendering dependency tree and invalidate geometry/bitmap caches.
const deps={
 'src/settlement-house3d.js':['State.stonePaletteId','structureVisualMaterial','ConquerStoneColor?.shade'],
 'src/settlement-civic3d.js':['State.stonePaletteId',"startsWith('stone')","startsWith('paving')"],
 'src/settlement-render.js':['State.stonePaletteId',"withStructureVisualMaterial({type:'wall',masonryMaterial:'stone'},drawCastleUnion)"],
 'src/settlement-castle.js':['function drawStoneTileFloor','ConquerStoneColor?.shade'],
 'src/settlement-shop-cutaway.js':['State.stonePaletteId','ConquerStoneColor?.shade'],
 'src/settlement-cutaway-furniture.js':['State.stonePaletteId',"f.key?.startsWith('stone')"],
 'src/settlement-crossings.js':['State.stonePaletteId','ConquerStoneColor?.shade'],
 'src/settlement-slopeways.js':['State.stonePaletteId','STONE_TONES','stoneTone(c)'],
 'src/settlement-wall-stairs.js':["l.spec.kind==='stone'",'ConquerStoneColor?.shade'],
 'src/settlement-construction-props.js':['State.stonePaletteId',"'rock','block','blockDressed'"],
 'src/settlement-construction-assembly.js':['State.stonePaletteId'],
 'src/settlement-coast.js':['State.stonePaletteId',"role?.startsWith('rock')"],
 'src/settlement-scatter.js':['stonePal',"paletteKeys[i]?.startsWith('stone')"],
 'src/settlement-industries3d.js':['data.paletteKeys',"modelKey==='quarry'","modelKey==='mine'"],
 'src/settlement-world3d.js':['State.stonePaletteId',"stoneTone('#61574f')","floorTone('#7f796f')"],
 'src/settlement-landscape.js':['ConquerStoneColor?.shade','mountainFaceColor'],
 'src/settlement-quay.js':['State.stonePaletteId','ConquerStoneColor?.shade']
};
for(const [file,checks] of Object.entries(deps)){
 const src=read(file);
 for(const token of checks)assert.ok(src.includes(token),file+' missing '+token);
 new vm.Script(src,{filename:file});
}
const assets=['src/assets/waterside-models.js','src/assets/scatter-model.js','src/assets/industry-models.js'];
const records=assets.map(file=>{const s=read(file);return JSON.parse(s.slice(s.indexOf('={')+1).replace(/;\s*$/,''))});
assert.ok(records[0].paletteKeys.includes('weed')&&records[0].paletteKeys.includes('rock'));
assert.ok(records[1].paletteKeys.includes('stone')&&records[1].paletteKeys.includes('moss'));
assert.ok(records[2].paletteKeys.includes('clay')&&records[2].paletteKeys.includes('rock'));
for(const file of Object.keys(deps)){
 const src='src/settlement-'+file.split('src/settlement-').pop();
 assert.ok(html.includes(src+'?v='),file+' must be browser-loaded');
}

console.log('PASS STONECOLOR: 5 approved ramps; random stable; material isolation; UI/save/cache/renderer contracts');
