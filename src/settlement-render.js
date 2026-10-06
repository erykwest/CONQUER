'use strict';
// CONQUER settlement render module — classic-script shared runtime.
function gateFacadeEdges(s){
  const fp=footprintPoints(s);if(fp.length<4)return[];
  const defs=[
    {a:fp[0],b:fp[1],role:'side'},
    {a:fp[1],b:fp[2],role:'front'},
    {a:fp[2],b:fp[3],role:'side'},
    {a:fp[3],b:fp[0],role:'rear'}
  ];
  for(const e of defs){
    const a=w2s(e.a,0),b=w2s(e.b,0);
    e.depth=(a.y+b.y)/2;
  }
  defs.sort((a,b)=>b.depth-a.depth);
  return defs.slice(0,2);
}
function drawGatePortalOnEdge(edge){
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const cx=(edge.a.x+edge.b.x)/2,cy=(edge.a.y+edge.b.y)/2,half=.39;
  const l={x:cx-ux*half,y:cy-uy*half},r={x:cx+ux*half,y:cy+uy*half};
  const lb=w2s(l,.03),rb=w2s(r,.03),ls=w2s(l,1.05),rs=w2s(r,1.05),apex=w2s({x:cx,y:cy},1.38);
  const poly=[lb,rb,rs,apex,ls];
  ctx.save();
  pathPolygon(poly,'#241a16','#9a7458',1);
  const bottom=w2s({x:cx,y:cy},.03);
  ctx.strokeStyle='rgba(145,104,76,.72)';ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(bottom.x,bottom.y);ctx.lineTo(apex.x,apex.y);ctx.stroke();
  ctx.restore();
}
function drawGatePortals(){
  for(const s of State.structures){
    if(s.type!=='gate'||underConstruction(s))continue;
    withStructureDetailOcclusion(s,1.38,()=>{
      for(const edge of gateFacadeEdges(s)){
        if(edge.role==='front'||edge.role==='rear')drawGatePortalOnEdge(edge);
      }
    });
  }
}
function gateWindowRows(s){
  const level=structureLevel(s),rows=[1.95];
  if(level>=2)rows.push(3.15);
  if(level>=3)rows.push(4.35);
  return rows.filter(z=>z<structureHeight(s)-.35);
}
function drawGateWindows(s,lit=false,nf=1){
  for(const z of gateWindowRows(s)){
    withStructureDetailOcclusion(s,z,()=>{
      for(const edge of gateFacadeEdges(s)){
        const a=w2s(edge.a,z),b=w2s(edge.b,z),L=Math.hypot(b.x-a.x,b.y-a.y);
        const gap=Math.min(clamp(8*State.view.scale,5,11),L*.28);
        drawWindowOnEdge(edge,z,lit,nf,-gap/2);
        drawWindowOnEdge(edge,z,lit,nf,gap/2);
      }
    });
  }
}
function visibleFacadeEdges(s){
  const rings=s.type==='house'?houseFootprintParts(s).filter(p=>p.kind!=='turret').map(p=>p.points):[footprintPoints(s)];
  const edges=[];
  for(const fp of rings){
    if(fp.length<4)continue;
    for(let i=0;i<fp.length;i++){
      const j=(i+1)%fp.length,a=w2s(fp[i],0),b=w2s(fp[j],0);
      edges.push({a:fp[i],b:fp[j],depth:(a.y+b.y)/2});
    }
  }
  edges.sort((a,b)=>b.depth-a.depth);
  return edges.slice(0,s.type==='house'&&houseLevel(s)>=3?4:2);
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
    apexZ=Math.min(towerH-.16,baseZ+.92);
    if(apexZ-baseZ<.48)return null;
  }

  return{kind,contact:anchor,tangent,outward,baseZ,apexZ,wallId:wall?.id||null};
}
function towerDoorSpecs(tower){
  if(!tower||tower.type!=='tower'||underConstruction(tower))return[];
  const specs=[];

  // Primary ground-floor entrance exists only on independent towers.
  // Attached subtowers deliberately have NO ground-floor door.
  if(!tower.parentTowerId){
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
    if(front)specs.push(front);
  }

  // Additional doors at every true wall socket connected to this tower.
  for(const wall of State.structures){
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
  return specs;
}
function towerDoorVisible(tower,spec){
  // Near half of the tower only; the body naturally hides rear doors until
  // the camera is rotated.
  return viewDepthPoint(spec.contact)>=viewDepthPoint({x:tower.x,y:tower.y})-.015;
}
function towerDoorOccluders(tower,spec,apexZ){
  const ownerDepth=worldDepth(tower);
  return State.structures.filter(o=>{
    if(o.id===tower.id||underConstruction(o)||!isCastlePart(o))return false;
    if(structureVisualTopHeight(o)<=spec.baseZ+.025)return false;

    // Connected/overlapping structures always mask the doorway where their
    // actual volume crosses the tower facade.
    if(structuresOverlapInPlan(tower,o))return true;

    // Otherwise ordinary camera depth determines foreground masking.
    return worldDepth(o)>ownerDepth+1e-4;
  });
}
function drawTowerDoorSpec(tower,spec){
  if(!towerDoorVisible(tower,spec))return;

  // Architectural scale reduction: both width and height are one third of
  // the previous tower-door size. These are now single-leaf doors.
  const tier=towerTier(tower),width=clamp(.38+tier*.045,.42,.54)/3,half=width/2;
  const tx=spec.tangent.x,ty=spec.tangent.y,c=spec.contact;
  const fullHeight=Math.max(.18,spec.apexZ-spec.baseZ),apexZ=spec.baseZ+fullHeight/3;
  const springZ=spec.baseZ+(apexZ-spec.baseZ)*.66;
  const l={x:c.x-tx*half,y:c.y-ty*half},r={x:c.x+tx*half,y:c.y+ty*half};
  const lb=w2s(l,spec.baseZ),rb=w2s(r,spec.baseZ),ls=w2s(l,springZ),rs=w2s(r,springZ),apex=w2s(c,apexZ);

  const drawDoor=()=>{
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(lb.x,lb.y);ctx.lineTo(rb.x,rb.y);ctx.lineTo(rs.x,rs.y);
    ctx.quadraticCurveTo((rs.x+apex.x)/2,apex.y,apex.x,apex.y);
    ctx.quadraticCurveTo((ls.x+apex.x)/2,apex.y,ls.x,ls.y);
    ctx.lineTo(lb.x,lb.y);ctx.closePath();
    ctx.fillStyle='#211713';ctx.fill();
    ctx.strokeStyle='#9a7458';ctx.lineWidth=.8;ctx.stroke();
    ctx.restore();
  };

  // Door hierarchy is lower than every other castle element. In particular,
  // the linked wall is an occluder too: its silhouette hides the lower part
  // of a wall-walk doorway instead of letting the door paint over masonry.
  const occluders=towerDoorOccluders(tower,spec,apexZ);
  if(!occluders.length){drawDoor();return}

  const rr=wrap.getBoundingClientRect();
  ctx.save();ctx.beginPath();ctx.rect(-48,-48,rr.width+96,rr.height+96);
  for(const o of occluders){
    const hull=structureScreenSilhouette(o);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');drawDoor();ctx.restore();
}
function drawTowerDoors(){
  for(const tower of State.structures){
    if(tower.type!=='tower'||isWoodTower(tower)||underConstruction(tower))continue;
    for(const spec of towerDoorSpecs(tower))drawTowerDoorSpec(tower,spec);
  }
}
function drawWindowOnEdge(edge,z=.48,lit=false,nf=1,offsetPx=0){
  const mx=(edge.a.x+edge.b.x)/2,my=(edge.a.y+edge.b.y)/2;
  const base=w2s({x:mx,y:my},z),a=w2s(edge.a,z),b=w2s(edge.b,z);
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const ww=clamp(4.2*State.view.scale,2.2,5.2),wh=clamp(6.5*State.view.scale,3.2,7.4);
  const cx=base.x+ux*offsetPx,cy=base.y+uy*offsetPx;
  const corners=[
    {x:cx-ux*ww/2,y:cy-uy*ww/2-wh/2},
    {x:cx+ux*ww/2,y:cy+uy*ww/2-wh/2},
    {x:cx+ux*ww/2,y:cy+uy*ww/2+wh/2},
    {x:cx-ux*ww/2,y:cy-uy*ww/2+wh/2}
  ];
  ctx.save();
  if(lit){
    ctx.shadowColor='rgba(255,190,80,'+(.72*nf)+')';ctx.shadowBlur=clamp(9*State.view.scale,4,12);
    pathPolygon(corners,'rgba(255,213,118,'+(.92*nf)+')','rgba(90,58,24,.72)',.8);
  }else pathPolygon(corners,'rgba(35,29,24,.82)','rgba(170,139,96,.38)',.7);
  ctx.restore();
}
function towerLevelHeight(s,level){
  const t=towerTier(s);
  return [2.35,3.55,4.75][clamp(level,1,3)-1]+(t-1)*.12;
}
function towerWindowRows(s){
  const level=structureLevel(s),rows=[],drop=.42;
  if(level>=2){
    const z=(towerLevelHeight(s,1)+towerLevelHeight(s,2))/2-drop;
    rows.push({z,count:1});
  }
  if(level>=3){
    const z=(towerLevelHeight(s,2)+towerLevelHeight(s,3))/2-drop;
    rows.push({z,count:2});
  }
  return rows;
}
function drawRoundTowerWindowRow(s,row,lit=false,nf=1){
  const p=w2s({x:s.x,y:s.y},row.z);
  const ww=clamp(3.3*State.view.scale,2,4.2),wh=clamp(7*State.view.scale,3.8,8.5);
  const gap=clamp(8*State.view.scale,5,11);
  const xs=row.count===1?[p.x]:[p.x-gap/2,p.x+gap/2];
  ctx.save();
  for(const x of xs){
    if(lit){ctx.shadowColor='rgba(255,190,80,'+(.72*nf)+')';ctx.shadowBlur=clamp(9*State.view.scale,4,12);ctx.fillStyle='rgba(255,213,118,'+(.92*nf)+')'}
    else ctx.fillStyle='rgba(35,29,24,.82)';
    ctx.fillRect(x-ww/2,p.y-wh/2,ww,wh);
    ctx.strokeStyle=lit?'rgba(90,58,24,.72)':'rgba(170,139,96,.38)';ctx.lineWidth=.8;ctx.strokeRect(x-ww/2,p.y-wh/2,ww,wh);
  }
  ctx.restore();
}
function linearFrontSide(s){
  const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
  const mid={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2},off=(Number(s.width)||1)/2;
  const plus={x:mid.x+nx*off,y:mid.y+ny*off},minus={x:mid.x-nx*off,y:mid.y-ny*off};
  const delta=viewDepthPoint(plus)-viewDepthPoint(minus);
  // At an almost edge-on angle neither long facade should receive windows.
  if(Math.abs(delta)<1e-4)return 0;
  return delta>0?1:-1;
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
function drawBuiltArcade(s){
  if(!s||s.type!=='built'||builtSkin(s)!=='arcade'||underConstruction(s))return;
  const inside=-wallExteriorSide(s);
  // The portico exists only on the courtyard side; if that facade is behind
  // the building body, let the body hide it instead of painting through.
  if(inside!==linearFrontSide(s))return;

  const edge=linearFacadeEdge(s,inside);
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const count=Math.max(1,Math.round(edge.length/1.05));
  const cell=L/count;
  const openingW=Math.min(.74,cell*.70);
  const baseZ=.04,apexZ=Math.min(1.27,structureHeight(s)-.24),springZ=Math.max(.62,apexZ-.46);

  withStructureDetailOcclusion(s,apexZ,()=>{
    for(let i=0;i<count;i++){
      const along=(i+.5)*cell,half=openingW/2;
      const l={x:edge.a.x+ux*(along-half),y:edge.a.y+uy*(along-half)};
      const r={x:edge.a.x+ux*(along+half),y:edge.a.y+uy*(along+half)};
      const m={x:edge.a.x+ux*along,y:edge.a.y+uy*along};
      const lb=w2s(l,baseZ),rb=w2s(r,baseZ),ls=w2s(l,springZ),rs=w2s(r,springZ),apex=w2s(m,apexZ);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lb.x,lb.y);
      ctx.lineTo(rb.x,rb.y);
      ctx.lineTo(rs.x,rs.y);
      ctx.quadraticCurveTo((rs.x+apex.x)/2,apex.y,apex.x,apex.y);
      ctx.quadraticCurveTo((ls.x+apex.x)/2,apex.y,ls.x,ls.y);
      ctx.lineTo(lb.x,lb.y);
      ctx.closePath();
      ctx.fillStyle='#241f1b';
      ctx.fill();
      ctx.strokeStyle='#86796d';
      ctx.lineWidth=1;
      ctx.stroke();
      ctx.restore();
    }

    // A continuous impost line makes the arcade read as one architectural system.
    const a=w2s(edge.a,springZ),b=w2s(edge.b,springZ);
    ctx.save();ctx.strokeStyle='rgba(178,162,146,.45)';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  });
}
function drawWallHoarding(s){
  if(!s||s.type!=='wall'||wallSkin(s)!=='hoarding'||underConstruction(s))return;
  const g=wallExteriorLayout(s),h=g.z;
  const innerOff=Math.max(.02,g.width/2-.02),outerOff=g.width/2+.42;
  const point=(p,off)=>({x:p.x+g.nx*off*g.side,y:p.y+g.ny*off*g.side});

  // Same longitudinal limits as the battlement crest: the gallery reaches the
  // wall sockets exactly, never extends through a tower and never pulls back.
  const seg={a:s.a,b:s.b,length:g.L};
  const innerA=point(seg.a,innerOff),innerB=point(seg.b,innerOff);
  const outerA=point(seg.a,outerOff),outerB=point(seg.b,outerOff);
  const platform=[innerA,innerB,outerB,outerA];
  const roofInnerA=point(seg.a,Math.max(0,g.width/2-.08)),roofInnerB=point(seg.b,Math.max(0,g.width/2-.08));
  const roofOuterA=point(seg.a,outerOff+.07),roofOuterB=point(seg.b,outerOff+.07);
  const exteriorVisible=linearFrontSide(s)===g.side;

  // Reuse the battlement occlusion path itself. This is intentionally a
  // pseudo-merlon covering the whole gallery footprint so towers/gates mask
  // hoarding with the exact same owner/depth/overlap rules as wall merlons.
  const maskPiece={
    pts:[roofInnerA,roofInnerB,roofOuterB,roofOuterA],
    z0:Math.max(.02,h-.58),z1:h+.66,
    depth:worldDepth(s),ownerId:s.id,ownerType:'wall',
    ownerDepth:worldDepth(s),ownerTop:h
  };

  withTowerBattlementOcclusion(maskPiece,()=>{
    extrudePolygonAt(platform,h-.045,h+.055,{
      top:'#74533a',sideA:'#493423',sideB:'#5d432e',stroke:'#927155'
    });

    const roof=[w2s(roofInnerA,h+.66),w2s(roofInnerB,h+.66),w2s(roofOuterB,h+.47),w2s(roofOuterA,h+.47)];
    pathPolygon(roof,'#4b382a','#806047',1);

    if(exteriorVisible){
      const low=h-.03,high=h+.43;
      pathPolygon(
        [w2s(outerA,low),w2s(outerB,low),w2s(outerB,high),w2s(outerA,high)],
        '#654832','#8d694d',1
      );

      // Use the same snapped-end padding as the battlements for posts/braces:
      // continuous roof/face reaches the socket, repeated timber details do not
      // collide visually with the receiving tower/gate.
      const bays=Math.max(2,Math.round(g.usable/.75));
      const start=g.startPad,end=g.L-g.endPad,span=Math.max(.01,end-start);
      ctx.save();
      ctx.strokeStyle='#3f2c20';
      ctx.lineWidth=Math.max(1,1.25*State.view.scale);
      for(let i=0;i<=bays;i++){
        const along=start+span*(i/bays);
        const base={x:s.a.x+g.ux*along,y:s.a.y+g.uy*along};
        const outer=point(base,outerOff);
        const a=w2s(outer,low),b=w2s(outer,high);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }

      for(let i=0;i<=bays;i+=2){
        const along=start+span*(i/bays);
        const base={x:s.a.x+g.ux*along,y:s.a.y+g.uy*along};
        const outer=point(base,outerOff),wall=point(base,innerOff);
        const a=w2s(outer,h-.02),b=w2s(wall,Math.max(.12,h-.58));
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
      ctx.restore();
    }
  });
}
function drawBuiltWindowRow(s,side,z,density,lit=false,nf=1){
  if(side!==linearFrontSide(s))return;
  const edge=linearFacadeEdge(s,side);
  const pa=w2s(edge.a,z),pb=w2s(edge.b,z),screenLength=Math.hypot(pb.x-pa.x,pb.y-pa.y);
  const count=Math.max(1,Math.round(edge.length*density));
  for(let i=0;i<count;i++){
    const t=(i+.5)/count;
    drawWindowOnEdge(edge,z,lit,nf,(t-.5)*screenLength);
  }
}
function drawBuiltWindows(s,lit=false,nf=1){
  const level=structureLevel(s),outside=wallExteriorSide(s),inside=-outside;
  const lowerZ=.84,upperZ=(1.75+2.80)/2;
  const arcade=builtSkin(s)==='arcade';

  withBuiltRoofOcclusionClip(s,()=>{
    // Interior/courtyard side: the arcade replaces ground-floor windows only.
    if(!arcade)drawBuiltWindowRow(s,inside,lowerZ,2,lit,nf);
    if(level>=2)drawBuiltWindowRow(s,inside,upperZ,2,lit,nf);

    // Exterior side stays completely unchanged by the arcade skin.
    if(level>=2)drawBuiltWindowRow(s,outside,upperZ,1,lit,nf);
  });
}
function drawFacadeWindows(lit=false,nf=1){
  for(const s of State.structures){
    if(underConstruction(s))continue;
    if(s.type==='house'){
      const rows=houseLevel(s)>=2?[.52,1.34]:[.48];
      for(const edge of visibleFacadeEdges(s))for(const z of rows)drawWindowOnEdge(edge,z,lit,nf,0);
    }else if(s.type==='built'){
      drawBuiltWindows(s,lit,nf);
    }else if(s.type==='gate'){
      drawGateWindows(s,lit,nf);
    }else if(s.type==='tower'){
      if(isWoodTower(s))continue;
      const rows=towerWindowRows(s);if(!rows.length)continue;
      if(s.shape==='round'){
        for(const row of rows)withStructureDetailOcclusion(s,row.z,()=>drawRoundTowerWindowRow(s,row,lit,nf));
      }else{
        const edges=visibleFacadeEdges(s);
        for(const row of rows){
          withStructureDetailOcclusion(s,row.z,()=>{
            for(const edge of edges){
              if(row.count===1)drawWindowOnEdge(edge,row.z,lit,nf,0);
              else{
                const a=w2s(edge.a,row.z),b=w2s(edge.b,row.z),L=Math.hypot(b.x-a.x,b.y-a.y);
                const spacing=Math.min(clamp(9*State.view.scale,5,12),L*.34);
                drawWindowOnEdge(edge,row.z,lit,nf,-spacing/2);
                drawWindowOnEdge(edge,row.z,lit,nf,spacing/2);
              }
            }
          });
        }
      }
    }
  }
}
function drawDayNightOverlay(){
  const nf=nightFactor();if(nf<=0)return;
  const r=wrap.getBoundingClientRect();
  ctx.save();ctx.fillStyle='rgba(6,10,18,'+(NIGHT_OVERLAY_MAX*nf).toFixed(3)+')';ctx.fillRect(0,0,r.width,r.height);ctx.restore();
}
function drawNightLights(){
  const nf=nightFactor();if(nf<=.01)return;
  drawFacadeWindows(true,nf);
  drawFireGlows(nf);
}
function drawConstructionProgress(s){
  const p=w2s(structureCenter(s),structureHeight(s)+.65),pr=constructionProgress(s),w=34,h=5;ctx.save();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(p.x-w/2,p.y-18,w,h);ctx.fillStyle='#e08a3c';ctx.fillRect(p.x-w/2,p.y-18,w*pr,h);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.strokeRect(p.x-w/2,p.y-18,w,h);ctx.restore();
}
function drawStructure(s,preview=false){
  ctx.save();if(preview)ctx.globalAlpha=.58;else if(underConstruction(s))ctx.globalAlpha=.42;
  if(isCivic(s))drawCivicStructure(s,preview);
  else if(['tower','gate','well'].includes(s.type))drawPointStructure(s,preview);
  else if(s.type==='palisade')drawPalisade(s,preview);
  else{drawLinearBase(s,preview);if(!underConstruction(s))drawBuiltDetails(s,preview)}
  ctx.restore();if(!preview&&underConstruction(s))drawConstructionProgress(s);
}
function drawBaseStaticScene(){
  const entry=prepareSceneCache('base');
  withRenderContext(entry.ctx,()=>{
    drawTerrain();drawGrid();drawEnvironment();drawBuildArea();

    // Completed terrain-level auto geometry is immutable between topology changes.
    State.structures
      .filter(s=>s.auto&&['field','road'].includes(s.type)&&!underConstruction(s))
      .forEach(drawAutoStructure);

    // Shadows are expensive; update them with the static layer at maintenance
    // ticks rather than recomputing every visual frame.
    drawDynamicShadows();

    const completedOthers=State.structures
      .filter(s=>!(s.auto&&['field','road'].includes(s.type))&&!isCastlePart(s)&&!underConstruction(s))
      .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of completedOthers){if(s.auto)drawAutoStructure(s);else drawStructure(s)}
  });
  entry.dirty=false;
}
function drawCastleBodyStaticScene(){
  const entry=prepareSceneCache('castleBody');
  withRenderContext(entry.ctx,()=>{
    const unionOk=drawCastleUnion();
    if(!unionOk){
      const fallback=State.structures.filter(s=>isCastlePart(s)&&!underConstruction(s)).slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
      for(const s of fallback)drawStructure(s);
      drawTowerDoors();
    }else{
      drawTowerDoors();
      drawCastleUnionDetails();
    }
    drawTowerRoofs();
    drawGateRoofs();
  });
  entry.dirty=false;
}
function drawCastleFrontStaticScene(){
  const entry=prepareSceneCache('castleFront');
  withRenderContext(entry.ctx,()=>drawCastleBattlements());
  entry.dirty=false;
}
function ensureStaticSceneCaches(){
  // Scale/rotation/viewport changes alter the projection and require a rebuild.
  // X/Y camera changes are pure screen translations and are handled cheaply
  // by blitSceneCache() until pan ends.
  for(const entry of Object.values(sceneCache)){
    if(!entry.dirty&&!sceneCacheProjectionCompatible(entry))entry.dirty=true;
  }
  if(sceneCache.base.dirty)drawBaseStaticScene();
  if(sceneCache.castleBody.dirty)drawCastleBodyStaticScene();
  if(sceneCache.castleFront.dirty)drawCastleFrontStaticScene();
}
function draw(){
  const r=wrap.getBoundingClientRect();
  ctx=screenCtx;
  screenCtx.clearRect(0,0,r.width,r.height);
  ensureStaticSceneCaches();
  blitSceneCache('base');

  // Only construction sites remain fully dynamic at ground/building depth.
  State.structures
    .filter(s=>s.auto&&['field','road'].includes(s.type)&&underConstruction(s))
    .forEach(drawAutoStructure);
  const dynamicSites=State.structures
    .filter(s=>!(s.auto&&['field','road'].includes(s.type))&&underConstruction(s))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of dynamicSites){if(s.auto)drawAutoStructure(s);else drawStructure(s)}

  // Population remains between settlement massing and completed castle massing,
  // preserving the existing occlusion behaviour.
  drawPeasants();
  drawTrainingSoldiers();
  blitSceneCache('castleBody');

  drawTowerFlags();
  drawCastleSelection();
  drawCastleSoldiers();

  // Unified fortification-front protocol: wall merlons, palisade stakes and
  // wooden tower parapets all live in the same cached post-patrol layer.
  blitSceneCache('castleFront');
  drawCastleFireFixtures();

  // Small facade/details stay dynamic for night lighting and selection semantics.
  drawFacadeWindows(false,1);
  drawGatePortals();
  for(const house of completedSettlement('house'))drawHouseDoor(house);
  drawChimneysAndSmoke();

  if(State.draft?.preview)drawStructure(State.draft.preview,true);
  if(State.draft?.mode==='orient'&&State.draft.center&&Number.isFinite(State.draft.angle)){
    const end={x:State.draft.center.x+Math.cos(State.draft.angle)*4,y:State.draft.center.y+Math.sin(State.draft.angle)*4};
    const a=w2s(State.draft.center),b=w2s(end);ctx.save();ctx.strokeStyle='rgba(244,183,111,.72)';ctx.lineWidth=1.2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  }
  drawDayNightOverlay();
  drawNightLights();
}
