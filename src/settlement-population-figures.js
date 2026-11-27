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
  }else if(kind==='lady'){
    // L4 lady (FIG-HANDS-261117): the L4 disc runs on into a bell skirt down to the ground, one shape.
    const r=Math.min(w,h)/2,a=.35,hem=ladyHemY(y,w,h);
    ctx.arc(x,y,r,a,Math.PI-a,true);
    ctx.lineTo(x-r*1.18,hem);ctx.quadraticCurveTo(x,hem+h*.14,x+r*1.18,hem);ctx.closePath();
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
// t (footTurn, CIVIL-VIEWS): the hair covers the part of the head turned away; the side locks
// follow the turn.
function drawVillagerHead(id,x,y,r,sex='male',cachedHair=null,t=null){
  const hair=cachedHair||villagerHair(id);
  if(t)return drawVillagerHeadTurned(x,y,r,sex,hair,t);
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
function drawVillagerHeadTurned(x,y,r,sex,hair,t){
  ctx.save();
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  if(hair!=='bald'){
    const hc=HAIR_COLORS[hair];ctx.fillStyle=hc;
    if(sex==='female')for(const side of[-1,1]){
      if(footDepth(t,side,0)<-.5)continue;   // the lock behind the head is hidden by it
      ctx.beginPath();ctx.ellipse(x+side*r*.72*t.c-r*.25*t.s,y+r*.48,r*.34*(.6+.4*Math.abs(t.c)),r*.80,0,0,Math.PI*2);ctx.fill();
    }
    ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
    ctx.beginPath();ctx.arc(x,y,r,Math.PI,Math.PI*2);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();
    if(t.c<.9){ctx.beginPath();ctx.arc(x-t.s*r*(1+t.c),y,r*1.05,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }
  ctx.strokeStyle='rgba(67,42,30,.80)';ctx.lineWidth=Math.max(.65,r*.20);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
// Hands and feet (FIG-HANDS-261117): a small pink disc for each hand and a brown horizontal
// oval for each foot, both outlined like the body. s is the figure unit (State.view.scale*.5);
// below FIGURE_LIMB_MIN_S they are a pixel or less and are skipped.
const FIGURE_HAND='#e8a58f',FIGURE_FOOT='#5a3c25',FIGURE_LIMB_EDGE='rgba(25,24,22,.88)',FIGURE_LIMB_MIN_S=.16;
function drawFigureHand(x,y,s){
  if(s<FIGURE_LIMB_MIN_S)return;
  ctx.fillStyle=FIGURE_HAND;ctx.strokeStyle=FIGURE_LIMB_EDGE;ctx.lineWidth=Math.max(.5,.35*s);
  ctx.beginPath();ctx.arc(x,y,.72*s,0,Math.PI*2);ctx.fill();ctx.stroke();
}
// Drawn before the body, which covers their upper half: they peek out under the hem.
// k scales the feet: 1 for the whole foot, smaller for the shoe tips under a gown.
function drawFigureFeet(x,bottom,bodyW,s,k=1){
  if(s<FIGURE_LIMB_MIN_S)return;
  ctx.fillStyle=FIGURE_FOOT;ctx.strokeStyle=FIGURE_LIMB_EDGE;ctx.lineWidth=Math.max(.5,.35*s);
  for(const side of[-1,1]){
    ctx.beginPath();ctx.ellipse(x+side*bodyW*.21*k+.25*s,bottom+.1*s*k,1.05*s*k,.52*s*k,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
}
// Hem of the L4 lady's bell skirt (bodyPath 'lady'), below the disc.
function ladyHemY(y,w,h){return y+Math.min(w,h)/2+h*.19}
// Body shape of a civilian: L4 women wear the bell gown.
function villagerShape(dot){return dot.kind==='elite'&&dot.sex==='female'?'lady':dot.kind}
// Lower edge of a civilian body shape (bodyPath): the L4 disc is narrower than it is tall.
function villagerBodyBottom(kind,bodyY,bodyW,bodyH){
  if(kind==='lady')return ladyHemY(bodyY,bodyW,bodyH)+bodyH*.065;   // the curved hem dips below its corners
  return bodyY+(kind==='peasant'||kind==='artisan'||kind==='merchant'?bodyH/2:Math.min(bodyW,bodyH)/2);
}
// Where a civilian's hand rests at its side (side -1 left, 1 right): on the rim of the lady's disc.
function villagerSideHand(kind,x,bodyY,bodyW,bodyH,s,side){
  if(kind==='lady'){const r=Math.min(bodyW,bodyH)/2;return{x:x+side*(r+.2*s),y:bodyY+r*.15}}
  return{x:x+side*(bodyW*.5+.15*s),y:bodyY+bodyH*.2};
}
const samePoint=(a,b)=>!!a&&!!b&&Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)<1e-6;
// Everything that changes how a villager looks (not where): the key of its 3D figure tile.
function villagerLookKey(dot){
  const outfit=window.ConquerWardrobe?.outfitFor(dot);
  return [dot.kind,dot.age,dot.sex,dot.hair||villagerHair(dot.id),(dot.colors||[]).join(','),outfit?JSON.stringify(outfit):''].join('|');
}
// Walking direction of a civilian (CIVIL-VIEWS): from where it was drawn last; kept for a moment
// after it stops, then it faces the viewer again (S). dot.view or dot.heading, when given, win.
const civilianWalk=new Map();
const CIVILIAN_HOLD=1.2;   // seconds the last heading is kept after the figure stops
function civilianView(dot){
  if(dot.view)return dot.view;
  if(dot.heading)return footViewOf(dot.p,dot.heading);
  if(!dot.id||!dot.p)return'S';
  const now=performance.now()/1000,w=civilianWalk.get(dot.id);
  if(!w){civilianWalk.set(dot.id,{x:dot.p.x,y:dot.p.y,hx:0,hy:0,at:-1e9});return'S'}
  const dx=dot.p.x-w.x,dy=dot.p.y-w.y,d=Math.hypot(dx,dy);
  // A jump (teleport, new scatter) is not a walk.
  if(d>1e-4&&d<1.5){w.hx=dx;w.hy=dy;w.at=now}
  w.x=dot.p.x;w.y=dot.p.y;
  if(civilianWalk.size>4000)civilianWalk.clear();
  return now-w.at<CIVILIAN_HOLD?footViewOf(dot.p,{x:w.hx,y:w.hy}):'S';
}
function drawVillagerFigure(dot){
  const view=civilianView(dot);
  // WebGL: a depth-tested card (settlement-world3d.js figure()), so ships and walls in front hide it.
  if(window.ConquerWorld3D?.figure?.(dot.p,.10,'v|'+villagerLookKey(dot)+(view==='S'?'':'|'+view),()=>drawVillagerFigureUnmasked({...dot,p:{x:0,y:0}},'both',1,view),dot.id))return true;
  return withUrbanFigureOcclusion(dot.p,.10,()=>drawVillagerFigureUnmasked(dot,'both',1,view));
}
// hands: 'both' (idle, hands at the sides), 'far' (only the hand away from facing: the
// near one is drawn by the work animation at the tool), or 'none'.
// view (CIVIL-VIEWS): one of FOOT_VIEW_NAMES; S, the approved art, by default.
function drawVillagerFigureUnmasked(dot,hands='both',facing=1,view=dot.view||'S'){
  const base=w2s(dot.p,.10),scale=State.view.scale*.5;
  const kind=villagerShape(dot),sizeFactor=dot.age==='child'?.5:1;
  const bodyW=6.0*scale*sizeFactor,bodyH=8.0*scale*sizeFactor,s=scale*sizeFactor;
  const headR=2.35*scale*sizeFactor,bodyY=base.y-bodyH*.16,headY=bodyY-bodyH/2-headR*.68;
  // Seasonal wardrobe overlays (cloak, hood, hat) for cold months and bad weather.
  const outfit=window.ConquerWardrobe?.outfitFor(dot);
  const t=footTurn(view);
  if(t)return drawVillagerTurned(dot,hands,facing,t,{base,kind,bodyW,bodyH,s,headR,bodyY,headY,outfit});
  // Under the gown only the shoe tips show.
  drawFigureFeet(base.x,villagerBodyBottom(kind,bodyY,bodyW,bodyH),bodyW,s,kind==='lady'?.76:1);
  // Ladies wear a gown of one colour; the other classes keep the two-tone tunic.
  const lady=kind==='lady';
  drawSplitVillagerBody(kind,base.x,bodyY,bodyW,bodyH,dot.colors[0],lady?dot.colors[0]:dot.colors[1]);
  if(outfit)window.ConquerWardrobe.drawBody(outfit,dot,base.x,bodyY,bodyW,bodyH);
  for(const side of hands==='both'?[-1,1]:hands==='far'?[facing<0?1:-1]:[]){
    const h=villagerSideHand(kind,base.x,bodyY,bodyW,bodyH,s,side);drawFigureHand(h.x,h.y,s);
  }
  // Ladies: a bare head, then braided hair (settlement-wardrobe.js), then the headdress.
  if(lady&&window.ConquerWardrobe?.drawLadyHair){
    drawVillagerHead(dot.id,base.x,headY,headR,dot.sex,'bald');
    window.ConquerWardrobe.drawLadyHair(outfit,dot,base.x,headY,headR);
  }else drawVillagerHead(dot.id,base.x,headY,headR,dot.sex,dot.hair);
  if(outfit)window.ConquerWardrobe.drawHead(outfit,base.x,headY,headR);
}
// The same figure turned (CIVIL-VIEWS): body and garments as volumes, hands by their side of the
// body (the far one first), hair over the part of the head turned away.
function drawVillagerTurned(dot,hands,facing,t,f){
  const {base,kind,bodyW,bodyH,s,headR,bodyY,headY,outfit}=f,lady=kind==='lady',W=window.ConquerWardrobe;
  const sides=hands==='both'?[-1,1]:hands==='far'?[facing<0?1:-1]:[];
  const hand=side=>{const h=villagerSideHand(kind,base.x,bodyY,bodyW,bodyH,s,side);drawFigureHand(base.x+(h.x-base.x)*t.c,h.y,s)};
  const near=side=>footDepth(t,side,0)>=0;
  for(const side of sides)if(!near(side))hand(side);
  drawFootViewFeet(t,base.x,villagerBodyBottom(kind,bodyY,bodyW,bodyH),bodyW,s);
  withFootVolume(ctx,t,base.x,0,()=>drawSplitVillagerBody(kind,base.x,bodyY,bodyW,bodyH,dot.colors[0],lady?dot.colors[0]:dot.colors[1]));
  if(outfit)W.drawBody(outfit,dot,base.x,bodyY,bodyW,bodyH,t);
  for(const side of sides)if(near(side))hand(side);
  if(lady&&W?.drawLadyHair){
    // Under the veil the head stays bare; otherwise her hair covers the back of the head (her own
    // locks and braids are the lady's hair, drawn next).
    const bare=outfit?.head==='veil'?'bald':dot.hair||villagerHair(dot.id);
    drawVillagerHead(dot.id,base.x,headY,headR,'male',bare,t);
    withFootVolume(ctx,t,base.x,0,()=>W.drawLadyHair(outfit,dot,base.x,headY,headR),.85);
  }else drawVillagerHead(dot.id,base.x,headY,headR,dot.sex,dot.hair,t);
  if(outfit)W.drawHead(outfit,base.x,headY,headR,t);
}
// The levy (alarm recruits, extraordinary levy): no livery, the villager's own class clothes
// (season included) under a hood in the realm's colours. By class (combatRole, settlement-combat.js):
// L1 peasants are levy infantry with spear (right hand, screen left) and the realm shield,
// L2 artisans are levy archers with a bow.
function levyArcher(dot){return dot.kind==='artisan'}
function levyOutfit(dot){
  const W=window.ConquerWardrobe,season=W?.outfitFor({...dot,role:undefined,outfit:undefined});
  return{head:'levyHood',body:season?.body||null,neck:season?.neck||null,
    colors:{...(season?.colors||{}),head:null},sleeve:season?.sleeve||null};
}
function drawLevyFigure(dot){
  if(!dot.view)dot={...dot,view:civilianView(dot)};
  const look={...dot,outfit:levyOutfit(dot)};
  const key='levy|'+villagerLookKey(look)+'|'+(levyArcher(dot)?'bow':'spear:'+soldierShieldStyle())+(dot.view==='S'?'':'|'+dot.view);
  if(window.ConquerWorld3D?.figure?.(dot.p,.10,key,()=>drawLevyFigureUnmasked({...look,p:{x:0,y:0}}),dot.id))return true;
  return withUrbanFigureOcclusion(dot.p,.10,()=>drawLevyFigureUnmasked(look));
}
function drawLevyFigureUnmasked(dot){
  if(dot.outfit===undefined)dot={...dot,outfit:levyOutfit(dot)};
  const t=footTurn(dot.view),base=w2s(dot.p,.10),scale=State.view.scale*.5;
  const bodyW=6.0*scale,bodyH=8.0*scale,headR=2.35*scale,bodyY=base.y-bodyH*.16,headY=bodyY-bodyH/2-headR*.68;
  // Weapons as the soldiers' (FOOT-VIEWS): cards on their side, behind the body when turned away.
  const gear=levyArcher(dot)?[[bodyW*.62,bodyW*.15]]:[[bodyW*.62,bodyW*.12],[-bodyW*.55,bodyW*.1]];
  const behind=gear.map(([lx,lz])=>footDepth(t,lx,lz)<0);
  if(t){ctx.save();levyGear(dot,base,scale,bodyW,bodyH,bodyY,headY,t,behind,true);ctx.restore()}
  // Hands only on the weapons (FIG-HANDS-261117): none hanging at the sides.
  drawVillagerFigureUnmasked(dot,'none',1,dot.view||'S');
  ctx.save();
  levyGear(dot,base,scale,bodyW,bodyH,bodyY,headY,t,behind,false);
  ctx.restore();
}
function levyGear(dot,base,scale,bodyW,bodyH,bodyY,headY,t,behind,back){
  const card=(i,lz,fn)=>{if(behind[i]===back)withFootCard(ctx,t,base.x,lz,fn)};
  if(levyArcher(dot))card(0,bodyW*.15,()=>{
    // Bow on the left arm (screen right), as the realm's archers, both hands on it.
    const bx=base.x+bodyW*.62,by=bodyY-bodyH*.04,r=5.3*scale;
    ctx.strokeStyle='#9b7243';ctx.lineWidth=Math.max(.8,.85*scale);
    ctx.beginPath();ctx.arc(bx,by,r,-Math.PI*.55,Math.PI*.55);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx+Math.cos(-Math.PI*.55)*r,by+Math.sin(-Math.PI*.55)*r);
    ctx.lineTo(bx-r*.18,by);ctx.lineTo(bx+Math.cos(Math.PI*.55)*r,by+Math.sin(Math.PI*.55)*r);ctx.stroke();
    drawFigureHand(bx+r,by,scale);drawFigureHand(bx-r*.18,by,scale);
  });
  else{
    card(0,bodyW*.12,()=>{
      if(t&&!t.front)drawShieldBack(base.x+bodyW*.62,bodyY+bodyH*.10,2.7*scale,3.6*scale,'#b7aa8f',scale,soldierShieldStyle());
      else drawQuarteredShield(base.x+bodyW*.62,bodyY+bodyH*.10,2.7*scale,3.6*scale,soldierLivery(dot.id),'#b7aa8f',scale,true,soldierShieldStyle());
    });
    card(1,bodyW*.1,()=>drawSoldierSpear(base,scale,bodyW,bodyH,bodyY,headY));
  }
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
  // Keyed by resident id: only the L1 the economy staffs at a field farm.
  const assignments=fieldWorkAssignments(houses,fields);
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
    const kind=villagerClass(house);
    for(const resident of houseResidents(house)){
      const assignment=assignments.get(resident.id);
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
      // The artisan of an open (L2) workshop works at his bench, not at the door.
      const shop=!building&&!carter?window.ConquerShopCutaway?.artisanAt(house,resident,p):null;
      if(shop)p=shop.p;
      else if(p&&!building&&!carter&&!(assignment&&resident.sex==='male'&&resident.age==='adult'&&fieldSocialTier(house)===1))
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
    if(dot.militia)drawLevyFigure(dot);
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
  if(!window.ConquerWorkAnim||!assignment||resident.sex!=='male'||resident.age!=='adult'||fieldSocialTier(house)!==1)return null;
  // A strip without work (finished or field closed) never shows a working pose.
  if(typeof fieldSlotRelease==='function'&&fieldSlotRelease(assignment.field,assignment.cell))return null;
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
// Back of a shield, seen from behind the bearer: bare boards, the rim and a grip strap.
function drawShieldBack(cx,cy,rx,ry,stroke,scale,shape='oval'){
  ctx.save();
  soldierShieldPath(cx,cy,rx,ry,shape);ctx.fillStyle='#7a5937';ctx.fill();
  ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.8,.9*scale);ctx.stroke();
  ctx.strokeStyle='#4a3422';ctx.lineWidth=Math.max(.7,.7*scale);
  ctx.beginPath();ctx.moveTo(cx-rx*.55,cy-ry*.15);ctx.lineTo(cx+rx*.55,cy-ry*.15);ctx.stroke();
  ctx.restore();
}

// ---- Eight views of the foot soldier (FOOT-VIEWS-261127) ----------------------------------------
// The approved figure faces the viewer: that is the S view, drawn as before. The other seven turn the
// same shapes about the figure's vertical axis. A piece sits at lx across the body (screen x in the S
// view; + is the figure's left) and lz in depth (+ toward the viewer in S). Turned by yaw (S 0,
// E 90 = facing screen right, N 180) it lands at x = lx·cos + lz·sin, at depth -lx·sin + lz·cos.
// Body, feet and head are volumes (narrower but never flat side on); weapons, shields, bows and the
// standard are flat cards in the S plane, squeezed by cos (so mirrored from behind).
const FOOT_VIEW_NAMES=Object.freeze(['E','SE','S','SW','W','NW','N','NE']);
const FOOT_VIEW_YAW=Object.freeze({E:90,SE:45,S:0,SW:-45,W:-90,NW:-135,N:180,NE:135});
function footViewOfScreen(dx,dy){
  if(!(Math.hypot(dx,dy)>1e-6))return'S';
  return FOOT_VIEW_NAMES[((Math.round(Math.atan2(dy,dx)/(Math.PI/4))%8)+8)%8];
}
// View of a figure at p walking or looking along the world vector h; none: it faces the viewer.
function footViewOf(p,h){
  if(typeof h==='string')return FOOT_VIEW_YAW[h]!==undefined?h:'S';
  if(!h||!(Math.hypot(h.x,h.y)>1e-6)||typeof w2sRaw!=='function')return'S';
  // As ConquerMounted2D.viewAt: the screen axes normalised, so the flattened ground (iso) does not
  // push every heading toward E/W; the eight ground directions get the eight views evenly.
  const o=w2sRaw(p,0),X=w2sRaw({x:p.x+1,y:p.y},0),Y=w2sRaw({x:p.x,y:p.y+1},0);
  const a=X.x-o.x,b=Y.x-o.x,c=X.y-o.y,d=Y.y-o.y,A=Math.hypot(a,b)||1,B=Math.hypot(c,d)||1;
  return footViewOfScreen((a*h.x+b*h.y)/A,(c*h.x+d*h.y)/B);
}
// The turn of a view (null for S: the approved art, untouched).
function footTurn(view){
  if(!view||view==='S'||FOOT_VIEW_YAW[view]===undefined)return null;
  const a=FOOT_VIEW_YAW[view]*Math.PI/180,snap=v=>Math.abs(v)<1e-9?0:v;
  const c=snap(Math.cos(a)),s=snap(Math.sin(a));
  return{view,c,s,front:c>=0};
}
function footDepth(t,lx,lz){return t?-lx*t.s+lz*t.c:lz}
// A flat card through depth lz: x squeezed by cos about the axis cx, never thinner than FOOT_CARD_MIN
// (an edge-on spear or shield still reads), and shifted by lz·sin.
const FOOT_CARD_MIN=.42;
function withFootCard(g,t,cx,lz,fn){
  if(!t)return fn();
  const k=Math.abs(t.c)<FOOT_CARD_MIN?(t.c<0?-FOOT_CARD_MIN:FOOT_CARD_MIN):t.c;
  g.save();g.translate(cx+lz*t.s,0);g.scale(k,1);g.translate(-cx,0);
  try{return fn()}finally{g.restore()}
}
// A volume about the axis cx: as wide as in S from front and back, `depth` of that side on.
function withFootVolume(g,t,cx,lz,fn,depth=.7){
  if(!t)return fn();
  const k=depth+(1-depth)*Math.abs(t.c);
  g.save();g.translate(cx+lz*t.s,0);g.scale(k,1);g.translate(-cx,0);
  try{return fn()}finally{g.restore()}
}
// Feet turned with the body: toes forward, the far foot first.
function drawFootViewFeet(t,x,bottom,bodyW,s){
  if(!t)return drawFigureFeet(x,bottom,bodyW,s);
  if(s<FIGURE_LIMB_MIN_S)return;
  ctx.fillStyle=FIGURE_FOOT;ctx.strokeStyle=FIGURE_LIMB_EDGE;ctx.lineWidth=Math.max(.5,.35*s);
  const feet=[-1,1].map(side=>({side,d:footDepth(t,side*bodyW*.21,0)})).sort((a,b)=>a.d-b.d);
  for(const {side} of feet){
    const fx=x+side*bodyW*.21*t.c+bodyW*.12*t.s;
    ctx.beginPath();ctx.ellipse(fx,bottom+.1*s,1.05*s*(.6+.4*Math.abs(t.s)),.52*s,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
}
// The livery body turned: front and back are party per pale (the arms only from the front), side on
// the seam slides to the chest or the back. path() traces the body in S coordinates.
function fillFootLivery(t,x,path,box,livery,heraldry){
  const before=ctx.getTransform(),k=t?.7+.3*Math.abs(t.c):1;
  ctx.save();
  // Clip to the turned body (a volume, as withFootVolume), then paint: the arms in S coordinates,
  // the plain livery in screen space so the seam can slide.
  ctx.translate(x,0);ctx.scale(k,1);ctx.translate(-x,0);path();ctx.clip();
  const painted=heraldry&&(!t||t.c>.6)&&window.__conquerHeraldryCanvas?.paint(ctx,box.x,box.y,box.w,box.h);
  if(!painted){
    ctx.setTransform(before);
    const seam=t?x+(t.front?1:-1)*box.w*.32*t.s:x;
    ctx.fillStyle=!t||t.front?livery.main:livery.alt;ctx.fillRect(x-box.w*2,box.y,box.w*4,box.h);
    ctx.fillStyle=!t||t.front?livery.alt:livery.main;ctx.fillRect(seam,box.y,box.w*2,box.h);
  }
  ctx.restore();
}
// Back and side of the bare head under the helmet: hair over the part turned away.
function drawFootViewHair(t,x,y,r){
  if(!t||t.c>.9)return;
  ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  ctx.fillStyle='#4b3322';ctx.beginPath();ctx.arc(x-t.s*r*(1+t.c),y,r*1.05,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.strokeStyle='rgba(67,42,30,.80)';ctx.lineWidth=Math.max(.65,r*.20);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
}

// Feudal equipment styles; the Asset Lab runs without settlement-core.js, so read the policy directly there.
function soldierHelmetStyle(){return typeof unitHelmet==='function'?unitHelmet():State.policies?.unitHelmet||'cap'}
function soldierShieldStyle(){return typeof unitShield==='function'?unitShield():State.policies?.unitShield||'oval'}
// Steel headgear in the feudal style (unitHelmet()), over the head circle at (x,y) of radius r.
const HELMET_STEEL='#70777c',HELMET_EDGE='rgba(30,30,30,.75)';
// t (footTurn): the face details (slit, nasal, T opening) move to the turned face and are hidden
// from behind; the shell is round, the same from every side.
function drawSoldierHelmet(x,y,r,style,scale,t=null){
  const lw=Math.max(.6,.7*scale);
  ctx.fillStyle=HELMET_STEEL;ctx.strokeStyle=HELMET_EDGE;ctx.lineWidth=lw;
  const face=fn=>{
    if(!t)return fn();
    if(t.c<.15)return;
    ctx.save();ctx.translate(x+r*.85*t.s,0);ctx.scale(t.c,1);ctx.translate(-x,0);fn();ctx.restore();
  };
  if(style==='kettle'){
    ctx.beginPath();ctx.arc(x,y-r*.15,r*.92,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y-r*.12,r*1.75,r*.32,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  }else if(style==='nasal'){
    ctx.beginPath();ctx.moveTo(x-r*1.02,y);ctx.quadraticCurveTo(x-r*.85,y-r*1.1,x,y-r*1.7);
    ctx.quadraticCurveTo(x+r*.85,y-r*1.1,x+r*1.02,y);ctx.closePath();ctx.fill();ctx.stroke();
    face(()=>ctx.fillRect(x-r*.14,y-r*.1,r*.28,r*.75));
  }else if(style==='barbuta'){
    ctx.beginPath();ctx.arc(x,y,r*1.06,0,Math.PI*2);ctx.fill();ctx.stroke();
    // T-shaped face opening.
    face(()=>{ctx.fillStyle=VILLAGER_SKIN;
    ctx.fillRect(x-r*.62,y-r*.22,r*1.24,r*.3);ctx.fillRect(x-r*.2,y-r*.22,r*.4,r*.95)});
  }else if(style==='greathelm'){
    const w=r*1.08,t=y-r*1.2,b=y+r*1.05;
    ctx.beginPath();ctx.moveTo(x-w,t+r*.18);ctx.lineTo(x+w,t+r*.18);ctx.lineTo(x+w*.98,b);ctx.lineTo(x-w*.98,b);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.fillStyle='#8a9196';ctx.fillRect(x-w,t+r*.1,w*2,r*.16);
    // Eye slit and the vertical reinforcement of the face plate.
    face(()=>{ctx.fillStyle='#1d2022';ctx.fillRect(x-w*.82,y-r*.28,w*1.64,Math.max(.6,r*.18));
    ctx.fillStyle='#5d6468';ctx.fillRect(x-r*.07,y-r*.1,r*.14,r*1.1)});
  }else{
    ctx.beginPath();ctx.arc(x,y,r,Math.PI,Math.PI*2);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  }
}
// Outlaw axeman (settlement-outlaws.js): a round wooden shield with an iron boss on the
// off arm and a bearded axe in the hand. pose (combat anim) or null: the axe is raised
// back on the wind-up and comes down toward the foe on the blow.
const OUTLAW_SHIELD={main:'#7b5a38',alt:'#6a4b2e',mainDark:'#7b5a38',altDark:'#6a4b2e'};
function drawAxeAndRoundShield(base,scale,bodyW,bodyH,bodyY,top,pose=null){
  const ready=pose?.ready||0,attack=pose?.attack||0,dirX=pose?.dirX??1;
  const side=dirX>=0?1:-1;
  drawQuarteredShield(base.x-bodyW*.6+dirX*ready*1.2*scale,bodyY+bodyH*.08,3.1*scale,3.1*scale,OUTLAW_SHIELD,'#3b2a1a',scale,false,'round');
  const hx=base.x+bodyW*.42,hy=bodyY+bodyH*.16;
  const theta=side*(attack<0?attack*1.1:attack*1.7)+side*ready*.2;
  ctx.save();
  ctx.translate(hx,hy);ctx.rotate(theta);ctx.translate(-hx,-hy);
  const tx=base.x+bodyW*.72,ty=top-6.2*scale;
  // Haft.
  ctx.strokeStyle='#6e4f30';ctx.lineWidth=Math.max(1,1.2*scale);
  ctx.beginPath();ctx.moveTo(hx,hy+1.2*scale);ctx.lineTo(tx,ty);ctx.stroke();
  // Bearded head, edge facing out.
  ctx.fillStyle='#a9adb0';ctx.strokeStyle='#3d4144';ctx.lineWidth=Math.max(.6,.6*scale);
  ctx.beginPath();
  ctx.moveTo(tx-.3*scale,ty+.4*scale);ctx.lineTo(tx+2.6*scale,ty-1.2*scale);
  ctx.quadraticCurveTo(tx+3.4*scale,ty+1.4*scale,tx+2.5*scale,ty+3.6*scale);
  ctx.lineTo(tx+.1*scale,ty+2.0*scale);ctx.closePath();ctx.fill();ctx.stroke();
  drawFigureHand(hx,hy+.4*scale,scale);   // the axe hand turns with the haft
  ctx.restore();
}
// Spear in the soldier's right hand: screen left, since the figure faces the viewer.
function soldierSpearHandX(base,bodyW){return base.x-bodyW*.55}
function drawSoldierSpear(base,scale,bodyW,bodyH,bodyY,headY){
  const x=soldierSpearHandX(base,bodyW);
  ctx.strokeStyle='#7a5937';ctx.lineWidth=Math.max(1,1.05*scale);
  ctx.beginPath();ctx.moveTo(x,bodyY+bodyH*.43);ctx.lineTo(x+1.0*scale,headY-13*scale);ctx.stroke();
  ctx.fillStyle='#b8bcc0';ctx.beginPath();
  ctx.moveTo(x+1.0*scale,headY-16*scale);ctx.lineTo(x+3.0*scale,headY-11.5*scale);ctx.lineTo(x-1.0*scale,headY-12.2*scale);ctx.closePath();ctx.fill();
  drawSpearHand(x,bodyY+bodyH*.43,headY-13*scale,bodyY+bodyH*SPEAR_HAND_Y,scale);
}
// The regiment's standard, carried by the herald in his right hand (screen left) in place of the
// spear; the cloth flies outward, away from the body. Same campaign heraldry raster as tower flags,
// not a separately generated unit emblem. base: the herald's foot on screen; wavePhase: radians.
// The standard is three times the old squad flag (product owner, 17/11/2026): mast, cloth and wave.
const HERALD_STANDARD_SIZE=3;
function drawHeraldStandard(g,base,id,wavePhase=0){
  const scale=Math.min(1.45,Math.max(.55,State.view.scale))*HERALD_STANDARD_SIZE;
  const mastX=soldierSpearHandX(base,5.4*militaryScale()),mastTop=base.y-36*scale;
  const width=14*scale,height=19*scale;
  const wave=Math.sin(wavePhase+(peasantHash(id)%1000)*.00628)*1.1*scale;
  const topRight={x:mastX,y:mastTop+2*scale};
  const topLeft={x:mastX-width,y:topRight.y+wave};
  const bottomRight={x:topRight.x,y:topRight.y+height};
  const bottomLeft={x:topLeft.x,y:topLeft.y+height};
  const cloth=()=>{g.beginPath();g.moveTo(topLeft.x,topLeft.y);g.lineTo(topRight.x,topRight.y);
    g.lineTo(bottomRight.x,bottomRight.y);g.lineTo(bottomLeft.x,bottomLeft.y);g.closePath()};
  g.save();
  g.strokeStyle='#705038';g.lineWidth=Math.max(1,1.5*scale);
  g.beginPath();g.moveTo(mastX,base.y-2*scale);g.lineTo(mastX,mastTop);g.stroke();
  g.save();cloth();g.clip();
  const herald=State.heraldry||{},clothTop=Math.min(topLeft.y,topRight.y),clothH=height+Math.abs(wave);
  if(!window.__conquerHeraldryCanvas?.paint(g,topLeft.x,clothTop,width,clothH)){
    g.fillStyle=herald.c1||REIGN_COLOR_1;g.fillRect(topLeft.x,clothTop,width,clothH);
    g.fillStyle=herald.c2||REIGN_COLOR_2;g.fillRect(topLeft.x+width/2,clothTop,width/2,clothH);
  }
  g.restore();
  g.strokeStyle='#e0d3b1';g.lineWidth=Math.max(.7,.85*scale);cloth();g.stroke();
  g.fillStyle='#c6a461';g.beginPath();g.arc(mastX,mastTop,Math.max(1,1.1*scale),0,Math.PI*2);g.fill();
  g.restore();
}
// L3 man-at-arms (product owner, 17/11/2026): between the levy and the knight. Fights on foot,
// quilted leather gambeson, armoured arms and feet, no cloak, no shield. Livery (chosen: variant F):
// a short gonnello with the realm's arms, from the shoulders to the hips, the gambeson below.
// Helmet and two-handed weapon are random per man (stable by id): the helmet is one of the
// knights' helmets (settlement-mounted2d.js head(): great helm, barbuta, kettle hat, nasal, cap),
// never the knight's crest; the weapon one of halberd, two-handed axe, two-handed hammer,
// two-handed sword. State.policies.manAtArms {helmet,weapon} pins one (Asset Lab), 'random' or
// missing = per man.
const KNIGHT_HELMETS=Object.freeze(['greathelm','barbuta','kettle','nasal','cap']);
const MAN_AT_ARMS_WEAPONS=Object.freeze(['halberd','twoHandAxe','twoHandHammer','greatsword']);
const MAA_STEEL='#8a9196',MAA_STEEL_EDGE='rgba(30,32,34,.85)',MAA_GAMBESON='#7a5a3a';
// Independent, well-mixed picks for helmet and weapon (FNV alone clusters on sequential ids).
function manAtArmsPick(id,salt,list){
  let h=peasantHash(String(id)+':man-at-arms:'+salt);
  h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);h=(h^(h>>>16))>>>0;
  return list[h%list.length];
}
function manAtArmsKit(id){
  const pin=State.policies?.manAtArms||{};
  const helmet=KNIGHT_HELMETS.includes(pin.helmet)?pin.helmet:manAtArmsPick(id,'helmet',KNIGHT_HELMETS);
  const weapon=MAN_AT_ARMS_WEAPONS.includes(pin.weapon)?pin.weapon:manAtArmsPick(id,'weapon',MAN_AT_ARMS_WEAPONS);
  return{helmet,weapon};
}
// t (footTurn, FOOT-VIEWS): body, arms and head turn as a volume, the weapon is a card in the right
// hand; from behind the gonnello shows the plain livery and no arms.
function drawManAtArmsUnmasked(base,scale,id,liveryOverride=null,kit=manAtArmsKit(id),t=null){
  const bodyW=5.4*scale,bodyH=8.0*scale,headR=2.2*scale;
  const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,headY=top-headR*.72,bottom=bodyY+bodyH*.5;
  const livery=liveryOverride||soldierLivery(id),lw=Math.max(.6,.7*scale);
  const steel=(fill=MAA_STEEL)=>{ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=MAA_STEEL_EDGE;ctx.lineWidth=lw;ctx.stroke()};
  const iron=()=>{ctx.fillStyle='#a9adb0';ctx.strokeStyle='#3d4144';ctx.lineWidth=Math.max(.6,.6*scale);ctx.fill();ctx.stroke()};
  ctx.save();
  const weaponLx=-bodyW*.55,weaponLz=bodyW*.1,weaponBehind=footDepth(t,weaponLx,weaponLz)<0;
  if(weaponBehind)withFootCard(ctx,t,base.x,weaponLz,weapon);
  withFootVolume(ctx,t,base.x,0,()=>{
  // Armoured legs and feet (greaves, sabatons) below the gambeson's skirt.
  for(const s of [-1,1]){
    ctx.beginPath();ctx.rect(base.x+s*bodyW*.22-bodyW*.09,bottom-.2*scale,bodyW*.18,1.5*scale);steel();
    ctx.beginPath();ctx.ellipse(base.x+s*bodyW*.24,bottom+1.4*scale,bodyW*.16,.55*scale,0,0,Math.PI*2);steel('#7b8287');
  }
  // Quilted leather gambeson.
  soldierBodyPath(base,bodyW,bodyH,top,bodyY);ctx.fillStyle=MAA_GAMBESON;ctx.fill();
  ctx.save();soldierBodyPath(base,bodyW,bodyH,top,bodyY);ctx.clip();
  ctx.strokeStyle='rgba(40,26,14,.45)';ctx.lineWidth=Math.max(.4,.35*scale);ctx.beginPath();
  for(let k=1;k<4;k++){const y=top+bodyH*k/4;ctx.moveTo(base.x-bodyW,y);ctx.lineTo(base.x+bodyW,y)}
  for(const k of [-.25,0,.25]){ctx.moveTo(base.x+bodyW*k,top);ctx.lineTo(base.x+bodyW*k*1.15,bottom)}
  ctx.stroke();
  // Short gonnello with the arms (campaign heraldry raster); without it, party per pale with a
  // small shield of arms on the chest. Foes (livery override) wear their colours party per pale.
  const hem=bodyY+bodyH*.2;
  const coat=()=>{ctx.beginPath();ctx.moveTo(base.x-bodyW*.4,top);ctx.lineTo(base.x+bodyW*.4,top);
    ctx.lineTo(base.x+bodyW*.47,hem);ctx.lineTo(base.x-bodyW*.47,hem);ctx.closePath()};
  ctx.save();coat();ctx.clip();
  const painted=!liveryOverride&&(!t||t.c>.6)&&window.__conquerHeraldryCanvas?.paint(ctx,base.x-bodyW*.47,top,bodyW*.94,hem-top);
  if(!painted&&!t){ctx.fillStyle=livery.main;ctx.fillRect(base.x-bodyW,top,bodyW*2,bodyH);ctx.fillStyle=livery.alt;ctx.fillRect(base.x,top,bodyW,bodyH)}
  else if(!painted){
    // Turned: party per pale with the seam on the chest (or the back), in the volume's own units.
    const k=t?.7+.3*Math.abs(t.c):1,seam=t?base.x+(t.front?1:-1)*bodyW*.32*t.s/k:base.x,front=!t||t.front;
    ctx.fillStyle=front?livery.main:livery.alt;ctx.fillRect(base.x-bodyW*2,top,bodyW*4,bodyH);
    ctx.fillStyle=front?livery.alt:livery.main;ctx.fillRect(seam,top,bodyW*2,bodyH);
  }
  ctx.restore();
  coat();ctx.strokeStyle='rgba(25,24,22,.7)';ctx.lineWidth=lw;ctx.stroke();
  if(!painted&&!liveryOverride&&(!t||t.c>.6))drawQuarteredShield(base.x,top+bodyH*.3,1.2*scale,1.5*scale,{main:livery.alt,alt:livery.main},'#d9c38a',scale*.6,false,'heater');
  ctx.restore();
  soldierBodyPath(base,bodyW,bodyH,top,bodyY);ctx.strokeStyle='rgba(25,24,22,.88)';ctx.lineWidth=Math.max(.7,.8*scale);ctx.stroke();
  // Armoured arms: pauldron and vambrace on each side.
  for(const s of [-1,1]){
    const ax=base.x+s*bodyW*.5;
    ctx.beginPath();ctx.ellipse(ax,top+.8*scale,1.05*scale,.95*scale,0,0,Math.PI*2);steel();
    ctx.beginPath();ctx.rect(ax-.55*scale,top+1.3*scale,1.1*scale,bodyH*.5);steel();
  }
  });
  // Head and a knight's helmet (no crest).
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.fill();
  drawFootViewHair(t,base.x,headY,headR);
  drawSoldierHelmet(base.x,headY,headR,kit.helmet,scale,t);
  if(!weaponBehind)withFootCard(ctx,t,base.x,weaponLz,weapon);
  ctx.restore();
  // Two-handed weapon in the right hand (screen left).
  function weapon(){
  const hx=soldierSpearHandX(base,bodyW),hy=bodyY+bodyH*.43;
  const haft=(tx,ty)=>{ctx.strokeStyle='#6e4f30';ctx.lineWidth=Math.max(1,1.15*scale);ctx.beginPath();ctx.moveTo(hx,hy+1.2*scale);ctx.lineTo(tx,ty);ctx.stroke()};
  if(kit.weapon==='greatsword'){
    const tipY=headY-10*scale;
    ctx.strokeStyle='#c4c7c8';ctx.lineWidth=Math.max(1,1.3*scale);
    ctx.beginPath();ctx.moveTo(hx,hy-2.2*scale);ctx.lineTo(hx,tipY);ctx.stroke();
    ctx.strokeStyle='#5d6468';ctx.lineWidth=Math.max(1,.9*scale);
    ctx.beginPath();ctx.moveTo(hx-1.8*scale,hy-2.2*scale);ctx.lineTo(hx+1.8*scale,hy-2.2*scale);ctx.stroke();
    ctx.strokeStyle='#5a3f28';ctx.lineWidth=Math.max(1,1.1*scale);
    ctx.beginPath();ctx.moveTo(hx,hy-2.2*scale);ctx.lineTo(hx,hy+1.4*scale);ctx.stroke();
    ctx.fillStyle='#8a7a4a';ctx.beginPath();ctx.arc(hx,hy+1.6*scale,.6*scale,0,Math.PI*2);ctx.fill();
  }else if(kit.weapon==='halberd'){
    // Halberd: the longest haft, axe blade facing out, back hook, long top spike.
    const tx=hx+.9*scale,ty=headY-14*scale;
    haft(tx,ty-4.5*scale);
    ctx.beginPath();ctx.moveTo(tx,ty-.6*scale);ctx.lineTo(tx-2.6*scale,ty-1.2*scale);
    ctx.quadraticCurveTo(tx-3.3*scale,ty+1.0*scale,tx-2.5*scale,ty+3.0*scale);ctx.lineTo(tx,ty+1.8*scale);ctx.closePath();iron();
    ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx+2.2*scale,ty+1.4*scale);ctx.lineTo(tx,ty+1.2*scale);ctx.closePath();iron();
    ctx.beginPath();ctx.moveTo(tx-.4*scale,ty-1.0*scale);ctx.lineTo(tx+.05*scale,ty-6.5*scale);ctx.lineTo(tx+.5*scale,ty-1.0*scale);ctx.closePath();iron();
  }else if(kit.weapon==='twoHandAxe'){
    // Two-handed axe: shorter haft, a broad crescent blade facing out.
    const tx=hx+.6*scale,ty=headY-7*scale;
    haft(tx,ty-1.2*scale);
    ctx.beginPath();ctx.moveTo(tx,ty-1.2*scale);ctx.lineTo(tx-2.4*scale,ty-3.2*scale);
    ctx.quadraticCurveTo(tx-5.0*scale,ty+1.0*scale,tx-2.4*scale,ty+5.0*scale);ctx.lineTo(tx,ty+2.8*scale);ctx.closePath();iron();
  }else{
    // Two-handed hammer: a square iron head across the haft, a short spike at the back.
    const tx=hx+.6*scale,ty=headY-7*scale;
    haft(tx,ty-1.6*scale);
    ctx.beginPath();ctx.rect(tx-3.0*scale,ty-1.4*scale,3.4*scale,2.6*scale);iron();
    ctx.beginPath();ctx.moveTo(tx+.4*scale,ty-.8*scale);ctx.lineTo(tx+2.4*scale,ty-.1*scale);ctx.lineTo(tx+.4*scale,ty+.6*scale);ctx.closePath();iron();
  }
  }
}
// Knight's cloak: hangs from the shoulders behind the body to the ankles, wider than the body so
// its edges show at the sides; the lining in the second tincture shows at the hem.
function drawKnightCloak(base,scale,bodyW,bodyH,top,livery){
  const hem=base.y+bodyH*.36,lw=Math.max(.6,.7*scale);
  const cloak=()=>{ctx.beginPath();ctx.moveTo(base.x-bodyW*.36,top-.2*scale);ctx.lineTo(base.x+bodyW*.36,top-.2*scale);
    ctx.quadraticCurveTo(base.x+bodyW*.9,top+bodyH*.5,base.x+bodyW*.98,hem);
    ctx.quadraticCurveTo(base.x,hem+bodyH*.1,base.x-bodyW*.98,hem);
    ctx.quadraticCurveTo(base.x-bodyW*.9,top+bodyH*.5,base.x-bodyW*.36,top-.2*scale);ctx.closePath()};
  cloak();ctx.fillStyle=livery.mainDark||livery.main;ctx.fill();
  ctx.save();cloak();ctx.clip();ctx.fillStyle=livery.alt;ctx.fillRect(base.x-bodyW,hem-1.1*scale,bodyW*2,2*scale);ctx.restore();
  cloak();ctx.strokeStyle='rgba(25,24,22,.85)';ctx.lineWidth=lw;ctx.stroke();
}
// Knight's heraldic crest (cimiero; product owner, 17/11/2026, from reference crests): a figure
// standing on a torse (the twisted wreath in the two tinctures) with mantling (lambrequin)
// hanging behind the helmet. The figure is one per knight, stable by id: wings, stag antlers,
// curved horns, eagle, crown. Shared by the knight on foot and the mounted knight
// (settlement-mounted2d.js): g the canvas, x the helmet's centre, top the helmet's top, u the
// helmet's half width, lw the outline width. The man-at-arms wears the same helmets without it.
const KNIGHT_CRESTS=Object.freeze(['wings','antlers','horns','eagle','crown']);
const KNIGHT_CREST_TOP={greathelm:1.2,nasal:1.7,kettle:1.07,barbuta:1.06,cap:1.0};
const CREST_OUTLINE='rgba(25,24,22,.85)',CREST_GOLD='#d2ad4b',CREST_BONE='#e8dcc0';
function knightCrestKind(id){
  const pin=State.policies?.knightCrest;
  if(KNIGHT_CRESTS.includes(pin))return pin;
  let h=peasantHash(String(id)+':crest');h=Math.imul(h^(h>>>16),0x45d9f3b);h=(h^(h>>>16))>>>0;
  return KNIGHT_CRESTS[h%KNIGHT_CRESTS.length];
}
// Mantling: two dagged strips of cloth from the top of the helmet down both sides, behind it.
// Drawn BEFORE the helmet. Outside in the first tincture, the lining in the second.
function drawHeraldicMantling(g,x,top,u,livery,lw){
  g.save();
  for(const s of [-1,1]){
    const strip=()=>{g.beginPath();g.moveTo(x+s*u*.2,top+u*.1);
      g.quadraticCurveTo(x+s*u*1.7,top+u*.3,x+s*u*1.75,top+u*1.6);
      g.lineTo(x+s*u*1.45,top+u*1.35);g.lineTo(x+s*u*1.5,top+u*2.1);g.lineTo(x+s*u*1.15,top+u*1.7);
      g.lineTo(x+s*u*1.1,top+u*2.4);g.quadraticCurveTo(x+s*u*.9,top+u*1.0,x+s*u*.2,top+u*.6);g.closePath()};
    strip();g.fillStyle=livery.main;g.fill();
    g.save();strip();g.clip();g.fillStyle=livery.alt;
    g.beginPath();g.moveTo(x+s*u*1.75,top+u*1.2);g.lineTo(x+s*u*1.0,top+u*2.5);g.lineTo(x+s*u*1.9,top+u*2.5);g.closePath();g.fill();g.restore();
    strip();g.strokeStyle=CREST_OUTLINE;g.lineWidth=lw;g.lineJoin='round';g.stroke();
  }
  g.restore();
}
// Torse and figure: drawn AFTER the helmet.
function drawHeraldicCrest(g,x,top,u,kind,livery,lw){
  const shape=(pts,fill)=>{g.beginPath();pts.forEach(([px,py],i)=>i?g.lineTo(x+px*u,top+py*u):g.moveTo(x+px*u,top+py*u));g.closePath();
    g.fillStyle=fill;g.fill();g.strokeStyle=CREST_OUTLINE;g.lineWidth=lw;g.lineJoin='round';g.stroke()};
  const branch=(pts,w,color=CREST_BONE)=>{for(const [c,ww] of [[CREST_OUTLINE,w+lw*1.6],[color,w]]){
    g.strokeStyle=c;g.lineWidth=ww;g.lineCap='round';g.lineJoin='round';g.beginPath();
    pts.forEach(([px,py],i)=>i?g.lineTo(x+px*u,top+py*u):g.moveTo(x+px*u,top+py*u));g.stroke()}};
  const wreath=-.28;   // top of the torse; the figure stands on it
  g.save();
  if(kind==='wings'){
    // A pair of tall wings, scalloped on the inside, in the two tinctures.
    for(const [s,col] of [[-1,livery.main],[1,livery.alt]])
      shape([[s*.25,wreath],[s*1.0,wreath-.2],[s*1.15,wreath-1.4],[s*.95,wreath-3.1],[s*.62,wreath-2.6],[s*.6,wreath-1.9],[s*.35,wreath-1.6],[s*.38,wreath-.9]],col);
  }else if(kind==='antlers'){
    for(const s of [-1,1]){
      branch([[s*.3,wreath],[s*.75,wreath-.9],[s*.95,wreath-2.0],[s*1.35,wreath-2.9]],Math.max(.8,u*.2));
      branch([[s*.8,wreath-1.1],[s*1.45,wreath-1.5]],Math.max(.7,u*.16));
      branch([[s*.92,wreath-1.8],[s*.55,wreath-2.6]],Math.max(.7,u*.16));
      branch([[s*1.15,wreath-2.45],[s*1.7,wreath-2.6]],Math.max(.6,u*.14));
    }
  }else if(kind==='horns'){
    // Two horns curving out and up, in the first tincture with a gold tip.
    for(const s of [-1,1]){
      g.beginPath();g.moveTo(x+s*u*.25,top+u*wreath);
      g.quadraticCurveTo(x+s*u*1.9,top+u*(wreath-.2),x+s*u*1.35,top+u*(wreath-2.5));
      g.quadraticCurveTo(x+s*u*1.45,top+u*(wreath-.75),x+s*u*.3,top+u*(wreath-.55));g.closePath();
      g.fillStyle=livery.main;g.fill();g.strokeStyle=CREST_OUTLINE;g.lineWidth=lw;g.stroke();
      g.fillStyle=CREST_GOLD;g.beginPath();g.arc(x+s*u*1.35,top+u*(wreath-2.45),Math.max(.5,u*.14),0,Math.PI*2);g.fill();
    }
  }else if(kind==='eagle'){
    // Eagle rising: a wing behind, neck and hooked head with a gold beak.
    shape([[-.2,wreath],[-1.25,wreath-.6],[-1.5,wreath-2.4],[-.95,wreath-1.9],[-.75,wreath-2.5],[-.45,wreath-1.7],[-.05,wreath-.5]],livery.alt);
    shape([[-.35,wreath],[.35,wreath],[.45,wreath-1.2],[.7,wreath-1.9],[.3,wreath-2.25],[-.15,wreath-1.9],[-.2,wreath-1.0]],livery.main);
    shape([[.62,wreath-2.0],[1.15,wreath-1.85],[.95,wreath-1.55],[.6,wreath-1.65]],CREST_GOLD);
    g.fillStyle='#16181a';g.beginPath();g.arc(x+u*.35,top+u*(wreath-1.95),Math.max(.4,u*.08),0,Math.PI*2);g.fill();
  }else{
    // Crown of gold with three points, a ball of the second tincture on each.
    shape([[-.8,wreath],[.8,wreath],[.9,wreath-1.0],[.45,wreath-.55],[0,wreath-1.2],[-.45,wreath-.55],[-.9,wreath-1.0]],CREST_GOLD);
    for(const [px,py] of [[-.9,-1.05],[0,-1.25],[.9,-1.05]]){g.fillStyle=livery.alt;g.beginPath();g.arc(x+px*u,top+u*(wreath+py),Math.max(.5,u*.17),0,Math.PI*2);g.fill();g.strokeStyle=CREST_OUTLINE;g.lineWidth=lw*.7;g.stroke()}
  }
  // Torse: a twisted band of the two tinctures across the top of the helmet.
  const band=()=>{g.beginPath();g.moveTo(x-u*1.0,top+u*.05);g.quadraticCurveTo(x,top-u*.12,x+u*1.0,top+u*.05);
    g.lineTo(x+u*.95,top+u*wreath);g.quadraticCurveTo(x,top+u*(wreath-.18),x-u*.95,top+u*wreath);g.closePath()};
  band();g.fillStyle=livery.main;g.fill();
  g.save();band();g.clip();g.fillStyle=livery.alt;
  for(let k=-3;k<3;k+=2){g.beginPath();g.moveTo(x+u*k*.33,top+u*.1);g.lineTo(x+u*(k+1)*.33,top+u*.1);g.lineTo(x+u*(k+1.6)*.33,top+u*(wreath-.2));g.lineTo(x+u*(k+.6)*.33,top+u*(wreath-.2));g.closePath();g.fill()}
  g.restore();band();g.strokeStyle=CREST_OUTLINE;g.lineWidth=lw;g.stroke();
  g.restore();
}
// Knight on foot: helmet top from the style; mantling before the helmet, crest after it.
function knightCrestGeometry(x,headY,headR,helmet){return{x,top:headY-headR*(KNIGHT_CREST_TOP[helmet]||1.05),u:headR}}
function drawKnightMantling(x,headY,headR,helmet,livery,scale){
  const c=knightCrestGeometry(x,headY,headR,helmet);drawHeraldicMantling(ctx,c.x,c.top,c.u,livery,Math.max(.5,.55*scale));
}
function drawKnightCrest(x,headY,headR,helmet,livery,scale,id){
  const c=knightCrestGeometry(x,headY,headR,helmet);drawHeraldicCrest(ctx,c.x,c.top,c.u,knightCrestKind(id),livery,Math.max(.5,.55*scale));
}
// Hands that do not move with a weapon swing (FIG-HANDS-261117). The figure faces the viewer,
// so the right hand is on screen left: the patrol spearman's free (left) hand hangs at his
// side on screen right; the herald's right hand holds the standard's mast; both archer hands
// on the bow (grip and nocked string). Pikemen and the herald hold the shield on the left arm,
// hand hidden behind it. Shared by the still and the combat figure.
function drawSoldierFixedHands(type,base,bodyW,bodyH,bodyY,scale){
  if(type==='spearman')drawFigureHand(base.x+bodyW*.52,bodyY+bodyH*.2,scale);
  else if(type==='herald')drawFigureHand(soldierSpearHandX(base,bodyW),bodyY+bodyH*SPEAR_HAND_Y,scale);
  else if(type==='archer'){
    const bx=base.x+bodyW*.62,by=bodyY-bodyH*.04,r=5.3*scale;
    drawFigureHand(bx+r,by,scale);drawFigureHand(bx-r*.18,by,scale);
  }
}
// The spear hand closes on the shaft at the waist: a point of the shaft drawn from (x,gy) up
// to (x+scale, tipY) (the shaft leans out from the right hand), at height y in the shaft's own
// (unrotated) frame. Close to the butt pivot, so a lowered pike keeps the hand by the body.
const SPEAR_HAND_Y=.22;
function drawSpearHand(x,gy,tipY,y,scale){
  drawFigureHand(x+scale*(gy-y)/(gy-tipY),y,scale);
}
// facing: the world heading the figure walks or looks along ({x,y}), or a view name; none: S.
function drawSoldierFigure(p,z,type,id,phase=0,liveryOverride=null,facing=null){
  const view=footViewOf(p,facing);
  return withUrbanFigureOcclusion(p,z,()=>drawSoldierFigureUnmasked(p,z,type,id,phase,liveryOverride,false,view));
}
// posed: the combat animation (settlement-combat-anim.js) draws this body as 'unarmed' and adds
// the weapon and its hand itself; a really unarmed figure keeps both hands at its sides.
// view: one of FOOT_VIEW_NAMES (S, the approved art, by default).
function drawSoldierFigureUnmasked(p,z,type,id,phase=0,liveryOverride=null,posed=false,view='S'){
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
  if(type==='manAtArms')return drawManAtArmsUnmasked(base,scale,id,liveryOverride,undefined,footTurn(view));
  const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,headY=top-headR*.72,livery=liveryOverride||soldierLivery(id);
  // Knights on foot ('knight'; 'knightUnarmed' is the posed body, weapons drawn by the combat
  // animation): cloak on the back and the crest on the helmet (product owner, 17/11/2026).
  const knightly=type==='knight'||type==='knightUnarmed';
  if(type==='knightUnarmed')type='unarmed';

  const t=footTurn(view);
  // Gear (FOOT-VIEWS): each piece a card at its place across the body. In S all of it is in front,
  // in the order of the approved art; turned, what is behind the body is drawn before it.
  const gear=[];
  const add=(lx,lz,draw)=>gear.push({lx,lz,draw});
  const shield=()=>{
    const shape=liveryOverride?'oval':soldierShieldStyle();
    if(t&&!t.front)drawShieldBack(base.x+bodyW*.62,bodyY+bodyH*.10,2.7*scale,3.6*scale,'#b7aa8f',scale,shape);
    else drawQuarteredShield(base.x+bodyW*.62,bodyY+bodyH*.10,2.7*scale,3.6*scale,livery,'#b7aa8f',scale,!liveryOverride,shape);
  };
  if(type==='spearman'||type==='pikeman'||type==='herald'){
    // The figure faces the viewer: its right hand (spear, standard) is on screen left, the left arm
    // (shield) on screen right. Pikemen and the regiment's herald carry the realm shield; patrol
    // guards ('spearman') none. The herald holds the standard instead of the spear (drawn by the
    // combat overlay, drawSquadStandard).
    if(type!=='spearman')add(bodyW*.62,bodyW*.12,shield);
    if(type!=='herald')add(-bodyW*.55,bodyW*.1,()=>drawSoldierSpear(base,scale,bodyW,bodyH,bodyY,headY));
  }else if(type==='archer'){
    add(bodyW*.62,bodyW*.15,()=>{
      const bx=base.x+bodyW*.62,by=bodyY-bodyH*.04,r=5.3*scale;
      ctx.strokeStyle='#9b7243';ctx.lineWidth=Math.max(.8,.85*scale);
      ctx.beginPath();ctx.arc(bx,by,r,-Math.PI*.55,Math.PI*.55);ctx.stroke();
      ctx.beginPath();ctx.moveTo(bx+Math.cos(-Math.PI*.55)*r,by+Math.sin(-Math.PI*.55)*r);
      ctx.lineTo(bx-r*.18,by);
      ctx.lineTo(bx+Math.cos(Math.PI*.55)*r,by+Math.sin(Math.PI*.55)*r);ctx.stroke();
    });
  }else if(type==='axeman'){
    add(0,bodyW*.1,()=>drawAxeAndRoundShield(base,scale,bodyW,bodyH,bodyY,top,null));
  }else if(type!=='unarmed'){
    // Sword in the right hand (screen left), shield on the left arm (screen right).
    const swing=Math.sin(phase*Math.PI*2)*3.2*scale;
    add(bodyW*.62,bodyW*.12,shield);
    add(-bodyW*.42,bodyW*.1,()=>{
      ctx.strokeStyle='#c4c7c8';ctx.lineWidth=Math.max(1,1.15*scale);
      ctx.beginPath();ctx.moveTo(base.x-bodyW*.42,bodyY+bodyH*.16);ctx.lineTo(base.x-bodyW*.80-swing,top-7.5*scale);ctx.stroke();
      ctx.strokeStyle='#76563b';ctx.lineWidth=Math.max(1,1.2*scale);
      ctx.beginPath();ctx.moveTo(base.x-bodyW*.23,bodyY+bodyH*.05);ctx.lineTo(base.x-bodyW*.52,bodyY+bodyH*.27);ctx.stroke();
      drawFigureHand(base.x-bodyW*.40,bodyY+bodyH*.13,scale);   // sword hand on the grip (right hand, screen left)
    });
  }
  const fixedHand={spearman:bodyW*.52,herald:-bodyW*.55,archer:bodyW*.62}[type];
  if(fixedHand!==undefined)add(fixedHand,bodyW*.12,()=>drawSoldierFixedHands(type,base,bodyW,bodyH,bodyY,scale));
  if(type==='unarmed'&&!posed)for(const side of[-1,1])add(side*bodyW*.52,0,()=>drawFigureHand(base.x+side*(bodyW*.52+.1*scale),bodyY+bodyH*.2,scale));
  const drawGear=front=>{for(const p of gear)if((footDepth(t,p.lx,p.lz)>=0)===front)withFootCard(ctx,t,base.x,p.lz,p.draw)};

  ctx.save();
  // The cloak hangs behind: before the body, unless seen from behind.
  const cloakBehind=!t||t.front;
  const cloak=()=>withFootVolume(ctx,t,base.x,-bodyW*.25,()=>drawKnightCloak(base,scale,bodyW,bodyH,top,livery),.8);
  if(knightly&&cloakBehind)cloak();
  drawGear(false);
  drawFootViewFeet(t,base.x,bodyY+bodyH/2,bodyW,scale);

  // Realm livery: every soldier carries both current reign colours.
  if(!t){
    soldierBodyPath(base,bodyW,bodyH,top,bodyY);ctx.save();ctx.clip();
    if(liveryOverride||!window.__conquerHeraldryCanvas?.paint(ctx,base.x-bodyW*.5,top,bodyW,bodyH)){
      ctx.fillStyle=livery.main;ctx.fillRect(base.x-bodyW,top,bodyW*2,bodyH);
      ctx.fillStyle=livery.alt;ctx.fillRect(base.x,top,bodyW,bodyH);
    }
    ctx.restore();
  }else fillFootLivery(t,base.x,()=>soldierBodyPath(base,bodyW,bodyH,top,bodyY),{x:base.x-bodyW*.5,y:top,w:bodyW,h:bodyH},livery,!liveryOverride);
  withFootVolume(ctx,t,base.x,0,()=>soldierBodyPath(base,bodyW,bodyH,top,bodyY));
  ctx.strokeStyle='rgba(25,24,22,.88)';ctx.lineWidth=Math.max(.7,.8*scale);ctx.stroke();
  if(knightly&&!cloakBehind)cloak();

  // Head + helmet: the realm's own soldiers wear the feudal helmet, foes (livery override) the cap;
  // a knight with a livery override (foe, tournament) wears the great helm.
  const helmet=liveryOverride?(knightly?'greathelm':'cap'):soldierHelmetStyle();
  const mantling=()=>withFootVolume(ctx,t,base.x,-headR*.4,()=>drawKnightMantling(base.x,headY,headR,helmet,livery,scale),.6);
  if(knightly&&cloakBehind)mantling();
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.fill();
  drawFootViewHair(t,base.x,headY,headR);
  drawSoldierHelmet(base.x,headY,headR,helmet,scale,t);
  if(knightly&&!cloakBehind)mantling();
  if(knightly)withFootCard(ctx,t,base.x,0,()=>drawKnightCrest(base.x,headY,headR,helmet,livery,scale,id));

  drawGear(true);

  ctx.restore();
}
function drawNobleFigure(p,z,id,phase=0){
  const scale=militaryScale(),bob=Math.sin(phase*Math.PI*2)*.018;
  const base=w2s(p,z+bob),bodyW=5.2*scale,bodyH=9.0*scale,headR=2.25*scale;
  const bodyY=base.y-bodyH*.16,top=bodyY-bodyH/2,headY=top-headR*.72;
  const flip=(peasantHash(String(id)+'-noble')&1)!==0;
  const main=flip?'#6f355d':'#2f4f75',trim='#c6a457';
  ctx.save();
  drawFigureFeet(base.x,bodyY+bodyH*.52,bodyW,scale);
  ctx.beginPath();ctx.moveTo(base.x-bodyW*.36,top);ctx.lineTo(base.x+bodyW*.36,top);
  ctx.lineTo(base.x+bodyW*.58,bodyY+bodyH*.52);ctx.lineTo(base.x-bodyW*.58,bodyY+bodyH*.52);ctx.closePath();
  ctx.fillStyle=main;ctx.fill();ctx.strokeStyle='rgba(28,22,24,.9)';ctx.lineWidth=Math.max(.7,.8*scale);ctx.stroke();
  ctx.strokeStyle=trim;ctx.lineWidth=Math.max(1,1.15*scale);
  ctx.beginPath();ctx.moveTo(base.x-bodyW*.42,bodyY+bodyH*.26);ctx.lineTo(base.x+bodyW*.42,bodyY+bodyH*.26);ctx.stroke();
  for(const side of[-1,1])drawFigureHand(base.x+side*(bodyW*.52+.1*scale),bodyY+bodyH*.2,scale);
  const sex=(peasantHash(String(id)+'-sex')&1)?'female':'male';
  drawVillagerHead(id,base.x,headY,headR,sex,villagerHair(id));
  ctx.fillStyle=trim;ctx.fillRect(base.x-headR*.72,headY-headR*.82,headR*1.44,Math.max(1,1.1*scale));
  ctx.restore();
}
