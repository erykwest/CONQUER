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
const shadowCasterGeometryCache=new Map();
function shadowCasterSignature(s){
  return[
    s.id,s.type,s.x,s.y,s.angle,s.w,s.h,s.r,s.size,s.level,s.tier,s.houseLevel,s.width,
    s.a?.x,s.a?.y,s.b?.x,s.b?.y,s.roofStyle,s.baseStyle,s.material,s.woodStyle,s.woodRoof,
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
  if(!s||underConstruction(s)||!['house','tower','gate','wall','palisade','built','market','tavern','church'].includes(s.type))return;
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
  const casters=State.structures.filter(s=>!underConstruction(s)&&['house','tower','gate','wall','palisade','built','market','tavern','church'].includes(s.type));
  for(const s of casters)drawStructureShadow(s,sun);
}
let fieldWorkAssignmentCache={key:null,map:new Map()};
// A house represents one available agricultural worker in its social cohort.
// Non-farm industries have priority; in particular, an employed L2 miner or
// quarry worker cannot also create or work a field.
