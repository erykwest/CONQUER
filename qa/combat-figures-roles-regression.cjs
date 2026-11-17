'use strict';
// MIL-FIG-01 (17/11/2026): guards, pikemen, the regiment's herald and the levy look different,
// and men of L3/L4 houses never fight.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const combat=read('src/settlement-combat.js'),render=read('src/settlement-combat-render.js');
const figures=read('src/settlement-population-figures.js'),anim=read('src/settlement-combat-anim.js');
const wardrobe=read('src/settlement-wardrobe.js');

// L3/L4 men never fight: one rule for the alarm and the levy.
const canFightSrc=combat.match(/function canFight\(house,resident\)\{[\s\S]*?\n  \}/);
assert.ok(canFightSrc,'canFight is defined in settlement-combat.js');
const canFight=vm.runInNewContext('('+canFightSrc[0]+')');
const man={age:'adult',sex:'male'};
for(const level of [1,2])assert.equal(canFight({houseLevel:level},man),true,'L'+level+' men can fight');
for(const level of [3,4])assert.equal(canFight({houseLevel:level},man),false,'L'+level+' men never fight');
assert.equal(canFight({houseLevel:1},{age:'adult',sex:'female'}),false,'women are not armed');
assert.equal(canFight({houseLevel:1},{age:'child',sex:'male'}),false,'boys are not armed');
assert.match(combat,/function leviedResident\(house,resident\)\{[\s\S]{0,200}canFight\(house,resident\)/,'the levy uses canFight');
assert.match(combat,/canFight\(house,resident\)\?'recruit':alarm/,'the alarm uses canFight; L3/L4 men shelter');

// Squad: herald first (standard instead of the spear), then pikemen with shields; patrols keep 'spearman'.
assert.match(render,/const squadType=i===0\?'herald':'pikeman'/,'squad = herald + pikemen');
assert.match(render,/u\.kind==='squad'\?squadType:'spearman'/,'patrol guards stay spear only');
assert.match(anim,/if\(type==='herald'\)\{[^}]*\}\s*else if\(type==='spearman'\|\|type==='pikeman'\)drawSpear/,'the herald carries no spear');
assert.match(anim,/type==='pikeman'\|\|type==='herald'\)drawSpearShield/,'pikemen and herald carry the shield');
assert.match(figures,/function soldierSpearHandX\(base,bodyW\)\{return base\.x-bodyW\*\.55\}/,'spear in the right hand: screen left');
assert.match(figures,/const HERALD_STANDARD_SIZE=3;/,'standard three times the old squad flag');

// Levy: class clothes + heraldic hood, spear and shield or bow; never the livery soldier.
assert.match(figures,/if\(dot\.militia\)drawLevyFigure\(dot\)/,'recruits are drawn as levy, not as livery soldiers');
assert.match(figures,/head:'levyHood'/,'the levy wears the heraldic hood');
assert.match(wardrobe,/levyHood:\{[^}]*heraldic:true/,'levyHood is heraldic');
console.log('PASS combat figure roles: L3/L4 men never fight; guards, pikemen, herald and levy distinct');
