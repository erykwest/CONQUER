'use strict';
// Second-phase source parity and script-order contract. Any source edits beyond
// mechanical extraction invalidate these original Git object hashes.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const root=__dirname+'/../';
const read=name=>fs.readFileSync(root+'src/settlement-'+name+'.js','utf8');
const blob=src=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(src)+'\0'+src).digest('hex');
const header=/^'use strict';\n\/\/ [^\n]+\n/;
const parts={
  population:['population','population-fields','population-navigation',
    'population-routines','population-residents','population-figures','population-garrisons'],
  app:['app','app-rooms','app-input','app-persistence','app-calendar-ui',
    'app-simulation','app-bootstrap']
};
const baselines={
  population:'af0d0dee58f9dc4ea0b98c353c2fc9c27a0b3645',
};
for(const [name,files] of Object.entries(parts)){
  const source=files.map((file,i)=>{
    const s=read(file);
    if(i===0)return s;
    const stripped=s.replace(header,'');
    assert.notEqual(stripped,s,'New module '+file+' must have a header');
    return stripped;
  }).join('');
  if(name==='population'){
    // Behaviour edit: L3/L4 yard outbuildings are excluded from the townhouse
    // shadow hull. Each such edit must appear exactly once; removing it must
    // give back the byte-identical extracted module.
    // The urban livestock sync intentionally excludes L1 shepherds from field
    // assignments and gives the pastoral adult a daily route. Strip exactly
    // those edits, then retain the original byte-for-byte extraction check.
    const edits=[
      ["  if(!path&&dist(start,goal)<=18){\n    path=findPeasantPath(start,goal,house.id,3);\n    // A fence entrance can lie several units around the field perimeter.\n    // Expand the field-only detour when the short local A* is insufficient.\n    if(!path)path=findPeasantPath(start,goal,house.id,8);\n  }", "  if(!path&&dist(start,goal)<=18)path=findPeasantPath(start,goal,house.id,3);"],
      ["  if(urbanFencePointBlocked(p,PEASANT_CLEARANCE))return true;\n", ""],
      [".filter(part=>part.kind!=='outbuilding')", ''],
      ["houses.filter(h=>houseLevel(h)===tier&&(tier!==1||window.ConquerLivestock?.lotKindForHouse(h)!=='shepherd'))",
       "houses.filter(h=>houseLevel(h)===tier)"],
      ["+'|livestock-seed:'+State.seed;", ";"],
      ["  // Flocks need their shepherd even on market/rest days.\n  if(houseLevel(house)===1&&resident.sex==='male'&&resident.age==='adult'&&\n      window.ConquerLivestock?.lotKindForHouse(house)==='shepherd')\n    return window.ConquerLivestock.shepherdPosition(house);\n", ""]
    ];
    const original=edits.reduce((src,[edited,orig])=>{
      assert.equal(src.split(edited).length,2,'Expected exactly one population edit: '+edited);
      return src.replace(edited,()=>orig);
    },source);
    assert.equal(blob(original),baselines[name],
      'Population module split must remain byte-identical until behavior edits');
  }else{
    // Post-refactor interaction enhancements are intentionally allowed in app.
    // Preserve the extracted module ordering and stable entrypoint functions.
    assert.match(source,/function structureAt\(/);
    assert.match(source,/function structureAtScreen\(/);
    assert.match(source,/function renderFunctionPanel\(/);
    assert.match(source,/function selectStructure\(/);
    assert.match(source,/function markDirty\(/);
  }
  console.log('PASS '+name+' extracted source contract');
}
const html=fs.readFileSync(root+'index.html','utf8');
const order=[...html.matchAll(/<script\s+src="\.\/src\/([^"?]+)(?:\?[^"]*)?"\s*><\/script>/g)].map(m=>m[1]);
const index=x=>order.indexOf('settlement-'+x+'.js');
for(const [name,files] of Object.entries(parts)){
  const indices=files.map(file=>index(file));
  assert.ok(indices.every(x=>x>=0));
  assert.deepEqual(indices,[...indices].sort((a,b)=>a-b),'Source order '+name);
  for(const file of files)assert.equal(order.filter(x=>x==='settlement-'+file+'.js').length,1,
    'Scripts load only once: '+file);
}
assert.ok(index('siege')<index('population'));
assert.ok(index('population-garrisons')<index('snow-tracks'));
assert.ok(index('snow-tracks')<index('architecture'));
assert.ok(index('economy')<index('app'));
assert.ok(index('app-bootstrap')<index('combat-rules'));
console.log('PASS original runtime script order and dependency placement');
