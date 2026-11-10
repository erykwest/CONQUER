async page=>{
 await page.setViewportSize({width:1440,height:950});
 for(const preset of ['mouth-sea','mouth-lake','river-confluence','stream-confluence','mixed-confluence']){
  await page.goto('http://127.0.0.1:4193/index.html?demo='+preset+'&seed=4242');
  await page.waitForFunction(()=>window.ConquerHydrology&&State.environment.length);
  const actual=await page.evaluate(()=>({delta:State.environment.filter(f=>f.delta).length,mouths:State.environment.filter(f=>f.mouth).map(f=>f.mouth.kind),confluences:State.environment.filter(f=>f.confluence).map(f=>f.type),biomes:[...document.querySelector('#biomeSelect').options].filter(o=>!o.hidden).map(o=>o.value),panel:!!document.getElementById('naturalDemoPanel')}));
  if(actual.panel)throw Error('Unwanted panel');
  if(preset.startsWith('mouth-')&&actual.delta<2)throw Error('Missing delta branches '+preset);
  if(preset.startsWith('mouth-')&&!actual.mouths.includes(preset==='mouth-sea'?'sea':'lake'))throw Error('Missing mouth '+preset);
  if(preset.endsWith('confluence')&&!actual.confluences.length)throw Error('Missing confluence '+preset);
  if(actual.biomes.join()!=='plains,forest,mountains,swamp')throw Error('Unexpected biome menu');
  await page.screenshot({path:'output/playwright/hydrology-'+preset+'.png'});
 }
}
