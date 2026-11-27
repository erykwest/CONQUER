// Extract one approved 2D animal (settlement-animals.js drawAnimal) part by part, as masks, for the
// Blender build of its 8 views (tools/blender/animal_views.py). Same method as the mounted figures
// (extract_mounted_parts.mjs): ANIMAL-VIEWS-261127.
//
//   node tools/blender/extract_animal_parts.mjs <out dir> <species>
//   Env: LAB_URL (default http://127.0.0.1:4190/figures-lab.html), QA_CHROME (Chromium executable).
//
// The animal is drawn once facing right, at rest, recording every fill/stroke with the function that
// made it and its colour; then each kept call is drawn alone in white: its mask is that part of the
// approved art. Art facing left (sheep) is drawn mirrored, so the frame and the gait written here
// are always the right-facing ones (x mirrored about the ground centre, angles negated).
// Written: <out>/part_<k>.png, <out>/parts.json (ops, frame, leg pivots, gait poses, colours).
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const out=path.resolve(process.argv[2]||'animal_parts');
const species=process.argv[3]||'sheep';
const url=process.env.LAB_URL||'http://127.0.0.1:4190/figures-lab.html';
fs.mkdirSync(out,{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME||undefined});
const page=await browser.newPage();
await page.goto(url,{waitUntil:'load'});
await page.waitForFunction(()=>window.ConquerAnimals,null,{timeout:60000});

const data=await page.evaluate(({species})=>{
  const A=window.ConquerAnimals,sp=A.SPECIES[species];
  const W=900,H=760,X=420,Y=640,PX=2;
  const size=PX*256/(sp.scale||1);
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
  const draw=()=>{count=0;g.clearRect(0,0,W,H);A.drawAnimal(species,g,X,Y,size,{facing:1,mode:'idle',from:'idle',blend:1,t:0,seed:0})};
  draw();
  const C=sp.colors,outlines=new Set([C.line,C.legLine,C.headLine,C.hornLine].filter(Boolean).map(s=>String(s).toLowerCase()));
  // Outlines are redrawn by the view renderer; only coloured shapes (and the coloured antler strokes) become parts.
  const kept=ops.filter(o=>!(o.op.startsWith('stroke')&&outlines.has(o.style.toLowerCase())));
  mode='mask';const masks={};
  for(const o of kept){target=o.k;draw();masks[o.k]=c.toDataURL('image/png')}
  for(const n of Object.keys(orig))P[n]=orig[n];
  // Right-facing frame: art drawn mirrored (artFacing -1) has x mirrored about the ground centre.
  const m=sp.artFacing<0?-1:1,CX=sp.center.x,mx=x=>CX+m*(x-CX),pt=p=>p&&({x:mx(p.x),y:p.y});
  const pick=p=>({legs:p.legs.map(v=>v*m),bend:(p.bend||[0,0,0,0]).map(v=>v*m),lift:[...(p.lift||[0,0,0,0])],bob:p.bob||0,
    tilt:(p.tilt||0)*m,headX:(p.headX||0)*m,headY:p.headY||0,headRot:(p.headRot||0)*m,tail:(p.tail||0)*m});
  const poses={idle:pick(A.transitionPose(species,'idle','idle',1,0,0))};
  for(let ph=0;ph<8;ph++)poses['p'+ph]=pick(A.transitionPose(species,'walk','walk',1,(ph+.5)/8/1.6,0));
  const head=sp.joint?{x:(mx(sp.joint.a.x)+mx(sp.joint.b.x))/2,y:(sp.joint.a.y+sp.joint.b.y)/2}:pt(sp.pivot);
  const box=sp.bodyBox;
  return{frame:{W,H,X,Y,PX,center:sp.center,head,tailPivot:pt(sp.tailPivot),
      legOrder:sp.legOrder||[0,1,2,3],legs:sp.legList.map(l=>({x:mx(l.x),y:l.y,joint:pt(l.joint),w:l.w})),
      bodyH:box.y1-box.y0,bodyW:box.x1-box.x0},
    species,colors:{coat:C,livery:{main:'#000000',alt:'#000000'}},ops:kept,poses,masks};
},{species});

for(const [k,u] of Object.entries(data.masks))
  fs.writeFileSync(path.join(out,`part_${k}.png`),Buffer.from(u.split(',')[1],'base64'));
delete data.masks;
fs.writeFileSync(path.join(out,'parts.json'),JSON.stringify(data,null,1));
console.log(species,'parts:',data.ops.length,'->',out);
await browser.close();
