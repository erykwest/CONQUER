async page=>{
 await page.setViewportSize({width:1600,height:1100});
 const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
 const cases=[
 {name:'01-palude',seed:1,biome:'swamp'},
 {name:'02-palude',seed:4242,biome:'swamp',closeup:true},
 {name:'03-centro-palude',seed:229,biome:'swamp',surrounding:'plains'},
 {name:'04-palude-ereditata',seed:777,biome:'plains',surrounding:'swamp'},
 {name:'05-palude-lago',seed:90210,biome:'swamp',surrounding:'lake'}];
 const results=[];
 for(const c of cases){
  await page.goto('http://127.0.0.1:4193/index.html?demo=mouth-sea&seed='+c.seed);
  await page.waitForFunction(()=>typeof forestTreeSpritesReady!=='undefined'&&forestTreeSpritesReady&&State.environment.length);
  results.push(await page.evaluate(({c,dirs})=>{
   window.__CONQUER_REGIONAL_DEMO__=c.surrounding?{surroundingBiomes:Object.fromEntries(dirs.map(d=>[d,c.surrounding]))}:{};
   State.seed=c.seed;State.biome=c.biome;State.structures=[];State.environment=[];State.relief=null;
   generateRelief();generateEnvironment();State.daylightOverride="day";State.weatherOverride="sun";State.view.scale=1;
   const corners=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}].map(p=>w2s(p));
   const width=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));
   State.view.scale=c.closeup?.9:Math.min(1050/width,780/height);const m=State.environment.find(f=>f.waterBodyKind==='marsh');const focus=w2s(c.closeup?m.points[0]:{x:100,y:100});State.view.x+=675-focus.x;State.view.y+=480-focus.y;
   renderUI();invalidateSceneCache();draw();
   return{name:c.name,seed:c.seed,marshes:State.environment.filter(f=>f.waterBodyKind==='marsh').length,reeds:window.ConquerScatter?.layout().filter(p=>p.ctx==='marshbank'&&p.asset.startsWith('reed')).length};
  },{c,dirs}));
  if(!results.at(-1).marshes)throw Error('Missing marsh: '+JSON.stringify(results.at(-1)));
  await page.evaluate(async()=>{for(let i=0;i<3;i++){draw();drawWeatherOverlay();await new Promise(requestAnimationFrame)}});
  await page.screenshot({path:'output/playwright/marsh-reeds4-'+c.name+'.png'});
 }
 return results;
}
