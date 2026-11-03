// CONQUER: original 2.5D scene renderer. 24 true camera-azimuth views, no flat image spin.
const render = function render(angle) {
 const rad=(angle+30)*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad);
 const project=p=>`${(512+(p[0]*cs-p[1]*sn)*40).toFixed(1)},${(652+(p[0]*sn+p[1]*cs)*21-(p[2]||0)*43).toFixed(1)}`;
 const shape=(pts,fill,stroke='#57402b',sw=1,attr='')=>`<polygon points="${pts.map(project).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${attr}/>`;
 const line=(a,b,c='#8b683e',w=4,attr='')=>`<path d="M${project(a)}L${project(b)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none" ${attr}/>`;
 let s=101211;const rng=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);const R=(a,b)=>a+(b-a)*rng();
 const ellipse=(x,y,z,r,n=12)=>Array.from({length:n},(_,i)=>[x+Math.cos(Math.PI*2*i/n)*r,y+Math.sin(Math.PI*2*i/n)*r,z]);
 const beam=(a,b,w=9)=>line(a,b,'#422e20',w+3)+line(a,b,'#865d38',w)+line([a[0],a[1],a[2]+.055],[b[0],b[1],b[2]+.055],'#c3a171',Math.max(1,w*.18));
 function stump(x,y,h,r){
  const b=ellipse(x,y,0,r),u=ellipse(x,y,h,r);
  let o='';
  for(let i=0;i<12;i++){let j=(i+1)%12;o+=shape([b[i],b[j],u[j],u[i]],['#664529','#8e6237','#64452d','#7f5834'][i%4],'#543c2a',.7);}
  o+=shape(u,'#d9b579','#553b29',2)+shape(ellipse(x,y,h+.005,r*.68),'none','#a27c50',1.3)+shape(ellipse(x,y,h+.01,r*.30),'none','#926d46',1);
  return o;
 }
 function log(a,b,r){
  let dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
  const ring=p=>Array.from({length:10},(_,i)=>[p[0]+nx*Math.cos(i*Math.PI/5)*r,p[1]+ny*Math.cos(i*Math.PI/5)*r,p[2]+Math.sin(i*Math.PI/5)*r]);
  let o='',v=ring(a),w=ring(b);
  for(let i=0;i<10;i++){let j=(i+1)%10;o+=shape([v[i],w[i],w[j],v[j]],['#65432c','#916a41','#a58153','#56412f'][i%4],'#543b28',.7);}
  const cap=a[0]*sn+a[1]*cs>b[0]*sn+b[1]*cs?v:w;
  return o+shape(cap,'#cfa771','#503823',1.5)+shape(cap.map(p=>[p[0],p[1],p[2]*.97]),'none','#9a794f',.8);
 }
 function fence(a,b){
  let o='<g data-part="wattle-fence">',n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/1.2);
  const xy=t=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
  for(let j=0;j<7;j++)for(let k=0;k<4*n;k++){
   let f=k/(n*4),g=(k+1)/(n*4),aa=xy(f),bb=xy(g);
   o+=line([...aa,.2+j*.17+.03*Math.sin(k+j)],[...bb,.2+j*.17+.03*Math.sin(k+1+j)],j%2?'#8b6d48':'#594a34',5.3);
  }
  for(let k=0;k<=n;k++){let a=xy(k/n);o+=beam([...a,.05],[...a,1.58],7)+shape(ellipse(...a,1.58,.1,8),'#b79a69','#443527',1);}
  return o+'</g>';
 }
 function horse(x,y,theta){
  let ca=Math.cos(theta),sa=Math.sin(theta),p=(u,v,z)=>[x+u*ca-v*sa,y+u*sa+v*ca,z];
  let o='<g data-part="sawhorse">';
  for(const u of [-.68,.68]){o+=beam(p(u,-.1,.87),p(u,-.47,.02),5)+beam(p(u,.1,.87),p(u,.47,.02),5);}
  return o+beam(p(-.91,0,.87),p(.91,0,.87),15)+'</g>';
 }
 function shelter(){
  const ox=.2,oy=-2.05,L=2.5,D=1.95,E=2.25,H=5.4,over=.23;
  const p=(x,y,z)=>[ox+x,oy+y,z];
  let o='<g data-part="shelter">';
  o+=shape([p(-L,-D,0),p(L,-D,0),p(L,D,0),p(-L,D,0)],'#332e22','none',0,'opacity=".36"');
  for(let i=0;i<4;i++)o+=log(p(-1,-.3+i*.25,.18+i*.13),p(.75,-.3+i*.25,.18+i*.13),.13);
  for(const y of [-D,D]){
   for(const x of [-L,L])o+=beam(p(x,y,0),p(x,y,E),10);
   o+=beam(p(-L,y,E),p(0,y,H),10)+beam(p(0,y,H),p(L,y,E),10);
  }
  for(const x of [-L,L])o+=beam(p(x,-D,E),p(x,D,E),9);
  o+=beam(p(0,-D,H),p(0,D,H),11);
  o+=shape([p(-L,-D+.03,E),p(0,-D+.03,H),p(L,-D+.03,E),p(L,-D+.03,1.25),p(-L,-D+.03,1.25)],'#574431','#33291e',2);
  const faces=[-1,1].sort((a,b)=>a*sn-b*sn);
  for(const sign of faces){
   const u=(f,g,zoff=0)=>p(sign*(L+over)*f,-D-over+(2*D+2*over)*g,H-(H-E+.1)*f+zoff);
   o+=shape([u(0,0),u(1,0),u(1,1),u(0,1)],sign<0?'#95794f':'#6a5238','#473725',3);
   for(let k=0;k<132;k++){
    let f=R(.04,.96),g=R(.01,.98),f2=Math.min(.997,f+R(.012,.07)),g2=Math.max(.005,Math.min(.997,g+R(-.025,.014)));
    o+=line(u(f,g,.015),u(f2,g2,.015),rng()>.48?'#c6a36a':'#413323',R(.65,2.3),`opacity="${R(.22,.65).toFixed(2)}"`);
   }
   for(let j=1;j<=7;j++)o+=line(u(j/8,.03,.02),u(j/8,.97,.02),'#c7a973',.9,'opacity=".22"');
   for(let k=0;k<=28;k++)o+=line(u(1,k/28,.02),u(1,k/28,R(-.25,-.06)),rng()>.5?'#b99a66':'#5e4631',R(1.3,3.0));
  }
  return o+beam(p(0,-D-over,H+.05),p(0,D+over,H+.05),7)+'</g>';
 }
 const ground=[];
 for(let k=0;k<50;k++){let t=k*Math.PI*2/50,r=1+Math.sin(k*2.65)*.035;ground.push([Math.cos(t)*10.2*r,Math.sin(t)*7.5*r,0]);}
 let content=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="CONQUER Logging Camp ${angle} degrees">
<defs><radialGradient id="ground"><stop stop-color="#95855e" stop-opacity=".89"/><stop offset=".8" stop-color="#73654a" stop-opacity=".72"/><stop offset="1" stop-color="#776648" stop-opacity=".13"/></radialGradient></defs>
<g data-part="terrain">${shape(ground,'url(#ground)','none',0)}</g>
<g data-part="ground-scatter">`;
 for(let i=0;i<135;i++){let x=R(-9.5,9.5),y=R(-6.8,6.8),a=R(.03,.13);content+=line([x,y,.012],[x+a,y+a*.18,.012],rng()>.5?'#bca878':'#454431',R(.65,2.0),`opacity="${R(.12,.38).toFixed(2)}"`);}
 content+='</g>';
 let objects=[];
 const obj=(x,y,type,make)=>objects.push({depth:x*sn+y*cs,type,make});
 obj(4.5,-4.5,'fence',()=>fence([2.6,-5.0],[7.2,-4.0]));
 obj(7.2,-.5,'fence',()=>fence([7.2,-4.0],[7.0,2.2]));
 obj(.2,-2.05,'shelter',shelter);
 obj(-6,0,'rough-logs',()=>log([-8.15,-.5,.16],[-4.7,-1.5,.16],.24)+log([-8.0,-.2,.15],[-4.8,-1.13,.15],.19)+log([-7.4,.65,.14],[-4.3,.29,.14],.16));
 obj(5.9,3.55,'timber-stack',()=>{
  let o='<g data-part="timber-stack">';
  for(let row=0;row<3;row++)for(let i=0;i<4-row;i++){
   let x=4.8+i*.43+row*.19,y=3.1+row*.09,z=.19+row*.34;
   o+=log([x,y,z],[x+.94,y+.63,z],.17);
  }
  return o+'</g>';
 });
 obj(-4.7,3.6,'sawhorse',()=>horse(-4.7,3.6,-.42));
 obj(2.3,4.25,'sawhorse',()=>horse(2.3,4.25,.35));
 for(const [x,y,h,ra] of [[-6.3,5.2,.63,.37],[.65,5.65,.65,.43],[7.5,4.6,.55,.33],[-1.2,2.6,.66,.41],[-7.4,-3.1,.44,.32]])obj(x,y,'chopping-stump',()=>stump(x,y,h,ra));
 obj(.7,5.7,'axe',()=>beam([.65,5.7,.68],[1.12,5.33,1.6],5)+shape([[1.12,5.33,1.55],[1.48,5.33,1.56],[1.53,5.33,1.26],[1.18,5.33,1.28]],'#96988d','#363b3a',1.5));
 obj(4.5,5.2,'kindling',()=>log([4,4.95,.1],[4.8,5.7,.1],.10)+log([4.45,5,.12],[5.2,5.65,.12],.11));
 objects.sort((a,b)=>a.depth-b.depth);
 for(const o of objects)content+=`<g data-scene="${o.type}">${o.make()}</g>`;
 return content+'</svg>';
};
export {render};
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href) {
 const fs=await import('node:fs'),path=await import('node:path');
 const dir=path.join(process.cwd(),'src/assets/economy/logging_camp_rotations');
 fs.mkdirSync(dir,{recursive:true});
 for(let d=0;d<360;d+=15)fs.writeFileSync(path.join(dir,'logging_camp_'+String(d).padStart(3,'0')+'.svg'),render(d));
 console.log('Generated 24 SVG viewpoints.');
}
