'use strict';
// CONQUER asset stage (Asset Lab sandbox only, index.html?assetlab=1): puts one structure of the
// destruction gallery's variant list alone on flat ground, in one of its states — intact, under
// construction, a damage phase of ConquerSiege, cutaway — and captures what the game draws, with the
// ground removed (pixels that differ from the same view without the structure). The Asset Lab uses
// these captures as its audit images: they are the game's own render path, nothing re-drawn.
(function(){
  if(!window.__CONQUER_ASSET_LAB__)return;
  const SP=()=>window.ConquerSiegePreview;
  const BUILD_STEPS=[.25,.5,.75],FROZEN_MS=600000;
  let spot=null;
  const slug=s=>s.toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function flatSpot(){
    for(let x=60;x<=150;x+=10)for(let y=40;y<=150;y+=10){
      let ok=true;
      for(let dx=-7;dx<=7&&ok;dx+=1.5)for(let dy=-7;dy<=7&&ok;dy+=1.5)if(Math.abs(terrainElevation({x:x+dx,y:y+dy}))>.001)ok=false;
      if(ok)return{x,y};
    }
    return{x:100,y:100};
  }
  // Every variant of the gallery (wood ones too: the 2.5D path draws them) plus a built section.
  function variants(){
    const G=SP().GALLERY;
    return[...G.towers.map(r=>['Torri',r]),...G.walls.map(r=>['Mura',r]),
      ['Mura',['Sezione costruita T2',{type:'built',tier:2,level:1}]],...G.gates.map(r=>['Porte',r])]
      .map(([family,[label,spec]])=>({id:slug(label),label,family,spec}));
  }
  function find(id){const v=variants().find(x=>x.id===id);if(!v)throw new Error('asset stage: unknown variant '+id);return v}
  function states(id){
    const {spec}=find(id),s=SP().galleryStructure(spec,0,0);
    const out=[{id:'intact',label:'Nel gioco',group:'intatto'}];
    for(const p of BUILD_STEPS)out.push({id:'build-'+Math.round(p*100),label:'Cantiere '+Math.round(p*100)+'%',group:'costruzione',progress:p});
    for(const [phase] of SP().galleryPhases(spec).slice(1))out.push({id:'damage-'+slug(phase),label:phase,group:'danno',phase});
    if(cutawayEligible(s))out.push({id:'cutaway',label:'Cutaway',group:'cutaway'});
    return out;
  }
  // Fixed light, weather and clock: two captures of the same state are comparable.
  function steady(rotation,scale){
    State.clock.speed=0;State.clock.day=10.5;State.daylightOverride='day';State.weatherOverride='sun';
    State.view.rotation=((rotation%4)+4)%4;State.view.scale=scale;
    const wrap=document.getElementById('wrap').getBoundingClientRect(),p=w2s(spot,0);
    State.view.x+=wrap.width/2-p.x;State.view.y+=wrap.height*.68-p.y;
  }
  // The structure stands alone: no other structures, ruins, trees or rocks around it.
  // restore() also drops the collapse/heap caches: ruin ids repeat between captures (same day).
  // Trees and rocks go once for good (this frame is only a stage): the landscape layer is then baked
  // once and every capture only rebuilds the layers that depend on structures.
  let staged=false;
  function clear(){
    if(!staged){staged=true;State.environment=[];invalidateSceneCache()}
    State.structures=[];window.ConquerSiege?.restore({...(State.siege||{}),ruins:[]});
  }
  // Returns the structure as the game now holds it (damage can turn it into a ruined stump).
  function apply(spec,state,id){
    // A fixed id: collapse seeds (and so the rubble heaps) derive from it.
    const s={...SP().galleryStructure(spec,spot.x,spot.y),id:'assetlab-'+id};State.structures.push(s);
    if(state.progress!=null){
      // 10 days of work around the fixed clock, so progress is exactly the one asked for.
      s.construction={startedDay:State.clock.day-state.progress*10,completeDay:State.clock.day+(1-state.progress)*10};
    }
    if(state.phase){
      const phase=SP().galleryPhases(spec).find(([p])=>p===state.phase);
      const realDraw=draw;draw=()=>{};
      try{phase[1](s)}finally{draw=realDraw}
      // Settled rubble, as a saved game reloads it, not the blocks still falling.
      window.ConquerSiege?.restore(JSON.parse(JSON.stringify(State.siege)));
    }
    if(state.id==='cutaway')s.cutaway=true;
    return State.structures.find(x=>x.id===s.id)||State.structures[0]||null;
  }
  const STRUCTURE_LAYERS=['ground','shadow','base','castleBody','castleFront'];
  function frame(){
    invalidateSceneCache(STRUCTURE_LAYERS);window.ConquerWallWalk?.invalidate?.();draw();
    const c=document.getElementById('c');
    return c.getContext('2d').getImageData(0,0,c.width,c.height);
  }
  function summary(s){
    if(!s)return{present:false};
    const st=window.ConquerSiege?.integrity?.(s);
    return{present:true,type:s.type,material:s.material||'stone',level:s.level??null,tier:s.tier??null,
      progress:+constructionProgress(s).toFixed(3),cutaway:structureCutaway(s),ruined:!!(s.ruined||s.ruin),
      hp:st?.core?+(st.core.hp/st.core.max).toFixed(3):null,door:st?.door?+(st.door.hp/st.door.max).toFixed(3):null};
  }
  // capture(id, stateId, {rotation 0..3, scale}) -> {dataUrl, width, height, coverage, structure}
  function capture(id,stateId='intact',{rotation=0,scale=4}={}){
    const v=find(id),state=states(id).find(x=>x.id===stateId);
    if(!state)throw new Error('asset stage: '+id+' has no state '+stateId);
    spot=spot||flatSpot();
    const keep=State.structures;
    // Flags, torches, guards and builders animate on performance.now(): one frozen instant makes two
    // captures of the same state identical. The real clock still times the capture itself.
    const realNow=performance.now.bind(performance);
    performance.now=()=>FROZEN_MS;
    // Breaches split a wall into new segments with uid() (crypto.randomUUID): counted ids keep their
    // rubble seeds stable too.
    let serial=0;crypto.randomUUID=()=>'assetlab-'+id+'-'+(serial++);
    try{
      const t=[realNow()],lap=()=>t.push(realNow());
      clear();steady(rotation,scale);lap();
      // The empty view right before the full one: same caches, same frame of the clock.
      frame();const empty=frame();lap();
      const s=apply(v.spec,state,id);lap();const full=frame();lap();
      const W=full.width,H=full.height,a=full.data,b=empty.data,mask=new Uint8Array(W*H);
      for(let i=0,p=0;p<W*H;p++,i+=4)
        if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>30)mask[p]=1;
      // Background is what is unchanged AND reachable from the frame edge: a crack or a door the
      // colour of the grass inside the silhouette stays part of the structure.
      const bg=new Uint8Array(W*H),queue=new Int32Array(W*H);let qh=0,qt=0;
      const seed=p=>{if(!mask[p]&&!bg[p]){bg[p]=1;queue[qt++]=p}};
      for(let x=0;x<W;x++){seed(x);seed((H-1)*W+x)}
      for(let y=0;y<H;y++){seed(y*W);seed(y*W+W-1)}
      while(qh<qt){
        const p=queue[qh++],x=p%W;
        if(x>0)seed(p-1);if(x<W-1)seed(p+1);if(p>=W)seed(p-W);if(p<W*(H-1))seed(p+W);
      }
      let x0=W,y0=H,x1=-1,y1=-1,n=0;
      for(let p=0;p<W*H;p++){
        if(bg[p])continue;
        mask[p]=1;n++;const x=p%W,y=(p/W)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      }
      const result={id,state:stateId,label:v.label,family:v.family,structure:summary(s),coverage:n/(W*H)};
      if(x1<0)return{...result,dataUrl:null,width:0,height:0};
      const pad=6;x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(W-1,x1+pad);y1=Math.min(H-1,y1+pad);
      const w=x1-x0+1,h=y1-y0+1,out=document.createElement('canvas');out.width=w;out.height=h;
      const og=out.getContext('2d'),img=og.createImageData(w,h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const p=(y+y0)*W+x+x0,o=(y*w+x)*4,i=p*4;
        if(!mask[p])continue;
        img.data[o]=a[i];img.data[o+1]=a[i+1];img.data[o+2]=a[i+2];img.data[o+3]=255;
      }
      og.putImageData(img,0,0);lap();
      const dataUrl=out.toDataURL('image/png');lap();
      // Diagnostics: ms spent clearing, on the empty view, staging the state, the full view, masking, encoding.
      const ms=t.slice(1).map((v,i)=>Math.round(v-t[i]));
      // origin: where the crop sits in the stage view, so two states can be compared pixel by pixel.
      return{...result,dataUrl,width:w,height:h,origin:[x0,y0],ms:{clear:ms[0],empty:ms[1],stage:ms[2],full:ms[3],mask:ms[4],encode:ms[5]}};
    }finally{
      delete performance.now;delete crypto.randomUUID;
      State.structures=keep;window.ConquerSiege?.restore({...(State.siege||{}),ruins:[]});invalidateSceneCache(STRUCTURE_LAYERS);
    }
  }
  window.ConquerAssetStage={variants,states,capture};
})();
