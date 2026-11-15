async page=>{
 await page.setViewportSize({width:1600,height:1100});
 const cases=[{name:'01-hills-1',seed:1},{name:'02-hills-4',seed:4},{name:'03-hills-10',seed:10},{name:'04-fiume-regionale',seed:229,hasRiver:true,riverSides:['east']},{name:'05-bordo-montuoso',seed:1,mountainSides:['north']}],results=[];
 for(const c of cases){
  const payload={version:1,terrain:'hills',biome:'hills',seed:c.seed,name:c.name,...c,surroundings:Object.fromEntries(['north','northEast','east','southEast','south','southWest','west','northWest'].map(d=>[d,{terrain:'hills'}]))};
  await page.goto('http://127.0.0.1:4193/index.html?regionalDemo=hill-check&regionalData='+encodeURIComponent(JSON.stringify(payload)));
  await page.waitForFunction(()=>typeof forestTreeSpritesReady!=='undefined'&&forestTreeSpritesReady&&State.environment.length);
  const m=await page.evaluate(()=>{
   State.daylightOverride='day';State.weatherOverride='sun';State.view.scale=1;
   const corners=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}].map(w2s),width=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));
   State.view.scale=Math.min(1050/width,780/height);const f=w2s({x:100,y:100});State.view.x+=675-f.x;State.view.y+=480-f.y;renderUI();invalidateSceneCache();draw();
   let woods=0;for(let y=1;y<200;y+=2)for(let x=1;x<200;x+=2)if(State.environment.some(f=>f.type==='forest'&&environmentContains(f,{x,y})))woods++;
   return{biome:State.biome,hills:State.relief.hills.length,coverage:estimateReliefCoverage(80),woods:woods/10000,streams:State.environment.filter(f=>f.type==='stream').length,rivers:State.environment.filter(f=>f.type==='river').length,mountains:State.environment.filter(f=>f.type==='mountain').length};
  });
  if(m.biome!=='hills'||m.hills<4||m.hills>8||m.coverage<.30||m.woods<.20||m.woods>.30||m.streams<1||m.streams>3)throw Error(JSON.stringify({c,m}));
  await page.evaluate(async()=>{for(let i=0;i<3;i++){draw();drawWeatherOverlay();await new Promise(requestAnimationFrame)}});
  await page.screenshot({path:'output/playwright/hills-regional-'+c.name+'.png'});results.push({name:c.name,...m});
 }
 return results;
}
