'use strict';
// 70 individual soldiers. Native movement, damage, dice, arrows and deaths;
// the fixture supplies repeated move/hold orders instead of human clicks.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/mass-battle'),label=process.argv[2]||'local';
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)});
});
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const git=args=>require('node:child_process').execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const report={label,startedAt:new Date().toISOString(),head:git(['rev-parse','HEAD']),dirty:!!git(['status','--porcelain']),contextOverrides:{preserveDrawingBuffer:process.env.BATTLE_PRESERVE_BUFFER===undefined?null:process.env.BATTLE_PRESERVE_BUFFER==='1'},sources:Object.fromEntries(['src/settlement-combat.js','src/settlement-combat-rules.js','src/settlement-world3d.js','src/settlement-app-simulation.js','src/settlement-render.js'].map(f=>[f,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')])),browser:browser.version(),errors:[],results:[]};
  try{for(const mode of (process.env.PERF_MODES||'webgl,canvas').split(',')){
    const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
    await context.route(/supabase\.co\//,r=>r.abort());
    await context.addInitScript(()=>{localStorage.setItem('conquer.seed.0.0','12345');let s=12345;Math.random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)});
    if(process.env.BATTLE_PRESERVE_BUFFER!==undefined)await context.addInitScript(preserve=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,options){return original.call(this,type,type==='webgl2'?{...options,preserveDrawingBuffer:preserve}:options)};
    },process.env.BATTLE_PRESERVE_BUFFER==='1');
    await context.addInitScript(()=>{
      const samples=window.__massGpu={getError:[],clientWaitSync:[],fenceSync:[],flush:[],drawImage:[]};
      for(const [proto,names] of [[WebGL2RenderingContext.prototype,['getError','clientWaitSync','fenceSync','flush']],[CanvasRenderingContext2D.prototype,['drawImage']]])for(const name of names){
        const original=proto[name];proto[name]=function(...args){const t=performance.now();try{return original.apply(this,args)}finally{samples[name].push(performance.now()-t)}};
      }
    });
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push({mode,error:e.message}));
    page.on('console',m=>{if(m.type()==='error'&&/^CONQUER_|Uncaught/.test(m.text()))report.errors.push({mode,error:m.text()})});
    await page.exposeFunction('__massCapture',stage=>page.screenshot({path:path.join(out,`${label}-${mode}-${stage}.png`)}));
    await page.exposeFunction('__massProgress',data=>console.log(JSON.stringify({mode,...data})));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html?`+(mode==='webgl'?'world3d=1':'renderer=canvas2d'),{waitUntil:'networkidle'});
    const initial=await page.evaluate(()=>{
      State.clock.speed=0;State.clock.day=20;State.daylightOverride='day';State.seasonOverride='summer';State.biome='test';
      State.environment=[];State.relief={hills:[],seed:12345};clearReliefBandCache();State.fire=null;State.siege=null;
      State.village={founded:true,wellId:'battle-well',nextGrowthDay:1e9};State.structures=[{id:'battle-well',type:'well',x:130,y:130}];
      ConquerSiege.restore(null);
      const team=(side,counts)=>{
        const units=[],sign=side==='defenders'?-1:1,faction=side==='defenders'?'realm':'dev_hostile';
        for(const [kind,count] of Object.entries(counts))for(let i=0;i<count;i++){
          const x=kind==='archer'?100+sign*(9+Math.floor(i/5)*.8):kind==='knight'?100+sign*4:100+sign*(3.5+Math.floor(i/5)*.8);
          const y=kind==='knight'?93+i*3.2:97+(i%5)*1.5;
          units.push({id:side+'-'+kind+'-'+i,kind,combatKind:kind,faction,x,y,target:null});
        }
        return units;
      };
      ConquerCombat.restore({version:2,fog:false,zones:false,units:team('defenders',{archer:15,infantry:20,knight:5}),enemy:team('attackers',{archer:10,knight:3,infantry:17}),storms:[],strokes:[]});
      ConquerWallWalk.invalidate();invalidateNavigation();invalidateSceneCache();
      const r=wrap.getBoundingClientRect();State.view.scale=1.65;State.view.x=r.width/2-65;State.view.y=r.height/2-100*U*1.65;
      for(const u of State.combat.units.concat(State.combat.enemy))ConquerCombatRules.ensure(u,u.combatKind);
      draw();draw();
      let seed=12345;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      const m=window.__mass={now:performance.now.bind(performance),rng,ticks:[],draws:[],skipped:0,frames:[],orders:[],timeline:[],distance:{},active:true};
      for(const samples of Object.values(window.__massGpu))samples.length=0;
      const original=draw;draw=function(...a){const t=m.now(),r=original(...a);if(r===false)m.skipped++;else m.draws.push(m.now()-t);return r};
      const frame=t=>{m.frames.push(t);if(m.active)requestAnimationFrame(frame)};requestAnimationFrame(frame);
      const count=units=>Object.fromEntries(['archer','infantry','knight'].map(kind=>[kind,units.filter(u=>u.kind===kind&&u.stats.hp>0).length]));
      return{defenders:count(State.combat.units),attackers:count(State.combat.enemy),total:State.combat.units.length+State.combat.enemy.length};
    });
    assert.deepEqual(initial,{defenders:{archer:15,infantry:20,knight:5},attackers:{archer:10,infantry:17,knight:3},total:70});
    await page.screenshot({path:path.join(out,`${label}-${mode}-start.png`)});
    const cdp=await context.newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
    const result=await page.evaluate(async({maxSeconds,renderEvery})=>{
      const m=window.__mass,R=ConquerCombatRules,dt=.1,started=m.now();
      const alive=units=>units.filter(u=>!u.defeated&&u.stats.hp>0);
      const summary=a=>{const s=a.slice().sort((a,b)=>a-b);return{count:s.length,total:s.reduce((a,b)=>a+b,0),p50:s[Math.floor(s.length*.5)]||0,p95:s[Math.floor(s.length*.95)]||0,max:s.at(-1)||0}};
      const counts=team=>Object.fromEntries(['archer','infantry','knight'].map(kind=>[kind,alive(team).filter(u=>u.kind===kind).length]));
      const hp=team=>team.reduce((s,u)=>s+u.stats.hp,0);
      const snapshot=()=>({seconds:+R.time.toFixed(1),defenders:counts(State.combat.units),attackers:counts(State.combat.enemy),hpDefenders:hp(State.combat.units),hpAttackers:hp(State.combat.enemy)});
      function command(team,foes){
        for(const u of alive(team)){
          if(u.engaged||u.routing)continue;
          let target=null,d=Infinity;
          for(const e of foes){const gap=Math.hypot(u.x-e.x,u.y-e.y);if(gap<d){target=e;d=gap}}
          if(!target)continue;
          const archer=u.kind==='archer',reach=archer?11.5:.72;
          if(d<=(archer?12: .85)){u.legs=null;u.target=null;continue}
          const goal={x:target.x+(u.x-target.x)/d*reach,y:target.y+(u.y-target.y)/d*reach};
          if(u.legs?.length&&u.battleGoal&&Math.hypot(goal.x-u.battleGoal.x,goal.y-u.battleGoal.y)<1)continue;
          const t=m.now(),legs=ConquerCombat.planLegs(u,{ground:goal});m.orders.push(m.now()-t);
          if(legs){u.legs=legs;u.path=null;u.target=null;u.battleGoal=goal}
        }
      }
      m.timeline.push(snapshot());let capturedHalf=false,lastProgress=-60,lastHp=hp(State.combat.units)+hp(State.combat.enemy),noDamage=0,reason='limit',steps=0;
      for(;steps<Math.ceil(maxSeconds/dt);steps++){
        if(steps%10===0){const d=alive(State.combat.units),a=alive(State.combat.enemy);command(d,a);command(a,d)}
        const before=State.combat.units.concat(State.combat.enemy).map(u=>({id:u.id,x:u.x,y:u.y}));
        const random=Math.random;Math.random=m.rng;const t=m.now();
        try{ConquerCombat.tick(dt)}finally{Math.random=random}
        m.ticks.push(m.now()-t);
        State.combat.units.concat(State.combat.enemy).forEach((u,i)=>{const p=before[i];m.distance[u.id]=(m.distance[u.id]||0)+Math.hypot(u.x-p.x,u.y-p.y)});
        const d=alive(State.combat.units).length,a=alive(State.combat.enemy).length;
        if(steps%100===0||!d||!a)m.timeline.push(snapshot());
        if(!d||!a){reason=!d&&!a?'mutual-elimination':!a?'defenders-win':'attackers-win';break}
        const totalHp=hp(State.combat.units)+hp(State.combat.enemy);
        if(totalHp<lastHp){lastHp=totalHp;noDamage=0}else noDamage+=dt;
        if(noDamage>300){reason='stalled-no-damage';break}
        if(R.time-lastProgress>=60){lastProgress=R.time;await window.__massProgress(snapshot())}
        if(steps%renderEvery===0){requestSceneDraw();await new Promise(requestAnimationFrame)}
        if(!capturedHalf&&R.time>=60){capturedHalf=true;requestSceneDraw();await new Promise(requestAnimationFrame);await window.__massCapture('engaged')}
      }
      requestSceneDraw();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);m.active=false;
      const final=State.combat.units.concat(State.combat.enemy).map(u=>({id:u.id,kind:u.kind,faction:u.faction,hp:u.stats.hp,maxHp:u.stats.maxHp,energy:u.stats.energy,brain:u.stats.brain,defeated:!!u.defeated,routing:!!u.routing,damage:u.damageDealt||0,x:u.x,y:u.y}));
      return{reason,steps:steps+1,seconds:+R.time.toFixed(1),wallMs:m.now()-started,initial:{defenders:40,attackers:30},remaining:snapshot(),timeline:m.timeline,final,distance:m.distance,ticks:summary(m.ticks),draw:summary(m.draws),skippedDraws:m.skipped,gpu:Object.fromEntries(Object.entries(window.__massGpu).map(([name,samples])=>[name,summary(samples)])),frames:summary(m.frames.slice(1).map((t,i)=>t-m.frames[i])),orders:summary(m.orders),runtime:{world:ConquerWorld3D.status().failed,combatFaults:window.__conquerCombatFaults||0,suspended:!!window.__conquerCombatSuspended}};
    },{maxSeconds:Number(process.env.BATTLE_MAX_SECONDS||7200),renderEvery:Number(process.env.BATTLE_RENDER_EVERY||20)});
    const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(out,`${label}-${mode}.cpuprofile`),JSON.stringify(profile));await cdp.detach();
    await page.screenshot({path:path.join(out,`${label}-${mode}-end.png`)});
    report.results.push({mode,...result});fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({mode,...result,timeline:undefined,final:undefined,distance:undefined}));
    assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(result.runtime.combatFaults,0);assert.equal(result.runtime.suspended,false);if(mode==='webgl')assert.equal(result.runtime.world,null);
    assert.ok(['defenders-win','attackers-win','mutual-elimination'].includes(result.reason),'battle must reach genuine elimination: '+result.reason);
    for(const side of ['defenders','attackers'])for(const kind of ['archer','infantry','knight'])assert.ok(result.final.some(u=>u.id.startsWith(side+'-'+kind)&&u.damage>0),side+' '+kind+' must really fight');
    if(process.env.BATTLE_VERIFY_RENDER==='1'){
      const checks=await page.evaluate(async mode=>{
        const anim=ConquerCombatAnim,u=State.combat.units.find(u=>u.stats.hp>0),foe=State.combat.enemy[0];
        anim.reset();anim.strike(u,foe);const before=window.__mass.draws.length;
        const poses=[],until=performance.now()+1000;
        while(performance.now()<until){await new Promise(requestAnimationFrame);poses.push(anim.pose(u).attack)}
        const paused={draws:window.__mass.draws.length-before,changed:poses.some(p=>p<0)&&poses.some(p=>p>0),ended:!anim.active()};
        if(mode!=='webgl')return{paused};
        const original=WebGL2RenderingContext.prototype.getError,started=performance.now();
        WebGL2RenderingContext.prototype.getError=()=>1281;
        try{
          while(!ConquerWorld3D.status().failed&&performance.now()-started<5000){draw();await new Promise(requestAnimationFrame)}
          draw();const c=document.getElementById('c');
          return{paused,fallback:{failed:ConquerWorld3D.status().failed,detectedMs:performance.now()-started,painted:c.getContext('2d').getImageData(c.width>>1,c.height>>1,1,1).data[3]>0}};
        }finally{WebGL2RenderingContext.prototype.getError=original}
      },mode);
      assert.ok(checks.paused.draws>0&&checks.paused.changed&&checks.paused.ended,'paused animation must finish without extra scene requests');
      if(mode==='webgl'){assert.match(checks.fallback.failed||'',/WebGL2 renderer failure/);assert.ok(checks.fallback.painted)}
      report.results.at(-1).checks=checks;fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(report,null,2));
      console.log(JSON.stringify({mode,checks}));
    }
    await context.close();
  }}finally{await browser.close();server.close()}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1});
