'use strict';
// The shared indexed-model seam preserves every published vertex, part and colour.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..','src');
const window={};
const context=vm.createContext({window,Float32Array});
const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
load('settlement-mesh3d.js');
const expand=window.ConquerMesh3D.modelParts;
const registers=[
  ['assets/civic-models.js','ConquerCivicModels'],
  ['assets/house-models.js','ConquerHouseModels'],
  ['assets/wood-fort-models.js','ConquerWoodFortModels']
];
let models=0,parts=0,vertices=0;
for(const [file,global] of registers){
  load(file);
  for(const [key,model] of Object.entries(window[global].models)){
    const actual=expand(model),source=Object.entries(model.parts);
    assert.equal(actual.length,source.length,global+'.'+key+': part count');
    assert.equal(expand(model),actual,'same model reuses its expansion');
    for(let i=0;i<source.length;i++){
      const [name,part]=source[i],out=actual[i];
      // Independent indexed-gather reference, including Float32 conversion and signed zero.
      const reference=Float32Array.from(Array.from(part.i).flatMap(j=>Array.from(part.p.slice(j*3,j*3+3))));
      assert.equal(out.name,name,'part order');
      assert.ok(out.v instanceof Float32Array,'vertices use Float32 precision');
      assert.deepEqual(Buffer.from(out.v.buffer),Buffer.from(reference.buffer),global+'.'+key+'.'+name+': exact vertex bytes');
      assert.equal(out.c,part.c,'colour indices keep their identity and order');
      parts++;vertices+=part.i.length;
    }
    models++;
  }
}
// Same names and index arrays in distinct model registers must never alias a cached part.
const a={parts:{wall:{p:[0,-0,1/3,1,0,0,0,1,0],i:[2,0,1],c:[3]}}};
const b={parts:{wall:{p:[9,8,7,6,5,4,3,2,1],i:[2,0,1],c:[6]}}};
assert.notEqual(expand(a),expand(b));
assert.equal(expand(a)[0].v[0],0);
assert.equal(expand(b)[0].v[0],3);
assert.equal(expand(a)[0].c[0],3);
assert.equal(expand(b)[0].c[0],6);
const catalog={models:{same:a}},old=expand(catalog.models.same);
catalog.models.same=b;
assert.equal(expand(catalog.models.same),expand(b),'replacing a model under the same key refreshes expansion');
assert.notEqual(expand(catalog.models.same),old);
// A kit may be stale or load late: absent pieces are empty without caching a permanent miss.
assert.equal(expand(undefined).length,0);
assert.equal(expand(null).length,0);
assert.equal(expand({}).length,0);
const late={};assert.equal(expand(late).length,0);late.parts=a.parts;
assert.equal(expand(late)[0].name,'wall','a model that arrives later becomes available');
console.log(`PASS shared model expansion: ${models} models, ${parts} parts, ${vertices} vertices; isolated identity cache and absent-kit fallback`);
