(() => {
'use strict';
const canvas=document.getElementById('c'),wrap=document.getElementById('wrap');
let ctx=canvas.getContext('2d');
const screenCtx=ctx;
const sceneCache={
  base:{canvas:document.createElement('canvas'),ctx:null,dirty:true},
  castleBody:{canvas:document.createElement('canvas'),ctx:null,dirty:true},
  castleFront:{canvas:document.createElement('canvas'),ctx:null,dirty:true}
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
function prepareSceneCache(layer){
  const r=wrap.getBoundingClientRect(),d=devicePixelRatio||1,entry=sceneCache[layer];
  const w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  if(entry.canvas.width!==w||entry.canvas.height!==h){
    entry.canvas.width=w;entry.canvas.height=h;entry.dirty=true;
  }
  entry.ctx.setTransform(d,0,0,d,0,0);
  entry.ctx.clearRect(0,0,r.width,r.height);
  return entry;
}
function blitSceneCache(layer){
  const r=wrap.getBoundingClientRect(),entry=sceneCache[layer];
  screenCtx.drawImage(entry.canvas,0,0,entry.canvas.width,entry.canvas.height,0,0,r.width,r.height);
}
const U=12,WORLD=200,BUILD=100,BUILD_MIN=50,BUILD_MAX=150,GRID=.5;
const ISO_X=.8660254,ISO_Y=.5,ISO_Z=.9;
const SUPABASE_URL='https://fwpmcyxggvdtsuatovzo.supabase.co';
const SUPABASE_KEY='sb_publishable_-nHMiLTkFCVTMwBFOmFqfQ_oZUUybfv';
const initialSeed=(()=>{const k='conquer.seed.0.0';let v=localStorage.getItem(k);if(!v){v=String(Math.floor(Math.random()*2147483647));localStorage.setItem(k,v)}return Number(v)})();
const State={structures:[],environment:[],tool:{kind:'select'},draft:null,selectedId:null,pendingWellId:null,seed:initialSeed,cell:{x:0,y:0},biome:'plains',neighborBiomes:{},view:{scale:.72,x:0,y:0,rotation:0},buildLevels:{tower:1,gate:1,wall:1,wallTier:2},resources:{gold:10000,population:10000,food:10000,wood:10000,stone:10000,metal:10000,equipment:10000},policies:{tax:25,rations:50,levy:10},village:{name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null},clock:{day:0,speed:0,lastSpeed:1},daylightOverride:null,dirty:false,supabase:null,user:null};
const TYPES={wall:{min:1,max:8},built:{width:1,min:1,max:4}};
const WALL_TIERS=Object.freeze({1:.2,2:.5,3:1});
const SQUARE_TOWER_TIERS=Object.freeze({1:1,2:1.5,3:2});
const ROUND_TOWER_TIERS=Object.freeze({1:.5,2:.75,3:1});
const COSTS={
  tower:[{gold:45,stone:55,wood:12},{gold:75,stone:95,wood:20},{gold:120,stone:155,wood:32}],
  wallPerU:{gold:6,stone:18,wood:2},
  builtPerU:{gold:12,stone:16,wood:18},
  gate:{gold:95,stone:90,wood:38,metal:10},
  well:{gold:50,stone:35,wood:10},
  market:{gold:120,stone:70,wood:85},
  tavern:{gold:190,stone:65,wood:145},
  church:{gold:320,stone:360,wood:110,metal:18},
  training:{gold:90,stone:24,wood:70}
};
const BUILD_DAYS={tower:[4,7,11],gate:9,well:0,market:4,tavern:6,church:10,training:3.5,wallBase:.7,wallPerU:.45,builtBase:2,builtPerU:1.5,road:1,house:2.2,field:1.5};
const GROWTH_INTERVAL_DAYS=2.5;
const BASE_DAYS_PER_SECOND=.25;
const PEASANT_VISUAL_SPEED=.20;
const FIELD_CELL_TARGET=.75;
const FIELD_CELL_MARGIN=.12;
const VISUAL_DAYLIGHT_RATIO=16/24;
const VISUAL_NIGHT_RATIO=8/24;
const NIGHT_OVERLAY_MAX=.48;
const VISUAL_TWILIGHT=1/24;
const BATTLEMENT_SPACING=.62;
const CHIMNEY_SPACING=1.5;
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
    roofStyle:Object.freeze(['battlement','pitched'])
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
function gateRoofStyle(s){return s?.type==='gate'?structureVariant(s,'roofStyle'):undefined}
function wallSkin(s){return s?.type==='wall'?structureVariant(s,'skin'):undefined}
function builtSkin(s){return s?.type==='built'?structureVariant(s,'skin'):undefined}

function towerTier(s){const span=s.shape==='round'?s.r*2:s.size;return span>=1.99?3:span>=1.49?2:1}
function wallTier(s){const w=Number(s?.width)||.5;return w>=.75?3:w>=.35?2:1}
function wallWidthForTier(t){return WALL_TIERS[clamp(Math.round(Number(t)||2),1,3)]}
function towerSizeForTier(shape,t){t=clamp(Math.round(Number(t)||1),1,3);return shape==='round'?ROUND_TOWER_TIERS[t]:SQUARE_TOWER_TIERS[t]}
function applyStructureTier(s,tier){
  tier=clamp(Math.round(Number(tier)||1),1,3);
  if(s.type==='wall'){s.width=wallWidthForTier(tier)}
  else if(s.type==='tower'){
    if(s.shape==='round')s.r=towerSizeForTier('round',tier);
    else s.size=towerSizeForTier('square',tier);
  }
  normalizeFunctions(s);return s
}
function structureLevel(s){return clamp(Math.round(Number(s?.level)||1),1,['tower','gate'].includes(s?.type)?3:2)}
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
  if(s.type==='tower')return scaleCost(COSTS.tower[towerTier(s)-1],levelCostFactor(s));
  if(s.type==='gate')return scaleCost(COSTS.gate,levelCostFactor(s));
  if(s.type==='well')return {...COSTS.well};
  if(isCivic(s))return {...COSTS[s.type]};
  if(s.type==='wall')return scaleCost(Object.fromEntries(Object.entries(COSTS.wallPerU).map(([k,v])=>[k,v*s.length])),levelCostFactor(s));
  if(s.type==='built')return scaleCost(Object.fromEntries(Object.entries(COSTS.builtPerU).map(([k,v])=>[k,v*s.length])),levelCostFactor(s));
  return{};
}
function costText(cost){const icons={gold:'🪙',stone:'🪨',wood:'🪵',metal:'⛓'};const parts=RES_ORDER.filter(k=>(cost?.[k]||0)>0).map(k=>`${icons[k]} ${cost[k]}`);return parts.length?parts.join(' · '):'free'}
function canAfford(cost){return Object.entries(cost||{}).every(([k,v])=>(State.resources[k]||0)>=v)}
function spendCost(cost){for(const [k,v] of Object.entries(cost||{}))State.resources[k]=(State.resources[k]||0)-v;renderUI()}
function refundCost(cost){for(const [k,v] of Object.entries(cost||{}))State.resources[k]=(State.resources[k]||0)+v;renderUI()}
function buildDuration(s){
  if(s.type==='tower')return BUILD_DAYS.tower[towerTier(s)-1]*(.7+.3*structureLevel(s));
  if(s.type==='gate')return BUILD_DAYS.gate*(.7+.3*structureLevel(s));
  if(s.type==='well')return BUILD_DAYS.well;
  if(isCivic(s))return BUILD_DAYS[s.type];
  if(s.type==='wall')return (BUILD_DAYS.wallBase+BUILD_DAYS.wallPerU*s.length)*(.75+.25*structureLevel(s));
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
  if(s.type==='gate')return Math.SQRT2*s.size/2;
  if(s.type==='well')return .75;
  if(s.type==='house'||s.type==='field')return Math.hypot(s.w,s.h)/2;
  if(isCivic(s))return civicRadius(s);
  return .5;
}
function gatePassageInfo(gate,reference=null){
  if(!gate||gate.type!=='gate')return null;
  const d=rectDims(gate),a=gate.angle||0,ux=Math.cos(a),uy=Math.sin(a),vx=-uy,vy=ux;
  const halfLength=d.w/2,halfWidth=Math.min(d.h*.40,.52);
  const sideA={x:gate.x-ux*(halfLength+.20),y:gate.y-uy*(halfLength+.20)};
  const sideB={x:gate.x+ux*(halfLength+.20),y:gate.y+uy*(halfLength+.20)};
  let near=sideA,far=sideB;
  if(reference&&dist(reference,sideB)<dist(reference,sideA)){near=sideB;far=sideA}
  return{
    center:{x:gate.x,y:gate.y},ux,uy,vx,vy,halfLength,halfWidth,
    sideA,sideB,near,far
  };
}
function gatePointInPassage(gate,p,pad=.04){
  const info=gatePassageInfo(gate);if(!info)return false;
  const q=toLocalPoint(gate,p);
  return Math.abs(q.x)<=info.halfLength+pad&&Math.abs(q.y)<=info.halfWidth+pad;
}
function roadUsesGatePassage(road,gate){
  if(!road||!gate||gate.type!=='gate')return false;
  const info=gatePassageInfo(gate),mid=closestPointOnSegment(info.center,road.a,road.b);
  if(dist(mid,info.center)>info.halfWidth*.82)return false;
  const dx=road.b.x-road.a.x,dy=road.b.y-road.a.y,L=Math.hypot(dx,dy)||1;
  const dot=Math.abs((dx/L)*info.ux+(dy/L)*info.uy);
  return dot>=Math.cos(32*Math.PI/180);
}
function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;if(!L2)return dist(p,a);const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/L2,0,1);return dist(p,{x:a.x+t*dx,y:a.y+t*dy})}
function segmentsIntersect(a,b,c,d){const cr=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const a1=cr(a,b,c),a2=cr(a,b,d),a3=cr(c,d,a),a4=cr(c,d,b);return ((a1>0&&a2<0)||(a1<0&&a2>0))&&((a3>0&&a4<0)||(a3<0&&a4>0))}
function roadTouchesPolygon(road,poly,pad=.08){
  if(!poly?.length)return false;
  const clearance=(Number(road.width)||.3)/2+pad;
  if(pointInPolygon(road.a,poly)||pointInPolygon(road.b,poly))return true;
  for(let i=0;i<poly.length;i++){
    const j=(i+1)%poly.length;
    if(segmentsIntersect(road.a,road.b,poly[i],poly[j]))return true;
    if(segmentDistance(road.a,road.b,poly[i],poly[j])<=clearance)return true;
  }
  return false;
}
function manualRoadConflict(road,manual){
  if(!manual)return false;
  // The market is a paved public square; castle gates contain a real traversable passage.
  if(manual.type==='market')return false;
  if(manual.type==='gate'&&roadUsesGatePassage(road,manual))return false;
  if(['wall','built'].includes(manual.type)){
    return segmentsIntersect(road.a,road.b,manual.a,manual.b)||
      pointSegmentDistance(manual.a,road.a,road.b)<=manual.width/2+(road.width||.3)/2||
      pointSegmentDistance(manual.b,road.a,road.b)<=manual.width/2+(road.width||.3)/2;
  }
  if(manual.type==='tower'&&manual.shape==='round'){
    return pointSegmentDistance(manual,road.a,road.b)<=manual.r+(road.width||.3)/2+.08;
  }
  const rings=manual.type==='house'?houseFootprintParts(manual).map(p=>p.points):
    isCivic(manual)?civicParts(manual).map(p=>p.points):
    [footprintPoints(manual)];
  return rings.some(poly=>roadTouchesPolygon(road,poly,.10));
}
function autoOverlapsManual(auto,manual){
  const linear=['wall','built'].includes(manual.type);
  if(auto.type==='road')return manualRoadConflict(auto,manual);
  const p={x:auto.x,y:auto.y},r=pointRadius(auto);
  if(linear)return pointSegmentDistance(p,manual.a,manual.b)<=r+manual.width/2+.15;
  return dist(p,{x:manual.x,y:manual.y})<=r+pointRadius(manual)+.15;
}
function removeOverlappingAuto(manual){
  let removed=0;const roads=[];
  State.structures=State.structures.filter(s=>{
    const hit=s.auto&&autoOverlapsManual(s,manual);
    if(hit){removed++;if(s.type==='road')roads.push({...s,a:{...s.a},b:{...s.b}})}
    return !hit;
  });
  return{removed,roads};
}
function roadRepairPointClear(p,width=.30,ignoreIds=[]){
  if(!inBuild(p)||environmentBlocksPoint(p,'road'))return false;
  const clearance=width/2+.16;
  for(const s of State.structures){
    if(ignoreIds.includes(s.id)||s.type==='road')continue;
    if(s.type==='market')continue;
    if(s.type==='gate'){
      if(gatePointInPassage(s,p,Math.max(.05,width*.10)))continue;
      const q=toLocalPoint(s,p),d=rectDims(s);
      if(Math.abs(q.x)<=d.w/2+clearance&&Math.abs(q.y)<=d.h/2+clearance)return false;
      continue;
    }
    if(['wall','built'].includes(s.type)){
      if(pointSegmentDistance(p,s.a,s.b)<=Number(s.width)/2+clearance)return false;
      continue;
    }
    if(s.type==='well'){if(dist(p,s)<=.62+clearance)return false;continue}
    if(s.type==='tower'&&s.shape==='round'){if(dist(p,s)<=s.r+clearance)return false;continue}
    let rings=[];
    if(s.type==='house')rings=houseFootprintParts(s).map(q=>q.points);
    else if(isCivic(s))rings=civicParts(s).map(q=>q.points);
    else if(s.type==='field')rings=[rectWorldPoints(s.x,s.y,s.w,s.h,s.angle||0)];
    else if(s.x!=null)rings=[footprintPoints(s)];
    for(const poly of rings){
      if(!poly?.length)continue;
      if(pointInPolygon(p,poly))return false;
      for(let i=0;i<poly.length;i++){
        const j=(i+1)%poly.length;
        if(pointSegmentDistance(p,poly[i],poly[j])<=clearance)return false;
      }
    }
  }
  return true;
}
function roadRepairSegmentClear(a,b,width=.30,ignoreIds=[]){
  const L=dist(a,b),steps=Math.max(2,Math.ceil(L/.24));
  for(let i=0;i<=steps;i++){
    const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    if(!roadRepairPointClear(p,width,ignoreIds))return false;
  }
  return true;
}
function findRoadRepairPath(start,goal,width=.30,pad=8,ignoreIds=[],maxGuard=24000){
  const step=.5;
  const minX=Math.floor((Math.min(start.x,goal.x)-pad)/step),maxX=Math.ceil((Math.max(start.x,goal.x)+pad)/step);
  const minY=Math.floor((Math.min(start.y,goal.y)-pad)/step),maxY=Math.ceil((Math.max(start.y,goal.y)+pad)/step);
  const key=(x,y)=>x+','+y,pos=(x,y)=>({x:x*step,y:y*step});
  function nearestFree(p){
    const cx=Math.round(p.x/step),cy=Math.round(p.y/step);let best=null,bestD=Infinity;
    for(let r=0;r<=6;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const x=cx+dx,y=cy+dy,q=pos(x,y);
      if(x<minX||x>maxX||y<minY||y>maxY||!roadRepairPointClear(q,width,ignoreIds))continue;
      const d=dist(p,q);if(d<bestD){best={x,y,q};bestD=d}
    }
    return best;
  }
  const s=nearestFree(start),g=nearestFree(goal);if(!s||!g)return null;
  const open=new PeasantMinHeap(),gScore=new Map([[key(s.x,s.y),0]]),came=new Map(),closed=new Set();
  open.push({x:s.x,y:s.y,f:dist(s.q,g.q)});
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null,guard=0;
  while(open.length&&guard++<maxGuard){
    const cur=open.pop(),ck=key(cur.x,cur.y);if(closed.has(ck))continue;closed.add(ck);
    if(cur.x===g.x&&cur.y===g.y){found=cur;break}
    const cp=pos(cur.x,cur.y);
    for(const [dx,dy] of dirs){
      const nx=cur.x+dx,ny=cur.y+dy;if(nx<minX||nx>maxX||ny<minY||ny>maxY)continue;
      const nk=key(nx,ny),np=pos(nx,ny);if(closed.has(nk)||!roadRepairPointClear(np,width,ignoreIds))continue;
      if(!roadRepairSegmentClear(cp,np,width,ignoreIds))continue;
      const tentative=(gScore.get(ck)??Infinity)+Math.hypot(dx,dy)*step;
      if(tentative>=(gScore.get(nk)??Infinity))continue;
      gScore.set(nk,tentative);came.set(nk,ck);
      open.push({x:nx,y:ny,f:tentative+dist(np,g.q)});
    }
  }
  if(!found)return null;
  const rev=[];let k=key(found.x,found.y);
  while(k){const [x,y]=k.split(',').map(Number);rev.push(pos(x,y));k=came.get(k)}
  rev.reverse();
  if(roadRepairPointClear(start,width,ignoreIds))rev[0]={...start};
  if(roadRepairPointClear(goal,width,ignoreIds))rev[rev.length-1]={...goal};
  return rev;
}
function simplifyRoadRepairPath(points,width=.30,ignoreIds=[]){
  if(!points||points.length<=2)return points||[];
  const out=[points[0]];let i=0;
  while(i<points.length-1){
    let chosen=i+1;
    for(let j=points.length-1;j>i+1;j--){
      if(roadRepairSegmentClear(points[i],points[j],width,ignoreIds)){chosen=j;break}
    }
    out.push(points[chosen]);i=chosen;
  }
  return out;
}
function reactiveRoadExists(a,b,eps=.24){
  return roadList().some(r=>(dist(r.a,a)<eps&&dist(r.b,b)<eps)||(dist(r.a,b)<eps&&dist(r.b,a)<eps));
}
function addReactiveRoadPolyline(points,template={},meta={}){
  if(!points||points.length<2)return 0;
  const width=Number(template.width)||.30,clean=simplifyRoadRepairPath(points,width,meta.ignoreIds||[]);
  let added=0,total=Math.max(1,clean.length-1);
  for(let i=0;i<clean.length-1;i++){
    const a=clean[i],b=clean[i+1];if(dist(a,b)<.24||reactiveRoadExists(a,b))continue;
    const road={
      id:uid(),type:'road',auto:true,roadClass:meta.roadClass||'reactive',
      a:{...a},b:{...b},width,appeal:.95,reactive:true,
      parentRoadId:template.parentRoadId||null
    };
    if(template.routeId)road.routeId=template.routeId;
    if(Number.isFinite(template.routeSeq))road.routeSeq=template.routeSeq+i/total;
    if(meta.repairFor)road.repairFor=meta.repairFor;
    if(meta.accessFor)road.accessFor=meta.accessFor;
    beginConstruction(road);State.structures.push(road);added++;
  }
  return added;
}
function arterialRoutePlan(routeId){
  return ensureRoadPlan().find(r=>r.id===routeId)||null;
}
function arterialSegmentOrderValue(r){
  return Number.isFinite(Number(r.routeSeq))?Number(r.routeSeq):0;
}
function arterialRouteContinuous(routeId){
  const well=State.structures.find(s=>s.id===State.village.wellId),plan=arterialRoutePlan(routeId);
  const roads=routeRoads(routeId);if(!well||!plan||!roads.length)return false;
  let cursor={x:well.x,y:well.y};
  for(const r of roads){
    if(dist(cursor,r.a)<=.42)cursor={...r.b};
    else if(dist(cursor,r.b)<=.42)cursor={...r.a};
    else return false;
  }
  return !plan.connected||dist(cursor,plan.target)<=.65;
}
function arterialSourceSegments(routeId,displaced=[]){
  const map=new Map();
  for(const r of [...routeRoads(routeId),...(displaced||[])]){
    if(r.routeId!==routeId)continue;
    const key=(Number.isFinite(Number(r.routeSeq))?Number(r.routeSeq).toFixed(5):r.id);
    // Prefer the displaced/original segment when duplicate metadata exists.
    map.set(key,r);
  }
  return [...map.values()].sort((a,b)=>arterialSegmentOrderValue(a)-arterialSegmentOrderValue(b));
}
function arterialSafeWaypoints(routeId,displaced=[]){
  const well=State.structures.find(s=>s.id===State.village.wellId),plan=arterialRoutePlan(routeId);
  if(!well||!plan)return[];
  const source=arterialSourceSegments(routeId,displaced),width=.62,ignore=[well.id];
  const pts=[{x:well.x,y:well.y}];

  // Preserve the established arterial geometry wherever it is still valid.
  for(const r of source){
    const p={...r.b};
    if(dist(p,pts.at(-1))<.45)continue;
    if(roadRepairPointClear(p,width,ignore))pts.push(p);
  }

  if(plan.connected){
    if(dist(pts.at(-1),plan.target)>.35)pts.push({...plan.target});
  }else if(source.length){
    // An incomplete route should only be rebuilt to its previous frontier,
    // never be magically completed to the border.
    const frontier={...source.at(-1).b};
    if(dist(pts.at(-1),frontier)>.35)pts.push(frontier);
  }
  return pts;
}
function buildArterialRepairPolyline(routeId,displaced=[]){
  const well=State.structures.find(s=>s.id===State.village.wellId),waypoints=arterialSafeWaypoints(routeId,displaced);
  if(!well||waypoints.length<2)return null;
  const width=.62,ignore=[well.id],full=[waypoints[0]];
  for(let i=0;i<waypoints.length-1;i++){
    const a=full.at(-1),b=waypoints[i+1];let leg=null;
    if(roadRepairSegmentClear(a,b,width,ignore))leg=[a,b];
    else leg=findRoadRepairPath(a,b,width,12,ignore,60000);
    if(!leg||leg.length<2)return null;
    for(let j=1;j<leg.length;j++){
      const p=leg[j];if(dist(full.at(-1),p)>.08)full.push(p);
    }
  }
  return simplifyRoadRepairPath(full,width,ignore);
}
function subdivideRoadPolyline(points,maxLen=5.0){
  if(!points||points.length<2)return points||[];
  const out=[{...points[0]}];
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],L=dist(a,b),n=Math.max(1,Math.ceil(L/maxLen));
    for(let k=1;k<=n;k++){
      const t=k/n;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
  }
  return out;
}
function refreshStaleHouseRoadRefs(){
  const roads=roadList(true);if(!roads.length)return;
  for(const h of autoList('house')){
    if(h.roadId&&State.structures.some(r=>r.id===h.roadId&&r.type==='road'))continue;
    let best=null,bestD=Infinity;
    for(const r of roads){
      const d=pointSegmentDistance(h,r.a,r.b);
      if(d<bestD){best=r;bestD=d}
    }
    if(best)h.roadId=best.id;
  }
}
function rebuildArterialRoute(routeId,displaced=[]){
  const plan=arterialRoutePlan(routeId),path=buildArterialRepairPolyline(routeId,displaced);
  if(!plan||!path||path.length<2)return 0;

  // Only replace the route after a complete valid path has been found.
  State.structures=State.structures.filter(r=>!(r.type==='road'&&r.routeId===routeId));
  const pts=subdivideRoadPolyline(path,ROAD_RULES.arterialSegmentMax);
  let added=0,parent=null;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];if(dist(a,b)<.18)continue;
    const road={
      id:uid(),type:'road',auto:true,roadClass:'arterial',routeId,routeSeq:added,
      a:{...a},b:{...b},width:.62,appeal:1,parentRoadId:parent,
      reactive:true,arterialRebuilt:true
    };
    // Route repair is topology restoration, not a new growth event: it becomes usable immediately.
    State.structures.push(road);parent=road.id;added++;
  }
  refreshStaleHouseRoadRefs();
  peasantPathSignature='';peasantPathCache.clear();
  return added;
}
function reconcileArterialRoutes(){
  let changed=0;
  for(const route of ensureRoadPlan()){
    const roads=routeRoads(route.id);
    if(roads.length&&!arterialRouteContinuous(route.id))changed+=rebuildArterialRoute(route.id,[]);
  }
  return changed;
}
function repairDisplacedRoads(displaced,manual){
  let added=0;
  const all=displaced||[],arterialIds=[...new Set(all.filter(r=>r.routeId).map(r=>r.routeId))];

  // Primary roads are repaired as complete ordered routes, not as isolated deleted pieces.
  for(const routeId of arterialIds){
    const affected=all.filter(r=>r.routeId===routeId);
    const rebuilt=rebuildArterialRoute(routeId,affected);
    if(rebuilt)added+=rebuilt;
    else{
      // Conservative fallback: if a full route cannot be resolved, at least try each missing span.
      for(const old of affected){
        const well=State.structures.find(s=>s.id===State.village.wellId),ignore=well?[well.id]:[];
        const path=findRoadRepairPath(old.a,old.b,Number(old.width)||.62,12,ignore,50000);
        if(path)added+=addReactiveRoadPolyline(path,old,{repairFor:manual.id,roadClass:'arterial-repair'});
      }
    }
  }

  for(const old of all.filter(r=>!r.routeId)){
    const path=findRoadRepairPath(old.a,old.b,Number(old.width)||.30,10,[]);
    if(path)added+=addReactiveRoadPolyline(path,old,{repairFor:manual.id,roadClass:old.roadClass||'repair'});
  }
  return added;
}
function gateMainRouteId(gate){return 'gate-main:'+gate.id}
function gateMainRouteContinuous(gate){
  const well=State.structures.find(s=>s.id===State.village.wellId),roads=routeRoads(gateMainRouteId(gate));
  if(!well||!roads.length)return false;
  const passage=gatePassageInfo(gate,well);if(!passage)return false;
  let cursor={x:well.x,y:well.y};
  for(const r of roads){
    if(dist(cursor,r.a)<=.48)cursor={...r.b};
    else if(dist(cursor,r.b)<=.48)cursor={...r.a};
    else return false;
  }
  return dist(cursor,passage.far)<=.72;
}
function buildGateMainConnection(gate,force=false){
  const well=State.structures.find(s=>s.id===State.village.wellId);
  if(!gate||gate.type!=='gate'||underConstruction(gate)||!well||underConstruction(well))return 0;
  const routeId=gateMainRouteId(gate);
  if(!force&&gateMainRouteContinuous(gate))return 0;

  const passage=gatePassageInfo(gate,well);if(!passage)return 0;
  const ignore=[well.id],width=.62;
  let approach;
  if(roadRepairSegmentClear({x:well.x,y:well.y},passage.near,width,ignore)){
    approach=[{x:well.x,y:well.y},{...passage.near}];
  }else{
    approach=findRoadRepairPath({x:well.x,y:well.y},passage.near,width,16,ignore,80000);
  }
  if(!approach||approach.length<2)return 0;

  const full=approach.slice();
  for(const p of [passage.center,passage.far]){
    if(dist(full.at(-1),p)>.08)full.push({...p});
  }
  // Validate the explicit passage itself. Gate corridor is transparent, while
  // neighboring walls/towers remain true blockers.
  if(!roadRepairSegmentClear(passage.near,passage.center,width,ignore)||
     !roadRepairSegmentClear(passage.center,passage.far,width,ignore))return 0;

  const clean=simplifyRoadRepairPath(full,width,ignore),pts=subdivideRoadPolyline(clean,ROAD_RULES.arterialSegmentMax);
  if(pts.length<2)return 0;

  // Atomic replacement: the previous gate artery remains until a valid new path exists.
  State.structures=State.structures.filter(r=>!(r.type==='road'&&r.routeId===routeId));
  let added=0,parent=null;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];if(dist(a,b)<.16)continue;
    const road={
      id:uid(),type:'road',auto:true,roadClass:'arterial-gate',
      routeId,routeSeq:added,a:{...a},b:{...b},width,appeal:1,
      parentRoadId:parent,gateFor:gate.id,reactive:true
    };
    // A gate becomes part of the primary network as soon as it is completed.
    State.structures.push(road);parent=road.id;added++;
  }
  refreshStaleHouseRoadRefs();
  peasantPathSignature='';peasantPathCache.clear();
  return added;
}
function reconcileGateMainConnections(force=false){
  let changed=0;
  const liveGateIds=new Set();
  for(const gate of State.structures){
    if(gate.type!=='gate'||underConstruction(gate))continue;
    liveGateIds.add(gate.id);
    changed+=buildGateMainConnection(gate,force);
  }
  const before=State.structures.length;
  State.structures=State.structures.filter(s=>!s.gateFor||liveGateIds.has(s.gateFor));
  changed+=before-State.structures.length;
  return changed;
}
function nearestRoadProjection(p,excludeAccessFor=null){
  let best=null,bestD=Infinity;
  for(const r of roadList(true)){
    if(excludeAccessFor&&r.accessFor===excludeAccessFor)continue;
    const q=closestPointOnSegment(p,r.a,r.b),d=dist(p,q);
    if(d<bestD){best={road:r,point:q,d};bestD=d}
  }
  return best;
}
function nearestPrimaryRoadProjection(p){
  let best=null,bestD=Infinity;
  for(const r of primaryRoadList(true)){
    const q=closestPointOnSegment(p,r.a,r.b),d=dist(p,q);
    if(d<bestD){best={road:r,point:q,d};bestD=d}
  }
  return best;
}
function fieldRoadAccessPoint(field,target){
  const q=toLocalPoint(field,target),hw=Math.max(.1,(Number(field.w)||2)/2),hh=Math.max(.1,(Number(field.h)||2)/2);
  let x=clamp(q.x,-hw,hw),y=clamp(q.y,-hh,hh);
  const nx=Math.abs(q.x)/hw,ny=Math.abs(q.y)/hh;
  if(nx>=ny)x=(q.x>=0?1:-1)*hw;
  else y=(q.y>=0?1:-1)*hh;
  const edge=houseLocalToWorld(field,x,y),center={x:field.x,y:field.y};
  const dx=edge.x-center.x,dy=edge.y-center.y,L=Math.hypot(dx,dy)||1;
  return{x:edge.x+dx/L*.28,y:edge.y+dy/L*.28};
}
function settlementRoadAccessPoint(s,target){
  if(s.type==='house')return houseDoorInfo(s).outside;
  if(s.type==='field')return fieldRoadAccessPoint(s,target);
  if(s.type==='market')return marketRoadAccessPoint(s,target);
  if(s.type==='training')return fieldRoadAccessPoint({...s,w:5,h:4},target);
  if(s.type==='tavern'||s.type==='church')return civicEntranceInfo(s)?.outside||structureCenter(s);
  return structureCenter(s);
}
function settlementAccessTargets(){
  return State.structures.filter(s=>
    !underConstruction(s)&&(
      s.type==='house'||s.type==='field'||isCivic(s)
    )
  );
}
function rebuildSecondaryRoadsOnLoad(){
  let removed=0;
  State.structures=State.structures.filter(s=>{
    // Primary arterial routes and gate-main routes always carry routeId.
    // Everything else is derived access geometry and is rebuilt from current
    // entrances/fields against the current primary network on every reload.
    if(s.type==='road'&&!s.routeId){removed++;return false}
    return true;
  });
  State.village.accessRoadVersion=2;
  refreshStaleHouseRoadRefs();
  peasantPathSignature='';peasantPathCache.clear();
  return removed;
}
function ensureSettlementRoadAccess(s){
  if(!s||underConstruction(s))return 0;
  if(State.structures.some(r=>r.type==='road'&&r.accessFor===s.id))return 0;
  const nearest=nearestPrimaryRoadProjection(structureCenter(s));if(!nearest)return 0;
  const start=settlementRoadAccessPoint(s,nearest.point),goal=nearest.point;
  if(!start||dist(start,goal)<.58)return 0;
  const width=s.type==='market'?.34:s.type==='field'?.26:.30;
  const ignore=[s.id];
  let path;
  if(roadRepairSegmentClear(start,goal,width,ignore))path=[start,goal];
  else path=findRoadRepairPath(start,goal,width,10,ignore,45000);
  if(!path||path.length<2)return 0;
  return addReactiveRoadPolyline(path,{width,parentRoadId:nearest.road.id},{
    accessFor:s.id,roadClass:'access-primary',ignoreIds:ignore
  });
}
function reconcileSettlementAccessRoads(limit=Infinity){
  let changed=0,done=0;
  for(const s of settlementAccessTargets()){
    if(done>=limit)break;
    if(State.structures.some(r=>r.type==='road'&&r.accessFor===s.id))continue;
    const n=ensureSettlementRoadAccess(s);
    if(n){changed+=n;done++}
  }
  if(changed){peasantPathSignature='';peasantPathCache.clear()}
  return changed;
}
function marketRoadAccessPoint(s,target){
  const q=toLocalPoint(s,target),m=Math.max(Math.abs(q.x),Math.abs(q.y),.001),scale=2.04/m;
  return houseLocalToWorld(s,q.x*scale,q.y*scale);
}
function civicRoadAccessPoint(s,roadPoint){
  if(s.type==='market')return marketRoadAccessPoint(s,roadPoint);
  return civicEntranceInfo(s)?.outside||structureCenter(s);
}
function ensureCivicRoadAccess(s){
  return isCivic(s)?ensureSettlementRoadAccess(s):0;
}
function roadEndpointDegree(p){
  let degree=0;
  for(const r of roadList(true)){
    if(dist(p,r.a)<.28||dist(p,r.b)<.28)degree++;
    else if(pointSegmentDistance(p,r.a,r.b)<.18)degree++;
  }
  return degree;
}
function repairExistingCivicRoadGap(s){
  if(!isCivic(s)||State.structures.some(r=>r.type==='road'&&r.repairFor===s.id))return 0;
  const center=structureCenter(s),radius=civicRadius(s)+5.5,endpoints=[];
  for(const r of roadList(true)){
    for(const p of [r.a,r.b]){
      if(dist(p,center)>radius||roadEndpointDegree(p)!==1)continue;
      if(Math.min(Math.abs(p.x-BUILD_MIN),Math.abs(p.x-BUILD_MAX),Math.abs(p.y-BUILD_MIN),Math.abs(p.y-BUILD_MAX))<.7)continue;
      endpoints.push({p:{...p},road:r});
    }
  }
  let best=null,bestScore=Infinity;
  for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++){
    const a=endpoints[i],b=endpoints[j],d=dist(a.p,b.p);if(d<1.2||d>13)continue;
    const probe={type:'road',a:a.p,b:b.p,width:Math.max(a.road.width||.3,b.road.width||.3)};
    if(s.type!=='market'&&!manualRoadConflict(probe,s))continue;
    const score=d+dist({x:(a.p.x+b.p.x)/2,y:(a.p.y+b.p.y)/2},center)*.4;
    if(score<bestScore){best={a,b,probe};bestScore=score}
  }
  if(!best)return 0;
  const path=findRoadRepairPath(best.a.p,best.b.p,best.probe.width,10,[]);
  if(!path)return 0;
  return addReactiveRoadPolyline(path,best.a.road,{repairFor:s.id,roadClass:'repair'});
}
function reconcileReactiveRoadNetwork(){
  let changed=0;
  changed+=reconcileArterialRoutes();
  changed+=reconcileGateMainConnections(false);
  changed+=reconcileSettlementAccessRoads();
  if(changed){peasantPathSignature='';peasantPathCache.clear()}
  return changed;
}
function nearestRoadInfo(p,roads){let best={d:Infinity,angle:0};for(const r of roads){const d=pointSegmentDistance(p,r.a,r.b);if(d<best.d)best={d,angle:Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)}}return best}
function autoBlocked(candidate,placed,manual,margin=.2){
  const p={x:candidate.x,y:candidate.y},r=pointRadius(candidate)+margin;
  if(environmentBlocksPoint(p,'settlement'))return true;
  for(const s of manual){if(['wall','built'].includes(s.type)){if(pointSegmentDistance(p,s.a,s.b)<=r+s.width/2)return true}else if(s.x!=null&&dist(p,s)<=r+pointRadius(s))return true}
  for(const s of placed){if(s.type==='road')continue;if(dist(p,s)<=r+pointRadius(s)+margin)return true}
  return false;
}
function biomeHash(name){let h=2166136261>>>0;for(const ch of name){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function makeEnvBlob(rnd,type,x,y,rx,ry,fill,edge,count=22,jitter=.16){
  const points=[];for(let i=0;i<count;i++){const a=Math.PI*2*i/count,j=1+(rnd()-.5)*2*jitter;points.push({x:x+Math.cos(a)*rx*j,y:y+Math.sin(a)*ry*j})}
  return{id:'env-'+type+'-'+Math.round(x*10)+'-'+Math.round(y*10),type,points,fill,edge,x,y,rx,ry};
}
function makeEnvEllipse(type,x,y,rx,ry,angle,fill,edge){return{id:'env-'+type+'-'+Math.round(x*10)+'-'+Math.round(y*10),type,x,y,rx,ry,angle,fill,edge}}
function makeEnvWater(rnd,type){
  const horizontal=rnd()>.30,pts=[],n=7;
  if(horizontal){
    const y0=70+rnd()*60;
    for(let i=0;i<n;i++){const t=i/(n-1);pts.push({x:t*WORLD,y:clamp(y0+(rnd()-.5)*(type==='river'?16:22),8,WORLD-8)})}
  }else{
    const x0=70+rnd()*60;
    for(let i=0;i<n;i++){const t=i/(n-1);pts.push({x:clamp(x0+(rnd()-.5)*(type==='river'?16:22),8,WORLD-8),y:t*WORLD})}
  }
  return{id:'env-'+type,type,points,width:type==='river'?3.2:1.25,fill:type==='river'?'#3a7684':'#4f8d95',edge:type==='river'?'#88b4b8':'#9cc6c6'};
}
function makeEnvSea(rnd){
  const sides=['north','east','south','west'],side=sides[Math.floor(rnd()*sides.length)],coast=[],n=14,depth=58+rnd()*28;
  for(let i=0;i<=n;i++){
    const t=i/n,wave=Math.sin(t*Math.PI*2+rnd()*1.2)*5+(rnd()-.5)*5;
    if(side==='north')coast.push({x:t*WORLD,y:depth+wave});
    if(side==='south')coast.push({x:t*WORLD,y:WORLD-depth-wave});
    if(side==='west')coast.push({x:depth+wave,y:t*WORLD});
    if(side==='east')coast.push({x:WORLD-depth-wave,y:t*WORLD});
  }
  let points;
  if(side==='north')points=[{x:0,y:0},{x:WORLD,y:0},...coast.slice().reverse()];
  else if(side==='south')points=[...coast,{x:WORLD,y:WORLD},{x:0,y:WORLD}];
  else if(side==='west')points=[{x:0,y:0},...coast,{x:0,y:WORLD}];
  else points=[{x:WORLD,y:0},{x:WORLD,y:WORLD},...coast.slice().reverse()];
  return{id:'env-sea',type:'sea',side,points,coastline:coast,fill:'#23505a',edge:'#86b3b5'};
}
function randomEnvPoint(rnd,margin=12){return{x:margin+rnd()*(WORLD-margin*2),y:margin+rnd()*(WORLD-margin*2)}}
function generateEnvironment(){
  const rnd=seedRand((State.seed^biomeHash(State.biome))>>>0),env=[];
  const addBlob=(type,count,small=false)=>{for(let i=0;i<count;i++){const p=randomEnvPoint(rnd,18),rx=small?4+rnd()*3:7+rnd()*4,ry=small?3+rnd()*2:4+rnd()*3;if(type==='forest')env.push(makeEnvBlob(rnd,'forest',p.x,p.y,rx,ry,'#2e3c1d','#5c7438',28,.10));else if(type==='mountain')env.push(makeEnvBlob(rnd,'mountain',p.x,p.y,rx,ry,'#56493c','#968470',24,.11));else if(type==='pond')env.push(makeEnvBlob(rnd,'pond',p.x,p.y,rx,ry,'#3f7f8a','#8ab9bd',20,.20))}};
  const addEllipse=(type,count)=>{for(let i=0;i<count;i++){const p=randomEnvPoint(rnd,18);if(type==='hill')env.push(makeEnvEllipse('hill',p.x,p.y,7+rnd()*4,4+rnd()*2,(rnd()-.5)*1.4,'#5c5235','#927b4f'));else env.push(makeEnvEllipse('rough',p.x,p.y,4.5+rnd()*2.5,3+rnd()*1.5,(rnd()-.5)*1.4,'rgba(105,92,54,.45)','rgba(155,132,79,.55)'))}};
  if(State.biome==='sea')env.push(makeEnvSea(rnd));
  if(State.biome==='valley'||State.biome==='mountains'){
    const count=State.biome==='mountains'?5+Math.floor(rnd()*3):3+Math.floor(rnd()*3);
    const side=rnd()<.5?'west':'east';
    for(let i=0;i<count;i++){
      const t=(i+1)/(count+1),x=side==='west'?52+rnd()*15:148-rnd()*15,y=50+t*100+(rnd()-.5)*10;
      env.push(makeEnvBlob(rnd,'mountain',x,y,8+rnd()*4,5+rnd()*3,'#56493c','#968470',24,.11));
    }
  }
  if(State.biome==='plains'){
    addEllipse('rough',1+Math.floor(rnd()*2));if(rnd()<.45)env.push(makeEnvWater(rnd,'stream'));if(rnd()<.55)addBlob('forest',1,true);
  }else if(State.biome==='hills'){
    addEllipse('hill',3+Math.floor(rnd()*2));addEllipse('rough',1+Math.floor(rnd()*2));if(rnd()<.55)addBlob('forest',1,true);
  }else if(State.biome==='valley'){
    env.push(makeEnvWater(rnd,'stream'));addEllipse('rough',1);
  }else if(State.biome==='river'){
    env.push(makeEnvWater(rnd,'river'));addBlob('forest',1+Math.floor(rnd()*2),true);if(rnd()<.55)addEllipse('hill',1);
  }else if(State.biome==='forest'){
    addBlob('forest',4+Math.floor(rnd()*3),true);env.push(makeEnvWater(rnd,'stream'));if(rnd()<.65)addBlob('pond',1,true);
  }else if(State.biome==='mountains'){
    env.push(makeEnvWater(rnd,'stream'));addEllipse('hill',1+Math.floor(rnd()*2));
  }else if(State.biome==='sea'){
    addEllipse('rough',1);if(rnd()<.55)addBlob('forest',1,true);
  }
  State.environment=env;
}
function pointInPolygon(point,pts){
  let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j],hit=((a.y>point.y)!==(b.y>point.y))&&(point.x<(b.x-a.x)*(point.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside}return inside;
}
function environmentContains(f,p,pad=0){
  if(['forest','mountain','pond','sea'].includes(f.type))return pointInPolygon(p,f.points);
  if(['hill','rough'].includes(f.type)){const ca=Math.cos(-(f.angle||0)),sa=Math.sin(-(f.angle||0)),dx=p.x-f.x,dy=p.y-f.y,x=dx*ca-dy*sa,y=dx*sa+dy*ca;return x*x/((f.rx+pad)*(f.rx+pad))+y*y/((f.ry+pad)*(f.ry+pad))<=1}
  if(['stream','river'].includes(f.type)){for(let i=0;i<f.points.length-1;i++)if(pointSegmentDistance(p,f.points[i],f.points[i+1])<=f.width/2+pad)return true}
  return false;
}
function environmentBlocksPoint(p,mode='settlement'){
  for(const f of State.environment){
    if(mode==='road'&&['sea','mountain','pond'].includes(f.type)&&environmentContains(f,p,.25))return true;
    if(mode==='settlement'&&['sea','mountain','pond','forest','river','stream'].includes(f.type)&&environmentContains(f,p,.20))return true;
  }
  return false;
}
function roadEnvironmentConflict(road){
  const len=dist(road.a,road.b),steps=Math.max(6,Math.ceil(len/.35));
  for(let i=1;i<steps;i++){const t=i/steps,p={x:road.a.x+(road.b.x-road.a.x)*t,y:road.a.y+(road.b.y-road.a.y)*t};if(environmentBlocksPoint(p,'road'))return true}
  return false;
}
function edgeSample(edge,t){
  const v=BUILD_MIN+t*(BUILD_MAX-BUILD_MIN);
  if(edge==='north')return{x:v,y:BUILD_MIN};if(edge==='south')return{x:v,y:BUILD_MAX};if(edge==='west')return{x:BUILD_MIN,y:v};return{x:BUILD_MAX,y:v};
}
function villageSeed(well){return (State.seed ^ Math.imul(Math.round(well.x*10),73856093) ^ Math.imul(Math.round(well.y*10),19349663))>>>0}
function rotPoint(cx,cy,x,y,a){const ca=Math.cos(a),sa=Math.sin(a);return{x:cx+x*ca-y*sa,y:cy+x*sa+y*ca}}
function roadList(completedOnly=false){return State.structures.filter(s=>s.auto&&s.type==='road'&&(!completedOnly||!underConstruction(s)))}
function primaryRoadList(completedOnly=false){return roadList(completedOnly).filter(r=>!!r.routeId)}
function autoList(type){return State.structures.filter(s=>s.auto&&(!type||s.type===type))}
function currentGrowthRadius(){
  const step=State.village.growthStep||0;
  return Math.min(18,5.2+step*.30);
}
function growthRng(step,salt=0){
  const well=State.structures.find(s=>s.id===State.village.wellId)||{x:100,y:100};
  return seedRand((villageSeed(well)^Math.imul(step+1,2654435761)^salt)>>>0);
}
function practicalEdges(){
  const sides=['north','east','south','west'];
  return sides.filter(side=>{
    let free=0,total=11;for(let i=0;i<total;i++){const p=edgeSample(side,(i+.5)/total);if(!environmentBlocksPoint(p,'road'))free++}
    return free>=Math.ceil(total*.55);
  });
}
function portalOnEdge(edge,rnd){
  const inset=10+rnd()*80;
  if(edge==='north')return{x:BUILD_MIN+inset,y:BUILD_MIN,edge};
  if(edge==='south')return{x:BUILD_MIN+inset,y:BUILD_MAX,edge};
  if(edge==='west')return{x:BUILD_MIN,y:BUILD_MIN+inset,edge};
  return{x:BUILD_MAX,y:BUILD_MIN+inset,edge};
}
function oppositeEdge(edge){return({north:'south',south:'north',east:'west',west:'east'})[edge]}
function ensureRoadPlan(){
  if(Array.isArray(State.village.roadPlan)&&State.village.roadPlan.length)return State.village.roadPlan;
  const well=State.structures.find(s=>s.id===State.village.wellId);if(!well)return[];
  const rnd=seedRand((villageSeed(well)^0x51f15e)>>>0),edges=practicalEdges();
  if(edges.length<2)return[];
  const first=edges[Math.floor(rnd()*edges.length)];
  const preferred=oppositeEdge(first),second=edges.includes(preferred)?preferred:edges.find(e=>e!==first);
  const chosen=[first,second];
  State.village.roadPlan=chosen.map((edge,i)=>({id:'arterial-'+i,edge,target:portalOnEdge(edge,rnd),connected:false}));
  State.village.baseRoadAngle=Math.atan2(State.village.roadPlan[0].target.y-well.y,State.village.roadPlan[0].target.x-well.x);
  return State.village.roadPlan;
}
function routeRoads(routeId){return roadList().filter(r=>r.routeId===routeId).sort((a,b)=>(a.routeSeq||0)-(b.routeSeq||0))}
function roadAngle(r){return Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)}
function angleDiff(a,b){let d=Math.abs(a-b)%(Math.PI*2);return d>Math.PI?Math.PI*2-d:d}
function sharesPoint(a,b,eps=.22){return dist(a.a,b.a)<eps||dist(a.a,b.b)<eps||dist(a.b,b.a)<eps||dist(a.b,b.b)<eps}
function segmentIntersectionPoint(a,b,c,d){
  const r={x:b.x-a.x,y:b.y-a.y},s={x:d.x-c.x,y:d.y-c.y},den=r.x*s.y-r.y*s.x;
  if(Math.abs(den)<1e-8)return null;
  const q={x:c.x-a.x,y:c.y-a.y},t=(q.x*s.y-q.y*s.x)/den,u=(q.x*r.y-q.y*r.x)/den;
  if(t>1e-5&&t<.99999&&u>1e-5&&u<.99999)return{x:a.x+t*r.x,y:a.y+t*r.y};
  return null;
}
function segmentDistance(a,b,c,d){
  if(segmentIntersectionPoint(a,b,c,d))return 0;
  return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function nearestRoadNode(p,excludeIds=[]){
  let best=null,bestD=Infinity;
  for(const r of roadList()){
    if(excludeIds.includes(r.id))continue;
    for(const q of [r.a,r.b]){const d=dist(p,q);if(d<bestD){bestD=d;best=q}}
  }
  return bestD<=ROAD_RULES.snapNodeDistance?{point:{...best},distance:bestD}:null;
}
function constrainRoadCandidate(candidate){
  if(dist(candidate.a,candidate.b)<1.7)return null;
  if(roadEnvironmentConflict(candidate))return null;
  const manual=State.structures.filter(s=>!s.auto&&s.id!==State.village.wellId);
  if(manual.some(s=>autoOverlapsManual(candidate,s)))return null;

  // Snap candidate end to a nearby network vertex.
  const node=nearestRoadNode(candidate.b,[candidate.parentRoadId].filter(Boolean));
  if(node&&dist(candidate.a,node.point)>=1.7)candidate.b=node.point;

  for(const r of roadList()){
    const startShared=dist(candidate.a,r.a)<.24||dist(candidate.a,r.b)<.24;
    const endShared=dist(candidate.b,r.a)<.24||dist(candidate.b,r.b)<.24;
    const sameRoute=candidate.routeId&&candidate.routeId===r.routeId;
    const ca=roadAngle(candidate),ra=roadAngle(r);

    // Crossings become T-junctions by shortening the candidate to the crossing.
    const ip=segmentIntersectionPoint(candidate.a,candidate.b,r.a,r.b);
    if(ip&&!startShared&&!endShared){
      if(dist(candidate.a,ip)<1.7)return null;
      candidate.b=ip;
      return candidate;
    }

    if(startShared&&!sameRoute){
      // Junction angle is measured between the two rays leaving the shared node.
      // Near-180° is a valid through-road; only near-collinear same-direction branches are rejected.
      const existingOut=dist(candidate.a,r.a)<.24?ra:ra+Math.PI;
      const d=angleDiff(ca,existingOut);
      if(d<ROAD_RULES.minJunctionAngle)return null;
    }

    if(!startShared&&!endShared){
      const dAngle=Math.min(angleDiff(ca,ra),angleDiff(ca,ra+Math.PI));
      if(dAngle<ROAD_RULES.minJunctionAngle&&segmentDistance(candidate.a,candidate.b,r.a,r.b)<ROAD_RULES.minParallelSpacing)return null;
    }
  }
  return dist(candidate.a,candidate.b)>=1.7?candidate:null;
}
function spawnArterial(step){
  const well=State.structures.find(s=>s.id===State.village.wellId),plan=ensureRoadPlan();if(!well||!plan.length)return false;
  for(const route of plan){
    if(routeRoads(route.id).length&&!arterialRouteContinuous(route.id))rebuildArterialRoute(route.id,[]);
  }
  const open=plan.filter(p=>!p.connected);if(!open.length)return false;
  // Alternate progress across the two border routes by choosing the one with fewer accepted segments.
  open.sort((p,q)=>routeRoads(p.id).length-routeRoads(q.id).length);
  const route=open[0],existing=routeRoads(route.id),a=existing.length?{...existing[existing.length-1].b}:{x:well.x,y:well.y};
  const target=route.target,remaining=dist(a,target);if(remaining<.35){route.connected=true;return false}
  const rnd=growthRng(step,401+existing.length),len=Math.min(remaining,ROAD_RULES.arterialSegmentMin+rnd()*(ROAD_RULES.arterialSegmentMax-ROAD_RULES.arterialSegmentMin));
  const desired=Math.atan2(target.y-a.y,target.x-a.x);
  // Global goal = radial/portal direction, with only gentle noise; this keeps the route organic without becoming a grid.
  const curvature=(rnd()-.5)*.26*(remaining>8?1:.45),heading=desired+curvature;
  let b=remaining<=ROAD_RULES.arterialSegmentMax?{x:target.x,y:target.y}:{x:a.x+Math.cos(heading)*len,y:a.y+Math.sin(heading)*len};
  const road=constrainRoadCandidate(beginConstruction({id:uid(),type:'road',auto:true,roadClass:'arterial',routeId:route.id,routeSeq:existing.length,a,b,width:.62,appeal:1,parentRoadId:existing.at(-1)?.id||null}));
  if(!road)return false;
  State.structures.push(road);
  if(dist(road.b,target)<.35)route.connected=true;
  return true;
}
function candidateBranchOrigins(rnd){
  const well=State.structures.find(s=>s.id===State.village.wellId);if(!well)return[];
  const roads=roadList(true).filter(r=>dist({x:(r.a.x+r.b.x)/2,y:(r.a.y+r.b.y)/2},well)<=currentGrowthRadius()+1.5);
  const out=[];
  for(const r of roads){
    const t=.24+rnd()*.52,p={x:r.a.x+(r.b.x-r.a.x)*t,y:r.a.y+(r.b.y-r.a.y)*t};
    let nearest=Infinity;
    for(const other of roadList())for(const q of [other.a,other.b])nearest=Math.min(nearest,dist(p,q));
    if(nearest>=ROAD_RULES.branchSpawnSpacing)out.push({road:r,p});
  }
  return out;
}
function spawnLocalRoad(step){
  return reconcileSettlementAccessRoads(1)>0;
}
function spawnRoad(step){
  const plan=ensureRoadPlan(),incomplete=plan.some(p=>!p.connected);
  if(incomplete)return spawnArterial(step);
  return spawnLocalRoad(step);
}
function spawnHouse(step){
  const well=State.structures.find(s=>s.id===State.village.wellId),roads=primaryRoadList(true);if(!well||!roads.length)return false;
  const rnd=growthRng(step,211),radius=currentGrowthRadius(),manual=State.structures.filter(s=>!s.auto),placed=autoList().filter(s=>s.type!=='road');
  const candidates=[];
  for(let i=0;i<90;i++){
    const road=roads[Math.floor(rnd()*roads.length)],t=.12+rnd()*.76;
    const q={x:road.a.x+(road.b.x-road.a.x)*t,y:road.a.y+(road.b.y-road.a.y)*t};
    const ang=roadAngle(road),side=rnd()<.5?-1:1,offset=1.15+rnd()*1.35;
    const p={x:q.x-Math.sin(ang)*offset*side,y:q.y+Math.cos(ang)*offset*side};
    const d=dist(p,well);if(d>radius||d<1.7||!inBuild(p))continue;
    const core=Math.exp(-Math.pow(d-Math.min(6.5,radius*.62),2)/(2*3.0*3.0));
    const score=core*1.2+(1-offset/3)*.65+rnd()*.20;
    candidates.push({p,ang,score,roadId:road.id,doorSide:-side});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates.slice(0,24)){
    const h=beginConstruction({id:uid(),type:'house',auto:true,x:snapGrid(c.p.x),y:snapGrid(c.p.y),w:rnd()>.78?2:1.5,h:1,angle:c.ang,appeal:c.score,roadId:c.roadId,doorSide:c.doorSide});
    if(!autoBlocked(h,placed,manual,.38)){State.structures.push(h);ensureSettlementRoadAccess(h);return true}
  }
  return false;
}
function spawnField(step){
  const well=State.structures.find(s=>s.id===State.village.wellId),roads=primaryRoadList(true);if(!well||!roads.length)return false;
  const rnd=growthRng(step,307),radius=currentGrowthRadius()+4,manual=State.structures.filter(s=>!s.auto),placed=autoList().filter(s=>s.type!=='road');
  const houses=autoList('house');if(houses.length<5)return false;
  const inner=Math.max(6.5,currentGrowthRadius()*.72),outer=Math.min(22,radius+4),candidates=[];
  for(let i=0;i<110;i++){
    const d=inner+rnd()*(outer-inner),th=rnd()*Math.PI*2,p={x:well.x+Math.cos(th)*d,y:well.y+Math.sin(th)*d};
    if(!inBuild(p))continue;
    const road=nearestRoadInfo(p,roads),ring=Math.exp(-Math.pow(d-(inner+outer)*.5,2)/(2*4.2*4.2));
    const score=ring+.18*Math.exp(-road.d/4)+rnd()*.20;candidates.push({p,road,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates.slice(0,28)){
    const f=beginConstruction({id:uid(),type:'field',auto:true,x:snapGrid(c.p.x),y:snapGrid(c.p.y),w:2.6+rnd()*1.3,h:1.8+rnd()*1.1,angle:c.road.angle+(rnd()-.5)*.18,appeal:c.score});
    if(!autoBlocked(f,placed,manual,.65)){State.structures.push(f);ensureSettlementRoadAccess(f);return true}
  }
  return false;
}
function processVillageGrowth(){
  if(!State.village.founded)return;
  const well=State.structures.find(s=>s.id===State.village.wellId);if(!well||underConstruction(well))return;
  ensureRoadPlan();
  if(State.village.nextGrowthDay==null)State.village.nextGrowthDay=State.clock.day+.75;
  let guard=0;
  while(State.clock.day>=State.village.nextGrowthDay&&guard++<8){
    const step=State.village.growthStep||0,houses=autoList('house').length,roads=roadList().length,fields=autoList('field').length;
    let kind;
    if(roads===0)kind='road';
    else if(houses<2)kind='house';
    else{
      const rnd=growthRng(step,509)();
      if(houses>=5&&fields<Math.ceil(houses*.50)&&rnd<.17)kind='field';
      else if(rnd<.38)kind='road';
      else kind='house';
    }
    let ok=kind==='road'?spawnRoad(step):kind==='field'?spawnField(step):spawnHouse(step);
    if(!ok&&kind!=='house')ok=spawnHouse(step);
    if(!ok&&kind!=='road')ok=spawnRoad(step);
    State.village.growthStep=step+1;
    State.village.nextGrowthDay+=GROWTH_INTERVAL_DAYS;
    if(ok)markDirty();
  }
}
function resetLegacyVillageGrowth(){
  if(!State.village.founded||State.village.growthVersion===3)return;
  State.structures=State.structures.filter(s=>!s.auto);
  State.village.growthVersion=3;State.village.accessRoadVersion=0;State.village.growthStep=0;State.village.nextGrowthDay=State.clock.day+.75;State.village.roadPlan=null;State.village.baseRoadAngle=null;
}
function openVillageModal(well){
  State.pendingWellId=well.id;const modal=document.getElementById('foundVillageModal'),input=document.getElementById('villageNameInput');
  modal.classList.add('open');input.value=State.village.name||'';setTimeout(()=>input.focus(),0);
}
function closeVillageModal(){document.getElementById('foundVillageModal').classList.remove('open');State.pendingWellId=null}
function resize(){const r=wrap.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';screenCtx.setTransform(d,0,0,d,0,0);invalidateSceneCache();draw()}
function rotateViewPoint(p,turns=State.view.rotation||0){
  const q=((turns%4)+4)%4,c=WORLD/2,dx=p.x-c,dy=p.y-c;
  if(q===1)return{x:c-dy,y:c+dx};
  if(q===2)return{x:c-dx,y:c-dy};
  if(q===3)return{x:c+dy,y:c-dx};
  return{x:p.x,y:p.y};
}
function unrotateViewPoint(p,turns=State.view.rotation||0){return rotateViewPoint(p,-turns)}
function w2s(p,z=0){
  const q=rotateViewPoint(p),s=U*State.view.scale;
  return{x:State.view.x+(q.x-q.y)*s*ISO_X,y:State.view.y+(q.x+q.y)*s*ISO_Y-z*s*ISO_Z};
}
function s2w(x,y){
  const s=U*State.view.scale||1,a=(x-State.view.x)/(s*ISO_X),b=(y-State.view.y)/(s*ISO_Y);
  return unrotateViewPoint({x:(a+b)/2,y:(b-a)/2});
}
function fit(){
  const r=wrap.getBoundingClientRect(),availW=Math.max(260,r.width-610),availH=Math.max(220,r.height-90);
  const worldW=2*WORLD*U*ISO_X,worldH=2*WORLD*U*ISO_Y;
  State.view.scale=clamp(Math.min(availW/worldW,availH/worldH),.18,3);
  const h=worldH*State.view.scale;
  State.view.x=r.width/2-12;
  State.view.y=Math.max(38,(r.height-h)/2+20);
  invalidateSceneCache();draw();
}
function projectPath(points,z=0){
  return points.map(p=>w2s(p,z));
}
function pathPolygon(points,fill,stroke,lineWidth=1.2){
  if(!points?.length)return;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke()}
}
function rectWorldPoints(cx,cy,w,h,angle=0){
  const ca=Math.cos(angle),sa=Math.sin(angle),pts=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
  return pts.map(([x,y])=>({x:cx+x*ca-y*sa,y:cy+x*sa+y*ca}));
}
function circleWorldPoints(cx,cy,r,n=20){const pts=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;pts.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r})}return pts}
function structureHeight(s){
  if(!s)return 0;
  if(s.type==='tower'){const l=structureLevel(s),t=towerTier(s);return [2.35,3.55,4.75][l-1]+(t-1)*.12}
  if(s.type==='gate')return [2.8,4.0,5.2][structureLevel(s)-1];
  if(s.type==='wall')return [1.15,2.10][structureLevel(s)-1];
  if(s.type==='built')return [1.75,2.80][structureLevel(s)-1];
  if(s.type==='well')return .42;
  if(s.type==='house')return houseStructureHeight(s);
  if(s.type==='market')return .78;
  if(s.type==='tavern')return 2.15;
  if(s.type==='church')return 3.35;
  if(s.type==='training')return .10;
  return 0;
}
function footprintPoints(s){
  if(!s)return[];
  if(s.type==='tower'&&s.shape==='round')return circleWorldPoints(s.x,s.y,s.r,24);
  if(['tower','gate'].includes(s.type)){const d=rectDims(s);return rectWorldPoints(s.x,s.y,d.w,d.h,s.angle||0)}
  if(s.type==='well')return circleWorldPoints(s.x,s.y,.62,20);
  if(['wall','built'].includes(s.type))return linePoly(s);
  if(s.type==='house'){
    const parts=houseFootprintParts(s),pts=parts.flatMap(p=>p.points);
    if(parts.length===1)return pts;
    const cx=pts.reduce((a,p)=>a+p.x,0)/pts.length,cy=pts.reduce((a,p)=>a+p.y,0)/pts.length;
    return pts.slice().sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
  }
  if(s.type==='field')return rectWorldPoints(s.x,s.y,s.w,s.h,s.angle||0);
  if(isCivic(s)){
    const pts=civicParts(s).flatMap(p=>p.points);
    if(!pts.length)return[];
    const cx=pts.reduce((a,p)=>a+p.x,0)/pts.length,cy=pts.reduce((a,p)=>a+p.y,0)/pts.length;
    return pts.slice().sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
  }
  return[];
}
function extrudePolygon(worldPts,height,{top:topColor='#8c7b69',sideA='#554b42',sideB='#66594d',stroke='#d8c8b4'}={}){
  if(!worldPts?.length)return;
  const base=projectPath(worldPts,0),topPts=projectPath(worldPts,height),faces=[];
  for(let i=0;i<worldPts.length;i++){
    const j=(i+1)%worldPts.length,quad=[base[i],base[j],topPts[j],topPts[i]],depth=(base[i].y+base[j].y)/2;
    faces.push({quad,depth,i});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.quad,f.i%2?sideA:sideB,null);
  pathPolygon(topPts,topColor,stroke,1.2);
}
function extrudePolygonAt(worldPts,z0,z1,{top:topColor='#8c7b69',sideA='#554b42',sideB='#66594d',stroke='#d8c8b4'}={}){
  if(!worldPts?.length||z1<=z0)return;
  const base=projectPath(worldPts,z0),topPts=projectPath(worldPts,z1),faces=[];
  for(let i=0;i<worldPts.length;i++){
    const j=(i+1)%worldPts.length,quad=[base[i],base[j],topPts[j],topPts[i]],depth=(base[i].y+base[j].y)/2;
    faces.push({quad,depth,i});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.quad,f.i%2?sideA:sideB,null);
  pathPolygon(topPts,topColor,stroke,1);
}
let castleUnionCache={key:null,bands:null};
function isCastlePart(s){return !s.auto&&['tower','gate','wall','built'].includes(s.type)}
function hasCastleSnap(id){return !!id&&State.structures.some(x=>x.id===id&&['tower','gate'].includes(x.type))}
function unionFootprintPoints(s){
  if(!['wall','built'].includes(s.type))return footprintPoints(s);
  let a={...s.a},b={...s.b},dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,u={x:dx/L,y:dy/L};
  const overlap=clamp(.06+(Number(s.width)||.5)*.22,.09,.28);
  if(hasCastleSnap(s.aSnap))a={x:a.x-u.x*overlap,y:a.y-u.y*overlap};
  if(hasCastleSnap(s.bSnap))b={x:b.x+u.x*overlap,y:b.y+u.y*overlap};
  dx=b.x-a.x;dy=b.y-a.y;const LL=Math.hypot(dx,dy)||1,nx=-dy/LL*s.width/2,ny=dx/LL*s.width/2;
  return[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}];
}
function polygonGeomForStructure(s){
  const pts=unionFootprintPoints(s);if(!pts||pts.length<3)return null;
  return [pts.map(p=>[p.x,p.y])];
}
function castleUnionBands(){
  const pc=window.__polygonClipping;if(!pc)return null;
  const items=State.structures.filter(s=>isCastlePart(s)&&!underConstruction(s));
  if(!items.length)return[];
  const descriptors=items.map(s=>({id:s.id,h:+structureHeight(s).toFixed(4),geom:polygonGeomForStructure(s)})).filter(x=>x.geom);
  const key=JSON.stringify(descriptors);
  if(castleUnionCache.key===key)return castleUnionCache.bands;
  const heights=[...new Set(descriptors.map(x=>x.h))].sort((a,b)=>a-b),bands=[];let z0=0;
  try{
    for(const z1 of heights){
      const active=descriptors.filter(x=>x.h>=z1-1e-6).map(x=>x.geom);
      if(!active.length){z0=z1;continue}
      const geometry=pc.union(...active);
      bands.push({z0,z1,geometry});
      z0=z1;
    }
  }catch(err){
    console.warn('Castle polygon union failed',err);
    castleUnionCache={key,bands:null};return null;
  }
  castleUnionCache={key,bands};return bands;
}
function cleanClipRing(ring){
  if(!ring||ring.length<3)return[];
  const pts=ring.map(([x,y])=>({x,y}));
  if(pts.length>1&&Math.abs(pts[0].x-pts.at(-1).x)<1e-8&&Math.abs(pts[0].y-pts.at(-1).y)<1e-8)pts.pop();
  return pts;
}
function fillMultiPolygonTop(multi,z,fill,stroke){
  ctx.save();ctx.beginPath();
  for(const poly of multi||[])for(const ring of poly||[]){
    const pts=cleanClipRing(ring).map(p=>w2s(p,z));if(pts.length<3)continue;
    ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath();
  }
  ctx.fillStyle=fill;ctx.fill('evenodd');
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.15;ctx.stroke()}
  ctx.restore();
}
function castleSideShade(a,b){
  // Use the real edge orientation, not projected screen dx. Opposite faces
  // share a tone while perpendicular faces receive the other tone, exactly
  // like sideA/sideB on the battlement blocks. This stays stable through all
  // four camera rotations and also gives round towers readable faceting.
  const qa=rotateViewPoint(a),qb=rotateViewPoint(b);
  const angle=Math.atan2(qb.y-qa.y,qb.x-qa.x);
  const light=Math.cos(2*(angle-Math.PI/6));
  return light>=0?'#635951':'#514a44';
}
function drawMultiPolygonBand(multi,z0,z1){
  if(!multi?.length)return;
  const faces=[];
  // A tiny downward overlap makes adjacent height bands paint over the
  // antialiased edge of the band below, removing false horizontal rings.
  const seamOverlap=z0>0?Math.min(.018,(z1-z0)*.08):0;
  const baseZ=Math.max(0,z0-seamOverlap);
  for(const poly of multi)for(const ring of poly){
    const pts=cleanClipRing(ring);if(pts.length<3)continue;
    for(let i=0;i<pts.length;i++){
      const j=(i+1)%pts.length,b0=w2s(pts[i],baseZ),b1=w2s(pts[j],baseZ),t1=w2s(pts[j],z1),t0=w2s(pts[i],z1);
      const shade=castleSideShade(pts[i],pts[j]);
      faces.push({poly:[b0,b1,t1,t0],depth:(b0.y+b1.y)/2,shade});
    }
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.shade,null);
  // Important: do NOT draw a top face for every height band.
}
function drawExposedTop(multi,z){
  if(!multi?.length)return;
  fillMultiPolygonTop(multi,z,'#9a8e82','#635951');
}
function drawCastleUnion(){
  const bands=castleUnionBands();if(!bands)return false;
  const pc=window.__polygonClipping;
  // Correct painter order: finish one vertical band, draw only its exposed
  // horizontal surface, then continue with the taller band above it.
  // Drawing all tops at the end makes lower terraces paint over taller walls.
  for(let i=0;i<bands.length;i++){
    const band=bands[i],next=bands[i+1];
    drawMultiPolygonBand(band.geometry,band.z0,band.z1);
    let exposed=band.geometry;
    if(next&&pc){
      try{exposed=pc.difference(band.geometry,next.geometry)}catch(err){exposed=band.geometry}
    }
    drawExposedTop(exposed,band.z1);
  }
  return true;
}
function drawCastleUnionDetails(){
  for(const s of State.structures){
    if(!isCastlePart(s)||underConstruction(s))continue;
    if(s.type==='built'){
      drawBuiltDetails(s,false);
      if(builtSkin(s)==='arcade')drawBuiltArcade(s);
    }
    if(s.type==='wall'&&wallSkin(s)==='hoarding')drawWallHoarding(s);
    if(['tower','gate'].includes(s.type)){
      const h=structureHeight(s),a=w2s({x:s.x,y:s.y},h+.03),q={x:s.x+Math.cos(s.angle||0)*.55,y:s.y+Math.sin(s.angle||0)*.55},b=w2s(q,h+.03);
      ctx.save();ctx.strokeStyle='rgba(245,226,202,.48)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
    }
  }
}
function drawCastleSelection(){
  const s=selectedStructure();if(!s||!isCastlePart(s)||underConstruction(s))return;
  const pts=projectPath(footprintPoints(s),structureHeight(s));if(pts.length<3)return;
  ctx.save();ctx.strokeStyle='#f4b76f';ctx.lineWidth=2;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.restore();
}

function worldDepth(s){const p=rotateViewPoint(structureCenter(s));return p.x+p.y;}
function pointInScreenPolygon(p,poly){
  let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j],hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside;
  }return inside;
}
function screenHitStructure(s,p){
  if(s.type==='house'||isCivic(s)){
    const parts=s.type==='house'?houseFootprintParts(s):civicParts(s);
    const h=structureHeight(s);
    for(const part of parts){
      const ph=part.role==='plaza'?.78:part.role==='tower'?h:Math.min(h,s.type==='church'?2.52:h);
      const fp=part.points,base=projectPath(fp,0),top=projectPath(fp,ph);
      if(pointInScreenPolygon(p,base)||pointInScreenPolygon(p,top))return true;
      for(let i=0;i<fp.length;i++){const j=(i+1)%fp.length;if(pointInScreenPolygon(p,[base[i],base[j],top[j],top[i]]))return true}
    }
    return false;
  }
  const fp=footprintPoints(s);if(fp.length<3)return false;const h=structureHeight(s),base=projectPath(fp,0),top=projectPath(fp,h);
  if(pointInScreenPolygon(p,base)||pointInScreenPolygon(p,top))return true;
  for(let i=0;i<fp.length;i++){const j=(i+1)%fp.length;if(pointInScreenPolygon(p,[base[i],base[j],top[j],top[i]]))return true}
  return false;
}
function seedRand(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296}}
function drawTerrain(){
  const corners=projectPath([{x:0,y:0},{x:WORLD,y:0},{x:WORLD,y:WORLD},{x:0,y:WORLD}],0);
  pathPolygon(corners,BIOMES[State.biome]?.field||'#24291b','rgba(225,214,190,.12)',1);
  const rnd=seedRand((State.seed^0x45d9f3b)>>>0);
  ctx.save();
  for(let i=0;i<260;i++){
    const p=w2s({x:rnd()*WORLD,y:rnd()*WORLD}),r=(.5+rnd()*1.7)*Math.max(.45,State.view.scale);
    ctx.fillStyle=rnd()>.55?'rgba(84,105,55,.12)':'rgba(137,120,70,.08)';
    ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.7,r,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawRaisedFan(f,height){
  const base=f.points,center={x:f.x,y:f.y},top=w2s(center,height),faces=[];
  for(let i=0;i<base.length;i++){
    const j=(i+1)%base.length,a=w2s(base[i]),b=w2s(base[j]);
    faces.push({poly:[a,b,top],depth:(a.y+b.y)/2,i});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const q of faces)pathPolygon(q.poly,q.i%2?'#55493d':'#66584a','rgba(170,150,125,.35)',.8);
}
function drawTree(p,scale=1){
  const a=w2s(p,0),b=w2s(p,1.25*scale);ctx.strokeStyle='rgba(73,52,32,.85)';ctx.lineWidth=Math.max(1,1.4*State.view.scale);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.fillStyle='rgba(42,66,31,.92)';ctx.beginPath();ctx.arc(b.x,b.y,Math.max(2.2,4.2*State.view.scale*scale),0,Math.PI*2);ctx.fill();
}
function ellipseWorldPoints(f,n=28){
  const pts=[],ca=Math.cos(f.angle||0),sa=Math.sin(f.angle||0);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=Math.cos(a)*f.rx,y=Math.sin(a)*f.ry;pts.push({x:f.x+x*ca-y*sa,y:f.y+x*sa+y*ca})}
  return pts;
}
function drawEnvironment(){
  for(const f of State.environment){
    ctx.save();
    if(['stream','river'].includes(f.type)){
      const pts=f.points.map(p=>w2s(p));ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
      ctx.strokeStyle=f.edge;ctx.lineWidth=Math.max(2,(f.width+.35)*U*State.view.scale*.72);ctx.stroke();ctx.strokeStyle=f.fill;ctx.lineWidth=Math.max(1.4,f.width*U*State.view.scale*.72);ctx.stroke();
    }else if(['forest','pond','sea'].includes(f.type)){
      const pts=projectPath(f.points);pathPolygon(pts,f.fill,f.edge,1.2);
      if(f.type==='forest'){
        const rnd=seedRand((State.seed^biomeHash(f.id))>>>0);
        for(let i=0;i<18;i++){const p={x:f.x+(rnd()-.5)*f.rx*1.55,y:f.y+(rnd()-.5)*f.ry*1.55};if(environmentContains(f,p))drawTree(p,.75+rnd()*.45)}
      }else if(f.type==='sea'&&f.coastline){
        const coast=projectPath(f.coastline);ctx.beginPath();coast.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#b9cfca';ctx.lineWidth=2;ctx.stroke();
      }
    }else if(f.type==='mountain'){
      pathPolygon(projectPath(f.points),f.fill,f.edge,1.2);drawRaisedFan(f,3.6);
    }else if(['hill','rough'].includes(f.type)){
      const pts=ellipseWorldPoints(f);pathPolygon(projectPath(pts),f.fill,f.edge,1.1);
      if(f.type==='hill'){
        const top=w2s({x:f.x,y:f.y},.65),front=w2s({x:f.x+.35*f.rx,y:f.y+.35*f.ry},0);
        ctx.strokeStyle='rgba(205,188,150,.20)';ctx.beginPath();ctx.moveTo(front.x,front.y);ctx.lineTo(top.x,top.y);ctx.stroke();
      }
    }
    ctx.restore();
  }
}
function drawGrid(){
  if(State.view.scale<.34)return;ctx.save();ctx.strokeStyle='rgba(255,255,255,.045)';ctx.lineWidth=1;
  for(let i=0;i<=WORLD;i+=5){
    let a=w2s({x:i,y:0}),b=w2s({x:i,y:WORLD});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    a=w2s({x:0,y:i});b=w2s({x:WORLD,y:i});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }ctx.restore();
}
function drawBuildArea(){
  const pts=projectPath([{x:BUILD_MIN,y:BUILD_MIN},{x:BUILD_MAX,y:BUILD_MIN},{x:BUILD_MAX,y:BUILD_MAX},{x:BUILD_MIN,y:BUILD_MAX}]);
  ctx.save();ctx.fillStyle='rgba(224,138,60,.028)';pathPolygon(pts,'rgba(224,138,60,.028)',null);ctx.strokeStyle='rgba(224,138,60,.9)';ctx.lineWidth=2;ctx.setLineDash([8,7]);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  const label=w2s({x:BUILD_MIN,y:BUILD_MIN});ctx.fillStyle='rgba(242,230,211,.72)';ctx.font='11px system-ui';ctx.fillText('BUILDABLE 100×100U',label.x+8,label.y+15);ctx.restore();
}
function rotateVec(x,y,a){const ca=Math.cos(a),sa=Math.sin(a);return{x:x*ca-y*sa,y:x*sa+y*ca}}
function toLocalPoint(s,p){const a=-(s.angle||0),v=rotateVec(p.x-s.x,p.y-s.y,a);return v}
function rectDims(s){const w=Number(s.w??s.size??1),h=Number(s.h??s.size??w);return{w,h}}
function placementAngle(center,p){return Math.atan2(p.y-center.y,p.x-center.x)}
function orientedToolSpec(){
  if(State.tool.kind==='tower'&&State.tool.shape==='square')return{type:'tower',shape:'square',size:State.tool.size,level:State.tool.level||State.buildLevels.tower,functions:[]};
  if(State.tool.kind==='gate')return{type:'gate',shape:'square',size:1.5,level:State.tool.level||State.buildLevels.gate,functions:[]};
  // Future point-buildings can pass a placementSpec without adding another interaction path.
  if(State.tool.placementSpec&&State.tool.placementSpec.shape!=='round')return{...State.tool.placementSpec};
  return null;
}
function makePlacementPreview(q,angle=0){
  const spec=orientedToolSpec();
  if(spec)return{...spec,x:q.x,y:q.y,angle,previewOnly:true};
  if(State.tool.kind==='tower'&&State.tool.shape==='round')return{type:'tower',shape:'round',x:q.x,y:q.y,r:State.tool.size,level:State.tool.level||State.buildLevels.tower,previewOnly:true,functions:[]};
  return null;
}
function commitOrientedPlacement(center,angle){
  const spec=orientedToolSpec();if(!spec)return false;
  const snap=spec.type==='tower'?{
    wallId:State.draft?.wallSnapId||null,
    wallEnd:State.draft?.wallSnapEnd||null,
    parentTowerId:State.draft?.parentTowerId||null,
    subtowerSocket:State.draft?.subtowerSocket||null,
    subtowerAngle:Number.isFinite(State.draft?.subtowerAngle)?State.draft.subtowerAngle:null
  }:{};
  const finalAngle=Number.isFinite(State.draft?.lockedAngle)?State.draft.lockedAngle:angle;
  const s={id:uid(),...spec,x:center.x,y:center.y,angle:finalAngle,functions:Array.isArray(spec.functions)?[...spec.functions]:[]};
  State.draft=null;
  const ok=s.type==='tower'?addTowerWithPlacement(s,snap):addStructure(s);
  if(ok&&!snap.wallId&&!snap.parentTowerId)status((s.type==='gate'?'Gate':'Structure')+' placed — choose next position');
  return ok;
}
function boundaryPoint(s,target){
  if(!s||!['tower','gate'].includes(s.type))return target;
  const dx=target.x-s.x,dy=target.y-s.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;let edge;
  if(s.shape==='round')edge=s.r;
  else{
    const local=rotateVec(ux,uy,-(s.angle||0)),d=rectDims(s),hx=d.w/2,hy=d.h/2;
    const tx=Math.abs(local.x)>1e-6?hx/Math.abs(local.x):Infinity,ty=Math.abs(local.y)>1e-6?hy/Math.abs(local.y):Infinity;
    edge=Math.min(tx,ty);
  }
  return{x:s.x+ux*edge,y:s.y+uy*edge}
}
function snapAnchor(p){
  let best=null,bestPoint=null,bestScore=Infinity;
  for(const s of State.structures){
    if(!['tower','gate'].includes(s.type)||underConstruction(s))continue;
    const q=boundaryPoint(s,p),score=dist(p,q);
    if(score<=LINEAR_POINT_MAGNET&&score<bestScore){best=s;bestPoint=q;bestScore=score}
  }
  return best
    ?{point:bestPoint,structureId:best.id,magnet:true}
    :{point:{x:snapGrid(p.x),y:snapGrid(p.y)},structureId:null,magnet:false};
}
function towerToolPrototype(angle=0){
  if(State.tool.kind!=='tower')return null;
  return{
    type:'tower',
    shape:State.tool.shape,
    level:State.tool.level||State.buildLevels.tower,
    angle,
    ...(State.tool.shape==='round'?{r:Number(State.tool.size)}:{size:Number(State.tool.size)})
  };
}
function subtowerChildren(parentId){
  return State.structures.filter(s=>s.type==='tower'&&s.parentTowerId===parentId);
}
function squareParentSubtowerAttachment(parent,child,cornerIndex){
  const fp=footprintPoints(parent);if(fp.length<4)return null;
  const i=((Number(cornerIndex)||0)%4+4)%4,corner=fp[i];
  const angle=child.shape==='square'?(parent.angle||0):0;
  return{
    // The node represents the CHILD CENTER, regardless of child shape/size.
    point:{x:corner.x,y:corner.y},
    angle,
    subtowerSocket:'corner:'+i,
    subtowerAngle:null
  };
}
function roundParentSubtowerAttachment(parent,child,radialAngle){
  const a=Number.isFinite(radialAngle)?radialAngle:0,ux=Math.cos(a),uy=Math.sin(a);
  const angle=child.shape==='square'?a-Math.PI/2:0;
  const d=Number(parent.r)||.5;
  return{
    // Radial socket is on the parent perimeter and is the CHILD CENTER.
    point:{x:parent.x+ux*d,y:parent.y+uy*d},
    angle,
    subtowerSocket:'radial',
    subtowerAngle:a
  };
}
function gateSubtowerAttachment(parent,child,frontIndex){
  const fp=footprintPoints(parent);if(fp.length<4)return null;
  // Gate "front" is facade fp[1] -> fp[2], therefore it has exactly two sockets.
  // Exception to normal subtowers: here the socket marks the CONTACT point,
  // not the child centre. The child is pushed out along the corner ray until
  // its own perimeter touches the gate perimeter, keeping the portal clear.
  const i=Number(frontIndex)===2?2:1,corner=fp[i];
  let ux=corner.x-parent.x,uy=corner.y-parent.y,L=Math.hypot(ux,uy)||1;ux/=L;uy/=L;
  const angle=child.shape==='square'?(parent.angle||0):0;
  let support;
  if(child.shape==='round')support=Number(child.r)||.5;
  else{
    const d=rectDims(child),local=rotateVec(ux,uy,-angle);
    support=Math.abs(local.x)*d.w/2+Math.abs(local.y)*d.h/2;
  }
  return{
    point:{x:corner.x+ux*support,y:corner.y+uy*support},
    angle,
    subtowerSocket:'gate-front:'+i,
    subtowerAngle:null
  };
}
function subtowerAttachmentAtSocket(parent,child,socket,radialAngle){
  if(!parent||!['tower','gate'].includes(parent.type)||!child||child.type!=='tower')return null;
  if(parent.type==='gate'){
    const m=String(socket||'').match(/^gate-front:(1|2)$/);
    return gateSubtowerAttachment(parent,child,m?Number(m[1]):1);
  }
  if(parent.shape==='round')return roundParentSubtowerAttachment(parent,child,radialAngle);
  const m=String(socket||'').match(/^corner:(\d)$/);
  return squareParentSubtowerAttachment(parent,child,m?Number(m[1]):0);
}
function subtowerAttachmentAvailable(parent,child,attachment){
  const children=subtowerChildren(parent.id);
  if(parent.type==='gate'||parent.shape!=='round'){
    return !children.some(s=>s.id!==child.id&&s.subtowerSocket===attachment.subtowerSocket);
  }
  const own=Math.max(.2,child.shape==='round'?Number(child.r)||.5:(Number(child.size)||1)/2);
  for(const other of children){
    if(other.id===child.id)continue;
    const otherR=Math.max(.2,other.shape==='round'?Number(other.r)||.5:(Number(other.size)||1)/2);
    if(dist(attachment.point,other)<(own+otherR)*.88)return false;
  }
  return true;
}
function nearestSubtowerPlacementSnap(p){
  const child=towerToolPrototype();if(!child)return null;
  const childTier=towerTier(child);
  let best=null,bestScore=Infinity;

  for(const parent of State.structures){
    if(parent.auto||!['tower','gate'].includes(parent.type)||underConstruction(parent))continue;

    // Tower parent: classic hierarchy, child must be strictly smaller.
    if(parent.type==='tower'&&towerTier(parent)<=childTier)continue;

    // Gate parent: exactly two front-corner nodes; child size is unrestricted.
    if(parent.type==='gate'){
      for(const i of [1,2]){
        const attachment=gateSubtowerAttachment(parent,child,i);if(!attachment)continue;
        const score=dist(p,attachment.point);
        if(score<=SUBTOWER_MAGNET&&score<bestScore&&subtowerAttachmentAvailable(parent,child,attachment)){
          best={...attachment,parentTowerId:parent.id,parentType:'gate',distance:score,wallId:null};
          bestScore=score;
        }
      }
      continue;
    }

    if(parent.shape==='round'){
      const a=Math.atan2(p.y-parent.y,p.x-parent.x);
      const attachment=roundParentSubtowerAttachment(parent,child,a);
      const score=dist(p,attachment.point);
      if(score<=SUBTOWER_MAGNET&&score<bestScore&&subtowerAttachmentAvailable(parent,child,attachment)){
        best={...attachment,parentTowerId:parent.id,parentType:'tower',distance:score,wallId:null};
        bestScore=score;
      }
      continue;
    }

    for(let i=0;i<4;i++){
      const attachment=squareParentSubtowerAttachment(parent,child,i);if(!attachment)continue;
      const score=dist(p,attachment.point);
      if(score<=SUBTOWER_MAGNET&&score<bestScore&&subtowerAttachmentAvailable(parent,child,attachment)){
        best={...attachment,parentTowerId:parent.id,parentType:'tower',distance:score,wallId:null};
        bestScore=score;
      }
    }
  }
  return best;
}
function repositionSubtower(child){
  if(!child?.parentTowerId)return false;
  const parent=State.structures.find(s=>s.id===child.parentTowerId&&['tower','gate'].includes(s.type));
  if(!parent||(parent.type==='tower'&&towerTier(child)>=towerTier(parent))){
    delete child.parentTowerId;delete child.subtowerSocket;delete child.subtowerAngle;delete child.parentType;
    return false;
  }
  const attachment=subtowerAttachmentAtSocket(parent,child,child.subtowerSocket,child.subtowerAngle);
  if(!attachment)return false;
  child.x=attachment.point.x;child.y=attachment.point.y;
  if(child.shape==='square')child.angle=attachment.angle;
  child.subtowerSocket=attachment.subtowerSocket;
  child.subtowerAngle=attachment.subtowerAngle;
  return true;
}
function syncSubtowerTree(parentId,seen=new Set()){
  if(!parentId||seen.has(parentId))return;
  seen.add(parentId);
  for(const child of subtowerChildren(parentId)){
    repositionSubtower(child);
    syncSubtowerTree(child.id,seen);
  }
  castleUnionCache.key=null;
}
function detachSubtowerChildren(parentId){
  for(const child of subtowerChildren(parentId)){
    delete child.parentTowerId;delete child.subtowerSocket;delete child.subtowerAngle;delete child.parentType;
  }
}
function wallEndpointSnapOccupied(wall,end){
  const snapId=end==='a'?wall.aSnap:wall.bSnap;
  if(!snapId)return false;
  return State.structures.some(s=>s.id===snapId&&['tower','gate'].includes(s.type));
}
function nearestWallPlacementSnap(p){
  let best=null,bestD=Infinity;
  for(const wall of State.structures){
    if(wall.auto||wall.type!=='wall')continue;
    const reach=TOWER_WALL_MAGNET+(Number(wall.width)||.5)/2;
    for(const end of ['a','b']){
      if(wallEndpointSnapOccupied(wall,end))continue;
      const q=wall[end],d=dist(p,q);
      if(d<=reach&&d<bestD){
        best={
          point:{x:q.x,y:q.y},
          wallId:wall.id,
          wallEnd:end,
          angle:Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x),
          distance:d
        };
        bestD=d;
      }
    }
  }
  return best;
}
function towerPlacementSnap(p){
  if(State.tool.kind!=='tower')return{point:{x:snapGrid(p.x),y:snapGrid(p.y)},wallId:null,parentTowerId:null,angle:0};
  const subtower=nearestSubtowerPlacementSnap(p);
  if(subtower)return subtower;
  const wall=nearestWallPlacementSnap(p);
  return wall||{point:{x:snapGrid(p.x),y:snapGrid(p.y)},wallId:null,parentTowerId:null,angle:0};
}
function towerHalfSpanAlongWall(tower,wall){
  if(tower.shape==='round')return Number(tower.r)||.5;
  const dirA=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x),rel=dirA-(tower.angle||0);
  const d=rectDims(tower),hx=d.w/2,hy=d.h/2;
  return Math.abs(Math.cos(rel))*hx+Math.abs(Math.sin(rel))*hy;
}
function proportionalBuildCost(cost,ratio){
  if(!cost)return undefined;
  const out={};
  for(const [k,v] of Object.entries(cost))out[k]=Math.max(0,Math.round(Number(v||0)*ratio));
  return out;
}
function wallFragmentFrom(source,a,b,aSnap,bSnap,ratio){
  const fragment={
    ...source,
    id:uid(),
    a:{...a},b:{...b},
    aSnap:aSnap||null,bSnap:bSnap||null,
    length:dist(a,b),
    buildCost:proportionalBuildCost(source.buildCost,ratio)
  };
  if(source.construction)fragment.construction={...source.construction};
  normalizeStructureVariants(fragment);
  return fragment;
}
function towerWallConnectionRecords(tower){
  if(!tower||tower.type!=='tower')return[];
  const records=[],seen=new Set();

  for(const link of Array.isArray(tower.wallConnections)?tower.wallConnections:[]){
    const wall=State.structures.find(s=>s.id===link.wallId&&s.type==='wall');if(!wall)continue;
    const end=link.end==='b'?'b':'a',key=wall.id+':'+end;if(seen.has(key))continue;
    records.push({
      wallId:wall.id,end,
      anchor:link.anchor&&Number.isFinite(link.anchor.x)&&Number.isFinite(link.anchor.y)
        ?{x:link.anchor.x,y:link.anchor.y}
        :{x:tower.x,y:tower.y}
    });
    seen.add(key);
  }

  // Legacy/persisted walls may already point to the tower without reciprocal metadata.
  for(const wall of State.structures){
    if(wall.type!=='wall')continue;
    for(const end of ['a','b']){
      const snapId=end==='a'?wall.aSnap:wall.bSnap;
      if(snapId!==tower.id)continue;
      const key=wall.id+':'+end;if(seen.has(key))continue;
      records.push({wallId:wall.id,end,anchor:{x:tower.x,y:tower.y}});
      seen.add(key);
    }
  }
  return records;
}
function setTowerWallConnection(tower,wall,end,anchor){
  if(!tower||!wall||tower.type!=='tower'||wall.type!=='wall')return;
  const list=towerWallConnectionRecords(tower).filter(x=>!(x.wallId===wall.id&&x.end===end));
  list.push({wallId:wall.id,end,anchor:{x:anchor.x,y:anchor.y}});
  tower.wallConnections=list;
}
function invalidateCastleColliderGeometry(...structures){
  for(const s of structures){
    if(!s)continue;
    s.colliderRevision=(Number(s.colliderRevision)||0)+1;
  }
  castleUnionCache={key:null,bands:null};
  peasantPathSignature='';peasantPathCache.clear();
}
function regenerateTowerWallPair(tower,wall,end,anchor=null){
  if(!tower||tower.type!=='tower'||!wall||wall.type!=='wall')return false;
  end=end==='b'?'b':'a';
  const other=end==='a'?wall.b:wall.a;
  if(!other)return false;

  // Exact ray/footprint intersection. This is the actual tower collider,
  // unlike the old projected half-span approximation.
  const contact=boundaryPoint(tower,other);
  wall[end]={x:contact.x,y:contact.y};
  wall.length=dist(wall.a,wall.b);
  if(end==='a')wall.aSnap=tower.id;else wall.bSnap=tower.id;

  const original=anchor||{x:tower.x,y:tower.y};
  setTowerWallConnection(tower,wall,end,original);
  normalizeStructureVariants(wall);
  normalizeFunctions(tower);
  invalidateCastleColliderGeometry(tower,wall);
  return dist(wall[end],boundaryPoint(tower,other))<=.015;
}
function attachTowerToWallEndpoint(wallId,end,tower,anchor){
  const wall=State.structures.find(s=>s.id===wallId&&s.type==='wall');
  if(!wall||!tower||tower.type!=='tower'||!['a','b'].includes(end))return false;
  if(wallEndpointSnapOccupied(wall,end))return false;
  return regenerateTowerWallPair(tower,wall,end,anchor||wall[end]);
}
function restoreTowerWallConnections(tower){
  if(!tower||tower.type!=='tower')return;
  for(const link of towerWallConnectionRecords(tower)){
    const wall=State.structures.find(s=>s.id===link.wallId&&s.type==='wall');if(!wall)continue;
    const end=link.end==='b'?'b':'a';
    wall[end]={...link.anchor};
    if(end==='a'&&wall.aSnap===tower.id)wall.aSnap=null;
    if(end==='b'&&wall.bSnap===tower.id)wall.bSnap=null;
    wall.length=dist(wall.a,wall.b);
    invalidateCastleColliderGeometry(wall);
  }
}
function syncCompletedTowerWallColliders(force=false){
  let changed=0;
  for(const tower of State.structures){
    if(tower.type!=='tower'||underConstruction(tower))continue;
    const links=towerWallConnectionRecords(tower);
    if(!links.length)continue;

    const signature=links.map(l=>{
      const wall=State.structures.find(s=>s.id===l.wallId&&s.type==='wall');
      return wall?l.wallId+':'+l.end+':'+(underConstruction(wall)?'0':'1'):'missing';
    }).join('|');
    if(!force&&tower.wallColliderSyncSignature===signature)continue;

    let allReady=true,localChanged=0;
    for(const link of links){
      const wall=State.structures.find(s=>s.id===link.wallId&&s.type==='wall');
      if(!wall){allReady=false;continue}
      if(underConstruction(wall)){allReady=false;continue}
      if(regenerateTowerWallPair(tower,wall,link.end,link.anchor))localChanged++;
    }
    if(allReady){
      tower.wallColliderSyncSignature=signature;
      tower.wallColliderSyncedDay=State.clock.day;
    }
    changed+=localChanged;
  }
  if(changed){
    castleUnionCache={key:null,bands:null};
    peasantPathSignature='';peasantPathCache.clear();
  }
  return changed;
}
function breakWallForTower(wallId,tower){
  const wall=State.structures.find(s=>s.id===wallId&&s.type==='wall');
  if(!wall||!tower||tower.type!=='tower')return false;
  const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,L=Math.hypot(dx,dy);
  if(L<=1e-6)return false;
  const ux=dx/L,uy=dy/L;
  const tc=clamp((tower.x-wall.a.x)*ux+(tower.y-wall.a.y)*uy,0,L);
  const half=towerHalfSpanAlongWall(tower,wall)+.025;
  const cut0=clamp(tc-half,0,L),cut1=clamp(tc+half,0,L);
  const p0={x:wall.a.x+ux*cut0,y:wall.a.y+uy*cut0};
  const p1={x:wall.a.x+ux*cut1,y:wall.a.y+uy*cut1};

  const fragments=[];
  if(cut0>=WALL_BREAK_MIN){
    fragments.push(wallFragmentFrom(wall,wall.a,p0,wall.aSnap,tower.id,cut0/L));
  }
  if(L-cut1>=WALL_BREAK_MIN){
    fragments.push(wallFragmentFrom(wall,p1,wall.b,tower.id,wall.bSnap,(L-cut1)/L));
  }

  const idx=State.structures.findIndex(s=>s.id===wall.id);
  if(idx>=0)State.structures.splice(idx,1,...fragments);
  castleUnionCache.key=null;
  return true;
}
function addTowerWithPlacement(tower,snap={}){
  if(snap.parentTowerId){
    const parent=State.structures.find(s=>s.id===snap.parentTowerId&&['tower','gate'].includes(s.type));
    if(!parent){status('Subtower parent is no longer available');return false}
    if(parent.type==='tower'&&towerTier(tower)>=towerTier(parent)){status('Subtower must be smaller than its parent tower');return false}
    tower.parentTowerId=parent.id;
    tower.parentType=parent.type;
    tower.subtowerSocket=snap.subtowerSocket||null;
    tower.subtowerAngle=Number.isFinite(snap.subtowerAngle)?snap.subtowerAngle:null;
  }

  const ok=addStructure(tower);
  if(!ok)return false;

  if(snap.parentTowerId){
    const parent=State.structures.find(s=>s.id===snap.parentTowerId);
    status(parent?.type==='gate'?'Subtower attached to gate front corner':'Subtower attached to '+(parent?.shape==='round'?'tower perimeter':'tower corner'));
    return true;
  }

  if(snap.wallId){
    const wall=State.structures.find(s=>s.id===snap.wallId&&s.type==='wall');
    const anchor=wall&&snap.wallEnd?{...wall[snap.wallEnd]}:{x:tower.x,y:tower.y};
    const attached=snap.wallEnd
      ?attachTowerToWallEndpoint(snap.wallId,snap.wallEnd,tower,anchor)
      :breakWallForTower(snap.wallId,tower); // legacy draft fallback
    if(attached){
      tower.wallColliderSyncSignature=null;
      markDirty();draw();
      status(snap.wallEnd?'Tower snapped to wall endpoint — collider linked':'Tower snapped to wall');
    }
  }
  return true;
}
function currentLinearSpec(){
  if(State.tool.linear==='wall')return{...TYPES.wall,width:wallWidthForTier(State.tool.tier||State.buildLevels.wallTier)};
  return TYPES.built;
}
function normalizeLinear(a,b,spec){let dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<.0001)return null;const target=clamp(L,spec.min,spec.max),ux=dx/L,uy=dy/L;return{a,b:{x:a.x+ux*target,y:a.y+uy*target},length:target}}
function linePoly(s){
  const a=s.a,b=s.b,dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L*s.width/2,ny=dx/L*s.width/2;
  return[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}];
}
function functionCapacity(s){
  if(!s)return 0;
  if(s.type==='gate')return structureLevel(s);
  if(s.type==='tower'){
    const base=towerTier(s)===3?2:towerTier(s)===2?1:0;
    return base*structureLevel(s);
  }
  if(s.type==='built'){
    const base=s.length>=3?2:s.length>=2?1:0;
    return base*structureLevel(s);
  }
  return 0;
}
function normalizeFunctions(s){const cap=functionCapacity(s);if(!Array.isArray(s.functions))s.functions=[];s.functions=s.functions.slice(0,cap);while(s.functions.length<cap)s.functions.push(null);return s}
// Variant contract:
 // tower/gate -> roofStyle
 // wall/built -> skin
 // Renderer/UI steps must use structureVariant()/setStructureVariant() rather
 // than creating duplicate structure types.
function structureLabel(s){if(!s)return'';if(s.type==='house'){const l=houseLevel(s);return `House · L${l}${l===3?' · '+housePlanType(s)+' plan':l===4?' · elite · '+houseTurretType(s)+' turret':''}`};if(s.type==='market')return'Market · 4×4U';if(s.type==='tavern')return'Tavern · double-T plan';if(s.type==='church')return'Church · large';if(s.type==='training')return'Training field · 5×4U';if(s.type==='well')return'Village well';if(s.type==='gate')return`Gate 1.5×1.5U · L${structureLevel(s)}`;if(s.type==='tower')return (s.shape==='round'?`Round tower R${s.r}U`:`Square tower ${s.size}×${s.size}U`)+` · T${towerTier(s)} · L${structureLevel(s)}`+(s.parentTowerId?' · SUB':'');if(s.type==='built')return`Built section ${s.length.toFixed(2)}U · L${structureLevel(s)}`;if(s.type==='wall')return`Wall ${s.length.toFixed(2)}U · T${wallTier(s)} (${s.width}U) · L${structureLevel(s)}`;return s.type}
function drawLinearBase(s,preview=false){
  const h=structureHeight(s),selected=State.selectedId===s.id;
  const colors=s.type==='wall'
    ?{top:'#9a8e82',sideA:'#49443f',sideB:'#686057',stroke:selected?'#f4b76f':'#d8c8b4'}
    :{top:'#9b7457',sideA:'#5c4436',sideB:'#715441',stroke:selected?'#f4b76f':'#d8c8b4'};
  extrudePolygon(linePoly(s),h,colors);
}
function builtRoofFootprintPoints(s){
  let a={...s.a},b={...s.b};
  let dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const inset=clamp((Number(s.width)||1)*.11,.08,.16);

  // The castle-body union deliberately overlaps snapped towers/gates.
  // Roofs must not: pull the roof slightly back from those sockets.
  if(hasCastleSnap(s.aSnap))a={x:a.x+ux*inset,y:a.y+uy*inset};
  if(hasCastleSnap(s.bSnap))b={x:b.x-ux*inset,y:b.y-uy*inset};

  dx=b.x-a.x;dy=b.y-a.y;L=Math.hypot(dx,dy)||1;
  const nx=-dy/L*(Number(s.width)||1)/2,ny=dx/L*(Number(s.width)||1)/2;
  return[
    {x:a.x+nx,y:a.y+ny},
    {x:b.x+nx,y:b.y+ny},
    {x:b.x-nx,y:b.y-ny},
    {x:a.x-nx,y:a.y-ny}
  ];
}
function builtRoofGeometry(s){
  const p=builtRoofFootprintPoints(s);if(!p||p.length<4)return null;
  const h=structureHeight(s),rise=clamp((Number(s.width)||1)*.46,.32,.56);
  const ridgeA={x:(p[0].x+p[3].x)/2,y:(p[0].y+p[3].y)/2};
  const ridgeB={x:(p[1].x+p[2].x)/2,y:(p[1].y+p[2].y)/2};
  return{p,h,rise,ridgeA,ridgeB,ridgeH:h+rise};
}
function viewDepthPoint(p){
  const q=rotateViewPoint(p);
  return q.x+q.y;
}
function roofOccluderStructures(s){
  const out=[],seen=new Set();
  const add=target=>{
    if(!target||!['tower','gate'].includes(target.type)||underConstruction(target)||seen.has(target.id))return;
    seen.add(target.id);out.push(target);
  };

  // Architectural rule: a roof connected to a tower/gate terminates at that
  // masonry volume. The connected mass ALWAYS masks the roof where their
  // screen silhouettes overlap. Do not decide this from painter depth:
  // elevated roof faces can otherwise paint across the tower facade.
  for(const id of [s.aSnap,s.bSnap]){
    if(!id)continue;
    add(State.structures.find(x=>x.id===id));
  }

  // Non-connected tower/gate volumes can still stand in front of this roof.
  // For those, normal camera depth is appropriate.
  const ownerDepth=worldDepth(s),g=builtRoofGeometry(s),roofBase=g?.h??structureHeight(s);
  for(const target of State.structures){
    if(target.id===s.id||!['tower','gate'].includes(target.type)||underConstruction(target)||seen.has(target.id))continue;
    if(structureVisualTopHeight(target)<=roofBase+.04)continue;
    if(worldDepth(target)>ownerDepth+1e-4)add(target);
  }
  return out;
}
function worldPolygonsOverlap(a,b){
  if(!a?.length||!b?.length)return false;
  if(a.some(p=>pointInScreenPolygon(p,b)))return true;
  if(b.some(p=>pointInScreenPolygon(p,a)))return true;
  for(let i=0;i<a.length;i++){
    const a2=a[(i+1)%a.length];
    for(let j=0;j<b.length;j++){
      const b2=b[(j+1)%b.length];
      if(segmentsIntersect(a[i],a2,b[j],b2))return true;
    }
  }
  return false;
}
function structuresOverlapInPlan(a,b){
  return !!a&&!!b&&worldPolygonsOverlap(unionFootprintPoints(a),unionFootprintPoints(b));
}
function structureDetailOccluders(owner,z){
  if(!owner)return[];
  const ownerDepth=worldDepth(owner);
  return State.structures.filter(o=>{
    if(o.id===owner.id||underConstruction(o)||!isCastlePart(o))return false;
    if(structureVisualTopHeight(o)<=z+.035)return false;
    // Real 3D overlap wins over painter-order heuristics.
    if(structuresOverlapInPlan(owner,o))return true;
    // Otherwise normal camera depth decides whether the silhouette is in front.
    return worldDepth(o)>ownerDepth+1e-4;
  });
}
function withStructureDetailOcclusion(owner,z,drawFn){
  const occluders=structureDetailOccluders(owner,z);
  if(!occluders.length){drawFn();return}
  const r=wrap.getBoundingClientRect();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-48,-48,r.width+96,r.height+96);
  for(const o of occluders){
    const hull=structureScreenSilhouette(o);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');
  drawFn();
  ctx.restore();
}
function structureScreenSilhouette(s){
  const fp=footprintPoints(s);if(!fp?.length)return[];
  const h=structureHeight(s),cloud=[];
  for(const p of fp){cloud.push(w2s(p,0));cloud.push(w2s(p,h))}
  if(s.type==='tower'&&towerRoofStyle(s)==='pitched'){
    for(const p of towerRoofFootprintPoints(s))cloud.push(w2s(p,h));
    cloud.push(w2s({x:s.x,y:s.y},towerVisualTopHeight(s)));
  }
  if(s.type==='gate'&&gateRoofStyle(s)==='pitched'){
    const g=gateRoofGeometry(s);
    if(g){
      for(const p of g.footprint)cloud.push(w2s(p,g.h));
      cloud.push(w2s(g.ridgeA,g.ridgeH),w2s(g.ridgeB,g.ridgeH));
    }
  }
  return convexHull(cloud);
}
function withBuiltRoofOcclusionClip(s,drawFn){
  const occluders=roofOccluderStructures(s);
  if(!occluders.length){drawFn();return}

  const r=wrap.getBoundingClientRect();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-32,-32,r.width+64,r.height+64);

  for(const target of occluders){
    const hull=structureScreenSilhouette(target);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }

  ctx.clip('evenodd');
  drawFn();
  ctx.restore();
}
function drawBuiltDetails(s,preview=false){
  if(s.type!=='built')return;
  const g=builtRoofGeometry(s);if(!g)return;

  const a0=w2s(g.p[0],g.h),a1=w2s(g.p[1],g.h),b0=w2s(g.p[3],g.h),b1=w2s(g.p[2],g.h);
  const ra=w2s(g.ridgeA,g.ridgeH),rb=w2s(g.ridgeB,g.ridgeH);
  const faceA={
    poly:[a0,a1,rb,ra],
    fill:preview?'rgba(58,61,66,.62)':'#34363a',
    depth:(a0.y+a1.y)/2
  };
  const faceB={
    poly:[b0,b1,rb,ra],
    fill:preview?'rgba(70,73,78,.62)':'#42454a',
    depth:(b0.y+b1.y)/2
  };

  withBuiltRoofOcclusionClip(s,()=>{
    for(const face of [faceA,faceB].sort((a,b)=>a.depth-b.depth)){
      pathPolygon(face.poly,face.fill,'#5d6066',1);
    }
    for(const spec of chimneySpecs(s))drawChimney(spec);
  });
}
function battlementPiece(center,angle,z,w=.28,d=.24,h=.24,owner=null){
  const pts=rectWorldPoints(center.x,center.y,w,d,angle),rp=rotateViewPoint(center);
  return{
    pts,z0:z,z1:z+h,depth:rp.x+rp.y,
    ownerId:owner?.id||null,
    ownerType:owner?.type||null,
    ownerDepth:owner?worldDepth(owner):null,
    ownerTop:owner?structureHeight(owner):null
  };
}
function castleBattlementOccluders(piece){
  if(!piece.ownerId||!['tower','wall','gate'].includes(piece.ownerType))return[];
  const owner=State.structures.find(s=>s.id===piece.ownerId);
  return State.structures.filter(s=>{
    if(s.id===piece.ownerId||!isCastlePart(s)||underConstruction(s))return false;
    const h=structureVisualTopHeight(s);
    if(h<=Number(piece.z0)+.04)return false;

    // Attached/subtower geometry can overlap even when structure-center depth
    // says the opposite. If this merlon footprint enters the taller volume,
    // that volume must mask it unconditionally.
    const fp=unionFootprintPoints(s);
    if(worldPolygonsOverlap(piece.pts,fp))return true;

    const ownerDepth=owner?worldDepth(owner):Number(piece.ownerDepth??piece.depth);
    return worldDepth(s)>ownerDepth+1e-4;
  });
}
function withTowerBattlementOcclusion(piece,drawFn){
  const occluders=castleBattlementOccluders(piece);
  if(!occluders.length){drawFn();return}
  const r=wrap.getBoundingClientRect();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-48,-48,r.width+96,r.height+96);
  for(const tower of occluders){
    const hull=structureScreenSilhouette(tower);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');
  drawFn();
  ctx.restore();
}
function drawBattlementPiece(piece){
  withTowerBattlementOcclusion(piece,()=>{
    if(piece.wallCrest){
      const a=w2s(piece.wallCrest.a,piece.wallCrest.z),b=w2s(piece.wallCrest.b,piece.wallCrest.z);
      const H=Math.max(2000,wrap.getBoundingClientRect().height*3);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.x,a.y+1);
      ctx.lineTo(b.x,b.y+1);
      ctx.lineTo(b.x,b.y-H);
      ctx.lineTo(a.x,a.y-H);
      ctx.closePath();
      ctx.clip();
      extrudePolygonAt(piece.pts,piece.z0,piece.z1,{top:'#9a8e82',sideA:'#514a44',sideB:'#635951',stroke:'#c8b9a9'});
      ctx.restore();
      return;
    }
    extrudePolygonAt(piece.pts,piece.z0,piece.z1,{top:'#9a8e82',sideA:'#514a44',sideB:'#635951',stroke:'#c8b9a9'});
  });
}
function renderBattlementPieces(pieces){
  pieces.sort((a,b)=>a.depth-b.depth);
  for(const piece of pieces)drawBattlementPiece(piece);
}
function wallExteriorSide(s){return s?.flip?-1:1}
function battlementIntervalCount(length,spacing=BATTLEMENT_SPACING){
  return Math.max(1,Math.round(Math.max(.001,length)/spacing));
}
function wallExteriorLayout(s){
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
  const angle=Math.atan2(dy,dx),z=structureHeight(s),width=Number(s.width)||.5,side=wallExteriorSide(s);
  const startPad=s.aSnap?Math.min(BATTLEMENT_SPACING*.72,L*.24):0;
  const endPad=s.bSnap?Math.min(BATTLEMENT_SPACING*.72,L*.24):0;
  const usable=Math.max(.01,L-startPad-endPad);
  return{
    dx,dy,L,ux,uy,nx,ny,angle,z,width,side,startPad,endPad,usable,
    crest:{
      a:{x:s.a.x+nx*(width/2)*side,y:s.a.y+ny*(width/2)*side},
      b:{x:s.b.x+nx*(width/2)*side,y:s.b.y+ny*(width/2)*side},
      z
    }
  };
}
function wallBattlementPieces(s){
  if(s.type!=='wall'||underConstruction(s)||wallSkin(s)==='hoarding')return[];
  const g=wallExteriorLayout(s),depth=Math.min(.28,Math.max(.18,g.width*.46));
  // Keep the whole merlon footprint on the wall cap; the exterior side is still
  // defined by flip, but no block is allowed to hang over the facade.
  const edgeOffset=Math.max(0,g.width/2-depth/2-.012),pieces=[];
  const intervals=battlementIntervalCount(g.usable),step=g.usable/intervals;

  for(let i=0;i<=intervals;i++){
    const along=g.startPad+step*i;
    const t=clamp(along/g.L,0,1);
    const center={x:s.a.x+g.dx*t+g.nx*edgeOffset*g.side,y:s.a.y+g.dy*t+g.ny*edgeOffset*g.side};
    const piece=battlementPiece(center,g.angle,g.z,.28,depth,.24,s);
    piece.wallCrest=g.crest;
    pieces.push(piece);
  }
  return pieces;
}
function squareTowerBattlementPieces(s){
  const fp=footprintPoints(s),z=structureHeight(s);if(fp.length<4)return[];
  const pieces=[],center={x:s.x,y:s.y},cornerAngle=s.angle||0;
  const perSide=[0,3,4,5][towerTier(s)]||3;
  const intervals=perSide-1;
  const inset=.115;

  // Exactly one merlon per corner; shared by the two adjacent sides.
  for(const corner of fp){
    const dx=center.x-corner.x,dy=center.y-corner.y,L=Math.hypot(dx,dy)||1;
    pieces.push(battlementPiece(
      {x:corner.x+dx/L*inset,y:corner.y+dy/L*inset},
      cornerAngle,z,.27,.23,.25,s
    ));
  }

  // Fixed count per side, including the two corner merlons:
  // T1 = 3, T2 = 4, T3 = 5.
  for(let e=0;e<fp.length;e++){
    const a=fp[e],b=fp[(e+1)%fp.length],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;
    const angle=Math.atan2(dy,dx),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    let ix=center.x-mid.x,iy=center.y-mid.y,IL=Math.hypot(ix,iy)||1;
    ix/=IL;iy/=IL;

    for(let i=1;i<intervals;i++){
      const t=i/intervals;
      pieces.push(battlementPiece(
        {x:a.x+dx*t+ix*inset,y:a.y+dy*t+iy*inset},
        angle,z,.25,.22,.24,s
      ));
    }
  }
  return pieces;
}
function roundTowerBattlementPieces(s){
  const z=structureHeight(s),r=Math.max(.16,(Number(s.r)||.5)-.09);
  const count=[0,6,8,12][towerTier(s)]||6;
  const pieces=[];
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2,center={x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r};
    pieces.push(battlementPiece(center,a+Math.PI/2,z,.23,.18,.23,s));
  }
  return pieces;
}
function towerBattlementPieces(s){
  if(s.type!=='tower'||underConstruction(s)||towerRoofStyle(s)!=='battlement')return[];
  return s.shape==='round'?roundTowerBattlementPieces(s):squareTowerBattlementPieces(s);
}
function pointRoofOccluders(s){
  if(!s||!['tower','gate'].includes(s.type))return[];
  const d=worldDepth(s),base=structureHeight(s);
  return State.structures.filter(o=>{
    if(o.id===s.id||!['tower','gate'].includes(o.type)||underConstruction(o))return false;
    if(structureVisualTopHeight(o)<=base+.04)return false;
    if(structuresOverlapInPlan(s,o))return true;
    return worldDepth(o)>d+1e-4;
  });
}
function withPointRoofOcclusion(s,drawFn){
  const occluders=pointRoofOccluders(s);
  if(!occluders.length){drawFn();return}
  const r=wrap.getBoundingClientRect();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-48,-48,r.width+96,r.height+96);
  for(const o of occluders){
    const hull=structureScreenSilhouette(o);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');
  drawFn();
  ctx.restore();
}
function drawSquareTowerRoof(s){
  const baseZ=structureHeight(s),apexZ=towerVisualTopHeight(s),fp=towerRoofFootprintPoints(s);
  if(fp.length<4)return;
  const apex=w2s({x:s.x,y:s.y},apexZ),faces=[];
  for(let i=0;i<4;i++){
    const j=(i+1)%4,a=w2s(fp[i],baseZ),b=w2s(fp[j],baseZ);
    faces.push({
      poly:[a,b,apex],
      depth:(a.y+b.y)/2,
      fill:i%2?'#34363a':'#42454a'
    });
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.fill,'#5d6066',1);
}
function drawRoundTowerRoof(s){
  const baseZ=structureHeight(s),apexZ=towerVisualTopHeight(s),fp=towerRoofFootprintPoints(s);
  if(fp.length<3)return;
  const apex=w2s({x:s.x,y:s.y},apexZ),faces=[];
  for(let i=0;i<fp.length;i++){
    const j=(i+1)%fp.length,a=w2s(fp[i],baseZ),b=w2s(fp[j],baseZ);
    const shade=i%3===0?'#303236':i%3===1?'#3a3d42':'#44474c';
    faces.push({poly:[a,b,apex],depth:(a.y+b.y)/2,fill:shade});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.fill,null);
  const rim=projectPath(fp,baseZ);
  ctx.save();ctx.strokeStyle='#5d6066';ctx.lineWidth=1;ctx.beginPath();
  rim.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.restore();
}
function drawTowerRoof(s){
  if(!s||s.type!=='tower'||underConstruction(s)||towerRoofStyle(s)!=='pitched')return;
  withPointRoofOcclusion(s,()=>s.shape==='round'?drawRoundTowerRoof(s):drawSquareTowerRoof(s));
}
function drawTowerRoofs(){
  const towers=State.structures
    .filter(s=>s.type==='tower'&&!underConstruction(s)&&towerRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of towers)drawTowerRoof(s);
}
function drawGateRoof(s){
  if(!s||s.type!=='gate'||underConstruction(s)||gateRoofStyle(s)!=='pitched')return;
  const g=gateRoofGeometry(s);if(!g)return;
  withPointRoofOcclusion(s,()=>{
    const rearGable=[w2s(g.c3,g.h),w2s(g.c0,g.h),w2s(g.ridgeA,g.ridgeH)];
    const frontGable=[w2s(g.c1,g.h),w2s(g.c2,g.h),w2s(g.ridgeB,g.ridgeH)];
    const roofA=[w2s(g.c0,g.h),w2s(g.c1,g.h),w2s(g.ridgeB,g.ridgeH),w2s(g.ridgeA,g.ridgeH)];
    const roofB=[w2s(g.c3,g.h),w2s(g.c2,g.h),w2s(g.ridgeB,g.ridgeH),w2s(g.ridgeA,g.ridgeH)];
    const faces=[
      {poly:rearGable,fill:'#514a44',depth:(rearGable[0].y+rearGable[1].y)/2},
      {poly:frontGable,fill:'#62584f',depth:(frontGable[0].y+frontGable[1].y)/2},
      {poly:roofA,fill:'#34363a',depth:(roofA[0].y+roofA[1].y)/2},
      {poly:roofB,fill:'#42454a',depth:(roofB[0].y+roofB[1].y)/2}
    ];
    faces.sort((a,b)=>a.depth-b.depth);
    for(const face of faces)pathPolygon(face.poly,face.fill,'#5d6066',1);
  });
}
function drawGateRoofs(){
  const gates=State.structures
    .filter(s=>s.type==='gate'&&!underConstruction(s)&&gateRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of gates)drawGateRoof(s);
}
function midpoint2(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
function drawQuarteredTowerFlag(tower){
  if(!tower||underConstruction(tower)||tower.type!=='tower'||towerRoofStyle(tower)!=='pitched')return;
  const scale=clamp(State.view.scale,.55,1.45),base=w2s({x:tower.x,y:tower.y},towerVisualTopHeight(tower));
  const seed=(peasantHash(tower.id+'-flag')%1000)/1000;
  const mastH=clamp(20*scale,13,28),clothW=clamp(15*scale,10,21),clothH=clamp(10*scale,7,14);
  const wave=Math.sin(visualCycleDay()*18+seed*Math.PI*2)*1.4*scale;
  const mastTop={x:base.x,y:base.y-mastH};
  const tl={x:mastTop.x,y:mastTop.y+2*scale},tr={x:tl.x+clothW,y:tl.y+wave};
  const br={x:tr.x,y:tr.y+clothH},bl={x:tl.x,y:tl.y+clothH};
  const tm=midpoint2(tl,tr),rm=midpoint2(tr,br),bm=midpoint2(bl,br),lm=midpoint2(tl,bl);
  const center={x:(tl.x+tr.x+br.x+bl.x)/4,y:(tl.y+tr.y+br.y+bl.y)/4};

  ctx.save();
  ctx.strokeStyle='#745538';ctx.lineWidth=Math.max(1,1.15*scale);
  ctx.beginPath();ctx.moveTo(base.x,base.y+1);ctx.lineTo(mastTop.x,mastTop.y);ctx.stroke();

  pathPolygon([tl,tm,center,lm],REIGN_COLOR_1,null);
  pathPolygon([tm,tr,rm,center],REIGN_COLOR_2,null);
  pathPolygon([lm,center,bm,bl],REIGN_COLOR_2,null);
  pathPolygon([center,rm,br,bm],REIGN_COLOR_1,null);
  pathPolygon([tl,tr,br,bl],null,'rgba(236,222,200,.72)',Math.max(.7,.8*scale));

  ctx.fillStyle='#c6a461';ctx.beginPath();ctx.arc(mastTop.x,mastTop.y,Math.max(1.1,1.25*scale),0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function drawTowerFlags(){
  const towers=State.structures
    .filter(s=>s.type==='tower'&&!underConstruction(s)&&towerRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const tower of towers)drawQuarteredTowerFlag(tower);
}
function towerTorchSources(){
  const out=[];
  for(const tower of State.structures){
    if(tower.type!=='tower'||underConstruction(tower))continue;
    for(const spec of towerDoorSpecs(tower)){
      if(spec.kind!=='front'||!towerDoorVisible(tower,spec))continue;
      const fullHeight=Math.max(.18,spec.apexZ-spec.baseZ),doorTop=spec.baseZ+fullHeight/3;
      const lateral=.18,outward=.035,z=doorTop+.10;
      for(const side of [-1,1]){
        out.push({
          kind:'torch',id:tower.id+':torch:'+side,
          p:{
            x:spec.contact.x+spec.tangent.x*lateral*side+spec.outward.x*outward,
            y:spec.contact.y+spec.tangent.y*lateral*side+spec.outward.y*outward
          },
          z
        });
      }
    }
  }
  return out;
}
function battlementBrazierSources(){
  const out=[];
  for(const s of State.structures){
    if(underConstruction(s))continue;
    if(s.type==='tower'&&towerRoofStyle(s)==='battlement'){
      const hash=peasantHash(s.id+'-brazier'),a=((hash%360)/180)*Math.PI;
      const r=s.shape==='round'?Math.max(.12,s.r*.34):Math.max(.12,(s.size||1)*.26);
      out.push({kind:'brazier',id:s.id+':brazier',p:{x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r},z:structureHeight(s)+.10});
    }else if(s.type==='gate'&&gateRoofStyle(s)==='battlement'){
      const ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0),half=.43;
      for(const side of [-1,1]){
        out.push({kind:'brazier',id:s.id+':brazier:'+side,p:{x:s.x+ca*half*side,y:s.y+sa*half*side},z:structureHeight(s)+.10});
      }
    }
  }
  return out;
}
function fireSources(){return towerTorchSources().concat(battlementBrazierSources())}
function fireFlicker(id){
  const seed=(peasantHash(String(id)+'-fire')%1000)/1000;
  return .88+Math.sin(visualCycleDay()*31+seed*Math.PI*2)*.10+Math.sin(visualCycleDay()*53+seed*9)*.04;
}
function drawScreenFlame(p,scale,id,big=false){
  const f=fireFlicker(id),h=(big?7.0:5.2)*scale*f,w=(big?3.7:2.8)*scale;
  ctx.save();
  ctx.fillStyle=FIRE_GOLD;ctx.beginPath();
  ctx.moveTo(p.x,p.y-h);ctx.quadraticCurveTo(p.x+w,p.y-h*.45,p.x,p.y+.4*scale);
  ctx.quadraticCurveTo(p.x-w,p.y-h*.45,p.x,p.y-h);ctx.fill();
  ctx.fillStyle=FIRE_CORE;ctx.beginPath();
  ctx.moveTo(p.x,p.y-h*.72);ctx.quadraticCurveTo(p.x+w*.45,p.y-h*.30,p.x,p.y);
  ctx.quadraticCurveTo(p.x-w*.45,p.y-h*.30,p.x,p.y-h*.72);ctx.fill();
  ctx.restore();
}
function drawTorchFixture(src){
  const p=w2s(src.p,src.z),scale=clamp(State.view.scale,.55,1.45);
  ctx.save();
  ctx.strokeStyle='#6b5440';ctx.lineWidth=Math.max(1,1.0*scale);
  ctx.beginPath();ctx.moveTo(p.x-3.0*scale,p.y+2.2*scale);ctx.lineTo(p.x,p.y);ctx.stroke();
  ctx.fillStyle='#463a32';ctx.beginPath();
  ctx.moveTo(p.x-1.6*scale,p.y+.5*scale);ctx.lineTo(p.x+1.6*scale,p.y+.5*scale);
  ctx.lineTo(p.x+1.0*scale,p.y+2.4*scale);ctx.lineTo(p.x-1.0*scale,p.y+2.4*scale);ctx.closePath();ctx.fill();
  ctx.restore();
  drawScreenFlame({x:p.x,y:p.y-.3*scale},scale,src.id,false);
}
function drawBrazierFixture(src){
  const scale=clamp(State.view.scale,.55,1.45);
  const pts=rectWorldPoints(src.p.x,src.p.y,.20,.20,0);
  extrudePolygonAt(pts,src.z-.08,src.z+.03,{top:'#5d4b3d',sideA:'#39312b',sideB:'#493d34',stroke:'#7b654f'});
  const p=w2s(src.p,src.z+.08);
  drawScreenFlame(p,scale,src.id,true);
}
function drawCastleFireFixtures(){
  for(const src of towerTorchSources())drawTorchFixture(src);
  for(const src of battlementBrazierSources())drawBrazierFixture(src);
}
function drawFireGlows(nf){
  if(nf<=.01)return;
  const scale=clamp(State.view.scale,.55,1.45);
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const src of fireSources()){
    const p=w2s(src.p,src.z+(src.kind==='brazier'?.08:0));
    const r=(src.kind==='brazier'?12:9)*scale,n=Math.max(.1,nf)*fireFlicker(src.id);
    const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
    g.addColorStop(0,'rgba(255,198,88,'+(.42*n).toFixed(3)+')');
    g.addColorStop(.45,'rgba(242,145,48,'+(.20*n).toFixed(3)+')');
    g.addColorStop(1,'rgba(242,145,48,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
    drawScreenFlame(p,scale,src.id,src.kind==='brazier');
  }
  ctx.restore();
}
function gateBattlementPieces(s){
  if(s.type!=='gate'||underConstruction(s)||gateRoofStyle(s)!=='battlement')return[];
  const fp=footprintPoints(s),z=structureHeight(s);if(fp.length<4)return[];
  const pieces=[],center={x:s.x,y:s.y},perSide=4,intervals=perSide-1,inset=.11;

  for(const corner of fp){
    const dx=center.x-corner.x,dy=center.y-corner.y,L=Math.hypot(dx,dy)||1;
    pieces.push(battlementPiece(
      {x:corner.x+dx/L*inset,y:corner.y+dy/L*inset},
      s.angle||0,z,.27,.23,.25,s
    ));
  }
  for(let e=0;e<fp.length;e++){
    const a=fp[e],b=fp[(e+1)%fp.length],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;
    const angle=Math.atan2(dy,dx),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    let ix=center.x-mid.x,iy=center.y-mid.y,IL=Math.hypot(ix,iy)||1;ix/=IL;iy/=IL;
    for(let i=1;i<intervals;i++){
      const t=i/intervals;
      pieces.push(battlementPiece(
        {x:a.x+dx*t+ix*inset,y:a.y+dy*t+iy*inset},
        angle,z,.25,.22,.24,s
      ));
    }
  }
  return pieces;
}
function drawCastleBattlements(){
  const pieces=[];
  for(const s of State.structures){
    if(underConstruction(s))continue;
    if(s.type==='tower')pieces.push(...towerBattlementPieces(s));
    else if(s.type==='gate')pieces.push(...gateBattlementPieces(s));
    else if(s.type==='wall')pieces.push(...wallBattlementPieces(s));
  }
  renderBattlementPieces(pieces);
}
function chimneySpecs(s){
  if(!s||underConstruction(s))return[];
  const specs=[];

  if(s.type==='house'){
    const ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0),ridgeH=houseRidgeHeight(s);
    const ridgeLength=Math.max(.5,Number(s.w)||1.5);
    const count=Math.max(1,Math.ceil(ridgeLength/CHIMNEY_SPACING));
    for(let i=0;i<count;i++){
      const t=(i+1)/(count+1),along=(t-.5)*ridgeLength*.86;
      specs.push({
        center:{x:s.x+ca*along,y:s.y+sa*along},
        angle:s.angle||0,z0:ridgeH-.05,z1:ridgeH+.43,index:i
      });
    }
    return specs;
  }

  if(s.type==='built'){
    const g=builtRoofGeometry(s);if(!g)return[];
    const dx=g.ridgeB.x-g.ridgeA.x,dy=g.ridgeB.y-g.ridgeA.y;
    const ridgeLength=Math.hypot(dx,dy);
    const count=Math.max(1,Math.ceil(ridgeLength/CHIMNEY_SPACING));
    for(let i=0;i<count;i++){
      const t=(i+1)/(count+1);
      specs.push({
        center:{x:g.ridgeA.x+dx*t,y:g.ridgeA.y+dy*t},
        angle:Math.atan2(s.b.y-s.a.y,s.b.x-s.a.x),
        z0:g.ridgeH-.02,z1:g.ridgeH+.48,index:i
      });
    }
  }
  return specs;
}
function drawChimney(spec){
  const pts=rectWorldPoints(spec.center.x,spec.center.y,.22,.20,spec.angle||0);
  extrudePolygonAt(pts,spec.z0,spec.z1,{top:'#3b302c',sideA:'#332824',sideB:'#493732',stroke:'#6a5148'});
}
function drawSmoke(spec,id,now){
  if(!worldPointVisible(spec.p,spec.z||0,80))return;
  const p=w2s(spec.center,spec.z1),seed=(biomeHash(String(id||''))%997)/997;
  const scale=Math.max(.55,State.view.scale);
  ctx.save();
  for(let i=0;i<4;i++){
    const phase=(now*.13+seed+i/4)%1;
    const fade=Math.pow(1-phase,1.7);
    const drift=Math.sin((phase*5.2+seed*8+i)*1.35)*3.2*scale+phase*5*scale;
    const y=p.y-phase*34*scale,x=p.x+drift,r=(2.2+phase*5.8)*scale;
    ctx.filter='blur('+(1.0+phase*2.2).toFixed(1)+'px)';
    ctx.fillStyle='rgba(180,178,172,'+(fade*.24).toFixed(3)+')';
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawHouseChimneys(s){
  for(const spec of chimneySpecs(s))drawChimney(spec);
}
function drawChimneysAndSmoke(){
  const now=performance.now()/1000;
  const sources=State.structures.filter(s=>!underConstruction(s)&&(s.type==='house'||s.type==='built'));
  for(const s of sources){
    const specs=chimneySpecs(s);if(!specs.length)continue;
    const smoke=()=>specs.forEach(spec=>drawSmoke(spec,s.id+':'+spec.index,now));
    if(s.type==='built')withBuiltRoofOcclusionClip(s,smoke);
    else smoke();
  }
}
function drawCivicGabledPart(s,part,wallH,ridgeH,wallA,wallB,roofAColor,roofBColor,gableColor,stroke){
  const turn=part.roofTurn||0,angle=(s.angle||0)+turn,ca=Math.cos(angle),sa=Math.sin(angle),center=part.center;
  const rw=Math.abs(turn)>1e-6?part.h:part.w,rh=Math.abs(turn)>1e-6?part.w:part.h;
  const local=(x,y)=>({x:center.x+x*ca-y*sa,y:center.y+x*sa+y*ca});
  const c0=local(-rw/2,-rh/2),c1=local(rw/2,-rh/2),c2=local(rw/2,rh/2),c3=local(-rw/2,rh/2);
  const r0=local(-rw/2,0),r1=local(rw/2,0);
  extrudePolygon(part.points,wallH,{top:gableColor,sideA:wallA,sideB:wallB,stroke});
  const faces=[
    {screen:[w2s(c0,wallH),w2s(c1,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:roofAColor},
    {screen:[w2s(c3,wallH),w2s(c2,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:roofBColor},
    {screen:[w2s(c0,wallH),w2s(c3,wallH),w2s(r0,ridgeH)],fill:gableColor},
    {screen:[w2s(c1,wallH),w2s(c2,wallH),w2s(r1,ridgeH)],fill:gableColor}
  ];
  faces.forEach(f=>f.depth=f.screen.reduce((sum,p)=>sum+p.y,0)/f.screen.length);
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.screen,f.fill,stroke,1);
}
function drawMarket(s,preview=false){
  const selected=State.selectedId===s.id,stroke=selected?'#f4b76f':'#b8a98f';
  const plaza=civicParts(s)[0];
  extrudePolygonAt(plaza.points,0,.12,{top:'#9a876b',sideA:'#665847',sideB:'#756451',stroke});
  const stalls=[
    {x:-1.05,y:-1.0,c:'#8c4f37'},{x:1.05,y:-1.0,c:'#b18a3f'},
    {x:-1.05,y:1.0,c:'#536d76'},{x:1.05,y:1.0,c:'#6f6941'}
  ];
  for(const st of stalls){
    const q=houseLocalToWorld(s,st.x,st.y),pts=rectWorldPoints(q.x,q.y,1.15,.72,s.angle||0);
    extrudePolygonAt(pts,.12,.46,{top:'#654b34',sideA:'#49382a',sideB:'#584331',stroke:null});
    const canopy=rectWorldPoints(q.x,q.y,1.38,.92,s.angle||0);
    extrudePolygonAt(canopy,.58,.66,{top:st.c,sideA:st.c,sideB:st.c,stroke:'rgba(235,218,186,.35)'});
  }
}
function civicEntranceInfo(s){
  if(!s||!['tavern','church'].includes(s.type))return null;
  const localY=s.type==='tavern'?(-1.72-1.55/2):(-2.65-1.85/2);
  const width=s.type==='tavern'?.42:.68;
  const height=s.type==='tavern'?.92:1.22;
  const ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0);
  const tangent={x:ca,y:sa};
  const normal={x:sa,y:-ca}; // local -Y = designated front
  const surface=houseLocalToWorld(s,0,localY);
  const outside={x:surface.x+normal.x*.48,y:surface.y+normal.y*.48};
  const inside={x:surface.x-normal.x*.18,y:surface.y-normal.y*.18};
  return{surface,outside,inside,tangent,normal,width,height};
}
function drawCivicEntrance(s){
  const d=civicEntranceInfo(s);if(!d)return;
  // Only draw the door when its facade faces the current camera.
  if(viewDepthPoint(d.outside)<=viewDepthPoint(d.inside))return;
  const half=d.width/2;
  const l={x:d.surface.x-d.tangent.x*half,y:d.surface.y-d.tangent.y*half};
  const r={x:d.surface.x+d.tangent.x*half,y:d.surface.y+d.tangent.y*half};
  const poly=[w2s(l,.03),w2s(r,.03),w2s(r,d.height),w2s(l,d.height)];
  if(s.type==='church'){
    pathPolygon(poly,'#292725','#9c978e',1.05);
    const arch=w2s(d.surface,d.height+.05);
    ctx.save();ctx.strokeStyle='rgba(185,181,172,.72)';ctx.lineWidth=Math.max(1,1.05*State.view.scale);
    ctx.beginPath();ctx.arc(arch.x,arch.y,Math.max(2.4,d.width*U*State.view.scale*.18),Math.PI,0);ctx.stroke();ctx.restore();
  }else{
    pathPolygon(poly,'#3a261b','#9b7658',.9);
  }
}
function drawTavern(s,preview=false){
  const selected=State.selectedId===s.id,stroke=selected?'#f4b76f':'#9a765d';
  const parts=civicParts(s).map(p=>({...p,depth:viewDepthPoint(p.center)})).sort((a,b)=>a.depth-b.depth);
  for(const part of parts)drawCivicGabledPart(s,part,1.48,2.08,'#684f3d','#7b5e48','#3b302b','#493930','#80624a',stroke);
  if(!preview&&!underConstruction(s))drawCivicEntrance(s);
}
function drawChurch(s,preview=false){
  const selected=State.selectedId===s.id,stroke=selected?'#f4b76f':'#aaa8a1';
  const parts=civicParts(s).map(p=>({...p,depth:viewDepthPoint(p.center)})).sort((a,b)=>a.depth-b.depth);
  for(const part of parts){
    if(part.role==='tower'){
      extrudePolygon(part.points,2.72,{top:'#676a6c',sideA:'#66635f',sideB:'#77736e',stroke});
      drawCivicGabledPart(s,part,2.72,3.35,'#66635f','#77736e','#3d4145','#484c50','#85817a',stroke);
    }else drawCivicGabledPart(s,part,1.88,2.52,'#6b6863','#7d7973','#41454a','#4c5054','#85817a',stroke);
  }
  if(!preview&&!underConstruction(s))drawCivicEntrance(s);
}
function drawTrainingField(s,preview=false){
  const selected=State.selectedId===s.id,stroke=selected?'#f4b76f':'rgba(189,153,105,.72)';
  const part=civicParts(s)[0];if(!part)return;
  extrudePolygonAt(part.points,0,.10,{
    top:preview?'rgba(116,82,49,.48)':'rgba(112,78,46,.82)',
    sideA:'#5b432f',sideB:'#6a4c34',stroke
  });

  // Worn central lane + four corner posts, enough to read as a dedicated training yard.
  const a=houseLocalToWorld(s,-1.75,0),b=houseLocalToWorld(s,1.75,0);
  const sa=w2s(a,.115),sb=w2s(b,.115);
  ctx.save();ctx.strokeStyle='rgba(205,171,117,.30)';ctx.lineWidth=Math.max(1,3.5*State.view.scale);
  ctx.lineCap='round';ctx.beginPath();ctx.moveTo(sa.x,sa.y);ctx.lineTo(sb.x,sb.y);ctx.stroke();ctx.restore();

  for(const [x,y] of [[-2.18,-1.68],[2.18,-1.68],[2.18,1.68],[-2.18,1.68]]){
    const q=houseLocalToWorld(s,x,y),pts=rectWorldPoints(q.x,q.y,.14,.14,s.angle||0);
    extrudePolygonAt(pts,.10,.58,{top:'#8b6847',sideA:'#59412e',sideB:'#6d5037',stroke:null});
  }
}
function drawCivicStructure(s,preview=false){
  if(s.type==='market')drawMarket(s,preview);
  else if(s.type==='tavern')drawTavern(s,preview);
  else if(s.type==='church')drawChurch(s,preview);
  else if(s.type==='training')drawTrainingField(s,preview);
}
function drawPointStructure(s,preview=false){
  const selected=State.selectedId===s.id,h=structureHeight(s),stroke=selected?'#f4b76f':'#d8c8b4';
  if(s.type==='well'){
    extrudePolygon(footprintPoints(s),h,{top:'#84796d',sideA:'#4e4740',sideB:'#5d554d',stroke});
    const p=w2s({x:s.x,y:s.y},h+.04),r=Math.max(2.5,.28*U*State.view.scale);ctx.fillStyle='#172023';ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.7,r,0,0,Math.PI*2);ctx.fill();
    if(State.village.founded&&State.village.name){ctx.fillStyle='#f2e6d3';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(State.village.name,p.x,p.y-12)}
    return;
  }
  const tower=s.type==='tower',gate=s.type==='gate';
  extrudePolygon(footprintPoints(s),h,{
    top:(tower||gate)?'#9a8e82':'#88796b',
    sideA:(tower||gate)?'#49443f':'#4e4740',
    sideB:(tower||gate)?'#686057':'#62584f',
    stroke
  });
  const c=w2s({x:s.x,y:s.y},h+.03),dir={x:s.x+Math.cos(s.angle||0)*.55,y:s.y+Math.sin(s.angle||0)*.55},d=w2s(dir,h+.03);
  ctx.strokeStyle=preview?'rgba(244,183,111,.95)':'rgba(245,226,202,.52)';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();
}
function drawFlatRect(s,fill,stroke){
  pathPolygon(projectPath(rectWorldPoints(s.x,s.y,s.w,s.h,s.angle||0)),fill,stroke,1);
}
function fieldGrid(field){
  const usableW=Math.max(.2,Number(field.w)-FIELD_CELL_MARGIN*2),usableH=Math.max(.2,Number(field.h)-FIELD_CELL_MARGIN*2);
  const cols=Math.max(1,Math.floor(usableW/FIELD_CELL_TARGET)),rows=Math.max(1,Math.floor(usableH/FIELD_CELL_TARGET));
  const cellW=usableW/cols,cellH=usableH/rows,ca=Math.cos(field.angle||0),sa=Math.sin(field.angle||0);
  const localToWorld=(x,y)=>({x:field.x+x*ca-y*sa,y:field.y+x*sa+y*ca});
  const cells=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=-usableW/2+(col+.5)*cellW,y=-usableH/2+(row+.5)*cellH;
    cells.push({index:row*cols+col,row,col,x,y,world:localToWorld(x,y)});
  }
  return{usableW,usableH,cols,rows,cellW,cellH,cells,localToWorld};
}
function drawField(field){
  drawFlatRect(field,'rgba(133,111,55,.52)','rgba(190,168,95,.58)');
  const g=fieldGrid(field);ctx.save();ctx.strokeStyle='rgba(218,195,118,.28)';ctx.lineWidth=.7;
  for(let i=1;i<g.cols;i++){
    const x=-g.usableW/2+i*g.cellW,a=w2s(g.localToWorld(x,-g.usableH/2),.012),b=w2s(g.localToWorld(x,g.usableH/2),.012);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  for(let i=1;i<g.rows;i++){
    const y=-g.usableH/2+i*g.cellH,a=w2s(g.localToWorld(-g.usableW/2,y),.012),b=w2s(g.localToWorld(g.usableW/2,y),.012);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.restore();
}
function drawHouseRoofPart(s,part,wallH,ridgeH,anthracite=false,gableFill=null){
  const turn=part.roofTurn||0,angle=(s.angle||0)+turn,ca=Math.cos(angle),sa=Math.sin(angle),center=houseLocalToWorld(s,part.cx,part.cy);
  const rw=Math.abs(turn)>1e-6?part.h:part.w,rh=Math.abs(turn)>1e-6?part.w:part.h;
  const local=(x,y)=>({x:center.x+x*ca-y*sa,y:center.y+x*sa+y*ca});
  const c0=local(-rw/2,-rh/2),c1=local(rw/2,-rh/2),c2=local(rw/2,rh/2),c3=local(-rw/2,rh/2);
  const r0=local(-rw/2,0),r1=local(rw/2,0);
  const faces=[
    {kind:'roof',screen:[w2s(c0,wallH),w2s(c1,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:anthracite?'#303237':'#5b3d30',stroke:anthracite?'#55585e':'#8c6752',lw:1},
    {kind:'roof',screen:[w2s(c3,wallH),w2s(c2,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:anthracite?'#3a3d42':'#6b4938',stroke:anthracite?'#55585e':'#8c6752',lw:1},
    {kind:'gable',screen:[w2s(c0,wallH),w2s(c3,wallH),w2s(r0,ridgeH)],fill:gableFill||'#654936',stroke:anthracite?'rgba(126,116,102,.55)':'#8c6752',lw:.75},
    {kind:'gable',screen:[w2s(c1,wallH),w2s(c2,wallH),w2s(r1,ridgeH)],fill:gableFill||'#654936',stroke:anthracite?'rgba(126,116,102,.55)':'#8c6752',lw:.75}
  ];
  // Canvas has no depth buffer: screen-space Y is the reliable local painter key here.
  // This makes the near triangular gable render after the roof slope instead of disappearing below it.
  faces.forEach(f=>f.depth=f.screen.reduce((sum,p)=>sum+p.y,0)/f.screen.length);
  faces.sort((a,b)=>a.depth-b.depth||(a.kind==='gable'?1:-1));
  for(const f of faces)pathPolygon(f.screen,f.fill,f.stroke,f.lw);
}
function drawHouseTurretRoof(s,turret,selected=false){
  const stroke=selected?'#f4b76f':'#555b62';
  const center=turret.center,baseZ=turret.bodyH,apex=w2s(center,turret.roofH);
  let ring;
  if(turret.type==='round'){
    ring=circleWorldPoints(center.x,center.y,turret.r*1.20,20);
  }else{
    ring=rectWorldPoints(center.x,center.y,turret.size*1.18,turret.size*1.18,s.angle||0);
  }
  const faces=[];
  for(let i=0;i<ring.length;i++){
    const j=(i+1)%ring.length,a=w2s(ring[i],baseZ),b=w2s(ring[j],baseZ);
    faces.push({poly:[a,b,apex],depth:(a.y+b.y+apex.y)/3,i});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.i%2?'#303943':'#394550',stroke,.75);
}
function drawHouseTurret(s,turret,selected=false){
  const stroke=selected?'#f4b76f':'#918d86',breakZ=1.02;
  // L4 turret follows the elite-house language: grey lower floor, warm cream upper floors.
  extrudePolygonAt(turret.points,0,breakZ,{
    top:'#625e59',sideA:'#4f4b47',sideB:'#625e59',stroke:null
  });
  extrudePolygonAt(turret.points,breakZ,turret.bodyH,{
    top:'#d6bf82',sideA:'#c8ae70',sideB:'#e0ca91',stroke
  });
  drawHouseTurretRoof(s,turret,selected);

  // Small high window so the tower reads immediately as inhabited rather than defensive.
  const p=w2s(turret.center,breakZ+(turret.bodyH-breakZ)*.55);
  const ww=clamp(3.5*State.view.scale,2.2,4.8),wh=clamp(5.6*State.view.scale,3.4,7.2);
  ctx.save();ctx.fillStyle='rgba(31,29,28,.86)';ctx.fillRect(p.x-ww/2,p.y-wh/2,ww,wh);
  ctx.strokeStyle='rgba(190,178,155,.42)';ctx.lineWidth=.7;ctx.strokeRect(p.x-ww/2,p.y-wh/2,ww,wh);ctx.restore();
}
function drawHouse(s){
  const level=houseLevel(s),wallH=houseBodyHeight(s),ridgeH=houseRidgeHeight(s),selected=State.selectedId===s.id;
  const stroke=selected?'#f4b76f':'#aaa199';
  const parts=houseFootprintParts(s).map(part=>{
    const center=part.center||houseLocalToWorld(s,part.cx,part.cy);
    return{...part,depth:viewDepthPoint(center)};
  }).sort((a,b)=>a.depth-b.depth);

  if(level===1){
    for(const part of parts){
      if(part.kind==='turret'){drawHouseTurret(s,part,selected);continue}
      extrudePolygon(part.points,wallH,{top:'#7d5b43',sideA:'#4e392d',sideB:'#654936',stroke:selected?'#f4b76f':'#b89575'});
      drawHouseRoofPart(s,part,wallH,ridgeH,false,null);
    }
  }else{
    const floorBreak=wallH*.50;
    const creamTop='#d6bf82',creamA='#c8ae70',creamB='#e0ca91',creamGable='#d9c184';
    for(const part of parts){
      if(part.kind==='turret'){drawHouseTurret(s,part,selected);continue}
      extrudePolygonAt(part.points,0,floorBreak,{top:'#625e59',sideA:'#4f4b47',sideB:'#625e59',stroke:null});
      extrudePolygonAt(part.points,floorBreak,wallH,{top:creamTop,sideA:creamA,sideB:creamB,stroke});
      drawHouseRoofPart(s,part,wallH,ridgeH,true,creamGable);
    }
  }
  if(!underConstruction(s))drawHouseChimneys(s);
}
function closestPointOnSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;if(!L2)return{x:a.x,y:a.y};
  const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/L2,0,1);return{x:a.x+t*dx,y:a.y+t*dy};
}
function inferHouseDoorSide(house){
  const ca=Math.cos(house.angle||0),sa=Math.sin(house.angle||0),localY={x:-sa,y:ca};
  let best=null,bestD=Infinity;
  const preferred=house.roadId&&State.structures.find(s=>s.id===house.roadId&&s.type==='road');
  const roads=preferred?[preferred]:roadList(true);
  for(const road of roads){
    const q=closestPointOnSegment(house,road.a,road.b),d=dist(house,q);
    if(d<bestD){bestD=d;best=q}
  }
  if(best){
    const dot=(best.x-house.x)*localY.x+(best.y-house.y)*localY.y;
    return dot>=0?1:-1;
  }
  return (peasantHash(house.id)&1)?1:-1;
}
function houseDoorInfo(house){
  if(!Number.isFinite(Number(house.doorSide)))house.doorSide=inferHouseDoorSide(house);
  const side=Number(house.doorSide)>=0?1:-1,ca=Math.cos(house.angle||0),sa=Math.sin(house.angle||0);
  const tangent={x:ca,y:sa},normal={x:-sa*side,y:ca*side},half=(Number(house.h)||1)/2;
  const lateralSign=(peasantHash(house.id)&2)?1:-1;
  const lateralOffset=(Number(house.w)||1.5)*.24*lateralSign;
  const surface={
    x:house.x+normal.x*half+tangent.x*lateralOffset,
    y:house.y+normal.y*half+tangent.y*lateralOffset
  };
  const outside={x:surface.x+normal.x*.28,y:surface.y+normal.y*.28};
  return{surface,outside,tangent,normal,side,lateralSign};
}
function drawHouseDoor(house){
  const d=houseDoorInfo(house),halfW=Math.min(.08,(Number(house.w)||1.5)*.0533);
  const visible=visibleFacadeEdges(house).some(e=>pointSegmentDistance(d.surface,e.a,e.b)<.08);
  if(!visible)return;
  const l={x:d.surface.x-d.tangent.x*halfW,y:d.surface.y-d.tangent.y*halfW};
  const r={x:d.surface.x+d.tangent.x*halfW,y:d.surface.y+d.tangent.y*halfW};
  const poly=[w2s(l,.04),w2s(r,.04),w2s(r,.552),w2s(l,.552)];
  pathPolygon(poly,'#39271e','rgba(170,139,96,.50)',.7);
}
function drawAutoStructure(s){
  ctx.save();if(underConstruction(s))ctx.globalAlpha=.38;
  if(s.type==='field'){
    drawField(s);
  }else if(s.type==='road'){
    const a=w2s(s.a),b=w2s(s.b);ctx.strokeStyle='rgba(126,106,82,.70)';ctx.lineWidth=Math.max(2,s.width*U*State.view.scale*.72);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }else if(s.type==='house')drawHouse(s);
  ctx.restore();if(underConstruction(s))drawConstructionProgress(s);
}
function structureCenter(s){if(s.x!=null)return{x:s.x,y:s.y};if(s.a&&s.b)return{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};return{x:0,y:0}}
function peasantHash(id){return biomeHash(String(id||'peasant'))}
function completedSettlement(type){return State.structures.filter(s=>s.type===type&&!underConstruction(s))}
function peasantVisualDay(){return State.clock.day*PEASANT_VISUAL_SPEED}
function visualCycleDay(){return peasantVisualDay()}
function visualCycleFrac(){
  if(State.daylightOverride==='day')return VISUAL_DAYLIGHT_RATIO*.5;
  if(State.daylightOverride==='night')return VISUAL_DAYLIGHT_RATIO+(1-VISUAL_DAYLIGHT_RATIO)*.5;
  const d=visualCycleDay();return d-Math.floor(d)
}
function nightFactor(){
  const t=visualCycleFrac(),nightStart=VISUAL_DAYLIGHT_RATIO;
  const duskEnd=nightStart+VISUAL_TWILIGHT,dawnStart=1-VISUAL_TWILIGHT;
  if(t<nightStart)return 0;
  if(t<duskEnd)return clamp((t-nightStart)/VISUAL_TWILIGHT,0,1);
  if(t<dawnStart)return 1;
  return 1-clamp((t-dawnStart)/VISUAL_TWILIGHT,0,1);
}
function sunShadowState(){
  const t=visualCycleFrac();
  if(t<0||t>=VISUAL_DAYLIGHT_RATIO)return null;
  const phase=clamp(t/VISUAL_DAYLIGHT_RATIO,0,1);
  const arc=Math.max(0,Math.sin(Math.PI*phase));
  const edgeFade=clamp(arc*4,0,1);
  if(edgeFade<=.001)return null;

  // Visual sun path only: low sun = long/darker shadows, noon = short/lighter.
  const altitude=(12+58*arc)*Math.PI/180;
  const lengthPerHeight=clamp(1/Math.tan(altitude),.32,4.6);
  const angle=Math.PI/4+phase*Math.PI;
  const alpha=(.10+.15*(1-arc))*edgeFade;
  const softness=clamp(.8+1.8*(1-arc),.8,2.6);
  return{
    phase,arc,alpha,softness,lengthPerHeight,
    dx:Math.cos(angle),dy:Math.sin(angle)
  };
}
function towerRoofRise(s){
  if(!s||s.type!=='tower'||towerRoofStyle(s)!=='pitched')return 0;
  const span=s.shape==='round'?Number(s.r||.5)*2:Number(s.size||1);
  return s.shape==='round'
    ?clamp(span*.53,.54,1.04)
    :clamp(span*.45,.48,.92);
}
function towerVisualTopHeight(s){
  if(!s||s.type!=='tower')return structureHeight(s);
  return structureHeight(s)+towerRoofRise(s);
}
function towerRoofFootprintPoints(s){
  if(!s||s.type!=='tower')return[];
  const overhang=.07;
  if(s.shape==='round')return circleWorldPoints(s.x,s.y,Number(s.r||.5)+overhang,24);
  const d=rectDims(s);
  return rectWorldPoints(s.x,s.y,d.w+overhang*2,d.h+overhang*2,s.angle||0);
}
function gateRoofRise(s){
  if(!s||s.type!=='gate'||gateRoofStyle(s)!=='pitched')return 0;
  return .66;
}
function gateRoofGeometry(s){
  if(!s||s.type!=='gate'||gateRoofStyle(s)!=='pitched')return null;
  const d=rectDims(s),overhang=.08,h=structureHeight(s),rise=gateRoofRise(s);
  const hx=d.w/2+overhang,hy=d.h/2+overhang,ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0);
  const local=(x,y)=>({x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca});
  const c0=local(-hx,-hy),c1=local(hx,-hy),c2=local(hx,hy),c3=local(-hx,hy);
  const ridgeA=local(-hx,0),ridgeB=local(hx,0);
  return{h,ridgeH:h+rise,c0,c1,c2,c3,ridgeA,ridgeB,footprint:[c0,c1,c2,c3]};
}
function gateVisualTopHeight(s){
  if(!s||s.type!=='gate')return structureHeight(s);
  return structureHeight(s)+gateRoofRise(s);
}
function structureVisualTopHeight(s){
  if(s?.type==='tower')return towerVisualTopHeight(s);
  if(s?.type==='gate')return gateVisualTopHeight(s);
  return structureHeight(s);
}
function shadowStructureHeight(s){
  if(s?.type==='house')return houseStructureHeight(s);
  if(s?.type==='built'){const g=builtRoofGeometry(s);return g?.ridgeH||structureHeight(s)}
  if(s?.type==='tower'&&towerRoofStyle(s)==='pitched')return towerVisualTopHeight(s);
  if(s?.type==='gate'&&gateRoofStyle(s)==='pitched')return gateVisualTopHeight(s);
  return structureHeight(s);
}
function convexHull(points){
  if(points.length<=3)return points.slice();
  const pts=points.slice().sort((a,b)=>a.x===b.x?a.y-b.y:a.x-b.x);
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lower=[];
  for(const p of pts){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p)}
  const upper=[];
  for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p)}
  lower.pop();upper.pop();return lower.concat(upper);
}
function drawStructureShadow(s,sun){
  if(!s||underConstruction(s)||!['house','tower','gate','wall','built','market','tavern','church'].includes(s.type))return;
  const fp=isCastlePart(s)?unionFootprintPoints(s):footprintPoints(s);
  const h=shadowStructureHeight(s);
  if(!fp?.length||h<=0)return;
  const len=h*sun.lengthPerHeight;
  const ox=sun.dx*len,oy=sun.dy*len;
  const cloud=[];
  for(const p of fp){
    cloud.push(w2s(p,0));
    cloud.push(w2s({x:p.x+ox,y:p.y+oy},0));
  }
  const hull=convexHull(cloud);if(hull.length<3)return;
  ctx.save();
  ctx.filter='blur('+sun.softness.toFixed(2)+'px)';
  pathPolygon(hull,'rgba(4,5,7,'+sun.alpha.toFixed(3)+')',null);
  ctx.restore();
}
function drawDynamicShadows(){
  const sun=sunShadowState();if(!sun)return;
  const casters=State.structures.filter(s=>!underConstruction(s)&&['house','tower','gate','wall','built','market','tavern','church'].includes(s.type));
  for(const s of casters)drawStructureShadow(s,sun);
}
let fieldWorkAssignmentCache={key:null,map:new Map()};
function fieldWorkAssignments(houses,fields){
  const key=houses.map(h=>h.id).sort().join(',')+'|'+fields.map(f=>[f.id,f.x,f.y,f.w,f.h,f.angle].join(':')).sort().join(',');
  if(fieldWorkAssignmentCache.key===key)return fieldWorkAssignmentCache.map;

  const slots=[];
  for(const field of fields)for(const cell of fieldGrid(field).cells)slots.push({field,cell,used:false});
  const assignments=new Map(),ordered=houses.slice().sort((a,b)=>peasantHash(a.id)-peasantHash(b.id));
  for(const house of ordered){
    const door=houseDoorInfo(house).outside;let best=null,bestScore=Infinity;
    for(const slot of slots){
      if(slot.used)continue;
      const score=dist(door,slot.cell.world);
      if(score<bestScore){bestScore=score;best=slot}
    }
    if(best){best.used=true;assignments.set(house.id,{field:best.field,cell:best.cell})}
  }
  fieldWorkAssignmentCache={key,map:assignments};
  return assignments;
}

const PEASANT_PATH_STEP=.5,PEASANT_CLEARANCE=.22;
const PEASANT_ROAD_COST=.38,PEASANT_ROADSIDE_COST=.68,PEASANT_ROADSIDE_RANGE=.85;
let peasantPathCache=new Map(),peasantPathSignature='';
function peasantObstacleSignature(){
  return State.structures.filter(s=>['house','tower','gate','wall','built','well','road','market','tavern','church','training'].includes(s.type)).map(s=>{
    if(['wall','built','road'].includes(s.type))return [s.id,s.type,s.a.x,s.a.y,s.b.x,s.b.y,s.width,JSON.stringify(s.functions||[]),underConstruction(s)?1:0].join(',');
    return [s.id,s.type,s.x,s.y,s.w,s.h,s.r,s.size,s.angle,s.houseLevel,JSON.stringify(s.functions||[]),underConstruction(s)?1:0].join(',');
  }).join('|');
}
function syncPeasantPathCache(){
  // Topology mutations explicitly reset peasantPathSignature to ''. Avoid
  // serializing every obstacle again for every resident/path lookup.
  if(peasantPathSignature)return;
  peasantPathSignature=peasantObstacleSignature()||'empty';
  peasantPathCache.clear();
}
function pointBlockedForPeasant(p,sourceHouseId){
  for(const s of State.structures){
    if(s.id===sourceHouseId)continue;
    if(!['house','tower','gate','wall','built','well','market','tavern','church','training'].includes(s.type))continue;

    // Market ground and the actual castle gate passage are traversable.
    if(s.type==='market')continue;
    if(s.type==='gate'){
      if(gatePointInPassage(s,p,.08))continue;
      const q=toLocalPoint(s,p),d=rectDims(s);
      if(Math.abs(q.x)<=d.w/2+PEASANT_CLEARANCE&&Math.abs(q.y)<=d.h/2+PEASANT_CLEARANCE)return true;
      continue;
    }

    if(['wall','built'].includes(s.type)){
      if(pointSegmentDistance(p,s.a,s.b)<=Number(s.width)/2+PEASANT_CLEARANCE)return true;
      continue;
    }
    if(s.type==='well'){if(dist(p,s)<=.62+PEASANT_CLEARANCE)return true;continue}
    if(s.type==='tower'&&s.shape==='round'){if(dist(p,s)<=s.r+PEASANT_CLEARANCE)return true;continue}
    if(s.type==='house'||isCivic(s)){
      const parts=s.type==='house'?houseFootprintParts(s):civicParts(s);
      for(const part of parts){
        if(pointInPolygon(p,part.points))return true;
        for(let i=0;i<part.points.length;i++){const j=(i+1)%part.points.length;if(pointSegmentDistance(p,part.points[i],part.points[j])<=PEASANT_CLEARANCE)return true}
      }
      continue;
    }
    const q=toLocalPoint(s,p),d=rectDims(s);
    if(Math.abs(q.x)<=d.w/2+PEASANT_CLEARANCE&&Math.abs(q.y)<=d.h/2+PEASANT_CLEARANCE)return true;
  }
  return false;
}
function peasantRoadDistance(p){
  let best=Infinity,width=0;
  for(const road of roadList(true)){
    const d=pointSegmentDistance(p,road.a,road.b);
    if(d<best){best=d;width=Number(road.width)||.3}
  }
  return{d:best,width};
}
function peasantTerrainCost(p){
  const road=peasantRoadDistance(p);
  if(!Number.isFinite(road.d))return 1;
  const edge=Math.max(.10,road.width/2);
  if(road.d<=edge+.18)return PEASANT_ROAD_COST;
  if(road.d<=edge+PEASANT_ROADSIDE_RANGE)return PEASANT_ROADSIDE_COST;
  return 1;
}
function peasantSegmentTravelCost(a,b){
  const L=dist(a,b);if(L<=1e-6)return 0;
  const steps=Math.max(2,Math.ceil(L/.25));let sum=0;
  for(let i=0;i<steps;i++){
    const t=(i+.5)/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    sum+=peasantTerrainCost(p);
  }
  return L*sum/steps;
}
function peasantSegmentClear(a,b,sourceHouseId){
  const L=dist(a,b),steps=Math.max(2,Math.ceil(L/.22));
  for(let i=1;i<steps;i++){const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(pointBlockedForPeasant(p,sourceHouseId))return false}
  return true;
}
function smoothPeasantPath(points,sourceHouseId){
  if(points.length<=2)return points;
  const prefix=[0];
  for(let i=0;i<points.length-1;i++)prefix.push(prefix.at(-1)+peasantSegmentTravelCost(points[i],points[i+1]));
  const out=[points[0]];let i=0;
  while(i<points.length-1){
    let chosen=i+1;
    for(let j=points.length-1;j>i+1;j--){
      if(!peasantSegmentClear(points[i],points[j],sourceHouseId))continue;
      const originalCost=prefix[j]-prefix[i],shortcutCost=peasantSegmentTravelCost(points[i],points[j]);
      // Only simplify if the shortcut preserves the road preference found by A*.
      if(shortcutCost<=originalCost*1.06){chosen=j;break}
    }
    out.push(points[chosen]);i=chosen;
  }
  return out;
}
class PeasantMinHeap{
  constructor(){this.a=[]}
  push(n){const a=this.a;a.push(n);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p}a[i]=n}
  pop(){const a=this.a;if(!a.length)return null;const root=a[0],last=a.pop();if(a.length){let i=0;while(true){let l=i*2+1,r=l+1;if(l>=a.length)break;let m=r<a.length&&a[r].f<a[l].f?r:l;if(a[m].f>=last.f)break;a[i]=a[m];i=m}a[i]=last}return root}
  get length(){return this.a.length}
}
function findPeasantPath(start,goal,sourceHouseId,pad=8){
  const step=PEASANT_PATH_STEP;
  const minX=Math.floor((Math.min(start.x,goal.x)-pad)/step),maxX=Math.ceil((Math.max(start.x,goal.x)+pad)/step);
  const minY=Math.floor((Math.min(start.y,goal.y)-pad)/step),maxY=Math.ceil((Math.max(start.y,goal.y)+pad)/step);
  const key=(x,y)=>x+','+y,pos=(x,y)=>({x:x*step,y:y*step});
  function nearestFree(p){
    const cx=Math.round(p.x/step),cy=Math.round(p.y/step);let best=null,bestD=Infinity;
    for(let r=0;r<=4;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
      const x=cx+dx,y=cy+dy,q=pos(x,y);if(x<minX||x>maxX||y<minY||y>maxY||pointBlockedForPeasant(q,sourceHouseId))continue;
      if(!peasantSegmentClear(p,q,sourceHouseId))continue;
      const d=dist(p,q);if(d<bestD){best={x,y,q};bestD=d}
    }
    return best;
  }
  const s=nearestFree(start),g=nearestFree(goal);if(!s||!g)return null;
  const open=new PeasantMinHeap(),gScore=new Map([[key(s.x,s.y),0]]),came=new Map(),closed=new Set();
  open.push({x:s.x,y:s.y,f:dist(s.q,g.q)*PEASANT_ROAD_COST});
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null,guard=0;
  while(open.length&&guard++<30000){
    const cur=open.pop(),ck=key(cur.x,cur.y);if(closed.has(ck))continue;closed.add(ck);
    if(cur.x===g.x&&cur.y===g.y){found=cur;break}
    for(const [dx,dy] of dirs){
      const nx=cur.x+dx,ny=cur.y+dy;if(nx<minX||nx>maxX||ny<minY||ny>maxY)continue;
      const nk=key(nx,ny),q=pos(nx,ny);if(closed.has(nk)||pointBlockedForPeasant(q,sourceHouseId))continue;
      if(dx&&dy){
        const q1=pos(cur.x+dx,cur.y),q2=pos(cur.x,cur.y+dy);
        if(pointBlockedForPeasant(q1,sourceHouseId)||pointBlockedForPeasant(q2,sourceHouseId))continue;
      }
      const baseStep=Math.hypot(dx,dy)*step;
      const from=pos(cur.x,cur.y),moveCost=baseStep*(peasantTerrainCost(from)+peasantTerrainCost(q))*.5;
      const tentative=(gScore.get(ck)??Infinity)+moveCost;
      if(tentative<(gScore.get(nk)??Infinity)){
        gScore.set(nk,tentative);came.set(nk,ck);
        // Minimum terrain multiplier keeps the heuristic admissible while roads remain attractive.
        open.push({x:nx,y:ny,f:tentative+dist(q,g.q)*PEASANT_ROAD_COST});
      }
    }
  }
  if(!found)return null;
  const rev=[],startKey=key(s.x,s.y);let k=key(g.x,g.y);
  while(true){const [x,y]=k.split(',').map(Number);rev.push(pos(x,y));if(k===startKey)break;k=came.get(k);if(!k)return null}
  rev.reverse();return smoothPeasantPath([start,...rev,goal],sourceHouseId);
}
function peasantPath(house,assignment){
  syncPeasantPathCache();
  const field=assignment.field,cell=assignment.cell,key=house.id+'>'+field.id+':'+cell.index;
  if(peasantPathCache.has(key))return peasantPathCache.get(key);
  const start=houseDoorInfo(house).outside,goal={...cell.world};
  let path=findPeasantPath(start,goal,house.id,8);
  if(!path)path=findPeasantPath(start,goal,house.id,18);
  if(!path)path=[start];
  peasantPathCache.set(key,path);return path;
}
function nearestCompletedStructure(type,from){
  let best=null,bestD=Infinity;
  for(const s of State.structures){
    if(s.type!==type||underConstruction(s))continue;
    const q=structureCenter(s),d=dist(from,q);
    if(d<bestD){best=s;bestD=d}
  }
  return best;
}
function completedWorkshops(){
  return State.structures.filter(s=>!underConstruction(s)&&Array.isArray(s.functions)&&s.functions.includes('workshop'));
}
function nearestWorkshop(from){
  let best=null,bestD=Infinity;
  for(const s of completedWorkshops()){
    const q=structureCenter(s),d=dist(from,q);
    if(d<bestD){best=s;bestD=d}
  }
  return best;
}
function structureAccessPoint(target,from,visitorId=''){
  if(!target)return null;
  const h=peasantHash(String(visitorId)+'>'+target.id),jitter=(((h>>>5)%7)-3)*.12;

  // The market is a walkable plaza, not a solid building.
  // Visitors occupy deterministic positions inside the 4×4U square, between stalls.
  if(target.type==='market'){
    const spots=[
      {x:0,y:0},{x:.72,y:0},{x:-.72,y:0},
      {x:0,y:.72},{x:0,y:-.72},{x:.48,y:.48},{x:-.48,y:-.48}
    ];
    const spot=spots[h%spots.length];
    return houseLocalToWorld(target,spot.x,spot.y);
  }

  if(target.type==='tavern'||target.type==='church'){
    return civicEntranceInfo(target)?.outside||structureCenter(target);
  }

  if(['wall','built'].includes(target.type)){
    const mid={x:(target.a.x+target.b.x)/2,y:(target.a.y+target.b.y)/2};
    const dx=target.b.x-target.a.x,dy=target.b.y-target.a.y,L=Math.hypot(dx,dy)||1;
    const nx=-dy/L,ny=dx/L,side=((from.x-mid.x)*nx+(from.y-mid.y)*ny)>=0?1:-1;
    const along=(((h>>>12)%1000)/1000-.5)*Math.min(1.1,target.length*.45);
    const ux=dx/L,uy=dy/L,off=(Number(target.width)||1)/2+.48;
    return{x:mid.x+ux*along+nx*off*side,y:mid.y+uy*along+ny*off*side};
  }
  const center=structureCenter(target);
  let radius=.9;
  if(isCivic(target))radius=civicRadius(target)+.5;
  else if(target.type==='well')radius=1.0;
  else if(target.type==='tower')radius=(target.shape==='round'?target.r:Math.hypot(...Object.values(rectDims(target)))/2)+.45;
  else if(target.type==='gate')radius=Math.hypot(...Object.values(rectDims(target)))/2+.45;
  else if(target.w&&target.h)radius=Math.hypot(target.w,target.h)/2+.45;
  let angle=Math.atan2(from.y-center.y,from.x-center.x)+jitter;
  if(!Number.isFinite(angle))angle=jitter;
  return{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};
}
function villagerPathBetween(house,start,goal,tag){
  if(!start||!goal)return start?[start]:[];
  syncPeasantPathCache();
  const key='routine:'+house.id+':'+tag+':'+start.x.toFixed(2)+','+start.y.toFixed(2)+'>'+goal.x.toFixed(2)+','+goal.y.toFixed(2);
  if(peasantPathCache.has(key))return peasantPathCache.get(key);
  let path=findPeasantPath(start,goal,house.id,8);
  if(!path)path=findPeasantPath(start,goal,house.id,18);
  if(!path)path=[start,goal];
  peasantPathCache.set(key,path);
  return path;
}
function routineSmooth(t){t=clamp(t,0,1);return t*t*(3-2*t)}
function routineTravel(house,start,goal,frac,t0,t1,tag){
  const path=villagerPathBetween(house,start,goal,tag);
  return pointAlongPath(path,routineSmooth((frac-t0)/Math.max(.001,t1-t0)));
}
function fallbackSocialTarget(house,from,visitorId){
  const market=nearestCompletedStructure('market',from);
  if(market)return{structure:market,point:structureAccessPoint(market,from,visitorId)};
  const tavern=nearestCompletedStructure('tavern',from);
  if(tavern)return{structure:tavern,point:structureAccessPoint(tavern,from,visitorId)};
  const church=nearestCompletedStructure('church',from);
  if(church)return{structure:church,point:structureAccessPoint(church,from,visitorId)};
  const well=nearestCompletedStructure('well',from);
  if(well)return{structure:well,point:structureAccessPoint(well,from,visitorId)};
  return null;
}
function artisanPosition(house,day){
  const frac=day-Math.floor(day),hash=peasantHash(house.id),stagger=(((hash>>>8)%1000)/1000-.5)*.024;
  const home=houseDoorInfo(house).outside;
  const workshop=nearestWorkshop(home);
  const market=nearestCompletedStructure('market',home);
  let primary=workshop?{structure:workshop,point:structureAccessPoint(workshop,home,house.id+'-work')}:null;
  if(!primary&&market)primary={structure:market,point:structureAccessPoint(market,home,house.id+'-work')};
  if(!primary)primary=fallbackSocialTarget(house,home,house.id+'-work');
  if(!primary)return null;
  let secondary=market&&market.id!==primary.structure?.id?{structure:market,point:structureAccessPoint(market,primary.point,house.id+'-market')}:null;

  const leave0=.08+stagger,arriveWork=.15+stagger,leaveWork=.37+stagger;
  const arriveSecond=.44+stagger,leaveSecond=.55+stagger,homeAt=.63+stagger;
  if(frac<leave0||frac>homeAt)return null;
  if(frac<arriveWork)return routineTravel(house,home,primary.point,frac,leave0,arriveWork,'artisan-home-work');
  if(frac<leaveWork)return primary.point;
  if(secondary){
    if(frac<arriveSecond)return routineTravel(house,primary.point,secondary.point,frac,leaveWork,arriveSecond,'artisan-work-market');
    if(frac<leaveSecond)return secondary.point;
    return routineTravel(house,secondary.point,home,frac,leaveSecond,homeAt,'artisan-market-home');
  }
  if(frac<leaveSecond)return primary.point;
  return routineTravel(house,primary.point,home,frac,leaveSecond,homeAt,'artisan-work-home');
}
function merchantPosition(house,day){
  const frac=day-Math.floor(day),hash=peasantHash(house.id),stagger=(((hash>>>8)%1000)/1000-.5)*.024;
  const home=houseDoorInfo(house).outside;
  const market=nearestCompletedStructure('market',home);
  const first=market?{structure:market,point:structureAccessPoint(market,home,house.id+'-market')}:fallbackSocialTarget(house,home,house.id+'-market');
  if(!first)return null;
  const tavern=nearestCompletedStructure('tavern',first.point);
  const second=tavern&&tavern.id!==first.structure?.id?{structure:tavern,point:structureAccessPoint(tavern,first.point,house.id+'-tavern')}:null;

  const leave0=.10+stagger,arriveFirst=.17+stagger,leaveFirst=.43+stagger;
  const arriveSecond=.49+stagger,leaveSecond=.57+stagger,homeAt=.65+stagger;
  if(frac<leave0||frac>homeAt)return null;
  if(frac<arriveFirst)return routineTravel(house,home,first.point,frac,leave0,arriveFirst,'merchant-home-market');
  if(frac<leaveFirst)return first.point;
  if(second){
    if(frac<arriveSecond)return routineTravel(house,first.point,second.point,frac,leaveFirst,arriveSecond,'merchant-market-tavern');
    if(frac<leaveSecond)return second.point;
    return routineTravel(house,second.point,home,frac,leaveSecond,homeAt,'merchant-tavern-home');
  }
  if(frac<leaveSecond)return first.point;
  return routineTravel(house,first.point,home,frac,leaveSecond,homeAt,'merchant-market-home');
}
function elitePosition(house,day){
  const frac=day-Math.floor(day),hash=peasantHash(house.id),stagger=(((hash>>>8)%1000)/1000-.5)*.018;
  const home=houseDoorInfo(house).outside;
  const church=nearestCompletedStructure('church',home);
  const market=nearestCompletedStructure('market',home);
  const tavern=nearestCompletedStructure('tavern',home);
  const stops=[church,market,tavern].filter(Boolean);
  if(!stops.length)return null;
  const points=stops.map((s,i)=>structureAccessPoint(s,i?structureCenter(stops[i-1]):home,house.id+'-elite-'+i));
  const t0=.10+stagger,t1=.17+stagger,t2=.29+stagger,t3=.36+stagger,t4=.46+stagger,t5=.52+stagger,t6=.58+stagger,t7=.65+stagger;
  const a=points[0],b=points[1]||a,d=points[2]||b;
  if(frac<t0||frac>t7)return null;
  if(frac<t1)return routineTravel(house,home,a,frac,t0,t1,'elite-home-a');
  if(frac<t2)return a;
  if(frac<t3)return routineTravel(house,a,b,frac,t2,t3,'elite-a-b');
  if(frac<t4)return b;
  if(frac<t5)return routineTravel(house,b,d,frac,t4,t5,'elite-b-c');
  if(frac<t6)return d;
  return routineTravel(house,d,home,frac,t6,t7,'elite-home');
}
function pointAlongPath(path,t){
  if(!path?.length)return null;if(path.length===1)return path[0];
  t=clamp(t,0,1);const lens=[];let total=0;
  for(let i=0;i<path.length-1;i++){const L=dist(path[i],path[i+1]);lens.push(L);total+=L}
  if(total<=1e-6)return path[0];
  let target=t*total;
  for(let i=0;i<lens.length;i++){
    if(target<=lens[i]){const u=lens[i]?target/lens[i]:0;return{x:path[i].x+(path[i+1].x-path[i].x)*u,y:path[i].y+(path[i+1].y-path[i].y)*u}}
    target-=lens[i];
  }
  return path.at(-1);
}
function peasantPosition(house,assignment,day){
  const h=peasantHash(house.id),frac=day-Math.floor(day),stagger=(((h>>>8)%1000)/1000-.5)*.025;
  const leave0=.06+stagger,leave1=.14+stagger,return0=.52+stagger,return1=.62+stagger;
  if(frac<leave0||frac>return1)return null;
  const path=peasantPath(house,assignment),work=assignment.cell.world;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
  if(frac<leave1)return pointAlongPath(path,smooth((frac-leave0)/(leave1-leave0)));
  if(frac<return0)return{x:work.x,y:work.y};
  return pointAlongPath(path,1-smooth((frac-return0)/(return1-return0)));
}
function peasantAnimationActive(){
  const day=peasantVisualDay(),frac=day-Math.floor(day);
  return frac>=.035&&frac<=.67&&completedSettlement('house').length>0;
}
function housePopulationCapacity(house){
  const level=houseLevel(house);
  return{male:level,female:level,children:level*2,total:level*4};
}
function houseResidents(house){
  const cap=housePopulationCapacity(house),out=[];
  for(let i=0;i<cap.male;i++)out.push({id:house.id+':m:'+i,sex:'male',age:'adult',index:i});
  for(let i=0;i<cap.female;i++)out.push({id:house.id+':f:'+i,sex:'female',age:'adult',index:i});
  for(let i=0;i<cap.children;i++){
    const id=house.id+':c:'+i;
    out.push({id,sex:(peasantHash(id)&1)?'female':'male',age:'child',index:i});
  }
  return out;
}
function residentTimeOffset(id){
  return (((peasantHash(id+'-time')>>>8)%1000)/1000-.5)*.055;
}
function residentScatter(p,id,child=false){
  if(!p)return null;
  const h=peasantHash(id+'-scatter'),a=(h%360)*Math.PI/180;
  const r=(child?.10:.075)+(((h>>>9)%1000)/1000)*(child?.08:.07);
  return{x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};
}
function familyPosition(house,day){
  const frac=day-Math.floor(day),hash=peasantHash(house.id+'-family'),stagger=(((hash>>>8)%1000)/1000-.5)*.022;
  const home=houseDoorInfo(house).outside;
  const market=nearestCompletedStructure('market',home);
  const church=nearestCompletedStructure('church',home);
  const well=nearestCompletedStructure('well',home);
  const tavern=nearestCompletedStructure('tavern',home);
  const target=market||church||well||tavern;
  if(!target)return null;
  const dest=structureAccessPoint(target,home,house.id+'-family');
  const leave0=.17+stagger,arrive=.24+stagger,leave=.48+stagger,homeAt=.58+stagger;
  if(frac<leave0||frac>homeAt)return null;
  if(frac<arrive)return routineTravel(house,home,dest,frac,leave0,arrive,'family-out');
  if(frac<leave)return dest;
  return routineTravel(house,dest,home,frac,leave,homeAt,'family-home');
}
function residentClassPosition(house,resident,day,assignment){
  const level=houseLevel(house),shiftedDay=day+residentTimeOffset(resident.id);
  if(resident.age==='child')return familyPosition(house,shiftedDay);
  if(resident.sex==='female'&&level===1)return familyPosition(house,shiftedDay);
  if(level===1)return assignment?peasantPosition(house,assignment,shiftedDay):null;
  if(level===2)return artisanPosition(house,shiftedDay);
  if(level===3)return merchantPosition(house,shiftedDay);
  return elitePosition(house,shiftedDay);
}
function villagerClass(house){
  const level=houseLevel(house);
  if(level>=4)return'elite';
  if(level===3)return'merchant';
  if(level===2)return'artisan';
  return'peasant';
}
function villagerHair(id){
  const n=(peasantHash(id+'-hair')>>>0)%100;
  if(n<20)return'blonde';
  if(n<50)return'brown';
  if(n<75)return'black';
  if(n<85)return'bald';
  if(n<95)return'gray';
  return'red';
}
function villagerBodyColors(id,kind){
  const palette=kind==='merchant'?MERCHANT_PALETTE:kind==='elite'?ELITE_PALETTE:kind==='artisan'?ARTISAN_PALETTE:PEASANT_PALETTE;
  const h1=peasantHash(id+'-cloth-a'),h2=peasantHash(id+'-cloth-b');
  const a=palette[h1%palette.length];
  let b=palette[h2%palette.length];
  if(b===a)b=palette[(h2+1)%palette.length];
  return[a,b];
}
function bodyPath(kind,x,y,w,h){
  ctx.beginPath();
  if(kind==='peasant'){
    ctx.moveTo(x,y-h/2);ctx.lineTo(x+w/2,y+h/2);ctx.lineTo(x-w/2,y+h/2);ctx.closePath();
  }else if(kind==='artisan'){
    ctx.rect(x-w/2,y-h/2,w,h);
  }else if(kind==='merchant'){
    ctx.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);
  }else{
    const r=Math.min(w,h)/2;ctx.arc(x,y,r,0,Math.PI*2);
  }
}
function drawSplitVillagerBody(kind,x,y,w,h,topColor,bottomColor){
  ctx.save();
  bodyPath(kind,x,y,w,h);ctx.clip();
  ctx.fillStyle=topColor;ctx.fillRect(x-w,y-h,x+w*2,h);
  ctx.fillStyle=bottomColor;ctx.fillRect(x-w,y,x+w*2,h);
  ctx.restore();

  bodyPath(kind,x,y,w,h);
  ctx.strokeStyle='rgba(33,24,16,.82)';ctx.lineWidth=Math.max(.7,w*.11);ctx.stroke();

  ctx.save();bodyPath(kind,x,y,w,h);ctx.clip();
  ctx.strokeStyle='rgba(33,24,16,.42)';ctx.lineWidth=Math.max(.55,w*.075);
  ctx.beginPath();ctx.moveTo(x-w/2,y);ctx.lineTo(x+w/2,y);ctx.stroke();
  ctx.restore();
}
function drawVillagerHead(id,x,y,r,sex='male'){
  const hair=villagerHair(id);
  ctx.save();
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();

  if(hair!=='bald'){
    const hc=HAIR_COLORS[hair];
    ctx.beginPath();ctx.arc(x,y,r,Math.PI,Math.PI*2);ctx.lineTo(x-r,y);ctx.closePath();
    ctx.fillStyle=hc;ctx.fill();

    // Female adults/girls keep the same deterministic hair colour but get visible side locks.
    if(sex==='female'){
      ctx.fillStyle=hc;
      ctx.beginPath();ctx.ellipse(x-r*.72,y+r*.48,r*.34,r*.80,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+r*.72,y+r*.48,r*.34,r*.80,0,0,Math.PI*2);ctx.fill();
    }
  }

  ctx.strokeStyle='rgba(67,42,30,.80)';ctx.lineWidth=Math.max(.65,r*.20);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
function drawVillagerFigure(dot){
  const base=w2s(dot.p,.10),scale=clamp(State.view.scale,.55,1.45);
  const kind=dot.kind,sizeFactor=dot.age==='child'?.5:1;
  const bodyW=clamp(6.0*scale,4.2,8.2)*sizeFactor,bodyH=clamp(8.0*scale,5.5,10.6)*sizeFactor;
  const headR=clamp(2.35*scale,1.8,3.15)*sizeFactor,bodyY=base.y-bodyH*.16;
  drawSplitVillagerBody(kind,base.x,bodyY,bodyW,bodyH,dot.colors[0],dot.colors[1]);
  drawVillagerHead(dot.id,base.x,bodyY-bodyH/2-headR*.68,headR,dot.sex);
}
function worldPointVisible(p,z=0,pad=48){
  const s=w2s(p,z),r=wrap.getBoundingClientRect();
  return s.x>=-pad&&s.y>=-pad&&s.x<=r.width+pad&&s.y<=r.height+pad;
}
function drawPeasants(){
  const houses=completedSettlement('house'),fields=completedSettlement('field');
  if(!houses.length)return;
  const day=peasantVisualDay(),dots=[];
  const peasantHouses=houses.filter(h=>houseLevel(h)===1);
  const assignments=fieldWorkAssignments(peasantHouses,fields);

  for(const house of houses){
    const kind=villagerClass(house),assignment=assignments.get(house.id);
    for(const resident of houseResidents(house)){
      let p=residentClassPosition(house,resident,day,assignment);
      if(!p)continue;
      p=residentScatter(p,resident.id,resident.age==='child');
      if(!worldPointVisible(p,0,40))continue;
      dots.push({
        p,id:resident.id,kind,sex:resident.sex,age:resident.age,
        colors:villagerBodyColors(resident.id,kind)
      });
    }
  }
  dots.sort((a,b)=>{const aa=rotateViewPoint(a.p),bb=rotateViewPoint(b.p);return aa.x+aa.y-(bb.x+bb.y)});
  for(const dot of dots)drawVillagerFigure(dot);
}
function militaryScale(){
  return clamp(State.view.scale,.55,1.45);
}
function soldierLivery(id){
  const flip=(peasantHash(String(id)+'-livery')&1)!==0;
  return flip
    ?{main:REIGN_COLOR_2,alt:REIGN_COLOR_1,mainDark:REIGN_COLOR_2_DARK,altDark:REIGN_COLOR_1_DARK}
    :{main:REIGN_COLOR_1,alt:REIGN_COLOR_2,mainDark:REIGN_COLOR_1_DARK,altDark:REIGN_COLOR_2_DARK};
}
function soldierBodyPath(base,bodyW,bodyH,top,bodyY){
  ctx.beginPath();
  ctx.moveTo(base.x-bodyW*.42,top);ctx.lineTo(base.x+bodyW*.42,top);
  ctx.lineTo(base.x+bodyW*.50,bodyY+bodyH*.50);ctx.lineTo(base.x-bodyW*.50,bodyY+bodyH*.50);ctx.closePath();
}
function drawQuarteredShield(cx,cy,rx,ry,livery,stroke,scale){
  ctx.save();
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=livery.main;ctx.fillRect(cx-rx,cy-ry,rx,ry);
  ctx.fillStyle=livery.alt;ctx.fillRect(cx,cy-ry,rx,ry);
  ctx.fillStyle=livery.alt;ctx.fillRect(cx-rx,cy,rx,ry);
  ctx.fillStyle=livery.main;ctx.fillRect(cx,cy,rx,ry);
  ctx.restore();
  ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.8,.9*scale);
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawSoldierFigure(p,z,type,id,phase=0){
  const base=w2s(p,z),scale=militaryScale(),bodyW=5.4*scale,bodyH=8.0*scale,headR=2.2*scale;
  const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,headY=top-headR*.72,livery=soldierLivery(id);

  ctx.save();

  // Realm livery: every soldier carries both current reign colours.
  soldierBodyPath(base,bodyW,bodyH,top,bodyY);ctx.save();ctx.clip();
  ctx.fillStyle=livery.main;ctx.fillRect(base.x-bodyW,top,bodyW*2,bodyH*.52);
  ctx.fillStyle=livery.alt;ctx.fillRect(base.x-bodyW,top+bodyH*.52,bodyW*2,bodyH);
  ctx.restore();
  soldierBodyPath(base,bodyW,bodyH,top,bodyY);
  ctx.strokeStyle='rgba(25,24,22,.88)';ctx.lineWidth=Math.max(.7,.8*scale);ctx.stroke();

  // Head + steel cap.
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#70777c';ctx.beginPath();ctx.arc(base.x,headY,headR,Math.PI,Math.PI*2);ctx.lineTo(base.x-headR,headY);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(30,30,30,.75)';ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.stroke();

  if(type==='spearman'){
    const x=base.x+bodyW*.55;
    ctx.strokeStyle='#7a5937';ctx.lineWidth=Math.max(1,1.05*scale);
    ctx.beginPath();ctx.moveTo(x,bodyY+bodyH*.43);ctx.lineTo(x-1.0*scale,headY-13*scale);ctx.stroke();
    ctx.fillStyle='#b8bcc0';ctx.beginPath();
    ctx.moveTo(x-1.0*scale,headY-16*scale);ctx.lineTo(x-3.0*scale,headY-11.5*scale);ctx.lineTo(x+1.0*scale,headY-12.2*scale);ctx.closePath();ctx.fill();
  }else if(type==='archer'){
    const bx=base.x+bodyW*.62,by=bodyY-bodyH*.04,r=5.3*scale;
    ctx.strokeStyle='#9b7243';ctx.lineWidth=Math.max(.8,.85*scale);
    ctx.beginPath();ctx.arc(bx,by,r,-Math.PI*.55,Math.PI*.55);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx+Math.cos(-Math.PI*.55)*r,by+Math.sin(-Math.PI*.55)*r);
    ctx.lineTo(bx-r*.18,by);
    ctx.lineTo(bx+Math.cos(Math.PI*.55)*r,by+Math.sin(Math.PI*.55)*r);ctx.stroke();
  }else{
    const swing=Math.sin(phase*Math.PI*2)*3.2*scale;
    drawQuarteredShield(base.x-bodyW*.62,bodyY+bodyH*.10,2.7*scale,3.6*scale,livery,'#b7aa8f',scale);
    // Sword.
    ctx.strokeStyle='#c4c7c8';ctx.lineWidth=Math.max(1,1.15*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.42,bodyY+bodyH*.16);ctx.lineTo(base.x+bodyW*.80+swing,top-7.5*scale);ctx.stroke();
    ctx.strokeStyle='#76563b';ctx.lineWidth=Math.max(1,1.2*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.23,bodyY+bodyH*.05);ctx.lineTo(base.x+bodyW*.52,bodyY+bodyH*.27);ctx.stroke();
  }

  ctx.restore();
}
function wallPatrolPoint(wall,day){
  const L=Math.max(.001,dist(wall.a,wall.b)),seed=(peasantHash(wall.id+'-patrol')%1000)/1000;
  let t=(day*.72+seed)%2;t=t<=1?t:2-t;
  const margin=Math.min(.65,L*.18),u=margin/L+t*Math.max(0,1-2*margin/L);
  return{x:wall.a.x+(wall.b.x-wall.a.x)*u,y:wall.a.y+(wall.b.y-wall.a.y)*u};
}
function drawCastleSoldiers(){
  const day=peasantVisualDay();

  // Spearmen walk the wall-walk.
  for(const wall of State.structures){
    if(wall.type!=='wall'||underConstruction(wall))continue;
    const p=wallPatrolPoint(wall,day),z=structureHeight(wall)+.10;
    if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'spearman',wall.id,day);
  }

  // One archer lookout on every completed crenellated tower.
  for(const tower of State.structures){
    if(tower.type!=='tower'||underConstruction(tower)||towerRoofStyle(tower)!=='battlement')continue;
    const hash=peasantHash(tower.id+'-archer'),a=(hash%360)*Math.PI/180;
    const radius=tower.shape==='round'?tower.r*.26:(tower.size||1)*.18;
    const p={x:tower.x+Math.cos(a)*radius,y:tower.y+Math.sin(a)*radius},z=structureHeight(tower)+.08;
    if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'archer',tower.id,day);
  }
}
function drawTrainingSoldiers(){
  const day=peasantVisualDay(),dots=[];
  for(const yard of State.structures){
    if(yard.type!=='training'||underConstruction(yard))continue;
    const seed=(peasantHash(yard.id+'-training')%1000)/1000;
    const pulse=day*.80+seed;
    const spots=[
      {x:-1.15,y:-.62,pair:0},{x:1.15,y:-.62,pair:0},
      {x:-1.15,y:.72,pair:1},{x:1.15,y:.72,pair:1}
    ];
    for(let i=0;i<spots.length;i++){
      const s=spots[i],side=i%2===0?1:-1;
      const advance=Math.sin((pulse+s.pair*.37)*Math.PI*2)*.20*side;
      const local={x:s.x+advance,y:s.y};
      const p=houseLocalToWorld(yard,local.x,local.y);
      if(!worldPointVisible(p,.13,48))continue;
      dots.push({p,z:.13,id:yard.id+':knight:'+i,phase:pulse+i*.17});
    }
  }
  dots.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
  for(const d of dots)drawSoldierFigure(d.p,d.z,'knight',d.id,d.phase);
}
function gateFacadeEdges(s){
  const fp=footprintPoints(s);if(fp.length<4)return[];
  const defs=[
    {a:fp[0],b:fp[1],role:'side'},
    {a:fp[1],b:fp[2],role:'front'},
    {a:fp[2],b:fp[3],role:'side'},
    {a:fp[3],b:fp[0],role:'rear'}
  ];
  for(const e of defs){
    const a=w2s(e.a,0),b=w2s(e.b,0);
    e.depth=(a.y+b.y)/2;
  }
  defs.sort((a,b)=>b.depth-a.depth);
  return defs.slice(0,2);
}
function drawGatePortalOnEdge(edge){
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const cx=(edge.a.x+edge.b.x)/2,cy=(edge.a.y+edge.b.y)/2,half=.39;
  const l={x:cx-ux*half,y:cy-uy*half},r={x:cx+ux*half,y:cy+uy*half};
  const lb=w2s(l,.03),rb=w2s(r,.03),ls=w2s(l,1.05),rs=w2s(r,1.05),apex=w2s({x:cx,y:cy},1.38);
  const poly=[lb,rb,rs,apex,ls];
  ctx.save();
  pathPolygon(poly,'#241a16','#9a7458',1);
  const bottom=w2s({x:cx,y:cy},.03);
  ctx.strokeStyle='rgba(145,104,76,.72)';ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(bottom.x,bottom.y);ctx.lineTo(apex.x,apex.y);ctx.stroke();
  ctx.restore();
}
function drawGatePortals(){
  for(const s of State.structures){
    if(s.type!=='gate'||underConstruction(s))continue;
    withStructureDetailOcclusion(s,1.38,()=>{
      for(const edge of gateFacadeEdges(s)){
        if(edge.role==='front'||edge.role==='rear')drawGatePortalOnEdge(edge);
      }
    });
  }
}
function gateWindowRows(s){
  const level=structureLevel(s),rows=[1.95];
  if(level>=2)rows.push(3.15);
  if(level>=3)rows.push(4.35);
  return rows.filter(z=>z<structureHeight(s)-.35);
}
function drawGateWindows(s,lit=false,nf=1){
  for(const z of gateWindowRows(s)){
    withStructureDetailOcclusion(s,z,()=>{
      for(const edge of gateFacadeEdges(s)){
        const a=w2s(edge.a,z),b=w2s(edge.b,z),L=Math.hypot(b.x-a.x,b.y-a.y);
        const gap=Math.min(clamp(8*State.view.scale,5,11),L*.28);
        drawWindowOnEdge(edge,z,lit,nf,-gap/2);
        drawWindowOnEdge(edge,z,lit,nf,gap/2);
      }
    });
  }
}
function visibleFacadeEdges(s){
  const rings=s.type==='house'?houseFootprintParts(s).filter(p=>p.kind!=='turret').map(p=>p.points):[footprintPoints(s)];
  const edges=[];
  for(const fp of rings){
    if(fp.length<4)continue;
    for(let i=0;i<fp.length;i++){
      const j=(i+1)%fp.length,a=w2s(fp[i],0),b=w2s(fp[j],0);
      edges.push({a:fp[i],b:fp[j],depth:(a.y+b.y)/2});
    }
  }
  edges.sort((a,b)=>b.depth-a.depth);
  return edges.slice(0,s.type==='house'&&houseLevel(s)>=3?4:2);
}
function closestFootprintEdge(s,p){
  const fp=footprintPoints(s);if(fp.length<2)return null;
  let best=null,bestD=Infinity;
  for(let i=0;i<fp.length;i++){
    const a=fp[i],b=fp[(i+1)%fp.length],q=closestPointOnSegment(p,a,b),d=dist(p,q);
    if(d<bestD){bestD=d;best={a,b,point:q,index:i}}
  }
  return best;
}
function towerDoorContactSpec(tower,contact,wall=null,kind='wall'){
  const rx=contact.x-tower.x,ry=contact.y-tower.y,RL=Math.hypot(rx,ry)||1;
  const outward={x:rx/RL,y:ry/RL};
  let tangent,anchor={x:contact.x+outward.x*.006,y:contact.y+outward.y*.006};

  if(tower.shape==='round'){
    tangent={x:-outward.y,y:outward.x};
  }else{
    const edge=closestFootprintEdge(tower,contact);if(!edge)return null;
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1;
    tangent={x:dx/L,y:dy/L};
    anchor={x:edge.point.x+outward.x*.006,y:edge.point.y+outward.y*.006};
  }

  let baseZ=.035,apexZ=.98;
  if(wall){
    // Wall-linked doors sit at the wall walk level. This keeps the opening
    // readable and architecturally useful instead of burying it behind masonry.
    const towerH=structureHeight(tower),wallH=structureHeight(wall);
    baseZ=clamp(wallH-.02,.08,Math.max(.08,towerH-.98));
    apexZ=Math.min(towerH-.16,baseZ+.92);
    if(apexZ-baseZ<.48)return null;
  }

  return{kind,contact:anchor,tangent,outward,baseZ,apexZ,wallId:wall?.id||null};
}
function towerDoorSpecs(tower){
  if(!tower||tower.type!=='tower'||underConstruction(tower))return[];
  const specs=[];

  // Primary ground-floor entrance exists only on independent towers.
  // Attached subtowers deliberately have NO ground-floor door.
  if(!tower.parentTowerId){
    const a=tower.angle||0;
    let frontContact;
    if(tower.shape==='round'){
      frontContact={x:tower.x+Math.cos(a)*tower.r,y:tower.y+Math.sin(a)*tower.r};
    }else{
      const fp=footprintPoints(tower);
      frontContact=fp.length>=4
        ?{x:(fp[1].x+fp[2].x)/2,y:(fp[1].y+fp[2].y)/2}
        :boundaryPoint(tower,{x:tower.x+Math.cos(a),y:tower.y+Math.sin(a)});
    }
    const front=towerDoorContactSpec(tower,frontContact,null,'front');
    if(front)specs.push(front);
  }

  // Additional doors at every true wall socket connected to this tower.
  for(const wall of State.structures){
    if(wall.type!=='wall'||underConstruction(wall))continue;
    let contact=null;
    if(wall.aSnap===tower.id)contact=wall.a;
    else if(wall.bSnap===tower.id)contact=wall.b;
    if(!contact)continue;
    const spec=towerDoorContactSpec(tower,contact,wall,'wall');
    if(!spec)continue;

    // Avoid drawing the wall-walk door on top of an almost identical front
    // entrance direction when the two happen to coincide.
    const duplicate=specs.some(x=>{
      const da=Math.atan2(x.outward.y,x.outward.x),db=Math.atan2(spec.outward.y,spec.outward.x);
      return Math.abs(Math.atan2(Math.sin(da-db),Math.cos(da-db)))<.12&&Math.abs(x.baseZ-spec.baseZ)<.18;
    });
    if(!duplicate)specs.push(spec);
  }
  return specs;
}
function towerDoorVisible(tower,spec){
  // Near half of the tower only; the body naturally hides rear doors until
  // the camera is rotated.
  return viewDepthPoint(spec.contact)>=viewDepthPoint({x:tower.x,y:tower.y})-.015;
}
function towerDoorOccluders(tower,spec,apexZ){
  const ownerDepth=worldDepth(tower);
  return State.structures.filter(o=>{
    if(o.id===tower.id||underConstruction(o)||!isCastlePart(o))return false;
    if(structureVisualTopHeight(o)<=spec.baseZ+.025)return false;

    // Connected/overlapping structures always mask the doorway where their
    // actual volume crosses the tower facade.
    if(structuresOverlapInPlan(tower,o))return true;

    // Otherwise ordinary camera depth determines foreground masking.
    return worldDepth(o)>ownerDepth+1e-4;
  });
}
function drawTowerDoorSpec(tower,spec){
  if(!towerDoorVisible(tower,spec))return;

  // Architectural scale reduction: both width and height are one third of
  // the previous tower-door size. These are now single-leaf doors.
  const tier=towerTier(tower),width=clamp(.38+tier*.045,.42,.54)/3,half=width/2;
  const tx=spec.tangent.x,ty=spec.tangent.y,c=spec.contact;
  const fullHeight=Math.max(.18,spec.apexZ-spec.baseZ),apexZ=spec.baseZ+fullHeight/3;
  const springZ=spec.baseZ+(apexZ-spec.baseZ)*.66;
  const l={x:c.x-tx*half,y:c.y-ty*half},r={x:c.x+tx*half,y:c.y+ty*half};
  const lb=w2s(l,spec.baseZ),rb=w2s(r,spec.baseZ),ls=w2s(l,springZ),rs=w2s(r,springZ),apex=w2s(c,apexZ);

  const drawDoor=()=>{
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lb.x,lb.y);ctx.lineTo(rb.x,rb.y);ctx.lineTo(rs.x,rs.y);
    ctx.quadraticCurveTo((rs.x+apex.x)/2,apex.y,apex.x,apex.y);
    ctx.quadraticCurveTo((ls.x+apex.x)/2,apex.y,ls.x,ls.y);
    ctx.lineTo(lb.x,lb.y);ctx.closePath();
    ctx.fillStyle='#211713';ctx.fill();
    ctx.strokeStyle='#9a7458';ctx.lineWidth=.8;ctx.stroke();
    ctx.restore();
  };

  // Door hierarchy is lower than every other castle element. In particular,
  // the linked wall is an occluder too: its silhouette hides the lower part
  // of a wall-walk doorway instead of letting the door paint over masonry.
  const occluders=towerDoorOccluders(tower,spec,apexZ);
  if(!occluders.length){drawDoor();return}

  const rr=wrap.getBoundingClientRect();
  ctx.save();ctx.beginPath();ctx.rect(-48,-48,rr.width+96,rr.height+96);
  for(const o of occluders){
    const hull=structureScreenSilhouette(o);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');drawDoor();ctx.restore();
}
function drawTowerDoors(){
  for(const tower of State.structures){
    if(tower.type!=='tower'||underConstruction(tower))continue;
    for(const spec of towerDoorSpecs(tower))drawTowerDoorSpec(tower,spec);
  }
}
function drawWindowOnEdge(edge,z=.48,lit=false,nf=1,offsetPx=0){
  const mx=(edge.a.x+edge.b.x)/2,my=(edge.a.y+edge.b.y)/2;
  const base=w2s({x:mx,y:my},z),a=w2s(edge.a,z),b=w2s(edge.b,z);
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const ww=clamp(4.2*State.view.scale,2.2,5.2),wh=clamp(6.5*State.view.scale,3.2,7.4);
  const cx=base.x+ux*offsetPx,cy=base.y+uy*offsetPx;
  const corners=[
    {x:cx-ux*ww/2,y:cy-uy*ww/2-wh/2},
    {x:cx+ux*ww/2,y:cy+uy*ww/2-wh/2},
    {x:cx+ux*ww/2,y:cy+uy*ww/2+wh/2},
    {x:cx-ux*ww/2,y:cy-uy*ww/2+wh/2}
  ];
  ctx.save();
  if(lit){
    ctx.shadowColor='rgba(255,190,80,'+(.72*nf)+')';ctx.shadowBlur=clamp(9*State.view.scale,4,12);
    pathPolygon(corners,'rgba(255,213,118,'+(.92*nf)+')','rgba(90,58,24,.72)',.8);
  }else pathPolygon(corners,'rgba(35,29,24,.82)','rgba(170,139,96,.38)',.7);
  ctx.restore();
}
function towerLevelHeight(s,level){
  const t=towerTier(s);
  return [2.35,3.55,4.75][clamp(level,1,3)-1]+(t-1)*.12;
}
function towerWindowRows(s){
  const level=structureLevel(s),rows=[],drop=.42;
  if(level>=2){
    const z=(towerLevelHeight(s,1)+towerLevelHeight(s,2))/2-drop;
    rows.push({z,count:1});
  }
  if(level>=3){
    const z=(towerLevelHeight(s,2)+towerLevelHeight(s,3))/2-drop;
    rows.push({z,count:2});
  }
  return rows;
}
function drawRoundTowerWindowRow(s,row,lit=false,nf=1){
  const p=w2s({x:s.x,y:s.y},row.z);
  const ww=clamp(3.3*State.view.scale,2,4.2),wh=clamp(7*State.view.scale,3.8,8.5);
  const gap=clamp(8*State.view.scale,5,11);
  const xs=row.count===1?[p.x]:[p.x-gap/2,p.x+gap/2];
  ctx.save();
  for(const x of xs){
    if(lit){ctx.shadowColor='rgba(255,190,80,'+(.72*nf)+')';ctx.shadowBlur=clamp(9*State.view.scale,4,12);ctx.fillStyle='rgba(255,213,118,'+(.92*nf)+')'}
    else ctx.fillStyle='rgba(35,29,24,.82)';
    ctx.fillRect(x-ww/2,p.y-wh/2,ww,wh);
    ctx.strokeStyle=lit?'rgba(90,58,24,.72)':'rgba(170,139,96,.38)';ctx.lineWidth=.8;ctx.strokeRect(x-ww/2,p.y-wh/2,ww,wh);
  }
  ctx.restore();
}
function linearFrontSide(s){
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
  const mid={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2},off=(Number(s.width)||1)/2;
  const plus={x:mid.x+nx*off,y:mid.y+ny*off},minus={x:mid.x-nx*off,y:mid.y-ny*off};
  const delta=viewDepthPoint(plus)-viewDepthPoint(minus);
  // At an almost edge-on angle neither long facade should receive windows.
  if(Math.abs(delta)<1e-4)return 0;
  return delta>0?1:-1;
}
function builtWindowSegment(s){
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const startPad=s.aSnap?Math.min(.20,L*.12):.04;
  const endPad=s.bSnap?Math.min(.20,L*.12):.04;
  const usable=Math.max(.05,L-startPad-endPad);
  return{
    a:{x:s.a.x+ux*startPad,y:s.a.y+uy*startPad},
    b:{x:s.b.x-ux*endPad,y:s.b.y-uy*endPad},
    length:usable
  };
}
function linearFacadeEdge(s,side){
  const seg=builtWindowSegment(s),dx=seg.b.x-seg.a.x,dy=seg.b.y-seg.a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
  // Tiny outward epsilon prevents z-fighting with the castle-union face.
  const off=(Number(s.width)||1)/2+.004;
  return{
    a:{x:seg.a.x+nx*off*side,y:seg.a.y+ny*off*side},
    b:{x:seg.b.x+nx*off*side,y:seg.b.y+ny*off*side},
    length:seg.length
  };
}
function drawBuiltArcade(s){
  if(!s||s.type!=='built'||builtSkin(s)!=='arcade'||underConstruction(s))return;
  const inside=-wallExteriorSide(s);
  // The portico exists only on the courtyard side; if that facade is behind
  // the building body, let the body hide it instead of painting through.
  if(inside!==linearFrontSide(s))return;

  const edge=linearFacadeEdge(s,inside);
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const count=Math.max(1,Math.round(edge.length/1.05));
  const cell=L/count;
  const openingW=Math.min(.74,cell*.70);
  const baseZ=.04,apexZ=Math.min(1.27,structureHeight(s)-.24),springZ=Math.max(.62,apexZ-.46);

  withStructureDetailOcclusion(s,apexZ,()=>{
    for(let i=0;i<count;i++){
      const along=(i+.5)*cell,half=openingW/2;
      const l={x:edge.a.x+ux*(along-half),y:edge.a.y+uy*(along-half)};
      const r={x:edge.a.x+ux*(along+half),y:edge.a.y+uy*(along+half)};
      const m={x:edge.a.x+ux*along,y:edge.a.y+uy*along};
      const lb=w2s(l,baseZ),rb=w2s(r,baseZ),ls=w2s(l,springZ),rs=w2s(r,springZ),apex=w2s(m,apexZ);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lb.x,lb.y);
      ctx.lineTo(rb.x,rb.y);
      ctx.lineTo(rs.x,rs.y);
      ctx.quadraticCurveTo((rs.x+apex.x)/2,apex.y,apex.x,apex.y);
      ctx.quadraticCurveTo((ls.x+apex.x)/2,apex.y,ls.x,ls.y);
      ctx.lineTo(lb.x,lb.y);
      ctx.closePath();
      ctx.fillStyle='#241f1b';
      ctx.fill();
      ctx.strokeStyle='#86796d';
      ctx.lineWidth=1;
      ctx.stroke();
      ctx.restore();
    }

    // A continuous impost line makes the arcade read as one architectural system.
    const a=w2s(edge.a,springZ),b=w2s(edge.b,springZ);
    ctx.save();ctx.strokeStyle='rgba(178,162,146,.45)';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  });
}
function drawWallHoarding(s){
  if(!s||s.type!=='wall'||wallSkin(s)!=='hoarding'||underConstruction(s))return;
  const g=wallExteriorLayout(s),h=g.z;
  const innerOff=Math.max(.02,g.width/2-.02),outerOff=g.width/2+.42;
  const point=(p,off)=>({x:p.x+g.nx*off*g.side,y:p.y+g.ny*off*g.side});

  // Same longitudinal limits as the battlement crest: the gallery reaches the
  // wall sockets exactly, never extends through a tower and never pulls back.
  const seg={a:s.a,b:s.b,length:g.L};
  const innerA=point(seg.a,innerOff),innerB=point(seg.b,innerOff);
  const outerA=point(seg.a,outerOff),outerB=point(seg.b,outerOff);
  const platform=[innerA,innerB,outerB,outerA];
  const roofInnerA=point(seg.a,Math.max(0,g.width/2-.08)),roofInnerB=point(seg.b,Math.max(0,g.width/2-.08));
  const roofOuterA=point(seg.a,outerOff+.07),roofOuterB=point(seg.b,outerOff+.07);
  const exteriorVisible=linearFrontSide(s)===g.side;

  // Reuse the battlement occlusion path itself. This is intentionally a
  // pseudo-merlon covering the whole gallery footprint so towers/gates mask
  // hoarding with the exact same owner/depth/overlap rules as wall merlons.
  const maskPiece={
    pts:[roofInnerA,roofInnerB,roofOuterB,roofOuterA],
    z0:Math.max(.02,h-.58),z1:h+.66,
    depth:worldDepth(s),ownerId:s.id,ownerType:'wall',
    ownerDepth:worldDepth(s),ownerTop:h
  };

  withTowerBattlementOcclusion(maskPiece,()=>{
    extrudePolygonAt(platform,h-.045,h+.055,{
      top:'#74533a',sideA:'#493423',sideB:'#5d432e',stroke:'#927155'
    });

    const roof=[w2s(roofInnerA,h+.66),w2s(roofInnerB,h+.66),w2s(roofOuterB,h+.47),w2s(roofOuterA,h+.47)];
    pathPolygon(roof,'#4b382a','#806047',1);

    if(exteriorVisible){
      const low=h-.03,high=h+.43;
      pathPolygon(
        [w2s(outerA,low),w2s(outerB,low),w2s(outerB,high),w2s(outerA,high)],
        '#654832','#8d694d',1
      );

      // Use the same snapped-end padding as the battlements for posts/braces:
      // continuous roof/face reaches the socket, repeated timber details do not
      // collide visually with the receiving tower/gate.
      const bays=Math.max(2,Math.round(g.usable/.75));
      const start=g.startPad,end=g.L-g.endPad,span=Math.max(.01,end-start);
      ctx.save();
      ctx.strokeStyle='#3f2c20';
      ctx.lineWidth=Math.max(1,1.25*State.view.scale);
      for(let i=0;i<=bays;i++){
        const along=start+span*(i/bays);
        const base={x:s.a.x+g.ux*along,y:s.a.y+g.uy*along};
        const outer=point(base,outerOff);
        const a=w2s(outer,low),b=w2s(outer,high);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }

      for(let i=0;i<=bays;i+=2){
        const along=start+span*(i/bays);
        const base={x:s.a.x+g.ux*along,y:s.a.y+g.uy*along};
        const outer=point(base,outerOff),wall=point(base,innerOff);
        const a=w2s(outer,h-.02),b=w2s(wall,Math.max(.12,h-.58));
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
      ctx.restore();
    }
  });
}
function drawBuiltWindowRow(s,side,z,density,lit=false,nf=1){
  if(side!==linearFrontSide(s))return;
  const edge=linearFacadeEdge(s,side);
  const pa=w2s(edge.a,z),pb=w2s(edge.b,z),screenLength=Math.hypot(pb.x-pa.x,pb.y-pa.y);
  const count=Math.max(1,Math.round(edge.length*density));
  for(let i=0;i<count;i++){
    const t=(i+.5)/count;
    drawWindowOnEdge(edge,z,lit,nf,(t-.5)*screenLength);
  }
}
function drawBuiltWindows(s,lit=false,nf=1){
  const level=structureLevel(s),outside=wallExteriorSide(s),inside=-outside;
  const lowerZ=.84,upperZ=(1.75+2.80)/2;
  const arcade=builtSkin(s)==='arcade';

  withBuiltRoofOcclusionClip(s,()=>{
    // Interior/courtyard side: the arcade replaces ground-floor windows only.
    if(!arcade)drawBuiltWindowRow(s,inside,lowerZ,2,lit,nf);
    if(level>=2)drawBuiltWindowRow(s,inside,upperZ,2,lit,nf);

    // Exterior side stays completely unchanged by the arcade skin.
    if(level>=2)drawBuiltWindowRow(s,outside,upperZ,1,lit,nf);
  });
}
function drawFacadeWindows(lit=false,nf=1){
  for(const s of State.structures){
    if(underConstruction(s))continue;
    if(s.type==='house'){
      const rows=houseLevel(s)>=2?[.52,1.34]:[.48];
      for(const edge of visibleFacadeEdges(s))for(const z of rows)drawWindowOnEdge(edge,z,lit,nf,0);
    }else if(s.type==='built'){
      drawBuiltWindows(s,lit,nf);
    }else if(s.type==='gate'){
      drawGateWindows(s,lit,nf);
    }else if(s.type==='tower'){
      const rows=towerWindowRows(s);if(!rows.length)continue;
      if(s.shape==='round'){
        for(const row of rows)withStructureDetailOcclusion(s,row.z,()=>drawRoundTowerWindowRow(s,row,lit,nf));
      }else{
        const edges=visibleFacadeEdges(s);
        for(const row of rows){
          withStructureDetailOcclusion(s,row.z,()=>{
            for(const edge of edges){
              if(row.count===1)drawWindowOnEdge(edge,row.z,lit,nf,0);
              else{
                const a=w2s(edge.a,row.z),b=w2s(edge.b,row.z),L=Math.hypot(b.x-a.x,b.y-a.y);
                const spacing=Math.min(clamp(9*State.view.scale,5,12),L*.34);
                drawWindowOnEdge(edge,row.z,lit,nf,-spacing/2);
                drawWindowOnEdge(edge,row.z,lit,nf,spacing/2);
              }
            }
          });
        }
      }
    }
  }
}
function drawDayNightOverlay(){
  const nf=nightFactor();if(nf<=0)return;
  const r=wrap.getBoundingClientRect();
  ctx.save();ctx.fillStyle='rgba(6,10,18,'+(NIGHT_OVERLAY_MAX*nf).toFixed(3)+')';ctx.fillRect(0,0,r.width,r.height);ctx.restore();
}
function drawNightLights(){
  const nf=nightFactor();if(nf<=.01)return;
  drawFacadeWindows(true,nf);
  drawFireGlows(nf);
}
function drawConstructionProgress(s){
  const p=w2s(structureCenter(s),structureHeight(s)+.65),pr=constructionProgress(s),w=34,h=5;ctx.save();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(p.x-w/2,p.y-18,w,h);ctx.fillStyle='#e08a3c';ctx.fillRect(p.x-w/2,p.y-18,w*pr,h);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.strokeRect(p.x-w/2,p.y-18,w,h);ctx.restore();
}
function drawStructure(s,preview=false){
  ctx.save();if(preview)ctx.globalAlpha=.58;else if(underConstruction(s))ctx.globalAlpha=.42;
  if(isCivic(s))drawCivicStructure(s,preview);
  else if(['tower','gate','well'].includes(s.type))drawPointStructure(s,preview);
  else{drawLinearBase(s,preview);if(!underConstruction(s))drawBuiltDetails(s,preview)}
  ctx.restore();if(!preview&&underConstruction(s))drawConstructionProgress(s);
}
function drawBaseStaticScene(){
  const entry=prepareSceneCache('base');
  withRenderContext(entry.ctx,()=>{
    drawTerrain();drawGrid();drawEnvironment();drawBuildArea();

    // Completed terrain-level auto geometry is immutable between topology changes.
    State.structures
      .filter(s=>s.auto&&['field','road'].includes(s.type)&&!underConstruction(s))
      .forEach(drawAutoStructure);

    // Shadows are expensive; update them with the static layer at maintenance
    // ticks rather than recomputing every visual frame.
    drawDynamicShadows();

    const completedOthers=State.structures
      .filter(s=>!(s.auto&&['field','road'].includes(s.type))&&!isCastlePart(s)&&!underConstruction(s))
      .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of completedOthers){if(s.auto)drawAutoStructure(s);else drawStructure(s)}
  });
  entry.dirty=false;
}
function drawCastleBodyStaticScene(){
  const entry=prepareSceneCache('castleBody');
  withRenderContext(entry.ctx,()=>{
    const unionOk=drawCastleUnion();
    if(!unionOk){
      const fallback=State.structures.filter(s=>isCastlePart(s)&&!underConstruction(s)).slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
      for(const s of fallback)drawStructure(s);
      drawTowerDoors();
    }else{
      drawTowerDoors();
      drawCastleUnionDetails();
    }
    drawTowerRoofs();
    drawGateRoofs();
  });
  entry.dirty=false;
}
function drawCastleFrontStaticScene(){
  const entry=prepareSceneCache('castleFront');
  withRenderContext(entry.ctx,()=>drawCastleBattlements());
  entry.dirty=false;
}
function ensureStaticSceneCaches(){
  if(sceneCache.base.dirty)drawBaseStaticScene();
  if(sceneCache.castleBody.dirty)drawCastleBodyStaticScene();
  if(sceneCache.castleFront.dirty)drawCastleFrontStaticScene();
}
function draw(){
  const r=wrap.getBoundingClientRect();
  ctx=screenCtx;
  screenCtx.clearRect(0,0,r.width,r.height);
  ensureStaticSceneCaches();
  blitSceneCache('base');

  // Only construction sites remain fully dynamic at ground/building depth.
  State.structures
    .filter(s=>s.auto&&['field','road'].includes(s.type)&&underConstruction(s))
    .forEach(drawAutoStructure);
  const dynamicSites=State.structures
    .filter(s=>!(s.auto&&['field','road'].includes(s.type))&&underConstruction(s))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of dynamicSites){if(s.auto)drawAutoStructure(s);else drawStructure(s)}

  // Population remains between settlement massing and completed castle massing,
  // preserving the existing occlusion behaviour.
  drawPeasants();
  drawTrainingSoldiers();
  blitSceneCache('castleBody');

  drawTowerFlags();
  drawCastleSelection();
  drawCastleSoldiers();
  blitSceneCache('castleFront');
  drawCastleFireFixtures();

  // Small facade/details stay dynamic for night lighting and selection semantics.
  drawFacadeWindows(false,1);
  drawGatePortals();
  for(const house of completedSettlement('house'))drawHouseDoor(house);
  drawChimneysAndSmoke();

  if(State.draft?.preview)drawStructure(State.draft.preview,true);
  if(State.draft?.mode==='orient'&&State.draft.center&&Number.isFinite(State.draft.angle)){
    const end={x:State.draft.center.x+Math.cos(State.draft.angle)*4,y:State.draft.center.y+Math.sin(State.draft.angle)*4};
    const a=w2s(State.draft.center),b=w2s(end);ctx.save();ctx.strokeStyle='rgba(244,183,111,.72)';ctx.lineWidth=1.2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  }
  drawDayNightOverlay();
  drawNightLights();
}
function inBuild(p){return p.x>=BUILD_MIN&&p.x<=BUILD_MAX&&p.y>=BUILD_MIN&&p.y<=BUILD_MAX}
function pointHit(s,p){if(s.type==='well')return dist(p,s)<=.75;if(s.shape==='round')return dist(p,s)<=s.r;const q=toLocalPoint(s,p),d=rectDims(s);return Math.abs(q.x)<=d.w/2&&Math.abs(q.y)<=d.h/2}
function linearHit(s,p){const ax=s.a.x,ay=s.a.y,bx=s.b.x,by=s.b.y,dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy,t=clamp(((p.x-ax)*dx+(p.y-ay)*dy)/(L2||1),0,1),q={x:ax+t*dx,y:ay+t*dy};return dist(p,q)<=Math.max(.45,s.width*.55)}
function structureAt(p){
  const points=State.structures.filter(s=>!s.auto&&['tower','gate','well','market','tavern','church','training'].includes(s.type));
  for(let i=points.length-1;i>=0;i--)if(pointHit(points[i],p))return points[i];
  const linear=State.structures.filter(s=>!s.auto&&['wall','built'].includes(s.type));
  for(let i=linear.length-1;i>=0;i--)if(linearHit(linear[i],p))return linear[i];
  return null;
}
function structureAtScreen(p){
  const manual=State.structures.filter(s=>!s.auto||s.type==='house').slice().sort((a,b)=>worldDepth(b)-worldDepth(a));
  for(const s of manual)if(screenHitStructure(s,p))return s;
  return null;
}
function setTool(tool){State.tool=tool;State.draft=null;document.querySelectorAll('[data-tool],[data-tower],[data-linear],[data-gate],[data-well],[data-civic]').forEach(b=>b.classList.remove('active'));if(tool.el)tool.el.classList.add('active');status(tool.label||tool.kind);draw()}
function markDirty(){
  State.dirty=true;
  peasantPathSignature='';peasantPathCache.clear();
  fieldWorkAssignmentCache={key:null,map:new Map()};
  invalidateSceneCache();
  document.getElementById('saveState').textContent='unsaved';saveLocal();
}
function selectedStructure(){return State.structures.find(s=>s.id===State.selectedId)||null}
function selectStructure(s){State.selectedId=s?.id||null;invalidateSceneCache('base');renderFunctionPanel();draw()}
function addStructure(s){
  normalizeStructureVariants(s);
  if(['tower','gate','built'].includes(s.type))normalizeFunctions(s);
  let displaced={removed:0,roads:[]};
  if(!s.auto){
    const cost=constructionCost(s);
    if(!canAfford(cost)){status('Insufficient resources — '+costText(cost));return false}
    s.buildCost=cost;spendCost(cost);beginConstruction(s);
    displaced=removeOverlappingAuto(s);
  }
  State.structures.push(s);
  let reactive=0;
  if(!s.auto){
    reactive+=repairDisplacedRoads(displaced.roads,s);
    if(isCivic(s))reactive+=ensureSettlementRoadAccess(s);
    if(displaced.removed||reactive){
      const bits=[];
      if(displaced.removed)bits.push(`${displaced.removed} auto element${displaced.removed===1?'':'s'} cleared`);
      if(reactive)bits.push(`${reactive} road segment${reactive===1?'':'s'} adapted`);
      status(bits.join(' · '));
    }
  }
  peasantPathSignature='';peasantPathCache.clear();
  selectStructure(s);markDirty();draw();return true
}
function deleteStructure(id){
  const target=State.structures.find(s=>s.id===id);if(!target)return;
  if(target.type==='tower')restoreTowerWallConnections(target);
  if(['tower','gate'].includes(target.type))detachSubtowerChildren(target.id);
  if(!target.auto&&target.buildCost)refundCost(target.buildCost);
  if(target.type==='well'){
    State.structures=State.structures.filter(s=>!s.auto&&s.id!==id);
    State.village={name:null,wellId:null,founded:false,growthVersion:3,accessRoadVersion:0,growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null};
  }else State.structures=State.structures.filter(s=>s.id!==id&&s.accessFor!==id&&s.repairFor!==id&&s.gateFor!==id);
  if(State.selectedId===id)State.selectedId=null;renderFunctionPanel();markDirty();draw()
}
function pointerScreen(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function pointerWorld(e){const p=pointerScreen(e);return s2w(p.x,p.y)}
function renderFunctionPanel(){
  const panel=document.getElementById('functionPanel'),info=document.getElementById('functionInfo'),slots=document.getElementById('functionSlots'),s=selectedStructure();
  if(!s||!['tower','gate','built','wall','house','market','tavern','church','training'].includes(s.type)){panel.classList.remove('open');return}
  const simpleCivic=isCivic(s);
  if(s.type!=='house'&&!simpleCivic)normalizeFunctions(s);const cap=(s.type==='house'||simpleCivic)?0:functionCapacity(s);panel.classList.add('open');
  const building=underConstruction(s),pr=Math.round(constructionProgress(s)*100),canHeight=['tower','gate','wall','built'].includes(s.type),maxLevel=['tower','gate'].includes(s.type)?3:2,canTier=['tower','wall'].includes(s.type);
  info.innerHTML=`<div class="kv"><span>Selected</span><b>${structureLabel(s)}</b></div>${s.type==='house'?(()=>{const pop=housePopulationCapacity(s);return `<div class="kv"><span>Household capacity</span><b>${pop.total}</b></div><div class="cost-line">${pop.male} male · ${pop.female} female · ${pop.children} children</div>`})():simpleCivic?`<div class="cost-line">Construction: ${costText(s.buildCost||constructionCost(s))}</div><div class="legend">Prototype civic building · functions/routines pending.</div>`:`<div class="kv"><span>Capacity</span><b>${cap} ${cap===1?'function':'functions'}</b></div><div class="cost-line">Construction: ${costText(s.buildCost||constructionCost(s))}</div>`}${building?`<div class="slot"><div class="site-label">Under construction · ${remainingDays(s).toFixed(1)} days</div><div class="progress"><i style="width:${pr}%"></i></div></div>`:''}${s.type==='built'?`<div class="legend" style="margin-top:7px">Capacity per level: &lt;2U = 0 · 2–&lt;3U = 1 · ≥3U = 2.</div>`:''}`;
  let html='';
  if(s.type==='house'){
    const level=houseLevel(s);
    html+=`<div class="slot"><div class="slot-label">House social level</div><div class="grid"><button data-house-down ${level<=1?'disabled':''}>− Downgrade</button><button data-house-up ${level>=4?'disabled':''}>+ Upgrade</button></div><div class="legend">L1: 4 residents · L2: 8 · L3: 12 · L4: 16. L3: extended ${housePlanType(s)} plan · L4: elite house with ${houseTurretType(s)} turret.</div></div>`;
  }
  if(canTier){
    const current=s.type==='wall'?wallTier(s):towerTier(s);
    const labels=s.type==='wall'?['T1 · .2U','T2 · .5U','T3 · 1U']:(s.shape==='round'?['T1 · R.5','T2 · R.75','T3 · R1']:['T1 · 1U','T2 · 1.5U','T3 · 2U']);
    html+=`<div class="slot"><div class="slot-label">Tier / footprint</div><div class="grid3">${labels.map((label,i)=>`<button data-structure-tier="${i+1}" class="${current===i+1?'active':''}">${label}</button>`).join('')}</div></div>`;
  }
  if(canHeight)html+=`<div class="slot"><div class="slot-label">Height levels</div><div class="${maxLevel===3?'grid3':'grid'}">${Array.from({length:maxLevel},(_,i)=>`<button data-height-level="${i+1}" class="${structureLevel(s)===i+1?'active':''}">${i+1}</button>`).join('')}</div></div>`;
  if(s.type==='tower'){
    const roof=towerRoofStyle(s);
    if(s.parentTowerId){
      const parent=State.structures.find(x=>x.id===s.parentTowerId);
      html+=`<div class="slot"><div class="legend">Subtower attached to ${parent?structureLabel(parent):'parent structure'}.</div></div>`;
    }
    html+=`<div class="slot"><div class="slot-label">Tower roof</div><div class="grid"><button data-tower-roof="battlement" class="${roof==='battlement'?'active':''}">Merlato</button><button data-tower-roof="pitched" class="${roof==='pitched'?'active':''}">Falde</button></div></div>`;
  }
  if(s.type==='gate'){
    const roof=gateRoofStyle(s);
    html+=`<div class="slot"><div class="slot-label">Gate roof</div><div class="grid"><button data-gate-roof="battlement" class="${roof==='battlement'?'active':''}">Merlato</button><button data-gate-roof="pitched" class="${roof==='pitched'?'active':''}">Falde</button></div></div>`;
  }
  if(s.type==='built'){
    const skin=builtSkin(s);
    html+=`<div class="slot"><div class="slot-label">Built wall skin</div><div class="grid"><button data-built-skin="standard" class="${skin==='standard'?'active':''}">Standard</button><button data-built-skin="arcade" class="${skin==='arcade'?'active':''}">Porticato</button></div><div class="legend">Porticato affects only the interior ground floor.</div></div>`;
  }
  if(s.type==='wall'){
    const skin=wallSkin(s);
    html+=`<div class="slot"><div class="slot-label">Wall skin</div><div class="grid"><button data-wall-skin="standard" class="${skin==='standard'?'active':''}">Standard</button><button data-wall-skin="hoarding" class="${skin==='hoarding'?'active':''}">Hoarding</button></div><div class="legend">Hoarding replaces the exterior battlement treatment with a timber fighting gallery.</div></div>`;
  }
  if(['wall','built'].includes(s.type)){
    const flipLabel=s.type==='wall'?'Exterior side':'Exterior side / windows';
    const flipLegend=s.type==='wall'?'Defines the exterior side for battlements or hoarding.':'Exterior windows: upper level only. Interior windows/portico follow the opposite side.';
    html+=`<div class="slot"><div class="slot-label">${flipLabel}</div><button data-linear-flip class="active">⇄ Flip</button><div class="legend">${flipLegend}</div></div>`;
  }
  if(s.type!=='house'&&!simpleCivic){
    if(building)html+='<div class="slot"><div class="legend">Functions can be assigned when construction is complete.</div></div>';
    else if(cap===0)html+='<div class="slot"><div class="legend">No function capacity at the current footprint/height.</div></div>';
    else html+=s.functions.map((value,i)=>`<div class="slot"><div class="slot-label">Function slot ${i+1}</div><select data-function-slot="${i}"><option value="">— Empty —</option>${FUNCTION_CATALOG.map(k=>`<option value="${k}" ${value===k?'selected':''}>${FUNCTION_LABELS[k]}</option>`).join('')}</select></div>`).join('');
  }
  slots.innerHTML=html;
  slots.querySelectorAll('[data-house-up]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='house')return;target.houseLevel=clamp(houseLevel(target)+1,1,4);markDirty();renderFunctionPanel();draw();status('House upgraded to L'+target.houseLevel)});
  slots.querySelectorAll('[data-house-down]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='house')return;target.houseLevel=clamp(houseLevel(target)-1,1,4);markDirty();renderFunctionPanel();draw();status('House downgraded to L'+target.houseLevel)});
  slots.querySelectorAll('[data-structure-tier]').forEach(btn=>btn.onclick=()=>{
    const target=selectedStructure();if(!target)return;
    const requested=Number(btn.dataset.structureTier);

    if(target.type==='tower'){
      const parent=target.parentTowerId&&State.structures.find(s=>s.id===target.parentTowerId&&s.type==='tower');
      if(parent&&requested>=towerTier(parent)){
        status('Subtower must remain smaller than its parent tower');return;
      }
      const children=subtowerChildren(target.id);
      if(children.some(child=>towerTier(child)>=requested)){
        status('Parent tower must remain larger than all attached subtorri');return;
      }
    }

    applyStructureTier(target,requested);
    target.tier=target.type==='wall'?wallTier(target):towerTier(target);
    target.buildCost=constructionCost(target);

    if(target.type==='tower'){
      repositionSubtower(target);
      syncSubtowerTree(target.id);
    }

    markDirty();renderFunctionPanel();draw();
  });
  slots.querySelectorAll('[data-height-level]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target)return;target.level=Number(btn.dataset.heightLevel);normalizeFunctions(target);target.buildCost=constructionCost(target);markDirty();renderFunctionPanel();draw()});
  slots.querySelectorAll('[data-tower-roof]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='tower')return;if(!setStructureVariant(target,'roofStyle',btn.dataset.towerRoof))return;markDirty();renderFunctionPanel();draw();status('Tower roof: '+(target.roofStyle==='pitched'?'pitched':'battlement'))});
  slots.querySelectorAll('[data-gate-roof]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='gate')return;if(!setStructureVariant(target,'roofStyle',btn.dataset.gateRoof))return;markDirty();renderFunctionPanel();draw();status('Gate roof: '+(target.roofStyle==='pitched'?'pitched':'battlement'))});
  slots.querySelectorAll('[data-built-skin]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='built')return;if(!setStructureVariant(target,'skin',btn.dataset.builtSkin))return;markDirty();renderFunctionPanel();draw();status('Built wall skin: '+(target.skin==='arcade'?'porticato':'standard'))});
  slots.querySelectorAll('[data-wall-skin]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||target.type!=='wall')return;if(!setStructureVariant(target,'skin',btn.dataset.wallSkin))return;markDirty();renderFunctionPanel();draw();status('Wall skin: '+target.skin)});
  slots.querySelectorAll('[data-linear-flip]').forEach(btn=>btn.onclick=()=>{const target=selectedStructure();if(!target||!['wall','built'].includes(target.type))return;target.flip=!target.flip;markDirty();renderFunctionPanel();draw();status((target.type==='wall'?'Wall':'Built section')+' exterior flipped')});
  slots.querySelectorAll('[data-function-slot]').forEach(sel=>sel.onchange=e=>{const target=selectedStructure();if(!target)return;normalizeFunctions(target);target.functions[Number(e.target.dataset.functionSlot)]=e.target.value||null;markDirty();draw()});
}
let pan=null;
canvas.addEventListener('pointerdown',e=>{
  if(e.button===1||e.button===2){pan={x:e.clientX,y:e.clientY,vx:State.view.x,vy:State.view.y};canvas.setPointerCapture(e.pointerId);return}
  const sp=pointerScreen(e),p=s2w(sp.x,sp.y);
  if(State.tool.kind==='select'){selectStructure(structureAtScreen(sp)||structureAt(p));return}
  if(State.tool.kind==='delete'){const hit=structureAtScreen(sp)||structureAt(p);if(hit)deleteStructure(hit.id);return}

  // Once the centre is fixed, the second click only defines orientation.
  // It may be anywhere on screen; only the building centre must lie in the build area.
  if(State.draft?.mode==='orient'&&orientedToolSpec()){
    const angle=Number.isFinite(State.draft.lockedAngle)?State.draft.lockedAngle:placementAngle(State.draft.center,p);
    commitOrientedPlacement(State.draft.center,angle);return
  }

  if(!inBuild(p)){status('Build only inside the central 100×100U area');return}
  if(State.tool.kind==='tower'){
    const snap=towerPlacementSnap(p),q=snap.point;
    if(State.tool.shape==='round'){
      State.draft=null;
      addTowerWithPlacement(
        {id:uid(),type:'tower',shape:'round',x:q.x,y:q.y,r:State.tool.size,level:State.tool.level||State.buildLevels.tower,functions:[]},
        snap
      );
      return
    }
    const lockedAngle=(snap.parentTowerId||snap.wallId)?snap.angle:null;
    const angle=Number.isFinite(lockedAngle)?lockedAngle:0;
    State.draft={
      mode:'orient',center:q,angle,lockedAngle,
      wallSnapId:snap.wallId||null,
      wallSnapEnd:snap.wallEnd||null,
      parentTowerId:snap.parentTowerId||null,
      subtowerSocket:snap.subtowerSocket||null,
      subtowerAngle:Number.isFinite(snap.subtowerAngle)?snap.subtowerAngle:null,
      preview:makePlacementPreview(q,angle)
    };
    status(snap.parentTowerId?'Subtower magnetized — click to confirm':snap.wallId?'Tower magnetized to wall endpoint — click to confirm':'Position fixed — move cursor to rotate, click to confirm');
    draw();return
  }
  if(State.tool.kind==='gate'){
    const q={x:snapGrid(p.x),y:snapGrid(p.y)};
    State.draft={mode:'orient',center:q,angle:0,preview:makePlacementPreview(q,0)};
    status('Gate position fixed — move cursor to rotate, click to confirm');draw();return
  }
  if(State.tool.kind==='civic'){
    const q={x:snapGrid(p.x),y:snapGrid(p.y)};
    State.draft={mode:'orient',center:q,angle:0,preview:makePlacementPreview(q,0)};
    status(structureLabel(State.draft.preview)+' position fixed — move cursor to rotate, click to confirm');draw();return
  }
  if(State.tool.kind==='well'){
    if(State.village.founded||State.structures.some(s=>s.type==='well')){status('This settlement already has a village well');return}
    const q={x:snapGrid(p.x),y:snapGrid(p.y)},well={id:uid(),type:'well',x:q.x,y:q.y};
    if(addStructure(well))openVillageModal(well);return
  }
  if(State.tool.kind==='linear'){
    if(!State.draft){const s=snapAnchor(p);State.draft={a:s.point,aSnap:s.structureId,preview:null};status('Point A set — choose point B');draw()}
    else{const e2=snapAnchor(p),spec=currentLinearSpec(),n=normalizeLinear(State.draft.a,e2.point,spec);if(n&&n.length>=spec.min-.001){addStructure({id:uid(),type:State.tool.linear,width:spec.width,a:n.a,b:n.b,aSnap:State.draft.aSnap,bSnap:e2.structureId,length:n.length,level:State.tool.level||State.buildLevels.wall,tier:State.tool.linear==='wall'?(State.tool.tier||State.buildLevels.wallTier):undefined,flip:false,functions:[]});State.draft=null;status(State.tool.label+' ready for next segment')}else status('Segment too short')}
  }
});
canvas.addEventListener('pointermove',e=>{
  if(pan){State.view.x=pan.vx+e.clientX-pan.x;State.view.y=pan.vy+e.clientY-pan.y;draw();return}
  const p=pointerWorld(e);
  if(State.tool.kind==='linear'&&State.draft){
    const snap=snapAnchor(p),spec=currentLinearSpec(),n=normalizeLinear(State.draft.a,snap.point,spec);
    if(n){State.draft.preview={type:State.tool.linear,width:spec.width,a:n.a,b:n.b,length:n.length,level:State.tool.level||State.buildLevels.wall,tier:State.tool.linear==='wall'?(State.tool.tier||State.buildLevels.wallTier):undefined};status(`${State.tool.label}: ${n.length.toFixed(2)}U · L${State.tool.level||State.buildLevels.wall} · ${buildDuration({type:State.tool.linear,length:n.length,level:State.tool.level||State.buildLevels.wall}).toFixed(1)}d · ${costText(constructionCost({type:State.tool.linear,length:n.length,level:State.tool.level||State.buildLevels.wall}))}`);draw()}
    return
  }
  const oriented=orientedToolSpec();
  if(oriented){
    if(State.draft?.mode==='orient'){
      const angle=Number.isFinite(State.draft.lockedAngle)?State.draft.lockedAngle:placementAngle(State.draft.center,p);
      State.draft.angle=angle;State.draft.preview=makePlacementPreview(State.draft.center,angle);
      let deg=Math.round(angle*180/Math.PI);if(deg<0)deg+=360;
      status(State.draft.wallSnapId?`Wall snap · aligned ${deg}° — click to confirm`:`Rotate: ${deg}° — click to confirm`);
      draw();return
    }
    if(State.tool.kind==='tower'){
      const snap=towerPlacementSnap(p),angle=(snap.parentTowerId||snap.wallId)?snap.angle:0;
      State.draft={
        mode:'hover',
        wallSnapId:snap.wallId||null,
        wallSnapEnd:snap.wallEnd||null,
        parentTowerId:snap.parentTowerId||null,
        subtowerSocket:snap.subtowerSocket||null,
        subtowerAngle:Number.isFinite(snap.subtowerAngle)?snap.subtowerAngle:null,
        preview:makePlacementPreview(snap.point,angle)
      };
      if(snap.parentTowerId)status('Subtower socket');
    }else{
      const q={x:snapGrid(p.x),y:snapGrid(p.y)};
      State.draft={mode:'hover',preview:makePlacementPreview(q,0)};
    }
    draw();return
  }
  if(State.tool.kind==='tower'&&State.tool.shape==='round'){
    const snap=towerPlacementSnap(p);
    State.draft={
      mode:'hover',
      wallSnapId:snap.wallId||null,
      parentTowerId:snap.parentTowerId||null,
      subtowerSocket:snap.subtowerSocket||null,
      subtowerAngle:Number.isFinite(snap.subtowerAngle)?snap.subtowerAngle:null,
      preview:makePlacementPreview(snap.point,0)
    };
    if(snap.parentTowerId)status('Subtower socket');
    draw();return
  }
});
canvas.addEventListener('pointerup',()=>pan=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,before=s2w(sx,sy),factor=e.deltaY<0?1.12:.89;State.view.scale=clamp(State.view.scale*factor,.2,6);const after=w2s(before);State.view.x+=sx-after.x;State.view.y+=sy-after.y;invalidateSceneCache();draw()},{passive:false});
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>setTool({kind:b.dataset.tool,label:b.textContent.trim(),el:b});
for(const b of document.querySelectorAll('[data-tower]'))b.onclick=()=>{const level=State.buildLevels.tower,dummy={type:'tower',shape:b.dataset.tower,level,...(b.dataset.tower==='round'?{r:Number(b.dataset.size)}:{size:Number(b.dataset.size)})};setTool({kind:'tower',shape:b.dataset.tower,size:Number(b.dataset.size),level,label:`${b.dataset.tower} tower ${b.dataset.size}U · L${level} · ${buildDuration(dummy).toFixed(0)}d · ${costText(constructionCost(dummy))}`,el:b})};
for(const b of document.querySelectorAll('[data-linear]'))b.onclick=()=>{const level=State.buildLevels.wall,tier=State.buildLevels.wallTier;setTool({kind:'linear',linear:b.dataset.linear,level,tier,label:(b.dataset.linear==='wall'?`Wall T${tier}`:'Built section')+` L${level} — choose point A`,el:b})};
document.querySelectorAll('[data-tower-level]').forEach(b=>b.onclick=()=>{State.buildLevels.tower=Number(b.dataset.towerLevel);document.querySelectorAll('[data-tower-level]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='tower'){State.tool.level=State.buildLevels.tower;State.draft=null;status('Tower height: '+State.buildLevels.tower+' level'+(State.buildLevels.tower>1?'s':''));draw()}});
document.querySelectorAll('[data-wall-tier]').forEach(b=>b.onclick=()=>{State.buildLevels.wallTier=Number(b.dataset.wallTier);document.querySelectorAll('[data-wall-tier]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='linear'&&State.tool.linear==='wall'){State.tool.tier=State.buildLevels.wallTier;State.draft=null;status('Wall tier: T'+State.buildLevels.wallTier+' · '+wallWidthForTier(State.buildLevels.wallTier)+'U');draw()}});
document.querySelectorAll('[data-wall-level]').forEach(b=>b.onclick=()=>{State.buildLevels.wall=Number(b.dataset.wallLevel);document.querySelectorAll('[data-wall-level]').forEach(x=>x.classList.toggle('active',x===b));if(State.tool.kind==='linear'){State.tool.level=State.buildLevels.wall;State.draft=null;status('Wall height: '+State.buildLevels.wall+' level'+(State.buildLevels.wall>1?'s':''));draw()}});
document.querySelectorAll('[data-gate-level]').forEach(b=>b.onclick=()=>{
  State.buildLevels.gate=Number(b.dataset.gateLevel);
  document.querySelectorAll('[data-gate-level]').forEach(x=>x.classList.toggle('active',x===b));
  if(State.tool.kind==='gate'){
    State.tool.level=State.buildLevels.gate;State.draft=null;
    const dummy={type:'gate',level:State.buildLevels.gate};
    status('Gate height: L'+State.buildLevels.gate+' · '+buildDuration(dummy).toFixed(1)+'d');
    draw();
  }
});
document.querySelector('[data-gate]').onclick=e=>{
  const level=State.buildLevels.gate,dummy={type:'gate',level};
  setTool({kind:'gate',level,label:'Gate 1.5×1.5U · L'+level+' · '+buildDuration(dummy).toFixed(1)+'d · '+costText(constructionCost(dummy)),el:e.currentTarget});
};
for(const b of document.querySelectorAll('[data-civic]'))b.onclick=()=>{
  const type=b.dataset.civic,spec={type,shape:'civic'};
  setTool({kind:'civic',placementSpec:spec,label:structureLabel(spec)+' · '+BUILD_DAYS[type]+'d · '+costText(COSTS[type]),el:b});
};
document.querySelector('[data-well]').onclick=e=>setTool({kind:'well',label:'Village well · instant · '+costText(COSTS.well),el:e.currentTarget});
document.getElementById('confirmVillageBtn').onclick=()=>{
  const well=State.structures.find(s=>s.id===State.pendingWellId&&s.type==='well'),name=document.getElementById('villageNameInput').value.trim();
  if(!well)return closeVillageModal();if(!name){status('Enter a village name');document.getElementById('villageNameInput').focus();return}
  State.village={name,wellId:well.id,founded:true,growthVersion:3,growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null};closeVillageModal();markDirty();renderUI();status(`${name} founded — village growth has begun`);processVillageGrowth();draw();
};
document.getElementById('cancelVillageBtn').onclick=()=>{const id=State.pendingWellId;closeVillageModal();if(id)deleteStructure(id)};
document.getElementById('villageNameInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('confirmVillageBtn').click()});
document.getElementById('closeFunctions').onclick=()=>{State.selectedId=null;renderFunctionPanel();draw()};
document.getElementById('undoBtn').onclick=()=>{const s=[...State.structures].reverse().find(x=>!x.auto);if(s)deleteStructure(s.id)};
document.getElementById('clearBtn').onclick=()=>{if(confirm('Clear the settlement and refund player-built structures?')){for(const s of State.structures)if(!s.auto&&s.buildCost)refundCost(s.buildCost);State.structures=[];State.village={name:null,wellId:null,founded:false,growthVersion:3,growthStep:0,nextGrowthDay:null,roadPlan:null,baseRoadAngle:null};State.selectedId=null;renderFunctionPanel();markDirty();renderUI();draw()}};
['tax','rations','levy'].forEach(k=>document.getElementById(k).oninput=e=>{State.policies[k]=Number(e.target.value);markDirty()});
function migrateStructures(list){
  const migrated=(list||[]).map(s=>{
    if(s.type==='house')s.houseLevel=houseLevel(s);
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
    if(s.type==='tower'){
      s.level=clamp(Math.round(Number(s.level)||1),1,3);
      s.tier=towerTier(s);
      applyStructureTier(s,s.tier);
      s.wallColliderSyncSignature=null;
    }
    if(s.type==='gate'){
      s.level=clamp(Math.round(Number(s.level)||1),1,3);
    }
    if(s.type==='well')delete s.construction;
    if(['tower','gate'].includes(s.type)&&!Number.isFinite(s.angle))s.angle=0;

    // V1 visual-variant migration. Legacy structures keep today's appearance.
    normalizeStructureVariants(s);

    if(['tower','gate','built'].includes(s.type))normalizeFunctions(s);
    return s;
  });

  const byId=new Map(migrated.map(s=>[s.id,s]));
  for(const s of migrated){
    if(s.type!=='tower'||!s.parentTowerId)continue;
    const parent=byId.get(s.parentTowerId);
    if(!parent||!['tower','gate'].includes(parent.type)||(parent.type==='tower'&&towerTier(s)>=towerTier(parent))){
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
  return migrated;
}
function saveLocal(){localStorage.setItem('conquer.settlement.0.0',JSON.stringify({seed:State.seed,biome:State.biome,neighborBiomes:State.neighborBiomes,structures:State.structures,resources:State.resources,policies:State.policies,village:State.village,clock:{day:State.clock.day,speed:0},view:State.view}))}
function loadLocal(){try{const x=JSON.parse(localStorage.getItem('conquer.settlement.0.0')||'null');if(x){State.seed=x.seed??State.seed;State.biome=BIOMES[x.biome]?x.biome:State.biome;State.neighborBiomes=x.neighborBiomes||{};State.structures=migrateStructures(x.structures);State.resources={...State.resources,...x.resources};for(const k of Object.keys(State.resources))State.resources[k]=Math.max(10000,Number(State.resources[k])||0);if(x.view&&Number.isFinite(x.view.rotation))State.view.rotation=((x.view.rotation%4)+4)%4;State.policies={...State.policies,...x.policies};const legacyGrowth=x.village?.growthVersion!==3;State.village={...State.village,...x.village};if(legacyGrowth)State.village.growthVersion=1;State.clock.day=Math.max(0,Number(x.clock?.day)||0);State.clock.speed=0;State.clock.lastSpeed=1;State.daylightOverride=null;resetLegacyVillageGrowth();generateEnvironment();rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork();syncCompletedTowerWallColliders(true);reconcileGateMainConnections(true);reconcileSettlementAccessRoads();invalidateSceneCache();['tax','rations','levy'].forEach(k=>document.getElementById(k).value=State.policies[k])}}catch{}}
async function initSupabase(){for(let i=0;i<30&&!window.__createSupabaseClient;i++)await new Promise(r=>setTimeout(r,50));if(!window.__createSupabaseClient)return;State.supabase=window.__createSupabaseClient(SUPABASE_URL,SUPABASE_KEY);const {data}=await State.supabase.auth.getSession();State.user=data?.session?.user||null;if(State.user){document.getElementById('dbNote').textContent='Supabase authenticated — cloud save enabled.';document.getElementById('saveState').textContent='cloud ready';await loadCloud()}else document.getElementById('dbNote').textContent='Local autosave active. Sign-in can be added next; RLS already protects cloud rows.'}
async function loadCloud(){if(!State.user)return;const {data,error}=await State.supabase.from('settlements').select('*').eq('world_cell_x',0).eq('world_cell_y',0).maybeSingle();if(error){console.warn(error);return}if(data){State.seed=data.terrain_seed;State.biome=BIOMES[data.biome]?data.biome:State.biome;State.neighborBiomes=data.neighbor_biomes||{};State.structures=migrateStructures(data.structures);State.resources={...State.resources,...data.resources};for(const k of Object.keys(State.resources))State.resources[k]=Math.max(10000,Number(State.resources[k])||0);if(data.camera&&Number.isFinite(data.camera.rotation))State.view.rotation=((data.camera.rotation%4)+4)%4;const cloudPolicies=data.policies||{};State.policies={...State.policies,tax:cloudPolicies.tax??State.policies.tax,rations:cloudPolicies.rations??State.policies.rations,levy:cloudPolicies.levy??State.policies.levy};const legacyGrowth=cloudPolicies.village?.growthVersion!==3;State.village={...State.village,...(cloudPolicies.village||{})};if(legacyGrowth)State.village.growthVersion=1;State.clock.day=Math.max(0,Number(cloudPolicies.clock?.day)||State.clock.day);resetLegacyVillageGrowth();generateEnvironment();rebuildSecondaryRoadsOnLoad();reconcileReactiveRoadNetwork();syncCompletedTowerWallColliders(true);reconcileGateMainConnections(true);reconcileSettlementAccessRoads();invalidateSceneCache();saveLocal();renderUI();renderFunctionPanel();draw()}}
async function saveCloud(){saveLocal();if(!State.user){document.getElementById('saveState').textContent='saved local';State.dirty=false;return}const payload={user_id:State.user.id,world_cell_x:0,world_cell_y:0,terrain_seed:State.seed,biome:State.biome,neighbor_biomes:State.neighborBiomes,resources:State.resources,policies:{...State.policies,village:State.village,clock:{day:State.clock.day}},structures:State.structures,camera:State.view,updated_at:new Date().toISOString()};const {error}=await State.supabase.from('settlements').upsert(payload,{onConflict:'user_id,world_cell_x,world_cell_y'});if(error){document.getElementById('saveState').textContent='cloud error';console.error(error)}else{State.dirty=false;document.getElementById('saveState').textContent='saved cloud'}}
document.getElementById('saveBtn').onclick=saveCloud;
function renderUI(){document.getElementById('seedLabel').textContent=State.seed;document.getElementById('villageLabel').textContent=State.village.name||'—';document.getElementById('biomeLabel').textContent=BIOMES[State.biome]?.label||State.biome;document.getElementById('biomeSelect').value=State.biome;document.getElementById('dayLabel').textContent='Day '+State.clock.day.toFixed(1);const icons={gold:'🪙',population:'👥',food:'🌾',wood:'🪵',stone:'🪨',metal:'⛓',equipment:'⚔'};document.getElementById('resources').innerHTML=Object.entries(State.resources).map(([k,v])=>`<span class="res">${icons[k]||''} ${k} <b>${v}</b></span>`).join('')}
function visibleCanvasCenter(){
  const r=canvas.getBoundingClientRect();
  return{x:r.width/2,y:r.height/2};
}
function rotateCamera(delta){
  const pivot=visibleCanvasCenter(),anchor=s2w(pivot.x,pivot.y);
  State.view.rotation=((State.view.rotation||0)+delta+4)%4;
  const after=w2s(anchor);
  State.view.x+=pivot.x-after.x;State.view.y+=pivot.y-after.y;
  State.draft=null;invalidateSceneCache();saveLocal();draw();status('View rotation: '+(State.view.rotation*90)+'°');
}
function panCamera(dx,dy){
  State.view.x+=dx;State.view.y+=dy;invalidateSceneCache();saveLocal();draw();
}
function setTimeSpeed(speed){
  speed=Number(speed)||0;
  if(speed>0)State.clock.lastSpeed=speed;
  else if(State.clock.speed>0)State.clock.lastSpeed=State.clock.speed;
  State.clock.speed=speed;
  document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('active',Number(x.dataset.speed)===speed));
  status(speed===0?'Time paused':`Time ×${speed}`);
}
function togglePause(){
  if(State.clock.speed>0)setTimeSpeed(0);
  else setTimeSpeed(State.clock.lastSpeed||1);
}
function setLightOverride(mode){
  State.daylightOverride=State.daylightOverride===mode?null:mode;
  document.querySelectorAll('[data-light-override]').forEach(b=>b.classList.toggle('active',b.dataset.lightOverride===State.daylightOverride));
  status(State.daylightOverride?('Lighting: '+State.daylightOverride):'Lighting: automatic');
  draw();
}
document.getElementById('rotateLeft').onclick=()=>rotateCamera(-1);
document.getElementById('rotateRight').onclick=()=>rotateCamera(1);
document.getElementById('biomeSelect').onchange=e=>{
  State.biome=BIOMES[e.target.value]?e.target.value:'plains';generateEnvironment();
  State.structures=State.structures.filter(s=>!s.auto);
  if(State.village.founded){State.village.growthStep=0;State.village.nextGrowthDay=State.clock.day+.75;State.village.roadPlan=null;State.village.baseRoadAngle=null}
  markDirty();renderUI();status('Biome: '+BIOMES[State.biome].label+' — automatic settlement growth reset');draw();
};
document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>setTimeSpeed(Number(b.dataset.speed)));
document.querySelectorAll('[data-light-override]').forEach(b=>b.onclick=()=>setLightOverride(b.dataset.lightOverride));
let simLast=performance.now(),simPersistAt=performance.now(),simDrawAt=0,simMaintenanceQuarter=null;
const VISUAL_FRAME_MS=1000/30;
function runSettlementMaintenance(force=false){
  const quarter=Math.floor(State.clock.day*4);
  if(!force&&quarter===simMaintenanceQuarter)return 0;
  simMaintenanceQuarter=quarter;
  let changed=0;
  changed+=syncCompletedTowerWallColliders(false);
  changed+=reconcileGateMainConnections(false);
  changed+=reconcileSettlementAccessRoads();
  // Construction completion and sun position may have changed even without
  // topology edits; rebuild static layers once per maintenance tick.
  invalidateSceneCache();
  return changed;
}
function simulationFrame(now){
  const dt=Math.min(.25,(now-simLast)/1000);simLast=now;
  if(State.clock.speed>0){
    const before=State.clock.day;State.clock.day+=dt*BASE_DAYS_PER_SECOND*State.clock.speed;
    processVillageGrowth();
    const quarterChanged=Math.floor(before*4)!==Math.floor(State.clock.day*4);
    if(quarterChanged){
      runSettlementMaintenance(true);
      renderUI();
    }
    if(now-simDrawAt>=VISUAL_FRAME_MS){
      draw();
      simDrawAt=now;
    }
    if(now-simPersistAt>1000){saveLocal();simPersistAt=now}
  }
  requestAnimationFrame(simulationFrame);
}
requestAnimationFrame(simulationFrame);
window.addEventListener('keydown',e=>{
  const tag=e.target?.tagName?.toLowerCase(),typing=tag==='input'||tag==='select'||tag==='textarea'||e.target?.isContentEditable;
  if(typing)return;
  const k=e.key.toLowerCase();
  if(e.code==='Space'){e.preventDefault();togglePause();return}
  if(k==='q'){e.preventDefault();rotateCamera(-1);return}
  if(k==='e'){e.preventDefault();rotateCamera(1);return}
  const panStep=e.shiftKey?72:36;
  if(k==='w'){e.preventDefault();panCamera(0,panStep);return}
  if(k==='s'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();panCamera(0,-panStep);return}
  if(k==='a'){e.preventDefault();panCamera(panStep,0);return}
  if(k==='d'){e.preventDefault();panCamera(-panStep,0);return}
  if(e.key==='Escape'){if(document.getElementById('foundVillageModal').classList.contains('open')){document.getElementById('cancelVillageBtn').click();return}State.draft=null;State.selectedId=null;renderFunctionPanel();setTool({kind:'select',label:'Select'});draw();return}
  if(e.key==='Delete'&&State.selectedId){deleteStructure(State.selectedId);return}
  if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();saveCloud()}
});
window.addEventListener('polygon-clipping-ready',()=>draw());
window.addEventListener('resize',resize);loadLocal();if(!State.environment.length)generateEnvironment();renderUI();resize();fit();initSupabase();
})();
