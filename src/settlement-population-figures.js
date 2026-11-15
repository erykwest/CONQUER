'use strict';
// Civilian and military figure drawing and culling. Extracted verbatim from settlement-population.js.
function bodyPath(kind,x,y,w,h){
  ctx.beginPath();
  if(kind==='peasant'){
    ctx.moveTo(x,y-h/2);ctx.lineTo(x+w/2,y+h/2);ctx.lineTo(x-w/2,y+h/2);ctx.closePath();
  }else if(kind==='artisan'){
    ctx.rect(x-w/2,y-h/2,w,h);
  }else if(kind==='merchant'){
    ctx.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);
  }else{
    const r=Math.min(w,h)/2;ctx.arc(x,y,r,0,Math.PI*2);
  }
}
function drawSplitVillagerBody(kind,x,y,w,h,topColor,bottomColor){
  ctx.save();
  bodyPath(kind,x,y,w,h);ctx.clip();
  ctx.fillStyle=topColor;ctx.fillRect(x-w,y-h,x+w*2,h);
  ctx.fillStyle=bottomColor;ctx.fillRect(x-w,y,x+w*2,h);
  ctx.restore();

  bodyPath(kind,x,y,w,h);
  ctx.strokeStyle='rgba(33,24,16,.82)';ctx.lineWidth=Math.max(.7,w*.11);ctx.stroke();

  ctx.save();bodyPath(kind,x,y,w,h);ctx.clip();
  ctx.strokeStyle='rgba(33,24,16,.42)';ctx.lineWidth=Math.max(.55,w*.075);
  ctx.beginPath();ctx.moveTo(x-w/2,y);ctx.lineTo(x+w/2,y);ctx.stroke();
  ctx.restore();
}
function drawVillagerHead(id,x,y,r,sex='male',cachedHair=null){
  const hair=cachedHair||villagerHair(id);
  ctx.save();
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();

  if(hair!=='bald'){
    const hc=HAIR_COLORS[hair];
    ctx.beginPath();ctx.arc(x,y,r,Math.PI,Math.PI*2);ctx.lineTo(x-r,y);ctx.closePath();
    ctx.fillStyle=hc;ctx.fill();

    // Female adults/girls keep the same deterministic hair colour but get visible side locks.
    if(sex==='female'){
      ctx.fillStyle=hc;
      ctx.beginPath();ctx.ellipse(x-r*.72,y+r*.48,r*.34,r*.80,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+r*.72,y+r*.48,r*.34,r*.80,0,0,Math.PI*2);ctx.fill();
    }
  }

  ctx.strokeStyle='rgba(67,42,30,.80)';ctx.lineWidth=Math.max(.65,r*.20);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
const samePoint=(a,b)=>!!a&&!!b&&Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)<1e-6;
// Everything that changes how a villager looks (not where): the key of its 3D figure tile.
function villagerLookKey(dot){
  const outfit=window.ConquerWardrobe?.outfitFor(dot);
  return [dot.kind,dot.age,dot.sex,dot.hair||villagerHair(dot.id),(dot.colors||[]).join(','),outfit?JSON.stringify(outfit):''].join('|');
}
function drawVillagerFigure(dot){
  // WebGL: a depth-tested card (settlement-world3d.js figure()), so ships and walls in front hide it.
  if(window.ConquerWorld3D?.figure?.(dot.p,.10,'v|'+villagerLookKey(dot),()=>drawVillagerFigureUnmasked({...dot,p:{x:0,y:0}}),dot.id))return true;
  return withUrbanFigureOcclusion(dot.p,.10,()=>drawVillagerFigureUnmasked(dot));
}
function drawVillagerFigureUnmasked(dot){
  const base=w2s(dot.p,.10),scale=State.view.scale*.5;
  const kind=dot.kind,sizeFactor=dot.age==='child'?.5:1;
  const bodyW=6.0*scale*sizeFactor,bodyH=8.0*scale*sizeFactor;
  const headR=2.35*scale*sizeFactor,bodyY=base.y-bodyH*.16,headY=bodyY-bodyH/2-headR*.68;
  // Seasonal wardrobe overlays (cloak, hood, hat) for cold months and bad weather.
  const outfit=window.ConquerWardrobe?.outfitFor(dot);
  drawSplitVillagerBody(kind,base.x,bodyY,bodyW,bodyH,dot.colors[0],dot.colors[1]);
  if(outfit)window.ConquerWardrobe.drawBody(outfit,dot,base.x,bodyY,bodyW,bodyH);
  drawVillagerHead(dot.id,base.x,headY,headR,dot.sex,dot.hair);
  if(outfit)window.ConquerWardrobe.drawHead(outfit,base.x,headY,headR);
}
let populationFrameBounds=null;
function beginPopulationFrame(r){
  populationFrameBounds=r?{width:r.width,height:r.height}:null;
  populationFrameCompletedCache=new Map();
}
function endPopulationFrame(){
  populationFrameBounds=null;
  populationFrameCompletedCache=null;
}
function worldPointVisible(p,z=0,pad=48){
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
  const s=w2s(p,z),r=populationFrameBounds||wrap.getBoundingClientRect();
  return s.x>=-pad&&s.y>=-pad&&s.x<=r.width+pad&&s.y<=r.height+pad;
}
function drawPeasants(){
  const houses=completedSettlement('house'),fields=completedSettlement('field');
  const founders=window.ConquerEconomy?.foundingWorkers?.()||0;
  if(!houses.length&&!founders)return;
  const day=peasantVisualDay(),dots=[];
  let representedPopulation=0,activeAgents=0;
  const farmHouses=houses.filter(h=>houseLevel(h)===1||houseLevel(h)===2);
  const assignments=fieldWorkAssignments(farmHouses,fields);
  // Read the exact same named crews used by the manual construction tick.
  const constructionJobs=new Map();
  for(const [siteId,workers] of constructionCrewAssignments(State.clock.day)){
    const site=State.structures.find(s=>s.id===siteId);
    if(!site)continue;
    for(const worker of workers)constructionJobs.set(worker.id,{site,worker});
  }
  const economy=window.ConquerEconomy;
  const labor=economy?.laborAllocation?.(State.clock.day);
  const unavailableFounders=new Set(Object.values(labor?.assignedL1||{})
    .flat().filter(w=>w.founderIndex!=null).map(w=>w.id));
  const carterWorkers=new Map((labor?.carters||[]).map(w=>[w.id,w]));
  const workday=(economy?.weekday?.(State.clock.day)??6)<5;
  // Loggers walk the same commute to their camp as construction crews.
  if(workday&&(window.ConquerCombat?.alarmMode?.()||'off')==='off')
    for(const [siteId,workers] of Object.entries(labor?.assignedL1||{})){
      const site=State.structures.find(s=>s.id===siteId&&s.type==='loggingCamp');
      if(site)for(const worker of workers)
        if(!constructionJobs.has(worker.id))constructionJobs.set(worker.id,{site,worker});
    }

  const residentStride=State.view.scale<.30?3:State.view.scale<.55?2:1;
  for(const house of houses){
    representedPopulation+=housePopulationCapacity(house).total;
    const kind=villagerClass(house),assignment=assignments.get(house.id);
    for(const resident of houseResidents(house)){
      // Alarm destinations are computed even for residents not selected by
      // distant-camera LOD, so mobilization does not depend on zoom level.
      const building=constructionJobs.get(resident.id);
      const carter=carterWorkers.get(resident.id);
      // Do not draw this same named L1 both as a house resident and as the
      // carter driving the wagon. Between journeys he waits at his yard.
      let p=carter?window.ConquerHaulage?.workerStation?.(carter,labor.carters):
        building?constructionWorkerPosition(building.worker,building.site,State.clock.day):
        residentClassPosition(house,resident,day,assignment);
      if(carter&&!p)continue;
      // The shepherd with his flock (residentClassPosition returned his pasture spot).
      const shepherd=!building&&!carter&&p&&resident.sex==='male'&&resident.age==='adult'&&resident.index===0&&
        houseLevel(house)<=2&&samePoint(p,window.ConquerLivestock?.shepherdPosition?.(house));
      // The artisan of an open L3 workshop works at his bench, not at the door.
      const shop=!building&&!carter?window.ConquerShopCutaway?.artisanAt(house,resident,p):null;
      if(shop)p=shop.p;
      else if(p&&!building&&!carter&&!(assignment&&resident.sex==='male'&&resident.age==='adult'&&houseLevel(house)<=2))
        p={x:p.x+resident.scatterX,y:p.y+resident.scatterY};
      const combatP=window.ConquerCombat?.civilPosition(p,house,resident);
      if(combatP!==undefined)p=combatP; // null means safely inside the Common Hall.
      const inShop=!!shop&&combatP===undefined;
      // Footsteps follow every resident's actual position, independent of LOD.
      if(p)window.ConquerSnowTracks?.observe(resident.id,p,State.clock.day,'person');
      if(residentStride>1&&(resident.lodHash%residentStride)!==0)continue;
      if(!p||!worldPointVisible(p,0,40))continue;
      const rp=rotateViewPoint(p);
      dots.push({
        p,depth:rp.x+rp.y,id:resident.id,kind,sex:resident.sex,age:resident.age,
        hair:resident.hair,colors:resident.colors,
        militia:window.ConquerCombat?.recruitedResident(resident.id)||false,
        // Work clothes (settlement-wardrobe.js ROLES) while at the job or on the way to it.
        role:combatP!==undefined?undefined:inShop?shop.kind:building?(building.site.type==='loggingCamp'?'woodcutter':'builder'):
          carter?'carter':shepherd?'shepherd':undefined,
        work:inShop?(shop.tool&&window.ConquerWorkAnim?{tool:shop.tool,facing:shop.facing}:null):fieldWork(p,assignment,house,resident)
      });
      activeAgents++;
    }
  }
  // Founding crew has no house yet: render it near the village well without
  // inventing a household or an independent individual accounting ledger.
  const well=founders&&State.structures.find(s=>s.type==='well'&&s.id===State.village?.wellId);
  if(well)for(let i=0;i<founders;i++){
    representedPopulation++;
    const id='founder:'+well.id+':'+i,phase=day*.13+i*.8;
    const angle=i*(Math.PI*2/Math.max(1,founders))+.17;
    const distance=2.05+(i%2)*.32;
    const building=constructionJobs.get(id),carter=carterWorkers.get(id);
    if(!building&&!carter&&workday&&unavailableFounders.has(id))continue;
    const p=carter?window.ConquerHaulage?.workerStation?.(carter,labor.carters):
      building?constructionWorkerPosition(building.worker,building.site,State.clock.day):
      {x:well.x+Math.cos(angle)*distance+Math.cos(phase)*.06,
        y:well.y+Math.sin(angle)*distance+Math.sin(phase)*.06};
    if(!p)continue;
    window.ConquerSnowTracks?.observe(id,p,State.clock.day,'person');
    if(!worldPointVisible(p,0,40))continue;
    const hash=peasantHash(id+'-lod');
    if(residentStride>1&&hash%residentStride!==0)continue;
    const rp=rotateViewPoint(p);
    dots.push({p,depth:rp.x+rp.y,id,kind:'peasant',sex:'male',age:'adult',
      role:building?(building.site.type==='loggingCamp'?'woodcutter':'builder'):carter?'carter':undefined,
      hair:villagerHair(id),colors:villagerBodyColors(id,'peasant'),militia:false});
    activeAgents++;
  }
  dots.sort((a,b)=>a.depth-b.depth);
  if(window.__conquerPerf){
    window.__conquerPerf.representedPopulation=representedPopulation;
    window.__conquerPerf.visibleVillagers=activeAgents;
  }
  const workClock=window.ConquerWorkAnim?.now();
  for(const dot of dots){
    if(dot.militia)drawSoldierFigure(dot.p,.10,'spearman',dot.id,day);
    else if(dot.work)window.ConquerWorkAnim.drawWorker(dot,dot.work.tool,workClock,dot.work.facing);
    // On the Mastio's outer stair (p.z absolute): drawn later, over the stair (drawRaisedVillagers).
    else if(Number.isFinite(dot.p.z))raisedVillagers.push(dot);
    else drawVillagerFigure(dot);
  }
}
// Villagers climbing the Mastio's outer stair, at the step's height rather than the terrain's.
// Painted after the stair meshes (settlement-render.js), which would otherwise cover them.
let raisedVillagers=[];
function drawRaisedVillagers(){
  for(const dot of raisedVillagers)withProjectionGroundZ(dot.p.z,()=>drawVillagerFigureUnmasked(dot));
  raisedVillagers=[];
}
// A farmer standing at his field spot works it with the tool of the season:
// hoe for ploughing, seed sack for sowing, sickle for the harvest.
function fieldWork(p,assignment,house,resident){
  if(!window.ConquerWorkAnim||!assignment||resident.sex!=='male'||resident.age!=='adult'||houseLevel(house)>2)return null;
  const spot=fieldWorkerPosition(assignment.field,assignment.cell);
  if(!spot||Math.hypot(p.x-spot.x,p.y-spot.y)>.02)return null;
  const tool=window.ConquerWorkAnim.FIELD_TOOL[fieldCrop(assignment.field).phase];
  return tool?{tool,facing:(peasantHash(resident.id)&1)?1:-1}:null;
}
function militaryScale(){
  // World-size figures track the camera across its full .18x–3x zoom range.
  return State.view.scale*.5;
}
function soldierLivery(id){
 const herald=State.heraldry||{};
 return {main:herald.c1||REIGN_COLOR_1,alt:herald.c2||REIGN_COLOR_2,
  mainDark:herald.c1||REIGN_COLOR_1_DARK,altDark:herald.c2||REIGN_COLOR_2_DARK};
}
function soldierBodyPath(base,bodyW,bodyH,top,bodyY){
  ctx.beginPath();
  ctx.moveTo(base.x-bodyW*.42,top);ctx.lineTo(base.x+bodyW*.42,top);
  ctx.lineTo(base.x+bodyW*.50,bodyY+bodyH*.50);ctx.lineTo(base.x-bodyW*.50,bodyY+bodyH*.50);ctx.closePath();
}
// Shield outline in the feudal shape (unitShield()). Returns the box the arms are painted into.
function soldierShieldPath(cx,cy,rx,ry,shape){
  ctx.beginPath();
  if(shape==='round'){
    const r=(rx+ry)*.5;ctx.arc(cx,cy,r,0,Math.PI*2);return{x:cx-r,y:cy-r,w:r*2,h:r*2};
  }
  if(shape==='heater'){
    const t=cy-ry*.9,b=cy+ry;
    ctx.moveTo(cx-rx,t);ctx.lineTo(cx+rx,t);ctx.lineTo(cx+rx,cy);
    ctx.quadraticCurveTo(cx+rx*.95,cy+ry*.62,cx,b);ctx.quadraticCurveTo(cx-rx*.95,cy+ry*.62,cx-rx,cy);ctx.closePath();
    return{x:cx-rx,y:t,w:rx*2,h:b-t};
  }
  if(shape==='kite'){
    const t=cy-ry*1.05,b=cy+ry*1.3;
    ctx.moveTo(cx-rx,cy-ry*.55);ctx.quadraticCurveTo(cx-rx,t,cx,t);ctx.quadraticCurveTo(cx+rx,t,cx+rx,cy-ry*.55);
    ctx.quadraticCurveTo(cx+rx*.8,cy+ry*.45,cx,b);ctx.quadraticCurveTo(cx-rx*.8,cy+ry*.45,cx-rx,cy-ry*.55);ctx.closePath();
    return{x:cx-rx,y:t,w:rx*2,h:b-t};
  }
  if(shape==='pavise'){
    const w=rx*1.05,t=cy-ry*1.3,b=cy+ry*1.15;
    ctx.moveTo(cx-w,t+ry*.25);ctx.quadraticCurveTo(cx,t-ry*.12,cx+w,t+ry*.25);
    ctx.lineTo(cx+w*.9,b);ctx.lineTo(cx-w*.9,b);ctx.closePath();
    return{x:cx-w,y:t,w:w*2,h:b-t};
  }
  ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);return{x:cx-rx,y:cy-ry,w:rx*2,h:ry*2};
}
function drawQuarteredShield(cx,cy,rx,ry,livery,stroke,scale,useHeraldry=true,shape='oval'){
  ctx.save();
  const box=soldierShieldPath(cx,cy,rx,ry,shape);ctx.clip();
  if(!useHeraldry||!window.__conquerHeraldryCanvas?.paint(ctx,box.x,box.y,box.w,box.h)){
    ctx.fillStyle=livery.main;ctx.fillRect(box.x,box.y,box.w,box.h);
    ctx.fillStyle=livery.alt;ctx.fillRect(cx,box.y,box.w/2,box.h);
  }
  ctx.restore();
  ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.8,.9*scale);
  soldierShieldPath(cx,cy,rx,ry,shape);ctx.stroke();
  if(shape==='round'){ctx.fillStyle='#9a9fa3';ctx.beginPath();ctx.arc(cx,cy,(rx+ry)*.16,0,Math.PI*2);ctx.fill();ctx.stroke();}
  if(shape==='pavise'){ctx.beginPath();ctx.moveTo(cx,cy-ry*1.12);ctx.lineTo(cx,cy+ry*1.15);ctx.stroke();}
  ctx.restore();
}
// Feudal equipment styles; the Asset Lab runs without settlement-core.js, so read the policy directly there.
function soldierHelmetStyle(){return typeof unitHelmet==='function'?unitHelmet():State.policies?.unitHelmet||'cap'}
function soldierShieldStyle(){return typeof unitShield==='function'?unitShield():State.policies?.unitShield||'oval'}
// Steel headgear in the feudal style (unitHelmet()), over the head circle at (x,y) of radius r.
const HELMET_STEEL='#70777c',HELMET_EDGE='rgba(30,30,30,.75)';
function drawSoldierHelmet(x,y,r,style,scale){
  const lw=Math.max(.6,.7*scale);
  ctx.fillStyle=HELMET_STEEL;ctx.strokeStyle=HELMET_EDGE;ctx.lineWidth=lw;
  if(style==='kettle'){
    ctx.beginPath();ctx.arc(x,y-r*.15,r*.92,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y-r*.12,r*1.75,r*.32,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  }else if(style==='nasal'){
    ctx.beginPath();ctx.moveTo(x-r*1.02,y);ctx.quadraticCurveTo(x-r*.85,y-r*1.1,x,y-r*1.7);
    ctx.quadraticCurveTo(x+r*.85,y-r*1.1,x+r*1.02,y);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillRect(x-r*.14,y-r*.1,r*.28,r*.75);
  }else if(style==='barbuta'){
    ctx.beginPath();ctx.arc(x,y,r*1.06,0,Math.PI*2);ctx.fill();ctx.stroke();
    // T-shaped face opening.
    ctx.fillStyle=VILLAGER_SKIN;
    ctx.fillRect(x-r*.62,y-r*.22,r*1.24,r*.3);ctx.fillRect(x-r*.2,y-r*.22,r*.4,r*.95);
  }else if(style==='greathelm'){
    const w=r*1.08,t=y-r*1.2,b=y+r*1.05;
    ctx.beginPath();ctx.moveTo(x-w,t+r*.18);ctx.lineTo(x+w,t+r*.18);ctx.lineTo(x+w*.98,b);ctx.lineTo(x-w*.98,b);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.fillStyle='#8a9196';ctx.fillRect(x-w,t+r*.1,w*2,r*.16);
    // Eye slit and the vertical reinforcement of the face plate.
    ctx.fillStyle='#1d2022';ctx.fillRect(x-w*.82,y-r*.28,w*1.64,Math.max(.6,r*.18));
    ctx.fillStyle='#5d6468';ctx.fillRect(x-r*.07,y-r*.1,r*.14,r*1.1);
  }else{
    ctx.beginPath();ctx.arc(x,y,r,Math.PI,Math.PI*2);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  }
}
function drawSoldierFigure(p,z,type,id,phase=0,liveryOverride=null){
  return withUrbanFigureOcclusion(p,z,()=>drawSoldierFigureUnmasked(p,z,type,id,phase,liveryOverride));
}
function drawSoldierFigureUnmasked(p,z,type,id,phase=0,liveryOverride=null){
  if(window.ConquerLOD?.militaryTier()==='dot'){
    const foot=w2s(p,z),radius=2.1;
    ctx.save();
    ctx.fillStyle=window.ConquerLOD.militaryColor(type,liveryOverride);
    ctx.strokeStyle='#252928';ctx.lineWidth=.8;
    ctx.beginPath();ctx.arc(foot.x,foot.y-radius*.6,radius,0,Math.PI*2);
    ctx.fill();ctx.stroke();
    ctx.restore();
    return;
  }
  const base=w2s(p,z),scale=militaryScale(),bodyW=5.4*scale,bodyH=8.0*scale,headR=2.2*scale;
  const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,headY=top-headR*.72,livery=liveryOverride||soldierLivery(id);

  ctx.save();

  // Realm livery: every soldier carries both current reign colours.
  soldierBodyPath(base,bodyW,bodyH,top,bodyY);ctx.save();ctx.clip();
  if(liveryOverride||!window.__conquerHeraldryCanvas?.paint(ctx,base.x-bodyW*.5,top,bodyW,bodyH)){
    ctx.fillStyle=livery.main;ctx.fillRect(base.x-bodyW,top,bodyW*2,bodyH);
    ctx.fillStyle=livery.alt;ctx.fillRect(base.x,top,bodyW,bodyH);
  }
  ctx.restore();
  soldierBodyPath(base,bodyW,bodyH,top,bodyY);
  ctx.strokeStyle='rgba(25,24,22,.88)';ctx.lineWidth=Math.max(.7,.8*scale);ctx.stroke();

  // Head + helmet: the realm's own soldiers wear the feudal helmet, foes (livery override) the cap.
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.fill();
  drawSoldierHelmet(base.x,headY,headR,liveryOverride?'cap':soldierHelmetStyle(),scale);

  if(type==='spearman'){
    const x=base.x+bodyW*.55;
    ctx.strokeStyle='#7a5937';ctx.lineWidth=Math.max(1,1.05*scale);
    ctx.beginPath();ctx.moveTo(x,bodyY+bodyH*.43);ctx.lineTo(x-1.0*scale,headY-13*scale);ctx.stroke();
    ctx.fillStyle='#b8bcc0';ctx.beginPath();
    ctx.moveTo(x-1.0*scale,headY-16*scale);ctx.lineTo(x-3.0*scale,headY-11.5*scale);ctx.lineTo(x+1.0*scale,headY-12.2*scale);ctx.closePath();ctx.fill();
  }else if(type==='archer'){
    const bx=base.x+bodyW*.62,by=bodyY-bodyH*.04,r=5.3*scale;
    ctx.strokeStyle='#9b7243';ctx.lineWidth=Math.max(.8,.85*scale);
    ctx.beginPath();ctx.arc(bx,by,r,-Math.PI*.55,Math.PI*.55);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx+Math.cos(-Math.PI*.55)*r,by+Math.sin(-Math.PI*.55)*r);
    ctx.lineTo(bx-r*.18,by);
    ctx.lineTo(bx+Math.cos(Math.PI*.55)*r,by+Math.sin(Math.PI*.55)*r);ctx.stroke();
  }else if(type!=='unarmed'){
    const swing=Math.sin(phase*Math.PI*2)*3.2*scale;
    drawQuarteredShield(base.x-bodyW*.62,bodyY+bodyH*.10,2.7*scale,3.6*scale,livery,'#b7aa8f',scale,!liveryOverride,liveryOverride?'oval':soldierShieldStyle());
    // Sword.
    ctx.strokeStyle='#c4c7c8';ctx.lineWidth=Math.max(1,1.15*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.42,bodyY+bodyH*.16);ctx.lineTo(base.x+bodyW*.80+swing,top-7.5*scale);ctx.stroke();
    ctx.strokeStyle='#76563b';ctx.lineWidth=Math.max(1,1.2*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.23,bodyY+bodyH*.05);ctx.lineTo(base.x+bodyW*.52,bodyY+bodyH*.27);ctx.stroke();
  }

  ctx.restore();
}
function drawNobleFigure(p,z,id,phase=0){
  const scale=militaryScale(),bob=Math.sin(phase*Math.PI*2)*.018;
  const base=w2s(p,z+bob),bodyW=5.2*scale,bodyH=9.0*scale,headR=2.25*scale;
  const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,headY=top-headR*.72;
  const flip=(peasantHash(String(id)+'-noble')&1)!==0;
  const main=flip?'#6f355d':'#2f4f75',trim='#c6a457';
  ctx.save();
  ctx.beginPath();ctx.moveTo(base.x-bodyW*.36,top);ctx.lineTo(base.x+bodyW*.36,top);
  ctx.lineTo(base.x+bodyW*.58,bodyY+bodyH*.52);ctx.lineTo(base.x-bodyW*.58,bodyY+bodyH*.52);ctx.closePath();
  ctx.fillStyle=main;ctx.fill();ctx.strokeStyle='rgba(28,22,24,.9)';ctx.lineWidth=Math.max(.7,.8*scale);ctx.stroke();
  ctx.strokeStyle=trim;ctx.lineWidth=Math.max(1,1.15*scale);
  ctx.beginPath();ctx.moveTo(base.x-bodyW*.42,bodyY+bodyH*.26);ctx.lineTo(base.x+bodyW*.42,bodyY+bodyH*.26);ctx.stroke();
  const sex=(peasantHash(String(id)+'-sex')&1)?'female':'male';
  drawVillagerHead(id,base.x,headY,headR,sex,villagerHair(id));
  ctx.fillStyle=trim;ctx.fillRect(base.x-headR*.72,headY-headR*.82,headR*1.44,Math.max(1,1.1*scale));
  ctx.restore();
}
