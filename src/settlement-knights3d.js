'use strict';
// CONQUER mounted figures in 3D: the Blender-built horse (settlement-animals3d.js)
// with its gear and rider (src/assets/knight-models.js, ASSETS/blender/
// build_knights.py). Two kinds:
//   knight    - heraldic caparison, chanfron, mail and surcoat, couched lance, kite shield;
//   messenger - light saddle on a heraldic blanket, rider dressed like the foot soldiers.
// Gear rides the horse's body / neck / head and follows its gait; the knight's lance
// is raised at rest, couched when engaged or charging and driven home on the strike;
// a dying rider falls from the saddle. Realm colours replace 'heraldA/B' and the
// realm's arms are painted on the shield and the caparison flanks (decals). The
// iso projection is affine, so a planar decal maps exactly with one canvas transform.
(function(){
  const KM=()=>window.ConquerKnightModels,A3=()=>window.ConquerAnimals3D;
  const KINDS={knight:{gear:'gear_armoured',rider:'rider_knight'},messenger:{gear:'gear_light',rider:'rider_messenger'}};
  const COATS=['brown','black','grey','white'];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function rgbHex(hex){const h=hex.replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))}
  const toHex=c=>'#'+c.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
  const whiten=(hex,k)=>k>0?toHex(rgbHex(hex).map(v=>v+(255-v)*k)):hex;
  function hash(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
  // A stable coat per rider id (white horses stay rare).
  const coatFor=id=>COATS[hash(id)%7%4];
  // Palette with the realm livery and a hit flash.
  function paletteFor(livery,flash){
    const m=KM();
    return m.paletteKeys.map((k,i)=>whiten(k==='heraldA'?livery.main:k==='heraldB'?livery.alt:m.palette[i],flash*.6));
  }
  // How far the lance is lowered (0 raised .. 1 couched) and how far it is driven.
  function lanceState(pose,gait){
    const lower=clamp(Math.max(pose.ready*.9,gait==='run'?1:0)+Math.max(0,pose.attack)*.2,0,1);
    const thrust=pose.attack>0?pose.attack*.32:pose.attack*.18;
    return{lower,thrust};
  }
  // Rider-local motion (horse model space, before the horse's own transform).
  function riderLocal(kit,partName,ls,fall,side){
    const P=A3().pitch,R=A3().roll,grip=kit.meta.grip,seat=kit.meta.seat;
    return p=>{
      if(partName==='lance'&&grip){
        // Raised: the lance stands up at the grip, tip forward; couched: as modelled.
        p=P(p,grip,-(1-ls.lower)*1.32);
        const dir=[Math.cos((1-ls.lower)*1.32),0,Math.sin((1-ls.lower)*1.32)];
        p=[p[0]+dir[0]*ls.thrust,p[1],p[2]+dir[2]*ls.thrust];
      }else if(partName==='armR'&&grip){
        p=[p[0]+ls.thrust*.6,p[1],p[2]+(1-ls.lower)*.05];
      }
      if(fall>0){
        // Out of the saddle, away from the foe: roll over the horse's flank and drop.
        const pivot=[seat[0],side*.13,seat[2]*.62];
        p=R(p,pivot,side*fall*1.5);
        p=[p[0]-fall*.05,p[1]+side*fall*.08,p[2]-fall*seat[2]*.42];
      }
      return p;
    };
  }
  // Everything one mounted figure needs: world mesh + decals.
  // place {x,y,z,heading}; anim {mode:'idle'|'walk'|'run', t, seed, from, blend};
  // pose: ConquerCombatAnim.pose() fields (ready, attack, flash, fall, alpha) or {}.
  function build(kind,place,anim,pose={},livery,coat){
    const m=KM(),spec=KINDS[kind]||KINDS.knight;
    const gear=m.kits[spec.gear],rider=m.kits[spec.rider];
    const flash=pose.flash||0,fall=pose.fall||0,pal=paletteFor(livery,flash);
    const gait=anim.mode==='run'?'run':anim.mode==='walk'?'walk':'idle';
    const ls=lanceState({ready:pose.ready||0,attack:pose.attack||0},gait);
    // The rider tumbles to the side away from the foe (the left by default).
    const side=pose.fallSide||1;
    const extras=[],decalSrc=[];
    // Gear paints right after the horse part it covers (saddle over the cloth).
    const OVER={caparison:.01,capPanels:.012,blanket:.01,saddle:.02,crinet:.01,chanfron:.01,bridle:.015};
    for(const [name,part] of Object.entries(gear.parts))
      extras.push({name,kit:gear,bind:part.bind,v:part.v,col:part.c.map(i=>pal[i]),over:OVER[name]||.01});
    for(const [name,part] of Object.entries(rider.parts))
      extras.push({name,kit:rider,bind:part.bind,v:part.v,col:part.c.map(i=>pal[i]),local:riderLocal(rider,name,ls,fall,side)});
    const horseColors=A3().coatColors('horse',coat||'brown');
    if(flash>0)for(const k of Object.keys(horseColors))horseColors[k]=whiten(horseColors[k],flash*.6);
    const mesh=A3().triangles('horse',place,{...anim,mode:gait==='idle'?'idle':gait},horseColors,extras);
    // Decals follow the same transforms as the part they are printed on.
    const decals=[];
    for(const kit of [gear,rider])for(const [key,d] of Object.entries(kit.decals||{})){
      const ei=extras.findIndex(e=>e.kit===kit&&e.name===d.part);if(ei<0)continue;
      const e=extras[ei],tf=q=>mesh.xf(e.bind,e.local?e.local([...q]):[...q]);
      decals.push({key,o:tf(d.o),u:tf(d.u),v:tf(d.v),clip:d.clip,group:mesh.extraGroups[ei]});
    }
    return{mesh,decals,alpha:pose.alpha??1};
  }
  // Canvas: the mounted figure depth-sorted with its decals. view = ConquerMesh3D view.
  // paint(ctx,x,y,w,h) paints the realm arms (window.__conquerHeraldryCanvas.paint).
  function draw(ctx,view,kind,place,anim,pose,livery,coat,paint){
    const fig=build(kind,place,anim,pose,livery,coat),W=window.ConquerMesh3D;
    if(fig.alpha<=0)return 0;
    const sprites=[];
    if(paint)for(const d of fig.decals){
      const g=fig.mesh.groups[d.group];
      sprites.push({x:g[0],y:g[1],z:g[2],d:view.depth(g[0],g[1],g[2])+(fig.mesh.groupBias?.[d.group]||0),d2:1e9,draw:()=>{
        const a=view.project(...d.o),b=view.project(...d.u),c=view.project(...d.v);
        const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-a.x,vy=c.y-a.y;
        // Printed on the outer face only: skip when the face turns away or edge-on.
        if(ux*vy-uy*vx<=1)return;
        ctx.save();
        ctx.globalAlpha*=fig.alpha;
        ctx.transform(ux,uy,vx,vy,a.x,a.y);
        if(d.clip){ctx.beginPath();d.clip.forEach(([cu,cv],i)=>i?ctx.lineTo(cu,cv):ctx.moveTo(cu,cv));ctx.closePath();ctx.clip()}
        paint(ctx,0,0,1,1);
        ctx.restore();
      }});
    }
    ctx.save();ctx.globalAlpha*=fig.alpha;
    const n=W.drawMeshes(ctx,[fig.mesh],view,sprites);
    ctx.restore();
    return n;
  }
  // Flat style (the foot soldiers' look): each rigid part is one silhouette in a flat
  // colour with a dark outline, parts painted back to front; no face shading.
  // Returns [{fill, tris:[[x,y]x3]...}] in screen space, shared by canvas and SVG.
  function flatLayers(fig,view){
    const m=fig.mesh,order=m.groups.map((c,i)=>({i,d:view.depth(c[0],c[1],c[2])+(m.groupBias?.[i]||0)})).sort((a,b)=>a.d-b.d);
    const byGroup=m.groups.map(()=>[]);
    for(let t=0;t<m.col.length;t++){
      const o=t*9,P=k=>{const p=view.project(m.pos[o+k*3],m.pos[o+k*3+1],m.pos[o+k*3+2]);return[p.x,p.y]};
      const depth=view.depth((m.pos[o]+m.pos[o+3]+m.pos[o+6])/3,(m.pos[o+1]+m.pos[o+4]+m.pos[o+7])/3,(m.pos[o+2]+m.pos[o+5]+m.pos[o+8])/3);
      byGroup[m.gi[t]].push({fill:m.col[t],pts:[P(0),P(1),P(2)],depth});
    }
    return order.map(({i})=>Object.assign(byGroup[i].sort((a,b)=>a.depth-b.depth),{group:i}));
  }
  const OUTLINE='rgba(25,24,22,.92)';
  function drawFlat(ctx,view,kind,place,anim,pose,livery,coat,paint,lw=1.6){
    const fig=build(kind,place,anim,pose,livery,coat);
    if(fig.alpha<=0)return;
    ctx.save();ctx.globalAlpha*=fig.alpha;ctx.lineJoin='round';
    const layers=flatLayers(fig,view);
    layers.forEach((tris,li)=>{
      if(!tris.length)return;
      // Outline: the whole part stroked thick in dark, then filled over.
      ctx.beginPath();for(const t of tris){ctx.moveTo(...t.pts[0]);ctx.lineTo(...t.pts[1]);ctx.lineTo(...t.pts[2]);ctx.closePath()}
      ctx.strokeStyle=OUTLINE;ctx.lineWidth=lw*2;ctx.stroke();
      for(const t of tris){ctx.fillStyle=ctx.strokeStyle=t.fill;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(...t.pts[0]);ctx.lineTo(...t.pts[1]);ctx.lineTo(...t.pts[2]);ctx.closePath();ctx.fill();ctx.stroke()}
      // The realm arms on the faces of this part (shield, caparison flanks).
      if(paint)for(const d of fig.decals)if(d.group===tris.group){
        const a=view.project(...d.o),b=view.project(...d.u),c=view.project(...d.v);
        const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-a.x,vy=c.y-a.y;if(ux*vy-uy*vx<=1)continue;
        ctx.save();ctx.transform(ux,uy,vx,vy,a.x,a.y);
        if(d.clip){ctx.beginPath();d.clip.forEach(([cu,cv],i)=>i?ctx.lineTo(cu,cv):ctx.moveTo(cu,cv));ctx.closePath();ctx.clip()}
        paint(ctx,0,0,1,1);ctx.restore();
      }
    });
    ctx.restore();
  }
  // SVG of one frame (same flat layers): for review sheets and offline sprites.
  function toSVG(kind,heading,anim,pose,livery,coat,size=320){
    const s=size*1.15,view={turns:0,project:(x,y,z)=>({x:size/2+(x-y)*s*.866,y:size*.86+(x+y)*s*.5-z*s*.9}),depth:(x,y,z)=>x+y+.9*z};
    const layers=flatLayers(build(kind,{x:0,y:0,heading},anim,pose,livery,coat),view),f=v=>v.toFixed(1);
    const body=layers.filter(l=>l.length).map(tris=>{
      const d=tris.map(t=>'M'+t.pts.map(p=>f(p[0])+' '+f(p[1])).join('L')+'Z').join('');
      return '<path d="'+d+'" fill="none" stroke="#191816" stroke-width="3.2" stroke-linejoin="round"/>'+
        tris.map(t=>'<path d="M'+t.pts.map(p=>f(p[0])+' '+f(p[1])).join('L')+'Z" fill="'+t.fill+'" stroke="'+t.fill+'" stroke-width=".6"/>').join('');
    }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+body+'</svg>';
  }
  window.ConquerKnights3D={KINDS,build,draw,drawFlat,toSVG,coatFor,lanceState};
})();
