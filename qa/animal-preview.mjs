import fs from 'node:fs';
import {chromium} from 'playwright';
// 2D animal previews (ConquerAnimals): every species and mode on one sheet per group, at a large
// size, to judge proportions and gait. Writes output/animal-preview/<tag>-<group>.png.
// CONQUER_QA_URL (default http://127.0.0.1:4173), ANIMAL_TAG (default "now").
const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173',tag=process.env.ANIMAL_TAG||'now';
const out=process.env.ANIMAL_OUT||'output/animal-preview';fs.mkdirSync(out,{recursive:true});
// ANIMAL_ONLY=goat,cow renders just those species (one sheet named "only"); ANIMAL_SIZE (default 150).
const GROUPS=process.env.ANIMAL_ONLY?{only:process.env.ANIMAL_ONLY.split(',')}:{
  domestic:['sheep','goat','cow','horse'],
  wild:['deer','stag','wolf','boar','bear']
};
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined});
try{
  const page=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1});
  await page.goto(base+'/figures-lab.html',{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.ConquerAnimals?.drawAnimal);
  for(const [group,list] of Object.entries(GROUPS)){
    const h=await page.evaluate(([list,size])=>{
      // Columns: two walk phases, gallop/alert where the species has them, browse, still.
      const A=ConquerAnimals,colW=size*1.8,rowH=size*1.75;
      const cols=sp=>{const m=A.SPECIES[sp].modes.map(x=>x[0]);const c=[['passo 0',{t:0,mode:'walk'}],['passo ¼',{t:.156,mode:'walk'}],['passo ½',{t:.3125,mode:'walk'}]];
        // The horse gallops under knights and messengers although its own modes are walk/browse.
        if(sp==='horse')m.push('run');
        for(const mode of m)if(mode!=='walk')c.push([mode,{t:mode==='run'?.08:.3,mode,blend:mode==='browse'?.86:undefined}]);return c};
      const c=document.createElement('canvas');c.id='sheet';c.width=60+colW*6;c.height=40+rowH*list.length;
      Object.assign(c.style,{position:'fixed',left:0,top:0,zIndex:99999});document.body.appendChild(c);
      const g=c.getContext('2d');g.fillStyle='#55673f';g.fillRect(0,0,c.width,c.height);
      list.forEach((sp,r)=>cols(sp).forEach(([label,o],i)=>{
        const x=40+colW*i+colW/2,y=30+rowH*(r+1)-30;
        g.strokeStyle='rgba(0,0,0,.18)';g.beginPath();g.moveTo(x-colW/2+10,y);g.lineTo(x+colW/2-10,y);g.stroke();
        A.drawAnimal(sp,g,x,y,size/(A.SPECIES[sp].scale||1)*1.25,{...o,seed:0,facing:1});
        g.fillStyle='#f4ead6';g.font='600 14px system-ui';g.fillText(sp+' · '+label,x-colW/2+12,y+20);
      }));
      return c.height;
    },[list,Number(process.env.ANIMAL_SIZE)||150]);
    await page.screenshot({path:`${out}/${tag}-${group}.png`,clip:{x:0,y:0,width:1500,height:Math.min(1000,h)}});
    await page.evaluate(()=>document.getElementById('sheet').remove());
  }
  console.log('Animal previews written to '+out);
}finally{await browser.close()}
