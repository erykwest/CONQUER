'use strict';
// CONQUER soldiers' reserve, lookouts and outposts (MIL-RES-01, decision D-MIL-RES-261109).
//
// The Barracks hold the lord's single reserve of soldiers: adult L1 men enlisted by the player up to
// the free posts (ConquerSiege.capacity().soldiers), RECRUIT_COST gold each, then paid an L2 wage a
// day from the castle gold. An enlisted man leaves L1 work (ConquerEconomy.laborAllocation). Unpaid
// soldiers do no duty. The soldiers are a currency spent, in this order, by:
//   expeditions (contract only: reserve/release, the mechanics belong to MARCH)
//   outposts    a paid upgrade of an isolated tower outside the White Zone: OUTPOST_MEN soldiers and
//               one horse from the stables, a lookout always on duty
//   lookouts    one soldier on a tower: WITHOUT a lookout a tower no longer watches (combat observers)
//   patrols     two soldiers each, on the White Zone border or on the town round (ConquerCombat)
// Duty that the reserve no longer covers stops: an outpost or a lookout goes idle, an uncovered
// patrol returns to the Barracks.
// A patrol or a lookout that sights a hostile raises the alarm by itself. An outpost sends the word to
// the castle: along the bells and signal fires within reach of each other (a signal fire is the great
// pyre on a flat crenellated deck: three times the reach of a bell, it burns once and must be rebuilt),
// and always by a mounted relay riding the road to the command post.
(function(){
  const RECRUIT_COST=Object.freeze({gold:15}),MONTH_SHIFTS=20;
  const PATROL_MEN=2,LOOKOUT_MEN=1,OUTPOST_MEN=4,OUTPOST_HORSES=1;
  const OUTPOST_COST=Object.freeze({gold:60,stone:40,wood:20}),OUTPOST_DAYS=4;
  const PYRE_COST=Object.freeze({wood:30}),FIRE_REACH=3,FIRE_HOP=2,FIRE_BURN_MS=40000;
  const RIDER_SPEED=2.6;                       // U per combat second: a galloping relay, faster than a knight's march (1.5)
  const MIN_WHITE_GAP=.5;                      // an outpost stands clear of the White Zone

  const S=()=>window.ConquerSiege,C=()=>window.ConquerCombat,E=()=>window.ConquerEconomy;
  const standing=s=>!!s&&!s.destroyed&&!s.ruined&&!s.ruin&&!underConstruction(s);
  const towers=()=>State.structures.filter(s=>s.type==='tower');
  const say=t=>{if(typeof status==='function')status(t)};
  const dirty=()=>{
    if(typeof markDirty==='function')markDirty(false,false,true);
    window.ConquerCombat?.invalidateRoutes?.();
    if(typeof renderFunctionPanel==='function')renderFunctionPanel();
  };

  // ---------- the reserve
  function st(){return S()?.state?.().soldiers||{enlisted:0,paid:true,expedition:0}}
  function posts(){return Math.max(0,Math.floor(S()?.capacity?.().soldiers||0))}
  function enlisted(){return Math.max(0,Math.floor(Number(st().enlisted)||0))}
  function paid(){return st().paid!==false}
  function onDuty(){return paid()?enlisted():0}
  // L1 men who could still join: the L1 workforce not already enlisted (herders and fishermen stay home).
  function enlistable(){
    const labor=E()?.laborAllocation?.();
    return labor&&Number.isFinite(labor.enlistable)?Math.max(0,labor.enlistable-enlisted()):0;
  }
  function wagePerDay(n=enlisted()){
    const w=E()?.state?.().wage||{L2:2};
    return n*(Number(w.L2)||2)/MONTH_SHIFTS;
  }

  // ---------- towers: lookouts and outposts
  const half=s=>s.shape==='round'?(Number(s.r)||.75):(Number(s.size)||1.5)/2;
  // Not part of the castle: no parent or child tower, no wall, palisade, section or gate touching it.
  function isolated(s){
    if(!s||s.type!=='tower'||s.parentTowerId||s.isMastio||s.shape==='half')return false;
    if(State.structures.some(o=>o.parentTowerId===s.id))return false;
    const r=half(s)+.6;
    return !State.structures.some(o=>{
      if(o===s||o.destroyed)return false;
      if(['wall','palisade','built','moat'].includes(o.type)&&o.a&&o.b)
        return Math.hypot(o.a.x-s.x,o.a.y-s.y)<r||Math.hypot(o.b.x-s.x,o.b.y-s.y)<r;
      if(o.type==='gate')return Math.hypot(o.x-s.x,o.y-s.y)<r+1.2;
      return false;
    });
  }
  function outsideWhite(s){
    const area=C()?.areaState;if(!area)return true;
    const c=half(s)+MIN_WHITE_GAP;
    return [[0,0],[c,0],[-c,0],[0,c],[0,-c]].every(([dx,dy])=>!area({x:s.x+dx,y:s.y+dy})?.allowed);
  }
  // Why a tower cannot be (or stay) an outpost; '' when it can.
  function outpostBlocker(s){
    if(!s||s.type!=='tower')return'not a tower';
    if(underConstruction(s))return'under construction';
    if(!isolated(s))return'needs an isolated tower (no walls, gates or attached towers)';
    if(!outsideWhite(s))return'must stand outside the White Zone';
    return'';
  }
  function outpostReady(s){return !!s?.outpost&&(Number(State.clock?.day)||0)>=(Number(s.outpost.readyDay)||0)}
  function lookoutWanted(s){return !!s?.lookout&&s.type==='tower'}

  // ---------- who is covered by the reserve (recomputed at most every 250 ms)
  let memo=null,memoKey='';
  function roster(){
    const now=typeof performance!=='undefined'?performance.now():0;
    const key=Math.floor(now/250)+':'+State.structures.length+':'+enlisted()+':'+paid()+':'+(C()?.units?.().length||0);
    if(memo&&key===memoKey)return memo;
    let left=onDuty();
    const expedition=Math.min(left,Math.max(0,Math.floor(Number(st().expedition)||0)));left-=expedition;
    const stock=Math.floor(Number(S()?.state?.().stock?.horses)||0);
    const knights=(C()?.units?.()||[]).filter(u=>u.kind==='knight'&&!u.defeated).length;
    let horses=Math.max(0,stock-knights);
    const outposts=new Map(),lookouts=new Set();
    for(const s of towers()){
      if(!s.outpost)continue;
      let reason=!standing(s)?'destroyed':outpostBlocker(s)||(!outpostReady(s)?'building':'');
      if(!reason&&left<OUTPOST_MEN)reason='no soldiers';
      else if(!reason&&horses<OUTPOST_HORSES)reason='no horse';
      if(!reason){left-=OUTPOST_MEN;horses-=OUTPOST_HORSES}
      outposts.set(s.id,{active:!reason,reason});
    }
    const wanted=towers().filter(s=>lookoutWanted(s)&&!s.outpost&&standing(s));
    for(const s of wanted){if(left<LOOKOUT_MEN)break;lookouts.add(s.id);left-=LOOKOUT_MEN}
    const patrols=(C()?.units?.()||[]).filter(u=>u.kind==='patrol'&&!u.defeated&&!u.lost&&!u.ward);
    const covered=Math.min(patrols.length,Math.floor(left/PATROL_MEN));left-=covered*PATROL_MEN;
    memo={posts:posts(),enlisted:enlisted(),onDuty:onDuty(),paid:paid(),expedition,outposts,lookouts,
      lookoutsWanted:wanted.length,patrols:patrols.length,patrolsCovered:covered,free:Math.max(0,left)};
    memoKey=key;return memo;
  }
  const invalidate=()=>{memo=null};
  function free(){return roster().free}
  function lookoutActive(s){return !!s&&roster().lookouts.has(s.id)}
  function outpostActive(s){return !!s&&!!roster().outposts.get(s.id)?.active}
  // Combat observers: a tower watches only with a lookout on duty (an active outpost always has one).
  function towerWatches(s){return lookoutActive(s)||outpostActive(s)}
  function horsesHeld(){let n=0;for(const v of roster().outposts.values())if(v.active)n+=OUTPOST_HORSES;return n}

  // ---------- player commands
  function recruit(){
    if(!State.village?.founded){say('Found the settlement before enlisting soldiers');return false}
    if(enlisted()>=posts()){say('Barracks full: '+enlisted()+' / '+posts()+' posts. Assign more Barracks rooms.');return false}
    if(enlistable()<=0){say('No L1 man left to enlist');return false}
    if(typeof canAfford==='function'&&!canAfford(RECRUIT_COST)){say('Enlisting a soldier costs '+RECRUIT_COST.gold+' gold');return false}
    if(typeof spendCost==='function')spendCost(RECRUIT_COST);
    st().enlisted=enlisted()+1;invalidate();dirty();
    say('Soldier enlisted · '+enlisted()+' / '+posts()+' · '+free()+' free');return true;
  }
  function dismiss(){
    if(enlisted()<=0||free()<=0&&paid()){say('No free soldier to discharge');return false}
    st().enlisted=enlisted()-1;invalidate();dirty();
    say('Soldier discharged to L1 work · '+enlisted()+' / '+posts());return true;
  }
  function setLookout(id,on){
    const s=State.structures.find(x=>x.id===id&&x.type==='tower');if(!s)return false;
    if(on){
      if(s.outpost){say('An outpost already keeps its own lookout');return false}
      if(!s.lookout&&free()<LOOKOUT_MEN){say('No free soldier for a lookout: enlist one in the Barracks');return false}
      s.lookout=true;
    }else delete s.lookout;
    invalidate();dirty();
    say(on?'Lookout posted: the tower watches the land':'Lookout withdrawn: the tower no longer watches');return true;
  }
  function setOutpost(id,on){
    const s=State.structures.find(x=>x.id===id&&x.type==='tower');if(!s)return false;
    if(!on){if(!s.outpost)return false;delete s.outpost;invalidate();dirty();say('Outpost stood down');return true}
    if(s.outpost)return false;
    const why=outpostBlocker(s);if(why){say('Outpost: '+why);return false}
    if(typeof canAfford==='function'&&!canAfford(OUTPOST_COST)){say('Outpost: '+(typeof costText==='function'?costText(OUTPOST_COST):'60 gold, 40 stone, 20 wood'));return false}
    if(typeof spendCost==='function')spendCost(OUTPOST_COST);
    s.outpost={readyDay:(Number(State.clock?.day)||0)+OUTPOST_DAYS};delete s.lookout;
    invalidate();dirty();
    say('Outpost under way: ready in '+OUTPOST_DAYS+' days · garrison '+OUTPOST_MEN+' soldiers and '+OUTPOST_HORSES+' horse');return true;
  }

  // ---------- signal fires
  const flatDeck=s=>s?.type==='tower'&&!isWoodTower(s)&&s.shape!=='half'&&['battlement','machicolation'].includes(towerRoofStyle(s))
    &&(typeof structureVariant!=='function'||structureVariant(s,'topWeapon')==='none'&&structureVariant(s,'innerRoof')!=='on');   // the inner roof takes the deck
  function signalFireAllowed(s){return flatDeck(s)}
  function signalFire(s){return signalFireAllowed(s)&&typeof structureVariant==='function'&&structureVariant(s,'signalFire')==='pyre'}
  function pyreReady(s){return signalFire(s)&&standing(s)&&!s.signalFireSpent}
  function fireReach(s){
    const bells=window.ConquerAlarmBells,table=bells?.TOWER_RADIUS||[10,13,16];
    return FIRE_REACH*table[Math.max(1,Math.min(table.length,structureLevel(s)))-1];
  }
  // 'pyre': build (or rebuild once burnt) the pyre for PYRE_COST; 'none' takes it down.
  function setSignalFire(id,value){
    const s=State.structures.find(x=>x.id===id&&x.type==='tower');if(!s||typeof setStructureVariant!=='function')return false;
    if(value==='pyre'){
      if(!signalFireAllowed(s)){say('Signal fire: needs a flat crenellated stone deck without a war engine');return false}
      if(signalFire(s)&&!s.signalFireSpent)return false;
      if(typeof canAfford==='function'&&!canAfford(PYRE_COST)){say('Signal fire: the pyre takes '+PYRE_COST.wood+' wood');return false}
      if(typeof spendCost==='function')spendCost(PYRE_COST);
      setStructureVariant(s,'signalFire','pyre');delete s.signalFireSpent;
      say('Signal fire ready: seen '+fireReach(s)+'U away, burns once');
    }else{
      if(!setStructureVariant(s,'signalFire','none'))return false;
      delete s.signalFireSpent;say('Signal fire removed');
    }
    dirty();return true;
  }

  // ---------- alarms
  const reported=new Set(),relayed=new Set();
  const pending=[];const riders=[];const burning=new Map();
  const nowMs=()=>typeof performance!=='undefined'?performance.now():0;
  function raise(reason){
    const c=C();if(!c?.alarmMode||!c.setAlarmMode)return false;
    if(c.alarmMode()!=='off')return false;
    const ok=c.setAlarmMode('green');
    if(ok)say('🔔 '+reason+' · green alarm raised');
    return ok;
  }
  // Called by ConquerCombat.updateAlert for every hostile in sight, with the sources that see it.
  function sighted(intruder,seers){
    if(!intruder||intruder.kind==='wolf'||intruder.neutral)return;
    const r=roster();
    for(const seer of seers||[]){
      const tower=State.structures.find(s=>s.id===seer.id&&s.type==='tower');
      if(tower&&r.outposts.get(tower.id)?.active){relay(tower,intruder);continue}
      const local=tower?r.lookouts.has(tower.id)
        :(C()?.units?.()||[]).some(u=>u.id===seer.id&&u.kind==='patrol');
      if(!local||reported.has(intruder.id))continue;
      reported.add(intruder.id);
      raise(tower?'The lookout on a tower sighted the enemy':'A patrol sighted the enemy');
    }
  }
  // Signal chain from an outpost to the command post over bells and signal fires (Dijkstra on time,
  // seconds): a node reaches another inside its radius; a fire takes FIRE_HOP to be seen and burns.
  function signalNodes(){
    const bells=window.ConquerAlarmBells?.bells?.()||[];
    const fires=towers().filter(pyreReady).map(s=>({id:s.id,x:s.x,y:s.y,r:fireReach(s),fire:true}));
    const byId=new Map();for(const n of [...bells.map(b=>({...b,fire:false})),...fires]){const o=byId.get(n.id);if(!o||n.r>o.r)byId.set(n.id,n)}
    return [...byId.values()];
  }
  function signalPlan(outpost,origin=window.ConquerAlarmBells?.origin?.()){
    if(!outpost||!origin)return null;
    const all=signalNodes(),start=all.find(n=>n.id===outpost.id);if(!start)return null;
    const open=all.filter(n=>n!==start).map(n=>({...n,t:Infinity,via:null}));
    let last={...start,t:start.fire?FIRE_HOP:0,via:null};const done=[last];
    const hop=n=>n.fire?FIRE_HOP:(window.ConquerAlarmBells?.HOP??.6);
    for(;;){
      if(Math.hypot(origin.x-last.x,origin.y-last.y)<=last.r){
        const path=[];for(let n=last;n;n=done.find(d=>d.id===n.via))path.unshift(n);
        return{t:last.t,path};
      }
      for(const n of open){const d=Math.hypot(n.x-last.x,n.y-last.y);if(d<=last.r&&last.t+hop(n)<n.t){n.t=last.t+hop(n);n.via=last.id}}
      let k=-1;for(let i=0;i<open.length;i++)if(Number.isFinite(open[i].t)&&(k<0||open[i].t<open[k].t))k=i;
      if(k<0)return null;
      last=open.splice(k,1)[0];done.push(last);
    }
  }
  function lightFire(s,at){
    s.signalFireSpent=true;burning.set(s.id,at+FIRE_BURN_MS);
  }
  function relay(outpost,intruder){
    if(relayed.has(outpost.id+':'+intruder.id))return;
    relayed.add(outpost.id+':'+intruder.id);
    if(riders.some(r=>r.outpostId===outpost.id)||pending.some(p=>p.outpostId===outpost.id))return;
    const origin=window.ConquerAlarmBells?.origin?.(),t0=nowMs();
    const plan=signalPlan(outpost,origin);
    if(plan){
      for(const n of plan.path)if(n.fire){const s=State.structures.find(x=>x.id===n.id);if(s)lightFire(s,t0+1000*Math.max(0,n.t-FIRE_HOP))}
      pending.push({outpostId:outpost.id,at:t0+1000*plan.t,reason:'Signal from the outpost'});
    }
    if(origin){
      const from={x:outpost.x,y:outpost.y},to={x:origin.x,y:origin.y};
      const road=window.ConquerVehicles?.route?.(from,to);
      const pts=road&&road.length>1?[from,...road,to]:[from,to];
      riders.push({id:'relay-'+outpost.id+'-'+Math.round(t0),outpostId:outpost.id,pts,s:0,
        path:window.ConquerVehicles?.makePath?.(pts)||null});
    }
    say('Outpost: enemy sighted · '+(plan?'signal on its way, ':'')+'relay rider sent to the castle');
    dirty();
  }
  function lengthOf(pts){let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);return L}
  function pointAt(r){
    if(r.path&&window.ConquerVehicles?.at)return window.ConquerVehicles.at(r.path,r.s);
    let s=r.s;for(let i=1;i<r.pts.length;i++){
      const a=r.pts[i-1],b=r.pts[i],L=Math.hypot(b.x-a.x,b.y-a.y);
      if(s<=L||i===r.pts.length-1){const t=L>0?Math.min(1,s/L):1;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
      s-=L;
    }
    return r.pts[0];
  }
  // Real-time step, from ConquerCombat.tick(dt).
  function frame(dt){
    const now=nowMs();
    for(let i=pending.length-1;i>=0;i--)if(now>=pending[i].at){raise(pending[i].reason);pending.splice(i,1)}
    for(let i=riders.length-1;i>=0;i--){
      const r=riders[i],total=r.path?.total??lengthOf(r.pts);
      r.s=Math.min(total,r.s+RIDER_SPEED*Math.max(0,Number(dt)||0));
      if(r.s>=total-1e-6){raise('The outpost relay rider reached the castle');riders.splice(i,1)}
    }
    for(const [id,until] of burning)if(now>until)burning.delete(id);
    // Forget contacts that are gone, so a new incursion raises the alarm again.
    const live=new Set((C()?.enemy?.()||[]).filter(e=>!e.defeated&&!(e.stats?.hp<=0)).map(e=>e.id));
    for(const id of reported)if(!live.has(id))reported.delete(id);
    for(const k of relayed)if(!live.has(k.slice(k.indexOf(':')+1)))relayed.delete(k);
    enforcePatrols();
  }
  // Patrols the reserve no longer covers go back to the Barracks.
  function enforcePatrols(){
    const r=roster(),extra=r.patrols-r.patrolsCovered;
    if(extra>0&&C()?.withdrawPatrols){
      const n=C().withdrawPatrols(extra);invalidate();
      if(n)say(n+' patrol(s) back to the Barracks: '+(paid()?'not enough soldiers':'the soldiers are unpaid'));
    }
  }

  // ---------- daily: wages, posts lost
  function tick(before,after){
    const days=Math.max(0,Number(after)-Number(before));if(!days)return;
    const x=st(),cap=posts();
    if(x.enlisted>cap){x.enlisted=cap;say('Barracks posts lost: soldiers discharged to '+cap)}
    const n=enlisted();
    if(n>0){
      const econ=E()?.state?.(),cost=wagePerDay(n)*days;
      const was=paid();
      if(econ&&Number(econ.castleGold)>=cost){
        econ.castleGold=Math.round((econ.castleGold-cost)*1e8)/1e8;
        econ.wallet.L1=(Number(econ.wallet.L1)||0)+cost;     // enlisted men are L1 households
        E().syncBuilderResources?.();x.paid=true;
      }else x.paid=!econ;                                    // no economy (tests, /camp): duty as before
      if(was&&!x.paid)say('Soldiers unpaid: patrols, lookouts and outposts stand down');
    }else x.paid=true;
    invalidate();
  }

  // ---------- expeditions (contract only: MARCH reserves soldiers and gives them back)
  function reserveExpedition(n){
    n=Math.max(0,Math.floor(Number(n)||0));if(!n||free()<n)return false;
    st().expedition=(Number(st().expedition)||0)+n;invalidate();dirty();return true;
  }
  function releaseExpedition(n,lost=0){
    const x=st(),out=Math.max(0,Math.floor(Number(x.expedition)||0));
    n=Math.min(out,Math.max(0,Math.floor(Number(n)||0)));lost=Math.min(n,Math.max(0,Math.floor(Number(lost)||0)));
    x.expedition=out-n;x.enlisted=Math.max(0,enlisted()-lost);invalidate();dirty();return n;
  }

  // ---------- drawing
  // The lookout stands on an open deck (a pitched roof hides him inside the top room).
  function lookoutPose(s){
    const slot=(S()?.archerSlots?.(s)||[]).find(x=>x.kind==='roof');if(!slot)return null;
    // Towards a corner, clear of the pyre (0.3U half side) and inside the parapet.
    const a=(Number(s.angle)||0)+Math.PI/4,off=Math.max(.2,Math.min(.62,half(s)-.2)*Math.SQRT2*.75);
    return{p:{x:slot.p.x+Math.cos(a)*off,y:slot.p.y+Math.sin(a)*off},z:slot.z};
  }
  function drawLookouts(){
    if(typeof drawSoldierFigure!=='function')return;
    const day=typeof peasantVisualDay==='function'?peasantVisualDay():0;
    for(const s of towers()){
      if(!towerWatches(s))continue;
      const pose=lookoutPose(s);if(!pose)continue;
      const paint=()=>{if(typeof worldPointVisible!=='function'||worldPointVisible(pose.p,pose.z,48))drawSoldierFigure(pose.p,pose.z,'spearman',s.id+':lookout',day)};
      if(typeof withStructureGroundPlane==='function')withStructureGroundPlane(s,paint);else paint();
    }
  }
  function draw(g){
    if(typeof w2s!=='function')return;
    const now=nowMs();
    for(const [id,until] of burning){
      const s=State.structures.find(x=>x.id===id);if(!s)continue;
      const z=(typeof terrainElevation==='function'?terrainElevation(s):0)+structureHeight(s)+.05;
      if(typeof worldPointVisible==='function'&&!worldPointVisible(s,z,60))continue;
      const k=Math.max(0,Math.min(1,(until-now)/FIRE_BURN_MS)),base=w2s({x:s.x,y:s.y},z);
      // One world unit up, in pixels: the flames are about 1.2U tall at their height, 0.3U wide.
      const unit=Math.max(3,Math.abs(w2s({x:s.x,y:s.y},z+1).y-base.y)),scale=unit*(.5+.5*k);
      g.save();g.globalCompositeOperation='lighter';
      for(let i=0;i<5;i++){
        const f=Math.sin(now/90+i*1.7)*.5+.5,h=scale*(.8+f*.5),w=scale*(.32-i*.04);
        g.fillStyle=i<2?'rgba(255,214,120,.55)':'rgba(240,120,40,.45)';
        g.beginPath();g.moveTo(base.x-w,base.y);g.quadraticCurveTo(base.x+(f-.5)*w,base.y-h*.6,base.x+(f-.5)*w*.4,base.y-h);
        g.quadraticCurveTo(base.x+(.5-f)*w,base.y-h*.5,base.x+w,base.y);g.closePath();g.fill();
      }
      g.restore();
    }
    const M2=window.ConquerMounted2D;
    for(const r of riders){
      const p=pointAt(r),q=pointAt({...r,s:r.s+.3});
      if(typeof worldPointVisible==='function'&&!worldPointVisible(p,.15,70))continue;
      if(M2&&typeof w2sRaw==='function'){
        const s=w2s(p,.1),a=w2sRaw(p,0),b=w2sRaw(q,0);
        M2.draw(g,s.x,s.y,Math.max(1.5,(State.view?.scale||10)*5.75),{kind:'messenger',facing:b.x>=a.x?1:-1,
          mode:'walk',from:'walk',blend:1,t:now/1000*3,seed:3,coat:'brown',
          livery:typeof soldierLivery==='function'?soldierLivery(r.id):undefined});
      }else if(typeof drawSoldierFigure==='function'&&typeof withRenderContext==='function'){
        withRenderContext(g,()=>drawSoldierFigure(p,.1,'unarmed',r.id,now/1000));
      }
    }
  }
  const needsAnimation=()=>riders.length>0||burning.size>0||pending.length>0;

  // ---------- panels
  const REASON_IT={'destroyed':'torre distrutta','building':'in allestimento','no soldiers':'mancano '+OUTPOST_MEN+' soldati liberi','no horse':'manca un cavallo in scuderia',
    'under construction':'torre in costruzione','must stand outside the White Zone':'dentro la White Zone',
    'needs an isolated tower (no walls, gates or attached towers)':'torre non isolata'};
  function towerFacts(s){
    const r=roster(),out=[];
    if(s.outpost){
      const o=r.outposts.get(s.id),ready=Number(s.outpost.readyDay)-(Number(State.clock?.day)||0);
      out.push({key:'outpost',value:o?.active?'in servizio · '+OUTPOST_MEN+' soldati, 1 cavallo'
        :o?.reason==='building'?'pronto tra '+Math.max(0,ready).toFixed(1).replace('.',',')+' giorni':(REASON_IT[o?.reason]||o?.reason||'inattivo')});
    }else if(s.lookout)out.push({key:'lookout',value:r.lookouts.has(s.id)?'in servizio':'nessun soldato libero'});
    if(signalFire(s))out.push({key:'signalFire',value:s.signalFireSpent?'bruciato · da ricostruire':'pronto · '+fireReach(s)+'U'});
    return out;
  }
  const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // Legacy (UI v1) tower panel block.
  function towerPanelHtml(s){
    if(!s||s.type!=='tower')return'';
    const r=roster(),building=underConstruction(s),why=outpostBlocker(s);
    let h='<div class="slot" data-soldiers-tower><div class="slot-label">Vedetta · '+(s.outpost?'avamposto':s.lookout?(r.lookouts.has(s.id)?'in servizio':'senza soldato libero'):'nessuna (la torre non osserva)')+'</div>';
    if(!s.outpost)h+='<button type="button" data-soldiers-lookout="'+(s.lookout?'0':'1')+'"'+(building?' disabled':'')+(s.lookout?' class="active"':'')+'>'+(s.lookout?'Ritira la vedetta':'Metti una vedetta · 1 soldato')+'</button>';
    h+='<div class="slot-label">Avamposto'+(s.outpost?' · '+esc(towerFacts(s)[0]?.value||''):'')+'</div>';
    h+=s.outpost?'<button type="button" data-soldiers-outpost="0">Smobilita l\'avamposto</button>'
      :'<button type="button" data-soldiers-outpost="1"'+(why?' disabled title="'+esc(why)+'"':'')+'>Fai avamposto · 60 oro, 40 pietra, 20 legno, '+OUTPOST_DAYS+' giorni</button>';
    if(signalFireAllowed(s)||signalFire(s)){
      const on=signalFire(s);
      h+='<div class="slot-label">Fuoco di segnalazione'+(on?' · '+(s.signalFireSpent?'bruciato':'pronto, '+fireReach(s)+'U'):'')+'</div>'+
        '<div class="grid"><button type="button" data-soldiers-fire="none"'+(on?'':' class="active"')+'>Nessuno</button>'+
        '<button type="button" data-soldiers-fire="pyre"'+(on&&!s.signalFireSpent?' class="active" disabled':'')+'>'+(on&&s.signalFireSpent?'Ricostruisci pira · 30 legno':'Pira · 30 legno')+'</button></div>';
    }
    return h+'<div class="legend">Senza vedetta la torre non vede. L\'avamposto avvisa il castello con campane, fuochi e una staffetta a cavallo.</div></div>';
  }
  function bindTowerPanel(root,s){
    if(!root||!s)return;
    root.querySelectorAll('[data-soldiers-lookout]').forEach(b=>b.onclick=()=>setLookout(s.id,b.dataset.soldiersLookout==='1'));
    root.querySelectorAll('[data-soldiers-outpost]').forEach(b=>b.onclick=()=>setOutpost(s.id,b.dataset.soldiersOutpost==='1'));
    root.querySelectorAll('[data-soldiers-fire]').forEach(b=>b.onclick=()=>setSignalFire(s.id,b.dataset.soldiersFire));
  }
  function summary(){
    const r=roster();
    return{posts:r.posts,enlisted:r.enlisted,onDuty:r.onDuty,paid:r.paid,free:r.free,expedition:r.expedition,
      lookouts:r.lookouts.size,lookoutsWanted:r.lookoutsWanted,patrols:r.patrols,
      outposts:[...r.outposts.values()].filter(o=>o.active).length,outpostsWanted:r.outposts.size,
      enlistable:enlistable(),wagePerDay:wagePerDay(),recruitCost:RECRUIT_COST.gold,riders:riders.length};
  }

  window.ConquerSoldiers=Object.freeze({RECRUIT_COST,PATROL_MEN,LOOKOUT_MEN,OUTPOST_MEN,OUTPOST_HORSES,OUTPOST_COST,OUTPOST_DAYS,
    PYRE_COST,FIRE_REACH,FIRE_HOP,RIDER_SPEED,MONTH_SHIFTS,
    posts,enlisted,paid,onDuty,enlistable,wagePerDay,roster,free,invalidate,summary,
    isolated,outsideWhite,outpostBlocker,outpostReady,lookoutActive,outpostActive,towerWatches,horsesHeld,
    recruit,dismiss,setLookout,setOutpost,signalFireAllowed,signalFire,pyreReady,fireReach,setSignalFire,
    sighted,signalPlan,relay,frame,tick,reserveExpedition,releaseExpedition,
    lookoutPose,drawLookouts,draw,needsAnimation,towerFacts,towerPanelHtml,bindTowerPanel,
    riders:()=>riders.map(r=>({...r})),pending:()=>pending.map(p=>({...p}))});
})();
