'use strict';
// Siege scenario (performance): the TEST layout (layouts/TEST.json: Portoreale, a castle with four
// L3 towers in cutaway, T3 walls, a gate, a port and six ships) attacked by 25 men-at-arms,
// 15 archers and 3 knights, with a ram at the gate, an assault tower on the east wall and two
// trebuchets (when the build has ConquerTrebuchets). The game runs on its own loop in headless
// Chrome; the report gives the first combat tick, combat tick and frame percentiles, and the
// losses after SIEGE_SECONDS of game time.
//   node qa/siege-scenario-performance.cjs [label]
//   env: SIEGE_LAYOUT (layout JSON, default layouts/TEST.json of this checkout), SIEGE_SECONDS
//   (default 30), SIEGE_TREBUCHETS=0 to leave them out (to compare with builds without them),
//   PERF_MODES (webgl,canvas; default webgl), QA_CHROME (a Chrome/Chromium executable).
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),label=process.argv[2]||'local';
const out=path.join(root,'output/playwright/siege-scenario');fs.mkdirSync(out,{recursive:true});
const layoutFile=process.env.SIEGE_LAYOUT||path.join(root,'layouts/TEST.json');
const seconds=Number(process.env.SIEGE_SECONDS||30),trebuchets=process.env.SIEGE_TREBUCHETS!=='0';
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
  const report={label,head:git(['rev-parse','--short','HEAD']),branch:git(['rev-parse','--abbrev-ref','HEAD']),layout:path.basename(layoutFile),seconds,trebuchets,startedAt:new Date().toISOString(),errors:[],results:[]};
  try{for(const mode of (process.env.PERF_MODES||'webgl').split(',')){
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
    await context.route(/supabase\.co\//,r=>r.abort());
    await context.addInitScript(json=>{
      if(!sessionStorage.getItem('siege-loaded')){localStorage.clear();localStorage.setItem('conquer.settlement.0.0',json);sessionStorage.setItem('siege-loaded','1')}
      let s=12345;Math.random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
    },layout);
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push({mode,error:e.message}));
    page.on('console',m=>{if(m.type()==='error'&&/^CONQUER_|Uncaught/.test(m.text()))report.errors.push({mode,error:m.text()})});
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?`+(mode==='webgl'?'world3d=1':'renderer=canvas2d'),{waitUntil:'networkidle'});
    await page.waitForFunction(()=>typeof draw==='function'&&!!window.ConquerCombat&&State.village?.founded&&State.structures.length>50,null,{timeout:60000});
    const setup=await page.evaluate(({trebuchets})=>{
      State.daylightOverride='day';State.clock.day=Math.floor(State.clock.day)+.45;
      const g=State.structures.find(s=>s.type==='gate');
      const E=window.ConquerCombat.enemy();
      const mk=(kind,i,x,y)=>{const u={id:'atk-'+kind+'-'+i,kind,combatKind:kind,faction:'dev_hostile',x,y,target:null};window.ConquerCombatRules?.ensure?.(u,kind);E.push(u);return u};
      const A=[];for(let i=0;i<8;i++)A.push(mk('infantry',i,98+(i%4)*.8,92-Math.floor(i/4)*.8));
      const ram=g?window.ConquerCombat.addRamStorm(g):null;
      for(let i=0;i<12;i++)mk('infantry',8+i,122+(i%4)*.8,110+Math.floor(i/4)*.8);
      const tower=window.ConquerCombat.addStorm('tower',{wallId:'wE',t:.5});
      for(const u of A){u.assault=ram?.id;u.legs=null;u.nextThink=0}
      for(let i=0;i<5;i++)mk('infantry',20+i,128+(i%3),100+i*1.2);
      for(let i=0;i<15;i++)mk('archer',i,130+(i%5)*.9,104+Math.floor(i/5)*2.4);
      for(let i=0;i<3;i++)mk('knight',i,134,98+i*4);
      const treb=trebuchets&&window.ConquerTrebuchets?[{x:128,y:106},{x:128,y:118}].map(p=>window.ConquerTrebuchets.add(p)?.ok):[];
      // Instrument: combat ticks and frames, measured on the game's own loop.
      const m=window.__siege={ticks:[],draws:[],frames:[],gameSeconds:0};
      const C=window.ConquerCombat,tick=C.tick;C.tick=function(...a){const t=performance.now();try{return tick.apply(this,a)}finally{m.ticks.push(performance.now()-t);m.gameSeconds+=Math.min(.25,Number(a[0])||0)}};
      const d=draw;draw=function(...a){const t=performance.now();try{return d.apply(this,a)}finally{m.draws.push(performance.now()-t)}};
      let last=performance.now();const f=t=>{m.frames.push(t-last);last=t;if(!m.stop)requestAnimationFrame(f)};requestAnimationFrame(f);
      // Camera on the castle, game running.
      const r=wrap.getBoundingClientRect();State.view.scale=1.4;
      for(let k=0;k<4;k++){const q=w2s({x:104,y:108},0);State.view.x+=r.width/2-q.x;State.view.y+=r.height/2-q.y}
      State.clock.speed=1;
      const alive=a=>a.filter(u=>!u.defeated&&(u.stats?.hp??1)>0).length;
      return{ram:!!ram,tower:!!tower,trebuchets:treb.filter(Boolean).length,attackers:E.length,defenders:alive(C.units()),structures:State.structures.length,
        archers:State.structures.filter(s=>s.type==='tower').reduce((n,t)=>n+(window.ConquerSiege?.occupiedArcherSlots?.(t)?.length||0),0)};
    },{trebuchets});
    // Game time, not wall time: wait until the clock has run SIEGE_SECONDS of combat.
    const t0=Date.now();
    const done=await page.waitForFunction(n=>window.__siege.gameSeconds>=n,seconds,{timeout:Math.max(180000,seconds*20000),polling:500}).then(()=>true,()=>false);
    if(!done)report.errors.push({mode,error:'timeout before '+seconds+' s of game time'});
    const wall=(Date.now()-t0)/1000;
    const res=await page.evaluate(()=>{
      const m=window.__siege;m.stop=true;const C=window.ConquerCombat;
      const alive=a=>a.filter(u=>!u.defeated&&(u.stats?.hp??1)>0);
      const g=State.structures.find(s=>s.type==='gate');
      return{gameSeconds:m.gameSeconds,ticks:m.ticks,draws:m.draws,frames:m.frames.slice(1),attackersAlive:alive(C.enemy()).length,defendersAlive:alive(C.units()).length,
        attackersHp:Math.round(C.enemy().reduce((n,u)=>n+(u.stats?.hp||0),0)),door:window.ConquerSiege?.doorStage?.(g)||null,
        insideCastle:C.enemy().filter(u=>u.x>89&&u.x<111&&u.y>101&&u.y<123&&!u.wall).length,onWalls:C.enemy().filter(u=>u.wall).length,
        trebuchetShots:(window.ConquerTrebuchets?.list?.()||[]).reduce((n,t)=>n+t.shots,0)};
    });
    // The page can be too busy to paint a screenshot in time: optional.
    await page.screenshot({path:path.join(out,`${label}-${mode}.png`),timeout:60000}).catch(e=>report.errors.push({mode,error:'screenshot: '+e.message.split('\n')[0]}));
    report.results.push({mode,setup,wallSeconds:+wall.toFixed(1),gameSeconds:+res.gameSeconds.toFixed(1),
      firstTickMs:res.ticks[0]!=null?+res.ticks[0].toFixed(1):null,
      tickMs:{n:res.ticks.length,p50:pct(res.ticks,.5),p95:pct(res.ticks,.95),max:pct(res.ticks,1)},
      drawMs:{n:res.draws.length,p50:pct(res.draws,.5),p95:pct(res.draws,.95),max:pct(res.draws,1)},
      frameMs:{n:res.frames.length,p50:pct(res.frames,.5),p95:pct(res.frames,.95),max:pct(res.frames,1)},
      outcome:{attackersAlive:res.attackersAlive,attackersHp:res.attackersHp,defendersAlive:res.defendersAlive,door:res.door,insideCastle:res.insideCastle,onWalls:res.onWalls,trebuchetShots:res.trebuchetShots}});
    await context.close();
  }}finally{await browser.close();server.close()}
  fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({label:report.label,head:report.head,branch:report.branch,errors:report.errors.length,results:report.results.map(r=>({mode:r.mode,setup:r.setup,wall:r.wallSeconds,game:r.gameSeconds,firstTickMs:r.firstTickMs,tick:r.tickMs,draw:r.drawMs,frame:r.frameMs,outcome:r.outcome}))},null,1));
  if(report.errors.length)console.log('errors:',JSON.stringify(report.errors.slice(0,5)));
}
main().catch(e=>{console.error(e);process.exitCode=1});
