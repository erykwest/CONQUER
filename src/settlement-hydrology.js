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
 function orientPrimary(line,info){
  let source='local-mouth';
  if(!line.mouth){
    const vector=info.riverFlow,a=line.points[0],b=line.points.at(-1);
    if(vector&&Number.isFinite(vector.x)&&Number.isFinite(vector.y)&&Math.hypot(vector.x,vector.y)>.01){
      if((b.x-a.x)*vector.x+(b.y-a.y)*vector.y<0)line.points.reverse();source=vector.source||'regional';
    }else{
      if(seedRand((State.seed^biomeHash(line.id+':flow'))>>>0)()<.5)line.points.reverse();source='seeded-fallback';
    }
  }
  const from=line.points[0],to=line.points.at(-1),L=Math.hypot(to.x-from.x,to.y-from.y)||1;
  line.flow={source,from:{...from},to:{...to},direction:{x:(to.x-from.x)/L,y:(to.y-from.y)/L}};
  return line;
 }
 const TRIBUTARY_ANGLE_DEG=30;
 // Tributaries approach from opposite banks and turn downstream at the mouth.
 // This makes the hierarchy geometric: no parallel full-map streams or X crossings.
 function tributary(primary,type,id,rnd,lines,bodies,obstacles){
  const blocked=terrainGuard(obstacles,(type==='river'?WATER_WIDTH.river:WATER_WIDTH.stream)/2+2);
  const arc=[0],pts=primary.points;
  for(let i=1;i<pts.length;i++)arc.push(arc.at(-1)+Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y));
  const length=arc.at(-1),used=lines.filter(f=>f.confluence?.downstreamId===primary.id);
  if(length<40)return null;
  for(let attempt=0;attempt<120;attempt++){
   const distance=length*(.16+rnd()*.68);let k=1;while(k<arc.length-1&&arc[k]<distance)k++;
   const a=pts[k-1],b=pts[k],L=Math.hypot(b.x-a.x,b.y-a.y)||1,tx=(b.x-a.x)/L,ty=(b.y-a.y)/L;
   const target=lerp(a,b,(distance-arc[k-1])/(arc[k]-arc[k-1]||1));
   if(used.some(f=>Math.abs(f.confluence.arcDistance-distance)<28||Math.hypot(f.confluence.point.x-target.x,f.confluence.point.y-target.y)<18))continue;
   const sign=used.length%2?-1:1,nx=-ty*sign,ny=tx*sign;
   const axis={x:pts.at(-1).x-pts[0].x,y:pts.at(-1).y-pts[0].y},axisLength=Math.hypot(axis.x,axis.y)||1;
   // The tributary must cross the primary's overall direction, rather than
   // follow its meanders alongside it. Two tributaries cannot share a heading.
   if(Math.abs((axis.x*nx+axis.y*ny)/axisLength)>.75)continue;
   if(used.some(f=>{const start=f.points[0],end=f.points.at(-1),dx=start.x-end.x,dy=start.y-end.y;return(dx*nx+dy*ny)/(Math.hypot(dx,dy)||1)>.86}))continue;
   const reach=Math.min(...[[nx,200-target.x,target.x],[ny,200-target.y,target.y]].map(([v,pos,neg])=>Math.abs(v)<1e-9?Infinity:(v>0?pos:neg)/Math.abs(v)));
   if(reach<28)continue;
   const phase=rnd()*Math.PI*2,amplitude=5+rnd()*8,frequency=1+rnd(),n=Math.ceil(reach/1.5),points=[];
   const angle=TRIBUTARY_ANGLE_DEG*Math.PI/180,ox=nx*Math.sin(angle)-tx*Math.cos(angle),oy=ny*Math.sin(angle)-ty*Math.cos(angle);
   const source={x:target.x+nx*reach,y:target.y+ny*reach},stem={x:target.x+ox*9,y:target.y+oy*9};
   const c1=lerp(source,stem,.35),handle=Math.min(18,reach*.25),c2={x:stem.x+ox*handle,y:stem.y+oy*handle};
   for(let i=0;i<=n;i++){
    const t=i/n,u=1-t,remaining=reach*u,v=clamp((remaining-9)/18,0,1),taper=v*v*(3-2*v);
    const bend=amplitude*Math.sin(t*Math.PI*2*frequency+phase)*Math.sin(t*Math.PI)**2*taper;
    points.push({x:u*u*u*source.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*stem.x+tx*bend,
      y:u*u*u*source.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*stem.y+ty*bend});
   }
   // Tangent-continuous approach: the last 9U retain exactly the downstream angle.
   for(let i=1;i<=6;i++)points.push(lerp(stem,target,i/6));
   points[points.length-1]=target;
   if(points.some(p=>p.x<-.001||p.y<-.001||p.x>200.001||p.y>200.001||bodies.some(f=>environmentContains(f,p))||blocked(p)))continue;
   let crossing=false;
   for(let i=1;i<points.length&&!crossing;i++)for(const line of lines){
    for(let j=1;j<line.points.length;j++){
     const hit=intersection(points[i-1],points[i],line.points[j-1],line.points[j]);
     if(hit&&(line!==primary||Math.hypot(hit.x-target.x,hit.y-target.y)>1e-5)){crossing=true;break;}
    }
    if(crossing)break;
   }
   if(crossing)continue;
   return{id,type,points,width:type==='river'?WATER_WIDTH.river:WATER_WIDTH.stream,
    fill:type==='river'?'#3a7684':'#4f8d95',edge:type==='river'?'#88b4b8':'#9cc6c6',
    confluence:{downstreamId:primary.id,point:target,arcDistance:distance,bankSide:sign,angleDeg:TRIBUTARY_ANGLE_DEG}};
  }
  return null;
 }
 // Every course is fitted around the existing relief, including its bank width.
 function terrainGuard(obstacles,pad){
  const shapes=obstacles.map(f=>({f,b:environmentPolygonBounds(f.points)}));
  return p=>shapes.some(({f,b})=>p.x>=b.minX-pad&&p.x<=b.maxX+pad&&p.y>=b.minY-pad&&p.y<=b.maxY+pad&&(environmentContains(f,p)||f.points.some((a,i)=>pointSegmentDistance(p,a,f.points[(i+1)%f.points.length])<pad)));
 }
 function routeRelief(line,obstacles){
  if(!line||!obstacles.length)return line;
  const blocked=terrainGuard(obstacles,line.width/2+2),pts=dense(line.points);
  if(!pts.some(blocked))return line;
  const clear=(a,b)=>{const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2);for(let j=0;j<=n;j++)if(blocked(lerp(a,b,n?j/n:0)))return false;return true};
  function detour(a,b){
   const n=101,key=(x,y)=>y*n+x,point=i=>({x:(i%n)*2,y:Math.floor(i/n)*2}),cache=new Map();
   const free=i=>{if(!cache.has(i))cache.set(i,!blocked(point(i)));return cache.get(i)};
   const snap=p=>{let best=null;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const x=clamp(Math.round(p.x/2)+dx,0,100),y=clamp(Math.round(p.y/2)+dy,0,100),i=key(x,y),q=point(i),d=Math.hypot(q.x-p.x,q.y-p.y);
    if((!best||d<best.d)&&free(i)&&clear(p,q))best={i,d};
   }return best?.i};
   const start=snap(a),goal=snap(b);if(start===undefined||goal===undefined)return null;
   const scores=new Map([[start,0]]),parents=new Map(),open=[{i:start,f:0}],closed=new Set();let guard=0;
   while(open.length&&guard++<20000){
    open.sort((a,b)=>b.f-a.f);const {i}=open.pop();if(closed.has(i))continue;
    if(i===goal){const path=[b];let k=i;while(k!==undefined){path.push(point(k));k=parents.get(k)}path.push(a);path.reverse();
     const smooth=[path[0]];for(let j=0;j<path.length-1;){let k=path.length-1;while(k>j+1&&!clear(path[j],path[k]))k--;smooth.push(path[k]);j=k}
     // Round detour bends only when the rounded bank still clears the terrain.
     const rounded=[smooth[0]];for(let j=1;j<smooth.length-1;j++){rounded.push(lerp(smooth[j-1],smooth[j],.8),lerp(smooth[j],smooth[j+1],.2))}rounded.push(smooth.at(-1));
     let result=rounded.every((p,j)=>!j||clear(rounded[j-1],p))?rounded:smooth;
     for(let pass=0;pass<2;pass++){
      const next=[result[0]];for(let j=1;j<result.length;j++)next.push(lerp(result[j-1],result[j],.25),lerp(result[j-1],result[j],.75));next.push(result.at(-1));
      if(next.every((p,j)=>!j||clear(next[j-1],p)))result=next;else break;
     }
     return result;
    }
    closed.add(i);const x=i%n,y=Math.floor(i/n);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dy||x+dx<0||x+dx>=n||y+dy<0||y+dy>=n)continue;
     const next=key(x+dx,y+dy);if(closed.has(next)||!free(next)||!clear(point(i),point(next)))continue;
     const score=scores.get(i)+Math.hypot(dx,dy);if(score>=(scores.get(next)??Infinity))continue;
     scores.set(next,score);parents.set(next,i);open.push({i:next,f:score+Math.hypot((goal%n)-(x+dx),Math.floor(goal/n)-(y+dy))});
    }
   }return null;
  }
  let start=pts.findIndex(p=>!blocked(p)),end=pts.length-1;while(end>=0&&blocked(pts[end]))end--;
  if(start<0||end<=start)return null;
  const out=[pts[start]];
  for(let i=start+1;i<=end;i++){
   if(!blocked(pts[i])&&clear(out.at(-1),pts[i])){out.push(pts[i]);continue;}
   let j=i;while(j<=end&&blocked(pts[j]))j++;
   // Leave space on both ends for a safe connection to the routing grid.
   const a=out.at(-1),b=pts[Math.min(j+3,end)],path=detour(a,b);if(!path)return null;
   out.push(...path.slice(1));i=Math.min(j+3,end);
  }
  return {...line,points:dense(out),reliefRouted:true};
 }
 function compose(env){
  const info=window.__CONQUER_REGIONAL_DEMO__||{},coastal=biomeCoastalLand();
  if(coastal)env=env.filter(f=>f.type!=='stream');
  const original=env.filter(water);if(!original.length)return env;
  const bodies=env.filter(f=>f.type==='sea'||f.type==='pond'&&f.waterBodyKind==='lake'),obstacles=[...env.filter(f=>f.type==='mountain'),...(State.relief?.hills||[]).map(h=>({type:'mountain',points:reliefHillFootprint(h)}))];
  const rnd=seedRand((State.seed^0x6783ab1)>>>0),lines=[];
  const ordered=original.slice().sort((a,b)=>(a.type==='stream')-(b.type==='stream'));
  const first=routeRelief(mouth({...ordered[0],points:ordered[0].points.map(p=>({...p})),drainagePrimary:true},bodies),obstacles);
  if(first)lines.push(orientPrimary(first,info));
  const primary=lines[0];
  if(primary)for(const f of ordered.slice(1)){
    const branch=tributary(primary,f.type,f.id,rnd,lines,bodies,obstacles);
    if(branch)lines.push(branch);
  }
  if(!lines.length)return env.filter(f=>!water(f));
  const types=[];
  let streams=lines.filter(f=>f.type==='stream').length;
  const requested=Array.isArray(info.tributaryTypes)?info.tributaryTypes.filter(t=>t==='river'||t==='stream'&&!coastal).slice(0,3):[];
  for(const type of requested){if(type==='stream'&&streams>=3)continue;types.push(type);if(type==='stream')streams++}
  if(info.hasRiver)while(streams<biomeStreamCount()){types.push('stream');streams++}
  for(let n=0;n<types.length;n++){
   const connected=tributary(primary,types[n],'env-affluent-'+n,rnd,lines,bodies,obstacles);
   if(connected)lines.push(connected);
  }
  lines.push(...lines.flatMap(line=>distributaries(line,bodies)).filter(line=>!line.points.some(terrainGuard(obstacles,line.width/2+2))));
  // Legacy callers may still provide woods; relief is never deleted for water.
  for(const f of env.filter(f=>f.type==='forest'))f.holes=[...(f.holes||[]),...lines.map(l=>bank(l.points,l.width/2+2))];

  if(typeof clearForestLayoutCache==='function')clearForestLayoutCache();
  // A clipped mouth paints over the shoreline trim, opening the beach at its outlet.
  const dry=env.filter(f=>!water(f)&&!(f.type==='mountain'&&lines.some(l=>l.points.some(p=>environmentContains(f,p,l.width/2+1)))));
  return [...dry,...lines];
 }
 window.ConquerHydrology={compose,mouth,join,intersection,distributaries,tributary,orientPrimary,TRIBUTARY_ANGLE_DEG,bank,routeRelief,terrainGuard};
})();
