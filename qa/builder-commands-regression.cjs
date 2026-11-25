'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function fixture(){
  const State={tool:{kind:'select'},draft:null,buildLevels:{tower:1,wall:1,wallTier:2,builtWide:2,gate:3},
    buildMasonryMaterial:'stone',village:{founded:false,privateMasonryMaterial:'stone'}};
  const window={},messages=[],quotes=[];
  const ctx=vm.createContext({window,State,
    document:new Proxy({},{get(){throw Error('Builder commands must not query the DOM')}}),
    setTool:tool=>{State.tool=tool;State.draft=null},status:s=>messages.push(s),draw(){},scheduleLocalSave(){},
    setPrivateMasonryMaterial:m=>{State.village.privateMasonryMaterial=m},
    isOrientedTowerShape:s=>['half','dee'].includes(s),orientedTowerLabel:s=>s.shape+' tower',
    woodTowerSize:s=>s==='watchtower'?1:1.5,woodTowerLevel:s=>s==='frameTower3'?3:s==='frameTower'?2:1,
    wallWidthForTier:t=>t*.25,SMALL_GATE_MAX_LEVEL:2,GATE_SIZES:{large:1.5},BUILD_DAYS:{market:4},
    structureLabel:s=>s.type,buildDuration:()=>3,
    constructionCost:s=>{quotes.push(s);return{wood:5}},costText:()=> '5 wood',aggregateConstructionCost:()=>({wood:10})
  });
  const make=type=>({type,x:0,y:0});
  window.ConquerStorageYard={make:()=>make('storageYard')};
  window.ConquerIndustries={make:(type,p,extractionMode)=>({...make(type),...p,extractionMode}),
    definition:s=>({name:s.type,w:2,h:2,workers:2,tier:1,good:'wood'}),isMill:s=>/mill/.test(s.type)};
  window.ConquerEconomy={KIND:{loggingCamp:{rate:2,workers:2}}};
  window.ConquerEvents3D={make:venue=>({type:'eventVenue',venue}),label:s=>s.venue,buildDays:()=>2,cost:()=>({wood:5})};
  window.ConquerPier={make:reach=>({type:'pier',reach}),label:()=> 'Pier',buildDays:()=>2,cost:()=>({wood:5})};
  window.ConquerShipyard={make:yard=>({type:'pier',yard})};
  window.ConquerSlopeways={label:t=>t,SPEC:{ramp:{costPerU:{}},stairway:{costPerU:{}}}};
  window.ConquerQuay={label:()=> 'Quay',SPEC:{costPerU:{}}};
  vm.runInContext(read('src/settlement-builder-commands.js'),ctx);
  return{ctx,State,window,messages,quotes,commands:window.ConquerBuilderCommands};
}
const f=fixture(),{commands:C,State:S}=f;
assert.equal(C.execute(null),false);assert.equal(C.execute({unknown:'x'}),false);
assert.equal(C.execute({tower:'square',gate:''}),false,'ambiguous requests have no effect');
assert.equal(S.tool.kind,'select');
for(const request of [{terraformShape:'square'},{terraformDelta:-1},{terraformRadius:6},{crossingWidth:3}])assert.equal(C.execute(request),true);
C.execute({terraform:'walled'});
assert.equal(S.tool.shape,'square');assert.equal(S.tool.radius,6);assert.equal(S.tool.delta,-1);
S.draft={preview:{}};C.execute({terraformShape:'round'});assert.equal(S.draft,null);
C.execute({tool:'select'});C.execute({crossing:'water'});assert.equal(S.tool.width,3);
C.execute({terraform:'flat'});assert.equal(S.tool.mode,'flat');assert.equal(S.tool.radius,6);
C.execute({gate:'',gateSize:1});assert.equal(S.tool.level,2);assert.equal(S.buildLevels.gate,2);
C.execute({gateLevel:3});assert.equal(S.tool.level,2,'small gate cap');
C.execute({woodGate:''});C.execute({gateLevel:3});assert.equal(S.tool.level,1,'wood gate stays H1');
C.execute({tower:'round',size:.75});assert.equal(S.tool.size,.75);assert.equal(f.quotes.at(-1).r,.75);
C.execute({towerLevel:3});assert.equal(S.tool.level,3);
C.execute({woodTower:'watchtower'});C.execute({towerLevel:2});assert.equal(S.tool.level,1,'wood tower ignores stone height');
C.execute({linear:'builtWide'});assert.equal(S.tool.span,'wide');C.execute({wallLevel:1});assert.equal(S.buildLevels.builtWide,1);
C.execute({linear:'longhouseWide'});assert.equal(S.tool.material,'wood');assert.equal(S.tool.level,1);
C.execute({linear:'palisade'});C.execute({wallTier:3});assert.equal(S.tool.tier,3);assert.equal(S.tool.level,1);
const before=S.tool;assert.equal(C.execute({storageYard:''}),false);assert.equal(S.tool,before);
S.village.founded=true;assert.equal(C.execute({storageYard:''}),true);assert.equal(S.tool.placementSpec.type,'storageYard');
C.execute({industry:'quarry',extractionMode:'clay'});assert.equal(S.tool.placementSpec.extractionMode,'clay');
C.execute({pier:12,yard:2});assert.equal(S.tool.placementSpec.yard,2);
S.draft={preview:{_ghostCheck:true}};C.execute({buildMasonry:'brick'});
assert.equal(S.draft.preview.masonryMaterial,'brick');assert.equal('_ghostCheck' in S.draft.preview,false);
assert.equal(C.execute({buildMasonry:'bad'}),false);assert.equal(S.buildMasonryMaterial,'brick');
C.execute({privateMasonry:'brick'});assert.equal(C.options().privateMasonry,'brick');
C.execute({linear:'leanTo'});S.draft={preview:{}};C.execute({leanMaterial:'brick'});assert.equal(S.tool.leanMaterial,'brick');assert.equal(S.draft,null);
C.execute({tool:'select'});C.execute({linear:'leanTo'});assert.equal(S.tool.leanMaterial,'brick','lean-to preset survives tool switch');
assert.equal(C.execute({leanMaterial:'invalid'}),false);
let calls=0;const unsubscribe=C.subscribe(()=>calls++);C.execute({well:''});unsubscribe();C.execute({well:''});assert.equal(calls,1);
const options=C.options();options.crossingWidth=900;assert.equal(C.options().crossingWidth,3,'snapshot is detached');
console.log('PASS Builder commands without DOM: presets, caps, materials, costs, prerequisites and notifications');

// Both adapters exercise the same commands. Detached buttons remain usable and
// command-driven choices update their markers without clicking hidden controls.
const buttons=[{terraform:'terrain'},{terraformShape:'square'},{terraformShape:'round'},
  {terraformRadius:'6'},{gate:'',gateSize:'1'},{gate:'',gateSize:'1.5'},{gateLevel:'1'},{gateLevel:'2'},{gateLevel:'3'},
  {industry:'quarry'},{industry:'quarry',extractionMode:'clay'},
  {pier:'12'},{pier:'12',yard:'2'}].map(dataset=>({
  dataset,textContent:'Tool',active:false,classList:{toggle(name,on){this[name]=on}},setAttribute(){}}));
const dom={querySelectorAll:selector=>{const key=selector.slice(6,-1).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return buttons.filter(b=>Object.hasOwn(b.dataset,key))}};
f.ctx.document=dom;vm.runInContext(read('src/settlement-builder-controls.js'),f.ctx);
const stop=f.window.ConquerBuilderControls.bind(dom);
buttons[1].onclick();buttons[0].onclick();assert.equal(S.tool.shape,'square');
C.execute({gate:'',gateSize:1});assert.equal(buttons[4].classList.active,true);assert.equal(buttons[5].classList.active,false);
assert.equal(buttons[7].classList.active,true,'small gate height marker follows capped state');
C.execute({gate:''});assert.equal(buttons[4].classList.active,false);assert.equal(buttons[5].classList.active,true,'default gate marks only its large variant');
C.execute({gate:''});assert.equal(buttons[4].classList.active,false);assert.equal(buttons[5].classList.active,true,'default gate selects only the large gate');
C.execute({industry:'quarry'});assert.equal(buttons[9].classList.active,true);assert.equal(buttons[10].classList.active,false,'default quarry excludes clay');
C.execute({pier:12});assert.equal(buttons[11].classList.active,true);assert.equal(buttons[12].classList.active,false,'default pier excludes shipyards');
stop();
console.log('PASS DOM adapter and data commands stay synchronized with detached controls');

// Import the actual pure UI catalogue, then walk each distinct command with the
// path that exposed it. Replaying each path avoids testing settings on the wrong tool.
const {CATALOG,activeEntry}=await import(pathToFileURL(path.join(root,'src/ui/builder-catalog.js')).href);
const snapshotOf=x=>{
  const t=x.State.tool,p=x.commands.options();
  return{tool:{...t,civic:t.kind==='civic'?t.placementSpec?.type:null,extraction:t.placementSpec?.extractionMode},
    levels:x.State.buildLevels,terraform:{shape:p.terraformShape,delta:p.terraformDelta,radius:p.terraformRadius},
    crossingWidth:p.crossingWidth,masonry:x.State.buildMasonryMaterial};
};
const queue=CATALOG.map(entry=>[entry.command]),seen=new Set();let selections=0;
while(queue.length){
  const steps=queue.shift(),request=steps.at(-1),key=JSON.stringify(request);
  if(seen.has(key))continue;seen.add(key);
  const x=fixture();x.State.village.founded=true;
  for(const step of steps)assert.equal(x.commands.execute(step),true,key);
  selections++;
  const snap=snapshotOf(x),entry=activeEntry(snap);
  for(const row of entry.rows?.(snap)||[])for(const option of row.options){
    assert.equal(typeof option.command,'object','every Builder option is data, including lean-to materials');
    assert.equal(typeof option.label,'string','translated option label');
    if(!seen.has(JSON.stringify(option.command)))queue.push([...steps,option.command]);
  }
}
assert.ok(selections>60,'complete catalogue paths, including alternate shapes');
for(const venue of ['stakeRow','chevalFrise','armyCamp'])assert.ok(seen.has(JSON.stringify({eventVenue:venue})),venue+' preserved from main');
assert.ok(seen.has(JSON.stringify({woodTower:'frameTower3'})),'H3 framed tower from main remains reachable');
const framed=fixture();framed.commands.execute({woodTower:'frameTower3'});
assert.equal(framed.State.tool.level,3);assert.match(framed.State.tool.label,/Framed top timber tower/);
assert.equal(seen.has(JSON.stringify({linear:'leanTo'})),false,'standalone lean-to is retired in favour of wall upgrades');
assert.ok(read('src/ui/shell.js').includes("'./builder-catalog.js?v="),'shell imports the pure catalogue');
assert.doesNotMatch(read('src/ui/game-api.js'),/findLegacy\('\[data-(?:crossing-width|terraform-|private-masonry)/);
const ux=read('src/settlement-builder-ux.js');
assert.ok(ux.includes("id:'defense'")&&ux.includes("icon:'category-defense'"),'main fortifications icon entry preserved');
assert.ok(read('src/ui/shell.js').includes("castle: 'M4")&&read('src/ui/shell.js').includes("castle: CastleStores"),'main castle management icon and view preserved');
for(const page of ['index.html','camp/index.html']){
  const html=read(page),commands=html.indexOf('settlement-builder-commands.js'),controls=html.indexOf('settlement-builder-controls.js');
  assert.ok(commands>=0&&controls>commands,'Builder scripts exist and load in order in '+page);
  assert.ok(controls<html.indexOf('settlement-app-input.js'));
}
console.log('PASS UI catalogue: '+selections+' distinct typed choices, including fieldworks and the H3 framed tower');

// Exercise the actual game interface too, so an omitted export or snapshot
// dependency cannot pass merely because the standalone commands worked.
Object.assign(S,{clock:{day:0,speed:0},view:{},resources:{},structures:[]});
const indicator={textContent:''};
f.ctx.document={querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>indicator};
f.ctx.MutationObserver=class{observe(){}};
f.ctx.queueMicrotask=fn=>fn();
f.ctx.calendarDateFromDay=()=>({day:1,month:0,year:1});
f.window.ConquerEconomy.weekday=()=>0;
vm.runInContext(read('src/ui/save-status.js'),f.ctx);
vm.runInContext(read('src/ui/game-api.js'),f.ctx);
assert.equal(f.window.ConquerGame.commands.builder({crossingWidth:2}),true);
const snap2=f.window.ConquerGame.snapshot();
assert.equal(snap2.crossingWidth,2);assert.equal(snap2.terraform.radius,6);
assert.equal(snap2.privateMasonry,'brick');
f.window.ConquerGame.commands.builder({linear:'leanTo'});
f.window.ConquerGame.commands.builder({leanMaterial:'brick'});
assert.equal(f.window.ConquerGame.snapshot().tool.leanMaterial,'brick');
for(const [text,expected] of [['saved local','saved'],['cloud loading','loading'],['cloud save blocked','blocked'],['salvataggio non caricato','error'],['unsaved','unsaved']]){indicator.textContent=text;assert.equal(f.window.ConquerGame.snapshot().saveStatus,expected,text)}
console.log('PASS actual ConquerGame command export and snapshot use the Builder state');

})().catch(error=>{console.error(error);process.exitCode=1});
