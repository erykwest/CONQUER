// Extract the approved 2D mounted figure (settlement-mounted2d.js + settlement-animals.js) part by
// part, as masks, for the Blender build of the 8 views (tools/blender/mounted_views.py).
//
//   node tools/blender/extract_mounted_parts.mjs <out dir> [kind=messenger] [json options]
//   options: {"helmet":"kettle","shield":"oval","crest":"eagle","charge":true} (knight variants, lance couched)
//   Env: LAB_URL (default http://127.0.0.1:4190/figures-lab.html), QA_CHROME (Chromium executable).
//
// The figure is drawn once in the side view at rest (idle), recording every fill/stroke call with
// the function that made it and its colour. Then each kept call is drawn alone, in white, with the
// same transforms and clips: its mask is the exact shape of that part of the approved art.
// Written: <out>/part_<k>.png (mask), <out>/parts.json (ops, art frame, leg pivots, gait poses).
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const out=path.resolve(process.argv[2]||'mounted_parts');
const kind=process.argv[3]||'messenger';
const variant=JSON.parse(process.argv[4]||'{}');
const url=process.env.LAB_URL||'http://127.0.0.1:4190/figures-lab.html';
fs.mkdirSync(out,{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined});
const page=await browser.newPage();
await page.goto(url,{waitUntil:'load'});
await page.waitForFunction(()=>window.ConquerMounted2D&&window.ConquerAnimals,null,{timeout:60000});

const data=await page.evaluate(({kind,variant})=>{
  const A=window.ConquerAnimals,M2=window.ConquerMounted2D,sp=A.SPECIES.horse;
  // art unit = PX pixels; ground centre at (X,Y). Room for the knight's lance: raised, its tip is
  // ~470 art units above the ground; couched, ~310 ahead of the centre.
  const W=1500,H=1400,X=650,Y=1250,PX=2;
  const size=PX*256/(sp.scale||1);
  const livery={main:'#b32628',alt:'#eac15b'};
  const P=CanvasRenderingContext2D.prototype,orig={};
  for(const n of ['fill','fillRect','stroke','strokeRect'])orig[n]=P[n];
  let mode='inventory',target=-1,count=0;const ops=[];
  const tagOf=()=>new Error().stack.split('\n').slice(2)
    .map(l=>{const m=l.match(/at (\S+) \(.*?settlement-([\w-]+)\.js/);return m?m[2]+':'+m[1]:null})
    .filter(Boolean).slice(0,5).join('<');
  for(const n of Object.keys(orig)){
    P[n]=function(...a){
      const k=count++;
      if(mode==='inventory'){
        ops.push({k,op:n,style:String(n.startsWith('fill')?this.fillStyle:this.strokeStyle),lw:this.lineWidth,tag:tagOf()});
        return orig[n].apply(this,a);
      }
      if(k!==target)return;
      const f=this.fillStyle,s=this.strokeStyle,ga=this.globalAlpha;
      this.fillStyle='#ffffff';this.strokeStyle='#ffffff';this.globalAlpha=1;
      const r=orig[n].apply(this,a);
      this.fillStyle=f;this.strokeStyle=s;this.globalAlpha=ga;return r;
    };
  }
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  // kind 'wagon': the vehicle card as settlement-vehicles.js paints it (wagon, team, seated driver or
  // the carter at the horse's head), at rest, without cargo; variant.vehicle: cart | wagon | coach.
  const VEH={cart:{chassis:'cart',team:1},wagon:{chassis:'wagon',team:2},coach:{chassis:'carriage',team:2}};
  const DRIVER={kind:'peasant',role:'carter',age:'adult',sex:'male',colors:['#8a6a48','#5d4632'],hair:'#4a3626',id:'x-driver'};
  const COACHMAN={kind:'merchant',age:'adult',sex:'male',colors:['#3f4f6e','#c8a44a'],hair:'#2e2620',id:'x-coachman'};
  const villagerAt=(dot,sx,sy,sz)=>{
    // paintVillagerAt: the figure painter projects only its feet point through w2s.
    const keep=w2s,ks=State.view.scale;State.view.scale=sz/5.75;window.ctx=g;try{ctx=g}catch{}
    w2s=()=>({x:sx,y:sy});try{drawVillagerFigureUnmasked({...dot,p:{x:0,y:0}})}finally{w2s=keep;State.view.scale=ks}};
  const draw=()=>{count=0;g.clearRect(0,0,W,H);
    if(kind==='wagon'){
      const v=VEH[variant.vehicle]||VEH.wagon,dot=variant.vehicle==='coach'?COACHMAN:DRIVER,cart=v.chassis==='cart';
      // The team at rest (drawWagon always walks its horses): the 3D rig poses them from rest.
      const keep=A.drawAnimal;A.drawAnimal=(sp,c2,x,y,sz,o={})=>keep(sp,c2,x,y,sz,{...o,mode:'idle',from:'idle',t:0});
      try{window.ConquerWagons.drawWagon(g,X,Y,size,{chassis:v.chassis,team:Array.from({length:v.team},()=>({coat:'brown'})),
        cargo:variant.cargo||[],facing:1,moving:false,t:0,distance:0,driver:cart?null:(gg,sx,sy,sz)=>villagerAt(dot,sx,sy,sz)});}finally{A.drawAnimal=keep}
      // The carter walks at the horse's head: .75 U ahead of the bed middle (U = 12 px at scale 1).
      if(cart)villagerAt(dot,X+.75*12*size/5.75,Y+.12*12*size/5.75,size);
      return;
    }
    M2.draw(g,X,Y,size,{kind,facing:1,mode:'idle',from:'idle',blend:1,t:0,seed:0,coat:'brown',livery,...variant})};
  draw();
  // Outlines are redrawn by the view renderer; only coloured shapes become parts.
  // (Every dark rgba(25,24,22,a) stroke is an outline or a fold line: the outline, mantling and crest edges.)
  const C=sp.colors,outlines=new Set([C.line,C.legLine,C.headLine].map(s=>String(s).toLowerCase()));
  const kept=ops.filter(o=>!(o.op.startsWith('stroke')&&(outlines.has(o.style.toLowerCase())||o.style.startsWith('rgba(25, 24, 22'))));
  mode='mask';const masks={};
  for(const o of kept){target=o.k;draw();masks[o.k]=c.toDataURL('image/png')}
  for(const n of Object.keys(orig))P[n]=orig[n];
  // Gait: the same poses the card uses for the profile (t = (phase+.5)/8/1.6), and the rest pose.
  const pick=p=>({legs:[...p.legs],bend:[...(p.bend||[0,0,0,0])],lift:[...(p.lift||[0,0,0,0])],bob:p.bob||0,tilt:p.tilt||0,
    headX:p.headX||0,headY:p.headY||0,headRot:p.headRot||0,tail:p.tail||0});
  const poses={idle:pick(A.transitionPose('horse','idle','idle',1,0,0))};
  for(let ph=0;ph<8;ph++)poses['p'+ph]=pick(A.transitionPose('horse','walk','walk',1,(ph+.5)/8/1.6,0));
  // Charge (run): the gait cycle is t*2.2 (settlement-animals.js gaitPose).
  for(let ph=0;ph<8;ph++)poses['r'+ph]=pick(A.transitionPose('horse','run','run',1,(ph+.5)/8/2.2,0));
  return{frame:{W,H,X,Y,PX,center:sp.center,pivot:sp.pivot,joint:sp.joint,tailPivot:sp.tailPivot,neck:sp.neck,
      legOrder:sp.legOrder||[0,1,2,3],legs:sp.legList.map(l=>({x:l.x,y:l.y,joint:l.joint,w:l.w}))},
    colors:{coat:C,livery},variant,ops:kept,poses,masks,wagons:kind==='wagon'?wagonData():null};
  // The vehicle's own numbers (settlement-wagons.js), so the 3D build uses the art's geometry:
  // chassis, cargo sizes, colours, depth offset, scale, team layout and cargo slots for 1..6 items.
  function wagonData(){
    const W2=window.ConquerWagons,v=VEH[variant.vehicle]||VEH.wagon,team=Array.from({length:v.team},()=>({}));
    const slots={};for(let n=1;n<=6;n++)slots[n]=W2.wagonLayout({chassis:v.chassis,team,cargo:Array(n).fill('crate')}).cargo;
    return{vehicle:variant.vehicle||'wagon',chassis:v.chassis,CHASSIS:W2.CHASSIS,CARGO:W2.CARGO,COLORS:W2.COLORS,DEPTH:W2.DEPTH,
      K:W2.WAGON_SCALE,layout:W2.wagonLayout({chassis:v.chassis,team}),slots};
  }
},{kind,variant});

for(const [k,url] of Object.entries(data.masks))
  fs.writeFileSync(path.join(out,`part_${k}.png`),Buffer.from(url.split(',')[1],'base64'));
delete data.masks;
fs.writeFileSync(path.join(out,'parts.json'),JSON.stringify(data,null,1));
console.log('parts:',data.ops.length,'->',out);
await browser.close();
