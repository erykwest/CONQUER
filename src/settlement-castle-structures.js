'use strict';
// Masonry, palisades, timber towers, roofing, and fortification details. Runtime semantics preserved from the monolith.
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
// Clips drawing to the area outside every hull. Each hull gets its own even-odd clip (frame +
// hull): a single compound path would XOR overlapping hulls and reveal what both of them hide.
function clipOutsideHulls(hulls,x,y,w,h){
  for(const hull of hulls){
    if(hull.length<3)continue;
    ctx.beginPath();ctx.rect(x,y,w,h);
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();ctx.clip('evenodd');
  }
}
function withPalisadeConnectionOcclusion(s,drawFn){
  const occluders=palisadeConnectionOccluders(s);
  if(!occluders.length){drawFn();return}
  const r=wrap.getBoundingClientRect();
  ctx.save();
  clipOutsideHulls(occluders.map(structureScreenSilhouette),-48,-48,r.width+96,r.height+96);
  drawFn();ctx.restore();
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
  const h=structureHeight(s),rise=clamp((Number(s.width)||1)*.46,.32,isWideBuilt(s)?.92:.56);
  const ridgeA={x:(p[0].x+p[3].x)/2,y:(p[0].y+p[3].y)/2};
  const ridgeB={x:(p[1].x+p[2].x)/2,y:(p[1].y+p[2].y)/2};
  return{p,h,rise,ridgeA,ridgeB,ridgeH:h+rise};
}
// Wide-hall buttresses on the lancet facade, one on every bay line (n lancets -> n+1),
// with the stepped profile of steppedButtressPieces (shared with buttressed towers).
function wideHallButtresses(s){
  if(!isWideBuilt(s))return[];
  const side=-wallExteriorSide(s),edge=linearFacadeEdge(s,side);
  const lancet=builtWindowRows(s).find(r=>r[3]==='hallLancet');
  const n=builtWindowCount(edge,0,4,lancet?lancet[4]:.86),cell=edge.length/n;
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,u={x:dx/L,y:dy/L},o={x:-u.y*side,y:u.x*side};
  const mid={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2},w=.22,h=structureHeight(s),out=[];
  for(let k=0;k<=n;k++){
    const t=clamp(k*cell-edge.length/2,-edge.length/2+w/2,edge.length/2-w/2);
    out.push(steppedButtressPieces({x:mid.x+u.x*t,y:mid.y+u.y*t},u,o,h,w));
  }
  return out;
}
// One renderer for both 3D paths: flat pieces as prisms, sloped ones as frustums.
function buttressPieceIsPrism(p){return p.top===p.bottom}
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
  clipOutsideHulls(occluders.map(structureScreenSilhouette),-48,-48,r.width+96,r.height+96);
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
  clipOutsideHulls(occluders.map(structureScreenSilhouette),-32,-32,r.width+64,r.height+64);
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
function machicolationFloorPolygon(s){
  if(!hasMachicolation(s))return null;
  if(s.type==='wall'){
    const g=wallExteriorLayout(s),inner=g.width/2-.035,outer=g.width/2+.145;
    return{pts:[
      {x:s.a.x+g.nx*inner*g.side,y:s.a.y+g.ny*inner*g.side},
      {x:s.b.x+g.nx*inner*g.side,y:s.b.y+g.ny*inner*g.side},
      {x:s.b.x+g.nx*outer*g.side,y:s.b.y+g.ny*outer*g.side},
      {x:s.a.x+g.nx*outer*g.side,y:s.a.y+g.ny*outer*g.side}
    ],z:structureHeight(s)};
  }
  if(s.type==='tower'){
    const z=structureHeight(s);
    if(s.shape==='round')return{pts:circleWorldPoints(s.x,s.y,(Number(s.r)||.5)+.115,24),z};
    const d=rectDims(s);return{pts:rectWorldPoints(s.x,s.y,d.w+.22,d.h+.22,s.angle||0),z};
  }
  return null;
}
function drawMachicolationFloor(s){
  const spec=machicolationFloorPolygon(s);if(!spec)return;
  const draw=()=>extrudePolygonAt(spec.pts,spec.z-.055,spec.z+.035,{
    top:winterSnowColor('#918579'),sideA:'#4a443e',sideB:'#605750',stroke:'#b3a596'
  });
  if(s.type==='tower')withStructureGroundPlane(s,draw);else draw();
}
function drawMachicolationFloors(){
  const items=State.structures.filter(s=>!underConstruction(s)&&hasMachicolation(s)).slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of items)withStructureVisualMaterial(s,()=>drawMachicolationFloor(s));
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
function battlementPolygonPiece(kind,pts,z0,z1,owner=null){
  const center={x:pts.reduce((sum,p)=>sum+p.x,0)/Math.max(1,pts.length),y:pts.reduce((sum,p)=>sum+p.y,0)/Math.max(1,pts.length)},rp=rotateViewPoint(center);
  return{kind,pts,z0,z1,depth:rp.x+rp.y,ownerId:owner?.id||null,ownerType:owner?.type||null,ownerDepth:owner?worldDepth(owner):null,ownerTop:owner?structureHeight(owner):null,groundZ:owner?placementGroundZ(owner):null};
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
  clipOutsideHulls(occluders.map(battlementOccluderHull),-48,-48,frame.viewportW+96,frame.viewportH+96);
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
    if(piece.kind==='machicolationCorbel'){
      extrudePolygonAt(piece.pts,piece.z0,piece.z1,{top:winterSnowColor('#887d72'),sideA:'#403b36',sideB:'#554d46',stroke:'#9f9183'});
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
  const owners=new Map(State.structures.map(s=>[s.id,s]));
  for(const piece of pieces)withStructureVisualMaterial(owners.get(piece.ownerId),()=>drawBattlementPiece(piece,frame));
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
  const g=wallExteriorLayout(s),depth=Math.min(.28,Math.max(.18,g.width*.46)),mach=hasMachicolation(s),pieces=[];
  const edgeOffset=mach?g.width/2+depth/2+.045:Math.max(0,g.width/2-depth/2-.012);
  const intervals=battlementIntervalCount(g.usable),step=g.usable/intervals;
  for(let i=0;i<=intervals;i++){
    const along=g.startPad+step*i,t=clamp(along/g.L,0,1);
    const center={x:s.a.x+g.dx*t+g.nx*edgeOffset*g.side,y:s.a.y+g.dy*t+g.ny*edgeOffset*g.side};
    if(mach){
      const cc={x:center.x-g.nx*.10*g.side,y:center.y-g.ny*.10*g.side};
      pieces.push(battlementPolygonPiece('machicolationCorbel',rectWorldPoints(cc.x,cc.y,.115,.16,g.angle),g.z-.23,g.z+.015,s));
    }
    const piece=battlementPiece(center,g.angle,g.z,.28,depth,.24,s);
    if(!mach)piece.wallCrest=g.crest;
    pieces.push(piece);
  }
  return pieces;
}
function squareTowerBattlementPieces(s){
  const fp=footprintPoints(s),z=structureHeight(s);if(fp.length<4)return[];
  const pieces=[],center={x:s.x,y:s.y},cornerAngle=s.angle||0,mach=hasMachicolation(s);
  const perSide=[0,3,4,5][towerTier(s)]||3,intervals=perSide-1,inset=mach?-.075:.115;
  for(const corner of fp){
    const dx=center.x-corner.x,dy=center.y-corner.y,L=Math.hypot(dx,dy)||1,mc={x:corner.x+dx/L*inset,y:corner.y+dy/L*inset};
    if(mach){
      const ML=Math.hypot(center.x-mc.x,center.y-mc.y)||1,cc={x:mc.x+(center.x-mc.x)/ML*.09,y:mc.y+(center.y-mc.y)/ML*.09};
      pieces.push(battlementPolygonPiece('machicolationCorbel',rectWorldPoints(cc.x,cc.y,.115,.15,cornerAngle),z-.23,z+.015,s));
    }
    pieces.push(battlementPiece(mc,cornerAngle,z,.27,.23,.25,s));
  }
  for(let e=0;e<fp.length;e++){
    const a=fp[e],b=fp[(e+1)%fp.length],dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    let ix=center.x-mid.x,iy=center.y-mid.y,IL=Math.hypot(ix,iy)||1;ix/=IL;iy/=IL;
    for(let i=1;i<intervals;i++){
      const t=i/intervals,mc={x:a.x+dx*t+ix*inset,y:a.y+dy*t+iy*inset};
      if(mach){
        const cc={x:mc.x+ix*.09,y:mc.y+iy*.09};
        pieces.push(battlementPolygonPiece('machicolationCorbel',rectWorldPoints(cc.x,cc.y,.11,.15,angle),z-.23,z+.015,s));
      }
      pieces.push(battlementPiece(mc,angle,z,.25,.22,.24,s));
    }
  }
  return pieces;
}
function roundTowerBattlementPieces(s){
  const z=structureHeight(s),mach=hasMachicolation(s),baseR=Number(s.r)||.5,r=Math.max(.16,baseR+(mach?.075:-.09));
  const count=[0,6,8,12][towerTier(s)]||6,pieces=[];
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2,center={x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r};
    if(mach){
      const cr=baseR+.005,cc={x:s.x+Math.cos(a)*cr,y:s.y+Math.sin(a)*cr};
      pieces.push(battlementPolygonPiece('machicolationCorbel',rectWorldPoints(cc.x,cc.y,.105,.15,a+Math.PI/2),z-.23,z+.015,s));
    }
    pieces.push(battlementPiece(center,a+Math.PI/2,z,.23,.18,.23,s));
  }
  return pieces;
}
function towerBattlementPieces(s){
  if(s.type!=='tower'||isWoodTower(s)||underConstruction(s)||!['battlement','machicolation'].includes(towerRoofStyle(s)))return[];
  return withoutBuriedBattlements(s,s.shape==='round'?roundTowerBattlementPieces(s):squareTowerBattlementPieces(s));
}
// Parent/subtower pairs overlap: merlons of the lower one that fall inside the footprint of the
// taller attached structure would stick out of its walls. Drop them (parent or subtower alike).
function withoutBuriedBattlements(s,pieces){
  const related=State.structures.filter(o=>o!==s&&!underConstruction(o)&&['tower','gate'].includes(o.type)&&
    (o.id===s.parentTowerId||o.parentTowerId===s.id));
  if(!related.length||!pieces.length)return pieces;
  const taller=related.map(o=>({pts:footprintPoints(o),h:structureHeight(o)})).filter(o=>o.pts?.length>2);
  return pieces.filter(p=>{
    const c={x:p.pts.reduce((a,q)=>a+q.x,0)/p.pts.length,y:p.pts.reduce((a,q)=>a+q.y,0)/p.pts.length};
    return !taller.some(o=>o.h>p.z0+.01&&pointInPolygon(c,o.pts));
  });
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
  clipOutsideHulls(occluders.map(structureScreenSilhouette),-48,-48,r.width+96,r.height+96);
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
  for(const s of towers)withStructureVisualMaterial(s,()=>drawTowerRoof(s));
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
  for(const s of gates)withStructureVisualMaterial(s,()=>drawGateRoof(s));
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

  ctx.save();
  ctx.beginPath();ctx.moveTo(tl.x,tl.y);ctx.lineTo(tr.x,tr.y);
  ctx.lineTo(br.x,br.y);ctx.lineTo(bl.x,bl.y);ctx.closePath();ctx.clip();
  const herald=State.heraldry||{};
  if(!window.__conquerHeraldryCanvas?.paint(ctx,tl.x,Math.min(tl.y,tr.y),clothW,clothH+Math.abs(wave))){
    ctx.fillStyle=herald.c1||REIGN_COLOR_1;ctx.fillRect(tl.x,tl.y,clothW,clothH);
    ctx.fillStyle=herald.c2||REIGN_COLOR_2;ctx.fillRect(tl.x+clothW/2,tl.y,clothW/2,clothH);
  }
  ctx.restore();
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
    }else if(s.type==='tower'&&!isWoodTower(s)&&['battlement','machicolation'].includes(towerRoofStyle(s))){
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
function fireSources(){return towerTorchSources().concat(battlementBrazierSources(),window.ConquerGates?.torchSources()||[])}
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
  // Gate torches have mesh brackets in the 3D world.
  if(!window.ConquerWorld3D?.active?.())for(const src of window.ConquerGates?.torchSources()||[])drawTorchFixture(src);
  for(const src of battlementBrazierSources())drawBrazierFixture(src);
}
// WebGL2 owns the glow halo; only the small animated flame remains a Canvas effect.
function drawFireFlamesOnly(nf){
  if(nf<=.01)return;
  const scale=clamp(State.view.scale,.55,1.45);
  for(const src of fireSources()){
    const localZ=src.z+(src.kind==='brazier'?.08:0);
    const p=Number.isFinite(src.groundZ)?w2sRaw(src.p,localZ+src.groundZ):w2s(src.p,localZ);
    drawScreenFlame(p,scale,src.id,src.kind==='brazier');
  }
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
  return withoutBuriedBattlements(s,pieces);
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
    const dense=urbanDenseParts(s);
    if(dense.length){
      // One chimney per derived townhouse; no phantom chimney at lot center.
      const bodies=new Map();
      for(const part of dense)if(part.kind==='body'&&!bodies.has(part.buildingKey))bodies.set(part.buildingKey,part);
      let index=0;
      for(const part of bodies.values()){
        const ridge=housePartRidge(s,part);
        specs.push({center:part.center,angle:part.roofAngle,z0:ridge-.05,z1:ridge+.43,index:index++});
      }
      return specs;
    }
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
    // A hall has one hearth per end: two stacks, whatever its length.
    const count=isWideBuilt(s)?2:Math.max(1,Math.ceil(ridgeLength/CHIMNEY_SPACING));
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
