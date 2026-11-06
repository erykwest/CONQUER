'use strict';
// Editorial text is compiled from the Obsidian-compatible Markdown vault.
(function(root){
  const data=root.ConquerWikiEditorial;
  if(!data||data.schemaVersion!==1)throw Error('Codex editorial artifact is missing or unsupported');
  const categories=Object.fromEntries(root.ConquerCodex.categories.map(key=>{
    const page=data.pages.find(p=>p.id==='category:'+key);return[key,[page.title,...page.aliases]];
  }));
  function create(catalog){
    const rows=catalog.list(),byId=new Map(rows.map(r=>[r.id,r])),pages=new Map();
    for(const doc of data.pages){
      if(doc.kind==='entry'){
        const record=byId.get(doc.id);if(!record)throw Error('Editorial entry missing from gameplay: '+doc.id);
        const category='category:'+record.category;
        pages.set(doc.id,{...doc,record,category,parents:[...new Set([category,...doc.related.filter(id=>/^(category|topic):/.test(id))])]});
      }else pages.set(doc.id,{...doc,members:doc.kind==='category'?rows.filter(r=>'category:'+r.category===doc.id).map(r=>r.id):doc.members});
    }
    for(const row of rows)if(!pages.has(row.id))throw Error('Gameplay entry missing approved editorial note: '+row.id);
    const terms=new Map();
    function register(term,id){
      if(!term||term.length<3)return;const key=term.normalize('NFC').toLocaleLowerCase('it');
      if(!terms.has(key))terms.set(key,id);else if(terms.get(key)!==id)terms.set(key,null);
    }
    for(const page of pages.values())for(const term of [page.title,...page.aliases])register(term,page.id);
    const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const regex=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+[...terms.keys()].filter(k=>terms.get(k)).sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?![\\p{L}\\p{N}_])','giu');
    function tokenize(text,self){
      const tokens=[],seen=new Set();let at=0;regex.lastIndex=0;
      for(const m of text.matchAll(regex)){
        const id=terms.get(m[0].normalize('NFC').toLocaleLowerCase('it'));
        if(id===self||seen.has(id))continue;
        if(m.index>at)tokens.push({text:text.slice(at,m.index)});
        tokens.push({text:m[0],id});seen.add(id);at=m.index+m[0].length;
      }
      if(at<text.length)tokens.push({text:text.slice(at)});return tokens;
    }
    function inline(tokens,self){
      const explicit=new Set(tokens.filter(t=>t.id).map(t=>t.id)),seen=new Set();
      return tokens.flatMap(token=>token.id?[(token.id!==self||token.anchor)?token:{text:token.text}]:tokenize(token.text,self).map(t=>{
        if(!t.id)return t;if(explicit.has(t.id)||seen.has(t.id))return{text:t.text};seen.add(t.id);return t;
      }));
    }
    function backlinks(id){return[...pages.values()].filter(p=>p.id!==id&&(
      p.blocks.some(b=>(b.type==='list'?b.items:[b.tokens]).some(ts=>inline(ts,p.id).some(t=>t.id===id)))||
      p.related.includes(id)||p.record?.relations.some(r=>r.id===id))).map(p=>p.id)}
    return{pages,tokenize,inline,backlinks,title:id=>pages.get(id)?.title||id};
  }
  root.ConquerWikiContent={create,categories};
})(typeof window==='undefined'?globalThis:window);
