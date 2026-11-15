'use strict';
// Manual forest clearance is an L1 worksite, never an instant landscape edit.
// Jobs live alongside terraforming in State.relief so local/cloud saves retain them.
(() => {
  const STEP=.5, WOOD_PER_U2=2.5, WORK_PER_U2=.7, MAX_WORKERS=3;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const isWeekday=day=>((Math.floor(day)%7)+7)%7<5;
  function jobs(){
    if(!State.relief)return [];
    if(!Array.isArray(State.relief.forestryJobs))State.relief.forestryJobs=[];
    return State.relief.forestryJobs;
  }
  function shapePoints(center,radius,shape){
    if(shape==='square')return [
      {x:center.x-radius,y:center.y-radius},{x:center.x+radius,y:center.y-radius},
      {x:center.x+radius,y:center.y+radius},{x:center.x-radius,y:center.y+radius}
    ];
    return Array.from({length:32},(_,i)=>{
      const angle=i*Math.PI*2/32;
      return{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};
    });
  }
  function contains(center,radius,shape,p){
    const dx=p.x-center.x,dy=p.y-center.y;
    return shape==='square'?Math.abs(dx)<=radius&&Math.abs(dy)<=radius:dx*dx+dy*dy<=radius*radius;
  }
  function forestAt(p){
    return(State.environment||[]).some(f=>f.type==='forest'&&
      typeof environmentContains==='function'&&environmentContains(f,p));
  }
  function preview(center,options={}){
    const shape=options.shape==='square'?'square':'round';
    const radius=clamp(num(options.radius,4)||4,2,8);
    const point={x:num(center?.x),y:num(center?.y)};
    const polygon=shapePoints(point,radius,shape);
    const result={center:point,radius,shape,polygon,ok:false,reason:'',
      wood:0,workRequired:0,coveredArea:0};
    if(!State.village?.founded){result.reason='Found a village before assigning L1 forestry workers';return result;}
    if(!State.relief||polygon.some(p=>typeof inBuild==='function'&&!inBuild(p))){
      result.reason='Forest clearing must remain inside the buildable area';return result;
    }
    if(jobs().some(job=>num(job.construction?.workDone)<num(job.construction?.workRequired)&&
      Math.hypot(job.center.x-point.x,job.center.y-point.y)<job.radius+radius)){
      result.reason='Forest clearing overlaps another queued L1 job';return result;
    }
    let covered=0;
    for(let x=point.x-radius+STEP/2;x<point.x+radius;x+=STEP)
      for(let y=point.y-radius+STEP/2;y<point.y+radius;y+=STEP)
        if(contains(point,radius,shape,{x,y})&&forestAt({x,y}))covered++;
    result.coveredArea=covered*STEP*STEP;
    if(!covered){result.reason='No standing forest inside this area';return result;}
    result.wood=Math.max(1,Math.round(result.coveredArea*WOOD_PER_U2));
    result.workRequired=Math.max(1,Math.ceil(result.coveredArea*WORK_PER_U2));
    result.ok=true;
    return result;
  }
  function start(ghost){
    const p=preview(ghost?.center,ghost||{});
    if(!p.ok)return{ok:false,reason:p.reason};
    const day=Math.max(0,num(State.clock?.day));
    const used=new Set(jobs().map(j=>j.id));
    let i=1;while(used.has('forest-clear-'+i))i++;
    const job={id:'forest-clear-'+i,center:p.center,radius:p.radius,shape:p.shape,
      wood:p.wood,coveredArea:p.coveredArea,
      construction:{version:2,startedDay:day,lastWorkDay:day,
        workRequired:p.workRequired,workDone:0,workers:0,wagesPaid:0}};
    jobs().push(job);
    if(typeof scheduleLocalSave==='function')scheduleLocalSave();
    return{ok:true,job};
  }
  // Exactly the same L1 roster and paid shift contract as normal construction:
  // building sites take their workers first; forestry shares only unused adults.
  function crews(day){
    const allocation=new Map(),active=jobs().filter(j=>
      num(j.construction?.workDone)<num(j.construction?.workRequired)&&
      num(j.construction?.startedDay)<=day);
    for(const job of active)allocation.set(job.id,[]);
    if(!active.length||!isWeekday(day))return allocation;
    const candidates=window.ConquerEconomy?.availableBuilderIds?.(day)||[];
    const buildings=typeof constructionCrewAssignments==='function'?
      constructionCrewAssignments(day,Math.floor(day)+1):new Map();
    const occupied=new Set([...buildings.values()].flat().map(worker=>worker.id));
    const free=candidates.filter(worker=>!occupied.has(worker.id));
    // Spread labor across jobs before allocating their second and third slots.
    for(let pass=0;pass<MAX_WORKERS&&free.length;pass++)
      for(const job of active){
        if(!free.length)break;
        allocation.get(job.id).push(free.shift());
      }
    return allocation;
  }
  function clearPatch(job){
    let changed=false;
    for(const forest of [...(State.environment||[])]){
      if(forest.type!=='forest'||!forest.points?.length)continue;
      // Sample the actual standing woodland. An extremely narrow strip may
      // intersect the clearing without containing its centre or vertices.
      let affected=false;
      for(let x=job.center.x-job.radius+STEP/2;x<job.center.x+job.radius&&!affected;x+=STEP)
        for(let y=job.center.y-job.radius+STEP/2;y<job.center.y+job.radius;y+=STEP)
          if(contains(job.center,job.radius,job.shape,{x,y})&&environmentContains(forest,{x,y})){
            affected=true;break;
          }
      if(!affected)continue;
      if(!forest.continuous&&forest.points.every(p=>
        contains(job.center,job.radius,job.shape,p))){
        State.environment.splice(State.environment.indexOf(forest),1);
      }else{
        forest.holes=[...(forest.holes||[]),shapePoints(job.center,job.radius,job.shape)];
      }
      changed=true;
    }
    if(changed){
      if(typeof environmentRevision!=='undefined')environmentRevision++;
      if(typeof clearForestLayoutCache==='function')clearForestLayoutCache();
      if(typeof invalidateSceneCache==='function')invalidateSceneCache('landscape');
      if(typeof markDirty==='function')markDirty(true,['landscape','ground','base']);
      else if(typeof scheduleLocalSave==='function')scheduleLocalSave();
    }
    return changed;
  }
  function tick(fromDay,toDay){
    if(!State.village?.founded||!jobs().length)return 0;
    const end=num(toDay),start=num(fromDay);
    if(end<=start)return 0;
    let completed=0,changed=false,t=start,guard=0;
    while(t<end-1e-8&&guard++<10000){
      const next=Math.min(end,Math.floor(t)+1);
      if(next<=t+1e-8)break;
      const assigned=crews(t);
      for(const job of jobs()){
        const c=job.construction;
        if(!c||c.workDone>=c.workRequired-1e-8)continue;
        const from=Math.max(t,num(c.startedDay),num(c.lastWorkDay,c.startedDay));
        const n=assigned.get(job.id)?.length||0;
        const requested=isWeekday(t)?Math.min(c.workRequired-c.workDone,Math.max(0,next-from)*n):0;
        const paid=requested?window.ConquerEconomy?.payConstructionWork?.(job,requested):null;
        const work=Math.max(0,num(paid?.work));
        if(work){c.workDone=Math.min(c.workRequired,c.workDone+work);changed=true;}
        c.workers=work>0?n:0;
        c.unfunded=requested>0&&work<=0;
        c.lastWorkDay=next;
        if(c.workDone>=c.workRequired-1e-8){
          c.workDone=c.workRequired;c.workers=0;c.completedDay=next;
          clearPatch(job);
          window.ConquerEconomy?.creditForestryWood?.(job.wood,job.id);
          completed++;changed=true;
        }
      }
      t=next;
    }
    if(changed&&typeof scheduleLocalSave==='function')scheduleLocalSave();
    return completed;
  }
  function clear(){const count=jobs().length;jobs().splice(0);return count;}
  function drawOutline(p,stroke,fill){
    if(typeof ctx==='undefined'||typeof w2sRaw!=='function')return;
    const screen=p.polygon.map(q=>w2sRaw(q,typeof terrainElevation==='function'?terrainElevation(q)+.06:.06));
    if(!screen.length)return;
    ctx.save();
    if(typeof pathPolygon==='function')pathPolygon(screen,fill,stroke,2);
    const label=w2sRaw(p.center,typeof terrainElevation==='function'?terrainElevation(p.center)+.2:.2);
    ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillStyle=stroke;
    ctx.fillText(p.label||'',label.x,label.y-12);
    ctx.restore();
  }
  function drawGhost(ghost){
    if(!ghost)return;
    drawOutline({...ghost,label:ghost.ok?
      'L1 job · +'+ghost.wood+' wood · '+ghost.workRequired+' worker-days':ghost.reason},
      ghost.ok?'#a5f2b5':'#ff7d7d',ghost.ok?'rgba(52,178,80,.22)':'rgba(226,52,63,.28)');
  }
  function drawJobs(){
    for(const job of jobs()){
      const c=job.construction;
      if(!c||c.workDone>=c.workRequired)continue;
      const percent=Math.floor(100*c.workDone/c.workRequired);
      drawOutline({...job,polygon:shapePoints(job.center,job.radius,job.shape),
        label:'Forestry L1 · '+percent+'% · '+(c.workers||0)+' workers'},
        '#ffe29a','rgba(214,158,57,.12)');
    }
  }
  // The L1 crew at a clearing: woodcutters with the axe around the area, the third one grubbing
  // stumps with the shovel. Visual only: as many as the job's paid workers, on working hours of
  // a weekday, never during an alarm (settlement-work-anim.js figures, woodcutter clothes).
  function crewSpots(job,n){
    const out=[],r=num(job.radius,4)*.55,a0=(parseInt(String(job.id).replace(/\D/g,''),10)||0)*.9;
    for(let i=0;i<n;i++){const a=a0+i*Math.PI*2/Math.max(1,n);out.push({x:job.center.x+Math.cos(a)*r,y:job.center.y+Math.sin(a)*r})}
    return out;
  }
  function drawCrews(){
    const W=window.ConquerWorkAnim;
    if(!W||(window.ConquerCombat?.alarmMode?.()||'off')!=='off'||State.view.scale<.3)return;
    const day=num(State.clock?.day),f=day-Math.floor(day);
    if(!isWeekday(day)||f<.24||f>.66)return;
    const t=W.now();
    for(const job of jobs()){
      const c=job.construction;if(!c||c.workDone>=c.workRequired)continue;
      const n=Math.min(MAX_WORKERS,Math.max(0,Math.floor(num(c.workers))));
      crewSpots(job,n).forEach((p,i)=>{
        if(typeof worldPointVisible==='function'&&!worldPointVisible(p,0,40))return;
        W.drawWorker(W.anonymous(job.id+':feller'+i,p,'woodcutter'),i===2?'shovel':'axe',t,W.facingOf(p,job.center.x-p.x,job.center.y-p.y));
      });
    }
  }
  window.ConquerForestry=Object.freeze({WOOD_PER_U2,WORK_PER_U2,jobs,preview,start,crews,tick,clear,drawGhost,drawJobs,crewSpots,drawCrews});
})();