'use strict';
// One non-mutating placement preflight for all Builder previews and commits.
// Auto-generated lots/roads may be displaced by the pre-existing manual build policy.
(() => {
  const valid=()=>({ok:true,reason:''});
  const invalid=reason=>({ok:false,reason});
  const EPS=.012;
  const isPoint=s=>!!s&&Number.isFinite(s.x)&&Number.isFinite(s.y);
  const isLine=s=>!!s?.a&&!!s?.b;
  const ignoreSet=options=>new Set([options?.ignoreId,...(options?.ignoreIds||[])].filter(Boolean));
  function contact(s){
    if(s.type==='house')return houseFootprintParts(s).map(p=>p.points);
    if(s.type==='well')return[wellPlazaPoints(s)];
    if(isCivic(s))return civicParts(s).map(p=>p.points);
    return structureGroundContactPolygons(s);
  }
  function onBoundary(p,poly){
    return poly.some((a,i)=>pointSegmentDistance(p,a,poly[(i+1)%poly.length])<EPS);
  }
  function strictInside(p,poly){return pointInPolygon(p,poly)&&!onBoundary(p,poly)}
  function intersects(a,b){
    if(!a?.length||!b?.length)return false;
    for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)
      if(segmentsIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
    if(a.some(p=>strictInside(p,b))||b.some(p=>strictInside(p,a)))return true;
    const center=poly=>({x:poly.reduce((n,p)=>n+p.x,0)/poly.length,y:poly.reduce((n,p)=>n+p.y,0)/poly.length});
    return strictInside(center(a),b)||strictInside(center(b),a);
  }
  const within=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)
    &&p.x>=BUILD_MIN-EPS&&p.x<=BUILD_MAX+EPS&&p.y>=BUILD_MIN-EPS&&p.y<=BUILD_MAX+EPS;
  function whitezone(s,polys){
    if(isLine(s))return within(s.a)&&within(s.b)&&(
      s.type==='road'||polys.every(poly=>poly.every(within)));
    return polys.length&&polys.every(poly=>poly.length>=3&&poly.every(within));
  }
  function samples(polys){
    const out=[];
    for(const poly of polys){
      const c={x:poly.reduce((t,p)=>t+p.x,0)/poly.length,y:poly.reduce((t,p)=>t+p.y,0)/poly.length};
      out.push(c);
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],d=dist(a,b);
        for(let k=0;k<=Math.max(2,Math.ceil(d/.3));k++){
          const t=k/Math.max(2,Math.ceil(d/.3));
          out.push({x:a.x*(1-t)+b.x*t,y:a.y*(1-t)+b.y*t});
        }
      }
    }
    return out;
  }
  function blockedNature(p,foundation=false){
    if(!foundation&&terrainSlopeKind(p))return true;
    return(State.environment||[]).some(f=>
      ['sea','mountain','pond','forest','river','stream'].includes(f.type)&&environmentContains(f,p,.10)
    );
  }
  function regularCollision(s,other,polys,options={}){
    if(s.type==='house'&&other.type==='road'&&other.accessFor===s.id)return false;
    // Castle pieces deliberately join walls/gates/towers at their sockets.
    if(['tower','gate'].includes(s.type)&&['wall','built','tower','gate','palisade'].includes(other.type)){
      if(other.id===s.parentTowerId||other.parentTowerId===s.id||other.id===s.wallSnapId)return false;
      if(['wall','built','palisade'].includes(other.type))return false;
    }
    if(['wall','built','palisade'].includes(s.type)&&['tower','gate','wall','built','palisade'].includes(other.type))return false;
    if(other.type==='road'){
      if(s.type==='market')return false; // paved square & crossing roads supported.
      return polys.some(poly=>roadTouchesPolygon(other,poly,.04));
    }
    if(s.type==='road'){
      if(other.type==='market')return false;
      return manualRoadConflict(s,other);
    }
    const otherPolys=contact(other);
    return polys.some(a=>otherPolys.some(b=>intersects(a,b)));
  }
  function check(s,options={}){
    if(!s)return invalid('No structure to place');
    if(!isLine(s)&&!isPoint(s))return invalid('Missing structure coordinates');
    const polys=contact(s);
    if(!whitezone(s,polys))return invalid('Entire structure must be inside the whitezone (100×100U)');
    const ignored=ignoreSet(options);
    if(s.type==='well'&&!options.ignoreFounding&&(
      State.village?.founded||State.structures.some(o=>o.type==='well'&&!ignored.has(o.id))
    ))return invalid('A village well already exists');
    if(window.ConquerIndustries?.is(s)){
      const industry=window.ConquerIndustries.validate(s);
      if(!industry.ok)return industry;
    }else if(isLine(s)){
      if(s.type==='road'){
        const d=dist(s.a,s.b);
        if(d<(TYPES.road.min||1)-.001)return invalid('Road segment too short');
        const steps=Math.max(3,Math.ceil(d/.25));
        for(let i=0;i<=steps;i++){
          const t=i/steps,p={x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t};
          if((isPrimaryRoad(s)?primaryRoadTerrainBlocked(p):environmentBlocksPoint(p,'road')))return invalid('Road crosses an impassable obstacle or cliff');
        }
      }else if(buildableTerrainElevationForStructure(s)==null){
        return invalid('Wall segment crosses incompatible terrain');
      }
    }else{
      const foundation=isPlacementFoundationBuilding(s);
      if(!foundation&&buildableTerrainElevationForStructure(s)==null)
        return invalid('Structure needs a flat, stable terrace');
      for(const p of samples(polys))
        if(blockedNature(p,foundation))return invalid('Placement intersects forest, water, obstacle or slope');
    }
    // New manual buildings may replace auto-created houses, fields and roads.
    // Rotation of an existing auto house must still respect other auto buildings.
    for(const other of State.structures){
      if(ignored.has(other.id)||other.id===s.id)continue;
      if(other.auto&&!options.includeAuto)continue;
      if(other.type==='road'&&s.type==='road')continue;
      if(regularCollision(s,other,polys,options))
        return invalid('Footprint overlaps an existing structure or road');
    }
    if(options.checkCost!==false&&!s.auto){
      const cost=constructionCost(s);
      if(!canAfford(cost))return invalid('Insufficient resources: '+costText(cost));
    }
    return valid();
  }
  window.ConquerPlacement=Object.freeze({check,contact,intersects});
})();
