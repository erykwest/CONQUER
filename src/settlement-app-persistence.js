'use strict';
// Save migrations, persistence and cloud sync. Extracted verbatim from settlement-app.js.
function migrateStructures(list){
  const migrated=(list||[]).map(s=>{
    if(['moat','bridge'].includes(s.type))window.ConquerCrossings?.normalise(s);
    // Migrate old windmill A/B save records before industry recognition.
    if(s.type==='windmillA'||s.type==='windmillB')s.type='windmill';
    if(window.ConquerIndustries?.is(s))window.ConquerIndustries.normalizeFootprint(s);
    if(s.type==='house')s.houseLevel=houseLevel(s);
    normalizeCivicDevelopment(s);
    if(s.type==='built'){
      s.width=1;
      if(!Number.isFinite(s.length))s.length=dist(s.a,s.b);
      s.level=clamp(Math.round(Number(s.level)||1),1,2);
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
        s.woodStyle=s.woodStyle==='watchtower'?'watchtower':'palisadeTower';
        s.shape='square';s.level=1;
        s.size=s.woodStyle==='watchtower'?1:1.5;
        s.woodRoof=s.woodStyle==='watchtower'?'pitched':(s.woodRoof==='pitched'?'pitched':'open');
      }else{
        s.level=clamp(Math.round(Number(s.level)||1),1,3);
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
        s.level=clamp(Math.round(Number(s.level)||1),1,3);
        delete s.w;delete s.h;
      }
    }
    if(s.type==='road'&&s.a&&s.b&&!Number.isFinite(Number(s.length)))s.length=dist(s.a,s.b);
    if(s.type==='well')delete s.construction;
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

    if(['tower','gate','built'].includes(s.type)){normalizeFunctions(s);window.ConquerSiege?.sanitizeRooms(s)}
    return s;
  });

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
      if(s.shape==='square')s.angle=attachment.angle;
      s.subtowerSocket=attachment.subtowerSocket;
      s.subtowerAngle=attachment.subtowerAngle;
    }
  }
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
let localSaveTimer=null;
function saveLocal(){
  if(window.__CONQUER_ASSET_LAB__)return;
  window.ConquerEconomy?.syncBuilderResources?.();
  const t0=performance.now();
  try{localStorage.setItem(localStorageKey(),JSON.stringify({schema:LOCAL_STORAGE_SCHEMA,ambientAutoV1:true,buildMasonryMaterial:State.buildMasonryMaterial,seed:State.seed,biome:State.biome,season:State.season,seasonOverride:State.seasonOverride||null,neighborBiomes:State.neighborBiomes,landscape:{version:LANDSCAPE_GENERATION_VERSION,relief:State.relief,environment:State.environment},structures:State.structures,resources:State.resources,economy:State.economy||null,diplomacy:State.diplomacy||null,siege:State.siege||null,policies:State.policies,heraldry:State.heraldry||null,village:State.village,clock:{day:State.clock.day,speed:0},view:State.view,combat:window.ConquerCombat?.serialize()||State.combat}));}catch(error){
    console.warn('CONQUER local save failed',error);
    const indicator=document.getElementById('saveState');if(indicator)indicator.textContent='local save failed';
    window.__conquerAnalytics?.event?.('LOCAL_SAVE_ERROR',{message:String(error)},'error',30000);
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
function loadLocal(){try{const key=localStorageKey();const x=JSON.parse(localStorage.getItem(key)||'null');if(x){State.seed=x.seed??State.seed;State.buildMasonryMaterial=x.buildMasonryMaterial==='brick'?'brick':'stone';State.economy=x.economy||null;State.diplomacy=x.diplomacy||null;State.biome=BIOMES[x.biome]?x.biome:State.biome;State.season=['summer','autumn','winter','spring'].includes(x.season)?x.season:'summer';State.seasonOverride=['summer','autumn','winter','spring'].includes(x.seasonOverride)&&(x.ambientAutoV1===true||x.seasonOverride!=='summer')?x.seasonOverride:null;State.neighborBiomes=x.neighborBiomes||{};State.combat=x.combat||null;State.structures=migrateStructures(x.structures);window.ConquerSiege?.restore(x.siege);State.resources={...State.resources,...x.resources};for(const k of Object.keys(State.resources))State.resources[k]=Math.max(loadResourceFloor(),Number(State.resources[k])||0);if(x.view&&Number.isFinite(x.view.rotation))State.view.rotation=((x.view.rotation%4)+4)%4;State.policies={...State.policies,...x.policies};State.heraldry=x.heraldry||null;const legacyGrowth=x.village?.growthVersion!==3;State.village={...State.village,...x.village};if(legacyGrowth)State.village.growthVersion=1;State.village.privateMasonryMaterial=State.village.privateMasonryMaterial==='brick'?'brick':'stone';State.clock.day=Math.max(0,Number(x.clock?.day)||0);State.clock.speed=0;State.clock.lastSpeed=1;State.daylightOverride=null;State.weatherOverride=null;resetLegacyVillageGrowth();if(State.village.founded){
    window.ConquerEconomy?.foundingCharter?.(State.village.wellId||State.structures.find(s=>s.type==='well')?.id);
    window.ConquerEconomy?.applyDevFloor?.(loadResourceFloor());
    window.ConquerEconomy?.syncBuilderResources?.();
  }else State.resources={...PROVISIONAL_RESOURCES};
  window.ConquerSiege?.syncAutoMastio?.();const savedLandscape=x.landscape;if(savedLandscape?.version===LANDSCAPE_GENERATION_VERSION&&Array.isArray(savedLandscape.relief?.hills)&&Array.isArray(savedLandscape.environment)){State.relief=savedLandscape.relief;State.environment=savedLandscape.environment;clearReliefBandCache()}else{State.relief=null;State.environment=[];ensureStaticLandscape();saveLocal()}ensureBorderEntrySelection();syncPrimaryRoadBridges();for(const structure of State.structures)if(window.ConquerIndustries?.is(structure))window.ConquerIndustries.normalizeFootprint(structure);if(State.village.founded)connectBorderMainRoadsInFrames(()=>{markDirty(true,['ground','base']);renderUI();draw()});rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork();syncCompletedTowerWallColliders(true);reconcileGateMainConnections(true);reconcileSettlementAccessRoads(Infinity,true);invalidateSceneCache();['tax','rations','levy'].forEach(k=>document.getElementById(k).value=State.policies[k])}}catch(err){console.warn('Local state ignored',err);}}
async function initSupabase(){if(window.__CONQUER_ASSET_LAB__)return;if(window.__CONQUER_CAMP_MODE__){document.getElementById('dbNote').textContent='CAMP · Salvataggio locale separato';return;}for(let i=0;i<30&&!window.__createSupabaseClient;i++)await new Promise(r=>setTimeout(r,50));if(!window.__createSupabaseClient)return;State.supabase=window.__createSupabaseClient(SUPABASE_URL,SUPABASE_KEY);const {data}=await State.supabase.auth.getSession();State.user=data?.session?.user||null;if(State.user){document.getElementById('dbNote').textContent='Supabase authenticated — cloud save enabled.';document.getElementById('saveState').textContent='cloud ready';await loadCloud()}else document.getElementById('dbNote').textContent='Local autosave active. Sign-in can be added next; RLS already protects cloud rows.'}
async function loadCloud(){if(!State.user)return;const {data,error}=await State.supabase.from('settlements').select('*').eq('world_cell_x',0).eq('world_cell_y',0).maybeSingle();if(error){console.warn(error);return}if(data){State.seed=data.terrain_seed;State.buildMasonryMaterial=data.policies?.buildMasonryMaterial==='brick'?'brick':'stone';State.biome=BIOMES[data.biome]?data.biome:State.biome;State.neighborBiomes=data.neighbor_biomes||{};State.structures=migrateStructures(data.structures);window.ConquerSiege?.restore(data.policies?.siege);State.resources={...State.resources,...data.resources};for(const k of Object.keys(State.resources))State.resources[k]=Math.max(loadResourceFloor(),Number(State.resources[k])||0);if(data.camera&&Number.isFinite(data.camera.rotation))State.view.rotation=((data.camera.rotation%4)+4)%4;const cloudPolicies=data.policies||{};State.economy=cloudPolicies.economy||null;State.diplomacy=cloudPolicies.diplomacy||null;State.combat=cloudPolicies.combat||null;State.heraldry=cloudPolicies.heraldry||State.heraldry||null;window.ConquerCombat?.restore(State.combat);State.policies={...State.policies,tax:cloudPolicies.tax??State.policies.tax,rations:cloudPolicies.rations??State.policies.rations,levy:cloudPolicies.levy??State.policies.levy};State.season=['summer','autumn','winter','spring'].includes(cloudPolicies.season)?cloudPolicies.season:'summer';State.seasonOverride=['summer','autumn','winter','spring'].includes(cloudPolicies.seasonOverride)&&(cloudPolicies.ambientAutoV1===true||cloudPolicies.seasonOverride!=='summer')?cloudPolicies.seasonOverride:null;const legacyGrowth=cloudPolicies.village?.growthVersion!==3;State.village={...State.village,...(cloudPolicies.village||{})};if(legacyGrowth)State.village.growthVersion=1;State.village.privateMasonryMaterial=State.village.privateMasonryMaterial==='brick'?'brick':'stone';State.clock.day=Math.max(0,Number(cloudPolicies.clock?.day)||State.clock.day);
  State.daylightOverride=null;State.weatherOverride=null;
  resetLegacyVillageGrowth();if(State.village.founded){
    window.ConquerEconomy?.foundingCharter?.(State.village.wellId||State.structures.find(s=>s.type==='well')?.id);
    window.ConquerEconomy?.applyDevFloor?.(loadResourceFloor());
    window.ConquerEconomy?.syncBuilderResources?.();
  }else State.resources={...PROVISIONAL_RESOURCES};
  window.ConquerSiege?.syncAutoMastio?.();const cloudLandscape=cloudPolicies.landscape;let repairedLandscape=false;if(cloudLandscape?.version===LANDSCAPE_GENERATION_VERSION&&Array.isArray(cloudLandscape.relief?.hills)&&Array.isArray(cloudLandscape.environment)){State.relief=cloudLandscape.relief;State.environment=cloudLandscape.environment;clearReliefBandCache();repairedLandscape=ensureStaticLandscape()}else{State.relief=null;State.environment=[];ensureStaticLandscape();repairedLandscape=true}ensureBorderEntrySelection();syncPrimaryRoadBridges();for(const structure of State.structures)if(window.ConquerIndustries?.is(structure))window.ConquerIndustries.normalizeFootprint(structure);if(State.village.founded)connectBorderMainRoadsInFrames(()=>{markDirty(true,['ground','base']);renderUI();draw()});rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork();syncCompletedTowerWallColliders(true);reconcileGateMainConnections(true);reconcileSettlementAccessRoads(Infinity,true);invalidateSceneCache();if(repairedLandscape)await saveCloud();else saveLocal();renderUI();renderFunctionPanel();draw()}}
async function saveCloud(){saveLocal();if(window.__CONQUER_CAMP_MODE__){document.getElementById('saveState').textContent='saved camp local';State.dirty=false;return;}if(!State.user){document.getElementById('saveState').textContent='saved local';State.dirty=false;return}const payload={user_id:State.user.id,world_cell_x:0,world_cell_y:0,terrain_seed:State.seed,biome:State.biome,neighbor_biomes:State.neighborBiomes,resources:State.resources,policies:{...State.policies,ambientAutoV1:true,buildMasonryMaterial:State.buildMasonryMaterial,economy:State.economy||null,diplomacy:State.diplomacy||null,siege:State.siege||null,combat:window.ConquerCombat?.serialize()||State.combat,heraldry:State.heraldry||null,season:State.season,seasonOverride:State.seasonOverride||null,village:State.village,clock:{day:State.clock.day},landscape:{version:LANDSCAPE_GENERATION_VERSION,relief:State.relief,environment:State.environment}},structures:State.structures,camera:State.view,updated_at:new Date().toISOString()};const {error}=await State.supabase.from('settlements').upsert(payload,{onConflict:'user_id,world_cell_x,world_cell_y'});if(error){document.getElementById('saveState').textContent='cloud error';console.error(error)}else{State.dirty=false;document.getElementById('saveState').textContent='saved cloud'}}
document.getElementById('saveBtn').onclick=saveCloud;
