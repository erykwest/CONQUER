'use strict';
// CONQUER collapses: the volume a structure loses (a whole tower, its top storey, a
// house, a wall bay) breaks into blocks that fall, tumble, bounce once and settle in a
// rubble heap, with dust where they land. Deterministic: a collapse is a spec (the
// footprint polygons, the lost slab z0..z1, ground, colours, seed, lean) and every
// frame is a pure function of the time since it started, so the rubble left behind
// is simply the last frame and is rebuilt identically from a saved game.
//   spec  {id, parts:[[{x,y}...]...], z0, z1, ground, seed, palette:{side:[hex], top:[hex]}, lean:{x,y},
//          stump:true when what stays standing below z0 has the same footprint (a storey
//          falls off a tower): blocks landing on it rest on its top, the others on the ground,
//          material:'stone'|'wood'|'timber' (wood breaks into long beams and planks; timber
//          framing into plaster blocks and beams under a roof of boards), palette.beam: timber colour}
//   mesh(spec,t)  -> {pos (9 per triangle, world U), col (hex per triangle)}
//   dust(spec,t)  -> [{x,y,z,r,a}] puffs (r in U, a alpha)
//   duration(spec) -> seconds until the last block is at rest (dust fades 1.6 s later)
(function(){
  const G=4.2;                       // U/s^2: a little above real gravity (2.8) so collapses read at game zoom
  const MAX_BLOCKS=220,BOUNCE=.28,DUST_LIFE=1.6;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function rng(seed){
    let s=0;for(const ch of String(seed))s=(Math.imul(s,31)+ch.charCodeAt(0))>>>0;
    s=s||1;return()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;
  }
  function inside(p,poly){
    let c=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c;
    }
    return c;
  }
  function area(poly){let s=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)s+=(poly[j].x+poly[i].x)*(poly[j].y-poly[i].y);return Math.abs(s/2)}

  // Blocks filling the lost volume, each with its own fall: launch velocity (the lean
  // throws the upper courses further out), spin, impact, one bounce, rest on the heap.
  const cache=new Map();
  function blocks(spec){
    let out=cache.get(spec.id);if(out)return out;
    const rnd=rng(spec.seed??spec.id),parts=(spec.parts||[]).filter(p=>p&&p.length>=3);
    const H=Math.max(.05,spec.z1-spec.z0),A=parts.reduce((s,p)=>s+area(p),0)||.01;
    const cell=clamp(Math.cbrt(A*H/MAX_BLOCKS),.1,.42);
    const all=parts.flat(),cx=all.reduce((s,p)=>s+p.x,0)/all.length,cy=all.reduce((s,p)=>s+p.y,0)/all.length;
    const xs=all.map(p=>p.x),ys=all.map(p=>p.y);
    const R=Math.max(.3,Math.max(...all.map(p=>Math.hypot(p.x-cx,p.y-cy))));
    const lean=spec.lean||{x:rnd()-.5,y:rnd()-.5},ll=Math.hypot(lean.x,lean.y)||1,lx=lean.x/ll,ly=lean.y/ll;
    const ground=spec.ground||0,spread=R+H*.35,peak=Math.min(H*.3+.05,R*.9);
    const side=spec.palette?.side||['#7d736b'],top=spec.palette?.top||side,beamCol=spec.palette?.beam||side;
    const mat=spec.material||'stone',pick=list=>list[Math.floor(rnd()*list.length)];
    out=[];
    for(let x=Math.min(...xs)+cell/2;x<Math.max(...xs);x+=cell)for(let y=Math.min(...ys)+cell/2;y<Math.max(...ys);y+=cell){
      const p={x:x+(rnd()-.5)*cell*.3,y:y+(rnd()-.5)*cell*.3};
      if(!parts.some(poly=>inside(p,poly)))continue;
      // Hollow buildings: keep the shell (outer ring) and a few inner blocks.
      const edge=Math.min(...parts.map(poly=>poly.reduce((m,a,i)=>{const b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1,k=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/L2,0,1);return Math.min(m,Math.hypot(p.x-a.x-dx*k,p.y-a.y-dy*k))},1e9)));
      const shell=spec.hollow?edge<cell*1.2:true;
      for(let z=spec.z0+cell/2;z<spec.z1;z+=cell){
        const topLayer=z+cell>=spec.z1-1e-6;
        if(!shell&&!topLayer&&rnd()>.15)continue;
        const h=(z-spec.z0)/H,sz=cell*(.7+rnd()*.35);
        // The lower courses slump straight down; higher ones are thrown out with the lean.
        const throwOut=(.15+h*.85)*(.55+rnd()*.6);
        const dx=p.x-cx,dy=p.y-cy,dl=Math.hypot(dx,dy)||1;
        const vx=(lx*.9+dx/dl*.5)*throwOut+(rnd()-.5)*.35,vy=(ly*.9+dy/dl*.5)*throwOut+(rnd()-.5)*.35;
        const delay=h*.18+rnd()*.12+(spec.delay||0);
        // What breaks off: masonry blocks, or timber as long beams (square section) and planks.
        let kind='block',col=topLayer?pick(top):pick(side);
        if(mat==='wood'){if(rnd()>.4)continue;kind=rnd()<.55?'beam':'plank'}
        else if(mat==='timber'){if(topLayer)kind='plank';else if(rnd()<.3){kind='beam';col=pick(beamCol)}}
        const s=kind==='beam'?[cell*(2.4+rnd()*2),cell*(.3+rnd()*.12),0]:kind==='plank'?[cell*(2+rnd()*1.5),cell*(.75+rnd()*.3),cell*(.12+rnd()*.05)]
          :[sz*(.8+rnd()*.5),sz*(.8+rnd()*.4),sz*(.6+rnd()*.4)];
        if(kind==='beam')s[2]=s[1];
        // Long pieces tumble end over end, some start upright (posts) and topple.
        const long=kind!=='block',r0=[0,long&&mat==='wood'&&rnd()<.35?Math.PI/2:0];
        out.push({x:p.x,y:p.y,z:z-sz/2,s,kind,r0,
          vx,vy,vz:rnd()*.4,delay,spin:long?[(rnd()-.5)*3,(rnd()-.5)*6]:[(rnd()-.5)*7,(rnd()-.5)*7],yaw:rnd()*Math.PI,
          col,rest:rnd()});
      }
    }
    // Thin the cloud evenly when the volume is large; keep the shape.
    if(out.length>MAX_BLOCKS){const step=out.length/MAX_BLOCKS;out=[...Array(MAX_BLOCKS).keys()].map(i=>out[Math.floor(i*step)])}
    // Landing: the heap is a cone around the footprint centre pushed along the lean.
    const hx=cx+lx*H*.25,hy=cy+ly*H*.25;
    for(const b of out){
      const fall=Math.sqrt(2*Math.max(.01,b.z-ground)/G),flatX=b.x+b.vx*fall,flatY=b.y+b.vy*fall,d=Math.hypot(flatX-hx,flatY-hy);
      const onStump=spec.stump&&parts.some(poly=>inside({x:flatX,y:flatY},poly));
      b.restZ=onStump?spec.z0+b.rest*b.s[2]*1.5:ground+Math.max(0,peak*(1-d/spread))*(.35+.65*b.rest);
      const dz=b.z-b.restZ;                               // vz up, then fall dz: z(t)=z+vz t-G t^2/2
      b.tHit=(b.vz+Math.sqrt(b.vz*b.vz+2*G*Math.max(0,dz)))/G;
      b.vHit=b.vz-G*b.tHit;
      b.tBounce=2*(-b.vHit*BOUNCE)/G;
      b.end=b.delay+b.tHit+b.tBounce;
    }
    cache.set(spec.id,out);
    return out;
  }
  const durationMemo=new WeakMap();
  function duration(spec){
    const list=blocks(spec);
    if(!durationMemo.has(list))durationMemo.set(list,list.reduce((m,b)=>Math.max(m,b.end),0));
    return durationMemo.get(list);
  }
  // Pose of one block at time t since the collapse started.
  function pose(b,t){
    const tau=Math.max(0,t-b.delay);
    const r0=b.r0||[0,0];
    if(tau<=0)return{x:b.x,y:b.y,z:b.z,rx:r0[0],ry:r0[1]};
    const fly=Math.min(tau,b.tHit),spinT=Math.min(tau,b.tHit+b.tBounce*.6);
    let x=b.x+b.vx*fly,y=b.y+b.vy*fly,z=b.z+b.vz*fly-G*fly*fly/2;
    if(tau>b.tHit){
      const u=Math.min(tau-b.tHit,b.tBounce),up=-b.vHit*BOUNCE;
      x+=b.vx*.35*u;y+=b.vy*.35*u;z=b.restZ+up*u-G*u*u/2;
    }
    // On the ground every piece settles on a face. Beams and planks lie down: their long
    // axis ends horizontal (pitch a multiple of PI), planks on their broad face.
    let rx=r0[0]+b.spin[0]*spinT,ry=r0[1]+b.spin[1]*spinT;
    if(tau>b.tHit){
      const k=clamp((tau-b.tHit)/(b.tBounce+.25),0,1),e=k*k*(3-2*k),half=Math.PI/2;
      const qx=b.kind==='plank'?Math.PI:half,qy=b.kind==='beam'||b.kind==='plank'?Math.PI:half;
      rx+=(Math.round(rx/qx)*qx-rx)*e;ry+=(Math.round(ry/qy)*qy-ry)*e;
    }
    return{x,y,z:Math.max(b.restZ,z),rx,ry};
  }
  const FACES=[[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]];
  function mesh(spec,t=Infinity){
    const pos=[],col=[];
    for(const b of blocks(spec)){
      const q=pose(b,t),[sx,sy,sz]=b.s;
      const cy=Math.cos(b.yaw),sy_=Math.sin(b.yaw),cr=Math.cos(q.rx),sr=Math.sin(q.rx),cp=Math.cos(q.ry),sp=Math.sin(q.ry);
      const P=[];
      for(const dx of [-sx/2,sx/2])for(const dy of [-sy/2,sy/2])for(const dz of [-sz/2,sz/2]){
        // spin about the piece's x then y axis, then yaw, about its centre
        let x=dx,y=dy*cr-dz*sr,z=dy*sr+dz*cr;
        const x2=x*cp+z*sp;z=-x*sp+z*cp;x=x2;
        P.push([q.x+x*cy-y*sy_,q.y+x*sy_+y*cy,z]);
      }
      // Its lowest corner sits on q.z (the ground, the heap or where it is falling).
      const lift=q.z-Math.min(...P.map(c=>c[2]));for(const c of P)c[2]+=lift;
      for(const [a,b2,c,d] of FACES)for(const tri of [[a,b2,c],[a,c,d]]){for(const k of tri)pos.push(P[k][0],P[k][1],P[k][2]);col.push(b.col)}
    }
    return{pos,col};
  }
  // Dust: a puff where each of a few blocks lands, and a low cloud over the heap.
  function dust(spec,t){
    const out=[],list=blocks(spec);
    for(let i=0;i<list.length;i+=Math.max(1,Math.floor(list.length/24))){
      const b=list[i],land=b.delay+b.tHit,age=t-land;
      if(age<0||age>DUST_LIFE)continue;
      const p=pose(b,land),k=age/DUST_LIFE;
      out.push({x:p.x,y:p.y,z:p.z+.1+k*.35,r:.18+k*.6,a:.45*(1-k)});
    }
    const D=duration(spec),age=t-D*.35;
    if(age>0&&age<D*.65+DUST_LIFE){
      const parts=spec.parts.flat(),cx=parts.reduce((s,p)=>s+p.x,0)/parts.length,cy=parts.reduce((s,p)=>s+p.y,0)/parts.length;
      const k=age/(D*.65+DUST_LIFE);
      out.push({x:cx,y:cy,z:(spec.ground||0)+.3+k*.6,r:.6+k*1.6+(spec.z1-spec.z0)*.15,a:.32*(1-k)});
    }
    return out;
  }
  function finished(spec,t){return t>duration(spec)+DUST_LIFE}
  // A spec changed after the fact (its stump fell too): rebuild its blocks.
  function forget(id){cache.delete(id)}
  window.ConquerCollapse={blocks,mesh,dust,duration,finished,pose,forget,G};
})();
