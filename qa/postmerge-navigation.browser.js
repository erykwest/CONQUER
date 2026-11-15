async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4199/CONQUER_WORLD_LAB.html');
 const sea=page.locator('#cellsLayer polygon[data-terrain=sea]'),land=page.locator('#cellsLayer polygon[data-terrain=hills]');
 const counts={sea:await sea.count(),hills:await land.count()};if(!counts.sea||!counts.hills)throw Error(JSON.stringify(counts));
 await sea.nth(0).dispatchEvent('click');if(await page.locator('#openLocalDemo').isEnabled())throw Error('Sea is selectable');
 await land.nth(0).dispatchEvent('click');if(!await page.locator('#openLocalDemo').isEnabled())throw Error('Hills not selectable');
 const selection=await page.locator('#selection').innerText();await sea.nth(0).dispatchEvent('click',{shiftKey:true});if(await page.locator('#selection').innerText()!==selection)throw Error('Sea altered selection');
 await page.locator('.terrain-button[data-terrain=sea]').dispatchEvent('click');if(await page.locator('#openLocalDemo').isEnabled())throw Error('Converted sea stays selectable');
 await page.locator('#cellsLayer polygon[data-terrain=hills]').nth(0).dispatchEvent('click');
 await page.locator('#openLocalDemo').click();const local=page;
 const localErrors=[];local.on('pageerror',e=>localErrors.push(e.message));await local.waitForFunction(()=>typeof State!=='undefined'&&State.environment.length);
 const actual=await local.evaluate(()=>({biome:State.biome,terrain:window.__CONQUER_REGIONAL_DEMO__.terrain,locked:document.querySelector('#biomeSelect').disabled,context:!!window.__CONQUER_REGIONAL_DEMO__.surroundings}));
 if(actual.biome!=='hills'||actual.terrain!=='hills'||!actual.context)throw Error(JSON.stringify(actual));
 await local.screenshot({path:'output/playwright/postmerge-regional-launch.png'});
 if(errors.length||localErrors.length)throw Error(JSON.stringify({errors,localErrors}));return{counts,launch:actual,waterSelection:'sea and converted sea rejected'};
}
