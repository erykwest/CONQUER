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
// Interface-only files: the game's HUD, panels and menus. The Asset Lab never loads them, so they
// cannot change a render; they still get the gallery smoke test (mode "smoke"), not the audit.
const UI_ONLY_FILES=Object.freeze(['src/settlement-heraldry.js','src/settlement-panels.js']);
const isUiOnly=p=>/^src\/ui\/[A-Za-z0-9_./-]+$/.test(p)
  ||(/^src\/[A-Za-z0-9_-]+\.css$/.test(p))||UI_ONLY_FILES.includes(p);
// index.html is interface-only when no changed line loads code or styles or adds a drawing surface.
const RENDER_MARKUP=/<\s*(script|link|canvas|svg|iframe|object|embed)\b|\bsrc\s*=/i;
function isUiOnlyIndexDiff(patch){
  if(typeof patch!=='string'||!patch.trim())return false;
  const changed=patch.split('\n').filter(l=>/^[+-]/.test(l)&&!/^(\+\+\+|---)\s/.test(l));
  return changed.length>0&&!changed.some(l=>RENDER_MARKUP.test(l));
}
function planChanges(diff,{indexHtmlPatch}={}){
  if(typeof diff!=='string'||!diff.trim())return{mode:'full',sources:[],reason:'empty/unverifiable diff'};
  const sources=[],ui=[];
  for(const line of diff.trimEnd().split('\n')){
    const parts=line.replace(/\r$/,'').split('\t');
    if(parts.length!==2||!parts[1]||parts[1].includes('\n'))
      return{mode:'full',sources:[],reason:'unrecognised git status'};
    const [status,p]=parts;
    if(isIgnored(p))continue;
    if(status!=='M')return{mode:'full',sources:[],reason:'asset inventory or other path changed: '+p};
    if(isUiOnly(p)||(p==='index.html'&&isUiOnlyIndexDiff(indexHtmlPatch))){ui.push(p);continue}
    if((isImage(p)||Object.hasOwn(REGISTRY_SOURCES,p))&&/^[A-Za-z0-9_./-]+$/.test(p)){
      sources.push(p);
      continue;
    }
    return{mode:'full',sources:[],reason:'shared/unknown dependency: '+p};
  }
  const unique=[...new Set(sources)].sort();
  if(!unique.length&&ui.length)return{mode:'smoke',sources:[],reason:'interface only: '+ui.join(', ')};
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
  const indexAt=args.indexOf('--index-patch');
  const output=outputAt>=0?args[outputAt+1]:process.env.GITHUB_OUTPUT;
  if(!output){console.error('--github-output is required');process.exit(1)}
  let plan;
  try{
    if(diffAt<0||!args[diffAt+1])throw Error('--diff missing');
    let indexHtmlPatch;
    try{if(indexAt>=0&&args[indexAt+1])indexHtmlPatch=fs.readFileSync(args[indexAt+1],'utf8')}catch{}
    plan=planChanges(fs.readFileSync(args[diffAt+1],'utf8'),{indexHtmlPatch});
  }catch(e){plan={mode:'full',sources:[],reason:'cannot inspect diff: '+e.message}}
  fs.appendFileSync(output,formatOutput(plan));
  console.log('Asset audit scope: '+JSON.stringify(plan));
}
// Full audits are split by whole catalogue groups (category|family) so that cross checks,
// which compare states and levels inside one family, never straddle two shards. Greedy by cost:
// an engine-staged entry renders every state, any other entry one view.
function shardIds(catalog,index,count){
  if(!Number.isInteger(count)||count<1||!Number.isInteger(index)||index<0||index>=count)
    throw Error('bad shard '+index+'/'+count);
  const groups=new Map();
  for(const x of catalog){
    const g=(x.category||'')+'|'+(x.family||'');
    if(!groups.has(g))groups.set(g,{ids:[],cost:0});
    const e=groups.get(g);e.ids.push(x.id);e.cost+=Array.isArray(x.states)&&x.states.length?x.states.length:1;
  }
  const bins=Array.from({length:count},()=>({ids:[],cost:0}));
  for(const [,g] of [...groups].sort((a,b)=>b[1].cost-a[1].cost||(a[0]<b[0]?-1:1))){
    const bin=bins.reduce((m,b)=>b.cost<m.cost?b:m);bin.ids.push(...g.ids);bin.cost+=g.cost;
  }
  return bins[index].ids.sort();
}
module.exports={REGISTRY_SOURCES,isImage,isUiOnly,isUiOnlyIndexDiff,planChanges,resolveTargets,formatOutput,shardIds};
