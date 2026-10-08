'use strict';
// Seeded, cached forest billboards. Seven SVG canopy silhouettes share seven Image objects.
const CONQUER_TREE_CROWNS=[
  '<ellipse cx="32" cy="28" rx="25" ry="21"/>',
  '<ellipse cx="32" cy="27" rx="18" ry="25"/>',
  '<path d="M32 3 C11 18 8 34 15 43 Q32 56 49 43 C57 32 49 16 32 3Z"/>',
  '<path d="M32 4 Q47 17 52 39 Q40 50 32 47 Q20 51 12 39 Q17 17 32 4Z"/>',
  '<path d="M9 33 Q7 14 23 14 Q30 2 40 13 Q58 10 57 31 Q56 49 38 49 Q18 53 9 33Z"/>',
  '<path d="M32 5 Q45 16 43 24 Q56 31 48 42 Q32 52 16 42 Q8 30 21 24 Q19 15 32 5Z"/>',
  '<path d="M32 5 C36 16 50 14 50 28 C57 39 47 48 32 48 C17 48 7 39 14 28 C14 15 28 16 32 5Z"/>'
];
const CONQUER_TREE_IMAGES=CONQUER_TREE_CROWNS.map((shape,i)=>{
  const colors=['#415b2d','#334d27','#496332','#3a582d','#536838','#37512c','#47602d'];
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80"><ellipse cx="32" cy="74" rx="13" ry="3" fill="#14190e" opacity=".25"/><path d="M29 41 L28 72 Q32 76 36 72 L35 41Z" fill="#56402b"/><path d="M29 52 L19 35 M35 55 L45 34" stroke="#56402b" stroke-width="3" fill="none"/><g fill="'+colors[i]+'" stroke="#263b23" stroke-width="2.5">'+shape+'</g><path d="M18 28 Q28 13 40 20" stroke="#a3b775" opacity=".28" stroke-width="4" fill="none"/></svg>';
  const img=new Image();
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  img.onload=()=>{if(typeof invalidateSceneCache==='function')invalidateSceneCache('landscape');if(typeof draw==='function')draw()};
  return img;
});
let conquerForestCacheKey='',conquerForestInstances=[];
function conquerForestHash(n){n|=0;n=Math.imul(n^n>>>16,0x7feb352d);n=Math.imul(n^n>>>15,0x846ca68b);return(n^n>>>16)>>>0}
function conquerForestBuildInstances(){
  const forests=(State.environment||[]).filter(e=>e.type==='forest'&&Array.isArray(e.points)&&e.points.length>2);
  const key=[State.seed,State.biome,forests.length,...forests.map(e=>e.points.length+':'+e.points[0].x.toFixed(2)+':'+e.points[0].y.toFixed(2))].join('|');
  if(key===conquerForestCacheKey)return conquerForestInstances;
  conquerForestCacheKey=key;
  const trees=[];
  for(let k=0;k<forests.length;k++){
    const polygon=forests[k].points;
    const minX=Math.min(...polygon.map(p=>p.x)),maxX=Math.max(...polygon.map(p=>p.x));
    const minY=Math.min(...polygon.map(p=>p.y)),maxY=Math.max(...polygon.map(p=>p.y));
    const area=Math.max(0,(maxX-minX)*(maxY-minY));
    // Uniform grid with seeded jitter: no expensive rejection sampling at draw time.
    const step=1.65;
    for(let y=Math.floor(minY/step)*step;y<=maxY;y+=step){
      for(let x=Math.floor(minX/step)*step;x<=maxX;x+=step){
        const h=conquerForestHash((Math.floor(x/step)*73856093)^(Math.floor(y/step)*19349663)^(State.seed|0)^(k*83492791));
        if(h%100<19)continue;
        const px=x+((h&255)/255-.5)*step*.72;
        const py=y+(((h>>>8)&255)/255-.5)*step*.72;
        if(!pointInPolygon({x:px,y:py},polygon))continue;
        trees.push({x:px,y:py,variant:(h>>>16)%7,size:.8+((h>>>24)/255)*.5});
      }
    }
  }
  // Guardrail for large procedural worlds; deterministic thinning.
  conquerForestInstances=trees.length>4500?trees.filter((_,i)=>i%Math.ceil(trees.length/4500)===0):trees;
  return conquerForestInstances;
}
function drawForestBillboards(){
  const sprites=conquerForestBuildInstances();
  if(!sprites.length)return;
  const unit=Math.max(1,Math.hypot(w2s({x:1,y:0}).x-w2s({x:0,y:0}).x,w2s({x:1,y:0}).y-w2s({x:0,y:0}).y));
  const width=Math.max(2,unit*1.6),height=Math.max(3,unit*2.2);
  // Ground-to-top layering follows screen Y, and is rendered only into landscape cache.
  const projected=sprites.map(t=>({...t,screen:w2s({x:t.x,y:t.y})})).sort((a,b)=>a.screen.y-b.screen.y);
  for(const t of projected){
    const img=CONQUER_TREE_IMAGES[t.variant];
    if(!img.complete||!img.naturalWidth)continue;
    const w=width*t.size,h=height*t.size;
    ctx.drawImage(img,t.screen.x-w/2,t.screen.y-h*.91,w,h);
  }
  const perf=window.__conquerPerf||(window.__conquerPerf={});
  perf.forestBillboards=projected.length;
}
