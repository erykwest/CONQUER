'use strict';
// CONQUER mesh helpers shared by the Blender-built models (industries, later wagons
// and animals): castle-style face shading and a depth-sorted Canvas 2D painter for
// the 2.5D renderer. WebGL draws the same triangles with a depth buffer.
(function(){
  const rgbCache=new Map();
  function rgb(hex){
    let v=rgbCache.get(hex);if(v)return v;
    const h=hex.replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
    rgbCache.set(hex,v);return v;
  }
  const toHex=([r,g,b])=>'#'+[r,g,b].map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');
  // Ground-plane quarter turns of the camera (same convention as rotateViewPoint).
  function rotDir(x,y,turns){
    const q=((turns%4)+4)%4;
    return q===1?[-y,x]:q===2?[-x,-y]:q===3?[y,-x]:[x,y];
  }
  // Castle rule (castleSideShade): top faces keep the base colour, side faces take
  // one of two tones by their facing against a light at 30 degrees; pale materials
  // keep more of their tone so stone and canvas don't turn grey.
  function shadeFactor(nx,ny,nz,turns,base){
    const len=Math.hypot(nx,ny,nz)||1;
    let f;
    // Blender exports do not keep a consistent winding, so the normal's sign is unreliable:
    // a flipped roof triangle would turn dark next to its twin. Seen from above, every face
    // that shows is an upper face, so tops are told by |nz| (sides already ignore the sign).
    if(Math.abs(nz)/len>.5)f=1;
    else{const [ex,ey]=rotDir(-ny,nx,turns);f=Math.cos(2*(Math.atan2(ey,ex)-Math.PI/6))>=0?.84:.68}
    if(base&&(base[0]+base[1]+base[2])/765>.7)f=1-(1-f)*.55;
    return f;
  }
  function triNormal(p,o){
    const ux=p[o+3]-p[o],uy=p[o+4]-p[o+1],uz=p[o+5]-p[o+2],vx=p[o+6]-p[o],vy=p[o+7]-p[o+1],vz=p[o+8]-p[o+2];
    return[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
  }
  // Shaded hex colour of triangle t for a fixed world light (WebGL static meshes).
  function shadedHex(mesh,t){
    const base=rgb(mesh.col[t]),[nx,ny,nz]=triNormal(mesh.pos,t*9);
    const f=shadeFactor(nx,ny,nz,0,base);
    return toHex(base.map(c=>c*f));
  }
  // Depth-sorted painter. meshes: [{pos,col,gi?,groups?,groupBias?,flat?}] in world space;
  // view: {project(x,y,z)->{x,y}, depth(x,y,z) (larger = nearer), turns}. Meshes with
  // groups sort part by part (part centre first, then triangle).
  function drawMeshes(ctx,meshes,view,sprites=[]){
    const items=[],turns=view.turns||0;
    for(const mesh of meshes){
      const {pos,col,gi,groups,groupBias}=mesh,n=col.length;
      const gd=groups?groups.map((c,i)=>view.depth(c[0],c[1],c[2])+(groupBias?.[i]||0)):null;
      // Shaded fill colours depend only on the camera quarter-turn: kept on the mesh.
      if(!mesh._fills||mesh._turns!==turns){
        mesh._turns=turns;mesh._fills=new Array(n);
        for(let t=0;t<n;t++){
          // flat meshes carry colours already shaded by their builder (castle volumes).
          const [nx,ny,nz]=triNormal(pos,t*9),[r,g,b]=rgb(col[t]),f=mesh.flat?1:shadeFactor(nx,ny,nz,turns,[r,g,b]);
          mesh._fills[t]='rgb('+(r*f|0)+','+(g*f|0)+','+(b*f|0)+')';
        }
      }
      for(let t=0;t<n;t++){
        const o=t*9;
        const td=view.depth((pos[o]+pos[o+3]+pos[o+6])/3,(pos[o+1]+pos[o+4]+pos[o+7])/3,(pos[o+2]+pos[o+5]+pos[o+8])/3);
        items.push({mesh,t,d:gd?gd[gi[t]]:td,d2:gd?td:0});
      }
    }
    for(const s of sprites)items.push({sprite:s,d:view.depth(s.x,s.y,s.z||0),d2:0});
    items.sort((a,b)=>a.d-b.d||a.d2-b.d2);
    ctx.save();ctx.lineJoin='round';ctx.lineWidth=.6;
    for(const it of items){
      if(it.sprite){ctx.restore();it.sprite.draw();ctx.save();ctx.lineJoin='round';ctx.lineWidth=.6;continue}
      const p=it.mesh.pos,o=it.t*9,a=view.project(p[o],p[o+1],p[o+2]),b=view.project(p[o+3],p[o+4],p[o+5]),c=view.project(p[o+6],p[o+7],p[o+8]);
      ctx.fillStyle=ctx.strokeStyle=it.mesh._fills[it.t];   // same-colour stroke hides seams
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.restore();
    return items.length;
  }
  // Cached painting for meshes that change rarely but are drawn every frame (construction
  // sites): painted once into an offscreen canvas and blitted at the projected anchor.
  // Panning only moves the anchor; a zoom stretches the old bitmap until the scale has been
  // steady for REPAINT_MS, then repaints. key: anything that changes the picture.
  const sprites=new Map(),REPAINT_MS=250,MAX_SIDE=4096,FRAME_MS=12;
  let lastScale=null,lastScaleAt=0,lastRepaint=-Infinity;
  function drawCached(ctx,id,key,build,anchor){
    const now=typeof performance!=='undefined'?performance.now():Date.now(),scale=State.view.scale;
    if(scale!==lastScale){lastScale=scale;lastScaleAt=now}
    const view=gameView(),dpr=(typeof devicePixelRatio==='number'&&devicePixelRatio)||1;
    const full=[key,State.view.rotation||0,typeof isPlanView==='function'&&isPlanView()?1:0,dpr,State.season].join('|');
    let e=sprites.get(id);
    // At most one repaint per frame (load, view turn, stage change, end of a zoom): the
    // others keep showing their previous bitmap (stretched to the zoom) until their turn.
    const settling=now-lastScaleAt<REPAINT_MS,turn=now-lastRepaint>=FRAME_MS;
    const want=!e||e.key!==full||e.scale!==scale;
    // A deferred repaint asks for another frame (the paused game draws only on request).
    if(want&&(!turn||settling)&&typeof requestSceneDraw==='function')requestSceneDraw();
    if(want&&!turn&&!e)return 0;
    if(want&&turn&&!(e&&e.key===full&&settling)){
      lastRepaint=now;
      const meshes=build().filter(m=>m&&m.col.length);
      if(!meshes.length){sprites.delete(id);return 0}
      let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for(const m of meshes)for(let i=0;i<m.pos.length;i+=3){
        const p=view.project(m.pos[i],m.pos[i+1],m.pos[i+2]);
        if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y;
      }
      x0-=2;y0-=2;x1+=2;y1+=2;
      const w=Math.ceil((x1-x0)*dpr),h=Math.ceil((y1-y0)*dpr);
      if(!(w>0&&h>0)||w>MAX_SIDE||h>MAX_SIDE||typeof document==='undefined'){sprites.delete(id);return drawMeshes(ctx,meshes,view)}
      const canvas=e?.canvas||document.createElement('canvas');canvas.width=w;canvas.height=h;
      const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,-x0*dpr,-y0*dpr);g.clearRect(x0,y0,x1-x0,y1-y0);
      drawMeshes(g,meshes,view);
      const a=view.project(anchor.x,anchor.y,anchor.z||0);
      e={key:full,scale,canvas,dx:x0-a.x,dy:y0-a.y,w:x1-x0,h:y1-y0};
      sprites.set(id,e);
    }
    e.used=now;
    const a=view.project(anchor.x,anchor.y,anchor.z||0),r=scale/e.scale;
    ctx.drawImage(e.canvas,a.x+e.dx*r,a.y+e.dy*r,e.w*r,e.h*r);
    if(sprites.size>96)for(const [k,v] of sprites)if(now-v.used>10000)sprites.delete(k);
    return 1;
  }
  // The game's own projection (w2sRaw / rotateViewPoint / plan view) as a painter view.
  function gameView(){
    const plan=typeof isPlanView==='function'&&isPlanView();
    return{turns:State.view.rotation||0,
      project:(x,y,z)=>w2sRaw({x,y},z),
      depth:(x,y,z)=>{if(plan)return z;const q=rotateViewPoint({x,y});return q.x+q.y+ISO_Z*z}};
  }
  window.ConquerMesh3D={rgb,toHex,rotDir,shadeFactor,shadedHex,drawMeshes,drawCached,gameView};
})();
