'use strict';
// CONQUER houses in 3D (L1 cottages, L2 and L3 townhouses): the game's own procedural plans dressed with the Blender kit
// (src/assets/house-models.js, tools/blender/build_houses.py). Plans, proportions, rows, wings,
// windows, timber frame, door and chimneys keep their rules (urbanHouseGeometry, houseFacadePlan,
// houseDoorInfo, chimneySpecs); walls and timber members become solids with thickness, and the
// windows, door, roof, chimneys and jetty joists are kit pieces. Every wall gets its timber frame
// and windows, whatever the camera. World 3D (WebGL2) only: the 2.5D Canvas fallback keeps its own
// procedural drawing, since without a depth buffer the kit's roofs and gables cannot be ordered.
// Collisions, occlusion and lots keep reading the plain plans (urbanHouseFaces).
(function(){
  const DATA=()=>window.ConquerHouseModels;
  const WINTER=['#e7ece8','#dce3de'];
  const STONE=['#625e59','#4f4b47'],PLASTER=['#e0ca91','#c8ae70'],SOFFIT='#4a3626',TIMBER='#3b2a1e',GABLE='#d9c184';
  const DOOR_HW=.08,CHIMNEY_H=.48,TIMBER_OUT=.018,JOIST_STEP=.2,JOIST_H=.07;
  // L1 cottages: low daub walls in the procedural houses' browns, timber frame, thatch.
  const DAUB=['#654936','#4e392d'];
  // L2 houses are drawn like L3 ones (stone ground floor, jettied timber floor) on a single body.
  const LEVELS=new Set([1,2,3]);
  function handles(s){
    return !!s&&s.type==='house'&&LEVELS.has(houseLevel(s))&&!!DATA()&&!!window.ConquerMesh3D&&
      !(typeof underConstruction==='function'&&underConstruction(s));
  }
  // Indexed kit parts expanded once into flat triangle lists.
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
  // Kit palette (winter roofs white) through the brick masonry swatches, like the procedural houses.
  const tint=hex=>typeof visualPaletteColor==='function'?visualPaletteColor(hex):hex;
  // In clay (brick masonry or the clay palette) the kit's own stone and slate details borrow the
  // swatch of a matching stone / slate tone of CLAY_VISUAL_SWATCHES: dressed surrounds and the step
  // turn to light brick, slate courses and ridge to dark tile, instead of staying grey on brick.
  const CLAY_ALIAS={stoneTrim:'#9a8e82',step:'#887d72',roofCourse:'#303236',roofRidge:'#303236'};
  function kitPalette(){
    const data=DATA(),winter=State.season==='winter',clay=tint(STONE[0])!==STONE[0];
    return data.palette.map((hex,i)=>{
      const k=data.paletteKeys[i];
      if(winter&&k.startsWith('roof'))return tint(WINTER[/Dark$|Ridge$|Course$/.test(k)?1:0]);
      return tint(clay&&CLAY_ALIAS[k]||hex);
    });
  }

  // ---------- mesh in the civic layout {pos,col,gi,groups,groupBias}
  // stats: kit pieces and timber members placed (the regression checks every wall got its share).
  // tag per triangle for the construction assembly: body (walls, openings), beam (timber frame,
  // rising ahead of the infill), gable, roof (roofs and chimneys, laid last).
  function meshOut(){return{pos:[],col:[],gi:[],tag:[],groups:[],groupBias:[],stats:{}}}
  function group(m,bias=0,tag='body'){const g={m,start:m.pos.length,index:m.groups.length,tag};m.groups.push(null);m.groupBias.push(bias);return g}
  function close(g){
    const m=g.m,p=m.pos;let cx=0,cy=0,cz=0,n=0;
    for(let i=g.start;i<p.length;i+=3){cx+=p[i];cy+=p[i+1];cz+=p[i+2];n++}
    m.groups[g.index]=n?[cx/n,cy/n,cz/n]:[0,0,0];
  }
  function poly(g,pts,hex){
    const m=g.m;
    for(let i=1;i<pts.length-1;i++){for(const q of [pts[0],pts[i],pts[i+1]])m.pos.push(q[0],q[1],q[2]);m.col.push(hex);m.gi.push(g.index);m.tag.push(g.tag)}
  }
  // A kit piece: local (x along tangent t, y along outward n, z up) at origin o, scaled per axis.
  function piece(m,key,o,t,n,{sx=1,sy=1,sz=1,bias=0,tag='body'}={},pal){
    m.stats[key]=(m.stats[key]||0)+1;
    const g=group(m,bias,tag);
    for(const part of parts(key)){
      const v=part.v;
      for(let i=0;i<v.length;i+=9){
        for(let k=0;k<3;k++){const x=v[i+k*3]*sx,y=v[i+k*3+1]*sy,z=v[i+k*3+2]*sz;m.pos.push(o.x+t.x*x+n.x*y,o.y+t.y*x+n.y*y,o.z+z)}
        m.col.push(pal[part.c[i/9]]);m.gi.push(g.index);m.tag.push(tag);
      }
    }
    close(g);
  }
  // A timber member on a wall: from wall point p0 to p1 ({off,z}), HOUSE_TIMBER_W wide in the wall
  // plane, standing TIMBER_OUT proud of it.
  function member(g,at,o,ground,p0,p1){
    const doff=p1.off-p0.off,dz=p1.z-p0.z,L=Math.hypot(doff,dz)||1,w=HOUSE_TIMBER_W/2;
    const qo=-dz/L*w,qz=doff/L*w;   // in-plane perpendicular (along the wall, up)
    g.m.stats.members=(g.m.stats.members||0)+1;
    const P=(q,s,d)=>{const c=at(q.off+qo*s);return[c.x+o.x*d,c.y+o.y*d,ground+q.z+qz*s]};
    const A=[P(p0,1,0),P(p1,1,0),P(p1,-1,0),P(p0,-1,0)],B=[P(p0,1,TIMBER_OUT),P(p1,1,TIMBER_OUT),P(p1,-1,TIMBER_OUT),P(p0,-1,TIMBER_OUT)];
    poly(g,B,tint(TIMBER));
    for(let i=0;i<4;i++){const j=(i+1)%4;poly(g,[A[i],A[j],B[j],B[i]],tint(SOFFIT))}
  }
  const edgesOf=P=>P.map((a,i)=>({a,b:P[(i+1)%P.length],index:i}));
  function outward(edge,c){
    const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1;let nx=-dy/L,ny=dx/L;
    const mx=(edge.a.x+edge.b.x)/2,my=(edge.a.y+edge.b.y)/2;if(nx*(mx-c.x)+ny*(my-c.y)<0){nx=-nx;ny=-ny}
    return{x:nx,y:ny};
  }
  // Kit roof on a part's ridge: x along the ridge, y by the span, z by the rise (60-degree roof: a
  // unit span rises HOUSE_ROOF_PITCH/2; thatch: a unit rise, since L1 ridges are fixed at 1.45 U).
  function roofPiece(m,house,part,pal,key,unitRise){
    const turn=part.roofTurn||0,angle=Number.isFinite(part.roofAngle)?part.roofAngle:(house.angle||0)+turn;
    const across=Math.abs(turn)>1e-6,rw=across?part.h:part.w,span=across?part.w:part.h;
    const ra={x:Math.cos(angle),y:Math.sin(angle)},rn={x:-ra.y,y:ra.x};
    const rise=Math.max(.05,(part.roofH??housePartRidge(house,part))-part.bodyH);
    piece(m,key,{x:part.center.x,y:part.center.y,z:terrainElevation(part.center)+part.bodyH},ra,rn,{sx:rw,sy:span,sz:rise/unitRise,tag:'roof'},pal);
  }
  // A wall edge: tangent, outward normal, point at an offset, kit tangent (+x turned to +y = out).
  function wallFrame(edge,c){
    const o=outward(edge,c),L=dist(edge.a,edge.b)||1,ux=(edge.b.x-edge.a.x)/L,uy=(edge.b.y-edge.a.y)/L;
    const mx=(edge.a.x+edge.b.x)/2,my=(edge.a.y+edge.b.y)/2;
    return{o,L,at:off=>({x:mx+ux*off,y:my+uy*off}),tk:ux*o.y-uy*o.x>0?{x:ux,y:uy}:{x:-ux,y:-uy}};
  }
  // L1 cottage: daub walls on a timber frame (corner posts, sill and wall plates, posts beside the
  // windows), unglazed shuttered windows where houseFacadePlan puts them, a thatched roof.
  function cottagePart(m,house,part,pal){
    const ground=terrainElevation(part.center),H=part.bodyH,P=part.points,n=P.length,t=HOUSE_TIMBER_W/2;
    for(const edge of edgesOf(P)){
      const g=group(m);
      poly(g,[[edge.a.x,edge.a.y,ground],[edge.b.x,edge.b.y,ground],[edge.b.x,edge.b.y,ground+H],[edge.a.x,edge.a.y,ground+H]],tint(DAUB[edge.index%2]));close(g);
    }
    const faces=urbanHouseFaces(house,part);
    for(const f of [faces[n+2],faces[n+3]]){const g=group(m,0,'gable');poly(g,f.map(v=>[v.p.x,v.p.y,v.z]),tint(DAUB[0]));close(g)}
    for(const edge of edgesOf(P)){
      const {o,L,at,tk}=wallFrame(edge,part.center),half=L/2,plan=houseFacadePlan(house,part,edge),g=group(m,0,'beam');
      const frame=[[{off:-half+t,z:0},{off:-half+t,z:H}],[{off:half-t,z:0},{off:half-t,z:H}],
        [{off:-half,z:t},{off:half,z:t}],[{off:-half,z:H-t},{off:half,z:H-t}]];
      for(const w of plan.windows)for(const s of [-1,1]){const x=w.off+s*(HOUSE_WINDOW_HALF_W+.024+t);frame.push([{off:x,z:t},{off:x,z:H-t}])}
      for(const [p0,p1] of frame)member(g,at,o,ground,p0,p1);
      close(g);
      for(const w of plan.windows){const c=at(w.off);piece(m,'windowCottage',{x:c.x,y:c.y,z:ground+w.z},tk,o,{},pal)}
    }
    roofPiece(m,house,part,pal,'roofThatch',1);
  }
  // ---------- one house
  function build(house,entry){
    const m=meshOut(),pal=kitPalette(),jetty=houseJetty(house),cottage=houseLevel(house)===1;
    for(const part of entry.parts){
      if(part.kind!=='body')continue;
      if(cottage){cottagePart(m,house,part,pal);continue}
      const ground=terrainElevation(part.center),bodyH=part.bodyH,fb=houseFloorBreak(bodyH),top=ground+bodyH;
      const P=part.points,B=part.basePoints||P,n=P.length;
      // Stone ground floor on the recessed base, plastered timbered floor above, jetty soffits.
      for(const edge of edgesOf(B)){
        const g=group(m);
        poly(g,[[edge.a.x,edge.a.y,ground],[edge.b.x,edge.b.y,ground],[edge.b.x,edge.b.y,ground+fb],[edge.a.x,edge.a.y,ground+fb]],tint(STONE[edge.index%2]));close(g);
      }
      for(const edge of edgesOf(P)){
        const g=group(m);
        poly(g,[[edge.a.x,edge.a.y,ground+fb],[edge.b.x,edge.b.y,ground+fb],[edge.b.x,edge.b.y,top],[edge.a.x,edge.a.y,top]],tint(PLASTER[edge.index%2]));close(g);
        if(part.basePoints&&(edge.index===0||edge.index===2)){
          const ba=B[edge.index],bb=B[(edge.index+1)%n],s=group(m);
          poly(s,[[edge.a.x,edge.a.y,ground+fb],[edge.b.x,edge.b.y,ground+fb],[bb.x,bb.y,ground+fb],[ba.x,ba.y,ground+fb]],tint(SOFFIT));close(s);
        }
      }
      // Gable infill (the two triangles of urbanHouseFaces) under the kit roof.
      const faces=urbanHouseFaces(house,part);
      for(const f of [faces[n+2],faces[n+3]]){const g=group(m,0,'gable');poly(g,f.map(v=>[v.p.x,v.p.y,v.z]),tint(GABLE));close(g)}
      // Timber frame and windows on every wall (houseFacadePlan), the jetty joists under the overhang.
      for(const edge of edgesOf(P)){
        const o=outward(edge,part.center),L=dist(edge.a,edge.b)||1,ux=(edge.b.x-edge.a.x)/L,uy=(edge.b.y-edge.a.y)/L;
        const mx=(edge.a.x+edge.b.x)/2,my=(edge.a.y+edge.b.y)/2,at=off=>({x:mx+ux*off,y:my+uy*off}),t={x:ux,y:uy};
        // Kit pieces face out along +y: the tangent must turn +x into +y = o.
        const tk=ux*o.y-uy*o.x>0?t:{x:-ux,y:-uy};
        const plan=houseFacadePlan(house,part,edge),g=group(m,0,'beam');
        for(const [p0,p1] of plan.beams)member(g,at,o,ground,p0,p1);
        close(g);
        const recess=part.basePoints&&(edge.index===0||edge.index===2)?jetty:0;
        for(const w of plan.windows){
          const ground_=w.z<fb,k=ground_?recess:0,c=at(w.off);
          piece(m,ground_?'windowGround':'windowUpper',{x:c.x-o.x*k,y:c.y-o.y*k,z:ground+w.z},tk,o,{},pal);
        }
        if(recess){
          const door=houseDoorInfo(house),count=Math.max(2,Math.round(L/JOIST_STEP));
          for(let i=0;i<count;i++){
            const off=-L/2+L*(i+.5)/count,c=at(off),p={x:c.x-o.x*recess,y:c.y-o.y*recess};
            if(Math.hypot(p.x-(door.surface.x-door.normal.x*jetty),p.y-(door.surface.y-door.normal.y*jetty))<DOOR_HW+.07)continue;
            piece(m,'joist',{x:p.x,y:p.y,z:ground+fb-JOIST_H},tk,o,{sy:recess/.07},pal);
          }
        }
      }
      // A wing capped below the main ridge keeps its span and lowers its rise.
      roofPiece(m,house,part,pal,'roof',HOUSE_ROOF_PITCH*.5);
    }
    // The door (houseDoorInfo) in the recessed ground floor (the cottage has no jetty).
    const d=houseDoorInfo(house),hw=Math.min(.08,(Number(house.w)||1.5)*.0533);
    const dp={x:d.surface.x-d.normal.x*jetty,y:d.surface.y-d.normal.y*jetty,z:terrainElevation(d.surface)};
    const dt=d.tangent.x*d.normal.y-d.tangent.y*d.normal.x>0?d.tangent:{x:-d.tangent.x,y:-d.tangent.y};
    piece(m,cottage?'doorCottage':'door',dp,dt,d.normal,{sx:hw/DOOR_HW},pal);
    // Chimneys where chimneySpecs puts them.
    for(const c of chimneySpecs(house)){
      const g=terrainElevation(c.center),a=c.angle||0;
      piece(m,'chimney',{x:c.center.x,y:c.center.y,z:g+c.z0},{x:Math.cos(a),y:Math.sin(a)},{x:-Math.sin(a),y:Math.cos(a)},{sz:(c.z1-c.z0)/CHIMNEY_H,tag:'roof'},pal);
    }
    return m;
  }
  const cache=new Map();
  function geometry(house){
    const entry=urbanHouseGeometry().find(e=>e.house.id===house.id);if(!entry)return null;
    const urban=typeof urbanRevision!=='undefined'?urbanRevision:0;
    const key=[house.x,house.y,house.angle||0,house.w,house.h,house.doorSide,urban,State.season,State.visualPalette,
      typeof masonryMaterial==='function'?masonryMaterial(house):'stone',!!DATA()].join('|');
    const hit=cache.get(house.id);if(hit&&hit.key===key)return hit.mesh;
    const mesh=withStructureVisualMaterial(house,()=>build(house,entry));
    cache.set(house.id,{key,mesh});if(cache.size>2048)cache.clear();
    return mesh;
  }
  // WebGL: fixed-light shaded colours into a world3d mesh builder.
  function addToBuilder(m,house){
    if(!handles(house))return false;
    const mesh=geometry(house);if(!mesh)return false;
    const p=mesh.pos;
    for(let t=0;t<mesh.col.length;t++){
      const o=t*9;
      m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
    }
    return true;
  }
  // Interleaved x,y,z,r,g,b triangles (Asset Lab), base colours: the Lab shades faces itself.
  function worldTriangles(house){
    const mesh=handles(house)&&geometry(house);if(!mesh)return new Float32Array(0);
    const out=[],rgb=hex=>{const h=hex.replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};
    for(let t=0;t<mesh.col.length;t++){const c=rgb(mesh.col[t]);for(let k=0;k<3;k++)out.push(mesh.pos[t*9+k*3],mesh.pos[t*9+k*3+1],mesh.pos[t*9+k*3+2],c[0],c[1],c[2])}
    return new Float32Array(out);
  }
  window.ConquerHouse3D={handles,parts,geometry,addToBuilder,worldTriangles,clear:()=>cache.clear()};
})();
