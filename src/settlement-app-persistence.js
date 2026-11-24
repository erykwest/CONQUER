'use strict';
// Save migrations and local/cloud adapters. Snapshot format and shared restore stages have one owner.
function migrateStructures(list){
  const migrated=(list||[]).map(s=>{
    if(['moat','bridge'].includes(s.type))window.ConquerCrossings?.normalise(s);
    if(window.ConquerSlopeways?.is(s))window.ConquerSlopeways.normalise(s);   // keeps the surveyed za/zb
    // Migrate old windmill A/B save records before industry recognition.
    if(s.type==='windmillA'||s.type==='windmillB')s.type='windmill';
    if(window.ConquerIndustries?.is(s))window.ConquerIndustries.normalizeFootprint(s);
    if(s.type==='house')s.houseLevel=houseLevel(s);
    normalizeCivicDevelopment(s);
    if(s.type==='built'){
      if(s.span!=='wide')delete s.span;
      s.width=builtWidth(s);
      if(!Number.isFinite(s.length))s.length=dist(s.a,s.b);
      s.level=clamp(Math.round(Number(s.level)||1),1,2);
      // Timber longhouse: ground floor only, plain skin.
      if(s.material==='wood'){s.level=1;s.skin='standard';if(longhouseCover(s)==='shingle')delete s.roofCover}
      else{delete s.material;delete s.roofCover}
    }
    if(s.type==='wall'){
      s.width=Number.isFinite(Number(s.width))?Number(s.width):.5;
      s.tier=wallTier(s);
      s.width=wallWidthForTier(s.tier);
      s.level=clamp(Math.round(Number(s.level)||1),1,2);
    }
    if(s.type==='palisade'){
      s.width=Number.isFinite(Number(s.width))?Number(s.width):.5;
      s.tier=wallTier(s);
      s.width=wallWidthForTier(s.tier);
      s.level=1;
      s.flip=!!s.flip;
    }
    if(s.type==='tower'){
      s.material=s.material==='wood'?'wood':'stone';
      if(!Number.isFinite(Number(s.orientationOffset)))s.orientationOffset=0;
      s.orientationOffset=snapStructureAngle(s.orientationOffset);
      if(s.material==='wood'){
        s.woodStyle=WOOD_TOWER_STYLES.includes(s.woodStyle)?s.woodStyle:'palisadeTower';
        s.shape='square';s.level=woodTowerLevel(s.woodStyle);
        s.size=woodTowerSize(s.woodStyle);
        s.woodRoof=s.woodStyle!=='palisadeTower'?'pitched':(s.woodRoof==='pitched'?'pitched':'open');
      }else{
        // W2 towers may rise to H4 (#174): clamp to the tower's own ceiling, not to 3.
        s.level=clamp(Math.round(Number(s.level)||1),1,typeof maxStructureLevel==='function'?maxStructureLevel(s):3);
      }
      s.tier=towerTier(s);
      applyStructureTier(s,s.tier);
      s.wallColliderSyncSignature=null;
    }
    if(s.type==='gate'){
      s.material=s.material==='wood'?'wood':'stone';
      if(s.material==='wood'){
        s.shape='square';s.level=1;s.size=1.5;s.w=1;s.h=1.5;s.roofStyle='flat';
      }else{
        s.size=isSmallGate(s)?GATE_SIZES.small:GATE_SIZES.large;
        s.level=clamp(Math.round(Number(s.level)||1),1,maxStructureLevel(s));
        delete s.w;delete s.h;
      }
    }
    if(s.type==='road'&&s.a&&s.b&&!Number.isFinite(Number(s.length)))s.length=dist(s.a,s.b);
    if(s.type==='well'){
      if(!s.construction?.materialsDelivered)delete s.construction;
      // Quarter names of later wells (older saves have none: one well = the village centre).
      const name=sanitizeWellName(s.wellName);if(name)s.wellName=name;else delete s.wellName;
    }
    if(['tower','gate'].includes(s.type)&&!Number.isFinite(s.angle))s.angle=0;
    if(structureUsesDiscreteAngle(s))normalizeStructureRotation(s);
    if(['wall','palisade','built'].includes(s.type)&&s.a&&s.b){
      const rawAngle=Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x),snapped=snapStructureAngle(rawAngle);
      const delta=Math.abs(Math.atan2(Math.sin(rawAngle-snapped),Math.cos(rawAngle-snapped)));
      s.rotationStep=delta<1e-6?structureRotationStep(snapped):null;
    }

    // Legacy structures default to stone. Existing wood variants remain wood.
    s.masonryMaterial=s.masonryMaterial==='brick'?'brick':'stone';
    // V1 visual-variant migration. Legacy structures keep today's appearance.
    normalizeStructureVariants(s);

    if(['tower','gate','built'].includes(s.type))normalizeFunctions(s);
    if(s.type==='tower')window.ConquerKeepEntrance?.normalise(s);
    return s;
  });

  // Walls and gates face out of the enclosure they form (settlement-castle-structures.js).
  if(typeof faceFortificationsOut==='function')faceFortificationsOut(migrated);
  // Walls against a quay always face out to the water (settlement-quay.js rule).
  for(const s of migrated)window.ConquerQuay?.faceWallOut(s,migrated);

  // Remove annexes whose parent no longer exists and repair dimensions from catalog.
  const parentIndex=new Map(migrated.map(s=>[s.id,s]));
  const cleaned=migrated.filter(s=>!isCivicAnnex(s)||normalizeCivicAnnex(s,parentIndex.get(s.parentId)));
  const byId=new Map(cleaned.map(s=>[s.id,s]));
  for(const s of cleaned){
    if(s.type!=='tower'||!s.parentTowerId)continue;
    const parent=byId.get(s.parentTowerId);
    if(!parent||!['tower','gate'].includes(parent.type)||isWoodGate(parent)||(parent.type==='tower'&&towerTier(s)>=towerTier(parent))){
      delete s.parentTowerId;delete s.subtowerSocket;delete s.subtowerAngle;delete s.parentType;
      continue;
    }
    s.parentType=parent.type;
    // Recompute persisted attachment coordinates so legacy subtowers move
    // immediately onto the new center-based node model after load.
    const attachment=subtowerAttachmentAtSocket(parent,s,s.subtowerSocket,s.subtowerAngle);
    if(attachment){
      s.x=attachment.point.x;s.y=attachment.point.y;
      if(s.shape==='square'||isOrientedTower(s))s.angle=attachment.angle;
      s.subtowerSocket=attachment.subtowerSocket;
      s.subtowerAngle=attachment.subtowerAngle;
    }
  }
  // Rooms are checked against the world being loaded, not the one still open: the latrine rule
  // (ConquerRoomExterior.placement) scans State.structures for what stands in front of a face.
  const open=State.structures;
  try{State.structures=cleaned;for(const s of cleaned)if(['tower','gate','built'].includes(s.type))window.ConquerSiege?.sanitizeRooms(s)}
  finally{State.structures=open}
  const keep=cleaned.find(s=>s.type==='tower'&&s.isMastio);for(const s of cleaned)if(s.isMastio&&s!==keep)s.isMastio=false;
  return cleaned;
}
const LOCAL_STORAGE_SCHEMA=2;
function localStorageBranch(){
  if(!location.hostname.endsWith('github.io'))return null;
  const parts=location.pathname.split('/').filter(Boolean);
  const buildIndex=parts.indexOf('_builds');
  if(buildIndex>=0&&parts[buildIndex+1])return parts[buildIndex+1];
  const repoIndex=parts.indexOf('CONQUER');
  return repoIndex>=0&&parts[repoIndex+1]?parts[repoIndex+1]:'main';
}
function localStorageKey(){
  if(window.__CONQUER_REGIONAL_DEMO__)return 'conquer.regional-demo.sandbox';
  // Asset Lab sandbox: reads an empty slot, so the player's own settlement is never loaded or touched.
  if(window.__CONQUER_ASSET_LAB__)return 'conquer.assetlab.sandbox';
  if(window.__CONQUER_CAMP_MODE__)return 'conquer.camp.schema'+LOCAL_STORAGE_SCHEMA+'.settlement.0.0';
  const pagesBranch=localStorageBranch();
  return pagesBranch
    ?`conquer.pages.${pagesBranch}.schema${LOCAL_STORAGE_SCHEMA}.settlement.0.0`
    :'conquer.settlement.0.0';
}
// DEV sessions keep the old 10000 starting floor on load; players get exactly what was saved.
function loadResourceFloor(){
  const p=new URLSearchParams(location.search);
  if(p.has('dev'))return p.get('dev')==='1'?10000:0;
  try{return localStorage.getItem('conquer.dev')==='1'?10000:0}catch{return 0}
}
// A save that throws while loading is set aside (latest 2 copies, key+'.corrupt.'+time) and the half-
// loaded game never writes over it: saving stays off until a good load or a new map (a new seed).
function markLoadFailed(raw,err){
  console.warn('CONQUER save not loaded',err);
  State.loadFailed={seed:State.seed};
  try{
    const prefix=localStorageKey()+'.corrupt.',old=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(prefix))old.push(k)}
    old.sort((a,b)=>Number(a.slice(prefix.length))-Number(b.slice(prefix.length)));
    const fresh=!old.length||localStorage.getItem(old[old.length-1])!==raw;   // the same broken save is copied once
    old.slice(0,Math.max(0,old.length-(fresh?1:2))).forEach(k=>localStorage.removeItem(k));
    if(fresh)localStorage.setItem(prefix+Date.now(),raw);
  }catch(e){console.warn('CONQUER corrupt save backup failed',e)}
  try{
    const indicator=document.getElementById('saveState');if(indicator)indicator.textContent='salvataggio non caricato';
    status('Salvataggio non caricato: la partita salvata Ã¨ conservata intatta e non verrÃ  sovrascritta. Avvia una nuova mappa per ricominciare a salvare.');
  }catch{}
  window.__conquerAnalytics?.event?.('LOAD_ERROR',{message:String(err)},'error',30000);
}
function saveBlocked(){
  if(State.loadFailed&&State.loadFailed.seed!==State.seed)State.loadFailed=false;   // a new map was generated
  return !!State.loadFailed;
}
let localSaveTimer=null;
function reportLocalSaveFailure(error){
  console.warn('CONQUER local save failed',error);
  const indicator=document.getElementById('saveState');if(indicator)indicator.textContent='local save failed';
  window.__conquerAnalytics?.event?.('LOCAL_SAVE_ERROR',{message:String(error)},'error',30000);
}
function saveLocal(snapshot=null){
  if(window.__CONQUER_ASSET_LAB__)return;
  if(window.__CONQUER_REGIONAL_DEMO__)return;
  if(saveBlocked()){const indicator=document.getElementById('saveState');if(indicator)indicator.textContent='salvataggio bloccato';return false}
  const t0=performance.now();
  try{localStorage.setItem(localStorageKey(),snapshot??captureSettlementSave());}catch(error){
    reportLocalSaveFailure(error);
    return false;
  }
  if(window.__conquerPerf)window.__conquerPerf.lastSaveMs=performance.now()-t0;
  window.__conquerAnalytics?.measure('SAVE',performance.now()-t0);
  return true;
}
function scheduleLocalSave(delay=700){
  if(localSaveTimer)return;
  localSaveTimer=setTimeout(()=>{localSaveTimer=null;saveLocal()},delay);
}
// Shared restore stages retain the historical local/cloud ordering of migrations.
function restoreSavedSeason(saved){
  State.season=['summer','autumn','winter','spring'].includes(saved.season)?saved.season:'summer';
  State.seasonOverride=['summer','autumn','winter','spring'].includes(saved.seasonOverride)&&(saved.ambientAutoV1===true||saved.seasonOverride!=='summer')?saved.seasonOverride:null;
}
function restoreSavedResources(resources){
  State.resources={...State.resources,...resources};
  for(const k of Object.keys(State.resources))State.resources[k]=Math.max(loadResourceFloor(),Number(State.resources[k])||0);
}
function restoreSavedVillage(village){
  const legacyGrowth=village?.growthVersion!==3;
  State.village={...State.village,...village,socialSchemaVersion:2};
  if(legacyGrowth)State.village.growthVersion=1;
  State.village.privateMasonryMaterial=State.village.privateMasonryMaterial==='brick'?'brick':'stone';
}
function restoreSavedLandscape(landscape,{repair=false}={}){
  if(landscape?.version===LANDSCAPE_GENERATION_VERSION&&Array.isArray(landscape.relief?.hills)&&Array.isArray(landscape.environment)){
    State.relief=landscape.relief;State.environment=landscape.environment;widenWatercourses();clearReliefBandCache();
    return{missing:false,repaired:repair?ensureStaticLandscape():false};
  }
  State.relief=null;State.environment=[];ensureStaticLandscape();return{missing:true,repaired:true};
}
function reconcileLoadedSettlement(){
  window.ConquerStorageYard?.ensureForWell?.();ensureBorderEntrySelection();syncPrimaryRoadBridges();
  for(const structure of State.structures)if(window.ConquerIndustries?.is(structure))window.ConquerIndustries.normalizeFootprint(structure);
  if(State.village.founded)connectBorderMainRoadsInFrames(()=>{markDirty(true,['ground','base']);renderUI();draw()});
  rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork();syncCompletedTowerWallColliders(true);reconcileGateMainConnections(true);
  reconcileSettlementAccessRoads(Infinity,true);invalidateSceneCache();
}
function loadLocal(){if(window.__CONQUER_REGIONAL_DEMO__)return;let raw=null;try{const key=localStorageKey();raw=localStorage.getItem(key);const x=JSON.parse(raw||'null');if(x){window.ConquerHaulage?.reset?.();State.seed=x.seed??State.seed;State.stonePaletteId=window.ConquerStoneColor?.normalized(x.stonePaletteId)||'gray';State.buildMasonryMaterial=x.buildMasonryMaterial==='brick'?'brick':'stone';State.economy=x.economy||null;State.diplomacy=x.diplomacy||null;State.biome=BIOMES[x.biome]?x.biome:State.biome;restoreSavedSeason(x);State.neighborBiomes=x.neighborBiomes||{};State.combat=x.combat||null;const socialMigration=window.ConquerSocialClasses?.migrateSave?.(x.structures||[],State.economy,{alreadyV2:x.village?.socialSchemaVersion===2});if(socialMigration)State.economy=socialMigration.economy;State.structures=migrateStructures(socialMigration?.structures||x.structures);window.ConquerSiege?.restore(x.siege);restoreSavedResources(x.resources);if(x.view&&Number.isFinite(x.view.rotation))State.view.rotation=((x.view.rotation%4)+4)%4;State.policies={...State.policies,...x.policies};State.heraldry=x.heraldry||null;restoreSavedVillage(x.village);State.clock.day=Math.max(0,Number(x.clock?.day)||0);State.clock.speed=0;State.clock.lastSpeed=1;State.daylightOverride=null;State.weatherOverride=null;resetLegacyVillageGrowth();if(State.village.founded){
    window.ConquerEconomy?.foundingCharter?.(State.village.wellId||State.structures.find(s=>s.type==='well')?.id);
    window.ConquerEconomy?.applyDevFloor?.(loadResourceFloor());
    window.ConquerEconomy?.syncBuilderResources?.();
  }else State.resources={...PROVISIONAL_RESOURCES};
  window.ConquerSiege?.syncAutoMastio?.();const landscapeResult=restoreSavedLandscape(x.landscape);if(landscapeResult.missing)saveLocal();reconcileLoadedSettlement();['tax','rations'].forEach(k=>document.getElementById(k).value=State.policies[k])}}catch(err){console.warn('Local state ignored',err);if(raw)markLoadFailed(raw,err)}}
async function initSupabase(){if(window.__CONQUER_ASSET_LAB__)return;if(window.__CONQUER_REGIONAL_DEMO__)return;if(window.__CONQUER_CAMP_MODE__){document.getElementById('dbNote').textContent='CAMP Â· Salvataggio locale separato';return;}for(let i=0;i<30&&!window.__createSupabaseClient;i++)await new Promise(r=>setTimeout(r,50));if(!window.__createSupabaseClient)return;State.supabase=window.__createSupabaseClient(SUPABASE_URL,SUPABASE_KEY);const {data}=await State.supabase.auth.getSession();State.user=data?.session?.user||null;if(State.user){document.getElementById('dbNote').textContent='Supabase authenticated â€” loading cloud save.';document.getElementById('saveState').textContent='cloud loading';if(await loadCloud())document.getElementById('dbNote').textContent='Supabase authenticated â€” cloud save enabled.'}else document.getElementById('dbNote').textContent='Local autosave active. Sign-in can be added next; RLS already protects cloud rows.'}
// A write needs a successful read for this account and this read generation.
let cloudRead={status:'idle',userId:null,generation:0};
function cloudReadFailed(error){
  cloudRead.status='error';console.warn('CONQUER cloud load failed',error);
  document.getElementById('saveState').textContent='cloud load failed';
  status('Cloud non caricato: scrittura cloud bloccata. Ricarica per riprovare; la partita locale resta disponibile.');
}
async function loadCloud(){if(window.__CONQUER_REGIONAL_DEMO__||window.__CONQUER_ASSET_LAB__||window.__CONQUER_CAMP_MODE__||!State.user)return false;
  const owner=State.user.id,seed=State.seed,generation=cloudRead.generation+1;
  cloudRead={status:'loading',userId:owner,generation};
  let result;
  try{result=await State.supabase.from('settlements').select('*').eq('world_cell_x',0).eq('world_cell_y',0).maybeSingle()}
  catch(error){if(generation===cloudRead.generation)cloudReadFailed(error);return false}
  if(generation!==cloudRead.generation||owner!==State.user?.id||seed!==State.seed){
    if(generation===cloudRead.generation)cloudRead.status='error';
    return false;
  }
  const {data,error}=result;
  if(error){cloudReadFailed(error);return false}
  if(data){const saved=window.ConquerSaveSnapshot.fromCloud(data);let repairedLandscape=false;try{window.ConquerHaulage?.reset?.();State.seed=saved.seed;State.stonePaletteId=window.ConquerStoneColor?.normalized(data.policies?.stonePaletteId)||'gray';State.buildMasonryMaterial=data.policies?.buildMasonryMaterial==='brick'?'brick':'stone';State.biome=BIOMES[saved.biome]?saved.biome:State.biome;State.neighborBiomes=saved.neighborBiomes||{};State.structures=saved.structures||[];window.ConquerSiege?.restore(data.policies?.siege);restoreSavedResources(saved.resources);if(saved.view&&Number.isFinite(saved.view.rotation))State.view.rotation=((saved.view.rotation%4)+4)%4;const cloudPolicies=data.policies||{};State.economy=cloudPolicies.economy||null;const socialMigration=window.ConquerSocialClasses?.migrateSave?.(State.structures,State.economy,{alreadyV2:cloudPolicies.village?.socialSchemaVersion===2});if(socialMigration)State.economy=socialMigration.economy;State.structures=migrateStructures(socialMigration?.structures||State.structures);State.diplomacy=cloudPolicies.diplomacy||null;State.combat=cloudPolicies.combat||null;State.heraldry=cloudPolicies.heraldry||State.heraldry||null;window.ConquerCombat?.restore(State.combat);State.policies={...State.policies,tax:cloudPolicies.tax??State.policies.tax,rations:cloudPolicies.rations??State.policies.rations,levy:cloudPolicies.levy??State.policies.levy,crenelStyle:cloudPolicies.crenelStyle??State.policies.crenelStyle,roofPitch:cloudPolicies.roofPitch??State.policies.roofPitch,unitHelmet:cloudPolicies.unitHelmet??State.policies.unitHelmet,unitShield:cloudPolicies.unitShield??State.policies.unitShield};restoreSavedSeason(cloudPolicies);restoreSavedVillage(cloudPolicies.village);State.clock.day=Math.max(0,Number(cloudPolicies.clock?.day)||State.clock.day);
  State.daylightOverride=null;State.weatherOverride=null;
  resetLegacyVillageGrowth();if(State.village.founded){
    window.ConquerEconomy?.foundingCharter?.(State.village.wellId||State.structures.find(s=>s.type==='well')?.id);
    window.ConquerEconomy?.applyDevFloor?.(loadResourceFloor());
    window.ConquerEconomy?.syncBuilderResources?.();
  }else State.resources={...PROVISIONAL_RESOURCES};
  window.ConquerSiege?.syncAutoMastio?.();repairedLandscape=restoreSavedLandscape(cloudPolicies.landscape,{repair:true}).repaired;reconcileLoadedSettlement()}catch(err){cloudRead.status='error';markLoadFailed(JSON.stringify(data),err);return false}State.loadFailed=false;cloudRead.status='ready';if(repairedLandscape)await saveCloud();else if(saveLocal())document.getElementById('saveState').textContent='saved local';renderUI();renderFunctionPanel();draw()}else{cloudRead.status='ready';document.getElementById('saveState').textContent='unsaved'}return true}
function captureSettlementSave(){
  window.ConquerEconomy?.syncBuilderResources?.();
  return window.ConquerSaveSnapshot.capture(State,{schema:LOCAL_STORAGE_SCHEMA,
    landscapeVersion:LANDSCAPE_GENERATION_VERSION,combat:window.ConquerCombat?.serialize()||State.combat});
}
let cloudSaveTail=Promise.resolve(),latestCloudRequest=0;
function sameSaveWorld(job){
  return State.seed===job.seed&&State.village===job.village&&State.user?.id===job.userId&&State.supabase===job.client&&cloudRead.status==='ready'&&cloudRead.userId===job.userId&&cloudRead.generation===job.generation;
}
async function saveCloud(){
  if(window.__CONQUER_ASSET_LAB__)return false;
  if(window.__CONQUER_REGIONAL_DEMO__){State.dirty=false;return false}
  if(saveBlocked()){status('Salvataggio bloccato: la partita salvata non Ã¨ stata caricata ed Ã¨ conservata. Avvia una nuova mappa per salvare di nuovo.');return false}
  let snapshot;
  try{snapshot=captureSettlementSave()}catch(error){reportLocalSaveFailure(error);return false}
  const localSaved=saveLocal(snapshot);
  if(window.__CONQUER_CAMP_MODE__||!State.user){
    if(localSaved){
      document.getElementById('saveState').textContent=window.__CONQUER_CAMP_MODE__?'saved camp local':'saved local';
      State.dirty=false;
    }
    return localSaved;
  }
  if(cloudRead.status!=='ready'||cloudRead.userId!==State.user.id){
    document.getElementById('saveState').textContent='cloud save blocked';
    status('Scrittura cloud bloccata: caricamento cloud non completato. Ricarica per riprovare.');return false;
  }
  const job={snapshot,request:++latestCloudRequest,seed:State.seed,village:State.village,userId:State.user.id,client:State.supabase,generation:cloudRead.generation};
  document.getElementById('saveState').textContent='saving cloud';
  const task=cloudSaveTail.then(async()=>{
    if(!sameSaveWorld(job))return false;
    try{
      const payload=window.ConquerSaveSnapshot.cloud(job.snapshot,{userId:job.userId});
      const {error}=await job.client.from('settlements').upsert(payload,{onConflict:'user_id,world_cell_x,world_cell_y'});
      if(error)throw error;
      if(!sameSaveWorld(job)||job.request!==latestCloudRequest)return false;
      const current=job.snapshot===captureSettlementSave();
      State.dirty=!current;document.getElementById('saveState').textContent=current?'saved cloud':'unsaved';
      return current;
    }catch(error){
      console.error(error);
      if(sameSaveWorld(job)&&job.request===latestCloudRequest){State.dirty=true;document.getElementById('saveState').textContent='cloud error'}
      return false;
    }
  });
  cloudSaveTail=task.catch(()=>{});
  return task;
}
document.getElementById('saveBtn').onclick=saveCloud;
// DEV: saved test layouts (layouts/<name>.json, the same format as the local save) replace the
// local game and reload it.
async function loadLayout(name){
  const res=await fetch('layouts/'+encodeURIComponent(name)+'.json',{cache:'no-store'});
  if(!res.ok){status('Layout '+name+' non trovato');return false}
  const text=await res.text();JSON.parse(text);
  localStorage.setItem(localStorageKey(),text);location.reload();return true;
}
document.getElementById('devLayoutLoad')?.addEventListener('click',()=>{
  const name=document.getElementById('devLayoutName')?.value||'TEST';
  if(confirm('Caricare il layout '+name+'? La partita locale attuale viene sostituita.'))loadLayout(name).catch(e=>status('Layout non valido: '+e.message));
});
