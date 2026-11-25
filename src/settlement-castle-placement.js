'use strict';
// Construction placement, tower snapping, wall routing, and room models. Runtime semantics preserved from the monolith.
function rotateVec(x,y,a){const ca=Math.cos(a),sa=Math.sin(a);return{x:x*ca-y*sa,y:x*sa+y*ca}}
function toLocalPoint(s,p){const a=-(s.angle||0),v=rotateVec(p.x-s.x,p.y-s.y,a);return v}
function rectDims(s){if(isOrientedTower(s))return orientedTowerDims(s);const w=Number(s.w??s.size??1),h=Number(s.h??s.size??w);return{w,h}}
function placementAngle(center,p){return snapStructureAngle(Math.atan2(p.y-center.y,p.x-center.x))}
function orientedToolSpec(){
  if(State.tool.kind==='tower'){
    const spec={type:'tower',shape:State.tool.shape,level:State.tool.level||State.buildLevels.tower,material:State.tool.material||'stone',masonryMaterial:State.buildMasonryMaterial,woodStyle:State.tool.woodStyle,woodRoof:State.tool.woodRoof,...(State.tool.shape==='round'?{r:State.tool.size}:{size:State.tool.size}),functions:[]};
    // H4 exists only on the square stone W2 tower (#174): never place a level the load would clamp away.
    if(typeof maxStructureLevel==='function')spec.level=Math.max(1,Math.min(Number(spec.level)||1,maxStructureLevel(spec)));
    return spec;
  }
  if(State.tool.kind==='gate'){
    if(State.tool.material==='wood')return{type:'gate',shape:'square',material:'wood',size:1.5,w:1,h:1.5,level:1,roofStyle:'flat',functions:[]};
    const size=State.tool.size||GATE_SIZES.large,max=size<1.25?SMALL_GATE_MAX_LEVEL:3;
    return{type:'gate',shape:'square',material:'stone',masonryMaterial:State.buildMasonryMaterial,size,level:Math.min(max,State.tool.level||State.buildLevels.gate),functions:[]};
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
    if(candidate.type==='pier')window.ConquerPier?.snapToCoast(candidate);
    // On a hillside the tower turns its door to the summit (towerEntranceSummitVerdict).
    if(candidate.type==='tower'&&typeof orientTowerToSummit==='function')orientTowerToSummit(candidate,{wallSnapped:!!State.draft?.wallSnapId});
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
// Walls across a main road (WALL-ROAD-GATE): where a new wall or palisade crosses a main road
// a gate of the matching type straddles the crossing and the wall is cut on its two flanks.
// Palisade -> wood gate; stone/brick wall W1 -> small gate, W2-W3 -> large gate.
function wallRoadGateRoad(r){
  return r?.type==='road'&&!!r.a&&!!r.b&&(isPrimaryRoad(r)||r.roadClass==='arterial-gate'||r.roadClass==='arterial-repair');
}
function wallRoadGateSpec(wall){
  if(wall?.type==='palisade')return{type:'gate',shape:'square',material:'wood',size:1.5,w:1,h:1.5,level:1,roofStyle:'flat',functions:[]};
  if(wall?.type!=='wall')return null;
  const small=wallTier(wall)<=1,size=small?GATE_SIZES.small:GATE_SIZES.large,max=small?SMALL_GATE_MAX_LEVEL:3;
  return{type:'gate',shape:'square',material:'stone',masonryMaterial:wall.masonryMaterial==='brick'?'brick':'stone',
    size,level:Math.min(max,Math.max(1,Number(State.buildLevels?.gate)||1)),functions:[]};
}
function segmentCrossing(a,b,c,d){
  const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;
  if(Math.abs(den)<1e-9)return null;
  const qx=c.x-a.x,qy=c.y-a.y,t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
  return t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9?{t:clamp(t,0,1),point:{x:a.x+rx*t,y:a.y+ry*t}}:null;
}
// Main-road crossings along one wall segment, ordered from a to b. A crossing already covered
// by an existing gate (the wall reaching a gate that stands on the road) is not a new gate.
function wallRoadCrossings(wall){
  const out=[];
  for(const r of roadList(false)){
    if(!wallRoadGateRoad(r))continue;
    const x=segmentCrossing(wall.a,wall.b,r.a,r.b);if(!x)continue;
    const covered=State.structures.some(g=>g.type==='gate'&&dist(g,x.point)<=Math.max(rectDims(g).w,rectDims(g).h)/2+.2);
    if(covered||out.some(o=>dist(o.point,x.point)<.3))continue;   // road joints give the same crossing twice
    out.push({...x,road:r});
  }
  return out.sort((p,q)=>p.t-q.t);
}
// The gate front faces the wall's exterior, passage across the wall; when the road crosses too
// obliquely for that passage the gate turns along the road instead.
function wallRoadGateAt(wall,cross,spec){
  const wa=Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x),out=wa+wallExteriorSide(wall)*Math.PI/2;
  const ra=Math.atan2(cross.road.b.y-cross.road.a.y,cross.road.b.x-cross.road.a.x),along=Math.cos(ra-out)>=0?ra:ra+Math.PI;
  let reason='gate not placeable';
  for(const raw of [out,along]){
    const angle=snapStructureAngle(raw);
    const gate={id:uid(),...spec,functions:[],x:cross.point.x,y:cross.point.y,angle,rotationStep:structureRotationStep(angle),wallRoadGate:true};
    if(!roadUsesGatePassage(cross.road,gate))continue;
    const v=window.ConquerPlacement?.check(gate);
    if(!v||v.ok)return{gate};
    reason=v.reason;
  }
  return{gate:null,reason};
}
// Splits the planned wall segments at their main-road crossings. Returns the gates to add first
// and the wall pieces, seated on the gate flanks (aSnap/bSnap) like a wall drawn to a gate.
function wallRoadGatePlan(structures){
  const gates=[],walls=[];
  for(const wall of structures){
    const spec=wallRoadGateSpec(wall),crossings=spec?wallRoadCrossings(wall):[];
    if(!crossings.length){walls.push(wall);continue}
    const placed=[];
    for(const cross of crossings){
      const prev=placed.at(-1);
      if(prev&&dist(prev,cross.point)<Math.max(spec.w??spec.size,spec.h??spec.size)+.2)continue;   // gates side by side: one is enough
      const {gate,reason}=wallRoadGateAt(wall,cross,spec);
      if(!gate)return{blocked:'Gate on the main road: '+reason};
      placed.push(gate);
    }
    walls.push(...wallPiecesAroundGates(wall,placed));
    gates.push(...placed);
  }
  return{gates,walls,blocked:null};
}
// The pieces of a wall cut by gates (ordered from a to b), each seated on the gate flanks
// (aSnap/bSnap). Pieces shorter than a wall break vanish into the gate; only the piece that
// still starts at wall.a (ends at wall.b) keeps that end's magnet and dogleg joint. The first
// piece keeps the wall's id.
function wallPiecesAroundGates(wall,placed){
  const out=[];let start=null;
  const piece=(fromGate,toGate)=>{
    const a=fromGate?boundaryPoint(fromGate,wall.b):wall.a,b=toGate?boundaryPoint(toGate,wall.a):wall.b;
    if(dist(a,b)<WALL_BREAK_MIN)return;
    const s={...wall,id:out.length?uid():wall.id,a:{...a},b:{...b},length:dist(a,b),
      aSnap:fromGate?fromGate.id:wall.aSnap||null,bSnap:toGate?toGate.id:wall.bSnap||null};
    if(fromGate)delete s.aJoint;
    if(toGate)delete s.bJoint;
    out.push(s);
  };
  for(const gate of placed){piece(start,gate);start=gate}
  piece(start,null);
  return out;
}
// Main roads across existing walls (ROAD-WALL-GATE, the reverse of WALL-ROAD-GATE): where a new
// main road crosses a completed wall or palisade a gate of the matching type straddles the
// crossing and the wall is cut on its two flanks; the road then runs through the passage.
// Returns {gates, cuts:[{wall, pieces}], blocked}. Non-mutating.
// ROAD-MOAT-DRAWBRIDGE: a road crossing the moat in front of a gate crosses it on the gate's
// drawbridge. A new gate gets it already installed (built with the gate, cost included); an
// existing finished gate without one has it installed. A plan's ignoreIds are the cut walls and
// the bridged moats, for the road's own placement check before the gates exist.
const DRAWBRIDGE_WITH_GATE=()=>({installed:true,raised:false,progress:0,withGate:true});
function roadMoatCrossings(road){
  return State.structures.filter(m=>m.type==='moat'&&m.a&&m.b&&segmentCrossing(m.a,m.b,road.a,road.b));
}
// The moat in front of the gate (along its outward front) that the road crosses, if any
// (also a moat still being dug).
function gateMoatForRoad(gate,road){
  const ahead=window.ConquerCrossings?.deck?.(gate,true)?.ahead;
  return ahead&&segmentCrossing(ahead.moat.a,ahead.moat.b,road.a,road.b)?ahead.moat:null;
}
function roadWallGatePlan(road){
  const gates=[],cuts=[],drawbridges=[],moats=[];
  const plan=blocked=>({gates,cuts,drawbridges,moats,blocked,ignoreIds:[...cuts.map(c=>c.wall.id),...moats.map(m=>m.id)]});
  if(!road?.a||!road?.b)return plan(null);
  const crossedMoats=roadMoatCrossings(road);
  for(const wall of State.structures){
    if(!['wall','palisade'].includes(wall.type)||!wall.a||!wall.b||wall.auto)continue;
    const x=segmentCrossing(wall.a,wall.b,road.a,road.b);if(!x)continue;
    const point=x.point;
    // A crossing at a gate that already stands there is the existing passage.
    if(State.structures.some(g=>g.type==='gate'&&dist(g,point)<=Math.max(rectDims(g).w,rectDims(g).h)/2+.2))continue;
    if(underConstruction(wall))return plan('the wall is still under construction: finish it before opening a gate');
    let spec=wallRoadGateSpec(wall);if(!spec)continue;
    // The road also crosses a moat just outside: the gate comes with its drawbridge.
    const moatNear=crossedMoats.some(m=>dist(segmentCrossing(m.a,m.b,road.a,road.b).point,point)<=4);
    if(moatNear)spec={...spec,drawbridge:DRAWBRIDGE_WITH_GATE()};
    const {gate,reason}=wallRoadGateAt(wall,{point,road},spec);
    if(!gate)return plan('Gate on the wall: '+reason);
    if(moatNear){
      const moat=gateMoatForRoad(gate,road);
      if(!moat)return plan('the drawbridge of the new gate would not span the moat');
      if(!moats.includes(moat))moats.push(moat);
    }
    gates.push(gate);
    cuts.push({wall,pieces:wallPiecesAroundGates(wall,[gate])});
  }
  // Through an existing gate across its moat: install the missing drawbridge.
  for(const g of State.structures){
    if(g.type!=='gate'||g.drawbridge?.installed||!roadUsesGatePassage(road,g))continue;
    const moat=gateMoatForRoad(g,road);if(!moat)continue;
    if(underConstruction(g))return plan('the gate is still under construction: finish it before adding the drawbridge');
    drawbridges.push(g);if(!moats.includes(moat))moats.push(moat);
  }
  return plan(null);
}
// Main road legs committed through the walls they cross: per leg, the gates first, then the road.
// Returns {gates, drawbridges} (how many were opened / installed), or false when a leg is
// blocked (nothing of it is built).
function addMainRoadThroughWalls(legs,width=TYPES.road.width){
  const opened={gates:0,drawbridges:0};
  for(const leg of legs){
    const road={type:'road',manualMain:true,roadClass:'arterial-manual',width,a:{...leg.a},b:{...leg.b}};
    const plan=roadWallGatePlan(road);
    if(plan.blocked){status('Road blocked: '+plan.blocked);return false}
    if(plan.gates.length||plan.drawbridges.length){
      const verdict=window.ConquerPlacement?.check(road,{ignoreIds:plan.ignoreIds});
      if(verdict&&!verdict.ok){status('Road blocked: '+verdict.reason);return false}
      if(!applyRoadWallGatePlan(plan))return false;
      opened.gates+=plan.gates.length;
      opened.drawbridges+=plan.gates.filter(g=>g.drawbridge).length+plan.drawbridges.length;
    }
    if(!addManualMainRoad(leg.a,leg.b))return false;
  }
  return opened;
}
// The status note for what a road opened: "gate opened in the wall · drawbridge over the moat".
function roadWallGateNote(o){
  if(!o)return'';
  const n=(k,one,many)=>o[k]?(o[k]===1?one:o[k]+' '+many):'';
  return[n('gates','gate opened in the wall','gates opened in the wall'),n('drawbridges','drawbridge over the moat','drawbridges over the moat')].filter(Boolean).map(s=>' · '+s).join('');
}
// Applies a roadWallGatePlan: gates as new building sites (cost and construction, as for a
// wall drawn over a road), the cut wall keeps its id and state on the first piece, the other
// piece is the same finished wall.
function applyRoadWallGatePlan(plan){
  for(const g of plan.gates)if(!addStructure(g))return false;
  for(const g of plan.drawbridges||[])window.ConquerCrossings?.installDrawbridge(g);
  for(const {wall,pieces} of plan.cuts){
    if(!pieces.length){State.structures=State.structures.filter(s=>s!==wall);continue}
    const [first,...rest]=pieces;
    Object.assign(wall,{a:first.a,b:first.b,length:first.length,aSnap:first.aSnap,bSnap:first.bSnap});
    if(!('aJoint' in first))delete wall.aJoint;
    if(!('bJoint' in first))delete wall.bJoint;
    delete wall.siegeIntegrity;delete wall.wallColliderSyncSignature;
    for(const piece of rest){
      const s=JSON.parse(JSON.stringify(piece));
      delete s.siegeIntegrity;delete s.wallStair;delete s.wallColliderSyncSignature;
      State.structures.push(s);markStructureDirty(s);
    }
    markStructureDirty(wall);
  }
  return true;
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
    wallSeat:Number.isFinite(State.draft?.wallSeat)?State.draft.wallSeat:null,
    parentTowerId:State.draft?.parentTowerId||null,
    subtowerSocket:State.draft?.subtowerSocket||null,
    subtowerAngle:Number.isFinite(State.draft?.subtowerAngle)?State.draft.subtowerAngle:null
  }:{};
  const quaySnap=spec.type==='tower'?State.draft?.quaySnap||null:null;
  const locked=Number.isFinite(State.draft?.lockedAngle)?State.draft.lockedAngle:angle;
  const finalAngle=quaySnap?locked:snapStructureAngle(locked);   // a quay tower keeps the quay's angle
  const s={id:uid(),...spec,x:center.x,y:center.y,angle:finalAngle,rotationStep:structureRotationStep(finalAngle),functions:Array.isArray(spec.functions)?[...spec.functions]:[]};
  if(quaySnap)s.quaySnap=quaySnap;
  if(s.type==='watermill')window.ConquerIndustries?.orientToWater(s);
  if(s.type==='pier')window.ConquerPier?.snapToCoast(s);
  if(s.type==='tower'&&!snap.parentTowerId&&typeof orientTowerToSummit==='function')orientTowerToSummit(s,{wallSnapped:!!snap.wallId});
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
  if(isOrientedTower(s))return orientedTowerBoundaryPoint(s,target);
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
  // ROAD-MAGNET-ROAD: the road end or side point the road snaps to lights up.
  if(road&&linearHover?.roadSnap){
    const v=w2s(linearHover.point,.05);
    ctx.beginPath();ctx.arc(v.x,v.y,linearHover.roadSnap.end?7:5.5,0,Math.PI*2);
    ctx.fillStyle='#8dffbd';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle='#314938';ctx.stroke();
  }
  ctx.restore();
}
function snapAnchor(p){
  const radius=linearMagnetRadius();
  const terrace=State.tool?.kind==='linear'&&State.tool.linear==='wall'
    ?window.ConquerTerraforming?.snapWallAnchor(p,currentLinearSpec().width):null;
  let best=terrace?{id:terrace.structureId}:null,bestPoint=terrace?.point||null,bestScore=terrace?.score??Infinity;
  // Quay magnet: walls, palisades and built sections along either side of a stone quay.
  const quay=State.tool?.kind==='linear'&&['wall','palisade','built'].includes(State.tool.linear)
    ?window.ConquerQuay?.snapWallAnchor(p,currentLinearSpec().width):null;
  if(quay&&quay.score<bestScore){best={id:quay.structureId};bestPoint=quay.point;bestScore=quay.score}
  for(const s of State.structures){
    if(!['tower','gate'].includes(s.type)||underConstruction(s))continue;
    // Oriented towers take walls on their two flank seats, on the line of the curtain.
    const q=isOrientedTower(s)?orientedTowerSeats(s).sort((a,b)=>dist(p,a)-dist(p,b))[0]:boundaryPoint(s,p),score=dist(p,q);
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
  if(isOrientedTower(child))return orientedGateFlankAttachment(parent,child,socket);
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
  // Oriented towers only flank gates; they neither carry nor become tower subtowers.
  if(parent.type==='tower'&&(isOrientedTower(parent)||isOrientedTower(child)))return null;
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
    if(parent.type==='tower'&&(towerTier(parent)<=childTier||isOrientedTower(parent)||isOrientedTower(child)))continue;

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
  }else if(isOrientedTower(child))applyStructureRotation(child,attachment.angle);
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
  if(wall&&isOrientedTowerShape(State.tool.shape)&&State.tool.material!=='wood'){
    const w=State.structures.find(s=>s.id===wall.wallId);
    if(w)return{...wall,...orientedTowerWallSnap(State.tool.shape,Number(State.tool.size),w,wall.wallEnd,p)};
  }
  if(wall)return wall;
  // Against a stone quay, its inner side (the door) turned to the quay (settlement-quay.js).
  const quay=window.ConquerQuay?.snapTower(p,towerToolPrototype());
  if(quay)return{point:quay.point,wallId:null,parentTowerId:null,angle:quay.angle,quayId:quay.quayId};
  return{point:{x:snapGrid(p.x),y:snapGrid(p.y)},wallId:null,parentTowerId:null,angle:0};
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
  if(source.construction){
    fragment.construction={...source.construction};
    if(source.construction.materialsDelivered){
      const scale=values=>Object.fromEntries(Object.entries(values||{}).map(([k,v])=>[k,Math.floor(v*ratio*1000+1e-7)/1000]));
      fragment.buildCost=scale(source.buildCost);
      fragment.construction.materialsDelivered=scale(source.construction.materialsDelivered);
      if(source.construction.materialsRequired)fragment.construction.materialsRequired=scale(source.construction.materialsRequired);
      if(source.construction.materialsFree)fragment.construction.materialsFree=scale(source.construction.materialsFree);
      if(source.construction.upgrade){
        const before=source.construction.upgrade.before;
        fragment.construction.upgrade={before:{...structureUpgradeSnapshot(before),id:fragment.id,a:fragment.a,b:fragment.b,aSnap:fragment.aSnap,bSnap:fragment.bSnap,length:fragment.length,buildCost:scale(before.buildCost)}};
      }
      fragment.construction.materialsConsumed=scale(source.construction.materialsConsumed||Object.fromEntries(Object.entries(source.buildCost||{}).map(([k,v])=>[k,v*constructionProgress(source)])));
      fragment.construction.workRequired*=ratio;fragment.construction.workDone*=ratio;
      fragment.construction.wagesPaid=(source.construction.wagesPaid||0)*ratio;
    }
  }
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
  const towerContact=()=>isOrientedTower(tower)?orientedTowerWallContact(tower,other,wall[end]):boundaryPoint(tower,other);
  const contact=passThrough?original:towerContact();
  wall[end]={x:contact.x,y:contact.y};
  wall.length=dist(wall.a,wall.b);
  if(end==='a')wall.aSnap=tower.id;else wall.bSnap=tower.id;

  setTowerWallConnection(tower,wall,end,original);
  normalizeStructureVariants(wall);
  normalizeFunctions(tower);
  invalidateCastleColliderGeometry(tower,wall);
  return passThrough||dist(wall[end],towerContact())<=.015;
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

  if(wall.construction?.materialsDelivered){
    const old=refundableConstructionCost(wall),refund={};
    for(const [k,v] of Object.entries(old))refund[k]=Math.max(0,v-fragments.reduce((n,f)=>n+(refundableConstructionCost(f)[k]||0),0));
    refundCost(refund);
  }
  const idx=State.structures.findIndex(s=>s.id===wall.id);
  if(idx>=0)State.structures.splice(idx,1,...fragments);
  castleUnionCache.key=null;
  return true;
}
function addTowerWithPlacement(tower,snap={}){
  if(isOrientedTower(tower)&&Number.isFinite(snap.wallSeat))tower.wallSeat=snap.wallSeat;
  if(isKeepW4(tower)&&(snap.parentTowerId||!keepW4Available(tower))){status(snap.parentTowerId?'The W4 keep stands on its own':'Only one W4 keep per settlement');return false}
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
// Walls take any heading: no 15° lattice, no automatic dogleg. rotationStep is kept only when
// the heading happens to fall on the lattice (same rule as the save migration).
function freeLinearSegment(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(length<1e-6)return null;
  const angle=Math.atan2(dy,dx),step=structureAngleDelta(angle,snapStructureAngle(angle))<1e-6?structureRotationStep(angle):null;
  return{a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},length,angle,rotationStep:step};
}
function normalizeStructuralLinearRoute(a,b,spec,exactEnd=false){
  if(!exactEnd){
    const single=normalizeLinear(a,b,spec,false);
    const seg=single&&freeLinearSegment(single.a,single.b);
    return seg?{segments:[seg],joint:null,length:seg.length,exactEnd:false}:null;
  }
  // Exact magnet: a straight run to it; beyond the max length, two equal collinear legs.
  const direct=Math.hypot(b.x-a.x,b.y-a.y),max=Number(spec.max)||Infinity;
  if(direct<1e-6||direct>2*max+1e-6)return null;
  if(direct<=max+1e-6){
    const single=freeLinearSegment(a,b);
    return single?{segments:[single],joint:null,length:single.length,exactEnd:true}:null;
  }
  const joint={x:(a.x+b.x)/2,y:(a.y+b.y)/2},first=freeLinearSegment(a,joint),second=freeLinearSegment(joint,b);
  return first&&second?{segments:[first,second],joint,length:direct,exactEnd:true}:null;
}
function linePoly(s){
  const a=s.a,b=s.b,dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L*s.width/2,ny=dx/L*s.width/2;
  return[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}];
}
// Function slots run floor by floor; the W4 keep has several rooms per floor (keepFloorRooms),
// every other structure one. Slot i -> {floor, room, rect} (rect: fractions of the floor).
function functionSlotLayout(s){
  const cap=functionCapacity(s);
  if(!isKeepW4(s))return Array.from({length:cap},(_,i)=>({floor:i+functionFloorOffset(s),room:0,rect:[0,0,1,1]}));
  const out=[];
  for(let floor=0;floor<structureLevel(s);floor++)keepFloorRooms(s,floor).forEach((rect,room)=>out.push({floor,room,rect}));
  return out;
}
// Rooms keep their floor when the layout changes (floor plan, tier): the roles of each floor go
// back on the same floor, empty rooms dropped first when it has fewer rooms.
function functionsByFloor(s){
  const out=[];functionSlotLayout(s).forEach((x,i)=>(out[x.floor]||(out[x.floor]=[])).push(s.functions?.[i]||null));return out;
}
function restoreFunctionsByFloor(s,byFloor){
  const L=functionSlotLayout(s),want=[];L.forEach(x=>want[x.floor]=(want[x.floor]||0)+1);
  const lists=want.map((n,f)=>{const list=(byFloor[f]||[]).slice();while(list.length>n&&list.includes(null))list.splice(list.lastIndexOf(null),1);return list});
  s.functions=L.map(x=>lists[x.floor]?.length?lists[x.floor].shift():null);
  normalizeFunctions(s);return s;
}
function functionSlotFloor(s,index){return isKeepW4(s)?functionSlotLayout(s)[index]?.floor??0:index+functionFloorOffset(s)}
function functionSlotSize(s,index=0){
  if(!s)return'normal';
  if(isKeepW4(s)){const r=functionSlotLayout(s)[index]?.rect;return r&&(r[2]-r[0])*(r[3]-r[1])<.4?'normal':'large'}
  if(s.type==='tower')return index>=structureLevel(s)?'normal':towerTier(s)>=3?'large':'normal';   // the turret room is small
  if(s.type==='built')return isWideBuilt(s)||Number(s.length)>=3?'large':'normal';
  return'normal';
}
function functionSlotUnits(s,index=0){return functionSlotSize(s,index)==='large'?2:1}
// The gate ground floor is an entrance passage; its functional rooms start upstairs.
function functionFloorOffset(s){return s?.type==='gate'?1:0}
function functionCapacity(s){
  if(!s)return 0;
  // Stone gates: one room per storey above the passage. The wood gate is fixed at H1 but its
  // fighting deck over the passage holds one room (one fewer than a tall stone gate).
  // (material test inlined, as isWoodGate: QA harnesses extract this function alone.)
  if(s.type==='gate')return s.material==='wood'?1:Math.max(0,structureLevel(s)-1);
  if(typeof isKeepW4==='function'&&isKeepW4(s)){let n=0;for(let f=0;f<structureLevel(s);f++)n+=keepFloorRooms(s,f).length;return n}
  // One room per floor. W1 towers keep their spiral stair and take only dovecote, latrine, prison,
  // treasury and armory (settlement-siege.js allowed), except the first T1 keep (its Common Hall).
  // The up inner tower (torretta centrale) adds its own room on the deck.
  if(s.type==='tower')return structureLevel(s)+(typeof towerUpInnerTower==='function'&&towerUpInnerTower(s)?1:0);
  if(s.type==='built')return Number(s.length)>=2?builtInteriorFloors(s):0;
  if(s.type==='townhall')return civicLevel(s);
  return 0;
}
function functionCapacityUnits(s){
  let total=0;for(let i=0;i<functionCapacity(s);i++)total+=functionSlotUnits(s,i);return total;
}
function normalizeFunctions(s){
  if(s.type==='townhall')return normalizeTownhallRooms(s);
  const w4=typeof isKeepW4==='function'&&isKeepW4(s);
  if(w4)s.keepPlans=Array.from({length:3},(_,f)=>keepFloorPlan(s,f));
  else delete s.keepPlans;
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
// Town hall rooms: room i is floor i. Town halls saved before their rooms keep the council hall
// they always showed on the ground floor.
function normalizeTownhallRooms(s){
  const cap=functionCapacity(s);
  if(!Array.isArray(s.functions)||!s.townhallRooms){s.functions=['council'];s.townhallRooms=1}
  // The prison only on the ground floor (room 0).
  s.functions=s.functions.slice(0,cap).map((fn,i)=>TOWNHALL_FUNCTION_CATALOG.includes(fn)&&(fn!=='tribunal'||cap>=2)&&(fn!=='prison'||i===0)?fn:null);
  while(s.functions.length<cap)s.functions.push(null);
  return s;
}
// Variant contract:
 // tower/gate -> roofStyle
 // wall/built -> skin
 // Renderer/UI steps must use structureVariant()/setStructureVariant() rather
 // than creating duplicate structure types.
function structureLabel(s){if(!s)return'';if(s.type==='storageYard')return'Piazzale · Magazzino '+(s.yardSize||2)+'×'+(s.yardSize||2)+'U';if(window.ConquerEvents3D?.is(s))return window.ConquerEvents3D.label(s);if(window.ConquerPier?.is(s))return window.ConquerPier.label(s);if(window.ConquerQuay?.is(s))return window.ConquerQuay.label(s);if(isCivicAnnex(s))return 'Annex · '+(civicAnnexDefinition(s)?.label||s.annexType||'unknown');if(window.ConquerIndustries?.is(s)){const t=window.ConquerIndustries.TYPES[s.type];return t.name+' · '+t.w+'×'+t.h+'U'};if(s.type==='house'){const l=houseLevel(s);return `House · L${l}${l===3?' · '+housePlanType(s)+' plan':l===4?' · elite · '+houseTurretType(s)+' turret':''}`};if(s.type==='market')return`Market · 4×4U · L${civicLevel(s)}`;if(s.type==='tavern')return`Tavern · double-T plan · L${civicLevel(s)}`;if(s.type==='church')return`Church · large · L${civicLevel(s)}`;if(typeof isWellCivic==='function'&&isWellCivic(s))return wellCivicLabel(s);if(s.type==='balivo')return`Palazzo del Balivo · L${civicLevel(s)} · countryside`;if(s.type==='plaza')return`Piazza · ${plazaVariant(s)} · L${civicLevel(s)}`;if(s.type==='training')return'Training field · 5×4U';if(s.type==='well')return'Village well';if(s.type==='gate')return isWoodGate(s)?'Wood gate 1.5×1U · H1 · flat deck · battlements':isSmallGate(s)?`Small gate 1×1U · L${structureLevel(s)}`:`Gate 1.5×1.5U · L${structureLevel(s)}`;if(s.type==='tower'){if(isWoodTower(s))return woodTowerStyle(s)==='watchtower'?`Wood watchtower 1×1U · H1`:`Wood tower 1.5×1.5U · H1 · ${woodTowerRoof(s)==='pitched'?'pitched roof':'open top'}`;if(isOrientedTower(s))return orientedTowerLabel(s)+` · T${towerTier(s)} · L${structureLevel(s)}`+(s.parentTowerId?' · SUB':'');return(s.shape==='round'?`Round tower R${s.r}U`:`Square tower ${s.size}×${s.size}U`)+` · T${towerTier(s)} · L${structureLevel(s)}`+(s.parentTowerId?' · SUB':'')};if(s.type==='built')return`${isLeanTo(s)?'Lean-to W1':isLonghouse(s)?(isWideBuilt(s)?'Longhouse W2':'Longhouse W1'):isWideBuilt(s)?'Wide hall':'Built section'} ${s.length.toFixed(2)}U${isWideBuilt(s)?' × 2U':''} · L${structureLevel(s)}`;if(s.type==='wall')return`Wall ${s.length.toFixed(2)}U · T${wallTier(s)} (${s.width}U) · L${structureLevel(s)}`;if(s.type==='palisade')return`Palisade ${s.length.toFixed(2)}U · T${wallTier(s)} (${s.width}U)`;if(s.type==='road')return`${s.manualMain?'Main road':'Road'} ${(s.length||dist(s.a,s.b)).toFixed(2)}U`;return s.type}
