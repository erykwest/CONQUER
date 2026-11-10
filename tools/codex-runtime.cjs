'use strict';
// Isolated export runtime: actual gameplay definitions, no browser, network or user saves.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function createRuntime(){
const noop=()=>{};
const drawing=new Proxy({},{get:()=>noop});
const element={getContext:()=>drawing,style:{},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop};
const sandbox={window:{__CONQUER_ASSET_LAB__:true,addEventListener:noop},
  document:{getElementById:()=>element,createElement:()=>element,addEventListener:noop},
  console,crypto:{randomUUID:()=> 'qa'},performance:{now:()=>0},navigator:{userAgent:'qa'},
  innerWidth:800,innerHeight:600,devicePixelRatio:1,localStorage:{getItem:()=>null,setItem:noop},
  setTimeout:noop,requestAnimationFrame:noop,location:{search:''}};
const ctx=vm.createContext(sandbox),load=file=>vm.runInContext(read('src/'+file),ctx,{filename:file});
const sources=['settlement-core.js','settlement-terraforming.js','settlement-civic-annexes.js','settlement-castle-placement.js',
  'assets/industry-models.js','settlement-industries.js','settlement-events3d.js','settlement-pier.js','settlement-quay.js',
  'settlement-shipyard.js','assets/ship-models.js','settlement-ships.js',
  'settlement-crossings.js','settlement-gate-fittings.js','settlement-keep-entrance.js',
  'settlement-economy.js','settlement-siege.js','settlement-combat-rules.js',
  'assets/siege-engines-model.js','settlement-siege-engines3d.js','codex-catalog.js','settlement-codex.js'];
for(const file of sources)load(file);

return {ctx,sandbox,sources};
}
module.exports={createRuntime};
