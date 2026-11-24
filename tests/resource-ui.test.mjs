import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
test('save resource names and values stay text in the legacy resource bar',()=>{
  const source=readFileSync(new URL('../src/settlement-app-calendar-ui.js',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('function renderResourceBar('),source.indexOf('function renderUI('));
  function element(){return{children:[],textContent:'',append(x){this.children.push(x)},replaceChildren(x){this.children=x.children},
    set innerHTML(_){throw Error('resource data must never be parsed as HTML')}}}
  const host=element(),payload='<img src=x onerror=alert(1)>';
  runInNewContext(fn+';renderResourceBar(resources,icons)',{
    resources:{gold:12,[payload]:payload,constructor:3},icons:{gold:'coin'},
    document:{getElementById:()=>host,createElement:element,createDocumentFragment:element}});
  assert.equal(host.children.length,3);assert.equal(host.children[0].children[0].textContent,'12');
  assert.equal(host.children[1].textContent,` ${payload} `);assert.equal(host.children[1].children[0].textContent,payload);
  assert.equal(host.children[2].textContent,' constructor ');
});
