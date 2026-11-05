'use strict';
// One-way publication import. Never writes to the author's Obsidian vault.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {parseNote,serialize}=require('./export-codex-content.cjs');
const root=path.join(__dirname,'..');
const digest=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
function readNotes(directory,{publication=false}={}){
  const out={};
  for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.md'))){
    const text=fs.readFileSync(path.join(directory,file),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
    // Other pre-existing project Markdown in the user's folder is outside this import.
    const frontmatter=/^---\n([\s\S]*?)\n---/.exec(text);
    if(!publication&&(!frontmatter||!/^(codex_id|kind):/m.test(frontmatter[1])))continue;
    const note=parseNote(text,file);
    if(!publication&&note.ignored&&!['index','guide','template'].includes(note.meta.kind))continue;
    out[file]={text,hash:digest(text)};
  }
  return out;
}
function prepareImport({source,destination,stateFile}){
  source=fs.realpathSync(source);destination=fs.realpathSync(destination);
  if(source===destination)throw Error('Authoring vault and publication directory must be separate');
  const incoming=readNotes(source),current=readNotes(destination,{publication:true});
  if(!Object.keys(incoming).length)throw Error('No Codex notes found in authoring vault');
  const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
  if(state&&(state.version!==1||state.source!==source||state.destination!==destination))throw Error('Sync baseline belongs to another vault or publication directory');
  const baseline=state?.files||{},changes=[],conflicts=[];
  for(const file of new Set([...Object.keys(incoming),...Object.keys(current)])){
    const from=incoming[file],to=current[file],base=baseline[file];
    if(from?.hash===to?.hash)continue;
    // First import can only establish a baseline from equal existing files; it cannot overwrite.
    if(!state&&to){conflicts.push(file+' (initial contents differ)');continue}
    if(to&&to.hash!==base){conflicts.push(file+' (publication copy changed)');continue}
    if(!from&&!base){conflicts.push(file+' (publication-only note)');continue}
    changes.push({file,operation:from?'write':'remove'});
  }
  if(conflicts.length)throw Error('Import stopped without writes. Resolve publication conflicts: '+conflicts.join(', '));
  const staged=fs.mkdtempSync(path.join(os.tmpdir(),'conquer-vault-import-'));
  let artifact;
  try{
    for(const [file,note] of Object.entries(incoming))fs.writeFileSync(path.join(staged,file),note.text);
    artifact=serialize(staged); // Validate approval, IDs, links and headings before any publication write.
  }finally{
    const checked=fs.realpathSync(staged),base=fs.realpathSync(os.tmpdir());
    if(path.dirname(checked)!==base||!path.basename(checked).startsWith('conquer-vault-import-'))throw Error('Unsafe staging cleanup path');
    fs.rmSync(checked,{recursive:true});
  }
  return{source,destination,stateFile,incoming,current,changes,artifact};
}
function applyImport(plan,{artifactFile,check=false}={}){
  const artifactCurrent=artifactFile&&fs.existsSync(artifactFile)?fs.readFileSync(artifactFile,'utf8').replace(/\r\n/g,'\n'):null;
  const stale=!!artifactFile&&artifactCurrent!==plan.artifact;
  if(check)return{changed:plan.changes.length,artifactStale:stale};
  // Refuse to race an Obsidian save or a developer editing the publication copy.
  const sourceNow=readNotes(plan.source),publicationNow=readNotes(plan.destination,{publication:true});
  const hashes=notes=>JSON.stringify(Object.entries(notes).map(([f,n])=>[f,n.hash]).sort(([a],[b])=>a.localeCompare(b,'en')));
  if(hashes(sourceNow)!==hashes(plan.incoming)||hashes(publicationNow)!==hashes(plan.current))throw Error('Notes changed during import. No files written; retry after saving.');
  for(const change of [...plan.changes].sort((a,b)=>(a.operation==='remove'?0:1)-(b.operation==='remove'?0:1))){
    const file=path.join(plan.destination,change.file);
    if(path.dirname(path.resolve(file))!==path.resolve(plan.destination))throw Error('Unsafe publication target');
    if(change.operation==='remove')fs.unlinkSync(file);
    else{fs.writeFileSync(file+'.import-tmp',plan.incoming[change.file].text);fs.renameSync(file+'.import-tmp',file)}
  }
  if(artifactFile){fs.writeFileSync(artifactFile+'.import-tmp',plan.artifact);fs.renameSync(artifactFile+'.import-tmp',artifactFile)}
  fs.writeFileSync(plan.stateFile,JSON.stringify({version:1,source:plan.source,destination:plan.destination,files:Object.fromEntries(Object.entries(plan.incoming).map(([file,n])=>[file,n.hash]))},null,2)+'\n');
  return{changed:plan.changes.length,artifactStale:stale};
}
if(require.main===module){
  try{
    const index=process.argv.indexOf('--vault'),config=path.join(root,'.codex-vault.local.json');
    const source=index>=0?process.argv[index+1]:process.env.CONQUER_CODEX_VAULT||(fs.existsSync(config)?JSON.parse(fs.readFileSync(config,'utf8')).vault:null);
    if(!source)throw Error('Set --vault <authoring-folder> or CONQUER_CODEX_VAULT');
    const plan=prepareImport({source,destination:path.join(root,'content/codex'),stateFile:path.join(root,'.codex-vault-sync.json')});
    const check=process.argv.includes('--check'),result=applyImport(plan,{check,artifactFile:path.join(root,'src/codex-wiki-editorial.js')});
    console.log((check?'Checked':'Imported')+' Obsidian Codex: '+Object.keys(plan.incoming).length+' notes, '+result.changed+' changed; '+(result.artifactStale?'editorial artifact '+(check?'stale':'regenerated'):'editorial artifact current'));
    if(check&&(result.changed||result.artifactStale))process.exitCode=1;
  }catch(error){console.error(error.message);process.exitCode=1}
}
module.exports={prepareImport,applyImport,readNotes,digest};
