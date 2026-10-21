'use strict';
// Siege earthworks: the attackers fill a ravine with earth and brushwood until it reaches
// the level of the ground they want to reach. Each finished Z level becomes a graded
// terraforming terrace (sand-coloured fill), so elevation, slopes, navigation and the 3D
// ground all follow the existing terrain contracts. A level costs 3x the effort of filling
// a moat crossing (MOAT_FILL_EFFORT, settlement-crossings progressFilling: a 1.5U dry
// moat, one crew), paid by the men working at the foot of the mound.
(() => {
  // EDGE: the run of each level's slope, 0.5U per level of height (a 2:1 bank of earth).
  const MOAT_FILL_EFFORT=2.5,LEVEL_EFFORT=3*MOAT_FILL_EFFORT,RADIUS=3,EDGE=.5;
  const SAND={top:'#c9b17a',side:['#b89c63','#a88d57']};
  function list(){
    const s=window.ConquerSiege?.state?.()||State.siege||(State.siege={});
    if(!Array.isArray(s.earthworks))s.earthworks=[];
    return s.earthworks;
  }
  function T(){return window.ConquerTerraforming}
  function zAt(p){return typeof terrainElevation==='function'?terrainElevation(p):0}
  // The level to reach: the highest flat ground touching the mound's top.
  function targetNear(center,radius){
    let best=zAt(center);
    for(let r=radius*.5;r<=radius+EDGE+.01;r+=.5)for(let k=0;k<16;k++){
      const a=k/16*Math.PI*2,p={x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};
      const z=typeof terrainPlateauElevation==='function'?terrainPlateauElevation(p):null;
      if(z!=null&&z>best)best=z;
    }
    return best;
  }
  function start(center,{targetZ,radius=RADIUS}={}){
    const baseZ=zAt(center),goal=Number.isFinite(targetZ)?targetZ:targetNear(center,radius);
    if(!(goal>baseZ+.25))return{ok:false,reason:'Nothing to fill: the ground is already at that level'};
    const probe=T()?.preview(center,{mode:'terrain',radius,delta:1});
    if(!probe?.ok)return{ok:false,reason:probe?.reason||'Terraforming unavailable'};
    // A stepped mound: each level is narrower than the one under it, so the slopes run
    // continuously from the valley floor to the top (one level per EDGE of run, less when
    // a deep fill would exceed the terraforming radius limit).
    const total=Math.ceil(goal-baseZ-1e-6),maxR=T().LIMITS.maxRadius;
    const step=total>1?Math.min(EDGE,(maxR-radius)/(total-1)):EDGE;
    const w={id:'earthwork-'+(list().length+1)+'-'+Math.round(center.x*10)+'-'+Math.round(center.y*10),
      center:{x:center.x,y:center.y},radius,step,total,baseZ,targetZ:goal,levels:0,progress:0,edits:[]};
    list().push(w);changed();
    return{ok:true,work:w,levels:total};
  }
  function levelRadius(w,k){return w.radius+Math.max(0,(w.total??1)-1-k)*(w.step??EDGE)}
  function currentZ(w){return Math.min(w.targetZ,w.baseZ+w.levels)}
  function done(w){return currentZ(w)>=w.targetZ-1e-6}
  // Who digs: every foot soldier standing at the mound, either side. Knights do not.
  function workers(w){
    const reach=w.radius+EDGE+1;let n=0;
    const all=[...(window.ConquerCombat?.units?.()||[]),...(window.ConquerCombat?.enemy?.()||[])];
    for(const u of all){
      if(u.defeated||u.kind==='knight'||u.kind==='wolf'||u.routing)continue;
      if(Math.hypot(u.x-w.center.x,u.y-w.center.y)>reach)continue;
      n+=u.kind==='patrol'?.4:1;
    }
    return n;
  }
  function raiseLevel(w){
    const ghost=T()?.preview(w.center,{mode:'terrain',radius:levelRadius(w,w.levels),delta:1});
    if(!ghost?.ok||!T().commit(ghost))return false;
    const edit=T().edits().at(-1);
    edit.material='fill';edit.earthwork=w.id;
    // A steeper bank than a graded terrace: its outer ring sits EDGE beyond the top.
    edit.edgeWidth=EDGE;
    edit.outer=edit.top.map(p=>{const dx=p.x-edit.center.x,dy=p.y-edit.center.y,k=(edit.radius+EDGE)/edit.radius;return{x:edit.center.x+dx*k,y:edit.center.y+dy*k}});
    if(edit.targetZ>w.targetZ)edit.targetZ=w.targetZ;
    w.edits.push(edit.id);w.levels++;
    return true;
  }
  function tick(days,{force}={}){
    let raised=false;
    for(const w of list()){
      if(done(w))continue;
      const effort=(force??workers(w))*Math.max(0,days);
      if(!effort)continue;
      w.progress+=effort/LEVEL_EFFORT;
      while(w.progress>=1&&!done(w)){
        if(!raiseLevel(w)){w.progress=0;break}
        w.progress-=1;raised=true;
      }
      if(done(w))w.progress=0;
    }
    if(raised){
      if(typeof clearReliefBandCache==='function')clearReliefBandCache();
      if(typeof invalidateNavigation==='function')invalidateNavigation(true);
      if(typeof markDirty==='function')markDirty(true,'all');
      changed();
    }
    return raised;
  }
  function changed(){if(typeof scheduleLocalSave==='function')scheduleLocalSave()}
  // 3D: a sand skin over each finished level, and the level in progress rising as a
  // truncated cone of fresh earth.
  function cone(pos,col,center,r0,r1,z0,z1,rotation=-Math.PI/24){
    const N=24,P=(r,a,z)=>[center.x+Math.cos(a)*r,center.y+Math.sin(a)*r,z];
    for(let i=0;i<N;i++){
      const a=rotation+i/N*Math.PI*2,b=rotation+(i+1)/N*Math.PI*2;
      const c=SAND.side[i%2];
      for(const q of [P(r0,a,z0),P(r0,b,z0),P(r1,b,z1),P(r0,a,z0),P(r1,b,z1),P(r1,a,z1)])pos.push(...q);col.push(c,c);
      for(const q of [[center.x,center.y,z1],P(r1,a,z1),P(r1,b,z1)])pos.push(...q);col.push(SAND.top);
    }
  }
  function meshes(){
    const out=[];
    for(const w of list()){
      const pos=[],col=[],lift=.03;
      for(const id of w.edits){
        const e=T()?.edits().find(x=>x.id===id);
        if(e)cone(pos,col,e.center,e.radius+e.edgeWidth,e.radius,e.baseZ+lift,e.targetZ+lift,e.rotation);
      }
      if(!done(w)&&w.progress>0){
        const z0=currentZ(w),h=Math.min(1,w.targetZ-z0)*w.progress;
        const r=levelRadius(w,w.levels);
        cone(pos,col,w.center,r+EDGE*w.progress,r,z0+lift,z0+h+lift);
      }
      if(pos.length)out.push({pos,col});
    }
    return out;
  }
  function status(w){
    return{levels:w.levels,total:Math.ceil(w.targetZ-w.baseZ-1e-6),progress:w.progress,z:currentZ(w)+(done(w)?0:w.progress*Math.min(1,w.targetZ-currentZ(w))),
      done:done(w),workers:workers(w),daysPerLevel:workers(w)?LEVEL_EFFORT/workers(w):Infinity};
  }
  function cancel(id){const l=list(),i=l.findIndex(w=>w.id===id);if(i>=0){l.splice(i,1);changed()}return i>=0}
  window.ConquerEarthworks=Object.freeze({MOAT_FILL_EFFORT,LEVEL_EFFORT,SAND,list,start,tick,workers,meshes,status,cancel,targetNear});
})();
