'use strict';
// Combat presentation only: tactical sprites, selection, HUD, and effects.
// Rules remain independent of canvas and receive no renderer dependencies.
(function(){
  function drawMapCircle(g,c,strokeOnly=false){
    const steps=48;
    g.beginPath();
    for(let i=0;i<=steps;i++){
      const a=i*Math.PI*2/steps,p=w2sRaw({x:c.x+Math.cos(a)*c.r,y:c.y+Math.sin(a)*c.r},Number.isFinite(c.groundZ)?c.groundZ:0);
      if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
    }
    g.closePath();
    if(!strokeOnly)g.fill();g.stroke();
  }


  function drawEffects(g,project,effects){
    if(!effects)return;
    const {shots,meleeFlashes,elapsed}=effects;
    g.save();
    for(const p of shots){
      const t=Math.min(1,(elapsed-p.start)/p.duration);
      const rise=Math.sin(Math.PI*t)*Math.min(3,Math.hypot(p.to.x-p.from.x,p.to.y-p.from.y)*.20);
      const x=p.from.x+(p.to.x-p.from.x)*t,y=p.from.y+(p.to.y-p.from.y)*t;
      const z=p.from.z+(p.to.z-p.from.z)*t+rise;
      const pos=project({x,y},z);
      const end=project({x:p.from.x+(p.to.x-p.from.x)*Math.min(1,t+.045),y:p.from.y+(p.to.y-p.from.y)*Math.min(1,t+.045)},
        p.from.z+(p.to.z-p.from.z)*Math.min(1,t+.045)+Math.sin(Math.PI*Math.min(1,t+.045))*Math.min(3,Math.hypot(p.to.x-p.from.x,p.to.y-p.from.y)*.20));
      g.strokeStyle='#d7c6a1';g.lineWidth=2;g.beginPath();g.moveTo(pos.x,pos.y);g.lineTo(end.x,end.y);g.stroke();
    }
    for(const f of meleeFlashes){
      const age=(elapsed-f.at)/.65,at=project(f,.16);
      g.globalAlpha=Math.max(0,1-age);g.strokeStyle='#f3dcc0';g.lineWidth=1.8;
      g.beginPath();g.moveTo(at.x-5,at.y-11-age*5);g.lineTo(at.x+6,at.y-3-age*5);g.stroke();
    }
    g.restore();
  }

  function renderOverlay({combat,selected,canvasLayer,g,activeWell,refreshFog,renderTacticalBackdrop,observers,spotted}){
    if(!combat)return;
    const overlayStart=performance.now();
    const rect=wrap.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);
    if(canvasLayer.width!==Math.round(rect.width*d)||canvasLayer.height!==Math.round(rect.height*d)){
      canvasLayer.width=Math.round(rect.width*d);canvasLayer.height=Math.round(rect.height*d);
    }
    g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,rect.width,rect.height);
    if(activeWell())refreshFog();
    renderTacticalBackdrop(d);
    if(!activeWell())return;
    const king=combat.units.find(u=>u.kind==='knight');
    if(king){
      g.strokeStyle='rgba(255,211,116,.78)';g.lineWidth=1.5;
      g.setLineDash([6,5]);drawMapCircle(g,{...king,r:16,groundZ:terrainElevation(king)},true);g.setLineDash([]);
    }
    if(selected){
      const u=combat.units.find(u=>u.id===selected);
      if(u){g.strokeStyle='#e3fcac';g.lineWidth=1.3;g.setLineDash([4,4]);drawMapCircle(g,{...u,r:u.kind==='squad'?6:16,groundZ:terrainElevation(u)},true);g.setLineDash([]);}
    }
    const characters=[];
    for(const u of combat.units){
      if(u.kind==='knight'&&!u.defeated)characters.push({p:u,type:'knight',id:u.id,unit:u});
      else{
        if(u.defeated)continue;
        const count=u.kind==='patrol'?2:5;
        for(let i=0;i<count;i++){
          const row=Math.floor(i/3),col=i%3,spacing=.55;
          const offset=count===2?(i?spacing/2:-spacing/2):(col-1)*spacing;
          characters.push({p:{x:u.x+offset,y:u.y+(row-.4)*spacing},type:'spearman',id:u.id+':'+i,flag:u.kind==='squad'&&i===0,unit:u,index:i});
        }
      }
    }
    characters.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
    const sightSources=combat.enemy.length?observers():null;
    withRenderContext(g,()=>{
      for(const soldier of characters){
        drawSoldierFigure(soldier.p,.08,soldier.type,soldier.id,State.clock.day);
        if(soldier.type==='spearman'&&soldier.unit.engaged){
          const target=combat.enemy.filter(e=>!e.defeated&&e.stats?.hp>0)
            .sort((a,b)=>dist(a,soldier.unit)-dist(b,soldier.unit))[0];
          if(target&&dist(target,soldier.unit)<1){
            const base=w2s(soldier.p,.24),end=w2s(target,.45);
            const pulse=(Math.sin((window.ConquerCombatRules?.time||0)*Math.PI*3+soldier.index*1.2)+1)/2;
            g.strokeStyle='#c9c6b4';g.lineWidth=Math.max(.75,1.25*State.view.scale);
            g.beginPath();g.moveTo(base.x,base.y-8);
            g.lineTo(base.x+(end.x-base.x)*(.25+.7*pulse),base.y-8+(end.y-base.y-8)*(.25+.7*pulse));g.stroke();
          }
        }
        if(soldier.flag){
          const base=w2s(soldier.p,.08);
          g.strokeStyle='#5d4535';g.lineWidth=1.8;g.beginPath();
          g.moveTo(base.x+5,base.y-2);g.lineTo(base.x+5,base.y-27);g.stroke();
          g.fillStyle='#d6bd68';g.beginPath();g.moveTo(base.x+5,base.y-27);
          g.lineTo(base.x+19,base.y-24);g.lineTo(base.x+5,base.y-19);g.fill();
        }
      }
      for(const e of combat.enemy){
        if(e.defeated||e.stats?.hp<=0||!spotted(e,sightSources))continue;
        const livery=window.ConquerCombatRules?.liveryOf(e.faction||'dev_hostile');
        drawSoldierFigure(e,.08,'spearman',e.id,State.clock.day,livery);
        const p=w2s(e,.08);g.strokeStyle='#e45151';g.lineWidth=2;
        g.beginPath();g.arc(p.x,p.y-8,11,0,Math.PI*2);g.stroke();
      }
    });
    drawEffects(g,(p,z)=>w2sRaw(p,z),window.ConquerCombatRules?.visualEffects?.());
    const focused=combat.units.find(u=>u.id===selected);
    document.getElementById('combatSelection').textContent=selected?
      ((focused?.kind==='squad'?'Pikemen ×5':focused?.kind==='patrol'?'Patrol ×2':'Knight')+' selected · click destination'):'Select a unit to move';
    const panel=document.getElementById('combatStats');
    if(panel){
      const hp=x=>x?.stats?Math.max(0,Math.round(x.stats.hp))+'/'+x.stats.maxHp:'—';
      const brain=x=>x?.stats?Math.round(x.stats.brain):'—';
      const allies=combat.units.filter(u=>!u.defeated),hostiles=combat.enemy.filter(e=>!e.defeated);
      panel.textContent='Units '+allies.length+' / Hostiles '+hostiles.length+
        (focused?' · HP '+hp(focused)+' · B '+brain(focused):'')+
        (combat.enemy.length?' · Enemy HP '+hp(combat.enemy[0]):'');
    }
    const overlayMs=performance.now()-overlayStart;
    if(window.__conquerPerf)window.__conquerPerf.combatOverlayMs=overlayMs;
    if(overlayMs>25)window.__conquerAnalytics?.event('COMBAT_OVERLAY_SLOW',{ms:+overlayMs.toFixed(1),units:combat.units.length,enemies:combat.enemy.length},'warn',3000);
  }

  window.ConquerCombatRenderer={renderOverlay};
})();
