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
    if(isCivicAnnex(s))return[civicAnnexFootprint(s)];
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
  // The forest outline only holds the trunks: canopies of edge trees overhang clearings
  // and meadows by about 0.75U. Test the trees actually drawn against the footprint.
  const TREE_CANOPY_CLEARANCE=.75;
  function blockedByTrees(polys){
    if(typeof forestTreeLayout!=='function')return false;
    const pad=TREE_CANOPY_CLEARANCE*1.2;
    for(const poly of polys){
      const b=environmentPolygonBounds(poly);
      for(const f of State.environment||[]){
        if(f.type!=='forest'||!f.points?.length)continue;
        const fb=environmentPolygonBounds(f.points);
        if(fb.maxX<b.minX-pad||fb.minX>b.maxX+pad||fb.maxY<b.minY-pad||fb.minY>b.maxY+pad)continue;
        const candidates=typeof forestTreesInBounds==='function'
          ?forestTreesInBounds(f,b,pad):forestTreeLayout(f);
        for(const t of candidates){
          const p=t.p;
          if(p.x<b.minX-pad||p.x>b.maxX+pad||p.y<b.minY-pad||p.y>b.maxY+pad)continue;
          if(pointInPolygon(p,poly))return true;
          const r=TREE_CANOPY_CLEARANCE*(t.scale||1);
          if(poly.some((a,i)=>pointSegmentDistance(p,a,poly[(i+1)%poly.length])<r))return true;
        }
      }
    }
    return false;
  }
  function regularCollision(s,other,polys,options={}){
    // Piers branch off quays: their landing rests on the quay.
    if((s.type==='pier'&&other.type==='quay')||(s.type==='quay'&&other.type==='pier'))return false;
    // Quays joined by the quay magnet meet without colliding.
    if(window.ConquerQuay?.joined(s,other))return false;
    // A wall magnetised to a quay stands on it.
    if(other.type==='quay'&&window.ConquerQuay?.isWallOn(s,other))return false;
    if(s.type==='quay'&&window.ConquerQuay?.isWallOn(other,s))return false;
    if(s.type==='house'&&other.type==='road'&&other.accessFor===s.id)return false;
    // Castle pieces deliberately join walls/gates/towers at their sockets.
    if(['tower','gate'].includes(s.type)&&['wall','built','tower','gate','palisade'].includes(other.type)){
      if(other.id===s.parentTowerId||other.parentTowerId===s.id||other.id===s.wallSnapId)return false;
      if(['wall','built','palisade'].includes(other.type))return false;
    }
    if(['wall','built','palisade'].includes(s.type)&&['tower','gate','wall','built','palisade'].includes(other.type))return false;
    if(other.type==='road'){
      if(s.type==='market'||s.type==='plaza')return false; // public squares allow crossing roads.
      if(s.type==='gate'&&roadUsesGatePassage(other,s))return false; // the road runs through the passage.
      if(['bridge','ramp','stairway'].includes(s.type)&&roadMeetsBridgeEnd(other,s))return false; // the road leads onto the deck.
      return polys.some(poly=>roadTouchesPolygon(other,poly,.04));
    }
    if(s.type==='road'){
      if(other.type==='market'||other.type==='plaza')return false;
      return manualRoadConflict(s,other);
    }
    const otherPolys=contact(other);
    return polys.some(a=>otherPolys.some(b=>intersects(a,b)));
  }
  function check(s,options={}){
    if(!s)return invalid('No structure to place');
    if(!isLine(s)&&!isPoint(s))return invalid('Missing structure coordinates');
    const polys=contact(s);
    const annexVerdict=civicAnnexPlacementCheck(s);
    if(!annexVerdict.ok)return annexVerdict;
    const wellVerdict=typeof wellCivicPlacementCheck==='function'?wellCivicPlacementCheck(s):valid();
    if(!wellVerdict.ok)return wellVerdict;
    // A pier reaches out over the sea: its own validation keeps the landing in the whitezone.
    // Quays (and the walls and towers built against them) start in the whitezone by their own rules.
    const harbour=window.ConquerPier?.is(s)||window.ConquerQuay?.is(s)||window.ConquerQuay?.wallGroundZ(s)!=null;
    if(!harbour&&!whitezone(s,polys))return invalid('Entire structure must be inside the whitezone (100×100U)');
    // Shore rocks take only a quay and what stands on it (settlement-coast.js).
    const onQuay=window.ConquerQuay?.is(s)||window.ConquerQuay?.wallGroundZ(s)!=null||(s.type==='pier'&&s.onQuay);
    if(!onQuay&&window.ConquerCoast&&samples(polys).some(p=>window.ConquerCoast.rockAt(p)))return invalid('Scogli: qui si può costruire solo la banchina');
    const ignored=ignoreSet(options);
    // Only one founding well: until the village is named, a second well cannot be placed.
    // Once founded, further wells are ordinary buildings (expansion centres).
    if(s.type==='well'&&!options.ignoreFounding&&!State.village?.founded&&
      State.structures.some(o=>o.type==='well'&&!ignored.has(o.id))
    )return invalid('The founding well is waiting for the village name');
    if(window.ConquerIndustries?.is(s)){
      const industry=window.ConquerIndustries.validate(s);
      if(!industry.ok)return industry;
    }else if(window.ConquerPier?.is(s)){
      const pier=window.ConquerPier.validate(s);
      if(!pier.ok)return pier;
    }else if(window.ConquerQuay?.is(s)){
      // Quays only ask for the whitezone and water: no buildable-terrain rules.
      const quay=window.ConquerQuay.validate(s);
      if(!quay.ok)return quay;
    }else if(window.ConquerSlopeways?.is(s)){
      // Ramps and stairways climb a slope on purpose: their own survey of both plateaus,
      // grade and terrain profile replaces the flat-terrace rule.
      const way=window.ConquerSlopeways.validate(s);
      if(!way.ok)return way;
      const inForest=p=>(State.environment||[]).some(f=>f.type==='forest'&&environmentContains(f,p));
      if(samples(polys).some(inForest)||blockedByTrees(polys))return invalid('Rampa/scalinata attraversa un bosco');
    }else if(isLine(s)){
      if(s.type==='road'){
        const d=dist(s.a,s.b);
        if(d<(TYPES.road.min||1)-.001)return invalid('Road segment too short');
        const steps=Math.max(3,Math.ceil(d/.25));
        for(let i=0;i<=steps;i++){
          const t=i/steps,p={x:s.a.x+(s.b.x-s.a.x)*t,y:s.a.y+(s.b.y-s.a.y)*t};
          if((isPrimaryRoad(s)?primaryRoadTerrainBlocked(p):environmentBlocksPoint(p,'road')))return invalid('Road crosses an impassable obstacle or cliff');
        }
      }else if(!wallTerrainVerdict(s).ok){
        return invalid(wallTerrainVerdict(s).reason);
      }else{
        // Walls, palisades and built sections only checked the terrain: they ran through woods.
        const inForest=p=>(State.environment||[]).some(f=>f.type==='forest'&&environmentContains(f,p));
        if(samples(polys).some(inForest)||blockedByTrees(polys))return invalid('Wall segment crosses a forest');
      }
    }else if(s.type==='tower'&&s.quaySnap&&window.ConquerQuay?.wallGroundZ(s)!=null){
      // A tower against a quay stands in the water on its plinth: no terrain or water rules.
    }else{
      const foundation=isPlacementFoundationBuilding(s);
      if(!foundation&&buildableTerrainElevationForStructure(s)==null)
        return invalid('Structure needs a flat, stable terrace');
      for(const p of samples(polys))
        if(blockedNature(p,foundation))return invalid('Placement intersects forest, water, obstacle or slope');
      if(blockedByTrees(polys))return invalid('Placement intersects forest trees');
    }
    // New manual buildings may replace auto-created houses, fields and roads.
    // Rotation of an existing auto house must still respect other auto buildings.
    for(const other of State.structures){
      if(ignored.has(other.id)||other.id===s.id)continue;
      if(other.auto&&!options.includeAuto&&!isCivicAnnex(s))continue;
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
