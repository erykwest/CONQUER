'use strict';
// CONQUER /march — isolated strategic prototype, NOT the persistent World/Feudal ledger.
// Engine is intentionally UI-free. A future world adapter owns fiefs, armies and siege outcomes.
(function(root){
  const WIDTH=9, HEIGHT=7, KEY='conquer.march.prototype.v1';
  const WATER=new Set(['4,0','4,1','4,2','4,4','4,5','4,6','6,2','6,3']);
  const RESOURCE_KEYS=['food','wood','gold'];
  const same=(a,b)=>a.x===b.x&&a.y===b.y;
  const inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<WIDTH&&y>=0&&y<HEIGHT;
  const traversable=(x,y)=>inside(x,y)&&!WATER.has(x+','+y);
  const fiefAt=(s,x,y)=>s.fiefs.find(f=>f.x===x&&f.y===y)||null;
  const atFief=s=>fiefAt(s,s.company.x,s.company.y);
  const currentTarget=s=>s.operation?s.fiefs.find(f=>f.id===s.operation.fiefId)||null:null;
  const cargoUsed=s=>RESOURCE_KEYS.reduce((sum,k)=>sum+s.company.cargo[k],0);
  function note(s,message){s.log.unshift('Giorno '+s.day+' — '+message);s.log.length=30;}
  function initial(){
    return {
      version:1, day:1, selected:'grayford',
      company:{x:1,y:3,route:[],troops:{spearmen:24,archers:12,knights:6},
        food:64,morale:100,cargo:{food:0,wood:0,gold:0},capacity:90},
      fiefs:[
        {id:'grayford',name:'Grayford',x:1,y:3,owner:'player',garrison:32,stock:{food:160,wood:85,gold:65},damage:{civil:0,fort:0}},
        {id:'hollowmere',name:'Hollowmere',x:3,y:2,owner:'enemy',garrison:22,stock:{food:115,wood:72,gold:42},damage:{civil:0,fort:0}},
        {id:'thornwatch',name:'Thornwatch',x:7,y:1,owner:'enemy',garrison:48,stock:{food:235,wood:120,gold:105},damage:{civil:0,fort:0}},
        {id:'blackfen',name:'Blackfen',x:7,y:5,owner:'enemy',garrison:31,stock:{food:145,wood:90,gold:58},damage:{civil:0,fort:0}}
      ], operation:null, log:['Giorno 1 — La compagnia è pronta a Grayford.']
    };
  }
  function pathfind(from,to){
    if(!traversable(to.x,to.y))return null;
    if(same(from,to))return [];
    const queue=[from],seen=new Set([from.x+','+from.y]),prev=new Map();
    for(let i=0;i<queue.length;i++){
      const p=queue[i];
      for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
        const n={x:p.x+dx,y:p.y+dy},key=n.x+','+n.y;
        if(!traversable(n.x,n.y)||seen.has(key))continue;
        seen.add(key);prev.set(key,p);
        if(same(n,to)){
          const route=[n];let step=n;
          while(!same(step,from)){step=prev.get(step.x+','+step.y);if(!same(step,from))route.unshift(step);}
          return route;
        }
        queue.push(n);
      }
    }
    return null;
  }
  function select(s,id){if(!s.fiefs.some(f=>f.id===id))return false;s.selected=id;return true;}
  function march(s,x,y){
    if(s.operation||!traversable(x,y)||s.company.morale<=0)return false;
    const route=pathfind(s.company,{x,y});
    if(route===null)return false;
    s.company.route=route;
    note(s,route.length?'Ordine di marcia: '+route.length+' tappe.':'La compagnia è già a destinazione.');
    if(!route.length)arrive(s);
    return true;
  }
  function arrive(s){
    const f=atFief(s);
    if(!f)return;
    s.selected=f.id;
    if(f.owner==='enemy'){
      s.operation={fiefId:f.id,phase:'approach',days:0,breached:false};
      note(s,'La compagnia ha raggiunto il feudo ostile di '+f.name+'.');
    }else note(s,'La compagnia è entrata nel feudo alleato di '+f.name+'.');
  }
  function dailyCosts(s){
    s.day++;
    if(s.company.food>0)s.company.food=Math.max(0,s.company.food-2);
    else s.company.morale=Math.max(0,s.company.morale-8);
  }
  function advance(s,days=1){
    if(!Number.isInteger(days)||days<1||days>30)return false;
    for(let n=0;n<days;n++){
      if(s.company.morale<=0){note(s,'Compagnia esausta: movimento sospeso.');break;}
      dailyCosts(s);
      if(s.company.route.length){
        const p=s.company.route.shift();
        s.company.x=p.x;s.company.y=p.y;
        if(!s.company.route.length)arrive(s);
      }else if(s.operation?.phase==='siege'){
        const f=currentTarget(s);
        if(!f)break;
        s.operation.days++;
        // DEMO: stock reduction only, not a blockade, surrender or combat simulation.
        f.stock.food=Math.max(0,f.stock.food-2);
        note(s,'Assedio in corso a '+f.name+' (giorno '+s.operation.days+').');
      }
    }
    return true;
  }
  function raid(s){
    const f=currentTarget(s);
    if(!f||f.owner!=='enemy'||!['approach','raiding','breached','siege'].includes(s.operation.phase))return false;
    if(s.company.morale<=0)return false;
    const capacity=Math.max(0,s.company.capacity-cargoUsed(s));
    const take={food:0,wood:0,gold:0};let left=capacity;
    for(const key of ['gold','food','wood']){
      const want=Math.min(key==='gold'?12:key==='food'?16:10,Math.floor(f.stock[key]*.3));
      take[key]=Math.min(want,left);
      left-=take[key];f.stock[key]-=take[key];s.company.cargo[key]+=take[key];
    }
    f.damage.civil=Math.min(100,f.damage.civil+12);
    const hadSiege=s.operation.phase==='siege';
    dailyCosts(s);
    s.operation.phase=hadSiege?'siege':s.operation.breached?'breached':'raiding';
    note(s,'Razzia a '+f.name+': bottino '+RESOURCE_KEYS.map(k=>k+' '+take[k]).join(', ')+'. Danni civili '+f.damage.civil+'%.');
    return take;
  }
  function besiege(s){
    const f=currentTarget(s);
    if(!f||f.owner!=='enemy'||s.operation.breached||!['approach','raiding'].includes(s.operation.phase))return false;
    s.operation.phase='siege';s.operation.days=0;
    note(s,'Iniziato assedio di '+f.name+'.');return true;
  }
  // External integration seam: only a real Combat/Siege result should call this in production.
  function reportAssaultVictory(s){
    const f=currentTarget(s);
    if(!f||s.operation.phase!=='siege'||s.operation.days<1)return false;
    s.operation.phase='breached';s.operation.breached=true;
    f.damage.fort=Math.min(100,f.damage.fort+30);
    note(s,'ESITO DI TEST: difese espugnate a '+f.name+'. La conquista resta facoltativa.');
    return true;
  }
  function conquer(s){
    const f=currentTarget(s);
    if(!f||!s.operation.breached||f.owner!=='enemy')return false;
    f.owner='player';
    s.operation=null;
    note(s,f.name+' annesso. La compagnia può proseguire la campagna.');
    return true;
  }
  function withdraw(s){
    if(!s.operation)return false;
    const f=currentTarget(s);
    s.operation=null;s.company.route=[];
    note(s,'Operazione interrotta presso '+(f?.name||'il feudo')+'. Danni e bottino rimangono.');
    return true;
  }
  function unload(s){
    const f=atFief(s);
    if(!f||f.owner!=='player'||cargoUsed(s)===0)return false;
    const amount=cargoUsed(s);
    for(const k of RESOURCE_KEYS){f.stock[k]+=s.company.cargo[k];s.company.cargo[k]=0;}
    note(s,'Consegnato bottino ('+amount+' unità) a '+f.name+'.');
    return amount;
  }
  function resupply(s){
    const f=atFief(s);
    if(!f||f.owner!=='player')return false;
    const amount=Math.min(64-s.company.food,f.stock.food);
    if(amount<=0)return false;
    s.company.food+=amount;f.stock.food-=amount;
    note(s,'Riforniti '+amount+' viveri a '+f.name+'.');
    return amount;
  }
  function valid(s){
    return !!s&&s.version===1&&Number.isSafeInteger(s.day)&&s.day>=1&&
      Array.isArray(s.fiefs)&&s.fiefs.length===4&&s.fiefs.every(f=>typeof f.id==='string'&&
        inside(f.x,f.y)&&['player','enemy'].includes(f.owner)&&
        RESOURCE_KEYS.every(k=>Number.isFinite(f.stock?.[k])&&f.stock[k]>=0)&&
        ['civil','fort'].every(k=>Number.isFinite(f.damage?.[k])&&f.damage[k]>=0&&f.damage[k]<=100))&&
      s.company&&traversable(s.company.x,s.company.y)&&
      Array.isArray(s.company.route)&&s.company.route.every(p=>traversable(p.x,p.y))&&
      Number.isFinite(s.company.food)&&s.company.food>=0&&
      Number.isFinite(s.company.morale)&&s.company.morale>=0&&s.company.morale<=100&&
      Number.isFinite(s.company.capacity)&&s.company.capacity>=0&&
      RESOURCE_KEYS.every(k=>Number.isFinite(s.company.cargo?.[k])&&s.company.cargo[k]>=0)&&
      (!s.operation||(s.fiefs.some(f=>f.id===s.operation.fiefId)&&
        ['approach','raiding','siege','breached'].includes(s.operation.phase)))&&
      Array.isArray(s.log);
  }
  function load(store){
    try{const raw=store?.getItem(KEY);if(!raw)return initial();const s=JSON.parse(raw);return valid(s)?s:initial();}
    catch(_){return initial();}
  }
  function save(s,store){if(!valid(s))return false;try{store?.setItem(KEY,JSON.stringify(s));return true;}catch(_){return false;}}
  const api=Object.freeze({WIDTH,HEIGHT,KEY,initial,pathfind,traversable,fiefAt,atFief,currentTarget,
    cargoUsed,select,march,advance,raid,besiege,reportAssaultVictory,conquer,withdraw,resupply,unload,load,save,valid});
  root.ConquerMarch=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
