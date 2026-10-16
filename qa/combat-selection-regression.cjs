'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../src/settlement-combat.js','utf8');
const begin=source.indexOf('  function selectCombatUnits(');
const end=source.indexOf('  function whiteBoundaryPoints()',begin);
assert.ok(begin>=0&&end>begin,'real unit selection and orders must be present');
const units=[
  {id:'commander',kind:'knight',x:100,y:100},
  {id:'squad1',kind:'squad',x:102,y:100},
  {id:'squad2',kind:'squad',x:100,y:102},
  {id:'far',kind:'squad',x:140,y:140},
  {id:'patrol1',kind:'patrol',x:101,y:102}
];
const window={__CONQUER_CAMP_MODE__:false};
const calls=[],notices=[];
const context=vm.createContext({
  Math,Set,State:{clock:{speed:1}},window,selected:null,selectionDrag:null,selectedIds:new Set(),
  combat:{units},
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  point:(x,y)=>({x:Math.max(0,Math.min(200,x)),y:Math.max(0,Math.min(200,y))}),
  infantryRoute:(unit,target)=>[{x:unit.x,y:unit.y},target],
  syncButtons:()=>{},changed:()=>calls.push('changed'),
  status:msg=>notices.push(msg)
});
vm.runInContext(source.slice(begin,end),context);
const select=vm.runInContext('selectCombatUnits',context);
const clear=vm.runInContext('clearCombatSelection',context);
const allow=vm.runInContext('commanderCoversOrder',context);
const group=vm.runInContext('issueGroupMove',context);
const move=vm.runInContext('issueMove',context);
const list=()=>[...context.selectedIds];
select([units[1]]);assert.deepEqual(list(),['squad1']);
select([units[2]],true);assert.deepEqual(list(),['squad1','squad2']);
select([units[1]],true,true);assert.deepEqual(list(),['squad2'],'Shift-click toggles unit');
select([units[0],units[1]]);assert.deepEqual(list(),['commander','squad1'],'box replace selection');
clear();assert.deepEqual(list(),[],'explicit deselect empties selection');
assert.equal(context.selected,null,'primary selection also clears');
console.log('PASS additive, toggle, window-replace and deselection semantics');

assert.equal(allow(units[1],{x:113,y:100}),true,'commander covers >6U squad order');
assert.equal(allow(units[1],{x:117,y:100}),false,'destination outside 16U commander radius');
assert.equal(allow(units[3],{x:140,y:141}),false,'commander must cover squad itself');
assert.equal(move(units[1],{x:113,y:100}),true,'squad can march more than sergeant 6U under commander');
assert.equal(move(units[1],{x:118,y:100}),false,'commander radius still a limit');
console.log('PASS 16U commander authority overrides 6U sergeant limit without leaking outside command area');
window.__CONQUER_CAMP_MODE__=true;
assert.equal(move(units[1],{x:118,y:100}),true,'/camp can order squads beyond the commander beacon for open-field camps');
window.__CONQUER_CAMP_MODE__=false;
console.log('PASS /camp direct orders extend beyond yellow and knight beacon');

select([units[0],units[1],units[2]]);
group({x:107,y:103});
assert.ok(units.slice(0,3).every(u=>u.target),'group order sets targets for all three');
const targets=units.slice(0,3).map(u=>u.target);
assert.ok(Math.abs((targets[1].x-targets[0].x)-2)<.00001);
assert.ok(Math.abs((targets[2].y-targets[0].y)-2)<.00001);
assert.ok(calls.length>=2,'movement changes marked for persistence');
assert.match(notices.at(-1),/unit\(s\) marching/);
assert.match(source,/const hits=combat\.units\.filter\(u=>\{/,'marquee selects actual friendly units');
assert.match(source,/canvas\.setPointerCapture\(e\.pointerId\)/);
assert.match(source,/id="combatDeselect"/,'explicit deselect button');
assert.match(source,/e\.key!=='Escape'/,'Escape supports clear selection');
assert.match(source,/selectCombatUnits\(\[hit\],e\.shiftKey,e\.shiftKey\)/,'Shift click updates selection');
console.log('PASS grouped destinations preserve relative formation, mouse box and keyboard actions are wired');

// The command-radius limit is intentional on main, but rejection cannot be silent.
clear();
select([units[1]]);
group({x:120,y:100});
assert.match(notices.at(-1),/fuori raggio cavaliere \(16U\)/,'rejected order explains knight command radius');
context.State.clock.speed=0;
group({x:105,y:100});
assert.match(notices.at(-1),/tempo in pausa/,'accepted paused orders explain why units are stationary');
console.log('PASS command rejection and paused-order diagnostics');

