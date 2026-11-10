'use strict';
// Regional composition in the real environment format: rendering and collision share polygons.
(()=>{
  const rules=window.ConquerRegionalBiomeRules;
  const neighbors=()=>window.__CONQUER_REGIONAL_DEMO__?.surroundingBiomes;
  // Uniform mountains still need explicit placement in every surrounding sector.
  // The legacy recipe only occupies a short perimeter arc of the whole map.
  const active=()=>!!rules&&Object.keys(rules.directions).every(k=>BIOMES[neighbors()?.[k]])&&(State.biome==='mountains'||Object.values(neighbors()).some(b=>b!==State.biome));
  const field=p=>rules.weights(p,'@center',neighbors());
  const weights=p=>rules.weights(p,State.biome,neighbors());
  const hash=(x,y,s)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^s;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295};
  function noise(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy,u=a*a*(3-2*a),v=b*b*(3-2*b);return(hash(ix,iy,s)*(1-u)+hash(ix+1,iy,s)*u)*(1-v)+(hash(ix,iy+1,s)*(1-u)+hash(ix+1,iy+1,s)*u)*v}
  const signature=()=>biomeHash(State.biome+'|'+JSON.stringify(neighbors()));
  const seaSides=()=>['north','east','south','west'].filter(side=>neighbors()?.[side]==='sea');
  function coastShape(){
    const sides=seaSides(),count=sides.length;
    const corner=count===2?[
      ['north','east',160,40],['east','south',160,160],
      ['south','west',40,160],['west','north',40,40]
    ].find(([a,b])=>sides.includes(a)&&sides.includes(b)):null;
    return{kind:count===4?'island':count===3?'peninsula':corner?'headland':count?'gulf':'none',sides,corner:corner?{x:corner[2],y:corner[3]}:null};
  }
  function coastThreshold(p,shape=coastShape()){
    if(!shape.sides.length)return .5;
    const phase=hash(7,11,State.seed)*Math.PI*2;
    let total=0,weight=0;
    for(const side of shape.sides){
      const t=(side==='north'||side==='south'?p.x:p.y)/200;
      const d=side==='north'?p.y:side==='south'?200-p.y:side==='west'?p.x:200-p.x;
      const influence=Math.exp(-Math.pow((d-38)/30,2));
      // Two broad bays per front, with a seed-dependent position and unequal lobes.
      const bays=.5+.29*Math.cos(t*Math.PI*4+phase)+.07*Math.sin(t*Math.PI*2-phase);
      total+=bays*influence;weight+=influence;
    }
    let threshold=weight?total/weight:.5;
    if(shape.corner)threshold+=.46*Math.exp(-((p.x-shape.corner.x)**2+(p.y-shape.corner.y)**2)/300);
    if(shape.kind==='island'||shape.kind==='peninsula'){
      // Round the land corners instead of tracing a square island/peninsula.
      const ax=Math.abs(p.x-100),ay=Math.abs(p.y-100);
      threshold-=.26*Math.max(0,Math.min(1,(Math.min(ax,ay)-42)/25));
    }
    return Math.max(.12,Math.min(.94,threshold));
  }
  const area=r=>r.reduce((s,p,i)=>s+p.x*r[(i+1)%r.length].y-r[(i+1)%r.length].x*p.y,0)/2;
  function rings(mask,n=100){
    const edges=new Map(),step=200/n;
    const add=(x,y,xx,yy,d)=>{const k=x+','+y;if(!edges.has(k))edges.set(k,[]);edges.get(k).push({x:xx,y:yy,d})};
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(mask[y*n+x]){
      if(!y||!mask[(y-1)*n+x])add(x,y,x+1,y,0);
      if(x===n-1||!mask[y*n+x+1])add(x+1,y,x+1,y+1,1);
      if(y===n-1||!mask[(y+1)*n+x])add(x+1,y+1,x,y+1,2);
      if(!x||!mask[y*n+x-1])add(x,y+1,x,y,3);
    }
    const out=[];
    while(edges.size){
      const first=edges.keys().next().value,[sx,sy]=first.split(',').map(Number),ring=[];let x=sx,y=sy,dir=0,guard=0;
      do{
        ring.push({x:x*step,y:y*step});const key=x+','+y,list=edges.get(key);
        if(!list?.length)throw Error('Open regional mask contour');
        const order=[(dir+1)%4,dir,(dir+3)%4,(dir+2)%4];
        let index=0;for(const d of order){const j=list.findIndex(e=>e.d===d);if(j>=0){index=j;break}}
        const e=list.splice(index,1)[0];if(!list.length)edges.delete(key);x=e.x;y=e.y;dir=e.d;
        if(++guard>n*n*4+4)throw Error('Invalid regional contour');
      }while(x!==sx||y!==sy);
      const simple=ring.filter((p,i)=>{const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];return(a.x-p.x)*(b.y-p.y)!==(a.y-p.y)*(b.x-p.x)});
      if(simple.length<3||Math.abs(area(simple))<step*step*.5)continue;
      // Smooth grid corners without moving points off the world boundary.
      out.push(simple.map((p,i)=>{if(p.x===0||p.y===0||p.x===200||p.y===200)return p;const a=simple[(i+simple.length-1)%simple.length],b=simple[(i+1)%simple.length];return{x:(a.x+6*p.x+b.x)/8,y:(a.y+6*p.y+b.y)/8}}));
    }
    return out;
  }
  function features(mask,type,prefix){
    const all=rings(mask),outers=all.filter(r=>area(r)>0),holes=all.filter(r=>area(r)<0);
    return outers.map((points,i)=>{
      const b=environmentPolygonBounds(points),ownHoles=holes.filter(h=>pointInPolygon(h[0],points)&&!outers.some(o=>o!==points&&Math.abs(area(o))<Math.abs(area(points))&&pointInPolygon(h[0],o)));
      const forest=type==='forest';
      return{id:prefix+'-'+i,type,points,holes:ownHoles,continuous:forest,clearings:ownHoles.length,
        x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,rx:(b.maxX-b.minX)/2,ry:(b.maxY-b.minY)/2,
        fill:forest?'#2e3c1d':'#3f7f8a',edge:forest?'#5c7438':'#8ab9bd',regional:true};
    });
  }
  function adjustRelief(){
    if(!active()||State.relief.regionalAdjusted)return;
    // The central recipe is fitted to its own 100U square; height levels remain real terraces.
    for(const hill of State.relief.hills){
      if(hill.center)hill.center={x:50+hill.center.x/2,y:50+hill.center.y/2};
      hill.rx/=2;hill.ry/=2;
      for(const level of hill.levels){level.center={x:50+level.center.x/2,y:50+level.center.y/2};level.top=level.top.map(p=>({x:50+p.x/2,y:50+p.y/2}));}
    }
    const rnd=seedRand((State.seed^signature()^0x39f71a)>>>0);let index=State.relief.hills.length;
    for(let y=13;y<200;y+=25)for(let x=13;x<200;x+=25){
      const p={x:x+(rnd()-.5)*5,y:y+(rnd()-.5)*5},w=weights(p),biome=Object.keys(w).sort((a,b)=>w[b]-w[a])[0];
      if(p.x>=50&&p.x<=150&&p.y>=50&&p.y<=150||!['hills','mountains','valley'].includes(biome)||w[biome]<.7)continue;
      if(rnd()>.45)continue;
      const hill=makeProceduralHill(rnd,index++,{center:p,rx:7+rnd()*3,ry:6+rnd()*2,maxHeight:1});
      const foot=reliefHillFootprint(hill);
      if(foot.some(q=>q.x<0||q.y<0||q.x>200||q.y>200||(weights(q)[biome]||0)<.08)||!hillSpacingOk(hill,State.relief.hills))continue;
      State.relief.hills.push(hill);
    }
    State.relief.regionalAdjusted=true;clearReliefBandCache();
  }
  function compose(base){
    if(!active())return base;
    const key=State.seed+'-'+signature(),rnd=seedRand((State.seed^signature()^0x18405c)>>>0),coast=coastShape();
    const forests=base.filter(f=>f.type==='forest'),centralSea=base.filter(f=>f.type==='sea'),centralPonds=base.filter(f=>f.type==='pond');
    const lines=base.filter(f=>f.type==='river'||f.type==='stream');
    const mountains=base.filter(f=>f.type==='mountain').map(f=>({...f,id:'regional-center-'+f.id,
      x:50+f.x/2,y:50+f.y/2,rx:f.rx/2,ry:f.ry/2,height:f.height/2,
      unclippedPoints:(f.unclippedPoints||f.points).map(p=>({x:50+p.x/2,y:50+p.y/2})),points:f.points.map(p=>({x:50+p.x/2,y:50+p.y/2}))}));
    const n=100,seaMask=new Uint8Array(n*n),pondMask=new Uint8Array(n*n),forestMask=new Uint8Array(n*n);
    const samples=[];
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const p={x:(x+.5)*2,y:(y+.5)*2},w=field(p),c=w['@center']||0;
      const sea=(w.sea||0)+c*(centralSea.some(f=>environmentContains(f,p))?1:0);
      const pond=(w.lake||0)+c*(centralPonds.some(f=>environmentContains(f,p))?1:0)+(w.swamp||0)*(noise(p.x/12,p.y/12,State.seed+51)>.72?1:0);
      const threshold=sea>=pond?coastThreshold(p,coast):.5;
      const wet=sea+pond>threshold+(noise(p.x/18,p.y/18,State.seed+23)-.5)*.08;
      if(wet)(sea>=pond?seaMask:pondMask)[y*n+x]=1;
      samples.push({p,w,c,wet});
    }
    const waters=[...features(seaMask,'sea','regional-sea-'+key),...features(pondMask,'pond','regional-lake-'+key)];
    for(const pond of waters.filter(f=>f.type==='pond'))pond.waterBodyKind=samples.some(s=>((s.w.lake||0)>.5||State.biome==='lake'&&s.c>.5)&&environmentContains(pond,s.p))?'lake':'pond';
    // Publish the longest actual shore for existing coast tools; never join separate shores.
    for(const sea of waters.filter(f=>f.type==='sea')){
      const runs=[];
      for(const ring of [sea.points,...sea.holes]){
        const borderEdge=(a,b)=>(a.x===b.x&&(a.x===0||a.x===200))||(a.y===b.y&&(a.y===0||a.y===200));
        const start=ring.findIndex((p,i)=>borderEdge(p,ring[(i+1)%ring.length]));
        if(start<0){runs.push([...ring,ring[0]]);continue;}
        let run=[];
        for(let j=1;j<=ring.length;j++){
          const a=ring[(start+j)%ring.length],b=ring[(start+j+1)%ring.length];
          if(borderEdge(a,b)){if(run.length>1)runs.push(run);run=[];}
          else{if(!run.length)run.push(a);run.push(b);}
        }
        if(run.length>1)runs.push(run);
      }
      const length=r=>r.reduce((s,p,i)=>i?s+Math.hypot(p.x-r[i-1].x,p.y-r[i-1].y):s,0);
      sea.coastlines=runs.sort((a,b)=>length(b)-length(a));
      sea.coastline=sea.coastlines[0]||[];
      sea.side=['north','east','south','west'].sort((a,b)=>{
        const score=side=>Array.from({length:20},(_,i)=>edgeSample(side,(i+.5)/20)).filter(p=>environmentContains(sea,{x:Math.max(1,Math.min(199,p.x)),y:Math.max(1,Math.min(199,p.y))})).length;
        return score(b)-score(a);
      })[0];
    }
    const blocked=p=>waters.some(f=>environmentContains(f,p))||lines.some(f=>environmentContains(f,p,1.5));
    if(coast.corner){
      // Low, real rock outcrops on the dry tip; shared mountain polygons block building.
      const tip=coast.corner;
      for(let i=0;i<5;i++){
        const p={x:tip.x+(rnd()-.5)*9,y:tip.y+(rnd()-.5)*9};
        const rock=makeEnvBlob(rnd,'mountain',p.x,p.y,2+rnd()*2,2+rnd()*2,'#645e50','#a59b85',12,.08);
        if(blocked(p)||rock.points.some(blocked))continue;
        rock.id='regional-headland-'+key+'-'+i;rock.height=2+rnd()*3;rock.slopeDeg=45;rock.coastalRock=true;mountains.push(rock);
      }
    }
    // Real peaks in the neighbouring mountain sectors. They never intrude into the central biome.
    const regionalPeaks=[];
    for(let y=12;y<200;y+=22)for(let x=12;x<200;x+=22){
      const p={x:(x<20?6:x>180?194:x)+(rnd()-.5)*5,y:(y<20?6:y>180?194:y)+(rnd()-.5)*5},w=weights(p);
      if(p.x>=50&&p.x<=150&&p.y>=50&&p.y<=150||(w.mountains||0)<.65||blocked(p))continue;
      const peak=makeEnvBlob(rnd,'mountain',p.x,p.y,7+rnd()*4,7+rnd()*4,'#56493c','#968470',18,.1);
      peak.unclippedPoints=peak.points;
      peak.points=clipTerrainPolygon(peak.points).map(q=>({x:q.x,y:q.y}));
      if(peak.points.length<3||peak.points.some(q=>(weights(q).mountains||0)<.08||blocked(q)))continue;
      peak.id='regional-peak-'+key+'-'+mountains.length;peak.slopeDeg=37+rnd()*26;peak.height=Math.sqrt(peak.rx*peak.ry)*Math.tan(peak.slopeDeg*Math.PI/180);mountains.push(peak);regionalPeaks.push(peak);
    }
    for(const peak of regionalPeaks){
      const pairRnd=seedRand((State.seed^biomeHash(peak.id+':pair'))>>>0),a=pairRnd()*Math.PI*2;
      // Separate summits with intersecting flanks; try different bearings to keep
      // water and the central biome clear. A nested footprint is the tight-space fallback.
      let twin=null;
      for(let j=0;j<8;j++){
        const angle=a+j*Math.PI/4,distance=6+pairRnd()*9,dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance;
        const p={x:peak.x+dx,y:peak.y+dy};
        if(p.x<0||p.x>200||p.y<0||p.y>200||p.x>=50&&p.x<=150&&p.y>=50&&p.y<=150||blocked(p)||(weights(p).mountains||0)<.5)continue;
        const size=.78+pairRnd()*.38;
        const outline=makeEnvBlob(pairRnd,'mountain',p.x,p.y,peak.rx*size,peak.ry*(.8+pairRnd()*.35),'#56493c','#968470',18,.1);
        const raw=outline.points;
        const points=clipTerrainPolygon(raw).map(q=>({x:q.x,y:q.y}));
        if(points.length<3||!polygonsOverlapSimple(points,peak.points)||points.some(q=>blocked(q)||(weights(q).mountains||0)<.08))continue;
        twin={...peak,x:p.x,y:p.y,rx:outline.rx,ry:outline.ry,unclippedPoints:raw,points};break;
      }
      if(!twin){
        const raw=peak.unclippedPoints.map(p=>({x:peak.x+(p.x-peak.x)*.98,y:peak.y+(p.y-peak.y)*.98}));
        twin={...peak,x:clamp(peak.x+Math.cos(a)*4,.1,199.9),y:clamp(peak.y+Math.sin(a)*4,.1,199.9),unclippedPoints:raw,points:clipTerrainPolygon(raw).map(p=>({x:p.x,y:p.y}))};
      }
      twin.id=peak.id+'-pair';twin.slopeDeg=37+pairRnd()*26;twin.height=Math.sqrt(twin.rx*twin.ry)*Math.tan(twin.slopeDeg*Math.PI/180);
      mountains.push(twin);
    }
    const dryMountains=mountains.filter(f=>!blocked({x:f.x,y:f.y})&&!f.points.some(blocked));
    State.relief.hills=State.relief.hills.filter(h=>!reliefHillFootprint(h).some(blocked));clearReliefBandCache();
    for(let i=0;i<samples.length;i++){
      const {p,w,c,wet}=samples[i];if(wet||lines.some(f=>environmentContains(f,p,2))||dryMountains.some(f=>environmentContains(f,p))||terrainSlopeKind(p)==='steep')continue;
      const density=c*(forests.some(f=>environmentContains(f,p))?1:0)+(w.forest||0)*.82+(w.swamp||0)*.34;
      if(density>noise(p.x/9,p.y/9,State.seed+91))forestMask[i]=1;
    }
    if(typeof clearForestLayoutCache==='function')clearForestLayoutCache();
    State.relief.stats=reliefStats();
    // Seas paint after rivers, so submerged downstream segments disappear into their receiving water.
    return[...lines,...waters,...features(forestMask,'forest','regional-forest-'+key),...dryMountains];
  }
  let groundCache=null;
  function drawGround(){
    if(!active()||State.season==='winter')return;
    const key=State.seed+'|'+State.biome+'|'+JSON.stringify(neighbors());
    if(groundCache?.key!==key){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const g=canvas.getContext('2d'),img=g.createImageData(256,256);
      const colors=Object.fromEntries(Object.entries(BIOMES).map(([b,v])=>[b,[1,3,5].map(i=>parseInt(v.field.slice(i,i+2),16))]));
      for(let y=0;y<256;y++)for(let x=0;x<256;x++){
        const w=weights({x:(x+.5)*200/256,y:(y+.5)*200/256}),i=(y*256+x)*4;
        for(let k=0;k<3;k++)img.data[i+k]=Object.entries(w).reduce((s,[b,v])=>s+colors[b][k]*v,0);img.data[i+3]=255;
      }
      g.putImageData(img,0,0);groundCache={key,canvas};
    }
    const a=w2sRaw({x:0,y:0},0),b=w2sRaw({x:200,y:0},0),d=w2sRaw({x:0,y:200},0);
    ctx.save();ctx.transform((b.x-a.x)/256,(b.y-a.y)/256,(d.x-a.x)/256,(d.y-a.y)/256,a.x,a.y);ctx.drawImage(groundCache.canvas,0,0);ctx.restore();
  }
  window.ConquerRegionalLandscape={active,weights,adjustRelief,compose,drawGround,rings,coastShape,coastThreshold};
})();
