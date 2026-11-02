'use strict';
// Banchina: a stone quay 2U wide, drawn with two clicks along the shore or out in the water.
// Its top is at the pier deck level (z .6) and its body goes down to the sea bed; the
// seaward edge carries bollards, and timber piers (settlement-pier.js) branch off it.
// Placement only asks for the whitezone and some water along it: no buildable-terrain rules.
(() => {
  const WIDTH=2,TOP=.6,BED=-.6,MIN=1,MAX=24;
  const SPEC=Object.freeze({label:'Banchina',days:.6,costPerU:Object.freeze({gold:6,stone:14})});
  const STONE='#9a958a',STONE2='#8b867b',COPING='#b3ad9f',DARK='#5b3b22',WET='#3c443f';
  const is=s=>s?.type==='quay';
  const make=(a,b)=>({type:'quay',a:{...a},b:{...b},width:WIDTH,length:dist(a,b)});
  const frame=s=>{const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1;return{L,u:{x:dx/L,y:dy/L},n:{x:-dy/L,y:dx/L}}};
  const at=(s,along,across)=>{const f=frame(s);return{x:s.a.x+f.u.x*along+f.n.x*across,y:s.a.y+f.u.y*along+f.n.y*across}};
  const footprint=s=>{const {L}=frame(s),w=WIDTH/2;return[at(s,0,w),at(s,L,w),at(s,L,-w),at(s,0,-w)]};
  const water=()=>(State.environment||[]).filter(f=>['sea','pond'].includes(f.type));
  const wet=p=>water().some(f=>environmentContains(f,p));
  const coastDistance=p=>{
    const sea=(State.environment||[]).find(f=>f.type==='sea'&&f.coastline?.length>1);if(!sea)return Infinity;
    let d=Infinity;for(let i=1;i<sea.coastline.length;i++)d=Math.min(d,pointSegmentDistance(p,sea.coastline[i-1],sea.coastline[i]));
    return d;
  };
  // +1 / -1: which long side faces the open water (the side whose outer strip is wetter,
  // or, for a quay out in the water, the one farther from the shore).
  function seaSide(s){
    const {L}=frame(s);let score=0;
    for(let k=1;k<=5;k++){const t=L*k/6;score+=(wet(at(s,t,WIDTH*.9))?1:0)-(wet(at(s,t,-WIDTH*.9))?1:0)}
    if(score)return Math.sign(score);
    const m=L/2;return coastDistance(at(s,m,WIDTH))>=coastDistance(at(s,m,-WIDTH))?1:-1;
  }
  function validate(s){
    if(!is(s))return{ok:false,reason:'Not a quay'};
    const L=dist(s.a,s.b);
    if(L<MIN)return{ok:false,reason:'Quay too short (min '+MIN+'U)'};
    if(L>MAX)return{ok:false,reason:'Quay too long (max '+MAX+'U)'};
    if(footprint(s).some(v=>v.x<BUILD_MIN||v.x>BUILD_MAX||v.y<BUILD_MIN||v.y>BUILD_MAX))
      return{ok:false,reason:'The quay must be inside the whitezone (100×100U)'};
    // Along the shore or out in the water: some of it must touch the sea.
    const touches=[0,.25,.5,.75,1].some(t=>[-1,0,1].some(k=>{const p=at(s,L*t,k*(WIDTH/2+.4));return wet(p)||coastDistance(p)<.6}));
    if(!touches)return{ok:false,reason:'A quay must run along the shore or out in the water'};
    return{ok:true,ground:0,side:seaSide(s)};
  }
  // Nearest point on the seaward edge of any finished-or-building quay: where piers branch.
  function edgeHit(p){
    let best=null;
    for(const q of State.structures||[]){
      if(!is(q))continue;
      const side=q.seaSide||seaSide(q),{L,n}=frame(q),e0=at(q,0,side*WIDTH/2),e1=at(q,L,side*WIDTH/2);
      const c=closestPointOnSegment(p,e0,e1),d=dist(p,c);
      if(!best||d<best.distance)best={quay:q,point:c,distance:d,normal:{x:n.x*side,y:n.y*side}};
    }
    return best;
  }
  // ---------- geometry (settlement-mesh3d.js format)
  const cache=new Map();
  function meshes(s){
    const side=s.seaSide||seaSide(s),{L}=frame(s),key=[s.a.x,s.a.y,s.b.x,s.b.y,side].join('|');
    const hit=cache.get(s.id);if(hit&&hit.key===key)return hit.list;
    const pos=[],col=[],w=WIDTH/2;
    const P=(along,across,z)=>{const p=at(s,along,across);return[p.x,p.y,z]};
    const box=(a0,a1,c0,c1,z0,z1,c)=>{
      const v=[];for(const a of [a0,a1])for(const k of [c0,c1])for(const z of [z0,z1])v.push(P(a,k,z));
      for(const [i,j,k,l] of [[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]])
        for(const tri of [[i,j,k],[i,k,l]]){for(const q of tri)pos.push(...v[q]);col.push(c)}
    };
    // Ashlar courses: blocks in staggered rows, then a coping of long slabs along the top.
    const rows=4,rh=(TOP-.1-BED)/rows,block=1.1;
    for(let r=0;r<rows;r++){
      const z0=BED+r*rh,off=r%2?block/2:0;
      for(let a=-off,i=0;a<L;a+=block,i++)box(Math.max(0,a),Math.min(L,a+block)-.02,-w,w,z0,z0+rh-.015,(i+r)%2?STONE:STONE2);
    }
    for(let a=0,i=0;a<L;a+=1.6,i++)box(a,Math.min(L,a+1.6)-.02,-w-.04,w+.04,TOP-.1,TOP,i%2?COPING:STONE);
    box(0,L,side*w-.06,side*w+.06,-.1,.05,WET);                                  // waterline stain on the sea face
    // Bollards along the sea edge.
    for(let a=1;a<L-.4;a+=2.2)box(a-.1,a+.1,side*(w-.22)-.1,side*(w-.22)+.1,TOP,TOP+.24,DARK);
    const list=[{pos,col}];
    cache.set(s.id||'preview',{key,list});
    return list;
  }
  function draw(s,preview=false){
    if(!is(s)||!window.ConquerMesh3D)return false;
    ctx.save();if(preview)ctx.globalAlpha*=.62;
    window.ConquerMesh3D.drawMeshes(ctx,meshes(s),window.ConquerMesh3D.gameView());
    ctx.restore();return true;
  }
  function addToBuilder(m,s){
    if(!is(s)||!window.ConquerMesh3D)return false;
    for(const mesh of meshes(s)){const p=mesh.pos;for(let t=0;t<mesh.col.length;t++){const o=t*9;
      m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t))}}
    return true;
  }
  const lengthOf=s=>s.length||dist(s.a,s.b);
  const cost=s=>({gold:Math.round(SPEC.costPerU.gold*lengthOf(s)),stone:Math.round(SPEC.costPerU.stone*lengthOf(s))});
  const buildDays=s=>Math.max(1,Math.round(SPEC.days*lengthOf(s)*10)/10);
  const label=s=>SPEC.label+' · '+(s?.a&&s?.b?lengthOf(s).toFixed(1)+'U':'2U di larghezza');
  window.ConquerQuay=Object.freeze({SPEC,WIDTH,TOP,is,make,footprint,seaSide,validate,edgeHit,meshes,draw,addToBuilder,cost,buildDays,label});
})();
