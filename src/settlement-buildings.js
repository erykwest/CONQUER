'use strict';
// Civic buildings, house silhouettes, windows and doors. Runtime semantics preserved from the monolith.
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
function drawFlatRect(s,fill,stroke){
  pathPolygon(projectPath(rectWorldPoints(s.x,s.y,s.w,s.h,s.angle||0)),fill,stroke,1);
}
function fieldGrid(field){return fieldLayout(field)}
function drawField(field){drawFieldGround(field)}
// L1 cottages are thatched (straw); L2+ use anthracite slate. Gables stay timber/plaster.
const HOUSE_THATCH={a:'#b39250',b:'#c4a25d',stroke:'#d8bd7c'};
// Yard outbuildings of L3/L4 plots (urbanLotOutbuildings): timber storehouse with a gabled
// shingle roof, or an open lean-to on posts whose high side backs onto the plot boundary.
const OUTBUILDING_TIMBER={a:'#5d4431',b:'#71543c',gable:'#6b4f39',stroke:'rgba(176,142,104,.55)'};
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
  const infillDoor=urbanDenseHouseDoorInfo(house);if(infillDoor)return infillDoor;
  if(!Number.isFinite(Number(house.doorSide)))house.doorSide=inferHouseDoorSide(house);
  const side=Number(house.doorSide)>=0?1:-1,ca=Math.cos(house.angle||0),sa=Math.sin(house.angle||0);
  const size=houseFootprintDimensions(house);
  const tangent={x:ca,y:sa},normal={x:-sa*side,y:ca*side},half=size.h/2;
  // The door takes the half of the facade away from an L4 corner turret.
  const turret=houseTurretInfo(house),hashSign=(peasantHash(house.id)&2)?1:-1;
  const lateralSign=turret&&turret.sx===hashSign?-hashSign:hashSign;
  const lateralOffset=size.w*.24*lateralSign;
  // Extensions and L4 turrets may cover the original base-wall entrance.
  // Put the door on the outermost exposed footprint along its outward ray.
  let reach=half;
  for(const part of houseFootprintParts(house)){
    const poly=part.points.map(p=>({x:(p.x-house.x)*tangent.x+(p.y-house.y)*tangent.y,
      y:(p.x-house.x)*normal.x+(p.y-house.y)*normal.y}));
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      if(lateralOffset<Math.min(a.x,b.x)-1e-8||lateralOffset>Math.max(a.x,b.x)+1e-8)continue;
      if(Math.abs(b.x-a.x)<1e-8){reach=Math.max(reach,a.y,b.y);continue}
      const t=(lateralOffset-a.x)/(b.x-a.x);
      reach=Math.max(reach,a.y+(b.y-a.y)*t);
    }
  }
  const surface={
    x:house.x+normal.x*reach+tangent.x*lateralOffset,
    y:house.y+normal.y*reach+tangent.y*lateralOffset
  };
  let outside={x:surface.x+normal.x*.28,y:surface.y+normal.y*.28};
  // Keep clearance from nearby extension/turret corners as well as the
  // facade intersected by the entrance ray.
  const parts=houseFootprintParts(house);
  for(let i=0;i<24;i++){
    const blocked=parts.some(part=>pointInPolygon(outside,part.points)||part.points.some((a,j)=>
      pointSegmentDistance(outside,a,part.points[(j+1)%part.points.length])<=.22));
    if(!blocked)break;
    outside={x:outside.x+normal.x*.12,y:outside.y+normal.y*.12};
  }
  return{surface,outside,tangent,normal,side,lateralSign};
}
function drawAutoStructure(s,preview=false){
  ctx.save();if(preview)ctx.globalAlpha=.58;else if(underConstruction(s))ctx.globalAlpha=.38;
  if(s.type==='field'){
    drawField(s);
  }else if(s.type==='road'){
    const a=w2s(s.a),b=w2s(s.b);ctx.strokeStyle='rgba(126,106,82,.70)';ctx.lineWidth=Math.max(2,s.width*U*State.view.scale*.72);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }else if(s.type==='house'&&(preview||underConstruction(s))){
    // Houses have no 2.5D body (D-RENDER-3D-261111): finished ones are World 3D meshes, a site is
    // assembled piece by piece from the same meshes, a ghost is its footprint volume.
    ctx.globalAlpha=1;
    if(preview||!window.ConquerAssembly?.draw(s))drawPlacementVolume(s,'rgba(244,214,160,.22)','rgba(244,214,160,.92)');
  }
  ctx.restore();
  if(underConstruction(s)){if(!preview)window.ConquerConstructionProps?.drawSite(s);drawConstructionProgress(s)}
}
function structureCenter(s){if(s.x!=null)return{x:s.x,y:s.y};if(s.a&&s.b)return{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};return{x:0,y:0}}

