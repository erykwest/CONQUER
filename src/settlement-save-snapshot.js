'use strict';
// The immutable snapshot is the existing local-save JSON string. Local storage
// writes it directly; the cloud adapter derives its row from that same content.
(function(){
  function capture(state,{schema,landscapeVersion,combat=state.combat}={}){
    return JSON.stringify({schema,ambientAutoV1:true,buildMasonryMaterial:state.buildMasonryMaterial,
      stonePaletteId:state.stonePaletteId,seed:state.seed,biome:state.biome,season:state.season,
      seasonOverride:state.seasonOverride||null,neighborBiomes:state.neighborBiomes,
      landscape:{version:landscapeVersion,relief:state.relief,environment:state.environment},
      structures:state.structures,resources:state.resources,economy:state.economy||null,
      diplomacy:state.diplomacy||null,siege:state.siege||null,policies:state.policies,
      heraldry:state.heraldry||null,village:state.village,clock:{day:state.clock.day,speed:0},
      view:state.view,combat:combat||null});
  }
  function cloud(snapshot,{userId,updatedAt=new Date().toISOString()}={}){
    const x=JSON.parse(snapshot);
    const {schema,seed,biome,neighborBiomes,structures,resources,view,policies,clock,...saved}=x;
    return{user_id:userId,world_cell_x:0,world_cell_y:0,terrain_seed:seed,biome,
      neighbor_biomes:neighborBiomes,structures,resources,camera:view,updated_at:updatedAt,
      policies:{...policies,...saved,clock:{day:clock.day}}};
  }
  function fromCloud(row){
    const p=row.policies||{};
    return{...p,seed:row.terrain_seed,biome:row.biome,neighborBiomes:row.neighbor_biomes,
      structures:row.structures,resources:row.resources,view:row.camera,policies:p};
  }
  window.ConquerSaveSnapshot=Object.freeze({capture,cloud,fromCloud});
})();
