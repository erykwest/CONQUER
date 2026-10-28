'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/settlement-combat.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

// Visual defaults are independent of the world-state area masks.
assert.match(source,/function defaults\(\)\{return\{version:2,fog:false,zones:false,/);
assert.match(source,/combat\.fog=false;[\s\S]{0,250}combat\.zones=false;/,
  'restored games should start with the zone overlays hidden');
assert.match(source,/<button id="combatZones">Zones OFF<\/button>/);
assert.match(source,/\$\('combatZones'\)\.onclick=\(\)=>\{combat\.zones=!combat\.zones;changed\(\);draw\(\)\}/,
  'Zones button still toggles overlays');
assert.match(source,/function areaState\(p\)/,'zone simulation remains independent of overlay state');

// Mask geometry is 8 pixels per world unit (4x pixel count of prior 4px/U),
// then bilinearly interpolated at arbitrary zoom, rather than nearest-neighbor.
assert.match(source,/const ZONE_PIXELS=8, ZONE_SIZE=WORLD\*ZONE_PIXELS;/);
assert.match(source,/if\(combat\.zones&&activeWell\(\)\)\{\s*c\.imageSmoothingEnabled=true;\s*c\.imageSmoothingQuality='high';/);
assert.match(source,/g\.imageSmoothingEnabled=true;\s*g\.imageSmoothingQuality='high';\s*g\.drawImage\(backdrop,0,0\);/);
assert.match(html,/settlement-combat\.js\?v=zones-hd-off-1/);
console.log('PASS Zones OFF by default, toggle preserved, high-resolution anti-aliased outlines');
