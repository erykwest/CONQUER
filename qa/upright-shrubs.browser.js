async page=>{
 await page.setViewportSize({width:1600,height:1100});
 const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
 const cases=[
 {name:'01-sommita',seed:1,biome:'forest',closeup:true,hill:1,shrubDetail:true},
 {name:'02-pendio',seed:3,biome:'forest',closeup:true,hill:0},
 {name:'03-scarpate',seed:1,biome:'forest',closeup:true,hill:2},
 {name:'04-palude',seed:7,biome:'swamp',closeup:true,hill:0},
 {name:'05-foresta-intera',seed:3,biome:'forest'}];
 const results=[];
 for(const c of cases){
  await page.goto('http://127.0.0.1:4193/index.html?demo=mouth-sea&seed='+c.seed);
  await page.waitForFunction(()=>typeof forestTreeSpritesReady!=='undefined'&&forestTreeSpritesReady&&typeof boundaryBushSprites!=='undefined'&&boundaryBushSprites.summer.filter(Boolean).length===7&&State.environment.length);
  results.push(await page.evaluate(({c,dirs})=>{
   window.__CONQUER_REGIONAL_DEMO__=c.surrounding?{surroundingBiomes:Object.fromEntries(dirs.map(d=>[d,c.surrounding]))}:{};
   State.seed=c.seed;State.biome=c.biome;State.structures=[];State.environment=[];State.relief=null;
   generateRelief();generateEnvironment();State.daylightOverride="day";State.weatherOverride="sun";State.view.scale=1;
   const corners=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}].map(p=>w2s(p));
   const width=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));
   State.view.scale=c.shrubDetail?1.6:c.closeup?.9:Math.min(1050/width,780/height);const detail=State.environment.filter(f=>f.type==='forest').flatMap(forestShrubLayout).find(b=>b.z>.5);const focus=w2s(c.shrubDetail&&detail?detail.p:c.closeup?State.relief.hills[c.hill||0].center:{x:100,y:100});State.view.x+=675-focus.x;State.view.y+=480-focus.y;
   renderUI();invalidateSceneCache();draw();
   return{name:c.name,seed:c.seed,hills:State.relief.hills.length,heights:State.relief.hills.map(h=>h.maxHeight),shrubs:State.environment.filter(f=>f.type==='forest').flatMap(forestShrubLayout).length,elevated:State.environment.filter(f=>f.type==='forest').flatMap(forestTreeLayout).filter(t=>t.z>.1).length,sloping:State.environment.filter(f=>f.type==='forest').flatMap(forestTreeLayout).filter(t=>t.slope==='gentle').length};
  },{c,dirs}));
  if(!results.at(-1).hills)throw Error('Missing hills: '+JSON.stringify(results.at(-1)));
  await page.evaluate(async()=>{for(let i=0;i<3;i++){draw();drawWeatherOverlay();await new Promise(requestAnimationFrame)}});
  results.at(-1).drawnShrubs=await page.evaluate(()=>window.ConquerWorld3D?.active()?window.ConquerWorld3D.status().stats.forestBushes||0:window.__conquerPerf?.forestShrubs||0);
  if(!results.at(-1).drawnShrubs)throw Error('Bush sprites were not rendered');
  await page.screenshot({path:'output/playwright/upright-shrubs-'+c.name+'.png'});
 }
 return results;
}