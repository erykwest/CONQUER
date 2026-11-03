'use strict';
// CONQUER wagons in 3D: assembles the Blender-built parts (src/assets/wagon-model.js,
// ASSETS/blender/build_wagon.py) at any heading, rolls the wheels, shades faces with the
// castle's two-tone side rule, and draws them depth-sorted on a 2D canvas together with
// the team and driver sprites. worldTriangles() gives the same geometry in world units
// for the WebGL scene. Classic script; geometry maths is pure.
(function(){
  const M=()=>window.ConquerWagonModel;
  const rgbCache=new Map();
  function rgb(hex){
    let v=rgbCache.get(hex);if(v)return v;
    const h=hex.replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
    rgbCache.set(hex,v);return v;
  }
  // Ground-plane quarter turns of the camera (same convention as rotateViewPoint).
  function rotDir(x,y,turns){
    const q=((turns%4)+4)%4;
    return q===1?[-y,x]:q===2?[-x,-y]:q===3?[y,-x]:[x,y];
  }
  // Castle rule: top faces take the base colour; side faces get one of two tones by
  // their facing relative to the light at 30 degrees (castleSideShade).
  function shadeFactor(nx,ny,nz,turns){
    const len=Math.hypot(nx,ny,nz)||1;
    if(nz/len>.5)return 1;
    if(nz/len<-.5)return .5;
    const [ex,ey]=rotDir(-ny,nx,turns),angle=Math.atan2(ey,ex);
    return Math.cos(2*(angle-Math.PI/6))>=0?.84:.68;
  }
  // Pale materials (fresh wood, straw) keep more of their tone in shade.
  function soften(f,[r,g,b]){return(r+g+b)/765>.7?1-(1-f)*.55:f}
  // Chassis: 'wagon' (four wheels, open bed), 'cart' (two wheels) or 'carriage'
  // (closed noble coach: passengers ride inside, so it takes no cargo).
  const CHASSIS=['wagon','cart','carriage'];
  // Which parts make this wagon, where, and how each one moves.
  function assembly(spec={}){
    const m=M(),v=m.variants[CHASSIS.includes(spec.chassis)?spec.chassis:'wagon'];
    const team=Math.max(0,Math.min(2,spec.team?.length??0));
    const out=[{part:v.body}];
    if(team)out.push({part:v.hitch[String(team)]});
    for(const w of v.wheels)for(const at of w.at)out.push({part:w.part,wheel:true,r:w.r,at});
    const cargo=(spec.cargo||[]).filter(k=>m.cargo[k]).slice(0,v.slots.length);
    cargo.forEach((k,i)=>out.push({part:m.cargo[k],at:v.slots[i],cargo:k}));
    return{variant:v,parts:out,team};
  }
  // Model point -> world: optional wheel spin about the local y axis, mount offset,
  // heading about z, then the wagon position. pose: {x,y,z,heading,distance,bob}.
  function placer(pose){
    const c=Math.cos(pose.heading||0),s=Math.sin(pose.heading||0);
    return(px,py,pz)=>[pose.x+px*c-py*s,pose.y+px*s+py*c,(pose.z||0)+pz];
  }
  // World-space triangles: Float32Array xyz per vertex and per-triangle base rgb.
  function worldTriangles(spec,pose){
    const m=M(),{parts,variant}=assembly(spec),place=placer(pose),pos=[],col=[],bias=[];
    // Painter hint for the canvas path: the bed floor goes first (cargo sits on it).
    // WebGL ignores it (depth buffer).
    const floorTop=variant.slots[0]?.[2]??-1;
    const bob=pose.bob||0,dist=pose.distance||0;
    for(const inst of parts){
      const p=m.parts[inst.part];if(!p)continue;
      const at=inst.at||[0,0,0],a=inst.wheel?dist/inst.r:0,ca=Math.cos(a),sa=Math.sin(a);
      const lift=inst.wheel?0:bob;
      for(let t=0;t<p.c.length;t++){
        for(let k=0;k<3;k++){
          let x=p.v[t*9+k*3],y=p.v[t*9+k*3+1],z=p.v[t*9+k*3+2];
          if(inst.wheel){const x2=x*ca+z*sa;z=-x*sa+z*ca;x=x2}
          const w=place(x+at[0],y+at[1],z+at[2]+lift);
          pos.push(w[0],w[1],w[2]);
        }
        col.push(m.palette[p.c[t]]);
        const z0=p.v[t*9+2],z1=p.v[t*9+5],z2=p.v[t*9+8];
        bias.push(inst.part===variant.body&&Math.abs(z0-floorTop)<.003&&Math.abs(z1-floorTop)<.003&&Math.abs(z2-floorTop)<.003?-100:0);
      }
    }
    return{pos:new Float32Array(pos),col,bias};
  }
  // Mount points in world space for the caller's sprites.
  function anchors(spec,pose){
    const {variant,team}=assembly(spec),place=placer(pose),bob=pose.bob||0;
    const seat=variant.seat?place(variant.seat[0],variant.seat[1],variant.seat[2]+bob):null;
    const horses=team?variant.horses[String(team)].map(([hx,hy])=>{const w=place(hx,hy,0);return{x:w[0],y:w[1],z:w[2]}}):[];
    return{seat:seat&&{x:seat[0],y:seat[1],z:seat[2]},horses};
  }
  // Canvas drawing. view: {project(x,y,z)->{x,y}, depth(x,y,z)->n (larger = nearer), turns}.
  // sprites: [{x,y,z,draw()}] drawn in depth order with the triangles (team, driver).
  // Depth-sorted canvas drawing of any number of meshes ({pos,col,bias,outward} in
  // world space) plus sprites. view: {project(x,y,z)->{x,y}, depth(x,y,z)->n (larger
  // = nearer), turns}; sprites: [{x,y,z,draw()}] (driver, 2D figures).
  function drawMeshes(ctx,meshes,view,sprites=[]){
    const items=[];let total=0;
    const d0=view.depth(0,0,0),cam=[view.depth(1,0,0)-d0,view.depth(0,1,0)-d0,view.depth(0,0,1)-d0];
    for(const mesh of meshes){
      const {pos,col,bias,outward,gi,groups}=mesh,n=col.length;total+=n;
      // Meshes made of rigid parts (animals) sort part by part: primary key the
      // part centre, secondary the triangle; plain meshes sort per triangle.
      const gd=groups?groups.map(c=>view.depth(c[0],c[1],c[2])):null;
      for(let t=0;t<n;t++){
        const o=t*9,ax=pos[o],ay=pos[o+1],az=pos[o+2],bx=pos[o+3],by=pos[o+4],bz=pos[o+5],cx=pos[o+6],cy=pos[o+7],cz=pos[o+8];
        const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
        const o2=outward?.[t];
        if(o2&&o2[0]*cam[0]+o2[1]*cam[1]+o2[2]*cam[2]<=0)continue;
        const td=view.depth((ax+bx+cx)/3,(ay+by+cy)/3,(az+bz+cz)/3)+(bias?.[t]||0);
        items.push({mesh,t,d:gd?gd[gi[t]]:td,d2:gd?td:0,f:soften(shadeFactor(nx,ny,nz,view.turns||0),rgb(col[t]))});
      }
    }
    for(const s of sprites)items.push({sprite:s,d:view.depth(s.x,s.y,s.z||0),d2:0});
    items.sort((a,b)=>a.d-b.d||a.d2-b.d2);
    ctx.save();ctx.lineJoin='round';ctx.lineWidth=.6;
    for(const it of items){
      if(it.sprite){ctx.restore();it.sprite.draw();ctx.save();ctx.lineJoin='round';ctx.lineWidth=.6;continue}
      const pos=it.mesh.pos,o=it.t*9,a=view.project(pos[o],pos[o+1],pos[o+2]),b=view.project(pos[o+3],pos[o+4],pos[o+5]),c=view.project(pos[o+6],pos[o+7],pos[o+8]);
      const [r,g,bl]=rgb(it.mesh.col[it.t]),f=it.f;
      const fill='rgb('+(r*f|0)+','+(g*f|0)+','+(bl*f|0)+')';
      ctx.fillStyle=ctx.strokeStyle=fill;   // same-colour stroke hides anti-alias seams
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.restore();
    return total;
  }
  // Wagon plus optional extra meshes (its 3D team) in one depth order.
  function draw(ctx,spec,pose,view,sprites=[],extra=[]){
    return drawMeshes(ctx,[worldTriangles(spec,pose),...extra],view,sprites);
  }
  window.ConquerWagons3D={CHASSIS,assembly,worldTriangles,anchors,draw,drawMeshes,shadeFactor,rotDir};})();
