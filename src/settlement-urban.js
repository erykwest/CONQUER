'use strict';
// Quadrilateral parcels inscribed in bounded Euclidean Voronoi cells.
// Houses are the sites. A rejected four-corner parcel never spawns a house.
let urbanRevision=0,urbanGeometryCache=null,urbanLotCache=null;
function invalidateUrbanGeometry(){
  urbanRevision++;urbanGeometryCache=null;urbanLotCache=null;
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
  if(isCivic(s))return civicParts(s).map(p=>p.points);
  const points=footprintPoints(s);return points?.length?[points]:[];
}
function urbanParcelAllowed(points,houseId){
  if(!urbanYellowContains(points))return false;
  for(const forest of State.environment){
    if(forest.type==='forest'&&urbanPolygonsOverlap(points,forest.points))return false;
  }
  for(const s of State.structures){
    if(s.id===houseId)continue;
    if(urbanBuildingPolygons(s).some(poly=>urbanPolygonsOverlap(points,poly)))return false;
  }
  return true;
}
function urbanLotsOverlappingBuilding(building){
  const footprints=urbanBuildingPolygons(building);if(!footprints.length)return[];
  return urbanLots().filter(lot=>footprints.some(poly=>urbanPolygonsOverlap(lot.points,poly)));
}
function urbanQuad(cell,house,allowed=null){
  if(cell.length<4)return null;
  const footprint=houseFootprintParts(house).flatMap(p=>p.points);
  let best=null,area=0;
  for(let a=0;a<cell.length-3;a++)for(let b=a+1;b<cell.length-2;b++)
    for(let c=b+1;c<cell.length-1;c++)for(let d=c+1;d<cell.length;d++){
      const quad=[cell[a],cell[b],cell[c],cell[d]],size=Math.abs(urbanArea(quad));
      if(size<=area||!footprint.every(p=>urbanContains(quad,p,.16)))continue;
      best=quad;area=size;
    }
  if(best&&(!allowed||allowed(best)))return best;
  // A small oriented rectangle is also an inscribed quadrilateral, useful for
  // dense legacy settlements whose cell has more than four narrow corners.
  const local=footprint.map(p=>toLocalPoint(house,p)),pad=.20;
  const x0=Math.min(...local.map(p=>p.x))-pad,x1=Math.max(...local.map(p=>p.x))+pad;
  const y0=Math.min(...local.map(p=>p.y))-pad,y1=Math.max(...local.map(p=>p.y))+pad;
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
    cell=urbanClip(cell,nx,ny,q.x*nx+q.y*ny-(Number(road.width)||.62)/2-.12);
    if(cell.length<4)return null;
  }
  const points=urbanQuad(cell,house,points=>urbanParcelAllowed(points,house.id));
  return points?{id:'lot:'+house.id,houseId:house.id,points,height:.38}:null;
}
function urbanHouseFitsLots(candidate){
  const houses=State.structures.filter(s=>s.type==='house'&&s.id!==candidate.id);
  houses.push(candidate);
  if(!urbanLotFor(candidate,houses))return false;
  // A new site must not steal the footprint of an already occupied parcel.
  return houses.every(h=>h.id===candidate.id||dist(h,candidate)>10.2||
    !urbanLotFor(h,State.structures.filter(s=>s.type==='house'))||!!urbanLotFor(h,houses));
}
function urbanLots(){
  if(urbanLotCache)return urbanLotCache;
  const houses=State.structures.filter(s=>s.type==='house'),roads=primaryRoadList();
  return urbanLotCache=houses.map(h=>urbanLotFor(h,houses,roads)).filter(Boolean);
}
function urbanFenceSegments(lots=urbanLots()){
  const raw=[];
  for(const lot of lots){
    const house=State.structures.find(h=>h.id===lot.houseId);
    if(!house)continue;
    const door=houseDoorInfo(house).outside;
    const road=nearestPrimaryRoadProjection(door);
    const goal=road?.point||door;
    let gateEdge=-1,best=Infinity;
    for(let i=0;i<4;i++){
      const a=lot.points[i],b=lot.points[(i+1)%4],q=closestPointOnSegment(goal,a,b),score=dist(q,door)+dist(q,goal);
      if(score<best){best=score;gateEdge=i}
    }
    for(let i=0;i<4;i++){
      const a=lot.points[i],b=lot.points[(i+1)%4],L=dist(a,b);
      if(L<.05)continue;
      if(i!==gateEdge){raw.push({a,b});continue}
      const q=closestPointOnSegment(goal,a,b),t=dist(a,q)/L;
      const half=.48/L,t0=clamp(t-half,0,1),t1=clamp(t+half,0,1);
      const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      if(t0>.01)raw.push({a,b:at(t0)});
      if(t1<.99)raw.push({a:at(t1),b});
    }
  }
  // Union collinear intervals, including partially shared edges and gates.
  const groups=new Map();
  for(const edge of raw){
    let dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy);dx/=L;dy/=L;
    if(dx<-.000001||Math.abs(dx)<.000001&&dy<0){dx=-dx;dy=-dy}
    const nx=-dy,ny=dx,c=edge.a.x*nx+edge.a.y*ny;
    const key=[dx.toFixed(5),dy.toFixed(5),c.toFixed(4)].join(',');
    let group=groups.get(key);
    if(!group){group={dx,dy,nx,ny,c,ranges:[]};groups.set(key,group)}
    const a=edge.a.x*dx+edge.a.y*dy,b=edge.b.x*dx+edge.b.y*dy;
    group.ranges.push([Math.min(a,b),Math.max(a,b)]);
  }
  const out=[];
  for(const g of groups.values()){
    g.ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
    for(const range of g.ranges){
      const last=merged.at(-1);
      if(last&&range[0]<=last[1]+.0001)last[1]=Math.max(last[1],range[1]);else merged.push([...range]);
    }
    const at=t=>({x:g.dx*t+g.nx*g.c,y:g.dy*t+g.ny*g.c});
    for(const [a,b] of merged)out.push({a:at(a),b:at(b)});
  }
  return out;
}
function drawUrbanLots(){
  const lots=urbanLots();
  for(const lot of lots){
    pathPolygon(lot.points.map(p=>w2s(p,.015)),'rgba(167,135,81,.10)',null);
  }
  const edges=urbanFenceSegments(lots).sort((a,b)=>viewDepthPoint(a.a)-viewDepthPoint(b.a));
  ctx.save();ctx.lineWidth=Math.max(.65,State.view.scale*.9);ctx.strokeStyle='#806442';
  for(const {a,b} of edges){
    const L=dist(a,b),count=Math.max(1,Math.ceil(L/.65));
    for(const z of [.13,.30]){
      const p=w2s(a,z),q=w2s(b,z);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    }
    for(let i=0;i<=count;i++){
      const t=i/count,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      const foot=w2s(p,.02),top=w2s(p,.38);
      ctx.beginPath();ctx.moveTo(foot.x,foot.y);ctx.lineTo(top.x,top.y);ctx.stroke();
    }
  }
  ctx.restore();
}
function urbanHouseGeometry(){
  if(urbanGeometryCache)return urbanGeometryCache;
  return urbanGeometryCache=State.structures.filter(s=>s.type==='house').map(house=>{
    const parts=houseFootprintParts(house).map(part=>{
      const bodyH=part.kind==='turret'?part.bodyH:houseBodyHeight(house);
      const roofH=part.kind==='turret'?part.roofH:houseRidgeHeight(house);
      return{...part,bodyH,roofH};
    });
    const points=parts.flatMap(p=>p.points);
    return{house,parts,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
      minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
  });
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
      const turn=part.roofTurn||0,angle=(entry.house.angle||0)+turn;
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
  for(let i=0;i<fp.length;i++){
    const a=fp[i],b=fp[(i+1)%fp.length];faces.push([vertex(a,base),vertex(b,base),vertex(b,wall),vertex(a,wall)]);
  }
  if(part.kind==='turret'){
    const apex=vertex(part.center,roof);
    for(let i=0;i<fp.length;i++)faces.push([vertex(fp[i],wall),vertex(fp[(i+1)%fp.length],wall),apex]);
  }else{
    const turn=part.roofTurn||0,angle=(house.angle||0)+turn,ca=Math.cos(angle),sa=Math.sin(angle);
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
      pieces.push({faces,maxDepth:Math.max(...part.points.map(viewDepthPoint)),
        minX:Math.min(...projected.map(p=>p.x)),maxX:Math.max(...projected.map(p=>p.x)),
        minY:Math.min(...projected.map(p=>p.y)),maxY:Math.max(...projected.map(p=>p.y))});
    }
  }
  urbanProjectionCache={key,pieces};return pieces;
}
function withUrbanFigureOcclusion(p,z,drawFn){
  const screen=w2s(p,z),depth=viewDepthPoint(p),r=wrap.getBoundingClientRect();
  const pieces=urbanOcclusionPieces().filter(q=>q.maxDepth>depth&&
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
