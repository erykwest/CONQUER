'use strict';
// CONQUER structure asset compiler / prerender QA.
// Produces deterministic 24-angle static composites, keeps a bounded LRU bitmap
// cache, and can exhaustively validate every current structural asset family.

const STRUCTURE_ASSET_PIPELINE_VERSION=1;
const STRUCTURE_ASSET_CANVAS_SIZE=256;
const STRUCTURE_ASSET_RENDER_SCALE=1.6;
const STRUCTURE_ASSET_CACHE_LIMIT=192;
const STRUCTURE_COMPOSITE_CACHE_LIMIT_BYTES=32*1024*1024;
const STRUCTURE_COMPOSITE_MAX_ENTRY_BYTES=16*1024*1024;
const STRUCTURE_ASSET_CENTER=Object.freeze({x:100,y:100});
const STRUCTURE_ASSET_TEST_LENGTHS=Object.freeze({
  wall:Object.freeze([1,4,8]),
  palisade:Object.freeze([1,4,8]),
  built:Object.freeze([1,2.5,4])
});
const STRUCTURE_SHADOW_TEST_STEPS=8;
const structureAssetBitmapCache=new Map();
const structureCompositeBitmapCache=new Map();
let structureAssetCompileRunning=null;
let structureAssetLastReport=null;
let structureAssetCacheBytes=0,structureCompositeCacheBytes=0;

function assetPerf(){
  return window.__conquerPerf||(window.__conquerPerf={});
}
function syncAssetPerf(){
  const p=assetPerf();
  p.assetCacheEntries=structureAssetBitmapCache.size+structureCompositeBitmapCache.size;
  p.assetCacheEstimatedBytes=structureAssetCacheBytes+structureCompositeCacheBytes;
  p.assetCacheEstimatedMb=+(p.assetCacheEstimatedBytes/1048576).toFixed(2);
  p.castleBodyBitmapEntries=structureCompositeBitmapCache.size;
  p.castleBodyBitmapBytes=structureCompositeCacheBytes;
}
function canvasEstimatedBytes(canvas){return Math.max(0,(canvas?.width||0)*(canvas?.height||0)*4)}
function markAssetHit(kind='asset'){
  const p=assetPerf();p.assetCacheHits=(p.assetCacheHits||0)+1;
  if(kind==='castleBody')p.castleBodyBitmapHits=(p.castleBodyBitmapHits||0)+1;
}
function markAssetMiss(kind='asset'){
  const p=assetPerf();p.assetCacheMisses=(p.assetCacheMisses||0)+1;
  if(kind==='castleBody')p.castleBodyBitmapMisses=(p.castleBodyBitmapMisses||0)+1;
}
function markAssetEviction(kind='asset'){
  const p=assetPerf();p.assetCacheEvictions=(p.assetCacheEvictions||0)+1;
  if(kind==='castleBody')p.castleBodyBitmapEvictions=(p.castleBodyBitmapEvictions||0)+1;
}

function assetCachePut(key,value){
  const prior=structureAssetBitmapCache.get(key);
  if(prior){structureAssetCacheBytes-=canvasEstimatedBytes(prior.canvas);structureAssetBitmapCache.delete(key)}
  structureAssetBitmapCache.set(key,value);structureAssetCacheBytes+=canvasEstimatedBytes(value.canvas);
  while(structureAssetBitmapCache.size>STRUCTURE_ASSET_CACHE_LIMIT){
    const oldest=structureAssetBitmapCache.keys().next().value,entry=structureAssetBitmapCache.get(oldest);
    structureAssetCacheBytes-=canvasEstimatedBytes(entry?.canvas);structureAssetBitmapCache.delete(oldest);markAssetEviction('asset');
  }
  syncAssetPerf();return value;
}
function assetCacheGet(key){
  const value=structureAssetBitmapCache.get(key);
  if(!value){markAssetMiss('asset');return null}
  markAssetHit('asset');structureAssetBitmapCache.delete(key);structureAssetBitmapCache.set(key,value);
  return value;
}
function clearStructureCompositeCache(){
  structureCompositeBitmapCache.clear();structureCompositeCacheBytes=0;syncAssetPerf();updateStructureAssetReadout();
}
function clearStructureAssetCache(){
  structureAssetBitmapCache.clear();structureAssetCacheBytes=0;clearStructureCompositeCache();syncAssetPerf();updateStructureAssetReadout();
}
function compositeCacheGet(key){
  const value=structureCompositeBitmapCache.get(key);
  if(!value){markAssetMiss('castleBody');return null}
  markAssetHit('castleBody');structureCompositeBitmapCache.delete(key);structureCompositeBitmapCache.set(key,value);
  return value;
}
function compositeCachePut(key,value){
  const bytes=canvasEstimatedBytes(value.canvas);
  if(bytes>STRUCTURE_COMPOSITE_MAX_ENTRY_BYTES)return null;
  const prior=structureCompositeBitmapCache.get(key);
  if(prior){structureCompositeCacheBytes-=canvasEstimatedBytes(prior.canvas);structureCompositeBitmapCache.delete(key)}
  structureCompositeBitmapCache.set(key,value);structureCompositeCacheBytes+=bytes;
  while(structureCompositeCacheBytes>STRUCTURE_COMPOSITE_CACHE_LIMIT_BYTES&&structureCompositeBitmapCache.size>1){
    const oldest=structureCompositeBitmapCache.keys().next().value,entry=structureCompositeBitmapCache.get(oldest);
    structureCompositeCacheBytes-=canvasEstimatedBytes(entry?.canvas);structureCompositeBitmapCache.delete(oldest);markAssetEviction('castleBody');
  }
  syncAssetPerf();return value;
}
function renderCachedComposite(kind,key,bounds,drawFn){
  const cached=compositeCacheGet(key);
  if(cached){
    const dx=(State.view.x-cached.viewX),dy=(State.view.y-cached.viewY);
    ctx.drawImage(cached.canvas,cached.x+dx,cached.y+dy,cached.w,cached.h);
    return{ok:true,hit:true,ms:0,bytes:canvasEstimatedBytes(cached.canvas)};
  }
  const x=Math.floor(bounds.minX),y=Math.floor(bounds.minY),w=Math.max(1,Math.ceil(bounds.maxX-x)),h=Math.max(1,Math.ceil(bounds.maxY-y));
  const d=staticCacheDpr(),pixelW=Math.max(1,Math.ceil(w*d)),pixelH=Math.max(1,Math.ceil(h*d));
  if(pixelW*pixelH*4>STRUCTURE_COMPOSITE_MAX_ENTRY_BYTES)return{ok:false,hit:false,reason:'entry-too-large'};
  const canvas=document.createElement('canvas');canvas.width=pixelW;canvas.height=pixelH;
  const g=canvas.getContext('2d'),t0=performance.now();
  g.setTransform(d,0,0,d,-x*d,-y*d);g.clearRect(x,y,w,h);
  try{withRenderContext(g,drawFn)}catch(err){return{ok:false,hit:false,reason:String(err?.message||err)}}
  const ms=performance.now()-t0,p=assetPerf();
  p.assetPrerenderMs=ms;p.assetPrerenderTotalMs=(p.assetPrerenderTotalMs||0)+ms;
  if(kind==='castleBody')p.castleBodyBitmapMs=ms;
  const entry=compositeCachePut(key,{canvas,x,y,w,h,viewX:State.view.x,viewY:State.view.y,kind});
  if(!entry)return{ok:false,hit:false,reason:'entry-too-large'};
  ctx.drawImage(canvas,x,y,w,h);
  updateStructureAssetReadout();
  return{ok:true,hit:false,ms,bytes:canvasEstimatedBytes(canvas)};
}
function assetPointBase(type,extra={}){
  return{id:'asset-'+type,type,auto:false,x:STRUCTURE_ASSET_CENTER.x,y:STRUCTURE_ASSET_CENTER.y,groundZ:0,foundationMinZ:0,foundationVersion:1,...extra};
}
function assetLinearBase(type,length,extra={}){
  return{id:'asset-'+type,type,auto:false,length,width:type==='built'?1:.5,groundZ:0,...extra};
}
function findHouseAssetId(level,plan=null,turret=null,doorSide=1,width=1.5){
  for(let i=0;i<4096;i++){
    const id='asset-house-'+level+'-'+(plan||'x')+'-'+(turret||'x')+'-'+doorSide+'-'+width+'-'+i;
    const s={id,type:'house',houseLevel:level};
    if(plan&&housePlanType(s)!==plan)continue;
    if(turret&&houseTurretType(s)!==turret)continue;
    return id;
  }
  throw new Error('Unable to synthesize deterministic house asset id');
}
function structureAssetFamilyCatalog(){
  const out=[],add=(key,label,base,rotates=true)=>out.push({key,label,base,rotates});
  for(const shape of ['square','round'])for(let tier=1;tier<=3;tier++)for(let level=1;level<=3;level++)for(const roofStyle of ['battlement','pitched'])for(const baseStyle of ['standard','buttress','splayed']){
    const size=towerSizeForTier(shape,tier);
    add(
      'tower-stone-'+shape+'-t'+tier+'-l'+level+'-'+roofStyle+'-'+baseStyle,
      'Stone '+shape+' tower T'+tier+' L'+level+' '+roofStyle+' '+baseStyle,
      assetPointBase('tower',{shape,material:'stone',level,tier,roofStyle,baseStyle,...(shape==='round'?{r:size}:{size})})
    );
  }
  add('tower-wood-watch','Wood watchtower',assetPointBase('tower',{shape:'square',material:'wood',woodStyle:'watchtower',woodRoof:'pitched',level:1,size:1,tier:1}));
  for(const woodRoof of ['open','pitched'])add('tower-wood-medium-'+woodRoof,'Wood medium tower '+woodRoof,assetPointBase('tower',{shape:'square',material:'wood',woodStyle:'palisadeTower',woodRoof,level:1,size:1.5,tier:2}));
  for(let level=1;level<=3;level++)for(const roofStyle of ['battlement','pitched'])add(
    'gate-stone-l'+level+'-'+roofStyle,'Stone gate L'+level+' '+roofStyle,
    assetPointBase('gate',{shape:'square',material:'stone',size:1.5,level,roofStyle})
  );
  add('gate-wood','Wood gate',assetPointBase('gate',{shape:'square',material:'wood',size:1.5,w:1,h:1.5,level:1,roofStyle:'flat'}));
  for(let tier=1;tier<=3;tier++)for(let level=1;level<=2;level++)for(const skin of ['standard','hoarding'])for(const length of STRUCTURE_ASSET_TEST_LENGTHS.wall)add(
    'wall-t'+tier+'-l'+level+'-'+skin+'-'+length,'Wall T'+tier+' L'+level+' '+skin+' '+length+'U',
    assetLinearBase('wall',length,{tier,level,skin,width:wallWidthForTier(tier)})
  );
  for(let tier=1;tier<=3;tier++)for(const length of STRUCTURE_ASSET_TEST_LENGTHS.palisade)add(
    'palisade-t'+tier+'-'+length,'Palisade T'+tier+' '+length+'U',
    assetLinearBase('palisade',length,{tier,level:1,width:wallWidthForTier(tier),flip:false})
  );
  for(let level=1;level<=2;level++)for(const skin of ['standard','arcade'])for(const length of STRUCTURE_ASSET_TEST_LENGTHS.built)add(
    'built-l'+level+'-'+skin+'-'+length,'Built section L'+level+' '+skin+' '+length+'U',
    assetLinearBase('built',length,{level,skin,width:1,functions:[]})
  );
  for(const type of CIVIC_TYPES)add('civic-'+type,'Civic '+type,assetPointBase(type));
  for(const width of [1.5,2])for(const doorSide of [-1,1]){
    for(const level of [1,2]){
      const id=findHouseAssetId(level,null,null,doorSide,width);
      add('house-l'+level+'-w'+width+'-d'+doorSide,'House L'+level+' '+width+'U door '+doorSide,{id,type:'house',auto:true,x:100,y:100,w:width,h:1,houseLevel:level,doorSide,groundZ:0});
    }
    for(const plan of ['L','T']){
      const id=findHouseAssetId(3,plan,null,doorSide,width);
      add('house-l3-'+plan+'-w'+width+'-d'+doorSide,'House L3 '+plan+' '+width+'U door '+doorSide,{id,type:'house',auto:true,x:100,y:100,w:width,h:1,houseLevel:3,doorSide,groundZ:0});
    }
    // FNV parity couples plan and turret in the current procedural house model:
    // T-plan houses resolve to round turrets, L-plan houses to square turrets.
    // Test only combinations the game can actually generate.
    for(const [plan,turret] of [['T','round'],['L','square']]){
      const id=findHouseAssetId(4,plan,turret,doorSide,width);
      add('house-l4-'+plan+'-'+turret+'-w'+width+'-d'+doorSide,'House L4 '+plan+' '+turret+' '+width+'U door '+doorSide,{id,type:'house',auto:true,x:100,y:100,w:width,h:1,houseLevel:4,doorSide,groundZ:0});
    }
  }
  add('well','Village well',assetPointBase('well'),false);
  return out;
}
function instantiateStructureAsset(def,step=0){
  const s={...def.base};
  if(def.base.functions)s.functions=[...def.base.functions];
  const angle=structureAngleFromStep(step);
  if(['wall','palisade','built'].includes(s.type)){
    const half=(Number(s.length)||1)/2,ux=Math.cos(angle),uy=Math.sin(angle);
    s.a={x:STRUCTURE_ASSET_CENTER.x-ux*half,y:STRUCTURE_ASSET_CENTER.y-uy*half};
    s.b={x:STRUCTURE_ASSET_CENTER.x+ux*half,y:STRUCTURE_ASSET_CENTER.y+uy*half};
    s.rotationStep=step;
  }else if(structureUsesDiscreteAngle(s)){
    s.angle=angle;s.rotationStep=step;
  }else{s.angle=0;s.rotationStep=0}
  normalizeStructureVariants(s);
  if(['tower','gate','built'].includes(s.type))normalizeFunctions(s);
  return s;
}
function structureAssetSignature(def,step){
  return [
    STRUCTURE_ASSET_PIPELINE_VERSION,def.key,'r'+String(step).padStart(2,'0'),
    State.season||'summer'
  ].join('|');
}
function withStructureAssetSandbox(s,canvas,drawFn){
  const prevStructures=State.structures,prevSelected=State.selectedId,prevView={...State.view},prevVillage=State.village;
  const g=canvas.getContext('2d');
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,canvas.width,canvas.height);
  State.structures=[s];State.selectedId=null;
  const assetScale=STRUCTURE_ASSET_RENDER_SCALE,assetWorldScale=U*assetScale;
  const assetGroundY=STRUCTURE_ASSET_CANVAS_SIZE*.74;
  State.view={
    ...prevView,
    scale:assetScale,
    x:STRUCTURE_ASSET_CANVAS_SIZE/2,
    y:assetGroundY-(STRUCTURE_ASSET_CENTER.x+STRUCTURE_ASSET_CENTER.y)*assetWorldScale*ISO_Y,
    rotation:0
  };
  State.village={...prevVillage,founded:false,name:null};
  try{return withRenderContext(g,()=>withProjectionGroundZ(0,drawFn))}
  finally{State.structures=prevStructures;State.selectedId=prevSelected;State.view=prevView;State.village=prevVillage}
}
function drawStaticStructureAsset(s){
  if(s.type==='house')drawAutoStructure(s);
  else drawStructure(s);
  if(s.type==='wall'&&wallSkin(s)==='hoarding')drawWallHoarding(s,buildBattlementOcclusionFrame());
  if(s.type==='built')drawBuiltArcade(s);
  drawTowerDoors();
  drawTowerRoofs();
  drawGateRoofs();
  drawCastleBattlements();
  if(s.type==='house')drawStaticHouseFacadeDetails();
  else drawFacadeWindows(false,1,false);
  drawGatePortals();
  for(const spec of chimneySpecs(s))drawChimney(spec);
}
function inspectAssetCanvas(canvas){
  const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,data=g.getImageData(0,0,w,h).data;
  let samples=0,painted=0,minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){
    samples++;const a=data[(y*w+x)*4+3];
    if(a>4){painted++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}
  }
  let borderPainted=false;
  for(let x=0;x<w&&!borderPainted;x++)for(const y of [0,1,h-2,h-1])if(data[(y*w+x)*4+3]>4){borderPainted=true;break}
  for(let y=0;y<h&&!borderPainted;y++)for(const x of [0,1,w-2,w-1])if(data[(y*w+x)*4+3]>4){borderPainted=true;break}
  return{
    paintedSamples:painted,
    coverage:samples?painted/samples:0,
    empty:painted<3,
    clipped:borderPainted,
    bounds:painted?{minX,minY,maxX,maxY}:null
  };
}
function assetPixelHash(canvas){
  const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let h=2166136261>>>0;
  for(let i=0;i<data.length;i+=64){h^=data[i];h=Math.imul(h,16777619);h^=data[i+3];h=Math.imul(h,16777619)}
  return(h>>>0).toString(16).padStart(8,'0');
}
function expectedShadowCaster(s){
  return ['house','tower','gate','wall','palisade','built','market','tavern','church'].includes(s.type);
}
function validateAssetShadowGeometry(s){
  if(!expectedShadowCaster(s))return{tested:0,failed:0};
  const fp=isCastlePart(s)?unionFootprintPoints(s):footprintPoints(s),h=shadowStructureHeight(s);
  if(!fp?.length||fp.length<3||!Number.isFinite(h)||h<=0)return{tested:1,failed:1,reason:'invalid caster geometry'};
  const center=structureCenter(s),local=fp.map(p=>({x:p.x-center.x,y:p.y-center.y}));
  let tested=0,failed=0;
  for(let i=0;i<STRUCTURE_SHADOW_TEST_STEPS;i++){
    tested++;
    const angle=(i/STRUCTURE_SHADOW_TEST_STEPS)*Math.PI*2,len=h*(.45+(i%4)*.28),ox=Math.cos(angle)*len,oy=Math.sin(angle)*len;
    const hull=convexHull(local.flatMap(p=>[p,{x:p.x+ox,y:p.y+oy}]));
    if(hull.length<3||hull.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))failed++;
  }
  return{tested,failed};
}
function validateStructureAssetContract(s,def,step){
  const errors=[];
  if(!s||!s.type)errors.push('missing type');
  if(def.rotates!==false&&structureRotationStep(s.angle||Math.atan2((s.b?.y||0)-(s.a?.y||0),(s.b?.x||0)-(s.a?.x||0)))!==step)errors.push('rotationStep mismatch');
  const fp=footprintPoints(s);
  if(!fp?.length||fp.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))errors.push('invalid footprint');
  const h=structureHeight(s);
  if(!Number.isFinite(h)||h<0)errors.push('invalid height');
  if(['wall','palisade','built'].includes(s.type)&&(!(s.length>0)||!Number.isFinite(s.length)))errors.push('invalid linear length');
  return errors;
}
function prerenderStructureAsset(def,step,{retain=true}={}){
  const key=structureAssetSignature(def,step);
  const cached=assetCacheGet(key);
  if(cached)return{...cached,cached:true};
  const s=instantiateStructureAsset(def,step),canvas=document.createElement('canvas');
  canvas.width=STRUCTURE_ASSET_CANVAS_SIZE;canvas.height=STRUCTURE_ASSET_CANVAS_SIZE;
  const t0=performance.now();
  withStructureAssetSandbox(s,canvas,()=>drawStaticStructureAsset(s));
  const metrics=inspectAssetCanvas(canvas),hash=assetPixelHash(canvas),shadow=validateAssetShadowGeometry(s);
  const value={key,canvas,metrics,hash,shadow,ms:performance.now()-t0};
  if(retain)assetCachePut(key,value);
  return value;
}
function structureAssetJobs(){
  const jobs=[];
  for(const def of structureAssetFamilyCatalog()){
    const steps=def.rotates===false?[0]:Array.from({length:STRUCTURE_ANGLE_STEPS},(_,i)=>i);
    for(const step of steps)jobs.push({def,step});
  }
  return jobs;
}
function updateStructureAssetReadout(report=structureAssetLastReport){
  const el=document.getElementById('assetCompileReadout');if(!el)return;
  syncAssetPerf();
  const p=assetPerf(),hits=p.assetCacheHits||0,misses=p.assetCacheMisses||0,total=hits+misses,rate=total?Math.round(hits/total*100):0;
  const runtime='cache '+p.assetCacheEntries+' · ~'+(p.assetCacheEstimatedMb||0)+' MB · hit '+rate+'%';
  const castle=document.getElementById('castleCacheReadout');
  if(castle)castle.textContent='Castle bitmap: '+(p.castleBodyBitmapEntries||0)+' entry · '+(p.castleBodyBitmapHits||0)+' hit / '+(p.castleBodyBitmapMisses||0)+' miss · last '+Number(p.castleBodyBitmapMs||0).toFixed(1)+' ms';
  if(structureAssetCompileRunning){el.textContent='Prerender/test in corso… '+runtime;return}
  if(!report){el.textContent='Non compilato · '+runtime;return}
  el.textContent=(report.ok?'PASS':'FAIL')+' · '+report.passed+'/'+report.jobs+' viste · '+report.failed+' fail · '+runtime;
}
async function compileAllStructureAssets({retain=true,yieldEvery=12}={}){
  if(structureAssetCompileRunning)return structureAssetCompileRunning;
  structureAssetCompileRunning=(async()=>{
    const jobs=structureAssetJobs(),report={
      version:STRUCTURE_ASSET_PIPELINE_VERSION,
      families:structureAssetFamilyCatalog().length,jobs:jobs.length,passed:0,failed:0,clipped:0,empty:0,
      shadowTests:0,shadowFailed:0,totalRenderMs:0,failures:[],startedAt:new Date().toISOString(),ms:0,ok:false
    };
    const started=performance.now();updateStructureAssetReadout(report);
    for(let i=0;i<jobs.length;i++){
      const {def,step}=jobs[i];
      try{
        const s=instantiateStructureAsset(def,step),contract=validateStructureAssetContract(s,def,step);
        if(contract.length)throw new Error(contract.join('; '));
        const rendered=prerenderStructureAsset(def,step,{retain});
        report.totalRenderMs+=rendered.ms||0;
        report.shadowTests+=rendered.shadow?.tested||0;report.shadowFailed+=rendered.shadow?.failed||0;
        if(rendered.metrics.empty){report.empty++;throw new Error('empty prerender')}
        if(rendered.metrics.clipped){report.clipped++;throw new Error('prerender clipped at canvas border')}
        if(rendered.shadow?.failed)throw new Error('shadow geometry failed '+rendered.shadow.failed+'/'+rendered.shadow.tested);
        report.passed++;
      }catch(err){
        report.failed++;
        if(report.failures.length<80)report.failures.push({asset:def.key,rotationStep:step,error:String(err?.message||err)});
      }
      if((i+1)%yieldEvery===0){updateStructureAssetReadout(report);await new Promise(r=>setTimeout(r,0))}
    }
    report.ms=performance.now()-started;report.finishedAt=new Date().toISOString();
    report.ok=report.failed===0&&report.shadowFailed===0;
    structureAssetLastReport=report;window.__conquerAssetReport=report;
    try{localStorage.setItem('conquer.assetReport.v1',JSON.stringify(report))}catch{}
    console.log('CONQUER_ASSET_QA_REPORT',JSON.stringify(report));
    return report;
  })();
  try{return await structureAssetCompileRunning}
  finally{structureAssetCompileRunning=null;updateStructureAssetReadout()}
}
function exportStructureAssetReport(){
  const report=structureAssetLastReport||window.__conquerAssetReport;if(!report)return;
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='conquer-asset-qa-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
window.__conquerAssetCompiler={
  version:STRUCTURE_ASSET_PIPELINE_VERSION,
  catalog:structureAssetFamilyCatalog,
  jobs:structureAssetJobs,
  compileAll:compileAllStructureAssets,
  prerender:prerenderStructureAsset,
  renderComposite:renderCachedComposite,
  clear:clearStructureAssetCache,
  clearComposite:clearStructureCompositeCache,
  report:()=>structureAssetLastReport,
  cache:structureAssetBitmapCache,
  compositeCache:structureCompositeBitmapCache,
  stats:()=>({
    entries:assetPerf().assetCacheEntries||0,
    estimatedMb:assetPerf().assetCacheEstimatedMb||0,
    hits:assetPerf().assetCacheHits||0,
    misses:assetPerf().assetCacheMisses||0,
    evictions:assetPerf().assetCacheEvictions||0
  })
};

const assetCompileBtn=document.getElementById('assetCompileBtn');
if(assetCompileBtn)assetCompileBtn.onclick=()=>compileAllStructureAssets();
const assetCacheClearBtn=document.getElementById('assetCacheClearBtn');
if(assetCacheClearBtn)assetCacheClearBtn.onclick=clearStructureAssetCache;
const assetExportBtn=document.getElementById('assetExportBtn');
if(assetExportBtn)assetExportBtn.onclick=exportStructureAssetReport;
try{
  const saved=JSON.parse(localStorage.getItem('conquer.assetReport.v1')||'null');
  if(saved?.version===STRUCTURE_ASSET_PIPELINE_VERSION)structureAssetLastReport=saved;
}catch{}
updateStructureAssetReadout();
if(new URLSearchParams(location.search).get('assetLab')==='1'){
  window.addEventListener('load',()=>setTimeout(()=>compileAllStructureAssets({retain:false,yieldEvery:24}),50),{once:true});
}
