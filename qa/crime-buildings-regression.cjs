'use strict';
// Crime buildings and rooms (docs/crime.md): town hall chambers with the tribunal from L2,
// guard post and prison capacities, the church L2 almshouse annex, and the pillory and
// gallows as placeable piazza works with their Blender models.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const src=f=>read('src/'+f);
const core=src('settlement-core.js'),castle=src('settlement-castle-placement.js'),siege=src('settlement-siege.js');
const fn=(text,name)=>{const m=text.match(new RegExp('function '+name+'\\(s\\)\\{[\\s\\S]*?\\n\\}'));assert.ok(m,name+' found');return m[0]};
const line=(text,re)=>{const m=text.match(re);assert.ok(m,String(re));return m[0]};

// ---------- town hall chambers
{
  const State={clock:{day:10},structures:[],siege:null};
  const ctx=vm.createContext({State,window:{},console,Math,Number,Object,Array,Map,Set,
    towerTier:s=>s.size>=1.5?2:1,structureLevel:s=>s.level||1,isWoodTower:()=>false,woodTowerStyle:()=>'palisadeTower',
    underConstruction:s=>!!s.construction,markDirty:()=>{},renderFunctionPanel:()=>{},draw:()=>{},status:()=>{}});
  vm.runInContext([line(core,/const FUNCTION_CATALOG=\[[^\n]+\];/),line(core,/const TOWNHALL_FUNCTION_CATALOG=[^\n]+;/),
    fn(core,'civicLevel'),fn(castle,'functionCapacity'),fn(castle,'normalizeFunctions'),fn(castle,'normalizeTownhallRooms'),siege].join('\n'),ctx);
  const run=c=>vm.runInContext(c,ctx),S=ctx.window.ConquerSiege;
  const hall=(level,functions)=>({id:'th',type:'townhall',civicLevel:level,...(functions?{functions,townhallRooms:1}:{})});
  // A town hall saved before its chambers keeps its council room.
  const old=hall(2);run('normalizeFunctions')(old);
  assert.deepEqual([...old.functions],['council',null],'legacy L2 town hall: council chamber + one free chamber');
  for(const l of [1,2,3])assert.equal(run('functionCapacity')(hall(l)),l,'L'+l+' town hall has '+l+' chamber(s)');
  assert.ok(!S.allowed(hall(1),0,'tribunal'),'no tribunal in an L1 town hall');
  assert.ok(S.allowed(hall(2),1,'tribunal')&&S.allowed(hall(3),0,'tribunal'),'tribunal from L2, in any chamber');
  assert.ok(['council','guard','prison'].every(k=>S.allowed(hall(1),0,k)),'council, guard and prison at L1');
  assert.ok(!S.allowed(hall(2),2,'guard'),'no chamber past the level');
  assert.ok(!S.allowed(hall(3),0,'barracks')&&!S.allowed(hall(3),0,'treasury'),'castle rooms stay in the castle');
  assert.ok(!S.allowed({...hall(3),construction:{}},0,'council'),'no chambers while building');
  // Downgrade drops the tribunal.
  const down=hall(2,['council','tribunal']);down.civicLevel=1;run('normalizeFunctions')(down);
  assert.deepEqual([...down.functions],['council'],'L2 -> L1 drops the second chamber');
  const kept=hall(3,['tribunal','prison','guard']);kept.civicLevel=2;run('normalizeFunctions')(kept);
  assert.deepEqual([...kept.functions],['tribunal','prison'],'L3 -> L2 keeps the tribunal');
  // Council and tribunal are civic only.
  const tower={id:'t',type:'tower',size:1.5,level:3,functions:[]};
  assert.ok(!S.allowed(tower,0,'tribunal')&&!S.allowed(tower,0,'council'),'no tribunal or council in a tower');
  assert.ok(S.allowed(tower,2,'prison')&&S.allowed(tower,2,'guard'),'prison and guard post on any T2 tower floor');
  // Capacities: a normal cell 6 prisoners, a large one 12; guard posts 4 watchmen.
  State.structures=[{...tower,size:1.5,functions:['prison','guard',null]},hall(2,['prison','tribunal'])];
  run('functionSlotUnits=()=>1;');
  const cap=S.capacity();
  assert.equal(cap.prisoners,12,'tower cell + town hall cell');
  assert.equal(cap.watchmen,4,'one guard post');
  console.log('PASS town hall chambers: council, guard, prison, tribunal from L2; prison and guard capacities');
}

// ---------- town hall cutaway furnishes each chamber
{
  const window={},State={season:'summer',structures:[]};
  const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,String,Float32Array,
    isPlanView:()=>false,rotateViewPoint:p=>({x:p.x,y:p.y})});
  vm.runInContext(core.slice(core.indexOf('const CIVIC_TYPES='),core.indexOf('function civicParts(')),ctx);
  for(const f of ['assets/civic-models.js','settlement-mesh3d.js','settlement-civic3d.js'])vm.runInContext(src(f),ctx);
  const C3=window.ConquerCivic3D;
  const faces=(level,functions)=>{
    State.structures=[{id:'th',type:'townhall',x:0,y:0,angle:0,civicLevel:level,...(functions?{functions,townhallRooms:1}:{})}];State.selectedId='th';
    assert.equal(C3.cutawayId(),'th','the selected town hall is in cutaway');
    const out=[];C3.addCutawayToBuilder({face:vs=>out.push(vs)},0);return out;
  };
  const legacy=faces(1).length;
  assert.equal(faces(1,['council']).length,legacy,'a lone council chamber keeps the classic room');
  const roles=['council','tribunal','guard','prison'],counts={};
  for(const r of roles)counts[r]=faces(3,[r,null,null]).length;
  const empty=faces(3,[null,null,null]).length;
  for(const r of roles)assert.ok(counts[r]>empty,r+' chamber is furnished');
  assert.equal(new Set(Object.values(counts)).size,roles.length,'every role has its own furnishing');
  const full=faces(3,['council','tribunal','prison']);
  // Furniture stays inside the hall (L2/L3 floor x -1.95..1.95, y -0.2..1.55), below the sill section.
  const low=full.filter(vs=>vs.every(v=>v.z>.02&&v.z<.8&&v.y>-.2-1e-6&&v.y<1.55+1e-6));
  assert.ok(low.length>counts.council-empty,'three furnished chambers');
  assert.ok(full.every(vs=>vs.every(v=>Math.abs(v.x)<=2.6&&Math.abs(v.y)<=3)),'nothing escapes the building');
  State.selectedId=null;
  console.log('PASS town hall cutaway: '+roles.join(', ')+' chambers furnished side by side');
}

// ---------- almshouse annex of the church
{
  const annexes=src('settlement-civic-annexes.js');
  const ctx=vm.createContext({Object});
  vm.runInContext(annexes.slice(annexes.indexOf('const CIVIC_ANNEX_CATALOG='),annexes.indexOf('function isCivicAnnex(')),ctx);
  const spec=vm.runInContext('CIVIC_ANNEX_CATALOG.church.almshouse',ctx);
  assert.ok(spec&&spec.level===2&&spec.max===1&&spec.kind==='stone','almshouse: church L2 annex, one per church');
  const w={};new Function('window',src('assets/civic-models.js'))(w);
  assert.ok(w.ConquerCivicModels.models.almshouse,'almshouse model generated');
  assert.match(read('tools/blender/build_civic.py'),/\('almshouse', a_almshouse\)/,'Blender source for the almshouse');
  console.log('PASS almshouse annex (church L2) with its model');
}

// ---------- pillory and gallows
{
  const window={},State={season:'summer',seed:7,heraldry:{}};
  const ctx=vm.createContext({window,State,Math,Object,Number,Array,Map,Set,String,Float32Array,performance:{now:()=>0}});
  for(const f of ['assets/scatter-model.js','assets/civic-models.js','assets/event-models.js','settlement-mesh3d.js','settlement-events3d.js'])vm.runInContext(src(f),ctx);
  const E=window.ConquerEvents3D;
  for(const [v,model] of [['pillory','justicePillory'],['gallows','justiceGallows']]){
    const s={...E.make(v),id:v,x:0,y:0,angle:0};
    assert.ok(E.is(s)&&E.has(s),v+' is a placeable venue that renders');
    assert.equal(E.venueModel(s),model);
    const {w,h}=E.sizeOf(s),r=E.itemRect({m:model,x:0,y:0,a:0});
    assert.ok(r.x0>=-w/2&&r.x1<=w/2&&r.y0>=-h/2&&r.y1<=h/2,v+' model stays on its '+w+'x'+h+' U footprint');
    assert.ok(Object.keys(E.cost(s)).length&&E.buildDays(s)>0,v+' has a cost and a building site');
    assert.ok(E.setupItems(s).length===0,v+' has no event setup');
  }
  const html=read('index.html'),ux=src('settlement-builder-ux.js'),shell=src('ui/shell.js'),it=src('ui/i18n-it.js');
  for(const v of ['pillory','gallows']){
    assert.match(html,new RegExp('<button data-event-venue="'+v+'">'),'legacy Builder button for '+v);
    assert.ok(ux.includes('[data-event-venue="'+v+'"]'),v+' in the Builder palette');
    assert.ok(shell.includes('[data-event-venue="${k}"]')&&shell.includes("'pillory', 'gallows'"),'new Builder: justice tool');
  }
  assert.match(it,/justice: 'Giustizia/);assert.match(it,/pillory: 'Gogna', gallows: 'Forca'/);
  assert.match(it,/tribunal: 'Tribunale'/);
  assert.match(src('asset-catalog.js'),/justicePillory:'Gogna',justiceGallows:'Forca'/,'Lab names');
  console.log('PASS pillory and gallows: venues, models on their footprints, Builder entries, Lab names');
}
