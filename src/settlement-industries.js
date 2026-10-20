'use strict';
// Temporary industry footprints. SVG artwork can replace their renderer later.
// Only world-space placement/production rules live here; no tree depletion.
(() => {
  const TYPES=Object.freeze({
    loggingCamp:{label:'Taglialegna',name:'Logging camp',good:'wood',tier:1,workers:2,w:2,h:2,color:'#795036',edge:'#4a2d1c',radius:10,days:3,cost:{gold:35,wood:25}},
    quarry:{label:'Cava',name:'Stone quarry',good:'stone',tier:2,workers:2,w:3,h:3,color:'#999b9c',edge:'#64686c',days:5,cost:{gold:65,wood:20,stone:8}},
    mine:{label:'Miniera',name:'Mine',good:'stone',tier:2,workers:2,w:1,h:1,color:'#31363e',edge:'#171b20',days:7,cost:{gold:95,wood:35,stone:18}}
  });
  const is=s=>!!s&&Object.hasOwn(TYPES,s.type);
  const make=(type,position)=>({type,x:position.x,y:position.y,
    w:TYPES[type]?.w||2,h:TYPES[type]?.h||2,
    shape:'industry',angle:0,economicOwner:'lord',workersRequired:2,
    productionGood:TYPES[type]?.good||'wood'});
  const footprint=s=>rectWorldPoints(s.x,s.y,TYPES[s.type].w,TYPES[s.type].h,s.angle||0);
  function footprintSamples(s,step=.3){
    const {w,h}=TYPES[s.type],a=s.angle||0,ca=Math.cos(a),sa=Math.sin(a),out=[];
    const nx=Math.max(1,Math.ceil(w/step)),ny=Math.max(1,Math.ceil(h/step));
    for(let ix=0;ix<=nx;ix++)for(let iy=0;iy<=ny;iy++){
      const x=w*(ix/nx-.5),y=h*(iy/ny-.5);
      out.push({x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca});
    }
    return out;
  }
  function groundLevel(s){
    if(s.type==='quarry')return Math.max(...footprintSamples(s,.35).map(p=>terrainElevation(p)));
    return terrainElevation({x:s.x,y:s.y});
  }
  function normalizeFootprint(s){
    if(!is(s))return s;
    s.w=TYPES[s.type].w;s.h=TYPES[s.type].h;
    if(s.type==='quarry'||s.type==='mine')s.groundZ=groundLevel(s);
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
  function polygonCollision(a,b){
    if(!a?.length||!b?.length)return false;
    if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return true;
    for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)
      if(segmentsIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
    return false;
  }
  function validate(s){
    if(!is(s))return{ok:false,reason:'Unknown industry'};
    const p={x:s.x,y:s.y},type=TYPES[s.type],fp=footprint(s);
    // The WHOLE footprint remains in the whitezone, even on cliffs.
    if(fp.some(v=>v.x<BUILD_MIN||v.x>BUILD_MAX||v.y<BUILD_MIN||v.y>BUILD_MAX))
      return{ok:false,reason:'The entire '+type.w+'×'+type.h+'U footprint must remain in the whitezone (100×100U)'};
    // Rock is allowed for extraction, but never water, trees or other obstacles.
    const points=footprintSamples(s);
    if(points.some(q=>(State.environment||[]).some(f=>
      ['sea','mountain','pond','forest','river','stream'].includes(f.type)&&environmentContains(f,q,.20))))
      return{ok:false,reason:'Industry footprint intersects forest, water or obstacle'};
    if(s.type==='loggingCamp'){
      if(buildableTerrainElevationForStructure(s)==null)
        return{ok:false,reason:'Logging camp needs a flat terrace'};
    }else if(s.type==='quarry'){
      // Any positive footprint/rock face overlap counts, even off-centre.
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
    const ground=s.type==='loggingCamp'?buildableTerrainElevationForStructure(s):groundLevel(s);
    if(s.type==='loggingCamp'){
      const found=nearestForest(p);
      if(!found.forest||found.distance>type.radius)
        return{ok:false,reason:'Logging camp requires forest within 10U'};
      return{ok:true,ground,resourceTarget:found.forest.id,distance:found.distance};
    }
    return{ok:true,ground,resourceTarget:'steep',distance:0};
  }
  function render(s,preview=false){
    if(!is(s))return;
    const type=TYPES[s.type],poly=footprint(s);
    const ground=Number.isFinite(s.groundZ)?s.groundZ:
      s.type==='loggingCamp'?terrainElevation(s):groundLevel(s);
    // Placeholder platform uses one surveyed elevation even when it spans rock.
    const h=.35,selected=State.selectedId===s.id;
    const shade=type.edge;
    ctx.save();
    if(preview)ctx.globalAlpha*=.62;
    withProjectionGroundZ(ground,()=>{
    extrudePolygonAt(poly,0,h,{
      top:type.color,sideA:shade,sideB:shade,stroke:selected?'#f4b76f':'#c4bcb0'
    });
    const center=w2s({x:s.x,y:s.y},h+.04);
    ctx.fillStyle=s.type==='mine'?'#f4eee6':'#211d17';
    ctx.font='bold '+Math.max(9,Math.round(U*State.view.scale*.74))+'px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(s.type==='loggingCamp'?'L':s.type==='quarry'?'C':'M',center.x,center.y);
    // Direction marker scales to the footprint (1×1 mine through 3×3 quarry).
    const angle=Number(s.angle)||0,front=type.w/2;
    const tip=w2s({x:s.x+Math.cos(angle)*front*.82,y:s.y+Math.sin(angle)*front*.82},h+.055);
    const back=w2s({x:s.x+Math.cos(angle)*front*.30,y:s.y+Math.sin(angle)*front*.30},h+.055);
    ctx.strokeStyle=s.type==='mine'?'#f2c879':'#f7d78c';
    ctx.lineWidth=Math.max(1.4,State.view.scale*2);
    ctx.beginPath();ctx.moveTo(back.x,back.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
    });
    ctx.restore();
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
  // Purely visual anonymized workforce. No chopping animation or forest depletion.
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
        const point={x:start.x+(end.x-start.x)*progress,y:start.y+(end.y-start.y)*progress};
        const screen=w2s(point,terrainElevation(point)+.14);
        ctx.save();ctx.fillStyle='#b5a17e';ctx.strokeStyle='#423124';ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(screen.x+(i?2:-2),screen.y,Math.max(2,U*State.view.scale*.13),0,Math.PI*2);
        ctx.fill();ctx.stroke();ctx.restore();
      }
    }
  }
  window.ConquerIndustries=Object.freeze({TYPES,is,make,footprint,groundLevel,normalizeFootprint,validate,render,drawWorkers,nearestForest,nearestSlope});
})();
