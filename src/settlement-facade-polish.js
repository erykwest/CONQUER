'use strict';
// Facade polish layer: keeps PNG architecture assets, but fixes night emissive,
// arcade readability and scale on compact stone towers.

const facadeEmissiveCache=new WeakMap();

function facadeEmissiveMask(img){
  if(!img)return null;
  let cached=facadeEmissiveCache.get(img);if(cached)return cached;
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  const d=g.getImageData(0,0,c.width,c.height),p=d.data;
  for(let i=0;i<p.length;i+=4){
    const r=p[i],gg=p[i+1],b=p[i+2],a=p[i+3],mx=Math.max(r,gg,b);
    // Only the dark bluish glass/opening pixels emit. Stone, white trim and
    // black outlines remain in the night-darkened base pass.
    const mn=Math.min(r,gg,b),chroma=mx-mn;
    const glass=a>20&&mx<132&&b>58&&b-r>12&&gg-r>5&&b>=gg-2&&chroma>10&&r<98;
    if(glass){p[i]=255;p[i+1]=188;p[i+2]=92;p[i+3]=Math.min(220,Math.round(a*.82))}
    else p[i+3]=0;
  }
  g.putImageData(d,0,0);facadeEmissiveCache.set(img,c);return c;
}

drawArchitectureAssetOnEdge=function(edge,centerZ,width,height,key,offsetWorld=0,lit=false,nf=1){
  const img=architectureSprite(key);if(!img)return false;
  const span=facadeAssetWorldSpan(edge,width,offsetWorld),z0=centerZ-height/2,z1=centerZ+height/2;
  const lt=w2s(span.a,z1),rt=w2s(span.b,z1),lb=w2s(span.a,z0),iw=img.width,ih=img.height;
  ctx.save();
  ctx.transform((rt.x-lt.x)/iw,(rt.y-lt.y)/iw,(lb.x-lt.x)/ih,(lb.y-lt.y)/ih,lt.x,lt.y);
  ctx.imageSmoothingEnabled=true;ctx.drawImage(img,0,0);
  if(lit&&/^gothicL[123]$/.test(key)){
    const glow=facadeEmissiveMask(img);
    if(glow){
      ctx.globalCompositeOperation='screen';
      ctx.globalAlpha=Math.min(.72,.24+.42*nf);
      ctx.shadowColor='rgba(255,176,72,'+Math.min(.62,.20+.36*nf)+')';
      ctx.shadowBlur=5;
      ctx.drawImage(glow,0,0);
    }
  }
  ctx.restore();return true;
};

gothicAssetSizeForLevel=function(s){
  const l=structureLevel(s),base=l>=3?{w:.82,h:.84}:l>=2?{w:.68,h:.78}:{w:.54,h:.70};
  if(s?.type!=='tower')return base;
  const t=clamp(towerTier(s),1,3),scale=t===1?.56:t===2?.76:.94;
  return{w:base.w*scale,h:base.h*scale};
};

function punchBuiltArcadeOpenings(edge,count,h){
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const cell=edge.length/count,baseZ=.025,springZ=.04+h*.56,apexZ=.04+h*.93;
  ctx.save();
  ctx.globalCompositeOperation='destination-out';
  ctx.fillStyle='#000';
  for(let i=0;i<count;i++){
    const along=(i+.5)*cell,half=cell*.30;
    const c={x:edge.a.x+ux*along,y:edge.a.y+uy*along};
    const l={x:c.x-ux*half,y:c.y-uy*half},r={x:c.x+ux*half,y:c.y+uy*half};
    const lb=w2s(l,baseZ),rb=w2s(r,baseZ),ls=w2s(l,springZ),rs=w2s(r,springZ),ap=w2s(c,apexZ);
    ctx.beginPath();
    ctx.moveTo(lb.x,lb.y);ctx.lineTo(rb.x,rb.y);ctx.lineTo(rs.x,rs.y);
    ctx.quadraticCurveTo(rs.x+(ap.x-rs.x)*.54,rs.y+(ap.y-rs.y)*.36,ap.x,ap.y);
    ctx.quadraticCurveTo(ls.x+(ap.x-ls.x)*.54,ls.y+(ap.y-ls.y)*.36,ls.x,ls.y);
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

drawBuiltArcade=function(s){
  if(!s||s.type!=='built'||underConstruction(s))return;
  const inside=-wallExteriorSide(s);if(inside!==linearFrontSide(s))return;
  const edge=linearFacadeEdge(s,inside),h=Math.min(1.18,structureHeight(s)-.22);
  if(h<=.18||edge.length<.35)return;
  const key=edge.length<2.35?'arcade2':'arcade3',count=key==='arcade2'?2:3,centerZ=.04+h/2;
  // The portico is a real opening in the castle-body cache: cut the masonry
  // first, then draw only the stone arcade frame on top.
  punchBuiltArcadeOpenings(edge,count,h);
  drawArchitectureAssetOnEdge(edge,centerZ,edge.length*.94,h,key,0,false,1);
};

if(typeof clearStructureCompositeCache==='function')clearStructureCompositeCache();
if(typeof invalidateSceneCache==='function')invalidateSceneCache();
