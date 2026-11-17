'use strict';
// Twenty irregular hex-like Voronoi microcells per SQUARE logical territory.
// The outer territory polygon is their exact aggregate boundary. Logical Moore
// neighbors remain independent of these polygons.
(function(root){
  const round=v=>Math.round(v*1e5);
  const key=p=>round(p.x)+','+round(p.y);
  function rng(seed){let v=seed>>>0;return()=>{v+=0x6D2B79F5;let t=v;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function signedArea(poly){let a=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p.x*q.y-q.x*p.y}return a*.5}
  const area=poly=>Math.abs(signedArea(poly));
  function clip(poly,a,b,c){const arr=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p.x+b*p.y-c,dq=a*q.x+b*q.y-c,ip=dp<=1e-8,iq=dq<=1e-8;if(ip!==iq){const t=Math.max(0,Math.min(1,dp/(dp-dq)));arr.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}if(iq)arr.push(q)}return arr.filter((p,i)=>{const q=arr[(i+arr.length-1)%arr.length];return(p.x-q.x)**2+(p.y-q.y)**2>1e-14})}
  function siteSeeds(seed,config){
    const {finalRows:rows,finalCols:cols,width,height}=config,dx=width/(cols*5),dy=height/(rows*4),sites=[];
    const deformation=Math.max(0,Math.min(360,Number(config.deformation??150)));
    const jitter=.26+.20*deformation/360;
    for(let row=0;row<rows*4;row++)for(let col=0;col<cols*5;col++){
      const macroRow=Math.floor(row/4),macroCol=Math.floor(col/5),macroId=config.territoryPlan.slotAssignments.get(macroRow+','+macroCol)?.id;
      if(macroId===undefined)throw Error('Missing logical square center at '+macroRow+','+macroCol);
      const r=rng((seed^Math.imul(row+2197,0x9e3779b1)^Math.imul(col+4901,0x85ebca77))>>>0);
      const scale=.5+r(); // Requested individual size multiplier: 50% ... 150%.
      const x=(col+.5+(row%2)*.5)*dx+(r()-.5)*dx*jitter;
      const y=(row+.5)*dy+(r()-.5)*dy*jitter;
      sites.push({id:sites.length,macroId,macroRow,macroCol,row,col,x,y,
        scale,basePower:(scale-1)*dx*dy*.5});
    }
    return sites;
  }
  function microVoronoi(sites,config,macroWeights){
    const rows=config.finalRows*4,cols=config.finalCols*5;
    const bounds=[{x:0,y:0},{x:config.width,y:0},{x:config.width,y:config.height},{x:0,y:config.height}];
    return sites.map(site=>{
      let poly=bounds;
      const weight=site.basePower+macroWeights[site.macroId];
      for(let dr=-2;dr<=2&&poly.length>=3;dr++)for(let dc=-2;dc<=2&&poly.length>=3;dc++){
        const row=site.row+dr,col=site.col+dc;
        if(row<0||col<0||row>=rows||col>=cols||!(dr||dc))continue;
        const other=sites[row*cols+col];
        poly=clip(poly,2*(other.x-site.x),2*(other.y-site.y),
          other.x**2+other.y**2-site.x**2-site.y**2+weight-other.basePower-macroWeights[other.macroId]);
      }
      return {...site,polygon:poly,baseSides:poly.length};
    });
  }
  function outerBoundary(group){
    const edges=new Map();
    for(const cell of group){
      const p=cell.polygon;if(!p||p.length<3)continue;
      for(let i=0;i<p.length;i++){
        const a=p[i],b=p[(i+1)%p.length],ak=key(a),bk=key(b);
        if(ak===bk)continue;
        const k=ak<bk?ak+'|'+bk:bk+'|'+ak;
        if(edges.has(k))edges.delete(k);
        else edges.set(k,{a,b,ak,bk});
      }
    }
    const starts=new Map();
    for(const edge of edges.values()){
      if(!starts.has(edge.ak))starts.set(edge.ak,[]);
      starts.get(edge.ak).push(edge);
    }
    const loops=[],unused=new Set(edges.values());
    while(unused.size){
      const first=unused.values().next().value;
      const vertices=[],startKey=first.ak;
      let cursor=first,closed=false;
      for(let i=0;i<=edges.size;i++){
        if(!unused.has(cursor))break;
        unused.delete(cursor);vertices.push(cursor.a);
        if(cursor.bk===startKey){closed=true;break;}
        const next=(starts.get(cursor.bk)||[]).find(e=>unused.has(e));
        if(!next)break;
        cursor=next;
      }
      if(closed)loops.push(vertices);
    }
    const sorted=loops.sort((a,b)=>area(b)-area(a));
    return {polygon:sorted[0]||[],loops:sorted.length,
      totalLoopsArea:sorted.reduce((n,p)=>n+area(p),0)};
  }
  // Fivefold displacement (vs. former random fine-site offset), applied as
  // two smooth shears to the ACTUAL Voronoi vertices. The logical centers do
  // not move. Both shears vanish at the finite map boundary, preserving extent.
  // A vertex-shared transform keeps every river/border/ownership seam exact.
  function deformFineCells(cells,config,seed,amplitude){
    if(!amplitude)return cells;
    const width=config.width,height=config.height;
    const periodX=width/config.finalCols*.98;
    const periodY=height/config.finalRows*.98;
    const phaseX=(seed%97)*Math.PI*2/97,phaseY=(seed%89)*Math.PI*2/89;
    const cache=new Map();
    const transform=p=>{
      const id=key(p);
      if(cache.has(id))return cache.get(id);
      const x=p.x+amplitude*Math.sin(p.y*2*Math.PI/periodY+phaseX)*
        Math.sin(Math.PI*p.x/width);
      const y=p.y+amplitude*Math.sin(x*2*Math.PI/periodX+phaseY)*
        Math.sin(Math.PI*p.y/height);
      const result={x:Math.max(0,Math.min(width,x)),
                    y:Math.max(0,Math.min(height,y))};
      cache.set(id,result);
      return result;
    };
    // A strong warp can curve a long Voronoi edge enough that the chord
    // between its deformed endpoints would cut across another edge. Sample
    // every shared edge consistently before warping. This prevents geometric
    // foldovers while keeping each subcell and shared border connected.
    const maxSegment=Math.min(
      config.width/config.finalCols,config.height/config.finalRows)/10;
    return cells.map(cell=>{
      const polygon=[];
      const original=cell.polygon;
      for(let i=0;i<original.length;i++){
        const a=original[i],b=original[(i+1)%original.length];
        const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/maxSegment));
        for(let j=0;j<n;j++){
          const u=j/n;
          polygon.push(transform({
            x:a.x+(b.x-a.x)*u,
            y:a.y+(b.y-a.y)*u
          }));
        }
      }
      return {...cell,polygon};
    });
  }
  function simplePolygon(poly){
    // Large waves can make a straight approximation of a shared curved edge
    // cross another nonadjacent edge. Reject that amplitude and back off
    // rather than publishing self-intersecting polygons or visual cracks.
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      for(let j=i+2;j<poly.length;j++){
        if(i===0&&j===poly.length-1)continue;
        const c=poly[j],d=poly[(j+1)%poly.length];
        const u=cross(a,b,c),v=cross(a,b,d),
              w=cross(c,d,a),z=cross(c,d,b);
        if(((u>1e-7&&v< -1e-7)||(u< -1e-7&&v>1e-7))&&
           ((w>1e-7&&z< -1e-7)||(w< -1e-7&&z>1e-7)))
          return false;
      }
    }
    return true;
  }
  function generate(seed,config){
    const n=config.finalCols*config.finalRows;
    const target=config.width*config.height/n;
    const unit=target/20;
    // A rare random micro-site configuration can create a disconnected
    // sliver or a vanishing cell. Reseed ONLY the fine geometry, deterministically
    // from the original world seed, never changing square topology or terrain.
    for(let attempt=0;attempt<5;attempt++){
      const microSeed=(seed^Math.imul(attempt,0x9e3779b1))>>>0;
      const sites=siteSeeds(microSeed,config);
      const weights=Array(n).fill(0);
      let fine,macroArea,iteration=0,maxDeviation=Infinity;
      for(;iteration<32;iteration++){
        fine=microVoronoi(sites,config,weights);
        macroArea=Array(n).fill(0);
        for(const cell of fine)macroArea[cell.macroId]+=area(cell.polygon);
        maxDeviation=Math.max(...macroArea.map(a=>Math.abs(a/target-1)));
        if(maxDeviation<=.08)break;
        for(let i=0;i<n;i++)weights[i]-=(macroArea[i]/target-1)*unit*2;
      }
      if(maxDeviation>.10||fine.some(c=>c.polygon.length<3||area(c.polygon)<=0))
        continue;
      // Original site jitter radius is 0.5 * jitter * microcell spacing.
      // A factor of five is deliberately applied to the rendered Voronoi
      // contour, not to site ordering (which would make polygons overlap).
      const density=config.deformation??150;
      const jitter=.26+.20*Math.max(0,Math.min(360,Number(density)))/360;
      const amp5=5*jitter*(config.width/(config.finalCols*5))*.5;
      for(const factor of [1,.9,.8,.7,.6,.5,.4,.25,0]){
        const amplitude=amp5*factor;
        const warped=deformFineCells(fine,config,microSeed,amplitude);
        const areas=Array(n).fill(0);
        const groups=Array.from({length:n},()=>[]);
        let invalid=false;
        for(const c of warped){
          const a=area(c.polygon);
          if(c.polygon.length<3||!Number.isFinite(a)||a<=1e-4||!simplePolygon(c.polygon)){
            invalid=true;break;
          }
          areas[c.macroId]+=a;
          groups[c.macroId].push(c);
        }
        if(invalid||groups.some(g=>g.length!==20))continue;
        const visualDeviation=Math.max(...areas.map(a=>Math.abs(a/target-1)));
        if(visualDeviation>.099)continue;
        const macroPolys=groups.map(group=>outerBoundary(group));
        const boundaryAreaError=Math.max(...macroPolys.map((p,id)=>
          Math.abs(area(p.polygon)-areas[id])/target));
        if(macroPolys.some(x=>x.loops!==1)||boundaryAreaError>1e-6)
          continue;
        const cells=macroPolys.map((entry,id)=>({
          id,macroId:id,macroRow:groups[id][0].macroRow,
          macroCol:groups[id][0].macroCol,localIndex:0,
          polygon:entry.polygon,microCount:20
        }));
        return {cells,fineCells:warped,stats:{
          maxDeviation:visualDeviation,iteration,attempt,
          areaMin:Math.min(...areas)/target,areaMax:Math.max(...areas)/target,
          boundaryAreaError,avgFineArea:unit,minScale:.5,maxScale:1.5,
          macroVerticesMin:Math.min(...cells.map(c=>c.polygon.length)),
          macroVerticesMax:Math.max(...cells.map(c=>c.polygon.length)),
          deformationMultiplier:5,warpAmplitude:amplitude,
          nominalWarpAmplitude:amp5,warpFactor:factor
        }};
      }
    }
    throw Error('Could not aggregate twenty Voronoi subcells per territory without invalid edges');
  }
  const api=Object.freeze({generate,siteSeeds,microVoronoi,outerBoundary,area});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ConquerRegionalHexAggregation=api;
})(typeof window==='object'?window:{});
