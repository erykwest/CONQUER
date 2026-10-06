'use strict';
// CONQUER settlement castle module — classic-script shared runtime.
function resize(){const r=wrap.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';screenCtx.setTransform(d,0,0,d,0,0);invalidateSceneCache();draw()}
function rotateViewPoint(p,turns=State.view.rotation||0){
  const q=((turns%4)+4)%4,c=WORLD/2,dx=p.x-c,dy=p.y-c;
  if(q===1)return{x:c-dy,y:c+dx};
  if(q===2)return{x:c-dx,y:c-dy};
  if(q===3)return{x:c+dy,y:c-dx};
  return{x:p.x,y:p.y};
}
function unrotateViewPoint(p,turns=State.view.rotation||0){return rotateViewPoint(p,-turns)}
function w2s(p,z=0){
  const q=rotateViewPoint(p),s=U*State.view.scale;
  return{x:State.view.x+(q.x-q.y)*s*ISO_X,y:State.view.y+(q.x+q.y)*s*ISO_Y-z*s*ISO_Z};
}
function s2w(x,y){
  const s=U*State.view.scale||1,a=(x-State.view.x)/(s*ISO_X),b=(y-State.view.y)/(s*ISO_Y);
  return unrotateViewPoint({x:(a+b)/2,y:(b-a)/2});
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
  if(s.type==='tower'){const l=structureLevel(s),t=towerTier(s);return [2.35,3.55,4.75][l-1]+(t-1)*.12}
  if(s.type==='gate')return [2.8,4.0,5.2][structureLevel(s)-1];
  if(s.type==='wall')return [1.15,2.10][structureLevel(s)-1];
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
  if(['wall','built'].includes(s.type))return linePoly(s);
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
function isCastlePart(s){return !s.auto&&['tower','gate','wall','built'].includes(s.type)}
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
function drawExposedTop(multi,z){
  if(!multi?.length)return;
  fillMultiPolygonTop(multi,z,'#9a8e82','#635951');
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
  for(const s of State.structures){
    if(!isCastlePart(s)||underConstruction(s))continue;
    if(s.type==='built'){
      drawBuiltDetails(s,false);
      if(builtSkin(s)==='arcade')drawBuiltArcade(s);
    }
    if(s.type==='wall'&&wallSkin(s)==='hoarding')drawWallHoarding(s);
    if(['tower','gate'].includes(s.type)){
      const h=structureHeight(s),a=w2s({x:s.x,y:s.y},h+.03),q={x:s.x+Math.cos(s.angle||0)*.55,y:s.y+Math.sin(s.angle||0)*.55},b=w2s(q,h+.03);
      ctx.save();ctx.strokeStyle='rgba(245,226,202,.48)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
    }
  }
}
function drawCastleSelection(){
  const s=selectedStructure();if(!s||!isCastlePart(s)||underConstruction(s))return;
  const pts=projectPath(footprintPoints(s),structureHeight(s));if(pts.length<3)return;
  ctx.save();ctx.strokeStyle='#f4b76f';ctx.lineWidth=2;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.restore();
}

function worldDepth(s){const p=rotateViewPoint(structureCenter(s));return p.x+p.y;}
function pointInScreenPolygon(p,poly){
  let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j],hit=((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||1e-9)+a.x);if(hit)inside=!inside;
  }return inside;
}
function screenHitStructure(s,p){
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
function seedRand(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296}}
function drawTerrain(){
  const corners=projectPath([{x:0,y:0},{x:WORLD,y:0},{x:WORLD,y:WORLD},{x:0,y:WORLD}],0);
  const winter=State.season==='winter';
  const terrainFill=winter?'#edf1ed':(BIOMES[State.biome]?.field||'#24291b');
  const terrainEdge=winter?'rgba(101,112,105,.34)':'rgba(225,214,190,.12)';
  pathPolygon(corners,terrainFill,terrainEdge,1);
  const rnd=seedRand((State.seed^0x45d9f3b)>>>0);
  ctx.save();
  for(let i=0;i<260;i++){
    const p=w2s({x:rnd()*WORLD,y:rnd()*WORLD}),r=(.5+rnd()*1.7)*Math.max(.45,State.view.scale);
    ctx.fillStyle=winter
      ?(rnd()>.55?'rgba(173,183,177,.14)':'rgba(255,255,255,.22)')
      :(rnd()>.55?'rgba(84,105,55,.12)':'rgba(137,120,70,.08)');
    ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.7,r,0,0,Math.PI*2);ctx.fill();
  }
  if(State.season==='spring'){
    const flowers=seedRand((State.seed^0x6b8f4a2d)>>>0);
    const palette=['#f7d7e8','#f3e37b','#f4f1dc','#d9b3ef','#e7a6b8'];
    for(let i=0;i<5200;i++){
      const p=w2s({x:flowers()*WORLD,y:flowers()*WORLD});
      const size=clamp((.65+flowers()*1.25)*State.view.scale,1,2.4);
      ctx.fillStyle=palette[Math.floor(flowers()*palette.length)];
      ctx.globalAlpha=.62+flowers()*.30;
      ctx.fillRect(Math.round(p.x),Math.round(p.y),size,size);
    }
    ctx.globalAlpha=1;
  }
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
    invalidateSceneCache('base');
    if(typeof draw==='function')draw();
  }catch(err){
    console.warn('Forest SVG load failed',err);
  }
}
loadForestTreeSprites();

function drawTree(tree){
  if(!forestTreeSpritesReady)return;
  const season=State.season==='autumn'?'autumn':State.season==='winter'?'winter':'summer';
  const colorIndex=season==='winter'?0:tree.colorIndex;
  const img=forestTreeSprites[season]?.[tree.shapeIndex]?.[colorIndex];
  if(!img)return;
  const base=w2s(tree.p,0);
  const size=Math.max(10,U*State.view.scale*2.25*tree.scale);
  ctx.save();
  if(tree.flip){
    ctx.translate(base.x,0);
    ctx.scale(-1,1);
    ctx.drawImage(img,-size*.5,base.y-size*.94,size,size);
  }else{
    ctx.drawImage(img,base.x-size*.5,base.y-size*.94,size,size);
  }
  ctx.restore();
}
const forestGroundPatternCanvases={};
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
  return ctx.createPattern(forestGroundPatternCanvases[key],'repeat');
}
function drawForestGround(f){
  const pts=projectPath(f.points);
  if(!pts.length)return;
  ctx.save();
  const world=projectPath([{x:0,y:0},{x:WORLD,y:0},{x:WORLD,y:WORLD},{x:0,y:WORLD}]);
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
  return clamp(Math.round((f.rx||5)*(f.ry||4)*1.55),22,58);
}
function drawForestMask(f){
  const rnd=seedRand((State.seed^biomeHash(f.id))>>>0);
  const trees=[],target=forestTreeCount(f);
  let attempts=0;
  while(trees.length<target&&attempts<target*14){
    attempts++;
    const p={x:f.x+(rnd()-.5)*f.rx*1.9,y:f.y+(rnd()-.5)*f.ry*1.9};
    if(p.x<0||p.x>WORLD||p.y<0||p.y>WORLD||!environmentContains(f,p))continue;
    trees.push({
      p,
      shapeIndex:Math.floor(rnd()*FOREST_TREE_ASSETS.length),
      colorIndex:Math.floor(rnd()*FOREST_CANOPY_PALETTES.summer.length),
      flip:rnd()<.5,
      scale:.8+rnd()*.4
    });
  }
  trees.sort((a,b)=>w2s(a.p,0).y-w2s(b.p,0).y);
  for(const tree of trees)drawTree(tree);
}
function ellipseWorldPoints(f,n=28){
  const pts=[],ca=Math.cos(f.angle||0),sa=Math.sin(f.angle||0);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=Math.cos(a)*f.rx,y=Math.sin(a)*f.ry;pts.push({x:f.x+x*ca-y*sa,y:f.y+x*sa+y*ca})}
  return pts;
}
function drawEnvironment(){
  for(const f of State.environment){
    ctx.save();
    if(['stream','river'].includes(f.type)){
      const pts=f.points.map(p=>w2s(p));ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
      ctx.strokeStyle=f.edge;ctx.lineWidth=Math.max(2,(f.width+.35)*U*State.view.scale*.72);ctx.stroke();ctx.strokeStyle=f.fill;ctx.lineWidth=Math.max(1.4,f.width*U*State.view.scale*.72);ctx.stroke();
    }else if(['forest','pond','sea'].includes(f.type)){
      if(f.type==='forest'){
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
function placementAngle(center,p){return Math.atan2(p.y-center.y,p.x-center.x)}
function orientedToolSpec(){
  if(State.tool.kind==='tower'&&State.tool.shape==='square')return{type:'tower',shape:'square',size:State.tool.size,level:State.tool.level||State.buildLevels.tower,functions:[]};
  if(State.tool.kind==='gate')return{type:'gate',shape:'square',size:1.5,level:State.tool.level||State.buildLevels.gate,functions:[]};
  // Future point-buildings can pass a placementSpec without adding another interaction path.
  if(State.tool.placementSpec&&State.tool.placementSpec.shape!=='round')return{...State.tool.placementSpec};
  return null;
}
function makePlacementPreview(q,angle=0){
  const spec=orientedToolSpec();
  if(spec)return{...spec,x:q.x,y:q.y,angle,previewOnly:true};
  if(State.tool.kind==='tower'&&State.tool.shape==='round')return{type:'tower',shape:'round',x:q.x,y:q.y,r:State.tool.size,level:State.tool.level||State.buildLevels.tower,previewOnly:true,functions:[]};
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
  const finalAngle=Number.isFinite(State.draft?.lockedAngle)?State.draft.lockedAngle:angle;
  const s={id:uid(),...spec,x:center.x,y:center.y,angle:finalAngle,functions:Array.isArray(spec.functions)?[...spec.functions]:[]};
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
    angle,
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
  const a=Number.isFinite(radialAngle)?radialAngle:0,ux=Math.cos(a),uy=Math.sin(a);
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
  const child=towerToolPrototype();if(!child)return null;
  const childTier=towerTier(child);
  let best=null,bestScore=Infinity;

  for(const parent of State.structures){
    if(parent.auto||!['tower','gate'].includes(parent.type)||underConstruction(parent))continue;

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
      const a=Math.atan2(p.y-parent.y,p.x-parent.x);
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
  if(!parent||(parent.type==='tower'&&towerTier(child)>=towerTier(parent))){
    delete child.parentTowerId;delete child.subtowerSocket;delete child.subtowerAngle;delete child.parentType;
    return false;
  }
  const attachment=subtowerAttachmentAtSocket(parent,child,child.subtowerSocket,child.subtowerAngle);
  if(!attachment)return false;
  child.x=attachment.point.x;child.y=attachment.point.y;
  if(child.shape==='square')child.angle=attachment.angle;
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
    if(wall.auto||wall.type!=='wall')continue;
    const reach=TOWER_WALL_MAGNET+(Number(wall.width)||.5)/2;
    for(const end of ['a','b']){
      if(wallEndpointSnapOccupied(wall,end))continue;
      const q=wall[end],d=dist(p,q);
      if(d<=reach&&d<bestD){
        best={
          point:{x:q.x,y:q.y},
          wallId:wall.id,
          wallEnd:end,
          angle:Math.atan2(wall.b.y-wall.a.y,wall.b.x-wall.a.x),
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
    const wall=State.structures.find(s=>s.id===link.wallId&&s.type==='wall');if(!wall)continue;
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
    if(wall.type!=='wall')continue;
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
  if(!tower||!wall||tower.type!=='tower'||wall.type!=='wall')return;
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
  if(!tower||tower.type!=='tower'||!wall||wall.type!=='wall')return false;
  end=end==='b'?'b':'a';
  const other=end==='a'?wall.b:wall.a;
  if(!other)return false;

  // Exact ray/footprint intersection. This is the actual tower collider,
  // unlike the old projected half-span approximation.
  const contact=boundaryPoint(tower,other);
  wall[end]={x:contact.x,y:contact.y};
  wall.length=dist(wall.a,wall.b);
  if(end==='a')wall.aSnap=tower.id;else wall.bSnap=tower.id;

  const original=anchor||{x:tower.x,y:tower.y};
  setTowerWallConnection(tower,wall,end,original);
  normalizeStructureVariants(wall);
  normalizeFunctions(tower);
  invalidateCastleColliderGeometry(tower,wall);
  return dist(wall[end],boundaryPoint(tower,other))<=.015;
}
function attachTowerToWallEndpoint(wallId,end,tower,anchor){
  const wall=State.structures.find(s=>s.id===wallId&&s.type==='wall');
  if(!wall||!tower||tower.type!=='tower'||!['a','b'].includes(end))return false;
  if(wallEndpointSnapOccupied(wall,end))return false;
  return regenerateTowerWallPair(tower,wall,end,anchor||wall[end]);
}
function restoreTowerWallConnections(tower){
  if(!tower||tower.type!=='tower')return;
  for(const link of towerWallConnectionRecords(tower)){
    const wall=State.structures.find(s=>s.id===link.wallId&&s.type==='wall');if(!wall)continue;
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
      const wall=State.structures.find(s=>s.id===l.wallId&&s.type==='wall');
      return wall?l.wallId+':'+l.end+':'+(underConstruction(wall)?'0':'1'):'missing';
    }).join('|');
    if(!force&&tower.wallColliderSyncSignature===signature)continue;

    let allReady=true,localChanged=0;
    for(const link of links){
      const wall=State.structures.find(s=>s.id===link.wallId&&s.type==='wall');
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
  const wall=State.structures.find(s=>s.id===wallId&&s.type==='wall');
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
    const wall=State.structures.find(s=>s.id===snap.wallId&&s.type==='wall');
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
  if(State.tool.linear==='wall')return{...TYPES.wall,width:wallWidthForTier(State.tool.tier||State.buildLevels.wallTier)};
  return TYPES.built;
}
function normalizeLinear(a,b,spec){let dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<.0001)return null;const target=clamp(L,spec.min,spec.max),ux=dx/L,uy=dy/L;return{a,b:{x:a.x+ux*target,y:a.y+uy*target},length:target}}
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
function structureLabel(s){if(!s)return'';if(s.type==='house'){const l=houseLevel(s);return `House · L${l}${l===3?' · '+housePlanType(s)+' plan':l===4?' · elite · '+houseTurretType(s)+' turret':''}`};if(s.type==='market')return'Market · 4×4U';if(s.type==='tavern')return'Tavern · double-T plan';if(s.type==='church')return'Church · large';if(s.type==='training')return'Training field · 5×4U';if(s.type==='well')return'Village well';if(s.type==='gate')return`Gate 1.5×1.5U · L${structureLevel(s)}`;if(s.type==='tower')return (s.shape==='round'?`Round tower R${s.r}U`:`Square tower ${s.size}×${s.size}U`)+` · T${towerTier(s)} · L${structureLevel(s)}`+(s.parentTowerId?' · SUB':'');if(s.type==='built')return`Built section ${s.length.toFixed(2)}U · L${structureLevel(s)}`;if(s.type==='wall')return`Wall ${s.length.toFixed(2)}U · T${wallTier(s)} (${s.width}U) · L${structureLevel(s)}`;return s.type}
function drawLinearBase(s,preview=false){
  const h=structureHeight(s),selected=State.selectedId===s.id;
  const colors=s.type==='wall'
    ?{top:'#9a8e82',sideA:'#49443f',sideB:'#686057',stroke:selected?'#f4b76f':'#d8c8b4'}
    :{top:'#9b7457',sideA:'#5c4436',sideB:'#715441',stroke:selected?'#f4b76f':'#d8c8b4'};
  extrudePolygon(linePoly(s),h,colors);
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
    if(o.id===owner.id||underConstruction(o)||!isCastlePart(o))return false;
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
  const faceA={
    poly:[a0,a1,rb,ra],
    fill:preview?'rgba(58,61,66,.62)':'#34363a',
    depth:(a0.y+a1.y)/2
  };
  const faceB={
    poly:[b0,b1,rb,ra],
    fill:preview?'rgba(70,73,78,.62)':'#42454a',
    depth:(b0.y+b1.y)/2
  };

  withBuiltRoofOcclusionClip(s,()=>{
    for(const face of [faceA,faceB].sort((a,b)=>a.depth-b.depth)){
      pathPolygon(face.poly,face.fill,'#5d6066',1);
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
    ownerTop:owner?structureHeight(owner):null
  };
}
function castleBattlementOccluders(piece){
  if(!piece.ownerId||!['tower','wall','gate'].includes(piece.ownerType))return[];
  const owner=State.structures.find(s=>s.id===piece.ownerId);
  return State.structures.filter(s=>{
    if(s.id===piece.ownerId||!isCastlePart(s)||underConstruction(s))return false;
    const h=structureVisualTopHeight(s);
    if(h<=Number(piece.z0)+.04)return false;

    // Attached/subtower geometry can overlap even when structure-center depth
    // says the opposite. If this merlon footprint enters the taller volume,
    // that volume must mask it unconditionally.
    const fp=unionFootprintPoints(s);
    if(worldPolygonsOverlap(piece.pts,fp))return true;

    const ownerDepth=owner?worldDepth(owner):Number(piece.ownerDepth??piece.depth);
    return worldDepth(s)>ownerDepth+1e-4;
  });
}
function withTowerBattlementOcclusion(piece,drawFn){
  const occluders=castleBattlementOccluders(piece);
  if(!occluders.length){drawFn();return}
  const r=wrap.getBoundingClientRect();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-48,-48,r.width+96,r.height+96);
  for(const tower of occluders){
    const hull=structureScreenSilhouette(tower);if(hull.length<3)continue;
    ctx.moveTo(hull[0].x,hull[0].y);
    for(let i=1;i<hull.length;i++)ctx.lineTo(hull[i].x,hull[i].y);
    ctx.closePath();
  }
  ctx.clip('evenodd');
  drawFn();
  ctx.restore();
}
function drawBattlementPiece(piece){
  withTowerBattlementOcclusion(piece,()=>{
    if(piece.wallCrest){
      const a=w2s(piece.wallCrest.a,piece.wallCrest.z),b=w2s(piece.wallCrest.b,piece.wallCrest.z);
      const H=Math.max(2000,wrap.getBoundingClientRect().height*3);
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
  });
}
function renderBattlementPieces(pieces){
  pieces.sort((a,b)=>a.depth-b.depth);
  for(const piece of pieces)drawBattlementPiece(piece);
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
  if(s.type!=='tower'||underConstruction(s)||towerRoofStyle(s)!=='battlement')return[];
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
      fill:i%2?'#34363a':'#42454a'
    });
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.fill,'#5d6066',1);
}
function drawRoundTowerRoof(s){
  const baseZ=structureHeight(s),apexZ=towerVisualTopHeight(s),fp=towerRoofFootprintPoints(s);
  if(fp.length<3)return;
  const apex=w2s({x:s.x,y:s.y},apexZ),faces=[];
  for(let i=0;i<fp.length;i++){
    const j=(i+1)%fp.length,a=w2s(fp[i],baseZ),b=w2s(fp[j],baseZ);
    const shade=i%3===0?'#303236':i%3===1?'#3a3d42':'#44474c';
    faces.push({poly:[a,b,apex],depth:(a.y+b.y)/2,fill:shade});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces)pathPolygon(f.poly,f.fill,null);
  const rim=projectPath(fp,baseZ);
  ctx.save();ctx.strokeStyle='#5d6066';ctx.lineWidth=1;ctx.beginPath();
  rim.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.restore();
}
function drawTowerRoof(s){
  if(!s||s.type!=='tower'||underConstruction(s)||towerRoofStyle(s)!=='pitched')return;
  withPointRoofOcclusion(s,()=>s.shape==='round'?drawRoundTowerRoof(s):drawSquareTowerRoof(s));
}
function drawTowerRoofs(){
  const towers=State.structures
    .filter(s=>s.type==='tower'&&!underConstruction(s)&&towerRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of towers)drawTowerRoof(s);
}
function drawGateRoof(s){
  if(!s||s.type!=='gate'||underConstruction(s)||gateRoofStyle(s)!=='pitched')return;
  const g=gateRoofGeometry(s);if(!g)return;
  withPointRoofOcclusion(s,()=>{
    const rearGable=[w2s(g.c3,g.h),w2s(g.c0,g.h),w2s(g.ridgeA,g.ridgeH)];
    const frontGable=[w2s(g.c1,g.h),w2s(g.c2,g.h),w2s(g.ridgeB,g.ridgeH)];
    const roofA=[w2s(g.c0,g.h),w2s(g.c1,g.h),w2s(g.ridgeB,g.ridgeH),w2s(g.ridgeA,g.ridgeH)];
    const roofB=[w2s(g.c3,g.h),w2s(g.c2,g.h),w2s(g.ridgeB,g.ridgeH),w2s(g.ridgeA,g.ridgeH)];
    const faces=[
      {poly:rearGable,fill:'#514a44',depth:(rearGable[0].y+rearGable[1].y)/2},
      {poly:frontGable,fill:'#62584f',depth:(frontGable[0].y+frontGable[1].y)/2},
      {poly:roofA,fill:'#34363a',depth:(roofA[0].y+roofA[1].y)/2},
      {poly:roofB,fill:'#42454a',depth:(roofB[0].y+roofB[1].y)/2}
    ];
    faces.sort((a,b)=>a.depth-b.depth);
    for(const face of faces)pathPolygon(face.poly,face.fill,'#5d6066',1);
  });
}
function drawGateRoofs(){
  const gates=State.structures
    .filter(s=>s.type==='gate'&&!underConstruction(s)&&gateRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const s of gates)drawGateRoof(s);
}
function midpoint2(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
function drawQuarteredTowerFlag(tower){
  if(!tower||underConstruction(tower)||tower.type!=='tower'||towerRoofStyle(tower)!=='pitched')return;
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
    .filter(s=>s.type==='tower'&&!underConstruction(s)&&towerRoofStyle(s)==='pitched')
    .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
  for(const tower of towers)drawQuarteredTowerFlag(tower);
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
          z
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
    if(s.type==='tower'&&towerRoofStyle(s)==='battlement'){
      const hash=peasantHash(s.id+'-brazier'),a=((hash%360)/180)*Math.PI;
      const r=s.shape==='round'?Math.max(.12,s.r*.34):Math.max(.12,(s.size||1)*.26);
      out.push({kind:'brazier',id:s.id+':brazier',p:{x:s.x+Math.cos(a)*r,y:s.y+Math.sin(a)*r},z:structureHeight(s)+.10});
    }else if(s.type==='gate'&&gateRoofStyle(s)==='battlement'){
      const ca=Math.cos(s.angle||0),sa=Math.sin(s.angle||0),half=.43;
      for(const side of [-1,1]){
        out.push({kind:'brazier',id:s.id+':brazier:'+side,p:{x:s.x+ca*half*side,y:s.y+sa*half*side},z:structureHeight(s)+.10});
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
  const p=w2s(src.p,src.z),scale=clamp(State.view.scale,.55,1.45);
  ctx.save();
  ctx.strokeStyle='#6b5440';ctx.lineWidth=Math.max(1,1.0*scale);
  ctx.beginPath();ctx.moveTo(p.x-3.0*scale,p.y+2.2*scale);ctx.lineTo(p.x,p.y);ctx.stroke();
  ctx.fillStyle='#463a32';ctx.beginPath();
  ctx.moveTo(p.x-1.6*scale,p.y+.5*scale);ctx.lineTo(p.x+1.6*scale,p.y+.5*scale);
  ctx.lineTo(p.x+1.0*scale,p.y+2.4*scale);ctx.lineTo(p.x-1.0*scale,p.y+2.4*scale);ctx.closePath();ctx.fill();
  ctx.restore();
  drawScreenFlame({x:p.x,y:p.y-.3*scale},scale,src.id,false);
}
function drawBrazierFixture(src){
  const scale=clamp(State.view.scale,.55,1.45);
  const pts=rectWorldPoints(src.p.x,src.p.y,.20,.20,0);
  extrudePolygonAt(pts,src.z-.08,src.z+.03,{top:'#5d4b3d',sideA:'#39312b',sideB:'#493d34',stroke:'#7b654f'});
  const p=w2s(src.p,src.z+.08);
  drawScreenFlame(p,scale,src.id,true);
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
    const p=w2s(src.p,src.z+(src.kind==='brazier'?.08:0));
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
  if(s.type!=='gate'||underConstruction(s)||gateRoofStyle(s)!=='battlement')return[];
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
function drawCastleBattlements(){
  const pieces=[];
  for(const s of State.structures){
    if(underConstruction(s))continue;
    if(s.type==='tower')pieces.push(...towerBattlementPieces(s));
    else if(s.type==='gate')pieces.push(...gateBattlementPieces(s));
    else if(s.type==='wall')pieces.push(...wallBattlementPieces(s));
  }
  renderBattlementPieces(pieces);
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
function drawSmoke(spec,id,now){
  if(!worldPointVisible(spec.center,spec.z1||0,80))return;
  const p=w2s(spec.center,spec.z1),seed=(biomeHash(String(id||''))%997)/997;
  const scale=Math.max(.55,State.view.scale);
  ctx.save();
  for(let i=0;i<4;i++){
    const phase=(now*.13+seed+i/4)%1;
    const fade=Math.pow(1-phase,1.7);
    const drift=Math.sin((phase*5.2+seed*8+i)*1.35)*3.2*scale+phase*5*scale;
    const y=p.y-phase*34*scale,x=p.x+drift,r=(2.2+phase*5.8)*scale;
    ctx.filter='blur('+(1.0+phase*2.2).toFixed(1)+'px)';
    ctx.fillStyle='rgba(180,178,172,'+(fade*.24).toFixed(3)+')';
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawHouseChimneys(s){
  for(const spec of chimneySpecs(s))drawChimney(spec);
}
function drawChimneysAndSmoke(){
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
function drawPointStructure(s,preview=false){
  const selected=State.selectedId===s.id,h=structureHeight(s),stroke=selected?'#f4b76f':'#d8c8b4';
  if(s.type==='well'){
    extrudePolygon(footprintPoints(s),h,{top:'#84796d',sideA:'#4e4740',sideB:'#5d554d',stroke});
    const p=w2s({x:s.x,y:s.y},h+.04),r=Math.max(2.5,.28*U*State.view.scale);ctx.fillStyle='#172023';ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.7,r,0,0,Math.PI*2);ctx.fill();
    if(State.village.founded&&State.village.name){ctx.fillStyle='#f2e6d3';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(State.village.name,p.x,p.y-12)}
    return;
  }
  const tower=s.type==='tower',gate=s.type==='gate';
  extrudePolygon(footprintPoints(s),h,{
    top:(tower||gate)?'#9a8e82':'#88796b',
    sideA:(tower||gate)?'#49443f':'#4e4740',
    sideB:(tower||gate)?'#686057':'#62584f',
    stroke
  });
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
  drawFlatRect(field,'rgba(133,111,55,.52)','rgba(190,168,95,.58)');
  const g=fieldGrid(field);ctx.save();ctx.strokeStyle='rgba(218,195,118,.28)';ctx.lineWidth=.7;
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
  const faces=[
    {kind:'roof',screen:[w2s(c0,wallH),w2s(c1,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:anthracite?'#303237':'#5b3d30',stroke:anthracite?'#55585e':'#8c6752',lw:1},
    {kind:'roof',screen:[w2s(c3,wallH),w2s(c2,wallH),w2s(r1,ridgeH),w2s(r0,ridgeH)],fill:anthracite?'#3a3d42':'#6b4938',stroke:anthracite?'#55585e':'#8c6752',lw:1},
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
  for(const f of faces)pathPolygon(f.poly,f.i%2?'#303943':'#394550',stroke,.75);
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
function drawAutoStructure(s){
  ctx.save();if(underConstruction(s))ctx.globalAlpha=.38;
  if(s.type==='field'){
    drawField(s);
  }else if(s.type==='road'){
    const a=w2s(s.a),b=w2s(s.b);ctx.strokeStyle='rgba(126,106,82,.70)';ctx.lineWidth=Math.max(2,s.width*U*State.view.scale*.72);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }else if(s.type==='house')drawHouse(s);
  ctx.restore();if(underConstruction(s))drawConstructionProgress(s);
}
function structureCenter(s){if(s.x!=null)return{x:s.x,y:s.y};if(s.a&&s.b)return{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2};return{x:0,y:0}}
