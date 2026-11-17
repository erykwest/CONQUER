'use strict';
// Square O(1) Moore LOGIC, staggered/irregular Voronoi GEOMETRY.
// The two are independent. Balanced power cells preserve territory areas.
(function(root){
  const OFFSETS=Object.freeze([
    [-1,-1],[-1,0],[-1,1],
    [0,-1],[0,1],
    [1,-1],[1,0],[1,1]
  ]);
  const directions=Object.freeze(['NW','N','NE','W','E','SW','S','SE']);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function neighbors8(sites){
    const ids=new Map(sites.map(site=>[site.macroRow+','+site.macroCol,site.macroId]));
    return Object.fromEntries(sites.map(site=>[
      site.macroId,
      OFFSETS.map(([row,col])=>ids.get((site.macroRow+row)+','+(site.macroCol+col))??null)
    ]));
  }
  function area(poly){
    if(!poly||poly.length<3)return 0;
    let twice=0;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];
      twice+=a.x*b.y-b.x*a.y;
    }
    return Math.abs(twice)*.5;
  }
  function clip(poly,a,b,c){
    const next=[];
    for(let i=0;i<poly.length;i++){
      const u=poly[i],v=poly[(i+1)%poly.length];
      const du=a*u.x+b*u.y-c,dv=a*v.x+b*v.y-c;
      const uIn=du<=1e-8,vIn=dv<=1e-8;
      if(uIn!==vIn){
        const t=clamp(du/(du-dv),0,1);
        next.push({x:u.x+(v.x-u.x)*t,y:u.y+(v.y-u.y)*t});
      }
      if(vIn)next.push(v);
    }
    return next.filter((p,i)=>{
      const q=next[(i+next.length-1)%next.length];
      return (p.x-q.x)**2+(p.y-q.y)**2>1e-14;
    });
  }
  function polygons(sites,config,weights){
    const {finalRows:rows,finalCols:cols,width,height}=config;
    const lookup=new Map(sites.map((site,i)=>[site.macroRow+','+site.macroCol,i]));
    const bounds=[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
    return sites.map((site,i)=>{
      let polygon=bounds;
      // A bounded two-ring grid search includes every potentially competitive
      // power site at <=22% displacement and the calibrated weight range.
      for(let dr=-2;dr<=2&&polygon.length>=3;dr++)
        for(let dc=-2;dc<=2&&polygon.length>=3;dc++){
          const j=lookup.get((site.macroRow+dr)+','+(site.macroCol+dc));
          if(j===undefined||j===i)continue;
          const other=sites[j];
          polygon=clip(polygon,2*(other.x-site.x),2*(other.y-site.y),
            other.x**2+other.y**2-site.x**2-site.y**2+weights[i]-weights[j]);
        }
      return polygon;
    });
  }
  function nonMooreContacts(cells){
    // Physical Voronoi neighbors must remain a subset of the eight logical
    // Moore slots, even though most polygons have six (or more) sides.
    const edges=new Map();
    let incompatible=0;
    for(const site of cells){
      const poly=site.polygon;
      for(let i=0;i<poly.length;i++){
        const p=poly[i],q=poly[(i+1)%poly.length];
        const a=p.x.toFixed(3)+','+p.y.toFixed(3);
        const b=q.x.toFixed(3)+','+q.y.toFixed(3);
        const key=a<b?a+'|'+b:b+'|'+a;
        const previous=edges.get(key);
        if(previous===undefined){edges.set(key,site);continue;}
        if(Math.abs(site.macroRow-previous.macroRow)>1||
           Math.abs(site.macroCol-previous.macroCol)>1)incompatible++;
        edges.delete(key);
      }
    }
    return incompatible;
  }
  function balancedVoronoi(input,config){
    if(!input?.length||!config?.width||!config?.height)
      throw Error('Invalid region topology geometry');
    const target=config.width*config.height/input.length;
    const stepX=config.width/config.finalCols,stepY=config.height/config.finalRows;
    let sites,weights,polys,areas,maxDeviation,passes,shrinkApplied=1,invalidEdges=Infinity;
    // Target 3.5% rather than the outer ±10% allowance. The remaining margin
    // permits a small, continuous organic deformation in the 3D atlas while
    // guaranteeing its visual territory areas also stay within ±10%.
    // Scale displacement back only as an emergency fallback.
    for(const shrink of [1,.75,.5,.25,0]){
      shrinkApplied=shrink;
      // Never shrink back to square-site coordinates. Keep the staggered
      // Voronoi anchors and damp ONLY the random jitter if needed.
      sites=input.map(site=>{
        const anchorX=site.anchorX??(site.macroCol+.5)*stepX;
        const anchorY=site.anchorY??(site.macroRow+.5)*stepY;
        return {...site,
          x:anchorX+(site.x-anchorX)*shrink,
          y:anchorY+(site.y-anchorY)*shrink};
      });
      weights=new Float64Array(sites.length);
      for(passes=0;passes<28;passes++){
        polys=polygons(sites,config,weights);
        areas=polys.map(area);
        maxDeviation=Math.max(...areas.map(a=>Math.abs(a/target-1)));
        if(maxDeviation<=.035)break;
        for(let i=0;i<sites.length;i++)weights[i]-=(areas[i]-target)*.35;
      }
      if(maxDeviation<=.035){
        invalidEdges=nonMooreContacts(sites.map((site,i)=>({...site,polygon:polys[i]})));
        if(invalidEdges===0)break;
      }
    }
    if(maxDeviation>.10||invalidEdges!==0||areas.some(a=>!Number.isFinite(a)||a<=0))
      throw Error('Territory generation failed ±10% area constraint');
    const total=areas.reduce((a,b)=>a+b,0);
    if(Math.abs(total-config.width*config.height)>config.width*config.height*1e-7)
      throw Error('Territory polygons have gaps or overlaps');
    const cells=sites.map((site,i)=>({...site,polygon:polys[i]}));
    return {
      cells,
      stats:{
        average:target,minArea:Math.min(...areas),maxArea:Math.max(...areas),
        maxDeviation,passes,siteShrink:shrinkApplied,totalArea:total,
        nonMooreContacts:invalidEdges
      }
    };
  }
  const api=Object.freeze({directions,neighbors8,area,balancedVoronoi});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ConquerRegionalTopology=api;
})(typeof window==='object'?window:{});
