'use strict';
// CONQUER settlement render module — classic-script shared runtime.
 // PNG architectural facade assets. Source art stays detailed; images are
 // downsampled and white-keyed once at load time so facade drawing remains cheap.
const ARCHITECTURE_ASSET_PATHS=Object.freeze({
  gatePortal:'./src/assets/architecture/gate_portal.png',
  towerDoor:'./src/assets/architecture/tower_door.png',
  arrowSlit:'./src/assets/architecture/arrow_slit.png',
  gothicL1:'./src/assets/architecture/gothic_l1.png',
  gothicL2:'./src/assets/architecture/gothic_l2.png',
  gothicL3:'./src/assets/architecture/gothic_l3.png',
  arcade2:'./src/assets/architecture/arcade_2.png',
  arcade3:'./src/assets/architecture/arcade_3.png'
});
const architectureSprites={};
function prepareArchitectureSprite(img){
  const maxDim=256,scale=Math.min(1,maxDim/Math.max(img.naturalWidth||1,img.naturalHeight||1));
  const w=Math.max(1,Math.round((img.naturalWidth||1)*scale)),h=Math.max(1,Math.round((img.naturalHeight||1)*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,w,h);
  const data=g.getImageData(0,0,w,h),p=data.data;
  for(let i=0;i<p.length;i+=4){
    const r=p[i],gg=p[i+1],b=p[i+2],mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);
    if(r>247&&gg>247&&b>247)p[i+3]=0;
    else if(r>238&&gg>238&&b>238&&mx-mn<8)p[i+3]=Math.min(p[i+3],Math.max(0,Math.min(255,(247-mx)*28)));
  }
  g.putImageData(data,0,0);return c;
}
async function loadArchitectureSprites(){
  const jobs=Object.entries(ARCHITECTURE_ASSET_PATHS).map(([key,path])=>new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{try{architectureSprites[key]=prepareArchitectureSprite(img)}catch(err){console.warn('Architecture PNG prep failed',path,err);architectureSprites[key]=img}resolve(true)};
    img.onerror=()=>{console.warn('Architecture PNG load failed',path);resolve(false)};
    img.src=path;
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
function drawFacadeAssetBackdrop(edge,centerZ,width,height,offsetWorld=0,fill='#211f1d'){
  const span=facadeAssetWorldSpan(edge,width,offsetWorld),z0=centerZ-height/2,z1=centerZ+height/2;
  pathPolygon([w2s(span.a,z0),w2s(span.b,z0),w2s(span.b,z1),w2s(span.a,z1)],fill,null);
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
function structureInteriorVector(s){
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
  const fp=footprintPoints(s);if(fp.length<2)return-1;
  const iv=structureInteriorVector(s),center=structureCenter(s);let best=-1,bestScore=-Infinity;
  for(let i=0;i<fp.length;i++){
    const a=fp[i],b=fp[(i+1)%fp.length],mx=(a.x+b.x)/2-center.x,my=(a.y+b.y)/2-center.y,L=Math.hypot(mx,my)||1;
    const score=mx/L*iv.x+my/L*iv.y;if(score>bestScore){bestScore=score;best=i}
  }
  return best;
}
function isInteriorFacadeEdge(s,edge){return Number.isFinite(edge?.index)&&edge.index===interiorFacadeEdgeIndex(s)}
function gothicAssetForLevel(s){return structureLevel(s)>=2?'gothicL2':'gothicL1'}
function gothicAssetSizeForLevel(s){const l=structureLevel(s);return l>=2?{w:.68,h:.78}:{w:.54,h:.70}}
function towerGothicAssetForRow(s,row){
  if(!row||row.floor<2)return null;
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
function roundTowerFacadeEdges(s){
  const iv=structureInteriorVector(s),base=Math.atan2(iv.y,iv.x),r=Math.max(.2,Number(s.r)||.5)+.006,span=Math.min(.54,r*.95);
  const centerDepth=viewDepthPoint({x:s.x,y:s.y}),out=[];
  for(let i=0;i<4;i++){const a=base+i*Math.PI/2,ox=Math.cos(a),oy=Math.sin(a),tx=-oy,ty=ox,c={x:s.x+ox*r,y:s.y+oy*r};if(viewDepthPoint(c)<centerDepth-.015)continue;out.push({a:{x:c.x-tx*span/2,y:c.y-ty*span/2},b:{x:c.x+tx*span/2,y:c.y+ty*span/2},index:i,interior:i===0})}
  return out;
}

function gateFacadeEdges(s){
  const fp=footprintPoints(s);if(fp.length<4)return[];
  const defs=[{a:fp[0],b:fp[1],role:'side',index:0},{a:fp[1],b:fp[2],role:'front',index:1},{a:fp[2],b:fp[3],role:'side',index:2},{a:fp[3],b:fp[0],role:'rear',index:3}];
  for(const e of defs){const a=w2s(e.a,0),b=w2s(e.b,0);e.depth=(a.y+b.y)/2}defs.sort((a,b)=>b.depth-a.depth);return defs.slice(0,2);
}
function drawGatePortalOnEdge(edge){
  if(drawArchitectureAssetOnEdge(edge,.705,.90,1.35,'gatePortal'))return;
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,cx=(edge.a.x+edge.b.x)/2,cy=(edge.a.y+edge.b.y)/2,half=.39;
  const l={x:cx-ux*half,y:cy-uy*half},r={x:cx+ux*half,y:cy+uy*half};pathPolygon([w2s(l,.03),w2s(r,.03),w2s(r,1.05),w2s({x:cx,y:cy},1.38),w2s(l,1.05)],'#241a16','#9a7458',1);
}
function drawGatePortals(){
  for(const s of State.structures){
    if(s.type!=='gate'||isWoodGate(s)||underConstruction(s))continue;
    withStructureGroundPlane(s,()=>withStructureDetailOcclusion(s,1.38,()=>{
      for(const edge of gateFacadeEdges(s)){
        if(edge.role==='front'||edge.role==='rear')drawGatePortalOnEdge(edge);
      }
    }));
  }
}
function gateWindowRows(s){const l=structureLevel(s),rows=[1.72];if(l>=2)rows.push(2.92);if(l>=3)rows.push(4.12);return rows.filter(z=>z<structureHeight(s)-.28)}
function drawGateWindows(s,lit=false,nf=1){
  const key=gothicAssetForLevel(s),sz=gothicAssetSizeForLevel(s);
  for(const z of gateWindowRows(s))withStructureDetailOcclusion(s,z,()=>{for(const edge of gateFacadeEdges(s)){if(isInteriorFacadeEdge(s,edge))drawArchitectureAssetOnEdge(edge,z,sz.w,sz.h,key,0,lit,nf);else drawArchitectureAssetOnEdge(edge,z,.24,.62,'arrowSlit')}})
}
function visibleFacadeEdges(s){
  const rings=s.type==='house'?houseFootprintParts(s).filter(p=>p.kind!=='turret').map(p=>p.points):[footprintPoints(s)],edges=[];
  for(const fp of rings){if(fp.length<4)continue;for(let i=0;i<fp.length;i++){const j=(i+1)%fp.length,a=w2s(fp[i],0),b=w2s(fp[j],0);edges.push({a:fp[i],b:fp[j],index:i,depth:(a.y+b.y)/2})}}
  edges.sort((a,b)=>b.depth-a.depth);return edges.slice(0,s.type==='house'&&houseLevel(s)>=3?4:2);
}
function cutawayOpenEdgeIndexes(s){
  if(!structureCutaway(s))return null;
  return cutawayTransparentFaceIndexes(s,cutawayWallGeometry(s));
}
function cutawayEdgeIsOpen(s,index){
  return !!cutawayOpenEdgeIndexes(s)?.has(index);
}
function cutawayFacadeOpacity(s){return structureCutaway(s)?.20:1}
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
  // Cutaway keeps doors as 20% ghosted architectural references instead of
  // removing them together with the opened shell.
  return viewDepthPoint(spec.contact)>=viewDepthPoint({x:tower.x,y:tower.y})-.015;
}
function towerDoorOccluders(tower,spec,apexZ){
  const ownerDepth=worldDepth(tower);
  return State.structures.filter(o=>{
    if(o.id===tower.id||underConstruction(o)||(!isCastlePart(o)&&!isRaisedPlacementCastlePoint(o)))return false;
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
  const tier=towerTier(tower),width=clamp(.38+tier*.045,.42,.54),fullHeight=Math.max(.18,spec.apexZ-spec.baseZ),height=fullHeight/3,centerZ=spec.baseZ+height/2,tx=spec.tangent.x,ty=spec.tangent.y,c=spec.contact,half=width/2;
  const edge={a:{x:c.x-tx*half,y:c.y-ty*half},b:{x:c.x+tx*half,y:c.y+ty*half}},apexZ=spec.baseZ+height,opacity=cutawayFacadeOpacity(tower);
  const drawDoor=()=>{
    if(drawArchitectureAssetOnEdge(edge,centerZ,width,height,'towerDoor',0,false,1,opacity))return;
    ctx.save();ctx.globalAlpha*=opacity;drawFacadeAssetBackdrop(edge,centerZ,width,height,0,'#211713');ctx.restore();
  };
  const occ=towerDoorOccluders(tower,spec,apexZ);if(!occ.length){drawDoor();return}
  const rr=wrap.getBoundingClientRect();ctx.save();ctx.beginPath();ctx.rect(-48,-48,rr.width+96,rr.height+96);
  for(const o of occ){const hull=structureScreenSilhouette(o);if(hull.length<3)continue;ctx.moveTo(hull[0].x,hull[0].y);for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);ctx.closePath()}
  ctx.clip('evenodd');drawDoor();ctx.restore();
}
function drawTowerDoors(){
  for(const tower of State.structures){
    if(tower.type!=='tower'||isWoodTower(tower)||underConstruction(tower))continue;
    withStructureGroundPlane(tower,()=>{
      for(const spec of towerDoorSpecs(tower))drawTowerDoorSpec(tower,spec);
    });
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
  const l=structureLevel(s),rows=[];
  // P1 is intentionally blind: no windows and no arrow slits.
  if(l>=2)rows.push({floor:2,z:2.48});
  if(l>=3)rows.push({floor:3,z:3.62});
  return rows.filter(r=>r.z<structureHeight(s)-.28);
}
function drawRoundTowerWindowRow(s,row,lit=false,nf=1){
  const key=towerGothicAssetForRow(s,row),sz=towerGothicAssetSizeForRow(s,row),opacity=cutawayFacadeOpacity(s);if(!key)return;
  for(const edge of roundTowerFacadeEdges(s)){
    if(edge.interior)drawArchitectureAssetOnEdge(edge,row.z,sz.w*.86,sz.h,key,0,lit,nf,opacity);
    else drawArchitectureAssetOnEdge(edge,row.z,.22,.60,'arrowSlit',0,false,1,opacity);
  }
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
  if(!s||s.type!=='built'||underConstruction(s)||builtSkin(s)!=='arcade')return;const inside=-wallExteriorSide(s);if(inside!==linearFrontSide(s))return;
  const edge=linearFacadeEdge(s,inside),count=Math.max(1,Math.round(edge.length/2.55)),cell=edge.length/count,h=Math.min(1.46,structureHeight(s)-.16),centerZ=.04+h/2,key=cell<2.25?'arcade2':'arcade3';
  withStructureDetailOcclusion(s,centerZ+h/2,()=>{for(let i=0;i<count;i++){const off=(i+.5)*cell-edge.length/2,w=cell*.96;drawFacadeAssetBackdrop(edge,centerZ,w,h*.86,off,'#24211f');drawArchitectureAssetOnEdge(edge,centerZ,w,h,key,off)}})
}
function drawWallHoarding(s,occlusionFrame=null){
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

  withTowerBattlementOcclusion(maskPiece,occlusionFrame||buildBattlementOcclusionFrame(),()=>{
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
function drawBuiltWindowRow(s,side,z,density,lit=false,nf=1,key='arrowSlit',assetWidth=.24,assetHeight=.60){
  if(side!==linearFrontSide(s))return;
  const edge=linearFacadeEdge(s,side),count=Math.max(1,Math.round(edge.length*density)),cell=edge.length/count,opacity=cutawayFacadeOpacity(s);
  for(let i=0;i<count;i++){const off=(i+.5)*cell-edge.length/2;drawArchitectureAssetOnEdge(edge,z,Math.min(assetWidth,cell*.82),assetHeight,key,off,lit,nf,opacity)}
}
function drawBuiltWindows(s,lit=false,nf=1){
  const l=structureLevel(s),outside=wallExteriorSide(s),inside=-outside,lowerZ=.86,upperZ=2.22;
  withBuiltRoofOcclusionClip(s,()=>{if(l>=2)drawBuiltWindowRow(s,inside,upperZ,.42,lit,nf,'gothicL3',.92,.78);drawBuiltWindowRow(s,outside,lowerZ,.72,false,nf,'arrowSlit',.23,.58);if(l>=2)drawBuiltWindowRow(s,outside,upperZ,.72,false,nf,'arrowSlit',.23,.58)})
}
function drawHouseFacadeWindows(s,lit=false,nf=1){
  const rows=houseLevel(s)>=2?[.52,1.34]:[.48];
  for(const edge of visibleFacadeEdges(s))for(const z of rows)drawWindowOnEdge(edge,z,lit,nf,0);
}
function drawStaticHouseFacadeDetails(){
  for(const house of completedSettlement('house')){
    drawHouseFacadeWindows(house,false,1);
    drawHouseDoor(house);
  }
}
function drawFacadeWindows(lit=false,nf=1,includeHouses=true){
  if(State.view.scale<.24)return;
  for(const s of State.structures){if(underConstruction(s))continue;const center=structureCenter(s);if(center&&!worldPointVisible(center,structureVisualTopHeight(s),110))continue;
    if(s.type==='house'){if(includeHouses)drawHouseFacadeWindows(s,lit,nf)}
    else if(s.type==='built')drawBuiltWindows(s,lit,nf);
    else if(s.type==='gate'){if(!isWoodGate(s))withStructureGroundPlane(s,()=>drawGateWindows(s,lit,nf))}
    else if(s.type==='tower'&&!isWoodTower(s)){withStructureGroundPlane(s,()=>{const rows=towerWindowRows(s);if(!rows.length)return;if(s.shape==='round'){for(const row of rows)withStructureDetailOcclusion(s,row.z,()=>drawRoundTowerWindowRow(s,row,lit,nf))}else{const edges=visibleFacadeEdges(s),opacity=cutawayFacadeOpacity(s);for(const row of rows){const key=towerGothicAssetForRow(s,row),sz=towerGothicAssetSizeForRow(s,row);if(!key)continue;withStructureDetailOcclusion(s,row.z,()=>{for(const edge of edges){if(isInteriorFacadeEdge(s,edge))drawArchitectureAssetOnEdge(edge,row.z,sz.w,sz.h,key,0,lit,nf,opacity);else drawArchitectureAssetOnEdge(edge,row.z,.22,.60,'arrowSlit',0,false,1,opacity)}})}}})}
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
const WEATHER_PROFILES=Object.freeze({
  spring:[['clear',.16],['wind',.20],['rain',.35],['storm',.12],['fog',.17]],
  summer:[['clear',.42],['wind',.22],['rain',.14],['storm',.12],['fog',.10]],
  autumn:[['clear',.10],['wind',.30],['rain',.32],['storm',.12],['fog',.16]],
  winter:[['clear',.10],['wind',.22],['snow',.50],['storm',.05],['fog',.13]]
});
const WEATHER_STYLE=Object.freeze({
  sun:{wind:0,rain:0,snow:0,lightning:0,clouds:0,fog:0},
  clear:{wind:.10,rain:0,snow:0,lightning:0,clouds:.10,fog:0},
  wind:{wind:.90,rain:0,snow:0,lightning:0,clouds:.38,fog:0},
  rain:{wind:.38,rain:1,snow:0,lightning:0,clouds:.82,fog:0},
  storm:{wind:1,rain:1.18,snow:0,lightning:1,clouds:1,fog:0},
  snow:{wind:.30,rain:0,snow:1,lightning:0,clouds:.76,fog:0},
  fog:{wind:.08,rain:0,snow:0,lightning:0,clouds:.18,fog:1}
});
let weatherCacheKey='',weatherCacheValue=null;
function weatherHash01(value){
  let x=((value>>>0)+0x6D2B79F5)>>>0;
  x=Math.imul(x^(x>>>15),x|1);
  x^=x+Math.imul(x^(x>>>7),x|61);
  return((x^(x>>>14))>>>0)/4294967296;
}
function currentWeather(){
  const day=Math.floor(State.clock.day);
  const season=WEATHER_PROFILES[State.season]?State.season:'summer';
  const forced=WEATHER_STYLE[State.weatherOverride]?State.weatherOverride:null;
  const key=State.seed+'|'+day+'|'+season+'|'+(forced||'procedural');
  if(weatherCacheKey===key&&weatherCacheValue)return weatherCacheValue;
  const salts={spring:0x13579bdf,summer:0x2468ace0,autumn:0x51f15e5d,winter:0x7f4a7c15};
  const seed=(State.seed^Math.imul(day+1,0x9e3779b1)^salts[season])>>>0;
  let kind=forced||'clear';
  if(!forced){
    let roll=weatherHash01(seed);
    for(const [candidate,weight] of WEATHER_PROFILES[season]){
      roll-=weight;
      if(roll<=0){kind=candidate;break}
    }
  }
  weatherCacheKey=key;
  weatherCacheValue={kind,seed,...WEATHER_STYLE[kind]};
  return weatherCacheValue;
}
function weatherNoise(seed,index){return weatherHash01(seed^Math.imul(index+1,0x85ebca6b))}
let cloudLayerKey='';
function clearWeatherCloudLayer(){
  if(!weatherCloudLayer)return;
  weatherCloudLayer.replaceChildren();
  weatherCloudLayer.style.opacity='0';
  cloudLayerKey='';
}
function clearWeatherOverlay(){
  if(weatherCtx&&weatherCanvas){
    const r=wrap.getBoundingClientRect();
    weatherCtx.clearRect(0,0,r.width,r.height);
  }
  clearWeatherCloudLayer();
}
function buildCloudLayer(weather,w,h){
  if(!weatherCloudLayer)return;
  weatherCloudLayer.replaceChildren();
  const ns='http://www.w3.org/2000/svg';
  const count=Math.round(2+10*weather.clouds);
  const stormy=weather.kind==='storm'||weather.kind==='rain';
  for(let i=0;i<count;i++){
    const group=document.createElementNS(ns,'g');
    const a=weatherNoise(weather.seed,1500+i*5),b=weatherNoise(weather.seed,1501+i*5),c=weatherNoise(weather.seed,1502+i*5),d=weatherNoise(weather.seed,1503+i*5),e=weatherNoise(weather.seed,1504+i*5);
    const scale=.58+c*.92;
    const opacity=(.10+.18*weather.clouds)*(.75+d*.5);
    const fill=stormy?'#aeb8bd':'#e1e5df';
    group.dataset.baseX=String(a*(w+240)-120);
    group.dataset.baseY=String(18+b*Math.max(40,h*.38));
    group.dataset.speed=String(6+20*d+weather.wind*18);
    group.dataset.scale=String(scale);
    group.setAttribute('opacity',opacity.toFixed(3));
    const ellipses=[[-30,4,32,15],[-5,-4,38,21],[27,4,31,16],[0,8,56,17]];
    for(const [cx,cy,rx,ry] of ellipses){
      const node=document.createElementNS(ns,'ellipse');
      node.setAttribute('cx',String(cx+(e-.5)*5));
      node.setAttribute('cy',String(cy));
      node.setAttribute('rx',String(rx));
      node.setAttribute('ry',String(ry));
      node.setAttribute('fill',fill);
      group.appendChild(node);
    }
    weatherCloudLayer.appendChild(group);
  }
  cloudLayerKey=weather.seed+'|'+weather.kind+'|'+Math.round(w)+'x'+Math.round(h);
}
function drawCloudLayer(weather,w,h,t){
  if(!weatherCloudLayer)return;
  const key=weather.seed+'|'+weather.kind+'|'+Math.round(w)+'x'+Math.round(h);
  if(cloudLayerKey!==key)buildCloudLayer(weather,w,h);
  for(const group of weatherCloudLayer.children){
    const baseX=Number(group.dataset.baseX)||0,baseY=Number(group.dataset.baseY)||0,speed=Number(group.dataset.speed)||8,scale=Number(group.dataset.scale)||1;
    const x=((baseX+t*speed+w+260)%(w+260))-130;
    group.setAttribute('transform','translate('+x.toFixed(1)+' '+baseY.toFixed(1)+') scale('+scale.toFixed(3)+')');
  }
}
function drawWindLayer(g,w,h,t,weather){
  if(weather.wind<=.15)return;
  const count=Math.round(24+32*weather.wind);
  g.save();g.lineCap='round';g.lineWidth=1.05;g.strokeStyle='rgba(232,235,231,.30)';
  for(let i=0;i<count;i++){
    const a=weatherNoise(weather.seed,i*3),b=weatherNoise(weather.seed,i*3+1),c=weatherNoise(weather.seed,i*3+2);
    const speed=70+120*c;
    const x=((a*(w+220)+t*speed)%(w+220))-110;
    const y=18+b*Math.max(1,h-36);
    const len=26+72*c;
    g.globalAlpha=.18+.38*c;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+len,y);g.stroke();
  }
  g.restore();
}
function drawRainLayer(g,w,h,t,weather){
  if(!weather.rain)return;
  const count=Math.round(144*weather.rain);
  g.save();g.lineWidth=1;g.strokeStyle='rgba(190,218,232,.52)';g.beginPath();
  for(let i=0;i<count;i++){
    const a=weatherNoise(weather.seed,400+i*3),b=weatherNoise(weather.seed,401+i*3),c=weatherNoise(weather.seed,402+i*3);
    const speed=260+210*c;
    const y=((b*(h+120)+t*speed)%(h+120))-60;
    const x=((a*(w+120)+t*speed*.20)%(w+120))-60;
    const len=11+18*c;
    g.moveTo(x,y);g.lineTo(x+len*.342,y+len*.94);
  }
  g.stroke();g.restore();
}
function drawSnowLayer(g,w,h,t,weather){
  if(!weather.snow)return;
  const count=156;
  g.save();g.fillStyle='rgba(245,248,244,.78)';
  for(let i=0;i<count;i++){
    const a=weatherNoise(weather.seed,800+i*4),b=weatherNoise(weather.seed,801+i*4),c=weatherNoise(weather.seed,802+i*4),d=weatherNoise(weather.seed,803+i*4);
    const speed=22+38*c;
    const y=((b*(h+50)+t*speed)%(h+50))-25;
    const drift=Math.sin(t*(.45+.5*d)+i)*18*(.45+c);
    const x=(a*w+drift+w)%w;
    const r=1.5+1.0*d;
    g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
  }
  g.restore();
}
function drawFogLayer(g,w,h,t,weather){
  if(!weather.fog)return;
  g.save();
  g.globalCompositeOperation='screen';
  const night=clamp(nightFactor(),0,1);
  const baseAlpha=.055+.045*(1-night);
  for(let i=0;i<8;i++){
    const a=weatherNoise(weather.seed,1700+i*4),b=weatherNoise(weather.seed,1701+i*4),c=weatherNoise(weather.seed,1702+i*4),d=weatherNoise(weather.seed,1703+i*4);
    const speed=6+10*c;
    const x=((a*(w+520)+t*speed)%(w+520))-260;
    const y=h*(.12+.76*b);
    const rx=160+220*c,ry=26+42*d;
    g.fillStyle='rgba(220,226,222,'+(baseAlpha*(.72+d*.55)).toFixed(3)+')';
    g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();
  }
  g.fillStyle='rgba(202,210,207,'+(.055+.035*(1-night))+')';
  g.fillRect(0,0,w,h);
  g.restore();
}
function drawBirdLayer(g,w,h,t,weather){
  if(weather.fog||weather.rain||weather.snow||weather.lightning)return;
  const seasonFactor={spring:1,summer:.82,autumn:.52,winter:.16}[State.season]||.5;
  const period=18+weatherNoise(weather.seed,1800)*18;
  const cycle=Math.floor(t/period),phase=t-cycle*period;
  if(phase>6.5||weatherNoise(weather.seed,1810+cycle)>.58*seasonFactor)return;
  const count=3+Math.floor(weatherNoise(weather.seed,1820+cycle)*4);
  const dir=weatherNoise(weather.seed,1830+cycle)<.5?1:-1;
  const baseY=h*(.14+.22*weatherNoise(weather.seed,1840+cycle));
  const speed=(w+180)/6.5;
  const lead=dir>0?-90+phase*speed:w+90-phase*speed;
  g.save();g.strokeStyle='rgba(34,39,37,.68)';g.lineWidth=1.35;g.lineCap='round';
  for(let i=0;i<count;i++){
    const row=i===0?0:Math.ceil(i/2),side=i===0?0:(i%2?1:-1);
    const x=lead-dir*row*23;
    const y=baseY+row*9+side*5;
    const flap=Math.sin(t*7+i*1.7)*2.2;
    g.beginPath();g.moveTo(x-6,y+flap);g.lineTo(x,y-2);g.lineTo(x+6,y-flap);g.stroke();
  }
  g.restore();
}
function drawLeafLayer(g,w,h,t,weather){
  if(State.season!=='autumn'||weather.snow||weather.fog)return;
  const intensity=weather.kind==='storm'?1.7:weather.kind==='wind'?1.35:weather.kind==='rain'?.9:.55;
  const count=Math.round(18*intensity);
  g.save();
  for(let i=0;i<count;i++){
    const a=weatherNoise(weather.seed,1900+i*5),b=weatherNoise(weather.seed,1901+i*5),c=weatherNoise(weather.seed,1902+i*5),d=weatherNoise(weather.seed,1903+i*5),e=weatherNoise(weather.seed,1904+i*5);
    const speed=34+58*c;
    const y=((b*(h+60)+t*speed)%(h+60))-30;
    const drift=Math.sin(t*(.7+d)+i)*24+(weather.wind||0)*t*10;
    const x=(a*w+drift+w)%w;
    const size=2.2+2.4*e;
    g.save();g.translate(x,y);g.rotate(t*(1.5+d*2)+i);
    g.fillStyle=e>.66?'rgba(155,87,38,.74)':e>.33?'rgba(189,120,47,.72)':'rgba(111,78,39,.72)';
    g.beginPath();g.ellipse(0,0,size,size*.48,.45,0,Math.PI*2);g.fill();g.restore();
  }
  g.restore();
}
let puddleCacheKey='',puddleCache=[];
function puddlePoints(weather){
  const key=State.seed+'|'+weather.seed;
  if(puddleCacheKey===key)return puddleCache;
  const out=[];
  for(let i=0;i<64&&out.length<34;i++){
    const x=8+weatherNoise(weather.seed,2100+i*3)*(WORLD-16),y=8+weatherNoise(weather.seed,2101+i*3)*(WORLD-16);
    const p={x,y};
    if(environmentBlocksPoint(p,'road')||terrainSlopeKind(p)==='steep')continue;
    const blocked=State.structures.some(s=>{const c=structureCenter(s),r=s.type==='road'||s.type==='field'?0:2.2;return r>0&&Math.hypot(c.x-x,c.y-y)<r});
    if(blocked)continue;
    out.push({x,y,rx:.22+.35*weatherNoise(weather.seed,2200+i*2),ry:.10+.16*weatherNoise(weather.seed,2201+i*2),rot:weatherNoise(weather.seed,2250+i)*Math.PI});
  }
  puddleCacheKey=key;puddleCache=out;return out;
}
function drawPuddleLayer(){
  const weather=currentWeather();
  if(State.view.scale<=.80||!weather.rain)return;
  ctx.save();
  for(const p of puddlePoints(weather)){
    const z=terrainElevation(p)+.012,c=w2s(p,z);
    const rx=p.rx*U*State.view.scale,ry=p.ry*U*State.view.scale*.52;
    ctx.fillStyle='rgba(77,111,126,.34)';
    ctx.strokeStyle='rgba(178,205,212,.28)';
    ctx.lineWidth=.7;
    ctx.beginPath();ctx.ellipse(c.x,c.y,rx,ry,p.rot*.18,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='rgba(225,235,233,.24)';
    ctx.beginPath();ctx.arc(c.x-rx*.18,c.y-ry*.12,Math.max(1,rx*.28),Math.PI*1.05,Math.PI*1.75);ctx.stroke();
  }
  ctx.restore();
}
function drawLightningLayer(g,w,h,t,weather){
  if(!weather.lightning)return;
  const period=4.5+weatherNoise(weather.seed,1201)*4.5;
  const phase=(t+weatherNoise(weather.seed,1202)*period)%period;
  let flash=0;
  if(phase<.12)flash=1;
  else if(phase>=.18&&phase<.30)flash=.72;
  else if(phase>=.36&&phase<.46)flash=.48;
  if(!flash)return;

  g.save();
  const night=clamp(nightFactor(),0,1);
  const skyFlash=(.12+night*.55)*flash;
  g.globalCompositeOperation='screen';
  g.fillStyle='rgba(225,242,255,'+skyFlash.toFixed(3)+')';
  g.fillRect(0,0,w,h);
  g.globalCompositeOperation='source-over';

  const startX=w*(.18+.64*weatherNoise(weather.seed,1203));
  const endY=h*(.48+.32*weatherNoise(weather.seed,1204));
  g.strokeStyle='rgba(220,246,255,'+(.98*flash)+')';
  g.shadowColor='rgba(190,235,255,1)';
  g.shadowBlur=24;
  g.lineWidth=2.2;

  const trunk=[{x:startX,y:-10}];
  let x=startX,y=-10;
  for(let i=0;i<9;i++){
    y+=(endY+10)/9;
    x+=(weatherNoise(weather.seed,1210+i)-.5)*50;
    trunk.push({x,y});
  }

  g.beginPath();g.moveTo(trunk[0].x,trunk[0].y);
  for(let i=1;i<trunk.length;i++)g.lineTo(trunk[i].x,trunk[i].y);
  g.stroke();

  g.lineWidth=1.25;
  for(let i=2;i<trunk.length-1;i+=2){
    const p=trunk[i],dir=weatherNoise(weather.seed,1240+i)<.5?-1:1;
    const length=28+weatherNoise(weather.seed,1250+i)*42;
    const mid={x:p.x+dir*length*.54,y:p.y+length*.24};
    const end={x:p.x+dir*length,y:p.y+length*.58};
    g.beginPath();g.moveTo(p.x,p.y);g.lineTo(mid.x,mid.y);g.lineTo(end.x,end.y);g.stroke();

    if(weatherNoise(weather.seed,1270+i)>.48){
      const sub={x:mid.x-dir*length*.34,y:mid.y+length*.30};
      g.beginPath();g.moveTo(mid.x,mid.y);g.lineTo(sub.x,sub.y);g.stroke();
    }
  }
  g.restore();
}
function drawWeatherOverlay(now=performance.now()){
  if(!weatherCtx||!weatherCanvas)return;
  const r=wrap.getBoundingClientRect(),w=r.width,h=r.height;
  weatherCtx.clearRect(0,0,w,h);
  const weather=currentWeather(),t=now/1000;

  if(State.view.scale<WEATHER_ZOOM_THRESHOLD){
    const cloudFade=clamp((WEATHER_ZOOM_THRESHOLD-State.view.scale)/.10,0,1);
    drawCloudLayer(weather,w,h,t);
    if(weatherCloudLayer)weatherCloudLayer.style.opacity=String(.30+.70*cloudFade);
  }else{
    clearWeatherCloudLayer();
  }

  weatherCtx.save();
  weatherCtx.globalAlpha=1;
  drawFogLayer(weatherCtx,w,h,t,weather);
  drawWindLayer(weatherCtx,w,h,t,weather);
  drawRainLayer(weatherCtx,w,h,t,weather);
  drawSnowLayer(weatherCtx,w,h,t,weather);
  drawLeafLayer(weatherCtx,w,h,t,weather);
  drawBirdLayer(weatherCtx,w,h,t,weather);
  drawLightningLayer(weatherCtx,w,h,t,weather);
  weatherCtx.restore();
}

function drawConstructionProgress(s){
  const p=w2s(structureCenter(s),structureHeight(s)+.65),pr=constructionProgress(s),w=34,h=5;ctx.save();ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(p.x-w/2,p.y-18,w,h);ctx.fillStyle='#e08a3c';ctx.fillRect(p.x-w/2,p.y-18,w*pr,h);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.strokeRect(p.x-w/2,p.y-18,w,h);ctx.restore();
}
function drawStructure(s,preview=false){
  if(s?.type==='road'){drawAutoStructure(s,preview);return}
  const render=()=>{
    ctx.save();if(preview)ctx.globalAlpha=.58;else if(underConstruction(s))ctx.globalAlpha=.42;
    if(isPlacementFoundationBuilding(s))drawPlacementFoundation(s,preview);
    if(isCivic(s))drawCivicStructure(s,preview);
    else if(['tower','gate','well'].includes(s.type))drawPointStructure(s,preview);
    else if(s.type==='palisade')drawPalisade(s,preview);
    else{drawLinearBase(s,preview);if(!underConstruction(s))drawBuiltDetails(s,preview)}
    ctx.restore();
  };
  if(isPlacementFoundationBuilding(s))withStructureGroundPlane(s,render);else render();
  if(!preview&&underConstruction(s)){
    if(isPlacementFoundationBuilding(s))withStructureGroundPlane(s,()=>drawConstructionProgress(s));
    else drawConstructionProgress(s);
  }
}
function drawLandscapeStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('landscape');
  withRenderContext(entry.ctx,()=>{
    drawTerrain();
    drawGrid();
    drawEnvironment();
    drawBuildArea();
  });
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheLandscapeRebuilds=(perf.cacheLandscapeRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_LANDSCAPE',performance.now()-analyticsT0);
}
function drawGroundStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('ground');
  withRenderContext(entry.ctx,()=>{
    // Ground network changes frequently during growth/completion but must never
    // force terrain/environment rasterization.
    State.structures
      .filter(s=>(s.type==='road'||(s.auto&&s.type==='field'))&&!underConstruction(s))
      .forEach(drawAutoStructure);

    // Weather-ground detail is isolated here. Wet/dry transitions invalidate
    // only this cheap layer instead of terrain + every building.
    drawPuddleLayer();
  });
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheGroundRebuilds=(perf.cacheGroundRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_GROUND',performance.now()-analyticsT0);
}
function drawShadowStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('shadow');
  withRenderContext(entry.ctx,()=>drawDynamicShadows());
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheShadowRebuilds=(perf.cacheShadowRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_SHADOW',performance.now()-analyticsT0);
}
function drawBaseStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('base');
  withRenderContext(entry.ctx,()=>{
    const completedOthers=State.structures
      .filter(s=>!(s.type==='road'||(s.auto&&s.type==='field'))&&!isCastlePart(s)&&!isRaisedPlacementCastlePoint(s)&&!underConstruction(s))
      .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of completedOthers){if(s.auto)drawAutoStructure(s);else drawStructure(s)}
    drawStaticHouseFacadeDetails();
  });
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheBaseRebuilds=(perf.cacheBaseRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_BASE',performance.now()-analyticsT0,{structures:State.structures.length});
}
let castleBodyBitmapEnabled=localStorage.getItem('conquer.castleBodyBitmap.v1')!=='0';
function renderCastleBodyContent(){
  const unionOk=drawCastleUnion();
  if(!unionOk){
    const fallback=State.structures.filter(s=>isCastlePart(s)&&!underConstruction(s)&&!structureCutaway(s)).slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of fallback)drawStructure(s);
  }else{
    drawCastleUnionDetails();
  }

  // Point fortifications on slopes are intentionally kept out of the wall
  // boolean union: draw them as rigid volumes on their own level-0 plane.
  const raised=State.structures
    .filter(s=>isRaisedPlacementCastlePoint(s)&&!underConstruction(s)&&!structureCutaway(s))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of raised)drawStructure(s);

  // Machicolation floors are part of the castle body, below tower units.
  drawMachicolationFloors();
  drawCutawayStructures();
  drawTowerDoors();
  drawTowerRoofs();
  drawGateRoofs();
}
function castleBodyRenderableStructures(){
  return State.structures.filter(s=>(isCastlePart(s)||isRaisedPlacementCastlePoint(s))&&!underConstruction(s));
}
function castleBodyCompositeBounds(){
  const parts=castleBodyRenderableStructures();if(!parts.length)return null;
  const cloud=[];
  for(const s of parts){
    const hull=structureScreenSilhouette(s);
    if(hull?.length)cloud.push(...hull);
  }
  if(!cloud.length)return null;
  const pad=Math.max(56,72*State.view.scale);
  return{
    minX:Math.min(...cloud.map(p=>p.x))-pad,
    minY:Math.min(...cloud.map(p=>p.y))-pad,
    maxX:Math.max(...cloud.map(p=>p.x))+pad,
    maxY:Math.max(...cloud.map(p=>p.y))+pad
  };
}
function castleBodyVisualSignature(){
  const num=v=>Number.isFinite(Number(v))?+Number(v).toFixed(4):null;
  const point=p=>p?[num(p.x),num(p.y)]:null;
  const items=castleBodyRenderableStructures().map(s=>[
    s.id||'',s.type||'',s.shape||'',s.material||'',s.woodStyle||'',s.woodRoof||'',
    s.roofStyle||'',s.baseStyle||'',s.skin||'',num(s.x),num(s.y),num(s.r),num(s.size),
    point(s.a),point(s.b),num(s.width),num(s.length),num(s.angle),s.rotationStep??null,
    s.level??null,s.tier??null,!!s.flip,!!s.cutaway,JSON.stringify(s.functions||[]),s.aSnap||null,s.bSnap||null,s.parentTowerId||null,
    num(s.orientationOffset),num(s.groundZ),num(s.foundationMinZ)
  ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify([
    1,State.season||'summer',num(State.view.scale),State.view.rotation||0,staticCacheDpr(),
    !!window.__polygonClipping,items
  ]);
}
function drawCastleBodyBitmap(){
  const api=window.__conquerAssetCompiler,bounds=castleBodyCompositeBounds();
  if(!castleBodyBitmapEnabled||!api?.renderComposite||!bounds){renderCastleBodyContent();return{mode:'direct',hit:false}}
  const key='castleBody|'+castleBodyVisualSignature();
  const result=api.renderComposite('castleBody',key,bounds,renderCastleBodyContent);
  if(!result?.ok){renderCastleBodyContent();return{mode:'fallback',hit:false,reason:result?.reason||'cache-failed'}}
  return{mode:result.hit?'hit':'miss',hit:!!result.hit,ms:result.ms||0,bytes:result.bytes||0};
}
function updateCastleCacheControls(){
  const btn=document.getElementById('castleCacheToggle');
  if(btn){btn.textContent='Castle cache '+(castleBodyBitmapEnabled?'ON':'OFF');btn.classList.toggle('active',castleBodyBitmapEnabled)}
  window.__conquerAssetCompiler?.stats?.();
}
function setCastleBodyBitmapEnabled(enabled){
  castleBodyBitmapEnabled=!!enabled;
  localStorage.setItem('conquer.castleBodyBitmap.v1',castleBodyBitmapEnabled?'1':'0');
  window.__conquerAssetCompiler?.clearComposite?.();
  invalidateSceneCache('castleBody');updateCastleCacheControls();draw();
}
function makeCastleBenchmarkCanvas(){
  const r=wrap.getBoundingClientRect(),d=staticCacheDpr(),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));
  const g=canvas.getContext('2d');g.setTransform(d,0,0,d,0,0);
  return{canvas,g,d,r};
}
function castleBenchmarkPixelDiff(a,b){
  try{
    const da=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
    const db=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
    let checked=0,different=0,sum=0,max=0;
    for(let i=0;i<da.length;i+=16){
      const d=Math.max(Math.abs(da[i]-db[i]),Math.abs(da[i+1]-db[i+1]),Math.abs(da[i+2]-db[i+2]),Math.abs(da[i+3]-db[i+3]));
      checked++;sum+=d;if(d>8)different++;if(d>max)max=d;
    }
    return{ratio:checked?different/checked:0,mean:checked?sum/checked:0,max};
  }catch{return null}
}
function benchmarkCastleBodyCache(iterations=3){
  const api=window.__conquerAssetCompiler;if(!api?.renderComposite)return null;
  const loops=Math.max(1,Math.min(6,Math.round(iterations)||3)),directTimes=[],hitTimes=[];
  const direct=makeCastleBenchmarkCanvas();
  for(let i=0;i<loops;i++){
    direct.g.clearRect(0,0,direct.r.width,direct.r.height);
    const t0=performance.now();withRenderContext(direct.g,renderCastleBodyContent);directTimes.push(performance.now()-t0);
  }
  api.clearComposite();
  const cached=makeCastleBenchmarkCanvas(),bounds=castleBodyCompositeBounds(),key='castleBody|'+castleBodyVisualSignature();
  const coldT0=performance.now();
  let cold;
  withRenderContext(cached.g,()=>{cold=api.renderComposite('castleBody',key,bounds,renderCastleBodyContent)});
  const coldMs=performance.now()-coldT0;
  for(let i=0;i<loops;i++){
    cached.g.clearRect(0,0,cached.r.width,cached.r.height);
    const t0=performance.now();withRenderContext(cached.g,()=>api.renderComposite('castleBody',key,bounds,renderCastleBodyContent));hitTimes.push(performance.now()-t0);
  }
  const avg=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length),diff=castleBenchmarkPixelDiff(direct.canvas,cached.canvas);
  const result={
    iterations:loops,directMs:+avg(directTimes).toFixed(2),coldMs:+coldMs.toFixed(2),hitMs:+avg(hitTimes).toFixed(2),
    speedup:+(avg(directTimes)/Math.max(.01,avg(hitTimes))).toFixed(2),
    pixelDiffRatio:diff?+diff.ratio.toFixed(6):null,pixelDiffMean:diff?+diff.mean.toFixed(3):null,pixelDiffMax:diff?.max??null
  };
  window.__conquerAnalytics?.event('CASTLE_BODY_AB',result,diff&&diff.ratio>.002?'warn':'info');
  const el=document.getElementById('castleCacheReadout');
  if(el)el.textContent='A/B direct '+result.directMs+' ms · hit '+result.hitMs+' ms · ×'+result.speedup+' · diff '+(result.pixelDiffRatio==null?'—':(result.pixelDiffRatio*100).toFixed(2)+'%');
  return result;
}
function drawCastleBodyStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('castleBody');
  let cacheResult={mode:'direct',hit:false};
  withRenderContext(entry.ctx,()=>{cacheResult=drawCastleBodyBitmap()});
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.cacheCastleBodyRebuilds=(perf.cacheCastleBodyRebuilds||0)+1;
  perf.lastCastleBodyCacheMode=cacheResult.mode;
  perf.lastCastleBodyRebuildMs=performance.now()-analyticsT0;
  window.__conquerAnalytics?.measure('CACHE_CASTLE_BODY',perf.lastCastleBodyRebuildMs,{bitmap:cacheResult.mode});
}
function drawCastleFrontStaticScene(){
  const analyticsT0=performance.now();
  const entry=prepareSceneCache('castleFront');
  withRenderContext(entry.ctx,()=>drawCastleBattlements());
  entry.dirty=false;
  const perf=window.__conquerPerf||(window.__conquerPerf={});perf.cacheCastleFrontRebuilds=(perf.cacheCastleFrontRebuilds||0)+1;
  window.__conquerAnalytics?.measure('CACHE_CASTLE_FRONT',performance.now()-analyticsT0);
}
window.__conquerCastleBodyCache={
  enabled:()=>castleBodyBitmapEnabled,
  setEnabled:setCastleBodyBitmapEnabled,
  benchmark:benchmarkCastleBodyCache,
  signature:castleBodyVisualSignature
};
document.getElementById('castleCacheToggle')?.addEventListener('click',()=>setCastleBodyBitmapEnabled(!castleBodyBitmapEnabled));
document.getElementById('castleCacheBenchmark')?.addEventListener('click',()=>benchmarkCastleBodyCache(3));
updateCastleCacheControls();

function ensureStaticSceneCaches(){
  const builders=[
    ['landscape',drawLandscapeStaticScene],
    ['ground',drawGroundStaticScene],
    ['shadow',drawShadowStaticScene],
    ['base',drawBaseStaticScene],
    ['castleBody',drawCastleBodyStaticScene],
    ['castleFront',drawCastleFrontStaticScene]
  ];

  // A projection mismatch cannot safely reuse the old raster. Content-only
  // invalidations can: keep showing the previous bitmap for one or two frames
  // while expensive layers rebuild individually.
  let projectionMismatch=false,coldStart=false;
  for(const [name] of builders){
    const entry=sceneCache[name];
    if(!entry.view)coldStart=true;
    if(!sceneCacheZoomPreview&&!sceneCachePanPreview&&entry.view&&!sceneCacheProjectionCompatible(entry)){
      entry.dirty=true;
      projectionMismatch=true;
    }
  }

  const stagePriority=new Map([
    ['ground',0],['base',1],['castleBody',2],['castleFront',3],['shadow',4],['landscape',5]
  ]);
  const dirty=builders
    .filter(([name])=>sceneCache[name].dirty)
    .sort((a,b)=>(stagePriority.get(a[0])??99)-(stagePriority.get(b[0])??99));
  if(!dirty.length)return;

  // Initial load, pause/edit mode and camera projection changes favor immediate
  // correctness. During running simulation, topology-only rebuilds are staged
  // one cache per visual frame to prevent 100–200ms combined long tasks.
  if(coldStart||projectionMismatch||State.clock.speed<=0){
    for(const [,build] of dirty)build();
    return;
  }

  const [name,build]=dirty[0];
  const t0=performance.now();
  build();
  const ms=performance.now()-t0;
  window.__conquerAnalytics?.measure('CACHE_STAGE',ms,{layer:name,remaining:dirty.length-1});
}
function draw(){
  const r=wrap.getBoundingClientRect();
  const phaseStart=performance.now(),phaseStats={};
  let phaseAt=phaseStart;
  function markPhase(name){
    const now=performance.now(),ms=now-phaseAt;
    phaseStats[name]=ms;phaseAt=now;
    if(ms>20)window.__conquerAnalytics?.event('RENDER_PHASE_SLOW',{
      phase:name,ms:+ms.toFixed(1),structures:State.structures.length
    },'warn',5000);
  }
  beginPopulationFrame(r);
  ctx=screenCtx;
  screenCtx.clearRect(0,0,r.width,r.height);
  ensureStaticSceneCaches();
  const gpuStatic=window.ConquerWebGPU?.renderStaticLayers?.(r)===true;
  if(!gpuStatic){
    blitSceneCache('landscape');
    blitSceneCache('ground');
    blitSceneCache('shadow');
    blitSceneCache('base');
  }

  // Only construction sites remain fully dynamic at ground/building depth.
  State.structures
    .filter(s=>(s.type==='road'||(s.auto&&s.type==='field'))&&underConstruction(s))
    .forEach(drawAutoStructure);
  const dynamicSites=State.structures
    .filter(s=>!(s.type==='road'||(s.auto&&s.type==='field'))&&underConstruction(s))
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of dynamicSites){if(s.auto)drawAutoStructure(s);else drawStructure(s)}

  markPhase('scene-caches');
  // Population remains between settlement massing and completed castle massing,
  // preserving the existing occlusion behaviour.
  drawPeasants();
  markPhase('population');
  drawTrainingSoldiers();
  blitSceneCache('castleBody');
  drawCutawayOccupants();

  drawTowerFlags();
  drawCastleSelection();
  drawCastleSoldiers();
  markPhase('castle-units');
  blitSceneCache('castleFront');
  window.ConquerSiege?.drawOverlay();
  drawCastleFireFixtures();

  // Small facade/details stay dynamic for night lighting and selection semantics.
  drawFacadeWindows(false,1,false);
  drawGatePortals();
  drawChimneysAndSmoke();

  if(State.draft?.previewSegments?.length)for(const segment of State.draft.previewSegments)drawStructure(segment,true);
  else if(State.draft?.preview)drawStructure(State.draft.preview,true);
  if(State.draft?.mode==='orient'&&State.draft.center&&Number.isFinite(State.draft.angle)){
    const end={x:State.draft.center.x+Math.cos(State.draft.angle)*4,y:State.draft.center.y+Math.sin(State.draft.angle)*4};
    const a=w2s(State.draft.center),b=w2s(end);ctx.save();ctx.strokeStyle='rgba(244,183,111,.72)';ctx.lineWidth=1.2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  }
  drawDayNightOverlay();
  drawNightLights();
  endPopulationFrame();
  markPhase('castle-facades-effects');
  if(window.__conquerPerf)window.__conquerPerf.renderPhases=phaseStats;
}
