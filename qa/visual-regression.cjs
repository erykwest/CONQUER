'use strict';
// Visual QA for CONQUER's real browser renderer. Requires: playwright, pngjs.
// No production code is patched and no baselines are silently approved.
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const {scenes,rotationCases}=require('./visual-scenes.cjs');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'qa','visual-results');
const BASE=path.join(ROOT,'qa','visual-baselines');
const UPDATE=process.argv.includes('--update-baselines');
const SMOKE=process.argv.includes('--smoke');
const FULL=process.argv.includes('--full')||!SMOKE;
const SCENE_IDS=SMOKE?new Set(['tower-square','tower-wall-link','height-overlap','cutaway-room','built-roof','urban-occlusion']):null;
const HOST=process.env.CONQUER_QA_URL||'http://127.0.0.1:4173/';
const MAX_DIFF_RATIO=Number(process.env.CONQUER_MAX_DIFF_RATIO||.006);
const MAX_CACHE_RATIO=.002;
const MAX_MASK_FAILURES=0;
const SELECTED=scenes.filter(s=>!SCENE_IDS||SCENE_IDS.has(s.id));
const file=(...p)=>path.join(OUT,...p);
const mkdir=p=>fs.mkdirSync(p,{recursive:true});
function comparePNGs(expected,actual,diffPath){
  const a=PNG.sync.read(expected),b=PNG.sync.read(actual);
  if(a.width!==b.width||a.height!==b.height)return{ratio:1,reason:'dimensions',width:[a.width,b.width],height:[a.height,b.height]};
  const diff=new PNG({width:a.width,height:a.height});
  let count=0,max=0,sum=0;
  for(let i=0;i<a.data.length;i+=4){
    const d=Math.max(...[0,1,2,3].map(c=>Math.abs(a.data[i+c]-b.data[i+c])));
    max=Math.max(d,max);sum+=d;
    if(d>12){count++;diff.data[i]=255;diff.data[i+1]=64;diff.data[i+2]=44;diff.data[i+3]=255;}
    else {const gray=Math.floor((b.data[i]+b.data[i+1]+b.data[i+2])/3);diff.data[i]=gray;diff.data[i+1]=gray;diff.data[i+2]=gray;diff.data[i+3]=255;}
  }
  if(count)fs.writeFileSync(diffPath,PNG.sync.write(diff));
  return{ratio:count/(a.width*a.height),mean:sum/(a.width*a.height),max,changed:count};
}
function pixelHealth(image){
  const png=PNG.sync.read(image),unique=new Set();
  let visible=0;
  for(let y=0;y<png.height;y+=13)for(let x=0;x<png.width;x+=13){
    const i=(y*png.width+x)*4;
    if(png.data[i+3]>0)visible++;
    unique.add((png.data[i]>>4)+'/'+(png.data[i+1]>>4)+'/'+(png.data[i+2]>>4));
  }
  return{colors:unique.size,visible};
}
function browserFixture(){
  // Serialized into Chromium main world; use the genuine game drawing routines.
  return function({scene,rotation}){
    State.clock.speed=0;State.clock.day=20;State.clock.lastSpeed=1;
    State.seed=224466;State.biome='plains';State.season='summer';
    State.seasonOverride='summer';State.daylightOverride='day';State.weatherOverride='clear';
    State.environment=[];State.relief=null;State.selectedId=null;
    State.structures=JSON.parse(JSON.stringify(scene.structures));
    State.draft=null;State.tool={kind:'select'};
    State.village={name:'Visual QA',founded:false,growthStep:0,roadPlan:[],wellId:null};
    if(State.combat){
      State.combat.units=[];State.combat.enemy=[];State.combat.strokes=[];
    }
    State.view.scale=2.20;State.view.rotation=rotation;
    const r=wrap.getBoundingClientRect(),s=U*State.view.scale,q=rotateViewPoint(scene.focus,rotation);
    State.view.x=r.width/2-(q.x-q.y)*s*ISO_X;
    State.view.y=r.height/2-(q.x+q.y)*s*ISO_Y;
    if(typeof invalidateUrbanGeometry==='function')invalidateUrbanGeometry();
    if(typeof invalidateNavigation==='function')invalidateNavigation();
    if(typeof clearReliefBandCache==='function')clearReliefBandCache();
    window.__conquerAssetCompiler?.clearComposite?.();
    invalidateSceneCache();
    draw();
    return{canvas:{width:canvas.width,height:canvas.height},renderer:document.documentElement.dataset.renderer||'canvas2d',structures:State.structures.length};
  };
}
function browserDiagnostic(){
  return function(){
    const errors=[],objects=[],bounds=wrap.getBoundingClientRect();
    const pointIn=(p,poly)=>{
      let inside=false;
      for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const a=poly[i],b=poly[j];
        if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }
      return inside;
    };
    for(const s of State.structures){
      try{
        const hull=structureScreenSilhouette(s);
        const h=structureHeight(s);
        if(!Number.isFinite(h)||h<=0)errors.push('non-positive height '+s.id);
        if(!hull||hull.length<3||hull.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
          errors.push('invalid projected silhouette '+s.id);
        else {
          const x0=Math.min(...hull.map(p=>p.x)),x1=Math.max(...hull.map(p=>p.x));
          const y0=Math.min(...hull.map(p=>p.y)),y1=Math.max(...hull.map(p=>p.y));
          if((x1-x0)*(y1-y0)<3)errors.push('collapsed silhouette '+s.id);
          objects.push({id:s.id,type:s.type,height:h,bounds:[x0,y0,x1,y1],depth:worldDepth(s)});
        }
      }catch(e){errors.push('silhouette exception '+s.id+': '+e.message)}
    }
    // Verify actual Canvas clip pixels against an independent projected-polygon
    // oracle. This tests masks, not just the ordering metadata.
    let maskChecks=0,maskFailures=0;
    for(const owner of State.structures.filter(s=>['tower','gate','built','wall'].includes(s.type)&&!underConstruction(s))){
      const z=structureHeight(owner)*.5;
      const candidates=State.structures.filter(other=>
        other.id!==owner.id&&!underConstruction(other)&&
        (isCastlePart(other)||isRaisedPlacementCastlePoint(other))&&
        structureVisualTopHeight(other)>z+.035&&
        (structuresOverlapInPlan(owner,other)||worldDepth(other)>worldDepth(owner)+1e-4));
      const actual=structureDetailOccluders(owner,z);
      const expectedIDs=candidates.map(s=>s.id).sort().join('|');
      if(expectedIDs!==actual.map(s=>s.id).sort().join('|'))
        errors.push('occluder order mismatch '+owner.id+': expected '+expectedIDs+' actual '+actual.map(s=>s.id).join('|'));
      const probe=document.createElement('canvas');probe.width=Math.round(bounds.width);probe.height=Math.round(bounds.height);
      const g=probe.getContext('2d',{willReadFrequently:true});
      withRenderContext(g,()=>withStructureDetailOcclusion(owner,z,()=>{
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,bounds.width,bounds.height);
      }));
      const occluderHulls=candidates.map(s=>structureScreenSilhouette(s)).filter(poly=>poly.length>=3);
      const ownerHull=structureScreenSilhouette(owner);
      if(ownerHull.length<3)continue;
      const points=[
        ...ownerHull,
        {x:ownerHull.reduce((v,p)=>v+p.x,0)/ownerHull.length,y:ownerHull.reduce((v,p)=>v+p.y,0)/ownerHull.length}
      ];
      for(const p of points){
        const x=Math.round(p.x),y=Math.round(p.y);
        if(x<1||y<1||x>=probe.width-1||y>=probe.height-1)continue;
        // Skip polygon boundaries where Canvas antialiasing is implementation-dependent.
        if(occluderHulls.some(poly=>poly.some((v,i)=>{
          const w=poly[(i+1)%poly.length],dx=w.x-v.x,dy=w.y-v.y;
          return Math.abs(dx*(p.y-v.y)-dy*(p.x-v.x))/Math.hypot(dx,dy)<2;
        })))continue;
        const masked=occluderHulls.some(poly=>pointIn(p,poly));
        const alpha=g.getImageData(x,y,1,1).data[3];
        maskChecks++;
        if(masked?(alpha>10):(alpha<245)){
          maskFailures++;
          if(maskFailures<=8)errors.push('mask mismatch '+owner.id+' at '+x+','+y+' expected masked='+masked+' alpha='+alpha);
        }
      }
    }
    return {errors,objects,maskChecks,maskFailures,viewport:[bounds.width,bounds.height]};
  };
}
async function main(){
  mkdir(OUT);mkdir(file('actual'));mkdir(file('diff'));
  if(UPDATE)mkdir(BASE);
  const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--disable-gpu-sandbox','--enable-unsafe-webgpu']});
  const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.addInitScript(()=>{localStorage.setItem('conquer.seed.0.0','224466');localStorage.setItem('conquer.castleBodyBitmap.v1','0')});
  const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e.stack||e)));
  await page.goto(HOST+(HOST.includes('?')?'&':'?')+'renderer=canvas2d',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>typeof draw==='function'&&typeof structureScreenSilhouette==='function'&&!!window.ConquerWebGPU,{timeout:60000});
  await page.addStyleTag({content:'body>header,#wrap>aside,#wrap>div,#weatherCanvas,#weatherCloudLayer,#timePanel{visibility:hidden!important} #wrap{background:#202419!important} *{transition:none!important;animation:none!important}'});
  await page.waitForTimeout(500);
  const report={date:new Date().toISOString(),gitSha:process.env.GITHUB_SHA||'',mode:SMOKE?'smoke':'full',scenes:[],errors:[],summary:{passed:0,failed:0,pending:0,maskChecks:0,maskFailures:0}};
  const shot=()=>page.locator('#wrap').screenshot({animations:'disabled',timeout:45000});
  let reference=null;
  try{
    for(const scene of SELECTED){
      for(const rotation of rotationCases){
        const name=scene.id+'-r'+rotation,rec={id:name,scene:scene.id,rotation,status:'PASS'};
        try{
          rec.fixture=await page.evaluate(browserFixture(),{scene,rotation});
          rec.diagnostics=await page.evaluate(browserDiagnostic());
          if(rec.diagnostics.errors.length||rec.diagnostics.maskFailures>MAX_MASK_FAILURES)
            throw Error(rec.diagnostics.errors.join('; ')||'mask failure');
          report.summary.maskChecks+=rec.diagnostics.maskChecks;
          report.summary.maskFailures+=rec.diagnostics.maskFailures;
          const capture=await shot(),actualPath=file('actual',name+'.png'),baseline=path.join(BASE,name+'.png');
          fs.writeFileSync(actualPath,capture);
          rec.health=pixelHealth(capture);
          if(rec.health.colors<12||rec.health.visible<200)throw Error('Blank or nearly blank frame '+JSON.stringify(rec.health));
          if(scene.id==='tower-wall-link'&&rotation===0)reference=capture;
          if(UPDATE){fs.writeFileSync(baseline,capture);rec.baseline='UPDATED';}
          else if(fs.existsSync(baseline)){
            rec.diff=comparePNGs(fs.readFileSync(baseline),capture,file('diff',name+'.png'));
            if(rec.diff.ratio>MAX_DIFF_RATIO)throw Error('visual diff '+(rec.diff.ratio*100).toFixed(3)+'% > '+(MAX_DIFF_RATIO*100).toFixed(3)+'%');
            rec.baseline='VERIFIED';
          }else{
            rec.status='PENDING';rec.baseline='MISSING';
            report.summary.pending++;
          }
          if(rec.status==='PASS')report.summary.passed++;
        }catch(e){rec.status='FAIL';rec.error=String(e.stack||e);report.errors.push(name+': '+String(e.message||e));report.summary.failed++;}
        report.scenes.push(rec);
        console.log(rec.status.padEnd(7),name,rec.error?rec.error.slice(0,220):rec.baseline||'');
      }
    }
    // Real direct-vs-bitmap check is already implemented in CONQUER: make it a gate.
    const castle=scenes.find(s=>s.id==='tower-wall-link');
    await page.evaluate(browserFixture(),{scene:castle,rotation:0});
    const cache=await page.evaluate(()=>window.__conquerCastleBodyCache?.benchmark?.(2)||null);
    report.cacheParity=cache;
    if(cache&&cache.pixelDiffRatio!=null&&cache.pixelDiffRatio>MAX_CACHE_RATIO){
      report.errors.push('castle bitmap cache diff '+cache.pixelDiffRatio+' > '+MAX_CACHE_RATIO);
      report.summary.failed++;
    }
    // Re-load a fixed scene, ensuring an accidental stale cache does not leak between fixtures.
    if(reference){
      await page.evaluate(browserFixture(),{scene:castle,rotation:0});
      const repeated=await shot();
      report.determinism=comparePNGs(reference,repeated,file('diff','determinism.png'));
      if(report.determinism.ratio>MAX_DIFF_RATIO){
        report.errors.push('repeat scene differs by '+report.determinism.ratio);
        report.summary.failed++;
      }
    }
    // Run a seeded geometry stress test without allocating screenshot buffers.
    report.stress=await page.evaluate(()=>{
      const problems=[];let checks=0;const rnd=n=>{let a=n>>>0;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}};
      const random=rnd(72657);
      const previous=State.structures,rot=State.view.rotation;
      try{
        for(let k=0;k<80;k++){
          const a={id:'A',type:'tower',shape:'square',x:97+random()*6,y:97+random()*6,size:1.5,tier:2,level:1+Math.floor(random()*3)};
          const b={id:'B',type:'tower',shape:'round',x:97+random()*6,y:97+random()*6,r:.75,tier:2,level:1+Math.floor(random()*3)};
          State.structures=[a,b];State.view.rotation=k%4;
          const front=worldDepth(a)>worldDepth(b)?a:b,back=front===a?b:a;
          const occluders=structureDetailOccluders(back,.2);
          const expected=structuresOverlapInPlan(a,b)||worldDepth(front)>worldDepth(back)+1e-4;
          checks++;
          if(expected!==occluders.some(s=>s.id===front.id))problems.push('pair '+k+' depth/overlap');
          for(const obj of [a,b]){
            const hull=structureScreenSilhouette(obj);
            checks++;
            if(hull.length<3||hull.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))problems.push('pair '+k+' silhouette '+obj.id);
          }
        }
      }finally{State.structures=previous;State.view.rotation=rot;invalidateSceneCache();}
      return{seed:72657,combinations:80,checks,problems};
    });
    if(report.stress.problems.length){report.errors.push(...report.stress.problems);report.summary.failed++;}
    if(pageErrors.length){report.pageErrors=pageErrors;report.errors.push(...pageErrors);report.summary.failed++;}
  }finally{
    fs.writeFileSync(file('report.json'),JSON.stringify(report,null,2));
    const markdown=[
      '# CONQUER Visual QA',
      '', 'Renderer: Canvas2D (controlled baseline); 1280 × 900, DPR 1, seed 224466, paused daylight.',
      '', 'Status: '+(report.summary.failed?'FAIL':'PASS')+' — '+report.summary.passed+' pass, '+report.summary.failed+' fail, '+report.summary.pending+' pending baselines.',
      '', 'Mask checks: '+report.summary.maskChecks+', failures: '+report.summary.maskFailures+'.',
      '', '| Scene | Camera | Status | Baseline | Difference |','|---|---:|---|---|---:|',
      ...report.scenes.map(s=>'| '+s.scene+' | '+s.rotation*90+'° | '+s.status+' | '+(s.baseline||'-')+' | '+(s.diff?(100*s.diff.ratio).toFixed(3)+'%':'-')+' |'),
      '', 'Cache parity: '+JSON.stringify(report.cacheParity||'not supported'),
      '', 'Determinism: '+JSON.stringify(report.determinism||'not measured'),
      '', 'Stress: '+JSON.stringify(report.stress||'not run'),
      '', 'Errors:', ...report.errors.map(e=>'- '+e.replace(/\n/g,' ').slice(0,500)),
      '', 'Baseline changes require --update-baselines, review, and a separate commit. Missing baselines are explicit PENDING, never auto-approved.'
    ].join('\n');
    fs.writeFileSync(file('report.md'),markdown);
    await browser.close();
  }
  console.log('RESULT',JSON.stringify(report.summary),file('report.md'));
  if(report.summary.failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});