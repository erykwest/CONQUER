'use strict';
// Quadrilateral parcels inscribed in bounded Euclidean Voronoi cells.
// Houses are the sites. A rejected four-corner parcel never spawns a house.
let urbanRevision=0,urbanGeometryCache=null,urbanLotCache=null,urbanFenceCache=null,urbanFenceNavCache=null;
function invalidateUrbanGeometry(){
  urbanRevision++;urbanGeometryCache=null;urbanLotCache=null;urbanFenceCache=null;urbanFenceNavCache=null;
}
function urbanArea(poly){
  return poly.reduce((a,p,i)=>a+p.x*poly[(i+1)%poly.length].y-p.y*poly[(i+1)%poly.length].x,0)/2;
}
function urbanClip(poly,nx,ny,limit){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a.x*nx+a.y*ny-limit,db=b.x*nx+b.y*ny-limit;
    if(da<=1e-8)out.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){
      const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
  }
  return out.filter((p,i)=>!i||dist(p,out[i-1])>1e-7);
}
function urbanContains(poly,p,pad=0){
  if(poly.length<3)return false;
  const sign=urbanArea(poly)>=0?1:-1;
  return poly.every((a,i)=>{
    const b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y;
    return sign*(dx*(p.y-a.y)-dy*(p.x-a.x))>=pad*Math.hypot(dx,dy)-1e-7;
  });
}
function urbanPolygonsOverlap(a,b){
  if(!a?.length||!b?.length)return false;
  const bounds=p=>({x0:Math.min(...p.map(q=>q.x)),x1:Math.max(...p.map(q=>q.x)),
    y0:Math.min(...p.map(q=>q.y)),y1:Math.max(...p.map(q=>q.y))});
  const aa=bounds(a),bb=bounds(b);
  if(aa.x1<bb.x0||bb.x1<aa.x0||aa.y1<bb.y0||bb.y1<aa.y0)return false;
  if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return true;
  return a.some((p,i)=>b.some((q,j)=>segmentDistance(p,a[(i+1)%a.length],q,b[(j+1)%b.length])<1e-7));
}
function urbanCircleSegmentHits(circle,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-circle.x,fy=a.y-circle.y;
  const A=dx*dx+dy*dy;if(A<1e-12)return[];
  const B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-circle.r*circle.r,D=B*B-4*A*C;
  if(D<0)return[];
  return[(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)]
    .filter(t=>t>=0&&t<=1).map(t=>({t,x:a.x+dx*t,y:a.y+dy*t}));
}
function urbanCirclePairHits(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<1e-8||d>a.r+b.r||d<Math.abs(a.r-b.r))return[];
  const x=(a.r*a.r-b.r*b.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.r*a.r-x*x));
  const cx=a.x+dx*x/d,cy=a.y+dy*x/d;
  return[{x:cx-dy*h/d,y:cy+dx*h/d},{x:cx+dy*h/d,y:cy-dx*h/d}];
}
function urbanYellowContains(poly){
  const combat=window.ConquerCombat;if(!combat?.areaState||!combat.yellowGeometry)return false;
  const yellow=p=>combat.areaState(p).yellow;
  if(!poly.every(yellow))return false;
  const x0=Math.min(...poly.map(p=>p.x)),x1=Math.max(...poly.map(p=>p.x));
  const y0=Math.min(...poly.map(p=>p.y)),y1=Math.max(...poly.map(p=>p.y));
  const regions=combat.yellowGeometry().filter(c=>c.x+c.r>=x0&&c.x-c.r<=x1&&c.y+c.r>=y0&&c.y-c.r<=y1);
  // A convex parcel inside one uncut yellow disk is wholly inside the zone.
  if(!regions.some(c=>c.mode==='eraseYellow')&&regions.some(c=>poly.every(p=>dist(p,c)<=c.r)))return true;
  // Split every parcel edge at all brush-circle intersections. Membership is
  // constant on each open interval, including a narrow erased strip.
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ts=[0,1];
    for(const c of regions)ts.push(...urbanCircleSegmentHits(c,a,b).map(p=>p.t));
    ts.sort((a,b)=>a-b);
    for(let j=1;j<ts.length;j++){
      const t=(ts[j-1]+ts[j])/2;
      if(!yellow({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}))return false;
    }
  }
  // A hole can sit entirely inside the parcel. Circle-circle and circle-edge
  // crossings split its boundary into arcs of constant membership. Test both
  // sides of each arc, so corners alone cannot hide an erased island.
  for(const c of regions){
    if(urbanContains(poly,c)&&!yellow(c))return false;
    const angles=[0,Math.PI/2,Math.PI,Math.PI*1.5];
    const add=p=>angles.push((Math.atan2(p.y-c.y,p.x-c.x)+Math.PI*2)%(Math.PI*2));
    for(const other of regions)if(other!==c)for(const p of urbanCirclePairHits(c,other))add(p);
    for(let i=0;i<poly.length;i++)for(const p of urbanCircleSegmentHits(c,poly[i],poly[(i+1)%poly.length]))add(p);
    angles.sort((a,b)=>a-b);
    for(let i=0;i<angles.length;i++){
      const angle=(angles[i]+(i+1<angles.length?angles[i+1]:angles[0]+Math.PI*2))/2;
      for(const delta of [-.00001,.00001]){
        const p={x:c.x+Math.cos(angle)*(c.r+delta),y:c.y+Math.sin(angle)*(c.r+delta)};
        if(urbanContains(poly,p)&&!yellow(p))return false;
      }
    }
  }
  return true;
}
function urbanBuildingPolygons(s){
  if(!s||['road','field'].includes(s.type))return[];
  if(s.type==='house')return houseFootprintParts(s).map(p=>p.points);
  if(s.type==='well')return[wellPlazaPoints(s)];
  if(isCivic(s))return civicParts(s).map(p=>p.points);
  const points=footprintPoints(s);return points?.length?[points]:[];
}
function urbanParcelTerrainAllowed(points){
  if(!points?.length)return false;
  // Reject the *whole* parcel, not just the house or field center.
  // Gentle slopes remain buildable; only cliffs/steep relief are excluded.
  for(const feature of State.environment){
    if(feature.type==='forest'&&feature.holes?.length){
      // Parcel corners in woodland holes may be buildable, but trees are not.
      if(forestCoversPolygon(feature,points))return false;
      continue;
    }
    if(['forest','mountain','pond','sea'].includes(feature.type)&&
      urbanPolygonsOverlap(points,feature.points))return false;
    if(['river','stream'].includes(feature.type)){
      const line=feature.points||[],clearance=(Number(feature.width)||0)/2+.20;
      for(let j=0;j<line.length-1;j++){
        const a=line[j],b=line[j+1];
        if(urbanContains(points,a)||urbanContains(points,b))return false;
        for(let i=0;i<points.length;i++)
          if(segmentDistance(a,b,points[i],points[(i+1)%points.length])<=clearance)return false;
      }
    }
  }
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  for(let x=x0;x<=x1+.001;x+=.3)for(let y=y0;y<=y1+.001;y+=.3)
    if(urbanContains(points,{x,y})&&terrainSlopeKind({x,y})==='steep')return false;
  return points.every(p=>terrainSlopeKind(p)!=='steep');
}
function urbanFieldParcelAllowed(points,fieldId){
  if(!points?.length||!urbanParcelTerrainAllowed(points))return false;
  if(points.some(p=>p.x<BUILD_MIN||p.x>BUILD_MAX||p.y<BUILD_MIN||p.y>BUILD_MAX))return false;
  // Fields belong in the white rural belt, not the settlement's yellow/green
  // housing area. H0 must hold over the whole parcel, not only its centroid.
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  for(let x=minX;x<=maxX+.001;x+=.4)for(let y=minY;y<=maxY+.001;y+=.4){
    const p={x,y};if(!urbanContains(points,p))continue;
    if(window.ConquerCombat?.areaState(p).yellow||terrainPlateauElevation(p)!==0)return false;
  }
  for(const p of points)if(window.ConquerCombat?.areaState(p).yellow||terrainPlateauElevation(p)!==0)return false;
  for(const other of State.structures){
    if(other.id===fieldId||other.type==='field'||other.type==='road')continue;
    if(urbanBuildingPolygons(other).some(poly=>urbanPolygonsOverlap(points,poly)))return false;
  }
  return true;
}
function urbanParcelAllowed(points,houseId){
  // Reject the entire proposed parcel on water/forest/cliffs, not just its site.
  // Gentle hills remain available to both houses and farmland.
  if(!urbanYellowContains(points)||!urbanParcelTerrainAllowed(points))return false;
  for(const s of State.structures){
    if(s.id===houseId)continue;
    // Houses have priority over fields; the field is reclaimed only after
    // the new house passes the lot/terrain checks and is actually placed.
    if(s.type==='field')continue;
    if(urbanBuildingPolygons(s).some(poly=>urbanPolygonsOverlap(points,poly)))return false;
  }
  return true;
}
function urbanLotsOverlappingBuilding(building){
  const footprints=urbanBuildingPolygons(building);if(!footprints.length)return[];
  return urbanLots().filter(lot=>footprints.some(poly=>urbanPolygonsOverlap(lot.points,poly)));
}
const URBAN_MIN_LOT_SIZE=2;
function urbanLotHasMinimumSize(poly,preferredAngle=0){
  // Any convex parcel (Voronoi cells have 3+ corners; fallback quads have 4).
  const n=poly.length;if(n<3)return false;
  const sign=urbanArea(poly)>=0?1:-1,half=URBAN_MIN_LOT_SIZE/2;
  const angles=[preferredAngle,...poly.map((a,i)=>Math.atan2(poly[(i+1)%n].y-a.y,poly[(i+1)%n].x-a.x))];
  // Feasible centers of an inscribed 2x2 square: offset each half-plane by
  // the square's support distance. This rejects thin slivers with large area.
  return angles.some(angle=>{
    const ux=Math.cos(angle),uy=Math.sin(angle),vx=-uy,vy=ux;let centers=poly.slice();
    for(let i=0;i<n;i++){
      const a=poly[i],b=poly[(i+1)%n],nx=sign*(b.y-a.y),ny=sign*(a.x-b.x);
      const support=half*(Math.abs(nx*ux+ny*uy)+Math.abs(nx*vx+ny*vy));
      centers=urbanClip(centers,nx,ny,nx*a.x+ny*a.y-support);
      if(!centers.length)return false;
    }
    return centers.length>0;
  });
}
function urbanSpawnOccupants(){
  const out=window.ConquerCombat?.spawnOccupants?.()||[];
  const houses=completedSettlement('house'),fields=completedSettlement('field');
  const assignments=fieldWorkAssignments(houses.filter(h=>houseLevel(h)<=2),fields),day=peasantVisualDay();
  for(const house of houses)for(const resident of houseResidents(house)){
    let p=residentClassPosition(house,resident,day,assignments.get(house.id));
    if(p)p={x:p.x+resident.scatterX,y:p.y+resident.scatterY};
    p=window.ConquerCombat?.civilSpawnPosition?.(p,house,resident)??p;
    if(p)out.push({x:p.x,y:p.y,r:resident.age==='child'?.12:.22});
  }
  return out;
}
function urbanLotUnitConflict(lot,occupants=urbanSpawnOccupants()){
  const poly=lot.points;
  return occupants.some(unit=>pointInPolygon(unit,poly)||poly.some((a,i)=>
    pointSegmentDistance(unit,a,poly[(i+1)%poly.length])<=(unit.r||.22)));
}
function urbanQuad(cell,house,allowed=null){
  if(cell.length<4)return null;
  const footprint=houseFootprintParts(house).flatMap(p=>p.points);
  const candidates=[];
  for(let a=0;a<cell.length-3;a++)for(let b=a+1;b<cell.length-2;b++)
    for(let c=b+1;c<cell.length-1;c++)for(let d=c+1;d<cell.length;d++){
      const quad=[cell[a],cell[b],cell[c],cell[d]],size=Math.abs(urbanArea(quad));
      if(!footprint.every(p=>urbanContains(quad,p,.16))||!urbanLotHasMinimumSize(quad,house.angle||0))continue;
      candidates.push({quad,size});
    }
  // A blocked maximum-area quad must not reject other viable inscribed lots.
  candidates.sort((a,b)=>b.size-a.size);
  for(const {quad} of candidates)if(!allowed||allowed(quad))return quad;
  // A small oriented rectangle is also an inscribed quadrilateral, useful for
  // dense legacy settlements whose cell has more than four narrow corners.
  const local=footprint.map(p=>toLocalPoint(house,p)),pad=.20;
  const minX=Math.min(...local.map(p=>p.x))-pad,maxX=Math.max(...local.map(p=>p.x))+pad;
  const minY=Math.min(...local.map(p=>p.y))-pad,maxY=Math.max(...local.map(p=>p.y))+pad;
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const hx=Math.max(URBAN_MIN_LOT_SIZE/2,(maxX-minX)/2),hy=Math.max(URBAN_MIN_LOT_SIZE/2,(maxY-minY)/2);
  const x0=cx-hx,x1=cx+hx,y0=cy-hy,y1=cy+hy;
  const quad=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>houseLocalToWorld(house,x,y));
  return quad.every(p=>urbanContains(cell,p))&&(!allowed||allowed(quad))?quad:null;
}
function urbanLotFor(house,houses,roads=primaryRoadList()){
  const reach=3.4;
  let cell=[
    {x:Math.max(BUILD_MIN,house.x-reach),y:Math.max(BUILD_MIN,house.y-reach)},
    {x:Math.min(BUILD_MAX,house.x+reach),y:Math.max(BUILD_MIN,house.y-reach)},
    {x:Math.min(BUILD_MAX,house.x+reach),y:Math.min(BUILD_MAX,house.y+reach)},
    {x:Math.max(BUILD_MIN,house.x-reach),y:Math.min(BUILD_MAX,house.y+reach)}
  ];
  for(const other of houses){
    if(other.id===house.id||dist(other,house)>reach*3)continue;
    const nx=other.x-house.x,ny=other.y-house.y;
    if(Math.hypot(nx,ny)<1e-6)return null;
    cell=urbanClip(cell,nx,ny,(other.x*other.x+other.y*other.y-house.x*house.x-house.y*house.y)/2);
    if(cell.length<4)return null;
  }
  // Lots stop at the road verge. Derived entrance spurs remain within the
  // parcel and receive a gate rather than splitting their owner's parcel.
  for(const road of roads){
    const q=closestPointOnSegment(house,road.a,road.b),distance=dist(house,q);
    if(distance>reach*1.5||distance<1e-6)continue;
    const dx=road.b.x-road.a.x,dy=road.b.y-road.a.y,L=Math.hypot(dx,dy);
    if(!L)continue;
    let nx=-dy/L,ny=dx/L;
    if((house.x-q.x)*nx+(house.y-q.y)*ny>0){nx=-nx;ny=-ny}
    cell=urbanClip(cell,nx,ny,q.x*nx+q.y*ny-(Number(road.width)||.62)/2-URBAN_ROAD_VERGE);
    if(cell.length<4)return null;
  }
  // Redevelopment preserves the cadastral lot of the existing cottage;
  // dense streetfront volumes are derived within that owned plot.
  const site=(houseLevel(house)>=3&&(house.auto||house.urbanRedeveloped))
    ?{...house,houseLevel:2}:house;
  // Preferred parcel: the whole Voronoi cell, so neighbouring lots share their
  // bisector edges exactly (one fence, no slivers between plots). Fields and
  // other buildings cut it along their own side, a few centimetres apart.
  const full=urbanCellParcel(urbanClipObstacles(cell,house),site);
  if(full&&urbanParcelAllowed(full,house.id))return{id:'lot:'+house.id,houseId:house.id,points:full,height:.38};
  // Fallback for cells crossed by forest, water or cliffs: the largest allowed
  // quadrilateral inscribed in the cell.
  const points=urbanQuad(cell,site,points=>urbanParcelAllowed(points,house.id));
  return points?{id:'lot:'+house.id,houseId:house.id,points,height:.38}:null;
}
const URBAN_ROAD_VERGE=.08,URBAN_OBSTACLE_GAP=.03;
// Convex obstacles (fields, civic/castle footprints) near the house: keep the cell on the house's
// side of the obstacle edge that separates them best.
function urbanClipObstacles(cell,house){
  for(const s of State.structures){
    if(s.id===house.id||s.type==='house'||s.type==='road'||s.type==='field')continue;
    const polys=urbanBuildingPolygons(s);
    for(const poly of polys){
      if(!poly?.length||!urbanPolygonsOverlap(cell,poly))continue;
      const sign=urbanArea(poly)>=0?1:-1;let best=null;
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],L=dist(a,b);if(L<1e-6)continue;
        // Outward normal of the obstacle edge.
        const nx=sign*(b.y-a.y)/L,ny=sign*(a.x-b.x)/L,d=(house.x-a.x)*nx+(house.y-a.y)*ny;
        if(!best||d>best.d)best={nx,ny,d,c:a.x*nx+a.y*ny};
      }
      if(!best||best.d<=0)return null;
      cell=urbanClip(cell,-best.nx,-best.ny,-(best.c+URBAN_OBSTACLE_GAP));
      if(cell.length<3)return null;
    }
  }
  return cell;
}
function urbanCellParcel(cell,site){
  if(!cell||cell.length<3)return null;
  // Drop near-duplicate and collinear corners left by the clipping passes.
  let poly=cell.filter((p,i)=>dist(p,cell[(i+1)%cell.length])>.02);
  poly=poly.filter((p,i)=>{
    const a=poly[(i+poly.length-1)%poly.length],b=poly[(i+1)%poly.length];
    return Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))>1e-5*Math.max(1,dist(a,b));
  });
  if(poly.length<3)return null;
  const footprint=houseFootprintParts(site).flatMap(p=>p.points);
  if(!footprint.every(p=>urbanContains(poly,p,.16)))return null;
  return urbanLotHasMinimumSize(poly,site.angle||0)?poly:null;
}
// Reuse the immutable snapshot while evaluating many speculative spawn sites.
// Manual L2+ upgrades still use the independent ignoreDynamicUnits option.
function urbanHouseSpawnContext(){
  return{
    houses:State.structures.filter(s=>s.type==='house'),
    roads:primaryRoadList(),
    occupants:null,
    existingLots:new Map()
  };
}
function urbanReclaimFieldsForHouse(house){
  // Displace rural agriculture only AFTER the house is valid. The owner parcel
  // takes precedence and an entire overlapped field is reclaimed rather than
  // leaving tiny non-farmable fragments or stale worker/crop footprints.
  const lot=urbanLotFor(house,State.structures.filter(s=>s.type==='house').concat(house));
  const parts=houseFootprintParts(house).map(p=>p.points);
  const area=lot?.points?[lot.points,...parts]:parts;
  const removed=new Set(State.structures.filter(s=>s.type==='field'&&s.auto&&
    area.some(poly=>urbanPolygonsOverlap(poly,fieldPoints(s)))).map(s=>s.id));
  if(!removed.size)return 0;
  State.structures=State.structures.filter(s=>!removed.has(s.id)&&
    !(s.type==='road'&&removed.has(s.accessFor)));
  invalidateUrbanGeometry();
  return removed.size;
}
function urbanHouseFitsLots(candidate,options={}){
  const ignoreDynamicUnits=!!options.ignoreDynamicUnits;
  // Keep the original context reference: the cached occupants and base lots
  // must persist across all candidate sites within one spawn attempt.
  const spawnContext=options.houses&&options.existingLots instanceof Map?options:null;
  const existing=spawnContext?.houses||State.structures.filter(s=>s.type==='house'&&s.id!==candidate.id);
  const houses=existing.filter(h=>h.id!==candidate.id);
  houses.push(candidate);
  const roads=spawnContext?.roads;
  const lot=urbanLotFor(candidate,houses,roads);
  if(!lot)return false;
  // During manual upgrades, existing residents must not veto their own home.
  // During spawn, enumerate resident positions only once per growth attempt.
  if(!ignoreDynamicUnits){
    const occupants=spawnContext?(spawnContext.occupants??=(urbanSpawnOccupants())):undefined;
    if(urbanLotUnitConflict(lot,occupants))return false;
  }
  if(spawnContext){
    for(const h of existing){
      if(h.id===candidate.id||dist(h,candidate)>10.2)continue;
      let baseline;
      if(spawnContext.existingLots.has(h.id))baseline=spawnContext.existingLots.get(h.id);
      else{
        baseline=urbanLotFor(h,existing,roads);
        spawnContext.existingLots.set(h.id,baseline||null);
      }
      if(baseline&&!urbanLotFor(h,houses,roads))return false;
    }
    return true;
  }
  return existing.every(h=>h.id===candidate.id||dist(h,candidate)>10.2||
    !urbanLotFor(h,existing)||!!urbanLotFor(h,houses));
}
function urbanLots(){
  if(urbanLotCache)return urbanLotCache;
  const houses=State.structures.filter(s=>s.type==='house'),roads=primaryRoadList();
  return urbanLotCache=houses.map(h=>urbanLotFor(h,houses,roads)).filter(Boolean);
}
// Urban redevelopment: a L3/L4 plot is one economic household, with several
// deterministic street-front volumes. Children are geometry, not extra citizens.
const URBAN_FRONT_WIDTH=Object.freeze({3:1.45,4:1.17}),URBAN_FRONT_SETBACK=.05;
let urbanDensityCache={revision:-1,parts:new Map()};
function urbanLotRoadFrontages(lot){
  const roads=primaryRoadList(true),out=[],polygon=lot.points;
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],length=dist(a,b);
    if(length<1.5)continue;
    const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length,intervals=[];
    for(const road of roads){
      const dx=road.b.x-road.a.x,dy=road.b.y-road.a.y,L=Math.hypot(dx,dy);
      if(L<.1||Math.abs((dx*ux+dy*uy)/L)<.93)continue;
      const t0=(road.a.x-a.x)*ux+(road.a.y-a.y)*uy;
      const t1=(road.b.x-a.x)*ux+(road.b.y-a.y)*uy;
      const from=Math.max(.22,Math.min(t0,t1)),to=Math.min(length-.22,Math.max(t0,t1));
      if(to-from<.1)continue;
      // Distance must be measured over the road-facing overlap, not at the
      // midpoint of the entire parcel side: many main-road segments are short.
      const halfway=(from+to)/2;
      const q={x:a.x+ux*halfway,y:a.y+uy*halfway};
      const distance=pointSegmentDistance(q,road.a,road.b);
      if(distance>Math.max(1.05,(Number(road.width)||.62)/2+.72))continue;
      intervals.push({from,to,distance,roadId:road.id});
    }
    intervals.sort((a,b)=>a.from-b.from||a.to-b.to);
    const merged=[];
    for(const item of intervals){
      const last=merged.at(-1);
      if(last&&item.from<=last.to+.08){
        last.to=Math.max(last.to,item.to);
        if(item.distance<last.distance){last.distance=item.distance;last.roadId=item.roadId}
      }else merged.push({...item});
    }
    for(const span of merged)if(span.to-span.from>=1.05){
      out.push({edge:i,a,b,ux,uy,from:span.from,to:span.to,
        length:span.to-span.from,distance:span.distance,roadId:span.roadId});
    }
  }
  return out.sort((a,b)=>b.length-a.length||a.edge-b.edge||a.from-b.from);
}
function urbanDenseParts(house){
  if(!house||(!house.auto&&!house.urbanRedeveloped)||houseLevel(house)<3)return[];
  if(urbanDensityCache.revision!==urbanRevision)
    urbanDensityCache={revision:urbanRevision,parts:new Map()};
  const cached=urbanDensityCache.parts.get(house.id);
  if(cached&&cached.level===houseLevel(house))return cached.parts;
  const lot=urbanLots().find(l=>l.houseId===house.id),parts=[];
  if(lot){
    const level=houseLevel(house),width=URBAN_FRONT_WIDTH[level],depth=level===4?1.13:.98;
    const sign=urbanArea(lot.points)>=0?1:-1;
    for(const frontage of urbanLotRoadFrontages(lot)){
      const count=Math.floor((frontage.length+.06)/width);
      if(!count)continue;
      const spacing=frontage.length/count,baseWidth=Math.min(spacing+.045,level===4?1.65:1.95);
      const inward={x:-frontage.uy*sign,y:frontage.ux*sign};
      // Original L/T extensions grow towards the plot interior (+local Y).
      const angle=Math.atan2(inward.y,inward.x)-Math.PI/2;
      for(let i=0;i<count;i++){
        if(new Set(parts.map(p=>p.buildingKey)).size>=10)break;
        const along=frontage.from+(i+.5)*spacing;
        const partKey='street:'+frontage.edge+':'+frontage.from.toFixed(2)+':'+i;
        const requestedWidth=baseWidth*houseDimensionScale(house,'x',partKey);
        const edgeLength=dist(frontage.a,frontage.b);
        const maxInsideWidth=2*(Math.min(along,edgeLength-along)-.075);
        let faceWidth=Math.min(requestedWidth,maxInsideWidth);
        const minWidth=baseWidth*.8;
        if(faceWidth<minWidth-1e-7)continue;
        const faceDepth=depth*houseDimensionScale(house,'y',partKey);
        // Townhouses stand right on the street line (lot edge = road verge).
        const center={
          x:frontage.a.x+frontage.ux*along+inward.x*(faceDepth/2+URBAN_FRONT_SETBACK),
          y:frontage.a.y+frontage.uy*along+inward.y*(faceDepth/2+URBAN_FRONT_SETBACK)
        };
        const buildingKey=house.id+'|'+partKey,virtual={
          id:buildingKey,type:'house',houseLevel:level,urbanCompact:true,
          x:center.x,y:center.y,angle,w:faceWidth,h:faceDepth
        };
        let accepted=null;
        for(let attempt=0;attempt<8;attempt++){
          virtual.w=faceWidth;
          const shape=houseFootprintParts(virtual).map(part=>({
            ...part,dense:true,buildingKey,roadId:frontage.roadId,
            frontage:frontage.edge,roofAngle:angle+(part.roofTurn||0)
          }));
          // Test the *entire* L/T outline and the L4 turret, not just the
          // original rectangular body. Slight shared-wall overlap is allowed.
          const inside=shape.every(part=>part.points.every(pt=>urbanContains(lot.points,pt,.04)));
          const collision=inside&&shape.some(part=>parts.some(previous=>{
            const area=Math.min(Math.abs(urbanArea(part.points)),Math.abs(urbanArea(previous.points)));
            return area>1e-8&&urbanPolygonIntersectionArea(part.points,previous.points)>area*.20;
          }));
          if(inside&&!collision){accepted=shape;break}
          if(faceWidth<=minWidth+1e-7)break;
          faceWidth=Math.max(minWidth,faceWidth-baseWidth*.06);
        }
        if(accepted)parts.push(...accepted);
      }
      if(new Set(parts.map(p=>p.buildingKey)).size>=10)break;
    }
  }
  urbanDensityCache.parts.set(house.id,{level:houseLevel(house),parts});
  return parts;
}
function urbanDenseBuildingCount(house){
  return new Set(urbanDenseParts(house).map(p=>p.buildingKey)).size;
}
function urbanPolygonIntersectionArea(a,b){
  let clipped=a.slice(),sign=urbanArea(b)>=0?1:-1;
  for(let i=0;i<b.length&&clipped.length;i++){
    const p=b[i],q=b[(i+1)%b.length];
    const nx=sign*(q.y-p.y),ny=sign*(p.x-q.x);
    clipped=urbanClip(clipped,nx,ny,nx*p.x+ny*p.y);
  }
  return clipped.length>=3?Math.abs(urbanArea(clipped)):0;
}
function urbanHouseDisplayParts(house){
  const dense=urbanDenseParts(house);
  return dense.length?dense.concat(urbanLotOutbuildings(house)):
    houseFootprintParts(house).concat(urbanLotOutbuildings(house));
}
// L2 cattle lots keep the original detached house and get one open lean-to
// under which the herd can shelter. Reuse the L3/L4 roof geometry and collision
// volumes: no extra persisted structures or changes to cadastral lot outlines.
let urbanCattleShelterCache={revision:-1,parts:new Map()};
function urbanL2CattleShelter(house){
  if(!house||houseLevel(house)!==2||window.ConquerLivestock?.lotKindForHouse(house)!=='cow')return[];
  if(urbanCattleShelterCache.revision!==urbanRevision)
    urbanCattleShelterCache={revision:urbanRevision,parts:new Map()};
  const key=house.id+'|'+State.seed;
  if(urbanCattleShelterCache.parts.has(key))return urbanCattleShelterCache.parts.get(key);
  const lot=urbanLots().find(l=>l.houseId===house.id);
  const parts=[];
  if(lot){
    const poly=lot.points,sign=urbanArea(poly)>=0?1:-1,street=urbanLotStreetEdges(lot);
    const candidates=poly.map((a,i)=>({
      i,a,b:poly[(i+1)%poly.length],length:dist(a,poly[(i+1)%poly.length])
    })).filter(e=>e.length>1.25).sort((a,b)=>Number(street.has(a.i))-Number(street.has(b.i))||b.length-a.length);
    const footprint=houseFootprintParts(house);
    for(const edge of candidates){
      const {a,b,length:L}=edge,ux=(b.x-a.x)/L,uy=(b.y-a.y)/L;
      const inward={x:-uy*sign,y:ux*sign},angle=Math.atan2(inward.y,inward.x)-Math.PI/2;
      const width=Math.min(2.4,L-.34),depth=.9;
      for(const portion of [.5,.32,.68]){
        const along=L*portion,center={
          x:a.x+ux*along+inward.x*(depth/2+.08),
          y:a.y+uy*along+inward.y*(depth/2+.08)
        };
        const points=rectWorldPoints(center.x,center.y,width,depth,angle);
        if(!points.every(p=>urbanContains(poly,p,.055)))continue;
        if(footprint.some(part=>urbanPolygonIntersectionArea(points,part.points)>1e-6||
          points.some((p,i)=>part.points.some((q,j)=>segmentDistance(p,points[(i+1)%points.length],
            q,part.points[(j+1)%part.points.length])<.16))))continue;
        parts.push({kind:'outbuilding',type:'shed',center,points,w:width,h:depth,
          roofTurn:0,roofAngle:angle,bodyH:.62,roofH:1.02,
          buildingKey:house.id+'|cow-shelter'});
        break;
      }
      if(parts.length)break;
    }
  }
  urbanCattleShelterCache.parts.set(key,parts);
  return parts;
}
// L3/L4 yards fill up with secondary buildings along the plot's non-street
// sides: open lean-to sheds (tettoie) and closed storehouses (magazzini).
// They are solid parts of the household (navigation, LOS, occlusion) but
// never count as dwellings and carry no windows or chimneys.
let urbanOutbuildingCache={revision:-1,parts:new Map()};
const URBAN_OUTBUILDING_MAX=6;
function urbanLotOutbuildings(house){
  if(!house)return[];
  if(houseLevel(house)===2)return urbanL2CattleShelter(house);
  if((!house.auto&&!house.urbanRedeveloped)||houseLevel(house)<3)return[];
  if(urbanOutbuildingCache.revision!==urbanRevision)urbanOutbuildingCache={revision:urbanRevision,parts:new Map()};
  const level=houseLevel(house),cached=urbanOutbuildingCache.parts.get(house.id);
  if(cached&&cached.level===level)return cached.parts;
  const lot=urbanLots().find(l=>l.houseId===house.id),parts=[];
  const dense=urbanDenseParts(house);
  if(lot&&dense.length){
    const poly=lot.points,n=poly.length,sign=urbanArea(poly)>=0?1:-1;
    const street=urbanLotStreetEdges(lot);
    // Keep a walkable yard between the townhouses' backs and the outbuildings.
    const clear=(rect,others,margin)=>others.every(o=>{
      if(urbanPolygonIntersectionArea(rect,o.points)>1e-6)return false;
      return rect.every((p,i)=>o.points.every((q,j)=>segmentDistance(p,rect[(i+1)%rect.length],q,o.points[(j+1)%o.points.length])>=margin));
    });
    for(let edge=0;edge<n&&parts.length<URBAN_OUTBUILDING_MAX;edge++){
      if(street.has(edge))continue;
      const a=poly[edge],b=poly[(edge+1)%n],L=dist(a,b);if(L<1.3)continue;
      const ux=(b.x-a.x)/L,uy=(b.y-a.y)/L,inward={x:-uy*sign,y:ux*sign};
      const angle=Math.atan2(inward.y,inward.x)-Math.PI/2;
      let along=.2,k=0;
      while(along<L-.2&&parts.length<URBAN_OUTBUILDING_MAX){
        const key=house.id+'|out:'+edge+':'+k,hash=peasantHash(key)>>>0;
        // A yard with outbuildings must include at least one actual stable.
        const kind=parts.length===0?'shed':(hash&1)?'shed':'store';
        const w=(level===4?1.2:1.0)+((hash>>>3)%7)/10,d=kind==='shed'?.78:.9+((hash>>>7)%3)/20;
        if(along+w>L-.2)break;
        const mid=along+w/2,center={x:a.x+ux*mid+inward.x*(d/2+.06),y:a.y+uy*mid+inward.y*(d/2+.06)};
        const points=rectWorldPoints(center.x,center.y,w,d,angle);
        const inside=points.every(p=>urbanContains(poly,p,.04));
        if(inside&&clear(points,dense,.45)&&clear(points,parts,.12)){
          const bodyH=kind==='shed'?.62:.82,roofH=kind==='shed'?1.02:.82+Math.tan(Math.PI/4)*d/2;
          parts.push({kind:'outbuilding',type:kind,center,points,w,h:d,roofTurn:0,roofAngle:angle,
            bodyH,roofH,buildingKey:key});
          along+=w+.3;
        }else along+=.35;
        k++;
      }
    }
  }
  urbanOutbuildingCache.parts.set(house.id,{level,parts});
  return parts;
}
function urbanDenseHouseDoorInfo(house){
  const parts=urbanDenseParts(house);if(!parts.length)return null;
  const first=parts.find(p=>p.kind==='body'),lot=urbanLots().find(l=>l.houseId===house.id);
  const edge=lot&&lot.points[first.frontage],next=lot&&lot.points[(first.frontage+1)%lot.points.length];
  if(!edge||!next)return null;
  const L=dist(edge,next)||1,tangent={x:(next.x-edge.x)/L,y:(next.y-edge.y)/L};
  const sign=urbanArea(lot.points)>=0?1:-1;
  const normal={x:tangent.y*sign,y:-tangent.x*sign};
  const surface={x:first.center.x+normal.x*first.h*.5,y:first.center.y+normal.y*first.h*.5};
  const outside={x:surface.x+normal.x*.26,y:surface.y+normal.y*.26};
  return{surface,outside,tangent,normal,side:1,lateralSign:1};
}
// Choose once from world geometry, independent of draw order, camera and reload.
function urbanBoundaryKey(a,b){
  const key=p=>p.x.toFixed(4)+','+p.y.toFixed(4),keys=[key(a),key(b)].sort();
  return keys.join('|');
}
function urbanBoundaryMaterial(a,b){
  const roll=biomeHash(State.seed+'|boundary|'+urbanBoundaryKey(a,b))/4294967296;
  return roll<.5?'fence':roll<.8?'wall':'hedge';
}
const URBAN_FENCE_WELD=.2,URBAN_FENCE_PARALLEL=.06;   // U, sin(~3.4°)
// Lot edges that face a street: those with townhouse frontage, plus any edge
// lying along a primary road verge (too short for a frontage).
function urbanLotStreetEdges(lot){
  const out=new Set(urbanLotRoadFrontages(lot).map(f=>f.edge)),roads=primaryRoadList(true),n=lot.points.length;
  for(let i=0;i<n;i++){
    const a=lot.points[i],b=lot.points[(i+1)%n],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(roads.some(r=>pointSegmentDistance(mid,r.a,r.b)<=(Number(r.width)||.62)/2+URBAN_ROAD_VERGE+.15))out.add(i);
  }
  return out;
}
function urbanFenceSegments(lots=null,fields=null){
  const cacheable=lots==null&&fields==null;
  if(lots==null)lots=urbanLots();
  if(fields==null)fields=completedSettlement('field');
  const cacheKey=cacheable?urbanRevision+'|'+fields.map(f=>f.id).join('|'):null;
  if(cacheKey&&urbanFenceCache?.key===cacheKey)return urbanFenceCache.edges;
  const raw=[];
  const addParcel=(points,door,goal)=>{
    const n=points.length;let gateEdge=-1,best=Infinity;
    for(let i=0;i<n;i++){
      const a=points[i],b=points[(i+1)%n],q=closestPointOnSegment(goal,a,b),score=dist(q,door)+dist(q,goal);
      if(score<best){best=score;gateEdge=i}
    }
    for(let i=0;i<n;i++){
      const a=points[i],b=points[(i+1)%n],L=dist(a,b);if(L<.05)continue;
      const edge={a,b,material:urbanBoundaryMaterial(a,b),key:urbanBoundaryKey(a,b)};
      if(i===gateEdge){
        const q=closestPointOnSegment(goal,a,b),t=dist(a,q)/L,half=.9/L;
        const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
        edge.gap=[at(clamp(t-half,0,1)),at(clamp(t+half,0,1))];
      }
      raw.push(edge);
    }
  };
  for(const lot of lots){
    const house=State.structures.find(h=>h.id===lot.houseId);if(!house)continue;
    if((house.auto||house.urbanRedeveloped)&&houseLevel(house)>=3){
      // Redeveloped plots open on the street through their townhouses; the yard
      // is still enclosed on every side that does not face a road.
      const n=lot.points.length,street=urbanLotStreetEdges(lot);
      for(let i=0;i<n;i++){
        if(street.has(i))continue;
        const a=lot.points[i],b=lot.points[(i+1)%n];if(dist(a,b)<.05)continue;
        raw.push({a,b,material:urbanBoundaryMaterial(a,b),key:urbanBoundaryKey(a,b)});
      }
      continue;
    }
    const door=houseDoorInfo(house).outside;
    addParcel(lot.points,door,nearestPrimaryRoadProjection(door)?.point||door);
  }
  for(const field of fields){
    const road=nearestPrimaryRoadProjection(field);
    const entry=fieldRoadAccessPoint(field,road?.point||{x:field.x+1,y:field.y});
    addParcel(fieldPoints(field),entry,entry);
  }
  // Neighbouring parcels rarely meet on exactly the same line (lot vs field
  // gap, near-coincident corners). Weld close corners, then put near-parallel
  // close edges on one shared line, so they merge instead of doubling.
  const corners=[];
  const weld=p=>{
    for(const c of corners)if(dist(c,p)<=URBAN_FENCE_WELD){c.sx+=p.x;c.sy+=p.y;c.n++;return c}
    const c={x:p.x,y:p.y,sx:p.x,sy:p.y,n:1};corners.push(c);return c;
  };
  const welded=raw.map(edge=>({...edge,ca:weld(edge.a),cb:weld(edge.b)}));
  for(const c of corners){c.x=c.sx/c.n;c.y=c.sy/c.n}
  for(const edge of welded){edge.a={x:edge.ca.x,y:edge.ca.y};edge.b={x:edge.cb.x,y:edge.cb.y}}
  // Split at all endpoints, choose one owner for shared intervals and subtract
  // every entrance globally. A neighbour must not seal another parcel's gate.
  const groups=[];
  const sorted=welded.filter(e=>dist(e.a,e.b)>1e-6).sort((p,q)=>dist(q.a,q.b)-dist(p.a,p.b));
  for(const edge of sorted){
    let dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy);dx/=L;dy/=L;
    if(dx<-.000001||Math.abs(dx)<.000001&&dy<0){dx=-dx;dy=-dy}
    // Longest edge first defines each shared line; shorter near-parallel edges
    // within the tolerance band join it.
    let group=groups.find(g=>Math.abs(g.dx*dy-g.dy*dx)<URBAN_FENCE_PARALLEL&&
      Math.abs(edge.a.x*g.nx+edge.a.y*g.ny-g.c)<URBAN_FENCE_WELD&&Math.abs(edge.b.x*g.nx+edge.b.y*g.ny-g.c)<URBAN_FENCE_WELD);
    if(!group){const nx=-dy,ny=dx;group={dx,dy,nx,ny,c:edge.a.x*nx+edge.a.y*ny,ranges:[],gaps:[]};groups.push(group)}
    else{dx=group.dx;dy=group.dy}
    const coordinate=p=>p.x*dx+p.y*dy,range=[coordinate(edge.a),coordinate(edge.b)].sort((a,b)=>a-b);
    group.ranges.push({lo:range[0],hi:range[1],material:edge.material,key:edge.key});
    if(edge.gap)group.gaps.push(edge.gap.map(coordinate).sort((a,b)=>a-b));
  }
  const out=[];
  for(const g of groups.values()){
    const cuts=[...new Set([...g.ranges.flatMap(r=>[r.lo,r.hi]),...g.gaps.flat()])].sort((a,b)=>a-b),merged=[];
    for(let i=1;i<cuts.length;i++){
      const lo=cuts[i-1],hi=cuts[i],mid=(lo+hi)/2;if(hi-lo<1e-7)continue;
      if(g.gaps.some(([a,b])=>mid>a-1e-7&&mid<b+1e-7))continue;
      const owner=g.ranges.filter(r=>mid>=r.lo-1e-7&&mid<=r.hi+1e-7).sort((a,b)=>a.key.localeCompare(b.key))[0];
      if(!owner)continue;
      const last=merged.at(-1);
      if(last&&Math.abs(last.hi-lo)<1e-7&&last.material===owner.material)last.hi=hi;
      else merged.push({lo,hi,material:owner.material});
    }
    const at=t=>({x:g.dx*t+g.nx*g.c,y:g.dy*t+g.ny*g.c});
    for(const r of merged)out.push({a:at(r.lo),b:at(r.hi),material:r.material});
  }
  if(cacheKey)urbanFenceCache={key:cacheKey,edges:out};
  return out;
}
// Physical boundaries block paths at precisely the drawn walls, fences and
// hedges, but not at lot entrances. Spatial indexing avoids scanning every
// Voronoi cell during every pedestrian and military A* step.
const URBAN_FENCE_NAV_TILE=3,URBAN_FENCE_NAV_RADIUS=.22;
function urbanFenceNavigationIndex(){
  if(urbanFenceNavCache?.revision===urbanRevision)return urbanFenceNavCache.tiles;
  const tiles=new Map(),tile=URBAN_FENCE_NAV_TILE;
  for(const edge of urbanFenceSegments()){
    const pad=URBAN_FENCE_NAV_RADIUS+.01;
    const x0=Math.floor((Math.min(edge.a.x,edge.b.x)-pad)/tile);
    const x1=Math.floor((Math.max(edge.a.x,edge.b.x)+pad)/tile);
    const y0=Math.floor((Math.min(edge.a.y,edge.b.y)-pad)/tile);
    const y1=Math.floor((Math.max(edge.a.y,edge.b.y)+pad)/tile);
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
      const key=x+','+y,items=tiles.get(key);
      if(items)items.push(edge);else tiles.set(key,[edge]);
    }
  }
  urbanFenceNavCache={revision:urbanRevision,tiles};
  return tiles;
}
function urbanFencePointBlocked(p,clearance=URBAN_FENCE_NAV_RADIUS){
  const tile=URBAN_FENCE_NAV_TILE,cell=Math.floor(p.x/tile)+','+Math.floor(p.y/tile);
  const edges=urbanFenceNavigationIndex().get(cell);
  if(!edges)return false;
  return edges.some(e=>pointSegmentDistance(p,e.a,e.b)<=clearance+1e-7);
}
function drawUrbanFence({a,b}){
  const L=dist(a,b),count=Math.max(1,Math.ceil(L/.65));
  ctx.strokeStyle='#806442';
  for(const z of [.13,.30]){
    const p=w2s(a,z),q=w2s(b,z);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
  }
  for(let i=0;i<=count;i++){
    const t=i/count,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},foot=w2s(p,.02),top=w2s(p,.38);
    ctx.beginPath();ctx.moveTo(foot.x,foot.y);ctx.lineTo(top.x,top.y);ctx.stroke();
  }
}
function drawUrbanWall({a,b}){
  const L=dist(a,b),nx=-(b.y-a.y)/L*.065,ny=(b.x-a.x)/L*.065;
  const poly=[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}];
  extrudePolygon(poly,.36,{top:State.season==='winter'?'#e5e9df':'#a3937a',sideA:'#766a59',sideB:'#8b7c67',stroke:'rgba(57,49,39,.65)'});
  ctx.strokeStyle='rgba(57,49,39,.4)';
  for(const z of [.12,.24]){
    const p=w2s(a,z),q=w2s(b,z);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
  }
  for(let i=1;i<L/.55;i++){
    const t=i*.55/L,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},foot=w2s(p,0),top=w2s(p,.36);
    ctx.beginPath();ctx.moveTo(foot.x,foot.y);ctx.lineTo(top.x,top.y);ctx.stroke();
  }
}
// Single trees on plot corners: each corner shared by several lots is welded
// into one site first, then rolls once (30%), so a shared corner never gets
// two trees. Same tree record as forest trees (drawTree / 3D billboards).
let URBAN_CORNER_TREE_CHANCE=.3;
let urbanCornerTreeCache={revision:-1,trees:[]};
function urbanLotCornerTrees(){
  if(urbanCornerTreeCache.revision===urbanRevision)return urbanCornerTreeCache.trees;
  const sites=[];
  for(const lot of urbanLots())for(const p of lot.points){
    const site=sites.find(s=>dist(s,p)<=URBAN_FENCE_WELD);
    if(site){site.sx+=p.x;site.sy+=p.y;site.n++;site.min=site.min.x<p.x||site.min.x===p.x&&site.min.y<=p.y?site.min:p}
    else sites.push({x:p.x,y:p.y,sx:p.x,sy:p.y,n:1,min:p});
  }
  const roads=primaryRoadList(true),wells=State.structures.filter(s=>s.type==='well');
  const fields=State.structures.filter(s=>s.type==='field').map(fieldPoints);
  const solids=urbanHouseGeometry().flatMap(e=>e.parts.map(p=>p.points));
  const trees=[];
  for(const site of sites){
    const p={x:site.sx/site.n,y:site.sy/site.n};
    // Keyed on the site's lowest corner, so the roll does not depend on lot order.
    const key=site.min.x.toFixed(2)+','+site.min.y.toFixed(2),hash=biomeHash(State.seed+'|lot-tree|'+key)>>>0;
    if(hash/4294967296>=URBAN_CORNER_TREE_CHANCE)continue;
    if(roads.some(r=>pointSegmentDistance(p,r.a,r.b)<(Number(r.width)||.62)/2+.35))continue;
    if(wells.some(w=>urbanContains(wellPlazaPoints(w),p,-.2)))continue;
    if(fields.some(f=>urbanContains(f,p,-.05)))continue;
    if(solids.some(poly=>urbanContains(poly,p,-.3)))continue;
    if(trees.some(t=>dist(t.p,p)<.8))continue;
    const r=seedRand(hash);
    trees.push({p,z:terrainElevation(p),urban:true,
      shapeIndex:Math.floor(r()*FOREST_TREE_ASSETS.length),
      colorIndex:Math.floor(r()*FOREST_CANOPY_PALETTES.summer.length),
      flip:r()<.5,scale:.7+r()*.25});
  }
  urbanCornerTreeCache={revision:urbanRevision,trees};
  return trees;
}
function drawUrbanLots(){
  const lots=urbanLots();
  for(const lot of lots){
    const house=State.structures.find(h=>h.id===lot.houseId);
    const dense=(house?.auto||house?.urbanRedeveloped)&&houseLevel(house)>=3;
    const use=window.ConquerLivestock?.lotKindForHouse(house);
    const surface=dense?'rgba(128,116,103,.36)':use==='goat'?'rgba(155,123,71,.20)':
      use==='shepherd'?'rgba(126,142,78,.18)':use==='cow'?'rgba(141,123,84,.23)':
      use==='garden'?'rgba(117,153,72,.18)':'rgba(167,135,81,.10)';
    pathPolygon(lot.points.map(p=>w2s(p,.015)),surface,null);
  }
  const edges=urbanFenceSegments().slice().sort((a,b)=>viewDepthPoint(a.a)-viewDepthPoint(b.a));
  ctx.save();ctx.lineWidth=Math.max(.65,State.view.scale*.9);
  for(const edge of edges){
    if(edge.material==='wall')drawUrbanWall(edge);
    else if(edge.material==='hedge')drawUrbanHedge(edge);
    else drawUrbanFence(edge);
  }
  ctx.restore();
  if(forestTreeSpritesReady)for(const tree of urbanLotCornerTrees().slice().sort((a,b)=>w2sRaw(a.p,a.z).y-w2sRaw(b.p,b.z).y))drawTree(tree);
}
function urbanHouseGeometry(){
  if(urbanGeometryCache)return urbanGeometryCache;
  return urbanGeometryCache=State.structures.filter(s=>s.type==='house').map(house=>{
    const display=urbanHouseDisplayParts(house),ridges=housePartRidges(house,display);
    const parts=display.map((part,i)=>{
      const bodyH=part.kind==='turret'||part.kind==='outbuilding'?part.bodyH:houseBodyHeight(house);
      return{...part,bodyH,roofH:ridges[i]};
    });
    const points=parts.flatMap(p=>p.points);
    return{house,parts,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
      minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
  });
}
// Facade plan of one house wall, in wall coordinates (off = U along the edge from its midpoint,
// towards edge.b; z = U above the part's ground). Shared by the 2.5D and WebGL2 renderers.
// - windows: one per floor row; long sides of L2+ houses get two per row.
// - beams: L2+ upper floors are medieval timber frame (sill and top plates, corner and window
//   posts, rails around the windows, chevron braces in the blank panels); gable ends add a
//   king post, collar tie and struts.
const HOUSE_WINDOW_HALF_W=.0875,HOUSE_WINDOW_HALF_H=.15,HOUSE_TIMBER_W=.05;
function houseFacadePlan(house,part,edge){
  const level=houseLevel(house),L=dist(edge.a,edge.b),rows=level>=2?[.52,1.34]:[.48];
  const pts=part.points,i=pts.indexOf(edge.a),other=i>=0?dist(pts[(i+1)%pts.length],pts[(i+2)%pts.length]):0;
  const long=level>=2&&L>=1&&L>=other-1e-6;
  const offs=long?[-L/4,L/4]:[0];
  const windows=rows.flatMap(z=>offs.map(off=>({off,z})));
  const beams=[];
  if(level<2)return{windows,beams};
  const wallH=part.bodyH??houseBodyHeight(house),fb=wallH*.5,top=wallH,t=HOUSE_TIMBER_W/2,half=L/2;
  const seg=(o0,z0,o1,z1)=>beams.push([{off:o0,z:z0},{off:o1,z:z1}]);
  seg(-half,fb+t,half,fb+t);seg(-half,top-t,half,top-t);
  const upper=windows.filter(w=>w.z>fb&&w.z<top);
  const flank=HOUSE_WINDOW_HALF_W+HOUSE_TIMBER_W*.9;
  const posts=new Set([-(half-t),half-t]);
  for(const w of upper){posts.add(w.off-flank);posts.add(w.off+flank)}
  if(upper.length>1)posts.add(0);
  const xs=[...posts].filter(x=>x>=-half&&x<=half).sort((a,b)=>a-b);
  for(const x of xs)seg(x,fb+t,x,top-t);
  for(const w of upper){
    const sill=w.z-HOUSE_WINDOW_HALF_H-t,head=w.z+HOUSE_WINDOW_HALF_H+t;
    if(sill>fb+HOUSE_TIMBER_W)seg(w.off-flank,sill,w.off+flank,sill);
    if(head<top-HOUSE_TIMBER_W)seg(w.off-flank,head,w.off+flank,head);
  }
  // Chevron braces in panels without a window, rising towards the wall centre.
  for(let k=0;k<xs.length-1;k++){
    const x0=xs[k],x1=xs[k+1],mid=(x0+x1)/2;
    if(x1-x0<.16||upper.some(w=>Math.abs(w.off-mid)<flank))continue;
    if(mid<0)seg(x0,fb+t*2,x1,top-t*2);else seg(x0,top-t*2,x1,fb+t*2);
  }
  // Gable end: the wall perpendicular to the ridge carries the triangular gable above it.
  const turn=part.roofTurn||0,angle=Number.isFinite(part.roofAngle)?part.roofAngle:(house.angle||0)+turn;
  const ux=(edge.b.x-edge.a.x)/(L||1),uy=(edge.b.y-edge.a.y)/(L||1);
  const ridge=part.roofH;
  if(part.kind!=='turret'&&Number.isFinite(ridge)&&ridge>top+.2&&Math.abs(ux*Math.cos(angle)+uy*Math.sin(angle))<.3){
    const zc=top+(ridge-top)*.42,hc=half*(1-.42)-t;
    seg(0,top,0,ridge-t*2);seg(-hc,zc,hc,zc);
    seg(-half*.62,top+t,-t,top+(ridge-top)*.72);seg(half*.62,top+t,t,top+(ridge-top)*.72);
  }
  return{windows,beams};
}
function urbanRayInterval(a,b,poly){
  let enter=0,exit=1;const sign=urbanArea(poly)>=0?1:-1;
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],dx=q.x-p.x,dy=q.y-p.y;
    const start=sign*(dx*(a.y-p.y)-dy*(a.x-p.x));
    const delta=sign*(dx*(b.y-a.y)-dy*(b.x-a.x));
    if(Math.abs(delta)<1e-9){if(start<0)return null;continue}
    const t=-start/delta;
    if(delta>0)enter=Math.max(enter,t);else exit=Math.min(exit,t);
    if(enter>exit+1e-8)return null;
  }
  return[enter,exit];
}
function urbanHouseLineVisible(source,target){
  const sourceZ=Number.isFinite(source.visualZ)?source.visualZ+.25:(source.h??terrainElevation(source))+.55;
  const targetZ=Number.isFinite(target.visualZ)?target.visualZ:terrainElevation(target)+.55;
  const minX=Math.min(source.x,target.x),maxX=Math.max(source.x,target.x);
  const minY=Math.min(source.y,target.y),maxY=Math.max(source.y,target.y);
  for(const entry of urbanHouseGeometry()){
    if(underConstruction(entry.house)||entry.maxX<minX||entry.minX>maxX||entry.maxY<minY||entry.minY>maxY)continue;
    for(const part of entry.parts){
      const interval=urbanRayInterval(source,target,part.points);if(!interval)continue;
      const [enter,exit]=interval;if(exit<.00001||enter>.99999)continue;
      const tests=[Math.max(.00001,enter),Math.min(.99999,exit),(enter+exit)/2];
      const ground=terrainElevation(part.center);
      // Gabled roofs have piecewise-linear height. Test the ridge crossing
      // as well as interval endpoints, so even a short ray cannot skip a wall.
      const turn=part.roofTurn||0,angle=Number.isFinite(part.roofAngle)?part.roofAngle:(entry.house.angle||0)+turn;
      const localY=p=>-(p.x-part.center.x)*Math.sin(angle)+(p.y-part.center.y)*Math.cos(angle);
      const ya=localY(source),yb=localY(target);
      const ridge=Math.abs(yb-ya)>1e-9?-ya/(yb-ya):-1;
      if(ridge>enter&&ridge<exit)tests.push(ridge);
      for(const t of tests){
        const p={x:source.x+(target.x-source.x)*t,y:source.y+(target.y-source.y)*t};
        const span=Math.abs(turn)>1e-6?part.w:part.h;
        const roof=part.kind==='turret'?part.roofH:part.bodyH+(part.roofH-part.bodyH)*(1-clamp(Math.abs(localY(p))/(span/2),0,1));
        if(sourceZ+(targetZ-sourceZ)*t<=ground+roof+.02)return false;
      }
    }
  }
  return true;
}
function urbanHouseFaces(house,part){
  const base=terrainElevation(part.center),wall=base+part.bodyH,roof=base+part.roofH;
  const vertex=(p,z)=>({p,z}),fp=part.points;
  const faces=[];
  if(part.type==='shed'){
    // Lean-to: single slope, high (roofH) on the plot boundary side, low (bodyH) towards the yard.
    const sa=Math.sin(part.roofAngle),ca=Math.cos(part.roofAngle);
    const top=p=>{const ly=-(p.x-part.center.x)*sa+(p.y-part.center.y)*ca;return base+part.roofH+(part.bodyH-part.roofH)*(ly/part.h+.5)};
    for(let i=0;i<fp.length;i++){
      const a=fp[i],b=fp[(i+1)%fp.length];
      // The courtyard-facing side stays open: this is a lean-to, not a
      // closed storehouse. Livestock is visible through the open bay.
      const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const inner=-(mid.x-part.center.x)*sa+(mid.y-part.center.y)*ca;
      if(inner>part.h*.4)continue;
      faces.push([vertex(a,base),vertex(b,base),vertex(b,top(b)),vertex(a,top(a))]);
    }
    faces.push(fp.map(p=>vertex(p,top(p))));
    return faces;
  }
  for(let i=0;i<fp.length;i++){
    const a=fp[i],b=fp[(i+1)%fp.length];faces.push([vertex(a,base),vertex(b,base),vertex(b,wall),vertex(a,wall)]);
  }
  if(part.kind==='turret'){
    const apex=vertex(part.center,roof);
    for(let i=0;i<fp.length;i++)faces.push([vertex(fp[i],wall),vertex(fp[(i+1)%fp.length],wall),apex]);
  }else{
    const turn=part.roofTurn||0,angle=Number.isFinite(part.roofAngle)?part.roofAngle:(house.angle||0)+turn,ca=Math.cos(angle),sa=Math.sin(angle);
    const rw=Math.abs(turn)>1e-6?part.h:part.w,rh=Math.abs(turn)>1e-6?part.w:part.h;
    const local=(x,y)=>({x:part.center.x+x*ca-y*sa,y:part.center.y+x*sa+y*ca});
    const a=vertex(local(-rw/2,-rh/2),wall),b=vertex(local(rw/2,-rh/2),wall);
    const c=vertex(local(rw/2,rh/2),wall),d=vertex(local(-rw/2,rh/2),wall);
    const r0=vertex(local(-rw/2,0),roof),r1=vertex(local(rw/2,0),roof);
    faces.push([a,b,r1,r0],[d,c,r1,r0],[a,d,r0],[b,c,r1]);
  }
  return faces;
}
function urbanFrontFace(face,depth){
  const out=[];
  for(let i=0;i<face.length;i++){
    const a=face[i],b=face[(i+1)%face.length],da=viewDepthPoint(a.p)-depth,db=viewDepthPoint(b.p)-depth;
    if(da>1e-5)out.push(a);
    if((da<0&&db>0)||(da>0&&db<0)){
      const t=da/(da-db);out.push({p:{x:a.p.x+(b.p.x-a.p.x)*t,y:a.p.y+(b.p.y-a.p.y)*t},z:a.z+(b.z-a.z)*t});
    }
  }
  return out;
}
let urbanProjectionCache={key:null,pieces:[]};
function urbanOcclusionPieces(){
  const v=State.view,key=[urbanRevision,v.x,v.y,v.scale,v.rotation].join('|');
  if(urbanProjectionCache.key===key)return urbanProjectionCache.pieces;
  const pieces=[];
  for(const entry of urbanHouseGeometry()){
    if(underConstruction(entry.house))continue;
    for(const part of entry.parts){
      const faces=urbanHouseFaces(entry.house,part);
      const projected=faces.flat().map(v=>w2sRaw(v.p,v.z));
      pieces.push({faces,buildingKey:part.buildingKey||null,maxDepth:Math.max(...part.points.map(viewDepthPoint)),
        minX:Math.min(...projected.map(p=>p.x)),maxX:Math.max(...projected.map(p=>p.x)),
        minY:Math.min(...projected.map(p=>p.y)),maxY:Math.max(...projected.map(p=>p.y))});
    }
  }
  urbanProjectionCache={key,pieces};return pieces;
}
function withUrbanFigureOcclusion(p,z,drawFn,ignoreBuildingKey=null){
  // At settlement-scale zoom sprites are subpixel; clipping against hundreds
  // of architectural faces costs far more than it contributes visually.
  if(State.view.scale<.48)return drawFn();
  const screen=w2s(p,z),depth=viewDepthPoint(p),r=wrap.getBoundingClientRect();
  const pieces=urbanOcclusionPieces().filter(q=>(ignoreBuildingKey==null||q.buildingKey!==ignoreBuildingKey)&&q.maxDepth>depth&&
    q.minX<screen.x+28&&q.maxX>screen.x-28&&q.minY<screen.y+12&&q.maxY>screen.y-44);
  if(!pieces.length)return drawFn();
  ctx.save();
  try{
    // Separate inverse clips compute a union. One even-odd path containing
    // overlapping houses would cancel their masks and reveal hidden agents.
    for(const piece of pieces)for(const face of piece.faces){
      const front=urbanFrontFace(face,depth);if(front.length<3)continue;
      const poly=front.map(v=>w2sRaw(v.p,v.z));
      ctx.beginPath();ctx.rect(-64,-64,r.width+128,r.height+128);
      ctx.moveTo(poly[0].x,poly[0].y);for(let i=1;i<poly.length;i++)ctx.lineTo(poly[i].x,poly[i].y);
      ctx.closePath();ctx.clip('evenodd');
    }
    return drawFn();
  }finally{ctx.restore()}
}
