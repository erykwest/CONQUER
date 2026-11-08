'use strict';
// STONECOLOR: one visual stone family per map. Never changes construction material, HP or resources.
(()=>{
  const PALETTES=Object.freeze({
    gray:     {label:'Grigio',    shades:['#C2B6A8','#9A8E82','#82776C','#635951','#514A44']},
    sandstone:{label:'Arenaria',  shades:['#DFC6A2','#C7AE88','#B59C79','#87705A','#574638']},
    tuff:     {label:'Tufo',      shades:['#F1DFB0','#D8C47F','#BDA763','#877747','#5D5138']},
    limestone:{label:'Calcare',   shades:['#FAF8F1','#E8E6E0','#D6D2CA','#AFB0AC','#7B817F']},
    granite:  {label:'Granito',   shades:['#A1A5AA','#81868D','#646B73','#464C55','#2C333C']}
  });
  const IDS=Object.freeze(Object.keys(PALETTES));
  // A new map's random seed determines its stone family without a second mutable RNG.
  function randomForSeed(seed){const s=(Number(seed)||1)>>>0;let x=Math.imul(s^0x9e3779b9,0x85ebca6b);x=Math.imul(x^x>>>13,0xc2b2ae35);return IDS[((x^x>>>16)>>>0)%IDS.length]}
  function normalized(id){return IDS.includes(id)?id:'gray'}
  function current(){return normalized(State.stonePaletteId)}
  function parse(hex){return[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
  function hexOf(rgb){return'#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}
  // The existing grayscale family is the calibration reference (not a replacement texture).
  const REFERENCE=[194,154,130,99,77];
  function shade(color){
    if(!/^#[0-9a-fA-F]{6}$/.test(color)||current()==='gray')return color;
    const rgb=parse(color),L=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    const ramp=PALETTES[current()].shades.map(parse);
    if(L>=REFERENCE[0])return hexOf(ramp[0]);
    if(L<=REFERENCE[4])return hexOf(ramp[4]);
    let i=0;while(i<4&&L<REFERENCE[i+1])i++;
    const t=Math.max(0,Math.min(1,(REFERENCE[i]-L)/(REFERENCE[i]-REFERENCE[i+1])));
    return hexOf(ramp[i].map((v,j)=>v+(ramp[i+1][j]-v)*t));
  }
  // Semantic call sites only: these are stone surfaces, never generic beige/grey pixels.
  const MASONRY=new Set([
    '#9a8e82','#635951','#514a44','#887d72','#554d46','#403b36',
    '#9f9183','#c8b9a9','#918579','#605750','#4a443e','#b3a596',
    '#948779','#625a52','#4b4540','#8f857a','#82776c','#61574f',
    '#5a514a','#49443f','#686057','#84796d','#4e4740','#5d554d',
    '#88796b','#62584f','#8c7b69','#554b42','#66594d','#9f9285',
    '#9f9285','#a59b8d','#b8aa99','#676a6c','#66635f','#77736e',
    '#6b6863','#7d7973','#85817a','#696862','#777671','#85847d',
    '#625e59','#4f4b47','#9f9285'
  ]);
  function masonry(hex){return typeof hex==='string'&&MASONRY.has(hex.toLowerCase())?shade(hex):hex}
  function changed(id){
    if(!IDS.includes(id)||current()===id)return false;
    State.stonePaletteId=id;
    if(typeof invalidateSceneCache==='function')invalidateSceneCache();
    window.__conquerAssetCompiler?.clearComposite?.();
    if(typeof saveLocal==='function')saveLocal();
    if(typeof markDirty==='function')markDirty(false,false,false);
    if(typeof draw==='function')draw();
    document.dispatchEvent(new CustomEvent('conquer-stonecolor-change',{detail:{id}}));
    return true;
  }
  State.stonePaletteId=randomForSeed(State.seed);
  window.ConquerStoneColor=Object.freeze({PALETTES,IDS,randomForSeed,normalized,current,shade,masonry,changed});
})();
