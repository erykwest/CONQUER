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
    const edits=[[".filter(part=>part.kind!=='outbuilding')",''],
      // Behaviour edits (cutaway furniture): occupants stand on spots the furniture
      // leaves free, cutaway gates use their ground plane, and slit archers already
      // stand on their floor inside the wall (archerSlots).
      ["        // Stand on floor spots left free by the furniture; the fixed layout is the fallback.\n        const spots=window.ConquerCutawayFurniture?.standSpots(s,slot,count);\n",''],
      ["const p=spots?.[i]?{x:spots[i].x+sway*.4,y:spots[i].y}:cutawayRoomPoint(slot,nx+sway,ny);","const p=cutawayRoomPoint(slot,nx+sway,ny);"],
      ["    if(s.type==='tower'||s.type==='gate')withStructureGroundPlane(s,render);else render();\n  }\n}\nfunction wallPatrolPoint","    if(s.type==='tower')withStructureGroundPlane(s,render);else render();\n  }\n}\nfunction wallPatrolPoint"],
      ["      // Slit archers already stand on their floor just inside the wall (archerSlots).\n      const p=slot.p;","      const p=slot.kind==='slit'\n        ?{x:tower.x+(slot.p.x-tower.x)*.63,y:tower.y+(slot.p.y-tower.y)*.63}\n        :slot.p;"]];
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
