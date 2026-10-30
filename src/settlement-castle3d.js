'use strict';
// CONQUER castle 3D prototype — WebGL2 rasteriser for the castleBody / castleFront scene caches.
//
// Geometry is NOT duplicated here: every volume comes from the same world-space builders the
// Canvas 2.5D renderer already uses (unionFootprintPoints, *BattlementPieces, machicolationFloorPolygon,
// towerRoofFootprintPoints, gateRoofGeometry, builtRoofGeometry, chimneySpecs, stone tower bases,
// wallExteriorLayout for hoarding). Vertices are projected with the game's own w2sRaw, so the output
// lands pixel-exact in the existing caches; a z-buffer replaces painter sorting, band unions and
// occlusion clips. Flat colours reproduce castleSideShade / the union palette.
//
// Opt-in: ?castle3d=1 (persisted) or ConquerCastle3D.setEnabled(true). ?castle3d=0 disables.
// Without WebGL2 (or on any GL error) the Canvas union renderer stays canonical.
(()=>{
  const STORE_KEY='conquer.castle3d.v1';
  const DEPTH_K=ISO_Z;                    // depth = q.x + q.y + ISO_Z*z (monotonic along the view ray)
  const fromUrl=(()=>{try{const v=new URLSearchParams(location.search).get('castle3d');return v===null?null:v!=='0'}catch{return null}})();
  let enabled=fromUrl??(()=>{try{return localStorage.getItem(STORE_KEY)==='1'}catch{return false}})();
  if(fromUrl!==null){try{localStorage.setItem(STORE_KEY,fromUrl?'1':'0')}catch{}}

  const gpu={canvas:null,gl:null,prog:null,buf:null,loc:null,failed:null};
  const perf=()=>window.__conquerPerf||(window.__conquerPerf={});

  // ---------- palettes (top, light side, dark side, top outline) ----------
  // The outline is the stroke extrudePolygonAt draws around the top face. Union bodies get none here:
  // the 2.5D stroke follows the outer contour of the merged band, per-prism edges would add false seams.
  const snowTop=c=>winterSnowColor(c);
  const PAL={
    stone:()=>[snowTop('#9a8e82'),'#635951','#514a44'],          // drawMultiPolygonBand / drawExposedTop
    merlon:()=>[snowTop('#9a8e82'),'#635951','#514a44','#c8b9a9'],  // drawBattlementPiece
    slit:()=>['#2b2622','#24201c','#1d1a17','#2b2622'],             // swallowtail arrow slit
    corbel:()=>[snowTop('#887d72'),'#554d46','#403b36','#9f9183'],
    machFloor:()=>[snowTop('#918579'),'#605750','#4a443e','#b3a596'],
    buttress:()=>[snowTop('#948779'),'#625a52','#4b4540','#9f9285'],
    chimney:()=>['#3b302c','#493732','#332824','#6a5148'],
    hoardDeck:()=>['#74533a','#5d432e','#493423','#927155'],
  };
  const rgbCache=new Map();
  function rgb(hex){
    const color=visualPaletteColor(hex);
    let v=rgbCache.get(color);if(v)return v;
    const h=color.replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);
    rgbCache.set(color,v);return v;
  }

  // ---------- geometry collection ----------
  // terrainElevation() walks every relief polygon (~20 µs); vertices repeat a lot within one build.
  let groundMemo=null;
  function groundAt(p){
    if(Number.isFinite(structureProjectionGroundZ))return structureProjectionGroundZ;
    if(!groundMemo)return terrainElevation(p);
    const k=p.x.toFixed(4)+','+p.y.toFixed(4);
    let z=groundMemo.get(k);if(z===undefined){z=terrainElevation(p);groundMemo.set(k,z)}
    return z;
  }
  function memoGround(fn){const prev=groundMemo;groundMemo=new Map();try{return fn()}finally{groundMemo=prev}}
  // worldOut: emit absolute world coordinates (x, y, z) instead of screen x/y + depth, for
  // settlement-world3d.js, which projects on the GPU with the camera as shader uniforms.
  let worldOut=false;
  function vert(p,z){
    const g=groundAt(p);
    if(worldOut)return{x:p.x,y:p.y,d:z+g,wx:p.x,wy:p.y,wz:z+g};
    const s=w2sRaw(p,z+g),q=rotateViewPoint(p);
    // Plan view looks straight down: only height decides what is in front.
    const d=typeof isPlanView==='function'&&isPlanView()?(z+g):q.x+q.y+DEPTH_K*(z+g);
    return{x:s.x,y:s.y,d,wx:p.x,wy:p.y,wz:z+g};
  }
  function shadeFor(vs,pal){
    // Newell normal in world space; top faces take the top colour, sides follow castleSideShade.
    let nx=0,ny=0,nz=0;
    for(let i=0;i<vs.length;i++){
      const a=vs[i],b=vs[(i+1)%vs.length];
      nx+=(a.wy-b.wy)*(a.wz+b.wz);ny+=(a.wz-b.wz)*(a.wx+b.wx);nz+=(a.wx-b.wx)*(a.wy+b.wy);
    }
    const len=Math.hypot(nx,ny,nz)||1;
    if(Math.abs(nz)/len>.5)return{col:pal[0],top:true};
    const p={x:vs[0].wx,y:vs[0].wy},e={x:p.x-ny,y:p.y+nx};
    const qa=rotateViewPoint(p),qb=rotateViewPoint(e),angle=Math.atan2(qb.y-qa.y,qb.x-qa.x);
    return{col:Math.cos(2*(angle-Math.PI/6))>=0?pal[1]:pal[2],top:false};
  }
  function makeMesh(){
    const tris=[],lines=[],tags=[];
    return{
      tris,lines,tags,
      tag:'body',          // what the next faces are (body / roof): read by the construction assembly
      // face: vertices [{p,z}], colour: hex or palette array (top faces of stroked palettes get an outline)
      face(points,color){
        const vs=points.map(({p,z})=>vert(p,z));if(vs.length<3)return;
        const sh=Array.isArray(color)?shadeFor(vs,color):{col:color,top:false},c=rgb(sh.col);
        for(let i=1;i<vs.length-1;i++){for(const v of [vs[0],vs[i],vs[i+1]])tris.push(v.x,v.y,v.d,c[0],c[1],c[2]);tags.push(this.tag)}
        if(sh.top&&Array.isArray(color)&&color[3]){
          const o=rgb(color[3]);
          for(let i=0;i<vs.length;i++)for(const v of [vs[i],vs[(i+1)%vs.length]])lines.push(v.x,v.y,v.d,o[0],o[1],o[2]);
        }
      },
      prism(pts,z0,z1,pal){
        if(!pts||pts.length<3||!(z1>z0))return;
        this.face(pts.map(p=>({p,z:z1})),pal);
        for(let i=0;i<pts.length;i++){
          const a=pts[i],b=pts[(i+1)%pts.length];
          this.face([{p:a,z:z0},{p:b,z:z0},{p:b,z:z1},{p:a,z:z1}],pal);
        }
      },
      frustum(bottom,top,z0,z1,pal){
        // drawStoneTowerBase 'splayed': side faces only; shade from the bottom edge like the 2.5D code.
        for(let i=0;i<bottom.length;i++){
          const j=(i+1)%bottom.length,shade=castleSideShade(bottom[i],bottom[j]);
          this.face([{p:bottom[i],z:z0},{p:bottom[j],z:z0},{p:top[j],z:z1},{p:top[i],z:z1}],shade);
        }
      },
      pyramid(ring,z,apex,apexZ,colorAt){
        for(let i=0;i<ring.length;i++)this.face([{p:ring[i],z},{p:ring[(i+1)%ring.length],z},{p:apex,z:apexZ}],colorAt(i));
      }
    };
  }

  // Stone castle volumes, including towers/gates on raised slope foundations: the 2.5D path keeps
  // those out of the union and paints them afterwards, which a depth-tested image cannot do.
  function castleVolume(s){return(isCastlePart(s)||isRaisedPlacementCastlePoint(s))&&!underConstruction(s)}
  function castleParts(){return State.structures.filter(s=>castleVolume(s)&&!structureCutaway(s))}
  function cutawayParts(){return State.structures.filter(s=>castleVolume(s)&&structureCutaway(s))}
  const winter=()=>State.season==='winter';

  function addButtress(m,pieces){
    for(const p of pieces){
      if(buttressPieceIsPrism(p))m.prism(p.bottom,p.z0,p.z1,PAL.buttress());
      else{m.frustum(p.bottom,p.top,p.z0,p.z1);m.face(p.top.map(q=>({p:q,z:p.z1})),PAL.buttress())}
    }
  }
  function addTower(m,s){
    const h=structureHeight(s);
    if(isStoneTowerStructure(s)){
      const base=towerBaseStyle(s);
      if(base==='buttress'){
        for(const b of stoneTowerButtresses(s))addButtress(m,b);
      }else if(base==='splayed'){
        m.frustum(stoneTowerSplayedFootprint(s),footprintPoints(s),0,STONE_TOWER_BASE_HEIGHT);
      }
    }
    if(towerRoofStyle(s)==='pitched'){
      m.tag='roof';
      const ring=towerRoofFootprintPoints(s),apex={x:s.x,y:s.y},apexZ=towerVisualTopHeight(s);
      if(s.shape==='round'){
        const cols=winter()?[WINTER_SNOW_B,WINTER_SNOW_A,WINTER_SNOW_TOP]:['#303236','#3a3d42','#44474c'];
        m.pyramid(ring,h,apex,apexZ,i=>cols[i%3]);
      }else{
        m.pyramid(ring,h,apex,apexZ,i=>winter()?(i%2?WINTER_SNOW_A:WINTER_SNOW_B):(i%2?'#34363a':'#42454a'));
      }
    }
  }
  function addGate(m,s){
    const g=gateRoofGeometry(s);if(!g)return;
    const H=g.h,R=g.ridgeH,sa=winter()?WINTER_SNOW_A:'#34363a',sb=winter()?WINTER_SNOW_B:'#42454a';
    m.face([{p:g.c3,z:H},{p:g.c0,z:H},{p:g.ridgeA,z:R}],'#514a44');
    m.face([{p:g.c1,z:H},{p:g.c2,z:H},{p:g.ridgeB,z:R}],'#62584f');
    m.face([{p:g.c0,z:H},{p:g.c1,z:H},{p:g.ridgeB,z:R},{p:g.ridgeA,z:R}],sa);
    m.face([{p:g.c3,z:H},{p:g.c2,z:H},{p:g.ridgeB,z:R},{p:g.ridgeA,z:R}],sb);
  }
  function addBuilt(m,s){
    const g=builtRoofGeometry(s);if(!g)return;
    const [p0,p1,p2,p3]=g.p,ra=g.ridgeA,rb=g.ridgeB,H=g.h,R=g.ridgeH;
    m.face([{p:p0,z:H},{p:p1,z:H},{p:rb,z:R},{p:ra,z:R}],winter()?WINTER_SNOW_A:'#34363a');
    m.face([{p:p3,z:H},{p:p2,z:H},{p:rb,z:R},{p:ra,z:R}],winter()?WINTER_SNOW_B:'#42454a');
    // Gable ends are left open in 2.5D; a closed volume needs them.
    const roofTag=m.tag;m.tag='gable';
    m.face([{p:p0,z:H},{p:ra,z:R},{p:p3,z:H}],PAL.stone());
    m.face([{p:p1,z:H},{p:p2,z:H},{p:rb,z:R}],PAL.stone());
    m.tag=roofTag;
    for(const c of chimneySpecs(s))m.prism(rectWorldPoints(c.center.x,c.center.y,.22,.20,c.angle||0),c.z0,c.z1,PAL.chimney());
  }
  function addHoarding(m,s){
    // drawWallHoarding geometry as solids (the 2.5D version draws the board face only when it faces the camera).
    const g=wallExteriorLayout(s),h=g.z,innerOff=Math.max(.02,g.width/2-.02),outerOff=g.width/2+.42;
    const at=(p,off)=>({x:p.x+g.nx*off*g.side,y:p.y+g.ny*off*g.side});
    m.prism([at(s.a,innerOff),at(s.b,innerOff),at(s.b,outerOff),at(s.a,outerOff)],h-.045,h+.055,PAL.hoardDeck());
    const ri=Math.max(0,g.width/2-.08),ro=outerOff+.07;
    m.face([{p:at(s.a,ri),z:h+.66},{p:at(s.b,ri),z:h+.66},{p:at(s.b,ro),z:h+.47},{p:at(s.a,ro),z:h+.47}],'#4b382a');
    const low=h-.03,high=h+.43;
    m.face([{p:at(s.a,outerOff),z:low},{p:at(s.b,outerOff),z:low},{p:at(s.b,outerOff),z:high},{p:at(s.a,outerOff),z:high}],'#654832');
    const bays=Math.max(2,Math.round(g.usable/.75)),start=g.startPad,span=Math.max(.01,g.L-g.endPad-start);
    for(let i=0;i<=bays;i++){
      const along=start+span*(i/bays),base={x:s.a.x+g.ux*along,y:s.a.y+g.uy*along},o=at(base,outerOff+.025);
      m.prism(rectWorldPoints(o.x,o.y,.05,.05,g.angle),low,high,['#3f2c20','#3f2c20','#3f2c20']);
      if(i%2)continue;
      const w0={x:base.x-g.ux*.02,y:base.y-g.uy*.02},w1={x:base.x+g.ux*.02,y:base.y+g.uy*.02},lo=Math.max(.12,h-.58);
      m.face([{p:at(w0,outerOff),z:h-.02},{p:at(w1,outerOff),z:h-.02},{p:at(w1,innerOff),z:lo},{p:at(w0,innerOff),z:lo}],'#3f2c20');
    }
  }
  // Body geometry is needed twice per rebuild (colour pass for castleBody, depth pre-pass for
  // castleFront): keep the last build keyed by the castle cache signature.
  const bodyMemo={key:null,tris:null};
  function buildBody(){
    // Vertices are in screen space: the signature covers structures/scale/rotation, add the pan.
    const key=typeof castleBodyVisualSignature==='function'?castleBodyVisualSignature()+'|'+State.view.x+'|'+State.view.y:null;
    if(key&&bodyMemo.key===key)return bodyMemo.tris;
    const tris=memoGround(buildBodyUncached);
    bodyMemo.key=key;bodyMemo.tris=tris;
    return tris;
  }
  function addFoundation(m,s){
    // drawPlacementFoundation: ground-contact ring walls from the terrain up to the placement plane.
    const baseZ=placementGroundZ(s);
    if(!Number.isFinite(baseZ)||placementFoundationDepth(s)<=.015)return;
    withProjectionGroundZ(0,()=>{
      for(const fp of unionGroundContactRings(structureGroundContactPolygons(s))){
        for(let i=0;i<fp.length;i++){
          const a=fp[i],b=fp[(i+1)%fp.length],steps=Math.max(1,Math.ceil(dist(a,b)/.24));
          for(let j=0;j<steps;j++){
            const p0={x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps},p1={x:a.x+(b.x-a.x)*(j+1)/steps,y:a.y+(b.y-a.y)*(j+1)/steps};
            const z0=Math.min(baseZ,terrainElevation(p0)),z1=Math.min(baseZ,terrainElevation(p1));
            if(baseZ-Math.min(z0,z1)<=.01)continue;
            m.face([{p:p0,z:z0},{p:p1,z:z1},{p:p1,z:baseZ},{p:p0,z:baseZ}],castleSideShade(p0,p1));
          }
        }
      }
    });
  }
  function bodyMesh(parts,withBackPieces=false){
    const m=makeMesh();
    if(withBackPieces)addPieces(m,'back');
    for(const s of parts){
      withStructureVisualMaterial(s,()=>{
      const point=s.type==='tower'||s.type==='gate';
      if(point&&isRaisedPlacementCastlePoint(s))addFoundation(m,s);
      const run=fn=>point?withStructureGroundPlane(s,fn):fn();
      run(()=>{
        // In the world renderer stone gates are carved: piers and a vault around a passage you can
        // see through, with door leaves as meshes. The Canvas paths keep the solid block and decals.
        if(!(worldOut&&s.type==='gate'&&window.ConquerGates?.addGateBody(m,s,structureHeight(s),PAL.stone())))
          m.prism(unionFootprintPoints(s),0,structureHeight(s),PAL.stone());
        if(s.type==='tower')addTower(m,s);
        m.tag='roof';
        if(s.type==='gate')addGate(m,s);
        if(s.type==='built')addBuilt(m,s);
        m.tag='body';
        for(const b of wideHallButtresses(s))addButtress(m,b);
        if(s.type==='wall'&&wallSkin(s)==='hoarding')addHoarding(m,s);
        const mf=machicolationFloorPolygon(s);
        if(mf)m.prism(mf.pts,mf.z-.055,mf.z+.035,PAL.machFloor());
      });
      });
    }
    return withLines(m);
  }
  // Triangle arrays carry their top-face outlines along (same 6-float vertex layout, GL_LINES pairs).
  function withLines(m){const t=m.tris;t.lines=m.lines;t.tags=m.tags;return t}
  function buildBodyUncached(){return bodyMesh(castleParts(),true)}
  // Full volumes of cutaway structures, used only as depth occluders (their look stays 2.5D).
  function buildCutawayDepth(){return memoGround(()=>bodyMesh(cutawayParts()))}
  function buildFront(){return memoGround(()=>{const m=makeMesh();addPieces(m,'front');return withLines(m)})}

  // Battlements are split around their owner: pieces on the far half belong to the castle body (drawn
  // before patrols, so soldiers on the walkway stay in front of them), pieces on the near half go to
  // castleFront (drawn after patrols). The 2.5D renderer gets the same effect by clipping far merlons
  // at the wall crest. Plan view looks straight down: everything stays under the patrols.
  function viewDepthOf(p){const q=rotateViewPoint(p);return q.x+q.y}
  // Reference point for "near/far": the structure centre, or for linear pieces the closest point on the
  // a→b axis (a wall's merlons all sit on one edge, so only the across-axis offset matters).
  function ownerRef(s,c){
    if(!(s.a&&s.b))return{x:s.x,y:s.y};
    const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,L2=dx*dx+dy*dy||1,t=clamp(((c.x-s.a.x)*dx+(c.y-s.a.y)*dy)/L2,0,1);
    return{x:s.a.x+dx*t,y:s.a.y+dy*t};
  }
  // One battlement piece: corbel or merlon body, plus the crenel-style crown prisms (merlonStyleParts).
  function prismPiece(m,p){
    m.prism(p.pts,p.z0,p.z1,p.kind==='machicolationCorbel'?PAL.corbel():PAL.merlon());
    for(const q of p.styleParts||[])m.prism(q.pts,q.z0,q.z1,q.tone==='slit'?PAL.slit():PAL.merlon());
  }
  function addPieces(m,which){
    const plan=typeof isPlanView==='function'&&isPlanView();
    if(plan&&which==='front')return;
    for(const s of worldOut?State.structures.filter(castleVolume):castleParts()){
      withStructureVisualMaterial(s,()=>{
      const pieces=s.type==='tower'?towerBattlementPieces(s):s.type==='gate'?gateBattlementPieces(s):s.type==='wall'?wallBattlementPieces(s):[];
      for(const p of pieces){
        const c={x:p.pts.reduce((a,q)=>a+q.x,0)/p.pts.length,y:p.pts.reduce((a,q)=>a+q.y,0)/p.pts.length};
        const near=viewDepthOf(c)>viewDepthOf(ownerRef(s,c))+1e-6;
        if(!plan&&(which==='front')!==near)continue;
        withProjectionGroundZ(p.groundZ,()=>prismPiece(m,p));
      }
      });
    }
  }

  // ---------- WebGL2 ----------
  const VS=`#version 300 es
    in vec3 aPos;in vec3 aCol;uniform vec4 uBounds;uniform vec2 uDepth;out vec3 vCol;
    void main(){
      float x=(aPos.x-uBounds.x)/uBounds.z*2.0-1.0, y=1.0-(aPos.y-uBounds.y)/uBounds.w*2.0;
      float z=1.0-2.0*(aPos.z-uDepth.x)/max(uDepth.y-uDepth.x,1e-4);   // larger depth value = nearer
      gl_Position=vec4(x,y,z,1.0);vCol=aCol;
    }`;
  const FS=`#version 300 es
    precision mediump float;in vec3 vCol;out vec4 o;void main(){o=vec4(vCol,1.0);}`;
  function ensureGL(){
    if(gpu.gl)return gpu.gl;
    if(gpu.failed)return null;
    try{
      const c=document.createElement('canvas');
      const gl=c.getContext('webgl2',{antialias:true,alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,depth:true,stencil:true});
      if(!gl)throw new Error('webgl2-unavailable');
      const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
      const prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
      Object.assign(gpu,{canvas:c,gl,prog,buf:gl.createBuffer(),loc:{
        pos:gl.getAttribLocation(prog,'aPos'),col:gl.getAttribLocation(prog,'aCol'),
        bounds:gl.getUniformLocation(prog,'uBounds'),depth:gl.getUniformLocation(prog,'uDepth')}});
      c.addEventListener('webglcontextlost',e=>{e.preventDefault();gpu.gl=null;gpu.failed='context-lost'});
      return gl;
    }catch(err){gpu.failed=String(err?.message||err);console.warn('Castle 3D unavailable:',gpu.failed);return null}
  }
  function drawTris(gl,tris,mode=gl.TRIANGLES){
    if(!tris?.length)return;
    gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(tris),gl.STREAM_DRAW);
    gl.enableVertexAttribArray(gpu.loc.pos);gl.vertexAttribPointer(gpu.loc.pos,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(gpu.loc.col);gl.vertexAttribPointer(gpu.loc.col,3,gl.FLOAT,false,24,12);
    gl.drawArrays(mode,0,tris.length/6);
  }
  function screenBounds(sets){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,dMin=Infinity,dMax=-Infinity;
    for(const t of sets)for(let i=0;i<t.length;i+=6){
      const x=t[i],y=t[i+1],d=t[i+2];
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;if(d<dMin)dMin=d;if(d>dMax)dMax=d;
    }
    if(!Number.isFinite(minX))return null;
    const pad=2;
    return{x:Math.floor(minX-pad),y:Math.floor(minY-pad),w:Math.ceil(maxX-minX+pad*2),h:Math.ceil(maxY-minY+pad*2),dMin:dMin-1,dMax:dMax+1};
  }
  // Rasterise: depthOnly tris write depth (colour masked), colour tris are drawn on top with depth test.
  // maskToDepth: colour only lands where depthOnly geometry covers the pixel (stencil).
  function rasterise(depthOnly,colour,maskToDepth=false){
    const gl=ensureGL();if(!gl)return null;
    const b=screenBounds([depthOnly,colour]);if(!b)return{empty:true};
    const dpr=staticCacheDpr(),maxSide=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    const scale=Math.min(dpr,maxSide/Math.max(b.w,1),maxSide/Math.max(b.h,1));
    const W=Math.max(1,Math.round(b.w*scale)),H=Math.max(1,Math.round(b.h*scale));
    if(gpu.canvas.width!==W||gpu.canvas.height!==H){gpu.canvas.width=W;gpu.canvas.height=H}
    gl.viewport(0,0,W,H);gl.useProgram(gpu.prog);
    gl.uniform4f(gpu.loc.bounds,b.x,b.y,b.w,b.h);gl.uniform2f(gpu.loc.depth,b.dMin,b.dMax);
    gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clearStencil(0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    // Faces are pushed back slightly so the top-face outlines (drawn without offset) win the depth test.
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    if(maskToDepth){gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.ALWAYS,1,0xff);gl.stencilOp(gl.KEEP,gl.REPLACE,gl.REPLACE)}
    else gl.disable(gl.STENCIL_TEST);
    if(depthOnly.length){gl.colorMask(false,false,false,false);drawTris(gl,depthOnly);gl.colorMask(true,true,true,true)}
    if(maskToDepth){gl.stencilFunc(gl.EQUAL,1,0xff);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP)}
    drawTris(gl,colour);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    drawTris(gl,colour.lines,gl.LINES);
    gl.disable(gl.STENCIL_TEST);
    const err=gl.getError();if(err){gpu.failed='gl-error-'+err;return null}
    return{bounds:b};
  }

  // ---------- cache hooks ----------
  function supported(){return !!ensureGL()}
  function active(){return enabled&&supported()}

  // Replaces drawCastleUnion + drawCastleUnionDetails + machicolation floors + tower/gate roofs.
  // Returns false to let the caller fall back to the Canvas union renderer.
  function drawBody(){
    if(!active())return false;
    const t0=performance.now();
    const body=buildBody(),r=rasterise([],body);
    if(!r)return false;
    if(!r.empty)ctx.drawImage(gpu.canvas,r.bounds.x,r.bounds.y,r.bounds.w,r.bounds.h);
    // 2.5D overlays kept as-is: arcades, orientation ticks, raised points, cutaways, doors.
    for(const s of castleParts()){
      if(s.type==='built')drawBuiltArcade(s);
      if(s.type==='tower'||s.type==='gate'){
        const h=structureHeight(s),a=w2s({x:s.x,y:s.y},h+.03),q={x:s.x+Math.cos(s.angle||0)*.55,y:s.y+Math.sin(s.angle||0)*.55},b=w2s(q,h+.03);
        ctx.save();ctx.strokeStyle='rgba(245,226,202,.48)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
      }
    }
    // Cutaway structures keep their 2.5D interior rendering; afterwards everything that is in front
    // of their full volume is re-rasterised on top, so they no longer paint over nearer masonry.
    const cut=cutawayParts();
    if(cut.length){
      drawCutawayStructures();
      const rr=rasterise(buildCutawayDepth(),body,true);
      if(rr&&!rr.empty)ctx.drawImage(gpu.canvas,rr.bounds.x,rr.bounds.y,rr.bounds.w,rr.bounds.h);
    }
    drawTowerDoors();
    const p=perf();p.castle3dBodyMs=performance.now()-t0;p.castle3dBodyTris=body.length/18;
    return true;
  }
  // castleFront: stone battlements rasterised against the full castle depth (hidden merlons vanish);
  // palisade / wood-tower front pieces still use the 2.5D path.
  function drawFront(){
    if(!active())return false;
    const t0=performance.now();
    const front=buildFront(),r=rasterise(buildBody(),front);
    if(!r)return false;
    if(!r.empty)ctx.drawImage(gpu.canvas,r.bounds.x,r.bounds.y,r.bounds.w,r.bounds.h);
    const all=State.structures;
    // 2.5D front pieces only for what the 3D pass does not own (palisades, wood towers, cutaways).
    try{State.structures=all.filter(s=>!castleVolume(s)||structureCutaway(s));drawCastleBattlements()}finally{State.structures=all}
    const p=perf();p.castle3dFrontMs=performance.now()-t0;p.castle3dFrontTris=front.length/18;
    return true;
  }
  function setEnabled(on){
    enabled=!!on;
    try{localStorage.setItem(STORE_KEY,enabled?'1':'0')}catch{}
    window.__conquerAssetCompiler?.clearComposite?.();
    invalidateSceneCache(['castleBody','castleFront']);draw();
    return active();
  }
  // World-space castle meshes (6 floats per vertex: x, y, z, r, g, b; .lines = outlines) for the
  // full-scene renderer. Side shading and the near/far battlement split follow the current view
  // rotation, so callers rebuild on rotation change.
  function worldMeshes(){
    worldOut=true;
    try{
      return memoGround(()=>{
        const body=bodyMesh(castleParts(),true),fm=makeMesh();addPieces(fm,'front');
        return{body,front:withLines(fm),cutaway:bodyMesh(cutawayParts())};
      });
    }finally{worldOut=false}
  }
  // One structure as world triangles (x,y,z,r,g,b per vertex, already shaded) with a tag per
  // triangle (body / roof / crown), whatever its construction state: the construction assembly
  // reveals it piece by piece while it is being built.
  function structureWorld(s){
    worldOut=true;
    try{
      return memoGround(()=>{
        const body=bodyMesh([s]),m=makeMesh();m.tag='crown';
        withStructureVisualMaterial(s,()=>{
          const pieces=s.type==='tower'?towerBattlementPieces(s):s.type==='gate'?gateBattlementPieces(s):s.type==='wall'?wallBattlementPieces(s):[];
          for(const p of pieces)withProjectionGroundZ(p.groundZ,()=>prismPiece(m,p));
        });
        return{tris:body.concat(m.tris),tags:body.tags.concat(m.tags)};
      });
    }finally{worldOut=false}
  }
  window.ConquerCastle3D={active,supported,setEnabled,drawBody,drawFront,worldMeshes,structureWorld,castleParts:()=>castleParts(),
    castleVolume:s=>castleVolume(s),PAL,
    status:()=>({enabled,supported:supported(),failed:gpu.failed,bodyMs:perf().castle3dBodyMs,frontMs:perf().castle3dFrontMs,bodyTris:perf().castle3dBodyTris,frontTris:perf().castle3dFrontTris}),
    _build:{body:buildBody,front:buildFront}};
})();
