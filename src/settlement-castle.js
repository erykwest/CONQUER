'use strict';
// CONQUER settlement castle module — classic-script shared runtime.
function resize(){
  const r=wrap.getBoundingClientRect(),d=devicePixelRatio||1,w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  canvas.width=w;canvas.height=h;canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';screenCtx.setTransform(d,0,0,d,0,0);
  if(weatherCanvas&&weatherCtx){weatherCanvas.width=w;weatherCanvas.height=h;weatherCanvas.style.width=r.width+'px';weatherCanvas.style.height=r.height+'px';weatherCtx.setTransform(d,0,0,d,0,0)}
  if(weatherCloudLayer)weatherCloudLayer.setAttribute('viewBox','0 0 '+r.width+' '+r.height);
  invalidateSceneCache();draw();clearWeatherOverlay();
}
function rotateViewPoint(p,turns=State.view.rotation||0){
  const q=((turns%4)+4)%4,c=WORLD/2,dx=p.x-c,dy=p.y-c;
  if(q===1)return{x:c-dy,y:c+dx};
  if(q===2)return{x:c-dx,y:c-dy};
  if(q===3)return{x:c+dy,y:c-dx};
  return{x:p.x,y:p.y};
}
function unrotateViewPoint(p,turns=State.view.rotation||0){return rotateViewPoint(p,-turns)}
const reliefBandCache=new Map();
function reliefLevels(){return State.relief?.hills?.flatMap(h=>h.levels||[])||[]}
function clearReliefBandCache(){reliefBandCache.clear()}
function reliefEdgeBands(level){
  if(reliefBandCache.has(level.id))return reliefBandCache.get(level.id);
  const pts=level.top||[];if(pts.length<3)return[];
  const center=level.center||{
    x:pts.reduce((s,p)=>s+p.x,0)/pts.length,
    y:pts.reduce((s,p)=>s+p.y,0)/pts.length
  };
  const kinds=Array.isArray(level.edgeKinds)?level.edgeKinds:[];
  const edges=pts.map((a,i)=>{
    const b=pts[(i+1)%pts.length];
    const kind=kinds[i]==='steep'?'steep':'gentle';
    const width=kind==='steep'?(level.steepBase??.5):(level.gentleBase??2);
    return{a,b,kind,width};
  });
  // Procedural hills are polar/star-shaped. Build the lower edge by moving
  // each shared vertex radially outward. This keeps every slope ring ordered
  // and prevents miter spikes/self-intersections on concave organic outlines.
  const outer=pts.map((vertex,i)=>{
    const prev=edges[(i-1+edges.length)%edges.length],next=edges[i];
    const width=(prev.width+next.width)*.5;
    const vx=vertex.x-center.x,vy=vertex.y-center.y,L=Math.hypot(vx,vy)||1;
    return{x:vertex.x+vx/L*width,y:vertex.y+vy/L*width};
  });
  const bands=edges.map((edge,i)=>{
    const oa=outer[i],ob=outer[(i+1)%outer.length];
    return{levelId:level.id,index:i,kind:edge.kind,width:edge.width,z0:level.z0,z1:level.z1,a:edge.a,b:edge.b,oa,ob,poly:[oa,ob,edge.b,edge.a]};
  });
  reliefBandCache.set(level.id,bands);return bands;
}
function reliefBandAt(p){
  let gentle=null;
  for(const level of reliefLevels())for(const band of reliefEdgeBands(level)){
    if(!pointInPolygon(p,band.poly))continue;
    if(band.kind==='steep')return band;
    gentle=band;
  }
  return gentle;
}
function terrainSlopeKind(p){return reliefBandAt(p)?.kind||null}
function terrainElevation(p){
  let z=0;
  for(const level of reliefLevels()){
    if(pointInPolygon(p,level.top)){z=Math.max(z,level.z1);continue}
    for(const band of reliefEdgeBands(level)){
      if(!pointInPolygon(p,band.poly))continue;
      const dOuter=pointSegmentDistance(p,band.oa,band.ob),dInner=pointSegmentDistance(p,band.a,band.b);
      const t=clamp(dOuter/Math.max(1e-6,dOuter+dInner),0,1);
      z=Math.max(z,band.z0+(band.z1-band.z0)*t);
    }
  }
  return z;
}
function terrainPlateauElevation(p){
  if(terrainSlopeKind(p))return null;
  let z=0;for(const level of reliefLevels())if(pointInPolygon(p,level.top))z=Math.max(z,level.z1);
  return z;
}
function environmentConflictsTestRelief(f){
  if(!State.relief?.hills?.length||f.type==='forest'||f.type==='rough')return false;
  if(['stream','river'].includes(f.type)){
    for(let i=0;i<f.points.length-1;i++){
      const a=f.points[i],b=f.points[i+1],steps=Math.max(3,Math.ceil(dist(a,b)/1.5));
      for(let j=0;j<=steps;j++){const t=j/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(terrainElevation(p)>.05)return true}
    }
    return false;
  }
  if(f.points?.length){
    if(f.points.some(p=>terrainElevation(p)>.05))return true;
    const cx=f.points.reduce((s,p)=>s+p.x,0)/f.points.length,cy=f.points.reduce((s,p)=>s+p.y,0)/f.points.length;
    return terrainElevation({x:cx,y:cy})>.05;
  }
  if(Number.isFinite(f.x)&&Number.isFinite(f.y))return terrainElevation(f)>.05;
  return false;
}
let structureProjectionGroundZ=null;
function w2sRaw(p,z=0){
  const q=rotateViewPoint(p),s=U*State.view.scale;
  return{x:State.view.x+(q.x-q.y)*s*ISO_X,y:State.view.y+(q.x+q.y)*s*ISO_Y-z*s*ISO_Z};
}
function w2s(p,z=0){
  const ground=Number.isFinite(structureProjectionGroundZ)?structureProjectionGroundZ:terrainElevation(p);
  return w2sRaw(p,z+ground);
}
function withProjectionGroundZ(groundZ,drawFn){
  if(!Number.isFinite(groundZ))return drawFn();
  const prev=structureProjectionGroundZ;
  structureProjectionGroundZ=groundZ;
  try{return drawFn()}finally{structureProjectionGroundZ=prev}
}
function s2wAtElevation(x,y,z=0){
  const s=U*State.view.scale||1,a=(x-State.view.x)/(s*ISO_X),b=(y-State.view.y+z*s*ISO_Z)/(s*ISO_Y);
  return unrotateViewPoint({x:(a+b)/2,y:(b-a)/2});
}
function s2w(x,y){
  let p=s2wAtElevation(x,y,0);
  for(let i=0;i<5;i++){
    const next=s2wAtElevation(x,y,terrainElevation(p));
    if(dist(next,p)<.0005){p=next;break}
    p=next;
  }
  return p;
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
  if(s.type==='tower'){
    if(isWoodTower(s))return woodTowerStyle(s)==='watchtower'?2.35:(woodTowerRoof(s)==='pitched'?2.95:2.32);
    const l=structureLevel(s),t=towerTier(s);return [2.35,3.55,4.75][l-1]+(t-1)*.12
  }
  if(s.type==='gate')return isWoodGate(s)?1.94:[2.8,4.0,5.2][structureLevel(s)-1];
  if(s.type==='wall')return [1.15,2.10][structureLevel(s)-1];
  if(s.type==='palisade')return 1.15;
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
  if(['wall','palisade','built'].includes(s.type))return linePoly(s);
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
const STONE_TOWER_BASE_HEIGHT=.50;
const STONE_TOWER_SPLAY_ANGLE=10*Math.PI/180;
const STONE_TOWER_SPLAY_OFFSET=STONE_TOWER_BASE_HEIGHT*Math.tan(STONE_TOWER_SPLAY_ANGLE);

function isStoneTowerStructure(s){
  return !!s&&s.type==='tower'&&!isWoodTower(s);
}
function stoneTowerSplayedFootprint(s){
  if(!isStoneTowerStructure(s))return footprintPoints(s);
  if(s.shape==='round'){
    return circleWorldPoints(s.x,s.y,(Number(s.r)||.5)+STONE_TOWER_SPLAY_OFFSET,24);
  }
  const d=rectDims(s);
  return rectWorldPoints(
    s.x,s.y,
    d.w+STONE_TOWER_SPLAY_OFFSET*2,
    d.h+STONE_TOWER_SPLAY_OFFSET*2,
    s.angle||0
  );
}
function stoneTowerButtressFootprints(s){
  if(!isStoneTowerStructure(s))return[];
  const depth=.16,width=.16,out=[];
  if(s.shape==='round'){
    const r=Number(s.r)||.5;
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,ux=Math.cos(a),uy=Math.sin(a);
      const c={x:s.x+ux*(r+depth/2-.018),y:s.y+uy*(r+depth/2-.018)};
      out.push(rectWorldPoints(c.x,c.y,depth,width,a));
    }
    return out;
  }

  const fp=footprintPoints(s),center={x:s.x,y:s.y};
  for(let i=0;i<fp.length;i++){
    const a=fp[i],b=fp[(i+1)%fp.length],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1;
    const tx=dx/L,ty=dy/L,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    let nx=mid.x-center.x,ny=mid.y-center.y,NL=Math.hypot(nx,ny)||1;nx/=NL;ny/=NL;
    const normalAngle=Math.atan2(ny,nx);
    for(const t of [1/3,2/3]){
      const edge={x:a.x+dx*t,y:a.y+dy*t};
      const c={x:edge.x+nx*(depth/2-.018),y:edge.y+ny*(depth/2-.018)};
      out.push(rectWorldPoints(c.x,c.y,depth,width,normalAngle));
    }
  }
  return out;
}
function structureGroundContactPolygons(s){
  if(isStoneTowerStructure(s)){
    const style=towerBaseStyle(s);
    if(style==='splayed')return[stoneTowerSplayedFootprint(s)];
    if(style==='buttress')return[footprintPoints(s),...stoneTowerButtressFootprints(s)];
  }
  const fp=footprintPoints(s);
  return fp?.length?[fp]:[];
}
function unionGroundContactRings(polys){
  if(!polys?.length)return[];
  if(polys.length===1)return polys;
  const pc=window.__polygonClipping;
  if(!pc)return polys;
  try{
    const geom=pc.union(...polys.map(poly=>[poly.map(p=>[p.x,p.y])]));
    const rings=[];
    for(const polygon of geom||[])for(const ring of polygon||[]){
      const pts=cleanClipRing(ring);
      if(pts.length>=3)rings.push(pts);
    }
    return rings.length?rings:polys;
  }catch(err){
    console.warn('Foundation footprint union failed',err);
    return polys;
  }
}
const PLACEMENT_FOUNDATION_TYPES=new Set(['tower','gate','tavern','church']);
function isPlacementFoundationBuilding(s){
  return !!s&&!s.auto&&PLACEMENT_FOUNDATION_TYPES.has(s.type);
}
function placementFoundationProfile(s){
  if(!isPlacementFoundationBuilding(s))return null;
  const samples=structureTerrainSamples(s);
  if(!samples.length){
    const z=terrainElevation(structureCenter(s));
    return{baseZ:z,minZ:z,maxZ:z,depth:0};
  }
  let minZ=Infinity,maxZ=-Infinity;
  for(const p of samples){
    const z=terrainElevation(p);
    minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  }
  if(!Number.isFinite(minZ)||!Number.isFinite(maxZ))return null;
  return{baseZ:maxZ,minZ,maxZ,depth:Math.max(0,maxZ-minZ)};
}
function placementGroundZ(s){
  if(!isPlacementFoundationBuilding(s))return null;
  if(s.parentTowerId){
    const parent=State.structures.find(o=>o.id===s.parentTowerId);
    if(parent&&isPlacementFoundationBuilding(parent)){
      const pz=placementGroundZ(parent);
      if(Number.isFinite(pz))return pz;
    }
  }
  if(s.foundationVersion===1&&Number.isFinite(s.groundZ))return Number(s.groundZ);
  return placementFoundationProfile(s)?.baseZ??terrainElevation(structureCenter(s));
}
function placementFoundationDepth(s){
  if(!isPlacementFoundationBuilding(s))return 0;
  const baseZ=placementGroundZ(s),samples=structureTerrainSamples(s);
  if(!Number.isFinite(baseZ)||!samples.length)return 0;
  let minZ=baseZ;
  for(const p of samples)minZ=Math.min(minZ,terrainElevation(p));
  return Math.max(0,baseZ-minZ);
}
function usesRaisedPlacementFoundation(s){
  return isPlacementFoundationBuilding(s)&&placementFoundationDepth(s)>.015;
}
function isRaisedPlacementCastlePoint(s){
  return !!s&&['tower','gate'].includes(s.type)&&usesRaisedPlacementFoundation(s)
    &&!(s.type==='tower'&&isWoodTower(s))&&!isWoodGate(s);
}
function withStructureGroundPlane(s,drawFn){
  return withProjectionGroundZ(placementGroundZ(s),drawFn);
}
function drawPlacementFoundation(s,preview=false){
  if(!isPlacementFoundationBuilding(s))return;
  const baseZ=placementGroundZ(s),rings=unionGroundContactRings(structureGroundContactPolygons(s));
  if(!Number.isFinite(baseZ)||!rings.length||placementFoundationDepth(s)<=.015)return;

  const faces=[];
  for(const fp of rings){
    for(let i=0;i<fp.length;i++){
      const a=fp[i],b=fp[(i+1)%fp.length],L=dist(a,b),steps=Math.max(1,Math.ceil(L/.24));
      for(let j=0;j<steps;j++){
        const t0=j/steps,t1=(j+1)/steps;
        const p0={x:a.x+(b.x-a.x)*t0,y:a.y+(b.y-a.y)*t0};
        const p1={x:a.x+(b.x-a.x)*t1,y:a.y+(b.y-a.y)*t1};
        const z0=Math.min(baseZ,terrainElevation(p0)),z1=Math.min(baseZ,terrainElevation(p1));
        if(baseZ-Math.min(z0,z1)<=.01)continue;
        const poly=[w2sRaw(p0,z0),w2sRaw(p1,z1),w2sRaw(p1,baseZ),w2sRaw(p0,baseZ)];
        const q=rotateViewPoint({x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2});
        faces.push({poly,depth:q.x+q.y,shade:castleSideShade(p0,p1)});
      }
    }
  }
  faces.sort((a,b)=>a.depth-b.depth);
  ctx.save();
  if(preview)ctx.globalAlpha*=.62;
  for(const face of faces){
    const fill=preview?'rgba(105,96,85,.82)':face.shade;
    pathPolygon(face.poly,fill,preview?'rgba(244,183,111,.72)':'#83786d',.8);
  }
  ctx.restore();
}
function structureTerrainSamples(s){
  const polys=structureGroundContactPolygons(s);if(!polys.length)return[];
  const out=[];
  for(const fp of polys){
    for(let i=0;i<fp.length;i++){
      const a=fp[i],b=fp[(i+1)%fp.length],L=dist(a,b),steps=Math.max(1,Math.ceil(L/.35));
      for(let j=0;j<=steps;j++){const t=j/steps;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}
    }
    const minX=Math.min(...fp.map(p=>p.x)),maxX=Math.max(...fp.map(p=>p.x)),minY=Math.min(...fp.map(p=>p.y)),maxY=Math.max(...fp.map(p=>p.y));
    for(let y=minY+.25;y<maxY;y+=.5)for(let x=minX+.25;x<maxX;x+=.5)if(pointInPolygon({x,y},fp))out.push({x,y});
  }
  const center=structureCenter(s);if(center)out.push({x:center.x,y:center.y});
  return out;
}
function buildableTerrainElevationForStructure(s){
  const samples=structureTerrainSamples(s);if(!samples.length)return 0;
  let level=null;
  for(const p of samples){
    if(terrainSlopeKind(p))return null;
    const z=terrainPlateauElevation(p);if(z==null)return null;
    if(level==null)level=z;else if(Math.abs(z-level)>.001)return null;
  }
  return level??0;
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
function isCastlePart(s){return !s.auto&&['tower','gate','wall','built'].includes(s.type)&&!(s.type==='tower'&&isWoodTower(s))&&!isWoodGate(s)&&!isRaisedPlacementCastlePoint(s)}
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
const WINTER_SNOW_TOP='#edf1ed';
const WINTER_SNOW_A='#e7ece8';
const WINTER_SNOW_B='#dce3de';
const WINTER_SNOW_STROKE='rgba(112,124,116,.58)';
function winterSnowColor(normal,snow=WINTER_SNOW_TOP){return State.season==='winter'?snow:normal}
function drawExposedTop(multi,z){
  if(!multi?.length)return;
  fillMultiPolygonTop(multi,z,winterSnowColor('#9a8e82',WINTER_SNOW_TOP),State.season==='winter'?WINTER_SNOW_STROKE:'#635951');
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
  const hoardingFrame=State.structures.some(s=>isCastlePart(s)&&!underConstruction(s)&&s.type==='wall'&&wallSkin(s)==='hoarding')
    ?buildBattlementOcclusionFrame():null;
  for(const s of State.structures){
    if(!isCastlePart(s)||underConstruction(s))continue;
    if(s.type==='built'){
      drawBuiltDetails(s,false);
      if(builtSkin(s)==='arcade')drawBuiltArcade(s);
    }
    if(s.type==='wall'&&wallSkin(s)==='hoarding')drawWallHoarding(s,hoardingFrame);
    if(s.type==='tower'&&isStoneTowerStructure(s)){
      withStructureGroundPlane(s,()=>drawStoneTowerBase(s,false));
    }
    if(['tower','gate'].includes(s.type)){
      const h=structureHeight(s),a=w2s({x:s.x,y:s.y},h+.03),q={x:s.x+Math.cos(s.angle||0)*.55,y:s.y+Math.sin(s.angle||0)*.55},b=w2s(q,h+.03);
      ctx.save();ctx.strokeStyle='rgba(245,226,202,.48)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
    }
  }
}
function drawCastleSelection(){
  const s=selectedStructure();if(!s||(!isCastlePart(s)&&!isRaisedPlacementCastlePoint(s))||underConstruction(s))return;
  withStructureGroundPlane(s,()=>{
    const pts=projectPath(footprintPoints(s),structureHeight(s));if(pts.length<3)return;
    ctx.save();ctx.strokeStyle='#f4b76f';ctx.lineWidth=2;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.restore();
  });
}

function worldDepth(s){const p=rotateViewPoint(structureCenter(s));return p.x+p.y;}
function pointInScreenPolygon(p,poly){
  let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j],hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside;
  }return inside;
}
function screenHitStructureBody(s,p){
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
function screenHitStructure(s,p){
  return isPlacementFoundationBuilding(s)
    ?withStructureGroundPlane(s,()=>screenHitStructureBody(s,p))
    :screenHitStructureBody(s,p);
}
function seedRand(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296}}
function mixWorld(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function clipTerrainPolygon(vertices){
  let out=vertices.map(v=>({x:v.x,y:v.y,z:v.z||0}));
  const cuts=[
    {inside:v=>v.x>=0,intersect:(a,b)=>{const t=(0-a.x)/((b.x-a.x)||1e-9);return{x:0,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}}},
    {inside:v=>v.x<=WORLD,intersect:(a,b)=>{const t=(WORLD-a.x)/((b.x-a.x)||1e-9);return{x:WORLD,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}}},
    {inside:v=>v.y>=0,intersect:(a,b)=>{const t=(0-a.y)/((b.y-a.y)||1e-9);return{x:a.x+(b.x-a.x)*t,y:0,z:a.z+(b.z-a.z)*t}}},
    {inside:v=>v.y<=WORLD,intersect:(a,b)=>{const t=(WORLD-a.y)/((b.y-a.y)||1e-9);return{x:a.x+(b.x-a.x)*t,y:WORLD,z:a.z+(b.z-a.z)*t}}}
  ];
  for(const cut of cuts){
    if(!out.length)break;
    const next=[];
    for(let i=0;i<out.length;i++){
      const a=out[i],b=out[(i+1)%out.length],ain=cut.inside(a),bin=cut.inside(b);
      if(ain&&bin)next.push(b);
      else if(ain&&!bin)next.push(cut.intersect(a,b));
      else if(!ain&&bin){next.push(cut.intersect(a,b));next.push(b)}
    }
    out=next;
  }
  return out;
}
function projectClippedTerrain(vertices){
  return clipTerrainPolygon(vertices).map(v=>w2sRaw(v,v.z));
}
function slopePoint(band,u,v){
  const outer=mixWorld(band.oa,band.ob,u),inner=mixWorld(band.a,band.b,u);
  return mixWorld(outer,inner,v);
}
const LANDSCAPE_RENDER_BUDGET=Object.freeze({
  terrainMarks:120,
  rockDensity:2.35,
  rockCrestDensity:.95,
  forestDensity:.95,
  forestMin:14,
  forestMax:40,
  flowerClusters:520
});
let landscapeRenderCacheSeed=null;
const steepRockLayoutCache=new Map();
const forestTreeLayoutCache=new Map();
const forestGroundLayoutCache=new Map();
let terrainMarkLayoutCache=null;
let springFlowerLayoutCache=null;
const springFlowerSprites=new Map();
const steepSlopePatternCanvases={};
const steepSlopePatternsByContext=new WeakMap();
function getSteepSlopePattern(winter=false){
  const key=winter?'winter':'gray';
  if(!steepSlopePatternCanvases[key]){
    const off=document.createElement('canvas');off.width=72;off.height=72;
    const p=off.getContext('2d'),rnd=seedRand(winter?0x4d7b91c3:0x6b6f7377);
    p.clearRect(0,0,72,72);
    for(let i=0;i<70;i++){
      const x=rnd()*72,y=rnd()*72,rx=.7+rnd()*3.8,ry=.35+rnd()*1.8;
      p.fillStyle=winter
        ?(rnd()>.5?'rgba(255,255,255,.12)':'rgba(102,111,116,.13)')
        :(rnd()>.5?'rgba(180,185,185,.11)':'rgba(32,36,38,.14)');
      p.beginPath();p.ellipse(x,y,rx,ry,rnd()*Math.PI,0,Math.PI*2);p.fill();
    }
    for(let i=0;i<16;i++){
      const x=rnd()*72,y=rnd()*72,L=5+rnd()*12,a=rnd()*Math.PI;
      p.strokeStyle=winter?'rgba(112,121,125,.10)':'rgba(215,218,216,.08)';
      p.lineWidth=.5+rnd()*.65;
      p.beginPath();p.moveTo(x,y);p.lineTo(x+Math.cos(a)*L,y+Math.sin(a)*L*.55);p.stroke();
    }
    steepSlopePatternCanvases[key]=off;
  }
  let patterns=steepSlopePatternsByContext.get(ctx);
  if(!patterns){patterns={};steepSlopePatternsByContext.set(ctx,patterns)}
  if(!patterns[key])patterns[key]=ctx.createPattern(steepSlopePatternCanvases[key],'repeat');
  return patterns[key];
}
function drawSteepSlopeSurface(poly,winter=false){
  if(!poly?.length)return;
  const base=winter?'#969ca0':'#6f7477';
  pathPolygon(poly,base,winter?'rgba(205,211,214,.55)':'rgba(190,196,197,.32)',.8);
  const pattern=getSteepSlopePattern(winter);if(!pattern)return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of poly){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
  ctx.save();
  ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  ctx.globalAlpha=winter?.72:.82;
  ctx.fillStyle=pattern;ctx.fillRect(minX-2,minY-2,maxX-minX+4,maxY-minY+4);
  ctx.restore();
}
function ensureLandscapeRenderCaches(){
  if(landscapeRenderCacheSeed===State.seed)return;
  landscapeRenderCacheSeed=State.seed;
  steepRockLayoutCache.clear();
  forestTreeLayoutCache.clear();
  forestGroundLayoutCache.clear();
  terrainMarkLayoutCache=null;
  springFlowerLayoutCache=null;
}
function staticCullOverscan(){return ctx!==screenCtx?STATIC_CACHE_OVERSCAN:0}
function screenPointVisibleRaw(p,z=0,pad=72){
  const q=w2sRaw(p,z),r=wrap.getBoundingClientRect(),extra=staticCullOverscan(),m=pad+extra;
  return q.x>=-m&&q.y>=-m&&q.x<=r.width+m&&q.y<=r.height+m;
}
function screenPolygonVisible(poly,pad=72){
  if(!poly?.length)return false;
  const r=wrap.getBoundingClientRect(),m=pad+staticCullOverscan();
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of poly){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
  return maxX>=-m&&maxY>=-m&&minX<=r.width+m&&minY<=r.height+m;
}
function terrainBandScreenPolygon(band){
  return[
    w2sRaw(band.oa,band.z0),w2sRaw(band.ob,band.z0),
    w2sRaw(band.b,band.z1),w2sRaw(band.a,band.z1)
  ];
}
function landscapeDetailTier(){
  const s=State.view.scale;
  if(s<.30)return 0;
  if(s<.58)return 1;
  return 2;
}
function drawGentleSlopeBand(band,winter){
  const preview=terrainBandScreenPolygon(band);
  if(!screenPolygonVisible(preview,96))return;
  const strips=landscapeDetailTier()===0?2:3;
  const fills=winter
    ?['#d6dbd7','#cfd5d0','#d9deda','#ccd2cd']
    :['#454430','#4b4934','#474631','#514e37'];
  for(let i=0;i<strips;i++){
    const v0=i/strips,v1=(i+1)/strips;
    const a0=slopePoint(band,0,v0),b0=slopePoint(band,1,v0),b1=slopePoint(band,1,v1),a1=slopePoint(band,0,v1);
    const z0=band.z0+(band.z1-band.z0)*v0,z1=band.z0+(band.z1-band.z0)*v1;
    const poly=projectClippedTerrain([{...a0,z:z0},{...b0,z:z0},{...b1,z:z1},{...a1,z:z1}]);
    if(poly.length>=3)pathPolygon(poly,fills[i%fills.length],null);
    if(i>0&&a0.x>=0&&a0.x<=WORLD&&a0.y>=0&&a0.y<=WORLD&&b0.x>=0&&b0.x<=WORLD&&b0.y>=0&&b0.y<=WORLD){
      const seamA=w2sRaw(a0,z0+.008),seamB=w2sRaw(b0,z0+.008);
      ctx.save();ctx.strokeStyle=winter?'rgba(116,124,119,.24)':'rgba(173,156,103,.20)';ctx.lineWidth=.75;
      ctx.beginPath();ctx.moveTo(seamA.x,seamA.y);ctx.lineTo(seamB.x,seamB.y);ctx.stroke();ctx.restore();
    }
  }
}
function drawLowPolyRock(p,z,size,height,seed,winter=false){
  if(!screenPointVisibleRaw(p,z,36))return;
  const tier=landscapeDetailTier(),rnd=seedRand(seed>>>0);
  const sidePalette=winter?['#8b9092','#9ca1a2','#777d80','#a8acad']:['#5e6263','#727677','#505455','#838787'];
  const topPalette=winter?['#b4b8b9','#a8adae','#c0c3c4']:['#8a8e8d','#989b99','#777b7a'];

  if(tier===0){
    const base=w2sRaw(p,z+.01),top=w2sRaw(p,z+height*.75),px=Math.max(1.25,size*U*State.view.scale*.78);
    pathPolygon([
      {x:base.x-px,y:base.y+.35*px},
      {x:base.x+px,y:base.y+.35*px},
      {x:top.x+px*.42,y:top.y},
      {x:top.x-px*.38,y:top.y-px*.12}
    ],sidePalette[seed%sidePalette.length],null);
    return;
  }

  const n=tier===1?4:5+Math.floor(rnd()*2),rot=rnd()*Math.PI*2,base=[],top=[];
  const sx=size*(.72+rnd()*.42),sy=size*(.55+rnd()*.36);
  for(let i=0;i<n;i++){
    const a=rot+i/n*Math.PI*2+(rnd()-.5)*.16,rr=.74+rnd()*.28;
    const q={x:p.x+Math.cos(a)*sx*rr,y:p.y+Math.sin(a)*sy*rr};
    const bz=z+.012,shrink=.46+rnd()*.18;
    base.push({p:q,z:bz});
    top.push({p:{x:p.x+(q.x-p.x)*shrink,y:p.y+(q.y-p.y)*shrink},z:bz+height*(.76+rnd()*.22)});
  }
  const faces=[];
  for(let i=0;i<n;i++){
    const j=(i+1)%n,quad=[w2sRaw(base[i].p,base[i].z),w2sRaw(base[j].p,base[j].z),w2sRaw(top[j].p,top[j].z),w2sRaw(top[i].p,top[i].z)];
    faces.push({poly:quad,depth:(quad[0].y+quad[1].y)/2,fill:sidePalette[(i+Math.floor(rnd()*sidePalette.length))%sidePalette.length]});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  const visibleFaces=tier===1?faces.slice(-3):faces;
  for(const face of visibleFaces)pathPolygon(face.poly,face.fill,null);
  const topPoly=top.map(q=>w2sRaw(q.p,q.z));
  if(topPoly.length>=3)pathPolygon(topPoly,topPalette[Math.floor(rnd()*topPalette.length)],null);
}
function steepSlopeRockLayout(level,band){
  ensureLandscapeRenderCaches();
  const key=level.id+':'+band.index;
  if(steepRockLayoutCache.has(key))return steepRockLayoutCache.get(key);
  const edgeLength=dist(band.a,band.b),rnd=seedRand((State.seed^Math.imul(level.z1*131+band.index+17,2654435761))>>>0);
  const count=Math.max(4,Math.round(edgeLength*LANDSCAPE_RENDER_BUDGET.rockDensity));
  const crestCount=Math.max(2,Math.round(edgeLength*LANDSCAPE_RENDER_BUDGET.rockCrestDensity));
  const rocks=[];
  for(let i=0;i<count;i++){
    const u=clamp((i+rnd()*.82)/count,.025,.975),v=Math.pow(rnd(),1.68);
    const p=slopePoint(band,u,v),z=band.z0+(band.z1-band.z0)*v;
    if(p.x>=0&&p.x<=WORLD&&p.y>=0&&p.y<=WORLD)rocks.push({p,z,size:.20+rnd()*.36,height:.14+rnd()*.42,seed:Math.floor(rnd()*0xffffffff)});
  }
  for(let i=0;i<crestCount;i++){
    const u=clamp((i+.18+rnd()*.64)/crestCount,.02,.98),v=.76+rnd()*.22;
    const p=slopePoint(band,u,v),z=band.z0+(band.z1-band.z0)*v;
    if(p.x>=0&&p.x<=WORLD&&p.y>=0&&p.y<=WORLD)rocks.push({p,z,size:.18+rnd()*.28,height:.12+rnd()*.30,seed:Math.floor(rnd()*0xffffffff)});
  }
  steepRockLayoutCache.set(key,rocks);
  return rocks;
}
function drawSteepSlopeRocks(level,band,winter){
  const tier=landscapeDetailTier(),rocks=steepSlopeRockLayout(level,band)
    .filter((_,i)=>tier===0?i%2===0:true)
    .map(r=>({...r,depth:w2sRaw(r.p,r.z).y}))
    .sort((a,b)=>a.depth-b.depth);
  if(window.__conquerPerf)window.__conquerPerf.landscapeRocks=(window.__conquerPerf.landscapeRocks||0)+rocks.length;
  for(const rock of rocks)drawLowPolyRock(rock.p,rock.z,rock.size,rock.height,rock.seed,winter);
}
function drawRelief(){
  ensureLandscapeRenderCaches();
  const winter=State.season==='winter',baseFill=winter?'#edf1ed':(BIOMES[State.biome]?.field||'#24291b');
  const levels=reliefLevels().slice().sort((a,b)=>a.z1-b.z1);
  let bandsDrawn=0;
  if(window.__conquerPerf)window.__conquerPerf.landscapeRocks=0;
  for(const level of levels){
    const bands=reliefEdgeBands(level).map(b=>({...b,depth:[b.oa,b.ob,b.b,b.a].map(p=>w2sRaw(p,b.z0)).reduce((s,p)=>s+p.y,0)/4})).sort((a,b)=>a.depth-b.depth);
    for(const band of bands){
      if(!screenPolygonVisible(terrainBandScreenPolygon(band),96))continue;
      bandsDrawn++;
      if(band.kind==='gentle')drawGentleSlopeBand(band,winter);
      else{
        const poly=projectClippedTerrain([
          {...band.oa,z:band.z0},{...band.ob,z:band.z0},{...band.b,z:band.z1},{...band.a,z:band.z1}
        ]);
        if(poly.length>=3)drawSteepSlopeSurface(poly,winter);
        drawSteepSlopeRocks(level,band,winter);
      }
    }
    const top=projectClippedTerrain(level.top.map(p=>({...p,z:level.z1})));
    if(top.length>=3&&screenPolygonVisible(top,96))pathPolygon(top,baseFill,winter?'rgba(118,128,121,.40)':'rgba(203,190,148,.22)',1.05);
  }
  if(window.__conquerPerf)window.__conquerPerf.reliefBandsDrawn=bandsDrawn;
}
const SPRING_FLOWER_PALETTE=['#f7d7e8','#f3e37b','#f4f1dc','#d9b3ef','#e7a6b8'];
function terrainMarkLayout(){
  ensureLandscapeRenderCaches();
  if(terrainMarkLayoutCache)return terrainMarkLayoutCache;
  const rnd=seedRand((State.seed^0x45d9f3b)>>>0),marks=[];
  for(let i=0;i<LANDSCAPE_RENDER_BUDGET.terrainMarks;i++){
    const p={x:rnd()*WORLD,y:rnd()*WORLD};
    marks.push({p,z:terrainElevation(p),r:.5+rnd()*1.7,light:rnd()>.55});
  }
  terrainMarkLayoutCache=marks;
  return marks;
}
function flowerClusterClearOfSteep(center,radius){
  const steps=[-1,-.5,0,.5,1];
  for(const gx of steps)for(const gy of steps){
    if(gx*gx+gy*gy>1.01)continue;
    const p={x:center.x+gx*radius,y:center.y+gy*radius};
    if(p.x<0||p.x>WORLD||p.y<0||p.y>WORLD||terrainSlopeKind(p)==='steep')return false;
  }
  return true;
}
function springFlowerLayout(){
  ensureLandscapeRenderCaches();
  if(springFlowerLayoutCache)return springFlowerLayoutCache;
  const rnd=seedRand((State.seed^0x6b8f4a2d)>>>0),clusters=[];
  let attempts=0;
  while(clusters.length<LANDSCAPE_RENDER_BUDGET.flowerClusters&&attempts<LANDSCAPE_RENDER_BUDGET.flowerClusters*8){
    attempts++;
    const radius=.65+rnd()*.95;
    const center={x:radius+rnd()*(WORLD-radius*2),y:radius+rnd()*(WORLD-radius*2)};
    if(!flowerClusterClearOfSteep(center,radius))continue;
    clusters.push({
      center,radius,z:terrainElevation(center),
      colorIndex:Math.floor(rnd()*SPRING_FLOWER_PALETTE.length),
      variant:Math.floor(rnd()*4)
    });
  }
  springFlowerLayoutCache=clusters;
  return clusters;
}
function springFlowerSprite(colorIndex,variant){
  const key=colorIndex+':'+variant;
  if(springFlowerSprites.has(key))return springFlowerSprites.get(key);
  const off=document.createElement('canvas');off.width=64;off.height=64;
  const p=off.getContext('2d'),rnd=seedRand((0x71ab39d5^Math.imul(colorIndex+1,131)^Math.imul(variant+1,977))>>>0);
  p.fillStyle=SPRING_FLOWER_PALETTE[colorIndex];
  for(let i=0;i<100;i++){
    const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*27,x=32+Math.cos(a)*r,y=32+Math.sin(a)*r,size=.8+rnd()*1.45;
    p.globalAlpha=.58+rnd()*.36;p.fillRect(Math.round(x),Math.round(y),size,size);
  }
  p.globalAlpha=1;springFlowerSprites.set(key,off);return off;
}
function drawSpringFlowerClusters(){
  const clusters=springFlowerLayout(),tier=landscapeDetailTier();
  let drawn=0;
  ctx.save();
  for(let i=0;i<clusters.length;i++){
    if(tier===0&&i%5===4)continue;
    const cluster=clusters[i];
    if(!screenPointVisibleRaw(cluster.center,cluster.z,32))continue;
    const p=w2sRaw(cluster.center,cluster.z+.015);
    const w=Math.max(5,cluster.radius*U*State.view.scale*2.2);
    const h=Math.max(3.5,cluster.radius*U*State.view.scale*1.25);
    ctx.globalAlpha=.88;
    ctx.drawImage(springFlowerSprite(cluster.colorIndex,cluster.variant),p.x-w/2,p.y-h/2,w,h);
    drawn++;
  }
  ctx.restore();
  if(window.__conquerPerf)window.__conquerPerf.springFlowerClusters=drawn;
}
function drawTerrain(){
  const corners=projectPath([{x:0,y:0},{x:WORLD,y:0},{x:WORLD,y:WORLD},{x:0,y:WORLD}],0);
  const winter=State.season==='winter';
  const terrainFill=winter?'#edf1ed':(BIOMES[State.biome]?.field||'#24291b');
  const terrainEdge=winter?'rgba(101,112,105,.34)':'rgba(225,214,190,.12)';
  pathPolygon(corners,terrainFill,terrainEdge,1);
  drawRelief();
  ctx.save();
  for(const mark of terrainMarkLayout()){
    if(!screenPointVisibleRaw(mark.p,mark.z,12))continue;
    const p=w2sRaw(mark.p,mark.z),r=mark.r*Math.max(.45,State.view.scale);
    ctx.fillStyle=winter
      ?(mark.light?'rgba(173,183,177,.14)':'rgba(255,255,255,.22)')
      :(mark.light?'rgba(84,105,55,.12)':'rgba(137,120,70,.08)');
    ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.7,r,0,0,Math.PI*2);ctx.fill();
  }
  if(State.season==='spring')drawSpringFlowerClusters();
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
const FOREST_TREE_ASSETS=[
  './src/assets/forest/tree_01_tonda.svg',
  './src/assets/forest/tree_02_affusolata.svg',
  './src/assets/forest/tree_03_conica.svg',
  './src/assets/forest/tree_04_ombrello.svg',
  './src/assets/forest/tree_05_goccia.svg',
  './src/assets/forest/tree_06_stratificata.svg',
  './src/assets/forest/tree_07_asimmetrica.svg'
];
const FOREST_CANOPY_PALETTES={
  summer:['#355f2f','#3f6b35','#49783b','#557f43','#628b4c'],
  autumn:['#65452d','#754c2b','#85552d','#965f31','#a76b36']
};
const forestTreeSprites={summer:[],autumn:[],winter:[]};
let forestTreeSpritesReady=false;
function buildForestSvg(source,canopyColor=null,canopyVisible=true){
  if(!canopyVisible)return source.replace(/fill="#3B5174"/gi,'fill="#3B5174" fill-opacity="0"');
  return source.replace(/fill="#3B5174"/gi,`fill="${canopyColor}" fill-opacity="0.8"`);
}
async function loadForestTreeSprites(){
  try{
    const sources=await Promise.all(FOREST_TREE_ASSETS.map(path=>fetch(path).then(r=>{
      if(!r.ok)throw new Error('Forest SVG '+r.status+' '+path);
      return r.text();
    })));
    const jobs=[];
    const makeSprite=(season,shape,colorIndex,svg)=>{
      const img=new Image();
      if(!forestTreeSprites[season][shape])forestTreeSprites[season][shape]=[];
      forestTreeSprites[season][shape][colorIndex]=img;
      jobs.push(new Promise((resolve,reject)=>{
        img.onload=resolve;
        img.onerror=reject;
        img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
      }));
    };
    for(let shape=0;shape<sources.length;shape++){
      for(const season of ['summer','autumn']){
        const palette=FOREST_CANOPY_PALETTES[season];
        for(let color=0;color<palette.length;color++){
          makeSprite(season,shape,color,buildForestSvg(sources[shape],palette[color],true));
        }
      }
      makeSprite('winter',shape,0,buildForestSvg(sources[shape],null,false));
    }
    await Promise.all(jobs);
    forestTreeSpritesReady=true;
    invalidateSceneCache('landscape');
    if(typeof draw==='function')draw();
  }catch(err){
    console.warn('Forest SVG load failed',err);
  }
}
loadForestTreeSprites();

function drawTree(tree){
  if(!forestTreeSpritesReady||!screenPointVisibleRaw(tree.p,tree.z||0,44))return false;
  const season=State.season==='autumn'?'autumn':State.season==='winter'?'winter':'summer';
  const colorIndex=season==='winter'?0:tree.colorIndex;
  const img=forestTreeSprites[season]?.[tree.shapeIndex]?.[colorIndex];
  if(!img)return false;
  const base=w2sRaw(tree.p,tree.z||0);
  const size=Math.max(10,U*State.view.scale*2.25*tree.scale);
  ctx.save();
  if(tree.flip){
    ctx.translate(base.x,0);
    ctx.scale(-1,1);
    ctx.drawImage(img,-size*.5,base.y-size*.94,size,size);
  }else{
    ctx.drawImage(img,base.x-size*.5,base.y-size*.94,size,size);
  }
  ctx.restore();return true;
}
const forestGroundPatternCanvases={};
const forestGroundPatternsByContext=new WeakMap();
function getForestGroundPattern(){
  const key=State.season==='winter'?'winter':'green';
  if(!forestGroundPatternCanvases[key]){
    const off=document.createElement('canvas');
    off.width=72;off.height=72;
    const p=off.getContext('2d');
    const winter=key==='winter';
    p.fillStyle=winter?'#dfe5e0':'#1d3218';
    p.fillRect(0,0,72,72);
    const rnd=seedRand(winter?0x72a4c8e1:0x4f6a3b21);
    for(let i=0;i<110;i++){
      const x=rnd()*72,y=rnd()*72,rx=1.5+rnd()*5.5,ry=.8+rnd()*3.2;
      p.fillStyle=winter
        ?(rnd()>.52?'rgba(255,255,255,.25)':'rgba(153,164,157,.16)')
        :(rnd()>.52?'rgba(53,88,39,.30)':'rgba(10,25,10,.24)');
      p.beginPath();p.ellipse(x,y,rx,ry,rnd()*Math.PI,0,Math.PI*2);p.fill();
    }
    for(let i=0;i<90;i++){
      const x=rnd()*72,y=rnd()*72,r=.35+rnd()*.85;
      p.fillStyle=winter
        ?(rnd()>.5?'rgba(255,255,255,.28)':'rgba(125,138,130,.14)')
        :(rnd()>.5?'rgba(98,124,69,.13)':'rgba(6,17,7,.20)');
      p.beginPath();p.arc(x,y,r,0,Math.PI*2);p.fill();
    }
    forestGroundPatternCanvases[key]=off;
  }
  let patterns=forestGroundPatternsByContext.get(ctx);
  if(!patterns){patterns={};forestGroundPatternsByContext.set(ctx,patterns)}
  if(!patterns[key])patterns[key]=ctx.createPattern(forestGroundPatternCanvases[key],'repeat');
  return patterns[key];
}
function forestGroundLayout(f){
  ensureLandscapeRenderCaches();
  if(forestGroundLayoutCache.has(f.id))return forestGroundLayoutCache.get(f.id);
  const pts=(f.points||[]).map(p=>({x:p.x,y:p.y,z:terrainElevation(p)}));
  forestGroundLayoutCache.set(f.id,pts);return pts;
}
function drawForestGround(f){
  const layout=forestGroundLayout(f),pts=layout.map(p=>w2sRaw(p,p.z));
  if(!pts.length||!screenPolygonVisible(pts,72))return;
  ctx.save();
  const world=[
    w2sRaw({x:0,y:0},terrainElevation({x:0,y:0})),
    w2sRaw({x:WORLD,y:0},terrainElevation({x:WORLD,y:0})),
    w2sRaw({x:WORLD,y:WORLD},terrainElevation({x:WORLD,y:WORLD})),
    w2sRaw({x:0,y:WORLD},terrainElevation({x:0,y:WORLD}))
  ];
  ctx.beginPath();
  world.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.closePath();
  ctx.fillStyle=getForestGroundPattern()||(State.season==='winter'?'#dfe5e0':'#1d3218');
  ctx.fill();
  ctx.strokeStyle=State.season==='winter'?'rgba(126,139,130,.45)':'rgba(82,116,59,.58)';
  ctx.lineWidth=1.15;
  ctx.stroke();
  ctx.restore();
}
function forestTreeCount(f){
  return clamp(Math.round((f.rx||5)*(f.ry||4)*LANDSCAPE_RENDER_BUDGET.forestDensity),LANDSCAPE_RENDER_BUDGET.forestMin,LANDSCAPE_RENDER_BUDGET.forestMax);
}
function forestTreeLayout(f){
  ensureLandscapeRenderCaches();
  if(forestTreeLayoutCache.has(f.id))return forestTreeLayoutCache.get(f.id);
  const rnd=seedRand((State.seed^biomeHash(f.id))>>>0),trees=[],target=forestTreeCount(f);
  let attempts=0;
  while(trees.length<target&&attempts<target*12){
    attempts++;
    const p={x:f.x+(rnd()-.5)*f.rx*1.9,y:f.y+(rnd()-.5)*f.ry*1.9};
    if(p.x<0||p.x>WORLD||p.y<0||p.y>WORLD||!environmentContains(f,p))continue;
    trees.push({
      p,z:terrainElevation(p),
      shapeIndex:Math.floor(rnd()*FOREST_TREE_ASSETS.length),
      colorIndex:Math.floor(rnd()*FOREST_CANOPY_PALETTES.summer.length),
      flip:rnd()<.5,
      scale:.8+rnd()*.4
    });
  }
  forestTreeLayoutCache.set(f.id,trees);return trees;
}
function forestLikelyVisible(f,pad=100){
  const p={x:Number(f.x)||0,y:Number(f.y)||0},z=terrainElevation(p),s=w2sRaw(p,z),r=wrap.getBoundingClientRect();
  const extent=Math.max(f.rx||5,f.ry||4)*U*State.view.scale*1.55+pad+staticCullOverscan();
  return s.x>=-extent&&s.y>=-extent&&s.x<=r.width+extent&&s.y<=r.height+extent;
}
function drawForestMask(f){
  if(!forestLikelyVisible(f))return;
  const tier=landscapeDetailTier();
  const trees=forestTreeLayout(f)
    .filter((_,i)=>tier===0?i%2===0:tier===1?i%4!==3:true)
    .filter(tree=>screenPointVisibleRaw(tree.p,tree.z,50))
    .slice()
    .sort((a,b)=>w2sRaw(a.p,a.z).y-w2sRaw(b.p,b.z).y);
  let drawn=0;
  for(const tree of trees)if(drawTree(tree))drawn++;
  if(window.__conquerPerf)window.__conquerPerf.forestTrees=(window.__conquerPerf.forestTrees||0)+drawn;
}

function ellipseWorldPoints(f,n=28){
  const pts=[],ca=Math.cos(f.angle||0),sa=Math.sin(f.angle||0);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=Math.cos(a)*f.rx,y=Math.sin(a)*f.ry;pts.push({x:f.x+x*ca-y*sa,y:f.y+x*sa+y*ca})}
  return pts;
}
function drawEnvironment(){
  if(window.__conquerPerf)window.__conquerPerf.forestTrees=0;
  for(const f of State.environment){
    ctx.save();
    if(['stream','river'].includes(f.type)){
      const pts=f.points.map(p=>w2s(p));ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
      ctx.strokeStyle=f.edge;ctx.lineWidth=Math.max(2,(f.width+.35)*U*State.view.scale*.72);ctx.stroke();ctx.strokeStyle=f.fill;ctx.lineWidth=Math.max(1.4,f.width*U*State.view.scale*.72);ctx.stroke();
    }else if(['forest','pond','sea'].includes(f.type)){
      if(f.type==='forest'){
        if(!forestLikelyVisible(f)){ctx.restore();continue}
        drawForestGround(f);
        drawForestMask(f);
      }else{
        const pts=projectPath(f.points);pathPolygon(pts,f.fill,f.edge,1.2);
      }
      if(f.type==='sea'&&f.coastline){
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
function placementAngle(center,p){return snapStructureAngle(Math.atan2(p.y-center.y,p.x-center.x))}
function orientedToolSpec(){
  if(State.tool.kind==='tower'&&State.tool.shape==='square')return{type:'tower',shape:'square',size:State.tool.size,level:State.tool.level||State.buildLevels.tower,material:State.tool.material||'stone',woodStyle:State.tool.woodStyle,woodRoof:State.tool.woodRoof,functions:[]};
  if(State.tool.kind==='gate'){
    if(State.tool.material==='wood')return{type:'gate',shape:'square',material:'wood',size:1.5,w:1,h:1.5,level:1,roofStyle:'flat',functions:[]};
    return{type:'gate',shape:'square',material:'stone',size:1.5,level:State.tool.level||State.buildLevels.gate,functions:[]};
  }
  // Future point-buildings can pass a placementSpec without adding another interaction path.
  if(State.tool.placementSpec&&State.tool.placementSpec.shape!=='round')return{...State.tool.placementSpec};
  return null;
}
function makePlacementPreview(q,angle=0){
  const spec=orientedToolSpec(),snapped=snapStructureAngle(angle),rotationStep=structureRotationStep(snapped);
  if(spec)return{...spec,x:q.x,y:q.y,angle:snapped,rotationStep,previewOnly:true};
  if(State.tool.kind==='tower'&&State.tool.shape==='round')return{type:'tower',shape:'round',x:q.x,y:q.y,r:State.tool.size,level:State.tool.level||State.buildLevels.tower,angle:0,rotationStep:0,previewOnly:true,functions:[]};
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
  const finalAngle=snapStructureAngle(Number.isFinite(State.draft?.lockedAngle)?State.draft.lockedAngle:angle);
  const s={id:uid(),...spec,x:center.x,y:center.y,angle:finalAngle,rotationStep:structureRotationStep(finalAngle),functions:Array.isArray(spec.functions)?[...spec.functions]:[]};
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
    material:State.tool.material||'stone',
    woodStyle:State.tool.woodStyle,
    woodRoof:State.tool.woodRoof,
    angle:snapStructureAngle(angle),
    rotationStep:structureRotationStep(angle),
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
  const a=snapStructureAngle(Number.isFinite(radialAngle)?radialAngle:0),ux=Math.cos(a),uy=Math.sin(a);
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
  const child=towerToolPrototype();if(!child||isWoodTower(child))return null;
  const childTier=towerTier(child);
  let best=null,bestScore=Infinity;

  for(const parent of State.structures){
    if(parent.auto||!['tower','gate'].includes(parent.type)||underConstruction(parent)||(parent.type==='tower'&&isWoodTower(parent))||isWoodGate(parent))continue;

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
      const a=snapStructureAngle(Math.atan2(p.y-parent.y,p.x-parent.x));
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
  if(!parent||isWoodGate(parent)||(parent.type==='tower'&&towerTier(child)>=towerTier(parent))){
    delete child.parentTowerId;delete child.subtowerSocket;delete child.subtowerAngle;delete child.parentType;
    return false;
  }
  const attachment=subtowerAttachmentAtSocket(parent,child,child.subtowerSocket,child.subtowerAngle);
  if(!attachment)return false;
  child.x=attachment.point.x;child.y=attachment.point.y;
  if(child.shape==='square'){
    const offset=snapStructureAngle(Number.isFinite(Number(child.orientationOffset))?Number(child.orientationOffset):0);
    child.orientationOffset=offset;
    applyStructureRotation(child,attachment.angle+offset);
  }
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
    if(wall.auto||!['wall','palisade'].includes(wall.type))continue;
    const reach=TOWER_WALL_MAGNET+(Number(wall.width)||.5)/2;
    for(const end of ['a','b']){
      if(wallEndpointSnapOccupied(wall,end))continue;
      const q=wall[end],d=dist(p,q);
      if(d<=reach&&d<bestD){
        best={
          point:{x:q.x,y:q.y},
          wallId:wall.id,
          wallEnd:end,
          angle:snapStructureAngle(Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x)),
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
    const wall=State.structures.find(s=>s.id===link.wallId&&['wall','palisade'].includes(s.type));if(!wall)continue;
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
    if(!['wall','palisade'].includes(wall.type))continue;
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
  if(!tower||!wall||tower.type!=='tower'||!['wall','palisade'].includes(wall.type))return;
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
  invalidateNavigation();
}
function regenerateTowerWallPair(tower,wall,end,anchor=null){
  if(!tower||tower.type!=='tower'||!wall||!['wall','palisade'].includes(wall.type))return false;
  end=end==='b'?'b':'a';
  const other=end==='a'?wall.b:wall.a;
  if(!other)return false;

  const original=anchor||{x:tower.x,y:tower.y};
  const passThrough=wall.type==='palisade'&&palisadePassThroughTarget(tower);

  // Watchtower = open frame: palisade keeps the original endpoint beneath it.
  // Solid towers/gates use the exact footprint boundary.
  const contact=passThrough?original:boundaryPoint(tower,other);
  wall[end]={x:contact.x,y:contact.y};
  wall.length=dist(wall.a,wall.b);
  if(end==='a')wall.aSnap=tower.id;else wall.bSnap=tower.id;

  setTowerWallConnection(tower,wall,end,original);
  normalizeStructureVariants(wall);
  normalizeFunctions(tower);
  invalidateCastleColliderGeometry(tower,wall);
  return passThrough||dist(wall[end],boundaryPoint(tower,other))<=.015;
}
function attachTowerToWallEndpoint(wallId,end,tower,anchor){
  const wall=State.structures.find(s=>s.id===wallId&&['wall','palisade'].includes(s.type));
  if(!wall||!tower||tower.type!=='tower'||!['a','b'].includes(end))return false;
  if(wallEndpointSnapOccupied(wall,end))return false;
  return regenerateTowerWallPair(tower,wall,end,anchor||wall[end]);
}
function restoreTowerWallConnections(tower){
  if(!tower||tower.type!=='tower')return;
  for(const link of towerWallConnectionRecords(tower)){
    const wall=State.structures.find(s=>s.id===link.wallId&&['wall','palisade'].includes(s.type));if(!wall)continue;
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
      const wall=State.structures.find(s=>s.id===l.wallId&&['wall','palisade'].includes(s.type));
      return wall?l.wallId+':'+l.end+':'+(underConstruction(wall)?'0':'1'):'missing';
    }).join('|');
    if(!force&&tower.wallColliderSyncSignature===signature)continue;

    let allReady=true,localChanged=0;
    for(const link of links){
      const wall=State.structures.find(s=>s.id===link.wallId&&['wall','palisade'].includes(s.type));
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
    invalidateNavigation();
  }
  return changed;
}
function breakWallForTower(wallId,tower){
  const wall=State.structures.find(s=>s.id===wallId&&['wall','palisade'].includes(s.type));
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
    const wall=State.structures.find(s=>s.id===snap.wallId&&['wall','palisade'].includes(s.type));
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
  if(State.tool.linear==='road')return TYPES.road;
  if(['wall','palisade'].includes(State.tool.linear))return{...TYPES[State.tool.linear],width:wallWidthForTier(State.tool.tier||State.buildLevels.wallTier)};
  return TYPES.built;
}
function normalizeLinear(a,b,spec,snapAngle=false){let dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<.0001)return null;const target=clamp(L,spec.min,spec.max),rawAngle=Math.atan2(dy,dx),angle=snapAngle?snapStructureAngle(rawAngle):rawAngle,ux=Math.cos(angle),uy=Math.sin(angle);return{a,b:{x:a.x+ux*target,y:a.y+uy*target},length:target,angle,rotationStep:snapAngle?structureRotationStep(angle):null}}
function structureAngleDelta(a,b){return Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))}
function discreteLinearSegment(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(length<1e-6)return null;
  const angle=snapStructureAngle(Math.atan2(dy,dx));
  return{a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},length,angle,rotationStep:structureRotationStep(angle)};
}
function normalizeStructuralLinearRoute(a,b,spec,exactEnd=false){
  if(!exactEnd){
    const single=normalizeLinear(a,b,spec,true);
    return single?{segments:[single],joint:null,length:single.length,exactEnd:false}:null;
  }

  const vx=b.x-a.x,vy=b.y-a.y,direct=Math.hypot(vx,vy);
  if(direct<1e-6)return null;
  const rawAngle=Math.atan2(vy,vx),snapped=snapStructureAngle(rawAngle);
  if(structureAngleDelta(rawAngle,snapped)<1e-7&&direct<=spec.max+1e-6){
    const single=discreteLinearSegment(a,b);
    return single?{segments:[single],joint:null,length:single.length,exactEnd:true}:null;
  }

  // Exact magnet + forced structural angles: solve A -> joint -> B using
  // two vectors from the 24-direction lattice. The score strongly favours a
  // joint near the middle, then minimal detour and a gentle change of heading.
  const minLeg=Math.min(.5,Math.max(.25,(Number(spec.min)||1)*.35));
  const maxLeg=Number(spec.max)||Infinity;
  let best=null;
  for(let i=0;i<STRUCTURE_ANGLE_STEPS;i++){
    const a1=structureAngleFromStep(i),d1x=Math.cos(a1),d1y=Math.sin(a1);
    for(let j=0;j<STRUCTURE_ANGLE_STEPS;j++){
      const a2=structureAngleFromStep(j),d2x=Math.cos(a2),d2y=Math.sin(a2);
      const det=d1x*d2y-d1y*d2x;
      if(Math.abs(det)<1e-8)continue;
      const t=(vx*d2y-vy*d2x)/det;
      const u=(d1x*vy-d1y*vx)/det;
      if(t<minLeg||u<minLeg||t>maxLeg+1e-6||u>maxLeg+1e-6)continue;
      const turn=structureAngleDelta(a2,a1);
      if(turn>Math.PI/2+1e-6)continue;
      const total=t+u,balance=Math.abs(t-u)/Math.max(total,1e-6);
      const inflation=Math.max(0,total/direct-1);
      const headingFit=structureAngleDelta(a1,rawAngle)+structureAngleDelta(a2,rawAngle);
      const score=balance*4+inflation*3+turn*.45+headingFit*.18;
      if(!best||score<best.score){
        best={score,joint:{x:a.x+d1x*t,y:a.y+d1y*t},a1,a2,t,u,total};
      }
    }
  }
  if(!best)return null;
  const first=discreteLinearSegment(a,best.joint),second=discreteLinearSegment(best.joint,b);
  if(!first||!second)return null;
  return{segments:[first,second],joint:best.joint,length:best.total,exactEnd:true};
}
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
function structureLabel(s){if(!s)return'';if(s.type==='house'){const l=houseLevel(s);return `House · L${l}${l===3?' · '+housePlanType(s)+' plan':l===4?' · elite · '+houseTurretType(s)+' turret':''}`};if(s.type==='market')return'Market · 4×4U';if(s.type==='tavern')return'Tavern · double-T plan';if(s.type==='church')return'Church · large';if(s.type==='training')return'Training field · 5×4U';if(s.type==='well')return'Village well';if(s.type==='gate')return isWoodGate(s)?'Wood gate 1.5×1U · H1 · flat deck · battlements':`Gate 1.5×1.5U · L${structureLevel(s)}`;if(s.type==='tower'){if(isWoodTower(s))return woodTowerStyle(s)==='watchtower'?`Wood watchtower 1×1U · H1`:`Wood tower 1.5×1.5U · H1 · ${woodTowerRoof(s)==='pitched'?'pitched roof':'open top'}`;return (s.shape==='round'?`Round tower R${s.r}U`:`Square tower ${s.size}×${s.size}U`)+` · T${towerTier(s)} · L${structureLevel(s)}`+(s.parentTowerId?' · SUB':'')};if(s.type==='built')return`Built section ${s.length.toFixed(2)}U · L${structureLevel(s)}`;if(s.type==='wall')return`Wall ${s.length.toFixed(2)}U · T${wallTier(s)} (${s.width}U) · L${structureLevel(s)}`;if(s.type==='palisade')return`Palisade ${s.length.toFixed(2)}U · T${wallTier(s)} (${s.width}U)`;if(s.type==='road')return`${s.manualMain?'Main road':'Road'} ${(s.length||dist(s.a,s.b)).toFixed(2)}U`;return s.type}
function drawLinearBase(s,preview=false){
  const h=structureHeight(s),selected=State.selectedId===s.id;
  const colors=s.type==='wall'
    ?{top:winterSnowColor('#9a8e82'),sideA:'#49443f',sideB:'#686057',stroke:selected?'#f4b76f':'#d8c8b4'}
    :{top:winterSnowColor('#9b7457'),sideA:'#5c4436',sideB:'#715441',stroke:selected?'#f4b76f':'#d8c8b4'};
  extrudePolygon(linePoly(s),h,colors);
}
function palisadeSnapTarget(id){
  return id?State.structures.find(o=>o.id===id&&['tower','gate'].includes(o.type))||null:null;
}
function palisadePassThroughTarget(target){
  return !!target&&isWoodTower(target)&&woodTowerStyle(target)==='watchtower';
}
function palisadeSolidSnapTarget(id){
  const target=palisadeSnapTarget(id);
  return target&&!palisadePassThroughTarget(target)?target:null;
}
function palisadeLayout(s){
  const rawDx=s.b.x-s.a.x,rawDy=s.b.y-s.a.y,rawL=Math.hypot(rawDx,rawDy)||1;
  const ux=rawDx/rawL,uy=rawDy/rawL,nx=-uy,ny=ux,side=wallExteriorSide(s);
  const width=Number(s.width)||wallWidthForTier(wallTier(s)),tier=wallTier(s),postR=.10;
  const exterior=width/2,postOffset=tier===1?0:Math.max(0,exterior-postR);
  const aTarget=palisadeSnapTarget(s.aSnap),bTarget=palisadeSnapTarget(s.bSnap);

  // Endpoint itself is already on the solid tower boundary. Pull timber farther
  // back according to its lateral offset. Watchtowers are pass-through: zero trim.
  const jointPad=clamp(.16+Math.abs(postOffset)*.42,.16,.34);
  const aPad=aTarget&&!palisadePassThroughTarget(aTarget)?Math.min(jointPad,rawL*.25):0;
  const bPad=bTarget&&!palisadePassThroughTarget(bTarget)?Math.min(jointPad,rawL*.25):0;
  const maxPad=Math.max(0,(rawL-.02)/2),sa=Math.min(aPad,maxPad),sb=Math.min(bPad,maxPad);
  const aa={x:s.a.x+ux*sa,y:s.a.y+uy*sa},bb={x:s.b.x-ux*sb,y:s.b.y-uy*sb};
  const dx=bb.x-aa.x,dy=bb.y-aa.y,L=Math.max(.01,Math.hypot(dx,dy));
  const point=(p,offset)=>({x:p.x+nx*offset*side,y:p.y+ny*offset*side});
  return{a:aa,b:bb,dx,dy,L,rawL,ux,uy,nx,ny,side,width,tier,postR,postOffset,startPad:sa,endPad:sb,aTarget,bTarget,point};
}
function palisadeOctagon(center,r,angle=0){
  const pts=[];
  for(let i=0;i<8;i++){
    const a=angle+Math.PI/8+i*Math.PI/4;
    pts.push({x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r});
  }
  return pts;
}
function drawPalisadePostAt(center,r,z0,bodyZ,tipZ,angle){
  const base=palisadeOctagon(center,r,angle);
  extrudePolygonAt(base,z0,bodyZ,{top:'#765238',sideA:'#51341f',sideB:'#65452b',stroke:'#8b6547'});
  const apex=w2s(center,tipZ),top=projectPath(base,bodyZ),faces=[];
  for(let i=0;i<8;i++){
    const j=(i+1)%8,depth=(top[i].y+top[j].y)/2;
    faces.push({poly:[top[i],top[j],apex],depth,fill:i%2?'#c29a6b':'#b68a5e'});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.fill,'rgba(90,59,35,.55)',.65);
}
function drawPalisadePost(center,r,bodyZ,tipZ,angle){
  drawPalisadePostAt(center,r,0,bodyZ,tipZ,angle);
}
function drawOpaquePolygon(points,fill,stroke,lineWidth=1){
  if(!points?.length)return;
  ctx.save();
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  ctx.beginPath();
  points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill()}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke()}
  ctx.restore();
}
function drawPalisadeWalkway(s,g){
  const innerOuter=g.postOffset-.05,innerEdge=-g.width/2+.035,z0=.66,z1=.74;
  const a0=g.point(g.a,innerOuter),b0=g.point(g.b,innerOuter);
  const a1=g.point(g.a,innerEdge),b1=g.point(g.b,innerEdge);
  extrudePolygonAt([a0,b0,b1,a1],z0,z1,{top:'#8b6845',sideA:'#4f3927',sideB:'#65492f',stroke:'#a27b54'});
  const bays=Math.max(1,Math.floor(g.L/.72));
  for(let i=0;i<=bays;i++){
    const t=i/bays,p={x:g.a.x+g.dx*t,y:g.a.y+g.dy*t};
    const q0=w2s(g.point(p,innerOuter),z1+.008),q1=w2s(g.point(p,innerEdge),z1+.008);
    ctx.save();ctx.strokeStyle='rgba(69,46,29,.48)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(q0.x,q0.y);ctx.lineTo(q1.x,q1.y);ctx.stroke();ctx.restore();
  }
}
function drawPalisadeEarthwork(s,g){
  const crestOuter=g.postOffset-.055,crestInner=crestOuter-.18;
  const earthH=Math.max(.28,Math.min(.70,crestInner+g.width/2));
  const toe=crestInner-earthH;
  const ao=g.point(g.a,crestOuter),bo=g.point(g.b,crestOuter);
  const ac=g.point(g.a,crestInner),bc=g.point(g.b,crestInner);
  const at=g.point(g.a,toe),bt=g.point(g.b,toe);

  // Earth is structural mass, never an overlay: force fully opaque source-over
  // rendering regardless of any canvas state left by terrain/shadow passes.
  drawOpaquePolygon([w2s(ao,0),w2s(bo,0),w2s(bo,earthH),w2s(ao,earthH)],'#5a4128','#765738',.8);
  drawOpaquePolygon([w2s(ao,earthH),w2s(bo,earthH),w2s(bc,earthH),w2s(ac,earthH)],'#76603a','#8f7650',.8);
  drawOpaquePolygon([w2s(ac,earthH),w2s(bc,earthH),w2s(bt,0),w2s(at,0)],'#655033','#7d6744',.8);
  drawOpaquePolygon([w2s(ao,0),w2s(ao,earthH),w2s(ac,earthH),w2s(at,0)],'#544128','#755b38',.7);
  drawOpaquePolygon([w2s(bo,0),w2s(bo,earthH),w2s(bc,earthH),w2s(bt,0)],'#5d492d','#806542',.7);
  return{earthH,crestOuter,crestInner,toe};
}
function palisadePatrolSurface(s){
  const g=palisadeLayout(s);
  if(g.tier===1)return{z:structureHeight(s)+.10,offset:0,spread:0};
  if(g.tier===2){
    const outer=g.postOffset-.05,inner=-g.width/2+.035;
    return{z:.84,offset:(outer+inner)/2,spread:Math.min(.10,Math.abs(outer-inner)*.28)};
  }
  const crestOuter=g.postOffset-.055,crestInner=crestOuter-.18;
  const earthH=Math.max(.28,Math.min(.70,crestInner+g.width/2));
  return{z:earthH+.10,offset:(crestOuter+crestInner)/2,spread:Math.min(.07,Math.abs(crestOuter-crestInner)*.30)};
}
function palisadeConnectionOccluders(s){
  const out=[],seen=new Set(),poly=linePoly(s);
  const add=target=>{
    if(!target||underConstruction(target)||palisadePassThroughTarget(target)||seen.has(target.id))return;
    seen.add(target.id);out.push(target);
  };
  add(palisadeSnapTarget(s.aSnap));add(palisadeSnapTarget(s.bSnap));

  // Fallback for stale/legacy links and all painter-order edge cases.
  for(const target of State.structures){
    if(!['tower','gate'].includes(target.type)||underConstruction(target)||palisadePassThroughTarget(target))continue;
    if(worldPolygonsOverlap(poly,footprintPoints(target)))add(target);
  }
  return out;
}
function withPalisadeConnectionOcclusion(s,drawFn){
  const occluders=palisadeConnectionOccluders(s);
  if(!occluders.length){drawFn();return}
  const r=wrap.getBoundingClientRect();
  ctx.save();ctx.beginPath();ctx.rect(-48,-48,r.width+96,r.height+96);
  for(const o of occluders){
    const hull=structureScreenSilhouette(o);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');drawFn();ctx.restore();
}
function palisadePostOffsetAt(g,along){
  let factor=1;
  const taper=Math.min(.48,g.L*.35);
  if(taper>1e-5){
    if(palisadePassThroughTarget(g.aTarget))factor=Math.min(factor,clamp(along/taper,0,1));
    if(palisadePassThroughTarget(g.bTarget))factor=Math.min(factor,clamp((g.L-along)/taper,0,1));
  }
  return g.postOffset*factor;
}
function drawPalisadePostLine(s,g,z0=0,bodyZ=.93,tipZ=1.15,r=g.postR){
  const spacing=.205,count=Math.max(1,Math.ceil(g.L/spacing));
  for(let i=0;i<=count;i++){
    const t=i/count,along=g.L*t,p={x:g.a.x+g.dx*t,y:g.a.y+g.dy*t};
    const center=g.point(p,palisadePostOffsetAt(g,along));
    drawPalisadePostAt(center,r,z0,bodyZ,tipZ,Math.atan2(g.dy,g.dx));
  }
}
function drawWatchtowerPalisadeJunction(s,g){
  const targets=[];
  if(palisadePassThroughTarget(g.aTarget))targets.push(g.aTarget);
  if(palisadePassThroughTarget(g.bTarget)&&g.bTarget!==g.aTarget)targets.push(g.bTarget);
  if(!targets.length)return;

  for(const tower of targets){
    if(g.tier===2){
      const pts=rectWorldPoints(tower.x,tower.y,.78,.78,tower.angle||0);
      extrudePolygonAt(pts,.66,.74,{top:'#8b6845',sideA:'#4f3927',sideB:'#65492f',stroke:'#a27b54'});
    }else if(g.tier===3){
      const crestOuter=g.postOffset-.055,crestInner=crestOuter-.18;
      const earthH=Math.max(.28,Math.min(.70,crestInner+g.width/2));
      const pts=rectWorldPoints(tower.x,tower.y,.82,.82,tower.angle||0);
      drawOpaquePolygon(projectPath(pts,earthH),'#76603a','#8f7650',.8);
    }
  }
}
function drawPalisade(s,preview=false){
  const g=palisadeLayout(s),selected=State.selectedId===s.id;
  withPalisadeConnectionOcclusion(s,()=>{
    if(g.tier===2)drawPalisadeWalkway(s,g);
    else if(g.tier===3)drawPalisadeEarthwork(s,g);
    drawWatchtowerPalisadeJunction(s,g);
    drawPalisadePostLine(s,g);
  });

  if(selected){
    const fp=projectPath(linePoly(s),.025);
    pathPolygon(fp,null,'#f4b76f',2);
  }
}
function woodTowerLocal(s,x,y){
  const ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0);
  return{x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca};
}
function drawWoodPost(center,r,z0,z1,angle=0){
  extrudePolygonAt(palisadeOctagon(center,r,angle),z0,z1,{
    top:'#7b5739',sideA:'#4b301d',sideB:'#654329',stroke:'#8e6848'
  });
}
function drawWoodPlatform(s,size,z0,z1){
  extrudePolygonAt(rectWorldPoints(s.x,s.y,size,size,s.angle||0),z0,z1,{
    top:'#8b6845',sideA:'#4f3927',sideB:'#65492f',stroke:'#a27b54'
  });
}
function drawWoodHipRoof(s,eaveZ,apexZ,overhang=.14){
  const size=(Number(s.size)||1)+overhang*2,fp=rectWorldPoints(s.x,s.y,size,size,s.angle||0);
  const apex=w2s({x:s.x,y:s.y},apexZ),faces=[];
  const fills=State.season==='winter'?[WINTER_SNOW_A,WINTER_SNOW_TOP,WINTER_SNOW_B,'#e3e8e4']:['#4d3427','#5a3d2e','#654535','#56392b'];
  for(let i=0;i<4;i++){
    const j=(i+1)%4,a=w2s(fp[i],eaveZ),b=w2s(fp[j],eaveZ);
    faces.push({poly:[a,b,apex],depth:(a.y+b.y)/2,fill:fills[i]});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.fill,State.season==='winter'?WINTER_SNOW_STROKE:'#7b5942',1);
}
function drawWoodRail(s,size,z0,z1){
  const half=size/2-.055,r=.045,angle=s.angle||0;
  const corners=[[-half,-half],[half,-half],[half,half],[-half,half]];
  for(const [x,y] of corners)drawWoodPost(woodTowerLocal(s,x,y),r,z0,z1,angle);
  for(let edge=0;edge<4;edge++){
    const a=corners[edge],b=corners[(edge+1)%4];
    const steps=Math.max(2,Math.ceil(size/.34));
    for(let i=1;i<steps;i++){
      const t=i/steps,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
      drawWoodPost(woodTowerLocal(s,x,y),.032,z0,z1-.08,angle);
    }
  }
}
function drawWatchtowerWood(s){
  const size=1,half=.39,platformZ=.0,deck0=1.34,deck1=1.46,eaveZ=1.98,apexZ=2.35,angle=s.angle||0;
  const corners=[[-half,-half],[half,-half],[half,half],[-half,half]];
  for(const [x,y] of corners)drawWoodPost(woodTowerLocal(s,x,y),.075,platformZ,eaveZ,angle);
  drawWoodPlatform(s,size,deck0,deck1);
  drawWoodRail(s,size,deck1,1.72);
  drawWoodHipRoof(s,eaveZ,apexZ,.14);
}
function drawMediumWoodTower(s){
  const size=1.5,half=size/2-.07,angle=s.angle||0,spacing=.205;
  const deck0=1.72,deck1=1.82,openTop=woodTowerRoof(s)==='open';
  const corners=[[-half,-half],[half,-half],[half,half],[-half,half]];

  // Closed palisade-like lower body.
  for(let edge=0;edge<4;edge++){
    const a=corners[edge],b=corners[(edge+1)%4],L=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(L/spacing));
    for(let i=0;i<=count;i++){
      const t=i/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
      drawWoodPost(woodTowerLocal(s,x,y),.09,0,deck0,angle);
    }
  }
  drawWoodPlatform(s,size-.10,deck0,deck1);

  if(openTop){
    // Open-top tower: pointed palisade parapet.
    const parapetBody=2.03,parapetTip=2.22;
    for(let edge=0;edge<4;edge++){
      const a=corners[edge],b=corners[(edge+1)%4],L=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(L/.245));
      for(let i=0;i<=count;i++){
        const t=i/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
        drawPalisadePostAt(woodTowerLocal(s,x,y),.072,deck1,parapetBody,parapetTip,angle);
      }
    }
  }else{
    // Roofed variant: genuinely open gallery under the roof, with a low timber rail.
    drawWoodRail(s,size-.08,deck1,2.02);
    const roofHalf=.61,eaveZ=2.55,apexZ=2.95;
    for(const [x,y] of [[-roofHalf,-roofHalf],[roofHalf,-roofHalf],[roofHalf,roofHalf],[-roofHalf,roofHalf]]){
      drawWoodPost(woodTowerLocal(s,x,y),.055,deck1,eaveZ,angle);
    }
    drawWoodHipRoof(s,eaveZ,apexZ,.10);
  }
}
function drawWoodTower(s,preview=false){
  if(woodTowerStyle(s)==='watchtower')drawWatchtowerWood(s);
  else drawMediumWoodTower(s);
  if(State.selectedId===s.id){
    pathPolygon(projectPath(footprintPoints(s),.025),null,'#f4b76f',2);
  }
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
    if(o.id===owner.id||underConstruction(o)||(!isCastlePart(o)&&!isRaisedPlacementCastlePoint(o)))return false;
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
  return withStructureGroundPlane(s,()=>{
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
  });
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
  const winter=State.season==='winter';
  const faceA={poly:[a0,a1,rb,ra],fill:preview?'rgba(58,61,66,.62)':(winter?WINTER_SNOW_A:'#34363a'),depth:(a0.y+a1.y)/2};
  const faceB={poly:[b0,b1,rb,ra],fill:preview?'rgba(70,73,78,.62)':(winter?WINTER_SNOW_B:'#42454a'),depth:(b0.y+b1.y)/2};

  withBuiltRoofOcclusionClip(s,()=>{
    for(const face of [faceA,faceB].sort((a,b)=>a.depth-b.depth)){
      pathPolygon(face.poly,face.fill,winter?WINTER_SNOW_STROKE:'#5d6066',1);
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
    ownerTop:owner?structureHeight(owner):null,
    groundZ:owner?placementGroundZ(owner):null
  };
}
function buildBattlementOcclusionFrame(){
  const entries=[],byId=new Map();
  for(const s of State.structures){
    if(underConstruction(s))continue;
    const castle=isCastlePart(s),raised=isRaisedPlacementCastlePoint(s),towerGate=['tower','gate'].includes(s.type);
    if(!castle&&!raised&&!towerGate)continue;
    const entry={
      s,
      id:s.id,
      castle,
      raised,
      towerGate,
      h:structureVisualTopHeight(s),
      depth:worldDepth(s),
      fp:unionFootprintPoints(s),
      hull:null
    };
    entries.push(entry);
    byId.set(s.id,entry);
  }
  const viewport=wrap.getBoundingClientRect();
  return{
    entries,byId,queryCache:new Map(),
    viewportW:viewport.width,viewportH:viewport.height,
    crestClipH:Math.max(2000,viewport.height*3)
  };
}
function battlementOcclusionCandidates(piece,frame){
  if(!piece.ownerId||!['tower','wall','gate','palisade'].includes(piece.ownerType))return{always:[],overlap:[]};
  const key=piece.ownerId+'|'+piece.ownerType+'|'+Number(piece.z0).toFixed(3);
  const cached=frame.queryCache.get(key);
  if(cached)return cached;

  const owner=frame.byId.get(piece.ownerId);
  const ownerDepth=owner?.depth??Number(piece.ownerDepth??piece.depth);
  const always=[],overlap=[];
  for(const entry of frame.entries){
    if(entry.id===piece.ownerId)continue;
    const candidate=entry.castle||entry.raised||(piece.ownerType==='palisade'&&entry.towerGate);
    if(!candidate)continue;
    if(piece.ownerType==='palisade'&&palisadePassThroughTarget(entry.s))continue;
    if(entry.h<=Number(piece.z0)+.04)continue;

    // Anything strictly in front of the owner occludes every piece belonging
    // to that owner/z band. Near/equal-depth structures need the precise
    // footprint overlap test for each individual merlon/post.
    if(entry.depth>ownerDepth+1e-4)always.push(entry);
    else overlap.push(entry);
  }
  const result={always,overlap};
  frame.queryCache.set(key,result);
  return result;
}
function castleBattlementOccluders(piece,frame){
  const {always,overlap}=battlementOcclusionCandidates(piece,frame);
  if(!always.length&&!overlap.length)return always;

  const out=always.slice();
  for(const entry of overlap){
    if(entry.fp?.length&&worldPolygonsOverlap(piece.pts,entry.fp))out.push(entry);
  }
  return out;
}
function battlementOccluderHull(entry){
  if(entry.hull)return entry.hull;
  entry.hull=structureScreenSilhouette(entry.s);
  return entry.hull;
}
function withTowerBattlementOcclusion(piece,frame,drawFn){
  const occluders=castleBattlementOccluders(piece,frame);
  if(!occluders.length){drawFn();return}
  ctx.save();
  ctx.beginPath();
  ctx.rect(-48,-48,frame.viewportW+96,frame.viewportH+96);
  for(const entry of occluders){
    const hull=battlementOccluderHull(entry);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');
  drawFn();
  ctx.restore();
}
function drawBattlementPiece(piece,frame){
  return withProjectionGroundZ(piece.groundZ,()=>withTowerBattlementOcclusion(piece,frame,()=>{
    if(piece.kind==='palisadePost'){
      drawPalisadePostAt(piece.center,piece.r,piece.z0,piece.bodyZ,piece.tipZ,piece.angle||0);
      return;
    }
    if(piece.kind==='woodRailPost'){
      drawWoodPost(piece.center,piece.r,piece.z0,piece.tipZ,piece.angle||0);
      return;
    }
    if(piece.wallCrest){
      const a=w2s(piece.wallCrest.a,piece.wallCrest.z),b=w2s(piece.wallCrest.b,piece.wallCrest.z);
      const H=frame.crestClipH;
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
  }));
}
function renderBattlementPieces(pieces,frame){
  pieces.sort((a,b)=>a.depth-b.depth);
  for(const piece of pieces)drawBattlementPiece(piece,frame);
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
  if(s.type!=='tower'||isWoodTower(s)||underConstruction(s)||towerRoofStyle(s)!=='battlement')return[];
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
      fill:State.season==='winter'?(i%2?WINTER_SNOW_A:WINTER_SNOW_B):(i%2?'#34363a':'#42454a')
    });
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.fill,State.season==='winter'?WINTER_SNOW_STROKE:'#5d6066',1);
}
function drawRoundTowerRoof(s){
  const baseZ=structureHeight(s),apexZ=towerVisualTopHeight(s),fp=towerRoofFootprintPoints(s);
  if(fp.length<3)return;
  const apex=w2s({x:s.x,y:s.y},apexZ),faces=[];
  for(let i=0;i<fp.length;i++){
    const j=(i+1)%fp.length,a=w2s(fp[i],baseZ),b=w2s(fp[j],baseZ);
    const shade=State.season==='winter'?(i%3===0?WINTER_SNOW_B:i%3===1?WINTER_SNOW_A:WINTER_SNOW_TOP):(i%3===0?'#303236':i%3===1?'#3a3d42':'#44474c');
    faces.push({poly:[a,b,apex],depth:(a.y+b.y)/2,fill:shade});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.fill,null);
  const rim=projectPath(fp,baseZ);
  ctx.save();ctx.strokeStyle=State.season==='winter'?WINTER_SNOW_STROKE:'#5d6066';ctx.lineWidth=1;ctx.beginPath();
  rim.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.restore();
}
function drawTowerRoof(s){
  if(!s||s.type!=='tower'||isWoodTower(s)||underConstruction(s)||towerRoofStyle(s)!=='pitched')return;
  withStructureGroundPlane(s,()=>withPointRoofOcclusion(s,()=>s.shape==='round'?drawRoundTowerRoof(s):drawSquareTowerRoof(s)));
}
function drawTowerRoofs(){
  const towers=State.structures
    .filter(s=>s.type==='tower'&&!isWoodTower(s)&&!underConstruction(s)&&towerRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of towers)drawTowerRoof(s);
}
function drawGateRoof(s){
  if(!s||s.type!=='gate'||isWoodGate(s)||underConstruction(s)||gateRoofStyle(s)!=='pitched')return;
  const g=gateRoofGeometry(s);if(!g)return;
  withStructureGroundPlane(s,()=>withPointRoofOcclusion(s,()=>{
    const rearGable=[w2s(g.c3,g.h),w2s(g.c0,g.h),w2s(g.ridgeA,g.ridgeH)];
    const frontGable=[w2s(g.c1,g.h),w2s(g.c2,g.h),w2s(g.ridgeB,g.ridgeH)];
    const roofA=[w2s(g.c0,g.h),w2s(g.c1,g.h),w2s(g.ridgeB,g.ridgeH),w2s(g.ridgeA,g.ridgeH)];
    const roofB=[w2s(g.c3,g.h),w2s(g.c2,g.h),w2s(g.ridgeB,g.ridgeH),w2s(g.ridgeA,g.ridgeH)];
    const faces=[
      {poly:rearGable,fill:'#514a44',depth:(rearGable[0].y+rearGable[1].y)/2},
      {poly:frontGable,fill:'#62584f',depth:(frontGable[0].y+frontGable[1].y)/2},
      {poly:roofA,fill:State.season==='winter'?WINTER_SNOW_A:'#34363a',depth:(roofA[0].y+roofA[1].y)/2},
      {poly:roofB,fill:State.season==='winter'?WINTER_SNOW_B:'#42454a',depth:(roofB[0].y+roofB[1].y)/2}
    ];
    faces.sort((a,b)=>a.depth-b.depth);
    for(const face of faces)pathPolygon(face.poly,face.fill,(State.season==='winter'&&face.poly.length===4)?WINTER_SNOW_STROKE:'#5d6066',1);
  }));
}
function drawGateRoofs(){
  const gates=State.structures
    .filter(s=>s.type==='gate'&&!underConstruction(s)&&gateRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of gates)drawGateRoof(s);
}
function midpoint2(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
function drawQuarteredTowerFlag(tower){
  if(!tower||isWoodTower(tower)||underConstruction(tower)||tower.type!=='tower'||towerRoofStyle(tower)!=='pitched')return;
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
    .filter(s=>s.type==='tower'&&!isWoodTower(s)&&!underConstruction(s)&&towerRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const tower of towers)withStructureGroundPlane(tower,()=>drawQuarteredTowerFlag(tower));
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
          z,groundZ:placementGroundZ(tower)
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
    if(s.type==='tower'&&isWoodTower(s)&&woodTowerStyle(s)==='palisadeTower'&&woodTowerRoof(s)==='open'){
      out.push({kind:'brazier',id:s.id+':wood-brazier',p:woodTowerLocal(s,.28,.24),z:1.90,groundZ:placementGroundZ(s)});
    }else if(s.type==='tower'&&!isWoodTower(s)&&towerRoofStyle(s)==='battlement'){
      const hash=peasantHash(s.id+'-brazier'),a=((hash%360)/180)*Math.PI;
      const r=s.shape==='round'?Math.max(.12,s.r*.34):Math.max(.12,(s.size||1)*.26);
      out.push({kind:'brazier',id:s.id+':brazier',p:{x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r},z:structureHeight(s)+.10,groundZ:placementGroundZ(s)});
    }else if(s.type==='gate'&&gateRoofStyle(s)==='battlement'){
      const ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0),half=.43;
      for(const side of [-1,1]){
        out.push({kind:'brazier',id:s.id+':brazier:'+side,p:{x:s.x+ca*half*side,y:s.y+sa*half*side},z:structureHeight(s)+.10,groundZ:placementGroundZ(s)});
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
  const p=Number.isFinite(src.groundZ)?w2sRaw(src.p,src.z+src.groundZ):w2s(src.p,src.z),scale=clamp(State.view.scale,.55,1.45);
  ctx.save();
  ctx.strokeStyle='#6b5440';ctx.lineWidth=Math.max(1,1.0*scale);
  ctx.beginPath();ctx.moveTo(p.x-3.0*scale,p.y+2.2*scale);ctx.lineTo(p.x,p.y);ctx.stroke();
  ctx.fillStyle='#463a32';ctx.beginPath();
  ctx.moveTo(p.x-1.6*scale,p.y+.5*scale);ctx.lineTo(p.x+1.6*scale,p.y+.5*scale);
  ctx.lineTo(p.x+1.0*scale,p.y+2.4*scale);ctx.lineTo(p.x-1.0*scale,p.y+2.4*scale);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawBrazierFixture(src){
  const pts=rectWorldPoints(src.p.x,src.p.y,.20,.20,0);
  withProjectionGroundZ(src.groundZ,()=>extrudePolygonAt(pts,src.z-.08,src.z+.03,{top:'#5d4b3d',sideA:'#39312b',sideB:'#493d34',stroke:'#7b654f'}));
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
    const localZ=src.z+(src.kind==='brazier'?.08:0),p=Number.isFinite(src.groundZ)?w2sRaw(src.p,localZ+src.groundZ):w2s(src.p,localZ);
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
  if(s.type!=='gate'||isWoodGate(s)||underConstruction(s)||gateRoofStyle(s)!=='battlement')return[];
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
function fortificationFrontPiece(owner,kind,center,r,angle,z0,bodyZ,tipZ){
  const pts=palisadeOctagon(center,r,angle);
  const q=rotateViewPoint(center);
  return{
    kind,pts,z0,z1:tipZ,depth:q.x+q.y,
    ownerId:owner.id,ownerType:owner.type,ownerDepth:worldDepth(owner),ownerTop:structureHeight(owner),
    groundZ:placementGroundZ(owner),
    center,r,angle,bodyZ,tipZ
  };
}
function palisadeFrontPieces(s){
  if(s.type!=='palisade'||underConstruction(s))return[];
  const g=palisadeLayout(s);
  if(linearFrontSide(s)!==g.side)return[];
  const spacing=.205,count=Math.max(1,Math.ceil(g.L/spacing)),pieces=[];
  for(let i=0;i<=count;i++){
    const t=i/count,along=g.L*t,p={x:g.a.x+g.dx*t,y:g.a.y+g.dy*t};
    const center=g.point(p,palisadePostOffsetAt(g,along));
    pieces.push(fortificationFrontPiece(s,'palisadePost',center,g.postR,Math.atan2(g.dy,g.dx),0,.93,1.15));
  }
  return pieces;
}
function woodTowerFrontEdges(s){
  const fp=footprintPoints(s),center={x:s.x,y:s.y},cd=viewDepthPoint(center),edges=[];
  for(let i=0;i<fp.length;i++){
    const a=fp[i],b=fp[(i+1)%fp.length],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(viewDepthPoint(mid)>cd+1e-4)edges.push({a,b});
  }
  return edges;
}
function woodTowerFrontPieces(s){
  if(!isWoodTower(s)||underConstruction(s))return[];
  const pieces=[],angle=s.angle||0;
  if(woodTowerStyle(s)==='watchtower'){
    for(const edge of woodTowerFrontEdges(s)){
      const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,steps=Math.max(2,Math.ceil(L/.34));
      for(let i=0;i<=steps;i++){
        const t=i/steps,center={x:edge.a.x+dx*t,y:edge.a.y+dy*t};
        pieces.push(fortificationFrontPiece(s,'woodRailPost',center,.045,angle,1.46,1.64,1.72));
      }
    }
    return pieces;
  }

  const openTop=woodTowerRoof(s)==='open';
  for(const edge of woodTowerFrontEdges(s)){
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1;
    const count=Math.max(2,Math.ceil(L/(openTop?.245:.34)));
    for(let i=0;i<=count;i++){
      const t=i/count,center={x:edge.a.x+dx*t,y:edge.a.y+dy*t};
      if(openTop)pieces.push(fortificationFrontPiece(s,'palisadePost',center,.072,angle,1.82,2.03,2.22));
      else pieces.push(fortificationFrontPiece(s,'woodRailPost',center,.045,angle,1.82,1.94,2.02));
    }
  }
  return pieces;
}
function drawCastleBattlements(){
  const pieces=[];
  for(const s of State.structures){
    if(underConstruction(s))continue;
    if(s.type==='tower'){
      pieces.push(...towerBattlementPieces(s));
      if(isWoodTower(s))pieces.push(...woodTowerFrontPieces(s));
    }else if(s.type==='gate')pieces.push(...gateBattlementPieces(s));
    else if(s.type==='wall')pieces.push(...wallBattlementPieces(s));
    else if(s.type==='palisade')pieces.push(...palisadeFrontPieces(s));
  }
  const frame=buildBattlementOcclusionFrame();
  renderBattlementPieces(pieces,frame);
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
let smokeParticleSprite=null;
const smokeSeedCache=new Map();
function getSmokeParticleSprite(){
  if(smokeParticleSprite)return smokeParticleSprite;
  const off=document.createElement('canvas');off.width=64;off.height=64;
  const g=off.getContext('2d'),grad=g.createRadialGradient(32,32,2,32,32,30);
  grad.addColorStop(0,'rgba(180,178,172,.34)');
  grad.addColorStop(.38,'rgba(180,178,172,.23)');
  grad.addColorStop(.72,'rgba(180,178,172,.09)');
  grad.addColorStop(1,'rgba(180,178,172,0)');
  g.fillStyle=grad;g.fillRect(0,0,64,64);
  smokeParticleSprite=off;
  return off;
}
function smokeSeed(id){
  const key=String(id||'');
  if(smokeSeedCache.has(key))return smokeSeedCache.get(key);
  const seed=(biomeHash(key)%997)/997;smokeSeedCache.set(key,seed);return seed;
}
function drawSmoke(spec,id,now){
  if(!worldPointVisible(spec.center,spec.z1||0,80))return;
  const p=w2s(spec.center,spec.z1),seed=smokeSeed(id),scale=Math.max(.55,State.view.scale),sprite=getSmokeParticleSprite();
  ctx.save();
  for(let i=0;i<4;i++){
    const phase=(now*.13+seed+i/4)%1;
    const fade=Math.pow(1-phase,1.7);
    const drift=Math.sin((phase*5.2+seed*8+i)*1.35)*3.2*scale+phase*5*scale;
    const y=p.y-phase*34*scale,x=p.x+drift,r=(2.2+phase*5.8)*scale,size=r*2.9;
    ctx.globalAlpha=fade*.72;
    ctx.drawImage(sprite,x-size/2,y-size/2,size,size);
  }
  ctx.restore();
}
function drawHouseChimneys(s){
  for(const spec of chimneySpecs(s))drawChimney(spec);
}
function drawChimneysAndSmoke(){
  if(State.view.scale<.32)return;
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
function woodGateLocal(s,x,y){
  const q=rotateVec(x,y,s.angle||0);
  return{x:s.x+q.x,y:s.y+q.y};
}
function drawWoodGateDoor(s){
  const d=rectDims(s),halfX=d.w/2,doorHalf=Math.min(.34,d.h*.32);
  const x=halfX+.012,z0=.035,z1=1.08;
  const center={x:s.x,y:s.y};
  const front=woodGateLocal(s,x,0);

  // Front leaf is only visible from the exterior side. From the rear, the
  // gatehouse mass hides it instead of letting a late canvas draw leak through.
  if(viewDepthPoint(front)<viewDepthPoint(center)-.01)return;

  const a=woodGateLocal(s,x,-doorHalf),b=woodGateLocal(s,x,doorHalf);
  const poly=[w2s(a,z0),w2s(b,z0),w2s(b,z1),w2s(a,z1)];
  pathPolygon(poly,'#4a2f1d','#8d6747',1);

  // Vertical planks + central meeting seam give the opening a readable gate leaf.
  const plankCount=6;
  ctx.save();
  ctx.strokeStyle='rgba(142,104,72,.70)';
  ctx.lineWidth=.75;
  for(let i=1;i<plankCount;i++){
    const t=i/plankCount,y=-doorHalf+(doorHalf*2)*t;
    const p0=w2s(woodGateLocal(s,x+.002,y),z0+.03);
    const p1=w2s(woodGateLocal(s,x+.002,y),z1-.035);
    ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();
  }

  const seam0=w2s(woodGateLocal(s,x+.004,0),z0+.02);
  const seam1=w2s(woodGateLocal(s,x+.004,0),z1-.02);
  ctx.strokeStyle='rgba(35,23,16,.88)';ctx.lineWidth=1.1;
  ctx.beginPath();ctx.moveTo(seam0.x,seam0.y);ctx.lineTo(seam1.x,seam1.y);ctx.stroke();

  // Two iron straps across the double leaf.
  ctx.strokeStyle='rgba(44,42,39,.82)';ctx.lineWidth=Math.max(1,.75*State.view.scale);
  for(const z of [.34,.78]){
    const p0=w2s(woodGateLocal(s,x+.006,-doorHalf+.035),z);
    const p1=w2s(woodGateLocal(s,x+.006,doorHalf-.035),z);
    ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();
  }
  ctx.restore();
}
function drawWoodGateBattlements(s,roofTop){
  const d=rectDims(s),angle=s.angle||0;
  const halfX=d.w/2+.015,halfY=d.h/2+.015;
  const z0=roofTop,z1=roofTop+.32;
  const merlonW=.18,merlonD=.16;
  const items=[];

  // Corners anchor the crenellation; long and short sides receive evenly spaced merlons.
  for(const x of [-halfX,halfX])for(const y of [-halfY,halfY]){
    items.push({x,y,w:merlonW,h:merlonD});
  }
  for(const y of [-halfY,halfY]){
    for(const x of [-halfX*.34,halfX*.34])items.push({x,y,w:merlonW,h:merlonD});
  }
  for(const x of [-halfX,halfX]){
    items.push({x,y:0,w:merlonD,h:merlonW});
  }

  for(const m of items){
    const c=woodGateLocal(s,m.x,m.y);
    extrudePolygonAt(rectWorldPoints(c.x,c.y,m.w,m.h,angle),z0,z1,{
      top:State.season==='winter'?WINTER_SNOW_TOP:'#805b3d',
      sideA:'#49321f',sideB:'#62432a',
      stroke:'#916946'
    });
  }
}
function drawWoodGate(s,preview=false){
  const d=rectDims(s),angle=s.angle||0;
  const halfX=d.w/2,halfY=d.h/2;
  const postR=.075,bodyTop=1.48,roofTop=1.62;
  const sideY=halfY-.09,step=.205;
  const selected=State.selectedId===s.id;

  // Two palisade-like side piers leave the central corridor physically open.
  for(const sy of [-sideY,sideY]){
    const usable=Math.max(.2,d.w-.16),count=Math.max(1,Math.ceil(usable/step));
    for(let i=0;i<=count;i++){
      const x=-usable/2+usable*(i/count);
      drawWoodPost(woodGateLocal(s,x,sy),postR,0,bodyTop,angle);
    }
  }

  // Stout jambs frame both mouths of the passage.
  const jambY=Math.min(.52,halfY-.22);
  for(const x of [-halfX+.08,halfX-.08])for(const y of [-jambY,jambY]){
    drawWoodPost(woodGateLocal(s,x,y),.09,0,bodyTop,angle);
  }

  // Flat timber roof / fighting deck.
  extrudePolygonAt(rectWorldPoints(s.x,s.y,d.w+.06,d.h+.06,angle),bodyTop,roofTop,{
    top:State.season==='winter'?WINTER_SNOW_TOP:'#8b6845',
    sideA:'#4f3927',sideB:'#65492f',
    stroke:selected?'#f4b76f':'#a27b54'
  });

  // Simple transverse lintels at front and rear reinforce the gate silhouette.
  for(const x of [-halfX+.035,halfX-.035]){
    const c=woodGateLocal(s,x,0);
    const pts=rectWorldPoints(c.x,c.y,.10,d.h-.10,angle);
    extrudePolygonAt(pts,1.18,1.32,{top:'#80603f',sideA:'#49331f',sideB:'#62462c',stroke:'#95704c'});
  }

  drawWoodGateDoor(s);
  drawWoodGateBattlements(s,roofTop);

  if(selected){
    pathPolygon(projectPath(footprintPoints(s),.025),null,'#f4b76f',2);
  }
}
function drawStoneTowerBase(s,preview=false){
  if(!isStoneTowerStructure(s))return;
  const style=towerBaseStyle(s);
  if(style==='standard')return;

  const stroke=State.selectedId===s.id?'#f4b76f':'#9f9285';
  if(style==='buttress'){
    const buttressTop=2.35+(towerTier(s)-1)*.12;
    for(const pts of stoneTowerButtressFootprints(s)){
      extrudePolygonAt(pts,0,buttressTop,{
        top:winterSnowColor('#948779'),
        sideA:'#4b4540',sideB:'#625a52',stroke
      });
    }
    return;
  }

  if(style==='splayed'){
    const bottom=stoneTowerSplayedFootprint(s),top=footprintPoints(s);
    if(bottom.length!==top.length||bottom.length<3)return;
    const faces=[];
    for(let i=0;i<bottom.length;i++){
      const j=(i+1)%bottom.length;
      const b0=w2s(bottom[i],0),b1=w2s(bottom[j],0);
      const t1=w2s(top[j],STONE_TOWER_BASE_HEIGHT),t0=w2s(top[i],STONE_TOWER_BASE_HEIGHT);
      const mid={x:(bottom[i].x+bottom[j].x)/2,y:(bottom[i].y+bottom[j].y)/2};
      const q=rotateViewPoint(mid);
      faces.push({
        poly:[b0,b1,t1,t0],
        depth:q.x+q.y,
        fill:castleSideShade(bottom[i],bottom[j])
      });
    }
    faces.sort((a,b)=>a.depth-b.depth);
    for(const face of faces)pathPolygon(face.poly,face.fill,stroke,.85);
  }
}
function drawPointStructure(s,preview=false){
  const selected=State.selectedId===s.id,h=structureHeight(s),stroke=selected?'#f4b76f':'#d8c8b4';
  if(isWoodTower(s)){drawWoodTower(s,preview);return}
  if(isWoodGate(s)){drawWoodGate(s,preview);return}
  if(s.type==='well'){
    // 3×3U paved civic square around the well. The square is walkable;
    // only the well body itself remains a physical obstacle.
    const plaza=rectWorldPoints(s.x,s.y,WELL_PLAZA_SIZE,WELL_PLAZA_SIZE,0);
    extrudePolygonAt(plaza,0,.055,{top:'#8d816e',sideA:'#655b4f',sideB:'#74695a',stroke:selected?'#f4b76f':'rgba(198,184,160,.65)'});
    const p0=w2s({x:s.x-WELL_PLAZA_SIZE/2,y:s.y},.058),p1=w2s({x:s.x+WELL_PLAZA_SIZE/2,y:s.y},.058);
    const p2=w2s({x:s.x,y:s.y-WELL_PLAZA_SIZE/2},.058),p3=w2s({x:s.x,y:s.y+WELL_PLAZA_SIZE/2},.058);
    ctx.save();ctx.strokeStyle='rgba(70,62,52,.28)';ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.moveTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.stroke();ctx.restore();

    extrudePolygon(footprintPoints(s),h,{top:'#84796d',sideA:'#4e4740',sideB:'#5d554d',stroke});
    const p=w2s({x:s.x,y:s.y},h+.04),r=Math.max(2.5,.28*U*State.view.scale);ctx.fillStyle='#172023';ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.7,r,0,0,Math.PI*2);ctx.fill();
    if(State.village.founded&&State.village.name){ctx.fillStyle='#f2e6d3';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(State.village.name,p.x,p.y-12)}
    return;
  }
  const tower=s.type==='tower',gate=s.type==='gate';
  extrudePolygon(footprintPoints(s),h,{
    top:(tower||gate)?winterSnowColor('#9a8e82'):'#88796b',
    sideA:(tower||gate)?'#49443f':'#4e4740',
    sideB:(tower||gate)?'#686057':'#62584f',
    stroke
  });
  if(tower)drawStoneTowerBase(s,preview);
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
  const winter=State.season==='winter';
  drawFlatRect(field,winter?'rgba(237,241,237,.88)':'rgba(133,111,55,.52)',winter?'rgba(126,139,130,.52)':'rgba(190,168,95,.58)');
  const g=fieldGrid(field);ctx.save();ctx.strokeStyle=winter?'rgba(151,163,155,.22)':'rgba(218,195,118,.28)';ctx.lineWidth=.7;
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
  const winter=State.season==='winter';
  const faces=[
    {kind:'roof',screen:[w2s(c0,wallH),w2s(c1,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:winter?WINTER_SNOW_A:(anthracite?'#303237':'#5b3d30'),stroke:winter?WINTER_SNOW_STROKE:(anthracite?'#55585e':'#8c6752'),lw:1},
    {kind:'roof',screen:[w2s(c3,wallH),w2s(c2,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:winter?WINTER_SNOW_B:(anthracite?'#3a3d42':'#6b4938'),stroke:winter?WINTER_SNOW_STROKE:(anthracite?'#55585e':'#8c6752'),lw:1},
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
  for(const f of faces)pathPolygon(f.poly,State.season==='winter'?(f.i%2?WINTER_SNOW_A:WINTER_SNOW_B):(f.i%2?'#303943':'#394550'),State.season==='winter'?(selected?'#f4b76f':WINTER_SNOW_STROKE):stroke,.75);
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
function drawAutoStructure(s,preview=false){
  ctx.save();if(preview)ctx.globalAlpha=.58;else if(underConstruction(s))ctx.globalAlpha=.38;
  if(s.type==='field'){
    drawField(s);
  }else if(s.type==='road'){
    const a=w2s(s.a),b=w2s(s.b);ctx.strokeStyle='rgba(126,106,82,.70)';ctx.lineWidth=Math.max(2,s.width*U*State.view.scale*.72);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }else if(s.type==='house')drawHouse(s);
  ctx.restore();if(underConstruction(s))drawConstructionProgress(s);
}
function structureCenter(s){if(s.x!=null)return{x:s.x,y:s.y};if(s.a&&s.b)return{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};return{x:0,y:0}}
