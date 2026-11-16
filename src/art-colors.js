'use strict';
// ARTE commissioning colours: a commissioned work keeps the shapes of its archetype
// (src/assets/art-models.js) and chooses the colour of each of its slots (fondo, manto,
// cornice, materiale…). The choice is plain data — { slotId: '#rrggbb' } — stored with the
// work; paint() turns it into palette-key overrides for the renderer (the cutaway applies
// them like the heraldry colours). A slot recolours one palette key and, when it has one,
// its shade key, darkened by the same ratio as in the default colours.
// Swatches are the suggested pigments, wools, gildings and stones; any #rrggbb is accepted.
(function(){
  const AM=()=>window.ConquerArtModels;
  const HEX=/^#[0-9a-f]{6}$/i;
  const entry=name=>AM()?.catalog?.[name]||null;
  function slots(name){return entry(name)?.colors||[]}
  function defaults(name){const o={};for(const s of slots(name))o[s.id]=s.default;return o}
  function swatches(set){return AM()?.swatches?.[set]||{}}
  function darken(hex,k){
    const n=parseInt(hex.slice(1),16),f=1-k,c=v=>Math.max(0,Math.min(255,Math.round(v*f)));
    return '#'+[n>>16&255,n>>8&255,n&255].map(v=>c(v).toString(16).padStart(2,'0')).join('');
  }
  // Only known slots and valid colours survive; missing slots take the default.
  function normalize(name,colors){
    const out=defaults(name);
    for(const s of slots(name)){const v=colors?.[s.id];if(typeof v==='string'&&HEX.test(v))out[s.id]=v.toLowerCase()}
    return out;
  }
  // The colours that differ from the archetype, as { slotId: hex } (what a save needs to keep).
  function diff(name,colors){
    const n=normalize(name,colors),d=defaults(name),out={};
    for(const id of Object.keys(n))if(n[id]!==d[id].toLowerCase())out[id]=n[id];
    return out;
  }
  // Palette-key overrides { key: hex } for the renderer; empty for the archetype's own colours.
  function paint(name,colors){
    const changed=diff(name,colors),out={};
    for(const s of slots(name)){
      const v=changed[s.id];if(!v)continue;
      out[s.key]=v;if(s.shade)out[s.shade]=darken(v,s.k||0);
    }
    return out;
  }
  // Stable signature of a colour choice (cache keys).
  function signature(name,colors){const d=diff(name,colors);return Object.keys(d).sort().map(k=>k+d[k]).join(',')}
  window.ConquerArtColors={slots,defaults,swatches,normalize,diff,paint,signature,darken};
})();
