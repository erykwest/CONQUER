async page=>{
 await page.setViewportSize({width:1600,height:1100});
 const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
 const cases=[
 {name:'01-foresta-due',seed:9,biome:'forest',expected:2},
 {name:'02-pianura-tre',seed:12345,biome:'plains',expected:3},
 {name:'03-palude-tre',seed:1,biome:'swamp',expected:3},
 {name:'04-fiume-pianura',seed:12345,biome:'plains',expected:3,river:true},
 {name:'05-fiume-foresta',seed:9,biome:'forest',expected:2,river:true}];
 const results=[];
 for(const c of cases){
  await page.goto('http://127.0.0.1:4193/index.html?demo=mouth-sea&seed='+c.seed);
  await page.waitForFunction(()=>typeof forestTreeSpritesReady!=='undefined'&&forestTreeSpritesReady&&State.environment.length);
  results.push(await page.evaluate(({c,dirs})=>{
   window.__CONQUER_REGIONAL_DEMO__={hasRiver:!!c.river,riverSides:["north","east"],riverFlow:c.river?{x:0,y:1,source:"regional-water-outlet"}:undefined,surroundingBiomes:Object.fromEntries(dirs.map(d=>[d,c.biome]))};
   State.seed=c.seed;State.biome=c.biome;State.structures=[];State.environment=[];State.relief=null;
   generateRelief();generateEnvironment();State.daylightOverride="day";State.weatherOverride="sun";State.view.scale=1;
   const corners=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}].map(p=>w2s(p));
   const width=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));
   State.view.scale=Math.min(1050/width,780/height);const focus=w2s({x:100,y:100});State.view.x+=675-focus.x;State.view.y+=480-focus.y;
   renderUI();invalidateSceneCache();draw();
   return{name:c.name,seed:c.seed,streams:State.environment.filter(f=>f.type==='stream').length,planned:biomeStreamCount(),confluences:State.environment.filter(f=>f.confluence).length,primary:State.environment.find(f=>f.drainagePrimary)?.type,flow:State.environment.find(f=>f.drainagePrimary)?.flow,valid:State.environment.filter(f=>f.confluence).every(f=>f.confluence.downstreamId===State.environment.find(g=>g.drainagePrimary)?.id)};
  },{c,dirs}));
  if(c.expected!==null?results.at(-1).streams!==c.expected:results.at(-1).streams<2||results.at(-1).streams>3)throw Error(JSON.stringify(results.at(-1)));
  if(!results.at(-1).valid||c.river&&results.at(-1).primary!=="river")throw Error("Invalid hierarchy");
  await page.evaluate(async()=>{for(let i=0;i<3;i++){draw();drawWeatherOverlay();await new Promise(requestAnimationFrame)}});
  await page.screenshot({path:'output/playwright/streams-30-'+c.name+'.png'});
 }
 return results;
}