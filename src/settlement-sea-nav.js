'use strict';
// Sea navigation for ships and boats: a 1U grid over the sea, blocked by land, the shore rocks
// (settlement-coast.js), quays, piers and the shipyards' slipways, with each cell's clearance
// (distance to the nearest blocked cell) so a hull only goes where its beam fits. route()
// finds an A* path and pulls it straight where the water is clear. drive() moves a ship along
// its route at its speed, turning gradually, and waits when its hull would run into another
// ship ahead (the one with the higher id gives way; a moored ship always has right of way),
// with a time limit so two ships never block each other for good.
(() => {
  const STEP=1,PAD=.35,TURN=1.6,WAIT_MAX=6;
  const SPEED=Object.freeze({barchetta:1.0,barca:1.4,cargo:1.5,caravella:1.8,cocca:1.7,nave:1.8});
  const W=()=>typeof WORLD==='number'?WORLD:200;
  const seaOf=()=>(State.environment||[]).find(f=>f.type==='sea'&&f.points?.length>2)||null;
  const pip=(p,poly)=>{let k=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)k=!k}return k};
  const bounds=poly=>{let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const p of poly){a=Math.min(a,p.x);b=Math.min(b,p.y);c=Math.max(c,p.x);d=Math.max(d,p.y)}return{minX:a,minY:b,maxX:c,maxY:d}};
  // Footprints in the water: quays, piers and slipways, a little inflated.
  function works(){
    const out=[];
    for(const s of State.structures||[]){
      let poly=null;
      if(s.type==='quay')poly=window.ConquerQuay?.footprint(s);
      else if(s.type==='pier')poly=window.ConquerPier?.footprint(s);
      if(poly)out.push({poly,b:bounds(poly)});
    }
    return out;
  }
  const signature=()=>{
    const sea=seaOf();if(!sea)return null;
    const ws=(State.structures||[]).filter(s=>s.type==='quay'||s.type==='pier').map(s=>s.id+':'+(s.a?[s.a.x,s.a.y,s.b.x,s.b.y]:[s.x,s.y,s.angle||0,s.reach||0,s.yard||0]).join(','));
    return sea.side+'|'+sea.points.length+'|'+sea.points[0].x+','+sea.points[0].y+'|'+ws.join(';');
  };
  let grid=null;
  function build(){
    const key=signature();if(!key)return null;
    if(grid?.key===key)return grid;
    const sea=seaOf(),n=Math.ceil(W()/STEP),wet=new Uint8Array(n*n),clear=new Float32Array(n*n),ws=works(),sb=bounds(sea.points);
    const rock=window.ConquerCoast?.rockAt;
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const p={x:(i+.5)*STEP,y:(j+.5)*STEP};
      if(p.x<sb.minX||p.x>sb.maxX||p.y<sb.minY||p.y>sb.maxY||!pip(p,sea.points))continue;
      if(rock&&rock(p))continue;
      if(ws.some(w=>p.x>=w.b.minX-PAD&&p.x<=w.b.maxX+PAD&&p.y>=w.b.minY-PAD&&p.y<=w.b.maxY+PAD&&(pip(p,w.poly)||near(p,w.poly,PAD))))continue;
      wet[j*n+i]=1;
    }
    // Clearance: two-pass chamfer distance (in U) from the blocked cells and the map border.
    const BIG=1e6;
    for(let k=0;k<n*n;k++)clear[k]=wet[k]?BIG:0;
    const D1=STEP,D2=STEP*Math.SQRT2;
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i;if(!clear[k])continue;let v=Math.min(clear[k],(i+1)*STEP,(j+1)*STEP);
      if(i>0)v=Math.min(v,clear[k-1]+D1);if(j>0)v=Math.min(v,clear[k-n]+D1);if(i>0&&j>0)v=Math.min(v,clear[k-n-1]+D2);if(i<n-1&&j>0)v=Math.min(v,clear[k-n+1]+D2);clear[k]=v}
    for(let j=n-1;j>=0;j--)for(let i=n-1;i>=0;i--){const k=j*n+i;if(!clear[k])continue;let v=Math.min(clear[k],(n-i)*STEP,(n-j)*STEP);
      if(i<n-1)v=Math.min(v,clear[k+1]+D1);if(j<n-1)v=Math.min(v,clear[k+n]+D1);if(i<n-1&&j<n-1)v=Math.min(v,clear[k+n+1]+D2);if(i>0&&j<n-1)v=Math.min(v,clear[k+n-1]+D2);clear[k]=v}
    grid={key,n,wet,clear,routes:new Map()};
    return grid;
  }
  function near(p,poly,pad){
    for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/L));if(Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)<pad)return true}
    return false;
  }
  const cellOf=(g,p)=>({i:Math.max(0,Math.min(g.n-1,Math.floor(p.x/STEP))),j:Math.max(0,Math.min(g.n-1,Math.floor(p.y/STEP)))});
  const centre=(i,j)=>({x:(i+.5)*STEP,y:(j+.5)*STEP});
  // Clearance needed by a hull of beam B (half beam plus a margin).
  const need=B=>B/2+.45;
  function clearAt(p){const g=build();if(!g)return 0;const c=cellOf(g,p);return g.clear[c.j*g.n+c.i]}
  // Nearest cell with enough clearance, searched in growing rings (for berths by a pier).
  function nearestOpen(g,p,req,radius=10){
    const c=cellOf(g,p);let best=null,bd=Infinity;
    for(let r=0;r<=radius&&!best;r++)for(let j=c.j-r;j<=c.j+r;j++)for(let i=c.i-r;i<=c.i+r;i++){
      if(i<0||j<0||i>=g.n||j>=g.n||Math.max(Math.abs(i-c.i),Math.abs(j-c.j))!==r)continue;
      if(g.clear[j*g.n+i]<req)continue;const q=centre(i,j),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){bd=d;best={i,j}}
    }
    return best;
  }
  function lineClear(g,a,b,req){
    const L=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(L/(STEP*.5)));
    for(let k=1;k<steps;k++){const t=k/steps,c=cellOf(g,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});if(g.clear[c.j*g.n+c.i]<req)return false}
    return true;
  }
  // A* over the grid for a hull of beam B: [a, ...waypoints, b] (a and b as given), or null.
  function route(a,b,B=1){
    const g=build();if(!g)return null;
    const req=need(B),key=[Math.round(a.x),Math.round(a.y),Math.round(b.x),Math.round(b.y),req.toFixed(2)].join(',');
    if(g.routes.has(key))return g.routes.get(key);
    const s=nearestOpen(g,a,req),e=nearestOpen(g,b,req);
    let out=null;
    if(s&&e){
      const n=g.n,N=n*n,gs=new Float32Array(N).fill(Infinity),came=new Int32Array(N).fill(-1),closed=new Uint8Array(N);
      const heap=[],push=(k,f)=>{heap.push([f,k]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}};
      const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return top};
      const sk=s.j*n+s.i,ek=e.j*n+e.i,h=(i,j)=>Math.hypot(i-e.i,j-e.j)*STEP;
      gs[sk]=0;push(sk,h(s.i,s.j));
      const dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
      let found=false,iter=0;
      while(heap.length&&iter++<N){
        const [,k]=pop();if(closed[k])continue;closed[k]=1;if(k===ek){found=true;break}
        const i=k%n,j=(k-i)/n;
        for(const [di,dj,c] of dirs){
          const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=n||jj>=n)continue;const kk=jj*n+ii;
          if(closed[kk]||g.clear[kk]<req)continue;
          // Stay off the shore where there is room: a small cost for hugging the land.
          const cost=c*STEP*(1+.6/Math.max(.5,g.clear[kk]-req+.5)),v=gs[k]+cost;
          if(v<gs[kk]){gs[kk]=v;came[kk]=k;push(kk,v+h(ii,jj))}
        }
      }
      if(found){
        const cells=[];for(let k=ek;k!==-1;k=came[k])cells.push(centre(k%n,(k-k%n)/n));cells.reverse();
        const raw=[{x:a.x,y:a.y},...cells,{x:b.x,y:b.y}];
        // String pulling: keep a waypoint only where the straight line would cut too close.
        out=[raw[0]];let i=0;
        while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!lineClear(g,raw[i],raw[j],req))j--;out.push(raw[j]);i=j}
      }
    }
    g.routes.set(key,out);
    return out;
  }
  const lengthOf=path=>{let L=0;for(let i=1;i<path.length;i++)L+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);return L};
  function pointAt(path,s){
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],L=Math.hypot(b.x-a.x,b.y-a.y);
      if(s<=L||i===path.length-1){const t=L?Math.min(1,s/L):1;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:Math.atan2(b.y-a.y,b.x-a.x)}}
      s-=L;
    }
    return{...path[0],heading:0};
  }
  const angDiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
  const speedOf=key=>SPEED[key]||1.5;
  // Move ship s (pose and nav state) towards goal {x,y,heading?}: returns 'moving', 'waiting',
  // 'arrived' or 'stuck' (no route). others: ships to keep clear of.
  function drive(s,goal,dt,others=[]){
    const F=window.ConquerFleet,m=window.ConquerShips?.model(s.key);if(!F||!m)return'stuck';
    const gk=Math.round(goal.x*4)+','+Math.round(goal.y*4);
    if(!s.nav||s.nav.goal!==gk){
      const path=route(s.pose,goal,m.B);
      s.nav={goal:gk,path,s:0,len:path?lengthOf(path):0,wait:0};
    }
    const nav=s.nav;if(!nav.path)return'stuck';
    if(nav.s>=nav.len){if(goal.heading!=null)s.pose.heading+=angDiff(s.pose.heading,goal.heading)*Math.min(1,dt*TURN);return'arrived'}
    // Ease into the berth over the last hull length.
    const left=nav.len-nav.s,v=speedOf(s.key)*(left<m.L?Math.max(.3,left/m.L):1),ds=v*dt;
    const ahead=pointAt(nav.path,Math.min(nav.len,nav.s+ds+m.L*.6)),probe={x:ahead.x,y:ahead.y,heading:ahead.heading};
    const mine=F.hull(s.key,probe,.15);
    const block=others.find(o=>o!==s&&(!o.nav||!o.away||String(o.id)<String(s.id))&&Math.hypot(o.pose.x-s.pose.x,o.pose.y-s.pose.y)<m.L+8&&F.overlap(mine,F.hull(o.key,o.pose,.15)));
    if(block&&nav.wait<WAIT_MAX){nav.wait+=dt;return'waiting'}
    nav.wait=Math.max(0,nav.wait-dt);
    nav.s=Math.min(nav.len,nav.s+ds);
    const p=pointAt(nav.path,nav.s);
    s.pose.x=p.x;s.pose.y=p.y;s.pose.z=0;
    s.pose.heading+=angDiff(s.pose.heading,p.heading)*Math.min(1,dt*TURN);
    return nav.s>=nav.len?'arrived':'moving';
  }
  window.ConquerSeaNav=Object.freeze({STEP,SPEED,build,route,clearAt,drive,lengthOf,pointAt,need});
})();
