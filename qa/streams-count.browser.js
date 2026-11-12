async page=>{
 await page.setViewportSize({width:1600,height:1100});
 const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
 const cases=[
 {name:'01-zero',seed:1,biome:'plains',expected:0},
 {name:'02-uno',seed:12,biome:'plains',expected:1},
 {name:'03-due',seed:9,biome:'forest',expected:2},
 {name:'04-tre',seed:12345,biome:'plains',expected:3},
 {name:'05-palude',seed:1,biome:'swamp',expected:3}];
 const results=[];
 for(const c of cases){
  await page.goto('http://127.0.0.1:4193/index.html?demo=mouth-sea&seed='+c.seed);
  await page.waitForFunction(()=>typeof forestTreeSpritesReady!=='undefined'&&forestTreeSpritesReady&&State.environment.length);
  results.push(await page.evaluate(({c,dirs})=>{
   window.__CONQUER_REGIONAL_DEMO__={surroundingBiomes:Object.fromEntries(dirs.map(d=>[d,c.biome]))};
   State.seed=c.seed;State.biome=c.biome;State.structures=[];State.environment=[];State.relief=null;
   generateRelief();generateEnvironment();State.daylightOverride="day";State.weatherOverride="sun";State.view.scale=1;
   const corners=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}].map(p=>w2s(p));
   const width=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));
   State.view.scale=Math.min(1050/width,780/height);const focus=w2s({x:100,y:100});State.view.x+=675-focus.x;State.view.y+=480-focus.y;
   renderUI();invalidateSceneCache();draw();
   return{name:c.name,seed:c.seed,streams:State.environment.filter(f=>f.type==='stream').length,planned:biomeStreamCount(),confluences:State.environment.filter(f=>f.confluence).length};
  },{c,dirs}));
  if(results.at(-1).streams!==c.expected)throw Error(JSON.stringify(results.at(-1)));
  await page.evaluate(async()=>{for(let i=0;i<35;i++){draw();drawWeatherOverlay();await new Promise(requestAnimationFrame)}});
  await page.screenshot({path:'output/playwright/streams-0-3-'+c.name+'.png'});
 }
 return results;
}