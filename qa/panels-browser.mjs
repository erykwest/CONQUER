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
      jobManager:{managed:true,available:22,tasks:[
        {key:'site:forest-1',kind:'site',id:'forest-1',label:'Taglialegna · forest-1',workers:3,capacity:3,demand:3,minimum:1,auto:true},
        {key:'carter',kind:'carter',label:'Carrettieri',workers:1,capacity:2,demand:2,minimum:0,auto:true},
        {key:'builders',kind:'builders',label:'Costruttori',workers:4,capacity:6,demand:6,minimum:2,auto:true}
      ]},
      jobManagerL2:{managed:true,available:10,assigned:6,tasks:[
        {key:'site:farm-1',kind:'site',id:'farm-1',label:'Campi · farm-1',workers:4,capacity:4,demand:4,minimum:2,auto:true},
        {key:'site:quarry-1',kind:'site',id:'quarry-1',label:'Cava · quarry-1',workers:2,capacity:2,demand:2,minimum:1,auto:true}
      ]},
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
    const military={
      patrols:[{id:'patrol-1',active:true,position:'perimetro White Zone'}],
      towers:[{id:'tower-1',label:'Torre · tower-1',assigned:2,active:2,capacity:4}],
      barracks:[{id:'room-1',label:'Caserma · room-1',assigned:1,capacity:3}],
      unassigned:0,hasCampManagement:true
    };
    const realGame=window.ConquerGame;
    const realRead=realGame.read;
    const jobCommands={
      setL1Minimum:(key,n)=>{const task=economic.jobManager.tasks.find(t=>t.key===key);if(!task)return false;task.minimum=n;return true;},
      setL1Auto:(key,enabled)=>{const task=economic.jobManager.tasks.find(t=>t.key===key);if(!task)return false;task.auto=enabled;return true;},
      setL2Minimum:(key,n)=>{const t=economic.jobManagerL2.tasks.find(t=>t.key===key);if(!t)return false;t.minimum=n;return true;},
      setL2Auto:(key,enabled)=>{const t=economic.jobManagerL2.tasks.find(t=>t.key===key);if(!t)return false;t.auto=enabled;return true;},
      setL2Order:order=>{
        const byKey=new Map(economic.jobManagerL2.tasks.map(t=>[t.key,t]));
        if(order.some(key=>!byKey.has(key))||order.length!==byKey.size)return false;
        economic.jobManagerL2.tasks=order.map(key=>byKey.get(key));return true;
      },
      adjustPatrols:delta=>{
        if(delta>0)military.patrols.push({id:'patrol-'+(military.patrols.length+1),active:true,position:'perimetro White Zone'});
        else military.patrols.pop();return true;
      },
      adjustTowerArchers:(id,delta)=>{
        const t=military.towers.find(t=>t.id===id);if(!t)return false;
        t.assigned=Math.max(0,Math.min(t.capacity,t.assigned+delta));t.active=t.assigned;return true;
      },
      adjustBarracksSquads:(id,delta)=>{
        const b=military.barracks.find(b=>b.id===id);if(!b)return false;
        b.assigned=Math.max(0,Math.min(b.capacity,b.assigned+delta));return true;
      },
      setL1Order:order=>{
        const byKey=new Map(economic.jobManager.tasks.map(t=>[t.key,t]));
        if(order.some(key=>!byKey.has(key))||order.length!==byKey.size)return false;
        economic.jobManager.tasks=order.map(key=>byKey.get(key));return true;
      }
    };
    window.ConquerGame={...realGame,commands:{...realGame.commands,...jobCommands},read:{...realRead,
      economy:()=>economic,
      policies:()=>({tax:28,levy:15,rations:'half'}),
      logistics:()=>({stores:[
        {id:'food',stock:130,cap:200},{id:'materials',stock:95,cap:180},
        {id:'equipment',stock:28,cap:60},{id:'horses',stock:8,cap:20},
        {id:'gold',stock:110,cap:300}
      ],autonomy:23,daily:5.7,shortfall:0,soldiers:24}),
      defense:()=>({active:true,units:16,patrols:5,hostiles:0,alarm:'off'}),
      knights:()=>({current:5,limit:8}),
      militaryAssignments:()=>military
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
  // Detail captures show the rest of the scrolling panels and their controls.
  for(const id of ['people','economy','estate']){
    await page.locator('[data-cp-tab="'+id+'"]').click();
    await page.locator('.profile-window').evaluate(node=>{node.scrollTop=410;});
    await page.locator('.profile-window').screenshot({path:output+'/'+id+'-details.png'});
  }
  // Verify the actual first-level Job Manager layout and its input/drag events.
  // Commands are captured by the visual fixture above, never persisted to a save.
  await page.locator('[data-profile-tab="jobs"]').click();
  await page.waitForFunction(()=>document.getElementById('profileControl')?.hidden===false&&
    !!document.querySelector('.cp-job-queue'));
  assert.equal(await page.locator('.cp-job-row').count(),3);
  const minimum=page.locator('[data-cp-job-min="site:forest-1"]');
  await minimum.fill('2');
  await minimum.press('Tab');
  assert.equal(await page.locator('[data-cp-job-min="site:forest-1"]').inputValue(),'2');
  const auto=page.locator('[data-cp-job-auto="builders"]');
  await auto.click();
  assert.equal(await page.locator('[data-cp-job-auto="builders"]').getAttribute('aria-pressed'),'false');
  await page.locator('[data-cp-job-row="builders"]').dragTo(page.locator('[data-cp-job-row="site:forest-1"]'));
  assert.equal(await page.locator('.cp-job-row').first().getAttribute('data-cp-job-row'),'builders');
  await page.locator('.profile-window').evaluate(node=>node.scrollTop=0);
  await page.locator('.profile-window').screenshot({path:output+'/job-manager.png'});
  // L2 independently saves minimum, toggles AUTO and reorders its own tasks.
  await page.locator('[data-cp-jobs-tier="L2"]').click();
  assert.equal(await page.locator('.cp-job-row').count(),2);
  await page.locator('[data-cp-job-min="site:farm-1"]').fill('3');
  await page.locator('[data-cp-job-min="site:farm-1"]').press('Tab');
  assert.equal(await page.locator('[data-cp-job-min="site:farm-1"]').inputValue(),'3');
  await page.locator('[data-cp-job-auto="site:quarry-1"]').click();
  assert.equal(await page.locator('[data-cp-job-auto="site:quarry-1"]').getAttribute('aria-pressed'),'false');
  await page.locator('[data-cp-job-row="site:quarry-1"]').dragTo(page.locator('[data-cp-job-row="site:farm-1"]'));
  assert.equal(await page.locator('.cp-job-row').first().getAttribute('data-cp-job-row'),'site:quarry-1');
  await page.locator('.profile-window').evaluate(node=>node.scrollTop=0);
  await page.locator('.profile-window').screenshot({path:output+'/job-manager-l2.png'});

  // The military subpalette uses the same UI wiring, with a synthetic roster.
  await page.locator('[data-profile-tab="control"]').click();
  await page.locator('[data-cp-tab="military"]').click();
  await page.locator('[data-cp-military-sub="garrisons"]').click();
  assert.ok(await page.locator('#controlBody').textContent().then(t=>t.includes('Pattuglie e guarnigioni')));
  await page.locator('[data-cp-patrol="add"]').click();
  assert.ok(await page.locator('#controlBody').textContent().then(t=>t.includes('2 pattuglie assegnate')));
  await page.locator('[data-cp-tower-id="tower-1"][data-cp-tower-delta="1"]').click();
  assert.ok(await page.locator('#controlBody').textContent().then(t=>t.includes('3 / 4 arcieri assegnati')));
  await page.locator('[data-cp-barracks-id="room-1"][data-cp-barracks-delta="1"]').click();
  assert.ok(await page.locator('#controlBody').textContent().then(t=>t.includes('2 / 3 squadre')));
  await page.locator('.profile-window').evaluate(node=>node.scrollTop=0);
  await page.locator('.profile-window').screenshot({path:output+'/patrols-garrisons.png'});

  fs.writeFileSync(output+'/report.json',JSON.stringify({
    result:'PASS',kind:'actual-game-UI-with-demo-data',tabs:requested,detailTabs:['people','economy','estate'],jobManager:{L1:{minimum:true,auto:true,drag:true},L2:{minimum:true,auto:true,drag:true}},military:{patrols:true,towers:true,barracks:true},errors,source:'branch panels',note:'Data are synthetic visual fixtures, not a saved gameplay state.'
  },null,2));
  console.log('PASS real CONQUER UI screenshots: '+requested.join(', ')+' + L1/L2 and military controls');
}finally{
  await browser.close();
}
