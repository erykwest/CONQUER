'use strict';
// Round 3: actual Canvas debris, bucket paths, wall legs and a 20-man assault.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/round3'),label=process.argv[2]||'local';
fs.mkdirSync(out,{recursive:true});
if(process.env.PERF_SNAPSHOT==='1'){
  const dest=path.join(out,'before/src');fs.mkdirSync(dest,{recursive:true});
  for(const f of fs.readdirSync(path.join(root,'src')).filter(f=>f.endsWith('.js')))fs.copyFileSync(path.join(root,'src',f),path.join(dest,f));
}
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  const saved=process.env.PERF_OVERLAY&&path.join(process.env.PERF_OVERLAY,path.relative(root,file));
  fs.readFile(saved&&fs.existsSync(saved)?saved:file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)});
});
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const report={label,browser:browser.version(),errors:[],results:[]};
  try{for(const scenario of (process.env.PERF_SCENARIOS||'collapse,brigade,walls,assault').split(','))for(const mode of (process.env.PERF_MODES||'canvas,webgl').split(',')){
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
    await context.route(/supabase\.co\//,r=>r.abort());
    await context.addInitScript(()=>{localStorage.setItem('conquer.seed.0.0','12345');let s=12345;Math.random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push({scenario,mode,error:e.message}));
    page.on('console',m=>{if(m.type()==='error'&&/^CONQUER_|Uncaught/.test(m.text()))report.errors.push({scenario,mode,error:m.text()})});
    if(process.env.PERF_LIVE==='1')await page.exposeFunction('__round3Capture',stage=>page.screenshot({path:path.join(out,`${label}-${mode}-${scenario}-${stage}.png`)}));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?`+(mode==='webgl'?'world3d=1':'renderer=canvas2d'),{waitUntil:'networkidle'});
    await page.evaluate(scenario=>{
      State.clock.speed=0;State.clock.day=20;State.daylightOverride='day';State.seasonOverride='summer';
      State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();State.village={founded:false,nextGrowthDay:1e9};State.structures=[];State.fire=null;
      ConquerSiege.restore(null);ConquerCombat.restore({version:2,units:[],enemy:[],strokes:[],storms:[],zones:false});
      if(scenario==='collapse'){
        for(let i=0;i<8;i++)State.structures.push({id:'tower'+i,type:'tower',shape:i%2?'round':'square',size:2,r:1,x:90+i%4*5,y:94+Math.floor(i/4)*8,level:3,material:'stone'});
        for(let i=0;i<4;i++)State.structures.push({id:'wall'+i,type:'wall',a:{x:88+i*5,y:108},b:{x:92+i*5,y:108},width:.5,level:2,tier:2,material:'stone'});
      }else if(scenario==='brigade'){
        State.structures.push({id:'well',type:'well',x:99,y:107});
        for(let i=0;i<24;i++)State.structures.push({id:'house'+i,type:'house',auto:true,houseLevel:2,x:88+i%6*4,y:90+Math.floor(i/6)*4,w:1.5,h:1,angle:0});
      }else{
        State.village.founded=true;State.village.wellId='well';
        State.structures=[{id:'well',type:'well',x:104,y:104},{id:'tower',type:'tower',shape:'square',size:1.5,x:96,y:100,level:1,material:'stone'},
          {id:'wall',type:'wall',a:{x:96,y:101},b:{x:96,y:110},aSnap:'tower',width:.5,level:1,tier:2,material:'stone'}];
        const stair=ConquerWallWalk.stairs()[0];window.__stair=JSON.parse(JSON.stringify(stair.ground));
        if(scenario==='walls')for(let i=0;i<6;i++)State.combat.units.push({id:'friend'+i,kind:i?'squad':'knight',x:stair.ground.x+1+i*.25,y:stair.ground.y+1,target:null});
        else{
          State.combat.units.push({id:'defender',kind:'knight',x:100,y:106,target:null});
          const f=ConquerWallWalk.frame({wallId:'wall',t:.75}),p=ConquerWallWalk.at({wallId:'wall',t:.75});
          for(let i=0;i<20;i++)State.combat.enemy.push({id:'attacker'+i,x:p.x+f.ex*(2+Math.floor(i/5)*.5),y:p.y+(i%5-2)*.55,kind:'infantry',combatKind:'infantry',faction:'dev_hostile'});
        }
      }
      ConquerWallWalk.invalidate();invalidateNavigation();invalidateSceneCache();
      const box=wrap.getBoundingClientRect();State.view.scale=.85;State.view.x=box.width/2;State.view.y=box.height/2-100*U*.85;
      draw();draw();window.__r3={now:performance.now.bind(performance),ticks:[],paths:[],draws:[],samples:[],seenUp:new Set(),seenWall:new Set(),seenDown:new Set(),distance:{},splashes:0,blocked:0};
      const m=window.__r3,oldPath=findPeasantPath;
      findPeasantPath=function(...args){const t=m.now(),p=oldPath(...args);m.paths.push({ms:m.now()-t,points:p?.length||0});return p};
      if(typeof findPeasantPathWork==='function'){
        const prior=findPeasantPathWork;
        findPeasantPathWork=function*(...args){const work=prior(...args);let ms=0;for(;;){const t=m.now(),n=work.next();ms+=m.now()-t;if(n.done){m.paths.push({ms,points:n.value?.length||0,from:{x:args[0].x,y:args[0].y},to:args[1]});return n.value}yield n.value}};
      }
    },scenario);
    await page.evaluate(live=>{const m=window.__r3;m.live=live;m.liveDraws=[];m.frames=[];if(live){const old=draw;draw=function(...a){const t=m.now(),r=old(...a);m.liveDraws.push(m.now()-t);return r};const frame=t=>{m.frames.push(t);if(m.live)requestAnimationFrame(frame)};requestAnimationFrame(frame)}},process.env.PERF_LIVE==='1');
    const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start');
    const result=await page.evaluate(async scenario=>{
      const m=window.__r3,summary=a=>{const s=a.slice().sort((a,b)=>a-b);return{count:s.length,total:s.reduce((a,b)=>a+b,0),p50:s[Math.floor(s.length*.5)]||0,p95:s[Math.floor(s.length*.95)]||0,max:s.at(-1)||0}};
      const t=m.now();let accepted=0;
      if(scenario==='collapse'){
        for(const s of [...State.structures]){const r=ConquerSiege.attackStructure(s.id,'trebuchet',1e5,0);if(r.ok)accepted++}
        const actions=m.now()-t;
        for(let i=0;i<3;i++){const t=m.now();draw();m.draws.push(m.now()-t)}
        const active=summary(m.draws);m.draws=[];
        const stamp=performance.now;performance.now=()=>1e8;
        try{for(let i=0;i<5;i++){const t=m.now();draw();m.draws.push(m.now()-t)}}finally{performance.now=stamp}
        return{scenario,accepted,actionMs:actions,active,settled:summary(m.draws),ruins:State.siege.ruins.length,perf:{...window.__conquerPerf}};
      }
      if(scenario==='brigade'){
        ConquerFire.brigade.set(true);for(const s of State.structures.filter(s=>s.type==='house'))ConquerFire.ignite(s.id,{heat:.12});
      }else if(scenario==='walls')accepted=ConquerCombat.issueWallOrder(ConquerCombat.units(),{wallId:'wall',t:.65});
      else accepted=!!ConquerCombat.addStorm('ladder',{wallId:'wall',t:.75});
      const actionMs=m.now()-t,original=performance.now,start=m.now();let sim=0,down=false,upComplete=false;
      performance.now=()=>start+sim*1000+(m.now()-start);
      const dt=scenario==='brigade'?1/30:.25,steps=Math.round(120/dt);
      try{for(let i=0;i<steps;i++){
        if(m.live)await new Promise(requestAnimationFrame);
        sim=i*dt;const people=scenario==='brigade'?ConquerFire.brigade.carriers():scenario==='walls'?ConquerCombat.units():ConquerCombat.enemy(),before=new Map(people.map(u=>[u.id,{x:u.x,y:u.y,z:u.z||0}]));
        const tick=m.now(),nav=navPerf.navInvalidations;if(scenario==='brigade')ConquerFire.tick(dt);else ConquerCombat.tick(dt);m.ticks.push(m.now()-tick);
        for(const u of (scenario==='brigade'?ConquerFire.brigade.carriers():people)){
          const p=before.get(u.id);if(p){m.distance[u.id]=(m.distance[u.id]||0)+Math.hypot(u.x-p.x,u.y-p.y);if((u.z||0)>p.z+.001)m.seenUp.add(u.id);if((u.z||0)<p.z-.001)m.seenDown.add(u.id)}
          if(u.wall)m.seenWall.add(u.id);
          if(scenario==='brigade'&&p&&nav===navPerf.navInvalidations&&Math.hypot(u.x-p.x,u.y-p.y)>.01&&!peasantSegmentClear(p,u,null))m.blocked++;
        }
        if(scenario==='brigade')m.splashes=Math.max(m.splashes,State.fire.splashes.length);
        if(m.live)requestSceneDraw();
        if(m.live&&[20,60].some(t=>i===Math.round(t/dt))){await new Promise(requestAnimationFrame);await window.__round3Capture(Math.round(sim)+'s')}
        if(scenario==='walls'&&!down&&ConquerCombat.units().every(u=>u.wall&&!u.legs?.length)){
          upComplete=true;down=true;for(const u of ConquerCombat.units())u.legs=ConquerCombat.planLegs(u,{ground:{x:__stair.x+2,y:__stair.y+2}});
        }
        if(i%Math.round(10/dt)===0){m.samples.push({sim,units:people.map(u=>({id:u.id,x:u.x,y:u.y,z:u.z,state:u.state,target:u.target,path:u.path?.length,retry:u.retry,wall:u.wall,climbing:u.climbing,hp:u.stats?.hp,damage:u.damageDealt}))});const d=m.now();draw();m.draws.push(m.now()-d)}
      }}finally{performance.now=original}
      const people=scenario==='brigade'?ConquerFire.brigade.carriers():scenario==='walls'?ConquerCombat.units():ConquerCombat.enemy();
      const live=m.live?{wallMs:m.now()-start,draw:summary(m.liveDraws),frames:summary(m.frames.slice(1).map((t,i)=>t-m.frames[i]))}:undefined;m.live=false;
      return{scenario,accepted,actionMs,simSeconds:120,live,ticks:summary(m.ticks),paths:summary(m.paths.map(p=>p.ms)),draw:summary(m.draws),seenUp:m.seenUp.size,seenWall:m.seenWall.size,seenDown:m.seenDown.size,upComplete,distance:m.distance,blocked:m.blocked,splashes:m.splashes,final:people.map(u=>({id:u.id,x:u.x,y:u.y,z:u.z,wall:u.wall,climbing:u.climbing,hp:u.stats?.hp,damage:u.damageDealt,legs:u.legs?.map(l=>l.kind)})),defenders:ConquerCombat.units().map(u=>({hp:u.stats?.hp,damage:u.damageDealt})),samples:m.samples,perf:{...window.__conquerPerf}};
    },scenario);
    const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(out,`${label}-${mode}-${scenario}.cpuprofile`),JSON.stringify(profile));await cdp.detach();
    result.mode=mode;result.runtime=await page.evaluate(()=>({world:ConquerWorld3D.status().failed,combatFaults:window.__conquerCombatFaults||0,suspended:!!window.__conquerCombatSuspended}));report.results.push(result);fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));
    if(scenario==='collapse'&&mode==='canvas'&&process.env.PERF_PIXELS==='1'){
      const current=fs.readFileSync(path.join(root,'src/settlement-siege.js'),'utf8');
      const old=fs.readFileSync(path.join(out,'before/src/settlement-siege.js'),'utf8');
      const legacy=old.slice(old.indexOf('  function drawMeshes2D('),old.indexOf('  function drawOverlay('));
      const compiled=current.slice(current.indexOf('  let rubbleBitmap='),current.indexOf('  function drawOverlay('));
      result.pixels=await page.evaluate(({legacy,compiled})=>{
        const oldDraw=eval('('+legacy+')'),modern=eval('(()=>{'+compiled+';return {drawRubble2D,drawMeshes2D}})()'),checks=[];
        const compare=(drawA,drawB)=>{
          const ca=document.createElement('canvas'),cb=document.createElement('canvas');ca.width=cb.width=canvas.width;ca.height=cb.height=canvas.height;
          const a=ca.getContext('2d'),b=cb.getContext('2d');withRenderContext(a,drawA);withRenderContext(b,drawB);
          const p=a.getImageData(0,0,ca.width,ca.height).data,q=b.getImageData(0,0,cb.width,cb.height).data;let pixels=0,diff=0,error=0;
          for(let i=0;i<p.length;i+=4)if(p[i+3]||q[i+3]){pixels++;let max=0;for(let k=0;k<4;k++){const d=Math.abs(p[i+k]-q[i+k]);error+=d;max=Math.max(max,d)}if(max>16)diff++}
          return{pixels,differingFraction:diff/Math.max(1,pixels),meanChannelError:error/Math.max(1,pixels*4)};
        };
        const stamp=performance.now;performance.now=()=>1e8;const meshes=ConquerSiege.dynamicMeshes();performance.now=stamp;
        for(const rotation of [0,1,2,3]){
          State.view.rotation=rotation;
          checks.push({rotation,kind:'legacy',...compare(()=>oldDraw(meshes),()=>modern.drawMeshes2D(meshes))});
          checks.push({rotation,kind:'cache',...compare(()=>modern.drawMeshes2D(meshes),()=>modern.drawRubble2D(meshes))});
          State.view.x+=31;State.view.y-=17;
          checks.push({rotation,kind:'pan',...compare(()=>modern.drawMeshes2D(meshes),()=>modern.drawRubble2D(meshes))});
        }
        for(const material of ['stone','wood','timber'])for(const time of [.4,1.2,Infinity]){
          const spec={id:'pixel-'+material,parts:[[{x:96,y:96},{x:98,y:96},{x:98,y:98},{x:96,y:98}]],z0:0,z1:3,ground:0,seed:42,material};
          const moving=[ConquerCollapse.mesh(spec,time)];
          if(!Number.isFinite(time))moving[0].static=true;
          checks.push({material,time:Number.isFinite(time)?time:'settled',kind:'legacy',...compare(()=>oldDraw(moving),()=>modern.drawMeshes2D(moving))});
        }
        State.view.scale=1.25;State.view.plan=true;
        State.view.x=canvas.width/2-100*U*1.25;State.view.y=canvas.height/2-100*U*1.25;
        checks.push({kind:'cache-plan-zoom',...compare(()=>modern.drawMeshes2D(meshes),()=>modern.drawRubble2D(meshes))});
        return checks;
      },{legacy,compiled});
      console.log('PIXELS '+JSON.stringify(result.pixels));
      for(const check of result.pixels){assert.ok(check.pixels>100);assert.ok(check.differingFraction<(check.kind==='legacy'?.03:.02)&&check.meanChannelError<(check.kind==='legacy'?2:1),JSON.stringify(check))}
    }
    console.log(JSON.stringify({...result,samples:undefined,perf:undefined,final:undefined,distance:undefined}));
    await page.screenshot({path:path.join(out,`${label}-${mode}-${scenario}.png`)});
    if(process.env.PERF_ASSERT==='1'){
      assert.equal(report.errors.length,0,JSON.stringify(report.errors));
      assert.equal(result.runtime.combatFaults,0);assert.equal(result.runtime.suspended,false);if(mode==='webgl')assert.equal(result.runtime.world,null);
      if(scenario==='brigade'){assert.ok(Object.values(result.distance).filter(d=>d>5).length===6,'all six women must really move');assert.equal(result.blocked,0,'no walking through obstacles');assert.ok(result.splashes>0,'water must reach a fire')}
      if(scenario==='walls'){assert.equal(result.accepted,6);assert.equal(result.seenUp,6);assert.equal(result.seenWall,6);assert.equal(result.seenDown,6);assert.ok(result.upComplete);assert.ok(result.final.every(u=>!u.wall&&!u.legs&&u.z===0))}
      if(scenario==='assault'){assert.equal(result.accepted,true);assert.equal(result.final.length,20);assert.equal(result.seenWall,20);assert.equal(result.seenDown,20);assert.ok(result.defenders.some(u=>u.damage>0)||result.final.some(u=>u.damage>0),'real combat must occur')}
    }
    await context.close();
  }}finally{await browser.close();server.close()}
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});
