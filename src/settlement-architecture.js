// Architecture sprite loading, facades, towers and window/door details. Runtime semantics preserved from the monolith.
'use strict';
// CONQUER settlement render module — classic-script shared runtime.
// Facade textures are resized and keyed to transparency before publication.
const ARCHITECTURE_ASSET_PATHS=Object.freeze({
  gatePortal:'./src/assets/architecture/gate_portal.png',
  towerDoor:'./src/assets/architecture/tower_door.png',
  arrowSlit:'./src/assets/architecture/arrow_slit.png',
  gothicL1:'./src/assets/architecture/gothic_l1.png',
  gothicL2:'./src/assets/architecture/gothic_l2.png',
  gothicL3:'./src/assets/architecture/gothic_l3.png',
  arcade2:'./src/assets/architecture/arcade_2.png',
  arcade3:'./src/assets/architecture/arcade_3.png',
  // Two-light lancet for wide halls, modelled and rendered in Blender (ASSETS/blender/build_hall_window.py).
  hallLancet:'./src/assets/architecture/hall_lancet.png'
});
const architectureSprites={};
async function loadArchitectureSprites(){
  const jobs=Object.entries(ARCHITECTURE_ASSET_PATHS).map(([key,path])=>new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{architectureSprites[key]=img;resolve(true)};
    img.onerror=()=>{console.warn('Architecture PNG load failed',path);resolve(false)};
    img.src=path+'?v=prepared-1';
  }));
  await Promise.all(jobs);
  if(typeof invalidateSceneCache==='function')invalidateSceneCache();
  if(typeof draw==='function')draw();
}
loadArchitectureSprites();
function architectureSprite(key){const img=architectureSprites[key];return img&&img.width>0&&img.height>0?img:null}
function facadeAssetWorldSpan(edge,width,offsetWorld=0){
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const mx=(edge.a.x+edge.b.x)/2+ux*offsetWorld,my=(edge.a.y+edge.b.y)/2+uy*offsetWorld;
  return{a:{x:mx-ux*width/2,y:my-uy*width/2},b:{x:mx+ux*width/2,y:my+uy*width/2}};
}
function drawArchitectureAssetOnEdge(edge,centerZ,width,height,key,offsetWorld=0,lit=false,nf=1,opacity=1){
  const img=architectureSprite(key);if(!img)return false;
  const span=facadeAssetWorldSpan(edge,width,offsetWorld),z0=centerZ-height/2,z1=centerZ+height/2;
  const lt=w2s(span.a,z1),rt=w2s(span.b,z1),lb=w2s(span.a,z0),iw=img.width,ih=img.height;
  ctx.save();
  const baseAlpha=ctx.globalAlpha*clamp(Number(opacity)||0,0,1);
  ctx.globalAlpha=baseAlpha;
  ctx.transform((rt.x-lt.x)/iw,(rt.y-lt.y)/iw,(lb.x-lt.x)/ih,(lb.y-lt.y)/ih,lt.x,lt.y);
  ctx.imageSmoothingEnabled=true;ctx.drawImage(img,0,0);
  if(lit){ctx.globalCompositeOperation='screen';ctx.globalAlpha=baseAlpha*Math.min(.50,.20+.28*nf);ctx.filter='sepia(1) saturate(2) hue-rotate(330deg) brightness(1.45)';ctx.drawImage(img,0,0)}
  ctx.restore();return true;
}
// Rule: a tower hooked to a gate (any gate socket) always has its entrance and its interior side
// on the gate's rear, the inner side of the gatehouse, whatever its own angle or the walls.
function towerGateParent(s){
  if(!s||s.type!=='tower'||!s.parentTowerId)return null;
  const p=State.structures.find(o=>o.id===s.parentTowerId);
  return p?.type==='gate'?p:null;
}
function gateRearVector(g){const a=g.angle||0;return{x:-Math.cos(a),y:-Math.sin(a)}}
function structureInteriorVector(s){
  const gate=towerGateParent(s);if(gate)return gateRearVector(gate);
  let vx=0,vy=0,hits=0;
  for(const link of State.structures){
    if(!link||underConstruction(link)||!['wall','built'].includes(link.type))continue;
    if(link.aSnap!==s.id&&link.bSnap!==s.id)continue;
    const dx=link.b.x-link.a.x,dy=link.b.y-link.a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L,side=wallExteriorSide(link);
    vx-=nx*side;vy-=ny*side;hits++;
  }
  let L=Math.hypot(vx,vy);
  if(!hits||L<1e-4){const a=s.angle||0;vx=Math.cos(a);vy=Math.sin(a);L=1}
  return{x:vx/L,y:vy/L};
}
function interiorFacadeEdgeIndex(s){
  if(isOrientedTower(s))return ORIENTED_FACADE_REAR;
  // A gate faces the field along its angle (portal edges 1 = front, 3 = rear): the windows
  // look into the castle, whatever the walls around it.
  if(s?.type==='gate')return GATE_FACADE_REAR;
  const fp=footprintPoints(s);if(fp.length<2)return-1;
  const iv=structureInteriorVector(s),center=structureCenter(s);let best=-1,bestScore=-Infinity;
  for(let i=0;i<fp.length;i++){
    const a=fp[i],b=fp[(i+1)%fp.length],mx=(a.x+b.x)/2-center.x,my=(a.y+b.y)/2-center.y,L=Math.hypot(mx,my)||1;
    const score=mx/L*iv.x+my/L*iv.y;if(score>bestScore){bestScore=score;best=i}
  }
  return best;
}
function gothicAssetForLevel(s){return structureLevel(s)>=2?'gothicL2':'gothicL1'}
function gothicAssetSizeForLevel(s){const l=structureLevel(s);return l>=2?{w:.68,h:.78}:{w:.54,h:.70}}
function towerGothicAssetForRow(s,row){
  if(!row||row.floor<2)return s.isMastio&&row?.floor===1?'gothicL1':null;
  if(row.floor===2)return'gothicL1';
  // P3 wants a bifora, but narrow towers keep the single lancet as fallback.
  return towerTier(s)>=2?'gothicL2':'gothicL1';
}
function towerGothicAssetSizeForRow(s,row){
  const key=towerGothicAssetForRow(s,row);
  const base=key==='gothicL2'?{w:.68,h:.78}:{w:.54,h:.70};
  const t=clamp(towerTier(s),1,3),scale=t===1?.56:t===2?.76:.94;
  return{w:base.w*scale,h:base.h*scale};
}

// Closed portal of a stone gate: .90×1.35 on the gatehouse, smaller on the small gate.
function gateClosedPortal(s){return window.ConquerGates?.closedPortal?.(s)||{width:.9,height:1.35,centerZ:.705}}
// One row per room: the ground floor is the passage (no window), each storey above has one.
// A timber upper storey has house windows in its frame instead (gateTimberFacade).
function gateWindowRows(s){
  if(gateTimberUpper(s))return[];
  return cutawayFloorLevels(s).slice(functionFloorOffset(s)).map(f=>f.z+.9).filter(z=>z<structureHeight(s)-.28);
}
// Timber frame of a small gate's upper storey, per face of the jettied storey: sill and head
// plates, corner posts; two windows between posts on the front and the rear, a post and two
// braces on the flanks. Offsets along the edge from its middle, z above the gate's ground.
function gateTimberFacade(s){return timberStoreyFacade(gateTimberStoreyPoints(s),gateTimberFloorZ(s),structureHeight(s),i=>i===GATE_FACADE_FRONT||i===GATE_FACADE_REAR)}
// Framed top of a W3 tower: the same frame, two windows on every face (it is the watch room).
function towerTimberFacade(s){return timberStoreyFacade(towerTimberStoreyPoints(s),towerTimberFloorZ(s),structureHeight(s),()=>true,true)}
// Timber P1 of a built section: the two long faces in bays of about 1.25 U, each bay framed
// densely with its two windows; the short ends get the frame too (post and two braces, no window).
function builtTimberFacade(s){
  const pts=builtTimberStoreyPoints(s),z0=builtTimberFloorZ(s),z1=structureHeight(s),out=[];
  // Courtyard face (linearFacadeEdge: side +1 is edge 0): paired windows in each bay.
  const inner=-wallExteriorSide(s)>0?0:2;
  for(const i of [0,2]){
    const a=pts[i],b=pts[(i+1)%4],L=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.round(L/1.25));
    for(let k=0;k<n;k++){
      const p=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),qa=p(k/n),qb=p((k+1)/n);
      const f=i===inner?pairedTimberBay(qa,qb,z0,z1):timberStoreyFacade([qa,qb,qb,qa],z0,z1,j=>j===0,true)[0];
      f.edge.index=i;out.push(f);
    }
  }
  // Ends: the storey's frame, and the gable over it framed too (king post and two struts
  // up to the rafters, which run from the eaves at the corners to the ridge in the middle).
  const R=builtRoofGeometry(s)?.ridgeH??z1,t=HOUSE_TIMBER_W/2;
  for(const i of [1,3]){
    const a=pts[i],b=pts[(i+1)%4],f=timberStoreyFacade([a,b,b,a],z0,z1,()=>false,false)[0],w=Math.hypot(b.x-a.x,b.y-a.y);
    if(R>z1+.1){
      const rafter=x=>z1+(R-z1)*(1-2*Math.abs(x)/w);
      f.beams.push([{off:0,z:z1},{off:0,z:R-t*2}]);
      for(const sg of [-1,1])f.beams.push([{off:0,z:z1+(R-z1)*.12},{off:sg*w*.25,z:rafter(w*.25)-t}],[{off:sg*(w/2-t*2),z:z1},{off:sg*(w/2-t*2),z:rafter(w/2-t*2)-t}]);
    }
    f.edge.index=i;out.push(f);
  }
  return out;
}
// One bay with a pair of windows side by side in the middle (a mullion between them), sill and
// head rails, studs either side and a brace in each outer panel.
function pairedTimberBay(a,b,z0,z1){
  const t=HOUSE_TIMBER_W/2,L=Math.hypot(b.x-a.x,b.y-a.y),h=L/2-t,hw=HOUSE_WINDOW_HALF_W,hh=HOUSE_WINDOW_HALF_H;
  const c=hw+t,o=2*hw+2*t+HOUSE_TIMBER_W*.4,mid=(z0+z1)/2,wl=mid-hh-t,wh=mid+hh+t,beams=[];
  beams.push([{off:-L/2,z:z0+t},{off:L/2,z:z0+t}],[{off:-L/2,z:z1-t},{off:L/2,z:z1-t}]);
  for(const e of [-h,h,0,-o,o])beams.push([{off:e,z:z0+t},{off:e,z:z1-t}]);
  beams.push([{off:-o,z:wl},{off:o,z:wl}],[{off:-o,z:wh},{off:o,z:wh}]);
  for(const sg of [-1,1])beams.push([{off:sg*h,z:z0+t},{off:sg*o,z:mid}],[{off:sg*h,z:z1-t},{off:sg*o,z:mid}]);
  return{edge:{a,b,index:0},beams,windows:[{off:-c,z:mid},{off:c,z:mid}]};
}
function timberStoreyFacade(pts,z0,z1,windowed,dense=false){
  const t=HOUSE_TIMBER_W/2,out=[];
  for(let i=0;i<4;i++){
    const a=pts[i],b=pts[(i+1)%4],L=Math.hypot(b.x-a.x,b.y-a.y),h=L/2-t,beams=[],windows=[];
    beams.push([{off:-L/2,z:z0+t},{off:L/2,z:z0+t}],[{off:-L/2,z:z1-t},{off:L/2,z:z1-t}]);
    for(const e of [-h,h])beams.push([{off:e,z:z0+t},{off:e,z:z1-t}]);
    if(windowed(i)){
      const wz=(z0+z1)/2,f=HOUSE_WINDOW_HALF_W+HOUSE_TIMBER_W*.9;
      for(const c of [-L*.24,L*.24]){windows.push({off:c,z:wz});beams.push([{off:c-f,z:z0+t},{off:c-f,z:z1-t}],[{off:c+f,z:z0+t},{off:c+f,z:z1-t}])}
    }else{
      beams.push([{off:0,z:z0+t},{off:0,z:z1-t}],[{off:-h,z:z0+t},{off:0,z:z1-t}],[{off:h,z:z0+t},{off:0,z:z1-t}]);
    }
    // Dense frame (tower framed top): a mid rail beside the windows, close studs between them,
    // and a K brace in each corner bay.
    if(dense){
      const f=HOUSE_WINDOW_HALF_W+HOUSE_TIMBER_W*.9,wl=(z0+z1)/2-HOUSE_WINDOW_HALF_H-t,wh=(z0+z1)/2+HOUSE_WINDOW_HALF_H+t,mid=(z0+z1)/2;
      const c=L*.24,inner=c-f,outer=c+f;
      // sill and head rails under/over the windows, mid rail in the corner bays and the centre
      for(const sg of [-1,1]){
        beams.push([{off:sg*inner,z:wl},{off:sg*outer,z:wl}],[{off:sg*inner,z:wh},{off:sg*outer,z:wh}]);
        beams.push([{off:sg*outer,z:mid},{off:sg*h,z:mid}]);
        // K braces in the corner bay
        beams.push([{off:sg*h,z:z0+t},{off:sg*outer,z:mid}],[{off:sg*h,z:z1-t},{off:sg*outer,z:mid}]);
      }
      // close studs and a St Andrew's cross in the centre bay
      beams.push([{off:0,z:z0+t},{off:0,z:z1-t}],[{off:-inner,z:z0+t},{off:inner,z:z1-t}],[{off:inner,z:z0+t},{off:-inner,z:z1-t}]);
    }
    out.push({edge:{a,b,index:i},beams,windows});
  }
  return out;
}
const GATE_FACADE_FRONT=1,GATE_FACADE_REAR=3;
// Slits along a gate face: two side by side on the field front, one on the flanks.
function gateSlitOffsets(edge){return edge.index===GATE_FACADE_FRONT?[-.26,.26]:[0]}
function cutawayOpenEdgeIndexes(s){
  if(!structureCutaway(s))return null;
  return cutawayTransparentFaceIndexes(s,cutawayWallGeometry(s));
}
function cutawayEdgeIsOpen(s,index){
  return !!cutawayOpenEdgeIndexes(s)?.has(index);
}
function closestFootprintEdge(s,p){
  const fp=footprintPoints(s);if(fp.length<2)return null;
  let best=null,bestD=Infinity;
  for(let i=0;i<fp.length;i++){
    const a=fp[i],b=fp[(i+1)%fp.length],q=closestPointOnSegment(p,a,b),d=dist(p,q);
    if(d<bestD){bestD=d;best={a,b,point:q,index:i}}
  }
  return best;
}
function towerDoorContactSpec(tower,contact,wall=null,kind='wall'){
  const rx=contact.x-tower.x,ry=contact.y-tower.y,RL=Math.hypot(rx,ry)||1;
  const outward={x:rx/RL,y:ry/RL};
  let tangent,anchor={x:contact.x+outward.x*.006,y:contact.y+outward.y*.006};

  if(tower.shape==='round'){
    tangent={x:-outward.y,y:outward.x};
  }else{
    const edge=closestFootprintEdge(tower,contact);if(!edge)return null;
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1;
    tangent={x:dx/L,y:dy/L};
    anchor={x:edge.point.x+outward.x*.006,y:edge.point.y+outward.y*.006};
  }

  let baseZ=.035,apexZ=.98;
  if(wall){
    // Wall-linked doors sit at the wall walk level. This keeps the opening
    // readable and architecturally useful instead of burying it behind masonry.
    const towerH=structureHeight(tower),wallH=structureHeight(wall);
    baseZ=clamp(wallH-.02,.08,Math.max(.08,towerH-.98));
    // A storey floor at that height is the door's sill: the opening seen from inside starts on
    // the planks instead of a hair under them (the floor slab clipped it).
    const sill=(typeof cutawayFloorLevels==='function'?cutawayFloorLevels(tower):[]).find(f=>Math.abs(f.z-baseZ)<.12);
    if(sill)baseZ=sill.z;
    apexZ=Math.min(towerH-.16,baseZ+.92);
    if(apexZ-baseZ<.48)return null;
  }

  return{kind,contact:anchor,tangent,outward,baseZ,apexZ,wallId:wall?.id||null};
}
// Walls snapped to a tower: where each one touches it and the direction it leaves in.
function towerWallLinks(tower){
  const out=[];
  for(const wall of State.structures){
    if(wall.type!=='wall'||underConstruction(wall))continue;
    const end=wall.aSnap===tower.id?'a':wall.bSnap===tower.id?'b':null;if(!end)continue;
    const contact=wall[end],far=wall[end==='a'?'b':'a'],dx=far.x-contact.x,dy=far.y-contact.y,L=Math.hypot(dx,dy);
    if(L>1e-6)out.push({wall,contact,dir:{x:dx/L,y:dy/L}});
  }
  return out;
}
// Square tower: is there room for its ground-floor door on the front face (local +x, `angle`)?
// Not when a wall plugs into that face, nor on a corner tower (two walls meeting at an angle)
// unless the front looks into the corner between them, i.e. the tower turned 45° so the walls
// meet two faces and the front stays free towards the inside.
const CORNER_TOWER_MAX_ANGLE=150*Math.PI/180,CORNER_DOOR_TOLERANCE=Math.cos(30*Math.PI/180);
function squareTowerGroundDoorBlocked(tower){
  if(!tower||tower.type!=='tower'||tower.parentTowerId||tower.shape==='round'||
    (typeof isOrientedTower==='function'&&isOrientedTower(tower))||towerGateParent(tower))return false;
  const links=towerWallLinks(tower);if(!links.length)return false;
  // A wall plugged into the middle of the door face (fp[1]-fp[2]) buries the door; one at a
  // corner of that face (a tower turned 45° on a wall corner) leaves it free.
  const fp=footprintPoints(tower);
  if(fp.length>=4&&links.some(l=>{
    const a=fp[1],b=fp[2],dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1,t=((l.contact.x-a.x)*dx+(l.contact.y-a.y)*dy)/L2;
    return t>.15&&t<.85&&Math.hypot(a.x+dx*t-l.contact.x,a.y+dy*t-l.contact.y)<.25;
  }))return true;
  let corner=null;
  for(let i=0;i<links.length;i++)for(let j=i+1;j<links.length;j++){
    const p=links[i].dir,q=links[j].dir,ang=Math.acos(clamp(p.x*q.x+p.y*q.y,-1,1));
    if(ang<CORNER_TOWER_MAX_ANGLE&&(!corner||ang<corner.ang))corner={ang,p,q};
  }
  if(!corner)return false;   // walls in line: the tower stands along a curtain, not at a corner
  const bx=corner.p.x+corner.q.x,by=corner.p.y+corner.q.y,BL=Math.hypot(bx,by)||1,a=tower.angle||0;
  return(Math.cos(a)*bx+Math.sin(a)*by)/BL<CORNER_DOOR_TOLERANCE;
}
function towerDoorSpecs(tower){
  if(!tower||tower.type!=='tower'||underConstruction(tower))return[];
  const specs=[];

  // Primary ground-floor entrance exists on independent towers and on towers hooked to a gate.
  // Subtowers of a tower deliberately have NO ground-floor door.
  // Oriented towers face the field: the door is on the rear, inside the walls (the semitower's
  // rear is the open gorge itself).
  const gate=towerGateParent(tower);
  if(gate){
    // Gate rule: the entrance faces the gate's rear (towerGateParent).
    const rear=gateRearVector(gate),fp=towerFacadePoints(tower);
    const contact=isOrientedTower(tower)?{x:(fp[3].x+fp[0].x)/2,y:(fp[3].y+fp[0].y)/2}
      :tower.shape==='round'?{x:tower.x+rear.x*tower.r,y:tower.y+rear.y*tower.r}
      :boundaryPoint(tower,{x:tower.x+rear.x,y:tower.y+rear.y});
    if(tower.shape!=='half'){const spec=towerDoorContactSpec(tower,contact,null,'front');if(spec)specs.push(spec)}
  }else if(!tower.parentTowerId&&isOrientedTower(tower)){
    if(tower.shape==='dee'){
      const fp=towerFacadePoints(tower),rear=towerDoorContactSpec(tower,{x:(fp[3].x+fp[0].x)/2,y:(fp[3].y+fp[0].y)/2},null,'front');
      if(rear)specs.push(rear);
    }
  }else if(!tower.parentTowerId){
    const a=tower.angle||0;
    let frontContact;
    if(tower.shape==='round'){
      frontContact={x:tower.x+Math.cos(a)*tower.r,y:tower.y+Math.sin(a)*tower.r};
    }else{
      const fp=footprintPoints(tower);
      frontContact=fp.length>=4
        ?{x:(fp[1].x+fp[2].x)/2,y:(fp[1].y+fp[2].y)/2}
        :boundaryPoint(tower,{x:tower.x+Math.cos(a),y:tower.y+Math.sin(a)});
    }
    const front=towerDoorContactSpec(tower,frontContact,null,'front');
    // Mastio with a raised entrance: the front door opens on the first upper storey.
    const sill=window.ConquerKeepEntrance?.sill?.(tower);
    if(front&&sill!=null){front.baseZ=sill;front.apexZ=Math.min(structureHeight(tower)-.16,sill+.92);front.raised=true}
    // A corner square tower has no room for the ground-floor door (a raised keep entrance stays).
    if(front&&(front.raised||!squareTowerGroundDoorBlocked(tower)))specs.push(front);
  }

  // Additional doors at every true wall socket connected to this tower. The Mastio has none:
  // it is not a way on or off the walls (settlement-wallwalk.js leaves it out too).
  if(!tower.isMastio)for(const wall of State.structures){
    if(wall.type!=='wall'||underConstruction(wall))continue;
    let contact=null;
    if(wall.aSnap===tower.id)contact=wall.a;
    else if(wall.bSnap===tower.id)contact=wall.b;
    if(!contact)continue;
    const spec=towerDoorContactSpec(tower,contact,wall,'wall');
    if(!spec)continue;

    // Avoid drawing the wall-walk door on top of an almost identical front
    // entrance direction when the two happen to coincide.
    const duplicate=specs.some(x=>{
      const da=Math.atan2(x.outward.y,x.outward.x),db=Math.atan2(spec.outward.y,spec.outward.x);
      return Math.abs(Math.atan2(Math.sin(da-db),Math.cos(da-db)))<.12&&Math.abs(x.baseZ-spec.baseZ)<.18;
    });
    if(!duplicate)specs.push(spec);
  }
  for(const spec of towerRoofDoorSpecs(tower))specs.push(spec);
  return specs;
}
// Parent/subtower pairs: the taller one opens a door onto the roof of the lower one, on the
// face looking at it, at that roof's level (like the wall-walk doors).
function towerRoofDoorSpecs(tower){
  const out=[],h=structureHeight(tower);
  for(const o of State.structures){
    if(o===tower||underConstruction(o)||!['tower','gate'].includes(o.type))continue;
    if(o.id!==tower.parentTowerId&&o.parentTowerId!==tower.id)continue;
    if(structureHeight(o)>h-.6)continue;
    const spec=towerDoorContactSpec(tower,boundaryPoint(tower,{x:o.x,y:o.y}),o,'roof');
    if(spec)out.push(spec);
  }
  return out;
}
function towerDoorVisible(tower,spec){
  // Cutaway keeps doors as 20% ghosted architectural references instead of
  // removing them together with the opened shell.
  return viewDepthPoint(spec.contact)>=viewDepthPoint({x:tower.x,y:tower.y})-.015;
}
function towerLevelHeight(s,level){
  const t=towerTier(s);
  return [2.35,3.55,4.75,5.95][clamp(level,1,maxStructureLevel(s))-1]+(t-1)*.12;
}
// One source of truth for tower floors, windows, arrow slits and archer slots:
// the cutaway floor of each level, and openings at standing eye height above it.
const TOWER_OPENING_EYE_Z=.44;
function towerFloorZ(s,floor){
  const level=structureLevel(s);
  if(floor<=1)return .055;
  // The same storeys as the cutaway (settlement-castle.js towerUpperFloorZ: P1 at the wall-walk).
  return typeof towerUpperFloorZ==='function'?towerUpperFloorZ(s,Math.min(floor,level)-1):structureHeight(s)*(Math.min(floor,level)-1)/level;
}
function towerOpeningZ(s,floor){return towerFloorZ(s,floor)+TOWER_OPENING_EYE_Z}
// Unit outward direction of each tower face: footprint edges for square towers, the
// four quarter directions for round ones (face 0 looks at the castle interior).
function towerFaceDirections(s){
  if(s.shape==='round'){
    const iv=structureInteriorVector(s),base=Math.atan2(iv.y,iv.x);
    return[0,1,2,3].map(i=>({face:i,nx:Math.cos(base+i*Math.PI/2),ny:Math.sin(base+i*Math.PI/2),interior:i===0}));
  }
  const fp=towerFacadePoints(s),interior=interiorFacadeEdgeIndex(s);
  return fp.map((a,i)=>{
    // D tower sides: the slit's own spot on the half round (at) and its normal.
    const slit=s.shape==='dee'&&deeSideSlit(s,i);if(slit)return{face:i,nx:slit.n.x,ny:slit.n.y,at:slit.at,interior:i===interior};
    const b=fp[(i+1)%fp.length],nx=(a.x+b.x)/2-s.x,ny=(a.y+b.y)/2-s.y,L=Math.hypot(nx,ny)||1;
    return{face:i,nx:nx/L,ny:ny/L,interior:i===interior};
  });
}
// A wall, built section or palisade snapped to the tower covers the face it meets
// up to its own height: no arrow slit is drawn there and no archer can use it.
function towerFaceBlocked(s,dir,floor){
  if(towerFaceOnDivider(s,dir,towerOpeningZ(s,floor)))return true;
  return State.structures.some(wall=>{
    if(underConstruction(wall)||!['wall','built','palisade'].includes(wall.type))return false;
    if(wall.aSnap!==s.id&&wall.bSnap!==s.id)return false;
    if(structureLevel(wall)<floor)return false;
    const contact=wall.aSnap===s.id?wall.a:wall.b;if(!contact)return false;
    const dx=contact.x-s.x,dy=contact.y-s.y,L=Math.hypot(dx,dy)||1;
    // Corner junctions disable both adjacent wall faces.
    return (dir.nx*dx+dir.ny*dy)/L>=.65;
  });
}
// Parent/subtower pairs: a face whose middle runs into the attached structure is a dividing
// wall up to that structure's height - no arrow slit, window or door opens onto it.
function towerFaceOnDivider(s,dir,z){
  const half=s.shape==='round'?(Number(s.r)||.5):Math.max(rectDims(s).w,rectDims(s).h)/2;
  const probe=dir.at?{x:dir.at.x+dir.nx*.12,y:dir.at.y+dir.ny*.12}:{x:s.x+dir.nx*(half+.12),y:s.y+dir.ny*(half+.12)};
  return State.structures.some(o=>o!==s&&!underConstruction(o)&&['tower','gate'].includes(o.type)&&
    (o.id===s.parentTowerId||o.parentTowerId===s.id)&&structureHeight(o)>z&&pointInPolygon(probe,footprintPoints(o)));
}
// Same rule for an edge (facade asset placement): its middle's direction from the tower centre.
function towerEdgeOnDivider(s,edge,z){
  const mx=(edge.a.x+edge.b.x)/2-s.x,my=(edge.a.y+edge.b.y)/2-s.y,L=Math.hypot(mx,my)||1;
  return towerFaceOnDivider(s,{nx:mx/L,ny:my/L},z);
}
// A raised keep door opens on the first upper storey (floor 2): on that floor it takes the
// place of the window, and of the heraldic drape, on the face it opens through.
// Likewise a wall-walk (or roof) door gives way to nothing: the window of its face on the storey
// it opens onto steps aside, so a tower between two walls shows both doors.
function towerWindowGivesWayToDoor(s,edgeOrDir,floor){
  let nx=edgeOrDir.nx,ny=edgeOrDir.ny;
  if(edgeOrDir.a){nx=(edgeOrDir.a.x+edgeOrDir.b.x)/2-s.x;ny=(edgeOrDir.a.y+edgeOrDir.b.y)/2-s.y}
  const L=Math.hypot(nx,ny)||1,facing=d=>(nx*d.outward.x+ny*d.outward.y)/L>.7;
  const raised=window.ConquerKeepEntrance?.sill?.(s)!=null;
  const z=floor>=2?towerOpeningZ(s,floor):1.53;   // the window's centre on that storey
  return towerDoorSpecs(s).some(d=>{
    if(d.raised)return raised&&floor===2&&facing(d);
    if(d.kind!=='wall'&&d.kind!=='roof')return false;
    const top=d.baseZ+Math.max(.18,d.apexZ-d.baseZ)/2;   // drawn height: half the opening (drawTowerDoorSpec)
    return facing(d)&&d.baseZ<z+.3&&top>z-.3;
  });
}
function towerSlitFace(s,face,floor){
  const dir=towerFaceDirections(s).find(d=>d.face===face);
  return !!dir&&!dir.interior&&floor>=2&&!towerFaceBlocked(s,dir,floor)
    &&!window.ConquerRoomExterior?.takesTowerFace?.(s,face,floor);
}
function towerWindowRows(s){
  const l=structureLevel(s),rows=[];
  // P1 keeps its defensive blind walls, except an interior window for the mastio
  // so even the first completed T1 stone tower can display the hanging heraldry.
  if(l===1&&s.isMastio)rows.push({floor:1,z:1.53});
  for(let floor=2;floor<=l;floor++)rows.push({floor,z:towerOpeningZ(s,floor)});
  return rows.filter(r=>r.z<structureHeight(s)-.28);
}
function builtWindowSegment(s){
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const startPad=s.aSnap?Math.min(.20,L*.12):.04;
  const endPad=s.bSnap?Math.min(.20,L*.12):.04;
  const usable=Math.max(.05,L-startPad-endPad);
  return{
    a:{x:s.a.x+ux*startPad,y:s.a.y+uy*startPad},
    b:{x:s.b.x-ux*endPad,y:s.b.y-uy*endPad},
    length:usable
  };
}
function linearFacadeEdge(s,side){
  const seg=builtWindowSegment(s),dx=seg.b.x-seg.a.x,dy=seg.b.y-seg.a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
  // Tiny outward epsilon prevents z-fighting with the castle-union face.
  const off=(Number(s.width)||1)/2+.004;
  return{
    a:{x:seg.a.x+nx*off*side,y:seg.a.y+ny*off*side},
    b:{x:seg.b.x+nx*off*side,y:seg.b.y+ny*off*side},
    length:seg.length
  };
}
// Portico on the interior facade, shared by the 2.5D, World 3D and cutaway renderers: bays of
// 2 or 3 arches (arcade2/arcade3), never taller than the slab of the raised floor above.
function builtArcadeLayout(s){
  if(!s||s.type!=='built'||underConstruction(s)||builtSkin(s)!=='arcade')return null;
  const side=-wallExteriorSide(s),edge=linearFacadeEdge(s,side);
  const ceiling=builtInteriorFloors(s)>=2?cutawayFloorLevels(s)[1].z-.08:structureHeight(s)-.16,h=Math.min(1.46,ceiling);
  if(h<=.18||edge.length<.35)return null;
  const count=Math.max(1,Math.round(edge.length/2.55)),cell=edge.length/count,key=cell<2.25?'arcade2':'arcade3';
  return{side,edge,h,centerZ:.04+h/2,count,cell,key,arches:key==='arcade2'?2:3,
    bays:Array.from({length:count},(_,i)=>({off:(i+.5)*cell-edge.length/2,w:cell*.96}))};
}
// Real loggia of a W1 portico (World 3D, like the carved gate passage): the whole ground floor is
// an open hall behind a row of piers with round arches; only the exterior wall stays closed and
// the raised floor rests on the arches. Faces are world-space polygons [{p,z}] tagged by part:
// 'upper' (block over the loggia), 'ground' (exterior wall), 'backwall' (its face under the
// arches), 'arcade' (end walls, piers, arches), 'ceiling' and 'paving'. The 2.5D renderer keeps
// the arches cut into the facade. Also returned: the ground-floor room under the arches (`room`,
// a cutaway floor basis) and the walkway along the piers (`walk`), kept clear of furniture.
function builtLoggia(s){
  const a=builtArcadeLayout(s);if(!a||isWideBuilt(s))return null;
  const fp=unionFootprintPoints(s),L=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)||1;
  const u={x:(s.b.x-s.a.x)/L,y:(s.b.y-s.a.y)/L},n={x:-u.y,y:u.x};
  const loc=p=>({al:(p.x-s.a.x)*u.x+(p.y-s.a.y)*u.y,ac:(p.x-s.a.x)*n.x+(p.y-s.a.y)*n.y});
  const P=(al,ac)=>({x:s.a.x+u.x*al+n.x*ac,y:s.a.y+u.y*al+n.y*ac});
  const lp=fp.map(loc),C0=Math.min(...lp.map(q=>q.ac)),C1=Math.max(...lp.map(q=>q.ac));
  const side=a.side,front=side>0?C1:C0,depth=(C1-C0)-clamp((C1-C0)*.14,.11,.17),band=.12;
  const back=front-side*depth,inner=front-side*band,cap=a.centerZ+a.h/2,H=structureHeight(s);
  // Footprint clipped to {al,ac} half-planes: keeps snapped, slanted ends exactly as the body has them.
  const clip=(poly,f)=>{const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],fp0=f(loc(p)),fq=f(loc(q));
    if(fp0>=0)out.push(p);if((fp0>=0)!==(fq>=0)){const t=fp0/(fp0-fq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}}return out};
  const faces=[],face=(part,pts)=>faces.push({part,pts});
  const prism=(part,pts,z0,z1,bottom=false)=>{
    if(pts.length<3||!(z1>z0))return;
    face(part,pts.map(p=>({p,z:z1})));if(bottom)face(part,pts.map(p=>({p,z:z0})).reverse());
    for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];face(part,[{p,z:z0},{p:q,z:z0},{p:q,z:z1},{p,z:z1}])}
  };
  const strip=(c0,c1)=>clip(clip(fp,q=>side*(q.ac-c0)),q=>side*(c1-q.ac));   // across between c0 and c1 (towards front)
  prism('upper',fp,cap,H);
  prism('ground',clip(fp,q=>side*(back-q.ac)),0,cap);
  // Arches along the usable facade (snapped ends padded like the windows), piers between them.
  const e0=loc(a.edge.a).al,e1=loc(a.edge.b).al,N=a.count*a.arches,cell=(e1-e0)/N,pw=Math.min(.22,cell*.26),half=(cell-pw)/2;
  const apex=cap-.10,spring=Math.max(.35,apex-half),rise=apex-spring;
  const pier=(x0,x1)=>clip(clip(strip(inner,front),q=>q.al-x0),q=>x1-q.al);
  // End walls close the loggia against towers and gates; piers are only the front band.
  prism('arcade',clip(strip(back,front),q=>e0+pw/2-q.al),0,cap);
  prism('arcade',clip(strip(back,front),q=>q.al-(e1-pw/2)),0,cap);
  for(let k=1;k<N;k++){const x=e0+k*cell;prism('arcade',pier(x-pw/2,x+pw/2),0,cap)}
  for(let k=0;k<N;k++){
    const l=e0+k*cell+pw/2,r=l+cell-pw,c=(l+r)/2,arc=[];
    for(let j=0;j<=8;j++){const t=Math.PI*(1-j/8);arc.push({al:c+half*Math.cos(t),z:spring+rise*Math.sin(t)})}
    for(const ac of [front,inner]){
      const cl={p:P(l,ac),z:cap},cr={p:P(r,ac),z:cap},A=q=>({p:P(q.al,ac),z:q.z});
      for(let j=0;j<8;j++)face('arcade',[j<4?cl:cr,A(arc[j]),A(arc[j+1])]);
      face('arcade',[cl,A(arc[4]),cr]);
    }
    for(let j=0;j<8;j++)face('arcade',[{p:P(arc[j].al,front),z:arc[j].z},{p:P(arc[j+1].al,front),z:arc[j+1].z},{p:P(arc[j+1].al,inner),z:arc[j+1].z},{p:P(arc[j].al,inner),z:arc[j].z}]);
  }
  // Rooms: one per bay of arches, split by partitions from the back wall to the walkway.
  const WALK=.18,PART=.06,bayLen=cell*a.arches,walkEdge=inner-side*WALK;
  for(let k=1;k<a.count;k++){const x=e0+k*bayLen;prism('arcade',clip(clip(strip(back,walkEdge),q=>q.al-(x-PART/2)),q=>x+PART/2-q.al),0,cap)}
  // The rooms' wall under the arches stands in the loggia's shadow.
  for(const f of faces)if(f.part==='ground'&&f.pts.every(q=>Math.abs(loc(q.p).ac-back)<1e-6))f.part='backwall';
  const walk=clip(clip(strip(back,front),q=>q.al-e0),q=>e1-q.al);
  face('ceiling',walk.map(p=>({p,z:cap-.002})));
  face('paving',walk.map(p=>({p,z:.006})));
  // Room frame (cutawayFloorBasis shape) between the end walls, the back wall and the piers; v
  // points from the back wall towards the arches. The walkway is the WALK strip along the piers.
  const r0=e0+pw/2,r1=e1-pw/2,mid=(back+inner)/2,c=P((r0+r1)/2,mid),angle=Math.atan2(u.y,u.x),h=Math.abs(inner-back);
  // `room` v axis is n: the arches lie at v = side*h/2, the back wall at -side*h/2.
  const room={center:c,angle,w:r1-r0,h};
  // Each bay's room: from end wall or partition to the next one.
  const rooms=Array.from({length:a.count},(_,k)=>{
    const x0=k?e0+k*bayLen+PART/2:r0,x1=k<a.count-1?e0+(k+1)*bayLen-PART/2:r1;
    return{center:P((x0+x1)/2,mid),angle,w:x1-x0,h};
  });
  const walkV=[side>0?room.h/2-WALK:-room.h/2,side>0?room.h/2:-room.h/2+WALK];
  // Piers along the front band, for navigation: along positions and half width.
  const piers=Array.from({length:N-1},(_,k)=>e0+(k+1)*cell);
  return{side,cap,front,back,inner,faces,room,rooms,walk:{v0:walkV[0],v1:walkV[1],width:WALK},
    local:{u,n,a:s.a,loc,P},span:[r0,r1],piers,pierHalf:pw/2};
}
// Navigation asks per sample point: one loggia per section until its shape changes.
const builtLoggiaMemo=new WeakMap();
function builtLoggiaCached(s){
  const key=[s.a?.x,s.a?.y,s.b?.x,s.b?.y,s.width,s.level,s.skin,s.flip,s.aSnap,s.bSnap,!!underConstruction(s)].join('|');
  const hit=builtLoggiaMemo.get(s);if(hit&&hit.key===key)return hit.g;
  const g=isBuiltPortico(s)?builtLoggia(s):null;builtLoggiaMemo.set(s,{key,g});return g;
}
// Walkers under a W1 portico: true when p (with a clearance) stands in the open loggia, from the
// arches to the inner edge of the walkway, clear of the piers. Furniture keeps the rest.
function builtLoggiaWalkable(s,p,pad=0){
  const g=builtLoggiaCached(s);if(!g)return false;
  const q=g.local.loc(p),r=g.room,c=g.local.loc(r.center),v=(q.ac-c.ac)*g.side;   // v: 0 mid-room, +h/2 at the arches
  if(q.al<g.span[0]+pad||q.al>g.span[1]-pad)return false;
  if(v<r.h/2-g.walk.width+pad)return false;                                        // furniture zone
  if(v>r.h/2&&g.piers.some(x=>Math.abs(q.al-x)<g.pierHalf+pad))return false;      // a pier
  return true;                                                                     // walkway, arch openings and beyond
}
// Where a visitor to a W1 portico stands: on the walkway, spread along it.
function builtLoggiaStandPoint(s,t){
  const g=builtLoggiaCached(s);if(!g)return null;
  const r=g.room,c=g.local.loc(r.center),al=g.span[0]+.2+(g.span[1]-g.span[0]-.4)*Math.max(0,Math.min(1,t));
  return g.local.P(al,c.ac+g.side*(r.h/2-g.walk.width/2));
}
// A fixed count (wide-hall lancets) drops windows whose bay could not hold them undistorted
// (drawn width = min(asset width, bay * .82)).
// P0 of a standard W1 section (stone or with the timber P1): on the courtyard face, bays of about
// 1.25 U, a door in the middle bay and a pair of windows side by side in each of the others.
function builtGroundFront(s){
  if(!s||s.type!=='built'||isLonghouse(s)||isWideBuilt(s)||isBuiltPortico(s)||(typeof isLeanTo==='function'&&isLeanTo(s)))return null;
  const side=-wallExteriorSide(s),edge=linearFacadeEdge(s,side),n=Math.max(1,Math.round(edge.length/1.25)),cell=edge.length/n,door=Math.floor(n/2);
  return{side,edge,bays:Array.from({length:n},(_,k)=>({off:(k+.5)*cell-edge.length/2,door:k===door}))};
}
const BUILT_PAIR_GAP=.13,BUILT_PAIR_W=.22,BUILT_PAIR_H=.46,BUILT_PAIR_Z=.95,BUILT_DOOR_W=.46,BUILT_DOOR_H=.84;
function builtWindowCount(edge,density,fixed,assetWidth=.24){
  return fixed?clamp(Math.floor(edge.length*.82/assetWidth),1,fixed):Math.max(1,Math.round(edge.length*density));
}
// Facade rows shared by the 2.5D and 3D renderers: [side,z,density,key,width,height,lit,fixedCount].
const HALL_LANCET_ASPECT=640/1566;   // hall_lancet.png: keep the Blender render undistorted
function builtWindowRows(s){
  const l=structureLevel(s),outside=wallExteriorSide(s),inside=-outside,lowerZ=.86,upperZ=2.22;
  if(isWideBuilt(s)){
    // One free-height hall: four lancets rising through both storeys, slits outside.
    // A portico takes the interior ground floor, so the hall falls back to clerestory lights.
    const arcade=builtSkin(s)==='arcade',slits=[[outside,.86,.72,'arrowSlit',.23,.58,false]];
    const lancet=h=>[inside,.24+h/2,0,'hallLancet',h*HALL_LANCET_ASPECT,h,true,4];
    if(l<2)return arcade?slits:[lancet(1.30),...slits];
    return[arcade?[inside,upperZ,.42,'gothicL3',.92,.78,true]:lancet(2.12),...slits,[outside,upperZ,.72,'arrowSlit',.23,.58,false]];
  }
  // Standard W1 sections: no slits at P0, the ground floor opens on the courtyard (builtGroundFront).
  const rows=builtGroundFront(s)?[]:[[outside,lowerZ,.72,'arrowSlit',.23,.58,false]];
  // Timber P1: its frame carries its own windows (builtTimberFacade).
  if(l>=2&&typeof builtTimberUpper==='function'&&builtTimberUpper(s))return rows;
  if(l>=2)rows.unshift([inside,upperZ,.42,'gothicL3',.92,.78,true]),rows.push([outside,upperZ,.72,'arrowSlit',.23,.58,false]);
  return rows;
}
