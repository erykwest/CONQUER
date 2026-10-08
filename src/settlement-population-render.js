'use strict';
// Presentation layer for villagers, castle guards, and training soldiers.
// Classic-script shared globals deliberately match the existing render pipeline.
// Population routing, schedules, and patrol positions stay in settlement-population.js.
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
function drawVillagerFigure(dot){
  const base=w2s(dot.p,.10),scale=clamp(State.view.scale,.55,1.45);
  const kind=dot.kind,sizeFactor=dot.age==='child'?.5:1;
  const bodyW=clamp(6.0*scale,4.2,8.2)*sizeFactor,bodyH=clamp(8.0*scale,5.5,10.6)*sizeFactor;
  const headR=clamp(2.35*scale,1.8,3.15)*sizeFactor,bodyY=base.y-bodyH*.16;
  drawSplitVillagerBody(kind,base.x,bodyY,bodyW,bodyH,dot.colors[0],dot.colors[1]);
  drawVillagerHead(dot.id,base.x,bodyY-bodyH/2-headR*.68,headR,dot.sex,dot.hair);
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
  if(!houses.length)return;
  const day=peasantVisualDay(),dots=[];
  let representedPopulation=0,activeAgents=0;
  const peasantHouses=houses.filter(h=>houseLevel(h)===1);
  const assignments=fieldWorkAssignments(peasantHouses,fields);

  const residentStride=State.view.scale<.30?3:State.view.scale<.55?2:1;
  for(const house of houses){
    representedPopulation+=housePopulationCapacity(house).total;
    const kind=villagerClass(house),assignment=assignments.get(house.id);
    for(const resident of houseResidents(house)){
      if(residentStride>1&&(resident.lodHash%residentStride)!==0)continue;
      let p=residentClassPosition(house,resident,day,assignment);
      if(p)p={x:p.x+resident.scatterX,y:p.y+resident.scatterY};
      // Recall/release may keep a resident visible while their ordinary
      // day schedule is inactive; the tactical subsystem owns that transition.
      p=window.ConquerCombat?.civilPosition(p,house,resident)??p;
      if(!p||!worldPointVisible(p,0,40))continue;
      const rp=rotateViewPoint(p);
      dots.push({
        p,depth:rp.x+rp.y,id:resident.id,kind,sex:resident.sex,age:resident.age,
        hair:resident.hair,colors:resident.colors
      });
      activeAgents++;
    }
  }
  dots.sort((a,b)=>a.depth-b.depth);
  if(window.__conquerPerf){
    window.__conquerPerf.representedPopulation=representedPopulation;
    window.__conquerPerf.visibleVillagers=activeAgents;
  }
  for(const dot of dots)drawVillagerFigure(dot);
}
function militaryScale(){
  return clamp(State.view.scale,.55,1.45);
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
function drawQuarteredShield(cx,cy,rx,ry,livery,stroke,scale,useHeraldry=true){
  ctx.save();
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.clip();
  if(!useHeraldry||!window.__conquerHeraldryCanvas?.paint(ctx,cx-rx,cy-ry,rx*2,ry*2)){
    ctx.fillStyle=livery.main;ctx.fillRect(cx-rx,cy-ry,rx*2,ry*2);
    ctx.fillStyle=livery.alt;ctx.fillRect(cx,cy-ry,rx,ry*2);
  }
  ctx.restore();
  ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.8,.9*scale);
  ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function drawSoldierFigure(p,z,type,id,phase=0,liveryOverride=null){
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

  // Head + steel cap.
  ctx.fillStyle=VILLAGER_SKIN;ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#70777c';ctx.beginPath();ctx.arc(base.x,headY,headR,Math.PI,Math.PI*2);ctx.lineTo(base.x-headR,headY);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(30,30,30,.75)';ctx.beginPath();ctx.arc(base.x,headY,headR,0,Math.PI*2);ctx.stroke();

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
  }else{
    const swing=Math.sin(phase*Math.PI*2)*3.2*scale;
    drawQuarteredShield(base.x-bodyW*.62,bodyY+bodyH*.10,2.7*scale,3.6*scale,livery,'#b7aa8f',scale,!liveryOverride);
    // Sword.
    ctx.strokeStyle='#c4c7c8';ctx.lineWidth=Math.max(1,1.15*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.42,bodyY+bodyH*.16);ctx.lineTo(base.x+bodyW*.80+swing,top-7.5*scale);ctx.stroke();
    ctx.strokeStyle='#76563b';ctx.lineWidth=Math.max(1,1.2*scale);
    ctx.beginPath();ctx.moveTo(base.x+bodyW*.23,bodyY+bodyH*.05);ctx.lineTo(base.x+bodyW*.52,bodyY+bodyH*.27);ctx.stroke();
  }

  ctx.restore();
}

function drawCastleSoldiers(){
  const day=peasantVisualDay();

  // Two stationary spearmen guard the exterior mouth of every completed gate.
  // Their ground Z deliberately follows terrain instead of the gate foundation
  // plane, so guards remain planted correctly on sloped approaches.
  for(const gate of State.structures){
    if(gate.type!=='gate'||underConstruction(gate))continue;
    const guards=gateGuardPositions(gate);
    for(let i=0;i<guards.length;i++){
      const p=guards[i],z=.08;
      if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'spearman',gate.id+':gate-guard:'+i,day+i*.5);
    }
  }

  // Wall and palisade patrol density follows tier: T1=0, T2=1, T3=2.
  for(const wall of State.structures){
    if(!['wall','palisade'].includes(wall.type)||underConstruction(wall))continue;
    const tier=wallTier(wall),count=tier===1?0:tier===3?2:1;
    const z=wall.type==='palisade'?palisadePatrolSurface(wall).z:structureHeight(wall)+.10;
    for(let i=0;i<count;i++){
      const p=wallPatrolPoint(wall,day,i,count);
      if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'spearman',wall.id+':patrol:'+i,day+i*.5);
    }
  }

  // One archer lookout on every completed fighting tower.
  for(const tower of State.structures){
    if(tower.type!=='tower'||underConstruction(tower))continue;
    let p,z;

    if(isWoodTower(tower)){
      const style=woodTowerStyle(tower);
      p=woodTowerLocal(tower,0,.03);
      // Keep the sprite below the roof eave; front parapet/rail is redrawn later
      // by the same castleFront protocol used by wall battlements.
      z=style==='watchtower'?1.46:1.82;
    }else{
      if(towerRoofStyle(tower)!=='battlement')continue;
      const hash=peasantHash(tower.id+'-archer'),a=(hash%360)*Math.PI/180;
      const radius=tower.shape==='round'?tower.r*.26:(tower.size||1)*.18;
      p={x:tower.x+Math.cos(a)*radius,y:tower.y+Math.sin(a)*radius};
      z=structureHeight(tower)+.08;
    }

    withStructureGroundPlane(tower,()=>{
      if(worldPointVisible(p,z,48))drawSoldierFigure(p,z,'archer',tower.id,day);
    });
  }
}
function drawTrainingSoldiers(){
  const day=peasantVisualDay(),dots=[];
  for(const yard of State.structures){
    if(yard.type!=='training'||underConstruction(yard))continue;
    const seed=(peasantHash(yard.id+'-training')%1000)/1000;
    const pulse=day*.80+seed;
    const spots=[
      {x:-1.15,y:-.62,pair:0},{x:1.15,y:-.62,pair:0},
      {x:-1.15,y:.72,pair:1},{x:1.15,y:.72,pair:1}
    ];
    for(let i=0;i<spots.length;i++){
      const s=spots[i],side=i%2===0?1:-1;
      const advance=Math.sin((pulse+s.pair*.37)*Math.PI*2)*.20*side;
      const local={x:s.x+advance,y:s.y};
      const p=houseLocalToWorld(yard,local.x,local.y);
      if(!worldPointVisible(p,.13,48))continue;
      dots.push({p,z:.13,id:yard.id+':knight:'+i,phase:pulse+i*.17});
    }
  }
  dots.sort((a,b)=>viewDepthPoint(a.p)-viewDepthPoint(b.p));
  for(const d of dots)drawSoldierFigure(d.p,d.z,'knight',d.id,d.phase);
}
