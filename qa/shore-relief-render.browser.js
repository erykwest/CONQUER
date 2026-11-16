async page=>{
 await page.goto('http://127.0.0.1:4201/index.html?demo=mouth-sea&seed=4242');
 await page.waitForFunction(()=>window.ConquerWorld3D&&State.environment.length);
 return await page.evaluate(()=>{
  State.seed=987654;State.biome='plains';State.season='summer';State.structures=[];
  State.relief={seed:987654,hills:[{id:'shore-hill',levels:[{id:'shore-level',z0:0,z1:8,steepBase:2,top:[{x:60,y:140},{x:100,y:140},{x:100,y:147},{x:60,y:147}],edgeKinds:['steep','steep','steep','steep']}]}]};clearReliefBandCache();
  const band=reliefEdgeBands(reliefLevels()[0])[2],cliff=slopePoint(band,.5,.5),beach={x:25,y:148};
  if(terrainSlopeKind(cliff)!=='steep')throw Error('Fixture misses cliff');
  const pixel=(canvas,p)=>[...canvas.getContext('2d').getImageData(Math.floor(p.x/200*canvas.width),Math.floor(p.y/200*canvas.height),1,1).data];
  const results=[];
  for(const type of ['sea','pond']){
   State.environment=[{id:'water',type,waterBodyKind:'lake',side:'south',coastline:[{x:0,y:150},{x:200,y:150}],points:[{x:0,y:150},{x:200,y:150},{x:200,y:200},{x:0,y:200}],fill:'#608c92',edge:'#abc'}];
   const painted=window.ConquerWorld3D._debugBake(0,0,200),keepCoast=window.ConquerCoast,keepBanks=lakeShoreBands;let control;
   try{window.ConquerCoast={...keepCoast,drawGround:()=>{}};lakeShoreBands=()=>[];control=window.ConquerWorld3D._debugBake(0,0,200)}finally{window.ConquerCoast=keepCoast;lakeShoreBands=keepBanks}
   const c=pixel(painted,cliff),cc=pixel(control,cliff),b=pixel(painted,beach),bc=pixel(control,beach);
   if(JSON.stringify(c)!==JSON.stringify(cc))throw Error('Shore changes the real cliff texture '+JSON.stringify({type,c,cc}));
   if(JSON.stringify(b)===JSON.stringify(bc))throw Error('Flat beach disappeared '+type);
   results.push({type,cliff:c,withoutShore:cc,beach:b,flatWithoutShore:bc});
  }
  return {world3dSupported:window.ConquerWorld3D.supported(),results};
 });
}
