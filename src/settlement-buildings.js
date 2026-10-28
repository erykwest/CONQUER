'use strict';
// Civic buildings, house silhouettes, windows and doors. Runtime semantics preserved from the monolith.
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
// Structural placeholder only: no piazza services, bonuses or populations yet.
function drawPlaza(s,preview=false){
  const p=civicParts(s)[0];if(!p)return;
  const level=civicLevel(s),variant=plazaVariant(s),angle=s.angle||0;
  const selected=State.selectedId===s.id;
  const top=variant==='garden'?'#8c9776':variant==='fountain'?'#a5a9a8':'#b3a28e';
  extrudePolygonAt(p.points,0,.10,{top,sideA:'#777269',sideB:'#868076',
    stroke:selected?'#f4b76f':'#b5aaa0'});
  if(variant==='garden'){
    for(const [x,y] of [[-1.08,-1.08],[1.08,-1.08],[-1.08,1.08],[1.08,1.08]]){
      const c=houseLocalToWorld(s,x,y);
      extrudePolygonAt(rectWorldPoints(c.x,c.y,1.15,1.15,angle),.10,.15,
        {top:'#698555',sideA:'#80725b',sideB:'#80725b'});
    }
  }else if(variant==='fountain'){
    const c=houseLocalToWorld(s,0,0);
    extrudePolygonAt(rectWorldPoints(c.x,c.y,1.45,1.45,angle),.10,.29,
      {top:'#697e82',sideA:'#787c7b',sideB:'#8c9190'});
    extrudePolygonAt(rectWorldPoints(c.x,c.y,.65,.65,angle),.29,.35+level*.12,
      {top:'#b3b8b5',sideA:'#858c89',sideB:'#969e9b'});
  }else{
    const c=houseLocalToWorld(s,0,0);
    extrudePolygonAt(rectWorldPoints(c.x,c.y,1.25,1.25,angle),.10,.135,
      {top:'#c2b7a4',sideA:'#81796c',sideB:'#8e8576'});
  }
  if(level>=2)for(const [x,y] of [[-2,-2],[2,-2],[-2,2],[2,2]]){
    const c=houseLocalToWorld(s,x,y);
    extrudePolygonAt(rectWorldPoints(c.x,c.y,.24,.24,angle),.10,.27,
      {top:'#a49c8c',sideA:'#696659',sideB:'#777164'});
  }
  if(level>=3){
    const c=houseLocalToWorld(s,0,0);
    if(variant==='paved')extrudePolygonAt(rectWorldPoints(c.x,c.y,.45,.45,angle),.135,.60,
      {top:'#c0b7a9',sideA:'#827b72',sideB:'#938a80'});
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
  if(!preview&&!underConstruction(s)){
    drawCivicEntrance(s);
    drawCivicCemetery(s);
  }
}
// The cemetery is an intrinsic L1 lot feature, not a paid or removable annex.
function drawCivicCemetery(church){
  const area=civicCemeteryArea(church);if(!area)return;
  extrudePolygonAt(area.points,0,.035,{
    top:'#827b69',sideA:'#665e51',sideB:'#756d5d',stroke:'rgba(185,170,146,.7)'
  });
  for(const grave of civicCemeteryGraves(church)){
    extrudePolygonAt(grave.points,.035,.08,{
      top:'#675c4f',sideA:'#4b443c',sideB:'#5b5146'
    });
    const head=houseLocalToWorld({x:grave.center.x,y:grave.center.y,angle:grave.angle},0,-.23);
    extrudePolygonAt(rectWorldPoints(head.x,head.y,.25,.14,grave.angle),.08,.39,{
      top:'#b5b1a6',sideA:'#78766f',sideB:'#96928b'
    });
  }
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
function drawCivicAnnex(s,preview=false){
  const spec=civicAnnexDefinition(s);if(!spec)return;
  // Blender-built model (settlement-civic3d.js); the block below is the fallback.
  if(window.ConquerCivic3D?.draw(s,preview))return;
  const poly=civicAnnexFootprint(s),kind=spec.kind;
  const low=kind==='garden'||kind==='yard'||kind==='plaza';
  const height=kind==='garden'?.13:kind==='yard'||kind==='plaza'?.09:kind==='stall'?.75:1.32;
  const palette=kind==='garden'
    ?{top:'#6a8452',sideA:'#67573c',sideB:'#7c6948'}
    :kind==='yard'?{top:'#ad9a7a',sideA:'#8b7961',sideB:'#96846c'}
    :kind==='stone'?{top:'#85847d',sideA:'#696862',sideB:'#777671'}
    :{top:'#9b7c57',sideA:'#79563b',sideB:'#876446'};
  extrudePolygonAt(poly,0,height,{...palette,stroke:'#51473c'});
  if(kind==='garden'){
    for(const offset of [-.45,0,.45]){
      const c=houseLocalToWorld(s,offset,0);
      const a=houseLocalToWorld(s,offset,-.65),b=houseLocalToWorld(s,offset,.65);
      const p=w2s(a,.14),q=w2s(b,.14);
      ctx.save();ctx.strokeStyle='#456536';ctx.lineWidth=Math.max(1,State.view.scale*1.8);
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore();
    }
  }
  if(!low&&kind!=='stall'){
    const ridge=poly.map(p=>w2s(p,height)),center=w2s(s,height+.30);
    ctx.save();ctx.strokeStyle='#5d5148';ctx.lineWidth=Math.max(.8,State.view.scale);
    for(const i of [0,2]){ctx.beginPath();ctx.moveTo(ridge[i].x,ridge[i].y);ctx.lineTo(center.x,center.y);ctx.stroke()}
    ctx.restore();
  }
}
function drawCivicStructure(s,preview=false){
  // Blender-built models (settlement-civic3d.js, church with its cemetery); the
  // geometric drawings below stay as the fallback.
  if(window.ConquerCivic3D?.draw(s,preview))return;
  if(s.type==='market')drawMarket(s,preview);
  else if(s.type==='tavern')drawTavern(s,preview);
  else if(s.type==='church')drawChurch(s,preview);
  else if(s.type==='training')drawTrainingField(s,preview);
  else if(s.type==='plaza')drawPlaza(s,preview);
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
  // Blender model (settlement-wood3d.js); the drawing below is the fallback.
  if(window.ConquerWood3D?.draw(s,preview)){
    if(selected)pathPolygon(projectPath(footprintPoints(s),.025),null,'#f4b76f',2);
    return;
  }

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
    const buttressTop=(2.35+(towerTier(s)-1)*.12)*.5;
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
function fieldGrid(field){return fieldLayout(field)}
function drawField(field){drawFieldGround(field)}
// L1 cottages are thatched (straw); L2+ use anthracite slate. Gables stay timber/plaster.
const HOUSE_THATCH={a:'#b39250',b:'#c4a25d',stroke:'#d8bd7c'};
function drawHouseRoofPart(s,part,wallH,ridgeH,roofMaterial=false,gableFill=null){
  const anthracite=roofMaterial===true,thatch=roofMaterial==='thatch';
  const turn=part.roofTurn||0,angle=Number.isFinite(part.roofAngle)?part.roofAngle:(s.angle||0)+turn;
  const ca=Math.cos(angle),sa=Math.sin(angle),center=part.center||houseLocalToWorld(s,part.cx,part.cy);
  const rw=Math.abs(turn)>1e-6?part.h:part.w,rh=Math.abs(turn)>1e-6?part.w:part.h;
  const local=(x,y)=>({x:center.x+x*ca-y*sa,y:center.y+x*sa+y*ca});
  const c0=local(-rw/2,-rh/2),c1=local(rw/2,-rh/2),c2=local(rw/2,rh/2),c3=local(-rw/2,rh/2);
  const r0=local(-rw/2,0),r1=local(rw/2,0);
  const winter=State.season==='winter';
  const faces=[
    {kind:'roof',screen:[w2s(c0,wallH),w2s(c1,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:winter?WINTER_SNOW_A:(anthracite?'#303237':thatch?HOUSE_THATCH.a:'#5b3d30'),stroke:winter?WINTER_SNOW_STROKE:(anthracite?'#55585e':thatch?HOUSE_THATCH.stroke:'#8c6752'),lw:1},
    {kind:'roof',screen:[w2s(c3,wallH),w2s(c2,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:winter?WINTER_SNOW_B:(anthracite?'#3a3d42':thatch?HOUSE_THATCH.b:'#6b4938'),stroke:winter?WINTER_SNOW_STROKE:(anthracite?'#55585e':thatch?HOUSE_THATCH.stroke:'#8c6752'),lw:1},
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
    ring=rectWorldPoints(center.x,center.y,turret.size*1.18,turret.size*1.18,
      Number.isFinite(turret.roofAngle)?turret.roofAngle:(s.angle||0));
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
  const stroke=selected?'#f4b76f':'#918d86',breakZ=turret.floorZ;
  // L4 turret follows the elite-house language: grey lower floor, warm cream upper floors.
  extrudePolygonAt(turret.points,0,breakZ,{
    top:'#625e59',sideA:'#4f4b47',sideB:'#625e59',stroke:null
  });
  extrudePolygonAt(turret.points,breakZ,turret.bodyH,{
    top:'#d6bf82',sideA:'#c8ae70',sideB:'#e0ca91',stroke
  });
  // Timber frame and windows (houseTurretFacade), only on the turret's camera-facing side.
  const plan=houseTurretFacade(turret),facing=(p,n)=>viewDepthPoint({x:p.x+n.x*.1,y:p.y+n.y*.1})>viewDepthPoint(p);
  ctx.save();ctx.strokeStyle='#3b2a1e';ctx.lineCap='square';ctx.lineWidth=Math.max(.8,HOUSE_TIMBER_W*U*State.view.scale);
  ctx.beginPath();
  for(const b of plan.beams){
    if(!facing({x:(b.a.p.x+b.b.p.x)/2,y:(b.a.p.y+b.b.p.y)/2},b.normal))continue;
    const a=w2s(b.a.p,b.a.z),c=w2s(b.b.p,b.b.z);ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);
  }
  ctx.stroke();ctx.restore();
  for(const w of plan.windows)if(facing(w.p,w.normal))drawHouseFacadePane(w);
  drawHouseTurretRoof(s,turret,selected);
}
// A small dark window pane {p,z,tangent,hw,hh} in world space (turrets, dormers).
function drawHouseFacadePane(w){
  const t=w.tangent,l={x:w.p.x-t.x*w.hw,y:w.p.y-t.y*w.hw},r={x:w.p.x+t.x*w.hw,y:w.p.y+t.y*w.hw};
  pathPolygon([w2s(l,w.z-w.hh),w2s(r,w.z-w.hh),w2s(r,w.z+w.hh),w2s(l,w.z+w.hh)],'rgba(31,29,28,.86)','rgba(190,178,155,.42)',.7);
}
// L4 roof dormers of one part (urbanHouseDormers), on the slope facing the camera.
function drawHouseDormers(dormers,part){
  const winter=State.season==='winter';
  const colors={front:'#e0ca91',cheek:'#c8ae70',gable:'#d9c184',
    roofA:winter?WINTER_SNOW_A:'#303237',roofB:winter?WINTER_SNOW_B:'#3a3d42'};
  for(const d of dormers){
    if(Math.abs(d.partCenter.x-part.center.x)>1e-6||Math.abs(d.partCenter.y-part.center.y)>1e-6)continue;
    const n=d.normal;
    if(viewDepthPoint({x:d.center.x+n.x*.1,y:d.center.y+n.y*.1})<=viewDepthPoint(d.center))continue;
    const faces=d.faces.map(f=>{const screen=f.pts.map(v=>w2s(v.p,v.z));return{f,screen,depth:screen.reduce((a,p)=>a+p.y,0)/screen.length}});
    faces.sort((a,b)=>a.depth-b.depth);
    for(const {f,screen} of faces)pathPolygon(screen,colors[f.kind],f.kind.startsWith('roof')?'#55585e':'rgba(126,116,102,.55)',.6);
    drawHouseFacadePane(d.window);
  }
}
// Yard outbuildings of L3/L4 plots (urbanLotOutbuildings): timber storehouse with a gabled
// shingle roof, or an open lean-to on posts whose high side backs onto the plot boundary.
const OUTBUILDING_TIMBER={a:'#5d4431',b:'#71543c',gable:'#6b4f39',stroke:'rgba(176,142,104,.55)'};
function drawUrbanOutbuilding(s,part,selected=false){
  const stroke=selected?'#f4b76f':OUTBUILDING_TIMBER.stroke;
  if(part.type==='store'){
    extrudePolygonAt(part.points,0,part.bodyH,{top:OUTBUILDING_TIMBER.b,sideA:OUTBUILDING_TIMBER.a,sideB:OUTBUILDING_TIMBER.b,stroke});
    drawHouseRoofPart(s,part,part.bodyH,part.roofH,false,OUTBUILDING_TIMBER.gable);
    return;
  }
  const faces=urbanHouseFaces(s,part),winter=State.season==='winter',ground=terrainElevation(part.center);
  const sa=Math.sin(part.roofAngle),ca=Math.cos(part.roofAngle),c=part.center;
  const local=(x,y)=>({x:c.x+x*ca-y*sa,y:c.y+x*sa+y*ca});
  const items=[];
  // Back plank wall along the boundary (local -Y), posts at the yard corners, then the slope.
  const back=faces.findIndex(f=>f.slice(0,2).every(v=>Math.abs(-(v.p.x-c.x)*sa+(v.p.y-c.y)*ca+part.h/2)<1e-6));
  if(back>=0)items.push({depth:viewDepthPoint(local(0,-part.h/2)),draw:()=>pathPolygon(faces[back].map(v=>w2s(v.p,v.z-ground)),OUTBUILDING_TIMBER.a,stroke,.75)});
  const posts=part.w>1.3?[-.5,0,.5]:[-.5,.5];
  for(const t of posts){
    const p=local(t*(part.w-.08),part.h/2-.04);
    items.push({depth:viewDepthPoint(p),draw:()=>{const a=w2s(p,0),b=w2s(p,part.bodyH);ctx.save();ctx.strokeStyle='#4a3626';ctx.lineWidth=Math.max(1,State.view.scale*1.1);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()}});
  }
  const roof=faces[faces.length-1];
  items.push({depth:viewDepthPoint(c),draw:()=>pathPolygon(roof.map(v=>w2s(v.p,v.z-ground+.01)),winter?WINTER_SNOW_A:'#6b4938',winter?WINTER_SNOW_STROKE:'#8c6752',1)});
  items.sort((a,b)=>a.depth-b.depth).forEach(i=>i.draw());
}
function drawHouse(s){
  const level=houseLevel(s),wallH=houseBodyHeight(s),selected=State.selectedId===s.id;
  const stroke=selected?'#f4b76f':'#aaa199';
  const display=urbanHouseDisplayParts(s),ridges=housePartRidges(s,display,wallH);
  const parts=display.map((part,i)=>{
    const center=part.center||houseLocalToWorld(s,part.cx,part.cy);
    return{...part,ridgeH:ridges[i],depth:viewDepthPoint(center)};
  }).sort((a,b)=>a.depth-b.depth);

  if(level===1){
    for(const part of parts){
      if(part.kind==='outbuilding'){drawUrbanOutbuilding(s,part,selected);continue}
      if(part.kind==='turret'){drawHouseTurret(s,part,selected);continue}
      extrudePolygon(part.points,wallH,{top:'#7d5b43',sideA:'#4e392d',sideB:'#654936',stroke:selected?'#f4b76f':'#b89575'});
      drawHouseRoofPart(s,part,wallH,part.ridgeH,'thatch',null);
    }
  }else{
    const floorBreak=houseFloorBreak(wallH);
    const creamTop='#d6bf82',creamA='#c8ae70',creamB='#e0ca91',creamGable='#d9c184';
    const dormers=level===4?urbanHouseGeometry().find(e=>e.house.id===s.id)?.dormers||[]:[];
    for(const part of parts){
      if(part.kind==='outbuilding'){drawUrbanOutbuilding(s,part,selected);continue}
      if(part.kind==='turret'){drawHouseTurret(s,part,selected);continue}
      // Recessed stone ground floor; the jettied upper floor overhangs it on the door side and opposite.
      extrudePolygonAt(part.basePoints||part.points,0,floorBreak,{top:'#625e59',sideA:'#4f4b47',sideB:'#625e59',stroke:null});
      extrudePolygonAt(part.points,floorBreak,wallH,{top:creamTop,sideA:creamA,sideB:creamB,stroke});
      drawHouseRoofPart(s,part,wallH,part.ridgeH,true,creamGable);
      if(dormers.length)drawHouseDormers(dormers,part);
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
function drawHouseDoor(house){
  const d=houseDoorInfo(house),halfW=Math.min(.08,(Number(house.w)||1.5)*.0533);
  const visible=visibleFacadeEdges(house).some(e=>pointSegmentDistance(d.surface,e.a,e.b)<.08);
  if(!visible)return;
  // The door opens in the recessed ground floor, under the jetty.
  const j=houseJetty(house),c={x:d.surface.x-d.normal.x*j,y:d.surface.y-d.normal.y*j};
  const l={x:c.x-d.tangent.x*halfW,y:c.y-d.tangent.y*halfW};
  const r={x:c.x+d.tangent.x*halfW,y:c.y+d.tangent.y*halfW};
  const poly=[w2s(l,.04),w2s(r,.04),w2s(r,HOUSE_DOOR_TOP),w2s(l,HOUSE_DOOR_TOP)];
  pathPolygon(poly,'#39271e','rgba(170,139,96,.50)',.7);
}
function drawAutoStructure(s,preview=false){
  ctx.save();if(preview)ctx.globalAlpha=.58;else if(underConstruction(s))ctx.globalAlpha=.38;
  if(s.type==='field'){
    drawField(s);
  }else if(s.type==='road'){
    const a=w2s(s.a),b=w2s(s.b);ctx.strokeStyle='rgba(126,106,82,.70)';ctx.lineWidth=Math.max(2,s.width*U*State.view.scale*.72);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }else if(s.type==='house'){
    // A house being built is assembled piece by piece (opaque) when the assembly is loaded.
    if(!preview&&underConstruction(s)&&window.ConquerAssembly?.has(s)){ctx.globalAlpha=1;window.ConquerAssembly.draw(s)}
    else withStructureVisualMaterial(s,()=>drawHouse(s));
  }
  ctx.restore();
  if(underConstruction(s)){if(!preview)window.ConquerConstructionProps?.drawSite(s);drawConstructionProgress(s)}
}
function structureCenter(s){if(s.x!=null)return{x:s.x,y:s.y};if(s.a&&s.b)return{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};return{x:0,y:0}}

