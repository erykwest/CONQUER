'use strict';
// CONQUER settlement core module — classic-script shared runtime.
const canvas=document.getElementById('c'),weatherCanvas=document.getElementById('weatherCanvas'),weatherCloudLayer=document.getElementById('weatherCloudLayer'),wrap=document.getElementById('wrap');
let ctx=canvas.getContext('2d');
const screenCtx=ctx;
const weatherCtx=weatherCanvas?weatherCanvas.getContext('2d'):null;
const sceneCache={
  // Keep immutable world art completely separate from settlement topology.
  // Terrain/environment is expensive (hundreds of rocks/relief bands) but only
  // changes with landscape/season/projection, not when a house or road completes.
  landscape:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null,gpuDirty:true},
  ground:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null,gpuDirty:true},
  shadow:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null,gpuDirty:true},
  base:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null,gpuDirty:true},
  castleBody:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null,gpuDirty:true},
  castleFront:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null,gpuDirty:true}
};
for(const layer of Object.values(sceneCache))layer.ctx=layer.canvas.getContext('2d');
function invalidateSceneCache(layer='all'){
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheInvalidations=(perf.cacheInvalidations||0)+1;
  const layers=Array.isArray(layer)?layer:[layer];
  if(layers.includes('all')){for(const item of Object.values(sceneCache)){item.dirty=true;item.gpuDirty=true}return}
  for(const name of layers)if(sceneCache[name]){sceneCache[name].dirty=true;sceneCache[name].gpuDirty=true}
}
function invalidateSettlementScene(includeCastle=true){
  invalidateSceneCache(includeCastle?['ground','shadow','base','castleBody','castleFront']:['ground','shadow','base']);
}
function structureSceneLayers(s){
  if(!s)return['ground','shadow','base','castleBody','castleFront'];
  if(['road','moat','bridge'].includes(s.type))return['ground','base'];
  if(s.auto&&s.type==='field')return['ground'];
  if(s.type==='house')return['ground','shadow','base'];
  if(isCivicAnnex(s))return['ground','shadow','base'];
  if(window.ConquerIndustries?.is(s))return['ground','shadow','base'];
  const shadow=['house','tower','gate','wall','palisade','built','market','tavern','church'].includes(s.type)?['shadow']:[];
  if(isCastlePart(s)||isRaisedPlacementCastlePoint(s))return[...shadow,'castleBody','castleFront'];
  // Palisades and timber fortifications are rendered in the non-union base layer.
  if(s.type==='palisade'||isWoodTower(s)||isWoodGate(s))return[...shadow,'base','castleFront'];
  return[...shadow,'base'];
}
function invalidateStructureScene(s){
  invalidateSceneCache(structureSceneLayers(s));
}
function withRenderContext(next,fn){
  const prev=ctx;ctx=next;
  try{return fn()}finally{ctx=prev}
}
const STATIC_CACHE_DPR_CAP=1.5;
const STATIC_CACHE_OVERSCAN=240;
function staticCacheDpr(){return Math.min(devicePixelRatio||1,STATIC_CACHE_DPR_CAP)}
function prepareSceneCache(layer){
  const r=wrap.getBoundingClientRect(),d=staticCacheDpr(),entry=sceneCache[layer],m=STATIC_CACHE_OVERSCAN;
  const logicalW=r.width+m*2,logicalH=r.height+m*2;
  const w=Math.max(1,Math.round(logicalW*d)),h=Math.max(1,Math.round(logicalH*d));
  if(entry.canvas.width!==w||entry.canvas.height!==h){
    entry.canvas.width=w;entry.canvas.height=h;entry.dirty=true;
  }
  entry.ctx.setTransform(1,0,0,1,0,0);
  entry.ctx.clearRect(0,0,entry.canvas.width,entry.canvas.height);
  entry.gpuDirty=true;
  entry.ctx.setTransform(d,0,0,d,m*d,m*d);
  entry.view={
    x:State.view.x,y:State.view.y,scale:State.view.scale,
    rotation:State.view.rotation||0,width:r.width,height:r.height,dpr:d,overscan:m
  };
  return entry;
}
let sceneCacheZoomPreview=false;
let sceneCachePanPreview=false;
function sceneCacheProjectionCompatible(entry){
  const v=entry?.view,r=wrap.getBoundingClientRect(),d=staticCacheDpr();
  if(!v
    ||Math.abs(v.scale-State.view.scale)>=1e-9
    ||v.rotation!==(State.view.rotation||0)
    ||Math.abs(v.width-r.width)>=.5
    ||Math.abs(v.height-r.height)>=.5
    ||Math.abs(v.dpr-d)>=1e-9)return false;
  const m=Number(v.overscan)||0,limit=m*.78;
  return Math.abs(State.view.x-v.x)<=limit&&Math.abs(State.view.y-v.y)<=limit;
}
function blitSceneCache(layer){
  const r=wrap.getBoundingClientRect(),entry=sceneCache[layer],v=entry.view;
  if(!v)return;
  const m=Number(v.overscan)||0;

  // Pan keeps the original 1:1 cache translation. This preserves the overscan
  // envelope and avoids exposing/clipping the cached bitmap at the viewport edge.
  if(!sceneCacheZoomPreview){
    const dx=State.view.x-v.x,dy=State.view.y-v.y;
    screenCtx.drawImage(
      entry.canvas,
      0,0,entry.canvas.width,entry.canvas.height,
      dx-m,dy-m,r.width+m*2,r.height+m*2
    );
    return;
  }

  // Only an active wheel gesture may temporarily reproject a stale-scale cache.
  const ratio=(Number(State.view.scale)||1)/(Number(v.scale)||1);
  const dx=State.view.x+(-m-v.x)*ratio;
  const dy=State.view.y+(-m-v.y)*ratio;
  screenCtx.drawImage(
    entry.canvas,
    0,0,entry.canvas.width,entry.canvas.height,
    dx,dy,(r.width+m*2)*ratio,(r.height+m*2)*ratio
  );
}
const U=12,WORLD=200,BUILD=100,BUILD_MIN=50,BUILD_MAX=150,GRID=.5;
const ISO_X=.8660254,ISO_Y=.5,ISO_Z=.9;
const WEATHER_ZOOM_THRESHOLD=.5;
const SUPABASE_URL='https://fwpmcyxggvdtsuatovzo.supabase.co';
const SUPABASE_KEY='sb_publishable_-nHMiLTkFCVTMwBFOmFqfQ_oZUUybfv';
const initialSeed=(()=>{const k='conquer.seed.0.0';let v=localStorage.getItem(k);if(!v){v=String(Math.floor(Math.random()*2147483647));localStorage.setItem(k,v)}return Number(v)})();
const State={structures:[],environment:[],relief:null,tool:{kind:'select'},draft:null,selectedId:null,pendingWellId:null,seed:initialSeed,cell:{x:0,y:0},biome:'test',season:'summer',seasonOverride:null,weatherOverride:null,neighborBiomes:{},view:{scale:.72,x:0,y:0,rotation:0},buildLevels:{tower:1,gate:1,wall:1,wallTier:2},buildMasonryMaterial:'stone',resources:{gold:10000,population:10000,food:10000,wood:10000,stone:10000,clay:10000,metal:10000,equipment:10000},policies:{tax:25,rations:50,levy:10},village:{name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,growthStep:0,privateMasonryMaterial:'stone',nextGrowthDay:null,roadPlan:null,roadPlanVersion:0,borderEntries:null,baseRoadAngle:null},clock:{day:0,speed:0,lastSpeed:1},daylightOverride:null,dirty:false,supabase:null,user:null};
// DEV VISUAL PALETTE BEGIN: presentation only; never change structure material/cost/HP.
const DEV_VISUAL_PALETTE_KEY='conquer.dev.visualPalette.v1';
State.visualPalette=(()=>{try{return localStorage.getItem(DEV_VISUAL_PALETTE_KEY)==='clay'?'clay':'stone'}catch{return'stone'}})();
const CLAY_VISUAL_SWATCHES=Object.freeze({
  '#9a8e82':'#be7254',
  '#635951':'#98523e',
  '#514a44':'#763b30',
  '#887d72':'#ad654b',
  '#554d46':'#804130',
  '#403b36':'#653226',
  '#9f9183':'#c18260',
  '#c8b9a9':'#dc9b78',
  '#918579':'#b87355',
  '#605750':'#98503c',
  '#4a443e':'#75392d',
  '#b3a596':'#d18e6d',
  '#948779':'#b77357',
  '#625a52':'#9c5540',
  '#4b4540':'#743c2f',
  '#8f857a':'#b77558',
  '#82776c':'#9d563f',
  '#61574f':'#824332',
  '#5a514a':'#774032',
  '#49443f':'#774034',
  '#686057':'#a35b46',
  '#84796d':'#b37355',
  '#4e4740':'#7d4232',
  '#5d554d':'#97523d',
  '#88796b':'#b67456',
  '#62584f':'#995741',
  '#8c7b69':'#b67354',
  '#554b42':'#824432',
  '#66594d':'#a45a44',
  '#9f9285':'#c18665',
  '#8d877c':'#b97758',
  '#716c64':'#96513d',
  '#7f796f':'#af6c50',
  '#4c4842':'#783d31',
  '#5a554d':'#8d4837',
  '#a59b8d':'#c58a6a',
  '#b8aa99':'#d09270',
  '#676a6c':'#b66e51',
  '#66635f':'#93503d',
  '#77736e':'#a85d46',
  '#6b6863':'#a96047',
  '#7d7973':'#b87559',
  '#85817a':'#c07c5c',
  '#696862':'#96513e',
  '#777671':'#ae684d',
  '#85847d':'#bb7456',
  '#625e59':'#ae664d',
  '#4f4b47':'#864330',
  '#303237':'#a94e36',
  '#3a3d42':'#bf6345',
  '#303943':'#a44c34',
  '#394550':'#c06946',
  '#34363a':'#a85239',
  '#42454a':'#c26a4a',
  '#303236':'#99442f',
  '#44474c':'#cb7350',
  '#3d4145':'#ab5038',
  '#484c50':'#c26b49',
  '#41454a':'#ae573d',
  '#4c5054':'#c4714c',
  '#595a60':'#b35d40',
  '#3b302b':'#a85037',
  '#493930':'#bd6647'
});
let structureVisualMaterial=null;
function masonryMaterial(s){
  if(!s||s.material==='wood'||s.type==='palisade'||s.type==='road'||s.type==='moat'||(s.type==='bridge'&&s.variant!=='stone'))return null;
  return s.masonryMaterial==='brick'?'brick':'stone';
}
function withStructureVisualMaterial(s,paint){
  const previous=structureVisualMaterial;
  structureVisualMaterial=masonryMaterial(s);
  try{return paint()}finally{structureVisualMaterial=previous}
}
function visualPaletteColor(color){
  if(typeof color!=='string')return color;
  return (State.visualPalette==='clay'||structureVisualMaterial==='brick')
    ?CLAY_VISUAL_SWATCHES[color.toLowerCase()]||color:color;
}
// DEV VISUAL PALETTE END
const STRUCTURE_ANGLE_STEP_DEG=15;
const STRUCTURE_ANGLE_STEPS=360/STRUCTURE_ANGLE_STEP_DEG;
const STRUCTURE_ANGLE_STEP=Math.PI*2/STRUCTURE_ANGLE_STEPS;
function normalizeStructureAngle(angle){
  const tau=Math.PI*2;
  return((Number(angle)||0)%tau+tau)%tau;
}
function structureRotationStep(angle){
  return((Math.round(normalizeStructureAngle(angle)/STRUCTURE_ANGLE_STEP)%STRUCTURE_ANGLE_STEPS)+STRUCTURE_ANGLE_STEPS)%STRUCTURE_ANGLE_STEPS;
}
function structureAngleFromStep(step){
  const n=((Math.round(Number(step)||0)%STRUCTURE_ANGLE_STEPS)+STRUCTURE_ANGLE_STEPS)%STRUCTURE_ANGLE_STEPS;
  return n*STRUCTURE_ANGLE_STEP;
}
function snapStructureAngle(angle){return structureAngleFromStep(structureRotationStep(angle))}
function structureUsesDiscreteAngle(s){
  return !!s&&['tower','gate','house','market','tavern','church','training','plaza'].includes(s.type);
}
function applyStructureRotation(s,angle=s?.angle||0){
  if(!s)return 0;
  const step=structureRotationStep(angle);
  s.rotationStep=step;
  s.angle=structureAngleFromStep(step);
  return s.angle;
}
function normalizeStructureRotation(s){
  if(structureUsesDiscreteAngle(s))applyStructureRotation(s,Number.isFinite(Number(s.angle))?Number(s.angle):0);
  return s;
}
const TYPES={wall:{min:1,max:8},palisade:{min:1,max:8},built:{width:1,min:1,max:4},road:{width:.62,min:1,max:160}};
const WALL_TIERS=Object.freeze({1:.2,2:.5,3:1});
const SQUARE_TOWER_TIERS=Object.freeze({1:1,2:1.5,3:2});
const ROUND_TOWER_TIERS=Object.freeze({1:.5,2:.75,3:1});
const COSTS={
  tower:[{gold:45,stone:55,wood:12},{gold:75,stone:95,wood:20},{gold:120,stone:155,wood:32}],
  woodTower:[{gold:18,wood:42},{gold:32,wood:78}],
  wallPerU:{gold:6,stone:18,wood:2},
  palisadePerU:{gold:3,wood:12},
  builtPerU:{gold:12,stone:16,wood:18},
  gate:{gold:95,stone:90,wood:38,metal:10},
  woodGate:{gold:35,wood:90,metal:4},
  well:{gold:50,stone:35,wood:10},
  market:{gold:120,stone:70,wood:85},
  tavern:{gold:190,stone:65,wood:145},
  church:{gold:320,stone:360,wood:110,metal:18},
  plaza:{gold:90,stone:80,wood:10},
  training:{gold:90,stone:24,wood:70}
};
const BUILD_DAYS={tower:[4,7,11],woodTower:[2.5,4],gate:9,woodGate:4,well:0,market:4,tavern:6,church:10,plaza:3,training:3.5,wallBase:.7,wallPerU:.45,palisadeBase:.45,palisadePerU:.30,builtBase:2,builtPerU:1.5,road:1,house:2.2,field:1.5};
const GROWTH_INTERVAL_DAYS=2.5;
// One simulated 24-hour day lasts 48 real seconds at 1×.
// All time controls multiply this common rate (3× = 16 s/day; 10× = 4.8 s/day; 100× = 0.48 s/day).
const BASE_DAYS_PER_SECOND=1/48;
// Villager routines and procedural daylight use the same simulated day as crops,
// seasons and the calendar (a full visual day now takes 48 s at 1×).
const PEASANT_VISUAL_SPEED=1;
// The simulated calendar fraction is a true clock: 0 = midnight, .5 = noon.
// Sunrise/sunset are civil hours. Spring and autumn intentionally share 06–18.
const SEASONAL_SUN_HOURS=Object.freeze({
  spring:Object.freeze({sunrise:6,sunset:18}),
  summer:Object.freeze({sunrise:5,sunset:21}),
  autumn:Object.freeze({sunrise:6,sunset:18}),
  winter:Object.freeze({sunrise:8,sunset:16})
});
function solarHours(season=State.season){
  return SEASONAL_SUN_HOURS[season]||SEASONAL_SUN_HOURS.spring;
}
const SOLAR_TWILIGHT_HOURS=1;
const NIGHT_OVERLAY_MAX=.48;
const BATTLEMENT_SPACING=.62;
const CHIMNEY_SPACING=1.5;
const WELL_PLAZA_SIZE=3;
// The paved square around the well is a no-build zone: houses, lots, fields and buildings
// keep out of it (roads may still cross it).
function wellPlazaPoints(s){return rectWorldPoints(s.x,s.y,WELL_PLAZA_SIZE,WELL_PLAZA_SIZE,0)}
const LINEAR_POINT_MAGNET=.90;
const TOWER_WALL_MAGNET=.78;
const SUBTOWER_MAGNET=1.0;
const WALL_BREAK_MIN=.10;

// Builder Geometry V2 — visual variants are data, not separate structure types.
// Geometry/cost/functions stay on the structure; appearance is selected here.
const STRUCTURE_VARIANT_VERSION=2;
const STRUCTURE_VARIANTS=Object.freeze({
  tower:Object.freeze({
    roofStyle:Object.freeze(['battlement','machicolation','pitched']),
    baseStyle:Object.freeze(['standard','buttress','splayed'])
  }),
  gate:Object.freeze({
    roofStyle:Object.freeze(['battlement','pitched','flat'])
  }),
  wall:Object.freeze({
    skin:Object.freeze(['standard','machicolation','hoarding'])
  }),
  built:Object.freeze({
    skin:Object.freeze(['standard','arcade'])
  })
});
const STRUCTURE_VARIANT_DEFAULTS=Object.freeze({
  tower:Object.freeze({roofStyle:'battlement',baseStyle:'standard'}),
  gate:Object.freeze({roofStyle:'battlement'}),
  wall:Object.freeze({skin:'standard'}),
  built:Object.freeze({skin:'standard'})
});
const PEASANT_PALETTE=Object.freeze([
  '#6f5135','#87613c','#9a713f','#b08a55','#c1a779',
  '#756b3f','#6f7a45','#82924c','#9aa556','#b0ad63'
]);
const ARTISAN_PALETTE=Object.freeze(['#765641','#8a6848','#6f7252','#707b70','#7f665b','#8b7755']);
const MERCHANT_PALETTE=Object.freeze(['#a63e32','#355f9c','#c59a2d','#4f873e','#754d8c','#b86b2d']);
const ELITE_PALETTE=Object.freeze(['#e34838','#3479d3','#f0bf2f','#62b94e','#a45fcb','#ef8731']);
const HAIR_COLORS=Object.freeze({
  blonde:'#d5b65a',brown:'#65452f',black:'#262321',gray:'#9a9891',red:'#9b4a2d'
});
const VILLAGER_SKIN='#d99a83';
const REIGN_COLOR_1='#b53636';
const REIGN_COLOR_2='#355fb8';
const REIGN_COLOR_1_DARK='#7f2323';
const REIGN_COLOR_2_DARK='#243f79';
const FIRE_GOLD='#f2b14a';
const FIRE_CORE='#ffe08a';
const ROAD_RULES={
  arterialSegmentMin:4.2,arterialSegmentMax:5.4,
  localSegmentMin:2.8,localSegmentMax:4.2,
  minParallelSpacing:2.2,minNodeSpacing:1.25,minJunctionAngle:25*Math.PI/180,
  branchSpawnSpacing:1.6,snapNodeDistance:1.15
};
const BIOMES=Object.freeze({
  test:{label:'TEST',field:'#2a2818'},
  plains:{label:'Pianura',field:'#2a2818'},
  hills:{label:'Colline',field:'#2f2a19'},
  valley:{label:'Vallata',field:'#28271a'},
  river:{label:'Fiume',field:'#24271c'},
  forest:{label:'Foresta',field:'#1f2516'},
  mountains:{label:'Montagne',field:'#2b2620'},
  sea:{label:'Mare',field:'#2a2818'}
});
const FUNCTION_CATALOG=['guard','barracks','armory','storage','granary','kitchen','stables','nobleRoom','workshop','chapel','commonHall','throneHall','treasury','prison'];
const FUNCTION_LABELS={guard:'Guard post',barracks:'Barracks',armory:'Armory',storage:'Materials store',granary:'Granary',kitchen:'Kitchen',stables:'Stables',quarters:'Quarters',nobleRoom:'Noble chambers',workshop:'Armament workshop',chapel:'Chapel',commonHall:'Common hall',throneHall:'Throne hall',treasury:'Treasury',prison:'Prison'};
const uid=()=>crypto.randomUUID?.()||('id-'+Date.now()+'-'+Math.random());
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const snapGrid=v=>Math.round(v/GRID)*GRID;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const status=t=>document.getElementById('status').textContent=t;
const RES_ORDER=['gold','stone','clay','wood','metal'];
function roundCost(cost){const out={};for(const [k,v] of Object.entries(cost||{}))if(v>0)out[k]=Math.max(1,Math.ceil(v));return out}
function variantSchema(s){return s&&STRUCTURE_VARIANTS[s.type]||null}
function variantDefaults(s){return s&&STRUCTURE_VARIANT_DEFAULTS[s.type]||null}
function structureVariant(s,key){
  const schema=variantSchema(s),defs=variantDefaults(s);
  if(!schema||!schema[key])return undefined;
  return schema[key].includes(s?.[key])?s[key]:defs[key];
}
function normalizeStructureVariants(s){
  const schema=variantSchema(s),defs=variantDefaults(s);
  if(!schema||!defs)return s;
  for(const [key,allowed] of Object.entries(schema)){
    if(!allowed.includes(s[key]))s[key]=defs[key];
  }
  s.variantVersion=STRUCTURE_VARIANT_VERSION;
  return s;
}
function setStructureVariant(s,key,value){
  const schema=variantSchema(s);
  if(!schema||!schema[key]||!schema[key].includes(value))return false;
  s[key]=value;
  s.variantVersion=STRUCTURE_VARIANT_VERSION;
  return true;
}
function towerRoofStyle(s){return s?.type==='tower'?structureVariant(s,'roofStyle'):undefined}
function towerBaseStyle(s){
  if(!s||s.type!=='tower'||isWoodTower(s))return undefined;
  return structureVariant(s,'baseStyle')||'standard';
}
function isWoodTower(s){return !!s&&s.type==='tower'&&s.material==='wood'}
function woodTowerStyle(s){return isWoodTower(s)?(s.woodStyle==='watchtower'?'watchtower':'palisadeTower'):undefined}
function woodTowerRoof(s){
  if(!isWoodTower(s))return undefined;
  if(woodTowerStyle(s)==='watchtower')return'pitched';
  return s.woodRoof==='pitched'?'pitched':'open';
}
function isWoodGate(s){return !!s&&s.type==='gate'&&s.material==='wood'}
function gateRoofStyle(s){
  if(isWoodGate(s))return'flat';
  return s?.type==='gate'?structureVariant(s,'roofStyle'):undefined
}
function wallSkin(s){return s?.type==='wall'?structureVariant(s,'skin'):undefined}
function builtSkin(s){return s?.type==='built'?structureVariant(s,'skin'):undefined}
// Semantic gameplay hook: combat can query this later without depending on renderer details.
function hasMachicolation(s){
  if(!s)return false;
  if(s.type==='tower')return !isWoodTower(s)&&towerRoofStyle(s)==='machicolation';
  if(s.type==='wall')return wallTier(s)>=2&&wallSkin(s)==='machicolation';
  return false;
}

function towerTier(s){const span=s.shape==='round'?s.r*2:s.size;return span>=1.99?3:span>=1.49?2:1}
function wallTier(s){
  const explicit=Math.round(Number(s?.tier));
  if(explicit>=1&&explicit<=3)return explicit;
  const w=Number(s?.width)||.5;
  return w>=.75?3:w>=.35?2:1;
}
function wallWidthForTier(t){return WALL_TIERS[clamp(Math.round(Number(t)||2),1,3)]}
function towerSizeForTier(shape,t){t=clamp(Math.round(Number(t)||1),1,3);return shape==='round'?ROUND_TOWER_TIERS[t]:SQUARE_TOWER_TIERS[t]}
function applyStructureTier(s,tier){
  tier=clamp(Math.round(Number(tier)||1),1,3);
  s.tier=tier;
  if(['wall','palisade'].includes(s.type)){
    s.width=wallWidthForTier(tier);
    if(s.type==='wall'&&tier===1&&wallSkin(s)==='machicolation')s.skin='standard';
  }
  else if(s.type==='tower'){
    if(s.shape==='round')s.r=towerSizeForTier('round',tier);
    else s.size=towerSizeForTier('square',tier);
  }
  normalizeFunctions(s);return s
}
function structureLevel(s){
  if(isWoodGate(s))return 1;
  return clamp(Math.round(Number(s?.level)||1),1,['tower','gate'].includes(s?.type)?3:2)
}
function houseLevel(s){return clamp(Math.round(Number(s?.houseLevel)||1),1,4)}
// Independent local X/Y scale in [0.8, 1.2], seeded by the stable house ID.
// The geometry is derived (never saved as another mutable dimension), so
// existing saves and reloads always give the same dimensions.
function houseDimensionScale(house,axis,part='main'){
  const id=typeof house==='string'?house:(house?.id||'house');
  // Avalanche FNV output: suffix-only X/Y keys would otherwise be highly
  // correlated and make every building grow/shrink in both axes together.
  let hash=peasantHash(id+'|dimension|'+part+'|'+axis)>>>0;
  hash^=hash>>>16;hash=Math.imul(hash,0x7feb352d);
  hash^=hash>>>15;hash=Math.imul(hash,0x846ca68b);
  hash^=hash>>>16;
  return .8+.4*((hash>>>0)/4294967295);
}
function houseFootprintDimensions(s){
  return{
    w:(Number(s.w)||1.5)*houseDimensionScale(s,'x'),
    h:(Number(s.h)||1)*houseDimensionScale(s,'y')
  };
}
function housePlanType(s){return (peasantHash(s?.id||'house')&1)?'L':'T'}
function houseTurretType(s){return (peasantHash((s?.id||'house')+'-turret')&1)?'round':'square'}
function houseLocalToWorld(s,x,y){
  const ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0);
  return{x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca};
}
function houseTurretInfo(s){
  if(houseLevel(s)<4)return null;
  const {w,h}=s.urbanCompact?{w:Number(s.w)||1.5,h:Number(s.h)||1}:houseFootprintDimensions(s),hash=peasantHash((s.id||'house')+'-turret-pos');
  const sx=(hash&2)?1:-1,sy=s.urbanCompact?1:(hash&4)?1:-1,type=houseTurretType(s);
  // Compact L4 keeps its turret, but positions it behind the frontage
  // instead of projecting into a neighbouring townhouse.
  const cx=s.urbanCompact?sx*w*.18:sx*w*.60,cy=sy*h*(s.urbanCompact?.65:.58);
  const center=houseLocalToWorld(s,cx,cy);
  const bodyH=2.62,roofH=3.42;
  if(type==='round'){
    const r=s.urbanCompact?Math.min(.37,w*.22,h*.33):.52;
    return{kind:'turret',type,cx,cy,center,r,bodyH,roofH,points:circleWorldPoints(center.x,center.y,r,20)};
  }
  const size=s.urbanCompact?Math.min(.70,w*.4,h*.60):.92;
  return{kind:'turret',type,cx,cy,center,size,bodyH,roofH,points:rectWorldPoints(center.x,center.y,size,size,s.angle||0)};
}
function houseFootprintParts(s){
  // Streetfront volumes have already received their independent ±20% sizes.
  const {w,h}=s.urbanCompact?{w:Number(s.w)||1.5,h:Number(s.h)||1}:houseFootprintDimensions(s);
  const parts=[{kind:'body',cx:0,cy:0,w,h,roofTurn:0}];
  if(houseLevel(s)>=3){
    const sign=(peasantHash(s.id)&2)?1:-1,plan=housePlanType(s);
    if(plan==='L'){
      parts.push({kind:'body',cx:sign*w*(s.urbanCompact?.25:.38),
        cy:h*(s.urbanCompact?.40:.56),w:w*(s.urbanCompact?.48:.55),
        h:h*(s.urbanCompact?.68:.95),roofTurn:Math.PI/2});
    }else{
      parts.push({kind:'body',cx:0,cy:h*(s.urbanCompact?.44:.62),
        w:w*(s.urbanCompact?1.04:1.18),h:h*(s.urbanCompact?.40:.48),
        roofTurn:Math.PI/2});
      parts.push({kind:'body',cx:0,cy:h*(s.urbanCompact?.72:.92),
        w:w*(s.urbanCompact?.40:.46),h:h*(s.urbanCompact?.30:.34),
        roofTurn:Math.PI/2});
    }
  }
  const out=parts.map(p=>{const q=houseLocalToWorld(s,p.cx,p.cy);return{...p,center:q,points:rectWorldPoints(q.x,q.y,p.w,p.h,s.angle||0)}});
  const turret=houseTurretInfo(s);if(turret)out.push(turret);
  return out;
}
function houseBodyHeight(s){return houseLevel(s)===1?.95:(s.auto||s.urbanCompact)&&houseLevel(s)===4?2.38:1.72}
// L2+ gabled roofs are steep (60°, medieval): the ridge rises tan(60°)·half-span above the eaves,
// where the span is the part's side perpendicular to its ridge. L1 cottages keep their low thatch.
const HOUSE_ROOF_PITCH=Math.tan(60*Math.PI/180);
function houseRoofSpan(part){return Math.abs(part.roofTurn||0)>1e-6?part.w:part.h}
function housePartRidge(s,part,wallH=houseBodyHeight(s)){
  if(part.kind==='turret'||part.kind==='outbuilding')return part.roofH;
  if(houseLevel(s)===1)return 1.45;
  return wallH+HOUSE_ROOF_PITCH*houseRoofSpan(part)/2;
}
// Ridges for a list of parts: wings never rise above the main body of their own building
// (first body part per buildingKey), so cross-gables meet the main roof below its ridge.
function housePartRidges(s,parts,wallH=houseBodyHeight(s)){
  const main=new Map();
  return parts.map(part=>{
    const ridge=housePartRidge(s,part,wallH);
    if(part.kind==='turret'||part.kind==='outbuilding')return ridge;
    const key=part.buildingKey||'main';
    if(!main.has(key)){main.set(key,ridge);return ridge}
    return Math.min(ridge,main.get(key));
  });
}
function houseRidgeHeight(s){
  if(houseLevel(s)===1)return 1.45;
  return housePartRidge(s,houseFootprintParts(s)[0]);
}
function houseStructureHeight(s){const turret=houseTurretInfo(s);return turret?Math.max(houseRidgeHeight(s),turret.roofH):houseRidgeHeight(s)}
const CIVIC_TYPES=Object.freeze(['market','tavern','church','training','plaza']);
const CIVIC_LEVEL_TYPES=Object.freeze(['market','tavern','church','plaza']);
const PLAZA_VARIANTS=Object.freeze(['paved','fountain','garden']);
function isCivic(s){return !!s&&CIVIC_TYPES.includes(s.type)}
function civicLevel(s){return Math.max(1,Math.min(3,Math.round(Number(s?.civicLevel)||1)))}
function plazaVariant(s){return PLAZA_VARIANTS.includes(s?.plazaVariant)?s.plazaVariant:'paved'}
function normalizeCivicDevelopment(s){
  if(CIVIC_LEVEL_TYPES.includes(s?.type))s.civicLevel=civicLevel(s);
  if(s?.type==='plaza')s.plazaVariant=plazaVariant(s);
  return s;
}
function civicLocalParts(s){
  if(s.type==='market')return[{cx:0,cy:0,w:4,h:4,role:'plaza',roofTurn:0}];
  if(s.type==='tavern')return[
    {cx:0,cy:0,w:2.2,h:5.0,role:'spine',roofTurn:Math.PI/2},
    {cx:0,cy:-1.72,w:4.6,h:1.55,role:'wing',roofTurn:0},
    {cx:0,cy:1.72,w:4.6,h:1.55,role:'wing',roofTurn:0}
  ];
  if(s.type==='church')return[
    {cx:0,cy:.25,w:2.9,h:6.2,role:'nave',roofTurn:Math.PI/2},
    {cx:0,cy:.35,w:5.2,h:1.65,role:'transept',roofTurn:0},
    {cx:0,cy:-2.65,w:1.85,h:1.85,role:'tower',roofTurn:0}
  ];
  if(s.type==='training')return[{cx:0,cy:0,w:5,h:4,role:'training',roofTurn:0}];
  if(s.type==='plaza')return[{cx:0,cy:0,w:5,h:5,role:'square',roofTurn:0}];
  return[];
}
function civicParts(s){
  return civicLocalParts(s).map(p=>{
    const q=houseLocalToWorld(s,p.cx,p.cy);
    return{...p,center:q,points:rectWorldPoints(q.x,q.y,p.w,p.h,s.angle||0)};
  });
}
function civicRadius(s){
  let r=.5;
  for(const p of civicLocalParts(s)){
    r=Math.max(r,Math.hypot(p.cx,p.cy)+Math.hypot(p.w,p.h)/2);
  }
  return r;
}
function levelCostFactor(s){
  const l=structureLevel(s);
  if(['tower','gate'].includes(s?.type))return[1,1.65,2.3][l-1];
  return[1,1.8][l-1];
}
function scaleCost(cost,factor){return roundCost(Object.fromEntries(Object.entries(cost||{}).map(([k,v])=>[k,v*factor])))}
function baseConstructionCost(s){
  if(!s||s.auto)return{};
  if(s.type==='tower'){
    if(isWoodTower(s))return {...COSTS.woodTower[Math.min(1,Math.max(0,towerTier(s)-1))]};
    return scaleCost(COSTS.tower[towerTier(s)-1],levelCostFactor(s));
  }
  if(s.type==='gate')return isWoodGate(s)?{...COSTS.woodGate}:scaleCost(COSTS.gate,levelCostFactor(s));
  if(s.type==='moat')return roundCost({gold:(s.variant==='water'?12:7)*(s.length||1)*(s.width||1.5)});
  if(s.type==='bridge'){
    const factor=(s.width||1.5)/(s.variant==='stone'?1.5:1.2);
    return roundCost(s.variant==='stone'
      ?{gold:9*(s.length||1)*factor,stone:24*(s.length||1)*factor}
      :{gold:5*(s.length||1)*factor,wood:18*(s.length||1)*factor});
  }
  if(s.type==='well')return {...COSTS.well};
  if(window.ConquerIndustries?.is(s))return {...window.ConquerIndustries.definition(s).cost};
  if(isCivicAnnex(s))return{}; // skeleton: no economic effects yet
  if(isCivic(s))return {...COSTS[s.type]};
  if(s.type==='wall')return scaleCost(Object.fromEntries(Object.entries(COSTS.wallPerU).map(([k,v])=>[k,v*s.length])),levelCostFactor(s));
  if(s.type==='palisade')return roundCost(Object.fromEntries(Object.entries(COSTS.palisadePerU).map(([k,v])=>[k,v*s.length])));
  if(s.type==='built')return scaleCost(Object.fromEntries(Object.entries(COSTS.builtPerU).map(([k,v])=>[k,v*s.length])),levelCostFactor(s));
  return{};
}
function constructionCost(s){
  const cost=baseConstructionCost(s);
  if(s?.masonryMaterial==='brick'&&cost.stone>0){cost.clay=(cost.clay||0)+cost.stone;delete cost.stone}
  return cost;
}
function costText(cost){const icons={gold:'🪙',stone:'🪨',clay:'🧱',wood:'🪵',metal:'⛓'};const parts=RES_ORDER.filter(k=>(cost?.[k]||0)>0).map(k=>`${icons[k]} ${cost[k]}`);return parts.length?parts.join(' · '):'free'}
function canAfford(cost){return Object.entries(cost||{}).every(([k,v])=>(State.resources[k]||0)>=v)}
function spendCost(cost){for(const [k,v] of Object.entries(cost||{}))State.resources[k]=(State.resources[k]||0)-v;renderUI()}
function refundCost(cost){for(const [k,v] of Object.entries(cost||{}))State.resources[k]=(State.resources[k]||0)+v;renderUI()}
function buildDuration(s){
  if(s.type==='tower'){
    if(isWoodTower(s))return BUILD_DAYS.woodTower[Math.min(1,Math.max(0,towerTier(s)-1))];
    return BUILD_DAYS.tower[towerTier(s)-1]*(.7+.3*structureLevel(s));
  }
  if(s.type==='gate')return isWoodGate(s)?BUILD_DAYS.woodGate:BUILD_DAYS.gate*(.7+.3*structureLevel(s));
  if(s.type==='well')return BUILD_DAYS.well;
  if(window.ConquerIndustries?.is(s))return window.ConquerIndustries.definition(s).days;
  if(isCivicAnnex(s))return 0; // skeleton construction is immediate
  if(isCivic(s))return BUILD_DAYS[s.type];
  if(s.type==='wall')return (BUILD_DAYS.wallBase+BUILD_DAYS.wallPerU*s.length)*(.75+.25*structureLevel(s));
  if(s.type==='palisade')return BUILD_DAYS.palisadeBase+BUILD_DAYS.palisadePerU*s.length;
  if(s.type==='built')return (BUILD_DAYS.builtBase+BUILD_DAYS.builtPerU*s.length)*(.75+.25*structureLevel(s));
  if(s.type==='moat')return .8+(s.length||1)*(s.variant==='water'?.9:.65)*(s.width||1.5)/1.5;
  if(s.type==='bridge')return .8+(s.length||1)*(s.variant==='stone'?.8:.5)*(s.width||1.5)/1.5;
  if(s.type==='road')return BUILD_DAYS.road;
  if(s.type==='house')return BUILD_DAYS.house;
  if(s.type==='field')return BUILD_DAYS.field;
  return 0;
}
function beginConstruction(s,delay=0){
  const d=buildDuration(s);if(d<=0)return s;
  s.construction={startedDay:State.clock.day+delay,completeDay:State.clock.day+delay+d};return s;
}
function constructionProgress(s){
  if(!s?.construction)return 1;
  const a=s.construction.startedDay,b=s.construction.completeDay;
  if(State.clock.day<=a)return 0;if(State.clock.day>=b)return 1;
  return clamp((State.clock.day-a)/(b-a),0,1);
}
function underConstruction(s){return constructionProgress(s)<1}
function remainingDays(s){return s?.construction?Math.max(0,s.construction.completeDay-State.clock.day):0}
function pointRadius(s){
  if(s.type==='tower')return s.shape==='round'?s.r:Math.SQRT2*s.size/2;
  if(s.type==='gate'){const d=rectDims(s);return Math.hypot(d.w,d.h)/2}
  if(s.type==='well')return .75;
  if(s.type==='house'){const {w,h}=houseFootprintDimensions(s);return Math.hypot(w,h)/2}
  if(s.type==='field'||window.ConquerIndustries?.is(s))return Math.hypot(s.w,s.h)/2;
  if(isCivicAnnex(s))return Math.hypot(s.w||1,s.h||1)/2;
  if(isCivic(s))return civicRadius(s);
  return .5;
}


// CONQUER diagnostics — bounded in-memory telemetry, no persistent background writes.
(function(){
  const SAMPLE_MS=1000,MAX_SAMPLES=900,MAX_EVENTS=500,FRAME_SPIKE_MS=55,REMOTE_MS=10000;
  const samples=[],events=[],sessionId=crypto.randomUUID?.()||('diag-'+Math.random().toString(36).slice(2));
  let lastSampleAt=performance.now(),lastRemoteAt=0,lastEventAtByType=new Map(),lastPerf={},frameCount=0,frameSum=0,frameMax=0,frameOverBudget=0;

  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const trim=(list,max)=>{if(list.length>max)list.splice(0,list.length-max)};
  const perf=()=>window.__conquerPerf||(window.__conquerPerf={});
  const simDay=()=>finite(State?.clock?.day);
  const clockSpeed=()=>finite(State?.clock?.speed);
  const structures=()=>Array.isArray(State?.structures)?State.structures:[];

  function event(type,data={},severity='info',cooldownMs=0){
    const now=performance.now(),last=lastEventAtByType.get(type)||-Infinity;
    if(cooldownMs&&now-last<cooldownMs)return;
    lastEventAtByType.set(type,now);
    events.push({atMs:Math.round(now),wall:new Date().toISOString(),day:simDay(),type,severity,data});
    trim(events,MAX_EVENTS);
  }
  function delta(name,p){return Math.max(0,finite(p[name])-finite(lastPerf[name]))}
  function sendRemote(sample){
    const now=performance.now();
    if(!sample||sample.speed<=0||now-lastRemoteAt<REMOTE_MS)return;
    lastRemoteAt=now;
    const recentEvents=events.filter(e=>e.atMs>=now-REMOTE_MS).slice(-8);
    const row={
      session_id:sessionId,
      day:sample.day,
      speed:sample.speed,
      frame_avg_ms:sample.frame?.avgMs||0,
      frame_max_ms:sample.frame?.maxMs||0,
      frame_over_34:sample.frame?.over34||0,
      draw_ms:sample.draw?.lastMs||0,
      maintenance_ms:sample.maintenance?.lastMs||0,
      save_ms:sample.save?.lastMs||0,
      visible_population:sample.population?.visible||0,
      represented_population:sample.population?.represented||0,
      structures:sample.scene?.structures||0,
      roads:sample.scene?.roads||0,
      nav_graph_builds_delta:sample.navigation?.deltaGraphBuilds||0,
      nav_trees_delta:sample.navigation?.deltaTreesBuilt||0,
      nav_invalidations_delta:sample.navigation?.deltaNavInvalidations||0,
      cache_invalidations_delta:sample.cache?.deltaInvalidations||0,
      cache_rebuilds_delta:
        (sample.cache?.deltaLandscapeRebuilds||0)+(sample.cache?.deltaGroundRebuilds||0)+
        (sample.cache?.deltaShadowRebuilds||0)+(sample.cache?.deltaBaseRebuilds||0)+(sample.cache?.deltaCastleBodyRebuilds||0)+
        (sample.cache?.deltaCastleFrontRebuilds||0),
      asset_cache_entries:sample.assetCache?.entries||0,
      asset_cache_mb:sample.assetCache?.estimatedMb||0,
      asset_cache_hits_delta:sample.assetCache?.deltaHits||0,
      asset_cache_misses_delta:sample.assetCache?.deltaMisses||0,
      asset_cache_evictions_delta:sample.assetCache?.deltaEvictions||0,
      asset_prerender_ms:sample.assetCache?.lastPrerenderMs||0,
      castle_body_bitmap_hits_delta:sample.assetCache?.deltaCastleBodyHits||0,
      castle_body_bitmap_misses_delta:sample.assetCache?.deltaCastleBodyMisses||0,
      castle_body_bitmap_ms:sample.assetCache?.castleBodyMs||0,
      recent_events:recentEvents
    };
    fetch(SUPABASE_URL+'/rest/v1/simulation_telemetry',{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'apikey':SUPABASE_KEY,
        'authorization':'Bearer '+SUPABASE_KEY,
        'prefer':'return=minimal'
      },
      body:JSON.stringify(row),
      keepalive:true,
      cache:'no-store'
    }).catch(err=>event('REMOTE_TELEMETRY_ERROR',{message:String(err)},'warn',30000));
  }
  function frame(now,rawDtMs){
    const dt=finite(rawDtMs);
    frameCount++;frameSum+=dt;frameMax=Math.max(frameMax,dt);
    if(dt>34)frameOverBudget++;
    if(dt>=FRAME_SPIKE_MS)event('FRAME_SPIKE',{dtMs:+dt.toFixed(2),speed:clockSpeed()},dt>=100?'error':'warn',250);
    if(now-lastSampleAt>=SAMPLE_MS)sample(now);
  }
  function measure(name,ms,data={}){
    const v=finite(ms),limits={
      DRAW:34,
      CACHE_LANDSCAPE:40,CACHE_GROUND:18,CACHE_SHADOW:18,CACHE_BASE:24,
      CACHE_CASTLE_BODY:24,CACHE_CASTLE_FRONT:18,CACHE_STAGE:34,
      MAINTENANCE:22,SAVE:20,NAV_GRAPH:20,NAV_TREE:12,ROAD_REPAIR:15,GROWTH:20
    };
    const limit=limits[name]??30;
    if(v>=limit)event(name+'_SLOW',{ms:+v.toFixed(2),...data},v>=limit*2?'error':'warn',250);
  }
  function sample(now=performance.now()){
    const p=perf(),all=structures(),day=simDay();
    const s={
      atMs:Math.round(now),wall:new Date().toISOString(),day:+day.toFixed(4),speed:clockSpeed(),
      frame:{count:frameCount,avgMs:+(frameCount?frameSum/frameCount:0).toFixed(2),maxMs:+frameMax.toFixed(2),over34:frameOverBudget},
      draw:{lastMs:+finite(p.lastDrawMs).toFixed(2),maxMs:+finite(p.maxDrawMs).toFixed(2),longDraws:finite(p.longDraws)},
      maintenance:{lastMs:+finite(p.lastMaintenanceMs).toFixed(2),runs:finite(p.maintenanceRuns),deltaRuns:delta('maintenanceRuns',p)},
      save:{lastMs:+finite(p.lastSaveMs).toFixed(2)},
      renderer:{
        mode:p.webgpuActive?'webgpu':'canvas2d',
        webgpuSupported:!!p.webgpuSupported,
        webgpuActive:!!p.webgpuActive,
        webgpuFrames:finite(p.webgpuFrames),
        webgpuUploads:finite(p.webgpuUploads),
        webgpuLastFrameMs:+finite(p.webgpuLastFrameMs).toFixed(3),
        webgpuLastUploadMs:+finite(p.webgpuLastUploadMs).toFixed(3),
        fallbackReason:p.webgpuFallbackReason||null
      },
      navigation:{
        graphBuilds:finite(p.graphBuilds),deltaGraphBuilds:delta('graphBuilds',p),
        graphRoutes:finite(p.graphRoutes),deltaGraphRoutes:delta('graphRoutes',p),
        gridFallbacks:finite(p.gridFallbacks),deltaGridFallbacks:delta('gridFallbacks',p),
        gridMisses:finite(p.gridMisses),deltaGridMisses:delta('gridMisses',p),
        destinationTreesBuilt:finite(p.destinationTreesBuilt),deltaTreesBuilt:delta('destinationTreesBuilt',p),
        destinationTreeHits:finite(p.destinationTreeHits),deltaTreeHits:delta('destinationTreeHits',p),
        navInvalidations:finite(p.navInvalidations),deltaNavInvalidations:delta('navInvalidations',p)
      },
      cache:{
        invalidations:finite(p.cacheInvalidations),deltaInvalidations:delta('cacheInvalidations',p),
        landscapeRebuilds:finite(p.cacheLandscapeRebuilds),deltaLandscapeRebuilds:delta('cacheLandscapeRebuilds',p),
        groundRebuilds:finite(p.cacheGroundRebuilds),deltaGroundRebuilds:delta('cacheGroundRebuilds',p),
        shadowRebuilds:finite(p.cacheShadowRebuilds),deltaShadowRebuilds:delta('cacheShadowRebuilds',p),
        baseRebuilds:finite(p.cacheBaseRebuilds),deltaBaseRebuilds:delta('cacheBaseRebuilds',p),
        castleBodyRebuilds:finite(p.cacheCastleBodyRebuilds),deltaCastleBodyRebuilds:delta('cacheCastleBodyRebuilds',p),
        castleFrontRebuilds:finite(p.cacheCastleFrontRebuilds),deltaCastleFrontRebuilds:delta('cacheCastleFrontRebuilds',p)
      },
      assetCache:{
        entries:finite(p.assetCacheEntries),estimatedMb:+finite(p.assetCacheEstimatedMb).toFixed(2),
        hits:finite(p.assetCacheHits),deltaHits:delta('assetCacheHits',p),
        misses:finite(p.assetCacheMisses),deltaMisses:delta('assetCacheMisses',p),
        evictions:finite(p.assetCacheEvictions),deltaEvictions:delta('assetCacheEvictions',p),
        lastPrerenderMs:+finite(p.assetPrerenderMs).toFixed(2),
        castleBodyHits:finite(p.castleBodyBitmapHits),deltaCastleBodyHits:delta('castleBodyBitmapHits',p),
        castleBodyMisses:finite(p.castleBodyBitmapMisses),deltaCastleBodyMisses:delta('castleBodyBitmapMisses',p),
        castleBodyMs:+finite(p.castleBodyBitmapMs).toFixed(2),
        castleBodyMode:p.lastCastleBodyCacheMode||'—',
        castleBodyRebuildMs:+finite(p.lastCastleBodyRebuildMs).toFixed(2)
      },
      population:{represented:finite(p.representedPopulation),visible:finite(p.visibleVillagers)},
      scene:{
        structures:all.length,
        roads:all.reduce((n,x)=>n+(x?.type==='road'?1:0),0),
        construction:all.reduce((n,x)=>n+(x?.construction&&finite(x.construction.completeDay)>day?1:0),0)
      }
    };
    samples.push(s);trim(samples,MAX_SAMPLES);
    lastPerf={...p};frameCount=0;frameSum=0;frameMax=0;frameOverBudget=0;lastSampleAt=now;
    updateReadout(s);
    sendRemote(s);
    return s;
  }
  function diagnose(windowSamples=30){
    const recent=samples.slice(-Math.max(1,windowSamples)),issues=[];
    if(!recent.length)return{level:'unknown',issues:['No samples yet']};
    const max=fn=>Math.max(0,...recent.map(fn)),avg=fn=>recent.reduce((a,s)=>a+fn(s),0)/recent.length;
    if(max(s=>s.frame.maxMs)>=100)issues.push('MAIN_THREAD: frame gap >=100ms');
    else if(avg(s=>s.frame.avgMs)>40)issues.push('FRAME_PACING: average frame interval >40ms');
    if(max(s=>s.draw.lastMs)>50)issues.push('DRAW: slow render');
    if(max(s=>s.maintenance.lastMs)>35)issues.push('MAINTENANCE: watchdog blocking');
    if(max(s=>s.save.lastMs)>30)issues.push('SAVE: synchronous save blocking');
    if(max(s=>s.navigation.deltaGraphBuilds)>1)issues.push('NAVIGATION: repeated graph rebuilds');
    if(max(s=>s.navigation.deltaTreesBuilt)>25)issues.push('NAVIGATION: destination-tree churn');
    if(max(s=>s.cache.deltaInvalidations)>8)issues.push('CACHE: frequent invalidations');
    if(max(s=>
      s.cache.deltaLandscapeRebuilds+s.cache.deltaGroundRebuilds+s.cache.deltaShadowRebuilds+s.cache.deltaBaseRebuilds+
      s.cache.deltaCastleBodyRebuilds+s.cache.deltaCastleFrontRebuilds
    )>3)issues.push('CACHE_REBUILD: repeated static rebuilds');
    if(max(s=>s.assetCache.deltaEvictions)>8)issues.push('ASSET_CACHE: eviction churn');
    if(avg(s=>s.assetCache.deltaMisses)>avg(s=>s.assetCache.deltaHits)*1.5&&max(s=>s.assetCache.deltaMisses)>3)issues.push('ASSET_CACHE: low hit rate');
    if(events.slice(-100).some(e=>e.type==='LONG_TASK'&&finite(e.data?.durationMs)>80))issues.push('LONG_TASK: browser main-thread task >80ms');
    return{level:issues.length?'warning':'ok',issues};
  }
  function snapshot(){
    return{schema:1,generatedAt:new Date().toISOString(),userAgent:navigator.userAgent,
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1},
      diagnosis:diagnose(60),samples:samples.slice(),events:events.slice(),perf:{...perf()}};
  }
  function exportJson(){
    const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='conquer-analytics-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function clear(){
    samples.length=0;events.length=0;lastPerf={...perf()};lastSampleAt=performance.now();
    frameCount=0;frameSum=0;frameMax=0;frameOverBudget=0;event('ANALYTICS_CLEARED');
  }
  function updateReadout(s){
    const el=document.getElementById('analyticsReadout');if(!el)return;
    const d=diagnose(20);
    el.textContent=(d.level==='ok'?'OK':'⚠')+' · frame '+s.frame.avgMs+'ms / '+s.frame.maxMs+'ms · draw '+s.draw.lastMs+'ms · '+s.population.visible+' pop · asset '+s.assetCache.estimatedMb+'MB';
    el.title=d.issues.join('\n')||'No diagnostic warnings';
  }
  try{
    if('PerformanceObserver'in window&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
      const observer=new PerformanceObserver(list=>{
        for(const e of list.getEntries())event('LONG_TASK',{durationMs:+e.duration.toFixed(2),startMs:+e.startTime.toFixed(2)},e.duration>=100?'error':'warn',100);
      });
      observer.observe({entryTypes:['longtask']});
    }
  }catch(err){event('ANALYTICS_OBSERVER_ERROR',{message:String(err)})}

  window.__conquerAnalytics={frame,measure,event,sample,diagnose,snapshot,exportJson,clear,samples,events,sessionId};
  event('ANALYTICS_READY',{sampleMs:SAMPLE_MS,maxSamples:MAX_SAMPLES});
})();
