'use strict';
// Guard against tools present in the original Builder markup disappearing
// when the compact icon palette reorganizes its live controls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const html=read('index.html');
const css=read('src/settlement.css');
const ux=read('src/settlement-builder-ux.js');

// A shared legacy glyph must never collapse distinct catalog entries again.
const vm=require('node:vm');
const catalog=JSON.parse(read('src/assets/builder-icons/catalog.json'));
const groups=vm.runInNewContext(ux.slice(ux.indexOf('  const groups=[')+2,ux.indexOf('  // The combat module'))+';groups');
assert.equal(groups.flatMap(g=>g.items).length,54);
assert.equal(catalog.entries.length,74);
for(const entry of catalog.entries){
  const asset=read('src/assets/builder-icons/'+entry.id+'.svg');
  assert.match(asset,/viewBox="0 0 64 64"/);
  assert(!/<(?:image|text|filter|linearGradient|radialGradient)\b/.test(asset),entry.id+' must remain a true flat vector');
  assert(read('src/asset-manifest.js').includes('src/assets/builder-icons/'+entry.id+'.svg'),entry.id+' in Asset Lab');
}
for(const group of groups){
  assert(catalog.entries.some(e=>e.id===group.icon),'category icon '+group.icon);
  for(const [selector,label,id] of group.items){
    const entry=catalog.entries.find(e=>e.selector===selector);
    assert(entry,'catalog selector '+selector);
    assert.equal(id,entry.id,label+' uses its own artwork');
  }
}
for(const match of ux.matchAll(/icon:'([^']+)'/g))assert(catalog.entries.some(e=>e.id===match[1]),'registered option/category '+match[1]);
assert.match(ux,/<img class="ux-svg"[^>]*alt=""[^>]*aria-hidden="true"/,'decorative image keeps the button accessible name');
assert.match(css,/\.ux-builder button\.ux-icon-btn[^}]*background:#e8ddc6/,'black icons have a light surface');

for(const [type,label,icon] of [
  ['windmill','Mulino a vento','mulino-vento'],
  ['watermill','Mulino ad acqua','mulino-acqua']
]){
  assert.match(html,new RegExp('<button data-industry="'+type+'">'),'existing '+type+' button');
  assert.ok(ux.includes("['[data-industry=\""+type+"\"]','"+label),'visible '+type+' catalog entry');
  assert.match(ux,new RegExp(type+'[^\\n]*\\x27'+icon+'\\x27'),'distinct '+type+' icon');
}
const economy=ux.slice(ux.indexOf("{id:'economy'"),ux.indexOf("{id:'combat'"));
assert.match(economy,/data-industry="windmill"/);
assert.match(economy,/data-industry="watermill"/);
assert.match(ux,/originalButtons=\[\.\.\.root\.querySelectorAll\('button'\)\]/);
assert.match(ux,/for\(const b of industryButtons\)retained\.append\(b\)/);
assert.match(ux,/catalog\.append\(b\)/);
assert.match(css,/#devTools\{[^}]*max-height:calc\(100% - 24px\)/);
assert.match(css,/#devToggle\{[^}]*flex:0 0 34px/);
assert.match(css,/#devPanel\{[^}]*min-height:0;[^}]*overflow-y:auto;[^}]*overscroll-behavior:contain/);
assert.match(html,/settlement\.css\?v=buildericon-1/);
assert.match(html,/settlement-builder-ux\.js\?v=buildericon-1/);
// Both stone gate buttons (gatehouse and small gate) get a catalog entry of their own.
for(const size of ['1.5','1']){
  assert.match(html,new RegExp('<button data-gate data-gate-size="'+size+'">'),'gate button '+size);
  assert.ok(ux.includes('[data-gate][data-gate-size="'+size+'"]'),'visible gate '+size+' catalog entry');
}
console.log('PASS DEV panel scroll, both mills and both stone gates visible in the compact Builder palette');
