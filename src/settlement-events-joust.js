'use strict';
// Life on an active joust ground (settlement-events3d.js, setup 'joust'): townsfolk
// on the stands cheering the passes, two knights charging down either side of the
// tilt — at every pass one of them is unhorsed, lies in the sand, gets up and walks
// back to his horse — and squires and grooms at the ends of the lists and among the
// tents getting the next bout ready. 2D figures drawn with the villagers (both
// renderers), on a real-time clock that runs only while the game runs.
//
// scene(venue, t) is pure (local U, seconds) and drives both draw() and the QA.
(function(){
  const E=()=>window.ConquerEvents3D;
  // One bout: wait at the ends, charge, pass mid-lists at IMPACT, arrive, rest.
  const BOUT=10,START=1.2,ARRIVE=4.2,IMPACT=(START+ARRIVE)/2,END=5.6,LANE=.46;
  const FALL=.9,GET_UP=6.4,UP_DONE=7.0,BACK=9.6;
  const SEAT=.38;                                 // rider's seat above the ground (U)
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  const smooth=k=>{k=Math.max(0,Math.min(1,k));return k*k*(3-2*k)};
  const lerp=(a,b,k)=>a+(b-a)*k;
  const seedOf=s=>((typeof State!=='undefined'&&State.seed)||1)+'|'+(s.id??(s.x+','+s.y));

  // A rider's place along his lane: u 0 at his start end, 1 at the far end.
  function ride(t){
    if(t<START)return{u:0,mode:'browse',speed:0};
    if(t<ARRIVE)return{u:(t-START)/(ARRIVE-START),mode:'run',speed:1};
    const k=Math.min(1,(t-ARRIVE)/1.2);           // pulls up after the pass
    return{u:1,mode:k<1?'walk':'browse',speed:0};
  }
  // The two knights of bout n: A rides the -y lane, B the +y lane, towards each other;
  // bouts alternate ends. Exactly one of them is unhorsed at the pass.
  function knights(s,n,t){
    const dir=n%2?-1:1,loser=hash(seedOf(s)+'|bout|'+n)%2?'A':'B',r=ride(t),out=[];
    for(const [who,side] of [['A',-1],['B',1]]){
      const d=who==='A'?dir:-dir,x0=-d*END,x=lerp(x0,d*END,r.u),y=side*LANE;
      const k={who,lane:side,dir:d,horse:{x,y,mode:r.mode,heading:d},rider:null,lance:null};
      const unhorsed=who===loser&&t>=IMPACT;
      if(!unhorsed){
        const raised=t>IMPACT+.4&&t<ARRIVE+2.5;  // the winner salutes the stands
        k.rider={x,y,z:SEAT,rot:0};
        k.lance={tip:{x:x+d*(raised?.35:1.15),y:y-side*(raised?0:.32),z:raised?SEAT+1.05:SEAT+.12},from:{x,y,z:SEAT+.12}};
      }else{
        // Thrown backwards over the croup and sideways off the lane, away from the tilt.
        const fx=d*.15,fy=y+side*.75;
        let p,z,rot;
        if(t<IMPACT+FALL){
          const k2=(t-IMPACT)/FALL;
          p={x:lerp(0,fx,k2),y:lerp(y,fy,k2)};z=SEAT*(1-k2)+.32*Math.sin(Math.PI*k2);rot=-d*Math.PI/2*smooth(k2*1.2);
        }else if(t<GET_UP){p={x:fx,y:fy};z=0;rot=-d*Math.PI/2}
        else if(t<UP_DONE){p={x:fx,y:fy};z=0;rot=-d*Math.PI/2*(1-smooth((t-GET_UP)/(UP_DONE-GET_UP)))}
        else{
          // Walks back to his horse, waiting at the far end, before the next bout.
          const k3=smooth((t-UP_DONE)/(BACK-UP_DONE));
          p={x:lerp(fx,d*END,k3),y:lerp(fy,y,k3)};z=0;rot=0;
        }
        k.fallen={x:p.x,y:p.y,z,rot,walking:t>=UP_DONE&&t<BACK};
        if(t>=BACK){k.fallen=null;k.rider={x:d*END,y,z:SEAT,rot:0}}   // mounted again
        k.loser=true;
      }
      out.push(k);
    }
    return out;
  }
  // Squires and grooms: spare horses held at both ends, squires shuttling lances
  // between the tents and the ends of the lists.
  const GROOMS=[[-6.6,0,1],[6.6,0,-1]];
  const PATHS=[[[-5.6,2.4],[-6.0,.9]],[[5.65,2.45],[6.0,.9]],[[-5.65,-2.45],[-6.0,-.9]],[[5.6,-2.4],[6.0,-.9]]];
  function squires(s,clock){
    const out=[];
    GROOMS.forEach(([x,y,f],i)=>{
      out.push({kind:'horse',p:{x,y},mode:'browse',heading:f,id:'groom-horse'+i});
      out.push({kind:'groom',p:{x,y:y+.32},id:'groom'+i,carry:null,facing:-f});
    });
    PATHS.forEach(([a,b],i)=>{
      // Ping-pong at a walking pace with a pause at each end; lances go to the lists.
      const L=Math.hypot(b[0]-a[0],b[1]-a[1]),walk=L/.45,period=2*walk+3,ph=(clock+i*2.3)%period;
      let k,carry;
      if(ph<walk){k=ph/walk;carry='lance'}else if(ph<walk+1.5){k=1;carry=null}
      else if(ph<2*walk+1.5){k=1-(ph-walk-1.5)/walk;carry=i%2?'shield':null}else{k=0;carry='lance'}
      const going=ph<walk;
      out.push({kind:'squire',p:{x:lerp(a[0],b[0],k),y:lerp(a[1],b[1],k)},id:'squire'+i,carry,
        heading:going?{x:b[0]-a[0],y:b[1]-a[1]}:{x:a[0]-b[0],y:a[1]-b[1]},walking:(ph<walk)||(ph>=walk+1.5&&ph<2*walk+1.5)});
    });
    return out;
  }
  // Seats of the stands in the venue's local frame (U), from the stand models' meta.
  const seatCache=new Map();
  function seats(s){
    const items=E().placedItems(s),key=JSON.stringify(items.map(i=>[i.m,i.x,i.y,i.a]));
    const hit=seatCache.get(s);if(hit&&hit.key===key)return hit.list;
    const list=[],M=window.ConquerEventModels?.models||{};
    items.forEach((it,k)=>{
      const meta=M[it.m]?.meta;if(!meta?.seats)return;
      const c=Math.cos(it.a||0),sn=Math.sin(it.a||0),sc=it.s||1;
      const facing=meta.facing?{x:meta.facing[0]*c-meta.facing[1]*sn,y:meta.facing[0]*sn+meta.facing[1]*c}:null;
      meta.seats.forEach((q,j)=>{
        // About two seats in three are taken, the same ones every time.
        if(hash(seedOf(s)+'|seat|'+k+'|'+j)%3===0)return;
        list.push({x:it.x+(q[0]*c-q[1]*sn)*sc,y:it.y+(q[0]*sn+q[1]*c)*sc,z:q[2]*sc,id:'spec-'+k+'-'+j,facing});
      });
    });
    seatCache.set(s,{key,list});
    return list;
  }
  const isJoust=s=>E()?.is(s)&&s.venue==='festivalGround'&&s.event?.setup==='joust'&&s.event.phase==='active';
  // Everything on the ground at time t (seconds): pure, local U.
  function scene(s,t){
    const n=Math.floor(t/BOUT),bt=t-n*BOUT;
    // Cheering peaks at the clash and when the loser hits the sand.
    const cheer=Math.max(Math.exp(-((bt-IMPACT)**2)/.25),.7*Math.exp(-((bt-IMPACT-FALL)**2)/.5));
    return{bout:n,t:bt,cheer,knights:knights(s,n,bt),squires:squires(s,t),spectators:seats(s)};
  }

  // ---------- drawing (2D figures on the population pass)
  let clock=0,last=0;
  function tick(){
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    const dt=last?Math.min(.25,(now-last)/1000):0;last=now;
    if(State.clock?.speed>0)clock+=dt;
    return clock;
  }
  const TUNICS=[['#8a5a3b','#5f4b3a'],['#6f7f4a','#4e5a35'],['#9b8a63','#6d5f44'],['#5d6f86','#3f4b5d'],
    ['#8e4d4d','#5e3434'],['#a58b5b','#6f5c3c'],['#6b5a7d','#483c57'],['#c2b49a','#8a7d66']];
  const KINDS=['peasant','artisan','merchant','peasant'];
  function figureAt(p,z,id,kind,colors,hop){
    const base=w2s(p,z+hop),scale=State.view.scale*.5;
    const bodyW=6.0*scale,bodyH=8.0*scale,headR=2.35*scale,bodyY=base.y-bodyH*.16;
    drawSplitVillagerBody(kind,base.x,bodyY,bodyW,bodyH,colors[0],colors[1]);
    const sex=hash(id+'sex')&1?'female':'male';
    drawVillagerHead(id,base.x,bodyY-bodyH/2-headR*.68,headR,sex,villagerHair(id));
    return{base,bodyY,bodyH,scale};
  }
  function armsUp(f,amount){
    if(amount<.15)return;
    ctx.save();ctx.strokeStyle=VILLAGER_SKIN;ctx.lineWidth=Math.max(.8,f.scale*1.1);
    const top=f.bodyY-f.bodyH*.35,reach=f.bodyH*(.55+.35*amount);
    ctx.beginPath();ctx.moveTo(f.base.x-f.bodyH*.25,top);ctx.lineTo(f.base.x-f.bodyH*.42,top-reach);
    ctx.moveTo(f.base.x+f.bodyH*.25,top);ctx.lineTo(f.base.x+f.bodyH*.42,top-reach);ctx.stroke();ctx.restore();
  }
  function lanceLine(a,b,width){
    const p=w2s(a,a.z),q=w2s(b,b.z);
    ctx.save();ctx.lineCap='round';
    ctx.strokeStyle='#5a3d22';ctx.lineWidth=Math.max(1.2,width*1.25);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    ctx.strokeStyle='#d9c27a';ctx.lineWidth=Math.max(.6,width*.55);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    ctx.restore();
  }
  function screenFacing(p,h){
    const a=w2s(p,0),b=w2s({x:p.x+h.x,y:p.y+h.y},0);
    return Math.abs(b.x-a.x)>.001?(b.x>a.x?1:-1):1;
  }
  function horse(p,mode,heading,seed,t){
    const sc=w2s(p,.07),size=Math.max(1.5,State.view.scale*5.75);
    window.ConquerAnimals?.drawAnimal?.('horse',ctx,sc.x,sc.y,size,{t:t*34*.12,seed,facing:screenFacing(p,heading),mode,blend:mode==='browse'?.86:0});
  }
  function drawVenue(s,t){
    const sc=scene(s,t),W=(x,y)=>E().toWorld(s,x,y),dirW=(dx,dy)=>{const a=s.angle||0;return{x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)}};
    const g=Number.isFinite(s.groundZ)?s.groundZ:(typeof terrainElevation==='function'?terrainElevation(s):0);
    const list=[];
    const stride=State.view.scale<.3?3:State.view.scale<.5?2:1;
    // Spectators: seated, swaying; on the clash they jump up with their arms raised.
    for(const q of sc.spectators){
      if(stride>1&&hash(q.id)%stride)continue;
      const p=W(q.x,q.y);if(!worldPointVisible(p,q.z+g,30))continue;
      const ph=hash(q.id)%628/100,c=TUNICS[hash(q.id)%TUNICS.length],kind=KINDS[hash(q.id+'k')%KINDS.length];
      const excite=sc.cheer*(.6+.4*((hash(q.id+'e')%100)/100));
      const hop=.012*Math.sin(clock*1.6+ph)+excite*.07*Math.abs(Math.sin(clock*11+ph));
      list.push({p,draw:()=>{const f=figureAt(p,q.z+g-.12,q.id,kind,c,hop);armsUp(f,excite)}});
    }
    // Knights, riderless horses, unhorsed knights.
    sc.knights.forEach((k,i)=>{
      const seed=(hash(seedOf(s)+k.who)%900)+50,livery=liveryOf(s,k.who);
      const hp=W(k.horse.x,k.horse.y),head=dirW(k.horse.heading,0),id='knight-'+k.who;
      list.push({p:hp,draw:()=>{
        horse(hp,k.horse.mode,head,seed,clock);
        if(k.rider){
          const rp=W(k.rider.x,k.rider.y);
          drawSoldierFigureUnmasked(rp,g+k.rider.z,'unarmed',id,0,livery);
          const f=w2s(rp,g+k.rider.z),sc=State.view.scale*.5;   // kite shield on the shield arm
          drawQuarteredShield(f.x-2.6*sc*screenFacing(rp,head),f.y-4.2*sc,2.7*sc,3.6*sc,livery,'#b7aa8f',sc,false);
          if(k.lance){const a=W(k.lance.from.x,k.lance.from.y),b=W(k.lance.tip.x,k.lance.tip.y);
            lanceLine({...a,z:g+k.lance.from.z},{...b,z:g+k.lance.tip.z},State.view.scale)}
        }
      }});
      if(k.fallen){
        const fp=W(k.fallen.x,k.fallen.y);
        list.push({p:fp,draw:()=>{
          const foot=w2s(fp,g+k.fallen.z);
          ctx.save();ctx.translate(foot.x,foot.y);ctx.rotate(k.fallen.rot*screenFacing(fp,dirW(1,0)));ctx.translate(-foot.x,-foot.y);
          drawSoldierFigureUnmasked(fp,g+k.fallen.z,'unarmed',id,0,livery);
          ctx.restore();
        }});
      }
    });
    // Squires and grooms getting the next bout ready.
    for(const q of sc.squires){
      const p=W(q.p.x,q.p.y);
      if(q.kind==='horse'){const h=dirW(q.heading,0);list.push({p,draw:()=>horse(p,q.mode,h,hash(q.id)%900,clock)});continue}
      const c=TUNICS[hash(q.id)%TUNICS.length],bob=q.walking?.015*Math.abs(Math.sin(clock*6+hash(q.id)%7)):0;
      list.push({p,draw:()=>withUrbanFigureOcclusion(p,.1,()=>{
        const f=figureAt(p,g+.1,q.id,'peasant',c,bob);
        if(q.carry==='lance'){
          ctx.save();ctx.strokeStyle='#5a3d22';ctx.lineWidth=Math.max(1,f.scale*1.1);
          ctx.beginPath();ctx.moveTo(f.base.x-f.bodyH*.35,f.bodyY+f.bodyH*.3);ctx.lineTo(f.base.x+f.bodyH*.9,f.bodyY-f.bodyH*2.2);ctx.stroke();ctx.restore();
        }else if(q.carry==='shield'){
          drawQuarteredShield(f.base.x+f.bodyH*.42,f.bodyY,f.bodyH*.32,f.bodyH*.42,liveryOf(s,hash(q.id)&1?'A':'B'),'#b7aa8f',f.scale,false);
        }
      })});
    }
    list.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
    for(const it of list)it.draw();
  }
  // The two knights' colours: a pair of primaries each, never the same pair.
  function liveryOf(s,who){
    const P=E().PAIRS,i=hash(seedOf(s)+'|knights')%P.length,j=who==='A'?i:(i+7)%P.length,[a,b]=P[j];
    return{main:a,alt:b,mainDark:a,altDark:b};
  }
  function draw(){
    if(!E()||typeof State==='undefined')return;
    const venues=(State.structures||[]).filter(isJoust);
    const t=tick();
    if(!venues.length)return;
    for(const s of venues)drawVenue(s,t);
  }
  window.ConquerJoust={scene,draw,isJoust,liveryOf,BOUT,IMPACT,END,LANE,SEAT,clock:()=>clock};
})();
