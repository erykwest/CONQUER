'use strict';
// Round 2: real fire damage, structural failure and furnished cutaways in Chromium.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/round2');
const label=process.argv[2]||'local',overlay=process.env.PERF_OVERLAY;
fs.mkdirSync(out,{recursive:true});
if(process.env.PERF_SNAPSHOT==='1'){
  const dest=path.join(out,'before/src');fs.mkdirSync(dest,{recursive:true});
  for(const file of fs.readdirSync(path.join(root,'src')).filter(f=>f.endsWith('.js')))fs.copyFileSync(path.join(root,'src',file),path.join(dest,file));
}
const server=http.createServer((req,res)=>{
  const relative='.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  const saved=overlay&&path.join(overlay,path.relative(root,file));
  fs.readFile(saved&&fs.existsSync(saved)?saved:file,(err,data)=>{
    if(err){res.writeHead(404).end();return}
    res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);
  });
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const report={label,browser:browser.version(),base:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),errors:[],results:[]};
  try{
    for(const mode of (process.env.PERF_MODES||'webgl,canvas').split(','))for(const scenario of (process.env.PERF_SCENARIOS||'fire,damage,collapse,cutaway').split(',')){
      const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
      await context.route(/supabase\.co\//,r=>r.abort());
      await context.addInitScript(()=>{localStorage.setItem('conquer.seed.0.0','12345');let seed=12345;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)});
      await context.addInitScript(()=>{
        const original=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(kind,...args){
          const g=original.call(this,kind,...args);
          if(kind==='webgl2'&&g){const ext=g.getExtension('WEBGL_debug_renderer_info');if(ext)window.__perfGPU=g.getParameter(ext.UNMASKED_RENDERER_WEBGL)}
          return g;
        };
      });
      const page=await context.newPage();page.on('pageerror',e=>report.errors.push({mode,scenario,error:e.message}));
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html?`+(mode==='webgl'?'world3d=1':'renderer=canvas2d'),{waitUntil:'networkidle'});
      await page.waitForFunction(()=>typeof draw==='function'&&!!window.ConquerFire&&!!window.ConquerSiege);
      await page.evaluate(scenario=>{
        State.clock.speed=0;State.clock.day=20;State.season='summer';State.seasonOverride='summer';State.daylightOverride=.5;
        State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();
        State.village={founded:false,nextGrowthDay:1e9};State.structures=[];State.fire=null;
        ConquerSiege.restore(null);State.combat.units=[];State.combat.enemy=[];State.combat.strokes=[];
        for(let i=0;i<24;i++)State.structures.push({id:'r2-house-'+i,type:'house',auto:true,houseLevel:2,x:88+(i%6)*4,y:90+Math.floor(i/6)*4,w:1.5,h:1,angle:0});
        for(let i=0;i<12;i++){
          const s={id:'r2-tower-'+i,type:'tower',shape:i%2?'round':'square',size:2,r:1,material:['fire','brigade','burn-down'].includes(scenario)&&i<8?'wood':'stone',level:3,x:86+(i%6)*5.5,y:84+Math.floor(i/6)*24,functions:[]};
          normalizeStructureVariants(s);normalizeFunctions(s);
          s.functions=s.functions.map((_,j)=>['barracks','storage','quarters','nobleRoom'][j%4]);State.structures.push(s);
        }
        for(let i=0;i<6;i++)State.structures.push({id:'r2-wall-'+i,type:'wall',a:{x:85+i*5.5,y:113},b:{x:90+i*5.5,y:113},width:.5,level:2,tier:2,material:'stone'});
        if(scenario==='brigade')State.structures.push({id:'r2-well',type:'well',x:99,y:107});
        const r=wrap.getBoundingClientRect();State.view.scale=.72;State.view.x=r.width/2;State.view.y=r.height/2-100*U*.72;
        invalidateNavigation();invalidateSceneCache();for(let i=0;i<8;i++)draw();
        window.__r2={draws:[],sources:{},fireTicks:[],phases:[],nav:0,terrainChanges:0,originalDraw:draw,originalNav:invalidateNavigation,originalTick:ConquerFire.tick};
        const m=window.__r2;m.frames=[];m.observing=true;
        function frame(t){if(!m.observing)return;m.frames.push(t);requestAnimationFrame(frame)}requestAnimationFrame(frame);
        draw=function(...args){if(m.defer){m.deferred=(m.deferred||0)+1;return}const source=(new Error().stack.split('\n')[2]||'unknown').trim();m.sources[source]=(m.sources[source]||0)+1;const sig=ConquerWorld3D.status().sig.terrain,t=performance.now();const n=m.originalDraw(...args);m.draws.push(performance.now()-t);m.phases.push({...window.__conquerPerf.renderPhases});if(sig!==ConquerWorld3D.status().sig.terrain)m.terrainChanges++;return n};
        invalidateNavigation=function(...args){m.nav++;return m.originalNav(...args)};
        ConquerFire.tick=function(...args){const t=performance.now();const n=m.originalTick(...args);m.fireTicks.push(performance.now()-t);return n};
      },scenario);
      const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start');
      const action=await page.evaluate(({scenario,probe})=>{
        const m=window.__r2;Object.assign(m,{draws:[],phases:[],sources:{},frames:[],fireTicks:[],nav:0,terrainChanges:0});
        m.defer=probe==='defer-draw';
        if(probe==='no-timber-render')drawWoodTower=()=>{};
        const t=performance.now(),actions=[];
        if(['fire','brigade','combined','burn-down'].includes(scenario)){
          ConquerFire.brigade.set(scenario==='brigade');
          for(const s of State.structures.filter(s=>s.type==='house'||s.material==='wood'))ConquerFire.ignite(s.id,{heat:.95});
          for(let i=0;i<(scenario==='burn-down'?200:12);i++)ConquerFire.tick(scenario==='burn-down'?.25:.1);
        }
        if(scenario==='damage'){
          for(const s of State.structures.filter(s=>s.type==='tower'))actions.push(ConquerSiege.attackStructure(s.id,'trebuchet',1));
        }else if(scenario==='collapse'||scenario==='combined'){
          for(const s of State.structures.filter(s=>s.type==='tower')){
            const max=ConquerSiege.integrity(s).core.max;
            actions.push(ConquerSiege.attackStructure(s.id,'trebuchet',max*.4/7));
            actions.push(ConquerSiege.attackStructure(s.id,'trebuchet',1e5));
          }
          for(const s of State.structures.filter(s=>s.type==='wall'))actions.push(ConquerSiege.attackStructure(s.id,'trebuchet',1e5,0));
        }else if(scenario==='cutaway'){
          const towers=State.structures.filter(s=>cutawayEligible(s));
          State.selectedId=towers[0].id;renderFunctionPanel();
          document.querySelector('[data-cutaway-toggle]').click();
          for(const s of towers.slice(1))s.cutaway=true;
          invalidateSceneCache(['castleBody','castleFront']);draw();
        }
        if(probe==='no-fire-render')ConquerFire.draw=()=>{};
        if(m.defer){m.defer=false;draw()}
        const actionMs=performance.now()-t,actionDraws=m.draws.length,actionNav=m.nav,actionDrawMs=m.draws.reduce((a,b)=>a+b,0),actionTerrainChanges=m.terrainChanges;
        m.draws=[];m.phases=[];m.fireTicks=[];m.frames=[];m.nav=0;m.terrainChanges=0;m.sources={};
        if(scenario==='combined'){simLast=performance.now();simLogicDay=State.clock.day;simLogicAt=0;State.clock.speed=1}
        return{actionMs,actionDraws,actionDrawMs,actionNav,actionTerrainChanges,accepted:actions.filter(a=>a.ok).length,burning:ConquerFire.state().burning.length,embers:ConquerFire.state().embers.length,carriers:ConquerFire.brigade.carriers().length,ruins:ConquerSiege.state().ruins.length,houses:State.structures.filter(s=>s.type==='house').length,stumps:State.structures.filter(s=>s.type==='ruin').length,cutaways:State.structures.filter(structureCutaway).length};
      },{scenario,probe:process.env.PERF_PROBE});
      await page.waitForTimeout(Number(process.env.PERF_WINDOW_MS||1500)); // deliberate animation observation window
      const animation=await page.evaluate(()=>{
        const m=window.__r2,summary=a=>{const s=a.slice().sort((a,b)=>a-b);return{count:s.length,total:s.reduce((a,b)=>a+b,0),p50:s[Math.floor(s.length*.5)]||0,p95:s[Math.floor(s.length*.95)]||0,max:s.at(-1)||0}};
        m.observing=false;
        return{draw:summary(m.draws),frames:summary(m.frames.slice(1).map((t,i)=>t-m.frames[i])),sources:m.sources,fireTick:summary(m.fireTicks),nav:m.nav,terrainChanges:m.terrainChanges,phases:m.phases,world:ConquerWorld3D.status(),perf:{...window.__conquerPerf},gpu:window.__perfGPU,effectState:{fire:ConquerFire.state().burning.length,needsFire:ConquerFire.needsAnimation?.(),needsSiege:ConquerSiege.needsAnimation?.(),speed:State.clock.speed,visibility:document.visibilityState}};
      });
      const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(out,`${label}-${mode}-${scenario}.cpuprofile`),JSON.stringify(profile));await cdp.detach();
      const result={mode,scenario,action,animation};report.results.push(result);
      if(process.env.PERF_ASSERT==='1'){
        assert.equal(report.errors.length,0);
        if(mode==='webgl')assert.equal(animation.world.failed,null);
        if(scenario==='fire')assert.ok(action.burning>=24);
        if(scenario==='brigade')assert.equal(action.carriers,6);
        if(scenario==='burn-down')assert.ok(action.houses===0&&action.ruins>=24&&action.embers>0,'the fire itself must collapse the houses and leave burning rubble');
        if(scenario!=='cutaway')assert.equal(action.actionDraws,0,'damage must not render inside the mutation loop');
        if(scenario==='collapse')assert.ok(action.stumps===12&&action.ruins>=24);
        if(scenario==='cutaway')assert.equal(action.cutaways,12);
      }
      fs.writeFileSync(path.join(out,`${label}.json`),JSON.stringify(report,null,2));
      console.log(JSON.stringify({mode,scenario,...action,animationDraw:animation.draw,frames:animation.frames,animationNav:animation.nav,terrainChanges:animation.terrainChanges}));
      if(process.env.PERF_ASSERT==='1'&&mode==='webgl'&&scenario==='collapse'){
        await page.waitForFunction(()=>!ConquerSiege.needsAnimation(),null,{timeout:15000});
        result.settled=await page.evaluate(()=>{
          draw();draw();const before=window.__conquerPerf.settledRubbleUploads;
          const samples=[];for(let i=0;i<8;i++){const t=performance.now();draw();samples.push(performance.now()-t)}
          const after=window.__conquerPerf.settledRubbleUploads,rotation=State.view.rotation||0;
          State.view.rotation=(rotation+1)%4;draw();const turned=window.__conquerPerf.settledRubbleUploads;State.view.rotation=rotation;draw();
          return{before,after,turned,drawMs:samples,vertices:ConquerWorld3D.status().buffers['settledRubble#n']};
        });
        assert.equal(result.settled.before,result.settled.after,'settled heaps must reuse their GPU buffer');
        assert.ok(result.settled.turned>result.settled.after&&result.settled.vertices>0,'rotation must update heap shading');
        console.log('SETTLED '+JSON.stringify(result.settled));
      }
      if(process.env.PERF_ASSERT==='1'&&mode==='webgl'&&scenario==='cutaway'){
        result.pixels=await page.evaluate(()=>{
          const saved={...State.view},palette=State.visualPalette,checks=[];
          for(const [rotation,material] of [[0,'stone'],[1,'stone'],[1,'clay']]){
            const direct=document.createElement('canvas'),cached=document.createElement('canvas');direct.width=cached.width=canvas.width;direct.height=cached.height=canvas.height;
            const a=direct.getContext('2d'),b=cached.getContext('2d');
            State.view.rotation=rotation;State.visualPalette=material;
            a.clearRect(0,0,direct.width,direct.height);b.clearRect(0,0,cached.width,cached.height);
            withRenderContext(a,drawCutawayStructures);withRenderContext(b,drawCutawayStaticOverlay);
            const p=a.getImageData(0,0,direct.width,direct.height).data,q=b.getImageData(0,0,cached.width,cached.height).data;
            let pixels=0,diff=0,error=0;
            for(let i=0;i<p.length;i+=4)if(p[i+3]||q[i+3]){pixels++;let max=0;for(let k=0;k<4;k++){const d=Math.abs(p[i+k]-q[i+k]);error+=d;max=Math.max(max,d)}if(max>16)diff++}
            checks.push({rotation,material,pixels,differingFraction:diff/Math.max(1,pixels),meanChannelError:error/Math.max(1,pixels*4),...(material==='clay'?{direct:direct.toDataURL(),cached:cached.toDataURL()}:{})});
          }
          State.view=saved;State.visualPalette=palette;
          return checks;
        });
        for(const check of result.pixels){
          for(const key of ['direct','cached'])if(check[key]){fs.writeFileSync(path.join(out,`cutaway-${key}.png`),Buffer.from(check[key].split(',')[1],'base64'));delete check[key]}
          assert.ok(check.pixels>100);assert.ok(check.differingFraction<.02&&check.meanChannelError<1,JSON.stringify(check));
        }
        console.log('CUTAWAY PIXELS '+JSON.stringify(result.pixels));
      }
      fs.writeFileSync(path.join(out,`${label}.json`),JSON.stringify(report,null,2));
      await page.screenshot({path:path.join(out,`${label}-${mode}-${scenario}.png`)});await context.close();
    }
  }finally{await browser.close();server.close()}
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});
