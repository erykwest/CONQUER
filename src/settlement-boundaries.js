'use strict';
// SVG bushes from the user's Drive / Bushes folder; decoded once, ground-cached.
const BOUNDARY_BUSH_ASSETS=Object.freeze([
  'bush_01_tondo.svg','bush_02_globulare.svg','bush_03_stratificato_globulare.svg',
  'bush_04_largo.svg','bush_05_asimmetrico.svg','bush_06_multilobato.svg','bush_07_spinoso.svg'
]);
const boundaryBushSprites={summer:[],autumn:[],winter:[]};
function buildBoundaryBushSvg(source,season){
  const colors={summer:'#527641',autumn:'#827044',winter:'#c7d1b9'};
  return source.replace('viewBox="0 0 1024 1024"','viewBox="64 260 920 580"')
    .replace('width="1024"','width="920"').replace('height="1024"','height="580"')
    .replace(/#3B5174/gi,colors[season]||colors.summer).replace(/#9BBACE/gi,'#73604a');
}
async function loadBoundaryBushSprites(){
  const sources=await Promise.allSettled(BOUNDARY_BUSH_ASSETS.map(async name=>{
    const r=await fetch('./src/assets/bushes/'+name);if(!r.ok)throw new Error('Bush SVG '+r.status+' '+name);return r.text();
  }));
  const jobs=[];
  for(let shape=0;shape<sources.length;shape++){
    if(sources[shape].status!=='fulfilled'){console.warn('Bush SVG load failed',BOUNDARY_BUSH_ASSETS[shape]);continue}
    for(const season of ['summer','autumn','winter'])jobs.push(new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{boundaryBushSprites[season][shape]=img;resolve()};img.onerror=()=>resolve();
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(buildBoundaryBushSvg(sources[shape].value,season));
    }));
  }
  await Promise.all(jobs);
  invalidateSceneCache('ground');if(typeof draw==='function')draw();
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
  const season=State.season==='autumn'?'autumn':State.season==='winter'?'winter':'summer';
  for(const bush of urbanHedgeBushes(edge)){
    const img=boundaryBushSprites[season][bush.shape],base=w2s(bush.p,.01);
    const width=bush.width*U*State.view.scale,height=width*580/920*bush.scale;
    if(img)ctx.drawImage(img,base.x-width/2,base.y-height*.97,width,height);
    else{ctx.fillStyle=season==='winter'?'#c7d1b9':'#527641';ctx.beginPath();ctx.ellipse(base.x,base.y-height/2,width/2,height/2,0,0,Math.PI*2);ctx.fill()}
  }
}
loadBoundaryBushSprites().catch(err=>console.warn('Boundary bushes unavailable',err));
