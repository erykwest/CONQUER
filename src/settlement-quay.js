'use strict';
// Banchina: a stone quay 2U wide, drawn with two clicks along the shore or out in the water.
// Its top is at the pier deck level (z .6) and its body goes down to the sea bed; the
// seaward edge carries bollards, and timber piers (settlement-pier.js) branch off it.
// Placement only asks for the whitezone and some water along it: no buildable-terrain rules.
(() => {
  const WIDTH=2,TOP=.6,BED=-.6,MIN=1,MAX=24;
  const SPEC=Object.freeze({label:'Banchina',days:.6,costPerU:Object.freeze({gold:6,stone:14})});
  const STONE='#9a958a',STONE2='#8b867b',COPING='#b3ad9f',COPING2='#a49e90',DARK='#5b3b22',WET='#3c443f';
  const STONES=['#9d978b','#8e887c','#a8a294','#837d72'],MORTAR='#4a4740',PAVE='#aba596',PAVE2='#9c9688';
  const is=s=>s?.type==='quay';
  const make=(a,b)=>({type:'quay',a:{...a},b:{...b},width:WIDTH,length:dist(a,b)});
  const frame=s=>{const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L=Math.hypot(dx,dy)||1;return{L,u:{x:dx/L,y:dy/L},n:{x:-dy/L,y:dx/L}}};
  const at=(s,along,across)=>{const f=frame(s);return{x:s.a.x+f.u.x*along+f.n.x*across,y:s.a.y+f.u.y*along+f.n.y*across}};
  // Joined end to end, two quays would leave the outer corner open: each end that meets
  // another quay's end is carried on by half the width, so the corner closes in stone.
  const endJoined=(s,p)=>!!s?.id&&(State.structures||[]).some(o=>is(o)&&o.id!==s.id&&joined(s,o)&&(dist(o.a,p)<.05||dist(o.b,p)<.05));
  const span=(s,extra=0)=>{const {L}=frame(s);return[endJoined(s,s.a)?-(WIDTH/2+extra):0,L+(endJoined(s,s.b)?WIDTH/2+extra:0)]};
  const footprint=s=>{const [s0,s1]=span(s),w=WIDTH/2;return[at(s,s0,w),at(s,s1,w),at(s,s1,-w),at(s,s0,-w)]};
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
    // Like piers, a quay must start from the whitezone (an end inside it, or joined to a quay
    // already built) and may run on out over the water beyond it.
    const inside=p=>p.x>=BUILD_MIN&&p.x<=BUILD_MAX&&p.y>=BUILD_MIN&&p.y<=BUILD_MAX;
    const fromQuay=[s.aSnap,s.bSnap].some(id=>id&&(State.structures||[]).some(q=>is(q)&&q.id===id));
    if(!inside(s.a)&&!inside(s.b)&&!fromQuay)
      return{ok:false,reason:'A quay must start inside the whitezone (100×100U) or from another quay'};
    // Along the shore or out in the water: some of it must touch the sea.
    const touches=[0,.25,.5,.75,1].some(t=>[-1,0,1].some(k=>{const p=at(s,L*t,k*(WIDTH/2+.4));return wet(p)||coastDistance(p)<.6}));
    if(!touches)return{ok:false,reason:'A quay must run along the shore or out in the water'};
    return{ok:true,ground:0,side:seaSide(s)};
  }
  // Long sides with open water along them: a quay on the shore has one, a quay run out
  // into the water (square to the shore, a mole) has both.
  const wetSides=s=>{const {L}=frame(s);return[1,-1].filter(k=>[.5,.75].some(t=>wet(at(s,L*t,k*WIDTH*.9))))};
  // Nearest point on a wet edge of any quay: where piers branch. The water is checked right
  // outside the edge at that point, so the dry end of a mole by the shore takes no pier.
  function edgeHit(p){
    let best=null;
    for(const q of State.structures||[]){
      if(!is(q))continue;
      const {n}=frame(q),[s0,s1]=span(q);
      for(const side of [1,-1]){
        const e0=at(q,s0,side*WIDTH/2),e1=at(q,s1,side*WIDTH/2),c=closestPointOnSegment(p,e0,e1),d=dist(p,c);
        if(!wet({x:c.x+n.x*side*.9,y:c.y+n.y*side*.9}))continue;
        if(!best||d<best.distance)best={quay:q,point:c,distance:d,normal:{x:n.x*side,y:n.y*side}};
      }
    }
    return best;
  }
  // ---------- walls on a quay
  // Wall magnet on either long side of a quay: the wall runs against the quay's outer face,
  // its axis set out by half the wall width so it stands in the water outside the quay; the
  // quay's ends are magnets too. A wall with both ends on the same quay rises from the
  // waterline (wallGroundZ) and follows the face exactly, whatever its angle (wallRoute),
  // instead of the 15° lattice.
  const SNAP='quay:';
  function snapWallAnchor(p,wallWidth=.5){
    let best=null;
    for(const q of State.structures||[]){
      if(!is(q))continue;
      // At a joined corner the wall line runs on by a whole wall width more: each of the two
      // outer walls reaches the other's outer face, so they overlap and the corner is solid.
      const out=WIDTH/2+wallWidth/2,[s0,s1]=span(q,wallWidth);
      for(const k of [1,-1]){
        const e0=at(q,s0,k*out),e1=at(q,s1,k*out);
        // Corners first (within .5), then anywhere along the edge (within .75).
        for(const [c,end] of [[e0,'a'],[e1,'b']]){const d=dist(p,c);if(d<=.5&&(!best||d<best.score))best={score:d,point:c,end,quay:q,side:k}}
        if(best?.end&&best.quay===q)continue;
        const c=closestPointOnSegment(p,e0,e1),d=dist(p,c);
        if(d<=.75&&(!best||d<best.score))best={score:d,point:c,quay:q,side:k};
      }
    }
    return best&&{score:best.score,point:best.point,structureId:SNAP+best.quay.id,magnet:true,quayId:best.quay.id,quaySide:best.side};
  }
  const quayOfSnap=id=>String(id||'').startsWith(SNAP)?(State.structures||[]).find(q=>is(q)&&SNAP+q.id===id)||null:null;
  // A tower standing against a quay counts as part of it for the walls that join it.
  const towerOnQuay=id=>(State.structures||[]).find(t=>t.id===id&&t.type==='tower'&&t.quaySnap)||null;
  const quayKey=id=>quayOfSnap(id)?id:towerOnQuay(id)?SNAP+towerOnQuay(id).quaySnap:null;
  // Towers and walls against a quay stand at the quay top (their 0 is the coping level), on a
  // stone plinth built up from the sea bed with the quay (see plinths in meshes()).
  // The same quay, or two quays joined to each other (a wall turning a corner of the harbour).
  const sameWork=(ka,kb)=>{
    if(!ka||!kb)return false;if(ka===kb)return true;
    const qa=quayOfSnap(ka),qb=quayOfSnap(kb);return!!qa&&!!qb&&joined(qa,qb);
  };
  function wallGroundZ(wall){
    if(!wall)return null;
    if(wall.type==='tower')return wall.quaySnap&&(State.structures||[]).some(q=>is(q)&&q.id===wall.quaySnap)?TOP:null;
    if(!['wall','palisade','built'].includes(wall.type))return null;
    return sameWork(quayKey(wall.aSnap),quayKey(wall.bSnap))?TOP:null;
  }
  // Structures standing against this quay (towers by quaySnap, walls by both ends).
  // (A wall across a corner gets its plinth from the quay its start belongs to.)
  function attached(q){
    return(State.structures||[]).filter(s=>s.type==='tower'?s.quaySnap===q.id:
      ['wall','palisade','built'].includes(s.type)&&quayKey(s.aSnap)===SNAP+q.id&&sameWork(quayKey(s.aSnap),quayKey(s.bSnap)));
  }
  // Tower magnet: against either long face (centre set out by the tower's half depth) or on
  // a corner (set out diagonally), square to the quay with its front (the door side, the
  // tower's +angle) turned in: towards the face it stands against, or on a corner along the
  // quay axis that points to the quay's middle.
  function snapTower(p,tower){
    const half=tower?.shape==='round'?Number(tower.r)||.5:(Number(tower?.size)||1.5)/2;
    let best=null;
    for(const q of State.structures||[]){
      if(!is(q))continue;
      const {L,u,n}=frame(q),out=WIDTH/2+half,mid=at(q,L/2,0),[s0,s1]=span(q);
      const inward=c=>{
        const d={x:mid.x-c.x,y:mid.y-c.y};
        return[u,{x:-u.x,y:-u.y},n,{x:-n.x,y:-n.y}].reduce((b,a)=>a.x*d.x+a.y*d.y>b.x*d.x+b.y*d.y?a:b);
      };
      const cands=[];
      // The middle of each end: a tower capping the quay, its door along the quay.
      cands.push({c:at(q,s0-half,0),corner:true,face:u},{c:at(q,s1+half,0),corner:true,face:{x:-u.x,y:-u.y}});
      for(const k of [1,-1]){
        for(const along of [s0-half,s1+half]){const c=at(q,along,k*out);cands.push({c,corner:true,face:inward(c)})}
        const e0=at(q,s0,k*out),e1=at(q,s1,k*out);cands.push({c:closestPointOnSegment(p,e0,e1),corner:false,face:{x:-n.x*k,y:-n.y*k}});
      }
      for(const {c,corner,face} of cands){
        const angle=Math.atan2(face.y,face.x);
        const d=dist(p,c),reach=corner?.9:.75;
        if(d<=reach&&(!best||d-(corner?.3:0)<best.score))best={score:d-(corner?.3:0),point:c,angle,quayId:q.id,corner};
      }
    }
    return best;
  }
  // Straight wall from a to b along a quay edge when both ends sit on the same quay; else null.
  function wallRoute(a,b,aSnap,bSnap,spec){
    if(!sameWork(quayKey(aSnap),quayKey(bSnap)))return null;
    const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<.24)return null;
    const len=Math.min(L,Number(spec?.max)||L),angle=Math.atan2(dy,dx);
    const end={x:a.x+dx/L*len,y:a.y+dy/L*len};
    return{segments:[{a:{...a},b:end,length:len,angle,rotationStep:structureRotationStep(angle)}],joint:null,length:len,exactEnd:len===L,onQuay:true};
  }
  // Rule: a wall built against a quay always shows its exterior (crenellations, parapet) to
  // the water, away from the quay. Its flip is set from the side the quay is on, on creation,
  // on placement and on loading a save; the manual flip refuses it (isQuayWall).
  function quayOfWall(s,list=State.structures||[]){
    if(!s||!['wall','palisade','built'].includes(s.type))return null;
    const res=id=>{
      const k=String(id||'');
      if(k.startsWith(SNAP))return list.find(q=>is(q)&&SNAP+q.id===k)||null;
      const t=list.find(o=>o.id===k&&o.type==='tower'&&o.quaySnap);
      return t?list.find(q=>is(q)&&q.id===t.quaySnap)||null:null;
    };
    const qa=res(s.aSnap),qb=res(s.bSnap);
    return qa&&qb&&(qa===qb||joined(qa,qb))?qa:null;
  }
  const isQuayWall=s=>!!quayOfWall(s);
  function faceWallOut(s,list=State.structures||[]){
    const q=quayOfWall(s,list);if(!q||!s.a||!s.b)return false;
    const m={x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2},c=closestPointOnSegment(m,q.a,q.b);
    const out={x:m.x-c.x,y:m.y-c.y},dx=s.b.x-s.a.x,dy=s.b.y-s.a.y;
    if(Math.hypot(out.x,out.y)<1e-6)return false;
    s.flip=(-dy*out.x+dx*out.y)<0;                 // the exterior normal is the wall's left, or its right when flipped
    return true;
  }
  // ---------- berths along a quay
  // A slot every BERTH_STEP along each wet face, the ship lying alongside, bow along the quay.
  // Rule: a slot is off when a pier is less than BERTH_PIER_GAP away (piers have their own
  // berths); also where a wall stands against that face, by a tower, or with no water there.
  const BERTH_STEP=5,BERTH_PIER_GAP=4;
  function berths(q,list=State.structures||[]){
    if(!is(q)||!q.id)return[];
    const {u,n}=frame(q),[S0,S1]=span(q),out=[];
    const piers=list.filter(p=>p.type==='pier'),towers=list.filter(t=>t.type==='tower'&&t.quaySnap===q.id);
    // Walls against this quay: their face side and the stretch of quay they cover.
    const walls=list.filter(w=>quayOfWall(w,list)).map(w=>{
      const proj=p=>(p.x-q.a.x)*u.x+(p.y-q.a.y)*u.y,m={x:(w.a.x+w.b.x)/2,y:(w.a.y+w.b.y)/2};
      const side=Math.sign((m.x-q.a.x)*n.x+(m.y-q.a.y)*n.y);
      return{side,lo:Math.min(proj(w.a),proj(w.b)),hi:Math.max(proj(w.a),proj(w.b))};
    });
    for(const k of wetSides(q))for(let a=S0+BERTH_STEP/2;a<=S1-BERTH_STEP/2+1e-6;a+=BERTH_STEP){
      const edge=at(q,a,k*WIDTH/2);
      if(!wet(at(q,a,k*(WIDTH/2+1))))continue;
      if(piers.some(p=>dist(p,edge)<BERTH_PIER_GAP))continue;
      if(walls.some(w=>w.side===k&&w.hi>a-BERTH_STEP/2&&w.lo<a+BERTH_STEP/2))continue;
      if(towers.some(t=>dist(t,edge)<2.2))continue;
      out.push({quayId:q.id,side:k,along:a,key:q.id+':'+k+':'+a.toFixed(2),edge,out:{x:n.x*k,y:n.y*k},angle:Math.atan2(u.y,u.x)});
    }
    return out;
  }
  // Walls and towers magnetised to a quay stand against it: they do not collide with it.
  const isWallOn=(s,quay)=>!!s&&!!quay&&(s.quaySnap===quay.id||quayKey(s.aSnap)===SNAP+quay.id||quayKey(s.bSnap)===SNAP+quay.id);

  // ---------- quays joined to quays
  // Magnet for the quay tool: the middle of another quay's end (to carry it on, at any
  // angle) or a point on one of its faces (a T: the new quay leaves the face square or not).
  // The joined quays record it (aSnap / bSnap = the other quay's id) and do not collide.
  function snapQuay(p){
    let best=null;
    for(const q of State.structures||[]){
      if(!is(q))continue;
      const {L}=frame(q);
      for(const [c,end] of [[q.a,'a'],[q.b,'b']]){const d=dist(p,c);if(d<=1.1&&(!best||d-.3<best.score))best={score:d-.3,point:{x:c.x,y:c.y},quayId:q.id,end}}
      for(const k of [1,-1]){
        const c=closestPointOnSegment(p,at(q,0,k*WIDTH/2),at(q,L,k*WIDTH/2)),d=dist(p,c);
        if(d<=.8&&(!best||d<best.score))best={score:d,point:c,quayId:q.id,face:k};
      }
    }
    return best;
  }
  const joined=(s,o)=>!!s&&!!o&&is(s)&&is(o)&&(s.aSnap===o.id||s.bSnap===o.id||o.aSnap===s.id||o.bSnap===s.id);

  // ---------- geometry (settlement-mesh3d.js format)
  const cache=new Map();
  function meshes(s){
    const side=s.seaSide||seaSide(s),sides=wetSides(s),[S0,S1]=span(s);
    const piers=(State.structures||[]).filter(p=>p.type==='pier'&&p.onQuay===s.id),onIt=s.id?attached(s):[];
    const key=[s.a.x,s.a.y,s.b.x,s.b.y,S0,S1,side,sides.join(),piers.map(p=>p.id+p.x.toFixed(2)+p.y.toFixed(2)).join(),
      onIt.map(o=>o.id+JSON.stringify(typeof footprintPoints==='function'?footprintPoints(o):0)).join(),State.stonePaletteId].join('|');
    const hit=cache.get(s.id);if(hit&&hit.key===key)return hit.list;
    const pos=[],col=[],w=WIDTH/2;
    const P=(along,across,z)=>{const p=at(s,along,across);return[p.x,p.y,z]};
    const box=(a0,a1,c0,c1,z0,z1,c)=>{
      const v=[];for(const a of [a0,a1])for(const k of [c0,c1])for(const z of [z0,z1])v.push(P(a,k,z));
      for(const [i,j,k,l] of [[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]])
        for(const tri of [[i,j,k],[i,k,l]]){for(const q of tri)pos.push(...v[q]);col.push(c===DARK?c:(window.ConquerStoneColor?.shade(c)||c))}
    };
    // Ashlar: a dark mortar core, then blocks in staggered courses standing just proud of it,
    // so every joint reads as a recessed line; four stone tones picked per block.
    const tone=(i,r)=>STONES[(Math.imul(i*73856093^r*19349663,2654435761)>>>0)%STONES.length];
    box(S0,S1,-w+.03,w-.03,BED,TOP-.08,MORTAR);
    const rows=5,rh=(TOP-.08-BED)/rows,block=.56,joint=.035;
    for(let r=0;r<rows;r++){
      const z0=BED+r*rh,off=r%2?block/2:0;
      for(let a=S0-off,i=0;a<S1;a+=block,i++){
        const a0=Math.max(S0,a)+joint/2,a1=Math.min(S1,a+block)-joint/2;if(a1-a0<.05)continue;
        box(a0,a1,-w,w,z0+joint/2,z0+rh-joint/2,tone(i,r));
      }
    }
    // Coping: kerb stones along both edges, paved in between with slabs three across.
    const kerb=.32,slab=.7;
    for(const k of [1,-1])for(let a=S0,i=0;a<S1;a+=1.1,i++)
      box(a+joint/2,Math.min(S1,a+1.1)-joint/2,k>0?w-kerb:-w-.04,k>0?w+.04:-w+kerb,TOP-.1,TOP,i%2?COPING:COPING2);
    const inner=w-kerb,cols=3,cw=2*inner/cols;
    box(S0,S1,-inner,inner,TOP-.1,TOP-.03,MORTAR);
    for(let c=0;c<cols;c++)for(let a=S0-(c%2?slab/2:0),i=0;a<S1;a+=slab,i++){
      const a0=Math.max(S0,a)+joint/2,a1=Math.min(S1,a+slab)-joint/2;if(a1-a0<.05)continue;
      box(a0,a1,-inner+c*cw+joint/2,-inner+(c+1)*cw-joint/2,TOP-.1,TOP-.005,(i+c)%3?PAVE:PAVE2);
    }
    // Waterline stain and bollards on every face that has water along it.
    for(const k of sides.length?sides:[side]){
      box(S0,S1,k*w-.06,k*w+.06,-.1,.05,WET);
      for(let a=S0+1;a<S1-.4;a+=2.2)box(a-.1,a+.1,k*(w-.22)-.1,k*(w-.22)+.1,TOP,TOP+.24,DARK);
    }
    // Plinths: the footprint of each tower and wall against the quay, built up in the quay's
    // stone from the sea bed to the coping, so they stand at the quay level.
    const prism=(poly,z0,z1,c,cTop)=>{
      for(let i=0;i<poly.length;i++){
        const p=poly[i],q=poly[(i+1)%poly.length];
        for(const tri of [[[p,z0],[q,z0],[q,z1]],[[p,z0],[q,z1],[p,z1]]]){for(const [v,z] of tri)pos.push(v.x,v.y,z);col.push(window.ConquerStoneColor?.shade(i%2?c:STONE2)||(i%2?c:STONE2))}
      }
      for(let i=1;i+1<poly.length;i++){for(const v of [poly[0],poly[i],poly[i+1]])pos.push(v.x,v.y,z1);col.push(window.ConquerStoneColor?.shade(cTop)||cTop)}
    };
    if(typeof footprintPoints==='function')for(const o of onIt){const fp=footprintPoints(o);if(fp?.length>=3)prism(fp,BED,TOP,STONE,COPING)}
    const list=[{pos,col}];
    const dressing=dress(s,sides.length?sides:[side],piers);if(dressing)list.push(dressing);
    cache.set(s.id||'preview',{key,list});
    return list;
  }
  // Harbour dressing on the coping: the construction kit's treadwheel crane (at the head of
  // a mole, or midway along a shore quay) and hoists on the wet edges, clear of the piers;
  // goods from the scatter model down the middle, clear of the crane.
  function dress(s,sides,piers){
    const K=window.ConquerConstructionModels,SM=window.ConquerScatterModel;if(!K?.models&&!SM?.assets)return null;
    const {L,u,n}=frame(s),pos=[],col=[],w=WIDTH/2;
    const rnd=seedRand((Number(State.seed)||1)^[...String(s.id||'quay')].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619),2166136261));
    const yawTo=k=>Math.atan2(n.y*k,n.x*k);
    const put=(verts,idx,colours,palette,o,yaw,k=1)=>{
      const c=Math.cos(yaw)*k,sn=Math.sin(yaw)*k;
      for(let t=0;t<colours.length;t++){
        for(let q=0;q<3;q++){const j=idx[t*3+q]*3,x=verts[j],y=verts[j+1];pos.push(o.x+x*c-y*sn,o.y+x*sn+y*c,TOP+verts[j+2]*k)}
        col.push(palette[colours[t]]);
      }
    };
    const model=(name,o,yaw,k)=>{const m=K?.models?.[name];if(!m)return;for(const part of Object.values(m.parts))put(part.p,part.i,part.c,K.palette,o,yaw,k)};
    const nearPier=p=>piers.some(q=>dist(q,p)<1.4);
    // The crane: at the head when both sides are wet (a mole), else halfway along.
    const craneAt=sides.length===2?L-1.3:L/2;
    model('treadwheelCrane',at(s,craneAt,0),yawTo(sides[0]),.8);
    // Hoists along the wet edges, one every ~6U, not where a pier starts.
    for(const k of sides)for(let a=2.2;a<L-1;a+=6){const p=at(s,a,k*(w-.35));if(!nearPier(p)&&Math.abs(a-craneAt)>1.6)model('hoist',p,yawTo(k),.85)}
    // Goods every ~1.5U down the middle, kept off the crane.
    const GOODS=['crateStack','barrelGroup','sackPile','goodsMixed','crateStack','ropeCoil'];
    if(SM?.assets)for(let a=.8,i=0;a<L-.6;a+=1.5,i++){
      if(Math.abs(a-craneAt)<1.6)continue;
      const name=GOODS[Math.floor(rnd()*GOODS.length)],g=SM.assets[name];if(!g)continue;
      const across=(i%2?.35:-.35)*(sides.length===2?1:-sides[0]);     // a shore quay keeps them on the land side
      put(g.v,g.i,g.c,SM.palette,at(s,a,across),Math.atan2(u.y,u.x)+(rnd()<.5?0:Math.PI/2),1.25);
    }
    return col.length?{pos,col}:null;
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
  window.ConquerQuay=Object.freeze({SPEC,WIDTH,TOP,is,make,footprint,seaSide,wetSides,validate,edgeHit,
    snapWallAnchor,snapTower,wallGroundZ,wallRoute,isWallOn,snapQuay,joined,isQuayWall,faceWallOut,berths,BERTH_STEP,BERTH_PIER_GAP,meshes,draw,addToBuilder,cost,buildDays,label});
})();
