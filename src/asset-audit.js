/* CONQUER Asset Lab audit engine: the Lab checks what it shows.
 * Every catalogue entry is rendered with the Lab's own renderers (src/asset-catalog.js), fortifications in
 * every engine state (ConquerAssetStage: as drawn in the game, construction, damage phases, cutaway).
 * Each render gets automatic checks and a coarse visual signature; signatures are compared with the
 * reviewed baseline (qa/asset-audit-baseline.json), so a new or changed asset is flagged for review.
 *   ConquerAssetAudit.catalog()                      entries and their states
 *   ConquerAssetAudit.inspect(id, state, {rotation}) one render: image, metrics, checks
 *   ConquerAssetAudit.run({ids, category, states})   full report (also drives the Audit panel)
 *   ConquerAssetAudit.sheet({ids|category|family, states}) contact sheet (PNG data URL)
 *   ConquerAssetAudit.baseline(report)               baseline JSON to commit after a review
 * Driven headless by qa/asset-audit.mjs, or from the browser console / the Audit button.
 */
(function(){
  'use strict';
  const C=()=>window.ConquerAssetCatalog,L=()=>window.ConquerAssetCatalog.lab;
  const byId=id=>document.getElementById(id);
  // Signature distances: CHANGED vs the baseline (captures are deterministic: the gate drapes of #76
  // measure 0.016); SAME = identical render; PROGRESS = construction steps that move.
  const SIG=12,CHANGED=.01,SAME=.002,PROGRESS=.01;
  const BASELINE_URL='./qa/asset-audit-baseline.json';
  let baselineCache=null;

  const find=id=>{const item=C().items.find(x=>x.id===id);if(!item)throw new Error('audit: unknown asset '+id);return item};
  const statesOf=item=>item.states?item.states.map(s=>s.id):[null];
  function catalog(){
    return C().items.map(x=>({id:x.id,title:x.title,category:x.category,family:x.family,kind:x.kind,format:x.format,
      source:x.source,states:x.states?x.states.map(s=>({id:s.id,label:s.label,group:s.group})):null}));
  }

  // ---------- rendering through the Lab ----------
  const loaded=el=>el.tagName!=='IMG'||el.complete&&el.naturalWidth?Promise.resolve(el):
    new Promise(res=>{el.addEventListener('load',()=>res(el),{once:true});el.addEventListener('error',()=>res(el),{once:true})});
  async function svgImage(svg){
    const im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
    await loaded(im);return im;
  }
  // -> {el: canvas|img, source}
  async function render(item,state,rotation=0){
    const box=document.createElement('div');
    L().makePreview(item,box,true,rotation,state);
    const el=box.querySelector('canvas,img,svg');
    if(!el)return{el:null,source:'none',note:box.textContent};
    if(el.tagName.toLowerCase()==='svg')return{el:await svgImage(el),source:'symbol'};
    await loaded(el);
    const source=item.kind==='castle'?(state==='3d'?'mesh':'capture'):item.kind==='file'?'file':
      item.kind==='figure'?'figure':item.kind==='schematic'?'schema':'mesh';
    return{el,source};
  }
  function pixels(el){
    const w=el.naturalWidth||el.width,h=el.naturalHeight||el.height;
    if(!w||!h)return null;
    const k=Math.min(1,512/Math.max(w,h)),cw=Math.max(1,Math.round(w*k)),ch=Math.max(1,Math.round(h*k));
    const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;
    const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(el,0,0,cw,ch);
    return{data:g.getImageData(0,0,cw,ch).data,w:cw,h:ch,full:{w,h}};
  }
  // Coverage, bounding box and a SIGxSIG grid of alpha-weighted luminance (0..1) over the drawn bbox.
  function metrics(el){
    const px=pixels(el);if(!px)return{coverage:0,signature:null,width:0,height:0};
    const {data,w,h}=px;let n=0,x0=w,y0=h,x1=-1,y1=-1;
    for(let p=0;p<w*h;p++)if(data[p*4+3]>8){n++;const x=p%w,y=(p/w)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    if(!n)return{coverage:0,signature:null,width:px.full.w,height:px.full.h};
    const sig=new Array(SIG*SIG).fill(0),cnt=new Array(SIG*SIG).fill(0),bw=x1-x0+1,bh=y1-y0+1;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const i=(y*w+x)*4,a=data[i+3]/255,cell=Math.min(SIG-1,((y-y0)*SIG/bh)|0)*SIG+Math.min(SIG-1,((x-x0)*SIG/bw)|0);
      sig[cell]+=a*(.299*data[i]+.587*data[i+1]+.114*data[i+2])/255;cnt[cell]++;
    }
    return{coverage:+(n/(w*h)).toFixed(4),aspect:+(bw/bh).toFixed(3),width:px.full.w,height:px.full.h,
      signature:sig.map((v,i)=>+(cnt[i]?v/cnt[i]:0).toFixed(3))};
  }
  const distance=(a,b)=>{
    if(!a||!b||a.length!==b.length)return 1;
    let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]);return d/a.length;
  };

  // ---------- checks ----------
  const check=(name,ok,level='fail',detail='')=>({name,ok:!!ok,level,detail:String(detail)});
  function meshChecks(item){
    const m=L().modelMesh(item);
    if(!m)return[check('mesh-presente',false,'fail','nessuna mesh')];
    let finite=true,top=0;for(let i=0;i<m.pos.length;i++){if(!Number.isFinite(m.pos[i]))finite=false;if(i%3===2)top=Math.max(top,m.pos[i])}
    return[check('mesh-presente',m.col.length>0,'fail',m.col.length+' triangoli'),check('mesh-finita',finite,'fail'),
      check('mesh-altezza',top>0,'fail','h '+top.toFixed(2)+' U')];
  }
  async function fileChecks(item){
    const out=[];
    if(item.rotations){
      let bad=[];
      for(const f of item.rotations){const im=new Image();im.src='./'+f.file;await loaded(im);if(!im.naturalWidth)bad.push(f.deg)}
      out.push(check('fotogrammi-rotazione',!bad.length,'fail',item.rotations.length+' fotogrammi'+(bad.length?', mancanti: '+bad.join(','):'')));
    }
    return out;
  }
  function stateChecks(item,state,structure,intact){
    const st=item.states.find(s=>s.id===state)||{},out=[];
    if(!structure)return out;
    if(st.group==='costruzione'){
      out.push(check('avanzamento-cantiere',Math.abs(structure.progress-st.progress)<.011,'fail','progress '+structure.progress+' atteso '+st.progress));
    }
    if(st.group==='danno'){
      const m=/crollo (\d)/.exec(st.phase||'');
      if(m&&intact?.level!=null)out.push(check('piani-crollati',structure.level===intact.level-Number(m[1]),'fail',
        'livello '+structure.level+' atteso '+(intact.level-Number(m[1]))));
      if(/distrutt/.test(st.phase||''))out.push(check('distrutta-rovina',!structure.present||structure.type==='ruin','fail',
        structure.present?'tipo '+structure.type:'struttura rimossa, restano macerie'));
      if(/danneggiat/.test(st.phase||'')&&structure.hp!=null)out.push(check('integrita-ridotta',structure.hp<1,'fail','hp '+structure.hp));
      if(/portone/.test(st.phase||''))out.push(check('portone-danneggiato',structure.door==null||structure.door<1,'warn',
        structure.door==null?'integrità portone non esposta':'portone '+structure.door));
    }
    if(st.group==='cutaway')out.push(check('cutaway-attivo',structure.cutaway,'fail'));
    return out;
  }

  // One entry in one state: render + checks (baseline comparison is added by run()).
  async function inspect(id,state,{rotation=0,image=true}={}){
    const item=find(id);
    if(state===undefined||state===null)state=L().defaultState(item);
    const r=await render(item,state,rotation),m=r.el?metrics(r.el):{coverage:0,signature:null};
    const res={id,title:item.title,category:item.category,family:item.family,kind:item.kind,state,rotation,source:r.source,
      coverage:m.coverage,aspect:m.aspect,width:m.width,height:m.height,signature:m.signature,checks:[]};
    res.checks.push(check('visibile',m.coverage>.0005,'fail',r.el?'copertura '+(m.coverage*100).toFixed(2)+'%':(r.note||'nessun render')));
    if(item.kind==='castle'&&state!=='3d'){
      const cap=L().engineCapture(item,state,Math.round(rotation/90)%4);
      res.structure=cap?.structure||null;
      const intact=state==='intact'?res.structure:L().engineCapture(item,'intact',0)?.structure;
      res.checks.push(...stateChecks(item,state,res.structure,intact));
    }
    if(['model','animal'].includes(item.kind)||item.kind==='castle'&&state==='3d')res.checks.push(...meshChecks(item));
    if(item.kind==='file')res.checks.push(check('file-caricato',m.width>0,'fail',m.width+'×'+m.height),...await fileChecks(item));
    if(item.kind==='schematic')res.checks.push(check('render-del-gioco',false,'warn','SCHEMA illustrativo, non il render del gioco'));
    if(image&&r.el){
      if(r.el.tagName==='CANVAS')res.image=r.el.toDataURL('image/png');
      else res.image=r.el.src;
    }
    return res;
  }

  // Pixels that differ between two engine captures of the same view (same camera, aligned by origin).
  async function captureDiff(item,stateA,stateB){
    const a=L().engineCapture(item,stateA,0),b=L().engineCapture(item,stateB,0);
    if(!a?.dataUrl||!b?.dataUrl)return null;
    const load=async c=>{const im=new Image();im.src=c.dataUrl;await loaded(im);return im};
    const [ia,ib]=await Promise.all([load(a),load(b)]);
    const x0=Math.min(a.origin[0],b.origin[0]),y0=Math.min(a.origin[1],b.origin[1]);
    const w=Math.max(a.origin[0]+a.width,b.origin[0]+b.width)-x0,h=Math.max(a.origin[1]+a.height,b.origin[1]+b.height)-y0;
    const grab=(im,c)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d',{willReadFrequently:true});
      g.drawImage(im,c.origin[0]-x0,c.origin[1]-y0);return g.getImageData(0,0,w,h).data};
    const da=grab(ia,a),db=grab(ib,b);let changed=0,solid=0;
    for(let i=0;i<da.length;i+=4){
      if(da[i+3])solid++;
      if(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2])+Math.abs(da[i+3]-db[i+3])>60)changed++;
    }
    return{changed,solid,share:solid?changed/solid:0};
  }
  // Checks across states and entries: construction must show progress, levels must grow.
  async function crossChecks(results){
    const out=[];
    const byItem=new Map();for(const r of results){if(!byItem.has(r.id))byItem.set(r.id,[]);byItem.get(r.id).push(r)}
    for(const [id,rs] of byItem){
      const s=Object.fromEntries(rs.map(r=>[r.state,r]));
      const builds=rs.filter(r=>/^build-/.test(r.state));
      if(builds.length>1){
        const same=builds.every((r,i)=>i===0||distance(r.signature,builds[i-1].signature)<PROGRESS);
        out.push({id,state:'build-*',check:check('cantiere-progressivo',!same,'warn',
          same?'cantiere 25/50/75% identico: la muratura non sale con l’avanzamento':'il cantiere cambia con l’avanzamento')});
      }
      if(s.cutaway&&s.intact)out.push({id,state:'cutaway',check:check('cutaway-diverso',distance(s.cutaway.signature,s.intact.signature)>SAME,'fail')});
      // Damage must change some pixels of the intact view (a crack counts): 0.3% of the silhouette.
      const item=C().items.find(x=>x.id===id);
      for(const r of rs){
        if(!/^damage-/.test(r.state)||!s.intact)continue;
        const d=await captureDiff(item,'intact',r.state);
        if(d&&d.share<.003)out.push({id,state:r.state,check:check('danno-visibile',false,'warn',
          'solo '+d.changed+' pixel diversi dalla struttura intatta ('+(d.share*100).toFixed(2)+'%)')});
      }
      // A structure still standing (not collapsed, not destroyed) keeps most of its silhouette.
      for(const r of rs){
        if(!/^damage-/.test(r.state)||!s.intact?.coverage||/crollo|distrutt|breccia|brecce/.test(r.state))continue;
        const kept=r.coverage/s.intact.coverage;
        out.push({id,state:r.state,check:check('sagoma-conservata',kept>.6,'fail',
          'copertura '+(kept*100).toFixed(0)+'% della struttura intatta'+(r.structure?.present?' (struttura presente, hp '+r.structure.hp+')':''))});
      }
    }
    // L1 < L2 < L3 for the same variant (3D height).
    const groups=new Map();
    for(const item of C().items){
      if(item.kind!=='castle'||!item.mesh||item.spec?.level==null)continue;
      const {level,...rest}=item.spec,key=JSON.stringify(rest);
      let top=0;for(let i=2;i<item.mesh.pos.length;i+=3)top=Math.max(top,item.mesh.pos[i]);
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push({id:item.id,level,top});
    }
    for(const g of groups.values()){
      if(g.length<2)continue;g.sort((a,b)=>a.level-b.level);
      const ok=g.every((x,i)=>i===0||x.top>g[i-1].top);
      out.push({id:g.map(x=>x.id).join(','),state:'3d',check:check('altezza-per-livello',ok,'fail',g.map(x=>'L'+x.level+' '+x.top.toFixed(2)).join(' < '))});
    }
    return out;
  }

  async function loadBaseline(){
    if(baselineCache)return baselineCache;
    try{const r=await fetch(BASELINE_URL,{cache:'no-store'});baselineCache=r.ok?await r.json():{entries:{}}}
    catch{baselineCache={entries:{}}}
    return baselineCache;
  }
  const key=r=>r.id+'|'+(r.state??'')+(r.rotation?'|r'+r.rotation:'');
  const worst=levels=>levels.includes('fail')?'fail':levels.includes('changed')?'changed':levels.includes('new')?'new':
    levels.includes('warn')?'warn':levels.includes('known')?'known':'ok';

  // run({ids, category, family, states:'all'|'default', images:false, onProgress}) -> report
  async function run(opts={}){
    const {ids,category,family,states='all',images=false,onProgress}=opts;
    const list=C().items.filter(x=>(!ids||ids.includes(x.id))&&(!category||x.category===category)&&(!family||x.family===family));
    const base=await loadBaseline(),results=[];
    const jobs=list.flatMap(item=>(states==='all'?statesOf(item):[L().defaultState(item)]).map(state=>({item,state})));
    // The live animation (the figures-lab render loop) pauses while the audit renders.
    const body=document.body,wasLive=body.classList.contains('asset-figure'),wasStatic=body.classList.contains('asset-catalog-static');
    body.classList.add('asset-catalog-static');
    try{
    for(let i=0;i<jobs.length;i++){
      const {item,state}=jobs[i];
      let r;const t0=performance.now();
      try{r=await inspect(item.id,state,{image:images});r.ms=Math.round(performance.now()-t0)}
      catch(error){r={id:item.id,title:item.title,category:item.category,family:item.family,kind:item.kind,state,
        checks:[check('render-senza-errori',false,'fail',error.message)]}}
      const b=base.entries?.[key(r)];
      r.baseline=!b?'new':distance(r.signature,b.signature)>CHANGED?'changed':'ok';
      if(b)r.baselineDistance=+distance(r.signature,b.signature).toFixed(4);
      results.push(r);
      onProgress?.(i+1,jobs.length,r);
      if(i%4===3)await new Promise(res=>setTimeout(res,0));
    }
    }finally{if(wasLive&&!wasStatic)body.classList.remove('asset-catalog-static')}
    const cross=await crossChecks(results);
    for(const c of cross)for(const r of results)if(c.id.split(',').includes(r.id)&&(c.state===r.state||c.state==='build-*'&&/^build-25/.test(r.state)||c.state==='3d'&&r.state==='3d'))r.checks.push(c.check);
    // Waivers: known, reviewed problems recorded in the baseline ("id|state|check", state may be "*").
    // They stay listed (level "known", with the reason) but no longer fail the audit.
    const waivers=base.waivers||{};
    for(const r of results)for(const c of r.checks){
      if(c.ok)continue;
      const w=waivers[r.id+'|'+(r.state??'')+'|'+c.name]||waivers[r.id+'|*|'+c.name];
      if(w){c.waived=w;c.level='known'}
    }
    const seen=new Set(results.map(key));
    const missing=!ids&&!category&&!family&&states==='all'?Object.keys(base.entries||{}).filter(k=>!seen.has(k)):[];
    for(const r of results)r.status=worst([...r.checks.filter(c=>!c.ok).map(c=>c.level),r.baseline==='ok'?'ok':r.baseline]);
    // Checks and baseline are counted apart: a new render can also carry a warning.
    const withLevel=l=>results.filter(r=>r.checks.some(c=>!c.ok&&c.level===l)).length;
    const withBaseline=b=>results.filter(r=>r.baseline===b).length;
    const findings=results.flatMap(r=>r.checks.filter(c=>!c.ok).map(c=>({id:r.id,title:r.title,state:r.state,...c})));
    const report={version:1,generatedAt:new Date().toISOString(),baselineDate:base.generatedAt||null,
      summary:{entries:list.length,renders:results.length,ok:results.filter(r=>r.status==='ok').length,fail:withLevel('fail'),warn:withLevel('warn'),
        known:withLevel('known'),new:withBaseline('new'),changed:withBaseline('changed'),missing:missing.length,engine:!!C().engineReady},
      findings,missing,results};
    lastReport=report;
    return report;
  }
  let lastReport=null;
  // Baseline to commit after the renders have been reviewed: signatures only, no images.
  function baseline(report=lastReport){
    if(!report)throw new Error('audit: run() first');
    const entries={};
    for(const r of report.results)if(r.signature)entries[key(r)]={title:r.title,coverage:r.coverage,signature:r.signature,
      ...(r.structure?{structure:r.structure}:{})};
    // Waivers are written by hand after a review and carried over as they are.
    return{version:1,generatedAt:report.generatedAt,note:'Reviewed Asset Lab renders. Regenerate with: node qa/asset-audit.mjs --update-baseline',
      waivers:baselineCache?.waivers||{},entries};
  }

  // ---------- contact sheets ----------
  const STATUS_COLOR={ok:'#5d8a4a',known:'#8f8a7a',warn:'#d6a15c',new:'#5f8fd6',changed:'#c77ad6',fail:'#d65c5c'};
  async function sheet(opts={}){
    const {ids,category,family,states='all',cell=170,columns}=opts;
    const list=C().items.filter(x=>(!ids||ids.includes(x.id))&&(!category||x.category===category)&&(!family||x.family===family));
    const rows=[];
    for(const item of list){
      const sts=states==='all'?statesOf(item):[L().defaultState(item)],row=[];
      for(const state of sts){
        // A run with images:true already holds every render: the sheet reuses it.
        const fromRun=lastReport?.results.find(x=>x.id===item.id&&x.state===state&&!x.rotation);
        const r=fromRun?.image?fromRun:await inspect(item.id,state,{image:true});
        row.push({r,status:fromRun?.status||worst(r.checks.filter(c=>!c.ok).map(c=>c.level)),
          label:item.states?.find(s=>s.id===state)?.label||item.format});
      }
      rows.push({item,row});
    }
    const cols=columns||Math.max(1,...rows.map(x=>x.row.length)),head=18,lab=28;
    const cv=document.createElement('canvas');cv.width=cols*cell;cv.height=rows.length*(cell+head+lab);
    const g=cv.getContext('2d');g.fillStyle='#4f6b3e';g.fillRect(0,0,cv.width,cv.height);
    for(let j=0;j<rows.length;j++){
      const y=j*(cell+head+lab);
      g.fillStyle='#1d1a16';g.fillRect(0,y,cv.width,head);g.fillStyle='#efe6d6';g.font='bold 12px system-ui';
      g.fillText(rows[j].item.title+'  ·  '+rows[j].item.family,6,y+13);
      for(let i=0;i<rows[j].row.length;i++){
        const {r,status,label}=rows[j].row[i],x=i*cell;
        if(r.image){
          const im=new Image();im.src=r.image;await loaded(im);
          const k=Math.min((cell-10)/(im.naturalWidth||1),(cell-10)/(im.naturalHeight||1));
          g.drawImage(im,x+(cell-im.naturalWidth*k)/2,y+head+cell-5-im.naturalHeight*k,im.naturalWidth*k,im.naturalHeight*k);
        }
        g.strokeStyle=STATUS_COLOR[status]||'#888';g.lineWidth=3;g.strokeRect(x+1.5,y+head+1.5,cell-3,cell+lab-3);
        g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x+3,y+head+cell,cell-6,lab-3);
        g.fillStyle='#fff';g.font='11px system-ui';g.fillText(label.slice(0,26),x+7,y+head+cell+12);
        g.fillStyle=STATUS_COLOR[status]||'#ccc';g.fillText(status+(r.checks.some(c=>!c.ok)?' · '+r.checks.filter(c=>!c.ok).map(c=>c.name).join(', '):''),x+7,y+head+cell+23);
      }
    }
    return cv.toDataURL('image/png');
  }

  // ---------- Audit panel ----------
  function panel(report){
    const box=byId('assetAudit');if(!box)return;
    box.hidden=false;
    const s=report.summary;
    byId('assetAuditSummary').textContent=s.renders+' render · '+s.ok+' ok · '+s.fail+' errori · '+s.warn+' avvisi · '+s.known+' noti · '+
      s.new+' nuovi · '+s.changed+' cambiati'+(s.missing?' · '+s.missing+' spariti':'')+(s.engine?'':' · motore non pronto');
    const list=byId('assetAuditList');list.replaceChildren();
    const order=['fail','changed','new','warn','known'];
    const rows=report.results.filter(r=>r.status!=='ok').sort((a,b)=>order.indexOf(a.status)-order.indexOf(b.status));
    for(const r of rows.slice(0,300)){
      const b=document.createElement('button');b.type='button';b.className='audit-row';b.dataset.status=r.status;
      const bad=r.checks.filter(c=>!c.ok);
      b.textContent=r.status.toUpperCase()+' · '+r.title+(r.state&&r.state!=='3d'?' · '+r.state:'')+
        (bad.length?' — '+bad.map(c=>c.name+(c.detail?' ('+c.detail+')':'')).join('; '):r.baseline==='new'?' — non in baseline':' — diverso dalla baseline');
      b.onclick=()=>C().select(r.id,r.state);
      list.appendChild(b);
    }
    for(const card of document.querySelectorAll('.asset-card')){
      const rs=report.results.filter(r=>r.id===card.dataset.id);
      if(rs.length)card.dataset.audit=worst(rs.map(r=>r.status));
    }
  }
  const runButton=byId('assetAuditRun');
  if(runButton)runButton.addEventListener('click',async()=>{
    runButton.disabled=true;
    try{
      const report=await run({onProgress:(i,n)=>{byId('assetAuditSummary').textContent='Audit in corso… '+i+' / '+n;byId('assetAudit').hidden=false}});
      panel(report);
    }finally{runButton.disabled=false}
  });
  window.ConquerAssetAudit={catalog,inspect,run,sheet,baseline,distance,get last(){return lastReport}};
})();
