'use strict';
// Molo: a timber pier built on the sea coast, or branching off a stone quay
// (settlement-quay.js). Its local frame starts on the coastline (or the quay's sea edge),
// +X runs out to sea for its reach, -X is a short landing on the shore. Two sizes: L4 and
// L12 (piers saved before the sizes keep L8). The deck stands on pile bents driven into
// the sea bed; scatter props sit on the boards and two mooring points (left / right of
// the head) are where ships tie up. Placement asks only for the coast and the whitezone.
(() => {
  const LAND=1.5,HALF=.75,TOP=.6,BED=-.6,MOOR_OUT=.9;
  const SIZES=Object.freeze({
    4:{days:4,cost:Object.freeze({gold:30,wood:60})},
    8:{days:6,cost:Object.freeze({gold:55,wood:110})},       // legacy saves
    12:{days:8,cost:Object.freeze({gold:80,wood:160})}
  });
  const reachOf=s=>SIZES[Number(s?.reach)]?Number(s.reach):8;
  const moorAt=s=>reachOf(s)-1.6;                            // berth: along the head, off the deck edge
  const SPEC=Object.freeze({label:'Molo',name:'Pier',h:HALF*2,sizes:SIZES});
  const WOOD='#8a6239',WOOD2='#9b7044',DARK='#5b3b22',PILE='#4a3322',WET='#2f3a33',STONE='#8f8a7e';
  const is=s=>s?.type==='pier';
  const make=(reach=12)=>({type:'pier',shape:'pier',reach,w:LAND+reach,h:HALF*2,functions:[]});
  const toWorld=(s,x,y)=>{const a=s.angle||0,c=Math.cos(a),sn=Math.sin(a);return{x:s.x+x*c-y*sn,y:s.y+x*sn+y*c}};
  const rect=(s,x0,x1,y0,y1)=>[toWorld(s,x0,y0),toWorld(s,x1,y0),toWorld(s,x1,y1),toWorld(s,x0,y1)];
  const footprint=s=>rect(s,-LAND,reachOf(s),-HALF,HALF);
  const landing=s=>rect(s,-LAND,0,-HALF,HALF);
  const seaOf=()=>(State.environment||[]).find(f=>f.type==='sea'&&f.coastline?.length>1)||null;

  // Nearest coastline point and the normal pointing out to sea.
  function coastHit(p){
    const sea=seaOf();if(!sea)return null;
    let best=null;
    for(let i=1;i<sea.coastline.length;i++){
      const a=sea.coastline[i-1],b=sea.coastline[i],q=closestPointOnSegment(p,a,b),d=dist(p,q);
      if(!best||d<best.d)best={d,point:q,a,b};
    }
    const dx=best.b.x-best.a.x,dy=best.b.y-best.a.y,L=Math.hypot(dx,dy)||1;
    let n={x:-dy/L,y:dx/L};
    if(!environmentContains(sea,{x:best.point.x+n.x*1.5,y:best.point.y+n.y*1.5}))n={x:-n.x,y:-n.y};
    return{sea,point:best.point,distance:best.d,normal:n};
  }
  // Where a pier can start near p: the sea edge of a quay when one is at hand (a quay built
  // on the shore runs right by the coastline, so it must win within its reach), else the coast.
  const QUAY_REACH=2.5;
  function rootHit(p){
    const coast=coastHit(p),quay=window.ConquerQuay?.edgeHit(p);
    if(quay&&(quay.distance<=QUAY_REACH||!coast||quay.distance<=coast.distance))return{...quay,sea:coast?.sea||seaOf(),onQuay:quay.quay.id};
    return coast&&{...coast,onQuay:null};
  }
  // The pier always sits on the coast (or a quay), square to it: the cursor only picks where.
  function snapToCoast(s){
    const hit=rootHit(s);if(!hit)return s;
    s.x=hit.point.x;s.y=hit.point.y;s.angle=Math.atan2(hit.normal.y,hit.normal.x);
    s.rotationStep=structureRotationStep(s.angle);s.onQuay=hit.onQuay||null;
    return s;
  }
  // Deck level: above the highest ground under the landing (never below the waterline);
  // on a quay the deck is flush with the quay top.
  const groundLevel=s=>s.onQuay?0:Math.max(0,...[-LAND+.1,-LAND/2,-.2].flatMap(x=>[-HALF,0,HALF].map(y=>terrainElevation(toWorld(s,x,y)))));

  function validate(s){
    if(!is(s))return{ok:false,reason:'Not a pier'};
    const hit=rootHit(s);
    if(!hit)return{ok:false,reason:'A pier needs a sea coast'};
    if(hit.distance>.3)return{ok:false,reason:'A pier must start on the coastline or a quay'};
    // Only the landing must be in the whitezone: the deck reaches out over the sea.
    // No buildable-terrain rules: slopes, woods and uneven shore are fine.
    if(landing(s).some(v=>v.x<BUILD_MIN||v.x>BUILD_MAX||v.y<BUILD_MIN||v.y>BUILD_MAX))
      return{ok:false,reason:'The pier landing must be inside the whitezone (100×100U)'};
    const R=reachOf(s),sea=hit.sea;
    for(const x of [Math.min(2,R*.5),R/2,R-.1])for(const y of [-HALF,HALF])
      if(!sea||!environmentContains(sea,toWorld(s,x,y)))return{ok:false,reason:'The pier must reach out over open sea'};
    return{ok:true,ground:groundLevel({...s,onQuay:hit.onQuay}),onQuay:hit.onQuay||null};
  }

  // Berths: where a ship lies alongside, one each side of the head, bow towards the sea.
  function moorings(s){
    const a=s.angle||0,at=moorAt(s);
    return[['left',1],['right',-1]].map(([side,k])=>{
      const p=toWorld(s,at,k*(HALF+MOOR_OUT)),post=toWorld(s,at,k*(HALF-.13));
      return{side,x:p.x,y:p.y,angle:a,bollard:post,edge:toWorld(s,at,k*HALF),out:{x:-Math.sin(a)*k,y:Math.cos(a)*k}};
    });
  }

  // ---------- geometry: [{pos,col}] world-space triangles (settlement-mesh3d.js format)
  const cache=new Map();
  function meshes(s,ground){
    const g=Number.isFinite(ground)?ground:Number.isFinite(s.groundZ)?s.groundZ:groundLevel(s);
    const REACH=reachOf(s),MOOR_AT=moorAt(s),key=[s.x,s.y,s.angle,g,REACH,s.onQuay||''].join('|');
    const hit=cache.get(s.id);if(hit&&hit.key===key)return hit.list;
    const top=g+TOP,pos=[],col=[];
    const P=(x,y,z)=>{const p=toWorld(s,x,y);return[p.x,p.y,z]};
    const box=(x0,x1,y0,y1,z0,z1,c)=>{
      const v=[];for(const x of [x0,x1])for(const y of [y0,y1])for(const z of [z0,z1])v.push(P(x,y,z));
      for(const [i,j,k,l] of [[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6],[0,1,3,2],[4,6,7,5]])
        for(const tri of [[i,j,k],[i,k,l]]){for(const q of tri)pos.push(...v[q]);col.push(c)}
    };
    // Deck: cross planks with small gaps, on three stringers.
    const plank=.3;
    for(let x=-LAND,i=0;x<REACH-.01;x+=plank,i++)
      box(x+.015,Math.min(REACH,x+plank)-.015,-HALF,HALF,top-.06,top,i%3===1?WOOD2:WOOD);
    for(const y of [-HALF+.12,0,HALF-.12])box(-LAND,REACH,y-.07,y+.07,top-.17,top-.06,DARK);
    // Pile bents: a pair of piles into the sea bed and a headstock under the stringers,
    // the waterline marked by a darker wet band. On the shore a stone crib carries the landing.
    // (On a quay the landing rests on the quay itself.)
    if(!s.onQuay){
      box(-LAND,0,-HALF-.05,HALF+.05,Math.min(g,terrainElevation(toWorld(s,-LAND,0)))-.02,top-.06,STONE);
      box(-LAND-.6,-LAND,-HALF+.1,HALF-.1,g-.02,g+(top-g)*.5,STONE);        // step up from the shore
    }
    const bents=[];for(let x=.5;x<REACH-.4;x+=1.5)bents.push(x);bents.push(REACH-.12);
    for(const x of bents){
      for(const k of [-1,1]){
        // Every pile rises above the boards; the head pair stands taller.
        const y=k*(HALF-.08),head=x===bents[bents.length-1];
        box(x-.08,x+.08,y-.08,y+.08,g+BED,head?top+.32:top+.18,PILE);
        box(x-.09,x+.09,y-.09,y+.09,g-.08,g+.06,WET);
      }
      box(x-.07,x+.07,-HALF,HALF,top-.27,top-.17,DARK);
    }
    // Berths: a bollard on the deck edge and two fenders hanging over the side.
    for(const m of [1,-1]){
      const y=m*(HALF-.13);
      box(MOOR_AT-.09,MOOR_AT+.09,y-.09,y+.09,top,top+.24,DARK);
      box(MOOR_AT-.12,MOOR_AT+.12,y-.12,y+.12,top+.18,top+.22,PILE);
      for(const dx of [-.9,.9])box(MOOR_AT+dx-.06,MOOR_AT+dx+.06,m*HALF-(m>0?0:.07),m*HALF+(m>0?.07:0),g-.05,top-.02,DARK);
    }
    const list=[{pos,col}];
    const props=deckProps(s,top,REACH,MOOR_AT);if(props)list.push(props);
    cache.set(s.id,{key,list});
    return list;
  }
  // Goods waiting on the boards, kept off the centre lane and away from the bollards.
  const PROPS=['crateStack','barrelGroup','sackPile','crateStack','goodsMixed'];
  function deckProps(s,top,REACH,MOOR_AT){
    const M=window.ConquerScatterModel;if(!M?.assets)return null;
    const rnd=seedRand((Number(State.seed)||1)^[...String(s.id||'pier')].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619),2166136261));
    // Goods every ~1.4U along the deck, alternating sides, clear of the berths; rope by the bollards.
    const spots=[];for(let x=-.7,i=0;x<MOOR_AT-.6;x+=1.4,i++)spots.push([x,i%2?-.42:.42,false]);
    spots.push([MOOR_AT+.55,.38,true],[MOOR_AT+.55,-.38,true]);
    const pos=[],col=[];
    spots.forEach(([x,y,rope])=>{
      const i=rope?4:0,name=rope?'ropeCoil':PROPS[Math.floor(rnd()*PROPS.length)],a=M.assets[name];if(!a)return;
      const k=i>=4?1.1:1.15,h=(s.angle||0)+(rnd()<.5?0:Math.PI/2)+(rnd()-.5)*.3,c=Math.cos(h)*k,sn=Math.sin(h)*k,o=toWorld(s,x,y);
      for(let t=0;t<a.c.length;t++){
        for(let q=0;q<3;q++){const j=a.i[t*3+q]*3,vx=a.v[j],vy=a.v[j+1];pos.push(o.x+vx*c-vy*sn,o.y+vx*sn+vy*c,top+a.v[j+2]*k)}
        col.push(M.palette[a.c[t]]);
      }
    });
    return col.length?{pos,col}:null;
  }

  function draw(s,preview=false){
    if(!is(s)||!window.ConquerMesh3D)return false;
    ctx.save();
    if(preview)ctx.globalAlpha*=.62;
    window.ConquerMesh3D.drawMeshes(ctx,meshes(s),window.ConquerMesh3D.gameView());
    ctx.restore();
    return true;
  }
  function addToBuilder(m,s){
    if(!is(s)||!window.ConquerMesh3D)return false;
    for(const mesh of meshes(s)){
      const p=mesh.pos;
      for(let t=0;t<mesh.col.length;t++){
        const o=t*9;
        m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
      }
    }
    return true;
  }
  const label=s=>SPEC.label+' L'+reachOf(s)+' · '+reachOf(s)+'U · 2 attracchi';
  const cost=s=>({...SIZES[reachOf(s)].cost});
  const buildDays=s=>SIZES[reachOf(s)].days;
  function panelHtml(s){
    return'<div class="slot"><div class="slot-label">Attracchi</div>'+moorings(s).map(m=>
      '<div class="kv"><span>'+(m.side==='left'?'Sinistra':'Destra')+'</span><b>'+m.x.toFixed(1)+', '+m.y.toFixed(1)+'</b></div>').join('')+
      '</div><div class="legend">Molo in legno su pali, lungo '+reachOf(s)+'U verso il mare'+(s.onQuay?', agganciato alla banchina':'')+'. Va costruito sulla costa o su una banchina, con l\'approdo dentro la whitezone.</div>';
  }
  window.ConquerPier=Object.freeze({SPEC,SIZES,LAND,HALF,TOP,is,make,reachOf,footprint,landing,coastHit,rootHit,snapToCoast,groundLevel,validate,moorings,meshes,draw,addToBuilder,label,cost,buildDays,panelHtml});
})();
