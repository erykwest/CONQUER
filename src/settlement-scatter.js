'use strict';
// CONQUER environmental scatter: small props (src/assets/scatter-model.js, built by
// tools/blender/build_scatter.py) placed by context rules instead of at random:
// yards by house level, field corners, industry work areas, market and tavern
// fronts, outside the gates, road junction signposts and milestones, the well.
// Placement is deterministic (seeded by the map seed and each owner's id), never on
// roads, buildings, fields, water, forests or cliffs, and never overlapping another
// prop. Visual only: props do not block movement. Classic script.
(function(){
  const M=()=>window.ConquerScatterModel;
  const MAX_PROPS=240,EDGE=1,GAP=.08;
  // Real scale reads well for vehicles; small props are enlarged a little to stay legible
  // at play zoom (same spirit as the figures).
  const FAMILY_SCALE={carts:1,signs:1.15,goods:1.3,wheels:1.3,materials:1.3,farm:1.3,work:1.3};
  const scaleOf=asset=>FAMILY_SCALE[M().assets[asset]?.family]||1;
  // Context -> weighted asset choices. Seasonal entries are filtered in pick().
  const RULES={
    house1:[['firewood',3],['choppingBlock',3],['buckets',2],['hayBales',2,'nearField'],['wheelLying',1],['ladder',1]],
    house2:[['workbench',3],['sawhorse',2],['plankStack',2],['ladder',2],['ropeCoil',2],['crateStack',2],['wheelStack',1],['cartParked',1]],
    house3:[['barrelGroup',3],['crateStack',3],['goodsMixed',3],['sackPile',2],['cartParked',2],['ropeCoil',1]],
    field:[['haystack',3,'hay'],['hayBales',3,'hay'],['farmTools',3],['buckets',1],['cartParked',1],['wheelLying',1]],
    loggingCamp:[['logPile',4],['sawhorse',3],['choppingBlock',3],['firewood',3],['plankStack',2],['cartParked',1]],
    quarry:[['stonePile',5],['wheelStack',2],['cartParked',2],['workbench',1],['ropeCoil',1]],
    mine:[['stonePile',3],['wheelStack',2],['brokenCart',1],['ropeCoil',2],['ladder',1]],
    market:[['goodsMixed',3],['crateStack',3],['barrelGroup',2],['sackPile',3],['wagonLoaded',2],['wagonParked',1]],
    tavern:[['barrelGroup',4],['cartParked',1],['crateStack',1],['carriageParked',1]],
    church:[['carriageParked',1]],
    training:[['sawhorse',1],['ladder',1],['crateStack',1]],
    // Nobles arrive at the castle by carriage; supplies by wagon and cart.
    gate:[['carriageParked',2],['wagonLoaded',2],['cartParked',2],['crateStack',2],['goodsMixed',2]],
    roadside:[['brokenCart',1],['wheelLying',2],['logPile',1]]
  };
  const COUNTS={house1:[0,1],house2:[1,2],house3:[1,2],field:[0,1],loggingCamp:[2,4],quarry:[2,3],mine:[1,2],market:[3,5],tavern:[1,2],church:[0,1],training:[0,1],gate:[1,2]};

  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rngFor(key){return seedRand((Number(State.seed)||1)^hash(String(key)))}
  function pick(rnd,ctx,opts){
    const list=RULES[ctx].filter(([,,tag])=>!tag||(tag==='hay'?opts.hay:tag==='nearField'?opts.nearField:true)).filter(([a])=>M()?.assets?.[a]);
    let total=list.reduce((s,[,w])=>s+w,0),r=rnd()*total;
    for(const [a,w] of list){if((r-=w)<0)return a}
    return list[0]?.[0]||null;
  }
  function count(rnd,ctx){const [lo,hi]=COUNTS[ctx]||[0,1];return lo+Math.floor(rnd()*(hi-lo+1))}

  // ---------- obstacles
  function distToPoly(p,pts){let d=Infinity;for(let i=0;i<pts.length;i++)d=Math.min(d,pointSegmentDistance(p,pts[i],pts[(i+1)%pts.length]));return d}
  function buildObstacles(){
    const polys=[],roads=[];
    for(const s of State.structures){
      if(s.type==='road'){if(s.a&&s.b)roads.push({a:s.a,b:s.b,half:(Number(s.width)||.5)*.36+.12});continue}
      if(s.type==='field'){polys.push(fieldPoints(s));continue}
      if(['wall','palisade','built','moat','bridge'].includes(s.type)&&s.a&&s.b){roads.push({a:s.a,b:s.b,half:(Number(s.width)||.6)/2+.15});continue}
      let list=[];
      try{list=urbanBuildingPolygons(s)}catch{}
      if(!list.length&&window.ConquerIndustries?.is(s)){const t=window.ConquerIndustries.TYPES[s.type];list=[rectWorldPoints(s.x,s.y,t.w,t.h,s.angle||0)]}
      if(!list.length&&Number.isFinite(s.x))list=[rectWorldPoints(s.x,s.y,pointRadius(s)*2,pointRadius(s)*2,0)];
      for(const pts of list)if(pts?.length>2)polys.push(pts);
    }
    return{polys,roads};
  }
  function blockedByTerrain(p,r){
    if(p.x<EDGE+r||p.y<EDGE+r||p.x>WORLD-EDGE-r||p.y>WORLD-EDGE-r)return true;
    for(const q of [p,{x:p.x+r,y:p.y},{x:p.x-r,y:p.y},{x:p.x,y:p.y+r},{x:p.x,y:p.y-r}]){
      if(terrainSlopeKind(q)==='steep')return true;
    }
    for(const f of State.environment||[]){
      if(['forest','pond','sea','mountain'].includes(f.type)&&environmentContains(f,p,r))return true;
      if(['river','stream'].includes(f.type)&&f.points?.length>1){
        for(let i=0;i<f.points.length-1;i++)if(pointSegmentDistance(p,f.points[i],f.points[i+1])<(Number(f.width)||1)/2+r+.3)return true;
      }
    }
    return false;
  }
  function free(p,r,obs,placed){
    if(blockedByTerrain(p,r))return false;
    for(const rd of obs.roads)if(pointSegmentDistance(p,rd.a,rd.b)<rd.half+r)return false;
    for(const pts of obs.polys)if(pointInPolygon(p,pts)||distToPoly(p,pts)<r+GAP)return false;
    for(const q of placed)if(Math.hypot(q.x-p.x,q.y-p.y)<q.r+r+GAP)return false;
    return true;
  }
  function nearestRoad(p,obs){
    let best=null,bd=Infinity;
    for(const rd of obs.roads){const d=pointSegmentDistance(p,rd.a,rd.b);if(d<bd){bd=d;best=rd}}
    return best&&{road:best,d:bd,angle:Math.atan2(best.b.y-best.a.y,best.b.x-best.a.x)};
  }

  // ---------- placement
  function tryPlace(out,obs,asset,candidates,heading,ctx,owner){
    const a=M().assets[asset];if(!a)return false;
    const s=scaleOf(asset),r=a.r*s;
    for(const c of candidates){
      if(!free(c,r,obs,out))continue;
      out.push({asset,x:c.x,y:c.y,r,s,heading:typeof heading==='function'?heading(c):heading,ctx,owner});
      return true;
    }
    return false;
  }
  // Candidates on a ring around a centre (industry, civic, well), shuffled by rnd.
  function ring(cx,cy,r0,r1,rnd,n=18){
    const out=[];for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,r=r0+rnd()*(r1-r0);out.push({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r})}
    return out;
  }
  function insidePoly(pts,rnd,n=24){
    const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),out=[];
    for(let k=0;k<n*4&&out.length<n;k++){const p={x:x0+rnd()*(x1-x0),y:y0+rnd()*(y1-y0)};if(pointInPolygon(p,pts))out.push(p)}
    return out;
  }
  function houseProps(out,obs,fields){
    let lots=[];try{lots=urbanLots()}catch{}
    const byHouse=new Map(lots.filter(l=>l.points?.length).map(l=>[l.houseId,l]));
    // Houses without an urban lot (no street yet) get a yard ring around their footprint.
    for(const house of State.structures.filter(s=>s.type==='house'&&!byHouse.has(s.id))){
      const {w,h}=houseFootprintDimensions(house),r0=Math.hypot(w,h)/2;
      byHouse.set(house.id,{houseId:house.id,points:Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return{x:house.x+Math.cos(a)*(r0+1.6),y:house.y+Math.sin(a)*(r0+1.6)}})});
    }
    const byId=new Map(State.structures.map(s=>[s.id,s]));
    for(const lot of [...byHouse.values()].sort((a,b)=>String(a.houseId)<String(b.houseId)?-1:1)){
      const house=byId.get(lot.houseId);if(!house||underConstruction(house)||!lot.points?.length)continue;
      const lvl=houseLevel(house),ctx=lvl>=3?'house3':lvl===2?'house2':'house1',rnd=rngFor('house:'+house.id);
      const nearField=fields.some(f=>Math.hypot(f.x-house.x,f.y-house.y)<8);
      const n=ctx==='house1'?(rnd()<.6?1:0):count(rnd,ctx);
      // Back yard first: candidates furthest from the street.
      const cands=insidePoly(lot.points,rnd).map(p=>({...p,k:nearestRoad(p,obs)?.d??0})).sort((a,b)=>b.k-a.k);
      for(let i=0;i<n;i++){
        const asset=pick(rnd,ctx,{nearField});if(!asset)continue;
        tryPlace(out,obs,asset,cands,c=>{const nr=nearestRoad(c,obs);return(nr?nr.angle:0)+(rnd()<.5?0:Math.PI/2)+(rnd()-.5)*.5},ctx,house.id);
      }
      // Shop signs hang at the street front of merchant houses and taverns.
      if(lvl>=3&&rnd()<.55){
        const front=insidePoly(lot.points,rnd).map(p=>({...p,k:nearestRoad(p,obs)?.d??99})).filter(p=>p.k<1.4).sort((a,b)=>a.k-b.k);
        tryPlace(out,obs,'hangingSign',front,c=>{const nr=nearestRoad(c,obs);return nr?nr.angle:0},'shopSign',house.id);
      }
    }
  }
  function fieldProps(out,obs,fields){
    const hay=['summer','autumn'].includes(State.season||'summer');
    for(const f of fields){
      const rnd=rngFor('field:'+f.id),n=rnd()<.35?2:1;
      const pts=fieldPoints(f),c={x:pts.reduce((t,p)=>t+p.x,0)/pts.length,y:pts.reduce((t,p)=>t+p.y,0)/pts.length};
      // Just outside a corner, nearest-to-road corner first (where carts stop).
      const corners=pts.map(p=>{const dx=p.x-c.x,dy=p.y-c.y,L=Math.hypot(dx,dy)||1;return{x:p.x+dx/L*.9,y:p.y+dy/L*.9}})
        .map(p=>({...p,k:nearestRoad(p,obs)?.d??99})).sort((a,b)=>a.k-b.k);
      const cands=corners.flatMap(p=>[p,...ring(p.x,p.y,.2,1.1,rnd,6)]);
      const edge=Math.atan2(pts[1].y-pts[0].y,pts[1].x-pts[0].x);
      for(let i=0;i<n;i++){const a=pick(rnd,'field',{hay});if(a)tryPlace(out,obs,a,cands,edge,'field',f.id)}
    }
  }
  function ringProps(out,obs,s,ctx,radius){
    const rnd=rngFor(ctx+':'+s.id),n=count(rnd,ctx),cands=ring(s.x,s.y,radius+.25,radius+2.2,rnd,40)
      .map(p=>({...p,k:nearestRoad(p,obs)?.d??99})).sort((a,b)=>a.k-b.k);
    for(let i=0;i<n;i++){
      const a=pick(rnd,ctx,{});if(!a)continue;
      tryPlace(out,obs,a,cands,c=>Math.atan2(c.y-s.y,c.x-s.x)+Math.PI/2+(rnd()-.5)*.4,ctx,s.id);
    }
  }
  function gateProps(out,obs){
    const castle=State.structures.filter(s=>['tower','gate','wall'].includes(s.type)&&Number.isFinite(s.x??s.a?.x));
    if(!castle.length)return;
    const cc={x:castle.reduce((t,s)=>t+(s.x??(s.a.x+s.b.x)/2),0)/castle.length,y:castle.reduce((t,s)=>t+(s.y??(s.a.y+s.b.y)/2),0)/castle.length};
    for(const g of State.structures.filter(s=>s.type==='gate'&&!underConstruction(s))){
      const rnd=rngFor('gate:'+g.id),n=count(rnd,'gate'),dx=g.x-cc.x,dy=g.y-cc.y,L=Math.hypot(dx,dy)||1;
      const out0={x:g.x+dx/L*3.2,y:g.y+dy/L*3.2},cands=ring(out0.x,out0.y,.6,2.6,rnd,30);
      for(let i=0;i<n;i++){
        const a=pick(rnd,'gate',{});if(!a)continue;
        tryPlace(out,obs,a,cands,c=>{const nr=nearestRoad(c,obs);return nr?nr.angle:Math.atan2(dy,dx)},'gate',g.id);
      }
    }
  }
  // Signposts where three or more road segments meet; milestones every ~30 U of main road.
  function roadProps(out,obs){
    let primary=[],roads=[];try{primary=primaryRoadList(true);roads=roadList(true)}catch{}
    const nodes=new Map(),key=p=>Math.round(p.x*2)+','+Math.round(p.y*2);
    for(const r of roads)for(const p of [r.a,r.b]){const k=key(p);const n=nodes.get(k)||{p,deg:0,main:false};n.deg++;n.main||=!!r.routeId;nodes.set(k,n)}
    let signs=0;
    for(const [k,n] of [...nodes].sort((a,b)=>a[0]<b[0]?-1:1)){
      if(n.deg<3||!n.main||signs>=8)continue;
      const rnd=rngFor('junction:'+k);
      // The village hub is the well plaza: the post stands on its edge, not inside it.
      if(tryPlace(out,obs,'signpost',ring(n.p.x,n.p.y,.8,2.6,rnd,24).sort((a,b)=>Math.hypot(a.x-n.p.x,a.y-n.p.y)-Math.hypot(b.x-n.p.x,b.y-n.p.y)),rnd()*Math.PI*2,'junction',k))signs++;
    }
    const byRoute=new Map();for(const r of primary){const id=r.routeId;if(!byRoute.has(id))byRoute.set(id,[]);byRoute.get(id).push(r)}
    let stones=0;
    for(const [id,segs] of [...byRoute].sort((a,b)=>String(a[0])<String(b[0])?-1:1)){
      let run=12;
      for(const r of segs){
        const L=Math.hypot(r.b.x-r.a.x,r.b.y-r.a.y);run+=L;
        if(run<30||stones>=14)continue;
        run=0;
        const ux=(r.b.x-r.a.x)/(L||1),uy=(r.b.y-r.a.y)/(L||1),off=(Number(r.width)||.5)*.36+.45,m={x:(r.a.x+r.b.x)/2,y:(r.a.y+r.b.y)/2};
        if(tryPlace(out,obs,'milestone',[{x:m.x-uy*off,y:m.y+ux*off},{x:m.x+uy*off,y:m.y-ux*off}],Math.atan2(uy,ux),'milestone',id))stones++;
      }
    }
    // A few worn-out carts and wheels on country roads, away from the houses.
    const houses=State.structures.filter(s=>s.type==='house');
    const rural=primary.filter(r=>!houses.some(h=>Math.hypot(h.x-r.a.x,h.y-r.a.y)<10));
    const rnd=rngFor('roadside');
    for(let i=0;i<Math.min(4,Math.floor(rural.length/12));i++){
      const r=rural[Math.floor(rnd()*rural.length)],L=Math.hypot(r.b.x-r.a.x,r.b.y-r.a.y)||1,ux=(r.b.x-r.a.x)/L,uy=(r.b.y-r.a.y)/L;
      const off=(Number(r.width)||.5)*.36+1.1,m={x:(r.a.x+r.b.x)/2,y:(r.a.y+r.b.y)/2},side=rnd()<.5?1:-1;
      const a=pick(rnd,'roadside',{});if(a)tryPlace(out,obs,a,[{x:m.x-uy*off*side,y:m.y+ux*off*side}],Math.atan2(uy,ux),'roadside',r.id);
    }
  }
  function layout(){
    if(!M()||!Array.isArray(State.structures))return[];
    // Civic lot props (churchyard, inn tables) are placed first and kept clear of.
    const pre=window.ConquerCivic3D?.allLotProps?.()||[];
    const obs=buildObstacles(),out=pre.map(p=>({...p,civic:true}));
    const done=s=>!underConstruction(s);
    const fields=State.structures.filter(s=>s.type==='field'&&done(s));
    // Order = priority when space is contested: civic and work sites first, then yards.
    for(const s of State.structures.filter(s=>CIVIC_TYPES.includes(s.type)&&done(s)&&COUNTS[s.type]))ringProps(out,obs,s,s.type,civicRadius(s));
    for(const s of State.structures.filter(s=>window.ConquerIndustries?.is(s)&&done(s))){const t=window.ConquerIndustries.TYPES[s.type];ringProps(out,obs,s,s.type,Math.hypot(t.w,t.h)/2)}
    gateProps(out,obs);
    for(const w of State.structures.filter(s=>s.type==='well'&&done(s))){
      const rnd=rngFor('well:'+w.id),edge=(typeof WELL_PLAZA_SIZE!=='undefined'?WELL_PLAZA_SIZE:3)*.5;
      tryPlace(out,obs,'buckets',ring(w.x,w.y,edge+.25,edge+1.4,rnd,24),rnd()*6.3,'well',w.id);
    }
    roadProps(out,obs);
    houseProps(out,obs,fields);
    fieldProps(out,obs,fields);
    return out.slice(pre.length,pre.length+MAX_PROPS);
  }
  // Everything layout() reads, as a cheap string (callers cache layouts by it).
  function signature(){
    let h=0;const add=v=>{h=(Math.imul(h,31)+hash(String(v)))|0};
    for(const s of State.structures||[])add(s.id+s.type+(s.x??s.a?.x)+(s.y??s.a?.y)+(s.b?.x??'')+(s.b?.y??'')+(s.houseLevel||'')+(underConstruction(s)?'u':'c')+(s.angle||0)+(s.w||'')+(s.h||''));
    return[h,State.seed,State.season,State.relief?.seed,(State.environment||[]).length,typeof urbanRevision!=='undefined'?urbanRevision:0].join('|');
  }

  // ---------- geometry for the WebGL scene
  // Interleaved [x,y,z,r,g,b] triangles (world U, colours 0..1) shaded with the castle
  // two-tone rule for the camera quarter-turn, like the wagon.
  function worldMesh(props,turns=0){
    const m=M();if(!m)return new Float32Array(0);
    const W3=window.ConquerWagons3D,rgbOf=hex=>{const h=hex.replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};
    const pal=m.palette.map(rgbOf);
    let n=0;for(const p of props)n+=m.assets[p.asset].c.length;
    const out=new Float32Array(n*18);let o=0;
    for(const p of props){
      const a=m.assets[p.asset],k0=p.s||1,c=Math.cos(p.heading||0)*k0,s=Math.sin(p.heading||0)*k0,z0=terrainElevation(p);
      const V=a.v,I=a.i;
      for(let t=0;t<a.c.length;t++){
        const w=[];
        for(let k=0;k<3;k++){const j=I[t*3+k]*3,x=V[j],y=V[j+1];w.push(p.x+x*c-y*s,p.y+x*s+y*c,z0+V[j+2]*k0)}
        const ux=w[3]-w[0],uy=w[4]-w[1],uz=w[5]-w[2],vx=w[6]-w[0],vy=w[7]-w[1],vz=w[8]-w[2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
        const base=pal[a.c[t]],f=W3?W3.shadeFactor(nx,ny,nz,turns):1;
        const lum=(base[0]+base[1]+base[2])/3,ff=lum>.7?1-(1-f)*.55:f;
        for(let k=0;k<3;k++){out[o++]=w[k*3];out[o++]=w[k*3+1];out[o++]=w[k*3+2];out[o++]=base[0]*ff;out[o++]=base[1]*ff;out[o++]=base[2]*ff}
      }
    }
    return out;
  }
  window.ConquerScatter={layout,signature,worldMesh,RULES,COUNTS,__qa:{buildObstacles,free,blockedByTerrain}};
})();
