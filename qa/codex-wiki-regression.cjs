'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),{generate}=require('../tools/export-codex.cjs');
const sandbox=vm.createContext({});
for(const file of ['codex-catalog.js','codex-wiki-editorial.js','codex-wiki-content.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),sandbox);
const data=generate(),api=sandbox.ConquerCodex.fromSnapshot(data.catalog),wiki=sandbox.ConquerWikiContent.create(api);
assert.equal(wiki.pages.size,142+7+8);
for(const p of wiki.pages.values()){
  assert.ok(p.title&&!p.title.includes('undefined'),p.id+' title');
  for(const text of p.text){
    const tokens=wiki.tokenize(text,p.id);assert.equal(tokens.map(t=>t.text).join(''),text,'linkification preserves text');
    for(const t of tokens)if(t.id){assert.ok(wiki.pages.has(t.id),t.id);assert.notEqual(t.id,p.id,'no self links')}
  }
  for(const id of [...p.members||[],...p.parents||[]])assert.ok(wiki.pages.has(id),id);
}
const tower=wiki.tokenize(wiki.pages.get('building:tower').text[0],'building:tower');
assert.ok(tower.some(t=>t.text==='fortificazioni'&&t.id==='topic:fortifications'));
assert.ok(tower.some(t=>t.text==='stanze'&&t.id==='category:room'));
assert.ok(wiki.tokenize('Ponte levatoio della porta e ponte levatoio del mastio.','home').some(t=>t.id==='upgrade:gate.drawbridge'));
assert.ok(wiki.tokenize('FORTIFICAZIONI e costruzioni.','home').some(t=>t.id==='topic:fortifications'));
assert.ok(!wiki.tokenize('sottocostruzioni','home').some(t=>t.id),'word boundaries');
assert.ok(wiki.backlinks('topic:fortifications').includes('building:tower'));
assert.ok(wiki.pages.get('room:kitchen').text[0].includes('piano terra'));
assert.ok(wiki.pages.get('building:mine').text[0].includes('pietra'));
const generated=fs.readFileSync(path.join(root,'wiki/catalog.json'),'utf8').replace(/\r\n/g,'\n');
assert.equal(generated,JSON.stringify(data,null,2)+'\n','generated public data must match live definitions');
assert.deepEqual(JSON.parse(JSON.stringify(api.quote('ship:barca'))),data.catalog.items.find(r=>r.id==='ship:barca').quotes);
console.log('PASS Wiki: 157 pages, inline parent-keyword links, longest match, boundaries, backlinks and fresh gameplay export');
