'use strict';
// Civil class migration v2. Classes are immutable identities, not advancement
// levels. The house prestige template is rebuilt when a legacy class is remapped.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ConquerSocialClasses=api;
})(typeof window!=='undefined'?window:null,function(){
  const VERSION=2;
  const TIERS=Object.freeze({
    1:Object.freeze({name:'Servi',role:'labor',canEmigrate:false}),
    2:Object.freeze({name:'Artigiani',role:'craft',canEmigrate:true}),
    3:Object.freeze({name:'Istruiti',role:'civic-trade',canEmigrate:true}),
    4:Object.freeze({name:'Nobiltà',role:'property',canEmigrate:false})
  });
  const LEGACY=Object.freeze({1:1,2:1,3:2,4:3});
  const densityOfOld=Object.freeze({1:1,2:2,3:2,4:3});
  const normalized=(n,min=1,max=4)=>Math.max(min,Math.min(max,Math.floor(Number(n)||min)));
  const finite=(n,otherwise=0)=>typeof n==='number'&&Number.isFinite(n)?n:otherwise;
  function tierOfHouse(h){
    return normalized(h?.socialTier??h?.houseLevel);
  }
  function capacity(h){
    const count=Number(h?.householdResidents);
    if(Number.isSafeInteger(count)&&count>=0&&count<=120)return count;
    // New houses retain the existing 3*prestige capacity until D1-D3 becomes active.
    return normalized(h?.houseLevel)*3;
  }
  function adultWorkers(h){
    return Math.floor(capacity(h)/3);
  }
  function householdHeadIds(h){
    const generation=Math.max(0,Math.floor(Number(h.householdGeneration)||0));
    const prefix=generation?String(h.id)+':g'+generation:String(h.id);
    return Array.from({length:adultWorkers(h)},(_,i)=>
      prefix+':m:'+i);
  }
  // Educated occupations are immutable household roles, not advancement.
  // A venue must exist for civic roles; otherwise use the market role.
  function educatedProfession(h,structures=[]){
    if(tierOfHouse(h)!==3)return null;
    const civic=structures.some(s=>s?.type==='townhall'&&!s.destroyed),
      market=structures.some(s=>s?.type==='market'&&!s.destroyed);
    const roles=civic?['scribe','magistrate','administrator',...(market?['merchant']:[])]:['merchant'];
    let hash=2166136261;
    for(const ch of String(h?.id||'')){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}
    return roles[(hash>>>0)%roles.length];
  }
  function moveLegacyJobs(e){
    const a=e.l1Jobs,b=e.l2Jobs;
    if(!b||typeof b!=='object')return;
    const first=a&&typeof a==='object'?a:{enabled:false,order:[],settings:{}};
    const settings={...(first.settings||{}),...(b.settings||{})};
    const order=[...(Array.isArray(first.order)?first.order:[]),
      ...(Array.isArray(b.order)?b.order:[])];
    e.l1Jobs={enabled:!!first.enabled||!!b.enabled,
      order:[...new Set(order)],settings};
    e.l2Jobs={enabled:false,order:[],settings:{}};
  }
  function migrateSave(structures, economy, {alreadyV2=false}={}){
    if(!Array.isArray(structures))throw new TypeError('structures array required');
    if(alreadyV2||economy?.socialSchemaVersion===VERSION)
      return {structures,economy,changed:false,version:VERSION};
    // Clone only records being transformed. The caller owns State and persistence.
    const population={1:0,2:0,3:0,4:0};
    const migrated=structures.map(s=>{
      if(s?.type!=='house')return s;
      const old=normalized(s.houseLevel),tier=LEGACY[old];
      const residents=old*3;population[old]+=residents;
      return {...s,houseLevel:tier,socialTier:tier,
        densityLevel:densityOfOld[old],householdResidents:residents,
        socialSchemaVersion:VERSION,legacyLivestockTier:old};
    });
    if(!economy||typeof economy!=='object')return{
      structures:migrated,economy,changed:true,version:VERSION};
    const e={...economy},oldWallet=e.wallet||{},oldHappy=e.happiness||{};
    const oldL4=finite(oldWallet.L4);
    // 25% of former L4 liquid wealth follows the newly classified bourgeois
    // households; 75% remains in the L4 property portfolio. Never mint coins.
    const bourgeois=Math.round(oldL4*.25*1000)/1000;
    const wallet={...oldWallet,
      L1:finite(oldWallet.L1)+finite(oldWallet.L2),
      L2:finite(oldWallet.L3),
      L3:bourgeois,L4:oldL4-bourgeois};
    const weighted=(a,b,na,nb)=>{
      const total=na+nb;
      return total? (finite(a,50)*na+finite(b,50)*nb)/total:50;
    };
    const happiness={...oldHappy,
      L1:weighted(oldHappy.L1,oldHappy.L2,population[1],population[2]),
      L2:finite(oldHappy.L3,50),L3:finite(oldHappy.L4,50),L4:50};
    const oldWage=e.wage||{};
    e.wallet=wallet;e.happiness=happiness;
    e.loyaltyL4=50;
    e.wage={...oldWage,L1:finite(oldWage.L1,1),
      L2:finite(oldWage.L3,3),L3:finite(oldWage.L3,3)};
    if(e.commerce&&typeof e.commerce==='object'){
      e.commerce={...e.commerce,
        shops:Object.fromEntries(Object.entries(e.commerce.shops||{}).map(([id,shop])=>[
          id,{...shop,ownerTier:2}
        ])),
        services:Object.fromEntries(Object.entries(e.commerce.services||{}).map(([id,svc])=>[
          id,{...svc,operatorHouseId:null}
        ])),
        journeys:Object.fromEntries(Object.entries(e.commerce.journeys||{}).map(([id,j])=>[
          id,{...j,...(j.source==='resident'?{tier:3,role:'L3'}:{})}
        ]))
      };
    }
    moveLegacyJobs(e);
    e.socialSchemaVersion=VERSION;
    return {structures:migrated,economy:e,changed:true,version:VERSION};
  }
  return Object.freeze({VERSION,TIERS,LEGACY,tierOfHouse,capacity,
    adultWorkers,householdHeadIds,educatedProfession,migrateSave});
});
