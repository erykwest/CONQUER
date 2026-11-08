'use strict';
// Heraldry is campaign data; visual supports only clip the shared rectangular SVG.
(()=>{
// Partitions and default arms live in heraldry-shapes.js, shared with the 3D flags and sails.
const SHAPES=window.ConquerHeraldryShapes;
const DEFAULT={...SHAPES.DEFAULT};
const patterns=Object.keys(SHAPES.PATTERNS);
const $=id=>document.getElementById(id);
const validHex=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
let h={...DEFAULT,...(State.heraldry||{})};
function sanitize(){if(!patterns.includes(h.pattern))h.pattern=DEFAULT.pattern;for(const k of ['c1','c2','c3','c4'])if(!validHex(h[k]))h[k]=DEFAULT[k];if(!window.CONQUER_HERALDRY_SYMBOLS.some(s=>s.id===h.symbol))h.symbol='lion'}
function patternSvg(id,c1,c2){
 const d=SHAPES.PATTERNS[id];
 return '<rect width="100" height="100" fill="'+c2+'"/>'+(d?'<path d="'+d+'" fill="'+c1+'"/>':'');
}
function symbolSvg(entry=window.CONQUER_HERALDRY_SYMBOLS.find(s=>s.id===h.symbol),fill=h.c3,stroke=h.c4){
 const source=window.CONQUER_HERALDRY_SOURCES?.[entry?.source],box=entry?.viewBox;
 if(!source?.path||!Array.isArray(box)||box.length!==4)return '';
 const [x,y,w,height]=box;
 // Nested SVG viewports crop the original source sheet without duplicate clipPath IDs.
 // The paths are kept unmodified and recolored at rendering time.
 return '<svg x="17" y="17" width="66" height="66" viewBox="'+[x,y,w,height].join(' ')+'" preserveAspectRatio="xMidYMid meet" overflow="hidden"><path d="'+source.path+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}
function layers(){return patternSvg(h.pattern,h.c1,h.c2)+symbolSvg()}
function rectangle(){return svg('<g transform="scale(1.6 1)">'+patternSvg(h.pattern,h.c1,h.c2)+'</g><g transform="translate(30 0)">'+symbolSvg()+'</g>','0 0 160 100')}
function svg(content,view='0 0 100 100'){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+view+'" aria-hidden="true">'+content+'</svg>'}
function clip(type){
 const shape=type==='shield'?'M12 5H88V51Q84 77 50 96Q16 77 12 51Z':type==='banner'?'M17 2H83V96L50 81 17 96Z':'M4 12H96V88H4Z';
 return svg('<defs><clipPath id="herald-'+type+'"><path d="'+shape+'"/></clipPath></defs><g clip-path="url(#herald-'+type+')">'+layers()+'</g><path d="'+shape+'" fill="none" stroke="#15100c" stroke-width="2.5"/>');
}
function draw(){
 $('heraldryPatterns').innerHTML=patterns.map((p,i)=>'<button type="button" class="'+(p===h.pattern?'active':'')+'" data-pattern="'+p+'" aria-label="Partizione '+(i+1)+'" title="Partizione '+(i+1)+'">'+svg(patternSvg(p,'#111','#f1e7d7'))+'</button>').join('');
 $('heraldryColors').innerHTML=[['c1','Colore 1 · campo'],['c2','Colore 2 · campo'],['c3','Colore 3 · simbolo'],['c4','Colore 4 · contorno']].map(([k,label])=>'<label class="heraldry-color"><input type="color" data-heraldry-color="'+k+'" value="'+h[k]+'"><span>'+label+'</span></label>').join('');
 $('heraldrySymbols').innerHTML=window.CONQUER_HERALDRY_SYMBOLS.map(entry=>'<button type="button" title="'+entry.label+'" class="'+(h.symbol===entry.id?'active':'')+'" data-symbol="'+entry.id+'">'+svg(symbolSvg(entry,'#111','#e0d2bd'))+'<span>'+entry.label+'</span></button>').join('');

 $('heraldryFlag').innerHTML=rectangle();
 $('heraldryApplications').innerHTML=[['shield','Scudo'],['banner','Stendardo'],['cloth','Tessuto']].map(([type,label])=>'<div class="heraldry-application">'+clip(type)+'<span>'+label+'</span></div>').join('');
}
function persist(){sanitize();State.heraldry={...h};window.__conquerHeraldryCanvas?.invalidate();if(typeof invalidateSceneCache==='function')invalidateSceneCache();if(typeof draw==='function')draw();saveLocal();scheduleLocalSave();$('heraldrySaveStatus').textContent='Araldica salvata nella partita · locale';draw()}
function open(tab='general'){
 h={...DEFAULT,...(State.heraldry||{})};sanitize();
 $('profileOverlay').hidden=false;
 $('profileVillage').textContent=State.village?.name||'Insediamento non fondato';
 $('profileSeed').textContent=String(State.seed);
 $('profileBiome').textContent=(typeof BIOMES!=='undefined'&&BIOMES[State.biome]?.label)||State.biome;
 $('profileDay').textContent=(Number(State.clock?.day)||0).toFixed(1);
 setTab(tab);
}
function setTab(tab){document.querySelectorAll('[data-profile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.profileTab===tab));$('profileGeneral').hidden=tab!=='general';$('profileHeraldry').hidden=tab!=='heraldry';const control=$('profileControl');if(control)control.hidden=!['control','jobs','trade'].includes(tab);if(tab==='heraldry')draw();if(['control','jobs','trade'].includes(tab))window.ConquerPanels?.open(tab)}
function close(){$('profileOverlay').hidden=true}
sanitize();State.heraldry={...h};
$('profileBtn').addEventListener('click',()=>open());
$('profileClose').addEventListener('click',close);
$('profileDone').addEventListener('click',close);
$('profileOverlay').addEventListener('click',e=>{if(e.target===$('profileOverlay'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('profileOverlay').hidden)close()});
document.querySelectorAll('[data-profile-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.profileTab)));
$('heraldryPatterns').addEventListener('click',e=>{const b=e.target.closest('[data-pattern]');if(b){h.pattern=b.dataset.pattern;persist()}});
$('heraldrySymbols').addEventListener('click',e=>{const b=e.target.closest('[data-symbol]');if(b){h.symbol=b.dataset.symbol;persist()}});
$('heraldryColors').addEventListener('input',e=>{const k=e.target.dataset.heraldryColor;if(k&&validHex(e.target.value)){h[k]=e.target.value;persist()}});
window.__conquerHeraldry={reset:()=>{h={...DEFAULT};State.heraldry={...h};draw()},get:()=>({...State.heraldry}),render:()=>rectangle(),open:()=>open('heraldry')};
})();

'use strict';
// Cached, universal SVG pattern raster for the canvas renderer.
// Each object applies its own clipping shape before drawing.
(function(){
 let cachedKey='',image=null,ready=false;
 function update(){
  const h=State.heraldry||{};
  const key=JSON.stringify([h.pattern,h.c1,h.c2,h.symbol,h.c3,h.c4]);
  if(key===cachedKey)return;
  cachedKey=key;ready=false;image=null;
  const api=window.__conquerHeraldry;
  if(!api)return;
  const markup=api.render().replace(/<svg /,'<svg width="320" height="200" ');
  const asset=new Image();
  const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup);
  asset.onload=()=>{if(cachedKey!==key)return;image=asset;ready=true;if(typeof invalidateSceneCache==='function')invalidateSceneCache();if(typeof draw==='function')draw()};
  asset.onerror=()=>{ready=false};
  asset.src=url;
 }
 function paint(ctx,x,y,w,h){update();if(!ready)return false;ctx.drawImage(image,x,y,w,h);return true}
 window.__conquerHeraldryCanvas={paint,invalidate:()=>{cachedKey='';ready=false;image=null}};
})();
