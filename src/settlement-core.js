'use strict';
// CONQUER settlement core module — classic-script shared runtime.
const canvas=document.getElementById('c'),weatherCanvas=document.getElementById('weatherCanvas'),weatherCloudLayer=document.getElementById('weatherCloudLayer'),wrap=document.getElementById('wrap');
let ctx=canvas.getContext('2d');
const screenCtx=ctx;
const weatherCtx=weatherCanvas?weatherCanvas.getContext('2d'):null;
const sceneCache={
  base:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null},
  castleBody:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null},
  castleFront:{canvas:document.createElement('canvas'),ctx:null,dirty:true,view:null}
};
for(const layer of Object.values(sceneCache))layer.ctx=layer.canvas.getContext('2d');
function invalidateSceneCache(layer='all'){
  if(layer==='all'){for(const item of Object.values(sceneCache))item.dirty=true;return}
  if(sceneCache[layer])sceneCache[layer].dirty=true;
}
function withRenderContext(next,fn){
  const prev=ctx;ctx=next;
  try{return fn()}finally{ctx=prev}
}
const STATIC_CACHE_DPR_CAP=1.5;
function staticCacheDpr(){return Math.min(devicePixelRatio||1,STATIC_CACHE_DPR_CAP)}
function prepareSceneCache(layer){
  const r=wrap.getBoundingClientRect(),d=staticCacheDpr(),entry=sceneCache[layer];
  // Cache a full 3×3 viewport: the live viewport occupies the central tile,
  // leaving one complete viewport of raster margin on every side.
  const ox=r.width,oy=r.height;
  const logicalW=r.width*3,logicalH=r.height*3;
  const w=Math.max(1,Math.round(logicalW*d)),h=Math.max(1,Math.round(logicalH*d));
  if(entry.canvas.width!==w||entry.canvas.height!==h){
    entry.canvas.width=w;entry.canvas.height=h;entry.dirty=true;
  }
  entry.ctx.setTransform(1,0,0,1,0,0);
  entry.ctx.clearRect(0,0,entry.canvas.width,entry.canvas.height);
  entry.ctx.setTransform(d,0,0,d,ox*d,oy*d);
  entry.view={
    x:State.view.x,y:State.view.y,scale:State.view.scale,
    rotation:State.view.rotation||0,width:r.width,height:r.height,dpr:d,
    overscanX:ox,overscanY:oy
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
  const ox=Number(v.overscanX)||v.width||0,oy=Number(v.overscanY)||v.height||0;
  // Rebuild before the viewport actually reaches the edge of the 3×3 raster.
  return Math.abs(State.view.x-v.x)<=ox*.92&&Math.abs(State.view.y-v.y)<=oy*.92;
}
function blitSceneCache(layer){
  const r=wrap.getBoundingClientRect(),entry=sceneCache[layer],v=entry.view;
  if(!v)return;
  const ox=Number(v.overscanX)||v.width||0,oy=Number(v.overscanY)||v.height||0;

  // Pan keeps the 3×3 cache at 1:1 scale and simply moves the central viewport
  // across it. No clipping can occur until roughly one full viewport of travel.
  if(!sceneCacheZoomPreview){
    const dx=State.view.x-v.x,dy=State.view.y-v.y;
    screenCtx.drawImage(
      entry.canvas,
      0,0,entry.canvas.width,entry.canvas.height,
      dx-ox,dy-oy,r.width+ox*2,r.height+oy*2
    );
    return;
  }

  // Only an active wheel gesture may temporarily reproject a stale-scale cache.
  const ratio=(Number(State.view.scale)||1)/(Number(v.scale)||1);
  const dx=State.view.x+(-ox-v.x)*ratio;
  const dy=State.view.y+(-oy-v.y)*ratio;
  screenCtx.drawImage(
    entry.canvas,
    0,0,entry.canvas.width,entry.canvas.height,
    dx,dy,(r.width+ox*2)*ratio,(r.height+oy*2)*ratio
  );
}
const U=12,WORLD=200,BUILD=100,BUILD_MIN=50,BUILD_MAX=150,GRID=.5;
const ISO_X=.8660254,ISO_Y=.5,ISO_Z=.9;
const WEATHER_ZOOM_THRESHOLD=.5;
const SUPABASE_URL='https://fwpmcyxggvdtsuatovzo.supabase.co';
const SUPABASE_KEY='sb_publishable_-nHMiLTkFCVTMwBFOmFqfQ_oZUUybfv';
const initialSeed=(()=>{const k='conquer.seed.0.0';let v=localStorage.getItem(k);if(!v){v=String(Math.floor(Math.random()*2147483647));localStorage.setItem(k,v)}return Number(v)})();
const State={structures:[],environment:[],relief:null,tool:{kind:'select'},draft:null,selectedId:null,pendingWellId:null,seed:initialSeed,cell:{x:0,y:0},biome:'plains',season:'summer',seasonOverride:null,weatherOverride:null,neighborBiomes:{},view:{scale:.72,x:0,y:0,rotation:0},buildLevels:{tower:1,gate:1,wall:1,wallTier:2},resources:{gold:10000,population:10000,food:10000,wood:10000,stone:10000,metal:10000,equipment:10000},policies:{tax:25,rations:50,levy:10},village:{name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,growthStep:0,nextGrowthDay:null,roadPlan:null,roadPlanVersion:0,borderEntries:null,baseRoadAngle:null},clock:{day:0,speed:0,lastSpeed:1},daylightOverride:null,dirty:false,supabase:null,user:null};
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
  training:{gold:90,stone:24,wood:70}
};
const BUILD_DAYS={tower:[4,7,11],woodTower:[2.5,4],gate:9,woodGate:4,well:0,market:4,tavern:6,church:10,training:3.5,wallBase:.7,wallPerU:.45,palisadeBase:.45,palisadePerU:.30,builtBase:2,builtPerU:1.5,road:1,house:2.2,field:1.5};
const GROWTH_INTERVAL_DAYS=2.5;
const BASE_DAYS_PER_SECOND=.25;
const PEASANT_VISUAL_SPEED=.025;
const FIELD_CELL_TARGET=.75;
const FIELD_CELL_MARGIN=.12;
const VISUAL_DAYLIGHT_RATIO=16/24;
const VISUAL_NIGHT_RATIO=8/24;
const NIGHT_OVERLAY_MAX=.48;
const VISUAL_TWILIGHT=1/24;
const BATTLEMENT_SPACING=.62;
const CHIMNEY_SPACING=1.5;
const WELL_PLAZA_SIZE=3;
const LINEAR_POINT_MAGNET=.90;
const TOWER_WALL_MAGNET=.78;
const SUBTOWER_MAGNET=1.0;
const WALL_BREAK_MIN=.10;

// Builder Geometry V2 — visual variants are data, not separate structure types.
// Geometry/cost/functions stay on the structure; appearance is selected here.
const STRUCTURE_VARIANT_VERSION=1;
const STRUCTURE_VARIANTS=Object.freeze({
  tower:Object.freeze({
    roofStyle:Object.freeze(['battlement','pitched'])
  }),
  gate:Object.freeze({
    roofStyle:Object.freeze(['battlement','pitched','flat'])
  }),
  wall:Object.freeze({
    skin:Object.freeze(['standard','hoarding'])
  }),
  built:Object.freeze({
    skin:Object.freeze(['standard','arcade'])
  })
});
const STRUCTURE_VARIANT_DEFAULTS=Object.freeze({
  tower:Object.freeze({roofStyle:'battlement'}),
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
  plains:{label:'Pianura',field:'#2a2818'},
  hills:{label:'Colline',field:'#2f2a19'},
  valley:{label:'Vallata',field:'#28271a'},
  river:{label:'Fiume',field:'#24271c'},
  forest:{label:'Foresta',field:'#1f2516'},
  mountains:{label:'Montagne',field:'#2b2620'},
  sea:{label:'Mare',field:'#2a2818'}
});
const FUNCTION_CATALOG=['guard','barracks','armory','storage','quarters','workshop','prison'];
const FUNCTION_LABELS={guard:'Guard post',barracks:'Barracks',armory:'Armory',storage:'Storage',quarters:'Quarters',workshop:'Workshop',prison:'Prison'};
const uid=()=>crypto.randomUUID?.()||('id-'+Date.now()+'-'+Math.random());
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const snapGrid=v=>Math.round(v/GRID)*GRID;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const status=t=>document.getElementById('status').textContent=t;
const RES_ORDER=['gold','stone','wood','metal'];
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
  if(['wall','palisade'].includes(s.type)){s.width=wallWidthForTier(tier)}
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
function housePlanType(s){return (peasantHash(s?.id||'house')&1)?'L':'T'}
function houseTurretType(s){return (peasantHash((s?.id||'house')+'-turret')&1)?'round':'square'}
function houseLocalToWorld(s,x,y){
  const ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0);
  return{x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca};
}
function houseTurretInfo(s){
  if(houseLevel(s)<4)return null;
  const w=Number(s.w)||1.5,h=Number(s.h)||1,hash=peasantHash((s.id||'house')+'-turret-pos');
  const sx=(hash&2)?1:-1,sy=(hash&4)?1:-1,type=houseTurretType(s);
  const cx=sx*w*.60,cy=sy*h*.58,center=houseLocalToWorld(s,cx,cy);
  const bodyH=2.62,roofH=3.42;
  if(type==='round'){
    const r=.52;
    return{kind:'turret',type,cx,cy,center,r,bodyH,roofH,points:circleWorldPoints(center.x,center.y,r,20)};
  }
  const size=.92;
  return{kind:'turret',type,cx,cy,center,size,bodyH,roofH,points:rectWorldPoints(center.x,center.y,size,size,s.angle||0)};
}
function houseFootprintParts(s){
  const parts=[{kind:'body',cx:0,cy:0,w:Number(s.w)||1.5,h:Number(s.h)||1,roofTurn:0}];
  if(houseLevel(s)>=3){
    const sign=(peasantHash(s.id)&2)?1:-1,plan=housePlanType(s),w=Number(s.w)||1.5,h=Number(s.h)||1;
    if(plan==='L'){
      parts.push({kind:'body',cx:sign*w*.38,cy:h*.56,w:w*.55,h:h*.95,roofTurn:Math.PI/2});
    }else{
      parts.push({kind:'body',cx:0,cy:h*.62,w:w*1.18,h:h*.48,roofTurn:Math.PI/2});
      parts.push({kind:'body',cx:0,cy:h*.92,w:w*.46,h:h*.34,roofTurn:Math.PI/2});
    }
  }
  const out=parts.map(p=>{const q=houseLocalToWorld(s,p.cx,p.cy);return{...p,center:q,points:rectWorldPoints(q.x,q.y,p.w,p.h,s.angle||0)}});
  const turret=houseTurretInfo(s);if(turret)out.push(turret);
  return out;
}
function houseBodyHeight(s){return houseLevel(s)===1?.95:1.72}
function houseRidgeHeight(s){return houseLevel(s)===1?1.45:2.26}
function houseStructureHeight(s){const turret=houseTurretInfo(s);return turret?Math.max(houseRidgeHeight(s),turret.roofH):houseRidgeHeight(s)}
const CIVIC_TYPES=Object.freeze(['market','tavern','church','training']);
function isCivic(s){return !!s&&CIVIC_TYPES.includes(s.type)}
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
function constructionCost(s){
  if(!s||s.auto)return{};
  if(s.type==='tower'){
    if(isWoodTower(s))return {...COSTS.woodTower[Math.min(1,Math.max(0,towerTier(s)-1))]};
    return scaleCost(COSTS.tower[towerTier(s)-1],levelCostFactor(s));
  }
  if(s.type==='gate')return isWoodGate(s)?{...COSTS.woodGate}:scaleCost(COSTS.gate,levelCostFactor(s));
  if(s.type==='well')return {...COSTS.well};
  if(isCivic(s))return {...COSTS[s.type]};
  if(s.type==='wall')return scaleCost(Object.fromEntries(Object.entries(COSTS.wallPerU).map(([k,v])=>[k,v*s.length])),levelCostFactor(s));
  if(s.type==='palisade')return roundCost(Object.fromEntries(Object.entries(COSTS.palisadePerU).map(([k,v])=>[k,v*s.length])));
  if(s.type==='built')return scaleCost(Object.fromEntries(Object.entries(COSTS.builtPerU).map(([k,v])=>[k,v*s.length])),levelCostFactor(s));
  return{};
}
function costText(cost){const icons={gold:'🪙',stone:'🪨',wood:'🪵',metal:'⛓'};const parts=RES_ORDER.filter(k=>(cost?.[k]||0)>0).map(k=>`${icons[k]} ${cost[k]}`);return parts.length?parts.join(' · '):'free'}
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
  if(isCivic(s))return BUILD_DAYS[s.type];
  if(s.type==='wall')return (BUILD_DAYS.wallBase+BUILD_DAYS.wallPerU*s.length)*(.75+.25*structureLevel(s));
  if(s.type==='palisade')return BUILD_DAYS.palisadeBase+BUILD_DAYS.palisadePerU*s.length;
  if(s.type==='built')return (BUILD_DAYS.builtBase+BUILD_DAYS.builtPerU*s.length)*(.75+.25*structureLevel(s));
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
  if(s.type==='house'||s.type==='field')return Math.hypot(s.w,s.h)/2;
  if(isCivic(s))return civicRadius(s);
  return .5;
}
