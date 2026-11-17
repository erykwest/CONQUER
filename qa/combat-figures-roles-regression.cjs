'use strict';
// MIL-FIG-01 (17/11/2026): guards, pikemen, the regiment's herald and the levy look different,
// and each house class has its combat role.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const combat=read('src/settlement-combat.js'),render=read('src/settlement-combat-render.js');
const figures=read('src/settlement-population-figures.js'),anim=read('src/settlement-combat-anim.js');
const wardrobe=read('src/settlement-wardrobe.js');

// Who fights, by class: L1 levy infantry, L2 levy archers, L3 men-at-arms, L4 knights.
// Only the levy (L1/L2) answers the alarm and the levy; how L3/L4 are raised is still open.
const rulesSrc=combat.match(/const COMBAT_ROLE_BY_LEVEL=[\s\S]*?function canFight\(house,resident\)\{[\s\S]*?\n  \}/);
assert.ok(rulesSrc,'combatRole and canFight are defined in settlement-combat.js');
const {combatRole,canFight}=vm.runInNewContext(rulesSrc[0]+';({combatRole,canFight})');
const man={age:'adult',sex:'male'};
assert.deepEqual([1,2,3,4].map(l=>combatRole({houseLevel:l},man)),['levySpear','levyArcher','manAtArms','knight'],'role by house class');
for(const level of [1,2])assert.equal(canFight({houseLevel:level},man),true,'L'+level+' men are the levy');
for(const level of [3,4])assert.equal(canFight({houseLevel:level},man),false,'L'+level+' men are not called to the armory as levy');
assert.equal(combatRole({houseLevel:1},{age:'adult',sex:'female'}),null,'women are not armed');
assert.equal(combatRole({houseLevel:1},{age:'child',sex:'male'}),null,'boys are not armed');
assert.match(figures,/function levyArcher\(dot\)\{return dot\.kind==='artisan'\}/,'L2 artisans are the levy archers');
assert.match(figures,/if\(type==='manAtArms'\)return drawManAtArmsUnmasked/,"L3 man-at-arms figure");
// Knights (L4): crest on the helmet and cloak, on foot and mounted; sword in the right hand (screen
// left) and shield; dismounted in the tournament and on the training field.
const mounted=read('src/settlement-mounted2d.js'),events=read('src/settlement-events-people.js'),garrisons=read('src/settlement-population-garrisons.js');
assert.match(figures,/if\(knightly\)drawKnightCloak\(/,'knight on foot: cloak');
assert.match(figures,/if\(knightly\)drawKnightCrest\(/,'knight on foot: crest');
assert.match(anim,/type==='knight'\?'knightUnarmed':'unarmed'/,'posed knight keeps cloak and crest');
assert.match(anim,/const hx=base\.x-bodyW\*\.42/,'posed sword in the right hand (screen left)');
assert.match(mounted,/if\(o\.kind==='knight'\)cloak\(ctx,o\);/,'mounted knight: cloak');
assert.match(mounted,/if\(o\.kind==='knight'\)crest\(ctx,o,/,'mounted knight: crest on every helmet');
// Heraldic crest: torse + figure (wings, antlers, horns, eagle, crown) + mantling behind the helmet,
// one drawing shared by the knight on foot and on horseback, figure stable per knight.
assert.match(figures,/const KNIGHT_CRESTS=Object\.freeze\(\['wings','antlers','horns','eagle','crown'\]\)/,'crest figures');
assert.match(figures,/if\(knightly\)drawKnightMantling\([\s\S]{0,200}drawSoldierHelmet\([\s\S]{0,120}if\(knightly\)drawKnightCrest\(/,'mantling behind the helmet, crest above it');
assert.match(mounted,/drawHeraldicMantling\(ctx,/,'mounted knight: same mantling');
assert.match(mounted,/drawHeraldicCrest\(ctx,/,'mounted knight: same crest');
assert.match(render,/crest:typeof knightCrestKind==='function'\?knightCrestKind\(id\):null/,'mounted knight keeps his own crest figure');
assert.match(events,/drawSoldierFigureUnmasked\(p,g\+\.1,'knight',a\.id,a\.swing,liv\)/,'tournament fighters are dismounted knights');
assert.match(garrisons,/drawSoldierFigure\(d\.p,d\.z,'knight',d\.id,d\.phase\)/,'training field: dismounted knights');
assert.doesNotMatch(events,/'swordsman'/,'no generic swordsman left in the tournament');
// Man-at-arms (variant F): gonnello with the arms; helmet from the knights' set and two-handed
// weapon, both random per man and stable.
assert.match(figures,/const KNIGHT_HELMETS=Object\.freeze\(\['greathelm','barbuta','kettle','nasal','cap'\]\)/,"knights' helmets");
assert.match(figures,/const MAN_AT_ARMS_WEAPONS=Object\.freeze\(\['halberd','twoHandAxe','twoHandHammer','greatsword'\]\)/,'two-handed weapons');
{
  const kitSrc=figures.match(/const KNIGHT_HELMETS[\s\S]*?\nfunction manAtArmsKit[\s\S]*?\n\}/)[0].replace(/const MAA_STEEL[^\n]*\n/,'');
  const peasantHash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  const box={peasantHash,State:{policies:{}}};vm.createContext(box);vm.runInContext(kitSrc+';this.kit=manAtArmsKit;',box);
  const count={};
  for(let i=0;i<2000;i++){const k=box.kit('res-'+i);count[k.helmet]=(count[k.helmet]||0)+1;count[k.weapon]=(count[k.weapon]||0)+1}
  for(const h of ['greathelm','barbuta','kettle','nasal','cap'])assert.ok(count[h]>300,'helmet '+h+' is drawn often enough');
  for(const w of ['halberd','twoHandAxe','twoHandHammer','greatsword'])assert.ok(count[w]>380,'weapon '+w+' is drawn often enough');
  assert.equal(JSON.stringify(box.kit('res-7')),JSON.stringify(box.kit('res-7')),'stable per man');
  box.State.policies={manAtArms:{helmet:'nasal',weapon:'halberd'}};
  assert.equal(JSON.stringify(box.kit('res-7')),JSON.stringify({helmet:'nasal',weapon:'halberd'}),'the Lab can pin helmet and weapon');
}
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
console.log('PASS combat figure roles: L1 levy infantry, L2 levy archers, L3 men-at-arms, L4 knights; guards, pikemen, herald distinct');
