#!/usr/bin/env node
'use strict';
// P2.1: conservative file-to-Asset-Lab scope. Unknown/cross-cutting changes => FULL.
// The runtime catalogue (not this file) supplies actual asset IDs and families.
const fs=require('node:fs');
const REGISTRY_SOURCES=Object.freeze({
  'src/assets/animal-models.js':'animal:',
  'src/assets/industry-models.js':'model:ConquerIndustryModels:',
  'src/assets/scatter-model.js':'model:ConquerScatterModel:',
  'src/assets/house-models.js':'model:ConquerHouseModels:',
  'src/assets/ship-models.js':'model:ConquerShipModels:',
  'src/assets/fishing-models.js':'model:ConquerFishingModels:',
  'src/assets/shipyard-models.js':'model:ConquerShipyardModels:',
  'src/assets/waterside-models.js':'model:ConquerWatersideModels:'
});
const isImage=p=>/^src\/assets\/.+\.(svg|png)$/i.test(p)
  && !p.startsWith('src/assets/architecture/')
  && !p.startsWith('src/assets/sounds/')
  && !p.includes('_rotations/');
const isIgnored=p=>p.startsWith('docs/')||p==='README.md'
  ||p.startsWith('src/assets/sounds/')||p==='.gitignore';
function planChanges(diff){
  if(typeof diff!=='string'||!diff.trim())return{mode:'full',sources:[],reason:'empty/unverifiable diff'};
  const sources=[];
  for(const line of diff.trimEnd().split('\n')){
    const parts=line.replace(/\r$/,'').split('\t');
    if(parts.length!==2||!parts[1]||parts[1].includes('\n'))
      return{mode:'full',sources:[],reason:'unrecognised git status'};
    const [status,p]=parts;
    if(isIgnored(p))continue;
    if(status!=='M')return{mode:'full',sources:[],reason:'asset inventory or other path changed: '+p};
    if((isImage(p)||Object.hasOwn(REGISTRY_SOURCES,p))&&/^[A-Za-z0-9_./-]+$/.test(p)){
      sources.push(p);
      continue;
    }
    return{mode:'full',sources:[],reason:'shared/unknown dependency: '+p};
  }
  const unique=[...new Set(sources)].sort();
  if(!unique.length)return{mode:'skip',sources:[],reason:'documentation/audio only'};
  if(unique.length>4)return{mode:'full',sources:[],reason:'more than four asset sources changed'};
  return{mode:'incremental',sources:unique,reason:'isolated existing asset sources'};
}
function resolveTargets(catalog,sources,baselineEntries){
  if(!Array.isArray(catalog)||!catalog.length||!Array.isArray(sources)||!sources.length)
    return{mode:'full',ids:[],reason:'catalogue/scope not available'};
  const ids=new Set();
  const baselineIds=new Set(Object.keys(baselineEntries||{}).map(k=>k.split('|')[0]));
  for(const source of sources){
    if(!isImage(source)&&!Object.hasOwn(REGISTRY_SOURCES,source))
      return{mode:'full',ids:[],reason:'unapproved runtime source: '+source};
    let matched;
    if(isImage(source)){
      matched=catalog.filter(x=>x.kind==='file'&&x.source===source&&x.id==='file:'+source);
    }else{
      const prefix=REGISTRY_SOURCES[source];
      matched=catalog.filter(x=>x.source===source&&x.id.startsWith(prefix));
      const old=[...baselineIds].filter(id=>id.startsWith(prefix));
      if(!old.length)return{mode:'full',ids:[],reason:'no reviewed baseline IDs for '+source};
      const present=new Set(matched.map(x=>x.id));
      if(old.some(id=>!present.has(id)))
        return{mode:'full',ids:[],reason:'previous registry asset disappeared: '+source};
    }
    if(!matched.length)return{mode:'full',ids:[],reason:'no catalogue entries for '+source};
    for(const item of matched)ids.add(item.id);
  }
  return ids.size?{mode:'incremental',ids:[...ids].sort(),reason:'catalogue source IDs resolved'}:
    {mode:'full',ids:[],reason:'empty asset ID set'};
}
function formatOutput(p){
  return ['visual_needed='+(p.mode==='skip'?'false':'true'),
    'audit_mode='+p.mode,'audit_sources='+p.sources.join(',')].join('\n')+'\n';
}
if(require.main===module){
  const args=process.argv.slice(2),diffAt=args.indexOf('--diff'),outputAt=args.indexOf('--github-output');
  const output=outputAt>=0?args[outputAt+1]:process.env.GITHUB_OUTPUT;
  if(!output){console.error('--github-output is required');process.exit(1)}
  let plan;
  try{
    if(diffAt<0||!args[diffAt+1])throw Error('--diff missing');
    plan=planChanges(fs.readFileSync(args[diffAt+1],'utf8'));
  }catch(e){plan={mode:'full',sources:[],reason:'cannot inspect diff: '+e.message}}
  fs.appendFileSync(output,formatOutput(plan));
  console.log('Asset audit scope: '+JSON.stringify(plan));
}
module.exports={REGISTRY_SOURCES,isImage,planChanges,resolveTargets,formatOutput};
