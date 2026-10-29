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
    goods:[{id:'food',price:2,market:10,castle:40,share:50,reserve:100}],
    activities:[{id:'farm-1',type:'field',owner:'lord',workers:1,value:50,profit:null}]
  };
  const books={happiness:{L1:55,L2:45,L3:50,L4:70},
    balanceHistory:Array.from({length:markets},(_,i)=>({day:i*7+5,goods:{food:{produced:12+i,demand:14}}}))};
  const commands={
    setPolicy:(...args)=>calls.push(['policy',...args]),
    setSaleShare:(...args)=>calls.push(['share',...args]),
    transferActivity:(...args)=>calls.push(['transfer',...args]),
    openCaravans:()=>calls.push(['caravans'])
  };
  const context={
    window:{
      ConquerGame:{read:{economy:()=>economy,policies:()=>({tax:25,levy:10,rations:'market'}),
        logistics:()=>({stores:[{id:'food',stock:12,cap:30}],autonomy:3,daily:4,soldiers:8,shortfall:0}),
        defense:()=>({active:true,units:4,patrols:2,hostiles:0,alarm:'off'}),
        knights:()=>({current:1,limit:2})},commands},
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
assert.match(x.elements.controlBody.innerHTML,/<polyline/);
for(const id of x.context.window.ConquerPanels.tabs){
  x.tab(id);
  assert.ok(x.elements.controlBody.innerHTML.length>20,id+' must render content');
}
x.tab('people');
assert.match(x.elements.controlBody.innerHTML,/Festivit/);
assert.match(x.elements.controlBody.innerHTML,/TBD/);
x.elements.profileControl.events.change({target:{dataset:{cpPolicy:'tax'},value:'35'}});
assert.deepEqual(x.calls[0],['policy','tax','35']);
x.tab('economy');
x.elements.profileControl.events.change({target:{dataset:{cpShare:'food'},value:'75'}});
assert.deepEqual(x.calls[1],['share','food',75]);
x.tab('estate');
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-transfer]'?{dataset:{cpTransfer:'farm-1',cpOwner:'private'}}:null}});
assert.deepEqual(x.calls[2],['transfer','farm-1','private']);
x.tab('diplomacy');
x.elements.profileControl.events.click({target:{closest:selector=>selector==='[data-cp-action="caravans"]'?{}:null}});
assert.deepEqual(x.calls[3],['caravans']);
const y=fixture(false);
y.context.window.ConquerPanels.open();
assert.match(y.elements.controlBody.innerHTML,/non fondato/);
assert.doesNotMatch(y.elements.controlBody.innerHTML,/Tesoreria/);
const z=fixture(true,0);
z.context.window.ConquerPanels.open();
assert.match(z.elements.controlBody.innerHTML,/Dati storici disponibili/);
console.log('panels-regression PASS (9 views, ledger graph, controls, unbuilt and empty history)');
