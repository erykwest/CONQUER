'use strict';
// CONQUER vehicles: carts, wagons and noble coaches that drive themselves along the
// real road network. Visual automation only: routing over the completed road
// segments, smoothed curves, speed that eases in, slows for bends and stops at
// the end, convoy spacing, and the Blender-built 3D wagon / carriage
// (settlement-wagons3d.js) with its 3D horse team (settlement-animals3d.js), a
// seated driver and walking escorts. No economic rule lives here: callers (the
// road-sign convoy test, later real departures) own cargo, money and status.
// Classic script; routing and motion are pure functions of the given state.
(function(){
  const W3=()=>window.ConquerWagons3D,A3=()=>window.ConquerAnimals3D;
  // Economy vehicle kinds (ConquerCommerce.VEHICLES) -> chassis, team and pace.
  // Speeds are QA pace in U per real second (a local test crosses the map in seconds).
  const KINDS=Object.freeze({
    cart:{chassis:'cart',team:1,speed:6.8,gap:1.7,gait:'walk'},
    wagon:{chassis:'wagon',team:2,speed:6.4,gap:2.2,gait:'walk'},
    coach:{chassis:'carriage',team:2,speed:7.4,gap:2.3,gait:'run'}
  });
  const kindOf=k=>KINDS[k]||KINDS.wagon;
  // What each good looks like in the bed (wagon-model cargo pieces).
  const CARGO=Object.freeze({food:'sack',wood:'logs',stone:'stone',metal:'crate',equipment:'crate',luxury:'barrel'});
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
  // Painter view with the game projection (as settlement-mesh3d gameView).
  function gameView(){
    const plan=typeof isPlanView==='function'&&isPlanView();
    return{turns:State.view.rotation||0,project:(x,y,z)=>w2sRaw({x,y},z),
      depth:(x,y,z)=>{if(plan)return z;const q=typeof rotateViewPoint==='function'?rotateViewPoint({x,y}):{x,y};return q.x+q.y+(typeof ISO_Z!=='undefined'?ISO_Z:.9)*z}};
  }
  const ground=p=>typeof terrainElevation==='function'?terrainElevation(p):0;
  // Fast painter for moving vehicles: each vertex projected once with the game's
  // rotateViewPoint / w2sRaw maths inlined (no per-call objects), faces turned away
  // from the camera dropped (closed Blender meshes), shaded fills cached.
  const rgbCache=new Map(),fillCache=new Map(),OUTLINE='rgba(25,24,22,.92)';
  function rgb(hex){let v=rgbCache.get(hex);if(!v){const h=hex.replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));rgbCache.set(hex,v)}return v}
  function fillOf(hex,f){
    const k=hex+(f*1000|0);let v=fillCache.get(k);
    if(!v){const [r,g,b]=rgb(hex);v='rgb('+(r*f|0)+','+(g*f|0)+','+(b*f|0)+')';fillCache.set(k,v)}
    return v;
  }
  function viewParams(){
    const turns=(((State.view.rotation||0)%4)+4)%4,plan=typeof isPlanView==='function'&&isPlanView();
    const s=(typeof U!=='undefined'?U:12)*(State.view.scale||1),c=(typeof WORLD!=='undefined'?WORLD:200)/2;
    const IX=typeof ISO_X!=='undefined'?ISO_X:.866,IY=typeof ISO_Y!=='undefined'?ISO_Y:.5,IZ=typeof ISO_Z!=='undefined'?ISO_Z:.9;
    // d(depth)/d(world x,y,z): the direction towards the camera.
    const cam=plan?[0,0,1]:turns===1?[1,-1,IZ]:turns===2?[-1,-1,IZ]:turns===3?[-1,1,IZ]:[1,1,IZ];
    return{turns,plan,s,c,IX,IY,IZ,cam,ox:State.view.x,oy:State.view.y};
  }
  function paint(g,meshes,sprites){
    const V=viewParams(),{turns,plan,s,c,IX,IY,IZ,cam,ox,oy}=V,items=[];
    const rot=(x,y,out)=>{const dx=x-c,dy=y-c;
      if(turns===1){out[0]=c-dy;out[1]=c+dx}else if(turns===2){out[0]=c-dx;out[1]=c-dy}else if(turns===3){out[0]=c+dy;out[1]=c-dx}else{out[0]=x;out[1]=y}};
    const q=[0,0],depthOf=(x,y,z)=>{rot(x,y,q);return plan?z:q[0]+q[1]+IZ*z};
    const shade=W3()?.shadeFactor;
    for(const m of meshes){
      const p=m.pos,nv=p.length/3,sx=new Float32Array(nv),sy=new Float32Array(nv),dz=new Float32Array(nv);
      for(let i=0;i<nv;i++){
        const z=p[i*3+2];rot(p[i*3],p[i*3+1],q);
        if(plan){sx[i]=ox+q[0]*s;sy[i]=oy+q[1]*s;dz[i]=z}
        else{sx[i]=ox+(q[0]-q[1])*s*IX;sy[i]=oy+(q[0]+q[1])*s*IY-z*s*IZ;dz[i]=q[0]+q[1]+IZ*z}
      }
      const gd=m.groups?m.groups.map((g0,i)=>depthOf(g0[0],g0[1],g0[2])+(m.groupBias?.[i]||0)):null;
      if(m.flat&&gd){
        // Flat style (ConquerMesh3D.drawFlat in knights): each rigid part is one item,
        // outlined, filled with its colour or one shade tone.
        const byG=gd.map(()=>[]);
        for(let t=0;t<m.col.length;t++){
          const o=t*9,ux=p[o+3]-p[o],uy=p[o+4]-p[o+1],uz=p[o+5]-p[o+2],vx=p[o+6]-p[o],vy=p[o+7]-p[o+1],vz=p[o+8]-p[o+2];
          const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,f=shade&&shade(nx,ny,nz,turns)<.7?.88:1;
          byG[m.gi[t]].push({a:t*3,fill:fillOf(m.col[t],f),d:(dz[t*3]+dz[t*3+1]+dz[t*3+2])/3});
        }
        byG.forEach((tris,g)=>{if(tris.length)items.push({flat:tris.sort((u,v)=>u.d-v.d),sx,sy,d:gd[g],d2:0})});
        continue;
      }
      for(let t=0;t<m.col.length;t++){
        const a=t*3,o=t*9;
        const ux=p[o+3]-p[o],uy=p[o+4]-p[o+1],uz=p[o+5]-p[o+2],vx=p[o+6]-p[o],vy=p[o+7]-p[o+1],vz=p[o+8]-p[o+2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
        if(nx*cam[0]+ny*cam[1]+nz*cam[2]<=0)continue;               // back face
        const td=(dz[a]+dz[a+1]+dz[a+2])/3+(m.bias?.[t]||0);
        let f=shade?shade(nx,ny,nz,turns):1;const base=rgb(m.col[t]);
        if((base[0]+base[1]+base[2])/765>.7)f=1-(1-f)*.55;
        items.push({sx,sy,a,d:gd?gd[m.gi[t]]:td,d2:gd?td:0,fill:fillOf(m.col[t],f)});
      }
    }
    for(const sp of sprites)items.push({sprite:sp,d:depthOf(sp.x,sp.y,sp.z||0),d2:0});
    items.sort((u,v)=>u.d-v.d||u.d2-v.d2);
    g.save();g.lineJoin='round';g.lineWidth=.6;
    for(const it of items){
      if(it.sprite){g.restore();it.sprite.draw();g.save();g.lineJoin='round';g.lineWidth=.6;continue}
      if(it.flat){
        const {sx,sy}=it;g.beginPath();
        for(const t of it.flat){const a=t.a;g.moveTo(sx[a],sy[a]);g.lineTo(sx[a+1],sy[a+1]);g.lineTo(sx[a+2],sy[a+2]);g.closePath()}
        g.strokeStyle=OUTLINE;g.lineWidth=Math.max(1,(State.view.scale||1)*.5)*2;g.stroke();g.lineWidth=.6;
        for(const t of it.flat){const a=t.a;g.fillStyle=g.strokeStyle=t.fill;g.beginPath();g.moveTo(sx[a],sy[a]);g.lineTo(sx[a+1],sy[a+1]);g.lineTo(sx[a+2],sy[a+2]);g.closePath();g.fill();g.stroke()}
        continue;
      }
      const {sx,sy,a}=it;
      g.fillStyle=g.strokeStyle=it.fill;
      g.beginPath();g.moveTo(sx[a],sy[a]);g.lineTo(sx[a+1],sy[a+1]);g.lineTo(sx[a+2],sy[a+2]);g.closePath();g.fill();g.stroke();
    }
    g.restore();
    return items.length;
  }
  const LOD_3D_SCALE=1.1;
  // Horse gait input for vehicle v of a convoy (shared by the team and the cart shafts).
  const gaitOf=(k,v,i=0)=>({mode:v.moving?k.gait:'idle',t:v.s*(k.gait==='run'?.32:.55)+i*.12,seed:i});
  // Body motion on the road. Cart: balanced on one axle, the shafts ride the horse's
  // back, so the bed pitches with its stride; wagon: a slight roll; coach: it rocks
  // on its springs. pose gets {pitch, roll, pivot} (settlement-wagons3d tilt).
  function bodyMotion(c,v,spec){
    const k=kindOf(c.vehicle),m=window.ConquerWagonModel?.variants?.[k.chassis];if(!m)return{};
    const amp=Math.min(1,(c.speed||0)/2),s=v.s;
    if(k.chassis==='cart'){
      const axle=m.wheels[0].at[0],hitch=m.horses['1'][0];
      let lift=0;
      if(A3()&&window.ConquerAnimalModels?.horse){
        const st=A3().pose('horse',gaitOf(k,v));lift=-(st.bob||0)*window.ConquerAnimalModels.horse.height/230;
      }
      return{pitch:Math.atan2(lift,hitch[0]-axle[0])+.03,roll:Math.sin(s*1.7)*.022*amp,pivot:[axle[0],0,axle[2]]};
    }
    if(k.chassis==='carriage')return{pitch:Math.sin(s*2.4)*.022*amp,roll:Math.sin(s*1.6+1)*.03*amp,pivot:[.05,0,.25]};
    return{pitch:Math.sin(s*2.1)*.006*amp,roll:Math.sin(s*1.3)*.009*amp,pivot:[0,0,.2]};
  }    // below this zoom the 2D modular wagon reads better and costs less
  // Everything one convoy shows this frame: vehicles, teams, drivers and escorts.
  // c: {id, vehicle, vehicles, good, qty, guards, livery, distance, speed, seed}
  function layout(c,points){
    const path=pathOf(points),k=kindOf(c.vehicle),out={vehicles:[],escorts:[]};
    const count=Math.max(1,Math.min(6,c.vehicles||1)),moving=(c.speed||0)>.05;
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
  const DRIVER={kind:'peasant',age:'adult',sex:'male',colors:['#8a6a48','#5d4632'],hair:'#4a3626'};
  const COACHMAN={kind:'merchant',age:'adult',sex:'male',colors:['#3f4f6e','#c8a44a'],hair:'#2e2620'};
  function driverSprite(c,v,anchors,view){
    if(typeof drawVillagerFigureUnmasked!=='function')return null;
    // No seat (the cart): the carter walks at the horse's head on the near verge.
    if(!anchors.seat){
      const h=anchors.horses[0];if(!h)return null;
      const p={x:h.x-Math.sin(v.heading)*.22+Math.cos(v.heading)*.12,y:h.y+Math.cos(v.heading)*.22+Math.sin(v.heading)*.12};
      const bob=v.moving?Math.abs(Math.sin(v.s*5.2))*.035:0,gz=ground(p);
      return{x:p.x,y:p.y,z:gz,draw:()=>{
        const dot={...DRIVER,id:'carter-'+c.id+'-'+v.i,p};
        if(typeof withProjectionGroundZ==='function')withProjectionGroundZ(gz+bob,()=>drawVillagerFigureUnmasked(dot));else drawVillagerFigureUnmasked(dot);
      }};
    }
    const seat=anchors.seat,look=c.vehicle==='coach'?COACHMAN:DRIVER;
    // Sorted at chest height so the bed sides do not paint over the seated figure.
    return{x:seat.x,y:seat.y,z:seat.z+.55,draw:()=>{
      const dot={...look,id:'driver-'+c.id+'-'+v.i,p:{x:seat.x,y:seat.y}};
      // The figure stands at w2s(p,.10): lift the projection ground to the seat.
      if(typeof withProjectionGroundZ==='function')withProjectionGroundZ(seat.z-.1,()=>drawVillagerFigureUnmasked(dot));
      else drawVillagerFigureUnmasked(dot);
    }};
  }
  function escortSprite(c,e){
    if(typeof drawSoldierFigure!=='function')return null;
    return{x:e.x,y:e.y,z:e.z,draw:()=>drawSoldierFigure({x:e.x,y:e.y},.1,'spearman','convoy-'+c.id+'-'+e.i,
      State.clock.day,c.livery||null)};
  }
  // Draw one convoy into the current 2D ctx. 3D when the wagon and horse modules
  // are loaded, otherwise the 2D modular wagon (settlement-wagons.js).
  function draw(c,points){
    if(!points?.length||!c)return 0;
    const L=layout(c,points);
    if(!W3()||!window.ConquerWagonModel||(State.view.scale||1)<LOD_3D_SCALE)return draw2D(c,L);
    const view=gameView(),meshes=[],sprites=[];
    for(const v of L.vehicles){
      const pose={x:v.x,y:v.y,z:v.z,heading:v.heading,distance:v.s,bob:v.moving?Math.sin(v.s*9)*.004:0,...bodyMotion(c,v,v.spec)};
      meshes.push(W3().worldTriangles(v.spec,pose));
      const an=W3().anchors(v.spec,pose),k=kindOf(c.vehicle);
      if(A3()&&window.ConquerAnimalModels)an.horses.forEach((h,i)=>{
        const mesh=A3().triangles('horse',{...h,z:v.z,heading:v.heading},gaitOf(k,v,i),A3().coatColors('horse',v.spec.team[i]?.coat));
        mesh.flat=true;                                         // flat outlined style, like the 2D figures
        meshes.push(mesh);
      });
      const d=driverSprite(c,v,an,view);if(d)sprites.push(d);
    }
    for(const e of L.escorts){const s=escortSprite(c,e);if(s)sprites.push(s)}
    if(!meshes.length&&!sprites.length)return 0;
    stats.meshes=meshes.length;stats.sprites=sprites.length;stats.items=paint(ctx,meshes,sprites);
    return L.vehicles.length;
  }
  function draw2D(c,L){
    const W2=window.ConquerWagons;if(!W2?.drawWagon||typeof w2s!=='function')return 0;
    const size=Math.max(24,47*(State.view.scale||1));
    for(const v of [...L.vehicles].reverse()){
      const scr=w2s(v,.15),k=kindOf(c.vehicle);
      W2.drawWagon(ctx,scr.x,scr.y,size,{chassis:k.chassis==='cart'?'cart':'wagon',team:v.spec.team,
        cargo:v.spec.cargo.length?v.spec.cargo:['crate'],covered:c.vehicle==='coach',
        facing:Math.cos(v.heading)-Math.sin(v.heading)>=0?1:-1,moving:v.moving,t:v.s*.5,distance:v.s*(typeof U!=='undefined'?U:12)*(State.view.scale||1)});
    }
    for(const e of L.escorts){const s=escortSprite(c,e);if(s)s.draw()}
    return L.vehicles.length;
  }

  const stats={meshes:0,sprites:0,items:0};
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
    cargoFor,specFor,layout,draw,spawn,tick,drawTrips,trips:()=>trips.slice(),graph,stats:()=>({...stats})});
})();
