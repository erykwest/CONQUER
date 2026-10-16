'use strict';
// CONQUER cutaway furniture: furnishes every functional room of an open tower, gate or
// built section with the Blender-built pieces (src/assets/furniture-model.js, plus the
// scatter props as 's:<name>'). Each role has a layout per room size (normal / large:
// a large barracks gets more bunks), wall pieces stand on the two walls that stay
// visible in cutaway (they follow the camera turn), towers keep a ladder corner between
// floors, the gate passage stays clear on the ground floor. Drawn as merged polygons,
// depth-sorted, with the castle two-tone shading and the realm's heraldry colours;
// torch and candle flames are exported as lights for the night cutaway.
(function(){
  const FM=()=>window.ConquerFurnitureModel,SM=()=>window.ConquerScatterModel;
  const GAP=.02,LADDER_W=.16,LADDER_CLEAR=.34;
  function model(name){
    if(name.startsWith('s:')){const m=SM();return m&&{m,p:m.assets[name.slice(2)]}}
    const m=FM();return m&&{m,p:m.pieces[name]};
  }
  // ---------- geometry: indexed triangles -> polygons (coplanar same-colour pairs merged)
  const faceCache=new Map();
  function pieceFaces(name){
    if(faceCache.has(name))return faceCache.get(name);
    const e=model(name);if(!e?.p){faceCache.set(name,null);return null}
    const {m,p}=e,V=p.v,I=p.i,out=[];
    const P=k=>[V[k*3],V[k*3+1],V[k*3+2]];
    const normal=(a,b,c)=>{const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const L=Math.hypot(...n)||1;return n.map(x=>x/L)};
    for(let t=0;t<p.c.length;t++){
      let ids=[I[t*3],I[t*3+1],I[t*3+2]];
      const n=normal(P(ids[0]),P(ids[1]),P(ids[2]));
      if(t+1<p.c.length&&p.c[t+1]===p.c[t]){
        const nx=[I[t*3+3],I[t*3+4],I[t*3+5]],shared=nx.filter(k=>ids.includes(k));
        const n2=normal(P(nx[0]),P(nx[1]),P(nx[2]));
        if(shared.length===2&&n[0]*n2[0]+n[1]*n2[1]+n[2]*n2[2]>.999){
          const extra=nx.find(k=>!ids.includes(k));
          for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3];if(shared.includes(a)&&shared.includes(b)){ids=[...ids.slice(0,i+1),extra,...ids.slice(i+1)];break}}
          t++;
        }
      }
      out.push({pts:ids.map(P),key:m.paletteKeys[p.c[t]],hex:m.palette[p.c[t]],n});
    }
    const res={faces:out,d:p.d??(p.r*2),w:p.w??(p.r*2),h:p.h,back:p.back??-(p.r),lights:p.lights||[]};
    faceCache.set(name,res);return res;
  }
  // Scatter props carry only a radius: use it as their footprint.
  function size(name){const f=pieceFaces(name);return f?{d:f.d,w:f.w,back:f.back}:{d:.2,w:.2,back:-.1}}

  // ---------- room frame
  // Local (u,v) along the room basis; the two sides whose outward normals point away
  // from the camera are the walls that stay standing in cutaway.
  const SIDES={'u+':[1,0],'u-':[-1,0],'v+':[0,1],'v-':[0,-1]};
  function frame(slot){
    const b=slot.basis,ca=Math.cos(b.angle),sa=Math.sin(b.angle);
    const toWorld=(u,v)=>({x:b.center.x+u*ca-v*sa,y:b.center.y+u*sa+v*ca});
    const d0=viewDepthPoint(b.center);
    const far=Object.keys(SIDES).map(k=>{const [du,dv]=SIDES[k],p=toWorld(du*.1,dv*.1);return{k,d:viewDepthPoint(p)-d0}})
      .sort((a,b)=>a.d-b.d).slice(0,2).map(x=>x.k);
    // The longer far wall first (it takes the main pieces).
    const len=k=>k[0]==='u'?b.h:b.w;far.sort((a,c)=>len(c)-len(a));
    return{b,toWorld,far,hu:b.w/2,hv:b.h/2,round:slot.round};
  }
  // ---------- layout builder
  function builder(slot,opts){
    const F=frame(slot),items=[],boxes=[];
    const rnd=seedRand((Number(State.seed)||1)^hashStr(slot.key));
    const reserve=[];   // [u0,v0,u1,v1] kept clear (ladder corner, gate passage)
    if(opts.ladderCorner){
      const [a,b]=F.far.map(k=>SIDES[k]),cu=(a[0]||b[0])*F.hu,cv=(a[1]||b[1])*F.hv;
      reserve.push([cu-Math.sign(cu)*LADDER_CLEAR-.01,cv-Math.sign(cv)*LADDER_CLEAR-.01,cu,cv].map((x,i,arr)=>x));
      F.ladder={u:cu-Math.sign(cu)*(LADDER_W/2+.04),v:cv-Math.sign(cv)*(LADDER_W/2+.04),side:F.far[0]};
    }
    if(opts.passage)reserve.push(opts.passage);
    // Archer posts at the arrow slits of this floor stay clear of furniture.
    for(const p of opts.posts||[]){
      const dx=p.x-F.b.center.x,dy=p.y-F.b.center.y,ca=Math.cos(F.b.angle),sa=Math.sin(F.b.angle);
      const u=dx*ca+dy*sa,v=-dx*sa+dy*ca,h=.17;reserve.push([u-h,v-h,u+h,v+h]);
    }
    const norm=r=>[Math.min(r[0],r[2]),Math.min(r[1],r[3]),Math.max(r[0],r[2]),Math.max(r[1],r[3])];
    const hit=(r,list)=>list.some(q=>{const a=norm(r),c=norm(q);return a[0]<c[2]&&a[2]>c[0]&&a[1]<c[3]&&a[3]>c[1]});
    // Footprint from the piece's real local extent (x from back to back+d, y centred),
    // turned by quarter turns: wall pieces such as torches only reach forward.
    function rectOf(name,u,v,rot){
      const s=size(name),x0=s.back,x1=s.back+s.d,y0=-s.w/2,y1=s.w/2;
      const c=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>rot===0?[x,y]:rot===1?[-y,x]:rot===2?[-x,-y]:[y,-x]);
      return[u+Math.min(...c.map(p=>p[0])),v+Math.min(...c.map(p=>p[1])),u+Math.max(...c.map(p=>p[0])),v+Math.max(...c.map(p=>p[1]))];
    }
    function place(name,u,v,turn,{deco=false,lift=0}={}){
      const rot=((turn%4)+4)%4,r=rectOf(name,u,v,rot);
      if(r[0]<-F.hu-1e-6||r[2]>F.hu+1e-6||r[1]<-F.hv-1e-6||r[3]>F.hv+1e-6)return false;
      if(F.round&&Math.hypot(Math.max(Math.abs(r[0]),Math.abs(r[2])),Math.max(Math.abs(r[1]),Math.abs(r[3])))>F.hu+.02)return false;
      if(!deco&&(hit(r,boxes)||hit(r,reserve)))return false;
      if(!deco)boxes.push(r);
      items.push({name,u,v,turn:rot,lift,r,deco});return true;
    }
    // Back against a far wall at t in [-1,1] along it, front facing the room.
    function wall(side,t,name,o={}){
      const s=size(name),[du,dv]=SIDES[side],inset=(o.off||0)-s.back+GAP;
      const turn=side==='u+'?2:side==='u-'?0:side==='v+'?3:1;
      const along=(du?F.hv:F.hu)-s.w/2-.02;
      // The requested spot first, then neighbours along the same wall (ladder corner, other pieces).
      const tries=o.exact?[t]:[t,t+.35,t-.35,t+.7,t-.7,-t,1,-1].map(x=>Math.max(-1,Math.min(1,x)));
      for(const tt of tries){
        const pos=tt*Math.max(0,along),u=du?du*(F.hu-inset):pos,v=dv?dv*(F.hv-inset):pos;
        const [pu,pv]=F.round?shrinkRound(u,v,s):[u,v];
        if(place(name,pu,pv,turn,o))return true;
      }
      return false;
    }
    function shrinkRound(u,v,s){const r=Math.hypot(u,v),lim=F.hu-Math.max(s.d,s.w)*.5-.02;return r>lim?[u*lim/r,v*lim/r]:[u,v]}
    // n pieces spread along a wall (as many as fit).
    function row(side,name,n,o={}){
      let placed=0;const ts=n===1?[o.t??0]:Array.from({length:n},(_,i)=>-1+2*i/(n-1));
      for(const t of ts)if(wall(side,t,name,{...o,exact:n>1}))placed++;
      // What does not fit on this wall continues on the other standing wall.
      if(placed<n&&o.spill!==false&&side!==F.far[1]){
        const rest=n-placed,ts2=rest===1?[0]:Array.from({length:rest},(_,i)=>-1+2*i/(rest-1));
        for(const t of ts2)if(wall(F.far[1],t,name,{...o,exact:rest>1}))placed++;
      }
      return placed;
    }
    // Free-standing piece at a fraction of the room (fu,fv in [-1,1]) facing turn.
    function at(fu,fv,name,turn=0,o={}){return place(name,fu*F.hu*.9,fv*F.hv*.9,turn,o)}
    // Try a few jittered spots around a target.
    // Near the wanted spot first, then anywhere in the room (closest first, both turns).
    function near(fu,fv,name,turn=0,o={}){
      for(let k=0;k<6;k++){const j=k?.25:0;if(at(fu+(rnd()-.5)*j,fv+(rnd()-.5)*j,name,turn,o))return true}
      const grid=[];for(let a=-1;a<=1.001;a+=.2)for(let b=-1;b<=1.001;b+=.2)grid.push([a,b,Math.hypot(a-fu,b-fv)]);
      grid.sort((p,q)=>p[2]-q[2]);
      for(const [a,b] of grid)for(const t of [turn,turn+1])if(at(a,b,name,t,o))return true;
      return false;
    }
    const facing=side=>side==='u+'?2:side==='u-'?0:side==='v+'?3:1;
    // Turn that faces TOWARDS a far wall (pews looking at the altar).
    const toward=side=>(facing(side)+2)%4;
    // Fractions for a point just in front of a far wall.
    const front=(side,t,depth=.45)=>{const [du,dv]=SIDES[side];return du?[du*(1-depth),t]:[t,dv*(1-depth)]};
    return{F,rnd,items,large:slot.size==='large',A:F.far[0],B:F.far[1],wall,row,at,near,facing,toward,front,place};
  }
  function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

  // ---------- room recipes: counts scale with the room size
  // A long table parallel to the main wall with a bench on each long side.
  function tableWithBenches(r,fu,fv){
    const alongV=r.A[0]==='u',turn=alongV?0:1,o=.42;
    if(!r.near(fu,fv,'tableLong',turn))return false;
    if(alongV){r.near(fu-o,fv,'bench',turn);r.near(fu+o,fv,'bench',turn)}else{r.near(fu,fv-o,'bench',turn);r.near(fu,fv+o,'bench',turn)}
    return true;
  }
  const ROOMS={
    guard(r){r.row(r.A,'spearRack',1,{t:-.4});r.wall(r.B,.2,'bench');r.near(.15,.1,'tableSmall');r.near(.15,-.45,'stool');r.near(-.3,.15,'stool');
      r.wall(r.A,.6,'brazier',{off:.1});if(r.large){r.wall(r.B,-.7,'s:barrelGroup');r.wall(r.A,.1,'bench')}},
    barracks(r){const n=r.large?4:2;r.row(r.A,'bunkBed',n);r.row(r.B,'chest',r.large?2:1,{t:.5});
      if(r.large)tableWithBenches(r,.0,.35);else r.near(.2,.3,'stool');
      r.wall(r.B,-.6,'washBasin')},
    quarters(r){ROOMS.barracks(r)},
    armory(r){r.row(r.A,'spearRack',r.large?2:1);r.row(r.B,'swordRack',1,{t:-.3});r.wall(r.A,0,'shieldWall',{deco:true});
      r.near(.15,.2,'armorStand',0);if(r.large)r.near(-.35,.25,'armorStand',0);r.wall(r.B,.6,'arrowCrate');if(r.large)r.near(.4,-.3,'s:barrelGroup')},
    storage(r){const list=r.large?['s:crateStack','s:barrelGroup','s:sackPile','s:plankStack','s:stonePile','s:ropeCoil','s:crateStack']:['s:crateStack','s:sackPile','s:barrelGroup','chest'];
      list.forEach((n,i)=>r.wall(i%2?r.B:r.A,-.8+(i>>1)*.8,n)||r.near((r.rnd()-.5)*1.2,(r.rnd()-.5)*1.2,n))},
    granary(r){r.row(r.A,'grainBin',r.large?2:1);r.wall(r.B,-.4,'s:sackPile');r.wall(r.B,.5,'s:sackPile');r.near(.2,.2,'scales',r.toward(r.A));
      if(r.large){r.near(-.4,.3,'s:sackPile');r.near(.45,-.35,'s:hayBales')}},
    kitchen(r){r.wall(r.A,-.3,'hearth');r.wall(r.B,.3,'shelf');r.near(.15,.15,r.large?'tableLong':'tableSmall',1);r.wall(r.B,-.7,'s:barrelGroup');
      if(r.large){r.wall(r.A,.6,'breadOven');r.near(-.4,-.3,'hamRack');r.near(.5,.5,'s:firewood')}else r.wall(r.A,.7,'s:firewood')},
    stables(r){r.row(r.A,'stall',r.large?3:1);r.wall(r.B,0,'manger');r.near(.3,.3,'s:hayBales');r.near(-.3,.4,'s:buckets');if(r.large)r.near(.4,-.4,'saddleStand',1)},
    nobleRoom(r){r.wall(r.A,-.2,'canopyBed');r.at(.1,.2,'rug',0,{deco:true});r.wall(r.B,.6,'tapestry',{deco:true});
      r.wall(r.B,-.5,r.large?'fireplace':'chest');r.near(.35,.35,'tableSmall');r.near(.6,.35,'chair',2);
      if(r.large){r.near(-.4,.45,'writingDesk',r.toward(r.A));r.near(.5,-.5,'chest');r.wall(r.A,.75,'candleStand')}},
    workshop(r){r.wall(r.A,-.35,'forge');r.near(.1,-.2,'anvil',1);r.wall(r.B,.2,'s:workbench');r.wall(r.B,-.7,'toolRack',{deco:true});r.near(-.35,.3,'s:buckets');
      if(r.large){r.near(.45,.45,'grindstone');r.wall(r.A,.6,'s:barrelGroup')}},
    chapel(r){r.wall(r.A,0,'altar');const rows=r.large?4:2,turn=r.toward(r.A);
      for(let i=0;i<rows;i++){const [fu,fv]=r.front(r.A,i%2?.45:-.45,.55+Math.floor(i/2)*.42);r.near(fu,fv,'pew',turn)}
      r.wall(r.B,-.6,'candleStand');r.wall(r.B,.6,'candleStand');if(r.large){r.near(.5,.5,'lectern',turn);r.wall(r.A,.85,'banner')}else{const [fu,fv]=r.front(r.A,0,.3);r.near(fu,fv,'kneeler',turn)}},
    commonHall(r){tableWithBenches(r,0,0);r.wall(r.A,.7,'s:barrelGroup');r.wall(r.B,0,'banner');
      if(r.large){r.wall(r.A,-.4,'fireplace');tableWithBenches(r,.45,.5)}else r.wall(r.A,-.5,'brazier',{off:.1})},
    throneHall(r){r.wall(r.A,0,'throne');const [fu,fv]=r.front(r.A,0,1.05);r.at(fu*.55,fv*.55,'runner',r.toward(r.A),{deco:true});
      r.wall(r.A,-.85,'banner');r.wall(r.A,.85,'banner');r.wall(r.B,.0,'shieldWall',{deco:true});
      r.near(.55,-.5,'brazier');r.near(-.55,.5,'brazier');if(r.large){r.near(.4,.45,'tableLong');r.wall(r.B,-.7,'candleStand')}},
    treasury(r){r.row(r.A,'strongChest',r.large?3:2);r.wall(r.B,-.5,'goldChest');r.near(.2,.2,'coinSacks');
      if(r.large){r.wall(r.B,.4,'ingotRack');r.near(-.4,.4,'writingDesk');r.near(.5,-.3,'coinSacks')}},
    prison(r){r.wall(r.A,0,'cellBars',{off:.35});r.wall(r.A,-.4,'wallChains',{deco:true});r.wall(r.A,.4,'straw',{deco:true});
      r.near(.45,.4,'tableSmall');r.near(.2,.45,'stool');r.near(-.4,.45,'s:buckets');if(r.large)r.near(.5,-.5,'stocks')}
  };

  // ---------- rooms of a structure
  function passageFor(s,slot){
    if(s.type!=='gate'||slot.index!==0)return null;
    // Portals sit on footprint edges 1 and 3: keep the strip between them clear.
    const fp=footprintPoints(s),m1={x:(fp[1].x+fp[2].x)/2,y:(fp[1].y+fp[2].y)/2},m3={x:(fp[3].x+fp[0].x)/2,y:(fp[3].y+fp[0].y)/2};
    const b=slot.basis,ax=m1.x-m3.x,ay=m1.y-m3.y,L=Math.hypot(ax,ay)||1,lu=(ax*Math.cos(b.angle)+ay*Math.sin(b.angle))/L;
    const half=.38;
    return Math.abs(lu)>.7?[-b.w/2,-half,b.w/2,half]:[-half,-b.h/2,half,b.h/2];
  }
  function layoutStructure(s,g){
    const slots=cutawayRoomSlots(s,g),levels=structureLevel(s),out=[];
    for(const slot of slots){
      const key=s.id+':'+slot.index,ladder=['tower','gate'].includes(s.type)&&levels>1;
      const posts=s.type==='tower'?(window.ConquerSiege?.archerSlots(s)||[]).filter(a=>a.kind==='slit'&&a.floor===slot.index+1).map(a=>a.p):[];
      const r=builder({...slot,key,round:s.type==='tower'&&s.shape==='round'},{ladderCorner:ladder,passage:passageFor(s,slot),posts});
      if(slot.role&&ROOMS[slot.role])ROOMS[slot.role](r);
      // Torches on the standing walls light every furnished room at night.
      if(slot.role){r.wall(r.A,r.large?-.5:.0,'torchWall',{deco:true});if(r.large)r.wall(r.B,.5,'torchWall',{deco:true})}
      out.push({slot,F:r.F,items:r.items,ladder:ladder&&slot.index<levels-1?r.F.ladder:null,
        nextZ:slots[slot.index+1]?.z??cutawayFloorLevels(s)[slot.index+1]?.z});
    }
    return out;
  }
  // ---------- world faces
  function heraldry(){const h=State.heraldry||{};return{heraldA:h.c1||REIGN_COLOR_1,heraldB:h.c2||REIGN_COLOR_2}}
  function pieceWorld(item,F,z,out,lights,her){
    const pf=pieceFaces(item.name);if(!pf)return;
    const a=F.b.angle+item.turn*Math.PI/2,ca=Math.cos(a),sa=Math.sin(a),c=F.toWorld(item.u,item.v),zz=z+(item.lift||0);
    const W=([x,y,zl])=>[c.x+x*ca-y*sa,c.y+x*sa+y*ca,zz+zl];
    for(const f of pf.faces){
      const n=[f.n[0]*ca-f.n[1]*sa,f.n[0]*sa+f.n[1]*ca,f.n[2]];
      out.push({pts:f.pts.map(W),hex:her[f.key]||f.hex,n});
    }
    for(const [x,y,zl,kind] of pf.lights)lights.push({p:W([x,y,zl]),kind});
  }
  function boxWorld(F,u,v,z0,du,dv,h,hex,out){
    const c=[[u-du/2,v-dv/2],[u+du/2,v-dv/2],[u+du/2,v+dv/2],[u-du/2,v+dv/2]].map(([a,b])=>F.toWorld(a,b));
    const top=c.map(p=>[p.x,p.y,z0+h]);out.push({pts:top,hex,n:[0,0,1]});
    for(let i=0;i<4;i++){const p=c[i],q=c[(i+1)%4],nx=(p.x+q.x)/2-F.toWorld(u,v).x,ny=(p.y+q.y)/2-F.toWorld(u,v).y,L=Math.hypot(nx,ny)||1;
      out.push({pts:[[p.x,p.y,z0],[q.x,q.y,z0],[q.x,q.y,z0+h],[p.x,p.y,z0+h]],hex,n:[nx/L,ny/L,0]})}
  }
  // Ladder from this floor to the next one, leaning in the far corner.
  function ladderWorld(L,F,z0,z1,out){
    const h=Math.max(.3,z1-z0),along=L.side[0]==='u'?'v':'u',sideU=along==='u';
    for(const s of [-1,1]){
      const du=sideU?.012:.02,dv=sideU?.02:.012,o=s*LADDER_W/2;
      boxWorld(F,L.u+(sideU?o:0),L.v+(sideU?0:o),z0,sideU?.025:.025,sideU?.025:.025,h+.08,'#8b6a45',out);
    }
    for(let k=1;k*.09<h;k++){
      const z=z0+k*.09;
      boxWorld(F,L.u,L.v,z-.008,sideU?LADDER_W:.02,sideU?.02:LADDER_W,.016,'#b98652',out);
    }
  }
  const cache=new Map();
  function structureFaces(s,g){
    const key=[s.id,State.view.rotation||0,JSON.stringify((window.ConquerSiege?.archerSlots(s)||[]).map(a=>a.id)),(typeof isPlanView==='function'&&isPlanView())?1:0,JSON.stringify(s.functions||[]),structureLevel(s),s.x,s.y,s.angle,s.size,s.r,State.heraldry?.c1,State.heraldry?.c2,!!FM(),!!SM()].join('|');
    const hit=cache.get(s.id);if(hit&&hit.key===key)return hit;
    const faces=[],lights=[],her=heraldry(),spots=new Map();
    for(const room of layoutStructure(s,g)){
      for(const it of room.items)pieceWorld(it,room.F,room.slot.z+.012,faces,lights,her);
      if(room.ladder&&Number.isFinite(room.nextZ))ladderWorld(room.ladder,room.F,room.slot.z+.01,room.nextZ,faces);
      spots.set(room.slot.index,freeSpots(room));
    }
    const res={key,faces,lights,spots};cache.set(s.id,res);return res;
  }
  // Standing spots for room occupants: grid points clear of furniture footprints.
  function freeSpots(room){
    const F=room.F,boxes=room.items.filter(i=>!i.deco).map(i=>[i.r[0]-.06,i.r[1]-.06,i.r[2]+.06,i.r[3]+.06]);
    const out=[];
    for(let a=-.7;a<=.71;a+=.35)for(let b=-.7;b<=.71;b+=.35){
      const u=a*F.hu,v=b*F.hv;
      if(F.round&&Math.hypot(u,v)>F.hu-.12)continue;
      if(boxes.some(r=>u>r[0]&&u<r[2]&&v>r[1]&&v<r[3]))continue;
      out.push(F.toWorld(u,v));
    }
    return out;
  }
  // ---------- painting
  function depthOf(x,y,z){return typeof isPlanView==='function'&&isPlanView()?z:viewDepthPoint({x,y})+.9*z}
  function draw(s,g){
    if(!FM())return false;
    const {faces}=structureFaces(s,g),turns=State.view.rotation||0,W3=window.ConquerWagons3D;
    const list=faces.map(f=>{let d=0;for(const p of f.pts)d+=depthOf(p[0],p[1],p[2]);return{f,d:d/f.pts.length}}).sort((a,b)=>a.d-b.d);
    ctx.save();ctx.lineJoin='round';ctx.lineWidth=.5;
    for(const {f} of list){
      const k=W3?W3.shadeFactor(f.n[0],f.n[1],f.n[2],turns):1,h=f.hex.replace('#',''),rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
      const lum=(rgb[0]+rgb[1]+rgb[2])/765,kk=lum>.7?1-(1-k)*.55:k;
      const col='rgb('+(rgb[0]*kk|0)+','+(rgb[1]*kk|0)+','+(rgb[2]*kk|0)+')';
      ctx.fillStyle=ctx.strokeStyle=col;ctx.beginPath();
      f.pts.forEach((p,i)=>{const q=w2s({x:p[0],y:p[1]},p[2]);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});
      ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.restore();
    return true;
  }
  function lights(s,g){return FM()?structureFaces(s,g).lights:[]}
  // Night cutaway: torches, candles and hearth fires glow after the night overlay.
  const GLOW={torch:{r:20,a:.5},fire:{r:26,a:.55},candle:{r:10,a:.42}};
  function drawNightGlow(nf){
    if(nf<=.01||!FM())return;
    const scale=clamp(State.view.scale,.55,2.4);
    for(const s of State.structures){
      if(!structureCutaway(s)||underConstruction(s))continue;
      const paint=()=>{
        ctx.save();ctx.globalCompositeOperation='screen';
        lights(s,cutawayWallGeometry(s)).forEach((L,i)=>{
          const k=GLOW[L.kind]||GLOW.candle,q=w2s({x:L.p[0],y:L.p[1]},L.p[2]);
          const fl=typeof fireFlicker==='function'?fireFlicker(s.id+':'+i):1,n=Math.max(.1,nf)*fl,r=k.r*scale;
          const g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r);
          g.addColorStop(0,'rgba(255,214,120,'+(k.a*n).toFixed(3)+')');
          g.addColorStop(.4,'rgba(245,150,52,'+(k.a*.45*n).toFixed(3)+')');
          g.addColorStop(1,'rgba(245,150,52,0)');
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();
        });
        ctx.restore();
      };
      if(s.type==='tower'||s.type==='gate')withStructureGroundPlane(s,paint);else paint();
    }
  }
  function standSpots(s,slot,count){
    const all=FM()?structureFaces(s,cutawayWallGeometry(s)).spots.get(slot.index)||[]:[];
    if(!all.length)return null;
    const rnd=seedRand(hashStr(s.id+':spots:'+slot.index)),pool=all.slice(),out=[];
    while(out.length<count&&pool.length)out.push(pool.splice(Math.floor(rnd()*pool.length),1)[0]);
    return out;
  }
  window.ConquerCutawayFurniture={ROOMS,draw,lights,drawNightGlow,standSpots,layoutStructure,pieceFaces,clear:()=>cache.clear()};
})();
