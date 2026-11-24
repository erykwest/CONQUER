// Hill-edge tower test: every stone tower shape/W with each base style, straddling the crest of a
// gentle slope (plateau north, downhill +y). Shots from downhill (base on the slope) and uphill (door).
// usage: node hilltowers.cjs <outDir> [url]
const {chromium}=require(process.env.PW||'playwright');
const fs=require('fs'),path=require('path');
const out=process.argv[2]||'shots';fs.mkdirSync(out,{recursive:true});
const url=process.argv[3]||'http://127.0.0.1:4618/index.html?demo=mouth-sea&seed=4242';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME});
  const page=await browser.newPage({viewport:{width:1500,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(()=>window.ConquerWorld3D&&State.environment?.length&&typeof beginPopulationFrame==='function',null,{timeout:60000});
  await page.addStyleTag({content:'body>*:not(#wrap){display:none!important} #wrap>*:not(canvas){display:none!important} #conquerMinimapCanvas{display:none!important}'});
  await page.evaluate(()=>{
    window.__fixed=typeof orientTowerToSummit==='function';window.__rows=[['square',1],['square',2],['square',3],['square',4],['round',1],['round',2],['round',3],['dee',2],['dee',3]];
    window.__build=(base)=>{
      State.structures=[];State.environment=[];State.season="summer";State.biome="plains";
      State.clock.speed=0;State.clock.day=10.5;State.daylightOverride='day';State.weatherOverride='sun';
      State.relief={seed:7,hills:[{id:'h',levels:[{id:'L1',z0:0,z1:1,gentleBase:2.5,steepBase:.6,
        top:[{x:70,y:50},{x:140,y:50},{x:140,y:100},{x:70,y:100}],center:{x:105,y:75},edgeKinds:['gentle','gentle','gentle','gentle']}]}]};
      clearReliefBandCache();
      let x=84;const info=[];
      for(const [shape,t] of __rows){
        const s={id:'t'+shape+t,type:'tower',material:'stone',shape,level:2,tier:t,roofStyle:'battlement',baseStyle:base,x,y:100.5,angle:0};
        if(shape==='round')s.r=towerSizeForTier('round',t);
        else if(shape==='dee'){s.size=t===3?2:1.5;s.angle=0}
        else s.size=towerSizeForTier('square',t);
        if(window.__fixed)orientTowerToSummit(s);
        State.structures.push(s);x+=t===4?5.5:4.5;
      }
      invalidateSceneCache();clearReliefBandCache();
      for(const s of State.structures){
        const d=towerDoorSpecs(s).find(q=>q.kind==='front');
        info.push({verdict:window.__fixed?towerEntranceSummitVerdict(s):null,id:s.id,base:towerBaseStyle(s),angle:+(s.angle||0).toFixed(2),floor:+placementGroundZ(s).toFixed(2),
          door:d?{out:[+d.outward.x.toFixed(2),+d.outward.y.toFixed(2)],ground:+terrainElevation({x:d.contact.x+d.outward.x*.15,y:d.contact.y+d.outward.y*.15}).toFixed(2)}:null});
      }
      return info;
    };
    window.__cam=(rot,cx,cy,scale)=>{State.view.rotation=rot;State.view.scale=scale;
      const rc=document.getElementById('wrap').getBoundingClientRect(),p=w2s({x:cx,y:cy},1.6);
      State.view.x+=rc.width/2-p.x;State.view.y+=rc.height*.55-p.y;invalidateSceneCache();};
  });
  const settle=async()=>{for(let i=0;i<25;i++){await page.evaluate(()=>draw());await page.waitForTimeout(60)}};
  const report={};
  for(const base of ['standard','buttress','splayed']){
    report[base]=await page.evaluate(b=>__build(b),base);
    // Two halves (square row, round+dee row), each from downhill and from uphill.
    for(const [part,cx] of [["square",91],["round",108.5],["dee",121]]){
      for(const [side,rot] of [['downhill',0],['uphill',2]]){
        await page.evaluate(([r,c])=>__cam(r,c,100.5,4.6),[rot,cx]);
        await settle();
        await page.screenshot({path:path.join(out,`${base}-${part}-${side}.png`)});
      }
    }
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({report,errs},null,1));
  console.log(JSON.stringify({errs:errs.slice(0,5)}));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
