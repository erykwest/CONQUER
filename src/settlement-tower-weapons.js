'use strict';
// CONQUER tower weapons (upgrade): a mangonel or a ballista on the fighting deck of
// a medium (T2) stone tower without a roof, at any height (structure variant
// `topWeapon`, see towerTopWeapon in settlement-core.js). The engines are the
// Blender siege models (settlement-siege-engines3d.js), queued in the 3D world as
// dynamic meshes like the siege preview, standing on the deck and facing out of
// the castle.
(function(){
  const SE=()=>window.ConquerSiegeEngines3D,W=()=>window.ConquerWorld3D;
  const ENGINE={mangonel:'catapult',ballista:'ballista'};
  // A tower mangonel is a smaller build: with its arm laid back it fits the T2 deck.
  const SCALE={catapult:.82,ballista:1};
  const OWN_TEAM=typeof REIGN_COLOR_1==='string'?REIGN_COLOR_1:'#b53636';
  // Middle of a model along its length (its origin is not its middle), cached.
  const mids={};
  function midX(engine){
    if(engine in mids)return mids[engine];
    let a=Infinity,b=-Infinity;
    for(const p of Object.values(window.ConquerSiegeModel?.engines?.[engine]?.parts||{}))
      for(let i=0;i<p.v.length;i+=3){a=Math.min(a,p.v[i]);b=Math.max(b,p.v[i])}
    return mids[engine]=Number.isFinite(a)?(a+b)/2:0;
  }
  // Where each mounted weapon stands: {s, engine, place:{x,y,z,heading,team}}.
  function mounts(){
    const out=[];
    for(const s of State.structures||[]){
      const w=towerTopWeapon(s);
      if(w==='none'||underConstruction(s))continue;
      const ground=Number.isFinite(placementGroundZ(s))?placementGroundZ(s):terrainElevation(s);
      const iv=structureInteriorVector(s),heading=Math.atan2(-iv.y,-iv.x);
      const c=structureCenter(s),engine=ENGINE[w];
      // Centre the engine's footprint on the deck.
      const scale=SCALE[engine],back=midX(engine)*scale;
      out.push({s,engine,place:{x:c.x-Math.cos(heading)*back,y:c.y-Math.sin(heading)*back,z:ground+structureHeight(s),heading,team:OWN_TEAM,scale}});
    }
    return out;
  }
  // Called inside the game's frame, between the 3D back pass and the front pass.
  function drawFrame(){
    if(!W()?.active?.()||!SE())return;
    for(const m of mounts())W().addMesh(SE().triangles(m.engine,m.place,{mode:'idle',mounted:true}));
  }
  if(typeof drawCastleSoldiers==='function'){
    const original=drawCastleSoldiers;
    drawCastleSoldiers=function(){const r=original.apply(this,arguments);try{drawFrame()}catch(e){console.error('tower weapons',e)}return r};
  }
  window.ConquerTowerWeapons={mounts,ENGINE};
})();
