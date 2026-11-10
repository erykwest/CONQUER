'use strict';
// One explicit contract shared by regional export and local demo startup.
(()=>{
  const terrainToBiome=Object.freeze({plain:'plains',forest:'forest',hills:'mountains',sea:'sea',swamp:'swamp',lake:'lake'});
  const biomeForTerrain=terrain=>Object.hasOwn(terrainToBiome,terrain)?terrainToBiome[terrain]:null;
  const directions=Object.freeze({north:[0,-1],northEast:[1,-1],east:[1,0],southEast:[1,1],south:[0,1],southWest:[-1,1],west:[-1,0],northWest:[-1,-1]});
  const contains=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes};
  function sampleSurroundings(selected,territories,width,height){
    const result={},origin=selected.centroid,ring=selected.polygon;
    for(const [name,[vx,vy]] of Object.entries(directions)){
      const len=Math.hypot(vx,vy),dx=vx/len,dy=vy/len;let exit=Infinity;
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length],ex=b.x-a.x,ey=b.y-a.y,den=dx*ey-dy*ex;
        if(Math.abs(den)<1e-10)continue;
        const ax=a.x-origin.x,ay=a.y-origin.y,t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
        if(t>0&&u>=-1e-8&&u<=1+1e-8)exit=Math.min(exit,t);
      }
      if(!Number.isFinite(exit))throw Error('Invalid selected territory polygon');
      const epsilon=Math.max(width,height)*1e-5,p={x:origin.x+dx*(exit+epsilon),y:origin.y+dy*(exit+epsilon)};
      const outside=p.x<0||p.y<0||p.x>width||p.y>height;
      const found=outside?selected:territories.find(t=>t.id!==selected.id&&contains(p,t.polygon));
      if(!found)throw Error('No regional terrain found at '+name);
      result[name]={id:found.id,code:found.code,terrain:found.terrain,biome:biomeForTerrain(found.terrain),source:outside?'world-edge':'regional-cell'};
    }
    return result;
  }
  function weights(p,center,neighbors){
    const ease=d=>{const t=Math.min(1,Math.max(0,d/25));return t*t*(3-2*t)};
    const h=ease(Math.max(50-p.x,p.x-150,0)),v=ease(Math.max(50-p.y,p.y-150,0)),out={};
    const horizontal=p.x<50?'west':'east',vertical=p.y<50?'north':'south';
    const diagonal=vertical+horizontal[0].toUpperCase()+horizontal.slice(1);
    const add=(b,w)=>{if(w>0)out[b]=(out[b]||0)+w};
    add(center,(1-h)*(1-v));add(neighbors[horizontal]||center,h*(1-v));
    add(neighbors[vertical]||center,v*(1-h));add(neighbors[diagonal]||center,h*v);
    return out;
  }
  function riverJunctionCount(touching,all){
    const key=p=>p.x.toFixed(4)+','+p.y.toFixed(4),degree=new Map(),local=new Set();
    for(const edge of all)for(const p of [edge.start,edge.end])degree.set(key(p),(degree.get(key(p))||0)+1);
    for(const edge of touching)for(const p of [edge.start,edge.end])local.add(key(p));
    return Math.min(3,[...local].reduce((sum,k)=>sum+Math.max(0,(degree.get(k)||0)-2),0));
  }
  const isSelectableTerrain=terrain=>!!biomeForTerrain(terrain)&&!['sea','lake'].includes(terrain);
  const landBiomes=Object.freeze(['plains','forest','mountains','swamp']);
  const api={biomeForTerrain,isSelectableTerrain,landBiomes,riverJunctionCount,directions,sampleSurroundings,weights};
  if(typeof window!=='undefined')window.ConquerRegionalBiomeRules=api;
  if(typeof module!=='undefined')module.exports=api;
})();
