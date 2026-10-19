'use strict';
// CONQUER wall walks: the tops of completed walls (T2+) and palisades as a walkable
// network, so troops can be sent onto the walls and fight along them.
//  - Each wall/palisade is an edge along its walkway, at the patrols' height.
//  - Ends that meet (a run of walls, a dogleg joint) are joined; ends seated on a tower
//    or gate are joined through that tower/gate, which is also the stair: its access
//    point is on the ground on the interior side (defenders climb there).
//  - A breach splits a wall into stretches that no longer touch, so the network
//    is cut there by construction (settlement-siege.js).
// Locations on the network are {edge, t}: t in [0,1] along the wall a->b.
(function(){
  const JOIN=.08;                      // ends closer than this are one joint
  const walkable=s=>!!s&&s.a&&s.b&&!underConstruction(s)&&
    (s.type==='wall'||s.type==='palisade')&&wallTier(s)>=2;
  function walkZ(s){
    return s.type==='palisade'&&typeof palisadePatrolSurface==='function'?palisadePatrolSurface(s).z:structureHeight(s)+.10;
  }
  // The lane the men walk on: wall centre line, palisade walkway (behind the stakes).
  function lane(s){
    if(s.type==='palisade'&&typeof palisadeLayout==='function'){
      const pg=palisadeLayout(s),off=(palisadePatrolSurface(s).offset||0)*pg.side;
      return{a:{x:pg.a.x+pg.nx*off,y:pg.a.y+pg.ny*off},b:{x:pg.b.x+pg.nx*off,y:pg.b.y+pg.ny*off}};
    }
    return{a:s.a,b:s.b};
  }
  // Interior side of a tower/gate: where its stair comes down.
  function interiorOf(h){
    if(h.type==='gate'){const a=Number(h.angle)||0;return{x:-Math.cos(a),y:-Math.sin(a)}}
    return typeof structureInteriorVector==='function'?structureInteriorVector(h):{x:1,y:0};
  }
  let cache={sig:null};
  function signature(){
    let sig='';
    for(const s of State.structures){
      if(s.type==='wall'||s.type==='palisade')sig+=s.id+(walkable(s)?'w':'x')+s.a?.x+','+s.a?.y+','+s.b?.x+','+s.b?.y+(s.level||1)+(s.tier||'')+(s.aSnap||'')+(s.bSnap||'')+(s.flip?1:0)+';';
      else if(s.type==='tower'||s.type==='gate')sig+=s.id+(underConstruction(s)?'u':'c')+s.x+','+s.y+(s.angle||0)+';';
    }
    return sig;
  }
  function graph(){
    // The signature walks every structure: re-check it at most twice a second
    // unless the structure list itself was replaced or resized.
    const now=typeof performance!=='undefined'?performance.now():0;
    if(cache.sig&&cache.list===State.structures&&cache.count===State.structures.length&&now-cache.at<500)return cache;
    const sig=signature();
    if(cache.sig===sig){cache.at=now;cache.list=State.structures;cache.count=State.structures.length;return cache}
    const nodes=[],edges=[],hubs=new Map();
    const node=(p,z,key=null)=>{
      let n=key?nodes.find(m=>m.key===key):nodes.find(m=>!m.key&&Math.hypot(m.x-p.x,m.y-p.y)<JOIN&&Math.abs(m.z-z)<.3);
      if(!n){n={id:nodes.length,x:p.x,y:p.y,z,key,adj:[]};nodes.push(n)}
      return n;
    };
    const link=(a,b,len,edge=null)=>{a.adj.push({to:b,len,edge});b.adj.push({to:a,len,edge})};
    for(const s of State.structures){
      if(!walkable(s))continue;
      const z=walkZ(s),l=lane(s),A=node(l.a,z),B=node(l.b,z);
      const e={id:edges.length,wall:s,a:l.a,b:l.b,len:Math.hypot(l.b.x-l.a.x,l.b.y-l.a.y),z,A,B};
      edges.push(e);link(A,B,e.len,e);
      // Ends seated on a tower/gate join through it; the tower/gate is a stair.
      for(const [end,n] of [['aSnap',A],['bSnap',B]]){
        const h=s[end]&&State.structures.find(x=>x.id===s[end]&&['tower','gate'].includes(x.type)&&!underConstruction(x));
        if(!h)continue;
        const hub=node({x:h.x,y:h.y},z,'hub:'+h.id);hub.z=Math.max(hub.z,z);
        link(n,hub,Math.hypot(h.x-n.x,h.y-n.y));
        if(!hubs.has(h.id)){
          const iv=interiorOf(h),r=(typeof pointRadius==='function'?pointRadius(h):.75)+.45;
          // entry: the wall end next to the tower, where the stair comes out on the walk.
          hubs.set(h.id,{id:'stair:'+h.id,structure:h,node:hub,ground:{x:h.x+iv.x*r,y:h.y+iv.y*r},
            entry:{wallId:s.id,t:end==='aSnap'?0:1}});
        }
      }
    }
    // Connected components: men only meet on walls that are joined.
    let comp=0;
    for(const n of nodes){
      if(n.comp!==undefined)continue;
      const stack=[n];n.comp=comp;
      while(stack.length){const m=stack.pop();for(const {to} of m.adj)if(to.comp===undefined){to.comp=comp;stack.push(to)}}
      comp++;
    }
    cache={sig,nodes,edges,stairs:[...hubs.values()],at:now,list:State.structures,count:State.structures.length};
    return cache;
  }
  const edgeOf=id=>graph().edges.find(e=>e.wall.id===id)||null;
  function at(loc){
    const e=typeof loc.edge==='object'?loc.edge:edgeOf(loc.wallId);if(!e)return null;
    const t=Math.max(0,Math.min(1,loc.t));
    return{x:e.a.x+(e.b.x-e.a.x)*t,y:e.a.y+(e.b.y-e.a.y)*t,z:e.z,wallId:e.wall.id,t};
  }
  // Nearest walkway point to a world point (within maxDist of the lane).
  function locate(p,maxDist=Infinity){
    let best=null;
    for(const e of graph().edges){
      const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,L2=dx*dx+dy*dy||1;
      const t=Math.max(0,Math.min(1,((p.x-e.a.x)*dx+(p.y-e.a.y)*dy)/L2));
      const q={x:e.a.x+dx*t,y:e.a.y+dy*t},d=Math.hypot(p.x-q.x,p.y-q.y);
      if(d<=maxDist&&(!best||d<best.d))best={edge:e,wallId:e.wall.id,t,x:q.x,y:q.y,z:e.z,d};
    }
    return best;
  }
  // Pick the wall top under a screen point (the wall top is drawn at its height).
  function pickScreen(sp,px=14){
    let best=null;
    for(const e of graph().edges){
      const a=w2s(e.a,e.z),b=w2s(e.b,e.z),dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1;
      const t=Math.max(0,Math.min(1,((sp.x-a.x)*dx+(sp.y-a.y)*dy)/L2));
      const d=Math.hypot(sp.x-a.x-dx*t,sp.y-a.y-dy*t);
      if(d<=px&&(!best||d<best.d))best={edge:e,wallId:e.wall.id,t,d,...at({edge:e,t})};
    }
    return best;
  }
  const component=loc=>{const e=typeof loc.edge==='object'?loc.edge:edgeOf(loc.wallId);return e?e.A.comp:null};
  // Shortest walk between two walkway locations (same component) -> points with z.
  function route(from,to){
    const g=graph(),e0=typeof from.edge==='object'?from.edge:edgeOf(from.wallId),e1=typeof to.edge==='object'?to.edge:edgeOf(to.wallId);
    if(!e0||!e1||e0.A.comp!==e1.A.comp)return null;
    const p0=at({edge:e0,t:from.t}),p1=at({edge:e1,t:to.t});
    if(e0===e1)return{points:[p0,p1],length:Math.abs(to.t-from.t)*e0.len};
    // Dijkstra from the two ends of the start edge.
    const dist=new Map(),prev=new Map(),open=new Set();
    const seed=(n,d)=>{if(d<(dist.get(n)??Infinity)){dist.set(n,d);prev.set(n,null);open.add(n)}};
    seed(e0.A,from.t*e0.len);seed(e0.B,(1-from.t)*e0.len);
    while(open.size){
      let n=null;for(const m of open)if(!n||dist.get(m)<dist.get(n))n=m;
      open.delete(n);
      for(const {to:m,len,edge} of n.adj){
        if(edge===e0)continue;
        const d=dist.get(n)+len;
        if(d<(dist.get(m)??Infinity)){dist.set(m,d);prev.set(m,n);open.add(m)}
      }
    }
    const viaA=(dist.get(e1.A)??Infinity)+to.t*e1.len,viaB=(dist.get(e1.B)??Infinity)+(1-to.t)*e1.len;
    if(!Number.isFinite(Math.min(viaA,viaB)))return null;
    const chain=[];for(let n=viaA<=viaB?e1.A:e1.B;n;n=prev.get(n))chain.unshift({x:n.x,y:n.y,z:n.z});
    return{points:[p0,...chain,p1],length:Math.min(viaA,viaB)};
  }
  // Stairs reachable from a component (towers/gates joined to those walls).
  const stairs=(comp=null)=>graph().stairs.filter(s=>comp===null||s.node.comp===comp);
  // Wall frame at a location: along/across axes, exterior side, half width.
  function frame(loc){
    const e=typeof loc.edge==='object'?loc.edge:edgeOf(loc.wallId);if(!e)return null;
    const s=e.wall,L=Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)||1,ux=(s.b.x-s.a.x)/L,uy=(s.b.y-s.a.y)/L;
    const side=typeof wallExteriorSide==='function'?wallExteriorSide(s):1;
    return{wall:s,ux,uy,ex:-uy*side,ey:ux*side,half:(Number(s.width)||.5)/2,L};
  }
  window.ConquerWallWalk={graph,walkable,walkZ,locate,pickScreen,route,stairs,component,at,frame,edgeOf,
    invalidate:()=>{cache={sig:null}}};
})();
