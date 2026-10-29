import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173';
const output='artifacts/panels-preview';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1600,height:1040},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',err=>errors.push(String(err.stack||err)));
try{
  const response=await page.goto(base+'/index.html?assetlab=1&renderer=canvas2d',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>!!window.ConquerPanels&&!!window.ConquerGame?.read&&!!window.ConquerEconomy?.snapshot,{timeout:90000});
  await page.evaluate(()=>{
    // Visual-only fixture. The real game and real panels render it, but these values
    // are demonstrative: never persist them or mistake them for a player's save.
    State.clock.speed=0;
    State.village.founded=true;
    State.village.name='Borgo delle Querce — DEMO';
    const history=Array.from({length:14},(_,i)=>{
      const wood=+(3.8+(Math.sin(i*.6)+1)*1.1).toFixed(2);
      return {
        day:5+i*7,
        population:{L1:48+i*2,L2:19+i,L3:12+i,L4:5},
        welfare:Math.round(47+i*1.65+Math.sin(i)*2.2),
        happiness:{L1:44+i*1.6,L2:50+i*1.1,L3:55+i*.65,L4:71-i*.2},
        prices:{food:2.2+i*.07+Math.sin(i*.7)*.3,wood,stone:4.3+i*.04,clay:3.1,metal:7.8+i*.1,equipment:16+i*.3,luxury:21},
        jobs:{building:3+i%3,herding:3+i%2,logging:4+i%3,industry:5+i%4,idle:2+i%3},
        production:[
          {id:'farm-1',type:'field',owner:'lord',goods:{food:24+i*2}},
          {id:'forest-1',type:'loggingCamp',owner:i<7?'lord':'private',goods:{wood:8+i%4}},
          {id:'quarry-1',type:'quarry',owner:'lord',goods:{stone:5+i%3}},
          {id:'workshop-1',type:'workshop',owner:'lord',goods:{equipment:2+i%3}}
        ]
      };
    });
    const economic={
      population:history[13].population,welfare:history[13].welfare,castleGold:486,capital:212,
      rationMode:'half',jobs:{building:4,herding:3,logging:4,industry:5,idle:2,foodRisk:false},
      goods:[
        {id:'food',price:3.1,market:210,castle:185,share:25,reserve:260},
        {id:'wood',price:4.5,market:66,castle:84,share:50,reserve:120},
        {id:'stone',price:4.9,market:24,castle:70,share:25,reserve:90},
        {id:'clay',price:3.1,market:10,castle:25,share:50,reserve:40},
        {id:'metal',price:8.7,market:18,castle:32,share:25,reserve:55},
        {id:'equipment',price:18.3,market:8,castle:16,share:0,reserve:35},
        {id:'luxury',price:21,market:12,castle:6,share:100,reserve:15}
      ],
      activities:[
        {id:'farm-1',type:'field',owner:'lord',workers:4,value:100,profit:18},
        {id:'forest-1',type:'loggingCamp',owner:'private',workers:3,value:90,profit:11},
        {id:'quarry-1',type:'quarry',owner:'lord',workers:2,value:140,profit:20},
        {id:'workshop-1',type:'workshop',owner:'lord',workers:2,value:210,profit:35}
      ]
    };
    const lastBalance={day:96,goods:{
      food:{produced:48,demand:43,unmetSupply:0},
      wood:{produced:12,demand:9,unmetSupply:0},
      stone:{produced:9,demand:7},clay:{produced:2,demand:0},
      metal:{produced:3,demand:2},equipment:{produced:4,demand:3},
      luxury:{produced:1,demand:2}
    }};
    const balanceHistory=history.slice(-8).map((w,i)=>({day:w.day,goods:{
      food:{produced:35+i*2,demand:40+i*.5}
    }}));
    const realGame=window.ConquerGame;
    const realRead=realGame.read;
    window.ConquerGame={...realGame,read:{...realRead,
      economy:()=>economic,
      policies:()=>({tax:28,levy:15,rations:'half'}),
      logistics:()=>({stores:[
        {id:'food',stock:130,cap:200},{id:'materials',stock:95,cap:180},
        {id:'equipment',stock:28,cap:60},{id:'horses',stock:8,cap:20},
        {id:'gold',stock:110,cap:300}
      ],autonomy:23,daily:5.7,shortfall:0,soldiers:24}),
      defense:()=>({active:true,units:16,patrols:5,hostiles:0,alarm:'off'}),
      knights:()=>({current:5,limit:8})
    }};
    const realEconomy=window.ConquerEconomy;
    window.ConquerEconomy={...realEconomy,
      state:()=>({...realEconomy.state(),happiness:history[13].happiness,panelHistory:history,balanceHistory}),
      snapshot:()=>({...realEconomy.snapshot(),balance:lastBalance,weeks:14,castleGold:486,constructionPayroll:42,panelHistory:history})
    };
    const profile=document.getElementById('profileBtn');
    profile.click();
    document.querySelector('[data-profile-tab="control"]').click();
    const tag=document.createElement('span');
    tag.textContent='ANTEPRIMA · DATI DIMOSTRATIVI';
    tag.className='cp-demo-tag';
    document.querySelector('.profile-titlebar').insertBefore(tag,document.getElementById('profileClose'));
    const note=document.createElement('style');
    note.textContent='.cp-demo-tag{font:700 11px Arial,sans-serif;color:#ffe6a6;border:1px solid #9f7f41;border-radius:7px;padding:8px 10px;margin-left:auto;margin-right:12px;background:#48331d}.profile-overlay{background:rgba(9,7,5,.85)}';
    document.head.appendChild(note);
  });
  await page.waitForFunction(()=>document.getElementById('profileControl')?.hidden===false);
  const requested=['general','people','economy','estate','stores','military'];
  for(const id of requested){
    await page.locator('[data-cp-tab="'+id+'"]').click();
    await page.waitForFunction(id=>document.querySelector('[data-cp-tab="'+id+'"]')?.classList.contains('active'),id);
    const body=await page.locator('#controlBody').innerHTML();
    assert.ok(body.length>600,'panel '+id+' unexpectedly empty');
    if(['general','people','economy','estate'].includes(id))
      assert.ok(body.includes('<svg'),'panel '+id+' missing graphs');
    await page.locator('.profile-window').evaluate(node=>node.scrollTop=0);
    await page.locator('.profile-window').screenshot({path:output+'/'+id+'.png'});
  }
  fs.writeFileSync(output+'/report.json',JSON.stringify({
    result:'PASS',kind:'actual-game-UI-with-demo-data',tabs:requested,errors,source:'branch panels',note:'Data are synthetic visual fixtures, not a saved gameplay state.'
  },null,2));
  console.log('PASS real CONQUER UI screenshots: '+requested.join(', '));
}finally{
  await browser.close();
}
