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

for(const [type,label,icon] of [
  ['windmill','Mulino a vento','windmill'],
  ['watermill','Mulino ad acqua','watermill']
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
assert.match(html,/settlement\.css\?v=dev-scroll-mills-1/);
assert.match(html,/settlement-builder-ux\.js\?v=terraform-flat-h0-1/);
console.log('PASS DEV panel scroll and both original mill commands visible in the compact Builder palette');
