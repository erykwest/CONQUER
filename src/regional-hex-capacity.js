'use strict';
// Staggered/triangular Voronoi lattice from the original World Lab, with
// area-balancing power weights: every complete macro territory stays within
// ±10% of the overall average. The grid is HEXAGONAL, never square.
(function(root){
  const EPS=1e-8;
  const area=poly=>{
    if(!poly||poly.length<3)return 0;
    let twice=0;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      twice+=a.x*b.y-b.x*a.y;
    }
    return Math.abs(twice)*.5;
  };
  function clip(poly,a,b,c){
    const result=[];
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length];
      const dp=a*p.x+b*p.y-c,dq=a*q.x+b*q.y-c;
      const ip=dp<=EPS,iq=dq<=EPS;
      if(ip!==iq){
        const t=Math.max(0,Math.min(1,dp/(dp-dq)));
        result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
      }
      if(iq)result.push(q);
    }
    return result.filter((p,i)=>{
      const previous=result[(i+result.length-1)%result.length];
      return (p.x-previous.x)**2+(p.y-previous.y)**2>1e-14;
    });
  }
  function generate(sites,config){
    const {finalCols:cols,finalRows:rows,width,height}=config;
    if(!Array.isArray(sites)||sites.length!==cols*rows||sites.length===0)
      throw Error('Expected exactly one Voronoi site per hexagonal territory');
    const average=width*height/sites.length;
    const stepX=width/(cols+.5),stepY=height/rows;
    const anchors=sites.map(s=>({
      x:stepX*(s.macroCol+.5+((s.macroRow&1)*.5)),
      y:stepY*(s.macroRow+.5)
    }));
    const bySlot=new Map(sites.map((site,i)=>[site.macroRow+','+site.macroCol,i]));
    const neighbors=sites.map((site,i)=>{
      const nearby=[];
      for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
        const j=bySlot.get((site.macroRow+dr)+','+(site.macroCol+dc));
        if(j!==undefined&&j!==i)nearby.push(j);
      }
      return nearby;
    });
    const bounds=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
    // Never remove alternate-row staggering. For very strong deformation,
    // gently scale back random displacement before permitting a bad area.
    for(const jitterScale of [1,.75,.5,.3,0]){
      const points=sites.map((site,i)=>({
        ...site,
        x:anchors[i].x+jitterScale*(site.x-anchors[i].x),
        y:anchors[i].y+jitterScale*(site.y-anchors[i].y)
      }));
      const weights=new Float64Array(points.length);
      for(let iteration=0;iteration<45;iteration++){
        const polygons=points.map((point,i)=>{
          let polygon=bounds;
          for(const j of neighbors[i]){
            const other=points[j];
            polygon=clip(polygon,
              2*(other.x-point.x),2*(other.y-point.y),
              other.x**2+other.y**2-point.x**2-point.y**2+
                weights[i]-weights[j]);
            if(polygon.length<3)break;
          }
          return polygon;
        });
        const areas=polygons.map(area);
        const maxDeviation=Math.max(...areas.map(a=>Math.abs(a/average-1)));
        const totalArea=areas.reduce((sum,a)=>sum+a,0);
        if(maxDeviation<=.095&&
           Math.abs(totalArea-width*height)<=width*height*1e-7&&
           polygons.every(p=>p.length>=3)){
          return {
            cells:points.map((point,i)=>({...point,polygon:polygons[i]})),
            stats:{
              grid:'triangular-staggered-hex-voronoi',
              maxDeviation,
              minArea:Math.min(...areas),
              maxArea:Math.max(...areas),
              averageArea:average,
              totalArea,
              jitterScale,
              iterations:iteration
            }
          };
        }
        // Capacity relaxation: large polygons lose weight, small ones grow.
        for(let i=0;i<weights.length;i++)
          weights[i]-=(areas[i]-average)*.36;
      }
    }
    throw Error('Impossibile rispettare la superficie dei territori ±10%');
  }
  const api=Object.freeze({generate,area});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ConquerRegionalHexCapacity=api;
})(typeof window==='object'?window:{});
