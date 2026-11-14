'use strict';
// CONQUER settlement population module — classic-script shared runtime.
function peasantHash(id){return biomeHash(String(id||'peasant'))}
let populationFrameCompletedCache=null;
function completedSettlement(type){
  if(populationFrameCompletedCache?.has(type))return populationFrameCompletedCache.get(type);
  const result=State.structures.filter(s=>s.type===type&&!underConstruction(s));
  if(populationFrameCompletedCache)populationFrameCompletedCache.set(type,result);
  return result;
}
function peasantVisualDay(){return State.clock.day*PEASANT_VISUAL_SPEED}
function visualCycleDay(){return peasantVisualDay()}
function visualCycleFrac(){
  // DEV overrides change *visual* time only; simulation/calendar stays intact.
  if(State.daylightOverride==='day')return .5; // 12:00
  if(State.daylightOverride==='night')return 0; // 00:00
  const d=visualCycleDay();return d-Math.floor(d);
}
// Fractional days are IEEE754: 3 + 16/24 can become 15.999999999999996h.
 // Snap only sub-microsecond clock noise so sunsets occur at the exact hour.
function visualHour(){return Math.round(visualCycleFrac()*24*1e9)/1e9}
function solarIsNight(){
  const hour=visualHour(),{sunrise,sunset}=solarHours();
  return hour<sunrise||hour>=sunset;
}
function nightFactor(){
  const hour=visualHour(),{sunrise,sunset}=solarHours();
  if(hour>=sunrise&&hour<sunset)return 0;
  // Sunlight ends/starts at the exact specified hours; the artistic overlay
  // eases during the first hour after sunset and the last hour before dawn.
  if(hour>=sunset)return clamp((hour-sunset)/SOLAR_TWILIGHT_HOURS,0,1);
  return clamp((sunrise-hour)/SOLAR_TWILIGHT_HOURS,0,1);
}
function sunShadowState(){
  const hour=visualHour(),{sunrise,sunset}=solarHours();
  if(hour<sunrise||hour>=sunset)return null;
  const phase=clamp((hour-sunrise)/(sunset-sunrise),0,1);
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
  // A hoarding on the crenellated top rises above it to its lean-to ridge (build_hoarding.py).
  if(s?.type==='tower'&&towerInnerRoofMounted(s)){
    const g=towerInnerRoofGeometry(s);
    return Math.max(g?g.apexZ-g.h:0,towerHoardingMounted(s)?.69:0);
  }
  if(s?.type==='tower'&&towerRoofStyle(s)==='battlement'&&towerHoardingMounted(s))return .69;
  if(!s||s.type!=='tower'||towerRoofStyle(s)!=='pitched')return 0;
  // Feudal roof pitch (roofPitch()): the slope rises from the eave over the roof's half span, the
  // radius on round towers, the shorter half side on square ones.
  const overhang=.07,d=s.shape==='round'?null:rectDims(s);
  const half=s.shape==='round'?Number(s.r||.5)+overhang:Math.min(d.w,d.h)/2+overhang;
  return roofPitchTan()*half;
}
function towerVisualTopHeight(s){
  if(!s||s.type!=='tower')return structureHeight(s);
  return structureHeight(s)+towerRoofRise(s);
}
function towerRoofApex(s){return s?.shape==='dee'?deeTowerRoofApex(s):{x:s.x,y:s.y}}
function towerRoofFootprintPoints(s){
  if(!s||s.type!=='tower')return[];
  const overhang=.07;
  if(s.shape==='round')return circleWorldPoints(s.x,s.y,Number(s.r||.5)+overhang,24);
  if(isOrientedTower(s))return orientedTowerOutline(s,-overhang);
  const d=rectDims(s);
  return rectWorldPoints(s.x,s.y,d.w+overhang*2,d.h+overhang*2,s.angle||0);
}
// Inner roof (BC-251105-05): the outline drawn TOWER_INNER_ROOF_INSET in from the face (past the
// merlons' inner face, about 0.2 U, and a 0.22 U wall-walk), raised on a TOWER_INNER_ROOF_KERB high
// stone kerb, then a pyramid (square / oriented) or a cone (round) at the feudal pitch to the apex.
// Too small a ring (inner half span under 0.25 U, i.e. T1 towers) means no inner roof: `check`
// only asks whether it fits. Returns {ring,h,eaveZ,apex,apexZ,half} or null.
// The ring is small: at least ~58° of pitch so the roof stands clear of the merlons.
const TOWER_INNER_ROOF_MIN_TAN=1.6,TOWER_INNER_ROOF_INSET=.42,TOWER_INNER_ROOF_KERB=.14,TOWER_INNER_ROOF_MIN_HALF=.25;
function towerInnerRoofGeometry(s,check=false){
  if(!s||s.type!=='tower'||isWoodTower(s)||s.shape==='half')return null;
  if(!check&&!towerInnerRoofMounted(s))return null;
  const k=TOWER_INNER_ROOF_INSET,round=s.shape==='round';
  let ring,half;
  if(round){half=Number(s.r||.5)-k;ring=half>0?circleWorldPoints(s.x,s.y,half,24):[]}
  else if(isOrientedTower(s)){const d=orientedTowerDims(s);half=Math.min(d.w,d.h)/2-k;ring=half>0?orientedTowerOutline(s,k):[]}
  else{const d=rectDims(s);half=Math.min(d.w,d.h)/2-k;ring=half>0?rectWorldPoints(s.x,s.y,d.w-k*2,d.h-k*2,s.angle||0):[]}
  if(!(half>=TOWER_INNER_ROOF_MIN_HALF)||ring.length<3)return null;
  if(check)return true;
  const h=structureHeight(s),eaveZ=h+TOWER_INNER_ROOF_KERB;
  return{ring,h,eaveZ,apex:towerRoofApex(s),apexZ:eaveZ+Math.max(roofPitchTan(),TOWER_INNER_ROOF_MIN_TAN)*half,half};
}
// Square stone towers choose the shape of the pitched roof (variant `roofShape`): a pyramid, two
// slopes on a ridge with stone gable ends, or four slopes on a ridge half as long as the roof (hip).
// The ridge runs along the tower's local x axis at the pyramid's apex height. Faces keep the
// pyramid's edge order (0: front slope, 1: +x end, 2: back slope, 3: -x end) so shading matches.
function towerRoofShape(s){return s?.type==='tower'&&(s.shape||'square')==='square'&&!isWoodTower(s)&&towerRoofStyle(s)==='pitched'?structureVariant(s,'roofShape')||'pyramid':'pyramid'}
function squareTowerRoofGeometry(s){
  const fp=towerRoofFootprintPoints(s);if(fp.length!==4)return null;
  const shape=towerRoofShape(s),h=structureHeight(s),ridgeH=towerVisualTopHeight(s);
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),e0=lerp(fp[0],fp[3],.5),e1=lerp(fp[1],fp[2],.5);
  const t=shape==='gable'?0:shape==='hip'?.25:.5,ridgeA=lerp(e0,e1,t),ridgeB=lerp(e0,e1,1-t);
  const eave=p=>({p,z:h}),ridge=p=>({p,z:ridgeH}),end=shape==='gable'?'gable':'roof';
  return{shape,h,ridgeH,footprint:fp,ridgeA,ridgeB,faces:[
    {i:0,kind:'roof',pts:[eave(fp[0]),eave(fp[1]),ridge(ridgeB),ridge(ridgeA)]},
    {i:1,kind:end,pts:[eave(fp[1]),eave(fp[2]),ridge(ridgeB)]},
    {i:2,kind:'roof',pts:[eave(fp[2]),eave(fp[3]),ridge(ridgeA),ridge(ridgeB)]},
    {i:3,kind:end,pts:[eave(fp[3]),eave(fp[0]),ridge(ridgeA)]}
  ].map(f=>({...f,pts:f.pts.filter((q,k,a)=>k===0||q.p!==a[k-1].p)}))};
}
function gateRoofRise(s){
  if(!s||s.type!=='gate'||gateRoofStyle(s)!=='pitched')return 0;
  if(gateTimberUpper(s))return GATE_TIMBER_RIDGE-structureHeight(s);
  // Feudal roof pitch over the half span: across the passage on the large gate, along it on the
  // small one (whose ridge turns, see gateRoofGeometry).
  const d=rectDims(s),overhang=.08;
  return roofPitchTan()*((isSmallGate(s)?d.w:d.h)/2+overhang);
}
function gateRoofGeometry(s){
  if(!s||s.type!=='gate'||gateRoofStyle(s)!=='pitched')return null;
  const d=rectDims(s),overhang=.08,h=structureHeight(s),rise=gateRoofRise(s),jetty=gateTimberUpper(s)?GATE_JETTY:0;
  const hx=d.w/2+jetty+overhang,hy=d.h/2+overhang,ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0);
  const local=(x,y)=>({x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca});
  const c0=local(-hx,-hy),c1=local(hx,-hy),c2=local(hx,hy),c3=local(-hx,hy),footprint=[c0,c1,c2,c3];
  // The small gate (stone or timber storey) turns the ridge across the passage: slopes over the
  // front and the rear, gables on the flanks (same corner roles: ridgeA between c3 and c0, ridgeB
  // between c1 and c2).
  if(isSmallGate(s))return{h,ridgeH:h+rise,c0,c1:c3,c2:c2,c3:c1,ridgeA:local(0,-hy),ridgeB:local(0,hy),footprint};
  const ridgeA=local(-hx,0),ridgeB=local(hx,0);
  return{h,ridgeH:h+rise,c0,c1,c2,c3,ridgeA,ridgeB,footprint};
}
function gateVisualTopHeight(s){
  if(!s||s.type!=='gate')return structureHeight(s);
  // A hoarding on the crenellated top rises above it to its lean-to ridge (build_hoarding.py).
  if(gateRoofStyle(s)==='battlement'&&gateHoardingMounted(s))return structureHeight(s)+.69;
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
  if(s?.type==='tower'&&(towerRoofStyle(s)==='pitched'||towerInnerRoofMounted(s)))return towerVisualTopHeight(s);
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
const shadowCasterGeometryCache=new Map();
function shadowCasterSignature(s){
  return[
    s.id,s.type,s.x,s.y,s.angle,s.w,s.h,s.r,s.size,s.level,s.tier,s.houseLevel,s.width,
    s.a?.x,s.a?.y,s.b?.x,s.b?.y,s.roofStyle,s.machicolationStyle,s.bartizan,s.bell,s.innerRoof,s.signalFire,s.signalFireSpent,s.lookout,s.outpost?.readyDay,s.roofShape,s.baseStyle,s.material,s.woodStyle,s.woodRoof,
    s.type==='house'&&(s.auto||s.urbanRedeveloped)&&houseLevel(s)>=3?urbanRevision:0
  ].join('|');
}
function shadowCasterGeometry(s){
  const key=shadowCasterSignature(s),cached=shadowCasterGeometryCache.get(s.id);
  if(cached?.key===key)return cached;
  const fp=s.type==='house'&&(s.auto||s.urbanRedeveloped)&&houseLevel(s)>=3
    ?convexHull(urbanHouseDisplayParts(s).filter(part=>part.kind!=='outbuilding').flatMap(part=>part.points))
    :isCastlePart(s)?unionFootprintPoints(s):footprintPoints(s);
  const h=shadowStructureHeight(s);
  const value={key,fp,h};
  shadowCasterGeometryCache.set(s.id,value);
  return value;
}
function drawStructureShadow(s,sun){
  if(!s||underConstruction(s)||!['house','tower','gate','wall','palisade','built','market','tavern','church','civicAnnex'].includes(s.type))return;
  const {fp,h}=shadowCasterGeometry(s);
  if(!fp?.length||h<=0)return;
  const len=h*sun.lengthPerHeight;
  const ox=sun.dx*len,oy=sun.dy*len;
  const cloud=[];
  for(const p of fp){
    cloud.push(w2s(p,0));
    cloud.push(w2s({x:p.x+ox,y:p.y+oy},0));
  }
  const hull=convexHull(cloud);if(hull.length<3)return;

  // Canvas blur on a full-screen offscreen cache is catastrophically expensive
  // on software rasterizers and the deferred cost is paid later during blit.
  // A crisp low-alpha polygon reads as a soft ground shadow at settlement scale
  // without forcing a filtered full-canvas resolve every shadow refresh.
  pathPolygon(hull,'rgba(4,5,7,'+(sun.alpha*.82).toFixed(3)+')',null);
}
function drawDynamicShadows(){
  const sun=sunShadowState();if(!sun)return;
  const casters=State.structures.filter(s=>!underConstruction(s)&&['house','tower','gate','wall','palisade','built','market','tavern','church','civicAnnex'].includes(s.type));
  for(const s of casters)drawStructureShadow(s,sun);
}
let fieldWorkAssignmentCache={key:null,map:new Map()};
// A house represents one available agricultural worker in its social cohort.
// Non-farm industries have priority; in particular, an employed L2 miner or
// quarry worker cannot also create or work a field.
