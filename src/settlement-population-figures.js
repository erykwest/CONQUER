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
function drawVillagerFigure(dot){
  return withUrbanFigureOcclusion(dot.p,.10,()=>drawVillagerFigureUnmasked(dot));
}
function drawVillagerFigureUnmasked(dot){
  const base=w2s(dot.p,.10),scale=State.view.scale*.5;
  const kind=dot.kind,sizeFactor=dot.age==='child'?.5:1;
  const bodyW=6.0*scale*sizeFactor,bodyH=8.0*scale*sizeFactor;
  const headR=2.35*scale*sizeFactor,bodyY=base.y-bodyH*.16;
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
  const farmHouses=houses.filter(h=>houseLevel(h)===1||houseLevel(h)===2);
  const assignments=fieldWorkAssignments(farmHouses,fields);

  const residentStride=State.view.scale<.30?3:State.view.scale<.55?2:1;
  for(const house of houses){
    representedPopulation+=housePopulationCapacity(house).total;
    const kind=villagerClass(house),assignment=assignments.get(house.id);
    for(const resident of houseResidents(house)){
      // Alarm destinations are computed even for residents not selected by
      // distant-camera LOD, so mobilization does not depend on zoom level.
      let p=residentClassPosition(house,resident,day,assignment);
      if(p&&!(assignment&&resident.sex==='male'&&resident.age==='adult'&&houseLevel(house)<=2))p={x:p.x+resident.scatterX,y:p.y+resident.scatterY};
      const combatP=window.ConquerCombat?.civilPosition(p,house,resident);
      if(combatP!==undefined)p=combatP; // null means safely inside the Common Hall.
      // Footsteps follow every resident's actual position, independent of LOD.
      if(p)window.ConquerSnowTracks?.observe(resident.id,p,State.clock.day,'person');
      if(residentStride>1&&(resident.lodHash%residentStride)!==0)continue;
      if(!p||!worldPointVisible(p,0,40))continue;
      const rp=rotateViewPoint(p);
      dots.push({
        p,depth:rp.x+rp.y,id:resident.id,kind,sex:resident.sex,age:resident.age,
        hair:resident.hair,colors:resident.colors,
        militia:window.ConquerCombat?.recruitedResident(resident.id)||false
      });
      activeAgents++;
    }
  }
  dots.sort((a,b)=>a.depth-b.depth);
  if(window.__conquerPerf){
    window.__conquerPerf.representedPopulation=representedPopulation;
    window.__conquerPerf.visibleVillagers=activeAgents;
  }
  for(const dot of dots){
    if(dot.militia)drawSoldierFigure(dot.p,.10,'spearman',dot.id,day);
    else drawVillagerFigure(dot);
  }
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
  }else if(type!=='unarmed'){
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
