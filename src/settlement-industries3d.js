'use strict';
// CONQUER industries in 3D: the Blender-built logging camp, quarry and mine
// (src/assets/industry-models.js, ASSETS/blender/build_industries.py) placed on a
// structure's position, ground level and angle. One set of world triangles feeds
// both renderers: the 2.5D Canvas painter and the WebGL static scene.
(function(){
  const MODELS=()=>window.ConquerIndustryModels;
  // Mills: gutted once a fire has eaten most of it (or it burnt out), a ruin when the
  // siege or the fire brought it down (a 'ruin' structure that remembers ruinOf).
  const MILLS=['windmill','watermill'];
  function variant(s){
    if(s?.type==='ruin'&&MILLS.includes(s.ruinOf))return'Ruin';
    if(!MILLS.includes(s?.type))return'';
    if(s.burnt)return'Burnt';
    const fire=window.ConquerFire?.state?.().burning?.find(f=>f.id===s.id);
    return fire&&fire.fuel<.6?'Burnt':'';
  }
  // A quarry worked for clay is drawn as the clay pit.
  const key=s=>window.ConquerIndustries?.isClayQuarry?.(s)?'clayPit':s?.type==='ruin'&&MILLS.includes(s.ruinOf)?s.ruinOf+'Ruin':s?.type+variant(s);
  const has=s=>!!MODELS()?.models?.[typeof s==='string'?s:key(s)];
  // World triangles for an industry structure; ground parts always paint first.
  function triangles(s,ground){
    const data=MODELS(),model=data.models[key(s)],pal=data.palette;
    const a=Number(s.angle)||0,c=Math.cos(a),sn=Math.sin(a),z0=ground||0;
    const pos=[],col=[],gi=[],groups=[],groupBias=[];
    for(const [name,part] of Object.entries(model.parts)){
      const g=groups.length,start=pos.length;
      for(let t=0;t<part.c.length;t++){
        for(let k=0;k<3;k++){
          const x=part.v[t*9+k*3],y=part.v[t*9+k*3+1],z=part.v[t*9+k*3+2];
          pos.push(s.x+x*c-y*sn,s.y+x*sn+y*c,z0+z);
        }
        col.push(pal[part.c[t]]);gi.push(g);
      }
      let cx=0,cy=0,cz=0;const n=(pos.length-start)/3||1;
      for(let i=start;i<pos.length;i+=3){cx+=pos[i];cy+=pos[i+1];cz+=pos[i+2]}
      groups.push([cx/n,cy/n,cz/n]);groupBias.push(name==='ground'?-1e6:0);
    }
    return{pos,col,gi,groups,groupBias};
  }
  // 2.5D: paint the model with the game's projection into the current ctx.
  function draw(s,ground,preview=false){
    if(!has(s)||!window.ConquerMesh3D)return false;
    ctx.save();
    if(preview)ctx.globalAlpha*=.62;
    window.ConquerMesh3D.drawMeshes(ctx,[triangles(s,ground)],window.ConquerMesh3D.gameView());
    ctx.restore();
    return true;
  }
  // WebGL: add the model to a world3d meshBuilder with fixed-light shaded colours.
  function addToBuilder(m,s,ground){
    if(!has(s)||!window.ConquerMesh3D)return false;
    const mesh=triangles(s,ground),p=mesh.pos;
    for(let t=0;t<mesh.col.length;t++){
      const o=t*9;
      m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
    }
    return true;
  }
  window.ConquerIndustries3D={has,key,variant,triangles,draw,addToBuilder};
})();
