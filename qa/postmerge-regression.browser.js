async page=>{
 await page.setViewportSize({width:1600,height:1100});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**supabase.co/**',r=>r.abort());
 const cases=[{name:'01-pianura',biome:'plains',seed:12345},{name:'02-colline',biome:'hills',seed:4},{name:'03-foresta',biome:'forest',seed:4242},{name:'04-palude',biome:'swamp',seed:4242},{name:'05-isola',biome:'plains',seed:4242,seaSides:['north','east','south','west']},{name:'06-penisola',biome:'plains',seed:4242,seaSides:['north','south','west']},{name:'07-catena',biome:'hills',seed:229,mountainSides:['north']},{name:'08-fiume-bloccato',biome:'hills',seed:1,mountainSides:['north'],hasRiver:true,riverSides:['east']}],results=[];
 for(const c of cases){
  const dirs=['north','northEast','east','southEast','south','southWest','west','northWest'];
  const surroundings=Object.fromEntries(dirs.map(d=>[d,{terrain:c.seaSides?.includes(d)?'sea':c.biome==='plains'?'plain':c.biome}]));
  const payload={version:1,terrain:c.biome==='plains'?'plain':c.biome,...c,surroundings};
  await page.goto('http://127.0.0.1:4199/index.html?regionalDemo=postmerge&regionalData='+encodeURIComponent(JSON.stringify(payload)));
  await page.waitForFunction(()=>typeof forestTreeSpritesReady!=='undefined'&&forestTreeSpritesReady&&State.environment.length);
  const m=await page.evaluate(async()=>{
   State.daylightOverride='day';State.weatherOverride='sun';State.view.scale=1;
   const corners=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}].map(w2s),width=Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height=Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y));
   State.view.scale=Math.min(1050/width,780/height);const f=w2s({x:100,y:100});State.view.x+=675-f.x;State.view.y+=480-f.y;renderUI();invalidateSceneCache();draw();
   const before=JSON.stringify(Object.entries(localStorage));saveLocal();await saveCloud();const isolated=before===JSON.stringify(Object.entries(localStorage));
   let woods=0,marsh=0;for(let y=1;y<200;y+=2)for(let x=1;x<200;x+=2){if(State.environment.some(f=>f.type==='forest'&&environmentContains(f,{x,y})))woods++;if(State.environment.some(f=>f.waterBodyKind==='marsh'&&environmentContains(f,{x,y})))marsh++;}
   return{biome:State.biome,hills:State.relief.hills.length,coverage:estimateReliefCoverage(80),woods:woods/10000,marsh:marsh/10000,streams:State.environment.filter(f=>f.type==='stream').length,rivers:State.environment.filter(f=>f.type==='river').length,mountains:State.environment.filter(f=>f.type==='mountain').length,isolated,menu:[...document.querySelector('#biomeSelect').options].filter(o=>!o.hidden).map(o=>o.value),panel:!!document.querySelector('#naturalDemoPanel')};
  });
  if(!m.isolated||m.panel)throw Error('Persistence/menu isolation '+c.name);
  if(m.menu.join()!=='plains,hills,forest,swamp')throw Error('Wrong biome selector '+c.name);
  if(c.name==='08-fiume-bloccato'&&(m.rivers<1||m.streams<1))throw Error('Lost regional drainage');
  await page.evaluate(async()=>{for(let i=0;i<3;i++){draw();drawWeatherOverlay();await new Promise(requestAnimationFrame)}});
  await page.screenshot({path:'output/playwright/postmerge-fixed-'+c.name+'.png'});results.push({name:c.name,...m});
 }
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify(results));return results;
}
