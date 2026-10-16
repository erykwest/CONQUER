'use strict';
// CONQUER settlement castle module — classic-script shared runtime.
function resize(){
  const r=wrap.getBoundingClientRect(),d=devicePixelRatio||1,w=Math.max(1,Math.round(r.width*d)),h=Math.max(1,Math.round(r.height*d));
  canvas.width=w;canvas.height=h;canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';screenCtx.setTransform(d,0,0,d,0,0);
  window.ConquerWebGPU?.resize?.(r.width,r.height,d);
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
let reliefBandSpatialCache=null;
function reliefLevels(){return State.relief?.hills?.flatMap(h=>h.levels||[])||[]}
function clearReliefBandCache(){reliefBandCache.clear();reliefBandSpatialCache=null;terrainElevationIndex=null;placementGroundZMemo=new WeakMap()}
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
    const poly=[oa,ob,edge.b,edge.a];
    return{levelId:level.id,index:i,kind:edge.kind,width:edge.width,z0:level.z0,z1:level.z1,a:edge.a,b:edge.b,oa,ob,poly,
      minX:Math.min(...poly.map(p=>p.x)),maxX:Math.max(...poly.map(p=>p.x)),
      minY:Math.min(...poly.map(p=>p.y)),maxY:Math.max(...poly.map(p=>p.y))};
  });
  reliefBandCache.set(level.id,bands);return bands;
}
function reliefBandAt(p){
  if(!reliefBandSpatialCache||reliefBandSpatialCache.relief!==State.relief){
    const cells=new Map(),size=8;
    for(const level of reliefLevels())for(const band of reliefEdgeBands(level)){
      for(let x=Math.floor(band.minX/size);x<=Math.floor(band.maxX/size);x++)
        for(let y=Math.floor(band.minY/size);y<=Math.floor(band.maxY/size);y++){
          const key=x+','+y;
          if(!cells.has(key))cells.set(key,[]);
          cells.get(key).push(band);
        }
    }
    reliefBandSpatialCache={relief:State.relief,cells,size};
  }
  const {cells,size}=reliefBandSpatialCache;
  let gentle=null;
  for(const band of cells.get(Math.floor(p.x/size)+','+Math.floor(p.y/size))||[]){
    if(p.x<band.minX||p.x>band.maxX||p.y<band.minY||p.y>band.maxY)continue;
    if(!pointInPolygon(p,band.poly))continue;
    if(band.kind==='steep')return band;
    gentle=band;
  }
  return gentle;
}
function terrainSlopeKind(p){return reliefBandAt(p)?.kind||null}
// A cliff is an impassable STEEP band, not just a large elevation delta.
// Gentle ascent remains traversable, including different H plateaux reached
// by a ramp. Sampling the segment prevents tunnelling through thin cliff bands.
const cliffSampleCache=new Map();
let cliffSampleRelief=null;
function cliffSampleAt(p){
  if(cliffSampleRelief!==State.relief){cliffSampleRelief=State.relief;cliffSampleCache.clear()}
  const gx=Math.round(p.x*10),gy=Math.round(p.y*10),key=gx+','+gy;
  if(cliffSampleCache.has(key))return cliffSampleCache.get(key);
  const blocked=terrainSlopeKind({x:gx/10,y:gy/10})==='steep';
  if(cliffSampleCache.size>120000)cliffSampleCache.clear();
  cliffSampleCache.set(key,blocked);
  return blocked;
}
function terrainSegmentCrossesCliff(a,b){
  const len=dist(a,b),steps=Math.max(1,Math.ceil(len/.12));
  for(let i=0;i<=steps;i++){
    const t=i/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    if(cliffSampleAt(p))return true;
  }
  return false;
}
// Bounding boxes of every relief level (top + slope bands) and band, so a point far from a
// hill skips its polygon tests. Same result as testing everything; rebuilt with the relief.
let terrainElevationIndex=null;
function terrainElevationLevels(){
  if(terrainElevationIndex&&terrainElevationIndex.relief===State.relief&&terrainElevationIndex.hills===State.relief?.hills)return terrainElevationIndex.levels;
  const levels=reliefLevels().map(level=>{
    const bands=reliefEdgeBands(level),pts=[...(level.top||[]),...bands.flatMap(b=>b.poly)];
    const box=pts.length?{x0:Math.min(...pts.map(q=>q.x)),y0:Math.min(...pts.map(q=>q.y)),x1:Math.max(...pts.map(q=>q.x)),y1:Math.max(...pts.map(q=>q.y))}:null;
    return{level,bands,box};
  });
  terrainElevationIndex={relief:State.relief,hills:State.relief?.hills,levels};
  return levels;
}
function terrainElevation(p){
  let z=0;
  for(const {level,bands,box} of terrainElevationLevels()){
    if(!box||p.x<box.x0||p.x>box.x1||p.y<box.y0||p.y>box.y1)continue;
    if(pointInPolygon(p,level.top)){z=Math.max(z,level.z1);continue}
    for(const band of bands){
      if(p.x<band.minX||p.x>band.maxX||p.y<band.minY||p.y>band.maxY||!pointInPolygon(p,band.poly))continue;
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
// Plan view (top-down editor aid): world axes map straight to the screen and height is ignored,
// so footprints, joints and the 0.5U grid can be placed exactly. Rotation still applies.
function isPlanView(){return !!State.view.plan}
function w2sRaw(p,z=0){
  const q=rotateViewPoint(p),s=U*State.view.scale;
  if(isPlanView())return{x:State.view.x+q.x*s,y:State.view.y+q.y*s};
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
  if(isPlanView()){const s=U*State.view.scale||1;return unrotateViewPoint({x:(x-State.view.x)/s,y:(y-State.view.y)/s})}
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
  if(isPlanView()){
    const side=WORLD*U;
    State.view.scale=clamp(Math.min(availW/side,availH/side),.18,3);
    State.view.x=(r.width-side*State.view.scale)/2;
    State.view.y=Math.max(38,(r.height-side*State.view.scale)/2+20);
    invalidateSceneCache();draw();return;
  }
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
  if(s.type==='bridge')return .12;
  if(s.type==='moat')return 0;
  if(window.ConquerIndustries?.is(s))return .35;
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
  if(['wall','palisade','built','moat','bridge'].includes(s.type))return linePoly(s);
  if(s.type==='house'){
    const parts=houseFootprintParts(s),pts=parts.flatMap(p=>p.points);
    if(parts.length===1)return pts;
    const cx=pts.reduce((a,p)=>a+p.x,0)/pts.length,cy=pts.reduce((a,p)=>a+p.y,0)/pts.length;
    return pts.slice().sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
  }
  if(s.type==='field')return fieldPoints(s);
  if(window.ConquerIndustries?.is(s))return window.ConquerIndustries.footprint(s);
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
// Memo per structure: the foundation profile samples the whole footprint on the terrain and
// was recomputed for every ground-plane draw call (hundreds of terrain samples per frame).
let placementGroundZMemo=new WeakMap();
function placementGroundZ(s){
  if(!s||typeof s!=='object')return placementGroundZUncached(s);
  const parent=s.parentTowerId?State.structures.find(o=>o.id===s.parentTowerId):null;
  const key=[s.type,s.x,s.y,s.angle,s.size,s.r,s.w,s.h,s.shape,s.level,s.tier,s.material,s.baseStyle,s.woodStyle,s.a?.x,s.a?.y,s.b?.x,s.b?.y,s.width,s.foundationVersion,s.groundZ,s.parentTowerId,
    parent?[parent.x,parent.y,parent.angle,parent.size,parent.r,parent.groundZ].join(','):'',State.relief?.seed,State.relief?.hills?.length].join('|');
  const hit=placementGroundZMemo.get(s);
  if(hit&&hit.key===key&&hit.relief===State.relief)return hit.z;
  const z=placementGroundZUncached(s);
  placementGroundZMemo.set(s,{key,relief:State.relief,z});
  return z;
}
function placementGroundZUncached(s){
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
const CUTAWAY_NEAR_ALPHA=.035;
const CUTAWAY_FAR_ALPHA=1;
const CUTAWAY_INNER_NEAR_ALPHA=.04;
const CUTAWAY_INNER_FAR_ALPHA=1;
const CUTAWAY_TOP_ALPHA=1;
const CUTAWAY_PROP_ASSET_PATHS=Object.freeze({
  crate:'./src/assets/interior/crate.svg',
  barrel:'./src/assets/interior/barrel.svg'
});
const cutawayPropSprites={};
function loadCutawayPropSprites(){
  for(const [key,path] of Object.entries(CUTAWAY_PROP_ASSET_PATHS)){
    const img=new Image();
    img.onload=()=>{
      cutawayPropSprites[key]=img;
      window.__conquerAssetCompiler?.clearComposite?.();
      if(typeof invalidateSceneCache==='function')invalidateSceneCache('castleBody');
      if(typeof draw==='function')draw();
    };
    img.onerror=()=>console.warn('Cutaway prop SVG load failed',path);
    img.src=path;
  }
}
loadCutawayPropSprites();
function cutawayPropSprite(key){const img=cutawayPropSprites[key];return img&&img.complete?img:null}
function cutawayEligible(s){
  if(!s||underConstruction(s))return false;
  if(s.type==='built')return true;
  // Stone gates open like square towers: the passage on the ground floor, rooms above.
  if(s.type==='gate')return !isWoodGate(s);
  // T1 towers are too small to read as useful rooms. Keep them solid until
  // they receive a dedicated spiral-stair interior treatment.
  return s.type==='tower'&&!isWoodTower(s)&&towerTier(s)>=2;
}
// A subtower follows its parent tower/gate: one switch on the parent opens the attached
// subtowers too (T1 subtowers stay solid, like any T1 tower).
function structureCutaway(s){
  if(s?.parentTowerId){
    const parent=State.structures.find(o=>o.id===s.parentTowerId);
    if(parent&&parent!==s)return structureCutaway(parent)&&cutawayEligible(s);
  }
  return !!s?.cutaway&&cutawayEligible(s);
}
// Footprints that cut into a cutaway room, up to the height they occupy: the parent of a
// subtower, the subtowers of a parent. Above that height the room's own walls continue.
function cutawayBlockers(s){
  if(!s)return[];
  const out=[];
  // The parent stays intact: only a subtower is cut where it meets its parent (a dividing
  // wall closes it there, see the World 3D cutaway mesh).
  if(s.parentTowerId){const p=State.structures.find(o=>o.id===s.parentTowerId);if(p)out.push({pts:footprintPoints(p),h:structureHeight(p),parent:true})}
  return out.filter(b=>b.pts?.length>2);
}
function cutawayWallThickness(s){
  if(s.type==='built')return clamp((Number(s.width)||1)*.14,.11,.17);
  if(s.type==='gate')return .16;
  return clamp(.11+towerTier(s)*.025,.13,.19);
}
function cutawayWallGeometry(s){
  const thickness=cutawayWallThickness(s);
  if(s.type==='tower'||s.type==='gate'){
    if(s.shape==='round'){
      const outer=footprintPoints(s),r=Math.max(.12,(Number(s.r)||.5)-thickness);
      return{outer,inner:circleWorldPoints(s.x,s.y,r,24),thickness};
    }
    const d=rectDims(s),iw=Math.max(.18,d.w-thickness*2),ih=Math.max(.18,d.h-thickness*2);
    return{
      outer:footprintPoints(s),
      inner:rectWorldPoints(s.x,s.y,iw,ih,s.angle||0),
      thickness
    };
  }
  if(s.type==='built'){
    const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx);
    const center={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};
    const iw=Math.max(.18,L-thickness*2),ih=Math.max(.18,(Number(s.width)||1)-thickness*2);
    return{
      outer:linePoly(s),
      inner:rectWorldPoints(center.x,center.y,iw,ih,angle),
      thickness
    };
  }
  return{outer:footprintPoints(s),inner:footprintPoints(s),thickness};
}
function cutawayFloorBasis(s,g){
  if(s.type==='built'){
    const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1;
    return{
      center:{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2},
      angle:Math.atan2(dy,dx),
      w:Math.max(.18,L-g.thickness*2),
      h:Math.max(.18,(Number(s.width)||1)-g.thickness*2)
    };
  }
  if(s.shape==='round'){
    const r=Math.max(.12,(Number(s.r)||.5)-g.thickness);
    return{center:{x:s.x,y:s.y},angle:s.angle||0,w:r*2,h:r*2};
  }
  const d=rectDims(s);
  return{
    center:{x:s.x,y:s.y},angle:s.angle||0,
    w:Math.max(.18,d.w-g.thickness*2),
    h:Math.max(.18,d.h-g.thickness*2)
  };
}
function cutawayFloorLevels(s){
  const level=structureLevel(s),h=structureHeight(s),floors=[{z:.055,material:'stone'}];
  if(level<=1)return floors;
  for(let i=1;i<level;i++)floors.push({z:h*i/level,material:'wood'});
  return floors;
}
function cutawayLocalRect(center,angle,x0,y0,x1,y1){
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const p=(x,y)=>({x:center.x+x*ca-y*sa,y:center.y+x*sa+y*ca});
  return[p(x0,y0),p(x1,y0),p(x1,y1),p(x0,y1)];
}
function clipToWorldPolygon(worldPts,z,fn){
  const screen=projectPath(worldPts,z);if(screen.length<3)return;
  ctx.save();ctx.beginPath();
  screen.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.closePath();ctx.clip();fn();ctx.restore();
}
function drawStoneTileFloor(s,g,z){
  const basis=cutawayFloorBasis(s,g),tile=.32;
  extrudePolygonAt(g.inner,Math.max(.005,z-.045),z,{
    top:'#7f796f',sideA:'#4c4842',sideB:'#5a554d',stroke:'#a59b8d'
  });
  clipToWorldPolygon(g.inner,z+.002,()=>{
    const nx=Math.ceil(basis.w/tile),ny=Math.ceil(basis.h/tile);
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++){
      const x0=-basis.w/2+ix*tile,x1=Math.min(basis.w/2,x0+tile);
      const y0=-basis.h/2+iy*tile,y1=Math.min(basis.h/2,y0+tile);
      const quad=cutawayLocalRect(basis.center,basis.angle,x0,y0,x1,y1);
      pathPolygon(projectPath(quad,z+.004),(ix+iy)%2?'#8d877c':'#716c64','rgba(61,57,52,.52)',.55);
    }
  });
}
function drawWoodFloor(s,g,z){
  const basis=cutawayFloorBasis(s,g),plank=.18;
  extrudePolygonAt(g.inner,Math.max(.01,z-.065),z,{
    top:'#795a3a',sideA:'#4b3424',sideB:'#5b402b',stroke:'#a27b50'
  });
  clipToWorldPolygon(g.inner,z+.002,()=>{
    const across=basis.h<=basis.w,span=across?basis.h:basis.w,count=Math.max(1,Math.ceil(span/plank));
    for(let i=0;i<count;i++){
      const a=-span/2+i*plank,b=Math.min(span/2,a+plank);
      const quad=across
        ?cutawayLocalRect(basis.center,basis.angle,-basis.w/2,a,basis.w/2,b)
        :cutawayLocalRect(basis.center,basis.angle,a,-basis.h/2,b,basis.h/2);
      pathPolygon(projectPath(quad,z+.004),i%2?'#84613e':'#6f5034','rgba(54,36,24,.48)',.45);
    }
  });
}
function drawCutawayFloors(s,g){
  for(const floor of cutawayFloorLevels(s)){
    if(floor.material==='stone')drawStoneTileFloor(s,g,floor.z);
    else drawWoodFloor(s,g,floor.z);
  }
}
function cutawayRoomSlots(s,g=cutawayWallGeometry(s)){
  // slot i is the room on floor i+offset (gates: the ground floor is the passage, no room).
  const floors=cutawayFloorLevels(s),basis=cutawayFloorBasis(s,g),off=functionFloorOffset(s),cap=Math.min(functionCapacity(s),floors.length-off);
  const roles=Array.isArray(s.functions)?s.functions:[];
  const out=[];
  for(let i=0;i<cap;i++)out.push({
    index:i,floor:i+off,role:roles[i]||null,size:functionSlotSize(s,i),
    z:floors[i+off].z,basis,g
  });
  return out;
}
function cutawayRoomPoint(slot,nx=0,ny=0){
  const b=slot.basis,x=nx*b.w*.40,y=ny*b.h*.36,ca=Math.cos(b.angle),sa=Math.sin(b.angle);
  return{x:b.center.x+x*ca-y*sa,y:b.center.y+x*sa+y*ca};
}
function drawCutawayInteriorBox(slot,nx,ny,wFrac,dFrac,height,top='#795a3a',sideA='#4b3424',sideB='#5b402b'){
  const p=cutawayRoomPoint(slot,nx,ny);
  const w=clamp(slot.basis.w*wFrac,.14,.78),d=clamp(slot.basis.h*dFrac,.10,.48);
  const pts=rectWorldPoints(p.x,p.y,w,d,slot.basis.angle);
  extrudePolygonAt(pts,slot.z+.012,slot.z+.012+height,{top,sideA,sideB,stroke:'#3d2a1c'});
}
function drawCutawayPropSprite(key,p,z,sizePx=18){
  const img=cutawayPropSprite(key);if(!img)return;
  const scale=clamp(State.view.scale,.55,1.45),h=sizePx*scale,w=h*(img.naturalWidth||128)/(img.naturalHeight||128);
  const q=w2s(p,z);
  ctx.save();ctx.globalAlpha=.98;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(img,q.x-w/2,q.y-h,w,h);ctx.restore();
}
function drawStorageRoomProps(slot){
  const large=slot.size==='large';
  const layout=large
    ?[['crate',-.72,-.46,18],['barrel',-.30,-.48,19],['crate',.12,-.43,17],['barrel',.53,-.38,18],['crate',-.50,.12,18],['barrel',.28,.15,19],['crate',.66,.20,16]]
    :[['crate',-.48,-.30,18],['barrel',.05,-.34,19],['crate',.48,.18,17]];
  for(const [key,x,y,size] of layout)drawCutawayPropSprite(key,cutawayRoomPoint(slot,x,y),slot.z+.035,size);
}
function drawBarracksRoomProps(slot){
  const rows=slot.size==='large'?[-.52,0,.52]:[-.44,0,.44];
  for(const x of rows)drawCutawayInteriorBox(slot,x,-.34,.22,.34,.055,'#775538','#4b3424','#5b402b');
  drawCutawayInteriorBox(slot,0,.48,.48,.16,.10,'#6b4a30','#422e20','#533923');
}
function drawNobleRoomProps(slot){
  drawCutawayInteriorBox(slot,-.18,-.24,.48,.44,.12,'#7e3d38','#4a2d27','#5b362e');
  drawCutawayInteriorBox(slot,.58,-.30,.20,.22,.18,'#805a35','#4b3424','#5c4028');
  drawCutawayInteriorBox(slot,.42,.42,.22,.22,.16,'#8b633b','#4b3424','#60452d');
  if(slot.size==='large')drawCutawayInteriorBox(slot,-.62,.42,.26,.18,.13,'#8a6238','#4b3424','#60452d');
}
// Painter order for the 2.5D cutaway: each floor slab, then that floor's furniture, bottom up,
// so a lower room never paints over the floor above it.
function drawCutawayFloorsAndProps(s,g){
  const F=window.ConquerCutawayFurniture;
  if(!F){drawCutawayFloors(s,g);drawCutawayInteriorProps(s,g);return}
  cutawayFloorLevels(s).forEach((floor,i)=>{
    if(floor.material==='stone')drawStoneTileFloor(s,g,floor.z);else drawWoodFloor(s,g,floor.z);
    F.draw(s,g,i);
  });
}
function drawCutawayInteriorProps(s,g){
  // Furniture library (settlement-cutaway-furniture.js); the boxes below are the fallback.
  if(window.ConquerCutawayFurniture?.draw(s,g))return;
  for(const slot of cutawayRoomSlots(s,g)){
    if(slot.role==='storage')drawStorageRoomProps(slot);
    else if(slot.role==='barracks'||slot.role==='quarters')drawBarracksRoomProps(slot);
    else if(slot.role==='nobleRoom')drawNobleRoomProps(slot);
  }
}
function drawCutawayWallRing(g,z,alpha=.72){
  const outer=projectPath(g.outer,z),inner=projectPath(g.inner,z);
  if(outer.length<3||inner.length<3)return;
  ctx.save();ctx.globalAlpha*=alpha;ctx.beginPath();
  outer.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
  inner.slice().reverse().forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
  ctx.fillStyle=State.season==='winter'?WINTER_SNOW_TOP:'#8f857a';ctx.fill('evenodd');
  ctx.strokeStyle='rgba(211,197,181,.52)';ctx.lineWidth=.75;ctx.stroke();
  ctx.restore();
}
function cutawayTransparentFaceIndexes(s,g){
  const n=g.outer.length;if(!n)return new Set();
  const depths=Array.from({length:n},(_,i)=>{
    const j=(i+1)%n;
    return (viewDepthPoint(g.outer[i])+viewDepthPoint(g.outer[j]))/2;
  });

  // Built sections are longitudinal rooms/ranges, not closed boxes.
  // In cutaway keep ONLY the rear long wall. Both short end walls are removed:
  // otherwise they read as arbitrary internal partitions, exactly the artifact
  // visible in the previous prototype.
  if(n===4&&s.type==='built'){
    const frontLong=depths[0]>=depths[2]?0:2;
    return new Set([frontLong,1,3]);
  }

  // Square towers and gates remove the two camera-facing faces.
  if(n===4&&((s.type==='tower'&&s.shape!=='round')||s.type==='gate')){
    const ranked=depths.map((depth,index)=>({depth,index})).sort((a,b)=>b.depth-a.depth);
    return new Set([ranked[0].index,ranked[1].index]);
  }

  // Round towers use an approximately 90° camera-facing wedge. The two radial
  // boundaries become the actual masonry section edges.
  if(s.type==='tower'&&s.shape==='round'){
    let peak=0;
    for(let i=1;i<n;i++)if(depths[i]>depths[peak])peak=i;
    const open=new Set();
    for(let d=-3;d<=3;d++)open.add((peak+d+n)%n);
    return open;
  }

  let peak=0;
  for(let i=1;i<n;i++)if(depths[i]>depths[peak])peak=i;
  return new Set([peak]);
}
function cutawayShellFaces(s,g,height){
  const outerBase=projectPath(g.outer,0),outerTop=projectPath(g.outer,height);
  const innerBase=projectPath(g.inner,0),innerTop=projectPath(g.inner,height);
  const transparent=cutawayTransparentFaceIndexes(s,g),faces=[];
  const n=Math.min(g.outer.length,g.inner.length);
  for(let i=0;i<n;i++){
    const j=(i+1)%n,edgeDepth=(viewDepthPoint(g.outer[i])+viewDepthPoint(g.outer[j]))/2;
    const near=transparent.has(i);
    faces.push({
      index:i,near,
      // Built short ends (1/3) are actual section removals. Do not paint even
      // a translucent panel there; only the rear-wall section jamb remains.
      ghost:!(s.type==='built'&&near&&(i===1||i===3)),
      depth:edgeDepth,
      outer:[outerBase[i],outerBase[j],outerTop[j],outerTop[i]],
      inner:[innerBase[i],innerBase[j],innerTop[j],innerTop[i]],
      shade:castleSideShade(g.outer[i],g.outer[j])
    });
  }
  faces.sort((a,b)=>a.depth-b.depth);
  return{faces,transparent};
}
function cutawayBoundaryVertices(transparent,count){
  const vertices=[];
  for(let v=0;v<count;v++){
    const prev=(v-1+count)%count;
    const next=v;
    if(transparent.has(prev)!==transparent.has(next))vertices.push(v);
  }
  return vertices;
}
function drawCutawaySectionJambs(g,height,transparent){
  const n=Math.min(g.outer.length,g.inner.length);
  const boundaries=cutawayBoundaryVertices(transparent,n);
  for(const i of boundaries){
    const outer=g.outer[i],inner=g.inner[i];
    const poly=[
      w2s(outer,0),w2s(inner,0),
      w2s(inner,height),w2s(outer,height)
    ];
    pathPolygon(poly,'#82776c','rgba(222,207,190,.72)',1.05);
  }
}
function drawCutawayFlatRoofDeck(s,g,height){
  if(s.type!=='tower'||towerRoofStyle(s)!=='battlement')return;
  // The old union renderer supplied the tower's solid top. Cutaway towers are
  // deliberately removed from that union, so restore the full opaque fighting
  // deck explicitly: wall ring + inner stone slab.
  extrudePolygonAt(g.inner,Math.max(.01,height-.07),height,{
    top:winterSnowColor('#8f857a',WINTER_SNOW_TOP),
    sideA:'#514a44',sideB:'#635951',
    stroke:State.season==='winter'?WINTER_SNOW_STROKE:'#b8aa99'
  });
}
function drawCutawayShellFaces(faces,near){
  for(const face of faces){
    if(face.near!==near||face.ghost===false)continue;
    ctx.save();ctx.globalAlpha*=near?CUTAWAY_NEAR_ALPHA:CUTAWAY_FAR_ALPHA;
    pathPolygon(face.outer,face.shade,near?'rgba(216,200,180,.34)':null,near?.8:1);
    ctx.restore();

    ctx.save();ctx.globalAlpha*=near?CUTAWAY_INNER_NEAR_ALPHA:CUTAWAY_INNER_FAR_ALPHA;
    pathPolygon(face.inner,near?'#5a514a':'#61574f',near?'rgba(205,188,169,.28)':'rgba(199,181,163,.30)',.65);
    ctx.restore();
  }
}
function drawBuiltCutawayShell(s,g,height){
  // Built sections are open longitudinal ranges in cutaway. Do not run the
  // generic four-sided box renderer at all: it was the source of the stubborn
  // full-height end panel. Draw exactly one opaque rear wall plus its thickness.
  const depths=[0,1,2,3].map(i=>{
    const j=(i+1)%4;
    return (viewDepthPoint(g.outer[i])+viewDepthPoint(g.outer[j]))/2;
  });
  const frontLong=depths[0]>=depths[2]?0:2;
  const rearLong=frontLong===0?2:0;
  const j=(rearLong+1)%4;

  const outer=[
    w2s(g.outer[rearLong],0),w2s(g.outer[j],0),
    w2s(g.outer[j],height),w2s(g.outer[rearLong],height)
  ];
  const inner=[
    w2s(g.inner[rearLong],0),w2s(g.inner[j],0),
    w2s(g.inner[j],height),w2s(g.inner[rearLong],height)
  ];

  pathPolygon(outer,castleSideShade(g.outer[rearLong],g.outer[j]),null);
  pathPolygon(inner,'#61574f','rgba(199,181,163,.30)',.65);

  // Only the two thin cut surfaces belonging to the rear wall thickness.
  // These are masonry section edges, NOT short end walls.
  for(const i of [rearLong,j]){
    const strip=[
      w2s(g.outer[i],0),w2s(g.inner[i],0),
      w2s(g.inner[i],height),w2s(g.outer[i],height)
    ];
    pathPolygon(strip,'#82776c','rgba(222,207,190,.72)',1.05);
  }
}
function drawCutawayStructure(s){
  if(!structureCutaway(s)||underConstruction(s))return;
  const render=()=>{
    const g=cutawayWallGeometry(s),height=structureHeight(s);

    if(s.type==='built'){
      // Dedicated built-section cutaway: one rear wall, zero short end walls.
      drawBuiltCutawayShell(s,g,height);
      drawCutawayFloorsAndProps(s,g);
      drawCutawayWallRing(g,height,CUTAWAY_TOP_ALPHA);
      drawBuiltDetails(s,false);
      if(builtSkin(s)==='arcade'){
        ctx.save();ctx.globalAlpha*=.72;drawBuiltArcade(s);ctx.restore();
      }
      return;
    }

    const shell=cutawayShellFaces(s,g,height);
    drawCutawayShellFaces(shell.faces,false);
    drawCutawayFloorsAndProps(s,g);
    drawCutawaySectionJambs(g,height,shell.transparent);
    drawCutawayShellFaces(shell.faces,true);
    drawCutawayWallRing(g,height,CUTAWAY_TOP_ALPHA);
    drawCutawayFlatRoofDeck(s,g,height);

    if(s.type==='tower'){
      ctx.save();ctx.globalAlpha*=.28;drawStoneTowerBase(s,false);ctx.restore();
    }
  };
  if(s.type==='tower'||s.type==='gate')withStructureGroundPlane(s,render);else render();
}
function drawCutawayStructures(){
  State.structures
    .filter(s=>structureCutaway(s)&&!underConstruction(s))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b))
    .forEach(drawCutawayStructure);
}
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
  const items=State.structures.filter(s=>isCastlePart(s)&&!underConstruction(s)&&!structureCutaway(s));
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
    if(!isCastlePart(s)||underConstruction(s)||structureCutaway(s))continue;
    if(s.type==='built'){
      drawBuiltDetails(s,false);
      drawBuiltArcade(s);
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
  // Selection is a dynamic outline, not a cached material tint: all buildings
  // remain legible after selecting them, including wood, civic, houses and sites.
  const s=State.structures?.find(item=>item.id===State.selectedId);
  if(!s||s.type==='road'||s.type==='moat'||s.type==='bridge')return;
  const areas=s.type==='field'?[{points:fieldPoints(s),height:0}]:
    s.type==='house'?urbanHouseDisplayParts(s).map(part=>({
      points:part.points,height:part.bodyH||houseBodyHeight(s)
    })):
    isCivic(s)?civicParts(s).map(part=>({
      points:part.points,height:part.role==='plaza'?.12:structureHeight(s)
    })):[{points:footprintPoints(s),height:structureHeight(s)}];
  withStructureGroundPlane(s,()=>{
    ctx.save();
    ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
    for(const item of areas){
      if(!item.points?.length||item.points.length<3)continue;
      const h=underConstruction(s)?Math.max(.10,item.height*constructionProgress(s)):item.height;
      const bottom=projectPath(item.points,0),top=projectPath(item.points,h);
      // Black keyline provides contrast over snow, sandstone and glowing roofs.
      for(const [color,width] of [['rgba(24,16,10,.92)',4.5],['#ffc46e',2.25]]){
        ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
        for(const ring of [top,bottom]){
          ring.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
          ctx.closePath();
        }
        if(h>.12)for(let i=0;i<top.length;i++){
          ctx.moveTo(bottom[i].x,bottom[i].y);ctx.lineTo(top[i].x,top[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

function worldDepth(s){const p=rotateViewPoint(structureCenter(s));return p.x+p.y;}
function pointInScreenPolygon(p,poly){
  let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j],hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside;
  }return inside;
}
function screenHitStructureBodyAtFootprint(fp,p,h){
  const base=projectPath(fp,0),top=projectPath(fp,h);
  if(pointInScreenPolygon(p,base)||pointInScreenPolygon(p,top))return true;
  for(let i=0;i<fp.length;i++){
    const j=(i+1)%fp.length;
    if(pointInScreenPolygon(p,[base[i],base[j],top[j],top[i]]))return true;
  }
  return false;
}
function screenHitStructureBody(s,p){
  if(s.type==='house'||isCivic(s)){
    const parts=s.type==='house'?urbanHouseDisplayParts(s):civicParts(s);
    const h=structureHeight(s);
    for(const part of parts){
      const ph=part.role==='plaza'?.78:part.role==='tower'?h:Math.min(h,s.type==='church'?2.52:h);
      const fp=part.points,base=projectPath(fp,0),top=projectPath(fp,ph);
      if(pointInScreenPolygon(p,base)||pointInScreenPolygon(p,top))return true;
      for(let i=0;i<fp.length;i++){const j=(i+1)%fp.length;if(pointInScreenPolygon(p,[base[i],base[j],top[j],top[i]]))return true}
    }
    return false;
  }
  const fp=footprintPoints(s);if(fp.length<3)return false;
  if(window.ConquerIndustries?.is(s)){
    const ground=Number.isFinite(s.groundZ)?s.groundZ:window.ConquerIndustries.groundLevel(s);
    return withProjectionGroundZ(ground,()=>screenHitStructureBodyAtFootprint(fp,p,structureHeight(s)));
  }
  const h=structureHeight(s),base=projectPath(fp,0),top=projectPath(fp,h);
  if(pointInScreenPolygon(p,base)||pointInScreenPolygon(p,top))return true;
  for(let i=0;i<fp.length;i++){const j=(i+1)%fp.length;if(pointInScreenPolygon(p,[base[i],base[j],top[j],top[i]]))return true}
  return false;
}
function screenHitStructure(s,p){
  return isPlacementFoundationBuilding(s)
    ?withStructureGroundPlane(s,()=>screenHitStructureBody(s,p))
    :screenHitStructureBody(s,p);
}
