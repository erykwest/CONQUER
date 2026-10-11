'use strict';
// Fixed-pool particles with distance-based emission, adapted from Robert Nystrom:
// https://github.com/munificent/game-programming-patterns/blob/master/book/object-pool.markdown
// Original implementation for CONQUER; no external dependency or animation loop.
(()=>{
  const CAPACITY=768,ACTORS=512,LIFE_MS=2500,STRIDE=.32,MAX_PER_FRAME=64;
  const x=new Float32Array(CAPACITY),y=new Float32Array(CAPACITY),z=new Float32Array(CAPACITY);
  const heading=new Float32Array(CAPACITY),size=new Float32Array(CAPACITY),born=new Float64Array(CAPACITY);
  const actors=new Map(),point={x:0,y:0};
  let head=0,count=0,now=0,emitted=0,bounds=null,worldKey='',enabled=false;
  function clear(){head=0;count=0;actors.clear()}
  function beginFrame(rect,time=performance.now()){
    now=time;bounds=rect;emitted=0;
    const key=State.seed+'|'+State.cell.x+'|'+State.cell.y+'|'+State.village.wellId;
    enabled=State.season==='winter';
    if(!enabled||key!==worldKey)clear();
    worldKey=key;
    while(count&&now-born[head]>=LIFE_MS){head=(head+1)%CAPACITY;count--}
    for(const [id,a] of actors)if(now-a.seen>LIFE_MS)actors.delete(id);
  }
  function snowy(p){
    if(p.x<0||p.y<0||p.x>WORLD||p.y>WORLD||terrainSlopeKind(p)==='steep')return false;
    for(const f of State.environment){
      if(f.type!=='forest'&&environmentContains(f,p))return false;
    }
    // Roads remain exposed brown surfaces in the current winter renderer.
    for(const s of State.structures){
      if(s.type==='road'&&pointSegmentDistance(p,s.a,s.b)<(s.width||.3)/2)return false;
    }
    return true;
  }
  function sample(id,p,height=0,scale=1){
    if(!enabled||!p||height>.2||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    let a=actors.get(id);
    if(a&&Math.hypot(p.x-a.x,p.y-a.y)<STRIDE){a.seen=now;return}
    const screen=w2s(p);
    if(!bounds||screen.x<-16||screen.y<-16||screen.x>bounds.width+16||screen.y>bounds.height+16)return;
    if(!a){
      if(actors.size>=ACTORS)return;
      actors.set(id,{x:p.x,y:p.y,seen:now,foot:1});return;
    }
    const dx=p.x-a.x,dy=p.y-a.y,distance=Math.hypot(dx,dy),gap=now-a.seen;
    a.seen=now;
    // Teleports, hidden/LOD-skipped actors and restored games never draw connecting trails.
    if(distance>3||gap>500){a.x=p.x;a.y=p.y;return}
    if(distance<STRIDE)return;
    a.x=p.x;a.y=p.y;
    if(emitted>=MAX_PER_FRAME||!snowy(p))return;
    const side=.065*a.foot*scale;
    point.x=p.x-dy/distance*side;point.y=p.y+dx/distance*side;
    if(!snowy(point))return;
    const i=(head+count)%CAPACITY;
    if(count===CAPACITY)head=(head+1)%CAPACITY;else count++;
    x[i]=point.x;y[i]=point.y;z[i]=terrainElevation(point)+.012;
    heading[i]=Math.atan2(dy,dx);size[i]=scale;born[i]=now;
    a.foot=-a.foot;emitted++;
  }
  function draw(g){
    if(!enabled||!count)return false;
    const start=performance.now(),s=U*State.view.scale,rotation=(State.view.rotation||0)*Math.PI/2;
    let drawn=0,bucket=-1;
    g.save();g.fillStyle='#657578';
    for(let n=0;n<count;n++){
      const i=(head+n)%CAPACITY,age=(now-born[i])/LIFE_MS;
      if(age>=1)continue;
      point.x=x[i];point.y=y[i];
      const p=w2sRaw(point,z[i]);
      if(p.x<-8||p.y<-8||p.x>bounds.width+8||p.y>bounds.height+8)continue;
      const a=heading[i]+rotation,c=Math.cos(a),v=Math.sin(a);
      const vx=(c-v)*ISO_X,vy=(c+v)*ISO_Y;
      // A small pressed sole, projected along the direction of travel.
      const next=Math.ceil((1-age)*16),angle=Math.atan2(vy,vx);
      const rx=Math.max(.5,.14*s*size[i]*Math.hypot(vx,vy)),ry=Math.max(.3,.055*s*size[i]);
      // Chronological particles naturally group into <=16 opacity buckets.
      if(next!==bucket){
        if(bucket>=0)g.fill();
        bucket=next;g.globalAlpha=.38*bucket/16;g.beginPath();
      }
      g.moveTo(p.x+rx*Math.cos(angle),p.y+rx*Math.sin(angle));
      g.ellipse(p.x,p.y,rx,ry,angle,0,Math.PI*2);drawn++;
    }
    if(bucket>=0)g.fill();
    g.restore();
    if(window.__conquerPerf){
      window.__conquerPerf.snowTracks=count;
      window.__conquerPerf.snowTrackDrawn=drawn;
      window.__conquerPerf.snowTrackMs=performance.now()-start;
    }
    return drawn>0;
  }
  // Includes one final repaint after expiration, removing the last faded pixels.
  const active=()=>count>0;
  window.ConquerSnowTracks={beginFrame,sample,draw,active,clear,
    stats:()=>({count,actors:actors.size,capacity:CAPACITY,lifetimeMs:LIFE_MS})};
})();
