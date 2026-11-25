// Opzioni grafiche (palette GRAFICA nel pannello Generale).
// Preferenze locali del giocatore: non fanno parte della partita salvata.
(function(){
  const KEY='conquer.graphics.v1';
  const DEFAULTS={edges:false,gradient:false,edgeWidth:0.035,gradientStrength:0.35};
  const state={...DEFAULTS};
  let rev=0;  // bumped on every change: renderers include it in their cache signatures
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
  const api={
    DEFAULTS,
    all:()=>({...state}),
    rev:()=>rev,
    get:k=>state[k],
    set(k,v){
      if(!(k in DEFAULTS))return;
      state[k]=v;rev++;
      try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
      window.dispatchEvent(new CustomEvent('conquer-graphics-change',{detail:{key:k,value:v}}));
      if(typeof invalidateSceneCache==='function')invalidateSceneCache('all');
      // The 3D world rebuilds its buffers only when its content signature changes; force it.
      window.ConquerWorld3D?.invalidate?.();
      // Ask the game loop for a new frame: the 3D world only rebuilds while drawing.
      if(typeof markDirty==='function')markDirty(false,true,false);
      // The game draws on demand: redraw now so the 3D world rebuilds without a page reload.
      if(typeof draw==='function')draw();
    },
    reset(){for(const k of Object.keys(DEFAULTS))api.set(k,DEFAULTS[k])}
  };
  window.ConquerGraphics=Object.freeze(api);
})();
