// Opzioni grafiche (palette GRAFICA nel pannello Generale).
// Preferenze locali del giocatore: non fanno parte della partita salvata.
(function(){
  const KEY='conquer.graphics.v1';
  const DEFAULTS={edges:false,gradient:false,edgeWidth:0.035,gradientStrength:0.35};
  const state={...DEFAULTS};
  try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
  const api={
    DEFAULTS,
    all:()=>({...state}),
    get:k=>state[k],
    set(k,v){
      if(!(k in DEFAULTS))return;
      state[k]=v;
      try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
      window.dispatchEvent(new CustomEvent('conquer-graphics-change',{detail:{key:k,value:v}}));
      if(typeof invalidateSceneCache==='function')invalidateSceneCache('all');
      // The 3D world rebuilds its buffers only when its content signature changes; force it.
      window.ConquerWorld3D?.invalidate?.();
    },
    reset(){for(const k of Object.keys(DEFAULTS))api.set(k,DEFAULTS[k])}
  };
  window.ConquerGraphics=Object.freeze(api);
})();
