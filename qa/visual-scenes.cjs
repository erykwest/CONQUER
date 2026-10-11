'use strict';
// Visual QA fixtures are intentionally plain data: no save/load or production state.
const tower=(id,x,y,extra={})=>({id,type:'tower',x,y,shape:'square',size:2,tier:3,level:2,angle:0,roofStyle:'battlement',baseStyle:'standard',...extra});
const wall=(id,x1,y1,x2,y2,extra={})=>({id,type:'wall',a:{x:x1,y:y1},b:{x:x2,y:y2},length:Math.hypot(x2-x1,y2-y1),width:.5,tier:2,level:1,...extra});
const built=(id,x1,y1,x2,y2,extra={})=>({id,type:'built',a:{x:x1,y:y1},b:{x:x2,y:y2},length:Math.hypot(x2-x1,y2-y1),width:1,level:2,...extra});
const house=(id,x,y,level=1,extra={})=>({id,type:'house',auto:true,x,y,w:1.5,h:1,houseLevel:level,angle:0,doorSide:-1,...extra});
const scenes=[
  {id:'tower-square',focus:{x:100,y:100},structures:[tower('T01',100,100,{level:3,roofStyle:'pitched'})]},
  {id:'tower-round',focus:{x:100,y:100},structures:[tower('T01',100,100,{shape:'round',r:1,size:2,roofStyle:'machicolation',level:3})]},
  {id:'tower-buttress',focus:{x:100,y:100},structures:[tower('T01',100,100,{baseStyle:'buttress',roofStyle:'battlement'})]},
  {id:'tower-wall-link',focus:{x:100,y:100},structures:[tower('T01',98,99),wall('W01',99,99,104,99,{level:2}),tower('T02',105,99,{level:3,roofStyle:'pitched'})]},
  {id:'height-overlap',focus:{x:100,y:100},structures:[tower('T01',98,98,{level:1,size:1.5,tier:2}),tower('T02',101,101,{level:3,roofStyle:'pitched'}),wall('W01',99,98,100,101,{level:2})]},
  {id:'cutaway-room',focus:{x:100,y:100},structures:[tower('T01',100,100,{level:3,cutaway:true,functions:['barracks','armory','storage']})]},
  {id:'built-roof',focus:{x:100,y:100},structures:[tower('T01',97,100),built('B01',98,100,102,100,{skin:'arcade'}),tower('T02',103,100,{level:3})]},
  {id:'gate-roof',focus:{x:100,y:100},structures:[{id:'G01',type:'gate',x:100,y:100,angle:0,level:2,roofStyle:'pitched'},wall('W01',94,100,99.25,100),wall('W02',100.75,100,106,100)]},
  {id:'wood-fortifications',focus:{x:100,y:100},structures:[tower('T01',98,100,{material:'wood',woodStyle:'watchtower',tier:1,level:1,size:1,roofStyle:'battlement'}),{id:'P01',type:'palisade',a:{x:99,y:100},b:{x:104,y:100},length:5,width:.5,tier:2,level:1}]},
  {id:'urban-occlusion',focus:{x:100,y:100},structures:[house('H01',98,98,2),house('H02',102,101,4),house('H03',101,96,3),{id:'well',type:'well',x:100,y:100}]},
  {id:'civic-neighbors',focus:{x:100,y:100},structures:[{id:'M01',type:'market',x:95,y:98,angle:0},{id:'V01',type:'tavern',x:102,y:100,angle:0},house('H01',106,103,2)]},
  {id:'construction-cutaway',focus:{x:100,y:100},structures:[tower('T01',97,100,{cutaway:true,level:3}),tower('T02',102,100,{level:2,construction:{startedDay:0,completeDay:100}}),wall('W01',99,100,101,100,{level:2})]}
];
const rotationCases=[0,1,2,3];
function validateFixtures(){
  const seen=new Set();
  for(const s of scenes){
    if(seen.has(s.id))throw Error('Duplicated fixture '+s.id);seen.add(s.id);
    if(!s.structures.length||!s.focus)throw Error('Incomplete fixture '+s.id);
    for(const p of s.structures){
      if(!p.id||!p.type)throw Error('Unidentified structure in '+s.id);
      if(p.type==='wall'||p.type==='built'||p.type==='palisade'){
        if(!p.a||!p.b||Math.hypot(p.a.x-p.b.x,p.a.y-p.b.y)<.05)throw Error('Bad linear geometry '+p.id);
      } else if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Bad world point '+p.id);
    }
  }
}
validateFixtures();
module.exports={scenes,rotationCases};
