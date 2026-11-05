'use strict';
// One explicit contract shared by regional export and local demo startup.
(()=>{
  const terrainToBiome=Object.freeze({plain:'plains',forest:'forest',hills:'mountains',sea:'sea',swamp:'swamp',lake:'lake'});
  const biomeForTerrain=terrain=>Object.hasOwn(terrainToBiome,terrain)?terrainToBiome[terrain]:null;
  const api={biomeForTerrain};
  if(typeof window!=='undefined')window.ConquerRegionalBiomeRules=api;
  if(typeof module!=='undefined')module.exports=api;
})();
