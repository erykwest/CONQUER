'use strict';
// Combat presentation: canvases, fog/zone masks, figures, HUD and visual effects.
// Consumes current domain state; never advances combat or writes persistent units.
(function(){
  function drawEffects(g,project,effects){
    if(!effects)return;
    const {shots,stones,meleeFlashes,elapsed}=effects;
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
    for(const s of stones){
      // Falls with gravity from the gallery; a puff where it lands.
      const t=Math.min(1,(elapsed-s.start)/s.duration),k=t*t;
      const at=project({x:s.from.x+(s.to.x-s.from.x)*t,y:s.from.y+(s.to.y-s.from.y)*t},s.from.z+(s.to.z-s.from.z)*k);
      if(t<1){g.globalAlpha=1;g.fillStyle='#8e877c';g.strokeStyle='#4a453f';g.lineWidth=1;g.beginPath();g.arc(at.x,at.y,3.2,0,Math.PI*2);g.fill();g.stroke()}
      else{const age=(elapsed-s.start-s.duration)/.25;g.globalAlpha=Math.max(0,.6-age*.6);g.fillStyle='#c9bda7';g.beginPath();g.arc(at.x,at.y,4+age*6,0,Math.PI*2);g.fill();g.globalAlpha=1}
    }
    for(const f of meleeFlashes){
      const age=(elapsed-f.at)/.65,at=project(f,.16);
      g.globalAlpha=Math.max(0,1-age);g.strokeStyle='#f3dcc0';g.lineWidth=1.8;
      g.beginPath();g.moveTo(at.x-5,at.y-11-age*5);g.lineTo(at.x+6,at.y-3-age*5);g.stroke();
    }
    g.restore();
  }
  function create({worldSize,visionSize,readState,activeWell,refreshFog,circles,observers,spotted,wallWalk}){
  const WORLD=worldSize,N=visionSize,WW=wallWalk;
  const COLORS={allow:'#ddd8bf',yellow:'#e6b845',green:'#65bc83'};
  let combat=null,selected=null,selectedIds=null,selectionDrag=null;
  const canvasLayer=document.createElement('canvas');
  canvasLayer.id='combatCanvas';
  canvasLayer.setAttribute('aria-hidden','true');
  wrap.appendChild(canvasLayer);
  const g=canvasLayer.getContext('2d');
  const fog=document.createElement('canvas');fog.width=N;fog.height=N;
  const fogCtx=fog.getContext('2d');
  // Masks are raster unions of auto-generated regions and manual brush marks.
  // They are projected as a single surface per color: no overlapping circle
  // outlines, no doubling alpha, and subtractive strokes cut real holes.
  // Double the mask resolution for smoothly projected union borders.
  // Fog retains its lightweight coarse grid; only zone masks are detailed.
  const ZONE_PIXELS=8, ZONE_SIZE=WORLD*ZONE_PIXELS;
  const zoneImages={};
  for(const mode of ['allow','yellow','green']){
    const surface=document.createElement('canvas'),outline=document.createElement('canvas');
    surface.width=outline.width=ZONE_SIZE;surface.height=outline.height=ZONE_SIZE;
    zoneImages[mode]={surface,outline,ctx:surface.getContext('2d'),outlineCtx:outline.getContext('2d')};
  }
  let zoneSignature='',zoneRevision=0,fogRevision=0;
  // Render static FoW + merged brush masks once into a shared atlas rather
  // than drawing seven large bitmaps into the isometric screen every frame.
  const backdrop=document.createElement('canvas');
  backdrop.width=backdrop.height=ZONE_SIZE;
  const backdropCtx=backdrop.getContext('2d');
  let backdropSignature='';
  function paintFogBitmap(memory,visible){
    const image=fogCtx.createImageData(N,N);
    for(let i=0;i<visible.length;i++){
      const k=i*4,a=visible[i]?0:memory[i]?158:232;
      image.data[k]=8;image.data[k+1]=12;image.data[k+2]=16;image.data[k+3]=a;
    }
    fogCtx.putImageData(image,0,0);
    fogRevision++;
  }
  function drawMapCircle(c,strokeOnly=false){
    const steps=48;
    g.beginPath();
    for(let i=0;i<=steps;i++){
      const a=i*Math.PI*2/steps,p=w2sRaw({x:c.x+Math.cos(a)*c.r,y:c.y+Math.sin(a)*c.r},Number.isFinite(c.groundZ)?c.groundZ:0);
      if(i===0)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);
    }
    g.closePath();
    if(!strokeOnly)g.fill();g.stroke();
  }

  function updateZoneUnion(){
    const automatic=circles(),brushes=combat.strokes;
    const signature=automatic.map(c=>[c.x,c.y,c.r,c.mode,c.id].join(':')).join('|')+
      '|brush:'+brushes.length+':'+(brushes.at(-1)?Object.values(brushes.at(-1)).join(':'):'');
    if(signature===zoneSignature)return;
    zoneSignature=signature;zoneRevision++;
    for(const region of Object.values(zoneImages)){
      region.ctx.clearRect(0,0,ZONE_SIZE,ZONE_SIZE);
      region.ctx.globalCompositeOperation='source-over';
    }
    for(const stroke of automatic.concat(brushes)){
      const type=stroke.mode;
      const erase=type==='deny'||type==='eraseYellow'||type==='eraseGreen';
      const layer=erase?(type==='deny'?'allow':type==='eraseYellow'?'yellow':'green'):type;
      const region=zoneImages[layer];if(!region)continue;
      const z=region.ctx;z.globalCompositeOperation=erase?'destination-out':'source-over';
      z.fillStyle=erase?'#000':COLORS[layer];
      z.beginPath();z.arc(stroke.x*ZONE_PIXELS,stroke.y*ZONE_PIXELS,stroke.r*ZONE_PIXELS,0,Math.PI*2);z.fill();
    }
    for(const {surface,ctx,outlineCtx} of Object.values(zoneImages)){
      ctx.globalCompositeOperation='source-over';
      outlineCtx.clearRect(0,0,ZONE_SIZE,ZONE_SIZE);
      for(const [x,y] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){
        outlineCtx.drawImage(surface,x,y);
      }
      outlineCtx.globalCompositeOperation='destination-out';
      outlineCtx.drawImage(surface,0,0);
      outlineCtx.globalCompositeOperation='source-over';
    }
  }
  function renderTacticalBackdrop(pixelRatio){
    if(combat.zones&&activeWell())updateZoneUnion();
    const signature=(combat.fog?fogRevision:'off')+'|'+(combat.zones?zoneRevision:'off')+
      '|'+!!activeWell();
    if(signature!==backdropSignature){
      backdropSignature=signature;
      const c=backdropCtx,t0=performance.now();
      c.setTransform(1,0,0,1,0,0);
      c.clearRect(0,0,ZONE_SIZE,ZONE_SIZE);
      if(combat.fog){
        c.imageSmoothingEnabled=false;
        c.globalAlpha=1;
        c.drawImage(fog,0,0,ZONE_SIZE,ZONE_SIZE);
      }
      if(combat.zones&&activeWell()){
        c.imageSmoothingEnabled=true;
        c.imageSmoothingQuality='high';
        for(const mode of ['allow','yellow','green']){
          const mask=zoneImages[mode];
          c.globalAlpha=mode==='allow'?.055:mode==='yellow'?.07:.10;
          c.drawImage(mask.surface,0,0);
          c.globalAlpha=.85;
          c.drawImage(mask.outline,0,0);
        }
      }
      c.globalAlpha=1;
      const ms=performance.now()-t0;
      if(window.__conquerPerf)window.__conquerPerf.combatBackdropMs=ms;
      if(ms>30)window.__conquerAnalytics?.event('COMBAT_BACKDROP_SLOW',{ms:+ms.toFixed(1)},'warn',3000);
    }
    if(!combat.fog&&!combat.zones)return;
    const a=w2sRaw({x:0,y:0},0),bx=w2sRaw({x:1/ZONE_PIXELS,y:0},0),by=w2sRaw({x:0,y:1/ZONE_PIXELS},0);
    g.save();
    g.setTransform(pixelRatio*(bx.x-a.x),pixelRatio*(bx.y-a.y),pixelRatio*(by.x-a.x),pixelRatio*(by.y-a.y),pixelRatio*a.x,pixelRatio*a.y);
    g.imageSmoothingEnabled=true;
    g.imageSmoothingQuality='high';
    g.drawImage(backdrop,0,0);
    g.restore();
  }
  // Infantry standards use the same campaign heraldry raster as tower flags,
  // not a separately generated unit emblem.
  function drawSquadStandard(p,id,z=.08){
    const base=w2s(p,z),scale=clamp(State.view.scale,.55,1.45);
    const mastX=base.x+5*scale,mastTop=base.y-36*scale;
    const width=14*scale,height=19*scale;
    const wave=Math.sin(visualCycleDay()*18+(peasantHash(id)%1000)*.00628)*1.1*scale;
    const topLeft={x:mastX,y:mastTop+2*scale};
    const topRight={x:mastX+width,y:topLeft.y+wave};
    const bottomRight={x:topRight.x,y:topRight.y+height};
    const bottomLeft={x:topLeft.x,y:topLeft.y+height};
    g.save();
    g.strokeStyle='#705038';g.lineWidth=Math.max(1,1.5*scale);
    g.beginPath();g.moveTo(mastX,base.y-2*scale);g.lineTo(mastX,mastTop);g.stroke();
    g.save();
    g.beginPath();g.moveTo(topLeft.x,topLeft.y);g.lineTo(topRight.x,topRight.y);
    g.lineTo(bottomRight.x,bottomRight.y);g.lineTo(bottomLeft.x,bottomLeft.y);
    g.closePath();g.clip();
    const herald=State.heraldry||{};
    if(!window.__conquerHeraldryCanvas?.paint(g,topLeft.x,Math.min(topLeft.y,topRight.y),width,height+Math.abs(wave))){
      g.fillStyle=herald.c1||REIGN_COLOR_1;
      g.fillRect(topLeft.x,topLeft.y,width,height+Math.abs(wave));
      g.fillStyle=herald.c2||REIGN_COLOR_2;
      g.fillRect(topLeft.x+width/2,topLeft.y,width/2,height+Math.abs(wave));
    }
    g.restore();
    g.strokeStyle='#e0d3b1';g.lineWidth=Math.max(.7,.85*scale);
    g.beginPath();g.moveTo(topLeft.x,topLeft.y);g.lineTo(topRight.x,topRight.y);
    g.lineTo(bottomRight.x,bottomRight.y);g.lineTo(bottomLeft.x,bottomLeft.y);
    g.closePath();g.stroke();
    g.fillStyle='#c6a461';g.beginPath();g.arc(mastX,mastTop,Math.max(1,1.1*scale),0,Math.PI*2);g.fill();
    g.restore();
  }
  // One torch-bearer per two-man patrol: the light is held above the leading
  // soldier's right hand, rather than being a stationary world fixture.
  function drawPatrolTorch(p,id,z=.08){
    const base=w2s(p,z),figureScale=militaryScale();
    const scale=clamp(State.view.scale*.72,.45,1.5);
    const grip={x:base.x+5.4*figureScale*.55,y:base.y-1.25*figureScale};
    const tip={x:grip.x+1.2*figureScale,y:grip.y-15*figureScale};
    g.save();
    g.strokeStyle='#63472d';g.lineWidth=Math.max(1,1.65*figureScale);
    g.beginPath();g.moveTo(grip.x,grip.y);g.lineTo(tip.x,tip.y);g.stroke();
    g.fillStyle='#49372b';g.fillRect(tip.x-1.8*figureScale,tip.y-1.5*figureScale,3.6*figureScale,3*figureScale);
    const glow=g.createRadialGradient(tip.x,tip.y,0,tip.x,tip.y,9*scale);
    glow.addColorStop(0,'rgba(255,189,79,.48)');
    glow.addColorStop(.5,'rgba(247,134,40,.21)');
    glow.addColorStop(1,'rgba(247,134,40,0)');
    g.globalCompositeOperation='screen';g.fillStyle=glow;
    g.beginPath();g.arc(tip.x,tip.y,9*scale,0,Math.PI*2);g.fill();
    g.restore();
    drawScreenFlame(tip,scale,id+':patrol-hand-torch');
  }
  function drawPosedFigure(p,type,id,livery,unit,index=0,z=.08){
    const anim=window.ConquerCombatAnim;
    if(!anim)return drawSoldierFigure(p,z,type,id,State.clock.day,livery);
    // Facing only needs the flat projection; terrain-aware w2s is costly per figure.
    const foe=anim.foeOf(unit);
    const pose=anim.pose(unit,index||0,w2sRaw(p,0),foe?w2sRaw(foe,0):null);
    if(type==='knight'&&drawMountedKnight(p,id,livery,unit,pose,foe,z))return;
    // The captain commands on foot, drawn as the knight figure.
    if(type==='captain')return anim.drawFigure(p,z,'knight',id,State.clock.day,livery,pose);
    anim.drawFigure(p,z,type,id,State.clock.day,livery,pose);
  }
  // Knights ride (settlement-mounted2d.js): the flat 2D horse with caparison, lance
  // and shield in the realm's arms, in the foot soldiers' style. Heading follows the
  // path, then the foe (the figure faces left or right on screen); the gait follows
  // movement (a charge when moving engaged).
  const riders=new WeakMap(),HORSE_COATS=['brown','black','grey','white'];
  function drawMountedKnight(p,id,livery,unit,pose,foe,z=.08){
    const M2=window.ConquerMounted2D;
    if(!M2||!window.ConquerAnimals||window.ConquerLOD?.militaryTier()==='dot')return false;
    let r=riders.get(unit);
    // Start in a three-quarter view rather than facing the camera head-on.
    if(!r){r={heading:Math.PI/4+1.05,t:0,last:performance.now()/1000};riders.set(unit,r)}
    const now=performance.now()/1000,dt=Math.min(.1,Math.max(0,now-r.last));r.last=now;
    const next=unit.path?.[unit.pathIndex],moving=!!next&&!unit.defeated&&State.clock.speed>0;
    const aim=moving?next:foe&&!foe.defeated?foe:null;
    if(aim&&Math.hypot(aim.x-unit.x,aim.y-unit.y)>.05){
      const want=Math.atan2(aim.y-unit.y,aim.x-unit.x),d=Math.atan2(Math.sin(want-r.heading),Math.cos(want-r.heading));
      r.heading+=d*Math.min(1,dt*6);
    }
    const mode=moving?(unit.engaged?'run':'walk'):'idle';
    if(mode!==r.mode){r.from=r.mode||mode;r.mode=mode;r.blend=0}
    r.blend=Math.min(1,(r.blend??1)+dt/.45);r.t+=dt*(moving?Math.min(2,.6+State.clock.speed*.1):1);
    const paint=livery?null:window.__conquerHeraldryCanvas?.paint;
    const a=w2sRaw(p,0),b=w2sRaw({x:p.x+Math.cos(r.heading),y:p.y+Math.sin(r.heading)},0);
    withUrbanFigureOcclusion(p,z,()=>{
      const s=w2s(p,z);
      M2.draw(ctx,s.x,s.y,Math.max(1.5,State.view.scale*5.75),{kind:'knight',facing:b.x>=a.x?1:-1,
        mode:r.mode,from:r.from,blend:r.blend,t:r.t,seed:peasantHash(id)%7,coat:HORSE_COATS[peasantHash(id)%7%4],
        pose,livery:livery||soldierLivery(id),paint});
    });
    return true;
  }
  function renderOverlay(){
    ({combat,selected,selectedIds,selectionDrag}=readState());
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
    const captain=combat.units.find(u=>u.kind==='captain');
    for(const u of combat.units){
      if(!selectedIds.has(u.id)||u.defeated||u.campState)continue;
      g.strokeStyle=u.kind==='captain'?'rgba(255,211,116,.86)':'#e3fcac';
      g.lineWidth=1.5;g.setLineDash([5,4]);
      drawMapCircle({...u,r:u.kind==='captain'?16:6,groundZ:terrainElevation(u)+(u.z||0)},true);
      g.setLineDash([]);
    }
    window.ConquerCamp?.drawEncampments(g);
    const anim=window.ConquerCombatAnim;
    const characters=[];
    for(const u of combat.units){
      if(u.campState==='barracks')continue;
      // Defeated units stay on screen while their fall animation plays.
      if(u.defeated&&!anim?.dying(u))continue;
      const z=.08+(u.z||0);
      if(u.campState==='camped'&&!u.defeated){
        // Preserve the cavalry figure for a lone knight; larger formations
        // leave just one visible sentry while the remainder rests in tents.
        const soloKnight=u.kind==='knight'||u.kind==='captain';
        characters.push({p:soloKnight?u:{x:u.x+.15,y:u.y+.85},
          type:soloKnight?u.kind:'spearman',id:u.id+':camp-guard',unit:u,index:0,z:.08});
        continue;
      }
      if(u.kind==='knight'||u.kind==='captain')characters.push({p:u,type:u.kind,id:u.id,unit:u,z});
      else if(u.kind==='archer'||u.kind==='infantry')characters.push({p:u,type:u.kind==='archer'?'archer':'spearman',id:u.id,unit:u,z});
      else{
        const count=u.kind==='patrol'?2:5;
        // On a wall walk the men stand in file along the wall.
        const f=!u.climbing&&u.wall?WW()?.frame(u.wall):null;
        for(let i=0;i<count;i++){
          let p;
          if(f){const o=(i-(count-1)/2)*.42;p={x:u.x+f.ux*o,y:u.y+f.uy*o}}
          else{
            const row=Math.floor(i/3),col=i%3,spacing=.55;
            const offset=count===2?(i?spacing/2:-spacing/2):(col-1)*spacing;
            p={x:u.x+offset,y:u.y+(row-.4)*spacing};
          }
          const torch=u.kind==='patrol'&&i===0&&window.ConquerCamp?.isNight();
          characters.push({p,type:torch?'unarmed':'spearman',id:u.id+':'+i,
            flag:u.kind==='squad'&&i===0,torch,unit:u,index:i,z});
        }
      }
    }
    characters.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
    const sightSources=combat.enemy.length?observers():null;
    withRenderContext(g,()=>{
      for(const soldier of characters){
        drawPosedFigure(soldier.p,soldier.type,soldier.id,null,soldier.unit,soldier.index,soldier.z);
        if(soldier.unit.defeated)continue;
        // Without the combat animations, a spear thrust line still shows engagement.
        if(!anim&&soldier.type==='spearman'&&soldier.unit.engaged){
          const target=combat.enemy.filter(e=>!e.neutral&&!e.defeated&&e.stats?.hp>0)
            .sort((a,b)=>dist(a,soldier.unit)-dist(b,soldier.unit))[0];
          if(target&&dist(target,soldier.unit)<1){
            const base=w2s(soldier.p,.24),end=w2s(target,.45);
            const pulse=(Math.sin((window.ConquerCombatRules?.time||0)*Math.PI*3+soldier.index*1.2)+1)/2;
            g.strokeStyle='#c9c6b4';g.lineWidth=Math.max(.75,1.25*State.view.scale);
            g.beginPath();g.moveTo(base.x,base.y-8);
            g.lineTo(base.x+(end.x-base.x)*(.25+.7*pulse),base.y-8+(end.y-base.y-8)*(.25+.7*pulse));g.stroke();
          }
        }
        if(soldier.flag)withUrbanFigureOcclusion(soldier.p,soldier.z,()=>
          drawSquadStandard(soldier.p,soldier.unit.id,soldier.z));
        if(soldier.torch)withUrbanFigureOcclusion(soldier.p,soldier.z,()=>
          drawPatrolTorch(soldier.p,soldier.id,soldier.z));
      }
      for(const e of combat.enemy){
        const down=e.defeated||e.stats?.hp<=0;
        if(down&&!anim?.dying(e))continue;
        if(e.kind==='wolf'){
          // Wildlife remains a visible neutral creature by day; at night the
          // exact same entity is rendered while its combat flag turns hostile.
          if(!down&&(!combat.fog||spotted(e,sightSources)))window.ConquerWolves?.draw(g,e);
          continue;
        }
        if(!spotted(e,sightSources))continue;
        const livery=window.ConquerCombatRules?.liveryOf(e.faction||'dev_hostile');
        const figure=e.kind==='knight'||e.combatKind==='knight'?'knight':e.kind==='archer'||e.combatKind==='archer'?'archer':'spearman';
        drawPosedFigure(e,figure,e.id,livery,e,0,.08+(e.z||0));
        if(down)continue;
        if(e.torch)window.ConquerFire?.drawTorch(g,w2s(e,.08+(e.z||0)),State.view.scale,e.id);
        const p=w2s(e,.08+(e.z||0));g.strokeStyle='#e45151';g.lineWidth=2;
        g.beginPath();g.arc(p.x,p.y-8,11,0,Math.PI*2);g.stroke();
      }
    });
    // Paused swings/falls share the simulation's visual scheduler with fire,
    // collapses and scene requests, avoiding a second draw in the same RAF.
    // 2.5D view: assault ladders and towers as simple timber outlines (3D draws the models).
    if(combat.storms?.length&&!window.ConquerWorld3D?.active?.())withRenderContext(g,()=>{
      for(const s of combat.storms){
        if(s.kind==='ram'){
          if(s.done)continue;
          const a=w2s(s.foot,0),b=w2s(s.origin,.35);g.strokeStyle='#6b4a2c';g.lineWidth=12;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();continue;
        }
        if(s.kind==='keep'){
          if(s.done)continue;
          const keep=State.structures.find(x=>x.id===s.towerId),lg=keep&&window.ConquerKeepEntrance?.ladderGeom(keep);if(!lg)continue;
          const a=w2sRaw(lg.base,lg.zBase),b=w2sRaw(lg.top,lg.zTop+.12);
          g.strokeStyle='#7a5530';g.lineWidth=3;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();continue;
        }
        const ww=WW(),top=ww?.at({wallId:s.wallId,t:s.t});if(!top)continue;
        const a=w2s(s.foot,0),b=w2s(top,top.z+.15);
        g.strokeStyle='#7a5530';g.lineWidth=s.kind==='ladder'?3:9;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
      }
    });
    drawEffects(g,(p,z)=>w2sRaw(p,z),window.ConquerCombatRules?.visualEffects?.());
    window.ConquerDiplomacy?.draw(g);
    window.ConquerSoldiers?.draw(g);   // outpost relay riders and burning signal fires
    const focused=combat.units.find(u=>u.id===selected);
    // The Builder layout may be replaced by another UI shell. Missing optional
    // HUD controls must never interrupt render/simulation or the combat canvas.
    const selectionLabel=document.getElementById('combatSelection');
    if(selectionLabel)selectionLabel.textContent=selectedIds.size>1
      ?selectedIds.size+' units selected · click destination / Shift to add'
      :selected?((focused?.kind==='squad'?'Pikemen ×5':focused?.kind==='patrol'?'Patrol':focused?.kind==='captain'?'Captain':'Knight')+' selected · click destination')
      :'Select units · drag a box, Shift+click to add';
    const panel=document.getElementById('combatStats');
    if(panel){
      const hp=x=>x?.stats?Math.max(0,Math.round(x.stats.hp))+'/'+x.stats.maxHp:'—';
      const brain=x=>x?.stats?Math.round(x.stats.brain):'—';
      const allies=combat.units.filter(u=>!u.defeated),hostiles=combat.enemy.filter(e=>!e.defeated);
      panel.textContent='Units '+allies.length+' / Hostiles '+hostiles.length+
        (focused?' · HP '+hp(focused)+' · B '+brain(focused):'')+
        (combat.enemy.length?' · Enemy HP '+hp(combat.enemy[0]):'');
    }
    if(selectionDrag){
      const {start,end}=selectionDrag;
      g.save();g.fillStyle='rgba(198,232,155,.13)';g.strokeStyle='#dcf6ab';g.lineWidth=1.2;
      g.setLineDash([5,3]);g.fillRect(start.x,start.y,end.x-start.x,end.y-start.y);
      g.strokeRect(start.x,start.y,end.x-start.x,end.y-start.y);g.restore();
    }
    const overlayMs=performance.now()-overlayStart;
    if(window.__conquerPerf)window.__conquerPerf.combatOverlayMs=overlayMs;
    if(overlayMs>25)window.__conquerAnalytics?.event('COMBAT_OVERLAY_SLOW',{ms:+overlayMs.toFixed(1),units:combat.units.length,enemies:combat.enemy.length},'warn',3000);
  }
  function reset(){zoneSignature='';backdropSignature=''}
  return{renderOverlay,paintFogBitmap,reset};
  }
  window.ConquerCombatRenderer={create,drawEffects};
})();
