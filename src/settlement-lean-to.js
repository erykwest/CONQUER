'use strict';
// CONQUER lean-to (BC-251105-03/10): a W1 built section set against the interior face of an
// H2 curtain wall. Same 'built' type and the same rooms as the W1 section (one ground-floor room
// from 2U, settlement-castle-placement.js functionCapacity), one storey, and a single-pitch roof
// whose top edge leans on the wall under the wall walk (builtRoofGeometry), so the walk stays free.
//  - s.leanTo=true, s.leanWallId: the wall it leans on; s.leanSide: +1/-1, the side of the
//    section's a->b normal where the wall stands (the roof's high edge).
//  - Only H2 walls (2.10U): an H1 wall (1.15U) is lower than the lean-to's eaves.
(function(){
  const PICK=1.2;            // how far from a wall a click still picks it (U)
  const TOWER_PAD=.55;       // pulled back from a tower/gate socket at a snapped end
  const MIN_LENGTH=2;        // a W1 section has its room from 2U
  function leanWallOf(s){return State.structures.find(o=>o.id===s?.leanWallId)||null}
  function nearestWall(p){
    let best=null,bd=PICK;
    for(const w of State.structures){
      if(w.type!=='wall'||!w.a||!w.b)continue;
      const d=pointSegmentDistance(p,w.a,w.b);
      if(d<bd){bd=d;best=w}
    }
    return best;
  }
  // The section along the interior face of wall w (null + reason when it cannot stand there).
  function make(w){
    if(!w)return{ok:false,reason:'Click on the inner face of a curtain wall'};
    if(w.type!=='wall')return{ok:false,reason:'A lean-to stands against a curtain wall only'};
    if(underConstruction(w))return{ok:false,reason:'The wall is still under construction'};
    if(structureLevel(w)<2)return{ok:false,reason:'Lean-to needs an H2 wall: an H1 wall is lower than its eaves'};
    if(State.structures.some(o=>isLeanTo(o)&&o.leanWallId===w.id))return{ok:false,reason:'This wall already has a lean-to'};
    const dx=w.b.x-w.a.x,dy=w.b.y-w.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
    const side=wallExteriorSide(w),off=(Number(w.width)||.5)/2+TYPES.built.width/2;
    const pa=w.aSnap?TOWER_PAD:0,pb=w.bSnap?TOWER_PAD:0,length=L-pa-pb;
    if(length<MIN_LENGTH-1e-6)return{ok:false,reason:`Wall too short: a lean-to needs ${MIN_LENGTH}U clear of the towers`};
    const ix=-nx*side*off,iy=-ny*side*off;
    const s={
      id:uid(),type:'built',leanTo:true,leanWallId:w.id,leanSide:side,
      width:TYPES.built.width,level:1,flip:side===1,functions:[],
      masonryMaterial:masonryMaterial(w)||State.buildMasonryMaterial,
      a:{x:w.a.x+ux*pa+ix,y:w.a.y+uy*pa+iy},b:{x:w.b.x-ux*pb+ix,y:w.b.y-uy*pb+iy},
      length,rotationStep:w.rotationStep
    };
    return{ok:true,structure:s};
  }
  function atPoint(p){return make(nearestWall(p))}
  // Roof heights: eaves on the open side, the top edge on the wall a hand under the walk.
  const EAVES=1.40,UNDER_WALK=.12;
  function roofTop(s){
    const w=leanWallOf(s);
    return (w?structureHeight(w):2.10)-UNDER_WALK;
  }
  window.ConquerLeanTo=Object.freeze({make,atPoint,nearestWall,leanWallOf,roofTop,EAVES,MIN_LENGTH});
})();
