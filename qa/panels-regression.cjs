'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/settlement-panels.js'),'utf8');

function fixture(founded=true,markets=2) {
  const elements={
    profileControl:{hidden:false,innerHTML:'',events:{},addEventListener(type,handler){this.events[type]=handler},contains(){return false}},
    profileOverlay:{hidden:false},
    controlNav:{innerHTML:''},
    controlBody:{innerHTML:''}
  };
  const document={getElementById:id=>elements[id]||null,activeElement:null};
  const calls=[];
  const economy={
    population:{L1:9,L2:3,L3:0,L4:1},welfare:54,castleGold:123,capital:20,rationMode:'market',
    jobs:{building:2,herding:1,logging:1,industry:1,idle:0,foodRisk:false},
    jobManager:{managed:true,available:4,tasks:[
      {key:'site:log',label:'Taglialegna · log',workers:1,demand:2,capacity:2,minimum:1,auto:true},
      {key:'builders',label:'Costruttori',workers:2,demand:3,capacity:3,minimum:2,auto:false}
    ]},
    jobManagerL2:{managed:true,available:2,assigned:1,tasks:[
      {key:'site:field',label:'Campi · field',workers:1,demand:1,capacity:1,minimum:1,auto:true},
      {key:'site:mine',label:'Miniera · mine',workers:0,demand:2,capacity:2,minimum:0,auto:false}
    ]},
    goods:[{id:'food',price:2,market:10,castle:40,share:50,reserve:100}],
    activities:[{id:'farm-1',type:'field',owner:'lord',workers:1,value:50,profit:null}]
  };
  const books={happiness:{L1:55,L2:45,L3:50,L4:70},
    balanceHistory:Array.from({length:markets},(_,i)=>({day:i*7+5,goods:{food:{produced:12+i,demand:14}}})),
    panelHistory:Array.from({length:markets},(_,i)=>({day:i*7+5,welfare:51+i,
      population:{L1:9,L2:3,L3:0,L4:1},happiness:{L1:54+i,L2:45+i,L3:50,L4:70},
      prices:{food:2+i*.1,wood:3+i*.2},jobs:{building:2,herding:1,logging:1,industry:1,idle:0},
      production:[{id:'farm-1',type:'field',owner:'lord',goods:{food:12+i}}]}))};
  const commands={
    setPolicy:(...args)=>calls.push(['policy',...args]),
    setSaleShare:(...args)=>calls.push(['share',...args]),
    setL1Minimum:(...args)=>calls.push(['jobMinimum',...args]),
    setL1Auto:(...args)=>calls.push(['jobAuto',...args]),
    setL1Order:(...args)=>calls.push(['jobOrder',...args]),
    setL2Minimum:(...args)=>calls.push(['l2Minimum',...args]),
    setL2Auto:(...args)=>calls.push(['l2Auto',...args]),
    setL2Order:(...args)=>calls.push(['l2Order',...args]),
    adjustPatrols:(...args)=>calls.push(['patrol',...args]),
    adjustTowerArchers:(...args)=>calls.push(['tower',...args]),
    adjustBarracksSquads:(...args)=>calls.push(['barracks',...args]),
    transferActivity:(...args)=>calls.push(['transfer',...args]),
    openCaravans:()=>calls.push(['caravans'])
  };
  const context={
    window:{
      ConquerGame:{read:{economy:()=>economy,policies:()=>({tax:25,levy:10,rations:'market'}),
        logistics:()=>({stores:[{id:'food',stock:12,cap:30}],autonomy:3,daily:4,soldiers:8,shortfall:0}),
        defense:()=>({active:true,units:4,patrols:2,hostiles:0,alarm:'off'}),
        knights:()=>({current:1,limit:2}),
        militaryAssignments:()=>({patrols:[{id:'patrol-1',active:true,position:'perimetro White Zone'}],
          towers:[{id:'tower-1',label:'Torre · tower-1',capacity:3,assigned:1,active:1}],
          barracks:[{id:'room-1',label:'Caserma · room-1',capacity:3,assigned:1}],
          hasCampManagement:true,unassigned:0})},commands},
      ConquerEconomy:{state:()=>books,snapshot:()=>({weeks:markets,constructionPayroll:5})},
      ConquerDiplomacy:{state:()=>({caravans:[],incoming:null,history:[]})}
    },
    State:{village:{founded},structures:[]},
    document,
    setInterval:()=>null
  };
  vm.runInNewContext(source,context,{filename:'settlement-panels.js'});
  return {elements,context,calls,
    tab:id=>elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-tab]'?{dataset:{cpTab:id}}:null}})};
}

const x=fixture();
assert.equal(x.context.window.ConquerPanels.tabs.length,9);
x.context.window.ConquerPanels.open();
assert.match(x.elements.controlBody.innerHTML,/Popolazione/);
// Two main Profile palettes use live views and retain the existing sale-share command.
x.context.window.ConquerPanels.open('jobs');
assert.match(x.elements.controlBody.innerHTML,/Distribuzione delle mansioni L1/);
assert.match(x.elements.controlBody.innerHTML,/Posti nelle attività/);
assert.equal(x.elements.controlNav.hidden,true);
x.context.window.ConquerPanels.open('trade');
assert.match(x.elements.controlBody.innerHTML,/Scambi e quote di vendita/);
assert.match(x.elements.controlBody.innerHTML,/data-cp-share="food"/);
assert.equal(x.elements.controlNav.hidden,true);
x.elements.profileControl.events.change({target:{dataset:{cpShare:'food'},value:'25'}});
assert.deepEqual(x.calls.pop(),['share','food',25]);
x.context.window.ConquerPanels.open('control');
assert.equal(x.elements.controlNav.hidden,false);
assert.match(x.elements.controlBody.innerHTML,/Popolazione/);
assert.match(x.elements.controlBody.innerHTML,/<polyline/);
for(const id of x.context.window.ConquerPanels.tabs){
  x.tab(id);
  assert.ok(x.elements.controlBody.innerHTML.length>20,id+' must render content');
}
x.tab('people');
assert.match(x.elements.controlBody.innerHTML,/Festivit/);
assert.match(x.elements.controlBody.innerHTML,/TBD/);
assert.match(x.elements.controlBody.innerHTML,/Tendenza felicità/);
assert.match(x.elements.controlBody.innerHTML,/cp-history/);
x.elements.profileControl.events.change({target:{dataset:{cpPolicy:'tax'},value:'35'}});
assert.deepEqual(x.calls[0],['policy','tax','35']);
x.tab('economy');
x.elements.profileControl.events.change({target:{dataset:{cpShare:'food'},value:'75'}});
assert.deepEqual(x.calls[1],['share','food',75]);
assert.match(x.elements.controlBody.innerHTML,/Storico prezzi/);
x.elements.profileControl.events.change({target:{dataset:{},value:'wood',matches:selector=>selector==='[data-cp-price]'}});
assert.match(x.elements.controlBody.innerHTML,/Legno/);
x.tab('estate');
assert.match(x.elements.controlBody.innerHTML,/Produzione settimanale delle proprietà/);
assert.match(x.elements.controlBody.innerHTML,/cp-history/);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-transfer]'?{dataset:{cpTransfer:'farm-1',cpOwner:'private'}}:null}});
assert.deepEqual(x.calls[2],['transfer','farm-1','private']);
x.tab('diplomacy');
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-action="caravans"]'?{}:null}});
assert.deepEqual(x.calls[3],['caravans']);
// Reopening keeps the selected section; the estate picker lists only lord sites.
x.context.window.ConquerPanels.open();
assert.match(x.elements.controlBody.innerHTML,/Diplomazia/);
x.tab('estate');
assert.match(x.elements.controlBody.innerHTML,/<option value="farm-1"/);
assert.doesNotMatch(x.elements.controlBody.innerHTML,/<option value="farm-1"[^>]*>[^<]*·[^<]*<\/option><option value="mill/);
// L1 queue is interactive: minimum number, AUTO, keyboard/touch move and drag/drop.
x.context.window.ConquerPanels.open('jobs');
assert.match(x.elements.controlBody.innerHTML,/Priorità produzioni e mansioni L1/);
assert.match(x.elements.controlBody.innerHTML,/data-cp-job-min="site:log"/);
assert.match(x.elements.controlBody.innerHTML,/data-cp-job-auto="builders"/);
assert.match(x.elements.controlBody.innerHTML,/draggable="true"/);
x.elements.profileControl.events.change({target:{dataset:{cpJobMin:'site:log'},value:'2',matches:()=>false}});
assert.deepEqual(x.calls.pop(),['jobMinimum','site:log',2]);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-job-auto]'?{dataset:{cpJobAuto:'builders'}}:null}});
assert.deepEqual(x.calls.pop(),['jobAuto','builders',true]);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-job-move]'?{dataset:{cpJobMove:'up',cpJobKey:'builders'}}:null}});
assert.deepEqual(x.calls.pop(),['jobOrder',['builders','site:log']]);
const jobNode=key=>({dataset:{cpJobRow:key},classList:{add(){},remove(){}}});
x.elements.profileControl.events.dragstart({target:{closest:selector=>selector==='[data-cp-job-row]'?jobNode('site:log'):null},dataTransfer:{setData(){},effectAllowed:''}});
x.elements.profileControl.events.drop({target:{closest:selector=>selector==='[data-cp-job-row]'?jobNode('builders'):null},preventDefault(){}});
assert.deepEqual(x.calls.pop(),['jobOrder',['builders','site:log']]);
// Two Job Manager subpalettes maintain independent L1 and L2 commands.
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-jobs-tier]'?{dataset:{cpJobsTier:'L2'}}:null}});
assert.match(x.elements.controlBody.innerHTML,/Priorità produzioni e mansioni L2/);
assert.match(x.elements.controlBody.innerHTML,/data-cp-job-tier="L2"/);
assert.match(x.elements.controlBody.innerHTML,/L2 inattivi/);
x.elements.profileControl.events.change({target:{dataset:{cpJobMin:'site:field',cpJobTier:'L2'},value:'1',matches:()=>false}});
assert.deepEqual(x.calls.pop(),['l2Minimum','site:field',1]);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-job-auto]'?{dataset:{cpJobAuto:'site:mine',cpJobTier:'L2'}}:null}});
assert.deepEqual(x.calls.pop(),['l2Auto','site:mine',true]);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-job-move]'?{dataset:{cpJobMove:'up',cpJobKey:'site:mine',cpJobTier:'L2'}}:null}});
assert.deepEqual(x.calls.pop(),['l2Order',['site:mine','site:field']]);
x.elements.profileControl.events.dragstart({target:{closest:selector=>selector==='[data-cp-job-row]'?{...jobNode('site:field'),dataset:{cpJobRow:'site:field',cpJobTier:'L2'}}:null},dataTransfer:{setData(){}}});
x.elements.profileControl.events.drop({target:{closest:selector=>selector==='[data-cp-job-row]'?{...jobNode('site:mine'),dataset:{cpJobRow:'site:mine',cpJobTier:'L2'}}:null},preventDefault(){}});
assert.deepEqual(x.calls.pop(),['l2Order',['site:mine','site:field']]);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-jobs-tier]'?{dataset:{cpJobsTier:'L1'}}:null}});
assert.match(x.elements.controlBody.innerHTML,/Priorità produzioni e mansioni L1/);
// Military overview and new patrol/garrison subpalette operate on actual API commands.
x.tab('military');
assert.match(x.elements.controlBody.innerHTML,/Pattuglie e guarnigioni/);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-military-sub]'?{dataset:{cpMilitarySub:'garrisons'}}:null}});
assert.match(x.elements.controlBody.innerHTML,/Pattuglie della White Zone/);
assert.match(x.elements.controlBody.innerHTML,/Guarnigioni delle torri/);
assert.match(x.elements.controlBody.innerHTML,/Caserme e armigeri/);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-patrol]'?{dataset:{cpPatrol:'add'}}:null}});
assert.deepEqual(x.calls.pop(),['patrol',1]);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-tower-id]'?{dataset:{cpTowerId:'tower-1',cpTowerDelta:'1'}}:null}});
assert.deepEqual(x.calls.pop(),['tower','tower-1',1]);
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-barracks-id]'?{dataset:{cpBarracksId:'room-1',cpBarracksDelta:'-1'}}:null}});
assert.deepEqual(x.calls.pop(),['barracks','room-1',-1]);
const y=fixture(false);
y.context.window.ConquerPanels.open();
assert.match(y.elements.controlBody.innerHTML,/non fondato/);
assert.doesNotMatch(y.elements.controlBody.innerHTML,/Tesoreria/);
const z=fixture(true,0);
z.context.window.ConquerPanels.open();
assert.match(z.elements.controlBody.innerHTML,/Dati storici disponibili/);
console.log('panels-regression PASS (9 views, weekly welfare/prices/jobs/production, commands, unbuilt/empty history)');
