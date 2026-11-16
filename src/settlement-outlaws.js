'use strict';
// CONQUER — outlaws. Three kinds of band, all ordinary enemy entities of the
// tactical simulation (faction 'outlaw'): this module owns only their spawning,
// their AI and their effects on the economy. Melee, arrows, deaths and the
// alarm are the combat module's, exactly as for any intruder.
//
//  · BRIGANTI  — hold one of the roads to the border and rob merchants and
//                caravans: trade drops while the road is held.
//  · BANDITI   — a permanent lair of tents in a wood, with standing guards.
//                It extorts a weekly toll; destroying it recovers the stash.
//  · PREDONI   — raid the territory to plunder outlying buildings, never to
//                take the castle; they flee with the loot.
(function(){
  const TYPES=Object.freeze({
    brigands:{label:'Briganti',size:[4,6],aggro:6,leash:9},
    bandits:{label:'Banditi',size:[4,6],aggro:9,leash:14},
    raiders:{label:'Predoni',size:[5,8],aggro:5,leash:7}
  });
  // Days after the first founded tick before each kind may first appear,
  // and the pause after a band ends. Provisional values (to be balanced).
  const FIRST={bandits:[8,16],brigands:[14,24],raiders:[20,30]};
  const AGAIN={bandits:[30,50],brigands:[12,24],raiders:[16,28]};
  const TRADE_LOSS=.4,TRADE_FLOOR=.3;          // per road held, and minimum
  const LAIR_TOLL_SHARE=.05,LAIR_TOLL_CAP=15;   // weekly extortion
  const RAID_TARGETS=2,RAID_PLUNDER_S=4,RAID_TAKE_PER_MAN=6,RAID_ROUT=.5;
  const LOOT_GOODS=['food','wood','stone','metal','clay'];
  const PLAN_BUDGET=2,MELEE=.8;
  const C=()=>window.ConquerCombat;
  const E=()=>window.ConquerEconomy;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  // Deterministic 0..1 from a key. FNV-1a with a final avalanche: keys that
  // differ only in their last digit (attempt counters) must scatter widely.
  const hash=s=>{
    let h=2166136261;
    for(const ch of 'outlaw:'+s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
    h^=h>>>15;h=Math.imul(h,2246822507);h^=h>>>13;h=Math.imul(h,3266489909);h^=h>>>16;
    return(h>>>0)/4294967296;
  };
  const between=([a,b],r)=>a+Math.floor(r*(b-a+1));
  const alive=e=>e&&!e.defeated&&!(e.stats&&e.stats.hp<=0);
  const live=u=>alive(u)&&!u.routing&&u.campState!=='barracks'&&u.campState!=='camped';
  const free=p=>p.x>2&&p.y>2&&p.x<WORLD-2&&p.y<WORLD-2&&
    !pointBlockedForPeasant(p,'outlaw')&&!terrainSegmentCrossesCliff(p,p);
  const well=()=>State.village?.founded&&State.structures.find(s=>s.id===State.village.wellId&&s.type==='well');
  const today=()=>Number(State.clock?.day)||0;
  let enabled=true,planned=0,lastUi='';

  function state(){return C()?.outlawState?.()||null}
  const bands=()=>state()?.bands||[];
  const members=band=>(C()?.enemy()||[]).filter(e=>e.outlawBand===band.id);
  const liveMembers=band=>members(band).filter(alive);

  // ---- places -----------------------------------------------------------
  function inForest(p){
    return(State.environment||[]).some(f=>f.type==='forest'&&environmentContains(f,p));
  }
  function landEdges(){
    const sea=State.environment?.find(f=>f.type==='sea')?.side;
    return['north','east','south','west'].filter(e=>e!==sea);
  }
  function borderPoint(edge,w){
    const entry=(State.village?.borderEntries||[]).find(e=>e.edge===edge);
    let p=entry?{x:entry.x,y:entry.y}:
      edge==='north'?{x:w.x,y:3}:edge==='south'?{x:w.x,y:WORLD-3}:edge==='west'?{x:3,y:w.y}:{x:WORLD-3,y:w.y};
    // Step in from the very edge until the ground is walkable.
    for(let i=0;i<30&&!free(p);i++)p={x:p.x+(w.x-p.x)*.04,y:p.y+(w.y-p.y)*.04};
    return free(p)?p:null;
  }
  // Brigands sit on the road of one border route, well away from the village.
  function roadblock(edge,w){
    const route=(State.village?.roadPlan||[]).find(r=>r.edge===edge);
    const roads=State.structures.filter(s=>s.type==='road'&&s.a&&s.b&&route&&s.routeId===route.id);
    let best=null,score=-Infinity;
    for(const r of roads)for(let k=0;k<=8;k++){
      const t=k/8,p={x:r.a.x+(r.b.x-r.a.x)*t,y:r.a.y+(r.b.y-r.a.y)*t},d=dist(p,w);
      // Far enough to be outside the walls, not so far it is off the map.
      const s=d<25?-1e3:-Math.abs(d-48);
      if(s>score&&free(p)&&!C().areaState(p).yellow){score=s;best={...p,heading:Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)}}
    }
    if(best)return best;
    const b=borderPoint(edge,w);
    return b?{x:b.x+(w.x-b.x)*.18,y:b.y+(w.y-b.y)*.18,heading:Math.atan2(w.y-b.y,w.x-b.x)}:null;
  }
  function lairSite(w,seed){
    let fallback=null;
    for(let i=0;i<200;i++){
      const a=hash(seed+':a:'+i)*Math.PI*2,r=32+hash(seed+':r:'+i)*30;
      const p={x:w.x+Math.cos(a)*r,y:w.y+Math.sin(a)*r};
      if(!free(p)||C().areaState(p).yellow)continue;
      // Room for the tents round the fire.
      if(![0,1,2,3].every(k=>free({x:p.x+Math.cos(k*Math.PI/2)*2.6,y:p.y+Math.sin(k*Math.PI/2)*2.6})))continue;
      if(inForest(p))return p;
      fallback??=p;
    }
    return fallback;
  }
  function ringAround(c,n,radius,seed){
    const out=[];
    for(let i=0;i<n;i++){
      for(let k=0;k<14;k++){
        const a=i*Math.PI*2/n+k*.41+hash(seed+':'+i)*.5,r=radius+(k%4)*.35;
        const p={x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r};
        if(free(p)&&!out.some(q=>dist(q,p)<.6)){out.push(p);break}
      }
    }
    return out;
  }
  // Outlying buildings: completed, not fortifications or infrastructure,
  // the farthest from the well first (the castle is never a raid target).
  const NOT_TARGETS=new Set(['road','wall','palisade','bridge','moat','well','gate','tower','keep',
    'castle','dtower','bartizan','field','earthwork','ditch','slopeway']);
  function raidTargets(w,from,skip){
    const list=State.structures.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&!s.a&&
      !NOT_TARGETS.has(s.type)&&!skip.includes(s.id)&&
      (typeof underConstruction!=='function'||!underConstruction(s))&&dist(s,w)>14);
    list.sort((a,b)=>(dist(b,w)-dist(b,from)*.5)-(dist(a,w)-dist(a,from)*.5));
    return list.slice(0,6);
  }
  function approachPoint(s,from){
    const r=(typeof footprintRadius==='function'?footprintRadius(s):0)||1.4;
    const dx=from.x-s.x,dy=from.y-s.y,L=Math.hypot(dx,dy)||1;
    for(const extra of [.5,1,1.6,2.4]){
      const p={x:s.x+dx/L*(r+extra),y:s.y+dy/L*(r+extra)};
      if(free(p))return p;
    }
    return null;
  }

  // ---- spawning ---------------------------------------------------------
  function newBand(type,extra){
    const st=state(),id='outlaw-'+type+'-'+(st.nextBandId++);
    const band={id,type,startedDay:today(),...extra};
    st.bands.push(band);
    return band;
  }
  function man(band,role,p,i,post=null){
    return{id:band.id+'-'+i,kind:'outlaw',combatKind:role==='guard'?'outlawGuard':'outlaw',faction:'outlaw',
      outlawBand:band.id,outlawRole:role,x:p.x,y:p.y,post:post?{x:post.x,y:post.y}:null,defeated:false};
  }
  function spawn(type,{edge=null,quiet=false}={}){
    const w=well(),st=state();
    if(!w||!st||!TYPES[type])return null;
    if(st.bands.some(b=>b.type===type&&!b.over))return null;
    const seed=State.seed+':'+type+':'+st.nextBandId+':'+Math.floor(today());
    const n=between(TYPES[type].size,hash(seed+':n'));
    const edges=landEdges();
    if(type==='brigands'){
      // A border route with road actually built on it: one of them at random.
      const plan=State.village?.roadPlan||[];
      const withRoads=edges.filter(e=>plan.some(r=>r.edge===e&&
        State.structures.some(s=>s.type==='road'&&s.routeId===r.id)));
      const pick=edge||(withRoads.length?withRoads:edges)[Math.floor(hash(seed+':e')*(withRoads.length||edges.length))];
      const block=pick&&roadblock(pick,w);if(!block)return null;
      const post={x:block.x,y:block.y};
      const band=newBand(type,{edge:pick,post,heading:block.heading,robbed:0});
      // Men stand round the wagon across the road, not inside it.
      const spots=ringAround(post,n,1.9,seed);
      C().addEnemies(spots.map((p,i)=>man(band,'brigand',p,i,p)));
      if(!quiet)status('Briganti sulla strada '+edgeName(pick)+': i mercanti vengono derubati, gli scambi calano');
      return band;
    }
    if(type==='bandits'){
      const center=lairSite(w,seed);if(!center)return null;
      const tents=ringAround(center,3+(n>4?1:0),2.2,seed+':t').map((p,i)=>({x:p.x,y:p.y,a:Math.atan2(center.y-p.y,center.x-p.x),i}));
      const band=newBand(type,{center,tents,stash:0,lastTollWeek:Math.floor(today()/7)});
      const posts=ringAround(center,n,.95,seed+':g');
      C().addEnemies(posts.map((p,i)=>man(band,'guard',p,i,p)));
      if(!quiet)status('Un covo di banditi nel bosco: le guardie difendono le tende e taglieggiano il villaggio');
      return band;
    }
    const pick=edge||edges[Math.floor(hash(seed+':e')*edges.length)];
    const entry=borderPoint(pick,w);if(!entry)return null;
    // Nothing outlying to plunder yet (a newly founded village): no raid.
    if(!raidTargets(w,entry,[]).length)return null;
    const band=newBand('raiders',{edge:pick,entry,phase:'approach',targetId:null,visited:[],loot:{},
      lootTotal:0,plunderClock:0,startCount:n});
    const spots=ringAround(entry,n,1,seed);
    C().addEnemies(spots.map((p,i)=>man(band,'raider',p,i)));
    if(!quiet)status('Predoni dal confine '+edgeName(pick)+': puntano agli edifici isolati');
    return band;
  }
  const edgeName=e=>({north:'nord',south:'sud',east:'est',west:'ovest'})[e]||e;

  function schedule(){
    const st=state(),d=today();
    for(const type of Object.keys(TYPES)){
      if(Number.isFinite(st.schedule[type]))continue;
      st.schedule[type]=d+between(FIRST[type],hash(State.seed+':first:'+type));
    }
    for(const type of Object.keys(TYPES)){
      if(!enabled||d<st.schedule[type]||st.bands.some(b=>b.type===type&&!b.over))continue;
      const band=spawn(type);
      // While a band is out the next one waits for it to end (endBand);
      // no room (no roads, no forest...): try again in a few days.
      st.schedule[type]=d+(band?9999:3);
    }
  }
  function endBand(band,outcome){
    const st=state();
    band.over=true;band.outcome=outcome;band.endedDay=today();
    st.schedule[band.type]=today()+between(AGAIN[band.type],hash(band.id+':again'));
    // The living leave the map now; the dead lie where they fell for half a
    // day (fall animation, the scene of the fight), then are cleared.
    C().removeEnemies(e=>e.outlawBand===band.id&&alive(e));
  }
  function sweep(){
    const st=state(),gone=st.bands.filter(b=>b.over&&today()-b.endedDay>=.5);
    if(!gone.length)return;
    const ids=new Set(gone.map(b=>b.id));
    C().removeEnemies(e=>ids.has(e.outlawBand));
    st.bands=st.bands.filter(b=>!ids.has(b.id));
  }

  // ---- economy ----------------------------------------------------------
  // Each road held by brigands cuts trade with the outside.
  function tradeFactor(){
    const held=bands().filter(b=>b.type==='brigands'&&!b.over).length;
    return Math.max(TRADE_FLOOR,1-TRADE_LOSS*held);
  }
  function castle(){return E()?.state?.()||null}
  function takeGold(n){
    const e=castle();if(!e)return 0;
    const got=Math.max(0,Math.min(n,Number(e.castleGold)||0));
    e.castleGold=Math.round((Number(e.castleGold)-got)*100)/100;
    E()?.syncBuilderResources?.();State.dirty=true;
    return got;
  }
  function giveGold(n){
    const e=castle();if(!e||!(n>0))return;
    e.castleGold=Math.round(((Number(e.castleGold)||0)+n)*100)/100;
    E()?.syncBuilderResources?.();State.dirty=true;
  }
  function takeGoods(max){
    const e=castle(),taken={};if(!e)return taken;
    let left=max;
    for(const g of LOOT_GOODS){
      if(left<=0)break;
      const have=Math.max(0,Number(e.castle?.[g])||0),q=Math.min(have,Math.ceil(max/3),left);
      if(q<=0)continue;
      e.castle[g]=Math.round((have-q)*100)/100;taken[g]=q;left-=q;
    }
    E()?.syncBuilderResources?.();State.dirty=true;
    return taken;
  }
  function giveGoods(goods,share=1){
    const e=castle();if(!e)return;
    for(const [g,q] of Object.entries(goods||{}))
      e.castle[g]=Math.round(((Number(e.castle[g])||0)+q*share)*100)/100;
    E()?.syncBuilderResources?.();State.dirty=true;
  }

  // ---- AI ---------------------------------------------------------------
  function plan(e,goal){
    if(planned>=PLAN_BUDGET)return false;
    planned++;
    e.legs=C().groundLegs(e,goal);e.outlawReplan=1.4;
    return true;
  }
  function nearestFoe(p,r){
    let best=null,bd=r;
    for(const u of C().units()){if(!live(u))continue;const d=dist(u,p);if(d<bd){bd=d;best=u}}
    return best;
  }
  // Fight anyone who comes near: chase within the leash, else go back.
  // The replan cooldown is spent once per tick for every living man (cool).
  function cool(men,dt){for(const e of men)e.outlawReplan=(e.outlawReplan||0)-dt}
  function defend(e,anchor,type){
    const foe=nearestFoe(e,TYPES[type].aggro);
    if(foe&&dist(foe,anchor)<TYPES[type].leash){
      // In reach: stand and fight (the combat rules resolve the melee).
      if(dist(foe,e)<=MELEE){e.legs=null;return true}
      if(e.outlawReplan<=0||!e.legs?.length)plan(e,flank(foe,e));
      return true;
    }
    return false;
  }
  // Close in round the foe, each man on his own side, not onto one point.
  function flank(foe,e){
    const slot=(peasantHash(e.id)%7)/7*Math.PI*2;
    const base=Math.atan2(e.y-foe.y,e.x-foe.x),a=base+Math.sin(slot)*.9,r=MELEE*.8;
    const p={x:foe.x+Math.cos(a)*r,y:foe.y+Math.sin(a)*r};
    return free(p)?p:{x:foe.x,y:foe.y};
  }
  function holdPost(e,type){
    const post=e.post||e;
    if(defend(e,post,type))return;
    if(dist(e,post)>.4&&!e.legs?.length&&e.outlawReplan<=0)plan(e,post);
  }
  function raidStep(band,dt){
    const men=liveMembers(band),w=well();
    if(!men.length){endBand(band,'destroyed');giveGoods(band.loot);if(band.lootTotal)status('Predoni sterminati: il bottino torna al castello');return}
    cool(men,dt);
    // Losses break their nerve: they run for the border with what they have.
    if(band.phase!=='retreat'&&men.length<band.startCount*RAID_ROUT){band.phase='retreat';status('I predoni ripiegano verso il confine')}
    if(band.phase==='approach'){
      let target=State.structures.find(s=>s.id===band.targetId);
      if(!target){
        const lead=men[0];
        target=raidTargets(w,lead,band.visited)[0];
        if(!target){band.phase='retreat';return}
        band.targetId=target.id;band.goal=approachPoint(target,lead);band.targetClock=0;
        if(!band.goal){band.visited.push(target.id);band.targetId=null;return}
        for(const e of men)e.legs=null;
      }
      const goal=band.goal;
      let arrived=0;
      for(const e of men){
        if(defend(e,e,'raiders'))continue;
        if(dist(e,goal)<1.6){arrived++;continue}
        if(!e.legs?.length&&e.outlawReplan<=0)plan(e,goal);
      }
      // Unreachable (walled in, cut off by water): give that one up.
      band.targetClock=(band.targetClock||0)+dt;
      if(!arrived&&band.targetClock>150){band.visited.push(band.targetId);band.targetId=null;band.goal=null;return}
      if(arrived){
        band.plunderClock+=dt;
        if(band.plunderClock>=RAID_PLUNDER_S){
          const taken=takeGoods(RAID_TAKE_PER_MAN*men.length);
          let n=0;for(const [g,q] of Object.entries(taken)){band.loot[g]=(band.loot[g]||0)+q;n+=q}
          band.lootTotal+=n;band.plunderClock=0;band.visited.push(band.targetId);
          status('Predoni hanno saccheggiato '+(target.name||target.type)+(n?' · '+Math.round(n)+' merci rubate':''));
          band.targetId=null;band.goal=null;
          if(band.visited.length>=RAID_TARGETS)band.phase='retreat';
        }
      }
      return;
    }
    // Retreat: to the border point they came from; whoever gets there is gone.
    let escaped=0;
    band.retreatClock=(band.retreatClock||0)+dt;
    for(const e of men){
      if(dist(e,band.entry)<1.8){escaped++;e.outlawEscaped=true;continue}
      if(defend(e,e,'raiders'))continue;
      if(!e.legs?.length&&e.outlawReplan<=0)plan(e,band.entry);
    }
    // Stragglers with no way back slip off through the woods after a while.
    if(band.retreatClock>180)escaped=men.length;
    if(escaped&&escaped===men.length){
      // Those who fell on the way dropped their share.
      const share=1-escaped/Math.max(1,members(band).length);
      giveGoods(band.loot,share);
      endBand(band,'escaped');
      status('I predoni sono fuggiti oltre il confine'+(band.lootTotal?' col bottino':''));
    }
  }
  function lairStep(band,dt){
    const men=liveMembers(band);
    if(!men.length){
      endBand(band,'destroyed');giveGold(band.stash);
      status('Covo dei banditi distrutto'+(band.stash?': recuperati '+Math.round(band.stash)+' oro':''));
      return;
    }
    cool(men,dt);
    for(const e of men)holdPost(e,'bandits');
    const week=Math.floor(today()/7);
    if(week>band.lastTollWeek){
      band.lastTollWeek=week;
      const e=castle(),due=Math.min(LAIR_TOLL_CAP,Math.round((Number(e?.castleGold)||0)*LAIR_TOLL_SHARE));
      const got=takeGold(due);band.stash+=got;
      if(got)status('I banditi del covo hanno estorto '+got+' oro');
    }
  }
  function roadblockStep(band,dt){
    const men=liveMembers(band);
    if(!men.length){endBand(band,'destroyed');status('Strada '+edgeName(band.edge)+' liberata dai briganti: i commerci riprendono');return}
    cool(men,dt);
    for(const e of men)holdPost(e,'brigands');
    const day=Math.floor(today());
    if(band.lastDay!==day){band.lastDay=day;band.robbed=(band.robbed||0)+1}
  }
  function tick(dt){
    if(!Number.isFinite(dt)||dt<=0||!C()?.outlawState||!well())return;
    const t0=performance.now();
    planned=0;
    try{
      schedule();
      sweep();
      for(const band of bands().slice()){
        if(band.over)continue;
        if(band.type==='raiders')raidStep(band,dt);
        else if(band.type==='bandits')lairStep(band,dt);
        else roadblockStep(band,dt);
      }
    }catch(err){console.error('CONQUER_OUTLAWS_TICK_ERROR',err)}
    const perf=window.__conquerPerf||(window.__conquerPerf={});
    perf.outlawAiMs=performance.now()-t0;
    updateUi();
  }

  // ---- render -----------------------------------------------------------
  function polygon(g,pts,fill,stroke){
    g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();
    g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=Math.max(.7,State.view.scale);g.stroke()}
  }
  // Ragged ridge tent of patched hides: darker and lower than a soldier's.
  const HIDES=[['#6d5a41','#4e3f2c','#86704f'],['#5f5a44','#433f2f','#7a735a'],['#735641','#523c2c','#8c6c52']];
  function tent(g,t){
    const h=terrainElevation(t),c=Math.cos(t.a),s=Math.sin(t.a);
    const at=(u,v,z)=>w2sRaw({x:t.x+u*c-v*s,y:t.y+u*s+v*c},h+z);
    const [main,dark,light]=HIDES[t.i%HIDES.length];
    const A=at(-.5,-.62,.02),B=at(-.5,.62,.02),Cc=at(.5,.62,.02),D=at(.5,-.62,.02);
    const R1=at(-.05,-.66,.66),R2=at(-.05,.66,.66);
    polygon(g,[A,B,R2,R1],dark,'#2b2118');
    polygon(g,[D,Cc,R2,R1],main,'#2b2118');
    polygon(g,[B,Cc,R2],light,'#2b2118');
    const pole=at(-.05,.7,.82);g.strokeStyle='#3a2a1a';g.lineWidth=Math.max(.8,State.view.scale*1.2);
    g.beginPath();g.moveTo(R2.x,R2.y);g.lineTo(pole.x,pole.y);g.stroke();
  }
  function campfire(g,p,id){
    const fire={kind:'brazier',id,p,z:.05,groundZ:terrainElevation(p)};
    if(typeof drawScreenFlame!=='function')return;
    const base=w2sRaw(p,fire.groundZ+.12),scale=Math.max(.55,Math.min(1.45,State.view.scale));
    const glow=g.createRadialGradient(base.x,base.y,0,base.x,base.y,16*scale);
    glow.addColorStop(0,'rgba(255,190,90,.4)');glow.addColorStop(1,'rgba(255,150,60,0)');
    g.save();g.globalCompositeOperation='screen';g.fillStyle=glow;g.beginPath();g.arc(base.x,base.y,16*scale,0,Math.PI*2);g.fill();g.restore();
    // A ring of stones under the flame.
    g.fillStyle='#5d5850';
    for(let k=0;k<6;k++){const q=w2sRaw({x:p.x+Math.cos(k*1.05)*.28,y:p.y+Math.sin(k*1.05)*.28},fire.groundZ+.03);g.beginPath();g.arc(q.x,q.y,Math.max(1,1.6*scale),0,Math.PI*2);g.fill()}
    drawScreenFlame(base,scale,id,false);
  }
  // Roadblock: a felled trunk across the road at the brigands' post.
  function barricade(g,p,id){
    const h=terrainElevation(p),a=hash(id)*Math.PI;
    const P=w2sRaw({x:p.x+Math.cos(a)*.9,y:p.y+Math.sin(a)*.9},h+.12),Q=w2sRaw({x:p.x-Math.cos(a)*.9,y:p.y-Math.sin(a)*.9},h+.12);
    g.strokeStyle='#4a3420';g.lineCap='round';g.lineWidth=Math.max(2,State.view.scale*5);
    g.beginPath();g.moveTo(P.x,P.y);g.lineTo(Q.x,Q.y);g.stroke();
    g.strokeStyle='#6b4c2e';g.lineWidth=Math.max(1,State.view.scale*2.4);
    g.beginPath();g.moveTo(P.x,P.y-1);g.lineTo(Q.x,Q.y-1);g.stroke();g.lineCap='butt';
  }
  // 3D: the lair and the roadblock are compositions of the campaign models
  // (ConquerEvents3D.banditLair / brigandRoadblock, also in the Asset Lab),
  // drawn with the same mesh path as the army bivouacs. Cached per band.
  const sceneCache=new Map();
  function scene(band){
    const E3=window.ConquerEvents3D,M=window.ConquerMesh3D;
    if(!E3?.banditLair||!E3?.bivouacMeshes||!M?.drawMeshes||!M?.gameView)return null;
    const sig=band.id+'|'+State.seed+'|'+State.structures.length;
    const hit=sceneCache.get(band.id);if(hit&&hit.sig===sig)return hit;
    let entry;
    try{
      // No 'blocked' filter: a lair is pitched among the trees of its wood (every
      // tree is an obstacle to walkers, so filtering dropped most of the tents).
      const layout=band.type==='bandits'
        ?E3.banditLair(band.center,{seed:State.seed,key:band.id,tents:band.tents?.length})
        :E3.brigandRoadblock(band.post,band.heading||0,{key:band.id});
      const meshes=E3.bivouacMeshes([layout],p=>terrainElevation(p)).filter(m=>m?.col?.length);
      entry={sig,meshes,fires:layout.fires,ok:meshes.length>0};
    }catch(error){
      // Keep the signature: a failing catalog is not rebuilt (and warned) every frame.
      console.warn('CONQUER_OUTLAW_SCENE_FALLBACK',error);entry={sig,meshes:[],fires:[],ok:false};
    }
    sceneCache.set(band.id,entry);
    return entry;
  }
  // Camp fire as the army bivouac draws it: brazier fixture, warm glow, flame.
  function bivouacFire(g,f){
    if(typeof drawBrazierFixture!=='function'){campfire(g,f,f.id);return}
    const fire={kind:'brazier',id:f.id+':outlaw-fire',p:{x:f.x,y:f.y},z:.14,groundZ:terrainElevation(f)};
    drawBrazierFixture(fire);
    const base=w2sRaw(fire.p,fire.groundZ+fire.z+.08),scale=Math.max(.55,Math.min(1.45,State.view.scale));
    const radius=15*scale,glow=g.createRadialGradient(base.x,base.y,0,base.x,base.y,radius);
    glow.addColorStop(0,'rgba(255,198,88,.42)');glow.addColorStop(.55,'rgba(242,145,48,.18)');glow.addColorStop(1,'rgba(242,145,48,0)');
    g.save();g.globalCompositeOperation='screen';g.fillStyle=glow;g.beginPath();g.arc(base.x,base.y,radius,0,Math.PI*2);g.fill();g.restore();
    drawScreenFlame(base,scale,fire.id,true);
  }
  function draw(g,{fog=false,seen=()=>true}={}){
    const list=bands().filter(b=>!b.over&&b.type!=='raiders');
    for(const id of sceneCache.keys())if(!list.some(b=>b.id===id))sceneCache.delete(id);
    if(!list.length)return;
    const M=window.ConquerMesh3D;
    withRenderContext(g,()=>{
      for(const band of list){
        const at=band.type==='bandits'?band.center:band.post;
        if(!at||fog&&!seen(at))continue;
        const s=scene(band);
        if(s?.ok){
          M.drawMeshes(g,s.meshes,M.gameView());
          for(const f of s.fires)bivouacFire(g,f);
          continue;
        }
        // Fallback without the 3D catalog: the flat canvas tents / log.
        if(band.type==='bandits'){
          const tents=band.tents.slice().sort((a,b)=>viewDepthPoint(a)-viewDepthPoint(b));
          for(const t of tents)tent(g,t);
          campfire(g,band.center,band.id+':fire');
        }else barricade(g,band.post,band.id);
      }
    });
  }

  // ---- UI ---------------------------------------------------------------
  function summary(){
    return bands().filter(b=>!b.over).map(b=>{
      const n=liveMembers(b).length;
      if(b.type==='brigands')return{type:b.type,label:'Briganti',men:n,where:edgeName(b.edge),effect:'scambi '+Math.round(tradeFactor()*100)+'%'};
      if(b.type==='bandits')return{type:b.type,label:'Covo di banditi',men:n,where:'bosco',effect:'bottino '+Math.round(b.stash)+' oro'};
      return{type:b.type,label:'Predoni',men:n,where:edgeName(b.edge),effect:b.phase==='retreat'?'in fuga':'saccheggio'};
    });
  }
  function updateUi(){
    const el=typeof document!=='undefined'&&document.getElementById('combatOutlaws');if(!el)return;
    const rows=summary(),text=rows.length?rows.map(r=>r.label+' ('+r.men+') · '+r.where+' · '+r.effect).join(' — '):'Nessun fuorilegge';
    if(text!==lastUi){lastUi=text;el.textContent=text}
  }
  function mountUi(){
    const alarm=document.getElementById('combatAlarm');
    if(!alarm||document.getElementById('combatOutlaws'))return;
    const row=document.createElement('div');row.className='combat-row';
    row.innerHTML='<button data-outlaws="brigands" title="Briganti bloccano una strada verso il confine e derubano i mercanti">Briganti</button>'+
      '<button data-outlaws="bandits" title="Un covo di banditi con tende e guardie in un bosco">Covo banditi</button>'+
      '<button data-outlaws="raiders" title="Predoni entrano dal confine e saccheggiano gli edifici isolati">Predoni</button>';
    const legend=document.createElement('div');legend.className='legend';legend.id='combatOutlaws';legend.textContent='Nessun fuorilegge';
    alarm.insertAdjacentElement('beforebegin',row);row.insertAdjacentElement('afterend',legend);
    row.addEventListener('click',ev=>{
      const type=ev.target?.dataset?.outlaws;if(!type)return;
      if(!spawn(type))status('Impossibile: fonda il villaggio o elimina prima la banda attiva dello stesso tipo');
      updateUi();
    });
  }
  if(typeof document!=='undefined')mountUi();

  window.ConquerOutlaws=Object.freeze({TYPES,tick,draw,spawn,tradeFactor,summary,bands,
    setEnabled:on=>{enabled=!!on},enabled:()=>enabled,
    // Remove every band at once (dev / tests): no loot is returned.
    clear:()=>{const st=state();if(!st)return;C().removeEnemies(e=>e.faction==='outlaw');st.bands=[];st.schedule={}}});
})();
