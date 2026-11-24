'use strict';
// CONQUER castle 3D — world-space mesh builders for the castle (towers, walls, gates, built sections).
//
// Geometry is NOT duplicated here: every volume comes from the shared world-space builders
// (unionFootprintPoints, *BattlementPieces, machicolationFloorPolygon, towerRoofFootprintPoints,
// gateRoofGeometry, builtRoofGeometry, chimneySpecs, stone tower bases, wallExteriorLayout for
// hoarding). World 3D (settlement-world3d.js) draws worldMeshes(); the construction assembly reveals
// structureWorld() piece by piece. Flat colours reproduce castleSideShade / the union palette.
(()=>{
  const DEPTH_K=ISO_Z;                    // depth = q.x + q.y + ISO_Z*z (monotonic along the view ray)

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
    plaster:()=>['#e8dcc2','#d2c4a6','#bcae91'],                     // timber-framed storey (house plaster)
    ladderRail:()=>['#8b6a45','#73573a','#5e472f'],                 // cutaway ladder colours
    ladderRung:()=>['#b98652','#9a6f44','#7f5b37'],
    brazier:()=>['#5d4b3d','#493d34','#39312b','#7b654f'],      // drawBrazierFixture (BRAZIER_COLORS)
  };
  const rgbCache=new Map();
  function rgb(hex){
    const color=visualPaletteColor(hex);
    let v=rgbCache.get(color);if(v)return v;
    const h=color.replace('#','');v=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);
    rgbCache.set(color,v);return v;
  }

  function shadeHex(hex,k){
    const h=hex.replace('#','');
    return '#'+[0,2,4].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('');
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
  const winter=()=>(typeof isSnowGround==='function'?isSnowGround():State.season==='winter');

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
    for(const d of halfTowerFloorDecks(s))m.prism(d.pts,d.z0,d.z1,PAL.hoardDeck());
    for(const l of halfTowerLadders(s))m.prism(l.pts,l.z0,l.z1,l.part==='rung'?PAL.ladderRung():PAL.ladderRail());
    if(towerRoofStyle(s)==='pitched'){
      m.tag='roof';
      const ring=towerRoofFootprintPoints(s),apex=towerRoofApex(s),apexZ=towerVisualTopHeight(s);
      if(s.shape==='round'||s.shape==='dee'){
        const cols=winter()?[WINTER_SNOW_B,WINTER_SNOW_A,WINTER_SNOW_TOP]:['#303236','#3a3d42','#44474c'];
        m.pyramid(ring,h,apex,apexZ,i=>cols[i%3]);
      }else if(towerRoofShape(s)!=='pyramid'){
        // Two slopes with stone gables, or a hip roof on a short ridge (squareTowerRoofGeometry).
        for(const f of squareTowerRoofGeometry(s).faces){
          m.tag=f.kind==='gable'?'gable':'roof';
          m.face(f.pts,f.kind==='gable'?PAL.stone():winter()?(f.i%2?WINTER_SNOW_A:WINTER_SNOW_B):(f.i%2?'#34363a':'#42454a'));
        }
        m.tag='roof';
      }else{
        m.pyramid(ring,h,apex,apexZ,i=>winter()?(i%2?WINTER_SNOW_A:WINTER_SNOW_B):(i%2?'#34363a':'#42454a'));
      }
    }
    // Inner roof (BC-251105-05): kerb, then a pyramid or a cone inside the merlons.
    const inner=towerInnerRoofGeometry(s);
    if(inner){
      const tag=m.tag;m.tag='body';
      m.prism(inner.ring,inner.h,inner.eaveZ,PAL.stone());
      m.tag='roof';
      const round=inner.ring.length>8,cols=round?(winter()?[WINTER_SNOW_B,WINTER_SNOW_A,WINTER_SNOW_TOP]:['#303236','#3a3d42','#44474c']):null;
      for(const f of towerInnerRoofFaces(inner))m.face(f.pts,round?cols[f.i%3]:winter()?(f.i%2?WINTER_SNOW_A:WINTER_SNOW_B):(f.i%2?'#34363a':'#42454a'));
      m.tag=tag;
    }
    // Up inner tower: one-storey turret in the middle of the deck, then its cone / pyramid cap.
    const up=upInnerTowerGeometry(s);
    if(up){
      const tag=m.tag;m.tag='body';
      m.prism(up.ring,up.h,up.topZ,PAL.stone());
      m.face(up.ring.map(p=>({p,z:up.topZ})),PAL.stone());
      m.tag='roof';
      const round=up.shape==='round',cols=winter()?[WINTER_SNOW_B,WINTER_SNOW_A,WINTER_SNOW_TOP]:['#303236','#3a3d42','#44474c'];
      m.pyramid(up.eave,up.eaveZ,up.apex,up.apexZ,i=>round?cols[i%3]:winter()?(i%2?WINTER_SNOW_A:WINTER_SNOW_B):(i%2?'#34363a':'#42454a'));
      m.tag=tag;
    }
    for(const b of towerBartizans(s))addBartizan(m,b);
  }
  // Corbelled cone, moulding band and drum; the pitched kind adds a conical roof (merlons: addPieces).
  function addBartizan(m,b){
    const tag=m.tag;m.tag='body';
    m.frustum(b.corbel,b.ring,b.corbelZ,b.z0);
    m.face(b.corbel.map(p=>({p,z:b.corbelZ})),PAL.stone());
    m.prism(b.band,b.z0-.06,b.z0,PAL.corbel());
    m.prism(b.ring,b.z0,b.drumZ,PAL.stone());
    if(b.style==='pitched'){
      m.tag='roof';
      const cols=winter()?[WINTER_SNOW_B,WINTER_SNOW_A,WINTER_SNOW_TOP]:['#303236','#3a3d42','#44474c'];
      m.pyramid(b.eave,b.drumZ,b.center,b.apexZ,i=>cols[i%3]);
    }
    m.tag=tag;
  }
  function addGate(m,s){
    const g=gateRoofGeometry(s);if(!g)return;
    const H=g.h,R=g.ridgeH,sa=winter()?WINTER_SNOW_A:'#34363a',sb=winter()?WINTER_SNOW_B:'#42454a';
    // Gables: masonry, or plaster over a timber storey.
    const timber=gateTimberUpper(s),ga=timber?'#cdbf9f':'#514a44',gb=timber?'#e0d4b8':'#62584f';
    m.face([{p:g.c3,z:H},{p:g.c0,z:H},{p:g.ridgeA,z:R}],ga);
    m.face([{p:g.c1,z:H},{p:g.c2,z:H},{p:g.ridgeB,z:R}],gb);
    m.face([{p:g.c0,z:H},{p:g.c1,z:H},{p:g.ridgeB,z:R},{p:g.ridgeA,z:R}],sa);
    m.face([{p:g.c3,z:H},{p:g.c2,z:H},{p:g.ridgeB,z:R},{p:g.ridgeA,z:R}],sb);
  }
  function addBuilt(m,s){
    const g=builtRoofGeometry(s);if(!g)return;
    const [p0,p1,p2,p3]=g.p,ra=g.ridgeA,rb=g.ridgeB,H=g.h,R=g.ridgeH;
    const thatch=isTimberLeanTo(s);   // timber lean-to: thatch instead of slate
    m.face([{p:p0,z:H},{p:p1,z:H},{p:rb,z:R},{p:ra,z:R}],winter()?WINTER_SNOW_A:thatch?'#b8995a':'#34363a');
    m.face([{p:p3,z:H},{p:p2,z:H},{p:rb,z:R},{p:ra,z:R}],winter()?WINTER_SNOW_B:thatch?'#a4864a':'#42454a');
    // Gable ends are left open in 2.5D; a closed volume needs them.
    const roofTag=m.tag;m.tag='gable';
    m.face([{p:p0,z:H},{p:ra,z:R},{p:p3,z:H}],PAL.stone());
    m.face([{p:p1,z:H},{p:p2,z:H},{p:rb,z:R}],PAL.stone());
    m.tag=roofTag;
    for(const c of chimneySpecs(s))m.prism(rectWorldPoints(c.center.x,c.center.y,.22,.20,c.angle||0),c.z0,c.z1,PAL.chimney());
  }
  // W1 portico: the loggia (builtLoggia) replaces the solid ground storey; false keeps the prism.
  // Dressed stone arcade a shade lighter than the rubble wall; the loggia's inside in shadow.
  const LOGGIA_HEX={ceiling:'#2c2724',backwall:'#3a3430',paving:'#6d645b'};
  function addBuiltLoggia(m,s){
    if(!isBuiltPortico(s))return false;
    const g=builtLoggia(s);if(!g)return false;
    const arcade=[snowTop('#b1a597'),'#8f8478','#72685f'];
    for(const f of g.faces)m.face(f.pts,LOGGIA_HEX[f.part]||(f.part==='arcade'?arcade:PAL.stone()));
    return true;
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
        // A wall on a slope is built in steps, each section on its own ground.
        // A timber-framed small gate: stone up to the room floor, plaster storey above.
        const steps=s.type==='wall'?wallSlopeSections(s):null;
        const timber=s.type==='gate'&&gateTimberUpper(s),top=timber?gateTimberFloorZ(s):structureHeight(s);
        if(steps)for(const q of steps)withProjectionGroundZ(q.ground,()=>m.prism(q.pts,q.low,structureHeight(s),PAL.stone()));
        else if(!(worldOut&&s.type==='gate'&&window.ConquerGates?.addGateBody(m,s,top,PAL.stone()))&&!(worldOut&&addBuiltLoggia(m,s)))
          for(const pts of towerBodyPrisms(s))m.prism(pts,0,top,PAL.stone());
        if(timber)m.prism(gateTimberStoreyPoints(s),top,structureHeight(s),PAL.plaster());
        if(s.type==='tower')addTower(m,s);
        m.tag='roof';
        if(s.type==='gate')addGate(m,s);
        // Tower / gate hoarding: the Blender bay (hoarding-models.js) swept round the outline; sides a shade darker.
        for(const t of pointHoardingTriangles(s))m.face(t.pts,[t.hex,t.hex,shadeHex(t.hex,.82)]);
        // Dovecote lantern on the roof apex (dovecote-models.js).
        for(const t of dovecoteTriangles(s))m.face(t.pts,[t.hex,t.hex,shadeHex(t.hex,.82)]);
        if(s.type==='built')addBuilt(m,s);
        m.tag='body';
        // Room exterior elements (settlement-room-exterior.js), as the hoarding: sides a shade darker.
        // Timber towers carry theirs in their Blender mesh (settlement-wood3d.js).
        if(!isWoodTower(s))for(const t of window.ConquerRoomExterior?.triangles(s)||[])m.face(t.pts,[t.hex,t.hex,shadeHex(t.hex,.82)]);
        // Wall-walk stair (settlement-wall-stairs.js, Blender models), as the room exteriors.
        if(s.wallStair)for(const t of window.ConquerWallStairs?.triangles(s)||[])m.face(t.pts,[t.hex,t.hex,shadeHex(t.hex,.82)]);
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
    if(p.kind==='machicolationArch'){for(const f of p.faces)m.face(f.pts,PAL.corbel());return}
    if(p.kind==='brazier'){m.prism(p.pts,p.z0,p.z1,PAL.brazier());return}
    m.prism(p.pts,p.z0,p.z1,p.kind==='machicolationCorbel'?PAL.corbel():PAL.merlon());
    for(const q of p.styleParts||[])if(q.faces)for(const f of q.faces)m.face(f.pts,merlonFaceColor(f.tone));
    else m.prism(q.pts,q.z0,q.z1,q.tone==='slit'?PAL.slit():PAL.merlon());
  }
  function addPieces(m,which){
    const plan=typeof isPlanView==='function'&&isPlanView();
    if(plan&&which==='front')return;
    for(const s of worldOut?State.structures.filter(castleVolume):castleParts()){
      if(typeof cutawayCrestHidden==='function'&&cutawayCrestHidden(s))continue;   // floor-by-floor cutaway below the top: no crest
      withStructureVisualMaterial(s,()=>{
      const pieces=[...(s.type==='tower'?towerCrownPieces(s):s.type==='gate'?gateBattlementPieces(s):s.type==='wall'?wallBattlementPieces(s):[])];
      // The roof brazier is a crest piece too: depth-tested with the merlons, split near/far like them.
      if((s.type==='tower'||s.type==='gate')&&typeof structureBrazierBoxes==='function')
        for(const b of structureBrazierBoxes(s))pieces.push({kind:'brazier',...b});
      for(const p of pieces){
        const c={x:p.pts.reduce((a,q)=>a+q.x,0)/p.pts.length,y:p.pts.reduce((a,q)=>a+q.y,0)/p.pts.length};
        const near=viewDepthOf(c)>viewDepthOf(ownerRef(s,c))+1e-6;
        if(!plan&&(which==='front')!==near)continue;
        withProjectionGroundZ(p.groundZ,()=>prismPiece(m,p));
      }
      });
    }
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
          const pieces=s.type==='tower'?towerCrownPieces(s):s.type==='gate'?gateBattlementPieces(s):s.type==='wall'?wallBattlementPieces(s):[];
          for(const p of pieces)withProjectionGroundZ(p.groundZ,()=>prismPiece(m,p));
        });
        return{tris:body.concat(m.tris),tags:body.tags.concat(m.tags)};
      });
    }finally{worldOut=false}
  }
  // Is this roof brazier built into the castle mesh? World3D builds every castle volume
  // (cutaways included, their crest permitting).
  function ownsBrazier(src){
    const s=src?.structureId&&State.structures.find(o=>o.id===src.structureId);
    // The open palisade tower carries its brazier in its Blender model (settlement-wood3d.js).
    if(s&&isWoodTower(s))return !!window.ConquerWood3D?.handles?.(s);
    return !!(s&&castleVolume(s));
  }
  window.ConquerCastle3D={worldMeshes,structureWorld,ownsBrazier,castleParts:()=>castleParts(),
    castleVolume:s=>castleVolume(s),PAL};
})();
