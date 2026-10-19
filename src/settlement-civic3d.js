'use strict';
// CONQUER civic buildings in 3D: the Blender-built church, tavern, market and piazza
// (three levels, three piazza variants), the civic annexes and the church cemetery
// (src/assets/civic-models.js, ASSETS/blender/build_civic.py). Models are in the
// structure's local axes (houseLocalToWorld, front at -y) on the civicParts /
// annex footprints. One set of world triangles feeds both renderers.
(function(){
  const DATA=()=>window.ConquerCivicModels;
  const WINTER=['#e7ece8','#dce3de'];
  // Model key of a structure: church2, plaza_fountain3, an annex type, or null.
  function modelKey(s){
    if(!s)return null;
    if(s.type==='civicAnnex')return s.annexType;
    const level=typeof civicLevel==='function'?civicLevel(s):1;
    if(s.type==='plaza')return 'plaza_'+(typeof plazaVariant==='function'?plazaVariant(s):'paved')+level;
    if(s.type==='church'||s.type==='tavern'||s.type==='market')return s.type+level;
    return null;
  }
  const has=s=>{const k=modelKey(s);return !!(k&&DATA()?.models?.[k])};
  // Indexed parts expanded once into flat triangle lists.
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
  // Palette with the roofs whitened in winter (light and dark tones kept apart).
  let palCache=null;
  function palette(){
    const data=DATA(),winter=typeof State!=='undefined'&&State.season==='winter';
    if(palCache&&palCache.data===data&&palCache.winter===winter)return palCache.pal;
    const pal=data.palette.map((hex,i)=>{const k=data.paletteKeys[i];
      return winter&&k.startsWith('roof')?WINTER[/Dark$/.test(k)?1:0]:hex});
    palCache={data,winter,pal};return pal;
  }
  // World triangles of model `key` at place {x,y,angle,scale}; ground parts paint first.
  function triangles(key,place,ground){
    const pal=palette(),a=Number(place.angle)||0,c=Math.cos(a),sn=Math.sin(a),k=place.scale||1,z0=ground||0;
    const pos=[],col=[],gi=[],groups=[],groupBias=[];
    for(const part of parts(key)){
      const g=groups.length,start=pos.length,v=part.v;
      for(let i=0;i<v.length;i+=3){
        const x=v[i]*k,y=v[i+1]*k;
        pos.push(place.x+x*c-y*sn,place.y+x*sn+y*c,z0+v[i+2]*k);
      }
      for(const ci of part.c){col.push(pal[ci]);gi.push(g)}
      let cx=0,cy=0,cz=0;const n=(pos.length-start)/3||1;
      for(let i=start;i<pos.length;i+=3){cx+=pos[i];cy+=pos[i+1];cz+=pos[i+2]}
      groups.push([cx/n,cy/n,cz/n]);groupBias.push(part.name.startsWith('ground')?-1e6:0);
    }
    return{pos,col,gi,groups,groupBias};
  }
  // The church's intrinsic cemetery, fitted to its Voronoi curtilage (civicCemeteryArea).
  // The L1 chapel model carries its own churchyard beside the nave, so the lot
  // cemetery is drawn from L2 on.
  function cemeteryMesh(s,ground){
    if(s.type!=='church'||!DATA()?.models?.cemetery||typeof civicCemeteryArea!=='function')return null;
    if((typeof civicLevel==='function'?civicLevel(s):1)<2)return null;
    const area=civicCemeteryArea(s);if(!area)return null;
    return triangles('cemetery',{x:area.center.x,y:area.center.y,angle:area.angle,scale:area.w/2.2},ground);
  }
  function meshes(s,ground){
    const out=[triangles(modelKey(s),s,ground)],cem=cemeteryMesh(s,ground);
    if(cem)out.push(cem);
    return out;
  }
  // 2.5D: paint into the current ctx. Civic draws run inside withStructureGroundPlane.
  function draw(s,preview=false){
    if(!has(s)||!window.ConquerMesh3D)return false;
    const ground=typeof structureProjectionGroundZ!=='undefined'&&Number.isFinite(structureProjectionGroundZ)?structureProjectionGroundZ
      :Number.isFinite(s.groundZ)?s.groundZ:terrainElevation(s);
    const list=preview?[triangles(modelKey(s),s,ground)]:meshes(s,ground);
    ctx.save();
    if(preview)ctx.globalAlpha*=.62;
    window.ConquerMesh3D.drawMeshes(ctx,list,window.ConquerMesh3D.gameView());
    ctx.restore();
    return true;
  }
  // WebGL: add to a world3d meshBuilder with fixed-light shaded colours.
  function addToBuilder(m,s,ground){
    if(!has(s)||!window.ConquerMesh3D)return false;
    for(const mesh of meshes(s,ground)){
      const p=mesh.pos;
      for(let t=0;t<mesh.col.length;t++){
        const o=t*9;
        m.face([{x:p[o],y:p[o+1],z:p[o+2]},{x:p[o+3],y:p[o+4],z:p[o+5]},{x:p[o+6],y:p[o+7],z:p[o+8]}],window.ConquerMesh3D.shadedHex(mesh,t));
      }
    }
    return true;
  }
  window.ConquerCivic3D={modelKey,has,parts,triangles,draw,addToBuilder};
})();
