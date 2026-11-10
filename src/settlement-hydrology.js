'use strict';
// Geometric drainage network. Shared watercourse polylines drive render, collision and banks.
(()=>{
 const water=f=>f.type==='river'||f.type==='stream';
 const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 function bank(points,half){
  const left=[],right=[];
  for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],L=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/L*half,ny=(b.x-a.x)/L*half;left.push({x:points[i].x+nx,y:points[i].y+ny});right.push({x:points[i].x-nx,y:points[i].y-ny});}
  return left.concat(right.reverse());
 }
 function dense(points){const out=[points[0]];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let j=1;j<=n;j++)out.push(lerp(a,b,j/n))}return out}
 function intersection(a,b,c,d){const x=b.x-a.x,y=b.y-a.y,u=d.x-c.x,v=d.y-c.y,den=x*v-y*u;if(Math.abs(den)<1e-9)return null;const t=((c.x-a.x)*v-(c.y-a.y)*u)/den,s=((c.x-a.x)*y-(c.y-a.y)*x)/den;return t>=0&&t<=1&&s>=0&&s<=1?lerp(a,b,t):null}
 function mouth(line,bodies){
  if(!bodies.length||line.confluence)return line;
  let pts=dense(line.points),wet=p=>bodies.find(f=>environmentContains(f,p));
  const trim=()=>{
   let best=null,start=null;
   for(let i=0;i<=pts.length;i++){
    if(i<pts.length&&!wet(pts[i])){if(start===null)start=i;}
    else if(start!==null){if(!best||i-start>best.end-best.start)best={start,end:i};start=null;}
   }
   if(!best)return null;
   if(best.start===0&&best.end===pts.length)return false;
   const reverse=best.end===pts.length;
   const end=reverse?best.start-1:best.end,receiver=wet(pts[end]);
   const points=reverse?pts.slice(end,best.end).reverse():pts.slice(best.start,end+1);
   return {...line,points,mouth:{receiverId:receiver.id,kind:receiver.type==='sea'?'sea':'lake',point:points.at(-1)}};
  };
  const existing=trim();if(existing!==false)return existing;
  let best=null;
  for(let y=2;y<200;y+=4)for(let x=2;x<200;x+=4){const p={x,y},body=wet(p);if(!body)continue;for(const end of [0,pts.length-1]){const distance=Math.hypot(p.x-pts[end].x,p.y-pts[end].y);if(!best||distance<best.distance)best={p,end,distance};}}
  if(!best)return line;
  if(best.end===0)pts.reverse();
  const a=pts.at(-1),prev=pts.at(-2),b=best.p,L=Math.hypot(a.x-prev.x,a.y-prev.y)||1,reach=Math.min(12,best.distance/3);
  const c={x:a.x+(a.x-prev.x)/L*reach,y:a.y+(a.y-prev.y)/L*reach},d=lerp(a,b,.7);
  for(let i=1;i<=32;i++){const t=i/32,u=1-t;pts.push({x:clamp(u*u*u*a.x+3*u*u*t*c.x+3*u*t*t*d.x+t*t*t*b.x,0,200),y:clamp(u*u*u*a.y+3*u*u*t*c.y+3*u*t*t*d.y+t*t*t*b.y,0,200)})}
  pts=dense(pts);return trim()||line;
 }
 function join(branch,trunks,bodies,obstacles){
  // Each end drains to its FIRST crossing. Choosing the longest path to any
  // crossing makes a tributary cross/rejoin the trunk repeatedly, forming loops.
  const hits=[],arc=[0];
  for(let i=1;i<branch.points.length;i++)arc.push(arc.at(-1)+Math.hypot(branch.points[i].x-branch.points[i-1].x,branch.points[i].y-branch.points[i-1].y));
  for(const trunk of trunks)for(let i=1;i<branch.points.length;i++)for(let j=1;j<trunk.points.length;j++){
   const p=intersection(branch.points[i-1],branch.points[i],trunk.points[j-1],trunk.points[j]);if(!p||bodies.some(f=>environmentContains(f,p)))continue;
   hits.push({p,i,trunk,d:arc[i-1]+Math.hypot(p.x-branch.points[i-1].x,p.y-branch.points[i-1].y)});
  }
  if(!hits.length)return null;
  hits.sort((a,b)=>a.d-b.d);
  const first=hits[0],last=hits.at(-1),choices=[
   {hit:first,points:branch.points.slice(0,first.i).concat([first.p]),length:first.d},
   {hit:last,points:branch.points.slice(last.i).reverse().concat([last.p]),length:arc.at(-1)-last.d}
  ].sort((a,b)=>b.length-a.length);
  for(const {hit,points} of choices){
   if(points.length<10||points.some((q,k)=>k%3===0&&(bodies.some(f=>environmentContains(f,q))||obstacles.some(f=>environmentContains(f,q,1)))))continue;
   return {...branch,points,confluence:{downstreamId:hit.trunk.id,point:hit.p}};
  }
  return null;
 }
 function distributaries(main,bodies){
  if(main.type!=='river'||main.mouth?.kind!=='sea'||main.confluence)return [];
  const receiver=bodies.find(f=>f.id===main.mouth.receiverId);if(!receiver||receiver.type!=='sea')return [];
  const points=main.points,arc=[0];for(let i=1;i<points.length;i++)arc.push(arc.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
  const length=arc.at(-1);if(length<25)return [];
  const at=d=>{let i=1;while(i<arc.length-1&&arc[i]<d)i++;return lerp(points[i-1],points[i],(d-arc[i-1])/(arc[i]-arc[i-1]||1))};
  const end=points.at(-1),before=at(length-3),L=Math.hypot(end.x-before.x,end.y-before.y)||1,nx=-(end.y-before.y)/L,ny=(end.x-before.x)/L;
  const rnd=seedRand((State.seed^biomeHash(main.id+':delta'))>>>0),out=[];
  for(let branch=0;branch<2;branch++){
   const sign=branch?1:-1,fraction=.70+branch*.065+rnd()*.02,reach=Math.min(24,Math.max(8,length*.075));
   const desired={x:end.x+nx*sign*reach,y:end.y+ny*sign*reach};let target=null,score=Infinity;
   for(let y=Math.max(1,end.y-reach-5);y<Math.min(200,end.y+reach+5);y+=1.5)for(let x=Math.max(1,end.x-reach-5);x<Math.min(200,end.x+reach+5);x+=1.5){
    const p={x,y};if(!environmentContains(receiver,p)||(x-end.x)*nx*sign+(y-end.y)*ny*sign<3)continue;
    if(![[3,0],[-3,0],[0,3],[0,-3]].some(([dx,dy])=>!environmentContains(receiver,{x:x+dx,y:y+dy})))continue;
    const distance=Math.hypot(x-desired.x,y-desired.y);if(distance<score){score=distance;target=p;}
   }
   if(!target)continue;
   const root=length*fraction,n=Math.max(16,Math.ceil(length-root)),path=[];
   for(let i=0;i<=n;i++){
    const t=i/n,ease=t*t*(3-2*t),p=at(root+(length-root)*t),q={x:p.x+(target.x-end.x)*ease,y:p.y+(target.y-end.y)*ease};
    if(q.x<0||q.x>200||q.y<0||q.y>200)break;
    path.push(q);if(i>1&&environmentContains(receiver,q))break;
   }
   if(path.length<3||!environmentContains(receiver,path.at(-1)))continue;
   out.push({...main,id:main.id+'-delta-'+branch,points:path,width:main.width*(.48+rnd()*.13),
    delta:{parentId:main.id,startFraction:fraction},mouth:{receiverId:receiver.id,kind:main.mouth.kind,point:path.at(-1)}});
  }
  return out;
 }
 function compose(env){
  const info=window.__CONQUER_REGIONAL_DEMO__||{};
  const original=env.filter(water);if(!original.length)return env;
  const bodies=env.filter(f=>f.type==='sea'||f.type==='pond'&&f.waterBodyKind==='lake'),obstacles=env.filter(f=>f.type==='mountain');
  const lines=[];
  // Resolve crossing streams as real junctions instead of drawing crossing caps.
  for(const f of original.slice().sort((a,b)=>(a.type==='stream')-(b.type==='stream'))){
    const line=mouth({...f,points:f.points.map(p=>({...p}))},bodies);if(!line)continue;
    if(line.type==='stream'&&lines.length){
      const connected=join(line,lines,bodies,obstacles);
      if(connected){lines.push(connected);continue;}
      // An obstructed junction may be skipped, but never leave a crossing loop.
      const crossing=lines.some(trunk=>line.points.slice(1).some((p,i)=>trunk.points.slice(1).some((q,j)=>intersection(line.points[i],p,trunk.points[j],q))));
      if(crossing)continue;
    }
    lines.push(line);
  }
  if(!lines.length)return env.filter(f=>!water(f));
  const rnd=seedRand((State.seed^0x6783ab1)>>>0),types=[];
  let streams=lines.filter(f=>f.type==='stream').length;
  const requested=Array.isArray(info.tributaryTypes)?info.tributaryTypes.filter(t=>['river','stream'].includes(t)).slice(0,3):[];
  for(const type of requested){if(type==='stream'&&streams>=3)continue;types.push(type);if(type==='stream')streams++}
  if(info.hasRiver)while(streams<biomeStreamCount()){types.push('stream');streams++}
  const sides=info.riverSides||[];
  for(let n=0;n<types.length;n++)for(let attempt=0;attempt<12;attempt++){
   const candidate=types[n]==='river'?makeBoundaryRiver(rnd,sides[(n+attempt+1)%sides.length]):makeEnvWater(rnd,'stream');
   candidate.id='env-affluent-'+n;const connected=join(candidate,lines,bodies,obstacles);
   if(connected){lines.push(connected);break;}
  }
  lines.push(...lines.flatMap(line=>distributaries(line,bodies)));
  // Update actual forest holes and hills after network geometry is final.
  for(const f of env.filter(f=>f.type==='forest'))f.holes=[...(f.holes||[]),...lines.map(l=>bank(l.points,l.width/2+2))];
  if(State.relief){State.relief.hills=State.relief.hills.filter(h=>!reliefHillFootprint(h).some(p=>lines.some(l=>environmentContains(l,p,1))));clearReliefBandCache();State.relief.stats=reliefStats();}
  if(typeof clearForestLayoutCache==='function')clearForestLayoutCache();
  // A clipped mouth paints over the shoreline trim, opening the beach at its outlet.
  const dry=env.filter(f=>!water(f)&&!(f.type==='mountain'&&lines.some(l=>l.points.some(p=>environmentContains(f,p,l.width/2+1)))));
  return [...dry,...lines];
 }
 window.ConquerHydrology={compose,mouth,join,intersection,distributaries};
})();
