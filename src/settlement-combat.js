'use strict';
// CONQUER /combat — tactical prototype. Classic script, no build dependencies.
(function(){
  const STEP=2, N=WORLD/STEP, COLORS={allowed:'#ddd8bf',yellow:'#e6b845',green:'#65bc83'};
  const canvasLayer=document.createElement('canvas');
  canvasLayer.id='combatCanvas';
  canvasLayer.setAttribute('aria-hidden','true');
  wrap.appendChild(canvasLayer);
  const g=canvasLayer.getContext('2d');
  const fog=document.createElement('canvas');fog.width=N;fog.height=N;
  const fogCtx=fog.getContext('2d');
  const memory=new Uint8Array(N*N), visible=new Uint8Array(N*N);
  const forestCell=new Int16Array(N*N),heightCell=new Float32Array(N*N);
  let terrainRef=null,forestRef=null,lastVision=0,maskDirty=true,visibilityDirty=true;
  let circleCache=[],circleCacheBucket=-1;
  let lastObserverSig='',lastAreaSig='',selected=null,painting=false,lastPaint=null;
  let transitionFrame=0,recallStartedAt=0,alertState='clear';
  let combat=null;

  function defaults(){return{version:1,fog:true,zones:true,brushRadius:5,strokes:[],units:[],enemy:[],recall:false,seen:''};}
  function restore(raw){
    combat=Object.assign(defaults(),raw&&raw.version===1?raw:{});
    combat.strokes=Array.isArray(combat.strokes)?combat.strokes.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.r)&&['allow','deny','yellow','green','eraseYellow','eraseGreen'].includes(s.mode)).slice(-2500):[];
    combat.units=Array.isArray(combat.units)?combat.units.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&['squad','knight'].includes(s.kind)): [];
    combat.enemy=Array.isArray(combat.enemy)?combat.enemy.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)):[];
    memory.fill(0);
    try{const saved=atob(combat.seen||'');for(let i=0;i<Math.min(saved.length,memory.length);i++)memory[i]=saved.charCodeAt(i)?1:0}catch(e){}
    selected=null;lastObserverSig='';lastAreaSig='';maskDirty=true;visibilityDirty=true;circleCacheBucket=-1;
    State.combat=combat;syncButtons();refreshFog(true);
  }
  function serialize(){
    if(!combat)return null;
    let chars='';for(let i=0;i<memory.length;i++)chars+=String.fromCharCode(memory[i]);
    combat.seen=btoa(chars);
    return combat;
  }
  function changed(){
    visibilityDirty=true;maskDirty=true;
    State.dirty=true;
    const el=document.getElementById('saveState');if(el)el.textContent='unsaved';
    if(typeof scheduleLocalSave==='function')scheduleLocalSave();
    syncButtons();
  }
  const point=(x,y)=>({x:Math.max(0,Math.min(WORLD,x)),y:Math.max(0,Math.min(WORLD,y))});
  const activeWell=()=>State.village.founded?State.structures.find(s=>s.id===State.village.wellId&&s.type==='well'):null;
  function startUnits(){
    const well=activeWell();if(!well||combat.units.length)return;
    combat.units=[
      {id:'combat-squad-'+well.id,kind:'squad',x:well.x+2,y:well.y+2,target:null,experience:0},
      {id:'combat-knight-'+well.id,kind:'knight',x:well.x+4,y:well.y+2,target:null}
    ];changed();
  }
  function circles(){
    const well=activeWell();if(!well)return [];
    const bucket=Math.floor(performance.now()/400);
    if(circleCacheBucket===bucket)return circleCache;
    circleCacheBucket=bucket;
    const out=[
      {x:well.x,y:well.y,r:20,mode:'allow',id:'well-access'},
      {x:well.x,y:well.y,r:14,mode:'yellow',id:'well-alert'},
      {x:well.x,y:well.y,r:7,mode:'green',id:'well-safe'}
    ];
    for(const tower of State.structures){
      if(tower.type==='tower'&&!underConstruction(tower))
        out.push({x:tower.x,y:tower.y,r:8+2*structureLevel(tower),mode:'yellow',id:tower.id});
    }
    circleCache=out;return out;
  }
  function nearCircle(p,c){const dx=p.x-c.x,dy=p.y-c.y;return dx*dx+dy*dy<=c.r*c.r}
  function areaState(p){
    const well=activeWell();
    if(!well)return{allowed:false,yellow:false,green:false};
    let allowed=false,yellow=false,green=false;
    for(const c of circles()){
      if(!nearCircle(p,c))continue;
      if(c.mode==='allow')allowed=true;
      if(c.mode==='yellow')yellow=true;
      if(c.mode==='green')green=true;
    }
    for(const stroke of combat.strokes){
      if(!nearCircle(p,stroke))continue;
      if(stroke.mode==='allow')allowed=true;
      else if(stroke.mode==='deny')allowed=false;
      else if(stroke.mode==='yellow')yellow=true;
      else if(stroke.mode==='green')green=true;
      else if(stroke.mode==='eraseYellow')yellow=false;
      else if(stroke.mode==='eraseGreen')green=false;
    }
    return{allowed,yellow,green};
  }
  function closestSafe(p){
    const safe=circles().filter(s=>s.mode==='green')
      .concat(combat.strokes.filter(s=>s.mode==='green'));
    if(!safe.length)return activeWell();
    safe.sort((a,b)=>dist(a,p)-dist(b,p));
    return safe.find(s=>areaState(s).allowed)||activeWell();
  }
  function civilPosition(p,house,resident){
    if(!activeWell())return p;
    let next=p;
    if(!areaState(next).allowed){
      const anchor=areaState(house).allowed?house:activeWell();
      if(anchor){
        let low=0,high=1;
        for(let i=0;i<9;i++){
          const mid=(low+high)/2,q={x:anchor.x+(p.x-anchor.x)*mid,y:anchor.y+(p.y-anchor.y)*mid};
          if(areaState(q).allowed)low=mid;else high=mid;
        }
        next={x:anchor.x+(p.x-anchor.x)*low,y:anchor.y+(p.y-anchor.y)*low};
      }
    }
    if(combat.recall){
      const safe=closestSafe(house)||activeWell();
      if(safe){
        const jitter=peasantHash(resident.id)%1000/1000,angle=jitter*Math.PI*2;
        const target={x:safe.x+Math.cos(angle)*Math.min(1.1,safe.r||1),y:safe.y+Math.sin(angle)*Math.min(1.1,safe.r||1)};
        const t=clamp((performance.now()-recallStartedAt)/2400,0,1);
        next={x:next.x+(target.x-next.x)*t,y:next.y+(target.y-next.y)*t};
      }
    }
    return next;
  }
  function terrainCache(){
    if(State.relief!==terrainRef||State.environment!==forestRef){
      terrainRef=State.relief;forestRef=State.environment;
      forestCell.fill(-2);heightCell.fill(NaN);
      visibilityDirty=true;maskDirty=true;
    }
  }
  function idx(x,y){return y*N+x}
  function forestAt(p){
    for(let i=0;i<State.environment.length;i++){
      const f=State.environment[i];
      if(f.type==='forest'&&environmentContains(f,p))return i;
    }
    return -1;
  }
  function tileForest(x,y){
    const i=idx(x,y);
    if(forestCell[i]===-2)forestCell[i]=forestAt({x:(x+.5)*STEP,y:(y+.5)*STEP});
    return forestCell[i];
  }
  function tileHeight(x,y){
    const i=idx(x,y);
    if(Number.isNaN(heightCell[i]))heightCell[i]=terrainElevation({x:(x+.5)*STEP,y:(y+.5)*STEP});
    return heightCell[i];
  }
  function tileOf(p){return{x:clamp(Math.floor(p.x/STEP),0,N-1),y:clamp(Math.floor(p.y/STEP),0,N-1)}}
  function inForestDeep(p,forestId){
    if(forestId<0)return false;
    const f=State.environment[forestId];if(!f||!f.points)return false;
    let min=Infinity;
    for(let i=0;i<f.points.length;i++)min=Math.min(min,pointSegmentDistance(p,f.points[i],f.points[(i+1)%f.points.length]));
    return min>2;
  }
  function observers(){
    const out=[];
    for(const tower of State.structures){
      if(tower.type!=='tower'||underConstruction(tower))continue;
      const h=clamp(Math.round(terrainElevation(tower)+structureLevel(tower)),0,8);
      out.push({x:tower.x,y:tower.y,h,r:8+2*h,id:tower.id});
    }
    for(const unit of combat.units){
      const h=clamp(Math.round(terrainElevation(unit)),0,8);
      out.push({x:unit.x,y:unit.y,h,r:8+2*h,id:unit.id});
    }
    return out;
  }
  function lineVisible(source,target,sourceForest,targetForest){
    const length=dist(source,target),steps=Math.floor(length/STEP);
    for(let k=1;k<steps;k++){
      const t=k/steps,p={x:source.x+(target.x-source.x)*t,y:source.y+(target.y-source.y)*t};
      const q=tileOf(p),terrain=tileHeight(q.x,q.y),forestId=tileForest(q.x,q.y);
      if(terrain>source.h+.05)return false;
      if(forestId>=0&&terrain+1>=source.h-.05){
        // Edge silhouettes may be visible, but deep tree cover hides the cell.
        if(!(forestId===targetForest&&length-dist(source,p)<2)&&
           !(forestId===sourceForest&&dist(source,p)<1))return false;
      }
    }
    return true;
  }
  function sourceSees(source,target){
    if(dist(source,target)>source.r)return false;
    const sourceForest=forestAt(source),targetForest=forestAt(target);
    if(targetForest>=0){
      if(sourceForest===targetForest){
        if(dist(source,target)>2)return false;
      }else if(inForestDeep(target,targetForest))return false;
    }
    if(sourceForest>=0&&sourceForest!==targetForest&&dist(source,target)>2)return false;
    return lineVisible(source,target,sourceForest,targetForest);
  }
  function refreshFog(force=false){
    if(!combat||!activeWell())return;
    const now=performance.now();
    if(!force&&!visibilityDirty&&now-lastVision<900)return;
    startUnits();terrainCache();
    const sources=observers();
    const sig=sources.map(s=>s.id+':'+s.x.toFixed(1)+':'+s.y.toFixed(1)+':'+s.h).join('|')+
      ':structures'+State.structures.length+':env'+State.environment.length;
    if(!force&&!visibilityDirty&&sig===lastObserverSig&&now-lastVision<2500)return;
    lastObserverSig=sig;lastVision=now;visibilityDirty=false;
    visible.fill(0);
    for(const source of sources){
      const x0=Math.max(0,Math.floor((source.x-source.r)/STEP)),x1=Math.min(N-1,Math.ceil((source.x+source.r)/STEP));
      const y0=Math.max(0,Math.floor((source.y-source.r)/STEP)),y1=Math.min(N-1,Math.ceil((source.y+source.r)/STEP));
      const srcForest=forestAt(source);
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const i=idx(x,y);if(visible[i])continue;
        const p={x:(x+.5)*STEP,y:(y+.5)*STEP};
        if(dist(source,p)>source.r)continue;
        const f=tileForest(x,y);
        if(f>=0){
          if(srcForest===f){if(dist(source,p)>2)continue}
          else if(inForestDeep(p,f))continue;
        }
        if(srcForest>=0&&srcForest!==f&&dist(source,p)>2)continue;
        if(lineVisible(source,p,srcForest,f)){visible[i]=1;memory[i]=1}
      }
    }
    let image=fogCtx.createImageData(N,N);
    for(let i=0;i<visible.length;i++){
      const k=i*4,a=visible[i]?0:memory[i]?158:232;
      image.data[k]=8;image.data[k+1]=12;image.data[k+2]=16;image.data[k+3]=a;
    }
    fogCtx.putImageData(image,0,0);maskDirty=false;
    updateAlert(sources);
  }
  function spotted(p,sources){
    const q=tileOf(p);return !!visible[idx(q.x,q.y)]||sources.some(s=>sourceSees(s,p));
  }
  function updateAlert(sources){
    let next='clear';
    for(const intruder of combat.enemy){
      if(!spotted(intruder,sources))continue;
      const a=areaState(intruder);
      if(a.green){next='general';break}
      if(a.yellow)next='local';
    }
    if(next!==alertState){
      alertState=next;
      if(next==='general')status('GENERAL ALARM — hostile unit spotted in safe zone');
      else if(next==='local')status('LOCAL ALERT — hostile unit spotted inside yellow zone');
      else status('No hostile contacts in protected zones');
    }
    const el=document.getElementById('combatAlarm');
    if(el){el.textContent=next==='general'?'GENERAL ALARM':next==='local'?'LOCAL ALERT':'No alert';el.dataset.level=next}
  }
  function drawMapCircle(c,strokeOnly=false){
    const steps=48;
    g.beginPath();
    for(let i=0;i<=steps;i++){
      const a=i*Math.PI*2/steps,p=w2sRaw({x:c.x+Math.cos(a)*c.r,y:c.y+Math.sin(a)*c.r},0);
      if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
    }
    g.closePath();
    if(!strokeOnly)g.fill();g.stroke();
  }
  function renderOverlay(){
    if(!combat)return;
    const rect=wrap.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
    if(canvasLayer.width!==Math.round(rect.width*d)||canvasLayer.height!==Math.round(rect.height*d)){
      canvasLayer.width=Math.round(rect.width*d);canvasLayer.height=Math.round(rect.height*d);
    }
    g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,rect.width,rect.height);
    if(!activeWell())return;
    refreshFog();
    if(combat.fog){
      const a=w2sRaw({x:0,y:0},0),b=w2sRaw({x:STEP,y:0},0),c=w2sRaw({x:0,y:STEP},0);
      g.save();g.setTransform(d*(b.x-a.x),d*(b.y-a.y),d*(c.x-a.x),d*(c.y-a.y),d*a.x,d*a.y);
      g.imageSmoothingEnabled=false;g.drawImage(fog,0,0);g.restore();
    }
    if(combat.zones){
      for(const c of circles().concat(combat.strokes)){
        let mode=c.mode;if(mode==='deny'||mode==='eraseYellow'||mode==='eraseGreen')continue;
        const color=COLORS[mode];if(!color)continue;
        g.strokeStyle=color;g.fillStyle=mode==='green'?'rgba(101,188,131,.12)':mode==='yellow'?'rgba(230,184,69,.07)':'rgba(230,226,207,.05)';
        g.lineWidth=mode==='green'?1.1:.8;g.setLineDash(c.id?[5,5]:[]);drawMapCircle(c);
      }
      g.setLineDash([]);
    }
    const king=combat.units.find(u=>u.kind==='knight');
    if(king){
      g.strokeStyle='rgba(255,211,116,.7)';g.fillStyle='rgba(255,211,116,.045)';
      g.lineWidth=1.5;g.setLineDash([5,4]);drawMapCircle({...king,r:16});g.setLineDash([]);
    }
    if(selected){
      const u=combat.units.find(u=>u.id===selected);
      if(u){g.strokeStyle='#e3fcac';g.fillStyle='rgba(216,255,150,.06)';g.lineWidth=1.3;drawMapCircle({...u,r:u.kind==='squad'?6:16});}
    }
    const characters=[];
    for(const u of combat.units){
      if(u.kind==='knight')characters.push({p:u,type:'knight',id:u.id});
      else{
        for(let i=0;i<5;i++){
          const row=Math.floor(i/3),col=i%3,spacing=.55;
          characters.push({p:{x:u.x+(col-1)*spacing,y:u.y+(row-.4)*spacing},type:'spearman',id:u.id+':'+i,flag:i===0});
        }
      }
    }
    characters.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
    withRenderContext(g,()=>{
      for(const soldier of characters){
        drawSoldierFigure(soldier.p,.08,soldier.type,soldier.id,State.clock.day);
        if(soldier.flag){
          const base=w2s(soldier.p,.08);
          g.strokeStyle='#5d4535';g.lineWidth=1.8;g.beginPath();
          g.moveTo(base.x+5,base.y-2);g.lineTo(base.x+5,base.y-27);g.stroke();
          g.fillStyle='#d6bd68';g.beginPath();g.moveTo(base.x+5,base.y-27);
          g.lineTo(base.x+19,base.y-24);g.lineTo(base.x+5,base.y-19);g.fill();
        }
      }
      for(const e of combat.enemy){
        if(!spotted(e,observers()))continue;
        drawSoldierFigure(e,.08,'spearman',e.id,State.clock.day);
        const p=w2s(e,.08);g.strokeStyle='#e45151';g.lineWidth=2;
        g.beginPath();g.arc(p.x,p.y-8,11,0,Math.PI*2);g.stroke();
      }
    });
    document.getElementById('combatSelection').textContent=selected?
      ((combat.units.find(u=>u.id===selected)?.kind==='squad'?'Pikemen ×5':'Knight')+' selected · click destination'):'Select a unit to move';
  }
  function issueMove(unit,p){
    if(unit.kind==='squad'){
      const knight=combat.units.find(u=>u.kind==='knight');
      if(!knight||dist(unit,knight)>16||dist(p,knight)>16){
        status('Out of knight command beacon (16U)');return;
      }
      if(dist(unit,p)>6){status('Sergeant order limit: maximum 6U per order');return}
    }
    unit.target=point(p.x,p.y);changed();
    status((unit.kind==='squad'?'Pikemen':'Knight')+' moving');
  }
  function tick(dt){
    if(!combat||!activeWell())return;
    let moved=false;
    for(const u of combat.units){
      if(!u.target)continue;
      const dx=u.target.x-u.x,dy=u.target.y-u.y,len=Math.hypot(dx,dy);
      if(len<.03){u.x=u.target.x;u.y=u.target.y;u.target=null;continue}
      const step=Math.min(len,dt*(u.kind==='knight'?1.5:.8));
      u.x+=dx/len*step;u.y+=dy/len*step;moved=true;
      if(step>=len-.03)u.target=null;
    }
    if(moved){visibilityDirty=true;maskDirty=true}
  }
  function paint(p,mode){
    const q=point(p.x,p.y),r=clamp(Number(combat.brushRadius)||5,1,16);
    if(lastPaint&&dist(lastPaint,q)>r*.55){
      const count=Math.ceil(dist(lastPaint,q)/(r*.45));
      for(let i=1;i<count;i++){
        const t=i/count;combat.strokes.push({x:lastPaint.x+(q.x-lastPaint.x)*t,y:lastPaint.y+(q.y-lastPaint.y)*t,r,mode});
      }
    }
    combat.strokes.push({x:q.x,y:q.y,r,mode});
    if(combat.strokes.length>2500)combat.strokes.splice(0,combat.strokes.length-2500);
    lastPaint=q;changed();
  }
  function handleDown(e){
    if(e.button!==0)return;
    const p=pointerWorld(e),kind=State.tool.kind;
    if(kind==='combat-brush'){
      e.preventDefault();e.stopImmediatePropagation();painting=true;lastPaint=null;
      canvas.setPointerCapture(e.pointerId);paint(p,State.tool.combatBrush);draw();return;
    }
    if(kind==='combat-intruder'){
      e.preventDefault();e.stopImmediatePropagation();
      combat.enemy.push({id:uid(),x:p.x,y:p.y});changed();setTool({kind:'select',label:'Select'});
      status('Test intruder placed — visible only within line of sight');draw();return;
    }
    if(kind==='combat-orders'||kind==='select'){
      const hit=combat.units.find(u=>dist(u,p)<2);
      if(hit){
        e.preventDefault();e.stopImmediatePropagation();selected=hit.id;
        setTool({kind:'combat-orders',label:'Orders: click destination'});
        syncButtons();draw();return;
      }
      if(kind==='combat-orders'&&selected){
        e.preventDefault();e.stopImmediatePropagation();
        const u=combat.units.find(u=>u.id===selected);if(u)issueMove(u,p);
        draw();return;
      }
    }
  }
  canvas.addEventListener('pointerdown',handleDown,true);
  canvas.addEventListener('pointermove',e=>{
    if(!painting)return;
    e.stopImmediatePropagation();e.preventDefault();paint(pointerWorld(e),State.tool.combatBrush);draw();
  },true);
  for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{
    if(!painting)return;
    painting=false;lastPaint=null;e.stopImmediatePropagation();scheduleLocalSave();draw();
  },true);
  const styles=document.createElement('style');
  styles.textContent='#combatCanvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4} #combatControls{border:1px solid #78634c;border-radius:10px;padding:9px;margin:8px 0;background:#211b15} #combatControls h3{margin:3px 0 8px} #combatControls .combat-row{display:flex;gap:4px;margin-bottom:5px} #combatControls button{font-size:11px;flex:1;padding:7px 4px} #combatControls .combat-row button.active{background:#f2c772;color:#20180c} #combatControls label{font-size:11px;display:flex;gap:8px;align-items:center} #combatControls input{flex:1;min-width:0} #combatAlarm[data-level=general]{color:#fc6868} #combatAlarm[data-level=local]{color:#efc06c}';
  document.head.appendChild(styles);
  const ui=document.createElement('div');
  ui.id='combatControls';
  ui.innerHTML='<h3>COMBAT · Fog / Command</h3>'+
    '<div class="combat-row"><button id="combatFog">Fog ON</button><button id="combatZones">Zones ON</button><button id="combatRecall">Recall civilians</button></div>'+
    '<div class="combat-row"><button data-combat-brush="allow">White +</button><button data-combat-brush="deny">White −</button><button data-combat-brush="yellow">Yellow</button><button data-combat-brush="green">Green</button></div>'+
    '<div class="combat-row"><button data-combat-brush="eraseYellow">− Yellow</button><button data-combat-brush="eraseGreen">− Green</button><button id="combatOrders">Orders</button></div>'+
    '<label>Brush radius <input id="combatBrushSize" type="range" min="1" max="16" value="5"><b id="combatBrushReadout">5U</b></label>'+
    '<div class="combat-row"><button id="combatIntruder">Test intruder</button><button id="combatClearEnemies">Clear intruders</button></div>'+
    '<div class="legend" id="combatSelection">Select a unit to move</div>'+
    '<div class="legend" id="combatAlarm" data-level="clear">No alert</div>';
  document.querySelector('#builder h2').insertAdjacentElement('afterend',ui);
  const $=id=>document.getElementById(id);
  function syncButtons(){
    if(!combat||!$('combatFog'))return;
    $('combatFog').textContent='Fog '+(combat.fog?'ON':'OFF');
    $('combatZones').textContent='Zones '+(combat.zones?'ON':'OFF');
    $('combatRecall').textContent=combat.recall?'Release civilians':'Recall civilians';
    $('combatBrushSize').value=combat.brushRadius;
    $('combatBrushReadout').textContent=combat.brushRadius+'U';
    document.querySelectorAll('[data-combat-brush]').forEach(b=>b.classList.toggle('active',State.tool.kind==='combat-brush'&&State.tool.combatBrush===b.dataset.combatBrush));
    $('combatOrders').classList.toggle('active',State.tool.kind==='combat-orders');
  }
  $('combatFog').onclick=()=>{combat.fog=!combat.fog;changed();draw()};
  $('combatZones').onclick=()=>{combat.zones=!combat.zones;changed();draw()};
  $('combatRecall').onclick=()=>{
    combat.recall=!combat.recall;recallStartedAt=performance.now()-50;
    changed();draw();
    if(combat.recall){
      if(transitionFrame)cancelAnimationFrame(transitionFrame);
      const animate=()=>{if(!combat.recall||performance.now()-recallStartedAt>=2500){transitionFrame=0;return}draw();transitionFrame=requestAnimationFrame(animate)};
      transitionFrame=requestAnimationFrame(animate);
    }
    status(combat.recall?'Civilian recall to green zone activated':'Civilian recall released');
  };
  document.querySelectorAll('[data-combat-brush]').forEach(b=>b.onclick=()=>{
    setTool({kind:'combat-brush',combatBrush:b.dataset.combatBrush,label:'Brush: '+b.textContent});
    syncButtons();
  });
  $('combatBrushSize').oninput=e=>{combat.brushRadius=Number(e.target.value);changed();draw()};
  $('combatOrders').onclick=()=>{setTool({kind:'combat-orders',label:'Click knight or pikemen squad, then click target'});syncButtons()};
  $('combatIntruder').onclick=()=>{setTool({kind:'combat-intruder',label:'Click terrain to position a test enemy'});syncButtons()};
  $('combatClearEnemies').onclick=()=>{combat.enemy=[];changed();alertState='clear';draw()};
  const priorDraw=draw;
  draw=function(){priorDraw();renderOverlay()};
  const initial=State.combat;restore(initial);
  window.ConquerCombat={tick,serialize,restore,civilPosition,areaState,sourceSees,observers,visibilityAt:p=>spotted(p,observers()),refresh:()=>{visibilityDirty=true;draw()}};
  draw();
})();