async page=>{
 await page.setViewportSize({width:1600,height:1100});
 const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
 const cases=[
 {name:'01-isola-4242',seed:4242,biome:'plains',sides:['north','east','south','west']},
 {name:'02-isola-229',seed:229,biome:'plains',sides:['north','east','south','west']},
 {name:'03-isola-lago-777',seed:777,biome:'hills',water:'lake',sides:['north','east','south','west']},
 {name:'04-penisola-ovest',seed:4242,biome:'plains',sides:['north','east','south']},
 {name:'05-penisola-sud',seed:90210,biome:'forest',sides:['north','east','west']}];
 const results=[];
 for(const c of cases){
  await page.goto('http://127.0.0.1:4193/index.html?demo=mouth-sea&seed='+c.seed);
  await page.waitForFunction(()=>typeof forestTreeSpritesReady!=='undefined'&&forestTreeSpritesReady&&State.environment.length);
  results.push(await page.evaluate(({c,dirs})=>{
   const neighbors=Object.fromEntries(dirs.map(d=>[d,c.biome]));for(const side of c.sides)neighbors[side]=c.water||'sea';
   for(const [d,a,b] of [['northEast','north','east'],['southEast','south','east'],['southWest','south','west'],['northWest','north','west']])if(c.sides.includes(a)&&c.sides.includes(b))neighbors[d]=c.water||'sea';
   window.__CONQUER_REGIONAL_DEMO__={surroundingBiomes:neighbors};
   State.seed=c.seed;State.biome=c.biome;State.structures=[];State.environment=[];State.relief=null;
   generateRelief();generateEnvironment();State.daylightOverride="day";State.weatherOverride="sun";State.view.scale=1;
   const corners=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}].map(p=>w2s(p));
   const width=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));
   State.view.scale=c.closeup?.9:Math.min(1050/width,780/height);const focus=w2s(c.closeup?State.environment.find(f=>f.waterBodyKind==='marsh'):{x:100,y:100});State.view.x+=675-focus.x;State.view.y+=480-focus.y;
   renderUI();invalidateSceneCache();draw();
   const shore=State.environment.filter(f=>f.type==='sea'||f.waterBodyKind==='lake').flatMap(f=>[f.points,...(f.holes||[])]).flat().filter(p=>p.x>1&&p.y>1&&p.x<199&&p.y<199);
   return{name:c.name,seed:c.seed,kind:window.ConquerRegionalLandscape.coastShape().kind,streams:State.environment.filter(f=>f.type==='stream').length,hills:State.relief.hills.length,shoreGaps:State.relief.hills.map(h=>Math.min(...reliefHillFootprint(h).flatMap(p=>shore.map(q=>dist(p,q))))),coverage:State.relief.stats.coverage,sea:State.environment.filter(f=>f.type==='sea'||f.waterBodyKind==='lake').length};
  },{c,dirs}));
  if(results.at(-1).streams)throw Error('Unexpected coastal stream');
  if(!results.at(-1).sea)throw Error('Missing sea');
  await page.evaluate(async()=>{for(let i=0;i<3;i++){draw();drawWeatherOverlay();await new Promise(requestAnimationFrame)}});
  await page.screenshot({path:'output/playwright/coastal-shores-'+c.name+'.png'});
 }
 return results;
}