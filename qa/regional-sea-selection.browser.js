async page => {
  await page.goto('http://127.0.0.1:4193/CONQUER_WORLD_LAB.html');
  const sea=page.locator('#cellsLayer polygon[data-terrain=sea]').first();
  await sea.scrollIntoViewIfNeeded();
  const clickCell=async locator=>locator.dispatchEvent('click');
  await clickCell(sea);
  if(await page.locator('#openLocalDemo').isEnabled())throw Error('Sea selected from empty state');
  if(await page.locator('#closeCellMenu').isVisible())await page.locator('#closeCellMenu').click();
  const land=page.locator('#cellsLayer polygon[data-terrain=plain]').first();await land.scrollIntoViewIfNeeded();await clickCell(land);
  if(!await page.locator('#openLocalDemo').isEnabled())throw Error('Land selection broken');
  const before=await page.locator('#selection').innerText();
  await sea.scrollIntoViewIfNeeded();await clickCell(sea);
  if(await page.locator('#selection').innerText()!==before)throw Error('Sea replaced land selection');
  await sea.dispatchEvent('click',{shiftKey:true});
  if(await page.locator('#selection').innerText()!==before)throw Error('Sea added to multiselection');
  const lake=page.locator('#cellsLayer polygon[data-terrain=lake]').first();
  if(await lake.count()){await lake.dispatchEvent('click');await lake.dispatchEvent('click',{shiftKey:true});if(await page.locator('#selection').innerText()!==before)throw Error('Lake changed selection');}
  await page.locator('.terrain-button[data-terrain=sea]').dispatchEvent('click');
  if(await page.locator('#openLocalDemo').isEnabled())throw Error('Converted sea remains selected');
  if(await page.locator('#cellMenu').isVisible())throw Error('Converted sea menu remains open');
}
