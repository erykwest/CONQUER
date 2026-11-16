"use strict";
const fs=require('node:fs'),assert=require('node:assert/strict'),rules=require('../src/regional-biome-rules.js');
const html=fs.readFileSync(__dirname+'/../index.html','utf8'),select=html.match(/<select[^>]*id="biomeSelect"[^>]*>([\s\S]*?)<\/select>/)[1];
const options=[...select.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)].map(m=>({value:m[1].match(/value="([^"]+)"/)[1],hidden:/\bhidden\b/.test(m[1]),disabled:/\bdisabled\b/.test(m[1])}));
assert.deepEqual(options.filter(o=>!o.hidden&&!o.disabled).map(o=>o.value),[...rules.landBiomes],'visible biome selector must match the regional terrestrial biomes');
for(const id of ['test','valley','river','mountains','sea','lake'])assert.ok(options.some(o=>o.value===id&&o.hidden&&o.disabled),'legacy biome stays readable but cannot be selected: '+id);
const regional=fs.readFileSync(__dirname+'/../CONQUER_WORLD_LAB.html','utf8');assert.ok(regional.includes('demo=hills&amp;seed=4242'),'Hills demo is reachable from the regional map');assert.ok(!regional.includes('demo=mountains&amp;seed=4242'),'Mountains are not advertised as a terrestrial biome');
console.log('PASS biome selector: four terrestrial biomes, legacy values hidden and disabled');
