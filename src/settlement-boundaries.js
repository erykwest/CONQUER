'use strict';
// SVG bushes from the user's Drive / Bushes folder; decoded once, ground-cached.
const BOUNDARY_BUSH_ASSETS=Object.freeze([
  'bush_01_tondo.svg','bush_02_globulare.svg','bush_03_stratificato_globulare.svg',
  'bush_04_largo.svg','bush_05_asimmetrico.svg','bush_06_multilobato.svg','bush_07_spinoso.svg'
]);
// winter = snowy, bare = leafless brown twigs (winter without snow), blizzard = snow-laden, spring = flowering.
const BOUNDARY_BUSH_LOOKS=['summer','autumn','winter','bare','blizzard'];
const boundaryBushSprites={summer:[],autumn:[],winter:[],bare:[],blizzard:[],spring:[]};
// Which bush sprite set a bush uses. Early March keeps leafless twigs; spring gets the flowering set.
function bushSeasonKey(){
  if(treesBare())return'bare';
  if(State.season==='spring')return(boundaryBushSprites.spring&&boundaryBushSprites.spring.length)?'spring':'summer';
  return typeof foliageLook==='function'?foliageLook():'summer';
}
function buildBoundaryBushSvg(source,season){
  // Spring foliage is a fresher, lighter green than summer; blossoms are stippled on afterwards.
  const colors={summer:'#527641',autumn:'#827044',winter:'#c7d1b9',bare:'#6e5a44',blizzard:'#6e5a44',spring:'#6fa348'};
  return source.replace('viewBox="0 0 1024 1024"','viewBox="64 260 920 580"')
    .replace('width="1024"','width="920"').replace('height="1024"','height="580"')
    // Leafless winter (bare / blizzard): no crown at all, only the twigs.
    .replace(/fill="#3B5174"/gi,season==='bare'||season==='blizzard'?'fill="#3B5174" fill-opacity="0"':'fill="#3B5174"')
    .replace(/#3B5174/gi,colors[season]||colors.summer).replace(/#9BBACE/gi,'#2B1D16');
}
// Spring bushes flower: each bush gets round blossom DOTS all in ONE colour, and the colour
// differs from bush shape to bush shape (7 shapes -> 7 colours). A loaded bush image is composited
// into a 920x580 canvas and the dots land only on opaque (foliage) pixels. Seeded, so it is stable.
const SPRING_BLOSSOM_PALETTE=['#e24b4b','#ef9a3d','#f2d33a','#fdfdf5','#ef6fb0','#a86fe0','#5aa9e6'];
const SPRING_VARIANTS=12;
const boundaryBushSpringVariants={};
// Same bush sprite for every bush of a shape would repeat the dot pattern; each variant gets its own layout.
function springBushImg(shape,p){
  const v=boundaryBushSpringVariants[shape];
  if(!v)return boundaryBushSprites.summer?.[shape]||null;
  return v[springBushVariantIndex(p)];
}
// Shared by the 2D draw and the 3D atlas, so both pick the same variant for the same bush.
function springBushVariantIndex(p){return biomeHash('bv|'+Math.round(p.x*100)+'|'+Math.round(p.y*100))%SPRING_VARIANTS}
function paintSpringBlossoms(img,colorIndex=0,maxYFrac=0.82,variant=0){
  const w=img.naturalWidth||920,h=img.naturalHeight||580,c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(img,0,0,w,h);
  let data=null;try{data=g.getImageData(0,0,w,h).data}catch{return img}
  const color=SPRING_BLOSSOM_PALETTE[colorIndex%SPRING_BLOSSOM_PALETTE.length];
  const rnd=seedRand((0x9e3a77b1^Math.imul(colorIndex+1,2654435761)^Math.imul(variant+1,0x85ebca6b))>>>0);
  // In-game a whole bush is only ~10-40px wide (this sprite is 920px, so it is scaled down ~25x).
  // The dots must be HUGE in sprite space (~6-12% of the width) to survive as a few visible blobs.
  let placed=0,tries=0;
  while(placed<20&&tries<1600){
    tries++;
    const x=Math.floor(rnd()*w),y=Math.floor(rnd()*(h*maxYFrac));
    if(data[(y*w+x)*4+3]<140)continue;            // centre must sit on the bush body
    const s=w*0.035*(0.85+rnd()*0.3);             // ~3.5% of sprite width (was 5%: -30%)
    g.globalAlpha=0.95+rnd()*0.05;
    g.fillStyle=color;                            // one solid colour for the whole bush
    g.beginPath();g.arc(x,y,s,0,Math.PI*2);g.fill();
    placed++;
  }
  g.globalAlpha=1;return c;
}
async function loadBoundaryBushSprites(){
  const sources=await Promise.allSettled(BOUNDARY_BUSH_ASSETS.map(async name=>{
    const r=await fetch('./src/assets/bushes/'+name+'?v=bark1');if(!r.ok)throw new Error('Bush SVG '+r.status+' '+name);return r.text();
  }));
  const jobs=[];
  for(let shape=0;shape<sources.length;shape++){
    if(sources[shape].status!=='fulfilled'){console.warn('Bush SVG load failed',BOUNDARY_BUSH_ASSETS[shape]);continue}
    for(const season of [...BOUNDARY_BUSH_LOOKS,'spring'])jobs.push(new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{
        if(season==='spring'){
          boundaryBushSpringVariants[shape]=Array.from({length:SPRING_VARIANTS},(_,v)=>paintSpringBlossoms(img,shape,0.82,v));
          boundaryBushSprites.spring[shape]=boundaryBushSpringVariants[shape][0];
        }else
          // Blizzard bushes: bare twigs plus the snow retino on their top band.
          boundaryBushSprites[season][shape]=season==='blizzard'&&typeof snowCapSprite==='function'?snowCapSprite(img,.3):img;
        resolve();
      };img.onerror=()=>resolve();
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(buildBoundaryBushSvg(sources[shape].value,season));
    }));
  }
  await Promise.all(jobs);
  invalidateSceneCache();if(typeof draw==='function')draw();
}
function urbanHedgeBushes({a,b}){
  const L=dist(a,b),count=Math.max(1,Math.ceil(L/.42)),key=urbanBoundaryKey(a,b);
  // Centres and width stay within the surviving interval, preserving gates.
  return Array.from({length:count},(_,i)=>{
    const t=(i+.5)/count,hash=biomeHash(State.seed+'|hedge|'+key+'|'+i);
    return{p:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},shape:hash%BOUNDARY_BUSH_ASSETS.length,
      width:Math.min(.68,L/count*1.4,2*Math.min(t*L,(1-t)*L)),scale:.9+((hash>>>8)%100)/500};
  }).sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
}
function drawUrbanHedge(edge){
  const season=bushSeasonKey();
  for(const bush of urbanHedgeBushes(edge)){
    const img=(season==='spring'?springBushImg(bush.shape,bush.p):boundaryBushSprites[season]?.[bush.shape])||boundaryBushSprites.summer?.[bush.shape],base=w2s(bush.p,.01);
    const width=bush.width*U*State.view.scale,height=width*580/920*bush.scale;
    if(img)ctx.drawImage(img,base.x-width/2,base.y-height*.97,width,height);
    else{ctx.fillStyle=season==='summer'||season==='autumn'?'#527641':'#c7d1b9';ctx.beginPath();ctx.ellipse(base.x,base.y-height/2,width/2,height/2,0,0,Math.PI*2);ctx.fill()}
  }
}
loadBoundaryBushSprites().catch(err=>console.warn('Boundary bushes unavailable',err));
