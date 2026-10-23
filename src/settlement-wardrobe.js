'use strict';
// CONQUER seasonal wardrobe: a catalogue of clothing overlays drawn over the shared
// villager figure (drawVillagerFigureUnmasked) in bad weather and in the cold months.
// Overlays, not alternate skins: the procedural body keeps its class silhouette and
// tunic colours, and the pieces stack (a cloak with a hood, a shawl under a hat).
// Outfits are pure functions of resident id, month and weather: no state, no economy.
// Classic script.
(function(){
  // slot: body (over the tunic), head (over hair), neck (scarf/collar).
  // palette: deterministic per resident; trim: fur or lining edge.
  const PIECES={
    strawHat:{label:'Cappello di paglia',slot:'head',when:'Estate, sereno o vento',palette:['#d9bf6e','#cfb25c','#e0c77f']},
    furCap:{label:'Berretto di pelliccia',slot:'head',when:'Inverno',palette:['#6b4f36','#4f3b2a','#7d6248'],trim:'#a8885f'},
    woolHood:{label:'Cappuccio di lana',slot:'head',when:'Inverno, neve e nebbia',palette:['#7d2f24','#4f5f3a','#6b5a44','#3f4a5c']},
    rainHood:{label:'Cappuccio cerato',slot:'head',when:'Pioggia e temporale',palette:['#5f5b48','#6a6450','#4f5550']},
    sheepskin:{label:'Pelle di pecora',slot:'body',when:'Inverno (popolani)',palette:['#cdbb98','#bfae8c','#d6c7a6'],trim:'#efe6d2'},
    woolCloak:{label:'Mantello di lana',slot:'body',when:'Inverno (artigiani)',palette:['#5b4a3a','#4a5544','#5a4b55','#4d4f5c'],trim:'#8a7559'},
    furCloak:{label:'Mantello foderato di pelliccia',slot:'body',when:'Inverno (mercanti)',palette:['#5a2f45','#2f4560','#3f5a3a'],trim:'#e8dfcc'},
    rainCape:{label:'Mantella antipioggia',slot:'body',when:'Pioggia e temporale',palette:['#5f5b48','#6a6450','#4f5550']},
    shawl:{label:'Scialle di lana',slot:'neck',when:'Mezze stagioni con vento o nebbia',palette:['#8b3a2e','#6d6a3a','#7a6a8c','#a07040']}
  };
  // Calendar month (0 = January) -> share of residents dressed for the cold / the sun.
  // Shoulder months dress only part of the town, so a season never flips everyone at once.
  const WINTER_BY_MONTH=[1,1,.45,0,0,0,0,0,0,0,.45,1];
  const SUMMER_BY_MONTH=[0,0,0,0,.4,1,1,1,.4,0,0,0];
  const HAT_SHARE={peasant:.75,artisan:.45,merchant:.3};
  const CLOAK_BY_CLASS={peasant:'sheepskin',artisan:'woolCloak',merchant:'furCloak'};
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  const roll=(id,salt)=>(hash(String(id)+':'+salt)%10000)/10000;
  const pick=(piece,id)=>{const p=PIECES[piece].palette;return p[hash(String(id)+':'+piece)%p.length]};

  // Weather kinds as defined by settlement-weather.js (sun/clear/wind/rain/storm/snow/fog).
  function fromKind(season,kind,month=null){
    return{season,month,kind,wet:kind==='rain'||kind==='storm',snow:kind==='snow',
      windy:kind==='wind'||kind==='storm',fog:kind==='fog'};
  }
  let cacheKey='',cacheValue=null;
  function conditions(){
    const P=api.preview;
    if(P)return fromKind(P.season||'summer',P.weather||'clear',Number.isInteger(P.month)?P.month:null);
    const S=typeof State!=='undefined'?State:{};
    const day=Math.floor(Number(S.clock?.day)||0);
    const w=typeof currentWeather==='function'?currentWeather():null;
    const key=day+'|'+S.season+'|'+(S.seasonOverride||'')+'|'+(w?.kind||'');
    if(key===cacheKey&&cacheValue)return cacheValue;
    // A forced DEV season dresses everyone for it; the calendar staggers the change.
    const month=!S.seasonOverride&&typeof calendarDateFromDay==='function'?calendarDateFromDay(day).month:null;
    cacheKey=key;cacheValue=fromKind(S.season||'summer',w?.kind||'clear',month);
    return cacheValue;
  }
  function levels(c){
    const winter=c.snow?1:c.month!=null?WINTER_BY_MONTH[c.month]:c.season==='winter'?1:0;
    const summer=c.month!=null?SUMMER_BY_MONTH[c.month]:c.season==='summer'?1:0;
    return{winter,summer};
  }
  // Outfit = {head,body,neck} piece ids (or null) with their colours.
  function compose(pieces,id='catalogue'){
    const o={head:null,body:null,neck:null,colors:{},sleeve:null};
    for(const piece of pieces){
      const P=PIECES[piece];if(!P)continue;
      o[P.slot]=piece;o.colors[P.slot]=pick(piece,id);
    }
    o.sleeve=o.body?o.colors.body:null;
    return o.head||o.body||o.neck?o:null;
  }
  function outfitFor(dot,c=conditions()){
    if(dot.outfit!==undefined)return dot.outfit;
    const id=dot.id,L=levels(c),pieces=[];
    if(c.wet)pieces.push('rainCape','rainHood');
    else if(roll(id,'winter')<L.winter){
      pieces.push(CLOAK_BY_CLASS[dot.kind]||'furCloak');
      pieces.push(c.snow||c.fog||roll(id,'cap')<.5?'woolHood':'furCap');
    }else{
      if(c.kind!=='fog'&&roll(id,'hat')<L.summer*(HAT_SHARE[dot.kind]??.3))pieces.push('strawHat');
      if((c.windy||c.fog)&&c.season!=='summer'&&roll(id,'shawl')<.45)pieces.push('shawl');
    }
    return compose(pieces,id);
  }

  const outline=(lw)=>{ctx.strokeStyle='rgba(33,24,16,.82)';ctx.lineWidth=lw;ctx.stroke()};
  // Over the tunic: x/bodyY are the figure's body centre, w/h its size (px).
  function drawBody(o,dot,x,bodyY,w,h){
    if(!o)return;
    const top=bodyY-h/2,lw=Math.max(.6,w*.1),fine=w>=2.6;
    ctx.save();
    if(o.body){
      const cape=o.body==='rainCape',hem=bodyY+h*(cape?.14:.30);
      ctx.beginPath();
      ctx.moveTo(x-w*.20,top-h*.02);ctx.lineTo(x-w*.50,top+h*.18);ctx.lineTo(x-w*.60,hem);
      ctx.quadraticCurveTo(x,hem+h*.10,x+w*.60,hem);ctx.lineTo(x+w*.50,top+h*.18);ctx.lineTo(x+w*.20,top-h*.02);ctx.closePath();
      ctx.fillStyle=o.colors.body;ctx.fill();outline(lw);
      if(!cape&&fine){
        // Open front: the class tunic colour stays readable down the middle.
        ctx.beginPath();ctx.moveTo(x-w*.05,top+h*.12);ctx.lineTo(x-w*.14,hem+h*.06);ctx.lineTo(x+w*.14,hem+h*.06);ctx.lineTo(x+w*.05,top+h*.12);ctx.closePath();
        ctx.fillStyle=dot.colors?.[0]||'#8c6b3f';ctx.fill();
      }
      const trim=PIECES[o.body].trim;
      if(trim&&fine){
        ctx.fillStyle=trim;ctx.beginPath();ctx.ellipse(x,top+h*.03,w*.34,h*.08,0,0,Math.PI*2);ctx.fill();
        if(o.body==='sheepskin'){ctx.strokeStyle=trim;ctx.lineWidth=Math.max(.6,h*.06);ctx.beginPath();ctx.moveTo(x-w*.58,hem);ctx.quadraticCurveTo(x,hem+h*.10,x+w*.58,hem);ctx.stroke()}
      }else if(cape&&fine){
        // Waxed cloth sheen.
        ctx.strokeStyle='rgba(220,230,235,.28)';ctx.lineWidth=Math.max(.5,w*.07);
        ctx.beginPath();ctx.moveTo(x-w*.30,top+h*.20);ctx.lineTo(x-w*.38,hem-h*.04);ctx.stroke();
      }
    }
    if(o.neck==='shawl'){
      ctx.fillStyle=o.colors.neck;
      ctx.beginPath();ctx.rect(x+w*.12,top+h*.08,w*.16,h*.36);ctx.fill();outline(lw*.7);
      ctx.beginPath();ctx.ellipse(x,top+h*.10,w*.46,h*.12,0,0,Math.PI*2);ctx.fill();outline(lw*.7);
    }
    ctx.restore();
  }
  // Over the head: x/headY its centre, r its radius; the hood also drapes the shoulders.
  function drawHead(o,x,headY,r){
    if(!o||!o.head)return;
    const lw=Math.max(.6,r*.2),c=o.colors.head,P=PIECES[o.head];
    ctx.save();
    if(o.head==='strawHat'){
      ctx.fillStyle=c;
      ctx.beginPath();ctx.ellipse(x,headY-r*.42,r*1.85,r*.42,0,0,Math.PI*2);ctx.fill();outline(lw*.8);
      ctx.beginPath();ctx.ellipse(x,headY-r*.55,r*.88,r*.72,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();outline(lw*.8);
      if(r>=1.2){ctx.strokeStyle='#7b5a2c';ctx.lineWidth=Math.max(.5,r*.18);ctx.beginPath();ctx.moveTo(x-r*.86,headY-r*.62);ctx.lineTo(x+r*.86,headY-r*.62);ctx.stroke()}
    }else if(o.head==='furCap'){
      ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,headY-r*.55,r*1.02,r*.70,0,Math.PI,Math.PI*2);ctx.closePath();ctx.fill();outline(lw*.8);
      ctx.fillStyle=P.trim;ctx.beginPath();ctx.ellipse(x,headY-r*.5,r*1.12,r*.30,0,0,Math.PI*2);ctx.fill();outline(lw*.6);
    }else{
      // Hood: a ring around the face, then a short cape over the shoulders.
      ctx.fillStyle=c;
      ctx.beginPath();ctx.moveTo(x-r*1.0,headY+r*.6);ctx.lineTo(x-r*1.5,headY+r*1.55);
      ctx.quadraticCurveTo(x,headY+r*2.0,x+r*1.5,headY+r*1.55);ctx.lineTo(x+r*1.0,headY+r*.6);ctx.closePath();ctx.fill();outline(lw*.8);
      ctx.beginPath();ctx.ellipse(x,headY-r*.02,r*1.28,r*1.32,0,0,Math.PI*2);
      ctx.moveTo(x+r*.9,headY+r*.18);ctx.ellipse(x,headY+r*.18,r*.9,r*.94,0,0,Math.PI*2);ctx.fill('evenodd');
      ctx.beginPath();ctx.ellipse(x,headY-r*.02,r*1.28,r*1.32,0,0,Math.PI*2);outline(lw*.8);
      // The liripipe tail of the wool hood falls on one side.
      if(o.head==='woolHood'&&r>=1.2){ctx.beginPath();ctx.moveTo(x+r*.9,headY-r*.9);ctx.quadraticCurveTo(x+r*2.0,headY-r*.4,x+r*1.7,headY+r*1.2);ctx.lineTo(x+r*1.35,headY+r*1.0);ctx.closePath();ctx.fill();outline(lw*.6)}
    }
    ctx.restore();
  }
  const api={PIECES,WINTER_BY_MONTH,SUMMER_BY_MONTH,preview:null,conditions,fromKind,levels,compose,outfitFor,drawBody,drawHead};
  window.ConquerWardrobe=api;
})();
