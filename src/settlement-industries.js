'use strict';
// Temporary industry footprints. SVG artwork can replace their renderer later.
// Only world-space placement/production rules live here; no tree depletion.
(() => {
  const TYPES=Object.freeze({
    loggingCamp:{label:'Taglialegna',name:'Logging camp',good:'wood',tier:1,workers:2,w:2,h:2,color:'#795036',edge:'#4a2d1c',radius:10,days:3,cost:{gold:35,wood:5}},
    quarry:{label:'Cava',name:'Stone quarry',good:'stone',tier:2,workers:2,w:3,h:3,color:'#999b9c',edge:'#64686c',days:5,cost:{gold:65,wood:20,stone:8}},
    mine:{label:'Miniera',name:'Mine',good:'metal',tier:2,workers:2,w:1,h:1,color:'#31363e',edge:'#171b20',days:7,cost:{gold:95,wood:35,stone:18}},
    windmill:{label:'Mulino a vento',name:'Windmill',good:'food',tier:1,workers:0,w:2,h:2,color:'#f5d936',edge:'#ac870c',days:3,cost:{gold:40,wood:30,stone:10}},
    watermill:{label:'Mulino ad acqua',name:'Watermill',good:'food',tier:1,workers:0,w:2,h:2,color:'#f5d936',edge:'#ac870c',days:3,cost:{gold:45,wood:35,stone:10}}
  });
  const CLAY_QUARRY=Object.freeze({
    ...TYPES.quarry,label:'Argilla',name:'Clay pit',good:'clay',
    w:4,h:4,color:'#dc873b',edge:'#995025',
    // No imported stone is needed to establish a clay pit on flat lowland.
    cost:Object.freeze({gold:65,wood:28})
  });
  const isClayQuarry=s=>s?.type==='quarry'&&s.extractionMode==='clay';
  const definition=s=>isClayQuarry(s)?CLAY_QUARRY:TYPES[s?.type];
  const is=s=>!!s&&Object.hasOwn(TYPES,s.type);
  const make=(type,position,extractionMode='stone')=>{
    const mode=type==='quarry'&&extractionMode==='clay'?'clay':'stone';
    const spec=type==='quarry'&&mode==='clay'?CLAY_QUARRY:TYPES[type];
    return{type,x:position.x,y:position.y,
      w:spec?.w||2,h:spec?.h||2,extractionMode:type==='quarry'?mode:undefined,
      shape:'industry',angle:0,economicOwner:'lord',workersRequired:spec?.workers??2,
      productionGood:spec?.good||'wood'};
  };
  const footprint=s=>{const spec=definition(s);return rectWorldPoints(s.x,s.y,spec.w,spec.h,s.angle||0)};
  function footprintSamples(s,step=.3){
    const {w,h}=definition(s),a=s.angle||0,ca=Math.cos(a),sa=Math.sin(a),out=[];
    const nx=Math.max(1,Math.ceil(w/step)),ny=Math.max(1,Math.ceil(h/step));
    for(let ix=0;ix<=nx;ix++)for(let iy=0;iy<=ny;iy++){
      const x=w*(ix/nx-.5),y=h*(iy/ny-.5);
      out.push({x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca});
    }
    return out;
  }
  function groundLevel(s){
    if(isClayQuarry(s))return 0;
    if(s.type==='quarry')return Math.max(...footprintSamples(s,.35).map(p=>terrainElevation(p)));
    return terrainElevation({x:s.x,y:s.y});
  }
  function normalizeFootprint(s){
    // Preserve settlements saved before the two wind variants were consolidated.
    if(s?.type==='windmillA'||s?.type==='windmillB')s.type='windmill';
    if(!is(s))return s;
    if(s.type==='quarry'){
      s.extractionMode=s.extractionMode==='clay'?'clay':'stone';
      s.productionGood=s.extractionMode==='clay'?'clay':'stone';
    }
    // Mines saved before ECO-FIL-01 recorded stone; they now extract metal.
    if(s.type==='mine')s.productionGood='metal';
    const spec=definition(s);
    s.w=spec.w;s.h=spec.h;
    if(s.type==='quarry'||s.type==='mine')s.groundZ=groundLevel(s);
    if(s.type==='watermill')orientToWater(s);
    return s;
  }
  function onRockySlope(p){return terrainSlopeKind(p)==='steep'}
  function intersectsRockySlope(fp){
    // Geometric overlap, not simply the centre or four footprint corners.
    for(const level of reliefLevels())for(const band of reliefEdgeBands(level)){
      if(band.kind==='steep'&&polygonCollision(fp,band.poly))return true;
    }
    return false;
  }
  function edgeDistance(point,polygon){
    if(!polygon||polygon.length<2)return Infinity;
    if(pointInPolygon(point,polygon))return 0;
    let nearest=Infinity;
    for(let i=0;i<polygon.length;i++)
      nearest=Math.min(nearest,pointSegmentDistance(point,polygon[i],polygon[(i+1)%polygon.length]));
    return nearest;
  }
  function nearestForest(point){
    let best=null,d=Infinity;
    for(const forest of State.environment||[])if(forest.type==='forest'&&forest.points?.length){
      // A woodland with clearings/grooves: distance to its nearest edge from inside a hole.
      const distance=forest.holes?.length
        ?(environmentContains(forest,point)?0:forestNearestEdge(forest,point).distance)
        :edgeDistance(point,forest.points);
      if(distance<d){best=forest;d=distance}
    }
    return{forest:best,distance:d};
  }
  function nearestSlope(point,kind){
    let nearest=Infinity,target=null;
    for(const level of reliefLevels())for(const band of reliefEdgeBands(level)){
      if(kind==='steep'&&band.kind!=='steep')continue;
      const distance=edgeDistance(point,band.poly);
      if(distance<nearest){nearest=distance;target=band}
    }
    return{band:target,distance:nearest};
  }
  // Water edge distance, measured from the 4x4 clay-pit CENTRE.
  // Rivers/streams store a centerline + water width; ponds are world-space polygons.
  function nearestClayWater(point){
    let distance=Infinity,target=null;
    for(const f of State.environment||[]){
      let candidate=Infinity;
      if((f.type==='river'||f.type==='stream')&&f.points?.length>=2){
        for(let i=1;i<f.points.length;i++)
          candidate=Math.min(candidate,Math.max(0,pointSegmentDistance(point,f.points[i-1],f.points[i])-(Number(f.width)||1.25)/2));
      }else if(f.type==='pond'&&f.points?.length>=3){
        candidate=edgeDistance(point,f.points);
      }
      if(candidate<distance){distance=candidate;target=f}
    }
    return{water:target,distance};
  }
  function polygonCollision(a,b){
    if(!a?.length||!b?.length)return false;
    if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return true;
    for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)
      if(segmentsIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
    return false;
  }
  // A watermill's +X face represents the future wheel; point it at the
  // nearest river/stream bank. The yellow block remains a plain 2×2U placeholder.
  function closestWater(p){
    let hit=null,best=Infinity;
    for(const water of State.environment||[]){
      if(!['river','stream'].includes(water.type))continue;
      const points=water.points||[];
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
        const q={x:a.x+dx*t,y:a.y+dy*t},d=dist(p,q);
        if(d<best){best=d;hit={water,point:q,distance:d,bankDistance:d-(Number(water.width)||1.25)/2}}
      }
    }
    return hit;
  }
  function orientToWater(s){
    if(s.type!=='watermill')return s;
    const hit=closestWater(s);
    if(hit&&hit.distance>.001){
      s.angle=Math.atan2(hit.point.y-s.y,hit.point.x-s.x);
      s.rotationStep=structureRotationStep(s.angle);
      s.waterSide='+X';
    }
    return s;
  }
  function isMill(s){return ['windmill','watermill'].includes(s?.type)}
  function validate(s){
    if(!is(s))return{ok:false,reason:'Unknown industry'};
    const p={x:s.x,y:s.y},type=definition(s);
    const water=s.type==='watermill'?closestWater(p):null;
    // Validation does not change the passed-in candidate or saved structure.
    const placement=s.type==='watermill'?orientToWater({...s}):s;
    const fp=footprint(placement);
    // The WHOLE footprint remains in the whitezone, even on cliffs.
    if(fp.some(v=>v.x<BUILD_MIN||v.x>BUILD_MAX||v.y<BUILD_MIN||v.y>BUILD_MAX))
      return{ok:false,reason:'The entire '+type.w+'×'+type.h+'U footprint must remain in the whitezone (100×100U)'};
    // Rock is allowed for extraction, but never water, trees or other obstacles.
    const points=footprintSamples(placement);
    if(points.some(q=>(State.environment||[]).some(f=>
      (s.type==='watermill'?['sea','mountain','pond','forest']:['sea','mountain','pond','forest','river','stream']).includes(f.type)&&environmentContains(f,q,s.type==='watermill'?0:.20))))
      return{ok:false,reason:'Industry footprint intersects forest, water or obstacle'};
    if(isMill(s)){
      const ground=buildableTerrainElevationForStructure(placement);
      if(ground==null)return{ok:false,reason:'Mill requires one level terrace (2×2U)'};
      // Hills are the windmill's natural site: any flat hill terrace (H+1, H+2,
      // H+3 summit…) takes it. Procedural hills are 2-3 levels high and their
      // H+1 ring is often narrower than 2U, so an exact-H+1 rule left most hills
      // unbuildable. Lowland H0 stays reserved for the watermill.
      if(s.type!=='watermill'&&ground<1-.001)
        return{ok:false,reason:'Windmills must stand on a hill terrace (H+1 or higher)'};
      if(s.type==='watermill'){
        // With a 2U square the wheel-facing edge sits 1U away from the centre.
        if(!water||Math.abs(water.bankDistance-1)>.28)
          return{ok:false,reason:'Watermill wheel side must touch a river or stream bank'};
        // Check the interior, while allowing the river exactly at the wheel edge.
        const a=placement.angle||0;
        const n={x:Math.cos(a),y:Math.sin(a)},t={x:-n.y,y:n.x};
        for(const side of [-.8,0,.8]){
          const q={x:s.x+n.x*.72+t.x*side,y:s.y+n.y*.72+t.y*side};
          if((State.environment||[]).some(f=>['river','stream'].includes(f.type)&&environmentContains(f,q,-.04)))
            return{ok:false,reason:'Watermill body would extend into water'};
        }
      }
    }else if(s.type==='loggingCamp'){
      if(buildableTerrainElevationForStructure(s)==null)
        return{ok:false,reason:'Logging camp needs a flat terrace'};
    }else if(isClayQuarry(s)){
      // The centre must be on elevation zero even when the corners touch other terraces.
      if(Math.abs(terrainElevation(p))>1e-5||terrainSlopeKind(p))
        return{ok:false,reason:'Clay pit centre must be at H0 (ground level)'};
      const water=nearestClayWater(p);
      if(!water.water||water.distance>6+1e-6)
        return{ok:false,reason:'Clay pit centre must be within 6U of a river, stream or lake shoreline'};
    }else if(s.type==='quarry'){
      // Existing 3x3 stone quarry: overlap with steep rock is unchanged.
      if(!intersectsRockySlope(fp))
        return{ok:false,reason:'Quarry must overlap a rocky slope somewhere within its 3×3U footprint'};
    }else if(s.type==='mine'){
      // Unlike the quarry, only the 1×1U mine CENTRE must be on rock.
      if(!onRockySlope(p))
        return{ok:false,reason:'Mine centre must lie directly on a rocky slope'};
    }
    for(const other of State.structures||[]){
      if(other.id===s.id||other.auto)continue; // Auto elements follow existing displacement policy.
      if(other.type==='road'){
        if(roadTouchesPolygon(other,fp,.15))return{ok:false,reason:'Industry overlaps a player road'};
      }else{
        const otherPoly=other.type==='well'?wellPlazaPoints(other):footprintPoints(other);
        if(polygonCollision(fp,otherPoly))return{ok:false,reason:'Industry overlaps another building'};
      }
    }
    const ground=isMill(s)?buildableTerrainElevationForStructure(placement):
      s.type==='loggingCamp'?buildableTerrainElevationForStructure(s):groundLevel(s);
    if(isMill(s))return{ok:true,ground,resourceTarget:water?.water?.id||null,distance:water?.bankDistance||0,angle:placement.angle};
    if(s.type==='loggingCamp'){
      const found=nearestForest(p);
      if(!found.forest||found.distance>type.radius)
        return{ok:false,reason:'Logging camp requires forest within 10U'};
      return{ok:true,ground,resourceTarget:found.forest.id,distance:found.distance};
    }
    if(isClayQuarry(s)){
      const nearest=nearestClayWater(p);
      return{ok:true,ground:0,resourceTarget:nearest.water.id,distance:nearest.distance};
    }
    return{ok:true,ground,resourceTarget:'steep',distance:0};
  }
  function forestAccessPoint(s){
    const hit=nearestForest({x:s.x,y:s.y});
    if(!hit.forest)return null;
    const p={x:s.x,y:s.y},poly=hit.forest.points;
    if(hit.forest.holes?.length){
      const edge=forestNearestEdge(hit.forest,p);
      return edge.distance<=TYPES.loggingCamp.radius?edge.point:null;
    }
    let best=null,distance=Infinity;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      const q={x:a.x+dx*t,y:a.y+dy*t},d=Math.hypot(p.x-q.x,p.y-q.y);
      if(d<distance){best=q;distance=d}
    }
    return distance<=TYPES.loggingCamp.radius?best:null;
  }
  // Quarry and mine crews stand at the face (local spots, facing local -x).
  const CREW_SPOTS={quarry:[[-.95,-.7],[-.95,.65],[-.6,0]],mine:[[.85,-.3],[.85,.3]]};
  // Purely visual anonymized workforce (no forest depletion): woodcutters walk to
  // the forest edge and chop with the axe, quarrymen and miners swing the pickaxe.
  function drawWorkers(){
    if(!window.ConquerEconomy||window.ConquerEconomy.weekday(State.clock.day)>=5)return;
    if((window.ConquerCombat?.alarmMode?.()||'off')!=='off')return;
    const allocated=window.ConquerEconomy.staffing(),frac=State.clock.day-Math.floor(State.clock.day);
    if(frac<.11||frac>.66)return;
    for(const s of State.structures||[]){
      if(s.type!=='loggingCamp'||underConstruction(s)||s.economyDisabled)continue;
      const count=Math.min(2,allocated[s.id]||0),forest=forestAccessPoint(s);if(!count||!forest)continue;
      const start={x:s.x,y:s.y},end=forest;
      for(let i=0;i<count;i++){
        const offset=i*.035,t=frac-offset;
        let progress;
        if(t<.11||t>.65)continue;
        if(t<.25)progress=(t-.11)/.14;
        else if(t<.47)progress=1;
        else if(t<.63)progress=1-(t-.47)/.16;
        else progress=0;
        progress=Math.max(0,Math.min(1,progress));
        const side=i?.35:-.35,len=Math.hypot(end.x-start.x,end.y-start.y)||1;
        const point={x:start.x+(end.x-start.x)*progress-(end.y-start.y)/len*side,y:start.y+(end.y-start.y)*progress+(end.x-start.x)/len*side};
        const WA=window.ConquerWorkAnim;
        if(!WA||!worldPointVisible(point,0,40))continue;
        const dot=WA.anonymous(s.id+':woodcutter'+i,point,'woodcutter'),back=t>=.47;
        const facing=WA.facingOf(point,(end.x-start.x)*(back?-1:1),(end.y-start.y)*(back?-1:1));
        if(t>=.25&&t<.47)WA.drawWorker(dot,'axe',WA.now(),facing);else WA.drawCarrier(dot,'axe',facing);
      }
    }
    // Quarrymen and miners at the face, Mon-Fri during the working hours.
    if(frac>.63||!window.ConquerWorkAnim)return;
    const WA=window.ConquerWorkAnim,clock=WA.now();
    for(const s of State.structures||[]){
      const spots=CREW_SPOTS[s.type];
      if(!spots||underConstruction(s)||s.economyDisabled)continue;
      const count=Math.min(spots.length,allocated[s.id]||0),a=s.angle||0,c=Math.cos(a),sn=Math.sin(a);
      for(let i=0;i<count;i++){
        const [lx,ly]=spots[i],p={x:s.x+lx*c-ly*sn,y:s.y+lx*sn+ly*c};
        if(!worldPointVisible(p,0,40))continue;
        WA.drawWorker(WA.anonymous(s.id+':'+s.type+i,p,s.type==='mine'?'miner':'quarryman'),'pickaxe',clock,WA.facingOf(p,-c,-sn));
      }
    }
  }
  window.ConquerIndustries=Object.freeze({TYPES,is,isMill,isClayQuarry,definition,make,footprint,groundLevel,normalizeFootprint,validate,orientToWater,drawWorkers,nearestForest,nearestSlope,nearestClayWater});
})();
