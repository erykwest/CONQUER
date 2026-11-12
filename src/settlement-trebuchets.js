'use strict';
// CONQUER trebuchets: an enemy siege engine as a unit. Placed outside the walls (Combat panel,
// "Assault · trebuchet", or ConquerTrebuchets.add({x,y})), it is set up (the model's set-up
// animation), then shoots a burning stone at the nearest fortification in range every cycle of
// the model (ConquerSiegeEngines3D.CYCLE.trebuchet). Each stone is a real hit
// (ConquerSiege.attackStructure, weapon 'trebuchet') plus the fire system's burning stone;
// when its target falls it picks the next one. Four crewmen work it; with all of them down
// (ConquerTrebuchets.crewHit) it stops. Runs on game time (tick from the simulation).
(function(){
  const SE=()=>window.ConquerSiegeEngines3D;
  const RANGE=()=>SE()?.RANGE?.trebuchet||28,CYCLE=()=>SE()?.CYCLE?.trebuchet||6;
  const SETUP_S=6,RELEASE=.18,FORCE=.5,CREW=4;
  const HOSTILE='#171716',HOSTILE_LIVERY={main:'#171716',alt:'#e3bd31',mainDark:'#090909',altDark:'#95781a'};
  const list=[];
  const centre=s=>s.a&&s.b?{x:(s.a.x+s.b.x)/2,y:(s.a.y+s.b.y)/2}:{x:s.x,y:s.y};
  const standing=s=>s&&!s.destroyed&&!(typeof underConstruction==='function'&&underConstruction(s))&&
    ['tower','wall','gate','palisade'].includes(s.type)&&!window.ConquerSiege?.state?.().ruins?.some?.(r=>r.id===s.id);
  function pickTarget(t){
    let best=null,bd=Infinity;
    for(const s of State.structures||[]){
      if(!standing(s))continue;
      const c=centre(s),d=Math.hypot(c.x-t.x,c.y-t.y);
      if(d<=RANGE()&&d<bd){best=s;bd=d}
    }
    return best;
  }
  function add({x,y,id=null}={}){
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const t={id:id||'treb-'+(typeof uid==='function'?uid():Date.now()+Math.random()),x,y,heading:0,age:0,clock:0,shots:0,crew:CREW,target:null};
    const target=pickTarget(t);
    if(!target)return{ok:false,reason:'No fortification within '+RANGE()+'U'};
    t.target=target.id;const c=centre(target);t.heading=Math.atan2(c.y-y,c.x-x);
    list.push(t);requestFrame();
    return{ok:true,trebuchet:t,target:target.id};
  }
  function remove(id){const i=list.findIndex(t=>t.id===id);if(i>=0)list.splice(i,1);requestFrame()}
  function clear(){list.length=0;requestFrame()}
  function crewHit(id){const t=list.find(x=>x.id===id);if(t&&t.crew>0)t.crew--;return t?.crew??0}
  function shoot(t){
    let s=State.structures.find(x=>x.id===t.target);
    if(!standing(s)){s=pickTarget(t);t.target=s?.id||null;if(s){const c=centre(s);t.heading=Math.atan2(c.y-t.y,c.x-t.x)}}
    if(!s)return;
    const c=centre(s);
    // volley() throws from the far side of `origin`: mirror the engine through the target.
    window.ConquerFire?.volley?.(s,'stone',{x:2*c.x-t.x,y:2*c.y-t.y});
    const out=window.ConquerSiege?.attackStructure?.(s.id,'trebuchet',FORCE);
    t.shots++;t.last={target:s.id,ok:!!out?.ok,damage:out?.damage||0};
  }
  function tick(dt){
    if(!list.length||!(dt>0))return;
    for(const t of list){
      t.age+=dt;
      if(t.age<SETUP_S||t.crew<=0||!t.target&&!pickTarget(t))continue;
      const n=CYCLE(),before=(t.clock%n)/n;t.clock+=dt;const after=(t.clock%n)/n;
      if((before<RELEASE&&after>=RELEASE)||(after<before&&before<RELEASE))shoot(t);
    }
    requestFrame();
  }
  const place=t=>({x:t.x,y:t.y,z:typeof terrainElevation==='function'?terrainElevation(t):0,heading:t.heading,team:HOSTILE});
  const state=t=>t.age<SETUP_S?{mode:'setup',t:1+t.age/SETUP_S*5}:t.crew>0?{mode:'fire',t:t.clock}:{mode:'idle'};
  // World meshes for the 3D front pass (settlement-world3d.js drawFront).
  function dynamicMeshes(){return SE()?list.map(t=>SE().triangles('trebuchet',place(t),state(t))):[]}
  // The crew at the model's posts (depth-tested soldiers in 3D); 2.5D also gets a timber outline.
  function draw(){
    if(!list.length)return;
    const se=SE();
    for(const t of list){
      const p=place(t);
      if(!window.ConquerWorld3D?.active?.()){
        const a=w2s({x:t.x-Math.cos(t.heading)*1.2,y:t.y-Math.sin(t.heading)*1.2},.2),b=w2s({x:t.x+Math.cos(t.heading)*1.2,y:t.y+Math.sin(t.heading)*1.2},1.6);
        ctx.save();ctx.strokeStyle='#6b4a2c';ctx.lineWidth=Math.max(3,State.view.scale*5);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
      }
      const posts=se?se.crew('trebuchet',p):[];
      for(let i=0;i<Math.min(t.crew,posts.length);i++){
        const q=posts[i];
        if(typeof worldPointVisible==='function'&&!worldPointVisible(q,0,48))continue;
        drawSoldierFigure({x:q.x,y:q.y},(q.z||0)-(p.z||0),'spearman',t.id+':crew:'+i,(t.clock+i*.3)/CYCLE(),HOSTILE_LIVERY);
      }
    }
  }
  function requestFrame(){if(typeof requestDraw==='function')requestDraw()}
  window.ConquerTrebuchets={add,remove,clear,crewHit,tick,dynamicMeshes,draw,list:()=>list.slice(),RANGE,FORCE};
})();
