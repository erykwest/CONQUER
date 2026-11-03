/**
 * /circle — deterministic grid topology (no browser, DOM or settlement globals).
 * The raster is an approximation for recognition, NOT a replacement for collision
 * tests, gate pathfinding, structural HP or combat territory control.
 */
const EPS = 1e-9;
const same = (a,b) => a === b;
const point = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
function inside(p, polygon) {
  let hit = false;
  for (let i=0,j=polygon.length-1; i<polygon.length; j=i++) {
    const a=polygon[i], b=polygon[j];
    if ((a.y>p.y)!==(b.y>p.y) &&
       p.x<(b.x-a.x)*(p.y-a.y)/((b.y-a.y)||EPS)+a.x) hit=!hit;
  }
  return hit;
}
function orientation(a,b,c) { return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x); }
function intersects(a,b,c,d) {
  const ab1=orientation(a,b,c), ab2=orientation(a,b,d);
  const cd1=orientation(c,d,a), cd2=orientation(c,d,b);
  return ab1*ab2<=EPS && cd1*cd2<=EPS &&
    Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)) <= Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+EPS &&
    Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)) <= Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+EPS;
}
function hitsCell(poly, left, top, step) {
  const right=left+step, bottom=top+step;
  const corners=[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
  if (corners.some(p=>inside(p,poly))) return true;
  if (poly.some(p=>p.x>=left-EPS&&p.x<=right+EPS&&p.y>=top-EPS&&p.y<=bottom+EPS)) return true;
  for (let i=0;i<poly.length;i++) {
    const a=poly[i], b=poly[(i+1)%poly.length];
    for(let j=0;j<4;j++) if(intersects(a,b,corners[j],corners[(j+1)%4])) return true;
  }
  return false;
}
function boundsOf(poly) {
  const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y);
  return {minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys)};
}
function rasterPoly(poly,mask,grid,value) {
  if (!Array.isArray(poly)||poly.length<3||!poly.every(point)) return;
  const {left,top,step,w,h}=grid, b=boundsOf(poly);
  const x0=Math.max(0,Math.floor((b.minX-left)/step)-1),x1=Math.min(w-1,Math.floor((b.maxX-left)/step)+1);
  const y0=Math.max(0,Math.floor((b.minY-top)/step)-1),y1=Math.min(h-1,Math.floor((b.maxY-top)/step)+1);
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
    if(hitsCell(poly,left+x*step,top+y*step,step))mask[y*w+x]=value;
  }
}
function segmentStrip(a,b,width) {
  if(!point(a)||!point(b))return null;
  const len=Math.hypot(b.x-a.x,b.y-a.y);
  if(len<EPS)return null;
  const dx=(b.y-a.y)*width/(2*len),dy=(a.x-b.x)*width/(2*len);
  return [{x:a.x+dx,y:a.y+dy},{x:b.x+dx,y:b.y+dy},
          {x:b.x-dx,y:b.y-dy},{x:a.x-dx,y:a.y-dy}];
}
function leftOf(index,grid){return grid.left+(index%grid.w+.5)*grid.step}
function topOf(index,grid){return grid.top+(Math.floor(index/grid.w)+.5)*grid.step}
function signedArea(poly) {
  return poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p.x*q.y-q.x*p.y},0)/2;
}
function outline(label,region,grid) {
  const {w,h,left,top,step}=grid, edges=new Map();
  const push=(x,y,nx,ny)=>{const k=x+','+y;if(!edges.has(k))edges.set(k,[]);edges.get(k).push([nx,ny])};
  for(const idx of region.cells) {
    const x=idx%w,y=(idx/w)|0;
    if(y===0||label[idx-w]!==region.code)push(x,y,x+1,y);
    if(x===w-1||label[idx+1]!==region.code)push(x+1,y,x+1,y+1);
    if(y===h-1||label[idx+w]!==region.code)push(x+1,y+1,x,y+1);
    if(x===0||label[idx-1]!==region.code)push(x,y+1,x,y);
  }
  const loops=[];
  for(const [key] of edges)while((edges.get(key)||[]).length) {
    let [x,y]=key.split(',').map(Number),start=key,polygon=[],limit=0;
    do {
      polygon.push({x:left+x*step,y:top+y*step});
      const next=edges.get(x+','+y);
      if(!next?.length)break;
      const [nx,ny]=next.pop();
      x=nx;y=ny;
    }while(x+','+y!==start&&++limit<w*h*4);
    if(x+','+y===start&&polygon.length>=3) {
      const simplified=polygon.filter((p,i)=>{
        const a=polygon[(i+polygon.length-1)%polygon.length],b=polygon[(i+1)%polygon.length];
        return Math.abs(orientation(a,p,b))>EPS;
      });
      if(simplified.length>=3)loops.push(simplified);
    }
  }
  loops.sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
  return loops;
}
/**
 * @param {object} source
 * bounds {minX,minY,maxX,maxY}, cellSize, fortifications [{id,polygon}],
 * natural [{id,polygon}], naturalCuts [{id,polygon}],
 * terrainBarriers [{id,polygon}], crossings [{id,polygon}], gates
 * [{id,sideA,sideB,open}], mastioPoint {x,y}, minArea.
 *
 * Open gates still seal the *defensive boundary*; open is route accessibility.
 * Natural obstacles are carved only at explicit passable crossings.
 */
export function detectDefensiveCompartments(source={}) {
  const b=source.bounds||{minX:50,minY:50,maxX:150,maxY:150};
  const step=source.cellSize??.25;
  if(!(Number.isFinite(step)&&step>0&&Number.isFinite(b.minX)&&Number.isFinite(b.minY)&&
    b.maxX>b.minX&&b.maxY>b.minY))throw new TypeError('Invalid circle grid');
  const w=Math.ceil((b.maxX-b.minX)/step),h=Math.ceil((b.maxY-b.minY)/step);
  if(w*h>1_000_000)throw new RangeError('Circle grid too large');
  const grid={left:b.minX,top:b.minY,step,w,h};
  const naturalMask=new Uint8Array(w*h),blocked=new Uint8Array(w*h);
  for(const natural of source.natural||[])rasterPoly(natural.polygon,naturalMask,grid,1);
  // Flat H0 edits cancel older natural relief, then expose any surviving
  // vertical faces of their own. Bridges carve traversable corridors last.
  for(const cut of source.naturalCuts||[])rasterPoly(cut.polygon,naturalMask,grid,0);
  // Seas/mountain barriers do not disappear merely because a slope is flattened.
  for(const natural of source.invariantNatural||[])rasterPoly(natural.polygon,naturalMask,grid,1);
  for(const edge of source.terrainBarriers||[])rasterPoly(edge.polygon,naturalMask,grid,1);
  for(const crossing of source.crossings||[])if(crossing.open!==false)
    rasterPoly(crossing.polygon,naturalMask,grid,0);
  blocked.set(naturalMask);
  for(const part of source.fortifications||[])rasterPoly(part.polygon,blocked,grid,1);
  const labels=new Int32Array(w*h).fill(-1),regions=[],queue=new Int32Array(w*h);
  for(let first=0;first<blocked.length;first++){
    if(blocked[first]||labels[first]!==-1)continue;
    const code=regions.length,region={code,cells:[],edge:false,sumX:0,sumY:0};
    let read=0,write=0;queue[write++]=first;labels[first]=code;
    while(read<write){
      const idx=queue[read++],x=idx%w,y=(idx/w)|0;
      region.cells.push(idx);region.sumX+=x+.5;region.sumY+=y+.5;
      if(x===0||y===0||x===w-1||y===h-1)region.edge=true;
      const n=[x>0?idx-1:-1,x<w-1?idx+1:-1,y>0?idx-w:-1,y<h-1?idx+w:-1];
      for(const next of n)if(next>=0&&!blocked[next]&&labels[next]===-1){
        labels[next]=code;queue[write++]=next;
      }
    }
    regions.push(region);
  }
  const regionAt=(p)=>{
    if(!point(p))return -1;
    const x=Math.floor((p.x-grid.left)/step),y=Math.floor((p.y-grid.top)/step);
    return x>=0&&y>=0&&x<w&&y<h&&!blocked[y*w+x]?labels[y*w+x]:-1;
  };
  const barrierLinks=new Map(),passageLinks=new Map();
  function link(map,a,b,info=null){
    if(a<0||b<0||a===b)return;
    const key=Math.min(a,b)+':'+Math.max(a,b);
    if(!map.has(key))map.set(key,{a:Math.min(a,b),b:Math.max(a,b),gates:[]});
    if(info)map.get(key).gates.push(info);
  }
  // Look across solid strips (including 2U towers): local adjacency only,
  // never a global connection between walls merely sharing a junction.
  const scan=(x,y,dx,dy)=>{
    for(let k=1;k<=Math.ceil(3/step);k++){
      const nx=x+dx*k,ny=y+dy*k;
      if(nx<0||ny<0||nx>=w||ny>=h)return -1;
      const idx=ny*w+nx;
      if(!blocked[idx])return labels[idx];
    }
    return -1;
  };
  for(let idx=0;idx<blocked.length;idx++)if(blocked[idx]){
    const x=idx%w,y=(idx/w)|0;
    link(barrierLinks,scan(x,y,-1,0),scan(x,y,1,0));
    link(barrierLinks,scan(x,y,0,-1),scan(x,y,0,1));
  }
  // A gate has two distinct mouths: a gate may be open, shut, or breached.
  // It is never itself an instruction to conquer a sector.
  function findMouth(p,from) {
    const dx=p.x-from.x,dy=p.y-from.y,L=Math.hypot(dx,dy)||1;
    for(let i=0;i<=Math.ceil(2/step);i++){
      const at={x:p.x+dx/L*i*step,y:p.y+dy/L*i*step},code=regionAt(at);
      if(code>=0)return code;
    }
    return -1;
  }
  for(const gate of source.gates||[])if(point(gate.sideA)&&point(gate.sideB)){
    const mid={x:(gate.sideA.x+gate.sideB.x)/2,y:(gate.sideA.y+gate.sideB.y)/2};
    const a=findMouth(gate.sideA,mid),b=findMouth(gate.sideB,mid);
    if(a>=0&&b>=0&&a!==b) {
      link(passageLinks,a,b,{id:gate.id,open:gate.open===true});
      link(barrierLinks,a,b);
    }
  }
  const neighborGraph=new Map(regions.map(r=>[r.code,new Set()]));
  for(const {a,b} of barrierLinks.values()){
    neighborGraph.get(a).add(b);neighborGraph.get(b).add(a);
  }
  const depth=new Map(),frontier=[];
  for(const r of regions)if(r.edge){depth.set(r.code,0);frontier.push(r.code)}
  for(let i=0;i<frontier.length;i++){
    const from=frontier[i],d=depth.get(from);
    for(const to of neighborGraph.get(from)||[])if(!depth.has(to)){
      depth.set(to,d+1);frontier.push(to);
    }
  }
  // Regions without a detectable exterior wall contact are not promoted
  // beyond one layer by guesswork.
  const areas=regions.filter(r=>!r.edge&&r.cells.length*step*step >= (source.minArea??1));
  const ids=new Map(areas.map(r=>[r.code,'circle-'+r.code]));
  const portalAdj=new Map(areas.map(r=>[r.code,new Set()]));
  for(const {a,b} of passageLinks.values()){
    if(ids.has(a)&&ids.has(b)){portalAdj.get(a).add(ids.get(b));portalAdj.get(b).add(ids.get(a))}
  }
  let mastioCode=regionAt(source.mastioPoint);
  const compartments=areas.map(r=>{
    const loops=outline(labels,r,grid),area=r.cells.length*step*step;
    return{
      id:ids.get(r.code),code:r.code,polygon:loops[0]||[],
      boundaries:loops,area,depth:Math.max(1,depth.get(r.code)??1),
      adjacentIds:[...portalAdj.get(r.code)].sort(),
      mastio:r.code===mastioCode,state:'unassessed',
      centroid:{x:grid.left+r.sumX/r.cells.length*step,y:grid.top+r.sumY/r.cells.length*step},
      // Anchors are guaranteed passable sector cells; a centroid could lie
      // inside a nested keep's hole, so it cannot identify a lost outer ring.
      anchors:[0,.25,.5,.75,1].map(t=>{
        const index=r.cells[Math.min(r.cells.length-1,Math.floor(t*(r.cells.length-1)))];
        return{x:leftOf(index,grid),y:topOf(index,grid)};
      })
    };
  });
  const compAt=(p)=>ids.get(regionAt(p))||null;
  const portals=[...passageLinks.values()].flatMap(link=>link.gates.map(g=>({
    ...g,from:ids.get(link.a)||null,to:ids.get(link.b)||null,
    exterior:regions[link.a].edge||regions[link.b].edge
  })));
  return{compartments,portals,
    cellSize:step,bounds:{...b},sectorAt:compAt,
    stats:{gridCells:w*h,blockedCells:blocked.reduce((a,n)=>a+n,0),
      regions:regions.length,exteriors:regions.filter(r=>r.edge).length,
      compartments:compartments.length}};
}
/** Safe-adjacent fallback via *open* gates, never a teleport across walls. */
export function findNextCircleRefuge(fromId, snapshot, stateFor=()=> 'unassessed') {
  if(!fromId||!snapshot?.compartments)return null;
  const sectors=new Map(snapshot.compartments.map(c=>[c.id,c]));
  if(!sectors.has(fromId))return null;
  const queue=[fromId],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){
    const here=queue[i];
    const neighbors=snapshot.portals.filter(p=>p.open&&(p.from===here||p.to===here))
      .map(p=>p.from===here?p.to:p.from).filter(id=>id&&sectors.has(id));
    for(const next of neighbors){
      if(seen.has(next))continue;seen.add(next);
      if(['secure','alert'].includes(stateFor(next)))return next;
      queue.push(next);
    }
  }
  return null;
}
