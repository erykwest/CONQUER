'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRuntime}=require('./codex-runtime.cjs');
const vault=path.join(__dirname,'../content/codex');
const normalize=s=>s.normalize('NFC').toLocaleLowerCase('it').trim();
const headingId=s=>'section-'+s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('it').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
function scalar(value,where){
  const s=value.trim();
  if(!s)return'';
  if(s.startsWith('"')||s.startsWith('[')){try{return JSON.parse(s)}catch{throw Error(where+': expected a quoted string or inline JSON list')}}
  if(s.startsWith("'")){if(!s.endsWith("'"))throw Error(where+': unclosed quote');return s.slice(1,-1).replace(/''/g,"'")}
  if(/^[&*!{>|]/.test(s))throw Error(where+': unsupported YAML construct');
  return s.replace(/\s+#.*$/,'').trim();
}
function parseNote(source,file){
  const text=source.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'),match=/^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if(!match)throw Error(file+': missing frontmatter');
  const meta={};let listKey=null;
  for(const [index,line] of match[1].split('\n').entries()){
    if(!line.trim()||line.trim().startsWith('#'))continue;
    const item=/^\s+-\s+(.+)$/.exec(line);
    if(item&&listKey){if(!Array.isArray(meta[listKey]))meta[listKey]=[];meta[listKey].push(scalar(item[1],file+':'+(index+2)));continue}
    const pair=/^([a-z_]+):\s*(.*)$/.exec(line);if(!pair)throw Error(file+':'+(index+2)+': unsupported frontmatter line');
    if(Object.hasOwn(meta,pair[1]))throw Error(file+': duplicate property '+pair[1]);
    meta[pair[1]]=scalar(pair[2],file+':'+(index+2));listKey=pair[2].trim()?null:pair[1];
  }
  if(['index','guide','template'].includes(meta.kind))return{file,meta,ignored:true};
  for(const key of ['codex_id','kind','title','editorial_status'])if(typeof meta[key]!=='string'||!meta[key].trim())throw Error(file+': missing '+key);
  if(!/^(?:building|sub-building|upgrade|room|unit|siege-engine|ship|category|topic):[A-Za-z0-9_.-]+$/.test(meta.codex_id))throw Error(file+': invalid codex_id');
  if(!['entry','category','topic'].includes(meta.kind))throw Error(file+': invalid kind');
  if(!['draft','review','approved'].includes(meta.editorial_status))throw Error(file+': invalid editorial_status');
  const aliases=meta.aliases===''?[]:meta.aliases||[];
  if(!Array.isArray(aliases)||aliases.some(a=>typeof a!=='string'))throw Error(file+': aliases must be a list of strings');
  const blocks=[],related=[],members=[];let paragraph=[],currentList=null,section='body';
  function flush(){if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join(' ')});paragraph=[]}currentList=null}
  for(const line of text.slice(match[0].length).split('\n')){
    if(!line.trim()){flush();continue}
    if(/!\[\[|```|~~~/.test(line))throw Error(file+': embeds and code fences are not supported in published content');
    const heading=/^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if(heading){
      flush();const label=heading[2];
      if(heading[1]==='#'&&normalize(label)===normalize(meta.title))continue;
      if(heading[1]==='#')throw Error(file+': use ## for sections below the note title');
      if(normalize(label)==='collegamenti'){section='related';continue}
      if(normalize(label)==='voci'){section='members';continue}
      section='body';blocks.push({type:'heading',level:Math.min(heading[1].length,3),text:label,anchor:headingId(label)});continue;
    }
    const bullet=/^(?:- |\* |\d+\. )(.+)$/.exec(line);
    if(section!=='body'){
      if(!bullet||!/^\[\[[^\]]+\]\]$/.test(bullet[1]))throw Error(file+': '+section+' section requires a list of wikilinks');
      (section==='related'?related:members).push(bullet[1]);continue;
    }
    if(bullet){
      if(paragraph.length)flush();
      if(!currentList){currentList={type:'list',items:[]};blocks.push(currentList)}currentList.items.push(bullet[1]);
    }else{if(/^\s{2,}\S/.test(line))throw Error(file+': indented/nested blocks are not supported');if(currentList)flush();paragraph.push(line.trim())}
  }
  flush();
  if(meta.editorial_status==='approved'&&!blocks.some(b=>b.type==='paragraph'))throw Error(file+': published notes require explanatory text');
  const anchors=blocks.filter(b=>b.type==='heading').map(b=>b.anchor);
  if(new Set(anchors).size!==anchors.length)throw Error(file+': duplicate section heading');
  return{file,meta:{...meta,aliases},blocks,related,members};
}
function compileDirectory(directory=vault){
  const files=fs.readdirSync(directory).filter(f=>f.endsWith('.md')).sort((a,b)=>a.localeCompare(b,'en'));
  const raw=files.map(file=>({file,source:fs.readFileSync(path.join(directory,file),'utf8').replace(/\r\n/g,'\n')}));
  const notes=raw.map(r=>parseNote(r.source,r.file)).filter(n=>!n.ignored),ids=new Map(),lookup=new Map();
  for(const note of notes){
    if(ids.has(note.meta.codex_id))throw Error('Duplicate codex_id: '+note.meta.codex_id);ids.set(note.meta.codex_id,note);
    for(const key of [note.file.slice(0,-3),note.meta.title,...note.meta.aliases]){
      const k=normalize(key);if(!lookup.has(k))lookup.set(k,new Set());lookup.get(k).add(note);
    }
  }
  function resolve(raw,from){
    const [targetPart,display]=raw.split('|');const hash=targetPart.indexOf('#');
    const noteName=(hash<0?targetPart:targetPart.slice(0,hash)).replace(/\.md$/i,'').trim();
    const heading=hash<0?null:targetPart.slice(hash+1).trim();
    const candidates=lookup.get(normalize(noteName));
    // Exact filenames take precedence over aliases, matching Obsidian note identity.
    const exact=notes.filter(n=>normalize(n.file.slice(0,-3))===normalize(noteName));
    const matches=!noteName?[from]:exact.length?exact:[...candidates||[]];
    if(matches.length!==1)throw Error(from.file+': unresolved or ambiguous link [['+raw+']]');
    const target=matches[0];if(target.meta.editorial_status!=='approved')throw Error(from.file+': published link targets unpublished note '+target.file);
    let anchor;
    if(heading){anchor=headingId(heading);if(!target.blocks.some(b=>b.type==='heading'&&b.anchor===anchor))throw Error(from.file+': missing heading '+heading+' in '+target.file)}
    return{text:display||target.meta.title,id:target.meta.codex_id,...anchor?{anchor}: {}};
  }
  function tokens(text,note){
    const out=[];let start=0;
    for(const m of text.matchAll(/\[\[([^\]\n]+)\]\]/g)){
      if(m.index>start)out.push({text:text.slice(start,m.index)});out.push(resolve(m[1],note));start=m.index+m[0].length;
    }
    if(start<text.length)out.push({text:text.slice(start)});
    if(out.some(t=>!t.id&&/\[\[|\]\]/.test(t.text)))throw Error(note.file+': malformed wikilink');
    return out;
  }
  const api=createRuntime().sandbox.window.ConquerGameCodex,catalog=api.list(),entryIds=new Set(catalog.map(r=>r.id)),categoryIds=new Set(api.categories.map(c=>'category:'+c));
  const approved=notes.filter(n=>n.meta.editorial_status==='approved');
  for(const row of catalog)if(!approved.some(n=>n.meta.codex_id===row.id&&n.meta.kind==='entry'))throw Error('Catalog entry needs an approved editorial note: '+row.id);
  const pages=approved.map(note=>{
    if(note.meta.kind==='entry'&&!entryIds.has(note.meta.codex_id))throw Error(note.file+': entry is not in gameplay catalog');
    if(note.meta.kind==='category'&&!categoryIds.has(note.meta.codex_id))throw Error(note.file+': category ID expected');
    if(note.meta.kind==='topic'&&!note.meta.codex_id.startsWith('topic:'))throw Error(note.file+': topic ID expected');
    const blocks=note.blocks.map(b=>b.type==='list'?{type:'list',items:b.items.map(item=>tokens(item,note))}:{...b,tokens:tokens(b.text,note)});
    const text=blocks.flatMap(b=>b.type==='list'?b.items.map(ts=>ts.map(t=>t.text).join('')):[b.tokens.map(t=>t.text).join('')]);
    return{id:note.meta.codex_id,kind:note.meta.kind,title:note.meta.title,aliases:note.meta.aliases,blocks,text,
      related:[...new Set(note.related.map(s=>resolve(s.slice(2,-2),note).id))],members:[...new Set(note.members.map(s=>resolve(s.slice(2,-2),note).id))]};
  }).sort((a,b)=>a.id.localeCompare(b.id,'en'));
  for(const category of api.categories)if(!pages.some(p=>p.id==='category:'+category&&p.kind==='category'))throw Error('Missing category note: '+category);
  return{schemaVersion:1,sourceDigest:crypto.createHash('sha256').update(raw.filter(r=>approved.some(n=>n.file===r.file)).map(r=>r.file+'\n'+r.source).join('\n')).digest('hex'),pages};
}
function serialize(directory){return"// Generated from content/codex/*.md. Do not edit; run node tools/export-codex-content.cjs.\n(function(root){root.ConquerWikiEditorial="+JSON.stringify(compileDirectory(directory),null,2)+";})(typeof window==='undefined'?globalThis:window);\n"}
if(require.main===module){
  try{
    const output=path.join(__dirname,'../src/codex-wiki-editorial.js'),result=serialize();
    if(process.argv.includes('--check')){
      if(!fs.existsSync(output)||fs.readFileSync(output,'utf8').replace(/\r\n/g,'\n')!==result)throw Error('Wiki editorial content is stale. Run node tools/export-codex-content.cjs');
      console.log('PASS approved Markdown content and generated Wiki artifact match');
    }else{fs.writeFileSync(output,result);console.log('Generated Wiki editorial content from approved Obsidian notes')}
  }catch(error){console.error(error.message);process.exitCode=1}
}
module.exports={parseNote,compileDirectory,serialize,headingId};
