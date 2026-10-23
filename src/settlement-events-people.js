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
    if(meta.speaker)out.push({x:meta.speaker[0],y:meta.speaker[1],z:meta.speaker[2],role:'worker',action:'announce',face});
    if(ref==='stagePlayers'||ref==='stageHerald'){
      // An audience standing in an arc in front of the stage.
      for(let i=0;i<7;i++){const a=Math.PI*(.18+.64*i/6);out.push({x:Math.cos(a)*.95,y:-.75-Math.sin(a)*.42,z:0,role:'guest',action:'watch',face:{x:-Math.cos(a)*.3,y:1}})}
    }else if(ref==='podiumStreet'){
      for(let i=0;i<5;i++){const a=-Math.PI*(.15+.7*i/4);out.push({x:Math.cos(a)*.62,y:Math.sin(a)*.62,z:0,role:'guest',action:'watch',face:{x:-Math.cos(a),y:-Math.sin(a)}})}
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
    items.forEach((it,k)=>{
      const c=Math.cos(it.a||0),sn=Math.sin(it.a||0),sc=it.s||1;
      for(const q of localSlots(it.m)){
        const n=(count.get(k+q.action)||0);count.set(k+q.action,n+1);
        list.push({id:venueId(s)+':'+k+':'+q.action+':'+n,domain:venueId(s),item:k,model:it.m,role:q.role,action:q.action,
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
  const FILL={sit:.66,stand:.6,watch:.75,browse:.5,queue:.85};
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
      list.push({p,draw:()=>{
        ctx.save();if(a.fade!==undefined&&a.fade<1)ctx.globalAlpha*=Math.max(0,a.fade);
        const f=figureAt(p,z,a.id,kind,c,(a.hop||0)+walk);armsUp(f,a.arms||0);if(a.juggle)juggle(f,t);
        ctx.restore();
      }});
    }
    return list;
  }
  function draw(){
    if(!E()||typeof State==='undefined')return;
    const t=tick();
    for(const s of State.structures||[]){
      if(!E().is(s)||s.venue!=='festivalGround'||s.event?.phase!=='active')continue;
      const setup=setupOf(s),sc=setup==='feast'?feastScene(s,t):setup==='circus'?circusScene(s,t):null;
      if(!sc)continue;
      const list=drawActors(s,sc.actors,t);
      list.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
      for(const it of list)it.draw();
    }
  }
  window.ConquerEventPeople={slots,occupants,setOccupancySource,provisional,feastScene,circusScene,draw,
    helpers:{hash,figureAt,armsUp,horse,screenFacing,TUNICS,KINDS,groundOf,tick:()=>tick(),clock:()=>clock}};
})();
