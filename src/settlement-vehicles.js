'use strict';
// CONQUER vehicles: carts, wagons and noble coaches that drive themselves along the
// real road network (from economic-balances-animations). Visual automation only:
// routing over completed road segments (Dijkstra), smoothed curves, speed that
// eases in, slows for bends and stops at the end, convoy spacing, drivers and
// walking escorts. Drawn ONLY in 2D: the modular wagon of settlement-wagons.js,
// whose team is the approved 2D horse (ConquerAnimals.drawAnimal). No 3D meshes.
// No economic rule lives here: callers (ConquerConvoys, road-sign tests) own
// cargo, money and status. Classic script; routing and motion are pure.
(function(){
  // Economy vehicle kinds (ConquerCommerce.VEHICLES) -> chassis, team and pace.
  // Speeds are QA pace in U per real second (a local test crosses the map in seconds).
  const KINDS=Object.freeze({
    cart:{chassis:'cart',team:1,speed:6.8,gap:1.7},
    wagon:{chassis:'wagon',team:2,speed:6.4,gap:2.2},
    coach:{chassis:'carriage',team:2,speed:7.4,gap:2.3}
  });
  const kindOf=k=>KINDS[k]||KINDS.wagon;
  // What each good looks like in the bed (settlement-wagons.js cargo pieces).
  const CARGO=Object.freeze({food:'sack',wood:'logs',stone:'stone',clay:'stone',metal:'crate',equipment:'crate',luxury:'barrel'});
  const COATS=['brown','black','grey','white'];
  const ACCEL=4.5,BEND_LOOKAHEAD=2.2;

  // ---------- road graph and routing
  const key=p=>Math.round(p.x*20)+','+Math.round(p.y*20);
  function roads(){
    return(State.structures||[]).filter(s=>s.type==='road'&&s.a&&s.b&&!s.destroyed&&
      !(typeof underConstruction==='function'&&underConstruction(s)));
  }
  let graphCache=null;
  function graph(){
    const list=roads(),sig=list.map(r=>key(r.a)+'>'+key(r.b)).join(';');
    if(graphCache&&graphCache.sig===sig)return graphCache;
    const nodes=new Map(),node=p=>{const k=key(p);if(!nodes.has(k))nodes.set(k,{k,x:p.x,y:p.y,adj:[]});return nodes.get(k)};
    const segs=[],link=(a,b)=>{const L=Math.hypot(b.x-a.x,b.y-a.y);if(L<1e-6)return;
      a.adj.push({to:b,len:L});b.adj.push({to:a,len:L});segs.push({a,b,len:L})};
    const ends=list.flatMap(r=>[r.a,r.b]);
    for(const r of list){
      // A spur may join a street mid-segment (T junction): split the street there.
      const cuts=ends.map(p=>({p,q:project(p,r.a,r.b)})).filter(({p,q})=>q.t>1e-3&&q.t<1-1e-3&&Math.hypot(q.x-p.x,q.y-p.y)<.06)
        .sort((u,v)=>u.q.t-v.q.t);
      let prev=node(r.a);
      for(const {p} of cuts){const n=node(p);if(n!==prev){link(prev,n);prev=n}}
      const last=node(r.b);if(last!==prev)link(prev,last);
    }
    graphCache={sig,nodes,segs};
    return graphCache;
  }
  function project(p,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/L));
    return{x:a.x+dx*t,y:a.y+dy*t,t};
  }
  // Nearest point on the network: {seg, x, y, d}.
  function attach(g,p){
    let best=null;
    for(const s of g.segs){const q=project(p,s.a,s.b),d=Math.hypot(q.x-p.x,q.y-p.y);if(!best||d<best.d)best={seg:s,x:q.x,y:q.y,d}}
    return best;
  }
  // Shortest road path between two points (each snapped onto its nearest road).
  // Returns world points or null when the two points are not connected by road.
  function route(from,to){
    const g=graph();if(!g.segs.length)return null;
    const A=attach(g,from),B=attach(g,to);if(!A||!B)return null;
    if(A.seg===B.seg)return[{x:A.x,y:A.y},{x:B.x,y:B.y}];
    // Dijkstra from the two ends of A's segment (seeded with the partial lengths).
    const dist=new Map(),prev=new Map(),open=[];
    const seed=(n,d)=>{if(d<(dist.get(n)??Infinity)){dist.set(n,d);prev.set(n,null);open.push(n)}};
    seed(A.seg.a,Math.hypot(A.x-A.seg.a.x,A.y-A.seg.a.y));seed(A.seg.b,Math.hypot(A.x-A.seg.b.x,A.y-A.seg.b.y));
    const done=new Set();
    while(open.length){
      let bi=0;for(let i=1;i<open.length;i++)if(dist.get(open[i])<dist.get(open[bi]))bi=i;
      const n=open.splice(bi,1)[0];if(done.has(n))continue;done.add(n);
      for(const e of n.adj){const d=dist.get(n)+e.len;if(d<(dist.get(e.to)??Infinity)){dist.set(e.to,d);prev.set(e.to,n);open.push(e.to)}}
    }
    const ends=[[B.seg.a,Math.hypot(B.x-B.seg.a.x,B.y-B.seg.a.y)],[B.seg.b,Math.hypot(B.x-B.seg.b.x,B.y-B.seg.b.y)]]
      .filter(([n])=>dist.has(n)).sort((p,q)=>dist.get(p[0])+p[1]-(dist.get(q[0])+q[1]));
    if(!ends.length)return null;
    const chain=[];for(let n=ends[0][0];n;n=prev.get(n))chain.unshift({x:n.x,y:n.y});
    const pts=[{x:A.x,y:A.y},...chain,{x:B.x,y:B.y}];
    return pts.filter((p,i)=>i===0||Math.hypot(p.x-pts[i-1].x,p.y-pts[i-1].y)>.02);
  }
  // Round the corners (Chaikin, endpoints kept) so wagons swing through bends.
  function smooth(points,iterations=2){
    let pts=points;
    for(let k=0;k<iterations&&pts.length>2;k++){
      const out=[pts[0]];
      for(let i=0;i<pts.length-1;i++){
        const a=pts[i],b=pts[i+1],L=Math.hypot(b.x-a.x,b.y-a.y),c=Math.min(.25,.9/Math.max(L,1e-6));
        if(i>0)out.push({x:a.x+(b.x-a.x)*c,y:a.y+(b.y-a.y)*c});
        if(i<pts.length-2)out.push({x:b.x-(b.x-a.x)*c,y:b.y-(b.y-a.y)*c});
      }
      out.push(pts[pts.length-1]);pts=out;
    }
    return pts;
  }
  // ---------- paths
  function makePath(points){
    const cum=[0];for(let i=1;i<points.length;i++)cum.push(cum[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
    return{pts:points,cum,total:cum[cum.length-1]||0};
  }
  const pathCache=new WeakMap();
  function pathOf(points){let p=pathCache.get(points);if(!p){p=makePath(points);pathCache.set(points,p)}return p}
  function at(path,s){
    const {pts,cum}=path;s=Math.max(0,Math.min(path.total,s));
    let lo=0,hi=cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(cum[m]<=s)lo=m;else hi=m}
    const a=pts[lo],b=pts[Math.min(lo+1,pts.length-1)],L=cum[Math.min(lo+1,cum.length-1)]-cum[lo];
    const t=L>1e-9?(s-cum[lo])/L:0;
    return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
  function headingAt(path,s){
    const a=at(path,s-.3),b=at(path,s+.3);
    return Math.atan2(b.y-a.y,b.x-a.x);
  }
  // How sharp the road turns over the next stretch: 0 straight .. pi hairpin.
  function bendAhead(path,s){
    const h0=headingAt(path,s),h1=headingAt(path,s+BEND_LOOKAHEAD);
    return Math.abs(Math.atan2(Math.sin(h1-h0),Math.cos(h1-h0)));
  }
  // One motion step for a convoy record {distance,speed,vehicle} along points.
  // Eases in from standstill, slows for bends, brakes to stop exactly at the end.
  function advance(rec,points,dt){
    const path=pathOf(points),k=kindOf(rec.vehicle),s=Math.min(path.total,rec.distance||0);
    const bend=Math.max(.45,1-bendAhead(path,s)/1.7);
    const brake=Math.sqrt(Math.max(0,2*ACCEL*(path.total-s)));
    const target=Math.min(k.speed*bend,brake+.35);
    const v=rec.speed||0,next=target>v?Math.min(target,v+ACCEL*dt):Math.max(target,v-ACCEL*1.6*dt);
    rec.speed=next;rec.distance=Math.min(path.total,s+next*dt);
    return rec.distance>=path.total-1e-6;
  }
  // ---------- appearance
  function cargoFor(good,qty,capacity,slots=6){
    if(!good)return[];
    const piece=CARGO[good]||'crate',n=Math.max(1,Math.min(piece==='logs'?4:slots,Math.ceil((qty||1)/(capacity||100)*slots)));
    return Array(n).fill(piece);
  }
  function specFor(c,i){
    const k=kindOf(c.vehicle),cap=c.vehicle==='cart'?40:100;
    const perVehicle=c.vehicles>1?Math.ceil((c.qty||0)/c.vehicles):(c.qty||0);
    const coat=COATS[(i*2+(c.seed||0))%COATS.length];
    return{chassis:k.chassis,team:Array.from({length:k.team},(_,h)=>({coat:h?COATS[(i*2+1+(c.seed||0))%4]:coat})),
      cargo:c.vehicle==='coach'?[]:cargoFor(c.good,perVehicle,cap,c.vehicle==='cart'?4:6)};
  }
  const ground=p=>typeof terrainElevation==='function'?terrainElevation(p):0;
  // Everything one convoy shows this frame: vehicles, drivers and escorts.
  // c: {id, vehicle, vehicles, good, qty, guards, livery, distance, speed, seed}
  function layout(c,points){
    const path=pathOf(points),k=kindOf(c.vehicle),out={vehicles:[],escorts:[]};
    const count=Math.max(1,Math.min(6,c.vehicles||1)),moving=(c.speed??1)>.05;
    for(let i=0;i<count;i++){
      const s=(c.distance||0)-i*k.gap;if(s<0)continue;          // still waiting at the start
      const p=at(path,s);
      out.vehicles.push({i,s,x:p.x,y:p.y,z:ground(p),heading:headingAt(path,s),moving,spec:specFor(c,i)});
    }
    // Escorts walk in pairs on both verges behind the last vehicle that has left.
    const tail=(c.distance||0)-(count-1)*k.gap-1.1;
    for(let i=0;i<Math.min(c.guards||0,8);i++){
      const s=tail-(i>>1)*.8;if(s<0)continue;
      const p=at(path,s),h=headingAt(path,s),side=i%2?-1:1;
      const q={x:p.x-Math.sin(h)*.48*side,y:p.y+Math.cos(h)*.48*side};
      out.escorts.push({i,x:q.x,y:q.y,z:ground(q),heading:h});
    }
    return out;
  }
  // Same on-screen size as livestock, knights and the messenger's 2D horse.
  const teamSize=()=>Math.max(1.5,(State.view.scale||1)*5.75);
  const DRIVER={kind:'peasant',age:'adult',sex:'male',colors:['#8a6a48','#5d4632'],hair:'#4a3626'};
  const COACHMAN={kind:'merchant',age:'adult',sex:'male',colors:['#3f4f6e','#c8a44a'],hair:'#2e2620'};
  // Drivers sit at the front of the bed; the carter walks at the horse's head.
  function drawDriver(c,v){
    if(typeof drawVillagerFigureUnmasked!=='function')return;
    const cart=kindOf(c.vehicle).chassis==='cart',ahead=cart?.75:.32,side=cart?.24:0;
    const p={x:v.x+Math.cos(v.heading)*ahead-Math.sin(v.heading)*side,
      y:v.y+Math.sin(v.heading)*ahead+Math.cos(v.heading)*side};
    const lift=cart?(v.moving?Math.abs(Math.sin(v.s*5.2))*.035:0):.22;
    const dot={...(c.vehicle==='coach'?COACHMAN:DRIVER),id:(cart?'carter-':'driver-')+c.id+'-'+v.i,p};
    if(typeof withProjectionGroundZ==='function')withProjectionGroundZ(v.z+lift,()=>drawVillagerFigureUnmasked(dot));
    else drawVillagerFigureUnmasked(dot);
  }
  function drawEscort(c,e){
    if(typeof drawSoldierFigure!=='function')return;
    drawSoldierFigure({x:e.x,y:e.y},.1,'spearman','convoy-'+c.id+'-'+e.i,State.clock.day,c.livery||null);
  }
  // Draw one convoy into the current 2D ctx, back to front.
  function draw(c,points){
    if(!points?.length||!c)return 0;
    const W2=window.ConquerWagons;if(!W2?.drawWagon||typeof w2s!=='function')return 0;
    const L=layout(c,points),size=teamSize(),k=kindOf(c.vehicle);
    const depth=p=>{const q=typeof rotateViewPoint==='function'?rotateViewPoint(p):p;return q.x+q.y};
    const items=[...L.vehicles.map(v=>({v,d:depth(v)})),...L.escorts.map(e=>({e,d:depth(e)}))].sort((a,b)=>a.d-b.d);
    for(const it of items){
      if(it.e){drawEscort(c,it.e);continue}
      const v=it.v,scr=w2s(v,.15),a=w2sRaw(v,0),b=w2sRaw({x:v.x+Math.cos(v.heading),y:v.y+Math.sin(v.heading)},0);
      W2.drawWagon(ctx,scr.x,scr.y,size,{chassis:k.chassis,team:v.spec.team,
        cargo:v.spec.cargo.length?v.spec.cargo:k.chassis==='carriage'?[]:['crate'],covered:false,
        facing:b.x>=a.x?1:-1,moving:v.moving,t:v.s*.5,distance:v.s*(typeof U!=='undefined'?U:12)*(State.view.scale||1)});
      drawDriver(c,v);
    }
    return L.vehicles.length;
  }

  // ---------- transient trips (pure animation, nothing persisted or charged)
  const trips=[];let seq=0;
  function spawn({vehicle='coach',from,to,points=null,vehicles=1,guards=0,livery=null,good='',qty=0}={}){
    const raw=points||(from&&to?route(from,to):null);if(!raw||raw.length<2)return null;
    const pts=smooth(raw),trip={id:'trip-'+(++seq),vehicle,vehicles,guards,livery,good,qty,
      seed:seq,points:pts,distance:0,speed:0,status:'moving'};
    trips.push(trip);return trip;
  }
  function tick(dt){
    if(!trips.length||!Number.isFinite(dt)||dt<=0)return false;
    for(const t of trips)if(t.status==='moving'&&advance(t,t.points,dt))t.status='arrived';
    for(let i=trips.length-1;i>=0;i--)if(trips[i].status==='arrived'){trips[i].linger=(trips[i].linger||0)+dt;if(trips[i].linger>1.5)trips.splice(i,1)}
    return true;
  }
  function drawTrips(){let n=0;for(const t of trips)n+=draw(t,t.points);return n}

  window.ConquerVehicles=Object.freeze({KINDS,CARGO,route,smooth,makePath,at,headingAt,bendAhead,advance,
    cargoFor,specFor,layout,draw,spawn,tick,drawTrips,trips:()=>trips.slice(),graph,teamSize});
})();
