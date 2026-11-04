'use strict';
// Alarm bells: the village alarm (ConquerCombat.setAlarmMode) is no longer heard by everyone at once.
// It starts at the command post (the Mastio, else the Municipio, the church, the first bell, the
// well) and spreads as sound: every bell rings for its hearing radius and passes the alarm on to any
// bell inside that radius (a chain of towers reaches outlying hamlets). A household inside a ringing
// bell's radius hears it almost at once; beyond every radius the alarm travels by voice, slower the
// further it goes, never later than VOICE_MAX. Bells never add up: each house takes the first one.
// Bells: the church's and the Municipio's (built in, by civic level) and the `bell` upgrade of a
// small or medium (T1-T2) tower under a pitched roof, stone or wood (the wooden watchtower too); the
// radius grows with the tower's height. A destroyed, broken-topped or roof-burnt tower has no bell.
// The ring plan is a snapshot taken when the alarm is raised: what falls later counts next time.
(()=>{
  const TOWER_RADIUS=[10,13,16],TOWNHALL_RADIUS=[10,12,14],CHURCH_RADIUS=[12,14,16];
  // Seconds: hearing a bell in range, one bell answering another, word of mouth beyond the bells.
  const HEAR=.4,HOP=.6,VOICE_BASE=1.5,VOICE_PER_U=.15,VOICE_MAX=10;
  // Rooms that take the same pitched-roof apex (Colombaia, Falconiera): one apex, one upgrade.
  const APEX_ROOMS=['dovecote','mews'];
  const lv=(table,n)=>table[Math.max(1,Math.min(table.length,Math.round(Number(n)||1)))-1];
  const standing=s=>!!s&&!s.destroyed&&!s.ruined&&!s.ruin&&!s.burnt&&!underConstruction(s);

  function pitchedRoof(s){return isWoodTower(s)?woodTowerRoof(s)==='pitched':towerRoofStyle(s)==='pitched'}
  // The upgrade can be chosen: T1-T2 tower with an intact pitched roof and its apex free.
  function towerBellAllowed(s){
    return !!s&&s.type==='tower'&&s.shape!=='half'&&towerTier(s)<=2&&pitchedRoof(s)&&!s.roofBurnt
      &&!(s.functions||[]).some(f=>APEX_ROOMS.includes(f));
  }
  function towerBell(s){return towerBellAllowed(s)&&structureVariant(s,'bell')==='bell'}
  function hearingRadius(s){
    if(!s)return 0;
    if(s.type==='church')return lv(CHURCH_RADIUS,civicLevel(s));
    if(s.type==='townhall')return lv(TOWNHALL_RADIUS,civicLevel(s));
    if(s.type==='tower')return lv(TOWER_RADIUS,isWoodTower(s)?1:structureLevel(s));
    return 0;
  }
  // Bells that can ring now (the visible belfry is drawn for towerBell, finished or not).
  function bells(structures=State.structures){
    return structures.filter(s=>standing(s)&&(s.type==='church'||s.type==='townhall'||towerBell(s)))
      .map(s=>({id:s.id,type:s.type,x:s.x,y:s.y,r:hearingRadius(s)}));
  }
  function origin(structures=State.structures,list=bells(structures)){
    const keep=window.ConquerSiege?.mastio?.()||structures.find(s=>s.type==='tower'&&s.isMastio&&standing(s));
    const pick=keep||structures.find(s=>s.type==='townhall'&&standing(s))||structures.find(s=>s.type==='church'&&standing(s));
    if(pick)return{id:pick.id,x:pick.x,y:pick.y};
    if(list[0])return{id:list[0].id,x:list[0].x,y:list[0].y};
    const well=structures.find(s=>s.type==='well');
    return well?{id:well.id,x:well.x,y:well.y}:null;
  }
  // From a node already sounding at t: in its radius a bell answers in HOP, a house hears in HEAR;
  // beyond it the news runs by voice from the radius edge.
  const reach=(n,p,inRange)=>{const d=Math.hypot(p.x-n.x,p.y-n.y);return n.t+(d<=n.r?inRange:VOICE_BASE+VOICE_PER_U*(d-n.r))};
  // Dijkstra from the command post over the bells; returns the bells with the time each one rings.
  function plan(structures=State.structures){
    const list=bells(structures),start=origin(structures,list);
    if(!start)return{origin:null,nodes:[]};
    const self=list.find(b=>b.id===start.id);
    const nodes=[self?{...self,t:0,via:null}:{id:start.id,type:'command',x:start.x,y:start.y,r:0,t:0,via:null}];
    const open=list.filter(b=>b!==self).map(b=>({...b,t:Infinity,via:null}));
    let last=nodes[0];
    while(open.length){
      for(const b of open){const t=reach(last,b,HOP);if(t<b.t){b.t=t;b.via=last.id}}
      let k=0;for(let i=1;i<open.length;i++)if(open[i].t<open[k].t)k=i;
      last=open.splice(k,1)[0];nodes.push(last);
    }
    return{origin:start,nodes};
  }
  // Seconds before a household at p hears the alarm.
  function delay(ringPlan,p){
    if(!ringPlan?.nodes?.length||!p)return 0;
    let best=Infinity;for(const n of ringPlan.nodes)best=Math.min(best,reach(n,p,HEAR));
    return Math.min(VOICE_MAX,best);
  }
  // Which bell (if any) the household hears: the first one whose radius it lies in.
  function heardBell(ringPlan,p){
    let best=null,bt=Infinity;
    for(const n of ringPlan?.nodes||[]){if(n.r<=0)continue;const d=Math.hypot(p.x-n.x,p.y-n.y);if(d<=n.r&&n.t+HEAR<bt){bt=n.t+HEAR;best=n}}
    return best;
  }

  // The ring in progress: mode heard after the delay, the previous ring heard until then.
  // `now` in milliseconds (performance.now), as the civilians' walks.
  function ring(mode,prior,now,structures=State.structures){
    if(mode==='off')return null;
    const p=plan(structures);
    const last=p.nodes.reduce((m,n)=>Math.max(m,n.t),0);
    // Keep one step of history: a green alarm not yet heard is still on its way under the red one.
    return{mode,at:now,plan:p,cache:new Map(),until:now+1000*Math.max(VOICE_MAX,last+HEAR),
      prior:prior?{mode:prior.mode,at:prior.at,plan:prior.plan,cache:prior.cache,prior:null}:null};
  }
  function heard(r,house,now){
    for(let x=r;x;x=x.prior){
      let d=x.cache.get(house.id);
      if(d==null){d=delay(x.plan,house);x.cache.set(house.id,d)}
      if(now>=x.at+1000*d)return x.mode;
    }
    return'off';
  }
  const pending=(r,now)=>!!r&&now<r.until;

  window.ConquerAlarmBells=Object.freeze({towerBellAllowed,towerBell,hearingRadius,bells,origin,plan,delay,heardBell,ring,heard,pending,
    TOWER_RADIUS,TOWNHALL_RADIUS,CHURCH_RADIUS,HEAR,HOP,VOICE_BASE,VOICE_PER_U,VOICE_MAX,APEX_ROOMS});
})();
