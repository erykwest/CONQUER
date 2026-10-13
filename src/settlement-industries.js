'use strict';
// Temporary industry footprints. SVG artwork can replace their renderer later.
// Only world-space placement/production rules live here; no tree depletion.
(() => {
  const TYPES=Object.freeze({
    loggingCamp:{label:'Taglialegna',name:'Logging camp',good:'wood',tier:1,workers:2,color:'#795036',edge:'#4a2d1c',radius:10,days:3,cost:{gold:35,wood:25}},
    quarry:{label:'Cava',name:'Stone quarry',good:'stone',tier:2,workers:2,color:'#999b9c',edge:'#64686c',radius:3.5,days:5,cost:{gold:65,wood:20,stone:8}},
    mine:{label:'Miniera',name:'Mine',good:'stone',tier:2,workers:2,color:'#31363e',edge:'#171b20',radius:3.5,days:7,cost:{gold:95,wood:35,stone:18}}
  });
  const is=s=>!!s&&Object.hasOwn(TYPES,s.type);
  const make=(type,position)=>({type,x:position.x,y:position.y,w:2,h:2,
    shape:'industry',angle:0,economicOwner:'lord',workersRequired:2,
    productionGood:TYPES[type]?.good||'wood'});
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
      const distance=edgeDistance(point,forest.points);
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
    const p={x:s.x,y:s.y},fp=rectWorldPoints(s.x,s.y,2,2,s.angle||0);
    // Entire 2×2U footprint, not just its centre, must be in the whitezone.
    if(fp.some(v=>v.x<BUILD_MIN||v.x>BUILD_MAX||v.y<BUILD_MIN||v.y>BUILD_MAX))
      return{ok:false,reason:'The entire 2×2U footprint must remain in the whitezone (100×100U)'};
    const ground=buildableTerrainElevationForStructure(s);
    if(ground==null)return{ok:false,reason:'Industry needs one flat, stable terrace beside the slope'};
    // No buildings may obstruct another built structure, river, lake or forest.
    for(let x=-1;x<=1.001;x+=.4)for(let y=-1;y<=1.001;y+=.4){
      const q={x:s.x+x,y:s.y+y};
      if(environmentBlocksPoint(q,'settlement'))
        return{ok:false,reason:'Industry footprint intersects an obstacle, forest, water or slope'};
    }
    for(const other of State.structures||[]){
      if(other.id===s.id||other.auto)continue; // Auto elements follow existing displacement policy.
      if(other.type==='road'){
        if(roadTouchesPolygon(other,fp,.15))return{ok:false,reason:'Industry overlaps a player road'};
      }else{
        const otherPoly=footprintPoints(other);
        if(polygonCollision(fp,otherPoly))return{ok:false,reason:'Industry overlaps another building'};
      }
    }
    if(s.type==='loggingCamp'){
      const found=nearestForest(p);
      if(!found.forest||found.distance>TYPES.loggingCamp.radius)
        return{ok:false,reason:'Logging camp requires forest within 10U'};
      return{ok:true,ground,resourceTarget:found.forest.id,distance:found.distance};
    }
    if(s.type==='quarry'){
      const nearby=nearestSlope(p);
      // Upper terrace of a hill immediately adjacent to a rock/gentle slope.
      if(ground<.5||!nearby.band||nearby.distance>TYPES.quarry.radius)
        return{ok:false,reason:'Quarry needs an elevated hill terrace beside a rocky slope (≤3.5U)'};
      return{ok:true,ground,resourceTarget:nearby.band.kind,distance:nearby.distance};
    }
    if(s.type==='mine'){
      const nearby=nearestSlope(p,'steep');
      // Do not place inside a cliff: build next to steep rock on a flat ledge.
      if(!nearby.band||nearby.distance>TYPES.mine.radius)
        return{ok:false,reason:'Mine needs a flat terrace beside a steep rocky cliff (≤3.5U)'};
      return{ok:true,ground,resourceTarget:'steep',distance:nearby.distance};
    }
    return{ok:false,reason:'Unsupported industry'};
  }
  function render(s,preview=false){
    if(!is(s))return;
    const type=TYPES[s.type],poly=rectWorldPoints(s.x,s.y,2,2,s.angle||0);
    const z=Number.isFinite(s.groundZ)?s.groundZ:terrainElevation(s);
    // A low solid block, color-coded; replace with SVG meshes from /urban.
    const h=.35,selected=State.selectedId===s.id;
    const shade=type.edge;
    ctx.save();
    if(preview)ctx.globalAlpha*=.62;
    extrudePolygonAt(poly,z,z+h,{
      top:type.color,sideA:shade,sideB:shade,stroke:selected?'#f4b76f':'#c4bcb0'
    });
    const center=w2s({x:s.x,y:s.y},z+h+.04);
    ctx.fillStyle=s.type==='mine'?'#f4eee6':'#211d17';
    ctx.font='bold '+Math.max(9,Math.round(U*State.view.scale*.74))+'px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(s.type==='loggingCamp'?'L':s.type==='quarry'?'C':'M',center.x,center.y);
    ctx.restore();
  }
  function forestAccessPoint(s){
    const hit=nearestForest({x:s.x,y:s.y});
    if(!hit.forest)return null;
    const p={x:s.x,y:s.y},poly=hit.forest.points;
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
  window.ConquerIndustries=Object.freeze({TYPES,is,make,validate,render,drawWorkers,nearestForest,nearestSlope});
})();
