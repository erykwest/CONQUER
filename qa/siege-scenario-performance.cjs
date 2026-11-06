'use strict';
// Siege scenario (performance): the TEST layout (layouts/TEST.json: Portoreale, a castle with four
// L3 towers in cutaway, T3 walls, a gate, a port and six ships) attacked by 25 men-at-arms,
// 15 archers and 3 knights, with a ram at the gate, an assault tower on the east wall and two
// trebuchets (when the build has ConquerTrebuchets). The game runs on its own loop in headless
// Chrome; the report gives the first combat tick, combat tick and frame percentiles, and the
// losses after SIEGE_SECONDS of game time.
//   node qa/siege-scenario-performance.cjs [label]
//   env: SIEGE_LAYOUT (layout JSON, default layouts/TEST.json of this checkout), SIEGE_SECONDS
//   (default 60), SIEGE_CONCENTRIC=1 for QA-only nested rings on the TEST village, SIEGE_TREBUCHETS=0 to leave them out (to compare with builds without them),
//   SIEGE_SCREENSHOT_INTERVAL (simulated seconds between paused screenshots; 0 = final only),
//   PERF_MODES (webgl,canvas; default webgl), QA_CHROME (a Chrome/Chromium executable).
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),label=process.argv[2]||'local';
const out=path.join(root,'output/playwright/siege-scenario');fs.mkdirSync(out,{recursive:true});
const layoutFile=process.env.SIEGE_LAYOUT||path.join(root,'layouts/TEST.json');
const seconds=Number(process.env.SIEGE_SECONDS||60),trebuchets=process.env.SIEGE_TREBUCHETS!=='0',concentric=process.env.SIEGE_CONCENTRIC==='1';
const screenshotInterval=Math.max(0,Number(process.env.SIEGE_SCREENSHOT_INTERVAL)||0);
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data)});
});
const pct=(a,p)=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(1)};
async function main(){
  const layout=fs.readFileSync(layoutFile,'utf8');JSON.parse(layout);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const launch={headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']};
  if(process.env.QA_CHROME)launch.executablePath=process.env.QA_CHROME;else launch.channel='chrome';
  const browser=await chromium.launch(launch);
  const git=args=>{try{return require('node:child_process').execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()}catch{return null}};
  const report={label,head:git(['rev-parse','--short','HEAD']),branch:git(['rev-parse','--abbrev-ref','HEAD']),dirty:!!git(['status','--porcelain']),layout:path.basename(layoutFile),seconds,trebuchets,concentric,screenshotInterval,startedAt:new Date().toISOString(),errors:[],results:[]};
  try{for(const mode of (process.env.PERF_MODES||'webgl').split(',')){
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
    await context.route(/supabase\.co\//,r=>r.abort());
    await context.addInitScript(json=>{
      if(!sessionStorage.getItem('siege-loaded')){localStorage.clear();localStorage.setItem('conquer.settlement.0.0',json);sessionStorage.setItem('siege-loaded','1')}
      let s=12345;Math.random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
    },layout);
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push({mode,error:e.message}));
    page.on('console',m=>{if(m.text().startsWith('[SIEGE_PROGRESS]'))console.log(m.text());if(m.type()==='error'&&/^CONQUER_|Uncaught/.test(m.text()))report.errors.push({mode,error:m.text()})});
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?`+(mode==='webgl'?'world3d=1':'renderer=canvas2d'),{waitUntil:'networkidle'});
    await page.waitForFunction(()=>typeof draw==='function'&&!!window.ConquerCombat&&window.ConquerCircle?.getStatus?.().ready&&State.village?.founded&&State.structures.length>50,null,{timeout:60000});
    console.log('Loaded '+mode+' '+label);
    const setup=await page.evaluate(({trebuchets,concentric,seconds,screenshotInterval})=>{
      State.daylightOverride='day';State.clock.day=Math.floor(State.clock.day)+.45;
      if(concentric){
        // QA-only geometry: keep the TEST village and replace its open castle in memory.
        const units=window.ConquerCombat.units();
        window.ConquerCombat.restore({version:2,fog:false,units,enemy:[],storms:[],strokes:[]});
        State.structures=State.structures.filter(s=>!s.siegeTestBay&&!/^(tw\d|w[NESW]\d?|gt|yard)$/.test(s.id));
        const T=(id,x,y)=>({id,type:'tower',shape:'square',size:2,x,y,level:2,material:'stone',angle:0,archerCount:0,functions:[]});
        const W=(id,a,b,aSnap,bSnap)=>({id,type:'wall',a,b,aSnap,bSnap,width:.6,level:2,tier:2,material:'stone',length:Math.hypot(b.x-a.x,b.y-a.y)});
        const ring=(p,lo,hi,top,bottom,gid)=>{
          const mid=(lo+hi)/2;
          return[T(p+'0',lo,top),T(p+'1',hi,top),T(p+'2',hi,bottom),T(p+'3',lo,bottom),
            {id:gid,type:'gate',x:mid,y:top,w:2,h:1.4,level:2,material:'stone',angle:-Math.PI/2,functions:[]},
            W(p+'n1',{x:lo+1,y:top},{x:mid-1,y:top},p+'0',gid),W(p+'n2',{x:mid+1,y:top},{x:hi-1,y:top},gid,p+'1'),
            W(p+'e',{x:hi,y:top+1},{x:hi,y:bottom-1},p+'1',p+'2'),W(p+'s',{x:hi-1,y:bottom},{x:lo+1,y:bottom},p+'2',p+'3'),
            W(p+'w',{x:lo,y:bottom-1},{x:lo,y:top+1},p+'3',p+'0')];
        };
        const keep={...T('qa-keep',100,114),size:3,level:3,isMastio:true,functions:['commonHall']};
        State.structures.push(...ring('ro',84,116,98,130,'go'),...ring('ri',92,108,106,122,'gi'),keep);
        window.ConquerSiege.restore(null);
        for(const id of ['go','gi'])window.ConquerSiege.setGateClosed(id,true);
        invalidateNavigation();invalidateSceneCache();window.ConquerWallWalk?.invalidate?.();window.ConquerCircle.invalidate('QA concentric rings');
      }
      const g=State.structures.find(s=>s.type==='gate');
      const E=window.ConquerCombat.enemy();
      const mk=(kind,i,x,y)=>{const u={id:'atk-'+kind+'-'+i,kind,combatKind:kind,faction:'dev_hostile',x,y,target:null};window.ConquerCombatRules?.ensure?.(u,kind);E.push(u);return u};
      let ram=null,tower=null;
      if(concentric){
        let patrol=0;
        for(const u of window.ConquerCombat.units()){
          const at=u.kind==='captain'?{x:103.2,y:114}:u.kind==='patrol'?[{x:88,y:110},{x:112,y:110},{x:100,y:104}][patrol++]:{x:100,y:102};
          Object.assign(u,at,{target:null,path:null,legs:null,wall:null,climbing:false});
        }
        for(let i=0;i<25;i++)mk('infantry',i,92+(i%9)*2,90-Math.floor(i/9)*1.2);
        for(let i=0;i<15;i++)mk('archer',i,92+(i%8)*2.2,85-Math.floor(i/8)*1.2);
        for(let i=0;i<3;i++)mk('knight',i,96+i*4,88);
      }else{
      const A=[];for(let i=0;i<8;i++)A.push(mk('infantry',i,98+(i%4)*.8,92-Math.floor(i/4)*.8));
      ram=g?window.ConquerCombat.addRamStorm(g):null;
      for(let i=0;i<12;i++)mk('infantry',8+i,122+(i%4)*.8,110+Math.floor(i/4)*.8);
      tower=window.ConquerCombat.addStorm('tower',{wallId:'wE',t:.5});
      for(const u of A){u.assault=ram?.id;u.legs=null;u.nextThink=0}
      for(let i=0;i<5;i++)mk('infantry',20+i,128+(i%3),100+i*1.2);
      for(let i=0;i<15;i++)mk('archer',i,130+(i%5)*.9,104+Math.floor(i/5)*2.4);
      for(let i=0;i<3;i++)mk('knight',i,134,98+i*4);
      }
      for(const u of window.ConquerCombat.units())window.ConquerCombatRules.ensure(u,u.combatKind||u.kind);
      window.ConquerCircle.updateControl(true);
      const treb=trebuchets&&window.ConquerTrebuchets?[{x:128,y:106},{x:128,y:118}].map(p=>window.ConquerTrebuchets.add(p)?.ok):[];
      // Instrument: combat ticks and frames, measured on the game's own loop.
      const m=window.__siege={ticks:[],draws:[],frames:[],gameSeconds:0,captures:[],transitions:[],nextCheckpoint:screenshotInterval||seconds};
      window.addEventListener('conquer-circle-captured',e=>m.captures.push(e.detail));
      window.addEventListener('conquer-circle-control-updated',e=>m.transitions.push(e.detail));
      const C=window.ConquerCombat,tick=C.tick;C.tick=function(...a){const t=performance.now();try{return tick.apply(this,a)}finally{m.ticks.push(performance.now()-t);m.gameSeconds+=Math.min(.25,Number(a[0])||0);if(m.gameSeconds+1e-6>=Math.min(seconds,m.nextCheckpoint))State.clock.speed=0;if(Math.floor(m.gameSeconds/10)>(m.progress||0)){m.progress=Math.floor(m.gameSeconds/10);console.log('[SIEGE_PROGRESS] '+m.gameSeconds.toFixed(1)+' s')}}};
      const d=draw;draw=function(...a){const t=performance.now();try{return d.apply(this,a)}finally{m.draws.push(performance.now()-t)}};
      let last=performance.now();const f=t=>{m.frames.push(t-last);last=t;if(!m.stop)requestAnimationFrame(f)};requestAnimationFrame(f);
      // Camera on the castle, game running.
      const r=wrap.getBoundingClientRect();State.view.scale=1.4;
      for(let k=0;k<4;k++){const q=w2s({x:104,y:108},0);State.view.x+=r.width/2-q.x;State.view.y+=r.height/2-q.y}
      State.clock.speed=screenshotInterval?0:1;
      const alive=a=>a.filter(u=>!u.defeated&&(u.stats?.hp??1)>0).length;
      return{blockedStarts:C.units().concat(E).filter(u=>pointBlockedForPeasant(u,u.id)).map(u=>({id:u.id,x:u.x,y:u.y})),ram:!!ram,tower:!!tower,trebuchets:treb.filter(Boolean).length,attackers:E.length,attackersHp:E.reduce((n,u)=>n+(u.stats?.hp||0),0),defenders:alive(C.units()),defendersHp:C.units().reduce((n,u)=>n+(u.stats?.hp||0),0),sectors:window.ConquerCircle?.getSnapshot?.()?.compartments.map(c=>({id:c.id,depth:c.depth,state:c.state,mastio:c.mastio})),structures:State.structures.length,
        archers:State.structures.filter(s=>s.type==='tower').reduce((n,t)=>n+(window.ConquerSiege?.occupiedArcherSlots?.(t)?.length||0),0)};
    },{trebuchets,concentric,seconds,screenshotInterval});
    console.log('Setup '+JSON.stringify(setup));
    if(setup.blockedStarts.length)throw Error('QA units start in blocked terrain: '+JSON.stringify(setup.blockedStarts));
    if(concentric&&(setup.sectors.length!==2||!setup.sectors.some(c=>c.depth===2&&c.mastio)))throw Error('QA rings must enclose two sectors with the keep in the inner sector');
    // Game time, not wall time: wait until the clock has run SIEGE_SECONDS of combat.
    const t0=Date.now();
    const checkpoints=[];
    let done=true;
    if(screenshotInterval){
      const targets=[0];
      for(let n=screenshotInterval;n<seconds;n+=screenshotInterval)targets.push(n);
      targets.push(seconds);
      for(const target of targets){
        if(target){
          await page.evaluate(n=>{window.__siege.nextCheckpoint=n;State.clock.speed=1},target);
          done=await page.waitForFunction(n=>window.__siege.gameSeconds+1e-6>=n,target,{timeout:Math.max(180000,seconds*20000),polling:500}).then(()=>true,()=>false);
        }
        const checkpoint=await page.evaluate(()=>{
          State.clock.speed=0;window.ConquerCircle.updateControl(true);draw();
          const C=window.ConquerCombat,alive=a=>a.filter(u=>!u.defeated&&(u.stats?.hp??1)>0);
          const units=a=>a.map(u=>({id:u.id,kind:u.combatKind||u.kind,x:u.x,y:u.y,hp:u.stats?.hp,defeated:!!u.defeated,routing:!!u.routing,retreatTo:u.retreatTo||null,assault:u.assault||null,atKeep:!!u.atKeep,legs:u.legs?.length||0}));
          return{gameSeconds:window.__siege.gameSeconds,attackersAlive:alive(C.enemy()).length,defendersAlive:alive(C.units()).length,
            attackersHp:C.enemy().reduce((n,u)=>n+(u.stats?.hp||0),0),defendersHp:C.units().reduce((n,u)=>n+(u.stats?.hp||0),0),
            sectors:window.ConquerCircle.getSnapshot()?.compartments.map(c=>({id:c.id,depth:c.depth,mastio:c.mastio,state:c.state,control:c.control})),
            doors:State.structures.filter(s=>s.type==='gate').map(g=>({id:g.id,stage:window.ConquerSiege.doorStage(g),closed:window.ConquerSiege.gateClosed(g)})),
            attackers:units(C.enemy()),defenders:units(C.units())};
        });
        checkpoint.targetSeconds=target;
        checkpoint.screenshot=`${label}-${mode}-${String(target).padStart(3,'0')}s.png`;
        await page.screenshot({path:path.join(out,checkpoint.screenshot),timeout:60000});
        checkpoints.push(checkpoint);
        fs.writeFileSync(path.join(out,`${label}-${mode}-checkpoints.json`),JSON.stringify({label,head:report.head,setup,checkpoints},null,2));
        console.log('[SIEGE_CHECKPOINT] '+JSON.stringify({target,actual:+checkpoint.gameSeconds.toFixed(2),attackers:checkpoint.attackersAlive,defenders:checkpoint.defendersAlive,sectors:checkpoint.sectors,screenshot:checkpoint.screenshot}));
        if(!done)break;
      }
    }else done=await page.waitForFunction(n=>window.__siege.gameSeconds>=n,seconds,{timeout:Math.max(180000,seconds*20000),polling:500}).then(()=>true,()=>false);
    if(!done)report.errors.push({mode,error:'timeout before '+seconds+' s of game time'});
    const wall=(Date.now()-t0)/1000;
    const res=await page.evaluate(()=>{
      const m=window.__siege;m.stop=true;const C=window.ConquerCombat;
      const alive=a=>a.filter(u=>!u.defeated&&(u.stats?.hp??1)>0);
      const g=State.structures.find(s=>s.type==='gate');
      State.clock.speed=0;
      return{doors:State.structures.filter(s=>s.type==='gate').map(g=>({id:g.id,stage:window.ConquerSiege.doorStage(g)})),defendersHp:Math.round(C.units().reduce((n,u)=>n+(u.stats?.hp||0),0)),captures:m.captures,transitions:m.transitions,sectors:window.ConquerCircle?.getSnapshot?.()?.compartments.map(c=>({id:c.id,depth:c.depth,state:c.state,mastio:c.mastio,control:c.control})),gameSeconds:m.gameSeconds,ticks:m.ticks,draws:m.draws,frames:m.frames.slice(1),attackersAlive:alive(C.enemy()).length,defendersAlive:alive(C.units()).length,
        attackersHp:Math.round(C.enemy().reduce((n,u)=>n+(u.stats?.hp||0),0)),door:window.ConquerSiege?.doorStage?.(g)||null,
        insideCastle:C.enemy().filter(u=>u.x>89&&u.x<111&&u.y>101&&u.y<123&&!u.wall).length,onWalls:C.enemy().filter(u=>u.wall).length,
        trebuchetShots:(window.ConquerTrebuchets?.list?.()||[]).reduce((n,t)=>n+t.shots,0)};
    });
    // The page can be too busy to paint a screenshot in time: optional.
    await page.screenshot({path:path.join(out,`${label}-${mode}.png`),timeout:60000}).catch(e=>report.errors.push({mode,error:'screenshot: '+e.message.split('\n')[0]}));
    report.results.push({mode,setup,checkpoints,wallSeconds:+wall.toFixed(1),gameSeconds:+res.gameSeconds.toFixed(1),
      firstTickMs:res.ticks[0]!=null?+res.ticks[0].toFixed(1):null,
      tickMs:{n:res.ticks.length,p50:pct(res.ticks,.5),p95:pct(res.ticks,.95),max:pct(res.ticks,1)},
      drawMs:{n:res.draws.length,p50:pct(res.draws,.5),p95:pct(res.draws,.95),max:pct(res.draws,1)},
      frameMs:{n:res.frames.length,p50:pct(res.frames,.5),p95:pct(res.frames,.95),max:pct(res.frames,1)},
      outcome:{doors:res.doors,sectors:res.sectors,captures:res.captures,transitions:res.transitions,defendersHp:res.defendersHp,attackersAlive:res.attackersAlive,attackersHp:res.attackersHp,defendersAlive:res.defendersAlive,door:res.door,insideCastle:res.insideCastle,onWalls:res.onWalls,trebuchetShots:res.trebuchetShots}});
    await context.close();
  }}finally{await browser.close();server.close()}
  fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({label:report.label,head:report.head,branch:report.branch,errors:report.errors.length,results:report.results.map(r=>({mode:r.mode,setup:r.setup,wall:r.wallSeconds,game:r.gameSeconds,firstTickMs:r.firstTickMs,tick:r.tickMs,draw:r.drawMs,frame:r.frameMs,outcome:r.outcome}))},null,1));
  if(report.errors.length){console.log('errors:',JSON.stringify(report.errors.slice(0,5)));process.exitCode=1}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});
