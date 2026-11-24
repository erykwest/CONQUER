'use strict';
// Shared polyline geometry only: routing, speed and actor heading stay with callers.
// No array-identity cache: callers may edit a saved route or one of its points in place.
(function(){
  const span=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
  function measure(points){
    const cum=[0];for(let i=1;i<points.length;i++)cum.push(cum[i-1]+span(points[i-1],points[i]));
    return{pts:points,cum,total:cum[cum.length-1]||0};
  }
  // A measured path uses outgoing segments at an exact vertex, matching vehicle motion.
  // Measure again after editing points: the cumulative distances are a derived snapshot.
  function at(path,distance){
    const {pts,cum}=path;if(!pts.length)return null;
    const s=Math.max(0,Math.min(path.total,distance));
    let lo=0,hi=cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(cum[m]<=s)lo=m;else hi=m}
    const a=pts[lo],b=pts[Math.min(lo+1,pts.length-1)],length=cum[Math.min(lo+1,cum.length-1)]-cum[lo];
    const t=length>1e-9?(s-cum[lo])/length:0;
    return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
  // Incoming-segment sampling. Most actors accumulate the covered distance; a
  // residual walk subtracts each span and clamps its final interpolation (signposts).
  // Keeping both arithmetic policies preserves exact junction selection and each
  // caller's historical short-segment floor without prescribing actor heading.
  function sample(points,distance,{minimumSpan=0,residual=false}={}){
    if(!points.length)return null;
    let used=0,left=distance;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],length=span(a,b);
      if(residual?(left<=length||i===points.length-1):used+length>=distance){
        const offset=residual?left:distance-used,denominator=Math.max(minimumSpan,length);
        let t=denominator?offset/denominator:0;
        if(residual)t=Math.max(0,Math.min(1,t));
        return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:Math.atan2(b.y-a.y,b.x-a.x),segment:i-1};
      }
      used+=length;left-=length;
    }
    const a=points.at(-2)||points[0],b=points.at(-1)||a;
    return{...b,heading:Math.atan2(b.y-a.y,b.x-a.x),segment:Math.max(0,points.length-2)};
  }
  const reverse=points=>points.slice().reverse();
  window.ConquerPath=Object.freeze({measure,at,sample,reverse});
})();
