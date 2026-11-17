'use strict';
// Deterministic weighted Voronoi partition: exactly 20 cells clipped within
// each authoritative hexagonal macro, without changing gameplay topology.
(function(root){
 const rng=seed=>{let t=seed>>>0;return()=>{t+=0x6D2B79F5;let x=Math.imul(t^(t>>>15),1|t);x^=x+Math.imul(x^(x>>>7),61|x);return((x^(x>>>14))>>>0)/4294967296;}};
 const area=p=>Math.abs(p.reduce((a,v,i)=>{const q=p[(i+1)%p.length];return a+v.x*q.y-q.x*v.y;},0))*.5;
 function clip(poly,a,b,c){const o=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=a*p.x+b*p.y-c,v=a*q.x+b*q.y-c,A=u<=1e-8,B=v<=1e-8;if(A!==B){let t=Math.max(0,Math.min(1,u/(u-v)));o.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}if(B)o.push(q)}return o.filter((p,i)=>{let q=o[(i+o.length-1)%o.length];return (p.x-q.x)**2+(p.y-q.y)**2>1e-14})}
 function sampling(poly,random){
   const a=poly[0],triangles=[],ends=[];let total=0;
   for(let i=1;i<poly.length-1;i++){const b=poly[i],c=poly[i+1],weight=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*.5;if(weight<=1e-10)continue;total+=weight;triangles.push([a,b,c]);ends.push(total)}
   if(!total)throw Error('Empty macro territory');
   return ()=>{const pick=random()*total;let i=ends.findIndex(x=>x>=pick);if(i<0)i=triangles.length-1;const [a,b,c]=triangles[i],r=Math.sqrt(random()),s=random();return{x:(1-r)*a.x+r*(1-s)*b.x+r*s*c.x,y:(1-r)*a.y+r*(1-s)*b.y+r*s*c.y}};
 }
 function points(poly,random){const sample=sampling(poly,random),sites=[];for(let i=0;i<20;i++){let best=null,bestDistance=-1;for(let k=0;k<(i?9:1);k++){const c=sample();let d=Infinity;for(const p of sites)d=Math.min(d,(c.x-p.x)**2+(c.y-p.y)**2);if(d>bestDistance){best=c;bestDistance=d}}sites.push(best)}return sites}
 function targets(random){const out=[];for(let i=0;i<10;i++){const small=.55+.35*random();out.push(small,2-small)}for(let i=19;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
 function cells(sites,poly,weights){return sites.map((p,i)=>{let result=poly;for(let j=0;j<sites.length;j++){if(i===j)continue;const q=sites[j];result=clip(result,2*(q.x-p.x),2*(q.y-p.y),q.x*q.x+q.y*q.y-p.x*p.x-p.y*p.y+weights[i]-weights[j]);if(result.length<3)break}return result})}
 function generateOne(parent,seed){
   const id=parent.macroId??parent.id,poly=parent.polygon,reference=area(poly)/20;
   if(!poly||poly.length<3||reference<=0)throw Error('Invalid hex macro '+id);
   // Retry ONLY a rare poorly conditioned internal point pattern, keeping
   // the canonical macro untouched and all results deterministic by seed.
   for(let attempt=0;attempt<6;attempt++){
     const random=rng((seed^Math.imul(id+1,0x9e3779b1)^
       Math.imul(attempt,0x85ebca77))>>>0);
     const points20=points(poly,random),sizeTargets=targets(random);
     const weights=new Float64Array(20);
     let out,actual,maxError=Infinity,iter=0;
     for(;iter<110;iter++){
       out=cells(points20,poly,weights);
       actual=out.map(p=>p.length>=3?area(p):0);
       maxError=Math.max(...actual.map((a,i)=>
         Math.abs(a/reference-sizeTargets[i])));
       if(maxError<=.028&&actual.every(a=>a>0))break;
       for(let i=0;i<20;i++)
         weights[i]-=(actual[i]-sizeTargets[i]*reference)*.34;
     }
     const valid=maxError<=.035&&actual.every(a=>a>0)&&
       actual.every(a=>a/reference>=.50&&a/reference<=1.50)&&
       Math.abs(actual.reduce((a,b)=>a+b,0)-area(poly))<=area(poly)*1e-6;
     if(!valid)continue;
     return {cells:out.map((polygon,i)=>({
       id:id*20+i,macroId:id,polygon,site:points20[i],
       targetScale:sizeTargets[i],scale:actual[i]/reference
     })),stats:{maxError,iterations:iter,attempt,
       minScale:Math.min(...actual)/reference,maxScale:Math.max(...actual)/reference}};
   }
   throw Error('Unable to balance 20 Voronoi subcells for territory '+id);
 }
 function generate(macros,seed){const fineCells=[],groups={},stats={territories:macros.length,perTerritory:20,maxError:0,maxIterations:0,maxAttempts:0,minScale:Infinity,maxScale:0};
   for(const macro of macros){const r=generateOne(macro,seed),id=macro.macroId??macro.id;groups[id]=r.cells;fineCells.push(...r.cells);
     stats.maxError=Math.max(stats.maxError,r.stats.maxError);stats.maxIterations=Math.max(stats.maxIterations,r.stats.iterations);stats.maxAttempts=Math.max(stats.maxAttempts,r.stats.attempt);
     stats.minScale=Math.min(stats.minScale,r.stats.minScale);stats.maxScale=Math.max(stats.maxScale,r.stats.maxScale)}
   stats.total=fineCells.length;return{fineCells,groups,stats}
 }
 const api=Object.freeze({generate,generateOne,area});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.ConquerRegionalMicroVoronoi=api;
})(typeof window==='object'?window:{});
