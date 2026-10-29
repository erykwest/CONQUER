'use strict';
// CONQUER world 3D prototype — the whole static scene on WebGL2 with the camera as shader uniforms.
//
// Static geometry is uploaded once and only rebuilt when its content changes; pan, zoom, rotation and
// plan view are pure uniform changes (no scene-cache rebuilds). Everything reuses the game's own data:
//   - terrain mesh from State.relief (level tops + reliefEdgeBands, same model as terrainElevation);
//   - ground look (biome, relief colours, rivers, forest floor, roads, fields, lots, crossings) is the
//     existing Canvas 2D drawing, baked once in plan view into textures draped over the terrain;
//   - houses from urbanHouseFaces(), civic/industry/well from their footprints, castle from
//     ConquerCastle3D.worldMeshes(); sun shadows from shadowCasterGeometry()/sunShadowState();
//   - trees as depth-tested billboards using the forest SVG sprites.
// Dynamic figures, decals and overlays keep drawing in 2D on #c (step 2 moves soldiers into 3D).
// On by default where WebGL2 works; the 2.5D Canvas path is the fallback.
// Opt-out: ?world3d=0 (persisted, page reloads on toggle) or ConquerWorld3D.setEnabled(false).
(()=>{
  const STORE_KEY='conquer.world3d.v2';
  const fromUrl=(()=>{try{const v=new URLSearchParams(location.search).get('world3d');return v===null?null:v!=='0'}catch{return null}})();
  const forcedCanvas=(()=>{try{return new URLSearchParams(location.search).get('renderer')==='canvas2d'}catch{return false}})();
  let enabled=!forcedCanvas&&(fromUrl??(()=>{try{return localStorage.getItem(STORE_KEY)!=='0'}catch{return true}})());
  // Branch-local A/B: ?nightlight=0 keeps the same WebGL2 world, but uses old Canvas lights.
  let useGpuNightLights=(()=>{try{return new URLSearchParams(location.search).get('nightlight')!=='0'}catch{return true}})();
  if(fromUrl!==null){try{localStorage.setItem(STORE_KEY,fromUrl?'1':'0')}catch{}}

  const TEX_SIZE=4096;                                   // world texture 200U, detail texture = build area
  const DETAIL={x0:BUILD_MIN,y0:BUILD_MIN,size:BUILD_MAX-BUILD_MIN};
  const S={gl:null,canvas:null,failed:null,prog:{},buf:{},tex:{},sig:{},stats:{}};
  const perf=()=>window.__conquerPerf||(window.__conquerPerf={});

  // ---------- shaders ----------
  const CAMERA=`
    uniform int uRot;uniform float uS;uniform vec2 uV;uniform float uPlan;uniform vec2 uVp;uniform vec2 uDepth;
    vec2 rotq(vec2 p){vec2 d=p-vec2(100.0);
      if(uRot==1)return vec2(100.0-d.y,100.0+d.x);
      if(uRot==2)return vec2(100.0-d.x,100.0-d.y);
      if(uRot==3)return vec2(100.0+d.y,100.0-d.x);
      return p;}
    // Same affine map as w2sRaw (isometric or plan) plus a monotonic view depth (larger = nearer).
    vec4 cam(vec3 w,vec2 px){
      vec2 q=rotq(w.xy);vec2 s;float d;
      if(uPlan>0.5){s=uV+q*uS;d=w.z;}
      else{s=vec2(uV.x+(q.x-q.y)*uS*0.8660254,uV.y+(q.x+q.y)*uS*0.5-w.z*uS*0.9);d=q.x+q.y+0.9*w.z;}
      s+=px;
      return vec4(s.x/uVp.x*2.0-1.0,1.0-s.y/uVp.y*2.0,1.0-2.0*(d-uDepth.x)/(uDepth.y-uDepth.x),1.0);}`;
  const SRC={
    mesh:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;in vec3 aCol;out vec3 vCol;
      void main(){gl_Position=cam(aPos,vec2(0.0));vCol=aCol;}`,
      `#version 300 es
      precision mediump float;in vec3 vCol;out vec4 o;void main(){o=vec4(vCol,1.0);}`],
    flat:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;void main(){gl_Position=cam(aPos,vec2(0.0));}`,
      `#version 300 es
      precision mediump float;uniform vec4 uColor;out vec4 o;void main(){o=vec4(uColor.rgb*uColor.a,uColor.a);}`],
    terrain:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;out vec2 vW;
      void main(){gl_Position=cam(aPos,vec2(0.0));vW=aPos.xy;}`,
      `#version 300 es
      precision highp float;in vec2 vW;uniform sampler2D uWorld;uniform sampler2D uDetail;uniform vec3 uDetailRect;out vec4 o;
      void main(){
        vec2 dUV=(vW-uDetailRect.xy)/uDetailRect.z;
        bool inDetail=all(greaterThanEqual(dUV,vec2(0.002)))&&all(lessThanEqual(dUV,vec2(0.998)));
        vec4 c=inDetail?texture(uDetail,dUV):texture(uWorld,clamp(vW/200.0,0.0,1.0));
        o=vec4(c.rgb,1.0);}`],
    decal:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;in vec2 aUV;in vec4 aCol;out vec2 vUV;out vec4 vCol;
      void main(){gl_Position=cam(aPos,vec2(0.0));vUV=aUV;vCol=aCol;}`,
      `#version 300 es
      precision mediump float;in vec2 vUV;in vec4 vCol;uniform sampler2D uAtlas;out vec4 o;
      void main(){vec4 c=texture(uAtlas,vUV)*vCol;if(c.a<0.02)discard;o=c;}`],
    // Window emissive decals are anchored on the actual 3D facades, sharing the masonry depth buffer.
    light:[`#version 300 es
      ${CAMERA}
      in vec3 aPos;in vec2 aUV;in vec4 aCol;out vec2 vUV;out vec4 vCol;
      void main(){gl_Position=cam(aPos,vec2(0.0));vUV=aUV;vCol=aCol;}`,
      `#version 300 es
      precision mediump float;in vec2 vUV;in vec4 vCol;uniform sampler2D uAtlas;uniform float uNight;out vec4 o;
      void main(){vec4 tex=texture(uAtlas,vUV);float a=tex.a*vCol.a*uNight;
        if(a<0.003)discard;o=vec4(tex.rgb*vCol.rgb*vCol.a*uNight,a);}`],
    // A radial light halo is a camera-facing billboard with a world-space anchor and real depth.
    fireLight:[`#version 300 es
      ${CAMERA}
      in vec3 aAnchor;in vec2 aCorner;in float aSize;in vec2 aUV;in float aSeed;
      out vec2 vUV;out float vSeed;
      void main(){gl_Position=cam(aAnchor,aCorner*aSize*uS);vUV=aUV;vSeed=aSeed;}`,
      `#version 300 es
      precision mediump float;in vec2 vUV;in float vSeed;uniform sampler2D uAtlas;
      uniform float uNight;uniform float uTime;out vec4 o;
      void main(){vec4 tex=texture(uAtlas,vUV);
        float flicker=clamp(0.86+0.09*sin(uTime*31.0+vSeed*6.283185)
          +0.04*sin(uTime*53.0+vSeed*9.0),0.6,1.0);
        float a=tex.a*uNight*flicker*0.8;
        if(a<0.003)discard;o=vec4(tex.rgb*vec3(1.0,0.54,0.22)*uNight*flicker*0.8,a);}`],
    sprite:[`#version 300 es
      ${CAMERA}
      in vec3 aAnchor;in vec2 aCorner;in float aSize;in vec2 aUV;out vec2 vUV;
      void main(){gl_Position=cam(aAnchor,aCorner*aSize*uS);vUV=aUV;}`,
      `#version 300 es
      precision mediump float;in vec2 vUV;uniform sampler2D uAtlas;out vec4 o;
      void main(){vec4 c=texture(uAtlas,vUV);if(c.a<0.45)discard;o=vec4(c.rgb/max(c.a,1e-3),1.0);}`]
  };

  function ensureGL(){
    if(S.gl)return S.gl;
    if(S.failed)return null;
    try{
      const c=document.createElement('canvas');
      const gl=c.getContext('webgl2',{antialias:true,alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,depth:true});
      if(!gl)throw new Error('webgl2-unavailable');
      const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
      for(const [name,[vs,fs]] of Object.entries(SRC)){
        const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
        if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(name+': '+gl.getProgramInfoLog(p));
        const loc={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
        for(let i=0;i<n;i++){const u=gl.getActiveUniform(p,i);loc[u.name]=gl.getUniformLocation(p,u.name)}
        const an=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);
        for(let i=0;i<an;i++){const a=gl.getActiveAttrib(p,i);loc[a.name]=gl.getAttribLocation(p,a.name)}
        const vao=gl.createVertexArray();if(!vao)throw new Error('webgl2-vertex-array-unavailable');
        S.prog[name]={p,loc,vao};
      }
      S.aniso=gl.getExtension('EXT_texture_filter_anisotropic');
      c.addEventListener('webglcontextlost',e=>{e.preventDefault();S.gl=null;S.errorFence=null;S.failed='context-lost'});
      S.canvas=c;S.gl=gl;
      return gl;
    }catch(err){S.failed=String(err?.message||err);console.warn('World 3D unavailable:',S.failed);return null}
  }

  function pollRendererError(gl){
    if(gl.isContextLost())throw new Error('WebGL2 renderer failure');
    if(!S.errorFence)return;
    // Poll without waiting, but bound the grace period so a constantly busy
    // queue cannot indefinitely postpone error detection.
    const ready=gl.clientWaitSync(S.errorFence,0,0);
    if(ready===gl.TIMEOUT_EXPIRED&&performance.now()-S.errorFenceAt<1000)return;
    gl.deleteSync(S.errorFence);S.errorFence=null;
    if(ready===gl.WAIT_FAILED||gl.getError()!==gl.NO_ERROR)throw new Error('WebGL2 renderer failure');
    // Even a signalled fence does not make the browser's error query free:
    // getError can synchronise its command decoder. Keep it off the hot path;
    // context loss is still checked every frame above.
    S.errorCheckAfter=performance.now()+1000;
  }
  function deferRendererError(gl){
    if(performance.now()<(S.errorCheckAfter||0))return;
    // Cover the latest complete frame, retaining the first checkpoint's age.
    if(S.errorFence)gl.deleteSync(S.errorFence);
    else S.errorFenceAt=performance.now();
    S.errorFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    if(!S.errorFence)throw new Error('WebGL2 sync allocation failed');
    gl.flush();
  }

  // ---------- small geometry helpers (world space, absolute z) ----------
  const rgbCache=new Map();
  function rgb(hex,usePalette=false){
    // Preserve terrain and elevation tones when the architectural palette changes.
    const color=usePalette?visualPaletteColor(hex):hex;
    let v=rgbCache.get(color);if(v)return v;
    const h=String(color).replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);rgbCache.set(color,v);return v;
  }
  function meshBuilder(usePalette=false){
    const tris=[];
    const api={
      tris,
      face(vs,hex){                       // vs: [{x,y,z}] convex
        const c=rgb(hex,usePalette);
        for(let i=1;i<vs.length-1;i++)for(const v of [vs[0],vs[i],vs[i+1]])tris.push(v.x,v.y,v.z,c[0],c[1],c[2]);
      },
      // Prism over a footprint with absolute base z; sides alternate like extrudePolygon (i%2 ? A : B).
      prism(pts,z0,z1,top,sideA,sideB){
        if(!pts?.length||!(z1>z0))return;
        api.face(pts.map(p=>({x:p.x,y:p.y,z:z1})),top);
        for(let i=0;i<pts.length;i++){
          const a=pts[i],b=pts[(i+1)%pts.length];
          api.face([{x:a.x,y:a.y,z:z0},{x:b.x,y:b.y,z:z0},{x:b.x,y:b.y,z:z1},{x:a.x,y:a.y,z:z1}],i%2?sideA:sideB);
        }
      },
      // Gabled block (drawCivicGabledPart / urbanHouseFaces): ridge along local x of (angle), walls by parity.
      gabled(center,w,h,turn,angle,base,wallH,ridgeH,wallA,wallB,roofA,roofB,gable){
        const rw=Math.abs(turn)>1e-6?h:w,rh=Math.abs(turn)>1e-6?w:h,ca=Math.cos(angle),sa=Math.sin(angle);
        const L=(x,y,z)=>({x:center.x+x*ca-y*sa,y:center.y+x*sa+y*ca,z});
        const c=[L(-rw/2,-rh/2,0),L(rw/2,-rh/2,0),L(rw/2,rh/2,0),L(-rw/2,rh/2,0)];
        for(let i=0;i<4;i++){
          const a=c[i],b=c[(i+1)%4];
          api.face([{...a,z:base},{...b,z:base},{...b,z:base+wallH},{...a,z:base+wallH}],i%2?wallA:wallB);
        }
        const W=p=>({...p,z:base+wallH}),r0=L(-rw/2,0,base+ridgeH),r1=L(rw/2,0,base+ridgeH);
        api.face([W(c[0]),W(c[1]),r1,r0],roofA);api.face([W(c[3]),W(c[2]),r1,r0],roofB);
        api.face([W(c[0]),W(c[3]),r0],gable);api.face([W(c[1]),W(c[2]),r1],gable);
      }
    };
    return api;
  }

  // ---------- terrain ----------
  function earcut(pts){
    // Ear clipping for simple polygons (relief level tops). Returns index triples.
    const n=pts.length;if(n<3)return[];
    let area=0;for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];area+=a.x*b.y-b.x*a.y}
    const idx=[...Array(n).keys()];if(area<0)idx.reverse();
    const out=[],cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const inside=(p,a,b,c)=>cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0;
    let guard=0;
    while(idx.length>3&&guard++<n*n){
      let clipped=false;
      for(let i=0;i<idx.length;i++){
        const ia=idx[(i+idx.length-1)%idx.length],ib=idx[i],ic=idx[(i+1)%idx.length],a=pts[ia],b=pts[ib],c=pts[ic];
        if(cross(a,b,c)<=1e-12)continue;
        let ok=true;
        for(const j of idx){if(j===ia||j===ib||j===ic)continue;if(inside(pts[j],a,b,c)){ok=false;break}}
        if(!ok)continue;
        out.push(ia,ib,ic);idx.splice(i,1);clipped=true;break;
      }
      if(!clipped)break;
    }
    if(idx.length===3)out.push(idx[0],idx[1],idx[2]);
    return out;
  }
  function buildTerrain(){
    const v=[],push=(x,y,z)=>v.push(x,y,z);
    // Hills crossing the map edge are cut at the world square, like the 2.5D relief
    // (clipTerrainPolygon), instead of spilling past the map.
    const clipped=tri=>{
      const poly=clipTerrainPolygon(tri);
      for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i],poly[i+1]])push(p.x,p.y,p.z);
    };
    const W=WORLD;
    const terraformEdits=window.ConquerTerraforming?.edits?.()||State.relief?.terraforming||[];
    if(terraformEdits.length){
      const terraces=terraformEdits.filter(e=>e.mode==='walled');
      // Reuse exactly the visible surface fragments both for clipping the
      // underlying ground and emitting plateau tops. Flat cuts must not leave
      // invisible ground holes or overlapping faces after a subtraction.
      const terraceBounds=terraces.flatMap(edit=>
        (window.ConquerTerraforming?.visibleTerracePieces?.(edit)||[edit.top]).map(top=>{
          const xs=top.map(p=>p.x),ys=top.map(p=>p.y);
          return{edit,top,minX:Math.min(...xs),maxX:Math.max(...xs),
            minY:Math.min(...ys),maxY:Math.max(...ys)};
        }));
      const flatBounds=terraformEdits.filter(edit=>edit.mode==='flat').map(edit=>{
        const xs=edit.top.map(p=>p.x),ys=edit.top.map(p=>p.y);
        return{edit,minX:Math.min(...xs),maxX:Math.max(...xs),
          minY:Math.min(...ys),maxY:Math.max(...ys)};
      });
      // Broadphase: register edit bounds in 8U buckets once. A 100×100U
      // 0.5U terrain rebuild has 40,000 cells; almost all must bypass CSG
      // clipping entirely instead of scanning every authored polygon.
      const BIN=8,bins=new Map(),binKey=(x,y)=>x+','+y;
      const register=(bound,kind)=>{
        const x0=Math.floor(bound.minX/BIN),x1=Math.floor(bound.maxX/BIN);
        const y0=Math.floor(bound.minY/BIN),y1=Math.floor(bound.maxY/BIN);
        for(let ix=x0;ix<=x1;ix++)for(let iy=y0;iy<=y1;iy++){
          const key=binKey(ix,iy);
          if(!bins.has(key))bins.set(key,{flat:[],terrace:[]});
          bins.get(key)[kind].push(bound);
        }
      };
      flatBounds.forEach(bound=>register(bound,'flat'));
      terraceBounds.forEach(bound=>register(bound,'terrace'));
      const EMPTY_NEAR={flat:[],terrace:[]};
      const touching=(item,x0,y0,x1,y1)=>
        item.minX<=x1&&item.maxX>=x0&&item.minY<=y1&&item.maxY>=y0;
      const nearCell=(x0,y0,x1,y1)=>{
        const bx0=Math.floor(x0/BIN),by0=Math.floor(y0/BIN);
        const bx1=Math.floor(x1/BIN),by1=Math.floor(y1/BIN);
        // Almost every cell belongs to a single spatial bucket.
        if(bx0===bx1&&by0===by1){
          const bucket=bins.get(binKey(bx0,by0));
          if(!bucket)return EMPTY_NEAR;
          return{flat:bucket.flat.filter(item=>touching(item,x0,y0,x1,y1)),
            terrace:bucket.terrace.filter(item=>touching(item,x0,y0,x1,y1))};
        }
        const selectedFlat=new Set(),selectedTerrace=new Set();
        for(let ix=bx0;ix<=bx1;ix++)for(let iy=by0;iy<=by1;iy++){
          const bucket=bins.get(binKey(ix,iy));
          if(!bucket)continue;
          for(const item of bucket.flat)
            if(touching(item,x0,y0,x1,y1))selectedFlat.add(item);
          for(const item of bucket.terrace)
            if(touching(item,x0,y0,x1,y1))selectedTerrace.add(item);
        }
        return selectedFlat.size||selectedTerrace.size?
          {flat:[...selectedFlat],terrace:[...selectedTerrace]}:EMPTY_NEAR;
      };
      const gridHeights=new Map();
      const sampleHeight=p=>{
        const key=p.x+','+p.y;
        if(gridHeights.has(key))return gridHeights.get(key);
        const z=window.ConquerTerraforming.elevationAt(
          p,terrainBaseElevation(p),{excludeWalled:true});
        gridHeights.set(key,z);
        return z;
      };
      // Cut the ground exactly at terrace edges. Sampling a height discontinuity
      // would create diagonal triangles instead of a vertical masonry wall.
      const halfPlane=(poly,a,b,inside)=>{
        const result=[],side=p=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
        for(let i=0;i<poly.length;i++){
          const p=poly[i],q=poly[(i+1)%poly.length],dp=side(p),dq=side(q);
          const pin=inside?dp>=0:dp<=0,qin=inside?dq>=0:dq<=0;
          if(pin)result.push(p);
          if(pin!==qin){const t=dp/(dp-dq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:p.z+(q.z-p.z)*t})}
        }
        return result;
      };
      const emit=poly=>{for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i],poly[i+1]])push(p.x,p.y,p.z)};
      const ground=(tri,near)=>{
        if(!near.flat.length&&!near.terrace.length){emit(tri);return;}
        let pieces=[tri],nearFlat=false;
        // The ground must be cut exactly on every Flat edge. Without this
        // split, the .5U grid bridges the H0 hole with a diagonal ramp,
        // leaving a gap or hiding the new vertical retaining wall.
        for(const {edit,minX,maxX,minY,maxY} of near.flat){
          if(tri.every(p=>p.x<minX)||tri.every(p=>p.x>maxX)||
             tri.every(p=>p.y<minY)||tri.every(p=>p.y>maxY))continue;
          nearFlat=true;
          const next=[];
          for(const piece of pieces){
            let inner=piece;
            for(let i=0;i<edit.top.length&&inner.length>=3;i++){
              const a=edit.top[i],b=edit.top[(i+1)%edit.top.length];
              const outside=halfPlane(inner,a,b,false);
              if(outside.length>=3)next.push(outside);
              inner=halfPlane(inner,a,b,true);
            }
            if(inner.length>=3)next.push(inner);
          }
          pieces=next;
        }
        for(const {top,minX,maxX,minY,maxY} of near.terrace){
          if(tri.every(p=>p.x<minX)||tri.every(p=>p.x>maxX)||
             tri.every(p=>p.y<minY)||tri.every(p=>p.y>maxY))continue;
          const next=[];
          for(const piece of pieces){
            let inner=piece;
            for(let i=0;i<top.length&&inner.length>=3;i++){
              const a=top[i],b=top[(i+1)%top.length];
              const outside=halfPlane(inner,a,b,false);
              if(outside.length>=3)next.push(outside);
              inner=halfPlane(inner,a,b,true);
            }
          }
          pieces=next;
        }
        for(const poly of pieces){
          if(!nearFlat){emit(poly);continue;}
          const centroid={x:poly.reduce((v,p)=>v+p.x,0)/poly.length,
            y:poly.reduce((v,p)=>v+p.y,0)/poly.length};
          // A vertex exactly on the seam has two heights. Evaluate it just
          // inside its own polygon fragment to keep both sides discontinuous.
          emit(poly.map(p=>{
            const dx=centroid.x-p.x,dy=centroid.y-p.y,L=Math.hypot(dx,dy)||1;
            const q={x:p.x+dx/L*.002,y:p.y+dy/L*.002};
            return{...p,z:window.ConquerTerraforming.elevationAt(
              q,terrainBaseElevation(q),{excludeWalled:true})};
          }));
        }
      };
      // Visible plateau fragments are already clipped and non-overlapping.
      const drawTerraceTops=()=>{
        for(const {edit,top} of terraceBounds)emit(top.map(p=>({...p,z:edit.targetZ})));
      };
      // Once the player edits elevation, sample the single authoritative terrainElevation
      // contract. A denser build-area grid preserves terrace and excavation silhouettes;
      // the untouched world buffer stays coarse to limit upload cost.
      const grid=(x0,y0,x1,y1,step)=>{
        for(let y=y0;y<y1-1e-6;y+=step)for(let x=x0;x<x1-1e-6;x+=step){
          const xa=Math.min(x1,x+step),ya=Math.min(y1,y+step);
          const p00={x,y},p10={x:xa,y},p11={x:xa,y:ya},p01={x,y:ya};
          for(const p of [p00,p10,p11,p01])p.z=sampleHeight(p);
          const near=nearCell(x,y,xa,ya);
          ground([p00,p10,p11],near);ground([p00,p11,p01],near);
        }
      };
      grid(0,0,W,BUILD_MIN,2);
      grid(0,BUILD_MAX,W,W,2);
      grid(0,BUILD_MIN,BUILD_MIN,BUILD_MAX,2);
      grid(BUILD_MAX,BUILD_MIN,W,BUILD_MAX,2);
      grid(BUILD_MIN,BUILD_MIN,BUILD_MAX,BUILD_MAX,.5);
      drawTerraceTops();
      return new Float32Array(v);
    }
    for(const [x,y] of [[0,0],[W,0],[W,W],[0,0],[W,W],[0,W]])push(x,y,0);
    for(const level of reliefLevels()){
      const top=level.top||[];if(top.length<3)continue;
      const tri=earcut(top);
      for(let i=0;i<tri.length;i+=3)clipped([tri[i],tri[i+1],tri[i+2]].map(k=>({x:top[k].x,y:top[k].y,z:level.z1})));
      for(const band of reliefEdgeBands(level)){
        const [oa,ob,b,a]=band.poly;
        clipped([{...oa,z:band.z0},{...ob,z:band.z0},{...b,z:band.z1}]);
        clipped([{...oa,z:band.z0},{...b,z:band.z1},{...a,z:band.z1}]);
      }
    }
    return new Float32Array(v);
  }
  // Mountains as raised fans (drawRaisedFan): outline on the ground, apex 3.6U over the centre,
  // faces alternating the same two tones. The ground bake only shows them from above.
  const MOUNTAIN_HEIGHT=3.6,MOUNTAIN_FACES=['#55493d','#66584a'];
  function buildMountains(){
    const m=meshBuilder();
    for(const f of State.environment||[]){
      if(f.type!=='mountain'||!(f.points?.length>=3))continue;
      const apex={x:f.x,y:f.y,z:f.height||MOUNTAIN_HEIGHT};
      // Rock up to the snow line (75% of the height), snow cap above it.
      // Map-wide snow line (75% of the tallest summit): lower peaks may stay bare.
      const k=typeof mountainSnowZ==='function'?Math.min(1,mountainSnowZ()/apex.z):1,s=p=>({x:f.x+(p.x-f.x)*(1-k),y:f.y+(p.y-f.y)*(1-k),z:apex.z*k});
      for(let i=0;i<f.points.length;i++){
        const a=f.points[i],b=f.points[(i+1)%f.points.length];
        const rock=typeof mountainFaceColor==='function'?mountainFaceColor(f,a,b,i):MOUNTAIN_FACES[i%2];
        m.face([{x:a.x,y:a.y,z:0},{x:b.x,y:b.y,z:0},s(b),s(a)],rock);
        if(k<1)m.face([s(a),s(b),apex],mountainSnowColor(f,a,b,i));
      }
    }
    return new Float32Array(m.tris);
  }
  // Vertical cross-section closing hills where the map edge cuts them: follows the terrain
  // height along each border so the section meets the clipped surface.
  const EDGE_STEP=.1,EDGE_SECTION=['#5d5144','#4e443a'];
  function buildTerrainEdges(){
    const m=meshBuilder(),W=WORLD,n=Math.round(W/EDGE_STEP);
    for(const edit of window.ConquerTerraforming?.edits?.()||[]){
      if(edit.mode==='walled'){
        for(let i=0;i<edit.top.length;i++){
          const segments=window.ConquerTerraforming?.exposedWallSegments?.(edit,i)||
            [{a:edit.top[i],b:edit.top[(i+1)%edit.top.length]}];
          for(const {a,b} of segments)
            m.face([{...a,z:edit.baseZ},{...b,z:edit.baseZ},{...b,z:edit.targetZ},{...a,z:edit.targetZ}],i%2?'#49443f':'#686057');
        }
      }else if(edit.mode==='flat'){
        for(const {a,b,baseZ,baseZB,targetZ,targetZB} of window.ConquerTerraforming?.flatWallSegments?.(edit)||[])
          m.face([{...a,z:baseZ},{...b,z:baseZB},{...b,z:targetZB},{...a,z:targetZ}],'#686057');
      }
    }
    const borders=[t=>({x:t,y:0}),t=>({x:W,y:t}),t=>({x:W-t,y:W}),t=>({x:0,y:W-t})];
    borders.forEach((at,side)=>{
      let prev=at(0),hp=terrainElevation(prev);
      for(let i=1;i<=n;i++){
        const p=at(i*EDGE_STEP),h=terrainElevation(p);
        if(hp>.001||h>.001)m.face([{...prev,z:0},{...p,z:0},{...p,z:h},{...prev,z:hp}],EDGE_SECTION[side%2]);
        prev=p;hp=h;
      }
    });
    return new Float32Array(m.tris);
  }
  // Bake the existing 2D ground drawing in plan view (rotation 0) into a TEX_SIZE² canvas covering
  // [x0,x0+size]². With `tile` ({ox,oy}) only that TILE_PX² window of the same texture is painted:
  // the mapping stays the full texture's, translated, so repeating ground patterns line up across tiles.
  function bakeGround(x0,y0,size,tile=null){
    const N=tile?TILE_PX:TEX_SIZE,ox=tile?.ox||0,oy=tile?.oy||0;
    const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
    const keepView=State.view,keepRect=wrap.getBoundingClientRect,keepTrees=forestTreeSpritesReady,keepFences=urbanFenceSegments;
    const px=TEX_SIZE/size;
    State.view={...keepView,plan:true,rotation:0,scale:px/U,x:-x0*px,y:-y0*px};
    wrap.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:ox+N,bottom:oy+N,width:ox+N,height:oy+N});
    forestTreeSpritesReady=false;           // trees become 3D billboards, not ground paint
    urbanFenceSegments=()=>[];              // fences, walls and hedges become 3D geometry / billboards
    // World window actually painted, for culling roads and fields.
    const wx0=x0+ox/px,wy0=y0+oy/px,wsize=N/px;
    const inside=s=>{if(!tile)return true;const b=groundItemBounds(s);return !b||(b.x0<wx0+wsize&&b.x1>wx0&&b.y0<wy0+wsize&&b.y1>wy0)};
    // The landscape culls against [0,width]² of the rect, which for a translated tile still holds
    // everything above and left of it: a far tile would cost a full bake. Cull to the tile instead.
    const keepCull=[screenPointVisibleRaw,screenPolygonVisible,forestLikelyVisible];
    if(tile){
      const hit=(ax,ay,bx,by,m)=>bx>=ox-m&&by>=oy-m&&ax<=ox+N+m&&ay<=oy+N+m;
      screenPointVisibleRaw=(p,z=0,pad=72)=>{const q=w2sRaw(p,z);return hit(q.x,q.y,q.x,q.y,pad+staticCullOverscan())};
      screenPolygonVisible=(poly,pad=72)=>{
        if(!poly?.length)return false;
        let ax=Infinity,ay=Infinity,bx=-Infinity,by=-Infinity;
        for(const p of poly){ax=Math.min(ax,p.x);ay=Math.min(ay,p.y);bx=Math.max(bx,p.x);by=Math.max(by,p.y)}
        return hit(ax,ay,bx,by,pad+staticCullOverscan());
      };
      forestLikelyVisible=(f,pad=100)=>{
        const p={x:Number(f.x)||0,y:Number(f.y)||0},s=w2sRaw(p,terrainElevation(p));
        return hit(s.x,s.y,s.x,s.y,Math.hypot(f.rx||5,f.ry||4)*1.4*U*State.view.scale*1.55+pad+staticCullOverscan());
      };
    }
    try{
      g.translate(-ox,-oy);
      withRenderContext(g,()=>{
        g.fillStyle='#202419';g.fillRect(ox,oy,N,N);
        drawTerrain();drawEnvironment();
        // Roads/fields are the bulk of the bake: a tile only paints those overlapping it. They are drawn
        // with the preview alpha (.58): the 3D ground has always looked so, since forEach passed the index
        // as `preview` (only the first item was opaque). Explicit now, so a tile matches the full bake.
        State.structures.filter(s=>(s.type==='road'||(s.auto&&s.type==='field'))&&!underConstruction(s)&&inside(s))
          .forEach(s=>drawAutoStructure(s,true));
        drawPuddleLayer();drawUrbanLots();window.ConquerCrossings?.drawGround();
      });
    }finally{
      State.view=keepView;wrap.getBoundingClientRect=keepRect;forestTreeSpritesReady=keepTrees;urbanFenceSegments=keepFences;
      [screenPointVisibleRaw,screenPolygonVisible,forestLikelyVisible]=keepCull;
    }
    return c;
  }
  function uploadTexture(gl,name,source){
    let t=S.tex[name];if(!t){t=gl.createTexture();S.tex[name]=t}
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    if(S.aniso)gl.texParameterf(gl.TEXTURE_2D,S.aniso.TEXTURE_MAX_ANISOTROPY_EXT,8);
  }

  // ---------- incremental ground re-bake ----------
  // A full bake of both ground textures costs 200+ ms. While the settlement grows, only the tiles
  // around what changed are re-baked, one per frame, and patched in with texSubImage2D.
  const GROUND_TEX=[{name:'world',x0:0,y0:0,size:WORLD},{name:'detail',x0:DETAIL.x0,y0:DETAIL.y0,size:DETAIL.size}];
  const TILE_PX=512,TILES=TEX_SIZE/TILE_PX,GROUND_PAD_U=4,GROUND_TILE_LIMIT=24;
  S.groundQueue=[];
  function groundItemBounds(s){
    const pts=[];
    for(const p of [s,s.a,s.b])if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y))pts.push(p);
    for(const p of s.points||[])if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))pts.push(p);
    if(!pts.length)return null;
    const r=Math.max(Number(s.r)||0,Number(s.size)||0,Number(s.width)||0,Number(s.w)||0,Number(s.h)||0)*.75+GROUND_PAD_U;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const p of pts){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y)}
    return{x0:x0-r,y0:y0-r,x1:x1+r,y1:y1+r};
  }
  // Per-item hashes of everything the ground bake paints from structures (the 'ground' signature
  // category) and of the urban lots, with the same fields groundLotsSignature() watches.
  function groundItems(){
    const out=new Map(),hash=str=>{let h=0;for(let i=0;i<str.length;i++)h=(Math.imul(h,31)+str.charCodeAt(i))|0;return h};
    const byId=new Map();
    for(const s of State.structures){
      byId.set(s.id,s);
      if(!SIG_CATEGORIES[0].test(s))continue;
      out.set(s.id,{h:hash(structureKey(s)+'|'+(s.w??'')+'|'+(s.h??'')+'|'+(s.points?.length||0)),b:groundItemBounds(s)});
    }
    try{
      for(const lot of urbanLots()){
        const s=byId.get(lot.civicId||lot.houseId);
        const key=JSON.stringify([lot.civicId,s?.type,!!(s?.auto||s?.urbanRedeveloped)&&houseLevel(s)>=3,
          window.ConquerLivestock?.lotKindForHouse(s),lot.points]);
        out.set('lot:'+(lot.civicId||lot.houseId),{h:hash(key),b:groundItemBounds({points:lot.points})});
      }
    }catch{}
    return out;
  }
  function changedGroundRects(prev,next){
    const rects=[];
    for(const [id,v] of next){const o=prev.get(id);if(!o||o.h!==v.h){if(v.b)rects.push(v.b);if(o?.b)rects.push(o.b)}}
    for(const [id,o] of prev)if(!next.has(id)&&o.b)rects.push(o.b);
    return rects;
  }
  // The terrain shader samples the world texture only outside the detail rect: world tiles lying
  // inside it (1U margin for mipmap footprints) are never seen and wait for the next full bake.
  const hiddenUnderDetail=(x0,y0,tileU)=>x0>=DETAIL.x0+1&&y0>=DETAIL.y0+1&&x0+tileU<=DETAIL.x0+DETAIL.size-1&&y0+tileU<=DETAIL.y0+DETAIL.size-1;
  function queueGroundTiles(rects){
    const pending=new Set(S.groundQueue.map(t=>t.key));
    for(const tex of GROUND_TEX){
      const tileU=tex.size/TILES;
      for(let ty=0;ty<TILES;ty++)for(let tx=0;tx<TILES;tx++){
        const x0=tex.x0+tx*tileU,y0=tex.y0+ty*tileU,key=tex.name+':'+tx+':'+ty;
        if(pending.has(key)||tex.name==='world'&&hiddenUnderDetail(x0,y0,tileU))continue;
        if(!rects.some(r=>r.x0<x0+tileU&&r.x1>x0&&r.y0<y0+tileU&&r.y1>y0))continue;
        S.groundQueue.push({key,tex:tex.name,x0:tex.x0,y0:tex.y0,size:tex.size,ox:tx*TILE_PX,oy:ty*TILE_PX});pending.add(key);
      }
    }
  }
  function bakeGroundFull(gl){
    for(const t of GROUND_TEX)uploadTexture(gl,t.name,bakeGround(t.x0,t.y0,t.size));
    S.groundQueue=[];
  }
  // One tile per frame: a tile costs a few ms, the whole queue of a typical edit (2-6 tiles) is gone
  // before the construction site is noticed. Mipmaps of a 4096² texture are rebuilt once, when its
  // last queued tile is in (until then the minified levels show the previous ground for a few frames).
  function pumpGroundTiles(gl){
    const t=S.groundQueue.shift();if(!t)return;
    const t0=performance.now(),c=bakeGround(t.x0,t.y0,t.size,t);
    gl.bindTexture(gl.TEXTURE_2D,S.tex[t.tex]);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texSubImage2D(gl.TEXTURE_2D,0,t.ox,t.oy,gl.RGBA,gl.UNSIGNED_BYTE,c);
    if(!S.groundQueue.some(q=>q.tex===t.tex))gl.generateMipmap(gl.TEXTURE_2D);
    S.stats.groundTiles=(S.stats.groundTiles||0)+1;S.stats.groundTileMs=performance.now()-t0;
    // The running clock redraws continuously; when paused, ask for the frames that finish the queue.
    if(S.groundQueue.length&&!(State.clock?.speed>0)&&!S.groundRaf)
      S.groundRaf=requestAnimationFrame(()=>{S.groundRaf=0;if(active())draw()});
  }

  // ---------- buildings (non-castle) ----------
  const WINTER_ROOF=['#e7ece8','#dce3de'];
  function buildBuildings(){
    const m=meshBuilder(true),winter=State.season==='winter';
    // Houses: urbanHouseFaces gives walls, then either 2 slopes + 2 gables or a turret cone.
    for(const entry of urbanHouseGeometry()){
      const house=entry.house;if(underConstruction(house))continue;
      withStructureVisualMaterial(house,()=>addHouse(m,entry,winter));
    }
    // Urban boundaries (urbanFenceSegments): fences and low walls as solids, hedges are billboards.
    for(const e of urbanFenceSegments()){
      const dx=e.b.x-e.a.x,dy=e.b.y-e.a.y,L=Math.hypot(dx,dy);if(L<1e-4)continue;
      const ang=Math.atan2(dy,dx),mid={x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2},g=terrainElevation(mid);
      if(e.material==='wall'){                                                  // drawUrbanWall
        m.prism(rectWorldPoints(mid.x,mid.y,L,.13,ang),g,g+.36,winter?'#e5e9df':'#a3937a','#766a59','#8b7c67');
      }else if(e.material!=='hedge'){                                           // drawUrbanFence
        for(const z of [.13,.30])m.prism(rectWorldPoints(mid.x,mid.y,L,.035,ang),g+z-.018,g+z+.018,'#806442','#6b5338','#806442');
        const count=Math.max(1,Math.ceil(L/.65));
        for(let i=0;i<=count;i++){const t=i/count,p={x:e.a.x+dx*t,y:e.a.y+dy*t};m.prism(rectWorldPoints(p.x,p.y,.05,.05,ang),g+.02,g+.38,'#806442','#6b5338','#806442')}
      }
    }
    for(const s of State.structures){
      if(underConstruction(s))continue;
      if(window.ConquerEvents3D?.is(s))window.ConquerEvents3D.addToBuilder(m,s);   // event venues and their setups
      else if(isCivic(s))withStructureVisualMaterial(s,()=>addCivic(m,s,winter));
      else if(isCivicAnnex(s))withStructureVisualMaterial(s,()=>addCivicAnnex(m,s,winter));
      else if(window.ConquerIndustries?.is(s)){
        const def=ConquerIndustries.definition(s),g=Number.isFinite(s.groundZ)?s.groundZ:ConquerIndustries.groundLevel(s);
        if(!window.ConquerIndustries3D?.addToBuilder(m,s,g))m.prism(ConquerIndustries.footprint(s),g,g+.35,def.color,def.edge,def.edge);
      }else if(s.type==='well')withStructureVisualMaterial(s,()=>{
        const g=terrainElevation(s);
        m.prism(rectWorldPoints(s.x,s.y,WELL_PLAZA_SIZE,WELL_PLAZA_SIZE,0),g,g+.055,'#8d816e','#655b4f','#74695a');
        m.prism(circleWorldPoints(s.x,s.y,.62,20),g+.055,g+.42,'#84796d','#4e4740','#5d554d');
        m.face(circleWorldPoints(s.x,s.y,.36,16).map(p=>({x:p.x,y:p.y,z:g+.425})),'#172023');
      });
    }
    return new Float32Array(m.tris);
  }
  // One urban house (an urbanHouseGeometry entry) into a mesh builder. Builders may offer
  // tag(kind) to learn what the next faces are (body / upper / beam / gable / roof): the
  // construction assembly (settlement-construction-assembly.js) uses it to build the
  // house piece by piece; the WebGL builder has no tag and ignores it.
  function addHouse(m,entry,winter){
    const house=entry.house,lvl=houseLevel(house);
    for(const part of entry.parts){
      if(part.kind==='outbuilding'){addOutbuilding(m,house,part,winter);continue}
      const faces=urbanHouseFaces(house,part),n=part.points.length,base=terrainElevation(part.center);
      const split=base+(part.kind==='turret'?part.floorZ:houseFloorBreak(part.bodyH));
      const bp=part.basePoints;
      for(let i=0;i<n;i++){
        const [a,b,c,d]=faces[i].map(({p,z})=>({x:p.x,y:p.y,z}));
        if(lvl===1&&part.kind!=='turret'){m.tag?.('body');m.face([a,b,c,d],i%2?'#4e392d':'#654936');continue}
        const sa={...a,z:split},sb={...b,z:split};
        // Recessed stone ground floor (basePoints) under the jettied timber floors.
        const ga=bp?{x:bp[i].x,y:bp[i].y,z:a.z}:a,gb=bp?{x:bp[(i+1)%n].x,y:bp[(i+1)%n].y,z:b.z}:b;
        m.tag?.('body');m.face([ga,gb,{...gb,z:split},{...ga,z:split}],i%2?'#4f4b47':'#625e59');
        m.tag?.('upper');m.face([sa,sb,c,d],i%2?'#c8ae70':'#e0ca91');
        // Jetty underside: joists between the upper wall line and the recessed ground floor.
        m.tag?.('beam');if(bp&&(i===0||i===2))m.face([sa,sb,{...gb,z:split},{...ga,z:split}],'#4a3626');
      }
      const roof=f=>f.map(({p,z})=>({x:p.x,y:p.y,z}));
      m.tag?.('roof');
      if(part.kind==='turret'){
        for(let i=n;i<faces.length;i++)m.face(roof(faces[i]),winter?WINTER_ROOF[i%2]:(i%2?'#303943':'#394550'));
      }else{
        const rA=winter?WINTER_ROOF[0]:lvl===1?HOUSE_THATCH.a:'#303237',rB=winter?WINTER_ROOF[1]:lvl===1?HOUSE_THATCH.b:'#3a3d42';
        const gable=lvl===1?'#654936':'#d9c184';
        m.face(roof(faces[n]),rA);m.face(roof(faces[n+1]),rB);
        m.tag?.('gable');m.face(roof(faces[n+2]),gable);m.face(roof(faces[n+3]),gable);
      }
    }
    // L4 dormers (urbanHouseDormers): cream front and cheeks, slate gable roof.
    const dormerColors={front:'#e0ca91',cheek:'#c8ae70',gable:'#d9c184',
      roofA:winter?WINTER_ROOF[0]:'#303237',roofB:winter?WINTER_ROOF[1]:'#3a3d42'};
    m.tag?.('roof');
    for(const dormer of entry.dormers||[]){
      const g=terrainElevation(dormer.partCenter);
      for(const f of dormer.faces)m.face(f.pts.map(({p,z})=>({x:p.x,y:p.y,z:g+z})),dormerColors[f.kind]);
    }
    for(const c of chimneySpecs(house)){
      const g=terrainElevation(c.center);
      m.prism(rectWorldPoints(c.center.x,c.center.y,.22,.20,c.angle||0),g+c.z0,g+c.z1,'#3b302c','#332824','#493732');
    }
  }
  // L3/L4 yard outbuildings (urbanLotOutbuildings), same palette as drawUrbanOutbuilding.
  function addOutbuilding(m,house,part,winter){
    const faces=urbanHouseFaces(house,part),n=part.points.length,P=f=>f.map(({p,z})=>({x:p.x,y:p.y,z}));
    const roofA=winter?WINTER_ROOF[0]:'#5b3d30',roofB=winter?WINTER_ROOF[1]:'#6b4938';
    if(part.type==='store'){
      m.tag?.('body');for(let i=0;i<n;i++)m.face(P(faces[i]),i%2?'#5d4431':'#71543c');
      m.tag?.('roof');m.face(P(faces[n]),roofA);m.face(P(faces[n+1]),roofB);
      m.tag?.('gable');m.face(P(faces[n+2]),'#6b4f39');m.face(P(faces[n+3]),'#6b4f39');
      return;
    }
    const c=part.center,sa=Math.sin(part.roofAngle),ca=Math.cos(part.roofAngle),base=terrainElevation(c);
    const ly=p=>-(p.x-c.x)*sa+(p.y-c.y)*ca;
    // The courtyard side is open, so a lean-to has fewer than n walls: the roof is the last face.
    const walls=faces.slice(0,-1),roof=faces[faces.length-1];
    m.tag?.('body');for(const wall of walls)if(wall.slice(0,2).every(v=>Math.abs(ly(v.p)+part.h/2)<1e-6))m.face(P(wall),'#5d4431');
    m.tag?.('roof');m.face(P(roof),roofB);
    m.tag?.('beam');
    for(const t of part.w>1.3?[-.5,0,.5]:[-.5,.5]){
      const x=t*(part.w-.08),y=part.h/2-.04,p={x:c.x+x*ca-y*sa,y:c.y+x*sa+y*ca};
      m.prism(rectWorldPoints(p.x,p.y,.07,.07,part.roofAngle),base,base+part.bodyH,'#4a3626','#3d2c1f','#4a3626');
    }
  }
  function addCivicAnnex(m,s,winter){
    const spec=civicAnnexDefinition(s);if(!spec)return;
    const g=Number.isFinite(s.groundZ)?s.groundZ:terrainElevation(s),kind=spec.kind,poly=civicAnnexFootprint(s);
    if(window.ConquerCivic3D?.addToBuilder(m,s,g))return;
    const height=kind==='garden'?.13:kind==='yard'?.09:kind==='stall'?.75:1.32;
    const color=kind==='garden'?'#6a8452':kind==='yard'?'#ad9a7a':kind==='stone'?'#85847d':'#9b7c57';
    m.prism(poly,g,g+height,color,kind==='stone'?'#696862':'#79563b',kind==='stone'?'#777671':'#876446');
    if(kind==='garden'){
      for(const offset of [-.45,0,.45]){
        const p=houseLocalToWorld(s,offset,0);
        m.prism(rectWorldPoints(p.x,p.y,.08,1.4,s.angle||0),g+.13,g+.19,'#426738','#385d30','#426738');
      }
    }else if(kind!=='yard'&&kind!=='stall'){
      const roof=winter?WINTER_ROOF[0]:kind==='stone'?'#595a60':'#694a38';
      m.gabled({x:s.x,y:s.y},spec.w,spec.h,0,s.angle||0,g+height,.001,.34,color,color,roof,roof,color);
    }
  }
  function addCivic(m,s,winter){
    const g=Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s),angle=s.angle||0;
    const L=(x,y)=>houseLocalToWorld(s,x,y);
    if(window.ConquerCivic3D?.addToBuilder(m,s,g))return;   // Blender model (+ cemetery)
    for(const part of civicParts(s)){
      const turn=part.roofTurn||0;
      if(s.type==='market'){
        m.prism(part.points,g,g+.12,'#9a876b','#665847','#756451');
        const canopy=['#8c4f37','#b18a3f','#536d76','#6f6941'];let k=0;
        for(const sx of [-1,1])for(const sy of [-1,1]){
          const c=L(sx*1.05,sy*1.0);
          m.prism(rectWorldPoints(c.x,c.y,1.15,.72,angle),g+.12,g+.46,'#654b34','#4b3826','#5a4430');
          m.prism(rectWorldPoints(c.x,c.y,1.38,.92,angle),g+.58,g+.66,canopy[k%4],canopy[k%4],canopy[k%4]);k++;
        }
      }else if(s.type==='plaza'){
        const level=civicLevel(s),variant=plazaVariant(s);
        m.prism(part.points,g,g+.10,
          variant==='garden'?'#8c9776':variant==='fountain'?'#a5a9a8':'#b3a28e',
          '#777269','#868076');
        if(variant==='garden'){
          for(const x of [-1.08,1.08])for(const y of [-1.08,1.08]){
            const c=L(x,y);
            m.prism(rectWorldPoints(c.x,c.y,1.15,1.15,angle),g+.10,g+.15,'#698555','#80725b','#80725b');
          }
        }else{
          const c=L(0,0),size=variant==='fountain'?1.45:1.25;
          m.prism(rectWorldPoints(c.x,c.y,size,size,angle),g+.10,g+(variant==='fountain'?.29:.135),
            variant==='fountain'?'#697e82':'#c2b7a4','#787c7b','#8c9190');
          if(variant==='fountain')m.prism(rectWorldPoints(c.x,c.y,.65,.65,angle),g+.29,g+.35+level*.12,
            '#b3b8b5','#858c89','#969e9b');
          else if(level>=3)m.prism(rectWorldPoints(c.x,c.y,.45,.45,angle),g+.135,g+.60,
            '#c0b7a9','#827b72','#938a80');
        }
        if(level>=2)for(const x of [-2,2])for(const y of [-2,2]){
          const c=L(x,y);
          m.prism(rectWorldPoints(c.x,c.y,.24,.24,angle),g+.10,g+.27,'#a49c8c','#696659','#777164');
        }
      }else if(s.type==='training'){
        m.prism(part.points,g,g+.10,'#70502e','#5a3f24','#664729');
        for(const sx of [-1,1])for(const sy of [-1,1]){const c=L(sx*2.18,sy*1.68);m.prism(rectWorldPoints(c.x,c.y,.14,.14,angle),g+.10,g+.58,'#654b34','#4b3826','#5a4430')}
      }else if(s.type==='tavern'){
        const rA=winter?WINTER_ROOF[0]:'#3b302b',rB=winter?WINTER_ROOF[1]:'#493930';
        m.gabled(part.center,part.w,part.h,turn,angle+turn,g,1.48,2.08,'#684f3d','#7b5e48',rA,rB,'#80624a');
      }else if(s.type==='church'){
        if(part.role==='tower'){
          m.prism(part.points,g,g+2.72,'#676a6c','#5a5d5f','#676a6c');
          m.gabled(part.center,part.w,part.h,turn,angle+turn,g+2.72,0.001,.63,'#676a6c','#676a6c',winter?WINTER_ROOF[0]:'#3d4145',winter?WINTER_ROOF[1]:'#484c50','#676a6c');
        }else{
          m.gabled(part.center,part.w,part.h,turn,angle+turn,g,1.88,2.52,'#6b6863','#7d7973',winter?WINTER_ROOF[0]:'#41454a',winter?WINTER_ROOF[1]:'#4c5054','#85817a');
        }
      }
    }
    if(s.type==='church')addCivicCemetery(m,s,g);
  }
  function addCivicCemetery(m,church,ground){
    const area=civicCemeteryArea(church);if(!area)return;
    m.prism(area.points,ground,ground+.035,'#827b69','#665e51','#756d5d');
    for(const grave of civicCemeteryGraves(church)){
      m.prism(grave.points,ground+.035,ground+.08,'#675c4f','#4b443c','#5b5146');
      const head=houseLocalToWorld({x:grave.center.x,y:grave.center.y,angle:grave.angle},0,-.23);
      m.prism(rectWorldPoints(head.x,head.y,.25,.14,grave.angle),
        ground+.08,ground+.39,'#b5b1a6','#78766f','#96928b');
    }
  }

  // ---------- trees (billboards) ----------
  const ATLAS_TILE=128,ATLAS_COLS=8;
  function buildTreeAtlas(){
    if(!forestTreeSpritesReady)return null;
    const season=State.season==='autumn'?'autumn':State.season==='winter'?'winter':'summer';
    const sets=forestTreeSprites[season]||[],tiles=[];
    sets.forEach((byColor,shape)=>(byColor||[]).forEach((img,color)=>img&&tiles.push({key:shape+':'+color,img,aspect:1})));
    // Hedge bushes (drawUrbanHedge): 920x580 sprites.
    (window.boundaryBushSprites?.[season]||(typeof boundaryBushSprites!=='undefined'?boundaryBushSprites[season]:[])||[])
      .forEach((img,shape)=>img&&tiles.push({key:'bush:'+shape,img,aspect:580/920}));
    // Mountain pines (96x128 canvases), two tones.
    if(typeof mountainPineSprite==='function')for(const v of [0,1])tiles.push({key:'pine:'+v,img:mountainPineSprite(v,season==='winter'),aspect:1,pine:true});
    const rows=Math.ceil(tiles.length/ATLAS_COLS)||1,c=document.createElement('canvas');
    c.width=ATLAS_COLS*ATLAS_TILE;c.height=rows*ATLAS_TILE;const g=c.getContext('2d'),map=new Map();
    tiles.forEach((t,i)=>{const x=(i%ATLAS_COLS)*ATLAS_TILE,y=Math.floor(i/ATLAS_COLS)*ATLAS_TILE,h=Math.round(ATLAS_TILE*t.aspect);
      // Pines keep their 3:4 shape centred in the square tile.
      if(t.pine)g.drawImage(t.img,x+ATLAS_TILE*.125,y,ATLAS_TILE*.75,h);else g.drawImage(t.img,x,y,ATLAS_TILE,h);
      map.set(t.key,[x/c.width,y/c.height,(x+ATLAS_TILE)/c.width,(y+h)/c.height])});
    return{canvas:c,map,season};
  }
  function buildTrees(atlas){
    const v=[];if(!atlas)return new Float32Array(0);
    const groves=(State.environment||[]).filter(f=>f.type==='forest').map(forestTreeLayout);
    groves.push(urbanLotCornerTrees());                  // single trees on plot corners
    for(const trees of groves){
      for(const t of trees){
        const uv=atlas.map.get(t.shapeIndex+':'+(atlas.season==='winter'?0:t.colorIndex));if(!uv)continue;
        let [u0,v0,u1,v1]=uv;if(t.flip)[u0,u1]=[u1,u0];
        const size=2.25*t.scale,z=t.z||0;
        const C=[[-.5,-.94,u0,v0],[.5,-.94,u1,v0],[.5,.06,u1,v1],[-.5,.06,u0,v1]];
        for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(t.p.x,t.p.y,z,cx,cy,size,u,w)}
      }
    }
    // Pines on the lower half of the mountains, standing on the cone surface.
    for(const f of State.environment||[]){
      if(f.type!=='mountain'||!f.height||typeof mountainPineLayout!=='function')continue;
      for(const t of mountainPineLayout(f)){
        const uv=atlas.map.get('pine:'+t.shade);if(!uv)continue;
        let [u0,v0,u1,v1]=uv;if(t.flip)[u0,u1]=[u1,u0];
        const size=2.4*t.scale,C=[[-.5,-.97,u0,v0],[.5,-.97,u1,v0],[.5,.03,u1,v1],[-.5,.03,u0,v1]];
        for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(t.p.x,t.p.y,t.z,cx,cy,size,u,w)}
      }
    }
    for(const e of urbanFenceSegments()){
      if(e.material!=='hedge')continue;
      for(const b of urbanHedgeBushes(e)){
        const uv=atlas.map.get('bush:'+b.shape);if(!uv)continue;
        const [u0,v0,u1,v1]=uv,hr=580/920*(b.scale||1),z=terrainElevation(b.p)+.01;
        const C=[[-.5,-.97*hr,u0,v0],[.5,-.97*hr,u1,v0],[.5,.03*hr,u1,v1],[-.5,.03*hr,u0,v1]];
        for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(b.p.x,b.p.y,z,cx,cy,b.width,u,w)}
      }
    }
    return new Float32Array(v);
  }

  // ---------- facade decals (architecture PNGs + house windows/doors) ----------
  // Same placement rules as drawFacadeWindows / drawGatePortals / drawTowerDoors / drawHouseFacadeWindows,
  // but on every facade: the depth buffer decides what is visible, so the set is camera-independent.
  const DECAL_KEYS=['gatePortal','towerDoor','arrowSlit','gothicL1','gothicL2','gothicL3','arcade2','arcade3','gatePortalDamaged','gatePortalBroken','gatePortalFrame','gateBanner'];
  function buildDecalAtlas(){
    window.ConquerGates?.ensureSprites();
    const T=256,cols=4,c=document.createElement('canvas');c.width=cols*T;c.height=4*T;
    const g=c.getContext('2d'),map=new Map();
    const tiles=[...DECAL_KEYS,'__white','__glow'];
    tiles.forEach((k,i)=>{
      const x=(i%cols)*T,y=Math.floor(i/cols)*T;
      if(k==='__white'){g.fillStyle='#fff';g.fillRect(x,y,16,16);map.set(k,[(x+4)/c.width,(y+4)/c.height,(x+12)/c.width,(y+12)/c.height]);return}
      if(k==='__glow'){
        const radial=g.createRadialGradient(x+T/2,y+T/2,0,x+T/2,y+T/2,T/2-2);
        radial.addColorStop(0,'rgba(255,239,190,0.90)');
        radial.addColorStop(.22,'rgba(255,194,103,0.56)');
        radial.addColorStop(.58,'rgba(255,141,55,0.15)');
        radial.addColorStop(1,'rgba(255,141,55,0)');
        g.fillStyle=radial;g.fillRect(x+1,y+1,T-2,T-2);
        map.set(k,[(x+1)/c.width,(y+1)/c.height,(x+T-1)/c.width,(y+T-1)/c.height]);return;
      }
      const img=architectureSprite(k);if(!img)return;
      g.drawImage(img,x,y);map.set(k,[x/c.width,y/c.height,(x+img.width)/c.width,(y+img.height)/c.height]);
    });
    return{canvas:c,map};
  }
  function buildDecals(atlas){
    const v=[],lights=[],WHITE=[1,1,1,1];
    const quad=(a,b,z0,z1,key,out,col=WHITE,push=.012,dest=v)=>{
      const uv=atlas.map.get(key);if(!uv)return;
      const [u0,v0,u1,v1]=uv,A={x:a.x+out.x*push,y:a.y+out.y*push},B={x:b.x+out.x*push,y:b.y+out.y*push};
      const P=[[A,z1,u0,v0],[B,z1,u1,v0],[B,z0,u1,v1],[A,z0,u0,v1]];
      for(const k of [0,1,2,0,2,3]){const [p,z,u,w]=P[k];dest.push(p.x,p.y,z,u,w,col[0],col[1],col[2],col[3])}
    };
    const outward=(edge,c)=>{
      const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1;let nx=-dy/L,ny=dx/L;
      const mx=(edge.a.x+edge.b.x)/2-c.x,my=(edge.a.y+edge.b.y)/2-c.y;if(nx*mx+ny*my<0){nx=-nx;ny=-ny}
      return{x:nx,y:ny};
    };
    // These emissive panes and soft halos are generated only when facade geometry changes.
    // Intensity is a uniform: sunset/sunrise never recreate their buffers.
    const lightWindow=(edge,centerZ,width,height,offset,ground,out)=>{
      const halo=facadeAssetWorldSpan(edge,width*3.4,offset);
      quad(halo.a,halo.b,ground+centerZ-height*1.7,ground+centerZ+height*1.7,
        '__glow',out,[1,.67,.32,.33],.032,lights);
      const glass=facadeAssetWorldSpan(edge,width*.8,offset);
      quad(glass.a,glass.b,ground+centerZ-height*.4,ground+centerZ+height*.4,
        '__white',out,[1,.77,.38,.77],.027,lights);
    };
    const onEdge=(edge,centerZ,width,height,key,offset,ground,out)=>{
      const span=facadeAssetWorldSpan(edge,width,offset);
      quad(span.a,span.b,ground+centerZ-height/2,ground+centerZ+height/2,key,out);
      if(key.startsWith('gothic'))lightWindow(edge,centerZ,width,height,offset,ground,out);
    };
    const edgesOf=fp=>fp.map((a,i)=>({a,b:fp[(i+1)%fp.length],index:i}));
    // A beam from wall point p0 to p1 ({off,z}), `width` thick within the wall plane.
    const strip=(at,ground,p0,p1,width,out,col,push)=>{
      const uv=atlas.map.get('__white');if(!uv)return;
      const doff=p1.off-p0.off,dz=p1.z-p0.z,len=Math.hypot(doff,dz)||1,no=-dz/len*width/2,nz=doff/len*width/2;
      const corner=(p,s)=>{const c=at(p.off+no*s);return{x:c.x+out.x*push,y:c.y+out.y*push,z:ground+p.z+nz*s}};
      const P=[corner(p0,1),corner(p1,1),corner(p1,-1),corner(p0,-1)],[u0,v0,u1,v1]=uv;
      for(const k of [0,1,2,0,2,3]){const q=P[k];v.push(q.x,q.y,q.z,k===1||k===2?u1:u0,k<2?v0:v1,col[0],col[1],col[2],col[3])}
    };
    const houseGeometry=new Map(urbanHouseGeometry().map(e=>[e.house.id,e]));
    for(const s of State.structures){
      if(underConstruction(s))continue;
      if(structureCutaway(s))continue; // face decals live on the interior cutaway mesh
      const center=structureCenter(s);
      if(s.type==='tower'&&!isWoodTower(s)){
        const ground=Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
        for(const spec of towerDoorSpecs(s)){                                   // drawTowerDoorSpec
          const tier=towerTier(s),width=clamp(.38+tier*.045,.42,.54)*1.5,height=Math.max(.18,spec.apexZ-spec.baseZ)/3*1.5;
          const c=spec.contact,t=spec.tangent,half=width/2;
          quad({x:c.x-t.x*half,y:c.y-t.y*half},{x:c.x+t.x*half,y:c.y+t.y*half},ground+spec.baseZ,ground+spec.baseZ+height,'towerDoor',spec.outward);
        }
        const rows=towerWindowRows(s);
        if(s.shape==='round'){                                                   // roundTowerFacadeEdges, all four
          const iv=structureInteriorVector(s),base=Math.atan2(iv.y,iv.x),r=Math.max(.2,Number(s.r)||.5)+.006,span=Math.min(.54,r*.95);
          for(const row of rows){
            const key=towerGothicAssetForRow(s,row),sz=towerGothicAssetSizeForRow(s,row);if(!key)continue;
            for(let i=0;i<4;i++){
              const a=base+i*Math.PI/2,o={x:Math.cos(a),y:Math.sin(a)},cc={x:s.x+o.x*r,y:s.y+o.y*r},tx=-o.y,ty=o.x;
              const edge={a:{x:cc.x-tx*span/2,y:cc.y-ty*span/2},b:{x:cc.x+tx*span/2,y:cc.y+ty*span/2}};
              if(i===0){if(!towerEdgeOnDivider(s,edge,row.z))onEdge(edge,row.z,sz.w*.86,sz.h,key,0,ground,o);}
              else if(towerSlitFace(s,i,row.floor))onEdge(edge,row.z,.22,.60,'arrowSlit',0,ground,o);
            }
          }
        }else{
          const interior=interiorFacadeEdgeIndex(s);
          for(const row of rows){
            const key=towerGothicAssetForRow(s,row),sz=towerGothicAssetSizeForRow(s,row);if(!key)continue;
            for(const edge of edgesOf(footprintPoints(s))){
              const o=outward(edge,center);
              if(edge.index===interior)onEdge(edge,row.z,sz.w,sz.h,key,0,ground,o);
              else if(towerSlitFace(s,edge.index,row.floor))onEdge(edge,row.z,.22,.60,'arrowSlit',0,ground,o);
            }
          }
        }
      }else if(s.type==='gate'&&!isWoodGate(s)){
        const ground=Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
        const interior=interiorFacadeEdgeIndex(s),key=gothicAssetForLevel(s),sz=gothicAssetSizeForLevel(s);
        // Portal frames around the carved passage and the outer banners; the door leaves and
        // the portcullis are meshes (settlement-gate-fittings.js).
        const fittings=window.ConquerGates?.decalSpecs(s)||[];
        for(const d of fittings)onEdge(d.edge,d.centerZ,d.width,d.height,d.key,d.offset,ground,d.edge.normal);
        for(const edge of edgesOf(footprintPoints(s))){
          const o=outward(edge,center);
          // front / rear; the door shows its state (cracked, broken in: settlement-siege.js)
          if(!fittings.length&&(edge.index===1||edge.index===3))onEdge(edge,.705,.90,1.35,window.ConquerSiege?.doorAsset?.(s)||'gatePortal',0,ground,o);
          for(const z of gateWindowRows(s)){
            if(edge.index===interior)onEdge(edge,z,sz.w,sz.h,key,0,ground,o);
            else onEdge(edge,z,.24,.62,'arrowSlit',0,ground,o);
          }
        }
      }else if(s.type==='built'){
        const l=structureLevel(s),outside=wallExteriorSide(s),inside=-outside;
        const rows=[[outside,.86,.72,'arrowSlit',.23,.58]];
        if(l>=2)rows.push([inside,2.22,.42,'gothicL3',.92,.78],[outside,2.22,.72,'arrowSlit',.23,.58]);
        for(const [side,z,density,key,aw,ah] of rows){
          const edge=linearFacadeEdge(s,side),count=Math.max(1,Math.round(edge.length*density)),cell=edge.length/count;
          const ground=terrainElevation({x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2}),o=outward(edge,center);
          for(let i=0;i<count;i++)onEdge(edge,z,Math.min(aw,cell*.82),ah,key,(i+.5)*cell-edge.length/2,ground,o);
        }
        if(builtSkin(s)==='arcade'){                                            // drawBuiltArcade, interior facade
          const edge=linearFacadeEdge(s,inside),h=Math.min(1.46,structureHeight(s)-.16);
          if(h>.18&&edge.length>=.35){
            const count=Math.max(1,Math.round(edge.length/2.55)),cell=edge.length/count,centerZ=.04+h/2,key=cell<2.25?'arcade2':'arcade3';
            const ground=terrainElevation({x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2}),o=outward(edge,center),DARK=[36/255,33/255,31/255,1];
            for(let i=0;i<count;i++){
              const off=(i+.5)*cell-edge.length/2,w=cell*.96,span=facadeAssetWorldSpan(edge,w,off);
              quad(span.a,span.b,ground+centerZ-h*.43,ground+centerZ+h*.43,'__white',o,DARK,.008);   // drawFacadeAssetBackdrop
              onEdge(edge,centerZ,w,h,key,off,ground,o);
            }
          }
        }
      }else if(s.type==='house'){
        const WIN=[35/255*.82,29/255*.82,24/255*.82,.82],TIMBER=[59/255,42/255,30/255,1];
        const entry=houseGeometry.get(s.id);
        // World-space beam from {p,z} a to b on a surface with horizontal outward normal n.
        const beam=(a,b,n,ground,push)=>{
          const uv=atlas.map.get('__white');if(!uv)return;
          const dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,dz=b.z-a.z;
          let wx=n.y*dz,wy=-n.x*dz,wz=n.x*dy-n.y*dx;const wl=Math.hypot(wx,wy,wz)||1,k=HOUSE_TIMBER_W/2/wl;wx*=k;wy*=k;wz*=k;
          const c=(q,sgn)=>({x:q.p.x+n.x*push+wx*sgn,y:q.p.y+n.y*push+wy*sgn,z:ground+q.z+wz*sgn});
          const P=[c(a,1),c(b,1),c(b,-1),c(a,-1)],[u0,v0,u1,v1]=uv;
          for(const k2 of [0,1,2,0,2,3]){const q=P[k2];v.push(q.x,q.y,q.z,k2===1||k2===2?u1:u0,k2<2?v0:v1,TIMBER[0],TIMBER[1],TIMBER[2],TIMBER[3])}
        };
        const pane=(w,ground,push)=>{
          const t=w.tangent,a={x:w.p.x-t.x*w.hw,y:w.p.y-t.y*w.hw},b={x:w.p.x+t.x*w.hw,y:w.p.y+t.y*w.hw};
          quad(a,b,ground+w.z-w.hh,ground+w.z+w.hh,'__white',w.normal,WIN,push);
          lightWindow({a:{x:w.p.x-t.x*.5,y:w.p.y-t.y*.5},b:{x:w.p.x+t.x*.5,y:w.p.y+t.y*.5}},w.z,w.hw*2,w.hh*2,0,ground,w.normal);
        };
        for(const part of entry?.parts||[]){
          if(part.kind==='turret'){
            const ground=terrainElevation(part.center),plan=houseTurretFacade(part);
            for(const b of plan.beams)beam(b.a,b.b,b.normal,ground,.015);
            for(const w of plan.windows)pane(w,ground,.022);
            continue;
          }
          if(part.kind==='outbuilding')continue;
          const ground=terrainElevation(part.center);
          for(const edge of edgesOf(part.points)){
            const o=outward(edge,part.center),m={x:(edge.a.x+edge.b.x)/2,y:(edge.a.y+edge.b.y)/2};
            const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,hw=HOUSE_WINDOW_HALF_W,hh=HOUSE_WINDOW_HALF_H;
            const plan=houseFacadePlan(s,part,edge),at=off=>({x:m.x+ux*off,y:m.y+uy*off});
            // Timber frame strips sit just under the windows (smaller wall offset).
            for(const [p0,p1] of plan.beams)strip(at,ground,p0,p1,HOUSE_TIMBER_W,o,TIMBER,.009);
            // drawWindowOnEdge: 2.1 x 3.25 px per view-scale unit -> .175U x ~.30U
            // Ground-floor openings on a jettied side sit on the recessed stone wall.
            const fb=houseFloorBreak(part.bodyH),recess=part.basePoints&&(edge.index===0||edge.index===2)?houseJetty(s):0;
            for(const w of plan.windows){
              const k=w.z<fb?recess:0,c=at(w.off),e={a:{x:edge.a.x-o.x*k,y:edge.a.y-o.y*k},b:{x:edge.b.x-o.x*k,y:edge.b.y-o.y*k}};
              quad({x:c.x-ux*hw-o.x*k,y:c.y-uy*hw-o.y*k},{x:c.x+ux*hw-o.x*k,y:c.y+uy*hw-o.y*k},ground+w.z-hh,ground+w.z+hh,'__white',o,WIN);
              lightWindow(e,w.z,hw*2,hh*2,w.off,ground,o);
            }
          }
        }
        for(const dormer of entry?.dormers||[])pane(dormer.window,terrainElevation(dormer.partCenter),.012);
        const d=houseDoorInfo(s),hw=Math.min(.08,(Number(s.w)||1.5)*.0533),g=terrainElevation(d.surface),DOOR=[57/255,39/255,30/255,1];
        const ds={x:d.surface.x-d.normal.x*houseJetty(s),y:d.surface.y-d.normal.y*houseJetty(s)};
        quad({x:ds.x-d.tangent.x*hw,y:ds.y-d.tangent.y*hw},{x:ds.x+d.tangent.x*hw,y:ds.y+d.tangent.y*hw},g+.04,g+HOUSE_DOOR_TOP,'__white',d.normal,DOOR);
      }
    }
    return{decals:new Float32Array(v),lights:new Float32Array(lights)};
  }
  // All world-space torch anchors are camera-independent: depth testing, not
  // towerDoorVisible(), decides which flames are hidden behind a tower.
  function allWorldFireSources(){
    const sources=battlementBrazierSources().concat(window.ConquerGates?.torchSources(false)||[]);
    for(const tower of State.structures){
      if(tower.type!=='tower'||underConstruction(tower))continue;
      for(const spec of towerDoorSpecs(tower)){
        if(spec.kind!=='front')continue;
        const doorTop=spec.baseZ+Math.max(.18,spec.apexZ-spec.baseZ)/3;
        for(const side of [-1,1]){
          sources.push({
            kind:'torch',id:tower.id+':torch:'+side,
            p:{
              x:spec.contact.x+spec.tangent.x*.18*side+spec.outward.x*.035,
              y:spec.contact.y+spec.tangent.y*.18*side+spec.outward.y*.035
            },
            z:doorTop+.10,groundZ:placementGroundZ(tower)
          });
        }
      }
    }
    return sources;
  }
  function buildFireLights(atlas){
    const uv=atlas.map.get('__glow'),v=[];if(!uv)return new Float32Array(v);
    const [u0,v0,u1,v1]=uv;
    for(const src of allWorldFireSources()){
      const ground=Number.isFinite(src.groundZ)?src.groundZ:terrainElevation(src.p);
      const z=ground+src.z+(src.kind==='brazier'?.08:0);
      const size=src.kind==='brazier'?2:1.5;
      const seed=(peasantHash(String(src.id)+'-fire')%1000)/1000;
      const corners=[[-.5,-.5,u0,v0],[.5,-.5,u1,v0],[.5,.5,u1,v1],[-.5,.5,u0,v1]];
      for(const i of [0,1,2,0,2,3]){
        const q=corners[i];v.push(src.p.x,src.p.y,z,q[0],q[1],size,q[2],q[3],seed);
      }
    }
    return new Float32Array(v);
  }

  // ---------- shadows ----------
  function buildShadows(){
    const sun=sunShadowState();if(!sun)return{data:new Float32Array(0),alpha:0};
    const v=[];
    for(const s of State.structures){
      if(underConstruction(s)||!['house','tower','gate','wall','palisade','built','market','tavern','church','plaza','civicAnnex'].includes(s.type))continue;
      const {fp,h}=shadowCasterGeometry(s);if(!fp?.length||h<=0)continue;
      const len=h*sun.lengthPerHeight,ox=sun.dx*len,oy=sun.dy*len,cloud=[];
      for(const p of fp){cloud.push({x:p.x,y:p.y});cloud.push({x:p.x+ox,y:p.y+oy})}
      const hull=convexHull(cloud);if(hull.length<3)continue;
      const zs=hull.map(p=>terrainElevation(p)+.03);
      for(let i=1;i<hull.length-1;i++)for(const k of [0,i,i+1])v.push(hull[k].x,hull[k].y,zs[k]);
    }
    return{data:new Float32Array(v),alpha:sun.alpha*.82};
  }

  // ---------- cutaway interiors (towers, gates, built sections opened by the player) ----------
  // The same shell as the 2.5D cutaway (far walls, cut jambs, crest ring, roof deck, floors) plus
  // the furniture library, as one depth-tested mesh: lower-floor pieces can no longer paint over
  // the floor above, and figures (billboards) sort with everything. Far-wall choice follows the
  // camera quarter-turn, so there is one mesh per rotation. Doors, slits and windows of the
  // standing walls are seen from inside; those of the removed walls are gone with them.
  function shadeHex(hex,k){
    const c=rgb(hex),lum=(c[0]+c[1]+c[2])/3,kk=lum>.7?1-(1-k)*.55:k;
    return'#'+c.map(x=>Math.round(clamp(x*kk,0,1)*255).toString(16).padStart(2,'0')).join('');
  }
  // Convex polygon clip (Sutherland–Hodgman) of a ground polygon against a convex clip polygon.
  function clipConvex(subject,clip){
    let out=subject;const area=clip.reduce((a,p,i)=>{const q=clip[(i+1)%clip.length];return a+p.x*q.y-q.x*p.y},0),sgn=area>=0?1:-1;
    for(let i=0;i<clip.length&&out.length;i++){
      const a=clip[i],b=clip[(i+1)%clip.length],inside=p=>sgn*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))>=-1e-9,src=out;out=[];
      for(let k=0;k<src.length;k++){
        const p=src[k],q=src[(k+1)%src.length],pi=inside(p),qi=inside(q);
        if(pi)out.push(p);
        if(pi!==qi){const d1=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x),d2=(b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x),t=d1/(d1-d2);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}
      }
    }
    return out;
  }
  // Parent/subtower overlap: what one structure draws is cut out of the other's footprint.
  const orient=B=>B.reduce((a,p,i)=>{const q=B[(i+1)%B.length];return a+p.x*q.y-q.x*p.y},0)>=0?1:-1;
  function clipHalf(poly,a,b,keepInside,sgn){
    const side=p=>sgn*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))*(keepInside?1:-1),out=[];
    for(let k=0;k<poly.length;k++){
      const p=poly[k],q=poly[(k+1)%poly.length],sp=side(p),sq=side(q);
      if(sp>=0)out.push(p);
      if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}
    }
    return out;
  }
  const area=P=>Math.abs(P.reduce((a,p,i)=>{const q=P[(i+1)%P.length];return a+p.x*q.y-q.x*p.y},0))/2;
  // Convex polygon minus a list of convex blockers -> convex pieces.
  function polyMinus(A,blockers){
    let pieces=[A];
    for(const B of blockers){
      const sgn=orient(B),next=[];
      for(const P of pieces){
        let rest=P;
        for(let i=0;i<B.length&&rest.length>2;i++){
          const a=B[i],b=B[(i+1)%B.length],outside=clipHalf(rest,a,b,false,sgn);
          if(outside.length>2&&area(outside)>1e-6)next.push(outside);
          rest=clipHalf(rest,a,b,true,sgn);
        }
      }
      pieces=next;
    }
    return pieces;
  }
  // Parts of segment p-q outside every convex blocker (Cyrus–Beck interval per blocker).
  function segMinus(p,q,blockers){
    let parts=[[0,1]];
    for(const B of blockers){
      const sgn=orient(B),d={x:q.x-p.x,y:q.y-p.y};let t0=0,t1=1,empty=false;
      for(let i=0;i<B.length;i++){
        const a=B[i],b=B[(i+1)%B.length],ex=b.x-a.x,ey=b.y-a.y;
        const c0=sgn*(ex*(p.y-a.y)-ey*(p.x-a.x)),c1=sgn*(ex*d.y-ey*d.x);
        if(Math.abs(c1)<1e-12){if(c0<0){empty=true;break}continue}
        const t=-c0/c1;if(c1>0)t0=Math.max(t0,t);else t1=Math.min(t1,t);
      }
      if(empty||t1<=t0)continue;
      parts=parts.flatMap(([u,v])=>[[u,Math.min(v,t0)],[Math.max(u,t1),v]].filter(([x,y])=>y-x>1e-4));
    }
    const at=t=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
    return parts.map(([u,v])=>[at(u),at(v)]);
  }
  function openingQuad(m,at,dir,z0,z1,w,hex){
    const t={x:-dir.y,y:dir.x},a={x:at.x-t.x*w/2,y:at.y-t.y*w/2},b={x:at.x+t.x*w/2,y:at.y+t.y*w/2};
    m.face([{...a,z:z0},{...b,z:z0},{...b,z:z1},{...a,z:z1}],hex);
  }
  function buildCutaway(){
    // m: interior (inner walls, cut jambs, floors, openings, furniture) - kept in full light at night;
    // sh: exterior shell (outer faces, crest ring, roof deck) - lit like the rest of the castle.
    const m=meshBuilder(),sh=meshBuilder(),em=meshBuilder(),winter=State.season==='winter',turns=State.view.rotation||0;
    const W3=window.ConquerWagons3D,FU=window.ConquerCutawayFurniture;
    for(const s of State.structures){
      if(!structureCutaway(s)||underConstruction(s))continue;
      const g0=cutawayWallGeometry(s),H=structureHeight(s),n=Math.min(g0.outer.length,g0.inner.length);
      // Inner ring re-indexed so inner[i] is the vertex nearest outer[i] (built sections list them
      // in another order, which made the crest quads cross over the whole room).
      const g={...g0,inner:g0.outer.slice(0,n).map(o=>g0.inner.reduce((b,p)=>Math.hypot(p.x-o.x,p.y-o.y)<Math.hypot(b.x-o.x,b.y-o.y)?p:b,g0.inner[0]))};
      // Parent / subtower footprints cut into this structure's walls, floors and crest.
      const blkAll=cutawayBlockers(s),under=z=>blkAll.filter(b=>z<b.h-1e-6).map(b=>b.pts),blk=under(0);
      const outside=(p,z=0)=>!under(z).some(B=>pointInPolygon(p,B));
      const facesOut=(poly,hex,mesh,z)=>{const bz=under(z);for(const P of bz.length?polyMinus(poly,bz):[poly])mesh.face(P.map(p=>Z(p,z)),hex)};
      // A wall face: full height outside the blockers, and above each blocker's top inside it.
      const wallFace=(mesh,p,q,hex)=>{
        for(const [a,b] of segMinus(p,q,blk))mesh.face([Z(a,0),Z(b,0),Z(b,H),Z(a,H)],hex);
        const top=Math.max(0,...blkAll.map(b=>b.h));
        if(blk.length&&top<H)mesh.face([Z(p,top),Z(q,top),Z(q,H),Z(p,H)],hex);
      };
      const plane=s.type==='tower'||s.type==='gate',G0=plane?(Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s)):null;
      const Z=(p,z)=>({x:p.x,y:p.y,z:(plane?G0:terrainElevation(p))+z});
      let keep,jambs;
      if(s.type==='built'){
        const d=[0,1,2,3].map(i=>(viewDepthPoint(g.outer[i])+viewDepthPoint(g.outer[(i+1)%4]))/2),rear=d[0]>=d[2]?2:0;
        keep=new Set([rear]);jambs=[rear,(rear+1)%4];
      }else{
        const open=cutawayTransparentFaceIndexes(s,g);
        keep=new Set([...Array(n).keys()].filter(i=>!open.has(i)));jambs=cutawayBoundaryVertices(open,n);
      }
      for(const i of keep){
        const j=(i+1)%n,o0=g.outer[i],o1=g.outer[j],i0=g.inner[i],i1=g.inner[j];
        wallFace(sh,o0,o1,castleSideShade(o0,o1));wallFace(m,i0,i1,'#61574f');
      }
      // Subtower: the parent stays intact, and a dividing wall closes the subtower along the
      // parent's outline where it runs through the subtower footprint.
      for(const k of blkAll.filter(b=>b.parent)){
        const own=footprintPoints(s),top=Math.min(H,k.h);
        for(let i=0;i<k.pts.length;i++){
          const p=k.pts[i],q=k.pts[(i+1)%k.pts.length],keepOut=segMinus(p,q,[own]);
          // Inside parts = the segment minus its outside parts.
          let t=0;const L=Math.hypot(q.x-p.x,q.y-p.y)||1,param=a=>Math.hypot(a.x-p.x,a.y-p.y)/L,ins=[];
          for(const [a,b] of keepOut){const ta=param(a);if(ta-t>1e-4)ins.push([t,ta]);t=param(b)}
          if(1-t>1e-4)ins.push([t,1]);
          for(const [u,v] of ins){
            const A={x:p.x+(q.x-p.x)*u,y:p.y+(q.y-p.y)*u},B={x:p.x+(q.x-p.x)*v,y:p.y+(q.y-p.y)*v};
            m.face([Z(A,0),Z(B,0),Z(B,top),Z(A,top)],'#61574f');
            // Connecting door through the dividing wall, on the subtower's ground floor.
            const len=Math.hypot(B.x-A.x,B.y-A.y);
            if(len>.45&&top>.7){
              const mid={x:(A.x+B.x)/2,y:(A.y+B.y)/2},nx=-(B.y-A.y)/len,ny=(B.x-A.x)/len;
              for(const sgn of [1,-1])openingQuad(m,{x:mid.x+nx*.006*sgn,y:mid.y+ny*.006*sgn},{x:nx*sgn,y:ny*sgn},Z(mid,.06).z,Z(mid,.62).z,.3,'#1f1712');
            }
          }
        }
      }      for(const v of jambs)if(outside(g.outer[v])&&outside(g.inner[v]))m.face([Z(g.outer[v],0),Z(g.inner[v],0),Z(g.inner[v],H),Z(g.outer[v],H)],'#82776c');
      const ring=winter?WINTER_SNOW_TOP:'#8f857a';
      for(let i=0;i<n;i++){const j=(i+1)%n;facesOut([g.outer[i],g.outer[j],g.inner[j],g.inner[i]],ring,sh,H)}
      if(s.type==='tower'&&towerRoofStyle(s)==='battlement')facesOut(g.inner,winter?WINTER_SNOW_TOP:'#8f857a',sh,H-.01);
      // Floors: slab, then tiles (stone ground floor) or planks (wooden upper floors) clipped to the room.
      const basis=cutawayFloorBasis(s,g),ca=Math.cos(basis.angle),sa=Math.sin(basis.angle);
      const L=(u,v)=>({x:basis.center.x+u*ca-v*sa,y:basis.center.y+u*sa+v*ca});
      for(const floor of cutawayFloorLevels(s)){
        const stone=floor.material==='stone',z=floor.z,th=stone?.045:.065;
        facesOut(g.inner,stone?'#7f796f':'#795a3a',m,z);
        for(let i=0;i<g.inner.length;i++){for(const [a,b] of segMinus(g.inner[i],g.inner[(i+1)%g.inner.length],under(z)))m.face([Z(a,z-th),Z(b,z-th),Z(b,z),Z(a,z)],stone?'#5a554d':'#5b402b')}
        if(stone){
          const tile=.32,nx=Math.ceil(basis.w/tile),ny=Math.ceil(basis.h/tile);
          for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++){
            if((ix+iy)%2)continue;
            const u0=-basis.w/2+ix*tile,v0=-basis.h/2+iy*tile,q=clipConvex([L(u0,v0),L(u0+tile,v0),L(u0+tile,v0+tile),L(u0,v0+tile)],g.inner);
            if(q.length>2)facesOut(q,'#8d877c',m,z+.003);
          }
        }else{
          const plank=.18,across=basis.h<=basis.w,span=across?basis.h:basis.w,len=across?basis.w:basis.h;
          for(let i=0;i*plank<span;i++){
            if(i%2)continue;
            const a=-span/2+i*plank,b=Math.min(span/2,a+plank);
            const quad=across?[L(-len/2,a),L(len/2,a),L(len/2,b),L(-len/2,b)]:[L(a,-len/2),L(b,-len/2),L(b,len/2),L(a,len/2)];
            const q=clipConvex(quad,g.inner);if(q.length>2)facesOut(q,'#84613e',m,z+.003);
          }
        }
      }
      // Openings of the standing walls, seen from inside.
      const keptDir=dir=>{let best=-1,bd=-Infinity;for(let i=0;i<n;i++){const a=g.outer[i],b=g.outer[(i+1)%n],mx=(a.x+b.x)/2-s.x,my=(a.y+b.y)/2-s.y,L2=Math.hypot(mx,my)||1,d=(mx*dir.x+my*dir.y)/L2;if(d>bd){bd=d;best=i}}return keep.has(best)};
      const innerAt=dir=>{const r=s.shape==='round'?Math.max(.12,(Number(s.r)||.5)-g.thickness):null;
        if(r)return{x:s.x+dir.x*(r-.006),y:s.y+dir.y*(r-.006)};
        let best=null,bd=-Infinity;for(let i=0;i<g.inner.length;i++){const a=g.inner[i],b=g.inner[(i+1)%g.inner.length],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},d=(mid.x-s.x)*dir.x+(mid.y-s.y)*dir.y;if(d>bd){bd=d;best=mid}}
        return{x:best.x-dir.x*.006,y:best.y-dir.y*.006};};
      if(s.type==='tower'){
        for(const row of towerWindowRows(s))for(const d of towerFaceDirections(s)){
          const dir={x:d.nx,y:d.ny};if(!keptDir(dir))continue;
          const at=innerAt(dir),zc=row.z;if(!outside(at,zc))continue;
          if(d.interior&&towerGothicAssetForRow(s,row))openingQuad(m,at,dir,(plane?G0:0)+zc-.2,(plane?G0:0)+zc+.2,.26,'#8fa2b2');
          else if(towerSlitFace(s,d.face,row.floor))openingQuad(m,at,dir,(plane?G0:0)+zc-.16,(plane?G0:0)+zc+.16,.06,'#1c1612');
        }
        for(const spec of (typeof towerDoorSpecs==='function'?towerDoorSpecs(s):[])){
          const dir={x:spec.outward.x,y:spec.outward.y};if(!keptDir(dir))continue;
          const at={x:spec.contact.x-dir.x*(g.thickness+.006),y:spec.contact.y-dir.y*(g.thickness+.006)};if(!outside(at))continue;
          openingQuad(m,at,dir,G0+spec.baseZ+.01,G0+Math.min(spec.apexZ,spec.baseZ+.6),.3,'#1f1712');
        }
      }else if(s.type==='gate'){
        const fp=footprintPoints(s);
        for(const e of [1,3]){
          if(!keep.has(e))continue;
          const a=g.inner[e],b=g.inner[(e+1)%4],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},mo={x:(fp[e].x+fp[(e+1)%4].x)/2,y:(fp[e].y+fp[(e+1)%4].y)/2};
          const dl=Math.hypot(mo.x-s.x,mo.y-s.y)||1,dir={x:(mo.x-s.x)/dl,y:(mo.y-s.y)/dl};
          openingQuad(m,{x:mid.x-dir.x*.006,y:mid.y-dir.y*.006},dir,G0+.06,G0+1.05,.78,'#1f1712');
        }
      }
      // Furniture and ladders (world xy, z on the structure plane).
      for(const f of FU?.worldFaces(s)||[]){
        const pts=f.pts.map(p=>({x:p[0],y:p[1],z:(plane?G0:terrainElevation({x:p[0],y:p[1]}))+p[2]}));
        const k=W3?W3.shadeFactor(f.n[0],f.n[1],f.n[2],turns):1;
        m.face(pts,shadeHex(f.hex,k));
        if(f.emissive)em.face(pts,f.hex);
      }
    }
    return{main:new Float32Array(m.tris),shell:new Float32Array(sh.tris),em:new Float32Array(em.tris)};
  }

  // ---------- content signatures (cheap, per frame) ----------
  // One pass per check: each structure is hashed once and folded into the categories it belongs to.
  // Category tests look at fields only (no terrain sampling), so this stays well under a millisecond.
  let sigPass=null;
  function structureKey(s){
    return s.id+(underConstruction(s)?'u':'c')+(s.level||'')+(s.houseLevel||'')+(s.x??s.a?.x??'')+(s.y??s.a?.y??'')+(s.b?.x??'')+(s.b?.y??'')+(s.angle||0)+(s.roofStyle||'')+(s.baseStyle||'')+(s.skin||'')+(s.masonryMaterial||'stone')+(s.cutaway?1:0)+(s.width||'')+(s.groundZ??'')+(s.aSnap||'')+(s.bSnap||'')+(s.flip?1:0)
      // Moat fill patches are baked into the ground: filling must re-bake it.
      +(s.fills?.length?s.fills.map(f=>(+f.at).toFixed(2)+':'+f.span+':'+(+f.progress).toFixed(3)).join(','):'')
      // The gate door's state swaps its facade decal.
      +(s.type==='gate'?(window.ConquerSiege?.doorStage?.(s)||''):'')+(s.brokenTop?'B':'')
      // Mills swap to their gutted model mid-fire.
      +(window.ConquerIndustries3D?.variant?.(s)||'');
  }
  function computeSigPass(){
    const acc=new Map();
    for(const s of State.structures){
      const str=structureKey(s);
      let h=0;for(let i=0;i<str.length;i++)h=(Math.imul(h,31)+str.charCodeAt(i))|0;
      for(const cat of SIG_CATEGORIES)if(cat.test(s))acc.set(cat.name,(Math.imul(acc.get(cat.name)||0,33)^h)|0);
    }
    sigPass=acc;
  }
  const SIG_CATEGORIES=[
    {name:'ground',test:s=>s.type==='road'||s.type==='field'||s.type==='house'||s.type==='moat'||s.type==='bridge'||s.type==='palisade'},
    {name:'buildings',test:s=>s.type==='house'||s.type==='field'||s.type==='well'||CIVIC_TYPES.includes(s.type)||!!window.ConquerIndustries?.TYPES?.[s.type]},
    {name:'castle',test:s=>!s.auto&&['tower','gate','wall','built'].includes(s.type)},
    {name:'hedges',test:s=>s.type==='house'||s.type==='field'},
    {name:'all',test:()=>true}
  ];
  function structuresSig(name){return sigPass?.get(name)||0}
  // Urban lots/fences are regenerated by the game (urbanRevision) without any structure field changing.
  function urbanRev(){try{return typeof urbanRevision!=='undefined'?urbanRevision:0}catch{return 0}}
  let groundLotRevision=-1,groundLotSeed=null,groundLotSig='';
  function groundLotsSignature(){
    if(groundLotRevision===urbanRev()&&groundLotSeed===State.seed)return groundLotSig;
    groundLotRevision=urbanRev();groundLotSeed=State.seed;
    const structures=new Map(State.structures.map(s=>[s.id,s]));
    // Navigation/collider updates invalidate the parcel cache conservatively.
    // Only rebake the two 4096px ground textures if the painted lots changed.
    groundLotSig=JSON.stringify(urbanLots().map(lot=>{
      const s=structures.get(lot.civicId||lot.houseId);
      return[lot.houseId,lot.civicId,s?.type,!!(s?.auto||s?.urbanRedeveloped)&&houseLevel(s)>=3,
        window.ConquerLivestock?.lotKindForHouse(s),lot.points];
    }));
    return groundLotSig;
  }
  function wet(){try{return typeof weatherGroundWet==='function'?weatherGroundWet():!!State.weather?.wet}catch{return false}}

  function upload(gl,name,data){
    let b=S.buf[name];if(!b){b=gl.createBuffer();S.buf[name]=b}
    gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    S.buf[name+'#n']=data.length;
  }
  // Content signatures are only recomputed after the game signals a change (invalidateSceneCache is
  // called for every structure/season/weather/sun/camera change), not on every frame.
  S.contentDirty=true;
  if(typeof invalidateSceneCache==='function'){
    const orig=invalidateSceneCache;
    invalidateSceneCache=function(...args){S.contentDirty=true;return orig.apply(this,args)};
  }
  function ensureContent(gl){
    // Deselecting with Escape does not invalidate the scene: the civic cutaway is checked here too.
    const civicCut=window.ConquerCivic3D?.cutawayId?.()||null;
    if(!S.contentDirty&&S.sig.terrain&&S.lastUrbanRev===urbanRev()&&S.civicCut===civicCut){S.stats.ensureMs=0;pumpGroundTiles(gl);return}
    S.civicCut=civicCut;
    S.contentDirty=false;S.lastUrbanRev=urbanRev();computeSigPass();
    const t0=performance.now(),st=S.stats;
    const season=State.season||'summer',rot=State.view.rotation||0,plan=isPlanView();
    // envRev: main roads cut grooves into a continuous woodland in place.
    const envRev=typeof environmentRevision!=='undefined'?environmentRevision:0;
    const terraformEdits=window.ConquerTerraforming?.edits?.()||State.relief?.terraforming||[];
    const terraformSig=terraformEdits.map(e=>[e.id,e.targetZ,e.baseZ,e.radius,e.shape,e.rotation,e.center.x,e.center.y,e.edgeWidth,e.mode,e.material].join(':')).join(',');
    // Relief, terraforming and forests shape the terrain meshes: those rebuild them and re-bake the
    // whole ground. Season and wetness re-bake the whole ground too. Structure and urban-lot edits only
    // re-bake the tiles they touch, one per frame (pumpGroundTiles).
    const meshSig=[season,State.biome,State.relief?.seed,terraformSig,(State.environment||[]).length,envRev].join('|');
    const gSig=[meshSig,wet()].join('|');
    const tSig=[gSig,groundLotsSignature(),structuresSig('ground')].join('|');
    if(S.sig.terrain!==tSig){
      const a=performance.now(),items=groundItems();
      if(S.sig.terrainMesh!==meshSig){
        upload(gl,'terrain',buildTerrain());upload(gl,'mountains',buildMountains());upload(gl,'terrainEdges',buildTerrainEdges());
        S.sig.terrainMesh=meshSig;
      }
      if(S.sig.ground!==gSig||!S.tex.world||!S.groundItems){bakeGroundFull(gl);S.sig.ground=gSig}
      else{
        queueGroundTiles(changedGroundRects(S.groundItems,items));
        // Wide edits (a long road, a district rebuild) are cheaper as one full bake than as many tiles.
        if(S.groundQueue.length>GROUND_TILE_LIMIT)bakeGroundFull(gl);
      }
      S.groundItems=items;S.sig.terrain=tSig;st.groundBakeMs=performance.now()-a;
    }
    pumpGroundTiles(gl);
    const bSig=[season,State.visualPalette,urbanRev(),structuresSig('buildings'),civicCut].join('|');
    if(S.sig.buildings!==bSig){const a=performance.now();upload(gl,'buildings',buildBuildings());S.sig.buildings=bSig;st.buildingsMs=performance.now()-a}
    // The selected church / inn in cutaway: its section plane follows the camera quarter-turn.
    const cutSig=[bSig,rot,plan].join('|');
    if(S.sig.civicCutaway!==cutSig){
      const m=meshBuilder(true),s=civicCut&&State.structures.find(x=>x.id===civicCut);
      if(s)withStructureVisualMaterial(s,()=>ConquerCivic3D.addCutawayToBuilder(m,Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s)));
      upload(gl,'civicCutaway',new Float32Array(m.tris));S.sig.civicCutaway=cutSig;
    }
    // Castle side tones and the near/far battlement split depend on the quarter-turn: keep one mesh set
    // per rotation/plan variant so turning the camera back and forth never rebuilds.
    const castleContent=[season,State.visualPalette,structuresSig('castle')].join('|');
    if(S.castleContent!==castleContent){
      for(const v of S.castleVariants?.values()||[])for(const p of Object.values(v))gl.deleteBuffer(p.b);
      S.castleContent=castleContent;S.castleVariants=new Map();
    }
    const cSig=castleContent+'|'+rot+'|'+plan;
    if(S.sig.castle!==cSig&&window.ConquerCastle3D?.worldMeshes){
      const a=performance.now(),key=rot+'|'+plan;
      let v=S.castleVariants.get(key);
      if(!v){
        const cm=ConquerCastle3D.worldMeshes(),mk=d=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return{b,n:d.length}};
        v={body:mk(new Float32Array(cm.body)),lines:mk(new Float32Array(cm.body.lines||[])),front:mk(new Float32Array(cm.front)),frontLines:mk(new Float32Array(cm.front.lines||[]))};
        S.castleVariants.set(key,v);
      }
      for(const [name,part] of [['castleBody','body'],['castleLines','lines'],['castleFront','front'],['castleFrontLines','frontLines']]){S.buf[name]=v[part].b;S.buf[name+'#n']=v[part].n}
      S.sig.castle=cSig;st.castleMs=performance.now()-a;
    }
    const treeSig=[season,forestTreeSpritesReady,(State.environment||[]).length,envRev,State.seed,urbanRev(),structuresSig('hedges'),
      Object.keys((typeof boundaryBushSprites!=='undefined'&&boundaryBushSprites[season])||{}).length].join('|');
    if(S.sig.trees!==treeSig){
      const a=performance.now(),atlas=buildTreeAtlas();
      if(atlas)uploadTexture(gl,'atlas',atlas.canvas);
      upload(gl,'trees',buildTrees(atlas));S.sig.trees=treeSig;st.treesMs=performance.now()-a;
    }
    const dSig=[structuresSig('all'),Object.keys(architectureSprites).length,window.ConquerGates?.ensureSprites()||''].join('|');
    if(S.sig.decals!==dSig){
      const a=performance.now(),atlas=buildDecalAtlas();uploadTexture(gl,'decalAtlas',atlas.canvas);
      const baked=buildDecals(atlas);
      upload(gl,'decals',baked.decals);
      upload(gl,'nightWindows',baked.lights);
      upload(gl,'fireLights',buildFireLights(atlas));
      S.sig.decals=dSig;st.decalsMs=performance.now()-a;
    }
    // Environmental scatter (settlement-scatter.js): the layout follows content, the two-tone
    // side shading follows the camera quarter-turn, so keep one buffer per rotation.
    if(window.ConquerScatter&&window.ConquerScatterModel){
      const scContent=[season,State.seed,State.relief?.seed,(State.environment||[]).length,urbanRev(),structuresSig('all')].join('|');
      if(S.scatterContent!==scContent){
        const a=performance.now();
        for(const v of S.scatterVariants?.values()||[])gl.deleteBuffer(v.b);
        S.scatterContent=scContent;S.scatterVariants=new Map();S.scatterProps=ConquerScatter.layout();
        st.scatterLayoutMs=performance.now()-a;st.scatterProps=S.scatterProps.length;
      }
      let v=S.scatterVariants.get(rot);
      if(!v){
        const a=performance.now(),d=ConquerScatter.worldMesh(S.scatterProps,rot),b=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
        v={b,n:d.length};S.scatterVariants.set(rot,v);st.scatterMeshMs=performance.now()-a;
      }
      S.buf.scatter=v.b;S.buf['scatter#n']=v.n;
    }
    // Cutaway interiors: rebuilt on content change, one buffer pair per camera quarter-turn.
    const cut=State.structures.filter(s=>structureCutaway(s)&&!underConstruction(s));
    const cutContent=cut.length?[season,S.castleContent,JSON.stringify(State.heraldry||null),!!window.ConquerFurnitureModel,
      ...cut.map(s=>[s.id,JSON.stringify(s.functions||[]),structureLevel(s),s.x??s.a?.x,s.y??s.a?.y,s.b?.x,s.b?.y,s.angle,s.size,s.r,s.isMastio?1:0].join(':'))].join('|'):'';
    if(S.cutContent!==cutContent){
      for(const v of S.cutVariants?.values()||[]){gl.deleteBuffer(v.main.b);gl.deleteBuffer(v.shell.b);gl.deleteBuffer(v.em.b)}
      S.cutContent=cutContent;S.cutVariants=new Map();
    }
    if(cut.length){
      const key=rot+'|'+plan;let v=S.cutVariants.get(key);
      if(!v){
        const a=performance.now(),d=buildCutaway(),mk=x=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,x,gl.STATIC_DRAW);return{b,n:x.length}};
        v={main:mk(d.main),shell:mk(d.shell),em:mk(d.em)};S.cutVariants.set(key,v);st.cutawayMs=performance.now()-a;st.cutawayTris=d.main.length/18;
      }
      S.buf.cutaway=v.main.b;S.buf['cutaway#n']=v.main.n;S.buf.cutawayShell=v.shell.b;S.buf['cutawayShell#n']=v.shell.n;S.buf.cutawayEm=v.em.b;S.buf['cutawayEm#n']=v.em.n;
    }else{S.buf['cutaway#n']=0;S.buf['cutawayShell#n']=0;S.buf['cutawayEm#n']=0}
    const sun=sunShadowState(),sSig=[sun?Math.round(sun.phase*64):'night',S.sig.buildings,S.castleContent].join('|');
    if(S.sig.shadow!==sSig){const a=performance.now(),sh=buildShadows();upload(gl,'shadow',sh.data);S.shadowAlpha=sh.alpha;S.sig.shadow=sSig;st.shadowMs=performance.now()-a}
    st.ensureMs=performance.now()-t0;
  }

  // ---------- drawing ----------
  // Attribute enables and buffer bindings belong to each shader's VAO. A
  // castle/scatter rebuild may delete the last mesh buffer; its orphaned colour
  // attribute must never leak into the terrain (position-only) draw.
  function useProgram(gl,prog){gl.useProgram(prog.p);gl.bindVertexArray(prog.vao)}
  function setCamera(gl,prog,r){
    const L=prog.loc,plan=isPlanView();
    gl.uniform1i(L.uRot,((State.view.rotation||0)%4+4)%4);gl.uniform1f(L.uS,U*State.view.scale);
    gl.uniform2f(L.uV,State.view.x,State.view.y);gl.uniform1f(L.uPlan,plan?1:0);gl.uniform2f(L.uVp,r.width,r.height);
    gl.uniform2f(L.uDepth,plan?-5:-80,plan?30:480);
  }
  function bindAttrib(gl,prog,name,buf,size,stride,offset){
    const loc=prog.loc[name];if(loc==null||loc<0)return;
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset);
  }
  function drawMesh(gl,r,name,mode=gl.TRIANGLES){
    const n=S.buf[name+'#n'];if(!n)return;
    const pr=S.prog.mesh;useProgram(gl,pr);setCamera(gl,pr,r);
    bindAttrib(gl,pr,'aPos',S.buf[name],3,24,0);bindAttrib(gl,pr,'aCol',S.buf[name],3,24,12);
    gl.drawArrays(mode,0,n/6);
  }
  function resizeTo(r){
    const dpr=Math.min(devicePixelRatio||1,2),W=Math.max(1,Math.round(r.width*dpr)),H=Math.max(1,Math.round(r.height*dpr));
    if(S.canvas.width!==W||S.canvas.height!==H){S.canvas.width=W;S.canvas.height=H}
    S.gl.viewport(0,0,W,H);
  }
  function renderBack(r){
    const gl=S.gl;resizeTo(r);
    gl.clearColor(32/255,36/255,25/255,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND);
    // terrain
    const tp=S.prog.terrain;useProgram(gl,tp);setCamera(gl,tp,r);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.world);gl.uniform1i(tp.loc.uWorld,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,S.tex.detail);gl.uniform1i(tp.loc.uDetail,1);
    gl.uniform3f(tp.loc.uDetailRect,DETAIL.x0,DETAIL.y0,DETAIL.size);
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2,2);
    bindAttrib(gl,tp,'aPos',S.buf.terrain,3,12,0);gl.drawArrays(gl.TRIANGLES,0,S.buf['terrain#n']/3);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // sun shadows on the ground (blended, no depth write)
    if(S.buf['shadow#n']&&S.shadowAlpha>0){
      const fp=S.prog.flat;useProgram(gl,fp);setCamera(gl,fp,r);gl.uniform4f(fp.loc.uColor,4/255,5/255,7/255,S.shadowAlpha);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      bindAttrib(gl,fp,'aPos',S.buf.shadow,3,12,0);gl.drawArrays(gl.TRIANGLES,0,S.buf['shadow#n']/3);
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    // solids, then top-face outlines without polygon offset
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    drawMesh(gl,r,'mountains');drawMesh(gl,r,'terrainEdges');drawMesh(gl,r,'buildings');drawMesh(gl,r,'civicCutaway');drawMesh(gl,r,'scatter');drawMesh(gl,r,'castleBody');drawMesh(gl,r,'cutaway');drawMesh(gl,r,'cutawayShell');
    gl.disable(gl.POLYGON_OFFSET_FILL);
    drawMesh(gl,r,'castleLines',gl.LINES);
    // facade decals: blended over their walls, depth-tested, no depth write
    if(S.buf['decals#n']&&S.tex.decalAtlas){
      const dp=S.prog.decal;useProgram(gl,dp);setCamera(gl,dp,r);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.decalAtlas);gl.uniform1i(dp.loc.uAtlas,0);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      const b=S.buf.decals;bindAttrib(gl,dp,'aPos',b,3,36,0);bindAttrib(gl,dp,'aUV',b,2,36,12);bindAttrib(gl,dp,'aCol',b,4,36,20);
      gl.drawArrays(gl.TRIANGLES,0,S.buf['decals#n']/9);
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    // trees
    if(S.buf['trees#n']&&S.tex.atlas){
      const sp=S.prog.sprite;useProgram(gl,sp);setCamera(gl,sp,r);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.atlas);gl.uniform1i(sp.loc.uAtlas,0);
      const b=S.buf.trees;bindAttrib(gl,sp,'aAnchor',b,3,32,0);bindAttrib(gl,sp,'aCorner',b,2,32,12);bindAttrib(gl,sp,'aSize',b,1,32,20);bindAttrib(gl,sp,'aUV',b,2,32,24);
      gl.drawArrays(gl.TRIANGLES,0,S.buf['trees#n']/8);
    }
  }
  // Light is composited AFTER the Canvas ambient tint, while reusing the 3D
  // back/front depth buffer. Clearing only colour preserves occlusion by masonry and soldiers.
  function renderNightLights(r,nf){
    const gl=S.gl;
    if(!gl||nf<=.01)return;
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    if(S.buf['nightWindows#n']&&S.tex.decalAtlas){
      const pr=S.prog.light;useProgram(gl,pr);setCamera(gl,pr,r);
      gl.uniform1f(pr.loc.uNight,nf);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.decalAtlas);gl.uniform1i(pr.loc.uAtlas,0);
      bindAttrib(gl,pr,'aPos',S.buf.nightWindows,3,36,0);
      bindAttrib(gl,pr,'aUV',S.buf.nightWindows,2,36,12);
      bindAttrib(gl,pr,'aCol',S.buf.nightWindows,4,36,20);
      gl.drawArrays(gl.TRIANGLES,0,S.buf['nightWindows#n']/9);
    }
    if(S.buf['fireLights#n']&&S.tex.decalAtlas){
      const pr=S.prog.fireLight;useProgram(gl,pr);setCamera(gl,pr,r);
      gl.uniform1f(pr.loc.uNight,nf);gl.uniform1f(pr.loc.uTime,visualCycleDay());
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.decalAtlas);gl.uniform1i(pr.loc.uAtlas,0);
      bindAttrib(gl,pr,'aAnchor',S.buf.fireLights,3,36,0);
      bindAttrib(gl,pr,'aCorner',S.buf.fireLights,2,36,12);
      bindAttrib(gl,pr,'aSize',S.buf.fireLights,1,36,20);
      bindAttrib(gl,pr,'aUV',S.buf.fireLights,2,36,24);
      bindAttrib(gl,pr,'aSeed',S.buf.fireLights,1,36,32);
      gl.drawArrays(gl.TRIANGLES,0,S.buf['fireLights#n']/9);
    }
    gl.disable(gl.BLEND);gl.depthMask(true);
  }
  function renderFront(r,soldiers,dynamic){
    // Soldiers and near-half battlements, depth-tested against the back pass (depth kept): masonry in
    // front of a soldier hides it, merlons on the near edge cover the patrol's legs, far ones do not.
    const gl=S.gl;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
    drawMesh(gl,r,'settledRubble');
    // Moving meshes (siege engines and their loads), uploaded every frame, depth-tested and written
    // so the soldiers sort against them too.
    if(dynamic&&dynamic.length){
      let b=S.buf.dynamic;if(!b){b=gl.createBuffer();S.buf.dynamic=b}
      gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,dynamic,gl.STREAM_DRAW);
      const pr=S.prog.mesh;useProgram(gl,pr);setCamera(gl,pr,r);
      bindAttrib(gl,pr,'aPos',b,3,24,0);bindAttrib(gl,pr,'aCol',b,3,24,12);
      gl.drawArrays(gl.TRIANGLES,0,dynamic.length/6);
    }
    if(soldiers.length&&soldierAtlas.canvas){
      if(soldierAtlas.dirty){uploadTexture(gl,'soldierAtlas',soldierAtlas.canvas);soldierAtlas.dirty=false}
      let b=S.buf.soldiers;if(!b){b=gl.createBuffer();S.buf.soldiers=b}
      gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,soldiers,gl.STREAM_DRAW);
      const sp=S.prog.sprite;useProgram(gl,sp);setCamera(gl,sp,r);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.soldierAtlas);gl.uniform1i(sp.loc.uAtlas,0);
      bindAttrib(gl,sp,'aAnchor',b,3,32,0);bindAttrib(gl,sp,'aCorner',b,2,32,12);bindAttrib(gl,sp,'aSize',b,1,32,20);bindAttrib(gl,sp,'aUV',b,2,32,24);
      gl.drawArrays(gl.TRIANGLES,0,soldiers.length/8);
    }
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    drawMesh(gl,r,'castleFront');gl.disable(gl.POLYGON_OFFSET_FILL);drawMesh(gl,r,'castleFrontLines',gl.LINES);
  }

  // ---------- soldiers: depth-tested billboards + invisible capsule colliders ----------
  // While a 3D frame is being drawn, drawSoldierFigure() calls (gate guards, wall/palisade patrols,
  // tower archers, training knights, cutaway occupants) are collected instead of painted. Each one is
  // rendered as a billboard in the front pass, depth-tested against the whole scene, and registers a
  // vertical capsule collider in world units for picking and future combat queries.
  const SOLDIER_TILE=128,SOLDIER_SR=8,SOLDIER_FEET=.75;          // sprite px, sprite view scale, feet row
  const SOLDIER_SIZE_U=SOLDIER_TILE/(U*SOLDIER_SR);               // 1.333U card
  const CAPSULE={r:.12,below:.11,above:.38};                       // figure body + head around the feet point
  const soldierAtlas={canvas:null,map:new Map(),next:0,dirty:false,heraldry:null};
  let collecting=null,colliders=[];
  if(typeof drawSoldierFigure==='function'){
    const original=drawSoldierFigure;
    drawSoldierFigure=function(p,z,type,id,phase=0,livery=null){
      if(!collecting)return original.apply(this,arguments);
      const ground=Number.isFinite(structureProjectionGroundZ)?structureProjectionGroundZ:terrainElevation(p);
      collecting.push({p:{x:p.x,y:p.y},z:z+ground,type,id,phase,livery});
      return true;
    };
  }
  function soldierTile(type,phase,livery){
    // Only the knight's sword swings with phase; everything else is a single pose.
    const isDot=window.ConquerLOD?.militaryTier()==='dot';
    const bucket=!isDot&&type==='knight'?Math.floor((((phase%1)+1)%1)*8):0;
    const herald=JSON.stringify(State.heraldry||null);
    if(soldierAtlas.heraldry!==herald){soldierAtlas.map.clear();soldierAtlas.next=0;soldierAtlas.heraldry=herald}
    const key=(isDot?'dot|':'figure|')+type+'|'+bucket+'|'+(livery?JSON.stringify(livery):'realm');
    let uv=soldierAtlas.map.get(key);if(uv)return uv;
    if(!soldierAtlas.canvas){soldierAtlas.canvas=document.createElement('canvas');soldierAtlas.canvas.width=soldierAtlas.canvas.height=1024}
    const cols=1024/SOLDIER_TILE,i=soldierAtlas.next++%(cols*cols),x=(i%cols)*SOLDIER_TILE,y=Math.floor(i/cols)*SOLDIER_TILE;
    const g=soldierAtlas.canvas.getContext('2d');g.clearRect(x,y,SOLDIER_TILE,SOLDIER_TILE);
    if(isDot){
      // The same sprite/billboard and depth-tested capsule stay in place, but
      // the distant soldier is a single colored point instead of a figure.
      const cy=y+SOLDIER_TILE*.54,r=SOLDIER_TILE*.34;
      g.fillStyle=window.ConquerLOD.militaryColor(type,livery);
      g.strokeStyle='#28302a';g.lineWidth=5;
      g.beginPath();g.arc(x+SOLDIER_TILE/2,cy,r,0,Math.PI*2);g.fill();g.stroke();
    }else{
      const keepView=State.view,keepW2s=w2s;
      State.view={...keepView,scale:SOLDIER_SR};
      w2s=()=>({x:x+SOLDIER_TILE/2,y:y+SOLDIER_TILE*SOLDIER_FEET});      // drawSoldierFigureUnmasked projects only the feet
      try{withRenderContext(g,()=>drawSoldierFigureUnmasked({x:0,y:0},0,type,'atlas',bucket/8,livery))}
      finally{State.view=keepView;w2s=keepW2s}
    }
    uv=[x/1024,y/1024,(x+SOLDIER_TILE)/1024,(y+SOLDIER_TILE)/1024];
    soldierAtlas.map.set(key,uv);soldierAtlas.dirty=true;return uv;
  }
  function buildSoldiers(list){
    const v=[],out=[];
    for(const s of list){
      const [u0,v0,u1,v1]=soldierTile(s.type,s.phase,s.livery);
      const C=[[-.5,-SOLDIER_FEET,u0,v0],[.5,-SOLDIER_FEET,u1,v0],[.5,1-SOLDIER_FEET,u1,v1],[-.5,1-SOLDIER_FEET,u0,v1]];
      for(const k of [0,1,2,0,2,3]){const [cx,cy,u,w]=C[k];v.push(s.p.x,s.p.y,s.z,cx,cy,SOLDIER_SIZE_U,u,w)}
      out.push({id:s.id,type:s.type,x:s.p.x,y:s.p.y,z0:s.z-CAPSULE.below,z1:s.z+CAPSULE.above,r:CAPSULE.r});
    }
    colliders=out;
    return new Float32Array(v);
  }
  // Ray through a screen point (CSS px of #c): world points P(z) = s2wAtElevation(sx, sy, z) are collinear.
  function screenRay(sx,sy){
    const a=s2wAtElevation(sx,sy,0),b=s2wAtElevation(sx,sy,10);
    return{o:{x:a.x,y:a.y,z:0},d:{x:b.x-a.x,y:b.y-a.y,z:10}};
  }
  // Distance between the ray line and a capsule axis segment (closest points of two 3D lines, clamped).
  function rayCapsule(ray,c){
    if(isPlanView()){const dx=ray.o.x-c.x,dy=ray.o.y-c.y;return{dist:Math.hypot(dx,dy),t:c.z1}}
    const u=ray.d,v={x:0,y:0,z:c.z1-c.z0},w={x:ray.o.x-c.x,y:ray.o.y-c.y,z:ray.o.z-c.z0};
    const a=u.x*u.x+u.y*u.y+u.z*u.z,b=u.z*v.z,cc=v.z*v.z,d=u.x*w.x+u.y*w.y+u.z*w.z,e=v.z*w.z,den=a*cc-b*b;
    let sN=den>1e-12?(b*e-cc*d)/den:0,tN=den>1e-12?(a*e-b*d)/den:0;
    tN=clamp(tN,0,1);sN=(b*tN-d)/a;                                 // re-project onto the ray after clamping
    const px=ray.o.x+u.x*sN-c.x,py=ray.o.y+u.y*sN-c.y,pz=ray.o.z+u.z*sN-(c.z0+v.z*tN);
    return{dist:Math.hypot(px,py,pz),t:c.z0+v.z*tN};
  }
  function pickSoldier(sx,sy){
    const ray=screenRay(sx,sy);let best=null;
    for(const c of colliders){
      const h=rayCapsule(ray,c);if(h.dist>c.r)continue;
      const q=rotateViewPoint(c),depth=isPlanView()?c.z1:q.x+q.y+ISO_Z*h.t;  // nearest = largest view depth
      if(!best||depth>best.depth)best={collider:c,depth,distance:h.dist};
    }
    return best;
  }
  function drawColliderDebug(){
    ctx.save();ctx.lineWidth=1;
    for(const c of colliders){
      const ring=z=>circleWorldPoints(c.x,c.y,c.r,16).map(p=>w2sRaw(p,z));
      const hl=S.hover&&S.hover.id===c.id;ctx.strokeStyle=hl?'rgba(255,214,90,.95)':'rgba(120,220,255,.75)';
      for(const z of [c.z0,c.z1]){const pts=ring(z);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke()}
      const l0=w2sRaw({x:c.x-c.r,y:c.y},c.z0),l1=w2sRaw({x:c.x-c.r,y:c.y},c.z1),r0=w2sRaw({x:c.x+c.r,y:c.y},c.z0),r1=w2sRaw({x:c.x+c.r,y:c.y},c.z1);
      ctx.beginPath();ctx.moveTo(l0.x,l0.y);ctx.lineTo(l1.x,l1.y);ctx.moveTo(r0.x,r0.y);ctx.lineTo(r1.x,r1.y);ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- frame hooks used by draw() ----------
  function supported(){return !!ensureGL()}
  function active(){return enabled&&supported()}
  function residual2D(){
    // Not ported yet: palisades, wood towers and wood gates keep their 2.5D drawing (per frame).
    const items=State.structures.filter(s=>!underConstruction(s)&&(s.type==='palisade'||isWoodTower(s)||isWoodGate(s)))
      .sort((a,b)=>worldDepth(a)-worldDepth(b));
    for(const s of items)drawStructure(s);
  }
  function drawBack(r){
    const t0=performance.now(),gl=ensureGL();if(!gl)return false;
    try{
    pollRendererError(gl);
    collecting=[];                           // soldiers drawn this frame go to the 3D front pass
    const gpu=document.getElementById('gpuCanvas');if(gpu&&gpu.style.visibility!=='hidden')gpu.style.visibility='hidden';
    ensureContent(gl);
    const t1=performance.now();renderBack(r);
    ctx.drawImage(S.canvas,0,0,r.width,r.height);
    if(isPlanView())drawGrid();             // 5U lines + 0.5U snap lattice (plan view editor aid)
    residual2D();
    // Village name over the well (screen-space text in drawPointStructure).
    if(State.village.founded&&State.village.name)for(const s of State.structures){
      if(s.type!=='well'||underConstruction(s))continue;
      const p=w2s({x:s.x,y:s.y},.46);ctx.fillStyle='#f2e6d3';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(State.village.name,p.x,p.y-12);
    }
    const p=perf();p.world3dBackMs=performance.now()-t1;p.world3dEnsureMs=t1-t0;
    return true;
    }catch(err){
      // Never leave gameplay blank when the optional renderer fails.
      disableRenderer(err);
      return false;
    }
  }
  function disableRenderer(err){
    S.failed='world3d-draw: '+String(err?.message||err);enabled=false;collecting=null;
    const gpu=document.getElementById('gpuCanvas');if(gpu)gpu.style.visibility='';
    window.ConquerWebGPU?.invalidate?.();invalidateSceneCache();
    console.warn('World 3D disabled; Canvas fallback:',S.failed);
  }
  function finishFrame(){
    try{deferRendererError(S.gl);return true}
    catch(err){disableRenderer(err);return false}
  }
  function nightLightsEnabled(){return useGpuNightLights}
  function setNightLightsEnabled(on){useGpuNightLights=!!on;draw()}
  function drawNightLights3D(r){
    const nf=nightFactor();if(nf<=.01)return;
    const started=performance.now();
    renderNightLights(r,nf);
    ctx.drawImage(S.canvas,0,0,r.width,r.height);
    // Animated flame shapes stay on the dynamic Canvas overlay; their light no longer does.
    drawFireFlamesOnly(nf);
    const p=perf(),ms=performance.now()-started;
    p.world3dNightLightMs=ms;
    const windowQuads=(S.buf['nightWindows#n']||0)/54;
    const fireSources=(S.buf['fireLights#n']||0)/54;
    window.__conquerAnalytics?.measure('NIGHTLIGHT_3D',ms,{windowQuads,fireSources});
    if(!S.nightLightReported){
      S.nightLightReported=true;
      window.__conquerAnalytics?.event('NIGHTLIGHT_3D_ACTIVE',{windowQuads,fireSources,mode:'webgl2'},'info');
    }
  }
  function drawCastleOverlays(){
    // Arcades are 3D decals and cutaway rooms render in WebGL2; Canvas owns only the fallback path.
  }
  // Night: open interiors stay in full light. The whole cutaway mesh (and its flames) is redrawn
  // over the night overlay, depth-tested against this frame's scene (depth buffer is preserved),
  // so whatever covers it in front keeps covering it.
  function drawEmissive(){
    if(!active()||!S.buf['cutaway#n']||!(typeof nightFactor==='function'&&nightFactor()>.01))return;
    const gl=S.gl,r=wrap.getBoundingClientRect();
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);drawMesh(gl,r,'cutaway');drawMesh(gl,r,'cutawayEm');gl.disable(gl.POLYGON_OFFSET_FILL);
    // Figures inside the open rooms (occupants, archers at the slits) share the room light.
    const inside=(S.frameFigures||[]).filter(f=>/-room-|:slit:/.test(String(f.id)));
    if(inside.length&&S.tex.soldierAtlas){
      const data=buildSoldiers(inside);let b=S.buf.indoorFigures;if(!b){b=gl.createBuffer();S.buf.indoorFigures=b}
      gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STREAM_DRAW);
      const sp=S.prog.sprite;gl.useProgram(sp.p);setCamera(gl,sp,r);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex.soldierAtlas);gl.uniform1i(sp.loc.uAtlas,0);
      bindAttrib(gl,sp,'aAnchor',b,3,32,0);bindAttrib(gl,sp,'aCorner',b,2,32,12);bindAttrib(gl,sp,'aSize',b,1,32,20);bindAttrib(gl,sp,'aUV',b,2,32,24);
      gl.drawArrays(gl.TRIANGLES,0,data.length/8);
      colliders=S.frameColliders||colliders;
    }
    gl.depthMask(true);
    ctx.drawImage(S.canvas,0,0,r.width,r.height);
  }
  // Mastio heraldic drape stays 2D for now: run the facade pass on the mastio towers only.
  function drawMastioDrapes(){
    const all=State.structures,mastio=all.filter(s=>s.isMastio&&!underConstruction(s)&&!structureCutaway(s));
    if(!mastio.length)return;
    try{State.structures=mastio;drawFacadeWindows(false,1,false)}finally{State.structures=all}
  }
  // ---------- dynamic meshes: queued during the frame like soldiers ----------
  // mesh: {pos: 9 world coords per triangle, col: one CSS hex per triangle}. Flat colours take the
  // castle's two-tone side shading for the current view rotation (tops full, sides light/dark).
  let dynamicQueue=[];
  function addMesh(mesh){if(collecting&&mesh&&mesh.col&&mesh.col.length)dynamicQueue.push(mesh)}
  const hexRgb=new Map();
  function meshRgb(hex){
    let v=hexRgb.get(hex);if(v)return v;
    const h=hex.replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);hexRgb.set(hex,v);return v;
  }
  function buildDynamic(list){
    let n=0;for(const m of list)n+=m.col.length;
    const out=new Float32Array(n*18);let o=0;
    for(const m of list){
      const p=m.pos;
      for(let t=0;t<m.col.length;t++){
        const i=t*9,ux=p[i+3]-p[i],uy=p[i+4]-p[i+1],uz=p[i+5]-p[i+2],vx=p[i+6]-p[i],vy=p[i+7]-p[i+1],vz=p[i+8]-p[i+2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;
        let f;
        if(nz/len>.5)f=1;else if(nz/len<-.5)f=.5;
        else{const q=rotateViewPoint({x:-ny,y:nx}),z0=rotateViewPoint({x:0,y:0});f=Math.cos(2*(Math.atan2(q.y-z0.y,q.x-z0.x)-Math.PI/6))>=0?.84:.68}
        const c=meshRgb(m.col[t]),pale=(c[0]+c[1]+c[2])/3>.7;if(pale)f=1-(1-f)*.55;
        for(let k=0;k<3;k++){out[o++]=p[i+k*3];out[o++]=p[i+k*3+1];out[o++]=p[i+k*3+2];out[o++]=c[0]*f;out[o++]=c[1]*f;out[o++]=c[2]*f}
      }
    }
    return out;
  }
  let settledMeshRefs=[],settledMeshRotation=-1;
  function uploadSettledMeshes(gl,meshes){
    const rotation=State.view.rotation||0;
    if(rotation===settledMeshRotation&&meshes.length===settledMeshRefs.length&&meshes.every((m,i)=>m===settledMeshRefs[i]))return;
    const t0=performance.now();
    upload(gl,'settledRubble',buildDynamic(meshes));
    settledMeshRefs=meshes.slice();settledMeshRotation=rotation;
    const p=perf();p.settledRubbleUploads=(p.settledRubbleUploads||0)+1;p.settledRubbleBuildMs=performance.now()-t0;
  }
  function drawFront(r){
    const t0=performance.now(),list=collecting||[];collecting=null;S.frameFigures=list;
    // Breach rubble (siege) and ladders/assault towers set against the walls (combat).
    // Mill sails and wheels turn every frame (industries).
    // Gate door leaves, portcullis and torch brackets (gate fittings).
    for(const source of [window.ConquerSiege,window.ConquerCombat,window.ConquerIndustries3D,window.ConquerGates]){
      try{for(const m of source?.dynamicMeshes?.()||[])dynamicQueue.push(m)}catch(e){console.error(e)}
    }
    // Event flags, bunting and banners wave in the wind (settlement-events3d.js).
    try{for(const m of window.ConquerEvents3D?.dynamicMeshes?.()||[])dynamicQueue.push(m)}catch(e){console.error(e)}
    const settled=dynamicQueue.filter(m=>m.static===true),moving=dynamicQueue.filter(m=>m.static!==true);
    uploadSettledMeshes(S.gl,settled);
    const dyn=buildDynamic(moving);dynamicQueue=[];
    renderFront(r,buildSoldiers(list),dyn);S.frameColliders=colliders;ctx.drawImage(S.canvas,0,0,r.width,r.height);
    if(S.debugColliders)drawColliderDebug();
    // 2.5D front pieces only exist for palisades, wood towers and cutaways; the battlement occlusion
    // frame is expensive, so skip the call entirely when none of them is present.
    const all=State.structures;
    const residual=all.filter(s=>!underConstruction(s)&&(s.type==='palisade'||isWoodTower(s)||isWoodGate(s)));
    if(residual.length){try{State.structures=all.filter(s=>!window.ConquerCastle3D?.castleVolume?.(s));drawCastleBattlements()}finally{State.structures=all}}
    perf().world3dFrontMs=performance.now()-t0;
  }
  function setEnabled(on){enabled=!!on;try{localStorage.setItem(STORE_KEY,enabled?'1':'0')}catch{}location.reload()}
  // Benchmark hook: switch modes in place (no reload). Restores the WebGPU canvas when leaving 3D.
  function _setActiveForTest(on){
    enabled=!!on;
    if(!enabled){const gpu=document.getElementById('gpuCanvas');if(gpu)gpu.style.visibility='';window.ConquerWebGPU?.invalidate?.()}
    invalidateSceneCache();
  }
  // Debug: show capsules; hovering highlights the soldier picked by the camera ray.
  function setColliderDebug(on){
    S.debugColliders=!!on;
    if(on&&!S.hoverBound){
      S.hoverBound=true;
      canvas.addEventListener('mousemove',e=>{
        if(!S.debugColliders||!active())return;
        const rc=canvas.getBoundingClientRect(),hit=pickSoldier(e.clientX-rc.left,e.clientY-rc.top);
        const id=hit?.collider.id||null;if(id!==(S.hover?.id||null)){S.hover=hit?.collider||null;draw()}
      });
    }
    draw();
  }
  window.ConquerWorld3D={active,supported,setEnabled,drawBack,drawCastleOverlays,drawFront,
    drawNightLights3D,nightLightsEnabled,setNightLightsEnabled,drawMastioDrapes,drawEmissive,finishFrame,_setActiveForTest,
    pickSoldier,colliders:()=>colliders.slice(),setColliderDebug,addMesh,addHouse,
    invalidate:()=>{S.sig={};S.contentDirty=true},
    _debugBake:bakeGround,
    status:()=>({enabled,supported:supported(),failed:S.failed,stats:{...S.stats},sig:{...S.sig},buffers:Object.fromEntries(Object.entries(S.buf).filter(([k])=>k.endsWith('#n')))})};
})();
