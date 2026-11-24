'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};
vm.runInNewContext(fs.readFileSync(__dirname+'/../src/ui/save-status.js','utf8'),{window});
const {classify,label}=window.ConquerSaveStatus;
const cases={
  saved:['saved local','saved cloud','saved camp local','Salvato','  SAVED CLOUD  '],
  unsaved:['unsaved','not saved','non salvato','modifiche non salvate','cloud ready','unknown',''],
  loading:['cloud loading','local saving','salvataggio in corso','caricamento cloud','salvando'],
  blocked:['cloud save blocked','salvataggio bloccato','locale bloccato'],
  error:['local save failed','cloud error','cloud load failed','salvataggio non caricato','Errore di salvataggio','caricamento fallito']
};
for(const [state,texts] of Object.entries(cases))for(const text of texts)assert.equal(classify(text),state,text);
assert.equal(classify(null),'unsaved');assert.equal(classify(undefined),'unsaved');
assert.equal(label('blocked'),'Salvataggio bloccato');
assert.equal(label('loading'),'Salvataggio in corso');
assert.equal(label('saved',{saved:'SALVATO'}),'SALVATO');
assert.equal(label('anything'),'Modifiche non salvate');
console.log('PASS save indicators: local/cloud/CAMP, loading, blocked, errors and Italian messages never imply false success');
