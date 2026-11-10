async page=>{
 await page.goto('http://127.0.0.1:4193/index.html?demo=river-confluence&seed=4242');
 await page.waitForFunction(()=>typeof drawWaterLayer==='function');
 const result=await page.evaluate(()=>{
  const oldView={...State.view},oldRelief=State.relief;State.view.scale=2;State.relief={hills:[]};clearReliefBandCache();
  const dpr=window.devicePixelRatio||1,c=ctx.canvas;const focus=w2s({x:100,y:100});State.view.x+=c.width/dpr/2-focus.x;State.view.y+=c.height/dpr/2-focus.y;ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const clear=()=>{ctx.clearRect(0,0,c.width/dpr,c.height/dpr);ctx.fillStyle='#111111';ctx.fillRect(0,0,c.width/dpr,c.height/dpr)};
  const pixel=p=>[...ctx.getImageData(Math.round(p.x*dpr),Math.round(p.y*dpr),1,1).data];
  clear();
  const main={id:'pixel-main',type:'river',width:4.4,fill:'#3a7684',edge:'#e0eeee',points:[{x:65,y:100},{x:135,y:100}]};
  const branch={id:'pixel-branch',type:'stream',width:1.8,fill:'#4f8d95',edge:'#e0eeee',points:[{x:100,y:65},{x:100,y:100}]};
  drawWaterLayer([main,branch]);
  const center=w2s({x:100,y:100}),radius=(branch.width+.175)*U*State.view.scale*.72/2;
  let bright=0;for(let i=0;i<36;i++){const a=i*Math.PI/18,v=pixel({x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius});if(v[1]>170&&v[2]>170)bright++;}
  clear();const lake={id:'pixel-lake',type:'pond',waterBodyKind:'lake',fill:'#3f7f8a',edge:'#dce9df',points:[{x:80,y:80},{x:120,y:80},{x:120,y:120},{x:80,y:120}]};
  drawWaterLayer([lake]);const bank=pixel(w2s({x:78.5,y:100})),inside=pixel(w2s({x:90,y:100}));
  ctx.restore();State.view=oldView;State.relief=oldRelief;clearReliefBandCache();invalidateSceneCache();draw();
  return {bright,bank,inside};
 });
 if(result.bright)throw Error('Internal pale contour pixels: '+JSON.stringify(result));
 if(!(result.bank[0]>result.bank[1]&&result.bank[1]>result.bank[2]&&result.bank[0]>150))throw Error('Lake bank absent: '+JSON.stringify(result));
 if(!(result.inside[2]>result.inside[0]))throw Error('Lake water overwritten by bank');
}
