'use strict';
// Occlusion clips (ported from visual-qa #18): every occluder hull is cut out with its own
// even-odd clip, so overlapping hulls never XOR each other back into view.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const structures=fs.readFileSync(__dirname+'/../src/settlement-castle-structures.js','utf8');
const architecture=fs.readFileSync(__dirname+'/../src/settlement-architecture.js','utf8');

// No compound path of several hulls followed by one even-odd clip.
for(const [name,src] of [['castle-structures',structures],['architecture',architecture]]){
  assert.doesNotMatch(src,/for\(const [a-z]+ of [a-zA-Z]+\)\{\s*const hull=[^\n]*\n?[^\n]*ctx\.moveTo\(hull\[0\]\.x,hull\[0\]\.y\)[\s\S]{0,200}?ctx\.closePath\(\)\s*\}\s*\n?\s*ctx\.clip\('evenodd'\)/,name+': hulls must not share one even-odd clip path');
}
for(const fn of ['withPalisadeConnectionOcclusion','withStructureDetailOcclusion','withBuiltRoofOcclusionClip','withTowerBattlementOcclusion','withPointRoofOcclusion']){
  const body=structures.match(new RegExp('function '+fn+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'))?.[0];
  assert.ok(body,fn+' exists');
  assert.match(body,/clipOutsideHulls\(/,fn+' uses clipOutsideHulls');
}
assert.match(architecture,/clipOutsideHulls\(occ\.map\(structureScreenSilhouette\)/,'tower door occlusion uses clipOutsideHulls');

// Behaviour: one frame+hull clip per valid hull, degenerate hulls skipped.
const fnSrc=structures.match(/function clipOutsideHulls\([^)]*\)\{[\s\S]*?\n\}/)[0];
const calls=[];
const ctx={beginPath:()=>calls.push('begin'),rect:()=>calls.push('rect'),moveTo:()=>{},lineTo:()=>{},closePath:()=>{},clip:rule=>calls.push('clip:'+rule)};
const sq=(x,y)=>[{x,y},{x:x+10,y},{x:x+10,y:y+10},{x,y:y+10}];
vm.runInNewContext(fnSrc+';clipOutsideHulls(hulls,-48,-48,500,500)',{ctx,hulls:[sq(0,0),sq(5,5),[{x:1,y:1}]]});
assert.deepEqual(calls,['begin','rect','clip:evenodd','begin','rect','clip:evenodd']);

console.log('occlusion-clip regression PASS');
