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
    if(nz/len>.5)f=1;
    else if(nz/len<-.5)f=.5;
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
  // Depth-sorted painter. meshes: [{pos,col,gi?,groups?,groupBias?}] in world space;
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
          const [nx,ny,nz]=triNormal(pos,t*9),[r,g,b]=rgb(col[t]),f=shadeFactor(nx,ny,nz,turns,[r,g,b]);
          mesh._fills[t]='rgb('+(r*f|0)+','+(g*f|0)+','+(b*f|0)+')';
        }
      }
      for(let t=0;t<n;t++){
        const o=t*9;
        const td=view.depth((pos[o]+pos[o+3]+pos[o+6])/3,(pos[o+1]+pos[o+4]+pos[o+7])/3,(pos[o+2]+pos[o+5]+pos[o+8])/3);
        items.push({mesh,t,d:gd?gd[gi[t]]:td,d2:gd?td:0});
      }
    }
    // Sprites may pin their order (d, d2), e.g. a decal right after its part's triangles.
    for(const s of sprites)items.push({sprite:s,d:s.d??view.depth(s.x,s.y,s.z||0),d2:s.d2??0});
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
  // The game's own projection (w2sRaw / rotateViewPoint / plan view) as a painter view.
  function gameView(){
    const plan=typeof isPlanView==='function'&&isPlanView();
    return{turns:State.view.rotation||0,
      project:(x,y,z)=>w2sRaw({x,y},z),
      depth:(x,y,z)=>{if(plan)return z;const q=rotateViewPoint({x,y});return q.x+q.y+ISO_Z*z}};
  }
  window.ConquerMesh3D={rgb,toHex,rotDir,shadeFactor,shadedHex,drawMeshes,gameView};
})();
