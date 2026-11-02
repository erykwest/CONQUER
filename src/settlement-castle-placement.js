'use strict';
// Construction placement, tower snapping, wall routing, and room models. Runtime semantics preserved from the monolith.
function rotateVec(x,y,a){const ca=Math.cos(a),sa=Math.sin(a);return{x:x*ca-y*sa,y:x*sa+y*ca}}
function toLocalPoint(s,p){const a=-(s.angle||0),v=rotateVec(p.x-s.x,p.y-s.y,a);return v}
function rectDims(s){const w=Number(s.w??s.size??1),h=Number(s.h??s.size??w);return{w,h}}
function placementAngle(center,p){return snapStructureAngle(Math.atan2(p.y-center.y,p.x-center.x))}
function orientedToolSpec(){
  if(State.tool.kind==='tower')return{type:'tower',shape:State.tool.shape,level:State.tool.level||State.buildLevels.tower,material:State.tool.material||'stone',masonryMaterial:State.buildMasonryMaterial,woodStyle:State.tool.woodStyle,woodRoof:State.tool.woodRoof,...(State.tool.shape==='round'?{r:State.tool.size}:{size:State.tool.size}),functions:[]};
  if(State.tool.kind==='gate'){
    if(State.tool.material==='wood')return{type:'gate',shape:'square',material:'wood',size:1.5,w:1,h:1.5,level:1,roofStyle:'flat',functions:[]};
    return{type:'gate',shape:'square',material:'stone',masonryMaterial:State.buildMasonryMaterial,size:1.5,level:State.tool.level||State.buildLevels.gate,functions:[]};
  }
  // Future point-buildings can pass a placementSpec without adding another interaction path.
  if(State.tool.placementSpec&&State.tool.placementSpec.shape!=='round')return{...State.tool.placementSpec,masonryMaterial:State.buildMasonryMaterial};
  return null;
}
function makePlacementPreview(q,angle=0){
  const spec=orientedToolSpec(),snapped=snapStructureAngle(angle),rotationStep=structureRotationStep(snapped);
  if(spec){
    const candidate={...spec,x:q.x,y:q.y,angle:snapped,rotationStep,previewOnly:true};
    if(candidate.type==='watermill')window.ConquerIndustries?.orientToWater(candidate);
    return candidate;
  }
  return null;
}
// Road magnet for gates: the centre lands on the nearest road centreline and the passage
// turns along the road, so the gate sits over it without cutting the way.
function gateRoadSnap(p){
  const radius=Math.max(1.2,linearMagnetRadius());let best=null;
  for(const r of roadList(false)){
    if(!r.a||!r.b||dist(r.a,r.b)<.05)continue;
    const q=closestPointOnSegment(p,r.a,r.b),d=dist(p,q);
    if(d<=radius&&(!best||d<best.d))best={d,point:q,road:r};
  }
  if(!best)return null;
  const r=best.road;
  return{point:{x:best.point.x,y:best.point.y},axis:snapStructureAngle(Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)),roadId:r.id};
}
// Orientation while the second click is pending: a locked angle wins; a road-snapped gate
// keeps its passage on the road and only chooses which mouth faces out.
function orientedDraftAngle(p){
  const d=State.draft;
  if(Number.isFinite(d?.lockedAngle))return d.lockedAngle;
  const free=placementAngle(d.center,p);
  if(!Number.isFinite(d?.roadAxis))return free;
  const off=x=>Math.abs(Math.atan2(Math.sin(free-x),Math.cos(free-x)));
  return snapStructureAngle(off(d.roadAxis)<=off(d.roadAxis+Math.PI)?d.roadAxis:d.roadAxis+Math.PI);
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
  if(s.type==='watermill')window.ConquerIndustries?.orientToWater(s);
  const ok=s.type==='tower'?addTowerWithPlacement(s,snap):addStructure(s);
  if(ok){
    State.draft=null;
    if(!snap.wallId&&!snap.parentTowerId)status((s.type==='gate'?'Gate':'Structure')+' placed — choose next position');
  }
  // Invalid placement keeps the red ghost available for another orientation.
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
// Magnet reach for linear tools: never less than LINEAR_POINT_MAGNET, and at least
// ~18 screen px so it still grabs when zoomed out (capped at 2.5 U).
function linearMagnetRadius(){
  const pxPerU=(typeof U==='number'?U:12)*(Number(State.view?.scale)||1);
  return Math.max(LINEAR_POINT_MAGNET,Math.min(2.5,18/Math.max(1e-6,pxPerU)));
}
// Free ends of walls/palisades of the type being drawn (also still under construction,
// so a run can be continued at once). Ends already seated on a tower or gate are taken.
function linearEndpointSnap(p,type,radius=linearMagnetRadius()){
  if(!['wall','palisade'].includes(type))return null;
  let best=null;
  for(const s of State.structures){
    if(s.type!==type||!s.a||!s.b)continue;
    for(const end of ['a','b']){
      if(end==='a'?s.aSnap:s.bSnap)continue;
      const d=dist(p,s[end]);
      if(d<=radius&&(!best||d<best.d))best={d,point:{x:s[end].x,y:s[end].y},wallId:s.id,end};
    }
  }
  return best;
}
// Free wall/palisade ends you can continue from, drawn on the wall top while the
// tool is active; the one under the pointer lights up (same look as moat magnets).
// With the road tool the magnets are the two ends of every bridge, at deck level.
function drawLinearMagnets(){
  const type=State.tool?.kind==='linear'?State.tool.linear:null;
  if(!['wall','palisade','road'].includes(type))return;
  const road=type==='road',linearHover=State.tool.linearHover;
  const hover=(road?linearHover?.bridgeEnd:linearHover?.endpoint)?linearHover.point:null,shown=new Set();
  ctx.save();
  for(const s of State.structures){
    if(s.type!==(road?'bridge':type)||!s.a||!s.b)continue;
    for(const end of ['a','b']){
      if(!road&&(end==='a'?s.aSnap:s.bSnap))continue;
      const q=s[end],key=q.x.toFixed(3)+','+q.y.toFixed(3);if(shown.has(key))continue;shown.add(key);
      const v=w2s(q,road?.09:structureHeight(s)),active=hover&&dist(q,hover)<.015;
      ctx.beginPath();ctx.arc(v.x,v.y,active?7:4,0,Math.PI*2);
      ctx.fillStyle=active?'#8dffbd':'#f3ce84';ctx.fill();
      ctx.lineWidth=active?2.5:1.5;ctx.strokeStyle='#314938';ctx.stroke();
    }
  }
  ctx.restore();
}
function snapAnchor(p){
  const radius=linearMagnetRadius();
  const terrace=State.tool?.kind==='linear'&&State.tool.linear==='wall'
    ?window.ConquerTerraforming?.snapWallAnchor(p,currentLinearSpec().width):null;
  let best=terrace?{id:terrace.structureId}:null,bestPoint=terrace?.point||null,bestScore=terrace?.score??Infinity;
  for(const s of State.structures){
    if(!['tower','gate'].includes(s.type)||underConstruction(s))continue;
    const q=boundaryPoint(s,p),score=dist(p,q);
    if(score<=radius&&score<bestScore){best=s;bestPoint=q;bestScore=score}
  }
  const end=linearEndpointSnap(p,State.tool?.linear,radius);
  if(end&&end.d<bestScore)return{point:end.point,structureId:null,magnet:true,endpoint:{wallId:end.wallId,end:end.end}};
  return best
    ?{point:bestPoint,structureId:best.id,magnet:true,terraceId:terrace&&best.id===terrace.structureId?terrace.terraceId:null,terraceEdge:terrace&&best.id===terrace.structureId?terrace.edgeIndex:null}
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
// Gate subtower sockets: the four corners (front fp[1], fp[2]; rear fp[0], fp[3]) and the middle of
// the two flanks (fp[0]->fp[1], fp[2]->fp[3]). Gate "front" is facade fp[1] -> fp[2].
const GATE_SUBTOWER_SOCKETS=['gate-front:1','gate-front:2','gate-rear:0','gate-rear:3','gate-side:0','gate-side:2'];
function gateSubtowerAttachment(parent,child,socketOrFront){
  const fp=footprintPoints(parent);if(fp.length<4)return null;
  // Exception to normal subtowers: here the socket marks the CONTACT point,
  // not the child centre. The child is pushed out along the ray from the gate
  // centre until its own perimeter touches the gate perimeter, keeping the portal clear.
  const socket=typeof socketOrFront==='string'?socketOrFront:'gate-front:'+(Number(socketOrFront)===2?2:1);
  const m=socket.match(/^gate-(front|rear|side):(\d)$/);if(!m)return null;
  const i=Number(m[2]),corner=m[1]==='side'?{x:(fp[i].x+fp[(i+1)%4].x)/2,y:(fp[i].y+fp[(i+1)%4].y)/2}:fp[i];
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
    subtowerSocket:socket,
    subtowerAngle:null
  };
}
function subtowerAttachmentAtSocket(parent,child,socket,radialAngle){
  if(!parent||!['tower','gate'].includes(parent.type)||!child||child.type!=='tower')return null;
  if(parent.type==='gate'){
    return gateSubtowerAttachment(parent,child,GATE_SUBTOWER_SOCKETS.includes(socket)?socket:'gate-front:1');
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

    // Gate parent: four corner sockets and two flank-centre sockets.
    if(parent.type==='gate'){
      for(const socket of GATE_SUBTOWER_SOCKETS){
        const attachment=gateSubtowerAttachment(parent,child,socket);if(!attachment)continue;
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
    status(parent?.type==='gate'?'Subtower attached to gate '+(String(tower.subtowerSocket).startsWith('gate-side')?'flank':String(tower.subtowerSocket).startsWith('gate-rear')?'rear corner':'front corner'):'Subtower attached to '+(parent?.shape==='round'?'tower perimeter':'tower corner'));
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
  return State.tool.span==='wide'?TYPES.builtWide:TYPES.built;
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
function functionSlotSize(s,index=0){
  if(!s)return'normal';
  if(s.type==='tower')return towerTier(s)>=3?'large':'normal';
  if(s.type==='built')return isWideBuilt(s)||Number(s.length)>=3?'large':'normal';
  return'normal';
}
function functionSlotUnits(s,index=0){return functionSlotSize(s,index)==='large'?2:1}
// The gate ground floor is an entrance passage; its functional rooms start upstairs.
function functionFloorOffset(s){return s?.type==='gate'?1:0}
function functionCapacity(s){
  if(!s)return 0;
  if(s.type==='gate')return Math.max(0,structureLevel(s)-1);
  if(s.type==='tower')return towerTier(s)>=2||s.isMastio?structureLevel(s):0; // The first T1 wood/stone keep needs its Common Hall.
  if(s.type==='built')return Number(s.length)>=2?builtInteriorFloors(s):0;
  return 0;
}
function functionCapacityUnits(s){
  let total=0;for(let i=0;i<functionCapacity(s);i++)total+=functionSlotUnits(s,i);return total;
}
function normalizeFunctions(s){
  const cap=functionCapacity(s);if(!Array.isArray(s.functions))s.functions=[];
  // Migrate once: prior saves placed a functional room on the traversable gate floor.
  if(s.type==='gate'&&!s.gateGroundIsPassage){
    if(s.functions.length>cap)s.functions=s.functions.slice(1);
    s.gateGroundIsPassage=true;
  }
  s.functions=s.functions.slice(0,cap).map(fn=>fn==='quarters'?'barracks':fn);
  while(s.functions.length<cap)s.functions.push(null);
  return s;
}
// Variant contract:
 // tower/gate -> roofStyle
 // wall/built -> skin
 // Renderer/UI steps must use structureVariant()/setStructureVariant() rather
 // than creating duplicate structure types.
function structureLabel(s){if(!s)return'';if(window.ConquerEvents3D?.is(s))return window.ConquerEvents3D.label(s);if(isCivicAnnex(s))return 'Annex · '+(civicAnnexDefinition(s)?.label||s.annexType||'unknown');if(window.ConquerIndustries?.is(s)){const t=window.ConquerIndustries.TYPES[s.type];return t.name+' · '+t.w+'×'+t.h+'U'};if(s.type==='house'){const l=houseLevel(s);return `House · L${l}${l===3?' · '+housePlanType(s)+' plan':l===4?' · elite · '+houseTurretType(s)+' turret':''}`};if(s.type==='market')return`Market · 4×4U · L${civicLevel(s)}`;if(s.type==='tavern')return`Tavern · double-T plan · L${civicLevel(s)}`;if(s.type==='church')return`Church · large · L${civicLevel(s)}`;if(typeof isWellCivic==='function'&&isWellCivic(s))return wellCivicLabel(s);if(s.type==='plaza')return`Piazza · ${plazaVariant(s)} · L${civicLevel(s)}`;if(s.type==='training')return'Training field · 5×4U';if(s.type==='well')return'Village well';if(s.type==='gate')return isWoodGate(s)?'Wood gate 1.5×1U · H1 · flat deck · battlements':`Gate 1.5×1.5U · L${structureLevel(s)}`;if(s.type==='tower'){if(isWoodTower(s))return woodTowerStyle(s)==='watchtower'?`Wood watchtower 1×1U · H1`:`Wood tower 1.5×1.5U · H1 · ${woodTowerRoof(s)==='pitched'?'pitched roof':'open top'}`;return (s.shape==='round'?`Round tower R${s.r}U`:`Square tower ${s.size}×${s.size}U`)+` · T${towerTier(s)} · L${structureLevel(s)}`+(s.parentTowerId?' · SUB':'')};if(s.type==='built')return`${isWideBuilt(s)?'Wide hall':'Built section'} ${s.length.toFixed(2)}U${isWideBuilt(s)?' × 2U':''} · L${structureLevel(s)}`;if(s.type==='wall')return`Wall ${s.length.toFixed(2)}U · T${wallTier(s)} (${s.width}U) · L${structureLevel(s)}`;if(s.type==='palisade')return`Palisade ${s.length.toFixed(2)}U · T${wallTier(s)} (${s.width}U)`;if(s.type==='road')return`${s.manualMain?'Main road':'Road'} ${(s.length||dist(s.a,s.b)).toFixed(2)}U`;return s.type}
