'use strict';
// Heraldry is campaign data; visual supports only clip the shared rectangular SVG.
(()=>{
const DEFAULT={pattern:2,c1:'#b32628',c2:'#eac15b',symbol:'lion',c3:'#111111',c4:'#f5e8c8'};
const patterns=['plain1','plain2','perFess','pale','billet','cross','fess','pall','chevron','lozenge','pile','saltire','perPale','perBend','perSaltire','quarterly','bend','gyron','point','wavy'];
const $=id=>document.getElementById(id);
const validHex=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
let h={...DEFAULT,...(State.heraldry||{})};
function sanitize(){if(!patterns.includes(h.pattern))h.pattern=DEFAULT.pattern;for(const k of ['c1','c2','c3','c4'])if(!validHex(h[k]))h[k]=DEFAULT[k];if(!['lion','none'].includes(h.symbol))h.symbol='lion'}
function patternSvg(id,c1,c2){
 const base='<rect width="100" height="100" fill="'+c2+'"/>';
 const shape={
 plain1:'<rect width="100" height="100" fill="'+c1+'"/>',plain2:'',
 perFess:'<path d="M0 0H100V50H0Z" fill="'+c1+'"/>',
 pale:'<path d="M38 0H62V100H38Z" fill="'+c1+'"/>',
 billet:'<rect x="43" y="18" width="14" height="31" fill="'+c1+'"/>',
 cross:'<path d="M39 0H61V100H39ZM0 39H100V61H0Z" fill="'+c1+'"/>',
 fess:'<rect y="39" width="100" height="22" fill="'+c1+'"/>',
 pall:'<path d="M0 0L50 44 100 0 100 17 59 56 59 100 41 100 41 56 0 17Z" fill="'+c1+'"/>',
 chevron:'<path d="M0 69L50 20 100 69 100 86 50 39 0 86Z" fill="'+c1+'"/>',
 lozenge:'<path d="M50 14L85 50 50 86 15 50Z" fill="'+c1+'"/>',
 pile:'<path d="M5 0H95L50 87Z" fill="'+c1+'"/>',
 saltire:'<path d="M0 0H18L100 82V100H82L0 18ZM82 0H100V18L18 100H0V82Z" fill="'+c1+'"/>',
 perPale:'<rect width="50" height="100" fill="'+c1+'"/>',
 perBend:'<path d="M0 0H100V100Z" fill="'+c1+'"/>',
 perSaltire:'<path d="M0 0L50 50 100 0ZM0 100L50 50 100 100Z" fill="'+c1+'"/>',
 quarterly:'<path d="M0 0H50V50H0ZM50 50H100V100H50Z" fill="'+c1+'"/>',
 bend:'<path d="M0 0H24L100 76V100H76L0 24Z" fill="'+c1+'"/>',
 gyron:'<path d="M0 0H100L50 50ZM0 100L50 50 100 100Z" fill="'+c1+'"/>',
 point:'<path d="M0 0H100V100L50 32 0 100Z" fill="'+c1+'"/>',
 wavy:'<path d="M0 40Q12 28 25 40T50 40T75 40T100 40V62Q87 74 75 62T50 62T25 62T0 62Z" fill="'+c1+'"/>'
 };
 return base+(shape[id]||'');
}
function symbolSvg(){
 if(h.symbol==='none')return '';
 return '<g transform="translate(16 3) scale(.69)" fill="'+h.c3+'" stroke="'+h.c4+'" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M49 10l-8 6-11-1-7 8 5 6-7 5 6 3-2 8 9 2 5-9 9 3-2 8-12 3 4 7-7 9-7-2-3 8 9 5 10-5 6-11 8 4 2 9-5 7 9 5 8-4 1-10 8 1 5 8 9-4 1-12-9-6-3-12 8-2 8 7 6-6-7-13-12-5 7-7 11 3 4-6-4-7 3-8 8-4 2-10-6-6-8 5-4-7 5-9-6-5 2-9 12-3 2-8-7-6-11 3-3-7-7-2z"/></g>';
}
function layers(){return patternSvg(h.pattern,h.c1,h.c2)+symbolSvg()}
function svg(content,view='0 0 100 100'){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+view+'" aria-hidden="true">'+content+'</svg>'}
function clip(type){
 const shape=type==='shield'?'M12 5H88V51Q84 77 50 96Q16 77 12 51Z':type==='banner'?'M17 2H83V96L50 81 17 96Z':'M4 12H96V88H4Z';
 return svg('<defs><clipPath id="herald-'+type+'"><path d="'+shape+'"/></clipPath></defs><g clip-path="url(#herald-'+type+')">'+layers()+'</g><path d="'+shape+'" fill="none" stroke="#15100c" stroke-width="2.5"/>');
}
function draw(){
 $('heraldryPatterns').innerHTML=patterns.map((p,i)=>'<button type="button" class="'+(p===h.pattern?'active':'')+'" data-pattern="'+p+'" aria-label="Partizione '+(i+1)+'" title="Partizione '+(i+1)+'">'+svg(patternSvg(p,'#111','#f1e7d7'))+'</button>').join('');
 $('heraldryColors').innerHTML=[['c1','Colore 1 · campo'],['c2','Colore 2 · campo'],['c3','Colore 3 · simbolo'],['c4','Colore 4 · contorno']].map(([k,label])=>'<label class="heraldry-color"><input type="color" data-heraldry-color="'+k+'" value="'+h[k]+'"><span>'+label+'</span></label>').join('');
 $('heraldrySymbols').innerHTML='<button type="button" class="'+(h.symbol==='lion'?'active':'')+'" data-symbol="lion">'+svg(symbolSvg().replaceAll('fill="'+h.c3+'"','fill="#111111"'))+'<span>Leone</span></button><button type="button" class="'+(h.symbol==='none'?'active':'')+'" data-symbol="none"><span style="font-size:30px">∅</span><span>Nessuno</span></button>';
 $('heraldryFlag').innerHTML=svg(layers());
 $('heraldryApplications').innerHTML=[['shield','Scudo'],['banner','Stendardo'],['cloth','Tessuto']].map(([type,label])=>'<div class="heraldry-application">'+clip(type)+'<span>'+label+'</span></div>').join('');
}
function persist(){sanitize();State.heraldry={...h};saveLocal();scheduleLocalSave();$('heraldrySaveStatus').textContent='Araldica salvata nella partita · locale';draw()}
function open(tab='general'){
 $('profileOverlay').hidden=false;
 $('profileVillage').textContent=State.village?.name||'Insediamento non fondato';
 $('profileSeed').textContent=String(State.seed);
 $('profileBiome').textContent=(typeof BIOMES!=='undefined'&&BIOMES[State.biome]?.label)||State.biome;
 $('profileDay').textContent=(Number(State.clock?.day)||0).toFixed(1);
 setTab(tab);
}
function setTab(tab){document.querySelectorAll('[data-profile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.profileTab===tab));$('profileGeneral').hidden=tab!=='general';$('profileHeraldry').hidden=tab!=='heraldry';if(tab==='heraldry')draw()}
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
window.__conquerHeraldry={get:()=>({...State.heraldry}),render:()=>svg(layers()),open:()=>open('heraldry')};
})();
