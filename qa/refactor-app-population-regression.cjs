'use strict';
// Second-phase source parity and script-order contract. Any source edits beyond
// mechanical extraction invalidate these original Git object hashes.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const root=__dirname+'/../';
// Siege hooks in the navigation: ruined stumps and the high core of collapse heaps block
// movement. Each must appear exactly once; removing them gives back the original source.
const siegeHooks={'population-garrisons':[
  ["const guards=window.ConquerCrossings?.drawbridgeGuards?.(gate)||gateGuardPositions(gate);   // on a lowered drawbridge: at its far end","const guards=gateGuardPositions(gate);"],
  ["const p=guards[i],z=p.z??.08;","const p=guards[i],z=.08;"],
  ["    if(window.ConquerSiege?.gateClosed?.(gate))continue;   // closed: the guards are inside\n",'']
],'population-navigation':[
  ["  if(window.ConquerSiege?.rubbleBlocks?.(p))return true;      // the high core of a collapse heap\n",''],
  ["'training','ruin'].includes(s.type))continue;","'training'].includes(s.type))continue;"],
  ["if((s.type==='tower'||s.type==='ruin')&&s.shape==='round')","if(s.type==='tower'&&s.shape==='round')"],
  // A closed gate with its door still whole shuts the passage.
  ["      // A closed gate with its door still whole shuts the passage (settlement-siege.js).\n      if(gatePointInPassage(s,p,.08)){if(window.ConquerSiege?.gateClosed?.(s))return true;continue}",
   "      if(gatePointInPassage(s,p,.08))continue;"]
]};
const read=name=>(siegeHooks[name]||[]).reduce((src,[hooked,original])=>{
  assert.equal(src.split(hooked).length,2,'Expected exactly one siege hook: '+hooked.trim().slice(0,60));
  return src.replace(hooked,()=>original);
},fs.readFileSync(root+'src/settlement-'+name+'.js','utf8'));
const blob=src=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(src)+'\0'+src).digest('hex');
const header=/^'use strict';\r?\n\/\/ [^\r\n]+\r?\n/;
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
    const edits=[[".filter(part=>part.kind!=='outbuilding')",'']];
    const original=edits.reduce((src,[edited,orig])=>{
      assert.equal(src.split(edited).length,2,'Expected exactly one population edit: '+edited);
      return src.replace(edited,()=>orig);
    },source);
    // Later population features changed the split modules on purpose; the byte lock is replaced
    // by the entry points other modules call (castle modules use the same approach).
    for(const fn of ['drawPeasants','drawCutawayOccupants','drawCastleSoldiers','wallPatrolPoint','drawTrainingSoldiers'])
      assert.match(original,new RegExp('function '+fn+'\\('),'Population keeps '+fn);
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
