'use strict';
// Adapter over existing gameplay definitions; never spends, assigns rooms or writes State.
(function(){
  const known=value=>({status:'known',value});
  const pending=()=>({status:'context-required',value:null});
  const source=(file,symbol)=>({file:'src/'+file+'.js',symbol});
  const asset=(registry,key,collection='models')=>({registry,collection,key});
  const link=(id,kind='related')=>({id,kind});
  const buildingId=key=>'building:'+key;
  function definitions(){
    const rows=[],add=r=>rows.push(r);
    // These are provider references, not a claim that placement constraints are empty.
    const placementSources={tower:'settlement-castle-placement',gate:'settlement-castle-placement',wall:'settlement-castle-placement',built:'settlement-castle-placement',moat:'settlement-crossings',bridge:'settlement-crossings',pier:'settlement-pier',quay:'settlement-quay'};
    function structure(key,label,match,properties={},status='present'){
      const quote=kind=>ctx=>{
        const s=ctx.structure;
        if(!s)return pending();
        if(!match(s))return{status:'incompatible',value:null};
        if(['wall','palisade','built','bridge','moat','road','quay'].includes(s.type)&&!(Number.isFinite(s.length)&&s.length>0))return pending();
        const value=kind==='cost'?constructionCost(s):buildDuration(s);
        if(kind==='cost'&&Object.keys(value).length===0)return{status:'unmapped',value:null};
        return known(value);
      };
      const row={id:buildingId(key),key,label,category:'building',status,source:source('settlement-core','constructionCost/buildDuration'),
        properties,physical:[{kind:'provider',source:source(placementSources[key]||'settlement-placement','placement validation')}],costSource:'constructionCost',timeSource:'buildDuration',cost:quote('cost'),time:quote('time')};
      add(row);return row;
    }
    for(const [key,label] of Object.entries({tower:'Torre',gate:'Porta',wall:'Mura',palisade:'Palizzata',built:'Sezione costruita',well:'Pozzo',house:'Casa',field:'Campo',road:'Strada',moat:'Fossato',bridge:'Ponte'})){
      const r=structure(key,label,s=>s.type===key);
      if(['house','field','road'].includes(key)){delete r.cost;r.costSource=null}
      if(STRUCTURE_VARIANTS[key])r.properties.variants=STRUCTURE_VARIANTS[key];
      if(TYPES[key])r.properties.geometry=TYPES[key];
      if(key==='tower')r.properties.geometry={squareTiers:SQUARE_TOWER_TIERS,roundTiers:ROUND_TOWER_TIERS,oriented:ORIENTED_TOWER_SPECS,keepFloorPlans:KEEP_FLOOR_PLANS};
      if(key==='wall'||key==='palisade')r.properties.tiers=WALL_TIERS;
      if(key==='built')r.properties.wideGeometry=TYPES.builtWide;
    }
    for(const key of CIVIC_TYPES){
      const r=structure(key,key,s=>s.type===key,{},key==='plaza'?'partial':'present');
      r.properties.levels=CIVIC_LEVEL_TYPES.includes(key)?[1,2,3]:[1];
      if(key==='plaza')r.properties.variants=PLAZA_VARIANTS;
    }
    for(const mode of ['terrain','walled','flat'])add({id:'building:terraforming.'+mode,key:mode,label:'Terraforming · '+mode,category:'building',status:'present',
      source:source('settlement-terraforming','preview/commit'),properties:{kind:'terrain-operation',shapes:window.ConquerTerraforming.SHAPES,limits:window.ConquerTerraforming.LIMITS},
      physical:[{kind:'provider',source:source('settlement-terraforming','preview')}]});
    if(window.ConquerEconomy.KIND.vineyard)add({id:'building:vineyard',key:'vineyard',label:'Vigneto',category:'building',status:'partial',
      source:source('settlement-economy','KIND.vineyard'),properties:{kind:'economic-definition',definition:window.ConquerEconomy.KIND.vineyard},relations:[link('building:field','related')]});
    const industries=window.ConquerIndustries;
    for(const [key,spec] of Object.entries(industries.TYPES)){
      const r=structure(key,spec.label,s=>s.type===key&&(key!=='quarry'||s.extractionMode!=='clay'));
      r.source=source('settlement-industries','TYPES.'+key);r.properties=spec;
      r.assets=[asset('ConquerIndustryModels',key)];
    }
    const clay=structure('clay-quarry','Cava argilla',s=>s.type==='quarry'&&s.extractionMode==='clay');
    clay.key='quarry';clay.properties=industries.definition({type:'quarry',extractionMode:'clay'});
    clay.assets=[asset('ConquerIndustryModels','clayPit')];
    clay.source=source('settlement-industries','CLAY_QUARRY');clay.relations=[link('building:quarry','variant-of')];
    for(const [key,spec] of Object.entries(window.ConquerEvents3D.VENUES)){
      const r=structure('venue.'+key,key,s=>s.type==='eventVenue'&&s.venue===key,spec,'partial');
      r.key=key;r.source=source('settlement-events3d','VENUES.'+key);
    }
    const pier=structure('pier','Molo',s=>s.type==='pier'&&!s.yard,window.ConquerPier.SPEC);
    pier.source=source('settlement-pier','SPEC');
    structure('quay','Banchina',s=>s.type==='quay',window.ConquerQuay.SPEC).source=source('settlement-quay','SPEC');
    for(const [level,spec] of Object.entries(window.ConquerShipyard.LEVELS)){
      const r=structure('shipyard.'+level,spec.label,s=>s.type==='pier'&&Number(s.yard)===Number(level),spec);
      r.source=source('settlement-shipyard','LEVELS.'+level);r.relations=[link('building:pier','variant-of')];
    }
    for(const [parent,entries] of Object.entries(CIVIC_ANNEX_CATALOG))for(const [key,spec] of Object.entries(entries)){
      add({id:'sub-building:'+parent+'.'+key,key,label:spec.label,category:'sub-building',status:'partial',
        source:source('settlement-civic-annexes','CIVIC_ANNEX_CATALOG.'+parent+'.'+key),properties:spec,
        relations:[link(buildingId(parent),'belongs-to')],functional:[{kind:'parent',id:buildingId(parent),minimumLevel:spec.level,maximum:spec.max}],
        physical:[{kind:'footprint',w:spec.w,h:spec.h}]});
    }
    for(const [type,schema] of Object.entries(STRUCTURE_VARIANTS))for(const [variant,values] of Object.entries(schema))for(const value of values){
      const id='upgrade:'+type+'.'+variant+'.'+value;
      const relations=[link(buildingId(type),'applies-to')];
      if(variant==='topWeapon'&&value!=='none')relations.push(link('siege-engine:'+(value==='mangonel'?'catapult':value),'uses'));
      
      add({id,key:value,label:type+' · '+variant+' · '+value,category:'upgrade',status:'present',
        source:source('settlement-core','STRUCTURE_VARIANTS.'+type+'.'+variant),
        properties:{variant,value,default:STRUCTURE_VARIANT_DEFAULTS[type][variant]===value,kind:'configuration'},
        relations,compatibilitySource:'variantSchema (schema exclusion only)',compatible:ctx=>{
          if(!ctx.structure)return pending();
          if(ctx.structure.type!==type||!variantSchema(ctx.structure)?.[variant]?.includes(value))return known(false);
          // Schema membership alone does not establish installability (roof, damage, adjacency).
          return{status:'unmapped',value:null};
        }});
    }
    for(const [key,label,costSource,getCost,parent] of [
      ['gate.drawbridge','Ponte levatoio della porta','ConquerCrossings.DRAWBRIDGE_COST',()=>window.ConquerCrossings.DRAWBRIDGE_COST,'gate'],
      ['gate.portcullis','Grata','ConquerGates.PORTCULLIS_COST',()=>window.ConquerGates.PORTCULLIS_COST,'gate'],
      ['keep.stair','Scala lignea del mastio','ConquerKeepEntrance.STAIR_COST',()=>window.ConquerKeepEntrance.STAIR_COST,'tower'],
      ['keep.stone-stair','Scala in pietra del mastio','ConquerKeepEntrance.STONE_COST',()=>window.ConquerKeepEntrance.STONE_COST,'tower'],
      ['keep.drawbridge','Ponte levatoio del mastio','ConquerKeepEntrance.DRAWBRIDGE_COST',()=>window.ConquerKeepEntrance.DRAWBRIDGE_COST,'tower']]){
      add({id:'upgrade:'+key,key,label,category:'upgrade',status:'present',source:source(parent==='gate'?(key.endsWith('portcullis')?'settlement-gate-fittings':'settlement-crossings'):'settlement-keep-entrance',costSource),
        relations:[link(buildingId(parent),'applies-to')],costSource,cost:()=>known(getCost())});
    }
    const castle=new Set(FUNCTION_CATALOG),townhall=new Set(TOWNHALL_FUNCTION_CATALOG);
    for(const key of new Set([...castle,...townhall])){
      const hosts=[...(castle.has(key)?['tower','gate','built']:[]),...(townhall.has(key)?['townhall']:[])];
      add({id:'room:'+key,key,label:FUNCTION_LABELS[key],category:'room',status:'partial',
        source:source('settlement-core','FUNCTION_CATALOG/TOWNHALL_FUNCTION_CATALOG'),properties:{catalogs:[...(castle.has(key)?['castle']:[]),...(townhall.has(key)?['townhall']:[])]},
        relations:hosts.map(k=>link(buildingId(k),'candidate-host')),
        compatibilitySource:'ConquerSiege.allowed',compatible:ctx=>!ctx.structure||!Number.isInteger(ctx.slot)||ctx.slot<0?pending():known(!!window.ConquerSiege.allowed(ctx.structure,ctx.slot,key))});
    }
    for(const [key,spec] of Object.entries(window.ConquerCombatRules.PROFILES))add({id:'unit:'+key,key,label:key,category:'unit',status:'present',
      source:source('settlement-combat-rules','PROFILES.'+key),properties:{kind:key==='wolf'?'animal-profile':'combat-profile',statistics:spec}});
    for(const [key,needs] of Object.entries(window.ConquerEconomy.HOUSEHOLD_NEEDS))add({id:'unit:cohort.'+key,key,label:'Civili '+key,category:'unit',status:'partial',
      source:source('settlement-economy','HOUSEHOLD_NEEDS.'+key),properties:{kind:'civilian-cohort',needs},relations:[link('building:house','resides-in')]});
    for(const [key,seconds] of Object.entries(window.ConquerSiegeEngines3D.CYCLE)){
      const model=window.ConquerSiegeModel.engines[key];
      add({id:'siege-engine:'+key,key,label:key,category:'siege-engine',status:'partial',source:source('settlement-siege-engines3d','CYCLE.'+key),
        properties:{animationCycleSeconds:seconds,crewAnchors:model.crew.length},assets:[asset('ConquerSiegeModel',key,'engines')]});
    }
    for(const [key,spec] of Object.entries(window.ConquerShipyard.SHIPS)){
      const model=window.ConquerShipModels.ships[key];
      const yards=Object.keys(window.ConquerShipyard.LEVELS).filter(level=>window.ConquerShipyard.canBuild({yard:Number(level)},key));
      add({id:'ship:'+key,key,label:model.label,category:'ship',status:'present',source:source('settlement-shipyard','SHIPS.'+key),
        properties:{size:model.size,length:model.L,beam:model.B},assets:[asset('ConquerShipModels',key,'ships')],relations:yards.map(k=>link('building:shipyard.'+k,'built-at')),
        functional:[{kind:'shipyard',levels:yards.map(Number)}],costSource:'ConquerShipyard.SHIPS.'+key+'.cost',timeSource:'ConquerShipyard.SHIPS.'+key+'.days',
        cost:()=>known(spec.cost),time:()=>known(spec.days),compatibilitySource:'ConquerShipyard.canBuild',
        compatible:ctx=>!ctx.structure?pending():known(!!window.ConquerShipyard.is(ctx.structure)&&window.ConquerShipyard.canBuild(ctx.structure,key))});
    }
    return rows;
  }
  window.ConquerGameCodex=window.ConquerCodex.create(definitions);
})();
