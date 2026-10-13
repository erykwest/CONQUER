'use strict';
// Ground footprints left by actual moving civilians and military units.
// This is transient visual state: no save/schema changes, and no fake random tracks.
(function(){
  const SPACING=.50,MAX_STEP=5,MAX_MARKS=1800,KEEP_DAYS=2;
  const trails=[],actors=new Map();
  let lastSeason=null,lastDay=0,sequence=0;

  function reset(){trails.length=0;actors.clear();sequence=0;}
  function winter(){
    const active=State.season==='winter';
    if(lastSeason!==State.season){
      reset();lastSeason=State.season;
    }
    return active;
  }
  function trim(day){
    while(trails.length&&(trails[0].day<day-KEEP_DAYS||trails.length>MAX_MARKS))trails.shift();
    if(actors.size>1300){
      for(const [id,a] of actors)if(a.day<day-.5)actors.delete(id);
    }
  }
  function observe(id,p,day=State.clock.day,kind='person'){
    if(!winter()||!id||!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(day))return;
    if(p.x<0||p.y<0||p.x>WORLD||p.y>WORLD)return;
    const previous=actors.get(id);
    if(!previous||day<previous.day||day-previous.day>1){
      actors.set(id,{x:p.x,y:p.y,day,side:0});return;
    }
    const dx=p.x-previous.x,dy=p.y-previous.y,length=Math.hypot(dx,dy);
    if(length<SPACING)return;
    // Teleports, respawns, and recalled occupants do not draw straight tracks.
    if(length>MAX_STEP){actors.set(id,{x:p.x,y:p.y,day,side:0});return}
    const ux=dx/length,uy=dy/length,steps=Math.floor(length/SPACING);
    const wide=kind==='horse';
    for(let i=1;i<=steps;i++){
      const along=SPACING*i,side=(previous.side+i)%2?1:-1;
      const q={x:previous.x+ux*along,y:previous.y+uy*along};
      // Only on the actual snow-covered ground, never on cliffs or water.
      if(terrainSlopeKind(q)==='steep'||State.environment.some(f=>
        ['sea','pond','river','stream'].includes(f.type)&&environmentContains(f,q,.05)))continue;
      trails.push({x:q.x,y:q.y,ux,uy,side,day,wide});
    }
    sequence++;
    actors.set(id,{x:previous.x+ux*steps*SPACING,
      y:previous.y+uy*steps*SPACING,day,side:(previous.side+steps)%2});
    trim(day);
    if(window.__conquerPerf)window.__conquerPerf.snowFootprints=trails.length;
  }
  function draw(){
    if(!winter())return;
    const day=State.clock.day;
    if(day<lastDay)reset();
    lastDay=day;trim(day);
    const bounds=wrap.getBoundingClientRect(),scale=State.view.scale||1;
    const maxX=bounds.width+30,maxY=bounds.height+30;
    ctx.save();
    for(const t of trails){
      const normal={x:-t.uy,y:t.ux},foot={
        x:t.x+normal.x*(t.wide?.19:.13)*t.side,
        y:t.y+normal.y*(t.wide?.19:.13)*t.side
      };
      const z=terrainElevation(foot)+.028;
      const point=w2sRaw(foot,z);
      if(point.x< -30||point.y< -30||point.x>maxX||point.y>maxY)continue;
      const tip=w2sRaw({x:foot.x+t.ux*.34,y:foot.y+t.uy*.34},z);
      const angle=Math.atan2(tip.y-point.y,tip.x-point.x);
      const length=Math.max(1.5,Math.hypot(tip.x-point.x)*(t.wide?.48:.39));
      const width=Math.max(.85,length*(t.wide?.57:.46));
      const age=Math.max(0,day-t.day);
      ctx.globalAlpha=Math.max(.06,.68*(1-age/KEEP_DAYS));
      ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);
      ctx.fillStyle='#617486';
      ctx.beginPath();ctx.ellipse(0,0,length,width,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  window.ConquerSnowTracks={observe,draw,reset,count:()=>trails.length,snapshot:()=>trails.slice(),
    settings:{spacing:SPACING,maxMarks:MAX_MARKS,keepDays:KEEP_DAYS}};
})();
