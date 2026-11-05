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
    const rise=ww.walkZ(s),span=(model.run+model.landing)*rise;
    if(span>L-2*END_CLEAR)return null;              // the wall is too short for this flight
    // `along` (U from the lane's a end to the foot) pins a flight that survived a breach in place.
    const x0=Number.isFinite(spec.along)?spec.along:clampNum((POSITIONS[spec.pos]??.5)*L-span/2,END_CLEAR,L-END_CLEAR-span);
    if(x0<0||x0+span>L+1e-6)return null;
    const foot={x:lane.a.x+ux*x0+nx*half,y:lane.a.y+uy*x0+ny*half};
    const tTop=(x0+model.run*rise+model.landing*rise*.5)/L;
    return{s,spec,model,ux,uy,nx,ny,half,rise,run:model.run*rise,foot,x0,L,
      tTop:Math.min(1,tTop),tFoot:x0/L,
      ground:{x:foot.x+nx*(model.width+.25)-ux*.15,y:foot.y+ny*(model.width+.25)-uy*.15}};
  }
  function clampNum(v,a,b){return Math.max(a,Math.min(b,v))}
  // Access for the wall-walk network: ground at the foot, entry on the walk at the top step.
  function access(s){
    const l=layout(s);if(!l)return null;
    return{id:'wallstair:'+s.id,structure:s,kind:l.spec.kind,ground:l.ground,entry:{wallId:s.id,t:l.tTop}};
  }
  function triangles(s,spec){
    const l=layout(s,spec);if(!l)return[];
    const d=data(),pal=d.palette,keys=d.paletteKeys,out=[];
    // Model +x along u, +y along the interior normal: if that frame is left-handed, the
    // model is mirrored and the winding reversed so faces keep pointing out.
    const mirror=l.ux*l.ny-l.uy*l.nx<0,order=mirror?[0,2,1]:[0,1,2];
    const snow=typeof winterSnowColor==='function';
    const color=ci=>snow&&keys[ci].startsWith('tread')?winterSnowColor(pal[ci],ci%2?WINTER_SNOW_A:WINTER_SNOW_B):pal[ci];
    const at=(x,y)=>({x:l.foot.x+l.ux*x*l.rise+l.nx*y,y:l.foot.y+l.uy*x*l.rise+l.ny*y});
    for(const [name,part] of Object.entries(l.model.parts)){
      const p=part.p,ix=part.i;
      for(let k=0;k<part.c.length;k++){
        const pts=order.map(j=>{const v=ix[k*3+j]*3;return{p:at(p[v],p[v+1]),z:p[v+2]*l.rise}});
        out.push({pts,hex:color(part.c[k]),key:keys[part.c[k]],part:name});
      }
    }
    return out;
  }
  // 2.5D: far to near, back faces skipped (as drawPointHoarding / drawRoomExterior).
  // A flight on the face turned away from the camera is behind its own wall (its top is the walk,
  // below the merlons): not painted. One in front is painted over the wall, clipped by the
  // structures that stand in front of it.
  function facesCamera(l){
    return viewDepthPoint({x:l.foot.x+l.nx,y:l.foot.y+l.ny})>viewDepthPoint(l.foot);
  }
  function draw(s){
    const l=layout(s);if(!l||!facesCamera(l))return;
    const tris=triangles(s);if(!tris.length)return;
    const depth=t=>t.pts.reduce((a,q)=>a+viewDepthPoint(q.p)+ISO_Z*q.z,0)/3;
    const paint=()=>{
      for(const {t} of tris.map(t=>({t,d:depth(t)})).sort((a,b)=>a.d-b.d)){
        const [a,b,c]=t.pts.map(q=>w2s(q.p,q.z));
        if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0)continue;
        pathPolygon([a,b,c],t.hex,t.hex,.6);
      }
    };
    if(typeof withStructureDetailOcclusion==='function')withStructureDetailOcclusion(s,l.rise*1.24,paint);else paint();
  }
  function drawAll(){
    const items=State.structures.filter(s=>isLinear(s)&&s.wallStair&&!underConstruction(s))
      .slice().sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of items)(typeof withStructureVisualMaterial==='function'?withStructureVisualMaterial(s,()=>draw(s)):draw(s));
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
    const cur=stair(s)?.kind;
    if(cur===kind)return false;
    if(cur==='stone'&&kind==='wood'){status('La scala lapidea non torna lignea: rimuovila prima');return false}
    const spec={kind,pos:s.wallStair?.pos||'middle'};
    if(!layout(s,spec)){status('Muro troppo corto per questa scala');return false}
    const cost=COST[kind];
    if(typeof canAfford==='function'&&!canAfford(cost)){status('Risorse insufficienti · '+costText(cost));return false}
    if(typeof spendCost==='function')spendCost(cost);
    s.wallStair=spec;refresh(s);
    status(kind==='wood'?'Scala lignea costruita sul camminamento':'Scala lapidea costruita sul camminamento');return true;
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
    const f0=l.x0,f1=l.x0+(l.model.run+l.model.landing)*l.rise;
    if(left&&f1<=from)left.wallStair={kind:l.spec.kind,pos:l.spec.pos,along:f0};
    else if(right&&f0>=to)right.wallStair={kind:l.spec.kind,pos:l.spec.pos,along:f0-to};
    else return null;                                // the flight stood in the bay: it comes down
    return left?.wallStair?left:right;
  }
  window.ConquerWallStairs={splitOnBreach,KINDS,POSITIONS,COST,eligible,allowedKind,stair,layout,access,triangles,draw,drawAll,setKind,setPos};
})();
