'use strict';
// CONQUER civic buildings in 3D: the Blender-built church, tavern, market and piazza
// (three levels, three piazza variants), the civic annexes and the church cemetery
// (src/assets/civic-models.js, ASSETS/blender/build_civic.py). Models are in the
// structure's local axes (houseLocalToWorld, front at -y) on the civicParts /
// annex footprints. One set of world triangles feeds both renderers.
(function(){
  const DATA=()=>window.ConquerCivicModels;
  const WINTER=['#e7ece8','#dce3de'];
  // Model key of a structure: church2, plaza_fountain3, an annex type, or null.
  function modelKey(s){
    if(!s)return null;
    const level=typeof civicLevel==='function'?civicLevel(s):1;
    if(s.type==='civicAnnex'){
      // The church square uses the piazza models at its parent's level.
      if(s.annexType!=='square')return s.annexType;
      const parent=(State.structures||[]).find(p=>p.id===s.parentId);
      return 'plaza_'+(typeof plazaVariant==='function'?plazaVariant(s):'paved')+(parent&&typeof civicLevel==='function'?civicLevel(parent):1);
    }
    if(s.type==='plaza')return 'plaza_'+(typeof plazaVariant==='function'?plazaVariant(s):'paved')+level;
    if(['church','tavern','market','townhall','guild'].includes(s.type))return s.type+level;
    return null;
  }
  const has=s=>{const k=modelKey(s);return !!(k&&DATA()?.models?.[k])};
  // Placement of the model: the church square shrinks the 5 U piazza to its 4 U annex.
  const placeOf=s=>s.type==='civicAnnex'&&s.annexType==='square'?{x:s.x,y:s.y,angle:s.angle,scale:.8}:s;
  // Indexed parts expanded once into flat triangle lists.
  const expanded=new Map();
  function parts(key){
    let out=expanded.get(key);if(out)return out;
    out=[];
    for(const [name,part] of Object.entries(DATA().models[key].parts)){
      const v=new Float32Array(part.i.length*3);
      for(let k=0;k<part.i.length;k++){const j=part.i[k]*3;v[k*3]=part.p[j];v[k*3+1]=part.p[j+1];v[k*3+2]=part.p[j+2]}
      out.push({name,v,c:part.c});
    }
    expanded.set(key,out);return out;
  }
  // Brick masonry (masonryMaterial 'brick') and the DEV clay palette: brick walls with
  // light stone dressings, slate roofs turned to tile. The structure being meshed sets it.
  const CLAY={stoneRough:'#9a5a3e',stoneRoughDark:'#7a4430',stone:'#a8603f',stoneLight:'#b56d4a',
    stoneTrim:'#c9bca2',roofSlate:'#a5573a',roofSlateDark:'#88452e'};
  let clayFor=false;
  const isClay=s=>typeof State!=='undefined'&&State.visualPalette==='clay'||!!s&&typeof masonryMaterial==='function'&&masonryMaterial(s)==='brick';
  function withClay(s,fn){const prev=clayFor;clayFor=isClay(s);try{return fn()}finally{clayFor=prev}}
  // Palette with the roofs whitened in winter (light and dark tones kept apart).
  const palCache=new Map();
  function palette(){
    const data=DATA(),winter=typeof State!=='undefined'&&State.season==='winter',clay=clayFor||isClay(null),ck=(winter?'w':'s')+(clay?'c':'');
    const hit=palCache.get(ck);if(hit&&hit.data===data)return hit.pal;
    const pal=data.palette.map((hex,i)=>{const k=data.paletteKeys[i];
      return winter&&k.startsWith('roof')?WINTER[/Dark$/.test(k)?1:0]:clay&&CLAY[k]||hex});
    palCache.set(ck,{data,pal});return pal;
  }
  // World triangles of model `key` at place {x,y,angle,scale}; ground parts paint first.
  function triangles(key,place,ground){
    const pal=palette(),a=Number(place.angle)||0,c=Math.cos(a),sn=Math.sin(a),k=place.scale||1,z0=ground||0;
    const pos=[],col=[],gi=[],groups=[],groupBias=[];
    for(const part of parts(key)){
      const g=groups.length,start=pos.length,v=part.v;
      for(let i=0;i<v.length;i+=3){
        const x=v[i]*k,y=v[i+1]*k;
        pos.push(place.x+x*c-y*sn,place.y+x*sn+y*c,z0+v[i+2]*k);
      }
      for(const ci of part.c){col.push(pal[ci]);gi.push(g)}
      let cx=0,cy=0,cz=0;const n=(pos.length-start)/3||1;
      for(let i=start;i<pos.length;i+=3){cx+=pos[i];cy+=pos[i+1];cz+=pos[i+2]}
      groups.push([cx/n,cy/n,cz/n]);groupBias.push(part.name.startsWith('ground')?-1e6:0);
    }
    return{pos,col,gi,groups,groupBias};
  }
  // ---------- lot props: the churchyard and the inn's tables fill the Voronoi lot
  // Graves follow the church axis in loose, wavy rows with gaps; cypresses keep to the
  // lot edge; tables gather around the inn. Deterministic (map seed + structure id),
  // never on the building as built at its level, its annexes, roads or the entrance.
  // Small props are enlarged to stay legible at play zoom (as the scatter goods);
  // radii are the scaled footprints used to keep props apart.
  const PROP_SCALE={treeOak:1,treeLinden:1,graveStone:1.45,graveWorn:1.45,graveCross:1.45,graveSlab:1.45,graveTall:1.45,cemeteryCross:1.35,
    cypress:1.25,cypressSmall:1.25,tableSet:1.3,tableBarrel:1.3,tablePergola:1.25,flowerBush:1.3};
  const PROP_R={treeOak:.55,treeLinden:.5,graveStone:.24,graveWorn:.24,graveCross:.24,graveSlab:.27,graveTall:.29,cemeteryCross:.55,
    cypress:.3,cypressSmall:.26,tableSet:.8,tableBarrel:.55,tablePergola:1.15,flowerBush:.28};
  const GRAVES={1:[['graveCross',4],['graveWorn',3],['graveStone',2]],
    2:[['graveStone',4],['graveWorn',2],['graveCross',2],['graveSlab',1]],
    3:[['graveStone',4],['graveSlab',2],['graveTall',1.5],['graveWorn',1],['graveCross',1]]};
  const GRAVE_COUNT={1:70,2:120,3:180};
  const PROP_LOD_SCALE=.75;
  const TABLES={1:[['tableSet',2],['tableBarrel',1]],2:[['tableSet',3],['tableBarrel',2]],3:[['tableBarrel',1]]};
  const TABLE_COUNT={1:6,2:10,3:4};
  // Yard goods reused from the environmental scatter (src/assets/scatter-model.js).
  const YARD={1:[['barrelGroup',3],['firewood',2],['crateStack',1],['hayBales',1]],
    2:[['barrelGroup',3],['crateStack',2],['sackPile',2],['firewood',1],['cartParked',1]],
    3:[['barrelGroup',3],['crateStack',2],['goodsMixed',2],['carriageParked',1]]};
  const YARD_COUNT={1:3,2:4,3:4};
  const SC=()=>window.ConquerScatterModel;
  const scR=a=>(SC()?.assets?.[a]?.r||.5)*1.3;
  // What actually stands on the footprint at each level (local rects, U): the chapel
  // and the L / T inns leave part of the gameplay footprint free for props.
  const BUILT={church1:[{cx:0,cy:-.05,w:2.1,h:4.15},{cx:0,cy:-2.52,w:1.2,h:1.25}],
    tavern1:[{cx:0,cy:.77,w:2.2,h:3.46},{cx:.6,cy:-1.72,w:3.4,h:1.55}],
    tavern2:[{cx:0,cy:.77,w:2.2,h:3.46},{cx:0,cy:-1.72,w:4.6,h:1.55}]};
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rng(key){let a=((typeof State!=='undefined'&&Number(State.seed))||1)^hash(String(key));
    return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function pick(rnd,list){let r=rnd()*list.reduce((s,[,w])=>s+w,0);for(const [a,w] of list)if((r-=w)<0)return a;return list[0][0]}
  function inPoly(p,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)c=!c}return c}
  function segDist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/L));
    return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)}
  function edgeDist(p,pts){let d=Infinity;for(let i=0;i<pts.length;i++)d=Math.min(d,segDist(p,pts[i],pts[(i+1)%pts.length]));return d}
  // Signed clearance from a polygon: negative inside.
  const clearance=(p,pts)=>inPoly(p,pts)?-edgeDist(p,pts):edgeDist(p,pts);
  function lotOf(s){
    try{const lot=urbanLots().find(l=>l.civicId===s.id);if(lot?.points?.length>2)return lot.points}catch{}
    return null;
  }
  function bodyPolys(s,level){
    const rects=BUILT[s.type+level];
    if(!rects)return civicParts(s).map(p=>p.points);
    const a=s.angle||0,c=Math.cos(a),sn=Math.sin(a);
    return rects.map(r=>{const x=s.x+r.cx*c-r.cy*sn,y=s.y+r.cx*sn+r.cy*c;return rectWorldPoints(x,y,r.w,r.h,a)});
  }
  function lotContext(s,level){
    const lot=lotOf(s);if(!lot)return null;
    const body=bodyPolys(s,level);
    const annexes=(State.structures||[]).filter(o=>o.type==='civicAnnex'&&o.parentId===s.id)
      .map(o=>{try{return civicAnnexFootprint(o)}catch{return[]}}).filter(p=>p.length>2);
    let roads=[];try{roads=roadList().filter(r=>r.a&&r.b)}catch{}
    const door=typeof civicEntranceInfo==='function'?civicEntranceInfo(s):null;
    // Keep a walkway from the door to the nearest street.
    let path=null;
    if(door){let best=Infinity;for(const rd of roads){const dx=rd.b.x-rd.a.x,dy=rd.b.y-rd.a.y,L=dx*dx+dy*dy||1,
      t=Math.max(0,Math.min(1,((door.outside.x-rd.a.x)*dx+(door.outside.y-rd.a.y)*dy)/L)),q={x:rd.a.x+dx*t,y:rd.a.y+dy*t},
      d=Math.hypot(q.x-door.outside.x,q.y-door.outside.y);if(d<best){best=d;path={a:door.outside,b:q}}}}
    return{lot,body,annexes,roads,door,path};
  }
  function free(ctx,p,r,placed){
    if(!inPoly(p,ctx.lot)||edgeDist(p,ctx.lot)<r+.15)return false;
    for(const b of ctx.body)if(clearance(p,b)<r+.22)return false;
    for(const b of ctx.annexes)if(clearance(p,b)<r+.15)return false;
    for(const rd of ctx.roads)if(segDist(p,rd.a,rd.b)<(Number(rd.width)||.5)*.36+r+.2)return false;
    if(ctx.door&&Math.hypot(p.x-ctx.door.outside.x,p.y-ctx.door.outside.y)<1.6+r)return false;
    if(ctx.path&&segDist(p,ctx.path.a,ctx.path.b)<.55+r)return false;
    for(const q of placed)if(Math.hypot(q.x-p.x,q.y-p.y)<q.r+r+.04)return false;
    return true;
  }
  function samples(lot,rnd,n){
    const xs=lot.map(p=>p.x),ys=lot.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),out=[];
    for(let k=0;k<n*4&&out.length<n;k++){const p={x:x0+rnd()*(x1-x0),y:y0+rnd()*(y1-y0)};if(inPoly(p,lot))out.push(p)}
    return out;
  }
  const put=(placed,asset,p,heading)=>placed.push(asset.startsWith('sc:')
    ?{asset,x:p.x,y:p.y,heading,r:scR(asset.slice(3)),s:1.3}:{asset,x:p.x,y:p.y,heading,r:PROP_R[asset],s:PROP_SCALE[asset]});
  // A few shade trees inside the lot, clear of the building.
  function plantTrees(s,ctx,rnd,placed,n){
    const near=p=>Math.min(...ctx.body.map(b=>clearance(p,b)));
    let k=0;
    for(const p of samples(ctx.lot,rnd,80).filter(p=>near(p)>1.1).sort(()=>rnd()-.5)){
      if(k>=n)break;const asset=rnd()<.55?'treeOak':'treeLinden';
      if(placed.some(q=>q.asset.startsWith('tree')&&Math.hypot(q.x-p.x,q.y-p.y)<2.6))continue;
      if(free(ctx,p,PROP_R[asset],placed)){put(placed,asset,p,rnd()*6.28);k++}
    }
  }
  function churchyard(s,level,ctx,rnd,placed){
    const a=s.angle||0,ex={x:Math.cos(a),y:Math.sin(a)},ey={x:-Math.sin(a),y:Math.cos(a)};
    plantTrees(s,ctx,rnd,placed,level>=3?3:2);
    // Cypresses along the lot edge, then a churchyard cross behind the church (L2+).
    const edge=samples(ctx.lot,rnd,90).filter(p=>edgeDist(p,ctx.lot)<1.3).sort(()=>rnd()-.5);
    let trees=0;
    for(const p of edge){if(trees>=2+level)break;if(!free(ctx,p,.3,placed)||placed.some(q=>q.asset.startsWith('cypress')&&Math.hypot(q.x-p.x,q.y-p.y)<2))continue;
      put(placed,rnd()<.6?'cypress':'cypressSmall',p,rnd()*6.28);trees++}
    if(level>=2){
      const back=samples(ctx.lot,rnd,60).map(p=>({...p,k:(p.x-s.x)*ey.x+(p.y-s.y)*ey.y})).sort((p,q)=>q.k-p.k);
      for(const p of back)if(free(ctx,p,PROP_R.cemeteryCross,placed)){put(placed,'cemeteryCross',p,a);break}
    }
    // Wavy rows aligned with the church; value noise opens family plots and paths.
    const xs=ctx.lot.map(p=>(p.x-s.x)*ex.x+(p.y-s.y)*ex.y),ys=ctx.lot.map(p=>(p.x-s.x)*ey.x+(p.y-s.y)*ey.y);
    const phase=rnd()*6.28,cells=new Map();
    const cell=(i,j)=>{const k=i+','+j;if(!cells.has(k))cells.set(k,rng(s.id+':plot:'+k)());return cells.get(k)};
    const noise=(u,v)=>{const i=Math.floor(u/1.6),j=Math.floor(v/1.6),fu=u/1.6-i,fv=v/1.6-j;
      return cell(i,j)*(1-fu)*(1-fv)+cell(i+1,j)*fu*(1-fv)+cell(i,j+1)*(1-fu)*fv+cell(i+1,j+1)*fu*fv};
    const cands=[];
    for(let v=Math.min(...ys);v<=Math.max(...ys);v+=.78)for(let u=Math.min(...xs);u<=Math.max(...xs);u+=.56){
      if(noise(u,v)<.32||rnd()<.1)continue;
      const wave=Math.sin(u*.8+phase)*.14,uu=u+(rnd()-.5)*.12,vv=v+wave+(rnd()-.5)*.1;
      cands.push({x:s.x+ex.x*uu+ey.x*vv,y:s.y+ex.y*uu+ey.y*vv,h:a+Math.atan(Math.cos(u*.8+phase)*.11)+(rnd()-.5)*.3,k:Math.hypot(uu,vv*.8)});
    }
    cands.sort((p,q)=>p.k-q.k);
    let n=0;
    for(const c of cands){if(n>=GRAVE_COUNT[level])break;const asset=pick(rnd,GRAVES[level]);
      if(!free(ctx,c,PROP_R[asset],placed))continue;put(placed,asset,c,c.h);n++}
  }
  function innGarden(s,level,ctx,rnd,placed){
    const near=p=>Math.min(...ctx.body.map(b=>clearance(p,b)));
    plantTrees(s,ctx,rnd,placed,2);
    const cands=samples(ctx.lot,rnd,160).map(p=>({...p,d:near(p)})).filter(p=>p.d>.3&&p.d<3.4)
      .sort((p,q)=>p.d+rnd()*1.4-(q.d+rnd()*1.4));
    const want=[];for(let i=0;i<TABLE_COUNT[level];i++)want.push(pick(rnd,TABLES[level]));
    if(level===2)want.unshift('tablePergola');
    for(const asset of want){
      for(const c of cands){if(!free(ctx,c,PROP_R[asset],placed))continue;
        put(placed,asset,c,(s.angle||0)+(rnd()<.5?0:Math.PI/2)+(rnd()-.5)*.7);break}
    }
    let bushes=0;
    for(const c of cands){if(bushes>=1+level)break;if(c.d<1.2&&free(ctx,c,PROP_R.flowerBush,placed)){put(placed,'flowerBush',c,rnd()*6.28);bushes++}}
    // Service yard: goods stacked against the back and side walls.
    if(SC()?.assets){
      const yard=samples(ctx.lot,rnd,120).map(p=>({...p,d:near(p)})).filter(p=>p.d>.2&&p.d<1.6).sort(()=>rnd()-.5);
      for(let i=0;i<YARD_COUNT[level];i++){
        const a=pick(rnd,YARD[level].filter(([k])=>SC().assets[k]));if(!a)continue;
        for(const c of yard)if(free(ctx,c,scR(a),placed)){put(placed,'sc:'+a,c,(s.angle||0)+Math.floor(rnd()*4)*Math.PI/2+(rnd()-.5)*.3);break}
      }
    }
  }
  const propCache=new Map();
  function propKey(s,ctx,level){
    let h=0;const add=v=>{h=(Math.imul(h,31)+hash(String(v)))|0};
    for(const p of ctx.lot)add(p.x.toFixed(2)+','+p.y.toFixed(2));
    for(const b of ctx.annexes)add(b[0].x.toFixed(2)+','+b[0].y.toFixed(2));
    return[s.x,s.y,s.angle||0,level,ctx.roads.length,h,State.seed].join('|');
  }
  // Props of one civic structure: [{asset,x,y,heading,r,s}] in world U.
  function lotProps(s){
    if(!s||(s.type!=='church'&&s.type!=='tavern')||!DATA()?.models?.prop_graveStone)return[];
    const level=typeof civicLevel==='function'?civicLevel(s):1,ctx=lotContext(s,level);
    if(!ctx)return[];
    const key=propKey(s,ctx,level),hit=propCache.get(s.id);
    if(hit&&hit.key===key)return hit.props;
    const rnd=rng(s.type+':'+s.id),placed=[];
    if(s.type==='church')churchyard(s,level,ctx,rnd,placed);else innGarden(s,level,ctx,rnd,placed);
    propCache.set(s.id,{key,props:placed,meshes:null});
    return placed;
  }
  // Every civic lot prop, for the environmental scatter to keep clear of.
  function allLotProps(){
    const out=[];
    for(const s of State.structures||[])if((s.type==='church'||s.type==='tavern')&&!(typeof underConstruction==='function'&&underConstruction(s)))
      for(const p of lotProps(s))out.push(p);
    return out;
  }
  function propMeshes(s){
    const props=lotProps(s);if(!props.length)return[];
    const hit=propCache.get(s.id),season=State.season;
    if(hit.meshes&&hit.season===season)return hit.meshes;
    hit.season=season;
    hit.meshes=props.map(p=>p.asset.startsWith('sc:')?scatterTriangles(p.asset.slice(3),p)
      :triangles('prop_'+p.asset,{x:p.x,y:p.y,angle:p.heading,scale:p.s},terrainElevation(p))).filter(Boolean);
    return hit.meshes;
  }
  // A scatter asset ({v,i,c} indexed, U) as painter / builder triangles.
  function scatterTriangles(name,p){
    const m=SC(),a=m?.assets?.[name];if(!a)return null;
    const c=Math.cos(p.heading||0)*p.s,sn=Math.sin(p.heading||0)*p.s,z0=terrainElevation(p),pos=[],col=[];
    for(let t=0;t<a.c.length;t++){
      for(let k=0;k<3;k++){const j=a.i[t*3+k]*3,x=a.v[j],y=a.v[j+1];pos.push(p.x+x*c-y*sn,p.y+x*sn+y*c,z0+a.v[j+2]*p.s)}
      col.push(m.palette[a.c[t]]);
    }
    return{pos,col};
  }
  // ---------- cutaway: a selected church, inn, town hall or guild hall opens up to show its interior
  // The Blender shells have no inner faces and neither renderer culls back faces, so a
  // vertical section plane across the model's centre, facing the camera, is enough:
  // everything in front of it is cut down to a low sill, roofs and the eaves caps go,
  // and the far walls are seen from inside. Floors and furnishings are built here in
  // the model's local axes (front at -y, the altar / hearths away from the door).
  const CUTAWAY_SILL=.14,FLOOR_Z=.03;
  const TOWER_PARTS=new Set(['tower','belfry','towerL','towerR']);
  const INTERIOR={
    church1:{floors:[[-.92,-2.09,.92,1.98],[-.52,-3.04,.52,-2.11]],nave:[.92,-1.6,.95],chancel:[-.92,1.25,.92,1.98],altar:1.62,side:[]},
    church2:{floors:[[-1.22,-2.72,1.22,3.28],[-2.45,-.37,-1.22,1.07],[1.22,-.37,2.45,1.07],[-.84,-3.49,.84,-2.74]],nave:[1.22,-2.25,1.6],chancel:[-1.22,2.1,1.22,3.28],altar:2.7,side:[[-2.15,.35],[2.15,.35]],font:[-.85,-2.45]},
    church3:{floors:[[-1.22,-2.72,1.22,3.28],[-2.45,-.37,-1.22,1.07],[1.22,-.37,2.45,1.07],[-.45,-3.47,.45,-2.74]],nave:[1.22,-2.25,1.6],chancel:[-1.22,2.1,1.22,3.28],altar:2.7,side:[[-2.15,.35],[2.15,.35]],font:[-.85,-2.45],pulpit:[.95,1.75]},
    tavern1:{floors:[[-1.08,-2.48,2.28,-.94],[-1.08,-.94,1.08,2.48]],tables:[[-.55,-1.72],[.5,-1.72],[1.6,-1.72],[-.5,1.75]],counter:[-.9,.25,.3,.47],barrels:[[-.85,.75],[-.5,.75]],hearths:[[.51,1.14]]},
    tavern2:{floors:[[-2.28,-2.48,2.28,-.94],[-1.08,-.94,1.08,2.48]],tables:[[-.7,-1.72],[.35,-1.72],[1.45,-1.72],[-.45,1.95]],counter:[-.9,.2,.3,.42],barrels:[[-.85,.7],[-.5,.7],[.75,-.55]],hearths:[[-1.57,-1.72],[.46,1.43]]},
    tavern3:{floors:[[-2.28,-2.48,2.28,-.94],[-1.08,-.94,1.08,.94],[-2.28,.94,2.28,2.48]],tables:[[-.7,-1.72],[.35,-1.72],[1.45,-1.72],[-1.45,1.72],[-.35,1.72],[.6,1.72]],counter:[.62,-.6,.84,.6],barrels:[[-2.02,2.2],[-2.02,1.85],[-1.7,2.2]],hearths:[[-1.57,-1.72],[1.57,1.72],[0,0]]},
    // Town hall: council table under the podesta's dais; the L2/L3 room sits behind the arcade.
    // upper: the storeys above (build_civic.py townhall: floor at gf, L3 a second one half way
    // to the eaves), each {z: floor level in U, rect: room over the whole depth}.
    townhall1:{floors:[[-1.95,-.85,1.95,1.55]],council:[-.85,.3,.85,.62],dais:[-.7,1.15,.7,1.5],chests:[[-1.7,1.3],[1.7,1.3]],hearths:[[-1.62,-.45]],banners:[[-1.2,1.55],[1.2,1.55]],
      upper:[{z:.914,rect:[-1.95,-.85,1.95,1.55]}]},
    townhall2:{floors:[[-1.95,-.2,1.95,1.55]],council:[-.85,.35,.85,.65],dais:[-.7,1.15,.7,1.5],chests:[[-1.7,1.3],[1.7,1.3]],hearths:[[-1.62,.2]],banners:[[-1.2,1.55],[1.2,1.55]],
      upper:[{z:1.057,rect:[-1.9,-.82,1.9,1.52]}]},
    townhall3:{floors:[[-1.95,-.2,1.95,1.55]],council:[-1.05,.3,1.05,.66],dais:[-.8,1.12,.8,1.5],chests:[[-1.7,1.3],[1.7,1.3],[1.7,.9]],hearths:[[-1.62,.2],[1.62,.2]],banners:[[-1.3,1.55],[0,1.55],[1.3,1.55]],
      upper:[{z:1.171,rect:[-1.9,-.82,1.9,1.52]},{z:2.129,rect:[-1.9,-.82,1.9,1.52]}]},
    // Guild hall: counting desks with ledgers and scales, the strongbox, bolts of cloth.
    guild1:{floors:[[-1.42,-1.17,.46,1.17]],desks:[[-.95,-.45],[-.2,-.45]],counter:[-1.3,.62,-.25,.82],chests:[[.25,.9]],barrels:[[.28,-.85]],bolts:[[-1.35,-.95,-.4]],hearths:[]},
    guild2:{floors:[[-1.42,-1.17,1.42,1.17]],desks:[[-.75,-.35],[.75,-.35]],counter:[-.6,.7,.6,.9],chests:[[-1.2,.95],[1.2,.95]],bolts:[[-1.35,-.95,-.1]],hearths:[[1.1,.62]]},
    guild3:{floors:[[-1.42,-1.17,1.42,1.17]],desks:[[-.75,-.3],[0,-.3],[.75,-.3]],counter:[-.7,.72,.7,.92],chests:[[-1.2,.95],[1.2,.95],[1.2,.55]],bolts:[[-1.35,-.95,.2],[1.35,-.95,.2]],hearths:[[-1.1,.8]]}
  };
  const selectedOf=()=>typeof State!=='undefined'&&State.selectedId?(State.structures||[]).find(s=>s.id===State.selectedId):null;
  function cutawayActive(s){
    return !!s&&['church','tavern','townhall','guild'].includes(s.type)&&s.id===State.selectedId&&!!INTERIOR[modelKey(s)]&&has(s)
      &&!(typeof underConstruction==='function'&&underConstruction(s));
  }
  function cutawayId(){const s=selectedOf();return cutawayActive(s)?s.id:null}
  // Floor-by-floor cutaway: s.cutawayFloor is the storey in view (0 = ground, the default);
  // the storeys above it are taken off. Storeys without an interior list are not offered.
  function floorCount(s){return 1+(INTERIOR[modelKey(s)]?.upper?.length||0)}
  function visibleFloor(s){
    const n=floorCount(s),f=Number.isInteger(s?.cutawayFloor)?s.cutawayFloor:0;
    return Math.max(0,Math.min(n-1,f));
  }
  // Floor level (U above the ground) and ceiling of the storey in view (Infinity on the top one).
  function floorSpan(s,key=modelKey(s)){
    const up=INTERIOR[key]?.upper||[],f=visibleFloor(s);
    return{floor:f,z:f?up[f-1].z:0,ceiling:f<up.length?up[f].z:Infinity};
  }
  // Signature of what the cutaway shows: the selected building and its storey in view.
  function cutawaySig(){const s=selectedOf();return cutawayActive(s)?s.id+'@'+visibleFloor(s):null}
  // Camera direction (towards the viewer) in the model's local axes; null in plan view.
  function cameraLocal(s){
    if(typeof isPlanView==='function'&&isPlanView())return null;
    const d=p=>{const q=rotateViewPoint(p);return q.x+q.y},o=d({x:0,y:0});
    let ux=d({x:1,y:0})-o,uy=d({x:0,y:1})-o;const L=Math.hypot(ux,uy)||1;ux/=L;uy/=L;
    const a=s.angle||0,c=Math.cos(a),sn=Math.sin(a);
    return{x:ux*c+uy*sn,y:-ux*sn+uy*c};
  }
  // Keeps the part of convex polygon `poly` ([x,y,z] vertices) where f(v)<=0.
  function clip(poly,f){
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],fa=f(a),fb=f(b);
      if(fa<=0)out.push(a);
      if((fa<0&&fb>0)||(fa>0&&fb<0)){const t=fa/(fa-fb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t])}
    }
    return out;
  }
  // Local parts {name,v:[x,y,z...],cols:[hex],bias} with one colour per triangle.
  function localPart(name,bias=0){return{name,v:[],cols:[],bias}}
  function pushPoly(part,poly,hex){
    for(let i=1;i<poly.length-1;i++){part.v.push(...poly[0],...poly[i],...poly[i+1]);part.cols.push(hex)}
  }
  function box(part,x0,y0,x1,y1,z0,z1,hex,side=hex){
    pushPoly(part,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],hex);
    const c=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
    for(let i=0;i<4;i++){const a=c[i],b=c[(i+1)%4];pushPoly(part,[[a[0],a[1],z0],[b[0],b[1],z0],[b[0],b[1],z1],[a[0],a[1],z1]],side)}
  }
  // The model sectioned against the camera: back pieces whole, front pieces only below the sill.
  // An upper storey in view (span.z > 0): the sill rises to its floor, everything above its
  // ceiling goes, and the far walls start at its floor (the storeys below stay closed).
  function sectionParts(key,cam,span={z:0,ceiling:Infinity}){
    const pal=palette(),keys=DATA().paletteKeys,out=[];
    const zs=span.z+CUTAWAY_SILL,zc=span.ceiling,upper=span.z>0;
    const cap=poly=>Number.isFinite(zc)?clip(poly,p=>p[2]-zc):poly;
    for(const part of parts(key)){
      if(part.name==='naveRoof'||part.name==='chimneys')continue;
      // The town hall's tower stands in front of the council room: it goes down to a stump,
      // or the section plane would leave a sliver of it standing to full height.
      const stump=key.startsWith('townhall')&&TOWER_PARTS.has(part.name)&&!!cam,tower=TOWER_PARTS.has(part.name)&&!stump;
      const back=localPart(part.name),front=localPart(part.name+':front'),sill=localPart(part.name+':sill',1e5);
      const v=part.v;
      for(let t=0;t<part.c.length;t++){
        const ck=keys[part.c[t]];
        if(!tower&&ck.startsWith('roof'))continue;
        const o=t*9,tri=[[v[o],v[o+1],v[o+2]],[v[o+3],v[o+4],v[o+5]],[v[o+6],v[o+7],v[o+8]]];
        const ux=tri[1][0]-tri[0][0],uy=tri[1][1]-tri[0][1],uz=tri[1][2]-tri[0][2],wx=tri[2][0]-tri[0][0],wy=tri[2][1]-tri[0][1],wz=tri[2][2]-tri[0][2];
        const nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx,nl=Math.hypot(nx,ny,nz)||1;
        // Eaves caps, upper-floor slabs and jetty soffits would close the room from above
        // (no face culling: a soffit seen from above still paints).
        // On an upper storey the string course and the storey's own bottom sit at its floor level:
        // they go too, or they would lie over the floor.
        if(!tower&&Math.abs(nz/nl)>.5&&Math.min(tri[0][2],tri[1][2],tri[2][2])>(upper?span.z-.05:zs))continue;
        const hex=pal[part.c[t]];
        if(!cam){pushPoly(back,tri,hex);continue}
        if(stump){const low=clip(tri,p=>p[2]-zs);if(low.length>2)pushPoly(sill,low,hex);continue}
        const f=p=>p[0]*cam.x+p[1]*cam.y;
        // Far side: from the floor in view to its ceiling (the closed storeys below would
        // otherwise paint over the floor).
        let kept=cap(clip(tri,f));
        if(upper&&kept.length>2)kept=clip(kept,p=>span.z-.01-p[2]);
        if(kept.length>2)pushPoly((nx*cam.x+ny*cam.y)/nl>.05?front:back,kept,hex);
        const low=clip(clip(tri,p=>-f(p)),p=>p[2]-zs);
        if(low.length>2)pushPoly(sill,low,hex);
      }
      // Far walls before the furnishings; camera-facing section stubs sort by their own centre.
      back.bias=tower?0:-5e4;
      for(const p of [back,front,sill])if(p.cols.length)out.push(p);
    }
    return out;
  }
  // Town hall: one room per floor (s.functions[i] is floor i, from TOWNHALL_FUNCTION_CATALOG in
  // settlement-core.js). The council keeps the classic ground-floor hall; any other room is laid
  // out over the whole floor in view (floor-by-floor cutaway). A floor without a room stays bare.
  function townhallRole(s,floor){
    if(!Array.isArray(s?.functions)||!s.townhallRooms)return floor===0?'council':null;
    return s.functions[floor]||null;
  }
  // Tribunal layout in the room's local axes, shared by its furniture (furnishTownhallRoom) and
  // its people (roomSlots), so the two never drift apart: the judges' bench by the back wall, the
  // bar across the room, the clerk's desk on one side, rows of benches for the public.
  function tribunalLayout(rect,hearths=[]){
    const [fx0,fy0,fx1,fy1]=rect,back=fy1,front=fy0;
    const pad=x=>hearths.some(([hx])=>Math.abs(hx-x)<.6)?.62:.18;
    const ix0=fx0+pad(fx0+.3),ix1=fx1-pad(fx1-.3),icx=(ix0+ix1)/2,iw=ix1-ix0;
    const hw=Math.min(.9,iw/2-.35),jy=back-.3,ry=jy-.62,pews=[];
    for(let y=ry-.32;y>front+.12;y-=.3)pews.push(y);
    return{ix0,ix1,icx,iw,hw,jy,ry,front,back,pews,judges:[icx-hw*.62,icx,icx+hw*.62],clerk:{x:ix0+.32,y:ry+.3}};
  }
  const PRISON_CELL_MAX=5;   // prisoners per cell (settlement-siege.js CAPACITY.prison)
  // Prison layout, shared the same way: cells along the back wall behind one row of bars at cy,
  // n cells of width cw from ix0, the jailer's table by the door.
  function prisonLayout(rect,hearths=[]){
    const [fx0,fy0,fx1,fy1]=rect,back=fy1,front=fy0;
    const pad=x=>hearths.some(([hx])=>Math.abs(hx-x)<.6)?.62:.18;
    const ix0=fx0+pad(fx0+.3),ix1=fx1-pad(fx1-.3),iw=ix1-ix0,n=Math.max(2,Math.round(iw/1.1));
    return{ix0,ix1,iw,back,front,cy:back-.62,n,cw:iw/n,jailer:{x:ix1-.4,y:front+.45}};
  }
  // Cells of the town hall's prison (ground floor only): five prisoners each (settlement-siege.js).
  function prisonCellCount(s){const spec=INTERIOR[modelKey(s)];return spec?prisonLayout(spec.floors[0],spec.hearths||[]).n:0}
  function furnishTownhallRoom(role,rect,z,piece,P,hearths=[]){
    const [fx0,fy0,fx1,fy1]=rect,back=fy1,front=fy0,cx=(fx0+fx1)/2;
    // Clear of the hearths standing by the end walls.
    const pad=x=>hearths.some(([hx])=>Math.abs(hx-x)<.6)?.62:.18;
    const ix0=fx0+pad(fx0+.3),ix1=fx1-pad(fx1-.3),icx=(ix0+ix1)/2,iw=ix1-ix0;
    const stool=(x,y)=>piece('stool',p=>box(p,x-.07,y-.07,x+.07,y+.07,z,z+.13,P('wood'),P('woodDark')));
    const chest=(x,y)=>piece('chest',p=>{box(p,x-.13,y-.08,x+.13,y+.08,z,z+.15,P('woodDark'),P('wood'));box(p,x-.135,y-.085,x+.135,y+.085,z+.15,z+.17,P('iron'));box(p,x-.02,y-.09,x+.02,y-.08,z+.08,z+.13,P('gold'))});
    const banner=(x,hex,z0=.25,z1=.62)=>piece('banner',p=>box(p,x-.1,back-.02,x+.1,back,z+z0,z+z1,hex));
    if(role==='council'){
      // Long table under a red cloth with stools both sides, the podesta on his dais, the archive chests.
      const hw=Math.min(1.05,iw/2-.15),y0=(front+back)/2-.05,y1=y0+.32,ym=(y0+y1)/2;
      piece('council',p=>{box(p,icx-hw+.08,ym-.06,icx+hw-.08,ym+.06,z,z+.2,P('woodDark'));box(p,icx-hw,y0,icx+hw,y1,z+.2,z+.235,P('canvasRed'),P('wood'))});
      for(let x=icx-hw+.18;x<=icx+hw-.17;x+=.34)for(const y of [y0-.13,y1+.13])stool(x,y);
      for(let x=icx-hw+.25;x<icx+hw-.2;x+=.55)piece('scroll',p=>box(p,x-.06,ym-.03,x+.06,ym+.03,z+.235,z+.255,P('canvasWhite')));
      const dy=back-.2;
      piece('dais',p=>{box(p,icx-.7,dy-.17,icx+.7,dy+.17,z,z+.06,P('stoneTrim'),P('stone'));box(p,icx-.12,dy-.08,icx+.12,dy+.1,z+.06,z+.2,P('woodDark'));box(p,icx-.12,dy+.06,icx+.12,dy+.1,z+.2,z+.42,P('woodDark'));box(p,icx-.05,dy+.08,icx+.05,dy+.11,z+.3,z+.4,P('gold'))});
      for(const x of [ix0+.2,ix1-.2])chest(x,back-.25);
      for(const x of [icx-1.2,icx+1.2])if(x>ix0&&x<ix1)banner(x,P(x<icx?'canvasRed':'canvasBlue'));
    }else if(role==='tribunal'){
      // The judges' bench on a raised step, the clerk's desk, the bar, the benches for the public.
      const L=tribunalLayout(rect,hearths),{hw,jy,ry}=L;
      piece('bench',p=>{box(p,icx-hw-.08,jy-.24,icx+hw+.08,back-.02,z,z+.1,P('stoneTrim'),P('stone'));box(p,icx-hw,jy-.24,icx+hw,jy-.13,z+.1,z+.38,P('woodDark'),P('wood'));box(p,icx-hw-.02,jy-.26,icx+hw+.02,jy-.11,z+.38,z+.405,P('canvasBlue'))});
      for(const x of L.judges)piece('judgeChair',p=>{box(p,x-.09,jy-.02,x+.09,jy+.13,z+.1,z+.23,P('woodDark'));box(p,x-.09,jy+.1,x+.09,jy+.14,z+.23,z+(x===icx?.58:.5),P('woodDark'))});
      piece('scroll',p=>{box(p,icx-.08,jy-.22,icx+.08,jy-.16,z+.405,z+.42,P('canvasWhite'));box(p,icx+.3,jy-.21,icx+.36,jy-.17,z+.405,z+.47,P('iron'))});
      piece('clerkDesk',p=>{const {x,y}=L.clerk;box(p,x-.05,y-.05,x+.05,y+.05,z,z+.2,P('woodDark'));box(p,x-.22,y-.15,x+.22,y+.15,z+.2,z+.23,P('woodLight'),P('wood'));box(p,x-.12,y-.05,x+.02,y+.06,z+.23,z+.245,P('canvasWhite'))});
      stool(L.clerk.x,L.clerk.y+.28);
      piece('bar',p=>{const a=icx-hw-.25,b=icx+hw+.25;box(p,a,ry-.02,b,ry+.02,z+.2,z+.24,P('wood'));for(let x=a;x<=b+1e-6;x+=(b-a)/8)box(p,x-.015,ry-.015,x+.015,ry+.015,z,z+.2,P('woodDark'))});
      for(const y of L.pews)for(const [a,b] of [[ix0+.1,icx-.15],[icx+.15,ix1-.1]])piece('pewBench',p=>box(p,a,y-.06,b,y+.06,z,z+.11,P('wood'),P('woodDark')));
      for(const x of [icx-hw-.35,icx+hw+.35])banner(x,P('canvasBlue'),.4,.75);
    }else if(role==='guard'){
      // Guard room: two tables with stools, the weapon rack and the shield rack, the cots, the chest.
      const ty=(front+back)/2;
      for(const x of [icx-.55,icx+.4]){
        piece('table',p=>{box(p,x-.05,ty-.05,x+.05,ty+.05,z,z+.19,P('woodDark'));box(p,x-.25,ty-.18,x+.25,ty+.18,z+.19,z+.225,P('woodLight'),P('wood'));box(p,x-.04,ty-.04,x+.02,ty+.02,z+.225,z+.27,P('iron'))});
        for(const y of [ty-.3,ty+.3])stool(x,y);
      }
      const r0=ix0+.05,r1=Math.min(ix1-.9,ix0+1.5);
      piece('weaponRack',p=>{box(p,r0,back-.12,r1,back-.06,z+.08,z+.12,P('woodDark'));box(p,r0,back-.12,r1,back-.06,z+.4,z+.44,P('woodDark'));
        for(let x=r0+.1;x<r1-.05;x+=.16)box(p,x-.012,back-.1,x+.012,back-.08,z,z+.62,P('iron'))});
      piece('shieldRack',p=>{for(let x=r1+.25;x<ix1-.6;x+=.3)box(p,x-.11,back-.05,x+.11,back-.02,z+.22,z+.5,P(x%0.6<.3?'canvasRed':'canvasBlue'))});
      for(const y of [front+.35,front+.85])piece('cot',p=>{box(p,ix1-.26,y-.22,ix1-.02,y+.22,z,z+.1,P('woodDark'));box(p,ix1-.24,y-.2,ix1-.04,y+.2,z+.1,z+.13,P('cloth'))});
      chest(ix1-.2,back-.2);
    }else if(role==='prison'){
      // Cells along the back wall behind one row of bars, each with straw, a bucket and wall
      // chains; the jailer's table by the door.
      const {cy,n,cw}=prisonLayout(rect,hearths);
      piece('cellBars',p=>{box(p,ix0,cy-.02,ix1,cy+.02,z+.55,z+.59,P('iron'));for(let x=ix0;x<=ix1+1e-6;x+=.09)box(p,x-.01,cy-.01,x+.01,cy+.01,z,z+.59,P('iron'))});
      for(let k=1;k<n;k++){const x=ix0+cw*k;piece('cellWall',p=>box(p,x-.03,cy,x+.03,back,z,z+.55,P('stoneLight'),P('stone')))}
      for(let k=0;k<n;k++){
        const a=ix0+cw*k,b=a+cw,m=(a+b)/2;
        piece('straw',p=>pushPoly(p,[[a+.08,back-.45,z+.006],[m+.05,back-.45,z+.006],[m+.05,back-.08,z+.006],[a+.08,back-.08,z+.006]],P('canvasYellow')));
        piece('bucket',p=>box(p,b-.2,back-.2,b-.08,back-.08,z,z+.1,P('barrel'),P('woodDark')));
        for(const x of [m-.12,m+.12])piece('wallChains',p=>box(p,x-.01,back-.02,x+.01,back,z+.22,z+.5,P('iron')));
      }
      const {x:tx,y:ty}=prisonLayout(rect,hearths).jailer;
      piece('jailerTable',p=>{box(p,tx-.05,ty-.05,tx+.05,ty+.05,z,z+.19,P('woodDark'));box(p,tx-.22,ty-.16,tx+.22,ty+.16,z+.19,z+.225,P('woodLight'),P('wood'));box(p,tx+.06,ty-.03,tx+.12,ty+.03,z+.225,z+.3,P('lamp'))});
      stool(tx-.35,ty);
    }
  }
  // Furnishings of an upper storey, by building and storey: (key, storey, piece, P, rect, z) -> void.
  // Empty by default: the storey shows its plank floor.
  // People of the room in view of a selected town hall, in its local axes (x, y as the model,
  // z = feet above the building's ground): the tribunal in session. Seated figures sit .12 low
  // (the event figures' convention). Public seats are a fixed draw per building.
  function roomSlots(s){
    if(s?.type!=='townhall')return[];
    const key=modelKey(s),spec=INTERIOR[key];if(!spec)return[];
    const span=floorSpan(s,key),role=townhallRole(s,span.floor);
    if(role!=='tribunal'&&role!=='prison')return[];
    const rect=span.floor?spec.upper[span.floor-1].rect:spec.floors[0],z=span.z+FLOOR_Z,hearths=span.floor?[]:spec.hearths||[],out=[];
    const add=(id,role,action,x,y,dz)=>out.push({id,role,action,x,y,z:z+dz});
    let h=2166136261;for(const c of String(s.id)+':'+role)h=Math.imul(h^c.charCodeAt(0),16777619);
    const rnd=()=>((h=Math.imul(h^(h>>>13),1597334677)>>>0)%1000)/1000;
    if(role==='prison'){
      // Prisoners in the cells, one to five each (PRISON_CELL_MAX, the capacity in settlement-siege.js):
      // the first one of the first cell at the bars, the others sitting on the straw; the jailer at his table.
      const P=prisonLayout(rect,hearths);
      const seats=[[.22,.27],[.5,.22],[.78,.27],[.34,.47],[.66,.47]];   // (across the cell, from the back wall)
      for(let k=0;k<P.n;k++){
        const a=P.ix0+P.cw*k,count=1+Math.floor(rnd()*PRISON_CELL_MAX);
        for(let i=0;i<count;i++){
          if(k===0&&i===0){add('cell0-0','prisoner','bars',a+P.cw/2,P.cy+.12,0);continue}
          const [u,v]=seats[i];add('cell'+k+'-'+i,'prisoner','sit',a+P.cw*u,P.back-v,-.12);
        }
      }
      add('jailer','jailer','doze',P.jailer.x-.35,P.jailer.y,.13-.12);
      return out;
    }
    const L=tribunalLayout(rect,hearths);
    L.judges.forEach((x,i)=>add('judge'+i,'judge',i===1?'preside':'sit',x,L.jy+.05,.1+.23-.12));
    add('clerk','clerk','write',L.clerk.x,L.clerk.y+.28,.13-.12);
    add('prisoner','prisoner','bound',L.icx,L.ry+.17,0);
    add('guard0','guard','stand',L.icx-.32,L.ry+.19,0);
    add('guard1','guard','stand',L.icx+.32,L.ry+.19,0);
    L.pews.forEach((y,r)=>{for(const [a,b] of [[L.ix0+.1,L.icx-.15],[L.icx+.15,L.ix1-.1]])
      for(let x=a+.2,k=0;x<b-.1;x+=.42,k++)if(rnd()<.45)add('public'+r+'-'+Math.round(x*10)+'-'+k,'public','sit',x,y,.11-.12)});
    return out;
  }
  // The cell bars of the prison floor in view (local x0..x1 along y, from z up to z+h, a bar every
  // step): the people drawn over the scene redraw them over the prisoners behind.
  function prisonBars(s){
    if(s?.type!=='townhall')return null;
    const key=modelKey(s),spec=INTERIOR[key];if(!spec)return null;
    const span=floorSpan(s,key);if(townhallRole(s,span.floor)!=='prison')return null;
    const rect=span.floor?spec.upper[span.floor-1].rect:spec.floors[0],P=prisonLayout(rect,span.floor?[]:spec.hearths||[]);
    return{x0:P.ix0,x1:P.ix1,y:P.cy,z:span.z+FLOOR_Z,h:.59,step:.09,back:P.back};
  }
  const UPPER_ROOMS={townhall:({storey,s,rect,z,piece,P})=>furnishTownhallRoom(townhallRole(s,storey),rect,z,piece,P)};
  function interiorParts(key,span={floor:0,z:0},s=null){
    let spec=INTERIOR[key];const pal=palette(),keys=DATA().paletteKeys,P=k=>pal[keys.indexOf(k)],out=[];
    if(span.floor>0){
      const {rect}=spec.upper[span.floor-1],[x0,y0,x1,y1]=rect,z=span.z+FLOOR_Z,floor=localPart('floor',-1e5);
      pushPoly(floor,[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],P('woodLight'));
      // Plank joints across the room.
      for(let x=x0+.32;x<x1-.05;x+=.32)pushPoly(floor,[[x-.008,y0,z+.002],[x+.008,y0,z+.002],[x+.008,y1,z+.002],[x-.008,y1,z+.002]],P('wood'));
      out.push(floor);
      const room=UPPER_ROOMS[key.replace(/\d+$/,'')];
      if(room)room({key,storey:span.floor,s,rect,z,P,piece:(name,fn)=>{const p=localPart(name);fn(p);out.push(p)},box,pushPoly});
      return out;
    }
    const church=key.startsWith('church'),floor=localPart('floor',-1e5);
    for(const [x0,y0,x1,y1] of spec.floors)pushPoly(floor,[[x0,y0,FLOOR_Z],[x1,y0,FLOOR_Z],[x1,y1,FLOOR_Z],[x0,y1,FLOOR_Z]],church?P('paving'):P('woodLight'));
    out.push(floor);
    const piece=(name,fn)=>{const p=localPart(name);fn(p);out.push(p)};
    if(church){
      const [hw,y0,y1]=spec.nave,[cx0,cy0,cx1,cy1]=spec.chancel,top=FLOOR_Z+.06,z=FLOOR_Z;
      piece('runner',p=>pushPoly(p,[[-.11,y0-.35,z+.004],[.11,y0-.35,z+.004],[.11,cy0,z+.004],[-.11,cy0,z+.004]],P('canvasRed')));
      piece('chancel',p=>box(p,cx0,cy0,cx1,cy1,0,top,P('stoneTrim'),P('stone')));
      // Pews face the altar: seat, then a backrest on the door side.
      for(let y=y0;y<=y1+1e-6;y+=.42)for(const sx of [-1,1]){
        const xa=sx<0?-hw+.1:.16,xb=sx<0?-.16:hw-.1;
        piece('pew',p=>{box(p,xa,y-.07,xb,y+.07,z,z+.1,P('wood'),P('woodDark'));box(p,xa,y-.1,xb,y-.06,z,z+.21,P('woodDark'))});
      }
      const ay=spec.altar;
      piece('altar',p=>{
        box(p,-.31,ay-.13,.31,ay+.13,top,top+.24,P('stoneLight'),P('stoneTrim'));
        box(p,-.33,ay-.15,.33,ay+.15,top+.24,top+.255,P('canvasWhite'));
        box(p,-.018,ay+.06,.018,ay+.1,top+.255,top+.58,P('gold'));
        box(p,-.09,ay+.06,.09,ay+.1,top+.44,top+.475,P('gold'));
        for(const x of [-.22,.22])box(p,x-.015,ay-.015,x+.015,ay+.015,top+.255,top+.34,P('lamp'));
      });
      for(const [x,y] of spec.side)piece('sideAltar',p=>{
        const sx=Math.sign(x);
        box(p,x-.13,y-.22,x+.13,y+.22,z,z+.22,P('stoneLight'),P('stoneTrim'));
        box(p,x+sx*.08-.015,y-.02,x+sx*.08+.015,y+.02,z+.22,z+.46,P('gold'));
        box(p,x+sx*.08-.015,y-.08,x+sx*.08+.015,y+.08,z+.37,z+.4,P('gold'));
      });
      if(spec.font)piece('font',p=>{const [x,y]=spec.font;box(p,x-.05,y-.05,x+.05,y+.05,z,z+.12,P('stoneTrim'));box(p,x-.12,y-.12,x+.12,y+.12,z+.12,z+.2,P('stoneLight'),P('stoneTrim'));pushPoly(p,[[x-.09,y-.09,z+.202],[x+.09,y-.09,z+.202],[x+.09,y+.09,z+.202],[x-.09,y+.09,z+.202]],P('water'))});
      if(spec.pulpit)piece('pulpit',p=>{const [x,y]=spec.pulpit;box(p,x-.13,y-.13,x+.13,y+.13,z,z+.36,P('woodDark'),P('wood'));box(p,x-.15,y-.15,x+.15,y+.15,z+.36,z+.39,P('woodLight'))});
      return out;
    }
    if(key.startsWith('townhall')){
      // The council keeps the classic hall; another ground-floor room replaces its furnishings
      // (the hearths stay with the chimney stacks).
      const role=townhallRole(s,0);
      if(role!=='council'){furnishTownhallRoom(role,spec.floors[0],FLOOR_Z,piece,P,spec.hearths);spec={floors:spec.floors,hearths:spec.hearths}}
    }
    const z=FLOOR_Z;
    for(const [x,y] of spec.tables||[])piece('table',p=>{
      box(p,x-.05,y-.05,x+.05,y+.05,z,z+.19,P('woodDark'));
      box(p,x-.23,y-.2,x+.23,y+.2,z+.19,z+.225,P('woodLight'),P('wood'));
      for(const sy of [-1,1])box(p,x-.22,y+sy*.27-.05,x+.22,y+sy*.27+.05,z,z+.11,P('wood'),P('woodDark'));
      box(p,x-.1,y-.04,x-.06,y,z+.225,z+.28,P('iron'));box(p,x+.06,y+.02,x+.1,y+.06,z+.225,z+.28,P('iron'));
    });
    if(spec.counter){const [c0,c1,c2,c3]=spec.counter;
      piece('counter',p=>{box(p,c0,c1,c2,c3,z,z+.26,P('woodDark'),P('wood'));box(p,c0-.02,c1-.02,c2+.02,c3+.02,z+.26,z+.29,P('woodLight'))})}
    // Council: a long table with stools along both sides, the podesta's chair on a dais.
    if(spec.council){const [x0,y0,x1,y1]=spec.council,ym=(y0+y1)/2;
      piece('council',p=>{box(p,x0+.08,ym-.06,x1-.08,ym+.06,z,z+.2,P('woodDark'));box(p,x0,y0,x1,y1,z+.2,z+.235,P('canvasRed'),P('wood'))});
      for(let x=x0+.18;x<=x1-.17;x+=.34)for(const y of [y0-.13,y1+.13])piece('stool',p=>box(p,x-.07,y-.07,x+.07,y+.07,z,z+.13,P('wood'),P('woodDark')));
      for(let x=x0+.25;x<x1-.2;x+=.55)piece('scroll',p=>box(p,x-.06,ym-.03,x+.06,ym+.03,z+.235,z+.255,P('canvasWhite')))}
    if(spec.dais){const [x0,y0,x1,y1]=spec.dais,xm=(x0+x1)/2,ym=(y0+y1)/2;
      piece('dais',p=>{box(p,x0,y0,x1,y1,z,z+.06,P('stoneTrim'),P('stone'));box(p,xm-.12,ym-.08,xm+.12,ym+.1,z+.06,z+.2,P('woodDark'));box(p,xm-.12,ym+.06,xm+.12,ym+.1,z+.2,z+.42,P('woodDark'));box(p,xm-.05,ym+.08,xm+.05,ym+.11,z+.3,z+.4,P('gold'))})}
    for(const [x,y] of spec.banners||[])piece('banner',p=>box(p,x-.1,y-.02,x+.1,y,z+.25,z+.62,P(x<0?'canvasRed':x>0?'canvasBlue':'gold')));
    // Desks with an open ledger and a pair of scales.
    for(const [x,y] of spec.desks||[])piece('desk',p=>{
      box(p,x-.05,y-.05,x+.05,y+.05,z,z+.2,P('woodDark'));box(p,x-.22,y-.15,x+.22,y+.15,z+.2,z+.23,P('woodLight'),P('wood'));
      box(p,x-.12,y-.05,x+.02,y+.06,z+.23,z+.245,P('canvasWhite'));
      box(p,x+.1,y-.01,x+.12,y+.01,z+.23,z+.33,P('iron'));box(p,x+.03,y-.01,x+.19,y+.01,z+.32,z+.335,P('bronze'));
      box(p,x-.07,y-.24,x+.07,y-.18,z,z+.13,P('wood'),P('woodDark'));
    });
    for(const [x,y] of spec.chests||[])piece('chest',p=>{box(p,x-.13,y-.08,x+.13,y+.08,z,z+.15,P('woodDark'),P('wood'));box(p,x-.135,y-.085,x+.135,y+.085,z+.15,z+.17,P('iron'));box(p,x-.02,y-.09,x+.02,y-.08,z+.08,z+.13,P('gold'))});
    // Bolts of cloth stacked on a shelf along x from x0 to x1 at y.
    for(const [x0,y,x1] of spec.bolts||[])piece('bolts',p=>{const a=Math.min(x0,x1),b=Math.max(x0,x1);
      box(p,a,y-.08,b,y+.08,z+.12,z+.14,P('woodDark'));box(p,a,y-.08,b,y+.08,z+.3,z+.32,P('woodDark'));
      const cloth=['cloth','canvasBlue','canvasRed','canvasYellow','canvasGreen'];let i=0;
      for(let x=a+.06;x<b-.05;x+=.13,i++)for(const zz of [z+.14,z+.32])box(p,x-.05,y-.06,x+.05,y+.06,zz,zz+.09,P(cloth[(i+(zz>z+.2?2:0))%cloth.length]))});
    for(const [x,y] of spec.barrels||[])piece('barrel',p=>{box(p,x-.1,y-.1,x+.1,y+.1,z,z+.27,P('barrel'),P('woodDark'));box(p,x-.103,y-.103,x+.103,y+.103,z+.08,z+.1,P('iron'))});
    // Hearths at the chimney stacks, the fire on the side facing the room centre.
    for(const [x,y] of spec.hearths||[])piece('hearth',p=>{
      const L=Math.hypot(x,y),dx=L>.1?-x/L:0,dy=L>.1?-y/L:-1;
      box(p,x-.24,y-.24,x+.24,y+.24,z,z+.42,P('stoneRough'),P('stoneRoughDark'));
      box(p,x-.28,y-.28,x+.28,y+.28,z+.42,z+.47,P('stoneTrim'));
      const fx=x+dx*.3,fy=y+dy*.3;
      box(p,fx-.12,fy-.12,fx+.12,fy+.12,z,z+.025,P('stoneRoughDark'));
      box(p,fx-.06,fy-.06,fx+.06,fy+.06,z+.025,z+.11,P('lamp'),P('flowerRed'));
    });
    return out;
  }
  // World mesh of local parts at place {x,y,angle,scale}, in the {pos,col,gi,groups,groupBias} layout.
  function emit(list,place,ground){
    const a=Number(place.angle)||0,c=Math.cos(a),sn=Math.sin(a),k=place.scale||1,z0=ground||0;
    const pos=[],col=[],gi=[],groups=[],groupBias=[];
    for(const part of list){
      const g=groups.length,start=pos.length,v=part.v;
      for(let i=0;i<v.length;i+=3){const x=v[i]*k,y=v[i+1]*k;pos.push(place.x+x*c-y*sn,place.y+x*sn+y*c,z0+v[i+2]*k)}
      for(const hex of part.cols){col.push(hex);gi.push(g)}
      let cx=0,cy=0,cz=0;const n=(pos.length-start)/3||1;
      for(let i=start;i<pos.length;i+=3){cx+=pos[i];cy+=pos[i+1];cz+=pos[i+2]}
      groups.push([cx/n,cy/n,cz/n]);groupBias.push(part.bias||0);
    }
    return{pos,col,gi,groups,groupBias};
  }
  const cutCache=new Map();
  function cutawayMesh(s,ground){
    const cam=cameraLocal(s),span=floorSpan(s);
    const key=[modelKey(s),s.x,s.y,s.angle||0,ground,State.season,isClay(s),cam?cam.x.toFixed(3)+','+cam.y.toFixed(3):'plan',span.floor,(s.functions||[]).join(',')].join('|');
    const hit=cutCache.get(s.id);if(hit&&hit.key===key)return hit.mesh;
    const mesh=withClay(s,()=>emit([...interiorParts(modelKey(s),span,s),...sectionParts(modelKey(s),cam,span)],placeOf(s),ground));
    cutCache.set(s.id,{key,mesh});
    return mesh;
  }
  // The building mesh is kept per structure (the painter caches its shaded fills on it).
  const bodyCache=new Map();
  function bodyMesh(s,ground){
    const key=[modelKey(s),s.x,s.y,s.angle||0,ground,State.season,isClay(s)].join('|'),hit=bodyCache.get(s.id);
    if(hit&&hit.key===key)return hit.mesh;
    const mesh=withClay(s,()=>triangles(modelKey(s),placeOf(s),ground));
    bodyCache.set(s.id,{key,mesh});
    return mesh;
  }
  function meshes(s,ground,body=true){
    return body?[bodyMesh(s,ground),...propMeshes(s)]:propMeshes(s);
  }
  // 2.5D: paint into the current ctx. Civic draws run inside withStructureGroundPlane.
  function draw(s,preview=false){
    if(!has(s)||!window.ConquerMesh3D)return false;
    const ground=typeof structureProjectionGroundZ!=='undefined'&&Number.isFinite(structureProjectionGroundZ)?structureProjectionGroundZ
      :Number.isFinite(s.groundZ)?s.groundZ:terrainElevation(s);
    // Lot props are sub-pixel when zoomed far out: the 2.5D painter skips them there.
    const body=!preview&&cutawayActive(s)?cutawayMesh(s,ground):null;
    const list=preview?[withClay(s,()=>triangles(modelKey(s),placeOf(s),ground))]
      :(State.view.scale||1)<PROP_LOD_SCALE?[body||bodyMesh(s,ground)]
      :body?[body,...meshes(s,ground,false)]:meshes(s,ground);
    ctx.save();
    if(preview)ctx.globalAlpha*=.62;
    window.ConquerMesh3D.drawMeshes(ctx,list,window.ConquerMesh3D.gameView());
    ctx.restore();
    return true;
  }
  // WebGL: add to a world3d meshBuilder with fixed-light shaded colours.
  function addMesh(m,mesh){
    const p=mesh.pos;
    for(let t=0;t<mesh.col.length;t++){
      const o=t*9;
      m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
    }
  }
  // The selected (cutaway) building is left out here: world3d keeps it in its own buffer,
  // rebuilt on rotation without touching the rest of the town.
  function addToBuilder(m,s,ground){
    if(!has(s)||!window.ConquerMesh3D)return false;
    for(const mesh of meshes(s,ground,!cutawayActive(s)))addMesh(m,mesh);
    return true;
  }
  function addCutawayToBuilder(m,ground){
    const s=selectedOf();if(!cutawayActive(s)||!window.ConquerMesh3D)return false;
    addMesh(m,cutawayMesh(s,ground));
    return true;
  }
  window.ConquerCivic3D={modelKey,has,parts,triangles,draw,addToBuilder,addCutawayToBuilder,cutawayId,cutawaySig,cutawayActive,
    floorCount,visibleFloor,floorSpan,UPPER_ROOMS,townhallRole,roomSlots,prisonBars,prisonCellCount,PRISON_CELL_MAX,lotProps,allLotProps};
})();
