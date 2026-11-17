'use strict';
// The Mastio's heraldic drape is a World 3D facade decal (it was a Canvas overlay painted over the
// 3D frame before the 2.5D retirement): one under each castle-facing window of a stone keep, and
// the wooden keep's window and drape too. The atlas repaints when the heraldry changes or loads.
const fs=require('fs'),assert=require('assert');
const src=f=>fs.readFileSync(__dirname+'/../src/'+f,'utf8');
const w3=src('settlement-world3d.js'),her=src('settlement-heraldry.js'),render=src('settlement-render.js');
const check=(name,fn)=>{fn();console.log('PASS',name)};

check('the drape is a tile of the decal atlas, painted with the realm heraldry',()=>{
  assert.ok(w3.includes("'__white','__glow','__mastioDrape'"),'atlas tile');
  assert.ok(/function paintMastioDrape\(g,x,y,T\)\{[\s\S]*__conquerHeraldryCanvas\?\.paint\(g,0,0,100,120\)/.test(w3),'heraldry raster');
  assert.ok(/REIGN_COLOR_1[\s\S]*REIGN_COLOR_2/.test(w3.slice(w3.indexOf('function paintMastioDrape'))),'two-colour fallback');
});
check('one drape under each castle-facing window of a stone keep (square and round)',()=>{
  const drapes=w3.match(/drape\(s,edge,row\.z,/g)||[];
  assert.equal(drapes.length,2,'square and round window rows');
  assert.ok(w3.includes("const width=Math.max(.30,windowW*1.08),height=.64,top=windowZ-windowH/2-.055"),'same size and sill offset as the old painter');
  assert.ok(w3.includes('if(!s.isMastio)return;'),'only the keep');
});
check('the wooden keep keeps its window and drape',()=>{
  assert.ok(w3.includes("s.type==='tower'&&s.isMastio&&woodTowerStyle(s)!=='watchtower'"),'wooden keep branch');
  assert.ok(w3.includes('if(edge&&!towerWindowGivesWayToDoor(s,edge,2))'),'the raised doorway takes its place');
});
check('the decals rebuild when the heraldry changes or its image loads',()=>{
  assert.ok(her.includes('function signature(){update();return cachedKey+(ready?\'#ready\':\'#pending\')}'),'heraldry signature');
  assert.ok(w3.includes("window.__conquerHeraldryCanvas?.signature?.()||JSON.stringify(State.heraldry||null)"),'decal signature');
});
check('no Canvas drape pass over the 3D frame',()=>{
  assert.ok(!/drawMastioDrapes|drawMastioWindowDrape/.test(w3+render),'no 2.5D painter');
});
