'use strict';
// CONQUER tower fittings in 3D (World3D dynamic meshes, settlement-world3d.js drawFront):
// - the torch brackets either side of a stone tower's ground-floor door (as the gate torches of
//   settlement-gate-fittings.js): wall plate, angled haft and the iron cup under the flame;
// - the flags of the pitched roofs and bartizans (towerFlagAnchors), a staff and a cloth in the
//   realm's arms that streams downwind and waves like the ship flags (settlement-ships.js).
// The flame and its glow stay where they were (allWorldFireSources). The 2.5D painters stand
// down while World3D is on (drawCastleFireFixtures, drawTowerFlags). Classic script.
(function(){
  const FLAG_COLS=10,FLAG_ROWS=6;
  const FLAG={staff:.52,w:.42,h:.27,drop:.04};           // U, at size 1 (a bartizan pennant is .7)
  const IRON='#3b3532',WOOD='#5b4130',STAFF='#745538',FINIAL='#c6a461';
  const on=()=>!!window.ConquerWorld3D?.active?.();
  function builder(){
    const pos=[],col=[];
    const tri=(a,b,c,colr)=>{pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);col.push(colr)};
    const quad=(a,b,c,d,colr)=>{tri(a,b,c,colr);tri(a,c,d,colr)};
    // Box from local corners: frame(u,v,z) -> [x,y,z]; u0..u1 out of the wall, v0..v1 along it.
    const box=(frame,u0,u1,v0,v1,z0,z1,colr)=>{
      const P=(u,v,z)=>frame(u,v,z);
      quad(P(u0,v0,z1),P(u1,v0,z1),P(u1,v1,z1),P(u0,v1,z1),colr);
      for(const [a,b] of [[[u0,v0],[u1,v0]],[[u1,v0],[u1,v1]],[[u1,v1],[u0,v1]],[[u0,v1],[u0,v0]]])
        quad(P(a[0],a[1],z0),P(b[0],b[1],z0),P(b[0],b[1],z1),P(a[0],a[1],z1),colr);
    };
    return{pos,col,tri,quad,box};
  }
  // ---------- torches
  // The flame of a tower door torch (allWorldFireSources): .18 to each side of the door, .035 off
  // the facade, .10 above a third of the opening. The cup sits right under it.
  function torchSpecs(){
    const out=[];
    for(const tower of State.structures){
      if(tower.type!=='tower'||underConstruction(tower)||isWoodTower(tower))continue;
      for(const spec of towerDoorSpecs(tower)){
        if(spec.kind!=='front')continue;
        const flameZ=spec.baseZ+Math.max(.18,spec.apexZ-spec.baseZ)/3+.10;
        for(const side of [-1,1])out.push({tower,spec,side,flameZ,ground:placementGroundZ(tower)});
      }
    }
    return out;
  }
  function torchMesh(){
    const b=builder();
    for(const T of torchSpecs()){
      const {spec,side,flameZ,ground}=T,o=spec.outward,t=spec.tangent,c=spec.contact;
      const across=.18*side;
      const frame=(u,v,z)=>[c.x+o.x*u+t.x*(across+v),c.y+o.y*u+t.y*(across+v),ground+z];
      b.box(frame,0,.018,-.03,.03,flameZ-.24,flameZ-.10,IRON);                       // wall plate
      for(let i=0;i<4;i++){const k=i/4;b.box(frame,.006+k*.02,.02+k*.02,-.014,.014,flameZ-.21+k*.13,flameZ-.17+k*.13,WOOD)}
      b.box(frame,.012,.058,-.022,.022,flameZ-.08,flameZ-.035,IRON);                  // the cup
    }
    return b.col.length?{pos:b.pos,col:b.col,static:true}:null;
  }
  // ---------- flags
  const playerArms=()=>window.ConquerShips?.arms?.({allegiance:'player'})?.flag||null;
  function clothColours(){
    const h=playerArms(),grid=h&&window.ConquerHeraldryShapes?.sample?.(h,FLAG_COLS,FLAG_ROWS);
    if(grid)return grid;
    // No arms painter: the quartered colours of the realm (as the 2.5D fallback).
    const H=State.heraldry||{},c1=H.c1||(typeof REIGN_COLOR_1!=='undefined'?REIGN_COLOR_1:'#8c2f2a'),c2=H.c2||(typeof REIGN_COLOR_2!=='undefined'?REIGN_COLOR_2:'#e2c35a');
    return Array.from({length:FLAG_ROWS},()=>Array.from({length:FLAG_COLS},(_,c)=>c<FLAG_COLS/2?c1:c2));
  }
  function flagAnchors(){
    const out=[];
    for(const tower of State.structures){
      if(tower.type!=='tower'||typeof towerFlagAnchors!=='function')continue;
      for(const f of towerFlagAnchors(tower))out.push({...f,ground:placementGroundZ(tower)});
    }
    return out;
  }
  function flagMesh(t){
    const anchors=flagAnchors();if(!anchors.length)return null;
    const b=builder(),grid=clothColours(),wind=window.ConquerShips?.windHeading?.()??Math.PI*.25;
    const cx=Math.cos(wind),cy=Math.sin(wind);
    for(const A of anchors){
      const k=A.size||1,z0=A.ground+A.z,top=z0+FLAG.staff*k,p=A.at;
      const seed=(typeof peasantHash==='function'?peasantHash(A.key)%1000:0)/1000;
      // Staff (a thin square post) and its gilded finial.
      const frame=(u,v,z)=>[p.x+u,p.y+v,z];
      b.box(frame,-.012*k,.012*k,-.012*k,.012*k,z0-.02,top,STAFF);
      b.box(frame,-.022*k,.022*k,-.022*k,.022*k,top,top+.03*k,FINIAL);
      // Cloth: from the staff downwind, waving more towards the fly.
      const w=FLAG.w*k,h=FLAG.h*k,az=top-FLAG.drop*k;
      const P=(c,r)=>{const u=c/FLAG_COLS,v=r/FLAG_ROWS,wave=Math.sin(u*5-t*4+v*.6+seed*6.283)*h*.16*u,d=u*w;
        return[p.x+cx*d-cy*wave,p.y+cy*d+cx*wave,az-v*h-u*u*h*.08]};
      for(let r=0;r<FLAG_ROWS;r++)for(let c=0;c<FLAG_COLS;c++)b.quad(P(c,r),P(c+1,r),P(c+1,r+1),P(c,r+1),grid[r]?.[c]||'#8c2f2a');
    }
    return{pos:b.pos,col:b.col};
  }
  // ---------- World3D hooks
  let torchCache={key:null,mesh:null};
  function torchKey(){
    return State.structures.filter(s=>s.type==='tower'||s.type==='wall').map(s=>[s.id,s.x,s.y,s.angle,s.size,s.r,s.shape,s.level,s.isMastio?1:0,s.aSnap,s.bSnap,s.a?.x,s.a?.y,underConstruction(s)?1:0].join(',')).join('|');
  }
  function dynamicMeshes(){
    if(!on())return[];
    const out=[],key=torchKey();
    if(torchCache.key!==key)torchCache={key,mesh:torchMesh()};
    if(torchCache.mesh)out.push(torchCache.mesh);
    // The flags wave in real time, as the ship flags.
    const flags=flagMesh(performance.now()/1000);if(flags)out.push(flags);
    return out;
  }
  const ownsFlags=()=>on();
  window.ConquerTowerFittings=Object.freeze({FLAG,dynamicMeshes,ownsFlags,torchSpecs,torchMesh,flagAnchors,flagMesh});
})();
