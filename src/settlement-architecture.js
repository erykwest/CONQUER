// Architecture sprite loading, facades, towers and window/door details. Runtime semantics preserved from the monolith.
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
  for(const z of gateWindowRows(s))withStructureDetailOcclusion(s,z,()=>{
    for(const edge of gateFacadeEdges(s)){
      const paint=()=>isInteriorFacadeEdge(s,edge)
        ?drawArchitectureAssetOnEdge(edge,z,sz.w,sz.h,key,0,lit,nf)
        :drawArchitectureAssetOnEdge(edge,z,.24,.62,'arrowSlit');
      // The nighttime glow pass runs after the drawbridge. Mask only its
      // exterior-facing facade, preserving windows on the unobstructed sides.
      if(edge.role==='front'&&window.ConquerCrossings?.withDrawbridgeWindowOcclusion)
        window.ConquerCrossings.withDrawbridgeWindowOcclusion(s,paint);
      else paint();
    }
  });
}
function visibleFacadeEdges(s){
  const parts=s.type==='house'?urbanHouseDisplayParts(s).filter(p=>p.kind!=='turret'&&p.kind!=='outbuilding'):null;
  const rings=parts?parts.map(p=>p.points):[footprintPoints(s)],edges=[];
  for(const fp of rings){
    if(fp.length<4)continue;
    const faces=[];
    for(let i=0;i<fp.length;i++){
      const j=(i+1)%fp.length,a=w2s(fp[i],0),b=w2s(fp[j],0);
      faces.push({a:fp[i],b:fp[j],index:i,depth:(a.y+b.y)/2});
    }
    faces.sort((a,b)=>b.depth-a.depth);
    edges.push(...(parts?.length>=1&&(s.auto||s.urbanRedeveloped)&&houseLevel(s)>=3?faces.slice(0,2):faces));
  }
  edges.sort((a,b)=>b.depth-a.depth);
  return parts?.length>=1&&(s.auto||s.urbanRedeveloped)&&houseLevel(s)>=3?edges:edges.slice(0,s.type==='house'&&houseLevel(s)>=3?4:2);
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
  const tier=towerTier(tower),width=clamp(.38+tier*.045,.42,.54)*1.5,fullHeight=Math.max(.18,spec.apexZ-spec.baseZ),height=fullHeight/3*1.5,centerZ=spec.baseZ+height/2,tx=spec.tangent.x,ty=spec.tangent.y,c=spec.contact,half=width/2;
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
  const ww=2.1*State.view.scale,wh=3.25*State.view.scale;
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
// Mastio heraldry hangs below the sill of the castle-interior-facing window.
// Paint in the same projected facade plane as the existing architectural art.
function drawMastioWindowDrape(s,edge,windowZ,windowWidth,windowHeight,opacity=1){
  if(!s.isMastio||!edge)return;
  const width=Math.max(.30,windowWidth*1.08),height=.64;
  const topZ=windowZ-windowHeight/2-.055;
  const span=facadeAssetWorldSpan(edge,width),lt=w2s(span.a,topZ),rt=w2s(span.b,topZ),lb=w2s(span.a,topZ-height);
  ctx.save();
  ctx.globalAlpha*=clamp(opacity,0,1);
  ctx.transform((rt.x-lt.x)/100,(rt.y-lt.y)/100,
    (lb.x-lt.x)/120,(lb.y-lt.y)/120,lt.x,lt.y);
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(100,0);ctx.lineTo(100,120);
  ctx.lineTo(50,105);ctx.lineTo(0,120);ctx.closePath();
  ctx.fillStyle='#322218';ctx.fill();ctx.clip();
  const herald=State.heraldry||{};
  if(!window.__conquerHeraldryCanvas?.paint(ctx,0,0,100,120)){
    ctx.fillStyle=herald.c1||REIGN_COLOR_1;ctx.fillRect(0,0,100,120);
    ctx.fillStyle=herald.c2||REIGN_COLOR_2;ctx.fillRect(50,0,50,120);
  }
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(100,0);ctx.lineTo(100,120);
  ctx.lineTo(50,105);ctx.lineTo(0,120);ctx.closePath();
  ctx.strokeStyle='rgba(244,222,179,.84)';ctx.lineWidth=3.3;ctx.stroke();
  // Rod fixed directly beneath the stone or timber sill.
  ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(105,0);
  ctx.strokeStyle='#9d8253';ctx.lineWidth=6;ctx.stroke();
  ctx.restore();
}
function towerLevelHeight(s,level){
  const t=towerTier(s);
  return [2.35,3.55,4.75][clamp(level,1,3)-1]+(t-1)*.12;
}
function towerWindowRows(s){
  const l=structureLevel(s),rows=[];
  // P1 keeps its defensive blind walls, except an interior window for the mastio
  // so even the first completed T1 stone tower can display the hanging heraldry.
  if(l===1&&s.isMastio)rows.push({floor:1,z:1.53});
  if(l>=2)rows.push({floor:2,z:2.48});
  if(l>=3)rows.push({floor:3,z:3.62});
  return rows.filter(r=>r.z<structureHeight(s)-.28);
}
function drawRoundTowerWindowRow(s,row,lit=false,nf=1){
  const key=towerGothicAssetForRow(s,row),sz=towerGothicAssetSizeForRow(s,row),opacity=cutawayFacadeOpacity(s);if(!key)return;
  for(const edge of roundTowerFacadeEdges(s)){
    if(edge.interior){
      drawArchitectureAssetOnEdge(edge,row.z,sz.w*.86,sz.h,key,0,lit,nf,opacity);
      if(!lit)drawMastioWindowDrape(s,edge,row.z,sz.w*.86,sz.h,opacity);
    }else if(row.floor>=2)drawArchitectureAssetOnEdge(edge,row.z,.22,.60,'arrowSlit',0,false,1,opacity);
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
  for(const s of State.structures){
    if(underConstruction(s))continue;
    const center=structureCenter(s);
    if(center&&!worldPointVisible(center,structureVisualTopHeight(s),110))continue;
    if(s.type==='house'){
      if(includeHouses)drawHouseFacadeWindows(s,lit,nf);
    }else if(s.type==='built')drawBuiltWindows(s,lit,nf);
    else if(s.type==='gate'){
      if(!isWoodGate(s))withStructureGroundPlane(s,()=>drawGateWindows(s,lit,nf));
    }else if(s.type==='tower'){
      withStructureGroundPlane(s,()=>{
        if(isWoodTower(s)){
          // A wooden keep has a timber-framed interior-facing window, too.
          if(!s.isMastio||woodTowerStyle(s)==='watchtower')return;
          const edge=visibleFacadeEdges(s).find(e=>isInteriorFacadeEdge(s,e));
          if(!edge)return;
          const z=Math.min(structureHeight(s)-.53,1.45),w=.40,h=.50;
          drawArchitectureAssetOnEdge(edge,z,w,h,'gothicL1',0,lit,nf);
          if(!lit)drawMastioWindowDrape(s,edge,z,w,h);
          return;
        }
        const rows=towerWindowRows(s);
        if(!rows.length)return;
        if(s.shape==='round'){
          for(const row of rows)withStructureDetailOcclusion(s,row.z,()=>drawRoundTowerWindowRow(s,row,lit,nf));
          return;
        }
        const edges=visibleFacadeEdges(s),opacity=cutawayFacadeOpacity(s);
        for(const row of rows){
          const key=towerGothicAssetForRow(s,row),sz=towerGothicAssetSizeForRow(s,row);
          if(!key)continue;
          withStructureDetailOcclusion(s,row.z,()=>{
            for(const edge of edges){
              if(isInteriorFacadeEdge(s,edge)){
                drawArchitectureAssetOnEdge(edge,row.z,sz.w,sz.h,key,0,lit,nf,opacity);
                if(!lit)drawMastioWindowDrape(s,edge,row.z,sz.w,sz.h,opacity);
              }else if(row.floor>=2)drawArchitectureAssetOnEdge(edge,row.z,.22,.60,'arrowSlit',0,false,1,opacity);
            }
          });
        }
      });
    }
  }
}
