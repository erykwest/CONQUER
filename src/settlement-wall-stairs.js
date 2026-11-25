'use strict';
// Wall-walk stairs (BC-251105-01 timber, BC-251105-02 masonry): an upgrade of a finished
// wall (T2+, the walls that have a walk) that climbs from the bailey to the cammino di ronda.
// State on the wall: wall.wallStair = {kind:'wood'|'stone', pos:'start'|'middle'|'end'}.
//  - The flight runs along the INTERIOR face of the wall, its top step flush with the walk.
//  - The Blender models (src/assets/wall-stair-models.js, rise 1 U) are scaled in run and rise
//    by the real walk height, so the slope and the step count stay those modelled.
//  - The stair is an access of the wall-walk network (settlement-wallwalk.js stairs()): men climb
//    from its foot and come out on the walk at its top, like the stair of a tower or a gate.
//  - Both on stone walls; timber -> masonry is an upgrade (masonry never goes back to timber).
// Triangles are [{pts:[{p,z}x3], hex, key}], z above the ground under each vertex, as the
// room exteriors: castle 3D / World 3D / Asset Lab read them in bodyMesh(), 2.5D draws them here.
(function(){
  const KINDS=['wood','stone'],POSITIONS={start:.22,middle:.5,end:.78};
  const COST={wood:{gold:4,wood:14},stone:{gold:8,stone:22}};
  const END_CLEAR=.25;                              // U kept free at each end (tower/gate snaps)
  const WW=()=>window.ConquerWallWalk;
  const data=()=>window.ConquerWallStairModels||null;
  // Stone walls only for now: palisades keep the 2.5D renderer (no castle-3D body) and their own
  // earth-bank walkway; a timber stair for them is a follow-up.
  const isLinear=s=>!!s&&s.type==='wall'&&!!s.a&&!!s.b;
  function allowedKind(s,kind){return isLinear(s)&&KINDS.includes(kind)}
  function eligible(s){return isLinear(s)&&!!WW()?.walkable(s)}
  function stair(s){
    const st=s?.wallStair;
    return st&&KINDS.includes(st.kind)&&allowedKind(s,st.kind)?st:null;
  }
  // Plan of the flight: foot/top points, along/interior axes, rise, run and wall-walk params.
  function layout(s,spec=stair(s)){
    const d=data();if(!spec||!d||!eligible(s))return null;
    const model=d.models[spec.kind==='stone'?'stairStone':'stairWood'];if(!model)return null;

    const ww=WW(),lane=ww.edgeOf(s.id);if(!lane)return null;
    const L=Math.hypot(lane.b.x-lane.a.x,lane.b.y-lane.a.y);if(L<.5)return null;
    const ux=(lane.b.x-lane.a.x)/L,uy=(lane.b.y-lane.a.y)/L;
    const side=typeof wallExteriorSide==='function'?wallExteriorSide(s):1;
    const nx=uy*side,ny=-ux*side;                   // interior = opposite of the exterior (-uy*side, ux*side)
    const half=(Number(s.width)||.5)/2;
    const rise=ww.walkZ(s),dl=stairPlan(s,structureHeight(s));   // the steps reach the wall top (the walk floor), not the feet height
    const span=dl.span;
    if(span>L-2*END_CLEAR)return null;              // the wall is too short for this flight
    // `along` (U from the lane's a end to the foot) pins a flight that survived a breach in place.
    const x0=Number.isFinite(spec.along)?spec.along:clampNum((POSITIONS[spec.pos]??.5)*L-span/2,END_CLEAR,L-END_CLEAR-span);
    if(x0<0||x0+span>L+1e-6)return null;
    const foot={x:lane.a.x+ux*x0+nx*half,y:lane.a.y+uy*x0+ny*half};
    const tTop=(x0+dl.topU)/L;
    return{s,spec,model,ux,uy,nx,ny,half,rise,run:dl.span,foot,x0,L,dog:dl,
      tTop:Math.min(1,tTop),tFoot:x0/L,
      ground:{x:foot.x+ux*(dl.footU-.15)+nx*((2*dl.W+dl.gap)+.25),y:foot.y+uy*(dl.footU-.15)+ny*((2*dl.W+dl.gap)+.25)}};
  }
  function clampNum(v,a,b){return Math.max(a,Math.min(b,v))}
  // Access for the wall-walk network: ground at the foot, entry on the walk at the top step.
  function access(s){
    const l=layout(s);if(!l)return null;
    return{id:'wallstair:'+s.id,structure:s,kind:l.spec.kind,ground:l.ground,entry:{wallId:s.id,t:l.tTop}};
  }
  // Stairs built as steps of a fixed rise (about 0.18U), so a taller wall adds steps and does not
  // stretch them. Every stair ends on a landing at the walk, flush with it.
  //  - H1 (walk 1.25): one flight from the ground along the wall, then the arrival landing.
  //  - H2 (walk 2.45): a dog-leg: flight 1 climbs on the inner side to a mid landing at half
  //    height, flight 2 comes back against the wall, then the arrival landing at the walk.
  const STEP_RISE=.18,TREAD=.28,LAND=.6,FLIGHT_W=.8,GAP=.1,DOG_MIN_RISE=2;
  function doglegOn(s){return !!s&&s.type==='wall'&&WW().walkZ(s)>=DOG_MIN_RISE}
  function stairPlan(s,rise){
    if(doglegOn(s)){
      const half=rise/2,n=Math.max(2,Math.ceil(half/STEP_RISE)),r=half/n,F=n*TREAD;
      return{kind:'dog',rise,n,r,F,D:LAND,span:F+2*LAND,topU:LAND/2,footU:LAND,W:FLIGHT_W,gap:GAP};
    }
    const n=Math.max(2,Math.ceil(rise/STEP_RISE)),r=rise/n,F=n*TREAD;
    return{kind:'flight',rise,n,r,F,D:LAND,span:F+LAND,topU:F+LAND/2,footU:0,W:FLIGHT_W,gap:0};
  }
  // Solid boxes (from the ground up) of the stair in wall-frame U (along the wall from the foot)
  // and N (from the wall face into the bailey).
  function stairBoxes(l){
    const p=l.dog,out=[];
    if(p.kind==='flight'){
      for(let i=0;i<p.n;i++)out.push({u0:i*TREAD,u1:(i+1)*TREAD,n0:0,n1:p.W,z1:(i+1)*p.r,key:'tread'});
      out.push({u0:p.F,u1:p.F+LAND,n0:0,n1:p.W,z1:p.rise,key:'landing'});
      return out;
    }
    // H2 dog-leg along the wall: arrival landing [0,A] | both flights side by side [A,M] | mid
    // landing [M,M+LAND]. Flight 2 starts at the edge of the mid landing (not over it).
    const A=LAND,M=LAND+p.F;
    // Flight 1 climbs from the ground on the inner side towards the mid landing.
    for(let i=0;i<p.n;i++)out.push({u0:A+i*TREAD,u1:A+(i+1)*TREAD,n0:p.W+p.gap,n1:2*p.W+p.gap,z1:(i+1)*p.r,key:'tread'});
    // Mid landing past the end of both flights, across their full width, up to the wall.
    out.push({u0:M,u1:M+LAND,n0:0,n1:2*p.W+p.gap,z1:p.rise/2,key:'landing'});
    // Flight 2 climbs back against the wall from the mid landing to the arrival landing.
    for(let j=0;j<p.n;j++){const u1=M-j*TREAD;out.push({u0:u1-TREAD,u1,n0:0,n1:p.W,z1:p.rise/2+(j+1)*p.r,key:'tread'})}
    // Arrival landing at the walk, against the wall and flush with it.
    out.push({u0:0,u1:A,n0:0,n1:p.W,z1:p.rise,key:'landing'});
    return out;
  }
  function stairTriangles(l,color){
    const P=(u,n,z)=>({p:{x:l.foot.x+l.ux*u+l.nx*n,y:l.foot.y+l.uy*u+l.ny*n},z});
    const out=[];
    const quad=(a,b,c,d,hex,key)=>{out.push({pts:[a,b,c],hex,key,part:'stair'},{pts:[a,c,d],hex,key,part:'stair'})};
    for(const b of stairBoxes(l)){
      const hex=color(b.key),side=color('side');
      const {u0,u1,n0,n1,z1}=b;
      quad(P(u0,n0,z1),P(u1,n0,z1),P(u1,n1,z1),P(u0,n1,z1),hex,b.key);   // top
      const z0=0;                                                       // solid down to the ground
      quad(P(u0,n0,z0),P(u1,n0,z0),P(u1,n0,z1),P(u0,n0,z1),side,'side');  // wall-side edge
      quad(P(u0,n1,z0),P(u1,n1,z0),P(u1,n1,z1),P(u0,n1,z1),side,'side');  // outer edge
      quad(P(u0,n0,z0),P(u0,n1,z0),P(u0,n1,z1),P(u0,n0,z1),side,'side');  // start
      quad(P(u1,n0,z0),P(u1,n1,z0),P(u1,n1,z1),P(u1,n0,z1),side,'side');  // end
    }
    return out;
  }
  function triangles(s,spec){
    const l=layout(s,spec);if(!l)return[];
    const stone=l.spec.kind==='stone';
    // Masonry stairs use the wall's own masonry greys (castle3d PAL.stone: top, side). The
    // renderer maps them like the wall (visualPaletteColor: stone family, clay, brick), so the
    // stair always matches its wall. Timber keeps its planks.
    const color=k=>stone?(k==='side'?'#635951':'#9a8e82'):(k==='side'?'#5a4124':'#b08a5c');
    return stairTriangles(l,color);
  }
  // Commands (StructureCommands.setWallStair / setWallStairPos).
  function refresh(s){
    WW()?.invalidate();
    if(typeof markStructureDirty==='function')markStructureDirty(s,true);
    if(typeof renderFunctionPanel==='function')renderFunctionPanel();
    if(typeof window.draw==='function')window.draw();
  }
  function setKind(s,kind){
    if(!isLinear(s))return false;
    if(kind==='none'){
      if(!s.wallStair)return false;
      delete s.wallStair;refresh(s);status('Scala del camminamento rimossa');return true;
    }
    if(!allowedKind(s,kind))return false;
    if(!eligible(s)){status('Scala: serve un muro finito T2 o T3 con camminamento');return false}
    // The lean-to and the stair share the inner face: one of the two per wall.
    if(State.structures.some(o=>o.leanTo&&o.leanWallId===s.id)){status('Sul muro c’è un addossato: rimuovilo prima di fare la scala');return false}
    const cur=stair(s)?.kind;
    if(cur===kind)return false;
    if(cur==='stone'&&kind==='wood'){status('La scala lapidea non torna lignea: rimuovila prima');return false}
    const spec={kind,pos:s.wallStair?.pos||'middle'};
    if(!layout(s,spec)){status('Muro troppo corto per questa scala');return false}
    const cost=COST[kind];
    const before=structureUpgradeSnapshot(s);
    s.wallStair=spec;
    // Since #194 the stair is a paid building site, not an instant build.
    const started=beginStructureUpgrade(s,before,cost,1);refresh(s);
    status(started?(kind==='wood'?'Scala lignea in costruzione sul camminamento':'Scala lapidea in costruzione sul camminamento')
      :(kind==='wood'?'Scala lignea sul camminamento':'Scala lapidea sul camminamento'));return true;
  }
  function setPos(s,pos){
    if(!stair(s)||!(pos in POSITIONS))return false;
    const spec={kind:s.wallStair.kind,pos};
    if(!layout(s,spec)){status('La scala non entra in quel punto del muro');return false}
    s.wallStair=spec;refresh(s);return true;
  }
  // Breach of bay [from,to] (U from s.a) splitting s into left (s.a..from) and right (to..s.b).
  // Walls carry their lane on the centre line, so lane distances are wall distances.
  function splitOnBreach(s,from,to,left,right){
    for(const p of [left,right])if(p)delete p.wallStair;
    const l=layout(s);if(!l)return null;
    const f0=l.x0,f1=l.x0+l.dog.span;
    if(left&&f1<=from)left.wallStair={kind:l.spec.kind,pos:l.spec.pos,along:f0};
    else if(right&&f0>=to)right.wallStair={kind:l.spec.kind,pos:l.spec.pos,along:f0-to};
    else return null;                                // the flight stood in the bay: it comes down
    return left?.wallStair?left:right;
  }
  window.ConquerWallStairs={splitOnBreach,KINDS,POSITIONS,COST,eligible,allowedKind,stair,layout,access,triangles,setKind,setPos};
})();
