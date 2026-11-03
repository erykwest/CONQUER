'use strict';
// Repeatable browser benchmark. Requires Playwright; no production save is loaded.
// NODE_PATH=<directory containing playwright> node qa/construction-performance.cjs [label]
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const workspace=path.resolve(__dirname,'..'),root=path.resolve(process.env.PERF_ROOT||workspace),out=path.join(workspace,'output/playwright');
fs.mkdirSync(out,{recursive:true});
const label=process.argv[2]||'local';
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  const target=file.endsWith(path.sep)?path.join(file,'index.html'):file;
  fs.readFile(target,(err,data)=>{
    if(err){res.writeHead(404).end();return}
    const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
    res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(data);
  });
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const report={label,sha:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),browser:browser.version(),viewport:{width:1440,height:900},seed:12345,results:[],checks:[],errors:[]};
  try{
    for(const mode of (process.env.PERF_MODES||'webgl,canvas').split(',')){
      const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
      await context.route(/supabase\.co\//,route=>route.abort());
      await context.addInitScript(()=>localStorage.setItem('conquer.seed.0.0','12345'));
      if(process.env.PERF_GL_POLL==='0')await context.addInitScript(()=>{WebGL2RenderingContext.prototype.getError=()=>0});
      const page=await context.newPage();
      page.on('pageerror',e=>report.errors.push({mode,message:e.message}));
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html?`+(mode==='webgl'?'world3d=1':'renderer=canvas2d'),{waitUntil:'networkidle',timeout:60000});
      await page.waitForFunction(()=>typeof runSettlementMaintenance==='function'&&typeof draw==='function');
      for(const scenario of (process.env.PERF_SCENARIOS||'tower,gate,castle').split(',')){
        for(let repeat=0;repeat<Number(process.env.PERF_REPEATS||3);repeat++){
          const cdp=await context.newCDPSession(page);
          if(repeat===0){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start')}
          const result=await page.evaluate(({scenario,repeat,mode})=>{
            State.clock.speed=0;State.clock.day=10;State.season='summer';State.seasonOverride='summer';
            State.village={name:'Performance fixture',founded:true,wellId:'perf-well',growthStep:20,nextGrowthDay:1e9};
            State.structures=[{id:'perf-well',type:'well',x:100,y:100}];
            for(let i=0;i<10;i++)State.structures.push({id:'perf-road-'+i,type:'road',auto:true,roadClass:'arterial',routeId:'arterial-0',routeSeq:i,a:{x:80+i*4,y:100},b:{x:84+i*4,y:100},width:.62});
            for(let i=0;i<16;i++)State.structures.push({id:'perf-home-'+i,type:'house',auto:true,houseLevel:1,x:83+(i%8)*4.5,y:i<8?96:104,w:1.5,h:1,angle:0});
            const completed=[];
            const add=(type,x,y)=>{
              const s={id:'perf-'+type+'-'+completed.length,type,x,y,size:2,w:1.5,h:1.5,r:1,shape:'square',material:'stone',level:2,angle:0,construction:{startedDay:0,completeDay:10.5}};
              normalizeStructureVariants(s);State.structures.push(s);completed.push(s);return s;
            };
            if(scenario==='castle'){
              const pts=[[90,88],[100,88],[110,88],[110,100],[110,112],[100,112],[90,112],[90,100]];
              const towers=pts.map(([x,y])=>add('tower',x,y));
              for(let i=0;i<towers.length;i++){
                const a=towers[i],b=towers[(i+1)%towers.length];
                State.structures.push({id:'perf-wall-'+i,type:'wall',a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},aSnap:a.id,bSnap:b.id,width:.5,level:1,material:'stone'});
              }
              add('gate',100,88);
            }else add(scenario,108,110);
            invalidateNavigation();invalidateSceneCache();
            // Warm terrain, assets and all layers before timing the completion.
            for(let i=0;i<6;i++)draw();
            const before=ConquerWorld3D.status(),beforeUrban=urbanRevision;
            const steady=[];
            for(let i=0;i<12;i++){const t=performance.now();draw();steady.push(performance.now()-t)}
            State.clock.day=11;
            const start=performance.now();
            window.__conquerPerf.completionRoadMaxSliceMs=0;window.__conquerPerf.completionRoadWorkMs=0;
            runSettlementMaintenance('completion',completed);
            const maintenance=performance.now()-start,maintenanceSteps={...window.__conquerPerf.lastMaintenanceSteps};
            const frames=[];
            for(let i=0;i<6;i++){const t=performance.now();draw();frames.push(performance.now()-t)}
            const after=ConquerWorld3D.status();
            return {mode,scenario,repeat,steadyMs:steady,maintenanceMs:maintenance,maintenanceSteps,completionDrawMs:frames,totalCompletionMs:maintenance+frames[0],urbanRevisions:urbanRevision-beforeUrban,terrainRebuilt:before.sig.terrain!==after.sig.terrain,world3d:after,structures:State.structures.length};
          },{scenario,repeat,mode});
          try{await page.waitForFunction(()=>typeof completionRoadJob==='undefined'||completionRoadJob===null,null,{timeout:60000})}
          catch(err){
            console.error('QUEUE TIMEOUT',JSON.stringify(await page.evaluate(()=>({speed:State.clock.speed,day:State.clock.day,job:typeof completionRoadJob==='undefined'?null:{current:completionRoadJob?.current,tasks:[...(completionRoadJob?.tasks?.keys()||[])],valid:completionRoadJob?.valid?.()},nav:navPerf.navInvalidations,perf:window.__conquerPerf,errors:window.__conquerCombatFaults}))));throw err;
          }
          result.settled=await page.evaluate(()=>{
            const frames=[];
            for(let i=0;i<6;i++){const t=performance.now();draw();frames.push(performance.now()-t)}
            return{drawMs:frames,roadMaxSliceMs:window.__conquerPerf.completionRoadMaxSliceMs,roadWorkMs:window.__conquerPerf.completionRoadWorkMs,structures:State.structures.length,world3d:ConquerWorld3D.status()};
          });
          if(process.env.PERF_ASSERT==='1'){
            assert.ok(result.maintenanceMs<100,'completion maintenance must return within 100ms');
            assert.ok(result.settled.roadMaxSliceMs<100,'road planning must yield within 100ms');
            if(mode==='webgl'){
              assert.equal(result.world3d.failed,null);
              assert.ok(result.world3d.buffers['castleBody#n']>0,'completed castle must remain visible');
              if(scenario!=='castle')assert.equal(result.terrainRebuilt,false,'isolated castle completion must retain terrain');
            }
          }
          if(repeat===0){const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(out,`${label}-${mode}-${scenario}.cpuprofile`),JSON.stringify(profile))}
          await cdp.detach();report.results.push(result);
          fs.writeFileSync(path.join(out,`construction-${label}.json`),JSON.stringify(report,null,2));
          console.log(JSON.stringify({mode,scenario,repeat,maintenanceMs:Math.round(result.maintenanceMs),steps:result.maintenanceSteps,drawMs:result.completionDrawMs.map(Math.round),terrainRebuilt:result.terrainRebuilt,urbanRevisions:result.urbanRevisions,settledDrawMs:result.settled.drawMs.map(Math.round),roadMaxSliceMs:result.settled.roadMaxSliceMs,roadWorkMs:result.settled.roadWorkMs}));
        }
      }
      if(process.env.PERF_ASSERT==='1'){
        const cache=await page.evaluate(()=>{
          const before=ConquerWorld3D.status().sig.terrain;
          invalidateNavigation(false);invalidateSceneCache('ground');draw();
          const afterInvalidation=ConquerWorld3D.status().sig.terrain;
          State.structures.push({id:'perf-cache-road',type:'road',a:{x:82,y:90},b:{x:86,y:90},width:.3});
          invalidateNavigation(false);invalidateSceneCache('ground');draw();
          return {retained:before===afterInvalidation,changed:afterInvalidation!==ConquerWorld3D.status().sig.terrain};
        });
        if(mode==='webgl'){assert.ok(cache.retained,'unchanged lots must retain ground texture');assert.ok(cache.changed,'new roads must update ground texture')}
        report.checks.push({mode,cache});
        await page.evaluate(()=>{
          const tower={id:'perf-live-tower',type:'tower',x:104,y:108,size:2,shape:'square',material:'stone',level:2,construction:{startedDay:State.clock.day,completeDay:State.clock.day+.004}};
          normalizeStructureVariants(tower);State.structures.push(tower);invalidateNavigation();invalidateStructureScene(tower);
          for(let i=0;i<6;i++)draw(); // exclude placement/cold caches from live completion metrics
          window.__perfLive={maintenance:[],draws:[],frames:[],longTasks:[],last:0,originalDraw:draw,originalMaintenance:runSettlementMaintenance};
          const live=window.__perfLive;
          live.observer=new PerformanceObserver(list=>live.longTasks.push(...list.getEntries().map(e=>e.duration)));
          live.observer.observe({type:'longtask'});
          runSettlementMaintenance=function(reason,...args){const t=performance.now();const n=live.originalMaintenance(reason,...args);if(reason==='completion')live.maintenance.push(performance.now()-t);return n};
          draw=function(...args){const t=performance.now();const n=live.originalDraw(...args);live.draws.push(performance.now()-t);return n};
          function frame(t){if(live.last)live.frames.push(t-live.last);live.last=t;if(live.running)requestAnimationFrame(frame)}
          live.running=true;requestAnimationFrame(frame);
          simLast=performance.now();simLogicDay=State.clock.day;simLogicAt=0;State.clock.speed=4;
        });
        // A fixed observation window is intentional: measure the real animation loop.
        await page.waitForTimeout(3000);
        const live=await page.evaluate(()=>{
          State.clock.speed=0;const l=window.__perfLive;l.running=false;l.observer.disconnect();draw=l.originalDraw;runSettlementMaintenance=l.originalMaintenance;
          const summary=a=>{const s=a.slice().sort((a,b)=>a-b);return{count:s.length,p95:s[Math.floor(s.length*.95)]||0,max:Math.max(0,...s)}};
          return{maintenance:l.maintenance,frames:summary(l.frames),draws:summary(l.draws),longTasks:l.longTasks};
        });
        assert.ok(live.maintenance.length>0,'the real animation loop must cross a completion');
        report.checks.push({mode,live});console.log('LIVE '+JSON.stringify({mode,...live}));
        await page.waitForFunction(()=>completionRoadJob===null,null,{timeout:60000});
      }
      await page.screenshot({path:path.join(out,`${label}-${mode}.png`)});
      if(process.env.PERF_ASSERT==='1'&&mode==='webgl'){
        const fallback=await page.evaluate(async()=>{
          const original=WebGL2RenderingContext.prototype.getError;
          WebGL2RenderingContext.prototype.getError=()=>1281;
          try{
            for(let i=0;i<120&&!ConquerWorld3D.status().failed;i++){
              draw();await new Promise(requestAnimationFrame);
            }
            draw();const c=document.getElementById('c'),g=c.getContext('2d');
            return{failed:ConquerWorld3D.status().failed,painted:g.getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data[3]>0};
          }finally{WebGL2RenderingContext.prototype.getError=original}
        });
        assert.match(fallback.failed||'',/WebGL2 renderer failure/);
        assert.ok(fallback.painted,'error detection must retain a painted Canvas fallback');
        report.checks.push({mode,fallback});console.log('FALLBACK '+JSON.stringify(fallback));
      }
      await context.close();
    }
  }finally{await browser.close();server.close()}
  fs.writeFileSync(path.join(out,`construction-${label}.json`),JSON.stringify(report,null,2));
  if(report.errors.length)throw new Error(JSON.stringify(report.errors));
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});
