'use strict';
// Portable, read-only Codex contract. No DOM, State, renderer or economy dependency.
(function(root){
  const VERSION=1;
  const CATEGORIES=Object.freeze(['building','sub-building','upgrade','room','unit','siege-engine','ship']);
  const copy=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
  function freeze(value){
    if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}
    return value;
  }
  function create(readDefinitions){
    if(typeof readDefinitions!=='function')throw new TypeError('Codex requires a definition provider');
    function definitions(){
      const rows=readDefinitions(),ids=new Set();
      for(const r of rows){
        if(!/^[a-z][a-z0-9-]*:[A-Za-z0-9_.-]+$/.test(r.id)||ids.has(r.id))throw new Error('Invalid or duplicate Codex id: '+r.id);
        if(!CATEGORIES.includes(r.category))throw new Error('Invalid Codex category: '+r.category);
        if(!['present','partial','planned'].includes(r.status))throw new Error('Invalid Codex status: '+r.id);
        ids.add(r.id);
      }
      for(const r of rows)for(const link of r.relations||[])if(!ids.has(link.id))throw new Error('Dangling Codex relation: '+r.id+' -> '+link.id);
      return rows;
    }
    function record(r){
      return freeze(copy({id:r.id,key:r.key,label:r.label||r.key,category:r.category,status:r.status,
        source:r.source,properties:r.properties||{},relations:r.relations||[],assets:r.assets||[],
        requirements:{physical:r.physical||r.requirements?.physical||[],functional:r.functional||r.requirements?.functional||[],knowledge:r.requirements?.knowledge||{status:'unmapped',ids:[]}},
        providers:{cost:r.costSource||r.providers?.cost||null,time:r.timeSource||r.providers?.time||null,compatibility:r.compatibilitySource||r.providers?.compatibility||null}}));
    }
    function list({category,status}={}){
      return freeze(definitions().filter(r=>(!category||r.category===category)&&(!status||r.status===status)).map(record).sort((a,b)=>a.id.localeCompare(b.id,'en')));
    }
    function get(id){const r=definitions().find(r=>r.id===id);return r?record(r):null}
    function evaluate(id,kind,context={}){
      const r=definitions().find(r=>r.id===id);
      if(!r)return freeze({status:'not-found',value:null});
      const fn=r[kind];
      if(typeof fn!=='function')return freeze(copy(r.quotes?.[kind]||{status:'unmapped',value:null}));
      // All caller input is detached before reaching gameplay helpers.
      const result=fn(copy(context));
      if(!result||!['known','unmapped','context-required','incompatible'].includes(result.status))throw new Error('Invalid Codex provider result: '+id);
      if(result.status==='known'){
        const values=kind==='cost'?Object.values(result.value||{}):kind==='time'?[result.value]:[];
        if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error('Invalid Codex quote: '+id);
      }
      return freeze(copy(result));
    }
    return Object.freeze({version:VERSION,categories:CATEGORIES,list,get,
      quote:(id,context)=>freeze({cost:evaluate(id,'cost',context),time:evaluate(id,'time',context)}),
      compatible:(id,context)=>evaluate(id,'compatible',context),
      snapshot:()=>freeze({schemaVersion:VERSION,categories:CATEGORIES,items:list().map(r=>({...r,quotes:{cost:evaluate(r.id,'cost'),time:evaluate(r.id,'time')}}))})});
  }
  root.ConquerCodex=Object.freeze({version:VERSION,categories:CATEGORIES,create,fromSnapshot:snapshot=>{
    if(snapshot?.schemaVersion!==VERSION||!Array.isArray(snapshot.items))throw new Error('Unsupported Codex snapshot');
    const saved=copy(snapshot);return create(()=>saved.items);
  }});
})(typeof window==='undefined'?globalThis:window);
