'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Social=require('../src/settlement-social-classes.js');
assert.equal(Social.VERSION,2);
assert.deepEqual(Social.LEGACY,{1:1,2:1,3:2,4:3});
assert.equal(Social.TIERS[1].canEmigrate,false);
assert.equal(Social.TIERS[2].canEmigrate,true);
assert.equal(Social.TIERS[3].canEmigrate,true);
assert.equal(Social.TIERS[4].canEmigrate,false);
const houses=[1,2,3,4].map(n=>({id:'h'+n,type:'house',houseLevel:n}));
const economy={
 wallet:{L1:10,L2:20,L3:50,L4:200},
 wage:{L1:1,L2:2,L3:3},
 happiness:{L1:40,L2:60,L3:70,L4:80},
 activities:{mine:{owner:'private',type:'mine'}},
 l1Jobs:{enabled:true,order:['builders'],settings:{builders:{minimum:1}}},
 l2Jobs:{enabled:true,order:['site:mine'],settings:{'site:mine':{minimum:2}}},
 commerce:{
   shops:{h3:{kind:'blacksmith',ownerTier:3}},
   services:{tavern:{operatorHouseId:'h3'}},
   journeys:{j1:{source:'resident',tier:4,role:'L4+',chest:{gold:10,reservedGold:5}}}
 }
};
const original=JSON.stringify({houses,economy});
const r=Social.migrateSave(houses,economy);
assert.equal(r.changed,true);
assert.deepEqual(r.structures.map(h=>h.houseLevel),[1,1,2,3]);
assert.deepEqual(r.structures.map(h=>h.socialTier),[1,1,2,3]);
assert.deepEqual(r.structures.map(Social.capacity),[3,6,9,12]);
assert.deepEqual(r.structures.map(h=>h.densityLevel),[1,2,2,3]);
assert.equal(r.structures.reduce((sum,h)=>sum+Social.capacity(h),0),30);
assert.equal(r.economy.socialSchemaVersion,2);
assert.equal(r.economy.wallet.L1,30);
assert.equal(r.economy.wallet.L2,50);
assert.equal(r.economy.wallet.L3,50);
assert.equal(r.economy.wallet.L4,150);
assert.equal(Object.values(r.economy.wallet).reduce((a,b)=>a+b,0),280);
assert.equal(r.economy.commerce.shops.h3.ownerTier,2);
assert.equal(r.economy.commerce.services.tavern.operatorHouseId,null);
assert.equal(r.economy.commerce.journeys.j1.tier,3);
assert.equal(r.economy.commerce.journeys.j1.chest.reservedGold,5);
assert.deepEqual(r.economy.l1Jobs.order,['builders','site:mine']);
assert.equal(r.economy.l2Jobs.enabled,false);
assert.equal(r.economy.activities.mine.owner,'private');
assert.equal(JSON.stringify({houses,economy}),original,'migration must not mutate input');
const repeat=Social.migrateSave(r.structures,r.economy);
assert.equal(repeat.changed,false);
assert.deepEqual(repeat.structures,r.structures);
assert.equal(Social.tierOfHouse({socialTier:3,houseLevel:1}),3);
assert.equal(Social.capacity({houseLevel:1,householdResidents:6}),6);
assert.deepEqual(Social.householdHeadIds({id:'h',householdResidents:6}),['h:m:0','h:m:1']);
assert.deepEqual(Social.householdHeadIds({id:'h',householdResidents:3,householdGeneration:2}),['h:g2:m:0']);
assert.equal(Social.educatedProfession({id:'admin',socialTier:2},[]),null);
assert.ok(['scribe','magistrate','administrator','merchant'].includes(
  Social.educatedProfession({id:'admin',socialTier:3},[{type:'townhall'},{type:'market'}])));
const noEconomy=Social.migrateSave(houses,null);
assert.equal(noEconomy.structures[1].socialTier,1);
assert.equal(noEconomy.economy,null);
const source=fs.readFileSync(require.resolve('../src/settlement-social-classes.js'),'utf8');
const sandbox={window:{}};
vm.runInNewContext(source,sandbox);
assert.equal(sandbox.window.ConquerSocialClasses.VERSION,Social.VERSION);
// Integration guard: no fallback to the old L2 mine/field partition, and
// social identity is counted from the shared authority.
const econSource=fs.readFileSync(require.resolve('../src/settlement-economy.js'),'utf8');
assert.match(econSource,/field:\{good:'food',classId:1/);
assert.match(econSource,/quarry:\{good:'stone',classId:1/);
assert.match(econSource,/mine:\{good:'metal',classId:1/);
assert.match(econSource,/workshop:\{good:'equipment',classId:2/);
assert.match(econSource,/ConquerSocialClasses\?\.tierOfHouse/);
const commerceSource=fs.readFileSync(require.resolve('../src/settlement-commerce.js'),'utf8');
assert.match(commerceSource,/const l2House=id=>houseOfTier\(id,2\)/);
assert.match(commerceSource,/kind,ownerTier:2/);
assert.match(commerceSource,/tier:3,role:'L3'/);
const persistence=fs.readFileSync(require.resolve('../src/settlement-app-persistence.js'),'utf8');
assert.match(persistence,/ConquerSocialClasses\?\.migrateSave/);
assert.match(persistence,/socialSchemaVersion:2/);
console.log('PASS social class migration: census, estate wealth conservation, jobs, workshops, identities, local/cloud contracts');
