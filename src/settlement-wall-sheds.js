'use strict';
// Wall sheds: open lean-to sheds on posts along the INNER face of a finished curtain wall,
// spawned automatically (no command, no cost). They reuse the yard shed of the L3/L4 town
// houses (settlement-urban.js urbanLotOutbuildings, part type 'shed'; drawn by
// settlement-world3d.js addOutbuilding): the high side backs onto the wall, the open side
// faces the bailey.
//  - Never on a wall with a wall-walk stair (settlement-wall-stairs.js); on a wall with a
//    lean-to (settlement-lean-to.js, at most 4U) only clear of its stretch.
//  - Kept clear of tower / gate sockets at snapped ends.
//  - Deterministic per wall (seeded by the wall id): the same wall always gets the same sheds.
// Visual only: the sheds do not block movement and hold no rooms.
(function(){
  const TOWER_PAD=.6,END_PAD=.25,GAP=.05,DEPTH=.78,MAX=4;
  const cache=new Map();
  function eligible(w){
    return !!w&&w.type==='wall'&&!!w.a&&!!w.b&&!underConstruction(w)&&!w.wallStair;
  }
  function keyOf(w){const lt=window.ConquerLeanTo?.ofWall(w);return [lt?lt.a.x+':'+lt.a.y+':'+lt.b.x:'',w.id,w.a.x,w.a.y,w.b.x,w.b.y,w.width,w.level,w.aSnap||'',w.bSnap||'',w.flip?1:0,State.seed].join('|')}
  // Interior normal: opposite the exterior side, as the lean-to (settlement-lean-to.js make).
  function frame(w){
    const dx=w.b.x-w.a.x,dy=w.b.y-w.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
    const side=typeof wallExteriorSide==='function'?wallExteriorSide(w):1;
    return{L,ux,uy,inward:{x:-nx*side,y:-ny*side},face:(Number(w.width)||.5)/2};
  }
  function parts(w){
    if(!eligible(w))return[];
    const key=keyOf(w),hit=cache.get(w.id);if(hit&&hit.key===key)return hit.parts;
    const f=frame(w),out=[];
    const start=w.aSnap?TOWER_PAD:END_PAD,end=f.L-(w.bSnap?TOWER_PAD:END_PAD);
    const angle=Math.atan2(f.inward.y,f.inward.x)-Math.PI/2;
    const wallH=typeof structureHeight==='function'?structureHeight(w):1.15;
    // A small seeded generator per wall (mulberry32): the hash bits alone are too correlated
    // and every shed came out alike.
    let st=peasantHash(w.id+'|sheds:'+(State.seed||1))>>>0;
    const rnd=()=>{st=(st+0x6D2B79F5)|0;let t=Math.imul(st^st>>>15,1|st);t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296};
    const max=Math.min(MAX,Math.floor(rnd()*(MAX+1.6)));            // 0..MAX, some walls stay bare
    // The stretch a lean-to takes (U along the wall), with a little clearance.
    const lt=window.ConquerLeanTo?.ofWall(w),proj=p=>(p.x-w.a.x)*f.ux+(p.y-w.a.y)*f.uy;
    const busy=lt?[Math.min(proj(lt.a),proj(lt.b))-.2,Math.max(proj(lt.a),proj(lt.b))+.2]:null;
    let along=start+rnd()*1.8,k=0;
    while(along<end&&out.length<max&&k<16){
      k++;
      if(rnd()<.22){along+=.4+rnd()*1.8;continue}     // a free bay
      const width=.75+rnd()*1.5;                       // 0.75..2.25
      const depth=.6+rnd()*.45;
      if(busy&&along<busy[1]&&along+width>busy[0]){along=busy[1];continue}
      if(along+width>end){if(width>1.1){along+=.25;continue}break}
      // Open sheds only: the eave never drops below the town-yard shed's (0.62), so the bay
      // stays open and its goods show.
      const bodyH=.62+rnd()*.18;
      const roofH=Math.min(wallH-.06,bodyH+.2+rnd()*.25);
      const thatch=rnd()<.3;                            // about one shed in three is thatched
      const mid=along+width/2,off=f.face+GAP+depth/2;
      const center={x:w.a.x+f.ux*mid+f.inward.x*off,y:w.a.y+f.uy*mid+f.inward.y*off};
      out.push({kind:'outbuilding',type:'shed',center,points:rectWorldPoints(center.x,center.y,width,depth,angle),
        w:width,h:depth,roofTurn:0,roofAngle:angle,bodyH,roofH,thatch,buildingKey:w.id+'|shed:'+k,wallId:w.id});
      along+=width+.1+rnd()*rnd()*1.4;
    }
    cache.set(w.id,{key,parts:out});
    return out;
  }
  function all(){return(State.structures||[]).filter(s=>s.type==='wall').flatMap(parts)}
  // What the sheds depend on, for the renderers' mesh caches (a stair or a lean-to frees or
  // takes a wall; a wall finished, moved or rebuilt changes its sheds).
  function signature(){
    let h=0;
    for(const w of State.structures||[])if(w.type==='wall'){const s=eligible(w)?keyOf(w):w.id+'-';for(let i=0;i<s.length;i++)h=(Math.imul(h,31)+s.charCodeAt(i))|0}
    return h;
  }
  window.ConquerWallSheds=Object.freeze({eligible,parts,all,frame,signature,DEPTH});
})();
