'use strict';
// People at the event venues, aligned with CANS (docs/CANS-ARCHITECTURE.md on `cans`):
//   1. slots(venue)      ActivitySlot-like records read from the placed models: stable id,
//                        role 'guest' | 'worker', action (sit, stand, watch, perform,
//                        announce, sell, browse, queue), local position, height, facing.
//                        An event venue is the ActivityDomain; its id is the venue's id.
//   2. occupants(venue)  the occupancy register: at most one occupant per slot and one
//                        slot per occupant. Until the CANS adapters exist it is filled by
//                        a deterministic PROVISIONAL source (anonymous extras, flagged
//                        provisional:true); setOccupancySource() swaps in the real one.
//   3. scenes            joust (settlement-events-joust.js), feast and circus draw ONLY
//                        registered occupants; an empty slot creates nobody.
// 2D figures drawn with the villagers (both renderers), on a real-time clock that runs
// only while the game runs. Scenes are pure (local U, seconds) for the QA.
(function(){
  const E=()=>window.ConquerEvents3D;
  const M=()=>window.ConquerEventModels?.models||{};
  const C=()=>window.ConquerCivicModels?.models||{};
  const S=3.5;                                       // metres per U (civic props are authored in metres)
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  const lerp=(a,b,k)=>a+(b-a)*k,smooth=k=>{k=Math.max(0,Math.min(1,k));return k*k*(3-2*k)};
  const venueId=s=>String(s.id??(s.x+','+s.y));
  const seedOf=s=>((typeof State!=='undefined'&&State.seed)||1)+'|'+venueId(s);
  const setupOf=s=>s.event?.setup||E()?.VENUES[s.venue]?.setup||null;

  // ---------- 1. slots
  // Local (model) slot points of the props that are not event models: civic tables,
  // barrel tables and stalls (metres -> U).
  const CIVIC_SLOTS={
    prop_tableSet:()=>[-1,1].flatMap(side=>[-.6,0,.6].map(x=>({x:x/S,y:side*.75/S,z:.45/S,role:'guest',action:'sit',face:{x:0,y:-side}}))),
    prop_tableBarrel:()=>[.3,2.4,4.3].map(a=>({x:Math.cos(a)*.75/S,y:Math.sin(a)*.75/S,z:.5/S,role:'guest',action:'sit',face:{x:-Math.cos(a),y:-Math.sin(a)}})),
    stall:()=>[{x:0,y:0,z:0,role:'worker',action:'sell',face:{x:0,y:-1}},
      ...[-.32,0,.32].map(x=>({x,y:-.52,z:0,role:'guest',action:'browse',face:{x:0,y:1}}))]
  };
  // Event models: from their meta (seats, standing, performers, speaker), plus the
  // watchers around stages and podiums and the queue of a ticket booth.
  function eventSlots(ref){
    const m=M()[ref],meta=m?.meta||{},out=[];
    const face=meta.facing?{x:meta.facing[0],y:meta.facing[1]}:{x:0,y:-1};
    for(const q of meta.seats||[])out.push({x:q[0],y:q[1],z:q[2],role:'guest',action:'sit',face:q.length>3?{x:Math.cos(q[3]),y:Math.sin(q[3])}:face});
    for(const q of meta.standing||[])out.push({x:q[0],y:q[1],z:q[2],role:'guest',action:'stand',face});
    for(const q of meta.performers||[])out.push({x:q[0],y:q[1],z:q[2],role:'worker',action:'perform',face});
    for(const q of meta.actors||[])out.push({x:q[0],y:q[1],z:q[2],role:'worker',action:'perform',face});      // theatre stage
    for(const q of meta.wings||[])out.push({x:q[0],y:q[1],z:q[2],role:'worker',action:'wait',face});          // waiting in the wings
    if(meta.speaker)out.push({x:meta.speaker[0],y:meta.speaker[1],z:meta.speaker[2],role:'worker',action:'announce',face});
    if(ref==='stagePlayers'||ref==='stageHerald'){
      // An audience standing in an arc in front of the stage.
      for(let i=0;i<7;i++){const a=Math.PI*(.18+.64*i/6);out.push({x:Math.cos(a)*.95,y:-.75-Math.sin(a)*.42,z:0,role:'guest',action:'watch',face:{x:-Math.cos(a)*.3,y:1}})}
    }else if(ref==='podiumStreet'){
      for(let i=0;i<5;i++){const a=-Math.PI*(.15+.7*i/4);out.push({x:Math.cos(a)*.62,y:Math.sin(a)*.62,z:0,role:'guest',action:'watch',face:{x:-Math.cos(a),y:-Math.sin(a)}})}
    }else if(ref==='arenaU'&&meta.field){
      // Two combatants in the middle of the sand, facing each other.
      const cx=(meta.field.arcCentre[0]+meta.field.openEnd[0])/2,cy=(meta.field.arcCentre[1]+meta.field.openEnd[1])/2;
      for(const sx of [-1,1])out.push({x:cx+sx*.35,y:cy,z:0,role:'worker',action:'fight',pair:0,face:{x:-sx,y:0}});
    }else if(ref==='circusBooth'){
      out.push({x:0,y:.02,z:0,role:'worker',action:'sell',face:{x:0,y:-1}});
      for(let i=0;i<4;i++)out.push({x:.03*(i%2?1:-1),y:-.42-.2*i,z:0,role:'guest',action:'queue',face:{x:0,y:1}});
    }
    return out;
  }
  function localSlots(ref){
    if(ref.startsWith('civic:'))return(CIVIC_SLOTS[ref.slice(6)]||(()=>[]))();
    if(ref.startsWith('sc:'))return[];
    return eventSlots(ref);
  }
  // ActivitySlot records of a venue in its local frame; ids are stable across frames,
  // saves and renderers (venue id, item index, action, index within the item).
  const slotCache=new Map();
  function slots(s){
    if(!E()?.is(s))return[];
    const items=[{m:E().venueModel(s),x:0,y:0,a:0,s:1},...E().placedItems(s)].filter(i=>i.m);
    const key=JSON.stringify(items.map(i=>[i.m,+i.x.toFixed(4),+i.y.toFixed(4),+(i.a||0).toFixed(4),i.s||1]))+'|'+venueId(s);
    const hit=slotCache.get(s);if(hit&&hit.key===key)return hit.list;
    const list=[],count=new Map();
    const setup=setupOf(s),camp=setup==='arenaLot'||setup==='tourney'||setup==='camp';
    // Combatants on the ground itself: three pairs in the tourney's fenced field, one
    // pair of knights sparring in the middle of the camp (venue frame, item -1).
    const field=setup==='tourney'?[[-2.1,-.3],[0,-.3],[2.1,-.3]]:setup==='camp'?[[-2.4,1.6],[0,1.6],[2.4,1.6]]:[];
    field.forEach(([fx,fy],k)=>{for(const sx of [-1,1])
      list.push({id:venueId(s)+':-1:fight:'+(k*2+(sx>0)),domain:venueId(s),item:-1,model:null,role:'worker',action:'fight',pair:k,
        x:fx+sx*.35,y:fy,z:0,face:{x:-sx,y:0}})});
    items.forEach((it,k)=>{
      const c=Math.cos(it.a||0),sn=Math.sin(it.a||0),sc=it.s||1;
      const local=localSlots(it.m);
      // Participants' camps (arena, tourney, knights' camp): a squire before each tent's door.
      const door=camp&&/^tent/.test(it.m)?M()[it.m]?.meta?.door:null;
      if(door)local.push({x:door[0],y:door[1]-.12,z:0,role:'worker',action:'prepare',face:{x:0,y:-1}});
      if(setup==='camp'){
        // The knights' camp is crowded: a knot of people chatting before each tent,
        // two hands at every rack and armour stand.
        if(door)for(const [dx,dy] of [[-.32,-.28],[.3,-.3],[.02,-.52]])
          local.push({x:door[0]+dx,y:door[1]+dy,z:0,role:'guest',action:'chat',face:{x:-dx,y:-dy}});
        if(/^prop(Weapon|Spear|Shield|Lance)Rack|^propArmour/.test(it.m))for(const sx of [-1,1])
          local.push({x:sx*.22,y:-.3,z:0,role:'worker',action:'tend',face:{x:-sx*.5,y:1}});
      }
      for(const q of local){
        const n=(count.get(k+q.action)||0);count.set(k+q.action,n+1);
        list.push({id:venueId(s)+':'+k+':'+q.action+':'+n,domain:venueId(s),item:k,model:it.m,role:q.role,action:q.action,pair:q.pair,
          x:it.x+(q.x*c-q.y*sn)*sc,y:it.y+(q.x*sn+q.y*c)*sc,z:q.z*sc,
          face:{x:q.face.x*c-q.face.y*sn,y:q.face.x*sn+q.face.y*c}});
      }
    });
    slotCache.set(s,{key,list});
    return list;
  }

  // ---------- 2. occupancy register
  // Provisional source: about two in three guest seats taken, every worker slot manned,
  // the same ones every time; occupants are anonymous extras, never residents.
  const FILL={sit:.66,stand:.6,watch:.75,browse:.5,queue:.85,chat:.85};   // workers (sell, perform, announce, fight, prepare): all
  function provisional(s,list){
    const out=[];
    for(const sl of list){
      const fill=sl.role==='worker'?1:FILL[sl.action]??.6;
      if((hash(seedOf(s)+'|occ|'+sl.id)%1000)/1000>=fill)continue;
      out.push({slot:sl.id,occupant:'extra:'+sl.id,state:'occupied',provisional:true});
    }
    return out;
  }
  let source=provisional;
  // A CANS adapter replaces the source: (venue, slots) -> [{slot, occupant, state}].
  function setOccupancySource(fn){source=typeof fn==='function'?fn:provisional}
  function occupants(s){
    const list=slots(s),byId=new Map(list.map(sl=>[sl.id,sl])),seen=new Set(),out=[];
    for(const r of source(s,list)||[]){
      const sl=byId.get(r.slot);
      // Invariants: a slot holds one occupant, an occupant holds one slot.
      if(!sl||seen.has('s|'+r.slot)||seen.has('o|'+r.occupant))continue;
      seen.add('s|'+r.slot);seen.add('o|'+r.occupant);
      out.push({...r,slotRef:sl});
    }
    return out;
  }

  // ---------- 3a. feast (sagra): diners at the tables, sellers at the stalls, players
  // on the stage, storytellers on the podiums, an audience; guests stroll from stall
  // to stall (an ActivitySequence over the stalls' browse slots).
  function feastScene(s,t){
    const occ=occupants(s),actors=[];
    for(const o of occ){
      const sl=o.slotRef,ph=hash(o.occupant)%628/100;
      const a={id:o.occupant,slot:sl.id,x:sl.x,y:sl.y,z:sl.z,action:sl.action,face:sl.face,provisional:o.provisional};
      if(sl.action==='perform'){
        // Dancers and musicians: hops and arm waves, out of step with each other.
        a.hop=.05*Math.max(0,Math.sin(t*4+ph));a.arms=.5+.5*Math.sin(t*3+ph);
      }else if(sl.action==='sit'){
        a.arms=Math.sin(t*.7+ph)>.85?.6:0;           // now and then a tankard goes up
        a.hop=.008*Math.sin(t*1.5+ph);
      }else if(sl.action==='sell'){a.arms=.35+.35*Math.sin(t*1.8+ph)}
      else if(sl.action==='watch'){a.hop=.01*Math.sin(t*2+ph);a.arms=Math.sin(t*.9+ph)>.9?.8:0}
      else if(sl.action==='browse'&&hash(o.occupant)%3===0){
        // A stroller: the occupant's ActivitySequence visits other stalls and comes back
        // to its own slot (browse 2.5 s, walk 2.5 s per leg); it stays the same person.
        const browse=slots(s).filter(b=>b.action==='browse'&&b.item!==sl.item);
        if(browse.length){
          const route=[sl,...[0,1,2].map(k=>browse[hash(o.occupant+'|'+k)%browse.length])];
          const leg=5,cyc=(t+ph)%(route.length*leg),k=Math.floor(cyc/leg),from=route[k],to=route[(k+1)%route.length];
          const w=smooth((cyc-k*leg-2.5)/2.5);
          Object.assign(a,{x:lerp(from.x,to.x,w),y:lerp(from.y,to.y,w),action:w>0&&w<1?'walk':'browse',face:{x:to.x-from.x,y:to.y-from.y},sequence:'stroll'});
        }
      }
      actors.push(a);
    }
    return{actors};
  }

  // ---------- 3b. circus: the barker calls from his podium, the booths sell tickets,
  // queues wait, ticket holders walk into the big top, a juggler plays on the side.
  function circusScene(s,t){
    const occ=occupants(s),actors=[],items=E().placedItems(s);
    const tent=items.find(i=>i.m==='circusTent');
    const door=tent&&M().circusTent?.meta?.door?(()=>{const d=M().circusTent.meta.door,c=Math.cos(tent.a||0),sn=Math.sin(tent.a||0);
      return{x:tent.x+d[0]*c-d[1]*sn,y:tent.y+d[0]*sn+d[1]*c}})():null;
    const podia=slots(s).filter(sl=>sl.model==='podiumStreet'&&sl.action==='perform');
    const barkerItem=podia.length?podia[0].item:-1;
    for(const o of occ){
      const sl=o.slotRef,ph=hash(o.occupant)%628/100;
      const a={id:o.occupant,slot:sl.id,x:sl.x,y:sl.y,z:sl.z,action:sl.action,face:sl.face,provisional:o.provisional};
      if(sl.action==='perform'){
        if(sl.item===barkerItem){a.arms=.6+.4*Math.abs(Math.sin(t*2.2+ph));a.hop=.02*Math.max(0,Math.sin(t*2.2))}  // the barker calls
        else{a.juggle=true;a.arms=.5}
      }else if(sl.action==='queue'){
        a.hop=.006*Math.sin(t*1.3+ph);
        if(door&&sl.id.endsWith(':0')){
          // The head of the queue: ticket bought, walks to the big top's door and goes in
          // (fades at the door), then is back at the head of the queue for the next show.
          const cyc=(t+ph)%12,k=smooth((cyc-3)/7);
          if(cyc>3){Object.assign(a,{x:lerp(sl.x,door.x,k),y:lerp(sl.y,door.y,k),action:cyc<10?'walk':'queue',
            face:{x:door.x-sl.x,y:door.y-sl.y},sequence:'enter',fade:cyc<9.3?1:Math.max(0,(10.5-cyc)/1.2)})}
        }
      }
      else if(sl.action==='sell'){a.arms=.3+.3*Math.sin(t*1.6+ph)}
      else if(sl.action==='watch'){a.hop=.01*Math.sin(t*2+ph);a.arms=Math.sin(t*1.1+ph)>.92?.9:0}
      actors.push(a);
    }
    return{actors,door};
  }

  // ---------- 3c. arena lot, stage and podium (street spot): the same register drives
  // spectators on the arena tiers, two combatants duelling in the sand and squires
  // before the participants' tents; actors and their audience on a stage (players
  // dressing) or a crier calling the crowd (herald dressing); a musician or a
  // storyteller on the podium with listeners around.
  const DUEL=6;                                    // a duel round: circle, exchange, a hit at its end
  function venueScene(s,t){
    const occ=occupants(s),actors=[];
    const round=(t%DUEL)/DUEL,cheer=Math.exp(-((round-.93)**2)/.002);   // the crowd roars at the hit
    // Each pair of combatants circles about its own centre.
    const centres=new Map();
    for(const f of slots(s).filter(x=>x.action==='fight')){const k=(f.item)+'|'+(f.pair||0),c=centres.get(k)||{x:0,y:0,n:0};c.x+=f.x;c.y+=f.y;c.n++;centres.set(k,c)}
    for(const c of centres.values()){c.x/=c.n;c.y/=c.n}
    for(const o of occ){
      const sl=o.slotRef,ph=hash(o.occupant)%628/100;
      const a={id:o.occupant,slot:sl.id,x:sl.x,y:sl.y,z:sl.z,action:sl.action,face:sl.face,provisional:o.provisional};
      const centre=sl.action==='fight'?centres.get(sl.item+'|'+(sl.pair||0)):null;
      if(sl.action==='wait'){a.hop=.006*Math.sin(t*1.2+ph);a.arms=Math.sin(t*.6+ph)>.95?.4:0}
      else if(sl.action==='chat'){a.hop=.006*Math.sin(t*1.7+ph);a.arms=Math.sin(t*1.3+ph)>.75?.45:0}       // talking with their hands
      else if(sl.action==='tend'){a.arms=.25+.25*Math.abs(Math.sin(t*3.4+ph));a.hop=.01*Math.max(0,Math.sin(t*3.4+ph))}   // polishing, mending
      else if(sl.action==='fight'&&centre){
        // Circle each other about the middle of the sand, swords swinging.
        const side=Math.atan2(sl.y-centre.y,sl.x-centre.x),ang=side+t*.5,r=.32+.05*Math.sin(t*1.7);
        Object.assign(a,{x:centre.x+Math.cos(ang)*r,y:centre.y+Math.sin(ang)*r,fighter:true,swing:(t*1.6+ph)%1});
      }else if(sl.action==='prepare'){
        // Back and forth between the tent and the camp's path, a lance on the shoulder.
        const walk=4,cyc=(t+ph)%(2*walk+3),out=cyc<walk?cyc/walk:cyc<walk+1.5?1:cyc<2*walk+1.5?1-(cyc-walk-1.5)/walk:0;
        const dx=-sl.x,dy=-sl.y,L=Math.hypot(dx,dy)||1,k=.55*smooth(out);
        Object.assign(a,{x:sl.x+dx/L*k,y:sl.y+dy/L*k,carry:out>0&&out<1&&cyc<walk?'lance':null,action:out>0&&out<1?'walk':'prepare'});
      }else if(sl.action==='perform'){a.hop=.05*Math.max(0,Math.sin(t*4+ph));a.arms=.5+.5*Math.sin(t*3+ph)}
      else if(sl.action==='announce'){a.arms=.55+.45*Math.abs(Math.sin(t*1.9));a.hop=.015*Math.max(0,Math.sin(t*1.9))}
      else if(sl.action==='watch'){a.hop=.01*Math.sin(t*2+ph);a.arms=Math.sin(t*.9+ph)>.9?.8:0}
      else if(sl.action==='sit'){
        const excite=cheer*(.6+.4*((hash(o.occupant+'e')%100)/100));
        a.hop=.01*Math.sin(t*1.5+ph)+excite*.07*Math.abs(Math.sin(t*11+ph));a.arms=excite;
      }
      actors.push(a);
    }
    return{actors,cheer};
  }

  // ---------- occluders: the people are 2D figures on the population pass, after the
  // scene, so the parts of the stands that stand in front of them are painted again in
  // the same depth order as the figures: the stands' front band (balustrade and its
  // hangings) and back band (backrest), the arena's barrier, hangings and outer wall.
  // Triangles keep the scene's fixed-light shading, so the repaint matches the scene.
  const OCCLUDE={
    standOpen:{parts:{drapes:'all',structure:'bands'}},
    standCovered:{parts:{drapes:'all',structure:'bands'}},
    arenaU:{parts:{walls:'all',drapes:'all'}}
  };
  const BAND=.4;
  // Halve a triangle across its longest edge until no edge is longer than max (U).
  function split(tri,max=.7,out=[]){
    const P=k=>[tri[k*3],tri[k*3+1],tri[k*3+2]],d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
    const v=[P(0),P(1),P(2)],e=[d(v[0],v[1]),d(v[1],v[2]),d(v[2],v[0])],i=e.indexOf(Math.max(...e));
    if(e[i]<=max||out.length>64){out.push(tri);return out}
    const a=v[i],b=v[(i+1)%3],c=v[(i+2)%3],m=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
    split([...a,...m,...c],max,out);split([...m,...b,...c],max,out);
    return out;
  }
  const occCache=new Map();
  function occluders(s){
    const g=groundOf(s),items=E().placedItems(s);
    const key=JSON.stringify(items.map(i=>[i.m,i.x,i.y,i.a]))+'|'+g+'|'+(s.angle||0)+'|'+s.x+'|'+s.y;
    const hit=occCache.get(s);if(hit&&hit.key===key)return hit.list;
    const list=[];
    items.forEach(it=>{
      const spec=OCCLUDE[it.m];if(!spec)return;
      const parts=E().parts(it.m).filter(p=>!p.cloth),p=E().toWorld(s,it.x,it.y);
      const mesh=E().triangles(it.m,{x:p.x,y:p.y,angle:(s.angle||0)+(it.a||0),scale:it.s||1},g,null,{only:'fixed'});
      if(!mesh)return;
      // Bands of the structure in model space: within 0.12 U of its front and back edges.
      let y0=Infinity,y1=-Infinity;
      for(const q of parts)if(q.name==='structure')for(let i=1;i<q.v.length;i+=3){y0=Math.min(y0,q.v[i]);y1=Math.max(y1,q.v[i])}
      // In the isometric view a part lower than the lowest seat can never cover a seated
      // figure (it projects below it): only what rises to seat height is kept.
      const seats=M()[it.m]?.meta?.seats||[],zMin=(seats.length?Math.min(...seats.map(q=>q[2])):0)-.12;
      // A band piece sorts at its edge pushed BAND outward (away from the seats), so the
      // front-row figure it covers stays behind it even when the piece sits a little to
      // one side (and a back-row figure stays in front of the backrest).
      const ang=(s.angle||0)+(it.a||0),ky=it.s||1,ax=-Math.sin(ang)*ky,ay=Math.cos(ang)*ky;
      let t=0;
      for(const q of parts){
        const mode=spec.parts[q.name];
        for(let k=0;k<q.c.length;k++,t++){
          if(!mode)continue;
          if(Math.max(q.v[k*9+2],q.v[k*9+5],q.v[k*9+8])<zMin)continue;
          if(mode==='bands'){
            const ys=[q.v[k*9+1],q.v[k*9+4],q.v[k*9+7]];
            if(!(Math.max(...ys)<y0+.12||Math.min(...ys)>y1-.12))continue;
          }
          const o=t*9,P=mesh.pos,col=window.ConquerMesh3D?.shadedHex?.(mesh,t)||mesh.col[t];
          const ly=(q.v[k*9+1]+q.v[k*9+4]+q.v[k*9+7])/3,edge=isFinite(y0)?(ly<(y0+y1)/2?y0-BAND:y1+BAND):ly,dy=edge-ly;
          // A long plank sorts badly by one centroid: split it so each piece sorts on its own.
          for(const tri of split([P[o],P[o+1],P[o+2],P[o+3],P[o+4],P[o+5],P[o+6],P[o+7],P[o+8]],.35))
            list.push({tri,col,p:{x:(tri[0]+tri[3]+tri[6])/3+ax*dy,y:(tri[1]+tri[4]+tri[7])/3+ay*dy}});
        }
      }
    });
    occCache.set(s,{key,list});
    return list;
  }
  // Painter items for the occluders of a venue, to sort with its figures.
  function occluderItems(s){
    return occluders(s).map(o=>({p:o.p,occluder:o}));
  }
  // Paint a depth-sorted list of figures and occluder triangles. The triangles between
  // two figures are batched into one path per colour: switching between clipped figure
  // drawing and thousands of single fills is what costs, not the fills themselves.
  function paintList(list){
    let run=new Map();
    const flush=()=>{
      if(!run.size)return;
      ctx.save();ctx.lineWidth=.6;ctx.lineJoin='round';
      for(const [col,path] of run){ctx.fillStyle=ctx.strokeStyle=col;ctx.fill(path);ctx.stroke(path)}
      ctx.restore();run=new Map();
    };
    for(const it of list){
      if(!it.occluder){flush();it.draw();continue}
      const o=it.occluder,T=o.tri,a=w2sRaw({x:T[0],y:T[1]},T[2]),b=w2sRaw({x:T[3],y:T[4]},T[5]),c=w2sRaw({x:T[6],y:T[7]},T[8]);
      let path=run.get(o.col);if(!path){path=new Path2D();run.set(o.col,path)}
      path.moveTo(a.x,a.y);path.lineTo(b.x,b.y);path.lineTo(c.x,c.y);path.closePath();
    }
    flush();
  }

  // ---------- drawing helpers (shared with the joust)
  let clock=0,last=0;
  function tick(){
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    const dt=last?Math.min(.25,(now-last)/1000):0;last=now;
    if(typeof State!=='undefined'&&State.clock?.speed>0)clock+=dt;
    return clock;
  }
  const TUNICS=[['#8a5a3b','#5f4b3a'],['#6f7f4a','#4e5a35'],['#9b8a63','#6d5f44'],['#5d6f86','#3f4b5d'],
    ['#8e4d4d','#5e3434'],['#a58b5b','#6f5c3c'],['#6b5a7d','#483c57'],['#c2b49a','#8a7d66']];
  const PLAYERS=[['#c9452f','#d9b13b'],['#3f7d3a','#d9b13b'],['#2f56a6','#ece6d6'],['#7c2a33','#d9b13b']];
  const KINDS=['peasant','artisan','merchant','peasant'];
  function figureAt(p,z,id,kind,colors,hop){
    const base=w2s(p,z+(hop||0)),scale=State.view.scale*.5;
    const bodyW=6.0*scale,bodyH=8.0*scale,headR=2.35*scale,bodyY=base.y-bodyH*.16;
    drawSplitVillagerBody(kind,base.x,bodyY,bodyW,bodyH,colors[0],colors[1]);
    const sex=hash(id+'sex')&1?'female':'male';
    drawVillagerHead(id,base.x,bodyY-bodyH/2-headR*.68,headR,sex,villagerHair(id));
    return{base,bodyY,bodyH,scale,headY:bodyY-bodyH/2-headR*.68,headR};
  }
  function armsUp(f,amount){
    if(!(amount>.15))return;
    ctx.save();ctx.strokeStyle=VILLAGER_SKIN;ctx.lineWidth=Math.max(.8,f.scale*1.1);
    const top=f.bodyY-f.bodyH*.35,reach=f.bodyH*(.55+.35*amount);
    ctx.beginPath();ctx.moveTo(f.base.x-f.bodyH*.25,top);ctx.lineTo(f.base.x-f.bodyH*.42,top-reach);
    ctx.moveTo(f.base.x+f.bodyH*.25,top);ctx.lineTo(f.base.x+f.bodyH*.42,top-reach);ctx.stroke();ctx.restore();
  }
  function juggle(f,t){
    const cols=['#c9452f','#d9b13b','#2f56a6'];
    ctx.save();
    for(let i=0;i<3;i++){
      const k=((t*1.4+i/3)%1),x=f.base.x+(k<.5?-1:1)*f.bodyH*.35*Math.cos(k*Math.PI*2),y=f.headY-f.bodyH*(.3+.9*Math.sin(Math.PI*((k*2)%1)));
      ctx.fillStyle=cols[i];ctx.beginPath();ctx.arc(x,y,Math.max(1,f.scale*.9),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  const screenFacing=(p,h)=>{const a=w2s(p,0),b=w2s({x:p.x+h.x,y:p.y+h.y},0);return Math.abs(b.x-a.x)>.001?(b.x>a.x?1:-1):1};
  function horse(p,mode,heading,seed,t){
    const sc=w2s(p,.07),size=Math.max(1.5,State.view.scale*5.75);
    window.ConquerAnimals?.drawAnimal?.('horse',ctx,sc.x,sc.y,size,{t:t*34*.12,seed,facing:screenFacing(p,heading),mode,blend:mode==='browse'?.86:0});
  }
  const groundOf=s=>Number.isFinite(s.groundZ)?s.groundZ:(typeof terrainElevation==='function'?terrainElevation(s):0);
  // Draw a list of actors {id, x, y, z, action, hop, arms, juggle, fade} of a venue.
  function drawActors(s,actors,t){
    const g=groundOf(s),stride=State.view.scale<.3?3:State.view.scale<.5?2:1,list=[];
    for(const a of actors){
      if(stride>1&&a.action!=='perform'&&hash(a.id)%stride)continue;
      const p=E().toWorld(s,a.x,a.y),z=g+(a.z||0)-(a.action==='sit'?.12:0)+(a.z?0:.1);
      if(!worldPointVisible(p,z,30))continue;
      const perf=a.action==='perform'||a.action==='announce';
      const c=perf?PLAYERS[hash(a.id)%PLAYERS.length]:TUNICS[hash(a.id)%TUNICS.length],kind=KINDS[hash(a.id+'k')%KINDS.length];
      const walk=a.action==='walk'?.015*Math.abs(Math.sin(t*6+hash(a.id)%7)):0;
      if(a.fighter){
        // A combatant: the soldier figure with shield and sword, in a pair of primaries.
        const P=E().PAIRS,[m1,m2]=P[hash(seedOf(s)+'|'+a.id)%P.length];
        list.push({p,draw:()=>drawSoldierFigureUnmasked(p,g+.1,'swordsman',a.id,a.swing,{main:m1,alt:m2,mainDark:m1,altDark:m2})});
        continue;
      }
      list.push({p,draw:()=>{
        ctx.save();if(a.fade!==undefined&&a.fade<1)ctx.globalAlpha*=Math.max(0,a.fade);
        const f=figureAt(p,z,a.id,kind,c,(a.hop||0)+walk);armsUp(f,a.arms||0);if(a.juggle)juggle(f,t);
        if(a.carry==='lance'){
          ctx.strokeStyle='#5a3d22';ctx.lineWidth=Math.max(1,f.scale*1.1);
          ctx.beginPath();ctx.moveTo(f.base.x-f.bodyH*.35,f.bodyY+f.bodyH*.3);ctx.lineTo(f.base.x+f.bodyH*.9,f.bodyY-f.bodyH*2.2);ctx.stroke();
        }
        ctx.restore();
      }});
    }
    return list;
  }
  function draw(){
    if(!E()||typeof State==='undefined')return;
    const t=tick();
    E().tickEvents?.();                            // festival grounds: setting up / clearing on the game clock
    for(const s of State.structures||[]){
      if(!E().is(s)||(typeof underConstruction==='function'&&underConstruction(s)))continue;
      let sc=null;
      if(s.venue==='festivalGround'){
        if(s.event?.phase!=='active')continue;
        const setup=setupOf(s);
        sc=setup==='feast'?feastScene(s,t):setup==='circus'?circusScene(s,t):setup==='joust'?null:venueScene(s,t);   // tourney, camp, theatre
      }else sc=venueScene(s,t);                       // arena lot, stage, podium: always lived in
      if(!sc)continue;
      const list=drawActors(s,sc.actors,t).concat(occluderItems(s));
      for(const it of list)it.d=viewDepthPoint(it.p);   // once per item, not per comparison
      list.sort((a,b)=>a.d-b.d);
      paintList(list);
    }
  }
  window.ConquerEventPeople={slots,occupants,setOccupancySource,provisional,feastScene,circusScene,venueScene,DUEL,draw,occluders,occluderItems,paintList,
    helpers:{hash,figureAt,armsUp,horse,screenFacing,TUNICS,KINDS,groundOf,tick:()=>tick(),clock:()=>clock}};
})();
