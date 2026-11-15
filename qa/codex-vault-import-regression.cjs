'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {prepareImport,applyImport,readNotes}=require('../tools/import-codex-vault.cjs');
const base=fs.mkdtempSync(path.join(os.tmpdir(),'conquer-import-qa-')),author=path.join(base,'author'),publication=path.join(base,'publication'),stateFile=path.join(base,'baseline.json'),artifactFile=path.join(base,'editorial.js');
try{
  fs.mkdirSync(author);fs.mkdirSync(publication);
  const fixtures=path.join(__dirname,'../content/codex');
  for(const file of fs.readdirSync(fixtures).filter(f=>f.endsWith('.md'))){fs.copyFileSync(path.join(fixtures,file),path.join(author,file));fs.copyFileSync(path.join(fixtures,file),path.join(publication,file))}
  fs.writeFileSync(path.join(author,'Other Project.md'),'Unrelated project material, not for the Wiki.');
  const options={source:author,destination:publication,stateFile};
  let plan=prepareImport(options);assert.equal(plan.changes.length,0);applyImport(plan,{artifactFile});
  assert.ok(!fs.existsSync(path.join(publication,'Other Project.md')),'unrelated authoring files excluded');
  const note=path.join(author,'Torre.md'),published=path.join(publication,'Torre.md'),original=fs.readFileSync(note,'utf8');
  fs.writeFileSync(note,original.replace('La torre appartiene','La torre modificata appartiene'));
  plan=prepareImport(options);assert.equal(plan.changes.length,1);
  const before=fs.readFileSync(published,'utf8');assert.equal(applyImport(plan,{artifactFile,check:true}).changed,1);assert.equal(fs.readFileSync(published,'utf8'),before,'check mode never writes');
  applyImport(plan,{artifactFile});assert.ok(fs.readFileSync(published,'utf8').includes('torre modificata'));
  assert.ok(fs.readFileSync(artifactFile,'utf8').includes('torre modificata'));
  const authorBefore=fs.readFileSync(note,'utf8');
  fs.writeFileSync(published,authorBefore.replace('torre modificata','torre modificata in repo'));
  assert.throws(()=>prepareImport(options),/publication copy changed/);
  assert.equal(fs.readFileSync(note,'utf8'),authorBefore,'authoring vault never overwritten by conflicts');
  fs.writeFileSync(published,authorBefore);
  fs.unlinkSync(published);assert.throws(()=>prepareImport(options),/publication copy deleted/);fs.writeFileSync(published,authorBefore);
  fs.writeFileSync(note,authorBefore.replace('## Spazi Interni','[[Missing Target]]\n\n## Spazi Interni'));
  assert.throws(()=>prepareImport(options),/unresolved/);assert.equal(fs.readFileSync(published,'utf8'),authorBefore,'broken links produce no writes');
  fs.writeFileSync(note,authorBefore);
  // A rename is imported without duplicate IDs and preserves link destinations via aliases.
  fs.renameSync(note,path.join(author,'Torre Rinominata.md'));
  plan=prepareImport(options);assert.equal(plan.changes.length,2);applyImport(plan,{artifactFile});
  assert.ok(!fs.existsSync(published));assert.ok(fs.existsSync(path.join(publication,'Torre Rinominata.md')));
  plan=prepareImport(options);
  fs.appendFileSync(path.join(author,'Torre Rinominata.md'),'\n');
  assert.throws(()=>applyImport(plan,{artifactFile}),/Notes changed during import/,'concurrent save detected before writes');
  const fresh=prepareImport(options);applyImport(fresh,{artifactFile});
  assert.equal(applyImport(prepareImport(options),{artifactFile,check:true}).changed,0);
  assert.equal(Object.keys(readNotes(author)).length,164);
  console.log('PASS vault import: one-way sync, fresh export, unrelated-file exclusion, dry check, conflicts, invalid links, renames and concurrent saves');
}finally{
  const resolved=fs.realpathSync(base),temp=fs.realpathSync(os.tmpdir());
  if(path.dirname(resolved)!==temp||!path.basename(resolved).startsWith('conquer-import-qa-'))throw Error('Unsafe cleanup target');
  fs.rmSync(resolved,{recursive:true});
}
