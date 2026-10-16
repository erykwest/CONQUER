'use strict';
// Terrain and environment visuals, previously embedded in settlement-castle.js. Runtime semantics preserved from the monolith.
function seedRand(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296}}
function mixWorld(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function clipTerrainPolygon(vertices){
  let out=vertices.map(v=>({x:v.x,y:v.y,z:v.z||0}));
  const cuts=[
    {inside:v=>v.x>=0,intersect:(a,b)=>{const t=(0-a.x)/((b.x-a.x)||1e-9);return{x:0,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}}},
    {inside:v=>v.x<=WORLD,intersect:(a,b)=>{const t=(WORLD-a.x)/((b.x-a.x)||1e-9);return{x:WORLD,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}}},
    {inside:v=>v.y>=0,intersect:(a,b)=>{const t=(0-a.y)/((b.y-a.y)||1e-9);return{x:a.x+(b.x-a.x)*t,y:0,z:a.z+(b.z-a.z)*t}}},
    {inside:v=>v.y<=WORLD,intersect:(a,b)=>{const t=(WORLD-a.y)/((b.y-a.y)||1e-9);return{x:a.x+(b.x-a.x)*t,y:WORLD,z:a.z+(b.z-a.z)*t}}}
  ];
  for(const cut of cuts){
    if(!out.length)break;
    const next=[];
    for(let i=0;i<out.length;i++){
      const a=out[i],b=out[(i+1)%out.length],ain=cut.inside(a),bin=cut.inside(b);
      if(ain&&bin)next.push(b);
      else if(ain&&!bin)next.push(cut.intersect(a,b));
      else if(!ain&&bin){next.push(cut.intersect(a,b));next.push(b)}
    }
    out=next;
  }
  return out;
}
function projectClippedTerrain(vertices){
  return clipTerrainPolygon(vertices).map(v=>w2sRaw(v,v.z));
}
function slopePoint(band,u,v){
  const outer=mixWorld(band.oa,band.ob,u),inner=mixWorld(band.a,band.b,u);
  return mixWorld(outer,inner,v);
}
const LANDSCAPE_RENDER_BUDGET=Object.freeze({
  terrainMarks:120,
  rockDensity:2.35,
  rockCrestDensity:.95,
  forestDensity:.95,
  forestMin:14,
  forestMax:120,
  flowerClusters:520
});
let landscapeRenderCacheSeed=null;
const steepRockLayoutCache=new Map();
const forestTreeLayoutCache=new Map();
const forestGroundLayoutCache=new Map();
let terrainMarkLayoutCache=null;
let springFlowerLayoutCache=null;
const springFlowerSprites=new Map();
const steepSlopePatternCanvases={};
const steepSlopePatternsByContext=new WeakMap();
function getSteepSlopePattern(winter=false){
  const key=winter?'winter':'gray';
  if(!steepSlopePatternCanvases[key]){
    const off=document.createElement('canvas');off.width=72;off.height=72;
    const p=off.getContext('2d'),rnd=seedRand(winter?0x4d7b91c3:0x6b6f7377);
    p.clearRect(0,0,72,72);
    for(let i=0;i<70;i++){
      const x=rnd()*72,y=rnd()*72,rx=.7+rnd()*3.8,ry=.35+rnd()*1.8;
      p.fillStyle=winter
        ?(rnd()>.5?'rgba(255,255,255,.12)':'rgba(102,111,116,.13)')
        :(rnd()>.5?'rgba(180,185,185,.11)':'rgba(32,36,38,.14)');
      p.beginPath();p.ellipse(x,y,rx,ry,rnd()*Math.PI,0,Math.PI*2);p.fill();
    }
    for(let i=0;i<16;i++){
      const x=rnd()*72,y=rnd()*72,L=5+rnd()*12,a=rnd()*Math.PI;
      p.strokeStyle=winter?'rgba(112,121,125,.10)':'rgba(215,218,216,.08)';
      p.lineWidth=.5+rnd()*.65;
      p.beginPath();p.moveTo(x,y);p.lineTo(x+Math.cos(a)*L,y+Math.sin(a)*L*.55);p.stroke();
    }
    steepSlopePatternCanvases[key]=off;
  }
  let patterns=steepSlopePatternsByContext.get(ctx);
  if(!patterns){patterns={};steepSlopePatternsByContext.set(ctx,patterns)}
  if(!patterns[key])patterns[key]=ctx.createPattern(steepSlopePatternCanvases[key],'repeat');
  return patterns[key];
}
function drawSteepSlopeSurface(poly,winter=false){
  if(!poly?.length)return;
  const base=winter?'#969ca0':'#6f7477';
  pathPolygon(poly,base,winter?'rgba(205,211,214,.55)':'rgba(190,196,197,.32)',.8);
  const pattern=getSteepSlopePattern(winter);if(!pattern)return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of poly){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
  ctx.save();
  ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  ctx.globalAlpha=winter?.72:.82;
  ctx.fillStyle=pattern;ctx.fillRect(minX-2,minY-2,maxX-minX+4,maxY-minY+4);
  ctx.restore();
}
function ensureLandscapeRenderCaches(){
  if(landscapeRenderCacheSeed===State.seed)return;
  landscapeRenderCacheSeed=State.seed;
  steepRockLayoutCache.clear();
  forestTreeLayoutCache.clear();
  forestGroundLayoutCache.clear();
  terrainMarkLayoutCache=null;
  springFlowerLayoutCache=null;
}
function staticCullOverscan(){return ctx!==screenCtx?STATIC_CACHE_OVERSCAN:0}
function screenPointVisibleRaw(p,z=0,pad=72){
  const q=w2sRaw(p,z),r=wrap.getBoundingClientRect(),extra=staticCullOverscan(),m=pad+extra;
  return q.x>=-m&&q.y>=-m&&q.x<=r.width+m&&q.y<=r.height+m;
}
function screenPolygonVisible(poly,pad=72){
  if(!poly?.length)return false;
  const r=wrap.getBoundingClientRect(),m=pad+staticCullOverscan();
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of poly){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
  return maxX>=-m&&maxY>=-m&&minX<=r.width+m&&minY<=r.height+m;
}
function terrainBandScreenPolygon(band){
  return[
    w2sRaw(band.oa,band.z0),w2sRaw(band.ob,band.z0),
    w2sRaw(band.b,band.z1),w2sRaw(band.a,band.z1)
  ];
}
function landscapeDetailTier(){
  const s=State.view.scale;
  if(s<.30)return 0;
  if(s<.58)return 1;
  return 2;
}
function drawGentleSlopeBand(band,winter){
  const preview=terrainBandScreenPolygon(band);
  if(!screenPolygonVisible(preview,96))return;
  const strips=landscapeDetailTier()===0?2:3;
  const fills=winter
    ?['#d6dbd7','#cfd5d0','#d9deda','#ccd2cd']
    :['#454430','#4b4934','#474631','#514e37'];
  for(let i=0;i<strips;i++){
    const v0=i/strips,v1=(i+1)/strips;
    const a0=slopePoint(band,0,v0),b0=slopePoint(band,1,v0),b1=slopePoint(band,1,v1),a1=slopePoint(band,0,v1);
    const z0=band.z0+(band.z1-band.z0)*v0,z1=band.z0+(band.z1-band.z0)*v1;
    const poly=projectClippedTerrain([{...a0,z:z0},{...b0,z:z0},{...b1,z:z1},{...a1,z:z1}]);
    if(poly.length>=3)pathPolygon(poly,fills[i%fills.length],null);
    if(i>0&&a0.x>=0&&a0.x<=WORLD&&a0.y>=0&&a0.y<=WORLD&&b0.x>=0&&b0.x<=WORLD&&b0.y>=0&&b0.y<=WORLD){
      const seamA=w2sRaw(a0,z0+.008),seamB=w2sRaw(b0,z0+.008);
      ctx.save();ctx.strokeStyle=winter?'rgba(116,124,119,.24)':'rgba(173,156,103,.20)';ctx.lineWidth=.75;
      ctx.beginPath();ctx.moveTo(seamA.x,seamA.y);ctx.lineTo(seamB.x,seamB.y);ctx.stroke();ctx.restore();
    }
  }
}
function drawLowPolyRock(p,z,size,height,seed,winter=false){
  if(!screenPointVisibleRaw(p,z,36))return;
  const tier=landscapeDetailTier(),rnd=seedRand(seed>>>0);
  const sidePalette=winter?['#8b9092','#9ca1a2','#777d80','#a8acad']:['#5e6263','#727677','#505455','#838787'];
  const topPalette=winter?['#b4b8b9','#a8adae','#c0c3c4']:['#8a8e8d','#989b99','#777b7a'];

  if(tier===0){
    const base=w2sRaw(p,z+.01),top=w2sRaw(p,z+height*.75),px=Math.max(1.25,size*U*State.view.scale*.78);
    pathPolygon([
      {x:base.x-px,y:base.y+.35*px},
      {x:base.x+px,y:base.y+.35*px},
      {x:top.x+px*.42,y:top.y},
      {x:top.x-px*.38,y:top.y-px*.12}
    ],sidePalette[seed%sidePalette.length],null);
    return;
  }

  const n=tier===1?4:5+Math.floor(rnd()*2),rot=rnd()*Math.PI*2,base=[],top=[];
  const sx=size*(.72+rnd()*.42),sy=size*(.55+rnd()*.36);
  for(let i=0;i<n;i++){
    const a=rot+i/n*Math.PI*2+(rnd()-.5)*.16,rr=.74+rnd()*.28;
    const q={x:p.x+Math.cos(a)*sx*rr,y:p.y+Math.sin(a)*sy*rr};
    const bz=z+.012,shrink=.46+rnd()*.18;
    base.push({p:q,z:bz});
    top.push({p:{x:p.x+(q.x-p.x)*shrink,y:p.y+(q.y-p.y)*shrink},z:bz+height*(.76+rnd()*.22)});
  }
  const faces=[];
  for(let i=0;i<n;i++){
    const j=(i+1)%n,quad=[w2sRaw(base[i].p,base[i].z),w2sRaw(base[j].p,base[j].z),w2sRaw(top[j].p,top[j].z),w2sRaw(top[i].p,top[i].z)];
    faces.push({poly:quad,depth:(quad[0].y+quad[1].y)/2,fill:sidePalette[(i+Math.floor(rnd()*sidePalette.length))%sidePalette.length]});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  const visibleFaces=tier===1?faces.slice(-3):faces;
  for(const face of visibleFaces)pathPolygon(face.poly,face.fill,null);
  const topPoly=top.map(q=>w2sRaw(q.p,q.z));
  if(topPoly.length>=3)pathPolygon(topPoly,topPalette[Math.floor(rnd()*topPalette.length)],null);
}
function steepSlopeRockLayout(level,band){
  ensureLandscapeRenderCaches();
  const key=level.id+':'+band.index;
  if(steepRockLayoutCache.has(key))return steepRockLayoutCache.get(key);
  const edgeLength=dist(band.a,band.b),rnd=seedRand((State.seed^Math.imul(level.z1*131+band.index+17,2654435761))>>>0);
  const count=Math.max(4,Math.round(edgeLength*LANDSCAPE_RENDER_BUDGET.rockDensity));
  const crestCount=Math.max(2,Math.round(edgeLength*LANDSCAPE_RENDER_BUDGET.rockCrestDensity));
  const rocks=[];
  for(let i=0;i<count;i++){
    const u=clamp((i+rnd()*.82)/count,.025,.975),v=Math.pow(rnd(),1.68);
    const p=slopePoint(band,u,v),z=band.z0+(band.z1-band.z0)*v;
    if(p.x>=0&&p.x<=WORLD&&p.y>=0&&p.y<=WORLD)rocks.push({p,z,size:.20+rnd()*.36,height:.14+rnd()*.42,seed:Math.floor(rnd()*0xffffffff)});
  }
  for(let i=0;i<crestCount;i++){
    const u=clamp((i+.18+rnd()*.64)/crestCount,.02,.98),v=.76+rnd()*.22;
    const p=slopePoint(band,u,v),z=band.z0+(band.z1-band.z0)*v;
    if(p.x>=0&&p.x<=WORLD&&p.y>=0&&p.y<=WORLD)rocks.push({p,z,size:.18+rnd()*.28,height:.12+rnd()*.30,seed:Math.floor(rnd()*0xffffffff)});
  }
  steepRockLayoutCache.set(key,rocks);
  return rocks;
}
function drawSteepSlopeRocks(level,band,winter){
  const tier=landscapeDetailTier(),rocks=steepSlopeRockLayout(level,band)
    .filter((_,i)=>tier===0?i%2===0:true)
    .map(r=>({...r,depth:w2sRaw(r.p,r.z).y}))
    .sort((a,b)=>a.depth-b.depth);
  if(window.__conquerPerf)window.__conquerPerf.landscapeRocks=(window.__conquerPerf.landscapeRocks||0)+rocks.length;
  for(const rock of rocks)drawLowPolyRock(rock.p,rock.z,rock.size,rock.height,rock.seed,winter);
}
function drawRelief(){
  ensureLandscapeRenderCaches();
  const winter=State.season==='winter',baseFill=winter?'#edf1ed':(BIOMES[State.biome]?.field||'#24291b');
  const levels=reliefLevels().slice().sort((a,b)=>a.z1-b.z1);
  let bandsDrawn=0;
  if(window.__conquerPerf)window.__conquerPerf.landscapeRocks=0;
  for(const level of levels){
    const bands=reliefEdgeBands(level).map(b=>({...b,depth:[b.oa,b.ob,b.b,b.a].map(p=>w2sRaw(p,b.z0)).reduce((s,p)=>s+p.y,0)/4})).sort((a,b)=>a.depth-b.depth);
    for(const band of bands){
      if(!screenPolygonVisible(terrainBandScreenPolygon(band),96))continue;
      bandsDrawn++;
      if(band.kind==='gentle')drawGentleSlopeBand(band,winter);
      else{
        const poly=projectClippedTerrain([
          {...band.oa,z:band.z0},{...band.ob,z:band.z0},{...band.b,z:band.z1},{...band.a,z:band.z1}
        ]);
        if(poly.length>=3)drawSteepSlopeSurface(poly,winter);
        drawSteepSlopeRocks(level,band,winter);
      }
    }
    const top=projectClippedTerrain(level.top.map(p=>({...p,z:level.z1})));
    if(top.length>=3&&screenPolygonVisible(top,96))pathPolygon(top,baseFill,winter?'rgba(118,128,121,.40)':'rgba(203,190,148,.22)',1.05);
  }
  if(window.__conquerPerf)window.__conquerPerf.reliefBandsDrawn=bandsDrawn;
}
const SPRING_FLOWER_PALETTE=['#f7d7e8','#f3e37b','#f4f1dc','#d9b3ef','#e7a6b8'];
function terrainMarkLayout(){
  ensureLandscapeRenderCaches();
  if(terrainMarkLayoutCache)return terrainMarkLayoutCache;
  const rnd=seedRand((State.seed^0x45d9f3b)>>>0),marks=[];
  for(let i=0;i<LANDSCAPE_RENDER_BUDGET.terrainMarks;i++){
    const p={x:rnd()*WORLD,y:rnd()*WORLD};
    marks.push({p,z:terrainElevation(p),r:.5+rnd()*1.7,light:rnd()>.55});
  }
  terrainMarkLayoutCache=marks;
  return marks;
}
function flowerClusterClearOfSteep(center,radius){
  const steps=[-1,-.5,0,.5,1];
  for(const gx of steps)for(const gy of steps){
    if(gx*gx+gy*gy>1.01)continue;
    const p={x:center.x+gx*radius,y:center.y+gy*radius};
    if(p.x<0||p.x>WORLD||p.y<0||p.y>WORLD||terrainSlopeKind(p)==='steep')return false;
  }
  return true;
}
function springFlowerLayout(){
  ensureLandscapeRenderCaches();
  if(springFlowerLayoutCache)return springFlowerLayoutCache;
  const rnd=seedRand((State.seed^0x6b8f4a2d)>>>0),clusters=[];
  let attempts=0;
  while(clusters.length<LANDSCAPE_RENDER_BUDGET.flowerClusters&&attempts<LANDSCAPE_RENDER_BUDGET.flowerClusters*8){
    attempts++;
    const radius=.65+rnd()*.95;
    const center={x:radius+rnd()*(WORLD-radius*2),y:radius+rnd()*(WORLD-radius*2)};
    if(!flowerClusterClearOfSteep(center,radius))continue;
    clusters.push({
      center,radius,z:terrainElevation(center),
      colorIndex:Math.floor(rnd()*SPRING_FLOWER_PALETTE.length),
      variant:Math.floor(rnd()*4)
    });
  }
  springFlowerLayoutCache=clusters;
  return clusters;
}
function springFlowerSprite(colorIndex,variant){
  const key=colorIndex+':'+variant;
  if(springFlowerSprites.has(key))return springFlowerSprites.get(key);
  const off=document.createElement('canvas');off.width=64;off.height=64;
  const p=off.getContext('2d'),rnd=seedRand((0x71ab39d5^Math.imul(colorIndex+1,131)^Math.imul(variant+1,977))>>>0);
  p.fillStyle=SPRING_FLOWER_PALETTE[colorIndex];
  for(let i=0;i<100;i++){
    const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*27,x=32+Math.cos(a)*r,y=32+Math.sin(a)*r,size=.8+rnd()*1.45;
    p.globalAlpha=.58+rnd()*.36;p.fillRect(Math.round(x),Math.round(y),size,size);
  }
  p.globalAlpha=1;springFlowerSprites.set(key,off);return off;
}
function drawSpringFlowerClusters(){
  const clusters=springFlowerLayout(),tier=landscapeDetailTier();
  let drawn=0;
  ctx.save();
  for(let i=0;i<clusters.length;i++){
    if(tier===0&&i%5===4)continue;
    const cluster=clusters[i];
    if(!screenPointVisibleRaw(cluster.center,cluster.z,32))continue;
    const p=w2sRaw(cluster.center,cluster.z+.015);
    const w=Math.max(5,cluster.radius*U*State.view.scale*2.2);
    const h=Math.max(3.5,cluster.radius*U*State.view.scale*1.25);
    ctx.globalAlpha=.88;
    ctx.drawImage(springFlowerSprite(cluster.colorIndex,cluster.variant),p.x-w/2,p.y-h/2,w,h);
    drawn++;
  }
  ctx.restore();
  if(window.__conquerPerf)window.__conquerPerf.springFlowerClusters=drawn;
}
function drawTerrain(){
  const corners=projectPath([{x:0,y:0},{x:WORLD,y:0},{x:WORLD,y:WORLD},{x:0,y:WORLD}],0);
  const winter=State.season==='winter';
  const terrainFill=winter?'#edf1ed':(BIOMES[State.biome]?.field||'#24291b');
  const terrainEdge=winter?'rgba(101,112,105,.34)':'rgba(225,214,190,.12)';
  pathPolygon(corners,terrainFill,terrainEdge,1);
  drawRelief();
  ctx.save();
  for(const mark of terrainMarkLayout()){
    if(!screenPointVisibleRaw(mark.p,mark.z,12))continue;
    const p=w2sRaw(mark.p,mark.z),r=mark.r*Math.max(.45,State.view.scale);
    ctx.fillStyle=winter
      ?(mark.light?'rgba(173,183,177,.14)':'rgba(255,255,255,.22)')
      :(mark.light?'rgba(84,105,55,.12)':'rgba(137,120,70,.08)');
    ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.7,r,0,0,Math.PI*2);ctx.fill();
  }
  if(State.season==='spring')drawSpringFlowerClusters();
  ctx.restore();
}
// Mountain facet tone by its outward direction against a north-west light (world space, so the
// slopes stay lit consistently as the camera turns), with a slight alternation between facets.
const MOUNTAIN_LIGHT={x:-.6,y:-.8},MOUNTAIN_DARK=[0x46,0x3c,0x33],MOUNTAIN_LIT=[0x86,0x75,0x62];
function mountainFaceColor(f,a,b,i){
  const mx=(a.x+b.x)/2-f.x,my=(a.y+b.y)/2-f.y,L=Math.hypot(mx,my)||1;
  const t=clamp((mx/L*MOUNTAIN_LIGHT.x+my/L*MOUNTAIN_LIGHT.y+1)/2+(i%2?.035:-.035),0,1);
  const c=MOUNTAIN_DARK.map((d,k)=>Math.round(d+(MOUNTAIN_LIT[k]-d)*t));
  return'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
}
// Snow above 50% and pines below 25% of the TALLEST summit's height: one snow line and one
// tree line for the whole map, so lower summits may have no snow at all.
function mountainMaxHeight(){
  let h=0;for(const f of State.environment||[])if(f.type==='mountain')h=Math.max(h,f.height||3.6);return h;
}
function mountainSnowZ(){return mountainMaxHeight()*MOUNTAIN_SNOW_LINE}
function mountainPineZ(){return mountainMaxHeight()*MOUNTAIN_PINE_LINE}
const MOUNTAIN_SNOW_LINE=.5,MOUNTAIN_PINE_LINE=.25,MOUNTAIN_SNOW=[0xd6,0xdd,0xdf],MOUNTAIN_SNOW_LIT=[0xf4,0xf7,0xf7];
function mountainSnowColor(f,a,b,i){
  const mx=(a.x+b.x)/2-f.x,my=(a.y+b.y)/2-f.y,L=Math.hypot(mx,my)||1;
  const t=clamp((mx/L*MOUNTAIN_LIGHT.x+my/L*MOUNTAIN_LIGHT.y+1)/2+(i%2?.03:-.03),0,1);
  return'#'+MOUNTAIN_SNOW.map((d,k)=>Math.round(d+(MOUNTAIN_SNOW_LIT[k]-d)*t).toString(16).padStart(2,'0')).join('');
}
// Cone surface height at p: linear from the base outline (0) to the apex (f.height).
function mountainFacet(f,p){
  const a=Math.atan2(p.y-f.y,p.x-f.x),n=f.points.length;
  for(let i=0;i<n;i++){
    const A=f.points[i],B=f.points[(i+1)%n];
    const aa=Math.atan2(A.y-f.y,A.x-f.x),ab=Math.atan2(B.y-f.y,B.x-f.x);
    let span=ab-aa;while(span<=-Math.PI)span+=2*Math.PI;while(span>Math.PI)span-=2*Math.PI;
    let d=a-aa;while(d<=-Math.PI)d+=2*Math.PI;while(d>Math.PI)d-=2*Math.PI;
    if(span>=0?d>=0&&d<=span:d<=0&&d>=span)return i;
  }
  return 0;
}
function mountainSurfaceZ(f,p){
  const i=mountainFacet(f,p),A=f.points[i],B=f.points[(i+1)%f.points.length];
  // Ray from the centre through p meets edge AB at the base: z falls linearly to it.
  const dx=p.x-f.x,dy=p.y-f.y,ex=B.x-A.x,ey=B.y-A.y,den=dx*ey-dy*ex;
  if(Math.abs(den)<1e-9)return 0;
  const s=((A.x-f.x)*ey-(A.y-f.y)*ex)/den;
  return s>1?(f.height||3.6)*(1-1/s):0;
}
// Pines on the lower half of each peak, on a jittered 2.6U grid, skipped where a taller
// neighbouring peak covers the spot. Each pine remembers its facet for 2.5D painting.
const mountainPineCache=new Map();
function mountainPineLayout(f){
  const pineZ=mountainPineZ(),key=f.id+':'+State.seed+':'+(f.height||0)+':'+pineZ.toFixed(3);
  if(mountainPineCache.has(key))return mountainPineCache.get(key);
  const rnd=seedRand((State.seed^biomeHash(f.id+':pines'))>>>0),b=environmentPolygonBounds(f.points),step=2.6,out=[];
  const others=State.environment.filter(o=>o.type==='mountain'&&o!==f);
  for(let y=b.minY;y<=b.maxY;y+=step)for(let x=b.minX;x<=b.maxX;x+=step){
    const p={x:x+(rnd()-.5)*step*.8,y:y+(rnd()-.5)*step*.8},shade=rnd(),scale=.9+rnd()*.45,flip=rnd()<.5;
    if(!pointInPolygon(p,f.points))continue;
    const z=mountainSurfaceZ(f,p),h=f.height||3.6;
    if(z>pineZ||z>h||z<.05)continue;
    if(others.some(o=>pointInPolygon(p,o.points)&&mountainSurfaceZ(o,p)>z))continue;
    out.push({p,z,facet:mountainFacet(f,p),shade:shade<.5?0:1,scale,flip});
  }
  mountainPineCache.set(key,out);return out;
}
// Two-tone pine like the reference: tiered drooping crown and a short trunk.
const mountainPineSprites={};
function mountainPineSprite(variant,winter=false){
  const key=variant+(winter?'w':'');
  if(mountainPineSprites[key])return mountainPineSprites[key];
  const W=96,H=128,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const crown=winter?(variant?'#6f8a72':'#7f9a80'):(variant?'#4f7a45':'#5d9140'),trunk='#a07560';
  g.fillStyle=trunk;g.fillRect(W*.44,H*.80,W*.12,H*.17);
  g.fillStyle=crown;g.beginPath();
  const tiers=5,top=H*.04,bottom=H*.83;g.moveTo(W/2,top);
  for(let k=1;k<=tiers;k++){
    const y=top+(bottom-top)*k/tiers,half=W*(.10+.36*k/tiers);
    g.quadraticCurveTo(W/2+half*.55,y-(bottom-top)/tiers*.35,W/2+half,y);
    if(k<tiers)g.lineTo(W/2+half*.62,y-(bottom-top)/tiers*.12);
  }
  for(let k=tiers;k>=1;k--){
    const y=top+(bottom-top)*k/tiers,half=W*(.10+.36*k/tiers);
    if(k<tiers)g.lineTo(W/2-half*.62,y-(bottom-top)/tiers*.12);
    g.lineTo(W/2-half,y);
    g.quadraticCurveTo(W/2-half*.55,y-(bottom-top)/tiers*.35,k===1?W/2:W/2-W*(.10+.36*(k-1)/tiers),k===1?top:top+(bottom-top)*(k-1)/tiers);
  }
  g.closePath();g.fill();
  if(winter){g.fillStyle='rgba(245,248,248,.55)';for(let k=1;k<=tiers;k++){const y=top+(bottom-top)*k/tiers,half=W*(.10+.36*k/tiers);g.fillRect(W/2-half*.6,y-H*.03,half*1.2,H*.02)}}
  mountainPineSprites[key]=c;return c;
}
function drawMountainPine(t){
  if(!screenPointVisibleRaw(t.p,t.z,30))return;
  const img=mountainPineSprite(t.shade,State.season==='winter'),base=w2sRaw(t.p,t.z);
  const h=Math.max(8,U*State.view.scale*2.4*t.scale),w=h*.75;
  ctx.drawImage(img,base.x-w/2,base.y-h*.97,w,h);
}
function drawRaisedFan(f,height){
  const base=f.points,center={x:f.x,y:f.y},top=w2s(center,height),faces=[];
  const plan=typeof isPlanView==='function'&&isPlanView(),pines=f.height?mountainPineLayout(f):[];
  // Fraction of this peak's height where the map-wide snow line falls (1 = no snow).
  const k=Math.min(1,mountainSnowZ()/height);
  for(let i=0;i<base.length;i++){
    const j=(i+1)%base.length,a=w2s(base[i]),b=w2s(base[j]);
    const sa=w2s({x:f.x+(base[i].x-f.x)*(1-k),y:f.y+(base[i].y-f.y)*(1-k)},height*k);
    const sb=w2s({x:f.x+(base[j].x-f.x)*(1-k),y:f.y+(base[j].y-f.y)*(1-k)},height*k);
    faces.push({rock:k<1?[a,b,sb,sa]:[a,b,top],snow:k<1?[sa,sb,top]:null,depth:(a.y+b.y)/2,i,
      color:mountainFaceColor(f,base[i],base[j],i),snowColor:mountainSnowColor(f,base[i],base[j],i)});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  // Pines go with their facet, so nearer facets (and their pines) cover farther ones.
  const byFacet=new Map();for(const t of pines){if(!byFacet.has(t.facet))byFacet.set(t.facet,[]);byFacet.get(t.facet).push(t)}
  for(const q of faces){
    pathPolygon(q.rock,q.color,'rgba(170,150,125,.35)',.8);
    if(q.snow)pathPolygon(q.snow,q.snowColor,'rgba(200,210,214,.45)',.8);
    if(plan||!forestTreeSpritesReady)continue;
    for(const t of (byFacet.get(q.i)||[]).sort((a,b)=>w2sRaw(a.p,a.z).y-w2sRaw(b.p,b.z).y))drawMountainPine(t);
  }
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
    invalidateSceneCache('landscape');
    if(typeof draw==='function')draw();
  }catch(err){
    console.warn('Forest SVG load failed',err);
  }
}
loadForestTreeSprites();

function drawTree(tree){
  if(!forestTreeSpritesReady||!screenPointVisibleRaw(tree.p,tree.z||0,44))return false;
  const season=State.season==='autumn'?'autumn':State.season==='winter'?'winter':'summer';
  const colorIndex=season==='winter'?0:tree.colorIndex;
  const img=forestTreeSprites[season]?.[tree.shapeIndex]?.[colorIndex];
  if(!img)return false;
  const base=w2sRaw(tree.p,tree.z||0);
  const size=Math.max(10,U*State.view.scale*2.25*tree.scale);
  ctx.save();
  if(tree.flip){
    ctx.translate(base.x,0);
    ctx.scale(-1,1);
    ctx.drawImage(img,-size*.5,base.y-size*.94,size,size);
  }else{
    ctx.drawImage(img,base.x-size*.5,base.y-size*.94,size,size);
  }
  ctx.restore();return true;
}
const forestGroundPatternCanvases={};
const forestGroundPatternsByContext=new WeakMap();
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
  let patterns=forestGroundPatternsByContext.get(ctx);
  if(!patterns){patterns={};forestGroundPatternsByContext.set(ctx,patterns)}
  if(!patterns[key])patterns[key]=ctx.createPattern(forestGroundPatternCanvases[key],'repeat');
  return patterns[key];
}
function forestGroundLayout(f){
  ensureLandscapeRenderCaches();
  if(forestGroundLayoutCache.has(f.id))return forestGroundLayoutCache.get(f.id);
  const pts=(f.points||[]).map(p=>({x:p.x,y:p.y,z:terrainElevation(p)}));
  forestGroundLayoutCache.set(f.id,pts);return pts;
}
function drawForestGround(f){
  const layout=forestGroundLayout(f),pts=layout.map(p=>w2sRaw(p,p.z));
  if(!pts.length||!screenPolygonVisible(pts,72))return;
  ctx.save();
  const world=[
    w2sRaw({x:0,y:0},terrainElevation({x:0,y:0})),
    w2sRaw({x:WORLD,y:0},terrainElevation({x:WORLD,y:0})),
    w2sRaw({x:WORLD,y:WORLD},terrainElevation({x:WORLD,y:WORLD})),
    w2sRaw({x:0,y:WORLD},terrainElevation({x:0,y:WORLD}))
  ];
  ctx.beginPath();
  world.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.closePath();
  ctx.clip();
  // Holes (clearings, banks, grooves): each one is cut out with an even-odd clip against a
  // covering rectangle; successive clips intersect, so overlapping holes stay open.
  const holes=(f.holes||[]).map(h=>h.map(p=>w2sRaw(p,terrainElevation(p))));
  for(const hole of holes){
    if(!screenPolygonVisible(hole,8))continue;
    ctx.beginPath();ctx.rect(-1e5,-1e5,2e5,2e5);
    hole.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
    ctx.clip('evenodd');
  }
  ctx.beginPath();
  pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.closePath();
  ctx.fillStyle=getForestGroundPattern()||(State.season==='winter'?'#dfe5e0':'#1d3218');
  ctx.fill();
  ctx.strokeStyle=State.season==='winter'?'rgba(126,139,130,.45)':'rgba(82,116,59,.58)';
  ctx.lineWidth=1.15;
  ctx.stroke();
  // Clearing outlines (not grooves or banks) read as the woodland edge.
  for(const hole of holes.slice(0,f.clearings||0)){
    ctx.beginPath();hole.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
  }
  ctx.restore();
}
function forestTreeCount(f){
  return clamp(Math.round((f.rx||5)*(f.ry||4)*LANDSCAPE_RENDER_BUDGET.forestDensity),LANDSCAPE_RENDER_BUDGET.forestMin,LANDSCAPE_RENDER_BUDGET.forestMax);
}
// Holes (clearings, grooves) change the layout: key it by their count, not just the id.
function forestLayoutKey(f){return f.id+':'+(f.holes?.length||0)}
function clearForestLayoutCache(){forestTreeLayoutCache.clear()}
// Continuous woodland: a jittered grid over the map with fixed per-cell attributes, filtered by
// containment, so carving a groove removes only the trees inside it instead of reshuffling all.
const CONTINUOUS_FOREST_SPACING=4.4;
function continuousForestTrees(f){
  const rnd=seedRand((State.seed^biomeHash(f.id))>>>0),n=Math.ceil(WORLD/CONTINUOUS_FOREST_SPACING),trees=[];
  for(let iy=0;iy<n;iy++)for(let ix=0;ix<n;ix++){
    const p={x:(ix+.15+rnd()*.7)*CONTINUOUS_FOREST_SPACING,y:(iy+.15+rnd()*.7)*CONTINUOUS_FOREST_SPACING};
    const tree={p,shapeIndex:Math.floor(rnd()*FOREST_TREE_ASSETS.length),colorIndex:Math.floor(rnd()*FOREST_CANOPY_PALETTES.summer.length),flip:rnd()<.5,scale:.8+rnd()*.4};
    if(p.x<0||p.x>WORLD||p.y<0||p.y>WORLD||!environmentContains(f,p))continue;
    tree.z=terrainElevation(p);trees.push(tree);
  }
  return trees;
}
function forestTreeLayout(f){
  ensureLandscapeRenderCaches();
  const cacheKey=forestLayoutKey(f);
  if(forestTreeLayoutCache.has(cacheKey))return forestTreeLayoutCache.get(cacheKey);
  if(f.continuous){const trees=continuousForestTrees(f);forestTreeLayoutCache.set(cacheKey,trees);return trees}
  const rnd=seedRand((State.seed^biomeHash(f.id))>>>0),trees=[],target=forestTreeCount(f);
  // Sample the actual rotated, lobed polygon's bounds, not the nominal axis
  // radii: every cove and peninsula must be eligible for trees.
  const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  for(const p of f.points||[]){
    bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);
    bounds.minY=Math.min(bounds.minY,p.y);bounds.maxY=Math.max(bounds.maxY,p.y);
  }
  if(!Number.isFinite(bounds.minX)){
    bounds.minX=f.x-f.rx;bounds.maxX=f.x+f.rx;
    bounds.minY=f.y-f.ry;bounds.maxY=f.y+f.ry;
  }
  let attempts=0;
  while(trees.length<target&&attempts<target*12){
    attempts++;
    const p={x:bounds.minX+rnd()*(bounds.maxX-bounds.minX),y:bounds.minY+rnd()*(bounds.maxY-bounds.minY)};
    if(p.x<0||p.x>WORLD||p.y<0||p.y>WORLD||!environmentContains(f,p))continue;
    trees.push({
      p,z:terrainElevation(p),
      shapeIndex:Math.floor(rnd()*FOREST_TREE_ASSETS.length),
      colorIndex:Math.floor(rnd()*FOREST_CANOPY_PALETTES.summer.length),
      flip:rnd()<.5,
      scale:.8+rnd()*.4
    });
  }
  forestTreeLayoutCache.set(cacheKey,trees);return trees;
}
function forestLikelyVisible(f,pad=100){
  const p={x:Number(f.x)||0,y:Number(f.y)||0},z=terrainElevation(p),s=w2sRaw(p,z),r=wrap.getBoundingClientRect();
  const extent=Math.hypot(f.rx||5,f.ry||4)*1.4*U*State.view.scale*1.55+pad+staticCullOverscan();
  return s.x>=-extent&&s.y>=-extent&&s.x<=r.width+extent&&s.y<=r.height+extent;
}
function drawForestMask(f){
  if(!forestLikelyVisible(f))return;
  const tier=landscapeDetailTier();
  const trees=forestTreeLayout(f)
    .filter((_,i)=>tier===0?i%2===0:tier===1?i%4!==3:true)
    .filter(tree=>screenPointVisibleRaw(tree.p,tree.z,50))
    .slice()
    .sort((a,b)=>w2sRaw(a.p,a.z).y-w2sRaw(b.p,b.z).y);
  let drawn=0;
  for(const tree of trees)if(drawTree(tree))drawn++;
  if(window.__conquerPerf)window.__conquerPerf.forestTrees=(window.__conquerPerf.forestTrees||0)+drawn;
}

function ellipseWorldPoints(f,n=28){
  const pts=[],ca=Math.cos(f.angle||0),sa=Math.sin(f.angle||0);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=Math.cos(a)*f.rx,y=Math.sin(a)*f.ry;pts.push({x:f.x+x*ca-y*sa,y:f.y+x*sa+y*ca})}
  return pts;
}
function drawEnvironment(){
  if(window.__conquerPerf)window.__conquerPerf.forestTrees=0;
  // Peaks overlap (main summits and their secondary ones): paint far to near, or by height in plan.
  const depth=f=>isPlanView()?(f.height||3.6):w2sRaw({x:f.x,y:f.y},0).y;
  const mountains=State.environment.filter(f=>f.type==='mountain').sort((a,b)=>depth(a)-depth(b));
  const ordered=[...State.environment.filter(f=>f.type!=='mountain'),...mountains];
  for(const f of ordered){
    ctx.save();
    if(['stream','river'].includes(f.type)){
      const pts=f.points.map(p=>w2s(p));ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
      ctx.strokeStyle=f.edge;ctx.lineWidth=Math.max(2,(f.width+.35)*U*State.view.scale*.72);ctx.stroke();ctx.strokeStyle=f.fill;ctx.lineWidth=Math.max(1.4,f.width*U*State.view.scale*.72);ctx.stroke();
    }else if(['forest','pond','sea'].includes(f.type)){
      if(f.type==='forest'){
        if(!forestLikelyVisible(f)){ctx.restore();continue}
        drawForestGround(f);
        drawForestMask(f);
      }else{
        const pts=projectPath(f.points);pathPolygon(pts,f.fill,f.edge,1.2);
      }
      if(f.type==='sea'&&f.coastline){
        const coast=projectPath(f.coastline);ctx.beginPath();coast.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#b9cfca';ctx.lineWidth=2;ctx.stroke();
      }
    }else if(f.type==='mountain'){
      pathPolygon(projectPath(f.points),f.fill,f.edge,1.2);drawRaisedFan(f,f.height||3.6);
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
  if(isPlanView())drawPlanSnapGrid();
}
// Plan view only: the placement snap lattice (GRID = 0.5U) over the buildable area, 1U lines brighter.
// w2sRaw ignores height in plan view, so straight lines stay exact on relief too.
function drawPlanSnapGrid(){
  const px=U*State.view.scale*GRID;if(px<6)return;
  ctx.save();ctx.lineWidth=1;
  for(let v=BUILD_MIN;v<=BUILD_MAX+1e-6;v+=GRID){
    const major=Math.abs(v-Math.round(v))<1e-6;
    if(!major&&px<10)continue;
    ctx.strokeStyle=major?'rgba(255,255,255,.10)':'rgba(255,255,255,.045)';
    let a=w2sRaw({x:v,y:BUILD_MIN}),b=w2sRaw({x:v,y:BUILD_MAX});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    a=w2sRaw({x:BUILD_MIN,y:v});b=w2sRaw({x:BUILD_MAX,y:v});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.restore();
}
function drawBuildArea(){
  // The buildable-zone perimeter is a placement aid, not permanent landscape.
  // Include every construction tool used by the current Builder (including
  // industry sites and the bridge/moat crossing palette).
  if(!['well','tower','gate','civic','linear','industry','crossing'].includes(State.tool?.kind))return;
  const pts=projectPath([{x:BUILD_MIN,y:BUILD_MIN},{x:BUILD_MAX,y:BUILD_MIN},{x:BUILD_MAX,y:BUILD_MAX},{x:BUILD_MIN,y:BUILD_MAX}]);
  ctx.save();ctx.fillStyle='rgba(224,138,60,.028)';pathPolygon(pts,'rgba(224,138,60,.028)',null);ctx.strokeStyle='rgba(224,138,60,.9)';ctx.lineWidth=2;ctx.setLineDash([8,7]);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  const label=w2s({x:BUILD_MIN,y:BUILD_MIN});ctx.fillStyle='rgba(242,230,211,.72)';ctx.font='11px system-ui';ctx.fillText('BUILDABLE 100×100U',label.x+8,label.y+15);ctx.restore();
}
