'use strict';
// Oriented stone towers: the open-backed semitower (shape 'half', the "]" of town walls) and the
// D tower (shape 'dee', round front and flat back). Local +x is the field side (s.angle points out
// of the walls), -x the rear, flush with the inner face of the wall or with the back of a gate.
// Gameplay code reads them as rectangles (rectDims = bounding box, w along the angle = depth);
// the true outline, body, crown, roof, base and the wall/gate seats come from here.
// Specs, tiers and dims live in settlement-core.js (ORIENTED_TOWER_SPECS).
const HALF_TOWER_WALL=.16;   // masonry of the three walls of a semitower
const DEE_ARC_STEPS=12;
function orientedTowerWorld(s,local){
  const a=s.angle||0,ca=Math.cos(a),sa=Math.sin(a);
  return local.map(([x,y])=>({x:s.x+x*ca-y*sa,y:s.y+x*sa+y*ca}));
}
function orientedTowerDir(s,x,y){const a=s.angle||0;return{x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}}
// D outline in local coordinates, shrunk by `inset` (negative grows it: eaves, splayed base, machicolations).
function deeTowerLocalOutline(s,inset=0,steps=DEE_ARC_STEPS){
  const {w,h}=orientedTowerDims(s),r=h/2-inset,x0=-w/2+inset,cx=w/2-h/2,pts=[[x0,-r]];
  for(let i=0;i<=steps;i++){const a=-Math.PI/2+i/steps*Math.PI;pts.push([cx+Math.cos(a)*r,Math.sin(a)*r])}
  pts.push([x0,r]);
  return pts;
}
function orientedTowerOutline(s,inset=0){
  if(s.shape==='dee')return orientedTowerWorld(s,deeTowerLocalOutline(s,inset));
  const {w,h}=orientedTowerDims(s);
  return rectWorldPoints(s.x,s.y,w-inset*2,h-inset*2,s.angle||0);
}
// Semitower body: three convex wall slabs (the 3D mesh fans its faces, a U polygon would not).
function halfTowerBodyPieces(s){
  const {w,h}=orientedTowerDims(s),t=HALF_TOWER_WALL,rect=(x0,x1,y0,y1)=>orientedTowerWorld(s,[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
  return[rect(w/2-t,w/2,-h/2,h/2),rect(-w/2,w/2-t,-h/2,-h/2+t),rect(-w/2,w/2-t,h/2-t,h/2)];
}
function towerBodyPrisms(s){return s?.type==='tower'&&s.shape==='half'?halfTowerBodyPieces(s):[unionFootprintPoints(s)]}
// Timber floors seen through the open gorge, one per storey; the top one is the fighting deck.
// Storey k is climbed by a ladder against a side wall at the gorge (alternating sides), through
// a hatch left open in floor k: the floor is two convex boards around it.
const HALF_LADDER_W=.16,HALF_HATCH_X=.26,HALF_HATCH_Y=.2,HALF_RUNG_STEP=.09;
function halfTowerStoreys(s){
  if(s?.type!=='tower'||s.shape!=='half')return[];
  const {w,h}=orientedTowerDims(s),t=HALF_TOWER_WALL,H=structureHeight(s),L=structureLevel(s),out=[];
  for(let k=1;k<=L;k++){
    const side=k%2?-1:1,face=side*(h/2-t);
    out.push({k,side,face,z:k===L?H:H*k/L,zBase:k===1?0:H*(k-1)/L,x0:-w/2,x1:-w/2+HALF_HATCH_X,xIn:w/2-t,yIn:h/2-t});
  }
  return out;
}
function halfTowerFloorDecks(s){
  const rect=(x0,x1,y0,y1)=>orientedTowerWorld(s,[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
  const out=[];
  for(const st of halfTowerStoreys(s)){
    const z0=st.z-.08,z1=st.z-.01,yh=st.face-st.side*HALF_HATCH_Y;
    out.push({pts:rect(st.x1,st.xIn,-st.yIn,st.yIn),z0,z1});
    out.push({pts:st.side<0?rect(st.x0,st.x1,yh,st.yIn):rect(st.x0,st.x1,-st.yIn,yh),z0,z1});
  }
  return out;
}
// Ladder rails and rungs (vertical boxes, like the cutaway ladders), from the floor below
// up through the hatch.
function halfTowerLadders(s){
  const out=[],box=(x,y,dx,dy,z0,z1,part)=>out.push({pts:orientedTowerWorld(s,[[x-dx/2,y-dy/2],[x+dx/2,y-dy/2],[x+dx/2,y+dy/2],[x-dx/2,y+dy/2]]),z0,z1,part});
  for(const st of halfTowerStoreys(s)){
    const xc=(st.x0+st.x1)/2,y=st.face-st.side*.035,top=st.z+.06;
    for(const o of [-1,1])box(xc+o*HALF_LADDER_W/2,y,.025,.025,st.zBase,top,'rail');
    for(let z=st.zBase+HALF_RUNG_STEP;z<st.z-.02;z+=HALF_RUNG_STEP)box(xc,y,HALF_LADDER_W,.02,z-.008,z+.008,'rung');
  }
  return out;
}
// Pitched roof: half cone on the round front, its apex over the centre of the half round.
function deeTowerRoofApex(s){const {w,h}=orientedTowerDims(s);return orientedTowerWorld(s,[[w/2-h/2,0]])[0]}
function deeTowerButtresses(s,h){
  const {w,h:width}=orientedTowerDims(s),cx=w/2-width/2,r=width/2,out=[];
  const add=(x,y,ox,oy)=>{const p=orientedTowerWorld(s,[[x,y]])[0],o=orientedTowerDir(s,ox,oy);out.push(steppedButtressPieces(p,{x:-o.y,y:o.x},o,h))};
  for(const a of [-Math.PI/3,0,Math.PI/3])add(cx+Math.cos(a)*r,Math.sin(a)*r,Math.cos(a),Math.sin(a));
  for(const side of [-1,1]){add((-w/2+cx)/2,side*r,0,side);add(-w/2,side*width/4,-1,0)}
  return out;
}
// Crown: merlons walked along a local path at even spacing; every corner carries one.
function orientedTowerBattlementPieces(s){
  const z=structureHeight(s),mach=hasMachicolation(s),W=.22,D=.20,step=.34;
  const {w,h}=orientedTowerDims(s),inset=mach?-.075:D/2+.005,closed=s.shape==='dee';
  const local=closed?deeTowerLocalOutline(s,inset):[[-w/2+.11,-h/2+inset],[w/2-inset,-h/2+inset],[w/2-inset,h/2-inset],[-w/2+.11,h/2-inset]];
  const pts=orientedTowerWorld(s,local),n=pts.length,center={x:s.x,y:s.y};
  const heading=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
  const isCorner=i=>{
    if(!closed&&(i===0||i===n-1))return true;
    const p=pts[(i-1+n)%n],c=pts[i],q=pts[(i+1)%n],d=heading(c,q)-heading(p,c);
    return Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))>25*Math.PI/180;
  };
  const corners=[];for(let i=0;i<n;i++)if(isCorner(i))corners.push(i);
  const pieces=[],nodes=[];
  const runs=closed?corners.map((c,k)=>[c,corners[(k+1)%corners.length]]):corners.slice(0,-1).map((c,k)=>[c,corners[k+1]]);
  runs.forEach(([i0,i1],r)=>{
    const poly=[];for(let i=i0;;i=(i+1)%n){poly.push(pts[i]);if(i===i1)break}
    const lens=poly.slice(1).map((q,k)=>dist(poly[k],q)),L=lens.reduce((a,b)=>a+b,0),count=Math.max(1,Math.round(L/step));
    const last=!closed&&r===runs.length-1;
    for(let k=0;k<=(last?count:count-1);k++){
      let t=k/count*L,seg=0;while(seg<lens.length-1&&t>lens[seg]){t-=lens[seg];seg++}
      const a=poly[seg],b=poly[seg+1],f=lens[seg]>1e-9?Math.min(1,t/lens[seg]):0,c={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f},angle=heading(a,b);
      if(mach){
        let ix=center.x-c.x,iy=center.y-c.y;const IL=Math.hypot(ix,iy)||1;ix/=IL;iy/=IL;
        const cc={x:c.x+ix*.09,y:c.y+iy*.09};
        pieces.push(battlementPolygonPiece('machicolationCorbel',rectWorldPoints(cc.x,cc.y,.11,.15,angle),z-.23,z+.015,s));
      }
      pieces.push(battlementPiece(c,angle,z,W,D,.24,s));
      nodes.push(merlonNode(c,angle,W,D));
    }
  });
  return pieces.concat(parapetPieces(nodes,z,s,closed));
}
// First crossing of segment a->b with a polygon boundary (null when the segment never meets it).
function segmentPolygonEntry(a,b,poly){
  let best=null,bt=Infinity;
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],rx=b.x-a.x,ry=b.y-a.y,sx=q.x-p.x,sy=q.y-p.y,den=rx*sy-ry*sx;
    if(Math.abs(den)<1e-12)continue;
    const t=((p.x-a.x)*sy-(p.y-a.y)*sx)/den,u=((p.x-a.x)*ry-(p.y-a.y)*rx)/den;
    if(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9&&t<bt){bt=t;best={x:a.x+rx*t,y:a.y+ry*t}}
  }
  return best;
}
// Ray from the centre towards target, leaving the true outline.
function orientedTowerBoundaryPoint(s,target){
  const dx=target.x-s.x,dy=target.y-s.y,L=Math.hypot(dx,dy)||1,far={x:s.x+dx/L*8,y:s.y+dy/L*8};
  return segmentPolygonEntry(far,{x:s.x,y:s.y},footprintPoints(s))||{x:s.x,y:s.y};
}
// Where a wall meets the tower: the wall keeps its own line (other -> through) and stops on the flank.
function orientedTowerWallContact(s,other,through){
  const dx=through.x-other.x,dy=through.y-other.y,L=Math.hypot(dx,dy)||1;
  return segmentPolygonEntry(other,{x:through.x+dx/L*6,y:through.y+dy/L*6},footprintPoints(s))||{...through};
}
// Distance from the rear face to the wall centre line: rear flush with the inner face of the wall.
function orientedTowerRearInset(s){const {w}=orientedTowerDims(s);return clamp(Number(s.wallSeat)||.25,.1,w/2)}
// The two flank points where a wall run starts or ends.
function orientedTowerSeats(s){
  const {w,h}=orientedTowerDims(s),x=-w/2+orientedTowerRearInset(s);
  return orientedTowerWorld(s,[[x,-h/2],[x,h/2]]);
}
// Tower dropped on a free wall end: the rear sits on the wall, the front faces the side of the
// wall the pointer is on (the wall's exterior side when the pointer is on the line).
function orientedTowerWallSnap(shape,size,wall,end,p){
  const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,L=Math.hypot(dx,dy)||1,ext=wallExteriorSide(wall);
  let nx=-dy/L*ext,ny=dx/L*ext;
  const q=wall[end],side=(p.x-q.x)*nx+(p.y-q.y)*ny;
  if(side<-.12){nx=-nx;ny=-ny}
  const seat=(Number(wall.width)||.5)/2,{w}=orientedTowerDims({shape,size}),off=w/2-clamp(seat,.1,w/2);
  return{point:{x:q.x+nx*off,y:q.y+ny*off},angle:snapStructureAngle(Math.atan2(ny,nx)),wallSeat:seat};
}
// Beside a gate flank (gate-side sockets): same facing as the gate, rear aligned with its back.
function orientedGateFlankAttachment(gate,child,socket){
  const m=String(socket||'').match(/^gate-side:(0|2)$/);if(!m)return null;
  const gd=rectDims(gate),cd=orientedTowerDims(child),side=m[1]==='0'?-1:1;
  const fake={x:gate.x,y:gate.y,angle:gate.angle||0};
  return{point:orientedTowerWorld(fake,[[-gd.w/2+cd.w/2,side*(gd.h/2+cd.h/2)]])[0],angle:gate.angle||0,subtowerSocket:socket,subtowerAngle:null};
}
// Tier choices offered by the selection panels: semitower small/medium, D tower medium/large.
function orientedTowerTierOptions(shape){
  const [lo,hi]=orientedTowerTierRange(shape),names={1:'Piccola',2:'Media',3:'Grande'},out=[];
  for(let t=lo;t<=hi;t++){const d=ORIENTED_TOWER_SPECS[shape][t];out.push({value:t,label:`T${t} · ${names[t]} ${String(d.width).replace('.',',')}×${String(d.depth).replace('.',',')}U`})}
  return out;
}
function orientedTowerLabel(s){
  const t=orientedTowerTier(s),{w,h}=orientedTowerDims(s),size=t===1?'small':t===2?'medium':'large';
  return(s.shape==='half'?'Semitower':'D tower')+` ${size} ${h}×${w}U`;
}
