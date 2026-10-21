'use strict';
// Four reusable SCATTER signposts at the village well's arterial exits.
// Explicit LOCAL QA only: keep/market -> well-area sign -> border; no world map.
// Resources are held in real economy ledgers, with test-only rollback.
(() => {
  const EDGES=['north','east','south','west'];
  const labels={north:'Nord',east:'Est',south:'Sud',west:'Ovest'};
  const money=n=>Math.round((n+Number.EPSILON)*1000)/1000;
  const coins=n=>Number.isFinite(n)&&n>=0&&n<=1e9;
  let panel=null,opened=null,lastFrame=0,seq=0;
  let cachedSignsKey=null,cachedSigns=null;
  function commerce(){return window.ConquerCommerce}
  function convoys(){return window.ConquerConvoys}
  function active(){return window.ConquerEconomy?.state?.()?.commerce?.roadSignTest||null}
  function well(){return State.structures.find(s=>s.id===State.village?.wellId&&s.type==='well')}
  function roadPieces(routeId){
    return State.structures.filter(s=>s.type==='road'&&s.routeId===routeId&&
      !s.destroyed&&!(typeof underConstruction==='function'&&underConstruction(s))).
      sort((a,b)=>(Number(a.routeSeq)||0)-(Number(b.routeSeq)||0));
  }
  function roadPolyline(route){
    const w=well(),rs=roadPieces(route.id);
    if(!w||!rs.length)return null;
    const out=[{x:w.x,y:w.y}],distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    for(const r of rs){
      const last=out[out.length-1],da=distance(last,r.a),db=distance(last,r.b);
      if(Math.min(da,db)>.45)return null;
      const next=da<=db?r.b:r.a;
      if(distance(last,next)>.025)out.push({x:next.x,y:next.y});
    }
    if(distance(out[out.length-1],route.target)>.65)return null;
    return out;
  }
  function atDistance(path,requested){
    let left=requested;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],d=Math.hypot(b.x-a.x,b.y-a.y);
      if(left<=d||i===path.length-1){
        const t=Math.max(0,Math.min(1,left/Math.max(.001,d)));
        return{p:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},segment:i-1};
      }
      left-=d;
    }
    return{p:path[0],segment:0};
  }
  function signs(){
    if(!State.village?.founded||!well())return[];
    const routes=Array.isArray(State.village.roadPlan)?State.village.roadPlan:[];
    const w=well(),nav=typeof navPerf!=='undefined'?navPerf.navInvalidations||0:0;
    const key=[State.village.wellId,w.x,w.y,State.structures.length,nav,
      routes.map(r=>[r.id,r.connected,r.target?.x,r.target?.y].join(':')).join(';')].join('|');
    if(cachedSignsKey===key&&cachedSigns)return cachedSigns;
    const result=EDGES.map(edge=>{
      const route=routes.find(r=>r.edge===edge);
      if(!route)return null;
      // Place each post on the shoulder of its actual arterial branch,
      // at the well's first outbound junction, not the distant map edge.
      const path=roadPolyline(route);
      const p=path?.length>1?atDistance(path,4.4).p:null;
      const w=well(),target=p||{
        x:w.x+(route.target.x-w.x)*.05,
        y:w.y+(route.target.y-w.y)*.05
      };
      const angle=Math.atan2(target.y-w.y,target.x-w.x);
      const offset=.76,one={x:target.x-Math.sin(angle)*offset,y:target.y+Math.cos(angle)*offset};
      const other={x:target.x+Math.sin(angle)*offset,y:target.y-Math.cos(angle)*offset};
      const free=p=>typeof pointBlockedForPeasant!=='function'||!pointBlockedForPeasant(p,null);
      const pos=free(one)?one:free(other)?other:one;
      return{edge,label:labels[edge],routeId:route.id,roadPoint:target,
        point:pos,angle,connected:!!route.connected&&!!path,path};
    }).filter(Boolean);
    cachedSignsKey=key;cachedSigns=result;
    return result;
  }
  function hit(screen){
    if(State.tool?.kind!=='select')return null;
    let selected=null,best=24*24;
    for(const s of signs()){
      const p=typeof w2s==='function'?w2s(s.point,.7):null;
      if(!p)continue;
      const d=(screen.x-p.x)**2+(screen.y-p.y)**2;
      if(d<best){selected=s.edge;best=d}
    }
    return selected;
  }
  function drawSign(sign){
    const model=window.ConquerRoadSignModel;if(!model)return;
    const v=model.v,palette=model.palette,rot=sign.angle,cs=Math.cos(rot),sn=Math.sin(rot);
    const h=typeof terrainElevation==='function'?terrainElevation(sign.point):0,scale=1.6;
    const vs=[];
    for(let i=0;i<v.length;i+=3){
      const x=v[i]*scale,y=v[i+1]*scale,z=v[i+2]*scale;
      vs.push(w2sRaw({x:sign.point.x+x*cs-y*sn,y:sign.point.y+x*sn+y*cs},h+z));
    }
    const tris=[];
    for(let i=0;i<model.c.length;i++){
      const a=vs[model.i[i*3]],b=vs[model.i[i*3+1]],c=vs[model.i[i*3+2]];
      tris.push({a,b,c,fill:palette[model.c[i]],depth:(a.y+b.y+c.y)/3});
    }
    tris.sort((a,b)=>a.depth-b.depth);
    ctx.save();
    for(const t of tris){
      ctx.fillStyle=t.fill;ctx.beginPath();
      ctx.moveTo(t.a.x,t.a.y);ctx.lineTo(t.b.x,t.b.y);
      ctx.lineTo(t.c.x,t.c.y);ctx.closePath();ctx.fill();
    }
    const p=w2s(sign.point,1.22),r=Math.max(10,10*State.view.scale);
    ctx.font='bold '+Math.max(10,Math.round(11*State.view.scale))+'px sans-serif';
    ctx.textAlign='center';ctx.lineWidth=2.8;ctx.strokeStyle='#201d16';
    ctx.fillStyle=sign.connected?'#f7e3a6':'#e6aa79';
    ctx.strokeText(sign.label,p.x,p.y-r);ctx.fillText(sign.label,p.x,p.y-r);
    if(sign.edge===opened){
      const foot=w2s(sign.point,.05);
      ctx.beginPath();ctx.ellipse(foot.x,foot.y,16*State.view.scale,7*State.view.scale,0,0,Math.PI*2);
      ctx.strokeStyle='#e7bf64';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.restore();
  }
  function pointAlong(path,distance){
    return atDistance(path,distance).p;
  }
  function totalLength(points){
    let d=0;for(let i=1;i<points.length;i++)d+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
    return d;
  }
  function drawConvoy(){
    const j=active();if(!j||j.status!=='moving'||!j.path?.length)return;
    const lead=pointAlong(j.path,j.distance||0),lag=pointAlong(j.path,Math.max(0,(j.distance||0)-.4));
    const d={x:lead.x-lag.x,y:lead.y-lag.y},right={x:d.y,y:-d.x},
      L=Math.hypot(d.x,d.y)||1,norm={x:right.x/L,y:right.y/L};
    const count=Math.min(6,j.vehicles||1),size=Math.max(24,47*State.view.scale);
    for(let i=count-1;i>=0;i--){
      const distBehind=Math.max(0,(j.distance||0)-i*1.95);
      const p=pointAlong(j.path,distBehind),scr=w2s(p,.15);
      const art=j.vehicle==='cart'?'cart':'wagon';
      const good=j.good==='stone'?'stone':j.good==='wood'?'logs':
        j.good==='food'?'sack':j.good==='metal'?'crate':j.good==='equipment'?'crate':'barrel';
      const cargo=j.good?[good,good,good]:['crate'];
      window.ConquerWagons?.drawWagon?.(ctx,scr.x,scr.y,size,{
        chassis:art,team:[{},{}],cargo,covered:false,facing:d.x-d.y>=0?1:-1,
        moving:true,t:j.distance*.5,distance:j.distance*U*State.view.scale
      });
    }
    // Escort figures are visual QA proxies until the military roster provides
    // real individual soldiers. Never count them as assigned garrison soldiers.
    for(let i=0;i<Math.min(j.guards||0,6);i++){
      const p=pointAlong(j.path,Math.max(0,(j.distance||0)-1.2-(i>>1)*.9));
      const q={x:p.x+norm.x*(i%2===0?.50:-.50),y:p.y+norm.y*(i%2===0?.50:-.50)};
      if(typeof drawSoldierFigure==='function')
        drawSoldierFigure(q,.1,'spearman','road-test-'+j.id+'-'+i,State.clock.day,
          j.kind==='merchant'?{main:'#79553b',alt:'#b08a65'}:null);
    }
  }
  function draw(){
    if(!well())return;
    for(const sign of signs())drawSign(sign);
    drawConvoy();
  }
  // Read-only road continuity validation: do not teleport across unfinished
  // arterial branches, or charge anything before route can be followed.
  function routeFor(edge){
    const s=signs().find(s=>s.edge===edge);
    if(!s?.connected||!s.path||totalLength(s.path)<4.5)return null;
    let d=0,first=0;
    for(let i=1;i<s.path.length;i++){
      const len=Math.hypot(s.path[i].x-s.path[i-1].x,s.path[i].y-s.path[i-1].y);
      if(d+len>=3.5){first=i-1;break}d+=len;
    }
    const start=atDistance(s.path,3.5).p;
    const path=[start,...s.path.slice(first+1)];
    // Sign-stage tests animate over the VERIFIED outbound main road only.
    return{sign:s,points:path,distance:totalLength(path)};
  }
  function testRecord(){
    const c=convoys()?.state?.();return c?.roadSignTest||null;
  }
  function nextId(kind){return'road-test-'+kind+'-'+(++seq)+'-'+Math.floor(State.clock.day*1000)}
  function launch({edge,kind='gift',good='',qty=0,coinGold=0,guards=0,vehicle='wagon'}={}){
    if(active()&&['moving','exited'].includes(active().status))
      return{ok:false,reason:'Ripristina il test precedente prima di avviarne un altro'};
    const route=routeFor(edge),c=convoys()?.state?.();
    if(!route||!c)return{ok:false,reason:'Strada maestra non completa o mancante'};
    if(!['gift','tribute','merchant'].includes(kind)||!coins(coinGold)||
      !Number.isSafeInteger(guards)||guards<0||guards>40||
      !Number.isSafeInteger(qty)||qty<0||good&&qty<=0||!good&&qty!==0)
      return{ok:false,reason:'Parametri del test non validi'};
    const cargo=good?[{good,qty}]:[],id=nextId(kind);
    if(!cargo.length&&coinGold<=0)return{ok:false,reason:'Seleziona una merce oppure monete'};
    let ok=false;
    if(kind==='merchant'){
      if(cargo.length)return{ok:false,reason:'Il mercato L4 non supporta ancora il prelievo atomico delle merci: prova con solo oro'};
      const house=State.structures.find(s=>s.type==='house'&&
        (typeof houseLevel==='function'?houseLevel(s):s.houseLevel)===4&&
        !(typeof underConstruction==='function'&&underConstruction(s)));
      if(!house)return{ok:false,reason:'Serve una casa L4 completata'};
      ok=commerce()?.planJourney?.({id,source:'resident',houseId:house.id,
        originId:State.village.wellId,destinationId:'test-'+edge,
        coinGold,mercenaryCount:guards,vehicle});
      if(!ok)return{ok:false,reason:'Impossibile preparare il manifesto mercantile'};
      if(!commerce().reserveJourneyCoins(id)){
        commerce().cancelPlannedJourney(id);
        return{ok:false,reason:'Oro L4 insufficiente'};
      }
      c.journeys[id].status='test-moving';
    }else{
      ok=convoys().planLordConvoy({id,kind,destinationId:'test-'+edge,
        cargo,coinGold,guards,vehicle});
      if(!ok)return{ok:false,reason:'Mastio mancante o posti di scorta insufficienti'};
      if(!convoys().reserveLordConvoy(id)){
        convoys().cancelLordConvoy(id);
        return{ok:false,reason:'Merci o oro del castello insufficienti'};
      }
      c.lordConvoys[id].status='test-moving';
    }
    const quote=kind==='merchant'?convoys().quoteJourneyCost(id,1):null;
    c.roadSignTest={id,kind,edge,status:'moving',path:route.points,
      total:route.distance,distance:0,vehicle,
      vehicles:kind==='merchant'?c.journeys[id].transport.wagons:c.lordConvoys[id].transport.wagons,
      guards,good,cargo,coinGold,escortDailyGold:quote?.escortPerDay||0,
      startedDay:State.clock.day};
    State.dirty=true;
    if(typeof scheduleLocalSave==='function')scheduleLocalSave(200);
    if(typeof status==='function')status('TEST '+labels[edge]+' avviato: merci e monete REALI accantonate');
    return{ok:true,id};
  }
  function restore(){
    const c=convoys()?.state?.(),j=c?.roadSignTest;
    if(!j)return false;
    if(j.kind==='merchant'){
      const trip=c.journeys[j.id];
      if(trip&&['test-moving','test-exited'].includes(trip.status))trip.status='planned';
      if(trip&&!commerce()?.cancelPlannedJourney?.(j.id))return false;
    }else{
      const trip=c.lordConvoys[j.id];
      if(trip&&['test-moving','test-exited'].includes(trip.status))trip.status='ready';
      if(trip&&!convoys()?.cancelLordConvoy?.(j.id))return false;
    }
    c.roadSignTest=null;State.dirty=true;
    if(typeof scheduleLocalSave==='function')scheduleLocalSave(200);
    if(typeof status==='function')status('Test ripristinato: merci, monete e posti di scorta restituiti');
    return true;
  }
  function tick(dt){
    // Near-zero overhead when no test is active; the economy state/route graph
    // should never be scanned at 60 Hz just to discover an absent convoy.
    const job=active();
    if(!job||job.status!=='moving'||!Number.isFinite(dt)||dt<=0)return;
    const c=convoys()?.state?.();
    if(!c)return;
    job.distance=Math.min(job.total,(job.distance||0)+dt*6);
    if(job.distance>=job.total){
      job.status='exited';
      const entry=(job.kind==='merchant'?c.journeys:c.lordConvoys)?.[job.id];
      if(entry)entry.status='test-exited';
      State.dirty=true;
      if(typeof scheduleLocalSave==='function')scheduleLocalSave(200);
      if(typeof status==='function')status('Convoglio al bordo '+labels[job.edge]+': carico in transito nel test. Usa Ripristina per recuperarlo.');
      refreshPanel();
    }
    // Frame animations are opt-in, never run in economy/calendar ticks.
    const now=typeof performance!=='undefined'?performance.now():0;
    if(now-lastFrame>=55){lastFrame=now;if(typeof draw==='function'&&typeof window.__drawConquerScene==='function')window.__drawConquerScene();}
  }
  function open(edge){
    if(!EDGES.includes(edge))return false;
    opened=edge;
    if(!panel&&typeof document!=='undefined'){
      panel=document.createElement('section');panel.id='roadSignTestPanel';
      panel.style.cssText='position:absolute;top:52px;right:18px;z-index:50;width:min(310px,85vw);max-height:78%;overflow-y:auto;padding:12px;border:1px solid #8a734e;border-radius:9px;background:rgba(30,35,31,.96);color:#eee5cb;box-shadow:0 6px 24px #0009;font:12px/1.5 sans-serif';
      (typeof wrap!=='undefined'?wrap:document.body).appendChild(panel);
    }
    refreshPanel();
    if(typeof draw==='function'&&typeof window.__drawConquerScene==='function')window.__drawConquerScene();
    return true;
  }
  function refreshPanel(){
    if(!panel)return;
    if(!opened){panel.style.display='none';return}
    panel.style.display='block';
    const r=routeFor(opened),j=testRecord();
    const goods=window.ConquerEconomy?.GOODS||[];
    const available=convoys()?.availableGuardSlots?.()??0;
    panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center">'+
      '<strong style="font-size:15px">🪧 Via '+labels[opened]+' · test convogli</strong>'+
      '<button type="button" data-road-close aria-label="Chiudi">×</button></div>'+
      '<p>'+(!r?'⚠ Arteria non ancora percorribile fino al confine.':'✓ Strada continua fino al confine. Animazione dal cartello al bordo.')+'</p>'+
      (j?'<div style="padding:8px;border:1px solid #987b49;border-radius:5px">'+
        '<strong>Test '+j.kind+' · '+j.status+'</strong><div>Forziere '+j.coinGold+' oro, '+(j.good||'nessuna merce')+
        ', '+j.vehicles+' mezzi, '+j.guards+' scorte</div>'+
        '<div>Oro e merci accantonati nel registro, non distrutti.</div>'+
        '<button type="button" data-road-restore>Ripristina test e risorse</button></div>':
        '<label>Tipo <select data-road-kind><option value="gift">Dono signorile</option>'+
        '<option value="tribute">Tributo signorile</option><option value="merchant">Mercante L4+ (solo monete)</option></select></label>'+
        '<label>Merce <select data-road-good><option value="">Solo monete</option>'+
        goods.map(g=>'<option value="'+g+'"'+(g==='wood'?' selected':'')+'>'+g+'</option>').join('')+'</select></label>'+
        '<label>Quantità <input data-road-qty type="number" value="1" min="0" step="1" style="width:70px"></label>'+
        '<label>Forziere monete <input data-road-gold type="number" value="0" min="0" step=".001" style="width:90px"></label>'+
        '<label>Scorta <input data-road-guards type="number" min="0" max="40" value="'+Math.min(2,available)+'" style="width:55px"></label>'+
        '<label>Veicolo <select data-road-vehicle><option value="wagon">Carro (100)</option>'+
        '<option value="cart">Carretto (40)</option></select></label>'+
        '<div style="opacity:.8">Guardie signorili: massimo '+available+
        ' posti caserma disponibili. Per mercanti: scorta di prova marrone, paga futura 2× L2.</div>'+
        '<button type="button" data-road-launch '+(!r?'disabled':'')+'>▶ TEST: carico, scorta, percorrenza</button>')+
      '<p style="opacity:.7">Modalità QA locale: la partenza internazionale non è attiva; nessuna merce viene consegnata ad altri feudi.</p>';
    panel.querySelector('[data-road-close]').onclick=()=>{opened=null;refreshPanel();if(window.__drawConquerScene)window.__drawConquerScene()};
    const restoreButton=panel.querySelector('[data-road-restore]');
    if(restoreButton)restoreButton.onclick=()=>{if(restore())refreshPanel()};
    const launchButton=panel.querySelector('[data-road-launch]');
    if(launchButton)launchButton.onclick=()=>{
      const q=k=>panel.querySelector('[data-road-'+k+']'),kind=q('kind').value;
      const result=launch({edge:opened,kind,good:kind==='merchant'?'':q('good').value,
        qty:kind==='merchant'?0:Number(q('qty').value),
        coinGold:Number(q('gold').value),guards:Number(q('guards').value),
        vehicle:q('vehicle').value});
      if(!result.ok){if(typeof status==='function')status(result.reason);return}
      refreshPanel();
    };
  }
  window.ConquerRoadSignTests=Object.freeze({signs,hit,open,draw,tick,
    routeFor,launch,restore,active:testRecord,refreshPanel});
})();
