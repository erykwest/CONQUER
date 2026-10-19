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
    if(s.type==='civicAnnex')return s.annexType;
    const level=typeof civicLevel==='function'?civicLevel(s):1;
    if(s.type==='plaza')return 'plaza_'+(typeof plazaVariant==='function'?plazaVariant(s):'paved')+level;
    if(s.type==='church'||s.type==='tavern'||s.type==='market')return s.type+level;
    return null;
  }
  const has=s=>{const k=modelKey(s);return !!(k&&DATA()?.models?.[k])};
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
  // Palette with the roofs whitened in winter (light and dark tones kept apart).
  let palCache=null;
  function palette(){
    const data=DATA(),winter=typeof State!=='undefined'&&State.season==='winter';
    if(palCache&&palCache.data===data&&palCache.winter===winter)return palCache.pal;
    const pal=data.palette.map((hex,i)=>{const k=data.paletteKeys[i];
      return winter&&k.startsWith('roof')?WINTER[/Dark$/.test(k)?1:0]:hex});
    palCache={data,winter,pal};return pal;
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
  const PROP_SCALE={graveStone:1.45,graveWorn:1.45,graveCross:1.45,graveSlab:1.45,graveTall:1.45,cemeteryCross:1.35,
    cypress:1.25,cypressSmall:1.25,tableSet:1.3,tableBarrel:1.3,tablePergola:1.25,flowerBush:1.3};
  const PROP_R={graveStone:.24,graveWorn:.24,graveCross:.24,graveSlab:.27,graveTall:.29,cemeteryCross:.55,
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
  function churchyard(s,level,ctx,rnd,placed){
    const a=s.angle||0,ex={x:Math.cos(a),y:Math.sin(a)},ey={x:-Math.sin(a),y:Math.cos(a)};
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
  // The building mesh is kept per structure (the painter caches its shaded fills on it).
  const bodyCache=new Map();
  function bodyMesh(s,ground){
    const key=[modelKey(s),s.x,s.y,s.angle||0,ground,State.season].join('|'),hit=bodyCache.get(s.id);
    if(hit&&hit.key===key)return hit.mesh;
    const mesh=triangles(modelKey(s),s,ground);
    bodyCache.set(s.id,{key,mesh});
    return mesh;
  }
  function meshes(s,ground){
    return[bodyMesh(s,ground),...propMeshes(s)];
  }
  // 2.5D: paint into the current ctx. Civic draws run inside withStructureGroundPlane.
  function draw(s,preview=false){
    if(!has(s)||!window.ConquerMesh3D)return false;
    const ground=typeof structureProjectionGroundZ!=='undefined'&&Number.isFinite(structureProjectionGroundZ)?structureProjectionGroundZ
      :Number.isFinite(s.groundZ)?s.groundZ:terrainElevation(s);
    // Lot props are sub-pixel when zoomed far out: the 2.5D painter skips them there.
    const list=preview?[triangles(modelKey(s),s,ground)]
      :(State.view.scale||1)<PROP_LOD_SCALE?[bodyMesh(s,ground)]:meshes(s,ground);
    ctx.save();
    if(preview)ctx.globalAlpha*=.62;
    window.ConquerMesh3D.drawMeshes(ctx,list,window.ConquerMesh3D.gameView());
    ctx.restore();
    return true;
  }
  // WebGL: add to a world3d meshBuilder with fixed-light shaded colours.
  function addToBuilder(m,s,ground){
    if(!has(s)||!window.ConquerMesh3D)return false;
    for(const mesh of meshes(s,ground)){
      const p=mesh.pos;
      for(let t=0;t<mesh.col.length;t++){
        const o=t*9;
        m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
      }
    }
    return true;
  }
  window.ConquerCivic3D={modelKey,has,parts,triangles,draw,addToBuilder,lotProps,allLotProps};
})();
